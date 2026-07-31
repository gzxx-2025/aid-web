/** 解析 Nuxt 同源 API 路径（兼容部署在 /aid/ 等子路径） */
export function resolveSameOriginApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (typeof window === 'undefined') return p
  try {
    const { app } = useRuntimeConfig()
    const base = String(app?.baseURL ?? '/')
    if (!base || base === '/' || base === '/_nuxt/' || base === '/_nuxt') {
      return p
    }
    const normalized = base.endsWith('/') ? base.slice(0, -1) : base
    return `${normalized}${p}`
  } catch {
    return p
  }
}
