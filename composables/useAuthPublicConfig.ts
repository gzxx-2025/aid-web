import { computed, ref } from 'vue'
import type { AuthPublicConfigData } from '~/types/business-api'
import { authPublicConfig } from '~/utils/businessApi'
import { applyApiCryptoFromPublicConfig } from '~/utils/apiCrypto'

const STORAGE_KEY = 'auth:public-config:v3'

/** 全局共享，保证各处 Logo / SEO / 开关读到同一份 public-config */
const sharedConfig = ref<AuthPublicConfigData | null>(null)
const sharedLoading = ref(false)
const sharedLoaded = ref(false)

function trimConfigText(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
}

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

function hydrateSharedFromCache() {
  if (sharedConfig.value || !import.meta.client) return
  const cached = readCachedConfig()
  if (!cached) return
  sharedConfig.value = cached
  sharedLoaded.value = true
  syncCryptoFromConfig(cached)
}

/** 启动插件 / 其它入口写入公开配置（同步内存 + sessionStorage + crypto） */
export function setAuthPublicConfigData(data: AuthPublicConfigData) {
  sharedConfig.value = data
  sharedLoaded.value = true
  syncCryptoFromConfig(data)
  writeCachedConfig(data)
}

/** 登录页首屏公开配置：验证码开关、发码策略、品牌与 SEO 等（与 /auth/public-config 对齐） */
export function useAuthPublicConfig() {
  hydrateSharedFromCache()

  const config = sharedConfig
  const loading = sharedLoading
  const loaded = sharedLoaded

  if (config.value) syncCryptoFromConfig(config.value)

  const captchaEnabled = computed(() => {
    const c = config.value?.captcha
    if (!c?.enabled) return false
    if (c.imagesReady === false || c.applicationOk === false) return false
    return true
  })

  const captchaType = computed(() => config.value?.captcha?.type ?? 'SLIDER')

  const cryptoEnabled = computed(() =>
    Boolean(config.value?.crypto?.enabled && config.value?.crypto?.publicKey)
  )

  /** POST /auth/public-config → login.smsEnabled */
  const smsLoginEnabled = computed(() => config.value?.login?.smsEnabled === true)

  /** POST /auth/public-config → login.emailEnabled */
  const emailLoginEnabled = computed(() => config.value?.login?.emailEnabled === true)

  /** POST /auth/public-config → login.wechatEnabled */
  const wechatLoginEnabled = computed(() => config.value?.login?.wechatEnabled === true)

  /** POST /auth/public-config → basic.site_name */
  const siteName = computed(() => trimConfigText(config.value?.basic?.site_name))

  /** POST /auth/public-config → basic.site_description */
  const siteDescription = computed(() => trimConfigText(config.value?.basic?.site_description))

  /** POST /auth/public-config → basic.site_keywords */
  const siteKeywords = computed(() => trimConfigText(config.value?.basic?.site_keywords))

  const recordFilingNumber = computed(() => trimConfigText(config.value?.basic?.record_filing_number))

  const termsOfServiceUrl = computed(() => trimConfigText(config.value?.basic?.terms_of_service))

  const privacyPolicyUrl = computed(() => trimConfigText(config.value?.basic?.privacy_policy))

  /** POST /auth/public-config → basic.membership_agreement */
  const membershipAgreementUrl = computed(() =>
    trimConfigText(config.value?.basic?.membership_agreement)
  )

  const exchangeImageUrl = computed(() => trimConfigText(config.value?.basic?.exchange_image_url))

  /** POST /auth/public-config → basic.service_email */
  const serviceEmail = computed(() => trimConfigText(config.value?.basic?.service_email))

  /** POST /auth/public-config → basic.business_email */
  const businessEmail = computed(() => trimConfigText(config.value?.basic?.business_email))

  /** POST /auth/public-config → basic.contact_phone */
  const contactPhone = computed(() => trimConfigText(config.value?.basic?.contact_phone))

  /** POST /auth/public-config → brand.platformLogoUrl */
  const platformLogoUrl = computed(() => trimConfigText(config.value?.brand?.platformLogoUrl))

  /** POST /auth/public-config → brand.faviconUrl */
  const faviconUrl = computed(() => trimConfigText(config.value?.brand?.faviconUrl))

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

  const tutorialUrl = computed(() => trimConfigText(config.value?.basic?.tutorial_url))

  const openSourceGiteeUrl = computed(() =>
    trimConfigText(config.value?.basic?.open_source_gitee_url)
  )

  const openSourceGitUrl = computed(() => trimConfigText(config.value?.basic?.open_source_git_url))

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
      hydrateSharedFromCache()
    }
    if (!force && config.value) {
      loaded.value = true
      return config.value
    }
    loading.value = true
    try {
      const data = await authPublicConfig()
      setAuthPublicConfigData(data)
      return data
    } catch {
      return config.value
    } finally {
      loading.value = false
    }
  }

  function getCodePolicy(channel: 'sms' | 'email') {
    return channel === 'email' ? config.value?.emailPolicy : config.value?.smsPolicy
  }

  function getSendCodeIntervalSeconds(channel: 'sms' | 'email'): number {
    const sec = getCodePolicy(channel)?.sendIntervalSeconds
    return typeof sec === 'number' && sec > 0 ? sec : 120
  }

  function getCodeMaxLength(channel: 'sms' | 'email'): number {
    const len = getCodePolicy(channel)?.codeLength
    return typeof len === 'number' && len > 0 ? len : 6
  }

  return {
    config,
    loading,
    loaded,
    captchaEnabled,
    captchaType,
    cryptoEnabled,
    smsLoginEnabled,
    emailLoginEnabled,
    wechatLoginEnabled,
    siteName,
    siteDescription,
    siteKeywords,
    recordFilingNumber,
    termsOfServiceUrl,
    privacyPolicyUrl,
    membershipAgreementUrl,
    exchangeImageUrl,
    serviceEmail,
    businessEmail,
    contactPhone,
    platformLogoUrl,
    faviconUrl,
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
