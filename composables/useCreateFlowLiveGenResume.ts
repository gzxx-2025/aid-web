import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useCreationStore } from '~/stores/creation'
import {
  applyCreationStoreScopeLiveGenFromRoute,
  applyStep3GenVisualFromRoute,
  waitForCreationStoreHydrated
} from '~/composables/useCreationStoreHydration'
import {
  CREATE_FLOW_SCOPE_CHANGED_EVENT,
  dispatchCreateFlowScopeChanged
} from '~/utils/createFlowLiveGenEvents'

/**
 * 壳层统一调度：切作品时同步 Pinia scope 并通知当前步骤页恢复 SSE。
 */
export function useCreateFlowLiveGenResume(options: { route: RouteLocationNormalizedLoaded }) {
  const { route } = options
  const creationStore = useCreationStore()

  let resumeGeneration = 0
  let resumeTimer: ReturnType<typeof setTimeout> | null = null
  let resumeInFlight: Promise<void> | null = null

  async function runLiveGenResume(
    gen: number,
    reason: 'scope-or-route' | 'panel-return' | 'manual'
  ) {
    if (gen !== resumeGeneration) return
    if (!import.meta.client) return

    if (resumeInFlight) {
      await resumeInFlight
      if (gen !== resumeGeneration) return
    }

    const pending = (async () => {
      await waitForCreationStoreHydrated(creationStore, route)
      if (gen !== resumeGeneration) return

      applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
      applyStep3GenVisualFromRoute(creationStore, route)
      if (gen !== resumeGeneration) return

      dispatchCreateFlowScopeChanged({ reason })
    })()

    resumeInFlight = pending
    try {
      await pending
    } finally {
      if (resumeInFlight === pending) resumeInFlight = null
    }
  }

  function scheduleLiveGenResume(reason: 'scope-or-route' | 'panel-return' | 'manual') {
    if (!import.meta.client) return
    resumeGeneration++
    const gen = resumeGeneration
    if (resumeTimer) clearTimeout(resumeTimer)
    resumeTimer = setTimeout(() => {
      resumeTimer = null
      void runLiveGenResume(gen, reason)
    }, 64)
  }

  watch(
    () => [creationStore.currentProjectId, creationStore.currentEpisodeId] as const,
    () => {
      scheduleLiveGenResume('scope-or-route')
    },
    { flush: 'post' }
  )

  return { scheduleLiveGenResume }
}

/** 步骤页挂载：监听 scope 变化事件，触发一次轻量 restore（带 generation 防重入） */
export function useCreateFlowScopeChangedResume(onResume: () => void | Promise<void>) {
  if (!import.meta.client) return

  let scopeResumeGeneration = 0
  let scopeResumeInFlight: Promise<void> | null = null
  let disposed = false

  const run = async (gen: number) => {
    if (disposed || gen !== scopeResumeGeneration) return
    if (scopeResumeInFlight) {
      try {
        await scopeResumeInFlight
      } catch {
        /* The owning step handles restore errors. A newer request must still be allowed to run. */
      }
      if (disposed || gen !== scopeResumeGeneration) return
    }

    const pending = Promise.resolve().then(onResume)
    scopeResumeInFlight = pending
    try {
      await pending
    } finally {
      if (scopeResumeInFlight === pending) scopeResumeInFlight = null
    }
  }

  const handler = () => {
    const gen = ++scopeResumeGeneration
    void run(gen)
  }

  onMounted(() => {
    disposed = false
    window.addEventListener(CREATE_FLOW_SCOPE_CHANGED_EVENT, handler)
  })

  onBeforeUnmount(() => {
    disposed = true
    scopeResumeGeneration += 1
    window.removeEventListener(CREATE_FLOW_SCOPE_CHANGED_EVENT, handler)
  })
}
