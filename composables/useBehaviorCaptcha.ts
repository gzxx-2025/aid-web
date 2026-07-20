import { ref } from 'vue'
import { resolveClientApiUrl } from '~/utils/api'
import { maybeDecryptApiPayload, prepareEncryptedRequest, shouldEncryptApiPath } from '~/utils/apiCrypto'
import { waitForTacReady } from '~/utils/tacAssets'

declare global {
  interface Window {
    TAC?: new (config: unknown, style?: unknown) => {
      init: () => void
      destroyWindow: () => void
      reloadCaptcha: () => void
    }
    CaptchaConfig?: new (config: unknown) => {
      requestCaptchaData: () => Promise<unknown>
      validCaptcha: (id: string, data: unknown, captcha: unknown, tac: unknown) => void
      domBindEl: unknown
      addRequestChain: (chain: unknown) => void
      insertRequestChain: (index: number, chain: unknown) => void
    }
  }
}

export interface OpenBehaviorCaptchaOptions {
  bindEl: string | HTMLElement
  captchaType?: string | null
  onSuccess: (token: string) => void | Promise<void>
  onCancel?: () => void
}

/**
 * 打开 tianai 行为验证码（滑块/旋转等），校验成功后回调一次性 captcha-token。
 * 依赖登录页 {@link useTacPageHead} 引入的 `/tac/css/tac.css` 与 `/tac/js/tac.min.js`。
 */
export function useBehaviorCaptcha() {
  const opening = ref(false)
  let activeInstance: { destroyWindow: () => void } | null = null

  function destroyActive() {
    try {
      activeInstance?.destroyWindow()
    } catch {
      /* ignore */
    }
    activeInstance = null
  }

  async function openBehaviorCaptcha(options: OpenBehaviorCaptchaOptions): Promise<boolean> {
    if (!import.meta.client) return false

    try {
      await waitForTacReady()
    } catch (e: unknown) {
      console.error('[TAC] 静态资源未加载', e)
      return false
    }

    opening.value = true
    destroyActive()

    const bindEl =
      typeof options.bindEl === 'string' ? options.bindEl : (options.bindEl as HTMLElement)
    const genUrl = resolveClientApiUrl('/captcha/gen')
    const checkUrl = resolveClientApiUrl('/captcha/check')
    const preferredType = options.captchaType?.trim()

    return new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        opening.value = false
        resolve(ok)
      }

      const CaptchaConfigCtor = window.CaptchaConfig
      if (!CaptchaConfigCtor || !window.TAC) {
        finish(false)
        return
      }

      const baseConfig = {
        bindEl,
        requestCaptchaDataUrl: genUrl,
        validCaptchaUrl: checkUrl,
        timeToTimestamp: true,
        validSuccess: async (
          res: { data?: { token?: string } },
          _c: unknown,
          tac: { destroyWindow: () => void; reloadCaptcha: () => void }
        ) => {
          const token = res?.data?.token
          if (!token) {
            tac.reloadCaptcha()
            return
          }
          tac.destroyWindow()
          activeInstance = null
          try {
            await options.onSuccess(token)
            finish(true)
          } catch {
            finish(false)
          }
        },
        validFail: (_res: unknown, _c: unknown, tac: { reloadCaptcha: () => void }) => {
          tac.reloadCaptcha()
        },
        btnRefreshFun: (_el: unknown, tac: { reloadCaptcha: () => void }) => {
          tac.reloadCaptcha()
        },
        btnCloseFun: (_el: unknown, tac: { destroyWindow: () => void }) => {
          tac.destroyWindow()
          activeInstance = null
          options.onCancel?.()
          finish(false)
        }
      }

      const config = new CaptchaConfigCtor(baseConfig) as InstanceType<typeof CaptchaConfigCtor> & {
        doSendRequest: (req: {
          url: string
          method?: string
          headers?: Record<string, string>
          data?: unknown
        }) => Promise<unknown>
      }

      // /captcha/check 在加密开启时走信封协议；TAC 的 preRequest 不支持 async，故包装 doSendRequest
      if (shouldEncryptApiPath('/captcha/check')) {
        const nativeDoSend = config.doSendRequest.bind(config)
        config.doSendRequest = async (req) => {
          if (req.url === checkUrl && String(req.method || 'POST').toUpperCase() === 'POST') {
            const enc = await prepareEncryptedRequest({ body: req.data ?? {} })
            req.headers = { ...(req.headers || {}), ...enc.headers }
            req.data = enc.body
            const raw = await nativeDoSend(req)
            return maybeDecryptApiPayload(raw, enc.aesKey)
          }
          return nativeDoSend(req)
        }
      }

      config.insertRequestChain(0, {
        preRequest(name: string, req: { data?: Record<string, unknown> }) {
          if (name === 'requestCaptchaData' && preferredType) {
            if (!req.data || typeof req.data !== 'object') req.data = {}
            req.data.type = preferredType
          }
          return true
        }
      })

      try {
        // 不传 styleConfig，使用 tac.min.js 内置默认主题与样式
        const tac = new window.TAC!(config)
        activeInstance = tac
        tac.init()
      } catch {
        finish(false)
      }
    })
  }

  return {
    opening,
    openBehaviorCaptcha,
    destroyActive
  }
}
