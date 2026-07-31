<template>
  <div
    v-if="loading"
    class="infinite-scroll-load-footer"
    aria-live="polite"
  >
    <span class="infinite-scroll-load-footer__dots" aria-hidden="true">
      <span class="infinite-scroll-load-footer__dot" />
      <span class="infinite-scroll-load-footer__dot" />
      <span class="infinite-scroll-load-footer__dot" />
    </span>
    <span class="infinite-scroll-load-footer__text">{{ loadingText }}</span>
  </div>
  <div
    v-else-if="!hasMore && hasItems"
    class="infinite-scroll-load-footer infinite-scroll-load-footer--end"
  >
    {{ endText }}
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    loading?: boolean
    hasMore?: boolean
    hasItems?: boolean
    loadingText?: string
    endText?: string
  }>(),
  {
    loading: false,
    hasMore: true,
    hasItems: false,
    loadingText: '加载中…',
    endText: '已加载全部'
  }
)
</script>

<style scoped lang="scss">
.infinite-scroll-load-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 0 18px;
}

.infinite-scroll-load-footer--end {
  gap: 0;
  font-size: 12px;
  color: #8e97a5;
}

.infinite-scroll-load-footer__dots {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.infinite-scroll-load-footer__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(74, 231, 253, 0.95);
  animation: infinite-scroll-load-dot 0.9s ease-in-out infinite;
}

.infinite-scroll-load-footer__dot:nth-child(2) {
  animation-delay: 0.15s;
}

.infinite-scroll-load-footer__dot:nth-child(3) {
  animation-delay: 0.3s;
}

.infinite-scroll-load-footer__text {
  font-size: 12px;
  color: #8e97a5;
}

@keyframes infinite-scroll-load-dot {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-4px);
  }
}
</style>
