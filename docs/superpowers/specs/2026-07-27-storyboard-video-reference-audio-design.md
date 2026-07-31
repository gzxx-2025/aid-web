# 编辑分镜视频弹窗 · 参考音频 / 音色对接设计

> 日期：2026-07-27  
> 状态：已确认（用户 2026-07-27 审阅通过）  
> 关联：`components/steps/音色相关功能.md`、`components/steps/接口.md`（参考音频模块、模型 capability、image-prompt/resolve、出片接口）  
> 规范：`docs/2026-07-22-frontend-development-standards.md`、`docs/2026-07-22-existing-code-safe-remediation.md`

---

## 1. 问题与目标

### 1.1 目标

在**编辑分镜视频弹窗**内（图生视频 / 多参数生视频 / 宫格生视频 / 首尾帧生视频）：

1. 导入参考图后的图片列表统一使用现有图片加载动效（`ShimmerImage`）
2. 「导入参考图」弹窗（`SelectAssetImageModal`）增加 **音色 Tab**：可选官方音色 + 上传自定义音频
3. 选用后在文本域上方素材条展示（可播放、可删除）；文本域支持 `@音频` 展示与点选切换（**不播放**）
4. 对接解析接口音频字段与出片 `referenceAudioIds`
5. 按模型 `capability` 控制参考音频能力（支持与否、数量、时长、格式）；不支持时禁止切换到该模型

### 1.2 非目标（本期不做）

| 接口 / 能力 | 原因 |
|-------------|------|
| `POST /api/user/reference-audio/list` | 弹窗无「从历史上传库再选」入口，会话内本地状态足够 |
| `POST /api/user/reference-audio/rename` | 无重命名交互 |
| 对口型链路改动 | 文档明确对口型不吃参考音频 |
| 多镜头批量顶层广播 `referenceAudioIds` | 接口约定多镜头时顶层显式 ID 被忽略；本期以单镜头弹窗为主 |

---

## 2. 已确认决策

| 项 | 决策 |
|----|------|
| 实现路径 | 扩展现有模块（方案 1），不新建独立「导入音频」弹窗 |
| 官方音色 | **路径 A**：写入 `@音频N[音频-名称]`，出片走角色绑定隐式 `VOICE_SAMPLE`；**不**调 `reference-audio/upload`（禁止外链，官方 `sampleUrl` 无法登记） |
| 自定义上传 | `oss/upload` → `reference-audio/upload` → 出片传 `referenceAudioIds`（`sourceType=UPLOAD`） |
| 不使用 | `referenceAudioRecordIds`（系统 TTS 配音记录，与本功能无关） |
| 删除音频 | 取消选用 + **调用** `reference-audio/delete`（**仅上传项有 `referenceAudioId` 时**）；图片删除不调该接口 |
| 官方音色删除 | 仅本地移除 + 清除提示词 `@音频`，不调 `delete` |
| 文本域 `@音频` | 只展示；点击弹出列表（图标 + 文案），**不播放** |
| 播放入口 | 文本域上方素材条 + 弹窗「已导入素材」中的音频项 |
| 音频视觉色 | **不使用紫色**；使用创作壳已有青绿 accent（`--accent-*` / `#4ae7fd` 系）区分图片引用 |

---

## 3. 架构与数据流

```text
官方音色（voice-library/list）
  → 选用 → 素材条 + 提示词 @音频N[音频-名称]
  → 出片：隐式 VOICE_SAMPLE（后端按角色绑定解析）
  → 删除：本地移除 + 清 @

自定义上传
  → oss/upload（相对路径）
  → reference-audio/upload → { id, audioUrl, durationMs, audioFormat }
  → 素材条 + 可选 @ + 出片 referenceAudioIds
  → 删除：本地移除 + 清 @ + reference-audio/delete
```

### 3.1 前端数据模型（建议）

```ts
type ReferenceMediaKind = 'image' | 'audio'

/** 素材条 / 已导入素材 统一项（图片与音频可混排） */
interface ReferenceMediaItem {
  kind: ReferenceMediaKind
  /** 展示名 */
  name: string
  /** 图片 URL 或音频可播放 URL */
  url?: string
  /** 上传参考音频 ID；仅自定义上传有值 */
  referenceAudioId?: number
  /** 官方音色 / 上传 标记 */
  audioSource?: 'voice_sample' | 'upload'
  durationMs?: number
  audioFormat?: string
  /** 图片既有字段兼容 */
  id?: string | number
  thumbnail?: string
  title?: string
}
```

缓存 `durationMs` / `audioFormat`：上传登记返回后写入本地，供模型 capability 前置校验置灰/拦截。

---

## 4. UI 设计

### 4.1 导入弹窗（`SelectAssetImageModal`）

- 仅在「导入参考图 / 多参参考」等视频弹窗场景开启 **音色 Tab**（其它选图用途可关）
- Tab 文案：音色
- 音色 Tab 列表风格对齐 `VoiceTimbrePickerModal`（头像、名称、性别/年龄、「选择TA」、头像点击试听）
- 数据：复用 `userVoiceLibraryList`
- 「选择本地文件」：当前为音色 Tab 时走音频上传（`wav`/`mp3`，并以模型 `referenceAudioFormats` 再约束）
- 「已导入素材」：图片用 `ShimmerImage`；音频用 accent 系波形/音色卡片，点击播放；删除规则见 §2

### 4.2 文本域上方素材条

适用：图生 / 多参 / 宫格 / 首尾帧（`StoryboardGeneratePanel` 的 `i2v-reference-strip` 等；可与 `GenerateSourceImagesStrip` 对齐统一）。

- 图片：统一 `ShimmerImage`（替换裸 `<img>`）
- 音频：accent 系卡片；点击播放；播放中图标跟播放态；删除见 §2

### 4.3 文本域 `@` 引用

- 扩展现有 `storyboardPromptAssetRef` / `RichTextEditor` 图片引用能力，增加音频类型
- 占位格式：`@音频N[音频-名称]`（与接口一致）
- 展示：chip 样式用 accent 系（非紫），结构对齐 `@图片`（图标 + 文案）
- 点击：弹出可选音频列表（图标 + 文案），切换引用；**不播放**
- 输入 `@`：候选含已导入图片与音频

### 4.4 视觉 Token

```css
/* 示意：挂在创作壳或组件 scoped 中，禁止引入紫色主题 */
--create-ref-audio-bg: var(--accent-100);
--create-ref-audio-border: var(--accent-400);
--create-ref-audio-text: var(--accent-500);
```

---

## 5. 模型 capability 与校验

来源（弹窗当前）：`POST /api/user/model/listByFunc` → `data[].models[].capability`。

| 字段 | 前端行为 |
|------|----------|
| `supportsReferenceAudio === false` | 隐藏/禁用音色 Tab 与音频上传；已有音频时切换到该模型 → **不切换**，提示「该模型不支持音频文件，请移除后重试」 |
| `maxReferenceAudios` | 超过禁止再加并提示 |
| `referenceAudioMinDurationSeconds` / `Max` | 单段时长校验（用 `durationMs`） |
| `referenceAudioMaxTotalDurationSeconds` | 总时长校验 |
| `referenceAudioFormats` | 格式白名单；不符拒绝选用/上传 |

说明：不支持时其余字段为 `0` / `[]`，无需特判 `null`。  
服务端出片时对显式 `referenceAudioIds` 不可用会阻断；隐式 `VOICE_SAMPLE` 失败则降级。前端应用 `resolve` 的 `unresolvedReferenceAudioIds` 做选用前提示。

---

## 6. 接口对接清单

### 6.1 必须对接

| 接口 | 用途 |
|------|------|
| `POST /api/user/oss/upload` | 自定义音频文件上传，取相对路径 |
| `POST /api/user/reference-audio/upload` | 登记参考音频，拿 `id` |
| `POST /api/user/reference-audio/delete` | 删除上传音频（素材条/已导入删除时，仅 upload 项） |
| `POST /api/user/voice-library/list` | 官方音色列表（已有） |
| `POST /api/user/storyboard/image-prompt/resolve` | 入参增 `referenceAudioIds`；出参用 `audioReferences` / `unresolvedReferenceAudioIds` |
| 出片：`generate/video`、`generate/video/image`、`generate/video/grid`、`generate/video/edge` | 单镜头传 `referenceAudioIds`（上传项）；官方仅靠提示词 |
| `listByFunc` capability | 参考音频能力位 |

### 6.2 本期不对接下方接口

- `reference-audio/list`
- `reference-audio/rename`
- 出片 `referenceAudioRecordIds`（除非另有「选用系统配音记录」需求）

### 6.3 删除副作用注意

`reference-audio/delete` 会解除所有引用该音频的角色绑定（`referenceAudioId` 等清空）。前端删除上传音频后，若页面缓存了角色绑定信息，需按需刷新绑定列表（本弹窗内若未展示绑定详情，可只清本弹窗选用态；跨步骤缓存另评估）。

---

## 7. 模块落点（控体积）

| 职责 | 位置 |
|------|------|
| 格式/数量/时长校验、占位解析映射 | `utils/`（配 `*.test.mjs`） |
| API 封装 | `utils/businessApi.ts` + `types/business-api.ts` |
| 试听播放（单实例、互斥） | 小 composable（可复用音色弹窗播放逻辑） |
| 音色 Tab UI | `SelectAssetImageModal` 内组装；列表样式复用/抽离 `VoiceTimbrePickerModal` 卡片样式，禁止整段粘贴巨石 |
| 素材条图片/音频 | 扩展 `StoryboardGeneratePanel` strip 或统一走 `GenerateSourceImagesStrip`（图片 Shimmer + 音频卡片） |
| `@音频` | 扩展 `utils/storyboardPromptAssetRef.ts` + `RichTextEditor` |
| 出片拼参 | `EditStoryboardVideoModal` / 既有 generate composable 最小改动 |

禁止在已超标 `.vue` 上整段粘贴；优先抽小模块再组装。

---

## 8. 错误与提示文案

| 场景 | 文案 |
|------|------|
| 模型不支持参考音频仍切换 | 该模型不支持音频文件，请移除后重试 |
| 数量超限 | 参考音频数量已达上限 |
| 单段/总时长不符 | 参考音频时长不符合当前模型要求 |
| 格式不符 | 仅支持 xxx 格式（按 `referenceAudioFormats` 拼接） |
| 登记失败 | 使用接口 `msg`（如「格式不支持」「时长超限」「数量超限」） |
| resolve 显式 ID 无效 | 参考音频不可用，请重新选择（可结合 `unresolvedReferenceAudioIds`） |

---

## 9. 验收清单

- [ ] 四类视频模式：素材条图片均有 `ShimmerImage` 加载动效
- [ ] 导入弹窗出现音色 Tab；官方列表风格接近配音音色弹窗
- [ ] 官方音色：选用 → 素材条可播 → 文本域可 `@` → 出片不传 `referenceAudioIds`（靠提示词）
- [ ] 自定义上传：oss → upload 登记 → 素材条可播 → 出片带 `referenceAudioIds`
- [ ] 文本域 `@音频` 点击只出列表不播放
- [ ] 删除上传音频调 `delete`；删除官方音色不调；删图不调
- [ ] `supportsReferenceAudio=false` 时禁上传/禁切模型并提示
- [ ] 数量/时长/格式校验在上传与选用前生效
- [ ] 音频视觉为 accent 青绿系，非紫色
- [ ] 切作品 / 关弹窗时停止试听，无泄漏

---

## 10. 风险与后续

| 风险 | 缓解 |
|------|------|
| 官方 `@音频-名称` 与角色绑定名不一致导致 resolve 进 `unresolvedAudioNames` | 选用时名称尽量对齐角色/形象名；失败时前端提示但不阻断出片（隐式降级） |
| delete 清空角色绑定 | 删除前提示或删除后刷新绑定缓存 |
| 巨石文件继续膨胀 | 强制抽 utils/子组件，单 PR 控制净增 |

后续可选：`reference-audio/list` 做「历史上传再选」；`rename`；多镜头逐镜 `referenceAudioIds`（edge `shots[]`）。
