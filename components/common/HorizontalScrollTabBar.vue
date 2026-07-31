<template>
  <div :class="['h-scroll-tab-bar', rootClass]">
    <button
      v-show="showLeftArrow"
      type="button"
      class="h-scroll-tab-bar__arrow h-scroll-tab-bar__arrow--left"
      aria-label="向左滚动"
      @click="scrollByPage(-1)"
    >
      <LeftOutlined />
    </button>

    <div
      ref="scrollerRef"
      class="h-scroll-tab-bar__viewport"
      @scroll="onScroll"
    >
      <div :class="['h-scroll-tab-bar__track', trackClass]">
        <slot />
      </div>
    </div>

    <button
      v-show="showRightArrow"
      type="button"
      class="h-scroll-tab-bar__arrow h-scroll-tab-bar__arrow--right"
      aria-label="向右滚动"
      @click="scrollByPage(1)"
    >
      <RightOutlined />
    </button>

    <div v-if="$slots.suffix" class="h-scroll-tab-bar__suffix">
      <slot name="suffix" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import { useHorizontalScrollTabs } from '~/composables/useHorizontalScrollTabs'

withDefaults(
  defineProps<{
    rootClass?: string
    trackClass?: string
  }>(),
  {
    rootClass: '',
    trackClass: ''
  }
)

const {
  scrollerRef,
  showLeftArrow,
  showRightArrow,
  onScroll,
  scrollByPage,
  scrollItemIntoView,
  refresh,
  updateArrows
} = useHorizontalScrollTabs()

defineExpose({
  scrollItemIntoView,
  refresh,
  updateArrows
})
</script>

<style lang="scss" scoped>
.h-scroll-tab-bar {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 4px;
}

.h-scroll-tab-bar__viewport {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.h-scroll-tab-bar__track {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: stretch;
  width: max-content;
  flex-shrink: 0;
}

.h-scroll-tab-bar__track :deep(> *) {
  flex-shrink: 0;
}

.h-scroll-tab-bar__arrow {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  color: #d9e6f2;
  background: rgba(74, 231, 253, 0.12);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease;

  &:hover {
    color: #4ae7fd;
    background: rgba(74, 231, 253, 0.22);
  }
}

.h-scroll-tab-bar__suffix {
  flex-shrink: 0;
  margin-left: 8px;
}
</style>
