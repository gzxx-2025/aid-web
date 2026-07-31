# GSAP 全站动效系统 Implementation Plan

> **Status:** 第一期已实现（2026-07-15）

**Goal:** 落地 GSAP 基建并接入两个示范：首页案例卡片错落入场、创作流程步骤内容轻量进入。

**Architecture:** `useGSAP` + `motionPresets` + `useMotion`；展示/创作两套强度；不替换 Hero Three.js / CSS shimmer。

**Tech Stack:** Nuxt 3、Vue 3、gsap ^3.15.0

---

### Task 1: 动效基建 ✅

- [x] `composables/useGSAP.ts`
- [x] `utils/motionPresets.ts`
- [x] `composables/useMotion.ts`

### Task 2: 示范 A — 首页案例卡片 ✅

- [x] `pages/index.vue`：`staggerReveal` + 世代号

### Task 3: 示范 B — 创作步骤内容进入 ✅

- [x] `CreateFlowShell.vue`：`fadeUpEnter` 随 `pageReady` / `route.path`

### Task 4: README ✅

- [x] 「GSAP 动效约定」短节
