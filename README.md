# AID Web — AID 平台用户创作端

<p>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/Nuxt-3.x-00DC82.svg" alt="Nuxt">
  <img src="https://img.shields.io/badge/Vue-3.x-42b883.svg" alt="Vue">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6.svg" alt="TypeScript">
</p>

AID 开源 AI 漫画·漫剧·视频创作平台的用户创作端：项目、剧本、角色/道具/场景、分镜、图片生成、视频生成与配音的一站式 AI 创作工作流。

## 仓库矩阵

| 端 | 说明 | Gitee | GitHub |
|----|------|-------|--------|
| aid-server | Java 服务端（统一发布入口） | [gitee](https://gitee.com/gzxx-2025/aid-server) | [github](https://github.com/gzxx-2025/aid-server) |
| aid-admin | 运营管理端 | [gitee](https://gitee.com/gzxx-2025/aid-admin) | [github](https://github.com/gzxx-2025/aid-admin) |
| aid-web | 用户创作端（本仓库） | [gitee](https://gitee.com/gzxx-2025/aid-web) | [github](https://github.com/gzxx-2025/aid-web) |

## 主要功能

- 创作项目管理：项目/剧本/分集，AI 辅助剧本创作
- 角色·道具·场景：形象资产建立与参考图管理
- 分镜工作台：分镜脚本、分镜图、镜头组与视频提示词
- AI 生成：文生图、图生图、图生视频、多镜头批量出片
- 配音合成：多音色 TTS 与角色配音绑定
- 账户体系：登录注册、实名认证、积分充值与消费明细

## 技术栈

| 维度 | 技术 |
|------|------|
| 框架 | Nuxt 3 |
| 视图层 | Vue 3 (Composition API) |
| 语言 | TypeScript |
| 状态管理 | Pinia |
| UI 组件 | Ant Design Vue 4 |
| 路由 | Nuxt 文件系统路由 |
| 代码规范 | Prettier + ESLint |

## 快速开始

要求 Node.js 18+。

```bash
# 安装依赖
npm install

# 配置后端地址（默认代理到 http://127.0.0.1:8080）
# Windows 使用 copy .env.example .env
cp .env.example .env

# 启动开发服务器（端口 3000）
npm run dev

# 构建生产版本
npm run build

# 类型检查 / 代码检查 / 格式化
npm run typecheck
npm run lint
npm run format
```

## 目录结构

```
├── assets/          # 静态资源与全局样式
├── components/      # 组件（原子设计模式：atoms / molecules / organisms）
├── composables/     # 组合式函数
├── layouts/         # 布局（home 宽侧栏 / 登录与创作流程全屏）
├── middleware/      # 路由中间件
├── pages/           # 页面路由（文件系统路由）
├── plugins/         # Nuxt 插件
├── server/          # Nuxt server 目录（接口代理）
├── static/          # 纯静态资源（行为验证码 SDK 等）
├── stores/          # Pinia 状态管理
├── types/           # TypeScript 类型定义
└── utils/           # 工具函数（接口封装、信封加密等）
```

## 与后端对接

- 后端接口基地址通过 `.env` 的 `NUXT_PROXY_TARGET` 配置（开发代理目标）
- C 端接口统一 POST + 请求体传参，支持接口信封加密（AES-GCM + RSA-OAEP），开关由后端 `POST /auth/public-config` 下发
- 服务端接口文档见 [aid-server](https://gitee.com/gzxx-2025/aid-server) 仓库

## 部署

构建产物为纯静态文件，由 Nginx 托管站点根路径；完整生产部署流程（含 Docker 与在线升级）见服务端仓库的《上线部署指南》。

## 开源协议

本项目基于 [MIT License](LICENSE) 开源，版权归光子讯息(杭州)科技有限公司所有。
