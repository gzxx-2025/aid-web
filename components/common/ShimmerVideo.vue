<template>
  <div
    class="shimmer-image shimmer-video"
    :class="[
      wrapperClass,
      `shimmer-image--${revealPhase}`,
      `shimmer-image--reveal-${revealDirection}`,
      { 'shimmer-image--error': hasError },
    ]"
    :style="revealStyle"
  >
    <div class="shimmer-image__reveal" @animationend="onRevealAnimationEnd">
      <video
        v-if="resolvedSrc && !hasError"
        ref="videoRef"
        :src="resolvedSrc"
        :class="['shimmer-image__img', videoClass]"
        :style="videoStyle"
        :muted="muted"
        :playsinline="playsinline"
        :preload="preload"
        @loadeddata="onVideoReady"
        @canplay="onVideoReady"
        @error="onError"
        @click="emit('click', $event)"
        @ended="emit('ended', $event)"
        @pause="emit('pause', $event)"
      />
    </div>

    <div
      v-show="revealPhase === 'waiting'"
      class="shimmer-image__placeholder"
      aria-hidden="true"
    >
      <div class="shimmer-image__shimmer shimmer-image__shimmer--loop" />
    </div>

    <div
      v-if="revealPhase === 'revealing' && revealDirection !== 'fade'"
      class="shimmer-image__scan-line"
      aria-hidden="true"
    />

    <slot v-if="hasError" name="error" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string
    videoClass?: string
    wrapperClass?: string
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
    muted?: boolean
    playsinline?: boolean
    preload?: 'auto' | 'metadata' | 'none'
    minShimmerMs?: number
    revealDirection?: 'vertical' | 'horizontal' | 'fade'
    revealMs?: number
    fastRevealThresholdMs?: number
  }>(),
  {
    src: '',
    videoClass: '',
    wrapperClass: '',
    objectFit: 'cover',
    muted: true,
    playsinline: true,
    preload: 'metadata',
    minShimmerMs: 0,
    revealDirection: 'fade',
    revealMs: 780,
    fastRevealThresholdMs: 120,
  }
)

const emit = defineEmits<{
  click: [event: MouseEvent]
  load: []
  error: []
  ended: [event: Event]
  pause: [event: Event]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const revealPhase = ref<'waiting' | 'revealing' | 'done'>('waiting')
const hasError = ref(false)
const mediaReady = ref(false)
const loadStartedAt = ref(0)
let revealTimer: ReturnType<typeof setTimeout> | null = null
let revealFallbackTimer: ReturnType<typeof setTimeout> | null = null
let cacheSyncFallbackTimer: ReturnType<typeof setTimeout> | null = null
let loadEmitted = false

const resolvedSrc = computed(() => String(props.src || '').trim())

const revealStyle = computed(() => ({
  '--shimmer-reveal-ms': `${props.revealMs}ms`,
}))

const videoStyle = computed(() => ({
  objectFit: props.objectFit,
  objectPosition: 'center',
}))

function clearRevealTimer() {
  if (revealTimer != null) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
}

function clearRevealFallbackTimer() {
  if (revealFallbackTimer != null) {
    clearTimeout(revealFallbackTimer)
    revealFallbackTimer = null
  }
}

function clearCacheSyncFallbackTimer() {
  if (cacheSyncFallbackTimer != null) {
    clearTimeout(cacheSyncFallbackTimer)
    cacheSyncFallbackTimer = null
  }
}

function clearRevealTimers() {
  clearRevealTimer()
  clearRevealFallbackTimer()
  clearCacheSyncFallbackTimer()
}

function emitLoadOnce() {
  if (loadEmitted) return
  loadEmitted = true
  emit('load')
}

function finishImmediately() {
  clearRevealTimers()
  revealPhase.value = 'done'
  emitLoadOnce()
}

function scheduleRevealFallback() {
  clearRevealFallbackTimer()
  revealFallbackTimer = setTimeout(() => {
    revealFallbackTimer = null
    if (revealPhase.value === 'revealing') {
      revealPhase.value = 'done'
      emitLoadOnce()
    }
  }, props.revealMs + 120)
}

function startReveal() {
  if (!mediaReady.value || hasError.value || revealPhase.value !== 'waiting') return
  revealPhase.value = 'revealing'
  scheduleRevealFallback()
}

function tryReveal() {
  if (!mediaReady.value || hasError.value) return
  const elapsed = Date.now() - loadStartedAt.value

  if (elapsed <= props.fastRevealThresholdMs) {
    finishImmediately()
    return
  }

  const remain = Math.max(0, props.minShimmerMs - elapsed)
  clearRevealTimer()
  if (remain <= 0) {
    startReveal()
    return
  }
  revealTimer = setTimeout(() => {
    startReveal()
    revealTimer = null
  }, remain)
}

function onRevealAnimationEnd(event: AnimationEvent) {
  const revealAnimMap = {
    horizontal: 'shimmer-image-reveal-horizontal',
    vertical: 'shimmer-image-reveal',
    fade: 'shimmer-image-reveal-fade',
  } as const
  const revealAnim = revealAnimMap[props.revealDirection]
  if (event.animationName !== revealAnim) return
  clearRevealFallbackTimer()
  revealPhase.value = 'done'
  emitLoadOnce()
}

function onVideoReady() {
  if (mediaReady.value) return
  mediaReady.value = true
  tryReveal()
}

function onError() {
  hasError.value = true
  clearRevealTimers()
  emit('error')
}

function tryApplyCachedReady(): boolean {
  const el = videoRef.value
  if (!el || el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false
  mediaReady.value = true
  tryReveal()
  return revealPhase.value !== 'waiting'
}

async function syncLoadedFromCache() {
  await nextTick()
  if (tryApplyCachedReady()) return

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
  if (tryApplyCachedReady()) return

  clearCacheSyncFallbackTimer()
  cacheSyncFallbackTimer = setTimeout(() => {
    cacheSyncFallbackTimer = null
    tryApplyCachedReady()
  }, 64)
}

function resetLoadState() {
  clearRevealTimers()
  revealPhase.value = 'waiting'
  mediaReady.value = false
  hasError.value = false
  loadEmitted = false
  loadStartedAt.value = Date.now()
}

watch(
  resolvedSrc,
  async (src) => {
    resetLoadState()
    if (!src) return
    await syncLoadedFromCache()
  },
  { immediate: true }
)

onMounted(() => {
  if (resolvedSrc.value) {
    void syncLoadedFromCache()
  }
})

onBeforeUnmount(() => {
  clearRevealTimers()
})

defineExpose({
  videoRef,
})
</script>
