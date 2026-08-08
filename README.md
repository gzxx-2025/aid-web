# AID Web — AI 漫剧 · AI 电影 · AI 漫画用户创作端

<h2 align="center">🌐 官方入口</h2>
<p align="center">
  <a href="https://www.aidstudio.com.cn/"><strong>官方运营站：https://www.aidstudio.com.cn/</strong></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://gzxxaitdb.feishu.cn/docx/LZ5zdesEgo1z4Mxc7OWc7zTHnJc"><strong>📘 部署与使用教程</strong></a><br>
  在线体验 AID，并查看部署、配置与使用说明。
</p>

AID Web 是 AID 开源内容创作平台的用户端工作台，基于 Nuxt 3、Vue 3、TypeScript 与 Pinia 构建。它以项目为中心组织故事、剧本、分集、角色、道具、场景、分镜、图片、视频、配音和成片，让创作者在一条连续工作流中使用多家 AI 模型，不必在不同平台之间反复复制提示词、下载素材和整理生成记录。

## 三大创作方向

### AI 漫剧

面向连载化、分集化和角色驱动的动态内容生产，覆盖故事与分集剧本、角色/道具/场景资产、分镜图、图生视频、角色配音、TTS 音频和成片预览。适合竖屏漫剧、AI 短剧、漫改视频、剧情账号及持续更新的 IP 内容。

### AI 电影

面向强调叙事结构、镜头语言和视觉统一的影像创作，支持电影化分镜、景别与构图、视觉风格控制、多镜头视频、对白配音和成片素材管理。适合 AI 短片、概念预告片、品牌故事片与电影化剧情内容。

### AI 漫画

面向以连续静态画面承载故事的创作，支持角色形象与参考图、道具与场景、分镜脚本、分镜图和连续画面管理。适合条漫、页漫、故事漫画、绘本、广告分镜和 IP 角色内容。

## 创作工作流

```text
项目配置
  ↓
故事与剧本
  ↓
角色 / 道具 / 场景资产
  ↓
分镜脚本与分镜图
  ↓
图片 / 视频生成
  ↓
配音与音画同步
  ↓
成片预览、导出与发布
```

不同作品类型可以复用同一套项目资产、任务记录和模型配置。生成任务由服务端统一排队和计费，Web 端负责展示进度、结果、失败原因与重试入口；角色、道具、场景、官方风格和自定义风格会形成项目级快照，帮助已有作品保持视觉口径稳定。

## 核心体验

- 项目化创作：剧本、分集、资产、分镜、媒体和成片统一归档
- 多模型生成：文本、图片、视频和语音能力由服务端统一路由，页面按模型能力展示可用参数
- 视觉一致性：参考图、角色形象、场景资产和风格快照贯穿生成流程
- 任务可追踪：展示排队、处理中、成功和失败状态，支持停止、重试和结果回收
- 安全认证：账号、短信、邮箱、微信等登录策略由后台配置，接口可按平台开关启用信封加密
- 响应式创作：适配主流桌面分辨率，创作步骤、资产库和作品管理使用统一交互语言

## 仓库矩阵

| 端 | 说明 | Gitee | GitHub |
|----|------|-------|--------|
| aid-server | Java 服务端与统一部署入口 | [gitee](https://gitee.com/gzxx-2025/aid-server) | [github](https://github.com/gzxx-2025/aid-server) |
| aid-admin | 运营管理端 | [gitee](https://gitee.com/gzxx-2025/aid-admin) | [github](https://github.com/gzxx-2025/aid-admin) |
| aid-web | 用户创作端（本仓库） | [gitee](https://gitee.com/gzxx-2025/aid-web) | [github](https://github.com/gzxx-2025/aid-web) |

## 官方资产包

官方资产包 `aid-official-assets_<版本>.tar.gz` 包含平台初始化展示和创作示例所需的角色、场景、道具、光影、景别/焦距、姿态、表情、特效、分镜示例、图标、语音头像、MP3 试听、首页图片及演示视频。

资产包只收录 `aid_init` 初始化库引用的官方文件，不包含用户生成内容、账号、密钥或日志。程序不会在部署或升级时静默下载大体积资源；管理员可通过管理端「项目升级配置 → 官方资源」上传并初始化到本地存储，也可以按 `files/aid/...` 原始对象键导入 OSS/COS。获取入口与校验值由[官方运营站](https://www.aidstudio.com.cn/)和版本公告统一提供。

## 生产部署

AID Web 不需要单独部署。服务端统一安装器会获取三端同版本源码，在服务器上执行 `npm run generate`，校验静态入口后交给 Nginx 托管。Docker 与 systemd 两种方式都由同一个 `aid` 命令管理，完整流程见 [aid-server 部署指南](https://gitee.com/gzxx-2025/aid-server/blob/master/deploy/README.md)。

推荐的一键入口会优先从 Gitee 下载脚本，失败后切换 GitHub：

```bash
cd /root && if command -v curl >/dev/null 2>&1; then curl -fL --retry 3 --connect-timeout 15 -o /root/aid-install.sh https://gitee.com/gzxx-2025/aid-server/raw/master/deploy/aid.sh || curl -fL --retry 3 --connect-timeout 15 -o /root/aid-install.sh https://raw.githubusercontent.com/gzxx-2025/aid-server/master/deploy/aid.sh; elif command -v wget >/dev/null 2>&1; then wget -O /root/aid-install.sh https://gitee.com/gzxx-2025/aid-server/raw/master/deploy/aid.sh || wget -O /root/aid-install.sh https://raw.githubusercontent.com/gzxx-2025/aid-server/master/deploy/aid.sh; else echo '请先安装 curl 或 wget'; exit 1; fi && sudo env AID_REMOTE_BOOTSTRAP=1 AID_RELEASE_CHANNEL=beta bash /root/aid-install.sh install
```

首次部署会先要求确认配置，不确认就不会构建或启动服务。Docker 配置真源是 `/data/aid/config/docker.env`，手动 systemd 部署配置真源是 `/data/aid/aid-deploy.conf`。部署完成后可使用：

```bash
sudo aid default     # 查看用户端、管理端公网/内网地址
sudo aid status      # 检查三端与中间件状态
sudo aid logs        # 查看日志
sudo aid config      # 修改当前配置
sudo aid restart     # 重新加载配置并重启
sudo aid update      # 在线更新
sudo aid progress    # 查看升级或回退实时进度
```

在线更新会按同一标签重新构建服务端、管理端和 Web 端，先备份配置与数据库，再执行增量 SQL、替换程序并进行健康检查。管理端升级页和 `sudo aid progress` 会显示同一份实时进度；任务运行期间会阻止重复提交。

## 本地开发

要求：Node.js 22.13+、npm 10+，并准备可访问的 AID 服务端。

```bash
# 使用锁文件安装可复现依赖
npm ci

# 启动开发服务器
npm run dev

# 类型检查与测试
npm run typecheck
npm test

# 代码检查
npm run lint

# 生成生产静态站点（统一发布流程使用此命令）
npm run generate
```

Nuxt 静态产物位于 `dist/public/`。生产部署必须使用 `npm run generate`，不能用仅适合 Node SSR 运行时的产物替代静态站点。

## 技术栈

| 维度 | 技术 |
|------|------|
| 应用框架 | Nuxt 3 |
| 视图层 | Vue 3 Composition API |
| 语言 | TypeScript |
| 状态管理 | Pinia |
| 路由 | Nuxt 文件系统路由 |
| UI 与样式 | Ant Design Vue + CSS 主题变量 |
| 工程质量 | ESLint + Prettier + Vitest |

## 目录结构

```text
assets/          全局样式、主题和前端资源
components/      通用组件与创作流程组件
composables/     可复用组合式逻辑
layouts/         页面布局
middleware/      路由中间件
pages/           Nuxt 页面路由
plugins/         客户端与应用插件
stores/          Pinia 状态
types/           TypeScript 类型
utils/           API、鉴权、格式化与业务工具
```

## 接口约定

- 用户端业务请求统一访问服务端 `/api/**`、`/auth/**`、`/recharge/**` 等公开接口
- 生产环境由 Nginx 反向代理到 AID 服务端，不在浏览器代码中写死真实后端地址
- 登录 Token、验证码策略、接口加密与文件访问域名均由服务端公开配置驱动
- 生成任务、扣费、模型路由和状态机由服务端统一处理，Web 端不创建平行任务逻辑
- API 响应统一读取 `{ code, msg, data }`，鉴权失效时进入统一登录流程

## 参与贡献

欢迎提交 Issue 与 Pull Request。修改前请先确认对应能力属于 Web 展示、服务端业务还是后台配置，避免在浏览器端复制任务、计费或模型编排逻辑。提交前至少执行 `npm run typecheck`、`npm test` 和 `npm run generate`。

## 开源协议

本项目基于 [MIT License](LICENSE) 开源，版权归光子讯息(杭州)科技有限公司所有。
