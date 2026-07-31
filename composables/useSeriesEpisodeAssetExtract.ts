import { computed, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import { useCreationStore } from '~/stores/creation'
import { useCreateFlowShell } from '~/composables/useCreateFlowShell'
import { useTaskStream } from '~/composables/useTaskStream'
import { inferExtractAssetTabFromSse } from '~/utils/inferExtractAssetTabFromSse'
import { resolveStepIndexTotalFromSse } from '~/utils/taskSseProgressText'
import { isSeriesEpisodeListPath } from '~/utils/createFlowRoutes'
import { htmlPlainTextLength } from '~/utils/htmlPlain'
import { isOngoingUserTaskStatus } from '~/composables/useTaskSseFollow'
import { userTaskDetailCached } from '~/utils/businessApi'
import { fetchFlowUserTaskListOnce } from '~/utils/userTaskListFlowOnce'
import { normUserTaskType } from '~/utils/taskPartialFailed'
import type { AssetExtractType } from '~/types/business-api'

export type SeriesEpisodeAssetTab = 'characters' | 'props' | 'scenes'

export function seriesTabToExtractType(tab: SeriesEpisodeAssetTab): AssetExtractType {
  if (tab === 'characters') return 'character'
  if (tab === 'props') return 'prop'
  return 'scene'
}

export function extractTypeToSeriesTab(type: AssetExtractType): SeriesEpisodeAssetTab {
  if (type === 'character') return 'characters'
  if (type === 'prop') return 'props'
  return 'scenes'
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseExtractTypesFromCsv(raw: string): AssetExtractType[] {
  const out: AssetExtractType[] = []
  for (const tok of raw.split(/[,，]/)) {
    const k = tok.trim().toLowerCase()
    if (k === 'scene' || k === 'character' || k === 'prop') out.push(k)
  }
  return out
}

async function parseExtractTypesFromTask(taskId: number): Promise<AssetExtractType[]> {
  try {
    const detail = await userTaskDetailCached(taskId)
    const raw = detail?.inputSnapshot
    if (raw == null || !String(raw).trim()) return ['scene', 'character', 'prop']
    const s = String(raw).trim()
    try {
      const parsed = JSON.parse(s) as unknown
      if (Array.isArray(parsed)) {
        const types = parsed
          .map((x) => String(x).trim().toLowerCase())
          .filter((x): x is AssetExtractType => x === 'scene' || x === 'character' || x === 'prop')
        if (types.length) return types
      }
      if (parsed && typeof parsed === 'object') {
        const o = parsed as Record<string, unknown>
        const field = o.extractTypes ?? o.extract_types
        if (Array.isArray(field)) {
          const types = field
            .map((x) => String(x).trim().toLowerCase())
            .filter((x): x is AssetExtractType => x === 'scene' || x === 'character' || x === 'prop')
          if (types.length) return types
        }
        if (typeof field === 'string' && field.trim()) {
          const types = parseExtractTypesFromCsv(field)
          if (types.length) return types
        }
      }
    } catch {
      const types = parseExtractTypesFromCsv(s)
      if (types.length) return types
    }
  } catch {
    /* ignore */
  }
  return ['scene', 'character', 'prop']
}

async function applyExtractUiForTask(taskId: number) {
  const creationStore = useCreationStore()
  const types = await parseExtractTypesFromTask(taskId)
  creationStore.setExtractingAssets(true)
  creationStore.setExtractingStage(types[0] ?? 'scene')
  creationStore.setExtractingStages({
    scene: types.includes('scene'),
    character: types.includes('character'),
    prop: types.includes('prop')
  })
  creationStore.syncExtractUiToCurrentScope()
}

/**
 * 剧集分集列表 — 场景/角色/道具自动提取与 SSE 恢复（对齐 SceneCharacterProp 空态与提取中 UI）
 */
export function useSeriesEpisodeAssetExtract(options: {
  activeTab: Ref<SeriesEpisodeAssetTab>
  reloadAssets: (extractType?: AssetExtractType) => Promise<void>
}) {
  const route = useRoute()
  const shell = useCreateFlowShell()
  const creationStore = useCreationStore()
  const { extractingStage, extractingStages, extractingTaskProgress } = storeToRefs(creationStore)

  const activeStreamClosers = new Map<number, () => void>()
  let followSession = 0
  let resumeGeneration = 0

  const currentExtractType = computed(() => seriesTabToExtractType(options.activeTab.value))

  const isTabExtracting = computed(() => {
    if (!creationStore.isExtractingAssets) return false
    const type = currentExtractType.value
    return !!extractingStages.value[type]
  })

  const extractingLiveTitle = computed(() => {
    const type = currentExtractType.value
    const tabLabel = type === 'scene' ? '场景' : type === 'character' ? '角色' : '道具'
    const p = extractingTaskProgress.value
    const msg = String(p?.message || '').trim()
    const step = String(p?.stepTitle || '').trim()
    const live = msg || step
    if (extractingStage.value === type && live) return live
    return `正在为您提取${tabLabel}...`
  })

  const emptyExtractTips = computed(() => {
    const tab = options.activeTab.value
    if (tab === 'scenes') return '点击此按钮，为您智能提取场景'
    if (tab === 'characters') return '点击此按钮，为您智能提取角色'
    return '点击此按钮，为您智能提取道具'
  })

  const autoExtractButtonLabel = computed(() => {
    const tab = options.activeTab.value
    if (tab === 'scenes') return '自动提取场景'
    if (tab === 'characters') return '自动提取角色'
    return '自动提取道具'
  })

  function hasStoryScript(): boolean {
    return htmlPlainTextLength(creationStore.formData.storyScript.content || '') > 0
  }

  function openAutoExtractModal() {
    if (!hasStoryScript()) {
      message.warning('请先上传或编辑剧本后再自动提取')
      return
    }
    shell.openExtractModalFromScp(currentExtractType.value)
  }

  function stopExtract() {
    void shell.stopExtractAssets()
  }

  async function reloadForExtractType(type: AssetExtractType) {
    if (extractTypeToSeriesTab(type) === options.activeTab.value) {
      await options.reloadAssets(type)
    }
  }

  async function reloadAllExtractTypes() {
    const types: AssetExtractType[] = []
    if (extractingStages.value.scene) types.push('scene')
    if (extractingStages.value.character) types.push('character')
    if (extractingStages.value.prop) types.push('prop')
    if (!types.length) types.push(currentExtractType.value)
    for (const t of types) {
      await options.reloadAssets(t)
    }
  }

  async function startTrackExtractTask(taskId: number) {
    if (!import.meta.client || !isSeriesEpisodeListPath(route.path)) return
    if (activeStreamClosers.has(taskId)) return

    const scopeKey = creationStore.step3GenVisualScopeKey()
    const shellLive =
      creationStore.getAssetExtractShellLiveTaskId() === taskId &&
      creationStore.isAssetExtractSseLiveForTask(taskId)
    if (shellLive) {
      await applyExtractUiForTask(taskId)
      return
    }

    const sessionAtStart = ++followSession
    creationStore.setAssetExtractFollowTask(scopeKey, taskId)
    await applyExtractUiForTask(taskId)

    const stream = useTaskStream(taskId)
    activeStreamClosers.set(taskId, () => {
      try {
        stream.close()
      } catch {
        /* ignore */
      }
    })

    const stopWatch = watch(
      () => stream.lastProgress.value,
      (p) => {
        if (sessionAtStart !== followSession) return
        if (!p) return
        const msgText = String(p.message || '').trim()
        const titleText = String(p.stepTitle || '').trim()
        const { stepIndex, stepTotal } = resolveStepIndexTotalFromSse(p)
        creationStore.setExtractingAssets(true)
        creationStore.setExtractingTaskProgress({
          percent:
            typeof p.progress === 'number'
              ? p.progress
              : creationStore.extractingTaskProgress.percent,
          stepTitle: titleText || msgText || creationStore.extractingTaskProgress.stepTitle,
          message: msgText || titleText,
          stepIndex,
          stepTotal
        })
        creationStore.syncExtractUiToCurrentScope()
        const stage = inferExtractAssetTabFromSse({
          stage: p.stage,
          stepTitle: p.stepTitle,
          message: p.message
        })
        if (stage) {
          creationStore.setExtractingStage(stage)
          void reloadForExtractType(stage)
        }
      },
      { immediate: true }
    )

    try {
      const res = await stream.done
      if (sessionAtStart !== followSession) return
      if (res.type === 'complete' || res.type === 'partial_failed') {
        await reloadAllExtractTypes()
      }
      if (res.type === 'error') {
        message.error(res.errorMessage || '提取失败')
      } else if (res.type === 'partial_failed') {
        message.warning('部分提取失败，可在任务中心续生')
      }
    } catch (e: unknown) {
      if (sessionAtStart !== followSession) return
      const err = e as { message?: string }
      message.error(String(err?.message || '提取任务连接异常'))
    } finally {
      stopWatch()
      activeStreamClosers.delete(taskId)
      creationStore.setAssetExtractFollowTask(scopeKey, null)
      try {
        stream.close()
      } catch {
        /* ignore */
      }
      if (sessionAtStart === followSession) {
        creationStore.finishAssetExtractUiForCurrentScope()
        void reloadAllExtractTypes()
      }
    }
  }

  async function restoreOngoingExtractTask() {
    if (!import.meta.client || !isSeriesEpisodeListPath(route.path)) return
    const gen = ++resumeGeneration
    if (creationStore.isExtractingAssets && creationStore.getAssetExtractShellLiveTaskId()) {
      return
    }
    try {
      const pid = creationStore.currentProjectId
      if (!pid) return
      const list = await fetchFlowUserTaskListOnce(pid)
      if (gen !== resumeGeneration) return
      const extractTask = list.find(
        (t) =>
          normUserTaskType(t.taskType) === 'asset_extract' &&
          isOngoingUserTaskStatus(t.status)
      )
      const taskId = parseTaskId(extractTask?.id)
      if (taskId) {
        await startTrackExtractTask(taskId)
      } else if (creationStore.isExtractingAssets) {
        creationStore.finishAssetExtractUiForCurrentScope()
      }
    } catch {
      /* ignore */
    }
  }

  function handleTrackTaskEvent(event: Event) {
    if (!isSeriesEpisodeListPath(route.path)) return
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    if (normUserTaskType(detail?.taskType) !== 'asset_extract') return
    const taskId = parseTaskId(detail?.taskId)
    if (!taskId) return
    void startTrackExtractTask(taskId)
  }

  watch(
    () => creationStore.isExtractingAssets,
    (extracting, wasExtracting) => {
      if (!isSeriesEpisodeListPath(route.path)) return
      if (wasExtracting && !extracting) {
        void options.reloadAssets(currentExtractType.value)
      }
    }
  )

  watch(
    () => options.activeTab.value,
    () => {
      if (!isSeriesEpisodeListPath(route.path)) return
      if (creationStore.isExtractingAssets && isTabExtracting.value) {
        void options.reloadAssets(currentExtractType.value)
      }
    }
  )

  onMounted(() => {
    window.addEventListener('create-flow-track-task', handleTrackTaskEvent as EventListener)
    void restoreOngoingExtractTask()
  })

  onUnmounted(() => {
    followSession++
    window.removeEventListener('create-flow-track-task', handleTrackTaskEvent as EventListener)
    for (const close of activeStreamClosers.values()) {
      try {
        close()
      } catch {
        /* ignore */
      }
    }
    activeStreamClosers.clear()
  })

  return {
    isTabExtracting,
    extractingLiveTitle,
    emptyExtractTips,
    autoExtractButtonLabel,
    openAutoExtractModal,
    stopExtract
  }
}
