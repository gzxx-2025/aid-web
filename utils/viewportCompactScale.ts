/**
 * 低分辨率（769px–1440px）视口紧凑缩放：根节点 zoom 0.75 + data 属性触发 vh 补偿。
 * 由 plugins/viewport-compact-scale.client.ts 与 composables/useViewportCompactScale.ts 共用。
 */

export const VIEWPORT_COMPACT_MEDIA = '(min-width: 769px) and (max-width: 1440px)'
export const VIEWPORT_COMPACT_ZOOM = 0.75
export const VIEWPORT_COMPACT_SCALE_STORAGE_KEY = 'viewport-compact-scale:enabled'

/** 缩放偏好变更时派发，供插件重新 apply */
export const VIEWPORT_COMPACT_SCALE_CHANGED_EVENT = 'viewport-compact-scale:changed'

export function isMobileOnlyShell(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('mobile-only-shell')
}

export function isCompactViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(VIEWPORT_COMPACT_MEDIA).matches
}

/** 读取 localStorage 中的用户偏好；未设置时默认启用（保持原有行为）。 */
export function readViewportCompactScalePreference(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(VIEWPORT_COMPACT_SCALE_STORAGE_KEY)
    if (raw === null) return true
    return raw !== '0' && raw !== 'false'
  } catch {
    return true
  }
}

export function writeViewportCompactScalePreference(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VIEWPORT_COMPACT_SCALE_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(VIEWPORT_COMPACT_SCALE_CHANGED_EVENT))
}

export function clearCompactLayout(el: HTMLElement) {
  el.removeAttribute('data-viewport-compact-scale')
  el.style.removeProperty('zoom')
}

export function applyCompactLayout(el: HTMLElement) {
  el.setAttribute('data-viewport-compact-scale', '1')
  el.style.zoom = String(VIEWPORT_COMPACT_ZOOM)
}

/**
 * 根据视口宽度与用户/配置开关，决定是否应用紧凑缩放。
 * @param enabled 为 false 时强制关闭（来自 runtimeConfig 或用户偏好）
 */
export function applyViewportCompactScale(enabled = true) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  if (!enabled || isMobileOnlyShell() || !isCompactViewport()) {
    clearCompactLayout(el)
    return
  }
  applyCompactLayout(el)
}
