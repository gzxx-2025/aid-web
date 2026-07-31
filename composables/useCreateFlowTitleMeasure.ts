import { computed, nextTick, onMounted, watch, type Ref } from 'vue'
import { useCreationStore } from '~/stores/creation'

/**
 * 工具栏作品标题输入框宽度随文字自适应（原 index.vue）
 */
export function useCreateFlowTitleMeasure(pageReady: Ref<boolean>) {
  const creationStore = useCreationStore()
  const titleMeasureEl = ref<HTMLElement | null>(null)
  const titleInputWidthPx = ref(160)
  const titleMeasureText = computed(() => {
    const t = creationStore.workTitle?.trim()
    return t && t.length > 0 ? t : '作品名称'
  })
  const titleInputWrapStyle = computed(() => ({
    width: `${titleInputWidthPx.value}px`
  }))

  function syncTitleInputWidth() {
    nextTick(() => {
      const el = titleMeasureEl.value
      if (!el) return
      const w = el.offsetWidth
      const pad = 40
      titleInputWidthPx.value = Math.min(Math.max(w + pad, 96), 560)
    })
  }

  watch(
    () => [creationStore.workTitle, pageReady.value] as const,
    () => syncTitleInputWidth(),
    { flush: 'post' }
  )
  onMounted(() => syncTitleInputWidth())

  return {
    titleMeasureEl,
    titleMeasureText,
    titleInputWrapStyle,
    syncTitleInputWidth
  }
}
