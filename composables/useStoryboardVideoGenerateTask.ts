import { isUserOrMediaTaskOngoing } from '~/composables/useTaskOngoing'
import {
  fetchUserTaskDetailOnce,
  normalizeTaskStatus,
  TASK_SSE_TIMEOUT_MS,
  waitUserTaskSseTerminal
} from '~/composables/useTaskSseFollow'
import {
  userStoryboardGenerateVideo,
  userStoryboardGenerateVideoImage,
  userTaskResume
} from '~/utils/businessApi'
import { openRechargeModalFromInsufficientBalance, handleSseErrorRecharge } from '~/utils/api'
import type {
  StoryboardVideoGenerateRequest,
  StoryboardVideoImageGenerateRequest,
  StoryboardVideoGenerateData
} from '~/types/business-api'

export { isUserOrMediaTaskOngoing as isStoryboardVideoTaskOngoing }

export type StoryboardVideoGenerateProgress = {
  message?: string
  percent?: number
  stepTitle?: string
  taskId?: number
}

export type StoryboardVideoGenerateResult =
  | { ok: true; taskId: number }
  | { ok: false; errorMessage: string }

export async function followStoryboardVideoGenerateTask(payload: {
  taskId: number
  onProgress?: (p: StoryboardVideoGenerateProgress) => void
}): Promise<StoryboardVideoGenerateResult> {
  const taskId = Number(payload.taskId)
  const { onProgress } = payload

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return { ok: false, errorMessage: '任务ID无效' }
  }

  onProgress?.({ taskId, message: '分镜视频生成中…', stepTitle: '分镜视频生成中…' })

  try {
    const terminal = await waitUserTaskSseTerminal({
      taskId,
      timeoutMs: TASK_SSE_TIMEOUT_MS,
      onProgress: (p) => {
        onProgress?.({
          taskId,
          percent: p.percent,
          stepTitle: p.stepTitle,
          message: p.message
        })
      }
    })

    if (terminal.kind === 'timeout') {
      const ongoing = await isUserOrMediaTaskOngoing(taskId)
      if (!ongoing) return { ok: true, taskId }
      const detail = await fetchUserTaskDetailOnce(taskId)
      const st = normalizeTaskStatus(detail?.status)
      if (st === 'SUCCEEDED' || st === 'PARTIAL_FAILED') return { ok: true, taskId }
      if (st === 'CANCELLED') return { ok: false, errorMessage: '任务已取消' }
      if (st === 'FAILED') {
        const msg = String(detail?.errorMessage || '视频生成失败')
        openRechargeModalFromInsufficientBalance(msg)
        return { ok: false, errorMessage: msg }
      }
      return { ok: false, errorMessage: '视频生成超时，请稍后在生成记录中查看' }
    }

    const r = terminal.event
    if (r.type === 'complete' || r.type === 'partial_failed') {
      return { ok: true, taskId }
    }

    const detail = await fetchUserTaskDetailOnce(taskId)
    const st = normalizeTaskStatus(detail?.status)
    if (st === 'SUCCEEDED' || st === 'PARTIAL_FAILED') {
      return { ok: true, taskId }
    }

    if (r.type === 'error') {
      const msg = r.errorMessage || String(detail?.errorMessage || '视频生成失败')
      handleSseErrorRecharge(r.errorData, msg)
      return { ok: false, errorMessage: msg }
    }

    if (r.type === 'cancelled') {
      return { ok: false, errorMessage: r.message || '任务已取消' }
    }

    if (st === 'FAILED') {
      const msg = String(detail?.errorMessage || '视频生成失败')
      openRechargeModalFromInsufficientBalance(msg)
      return { ok: false, errorMessage: msg }
    }

    return { ok: false, errorMessage: String(detail?.errorMessage || '分镜视频生成未完成') }
  } catch (e: unknown) {
    const msg = String((e as Error)?.message || '分镜视频生成任务异常')
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }
}

async function submitAndFollowStoryboardVideoTask(payload: {
  submit: () => Promise<StoryboardVideoGenerateData>
  onProgress?: (p: StoryboardVideoGenerateProgress) => void
  onSubmitted?: (p: { taskId: number }) => void
  progressMessage: string
  submitErrorMessage: string
}): Promise<StoryboardVideoGenerateResult> {
  const { submit, onProgress, onSubmitted, progressMessage, submitErrorMessage } = payload

  let submitted: StoryboardVideoGenerateData
  try {
    submitted = await submit()
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    const msg = String(err?.msg || err?.message || submitErrorMessage)
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }

  const items = submitted?.items ?? []
  const acceptedItems = items.filter((item) => item.accepted)
  const rejectedItems = items.filter((item) => !item.accepted)
  if (items.length > 0 && acceptedItems.length === 0) {
    const reason = rejectedItems.map((item) => item.reason).filter(Boolean).join('；') || '全部失败'
    return { ok: false, errorMessage: reason }
  }

  const taskId = Number(submitted?.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    const reason = rejectedItems.map((item) => item.reason).filter(Boolean).join('；')
    return { ok: false, errorMessage: reason || '提交失败：未返回任务ID' }
  }

  onSubmitted?.({ taskId })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }

  const submitStatus = String(submitted.status || '').toUpperCase()
  if (submitStatus === 'SUCCEEDED' || submitStatus === 'PARTIAL_FAILED') {
    return { ok: true, taskId }
  }
  if (submitStatus === 'FAILED') {
    return { ok: false, errorMessage: '视频生成失败' }
  }

  onProgress?.({
    taskId,
    message: progressMessage,
    stepTitle: progressMessage
  })

  return followStoryboardVideoGenerateTask({ taskId, onProgress })
}

/** 图生方向出片：POST /api/user/storyboard/generate/video/image */
export async function runStoryboardImageVideoGenerateTask(payload: {
  body: StoryboardVideoImageGenerateRequest
  onProgress?: (p: StoryboardVideoGenerateProgress) => void
  onSubmitted?: (p: { taskId: number }) => void
}): Promise<StoryboardVideoGenerateResult> {
  return submitAndFollowStoryboardVideoTask({
    submit: () => userStoryboardGenerateVideoImage(payload.body),
    onProgress: payload.onProgress,
    onSubmitted: payload.onSubmitted,
    progressMessage: '图生视频生成中…',
    submitErrorMessage: '提交图生视频失败'
  })
}

/** 多参方向出片：POST /api/user/storyboard/generate/video */
export async function runStoryboardMultiVideoGenerateTask(payload: {
  body: StoryboardVideoGenerateRequest
  onProgress?: (p: StoryboardVideoGenerateProgress) => void
  onSubmitted?: (p: { taskId: number }) => void
}): Promise<StoryboardVideoGenerateResult> {
  return submitAndFollowStoryboardVideoTask({
    submit: () => userStoryboardGenerateVideo(payload.body),
    onProgress: payload.onProgress,
    onSubmitted: payload.onSubmitted,
    progressMessage: '多参视频生成中…',
    submitErrorMessage: '提交多参视频失败'
  })
}

/** PARTIAL_FAILED 续生：POST /api/user/task/resume */
export async function resumeStoryboardVideoGenerateTask(payload: {
  taskId: number
  onProgress?: (p: StoryboardVideoGenerateProgress) => void
}): Promise<StoryboardVideoGenerateResult> {
  const taskId = Number(payload.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return { ok: false, errorMessage: '任务ID无效' }
  }
  return submitAndFollowStoryboardVideoTask({
    submit: () => userTaskResume({ taskId }) as Promise<StoryboardVideoGenerateData>,
    onProgress: payload.onProgress,
    progressMessage: '分镜视频续生中…',
    submitErrorMessage: '续生分镜视频失败'
  })
}

/** @deprecated 请使用 runStoryboardImageVideoGenerateTask 或 runStoryboardMultiVideoGenerateTask */
export const runStoryboardI2vGenerateTask = runStoryboardMultiVideoGenerateTask
