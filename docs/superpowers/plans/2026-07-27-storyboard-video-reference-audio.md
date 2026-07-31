# 编辑分镜视频弹窗 · 参考音频 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在编辑分镜视频弹窗四类出片模式中接入参考音频（官方音色隐式 `@音频` + 自定义上传 `referenceAudioIds`），统一图片 Shimmer，并按模型 capability 校验。

> 进度（2026-07-27）：Task 1–7 主干已落地；`list`/`rename` 未接；文本域 `@音频` chip + 点选列表已接；手工验收对照 spec §9 待联调。

**Architecture:** 纯规则进 `utils/`（校验、占位、媒体项映射）；API/类型进 `businessApi` + `business-api`；音色 Tab 与播放用小组件/composable 组装进 `SelectAssetImageModal`；素材条扩展支持音视频混排；`@音频` 扩展现有 prompt asset ref；出片拼参最小改动 `EditStoryboardVideoModal` / generate 调用点。不实现 `list`/`rename`。

**Tech Stack:** Nuxt 3 / Vue 3 / TypeScript / Pinia / Ant Design Vue；单测用 `node:test` + `*.test.mjs`。

## Global Constraints

- 官方音色：只写 `@音频N[音频-名称]`，不调 `reference-audio/upload`
- 自定义上传：`oss/upload` → `reference-audio/upload` → 出片 `referenceAudioIds`
- 删除上传音频：本地移除 + `reference-audio/delete`；官方/图片不调 delete
- 文本域 `@音频` 不播放；播放仅在素材条与弹窗已导入列表
- 音频视觉用 `--accent-*` 青绿系，禁止紫色
- 不接 `reference-audio/list`、`rename`；不用 `referenceAudioRecordIds`
- 单文件体量：禁止在已超标巨石上整段粘贴；优先新建小模块再组装
- 提交：仅在用户明确要求时 commit

---

## File Structure

| 文件 | 职责 |
|------|------|
| `types/business-api.ts` | capability 音频字段、reference-audio VO、resolve/出片入参扩展 |
| `utils/businessApi.ts` | `userReferenceAudioUpload` / `userReferenceAudioDelete`；resolve 透传新字段 |
| `utils/referenceAudioCapability.ts` | 从 capability 读音频能力 + 校验规则（可单测） |
| `utils/referenceAudioCapability.test.mjs` | 校验单测 |
| `utils/referenceMediaItem.ts` | `ReferenceMediaItem` 工厂与 `referenceAudioIds` 提取 |
| `utils/storyboardPromptAudioRef.ts` | `@音频N[name]` 解析/HTML/占位（与图片 ref 平行，避免继续膨胀 `storyboardPromptAssetRef.ts`） |
| `utils/storyboardPromptAudioRef.test.mjs` | 音频占位单测 |
| `composables/useReferenceAudioPreview.ts` | 单实例试听（素材条/已导入共用） |
| `components/steps/SelectAssetVoiceTab.vue` | 官方音色列表 UI（VoiceTimbre 风格） |
| `components/steps/SelectAssetImageModal.vue` | 组装音色 Tab、音频上传、已导入音频播放/删除 |
| `components/steps/StoryboardGeneratePanel.vue` | 素材条 Shimmer + 音频卡片 |
| `components/common/RichTextEditor.vue` + prompt utils | `@音频` chip 与点选列表（不播放） |
| `components/steps/EditStoryboardVideoModal.vue` | 状态、模型切换拦截、resolve/出片拼参（薄接入） |

---

### Task 1: 类型 + API + capability 校验（TDD）

**Files:**
- Modify: `types/business-api.ts`
- Modify: `utils/businessApi.ts`
- Create: `utils/referenceAudioCapability.ts`
- Create: `utils/referenceAudioCapability.test.mjs`
- Create: `utils/referenceMediaItem.ts`

**Interfaces:**
- Produces: `UserModelCapability` 音频 6 字段；`ReferenceAudioVO`；`userReferenceAudioUpload` / `Delete`；`validateReferenceAudioAdd(...)`；`collectReferenceAudioIds(items)`

- [x] **Step 1: 写失败单测**（capability 不支持 / 超数量 / 超总时长 / 格式不符）
- [x] **Step 2: 跑测确认失败**
- [x] **Step 3: 实现类型、API、校验与 media item helper**
- [x] **Step 4: 跑测通过**

---

### Task 2: `@音频` 占位工具（TDD）

**Files:**
- Create: `utils/storyboardPromptAudioRef.ts`
- Create: `utils/storyboardPromptAudioRef.test.mjs`

**Interfaces:**
- Produces: `parseApiAudioPlaceholders`、`buildAudioPlaceholder`、`stripAudioPlaceholdersFromPlain`、`insert/replace` helpers；占位形如 `@音频${n}[音频-${name}]`

- [x] **Step 1: 写失败单测**
- [x] **Step 2: 实现并通过**

---

### Task 3: 试听 composable + 音色 Tab 子组件

**Files:**
- Create: `composables/useReferenceAudioPreview.ts`
- Create: `components/steps/SelectAssetVoiceTab.vue`

**Interfaces:**
- Consumes: `userVoiceLibraryList`
- Produces: `play(url, id)` / `stop()`；emit `select` 官方音色项（无 `referenceAudioId`）

- [ ] **Step 1: 实现单实例 Audio 播放/停止，卸载清理**
- [ ] **Step 2: 实现音色列表 UI（accent 边框选中，对齐 VoiceTimbre 卡片）**

---

### Task 4: SelectAssetImageModal 接入音色 Tab + 上传/删除

**Files:**
- Modify: `components/steps/SelectAssetImageModal.vue`
- Props: `enableVoiceTab?: boolean`、`referenceAudioCapability`（或当前模型 capability）

- [ ] **Step 1: Tab「音色」仅 `enableVoiceTab` 时显示；`supportsReferenceAudio=false` 时隐藏**
- [ ] **Step 2: 本地文件在音色 Tab 走 oss→upload；校验失败 toast**
- [ ] **Step 3: 已导入素材区分图片/音频；音频可播；删除 upload 调 delete**
- [ ] **Step 4: confirm 回传图片 + 音频媒体项**

---

### Task 5: 素材条 Shimmer + 音频卡片

**Files:**
- Modify: `components/steps/StoryboardGeneratePanel.vue`（`i2v-reference-strip`）
- 可选扩展: `components/steps/GenerateSourceImagesStrip.vue`

- [ ] **Step 1: 图片改用 `ShimmerImage`**
- [ ] **Step 2: 音频项 accent 卡片 + 播放态 + 删除 emit**
- [ ] **Step 3: 接入 `useReferenceAudioPreview`**

---

### Task 6: RichText `@音频` 展示与点选（不播放）

**Files:**
- Modify: `utils/storyboardPromptAssetRef.ts` 或平行接入 `storyboardPromptAudioRef`
- Modify: `components/common/RichTextEditor.vue`
- Modify: `StoryboardGeneratePanel` prompt assets 组装

- [ ] **Step 1: plain↔html 支持 `@音频N[...]` chip（accent 样式）**
- [ ] **Step 2: 点击弹出音频候选列表（图标+文案），切换引用；无播放**
- [ ] **Step 3: `@` 候选合并音频项**

---

### Task 7: EditStoryboardVideoModal 状态 / 模型拦截 / resolve / 出片

**Files:**
- Modify: `components/steps/EditStoryboardVideoModal.vue`（薄接入，逻辑尽量在 utils/composable）
- Modify: resolve 调用处与四类 generate 请求拼参

- [ ] **Step 1: 维护 `referenceAudios` 状态；confirm 弹窗合并进素材条**
- [ ] **Step 2: 选用官方音色时写入/同步 `@音频` 到 prompt**
- [ ] **Step 3: 模型切换：若已有音频且目标 `supportsReferenceAudio=false` → 不切换 + 文案提示**
- [ ] **Step 4: resolve 传 `referenceAudioIds`；处理 `unresolvedReferenceAudioIds`**
- [ ] **Step 5: 出片单镜头传 `referenceAudioIds`（仅 upload）；不传 `referenceAudioRecordIds`**
- [ ] **Step 6: 关弹窗/切作品 stop 试听**

---

### Task 8: 手工验收对照

对照 spec §9 清单在本地走通四模式关键路径；修缺口。

---

## Spec Coverage Check

| Spec 要求 | Task |
|-----------|------|
| Shimmer 图片列表 | 5 |
| 音色 Tab + 官方列表 | 3, 4 |
| 自定义上传登记 | 1, 4 |
| 素材条播放/删除 | 5, 7 |
| `@音频` 展示不播放 | 2, 6 |
| resolve / 出片 IDs | 1, 7 |
| capability 校验与禁切模型 | 1, 4, 7 |
| 不接 list/rename | Global |
| accent 非紫 | 3, 5, 6 |
