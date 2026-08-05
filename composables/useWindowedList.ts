import { computed, unref, type MaybeRef, type Ref } from 'vue'

/**
 * 简单窗口切片：长列表只渲染可见窗口附近的项，降低 DOM / 图片解码峰值。
 * 不改变数据源，仅控制渲染窗口；滚动容器需自行根据 scrollTop 更新 windowStart，
 * 或通过增大 windowSize 做「触底加载更多渲染」。
 */
export function useWindowedList<T>(
  items: Ref<T[] | readonly T[]>,
  options: {
    /** 窗口起始下标（含） */
    windowStart: Ref<number>
    /** 窗口长度 */
    windowSize?: MaybeRef<number>
  }
) {
  const resolvedWindowSize = computed(() => {
    const n = Number(unref(options.windowSize ?? 40))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 40
  })

  const windowedItems = computed(() => {
    const list = items.value || []
    const size = resolvedWindowSize.value
    const start = Math.max(0, Math.min(options.windowStart.value, list.length))
    return list.slice(start, start + size).map((item, offset) => ({
      item,
      index: start + offset
    }))
  })

  const total = computed(() => (items.value || []).length)

  return {
    windowedItems,
    total,
    windowSize: resolvedWindowSize
  }
}
