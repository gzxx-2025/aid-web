import { computed, ref } from 'vue'
import type { AuthPublicConfigData } from '~/types/business-api'
import { authPublicConfig } from '~/utils/businessApi'
import { applyApiCryptoFromPublicConfig } from '~/utils/apiCrypto'

const STORAGE_KEY = 'auth:public-config:v2'

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

  const recordFilingNumber = computed(() => {
    const n = config.value?.basic?.record_filing_number
    return typeof n === 'string' && n.trim() ? n.trim() : ''
  })

  const termsOfServiceUrl = computed(() => {
    const url = config.value?.basic?.terms_of_service
    return typeof url === 'string' && url.trim() ? url.trim() : ''
  })

  const privacyPolicyUrl = computed(() => {
    const url = config.value?.basic?.privacy_policy
    return typeof url === 'string' && url.trim() ? url.trim() : ''
  })

  const exchangeImageUrl = computed(() => {
    const url = config.value?.basic?.exchange_image_url
    return typeof url === 'string' && url.trim() ? url.trim() : ''
  })

  /** POST /auth/public-config → basic.service_email */
  const serviceEmail = computed(() => {
    const email = config.value?.basic?.service_email
    return typeof email === 'string' && email.trim() ? email.trim() : ''
  })

  /** POST /auth/public-config → basic.business_email */
  const businessEmail = computed(() => {
    const email = config.value?.basic?.business_email
    return typeof email === 'string' && email.trim() ? email.trim() : ''
  })

  /** POST /auth/public-config → basic.contact_phone */
  const contactPhone = computed(() => {
    const phone = config.value?.basic?.contact_phone
    return typeof phone === 'string' && phone.trim() ? phone.trim() : ''
  })

  /** POST /auth/public-config → promotion.registerBonus.amount（开启且有效时返回格式化金额，否则空） */
  const registerBonusAmountText = computed(() => {
    const bonus = config.value?.promotion?.registerBonus
    if (bonus?.enabled !== true) return ''
    const raw = bonus.amount
    const amount = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(amount) || amount <= 0) return ''
    return Number.isInteger(amount) ? String(amount) : String(parseFloat(amount.toFixed(2)))
  })

  /** 视觉引导角标文案：有金额时「注册即送{n}积分」，否则「注册即送积分」 */
  const registerBonusBadgeText = computed(() => {
    const amountText = registerBonusAmountText.value
    return amountText ? `注册即送${amountText}积分` : '注册即送积分'
  })

  /** POST /auth/public-config → promotion.invite.enabled */
  const invitePromotionEnabled = computed(() => config.value?.promotion?.invite?.enabled === true)

  /** POST /auth/public-config → promotion.invite.rebateRatio（缺省 10） */
  const inviteRebateRatioText = computed(() => {
    const n = Number(config.value?.promotion?.invite?.rebateRatio)
    return Number.isFinite(n) ? String(n) : '10'
  })

  const tutorialUrl = computed(() => {
    const url = config.value?.basic?.tutorial_url
    return typeof url === 'string' && url.trim() ? url.trim() : ''
  })

  const openSourceGiteeUrl = computed(() => {
    const url = config.value?.basic?.open_source_gitee_url
    return typeof url === 'string' && url.trim() ? url.trim() : ''
  })

  const openSourceGitUrl = computed(() => {
    const url = config.value?.basic?.open_source_git_url
    return typeof url === 'string' && url.trim() ? url.trim() : ''
  })

  const wechatNotifySystemEnabled = computed(() => config.value?.wechatNotify?.enabled === true)

  const wechatNotifyRules = computed(() => {
    const rules = config.value?.wechatNotify?.rules
    return Array.isArray(rules) ? rules : []
  })

  const voicePreviewEstimatedMaxChars = computed(() => {
    const n = config.value?.voicePreview?.estimatedMaxChars
    return typeof n === 'number' && n > 0 ? n : 15
  })

  /** POST /auth/public-config → payment.alipayEnabled */
  const alipayEnabled = computed(() => config.value?.payment?.alipayEnabled === true)

  /** POST /auth/public-config → payment.wxpayEnabled */
  const wxpayEnabled = computed(() => config.value?.payment?.wxpayEnabled === true)

  /** 任一支付渠道可用 */
  const anyPaymentEnabled = computed(() => alipayEnabled.value || wxpayEnabled.value)

  /** 收银台默认支付方式：优先支付宝，其次微信；皆不可用时为 null */
  const defaultPayType = computed<'alipay' | 'wxpay' | null>(() => {
    if (alipayEnabled.value) return 'alipay'
    if (wxpayEnabled.value) return 'wxpay'
    return null
  })

  async function loadPublicConfig(force = false): Promise<AuthPublicConfigData | null> {
    if (!import.meta.client) return null
    if (!force && !config.value) {
      const cached = readCachedConfig()
      if (cached) {
        config.value = cached
        syncCryptoFromConfig(cached)
      }
    }
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
    recordFilingNumber,
    termsOfServiceUrl,
    privacyPolicyUrl,
    exchangeImageUrl,
    serviceEmail,
    businessEmail,
    contactPhone,
    registerBonusAmountText,
    registerBonusBadgeText,
    invitePromotionEnabled,
    inviteRebateRatioText,
    tutorialUrl,
    openSourceGiteeUrl,
    openSourceGitUrl,
    wechatNotifySystemEnabled,
    wechatNotifyRules,
    voicePreviewEstimatedMaxChars,
    alipayEnabled,
    wxpayEnabled,
    anyPaymentEnabled,
    defaultPayType,
    loadPublicConfig,
    getSendCodeIntervalSeconds,
    getCodeMaxLength
  }
}
