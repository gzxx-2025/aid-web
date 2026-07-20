import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  userStoryboardGenerateScript,
  userStoryboardList,
  userTaskCancel,
  userTaskDetail,
  userTaskList
} from '~/utils/businessApi'
import {
  formatPartialFailedMessage,
  isUserTaskStatusPartialFailed,
  parseTaskPartialFailedData,
  resumeUserTask,
  type TaskPartialFailedData
} from '~/utils/taskPartialFailed'
import { applyStoryboardScriptPanelsFromApi } from '~/composables/useCreateFlowStoryboardSync'
import {
  getPersistedStoryboardScriptPanels,
  mapStoryboardListRowToPanel,
  stripStoryboardScriptSkeletonPanels
} from '~/utils/storyboardPanelMap'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import {
  STORYBOARD_GEN_CONFIG_SCENE_CODES,
  resolveStoryboardGenConfigLlmFields
} from '~/utils/projectGenConfig'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import { useTaskStream } from '~/composables/useTaskStream'
import type { StoryboardPanel } from '~/types'
import type { UserTaskRow } from '~/types/business-api'

function bizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normStoryboardScriptTaskType(ty: unknown): string {
  return String(ty ?? '').trim().toLowerCase().replace(/-/g, '_')
}

function isStoryboardScriptBatchTask(ty: unknown): boolean {
  return normStoryboardScriptTaskType(ty) === 'storyboard_script_batch'
}

function isOngoingUserTaskStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase()
  return s === 'PENDING' || s === 'PROCESSING' || s === 'RUNNING' || s === 'QUEUED' || s === 'WAITING'
}

function hasPersistedStoryboards(panels: StoryboardPanel[]): boolean {
  return panels.some((p) => parseServerStoryboardId(p.id) != null)
}

function resolveScenePlotCountHint(): number {
  const scenes = creationStore.formData.sceneCharacter?.scenes || []
  const count = scenes.filter((s) => String(s ?? '').trim().length > 0).length
  return Math.max(count, 1)
}

function safeParseResultData(raw: unknown): unknown {
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  const s = String(raw).trim()
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

export function useStoryboardScriptBatchGenerate() {
  const route = useRoute()
  const creationStore = useCreationStore()

  const activeTaskId = ref<number | null>(null)
  const taskProgressMessage = ref('')
  let streamCloser: (() => void) | null = null
  let stopRequested = false
  let resumeFollowGeneration = 0
  let followInFlight: Promise<{
    ok: boolean
    panels: StoryboardPanel[]
    message?: string
  }> | null = null
  let panelRefreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastPanelRefreshStepIndex = -1

  function closeStream() {
    const close = streamCloser
    streamCloser = null
    if (close) {
      try {
        close()
      } catch {
        /* ignore */
      }
    }
  }

  function syncActiveTaskIdToStore(taskId: number | null) {
    activeTaskId.value = taskId
    creationStore.setStoryboardScriptActiveTaskId(taskId)
  }

  async function refreshPanelsFromApi(): Promise<StoryboardPanel[]> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return []
    const list = await userStoryboardList({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId
    })
    const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const panels = sorted.map((row, index) => mapStoryboardListRowToPanel(row, index))
    applyStoryboardScriptPanelsFromApi(panels)
    return panels
  }

  function applySseProgress(p: {
    progress?: number
    stepIndex?: number
    stepTotal?: number
    message?: string
    stepTitle?: string
    stepId?: string
  }) {
    const msg = String(p.message || p.stepTitle || '').trim()
    if (msg) {
      taskProgressMessage.value = msg
    } else if (p.stepId === 'storyboard_script') {
      taskProgressMessage.value = '正在生成分镜脚本…'
    }

    const totalFromSteps =
      typeof p.stepTotal === 'number' && p.stepTotal > 0 ? p.stepTotal : null
    const completedFromSteps =
      typeof p.stepIndex === 'number' && p.stepIndex >= 0 ? p.stepIndex : null

    if (totalFromSteps != null && completedFromSteps != null) {
      creationStore.setStoryboardProgress(completedFromSteps, totalFromSteps)
      return
    }

    const percent = typeof p.progress === 'number' ? p.progress : null
    const cur = creationStore.storyboardGenerationProgress
    const total = Math.max(cur.total || 1, 1)
    if (percent != null) {
      const completed = Math.min(total, Math.max(0, Math.round((percent / 100) * total)))
      creationStore.setStoryboardProgress(completed, total)
    }
  }

  async function seedProgressFromTaskDetail(taskId: number) {
    try {
      const detail = await userTaskDetail({ taskId })
      const totalBatches = Number((detail as { totalBatches?: number }).totalBatches)
      const total = Number.isFinite(totalBatches) && totalBatches > 0 ? totalBatches : 0
      if (total > 0) {
        const cur = creationStore.storyboardGenerationProgress
        if (!cur.total || cur.total < total) {
          creationStore.setStoryboardProgress(Math.min(cur.completed, total), total)
        }
      }
    } catch {
      /* ignore */
    }
  }

  function applyStoryboardScriptSuccessOutcome() {
    creationStore.clearStoryboardScriptGenerationOutcome()
    creationStore.setStoryboardGenerating(false)
  }

  function resetStoryboardScriptListToEmpty() {
    applyStoryboardScriptPanelsFromApi([])
    creationStore.setStoryboardProgress(0, 0)
  }

  function shouldPersistStoryboardScriptGenerationError(panels: StoryboardPanel[]): boolean {
    return getPersistedStoryboardScriptPanels(panels).length > 0
  }

  function applyStoryboardScriptPartialFailedOutcome(
    taskId: number,
    message: string,
    partialData: TaskPartialFailedData | null,
    panels: StoryboardPanel[]
  ) {
    if (!shouldPersistStoryboardScriptGenerationError(panels)) {
      creationStore.clearStoryboardScriptGenerationOutcome()
      resetStoryboardScriptListToEmpty()
      creationStore.setStoryboardGenerating(false)
      return
    }
    creationStore.setStoryboardPartialFailedOutcome(message, taskId, partialData)
  }

  function applyStoryboardScriptFailedOutcome(message: string, panels: StoryboardPanel[]) {
    creationStore.clearStoryboardScriptGenerationOutcome()
    if (shouldPersistStoryboardScriptGenerationError(panels)) {
      creationStore.setStoryboardError(message)
    } else {
      resetStoryboardScriptListToEmpty()
    }
    creationStore.setStoryboardGenerating(false)
  }

  async function trackTaskUntilDone(
    stream: ReturnType<typeof useTaskStream>
  ): Promise<{
    ok: boolean
    partial?: boolean
    message?: string
    partialData?: TaskPartialFailedData | null
  }> {
    const taskId = activeTaskId.value
    if (!taskId) {
      return { ok: false, message: '任务ID无效' }
    }

    try {
      const res = await stream.done
      if (stopRequested) {
        return { ok: false, message: '已停止生成' }
      }
      if (res.type === 'cancelled') {
        return { ok: false, message: res.message || '任务已取消' }
      }
      if (res.type === 'error') {
        return { ok: false, message: res.errorMessage || '分镜生成失败' }
      }
      if (res.type === 'partial_failed') {
        return {
          ok: false,
          partial: true,
          message: formatPartialFailedMessage(
            res.data,
            '部分场次生成失败，可点击续生重试失败项'
          ),
          partialData: res.data
        }
      }

      const detail = await userTaskDetail({ taskId }).catch(() => null)
      const status = String(detail?.status ?? 'SUCCEEDED').toUpperCase()
      if (status === 'SUCCEEDED') {
        return { ok: true }
      }
      if (status === 'PARTIAL_FAILED') {
        const parsed = parseTaskPartialFailedData(
          detail?.resultData ? safeParseResultData(detail.resultData) : null
        )
        return {
          ok: false,
          partial: true,
          message: formatPartialFailedMessage(
            parsed,
            detail?.errorMessage || '部分场次生成失败，可点击续生重试失败项'
          ),
          partialData: parsed
        }
      }
      if (status === 'FAILED' || status === 'CANCELLED') {
        return { ok: false, message: detail?.errorMessage || '分镜生成失败' }
      }
      return { ok: true }
    } finally {
      closeStream()
    }
  }

  function clearPanelRefreshDebounce() {
    if (panelRefreshDebounceTimer) {
      clearTimeout(panelRefreshDebounceTimer)
      panelRefreshDebounceTimer = null
    }
    lastPanelRefreshStepIndex = -1
  }

  function schedulePanelsRefreshFromApi(routeCtx: ReturnType<typeof captureCreationLiveGenScope>) {
    if (panelRefreshDebounceTimer) clearTimeout(panelRefreshDebounceTimer)
    panelRefreshDebounceTimer = setTimeout(() => {
      panelRefreshDebounceTimer = null
      if (stopRequested || !matchesCreationLiveGenScope(routeCtx)) return
      void refreshPanelsFromApi().catch(() => {
        /* 生成中列表刷新失败不阻断 SSE */
      })
    }, 500)
  }

  async function followExistingTask(
    taskId: number,
    currentPanels: StoryboardPanel[],
    options?: { progressTotalHint?: number }
  ): Promise<{
    ok: boolean
    panels: StoryboardPanel[]
    message?: string
  }> {
    const run = async (): Promise<{
      ok: boolean
      panels: StoryboardPanel[]
      message?: string
    }> => {
      stopRequested = false
      clearPanelRefreshDebounce()
      const routeCtx = captureCreationLiveGenScope()
      syncActiveTaskIdToStore(taskId)
      creationStore.setStoryboardGenerating(true)
      creationStore.setStoryboardError(null)

      const progressTotal = Math.max(
        options?.progressTotalHint ?? 0,
        creationStore.storyboardGenerationProgress.total || 0,
        resolveScenePlotCountHint(),
        1
      )
      if (!creationStore.storyboardGenerationProgress.total) {
        creationStore.setStoryboardProgress(0, progressTotal)
      }
      await seedProgressFromTaskDetail(taskId)

      // 恢复跟进时先拉一次列表，避免仅连 SSE 而界面无真实分镜数据
      let workingPanels = stripStoryboardScriptSkeletonPanels(currentPanels)
      try {
        workingPanels = await refreshPanelsFromApi()
      } catch {
        /* 列表暂不可用时沿用当前数据 */
      }

      const stream = useTaskStream(taskId)
      streamCloser = () => {
        try {
          stream.close()
        } catch {
          /* ignore */
        }
      }
      const stopWatchProgress = watch(
        () => stream.lastProgress.value,
        (p) => {
          if (!p || !matchesCreationLiveGenScope(routeCtx)) return
          applySseProgress(p)
          const stepIndex =
            typeof p.stepIndex === 'number' && Number.isFinite(p.stepIndex) ? p.stepIndex : null
          if (stepIndex != null && stepIndex > lastPanelRefreshStepIndex) {
            lastPanelRefreshStepIndex = stepIndex
            schedulePanelsRefreshFromApi(routeCtx)
          }
        },
        { immediate: true }
      )

      const outcome = await trackTaskUntilDone(stream)
      stopWatchProgress()
      clearPanelRefreshDebounce()
      if (!outcome.partial) {
        syncActiveTaskIdToStore(null)
      }

      if (import.meta.client) {
        window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
      }

      if (!matchesCreationLiveGenScope(routeCtx)) {
        creationStore.mergeStep4PlusLiveGenForScopeKey(routeCtx.scopeKey, {
          isGeneratingStoryboard: false,
          storyboardGenerationProgress: { completed: 0, total: 0 },
          storyboardGenerationError: null,
          storyboardScriptActiveTaskId: null
        })
        return { ok: false, panels: workingPanels, message: '已切换作品，任务仍在后台进行' }
      }

      let panels = workingPanels
      try {
        panels = await refreshPanelsFromApi()
      } catch (e: unknown) {
        if (outcome.ok) {
          return { ok: false, panels: workingPanels, message: bizErr(e) || '分镜已生成，但刷新列表失败' }
        }
      }

      if (outcome.ok) {
        const total = Math.max(
          creationStore.storyboardGenerationProgress.total || progressTotal,
          progressTotal
        )
        creationStore.setStoryboardProgress(total, total)
        applyStoryboardScriptSuccessOutcome()
        return { ok: true, panels }
      }

      if (outcome.partial && taskId) {
        applyStoryboardScriptPartialFailedOutcome(
          taskId,
          outcome.message || '部分场次生成失败，可点击续生重试失败项',
          outcome.partialData ?? null,
          panels
        )
        return {
          ok: false,
          panels,
          message: outcome.message
        }
      }

      applyStoryboardScriptFailedOutcome(
        outcome.message || '分镜生成失败，请稍后重试。',
        panels
      )
      return {
        ok: false,
        panels,
        message: outcome.message
      }
    }

    const pending = run()
    followInFlight = pending
    try {
      return await pending
    } finally {
      if (followInFlight === pending) {
        followInFlight = null
      }
    }
  }

  function pickOngoingStoryboardScriptTask(
    tasks: UserTaskRow[],
    preferredTaskId?: number | null
  ): UserTaskRow | null {
    const ongoing = tasks
      .filter((t) => t && isStoryboardScriptBatchTask(t.taskType) && isOngoingUserTaskStatus(t.status))
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))

    if (!ongoing.length) return null

    const pref = parseTaskId(preferredTaskId)
    if (pref != null) {
      const hit = ongoing.find((t) => Number(t.id) === pref)
      if (hit) return hit
    }
    return ongoing[0] ?? null
  }

  function isTaskFollowPaused(taskId: number): boolean {
    return creationStore.taskIdsWithLocalFollowPaused.includes(taskId)
  }

  /**
   * 刷新或切换作品后：根据任务列表与 Pinia 持久化状态恢复分镜脚本生成 UI 与 SSE。
   */
  async function restoreOngoingGenerationIfNeeded(
    currentPanels: StoryboardPanel[],
    onPanelsUpdate: (panels: StoryboardPanel[]) => void,
    onShowGeneratingSkeleton: () => void
  ): Promise<void> {
    if (typeof window === 'undefined') return
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return

    const gen = ++resumeFollowGeneration

    let tasks: UserTaskRow[] = []
    try {
      tasks = await userTaskList({ projectId: ctx.projectId })
    } catch {
      tasks = []
    }
    if (gen !== resumeFollowGeneration) return

    const preferredId = creationStore.storyboardScriptActiveTaskId
    const ongoingTask = pickOngoingStoryboardScriptTask(tasks, preferredId)
    const ongoingId = parseTaskId(ongoingTask?.id)

    const routeCtx = captureCreationLiveGenScope()

    const prefId = parseTaskId(preferredId)
    if (prefId && !isTaskFollowPaused(prefId) && activeTaskId.value !== prefId) {
      const prefTask = tasks.find((t) => Number(t.id) === prefId)
      if (prefTask && isUserTaskStatusPartialFailed(prefTask.status)) {
        let panels = currentPanels
        try {
          panels = await refreshPanelsFromApi()
        } catch {
          /* ignore */
        }
        if (gen !== resumeFollowGeneration) return
        if (!matchesCreationLiveGenScope(routeCtx)) return
        onPanelsUpdate(panels)
        syncActiveTaskIdToStore(prefId)
        const parsed = parseTaskPartialFailedData(
          prefTask.resultData ? safeParseResultData(prefTask.resultData) : null
        )
        applyStoryboardScriptPartialFailedOutcome(
          prefId,
          formatPartialFailedMessage(
            parsed,
            prefTask.errorMessage || '部分场次生成失败，可点击续生重试失败项'
          ),
          parsed,
          panels
        )
        return
      }
    }

    if (ongoingId && !isTaskFollowPaused(ongoingId)) {
      if (!creationStore.isGeneratingStoryboard) {
        creationStore.setStoryboardGenerating(true)
        creationStore.setStoryboardError(null)
      }
      if (!stripStoryboardScriptSkeletonPanels(currentPanels).length) {
        onShowGeneratingSkeleton()
      }
      if (activeTaskId.value === ongoingId) return

      const result = await followExistingTask(ongoingId, currentPanels, {
        progressTotalHint: Number((ongoingTask as { totalBatches?: number })?.totalBatches) || undefined
      })
      if (gen !== resumeFollowGeneration) return
      if (!matchesCreationLiveGenScope(routeCtx)) return

      onPanelsUpdate(result.panels)
      if (result.ok) {
        applyStoryboardScriptSuccessOutcome()
      } else if (!stopRequested) {
        if (result.message?.includes('部分') || result.message?.includes('续生')) {
          /* followExistingTask 已写入 partial failed 状态 */
        } else {
          applyStoryboardScriptFailedOutcome(
            result.message || '分镜生成失败，请稍后重试。',
            result.panels
          )
        }
      }
      return
    }

    if (creationStore.isGeneratingStoryboard || preferredId) {
      if (matchesCreationLiveGenScope(routeCtx)) {
        creationStore.stopStoryboardGeneration()
      }
    }
  }

  /**
   * 提交批量生成分镜脚本并 SSE 追踪；成功后刷新分镜列表。
   */
  async function runBatchGenerate(
    currentPanels: StoryboardPanel[],
    options?: { manualAgentModelPick?: boolean; sceneIds?: number[] }
  ): Promise<{
    ok: boolean
    panels: StoryboardPanel[]
    message?: string
  }> {
    stopRequested = false
    taskProgressMessage.value = ''
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, panels: currentPanels, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
    }

    const manualPick = options?.manualAgentModelPick === true
    const agentCode = String(creationStore.storyboardGenerateSettings.agentId || '').trim()
    const modelCode = String(creationStore.storyboardGenerateSettings.modelCode || '').trim()
    const llmFields = manualPick
      ? await resolveStoryboardGenConfigLlmFields(
          ctx.projectId,
          STORYBOARD_GEN_CONFIG_SCENE_CODES.script,
          true,
          agentCode,
          modelCode
        )
      : {}
    const mode = String(creationStore.storyboardGenerateSettings.shotDensity || '标准模式').trim()
    const selectiveSceneIds = (options?.sceneIds ?? []).filter(
      (id) => Number.isFinite(id) && id > 0
    )
    const isSelective = selectiveSceneIds.length > 0
    const overwrite = isSelective ? true : hasPersistedStoryboards(currentPanels)

    let submitted: Awaited<ReturnType<typeof userStoryboardGenerateScript>>
    try {
      submitted = await userStoryboardGenerateScript({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        ...(isSelective ? { sceneIds: selectiveSceneIds } : {}),
        ...llmFields,
        ...(mode ? { mode } : {}),
        overwrite
      })
    } catch (e: unknown) {
      return { ok: false, panels: currentPanels, message: bizErr(e) }
    }

    const taskId = parseTaskId(submitted.taskId)
    if (!taskId) {
      return { ok: false, panels: currentPanels, message: '提交失败：未返回任务ID' }
    }

    syncActiveTaskIdToStore(taskId)
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }

    const progressTotal =
      Number(submitted.totalBatches) > 0
        ? Number(submitted.totalBatches)
        : isSelective
          ? selectiveSceneIds.length
          : resolveScenePlotCountHint()

    creationStore.setStoryboardProgress(0, Math.max(progressTotal, 1))

    const result = await followExistingTask(taskId, currentPanels, { progressTotalHint: progressTotal })
    return result
  }

  async function resumePartialFailedGenerate(
    taskId: number,
    currentPanels: StoryboardPanel[]
  ): Promise<{ ok: boolean; panels: StoryboardPanel[]; message?: string }> {
    const id = parseTaskId(taskId)
    if (!id) {
      return { ok: false, panels: currentPanels, message: '任务ID无效' }
    }
    stopRequested = false
    taskProgressMessage.value = ''
    let resumeTotalBatches = 0
    try {
      const resumed = await resumeUserTask(id, 'storyboard_script_batch')
      resumeTotalBatches = Number(resumed.totalBatches)
    } catch (e: unknown) {
      return { ok: false, panels: currentPanels, message: bizErr(e) }
    }
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
    syncActiveTaskIdToStore(id)
    creationStore.setStoryboardGenerating(true)
    creationStore.setStoryboardError(null)
    creationStore.setStoryboardScriptPartialFailedData(null)
    if (Number.isFinite(resumeTotalBatches) && resumeTotalBatches > 0) {
      creationStore.setStoryboardProgress(0, resumeTotalBatches)
    }
    const result = await followExistingTask(id, currentPanels, {
      progressTotalHint: resumeTotalBatches > 0 ? resumeTotalBatches : undefined
    })
    if (result.ok) {
      applyStoryboardScriptSuccessOutcome()
    } else if (!stopRequested && !result.message?.includes('部分') && !result.message?.includes('续生')) {
      applyStoryboardScriptFailedOutcome(result.message || '分镜续生失败', result.panels)
    }
    return result
  }

  async function resumeTrackFromGlobal(
    taskId: number,
    currentPanels: StoryboardPanel[]
  ): Promise<{ ok: boolean; panels: StoryboardPanel[]; message?: string }> {
    const id = parseTaskId(taskId)
    if (!id) {
      return { ok: false, panels: currentPanels, message: '任务ID无效' }
    }
    creationStore.removePausedTaskFollow(id)
    creationStore.setStoryboardGenerating(true)
    creationStore.setStoryboardError(null)
    const result = await followExistingTask(id, currentPanels)
    if (result.ok) {
      applyStoryboardScriptSuccessOutcome()
    } else if (!stopRequested) {
      if (!result.message?.includes('部分') && !result.message?.includes('续生')) {
        applyStoryboardScriptFailedOutcome(result.message || '分镜生成失败', result.panels)
      }
    }
    return result
  }

  async function requestStop() {
    stopRequested = true
    closeStream()
    clearPanelRefreshDebounce()
    const taskId = activeTaskId.value
    if (taskId) {
      try {
        await userTaskCancel({ taskId })
      } catch {
        /* 404 等：仍停止本页展示 */
      }
    }
    if (followInFlight) {
      try {
        await followInFlight
      } catch {
        /* follow 结束时会刷新列表 */
      }
    } else {
      try {
        await refreshPanelsFromApi()
      } catch {
        /* ignore */
      }
    }
    syncActiveTaskIdToStore(null)
  }

  function onGlobalStopTask(event: Event) {
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    const id = parseTaskId(detail?.taskId)
    if (!id) return
    if (!isStoryboardScriptBatchTask(detail?.taskType) && activeTaskId.value !== id) return
    if (activeTaskId.value === id || creationStore.storyboardScriptActiveTaskId === id) {
      void requestStop()
    }
  }

  function onGlobalTrackTask(
    event: Event,
    onDone?: (result: { ok: boolean; panels: StoryboardPanel[]; message?: string }) => void
  ) {
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    if (!isStoryboardScriptBatchTask(detail?.taskType)) return
    const id = parseTaskId(detail?.taskId)
    if (!id) return
    void resumeTrackFromGlobal(id, creationStore.formData.storyboardScript.panels as StoryboardPanel[]).then(
      (result) => onDone?.(result)
    )
  }

  /** 仅中断当前 SSE 会话，不清除 Pinia 中按作品持久化的 taskId（供刷新恢复使用） */
  function cancelResumeFollow() {
    resumeFollowGeneration++
    clearPanelRefreshDebounce()
    closeStream()
    activeTaskId.value = null
  }

  return {
    activeTaskId,
    taskProgressMessage,
    runBatchGenerate,
    requestStop,
    refreshPanelsFromApi,
    restoreOngoingGenerationIfNeeded,
    resumePartialFailedGenerate,
    resumeTrackFromGlobal,
    onGlobalStopTask,
    onGlobalTrackTask,
    cancelResumeFollow
  }
}
