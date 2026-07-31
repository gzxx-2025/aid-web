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
}): {
  headerTabs: Ref<StoryboardModalHeaderTab[]>
  headerLoading: Ref<boolean>
  projectRecordRows: Ref<StoryboardRecordRow[]>
  refreshHeaderTabs: (force?: boolean) => Promise<void>
} {
  const headerTabs = ref<StoryboardModalHeaderTab[]>([])
  const headerLoading = ref(false)
  const projectRecordRows = ref<StoryboardRecordRow[]>([])
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
        void refreshHeaderTabs(true)
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
