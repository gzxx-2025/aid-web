/**
 * 全站视口档位标记（与系统 100% 观感一致）：
 * - 根节点 zoom 恒为 1，不再用「撑宽 + 缩小」拟合 1920（会导致文字偏小）
 * - Windows 系统缩放只写入 data-viewport-os-scale / 宽屏档位，布局走真实 CSS 视口
 * - 窄屏收紧依赖媒体查询（home-new-compact-viewport / create-flow-compact-viewport 等）
 */
import { nextTick } from 'vue'
import {
  VIEWPORT_COMPACT_MEDIA,
  VIEWPORT_COMPACT_SCALE_CHANGED_EVENT,
  VIEWPORT_DESIGN_CLAMP_MEDIA,
  applyViewportCompactScale,
  readViewportCompactScalePreference
} from '~/utils/viewportCompactScale'

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const config = useRuntimeConfig()
  const configEnabled = config.public.viewportCompactScale !== false

  let resizeRaf = 0
  let lastDpr = window.devicePixelRatio || 1

  function applyViewportZoom() {
    applyViewportCompactScale(configEnabled && readViewportCompactScalePreference())
  }

  function onResize() {
    cancelAnimationFrame(resizeRaf)
    resizeRaf = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1
      if (Math.abs(dpr - lastDpr) > 0.01) {
        lastDpr = dpr
      }
      applyViewportZoom()
    })
  }

  applyViewportZoom()

  const compactMq = window.matchMedia(VIEWPORT_COMPACT_MEDIA)
  const designClampMq = window.matchMedia(VIEWPORT_DESIGN_CLAMP_MEDIA)
  // 部分浏览器可监听分辨率/缩放变化
  const dprMq =
    typeof window.matchMedia === 'function'
      ? window.matchMedia(`(resolution: ${Math.round((window.devicePixelRatio || 1) * 96)}dpi)`)
      : null

  function bindMedia(mq: MediaQueryList) {
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', applyViewportZoom)
    } else {
      ;(mq as unknown as { addListener: (fn: () => void) => void }).addListener(applyViewportZoom)
    }
  }

  bindMedia(compactMq)
  bindMedia(designClampMq)
  if (dprMq) bindMedia(dprMq)

  window.addEventListener('resize', onResize)
  window.addEventListener(VIEWPORT_COMPACT_SCALE_CHANGED_EVENT, applyViewportZoom)
  window.addEventListener('orientationchange', onResize)
  window.visualViewport?.addEventListener('resize', onResize)

  // 从其它应用切回时系统缩放可能已变
  window.addEventListener('focus', onResize)

  nuxtApp.hook('page:finish', () => {
    void nextTick(applyViewportZoom)
  })

  const router = useRouter()
  router.afterEach(() => {
    void nextTick(applyViewportZoom)
  })
})
