import { onUnmounted, ref } from 'vue'
import {
  buildCountdownStorageKey,
  clearCountdown,
  getCountdownRemainingSeconds,
  setCountdownEndAt
} from '~/utils/persistedCountdown'

const DEFAULT_DURATION_SEC = 120

/**
 * 可跨刷新的倒计时（按 scope + target 区分，如登录页手机号/邮箱）。
 */
export function usePersistedCountdown(scope: string, durationSec = DEFAULT_DURATION_SEC) {
  const remaining = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null
  let activeKey = ''

  function storageKey(target: string) {
    return buildCountdownStorageKey(scope, target)
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    activeKey = ''
  }

  function syncFromStorage(key: string) {
    const sec = getCountdownRemainingSeconds(key)
    remaining.value = sec
    if (sec <= 0) stopTimer()
    return sec
  }

  function startTimer(key: string) {
    stopTimer()
    activeKey = key
    timer = setInterval(() => {
      if (activeKey !== key) return
      syncFromStorage(key)
    }, 1000)
  }

  /** 发送成功后调用，开始倒计时并写入 localStorage（可覆盖默认秒数） */
  function start(target: string, durationOverride?: number) {
    const dur = durationOverride ?? durationSec
    const key = storageKey(target)
    setCountdownEndAt(key, dur)
    remaining.value = dur
    startTimer(key)
  }

  /** 页面挂载或切换账号时，从 localStorage 恢复剩余时间 */
  function restore(target: string) {
    const key = storageKey(target)
    const sec = syncFromStorage(key)
    if (sec > 0) startTimer(key)
    else stopTimer()
  }

  function clear(target: string) {
    clearCountdown(storageKey(target))
    if (activeKey === storageKey(target)) {
      remaining.value = 0
      stopTimer()
    }
  }

  onUnmounted(() => stopTimer())

  return {
    remaining,
    start,
    restore,
    clear,
    stop: stopTimer
  }
}
