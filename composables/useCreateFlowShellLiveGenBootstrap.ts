import { onMounted, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useCreationStore } from '~/stores/creation'
import {
  applyCreationStoreScopeLiveGenFromRoute,
  applyStep3GenVisualFromRoute,
  waitForCreationStoreHydrated
} from '~/composables/useCreationStoreHydration'
import { applyStoryboardScriptPanelsFromApi } from '~/composables/useCreateFlowStoryboardSync'
import { useStoryboardScriptBatchGenerate } from '~/composables/useStoryboardScriptBatchGenerate'
import { routePathToCreationStep } from '~/utils/createFlowRoutes'
import { purgeTerminalStep3ModalSseTasks } from '~/utils/step3LiveGenRestore'
import { purgeTerminalStep4LiveGenTasks } from '~/utils/step4LiveGenRestore'
import { dispatchCreateFlowScopeChanged } from '~/utils/createFlowLiveGenEvents'

/**
 * 创作流程壳层：刷新 / 首屏进入时统一恢复各步骤的 Pinia 生成态与 SSE 跟进，
 * 使头部流程条 loading 不依赖当前停留在哪一步。
 */
export function useCreateFlowShellLiveGenBootstrap(options: {
  route: RouteLocationNormalizedLoaded
  syncProjectContextFromRoute: () => void
}) {
  const { route, syncProjectContextFromRoute } = options
  const creationStore = useCreationStore()
  const storyboardScriptGen = useStoryboardScriptBatchGenerate()

  let bootstrapGeneration = 0
  let bootstrapTimer: ReturnType<typeof setTimeout> | null = null
  let bootstrapInFlight: Promise<void> | null = null

  async function runShellLiveGenBootstrap(gen: number) {
    if (gen !== bootstrapGeneration) return
    if (!import.meta.client) return

    if (bootstrapInFlight) {
      await bootstrapInFlight
      if (gen !== bootstrapGeneration) return
    }

    const pending = (async () => {
      syncProjectContextFromRoute()
      await waitForCreationStoreHydrated(creationStore, route)
      if (gen !== bootstrapGeneration) return

      applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
      applyStep3GenVisualFromRoute(creationStore, route)
      await purgeTerminalStep3ModalSseTasks(creationStore, route)
      if (gen !== bootstrapGeneration) return
      await purgeTerminalStep4LiveGenTasks(creationStore, route)
      if (gen !== bootstrapGeneration) return

      creationStore.refreshStep3VisualGeneratingFlag()

      const onStoryboardScriptPage = routePathToCreationStep(route.path) === 'storyboard-script'
      const hasPersistedStoryboardScriptWork =
        creationStore.isGeneratingStoryboard ||
        (creationStore.storyboardScriptActiveTaskId != null &&
          Number(creationStore.storyboardScriptActiveTaskId) > 0)

      // 仅当存在进行中的分镜脚本任务且当前不在第四步时，才由壳层恢复（避免进任意步骤都预拉 task/list）
      if (!onStoryboardScriptPage && hasPersistedStoryboardScriptWork) {
        const panels = creationStore.formData.storyboardScript?.panels ?? []
        await storyboardScriptGen.restoreOngoingGenerationIfNeeded(
          panels,
          (next) => {
            if (gen !== bootstrapGeneration) return
            applyStoryboardScriptPanelsFromApi(next)
          },
          () => {
            if (gen !== bootstrapGeneration) return
            if (!creationStore.isGeneratingStoryboard) {
              creationStore.setStoryboardGenerating(true)
            }
          }
        )
        if (gen !== bootstrapGeneration) return
      }

      dispatchCreateFlowScopeChanged({ reason: 'scope-or-route' })
    })()

    bootstrapInFlight = pending
    try {
      await pending
    } finally {
      if (bootstrapInFlight === pending) bootstrapInFlight = null
    }
  }

  function scheduleShellLiveGenBootstrap() {
    if (!import.meta.client) return
    bootstrapGeneration++
    const gen = bootstrapGeneration
    if (bootstrapTimer) clearTimeout(bootstrapTimer)
    bootstrapTimer = setTimeout(() => {
      bootstrapTimer = null
      void runShellLiveGenBootstrap(gen)
    }, 48)
  }

  onMounted(() => {
    scheduleShellLiveGenBootstrap()
  })

  watch(
    () =>
      [
        creationStore.currentProjectId,
        creationStore.currentEpisodeId,
        route.query.projectId,
        route.query.episodeId
      ] as const,
    () => {
      scheduleShellLiveGenBootstrap()
    },
    { flush: 'post' }
  )

  return { scheduleShellLiveGenBootstrap }
}
