<template>
  <div class="login-page">
    <video
      ref="loginBgVideoRef"
      class="login-bg-video"
      :src="loginVideoBgUrl"
      autoplay
      muted
      loop
      playsinline
      preload="auto"
      disablepictureinpicture
      controlslist="nodownload noplaybackrate nofullscreen noremoteplayback"
      aria-hidden="true"
    />
    <div class="login-mask" />

    <main class="login-panel">
      <section class="login-left">
        <div class="login-form-card">
          <div>
            <img :src="logoUrl" class="login-logo" width="111" height="43" alt="AID" />
            <a-form
              :model="quickLoginForm"
              layout="vertical"
              class="login-form"
              autocomplete="off"
              @finish="handleFinish"
              @finishFailed="handleFinishFailed"
            >
              <!-- 吸收浏览器自动填充，避免污染真实输入框 -->
              <input
                type="text"
                name="username"
                tabindex="-1"
                autocomplete="username"
                aria-hidden="true"
                class="login-autofill-trap"
              />
              <input
                type="password"
                name="password"
                tabindex="-1"
                autocomplete="current-password"
                aria-hidden="true"
                class="login-autofill-trap"
              />
              <div class="login-form-stack">
                <!-- 绝对定位在 Tab+输入区上方，不占文档流 -->
                <div id="login-captcha-box" class="login-captcha-box" aria-hidden="true" />
                <div class="form-tabs">
                  <button
                    type="button"
                    class="form-tab"
                    :class="{ active: activeFormTab === 'code' }"
                    @click="activeFormTab = 'code'"
                  >
                    手机/邮箱
                  </button>
                  <button
                    type="button"
                    class="form-tab"
                    :class="{ active: activeFormTab === 'password' }"
                    @click="activeFormTab = 'password'"
                  >
                    账号密码
                  </button>
                </div>
              </div>
              <a-form-item
                name="account"
                :rules="[{ required: true, message: '请输入手机号或邮箱' }]"
              >
                <a-input
                  v-model:value="quickLoginForm.account"
                  size="large"
                  placeholder="请输入手机号或邮箱"
                  class="login-input"
                  autocomplete="off"
                  name="login-account"
                  readonly
                  data-lpignore="true"
                  data-1p-ignore
                  @focus="clearLoginInputReadonly"
                  @mousedown="clearLoginInputReadonly"
                >
                  <template #prefix>
                    <span class="input-prefix-wrap">
                      <img :src="accountIcon" alt="" class="input-prefix-icon" />
                      <span class="input-prefix-divider" />
                    </span>
                  </template>
                </a-input>
              </a-form-item>
              <a-form-item
                v-if="activeFormTab === 'code'"
                name="code"
                :rules="[{ required: true, message: '请输入验证码' }]"
              >
                <div class="code-row">
                  <a-input
                    v-model:value="quickLoginForm.code"
                    size="large"
                    placeholder="请输入验证码"
                    class="login-input"
                    :maxlength="loginCodeMaxLength"
                    autocomplete="off"
                    name="login-code"
                    inputmode="numeric"
                    readonly
                    data-lpignore="true"
                    data-1p-ignore
                    @focus="clearLoginInputReadonly"
                    @mousedown="clearLoginInputReadonly"
                  >
                    <template #prefix>
                      <span class="input-prefix-wrap">
                        <img :src="veriIconUrl" alt="" class="input-prefix-icon" />
                        <span class="input-prefix-divider" />
                      </span>
                    </template>
                  </a-input>
                  <a-button
                    class="code-btn"
                    :disabled="quickSendCodeLoading || quickSendCodeCountdown > 0 || captchaOpening"
                    :loading="quickSendCodeLoading || captchaOpening"
                    @click="handleSendQuickLoginCode"
                  >
                    {{ quickSendCodeCountdown > 0 ? `${quickSendCodeCountdown}s` : '获取验证码' }}
                  </a-button>
                </div>
              </a-form-item>
              <a-form-item
                v-else
                name="password"
                :rules="[{ required: true, message: '请输入密码' }]"
              >
                <a-input-password
                  v-model:value="quickLoginForm.password"
                  size="large"
                  placeholder="请输入密码"
                  class="login-input"
                  autocomplete="new-password"
                  name="login-password"
                  readonly
                  data-lpignore="true"
                  data-1p-ignore
                  @focus="clearLoginInputReadonly"
                  @mousedown="clearLoginInputReadonly"
                >
                  <template #prefix>
                    <span class="input-prefix-wrap">
                      <img :src="veriIconUrl" alt="" class="input-prefix-icon" />
                      <span class="input-prefix-divider" />
                    </span>
                  </template>
                </a-input-password>
              </a-form-item>
              <a-form-item name="inviteCode" class="invite-code-item">
                <a-input
                  v-model:value="quickLoginForm.inviteCode"
                  size="large"
                  placeholder="邀请码（选填）"
                  class="login-input"
                  :maxlength="8"
                  autocomplete="off"
                  name="login-invite"
                  @blur="checkInviteCode"
                >
                  <template #prefix>
                    <span class="input-prefix-wrap">
                      <img :src="inviteIconUrl" alt="" class="input-prefix-icon" />
                      <span class="input-prefix-divider" />
                    </span>
                  </template>
                </a-input>
                <p v-if="inviteHint" class="invite-hint" :class="{ 'is-valid': inviteCheckValid }">
                  {{ inviteHint }}
                </p>
              </a-form-item>
              <a-form-item name="agreement" class="agreement-form-item" :rules="agreementRules">
                <a-checkbox v-model:checked="quickLoginForm.agreement">
                  <span class="agreement-text">
                    我已阅读并同意<a
                      v-if="termsOfServiceUrl"
                      :href="termsOfServiceUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="agreement-link"
                      @click.stop
                    >《用户协议》</a><span v-else>《用户协议》</span>和<a
                      v-if="privacyPolicyUrl"
                      :href="privacyPolicyUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="agreement-link"
                      @click.stop
                    >《隐私政策》</a><span v-else>《隐私政策》</span>，未注册的手机号将自动创建账号
                  </span>
                </a-checkbox>
              </a-form-item>
              <a-form-item class="submit-item">
                <a-button
                  type="primary"
                  html-type="submit"
                  class="submit-btn"
                  block
                  size="large"
                  :loading="loading || captchaOpening"
                  :disabled="captchaOpening"
                >
                  登录/注册
                </a-button>
              </a-form-item>
            </a-form>
          </div>
        </div>
      </section>

      <section class="wechat-section">
        <p class="wechat-title">微信扫码登录</p>
        <div
          class="wechat-qr-wrap"
          :class="{
            'is-loading': !wechatQrUrl,
            'is-expired': wechatQrExpired,
            'is-scanned': wechatStatus === 'SCANNED'
          }"
        >
          <img v-if="wechatQrUrl" :src="wechatQrUrl" alt="微信登录二维码" class="wechat-qr" />
          <div v-else class="wechat-loading">
            <div class="qr-loading-ring">
              <div class="qr-loading-spinner" />
              <div class="qr-loading-inner">
                <div class="qr-loading-mini-qr">
                  <div class="mini-square top-left" />
                  <div class="mini-square top-right" />
                  <div class="mini-square bottom-left" />
                  <div class="mini-square bottom-right" />
                </div>
              </div>
            </div>
            <div class="qr-loading-text">正在获取二维码…</div>
            <div class="qr-loading-subtext">请在微信中扫描登录</div>
          </div>
          <div v-if="wechatStatus === 'SCANNED'" class="wechat-scanned-overlay">
            <span class="wechat-status-spinner" aria-hidden="true" />
            <span>已扫码，登录处理中</span>
          </div>
          <button
            v-if="wechatQrUrl"
            type="button"
            class="wechat-qr-refresh-overlay"
            :disabled="wechatLoading || wechatStatus === 'SCANNED' || wechatStatus === 'SUCCESS'"
            :aria-busy="wechatLoading"
            @click="openWechatLogin"
          >
            <span class="wechat-qr-refresh-overlay__text">{{
              wechatLoading
                ? '刷新中...'
                : wechatStatus === 'FAIL'
                  ? '登录失败，点击刷新'
                  : wechatQrExpired
                    ? '二维码已过期，点击刷新'
                    : '刷新二维码'
            }}</span>
          </button>
        </div>
        <div
          v-if="showWechatBottomStatus"
          class="wechat-status"
          :class="`is-${wechatStatus.toLowerCase()}`"
          role="status"
          aria-live="polite"
        >
          <span class="wechat-status__indicator" aria-hidden="true">
            <span
              v-if="wechatStatus === 'LOADING' || wechatStatus === 'SCANNED'"
              class="wechat-status-spinner"
            />
          </span>
          <span class="wechat-status__text">{{ wechatStatusText }}</span>
          <button v-if="wechatStatus === 'EXPIRED' || wechatStatus === 'FAIL'" class="wechat-status__retry" type="button" @click="openWechatLogin">重新获取</button>
        </div>
      </section>
    </main>

    <footer v-if="recordFilingNumber" class="login-icp-footer">
      <a
        href="https://beian.miit.gov.cn"
        target="_blank"
        rel="noopener noreferrer"
        class="login-icp-link"
      >
        {{ recordFilingNumber }}
      </a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { LoginData } from '~/types/business-api'
import { useAuthPublicConfig } from '~/composables/useAuthPublicConfig'
import { useBehaviorCaptcha } from '~/composables/useBehaviorCaptcha'
import { useTacPageHead } from '~/composables/useTacPageHead'
import { authLogin, authSendCode, userInviteCheck, wechatLoginCheck, wechatLoginQrcode } from '~/utils/businessApi'
import { setAuthLoginChannel, type AuthLoginChannel } from '~/utils/authLoginChannel'
import { normalizeInviteCode, withLoginInviteCode } from '~/utils/authLoginInvite'
import { clearPendingCaptchaToken, setPendingCaptchaToken } from '~/utils/captchaToken'
import { mapLoginDataToUser } from '~/utils/userProfile'
import logoUrl from '~/assets/img/home/logo.svg'
import loginVideoBgUrl from '~/assets/img/login/login-video-bg.mp4'
import numberIconUrl from '~/assets/img/login/number.svg'
import veriIconUrl from '~/assets/img/login/veri.svg'
import peopleIconUrl from '~/assets/img/login/pepole.svg'
import inviteIconUrl from '~/assets/img/icon/invitation_code.svg'

definePageMeta({
  layout: false
})

// 显式引入 static/tac 下的行为验证码样式与脚本（映射为 /tac/css/tac.css、/tac/js/tac.min.js）
useTacPageHead()

useHead({
  htmlAttrs: {
    class: 'app-shell-login'
  }
})

const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

const {
  captchaEnabled,
  captchaType,
  recordFilingNumber,
  termsOfServiceUrl,
  privacyPolicyUrl,
  loadPublicConfig,
  getSendCodeIntervalSeconds,
  getCodeMaxLength
} = useAuthPublicConfig()
const {
  opening: captchaOpening,
  openBehaviorCaptcha,
  destroyActive: destroyCaptcha
} = useBehaviorCaptcha()

const loading = ref(false)

const wechatQrUrl = ref('')
const wechatLoading = ref(false)
type WechatUiStatus = 'LOADING' | 'WAITING' | 'SCANNED' | 'SUCCESS' | 'EXPIRED' | 'FAIL'
const wechatStatus = ref<WechatUiStatus>('LOADING')
const wechatStatusMessage = ref('正在获取二维码')
const wechatStatusText = computed(() => wechatStatusMessage.value || '')
/**
 * 底部状态区：仅展示二维码区域内尚未传达的信息。
 * 加载中 / 已扫码 / 过期·失败且遮罩可点刷新 时，文案已在二维码上，底部不再重复。
 */
const showWechatBottomStatus = computed(() => {
  const status = wechatStatus.value
  if (status === 'WAITING' || status === 'LOADING' || status === 'SCANNED') return false
  if ((status === 'EXPIRED' || status === 'FAIL') && wechatQrUrl.value) return false
  return true
})
/** 二维码已过期：遮罩常显，引导点击刷新（对齐 /auth/wechat/check 的 EXPIRED） */
const wechatQrExpired = ref(false)
let wechatPollTimer: ReturnType<typeof setInterval> | null = null
let wechatExpireTimer: ReturnType<typeof setTimeout> | null = null
let wechatPollSession = 0
const quickSendCodeLoading = ref(false)
const LOGIN_SEND_CODE_COUNTDOWN_SCOPE = 'login-send-code'
const {
  remaining: quickSendCodeCountdown,
  start: startQuickSendCodeCountdown,
  restore: restoreQuickSendCodeCountdown,
  stop: stopQuickSendCodeCountdown
} = usePersistedCountdown(LOGIN_SEND_CODE_COUNTDOWN_SCOPE)
const activeFormTab = ref<'code' | 'password'>('code')
const accountIcon = computed(() =>
  activeFormTab.value === 'password' ? peopleIconUrl : numberIconUrl
)

/** 阻止浏览器自动填充：初始 readonly，聚焦/点击后解除 */
function clearLoginInputReadonly(e: FocusEvent | MouseEvent | TouchEvent) {
  const target = e.target
  if (target instanceof HTMLInputElement) {
    target.removeAttribute('readonly')
    return
  }
  if (target instanceof HTMLElement) {
    const input = target.closest('.ant-input-affix-wrapper, .ant-input-password')?.querySelector('input')
    if (input instanceof HTMLInputElement) input.removeAttribute('readonly')
  }
}

const loginCodeMaxLength = computed(() => {
  const account = quickLoginForm.account.trim()
  if (!account) return 6
  return getCodeMaxLength(account)
})
const quickLoginForm = reactive({
  account: '',
  code: '',
  password: '',
  inviteCode: '',
  agreement: false
})

const inviteHint = ref('')
const inviteCheckValid = ref(false)
/** 当前微信扫码会话已绑定的邀请码（用于变更后重新拉码） */
let wechatInviteBound = ''
let inviteCheckTimer: ReturnType<typeof setTimeout> | null = null
let inviteWechatRefreshTimer: ReturnType<typeof setTimeout> | null = null
/** 首屏 onMounted 拉码完成前，忽略邀请码 watch 触发的重复刷新 */
const loginPageReady = ref(false)

function normalizedInviteCode(): string | undefined {
  return normalizeInviteCode(quickLoginForm.inviteCode)
}

async function checkInviteCode() {
  const code = normalizedInviteCode()
  if (!code) {
    inviteHint.value = ''
    inviteCheckValid.value = false
    return
  }
  try {
    const data = await userInviteCheck({ inviteCode: code })
    if (data.valid) {
      inviteCheckValid.value = true
      inviteHint.value = data.inviterNickName
        ? `您正在接受 ${data.inviterNickName} 的邀请`
        : '邀请码有效'
    } else {
      inviteCheckValid.value = false
      inviteHint.value = data.reason || '邀请码无效（注册时将忽略）'
    }
  } catch {
    inviteCheckValid.value = false
    inviteHint.value = ''
  }
}

/** 邀请码变更后需重新获取二维码，否则扫码会话仍是旧的无码会话 */
function scheduleWechatQrRefreshForInvite() {
  if (inviteWechatRefreshTimer) clearTimeout(inviteWechatRefreshTimer)
  inviteWechatRefreshTimer = setTimeout(() => {
    inviteWechatRefreshTimer = null
    const next = normalizedInviteCode() || ''
    if (next === wechatInviteBound) return
    if (wechatStatus.value === 'SCANNED' || wechatStatus.value === 'SUCCESS') return
    void openWechatLogin()
  }, 500)
}

watch(
  () => quickLoginForm.inviteCode,
  () => {
    if (inviteCheckTimer) clearTimeout(inviteCheckTimer)
    inviteCheckTimer = setTimeout(() => {
      void checkInviteCode()
    }, 400)
    if (loginPageReady.value) scheduleWechatQrRefreshForInvite()
  }
)

const agreementHint = '请先阅读并同意《用户协议》和《隐私政策》'

const agreementRules = [
  {
    validator: (_rule: unknown, value: boolean) => {
      if (value === true) return Promise.resolve()
      return Promise.reject(new Error(agreementHint))
    }
  }
]

function handleFinishFailed(errorInfo: {
  errorFields?: { name: (string | number)[]; errors: string[] }[]
}) {
  const hitAgreement = (errorInfo.errorFields ?? []).some((f) => {
    const n = f.name
    const key = Array.isArray(n) ? n[n.length - 1] : n
    return key === 'agreement'
  })
  if (hitAgreement) {
    message.warning(agreementHint)
  }
}

function completeLogin(data: LoginData, channel: AuthLoginChannel) {
  setAuthLoginChannel(channel)
  userStore.login(mapLoginDataToUser(data, quickLoginForm.account.trim()), data.token)
  void userStore.fetchProfile()
  message.success('登录成功', 2)
  void nextTick().then(() => router.push('/'))
}

function setWechatStatus(status: WechatUiStatus, text: string) {
  wechatStatus.value = status
  wechatStatusMessage.value = text
}

type WechatCheckPayload = {
  msg?: string
  data?: LoginData & { status?: string; expireSeconds?: number }
}

function parseWechatCheckPayload(input: unknown): WechatCheckPayload | null {
  const payload = input as WechatCheckPayload
  return payload?.data?.status ? payload : null
}

function stopWechatPoll() {
  wechatPollSession += 1
  if (wechatPollTimer) {
    clearInterval(wechatPollTimer)
    wechatPollTimer = null
  }
}

function clearWechatExpireTimer() {
  if (wechatExpireTimer) {
    clearTimeout(wechatExpireTimer)
    wechatExpireTimer = null
  }
}

/** 标记二维码过期并停止轮询，展示刷新入口 */
function markWechatQrExpired(text = '二维码已失效，请刷新重试') {
  stopWechatPoll()
  clearWechatExpireTimer()
  setWechatStatus('EXPIRED', text)
  if (wechatQrUrl.value) {
    wechatQrExpired.value = true
  }
}

function markWechatLoginFailed(text: string) {
  stopWechatPoll()
  clearWechatExpireTimer()
  setWechatStatus('FAIL', text || '登录失败，请刷新重试')
  wechatQrExpired.value = Boolean(wechatQrUrl.value)
}

/** 按接口返回的 expireSeconds 本地倒计时；到期后展示刷新（默认 300 秒） */
function scheduleWechatQrExpiry(expireSeconds?: number | null) {
  clearWechatExpireTimer()
  wechatQrExpired.value = false
  const sec =
    typeof expireSeconds === 'number' && Number.isFinite(expireSeconds) && expireSeconds > 0
      ? Math.floor(expireSeconds)
      : 300
  wechatExpireTimer = setTimeout(() => {
    markWechatQrExpired()
    wechatExpireTimer = null
  }, sec * 1000)
}

function isWechatQrExpiredPayload(err: unknown): boolean {
  const data = err as { msg?: string; message?: string; data?: { status?: string } }
  const status = String(data?.data?.status || '').toUpperCase()
  if (status === 'EXPIRED') return true
  const m = String(data?.msg ?? data?.message ?? '')
  return m.includes('失效') || m.includes('过期')
}

function applyWechatCheckPayload(payload: WechatCheckPayload) {
  const status = String(payload.data?.status || '').toUpperCase()
  if (status === 'WAITING') {
    setWechatStatus('WAITING', payload.msg || '请使用微信扫码')
    return
  }
  if (status === 'SCANNED') {
    setWechatStatus('SCANNED', payload.msg || '已扫码，登录处理中')
    return
  }
  if (status === 'EXPIRED') {
    markWechatQrExpired(payload.msg)
    return
  }
  if (status === 'FAIL') {
    markWechatLoginFailed(payload.msg || '登录失败，请刷新重试')
    return
  }
  if (status === 'SUCCESS' && payload.data?.token && payload.data.userInfo) {
    stopWechatPoll()
    clearWechatExpireTimer()
    setWechatStatus('SUCCESS', payload.msg || '登录成功，正在跳转')
    completeLogin(payload.data, 'wechat')
  }
}

function canRunWechatPolling() {
  return true
}

async function openWechatLogin() {
  if (!canRunWechatPolling()) return
  wechatLoading.value = true
  setWechatStatus('LOADING', '正在获取二维码')
  wechatQrExpired.value = false
  wechatQrUrl.value = ''
  clearWechatExpireTimer()
  stopWechatPoll()
  const currentSession = wechatPollSession
  const inviteForSession = normalizedInviteCode()
  try {
    const data = await wechatLoginQrcode(inviteForSession)
    if (!canRunWechatPolling() || currentSession !== wechatPollSession) return
    wechatInviteBound = inviteForSession || ''
    wechatQrUrl.value = data.qrCodeUrl
    wechatQrExpired.value = false
    setWechatStatus('WAITING', '请使用微信扫码')
    scheduleWechatQrExpiry(data.expireSeconds)
    const scene = data.sceneStr
    let ticks = 0
    let checkPending = false
    const maxTicks = 150
    wechatPollTimer = setInterval(async () => {
      if (!canRunWechatPolling() || currentSession !== wechatPollSession) {
        return
      }
      if (checkPending) return
      checkPending = true
      ticks += 1
      if (ticks > maxTicks) {
        markWechatQrExpired()
        return
      }
      try {
        const res = await wechatLoginCheck(scene)
        if (!canRunWechatPolling() || currentSession !== wechatPollSession) {
          return
        }
        const payload = parseWechatCheckPayload(res)
        if (payload) applyWechatCheckPayload(payload)
      } catch (err: unknown) {
        const payload = parseWechatCheckPayload(err)
        if (payload) {
          applyWechatCheckPayload(payload)
        } else if (isWechatQrExpiredPayload(err)) {
          markWechatQrExpired()
        }
      } finally {
        checkPending = false
      }
    }, 2000)
  } catch (e: any) {
    if (canRunWechatPolling()) {
      markWechatLoginFailed(e?.msg ?? e?.message ?? '获取微信二维码失败')
      message.error(e?.msg ?? e?.message ?? '获取微信二维码失败')
    }
  } finally {
    wechatLoading.value = false
  }
}

onUnmounted(() => {
  stopWechatPoll()
  clearWechatExpireTimer()
  stopQuickSendCodeCountdown()
  destroyCaptcha()
  clearPendingCaptchaToken()
  if (inviteCheckTimer) clearTimeout(inviteCheckTimer)
  if (inviteWechatRefreshTimer) clearTimeout(inviteWechatRefreshTimer)
})

/** 开启行为验证码时先滑块校验，token 写入队列后再调受保护接口 */
async function withCaptchaToken<T>(action: (captchaToken: string) => Promise<T>): Promise<T | null> {
  if (!captchaEnabled.value) {
    return action('')
  }
  if (captchaOpening.value) return null
  let result: T | null = null
  const captchaResult = await openBehaviorCaptcha({
    bindEl: '#login-captcha-box',
    captchaType: captchaType.value,
    onSuccess: async (token) => {
      setPendingCaptchaToken(token)
      result = await action(token)
    }
  })
  if (captchaResult.error) throw captchaResult.error
  if (!captchaResult.ok) return null
  return result
}

async function doSendQuickLoginCode(captchaToken: string) {
  const account = quickLoginForm.account.trim()
  await authSendCode(
    {
      target: account,
      codeType: inferCodeTypeByTarget(account),
      scene: 'login'
    },
    captchaToken || undefined
  )
  message.success('验证码已发送')
  startQuickSendCodeCountdown(account, getSendCodeIntervalSeconds(account))
}

async function handleSendQuickLoginCode() {
  const account = quickLoginForm.account.trim()
  if (!account) {
    message.warning('请先输入手机号或邮箱')
    return
  }
  if (quickSendCodeLoading.value || quickSendCodeCountdown.value > 0 || captchaOpening.value) return
  quickSendCodeLoading.value = true
  try {
    const sent = await withCaptchaToken(doSendQuickLoginCode)
    if (sent === null && captchaEnabled.value) return
  } catch (e: any) {
    message.error(e?.msg ?? e?.message ?? '发送验证码失败')
  } finally {
    quickSendCodeLoading.value = false
  }
}

async function doPasswordLogin(captchaToken: string, inviteCode?: string) {
  const data = await authLogin(
    withLoginInviteCode(
      {
        loginType: 'password',
        account: quickLoginForm.account.trim(),
        password: quickLoginForm.password
      },
      inviteCode ?? normalizedInviteCode()
    ),
    captchaToken || undefined
  )
  completeLogin(data, 'password')
}

async function doCodeLogin(inviteCode?: string) {
  // 短信/邮箱登录：人机校验仅在「获取验证码」时完成（见接口文档业务流程），登录不再携带 captcha-token
  const loginType = inferLoginTypeByTarget(quickLoginForm.account.trim())
  const data = await authLogin(
    withLoginInviteCode(
      {
        loginType,
        account: quickLoginForm.account.trim(),
        code: quickLoginForm.code.trim()
      },
      inviteCode ?? normalizedInviteCode()
    )
  )
  completeLogin(data, loginType)
}

const handleFinish = async (values?: Partial<typeof quickLoginForm>) => {
  if (!quickLoginForm.agreement) {
    message.warning(agreementHint)
    return
  }
  if (loading.value || captchaOpening.value) return
  // 优先用 Form @finish 回传值，避免输入框展示值与 model 不同步时漏传邀请码
  const inviteCode =
    normalizeInviteCode(values?.inviteCode) ?? normalizedInviteCode()
  if (inviteCode && quickLoginForm.inviteCode.trim() !== inviteCode) {
    quickLoginForm.inviteCode = inviteCode
  }
  loading.value = true
  try {
    if (activeFormTab.value === 'code') {
      await doCodeLogin(inviteCode)
      return
    }
    const loggedIn = await withCaptchaToken((token) => doPasswordLogin(token, inviteCode))
    if (loggedIn === null && captchaEnabled.value) return
  } catch (e: any) {
    message.error(e?.msg ?? e?.message ?? '登录失败')
  } finally {
    loading.value = false
  }
}

function inferCodeTypeByTarget(target: string): 'sms' | 'email' {
  return target.includes('@') ? 'email' : 'sms'
}

function inferLoginTypeByTarget(target: string): 'sms' | 'email' {
  return target.includes('@') ? 'email' : 'sms'
}

const loginBgVideoRef = ref<HTMLVideoElement | null>(null)

onMounted(() => {
  loadPublicConfig()
  const routeInvite = String(route.query.invite || route.query.inviteCode || '').trim()
  if (routeInvite) {
    quickLoginForm.inviteCode = routeInvite.slice(0, 8)
    void checkInviteCode()
  }
  void openWechatLogin().finally(() => {
    loginPageReady.value = true
  })
  restoreQuickSendCodeCountdown(quickLoginForm.account.trim())
  const v = loginBgVideoRef.value
  if (v) {
    v.muted = true
    v.play().catch(() => {})
  }
})

watch(
  () => quickLoginForm.account,
  (account) => {
    restoreQuickSendCodeCountdown(String(account || '').trim())
  }
)
</script>

<style lang="scss" scoped>
/* Tab + 输入区锚点；验证码浮层相对此区域定位在上方 */
.login-form-stack {
  position: relative;
  margin-bottom: 36px;
}

/* 仅控制挂载点位置，不覆盖 #tianai-captcha-* 内部样式 */
.login-captcha-box {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 12px);
  transform: translateX(-50%);
  z-index: 50;
  width: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
}

.login-captcha-box:has(#tianai-captcha-parent) {
  pointer-events: auto;
}

.login-page {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background-color: #0e1118;
}

/* 全屏背景视频：循环、静音、无控件条 */
.login-bg-video {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  border: 0;
}

.login-bg-video::-webkit-media-controls {
  display: none !important;
}

.login-bg-video::-webkit-media-controls-enclosure {
  display: none !important;
}

.login-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(0, 23, 49, 0.62) 0%, rgba(18, 18, 18, 0.84) 100%);
}

.login-panel {
  position: relative;
  z-index: 2;
  width: 100%;
  min-height: 560px;
  display: grid;
  grid-template-columns: 1.5fr 2fr;
  border-radius: 12px;
  overflow: hidden;
}

.login-left {
  height: 100%;
  background: rgba(17, 22, 33, 0.8);
  padding: 20px;
  display: flex;
  border-radius: 24px;
  align-items: center;
}

.login-form-card {
  width: 100%;
  height: 100%;
  padding: 120px 170px 28px;
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
}

.login-autofill-trap {
  position: absolute;
  width: 0;
  height: 0;
  padding: 0;
  margin: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}

.login-logo {
  width: 111px;
  height: auto;
  display: block;
  margin: 0 auto 80px;
  object-fit: contain;
}

.form-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  width: min(38%, 220px);
  min-width: 180px;
  flex-shrink: 0;
}

.form-tab {
  height: 36px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  background: transparent;
  cursor: pointer;
}

.form-tab.active {
  color: #fff;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
}

.login-form :deep(.ant-form-item) {
  margin-bottom: 16px;
}

.login-form :deep(.submit-item) {
  margin-top: 56px;
  margin-bottom: 0;
}
:deep(.ant-checkbox .ant-checkbox-inner) {
  background: transparent !important;
}
:deep(.ant-input) {
  height: 48px;
  border-radius: 8px;
  border: 1px solid rgba(142, 151, 165, 0.1);
  color: rgba(142, 151, 165, 1);
  background: rgba(142, 151, 165, 0.1);
}

.login-input :deep(.ant-input::placeholder) {
  color: rgba(142, 151, 165, 1);
}

.login-input :deep(.ant-input-affix-wrapper) {
  height: 48px;
  border-radius: 8px;
  border: 1px solid rgba(142, 151, 165, 0.1);
  background: rgba(142, 151, 165, 0.1);
}

.login-input :deep(.ant-input-password) {
  height: 48px;
  border-radius: 8px;
  border: 1px solid rgba(142, 151, 165, 0.1);
  background: rgba(142, 151, 165, 0.1);
}

.login-input :deep(.ant-input-password input) {
  color: rgba(142, 151, 165, 1);
}

.login-input :deep(.ant-input-password input::placeholder) {
  color: rgba(142, 151, 165, 1);
}

.input-prefix-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.input-prefix-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.input-prefix-divider {
  display: inline-block;
  width: 1px;
  height: 18px;
  background: rgba(142, 151, 165, 0.5);
}

.code-row {
  --login-code-btn-width: 118px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--login-code-btn-width);
  gap: 10px;
  align-items: stretch;
}

.code-row .login-input {
  min-width: 0;
  width: 100%;
}

.code-btn {
  width: 100%;
  min-width: 0 !important;
  height: 48px;
  padding: 0 8px;
  border-radius: 8px;
  border: none;
  color: #fff;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  &:hover {
    color: #ffff;
  }
}

.submit-btn {
  height: 48px;
  border-radius: 8px;
  border: 0;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.submit-btn:hover,
.submit-btn:focus,
.submit-btn:active {
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  color: #fff !important;
  border: 0 !important;
  box-shadow: none !important;
}

.agreement-form-item {
  position: absolute;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100% - 48px);
  margin-bottom: 0 !important;
  box-sizing: border-box;
  text-align: center;
}

.agreement-form-item :deep(.ant-form-item-control),
.agreement-form-item :deep(.ant-form-item-control-input),
.agreement-form-item :deep(.ant-form-item-control-input-content) {
  min-width: 0;
  min-height: 0;
  width: auto;
  max-width: 100%;
}

.agreement-form-item :deep(.ant-form-item-explain-error) {
  font-size: 12px;
  margin-top: 4px;
}

.agreement-form-item :deep(.ant-checkbox-wrapper) {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  text-align: left;
  font-size: 12px;
  color: rgba(142, 151, 165, 1);
  line-height: 1.5;
}

.invite-code-item {
  margin-bottom: 12px;
}

.invite-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: rgba(142, 151, 165, 1);
  line-height: 1.4;
}

.invite-hint.is-valid {
  color: #4ae7fd;
}
.agreement-text {
  color: rgba(142, 151, 165, 1);
  font-size: 14px;
}

.agreement-link {
  color: #4ae7fd;
  text-decoration: none;
}

.wechat-section {
  padding: 48px 52px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.wechat-title {
  margin: 0 0 16px;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.wechat-qr-wrap {
  position: relative;
  width: 270px;
  height: 270px;
  margin: 0 auto;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.wechat-qr-wrap.is-loading {
  border-color: rgba(74, 231, 253, 0.22);
  background:
    radial-gradient(circle at 20% 10%, rgba(74, 231, 253, 0.14), transparent 50%),
    radial-gradient(circle at 85% 85%, rgba(59, 130, 246, 0.16), transparent 55%),
    rgba(9, 13, 22, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 24px 48px rgba(0, 0, 0, 0.35);
}

.wechat-qr {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 10px;
}

.wechat-scanned-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(14, 17, 24, 0.76);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.wechat-status-spinner {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border: 2px solid rgba(74, 231, 253, 0.24);
  border-top-color: #4ae7fd;
  border-radius: 50%;
  animation: qr-spinner-rotate 0.9s linear infinite;
}

.wechat-status {
  width: 270px;
  min-height: 40px;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(226, 232, 240, 0.82);
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
}

.wechat-status__indicator {
  position: relative;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  display: grid;
  place-items: center;
}

.wechat-status__indicator::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ae7fd;
  box-shadow: 0 0 0 4px rgba(74, 231, 253, 0.12);
}

.wechat-status.is-loading .wechat-status__indicator::before,
.wechat-status.is-scanned .wechat-status__indicator::before {
  display: none;
}

.wechat-status.is-scanned {
  color: #fff;
}

.wechat-status.is-fail {
  color: #fca5a5;
}

.wechat-status.is-expired {
  color: #fca5a5;
}

.wechat-status__retry {
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #4ae7fd;
  font: inherit;
  cursor: pointer;
}

.wechat-status__text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.wechat-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #7f8a9a;
  font-size: 12px;
}

.qr-loading-ring {
  position: relative;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 20%, rgba(74, 231, 253, 0.25), transparent 55%),
    radial-gradient(circle at 80% 80%, rgba(37, 99, 235, 0.45), transparent 55%), rgba(9, 13, 22, 1);
  box-shadow:
    0 0 0 1px rgba(74, 231, 253, 0.3),
    0 10px 22px rgba(3, 7, 18, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: qr-ring-pulse 2.4s ease-in-out infinite;
}

.qr-loading-spinner {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  border: 2px solid rgba(34, 197, 235, 0.15);
  border-top-color: rgba(74, 231, 253, 0.9);
  border-right-color: rgba(59, 130, 246, 0.8);
  box-shadow: 0 0 18px rgba(74, 231, 253, 0.55);
  animation: qr-spinner-rotate 1.5s linear infinite;
}

.qr-loading-inner {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.88));
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.35),
    0 12px 20px rgba(15, 23, 42, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.qr-loading-mini-qr {
  position: relative;
  width: 58px;
  height: 58px;
  border-radius: 10px;
  background: repeating-linear-gradient(
    45deg,
    rgba(15, 23, 42, 1),
    rgba(15, 23, 42, 1) 6px,
    rgba(30, 64, 175, 0.9) 6px,
    rgba(30, 64, 175, 0.9) 7px
  );
  box-shadow:
    inset 0 0 0 1px rgba(148, 163, 184, 0.55),
    0 0 0 1px rgba(15, 23, 42, 1);
  overflow: hidden;
}

.mini-square {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 2px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 1);
}

.mini-square::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 3px;
  background: radial-gradient(circle at 30% 30%, #4ae7fd, #1e40af);
}

.mini-square.top-left {
  top: 6px;
  left: 6px;
}

.mini-square.top-right {
  top: 6px;
  right: 6px;
}

.mini-square.bottom-left {
  bottom: 6px;
  left: 6px;
}

.mini-square.bottom-right {
  bottom: 6px;
  right: 6px;
}

.qr-loading-text {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(226, 232, 240, 0.92);
}

.qr-loading-subtext {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.9);
}

@keyframes qr-spinner-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes qr-ring-pulse {
  0% {
    transform: scale(1);
    box-shadow:
      0 0 0 0 rgba(74, 231, 253, 0.25),
      0 10px 22px rgba(3, 7, 18, 0.75);
  }
  70% {
    transform: scale(1.02);
    box-shadow:
      0 0 0 10px rgba(74, 231, 253, 0),
      0 18px 30px rgba(3, 7, 18, 0.9);
  }
  100% {
    transform: scale(1);
    box-shadow:
      0 0 0 0 rgba(74, 231, 253, 0),
      0 10px 22px rgba(3, 7, 18, 0.75);
  }
}

/* 悬停二维码区域时显示遮罩与「刷新二维码」；过期后常显 */
.wechat-qr-refresh-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 12px;
  border: none;
  border-radius: inherit;
  background: rgba(14, 17, 24, 0.62);
  color: #4ae7fd;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease, background 0.2s ease;
}

.wechat-qr-refresh-overlay__text {
  text-align: center;
  line-height: 1.35;
  max-width: 160px;
}

.wechat-qr-wrap:hover .wechat-qr-refresh-overlay:not(:disabled),
.wechat-qr-wrap:focus-within .wechat-qr-refresh-overlay:not(:disabled),
.wechat-qr-wrap.is-expired .wechat-qr-refresh-overlay:not(:disabled) {
  opacity: 1;
  pointer-events: auto;
}

.wechat-qr-wrap.is-expired .wechat-qr-refresh-overlay {
  background: rgba(14, 17, 24, 0.72);
}

.wechat-qr-wrap.is-expired .wechat-qr {
  filter: brightness(0.55);
}

.wechat-qr-refresh-overlay:disabled {
  cursor: wait;
  opacity: 0;
  pointer-events: none;
}

.wechat-qr-wrap.is-expired .wechat-qr-refresh-overlay:disabled {
  opacity: 1;
  pointer-events: none;
}

.wechat-qr-refresh-overlay:focus-visible {
  opacity: 1;
  pointer-events: auto;
  outline: 2px solid rgba(74, 231, 253, 0.85);
  outline-offset: -2px;
}

.login-icp-footer {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
}

.login-icp-link {
  color: #fff;
  font-size: 12px;
  line-height: 1.5;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.85;
    text-decoration: underline;
  }
}

/* 触屏设备无 hover：保留底部弱提示，仍可点击整区刷新；过期态保持居中常显 */
@media (hover: none) {
  .wechat-qr-refresh-overlay {
    opacity: 1;
    pointer-events: auto;
    background: linear-gradient(
      180deg,
      transparent 0%,
      transparent 45%,
      rgba(14, 17, 24, 0.78) 100%
    );
    align-items: flex-end;
    padding-bottom: 20px;
    font-size: 13px;
    font-weight: 500;
  }

  .wechat-qr-wrap.is-expired .wechat-qr-refresh-overlay {
    align-items: center;
    padding-bottom: 12px;
    background: rgba(14, 17, 24, 0.72);
    font-size: 15px;
    font-weight: 600;
  }
}

/* Ant Design input hard overrides
 * 字号必须写在本页并走 pxtorem：node_modules 内 ant 样式为固定 px，
 * 小屏根字号 13/12px 时框高会缩、文字不缩，导致 placeholder/正文撑满输入框。
 */
.login-form :deep(.ant-input-affix-wrapper),
.login-form :deep(.ant-input-password) {
  height: 48px !important;
  border-radius: 8px !important;
  border: 1px solid rgba(142, 151, 165, 0.1) !important;
  background: rgba(142, 151, 165, 0.1) !important;
  color: rgba(142, 151, 165, 1) !important;
  font-size: 16px !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: center !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.login-form :deep(.ant-input),
.login-form :deep(.ant-input-lg),
.login-form :deep(.ant-input-affix-wrapper-lg) {
  font-size: 16px !important;
}

.login-form :deep(.ant-input) {
  height: 48px !important;
  line-height: 48px !important;
  color: rgba(142, 151, 165, 1) !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  padding-left: 12px;
}

.login-form :deep(.ant-input-affix-wrapper .ant-input),
.login-form :deep(.ant-input-password .ant-input) {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  font-size: inherit !important;
}

.login-form :deep(.ant-input::placeholder),
.login-form :deep(.ant-input-password input::placeholder) {
  color: rgba(142, 151, 165, 1) !important;
  font-size: inherit !important;
}

.login-form :deep(.ant-input-affix-wrapper:hover),
.login-form :deep(.ant-input-affix-wrapper-focused),
.login-form :deep(.ant-input-affix-wrapper:focus),
.login-form :deep(.ant-input-affix-wrapper:focus-within),
.login-form :deep(.ant-input:hover),
.login-form :deep(.ant-input:focus) {
  border-color: rgba(142, 151, 165, 0.35) !important;
  background: rgba(142, 151, 165, 0.12) !important;
  box-shadow: none !important;
}

.login-form :deep(.ant-input-prefix),
.login-form :deep(.ant-input-suffix) {
  color: rgba(142, 151, 165, 1) !important;
  display: inline-flex !important;
  align-items: center !important;
  height: 100% !important;
}

.login-form :deep(.ant-input-password-icon) {
  color: #fff !important;
}

.login-form :deep(.ant-input-password-icon:hover),
.login-form :deep(.ant-input-password-icon:focus) {
  color: #fff !important;
}

/* Ensure 100% height chain is effective */
.login-page {
  height: 100vh;
  box-sizing: border-box;
}

.login-panel {
  height: 100%;
}

.login-left {
  height: 100%;
  box-sizing: border-box;
}

.login-form-card {
  min-height: 100%;
}

.wechat-section {
  height: 100%;
  box-sizing: border-box;
}

@media (max-width: 520px) {
  .login-panel {
    grid-template-columns: 1fr;
    width: calc(100vw - 16px);
    min-height: auto;
    height: auto;
  }

  .login-left,
  .wechat-section {
    padding: 20px 14px;
  }

  .login-form-card {
    padding: 28px 20px 18px;
  }

  .form-tabs {
    width: 100%;
    min-width: 0;
  }

  .agreement-form-item {
    position: static;
    left: auto;
    bottom: auto;
    transform: none;
    width: 100%;
    max-width: none;
    margin-top: 18px !important;
    display: flex;
    justify-content: center;
  }

  .login-logo {
    width: 96px;
    min-width: 96px;
    margin-bottom: 18px;
  }

  .wechat-qr-wrap {
    width: 220px;
    height: 220px;
  }

  .wechat-status {
    width: 220px;
  }
}

/* 中等 CSS 视口（含未触发 OS 校正时）：收紧左侧内边距，避免 Tab/文案换行 */
@media (max-width: 1440px) and (min-width: 521px) {
  .login-form-card {
    padding: 72px 48px 24px;
  }

  .form-tabs {
    width: 100%;
    max-width: 240px;
    min-width: 0;
  }

  .login-logo {
    margin-bottom: 48px;
  }
}

/* Windows 系统缩放已按 1920 铺开布局时，恢复设计稿内边距（media 仍按 CSS 视口匹配） */
:global(html.viewport-os-scale-corrected) .login-form-card {
  padding: 120px 170px 28px;
}

:global(html.viewport-os-scale-corrected) .form-tabs {
  width: min(38%, 220px);
  min-width: 180px;
}

:global(html.viewport-os-scale-corrected) .login-logo {
  margin-bottom: 80px;
}
</style>
