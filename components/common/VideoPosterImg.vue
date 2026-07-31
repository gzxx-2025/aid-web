<template>
  <img v-if="posterSrc" :src="posterSrc" :class="imgClass" alt="" />
  <video
    v-else-if="src"
    :src="src"
    :class="imgClass"
    muted
    playsinline
    preload="metadata"
    @loadeddata="onVideoLoaded"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { captureVideoFirstFrame } from '~/utils/videoPoster'

const props = withDefaults(
  defineProps<{
    src?: string
    imgClass?: string
  }>(),
  { src: '', imgClass: '' }
)

const posterSrc = ref('')
const posterCache = new Map<string, string>()

function onVideoLoaded(event: Event) {
  const video = event.target as HTMLVideoElement
  if (!video) return
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  video.currentTime = duration > 0 ? Math.min(0.1, duration * 0.01) : 0
}

watch(
  () => props.src,
  async (src) => {
    const url = String(src || '').trim()
    if (!url) {
      posterSrc.value = ''
      return
    }
    const cached = posterCache.get(url)
    if (cached) {
      posterSrc.value = cached
      return
    }
    posterSrc.value = ''
    try {
      const dataUrl = await captureVideoFirstFrame(url)
      posterCache.set(url, dataUrl)
      if (props.src === url) posterSrc.value = dataUrl
    } catch {
      /* 截帧失败时由 template 中的 video 兜底展示首帧 */
    }
  },
  { immediate: true }
)
</script>
