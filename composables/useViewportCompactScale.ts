import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  VIEWPORT_COMPACT_MEDIA,
  VIEWPORT_COMPACT_SCALE_CHANGED_EVENT,
  applyViewportCompactScale,
  isCompactViewport,
  readViewportCompactScalePreference,
  writeViewportCompactScalePreference
} from '~/utils/viewportCompactScale'

/**
 * 低分辨率视口缩放开关：用户偏好存 localStorage，变更后立即重新 apply 根节点 zoom。
 */
export function useViewportCompactScale() {
  const config = useRuntimeConfig()
  const configEnabled = computed(() => config.public.viewportCompactScale !== false)

  const userEnabled = ref(true)
  const inCompactRange = ref(false)

  const effectiveEnabled = computed(() => configEnabled.value && userEnabled.value)
  const canToggle = computed(() => configEnabled.value && inCompactRange.value)

  function syncFromStorage() {
    userEnabled.value = readViewportCompactScalePreference()
  }

  function reapply() {
    applyViewportCompactScale(effectiveEnabled.value)
  }

  function setEnabled(next: boolean) {
    userEnabled.value = next
    writeViewportCompactScalePreference(next)
    reapply()
  }

  function toggle() {
    setEnabled(!userEnabled.value)
  }

  function onPreferenceChanged() {
    syncFromStorage()
    reapply()
  }

  function onMediaChange() {
    inCompactRange.value = isCompactViewport()
    reapply()
  }

  onMounted(() => {
    if (!import.meta.client) return
    syncFromStorage()
    inCompactRange.value = isCompactViewport()
    reapply()

    window.addEventListener(VIEWPORT_COMPACT_SCALE_CHANGED_EVENT, onPreferenceChanged)

    const mq = window.matchMedia(VIEWPORT_COMPACT_MEDIA)
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onMediaChange)
    } else {
      ;(mq as unknown as { addListener: (fn: () => void) => void }).addListener(onMediaChange)
    }
  })

  onBeforeUnmount(() => {
    if (!import.meta.client) return
    window.removeEventListener(VIEWPORT_COMPACT_SCALE_CHANGED_EVENT, onPreferenceChanged)
    const mq = window.matchMedia(VIEWPORT_COMPACT_MEDIA)
    if (typeof mq.removeEventListener === 'function') {
      mq.removeEventListener('change', onMediaChange)
    } else {
      ;(mq as unknown as { removeListener: (fn: () => void) => void }).removeListener(onMediaChange)
    }
  })

  return {
    userEnabled,
    configEnabled,
    effectiveEnabled,
    canToggle,
    inCompactRange,
    setEnabled,
    toggle,
    reapply
  }
}
