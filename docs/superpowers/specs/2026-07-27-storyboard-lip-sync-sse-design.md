# 编辑分镜配音弹窗 · 对口型改 SSE（含中途试听）设计

> 日期：2026-07-27  
> 状态：已确认并实现（2026-07-27）  
> 关联：`components/steps/配音对口型相关功能改造.md`、`components/steps/接口.md`（§9 发起对口型合成 / §9.1 批量对口型）、`docs/superpowers/specs/2026-07-24-create-flow-sse-page-coordinator-design.md` §4.3、`docs/superpowers/plans/2026-07-26-sse-remaining-gaps-followup.md` P4  
> 规范：`docs/2026-07-22-frontend-development-standards.md`、`docs/2026-07-22-existing-code-safe-remediation.md`

---

## 1. 问题与目标

### 1.1 现状

编辑分镜配音弹窗（`EditStoryboardDubbingModal`）在开启「对口型」后：

1. 仍按旧协议调用 `POST /api/user/storyboard/lipSync`，把返回当成 `StoryboardAudioTaskVO`，用 `id` 当 `audioRecordId`
2. 用 `pollStoryboardAudioTaskUntil` 轮询 `GET /audio/{audioRecordId}` 跟 `lipSyncStatus`
3. 与分镜图/脚本/视频已对齐的 **任务 SSE 主通道**不一致；刷新/切步恢复仍绑在 audio 轮询上

新后端已改为：**受理型异步**，返回 `taskId`，进度走 `GET /api/user/task/stream/{taskId}`。

### 1.2 目标

1. **仅对口型路径**切换为：`/lipSync` → `taskId` → SSE（与批量对口型同一任务通道）
2. **普通配音**（`lipSync=false`）保持现有 `compose/voiceover` + `compose/status` 轮询，本期不动
3. SSE `stepId=dub` 到达后支持**中途试听** `audioUrl`（`.wav`），无需等合成结束
4. 终态产物进配音视频列表且**不自动选中**；用户点「设置为配音对口型」才走现有 `setFinal`
5. 切步 / 切集 / 刷新续跟遵守既有静默断连与 scope 隔离；**禁止** SSE 与 audio 轮询双跟同一任务

### 1.3 非目标

| 项 | 原因 |
|----|------|
| 改写普通配音 compose 链路 | 产品确认仍走旧逻辑 |
| 批量对口型大改 | 接口结构基本不变；仅若前端解析缺字段再补 `audioUrl`/`durationMs` |
| 新建第四套页面 SSE 调度器 | 复用 `useTaskStream` / `useTaskSseFollow` + 现有 dubbing follow lock / restore |
| 整文件重写 `EditStoryboardDubbingModal.vue` | 巨石文件；只接回调与试听 UI |
| 对口型吃参考音频 | 接口明确不支持 |

---

## 2. 已确认决策

| 项 | 决策 |
|----|------|
| 实现方案 | **方案 C**：SSE 主通道 + `task/detail` / `audio/{audioRecordId}` 轻量兜底 |
| 试听 UI | **A**：与协议切换同交付 |
| 分支条件 | `params.lipSync === true` → 新 SSE；`false` → 原 compose |
| 进度字段落点 | 扩 `utils/taskSseProgressText.ts` 的 `TaskSseProgressInput` + `parseTaskSseProgressPayload`（`useTaskStream` 已消费该解析） |
| 对齐范本 | 小模块：`useStoryboardImageGenerateTask`；SSE 入口优先 `waitUserTaskSseTerminal`（内部已用 `useTaskStream` + 超时/详情补查）；**不**整抄 `useStoryboardImageBatchGenerate` |
| 主持久化 key | **`taskId`**（父任务）；`audioRecordId` 仅进度到达后可选存，供试听与 audio 兜底 |
| 重复点击 | 后端幂等返回同一 `taskId`；前端不另加节流锁 |
| 余额不足 | 走 SSE `error`（及既有充值处理），不再假定同步接口返回 |
| 与 SSE 调度设计关系 | 兑现 P4「对口型改 SSE」；挂现有 follow/restore，不并行造调度 |

---

## 3. 架构与数据流

```text
弹窗「对口型 ON」→ 开始配音
  → POST /api/user/storyboard/lipSync
  → { taskId, status, totalCount: 1 }
  → persist taskId（Pinia StoryboardDubbingGenTaskSnapshot + session）
  → waitUserTaskSseTerminal({ taskId, onProgress })
       progress stepId=dub
         → message / percent
         → audioRecordId / audioUrl / durationMs → 试听 UI
       progress stepId=lipSync
         → 「对口型合成中…」
       complete
         → items[0].lipSyncVideoUrl（相对路径需拼接）
         → items[0].lipSyncVideoRecordId
         → 写入 genHistory；isSelected=0；不调 setFinal
       error / cancelled
         → 既有 SSE 错误解析 + 充值弹窗（余额不足）
  → 用户「设置为配音对口型」→ 现有 setFinal({ recordType: 'video', recordId })
```

普通配音（对口型 OFF）数据流不变：

```text
compose/voiceover → composeBatchId + audioRecordId → compose/status 轮询 → detail 补 URL
```

### 3.1 ID 语义（禁止混用）

| 字段 | 含义 | 用途 |
|------|------|------|
| `taskId` | `aid_extract_task.id`，taskType=`storyboard_lip_sync_single` | SSE 订阅、恢复主 key、`task/detail` |
| `audioRecordId` | `aid_audio_record.id`（现场 TTS） | 试听、可选 `GET /storyboard/audio/{id}` 兜底 |
| `lipSyncVideoRecordId` | `aid_gen_record.id`（genType=compose） | 列表项 / 后续 setFinal |
| `composeBatchId` | 仅非对口型 compose | 不得用于 lipSync SSE 路径 |

### 3.2 恢复优先级

1. 已持久化且有效的 `taskId` → 直接订阅 SSE  
2. 否则幂等再调 `POST /lipSync`（同分镜进行中会返回原 `taskId`）→ 再订阅  
3. SSE 不可用时 `POST /task/detail` 查终态 / 进行中  
4. 仅当已有 `audioRecordId` 时，可用 `GET /audio/{audioRecordId}` 的 `lipSyncStatus` / `syncVideoUrl` 作兜底  

**禁止**：同一任务同时跑 SSE follow 与 audio 轮询。

---

## 4. 改动落点

| 层 | 文件 | 职责 |
|----|------|------|
| 类型 | `types/business-api.ts` | 单个 `/lipSync` 受理返回改为与 batch 同形的 `AssetExtractTaskVO`（可用现有 `StoryboardLipSyncBatchAcceptVO` 或抽共用别名）；单个 complete `items[0]` 类型补齐 `audioUrl`/`durationMs`/`speakerRoles` 等；batch item 同步补字段 |
| API | `utils/businessApi.ts` | `userStoryboardLipSync` 返回类型与注释改为 task VO；去掉「轮询 audio/{本接口返回 id}」旧说明 |
| SSE 公共 | `utils/taskSseProgressText.ts` | 解析/类型增加 `audioRecordId?`、`audioUrl?`、`durationMs?`、`storyboardId?` |
| 生成核心 | `composables/useStoryboardDubbingGenerate.ts`（必要时抽 `utils/storyboardLipSyncSse.ts`） | `submit` lipSync 分支返回 `{ mode:'lipSync', taskId }`；`onSubmitted` 同步带上 `taskId`；`followStoryboardLipSyncOnlyJob` 改走 `waitUserTaskSseTerminal`；progress 透出试听字段；complete 映射 `videoUrl`/`recordId`；job/progress/result 类型补 `taskId` 与试听字段 |
| 恢复判定 | `utils/modalGenTaskRestore.ts` | lipSync：优先 `taskId` + `resolveOngoingTaskId` / task detail；不再把「仅有 audioRecordId」当成唯一进行中证据（无 taskId 时走幂等 lipSync 或 detail） |
| 背景恢复 | `composables/useStoryboardDubbingBackgroundRestore.ts` | 对口型 resume 传 `taskId`，走新 follow |
| 弹窗 | `components/steps/EditStoryboardDubbingModal.vue` | `onSubmitted`/`onProgress` 持久化 `taskId`；生成中区域展示试听；复用已有 Audio 试听能力 |
| 单测 | `utils/taskSseProgressText` 相关 test、新建 lipSync complete/progress 映射 test（`*.test.mjs`） | 字段不丢、相对 URL、ID 不串 |

业务规则进 composable/utils；弹窗只组装 UI 与持久化回调。`useStoryboardDubbingGenerate.ts` 若因本次改动明显超 500 行，按职责把「lipSync SSE follow / complete 解析」抽到平行小模块（如 `utils/storyboardLipSyncSse.ts` 或 `composables/useStoryboardLipSyncTask.ts`），禁止在巨石弹窗内粘贴整段 follow。

---

## 5. 试听 UI

| 项 | 约定 |
|----|------|
| 时机 | 收到 progress 且 `stepId=dub`（或等价已带完整 `audioUrl`）后展示；合成阶段仍可试听该 wav |
| 位置 | 弹窗「正在生成中」状态区（与现有 loading 卡/进度文案同区），不新开全屏播放器 |
| 实现 | 复用 `EditStoryboardDubbingModal` 已有试听 Audio 播放逻辑（入口函数），对口型中途 `audioUrl` 直接播；SSE progress 里 `audioUrl` 已是完整域名，**不要二次乱拼** |
| 文案 | 配音阶段：「配音已生成，可试听」类短文案；合成阶段：「对口型合成中…」；成功仍提示手动「设置为配音对口型」 |
| 重连 | Redis 快照首包若已含 `audioUrl`，恢复订阅后同样可试听 |
| 失败 | 配音阶段 SSE error：隐藏试听、toast 错误；费用类走充值 |

---

## 6. 错误处理

### 6.1 同步（建任务前，`code != 200`）

直接 `message.error(msg)`，文案以后端为准（分镜不存在、暂无台词、请先选定视频、请先绑定音色、仅支持单角色、文本过长、对口型进行中等）。

### 6.2 SSE（任务已建）

| 场景 | 行为 |
|------|------|
| `配音失败` / `对口型失败` / 超时等 | toast `errorMessage` / `userMessage` |
| `余额不足` | 走既有 `handleSseErrorRecharge` / `openRechargeModalFromInsufficientBalance` |
| 良性断连（切步/切集/abort） | **静默**，走 `taskSseSilentDisconnect`；保留 taskId，回页 resume |
| `cancelled` | 按现有取消文案，清 loading |

---

## 7. 与既有 SSE 对齐的关系（无冲突）

| 既有能力 | 本期用法 |
|----------|----------|
| `waitUserTaskSseTerminal`（内含 `useTaskStream`） | 对口型主 follow |
| `taskSseSilentDisconnect` | 切步假失败静默 |
| `runStoryboardDubbingGenFollowOnce` | 防同分镜双 follow |
| Pinia `StoryboardDubbingGenTaskSnapshot.taskId` + session `taskId` | 已预留字段，改为必填主路径 |
| compose 轮询 | **仅** `lipSync=false` |

冲突规避：

1. 不得把 `taskId` 写入旧逻辑的 `audioRecordId` 字段冒充  
2. 不得 SSE + audio 轮询并行  
3. 普通配音路径零行为变更（回归必测）

---

## 8. 验收清单

- [ ] 对口型 ON：Network 见 `/lipSync` 返回 `taskId`，随后 `/task/stream/{taskId}`  
- [ ] `stepId=dub` 后可试听 wav；合成完成前可反复试听  
- [ ] complete 后配音视频列表多一条，未自动选中；手动 setFinal 后成为主配音视频；分镜原视频 `finalVideoId` 不变  
- [ ] 对口型生成中重复点击：仍同一 `taskId`，不双扣费、不双连  
- [ ] 刷新 / 切创作步骤 / 切剧集再回：loading 可续跟，无「任务中断」类假 toast  
- [ ] 余额不足：SSE error 触发充值，非同步 `/lipSync` 报错（在后端已切换的前提下）  
- [ ] 对口型 OFF：仍走 compose，行为与改前一致  
- [ ] 单测：progress 三字段解析；complete items 映射；相对 URL 拼接

---

## 9. 实施顺序（供 writing-plans 拆任务）

1. 类型 + `businessApi` + progress 解析字段（可单测）  
2. lipSync submit/follow/complete 内核（composable/utils）+ 单测  
3. restore / background restore 改 `taskId` 主路径  
4. 弹窗：持久化 `taskId` + 试听 UI + 进度文案  
5. 手工矩阵验收（§8）

每步可独立回滚；功能与大重构不捆。
)