/** form_image / form_image_batch SSE complete 与 task.resultData 结构 */
export interface FormImageBatchCompleteData {
  totalCount?: number
  successCount?: number
  failCount?: number
  successItems?: unknown[]
  failedItems?: Array<{ formId?: number; assetId?: number; index?: number; message?: string }>
}

export type FormImageBatchCompleteOutcome =
  | { ok: true; successCount: number; failCount: number; partialFailMessages?: string[] }
  | { ok: false; errorMessage: string; failCount?: number }

function parseResultPayload(raw: unknown): FormImageBatchCompleteData | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as FormImageBatchCompleteData
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return null
    try {
      const parsed = JSON.parse(text) as unknown
      return typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
        ? (parsed as FormImageBatchCompleteData)
        : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * 解析形态图批量任务 complete / resultData。
 * 后端在单项失败时仍推 complete（非 error），须根据 successCount / failedItems 判断成败。
 */
export function resolveFormImageBatchCompleteOutcome(data: unknown): FormImageBatchCompleteOutcome | null {
  const o = parseResultPayload(data)
  if (!o) return null

  const failedItems = Array.isArray(o.failedItems) ? o.failedItems : []
  const successItems = Array.isArray(o.successItems) ? o.successItems : []
  const total = typeof o.totalCount === 'number' ? o.totalCount : undefined
  const success = typeof o.successCount === 'number' ? o.successCount : undefined
  const fail = typeof o.failCount === 'number' ? o.failCount : undefined

  const hasBatchFields =
    total != null || success != null || fail != null || failedItems.length > 0 || successItems.length > 0
  if (!hasBatchFields) return null

  const successCount = success ?? successItems.length
  const failCount = fail ?? failedItems.length
  const failMessages = failedItems.map((x) => String(x?.message ?? '').trim()).filter(Boolean)

  if (successCount <= 0 && failCount > 0) {
    const errorMessage = failMessages.join('；') || '形态图生成失败'
    return { ok: false as const, errorMessage, failCount }
  }

  if (successCount > 0 && failCount > 0) {
    return {
      ok: true as const,
      successCount,
      failCount,
      partialFailMessages: failMessages
    }
  }

  return { ok: true as const, successCount: Math.max(successCount, 0), failCount: Math.max(failCount, 0) }
}
