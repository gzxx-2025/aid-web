# 配音弹窗对口型改 SSE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编辑分镜配音弹窗在开启对口型时走 `/lipSync` → `taskId` → SSE，支持配音阶段试听；普通配音仍走 compose 轮询。

**Architecture:** 纯解析进 `utils/storyboardLipSyncSse.ts`；follow 用 `waitUserTaskSseTerminal`；进度字段扩 `taskSseProgressText`；弹窗只接 `taskId` 持久化与试听 UI。

**Tech Stack:** Nuxt 3 / Vue 3 / TypeScript / Pinia / `node --test`（`*.test.mjs`）

**Spec:** `docs/superpowers/specs/2026-07-27-storyboard-lip-sync-sse-design.md`

## Global Constraints

- 仅 `lipSync=true` 改 SSE；`lipSync=false` 零行为变更
- `taskId` ≠ `audioRecordId`，禁止混存冒充
- 禁止 SSE + audio 轮询双跟
- `.vue` / composable 体量：优先抽 `utils/storyboardLipSyncSse.ts`，不整段粘贴进弹窗
- 不顺手大重构；不主动 git commit（除非用户要求）

---

### Task 1: SSE progress 字段 + lipSync 解析纯函数

**Files:**
- Modify: `utils/taskSseProgressText.ts`
- Create: `utils/storyboardLipSyncSse.ts`
- Test: `utils/taskSseProgressText.lipSync.test.mjs`, `utils/storyboardLipSyncSse.test.mjs`

- [x] 解析 progress 保留 `audioRecordId` / `audioUrl` / `durationMs` / `storyboardId`
- [x] `parseLipSyncCompleteItem` 从 complete data 取 `lipSyncVideoUrl` / `lipSyncVideoRecordId` / `audioRecordId`

### Task 2: 类型与 businessApi

**Files:**
- Modify: `types/business-api.ts`, `utils/businessApi.ts`

- [x] `/lipSync` 返回 `StoryboardLipSyncBatchAcceptVO`（或别名）
- [x] batch/single item 类型补 `audioUrl` / `durationMs` 等

### Task 3: generate follow 改 SSE

**Files:**
- Modify: `composables/useStoryboardDubbingGenerate.ts`
- Create: `composables/useStoryboardLipSyncTask.ts`
- Create: `utils/storyboardLipSyncSse.ts`

- [x] submit 返回 `{ mode:'lipSync', taskId }`
- [x] follow 用 `waitUserTaskSseTerminal`；progress 透出试听字段；error 充值；benign 静默

### Task 4: restore / session / store

**Files:**
- Modify: `utils/modalGenTaskRestore.ts`, `utils/storyboardDubbingModalGenSession.ts`, `stores/creation.ts`, `composables/useStoryboardDubbingBackgroundRestore.ts`

- [x] lipSync 以 `taskId` 判定进行中
- [x] 可单独持久化 `audioRecordId`（无 composeBatchId）

### Task 5: 弹窗试听 UI

**Files:**
- Modify: `components/steps/EditStoryboardDubbingModal.vue`

- [x] onSubmitted/onProgress 存 `taskId` + 可选试听 URL
- [x] loading 区展示试听按钮（复用已有 Audio 播放）

### Task 6: 验证

- [x] `node --test utils/taskSseProgressText.lipSync.test.mjs utils/storyboardLipSyncSse.test.mjs`（8/8 pass）
- [ ] 对照 spec §8 手工验收（需联调后端）
