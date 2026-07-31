# 前端开发规范（aid-pc）

> 适用项目：Nuxt 3 + Vue 3 + TypeScript + Pinia + Ant Design Vue  
> 目标：控制单文件体积、减少重复与冗余、降低人工维护成本  
> 更新日期：2026-07-22

---

## 1. 总则

1. **可读优先于炫技**：3 行能说清的事不要写 50 行；不为「看起来完整」堆空壳抽象。
2. **复用优先于复制**：同一业务规则在 ≥2 处出现，必须抽到 `utils/` 或 `composables/`，禁止第三处再复制粘贴。
3. **改动最小化**：只改当前需求相关代码；不顺手大重构、不改无关格式、不扩写 README（除非规范要求更新）。
4. **逻辑不变是底线**：任何抽离/拆分必须以「行为完全一致」为前提；有疑问先补测试或对照清单再动。
5. **AI 生成代码必须人工过一遍**：提交前删除死代码、合并重复分支、核对是否已有现成工具函数可复用。

---

## 2. 目录与职责

| 目录 | 放什么 | 不放什么 |
|------|--------|----------|
| `pages/` | 路由入口、组装布局 | 大段业务逻辑、大段样式 |
| `components/` | UI 与交互；步骤页放 `components/steps/` | 跨步骤可复用的纯函数 |
| `composables/` | 可复用的组合逻辑（SSE 跟随、批量生成、弹窗任务态） | 与 UI 强绑定的大段模板 |
| `utils/` | 纯函数、映射、校验、无副作用工具 | 依赖组件实例 / DOM 的逻辑 |
| `stores/` | 跨页面共享状态 | 一次性局部 UI 状态（用 `ref`） |
| `types/` | 类型与接口定义 | 运行时逻辑 |
| `assets/css/` | 全局主题、跨组件共享样式 | 仅某一组件用的私有样式（用 scoped） |
| `config/` | 静态配置（引导 tour、枚举映射等） | 业务副作用 |

**命名约定**

- 组件：`PascalCase.vue`（如 `StoryboardScript.vue`）
- composable：`useXxx.ts`（如 `useStoryboardImageBatchGenerate.ts`）
- 纯工具：动词/名词清晰（如 `storyboardImageBatchRestoreGate.ts`）
- 共享 CSS：`<domain>-shared.css` 或已有主题文件（如 `storyboard-step-shared.css`、`scp-step-shared.css`）

---

## 3. 单文件体量门槛（硬约束）

| 类型 | 建议上限 | 超过时必须做的事 |
|------|----------|------------------|
| `.vue` 组件 | **800 行** | 拆子组件 / 抽 composable / 抽 utils；PR 说明拆分方式 |
| `.ts` composable / utils | **500 行** | 按「职责」拆文件（恢复态、提交、SSE、结果应用分文件） |
| 单组件 `<style scoped>` | **300 行** | 能共用的迁到 `assets/css/*-shared.css`；变量用 CSS 变量 |
| `stores/*.ts` | **800 行** | 按领域拆 store 或抽 `stores/modules/` 式 helper（保持对外 API 稳定） |

**例外**：类型大文件（如 `types/business-api.ts`）、接口文档 MD 不计入上述门槛，但类型仍应分区注释，避免无意义重复类型。

**新增代码红线**

- 禁止在已超标文件上继续「整段粘贴」新功能；应先抽离再加，或平行新建小模块再组装。
- 单次 PR 若使某文件净增 >200 行，需在说明里写清：为何不能拆、后续拆分计划。

---

## 4. Vue / Composition API 规范

### 4.1 组件结构顺序

```vue
<script setup lang="ts">
// 1. import
// 2. props / emits / defineModel
// 3. store / composable
// 4. 本地 state / computed
// 5. watch / 生命周期
// 6. 事件处理与业务方法
</script>

<template>...</template>

<style scoped>
/* 仅本组件独有样式 */
</style>
```

### 4.2 逻辑放哪

| 场景 | 放哪里 |
|------|--------|
| 仅本组件用的 UI 状态 | 组件内 `ref` / `reactive` |
| 2+ 组件共用的交互流程 | `composables/useXxx.ts` |
| 无 UI、可单测的规则/映射 | `utils/xxx.ts` |
| 跨路由持久业务状态 | `stores/` |
| 展示用文案/步骤元信息 | `utils/` 或 `config/`（参考 `createFlowStepMeta.ts`） |

### 4.3 禁止事项

- 禁止在 `template` 里写复杂表达式（超过一次三元 / 多属性拼接）→ 用 `computed` 或方法。
- 禁止复制整段「加载中 / SSE 跟随 / 失败回滚」逻辑；先搜项目里是否已有 `use*Task`、`*BatchGenerate`、`*RestoreGate`。
- 禁止组件内再定义与 `types/business-api.ts` 冲突的「临时 any 接口」；缺字段就补类型。
- 禁止无意义的 `any`；实在需要时写注释说明原因与收敛计划。

### 4.4 弹窗与创作流程约定

- 创作流程内 `a-modal` 必须带 `wrap-class-name` 含 `create-flow-modal`（可与其它 class 并列）。
- 深色创作壳：`html.app-shell-create`；样式优先用 `--home-*` / `--create-surface-*` / `--accent-*`，**不要**用全局浅色 `--primary-50` 当选中底。
- 引导锚点：关键操作加 `data-onboarding="..."`，配置走 `config/onboarding/tours.ts`。

---

## 5. TypeScript 与 API

1. 业务请求统一走现有封装（如 `utils/businessApi.ts`），不在组件里散落裸 `axios`。
2. 新增接口字段先改 `types/business-api.ts`，再写调用方。
3. 错误提示：复用项目已有的 message / confirm 工具（如 `utils/appConfirm.ts`），文案简短明确。
4. 空值处理：统一用可选链与显式默认值，避免「每种空值写一套 if」。

---

## 6. 状态与副作用

1. **SSE / 后台任务**：优先接入已有 registry / follow / restore 机制（如任务跟随、批量恢复门闸），不要每个弹窗自己开一套 Set + 轮询。
2. **作品切换**：跨作品状态必须以 `projectId`（或等价键）隔离；参考现有「弹窗生成任务跨作品同步」方案，禁止只靠组件本地 flag。
3. **hydrate / 恢复**：刷新后状态恢复逻辑放 composable/utils，组件只调用；避免在 `onMounted` 复制粘贴 100 行恢复代码。
4. **副作用清理**：`onBeforeUnmount` / `watch` 的 stop、SSE 取消、定时器清除必须成对出现。

---

## 7. CSS / 样式规范

### 7.1 优先级

1. **CSS 变量**（`assets/css/home-theme.css`、`create-steps-ant-overrides.css` 等）  
2. **领域共享样式**（`storyboard-step-shared.css`、`scp-step-shared.css`、`history-record-card.css` 等）  
3. **组件 scoped**（仅差异部分）  
4. 最后才考虑 `!important`（仅覆盖 Ant Design 且已有文件在用的场景）

### 7.2 必须遵守

- **颜色、圆角、边框、字号**：优先变量，禁止在多处写死同一 hex。
- **相同布局块**（工具条按钮高 28px、列表行、卡片媒体区、空状态）：复用已有 shared class，禁止再抄一份 scoped。
- **scoped 里出现「大段与某 shared 文件重复」**：应删 scoped、改挂共享 class；不要「两边都留着」。
- **选择器**：控制层级，避免超长链式；创作页覆盖写在 `html.app-shell-create` 作用域内。
- **响应式**：优先现有 viewport / compact-scale 方案，不新增互斥的 zoom/缩放体系。

### 7.3 样式检查清单（提交前）

- [ ] 是否可用已有 `--home-*` / `--create-*` / `--storyboard-*` / `--scp-*` 变量？
- [ ] 是否已有 `*-shared.css` 能覆盖 80% 样式？
- [ ] scoped 是否只留下真正独特的差异？
- [ ] 有没有复制粘贴的重复规则（同一 `height/border-radius/background` 出现 ≥3 次）？

---

## 8. 复用与抽离原则（何时抽、怎么抽）

### 8.1 必须抽离的信号

- 同一段逻辑出现 **2 次** → 计划抽离；出现 **3 次** → **本次必须抽离**再继续。
- 多个弹窗都有：提交任务 → 本地 loading → SSE 跟随 → 成功写回 / 失败回滚。
- 多个步骤都有：批量勾选、批量生成、进度条、取消、刷新恢复。
- 样式上：按钮、Tab、列表行、媒体卡尺寸在两个步骤文件里各写了一遍。

### 8.2 推荐抽离形态

| 重复类型 | 抽成 |
|----------|------|
| 纯计算 / 门闸 / 映射 | `utils/xxx.ts` + 单测 `.test.mjs` |
| 带响应式与生命周期 | `composables/useXxx.ts` |
| 重复 UI 块 | 子组件（props/emits 清晰） |
| 重复样式 | `assets/css/xxx-shared.css` + 根 class 约定 |
| 重复配置 | `config/` 或 `utils/*Meta.ts` |

### 8.3 抽离质量要求

- **输入输出明确**：函数参数与返回值可读；避免「隐式依赖一堆外部变量」。
- **一个文件一个主题**：例如「恢复门闸」与「发起批量请求」不要糊在同一 2000 行文件里。
- **保持可测**：纯逻辑优先纯函数，便于 `node --test` / 现有 `*.test.mjs` 风格。
- **不要过度抽象**：只有一处用的「通用框架」不要先写；等第二处真实出现再抽象。

---

## 9. AI 辅助开发专项规范

1. **先搜再写**：改功能前先 `grep` / 全局搜关键词（Batch、Restore、Follow、Modal、shared.css）。
2. **生成后必删**：未使用的 import、注释掉的旧实现、重复的 helper、无用的 `console.log`。
3. **禁止膨胀**：AI 若生成「完整重写大文件」，应改为「最小 diff」；大重构单独开任务。
4. **对照现有模式**：批量生成、编辑弹窗、资产卡、历史记录卡——优先对齐已有实现，而不是新造第四套。
5. **文档**：接口说明可写在 `components/steps/接口.md` 等现有位置；**不要**为每个小改动新建散落 MD（除非用户明确要求）。

---

## 10. 提交前检查清单（Copy 到 PR / 提交说明）

**逻辑**

- [ ] 是否复用了已有 composable / utils，而不是复制？
- [ ] 单文件是否超过体量门槛？超过是否已拆或已说明计划？
- [ ] 作品切换 / 刷新恢复 / SSE 取消是否仍正确？
- [ ] 有无改变对外行为（默认值、错误提示、时序）？有则写在说明里

**样式**

- [ ] 是否优先用了主题变量与 shared CSS？
- [ ] scoped 是否只保留差异？
- [ ] 创作弹窗是否带 `create-flow-modal`？

**质量**

- [ ] `npm run typecheck`（或至少改动相关无新增 TS 报错）
- [ ] 关键/修改的纯逻辑是否有或可补 `*.test.mjs`
- [ ] 无密钥、无无关注释块、无大段无关格式化

---

## 11. 推荐日常工作流（给人看也给 AI 看）

```text
需求 → 搜索是否已有类似实现
     → 能复用则扩展，不能则按职责新建小模块
     → 组件只做组装
     → 样式先变量/shared，再 scoped
     → 对照清单自测（含切换作品、刷新、取消任务）
     → 提交
```

**一句话原则**：  
**新代码默认短、可复用、可测；旧代码不顺便搞大手术——大手术走《现有代码安全整改方案》。**

---

## 附录 A：本项目当前「超标」参考（便于对照规范）

> 以下为 2026-07-22 扫描快照，用于理解规范为何设门槛；整改节奏见另一份方案文档。

| 文件 | 约行数 | 问题类型 |
|------|--------|----------|
| `components/steps/SceneCharacterProp.vue` | ~13200 | 巨型步骤页，逻辑+样式耦合 |
| `EditSceneImageModal.vue` / `EditStoryboardImageModal.vue` / `EditStoryboardVideoModal.vue` | 5000–6000 | 编辑弹窗相似度高 |
| `stores/creation.ts` | ~3000 | 状态与辅助逻辑堆积 |
| `useStoryboardVideoBatchGenerate.ts` 等 | 1800–2800 | 批量/恢复/SSE 同文件过重 |
| `StoryboardScript.vue` 等步骤页 | 2000–2800 | 组件过厚 |
| `assets/css/home-theme.css` 等 | 1000+ | 主题与覆盖并存，需持续收敛变量 |

## 附录 B：已有正向模式（新代码应靠拢）

- 步骤共享样式：`storyboard-step-shared.css`、`scp-step-shared.css`
- 门闸/纯函数抽离：如 `utils/storyboardImageBatchRestoreGate.ts`
- 批量生成 composable 族：`useStoryboard*BatchGenerate.ts`（后续应继续「拆文件」而非「再复制一套」）
- 创作壳与 Ant 覆盖：`create-steps-ant-overrides.css` + `create-flow-modal`
- 步骤元信息：`utils/createFlowStepMeta.ts`
