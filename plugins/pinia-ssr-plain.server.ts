import { plainDeep } from '~/utils/plainDeep'

/**
 * SSR：在写入 HTML payload 之前将 Pinia 状态转为纯 JSON 对象。
 * 修复 `obj.hasOwnProperty is not a function`（null 原型对象 / 部分 Proxy）。
 * hook 时机：renderToString 之后、renderPayloadJsonScript 之前。
 */
export default defineNuxtPlugin({
  name: 'pinia-ssr-plain',
  enforce: 'post',
  setup(nuxtApp) {
    if (!import.meta.server) return

    nuxtApp.hook('app:rendered', ({ ssrContext }) => {
      const payload = (ssrContext?.payload ?? nuxtApp.payload) as {
        pinia?: Record<string, unknown>
      }
      if (!payload?.pinia) return

      try {
        payload.pinia = plainDeep(payload.pinia)
      } catch {
        return
      }

      const pinia = nuxtApp.$pinia as { state: { value: Record<string, unknown> } } | undefined
      if (pinia?.state) {
        pinia.state.value = payload.pinia
      }
    })
  }
})
