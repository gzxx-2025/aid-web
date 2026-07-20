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
  userStoryboardGenerateVideoPrompt,
  userStoryboardGenerateVideoPromptImage,
  userStoryboardSetFinal,
  userTaskCancel,
  userTaskDetail,
  userTaskList
} from '~/utils/businessApi'
import { fetchStoryboardRecordsForStoryboard } from '~/utils/storyboardRecordBatch'
import {
  awaitStoryboardPromptGenerateTask,
  resumeStoryboardPromptGenerateTask,
  sanitizeStoryboardPromptModelCode
} from '~/utils/storyboardPromptGenerateFlow'
import { resolveStoryboardVideoPromptSubmitAgentCode } from '~/utils/extractAgentBiz'
import {
  STORYBOARD_GEN_CONFIG_SCENE_CODES,
  resolveStoryboardGenConfigLlmFields
} from '~/utils/projectGenConfig'
import {
  followStoryboardVideoGenerateTask,
  resumeStoryboardVideoGenerateTask,
  runStoryboardImageVideoGenerateTask,
  runStoryboardMultiVideoGenerateTask
} from '~/composables/useStoryboardVideoGenerateTask'
import { useTaskStream } from '~/composables/useTaskStream'
import {
  fetchUserTaskDetailOnce,
  normalizeTaskStatus
} from '~/composables/useTaskSseFollow'
import { isStoryboardVideoGenerateResumableStatus } from '~/utils/taskPartialFailed'
import {
  resolveStoryboardVideoGenerateRoute,
  storyboardVideoBatchUnsupportedMessage
} from '~/utils/storyboardVideoGenerateRoute'
import type { StoryboardPanel, StoryboardVideoPanel } from '~/types'
import type {
  StoryboardRecordRow,
  StoryboardVideoGenerateRequest,
  StoryboardVideoImageGenerateRequest,
  UserTaskRow
} from '~/types/business-api'

function bizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normStoryboardVideoPromptBatchTaskType(ty: unknown): string {
  return String(ty ?? '').trim().toLowerCase().replace(/-/g, '_')
}

function isStoryboardVideoPromptBatchTask(ty: unknown): boolean {
  return normStoryboardVideoPromptBatchTaskType(ty) === 'storyboard_video_prompt_batch'
}

function isStoryboardVideoGenerateTaskType(ty: unknown): boolean {
  return normStoryboardVideoPromptBatchTaskType(ty) === 'storyboard_video_generate'
}

function isOngoingUserTaskStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase()
  return s === 'PENDING' || s === 'PROCESSING' || s === 'RUNNING' || s === 'QUEUED' || s === 'WAITING'
}

function mapRecordToPanelVideo(r: StoryboardRecordRow, title: string) {
  const url = String(r.fileUrl ?? '').trim()
  return {
    id: String(r.id),
    url,
    title,
    source: '生成记录',
    importDate: r.createTime || undefined,
    isStoryboardVideo: r.isSelected === 1,
    _fromServer: true,
    _serverRow: r
  }
}

type StoryboardVideoPair = {
  script: StoryboardPanel
  video: StoryboardVideoPanel | undefined
  index: number
  storyboardId: number
}

/** 弹窗内单条生视频后台续跟中的 storyboardId，避免与 EditStoryboardVideoModal 重复连 SSE */
export const activeStoryboardVideoModalRestoreFollowIds = new Set<number>()

export function isStoryboardVideoModalRestoreFollowing(storyboardId: number): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  return activeStoryboardVideoModalRestoreFollowIds.has(sid)
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

  function setManualPromptAgentModelPick(value: boolean) {
    manualPromptAgentModelPick = value
  }

  function setManualVideoModelPick(value: boolean) {
    manualVideoModelPick = value
  }

  function resolveCreationMode(): string {
    return String(creationStore.formData?.globalSetting?.creationMode || 'i2v').trim()
  }

  function resolveVideoGenerateRoute() {
    return resolveStoryboardVideoGenerateRoute(resolveCreationMode())
  }

  function videoBatchUnsupportedMessage(): string | null {
    const route = resolveVideoGenerateRoute()
    if (route === 'auto_grid') return storyboardVideoBatchUnsupportedMessage()
    return null
  }

  function resolveVideoPromptEndpoint(): 'video_prompt' | 'video_prompt_image' {
    return resolveVideoGenerateRoute() === 'multi' ? 'video_prompt' : 'video_prompt_image'
  }

  function resolveVideoPromptAgentCode(): string {
    return resolveStoryboardVideoPromptSubmitAgentCode(
      resolveVideoPromptEndpoint(),
      creationStore.storyboardVideoGenerateSettings.agentId
    )
  }

  function resolveVideoPromptModelCode(): string {
    return sanitizeStoryboardPromptModelCode(
      creationStore.storyboardVideoGenerateSettings.videoPromptModelCode
    )
  }

  async function buildVideoPromptSubmitFields(projectId: number) {
    const route = resolveVideoGenerateRoute()
    const sceneCode =
      route === 'multi'
        ? STORYBOARD_GEN_CONFIG_SCENE_CODES.videoPrompt
        : STORYBOARD_GEN_CONFIG_SCENE_CODES.videoPromptImage
    return resolveStoryboardGenConfigLlmFields(
      projectId,
      sceneCode,
      manualPromptAgentModelPick,
      resolveVideoPromptAgentCode(),
      resolveVideoPromptModelCode()
    )
  }

  /** 图生出片请求体：自动批量不传 modelName，由 main_storyboard_video_image 池 + 后端兜底 */
  function buildImageVideoGenerateBody(storyboardIds: number[]): StoryboardVideoImageGenerateRequest {
    const settings = creationStore.storyboardVideoGenerateSettings
    const modelName = String(settings.videoModel || '').trim()
    const isSingle = storyboardIds.length === 1
    return {
      storyboardIds,
      ...(manualVideoModelPick && modelName ? { modelName } : {}),
      aspectRatio: settings.aspectRatio || undefined,
      ...(isSingle ? { count: 1 } : {}),
      generateAudio: settings.soundEffects === 'with-sound'
    }
  }

  /** 多参出片请求体：自动批量不传 modelName，由 main_storyboard_video 池 + 后端兜底 */
  function buildMultiVideoGenerateBody(storyboardIds: number[]): StoryboardVideoGenerateRequest {
    const settings = creationStore.storyboardVideoGenerateSettings
    const modelName = String(settings.videoModel || '').trim()
    const isSingle = storyboardIds.length === 1
    return {
      storyboardIds,
      ...(manualVideoModelPick && modelName ? { modelName } : {}),
      aspectRatio: settings.aspectRatio || undefined,
      ...(isSingle ? { count: 1 } : {}),
      generateAudio: settings.soundEffects === 'with-sound'
    }
  }

  function collectPairs(
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

  function markPanelsGenerating(storyboardIds: number[]) {
    for (const sid of storyboardIds) {
      creationStore.setStoryboardPanelVideoGenStatus(sid, 'generating')
    }
  }

  function clearPanelGeneratingStatuses(storyboardIds: number[]) {
    for (const sid of storyboardIds) {
      creationStore.clearStoryboardPanelVideoGenStatus(sid)
    }
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
      return {
        ...p,
        generating: generating || storeGenerating,
        generateError: generating || storeGenerating ? undefined : p.generateError
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
    const totalFromSteps =
      typeof p.stepTotal === 'number' && p.stepTotal > 0 ? p.stepTotal : null
    const completedFromSteps =
      typeof p.stepIndex === 'number' && p.stepIndex >= 0 ? p.stepIndex : null

    if (totalFromSteps != null && completedFromSteps != null) {
      creationStore.setStoryboardVideoBatchProgress(completedFromSteps, totalFromSteps)
      return
    }

    const percent = typeof p.progress === 'number' ? p.progress : null
    const cur = creationStore.storyboardVideoBatchProgress
    const total = Math.max(cur.total || 1, 1)
    if (percent != null) {
      const completed = Math.min(total, Math.max(0, Math.round((percent / 100) * total)))
      creationStore.setStoryboardVideoBatchProgress(completed, total)
    }
  }

  async function seedProgressFromTaskDetail(taskId: number, fallbackTotal: number) {
    try {
      const detail = await userTaskDetail({ taskId })
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

  async function fetchStoryboardVideosForPanel(
    storyboardId: number,
    panelTitle: string
  ): Promise<NonNullable<StoryboardVideoPanel['videos']>> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return []
    const rows = await fetchStoryboardRecordsForStoryboard(ctx, storyboardId, 'video')
    const succeeded = rows.filter((r) => !!String(r?.fileUrl ?? '').trim())
    if (!succeeded.length) return []

    const latest = succeeded[succeeded.length - 1]!
    try {
      await userStoryboardSetFinal({
        storyboardId,
        recordId: latest.id,
        recordType: 'video'
      })
    } catch {
      /* 设为主视频失败不阻断列表展示 */
    }

    return succeeded.map((r) => ({
      ...mapRecordToPanelVideo(r, panelTitle),
      isStoryboardVideo: r.id === latest.id
    }))
  }

  async function refreshPanelsVideosForPairs(
    pairs: StoryboardVideoPair[],
    working: StoryboardVideoPanel[],
    options?: { onlyUpToStepIndex?: number }
  ): Promise<StoryboardVideoPanel[]> {
    const next = [...working]
    const limit = options?.onlyUpToStepIndex
    for (const pair of pairs) {
      if (limit != null && pair.index >= limit) continue
      const panelTitle = pair.video?.title || pair.script.title || `分镜视频${pair.index + 1}`
      try {
        const videos = await fetchStoryboardVideosForPanel(pair.storyboardId, panelTitle)
        if (videos.length) {
          next[pair.index] = {
            ...next[pair.index]!,
            generating: false,
            generateError: undefined,
            videos
          }
          creationStore.setStoryboardPanelVideoGenStatus(pair.storyboardId, 'success')
        }
      } catch {
        /* 单镜刷新失败不阻断 */
      }
    }
    return next
  }

  async function refreshPanelsAfterVideoBatch(
    pairs: StoryboardVideoPair[],
    working: StoryboardVideoPanel[],
    failedStoryboardIds?: Set<number>
  ): Promise<StoryboardVideoPanel[]> {
    const next = [...working]
    for (const pair of pairs) {
      const panelTitle = pair.video?.title || pair.script.title || `分镜视频${pair.index + 1}`
      if (failedStoryboardIds?.has(pair.storyboardId)) {
        next[pair.index] = {
          ...next[pair.index]!,
          generating: false,
          generateError: '视频生成失败',
          videos: []
        }
        creationStore.setStoryboardPanelVideoGenStatus(pair.storyboardId, 'failed')
        continue
      }
      try {
        const videos = await fetchStoryboardVideosForPanel(pair.storyboardId, panelTitle)
        if (videos.length) {
          next[pair.index] = {
            ...next[pair.index]!,
            generating: false,
            generateError: undefined,
            videos
          }
          creationStore.setStoryboardPanelVideoGenStatus(pair.storyboardId, 'success')
        } else {
          next[pair.index] = {
            ...next[pair.index]!,
            generating: false,
            generateError: '视频生成完成，但未获取到视频文件',
            videos: []
          }
          creationStore.setStoryboardPanelVideoGenStatus(pair.storyboardId, 'failed')
        }
      } catch (e: unknown) {
        next[pair.index] = {
          ...next[pair.index]!,
          generating: false,
          generateError: bizErr(e) || '获取生成记录失败',
          videos: []
        }
        creationStore.setStoryboardPanelVideoGenStatus(pair.storyboardId, 'failed')
      }
    }
    return next
  }

  async function trackPromptTaskUntilDone(
    stream: ReturnType<typeof useTaskStream>
  ): Promise<{ ok: boolean; partial?: boolean; message?: string; taskId?: number }> {
    const taskId = activePromptTaskId.value
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
        return { ok: false, message: res.errorMessage || '视频提示词生成失败' }
      }
      if (res.type === 'partial_failed') {
        return {
          ok: false,
          partial: true,
          taskId,
          message: '部分视频提示词生成失败，可续生'
        }
      }
      return { ok: true, taskId }
    } finally {
      closePromptStream()
    }
  }

  async function followPromptTask(
    taskId: number,
    storyboardIds: number[],
    options?: { progressTotalHint?: number }
  ): Promise<{ ok: boolean; partial?: boolean; message?: string; taskId?: number }> {
    stopRequested = false
    const routeCtx = captureCreationLiveGenScope()
    syncActivePromptTaskIdToStore(taskId)
    creationStore.setGeneratingStoryboardVideo(true)
    creationStore.setStoryboardVideoBatchError(null)

    const progressTotal = Math.max(
      options?.progressTotalHint ?? 0,
      creationStore.storyboardVideoBatchProgress.total || 0,
      storyboardIds.length,
      1
    )
    if (!creationStore.storyboardVideoBatchProgress.total) {
      creationStore.setStoryboardVideoBatchProgress(0, progressTotal)
    }
    markPanelsGenerating(storyboardIds)
    await seedProgressFromTaskDetail(taskId, progressTotal)

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

    const outcome = await trackPromptTaskUntilDone(stream)
    stopWatchProgress()
    if (!outcome.partial) {
      syncActivePromptTaskIdToStore(null)
    }

    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }

    if (!matchesCreationLiveGenScope(routeCtx)) {
      creationStore.mergeStep4PlusLiveGenForScopeKey(routeCtx.scopeKey, {
        isGeneratingStoryboardVideo: false,
        storyboardVideoBatchProgress: { completed: 0, total: 0 },
        storyboardVideoBatchError: null,
        storyboardVideoBatchActivePromptTaskId: null,
        storyboardVideoBatchActiveVideoTaskId: null,
        storyboardPanelVideoGenStatusByStoryboardId: {}
      })
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    return outcome
  }

  async function submitSingleVideoPrompt(storyboardId: number): Promise<{
    ok: boolean
    message?: string
  }> {
    const unsupported = videoBatchUnsupportedMessage()
    if (unsupported) return { ok: false, message: unsupported }

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
    }

    const promptBody = {
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      storyboardIds: [storyboardId],
      ...(await buildVideoPromptSubmitFields(ctx.projectId))
    }

    let submitted:
      | Awaited<ReturnType<typeof userStoryboardGenerateVideoPromptImage>>
      | Awaited<ReturnType<typeof userStoryboardGenerateVideoPrompt>>
    try {
      submitted =
        resolveVideoGenerateRoute() === 'multi'
          ? await userStoryboardGenerateVideoPrompt(promptBody)
          : await userStoryboardGenerateVideoPromptImage(promptBody)
    } catch (e: unknown) {
      return { ok: false, message: bizErr(e) }
    }

    const taskId = parseTaskId(submitted.taskId)
    if (!taskId) {
      return { ok: false, message: '提交失败：未返回任务ID' }
    }

    let outcome = await awaitStoryboardPromptGenerateTask(taskId)
    if (outcome.ok === false) {
      return { ok: false, message: outcome.errorMessage }
    }
    if (outcome.ok && 'partial' in outcome && outcome.partial) {
      outcome = await resumeStoryboardPromptGenerateTask(taskId, 'video')
      if (outcome.ok === false) {
        return { ok: false, message: outcome.errorMessage }
      }
    }
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
    return { ok: true }
  }

  async function runBatchVideoPrompt(overwrite: boolean): Promise<{
    ok: boolean
    partial?: boolean
    taskId?: number
    message?: string
  }> {
    stopRequested = false
    const unsupported = videoBatchUnsupportedMessage()
    if (unsupported) return { ok: false, message: unsupported }

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
    }

    const promptBody = {
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      ...(await buildVideoPromptSubmitFields(ctx.projectId)),
      overwrite
    }

    let submitted:
      | Awaited<ReturnType<typeof userStoryboardGenerateVideoPromptImage>>
      | Awaited<ReturnType<typeof userStoryboardGenerateVideoPrompt>>
    try {
      submitted =
        resolveVideoGenerateRoute() === 'multi'
          ? await userStoryboardGenerateVideoPrompt(promptBody)
          : await userStoryboardGenerateVideoPromptImage(promptBody)
    } catch (e: unknown) {
      return { ok: false, message: bizErr(e) }
    }

    const taskId = parseTaskId(submitted.taskId)
    if (!taskId) {
      return { ok: false, message: '提交失败：未返回任务ID' }
    }

    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }

    const storyboardIds = (creationStore.formData.storyboardScript.panels as StoryboardPanel[])
      .map((p) => parseServerStoryboardId(p.id))
      .filter((id): id is number => id != null)

    const progressTotal =
      Number(submitted.totalShots) > 0 ? Number(submitted.totalShots) : storyboardIds.length

    let outcome = await followPromptTask(taskId, storyboardIds, {
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
        } else {
          syncActivePromptTaskIdToStore(outcome.taskId)
          return { ok: true, partial: true, taskId: outcome.taskId, message: partialWarning }
        }
      } else {
        return { ok: false, message: outcome.message || '视频提示词生成失败' }
      }
    }

    return { ok: true, taskId }
  }

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
    creationStore.setStoryboardVideoBatchProgress(0, videoTotal)
    markPanelsGenerating(storyboardIds)

    const unsupported = videoBatchUnsupportedMessage()
    if (unsupported) {
      clearPanelGeneratingStatuses(storyboardIds)
      return { ok: false, message: unsupported }
    }

    let lastRefreshStepIndex = -1
    let working = workingPanels ? [...workingPanels] : null

    const videoRoute = resolveVideoGenerateRoute()
    const body =
      videoRoute === 'multi'
        ? buildMultiVideoGenerateBody(storyboardIds)
        : buildImageVideoGenerateBody(storyboardIds)
    let result =
      videoRoute === 'multi'
        ? await runStoryboardMultiVideoGenerateTask({
            body,
            onSubmitted: ({ taskId }) => {
              syncActiveVideoTaskIdToStore(taskId)
            },
            onProgress: (p) => {
              if (!matchesCreationLiveGenScope(routeCtx)) return
              const stepIndex =
                typeof (p as { stepIndex?: number }).stepIndex === 'number'
                  ? Number((p as { stepIndex?: number }).stepIndex)
                  : null
              if (stepIndex != null && stepIndex > lastRefreshStepIndex) {
                lastRefreshStepIndex = stepIndex
                creationStore.setStoryboardVideoBatchProgress(
                  Math.min(videoTotal, Math.max(0, stepIndex)),
                  videoTotal
                )
                if (working && onPanelsUpdate) {
                  void refreshPanelsVideosForPairs(pairs, working, {
                    onlyUpToStepIndex: stepIndex
                  }).then((next) => {
                    if (!matchesCreationLiveGenScope(routeCtx) || !working) return
                    working = next
                    onPanelsUpdate(next)
                  })
                }
              } else if (typeof p.percent === 'number') {
                const completed = Math.min(
                  videoTotal,
                  Math.max(0, Math.round((p.percent / 100) * videoTotal))
                )
                creationStore.setStoryboardVideoBatchProgress(completed, videoTotal)
              }
            }
          })
        : await runStoryboardImageVideoGenerateTask({
            body,
            onSubmitted: ({ taskId }) => {
              syncActiveVideoTaskIdToStore(taskId)
            },
            onProgress: (p) => {
              if (!matchesCreationLiveGenScope(routeCtx)) return
              const stepIndex =
                typeof (p as { stepIndex?: number }).stepIndex === 'number'
                  ? Number((p as { stepIndex?: number }).stepIndex)
                  : null
              if (stepIndex != null && stepIndex > lastRefreshStepIndex) {
                lastRefreshStepIndex = stepIndex
                creationStore.setStoryboardVideoBatchProgress(
                  Math.min(videoTotal, Math.max(0, stepIndex)),
                  videoTotal
                )
                if (working && onPanelsUpdate) {
                  void refreshPanelsVideosForPairs(pairs, working, {
                    onlyUpToStepIndex: stepIndex
                  }).then((next) => {
                    if (!matchesCreationLiveGenScope(routeCtx) || !working) return
                    working = next
                    onPanelsUpdate(next)
                  })
                }
              } else if (typeof p.percent === 'number') {
                const completed = Math.min(
                  videoTotal,
                  Math.max(0, Math.round((p.percent / 100) * videoTotal))
                )
                creationStore.setStoryboardVideoBatchProgress(completed, videoTotal)
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
            if (typeof p.percent === 'number') {
              const completed = Math.min(
                videoTotal,
                Math.max(0, Math.round((p.percent / 100) * videoTotal))
              )
              creationStore.setStoryboardVideoBatchProgress(completed, videoTotal)
            }
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
    const unsupported = videoBatchUnsupportedMessage()
    if (unsupported) return { ok: false, message: unsupported }

    const routeCtx = captureCreationLiveGenScope()

    const pairs = collectPairs(payload.scriptPanels, payload.videoPanels)
    if (!pairs.length) {
      return { ok: false, message: '分镜尚未保存到服务器，请先生成分镜脚本' }
    }

    const storyboardIds = pairs.map((p) => p.storyboardId)
    creationStore.setGeneratingStoryboardVideo(true)
    creationStore.setStoryboardVideoBatchError(null)
    creationStore.setStoryboardVideoBatchProgress(0, storyboardIds.length)
    markPanelsGenerating(storyboardIds)

    let working = applyPanelsGeneratingToLocal(payload.videoPanels, payload.scriptPanels, true)
    payload.onPanelsUpdate(working)

    const promptOutcome = await runBatchVideoPrompt(payload.overwritePrompt)
    if (!matchesCreationLiveGenScope(routeCtx)) {
      creationStore.stopStoryboardVideoBatchGeneration()
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }
    if (stopRequested) {
      working = working.map((p) => ({ ...p, generating: false }))
      payload.onPanelsUpdate(working)
      clearPanelGeneratingStatuses(storyboardIds)
      creationStore.stopStoryboardVideoBatchGeneration()
      return { ok: false, message: '已停止生成' }
    }
    if (!promptOutcome.ok) {
      working = working.map((p) => ({
        ...p,
        generating: false,
        generateError: promptOutcome.message
      }))
      payload.onPanelsUpdate(working)
      clearPanelGeneratingStatuses(storyboardIds)
      creationStore.setStoryboardVideoBatchError(promptOutcome.message || null)
      creationStore.setGeneratingStoryboardVideo(false)
      return { ok: false, message: promptOutcome.message || '视频提示词生成失败' }
    }

    if (stopRequested || !matchesCreationLiveGenScope(routeCtx)) {
      working = working.map((p) => ({ ...p, generating: false }))
      payload.onPanelsUpdate(working)
      clearPanelGeneratingStatuses(storyboardIds)
      creationStore.stopStoryboardVideoBatchGeneration()
      return { ok: false, message: stopRequested ? '已停止生成' : '已切换作品' }
    }

    const videoOutcome = await generateVideosBatch(pairs, payload.onPanelsUpdate, working)
    if (!matchesCreationLiveGenScope(routeCtx)) {
      creationStore.stopStoryboardVideoBatchGeneration()
      return { ok: false, message: '已切换作品' }
    }

    if (!videoOutcome.ok) {
      working = working.map((p) => ({
        ...p,
        generating: false,
        generateError: videoOutcome.message
      }))
      payload.onPanelsUpdate(working)
      clearPanelGeneratingStatuses(storyboardIds)
      creationStore.setStoryboardVideoBatchError(videoOutcome.message || null)
      creationStore.setGeneratingStoryboardVideo(false)
      return { ok: false, message: videoOutcome.message || '视频生成失败' }
    }

    working = await refreshPanelsAfterVideoBatch(pairs, working)
    payload.onPanelsUpdate(working)

    clearPanelGeneratingStatuses(storyboardIds)
    creationStore.setGeneratingStoryboardVideo(false)

    if (stopRequested) {
      return { ok: false, message: '已停止生成' }
    }
    if (videoOutcome.partial || working.some((p) => p.generateError)) {
      return { ok: false, message: '部分分镜视频生成失败，可点击重新生成重试' }
    }
    return { ok: true }
  }

  async function regenerateSinglePanel(payload: {
    scriptPanel: StoryboardPanel
    videoPanel: StoryboardVideoPanel
    manualVideoModelPick?: boolean
    onPanelUpdate: (panel: StoryboardVideoPanel) => void
  }): Promise<{ ok: boolean; message?: string }> {
    const storyboardId = parseServerStoryboardId(payload.scriptPanel.id)
    if (storyboardId == null) {
      return { ok: false, message: '分镜尚未保存到服务器' }
    }

    const unsupported = videoBatchUnsupportedMessage()
    if (unsupported) return { ok: false, message: unsupported }

    setManualVideoModelPick(payload.manualVideoModelPick === true)
    stopRequested = false
    const routeCtx = captureCreationLiveGenScope()
    creationStore.setGeneratingStoryboardVideo(true)
    creationStore.setStoryboardPanelVideoGenStatus(storyboardId, 'generating')

    let panel: StoryboardVideoPanel = {
      ...payload.videoPanel,
      generating: true,
      generateError: undefined,
      videos: []
    }
    payload.onPanelUpdate(panel)

    const promptOutcome = await submitSingleVideoPrompt(storyboardId)
    if (!matchesCreationLiveGenScope(routeCtx) || stopRequested) {
      panel = { ...panel, generating: false }
      payload.onPanelUpdate(panel)
      creationStore.clearStoryboardPanelVideoGenStatus(storyboardId)
      creationStore.setGeneratingStoryboardVideo(false)
      return { ok: false, message: stopRequested ? '已停止生成' : '已切换作品' }
    }
    if (!promptOutcome.ok) {
      panel = { ...panel, generating: false, generateError: promptOutcome.message }
      payload.onPanelUpdate(panel)
      creationStore.setStoryboardPanelVideoGenStatus(storyboardId, 'failed')
      creationStore.setGeneratingStoryboardVideo(false)
      return { ok: false, message: promptOutcome.message }
    }

    const pair: StoryboardVideoPair = {
      script: payload.scriptPanel,
      video: payload.videoPanel,
      index: 0,
      storyboardId
    }
    const videoOutcome = await generateVideosBatch([pair])
    const panelTitle = panel.title || payload.scriptPanel.title || '分镜视频'

    if (videoOutcome.ok) {
      const videos = await fetchStoryboardVideosForPanel(storyboardId, panelTitle)
      if (videos.length) {
        panel = {
          ...panel,
          generating: false,
          generateError: undefined,
          videos
        }
        creationStore.setStoryboardPanelVideoGenStatus(storyboardId, 'success')
      } else {
        panel = {
          ...panel,
          generating: false,
          generateError: '视频生成完成，但未获取到视频文件',
          videos: []
        }
        creationStore.setStoryboardPanelVideoGenStatus(storyboardId, 'failed')
      }
    } else {
      panel = {
        ...panel,
        generating: false,
        generateError: videoOutcome.message || '视频生成失败',
        videos: []
      }
      creationStore.setStoryboardPanelVideoGenStatus(storyboardId, 'failed')
    }
    payload.onPanelUpdate(panel)
    creationStore.clearStoryboardPanelVideoGenStatus(storyboardId)
    creationStore.setGeneratingStoryboardVideo(false)

    if (!videoOutcome.ok) {
      return { ok: false, message: videoOutcome.message }
    }
    return { ok: true }
  }

  async function runBatchVideosOnly(payload: {
    scriptPanels: StoryboardPanel[]
    videoPanels: StoryboardVideoPanel[]
    manualVideoModelPick?: boolean
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void
  }): Promise<{ ok: boolean; message?: string }> {
    setManualVideoModelPick(payload.manualVideoModelPick === true)
    stopRequested = false
    const unsupported = videoBatchUnsupportedMessage()
    if (unsupported) return { ok: false, message: unsupported }

    const routeCtx = captureCreationLiveGenScope()

    const pairs = collectPairs(payload.scriptPanels, payload.videoPanels)
    if (!pairs.length) {
      return { ok: false, message: '分镜尚未保存到服务器，请先生成分镜脚本' }
    }

    const storyboardIds = pairs.map((p) => p.storyboardId)
    creationStore.setGeneratingStoryboardVideo(true)
    creationStore.setStoryboardVideoBatchError(null)
    creationStore.setStoryboardVideoBatchProgress(0, storyboardIds.length)
    markPanelsGenerating(storyboardIds)

    let working = applyPanelsGeneratingToLocal(payload.videoPanels, payload.scriptPanels, true)
    payload.onPanelsUpdate(working)

    if (stopRequested || !matchesCreationLiveGenScope(routeCtx)) {
      working = working.map((p) => ({ ...p, generating: false }))
      payload.onPanelsUpdate(working)
      clearPanelGeneratingStatuses(storyboardIds)
      creationStore.stopStoryboardVideoBatchGeneration()
      return { ok: false, message: '已停止生成' }
    }

    const videoOutcome = await generateVideosBatch(pairs, payload.onPanelsUpdate, working)
    if (!matchesCreationLiveGenScope(routeCtx)) {
      creationStore.stopStoryboardVideoBatchGeneration()
      return { ok: false, message: '已切换作品' }
    }

    if (!videoOutcome.ok) {
      working = working.map((p) => ({
        ...p,
        generating: false,
        generateError: videoOutcome.message
      }))
      payload.onPanelsUpdate(working)
      clearPanelGeneratingStatuses(storyboardIds)
      creationStore.setStoryboardVideoBatchError(videoOutcome.message || null)
      creationStore.setGeneratingStoryboardVideo(false)
      return { ok: false, message: videoOutcome.message || '视频生成失败' }
    }

    working = await refreshPanelsAfterVideoBatch(pairs, working)
    payload.onPanelsUpdate(working)

    clearPanelGeneratingStatuses(storyboardIds)
    creationStore.setGeneratingStoryboardVideo(false)

    if (stopRequested) {
      return { ok: false, message: '已停止生成' }
    }
    if (videoOutcome.partial || working.some((p) => p.generateError)) {
      return { ok: false, message: '部分分镜视频生成失败，可点击重新生成重试' }
    }
    return { ok: true }
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
        (t) => t && isStoryboardVideoGenerateTaskType(t.taskType) && isOngoingUserTaskStatus(t.status)
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

  async function followOngoingVideoGenerateTask(
    taskId: number,
    pairs: StoryboardVideoPair[],
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void,
    workingPanels: StoryboardVideoPanel[]
  ): Promise<{ ok: boolean; message?: string }> {
    const routeCtx = captureCreationLiveGenScope()
    const storyboardIds = pairs.map((p) => p.storyboardId)
    const videoTotal = storyboardIds.length

    creationStore.setGeneratingStoryboardVideo(true)
    markPanelsGenerating(storyboardIds)
    syncActiveVideoTaskIdToStore(taskId)
    if (!creationStore.storyboardVideoBatchProgress.total) {
      creationStore.setStoryboardVideoBatchProgress(0, videoTotal)
    }
    await seedProgressFromTaskDetail(taskId, videoTotal)

    let working = applyPanelsGeneratingToLocal(workingPanels, pairs.map((p) => p.script), true)
    onPanelsUpdate(working)

    let lastRefreshStepIndex = -1
    const result = await followStoryboardVideoGenerateTask({
      taskId,
      onProgress: (p) => {
        if (!matchesCreationLiveGenScope(routeCtx)) return
        const stepIndex =
          typeof (p as { stepIndex?: number }).stepIndex === 'number'
            ? Number((p as { stepIndex?: number }).stepIndex)
            : null
        if (stepIndex != null && stepIndex > lastRefreshStepIndex) {
          lastRefreshStepIndex = stepIndex
          creationStore.setStoryboardVideoBatchProgress(
            Math.min(videoTotal, Math.max(0, stepIndex)),
            videoTotal
          )
          void refreshPanelsVideosForPairs(pairs, working, {
            onlyUpToStepIndex: stepIndex
          }).then((next) => {
            if (!matchesCreationLiveGenScope(routeCtx)) return
            working = next
            onPanelsUpdate(next)
          })
        } else if (typeof p.percent === 'number') {
          const completed = Math.min(
            videoTotal,
            Math.max(0, Math.round((p.percent / 100) * videoTotal))
          )
          creationStore.setStoryboardVideoBatchProgress(completed, videoTotal)
        }
      }
    })

    syncActiveVideoTaskIdToStore(null)

    if (!matchesCreationLiveGenScope(routeCtx)) {
      return { ok: false, message: '已切换作品' }
    }

    if (!result.ok) {
      clearPanelGeneratingStatuses(storyboardIds)
      return {
        ok: false,
        message: 'errorMessage' in result ? result.errorMessage : '视频生成失败'
      }
    }

    working = await refreshPanelsAfterVideoBatch(pairs, working)
    onPanelsUpdate(working)
    clearPanelGeneratingStatuses(storyboardIds)
    creationStore.setStoryboardVideoBatchProgress(videoTotal, videoTotal)
    return { ok: true }
  }

  function isBatchVideoGenerateTaskId(taskId: number): boolean {
    const batchId = creationStore.storyboardVideoBatchActiveVideoTaskId
    return batchId != null && batchId === taskId
  }

  function getPendingModalVideoTaskEntries(): [string, { taskId: number; sceneIdx: number; taskKind: 'i2v' | 'multi' }][] {
    const scopeKey = creationStore.step3GenVisualScopeKey()
    const scopeBlob = creationStore.step4PlusLiveGenByScope[scopeKey]
    return Object.entries(scopeBlob?.storyboardVideoGenTasksByStoryboardId || {}) as [
      string,
      { taskId: number; sceneIdx: number; taskKind: 'i2v' | 'multi' }
    ][]
  }

  /** 弹窗单条生视频：仅步骤条 loading + 后台续跟，外层列表卡片不展示 generating */
  async function restoreModalSingleVideoGenerates(
    gen: number,
    pairs: StoryboardVideoPair[],
    videoPanels: StoryboardVideoPanel[],
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void,
    entries: [string, { taskId: number; sceneIdx: number; taskKind: 'i2v' | 'multi' }][]
  ): Promise<void> {
    if (!entries.length) {
      if (creationStore.isGeneratingStoryboardVideo) {
        creationStore.setGeneratingStoryboardVideo(false)
      }
      return
    }

    creationStore.setGeneratingStoryboardVideo(true)

    if (!creationStore.storyboardVideoBatchActiveVideoTaskId) {
      clearPanelGeneratingStatuses(pairs.map((p) => p.storyboardId))
    }

    let working = videoPanels.map((p) => ({ ...p, generating: false }))
    if (videoPanels.some((p) => p.generating)) {
      onPanelsUpdate([...working])
    }

    for (const [sidRaw, snap] of entries) {
      if (gen !== resumeFollowGeneration) return

      const sid = Number(sidRaw)
      const tid = Number(snap?.taskId)
      if (!Number.isFinite(tid) || tid <= 0) continue

      const pair =
        Number.isFinite(sid) && sid > 0
          ? pairs.find((p) => p.storyboardId === sid)
          : pairs[Number(snap?.sceneIdx)] ?? null
      if (!pair) continue

      activeStoryboardVideoModalRestoreFollowIds.add(pair.storyboardId)
      try {
        const result = await followStoryboardVideoGenerateTask({ taskId: tid })
        creationStore.clearStoryboardVideoGenTask(pair.storyboardId)

        if (result.ok) {
          const panelTitle = pair.video?.title || pair.script.title || `分镜视频${pair.index + 1}`
          const videos = await fetchStoryboardVideosForPanel(pair.storyboardId, panelTitle)
          if (videos.length) {
            working[pair.index] = {
              ...working[pair.index]!,
              generating: false,
              generateError: undefined,
              videos
            }
            onPanelsUpdate([...working])
          }
        }
      } finally {
        activeStoryboardVideoModalRestoreFollowIds.delete(pair.storyboardId)
        if (import.meta.client) {
          window.dispatchEvent(
            new CustomEvent('create-flow-storyboard-video-gen-settled', {
              detail: { storyboardId: pair.storyboardId }
            })
          )
        }
      }
    }

    creationStore.setGeneratingStoryboardVideo(false)
  }

  async function restoreOngoingBatchIfNeeded(
    scriptPanels: StoryboardPanel[],
    videoPanels: StoryboardVideoPanel[],
    onPanelsUpdate: (panels: StoryboardVideoPanel[]) => void
  ): Promise<void> {
    if (typeof window === 'undefined') return
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return

    const gen = ++resumeFollowGeneration
    const pairs = collectPairs(scriptPanels, videoPanels)
    const storyboardIds = pairs.map((p) => p.storyboardId)

    let tasks: UserTaskRow[] = []
    try {
      tasks = await userTaskList({ projectId: ctx.projectId })
    } catch {
      tasks = []
    }
    if (gen !== resumeFollowGeneration) return

    const preferredPromptId = creationStore.storyboardVideoBatchActivePromptTaskId
    const ongoingPromptTask = pickOngoingVideoPromptBatchTask(tasks, preferredPromptId)
    const ongoingPromptId = parseTaskId(ongoingPromptTask?.id)

    if (ongoingPromptId != null) {
      if (gen !== resumeFollowGeneration) return
      let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
      onPanelsUpdate(working)

      const promptOutcome = await followPromptTask(ongoingPromptId, storyboardIds)
      if (gen !== resumeFollowGeneration) return

      if (!promptOutcome.ok && !promptOutcome.partial) {
        creationStore.setGeneratingStoryboardVideo(false)
        clearPanelGeneratingStatuses(storyboardIds)
        return
      }

      const preferredVideoId = creationStore.storyboardVideoBatchActiveVideoTaskId
      const ongoingVideoTask = pickOngoingVideoGenerateTask(tasks, preferredVideoId)
      const ongoingVideoId = parseTaskId(ongoingVideoTask?.id)

      if (ongoingVideoId != null) {
        await followOngoingVideoGenerateTask(ongoingVideoId, pairs, onPanelsUpdate, working)
      } else if (promptOutcome.ok) {
        const videoOutcome = await generateVideosBatch(pairs, onPanelsUpdate, working)
        if (gen !== resumeFollowGeneration) return
        if (videoOutcome.ok) {
          working = await refreshPanelsAfterVideoBatch(pairs, working)
          onPanelsUpdate(working)
        }
      }

      clearPanelGeneratingStatuses(storyboardIds)
      creationStore.setGeneratingStoryboardVideo(false)
      return
    }

    const preferredVideoId = creationStore.storyboardVideoBatchActiveVideoTaskId
    const ongoingVideoTask = pickOngoingVideoGenerateTask(tasks, preferredVideoId)
    const ongoingVideoId = parseTaskId(ongoingVideoTask?.id)

    if (ongoingVideoId != null) {
      if (gen !== resumeFollowGeneration) return

      if (!isBatchVideoGenerateTaskId(ongoingVideoId)) {
        const pendingEntries = getPendingModalVideoTaskEntries().filter(
          ([, snap]) => Number(snap?.taskId) === ongoingVideoId
        )
        const entries =
          pendingEntries.length > 0
            ? pendingEntries
            : ([
                [
                  '',
                  { taskId: ongoingVideoId, sceneIdx: 0, taskKind: 'i2v' as const }
                ]
              ] as [string, { taskId: number; sceneIdx: number; taskKind: 'i2v' | 'multi' }][])
        await restoreModalSingleVideoGenerates(gen, pairs, videoPanels, onPanelsUpdate, entries)
        return
      }

      let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
      onPanelsUpdate(working)
      await followOngoingVideoGenerateTask(ongoingVideoId, pairs, onPanelsUpdate, working)
      clearPanelGeneratingStatuses(storyboardIds)
      creationStore.setGeneratingStoryboardVideo(false)
      return
    }

    const persistedGenerating = Object.entries(
      creationStore.storyboardPanelVideoGenStatusByStoryboardId
    ).filter(([, st]) => st === 'generating')

    const pendingVideoTasks = getPendingModalVideoTaskEntries()

    if (!persistedGenerating.length && !pendingVideoTasks.length) {
      if (creationStore.isGeneratingStoryboardVideo) {
        creationStore.stopStoryboardVideoBatchGeneration()
      }
      return
    }

    if (pendingVideoTasks.length && !creationStore.storyboardVideoBatchActiveVideoTaskId) {
      if (gen !== resumeFollowGeneration) return
      await restoreModalSingleVideoGenerates(
        gen,
        pairs,
        videoPanels,
        onPanelsUpdate,
        pendingVideoTasks
      )
      return
    }

    if (gen !== resumeFollowGeneration) return
    creationStore.setGeneratingStoryboardVideo(true)
    let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
    onPanelsUpdate(working)

    for (const [sidRaw, snap] of pendingVideoTasks) {
      const sid = Number(sidRaw)
      const tid = Number(snap?.taskId)
      if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(tid) || tid <= 0) continue
      if (gen !== resumeFollowGeneration) return

      const pair = pairs.find((p) => p.storyboardId === sid)
      if (!pair) continue

      creationStore.setStoryboardPanelVideoGenStatus(sid, 'generating')
      const result = await followStoryboardVideoGenerateTask({ taskId: tid })
      creationStore.clearStoryboardVideoGenTask(sid)

      if (result.ok) {
        const panelTitle = pair.video?.title || pair.script.title || `分镜视频${pair.index + 1}`
        const videos = await fetchStoryboardVideosForPanel(sid, panelTitle)
        if (videos.length) {
          working[pair.index] = {
            ...working[pair.index]!,
            generating: false,
            generateError: undefined,
            videos
          }
          creationStore.setStoryboardPanelVideoGenStatus(sid, 'success')
        } else {
          creationStore.setStoryboardPanelVideoGenStatus(sid, 'failed')
        }
      } else {
        creationStore.setStoryboardPanelVideoGenStatus(sid, 'failed')
      }
      onPanelsUpdate([...working])
    }

    creationStore.setGeneratingStoryboardVideo(false)
    clearPanelGeneratingStatuses(storyboardIds)
  }

  async function requestStop() {
    stopRequested = true
    closePromptStream()
    const promptTaskId =
      activePromptTaskId.value ?? creationStore.storyboardVideoBatchActivePromptTaskId
    const videoTaskId = creationStore.storyboardVideoBatchActiveVideoTaskId
    const taskId = promptTaskId ?? videoTaskId
    if (taskId) {
      try {
        await userTaskCancel({ taskId })
      } catch {
        /* ignore */
      }
    }
    syncActivePromptTaskIdToStore(null)
    syncActiveVideoTaskIdToStore(null)
    creationStore.stopStoryboardVideoBatchGeneration()
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
    const ty = String(detail?.taskType ?? '').trim().toLowerCase().replace(/-/g, '_')
    const id = parseTaskId(detail?.taskId)
    if (!id) return

    const pairs = collectPairs(scriptPanels, videoPanels)
    const storyboardIds = pairs.map((p) => p.storyboardId)

    if (ty === 'storyboard_video_prompt_batch') {
      void (async () => {
        const promptOutcome = await followPromptTask(id, storyboardIds)
        if (promptOutcome.ok) {
          let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
          onPanelsUpdate(working)
          const videoOutcome = await generateVideosBatch(pairs, onPanelsUpdate, working)
          if (videoOutcome.ok) {
            working = await refreshPanelsAfterVideoBatch(pairs, working)
            onPanelsUpdate(working)
            clearPanelGeneratingStatuses(storyboardIds)
            creationStore.setGeneratingStoryboardVideo(false)
            onDone?.({ ok: true })
            return
          }
        }
        creationStore.setGeneratingStoryboardVideo(false)
        onDone?.({ ok: false, message: promptOutcome.message })
      })()
      return
    }

    if (ty === 'storyboard_video_generate') {
      void (async () => {
        if (!isBatchVideoGenerateTaskId(id)) {
          const pendingEntries = getPendingModalVideoTaskEntries().filter(
            ([, snap]) => Number(snap?.taskId) === id
          )
          const entries =
            pendingEntries.length > 0
              ? pendingEntries
              : ([
                  ['', { taskId: id, sceneIdx: 0, taskKind: 'i2v' as const }]
                ] as [string, { taskId: number; sceneIdx: number; taskKind: 'i2v' | 'multi' }][])
          await restoreModalSingleVideoGenerates(
            resumeFollowGeneration,
            pairs,
            videoPanels,
            onPanelsUpdate,
            entries
          )
          onDone?.({ ok: true })
          return
        }

        let working = applyPanelsGeneratingToLocal(videoPanels, scriptPanels, true)
        onPanelsUpdate(working)
        const outcome = await followOngoingVideoGenerateTask(id, pairs, onPanelsUpdate, working)
        clearPanelGeneratingStatuses(storyboardIds)
        creationStore.setGeneratingStoryboardVideo(false)
        onDone?.({
          ok: outcome.ok,
          message: outcome.message
        })
      })()
    }
  }

  function cancelResumeFollow() {
    resumeFollowGeneration++
    closePromptStream()
    activePromptTaskId.value = null
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
    onGlobalStopTask,
    onGlobalTrackTask,
    cancelResumeFollow
  }
}
