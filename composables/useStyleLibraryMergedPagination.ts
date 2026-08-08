import { computed, nextTick, ref, watch, type Ref } from 'vue'
import {
  dedupeStyleLibraryCardsPreferOfficial,
  type StyleLibraryCard
} from '~/composables/usePromptDictionary'
import { useInfiniteScrollPagination } from '~/composables/useInfiniteScrollPagination'
import { userAssetMergedPage } from '~/utils/businessApi'
import {
  isOfficialStyleLibraryCard,
  mapMergedAssetsToStyleCards,
  orderStyleLibraryCardsCustomFirst,
  STYLE_LIBRARY_PAGE_SIZE
} from '~/utils/mapMergedStyleAssets'

/**
 * 精选风格库：合并资产分页（默认 50/页）+ 触底加载。
 * 滚动容器由调用方提供（创建弹窗右侧 / 流程页配置同一套 GlobalSetting）。
 * 触底监听请用 onScrollWhenExpanded，避免折叠态误加载。
 */
export function useStyleLibraryMergedPagination(scrollRootRef: Ref<HTMLElement | null>) {
  /** 供 fetchPage 读取当前已加载列表（避免闭包引用尚未赋值的 pagination） */
  const loadedCards = ref<StyleLibraryCard[]>([])

  const pagination = useInfiniteScrollPagination<StyleLibraryCard>(
    scrollRootRef,
    async (pageNum, pageSize) => {
      const { list, total } = await userAssetMergedPage({
        assetType: 'style',
        pageNum,
        pageSize
      })
      const existing = pageNum === 1 ? [] : loadedCards.value
      const skipIds = new Set(existing.map((c) => c.id))
      const officialFeaturedStart = existing.filter(isOfficialStyleLibraryCard).length
      const rows = mapMergedAssetsToStyleCards(list, { officialFeaturedStart, skipIds })
      return {
        rows,
        hasMore: pageNum * pageSize < total
      }
    },
    { pageSize: STYLE_LIBRARY_PAGE_SIZE }
  )

  watch(
    () => pagination.items.value,
    (v) => {
      loadedCards.value = v
    },
    { immediate: true, flush: 'sync' }
  )

  const customStyles = computed(() =>
    pagination.items.value.filter((c) => !isOfficialStyleLibraryCard(c))
  )

  const officialStyles = computed(() =>
    pagination.items.value.filter(isOfficialStyleLibraryCard)
  )

  const mergedStyleList = computed(() =>
    dedupeStyleLibraryCardsPreferOfficial(
      orderStyleLibraryCardsCustomFirst(pagination.items.value)
    )
  )

  function moveCustomStyleToFront(id: string) {
    const list = pagination.items.value
    const idx = list.findIndex((s) => s.id === id)
    if (idx <= 0) return
    const item = list[idx]!
    pagination.items.value = [item, ...list.filter((s) => s.id !== id)]
  }

  function onScrollWhenExpanded(expanded: boolean) {
    if (!expanded) return
    pagination.onScroll()
  }

  /** 重置加载首屏；不 bindScroll（由模板 @scroll + 展开态门闩控制） */
  async function reload() {
    pagination.unbindScroll()
    await pagination.loadNextPage(true)
    await nextTick()
  }

  return {
    items: pagination.items,
    hasMore: pagination.hasMore,
    loading: pagination.loading,
    loadingMore: pagination.loadingMore,
    initialLoaded: pagination.initialLoaded,
    loadError: pagination.loadError,
    isEmpty: pagination.isEmpty,
    appendTick: pagination.appendTick,
    reload,
    loadNextPage: pagination.loadNextPage,
    unbindScroll: pagination.unbindScroll,
    customStyles,
    officialStyles,
    mergedStyleList,
    moveCustomStyleToFront,
    onScrollWhenExpanded,
    pageSize: STYLE_LIBRARY_PAGE_SIZE
  }
}
