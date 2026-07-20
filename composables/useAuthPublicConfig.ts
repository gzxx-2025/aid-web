import { computed, ref } from 'vue'
import type { AuthPublicConfigData } from '~/types/business-api'
import { authPublicConfig } from '~/utils/businessApi'
import { applyApiCryptoFromPublicConfig } from '~/utils/apiCrypto'

const STORAGE_KEY = 'auth:public-config:v1'

function readCachedConfig(): AuthPublicConfigData | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthPublicConfigData
  } catch {
    return null
  }
}

function writeCachedConfig(data: AuthPublicConfigData) {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    applyApiCryptoFromPublicConfig(data.crypto, data.serverTime)
  } catch {
    /* ignore quota */
  }
}

function syncCryptoFromConfig(data: AuthPublicConfigData | null) {
  applyApiCryptoFromPublicConfig(data?.crypto, data?.serverTime)
}

/** 登录页首屏公开配置：验证码开关、发码策略等（与接口文档 /auth/public-config 对齐） */
export function useAuthPublicConfig() {
  const config = ref<AuthPublicConfigData | null>(readCachedConfig())
  const loading = ref(false)
  const loaded = ref(!!config.value)

  if (config.value) syncCryptoFromConfig(config.value)

  const captchaEnabled = computed(() => {
    const c = config.value?.captcha
    if (!c?.enabled) return false
    if (c.imagesReady === false || c.applicationOk === false) return false
    return true
  })

  const captchaType = computed(() => config.value?.captcha?.type ?? 'SLIDER')

  const cryptoEnabled = computed(() => Boolean(config.value?.crypto?.enabled && config.value?.crypto?.publicKey))

  async function loadPublicConfig(force = false): Promise<AuthPublicConfigData | null> {
    if (!import.meta.client) return null
    if (!force && config.value) {
      loaded.value = true
      return config.value
    }
    loading.value = true
    try {
      const data = await authPublicConfig()
      config.value = data
      syncCryptoFromConfig(data)
      writeCachedConfig(data)
      loaded.value = true
      return data
    } catch {
      return config.value
    } finally {
      loading.value = false
    }
  }

  function getCodePolicyByTarget(target: string) {
    return target.includes('@') ? config.value?.emailPolicy : config.value?.smsPolicy
  }

  function getSendCodeIntervalSeconds(target: string): number {
    const sec = getCodePolicyByTarget(target)?.sendIntervalSeconds
    return typeof sec === 'number' && sec > 0 ? sec : 120
  }

  function getCodeMaxLength(target: string): number {
    const len = getCodePolicyByTarget(target)?.codeLength
    return typeof len === 'number' && len > 0 ? len : 6
  }

  return {
    config,
    loading,
    loaded,
    captchaEnabled,
    captchaType,
    cryptoEnabled,
    loadPublicConfig,
    getSendCodeIntervalSeconds,
    getCodeMaxLength
  }
}
