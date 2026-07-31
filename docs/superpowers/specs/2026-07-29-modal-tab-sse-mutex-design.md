# 弹窗 Tab SSE 互斥与素材准备并发上限设计

> 日期：2026-07-29  
> 状态：实现中（P0–P3 代码已落地；待人工联调验收）  
> 关联：`docs/superpowers/specs/2026-07-24-create-flow-sse-page-coordinator-design.md`、`components/steps/SSE跨步骤任务管理排查报告.md`  
> 规范：`docs/2026-07-22-frontend-development-standards.md`、`docs/2026-07-22-existing-code-safe-remediation.md`
> 计划：`docs/superpowers/plans/2026-07-29-modal-tab-sse-mutex.md`

---

## 1. 问题与目标

### 1.1 现象

编辑弹窗顶部有大量 Tab（形态图 / 分镜）时，用户在多个 Tab 上先后发起生成后来回切换：

1. 切 Tab 时只对**新 Tab** 做 `restore`，**旧 Tab 的浏览器 SSE 不断开**
2. 20 个 Tab 各有进行中任务时，可能同时挂 20+ 路 `/api/user/task/stream/{taskId}`
3. 素材准备外层列表连点多个「自动生成」时，也可能并行多路 SSE，叠加打爆后端连接

### 1.2 根因

| 根因 | 说明 |
|------|------|
| 弹窗 Tab 无互斥 | `switchScene` 只 restore 当前，不 suspend 其它 editorScope / storyboardId |
| 外层无并发上限 | `startTrackTask` 有任务就立刻连 SSE，无队列 |
| 弹窗与外层预算未统一 | 开窗 follow 与列表 follow 各自占连接，无共享上限 |

### 1.3 目标

1. **弹窗顶部 Tab 严格互斥**：任意时刻同一弹窗实例内，浏览器 SSE ≤ 1（仅当前可见 Tab）
2. **素材准备外层最多 6 路**：超出排队；有空位自动出队连接
3. **弹窗占槽计入 6**：开窗时外层最多再跟 5
4. **切回已终态 Tab 必须清 loading**：restore 先查 `task/detail`，终态则结算，禁止假死 loading
5. **任务不断**：suspend 只断浏览器连接，不取消服务端任务（除非用户点停止）
6. **小步可测**：新建纯函数 gate/mutex + 薄接入；不做完整 page coordinator 大重构

### 1.4 非目标

- 不重写 create-flow SSE page coordinator 全量架构
- 不改分镜步骤页 batch（脚本/图批/视频批）的切步骤策略（仍靠壳层 suspend + 回页 restore）
- 不改后端任务协议与 cancel 语义
- 左侧配置 Tab（生成 / 对话作图 / 图生视频等）切换不触发 SSE 互斥

---

## 2. 产品契约（已确认）

### 2.1 弹窗顶部 Tab 互斥（全覆盖）

| 弹窗 | 顶部 Tab 键 | 规则 |
|------|-------------|------|
| `EditSceneImageModal` | `editorScopeKey`（形态/场景索引） | 切走 suspend；只连当前 Tab |
| `EditStoryboardImageModal` | `storyboardId` | 同上 |
| `EditStoryboardVideoModal` | `storyboardId` | 同上 |
| `EditStoryboardDubbingModal` | `storyboardId`（对口型 SSE） | 同上；compose 轮询：切 Tab 暂停、切回续跟，不占 SSE 槽 |

| 用户动作 | 浏览器 SSE | Pinia loading / taskId | 服务端任务 |
|----------|------------|------------------------|------------|
| 切到其它顶部 Tab | suspend 旧 Tab | 保留 | 继续 |
| 切回某 Tab 且任务仍进行中 | resume（重连） | 恢复展示 | 继续 |
| 切回某 Tab 且任务已终态 | **不连 SSE**；结算并清 loading | 清除 | 已终态 |
| 左侧配置 Tab 切换 | 不断 | 不变 | 继续 |
| 用户点停止 | close + cancel API | 按现有 stop 清 | 取消 |

### 2.2 素材准备外层并发

- 范围：第三步 `SceneCharacterProp` 外层 `startTrackTask` 及关窗后的静默续跟
- 上限：`MAX_STEP3_SSE = 6`
- 超出：任务已提交、卡片 loading 亮，但 SSE 入队；槽位释放后 FIFO 出队连接
- 弹窗当前 Tab 的 1 路 **计入** 这 6（开窗时外层最多 5）

### 2.3 开窗占槽优先级

弹窗可见且需 follow 时优先占槽：若外层已满 6，可挤掉最老的**非弹窗** follow（将其重新入队），保证当前可见弹窗 Tab 能连上。

### 2.4 与壳层现有行为的关系

| 场景 | 现有行为（保持） | 本期叠加 |
|------|------------------|----------|
| 切创作步骤 | `suspendAllTaskSseFollows` + 新页 restore | 回素材准备时 restore 仍受 max=6 |
| 切作品/剧集 | scope 变化 suspend + 当前页 restore | 队列失效/重建；按当前 scope |
| 刷新 | 旧连接全断；当前页 restore | 同上；弹窗打开后再互斥 restore |

---

## 3. 架构设计

### 3.1 总览

```text
【仅第三步】SceneCharacterProp.startTrackTask / 场景弹窗 follow
        │
        ▼
 step3SseConcurrencyGate (max=6)
   acquire → 立刻连 / enqueue
   release → drain 队头
   场景弹窗当前 Tab 的 1 路计入这 6

【全部 Edit*Modal】switchScene(to)
        │
        ▼
 modalTabSseMutex（每弹窗实例 ≤1 路）
   suspend 非当前 tabKey
   restore 仅当前 tabKey
        │
        ▼
 先 task/detail 终态探测
   终态 → 结算清 loading，不建连
   进行中 → 重连 SSE
              └─ 若是场景弹窗：再走 step3 gate（计入 6）
              └─ 若是分镜图/视频/配音弹窗：不走 step3 gate，只保证本弹窗 ≤1
```

### 3.2 新建模块

| 模块 | 职责 | 体量 |
|------|------|------|
| `utils/step3SseConcurrencyGate.ts` | 占槽 / 释放 / 排队 / drain；`MAX=6`；可 preempt 非 modal 槽 | ≤200 行；配 `*.test.mjs` |
| `utils/modalTabSseMutex.ts` | 纯函数：当前 tabKey、活跃 follow 列表 → 应 suspend 的 id 列表；是否允许当前建连 | ≤150 行；配单测 |

### 3.3 接入点（薄改）

| 位置 | 改动 |
|------|------|
| `SceneCharacterProp.vue` → `startTrackTask` | 连 SSE 前 `acquire`；结束/suspend/`finally` 时 `release` + `drain` |
| `EditSceneImageModal.vue` | `switchScene`：互斥 suspend；follow 走 **step3 gate**；restore 先终态探测 |
| `EditStoryboardImageModal.vue` | 互斥 suspend + 仅当前 restore + 终态探测；**不**走 step3 gate |
| `EditStoryboardVideoModal.vue` | 同上（按 `storyboardId`） |
| `EditStoryboardDubbingModal.vue` | 对口型 SSE 互斥；compose 轮询暂停/续跟；终态探测；**不**走 step3 gate |

**原则**：业务成功/失败/取消逻辑仍在原有 follow 实现；gate/mutex **只拥有连接生命周期与排队决策**。禁止在巨石 `.vue` 上整段粘贴新调度器——规则进 utils，组件只调用。

### 3.4 数据键

| 用途 | 键 |
|------|----|
| gate 槽 | `taskId`（全局唯一） |
| 场景弹窗互斥 | `editorScopeKey` |
| 分镜三类弹窗互斥 | `storyboardId` |
| 槽归属标记 | `owner: 'modal' \| 'outer'`（供 preempt） |

---

## 4. 时序

### 4.1 弹窗内切顶部 Tab

```text
当前 Tab A 有 SSE；用户点 Tab B
  → mutex：suspend A（reason=tab-pause，禁止 toast）
  → gate.release(A.taskId)
  → UI 切到 B
  → restore B：
       detail 已终态 → 结算 + 清 loading + return
       仍进行中 → 重连 SSE
         · 场景弹窗：gate.acquire（可 preempt 外层）
         · 分镜类弹窗：仅本弹窗互斥，不进 step3 队列
  → A 仅保留 Pinia loading，不占连接
```

### 4.2 外层连点自动生成

```text
1～6：submit → acquire → startTrackTask 连 SSE
≥7：submit → loading → enqueue（不连）
某路终态/suspend → release → drain 队头 → acquire → 连 SSE
```

### 4.3 开/关弹窗

```text
开窗：当前 Tab restore（弹窗优先占槽）
关窗：suspend 弹窗 SSE → release → 外层 restoreAndTrack / batch restore（仍受 max=6）
```

### 4.4 切回已结束任务（防 loading 假死）— 硬规则

切回任意 Tab / 外层 restore 时：

1. **必须先**查任务是否已终态（`task/detail` 或现有 `resolveUserTaskTerminalOutcome`）
2. 终态 → 走现有结算路径（回填产物、清 Pinia、清 overlay），**禁止**建空 SSE
3. detail 暂失败 → 有限次重试；仍不确定可短连 SSE 或再次 detail 收口
4. **禁止**「有 loading + 无 follow + 不查 detail」的长期状态

场景弹窗已有 `applyTerminalSceneModalTaskIfNeeded` 可复用模式；分镜图/视频/配音 restore 必须对齐。

---

## 5. 静默与错误

- `reason === 'tab-pause' | 'navigation' | 'scope-change' | 'superseded' | 'preempted-for-modal'` 触发的 close：**禁止**失败 toast
- 复用 `isBenignTaskSseDisconnectMessage` / 现有 deferred 策略；deferred restore 必须再走 gate，且受 `modalSseFollowReconnectPolicy` 次数上限约束

---

## 6. 验收清单

| ID | 场景 | 期望 |
|----|------|------|
| M1 | 场景弹窗 20 Tab 都 generating，来回切 | Network 上该弹窗相关 EventStream **始终 ≤ 1** |
| M2 | 分镜图 / 视频 / 配音弹窗同上 | 同上 |
| M3 | 切回 Tab 时任务已在服务端结束 | loading 清除、产物回填；不建 SSE |
| O1 | 素材准备连点 10 次自动生成 | EventStream **≤ 6**；其余排队；完成后自动补连 |
| O2 | 开弹窗时外层已 6 满 | 总数仍 ≤ 6；弹窗当前 Tab 能连上 |
| O3 | 关窗后外层续跟 | 不双连；仍 ≤ 6 |
| N1 | 切步骤 / 切作品 / 刷新 | 无误报中断 toast；回页可续跟 |
| N2 | 左侧配置 Tab 切换 | 不断当前顶部 Tab 的 SSE |

---

## 7. 实现分期（建议）

| 阶段 | 内容 | 验收 |
|------|------|------|
| P0 | `step3SseConcurrencyGate` + 单测；接入 `startTrackTask` | O1 |
| P1 | `modalTabSseMutex` + `EditSceneImageModal` 互斥与终态 restore | M1、M3 |
| P2 | 分镜图 / 视频弹窗互斥 + 终态 | M2 |
| P3 | 配音弹窗（SSE + 轮询暂停）+ 开窗 preempt | M2、O2、O3 |
| P4 | 回归 N1/N2；必要时补文档交叉引用 | 全表 |

每阶段可独立合并；不做「拆文件 + 改业务结算」捆绑大 PR。

---

## 8. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 排队任务进度文案滞后 | 卡片保留 generating；出队后进度恢复；可接受 |
| preempt 外层导致短暂无进度 | 外层入队后仍有 loading；回页/关窗 drain |
| 巨石文件难改 | 规则进 utils；组件只加调用点 |
| 误清 loading | 终态结算复用现有 apply/finalize，不新造清场函数 |

回滚：feature 可按弹窗逐步关；gate 可将 `MAX` 临时调大或 `acquire` 恒成功作为紧急开关（仅调试，默认关闭）。
