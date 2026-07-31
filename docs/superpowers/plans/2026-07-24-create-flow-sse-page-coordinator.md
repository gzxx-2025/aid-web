# 创作流程 SSE 页面调度器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用统一页面 SSE 调度器治本解决「切步骤/作品/剧集后 loading 卡住、SSE 不重连、中英中断 toast」问题，并覆盖配音/对口型。

**Architecture:** 纯函数 policy + 模块级 coordinator 登记表；壳层 navigation 统一 suspend→resume；各步骤/弹窗以薄 adapter 接入。Pinia scope 桶继续存 loading/taskId；coordinator 只拥有浏览器连接生命周期。

**Tech Stack:** Nuxt 3 / Vue 3 / TypeScript / Pinia / 现有 `useTaskStream` + `useTaskSseFollow` / `node --test` 纯函数单测

**Spec:** `docs/superpowers/specs/2026-07-24-create-flow-sse-page-coordinator-design.md`

## Global Constraints

- 切走只断浏览器 SSE，不取消服务端任务（除非用户点停止）  
- 同时只连当前可见步骤（第三步再加当前 Tab）；剧集与作品同级 `scopeKey = projectId:episodeId`  
- 导航/scope/tab/superseded 断连禁止 toast（中英底层错误静默）  
- 遵守《安全整改》：一次一类事；不大爆炸重写巨石文件；行为可回滚  
- 响应中文；**不主动 git commit**（除非用户明确要求）  
- 单文件体量：新建 utils/composable 控制在规范上限内  

## File map

| 文件 | 职责 |
|------|------|
| `utils/createFlowSsePolicy.ts` | 当前视图是否允许某 ownerKind 建连 |
| `utils/createFlowSseSilentError.ts` | 导航场景静默 / 良性断连判定（可包装现有 benign） |
| `utils/taskSsePageCoordinator.ts` | register / unregister / suspend / resume / isLive |
| `utils/taskSsePageCoordinator.test.mjs` | coordinator + policy 单测 |
| `composables/useCreateFlowSseNavigation.ts` | 壳层 path/scope watch：suspend → debounce resume |
| `components/create/CreateFlowShell.vue` | 改用 navigation hook；保留/收敛 `suspendAllTaskSseFollows` |
| `composables/useCreateFlowShellLiveGenBootstrap.ts` | 去掉非脚本页越权连脚本 SSE；resume 交给 coordinator |
| `composables/useTaskSseFollow.ts` | suspend 实现与 coordinator liveSlot 对齐 |
| `components/steps/SceneCharacterProp.vue` | P1：假 closer 修复 + resume 入口 |
| `composables/useStoryboard*BatchGenerate.ts` | P2–P3：cancel/resume 接 coordinator |
| `components/steps/Dubbing.vue` + `EditStoryboardDubbingModal.vue` + audio batch | P4：配音契约 |
| 各 `Edit*Modal.vue` | P5：modal owner / 外层静默跟 |
| `utils/*RestoreGate*.ts` 等 | P6：假 following 判定改为 `isLive` |

---

### Task 1: Policy + 静默错误纯函数（P0 基础）

**Files:**
- Create: `utils/createFlowSsePolicy.ts`
- Create: `utils/createFlowSseSilentError.ts`
- Create: `utils/taskSsePageCoordinator.test.mjs`（先写 policy/silent 用例）
- Modify（可选 re-export）: `composables/useTaskSseFollow.ts` — `isBenignTaskSseDisconnectMessage` 可委托 silent util，避免双份白名单长期分叉

**Interfaces:**
- Produces:
  - `CreateFlowSseOwnerKind` 联合类型（与 spec §3.3 一致，含 `storyboard-audio-batch` / `modal-storyboard-dubbing`）
  - `shouldConnectTaskSseForCurrentView(input: { step: CreationStep | null; ownerKind: CreateFlowSseOwnerKind; activeTab?: 'scene'|'character'|'prop'; tab?: 'scene'|'character'|'prop' }): boolean`
  - `shouldSilentSseDisconnect(input: { message?: unknown; reason?: 'navigation'|'scope-change'|'tab-pause'|'superseded'|'benign-disconnect' }): boolean`
  - `isBenignTaskSseDisconnectMessage(msg)` — 补齐 `Task SSE error` / `read failed` / `SSE HTTP` 在 navigation 上下文的静默；业务真实 error 事件不静默

- [ ] **Step 1: 写失败单测（policy）**

在 `utils/taskSsePageCoordinator.test.mjs`：

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldConnectTaskSseForCurrentView } from './createFlowSsePolicy.ts'
// 若项目暂不能直接 import .ts，则用已编译路径或先抽纯 .mjs 再在 ts 中 re-export；优先与仓库现有 util 测试方式一致。

test('step3 owner only on scene-character + matching tab', () => {
  assert.equal(
    shouldConnectTaskSseForCurrentView({
      step: 'scene-character',
      ownerKind: 'step3-form-image',
      activeTab: 'scene',
      tab: 'scene'
    }),
    true
  )
  assert.equal(
    shouldConnectTaskSseForCurrentView({
      step: 'storyboard-script',
      ownerKind: 'step3-form-image',
      activeTab: 'scene',
      tab: 'scene'
    }),
    false
  )
  assert.equal(
    shouldConnectTaskSseForCurrentView({
      step: 'scene-character',
      ownerKind: 'step3-form-image',
      activeTab: 'character',
      tab: 'scene'
    }),
    false
  )
})

test('dubbing owners only on dubbing step', () => {
  assert.equal(
    shouldConnectTaskSseForCurrentView({
      step: 'dubbing',
      ownerKind: 'modal-storyboard-dubbing'
    }),
    true
  )
  assert.equal(
    shouldConnectTaskSseForCurrentView({
      step: 'storyboard-video',
      ownerKind: 'storyboard-audio-batch'
    }),
    false
  )
})
```

- [ ] **Step 2: 写失败单测（silent）**

```js
test('navigation abort is silent', () => {
  assert.equal(
    shouldSilentSseDisconnect({
      message: 'Task SSE aborted',
      reason: 'navigation'
    }),
    true
  )
  assert.equal(
    shouldSilentSseDisconnect({
      message: '任务连接中断',
      reason: 'scope-change'
    }),
    true
  )
})
```

- [ ] **Step 3: 实现 `createFlowSsePolicy.ts` / `createFlowSseSilentError.ts` 使测试通过**

Policy 映射（必须实现）：

| ownerKind | 允许 step |
|-----------|-----------|
| `step3-*` | `scene-character` + tab 匹配（extract 可忽略 tab） |
| `storyboard-script` / `storyboard-image-batch` | `storyboard-script` |
| `storyboard-video-batch` | `storyboard-video` |
| `storyboard-audio-batch` / `modal-storyboard-dubbing` | `dubbing` |
| `modal-scene` | `scene-character` |
| `modal-storyboard-image` | `storyboard-script` |
| `modal-storyboard-video` | `storyboard-video` |

- [ ] **Step 4: 运行单测**

Run: `node --test utils/taskSsePageCoordinator.test.mjs`  
Expected: PASS（若需 ts 加载器，用仓库已有方式；否则先把被测函数写成 `.mjs` 再由 `.ts` re-export）

---

### Task 2: Coordinator 内核（P0）

**Files:**
- Create: `utils/taskSsePageCoordinator.ts`
- Modify: `utils/taskSsePageCoordinator.test.mjs`
- Modify: `utils/taskSseFollowRegistry.ts`（必要时扩展，保持 `suspendTaskSseFollowSlots` 行为）

**Interfaces:**
- Consumes: `CreateFlowSseOwnerKind`, `shouldConnectTaskSseForCurrentView`
- Produces:
  - `registerCreateFlowSseTask(entry: CreateFlowSseRegistration): void`
  - `unregisterCreateFlowSseTask(taskId: number): void`
  - `bindLiveFollow(taskId: number, scopeKey: string, abort: () => void): void`
  - `clearLiveFollow(taskId: number): void`
  - `isLiveCreateFlowSseFollow(taskId: number, scopeKey: string): boolean`
  - `suspendAllCreateFlowSseFollows(reason: 'navigation'|'scope-change'|'tab-pause'): number`
  - `listRegistrationsForResume(input: { scopeKey: string; step: CreationStep | null; activeTab?: ... }): CreateFlowSseRegistration[]`

`isLive` 规则（写死）：

```ts
// live iff bind 存在 && !closed && scopeKey 匹配
```

- [ ] **Step 1: 单测 — register 后 suspend 调用 abort，且仍保留 registration**

```js
test('suspend aborts live follow but keeps registration', () => {
  let aborted = 0
  registerCreateFlowSseTask({
    taskId: 101,
    scopeKey: '1:0',
    ownerKind: 'storyboard-script'
  })
  bindLiveFollow(101, '1:0', () => {
    aborted++
  })
  assert.equal(isLiveCreateFlowSseFollow(101, '1:0'), true)
  suspendAllCreateFlowSseFollows('navigation')
  assert.equal(aborted, 1)
  assert.equal(isLiveCreateFlowSseFollow(101, '1:0'), false)
  assert.equal(
    listRegistrationsForResume({
      scopeKey: '1:0',
      step: 'storyboard-script'
    }).some((e) => e.taskId === 101),
    true
  )
})
```

- [ ] **Step 2: 单测 — 其它 scope 的 registration 不被 list 进当前 resume**

```js
test('resume list is scope-isolated', () => {
  registerCreateFlowSseTask({
    taskId: 201,
    scopeKey: '1:1',
    ownerKind: 'storyboard-script'
  })
  assert.equal(
    listRegistrationsForResume({
      scopeKey: '1:0',
      step: 'storyboard-script'
    }).length,
    0
  )
})
```

- [ ] **Step 3: 实现 coordinator，跑通测试**

- [ ] **Step 4: 导出类型与函数；禁止在业务里再新建平行 Map 当真相源（旧 Map 仅过渡）**

---

### Task 3: 壳层 Navigation 接入（P0）

**Files:**
- Create: `composables/useCreateFlowSseNavigation.ts`
- Modify: `components/create/CreateFlowShell.vue`（约 path/scope watch、`suspendAllTaskSseFollows` 处）
- Modify: `composables/useCreateFlowShellLiveGenBootstrap.ts`
- Modify: `composables/useCreateFlowLiveGenResume.ts`（合并或委托，消除「写了未用」）

**Interfaces:**
- Consumes: `suspendAllCreateFlowSseFollows`, `dispatchCreateFlowScopeChanged` / coordinator resume 广播
- Produces: `useCreateFlowSseNavigation({ route }): { scheduleResume: () => void }`

行为：

```text
path 变或 scopeKey 变（sync）
  → suspendAllCreateFlowSseFollows('navigation'|'scope-change')
  → 仍可调用现有 suspendAllTaskSseFollows() 作为过渡双写，直到 owner 全迁完
  → debounce 48–64ms 后：hydrate 当前 scope（沿用现有）+ dispatchCreateFlowScopeChanged 或 coordinator.resume 钩子
```

- [ ] **Step 1: 实现 `useCreateFlowSseNavigation`，在 CreateFlowShell 替换/包裹现有两处 watch**

- [ ] **Step 2: Bootstrap 中：非 `storyboard-script` 页禁止 `restoreOngoingGenerationIfNeeded` 建连；仅允许恢复 Pinia loading 标志**

```ts
// 伪代码约束（实现时对照现有文件改）
const onStoryboardScriptPage = routePathToCreationStep(route.path) === 'storyboard-script'
if (onStoryboardScriptPage && hasPersistedStoryboardScriptWork) {
  await storyboardScriptGen.restoreOngoingGenerationIfNeeded(...)
}
// 非脚本页：不要调用 restoreOngoingGenerationIfNeeded
```

- [ ] **Step 3: 手工冒烟**

1. 任意页刷新：Network 不应出现非当前步骤的 `/task/stream`  
2. 切步骤：已有 SSE 断开且无 error toast  

- [ ] **Step 4: 确认 `CREATE_FLOW_SCOPE_CHANGED_EVENT` 在纯 path 变化后也会派发（或等价 resume 调用）**

---

### Task 4: 第三步接入 + 假 closer 修复（P1）

**Files:**
- Modify: `components/steps/SceneCharacterProp.vue`（`startTrackTask` / `restoreAndTrackOngoingTasks` / `clearActiveTaskStream` / unmount）
- 尽量把「假存活清理」抽到小 util，避免继续膨胀巨石文件（若单次改动过大，仅改边界函数）

**关键修复（必须）：**

1. `isLive` 以 coordinator 为准；`activeTaskStreamClosers.has` **不能**单独阻止 restore  
2. stale follow `finally` 若自身 closer 已死，必须 `clearActiveTaskStream`，不能假定「新 follow 已接管」却留下死 closer  
3. `bindLiveFollow` 在 `useTaskStream` 创建后调用；`clearLiveFollow` 在真正 close 后调用  
4. `registerCreateFlowSseTask` 在提交/restore 发现进行中任务时调用  
5. 纯切步骤：不要用会毁掉 resume 元数据的硬清空；scope 切换才清页内内存态  

- [ ] **Step 1: 改 `startTrackTask` 入口**

```ts
// 替换早退逻辑意图
if (isLiveCreateFlowSseFollow(payload.taskId, creationStore.step3GenVisualScopeKey())) {
  return
}
// 若 Map 有 closer 但 !isLive → clear 后再连
```

- [ ] **Step 2: 改 `restoreAndTrackOngoingTasks`：去掉「closer.has → continue」的假跳过，改为 isLive**

- [ ] **Step 3: 良性 abort / navigation 路径禁止 `message.error`**

- [ ] **Step 4: 手工验收 N1/N3/N4（第三步）**

生成中切到分镜脚本再切回；切第 2 集再切回第 1 集；确认有新 `/task/stream`、无中断 toast、集间不串 loading。

---

### Task 5: 分镜脚本 + 分镜图 batch（P2）

**Files:**
- Modify: `composables/useStoryboardScriptBatchGenerate.ts`
- Modify: `composables/useStoryboardImageBatchGenerate.ts`
- Modify: `components/steps/StoryboardScript.vue`（`cancelResumeFollow` / restore / toast 过滤）
- Modify: `utils/storyboardImageBatchRestoreGate.ts` — `following` 语义改为真实 isLive（或调用方传入 isLive）

**规则：**

- `cancelResumeFollow` = suspend：close + 清假 `followInFlight`（或 resume 时若 `!isLive` 无视 inFlight）  
- register/bind 脚本与图 batch taskId  
- `已切换作品…` / `任务仍在后台执行…` 不得 `message.error`  
- 单例：脚本已 singleton；图 batch 若双实例，统一经 coordinator 单槽，避免壳/页双跟  

- [ ] **Step 1: Script batch 接 register/bind/suspend/resume**

- [ ] **Step 2: Image batch 接同上；修复 restore 入口 `if (batchSseFollowInFlight || ...) return` 在 abort 后的假忙**

- [ ] **Step 3: 手工验收脚本页与分镜图批量 N1/N2/N3**

---

### Task 6: 分镜视频 batch（P3）

**Files:**
- Modify: `composables/useStoryboardVideoBatchGenerate.ts`
- Modify: `components/steps/StoryboardVideo.vue`（toast 过滤、`cancelResumeFollow`）

- [ ] **Step 1: 对齐 Task 5 的 register/bind/isLive/silent 模式**

- [ ] **Step 2: 过滤 `message.error(result.message)` 对 scope 切换文案**

- [ ] **Step 3: 手工验收视频页 N1/N3**

---

### Task 7: 配音步骤 + 配音弹窗（P4）

**Files:**
- Modify: `components/steps/Dubbing.vue`
- Modify: `components/steps/EditStoryboardDubbingModal.vue`
- Modify: `composables/useStoryboardAudioBatchGenerate.ts`（若存在）及相关 compose follow
- Modify: `stores/creation.ts` 仅当需要把配音 taskId/SSE 字段写入 scope 桶时（最小改动）

**规则（spec §4.3）：**

1. 仅 `dubbing` 步骤允许配音 SSE / 续跟  
2. 过渡期 compose：离开暂停、回来续跟、scope 隔离；**禁止**与未来 SSE 双跟同一 loading  
3. 对口型改 SSE 时：直接 `ownerKind: 'modal-storyboard-dubbing'` + `register`/`bind`，不要另起调度  
4. Pinia：保留 `composeBatchId` 过渡；SSE 落地后以 `taskId` 登记  

- [ ] **Step 1: 为配音 follow 增加与 coordinator 一致的 suspend/resume 钩子（compose 或 SSE）**

- [ ] **Step 2: `EditStoryboardDubbingModal` 打开/scope-changed 走 resume；关闭或切步 suspend**

- [ ] **Step 3: 预留对口型 SSE 接入点（同一 `waitUserTaskSseTerminal` + register），避免二次架构  

- [ ] **Step 4: 手工验收 N8**

---

### Task 8: 其余编辑弹窗 / 外层静默跟（P5）

**Files:**
- Modify: `components/steps/EditSceneImageModal.vue`
- Modify: `components/steps/EditStoryboardImageModal.vue`
- Modify: `components/steps/EditStoryboardVideoModal.vue`
- Modify: 相关 `hasModalFollowLock` / `utils/modalSseFollowReconnectPolicy.ts` / `utils/liveGenScopeIsolation.ts`

**规则：**

- suspend 时释放或标记可抢占 `hasModalFollowLock`  
- 步骤页可见时：即使弹窗未开，也应对 modal 登记的进行中 task 静默 follow（或 outer restore 强制跟）  
- 不自动弹开弹窗  

- [ ] **Step 1: Scene modal 接 coordinator + 修 lock 泄漏**

- [ ] **Step 2: Storyboard image/video modal 同上**

- [ ] **Step 3: 手工：弹窗生成中切步再回，外层 loading 续跟且有 stream**

---

### Task 9: 收敛闸门 + 单测补全 + 回归矩阵（P6）

**Files:**
- Modify: 各 restore gate；删除重复 benign 白名单（保留一处）  
- Modify: `utils/taskSsePageCoordinator.test.mjs` 补齐 isLive / listResume / silent 矩阵  
- 可选短注释更新：`components/steps/SSE跨步骤任务管理排查报告.md` 顶部加「已被 2026-07-24 spec 取代实现方向」（仅一句，不写长文）

- [ ] **Step 1: 全量 `node --test utils/taskSsePageCoordinator.test.mjs`**

- [ ] **Step 2: 手工跑 spec §6.1 N1–N8**

失败即不合格：

- 导航场景 error toast 含 `Task SSE aborted` / `任务连接中断`  
- 返回后 ≥3s 仍无 stream 且服务端进行中  
- 作品/剧集 loading 串台  

- [ ] **Step 3: 确认无双跟、无非当前页 SSE 常驻**

---

## Spec coverage checklist

| Spec 要求 | Task |
|-----------|------|
| 统一 coordinator + policy | 1–2 |
| 壳层 suspend→resume；纯切步也恢复 | 3 |
| 假 closer / 假 inFlight 治本 | 4–6 |
| 静默导航断连 | 1, 3–8 |
| 作品+剧集隔离 | 2 listResume + 各 owner |
| 只连当前页；壳层不越权脚本 SSE | 3 |
| 配音/对口型纳入 | 7 |
| 其它弹窗外层续跟 | 8 |
| 验收矩阵 N1–N8 | 4–9 |

## 执行说明

按 Task 1 → 9 顺序；每 Task 结束后做该 Task 列出的冒烟，再进入下一 Task。高风险 SSE 区禁止与无关 UI 重构混在同一改动集。
