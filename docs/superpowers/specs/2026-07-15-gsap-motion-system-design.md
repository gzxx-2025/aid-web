# GSAP 全站动效系统设计

**日期**：2026-07-15  
**状态**：待实现  
**范围**：第一期 = 动效基建 + 2 个示范；后续按扩展清单分期铺开

## 背景与目标

项目已安装 `gsap@^3.15.0`，但业务代码中尚未使用。首页 Hero 使用 Three.js 圆柱轮播；案例列表、创作流程等主要依赖 CSS `transition` / shimmer。目标是建立**可复用、SSR 安全、风格统一**的 GSAP 动效体系，让展示页更有「漫剧」电影感，创作页保持克制工具感，再逐步扩展到全站。

## 决策摘要

| 项 | 选择 |
|----|------|
| 落地策略 | 全站系统化（先基建，再铺页） |
| 风格 | 混合：展示页偏电影感，创作页偏克制 |
| 第一期范围 | 基建 + 2 个示范组件/页面，验证手感后再批量扩展 |
| 实现方案 | 方案 1：`useGSAP` + `motionPresets` + 可选 `useMotion`，业务用配方而非散写 timeline |

## 1. 基建层

### 1.1 新增文件

| 文件 | 作用 |
|------|------|
| `composables/useGSAP.ts` | 导出 `gsap`、按需 `lazyLoadPlugin`；应用级插件注册入口 |
| `utils/motionPresets.ts` | 动效配方：时长、缓动、stagger；区分 `showcase` / `create` 两套强度 |
| `composables/useMotion.ts` | 薄封装：`gsap.context` + `onUnmounted` → `ctx.revert()`，减少样板代码 |

### 1.2 技术约定

- 仅在客户端、`onMounted`（或等价时机）之后创建动画；卸载时必须 `ctx.revert()`。
- 选择器必须通过 `gsap.context(fn, rootEl)` 限定作用域，避免串扰其他组件。
- 使用 `gsap.matchMedia()` 尊重 `prefers-reduced-motion`：减弱或跳过动画，直接设终态。
- **不替换**现有 Hero Three.js、CSS shimmer、玻璃态动效；GSAP 只补「入场 / 状态切换 / 仪式感」。
- 第一期插件：核心 `gsap`；需要时懒加载 `ScrollTrigger`。`Flip` / `SplitText` 等留给后续扩展，不在第一期引入。
- 禁止在 `setup` 顶层同步执行 `gsap.to` / `gsap.from`（SSR 不安全）。

### 1.3 动效 Token（预置）

**展示页（`showcase`）**

- duration：`0.45–0.6s`
- ease：`power2.out`
- 卡片 stagger：`0.05–0.08s`
- 位移参考：`y: 28`，`scale: 0.96 → 1`

**创作页（`create`）**

- duration：`0.25–0.35s`
- ease：`power2.out`
- 位移参考：`y: 12`（更小）
- 默认无列表 stagger（避免拖沓）

具体数值以 `utils/motionPresets.ts` 导出的常量/函数为准，业务页禁止硬编码魔法数。

## 2. 第一期示范动画

### 2.1 示范 A：首页案例广场卡片（电影感）

- **挂载**：`pages/index.vue` 中 `.works-grid` / `.work-card--gallery`
- **触发**：
  1. 案例列表首次加载完成（数据从空到有）
  2. 筛选 Tab / 搜索导致列表刷新时，对当前可见卡片再播入场
- **效果**：`opacity 0→1`，`y: 28→0`，轻微 `scale: 0.96→1`；stagger ≈ `0.06s`；单卡 ≈ `0.5s`；ease `power2.out`
- **边界**：
  - 不改 Hero 轮播
  - 不加重卡片 hover（保留现有 CSS）
  - 若后续无限滚动追加卡片：仅对新插入节点短 stagger，禁止整页重播
- **减弱动画**：直接显示终态

### 2.2 示范 B：创作流程步骤内容进入（克制）

- **挂载**：`components/create/CreateFlowShell.vue` 主内容区（步骤子页内容容器，如 `.create-main__transition-wrap` 内）
- **触发**：七步路由切换、新步骤内容挂载后播一次
- **效果**：内容根节点 `opacity 0→1`，`y: 12→0`；时长 `0.28–0.32s`；ease `power2.out`；无 stagger
- **与 CSS 路由 transition**：步骤内容进入**只保留 GSAP 一层**，避免双重叠加
- **边界**：
  - 不动画顶栏、侧栏、步骤条（第一期）
  - 不动画 Ant Design Modal / Drawer
  - 步骤内大数据列表（分镜网格等）第一期不做卡片 stagger

## 3. 后续扩展清单（非第一期实现）

| 优先级 | 场景 | 风格 | 说明 |
|--------|------|------|------|
| P1 | 作品库 / 资产库卡片入场 | 展示偏电影 | 复用案例广场 `staggerReveal` 配方 |
| P1 | 案例详情页进入 | 电影 | 视频区与右侧信息栏分时入场 |
| P2 | AI 生成完成反馈 | 创作偏克制 | 单卡短 pulse / 高光，不打断操作 |
| P2 | 步骤条进度推进 | 克制 | 当前步高亮微动、连接线进度（可选） |
| P3 | 登录页品牌入场 | 电影 | 品牌 + 表单轻量 fade-up |
| P3 | Flip 布局切换 | 进阶 | Tab/网格重排时用 Flip，需单独评估性能 |

原则：先复用 `motionPresets`，再写新时间轴；不为动画而动画。

## 4. 验收标准（第一期）

1. **基建可用**：任意页面可通过 `useGSAP` / `useMotion` 创建动画；卸载无残留、无控制台报错。
2. **示范 A**：首页案例加载与 Tab 切换时卡片错落入场；`prefers-reduced-motion` 下直接显示且不卡顿。
3. **示范 B**：创作流程换步时主内容轻量进入；不与现有 CSS transition 双重叠加。
4. **性能**：首页约 20–40 张卡入场无明显卡顿；创作页动画不拖慢点击响应。
5. **文档**：`README.md` 补充「GSAP 动效约定」短节（用法、两套强度、禁区）。

## 5. 风险与处理

| 风险 | 处理 |
|------|------|
| 与 CSS 路由 transition 冲突 | 步骤内容进入只保留 GSAP 一层 |
| SSR 执行 GSAP | 动画逻辑仅 client；禁止 setup 顶层 `gsap.*` |
| 列表频繁刷新叠播 | 用 key / 世代号取消上一次 timeline |
| 与 driver.js 引导叠动 | 引导进行中可跳过或缩短入场（实现计划中细化） |

## 6. 明确不做（第一期）

- 替换 Hero Three.js 轮播
- 全站声明式 `v-gsap` 指令体系
- Flip / SplitText / ScrollSmoother 等进阶插件落地
- 创作页内部分镜/素材大列表 stagger
- 为动画重做视觉设计或改主题色

## 7. 实现顺序建议

1. 落地 `useGSAP` + `motionPresets` + `useMotion`
2. 接入示范 A（首页案例卡片）
3. 接入示范 B（创作步骤内容进入）并处理与 CSS transition 的互斥
4. 更新 `README.md` 动效约定
5. 自测减弱动画 + 列表切换取消叠播
