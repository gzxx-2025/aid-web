# SSE 全量契约 — 后续待改方案（暂缓实施）

> 日期：2026-07-26  
> 状态：**仅方案，默认不实施**；发现严重 bug 后再评估是否开工  
> 上位设计：[`docs/superpowers/specs/2026-07-24-create-flow-sse-page-coordinator-design.md`](../specs/2026-07-24-create-flow-sse-page-coordinator-design.md)  
> 已落地（本轮）：分镜脚本/图/视频/配音批量的假中断 toast 静默 + 保活 SSOT（`utils/taskSseSilentDisconnect.ts`）+ 步骤页 `pageDisposed`

---

## 1. 何时才需要动这份方案

满足任一即可评估开工，否则保持现状：

| 触发信号 | 严重度建议 |
|----------|------------|
| 切步骤/切作品后弹出「连接中断 / Task SSE aborted」且 loading 被清掉 | **高** — 优先接静默 SSOT |
| 切回步骤后卡片一直转、Network 无 `/task/stream`，只能刷新恢复 | **高** — 优先 restore/闸门 |
| 弹窗关闭后外层 loading 无人跟进；重开弹窗才继续 | **中** — 外层静默 follow |
| 对口型/配音弹窗切步后状态丢失或跨集串 loading | **中～高** — 视复现频率 |
| 第三步切 Tab/切步偶发假失败 toast | **中** — 对齐 SSOT |
| 仅 Console `__draggable_context`、无业务影响 | **低** — 可继续观察 |

**原则**：小步、可回滚；一次只接一类 owner；禁止顺手改导航时序 / 恢复切步遮罩。

---

## 2. 目标契约（与上位设计一致）

所有「创作流程内、按 taskId 走 `/api/user/task/stream`」的生成，最终应对齐：

1. 切步骤 / 切作品 / 切剧集 → **只断浏览器 SSE**，不取消服务端任务（除非用户点停止）  
2. Pinia / scope 桶保留 `generating` + `taskId`  
3. 回到**有进行中任务的当前可见页**（第三步再加当前 Tab）→ **必重连**（除非已终态）  
4. 已成功 → 不重连空流，**直接展示结果**  
5. 导航/suspend/superseded/Abort → **禁止失败 toast**  
6. 任意时刻浏览器侧尽量 **只连当前页相关 SSE**

非目标（本后续方案仍不做）：

- 切回后强制自动打开编辑弹窗  
- 一次重写 `SceneCharacterProp.vue` / `EditStoryboardDubbingModal.vue` 全文件  
- 改后端任务协议  

---

## 3. 现状快照（2026-07-26）

| Owner | 切走断连 | 切回重连+成功回填 | 假中断静默 | 备注 |
|-------|----------|-------------------|------------|------|
| 分镜脚本 batch | ✅ | ✅ | ✅ 本轮 | |
| 分镜图 batch | ✅ | ✅ | ✅ 本轮 | 提示词流仍有裸 `useTaskStream`，未进 registry |
| 分镜视频 batch | ✅ | ✅ | ✅ 本轮 | |
| 配音步骤 batch（SSE） | ✅ | ✅ | ✅ 本轮 | |
| 第三步场景/角色/道具 | ✅ 自有 | ✅ 自有 | ⚠️ 自有白名单 | 未统一到 `taskSseSilentDisconnect` |
| 编辑弹窗（场景图/分镜图/视频/超分/多视图等） | ⚠️ 靠壳层 suspend registry | ⚠️ 多半要再开弹窗 | ⚠️ `isBenign` 部分接 | 外层静默 follow 不齐 |
| 配音弹窗对口型 | ⚠️ 多为 compose 轮询 | ⚠️ 自有 restore | ⚠️ 另一套 | 与 task SSE 契约未同一套 |
| 剧集资产提取等旁路 | 有 stream | 有限 | 未对齐 | 低频 |

本轮已有 SSOT：`utils/taskSseSilentDisconnect.ts`  
- `shouldSilentStoryboardBatchToast`  
- `shouldKeepImageBatchLoadingAfterFollowMessage` / `isNavigationOrSuspendBatchMessage`  
后续接入应 **复用此文件**，禁止再造第四套 `includes('后台执行')`。

---

## 4. 后续改动包（按优先级，可独立开工）

### P0 — 静默 SSOT 全出口对齐（成本低、收益高）

**动机**：假中断 toast 仍可能从第三步 / 弹窗 catch / 未过滤的 `message.error` 漏出。

**改什么**：

1. `SceneCharacterProp.vue` 良性断连判定改为调用 `isNavigationOrSuspendBatchMessage` / `shouldSilentStoryboardBatchToast`（或薄包装）  
2. 各 `use*Image*Task` / `useEditImageTask` 等：业务失败 toast 前统一过 SSOT  
3. 审计：`rg "message\\.(error|warning).*中断|连接中断|Task SSE"`，漏网补静默  

**验收**：第三步/弹窗生成中切步 → 无中断类 toast；真失败（余额不足等）仍提示。  
**不动**：导航、restore 主路径。

---

### P1 — 裸 `useTaskStream` 纳入 suspend 注册表

**动机**：分镜图/视频提示词等仍直接 `useTaskStream`，壳层 `suspendAllTaskSseFollows` 管不到，只能靠页卸载 `cancelResumeFollow`，竞态窗口更大。

**改什么**：

1. 提示词 follow 改为 `waitUserTaskSseTerminal`，或创建后 `claim` 进 `activeTaskSseFollowSlots`  
2. `cancelResumeFollow` 仍保留 generation++，与 registry abort 语义对齐  
3. 单测：suspend 后 follow 返回后台保活文案，不 clear loading  

**验收**：生成中切步，即使组件卸载略晚，也不会落到「连接中断请重试」假失败。  
**风险**：双 close；需保留 generation 闸门。

---

### P2 — 第三步 restore / 静默与 SSOT、coordinator 对齐

**动机**：第三步已有较完整 Tab 互斥与 restore，但白名单、闸门与分镜 batch 不一致，后续难维护。

**改什么**（小步，禁止整文件重写）：

1. 良性断连 / toast → P0 SSOT  
2. `startTrackTask` 结束分类：navigation suspend 与真失败分支对照 checklist  
3. 若假 `followInFlight` / closer 挡重连再现 → 按上位设计修闸门（先测后搬）  

**验收**：上位设计 N1/N2/N3/N7（第三步）。  

---

### P3 — 编辑弹窗外层静默 follow

**动机**：关弹窗或切步后外层卡片 loading 亮着但无人跟 SSE；用户必须再开弹窗。

**改什么**：

1. 明确 owner：步骤页 outer restore **能**跟 modal 登记的 `taskId`（不必自动开窗）  
2. 弹窗与 outer **共享同一 follow 槽**（同 taskId 禁止双连）  
3. 切作品释放/迁移 modal lock，避免挡死重连  

**验收**：弹窗生成中关窗或切步再回步骤页 → 有新 stream 或已终态回填；无双 stream。  
**非目标**：强制自动重开弹窗（上位设计已排除）。

**2026-07-26 已落地（方案 A）**：

- `utils/sceneModalOuterFollowHandoff.ts`：关窗 superseded 须 endFollow；外层开流前查弹窗槽  
- `hasLiveTaskSseFollow` + `startTrackTask` 同步占坑：防双 `/task/stream`  
- 关窗 `nextTick` 后再 outer restore；挂起收尾若已终态则 endFollow  
- 分镜图/视频关窗 restore 同样 `nextTick`

---

### P4 — 配音弹窗对口型与步骤契约统一

**动机**：对口型仍大量 compose 轮询；切步/切集行为与 SSE batch 不一致。

**改什么**（分两阶段）：

1. **过渡期**：compose 轮询也遵守「离开暂停、回来续跟、按 `projectId:episodeId` 隔离」；禁止与 SSE 双开抢同一 loading  
2. **协议切换后**：对口型改 SSE 时直接挂同一 suspend/resume + SSOT（见上位设计 §4.3）  

**验收**：上位设计 N8。  

---

### P5 — 清理与矩阵回归（有余力再做）

1. 删除重复 `includes('后台执行')` / 各文件私有 benign 副本  
2. 补单测：SSOT 表格、suspend→keepalive、restore 闸门  
3. 手工跑上位设计 N1～N8 全矩阵  

---

## 5. 建议开工顺序（若评估要改）

```text
先确认复现路径属于哪一类 Owner
  → 假 toast 为主：只做 P0
  → loading 卡死无 stream：P1 或 P2/P3（看是否第三步/弹窗/batch）
  → 对口型/配音弹窗：P4
  → 禁止「P0+P3+导航」捆一个 PR
```

| 现象 | 优先包 |
|------|--------|
| 任意步骤假中断 toast | P0 |
| 分镜图/视频切步偶发假失败（本轮后仍现） | P1 |
| 第三步卡 loading / 假 toast | P0 → P2 |
| 关弹窗外层 loading 不走 | P3 |
| 对口型切步丢状态 | P4 |

---

## 6. 硬约束（实施时）

- **不改** `pushCreateStepRoute` / 不恢复 `createStepSwapPlaceholder`  
- **不为**修 draggable 加导航 `nextTick`/`rAF`/二次 `replace`  
- 静默/保活文案 **只扩展** `utils/taskSseSilentDisconnect.ts`  
- 巨石文件：先抽小模块或只改出口过滤，禁止整段粘贴新功能  
- 遵守《现有代码安全整改方案》：行为冻结区先测后搬  

---

## 7. 文档关系

| 文档 | 角色 |
|------|------|
| `2026-07-24-create-flow-sse-page-coordinator-design.md` | 总契约与 owner 划分 |
| `2026-07-24-create-flow-sse-page-coordinator.md` | 原实施 plan（Tasks 1～9） |
| **本文** | **剩余缺口 + 暂缓实施的评估入口** |

发现严重 bug 时：在对应 Issue/对话中注明「触发信号 + 建议 P0～P4 包」，再开实施 PR。
