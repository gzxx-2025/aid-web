# 选择分镜画面 · 视频帧导入设计

> 日期：2026-07-30  
> 状态：已确认（用户 2026-07-30 审阅通过）  
> 实现计划：`docs/superpowers/plans/2026-07-30-storyboard-video-frame-import.md`  
> 关联：`components/steps/SelectAssetImageModal.vue`、编辑分镜图/分镜视频弹窗中的导入参考图与首尾帧选择  
> 规范：`docs/2026-07-22-frontend-development-standards.md`、`docs/2026-07-22-existing-code-safe-remediation.md`

---

## 1. 问题与目标

### 1.1 目标

在编辑分镜图弹窗、编辑分镜视频弹窗中，打开「导入参考图 / 首尾帧」所用的选择弹窗（`SelectAssetImageModal`，标题如「选择分镜画面」）时：

1. Tab 栏增加 **「视频帧」**
2. 切换到该 Tab 后，列表首格为与图片卡片同尺寸的 **「新增视频帧」** 按钮；其后展示已截取并上传过的帧图
3. 点击「新增视频帧」打开截帧子弹窗：展示当前作品（或当前剧集）已生成的**分镜原视频**，可 scrub 选帧；确认后 `oss/upload`，回到外层 Tab 列表展示
4. 勾选帧图进入「已导入素材」的逻辑与现有 Tab 一致；外层「确定」走现有 `confirm` 回调

### 1.2 非目标（本期不做）

| 项 | 原因 |
|----|------|
| 服务端视频帧 create/list 专用接口 | 接口未就绪；本期本地持久，接口就绪后替换 store 层 |
| 配音视频 / 对口型视频作为截帧源 | 已确认只要分镜原视频 |
| 在场景/角色/道具等其它 `SelectAssetImageModal` type 上展示视频帧 Tab | 仅 `reference` / `multiParamReference` |
| 截帧弹窗布局复刻参考图二 | 已确认采用布局 A（顶栏视频条）并加溢出左右箭头 |
| 编辑分镜图弹窗默认覆盖 | 见 §1.3；按决策 C 本期不自动扩展到 scene/character/prop |

### 1.3 入口覆盖说明（实现前需知晓）

用户原始诉求包含「编辑分镜图弹窗」。代码现状：

- **编辑分镜视频**：`SelectAssetImageModal` 已使用 `reference` / `multiParamReference` → 本期直接覆盖
- **编辑分镜图**：`SelectAssetImageModal` 仅用于场景/角色/道具等（`scene` / `character` / `prop` / …）→ **按已确认决策 C，本期不出现视频帧 Tab**

若审阅时要求分镜图也要有，可选后续增量（不在本期默认同做）：

1. 将分镜图某导入入口改为 `reference`，或  
2. 为分镜图单独增加 `enableVideoFrameTab` 开关并允许在指定 type 下展示

---

## 2. 已确认决策

| 项 | 决策 |
|----|------|
| 实现路径 | **方案 1**：平行新建小模块 + `SelectAssetImageModal` 薄接入 |
| Tab 出现范围 | 仅 `type === 'reference' \|\| type === 'multiParamReference'` |
| 实际入口（现状） | 编辑分镜视频弹窗的导入参考图 / 首尾帧 / 多参参考图已用上述 type；**编辑分镜图弹窗当前只用 scene/character/prop 等 type，按本决策不会出现视频帧 Tab**（若需覆盖分镜图，须另扩 type 或改入口，见 §1.3） |
| Tab 内容 | 首格「新增视频帧」按钮 + 已上传帧图；视频列表不在 Tab 内 |
| 截帧确认后 | 立即 `oss/upload` → 写入本地列表 → Tab 展示；**不**自动勾选 |
| 勾选 / 已导入素材 | 与现网一致；外层再点「确定」才真正导入 |
| 视频范围 | 剧集：当前集；电影/无有效 episode：当前项目全部 |
| 视频类型 | 仅分镜原视频（排除 compose / 对口型等合成轨） |
| 截帧弹窗布局 | **A**：顶栏横向视频条 + 中大预览 + 底时间轴/首尾帧 |
| 视频条溢出 | 左右两侧出现切换按钮；未溢出隐藏；点击平滑滚出下一批 |
| 空态 | 「暂无视频」+ 项目 Logo / 空态图标（沿用 `emptyImageIcon` / 品牌 logo 约定） |
| 持久化 | 本期：`oss/upload` + `localStorage` 按 scope 隔离；预留换服务端接口 |

---

## 3. 架构与文件边界

| 文件 | 职责 |
|------|------|
| `components/steps/SelectAssetImageModal.vue` | 薄接入：Tab「视频帧」、挂载子组件；勾选/确认复用现有 |
| `components/steps/SelectAssetVideoFrameTab.vue` | Tab UI：新增按钮 + 帧图网格 |
| `components/steps/CaptureVideoFrameModal.vue` | 截帧子弹窗（布局 A + 溢出左右箭头） |
| `utils/videoFrameCapture.ts` | `<video>` + `canvas` 截帧 → `Blob`/`File`；命名 |
| `utils/videoFrameLocalStore.ts` | 本地读写；scope 隔离；日后可换 API 实现 |
| `utils/collectProjectStoryboardVideos.ts` | 从 creation store 收集分镜原视频列表 |
| 对应 `*.test.mjs` | scope、过滤、命名、localStore |

**约束**

- `SelectAssetImageModal` 已超 800 行红线：禁止整段粘贴截帧 UI/逻辑；只加 Tab 开关与子组件挂载
- 创作弹窗 `wrap-class-name` 含 `create-flow-modal`
- 样式优先 `--home-*` / `--create-surface-*` / `--accent-*`

```text
SelectAssetImageModal
  ├─ Tab: current / step / [voice?] / videoFrame
  └─ activeTab === 'videoFrame'
        └─ SelectAssetVideoFrameTab
              ├─ [新增视频帧] → CaptureVideoFrameModal
              └─ 本地帧图卡片 → toggleSelect（复用父级选中）
```

---

## 4. 交互与数据流

```text
打开 SelectAssetImageModal（reference / multiParamReference）
  → Tab「视频帧」
      → 网格：[新增视频帧] + videoFrameLocalStore.list(scope)
      → 点「新增视频帧」→ CaptureVideoFrameModal
            · 收集当前集/项目分镜原视频
            · 无视频：暂无视频 + Logo
            · 选视频 → 时间轴 / 首帧 / 尾帧 →「确认截帧」
            · canvas 截帧 → oss/upload → append localStore
            · 关闭子弹窗；Tab 列表追加（默认不勾选）
      → 用户勾选帧图 → 「已导入素材」
      → 外层「确定」→ 现有 confirm(items)
```

**其它行为**

- 切换 Tab 清空「已导入素材」：保持现网 `watch(activeTab)` 行为
- 上传失败：toast，不写入列表
- 切作品/剧集：按 scope 读列表，互不串数据
- 「选择本地文件 / 资产库导入」脚部按钮在视频帧 Tab 下行为：与现网其它图片 Tab 一致（仍可选本地/资产库进已导入素材）；不强制隐藏

---

## 5. 数据模型

### 5.1 本地截帧项

```ts
interface VideoFrameLocalItem {
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
```

### 5.2 Scope

| 场景 | key |
|------|-----|
| 剧集且 `episodeId > 0` | `` `${projectId}:${episodeId}` `` |
| 电影 / 无有效 episode | `` `${projectId}` `` |

存储键建议：`aid:video-frames:v1:${scopeKey}`（实现时可微调，保持可测）。

### 5.3 展示命名

`{分镜标题}-视频帧[{ss.mmm}]-{yyyyMMddHHmm}`

其中 `ss.mmm` = `floor(capturedAtMs/1000)` 两位 + `.` + `capturedAtMs%1000` 三位。

示例：`分镜02-视频帧[00.000]-202607301015`；`3240ms` → `分镜01-视频帧[03.240]-…`

### 5.4 视频收集

- 数据源：`creationStore.formData.storyboardVideo.panels`
- 遍历 `panel.videos`，保留有可播放 `url` 的**分镜原视频**
- 排除：`genType=compose`、对口型等合成轨（复用/对齐 `storyboardVideoCover` / `isComposeStoryboardVideoRecord` 判定）
- 标签：优先 panel 标题（如「分镜01」）

### 5.5 截帧弹窗状态

- `videos[]`、`selectedVideoId`、`currentTime`、`duration`
- 顶栏横向滚动：`canScrollLeft` / `canScrollRight` 控制箭头显隐
- 确认中 loading，防止重复提交

---

## 6. 错误与边界

| 场景 | 处理 |
|------|------|
| 无原视频 | 空态文案 + Logo，禁用确认 |
| 视频跨域导致 canvas 污染 | toast 明确失败；不写入列表 |
| OSS 上传失败 | toast；不写入列表 |
| localStorage 满/解析失败 | 降级为空列表 + 可选 console warn；不阻断打开弹窗 |
| 切换 Tab | 清空已导入选中（现网） |
| 父弹窗关闭 | 关闭截帧子弹窗；清理 video 元素 |

---

## 7. 测试与验收

### 7.1 单测

- scope key：剧集 vs 电影
- 原视频过滤：不含 compose
- 命名格式
- localStore 读写与按 scope 隔离

### 7.2 手工验收

1. 编辑分镜视频 → 导入参考图 / 首尾帧 → 出现「视频帧」Tab
2. 编辑分镜图 → 导入参考图（`reference`/`multiParamReference` 入口）→ 出现该 Tab；场景/角色/道具选择弹窗不出现
3. 无视频：空态正确
4. 有多个视频：顶栏溢出出现左右箭头，可滚到后续视频
5. 截帧确认后上传成功，Tab 列表出现帧图；勾选进已导入；外层确定后可作为参考图/首尾帧使用
6. 切作品或剧集后列表不串
7. 刷新后本地列表仍可恢复（同浏览器）

---

## 8. 后续（接口就绪时）

将 `videoFrameLocalStore` 的读写替换为服务端 create/list（保持 `VideoFrameLocalItem` 或映射层稳定），UI 与截帧流程不变。
