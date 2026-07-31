# 剧本有效变更后继续/重新提取 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 剧本相对上次成功提取发生有效变更且已有素材时，在离开剧本页强提示 / 其它入口轻提示，并打开「继续提取 / 重新提取」弹窗走 SSE。

**Architecture:** 纯函数做规范化与有效变更判定；按 `projectId+episodeId` 持久化提取基线与忽略指纹；composable gate 拦截「剧本→素材」导航并驱动弹窗；ExtractAgentModal 双按钮把 `overwrite` 传入现有 `userAssetExtractParallel` SSE 流程。

**Tech Stack:** Nuxt 3 / Vue 3 / Pinia / Ant Design Vue / `node:test`（`utils/*.test.mjs`）

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-script-change-continue-extract-design.md`
- 比对基准 = 上次成功提取快照；条件 = `comicVersion` 升高 **且** 有效内容差异过阈值
- 强提示拦「下一步 + 流程 Tab」离开剧本页；其它入口仅轻提示条
- 取消/关闭按 `changeKey` 持久忽略直到下次新有效变更
- 隔离 key: `projectId + episodeId`（电影 episodeId=0）
- 阈值默认：`MIN_NORMALIZED_LEN=50`，`MIN_DIFF_CHARS=80`，`MIN_DIFF_RATIO=0.02`
- 文案以 spec §10 为准；重新提取 Tooltip 固定文案
- 遵守前端规范与安全整改：最小 diff、逻辑进 utils/composable、不污染巨石文件
- 用户未要求则不 git commit（本会话执行时跳过 plan 内 commit 步骤，除非用户另行要求）

---

## File Structure

| File | Responsibility |
|------|----------------|
| `utils/scriptContentFingerprint.ts` | HTML→纯文本规范化、hash、diff、isMeaningfulScriptChange |
| `utils/scriptContentFingerprint.test.mjs` | 上述纯函数单测 |
| `utils/scriptExtractBaseline.ts` | baseline / ignored 读写（localStorage map，按 project+episode） |
| `utils/scriptExtractBaseline.test.mjs` | 隔离与 ignored 单测 |
| `composables/useScriptChangeExtractGate.ts` | shouldPrompt、强提示 Modal、pendingOpen 标记、轻提示状态 |
| `components/steps/ExtractAgentModal.vue` | `actionMode` + 继续/重新提取按钮 + Tooltip |
| `composables/useCreateFlowExtractAgents.ts` | 接收 overwrite；成功写 baseline |
| `composables/useCreateFlowRouteAndSteps.ts` | 拦截剧本→素材导航 |
| `components/create/CreateFlowShell.vue` / `SceneCharacterProp.vue` | 轻提示条 + 消费 pendingOpen |
| `types/business-api.ts` | `UserAssetExtractParallelRequest.overwrite` 已有；可选补 `extractScope` |

---

### Task 1: 剧本指纹纯函数 + 单测

**Files:**
- Create: `utils/scriptContentFingerprint.ts`
- Create: `utils/scriptContentFingerprint.test.mjs`

**Interfaces:**
- Produces:
  - `MIN_NORMALIZED_LEN`, `MIN_DIFF_CHARS`, `MIN_DIFF_RATIO`
  - `normalizeScriptContent(htmlOrText: string): { text: string; len: number; hash: string }`
  - `approxDiffChars(a: string, b: string): number`
  - `isMeaningfulScriptChange(baseline: { comicVersion: number; normalizedHash: string; normalizedLen: number }, current: { comicVersion: number; normalizedHash: string; normalizedLen: number; text: string }): boolean`
  - `buildScriptChangeKey(comicVersion: number, normalizedHash: string): string`

- [ ] **Step 1: Write failing tests** in `utils/scriptContentFingerprint.test.mjs` covering: HTML strip, short text false, same version false, version up but tiny diff false, version up + enough diff true, buildScriptChangeKey format.

- [ ] **Step 2: Run** `node --test utils/scriptContentFingerprint.test.mjs` — expect FAIL (module missing).

- [ ] **Step 3: Implement** `utils/scriptContentFingerprint.ts` to pass all tests (FNV-1a 32-bit hex hash; diff via `|lenA-lenB| + strip common prefix/suffix leftover lengths`).

- [ ] **Step 4: Re-run tests** — expect PASS.

---

### Task 2: 基线 / 忽略存储 + 隔离单测

**Files:**
- Create: `utils/scriptExtractBaseline.ts`
- Create: `utils/scriptExtractBaseline.test.mjs`

**Interfaces:**
- Consumes: `normalizeScriptContent`, `buildScriptChangeKey` from Task 1
- Produces:
  - `type ScriptExtractBaseline = { projectId: number; episodeId: number; comicVersion: number; normalizedHash: string; normalizedLen: number; savedAt: number }`
  - `getScriptExtractBaseline(projectId, episodeId): ScriptExtractBaseline | null`
  - `setScriptExtractBaseline(baseline: ScriptExtractBaseline): void`
  - `clearScriptExtractBaseline(projectId, episodeId): void`
  - `getIgnoredScriptChangeKey(projectId, episodeId): string | null`
  - `setIgnoredScriptChangeKey(projectId, episodeId, changeKey: string): void`
  - `clearIgnoredScriptChangeKey(projectId, episodeId): void`
  - `shouldPromptScriptChangeExtract(input: { projectId; episodeId; comicVersion; scriptHtml; hasExtractedAssets; isExtracting }): boolean`
  - `recordExtractSuccessBaseline(input: { projectId; episodeId; comicVersion; scriptHtml }): void`
  - `ensureColdStartBaselineIfNeeded(input: { projectId; episodeId; comicVersion; scriptHtml; hasExtractedAssets }): boolean` — returns true if cold-started (caller should NOT prompt)

Storage key prefix: `aid.scriptExtractBaseline.v1` / `aid.scriptExtractIgnored.v1`；值是 `Record<string, ...>`，条目 key = `${projectId}:${episodeId}`。SSR 安全：无 `window` 时 no-op / 返回 null。

- [ ] **Step 1: Write tests** for isolation (A vs B)、ignored suppress、cold start writes baseline and shouldPrompt false、meaningful change true when baseline older.

- [ ] **Step 2: Run tests** — FAIL.

- [ ] **Step 3: Implement storage helpers** with in-memory fallback injectable for tests (`createScriptExtractBaselineStore(storage?: StorageLike)` 导出默认单例 + 可测工厂，避免真 localStorage 污染)。

- [ ] **Step 4: Tests PASS.**

---

### Task 3: ExtractAgentModal 继续/重新提取 UI

**Files:**
- Modify: `components/steps/ExtractAgentModal.vue`
- Modify: `composables/useCreateFlowExtractAgents.ts`（`startExtractAssets` 签名与 parallel payload）
- Modify: `components/create/CreateFlowShell.vue`（若需传 actionMode）

**Interfaces:**
- Produces: prop `actionMode?: 'start' | 'continueOrReextract'`（默认 `'start'`）
- Emit `start` payload 增加 `overwrite?: boolean`（start 模式省略或 false；继续 false；重新 true）

- [ ] **Step 1:** `actionMode==='continueOrReextract'` 时底部改为两个按钮「继续提取」「重新提取」；重新提取包 `a-tooltip`，title=`重新提取会将之前提取的内容删除并重新计费`。
- [ ] **Step 2:** `handleStart(overwrite: boolean)` → emit start 时带上 overwrite。
- [ ] **Step 3:** `startExtractAssets` 读 overwrite，传入 `userAssetExtractParallel({ ..., overwrite })`；仅 `true` 时显式传。
- [ ] **Step 4:** 提取 SSE 成功后调用 `recordExtractSuccessBaseline`（需当前 comicVersion：从 script detail 缓存或重新 detailByProject；若拿不到 version 则用 baseline 内已有+1 的保守策略——优先读 `creationStore` 若已有字段，否则在 loadStoryScript 时把 `comicVersion` 写入 store）。

**Note:** 若 store 尚无 `comicVersion`，本 Task 在 `loadStoryScriptFromApi` / save 成功处写入 `creationStore.scriptComicVersion`（非 persist 或与 formData 同 scope 的 map 均可，但须按作品隔离；推荐与 baseline 一样只在成功提取时用接口返回值，gate 判定前 `userScriptDetailByProject` 读 version）。

---

### Task 4: Gate composable + 导航拦截（强提示）

**Files:**
- Create: `composables/useScriptChangeExtractGate.ts`
- Modify: `composables/useCreateFlowRouteAndSteps.ts`（`handleStepClick`、下一步进素材处）
- Modify: `composables/useCreateFlowExtractAgents.ts` / shell provide

**Interfaces:**
- Produces:
  - `pendingOpenContinueExtractModal: Ref<boolean>`
  - `lightBannerVisible: Ref<boolean>`
  - `evaluateAndConfirmLeaveScriptToPrepare(): Promise<'proceed' | 'cancel'>`
  - `consumePendingOpenExtractModal(): boolean`
  - `dismissLightBanner(): void`
  - `refreshLightBannerOnPreparePage(): Promise<void>`

强提示用 `Modal.confirm`（ant-design-vue），文案见 spec §10。

- [ ] **Step 1:** 在「剧本→素材」两条路径（下一步 save 后跳转前、`handleStepClick` 目标为素材准备且当前在剧本）调用 `evaluateAndConfirmLeaveScriptToPrepare`；cancel 则 return；proceed 且需提取则 `pendingOpen=true`。
- [ ] **Step 2:** 素材页 `step3AssetListSyncReady` 后若 `consumePendingOpenExtractModal()` → `extractModalScope='all'`、`actionMode='continueOrReextract'`、`showExtractAgentModal=true`。
- [ ] **Step 3:** 判定前确保有 `hasExtractedAssets`（复用 `areAllStep3AssetRpsListsEmptyForAutoExtract` 取反或轻量 list）；无基线则 cold start。
- [ ] **Step 4:** 取消时 `setIgnoredScriptChangeKey`。

---

### Task 5: 轻提示条

**Files:**
- Modify: `components/steps/SceneCharacterProp.vue`（顶部一条，尽量少样式）或 shell 内素材步骤槽

- [ ] **Step 1:** `v-if="scriptChangeLightBannerVisible"` 展示文案 +「去提取」+ 关闭。
- [ ] **Step 2:** 去提取 → 打开 continueOrReextract 弹窗；关闭 → dismissLightBanner（写 ignored）。
- [ ] **Step 3:** 进入素材页且非 pendingOpen 消费路径时 `refreshLightBannerOnPreparePage`。

---

### Task 6: 验收与回归

- [ ] Run `node --test utils/scriptContentFingerprint.test.mjs utils/scriptExtractBaseline.test.mjs`
- [ ] 手工对照 spec §9.2（能跑通的路径自测；其余列入手动清单）
- [ ] 确认切作品/切集不串 baseline

---

## Spec coverage check

| Spec 项 | Task |
|---------|------|
| 指纹/阈值/有效变更 | T1 |
| baseline/ignored/cold start/隔离 | T2 |
| 双按钮 + overwrite + 成功写基线 | T3 |
| 强提示导航拦截 | T4 |
| 轻提示条 | T5 |
| 文案 §10 | T3–T5 |
| 单测 + 验收 | T1–T2, T6 |
