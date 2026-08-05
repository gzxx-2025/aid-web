<template>
  <div
    ref="rootRef"
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
        v-if="shouldMountVideo && !hasError"
        ref="videoRef"
        :src="activeSrc"
        :class="['shimmer-image__img', videoClass]"
        :style="videoStyle"
        :muted="muted"
        :playsinline="playsinline"
        :preload="effectivePreload"
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
import { acquireMediaLoadSlot } from '~/utils/mediaLoadGate'

const props = withDefaults(
  defineProps<{
    src?: string
    videoClass?: string
    wrapperClass?: string
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
    muted?: boolean
    playsinline?: boolean
    preload?: 'auto' | 'metadata' | 'none'
    /**
     * 进入滚动容器可视区后再挂 src。
     * 缩略图/列表务必开启；主预览可关闭。
     */
    lazy?: boolean
    /** 限制同时加载路数（默认开启），避免弹窗一次打爆网络 */
    gated?: boolean
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
    lazy: false,
    gated: true,
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

const rootRef = ref<HTMLElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const revealPhase = ref<'waiting' | 'revealing' | 'done'>('waiting')
const hasError = ref(false)
const mediaReady = ref(false)
const loadStartedAt = ref(0)
const inView = ref(!props.lazy)
const slotReady = ref(!props.gated)
let revealTimer: ReturnType<typeof setTimeout> | null = null
let revealFallbackTimer: ReturnType<typeof setTimeout> | null = null
let cacheSyncFallbackTimer: ReturnType<typeof setTimeout> | null = null
let loadEmitted = false
let intersectionObserver: IntersectionObserver | null = null
let releaseSlot: (() => void) | null = null
let slotToken = 0

const resolvedSrc = computed(() => String(props.src || '').trim())
const canBindSrc = computed(() => inView.value && slotReady.value)
const shouldMountVideo = computed(() => !!resolvedSrc.value && canBindSrc.value)
const activeSrc = computed(() => (shouldMountVideo.value ? resolvedSrc.value : ''))
const effectivePreload = computed(() => (canBindSrc.value ? props.preload : 'none'))

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

function disconnectObserver() {
  if (!intersectionObserver) return
  intersectionObserver.disconnect()
  intersectionObserver = null
}

function releaseMediaSlot() {
  if (!releaseSlot) return
  releaseSlot()
  releaseSlot = null
}

function findScrollRoot(el: HTMLElement): Element | null {
  let parent = el.parentElement
  while (parent) {
    const style = window.getComputedStyle(parent)
    const ox = style.overflowX
    const oy = style.overflowY
    if (/(auto|scroll|overlay)/.test(ox) || /(auto|scroll|overlay)/.test(oy)) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

function markInView() {
  if (inView.value) return
  inView.value = true
  disconnectObserver()
}

function setupLazyObserver() {
  disconnectObserver()
  if (!props.lazy || !import.meta.client) {
    inView.value = true
    return
  }
  const el = rootRef.value
  if (!el) return
  if (typeof IntersectionObserver === 'undefined') {
    inView.value = true
    return
  }

  const root = findScrollRoot(el)
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      markInView()
    },
    {
      root,
      // 只预热邻近一屏，避免头部横向 Tab 一次加载过多
      rootMargin: root ? '40px 48px' : '80px 40px',
      threshold: 0.15
    }
  )
  intersectionObserver.observe(el)
}

async function ensureLoadSlot() {
  const token = ++slotToken
  releaseMediaSlot()
  if (!props.gated) {
    slotReady.value = true
    return
  }
  slotReady.value = false
  const release = await acquireMediaLoadSlot(2)
  if (token !== slotToken) {
    release()
    return
  }
  releaseSlot = release
  slotReady.value = true
}

watch(
  () => props.lazy,
  (lazy) => {
    if (!lazy) {
      inView.value = true
      disconnectObserver()
      return
    }
    inView.value = false
    void nextTick(() => setupLazyObserver())
  }
)

watch(
  [resolvedSrc, inView],
  async ([src, visible]) => {
    resetLoadState()
    if (!src || !visible) {
      releaseMediaSlot()
      slotReady.value = !props.gated
      return
    }
    await ensureLoadSlot()
    if (!slotReady.value || !resolvedSrc.value) return
    await syncLoadedFromCache()
  },
  { immediate: true }
)

onMounted(() => {
  if (props.lazy) setupLazyObserver()
  else if (resolvedSrc.value) void ensureLoadSlot().then(() => syncLoadedFromCache())
})

onBeforeUnmount(() => {
  slotToken += 1
  clearRevealTimers()
  disconnectObserver()
  releaseMediaSlot()
})

defineExpose({
  videoRef,
})
</script>
