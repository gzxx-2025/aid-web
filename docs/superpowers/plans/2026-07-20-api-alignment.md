# 7/16–7/18 接口对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端对齐 7/16–7/18 接口文档（排除封面/介绍 UI），并消除关键接口并发重复请求。

**Architecture:** API/类型层先行，再改业务页；请求去重集中在 util 层。

**Tech Stack:** Nuxt 3 / Vue 3 / TypeScript / 现有 `businessApi` + `request`

## Global Constraints

- 本轮不做项目/单集封面介绍 UI  
- 任何请求路径不得同时多次请求同一接口（同 key in-flight 合并）  
- 已对齐项不改  
- 响应中文；不主动 commit

---

## Task 1: 类型 + API 封装 + 去重

- [ ] 补齐 `PublicProjectVideoRow` / `PublicProjectDetailRow` / episodes  
- [ ] 新增 split preview/confirm、export/download 类型与 `businessApi` 方法  
- [ ] `listByFunc` 请求体支持 `projectId`/`episodeId`  
- [ ] resolve 类型支持 `references[]`  
- [ ] `apiCrypto` 豁免 `export/download`  
- [ ] 为 listByFunc / agent/list / storyboard/list / resolve 加 in-flight 去重

## Task 2: 剧集分集导入

- [ ] 改 `series-script-upload.vue`：preview → UI → confirm  
- [ ] 确认防重复提交

## Task 3: 成片 blob 下载

- [ ] 封装 download；替换 CreateFlowShell / 相关保存入口

## Task 4: 专业版 scope

- [ ] 所有创作流 `listByFunc` 带 projectId/episodeId  
- [ ] 所有创作流 `agent/list` 带 `buildAidAgentListScopeParams`

## Task 5: 分镜字段

- [ ] `buildPromptAssetsFromResolve` 优先 references  
- [ ] panel 映射配音四字段；Dubbing 等消费 audioStatus

## Task 6: 公开广场

- [ ] `index.vue` / `index-legacy.vue` 字段与 projectType  
- [ ] `case/[id].vue` authorNickname + episodes 切集 + 单触发源
