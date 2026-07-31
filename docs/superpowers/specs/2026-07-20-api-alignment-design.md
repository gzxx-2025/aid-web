# 7/16–7/18 接口对齐设计

> 日期：2026-07-20  
> 状态：已确认（用户排除第 4 条封面/介绍 UI）

## 目标

按 `components/steps/接口.md` 与产品 checklist，将前端与 7/16–7/18 接口变更对齐；已对齐项不改；任一请求路径不得并发重复打同一接口。

## 范围

### 纳入

1. API / 类型层：新接口封装、类型补齐、关键接口 in-flight 去重  
2. 剧集整篇导入：`split/preview` → 预览 → `split/confirm`  
3. 成片下载：`episode/export/download` blob  
4. 专业版：`listByFunc` 带 `projectId`/`episodeId`；`agent/list` 带 scope  
5. 分镜：`references[]`；配音四字段进映射/UI；出片 `referenceOverrides` 与错误透传保持  
6. 公开广场：列表/详情字段与剧集切集

### 明确排除（本轮不做）

- 项目/单集封面与介绍完整 UI（`coverUrl`/`projectDesc`/`comicCoverUrl`/`comicDesc` 上传与编辑入口）  
- 「封面不能用风格图」前端校验（随封面 UI 一并延后）

## 架构

以 `types/business-api.ts` + `utils/businessApi.ts` 为中心对齐；业务页只消费规范化结果。对 `listByFunc`、`agent/list`、`storyboard/list`、`image-prompt/resolve` 增加与 `storyboardDetailOnce` / `userProjectDetailOnce` 同类的 in-flight 合并。

## 关键行为

### 分集导入

- 入口：`pages/create/series-script-upload.vue`  
- 流程：FileReader 读 `.txt` → preview → 展示集列表 → confirm  
- 确认中 loading + 禁重复提交；单集导入仍走 `script/upload`

### 成片下载

- 入口：创作流「保存本地」  
- `POST /api/user/episode/export/download`，blob；优先 `episodeEditorId`，否则 `projectId+episodeId`（电影 `0`）  
- 加解密豁免与 zip 一致

### 专业版

- `listByFunc` 传 scope；前端可仍传 `main_storyboard_video`，由后端切 `multi_pro`  
- 创作流内 `agent/list` 统一 `buildAidAgentListScopeParams`

### 分镜

- resolve 优先 `references[{n,name,imageId,url}]`，平行数组 fallback  
- list/detail 映射 `voiceType` / `speakerRoles` / `speakerVoices` / `audioStatus`

### 公开广场

- 列表：`coverUrl`、`projectDesc`、`authorNickname`；Tab 传 `projectType`  
- 详情：`authorNickname`；剧集 `episodes[]` 切集；单一触发源拉详情

## 不做

不改后端；不重构无关页面；不改已对齐的单集 upload / image-prompt 清洗逻辑。
