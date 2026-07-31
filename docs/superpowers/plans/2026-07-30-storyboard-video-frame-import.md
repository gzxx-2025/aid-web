# 选择分镜画面 · 视频帧导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `SelectAssetImageModal`（`reference` / `multiParamReference`）增加「视频帧」Tab：截取当前作品/剧集分镜原视频帧，OSS 上传后可勾选导入为参考图/首尾帧。

**Architecture:** 纯规则进 `utils/`（收集视频、截帧命名、localStorage scope）；新建 `SelectAssetVideoFrameTab` + `CaptureVideoFrameModal`；`SelectAssetImageModal` 仅薄接入 Tab，禁止继续膨胀巨石模板。本期无服务端帧列表接口，持久化走 localStorage，接口就绪后只换 store 层。

**Tech Stack:** Nuxt 3 / Vue 3 / TypeScript / Ant Design Vue；`node:test` + `*.test.mjs`；`oss/upload` via `utils/ossUpload.ts`

## Global Constraints

- Spec：`docs/superpowers/specs/2026-07-30-storyboard-video-frame-import-design.md`
- 规范：`docs/2026-07-22-frontend-development-standards.md`、`docs/2026-07-22-existing-code-safe-remediation.md`
- Tab 仅 `type === 'reference' || type === 'multiParamReference'`（本期实际覆盖编辑分镜视频弹窗；编辑分镜图不扩 type）
- 视频源：分镜原视频 only（`i2v` / `multi` / `edge` / `upload_video`）；排除 `compose` 与对口型合成轨
- 剧集：`episodeId > 0` 用当前集；否则用当前项目
- 截帧弹窗布局 A：顶栏视频条 + 溢出左右箭头 + 中预览 + 底时间轴/首尾帧
- 截帧确认：`oss/upload` → 本地列表；不自动勾选；勾选逻辑复用父弹窗
- `SelectAssetImageModal.vue` 禁止整段粘贴截帧 UI；只加 Tab 与子组件挂载
- 弹窗 `wrap-class-name` 含 `create-flow-modal`；样式用 `--home-*` / `--create-surface-*` / `--accent-*`
- 最小 diff；不顺手大重构

## File map

| File | Role |
|------|------|
| `utils/videoFrameScope.ts` | scope key / storage key |
| `utils/videoFrameScope.test.mjs` | scope 单测 |
| `utils/videoFrameName.ts` | 展示命名 |
| `utils/videoFrameName.test.mjs` | 命名单测 |
| `utils/collectProjectStoryboardVideos.ts` | 收集分镜原视频 |
| `utils/collectProjectStoryboardVideos.test.mjs` | 过滤单测 |
| `utils/videoFrameLocalStore.ts` | localStorage CRUD |
| `utils/videoFrameLocalStore.test.mjs` | 隔离单测 |
| `utils/videoFrameCapture.ts` | canvas 截帧 → File |
| `components/steps/CaptureVideoFrameModal.vue` | 截帧子弹窗 |
| `components/steps/SelectAssetVideoFrameTab.vue` | Tab：新增按钮 + 帧图网格 |
| `components/steps/SelectAssetImageModal.vue` | 薄接入 videoFrame Tab |

---

### Task 1: scope + 命名（TDD）

**Files:**
- Create: `utils/videoFrameScope.ts`
- Create: `utils/videoFrameScope.test.mjs`
- Create: `utils/videoFrameName.ts`
- Create: `utils/videoFrameName.test.mjs`

**Interfaces:**
- Produces:
  - `videoFrameScopeKey(projectId: number, episodeId?: number | null): string`
  - `videoFrameStorageKey(scopeKey: string): string` → `aid:video-frames:v1:${scopeKey}`
  - `formatVideoFrameName(sourceLabel: string, capturedAtMs: number, at: Date): string`

- [ ] **Step 1: 写失败单测**

```js
// utils/videoFrameScope.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { videoFrameScopeKey, videoFrameStorageKey } from './videoFrameScope.ts'

test('剧集用 projectId:episodeId', () => {
  assert.equal(videoFrameScopeKey(12, 3), '12:3')
})

test('电影/无 episode 只用 projectId', () => {
  assert.equal(videoFrameScopeKey(12, null), '12')
  assert.equal(videoFrameScopeKey(12, 0), '12')
  assert.equal(videoFrameScopeKey(12, undefined), '12')
})

test('storage key 带版本前缀', () => {
  assert.equal(videoFrameStorageKey('12:3'), 'aid:video-frames:v1:12:3')
})
```

```js
// utils/videoFrameName.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { formatVideoFrameName } from './videoFrameName.ts'

test('命名含分镜标题、时间点、时间戳', () => {
  const at = new Date(2026, 6, 30, 10, 15, 0) // 本地 2026-07-30 10:15
  assert.equal(
    formatVideoFrameName('分镜02', 0, at),
    '分镜02-视频帧[00.000]-202607301015'
  )
  assert.equal(
    formatVideoFrameName('分镜01', 3240, at),
    '分镜01-视频帧[03.240]-202607301015'
  )
})
```

- [ ] **Step 2: 跑测确认失败**

Run: `node --test utils/videoFrameScope.test.mjs utils/videoFrameName.test.mjs`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 最小实现**

命名时间点规则（锁定）：`floor(ms/1000)` 两位 + `.` + `ms%1000` 三位  
- `0` → `00.000`；`3240` → `03.240`

```ts
// utils/videoFrameScope.ts
export function videoFrameScopeKey(
  projectId: number,
  episodeId?: number | null
): string {
  const pid = Number(projectId)
  const eid = Number(episodeId)
  if (Number.isFinite(eid) && eid > 0) return `${pid}:${eid}`
  return String(pid)
}

export function videoFrameStorageKey(scopeKey: string): string {
  return `aid:video-frames:v1:${scopeKey}`
}
```

```ts
// utils/videoFrameName.ts
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

/** capturedAtMs：视频内时间点（毫秒）；at：命名用墙钟时间 */
export function formatVideoFrameName(
  sourceLabel: string,
  capturedAtMs: number,
  at: Date = new Date()
): string {
  const label = String(sourceLabel || '分镜').trim() || '分镜'
  const ms = Math.max(0, Math.floor(Number(capturedAtMs) || 0))
  const timePart = `${pad2(Math.floor(ms / 1000))}.${pad3(ms % 1000)}`
  const stamp =
    `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}` +
    `${pad2(at.getHours())}${pad2(at.getMinutes())}`
  return `${label}-视频帧[${timePart}]-${stamp}`
}
```

- [ ] **Step 4: 跑测全绿**

Run: `node --test utils/videoFrameScope.test.mjs utils/videoFrameName.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**（若用户要求逐步提交；否则本任务可与后续 utils 一并提交）

```bash
git add utils/videoFrameScope.ts utils/videoFrameScope.test.mjs utils/videoFrameName.ts utils/videoFrameName.test.mjs
git commit -m "feat: add video frame scope and naming helpers"
```

---

### Task 2: 收集分镜原视频（TDD）

**Files:**
- Create: `utils/collectProjectStoryboardVideos.ts`
- Create: `utils/collectProjectStoryboardVideos.test.mjs`

**Interfaces:**
- Consumes: `isComposeStoryboardVideoRecord` / `isOriginalStoryboardVideoRecord` from `utils/storyboardRecordRow.ts`
- Produces:

```ts
export type StoryboardVideoPick = {
  id: string
  url: string
  label: string
  panelId?: string
  poster?: string
}

export function collectOriginalStoryboardVideosFromPanels(
  panels: Array<{
    id?: string
    title?: string
    videos?: Array<{
      id?: string
      url?: string
      title?: string
      isStoryboardVideo?: boolean
      _serverRow?: { genType?: string | null } | null
      genType?: string | null
    }> | null
  }> | null | undefined
): StoryboardVideoPick[]
```

- [ ] **Step 1: 写失败单测**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { collectOriginalStoryboardVideosFromPanels } from './collectProjectStoryboardVideos.ts'

test('只收集原视频，排除 compose，跳过无 url', () => {
  const list = collectOriginalStoryboardVideosFromPanels([
    {
      id: 'p1',
      title: '分镜01',
      videos: [
        { id: 'v1', url: 'https://a/1.mp4', _serverRow: { genType: 'i2v' } },
        { id: 'v2', url: 'https://a/2.mp4', _serverRow: { genType: 'compose' } },
        { id: 'v3', url: '', _serverRow: { genType: 'multi' } },
        { id: 'v4', url: 'https://a/4.mp4', genType: 'edge' }
      ]
    }
  ])
  assert.deepEqual(
    list.map((x) => x.id),
    ['v1', 'v4']
  )
  assert.equal(list[0].label, '分镜01')
})

test('无 panels 返回空数组', () => {
  assert.deepEqual(collectOriginalStoryboardVideosFromPanels(null), [])
})
```

- [ ] **Step 2: 跑测 FAIL → 实现 → PASS**

实现要点：
- `url` trim 非空才收录
- 若存在 `_serverRow.genType` 或顶层 `genType`：compose 排除；若能判定 original（`isOriginalStoryboardVideoRecord`）则收录；**无 genType 时默认收录**（兼容本地仅有 url 的旧数据）
- `label`：`panel.title` trim 或 `分镜${index+1}`
- `id`：优先 video.id，否则 `${panelId}-${index}-${url}`

- [ ] **Step 3: Commit**（可选）

```bash
git add utils/collectProjectStoryboardVideos.ts utils/collectProjectStoryboardVideos.test.mjs
git commit -m "feat: collect original storyboard videos for frame capture"
```

---

### Task 3: localStore（TDD）

**Files:**
- Create: `utils/videoFrameLocalStore.ts`
- Create: `utils/videoFrameLocalStore.test.mjs`

**Interfaces:**
- Consumes: `videoFrameScopeKey`, `videoFrameStorageKey`
- Produces:

```ts
export type VideoFrameLocalItem = {
  id: string
  url: string
  thumbnail?: string
  name: string
  projectId: number
  episodeId?: number | null
  sourceVideoId?: string
  sourceLabel?: string
  capturedAtMs?: number
  createdAt: string
}

export function listVideoFrames(projectId: number, episodeId?: number | null): VideoFrameLocalItem[]
export function appendVideoFrame(
  projectId: number,
  episodeId: number | null | undefined,
  item: Omit<VideoFrameLocalItem, 'projectId' | 'episodeId' | 'createdAt'> & {
    createdAt?: string
  }
): VideoFrameLocalItem
export function clearVideoFramesForTest(): void // 或 inject storage
```

测试用可注入 `Storage`（内存 Map 实现），避免依赖真实 localStorage。

- [ ] **Step 1: 写单测** — 同 scope 追加可读；不同 episode 不串；坏 JSON 返回 `[]`

- [ ] **Step 2: 实现 + 全绿**

- [ ] **Step 3: Commit**（可选）

```bash
git add utils/videoFrameLocalStore.ts utils/videoFrameLocalStore.test.mjs
git commit -m "feat: localStorage store for captured video frames"
```

---

### Task 4: canvas 截帧工具

**Files:**
- Create: `utils/videoFrameCapture.ts`

**Interfaces:**
- Produces:

```ts
/** 从已 seek 到目标时间的 HTMLVideoElement 截一帧为 PNG File */
export async function captureVideoElementFrame(
  video: HTMLVideoElement,
  fileName: string
): Promise<File>
```

- [ ] **Step 1: 实现**

```ts
export async function captureVideoElementFrame(
  video: HTMLVideoElement,
  fileName: string
): Promise<File> {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new Error('视频尚未就绪')
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.drawImage(video, 0, 0, w, h)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('截帧失败'))),
      'image/png'
    )
  })
  const name = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  return new File([blob], name, { type: 'image/png' })
}
```

说明：跨域污染时 `toBlob`/`toDataURL` 会抛错，由调用方 toast「截帧失败，请稍后重试」。DOM API 不做 node:test；逻辑保持极薄。

- [ ] **Step 2: Commit**（可选）

---

### Task 5: CaptureVideoFrameModal

**Files:**
- Create: `components/steps/CaptureVideoFrameModal.vue`

**Interfaces:**
- Consumes: `collectOriginalStoryboardVideosFromPanels`, `captureVideoElementFrame`, `formatVideoFrameName`, `uploadImageToOssWithToast`
- Props: `open`, `projectId`, `episodeId`
- Emits: `update:open`, `captured`（payload: `{ url, name, sourceVideoId?, sourceLabel?, capturedAtMs }`)

- [ ] **Step 1: 搭建弹窗壳**

- `a-modal`：`wrap-class-name="create-flow-modal capture-video-frame-modal-wrap"`，`footer=null`，自绘页脚
- 标题「截取视频帧」
- 打开时从 `useCreationStore().formData.storyboardVideo.panels` 收集视频

- [ ] **Step 2: 布局 A UI**

1. **顶栏**：左右箭头按钮 + 横向滚动视频缩略条  
   - `overflow` 检测：`scrollWidth > clientWidth` 时显示箭头；`scrollLeft===0` 隐藏左；滚到尽头隐藏右  
   - 点击箭头：`scrollBy({ left: ±(clientWidth * 0.8), behavior: 'smooth' })`
2. **中区**：`<video :src="selected.url" ref="videoRef" controls 或自定义播放>` 大预览  
   - 无视频：居中 Logo（`~/assets/img/home/logo-new.svg` 或 `emptyImageIconUrl`）+「暂无视频」
3. **底区**：播放按钮（可选）+ range/胶片条 scrubber +「首帧」「尾帧」+ 当前时间文案  
4. **页脚**：取消 / 确认截帧（无视频或上传中禁用）

- [ ] **Step 3: 确认截帧流程**

```ts
async function onConfirm() {
  if (confirming.value || !videoRef.value || !selected.value) return
  confirming.value = true
  try {
    const video = videoRef.value
    const tMs = Math.floor((video.currentTime || 0) * 1000)
    const name = formatVideoFrameName(selected.value.label, tMs, new Date())
    // 确保 paused 且 currentTime 已稳定；必要时 await seeked
    const file = await captureVideoElementFrame(video, name)
    const url = await uploadImageToOssWithToast(file)
    if (!url) return
    emit('captured', {
      url,
      name,
      sourceVideoId: selected.value.id,
      sourceLabel: selected.value.label,
      capturedAtMs: tMs
    })
    emit('update:open', false)
  } catch {
    message.error('截帧失败，请稍后重试')
  } finally {
    confirming.value = false
  }
}
```

- [ ] **Step 4: 关闭清理** — `open=false` 时 pause video、清空 src，避免后台播放

- [ ] **Step 5: 手工冒烟** — 有视频/无视频/溢出箭头（可用临时入口或 Story 页；实现后在 Task 7 联调）

---

### Task 6: SelectAssetVideoFrameTab

**Files:**
- Create: `components/steps/SelectAssetVideoFrameTab.vue`

**Interfaces:**
- Props: `open`（父 Tab 激活时 true）、`projectId`、`episodeId`、`selectedKeys`（或由父传 `isSelected(item)`）
- Emits: `toggle`（item）、`frames-change`（可选，父可直接 list）
- 内部挂载 `CaptureVideoFrameModal`

- [ ] **Step 1: 网格 UI**

- 与父网格卡片同尺寸 class（复用/对齐 `.saim-card` 尺寸变量，或接受 `cardClass`）
- 首格：虚线框 +「+ 新增视频帧」按钮
- 其后：`listVideoFrames(projectId, episodeId)` 的图片卡片（`ShimmerImage` + 选中勾）
- 点击卡片 `emit('toggle', mappedItem)`，mappedItem 形状与父 `toggleSelect` 兼容：

```ts
{
  id: item.id,
  url: item.url,
  thumbnail: item.thumbnail || item.url,
  title: item.name,
  name: item.name,
  importDate: item.createdAt,
  source: '视频帧',
  kind: 'image'
}
```

- [ ] **Step 2: 截帧回调**

```ts
function onCaptured(payload) {
  appendVideoFrame(projectId, episodeId, {
    id: `vf-${Date.now()}`,
    url: payload.url,
    thumbnail: payload.url,
    name: payload.name,
    sourceVideoId: payload.sourceVideoId,
    sourceLabel: payload.sourceLabel,
    capturedAtMs: payload.capturedAtMs
  })
  // 刷新 list；不自动勾选
}
```

- [ ] **Step 3: 打开 Tab / 切 scope 时 reload 列表**

---

### Task 7: 薄接入 SelectAssetImageModal

**Files:**
- Modify: `components/steps/SelectAssetImageModal.vue`

**关键改动点（保持最小）：**

1. `showVideoFrameTab` computed：

```ts
const showVideoFrameTab = computed(
  () => props.type === 'reference' || props.type === 'multiParamReference'
)
```

2. `tabOptions` 增加：`if (showVideoFrameTab.value) tabs.videoFrame = '视频帧'`

3. `activeTab` 类型扩为 `'current' | 'step' | 'voice' | 'videoFrame'`；`setActiveTab` 允许 `videoFrame`

4. 模板：`v-else-if="activeTab === 'videoFrame'"` 分支渲染：

```vue
<div v-else-if="activeTab === 'videoFrame'" class="saim-body-shell saim-body-shell--video-frame">
  <SelectAssetVideoFrameTab
    :open="modalOpen && activeTab === 'videoFrame'"
    :project-id="Number(props.projectId) || Number(creationStore.currentProjectId) || 0"
    :episode-id="Number(props.episodeId) || Number(creationStore.currentEpisodeId) || 0"
    :is-selected="isSelected"
    @toggle="toggleSelect"
  />
</div>
```

5. `watch(activeTab)`：有 `showVoiceTab` 时不清空；**增加**有 `showVideoFrameTab` 时同样保留已导入素材跨 Tab（与音色一致，避免从视频帧勾选后切走被清空）。若与现网「纯图片清空」冲突：  
   - **锁定行为**：`showVoiceTab || showVideoFrameTab` 时跨 Tab 保留选中；仅纯图片两 Tab 时切换清空。

6. async 组件引入：

```ts
const SelectAssetVideoFrameTab = defineAsyncComponent(
  () => import('./SelectAssetVideoFrameTab.vue')
)
```

7. **禁止**在本文件新增截帧 canvas / 大段样式（>50 行 scoped 需外移 shared 或子组件）

- [ ] **Step 1: 接入并确认 Tab 仅 reference / multiParamReference 出现**
- [ ] **Step 2: 确认 scene/character/prop 类型无「视频帧」**

---

### Task 8: 联调验收 + 单测汇总

- [ ] Run: `node --test utils/videoFrameScope.test.mjs utils/videoFrameName.test.mjs utils/collectProjectStoryboardVideos.test.mjs utils/videoFrameLocalStore.test.mjs`  
  Expected: 全绿

- [ ] 手工对照 spec §7.2：
  1. 编辑分镜视频 → 导入参考图 / 首尾帧 → 有「视频帧」Tab
  2. 编辑分镜图 → 场景/角色/道具选择 → **无**该 Tab
  3. 无视频空态
  4. 多视频溢出左右箭头
  5. 截帧 → 上传 → Tab 列表出现 → 勾选 → 已导入 → 外层确定可用
  6. 切作品/剧集不串
  7. 刷新后列表仍在（同浏览器）

- [ ] 更新 spec 状态为：`已确认（用户 2026-07-30 审阅通过）`

---

## Spec coverage checklist

| Spec 要求 | Task |
|-----------|------|
| 视频帧 Tab | 7 |
| 新增按钮 + 帧图列表 | 6 |
| 截帧弹窗布局 A + 箭头 | 5 |
| oss/upload | 5 |
| 本地持久 + scope | 1, 3 |
| 仅原视频 | 2 |
| 命名 | 1 |
| 不自动勾选 | 6 |
| 空态 | 5 |
| 薄接入不膨胀 | 7 |
| 单测 | 1–3, 8 |

## 执行说明

按 Task 1→8 顺序；utils 必须 TDD；UI 任务以手工验收为主。不推远程除非用户要求。
