/**
 * 全站：视口宽度在「手机竖屏之上、大屏之下」时，将根节点 zoom 至 0.75，
 * 使布局观感接近 ≥1440 的设计稿（不依赖各 layout 的 html class，避免 useHead 合并覆盖导致不生效）。
 *
 * 使用内联 style.zoom：比仅靠 scoped/布局 CSS 更稳定；与创作页、首页壳、登录页等共用 document.documentElement。
 *
 * zoom 会整体缩小绘制，但子组件里大量 height:100vh / calc(100vh-80px) 仍按未缩放视口算，
 * 视觉高度只有约 75%。除根节点 zoom 外，为 html 打上 data-viewport-compact-scale，
 * 由 viewport-compact-scale-overrides.css 对 .home-page、.main-layout 等做 vh 补偿。
 *
 * 开关：
 * - runtimeConfig.public.viewportCompactScale（环境变量 NUXT_PUBLIC_VIEWPORT_COMPACT_SCALE=0 可全局关闭）
 * - localStorage `viewport-compact-scale:enabled`（用户通过右下角开关切换，默认开启）
 */
import { nextTick } from 'vue'
import {
  VIEWPORT_COMPACT_MEDIA,
  VIEWPORT_COMPACT_SCALE_CHANGED_EVENT,
  applyViewportCompactScale,
  readViewportCompactScalePreference
} from '~/utils/viewportCompactScale'

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const config = useRuntimeConfig()
  const configEnabled = config.public.viewportCompactScale !== false

  function applyViewportZoom() {
    applyViewportCompactScale(configEnabled && readViewportCompactScalePreference())
  }

  applyViewportZoom()

  const mq = window.matchMedia(VIEWPORT_COMPACT_MEDIA)
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', applyViewportZoom)
  } else {
    ;(mq as unknown as { addListener: (fn: () => void) => void }).addListener(applyViewportZoom)
  }

  window.addEventListener(VIEWPORT_COMPACT_SCALE_CHANGED_EVENT, applyViewportZoom)

  nuxtApp.hook('page:finish', () => {
    void nextTick(applyViewportZoom)
  })

  const router = useRouter()
  router.afterEach(() => {
    void nextTick(applyViewportZoom)
  })
})
