/**
 * tianai-captcha 静态资源（`static/tac/`，经 nuxt `dir.public: 'static'` 发布为 `/tac/**`）
 *
 * 注意：勿用 `import.meta.env.BASE_URL` 拼接路径——在客户端 chunk 中常为 `/_nuxt/`，会导致 404。
 */

/** 站点根路径下的 TAC 资源（始终以 `/` 开头，相对域名根，而非 `/_nuxt/`） */
export const TAC_CSS_PATH = '/tac/css/tac.css'
export const TAC_JS_PATH = '/tac/js/tac.min.js'

/**
 * 解析 TAC 静态资源完整 URL（仅拼接 Nuxt `app.baseURL`，如 `/` 或 `/aid/`）
 */
export function resolveTacAssetUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!import.meta.client) {
    return p
  }
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

export function getTacCssUrl(): string {
  return resolveTacAssetUrl(TAC_CSS_PATH)
}

export function getTacJsUrl(): string {
  return resolveTacAssetUrl(TAC_JS_PATH)
}

function pollUntil<T>(getter: () => T | undefined | null, timeoutMs = 15000, intervalMs = 50): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      const v = getter()
      if (v) {
        resolve(v)
        return
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`等待 TAC 脚本超时: ${getTacJsUrl()}`))
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}

/** 等待登录页 useHead 引入的 tac.min.js 执行完毕 */
export async function waitForTacReady(): Promise<typeof window.TAC> {
  if (!import.meta.client) {
    throw new Error('TAC 仅能在浏览器环境使用')
  }
  if (window.TAC) return window.TAC

  await loadTacScriptFallback()
  return pollUntil(() => window.TAC)
}

/** 兜底：动态插入 link/script（href 使用站点根路径，避免 `/_nuxt/tac/...`） */
export async function loadTacScriptFallback(): Promise<void> {
  if (!import.meta.client || window.TAC) return

  const cssUrl = getTacCssUrl()
  const jsUrl = getTacJsUrl()

  if (!document.querySelector(`link[href="${cssUrl}"]`)) {
    await new Promise<void>((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = cssUrl
      link.onload = () => resolve()
      link.onerror = () => reject(new Error(`加载样式失败: ${cssUrl}`))
      document.head.appendChild(link)
    })
  }

  if (document.querySelector(`script[src="${jsUrl}"]`)) return

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = jsUrl
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`加载脚本失败: ${jsUrl}`))
    document.body.appendChild(script)
  })
}
