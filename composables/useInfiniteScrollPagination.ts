import { computed, nextTick, onBeforeUnmount, ref, type Ref } from 'vue'
import {
  INFINITE_SCROLL_APPEND_DELAY_MS,
  waitInfiniteScrollAppendDelay
} from '~/utils/infiniteScrollDelay'

export interface InfiniteScrollPaginationOptions {
  pageSize?: number
  /** 距底部多少 px 触发加载 */
  threshold?: number
  /** 上拉加载后追加内容的最低等待时间（ms），默认 1000 */
  appendDelayMs?: number
}

/**
 * 列表触底分页加载：默认 20 条/页，带加载态与平滑追加动画 class。
 */
export function useInfiniteScrollPagination<T>(
  scrollRootRef: Ref<HTMLElement | null>,
  fetchPage: (pageNum: number, pageSize: number) => Promise<{ rows: T[]; hasMore: boolean }>,
  options: InfiniteScrollPaginationOptions = {}
) {
  const pageSize = options.pageSize ?? 20
  const threshold = options.threshold ?? 120
  const appendDelayMs = options.appendDelayMs ?? INFINITE_SCROLL_APPEND_DELAY_MS

  const items = ref<T[]>([]) as Ref<T[]>
  const pageNum = ref(0)
  const hasMore = ref(true)
  const loading = ref(false)
  const loadingMore = ref(false)
  const initialLoaded = ref(false)
  const loadError = ref(false)
  const appendTick = ref(0)

  const isEmpty = computed(() => initialLoaded.value && !loading.value && items.value.length === 0)

  async function loadNextPage(reset = false) {
    if (loading.value || loadingMore.value) return
    if (!reset && !hasMore.value) return

    const startedAt = Date.now()

    if (reset) {
      loading.value = true
      pageNum.value = 0
      hasMore.value = true
      items.value = []
      loadError.value = false
    } else {
      loadingMore.value = true
    }

    const nextPage = reset ? 1 : pageNum.value + 1
    try {
      const { rows, hasMore: more } = await fetchPage(nextPage, pageSize)
      if (!reset) {
        await waitInfiniteScrollAppendDelay(startedAt, appendDelayMs)
      }
      if (reset) {
        items.value = rows
      } else if (rows.length) {
        items.value = [...items.value, ...rows]
        appendTick.value += 1
      }
      pageNum.value = nextPage
      hasMore.value = more
      loadError.value = false
    } catch {
      loadError.value = true
      if (reset) items.value = []
    } finally {
      loading.value = false
      loadingMore.value = false
      initialLoaded.value = true
    }
  }

  function onScroll() {
    const el = scrollRootRef.value
    if (!el || loading.value || loadingMore.value || !hasMore.value) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distance <= threshold) {
      void loadNextPage(false)
    }
  }

  function bindScroll() {
    scrollRootRef.value?.addEventListener('scroll', onScroll, { passive: true })
  }

  function unbindScroll() {
    scrollRootRef.value?.removeEventListener('scroll', onScroll)
  }

  async function reload() {
    await loadNextPage(true)
    await nextTick()
    bindScroll()
  }

  onBeforeUnmount(unbindScroll)

  return {
    items,
    hasMore,
    loading,
    loadingMore,
    initialLoaded,
    loadError,
    isEmpty,
    appendTick,
    reload,
    loadNextPage,
    bindScroll,
    unbindScroll,
    onScroll
  }
}
