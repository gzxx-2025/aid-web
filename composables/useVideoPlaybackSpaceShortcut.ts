import {
  onBeforeUnmount,
  onMounted,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type WatchStopHandle
} from 'vue'

type PlaybackShortcutEntry = {
  enabled: MaybeRefOrGetter<boolean>
  toggle: () => void | Promise<void>
}

const activeEntries: PlaybackShortcutEntry[] = []
let listenerAttached = false

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="slider"]'
    )
  )
}

function onWindowKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (event.code !== 'Space' && event.key !== ' ' && event.key !== 'Spacebar') ||
    isInteractiveTarget(event.target)
  ) {
    return
  }

  const entry = [...activeEntries].reverse().find((item) => toValue(item.enabled))
  if (!entry) return
  event.preventDefault()
  void entry.toggle()
}

function attachListener() {
  if (listenerAttached || typeof window === 'undefined') return
  window.addEventListener('keydown', onWindowKeydown)
  listenerAttached = true
}

function detachListenerIfIdle() {
  if (!listenerAttached || activeEntries.length > 0 || typeof window === 'undefined') return
  window.removeEventListener('keydown', onWindowKeydown)
  listenerAttached = false
}

/** 最后激活的可见视频弹窗独占空格播放/暂停，输入控件和按钮保持原生键盘行为。 */
export function useVideoPlaybackSpaceShortcut(
  enabled: MaybeRefOrGetter<boolean>,
  toggle: () => void | Promise<void>
) {
  const entry: PlaybackShortcutEntry = { enabled, toggle }
  let stopEnabledWatch: WatchStopHandle | null = null

  function removeEntry() {
    const index = activeEntries.indexOf(entry)
    if (index >= 0) activeEntries.splice(index, 1)
  }

  function promoteEntry() {
    removeEntry()
    activeEntries.push(entry)
  }

  onMounted(() => {
    attachListener()
    stopEnabledWatch = watch(
      () => toValue(enabled),
      (active) => {
        if (active) promoteEntry()
        else removeEntry()
      },
      { immediate: true }
    )
  })
  onBeforeUnmount(() => {
    stopEnabledWatch?.()
    stopEnabledWatch = null
    removeEntry()
    detachListenerIfIdle()
  })
}
