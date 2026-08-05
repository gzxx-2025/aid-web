import { ref, watch } from 'vue'
import { EMPTY_COUNT_PROGRESS } from '~/utils/taskSseProgressText'
import { useRoute } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import {
  userStoryboardList,
  userStoryboardSetFinalImage,
  userStoryboardGenerateImageWithPrompt,
  userStoryboardGenerateImage
} from '~/utils/businessApi'
import {
  beginFlowTaskListQuietWindow,
  endFlowTaskListQuietWindow,
  fetchFlowUserTaskList,
  filterUserTaskRowsForEpisode
} from '~/utils/userTaskListFlowOnce'
import { requestCancelUserTaskById } from '~/utils/userTaskCancelFlow'
import {
  STORYBOARD_GEN_CONFIG_SCENE_CODES,
  resolveProjectGenImageSubmitFields,
  resolveStoryboardGenConfigLlmFields
} from '~/utils/projectGenConfig'
import {
  fetchUserTaskDetailOnce,
  isTerminalTaskStatus,
  isUserTaskTerminal,
  normalizeTaskStatus,
  resolveUserTaskTerminalOutcome,
  suspendTaskSseFollow
} from '~/composables/useTaskSseFollow'
import { isStoryboardImageGenerateTaskType, resumeUserTask } from '~/utils/taskPartialFailed'
import { followStoryboardImageBatchGenerateTask } from '~/composables/useStoryboardImageGenerateTask'
import { resumeStoryboardPromptGenerateTask } from '~/utils/storyboardPromptGenerateFlow'
import { useTaskStream } from '~/composables/useTaskStream'
import {
  extractChainChildTaskIds,
  extractChainChildTaskIdsFromTaskDetail
} from '~/utils/taskChainChild'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import {
  applyCreationStoreScopeLiveGenFromRoute,
  clearStoryboardImageGenTaskInAllScopes,
  resolveCurrentStep4LiveGenScopeBlobs
} from '~/composables/useCreationStoreHydration'
import { mapStoryboardListRowToPanel } from '~/utils/storyboardPanelMap'
import { resolveStoryboardPanelCoverImage } from '~/utils/storyboardImageCover'
import {
  fetchProjectStoryboardRecords,
  groupStoryboardRecordsByStoryboardId,
  clearProjectStoryboardRecordCache
} from '~/utils/storyboardRecordBatch'
import type { StoryboardPanel } from '~/types'
import type { StoryboardRecordRow, UserTaskRow } from '~/types/business-api'
import type { ProjectEpisodeContext } from '~/utils/storyboardRecordBatch'
import {
  syncModalPanelLoadingForActiveSession,
  isModalImageGenSessionActive,
  readModalImageGenSession
} from '~/utils/storyboardImageModalGenSession'
import {
  modalGenSessionScopeFromStore,
  readScopedSessionItem,
  removeScopedSessionItem,
  writeScopedSessionItem
} from '~/utils/modalGenSessionScope'
import { hasPersistedStoryboardImageBatchGenWork } from '~/utils/storyboardListBootstrap'
import {
  resolveImageBatchLoadingTargetIds,
  shouldClearNonTargetImageBatchPanelStatus,
  buildImageBatchScopePreserveOnContextSwitch,
  shouldRestoreImageBatchSse
} from '~/utils/storyboardImageBatchRestoreGate'
import {
  shouldKeepImageBatchLoadingAfterFollowMessage,
  isTaskBackgroundRunningMessage,
  isNavigationOrSuspendBatchMessage
} from '~/utils/taskSseSilentDisconnect'
import { createAsyncIdleBarrier } from '~/utils/asyncIdleBarrier'

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function bizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

type StoryboardPromptBatchFollowResult = {
  ok: boolean
  partial?: boolean
  message?: string
  chainChildTaskIds?: number[]
}

type StoryboardImageBatchFollowResult = {
  ok: boolean
  message?: string
  partial?: boolean
  panels?: StoryboardPanel[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const TASK_BACKGROUND_RUNNING_MESSAGE = '任务仍在后台执行，请稍候或刷新页面自动恢复进度'

function normStoryboardImagePromptBatchTaskType(ty: unknown): string {
  return String(ty ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
}

function isStoryboardImagePromptBatchTask(ty: unknown): boolean {
  return normStoryboardImagePromptBatchTaskType(ty) === 'storyboard_image_prompt_batch'
}

function isOngoingUserTaskStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase()
  return (
    s === 'PENDING' || s === 'PROCESSING' || s === 'RUNNING' || s === 'QUEUED' || s === 'WAITING'
  )
}

function panelHasCoverImage(panel: StoryboardPanel): boolean {
  return !!resolveStoryboardPanelCoverImage(panel)?.url
}

const STORYBOARD_IMAGE_BATCH_TARGET_IDS_SESSION_KEY =
  'create-flow:storyboard-image-batch-target-storyboard-ids'

function normalizeStoryboardBatchTargetIds(raw: unknown): number[] {
  const source = Array.isArray(raw) ? raw : []
  const ids = source.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  return [...new Set(ids)]
}

function readImageBatchTargetIdsSession(
  creationStore: ReturnType<typeof useCreationStore>
): number[] {
  const raw = readScopedSessionItem(
    STORYBOARD_IMAGE_BATCH_TARGET_IDS_SESSION_KEY,
    modalGenSessionScopeFromStore(creationStore)
  )
  if (!raw) return []
  try {
    return normalizeStoryboardBatchTargetIds(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeImageBatchTargetIdsSession(
  creationStore: ReturnType<typeof useCreationStore>,
  storyboardIds: number[]
): void {
  const ids = normalizeStoryboardBatchTargetIds(storyboardIds)
  if (!ids.length) {
    removeScopedSessionItem(
      STORYBOARD_IMAGE_BATCH_TARGET_IDS_SESSION_KEY,
      modalGenSessionScopeFromStore(creationStore)
    )
    return
  }
  writeScopedSessionItem(
    STORYBOARD_IMAGE_BATCH_TARGET_IDS_SESSION_KEY,
    JSON.stringify(ids),
    modalGenSessionScopeFromStore(creationStore)
  )
}

function clearImageBatchTargetIdsSession(creationStore: ReturnType<typeof useCreationStore>): void {
  removeScopedSessionItem(
    STORYBOARD_IMAGE_BATCH_TARGET_IDS_SESSION_KEY,
    modalGenSessionScopeFromStore(creationStore)
  )
}

/** 批量出图目标分镜 id：flat store → scope 桶 → session 目标快照 → status */
export function getActiveImageBatchTargetIds(
  creationStore: ReturnType<typeof useCreationStore>,
  route?: import('vue-router').RouteLocationNormalizedLoaded
): number[] {
  const persisted = creationStore.storyboardImageBatchTargetStoryboardIds
  if (persisted.length) return persisted

  const explicitFromBlob = new Set<number>()
  for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
    if (!Array.isArray(blob.storyboardImageBatchTargetStoryboardIds)) continue
    for (const id of blob.storyboardImageBatchTargetStoryboardIds) {
      const n = Number(id)
      if (Number.isFinite(n) && n > 0) explicitFromBlob.add(n)
    }
  }
  if (explicitFromBlob.size) return [...explicitFromBlob]

  const fromSession = readImageBatchTargetIdsSession(creationStore)
  if (fromSession.length) return fromSession

  const fromStatus = Object.entries(creationStore.storyboardPanelImageGenStatusByStoryboardId)
    .filter(([, st]) => st === 'generating')
    .map(([k]) => Number(k))
    .filter((id) => Number.isFinite(id) && id > 0)
  if (fromStatus.length) return fromStatus

  const fromBlob = new Set<number>()
  for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
    for (const [sidRaw, st] of Object.entries(
      blob.storyboardPanelImageGenStatusByStoryboardId ?? {}
    )) {
      if (st !== 'generating') continue
      const sid = Number(sidRaw)
      if (Number.isFinite(sid) && sid > 0) fromBlob.add(sid)
    }
  }
  return [...fromBlob]
}

function applyBatchImagePanelLoadingRestore(
  creationStore: ReturnType<typeof useCreationStore>,
  panels: StoryboardPanel[],
  modalTaskSids: Set<number>,
  batchTargetIds: number[]
) {
  const targetSet = new Set(batchTargetIds)
  for (const sid of batchTargetIds) {
    if (modalTaskSids.has(sid)) continue
    if (creationStore.storyboardPanelImageGenStatusByStoryboardId[String(sid)] === 'generating') {
      continue
    }
    creationStore.setStoryboardPanelImageGenStatus(sid, 'generating')
  }
  if (!targetSet.size) return
  for (const panel of panels) {
    const sid = parseServerStoryboardId(panel.id)
    if (sid == null) continue
    if (targetSet.has(sid) || modalTaskSids.has(sid)) continue
    if (creationStore.storyboardPanelImageGenStatusByStoryboardId[String(sid)] === 'generating') {
      creationStore.clearStoryboardPanelImageGenStatus(sid)
    }
  }
}

/**
 * 刷新/拉列表后恢复分镜图卡片 loading 到 store（与分镜脚本 isPanelImageGenerating 数据源一致）。
 * @param options.skipScopeHydrate 为 true 时跳过 scope→flat hydrate（store 变更触发的 watcher 内必须传 true，避免死循环）
 */
export function applyStoryboardImageImmediatePanelLoadingRestore(
  creationStore: ReturnType<typeof useCreationStore>,
  route: import('vue-router').RouteLocationNormalizedLoaded,
  panels: StoryboardPanel[],
  options?: { skipScopeHydrate?: boolean }
): void {
  if (!options?.skipScopeHydrate) {
    applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
  }

  /** 剧集隔离：仅当前 scope 桶（含 null/0 别名），禁止把他集分镜的 generating 灌进本集扁平 map */
  const scopeCandidates = resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)
  const modalTaskSids = new Set<number>()
  const batchTargetSids = new Set<number>()
  const generatingSids = new Set<number>()

  for (const { blob } of scopeCandidates) {
    for (const sidRaw of Object.keys(blob.storyboardImageGenTasksByStoryboardId ?? {})) {
      const sid = Number(sidRaw)
      if (Number.isFinite(sid) && sid > 0) modalTaskSids.add(sid)
    }
    for (const sidRaw of blob.storyboardImageBatchTargetStoryboardIds ?? []) {
      const sid = Number(sidRaw)
      if (Number.isFinite(sid) && sid > 0) batchTargetSids.add(sid)
    }
    for (const [sidRaw, st] of Object.entries(
      blob.storyboardPanelImageGenStatusByStoryboardId ?? {}
    )) {
      if (st !== 'generating') continue
      const sid = Number(sidRaw)
      if (Number.isFinite(sid) && sid > 0) generatingSids.add(sid)
    }
  }

  if (import.meta.client) {
    const sessionScope = modalGenSessionScopeFromStore(creationStore)
    const session = readModalImageGenSession(sessionScope)
    const sessionSid = Number(session?.storyboardId)
    if (
      Number.isFinite(sessionSid) &&
      sessionSid > 0 &&
      isModalImageGenSessionActive(sessionSid, sessionScope)
    ) {
      modalTaskSids.add(sessionSid)
    }
    syncModalPanelLoadingForActiveSession((sid) => {
      modalTaskSids.add(sid)
    }, sessionScope)
  }

  for (const sid of generatingSids) {
    if (modalTaskSids.has(sid) && !batchTargetSids.has(sid)) {
      if (creationStore.storyboardPanelImageGenStatusByStoryboardId[String(sid)] === 'generating') {
        creationStore.clearStoryboardPanelImageGenStatus(sid)
      }
      continue
    }
    if (creationStore.storyboardPanelImageGenStatusByStoryboardId[String(sid)] === 'generating') {
      continue
    }
    creationStore.setStoryboardPanelImageGenStatus(sid, 'generating')
  }

  if (
    !creationStore.isGeneratingStoryboardImageBatch &&
    !hasPersistedStoryboardImageBatchGenWork(creationStore, route)
  ) {
    return
  }

  const batchTargetIds = getActiveImageBatchTargetIds(creationStore, route)
  const isPromptOnlyImageBatch =
    creationStore.storyboardImageBatchActiveTaskId != null &&
    creationStore.storyboardImageBatchActiveImageTaskId == null
  /** 提示词 SSE 已结束、出图任务尚未写入 activeImageTaskId 的间隙，仍需保持卡片 loading */
  const isAwaitingImageGenerateBatch =
    creationStore.storyboardImageBatchActiveTaskId == null &&
    creationStore.storyboardImageBatchActiveImageTaskId == null &&
    batchTargetIds.length > 0

  if (isPromptOnlyImageBatch || isAwaitingImageGenerateBatch) {
    applyBatchImagePanelLoadingRestore(creationStore, panels, modalTaskSids, batchTargetIds)
    return
  }

  if (
    creationStore.storyboardImageBatchActiveImageTaskId != null ||
    creationStore.storyboardImageBatchTargetStoryboardIds.length > 0 ||
    batchTargetIds.length > 0
  ) {
    applyBatchImagePanelLoadingRestore(creationStore, panels, modalTaskSids, batchTargetIds)
  }
}

export function useStoryboardImageBatchGenerate() {
  const route = useRoute()
  const creationStore = useCreationStore()

  const activeTaskId = ref<number | null>(null)
  const activeImageTaskId = ref<number | null>(null)
  let streamCloser: (() => void) | null = null
  let stopRequested = false
  let resumeFollowGeneration = 0
  let followInFlight: Promise<StoryboardPromptBatchFollowResult> | null = null
  let promptFollowTaskId: number | null = null
  let imageFollowInFlight: {
    taskId: number
    promise: Promise<StoryboardImageBatchFollowResult>
  } | null = null
  let batchSseFollowInFlight = false
  let batchSseFollowDepth = 0
  let restoreSessionInFlight: Promise<void> | null = null
  let batchRunInFlight = false
  let cachedRecentProjectTasks: { projectId: number; at: number; rows: UserTaskRow[] } | null = null
  const RECENT_TASK_LIST_CACHE_MS = 4000
  const followIdleBarrier = createAsyncIdleBarrier(() => isFollowInFlight())

  async function fetchRecentProjectTasks(projectId: number): Promise<UserTaskRow[]> {
    const pid = Number(projectId)
    if (!Number.isFinite(pid) || pid <= 0) return []
    const now = Date.now()
    if (
      cachedRecentProjectTasks &&
      cachedRecentProjectTasks.projectId === pid &&
      now - cachedRecentProjectTasks.at < RECENT_TASK_LIST_CACHE_MS
    ) {
      return filterUserTaskRowsForEpisode(
        cachedRecentProjectTasks.rows,
        creationStore.currentEpisodeId
      )
    }
    const rows = await fetchFlowUserTaskList(pid, { intent: 'read' })
    cachedRecentProjectTasks = { projectId: pid, at: now, rows }
    /** 剧集隔离：禁止把其它集的分镜图任务恢复到本集 */
    return filterUserTaskRowsForEpisode(rows, creationStore.currentEpisodeId)
  }

  function invalidateRecentProjectTasksCache() {
    cachedRecentProjectTasks = null
  }

  function beginBatchSseFollow() {
    batchSseFollowDepth += 1
    batchSseFollowInFlight = true
  }

  function endBatchSseFollow() {
    batchSseFollowDepth = Math.max(0, batchSseFollowDepth - 1)
    batchSseFollowInFlight = batchSseFollowDepth > 0
    followIdleBarrier.notifyStateChange()
  }

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
    creationStore.setStoryboardImageBatchActiveTaskId(taskId)
  }

  function syncActiveImageTaskIdToStore(taskId: number | null) {
    activeImageTaskId.value = taskId
    creationStore.setStoryboardImageBatchActiveImageTaskId(taskId)
  }

  function setImageBatchTargetIds(storyboardIds: number[]) {
    creationStore.setStoryboardImageBatchTargetStoryboardIds(storyboardIds)
    writeImageBatchTargetIdsSession(creationStore, storyboardIds)
  }

  function clearImageBatchTargetIds() {
    clearImageBatchTargetIdsSession(creationStore)
    creationStore.clearStoryboardImageBatchTargetStoryboardIds()
  }

  function stopImageBatchGeneration() {
    clearImageBatchTargetIdsSession(creationStore)
    creationStore.stopStoryboardImageBatchGeneration()
  }

  function pickLatestImageRecord(rows: StoryboardRecordRow[]): StoryboardRecordRow | null {
    const withUrl = rows.filter((r) => String(r?.fileUrl ?? '').trim())
    if (!withUrl.length) return null
    return (
      [...withUrl].sort((a, b) => {
        const ta = String(a.createTime ?? '')
        const tb = String(b.createTime ?? '')
        return tb.localeCompare(ta) || Number(b.id) - Number(a.id)
      })[0] ?? null
    )
  }

  function markRecordSelectedInMap(
    imageByStoryboardId: Map<number, StoryboardRecordRow[]>,
    storyboardId: number,
    recordId: number
  ) {
    const sid = Number(storyboardId)
    const rid = Number(recordId)
    const rows = imageByStoryboardId.get(sid)
    if (!rows?.length) return
    imageByStoryboardId.set(
      sid,
      rows.map((r) => {
        const id = Number(r.id)
        if (id === rid) return { ...r, isSelected: 1 }
        if (r.isSelected === 1) return { ...r, isSelected: 0 }
        return r
      })
    )
  }

  /** 批量设主图：list-by-storyboard 只请求一次，再单次 setFinalImage（items 批量） */
  async function setFinalImagesForStoryboards(
    ctx: ProjectEpisodeContext,
    storyboardIds: number[]
  ): Promise<{
    results: Map<number, boolean>
    imageByStoryboardId: Map<number, StoryboardRecordRow[]>
  }> {
    const results = new Map<number, boolean>()
    const emptyMap = new Map<number, StoryboardRecordRow[]>()
    if (!storyboardIds.length) return { results, imageByStoryboardId: emptyMap }

    let imageRows: StoryboardRecordRow[] = []
    try {
      imageRows = await fetchProjectStoryboardRecords(ctx, 'image')
    } catch {
      for (const sid of storyboardIds) results.set(sid, false)
      return { results, imageByStoryboardId: emptyMap }
    }

    const imageByStoryboardId = groupStoryboardRecordsByStoryboardId(imageRows)
    const sidToRecordId = new Map<number, number>()
    const items: Array<{ storyboardId: number; recordId: number }> = []

    for (const storyboardId of storyboardIds) {
      const sid = Number(storyboardId)
      const latest = pickLatestImageRecord(imageByStoryboardId.get(sid) ?? [])
      const rid = Number(latest?.id)
      if (!Number.isFinite(rid) || rid <= 0) {
        results.set(sid, false)
        continue
      }
      sidToRecordId.set(sid, rid)
      items.push({ storyboardId: sid, recordId: rid })
    }

    if (!items.length) return { results, imageByStoryboardId }

    const SET_FINAL_BATCH_MAX = 50
    const successRecordIds = new Set<number>()

    for (let i = 0; i < items.length; i += SET_FINAL_BATCH_MAX) {
      const chunk = items.slice(i, i + SET_FINAL_BATCH_MAX)
      try {
        const data = await userStoryboardSetFinalImage({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          items: chunk
        })
        for (const rid of (data?.successIds ?? []).map(Number)) {
          if (Number.isFinite(rid) && rid > 0) successRecordIds.add(rid)
        }
      } catch {
        /* 本批失败，对应分镜记为 false */
      }
    }

    for (const [sid, rid] of sidToRecordId) {
      if (successRecordIds.has(rid)) {
        markRecordSelectedInMap(imageByStoryboardId, sid, rid)
        results.set(sid, true)
      } else {
        results.set(sid, false)
      }
    }

    if (successRecordIds.size > 0) {
      clearProjectStoryboardRecordCache(ctx)
    }

    return { results, imageByStoryboardId }
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
    creationStore.updateFormData({ storyboardScript: { panels } })
    return panels
  }

  /** 设主图后刷新分镜列表（仅 /storyboard/list） */
  async function finalizeBatchPanelsAfterImageGen(
    ctx: ProjectEpisodeContext,
    targets: number[]
  ): Promise<StoryboardPanel[]> {
    const { results } = await setFinalImagesForStoryboards(ctx, targets)
    for (const [sid, ok] of results) {
      creationStore.setStoryboardPanelImageGenStatus(sid, ok ? 'success' : 'failed')
    }
    return refreshPanelsFromApi()
  }

  function applySseProgress(p: {
    progress?: number
    stepIndex?: number
    stepTotal?: number
    message?: string
    stepTitle?: string
  }) {
    creationStore.applyStoryboardImageBatchSseProgress(p)
  }

  function resolveBatchImageTargets(
    panels: StoryboardPanel[],
    storyboardIds: number[],
    overwrite: boolean
  ): number[] {
    return storyboardIds.filter((sid) => {
      const panel = panels.find((p) => parseServerStoryboardId(p.id) === sid)
      if (!panel) return false
      if (!overwrite && panelHasCoverImage(panel)) return false
      return true
    })
  }

  function markPanelsGenerating(storyboardIds: number[]) {
    for (const sid of storyboardIds) {
      creationStore.setStoryboardPanelImageGenStatus(sid, 'generating')
    }
  }

  /** 提示词阶段结束 → 出图 SSE 接续前，显式保持顶部/卡片 loading（对齐分镜视频批量） */
  function ensureImageBatchLoadingUi(targets: number[], panels?: StoryboardPanel[]) {
    if (!targets.length) return
    creationStore.setStoryboardImageBatchGenerating(true)
    creationStore.setStoryboardImageBatchError(null)
    if (!creationStore.storyboardImageBatchTargetStoryboardIds.length) {
      creationStore.setStoryboardImageBatchTargetStoryboardIds(targets)
    }
    writeImageBatchTargetIdsSession(creationStore, targets)
    markPanelsGenerating(targets)
    if (panels?.length) {
      applyImmediatePanelLoadingRestore(panels, { skipScopeHydrate: true })
    }
  }

  /** 仅当前 scope 才写扁平 loading；已切集则只保活原 scope 桶 */
  function ensureImageBatchLoadingUiForScope(
    scopeCtx: ReturnType<typeof captureCreationLiveGenScope>,
    targets: number[],
    panels: StoryboardPanel[] | undefined,
    taskIds?: { promptTaskId?: number | null; imageTaskId?: number | null }
  ) {
    if (matchesCreationLiveGenScope(scopeCtx)) {
      if (taskIds?.promptTaskId != null) syncActiveTaskIdToStore(taskIds.promptTaskId)
      if (taskIds?.imageTaskId != null) syncActiveImageTaskIdToStore(taskIds.imageTaskId)
      ensureImageBatchLoadingUi(targets, panels)
      return
    }
    creationStore.mergeStep4PlusLiveGenForScopeKey(
      scopeCtx.scopeKey,
      buildImageBatchScopePreserveOnContextSwitch({
        promptTaskId: taskIds?.promptTaskId,
        imageTaskId: taskIds?.imageTaskId
      })
    )
  }

  function keepLoadingTargetsForStoryboards(storyboardIds: number[]): number[] {
    return resolveImageBatchLoadingTargetIds(getActiveImageBatchTargetIdsLocal(), storyboardIds)
  }

  function keepLoadingAfterFollowInterrupt(
    scopeCtx: ReturnType<typeof captureCreationLiveGenScope>,
    storyboardIds: number[],
    panels: StoryboardPanel[] | undefined,
    taskIds?: { promptTaskId?: number | null; imageTaskId?: number | null }
  ) {
    ensureImageBatchLoadingUiForScope(
      scopeCtx,
      keepLoadingTargetsForStoryboards(storyboardIds),
      panels,
      taskIds
    )
  }

  function isBatchOperationInterrupted(
    scopeCtx: ReturnType<typeof captureCreationLiveGenScope>,
    generation: number
  ): boolean {
    return generation !== resumeFollowGeneration || !matchesCreationLiveGenScope(scopeCtx)
  }

  /**
   * 刷新后同步恢复批量任务的列表卡片 loading（不 await），避免异步校验期间 loading 消失。
   * 弹窗单镜任务只恢复弹窗 loading，不写列表卡片状态。
   */
  function modalImageGenSessionScope() {
    return modalGenSessionScopeFromStore(creationStore)
  }

  /** 弹窗任务的持久化快照即为所有权凭证，刷新后也不得交给外层列表续跟。 */
  function isModalOwnedStoryboardImageTaskId(taskId: number): boolean {
    const tid = Number(taskId)
    if (!Number.isFinite(tid) || tid <= 0) return false
    for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
      for (const [sidRaw, snap] of Object.entries(
        blob.storyboardImageGenTasksByStoryboardId || {}
      )) {
        if (Number((snap as { taskId?: number }).taskId) !== tid) continue
        const sid = Number(sidRaw)
        if (Number.isFinite(sid) && sid > 0) return true
      }
    }
    const sessionScope = modalImageGenSessionScope()
    const session = readModalImageGenSession(sessionScope)
    const sessionTid = Number(session?.taskId)
    if (sessionTid === tid && session?.storyboardId != null) {
      return true
    }
    return false
  }

  function getActiveImageBatchTargetIdsLocal(): number[] {
    return getActiveImageBatchTargetIds(creationStore, route)
  }

  function applyImmediatePanelLoadingRestore(
    panels: StoryboardPanel[],
    options?: { skipScopeHydrate?: boolean }
  ) {
    applyStoryboardImageImmediatePanelLoadingRestore(creationStore, route, panels, options)
  }

  /** @deprecated 请改用 applyImmediatePanelLoadingRestore */
  function ensureBatchPanelLoadingUi(panels: StoryboardPanel[]) {
    applyImmediatePanelLoadingRestore(panels)
  }

  function clearPanelGeneratingStatusIfIdle(storyboardId: number) {
    const sid = Number(storyboardId)
    if (!Number.isFinite(sid) || sid <= 0) return
    for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
      if (blob.storyboardImageGenTasksByStoryboardId?.[String(sid)]) return
    }
    creationStore.clearStoryboardPanelImageGenStatus(sid)
  }

  function clearPanelGeneratingStatuses(storyboardIds: number[]) {
    for (const sid of storyboardIds) {
      clearStoryboardImageGenTaskInAllScopes(creationStore, sid, route)
      clearPanelGeneratingStatusIfIdle(sid)
    }
  }

  function onStoryboardImageGenSseTerminal(event: Event) {
    const detail = (
      event as CustomEvent<{
        taskId?: number
        storyboardId?: number
        ok?: boolean
        errorMessage?: string
      }>
    ).detail
    const taskId = Number(detail?.taskId)
    if (!Number.isFinite(taskId) || taskId <= 0) return

    const matchesBatchTask =
      activeTaskId.value === taskId ||
      activeImageTaskId.value === taskId ||
      creationStore.storyboardImageBatchActiveTaskId === taskId ||
      creationStore.storyboardImageBatchActiveImageTaskId === taskId

    if (detail?.ok) {
      if (matchesBatchTask) {
        syncActiveTaskIdToStore(null)
        syncActiveImageTaskIdToStore(null)
      }
      return
    }

    const sids = new Set<number>()
    const hintedSid = Number(detail?.storyboardId)
    if (Number.isFinite(hintedSid) && hintedSid > 0) sids.add(hintedSid)

    for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
      for (const [sidRaw, snap] of Object.entries(
        blob.storyboardImageGenTasksByStoryboardId || {}
      )) {
        if (Number((snap as { taskId?: number }).taskId) === taskId) {
          const sid = Number(sidRaw)
          if (Number.isFinite(sid) && sid > 0) sids.add(sid)
        }
      }
    }

    for (const sid of sids) {
      clearStoryboardImageGenTaskInAllScopes(creationStore, sid, route)
      creationStore.clearStoryboardPanelImageGenStatus(sid)
    }

    if (matchesBatchTask) {
      syncActiveTaskIdToStore(null)
      syncActiveImageTaskIdToStore(null)
      creationStore.setStoryboardImageBatchGenerating(false)
      clearImageBatchTargetIds()
    }
  }

  async function seedProgressFromTaskDetail(taskId: number, fallbackTotal: number) {
    try {
      const detail = await fetchUserTaskDetailOnce(taskId)
      const totalShots = Number((detail as { totalShots?: number }).totalShots)
      const total = Number.isFinite(totalShots) && totalShots > 0 ? totalShots : fallbackTotal
      if (total > 0) {
        const cur = creationStore.storyboardImageBatchProgress
        if (!cur.total || cur.total < total) {
          creationStore.setStoryboardImageBatchProgress(Math.min(cur.completed, total), total)
        }
      }
    } catch {
      /* ignore */
    }
  }

  async function trackPromptTaskUntilDone(
    taskId: number,
    stream: ReturnType<typeof useTaskStream>
  ): Promise<{ ok: boolean; partial?: boolean; message?: string; chainChildTaskIds?: number[] }> {
    if (!Number.isFinite(taskId) || taskId <= 0) {
      return { ok: false, message: '任务ID无效' }
    }

    const streamGen = resumeFollowGeneration
    try {
      const res = await stream.done
      if (stopRequested) {
        return { ok: false, message: '已停止生成' }
      }
      if (res.type === 'cancelled') {
        return { ok: false, message: res.message || '任务已取消' }
      }
      if (res.type === 'error') {
        const errMsg = res.errorMessage || '批量生成分镜图失败'
        if (isNavigationOrSuspendBatchMessage(errMsg)) {
          return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE }
        }
        return { ok: false, message: errMsg }
      }
      if (res.type === 'partial_failed') {
        return {
          ok: false,
          partial: true,
          message: '部分分镜图提示词生成失败，可续生',
          chainChildTaskIds: extractChainChildTaskIds(res.data)
        }
      }
      return { ok: true, chainChildTaskIds: extractChainChildTaskIds(res.data) }
    } catch {
      if (stopRequested) {
        return { ok: false, message: '已停止生成' }
      }
      // 切步/suspend/网络断流：一律保活，禁止「连接中断请稍后重试」假失败
      if (streamGen !== resumeFollowGeneration) {
        return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE }
      }
      try {
        const terminal = await resolveUserTaskTerminalOutcome(taskId)
        if (terminal.kind === 'succeeded') {
          return {
            ok: true,
            chainChildTaskIds: extractChainChildTaskIdsFromTaskDetail(terminal.detail)
          }
        }
        if (terminal.kind === 'partial_failed') {
          return {
            ok: false,
            partial: true,
            message: '部分分镜图提示词生成失败，可续生',
            chainChildTaskIds: extractChainChildTaskIdsFromTaskDetail(terminal.detail)
          }
        }
        if (terminal.kind === 'cancelled') {
          return { ok: false, message: terminal.message || '任务已取消' }
        }
        if (terminal.kind === 'failed') {
          return { ok: false, message: terminal.errorMessage || '批量生成分镜图失败' }
        }
      } catch {
        /* ignore */
      }
      return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE }
    } finally {
      closeStream()
    }
  }

  /** 提示词已终态时补齐 chainChildTaskIds（resultData → SSE 重连补发） */
  async function resolveChainChildTaskIdsForPromptTask(
    taskId: number,
    seed?: number[]
  ): Promise<number[]> {
    if (seed?.length) return [...new Set(seed)]
    const detail = await fetchUserTaskDetailOnce(taskId)
    const fromDetail = extractChainChildTaskIdsFromTaskDetail(detail)
    if (fromDetail.length) return fromDetail

    // 文档：终态 Redis 快照含 chainChildTaskIds，重连会补发 complete/partial_failed
    try {
      const stream = useTaskStream(taskId)
      const raced = await Promise.race([
        stream.done.then((res) => ({ kind: 'sse' as const, res })),
        sleep(10000).then(() => ({ kind: 'timeout' as const }))
      ])
      try {
        stream.close()
      } catch {
        /* ignore */
      }
      if (raced.kind === 'sse') {
        if (raced.res.type === 'complete' || raced.res.type === 'partial_failed') {
          return extractChainChildTaskIds(raced.res.data)
        }
      }
    } catch {
      /* ignore */
    }
    return []
  }

  async function followPromptTask(
    taskId: number,
    storyboardIds: number[],
    options?: { progressTotalHint?: number; freshSubmission?: boolean }
  ): Promise<StoryboardPromptBatchFollowResult> {
    while (followInFlight) {
      if (promptFollowTaskId === taskId) return followInFlight
      try {
        await followInFlight
      } catch {
        /* The previous owner releases below; a different task may then take ownership. */
      }
    }

    const run = async (): Promise<StoryboardPromptBatchFollowResult> => {
      const followGen = resumeFollowGeneration
      stopRequested = false
      const routeCtx = captureCreationLiveGenScope()
      beginBatchSseFollow()
      syncActiveTaskIdToStore(taskId)
      creationStore.setStoryboardImageBatchGenerating(true)
      creationStore.setStoryboardImageBatchError(null)
      // 切集/restore 后 batch targets 可能暂时丢失：回退 storyboardIds，保证卡片 loading 不被空跑 ensure 漏掉
      ensureImageBatchLoadingUi(
        resolveImageBatchLoadingTargetIds(getActiveImageBatchTargetIdsLocal(), storyboardIds)
      )

      try {
        const progressTotal = Math.max(
          options?.progressTotalHint ?? 0,
          creationStore.storyboardImageBatchProgress.total || 0,
          storyboardIds.length,
          1
        )
        if (!creationStore.storyboardImageBatchProgress.total) {
          creationStore.setStoryboardImageBatchProgress(0, progressTotal)
        }
        if (!options?.freshSubmission) {
          await seedProgressFromTaskDetail(taskId, progressTotal)
        }

        let outcome: {
          ok: boolean
          partial?: boolean
          message?: string
          chainChildTaskIds?: number[]
        }
        const resolved = options?.freshSubmission
          ? null
          : await resolveUserTaskTerminalOutcome(taskId)
        if (resolved?.kind === 'succeeded') {
          outcome = {
            ok: true,
            chainChildTaskIds: await resolveChainChildTaskIdsForPromptTask(taskId)
          }
        } else if (resolved?.kind === 'partial_failed') {
          outcome = {
            ok: false,
            partial: true,
            message: '部分分镜图提示词生成失败，可续生',
            chainChildTaskIds: await resolveChainChildTaskIdsForPromptTask(taskId)
          }
        } else if (resolved?.kind === 'cancelled') {
          outcome = { ok: false, message: resolved.message || '任务已取消' }
        } else if (resolved?.kind === 'failed') {
          outcome = {
            ok: false,
            message: resolved.errorMessage || '批量生成分镜图失败'
          }
        } else {
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
            },
            { immediate: true }
          )

          outcome = await trackPromptTaskUntilDone(taskId, stream)
          stopWatchProgress()
          if ((outcome.ok || outcome.partial) && !outcome.chainChildTaskIds?.length) {
            outcome = {
              ...outcome,
              chainChildTaskIds: await resolveChainChildTaskIdsForPromptTask(
                taskId,
                outcome.chainChildTaskIds
              )
            }
          }
        }

        if (followGen !== resumeFollowGeneration) {
          return {
            ok: false,
            message: TASK_BACKGROUND_RUNNING_MESSAGE
          }
        }

        if (import.meta.client) {
          window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
        }

        if (!matchesCreationLiveGenScope(routeCtx)) {
          creationStore.mergeStep4PlusLiveGenForScopeKey(
            routeCtx.scopeKey,
            buildImageBatchScopePreserveOnContextSwitch({
              promptTaskId: taskId,
              imageTaskId: creationStore.storyboardImageBatchActiveImageTaskId
            })
          )
          return { ok: false, message: '已切换作品，任务仍在后台进行' }
        }

        if (!outcome.partial) {
          syncActiveTaskIdToStore(null)
        }

        return outcome
      } finally {
        endBatchSseFollow()
      }
    }

    const pending = run()
    followInFlight = pending
    promptFollowTaskId = taskId
    try {
      return await pending
    } finally {
      if (followInFlight === pending) {
        followInFlight = null
        promptFollowTaskId = null
      }
      followIdleBarrier.notifyStateChange()
    }
  }

  async function submitImageWithPromptBatch(
    ctx: ProjectEpisodeContext,
    targets: number[],
    overwrite: boolean,
    options?: {
      manualAgentModelPick?: boolean
      agentCode?: string
      modelCode?: string
      genScenario?: string
      genNegativePrompt?: string
    }
  ): Promise<{ ok: boolean; taskId?: number; message?: string; totalShots?: number }> {
    const promptFields = await resolveStoryboardGenConfigLlmFields(
      ctx.projectId,
      STORYBOARD_GEN_CONFIG_SCENE_CODES.stylist,
      false,
      '',
      ''
    )
    const imageGenFields = await resolveProjectGenImageSubmitFields(
      ctx.projectId,
      STORYBOARD_GEN_CONFIG_SCENE_CODES.image,
      options?.manualAgentModelPick
        ? {
            agentCode: options.agentCode,
            modelCode: options.modelCode
          }
        : undefined
    )

    try {
      const submitted = await userStoryboardGenerateImageWithPrompt({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardIds: targets,
        overwrite,
        ...(promptFields.agentCode ? { agentCode: promptFields.agentCode } : {}),
        ...(promptFields.modelCode ? { modelCode: promptFields.modelCode } : {}),
        ...(imageGenFields.agentCode ? { genAgentCode: imageGenFields.agentCode } : {}),
        ...(imageGenFields.modelCode ? { genModelName: imageGenFields.modelCode } : {}),
        ...(imageGenFields.aspectRatio ? { genAspectRatio: imageGenFields.aspectRatio } : {}),
        ...(imageGenFields.resolution ? { genSize: imageGenFields.resolution } : {}),
        ...(String(options?.genScenario || '').trim()
          ? { genScenario: String(options?.genScenario || '').trim() }
          : {}),
        ...(String(options?.genNegativePrompt || '').trim()
          ? { genNegativePrompt: String(options?.genNegativePrompt || '').trim() }
          : {})
      })
      const taskId = parseTaskId(submitted.taskId)
      if (!taskId) {
        return { ok: false, message: '提交失败：未返回任务ID' }
      }
      if (import.meta.client) {
        window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
      }
      return {
        ok: true,
        taskId,
        totalShots: Number(submitted.totalShots) > 0 ? Number(submitted.totalShots) : targets.length
      }
    } catch (e: unknown) {
      return { ok: false, message: bizErr(e) }
    }
  }

  async function resolveOngoingImageGenerateTaskId(
    ctx: ProjectEpisodeContext,
    preferredImageId?: number | null
  ): Promise<number | null> {
    const pref = parseTaskId(
      preferredImageId ?? creationStore.storyboardImageBatchActiveImageTaskId
    )
    for (let attempt = 0; attempt < 4; attempt++) {
      if (pref != null) {
        const detail = await fetchUserTaskDetailOnce(pref)
        if (detail && isOngoingUserTaskStatus(normalizeTaskStatus(detail.status))) {
          return pref
        }
      }

      let tasks: UserTaskRow[] = []
      let taskListOk = true
      try {
        tasks = await fetchRecentProjectTasks(ctx.projectId)
      } catch {
        tasks = []
        taskListOk = false
      }
      const listHit = pickOngoingImageGenerateTask(tasks, pref)
      const hitId = parseTaskId(listHit?.id)
      if (hitId != null) return hitId
      if (pref != null && taskListOk) {
        const detail = await fetchUserTaskDetailOnce(pref)
        if (detail && isOngoingUserTaskStatus(normalizeTaskStatus(detail.status))) {
          return pref
        }
      }
      if (attempt < 3) await sleep(800)
    }
    return null
  }

  /** 提示词任务终态后，跟进后端自动触发的 storyboard_image_generate 父任务 */
  async function followImageGenerateAfterPrompt(
    targets: number[],
    storyboardIds: number[],
    panels: StoryboardPanel[],
    chainChildTaskIds?: number[]
  ): Promise<{ ok: boolean; message?: string; partial?: boolean; panels?: StoryboardPanel[] }> {
    const scopeAtEntry = captureCreationLiveGenScope()
    const generationAtEntry = resumeFollowGeneration
    const preferredImageTaskIdAtEntry = creationStore.storyboardImageBatchActiveImageTaskId
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息', panels }
    }
    if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
      keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, panels)
      return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE, panels }
    }

    if (stopRequested) {
      return { ok: false, message: '已停止生成', panels }
    }

    const explicitTargets = targets.filter((id) => Number.isFinite(id) && id > 0)
    const loadingTargets = resolveImageBatchLoadingTargetIds(explicitTargets, storyboardIds)
    ensureImageBatchLoadingUi(loadingTargets, panels)

    const preferredChildIds = normalizeStoryboardBatchTargetIds(chainChildTaskIds)
    if (preferredChildIds.length) {
      let working = panels
      let anyPartial = false
      for (const childId of preferredChildIds) {
        if (stopRequested) {
          return { ok: false, message: '已停止生成', panels: working }
        }
        const childOutcome = await followOngoingImageGenerateTask(
          childId,
          storyboardIds,
          loadingTargets
        )
        if (!childOutcome.ok) {
          return { ...childOutcome, panels: childOutcome.panels ?? working }
        }
        if (childOutcome.partial) anyPartial = true
        if (childOutcome.panels) working = childOutcome.panels
      }
      return { ok: true, partial: anyPartial, panels: working }
    }

    const ongoingImageId = await resolveOngoingImageGenerateTaskId(ctx, preferredImageTaskIdAtEntry)
    if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
      // task/list 返回时可能已经切到另一作品，发现结果不作为旧作用域的所有权凭证。
      keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, panels)
      return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE, panels }
    }
    if (ongoingImageId != null) {
      return followOngoingImageGenerateTask(ongoingImageId, storyboardIds, loadingTargets)
    }

    // 无 chainChildTaskIds 且无进行中出图任务：勿假成功；对仍缺图的分镜补发 /generate/image
    const refreshed = await refreshPanelsFromApi()
    if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
      keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, panels)
      return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE, panels }
    }
    const stillNeed = resolveBatchImageTargets(
      refreshed,
      explicitTargets.length ? explicitTargets : storyboardIds,
      false
    )
    // 空 explicit targets 时禁止清全部卡片 loading（切集 restore 曾因此把 generating 写空并持久化）
    for (const sid of storyboardIds) {
      if (shouldClearNonTargetImageBatchPanelStatus(explicitTargets, sid)) {
        creationStore.clearStoryboardPanelImageGenStatus(sid)
      }
    }
    if (!stillNeed.length) {
      return { ok: true, panels: refreshed }
    }

    try {
      const imageGenFields = await resolveProjectGenImageSubmitFields(
        ctx.projectId,
        STORYBOARD_GEN_CONFIG_SCENE_CODES.image
      )
      if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
        keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, refreshed)
        return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE, panels: refreshed }
      }
      const submitted = await userStoryboardGenerateImage({
        storyboardIds: stillNeed,
        ...(imageGenFields.agentCode ? { agentCode: imageGenFields.agentCode } : {}),
        ...(imageGenFields.modelCode ? { modelName: imageGenFields.modelCode } : {}),
        ...(imageGenFields.aspectRatio ? { aspectRatio: imageGenFields.aspectRatio } : {}),
        ...(imageGenFields.resolution ? { size: imageGenFields.resolution } : {})
      })
      const fallbackTaskId = parseTaskId(submitted.taskId)
      if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
        keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, refreshed, {
          imageTaskId: fallbackTaskId
        })
        return { ok: false, message: TASK_BACKGROUND_RUNNING_MESSAGE, panels: refreshed }
      }
      if (!fallbackTaskId) {
        return {
          ok: false,
          panels: refreshed,
          message: '出图任务未就绪，补发失败：未返回任务ID'
        }
      }
      if (import.meta.client) {
        window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
      }
      return followOngoingImageGenerateTask(fallbackTaskId, storyboardIds, stillNeed)
    } catch (e: unknown) {
      return {
        ok: false,
        panels: refreshed,
        message: bizErr(e) || '出图任务未就绪或未触发，请重新批量生成分镜图'
      }
    }
  }

  async function handlePromptPartialResume(
    taskId: number,
    storyboardIds: number[]
  ): Promise<{ ok: boolean; partial?: boolean; message?: string }> {
    const shouldResume = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '部分分镜图提示词生成失败',
        content: '部分镜头提示词生成失败，是否续生？',
        okText: '续生',
        cancelText: '跳过',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
    if (shouldResume) {
      const resumeOutcome = await resumeStoryboardPromptGenerateTask(taskId, 'image')
      if (resumeOutcome.ok === false) {
        return { ok: false, message: resumeOutcome.errorMessage }
      }
      return followPromptTask(taskId, storyboardIds)
    }
    syncActiveTaskIdToStore(taskId)
    return { ok: true, partial: true, message: '部分分镜图提示词生成失败' }
  }

  function pickOngoingImageGenerateTask(
    tasks: UserTaskRow[],
    preferredTaskId?: number | null
  ): UserTaskRow | null {
    const ongoing = tasks
      .filter(
        (t) =>
          t &&
          isStoryboardImageGenerateTaskType(t.taskType) &&
          isOngoingUserTaskStatus(t.status) &&
          !isModalOwnedStoryboardImageTaskId(Number(t.id))
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

  async function followOngoingImageGenerateTaskOwned(
    taskId: number,
    storyboardIds: number[],
    targets: number[]
  ): Promise<StoryboardImageBatchFollowResult> {
    const routeCtx = captureCreationLiveGenScope()
    const imageTotal = Math.max(targets.length, storyboardIds.length, 1)
    beginBatchSseFollow()
    ensureImageBatchLoadingUi(targets)
    syncActiveImageTaskIdToStore(taskId)
    if (!creationStore.storyboardImageBatchProgress.total) {
      creationStore.setStoryboardImageBatchProgress(0, imageTotal)
    }

    try {
      await seedProgressFromTaskDetail(taskId, imageTotal)

      let result: Awaited<ReturnType<typeof followStoryboardImageBatchGenerateTask>>
      const resolved = await resolveUserTaskTerminalOutcome(taskId)
      if (resolved.kind === 'succeeded') {
        result = { ok: true, taskId }
      } else if (resolved.kind === 'partial_failed') {
        result = { ok: true, taskId, partial: true }
      } else if (resolved.kind === 'cancelled') {
        result = { ok: false, errorMessage: resolved.message || '任务已取消' }
      } else if (resolved.kind === 'failed') {
        result = {
          ok: false,
          errorMessage: resolved.errorMessage || '分镜图生成失败'
        }
      } else {
        result = await followStoryboardImageBatchGenerateTask({
          taskId,
          onProgress: (p) => {
            if (!matchesCreationLiveGenScope(routeCtx)) return
            applySseProgress({
              progress: p.percent,
              message: p.message,
              stepTitle: p.stepTitle
            })
          }
        })
      }

      if (!matchesCreationLiveGenScope(routeCtx)) {
        creationStore.mergeStep4PlusLiveGenForScopeKey(
          routeCtx.scopeKey,
          buildImageBatchScopePreserveOnContextSwitch({
            promptTaskId: creationStore.storyboardImageBatchActiveTaskId,
            imageTaskId: taskId
          })
        )
        return { ok: false, message: '已切换作品，任务仍在后台进行' }
      }

      const resultMessage = 'errorMessage' in result ? result.errorMessage : '分镜图生成失败'
      const deferred = 'deferred' in result && Boolean(result.deferred)
      if (
        !result.ok &&
        (deferred ||
          isTaskBackgroundRunningMessage(resultMessage) ||
          shouldKeepImageBatchLoadingAfterFollowMessage(resultMessage))
      ) {
        ensureImageBatchLoadingUi(targets)
        return {
          ok: false,
          message: isNavigationOrSuspendBatchMessage(resultMessage)
            ? TASK_BACKGROUND_RUNNING_MESSAGE
            : resultMessage
        }
      }

      syncActiveImageTaskIdToStore(null)

      if (!result.ok) {
        clearPanelGeneratingStatuses(storyboardIds)
        return {
          ok: false,
          message: resultMessage
        }
      }

      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      let panels: StoryboardPanel[] | undefined
      if (ctx) {
        panels = await finalizeBatchPanelsAfterImageGen(ctx, targets)
      }

      creationStore.setStoryboardImageBatchProgress(imageTotal, imageTotal)
      return { ok: true, partial: Boolean(result.partial), panels }
    } finally {
      endBatchSseFollow()
    }
  }

  /** A generated-image task has exactly one client owner; every caller shares that result. */
  async function followOngoingImageGenerateTask(
    taskId: number,
    storyboardIds: number[],
    targets: number[]
  ): Promise<StoryboardImageBatchFollowResult> {
    while (imageFollowInFlight) {
      if (imageFollowInFlight.taskId === taskId) return imageFollowInFlight.promise
      try {
        await imageFollowInFlight.promise
      } catch {
        /* A different child task may take ownership after the previous one releases. */
      }
    }

    const promise = followOngoingImageGenerateTaskOwned(taskId, storyboardIds, targets)
    const owner = { taskId, promise }
    imageFollowInFlight = owner
    try {
      return await promise
    } finally {
      if (imageFollowInFlight === owner) imageFollowInFlight = null
      followIdleBarrier.notifyStateChange()
    }
  }

  async function runBatchForPanels(
    panels: StoryboardPanel[],
    overwrite: boolean,
    options?: {
      manualAgentModelPick?: boolean
      selectedStoryboardIds?: number[]
      agentCode?: string
      modelCode?: string
      genScenario?: string
      genNegativePrompt?: string
    }
  ): Promise<{ ok: boolean; panels: StoryboardPanel[]; message?: string }> {
    stopRequested = false
    const scopeAtEntry = captureCreationLiveGenScope()
    const generationAtEntry = resumeFollowGeneration
    batchRunInFlight = true
    try {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (!ctx) {
        return { ok: false, panels, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
      }
      if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
        return { ok: false, panels, message: TASK_BACKGROUND_RUNNING_MESSAGE }
      }

      let storyboardIds = panels
        .map((p) => parseServerStoryboardId(p.id))
        .filter((id): id is number => id != null)

      if (options?.selectedStoryboardIds?.length) {
        const selectedSet = new Set(options.selectedStoryboardIds)
        storyboardIds = storyboardIds.filter((id) => selectedSet.has(id))
      }

      if (!storyboardIds.length) {
        return { ok: false, panels, message: '请选择要生成的分镜' }
      }

      const targets = resolveBatchImageTargets(panels, storyboardIds, overwrite)
      if (!targets.length) {
        return { ok: false, panels, message: '所选分镜均已有分镜图' }
      }

      setImageBatchTargetIds(targets)
      markPanelsGenerating(targets)
      creationStore.setStoryboardImageBatchGenerating(true)
      creationStore.setStoryboardImageBatchError(null)
      creationStore.setStoryboardImageBatchProgress(0, targets.length)

      const submitOutcome = await submitImageWithPromptBatch(ctx, targets, overwrite, {
        manualAgentModelPick: options?.manualAgentModelPick,
        agentCode: options?.agentCode,
        modelCode: options?.modelCode,
        genScenario: options?.genScenario,
        genNegativePrompt: options?.genNegativePrompt
      })
      if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
        keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, panels, {
          promptTaskId: submitOutcome.taskId
        })
        return { ok: false, panels, message: TASK_BACKGROUND_RUNNING_MESSAGE }
      }
      if (!submitOutcome.ok || !submitOutcome.taskId) {
        creationStore.setStoryboardImageBatchGenerating(false)
        clearPanelGeneratingStatuses(targets)
        clearImageBatchTargetIds()
        return { ok: false, panels, message: submitOutcome.message || '批量生成分镜图失败' }
      }

      let promptOutcome = await followPromptTask(submitOutcome.taskId, storyboardIds, {
        progressTotalHint: submitOutcome.totalShots,
        freshSubmission: true
      })

      if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
        keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, panels, {
          promptTaskId: submitOutcome.taskId,
          imageTaskId: promptOutcome.chainChildTaskIds?.[0]
        })
        return { ok: false, panels, message: TASK_BACKGROUND_RUNNING_MESSAGE }
      }

      // 提示词 SSE 结束会清空 activeTaskId 并触发 restore；出图 SSE 接续前显式保持 loading
      ensureImageBatchLoadingUi(targets, panels)

      if (stopRequested) {
        creationStore.setStoryboardImageBatchGenerating(false)
        clearPanelGeneratingStatuses(targets)
        clearImageBatchTargetIds()
        return { ok: false, panels, message: '已停止生成' }
      }

      if (!promptOutcome.ok) {
        if (promptOutcome.partial && submitOutcome.taskId) {
          promptOutcome = await handlePromptPartialResume(submitOutcome.taskId, storyboardIds)
          if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
            keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, panels, {
              promptTaskId: submitOutcome.taskId,
              imageTaskId: promptOutcome.chainChildTaskIds?.[0]
            })
            return { ok: false, panels, message: TASK_BACKGROUND_RUNNING_MESSAGE }
          }
        }
        if (!promptOutcome.ok && !promptOutcome.partial) {
          if (shouldKeepImageBatchLoadingAfterFollowMessage(promptOutcome.message)) {
            return { ok: false, panels, message: promptOutcome.message }
          }
          creationStore.setStoryboardImageBatchGenerating(false)
          if (promptOutcome.message) {
            creationStore.setStoryboardImageBatchError(promptOutcome.message)
          }
          clearPanelGeneratingStatuses(targets)
          clearImageBatchTargetIds()
          return { ok: false, panels, message: promptOutcome.message }
        }
      }

      let workingPanels = panels
      try {
        workingPanels = await refreshPanelsFromApi()
      } catch {
        /* ignore */
      }
      if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
        keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, workingPanels, {
          promptTaskId: submitOutcome.taskId,
          imageTaskId: promptOutcome.chainChildTaskIds?.[0]
        })
        return { ok: false, panels: workingPanels, message: TASK_BACKGROUND_RUNNING_MESSAGE }
      }

      const imageOutcome = await followImageGenerateAfterPrompt(
        targets,
        storyboardIds,
        workingPanels,
        promptOutcome.chainChildTaskIds
      )

      if (isBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
        keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, workingPanels, {
          promptTaskId: submitOutcome.taskId,
          imageTaskId: promptOutcome.chainChildTaskIds?.[0]
        })
        return { ok: false, panels: workingPanels, message: TASK_BACKGROUND_RUNNING_MESSAGE }
      }

      if (import.meta.client && imageOutcome.ok) {
        window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
      }

      workingPanels = imageOutcome.panels ?? workingPanels
      if (!imageOutcome.ok) {
        if (shouldKeepImageBatchLoadingAfterFollowMessage(imageOutcome.message)) {
          ensureImageBatchLoadingUi(targets, workingPanels)
          return { ok: false, panels: workingPanels, message: imageOutcome.message }
        }
        creationStore.setStoryboardImageBatchGenerating(false)
        if (imageOutcome.message) {
          creationStore.setStoryboardImageBatchError(imageOutcome.message)
        }
        clearPanelGeneratingStatuses(targets)
        clearImageBatchTargetIds()
        return { ok: false, panels: workingPanels, message: imageOutcome.message }
      }

      creationStore.setStoryboardImageBatchProgress(targets.length, targets.length)
      creationStore.setStoryboardImageBatchGenerating(false)
      clearPanelGeneratingStatuses(targets)
      clearImageBatchTargetIds()

      return {
        ok: true,
        panels: workingPanels,
        message: promptOutcome.partial || imageOutcome.partial ? '部分分镜图生成失败' : undefined
      }
    } finally {
      batchRunInFlight = false
      followIdleBarrier.notifyStateChange()
    }
  }

  function pickOngoingImagePromptBatchTask(
    tasks: UserTaskRow[],
    preferredTaskId?: number | null
  ): UserTaskRow | null {
    const ongoing = tasks
      .filter(
        (t) =>
          t && isStoryboardImagePromptBatchTask(t.taskType) && isOngoingUserTaskStatus(t.status)
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

  async function restoreOngoingBatchIfNeeded(
    currentPanels: StoryboardPanel[],
    onPanelsUpdate: (panels: StoryboardPanel[]) => void,
    options?: { discoverServerTasks?: boolean }
  ): Promise<void> {
    if (typeof window === 'undefined') return

    if (
      batchSseFollowInFlight ||
      batchRunInFlight ||
      followInFlight != null ||
      imageFollowInFlight != null
    ) {
      return
    }
    if (restoreSessionInFlight) {
      return restoreSessionInFlight
    }

    // restore 的资格判断必须基于已回填的当前 scope，而不是刷新初始时的空扁平字段。
    applyImmediatePanelLoadingRestore(currentPanels)
    const hasServerStoryboardIds = currentPanels.some(
      (panel) => parseServerStoryboardId(panel.id) != null
    )
    const hasRestoreIntent = shouldRestoreImageBatchSse({
      isGenerating:
        Boolean(creationStore.isGeneratingStoryboardImageBatch) ||
        hasPersistedStoryboardImageBatchGenWork(creationStore, route),
      following: false,
      hasServerStoryboardIds,
      hasActiveTaskId:
        parseTaskId(creationStore.storyboardImageBatchActiveTaskId) != null ||
        parseTaskId(creationStore.storyboardImageBatchActiveImageTaskId) != null
    })
    // 响应式调用不轮询；只有页面 bootstrap/scope 事件允许从服务端发现一次丢失的本地快照。
    if (!hasRestoreIntent && !options?.discoverServerTasks) return

    if (
      batchSseFollowInFlight ||
      batchRunInFlight ||
      followInFlight != null ||
      imageFollowInFlight != null
    ) {
      return
    }

    const scopeAtEntry = captureCreationLiveGenScope()

    const run = async () => {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (!ctx) return

      const gen = ++resumeFollowGeneration
      beginFlowTaskListQuietWindow(ctx.projectId)
      try {
      const storyboardIds = currentPanels
        .map((p) => parseServerStoryboardId(p.id))
        .filter((id): id is number => id != null)

      const preferredId = creationStore.storyboardImageBatchActiveTaskId
      const preferredImageIdEarly = creationStore.storyboardImageBatchActiveImageTaskId
      const prefPromptId = parseTaskId(preferredId)
      const prefImageIdEarly = parseTaskId(preferredImageIdEarly)
      const hasActiveBatchTaskId = prefPromptId != null || prefImageIdEarly != null

      // 跨集会清空 panels：有 taskId 时先跟 SSE，勿只亮 loading
      if (
        !storyboardIds.length &&
        !options?.discoverServerTasks &&
        !shouldRestoreImageBatchSse({
          isGenerating: Boolean(creationStore.isGeneratingStoryboardImageBatch),
          following: false,
          hasActiveTaskId: hasActiveBatchTaskId
        })
      ) {
        return
      }

      let ongoingId: number | null = null
      let taskListOk = true

      if (prefPromptId) {
        let detail = null
        try {
          detail = await fetchUserTaskDetailOnce(prefPromptId)
        } catch {
          /* task/list 仍可用于恢复 */
        }
        if (gen !== resumeFollowGeneration) return
        if (
          detail &&
          (isOngoingUserTaskStatus(normalizeTaskStatus(detail.status)) ||
            isTerminalTaskStatus(detail.status))
        ) {
          ongoingId = prefPromptId
        } else if (!detail && creationStore.isGeneratingStoryboardImageBatch && prefPromptId) {
          // detail 暂不可用时仍信任 store taskId，避免跨集返回只恢复 loading
          ongoingId = prefPromptId
        }
      }

      let tasks: UserTaskRow[] = []
      if (ongoingId == null) {
        try {
          tasks = await fetchRecentProjectTasks(ctx.projectId)
        } catch {
          tasks = []
          taskListOk = false
        }
        if (gen !== resumeFollowGeneration) return
        ongoingId = parseTaskId(pickOngoingImagePromptBatchTask(tasks, preferredId)?.id)
      }

      // 仍 generating 且 store 有 prompt taskId 时，即使 list 未命中也跟 SSE
      if (ongoingId == null && prefPromptId && creationStore.isGeneratingStoryboardImageBatch) {
        ongoingId = prefPromptId
      }

      if (gen !== resumeFollowGeneration) return

      applyImmediatePanelLoadingRestore(currentPanels)

      if (ongoingId != null) {
        if (gen !== resumeFollowGeneration) return
        creationStore.setStoryboardImageBatchGenerating(true)
        const restoreLoadingTargets = resolveImageBatchLoadingTargetIds(
          getActiveImageBatchTargetIdsLocal(),
          storyboardIds
        )
        ensureImageBatchLoadingUi(restoreLoadingTargets, currentPanels)

        let promptOutcome: {
          ok: boolean
          partial?: boolean
          message?: string
          chainChildTaskIds?: number[]
        }
        const promptAlreadyTerminal = await isUserTaskTerminal(ongoingId)
        if (promptAlreadyTerminal) {
          syncActiveTaskIdToStore(null)
          const resolved = await resolveUserTaskTerminalOutcome(ongoingId)
          if (resolved.kind === 'succeeded') {
            promptOutcome = {
              ok: true,
              chainChildTaskIds: await resolveChainChildTaskIdsForPromptTask(ongoingId)
            }
          } else if (resolved.kind === 'partial_failed') {
            promptOutcome = {
              ok: false,
              partial: true,
              message: '部分分镜图提示词生成失败，可续生',
              chainChildTaskIds: await resolveChainChildTaskIdsForPromptTask(ongoingId)
            }
          } else if (resolved.kind === 'cancelled') {
            promptOutcome = { ok: false, message: resolved.message || '任务已取消' }
          } else if (resolved.kind === 'failed') {
            promptOutcome = {
              ok: false,
              message: resolved.errorMessage || '批量生成分镜图失败'
            }
          } else {
            promptOutcome = { ok: false, message: '批量生成分镜图失败' }
          }
        } else {
          promptOutcome = await followPromptTask(ongoingId, storyboardIds)
        }
        if (gen !== resumeFollowGeneration) {
          keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, currentPanels, {
            promptTaskId: ongoingId
          })
          return
        }

        let workingPanels = currentPanels
        let backgroundStillRunning = shouldKeepImageBatchLoadingAfterFollowMessage(
          promptOutcome.message
        )
        if (promptOutcome.ok || promptOutcome.partial) {
          try {
            workingPanels = await refreshPanelsFromApi()
            onPanelsUpdate(workingPanels)
          } catch {
            /* ignore */
          }
          const batchTargetIds = getActiveImageBatchTargetIdsLocal()
          const imageTargets = resolveImageBatchLoadingTargetIds(
            batchTargetIds.length
              ? batchTargetIds
              : resolveBatchImageTargets(workingPanels, storyboardIds, false),
            storyboardIds
          )
          const imageOutcome = await followImageGenerateAfterPrompt(
            imageTargets,
            storyboardIds,
            workingPanels,
            promptOutcome.chainChildTaskIds
          )
          if (gen !== resumeFollowGeneration) {
            keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, workingPanels, {
              promptTaskId: ongoingId
            })
            return
          }
          if (imageOutcome.ok && imageOutcome.panels) {
            workingPanels = imageOutcome.panels
            onPanelsUpdate(workingPanels)
          }
          backgroundStillRunning = shouldKeepImageBatchLoadingAfterFollowMessage(
            imageOutcome.message
          )
        }

        if (backgroundStillRunning || !matchesCreationLiveGenScope(scopeAtEntry)) {
          keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, workingPanels, {
            promptTaskId: ongoingId
          })
          return
        }

        creationStore.setStoryboardImageBatchGenerating(false)
        clearPanelGeneratingStatuses(storyboardIds)
        clearImageBatchTargetIds()
        return
      }

      const preferredImageId = creationStore.storyboardImageBatchActiveImageTaskId
      const prefImageId = parseTaskId(preferredImageId)
      let ongoingImageId: number | null = null

      if (prefImageId) {
        const detail = await fetchUserTaskDetailOnce(prefImageId)
        if (gen !== resumeFollowGeneration) return
        if (detail && isOngoingUserTaskStatus(normalizeTaskStatus(detail.status))) {
          ongoingImageId = prefImageId
        } else if (detail && isTerminalTaskStatus(detail.status)) {
          ongoingImageId = prefImageId
        } else if (!detail && creationStore.isGeneratingStoryboardImageBatch) {
          ongoingImageId = prefImageId
        }
      }

      if (ongoingImageId == null) {
        if (!tasks.length && taskListOk) {
          try {
            tasks = await fetchRecentProjectTasks(ctx.projectId)
          } catch {
            tasks = []
            taskListOk = false
          }
          if (gen !== resumeFollowGeneration) return
        }
        ongoingImageId = parseTaskId(pickOngoingImageGenerateTask(tasks, preferredImageId)?.id)
      }

      if (!ongoingImageId && taskListOk && prefImageId) {
        const detail = await fetchUserTaskDetailOnce(prefImageId)
        if (gen !== resumeFollowGeneration) return
        if (detail && isOngoingUserTaskStatus(normalizeTaskStatus(detail.status))) {
          ongoingImageId = prefImageId
        } else if (detail && isTerminalTaskStatus(detail.status)) {
          ongoingImageId = prefImageId
        }
      }

      if (ongoingImageId == null && prefImageId && creationStore.isGeneratingStoryboardImageBatch) {
        ongoingImageId = prefImageId
      }

      if (ongoingImageId != null) {
        if (gen !== resumeFollowGeneration) return
        if (isModalOwnedStoryboardImageTaskId(ongoingImageId)) {
          if (creationStore.isGeneratingStoryboardImageBatch) {
            creationStore.setStoryboardImageBatchGenerating(false)
          }
          return
        }
        creationStore.setStoryboardImageBatchGenerating(true)
        applyImmediatePanelLoadingRestore(currentPanels)
        const batchTargetIds = getActiveImageBatchTargetIdsLocal()
        const imageTargets =
          batchTargetIds.length > 0
            ? batchTargetIds
            : resolveBatchImageTargets(currentPanels, storyboardIds, false)

        const imageAlreadyTerminal = await isUserTaskTerminal(ongoingImageId)
        if (imageAlreadyTerminal) {
          syncActiveImageTaskIdToStore(null)
          const resolved = await resolveUserTaskTerminalOutcome(ongoingImageId)
          if (resolved.kind === 'succeeded' || resolved.kind === 'partial_failed') {
            const finalizedPanels = await finalizeBatchPanelsAfterImageGen(
              ctx,
              imageTargets.length ? imageTargets : storyboardIds
            )
            onPanelsUpdate(finalizedPanels)
            creationStore.setStoryboardImageBatchProgress(
              imageTargets.length || storyboardIds.length,
              imageTargets.length || storyboardIds.length
            )
          } else {
            clearPanelGeneratingStatuses(storyboardIds)
          }
          creationStore.setStoryboardImageBatchGenerating(false)
          clearPanelGeneratingStatuses(getActiveImageBatchTargetIdsLocal())
          clearImageBatchTargetIds()
          return
        }

        const imageFollowOutcome = await followOngoingImageGenerateTask(
          ongoingImageId,
          storyboardIds,
          imageTargets.length ? imageTargets : storyboardIds
        )
        if (gen !== resumeFollowGeneration) {
          keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, currentPanels, {
            imageTaskId: ongoingImageId
          })
          return
        }
        if (imageFollowOutcome.panels) {
          onPanelsUpdate(imageFollowOutcome.panels)
        }
        if (
          !imageFollowOutcome.ok &&
          shouldKeepImageBatchLoadingAfterFollowMessage(imageFollowOutcome.message)
        ) {
          keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, currentPanels, {
            imageTaskId: ongoingImageId
          })
          return
        }
        if (!matchesCreationLiveGenScope(scopeAtEntry)) {
          keepLoadingAfterFollowInterrupt(scopeAtEntry, storyboardIds, currentPanels, {
            imageTaskId: ongoingImageId
          })
          return
        }
        creationStore.setStoryboardImageBatchGenerating(false)
        clearPanelGeneratingStatuses(getActiveImageBatchTargetIdsLocal())
        clearImageBatchTargetIds()
        return
      }

      const persistedGenerating = Object.entries(
        creationStore.storyboardPanelImageGenStatusByStoryboardId
      ).filter(([, st]) => st === 'generating')

      const pendingImageTasks: Array<[string, { taskId: number; sceneIdx: number }]> = []
      const seenPendingSids = new Set<string>()
      for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
        for (const [sidRaw, snap] of Object.entries(
          blob.storyboardImageGenTasksByStoryboardId || {}
        )) {
          if (seenPendingSids.has(sidRaw)) continue
          seenPendingSids.add(sidRaw)
          pendingImageTasks.push([sidRaw, snap as { taskId: number; sceneIdx: number }])
        }
      }

      if (!persistedGenerating.length && !pendingImageTasks.length) {
        if (creationStore.isGeneratingStoryboardImageBatch) {
          const promptTid = parseTaskId(creationStore.storyboardImageBatchActiveTaskId)
          const imageTid = parseTaskId(creationStore.storyboardImageBatchActiveImageTaskId)
          // 仍有 taskId 时禁止「只刷 loading 不连 SSE」早退（跨集返回常见）
          if (promptTid || imageTid) {
            applyImmediatePanelLoadingRestore(currentPanels, { skipScopeHydrate: true })
            if (promptTid) {
              creationStore.setStoryboardImageBatchGenerating(true)
              ensureImageBatchLoadingUi(
                keepLoadingTargetsForStoryboards(storyboardIds),
                currentPanels
              )
              if (gen !== resumeFollowGeneration) return
              await followPromptTask(promptTid, storyboardIds)
              return
            }
            if (imageTid && !isModalOwnedStoryboardImageTaskId(imageTid)) {
              creationStore.setStoryboardImageBatchGenerating(true)
              const targets = keepLoadingTargetsForStoryboards(storyboardIds)
              ensureImageBatchLoadingUi(targets, currentPanels)
              if (gen !== resumeFollowGeneration) return
              await followOngoingImageGenerateTask(imageTid, storyboardIds, targets)
              return
            }
          }
          if (!taskListOk) {
            ensureBatchPanelLoadingUi(currentPanels)
            return
          }
          const flatHasBatchWork =
            creationStore.storyboardImageBatchTargetStoryboardIds.length > 0 ||
            creationStore.storyboardImageBatchActiveImageTaskId != null ||
            batchRunInFlight
          if (hasPersistedStoryboardImageBatchGenWork(creationStore, route) || flatHasBatchWork) {
            applyImmediatePanelLoadingRestore(currentPanels, { skipScopeHydrate: true })
            return
          }
          stopImageBatchGeneration()
        }
        return
      }

      if (pendingImageTasks.length) {
        // 弹窗持久化任务由弹窗恢复，外层列表不建立 SSE。
        return
      }

      if (persistedGenerating.length) {
        applyImmediatePanelLoadingRestore(currentPanels, { skipScopeHydrate: batchRunInFlight })
        return
      }
      } finally {
        endFlowTaskListQuietWindow(ctx.projectId)
      }
    }

    const pending = run()
    const owner = pending.finally(() => {
      restoreSessionInFlight = null
    })
    restoreSessionInFlight = owner
    return owner
  }

  async function requestStop() {
    stopRequested = true
    closeStream()
    const promptTaskId = activeTaskId.value ?? creationStore.storyboardImageBatchActiveTaskId
    const imageTaskId =
      imageFollowInFlight?.taskId ??
      activeImageTaskId.value ??
      creationStore.storyboardImageBatchActiveImageTaskId
    const taskIds = [promptTaskId, imageTaskId]
      .map((id) => parseTaskId(id))
      .filter((id): id is number => id != null)
    for (const taskId of [...new Set(taskIds)]) {
      try {
        await requestCancelUserTaskById(taskId)
      } catch {
        /* ignore */
      }
    }
    syncActiveTaskIdToStore(null)
    syncActiveImageTaskIdToStore(null)
    stopImageBatchGeneration()
  }

  function onGlobalStopTask(event: Event) {
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    const id = parseTaskId(detail?.taskId)
    if (!id) return
    if (
      !isStoryboardImagePromptBatchTask(detail?.taskType) &&
      !isStoryboardImageGenerateTaskType(detail?.taskType) &&
      activeTaskId.value !== id &&
      activeImageTaskId.value !== id &&
      creationStore.storyboardImageBatchActiveTaskId !== id &&
      creationStore.storyboardImageBatchActiveImageTaskId !== id
    ) {
      return
    }
    void requestStop()
  }

  function onGlobalTrackTask(
    event: Event,
    onDone?: (result: { ok: boolean; panels: StoryboardPanel[]; message?: string }) => void
  ) {
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    if (!isStoryboardImagePromptBatchTask(detail?.taskType)) return
    const id = parseTaskId(detail?.taskId)
    if (!id) return
    const panels = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
    const storyboardIds = panels
      .map((p) => parseServerStoryboardId(p.id))
      .filter((sid): sid is number => sid != null)
    void (async () => {
      const promptOutcome = await followPromptTask(id, storyboardIds)
      let workingPanels = panels
      if (promptOutcome.ok || promptOutcome.partial) {
        workingPanels = await refreshPanelsFromApi()
        const batchTargetIds = getActiveImageBatchTargetIdsLocal()
        const imageTargets = batchTargetIds.length
          ? batchTargetIds
          : resolveBatchImageTargets(workingPanels, storyboardIds, false)
        const imageOutcome = await followImageGenerateAfterPrompt(
          imageTargets,
          storyboardIds,
          workingPanels,
          promptOutcome.chainChildTaskIds
        )
        if (imageOutcome.ok) {
          workingPanels = imageOutcome.panels ?? workingPanels
        }
        creationStore.setStoryboardImageBatchGenerating(false)
        clearPanelGeneratingStatuses(storyboardIds)
        clearImageBatchTargetIds()
        onDone?.({
          ok: imageOutcome.ok,
          panels: workingPanels,
          message: imageOutcome.ok
            ? promptOutcome.partial
              ? promptOutcome.message
              : undefined
            : imageOutcome.message
        })
      } else {
        creationStore.setStoryboardImageBatchGenerating(false)
        clearImageBatchTargetIds()
        onDone?.({ ok: false, panels: workingPanels, message: promptOutcome.message })
      }
    })()
  }

  function onGlobalResumeTask(
    event: Event,
    onPanelsUpdate: (panels: StoryboardPanel[]) => void,
    onDone?: (result: { ok: boolean; panels: StoryboardPanel[]; message?: string }) => void
  ) {
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    if (!isStoryboardImagePromptBatchTask(detail?.taskType)) return
    const id = parseTaskId(detail?.taskId)
    if (!id) return
    const panels = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
    const storyboardIds = panels
      .map((p) => parseServerStoryboardId(p.id))
      .filter((sid): sid is number => sid != null)
    void (async () => {
      beginBatchSseFollow()
      try {
        try {
          await resumeUserTask(id, 'storyboard_image_prompt_batch')
          creationStore.removePausedTaskFollow(id)
          invalidateRecentProjectTasksCache()
          const promptOutcome = await followPromptTask(id, storyboardIds)
          let workingPanels = panels
          if (promptOutcome.ok || promptOutcome.partial) {
            workingPanels = await refreshPanelsFromApi()
            onPanelsUpdate(workingPanels)
            const batchTargetIds = getActiveImageBatchTargetIdsLocal()
            const imageTargets = batchTargetIds.length
              ? batchTargetIds
              : resolveBatchImageTargets(workingPanels, storyboardIds, false)
            const imageOutcome = await followImageGenerateAfterPrompt(
              imageTargets,
              storyboardIds,
              workingPanels,
              promptOutcome.chainChildTaskIds
            )
            if (imageOutcome.ok) {
              workingPanels = imageOutcome.panels ?? workingPanels
              onPanelsUpdate(workingPanels)
            }
            creationStore.setStoryboardImageBatchGenerating(false)
            clearPanelGeneratingStatuses(storyboardIds)
            clearImageBatchTargetIds()
            onDone?.({
              ok: imageOutcome.ok,
              panels: workingPanels,
              message: imageOutcome.ok
                ? promptOutcome.partial
                  ? promptOutcome.message
                  : undefined
                : imageOutcome.message
            })
          } else {
            creationStore.setStoryboardImageBatchGenerating(false)
            clearImageBatchTargetIds()
            onDone?.({ ok: false, panels: workingPanels, message: promptOutcome.message })
          }
        } catch (e: unknown) {
          syncActiveTaskIdToStore(null)
          syncActiveImageTaskIdToStore(null)
          creationStore.setStoryboardImageBatchGenerating(false)
          clearPanelGeneratingStatuses(getActiveImageBatchTargetIdsLocal())
          clearImageBatchTargetIds()
          const err = e as { msg?: string; message?: string }
          onDone?.({
            ok: false,
            panels,
            message: err?.msg || err?.message || '续生失败'
          })
        }
      } finally {
        endBatchSseFollow()
      }
    })()
  }

  /** 断开 SSE 并作废进行中的 restore follow；保留 Pinia taskId，供切步/刷新后恢复 loading */
  function cancelResumeFollow(): Promise<void> {
    resumeFollowGeneration++
    closeStream()
    const imageTaskId =
      imageFollowInFlight?.taskId ??
      activeImageTaskId.value ??
      creationStore.storyboardImageBatchActiveImageTaskId
    if (imageTaskId != null) suspendTaskSseFollow(imageTaskId)
    return followIdleBarrier.waitForIdle()
  }

  /**
   * 是否已有真实任务链 owner（不含只负责发现任务的 restoreSession）。
   * 页面恢复协调器单独串行化 restore，任务链状态只用于阻止内部响应式写入反向恢复。
   */
  function isFollowInFlight(): boolean {
    return (
      batchRunInFlight ||
      batchSseFollowInFlight ||
      followInFlight != null ||
      imageFollowInFlight != null
    )
  }

  return {
    activeTaskId,
    runBatchForPanels,
    requestStop,
    restoreOngoingBatchIfNeeded,
    applyImmediatePanelLoadingRestore,
    ensureBatchPanelLoadingUi,
    onGlobalStopTask,
    onGlobalTrackTask,
    onGlobalResumeTask,
    onStoryboardImageGenSseTerminal,
    cancelResumeFollow,
    waitForFollowIdle: followIdleBarrier.waitForIdle,
    isFollowInFlight
  }
}
