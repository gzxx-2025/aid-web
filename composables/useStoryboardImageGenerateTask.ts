import {
  fetchUserTaskDetailOnce,
  normalizeTaskStatus,
  TASK_SSE_TIMEOUT_MS,
  waitUserTaskSseTerminal
} from '~/composables/useTaskSseFollow'
import { userStoryboardGenerateImage, userTaskResume } from '~/utils/businessApi'
import { formatStoryboardImageSubmitRejections } from '~/utils/storyboardImageSubmitItems'
import {
  fetchStoryboardRecordsForStoryboard,
  type ProjectEpisodeContext
} from '~/utils/storyboardRecordBatch'
import { openRechargeModalFromInsufficientBalance, handleSseErrorRecharge } from '~/utils/api'
import type {
  StoryboardGenerateImageData,
  StoryboardGenerateImageRequest
} from '~/types/business-api'
import type { TaskStreamResult } from '~/composables/useTaskStream'

type ImageResultItem = { recordId?: number; imageUrl?: string; imageId?: number; storyboardId?: number }

function parseCompleteData(raw: unknown): {
  imageUrl: string | null
  recordId: number | null
  items: ImageResultItem[]
  successCount?: number
  totalCount?: number
} {
  if (raw == null) {
    return { imageUrl: null, recordId: null, items: [] }
  }

  let o: Record<string, unknown>
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return { imageUrl: null, recordId: null, items: [] }
    try {
      o = JSON.parse(s) as Record<string, unknown>
    } catch {
      return { imageUrl: null, recordId: null, items: [] }
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>
  } else {
    return { imageUrl: null, recordId: null, items: [] }
  }

  const imageUrl =
    typeof o.imageUrl === 'string' && o.imageUrl.trim()
      ? o.imageUrl.trim()
      : typeof o.ossUrl === 'string' && o.ossUrl.trim()
        ? o.ossUrl.trim()
        : null

  const ridRaw = o.recordId ?? o.genRecordId ?? o.imageId ?? o.id
  const recordId =
    ridRaw != null && Number.isFinite(Number(ridRaw)) && Number(ridRaw) > 0 ? Number(ridRaw) : null

  const items: ImageResultItem[] = Array.isArray(o.items)
    ? (o.items as ImageResultItem[])
    : []

  const successCount =
    typeof o.successCount === 'number' && Number.isFinite(o.successCount) ? o.successCount : undefined
  const totalCount =
    typeof o.totalCount === 'number' && Number.isFinite(o.totalCount) ? o.totalCount : undefined

  return { imageUrl, recordId, items, successCount, totalCount }
}

async function fetchRecordFileUrl(
  projectEpisode: ProjectEpisodeContext | null | undefined,
  storyboardId: number,
  recordId: number
): Promise<string | null> {
  if (!projectEpisode) return null
  try {
    const rows = await fetchStoryboardRecordsForStoryboard(projectEpisode, storyboardId, 'image')
    const row = rows.find((r) => Number(r.id) === recordId)
    const url = String(row?.fileUrl ?? '').trim()
    if (url) return url
  } catch {
    /* ignore */
  }
  return null
}

export type StoryboardImageGenerateProgress = {
  message?: string
  percent?: number
  stepTitle?: string
  stepIndex?: number
  stepTotal?: number
  successCount?: number
  totalCount?: number
  recordId?: number | null
  taskId?: number
  items?: ImageResultItem[]
}

export type StoryboardImageGenerateResult =
  | {
      ok: true
      taskId: number
      recordId: number | null
      imageUrl: string | null
      items?: ImageResultItem[]
    }
  | { ok: false; errorMessage: string }

export type StoryboardImageBatchGenerateResult =
  | { ok: true; taskId: number; partial?: boolean; submitWarning?: string }
  | { ok: false; errorMessage: string }

export function isStoryboardImageTaskOngoingStatus(status: unknown): boolean {
  const st = String(status ?? '').trim().toUpperCase()
  return (
    st === 'PENDING' ||
    st === 'PROCESSING' ||
    st === 'QUEUED' ||
    st === 'RUNNING' ||
    st === 'WAITING' ||
    st === '0'
  )
}

/** 判断分镜图任务是否仍在进行中（刷新恢复用，单次 detail） */
export async function isStoryboardImageTaskOngoing(taskId: number): Promise<boolean> {
  const id = Number(taskId)
  if (!Number.isFinite(id) || id <= 0) return false
  const detail = await fetchUserTaskDetailOnce(id)
  if (!detail) return false
  return isStoryboardImageTaskOngoingStatus(detail.status)
}

function pickItemsForStoryboard(items: ImageResultItem[], storyboardId: number): ImageResultItem[] {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return items
  const filtered = items.filter((it) => Number(it.storyboardId) === sid)
  return filtered.length ? filtered : items
}

async function buildStoryboardImageSuccess(payload: {
  parsed: ReturnType<typeof parseCompleteData>
  taskId: number
  storyboardId: number
  recordId: number | null
  projectEpisode?: ProjectEpisodeContext | null
}): Promise<StoryboardImageGenerateResult> {
  const { parsed, taskId, storyboardId, recordId, projectEpisode } = payload
  const scopedItems = pickItemsForStoryboard(parsed.items, storyboardId)
  const lastItem = scopedItems[scopedItems.length - 1]
  const resolvedRecordId =
    parsed.recordId ??
    recordId ??
    (lastItem?.recordId != null && Number(lastItem.recordId) > 0 ? Number(lastItem.recordId) : null) ??
    (lastItem?.imageId != null && Number(lastItem.imageId) > 0 ? Number(lastItem.imageId) : null)

  const imageUrl =
    parsed.imageUrl ||
    (lastItem?.imageUrl ?? null) ||
    (resolvedRecordId != null && Number.isFinite(storyboardId) && storyboardId > 0
      ? await fetchRecordFileUrl(projectEpisode, storyboardId, resolvedRecordId)
      : null)

  return {
    ok: true,
    taskId,
    recordId: resolvedRecordId,
    imageUrl,
    items: scopedItems.length ? scopedItems : parsed.items.length ? parsed.items : undefined
  }
}

async function resultFromStreamTerminal(
  r: TaskStreamResult,
  ctx: {
    taskId: number
    storyboardId: number
    recordId: number | null
    projectEpisode?: ProjectEpisodeContext | null
  }
): Promise<StoryboardImageGenerateResult | null> {
  if (r.type !== 'complete' && r.type !== 'partial_failed') return null
  const parsed = parseCompleteData(r.data)
  if (!parsed.imageUrl && !parsed.recordId && !parsed.items.length && ctx.recordId == null) {
    return null
  }
  return buildStoryboardImageSuccess({ parsed, ...ctx })
}

async function resultFromTaskDetail(
  d: Awaited<ReturnType<typeof fetchUserTaskDetailOnce>>,
  ctx: {
    taskId: number
    storyboardId: number
    recordId: number | null
    projectEpisode?: ProjectEpisodeContext | null
  }
): Promise<StoryboardImageGenerateResult | null> {
  if (!d) return null
  const st = normalizeTaskStatus(d.status)
  if (st === 'SUCCEEDED' || st === 'PARTIAL_FAILED') {
    const parsed = parseCompleteData(d.resultData)
    if (parsed.imageUrl || parsed.recordId || parsed.items.length || ctx.recordId != null) {
      return buildStoryboardImageSuccess({ parsed, ...ctx })
    }
    if (st === 'PARTIAL_FAILED') {
      return { ok: false, errorMessage: String(d.errorMessage || '部分分镜图生成失败') }
    }
    return { ok: false, errorMessage: '任务成功但未解析到图片' }
  }
  if (st === 'CANCELLED') {
    return { ok: false, errorMessage: '任务已取消' }
  }
  if (st === 'FAILED') {
    return { ok: false, errorMessage: String(d.errorMessage || '生成失败') }
  }
  return null
}

function validateSubmitItems(submitted: StoryboardGenerateImageData): string | null {
  const items = submitted?.items ?? []
  if (!items.length) return null
  const accepted = items.filter((item) => item.accepted)
  const rejected = items.filter((item) => !item.accepted)
  if (accepted.length === 0) {
    return rejected.map((item) => item.reason).filter(Boolean).join('；') || '全部失败'
  }
  return null
}

async function submitAndFollowStoryboardImageBatchTask(payload: {
  submit: () => Promise<StoryboardGenerateImageData>
  onProgress?: (p: StoryboardImageGenerateProgress) => void
  onSubmitted?: (p: { taskId: number }) => void
  progressMessage: string
  submitErrorMessage: string
}): Promise<StoryboardImageBatchGenerateResult> {
  const { submit, onProgress, onSubmitted, progressMessage, submitErrorMessage } = payload

  let submitted: StoryboardGenerateImageData
  try {
    submitted = await submit()
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    const msg = String(err?.msg || err?.message || submitErrorMessage)
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }

  const rejectReason = validateSubmitItems(submitted)
  if (rejectReason) {
    return { ok: false, errorMessage: rejectReason }
  }

  const submitWarning = formatStoryboardImageSubmitRejections(submitted?.items)

  const taskId = Number(submitted?.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    const items = submitted?.items ?? []
    const reason = items
      .filter((item) => !item.accepted)
      .map((item) => item.reason)
      .filter(Boolean)
      .join('；')
    return { ok: false, errorMessage: reason || '提交失败：未返回任务ID' }
  }

  onSubmitted?.({ taskId })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }

  const submitStatus = String(submitted.status || '').toUpperCase()
  if (submitStatus === 'SUCCEEDED') {
    return { ok: true, taskId, ...(submitWarning ? { submitWarning } : {}) }
  }
  if (submitStatus === 'PARTIAL_FAILED') {
    return { ok: true, taskId, partial: true, ...(submitWarning ? { submitWarning } : {}) }
  }
  if (submitStatus === 'FAILED') {
    return { ok: false, errorMessage: '分镜图生成失败' }
  }

  onProgress?.({ taskId, message: progressMessage, stepTitle: progressMessage })

  const followed = await followStoryboardImageBatchGenerateTask({ taskId, onProgress })
  if (followed.ok && submitWarning) {
    return { ...followed, submitWarning }
  }
  return followed
}

/**
 * 追踪已提交的批量分镜图父任务（SSE 等待终态）。
 */
export async function followStoryboardImageBatchGenerateTask(payload: {
  taskId: number
  onProgress?: (p: StoryboardImageGenerateProgress) => void
}): Promise<StoryboardImageBatchGenerateResult> {
  const taskId = Number(payload.taskId)
  const { onProgress } = payload

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return { ok: false, errorMessage: '任务ID无效' }
  }

  onProgress?.({ taskId, message: '分镜图生成中…', stepTitle: '分镜图生成中…' })

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
      const detail = await fetchUserTaskDetailOnce(taskId)
      const st = normalizeTaskStatus(detail?.status)
      if (st === 'SUCCEEDED' || st === 'PARTIAL_FAILED') {
        return { ok: true, taskId, partial: st === 'PARTIAL_FAILED' }
      }
      if (st === 'CANCELLED') return { ok: false, errorMessage: '任务已取消' }
      if (st === 'FAILED') {
        const msg = String(detail?.errorMessage || '生成失败')
        openRechargeModalFromInsufficientBalance(msg)
        return { ok: false, errorMessage: msg }
      }
      return { ok: false, errorMessage: '生成超时，请稍后在生成记录中查看' }
    }

    const r = terminal.event
    if (r.type === 'complete') {
      return { ok: true, taskId }
    }
    if (r.type === 'partial_failed') {
      return { ok: true, taskId, partial: true }
    }

    const detail = await fetchUserTaskDetailOnce(taskId)
    const st = normalizeTaskStatus(detail?.status)
    if (st === 'SUCCEEDED' || st === 'PARTIAL_FAILED') {
      return { ok: true, taskId, partial: st === 'PARTIAL_FAILED' }
    }

    if (r.type === 'error') {
      const msg = r.errorMessage || String(detail?.errorMessage || '生成失败')
      handleSseErrorRecharge(r.errorData, msg)
      return { ok: false, errorMessage: msg }
    }

    if (r.type === 'cancelled') {
      return { ok: false, errorMessage: r.message || '任务已取消' }
    }

    if (st === 'FAILED') {
      const msg = String(detail?.errorMessage || '生成失败')
      openRechargeModalFromInsufficientBalance(msg)
      return { ok: false, errorMessage: msg }
    }

    return { ok: false, errorMessage: String(detail?.errorMessage || '分镜图生成未完成') }
  } catch (e: unknown) {
    const msg = String((e as Error)?.message || '分镜图生成任务异常')
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }
}

/** PARTIAL_FAILED 续生：POST /api/user/task/resume */
export async function resumeStoryboardImageGenerateTask(payload: {
  taskId: number
  onProgress?: (p: StoryboardImageGenerateProgress) => void
}): Promise<StoryboardImageBatchGenerateResult> {
  const taskId = Number(payload.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return { ok: false, errorMessage: '任务ID无效' }
  }
  return submitAndFollowStoryboardImageBatchTask({
    submit: () => userTaskResume({ taskId }) as Promise<StoryboardGenerateImageData>,
    onProgress: payload.onProgress,
    progressMessage: '分镜图续生中…',
    submitErrorMessage: '续生分镜图失败'
  })
}

/**
 * 追踪已提交的分镜图生成（单镜头弹窗 / 恢复），并通过 SSE 追踪进度。
 */
export async function followStoryboardImageGenerateTask(payload: {
  taskId: number
  storyboardId: number
  recordId?: number | null
  projectEpisode?: ProjectEpisodeContext | null
  onProgress?: (p: StoryboardImageGenerateProgress) => void
}): Promise<StoryboardImageGenerateResult> {
  const taskId = Number(payload.taskId)
  const storyboardId = Number(payload.storyboardId)
  const recordId =
    payload.recordId != null && Number.isFinite(Number(payload.recordId)) && Number(payload.recordId) > 0
      ? Number(payload.recordId)
      : null
  const { onProgress, projectEpisode } = payload
  const ctx = { taskId, storyboardId, recordId, projectEpisode }

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return { ok: false, errorMessage: '任务ID无效' }
  }

  onProgress?.({
    taskId,
    recordId,
    message: '分镜图生成中…',
    stepTitle: '分镜图生成中…'
  })

  try {
    const terminal = await waitUserTaskSseTerminal({
      taskId,
      timeoutMs: TASK_SSE_TIMEOUT_MS,
      onProgress: (p) => {
        onProgress?.({
          percent: p.percent,
          stepTitle: p.stepTitle,
          message: p.message,
          taskId,
          recordId
        })
      }
    })

    if (terminal.kind === 'timeout') {
      if (recordId != null && Number.isFinite(storyboardId) && storyboardId > 0) {
        const url = await fetchRecordFileUrl(projectEpisode, storyboardId, recordId)
        if (url) return { ok: true, taskId, recordId, imageUrl: url }
      }
      const recovered = await resultFromTaskDetail(await fetchUserTaskDetailOnce(taskId), ctx)
      if (recovered) return recovered
      return { ok: false, errorMessage: '生成超时，请稍后在生成记录中查看' }
    }

    const r = terminal.event
    const fromStream = await resultFromStreamTerminal(r, ctx)
    if (fromStream) return fromStream

    const recovered = await resultFromTaskDetail(await fetchUserTaskDetailOnce(taskId), ctx)
    if (recovered) return recovered

    if (r.type === 'error') {
      const msg = r.errorMessage || '生成失败'
      handleSseErrorRecharge(r.errorData, msg)
      return { ok: false, errorMessage: msg }
    }

    if (r.type === 'cancelled') {
      return { ok: false, errorMessage: r.message || '任务已取消' }
    }

    if (recordId != null && Number.isFinite(storyboardId) && storyboardId > 0) {
      const url = await fetchRecordFileUrl(projectEpisode, storyboardId, recordId)
      if (url) return { ok: true, taskId, recordId, imageUrl: url }
    }

    return { ok: false, errorMessage: '分镜图生成未完成' }
  } catch (e: unknown) {
    if (recordId != null && Number.isFinite(storyboardId) && storyboardId > 0) {
      const url = await fetchRecordFileUrl(projectEpisode, storyboardId, recordId)
      if (url) return { ok: true, taskId, recordId, imageUrl: url }
    }
    const msg = String((e as Error)?.message || '分镜图生成任务异常')
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }
}

/** 批量出图：POST /api/user/storyboard/generate/image */
export async function runStoryboardImageBatchGenerateTask(payload: {
  body: StoryboardGenerateImageRequest
  onProgress?: (p: StoryboardImageGenerateProgress) => void
  onSubmitted?: (p: { taskId: number }) => void
}): Promise<StoryboardImageBatchGenerateResult> {
  return submitAndFollowStoryboardImageBatchTask({
    submit: () => userStoryboardGenerateImage(payload.body),
    onProgress: payload.onProgress,
    onSubmitted: payload.onSubmitted,
    progressMessage: '分镜图生成中…',
    submitErrorMessage: '提交生图失败'
  })
}

/**
 * 提交分镜图生成（单镜头，支持 count 1~8）并通过 SSE 追踪进度。
 * 结果写入 aid_gen_record，由调用方 refreshSceneRecords 从服务端拉列表。
 */
export async function runStoryboardImageGenerateTask(payload: {
  body: StoryboardGenerateImageRequest
  projectEpisode?: ProjectEpisodeContext | null
  onProgress?: (p: StoryboardImageGenerateProgress) => void
  onSubmitted?: (p: { taskId: number; recordId: number | null }) => void
}): Promise<StoryboardImageGenerateResult> {
  const { body, onProgress, onSubmitted, projectEpisode } = payload
  const storyboardId = Number(body.storyboardIds?.[0])
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) {
    return { ok: false, errorMessage: '分镜ID无效' }
  }

  const batchResult = await submitAndFollowStoryboardImageBatchTask({
    submit: () => userStoryboardGenerateImage(body),
    onProgress: (p) => {
      onProgress?.({
        ...p,
        totalCount: p.totalCount ?? body.count ?? 1
      })
    },
    onSubmitted: ({ taskId }) => {
      onSubmitted?.({ taskId, recordId: null })
    },
    progressMessage: '分镜图生成中…',
    submitErrorMessage: '提交生图失败'
  })

  if (!batchResult.ok) {
    return {
      ok: false,
      errorMessage: 'errorMessage' in batchResult ? batchResult.errorMessage : '分镜图生成失败'
    }
  }

  const taskId = batchResult.taskId
  const detail = await fetchUserTaskDetailOnce(taskId)
  const recovered = await resultFromTaskDetail(detail, {
    taskId,
    storyboardId,
    recordId: null,
    projectEpisode
  })
  if (recovered) return recovered

  if (batchResult.partial) {
    return {
      ok: false,
      errorMessage: String(detail?.errorMessage || '部分分镜图生成失败')
    }
  }
  return { ok: false, errorMessage: '任务成功但未解析到图片' }
}
