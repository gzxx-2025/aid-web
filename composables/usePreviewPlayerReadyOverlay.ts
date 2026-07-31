import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { shouldShowPreviewReadyOverlay } from '~/utils/previewPlayerPoster'

const FADE_MS = 180

/**
 * 成品预览播放区：首帧未就绪时展示封面/渐变 + 文案，就绪后淡出。
 * 首版仅覆盖首进与切镜未就绪，不处理播放中途卡顿缓冲。
 */
export function usePreviewPlayerReadyOverlay(deps: {
  scopeKey: Ref<string>
  timelineLoading: Ref<boolean>
  videoClipCount: Ref<number>
  hasPlayableAtCurrentTime: Ref<boolean>
  frameReady: Ref<boolean>
  posterUrl: Ref<string>
}) {
  const overlayMounted = ref(false)
  const overlayOpaque = ref(false)
  let fadeTimer: number | null = null

  const shouldShow = computed(() =>
    shouldShowPreviewReadyOverlay({
      timelineLoading: deps.timelineLoading.value,
      videoClipCount: deps.videoClipCount.value,
      hasPlayableAtCurrentTime: deps.hasPlayableAtCurrentTime.value,
      frameReady: deps.frameReady.value
    })
  )

  const hintText = computed(() => '正在加载预览…')

  function clearFadeTimer() {
    if (fadeTimer != null) {
      window.clearTimeout(fadeTimer)
      fadeTimer = null
    }
  }

  function showNow() {
    clearFadeTimer()
    overlayMounted.value = true
    overlayOpaque.value = true
  }

  function hideWithFade() {
    if (!overlayMounted.value) return
    overlayOpaque.value = false
    clearFadeTimer()
    fadeTimer = window.setTimeout(() => {
      fadeTimer = null
      if (!shouldShow.value) overlayMounted.value = false
    }, FADE_MS)
  }

  watch(
    shouldShow,
    (show) => {
      if (show) showNow()
      else hideWithFade()
    },
    { immediate: true }
  )

  watch(deps.scopeKey, () => {
    clearFadeTimer()
    overlayMounted.value = shouldShow.value
    overlayOpaque.value = shouldShow.value
  })

  onUnmounted(() => {
    clearFadeTimer()
  })

  return {
    overlayMounted,
    overlayOpaque,
    hintText,
    posterUrl: deps.posterUrl,
    shouldShow
  }
}
