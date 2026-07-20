import { userAssetRpsFormUse } from '~/utils/businessApi'
import { normUserTaskType } from '~/utils/taskPartialFailed'

/** 形态图生成完成后需主动调 /form/use 设为使用中的任务类型（与后端约定一致） */
export const FORM_IMAGE_AUTO_USE_TASK_TYPES = new Set([
  'form_image',
  'form_image_batch',
  'form_multi_view',
  'form_multi_grid',
  'form_card_image',
  'form_card_image_batch',
  'form_edit_chat'
])

export function isFormImageAutoUseTaskType(taskType: unknown): boolean {
  return FORM_IMAGE_AUTO_USE_TASK_TYPES.has(normUserTaskType(taskType))
}

/** 角色设定卡生成任务（单张历史类型 + v2026-06 批量类型） */
export function isFormCardImageTaskType(taskType: unknown): boolean {
  const n = normUserTaskType(taskType)
  return n === 'form_card_image' || n === 'form_card_image_batch'
}

function parseCompletePayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null
  if (typeof data === 'string') {
    const text = data.trim()
    if (!text) return null
    try {
      const parsed = JSON.parse(text) as unknown
      return typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return null
}

function pickImageId(raw: unknown): number | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const idRaw = rec.imageId ?? rec.image_id ?? rec.id ?? rec.cardImageId ?? rec.card_image_id
  const n = Number(idRaw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 从 SSE complete / partial_failed / task.resultData 提取需接管的 imageId 列表 */
export function extractImageIdsFromTaskCompleteData(data: unknown): number[] {
  const o = parseCompletePayload(data)
  if (!o) return []

  const ids: number[] = []
  const push = (id: number | null) => {
    if (id != null && !ids.includes(id)) ids.push(id)
  }

  const successItems = Array.isArray(o.successItems) ? o.successItems : []
  for (const item of successItems) {
    push(pickImageId(item))
  }

  const items = Array.isArray(o.items) ? o.items : []
  for (const item of items) {
    push(pickImageId(item))
  }

  const imageIds = Array.isArray(o.imageIds) ? o.imageIds : []
  for (const raw of imageIds) {
    const n = Number(raw)
    push(Number.isFinite(n) && n > 0 ? n : null)
  }

  push(pickImageId(o))

  return ids
}

/**
 * 形态图任务终态后批量设为使用中（幂等）。
 * 仅在白名单任务类型下执行；单条失败不阻塞其它。
 */
export async function claimFormImagesFromTaskComplete(
  taskType: unknown,
  completeData: unknown
): Promise<void> {
  if (!isFormImageAutoUseTaskType(taskType)) return
  const imageIds = extractImageIdsFromTaskCompleteData(completeData)
  if (!imageIds.length) return

  await Promise.allSettled(
    imageIds.map((imageId) => userAssetRpsFormUse({ imageId, id: imageId }))
  )
}
