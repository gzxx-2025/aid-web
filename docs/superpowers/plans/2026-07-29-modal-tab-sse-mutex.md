# 弹窗 Tab SSE 互斥与素材准备并发上限 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 弹窗顶部 Tab 严格 1 路 SSE 互斥；素材准备外层最多 6 路排队；切回已终态 Tab 必清 loading。

**Architecture:** 纯规则进 `utils/step3SseConcurrencyGate.ts` 与 `utils/modalTabSseMutex.ts`（可单测）；各 Edit*Modal 的 `switchScene` / restore 与 `SceneCharacterProp.startTrackTask` 薄接入。业务结算仍走现有 finalize。

**Tech Stack:** Nuxt 3 / Vue 3 / TypeScript；`node:test` + `*.test.mjs`

## Global Constraints

- 行为：suspend 不断服务端任务；tab-pause / preempt 禁止失败 toast
- 场景弹窗占槽计入 `MAX_STEP3_SSE=6`；分镜三类弹窗只做本弹窗 ≤1，不进 step3 gate
- 切回 restore 必须先 `task/detail` 终态探测
- 最小 diff；禁止巨石文件整段粘贴；规则 ≥3 处复用必须抽 utils
- 规范：`docs/2026-07-22-frontend-development-standards.md`、safe-remediation

## File map

| File | Role |
|------|------|
| `utils/step3SseConcurrencyGate.ts` | max=6 占槽/排队/释放/preempt；`resetForTest` |
| `utils/step3SseConcurrencyGate.test.mjs` | P0 单测 |
| `utils/modalTabSseMutex.ts` | 应 suspend 的 follows；是否允许建连；restore 动作决策 |
| `utils/modalTabSseMutex.test.mjs` | P1 单测 |
| `components/steps/SceneCharacterProp.vue` | `startTrackTask` 接入 gate |
| `components/steps/EditSceneImageModal.vue` | 互斥 + gate + 终态 |
| `components/steps/EditStoryboardImageModal.vue` | 互斥 + 终态 |
| `components/steps/EditStoryboardVideoModal.vue` | 互斥 + 终态 |
| `components/steps/EditStoryboardDubbingModal.vue` | 对口型互斥 + 轮询暂停 |

---

### Task 1: step3SseConcurrencyGate（TDD）

**Files:**
- Create: `utils/step3SseConcurrencyGate.ts`
- Create: `utils/step3SseConcurrencyGate.test.mjs`

- [ ] 写失败单测：满 6 入队；release 后 drain；modal preempt 最老 outer；同 taskId 幂等
- [ ] 实现 gate（纯决策 + 运行时单例）
- [ ] `node --test utils/step3SseConcurrencyGate.test.mjs` 全绿

### Task 2: 接入 SceneCharacterProp.startTrackTask

**Files:**
- Modify: `components/steps/SceneCharacterProp.vue`

- [ ] 连 SSE 前 `tryAcquireStep3SseSlot`；排队则保留 loading 不连
- [ ] finally / suspend / 终态 `releaseStep3SseSlot` + `drainStep3SseQueue`（回调触发 startTrackTask）
- [ ] 切 Tab `pauseStep3SseForInactiveTabs` 释放对应槽
- [ ] 手动验证逻辑：同文件内无双连占坑回退

### Task 3: modalTabSseMutex（TDD）

**Files:**
- Create: `utils/modalTabSseMutex.ts`
- Create: `utils/modalTabSseMutex.test.mjs`

- [ ] 单测：非当前 tabKey 全部应 suspend；当前允许建连；终态 → settle；进行中 → reconnect
- [ ] 实现纯函数
- [ ] 测试全绿

### Task 4: EditSceneImageModal 互斥

**Files:**
- Modify: `components/steps/EditSceneImageModal.vue`

- [ ] `switchScene`：suspend 非当前 editorScope 的 SSE + release gate
- [ ] `restoreSceneModalSseIfNeeded`：终态探测优先；进行中走 gate（modal owner）
- [ ] 开窗 preempt outer

### Task 5: 分镜图 / 视频弹窗互斥

**Files:**
- Modify: `EditStoryboardImageModal.vue`、`EditStoryboardVideoModal.vue`

- [ ] 切 Tab suspend 非当前 storyboardId；仅当前 restore
- [ ] restore 先终态；不走 step3 gate

### Task 6: 配音弹窗

**Files:**
- Modify: `EditStoryboardDubbingModal.vue`

- [ ] 对口型 SSE 互斥；compose 轮询切 Tab 暂停/切回续跟
- [ ] restore 终态清 loading

### Task 7: 验收

- [ ] 相关 `*.test.mjs` 全绿
- [ ] 对照 spec §6 清单自检（M1–M3、O1–O3、N1–N2）
- [ ] 更新 spec 状态为已确认/实现中

---

## 执行说明

按 Task 1→7 顺序；每任务 TDD；不提交除非用户要求。
