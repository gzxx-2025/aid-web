import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const SCROLL_EPS = 2

export function useHorizontalScrollTabs() {
  const scrollerRef = ref<HTMLElement | null>(null)
  const showLeftArrow = ref(false)
  const showRightArrow = ref(false)

  let resizeObserver: ResizeObserver | null = null

  function updateArrows() {
    const el = scrollerRef.value
    if (!el) {
      showLeftArrow.value = false
      showRightArrow.value = false
      return
    }
    const { scrollLeft, clientWidth, scrollWidth } = el
    const overflow = scrollWidth > clientWidth + SCROLL_EPS
    showLeftArrow.value = overflow && scrollLeft > SCROLL_EPS
    showRightArrow.value = overflow && scrollLeft + clientWidth < scrollWidth - SCROLL_EPS
  }

  function onScroll() {
    updateArrows()
  }

  /** 按可视区域宽度翻页；不足一页则滚到尽头 */
  function scrollByPage(direction: -1 | 1) {
    const el = scrollerRef.value
    if (!el) return
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    const step = el.clientWidth
    const nextLeft =
      direction > 0
        ? Math.min(el.scrollLeft + step, maxScroll)
        : Math.max(el.scrollLeft - step, 0)
    el.scrollTo({ left: nextLeft, behavior: 'smooth' })
  }

  function scrollItemIntoView(
    selector: string,
    behavior: ScrollBehavior = 'smooth',
    padding = 8
  ) {
    const el = scrollerRef.value
    if (!el) return
    const item = el.querySelector(selector) as HTMLElement | null
    if (!item) return
    const tabLeft = item.offsetLeft
    const tabRight = tabLeft + item.offsetWidth
    const viewLeft = el.scrollLeft
    const viewRight = viewLeft + el.clientWidth
    if (tabLeft < viewLeft + padding) {
      el.scrollTo({ left: Math.max(0, tabLeft - padding), behavior })
    } else if (tabRight > viewRight - padding) {
      el.scrollTo({ left: tabRight - el.clientWidth + padding, behavior })
    }
    nextTick(updateArrows)
  }

  function refresh() {
    nextTick(updateArrows)
  }

  function bindResizeObserver() {
    resizeObserver?.disconnect()
    const el = scrollerRef.value
    if (!el || typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(() => updateArrows())
    resizeObserver.observe(el)
    const track = el.firstElementChild
    if (track) resizeObserver.observe(track)
  }

  onMounted(() => {
    nextTick(() => {
      updateArrows()
      bindResizeObserver()
    })
    if (import.meta.client) {
      window.addEventListener('resize', updateArrows)
    }
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    if (import.meta.client) {
      window.removeEventListener('resize', updateArrows)
    }
  })

  return {
    scrollerRef,
    showLeftArrow,
    showRightArrow,
    onScroll,
    scrollByPage,
    scrollItemIntoView,
    refresh,
    updateArrows
  }
}
