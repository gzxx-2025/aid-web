import { computed, ref } from 'vue'
import type { WechatNotifyPreferenceData } from '~/types/business-api'
import {
  wechatNotifyDisable,
  wechatNotifyEnable,
  wechatNotifyPreference
} from '~/utils/businessApi'
import { isWechatLoginChannel } from '~/utils/authLoginChannel'

export function useWechatNotifyPreference() {
  const preference = ref<WechatNotifyPreferenceData | null>(null)
  const loading = ref(false)
  const toggling = ref(false)

  const isWechatLoginUser = computed(() => isWechatLoginChannel())

  const showWechatNotifyRow = computed(
    () => isWechatLoginUser.value && preference.value?.systemEnabled === true
  )

  const wechatNotifyChecked = computed(() => preference.value?.userEnabled === true)

  const wechatNotifySwitchDisabled = computed(() => preference.value?.wechatBound !== true)

  async function loadPreference(force = false) {
    if (!isWechatLoginUser.value) {
      preference.value = null
      return null
    }
    if (!force && preference.value) return preference.value
    loading.value = true
    try {
      const data = await wechatNotifyPreference()
      preference.value = data
      return data
    } catch {
      return preference.value
    } finally {
      loading.value = false
    }
  }

  async function setWechatNotifyEnabled(next: boolean) {
    if (!preference.value || wechatNotifySwitchDisabled.value || toggling.value) {
      return { ok: false as const, message: '' }
    }
    const prev = preference.value.userEnabled
    preference.value = { ...preference.value, userEnabled: next }
    toggling.value = true
    try {
      const data = next ? await wechatNotifyEnable() : await wechatNotifyDisable()
      preference.value = data
      return { ok: true as const, message: '' }
    } catch (e: unknown) {
      if (preference.value) {
        preference.value = { ...preference.value, userEnabled: prev }
      }
      const err = e as { msg?: string; message?: string }
      return { ok: false as const, message: err?.msg || err?.message || '微信推送设置失败，请稍后重试' }
    } finally {
      toggling.value = false
    }
  }

  function resetPreference() {
    preference.value = null
  }

  return {
    preference,
    loading,
    toggling,
    isWechatLoginUser,
    showWechatNotifyRow,
    wechatNotifyChecked,
    wechatNotifySwitchDisabled,
    loadPreference,
    setWechatNotifyEnabled,
    resetPreference
  }
}
