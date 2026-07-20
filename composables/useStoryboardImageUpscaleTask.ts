import {
  fetchUserTaskDetailOnce,
  normalizeTaskStatus,
  TASK_SSE_TIMEOUT_MS,
  waitUserTaskSseTerminal
} from '~/composables/useTaskSseFollow'
import { userStoryboardGenerateUpscale } from '~/utils/businessApi'
import { openRechargeModalFromInsufficientBalance, handleSseErrorRecharge } from '~/utils/api'
import type {
  UserStoryboardGenerateUpscaleRequest,
  StoryboardUpscaleCompleteData
} from '~/types/business-api'
import type { EnhanceImageMode } from '~/types/enhanceImageMode'
import type { TaskStreamResult } from '~/composables/useTaskStream'

function parseUpscaleResult(raw: unknown): {
  imageUrl: string | null
  recordId: number | null
} {
  if (raw == null) return { imageUrl: null, recordId: null }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as StoryboardUpscaleCompleteData
    const imageUrl =
      typeof o?.imageUrl === 'string' && o.imageUrl.trim() ? o.imageUrl.trim() : null
    const ridRaw = o?.recordId ?? o?.genRecordId ?? o?.imageId
    const recordId =
      ridRaw != null && Number.isFinite(Number(ridRaw)) && Number(ridRaw) > 0 ? Number(ridRaw) : null
    return { imageUrl, recordId }
  }
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return { imageUrl: null, recordId: null }
  try {
    const o = JSON.parse(s) as StoryboardUpscaleCompleteData
    const imageUrl =
      typeof o?.imageUrl === 'string' && o.imageUrl.trim() ? o.imageUrl.trim() : null
    const ridRaw = o?.recordId ?? o?.genRecordId ?? o?.imageId
    const recordId =
      ridRaw != null && Number.isFinite(Number(ridRaw)) && Number(ridRaw) > 0 ? Number(ridRaw) : null
    return { imageUrl, recordId }
  } catch {
    return { imageUrl: null, recordId: null }
  }
}

/** 变清晰下拉模式 → 清晰度档（与形态图高清语义对齐） */
export function storyboardUpscaleResolutionForMode(mode: EnhanceImageMode): string {
  if (mode === 'redraw_ultra') return '8K'
  return '2K'
}

export type StoryboardImageUpscaleTaskResult =
  | { ok: true; imageUrl: string; recordId: number | null }
  | { ok: false; errorMessage: string }

function buildUpscaleSuccess(parsed: {
  imageUrl: string | null
  recordId: number | null
}): StoryboardImageUpscaleTaskResult | null {
  if (!parsed.imageUrl) return null
  return { ok: true, imageUrl: parsed.imageUrl, recordId: parsed.recordId }
}

function resultFromStreamTerminal(r: TaskStreamResult): StoryboardImageUpscaleTaskResult | null {
  if (r.type !== 'complete') return null
  return buildUpscaleSuccess(parseUpscaleResult(r.data))
}

function resultFromTaskDetail(
  d: Awaited<ReturnType<typeof fetchUserTaskDetailOnce>>
): StoryboardImageUpscaleTaskResult | null {
  if (!d) return null
  const st = normalizeTaskStatus(d.status)
  if (st === 'SUCCEEDED') {
    const hit = buildUpscaleSuccess(parseUpscaleResult(d.resultData))
    if (hit) return hit
    return { ok: false, errorMessage: '任务成功但未解析到图片地址' }
  }
  if (st === 'CANCELLED') {
    return { ok: false, errorMessage: '任务已取消' }
  }
  if (st === 'FAILED') {
    return { ok: false, errorMessage: String(d.errorMessage || '高清任务失败') }
  }
  return null
}

async function followStoryboardImageUpscaleTask(payload: {
  taskId: number
  onProgress?: (p: { percent?: number; stepTitle?: string; message?: string }) => void
}): Promise<StoryboardImageUpscaleTaskResult> {
  const taskId = Number(payload.taskId)
  const { onProgress } = payload

  try {
    const terminal = await waitUserTaskSseTerminal({
      taskId,
      timeoutMs: TASK_SSE_TIMEOUT_MS,
      onProgress
    })

    if (terminal.kind === 'timeout') {
      const recovered = resultFromTaskDetail(await fetchUserTaskDetailOnce(taskId))
      if (recovered) return recovered
      return { ok: false, errorMessage: '高清任务超时，请在任务中心查看进度' }
    }

    const r = terminal.event
    const fromStream = resultFromStreamTerminal(r)
    if (fromStream) return fromStream

    const recovered = resultFromTaskDetail(await fetchUserTaskDetailOnce(taskId))
    if (recovered) return recovered

    if (r.type === 'error') {
      const msg = r.errorMessage || '高清任务失败'
      handleSseErrorRecharge(r.errorData, msg)
      return { ok: false, errorMessage: msg }
    }

    if (r.type === 'cancelled') {
      return { ok: false, errorMessage: r.message || '任务已取消' }
    }

    return { ok: false, errorMessage: '高清任务未完成' }
  } catch (e: unknown) {
    const recovered = resultFromTaskDetail(await fetchUserTaskDetailOnce(taskId))
    if (recovered) return recovered
    const msg = String((e as Error)?.message || '高清任务异常')
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }
}

/**
 * 分镜图高清：POST /api/user/storyboard/generate/upscale
 * 结果落 aid_gen_record 新行，不覆盖原记录。
 */
export async function runStoryboardImageUpscaleTask(payload: {
  genRecordId: number
  modelCode: string
  /** 来自 image_upscale 模型池 defaultSizeCode；未传则回退 mode 默认档 */
  resolution?: string
  /** 兼容旧调用：未传 resolution 时按 mode 回退 */
  mode?: EnhanceImageMode
  onProgress?: (p: { percent?: number; stepTitle?: string; message?: string }) => void
}): Promise<StoryboardImageUpscaleTaskResult> {
  const { genRecordId, modelCode, onProgress } = payload
  const explicit = String(payload.resolution || '').trim()
  const resolution = explicit || storyboardUpscaleResolutionForMode(payload.mode || 'redraw_ultra')

  let taskId: number
  try {
    const reqBody: UserStoryboardGenerateUpscaleRequest = {
      genRecordId,
      modelCode,
      resolution
    }
    const submitted = await userStoryboardGenerateUpscale(reqBody)
    taskId = Number(submitted.taskId)
    if (!Number.isFinite(taskId) || taskId <= 0) {
      return { ok: false, errorMessage: '未返回有效任务ID' }
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    const msg = String(err?.msg || err?.message || '提交高清任务失败')
    openRechargeModalFromInsufficientBalance(msg)
    return { ok: false, errorMessage: msg }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }

  return followStoryboardImageUpscaleTask({ taskId, onProgress })
}
