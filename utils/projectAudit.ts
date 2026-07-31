/** 作品审核 / 公开锁 — 与 `components/steps/接口.md` 对齐 */

export const PROJECT_PUBLIC_LOCK_MSG = '请先关闭项目公开'

export type AuditMediaRow = {
  status?: number | null
  pendingVideoUrl?: string | null
}

export function hasPendingReauditVideo(row?: AuditMediaRow | null): boolean {
  return Boolean(String(row?.pendingVideoUrl || '').trim())
}

/**
 * 成品预览点「导出/发布」前：是否需确认「新版会替换旧版」。
 * - 仅有待审新片（pendingVideoUrl）时提示
 * - 同一 pendingVideoUrl 确认过后不再提示，换新片（URL 变化）再提示
 */
export function shouldConfirmReplacePublishedVideo(payload: {
  pendingVideoUrl?: string | null
  ackedPendingVideoUrl?: string | null
}): boolean {
  const pending = String(payload.pendingVideoUrl || '').trim()
  if (!pending) return false
  const acked = String(payload.ackedPendingVideoUrl || '').trim()
  return pending !== acked
}

/** 是否允许提交（或重新提交）审核 */
export function canSubmitAudit(row?: AuditMediaRow | null): boolean {
  const status = row?.status
  if (status === 3) return false
  if (status === 4) return hasPendingReauditVideo(row)
  return true
}

/**
 * 发布至案例广场前是否需要先调 submit-audit。
 * - 已过审且无待审新片 → 跳过提审，只 update + publish
 * - 已过审但有 pendingVideoUrl / 其它可提审态 → 需提审
 * - 审核中 → 不可提审（调用方应拦截）
 */
export function needsSubmitAuditBeforePublish(row?: AuditMediaRow | null): boolean {
  return canSubmitAudit(row)
}

export function auditSubmitBlockedReason(row?: AuditMediaRow | null): string | null {
  const status = row?.status
  if (status === 3) return '作品审核中，请耐心等待'
  if (status === 4 && !hasPendingReauditVideo(row)) return '作品已通过审核'
  return null
}

export function isProjectPublicLockError(err: unknown): boolean {
  const msg = String((err as { msg?: string })?.msg || (err as Error)?.message || '').trim()
  return msg.includes(PROJECT_PUBLIC_LOCK_MSG)
}

export function projectPublicLockUserHint(): string {
  return '作品已公开，请先在作品库关闭公开后再修改'
}

export function exportStatusBadgeLabel(exportStatus?: number | null): string | null {
  switch (exportStatus) {
    case 1:
      return '合成中'
    case 2:
      return '已合成'
    case 3:
      return '合成失败'
    default:
      return null
  }
}

/** 作品卡片左上角审核态文案：3 审核中 / 4 已发布或审核通过 / 5 审核失败 */
export function auditStatusBadgeLabel(
  status?: number | null,
  isPublic?: string | null
): string | null {
  if (status === 3) return '审核中'
  if (status === 5) return '审核失败'
  if (status === 4) return isPublic === '1' ? '已发布' : '审核通过'
  return null
}

export type AuditBadgeTone = 'reviewing' | 'failed' | 'published' | 'passed'

export function auditStatusBadgeTone(
  status?: number | null,
  isPublic?: string | null
): AuditBadgeTone | null {
  if (status === 3) return 'reviewing'
  if (status === 5) return 'failed'
  if (status === 4) return isPublic === '1' ? 'published' : 'passed'
  return null
}

/** 导出成功后的可播放地址：重新导出过审场景优先预览待审新片 */
export function resolveExportPlaybackUrl(payload: {
  finalVideoUrl?: string | null
  pendingVideoUrl?: string | null
  needReaudit?: boolean | null
}): string {
  const pending = String(payload.pendingVideoUrl || '').trim()
  const finalUrl = String(payload.finalVideoUrl || '').trim()
  if (payload.needReaudit && pending) return pending
  return finalUrl || pending
}
