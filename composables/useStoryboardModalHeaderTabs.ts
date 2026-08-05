import { ref, watch, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { StoryboardRecordListType, StoryboardRecordRow } from '~/types/business-api'
import { useCreationStore } from '~/stores/creation'

type CreationStore = ReturnType<typeof useCreationStore>
import {
  buildStoryboardModalHeaderTabs,
  type StoryboardModalHeaderTab,
  type StoryboardModalSceneMeta
} from '~/utils/storyboardModalHeaderTabs'
import { fetchProjectStoryboardRecords } from '~/utils/storyboardRecordBatch'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'

type HeaderTabOptions = {
  resolveFallbackThumbnailUrl?: (sceneIndex: number) => string
  resolveDubbingConfigured?: (sceneIndex: number, composeRows: StoryboardRecordRow[]) => boolean
}

export function useStoryboardModalHeaderTabs(options: {
  open: () => boolean
  recordType: StoryboardRecordListType
  scenes: () => StoryboardModalSceneMeta[]
  creationStore: CreationStore
  route: RouteLocationNormalizedLoaded
  headerOptions?: HeaderTabOptions | (() => HeaderTabOptions | undefined)
  /**
   * 打开时是否自动 force 拉 list-by-storyboard。
   * 编辑分镜图/视频弹窗应设为 false：由 syncSceneDetailAndRestore 统一拉一次，再喂给顶部 Tab + 画布，避免双打。
   */
  autoRefreshOnOpen?: boolean
}): {
  headerTabs: Ref<StoryboardModalHeaderTab[]>
  headerLoading: Ref<boolean>
  projectRecordRows: Ref<StoryboardRecordRow[]>
  refreshHeaderTabs: (force?: boolean) => Promise<void>
} {
  const headerTabs = ref<StoryboardModalHeaderTab[]>([])
  const headerLoading = ref(false)
  const projectRecordRows = ref<StoryboardRecordRow[]>([])
  const autoRefreshOnOpen = options.autoRefreshOnOpen !== false
  let loadGen = 0

  async function refreshHeaderTabs(force?: boolean) {
    const gen = ++loadGen
    const sceneList = options.scenes()
    if (!sceneList.length) {
      headerTabs.value = []
      projectRecordRows.value = []
      return
    }

    headerLoading.value = true
    try {
      const ctx = await resolveStoryScriptSaveContext(options.creationStore, options.route)
      if (!ctx || gen !== loadGen) return

      const rows = await fetchProjectStoryboardRecords(ctx, options.recordType, { force })
      if (gen !== loadGen) return

      projectRecordRows.value = rows
      const extra =
        typeof options.headerOptions === 'function' ? options.headerOptions() : options.headerOptions
      headerTabs.value = buildStoryboardModalHeaderTabs(sceneList, rows, options.recordType, extra)
    } catch {
      if (gen !== loadGen) return
      projectRecordRows.value = []
      const extra =
        typeof options.headerOptions === 'function' ? options.headerOptions() : options.headerOptions
      headerTabs.value = buildStoryboardModalHeaderTabs(sceneList, [], options.recordType, extra)
    } finally {
      if (gen === loadGen) headerLoading.value = false
    }
  }

  watch(
    () => options.open(),
    (open) => {
      if (open) {
        if (autoRefreshOnOpen) void refreshHeaderTabs(true)
      } else {
        loadGen += 1
        headerTabs.value = []
        projectRecordRows.value = []
        headerLoading.value = false
      }
    },
    { immediate: true }
  )

  return {
    headerTabs,
    headerLoading,
    projectRecordRows,
    refreshHeaderTabs
  }
}
