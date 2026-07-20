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
            <img :src="logoUrl" alt="AID" class="login-logo" width="120" height="43" />
            <a-form
              :model="quickLoginForm"
              layout="vertical"
              class="login-form"
              @finish="handleFinish"
              @finishFailed="handleFinishFailed"
            >
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
                    手机邮箱
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
                >
                  <template #prefix>
                    <span class="input-prefix-wrap">
                      <img :src="veriIconUrl" alt="" class="input-prefix-icon" />
                      <span class="input-prefix-divider" />
                    </span>
                  </template>
                </a-input-password>
              </a-form-item>
              <a-form-item name="agreement" class="agreement-form-item" :rules="agreementRules">
                <a-checkbox v-model:checked="quickLoginForm.agreement">
                  <span class="agreement-text">
                    我已阅读并同意《用户协议》和《隐私政策》，未注册的手机号将自动创建账号
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
        <div class="wechat-qr-wrap" :class="{ 'is-loading': !wechatQrUrl }">
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
          <button
            v-if="wechatQrUrl"
            type="button"
            class="wechat-qr-refresh-overlay"
            :disabled="wechatLoading"
            :aria-busy="wechatLoading"
            @click="openWechatLogin"
          >
            <span class="wechat-qr-refresh-overlay__text">{{
              wechatLoading ? '刷新中...' : '刷新二维码'
            }}</span>
          </button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { User } from '~/types'
import type { LoginData } from '~/types/business-api'
import { useAuthPublicConfig } from '~/composables/useAuthPublicConfig'
import { useBehaviorCaptcha } from '~/composables/useBehaviorCaptcha'
import { useTacPageHead } from '~/composables/useTacPageHead'
import {
  authLogin,
  authSendCode,
  wechatLoginCheck,
  wechatLoginQrcode
} from '~/utils/businessApi'
import logoUrl from '~/assets/img/home/logo.svg'
import loginVideoBgUrl from '~/assets/img/login/login-video-bg.mp4'
import numberIconUrl from '~/assets/img/login/number.svg'
import veriIconUrl from '~/assets/img/login/veri.svg'
import peopleIconUrl from '~/assets/img/login/pepole.svg'

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

const {
  captchaEnabled,
  captchaType,
  loadPublicConfig,
  getSendCodeIntervalSeconds,
  getCodeMaxLength
} = useAuthPublicConfig()
const { opening: captchaOpening, openBehaviorCaptcha, destroyActive: destroyCaptcha } =
  useBehaviorCaptcha()

const loading = ref(false)

/** 验证码登录：发码滑块通过后缓存 token，登录时带 captcha-token 请求头，不再二次滑块 */
const codeLoginCaptchaToken = ref<string | null>(null)
const codeLoginCaptchaAccount = ref('')

function clearCodeLoginCaptchaToken() {
  codeLoginCaptchaToken.value = null
  codeLoginCaptchaAccount.value = ''
}

function cacheCodeLoginCaptchaToken(token: string, account: string) {
  codeLoginCaptchaToken.value = token
  codeLoginCaptchaAccount.value = account
}

function getCodeLoginCaptchaToken(): string | undefined {
  const account = quickLoginForm.account.trim()
  if (!account || account !== codeLoginCaptchaAccount.value) return undefined
  return codeLoginCaptchaToken.value || undefined
}

const wechatQrUrl = ref('')
const wechatLoading = ref(false)
let wechatPollTimer: ReturnType<typeof setInterval> | null = null
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

const loginCodeMaxLength = computed(() => {
  const account = quickLoginForm.account.trim()
  if (!account) return 6
  return getCodeMaxLength(account)
})
const quickLoginForm = reactive({
  account: '',
  code: '',
  password: '',
  agreement: false
})

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

function mapLoginDataToUser(data: LoginData): User {
  const u = data.userInfo
  return {
    id: String(u.userId),
    username: u.userName || u.nickName || '用户',
    email: u.email || quickLoginForm.account,
    avatar: u.avatar,
    role: 'user'
  }
}

function stopWechatPoll() {
  wechatPollSession += 1
  if (wechatPollTimer) {
    clearInterval(wechatPollTimer)
    wechatPollTimer = null
  }
}

function canRunWechatPolling() {
  return true
}

async function openWechatLogin() {
  if (!canRunWechatPolling()) return
  wechatLoading.value = true
  wechatQrUrl.value = ''
  stopWechatPoll()
  const currentSession = wechatPollSession
  try {
    const data = await wechatLoginQrcode()
    if (!canRunWechatPolling() || currentSession !== wechatPollSession) return
    wechatQrUrl.value = data.qrCodeUrl
    const scene = data.sceneStr
    let ticks = 0
    const maxTicks = 150
    wechatPollTimer = setInterval(async () => {
      if (!canRunWechatPolling() || currentSession !== wechatPollSession) {
        stopWechatPoll()
        return
      }
      ticks += 1
      if (ticks > maxTicks) {
        stopWechatPoll()
        message.warning('等待扫码超时，请关闭后重试')
        return
      }
      try {
        const res = await wechatLoginCheck(scene)
        if (!canRunWechatPolling() || currentSession !== wechatPollSession) {
          stopWechatPoll()
          return
        }
        const payload = res.data as LoginData | undefined
        if (payload?.token && payload.userInfo) {
          stopWechatPoll()
          userStore.login(mapLoginDataToUser(payload), payload.token)
          message.success('登录成功')
          router.push('/')
        }
      } catch (err: any) {
        const m = err?.msg ?? err?.message ?? ''
        if (String(m).includes('失效')) {
          stopWechatPoll()
          message.error(m || '二维码已失效，请刷新重试')
        }
      }
    }, 2000)
  } catch (e: any) {
    if (canRunWechatPolling()) {
      message.error(e?.msg ?? e?.message ?? '获取微信二维码失败')
    }
  } finally {
    wechatLoading.value = false
  }
}

onUnmounted(() => {
  stopWechatPoll()
  stopQuickSendCodeCountdown()
  destroyCaptcha()
})

/** 开启行为验证码时先滑块校验，再执行受保护接口 */
async function withCaptchaToken<T>(
  action: (captchaToken?: string) => Promise<T>
): Promise<T | null> {
  if (!captchaEnabled.value) {
    return action()
  }
  if (captchaOpening.value) return null
  let result: T | null = null
  const ok = await openBehaviorCaptcha({
    bindEl: '#login-captcha-box',
    captchaType: captchaType.value,
    onSuccess: async (token) => {
      result = await action(token)
    }
  })
  if (!ok) return null
  return result
}

async function doSendQuickLoginCode(captchaToken?: string) {
  const account = quickLoginForm.account.trim()
  await authSendCode(
    {
      target: account,
      codeType: inferCodeTypeByTarget(account),
      scene: 'login'
    },
    captchaToken || undefined
  )
  if (captchaToken) {
    cacheCodeLoginCaptchaToken(captchaToken, account)
  } else {
    clearCodeLoginCaptchaToken()
  }
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

async function doPasswordLogin(captchaToken?: string) {
  const data = await authLogin(
    {
      loginType: 'password',
      account: quickLoginForm.account.trim(),
      password: quickLoginForm.password
    },
    captchaToken || undefined
  )
  userStore.login(mapLoginDataToUser(data), data.token)
  message.success('登录成功')
  router.push('/')
}

async function doCodeLogin() {
  if (captchaEnabled.value && !getCodeLoginCaptchaToken()) {
    message.warning('请先获取验证码')
    return
  }
  const data = await authLogin(
    {
      loginType: inferLoginTypeByTarget(quickLoginForm.account.trim()),
      account: quickLoginForm.account.trim(),
      code: quickLoginForm.code.trim()
    },
    getCodeLoginCaptchaToken()
  )
  clearCodeLoginCaptchaToken()
  userStore.login(mapLoginDataToUser(data), data.token)
  message.success('登录成功')
  router.push('/')
}

const handleFinish = async () => {
  if (!quickLoginForm.agreement) {
    message.warning(agreementHint)
    return
  }
  if (loading.value || captchaOpening.value) return
  loading.value = true
  try {
    if (activeFormTab.value === 'code') {
      await doCodeLogin()
      return
    }
    const loggedIn = await withCaptchaToken(doPasswordLogin)
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
  openWechatLogin()
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
    clearCodeLoginCaptchaToken()
    restoreQuickSendCodeCountdown(String(account || '').trim())
  }
)

watch(activeFormTab, () => {
  clearCodeLoginCaptchaToken()
})
</script>

<style lang="scss" scoped>
/* Tab + 输入区锚点；验证码浮层相对此区域定位在上方 */
.login-form-stack {
  position: relative;
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
  padding: 80px 150px 28px;
  position: relative;
  display: flex;
  flex-direction: column;
}

.login-logo {
  width: 120px;
  min-width: 120px;
  height: auto;
  display: block;
  margin: 0 auto 80px;
}

.form-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  width: 38%;
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
  display: grid;
  grid-template-columns: 1fr 132px;
  gap: 10px;
}

.code-btn {
  height: 48px;
  border-radius: 8px;
  border-color: rgba(142, 151, 165, 0.18);
  color: #fff;
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
  left: 150px;
  bottom: 40px;
  margin-bottom: 0 !important;
}

.agreement-form-item :deep(.ant-form-item-control-input) {
  min-height: 0;
}

.agreement-form-item :deep(.ant-form-item-explain-error) {
  font-size: 12px;
  margin-top: 4px;
}

.agreement-form-item :deep(.ant-checkbox-wrapper) {
  font-size: 12px;
  color: rgba(142, 151, 165, 1);
  line-height: 1.5;
  align-items: flex-start;
}

.agreement-form-item :deep(.ant-checkbox) {
  margin-top: 2px;
}

.agreement-text {
  color: rgba(142, 151, 165, 1);
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

/* 悬停二维码区域时显示遮罩与「刷新二维码」 */
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
  transition: opacity 0.22s ease;
}

.wechat-qr-refresh-overlay__text {
  text-align: center;
  line-height: 1.35;
}

.wechat-qr-wrap:hover .wechat-qr-refresh-overlay:not(:disabled),
.wechat-qr-wrap:focus-within .wechat-qr-refresh-overlay:not(:disabled) {
  opacity: 1;
  pointer-events: auto;
}

.wechat-qr-refresh-overlay:disabled {
  cursor: wait;
  opacity: 0;
  pointer-events: none;
}

.wechat-qr-refresh-overlay:focus-visible {
  opacity: 1;
  pointer-events: auto;
  outline: 2px solid rgba(74, 231, 253, 0.85);
  outline-offset: -2px;
}

/* 触屏设备无 hover：保留底部弱提示，仍可点击整区刷新 */
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
}

/* Ant Design input hard overrides */
.login-form :deep(.ant-input-affix-wrapper),
.login-form :deep(.ant-input-password) {
  height: 48px !important;
  border-radius: 8px !important;
  border: 1px solid rgba(142, 151, 165, 0.1) !important;
  background: rgba(142, 151, 165, 0.1) !important;
  color: rgba(142, 151, 165, 1) !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: center !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
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
}

.login-form :deep(.ant-input::placeholder),
.login-form :deep(.ant-input-password input::placeholder) {
  color: rgba(142, 151, 165, 1) !important;
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

  .agreement-form-item {
    position: static;
    left: auto;
    bottom: auto;
    margin-top: 18px !important;
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
}
</style>
