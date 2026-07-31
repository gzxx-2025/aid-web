import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { notifyEpisodeTimelineRebuildRequested } from '~/utils/episodeTimelineRebuildSignal'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import { userStoryboardGenerateAudioBatch } from '~/utils/businessApi'
import {
  fetchFlowUserTaskListOnce,
  filterUserTaskRowsForEpisode
} from '~/utils/userTaskListFlowOnce'
import { openRechargeModalFromInsufficientBalance } from '~/utils/api'
import {
  fetchUserTaskDetailOnce,
  isOngoingUserTaskStatus,
  normalizeTaskStatus,
  resolveUserTaskTerminalOutcome,
  suspendTaskSseFollow,
  TASK_SSE_TIMEOUT_MS,
  waitUserTaskSseTerminal
} from '~/composables/useTaskSseFollow'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import {
  modalGenSessionScopeFromScopeKey,
  modalGenSessionScopeFromStore,
  readScopedSessionItem,
  removeScopedSessionItem,
  writeScopedSessionItem,
  type ModalGenSessionScope
} from '~/utils/modalGenSessionScope'
import { createAsyncIdleBarrier } from '~/utils/asyncIdleBarrier'
import { formatStoryboardSpeakerRoles } from '~/utils/storyboardDubbingSpeaker'
import {
  isNavigationOrSuspendBatchMessage,
  isTaskBackgroundRunningMessage,
  shouldPreferSseBusinessTerminalOverOngoingDetail,
  shouldSilentStoryboardBatchToast
} from '~/utils/taskSseSilentDisconnect'
import type {
  StoryboardAudioBatchRequest,
  StoryboardAudioBatchResultData,
  StoryboardAudioBatchResultItem,
  UserTaskRow
} from '~/types/business-api'
import type { DubbingPanel, StoryboardPanel } from '~/types'

const AUDIO_BATCH_RESTORE_SESSION_KEY = 'create-flow:storyboard-audio-batch-restore'
const TASK_BACKGROUND_RUNNING_MESSAGE = '任务仍在后台执行，请稍候或刷新页面自动恢复进度'

function bizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normStoryboardAudioBatchTaskType(ty: unknown): string {
  return String(ty ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
}

export function isStoryboardAudioBatchTaskType(ty: unknown): boolean {
  return normStoryboardAudioBatchTaskType(ty) === 'storyboard_audio_generate'
}

function shouldKeepAudioBatchLoadingAfterFollowMessage(msg: unknown): boolean {
  return isTaskBackgroundRunningMessage(msg) || isNavigationOrSuspendBatchMessage(msg)
}

function parseAudioBatchTerminalData(raw: unknown): StoryboardAudioBatchResultData | null {
  if (raw == null) return null
  let o: Record<string, unknown>
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    try {
      o = JSON.parse(s) as Record<string, unknown>
    } catch {
      return null
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>
  } else {
    return null
  }
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const items = Array.isArray(o.items) ? (o.items as StoryboardAudioBatchResultItem[]) : undefined
  return {
    totalCount: num(o.totalCount),
    successCount: num(o.successCount),
    failCount: num(o.failCount),
    items
  }
}

export type StoryboardAudioBatchProgress = {
  message?: string
  percent?: number
  stepTitle?: string
  stepIndex?: number
  stepTotal?: number
  taskId?: number
}

export type StoryboardAudioBatchFollowResult =
  | { ok: true; taskId: number; partial?: boolean; data?: StoryboardAudioBatchResultData | null }
  | { ok: false; errorMessage: string }

type AudioBatchRestoreSession = {
  taskId: number
  storyboardIds: number[]
  panelIndices: number[]
}

function readAudioBatchRestoreSession(
  creationStore: ReturnType<typeof useCreationStore>,
  sessionScope?: ModalGenSessionScope | null
): AudioBatchRestoreSession | null {
  const raw = readScopedSessionItem(
    AUDIO_BATCH_RESTORE_SESSION_KEY,
    sessionScope ?? modalGenSessionScopeFromStore(creationStore)
  )
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AudioBatchRestoreSession
    const taskId = parseTaskId(parsed?.taskId)
    if (!taskId) return null
    const storyboardIds = (Array.isArray(parsed.storyboardIds) ? parsed.storyboardIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
    const panelIndices = (Array.isArray(parsed.panelIndices) ? parsed.panelIndices : [])
      .map((i) => Number(i))
      .filter((i) => Number.isFinite(i) && i >= 0)
    return { taskId, storyboardIds, panelIndices }
  } catch {
    return null
  }
}

function writeAudioBatchRestoreSession(
  creationStore: ReturnType<typeof useCreationStore>,
  payload: AudioBatchRestoreSession,
  sessionScope?: ModalGenSessionScope | null
) {
  writeScopedSessionItem(
    AUDIO_BATCH_RESTORE_SESSION_KEY,
    JSON.stringify(payload),
    sessionScope ?? modalGenSessionScopeFromStore(creationStore)
  )
}

function clearAudioBatchRestoreSession(
  creationStore: ReturnType<typeof useCreationStore>,
  sessionScope?: ModalGenSessionScope | null
) {
  removeScopedSessionItem(
    AUDIO_BATCH_RESTORE_SESSION_KEY,
    sessionScope ?? modalGenSessionScopeFromStore(creationStore)
  )
}

export async function followStoryboardAudioBatchTask(payload: {
  taskId: number
  onProgress?: (p: StoryboardAudioBatchProgress) => void
}): Promise<StoryboardAudioBatchFollowResult> {
  const taskId = Number(payload.taskId)
  const { onProgress } = payload
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return { ok: false, errorMessage: '任务ID无效' }
  }

  try {
    const terminal = await waitUserTaskSseTerminal({
      taskId,
      timeoutMs: TASK_SSE_TIMEOUT_MS,
      onProgress: (p) => {
        onProgress?.({
          taskId,
          ...p,
          percent: p.percent ?? (typeof p.progress === 'number' ? p.progress : undefined)
        })
      }
    })

    if (terminal.kind === 'superseded') {
      return { ok: false, errorMessage: 'Task SSE superseded' }
    }

    if (terminal.kind === 'timeout') {
      const detail = await fetchUserTaskDetailOnce(taskId)
      const st = normalizeTaskStatus(detail?.status)
      if (st === 'SUCCEEDED') {
        return {
          ok: true,
          taskId,
          data: parseAudioBatchTerminalData(detail?.resultData)
        }
      }
      if (st === 'PARTIAL_FAILED') {
        return {
          ok: true,
          taskId,
          partial: true,
          data: parseAudioBatchTerminalData(detail?.resultData)
        }
      }
      if (isOngoingUserTaskStatus(st)) {
        return { ok: false, errorMessage: TASK_BACKGROUND_RUNNING_MESSAGE }
      }
      if (st === 'CANCELLED') return { ok: false, errorMessage: '任务已取消' }
      if (st === 'FAILED') {
        const msg = String(detail?.errorMessage || '配音生成失败')
        openRechargeModalFromInsufficientBalance(msg)
        return { ok: false, errorMessage: msg }
      }
      return { ok: false, errorMessage: '配音生成超时，请稍后在生成记录中查看' }
    }

    const r = terminal.event
    let terminalData: StoryboardAudioBatchResultData | null = null
    if (r.type === 'complete' || r.type === 'partial_failed') {
      terminalData = parseAudioBatchTerminalData(r.data)
    }

    if (r.type === 'complete') {
      return { ok: true, taskId, data: terminalData }
    }
    if (r.type === 'partial_failed') {
      return { ok: true, taskId, partial: true, data: terminalData }
    }

    const detail = await fetchUserTaskDetailOnce(taskId)
    const st = normalizeTaskStatus(detail?.status)
    if (st === 'SUCCEEDED') {
      return {
        ok: true,
        taskId,
        data: parseAudioBatchTerminalData(detail?.resultData) ?? terminalData
      }
    }
    if (st === 'PARTIAL_FAILED') {
      return {
        ok: true,
        taskId,
        partial: true,
        data: parseAudioBatchTerminalData(detail?.resultData) ?? terminalData
      }
    }
    // SSE 业务 error/cancelled 优先于滞后的 PROCESSING detail，避免永久保活 loading
    if (isOngoingUserTaskStatus(st) && !shouldPreferSseBusinessTerminalOverOngoingDetail(r)) {
      return { ok: false, errorMessage: TASK_BACKGROUND_RUNNING_MESSAGE }
    }

    if (r.type === 'error') {
      const msg = r.errorMessage || String(detail?.errorMessage || '配音生成失败')
      openRechargeModalFromInsufficientBalance(msg)
      return { ok: false, errorMessage: msg }
    }
    if (r.type === 'cancelled') {
      return { ok: false, errorMessage: r.message || '任务已取消' }
    }

    return { ok: false, errorMessage: '批量配音未完成' }
  } catch (e: unknown) {
    const msg = String((e as Error)?.message || '批量配音任务异常')
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }
}

export async function runStoryboardAudioBatchTask(payload: {
  body: StoryboardAudioBatchRequest
  onProgress?: (p: StoryboardAudioBatchProgress) => void
  onSubmitted?: (p: { taskId: number; totalCount?: number }) => void
}): Promise<StoryboardAudioBatchFollowResult> {
  const { body, onProgress, onSubmitted } = payload
  let submitted: { taskId?: number; status?: string; totalCount?: number }
  try {
    submitted = await userStoryboardGenerateAudioBatch(body)
  } catch (e: unknown) {
    const msg = bizErr(e)
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }

  const taskId = parseTaskId(submitted?.taskId)
  if (!taskId) {
    return { ok: false, errorMessage: '提交失败：未返回任务ID' }
  }

  onSubmitted?.({ taskId, totalCount: submitted.totalCount })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }

  const submitStatus = normalizeTaskStatus(submitted.status)
  if (submitStatus === 'SUCCEEDED') {
    const detail = await fetchUserTaskDetailOnce(taskId)
    return {
      ok: true,
      taskId,
      data: parseAudioBatchTerminalData(detail?.resultData)
    }
  }
  if (submitStatus === 'PARTIAL_FAILED') {
    const detail = await fetchUserTaskDetailOnce(taskId)
    return {
      ok: true,
      taskId,
      partial: true,
      data: parseAudioBatchTerminalData(detail?.resultData)
    }
  }
  if (submitStatus === 'FAILED') {
    return { ok: false, errorMessage: '批量配音失败' }
  }

  onProgress?.({ taskId, message: '批量配音任务已提交…', stepTitle: '批量配音任务已提交…' })
  return followStoryboardAudioBatchTask({ taskId, onProgress })
}

function buildStoryboardIdToIndexMap(scriptPanels: StoryboardPanel[]): Map<number, number> {
  const map = new Map<number, number>()
  scriptPanels.forEach((panel, index) => {
    const sid = parseServerStoryboardId(panel.id)
    if (sid != null) map.set(sid, index)
  })
  return map
}

export function applyAudioBatchResultToPanels(
  panels: DubbingPanel[],
  scriptPanels: StoryboardPanel[],
  data: StoryboardAudioBatchResultData | null | undefined,
  fallbackVoiceName: string
): DubbingPanel[] {
  const items = data?.items ?? []
  if (!items.length) return panels
  const idToIndex = buildStoryboardIdToIndexMap(scriptPanels)
  const next = [...panels]

  for (const item of items) {
    const sid = Number(item.storyboardId)
    if (!Number.isFinite(sid) || sid <= 0) continue
    const index = idToIndex.get(sid)
    if (index == null || index < 0 || index >= next.length) continue
    const status = String(item.status || '')
      .trim()
      .toUpperCase()
    if (status !== 'SUCCEEDED') continue
    const videoUrl = String(item.dubbedVideoUrl || '').trim()
    if (!videoUrl) continue

    const panel = next[index]!
    const script = scriptPanels[index]?.scriptContent?.trim() || panel.dialogue?.trim() || ''
    const speakerRole = formatStoryboardSpeakerRoles(item.speakerRoles)
    const voiceName = panel.dubbingVoiceName || fallbackVoiceName || '无音色'
    const emotion = panel.dubbingEmotion || '中性'
    const itemId = `batch-${item.dubbedVideoRecordId ?? Date.now()}-${index}`
    const newItem = {
      id: itemId,
      url: videoUrl,
      title: `配音合成 | ${voiceName} ${emotion} ${new Date().toLocaleString('sv-SE').replace(' ', ' ')}`,
      dialogue: script,
      voiceName,
      emotion
    }
    const prevHistory = panel.dubbingGenHistory || []
    next[index] = {
      ...panel,
      dialogue: script || panel.dialogue,
      speakerRole: speakerRole !== '暂无' ? speakerRole : panel.speakerRole,
      dubbingLipSyncVideoUrl: videoUrl,
      dubbingLipSyncKey: itemId,
      dubbingGenHistory: [...prevHistory, newItem],
      status: 'done',
      storyboardDubbingConfirmed: true
    }
  }

  return next
}

function pickOngoingAudioBatchTask(
  tasks: UserTaskRow[],
  preferredTaskId?: number | null
): UserTaskRow | null {
  const ongoing = tasks
    .filter(
      (t) => t && isStoryboardAudioBatchTaskType(t.taskType) && isOngoingUserTaskStatus(t.status)
    )
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  if (!ongoing.length) return null
  const pref = parseTaskId(preferredTaskId)
  if (pref != null) {
    const hit = ongoing.find((t) => Number(t.id) === pref)
    if (hit) return hit
  }
  return ongoing[0] ?? null
}

function createStoryboardAudioBatchGenerate() {
  const route = useRoute()
  const creationStore = useCreationStore()
  const activeTaskId = ref<number | null>(null)
  let restoreInFlight: Promise<void> | null = null
  let followInFlight: Promise<StoryboardAudioBatchFollowResult> | null = null
  let followTaskId: number | null = null
  let followGeneration = 0
  const followIdleBarrier = createAsyncIdleBarrier(
    () => followInFlight != null || restoreInFlight != null
  )

  function syncActiveTaskId(taskId: number | null) {
    activeTaskId.value = taskId
  }

  async function followTaskWithUi(
    taskId: number,
    panelIndices: number[],
    onPanelsUpdate?: (next: DubbingPanel[]) => void,
    panels?: DubbingPanel[],
    scriptPanels?: StoryboardPanel[],
    fallbackVoiceName?: string,
    ownerScope: ReturnType<typeof captureCreationLiveGenScope> = captureCreationLiveGenScope()
  ): Promise<StoryboardAudioBatchFollowResult> {
    const routeCtx = ownerScope
    const sessionScope = modalGenSessionScopeFromScopeKey(routeCtx.scopeKey)
    const generation = followGeneration
    if (!matchesCreationLiveGenScope(routeCtx)) {
      return { ok: false, errorMessage: TASK_BACKGROUND_RUNNING_MESSAGE }
    }
    syncActiveTaskId(taskId)
    creationStore.setDubbingBatchGeneratingIndices(panelIndices)
    writeAudioBatchRestoreSession(
      creationStore,
      {
        taskId,
        storyboardIds: [],
        panelIndices
      },
      sessionScope
    )

    try {
      const resolved = await resolveUserTaskTerminalOutcome(taskId)
      let result: StoryboardAudioBatchFollowResult
      if (resolved.kind === 'succeeded') {
        result = {
          ok: true,
          taskId,
          data: parseAudioBatchTerminalData(resolved.detail?.resultData)
        }
      } else if (resolved.kind === 'partial_failed') {
        result = {
          ok: true,
          taskId,
          partial: true,
          data: parseAudioBatchTerminalData(resolved.detail?.resultData)
        }
      } else if (resolved.kind === 'cancelled') {
        result = { ok: false, errorMessage: resolved.message || '任务已取消' }
      } else if (resolved.kind === 'failed') {
        result = {
          ok: false,
          errorMessage: resolved.errorMessage || '批量配音失败'
        }
      } else {
        result = await followStoryboardAudioBatchTask({
          taskId,
          onProgress: () => {
            if (!matchesCreationLiveGenScope(routeCtx)) return
          }
        })
      }

      if (generation !== followGeneration) {
        return { ok: false, errorMessage: TASK_BACKGROUND_RUNNING_MESSAGE }
      }

      if (!matchesCreationLiveGenScope(routeCtx)) {
        return { ok: false, errorMessage: '已切换作品' }
      }

      if (result.ok === false) {
        if (shouldKeepAudioBatchLoadingAfterFollowMessage(result.errorMessage)) {
          return {
            ...result,
            errorMessage: isNavigationOrSuspendBatchMessage(result.errorMessage)
              ? TASK_BACKGROUND_RUNNING_MESSAGE
              : result.errorMessage
          }
        }
        syncActiveTaskId(null)
        clearAudioBatchRestoreSession(creationStore, sessionScope)
        creationStore.setDubbingBatchGeneratingIndices([])
      } else {
        syncActiveTaskId(null)
        clearAudioBatchRestoreSession(creationStore, sessionScope)
        creationStore.setDubbingBatchGeneratingIndices([])
      }

      if (result.ok === false) {
        if (!shouldSilentStoryboardBatchToast(result.errorMessage)) {
          message.error(result.errorMessage || '批量配音失败')
        }
        return result
      }

      if (panels && scriptPanels && onPanelsUpdate) {
        const next = applyAudioBatchResultToPanels(
          panels,
          scriptPanels,
          result.data,
          fallbackVoiceName || '无音色'
        )
        onPanelsUpdate(next)

        const successCount = result.data?.successCount
        const failCount = result.data?.failCount
        if (result.partial && failCount != null && failCount > 0) {
          message.warning(
            successCount != null
              ? `批量配音完成：成功 ${successCount} 条，失败 ${failCount} 条`
              : `部分分镜配音失败（${failCount} 条）`
          )
        } else {
          message.success('批量配音已完成')
        }
        notifyEpisodeTimelineRebuildRequested()
      }

      return result
    } catch (e: unknown) {
      if (generation !== followGeneration || !matchesCreationLiveGenScope(routeCtx)) {
        return { ok: false, errorMessage: TASK_BACKGROUND_RUNNING_MESSAGE }
      }
      if (!shouldKeepAudioBatchLoadingAfterFollowMessage((e as Error)?.message)) {
        creationStore.setDubbingBatchGeneratingIndices([])
        clearAudioBatchRestoreSession(creationStore, sessionScope)
        syncActiveTaskId(null)
      }
      throw e
    }
  }

  async function followTaskWithUiOwned(
    taskId: number,
    panelIndices: number[],
    onPanelsUpdate?: (next: DubbingPanel[]) => void,
    panels?: DubbingPanel[],
    scriptPanels?: StoryboardPanel[],
    fallbackVoiceName?: string,
    ownerScope?: ReturnType<typeof captureCreationLiveGenScope>
  ): Promise<StoryboardAudioBatchFollowResult> {
    while (followInFlight) {
      if (followTaskId === taskId) return followInFlight
      try {
        await followInFlight
      } catch {
        /* 前一任务释放所有权后，下一任务再开始。 */
      }
    }

    const pending = followTaskWithUi(
      taskId,
      panelIndices,
      onPanelsUpdate,
      panels,
      scriptPanels,
      fallbackVoiceName,
      ownerScope
    )
    followInFlight = pending
    followTaskId = taskId
    try {
      return await pending
    } finally {
      if (followInFlight === pending) {
        followInFlight = null
        followTaskId = null
      }
      followIdleBarrier.notifyStateChange()
    }
  }

  async function runBatchForIndices(opts: {
    panelIndices: number[]
    scriptPanels: StoryboardPanel[]
    panels: DubbingPanel[]
    overwrite: boolean
    voiceLibraryId?: number
    emotion?: string
    onPanelsUpdate: (next: DubbingPanel[]) => void
    onGenerating?: (v: boolean) => void
  }): Promise<{ ok: boolean; message?: string; partial?: boolean }> {
    const {
      panelIndices,
      scriptPanels,
      panels,
      overwrite,
      voiceLibraryId,
      emotion,
      onPanelsUpdate,
      onGenerating
    } = opts

    if (!panelIndices.length) {
      return { ok: false, message: '请选择分镜' }
    }

    const routeCtx = captureCreationLiveGenScope()
    const generationAtEntry = followGeneration
    const sessionScope = modalGenSessionScopeFromScopeKey(routeCtx.scopeKey)
    const isInterrupted = () =>
      generationAtEntry !== followGeneration || !matchesCreationLiveGenScope(routeCtx)

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
    }
    if (isInterrupted()) {
      return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE }
    }

    const storyboardIds = panelIndices
      .map((i) => parseServerStoryboardId(scriptPanels[i]?.id ?? panels[i]?.id))
      .filter((id): id is number => id != null)

    if (!storyboardIds.length) {
      return { ok: false, message: '分镜尚未保存到服务端，请稍后再试' }
    }

    const body: StoryboardAudioBatchRequest = {
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      storyboardIds,
      overwrite,
      resolution: 'FHD',
      ...(voiceLibraryId != null && voiceLibraryId > 0 ? { voiceLibraryId } : {}),
      ...(emotion ? { emotion } : {})
    }

    const fallbackVoiceName = panels[panelIndices[0]!]?.dubbingVoiceName || '无音色'

    creationStore.setDubbingBatchGeneratingIndices(panelIndices)
    onGenerating?.(true)

    writeAudioBatchRestoreSession(
      creationStore,
      {
        taskId: 0,
        storyboardIds,
        panelIndices
      },
      sessionScope
    )

    try {
      const submitted = await userStoryboardGenerateAudioBatch(body)
      const taskId = parseTaskId(submitted?.taskId)
      if (!taskId) {
        if (isInterrupted()) {
          creationStore.mergeStep4PlusLiveGenForScopeKey(routeCtx.scopeKey, {
            dubbingBatchGeneratingIndices: panelIndices
          })
          return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE }
        }
        creationStore.setDubbingBatchGeneratingIndices([])
        clearAudioBatchRestoreSession(creationStore, sessionScope)
        onGenerating?.(false)
        return { ok: false, message: '提交失败：未返回任务ID' }
      }

      writeAudioBatchRestoreSession(
        creationStore,
        {
          taskId,
          storyboardIds,
          panelIndices
        },
        sessionScope
      )

      if (isInterrupted()) {
        creationStore.mergeStep4PlusLiveGenForScopeKey(routeCtx.scopeKey, {
          dubbingBatchGeneratingIndices: panelIndices
        })
        return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
      }

      const result = await followTaskWithUiOwned(
        taskId,
        panelIndices,
        onPanelsUpdate,
        panels,
        scriptPanels,
        fallbackVoiceName,
        routeCtx
      )

      if (!matchesCreationLiveGenScope(routeCtx)) {
        return { ok: false, message: '已切换作品' }
      }

      if (result.ok === false) {
        if (shouldKeepAudioBatchLoadingAfterFollowMessage(result.errorMessage)) {
          return {
            ok: false,
            message: isNavigationOrSuspendBatchMessage(result.errorMessage)
              ? TASK_BACKGROUND_RUNNING_MESSAGE
              : result.errorMessage
          }
        }
        onGenerating?.(false)
        return { ok: false, message: result.errorMessage }
      }

      onGenerating?.(false)

      return { ok: true, partial: result.partial }
    } catch (e: unknown) {
      if (isInterrupted()) {
        creationStore.mergeStep4PlusLiveGenForScopeKey(routeCtx.scopeKey, {
          dubbingBatchGeneratingIndices: panelIndices
        })
        return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE }
      }
      creationStore.setDubbingBatchGeneratingIndices([])
      clearAudioBatchRestoreSession(creationStore, sessionScope)
      syncActiveTaskId(null)
      onGenerating?.(false)
      const msg = bizErr(e)
      openRechargeModalFromInsufficientBalance(msg)
      message.error(msg)
      return { ok: false, message: msg }
    }
  }

  async function restoreOngoingBatchIfNeeded(opts: {
    panels: DubbingPanel[]
    scriptPanels: StoryboardPanel[]
    onPanelsUpdate: (next: DubbingPanel[]) => void
    onGenerating?: (v: boolean) => void
  }) {
    if (!import.meta.client) return
    if (restoreInFlight || followInFlight) return

    const routeCtx = captureCreationLiveGenScope()
    const generationAtEntry = followGeneration
    const sessionScope = modalGenSessionScopeFromScopeKey(routeCtx.scopeKey)
    const isInterrupted = () =>
      generationAtEntry !== followGeneration || !matchesCreationLiveGenScope(routeCtx)

    const session = readAudioBatchRestoreSession(creationStore, sessionScope)
    const panelIndices = session?.panelIndices?.length
      ? session.panelIndices
      : [...creationStore.dubbingBatchGeneratingIndices]

    if (!panelIndices.length) return

    let taskId = parseTaskId(session?.taskId) ?? parseTaskId(activeTaskId.value)

    if (!taskId) {
      try {
        const ctx = await resolveStoryScriptSaveContext(creationStore, route)
        if (!ctx) return
        if (isInterrupted()) return
        /** 剧集隔离：禁止把其它集的配音批量任务恢复到本集 */
        const rows = filterUserTaskRowsForEpisode(
          await fetchFlowUserTaskListOnce(ctx.projectId),
          ctx.episodeId
        )
        const hit = pickOngoingAudioBatchTask(rows)
        taskId = parseTaskId(hit?.id)
        if (isInterrupted()) return
      } catch {
        return
      }
    }

    if (!taskId) {
      if (!creationStore.dubbingBatchGeneratingIndices.length) return
      creationStore.setDubbingBatchGeneratingIndices([])
      clearAudioBatchRestoreSession(creationStore, sessionScope)
      return
    }

    const pending = (async () => {
      opts.onGenerating?.(true)
      try {
        await followTaskWithUiOwned(
          taskId!,
          panelIndices,
          opts.onPanelsUpdate,
          opts.panels,
          opts.scriptPanels,
          undefined,
          routeCtx
        )
      } finally {
        opts.onGenerating?.(false)
      }
    })()
    const owner = pending.finally(() => {
      restoreInFlight = null
      followIdleBarrier.notifyStateChange()
    })
    restoreInFlight = owner
    return owner
  }

  /** Disconnect this page's SSE while preserving its restore session and loading state. */
  function cancelResumeFollow(): Promise<void> {
    followGeneration++
    const taskId = followTaskId ?? activeTaskId.value
    if (taskId != null) suspendTaskSseFollow(taskId)
    activeTaskId.value = null
    return followIdleBarrier.waitForIdle()
  }

  return {
    activeTaskId,
    runBatchForIndices,
    restoreOngoingBatchIfNeeded,
    cancelResumeFollow,
    waitForFollowIdle: followIdleBarrier.waitForIdle
  }
}

export function useStoryboardAudioBatchGenerate() {
  return createStoryboardAudioBatchGenerate()
}
