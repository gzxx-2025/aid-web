import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import {
  userStoryboardGenerateImagePrompt,
  userStoryboardList,
  userStoryboardSetFinalImage,
  userTaskCancel,
  userTaskDetail,
  userTaskList
} from '~/utils/businessApi'
import {
  awaitStoryboardPromptGenerateTask,
  resumeStoryboardPromptGenerateTask,
  resolveStoryboardPromptAgentCode,
  resolveStoryboardPromptModelCode
} from '~/utils/storyboardPromptGenerateFlow'
import {
  STORYBOARD_GEN_CONFIG_SCENE_CODES,
  resolveProjectGenImageSubmitFields,
  resolveStoryboardGenConfigLlmFields
} from '~/utils/projectGenConfig'
import {
  fetchUserTaskDetailOnce,
  normalizeTaskStatus
} from '~/composables/useTaskSseFollow'
import {
  isStoryboardImageGenerateResumableStatus,
  isStoryboardImageGenerateTaskType
} from '~/utils/taskPartialFailed'
import {
  runStoryboardImageBatchGenerateTask,
  resumeStoryboardImageGenerateTask,
  followStoryboardImageBatchGenerateTask,
  followStoryboardImageGenerateTask
} from '~/composables/useStoryboardImageGenerateTask'
import { useTaskStream } from '~/composables/useTaskStream'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import { mapStoryboardListRowToPanel } from '~/utils/storyboardPanelMap'
import { resolveStoryboardPanelCoverImage } from '~/utils/storyboardImageCover'
import {
  fetchProjectImageAndVideoRecordMaps,
  hydrateScriptPanelsWithImageRecords
} from '~/utils/storyboardRecordBatch'
import type { StoryboardPanel } from '~/types'
import type { UserTaskRow } from '~/types/business-api'
import type { ProjectEpisodeContext } from '~/utils/storyboardRecordBatch'
import { fetchStoryboardRecordsForStoryboard } from '~/utils/storyboardRecordBatch'

function bizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normStoryboardImagePromptBatchTaskType(ty: unknown): string {
  return String(ty ?? '').trim().toLowerCase().replace(/-/g, '_')
}

function isStoryboardImagePromptBatchTask(ty: unknown): boolean {
  return normStoryboardImagePromptBatchTaskType(ty) === 'storyboard_image_prompt_batch'
}

function isOngoingUserTaskStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase()
  return s === 'PENDING' || s === 'PROCESSING' || s === 'RUNNING' || s === 'QUEUED' || s === 'WAITING'
}

function panelHasCoverImage(panel: StoryboardPanel): boolean {
  return !!resolveStoryboardPanelCoverImage(panel)?.url
}

export function useStoryboardImageBatchGenerate() {
  const route = useRoute()
  const creationStore = useCreationStore()

  const activeTaskId = ref<number | null>(null)
  const activeImageTaskId = ref<number | null>(null)
  let streamCloser: (() => void) | null = null
  let stopRequested = false
  let resumeFollowGeneration = 0

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

  async function setFinalImageForStoryboard(
    ctx: ProjectEpisodeContext,
    storyboardId: number
  ): Promise<boolean> {
    try {
      const rows = await fetchStoryboardRecordsForStoryboard(ctx, storyboardId, 'image')
      const withUrl = rows.filter((r) => String(r?.fileUrl ?? '').trim())
      if (!withUrl.length) return false
      const latest = [...withUrl].sort((a, b) => {
        const ta = String(a.createTime ?? '')
        const tb = String(b.createTime ?? '')
        return tb.localeCompare(ta) || Number(b.id) - Number(a.id)
      })[0]
      const rid = Number(latest?.id)
      if (!Number.isFinite(rid) || rid <= 0) return false
      await userStoryboardSetFinalImage({ storyboardId, recordId: rid })
      return true
    } catch {
      return false
    }
  }

  async function refreshPanelsFromApi(): Promise<StoryboardPanel[]> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return []
    const list = await userStoryboardList({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId
    })
    const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    let panels = sorted.map((row, index) => mapStoryboardListRowToPanel(row, index))
    try {
      const { imageByStoryboardId } = await fetchProjectImageAndVideoRecordMaps(ctx)
      panels = hydrateScriptPanelsWithImageRecords(panels, imageByStoryboardId)
    } catch {
      /* ignore */
    }
    creationStore.updateFormData({ storyboardScript: { panels } })
    return panels
  }

  async function refreshPanelsImagesOnly(
    currentPanels: StoryboardPanel[]
  ): Promise<StoryboardPanel[]> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return currentPanels
    try {
      const { imageByStoryboardId } = await fetchProjectImageAndVideoRecordMaps(ctx)
      const next = hydrateScriptPanelsWithImageRecords(currentPanels, imageByStoryboardId)
      creationStore.updateFormData({ storyboardScript: { panels: next } })
      return next
    } catch {
      return currentPanels
    }
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
      creationStore.setStoryboardImageBatchProgress(completedFromSteps, totalFromSteps)
      return
    }

    const percent = typeof p.progress === 'number' ? p.progress : null
    const cur = creationStore.storyboardImageBatchProgress
    const total = Math.max(cur.total || 1, 1)
    if (percent != null) {
      const completed = Math.min(total, Math.max(0, Math.round((percent / 100) * total)))
      creationStore.setStoryboardImageBatchProgress(completed, total)
    }
  }

  function markPanelsGenerating(storyboardIds: number[]) {
    for (const sid of storyboardIds) {
      creationStore.setStoryboardPanelImageGenStatus(sid, 'generating')
    }
  }

  function clearPanelGeneratingStatuses(storyboardIds: number[]) {
    for (const sid of storyboardIds) {
      creationStore.clearStoryboardPanelImageGenStatus(sid)
    }
  }

  async function seedProgressFromTaskDetail(taskId: number, fallbackTotal: number) {
    try {
      const detail = await userTaskDetail({ taskId })
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
    stream: ReturnType<typeof useTaskStream>
  ): Promise<{ ok: boolean; partial?: boolean; message?: string }> {
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
        return { ok: false, message: res.errorMessage || '批量生成分镜图失败' }
      }
      if (res.type === 'partial_failed') {
        return {
          ok: false,
          partial: true,
          message: '部分分镜图提示词生成失败，可续生'
        }
      }
      return { ok: true }
    } finally {
      closeStream()
    }
  }

  async function followPromptTask(
    taskId: number,
    storyboardIds: number[],
    options?: { progressTotalHint?: number }
  ): Promise<{ ok: boolean; partial?: boolean; message?: string }> {
    stopRequested = false
    const routeCtx = captureCreationLiveGenScope()
    syncActiveTaskIdToStore(taskId)
    creationStore.setStoryboardImageBatchGenerating(true)
    creationStore.setStoryboardImageBatchError(null)

    const progressTotal = Math.max(
      options?.progressTotalHint ?? 0,
      creationStore.storyboardImageBatchProgress.total || 0,
      storyboardIds.length,
      1
    )
    if (!creationStore.storyboardImageBatchProgress.total) {
      creationStore.setStoryboardImageBatchProgress(0, progressTotal)
    }
    markPanelsGenerating(storyboardIds)
    await seedProgressFromTaskDetail(taskId, progressTotal)

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

    const outcome = await trackPromptTaskUntilDone(stream)
    stopWatchProgress()
    if (!outcome.partial) {
      syncActiveTaskIdToStore(null)
    }

    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }

    if (!matchesCreationLiveGenScope(routeCtx)) {
      creationStore.mergeStep4PlusLiveGenForScopeKey(routeCtx.scopeKey, {
        isGeneratingStoryboardImageBatch: false,
        storyboardImageBatchProgress: { completed: 0, total: 0 },
        storyboardImageBatchError: null,
        storyboardImageBatchActiveTaskId: null,
        storyboardImageBatchActiveImageTaskId: null,
        storyboardPanelImageGenStatusByStoryboardId: {}
      })
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    return outcome
  }

  async function generateImagesForPanels(
    panels: StoryboardPanel[],
    overwrite: boolean,
    storyboardIds: number[]
  ): Promise<{ ok: boolean; message?: string; partial?: boolean }> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, message: '缺少项目信息' }
    }

    const targets = storyboardIds.filter((sid) => {
      const panel = panels.find((p) => parseServerStoryboardId(p.id) === sid)
      if (!panel) return false
      if (!overwrite && panelHasCoverImage(panel)) return false
      return true
    })

    if (!targets.length) {
      clearPanelGeneratingStatuses(storyboardIds)
      return { ok: true }
    }

    if (stopRequested) {
      return { ok: false, message: '已停止生成' }
    }

    const routeCtx = captureCreationLiveGenScope()
    const imageTotal = targets.length
    creationStore.setStoryboardImageBatchProgress(0, imageTotal)

    const imageGenFields = await resolveProjectGenImageSubmitFields(
      ctx.projectId,
      STORYBOARD_GEN_CONFIG_SCENE_CODES.image
    )

    const body = {
      storyboardIds: targets,
      count: 1,
      ...(imageGenFields.agentCode ? { agentCode: imageGenFields.agentCode } : {}),
      ...(imageGenFields.modelCode ? { modelName: imageGenFields.modelCode } : {}),
      ...(imageGenFields.aspectRatio ? { aspectRatio: imageGenFields.aspectRatio } : {}),
      ...(imageGenFields.resolution ? { size: imageGenFields.resolution } : {})
    }

    let result = await runStoryboardImageBatchGenerateTask({
      body,
      onSubmitted: ({ taskId }) => {
        syncActiveImageTaskIdToStore(taskId)
      },
      onProgress: (p) => {
        if (!matchesCreationLiveGenScope(routeCtx)) return
        if (typeof p.percent === 'number') {
          const completed = Math.min(
            imageTotal,
            Math.max(0, Math.round((p.percent / 100) * imageTotal))
          )
          creationStore.setStoryboardImageBatchProgress(completed, imageTotal)
        }
      }
    })

    if (!matchesCreationLiveGenScope(routeCtx)) {
      syncActiveImageTaskIdToStore(null)
      return { ok: false, message: '已切换作品，任务仍在后台进行' }
    }

    if (!result.ok) {
      syncActiveImageTaskIdToStore(null)
      clearPanelGeneratingStatuses(storyboardIds)
      return {
        ok: false,
        message: 'errorMessage' in result ? result.errorMessage : '分镜图生成失败'
      }
    }

    if (result.submitWarning) {
      message.warning(`部分分镜未进入出图队列：${result.submitWarning}`)
    }

    const taskId = result.taskId
    const detail = await fetchUserTaskDetailOnce(taskId)
    const status = normalizeTaskStatus(detail?.status ?? '')
    if (isStoryboardImageGenerateResumableStatus(status)) {
      const shouldResume = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '部分分镜图生成失败',
          content: String(detail?.errorMessage || '部分镜头出图失败，是否续生？'),
          okText: '续生',
          cancelText: '跳过',
          onOk: () => resolve(true),
          onCancel: () => resolve(false)
        })
      })
      if (shouldResume) {
        syncActiveImageTaskIdToStore(taskId)
        result = await resumeStoryboardImageGenerateTask({
          taskId,
          onProgress: (p) => {
            if (!matchesCreationLiveGenScope(routeCtx)) return
            if (typeof p.percent === 'number') {
              const completed = Math.min(
                imageTotal,
                Math.max(0, Math.round((p.percent / 100) * imageTotal))
              )
              creationStore.setStoryboardImageBatchProgress(completed, imageTotal)
            }
          }
        })
        if (!result.ok) {
          syncActiveImageTaskIdToStore(null)
          clearPanelGeneratingStatuses(storyboardIds)
          return {
        ok: false,
        message: 'errorMessage' in result ? result.errorMessage : '分镜图生成失败'
      }
        }
      } else {
        syncActiveImageTaskIdToStore(null)
        panels = await refreshPanelsImagesOnly(panels)
        for (const sid of targets) {
          const ok = await setFinalImageForStoryboard(ctx, sid)
          creationStore.setStoryboardPanelImageGenStatus(sid, ok ? 'success' : 'failed')
        }
        for (const sid of storyboardIds) {
          if (!targets.includes(sid)) {
            creationStore.clearStoryboardPanelImageGenStatus(sid)
          }
        }
        return { ok: true, partial: true, message: '部分分镜图生成失败' }
      }
    }

    syncActiveImageTaskIdToStore(null)
    panels = await refreshPanelsImagesOnly(panels)
    creationStore.updateFormData({ storyboardScript: { panels } })

    for (const sid of targets) {
      const ok = await setFinalImageForStoryboard(ctx, sid)
      creationStore.setStoryboardPanelImageGenStatus(sid, ok ? 'success' : 'failed')
    }

    for (const sid of storyboardIds) {
      if (!targets.includes(sid)) {
        creationStore.clearStoryboardPanelImageGenStatus(sid)
      }
    }

    creationStore.setStoryboardImageBatchProgress(imageTotal, imageTotal)
    return { ok: true, partial: result.partial }
  }

  function pickOngoingImageGenerateTask(
    tasks: UserTaskRow[],
    preferredTaskId?: number | null
  ): UserTaskRow | null {
    const ongoing = tasks
      .filter(
        (t) => t && isStoryboardImageGenerateTaskType(t.taskType) && isOngoingUserTaskStatus(t.status)
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

  async function followOngoingImageGenerateTask(
    taskId: number,
    storyboardIds: number[],
    targets: number[]
  ): Promise<{ ok: boolean; message?: string }> {
    const routeCtx = captureCreationLiveGenScope()
    const imageTotal = Math.max(targets.length, storyboardIds.length, 1)
    syncActiveImageTaskIdToStore(taskId)
    if (!creationStore.storyboardImageBatchProgress.total) {
      creationStore.setStoryboardImageBatchProgress(0, imageTotal)
    }
    await seedProgressFromTaskDetail(taskId, imageTotal)

    const result = await followStoryboardImageBatchGenerateTask({
      taskId,
      onProgress: (p) => {
        if (!matchesCreationLiveGenScope(routeCtx)) return
        if (typeof p.percent === 'number') {
          const completed = Math.min(
            imageTotal,
            Math.max(0, Math.round((p.percent / 100) * imageTotal))
          )
          creationStore.setStoryboardImageBatchProgress(completed, imageTotal)
        }
      }
    })

    syncActiveImageTaskIdToStore(null)

    if (!matchesCreationLiveGenScope(routeCtx)) {
      return { ok: false, message: '已切换作品' }
    }

    if (!result.ok) {
      clearPanelGeneratingStatuses(storyboardIds)
      return {
        ok: false,
        message: 'errorMessage' in result ? result.errorMessage : '分镜图生成失败'
      }
    }

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (ctx) {
      for (const sid of targets) {
        const ok = await setFinalImageForStoryboard(ctx, sid)
        creationStore.setStoryboardPanelImageGenStatus(sid, ok ? 'success' : 'failed')
      }
    }

    creationStore.setStoryboardImageBatchProgress(imageTotal, imageTotal)
    return { ok: true }
  }

  async function runBatchForPanels(
    panels: StoryboardPanel[],
    overwrite: boolean,
    options?: { manualAgentModelPick?: boolean }
  ): Promise<{ ok: boolean; panels: StoryboardPanel[]; message?: string }> {
    stopRequested = false
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      return { ok: false, panels, message: '缺少项目信息，请从「我的作品」打开作品后再操作' }
    }

    const storyboardIds = panels
      .map((p) => parseServerStoryboardId(p.id))
      .filter((id): id is number => id != null)

    if (!storyboardIds.length) {
      return { ok: false, panels, message: '分镜尚未保存到服务器，请先生成分镜脚本' }
    }

    const routeCtx = captureCreationLiveGenScope()
    creationStore.setStoryboardImageBatchGenerating(true)
    creationStore.setStoryboardImageBatchError(null)
    creationStore.setStoryboardImageBatchProgress(0, storyboardIds.length)
    markPanelsGenerating(storyboardIds)

    const manualPick = options?.manualAgentModelPick === true
    const settings = creationStore.storyboardStylistGenerateSettings
    const agentCode = resolveStoryboardPromptAgentCode(settings)
    const modelCode = resolveStoryboardPromptModelCode(settings)
    const llmFields = await resolveStoryboardGenConfigLlmFields(
      ctx.projectId,
      STORYBOARD_GEN_CONFIG_SCENE_CODES.stylist,
      manualPick,
      agentCode,
      modelCode
    )

    let submitted: Awaited<ReturnType<typeof userStoryboardGenerateImagePrompt>>
    try {
      submitted = await userStoryboardGenerateImagePrompt({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardIds,
        ...llmFields,
        overwrite
      })
    } catch (e: unknown) {
      creationStore.stopStoryboardImageBatchGeneration()
      return { ok: false, panels, message: bizErr(e) || '批量生成分镜图失败' }
    }

    const taskId = parseTaskId(submitted.taskId)
    if (!taskId) {
      creationStore.stopStoryboardImageBatchGeneration()
      return { ok: false, panels, message: '提交失败：未返回任务ID' }
    }

    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }

    const progressTotal =
      Number(submitted.totalShots) > 0 ? Number(submitted.totalShots) : storyboardIds.length

    const promptOutcome = await followPromptTask(taskId, storyboardIds, {
      progressTotalHint: progressTotal
    })

    if (!matchesCreationLiveGenScope(routeCtx)) {
      return { ok: false, panels, message: promptOutcome.message }
    }

    if (!promptOutcome.ok) {
      if (promptOutcome.partial) {
        const shouldResume = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '部分分镜图生成失败',
            content: promptOutcome.message || '部分分镜图提示词生成失败',
            okText: '续生',
            cancelText: '跳过',
            onOk: () => resolve(true),
            onCancel: () => resolve(false)
          })
        })
        if (shouldResume) {
          const resumeOutcome = await resumeStoryboardPromptGenerateTask(taskId, 'image')
          if (resumeOutcome.ok === false) {
            creationStore.setStoryboardImageBatchError(resumeOutcome.errorMessage)
            creationStore.setStoryboardImageBatchGenerating(false)
            clearPanelGeneratingStatuses(storyboardIds)
            return { ok: false, panels, message: resumeOutcome.errorMessage }
          }
        } else if (!stopRequested) {
          creationStore.setStoryboardImageBatchError(promptOutcome.message || null)
        }
      } else {
        creationStore.setStoryboardImageBatchGenerating(false)
        clearPanelGeneratingStatuses(storyboardIds)
        return { ok: false, panels, message: promptOutcome.message }
      }
    }

    let workingPanels = panels
    try {
      workingPanels = await refreshPanelsFromApi()
    } catch (e: unknown) {
      /* 提示词阶段完成，继续出图 */
    }

    const imageOutcome = await generateImagesForPanels(workingPanels, overwrite, storyboardIds)
    if (!imageOutcome.ok) {
      creationStore.setStoryboardImageBatchGenerating(false)
      if (imageOutcome.message) {
        creationStore.setStoryboardImageBatchError(imageOutcome.message)
      }
      return { ok: false, panels: workingPanels, message: imageOutcome.message }
    }

    try {
      workingPanels = await refreshPanelsFromApi()
    } catch (e: unknown) {
      /* ignore */
    }

    creationStore.setStoryboardImageBatchProgress(storyboardIds.length, storyboardIds.length)
    creationStore.setStoryboardImageBatchGenerating(false)
    clearPanelGeneratingStatuses(storyboardIds)

    return { ok: true, panels: workingPanels }
  }

  function pickOngoingImagePromptBatchTask(
    tasks: UserTaskRow[],
    preferredTaskId?: number | null
  ): UserTaskRow | null {
    const ongoing = tasks
      .filter(
        (t) => t && isStoryboardImagePromptBatchTask(t.taskType) && isOngoingUserTaskStatus(t.status)
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
    onPanelsUpdate: (panels: StoryboardPanel[]) => void
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

    const preferredId = creationStore.storyboardImageBatchActiveTaskId
    const ongoingTask = pickOngoingImagePromptBatchTask(tasks, preferredId)
    const ongoingId = parseTaskId(ongoingTask?.id)

    const storyboardIds = currentPanels
      .map((p) => parseServerStoryboardId(p.id))
      .filter((id): id is number => id != null)

    if (ongoingId != null) {
      if (gen !== resumeFollowGeneration) return
      creationStore.setStoryboardImageBatchGenerating(true)
      markPanelsGenerating(storyboardIds)
      const promptOutcome = await followPromptTask(ongoingId, storyboardIds)
      if (gen !== resumeFollowGeneration) return

      let workingPanels = currentPanels
      if (promptOutcome.ok || promptOutcome.partial) {
        try {
          workingPanels = await refreshPanelsFromApi()
          onPanelsUpdate(workingPanels)
        } catch {
          /* ignore */
        }
        const imageOutcome = await generateImagesForPanels(workingPanels, false, storyboardIds)
        if (gen !== resumeFollowGeneration) return
        if (imageOutcome.ok) {
          try {
            workingPanels = await refreshPanelsFromApi()
            onPanelsUpdate(workingPanels)
          } catch {
            /* ignore */
          }
        }
      }

      creationStore.setStoryboardImageBatchGenerating(false)
      clearPanelGeneratingStatuses(storyboardIds)
      return
    }

    const preferredImageId = creationStore.storyboardImageBatchActiveImageTaskId
    const ongoingImageTask = pickOngoingImageGenerateTask(tasks, preferredImageId)
    const ongoingImageId = parseTaskId(ongoingImageTask?.id)

    if (ongoingImageId != null) {
      if (gen !== resumeFollowGeneration) return
      creationStore.setStoryboardImageBatchGenerating(true)
      markPanelsGenerating(storyboardIds)
      await followOngoingImageGenerateTask(ongoingImageId, storyboardIds, storyboardIds)
      if (gen !== resumeFollowGeneration) return
      let workingPanels = currentPanels
      try {
        workingPanels = await refreshPanelsFromApi()
        onPanelsUpdate(workingPanels)
      } catch {
        /* ignore */
      }
      creationStore.setStoryboardImageBatchGenerating(false)
      clearPanelGeneratingStatuses(storyboardIds)
      return
    }

    const persistedGenerating = Object.entries(
      creationStore.storyboardPanelImageGenStatusByStoryboardId
    ).filter(([, st]) => st === 'generating')

    const scopeKey = creationStore.step3GenVisualScopeKey()
    const scopeBlob = creationStore.step4PlusLiveGenByScope[scopeKey]
    const pendingImageTasks = Object.entries(scopeBlob?.storyboardImageGenTasksByStoryboardId || {})

    if (!persistedGenerating.length && !pendingImageTasks.length) {
      if (creationStore.isGeneratingStoryboardImageBatch) {
        creationStore.stopStoryboardImageBatchGeneration()
      }
      return
    }

    if (gen !== resumeFollowGeneration) return
    creationStore.setStoryboardImageBatchGenerating(true)

    for (const [sidRaw, snap] of pendingImageTasks) {
      const sid = Number(sidRaw)
      const tid = Number(snap?.taskId)
      if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(tid) || tid <= 0) continue
      if (gen !== resumeFollowGeneration) return

      creationStore.setStoryboardPanelImageGenStatus(sid, 'generating')
      const result = await followStoryboardImageGenerateTask({
        taskId: tid,
        storyboardId: sid,
        recordId: null,
        projectEpisode: ctx
      })
      creationStore.clearStoryboardImageGenTask(sid)
      if (result.ok && result.recordId) {
        try {
          await userStoryboardSetFinalImage({ storyboardId: sid, recordId: result.recordId })
        } catch {
          /* ignore */
        }
        const next = await refreshPanelsImagesOnly(currentPanels)
        onPanelsUpdate(next)
        creationStore.setStoryboardPanelImageGenStatus(sid, 'success')
      } else {
        creationStore.setStoryboardPanelImageGenStatus(sid, 'failed')
      }
    }

    creationStore.setStoryboardImageBatchGenerating(false)
    clearPanelGeneratingStatuses(storyboardIds)
  }

  async function requestStop() {
    stopRequested = true
    closeStream()
    const promptTaskId = activeTaskId.value ?? creationStore.storyboardImageBatchActiveTaskId
    const imageTaskId = activeImageTaskId.value ?? creationStore.storyboardImageBatchActiveImageTaskId
    const taskId = promptTaskId ?? imageTaskId
    if (taskId) {
      try {
        await userTaskCancel({ taskId })
      } catch {
        /* ignore */
      }
    }
    syncActiveTaskIdToStore(null)
    syncActiveImageTaskIdToStore(null)
    creationStore.stopStoryboardImageBatchGeneration()
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
      if (promptOutcome.ok) {
        workingPanels = await refreshPanelsFromApi()
        const imageOutcome = await generateImagesForPanels(workingPanels, false, storyboardIds)
        if (imageOutcome.ok) {
          workingPanels = await refreshPanelsFromApi()
        }
        creationStore.setStoryboardImageBatchGenerating(false)
        clearPanelGeneratingStatuses(storyboardIds)
        onDone?.({ ok: true, panels: workingPanels })
      } else {
        creationStore.setStoryboardImageBatchGenerating(false)
        onDone?.({ ok: false, panels: workingPanels, message: promptOutcome.message })
      }
    })()
  }

  function cancelResumeFollow() {
    resumeFollowGeneration++
    closeStream()
    activeTaskId.value = null
  }

  return {
    activeTaskId,
    runBatchForPanels,
    requestStop,
    restoreOngoingBatchIfNeeded,
    onGlobalStopTask,
    onGlobalTrackTask,
    cancelResumeFollow
  }
}
