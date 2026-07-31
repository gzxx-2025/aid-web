<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  showSetMain?: boolean
  setMainLabel?: string
  setMainLoading?: boolean
}>()

const emit = defineEmits<{
  setMain: []
}>()

const wrapRef = ref<HTMLElement | null>(null)
const btnVisible = ref(false)
const btnStyle = ref<Record<string, string>>({})

let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearHideTimer() {
  if (hideTimer != null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function updateBtnPos() {
  const el = wrapRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  btnStyle.value = {
    top: `${rect.top + rect.height / 2}px`,
    left: `${rect.right + 6}px`
  }
}

function showBtn() {
  clearHideTimer()
  if (!props.showSetMain) return
  btnVisible.value = true
  updateBtnPos()
}

function scheduleHide() {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    btnVisible.value = false
  }, 80)
}

function onWrapEnter() {
  showBtn()
}

function onWrapLeave() {
  scheduleHide()
}

function onBtnEnter() {
  showBtn()
}

function onBtnLeave() {
  scheduleHide()
}

function onSetMainClick() {
  emit('setMain')
}

function onScrollOrResize() {
  if (btnVisible.value) updateBtnPos()
}

watch(
  () => props.showSetMain,
  (visible) => {
    if (!visible) btnVisible.value = false
  }
)

watch(btnVisible, (visible) => {
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
  <div
    ref="wrapRef"
    class="history-record-wrap"
    @mouseenter="onWrapEnter"
    @mouseleave="onWrapLeave"
  >
    <slot />
    <Teleport to="body">
      <Transition name="history-set-main-btn-fade">
        <button
          v-if="btnVisible && showSetMain"
          type="button"
          class="history-set-main-btn history-set-main-btn--floating"
          :style="btnStyle"
          :disabled="setMainLoading"
          @mouseenter="onBtnEnter"
          @mouseleave="onBtnLeave"
          @click.stop="onSetMainClick"
        >
          {{ setMainLabel }}
        </button>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss">
@import '@/assets/css/history-record-card.css';

.history-set-main-btn--floating {
  position: fixed;
  transform: translateY(-50%);
  z-index: 10050;
  pointer-events: auto;
}
</style>
