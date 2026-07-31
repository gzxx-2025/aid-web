# AID Web — AI 漫剧 · AI 电影 · AI 漫画用户创作端

<h2 align="center">🌐 官方入口</h2>
<p align="center">
  <a href="https://www.aidstudio.com.cn/"><strong>官方运营站：https://www.aidstudio.com.cn/</strong></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://gzxxaitdb.feishu.cn/docx/LZ5zdesEgo1z4Mxc7OWc7zTHnJc"><strong>📘 部署与使用教程</strong></a><br>
  在线体验 AID，并查看部署、配置与使用说明。
</p>

AID Web 是 AID 开源内容创作平台的用户端工作台，基于 Nuxt 3、Vue 3、TypeScript 与 Pinia 构建。它以项目为中心组织剧本、分集、角色、道具、场景、分镜、图片、视频、配音和成片，让创作者在一条连续工作流中使用多家 AI 模型，而不必在不同模型平台之间反复复制内容和整理素材。

## 三大创作方向

### AI 漫剧

面向连载化、分集化和角色驱动的动态内容生产，覆盖故事与分集剧本、角色/道具/场景资产、分镜图、图生视频、角色配音、TTS 音频和成片预览，适合竖屏漫剧、AI 短剧、漫改视频及连续更新的 IP 内容。

### AI 电影

面向强调叙事结构、镜头语言和视觉统一的影像创作，支持电影化分镜、景别与构图、视觉风格控制、多镜头视频、对白配音和成片素材管理，适合 AI 短片、概念预告片、品牌故事片与电影化剧情内容。

### AI 漫画

面向以连续静态画面承载故事的创作，支持角色形象与参考图、道具与场景、分镜脚本、分镜图和连续画面管理，适合条漫、页漫、故事漫画、绘本、广告分镜和 IP 角色内容。

## 官方资产包

服务端同版本发布页提供 `aid-official-assets_<版本>.tar.gz`，包含平台初始化展示和创作示例所需的角色、场景、道具、光影、景别/焦距、姿态、表情、特效、分镜示例、图标、语音头像、MP3 试听、首页图片及演示视频。

资产包只收录 `aid_init` 初始化库引用的官方文件，不包含用户生成内容、账号、密钥或日志。包内保留 `files/aid/...` 原始对象键，可导入本地存储、阿里云 OSS 或腾讯云 COS。请从 [aid-server GitHub Releases](https://github.com/gzxx-2025/aid-server/releases) 下载与程序版本一致的资产包；[Gitee Releases](https://gitee.com/gzxx-2025/aid-server/releases) 提供对应版本入口，完整导入命令见包内 `README.md`。

## 技术栈

- **框架**: Nuxt 3
- **视图层**: Vue 3 (Composition API)
- **语言**: TypeScript
- **状态管理**: Pinia
- **路由**: Nuxt 文件系统路由
- **代码规范**: Prettier + ESLint

## 开发规范

### 目录结构

```
├── assets/          # 静态资源
│   └── css/         # 全局样式（见下方「全局样式与主题」）
├── components/      # 组件 (原子设计模式)
│   ├── atoms/       # 原子组件
│   ├── molecules/   # 分子组件
│   └── organisms/   # 组织组件
├── composables/     # 组合式函数
├── middleware/      # 路由中间件
├── pages/           # 页面路由
├── plugins/         # Nuxt 插件
├── stores/          # Pinia 状态管理
└── types/           # TypeScript 类型定义
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 类型检查
npm run typecheck

# 代码格式化
npm run format

# 代码检查
npm run lint
```

## 开发指南

### 路由系统

使用 Nuxt 3 文件系统路由，在 `pages/` 目录下创建文件即可自动生成路由：
- `pages/index.vue` → `/`
- `pages/about.vue` → `/about`
- `pages/user/[id].vue` → `/user/:id` (动态路由)
- `pages/user/index.vue` → `/user`

### 状态管理

使用 Pinia 进行状态管理，Store 文件放在 `stores/` 目录下。

### 全局样式与主题（深蓝 + 青色）

全站视觉与首页（案例广场）对齐，便于一处修改、全局生效：

| 文件 | 作用 |
|------|------|
| `assets/css/main.css` | 基础重置、Ant Design 覆盖、通用工具类、浅色 `body` 默认样式 |
| `assets/css/home-theme.css` | **全局主题变量** `--home-*` 及关于/用户/资产库（旧壳）等；**不含**新旧首页主内容区 |
| `assets/css/home-legacy-page.css` | **旧版首页**（`/index-legacy`）：根节点 **`class="home-legacy-page"`** |
| `assets/css/home-new-page.css` | **新版首页与子页**（`/`、`/works`、`/assets` 在 `home-new` 布局内）：**`home-new-index`** / **`home-new-sub-page`** |
| `assets/css/case-detail-page.css` | **案例详情页**（`/case/:id`）：全屏深色布局、视频区与右侧信息栏 |
| `assets/css/create-steps-ant-overrides.css` | **创作流程页**（`html.app-shell-create`）：重置青色系 Ant 覆盖；在此作用域内将 **`--gray-100` / `--gray-200` 重映射**为低饱和蓝灰描边（避免弹窗里仍用全局浅灰 `#e9ecef` 像「白线」）；并定义 **`--create-surface-*` / `--create-border-dashed`** 供步骤组件统一表面分层与虚线占位；弹窗内容区、蒙层、Drawer、下拉等使用略抬亮的 Navy 底而非纯黑。**注意**：步骤内卡片/列表的 **hover、选中态勿用全局 `--primary-50`**（浅色），应使用 **`--accent-*` 半透明 + `--home-text` / `--home-muted`**，否则会出现白底浅字不可读（已改 `StoryboardGenerateModal`、`AgentDropdown`、`ModelSelectDropdown`、提取/选择智能体相关弹窗等） |
| `assets/css/glass-effects.css` | **可选**玻璃态动效增强层（磨砂、高光、微动效）。**关闭方式**：在 `nuxt.config.ts` 的 `css` 数组中注释掉 `'~/assets/css/glass-effects.css'` 后重启即可，不改任何 Vue 组件。覆盖侧栏、Hero 轮播、搜索/筛选、卡片、用户菜单、创作流程顶栏等。 |
| `assets/css/shimmer-image.css` | **图片流光加载占位** 动效样式，配合 `components/common/ShimmerImage.vue` 全站复用 |
| `assets/css/viewport-compact-scale-overrides.css` | **低分辨率视口缩放**（769px–1440px 宽时根节点 `zoom: 0.75`）。**关闭方式**：（1）页面右下角「界面缩放」开关（偏好存 `localStorage`）；（2）环境变量 `NUXT_PUBLIC_VIEWPORT_COMPACT_SCALE=0` 全局关闭；（3）`nuxt.config.ts` → `runtimeConfig.public.viewportCompactScale: false`。逻辑见 `utils/viewportCompactScale.ts`、`plugins/viewport-compact-scale.client.ts`。 |


**改主色 / 圆角 / 边框**：优先编辑 `home-theme.css` 顶部 `:root` 中的 `--home-*` 变量。

**创作页 `/create` 报错 `VResizeObserver` / `vueuc` 命名导出**：`nuxt.config.ts` 中已通过 `resolve.alias` 指向 `vueuc/es/index.js`，并设置 `vite.ssr.noExternal` 包含 `vueuc`、`naive-ui`、`webcut`。若仍异常，删除 `node_modules/.cache/vite` 与 `.nuxt` 后重新执行 `npm run dev`。

**创作流程弹窗仍为浅色**：仅全局 CSS 不够——Vue **scoped** 样式（如 `background: white`）会带 `data-v-*`，优先级高于外层。处理方式：（1）所有 `a-modal` 增加 **`wrap-class-name="create-flow-modal"`**（可与原有 wrap 类名并列）；（2）`create-steps-ant-overrides.css` 内对 `html.app-shell-create` 下的 Modal 蒙层、内容区、内部 Tabs/Tree/Segmented 等做强覆盖；（3）各弹窗及子组件（如 `ImportAssetList`）内浅色背景已改为深色 `rgba`。**弹窗内文字**：同一文件内用 `!important` 将 `.ant-modal-body` 下多数元素设为浅色，并保留主按钮白字、链接青色、占位符/辅助灰字、错误红字等例外；Drawer 同理。

**布局约定**：

- `layouts/home.vue`：`definePageMeta({ layout: 'home' })`，宽侧栏（180px）+ 主内容区；`html` 会带 `layout-home-shell`，与 `main.css` 中深色 `body` 规则配合。
- `layouts/home-new.vue`：新版首页专用，窄侧栏（80px）+ 主内容区；`html` 类名含 `layout-home-new`。
- 登录：`definePageMeta({ layout: false })`，`useHead` 设置 `html` 类名 `app-shell-login`。
- 创作流程：`definePageMeta({ layout: false })`，`useHead` 设置 `app-shell-create`。
- `layouts/default.vue`：浅色顶栏布局，当前业务页已统一走 `home`，保留作备用。

### 页面说明

| 路由 | 文件 | 布局 | 说明 |
|------|------|------|------|
| `/` | `pages/index.vue` | `home-new` | **新版首页**：左侧 80px 窄栏（`logo-new` / `al-new` / `work-new` / `zc-new`），顶部 16:9 视频区 + 可切换动效的居中轮播，下方为案例广场列表（逻辑与旧版一致）；登录后「我要创作」弹出创建第一步弹窗。点击案例卡片进入案例详情页。 |
| `/index-legacy` | `pages/index-legacy.vue` | `home` | **旧版首页**（保留）：宽侧栏 + Banner Hero，案例广场列表同上。点击案例卡片进入案例详情页。 |
| `/case/:id` | `pages/case/[id].vue` | 无 | **案例详情**：全屏深色页，左侧 16:9 视频播放区 + 左上角返回（`icon-return.svg`），右侧展示用户、片名、类型、剧情介绍与故事主角；数据来自 `POST /api/public/project/detail`。 |
| `/works` | `pages/works.vue` | `home-new` | 我的作品列表，在新版首页右侧主区域切换展示（与案例广场同布局、同路由过渡动画）。 |
| `/assets` | `pages/assets.vue` | `home-new` | 资产库，同上。 |
| `/login` | `pages/login.vue` | 无 | 全屏登录/注册，深蓝青主题表单；首屏调用 `POST /auth/public-config` 缓存验证码/发码策略；开启行为验证码时使用 `static/tac`（tianai-captcha）滑块：短信/邮箱登录在「获取验证码」前校验，账号密码登录在提交前校验，token 通过请求头 `captcha-token` 传给 `/auth/sendCode`、`/auth/login`。 |
| `/create` | `pages/create/index.vue` | 无 | 创作流程全屏，工具栏与左右栏已换深色主题变量；流程页从「剧本创作」开始，不再展示第一步（第一步改为首页弹窗）。 |
| `/create/story-script` 等 | `pages/create/*.vue` | 无 | 各步骤子路由；第二步剧本创作见下方「剧本创作与接口」。 |
| `/about` | `pages/about.vue` | `home` | 关于我们，使用 `home-theme-static` 内容块样式。 |
| `/user`、`/user/:id` | `pages/user/*.vue` | `home` | 用户列表与详情，同上。 |

### 创作流程七步

顶部流程条与各页说明文案统一维护于 `utils/createFlowStepMeta.ts`：

1. **项目配置**（`global-setting`）— 作品类型、画幅、剧本类型与模型策略  
2. **剧本创作**（`story-script`）— 撰写或导入剧本内容
3. **素材准备**（`scene-character`）— 提取并完善场景、角色、道具  
4. **分镜设计**（`storyboard-script`）— 规划镜头脚本与分镜画面  
5. **视频生成**（`storyboard-video`）— 将分镜转为动态视频  
6. **音画同步**（`dubbing`）— 添加配音并实现音画对口  
7. **成品预览**（`preview`）— 预览成片、导出/发布  

### 成品导出与发布（第七步）

- **顶栏「导出/发布」下拉**（`components/create/CreateFlowShell.vue`）含三项：
  - **导出完整视频**：调用合成接口（`/api/user/episode/export` + `export/status` 轮询），成功后**不再弹窗**，自动调用保存至本地接口（`/api/user/episode/export/download`）把成片下载到本地。
  - **导出分段素材**：逻辑不变。
  - **发布至案例广场**：四接口**严格顺序**链路，任一步失败即终止 —— ① 弹出封面/描述弹窗（`PublishCasePlazaModal`）并调用更新项目接口（`/api/user/project/update`）→ ② 合成完整视频（同导出接口）→ ③ 提交审核 / 重新提交审核（`/api/user/project/submit-audit` 或剧集 `episode/submit-audit`）→ ④ 发布（`/api/user/project/publish`）。
- **「我的作品」卡片右下角发布按钮**（`components/home/WorksLibraryPanel.vue`）：悬停展示「发布至案例广场」tooltip；点击不再走列表内发布/审核，而是跳转到作品当前进行到的流程步骤并携带 `publishGuide=1`——已完成则落到成品预览并呼吸灯高亮「导出/发布」按钮；未完成则落到所在步骤，高亮主操作按钮并提示「请先完成作品」。

### 剧本创作与接口（第二步）

- **拉取**：进入 `/create/story-script` 且具备 `projectId`、剧集 `episodeId`（电影为 `0`）时，`useCreateFlowRouteAndSteps` 内调用 `userScriptDetailByProject`（`/api/user/script/detailByProject`），正文写入 `formData.storyScript.content`；接口若返回 HTML，`utils/htmlPlain.ts` 中 `scriptApiTextToEditorHtml` 会识别标签并原样交给富文本编辑器。
- **下一步**：`handleNextStep` 开头执行 `persistCurrentStepBeforeNext`；当前路由步骤为 `story-script` 时先调 `userScriptSave`（`/api/user/script/save`），成功后再走步骤状态推进或仅前端路由跳转；可与后续其它步骤的「先落库再下一步」扩展在同一函数内分支实现。
- **静默保存**：`StoryScript.vue` 使用 `useStoryScriptAutoSave(localContent)`：内容每次变化会重置 30 秒定时器，静止满 30 秒后若当前 HTML（`trim` 后）与 `creationStore.scriptServerHtmlBaseline` 不一致则调用 `userScriptAutoSave`（`/api/user/script/autoSave`）；一致则不请求。保存成功后基线优先用接口返回的 `originalText`，与后端规范化结果对齐。
- **上下文**：`utils/storyScriptSaveContext.ts` 的 `resolveStoryScriptSaveContext` 与上述接口共用同一套 `projectId` / `episodeId` 规则（剧集需有效集 ID；缺 `projectType` 时会 `userProjectDetail` 补全）。

### 登录页行为验证码（v2.58）

- **公开配置**：`composables/useAuthPublicConfig.ts` → `POST /auth/public-config`，结果写入 `sessionStorage`（`auth:public-config:v1`）；其中 `crypto.enabled` 与 `crypto.publicKey` 控制全站信封加密（见下节）。

### 接口信封加密（v2.59）

- **开关**：`POST /auth/public-config` 返回的 `crypto.enabled === true` 时，对 `/api/**`、`/auth/**`、`/recharge/**`、`/realAuth/**`、`/captcha/**`（除文档豁免路径）自动 AES-GCM + RSA-OAEP 加解密；`false` 时与旧版明文一致。
- **实现**：`utils/apiCrypto.ts`（WebCrypto + `pako` 解压响应 GZIP）；`utils/api.ts` axios 拦截器；应用启动 `plugins/api-crypto-bootstrap.client.ts` 拉取并缓存配置。
- **豁免**：`/auth/public-config`、`/captcha/gen`、`/api/user/oss/**`、`/api/user/task/stream/**`、微信/支付回调等（与接口文档 exclude-patterns 一致）。
- **行为验证码**：`/captcha/check` 在加密开启时通过包装 TAC `doSendRequest` 走同一套协议。
- **验证码资源**：`static/tac/css/tac.css`、`static/tac/js/tac.min.js`（tianai-captcha web-sdk）；`nuxt.config.ts` 中 `dir.public: 'static'` 将其映射为 **`/tac/**`**（勿写成 `/_nuxt/tac/**`）；登录页 `useTacPageHead()` 通过 `useHead` 引入（路径见 `utils/tacAssets.ts`）。
- **验证码接口**：`POST /captcha/gen`、`POST /captcha/check`（校验成功返回一次性 `token`）。
- **受保护接口**：`authLogin` / `authSendCode` 在 `captcha.enabled=true` 时携带请求头 `captcha-token`；未开启时与旧版一致，可不带头。
- **发码倒计时**：按 `smsPolicy.sendIntervalSeconds` / `emailPolicy.sendIntervalSeconds` 驱动；验证码输入框 `maxlength` 来自对应 `codeLength`。

### 字典与下拉（v2.0）

- 创作流程中的下拉字典统一通过 `composables/usePromptDictionary.ts` 加载。
- 官方参数词库改为只读接口：`/api/user/prompt/official/category/list`、`/api/user/prompt/official/item/list`、`/api/user/prompt/official/item/detail`。
- 枚举字典改为：`/api/user/dict/enum/list`（按枚举类型加载，大小写敏感）。分镜脚本「生成设置 / 自动生成分镜」弹窗的镜头密度使用 `StoryboardShotDensityEnum`（`精简模式` / `标准模式` / `细拆模式`），保存后作为 `/api/user/storyboard/generate/script` 的 `mode` 入参。
- 分镜设计步骤点击「自动生成分镜」：调用 `POST /api/user/storyboard/generate/script`（`agentCode`、`mode`、`overwrite` 来自生成设置；已有分镜时 `overwrite=true`），经 `useTaskStream` 追踪 `storyboard_script` 进度，完成后 `userStoryboardList` 刷新列表。开发环境若 `NUXT_PUBLIC_MOCK_STEP4_PLUS_GEN=1` 仍走本地模拟进度。
- 旧接口 `/api/user/prompt/getData` 已下线，`utils/businessApi.ts` 中仅保留兼容方法，不再直接请求旧地址。
- 联调对照表见：`components/steps/字典联调清单-v2.0.md`。

### 组件开发

- **剧本创作**（`components/steps/StoryScript.vue`）：左侧工具栏「撤销 / 重做 / 复制 / 清空」在输入框有非空内容时，图标颜色为主题青 `#4ae7fd`（禁用态按钮仍保持整体弱化样式）；已接入 30 秒静默保存（见上）。
- **素材准备**（`components/steps/SceneCharacterProp.vue`）：顶部一行左侧为「场景 / 角色 / 道具」药丸 Tab，右侧依次为当前 Tab 的「自动提取」、「批量生成场景/角色/道具图」与「添加」按钮（添加按钮图标为 `assets/img/icon/extract.svg`、`character.svg`、`prop.svg` 随 Tab 切换）；内容区列表仅保留卡片与单项操作；Tab 默认不显示状态图标，仅在自动提取进行中或场景图批量生成中时显示 loading；无列表数据时共用空状态 UI，提示语「点击此按钮，为您智能提取场景/角色/道具」与空状态图标随 `activeTab` 切换；自动生成场景/角色/道具的无图卡片样式已按设计稿更新为「头部标题栏 + 删除按钮 + 中间方形双操作块（自动生成 / 图片导入）」布局；空状态「自动提取」主按钮在鼠标点击后通过 `blurScpAutoExtractButton` 与 CSS `:focus:not(:focus-visible)` 去掉残留聚焦描边，保留 Tab 键盘焦点环。**场景/角色/道具形态图**已接入 `ShimmerImage` 流光加载：图片加载前显示青色流光占位，加载完成后约 0.5s 淡入，避免背景先出现再突然弹出图片。
- **全局任务面板**（`components/steps/GlobalGenerateTaskPopover.vue`）：在创作流程页工具栏「下一步」左侧展示统一“进行中任务”入口（不再仅限第三步）；支持按项目查询 `PROCESSING/PENDING` 任务并列表展示；提供“停止生成”和“重新开始生成”操作图标（`assets/img/icon/icon-stop.svg`、`assets/img/icon/icon-star.svg`），并通过全局事件联动第三步任务追踪。
- **点选改图弹窗**（`components/steps/TouchEditModal.vue`）：在编辑场景图与编辑分镜图中，点击工具栏“点选改图”后打开统一弹窗；支持滚轮缩放、拖拽平移、点击打点与坐标采集、底部标签 loading→名称展示与悬浮放大预览；识别请求按 `{ image, prompt: "(x,y)" }` 提交到后端接口 `POST /api/user/media/touch/edit/point`。

遵循原子设计模式：
- **Atoms**: 最小的 UI 元素（Button、Input）
- **Molecules**: 由多个原子组成（FormField）
- **Organisms**: 复杂的 UI 组件（Header、Sidebar）
