import { userTaskResume } from '~/utils/businessApi'

/** SSE partial_failed / complete 批量结果中的失败项 */
export interface TaskPartialFailedItem {
  batchIndex?: number
  batchId?: number
  sceneId?: number
  scene_id?: number
  sceneName?: string
  message?: string
  reason?: string
  [key: string]: unknown
}

/** SSE partial_failed 事件 data 结构（与 complete 批量结果同构） */
export interface TaskPartialFailedData {
  totalCount?: number
  successCount?: number
  failCount?: number
  successItems?: unknown[]
  failedItems?: TaskPartialFailedItem[]
}

export function normUserTaskType(ty: unknown): string {
  return String(ty ?? '').trim().toLowerCase().replace(/-/g, '_')
}

export function isUserTaskStatusPartialFailed(status: unknown): boolean {
  return String(status ?? '').toUpperCase() === 'PARTIAL_FAILED'
}

/** 支持 POST /api/user/task/resume 续生的任务类型（与接口文档一致） */
export function isPartialFailedResumableTaskType(ty: unknown): boolean {
  const n = normUserTaskType(ty)
  return (
    n === 'asset_extract' ||
    n === 'storyboard_script_batch' ||
    n === 'storyboard_image_prompt_batch' ||
    n === 'storyboard_video_prompt_batch' ||
    n === 'storyboard_video_generate' ||
    n === 'storyboard_image_generate' ||
    n === 'storyboard_image_batch'
  )
}

/** 分镜视频出片：FAILED 终态也可续生（与 PARTIAL_FAILED 同入口） */
export function isStoryboardVideoGenerateResumableStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase()
  return s === 'PARTIAL_FAILED' || s === 'FAILED'
}

export function isStoryboardVideoGenerateTaskType(ty: unknown): boolean {
  return normUserTaskType(ty) === 'storyboard_video_generate'
}

export function isStoryboardImageGenerateTaskType(ty: unknown): boolean {
  const n = normUserTaskType(ty)
  return n === 'storyboard_image_generate' || n === 'storyboard_image_batch'
}

/** 分镜图出片：FAILED 终态也可续生（与 PARTIAL_FAILED 同入口） */
export function isStoryboardImageGenerateResumableStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase()
  return s === 'PARTIAL_FAILED' || s === 'FAILED'
}

export function parseTaskPartialFailedData(data: unknown): TaskPartialFailedData | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const o = data as Record<string, unknown>
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return {
    totalCount: num(o.totalCount),
    successCount: num(o.successCount),
    failCount: num(o.failCount),
    successItems: Array.isArray(o.successItems) ? o.successItems : undefined,
    failedItems: Array.isArray(o.failedItems)
      ? (o.failedItems as TaskPartialFailedItem[])
      : undefined
  }
}

/** 从 PARTIAL_FAILED 明细提取 aid_scene_plot.id，供 /generate/script 选择性重试 */
export function extractSceneIdsFromPartialFailed(data?: TaskPartialFailedData | null): number[] {
  if (!data?.failedItems?.length) return []
  const ids = new Set<number>()
  for (const item of data.failedItems) {
    const raw = item.sceneId ?? item.scene_id ?? item.batchId ?? item.batch_id
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) ids.add(n)
  }
  return [...ids]
}

export function formatPartialFailedMessage(
  data?: TaskPartialFailedData | null,
  fallback?: string
): string {
  if (!data) return fallback || '部分生成失败，可续生'
  const s = data.successCount
  const f = data.failCount
  const t = data.totalCount
  if (s != null && f != null && t != null) {
    return `部分成功：${s}/${t} 已完成，${f} 项失败，可点击续生`
  }
  return fallback || '部分生成失败，可续生'
}

export function taskTypeLabelForResume(ty: unknown): string {
  const n = normUserTaskType(ty)
  if (n === 'asset_extract') return '智能提取'
  if (n === 'storyboard_script_batch') return '分镜脚本生成'
  if (n === 'storyboard_image_prompt_batch') return '分镜图提示词生成'
  if (n === 'storyboard_video_prompt_batch') return '分镜视频提示词生成'
  if (n === 'storyboard_video_generate') return '分镜视频出片'
  if (n === 'storyboard_image_generate' || n === 'storyboard_image_batch') return '分镜图生成'
  return String(ty || '任务')
}

/** 统一续生：POST /api/user/task/resume，复用原 taskId */
export async function resumeUserTask(
  taskId: number,
  taskType: unknown
): Promise<{ taskId: number; totalBatches?: number; totalShots?: number }> {
  const n = normUserTaskType(taskType)
  if (!isPartialFailedResumableTaskType(n)) {
    throw new Error('该任务类型不支持续生')
  }
  const r = await userTaskResume({ taskId })
  return { taskId: r.taskId, totalBatches: r.totalBatches, totalShots: r.totalShots }
}
