import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import {
  applyCreationStoreScopeLiveGenFromRoute,
  collectStoryboardVideoGenTaskEntriesInScopes,
  resolveCurrentStep4LiveGenScopeBlobs,
  resolveStoryboardVideoGenEntriesByTaskId
} from '~/composables/useCreationStoreHydration'
import { hasPersistedStoryboardVideoBatchGenWork } from '~/utils/storyboardListBootstrap'
import { resolveVideoBatchRestoreFollowTarget } from '~/utils/storyboardVideoBatchRestoreTarget'
import {
  userStoryboardGenerateVideoPromptImage,
  userStoryboardGenerateVideoWithPrompt,
  userStoryboardSetFinalVideo,
  userTaskDetailCached
} from '~/utils/businessApi'
import {
  fetchFlowUserTaskListOnce,
  filterUserTaskRowsForEpisode
} from '~/utils/userTaskListFlowOnce'
import {
  buildVideoBatchScopePreserveOnContextSwitch,
  shouldKeepVideoBatchLoadingAfterFollowMessage,
  shouldRestoreImageBatchSse,
  shouldTrustPersistedTaskIdOnListMiss,
  isNavigationOrSuspendBatchMessage
} from '~/utils/storyboardImageBatchRestoreGate'
import { requestCancelUserTaskById } from '~/utils/userTaskCancelFlow'
import {
  fetchProjectStoryboardRecords,
  fetchStoryboardRecordsForStoryboard,
  groupStoryboardRecordsByStoryboardId,
  clearProjectStoryboardRecordCache,
  type ProjectEpisodeContext
} from '~/utils/storyboardRecordBatch'
import {
  isOriginalStoryboardVideoRecord,
  resolveStoryboardRecordDisplayName,
  resolveStoryboardVideoSourceLabel
} from '~/utils/storyboardRecordRow'
import {
  resumeStoryboardPromptGenerateTask,
  sanitizeStoryboardPromptModelCode
} from '~/utils/storyboardPromptGenerateFlow'
import { resolveStoryboardVideoPromptSubmitAgentCode } from '~/utils/extractAgentBiz'
import {
  buildStoryboardVideoResolutionField,
  formatVideoResolutionForApi
} from '~/utils/storyboardVideoGenerateParams'
import { shouldPassStoryboardVideoDuration } from '~/utils/creationModeUiRules'
import {
  STORYBOARD_GEN_CONFIG_SCENE_CODES,
  resolveStoryboardGenConfigLlmFields
} from '~/utils/projectGenConfig'
import {
  followStoryboardVideoGenerateTask,
  resumeStoryboardVideoGenerateTask,
  runStoryboardImageVideoGenerateTask
} from '~/composables/useStoryboardVideoGenerateTask'
import { useTaskStream } from '~/composables/useTaskStream'
import {
  extractChainChildTaskIds,
  extractChainChildTaskIdsFromTaskDetail
} from '~/utils/taskChainChild'
import {
  fetchUserTaskDetailOnce,
  isUserTaskTerminal,
  normalizeTaskStatus,
  resolveUserTaskTerminalOutcome,
  suspendTaskSseFollow
} from '~/composables/useTaskSseFollow'
import {
  isStoryboardVideoGenerateResumableStatus,
  parseVideoBatchSuccessItems,
  resolveVideoBatchFailedStoryboardIds,
  resumeUserTask,
  type TaskVideoBatchSuccessItem
} from '~/utils/taskPartialFailed'
import type { StoryboardPanel, StoryboardVideoPanel } from '~/types'
import type {
  StoryboardRecordRow,
  StoryboardVideoImageGenerateRequest,
  UserTaskRow
} from '~/types/business-api'
import {
  modalGenSessionScopeFromStore,
  readScopedSessionItem,
  removeScopedSessionItem,
  writeScopedSessionItem
} from '~/utils/modalGenSessionScope'
import { readStoryboardVideoModalGenSession } from '~/utils/storyboardVideoModalGenSession'
import { createAsyncIdleBarrier } from '~/utils/asyncIdleBarrier'

function bizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

type StoryboardVideoPromptFollowResult = {
  ok: boolean
  partial?: boolean
  message?: string
  taskId?: number
  chainChildTaskIds?: number[]
}

type StoryboardVideoGenerateFollowResult = {
  ok: boolean
  partial?: boolean
  message?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normStoryboardVideoPromptBatchTaskType(ty: unknown): string {
  return String(ty ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
}

function isStoryboardVideoPromptBatchTask(ty: unknown): boolean {
  return normStoryboardVideoPromptBatchTaskType(ty) === 'storyboard_video_prompt_batch'
}

function isStoryboardVideoGenerateTaskType(ty: unknown): boolean {
  return normStoryboardVideoPromptBatchTaskType(ty) === 'storyboard_video_generate'
}

function isOngoingUserTaskStatus(status: unknown): boolean {
  // 与任务中心 isTaskOngoingStatus 对齐：后端可能用 '0' 表示进行中
  const s = String(status ?? '')
    .trim()
    .toUpperCase()
  return (
    s === 'PENDING' ||
    s === 'PROCESSING' ||
    s === 'RUNNING' ||
    s === 'QUEUED' ||
    s === 'WAITING' ||
    s === '0'
  )
}

function mapRecordToPanelVideo(r: StoryboardRecordRow, title: string) {
  const url = String(r.fileUrl ?? '').trim()
  return {
    id: String(r.id),
    url,
    title: resolveStoryboardRecordDisplayName(r, title) || title,
    source: resolveStoryboardVideoSourceLabel({ _fromServer: true, _serverRow: r }),
    importDate: r.createTime || undefined,
    isStoryboardVideo: r.isSelected === 1 && isOriginalStoryboardVideoRecord(r),
    _fromServer: true,
    _serverRow: r
  }
}

function pickLatestVideoRecord(rows: StoryboardRecordRow[]): StoryboardRecordRow | null {
  const withUrl = rows.filter(
    (r) => isOriginalStoryboardVideoRecord(r) && String(r?.fileUrl ?? '').trim()
  )
  if (!withUrl.length) return null
  return (
    [...withUrl].sort((a, b) => {
      const ta = String(a.createTime ?? '')
      const tb = String(b.createTime ?? '')
      return tb.localeCompare(ta) || Number(b.id) - Number(a.id)
    })[0] ?? null
  )
}

function markRecordSelectedInVideoMap(
  videoByStoryboardId: Map<number, StoryboardRecordRow[]>,
  storyboardId: number,
  recordId: number
) {
  const sid = Number(storyboardId)
  const rid = Number(recordId)
  const rows = videoByStoryboardId.get(sid)
  if (!rows?.length) return
  videoByStoryboardId.set(
    sid,
    rows.map((r) => {
      const id = Number(r.id)
      if (id === rid) return { ...r, isSelected: 1 }
      if (r.isSelected === 1) return { ...r, isSelected: 0 }
      return r
    })
  )
}

function buildPanelVideosFromRows(
  rows: StoryboardRecordRow[],
  panelTitle: string
): NonNullable<StoryboardVideoPanel['videos']> {
  return rows
    .filter((r) => isOriginalStoryboardVideoRecord(r) && !!String(r?.fileUrl ?? '').trim())
    .map((r) => mapRecordToPanelVideo(r, panelTitle))
}

/** 批量设主视频：list-by-storyboard 只请求一次，再单次 setFinalVideo（items 批量） */
async function setFinalVideosForStoryboards(
  ctx: ProjectEpisodeContext,
  storyboardIds: number[],
  cachedVideoByStoryboardId?: Map<number, StoryboardRecordRow[]>
): Promise<{
  results: Map<number, boolean>
  videoByStoryboardId: Map<number, StoryboardRecordRow[]>
}> {
  const results = new Map<number, boolean>()
  let videoByStoryboardId = cachedVideoByStoryboardId ?? new Map<number, StoryboardRecordRow[]>()

  if (!storyboardIds.length) return { results, videoByStoryboardId }

  if (!cachedVideoByStoryboardId) {
    try {
      const videoRows = await fetchProjectStoryboardRecords(ctx, 'video')
      videoByStoryboardId = groupStoryboardRecordsByStoryboardId(videoRows)
    } catch {
      for (const sid of storyboardIds) results.set(sid, false)
      return { results, videoByStoryboardId }
    }
  }

  const sidToRecordId = new Map<number, number>()
  const items: Array<{ storyboardId: number; recordId: number }> = []

  for (const storyboardId of storyboardIds) {
    const sid = Number(storyboardId)
    const latest = pickLatestVideoRecord(videoByStoryboardId.get(sid) ?? [])
    const rid = Number(latest?.id)
    if (!Number.isFinite(rid) || rid <= 0) {
      results.set(sid, false)
      continue
    }
    sidToRecordId.set(sid, rid)
    items.push({ storyboardId: sid, recordId: rid })
  }

  if (!items.length) return { results, videoByStoryboardId }

  const SET_FINAL_BATCH_MAX = 50
  const successRecordIds = new Set<number>()

  for (let i = 0; i < items.length; i += SET_FINAL_BATCH_MAX) {
    const chunk = items.slice(i, i + SET_FINAL_BATCH_MAX)
    try {
      const data = await userStoryboardSetFinalVideo({
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
      markRecordSelectedInVideoMap(videoByStoryboardId, sid, rid)
      results.set(sid, true)
    } else {
      results.set(sid, false)
    }
  }

  if (successRecordIds.size > 0) {
    clearProjectStoryboardRecordCache(ctx)
  }

  return { results, videoByStoryboardId }
}

type ModalVideoRestoreEntry = [
  string,
  { taskId: number; sceneIdx: number; taskKind: 'i2v' | 'multi' | 'edge' | 'grid' }
]

function toModalVideoRestoreEntries(
  entries: ReturnType<typeof collectStoryboardVideoGenTaskEntriesInScopes>
): ModalVideoRestoreEntry[] {
  return entries.map((e) => [
    String(e.storyboardId),
    {
      taskId: e.taskId,
      sceneIdx: e.sceneIdx,
      taskKind: e.taskKind
    }
  ])
}

function resolveModalVideoRestoreEntriesForTaskId(
  taskId: number,
  pairs: StoryboardVideoPair[],
  creationStore: ReturnType<typeof useCreationStore>,
  route: ReturnType<typeof useRoute>
): ModalVideoRestoreEntry[] {
  const fromStore = toModalVideoRestoreEntries(
    resolveStoryboardVideoGenEntriesByTaskId(creationStore, taskId, route)
  )
  if (fromStore.length) return fromStore

  const session = readStoryboardVideoModalGenSession(modalGenSessionScopeFromStore(creationStore))
  if (!session?.storyboardId) return []

  const sessionTaskId = Number(session.taskId)
  const sessionTaskMatches =
    !Number.isFinite(sessionTaskId) || sessionTaskId <= 0 || sessionTaskId === Number(taskId)
  if (!sessionTaskMatches) return []

  const pair = pairs.find((p) => p.storyboardId === session.storyboardId)
  const sceneIdx = pair?.index ?? session.sceneIdx
  if (sceneIdx < 0 || sceneIdx >= pairs.length) return []

  const taskKind =
    session.taskKind === 'multi' || session.taskKind === 'edge' || session.taskKind === 'grid'
      ? session.taskKind
      : 'i2v'

  return [
    [
      String(session.storyboardId),
      {
        taskId: Number(taskId),
        sceneIdx,
        taskKind
      }
    ]
  ]
}

type StoryboardVideoPair = {
  script: StoryboardPanel
  video: StoryboardVideoPanel | undefined
  index: number
  storyboardId: number
}

function collectStoryboardVideoPairs(
  scriptPanels: StoryboardPanel[],
  videoPanels: StoryboardVideoPanel[]
): StoryboardVideoPair[] {
  return scriptPanels
    .map((sp, index) => ({
      script: sp,
      video: videoPanels[index],
      index,
      storyboardId: parseServerStoryboardId(sp.id)
    }))
    .filter((x) => x.storyboardId != null) as StoryboardVideoPair[]
}

/** 弹窗内单条生视频后台续跟中的 storyboardId，避免与 EditStoryboardVideoModal 重复连 SSE */
export const activeStoryboardVideoModalRestoreFollowIds = new Set<number>()

/** 弹窗内正在跟进 SSE 的分镜（刷新/重开弹窗时由 EditStoryboardVideoModal 写入） */
export const activeStoryboardVideoModalOwnedFollowIds = new Set<number>()

export function isStoryboardVideoModalRestoreFollowing(storyboardId: number): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  return activeStoryboardVideoModalRestoreFollowIds.has(sid)
}

export function isStoryboardVideoModalOwnedFollow(storyboardId: number): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  return activeStoryboardVideoModalOwnedFollowIds.has(sid)
}

function panelHasStoryboardVideo(panel: StoryboardVideoPanel): boolean {
  const list = Array.isArray(panel.videos) ? panel.videos : []
  return list.some((v) => v.isStoryboardVideo && String(v.url ?? '').trim())
}

function storePanelHasVideoFailure(
  creationStore: ReturnType<typeof useCreationStore>,
  sid: number,
  errors: Record<string, string>
): boolean {
  const key = String(sid)
  const err = String(errors[key] ?? '').trim()
  const status = creationStore.storyboardPanelVideoGenStatusByStoryboardId[key]
  return !!err || status === 'failed'
}

/** 将 scope 内持久化的 generating / 失败文案合并进列表 panels（刷新/拉列表后恢复 UI） */
export function applyStoryboardVideoPanelUiFromStore(
  creationStore: ReturnType<typeof useCreationStore>,
  scriptPanels: StoryboardPanel[],
  videoPanels: StoryboardVideoPanel[]
): StoryboardVideoPanel[] {
  return videoPanels.map((panel, index) => {
    const sp = scriptPanels[index]
    const sid = sp ? parseServerStoryboardId(sp.id) : null
    if (sid == null) return panel

    const key = String(sid)
    const batchTargets = creationStore.storyboardVideoBatchTargetStoryboardIds
    const isBatchActive =
      creationStore.isGeneratingStoryboardVideo ||
      creationStore.storyboardVideoBatchActivePromptTaskId != null ||
      creationStore.storyboardVideoBatchActiveVideoTaskId != null
    const isBatchTarget = creationStore.isStoryboardVideoBatchTarget(sid)

    if (batchTargets.length > 0 && isBatchActive && !isBatchTarget) {
      return { ...panel, generating: false, generateError: undefined }
    }

    const storeGenerating =
      creationStore.storyboardPanelVideoGenStatusByStoryboardId[key] === 'generating'
    const storeErr = String(
      creationStore.storyboardPanelVideoGenErrorByStoryboardId[key] ?? ''
    ).trim()
    const storeStatus = creationStore.storyboardPanelVideoGenStatusByStoryboardId[key]
    const failMsg = storeErr || (storeStatus === 'failed' ? '视频生成失败' : '')

    if (failMsg) {
      if (panelHasStoryboardVideo(panel)) {
        return {
          ...panel,
          generating: false,
          generateError: undefined
        }
      }
      return {
        ...panel,
        generating: false,
        generateError: failMsg,
        videos: []
      }
    }

    const shouldGenerate =
      storeGenerating || (creationStore.isGeneratingStoryboardVideo && isBatchTarget)

    return {
      ...panel,
      generating: shouldGenerate,
      generateError: undefined
    }
  })
}

function panelHasPersistedVideoFailure(
  creationStore: ReturnType<typeof useCreationStore>,
  storyboardId: number
): boolean {
  return storePanelHasVideoFailure(creationStore, storyboardId, {})
}

const STORYBOARD_VIDEO_BATCH_TARGET_IDS_SESSION_KEY =
  'create-flow:storyboard-video-batch-target-storyboard-ids'

function normalizeStoryboardVideoBatchTargetIds(raw: unknown): number[] {
  const source = Array.isArray(raw) ? raw : []
  const ids = source.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  return [...new Set(ids)]
}

function readVideoBatchTargetIdsSession(
  creationStore: ReturnType<typeof useCreationStore>
): number[] {
  const raw = readScopedSessionItem(
    STORYBOARD_VIDEO_BATCH_TARGET_IDS_SESSION_KEY,
    modalGenSessionScopeFromStore(creationStore)
  )
  if (!raw) return []
  try {
    return normalizeStoryboardVideoBatchTargetIds(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeVideoBatchTargetIdsSession(
  creationStore: ReturnType<typeof useCreationStore>,
  storyboardIds: number[]
): void {
  const ids = normalizeStoryboardVideoBatchTargetIds(storyboardIds)
  if (!ids.length) {
    removeScopedSessionItem(
      STORYBOARD_VIDEO_BATCH_TARGET_IDS_SESSION_KEY,
      modalGenSessionScopeFromStore(creationStore)
    )
    return
  }
  writeScopedSessionItem(
    STORYBOARD_VIDEO_BATCH_TARGET_IDS_SESSION_KEY,
    JSON.stringify(ids),
    modalGenSessionScopeFromStore(creationStore)
  )
}

function clearVideoBatchTargetIdsSession(creationStore: ReturnType<typeof useCreationStore>): void {
  removeScopedSessionItem(
    STORYBOARD_VIDEO_BATCH_TARGET_IDS_SESSION_KEY,
    modalGenSessionScopeFromStore(creationStore)
  )
}

/** @deprecated 请改用 applyStoryboardVideoPanelUiFromStore */
export function applyStoryboardVideoPanelErrorsFromStore(
  creationStore: ReturnType<typeof useCreationStore>,
  scriptPanels: StoryboardPanel[],
  videoPanels: StoryboardVideoPanel[]
): StoryboardVideoPanel[] {
  return applyStoryboardVideoPanelUiFromStore(creationStore, scriptPanels, videoPanels)
}

function getActiveVideoBatchTargetIds(
  creationStore: ReturnType<typeof useCreationStore>,
  route?: import('vue-router').RouteLocationNormalizedLoaded
): number[] {
  const persisted = creationStore.storyboardVideoBatchTargetStoryboardIds
  if (persisted.length) return persisted

  const explicitFromBlob = new Set<number>()
  for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
    if (!Array.isArray(blob.storyboardVideoBatchTargetStoryboardIds)) continue
    for (const id of blob.storyboardVideoBatchTargetStoryboardIds) {
      const n = Number(id)
      if (Number.isFinite(n) && n > 0) explicitFromBlob.add(n)
    }
  }
  if (explicitFromBlob.size) return [...explicitFromBlob]

  const fromSession = readVideoBatchTargetIdsSession(creationStore)
  if (fromSession.length) return fromSession

  const fromStatus = Object.entries(creationStore.storyboardPanelVideoGenStatusByStoryboardId)
    .filter(([, st]) => st === 'generating')
    .map(([k]) => Number(k))
    .filter((id) => Number.isFinite(id) && id > 0)
  if (fromStatus.length) return fromStatus

  const fromBlob = new Set<number>()
  for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
    for (const [sidRaw, st] of Object.entries(
      blob.storyboardPanelVideoGenStatusByStoryboardId ?? {}
    )) {
      if (st !== 'generating') continue
      const sid = Number(sidRaw)
      if (Number.isFinite(sid) && sid > 0) fromBlob.add(sid)
    }
  }
  return [...fromBlob]
}

function resolveBatchVideoTargetsForRestore(
  scriptPanels: StoryboardPanel[],
  videoPanels: StoryboardVideoPanel[],
  storyboardIds: number[],
  overwrite: boolean
): number[] {
  const pairs = collectStoryboardVideoPairs(scriptPanels, videoPanels)
  return storyboardIds.filter((sid) => {
    const pair = pairs.find((p) => p.storyboardId === sid)
    if (!pair) return false
    if (!pair.video) return true
    if (!overwrite && panelHasStoryboardVideo(pair.video)) return false
    return true
  })
}

/**
 * 刷新/拉列表后恢复分镜视频卡片 loading 到 store（与分镜脚本 isPanelImageGenerating 数据源一致）。
 * @param options.skipScopeHydrate 为 true 时跳过 scope→flat hydrate（由 store 变更触发的 watcher 内必须传 true，避免死循环）
 */
export function applyStoryboardVideoImmediatePanelLoadingRestore(
  creationStore: ReturnType<typeof useCreationStore>,
  route: import('vue-router').RouteLocationNormalizedLoaded,
  scriptPanels: StoryboardPanel[],
  videoPanels: StoryboardVideoPanel[],
  options?: { skipScopeHydrate?: boolean }
): void {
  if (!options?.skipScopeHydrate) {
    applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
  }

  const resolvedScriptPanels = scriptPanels.length
    ? scriptPanels
    : (creationStore.formData.storyboardScript.panels as StoryboardPanel[]) || []

  const scopeCandidates = resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)
  const pendingModalSids = new Set<number>()
  const generatingSids = new Set<number>()

  for (const { blob } of scopeCandidates) {
    for (const sidRaw of Object.keys(blob.storyboardVideoGenTasksByStoryboardId ?? {})) {
      const sid = Number(sidRaw)
      if (Number.isFinite(sid) && sid > 0) pendingModalSids.add(sid)
    }
    /** 弹窗内单条「生成提示词」进行中：外层列表不同步 batch loading，避免切步骤回来抖动/循环 */
    for (const sidRaw of Object.keys(blob.storyboardVideoPromptGenTasksByStoryboardId ?? {})) {
      const sid = Number(sidRaw)
      if (Number.isFinite(sid) && sid > 0) pendingModalSids.add(sid)
    }
    for (const [sidRaw, st] of Object.entries(
      blob.storyboardPanelVideoGenStatusByStoryboardId ?? {}
    )) {
      if (st !== 'generating') continue
      const sid = Number(sidRaw)
      if (Number.isFinite(sid) && sid > 0) generatingSids.add(sid)
    }
  }

  const isPromptOnlyBatch =
    creationStore.storyboardVideoBatchActivePromptTaskId != null &&
    creationStore.storyboardVideoBatchActiveVideoTaskId == null
  const batchTargetIds = getActiveVideoBatchTargetIds(creationStore, route)

  for (const sid of generatingSids) {
    if (pendingModalSids.has(sid)) continue
    if (creationStore.storyboardPanelVideoGenStatusByStoryboardId[String(sid)] === 'generating') {
      continue
    }
    creationStore.setStoryboardPanelVideoGenStatus(sid, 'generating')
  }

  if (isPromptOnlyBatch) {
    for (const sid of batchTargetIds) {
      if (pendingModalSids.has(sid)) continue
      if (creationStore.storyboardPanelVideoGenStatusByStoryboardId[String(sid)] === 'generating') {
        continue
      }
      creationStore.setStoryboardPanelVideoGenStatus(sid, 'generating')
    }
    const targetSet = new Set(batchTargetIds)
    if (targetSet.size > 0) {
      const pairs = collectStoryboardVideoPairs(resolvedScriptPanels, videoPanels)
      for (const pair of pairs) {
        if (targetSet.has(pair.storyboardId) || pendingModalSids.has(pair.storyboardId)) continue
        const key = String(pair.storyboardId)
        if (creationStore.storyboardPanelVideoGenStatusByStoryboardId[key] === 'generating') {
          creationStore.clearStoryboardPanelVideoGenStatus(pair.storyboardId)
        }
      }
    }
    return
  }

  if (
    creationStore.isGeneratingStoryboardVideo &&
    (creationStore.storyboardVideoBatchActiveVideoTaskId != null ||
      creationStore.storyboardVideoBatchTargetStoryboardIds.length > 0 ||
      batchTargetIds.length > 0)
  ) {
    const storyboardIds = collectStoryboardVideoPairs(resolvedScriptPanels, videoPanels).map(
      (p) => p.storyboardId
    )
    const targets =
      batchTargetIds.length > 0
        ? batchTargetIds
        : resolveBatchVideoTargetsForRestore(
            resolvedScriptPanels,
            videoPanels,
            storyboardIds,
            false
          )
    const targetSet = new Set(targets)
    for (const sid of targets) {
      if (pendingModalSids.has(sid)) continue
      if (creationStore.storyboardPanelVideoGenStatusByStoryboardId[String(sid)] === 'generating') {
        continue
      }
      creationStore.setStoryboardPanelVideoGenStatus(sid, 'generating')
    }
    if (targetSet.size > 0) {
      const pairs = collectStoryboardVideoPairs(resolvedScriptPanels, videoPanels)
      for (const pair of pairs) {
        if (targetSet.has(pair.storyboardId) || pendingModalSids.has(pair.storyboardId)) continue
        const key = String(pair.storyboardId)
        if (creationStore.storyboardPanelVideoGenStatusByStoryboardId[key] === 'generating') {
          creationStore.clearStoryboardPanelVideoGenStatus(pair.storyboardId)
        }
      }
    }
  }
}

export function useStoryboardVideoBatchGenerate() {
  const route = useRoute()
  const creationStore = useCreationStore()

  const activePromptTaskId = ref<number | null>(null)
  let promptStreamCloser: (() => void) | null = null
  let stopRequested = false
  let manualPromptAgentModelPick = false
  let manualVideoModelPick = false
  let resumeFollowGeneration = 0
  let batchSseFollowInFlight = false
  let batchSseFollowDepth = 0
  /** 整段 restore / run 进行中（含 detail/list 等待），防止 cancelResumeFollow 误打断 */
  let batchRunInFlight = false
  let restoreSessionInFlight: Promise<void> | null = null
  let promptFollowOwner: {
    taskId: number
    promise: Promise<StoryboardVideoPromptFollowResult>
  } | null = null
  let videoFollowOwner: {
    taskId: number
    promise: Promise<StoryboardVideoGenerateFollowResult>
  } | null = null
  const followIdleBarrier = createAsyncIdleBarrier(() => isVideoBatchFollowBusy())

  function beginBatchSseFollow() {
    batchSseFollowDepth += 1
    batchSseFollowInFlight = true
  }

  function endBatchSseFollow() {
    batchSseFollowDepth = Math.max(0, batchSseFollowDepth - 1)
    batchSseFollowInFlight = batchSseFollowDepth > 0
    followIdleBarrier.notifyStateChange()
  }

  function isVideoBatchFollowBusy(): boolean {
    return (
      batchSseFollowInFlight ||
      batchRunInFlight ||
      promptFollowOwner != null ||
      videoFollowOwner != null
    )
  }

  function closePromptStream() {
    const close = promptStreamCloser
    promptStreamCloser = null
    if (close) {
      try {
        close()
      } catch {
        /* ignore */
      }
    }
  }

  function syncActivePromptTaskIdToStore(taskId: number | null) {
    activePromptTaskId.value = taskId
    creationStore.setStoryboardVideoBatchActivePromptTaskId(taskId)
  }

  function syncActiveVideoTaskIdToStore(taskId: number | null) {
    creationStore.setStoryboardVideoBatchActiveVideoTaskId(taskId)
  }

  let cachedProjectTaskList: { projectId: number; at: number; rows: UserTaskRow[] } | null = null
  const PROJECT_TASK_LIST_CACHE_MS = 5000

  async function fetchProjectTaskListCached(
    projectId: number,
    options?: { force?: boolean }
  ): Promise<UserTaskRow[]> {
    const pid = Number(projectId)
    if (!Number.isFinite(pid) || pid <= 0) return []
    const now = Date.now()
    const force = options?.force === true
    if (
      !force &&
      cachedProjectTaskList &&
      cachedProjectTaskList.projectId === pid &&
      now - cachedProjectTaskList.at < PROJECT_TASK_LIST_CACHE_MS
    ) {
      return filterUserTaskRowsForEpisode(
        cachedProjectTaskList.rows,
        creationStore.currentEpisodeId
      )
    }
    // restore 必须 force：避免流程内旧 list 缓存不含「刚提交的出片任务」
    const rows = await fetchFlowUserTaskListOnce(pid, { force })
    cachedProjectTaskList = { projectId: pid, at: now, rows }
    /** 剧集隔离：禁止把其它集的分镜视频任务恢复到本集 */
    return filterUserTaskRowsForEpisode(rows, creationStore.currentEpisodeId)
  }

  function invalidateProjectTaskListCache() {
    cachedProjectTaskList = null
  }

  function notifyGlobalTasksUpdatedOnce() {
    if (!import.meta.client) return
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }

  function setManualPromptAgentModelPick(value: boolean) {
    manualPromptAgentModelPick = value
  }

  function setManualVideoModelPick(value: boolean) {
    manualVideoModelPick = value
  }

  function resolveVideoPromptAgentCode(): string {
    return resolveStoryboardVideoPromptSubmitAgentCode(
      'video_prompt',
      creationStore.storyboardVideoGenerateSettings.agentId
    )
  }

  function resolveVideoPromptModelCode(): string {
    return sanitizeStoryboardPromptModelCode(
      creationStore.storyboardVideoGenerateSettings.videoPromptModelCode
    )
  }

  async function buildVideoPromptSubmitFields(projectId: number) {
    return resolveStoryboardGenConfigLlmFields(
      projectId,
      STORYBOARD_GEN_CONFIG_SCENE_CODES.videoPrompt,
      manualPromptAgentModelPick,
      resolveVideoPromptAgentCode(),
      resolveVideoPromptModelCode()
    )
  }

  /**
   * 统一合并接口按 creation_mode 自动解析提示词阶段智能体/模型。
   * 只有用户在弹窗里手动切换过提示词智能体或文本模型时，才显式覆盖。
   */
  function buildVideoWithPromptPromptOverrideFields() {
    if (!manualPromptAgentModelPick) return {}
    const agentCode = String(creationStore.storyboardVideoGenerateSettings.agentId || '').trim()
    const modelCode = resolveVideoPromptModelCode()
    return {
      ...(agentCode ? { agentCode } : {}),
      ...(modelCode ? { modelCode } : {})
    }
  }

  function normalizePositiveInteger(raw: unknown): number | undefined {
    const n = Number(raw)
    if (!Number.isInteger(n) || n <= 0) return undefined
    return n
  }

  /** 合并接口出片阶段参数：字段名按 /video-with-prompt 的 genXxx 入参透传 */
  function buildVideoGenSubmitFields(options?: { genDurationSeconds?: number | null }) {
    const settings = creationStore.storyboardVideoGenerateSettings
    const modelName = String(settings.videoModel || '').trim()
    const passDuration = shouldPassStoryboardVideoDuration(
      creationStore.formData.globalSetting?.creationMode
    )
    const durationSeconds = passDuration
      ? normalizePositiveInteger(options?.genDurationSeconds ?? settings.durationSeconds)
      : undefined
    const resolution = formatVideoResolutionForApi(settings.resolution)
    return {
      ...(manualVideoModelPick && modelName ? { genModelName: modelName } : {}),
      ...(settings.aspectRatio ? { genAspectRatio: settings.aspectRatio } : {}),
      ...(durationSeconds ? { genDurationSeconds: durationSeconds } : {}),
      ...(resolution ? { genResolution: resolution } : {}),
      genGenerateAudio: settings.soundEffects === 'with-sound'
    }
  }

  /** 图生出片请求体：自动批量不传 modelName，由 main_storyboard_video_image 池 + 后端兜底 */
  function buildImageVideoGenerateBody(
    storyboardIds: number[]
  ): StoryboardVideoImageGenerateRequest {
    const settings = creationStore.storyboardVideoGenerateSettings
    const modelName = String(settings.videoModel || '').trim()
    const isSingle = storyboardIds.length === 1
    const passDuration = shouldPassStoryboardVideoDuration(
      creationStore.formData.globalSetting?.creationMode
    )
    const durationSeconds = passDuration
      ? normalizePositiveInteger(settings.durationSeconds)
      : undefined
    return {
      storyboardIds,
      ...(manualVideoModelPick && modelName ? { modelName } : {}),
      aspectRatio: settings.aspectRatio || undefined,
      ...(durationSeconds ? { durationSeconds } : {}),
      ...buildStoryboardVideoResolutionField(settings.resolution),
      ...(isSingle ? { count: 1 } : {}),
      generateAudio: settings.soundEffects === 'with-sound'
    }
  }

  function markStoryboardVideoPanelFailed(storyboardId: number, message: string) {
    const sid = Number(storyboardId)
    if (!Number.isFinite(sid) || sid <= 0) return
    creationStore.clearStoryboardPanelVideoGenStatus(sid)
    creationStore.setStoryboardPanelVideoGenStatus(sid, 'failed')
    creationStore.setStoryboardPanelVideoGenError(sid, message || '视频生成失败')
  }

  function markStoryboardVideoPanelSucceeded(storyboardId: number) {
    const sid = Number(storyboardId)
    if (!Number.isFinite(sid) || sid <= 0) return
    creationStore.clearStoryboardPanelVideoGenStatus(sid)
    creationStore.clearStoryboardPanelVideoGenError(sid)
  }

  function collectPairs(
    scriptPanels: StoryboardPanel[],
    videoPanels: StoryboardVideoPanel[]
  ): StoryboardVideoPair[] {
    return collectStoryboardVideoPairs(scriptPanels, videoPanels)
  }

  /** 批量出片目标分镜：持久化记录，手动新增分镜不在此列表内 */
  function getActiveBatchTargetIds(): number[] {
    return getActiveVideoBatchTargetIds(creationStore, route)
  }

  function setVideoBatchTargetIds(storyboardIds: number[]) {
    creationStore.setStoryboardVideoBatchTargetStoryboardIds(storyboardIds)
    writeVideoBatchTargetIdsSession(creationStore, storyboardIds)
  }

  function clearVideoBatchTargetIds() {
    clearVideoBatchTargetIdsSession(creationStore)
    creationStore.clearStoryboardVideoBatchTargetStoryboardIds()
  }

  function stopVideoBatchGeneration() {
    clearVideoBatchTargetIdsSession(creationStore)
    creationStore.finalizeStoryboardVideoBatchGeneration()
  }

  function markPanelsGenerating(storyboardIds: number[]) {
    for (const sid of storyboardIds) {
      if (creationStore.storyboardPanelVideoGenStatusByStoryboardId[String(sid)] === 'generating') {
        continue
      }
      creationStore.setStoryboardPanelVideoGenStatus(sid, 'generating')
    }
  }

  function finishVideoBatchUi(_storyboardIds: number[]) {
    // SSE 已进入业务终态时，服务端任务生命周期是权威事实，不能再受列表是否就绪影响。
    // 使用 store 的原子收尾动作一次性清除 batch flag/taskId/targets/generating，避免多次
    // setter 之间的 watcher 把半完成状态重新持久化。failed 状态会被保留用于卡片错误展示。
    clearVideoBatchTargetIdsSession(creationStore)
    creationStore.finalizeStoryboardVideoBatchGeneration()
    invalidateProjectTaskListCache()
  }

  function abortVideoBatchUi(_storyboardIds: number[]) {
    // 明确失败/取消同样属于业务终态；仅导航、挂起等后台运行分支会走 keepLoading，
    // 因此这里必须无条件完成整个 batch 生命周期收尾。
    clearVideoBatchTargetIdsSession(creationStore)
    creationStore.stopStoryboardVideoBatchGeneration()
    invalidateProjectTaskListCache()
  }

  function clearPanelGeneratingStatuses(storyboardIds: number[]) {
    for (const sid of storyboardIds) {
      clearPanelGeneratingStatusIfIdle(sid)
    }
  }

  function clearPanelGeneratingStatusIfIdle(storyboardId: number) {
    const sid = Number(storyboardId)
    if (!Number.isFinite(sid) || sid <= 0) return
    const key = String(sid)
    if (creationStore.storyboardPanelVideoGenStatusByStoryboardId[key] === 'failed') return
    for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
      if (blob.storyboardVideoGenTasksByStoryboardId?.[key]) return
    }
    creationStore.clearStoryboardPanelVideoGenStatus(sid)
  }

  function applyImmediatePanelLoadingRestore(
    scriptPanels: StoryboardPanel[],
    videoPanels: StoryboardVideoPanel[],
    options?: { skipScopeHydrate?: boolean }
  ) {
    applyStoryboardVideoImmediatePanelLoadingRestore(
      creationStore,
      route,
      scriptPanels,
      videoPanels,
      options
    )
  }

  function resolveBatchTargetIdSet(explicitTargetIds?: number[]): Set<number> {
    const ids = (explicitTargetIds ?? getActiveBatchTargetIds())
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
    return new Set(ids)
  }

  function persistBatchTargetPanelErrors(
    pairs: StoryboardVideoPair[],
    message: string,
    explicitTargetIds?: number[]
  ) {
    const msg = String(message || '视频生成失败').trim() || '视频生成失败'
    const targets = resolveBatchTargetIdSet(explicitTargetIds)
    if (!targets.size) return
    for (const pair of pairs) {
      if (!targets.has(pair.storyboardId)) continue
      markStoryboardVideoPanelFailed(pair.storyboardId, msg)
    }
  }

  /** 将 store 内 generating 状态同步到 panels；有变化才返回新数组 */
  function syncPanelsGeneratingUi(
    scriptPanels: StoryboardPanel[],
    videoPanels: StoryboardVideoPanel[]
  ): StoryboardVideoPanel[] | null {
    const next = applyStoryboardVideoPanelUiFromStore(creationStore, scriptPanels, videoPanels)
    const changed = next.some((p, i) => {
      const prev = videoPanels[i]
      return p.generating !== prev?.generating || p.generateError !== prev?.generateError
    })
    return changed ? next : null
  }

  /** 列表未命中进行中任务时：生成态 / list 失败 / 卡片仍 generating 则沿用持久化 taskId */
  function resolvePersistedTaskIdWhenListMiss(
    listHitId: number | null,
    preferredId: unknown,
    taskListOk: boolean
  ): number | null {
    if (listHitId != null) return listHitId
    const pref = parseTaskId(preferredId)
    if (pref == null) return null
    const hasPanelGenerating = Object.values(
      creationStore.storyboardPanelVideoGenStatusByStoryboardId || {}
    ).some((s) => s === 'generating')
    if (
      shouldTrustPersistedTaskIdOnListMiss({
        taskListOk,
        isGenerating: Boolean(creationStore.isGeneratingStoryboardVideo),
        hasPanelGenerating
      })
    ) {
      return pref
    }
    return null
  }

  function keepVideoBatchLoadingForScope(
    scopeCtx: ReturnType<typeof captureCreationLiveGenScope>,
    taskIds?: { promptTaskId?: number | null; videoTaskId?: number | null }
  ) {
    const isCurrentScope = matchesCreationLiveGenScope(scopeCtx)
    creationStore.mergeStep4PlusLiveGenForScopeKey(
      scopeCtx.scopeKey,
      buildVideoBatchScopePreserveOnContextSwitch({
        promptTaskId:
          taskIds?.promptTaskId ??
          (isCurrentScope ? creationStore.storyboardVideoBatchActivePromptTaskId : undefined),
        videoTaskId:
          taskIds?.videoTaskId ??
          (isCurrentScope ? creationStore.storyboardVideoBatchActiveVideoTaskId : undefined)
      })
    )
    if (isCurrentScope && !creationStore.isGeneratingStoryboardVideo) {
      creationStore.setGeneratingStoryboardVideo(true)
    }
  }

  function isVideoBatchOperationInterrupted(
    scopeCtx: ReturnType<typeof captureCreationLiveGenScope>,
    generation: number
  ): boolean {
    return generation !== resumeFollowGeneration || !matchesCreationLiveGenScope(scopeCtx)
  }

  function applyPanelsGeneratingToLocal(
    videoPanels: StoryboardVideoPanel[],
    scriptPanels: StoryboardPanel[],
    generating: boolean
  ): StoryboardVideoPanel[] {
    return videoPanels.map((p, index) => {
      const sp = scriptPanels[index]
      const sid = sp ? parseServerStoryboardId(sp.id) : null
      const storeGenerating =
        sid != null &&
        creationStore.storyboardPanelVideoGenStatusByStoryboardId[String(sid)] === 'generating'
      const isBatchTarget = sid != null && creationStore.isStoryboardVideoBatchTarget(sid)
      const shouldGenerate = storeGenerating || (generating && isBatchTarget)
      return {
        ...p,
        generating: shouldGenerate,
        generateError: shouldGenerate ? undefined : p.generateError
      }
    })
  }

  /** restore 入参可能是 list 同步前的空快照；await 后必须重读 store */
  function readLatestScriptPanels(fallback: StoryboardPanel[] = []): StoryboardPanel[] {
    const fromStore = (creationStore.formData.storyboardScript.panels as StoryboardPanel[]) || []
    return fromStore.length ? fromStore : fallback
  }

  function readLatestVideoPanels(fallback: StoryboardVideoPanel[] = []): StoryboardVideoPanel[] {
    const fromStore =
      (creationStore.formData.storyboardVideo.panels as StoryboardVideoPanel[]) || []
    return fromStore.length ? fromStore : fallback
  }

  /** 禁止用空数组覆盖 list 已同步的分镜视频列表（刷新闪一下变空的根因） */
  function emitVideoPanelsUpdateSafe(
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void,
    next: StoryboardVideoPanel[],
    fallbackCurrent: StoryboardVideoPanel[] = []
  ) {
    if (!next.length) {
      const current = readLatestVideoPanels(fallbackCurrent)
      if (current.length > 0) return
    }
    onPanelsUpdate(next)
  }

  function applyBatchFailureToLocalPanels(
    videoPanels: StoryboardVideoPanel[],
    scriptPanels: StoryboardPanel[],
    targetStoryboardIds: number[],
    message?: string
  ): StoryboardVideoPanel[] {
    const targetSet = new Set(targetStoryboardIds)
    const errText = String(message || '视频生成失败').trim() || '视频生成失败'
    return videoPanels.map((p, index) => {
      const sp = scriptPanels[index]
      const sid = sp ? parseServerStoryboardId(sp.id) : null
      if (sid == null || !targetSet.has(sid)) {
        return { ...p, generating: false, generateError: undefined }
      }
      return {
        ...p,
        generating: false,
        generateError: errText,
        videos: []
      }
    })
  }

  function applySseProgress(p: {
    progress?: number
    stepIndex?: number
    stepTotal?: number
    message?: string
    stepTitle?: string
  }) {
    creationStore.applyStoryboardVideoBatchSseProgress(p)
  }

  async function seedProgressFromTaskDetail(taskId: number, fallbackTotal: number) {
    try {
      const detail = await userTaskDetailCached(taskId)
      if (!detail) return
      const totalShots = Number((detail as { totalShots?: number }).totalShots)
      const total = Number.isFinite(totalShots) && totalShots > 0 ? totalShots : fallbackTotal
      if (total > 0) {
        const cur = creationStore.storyboardVideoBatchProgress
        if (!cur.total || cur.total < total) {
          creationStore.setStoryboardVideoBatchProgress(Math.min(cur.completed, total), total)
        }
      }
    } catch {
      /* ignore */
    }
  }

  async function loadVideosForStoryboardPanel(
    storyboardId: number,
    panelTitle: string,
    videoByStoryboardId?: Map<number, StoryboardRecordRow[]>
  ): Promise<NonNullable<StoryboardVideoPanel['videos']>> {
    if (videoByStoryboardId) {
      return buildPanelVideosFromRows(videoByStoryboardId.get(storyboardId) ?? [], panelTitle)
    }
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return []
    const rows = await fetchStoryboardRecordsForStoryboard(ctx, storyboardId, 'video')
    return buildPanelVideosFromRows(rows, panelTitle)
  }

  async function refreshPanelsVideosForPairs(
    pairs: StoryboardVideoPair[],
    working: StoryboardVideoPanel[],
    options?: { onlyUpToStepIndex?: number; batchTargetIds?: number[] }
  ): Promise<StoryboardVideoPanel[]> {
    const next = [...working]
    const limit = options?.onlyUpToStepIndex
    const targets = resolveBatchTargetIdSet(options?.batchTargetIds)
    if (!targets.size) return next
    /** 项目级 record 列表只拉一次，循环内按分镜分组回填，避免逐镜逐次请求 */
    let videoByStoryboardId: Map<number, StoryboardRecordRow[]> | undefined
    try {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (ctx) {
        videoByStoryboardId = groupStoryboardRecordsByStoryboardId(
          await fetchProjectStoryboardRecords(ctx, 'video')
        )
      }
    } catch {
      /* 预取失败退回逐镜路径 */
    }
    for (const pair of pairs) {
      if (!targets.has(pair.storyboardId)) continue
      if (limit != null && pair.index >= limit) continue
      const panelTitle = pair.video?.title || pair.script.title || `分镜视频${pair.index + 1}`
      try {
        // 进度阶段：仅回填已产出的视频，不因暂时无文件误标失败（失败留给终态处理）
        if (panelHasPersistedVideoFailure(creationStore, pair.storyboardId)) {
          continue
        }
        const videos = await loadVideosForStoryboardPanel(
          pair.storyboardId,
          panelTitle,
          videoByStoryboardId
        )
        if (videos.length) {
          next[pair.index] = {
            ...next[pair.index]!,
            generating: true,
            generateError: undefined,
            videos
          }
        }
      } catch {
        /* 单镜刷新失败不阻断 */
      }
    }
    return next
  }

  /** 用 SSE complete / partial_failed 的 items 立刻回填成功镜头，避免等列表刷新 */
  function syncScriptFinalVideoFromTerminalItems(items: TaskVideoBatchSuccessItem[]) {
    if (!items.length) return
    const scripts = [
      ...((creationStore.formData.storyboardScript.panels as StoryboardPanel[]) || [])
    ]
    let changed = false
    for (const item of items) {
      const sid = Number(item.storyboardId)
      const url = String(item.videoUrl ?? '').trim()
      const rid = Number(item.recordId)
      if (!Number.isFinite(sid) || sid <= 0 || !url) continue
      const idx = scripts.findIndex((p) => parseServerStoryboardId(p.id) === sid)
      if (idx < 0) continue
      const cur = scripts[idx]!
      const sameUrl = String(cur.finalVideoUrl ?? '').trim() === url
      const sameId =
        cur.finalVideoId != null && Number(cur.finalVideoId) > 0 && Number(cur.finalVideoId) === rid
      if (sameUrl && sameId) continue
      scripts[idx] = {
        ...cur,
        finalVideoUrl: url,
        ...(Number.isFinite(rid) && rid > 0 ? { finalVideoId: rid } : {})
      }
      changed = true
    }
    if (changed) {
      creationStore.formData.storyboardScript.panels = scripts
    }
  }

  function applyVideoBatchTerminalItemsToPanels(
    working: StoryboardVideoPanel[],
    pairs: StoryboardVideoPair[],
    items: TaskVideoBatchSuccessItem[]
  ): StoryboardVideoPanel[] {
    if (!items.length) return working
    syncScriptFinalVideoFromTerminalItems(items)
    const next = [...working]
    const bySid = new Map(items.map((it) => [it.storyboardId, it]))
    for (const pair of pairs) {
      const hit = bySid.get(pair.storyboardId)
      if (!hit) continue
      const panelTitle = pair.video?.title || pair.script.title || `分镜视频${pair.index + 1}`
      const videoItem = {
        id: String(hit.recordId),
        url: hit.videoUrl,
        title: panelTitle,
        source: '生成记录',
        isStoryboardVideo: true,
        _fromServer: true as const,
        _serverRow: {
          id: hit.recordId,
          storyboardId: hit.storyboardId,
          fileUrl: hit.videoUrl,
          isSelected: 1,
          genType: 'i2v'
        } as StoryboardRecordRow
      }
      next[pair.index] = {
        ...next[pair.index]!,
        generating: false,
        generateError: undefined,
        finalVideoUrl: hit.videoUrl,
        videos: [videoItem]
      }
      markStoryboardVideoPanelSucceeded(pair.storyboardId)
    }
    return next
  }

  async function setFinalVideosFromTerminalItems(
    ctx: ProjectEpisodeContext,
    items: TaskVideoBatchSuccessItem[]
  ): Promise<void> {
    if (!items.length) return
    const SET_FINAL_BATCH_MAX = 50
    for (let i = 0; i < items.length; i += SET_FINAL_BATCH_MAX) {
      const chunk = items.slice(i, i + SET_FINAL_BATCH_MAX).map((it) => ({
        storyboardId: it.storyboardId,
        recordId: it.recordId
      }))
      try {
        await userStoryboardSetFinalVideo({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          items: chunk
        })
      } catch {
        /* 设主失败不阻断 UI 展示，列表仍保留 SSE 视频 */
      }
    }
    clearProjectStoryboardRecordCache(ctx)
  }

  async function refreshPanelsAfterVideoBatch(
    pairs: StoryboardVideoPair[],
    working: StoryboardVideoPanel[],
    failedStoryboardIds?: Set<number>,
    batchTargetIds?: number[]
  ): Promise<StoryboardVideoPanel[]> {
    const next = [...working]
    const targets = resolveBatchTargetIdSet(batchTargetIds)
    if (!targets.size) return next
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)

    for (const pair of pairs) {
      if (!targets.has(pair.storyboardId)) continue
      if (failedStoryboardIds?.has(pair.storyboardId)) {
        const message = '视频生成失败'
        next[pair.index] = {
          ...next[pair.index]!,
          generating: false,
          generateError: message,
          videos: []
        }
        markStoryboardVideoPanelFailed(pair.storyboardId, message)
      }
    }

    const successIds = pairs
      .map((p) => p.storyboardId)
      .filter((sid) => targets.has(sid) && !failedStoryboardIds?.has(sid))

    let videoByStoryboardId = new Map<number, StoryboardRecordRow[]>()
    if (ctx && successIds.length) {
      try {
        const outcome = await setFinalVideosForStoryboards(ctx, successIds)
        videoByStoryboardId = outcome.videoByStoryboardId
        for (const [sid, ok] of outcome.results) {
          if (ok) markStoryboardVideoPanelSucceeded(sid)
          else markStoryboardVideoPanelFailed(sid, '设置主视频失败')
        }
      } catch (e: unknown) {
        const message = bizErr(e) || '设置主视频失败'
        for (const sid of successIds) {
          markStoryboardVideoPanelFailed(sid, message)
        }
        return next.map((p, i) => {
          const pair = pairs[i]
          if (!pair || failedStoryboardIds?.has(pair.storyboardId)) return p
          return {
            ...p,
            generating: false,
            generateError: message,
            videos: p.videos ?? []
          }
        })
      }
    }

    for (const pair of pairs) {
      if (!targets.has(pair.storyboardId)) continue
      if (failedStoryboardIds?.has(pair.storyboardId)) continue
      const panelTitle = pair.video?.title || pair.script.title || `分镜视频${pair.index + 1}`
      const key = String(pair.storyboardId)
      const wasBatchGenerating =
        creationStore.storyboardPanelVideoGenStatusByStoryboardId[key] === 'generating' ||
        creationStore.storyboardPanelVideoGenStatusByStoryboardId[key] === 'failed' ||
        targets.has(pair.storyboardId)
      const videos = buildPanelVideosFromRows(
        videoByStoryboardId.get(pair.storyboardId) ?? [],
        panelTitle
      )
      // 本地已有成功视频（如 SSE items 已回填）时优先保留，避免被空列表盖成失败
      const localVideos = next[pair.index]?.videos
      const hasLocalSuccess =
        Array.isArray(localVideos) &&
        localVideos.some((v) => v.isStoryboardVideo && String(v.url ?? '').trim())
      const mainUrl =
        videos.find((v) => v.isStoryboardVideo && String(v.url ?? '').trim())?.url ||
        videos.find((v) => String(v.url ?? '').trim())?.url ||
        ''
      if (videos.length && wasBatchGenerating) {
        next[pair.index] = {
          ...next[pair.index]!,
          generating: false,
          generateError: undefined,
          ...(mainUrl ? { finalVideoUrl: String(mainUrl) } : {}),
          videos
        }
        markStoryboardVideoPanelSucceeded(pair.storyboardId)
      } else if (videos.length) {
        next[pair.index] = {
          ...next[pair.index]!,
          generating: false,
          generateError: undefined,
          ...(mainUrl ? { finalVideoUrl: String(mainUrl) } : {}),
          videos
        }
        markStoryboardVideoPanelSucceeded(pair.storyboardId)
      } else if (hasLocalSuccess) {
        next[pair.index] = {
          ...next[pair.index]!,
          generating: false,
          generateError: undefined
        }
        markStoryboardVideoPanelSucceeded(pair.storyboardId)
      } else if (panelHasPersistedVideoFailure(creationStore, pair.storyboardId)) {
        const err =
          String(
            creationStore.storyboardPanelVideoGenErrorByStoryboardId[String(pair.storyboardId)] ??
              ''
          ).trim() || '视频生成失败'
        next[pair.index] = {
          ...next[pair.index]!,
          generating: false,
          generateError: err,
          videos: []
        }
      } else {
        const message = '视频生成完成，但未获取到视频文件'
        next[pair.index] = {
          ...next[pair.index]!,
          generating: false,
          generateError: message,
          videos: []
        }
        markStoryboardVideoPanelFailed(pair.storyboardId, message)
      }
    }

    return next
  }

  async function trackPromptTaskUntilDone(
    taskId: number,
    stream: ReturnType<typeof useTaskStream>
  ): Promise<{
    ok: boolean
    partial?: boolean
    message?: string
    taskId?: number
    chainChildTaskIds?: number[]
  }> {
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
        const errMsg = res.errorMessage || '视频提示词生成失败'
        if (isNavigationOrSuspendBatchMessage(errMsg)) {
          return {
            ok: false,
            message: '任务仍在后台执行，请稍候或刷新页面自动恢复进度'
          }
        }
        return { ok: false, message: errMsg }
      }
      if (res.type === 'partial_failed') {
        return {
          ok: false,
          partial: true,
          taskId,
          message: '部分视频提示词生成失败，可续生',
          chainChildTaskIds: extractChainChildTaskIds(res.data)
        }
      }
      return { ok: true, taskId, chainChildTaskIds: extractChainChildTaskIds(res.data) }
    } catch {
      if (stopRequested) {
        return { ok: false, message: '已停止生成' }
      }
      if (streamGen !== resumeFollowGeneration) {
        return {
          ok: false,
          message: '任务仍在后台执行，请稍候或刷新页面自动恢复进度'
        }
      }
      const resolved = await resolveUserTaskTerminalOutcome(taskId)
      if (resolved.kind === 'succeeded') {
        return {
          ok: true,
          taskId,
          chainChildTaskIds: extractChainChildTaskIdsFromTaskDetail(resolved.detail)
        }
      }
      if (resolved.kind === 'partial_failed') {
        return {
          ok: false,
          partial: true,
          taskId,
          message: '部分视频提示词生成失败，可续生',
          chainChildTaskIds: extractChainChildTaskIdsFromTaskDetail(resolved.detail)
        }
      }
      if (resolved.kind === 'cancelled') {
        return { ok: false, message: resolved.message || '任务已取消' }
      }
      if (resolved.kind === 'failed') {
        return { ok: false, message: resolved.errorMessage || '视频提示词生成失败' }
      }
      // ongoing / 未知：切步断流保活，禁止「连接中断请稍后重试」
      return {
        ok: false,
        message: '任务仍在后台执行，请稍候或刷新页面自动恢复进度'
      }
    } finally {
      closePromptStream()
    }
  }

  async function resolveChainChildTaskIdsForPromptTask(
    taskId: number,
    seed?: number[]
  ): Promise<number[]> {
    if (seed?.length) return [...new Set(seed)]
    const fromDetail = extractChainChildTaskIdsFromTaskDetail(await fetchUserTaskDetailOnce(taskId))
    if (fromDetail.length) return fromDetail
    try {
      const stream = useTaskStream(taskId)
      const raced = await Promise.race([
        stream.done.then((res) => ({ kind: 'sse' as const, res })),
        new Promise<{ kind: 'timeout' }>((resolve) =>
          setTimeout(() => resolve({ kind: 'timeout' }), 10000)
        )
      ])
      try {
        stream.close()
      } catch {
        /* ignore */
      }
      if (
        raced.kind === 'sse' &&
        (raced.res.type === 'complete' || raced.res.type === 'partial_failed')
      ) {
        return extractChainChildTaskIds(raced.res.data)
      }
    } catch {
      /* ignore */
    }
    return []
  }

  async function followPromptTaskOwned(
    taskId: number,
    storyboardIds: number[],
    options?: { progressTotalHint?: number }
  ): Promise<StoryboardVideoPromptFollowResult> {
    stopRequested = false
    const routeCtx = captureCreationLiveGenScope()
    beginBatchSseFollow()
    syncActivePromptTaskIdToStore(taskId)
    creationStore.setGeneratingStoryboardVideo(true)
    creationStore.setStoryboardVideoBatchError(null)
    try {
      const progressTotal = Math.max(
        options?.progressTotalHint ?? 0,
        creationStore.storyboardVideoBatchProgress.total || 0,
        storyboardIds.length,
        1
      )
      if (!creationStore.storyboardVideoBatchProgress.total) {
        creationStore.setStoryboardVideoBatchProgress(0, progressTotal)
      }
      await seedProgressFromTaskDetail(taskId, progressTotal)

      let outcome: {
        ok: boolean
        partial?: boolean
        message?: string
        taskId?: number
        chainChildTaskIds?: number[]
      }
      const resolved = await resolveUserTaskTerminalOutcome(taskId)
      if (resolved.kind === 'succeeded') {
        outcome = {
          ok: true,
          taskId,
          chainChildTaskIds: await resolveChainChildTaskIdsForPromptTask(taskId)
        }
      } else if (resolved.kind === 'partial_failed') {
        outcome = {
          ok: false,
          partial: true,
          taskId,
          message: '部分视频提示词生成失败，可续生',
          chainChildTaskIds: await resolveChainChildTaskIdsForPromptTask(taskId)
        }
      } else if (resolved.kind === 'cancelled') {
        outcome = { ok: false, message: resolved.message || '任务已取消' }
      } else if (resolved.kind === 'failed') {
        outcome = {
          ok: false,
          message: resolved.errorMessage || '视频提示词生成失败'
        }
      } else {
        const stream = useTaskStream(taskId)
        promptStreamCloser = () => {
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

      /** 已切集：只保活原 scope，禁止清空 loading/taskId */
      if (!matchesCreationLiveGenScope(routeCtx)) {
        creationStore.mergeStep4PlusLiveGenForScopeKey(
          routeCtx.scopeKey,
          buildVideoBatchScopePreserveOnContextSwitch({
            promptTaskId: taskId,
            videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
          })
        )
        return { ok: false, message: '已切换作品，任务仍在后台进行' }
      }

      if (!outcome.partial) {
        syncActivePromptTaskIdToStore(null)
      }

      return outcome
    } finally {
      endBatchSseFollow()
    }
  }

  async function followPromptTask(
    taskId: number,
    storyboardIds: number[],
    options?: { progressTotalHint?: number }
  ): Promise<StoryboardVideoPromptFollowResult> {
    while (promptFollowOwner) {
      if (promptFollowOwner.taskId === taskId) return promptFollowOwner.promise
      try {
        await promptFollowOwner.promise
      } catch {
        /* 前一提示词任务释放后再接管下一任务。 */
      }
    }

    const promise = followPromptTaskOwned(taskId, storyboardIds, options)
    const owner = { taskId, promise }
    promptFollowOwner = owner
    try {
      return await promise
    } finally {
      if (promptFollowOwner === owner) promptFollowOwner = null
      followIdleBarrier.notifyStateChange()
    }
  }

  async function submitSingleVideoPrompt(storyboardId: number): Promise<{
    ok: boolean
    message?: string
    taskId?: number
  }> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
    }

    let submitted: Awaited<ReturnType<typeof userStoryboardGenerateVideoPromptImage>>
    try {
      submitted = await userStoryboardGenerateVideoPromptImage({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardIds: [storyboardId],
        ...(await buildVideoPromptSubmitFields(ctx.projectId))
      })
    } catch (e: unknown) {
      return { ok: false, message: bizErr(e) }
    }

    const taskId = parseTaskId(submitted.taskId)
    if (!taskId) {
      return { ok: false, message: '提交失败：未返回任务ID' }
    }

    if (import.meta.client && !creationStore.isGeneratingStoryboardVideo) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
    return { ok: true, taskId }
  }

  async function submitVideoWithPromptBatch(options: {
    storyboardIds?: number[]
    overwrite?: boolean
    genDurationSeconds?: number | null
    expectedScope?: ReturnType<typeof captureCreationLiveGenScope>
    expectedGeneration?: number
  }): Promise<{ ok: boolean; taskId?: number; message?: string; totalShots?: number }> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
    }
    if (
      options.expectedScope &&
      isVideoBatchOperationInterrupted(
        options.expectedScope,
        options.expectedGeneration ?? resumeFollowGeneration
      )
    ) {
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    try {
      const submitted = await userStoryboardGenerateVideoWithPrompt({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        ...(options.storyboardIds?.length ? { storyboardIds: options.storyboardIds } : {}),
        ...(options.overwrite != null ? { overwrite: options.overwrite } : {}),
        ...buildVideoWithPromptPromptOverrideFields(),
        ...buildVideoGenSubmitFields({ genDurationSeconds: options.genDurationSeconds })
      })
      const taskId = parseTaskId(submitted.taskId)
      if (!taskId) {
        return { ok: false, message: '提交失败：未返回任务ID' }
      }
      if (import.meta.client && !creationStore.isGeneratingStoryboardVideo) {
        window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
      }
      return {
        ok: true,
        taskId,
        totalShots:
          Number(submitted.totalShots) > 0
            ? Number(submitted.totalShots)
            : (options.storyboardIds?.length ?? 0)
      }
    } catch (e: unknown) {
      return { ok: false, message: bizErr(e) }
    }
  }

  async function followVideoGenerateAfterPrompt(
    pairs: StoryboardVideoPair[],
    onPanelsUpdate?: (panels: StoryboardVideoPanel[]) => void,
    workingPanels?: StoryboardVideoPanel[],
    chainChildTaskIds?: number[]
  ): Promise<{
    ok: boolean
    partial?: boolean
    taskId?: number
    message?: string
    failedStoryboardIds?: Set<number>
  }> {
    const scopeAtEntry = captureCreationLiveGenScope()
    const generationAtEntry = resumeFollowGeneration
    const preferredVideoTaskIdAtEntry = creationStore.storyboardVideoBatchActiveVideoTaskId
    const storyboardIds = pairs.map((p) => p.storyboardId)
    if (!storyboardIds.length) {
      return { ok: false, message: '分镜尚未保存到服务器，请先生成分镜脚本' }
    }

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息' }
    }
    if (isVideoBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
      keepVideoBatchLoadingForScope(scopeAtEntry)
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    if (stopRequested) {
      return { ok: false, message: '已停止生成' }
    }

    setVideoBatchTargetIds(storyboardIds)
    markPanelsGenerating(storyboardIds)

    const preferredChildIds = [
      ...new Set(
        (chainChildTaskIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    ]

    const working = workingPanels
      ? [...workingPanels]
      : applyPanelsGeneratingToLocal(
          (creationStore.formData.storyboardVideo.panels as StoryboardVideoPanel[]) || [],
          pairs.map((p) => p.script),
          true
        )
    onPanelsUpdate?.(working)

    if (preferredChildIds.length) {
      let lastTaskId: number | undefined
      let anyPartial = false
      for (const childId of preferredChildIds) {
        if (stopRequested) {
          return { ok: false, message: '已停止生成', taskId: lastTaskId }
        }
        const outcome = await followOngoingVideoGenerateTask(
          childId,
          pairs,
          onPanelsUpdate ?? (() => {}),
          working
        )
        if (isVideoBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
          keepVideoBatchLoadingForScope(scopeAtEntry, { videoTaskId: childId })
          return { ok: false, message: '已切换作品，任务仍在后台进行', taskId: childId }
        }
        lastTaskId = childId
        if (!outcome.ok) {
          return { ok: false, message: outcome.message, taskId: childId }
        }
        if (outcome.partial) anyPartial = true
      }
      return { ok: true, taskId: lastTaskId, ...(anyPartial ? { partial: true } : {}) }
    }

    let ongoingVideoId = await resolveOngoingVideoGenerateTaskId(ctx, preferredVideoTaskIdAtEntry)
    if (ongoingVideoId == null) {
      for (let attempt = 0; attempt < 4 && ongoingVideoId == null; attempt++) {
        if (attempt > 0) await sleep(800)
        if (isVideoBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
          keepVideoBatchLoadingForScope(scopeAtEntry)
          return { ok: false, message: '已切换作品，任务仍在后台进行' }
        }
        ongoingVideoId = await resolveOngoingVideoGenerateTaskId(ctx, preferredVideoTaskIdAtEntry)
      }
    }

    if (isVideoBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
      // 切换后的 task/list 结果不反写旧 scope；切回后由该 scope 自己重新发现。
      keepVideoBatchLoadingForScope(scopeAtEntry)
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    if (ongoingVideoId != null) {
      const outcome = await followOngoingVideoGenerateTask(
        ongoingVideoId,
        pairs,
        onPanelsUpdate ?? (() => {}),
        working
      )
      if (isVideoBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
        keepVideoBatchLoadingForScope(scopeAtEntry, { videoTaskId: ongoingVideoId })
        return { ok: false, message: '已切换作品，任务仍在后台进行' }
      }
      return outcome.ok
        ? {
            ok: true,
            taskId: ongoingVideoId,
            ...(outcome.partial ? { partial: true } : {})
          }
        : { ok: false, message: outcome.message }
    }

    // 刷新/切页竞态：提示词已完但出片任务尚未进 list，保活等待 restore 重试
    return { ok: false, message: '视频出片任务未就绪，请稍后重试' }
  }

  async function runBatchVideoPrompt(overwrite: boolean): Promise<{
    ok: boolean
    partial?: boolean
    taskId?: number
    message?: string
    chainChildTaskIds?: number[]
  }> {
    stopRequested = false
    const scopeAtEntry = captureCreationLiveGenScope()
    const generationAtEntry = resumeFollowGeneration
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
    }
    if (isVideoBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    const submitOutcome = await submitVideoWithPromptBatch({
      overwrite,
      expectedScope: scopeAtEntry,
      expectedGeneration: generationAtEntry
    })
    if (isVideoBatchOperationInterrupted(scopeAtEntry, generationAtEntry)) {
      if (submitOutcome.taskId) {
        keepVideoBatchLoadingForScope(scopeAtEntry, { promptTaskId: submitOutcome.taskId })
      }
      return {
        ok: false,
        taskId: submitOutcome.taskId,
        message: '已切换作品，任务仍在后台进行'
      }
    }
    if (!submitOutcome.ok || !submitOutcome.taskId) {
      return { ok: false, message: submitOutcome.message || '视频提示词生成失败' }
    }

    const storyboardIds = (creationStore.formData.storyboardScript.panels as StoryboardPanel[])
      .map((p) => parseServerStoryboardId(p.id))
      .filter((id): id is number => id != null)

    const progressTotal =
      Number(submitOutcome.totalShots) > 0 ? Number(submitOutcome.totalShots) : storyboardIds.length

    let outcome = await followPromptTask(submitOutcome.taskId, storyboardIds, {
      progressTotalHint: progressTotal
    })

    if (stopRequested) {
      return { ok: false, message: '已停止生成' }
    }

    if (!outcome.ok) {
      if (outcome.partial && outcome.taskId) {
        const partialWarning = outcome.message || '部分视频提示词生成失败'
        const shouldResume = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '部分视频提示词生成失败',
            content: partialWarning,
            okText: '续生',
            cancelText: '跳过',
            onOk: () => resolve(true),
            onCancel: () => resolve(false)
          })
        })
        if (shouldResume) {
          const resumeOutcome = await resumeStoryboardPromptGenerateTask(outcome.taskId, 'video')
          if (resumeOutcome.ok === false) {
            creationStore.setStoryboardVideoBatchError(resumeOutcome.errorMessage)
            return { ok: false, message: resumeOutcome.errorMessage }
          }
          outcome = await followPromptTask(outcome.taskId, storyboardIds, {
            progressTotalHint: progressTotal
          })
        } else {
          syncActivePromptTaskIdToStore(outcome.taskId)
          return {
            ok: true,
            partial: true,
            taskId: outcome.taskId,
            message: partialWarning,
            chainChildTaskIds: outcome.chainChildTaskIds
          }
        }
      } else {
        return { ok: false, message: outcome.message || '视频提示词生成失败' }
      }
    }

    return {
      ok: true,
      taskId: submitOutcome.taskId,
      chainChildTaskIds: outcome.chainChildTaskIds
    }
  }

  /** @deprecated 合并接口后由后端自动触发出片，批量流程请改用 followVideoGenerateAfterPrompt */
  async function generateVideosBatch(
    pairs: StoryboardVideoPair[],
    onPanelsUpdate?: (panels: StoryboardVideoPanel[]) => void,
    workingPanels?: StoryboardVideoPanel[]
  ): Promise<{
    ok: boolean
    partial?: boolean
    taskId?: number
    message?: string
    failedStoryboardIds?: Set<number>
  }> {
    const storyboardIds = pairs.map((p) => p.storyboardId)
    if (!storyboardIds.length) {
      return { ok: false, message: '分镜尚未保存到服务器，请先生成分镜脚本' }
    }

    const routeCtx = captureCreationLiveGenScope()
    const videoTotal = storyboardIds.length
    setVideoBatchTargetIds(storyboardIds)
    creationStore.setStoryboardVideoBatchProgress(0, videoTotal)
    markPanelsGenerating(storyboardIds)

    let lastRefreshStepIndex = -1
    let working = workingPanels ? [...workingPanels] : null

    beginBatchSseFollow()
    try {
      const body = buildImageVideoGenerateBody(storyboardIds)
      let result = await runStoryboardImageVideoGenerateTask({
        body,
        onSubmitted: ({ taskId }) => {
          syncActiveVideoTaskIdToStore(taskId)
        },
        onProgress: (p) => {
          if (!matchesCreationLiveGenScope(routeCtx)) return
          applySseProgress({
            progress: p.percent,
            stepIndex: (p as { stepIndex?: number }).stepIndex,
            stepTotal: videoTotal,
            message: p.message,
            stepTitle: p.stepTitle
          })
          const stepIndex =
            typeof (p as { stepIndex?: number }).stepIndex === 'number'
              ? Number((p as { stepIndex?: number }).stepIndex)
              : null
          if (stepIndex != null && stepIndex > lastRefreshStepIndex) {
            lastRefreshStepIndex = stepIndex
            if (working && onPanelsUpdate) {
              void refreshPanelsVideosForPairs(pairs, working, {
                onlyUpToStepIndex: stepIndex,
                batchTargetIds: storyboardIds
              }).then((next) => {
                if (!matchesCreationLiveGenScope(routeCtx) || !working) return
                working = next
                onPanelsUpdate(next)
              })
            }
          }
        }
      })

      syncActiveVideoTaskIdToStore(null)

      if (!result.ok) {
        clearPanelGeneratingStatuses(storyboardIds)
        return {
          ok: false,
          message: 'errorMessage' in result ? result.errorMessage : '视频生成失败'
        }
      }

      const taskId = result.taskId
      const detail = await fetchUserTaskDetailOnce(taskId)
      const status = normalizeTaskStatus(detail?.status ?? '')
      if (isStoryboardVideoGenerateResumableStatus(status)) {
        const shouldResume = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '部分分镜视频生成失败',
            content: String(detail?.errorMessage || '部分镜头出片失败，是否续生？'),
            okText: '续生',
            cancelText: '跳过',
            onOk: () => resolve(true),
            onCancel: () => resolve(false)
          })
        })
        if (shouldResume) {
          syncActiveVideoTaskIdToStore(taskId)
          result = await resumeStoryboardVideoGenerateTask({
            taskId,
            onProgress: (p) => {
              if (!matchesCreationLiveGenScope(routeCtx)) return
              applySseProgress({
                progress: p.percent,
                stepTotal: videoTotal,
                message: p.message,
                stepTitle: p.stepTitle
              })
            }
          })
          syncActiveVideoTaskIdToStore(null)
          if (!result.ok) {
            clearPanelGeneratingStatuses(storyboardIds)
            return {
              ok: false,
              message: 'errorMessage' in result ? result.errorMessage : '续生失败'
            }
          }
        } else {
          return { ok: true, partial: true, taskId, message: '部分分镜视频生成失败' }
        }
      }

      creationStore.setStoryboardVideoBatchProgress(videoTotal, videoTotal)
      return { ok: true, taskId }
    } finally {
      endBatchSseFollow()
    }
  }

  async function runFullAutoGenerate(payload: {
    scriptPanels: StoryboardPanel[]
    videoPanels: StoryboardVideoPanel[]
    overwritePrompt: boolean
    manualPromptAgentModelPick?: boolean
    manualVideoModelPick?: boolean
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void
  }): Promise<{ ok: boolean; message?: string }> {
    setManualPromptAgentModelPick(payload.manualPromptAgentModelPick === true)
    setManualVideoModelPick(payload.manualVideoModelPick === true)
    stopRequested = false
    const routeCtx = captureCreationLiveGenScope()

    const pairs = collectPairs(payload.scriptPanels, payload.videoPanels)
    if (!pairs.length) {
      return { ok: false, message: '分镜尚未保存到服务器，请先生成分镜脚本' }
    }

    const storyboardIds = pairs.map((p) => p.storyboardId)
    creationStore.setGeneratingStoryboardVideo(true)
    creationStore.setStoryboardVideoBatchError(null)
    creationStore.setStoryboardVideoBatchProgress(0, storyboardIds.length)

    let working = payload.videoPanels.map((p) => ({ ...p }))

    const promptOutcome = await runBatchVideoPrompt(payload.overwritePrompt)
    if (!matchesCreationLiveGenScope(routeCtx)) {
      keepVideoBatchLoadingForScope(routeCtx)
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }
    if (stopRequested) {
      working = working.map((p) => ({ ...p, generating: false }))
      payload.onPanelsUpdate(working)
      clearPanelGeneratingStatuses(storyboardIds)
      stopVideoBatchGeneration()
      return { ok: false, message: '已停止生成' }
    }
    if (!promptOutcome.ok) {
      if (shouldKeepVideoBatchLoadingAfterFollowMessage(promptOutcome.message)) {
        keepVideoBatchLoadingForScope(routeCtx, {
          promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
          videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
        })
        return { ok: false, message: promptOutcome.message }
      }
      working = applyBatchFailureToLocalPanels(
        working,
        payload.scriptPanels,
        storyboardIds,
        promptOutcome.message || '视频提示词生成失败'
      )
      persistBatchTargetPanelErrors(
        pairs,
        promptOutcome.message || '视频提示词生成失败',
        storyboardIds
      )
      payload.onPanelsUpdate(working)
      creationStore.setStoryboardVideoBatchError(promptOutcome.message || null)
      abortVideoBatchUi(storyboardIds)
      return { ok: false, message: promptOutcome.message || '视频提示词生成失败' }
    }

    if (stopRequested) {
      working = working.map((p) => ({ ...p, generating: false }))
      payload.onPanelsUpdate(working)
      clearPanelGeneratingStatuses(storyboardIds)
      stopVideoBatchGeneration()
      return { ok: false, message: '已停止生成' }
    }
    if (!matchesCreationLiveGenScope(routeCtx)) {
      keepVideoBatchLoadingForScope(routeCtx)
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    const videoOutcome = await followVideoGenerateAfterPrompt(
      pairs,
      payload.onPanelsUpdate,
      working,
      promptOutcome.chainChildTaskIds
    )
    if (!matchesCreationLiveGenScope(routeCtx)) {
      keepVideoBatchLoadingForScope(routeCtx)
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    if (!videoOutcome.ok) {
      if (shouldKeepVideoBatchLoadingAfterFollowMessage(videoOutcome.message)) {
        keepVideoBatchLoadingForScope(routeCtx, {
          promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
          videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
        })
        return { ok: false, message: videoOutcome.message }
      }
      working = applyBatchFailureToLocalPanels(
        working,
        payload.scriptPanels,
        storyboardIds,
        videoOutcome.message || '视频生成失败'
      )
      persistBatchTargetPanelErrors(pairs, videoOutcome.message || '视频生成失败', storyboardIds)
      payload.onPanelsUpdate(working)
      creationStore.setStoryboardVideoBatchError(videoOutcome.message || null)
      abortVideoBatchUi(storyboardIds)
      return { ok: false, message: videoOutcome.message || '视频生成失败' }
    }

    // 列表已在 followOngoingVideoGenerateTask 内用 SSE items / refresh 更新
    finishVideoBatchUi(storyboardIds)

    if (stopRequested) {
      return { ok: false, message: '已停止生成' }
    }
    if (videoOutcome.partial) {
      return { ok: false, message: '部分分镜视频生成失败，可点击重新生成重试' }
    }
    return { ok: true }
  }

  async function regenerateSinglePanel(payload: {
    scriptPanel: StoryboardPanel
    videoPanel: StoryboardVideoPanel
    panelIndex: number
    videoPanels: StoryboardVideoPanel[]
    manualVideoModelPick?: boolean
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void
  }): Promise<{ ok: boolean; message?: string }> {
    const storyboardId = parseServerStoryboardId(payload.scriptPanel.id)
    if (storyboardId == null) {
      return { ok: false, message: '分镜尚未保存到服务器' }
    }

    const scriptPanels = (creationStore.formData.storyboardScript.panels as StoryboardPanel[]) || []

    // 与列表批量生成一致：POST /api/user/storyboard/generate/video-with-prompt + SSE 跟进
    return runBatchVideosOnly({
      scriptPanels,
      videoPanels: payload.videoPanels,
      manualVideoModelPick: payload.manualVideoModelPick,
      selectedStoryboardIds: [storyboardId],
      onPanelsUpdate: payload.onPanelsUpdate
    })
  }

  async function runBatchVideosOnly(payload: {
    scriptPanels: StoryboardPanel[]
    videoPanels: StoryboardVideoPanel[]
    manualVideoModelPick?: boolean
    selectedStoryboardIds?: number[]
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void
  }): Promise<{ ok: boolean; message?: string }> {
    setManualVideoModelPick(payload.manualVideoModelPick === true)
    stopRequested = false
    const routeCtx = captureCreationLiveGenScope()
    const generationAtEntry = resumeFollowGeneration
    beginBatchSseFollow()
    try {
      let pairs = collectPairs(payload.scriptPanels, payload.videoPanels)
      if (payload.selectedStoryboardIds?.length) {
        const selectedSet = new Set(payload.selectedStoryboardIds)
        pairs = pairs.filter((p) => selectedSet.has(p.storyboardId))
      }
      if (!pairs.length) {
        return { ok: false, message: '请选择要生成的分镜' }
      }

      const storyboardIds = pairs.map((p) => p.storyboardId)
      setVideoBatchTargetIds(storyboardIds)
      creationStore.setGeneratingStoryboardVideo(true)
      creationStore.setStoryboardVideoBatchError(null)
      creationStore.setStoryboardVideoBatchProgress(0, storyboardIds.length)
      markPanelsGenerating(storyboardIds)

      let working = applyPanelsGeneratingToLocal(payload.videoPanels, payload.scriptPanels, true)
      payload.onPanelsUpdate(working)

      if (isVideoBatchOperationInterrupted(routeCtx, generationAtEntry)) {
        keepVideoBatchLoadingForScope(routeCtx)
        return { ok: false, message: '已切换作品，任务仍在后台进行' }
      }
      if (stopRequested) {
        working = working.map((p) => ({ ...p, generating: false }))
        payload.onPanelsUpdate(working)
        clearPanelGeneratingStatuses(storyboardIds)
        clearVideoBatchTargetIds()
        creationStore.setGeneratingStoryboardVideo(false)
        return { ok: false, message: '已停止生成' }
      }

      const submitOutcome = await submitVideoWithPromptBatch({
        storyboardIds,
        expectedScope: routeCtx,
        expectedGeneration: generationAtEntry
      })
      if (isVideoBatchOperationInterrupted(routeCtx, generationAtEntry)) {
        if (submitOutcome.taskId) {
          keepVideoBatchLoadingForScope(routeCtx, { promptTaskId: submitOutcome.taskId })
        }
        return { ok: false, message: '已切换作品，任务仍在后台进行' }
      }
      if (!submitOutcome.ok || !submitOutcome.taskId) {
        const errMsg = submitOutcome.message || '视频生成失败'
        persistBatchTargetPanelErrors(pairs, errMsg, storyboardIds)
        creationStore.syncStep4PlusLiveGenToCurrentScope()
        clearVideoBatchTargetIds()
        creationStore.setGeneratingStoryboardVideo(false)
        const failedPanels = applyBatchFailureToLocalPanels(
          working,
          payload.scriptPanels,
          storyboardIds,
          errMsg
        )
        payload.onPanelsUpdate(failedPanels)
        creationStore.setStoryboardVideoBatchError(errMsg)
        creationStore.clearStoryboardVideoBatchProgress()
        return { ok: false, message: errMsg }
      }

      if (stopRequested) return { ok: false, message: '已停止生成' }

      const promptOutcome = await followPromptTask(submitOutcome.taskId, storyboardIds, {
        progressTotalHint: submitOutcome.totalShots || storyboardIds.length
      })
      if (isVideoBatchOperationInterrupted(routeCtx, generationAtEntry)) {
        keepVideoBatchLoadingForScope(routeCtx, {
          promptTaskId: submitOutcome.taskId,
          videoTaskId: promptOutcome.chainChildTaskIds?.[0]
        })
        return { ok: false, message: '已切换作品，任务仍在后台进行' }
      }
      if (stopRequested) {
        working = working.map((p) => ({ ...p, generating: false }))
        payload.onPanelsUpdate(working)
        clearPanelGeneratingStatuses(storyboardIds)
        stopVideoBatchGeneration()
        return { ok: false, message: '已停止生成' }
      }
      if (!promptOutcome.ok && !promptOutcome.partial) {
        if (shouldKeepVideoBatchLoadingAfterFollowMessage(promptOutcome.message)) {
          keepVideoBatchLoadingForScope(routeCtx, {
            promptTaskId: submitOutcome.taskId,
            videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
          })
          return { ok: false, message: promptOutcome.message }
        }
        working = applyBatchFailureToLocalPanels(
          working,
          payload.scriptPanels,
          storyboardIds,
          promptOutcome.message || '视频提示词生成失败'
        )
        persistBatchTargetPanelErrors(
          pairs,
          promptOutcome.message || '视频提示词生成失败',
          storyboardIds
        )
        payload.onPanelsUpdate(working)
        creationStore.setStoryboardVideoBatchError(promptOutcome.message || null)
        abortVideoBatchUi(storyboardIds)
        return { ok: false, message: promptOutcome.message || '视频提示词生成失败' }
      }

      const videoOutcome = await followVideoGenerateAfterPrompt(
        pairs,
        payload.onPanelsUpdate,
        working,
        promptOutcome.chainChildTaskIds
      )
      if (isVideoBatchOperationInterrupted(routeCtx, generationAtEntry)) {
        keepVideoBatchLoadingForScope(routeCtx, {
          promptTaskId: submitOutcome.taskId,
          videoTaskId: videoOutcome.taskId ?? promptOutcome.chainChildTaskIds?.[0]
        })
        return { ok: false, message: '已切换作品，任务仍在后台进行' }
      }

      if (!videoOutcome.ok) {
        if (shouldKeepVideoBatchLoadingAfterFollowMessage(videoOutcome.message)) {
          keepVideoBatchLoadingForScope(routeCtx, {
            promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
            videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
          })
          return { ok: false, message: videoOutcome.message }
        }
        working = applyBatchFailureToLocalPanels(
          working,
          payload.scriptPanels,
          storyboardIds,
          videoOutcome.message || '视频生成失败'
        )
        persistBatchTargetPanelErrors(pairs, videoOutcome.message || '视频生成失败', storyboardIds)
        payload.onPanelsUpdate(working)
        creationStore.setStoryboardVideoBatchError(videoOutcome.message || null)
        abortVideoBatchUi(storyboardIds)
        return { ok: false, message: videoOutcome.message || '视频生成失败' }
      }

      // 列表已在 followOngoingVideoGenerateTask 内用 SSE items / refresh 更新，避免用过期 working 覆盖成功视频
      finishVideoBatchUi(storyboardIds)

      if (stopRequested) {
        return { ok: false, message: '已停止生成' }
      }
      if (videoOutcome.partial) {
        return { ok: false, message: '部分分镜视频生成失败，可点击重新生成重试' }
      }
      return { ok: true }
    } finally {
      endBatchSseFollow()
      notifyGlobalTasksUpdatedOnce()
    }
  }

  function pickOngoingVideoPromptBatchTask(
    tasks: UserTaskRow[],
    preferredTaskId?: number | null
  ): UserTaskRow | null {
    const ongoing = tasks
      .filter(
        (t) =>
          t && isStoryboardVideoPromptBatchTask(t.taskType) && isOngoingUserTaskStatus(t.status)
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

  function pickOngoingVideoGenerateTask(
    tasks: UserTaskRow[],
    preferredTaskId?: number | null
  ): UserTaskRow | null {
    const ongoing = tasks
      .filter(
        (t) =>
          t &&
          isStoryboardVideoGenerateTaskType(t.taskType) &&
          isOngoingUserTaskStatus(t.status) &&
          !isPersistedModalVideoGenerateTaskId(Number(t.id))
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

  /** 提示词任务是否已在服务端终态（刷新后无需再连 SSE，避免空 EventStream） */
  async function isPromptBatchTaskTerminal(taskId: number): Promise<boolean> {
    return isUserTaskTerminal(taskId)
  }

  /** 提示词阶段结束后解析出片任务 id（优先 store 持久化，再拉最新 task/list） */
  async function resolveOngoingVideoGenerateTaskId(
    ctx: ProjectEpisodeContext,
    preferredVideoId?: number | null
  ): Promise<number | null> {
    const pref = parseTaskId(
      preferredVideoId ?? creationStore.storyboardVideoBatchActiveVideoTaskId
    )
    let tasks: UserTaskRow[] = []
    let taskListOk = true
    try {
      tasks = await fetchProjectTaskListCached(ctx.projectId)
    } catch {
      tasks = []
      taskListOk = false
    }
    const listHit = pickOngoingVideoGenerateTask(tasks, pref)
    return resolvePersistedTaskIdWhenListMiss(parseTaskId(listHit?.id), pref, taskListOk)
  }

  async function followOngoingVideoGenerateTaskOwned(
    taskId: number,
    pairs: StoryboardVideoPair[],
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void,
    workingPanels: StoryboardVideoPanel[]
  ): Promise<StoryboardVideoGenerateFollowResult> {
    const routeCtx = captureCreationLiveGenScope()
    const storyboardIds = pairs.map((p) => p.storyboardId)
    const batchTargetIds = getActiveBatchTargetIds()
    const videoTotal = batchTargetIds.length || storyboardIds.length

    creationStore.setGeneratingStoryboardVideo(true)
    markPanelsGenerating(batchTargetIds.length ? batchTargetIds : storyboardIds)
    syncActiveVideoTaskIdToStore(taskId)
    if (!creationStore.storyboardVideoBatchProgress.total) {
      creationStore.setStoryboardVideoBatchProgress(0, videoTotal)
    }
    let acceptsProgressRefresh = true
    beginBatchSseFollow()
    try {
      await seedProgressFromTaskDetail(taskId, videoTotal)

      let working = applyPanelsGeneratingToLocal(
        workingPanels,
        pairs.map((p) => p.script),
        true
      )
      onPanelsUpdate(working)

      let lastRefreshStepIndex = -1
      let latestProgressRefreshSequence = 0
      const result = await followStoryboardVideoGenerateTask({
        taskId,
        onProgress: (p) => {
          if (!matchesCreationLiveGenScope(routeCtx)) return
          applySseProgress({
            progress: p.percent,
            stepIndex: (p as { stepIndex?: number }).stepIndex,
            stepTotal: videoTotal,
            message: p.message,
            stepTitle: p.stepTitle
          })
          const stepIndex =
            typeof (p as { stepIndex?: number }).stepIndex === 'number'
              ? Number((p as { stepIndex?: number }).stepIndex)
              : null
          if (stepIndex != null && stepIndex > lastRefreshStepIndex) {
            lastRefreshStepIndex = stepIndex
            const refreshSequence = ++latestProgressRefreshSequence
            void refreshPanelsVideosForPairs(pairs, working, {
              onlyUpToStepIndex: stepIndex,
              batchTargetIds: batchTargetIds.length ? batchTargetIds : storyboardIds
            })
              .then((next) => {
                // 进度刷新是异步的：终态到达后或有更新的刷新启动后，旧结果不得复活
                // generating UI，也不得用较早进度覆盖较新卡片。
                if (
                  !acceptsProgressRefresh ||
                  refreshSequence !== latestProgressRefreshSequence ||
                  !matchesCreationLiveGenScope(routeCtx)
                ) {
                  return
                }
                working = next
                onPanelsUpdate(next)
              })
              .catch(() => {
                /* 进度增量刷新失败不影响 SSE owner；终态会执行权威列表对账。 */
              })
          }
        }
      })
      acceptsProgressRefresh = false

      /** 已切集：只保活原 scope，禁止清空 loading/taskId */
      if (!matchesCreationLiveGenScope(routeCtx)) {
        creationStore.mergeStep4PlusLiveGenForScopeKey(
          routeCtx.scopeKey,
          buildVideoBatchScopePreserveOnContextSwitch({
            promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
            videoTaskId: taskId
          })
        )
        return { ok: false, message: '已切换作品，任务仍在后台进行' }
      }

      const targetIds = batchTargetIds.length ? batchTargetIds : storyboardIds

      if (!result.ok) {
        const failMsg =
          'errorMessage' in result ? result.errorMessage || '视频生成失败' : '视频生成失败'
        if (shouldKeepVideoBatchLoadingAfterFollowMessage(failMsg)) {
          keepVideoBatchLoadingForScope(routeCtx, {
            promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
            videoTaskId: taskId
          })
          return { ok: false, message: failMsg }
        }
        syncActiveVideoTaskIdToStore(null)
        persistBatchTargetPanelErrors(pairs, failMsg, targetIds)
        working = applyBatchFailureToLocalPanels(
          working,
          pairs.map((p) => p.script),
          targetIds,
          failMsg
        )
        onPanelsUpdate(working)
        abortVideoBatchUi(targetIds)
        return {
          ok: false,
          message: failMsg
        }
      }

      syncActiveVideoTaskIdToStore(null)

      // partial_failed / complete：优先用 SSE items 立刻展示成功视频，再按失败集刷新其余卡片
      const terminalItems = parseVideoBatchSuccessItems(result.data)
      const failedStoryboardIds = resolveVideoBatchFailedStoryboardIds(
        result.data,
        targetIds,
        terminalItems
      )

      if (terminalItems.length) {
        working = applyVideoBatchTerminalItemsToPanels(working, pairs, terminalItems)
        onPanelsUpdate(working)
        const ctx = await resolveStoryScriptSaveContext(creationStore, route)
        if (ctx) {
          await setFinalVideosFromTerminalItems(ctx, terminalItems)
        }
      }

      working = await refreshPanelsAfterVideoBatch(
        pairs,
        working,
        failedStoryboardIds.size ? failedStoryboardIds : undefined,
        targetIds
      )
      onPanelsUpdate(working)
      creationStore.setStoryboardVideoBatchProgress(videoTotal, videoTotal)
      return { ok: true, ...(result.partial ? { partial: true } : {}) }
    } finally {
      acceptsProgressRefresh = false
      endBatchSseFollow()
    }
  }

  async function followOngoingVideoGenerateTask(
    taskId: number,
    pairs: StoryboardVideoPair[],
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void,
    workingPanels: StoryboardVideoPanel[]
  ): Promise<StoryboardVideoGenerateFollowResult> {
    while (videoFollowOwner) {
      if (videoFollowOwner.taskId === taskId) return videoFollowOwner.promise
      try {
        await videoFollowOwner.promise
      } catch {
        /* 前一出片任务释放后再接管下一任务。 */
      }
    }

    const promise = followOngoingVideoGenerateTaskOwned(
      taskId,
      pairs,
      onPanelsUpdate,
      workingPanels
    )
    const owner = { taskId, promise }
    videoFollowOwner = owner
    try {
      return await promise
    } finally {
      if (videoFollowOwner === owner) videoFollowOwner = null
      followIdleBarrier.notifyStateChange()
    }
  }

  function isBatchVideoGenerateTaskId(taskId: number): boolean {
    const batchId = creationStore.storyboardVideoBatchActiveVideoTaskId
    return batchId != null && batchId === taskId
  }

  /** 持久化在弹窗任务表中的任务始终归弹窗所有，刷新后外层列表不得接管同一条 SSE。 */
  function isPersistedModalVideoGenerateTaskId(taskId: number): boolean {
    const tid = Number(taskId)
    if (!Number.isFinite(tid) || tid <= 0) return false
    if (resolveStoryboardVideoGenEntriesByTaskId(creationStore, tid, route).length > 0) return true
    const session = readStoryboardVideoModalGenSession(modalGenSessionScopeFromStore(creationStore))
    return Number(session?.taskId) === tid && Number(session?.storyboardId) > 0
  }

  /** 列表批量/单条重新生成：持久化 taskId 缺失时仍按 batchTarget 走列表续跟（避免误进弹窗路径清掉 loading） */
  function shouldRestoreAsListBatchVideoTask(taskId: number): boolean {
    if (isPersistedModalVideoGenerateTaskId(taskId)) return false
    if (isBatchVideoGenerateTaskId(taskId)) return true
    if (creationStore.isGeneratingStoryboardVideo) return true
    const batchTargets = getActiveBatchTargetIds()
    if (batchTargets.length) return true
    if (
      Object.values(creationStore.storyboardPanelVideoGenStatusByStoryboardId || {}).some(
        (s) => s === 'generating'
      )
    ) {
      return true
    }
    return false
  }

  function getPendingModalVideoTaskEntries(): ModalVideoRestoreEntry[] {
    return toModalVideoRestoreEntries(
      collectStoryboardVideoGenTaskEntriesInScopes(creationStore, route)
    )
  }

  async function restoreOngoingBatchIfNeeded(
    scriptPanels: StoryboardPanel[],
    videoPanels: StoryboardVideoPanel[],
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void,
    options?: { discoverServerTasks?: boolean }
  ): Promise<void> {
    if (typeof window === 'undefined') return

    // 刷新后 list 可能晚于 restore：禁止空快照把已同步列表盖成「暂无分镜视频」
    const safeOnPanelsUpdate = (next: StoryboardVideoPanel[]) => {
      emitVideoPanelsUpdateSafe(onPanelsUpdate, next, videoPanels)
    }

    // 刷新后先把 scope 桶灌回扁平字段，再判断 taskId / isGenerating
    applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
    applyImmediatePanelLoadingRestore(scriptPanels, videoPanels, { skipScopeHydrate: true })
    const synced = syncPanelsGeneratingUi(
      readLatestScriptPanels(scriptPanels),
      readLatestVideoPanels(videoPanels)
    )
    if (synced) safeOnPanelsUpdate(synced)

    const hasServerStoryboardIds = readLatestScriptPanels(scriptPanels).some(
      (panel) => parseServerStoryboardId(panel.id) != null
    )
    const hasRestoreIntent = shouldRestoreImageBatchSse({
      isGenerating:
        Boolean(creationStore.isGeneratingStoryboardVideo) ||
        hasPersistedStoryboardVideoBatchGenWork(creationStore, route),
      following: false,
      hasServerStoryboardIds,
      hasActiveTaskId:
        parseTaskId(creationStore.storyboardVideoBatchActivePromptTaskId) != null ||
        parseTaskId(creationStore.storyboardVideoBatchActiveVideoTaskId) != null
    })
    if (!hasRestoreIntent && !options?.discoverServerTasks) return

    if (isVideoBatchFollowBusy()) return

    const scopeAtEntry = captureCreationLiveGenScope()
    if (restoreSessionInFlight) {
      return restoreSessionInFlight
    }

    const run = async () => {
      batchRunInFlight = true
      try {
        // 再次灌回：await 期间可能被 list sync / setCurrentProjectContext 冲掉扁平态
        applyCreationStoreScopeLiveGenFromRoute(creationStore, route)

        const ctx = await resolveStoryScriptSaveContext(creationStore, route)
        if (!ctx) return

        const gen = ++resumeFollowGeneration

        const preferredPromptId = creationStore.storyboardVideoBatchActivePromptTaskId
        const preferredVideoIdEarly = creationStore.storyboardVideoBatchActiveVideoTaskId
        const hasActiveTaskId =
          parseTaskId(preferredPromptId) != null || parseTaskId(preferredVideoIdEarly) != null
        const hasPersistedBatchState =
          creationStore.isGeneratingStoryboardVideo ||
          hasActiveTaskId ||
          hasPersistedStoryboardVideoBatchGenWork(creationStore, route)

        const pendingVideoTasksEarly = getPendingModalVideoTaskEntries()

        let tasks: UserTaskRow[] = []
        let taskListOk = true
        try {
          // 刷新续跟：强制最新 list（与任务中心同源），禁止旧缓存/失败卡片早退挡住出片 SSE
          tasks = await fetchProjectTaskListCached(ctx.projectId, { force: true })
        } catch {
          tasks = []
          taskListOk = false
        }
        if (gen !== resumeFollowGeneration) return

        // list/detail await 期间 storyboard/list 可能已写入 panels：必须用最新，禁止空入参快照
        let liveScriptPanels = readLatestScriptPanels(scriptPanels)
        let liveVideoPanels = readLatestVideoPanels(videoPanels)
        let pairs = collectPairs(liveScriptPanels, liveVideoPanels)
        let storyboardIds = pairs.map((p) => p.storyboardId)

        const listOngoingVideoId = parseTaskId(
          pickOngoingVideoGenerateTask(tasks, preferredVideoIdEarly)?.id
        )
        const listOngoingPromptId = parseTaskId(
          pickOngoingVideoPromptBatchTask(tasks, preferredPromptId)?.id
        )

        const prefVideo = parseTaskId(preferredVideoIdEarly)
        let storeVideoTaskTrusted = false
        if (prefVideo != null) {
          try {
            const detail = await fetchUserTaskDetailOnce(prefVideo)
            const st = normalizeTaskStatus(detail?.status ?? '')
            storeVideoTaskTrusted =
              Boolean(detail && isOngoingUserTaskStatus(st)) ||
              (!detail && creationStore.isGeneratingStoryboardVideo) ||
              (Boolean(detail) && creationStore.isGeneratingStoryboardVideo)
          } catch {
            storeVideoTaskTrusted =
              creationStore.isGeneratingStoryboardVideo || listOngoingVideoId == null
          }
        }

        const prefPrompt = parseTaskId(preferredPromptId)
        let storePromptTaskTrusted = false
        if (prefPrompt != null) {
          try {
            const detail = await fetchUserTaskDetailOnce(prefPrompt)
            // 提示词即使已终态也要信任：用于解析 chainChildTaskIds 再跟出片
            storePromptTaskTrusted =
              Boolean(detail) || creationStore.isGeneratingStoryboardVideo || hasPersistedBatchState
          } catch {
            storePromptTaskTrusted =
              creationStore.isGeneratingStoryboardVideo || hasPersistedBatchState
          }
        }
        if (gen !== resumeFollowGeneration) return

        const followTarget = resolveVideoBatchRestoreFollowTarget({
          listOngoingVideoTaskId: listOngoingVideoId,
          listOngoingPromptTaskId: listOngoingPromptId,
          storeVideoTaskId: prefVideo,
          storePromptTaskId: prefPrompt,
          storeVideoTaskTrusted,
          storePromptTaskTrusted
        })

        // 跨集会清空 panels：有可跟目标时先跟 SSE，勿只亮 loading
        if (
          !storyboardIds.length &&
          !followTarget &&
          !options?.discoverServerTasks &&
          !shouldRestoreImageBatchSse({
            isGenerating: Boolean(hasPersistedBatchState),
            following: false,
            hasActiveTaskId: hasActiveTaskId || hasPersistedBatchState
          })
        ) {
          return
        }

        // —— 出片优先：任务中心已显示「分镜视频出片」进行中时，必须直接连 SSE ——
        if (followTarget?.kind === 'video') {
          const ongoingVideoId = followTarget.taskId
          if (!shouldRestoreAsListBatchVideoTask(ongoingVideoId)) {
            const entries = resolveModalVideoRestoreEntriesForTaskId(
              ongoingVideoId,
              pairs,
              creationStore,
              route
            )
            if (entries.length) {
              return
            }
            // 无弹窗条目时仍按列表批量续跟，禁止空 return 丢 SSE
          }
          if (creationStore.storyboardVideoBatchActiveVideoTaskId !== ongoingVideoId) {
            syncActiveVideoTaskIdToStore(ongoingVideoId)
          }
          if (!creationStore.isGeneratingStoryboardVideo) {
            creationStore.setGeneratingStoryboardVideo(true)
            creationStore.setStoryboardVideoBatchError(null)
          }
          liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
          liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
          pairs = collectPairs(liveScriptPanels, liveVideoPanels)
          storyboardIds = pairs.map((p) => p.storyboardId)
          applyImmediatePanelLoadingRestore(liveScriptPanels, liveVideoPanels, {
            skipScopeHydrate: true
          })
          let working = applyPanelsGeneratingToLocal(liveVideoPanels, liveScriptPanels, true)
          safeOnPanelsUpdate(working)
          const batchTargetIds = getActiveBatchTargetIds()
          const restorePairs =
            batchTargetIds.length > 0
              ? pairs.filter((p) => batchTargetIds.includes(p.storyboardId))
              : pairs
          const videoFollowOutcome = await followOngoingVideoGenerateTask(
            ongoingVideoId,
            restorePairs,
            safeOnPanelsUpdate,
            working.length ? working : liveVideoPanels
          )
          if (gen !== resumeFollowGeneration) {
            keepVideoBatchLoadingForScope(scopeAtEntry, { videoTaskId: ongoingVideoId })
            return
          }
          if (
            !videoFollowOutcome.ok &&
            shouldKeepVideoBatchLoadingAfterFollowMessage(videoFollowOutcome.message)
          ) {
            keepVideoBatchLoadingForScope(scopeAtEntry, { videoTaskId: ongoingVideoId })
            return
          }
          if (!matchesCreationLiveGenScope(scopeAtEntry)) {
            keepVideoBatchLoadingForScope(scopeAtEntry, { videoTaskId: ongoingVideoId })
            return
          }
          if (!videoFollowOutcome.ok) {
            abortVideoBatchUi(batchTargetIds.length ? batchTargetIds : storyboardIds)
            return
          }
          finishVideoBatchUi(batchTargetIds.length ? batchTargetIds : storyboardIds)
          return
        }

        let ongoingPromptId: number | null =
          followTarget?.kind === 'prompt' ? followTarget.taskId : null

        if (ongoingPromptId != null) {
          if (gen !== resumeFollowGeneration) return
          if (!creationStore.isGeneratingStoryboardVideo) {
            creationStore.setGeneratingStoryboardVideo(true)
            creationStore.setStoryboardVideoBatchError(null)
          }

          const batchTargetIds = getActiveBatchTargetIds()

          // 提示词已在服务端完成时，仍需解析 chainChildTaskIds 再跟进出片 SSE
          const promptAlreadyTerminal = await isPromptBatchTaskTerminal(ongoingPromptId)
          let promptOutcome: {
            ok: boolean
            partial?: boolean
            message?: string
            taskId?: number
            chainChildTaskIds?: number[]
          }
          if (promptAlreadyTerminal) {
            promptOutcome = {
              ok: true,
              taskId: ongoingPromptId,
              chainChildTaskIds: await resolveChainChildTaskIdsForPromptTask(ongoingPromptId)
            }
          } else {
            const promptTargets = batchTargetIds.length ? batchTargetIds : storyboardIds
            promptOutcome = await followPromptTask(ongoingPromptId, promptTargets)
          }
          if (gen !== resumeFollowGeneration) {
            keepVideoBatchLoadingForScope(scopeAtEntry, {
              promptTaskId: ongoingPromptId,
              videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
            })
            return
          }

          if (!promptOutcome.ok && !promptOutcome.partial) {
            if (shouldKeepVideoBatchLoadingAfterFollowMessage(promptOutcome.message)) {
              keepVideoBatchLoadingForScope(scopeAtEntry, {
                promptTaskId: ongoingPromptId,
                videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
              })
              return
            }
            abortVideoBatchUi(batchTargetIds.length ? batchTargetIds : storyboardIds)
            return
          }

          const ongoingVideoId = await resolveOngoingVideoGenerateTaskId(
            ctx,
            creationStore.storyboardVideoBatchActiveVideoTaskId
          )

          // 提示词已终态且已拿到出片任务后，再清 prompt taskId
          if (promptAlreadyTerminal && ongoingVideoId != null) {
            syncActivePromptTaskIdToStore(null)
          }

          const restoreTargetIds = batchTargetIds.length ? batchTargetIds : storyboardIds
          const restorePairs =
            batchTargetIds.length > 0
              ? pairs.filter((p) => batchTargetIds.includes(p.storyboardId))
              : pairs

          if (ongoingVideoId != null) {
            liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
            liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
            pairs = collectPairs(liveScriptPanels, liveVideoPanels)
            storyboardIds = pairs.map((p) => p.storyboardId)
            let working = applyPanelsGeneratingToLocal(liveVideoPanels, liveScriptPanels, true)
            safeOnPanelsUpdate(working)
            const videoFollowOutcome = await followOngoingVideoGenerateTask(
              ongoingVideoId,
              batchTargetIds.length > 0
                ? pairs.filter((p) => batchTargetIds.includes(p.storyboardId))
                : pairs,
              safeOnPanelsUpdate,
              working.length ? working : liveVideoPanels
            )
            if (gen !== resumeFollowGeneration) {
              keepVideoBatchLoadingForScope(scopeAtEntry, {
                promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
                videoTaskId: ongoingVideoId
              })
              return
            }
            if (!videoFollowOutcome.ok) {
              if (shouldKeepVideoBatchLoadingAfterFollowMessage(videoFollowOutcome.message)) {
                keepVideoBatchLoadingForScope(scopeAtEntry, {
                  promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
                  videoTaskId: ongoingVideoId
                })
                return
              }
              if (!matchesCreationLiveGenScope(scopeAtEntry)) {
                keepVideoBatchLoadingForScope(scopeAtEntry, { videoTaskId: ongoingVideoId })
                return
              }
              abortVideoBatchUi(restoreTargetIds)
              return
            }
          } else if (promptOutcome.ok || promptOutcome.partial) {
            // 出片任务尚未进 list：有 chain/分镜则继续；否则保活等待 syncReady 重试
            liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
            liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
            pairs = collectPairs(liveScriptPanels, liveVideoPanels)
            storyboardIds = pairs.map((p) => p.storyboardId)
            const liveRestorePairs =
              batchTargetIds.length > 0
                ? pairs.filter((p) => batchTargetIds.includes(p.storyboardId))
                : pairs
            const chainIds = promptOutcome.chainChildTaskIds || []
            if (!chainIds.length && !liveRestorePairs.length) {
              keepVideoBatchLoadingForScope(scopeAtEntry, {
                promptTaskId: ongoingPromptId,
                videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
              })
              return
            }
            let working = applyPanelsGeneratingToLocal(liveVideoPanels, liveScriptPanels, true)
            safeOnPanelsUpdate(working)
            const videoOutcome = await followVideoGenerateAfterPrompt(
              liveRestorePairs,
              safeOnPanelsUpdate,
              working.length ? working : liveVideoPanels,
              promptOutcome.chainChildTaskIds
            )
            if (gen !== resumeFollowGeneration) {
              keepVideoBatchLoadingForScope(scopeAtEntry, {
                promptTaskId: ongoingPromptId,
                videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
              })
              return
            }
            if (
              !videoOutcome.ok &&
              shouldKeepVideoBatchLoadingAfterFollowMessage(videoOutcome.message)
            ) {
              keepVideoBatchLoadingForScope(scopeAtEntry, {
                promptTaskId: ongoingPromptId,
                videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
              })
              return
            }
            if (videoOutcome.ok) {
              if (promptAlreadyTerminal) {
                syncActivePromptTaskIdToStore(null)
              }
              working = await refreshPanelsAfterVideoBatch(
                liveRestorePairs,
                working.length ? working : liveVideoPanels,
                undefined,
                restoreTargetIds
              )
              safeOnPanelsUpdate(working)
            } else if (!videoOutcome.ok) {
              if (!matchesCreationLiveGenScope(scopeAtEntry)) {
                keepVideoBatchLoadingForScope(scopeAtEntry, {
                  promptTaskId: ongoingPromptId
                })
                return
              }
              abortVideoBatchUi(restoreTargetIds)
              return
            }
          } else {
            keepVideoBatchLoadingForScope(scopeAtEntry, {
              promptTaskId: ongoingPromptId,
              videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
            })
            return
          }

          if (!matchesCreationLiveGenScope(scopeAtEntry)) {
            keepVideoBatchLoadingForScope(scopeAtEntry, {
              promptTaskId: ongoingPromptId,
              videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
            })
            return
          }

          const finishIds = restoreTargetIds.length
            ? restoreTargetIds
            : getActiveBatchTargetIds().length
              ? getActiveBatchTargetIds()
              : storyboardIds
          finishVideoBatchUi(finishIds)
          return
        }

        const preferredVideoId = creationStore.storyboardVideoBatchActiveVideoTaskId
        let ongoingVideoId: number | null = null
        const fallbackPrefVideo = parseTaskId(preferredVideoId)
        if (fallbackPrefVideo != null) {
          try {
            const detail = await fetchUserTaskDetailOnce(fallbackPrefVideo)
            if (detail || creationStore.isGeneratingStoryboardVideo) {
              ongoingVideoId = fallbackPrefVideo
            }
          } catch {
            if (creationStore.isGeneratingStoryboardVideo) ongoingVideoId = fallbackPrefVideo
          }
        }
        if (ongoingVideoId == null) {
          const ongoingVideoTask = pickOngoingVideoGenerateTask(tasks, preferredVideoId)
          ongoingVideoId = resolvePersistedTaskIdWhenListMiss(
            parseTaskId(ongoingVideoTask?.id),
            preferredVideoId,
            taskListOk
          )
        }

        if (ongoingVideoId != null) {
          if (gen !== resumeFollowGeneration) return

          liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
          liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
          pairs = collectPairs(liveScriptPanels, liveVideoPanels)
          storyboardIds = pairs.map((p) => p.storyboardId)

          if (!shouldRestoreAsListBatchVideoTask(ongoingVideoId)) {
            const entries = resolveModalVideoRestoreEntriesForTaskId(
              ongoingVideoId,
              pairs,
              creationStore,
              route
            )
            if (!entries.length) return
            return
          }

          if (creationStore.storyboardVideoBatchActiveVideoTaskId !== ongoingVideoId) {
            syncActiveVideoTaskIdToStore(ongoingVideoId)
          }
          if (!creationStore.isGeneratingStoryboardVideo) {
            creationStore.setGeneratingStoryboardVideo(true)
            creationStore.setStoryboardVideoBatchError(null)
          }
          applyImmediatePanelLoadingRestore(liveScriptPanels, liveVideoPanels, {
            skipScopeHydrate: true
          })
          let working = applyPanelsGeneratingToLocal(liveVideoPanels, liveScriptPanels, true)
          safeOnPanelsUpdate(working)
          const batchTargetIds = getActiveBatchTargetIds()
          const restorePairs =
            batchTargetIds.length > 0
              ? pairs.filter((p) => batchTargetIds.includes(p.storyboardId))
              : pairs
          const videoFollowOutcome = await followOngoingVideoGenerateTask(
            ongoingVideoId,
            restorePairs,
            safeOnPanelsUpdate,
            working.length ? working : liveVideoPanels
          )
          if (gen !== resumeFollowGeneration) {
            keepVideoBatchLoadingForScope(scopeAtEntry, {
              promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
              videoTaskId: ongoingVideoId
            })
            return
          }
          if (
            !videoFollowOutcome.ok &&
            shouldKeepVideoBatchLoadingAfterFollowMessage(videoFollowOutcome.message)
          ) {
            keepVideoBatchLoadingForScope(scopeAtEntry, {
              promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
              videoTaskId: ongoingVideoId
            })
            return
          }
          if (!matchesCreationLiveGenScope(scopeAtEntry)) {
            keepVideoBatchLoadingForScope(scopeAtEntry, {
              promptTaskId: creationStore.storyboardVideoBatchActivePromptTaskId,
              videoTaskId: ongoingVideoId
            })
            return
          }
          if (!videoFollowOutcome.ok) {
            abortVideoBatchUi(batchTargetIds.length ? batchTargetIds : storyboardIds)
            return
          }
          finishVideoBatchUi(batchTargetIds.length ? batchTargetIds : storyboardIds)
          return
        }

        const persistedGenerating = Object.entries(
          creationStore.storyboardPanelVideoGenStatusByStoryboardId
        ).filter(([, st]) => st === 'generating')

        const pendingVideoTasks = pendingVideoTasksEarly ?? getPendingModalVideoTaskEntries()

        const hasPersistedTaskId =
          creationStore.storyboardVideoBatchActivePromptTaskId != null ||
          creationStore.storyboardVideoBatchActiveVideoTaskId != null

        if (!persistedGenerating.length && !pendingVideoTasks.length) {
          if (!creationStore.isGeneratingStoryboardVideo && !hasPersistedTaskId) {
            return
          }
          if (!taskListOk) {
            liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
            liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
            applyImmediatePanelLoadingRestore(liveScriptPanels, liveVideoPanels, {
              skipScopeHydrate: true
            })
            const retrySynced = syncPanelsGeneratingUi(liveScriptPanels, liveVideoPanels)
            if (retrySynced) safeOnPanelsUpdate(retrySynced)
            return
          }
          if (creationStore.isGeneratingStoryboardVideo && !hasPersistedTaskId) {
            return
          }
          // 仍有 taskId：强制续跟（对齐分镜图），禁止空 return 丢 SSE
          if (hasPersistedTaskId) {
            const promptTid = parseTaskId(creationStore.storyboardVideoBatchActivePromptTaskId)
            const videoTid = parseTaskId(creationStore.storyboardVideoBatchActiveVideoTaskId)
            liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
            liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
            pairs = collectPairs(liveScriptPanels, liveVideoPanels)
            storyboardIds = pairs.map((p) => p.storyboardId)
            applyImmediatePanelLoadingRestore(liveScriptPanels, liveVideoPanels, {
              skipScopeHydrate: true
            })
            if (!creationStore.isGeneratingStoryboardVideo) {
              creationStore.setGeneratingStoryboardVideo(true)
            }
            if (gen !== resumeFollowGeneration) {
              keepVideoBatchLoadingForScope(scopeAtEntry, {
                promptTaskId: promptTid,
                videoTaskId: videoTid
              })
              return
            }
            const batchTargetIds = getActiveBatchTargetIds()
            const restorePairs =
              batchTargetIds.length > 0
                ? pairs.filter((p) => batchTargetIds.includes(p.storyboardId))
                : pairs
            const promptTargets = batchTargetIds.length ? batchTargetIds : storyboardIds
            if (promptTid != null) {
              const promptOutcome = await followPromptTask(promptTid, promptTargets)
              if (
                !promptOutcome.ok &&
                !promptOutcome.partial &&
                shouldKeepVideoBatchLoadingAfterFollowMessage(promptOutcome.message)
              ) {
                keepVideoBatchLoadingForScope(scopeAtEntry, {
                  promptTaskId: promptTid,
                  videoTaskId: videoTid
                })
                return
              }
              if (promptOutcome.ok || promptOutcome.partial) {
                let videoId = videoTid ?? (await resolveOngoingVideoGenerateTaskId(ctx, videoTid))
                if (
                  videoId == null &&
                  (promptOutcome.chainChildTaskIds?.length || restorePairs.length)
                ) {
                  liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
                  liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
                  let working = applyPanelsGeneratingToLocal(
                    liveVideoPanels,
                    liveScriptPanels,
                    true
                  )
                  safeOnPanelsUpdate(working)
                  const videoOutcome = await followVideoGenerateAfterPrompt(
                    restorePairs,
                    safeOnPanelsUpdate,
                    working.length ? working : liveVideoPanels,
                    promptOutcome.chainChildTaskIds
                  )
                  if (
                    !videoOutcome.ok &&
                    shouldKeepVideoBatchLoadingAfterFollowMessage(videoOutcome.message)
                  ) {
                    keepVideoBatchLoadingForScope(scopeAtEntry, {
                      promptTaskId: promptTid,
                      videoTaskId: creationStore.storyboardVideoBatchActiveVideoTaskId
                    })
                    return
                  }
                  if (videoOutcome.ok && matchesCreationLiveGenScope(scopeAtEntry)) {
                    finishVideoBatchUi(promptTargets)
                  }
                  return
                }
                if (videoId != null) {
                  liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
                  liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
                  let working = applyPanelsGeneratingToLocal(
                    liveVideoPanels,
                    liveScriptPanels,
                    true
                  )
                  safeOnPanelsUpdate(working)
                  const videoFollowOutcome = await followOngoingVideoGenerateTask(
                    videoId,
                    restorePairs,
                    safeOnPanelsUpdate,
                    working.length ? working : liveVideoPanels
                  )
                  if (
                    !videoFollowOutcome.ok &&
                    shouldKeepVideoBatchLoadingAfterFollowMessage(videoFollowOutcome.message)
                  ) {
                    keepVideoBatchLoadingForScope(scopeAtEntry, {
                      promptTaskId: promptTid,
                      videoTaskId: videoId
                    })
                    return
                  }
                  if (videoFollowOutcome.ok && matchesCreationLiveGenScope(scopeAtEntry)) {
                    finishVideoBatchUi(promptTargets)
                  }
                  return
                }
                keepVideoBatchLoadingForScope(scopeAtEntry, {
                  promptTaskId: promptTid,
                  videoTaskId: videoTid
                })
                return
              }
              if (!promptOutcome.ok) {
                abortVideoBatchUi(promptTargets)
              }
              return
            }
            if (videoTid != null) {
              liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
              liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
              let working = applyPanelsGeneratingToLocal(liveVideoPanels, liveScriptPanels, true)
              safeOnPanelsUpdate(working)
              const videoFollowOutcome = await followOngoingVideoGenerateTask(
                videoTid,
                restorePairs,
                safeOnPanelsUpdate,
                working.length ? working : liveVideoPanels
              )
              if (
                !videoFollowOutcome.ok &&
                shouldKeepVideoBatchLoadingAfterFollowMessage(videoFollowOutcome.message)
              ) {
                keepVideoBatchLoadingForScope(scopeAtEntry, {
                  videoTaskId: videoTid
                })
                return
              }
              if (videoFollowOutcome.ok && matchesCreationLiveGenScope(scopeAtEntry)) {
                finishVideoBatchUi(batchTargetIds.length ? batchTargetIds : storyboardIds)
              }
              return
            }
            return
          }
          stopVideoBatchGeneration()
          return
        }

        if (pendingVideoTasks.length && !creationStore.storyboardVideoBatchActiveVideoTaskId) {
          return
        }

        if (
          persistedGenerating.length &&
          creationStore.isGeneratingStoryboardVideo &&
          !hasPersistedTaskId
        ) {
          if (gen !== resumeFollowGeneration) return
          liveScriptPanels = readLatestScriptPanels(liveScriptPanels)
          liveVideoPanels = readLatestVideoPanels(liveVideoPanels)
          applyImmediatePanelLoadingRestore(liveScriptPanels, liveVideoPanels, {
            skipScopeHydrate: true
          })
          const synced = syncPanelsGeneratingUi(liveScriptPanels, liveVideoPanels)
          if (synced) safeOnPanelsUpdate(synced)
          return
        }

        // 只剩弹窗持久化任务时，外层不续跟、不改卡片状态；打开弹窗后由其恢复。
        return
      } finally {
        batchRunInFlight = false
        followIdleBarrier.notifyStateChange()
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
    closePromptStream()
    const promptTaskId =
      activePromptTaskId.value ?? creationStore.storyboardVideoBatchActivePromptTaskId
    const videoTaskId =
      videoFollowOwner?.taskId ?? creationStore.storyboardVideoBatchActiveVideoTaskId
    const taskIds = [promptTaskId, videoTaskId]
      .map((id) => parseTaskId(id))
      .filter((id): id is number => id != null)
    for (const taskId of [...new Set(taskIds)]) {
      try {
        await requestCancelUserTaskById(taskId)
      } catch {
        /* ignore */
      }
    }
    syncActivePromptTaskIdToStore(null)
    syncActiveVideoTaskIdToStore(null)
    stopVideoBatchGeneration()
  }

  function onGlobalStopTask(event: Event) {
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    const id = parseTaskId(detail?.taskId)
    if (!id) return
    if (
      !isStoryboardVideoPromptBatchTask(detail?.taskType) &&
      !isStoryboardVideoGenerateTaskType(detail?.taskType) &&
      activePromptTaskId.value !== id &&
      creationStore.storyboardVideoBatchActivePromptTaskId !== id &&
      creationStore.storyboardVideoBatchActiveVideoTaskId !== id
    ) {
      return
    }
    void requestStop()
  }

  function onGlobalTrackTask(
    event: Event,
    scriptPanels: StoryboardPanel[],
    videoPanels: StoryboardVideoPanel[],
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void,
    onDone?: (result: { ok: boolean; message?: string }) => void
  ) {
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    const ty = String(detail?.taskType ?? '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_')
    const id = parseTaskId(detail?.taskId)
    if (!id) return

    const pairs = collectPairs(scriptPanels, videoPanels)
    const batchTargetIds = getActiveBatchTargetIds()
    const storyboardIds = batchTargetIds.length ? batchTargetIds : pairs.map((p) => p.storyboardId)
    const effectivePairs =
      batchTargetIds.length > 0
        ? pairs.filter((p) => batchTargetIds.includes(p.storyboardId))
        : pairs

    if (ty === 'storyboard_video_prompt_batch') {
      void (async () => {
        if (batchTargetIds.length) {
          setVideoBatchTargetIds(batchTargetIds)
        }
        const promptOutcome = await followPromptTask(id, storyboardIds)
        if (promptOutcome.ok || promptOutcome.partial) {
          let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
          onPanelsUpdate(working)
          const videoOutcome = await followVideoGenerateAfterPrompt(
            effectivePairs,
            onPanelsUpdate,
            working,
            promptOutcome.chainChildTaskIds
          )
          if (videoOutcome.ok) {
            working = await refreshPanelsAfterVideoBatch(
              effectivePairs,
              working,
              undefined,
              storyboardIds
            )
            onPanelsUpdate(working)
            finishVideoBatchUi(storyboardIds)
            onDone?.({ ok: true })
            return
          }
        }
        abortVideoBatchUi(storyboardIds)
        onDone?.({ ok: false, message: promptOutcome.message })
      })()
      return
    }

    if (ty === 'storyboard_video_generate') {
      void (async () => {
        if (!shouldRestoreAsListBatchVideoTask(id)) {
          const entries = resolveModalVideoRestoreEntriesForTaskId(id, pairs, creationStore, route)
          if (!entries.length) {
            onDone?.({ ok: false, message: '无法定位进行中的分镜视频任务' })
            return
          }
          onDone?.({ ok: true })
          return
        }

        if (creationStore.storyboardVideoBatchActiveVideoTaskId !== id) {
          syncActiveVideoTaskIdToStore(id)
        }
        applyImmediatePanelLoadingRestore(scriptPanels, videoPanels)
        let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
        onPanelsUpdate(working)
        const outcome = await followOngoingVideoGenerateTask(
          id,
          effectivePairs,
          onPanelsUpdate,
          working
        )
        if (outcome.ok) {
          finishVideoBatchUi(storyboardIds)
        } else {
          abortVideoBatchUi(storyboardIds)
        }
        onDone?.({
          ok: outcome.ok,
          message: outcome.message
        })
      })()
    }
  }

  function onGlobalResumeTask(
    event: Event,
    scriptPanels: StoryboardPanel[],
    videoPanels: StoryboardVideoPanel[],
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void,
    onDone?: (result: { ok: boolean; message?: string }) => void
  ) {
    const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
    const ty = String(detail?.taskType ?? '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_')
    const id = parseTaskId(detail?.taskId)
    if (!id) return

    const pairs = collectPairs(scriptPanels, videoPanels)
    const batchTargetIds = getActiveBatchTargetIds()
    const storyboardIds = batchTargetIds.length ? batchTargetIds : pairs.map((p) => p.storyboardId)
    const effectivePairs =
      batchTargetIds.length > 0
        ? pairs.filter((p) => batchTargetIds.includes(p.storyboardId))
        : pairs

    if (ty === 'storyboard_video_prompt_batch') {
      void (async () => {
        beginBatchSseFollow()
        try {
          try {
            await resumeUserTask(id, 'storyboard_video_prompt_batch')
            creationStore.removePausedTaskFollow(id)
            if (import.meta.client) {
              window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
            }
            if (batchTargetIds.length) {
              setVideoBatchTargetIds(batchTargetIds)
            }
            const promptOutcome = await followPromptTask(id, storyboardIds)
            if (promptOutcome.ok || promptOutcome.partial) {
              let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
              onPanelsUpdate(working)
              const videoOutcome = await followVideoGenerateAfterPrompt(
                effectivePairs,
                onPanelsUpdate,
                working,
                promptOutcome.chainChildTaskIds
              )
              if (videoOutcome.ok) {
                working = await refreshPanelsAfterVideoBatch(
                  effectivePairs,
                  working,
                  undefined,
                  storyboardIds
                )
                onPanelsUpdate(working)
                finishVideoBatchUi(storyboardIds)
                onDone?.({
                  ok: true,
                  message: promptOutcome.partial ? promptOutcome.message : undefined
                })
                return
              }
            }
            abortVideoBatchUi(storyboardIds)
            onDone?.({ ok: false, message: promptOutcome.message })
          } catch (e: unknown) {
            abortVideoBatchUi(storyboardIds)
            onDone?.({ ok: false, message: bizErr(e) })
          }
        } finally {
          endBatchSseFollow()
        }
      })()
      return
    }

    if (ty === 'storyboard_video_generate') {
      void (async () => {
        beginBatchSseFollow()
        try {
          try {
            await resumeUserTask(id, 'storyboard_video_generate')
            creationStore.removePausedTaskFollow(id)
            if (import.meta.client) {
              window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
            }
            applyImmediatePanelLoadingRestore(scriptPanels, videoPanels)
            let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
            onPanelsUpdate(working)
            const outcome = await followOngoingVideoGenerateTask(
              id,
              effectivePairs,
              onPanelsUpdate,
              working
            )
            if (outcome.ok) {
              finishVideoBatchUi(storyboardIds)
            } else {
              abortVideoBatchUi(storyboardIds)
            }
            onDone?.({ ok: outcome.ok, message: outcome.message })
          } catch (e: unknown) {
            abortVideoBatchUi(storyboardIds)
            onDone?.({ ok: false, message: bizErr(e) })
          }
        } finally {
          endBatchSseFollow()
        }
      })()
    }
  }

  function cancelResumeFollow(): Promise<void> {
    resumeFollowGeneration++
    closePromptStream()
    const videoTaskId =
      videoFollowOwner?.taskId ?? creationStore.storyboardVideoBatchActiveVideoTaskId
    if (videoTaskId != null) suspendTaskSseFollow(videoTaskId)
    return followIdleBarrier.waitForIdle()
  }

  function isBatchFollowInFlight(): boolean {
    return isVideoBatchFollowBusy()
  }

  return {
    activePromptTaskId,
    setManualPromptAgentModelPick,
    setManualVideoModelPick,
    runFullAutoGenerate,
    runBatchVideosOnly,
    regenerateSinglePanel,
    requestStop,
    restoreOngoingBatchIfNeeded,
    applyImmediatePanelLoadingRestore,
    applyStoryboardVideoPanelUiFromStore,
    applyStoryboardVideoPanelErrorsFromStore,
    syncPanelsGeneratingUi,
    onGlobalStopTask,
    onGlobalTrackTask,
    onGlobalResumeTask,
    cancelResumeFollow,
    waitForFollowIdle: followIdleBarrier.waitForIdle,
    isBatchFollowInFlight
  }
}
