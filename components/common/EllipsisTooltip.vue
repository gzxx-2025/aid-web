<template>
  <a-tooltip :title="showTooltip ? title : undefined" :placement="placement">
    <span ref="textRef" class="ellipsis-tooltip-text">
      <slot>{{ title }}</slot>
    </span>
  </a-tooltip>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    placement?: 'top' | 'bottom' | 'left' | 'right'
  }>(),
  { placement: 'top' }
)

const textRef = ref<HTMLElement | null>(null)
const showTooltip = ref(false)

function checkOverflow() {
  const el = textRef.value
  if (!el) {
    showTooltip.value = false
    return
  }
  showTooltip.value = el.scrollWidth > el.clientWidth + 1
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  checkOverflow()
  if (typeof ResizeObserver === 'undefined' || !textRef.value) return
  resizeObserver = new ResizeObserver(checkOverflow)
  resizeObserver.observe(textRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => props.title,
  () => nextTick(checkOverflow)
)
</script>

<style scoped>
.ellipsis-tooltip-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
</style>
