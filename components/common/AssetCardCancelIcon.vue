<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import cancelIcon from '~/assets/img/icon/cancel.svg'

defineProps<{
  label: string
}>()

const emit = defineEmits<{
  click: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const hintVisible = ref(false)
const hintStyle = ref<Record<string, string>>({})

let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearHideTimer() {
  if (hideTimer != null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function updateHintPos() {
  const el = rootRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  hintStyle.value = {
    top: `${rect.top}px`,
    left: `${rect.left + rect.width / 2}px`
  }
}

function showHint() {
  clearHideTimer()
  hintVisible.value = true
  updateHintPos()
}

function scheduleHide() {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    hintVisible.value = false
  }, 80)
}

function onClick(event: MouseEvent) {
  event.stopPropagation()
  emit('click')
}

function onScrollOrResize() {
  if (hintVisible.value) updateHintPos()
}

watch(hintVisible, (visible) => {
  if (visible) {
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return
  }
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})

onBeforeUnmount(() => {
  clearHideTimer()
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})
</script>

<template>
  <span
    ref="rootRef"
    class="asset-card-cancel-icon"
    role="button"
    tabindex="0"
    @mouseenter="showHint"
    @mouseleave="scheduleHide"
    @click="onClick"
    @keydown.enter.stop.prevent="emit('click')"
  >
    <img :src="cancelIcon" alt="" class="asset-card-cancel-icon__img" width="16" height="16" />
    <Teleport to="body">
      <Transition name="asset-card-cancel-hint-fade">
        <span v-if="hintVisible" class="asset-card-cancel-hint" :style="hintStyle">
          {{ label }}
        </span>
      </Transition>
    </Teleport>
  </span>
</template>
