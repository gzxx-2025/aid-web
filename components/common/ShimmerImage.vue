<template>
  <div
    class="shimmer-image"
    :class="[
      wrapperClass,
      `shimmer-image--${revealPhase}`,
      `shimmer-image--reveal-${revealDirection}`,
      { 'shimmer-image--error': hasError },
    ]"
    :style="revealStyle"
    @animationend="onRevealAnimationEnd"
  >
    <div class="shimmer-image__reveal">
      <img
        v-if="resolvedSrc && !hasError"
        ref="imgRef"
        :src="resolvedSrc"
        :alt="alt"
        decoding="async"
        :class="[
          'shimmer-image__img',
          imgClass,
          { 'is-loaded': revealPhase !== 'waiting' && !hasError },
        ]"
        :style="imgStyle"
        @load="onImgReady"
        @error="onError"
        @click="emit('click', $event)"
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
    alt?: string
    imgClass?: string
    wrapperClass?: string
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
    /** 流光占位最短展示时长（ms），仅对需要渐入的图片生效 */
    minShimmerMs?: number
    /** 图片揭示方式：滑入或渐入 */
    revealDirection?: 'vertical' | 'horizontal' | 'fade'
    /** 揭示动画时长（ms） */
    revealMs?: number
    /** 若图片在该时间内加载完成（多为缓存），跳过流光与渐入动效 */
    fastRevealThresholdMs?: number
  }>(),
  {
    src: '',
    alt: '',
    imgClass: '',
    wrapperClass: '',
    objectFit: 'cover',
    minShimmerMs: 0,
    revealDirection: 'vertical',
    revealMs: 780,
    fastRevealThresholdMs: 120,
  }
)

const emit = defineEmits<{
  click: [event: MouseEvent]
  load: []
  error: []
}>()

const imgRef = ref<HTMLImageElement | null>(null)
const revealPhase = ref<'waiting' | 'revealing' | 'done'>('waiting')
const hasError = ref(false)
const imgReady = ref(false)
const loadStartedAt = ref(0)
let shimmerDelayTimer: ReturnType<typeof setTimeout> | null = null
let revealFallbackTimer: ReturnType<typeof setTimeout> | null = null
let cacheSyncFallbackTimer: ReturnType<typeof setTimeout> | null = null

const resolvedSrc = computed(() => String(props.src || '').trim())

const revealStyle = computed(() => ({
  '--shimmer-reveal-ms': `${props.revealMs}ms`,
}))

const imgStyle = computed(() => ({
  objectFit: props.objectFit,
  objectPosition: 'center',
}))

function clearShimmerDelayTimer() {
  if (shimmerDelayTimer != null) {
    clearTimeout(shimmerDelayTimer)
    shimmerDelayTimer = null
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
  clearShimmerDelayTimer()
  clearRevealFallbackTimer()
  clearCacheSyncFallbackTimer()
}

function finishImmediately() {
  clearRevealTimers()
  revealPhase.value = 'done'
  emit('load')
}

function scheduleRevealFallback() {
  clearRevealFallbackTimer()
  revealFallbackTimer = setTimeout(() => {
    revealFallbackTimer = null
    if (revealPhase.value === 'revealing') {
      revealPhase.value = 'done'
      emit('load')
    }
  }, props.revealMs + 120)
}

function startReveal() {
  if (!imgReady.value || hasError.value || revealPhase.value !== 'waiting') return
  revealPhase.value = 'revealing'
  scheduleRevealFallback()
}

function tryReveal() {
  if (!imgReady.value || hasError.value) return
  const elapsed = Date.now() - loadStartedAt.value

  // 缓存或极快加载：直接展示，不播流光/渐入
  if (elapsed <= props.fastRevealThresholdMs) {
    finishImmediately()
    return
  }

  const remain = Math.max(0, props.minShimmerMs - elapsed)
  clearShimmerDelayTimer()
  if (remain <= 0) {
    startReveal()
    return
  }
  shimmerDelayTimer = setTimeout(() => {
    shimmerDelayTimer = null
    startReveal()
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
  emit('load')
}

function onImgReady() {
  imgReady.value = true
  tryReveal()
}

function onError() {
  hasError.value = true
  clearRevealTimers()
  emit('error')
}

function tryApplyCachedReady(): boolean {
  const el = imgRef.value
  if (!el?.complete || el.naturalWidth <= 0) return false
  imgReady.value = true
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
  imgReady.value = false
  hasError.value = false
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
</script>
