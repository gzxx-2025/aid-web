<template>
  <div id="app" v-cloak>
    <NuxtLayout>
      <NuxtPage
        :key="nuxtPageEpoch"
        :page-key="resolveNuxtPageKey"
        :transition="nuxtPageTransition"
      />
    </NuxtLayout>
    <div
      v-if="showGlobalLoading"
      class="global-page-loading"
      role="status"
      aria-live="polite"
      aria-label="页面加载中"
    >
      <div class="global-page-loading__inner">
        <div class="global-page-loading__logo">AI Director</div>
        <div class="global-page-loading__dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p>页面加载中...</p>
      </div>
    </div>

    <ViewportCompactScaleToggle />

    <div
      v-if="routeOverlayVisible"
      class="route-overlay"
      role="status"
      aria-live="polite"
      aria-label="页面切换中"
    >
      <div class="route-overlay__inner">
        <div class="route-overlay__glow" />
        <div class="route-overlay__brand">AI·D</div>
        <div class="route-overlay__hint">正在进入创作流程…</div>
        <div class="route-overlay__bar" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useEnterCreateFlowOverlay } from '~/composables/useEnterCreateFlowOverlay'
import {
  createFlowPageKey,
  endCreateFlowNavTransition,
  flushCreateFlowNavGate,
  isCreateFlowNavPath,
  isCreateFlowTransitionCrashError
} from '~/utils/createFlowNavSerialize'

const route = useRoute()
const router = useRouter()
const nuxtApp = useNuxtApp()
const { enterCreateFlowOverlayPending, endEnterCreateFlowOverlay } = useEnterCreateFlowOverlay()
const MIN_LOADING_MS = 320
const MIN_ROUTE_OVERLAY_MS = 420
/** 极端兜底：避免 chunk 失败导致遮罩永久卡住 */
const MAX_ROUTE_OVERLAY_MS = 20000
const isCreateFlowPage = computed(() => isCreateFlowNavPath(route.path))
// 全局 loading 仅作为遮罩，不再通过 v-if 卸载 NuxtLayout（避免路由切换时空 vnode 报错）
const showGlobalLoading = ref(!isCreateFlowPage.value)
const routeOverlayVisible = ref(false)
/** 本次跨壳层遮罩是否仍在等待页面真正就绪 */
const routeOverlayAwaitingPage = ref(false)
/**
 * 创作流程 Transition 竞态白屏时的自愈：抬升 key 强制重挂 NuxtPage。
 * 不改变 create-step-route 动画本身；门闩修妥后仅作最后兜底。
 */
const nuxtPageEpoch = ref(0)
let createFlowPageRecovering = false
let createFlowRecoverCooldownUntil = 0
// 流程页切换使用 out-in（先出后进）；通过“绝对定位叠放”避免旧页回闪/抖动
// 稳定对象引用；onAfterEnter 释放导航门闩（完整 out-in 结束后才放行下一跳）
const CREATE_FLOW_PAGE_TRANSITION = {
  name: 'create-step-route',
  mode: 'out-in' as const,
  onAfterEnter() {
    endCreateFlowNavTransition()
  }
}
const nuxtPageTransition = computed(() =>
  isCreateFlowPage.value ? CREATE_FLOW_PAGE_TRANSITION : undefined
)

/** 流程内按 path+作品/剧集 区分页面实例，无关 query 清理不再二次 out-in */
function resolveNuxtPageKey(r: RouteLocationNormalizedLoaded) {
  return createFlowPageKey(r)
}

function recoverCreateFlowPageIfNeeded(error: unknown) {
  if (!import.meta.client) return
  if (!isCreateFlowNavPath(route.path)) return
  if (!isCreateFlowTransitionCrashError(error)) return
  const now = Date.now()
  if (createFlowPageRecovering || now < createFlowRecoverCooldownUntil) return
  createFlowPageRecovering = true
  createFlowRecoverCooldownUntil = now + 1500
  nuxtPageEpoch.value += 1
  flushCreateFlowNavGate()
  if (import.meta.dev) {
    console.warn('[create-flow] recovered blank page after Transition race', error)
  }
  nextTick(() => {
    createFlowPageRecovering = false
  })
}

function onUnhandledRejection(ev: PromiseRejectionEvent) {
  recoverCreateFlowPageIfNeeded(ev.reason)
}

let loadingTimer: ReturnType<typeof setTimeout> | null = null
let navToken = 0
let routeOverlayTimer: ReturnType<typeof setTimeout> | null = null
let routeOverlayFailSafeTimer: ReturnType<typeof setTimeout> | null = null
let routeOverlayStartAt = 0
let routeOverlayHideToken = 0

function clearLoadingTimer() {
  if (!loadingTimer) return
  clearTimeout(loadingTimer)
  loadingTimer = null
}

function clearRouteOverlayTimer() {
  if (!routeOverlayTimer) return
  clearTimeout(routeOverlayTimer)
  routeOverlayTimer = null
}

function clearRouteOverlayFailSafeTimer() {
  if (!routeOverlayFailSafeTimer) return
  clearTimeout(routeOverlayFailSafeTimer)
  routeOverlayFailSafeTimer = null
}

/** 首页壳层路由：侧栏 /、/works、/assets 之间切换不显示全屏 loading */
function isHomeShellPath(fullPath: string): boolean {
  const path = (fullPath.split('?')[0].split('#')[0] || '/').replace(/\/$/, '') || '/'
  if (path === '/') return true
  if (path === '/works' || path.startsWith('/works/')) return true
  if (path === '/assets' || path.startsWith('/assets/')) return true
  return false
}

function isCreateFlowPath(fullPath: string): boolean {
  return isCreateFlowNavPath(fullPath)
}

function enterLoading() {
  if (isCreateFlowPage.value) {
    showGlobalLoading.value = false
    return
  }
  showGlobalLoading.value = true
}

function leaveLoadingWithDelay() {
  if (isCreateFlowPage.value) {
    showGlobalLoading.value = false
    return
  }
  const token = ++navToken
  clearLoadingTimer()
  loadingTimer = setTimeout(() => {
    if (token !== navToken) return
    showGlobalLoading.value = false
  }, MIN_LOADING_MS)
}

function armRouteOverlayFailSafe() {
  clearRouteOverlayFailSafeTimer()
  routeOverlayFailSafeTimer = setTimeout(() => {
    hideRouteOverlayWhenReady()
  }, MAX_ROUTE_OVERLAY_MS)
}

function showRouteOverlay() {
  clearRouteOverlayTimer()
  routeOverlayHideToken += 1
  routeOverlayStartAt = Date.now()
  routeOverlayAwaitingPage.value = true
  routeOverlayVisible.value = true
  armRouteOverlayFailSafe()
}

/**
 * 等页面真正就绪后再关遮罩（至少展示 MIN_ROUTE_OVERLAY_MS）。
 * 不能在 router.afterEach 立刻关：首次进入流程页时 chunk/布局仍可能在加载，
 * 过早关闭会露出「我的作品」再空等几秒。
 */
function hideRouteOverlayWhenReady() {
  if (!routeOverlayVisible.value && !routeOverlayAwaitingPage.value) {
    endEnterCreateFlowOverlay()
    return
  }
  const token = ++routeOverlayHideToken
  const elapsed = Date.now() - routeOverlayStartAt
  const wait = Math.max(0, MIN_ROUTE_OVERLAY_MS - elapsed)
  clearRouteOverlayTimer()
  routeOverlayTimer = setTimeout(() => {
    if (token !== routeOverlayHideToken) return
    routeOverlayAwaitingPage.value = false
    routeOverlayVisible.value = false
    endEnterCreateFlowOverlay()
    clearRouteOverlayFailSafeTimer()
  }, wait)
}

onMounted(() => {
  // 首屏/刷新：短暂全屏 loading
  leaveLoadingWithDelay()

  // 关键体验点：跨壳层（首页/作品库 <-> 创作流程）切换时，立即给出视觉反馈
  router.beforeEach((to, from) => {
    const fromHome = isHomeShellPath(from.fullPath)
    const toHome = isHomeShellPath(to.fullPath)
    const fromCreate = isCreateFlowPath(from.fullPath)
    const toCreate = isCreateFlowPath(to.fullPath)

    // 仅在「跨壳层」时显示遮罩：避免打扰 home 内部 tab 切换 & create 内部步骤切换
    const isCrossShell = (fromHome && toCreate) || (fromCreate && toHome)
    if (isCrossShell) {
      showRouteOverlay()
    }
    return true
  })

  // 路由失败时必须释放，避免永久挡住交互
  router.onError((error) => {
    recoverCreateFlowPageIfNeeded(error)
    if (routeOverlayAwaitingPage.value || routeOverlayVisible.value) {
      hideRouteOverlayWhenReady()
    }
  })

  // 以 Nuxt 页面就绪为准，而不是 afterEach（afterEach 往往早于 chunk 渲染完成）
  function tryHideRouteOverlayAfterPageReady() {
    if (!routeOverlayAwaitingPage.value) return
    // 入口已拉起遮罩但尚未 router.push：仍停在首页壳层，不能误关
    if (enterCreateFlowOverlayPending.value && isHomeShellPath(route.fullPath)) return
    hideRouteOverlayWhenReady()
  }

  nuxtApp.hook('page:finish', () => {
    tryHideRouteOverlayAfterPageReady()
  })
  nuxtApp.hook('page:loading:end', () => {
    tryHideRouteOverlayAfterPageReady()
  })
  nuxtApp.hook('app:error', (error) => {
    recoverCreateFlowPageIfNeeded(error)
  })

  const prevVueErrorHandler = nuxtApp.vueApp.config.errorHandler
  nuxtApp.vueApp.config.errorHandler = (err, instance, info) => {
    recoverCreateFlowPageIfNeeded(err)
    if (typeof prevVueErrorHandler === 'function') {
      return prevVueErrorHandler(err, instance, info)
    }
  }

  window.addEventListener('unhandledrejection', onUnhandledRejection)
})

// 入口在 router.push 前就会拉起遮罩（hydrate / 解析步骤），避免点完后仍停在作品页空等
watch(
  enterCreateFlowOverlayPending,
  (pending) => {
    if (pending) {
      showRouteOverlay()
      return
    }
    // hydrate / 解析失败时入口会主动 end：立即收起，勿干等 page:finish
    if (!routeOverlayVisible.value && !routeOverlayAwaitingPage.value) return
    clearRouteOverlayTimer()
    clearRouteOverlayFailSafeTimer()
    routeOverlayHideToken += 1
    routeOverlayAwaitingPage.value = false
    routeOverlayVisible.value = false
  },
  { immediate: true }
)

watch(
  () => route.fullPath,
  (newPath, oldPath) => {
    if (!oldPath || newPath === oldPath) return
    // /、/works、/assets 之间互跳：不触发全屏 loading
    if (isHomeShellPath(newPath) && isHomeShellPath(oldPath)) {
      return
    }
    enterLoading()
    leaveLoadingWithDelay()
  }
)

onBeforeUnmount(() => {
  clearLoadingTimer()
  clearRouteOverlayTimer()
  clearRouteOverlayFailSafeTimer()
  if (import.meta.client) {
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
})
</script>

<style lang="scss">
[v-cloak] {
  display: none !important;
}

@import 'assets/font/font.css';
#app {
  min-height: 100vh;
  font-family:
    PingFang SC;
}
.global-page-loading {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: linear-gradient(165deg, #001731 0%, #0d0d0f 42%, #121212 100%);
}

.global-page-loading__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #e6edf3;
}

.global-page-loading__logo {
  font-size: 24px;
  font-weight: 700;
  color: #4ae7fd;
  letter-spacing: 0.02em;
}

.global-page-loading__dots {
  display: flex;
  gap: 8px;
}

.global-page-loading__dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(74, 231, 253, 0.35);
  animation: global-dot-pulse 1s infinite ease-in-out;
}

.global-page-loading__dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.global-page-loading__dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.global-page-loading p {
  margin: 0;
  font-size: 13px;
  color: #8e97a5;
}

@keyframes global-dot-pulse {
  0%,
  80%,
  100% {
    transform: scale(0.8);
    opacity: 0.35;
  }
  40% {
    transform: scale(1);
    opacity: 1;
    background: #4ae7fd;
  }
}

.route-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: grid;
  place-items: center;
  background:
    radial-gradient(60% 55% at 50% 40%, rgba(74, 231, 253, 0.14), transparent 62%),
    linear-gradient(
      165deg,
      rgba(0, 23, 49, 0.92) 0%,
      rgba(13, 13, 15, 0.92) 42%,
      rgba(18, 18, 18, 0.92) 100%
    );
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: route-overlay-in 0.18s ease-out both;
}

.route-overlay__inner {
  width: min(520px, calc(100vw - 40px));
  border-radius: 14px;
  border: 1px solid rgba(74, 231, 253, 0.16);
  background: rgba(10, 14, 20, 0.72);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.42);
  padding: 18px 18px 14px;
  color: #e6edf3;
  position: relative;
  overflow: hidden;
}

.route-overlay__glow {
  position: absolute;
  inset: -60px -40px auto;
  height: 120px;
  background: radial-gradient(closest-side, rgba(74, 231, 253, 0.22), transparent 70%);
  filter: blur(2px);
}

.route-overlay__brand {
  position: relative;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #4ae7fd;
}

.route-overlay__hint {
  position: relative;
  margin-top: 6px;
  font-size: 13px;
  color: rgba(230, 237, 243, 0.78);
}

.route-overlay__bar {
  position: relative;
  margin-top: 14px;
  height: 8px;
  border-radius: 999px;
  background: rgba(74, 231, 253, 0.12);
  overflow: hidden;
}

.route-overlay__bar i {
  display: block;
  width: 38%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(74, 231, 253, 0),
    rgba(74, 231, 253, 0.85),
    rgba(14, 89, 250, 0.75)
  );
  animation: route-overlay-bar 0.72s ease-in-out infinite;
}

@keyframes route-overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes route-overlay-bar {
  0% {
    transform: translateX(-40%);
    opacity: 0.55;
  }
  50% {
    transform: translateX(90%);
    opacity: 1;
  }
  100% {
    transform: translateX(190%);
    opacity: 0.55;
  }
}

.create-step-route-enter-active,
.create-step-route-leave-active {
  position: absolute;
  inset: 0;
  width: 100%;
  transition:
    opacity 0.18s ease;
  will-change: opacity, transform;
}

.create-step-route-enter-from {
  opacity: 0;
  transform: none;
}

.create-step-route-leave-to {
  opacity: 0;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .create-step-route-enter-active,
  .create-step-route-leave-active {
    transition: none;
  }
  .route-overlay {
    animation: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .route-overlay__bar i {
    animation: none;
  }
}

.edit-scene-image-modal {
  .ant-modal-content {
    padding: 0 !important;
  }
}
</style>
