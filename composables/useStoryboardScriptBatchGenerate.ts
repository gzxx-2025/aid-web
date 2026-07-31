import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { EMPTY_COUNT_PROGRESS } from '~/utils/taskSseProgressText'
import { useRoute } from 'vue-router'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  userStoryboardGenerateScript,
  userStoryboardList
} from '~/utils/businessApi'
import { fetchFlowUserTaskListOnce, filterUserTaskRowsForEpisode } from '~/utils/userTaskListFlowOnce'
import { requestCancelUserTaskById } from '~/utils/userTaskCancelFlow'
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
import {
  fetchUserTaskDetailOnce,
  normalizeTaskStatus
} from '~/composables/useTaskSseFollow'
import { useTaskStream, type TaskProgressEventData } from '~/composables/useTaskStream'
import {
  isBenignTaskSseDisconnectMessage,
  isNavigationOrSuspendBatchMessage
} from '~/utils/taskSseSilentDisconnect'
import type { StoryboardPanel } from '~/types'
import type { UserTaskDetailData, UserTaskRow } from '~/types/business-api'

/** 临时诊断日志：排查刷新后分镜脚本 SSE 不重连问题，定位后可整段移除 */
function sbLog(...args: unknown[]): void {
  if (typeof window === 'undefined') return
  // eslint-disable-next-line no-console
  console.log('%c[storyboard-script-restore]', 'color:#7c5cff;font-weight:bold', ...args)
}

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

/** 后端防重：同 project+episode 已有进行中的分镜脚本任务 */
function isStoryboardScriptTaskBusyMessage(msg: string): boolean {
  const m = String(msg ?? '').trim()
  if (!m) return false
  return (
    m === '任务处理中' ||
    m.includes('任务处理中') ||
    m.includes('正在执行的分镜任务') ||
    m.includes('项目下有正在执行')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasPersistedStoryboards(panels: StoryboardPanel[]): boolean {
  return panels.some((p) => parseServerStoryboardId(p.id) != null)
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

let sharedStoryboardScriptBatchGen: ReturnType<
  typeof createStoryboardScriptBatchGenerate
> | null = null

function createStoryboardScriptBatchGenerate() {
  const route = useRoute()
  const creationStore = useCreationStore()

  function resolveScenePlotCountHint(): number {
    const scenes = creationStore.formData.sceneCharacter?.scenes || []
    const count = scenes.filter((s) => String(s ?? '').trim().length > 0).length
    return Math.max(count, 1)
  }

  const activeTaskId = ref<number | null>(null)
  const taskProgressMessage = ref('')
  let streamCloser: (() => void) | null = null
  let stopRequested = false
  let resumeFollowGeneration = 0
  let restoreSessionInFlight: Promise<void> | null = null
  let followInFlight: Promise<{
    ok: boolean
    panels: StoryboardPanel[]
    message?: string
  }> | null = null
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
  }) {
    creationStore.applyStoryboardScriptSseProgress(p)
  }

  function seedProgressFromDetailRecord(detail: UserTaskDetailData | null | undefined) {
    if (!detail) return
    const totalBatches = Number((detail as { totalBatches?: number }).totalBatches)
    const total = Number.isFinite(totalBatches) && totalBatches > 0 ? totalBatches : 0
    if (total > 0) {
      const cur = creationStore.storyboardGenerationProgress
      if (!cur.total || cur.total < total) {
        creationStore.setStoryboardProgress(Math.min(cur.completed, total), total)
      }
    }
  }

  async function seedProgressFromTaskDetail(taskId: number) {
    const detail = await fetchUserTaskDetailOnce(taskId)
    seedProgressFromDetailRecord(detail)
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

  type StoryboardScriptTrackOutcome = {
    ok: boolean
    partial?: boolean
    message?: string
    partialData?: TaskPartialFailedData | null
    /** SSE 断连但服务端任务仍在跑：勿清 taskId / 勿当终态失败 */
    ongoing?: boolean
  }

  function resolveOutcomeFromTaskDetail(
    detail: Awaited<ReturnType<typeof fetchUserTaskDetailOnce>>
  ): StoryboardScriptTrackOutcome | null {
    if (!detail) return null
    const status = normalizeTaskStatus(detail.status)
    if (status === 'SUCCEEDED') {
      return { ok: true }
    }
    if (status === 'PARTIAL_FAILED') {
      const parsed = parseTaskPartialFailedData(
        detail.resultData ? safeParseResultData(detail.resultData) : null
      )
      return {
        ok: false,
        partial: true,
        message: formatPartialFailedMessage(
          parsed,
          detail.errorMessage || '部分场次生成失败，可点击续生重试失败项'
        ),
        partialData: parsed
      }
    }
    if (status === 'FAILED' || status === 'CANCELLED') {
      return { ok: false, message: detail.errorMessage || '分镜生成失败' }
    }
    if (isOngoingUserTaskStatus(status)) {
      return null
    }
    return { ok: true }
  }

  function mapStreamResultToOutcome(res: Awaited<ReturnType<typeof useTaskStream>['done']>): StoryboardScriptTrackOutcome {
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
    return { ok: true }
  }

  async function trackTaskUntilDone(
    taskId: number,
    onSseProgress: (p: TaskProgressEventData) => void,
    options?: { startDetail?: UserTaskDetailData | null }
  ): Promise<StoryboardScriptTrackOutcome> {
    if (stopRequested) {
      return { ok: false, message: '已停止生成' }
    }

    const startDetail = options?.startDetail ?? null
    if (startDetail) {
      const early = resolveOutcomeFromTaskDetail(startDetail)
      if (early?.ok || early?.partial) {
        return early
      }
      const startStatus = normalizeTaskStatus(startDetail.status)
      if (startStatus === 'FAILED' || startStatus === 'CANCELLED') {
        return early ?? { ok: false, message: startDetail.errorMessage || '分镜生成失败' }
      }
    }

    const maxReconnects = 3
    let lastStreamOutcome: StoryboardScriptTrackOutcome | null = null
    const streamGen = resumeFollowGeneration

    for (let attempt = 0; attempt <= maxReconnects; attempt++) {
      if (stopRequested) {
        return { ok: false, message: '已停止生成' }
      }
      if (streamGen !== resumeFollowGeneration) {
        return {
          ok: false,
          ongoing: true,
          message: '任务仍在后台执行，请稍候或刷新页面自动恢复进度'
        }
      }

      const stream = useTaskStream(taskId)
      sbLog('SSE: 发起连接 /api/user/task/stream/' + taskId, { attempt })
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
          if (p) onSseProgress(p)
        },
        { immediate: true }
      )

      let streamResult: Awaited<ReturnType<typeof useTaskStream>['done']> | null = null
      try {
        streamResult = await stream.done
        sbLog('SSE: done', { taskId, attempt, result: streamResult })
      } catch (e) {
        streamResult = null
        sbLog('SSE: 连接异常/中断（done reject 或 close）', { taskId, attempt, err: bizErr(e), stopRequested })
      } finally {
        stopWatchProgress()
        try {
          stream.close()
        } catch {
          /* ignore */
        }
        streamCloser = null
      }

      if (stopRequested) {
        return { ok: false, message: '已停止生成' }
      }

      if (streamResult) {
        const mapped = mapStreamResultToOutcome(streamResult)
        if (mapped.ok || mapped.partial) {
          return mapped
        }
        lastStreamOutcome = mapped
        if (streamResult.type === 'cancelled' || streamResult.type === 'error') {
          break
        }
      }

      if (attempt < maxReconnects) {
        await sleep(800)
      }
    }

    // SSE 结束后仅补查一次 task/detail（不做轮询）
    const endDetail = await fetchUserTaskDetailOnce(taskId)
    const fromDetail = resolveOutcomeFromTaskDetail(endDetail)
    if (fromDetail) {
      return fromDetail
    }
    // SSE 业务失败优先于滞后的 PROCESSING detail，避免永久保活 loading
    if (lastStreamOutcome && !lastStreamOutcome.ok && lastStreamOutcome.message) {
      const msg = String(lastStreamOutcome.message)
      const isBenignDisconnect =
        isBenignTaskSseDisconnectMessage(msg) || isNavigationOrSuspendBatchMessage(msg)
      if (!isBenignDisconnect) {
        return lastStreamOutcome
      }
    }
    if (isOngoingUserTaskStatus(endDetail?.status)) {
      return {
        ok: false,
        ongoing: true,
        message: '任务仍在后台执行，请稍候或刷新页面自动恢复进度'
      }
    }
    // 无终态详情时：视为后台仍在执行（切步/suspend 断流），禁止「连接中断请稍后重试」假失败
    if (lastStreamOutcome && !lastStreamOutcome.ok && lastStreamOutcome.message) {
      const msg = String(lastStreamOutcome.message)
      if (
        msg.includes('连接中断') ||
        msg.includes('连接异常') ||
        /abort|superseded|ended unexpectedly/i.test(msg)
      ) {
        return {
          ok: false,
          ongoing: true,
          message: '任务仍在后台执行，请稍候或刷新页面自动恢复进度'
        }
      }
      return lastStreamOutcome
    }
    return {
      ok: false,
      ongoing: true,
      message:
        endDetail?.errorMessage && !String(endDetail.errorMessage).includes('连接中断')
          ? String(endDetail.errorMessage)
          : '任务仍在后台执行，请稍候或刷新页面自动恢复进度'
    }
  }

  async function followExistingTask(
    taskId: number,
    currentPanels: StoryboardPanel[],
    options?: { progressTotalHint?: number; startDetail?: UserTaskDetailData | null }
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
      const followGen = resumeFollowGeneration
      stopRequested = false
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
      if (options?.startDetail) {
        seedProgressFromDetailRecord(options.startDetail)
      } else {
        await seedProgressFromTaskDetail(taskId)
      }

      // 生成过程中只靠 SSE 更新进度文案，不轮询 storyboard/list（等终态再拉一次）
      const workingPanels = stripStoryboardScriptSkeletonPanels(currentPanels)

      const outcome = await trackTaskUntilDone(taskId, (p) => {
        if (followGen !== resumeFollowGeneration) return
        if (!matchesCreationLiveGenScope(routeCtx)) return
        applySseProgress(p)
      })
      if (followGen !== resumeFollowGeneration) {
        return {
          ok: false,
          panels: workingPanels,
          message: '任务仍在后台执行，请稍候或刷新页面自动恢复进度'
        }
      }
      if (import.meta.client) {
        window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
      }

      /** 剧集隔离：已切集时只写任务所属 scope 桶；禁止先动当前集扁平字段（syncActiveTaskIdToStore 写当前 scope） */
      if (!matchesCreationLiveGenScope(routeCtx)) {
        creationStore.mergeStep4PlusLiveGenForScopeKey(routeCtx.scopeKey, {
          isGeneratingStoryboard: false,
          storyboardGenerationProgress: { ...EMPTY_COUNT_PROGRESS },
          storyboardGenerationError: null,
          storyboardScriptActiveTaskId: null
        })
        return { ok: false, panels: workingPanels, message: '已切换作品，任务仍在后台进行' }
      }

      if (!outcome.partial && !outcome.ongoing) {
        syncActiveTaskIdToStore(null)
      }

      if (outcome.ongoing) {
        creationStore.setStoryboardGenerating(true)
        creationStore.setStoryboardError(null)
        syncActiveTaskIdToStore(taskId)
        return {
          ok: false,
          panels: workingPanels,
          message: outcome.message
        }
      }

      // 仅在任务终态（成功 / 部分失败 / 失败）后拉一次分镜列表
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
    if (restoreSessionInFlight) {
      await restoreSessionInFlight
      return
    }

    const pending = (async () => {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    sbLog('restore: enter', {
      ctx,
      isGeneratingStoryboard: creationStore.isGeneratingStoryboard,
      persistedTaskId: creationStore.storyboardScriptActiveTaskId,
      activeTaskId: activeTaskId.value
    })
    if (!ctx) {
      sbLog('restore: no project/episode context → 退出（不会连 SSE）')
      return
    }

    const gen = ++resumeFollowGeneration

    let tasks: UserTaskRow[] = []
    let taskListOk = true
    try {
      /** 剧集隔离：禁止把其它集的分镜脚本任务恢复到本集 */
      tasks = filterUserTaskRowsForEpisode(
        await fetchFlowUserTaskListOnce(ctx.projectId),
        ctx.episodeId
      )
    } catch {
      tasks = []
      taskListOk = false
    }
    if (gen !== resumeFollowGeneration) {
      sbLog('restore: 被更新的恢复请求取代（gen 不一致），本次退出', { gen, current: resumeFollowGeneration })
      return
    }

    if (followInFlight) {
      try {
        await followInFlight
      } catch {
        /* 上一轮 follow 被 cancelResumeFollow 中断 */
      }
      if (gen !== resumeFollowGeneration) return
    }

    const preferredId = creationStore.storyboardScriptActiveTaskId
    const ongoingTask = pickOngoingStoryboardScriptTask(tasks, preferredId)
    const ongoingId = parseTaskId(ongoingTask?.id)
    sbLog('restore: task/list 结果', {
      taskListOk,
      taskCount: tasks.length,
      scriptTasks: tasks
        .filter((t) => isStoryboardScriptBatchTask(t.taskType))
        .map((t) => ({ id: t.id, status: t.status })),
      preferredId,
      ongoingId
    })

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
      sbLog('restore: 命中进行中任务 → 重连 SSE', { ongoingId })
      if (!creationStore.isGeneratingStoryboard) {
        creationStore.setStoryboardGenerating(true)
        creationStore.setStoryboardError(null)
      }
      if (!stripStoryboardScriptSkeletonPanels(currentPanels).length) {
        onShowGeneratingSkeleton()
      }

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
        } else if (result.message?.includes('仍在后台执行')) {
          /* SSE 断连但任务未终态：保留 generating 与 taskId，供刷新后继续跟进 */
        } else {
          applyStoryboardScriptFailedOutcome(
            result.message || '分镜生成失败，请稍后重试。',
            result.panels
          )
        }

      }

      return
    }

    // 列表查询失败（刷新瞬时的网络 / 鉴权竞态）：不能据此判定任务已结束，
    // 保留 generating 与持久化 taskId，等下次恢复（watch / onMounted 再次触发）重试，避免误停导致 SSE 不再重连。
    if (!taskListOk) {
      sbLog('restore: task/list 查询失败 → 保留状态，等待下次重试（不连 SSE 也不清状态）')
      return
    }

    // 列表里没有「进行中」的脚本任务，但本地仍持久化了 taskId：
    // 用 task/detail 兜底确认真实终态（SSE 建连即终态补发，detail 比 list 更可靠），
    // 避免因列表瞬时缺失 / 主从延迟而误判任务已结束、错误清空 loading 与 taskId。
    if (prefId && !isTaskFollowPaused(prefId)) {
      const detail = await fetchUserTaskDetailOnce(prefId)
      if (gen !== resumeFollowGeneration) return
      if (!matchesCreationLiveGenScope(routeCtx)) return
      const detailStatus = normalizeTaskStatus(detail?.status)
      sbLog('restore: 列表无进行中任务，task/detail 兜底', { prefId, detailStatus })

      if (detail && isOngoingUserTaskStatus(detailStatus)) {
        sbLog('restore: detail 确认任务仍在进行 → 重连 SSE', { prefId })
        if (!creationStore.isGeneratingStoryboard) {
          creationStore.setStoryboardGenerating(true)
          creationStore.setStoryboardError(null)
        }
        if (!stripStoryboardScriptSkeletonPanels(currentPanels).length) {
          onShowGeneratingSkeleton()
        }
        const result = await followExistingTask(prefId, currentPanels, { startDetail: detail })
        if (gen !== resumeFollowGeneration) return
        if (!matchesCreationLiveGenScope(routeCtx)) return
        onPanelsUpdate(result.panels)
        if (result.ok) {
          applyStoryboardScriptSuccessOutcome()
        } else if (!stopRequested) {
          if (result.message?.includes('部分') || result.message?.includes('续生')) {
            /* followExistingTask 已写入 partial failed 状态 */
          } else if (result.message?.includes('仍在后台执行')) {
            /* SSE 断连但任务未终态：保留 generating 与 taskId，供下次刷新继续跟进 */
          } else {
            applyStoryboardScriptFailedOutcome(
              result.message || '分镜生成失败，请稍后重试。',
              result.panels
            )
          }
        }
        return
      }

      if (detail && detailStatus === 'PARTIAL_FAILED') {
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
          detail.resultData ? safeParseResultData(detail.resultData) : null
        )
        applyStoryboardScriptPartialFailedOutcome(
          prefId,
          formatPartialFailedMessage(
            parsed,
            detail.errorMessage || '部分场次生成失败，可点击续生重试失败项'
          ),
          parsed,
          panels
        )
        return
      }

      // detail 拿不到（任务已被清理）则视为终态缺失：继续走下方停止清理逻辑。
    }

    if (creationStore.isGeneratingStoryboard || preferredId) {
      if (matchesCreationLiveGenScope(routeCtx)) {
        // 仍在 generating 但 taskId 已被误清且列表/详情均未命中进行中：保留状态供下次 watch 重试，勿误停
        if (creationStore.isGeneratingStoryboard && !prefId && !ongoingId) {
          sbLog('restore: generating 标记仍在但无 taskId/进行中任务 → 保留状态等待重试')
          return
        }
        sbLog('restore: 未发现进行中任务、detail 也非进行中 → 停止生成并清状态', {
          isGeneratingStoryboard: creationStore.isGeneratingStoryboard,
          preferredId
        })
        creationStore.stopStoryboardGeneration()
      }
    } else {
      sbLog('restore: 无 generating 标记也无 taskId → 不处理')
    }
    })()

    restoreSessionInFlight = pending
    try {
      await pending
    } finally {
      if (restoreSessionInFlight === pending) restoreSessionInFlight = null
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
    const llmFields = await resolveStoryboardGenConfigLlmFields(
      ctx.projectId,
      STORYBOARD_GEN_CONFIG_SCENE_CODES.script,
      manualPick,
      agentCode,
      modelCode
    )
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
      const msg = bizErr(e)
      if (isStoryboardScriptTaskBusyMessage(msg)) {
        let tasks: UserTaskRow[] = []
        try {
          /** 剧集隔离：busy 续跟也只认本集任务 */
          tasks = filterUserTaskRowsForEpisode(
            await fetchFlowUserTaskListOnce(ctx.projectId),
            ctx.episodeId
          )
        } catch {
          tasks = []
        }
        const ongoingTask = pickOngoingStoryboardScriptTask(
          tasks,
          creationStore.storyboardScriptActiveTaskId
        )
        const ongoingId = parseTaskId(ongoingTask?.id)
        if (ongoingId) {
          syncActiveTaskIdToStore(ongoingId)
          creationStore.setStoryboardGenerating(true)
          creationStore.setStoryboardError(null)
          const progressTotalHint =
            Number((ongoingTask as { totalBatches?: number })?.totalBatches) > 0
              ? Number((ongoingTask as { totalBatches?: number }).totalBatches)
              : isSelective
                ? selectiveSceneIds.length
                : resolveScenePlotCountHint()
          return followExistingTask(ongoingId, currentPanels, { progressTotalHint })
        }
      }
      return { ok: false, panels: currentPanels, message: msg }
    }

    const taskId = parseTaskId(submitted.taskId)
    if (!taskId) {
      return { ok: false, panels: currentPanels, message: '提交失败：未返回任务ID' }
    }

    syncActiveTaskIdToStore(taskId)
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }

    const warningText = String(submitted.warning || '').trim()
    if (warningText) {
      message.warning(warningText)
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
    const taskId = activeTaskId.value
    if (taskId) {
      try {
        await requestCancelUserTaskById(taskId)
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
  /** 断开 SSE 并作废进行中的 follow；保留 Pinia taskId，供切步/刷新后壳层恢复 loading */
  function cancelResumeFollow() {
    resumeFollowGeneration++
    closeStream()
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

export function useStoryboardScriptBatchGenerate() {
  if (!sharedStoryboardScriptBatchGen) {
    sharedStoryboardScriptBatchGen = createStoryboardScriptBatchGenerate()
  }
  return sharedStoryboardScriptBatchGen
}
