# 剧本有效变更后继续/重新提取设计

> 日期：2026-07-29  
> 状态：实现中  
> 关联：`composables/useCreateFlowExtractAgents.ts`、`components/steps/ExtractAgentModal.vue`、`composables/useCreateFlowRouteAndSteps.ts`、`POST /api/user/asset/extract/parallel`  
> 规范：`docs/2026-07-22-frontend-development-standards.md`、`docs/2026-07-22-existing-code-safe-remediation.md`
> 计划：`docs/superpowers/plans/2026-07-29-script-change-continue-extract.md`

---

## 1. 问题与目标

### 1.1 现象

用户基于旧剧本已完成素材提取（场景/角色/道具已有内容），随后在剧本页做了实质性修改，再进入「素材准备」时：

1. 有数据时不再自动弹出提取弹窗，顶部「自动提取」入口也已移除，只能看到旧素材，无法顺畅「补提」；
2. 若粗暴用「有内容变化就提示」，用户只敲一个「1」或无效短内容也会被当成剧本已改；
3. 没有「继续提取（保留旧内容）」与「重新提取（删 auto 并重计费）」的明确分流。

### 1.2 目标

1. **有效变更才打扰**：相对「上次成功提取」时的剧本基线，同时满足「正式版本升高 + 规范化后有效内容差异过阈值」才提示；
2. **剧本页离开强提示**：点「下一步」或流程 Tab 进入素材准备前先 Modal；确定后再跳转并打开提取弹窗；取消则留在剧本页并记住本次忽略；
3. **其它入口轻提示**：从作品库直进、从后续步骤点回第三步等，仅在素材页展示可关闭的轻提示条；
4. **提取弹窗双按钮**：`继续提取`（`overwrite=false`）/ `重新提取`（`overwrite=true` + Tooltip 说明删内容与重计费）；
5. **严格按项目/剧集隔离**：基线、忽略指纹、提示态均以 `projectId + episodeId` 为 key，禁止串作品/串集；
6. **治本可测**：规范化与变更判定落在纯 `utils/` + 单测，组件只组装。

### 1.3 非目标

- 不新增后端「剧本是否相对上次提取已变更」接口（本期前端本地基线即可）；
- 不改变提取 SSE 主流程（仍走 `userAssetExtractParallel` + `useTaskStream`）；
- 不恢复「有数据时顶部常驻自动提取按钮」为默认入口（仅本功能触发的弹窗 / 轻提示）；
- 不在 autoSave（不升 `comicVersion`）路径上触发提示。

---

## 2. 已确认产品决策

| 项 | 决策 |
|----|------|
| 比对基准 | 相对「上次成功提取」时的剧本快照（A） |
| 有效变更条件 | `comicVersion` 升高 **且** 规范化内容有效差异过阈值（C） |
| 提取范围 | 三类一起：scene + character + prop（A） |
| 强提示时机 | 离开剧本页进入素材准备前（下一步 / 流程 Tab）（方案 1） |
| 其它入口 | 轻提示条，不拦路由（C） |
| 取消/关闭后 | 按当前变更指纹持久记住，直到下次新的有效变更（B） |
| 技术路径 | 前端本地基线（方案 1）+ 条件 C |
| 污染隔离 | 一律 `projectId + episodeId` 隔离（电影 `episodeId=0`） |

---

## 3. 交互流程

### 3.1 强提示（剧本页 → 素材准备）

```text
用户在剧本页点击「下一步」或流程 Tab（目标=素材准备）
  → 若将正式保存：先走现有 save（升 comicVersion）
  → 判定 shouldPromptScriptChangeExtract(projectId, episodeId, currentScript, comicVersion, hasAutoAssets)
  → false：按原逻辑跳转（空列表仍可走既有自动弹窗）
  → true：弹出确认 Modal
       · 确定：标记待打开提取弹窗 → 跳转素材准备 → 打开 ExtractAgentModal（mode=continueOrReextract）
       · 取消：写入 ignoredChangeKey → 留在剧本页，不跳转
```

**Modal 文案（建议）**

- 标题：`剧本已更新`
- 正文：`检测到剧本有实质性更新，且素材库已有内容。可继续提取以补充新角色/场景/道具，或重新提取（会删除此前自动提取的内容并重新计费）。`
- 主按钮：`去提取`
- 次按钮：`暂不提取`

### 3.2 轻提示（其它入口进入素材准备）

- 条件同 `shouldPrompt...`，且当前路由已在素材准备、且非「刚从强提示确定进来」的同一轮。
- UI：素材准备页顶部一条可关闭提示条；主操作「去提取」打开同一双按钮弹窗；关闭 = 写入 ignoredChangeKey。
- **不拦截路由、不强制 Modal。**

### 3.3 提取弹窗

| 元素 | 行为 |
|------|------|
| 继续提取 | `overwrite: false` → 现有 SSE；成功后更新提取基线、清 ignored |
| 重新提取 | Tooltip：`重新提取会将之前提取的内容删除并重新计费`；确认点击后 `overwrite: true` → SSE；成功后更新基线、清 ignored |
| 取消 | 关弹窗；若本轮由强/轻提示打开，不自动改 ignored（用户可再次点「去提取」）；仅「暂不提取 / 关提示条」写 ignored |

首次空列表自动打开的弹窗：仍可用「开始提取」（或内部等价 `overwrite=false`），**不出现**「重新提取」，避免空库误导。

---

## 4. 变更判定（治本）

### 4.1 基线结构

按 key `extractBaseline:${projectId}:${episodeId}` 持久化（Pinia persist map 或等价 localStorage）：

```ts
type ScriptExtractBaseline = {
  projectId: number
  episodeId: number
  comicVersion: number
  normalizedHash: string
  normalizedLen: number
  savedAt: number
}
```

**写入时机**：资产提取任务 SSE `SUCCEEDED`（或业务认定成功完成）时，用**当时**剧本规范化结果 + 当时 `comicVersion` 覆盖写入。

**忽略指纹**：

```ts
type IgnoredScriptChange = {
  projectId: number
  episodeId: number
  changeKey: string // `${comicVersion}:${normalizedHash}`
}
```

### 4.2 规范化

纯函数（建议 `utils/scriptContentFingerprint.ts`）：

1. HTML → 纯文本（去标签、解码实体）；
2. 换行统一、全角空格→半角、压缩连续空白；
3. 去零宽字符 / BOM；
4. trim；
5. 输出：`normalizedText`、`normalizedLen`、`normalizedHash`（稳定字符串 hash，如 FNV-1a 或项目已有 hash 工具）。

### 4.3 有效变更判定

`isMeaningfulScriptChange(baseline, current)` 须**同时**满足：

1. `current.comicVersion > baseline.comicVersion`；
2. `current.normalizedHash !== baseline.normalizedHash`；
3. `current.normalizedLen >= 50`（过短不提示）；
4. 有效差异过阈值：  
   `diffChars >= max(80, baseline.normalizedLen * 0.02)`  
   其中 `diffChars` 可用「增删近似」：`|lenDiff| + 公共前缀/后缀剥离后的剩余长度` 等轻量算法；短剧本以绝对字数兜底。

`shouldPromptScriptChangeExtract` 额外要求：

- 当前上下文下**已有**自动提取相关资产（服务端 RPS 列表非全空，或 `isExtracted`/本地列表证明曾提取）；
- `changeKey !== ignored.changeKey`；
- 无进行中的提取任务。

### 4.4 无基线降级（清缓存 / 换机）

若已有自动资产但本地无基线：

1. 用当前规范化文本 + 当前 `comicVersion` 写入**冷启动基线**；
2. **本次不提示**；
3. 待下次正式 save 升版且再满足差异时再提示。

避免「一进页就误报」。

### 4.5 与 autoSave 的关系

- `autoSave` 不升 `comicVersion` → 条件 1 不满足 → **不提示**（符合已确认决策 C）。
- 剧本页「下一步」现有正式 `save` 会升版，强提示路径可覆盖「改完就进素材」的主路径。

---

## 5. 隔离与防污染

| 风险 | 约束 |
|------|------|
| 切作品/切集串基线 | 所有读写必须带 `projectId+episodeId`；切上下文重算，不缓存跨作品布尔结果 |
| parallel 写错集 | 继续使用 `resolveStoryScriptSaveContext`；body 带当前 project/episode |
| overwrite 删错范围 | 仅传当前上下文；删除范围以后端 `overwrite=true` 既有语义为准（当前 project+episode 下 `create_source=auto`；手动资产不动） |
| persist 串号 | 禁止全局单份「当前剧本 hash」；使用 map |

提示与基线**只读比对 / 写元数据**，不改剧本正文、不在提示阶段改资产。

---

## 6. 架构与文件边界

| 单元 | 职责 |
|------|------|
| `utils/scriptContentFingerprint.ts` | 规范化、hash、diffChars、isMeaningfulScriptChange（纯函数 + `*.test.mjs`） |
| `utils/scriptExtractBaseline.ts` 或 store 薄封装 | baseline / ignored 的 get/set，key 隔离 |
| `composables/useScriptChangeExtractGate.ts` | 组装：读剧本与 comicVersion、查是否有资产、shouldPrompt、强提示 confirm、待打开弹窗标记 |
| `useCreateFlowRouteAndSteps` / 流程 Tab 点击 | 拦截「剧本→素材」导航，接入 gate |
| `ExtractAgentModal.vue` | 支持 `actionMode: 'start' \| 'continueOrReextract'`；双按钮 + Tooltip |
| `useCreateFlowExtractAgents.ts` | `startExtractAssets` 接收 `overwrite`；成功回调写 baseline；类型补 `extractScope` 可选（剧集默认增量，可不显式传） |
| `SceneCharacterProp.vue` 或 shell | 轻提示条 UI（尽量薄，样式走变量/shared） |

遵守：`.vue` 不大段粘贴；逻辑进 utils/composable；最小 diff。

---

## 7. API 契约

`POST /api/user/asset/extract/parallel`：

| 按钮 | `overwrite` | 行为（后端既有） |
|------|-------------|------------------|
| 继续提取 | `false` / 省略 | 增量；去重合并；不删已有 auto |
| 重新提取 | `true` | 软删当前 project+episode 下 auto 资产后重提 |

`estimate` 可继续不传 `extractScope`（剧集默认 `EPISODE_INCREMENTAL`）。类型定义可补齐 `extractScope?` 供后续使用，本期强依赖是 `overwrite`。

**非本功能接口**：`/api/user/asset/rps/update-main` 不参与本流程。

---

## 8. 错误与边界

| 场景 | 处理 |
|------|------|
| 剧本过短 / 无效 | 不提示 |
| 仅空白/标点/单字差异 | 不达阈值 → 不提示 |
| 提取进行中 | 不弹强/轻提示；不重复提交 |
| 用户确定后跳转但弹窗被其它逻辑抑制 | 「待打开提取弹窗」标记在素材页 syncReady 后消费一次 |
| 重新提取失败 | 不更新 baseline；保留可重试 |
| 继续提取部分成功 | 以现有 extract 成功判定为准；仅在认定成功时更新 baseline |

---

## 9. 测试计划

### 9.1 单测（必须）

- 规范化：HTML、空白、零宽字符
- 过短文本不视为有效变更
- 同 version 不同内容 → false
- version 升高但差异 &lt; 阈值 → false
- version 升高且差异够 → true
- ignored changeKey 命中 → shouldPrompt false
- 不同 projectId/episodeId 基线互不影响

### 9.2 手工验收

1. 空库首次提取 → 成功写基线；再进素材不提示  
2. 改剧本正式下一步，大段有效修改 → 强提示 → 确定 → 跳转 + 双按钮弹窗 → 继续提取 → 旧内容保留且有增量  
3. 同上走重新提取 → Tooltip 可见 → 旧 auto 清除并重提计费  
4. 只敲「1」或少量无效改动并 save → 不提示  
5. 仅 autoSave 未正式 save → 不提示  
6. 取消强提示 → 留剧本页；同变更再点下一步不弹；再改一版有效内容后又弹  
7. 从作品库进素材（有有效变更）→ 仅轻提示条  
8. 切另一作品/另一集 → 提示与基线不串

---

## 10. 文案汇总

| 位置 | 文案 |
|------|------|
| 强提示标题 | 剧本已更新 |
| 强提示正文 | 检测到剧本有实质性更新，且素材库已有内容。可继续提取以补充新角色/场景/道具，或重新提取（会删除此前自动提取的内容并重新计费）。 |
| 强提示主按钮 | 去提取 |
| 强提示次按钮 | 暂不提取 |
| 轻提示 | 剧本有实质性更新，可继续提取或重新提取素材。 |
| 轻提示操作 | 去提取 |
| 弹窗按钮 | 继续提取 / 重新提取 |
| 重新提取 Tooltip | 重新提取会将之前提取的内容删除并重新计费 |

---

## 11. 实现顺序建议

1. `scriptContentFingerprint` 纯函数 + 测试  
2. baseline / ignored 存储与隔离  
3. `useScriptChangeExtractGate` + 导航拦截（下一步 + Tab）  
4. ExtractAgentModal 双按钮 + `overwrite` 提交  
5. 成功写基线；轻提示条  
6. 联调验收清单

---

## 12. 开放阈值（可调，默认如下）

| 常量 | 默认 |
|------|------|
| `MIN_NORMALIZED_LEN` | 50 |
| `MIN_DIFF_CHARS` | 80 |
| `MIN_DIFF_RATIO` | 0.02 |

若线上误报/漏报，只调常量与单测，不改交互骨架。
