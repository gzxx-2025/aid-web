const MOBILE_ONLY_PATH = '/mobile'

function isMobileUserAgent(ua: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Windows Phone/i.test(
    ua
  )
}

function isMobileClient(): boolean {
  if (!import.meta.client) return false
  const ua = navigator.userAgent || ''
  const byUa = isMobileUserAgent(ua)
  const byWidth = window.matchMedia('(max-width: 900px)').matches
  return byUa || byWidth
}

export default defineNuxtRouteMiddleware((to) => {
  // SSR 阶段：优先通过 UA 判断，避免首屏闪跳
  if (import.meta.server) {
    const headers = useRequestHeaders(['user-agent'])
    const ua = String(headers['user-agent'] || '')
    const isMobile = isMobileUserAgent(ua)
    if (isMobile && to.path !== MOBILE_ONLY_PATH) {
      return navigateTo(MOBILE_ONLY_PATH)
    }
    if (!isMobile && to.path === MOBILE_ONLY_PATH) {
      return navigateTo('/')
    }
    return
  }

  const isMobile = isMobileClient()
  if (isMobile && to.path !== MOBILE_ONLY_PATH) {
    return navigateTo(MOBILE_ONLY_PATH)
  }
  if (!isMobile && to.path === MOBILE_ONLY_PATH) {
    return navigateTo('/')
  }
})
