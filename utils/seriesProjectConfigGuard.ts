import { userStoryboardList } from '~/utils/businessApi'

/** 剧集已生成分镜脚本时，禁止修改项目配置的提示文案 */
export const SERIES_PROJECT_CONFIG_STORYBOARD_BLOCKED_TIP =
  '该剧集已经生成分镜脚本，请删除后重新修改项目配置'

export type SeriesStoryboardGuardResult =
  | { blocked: true; reason: 'has-storyboard' }
  | { blocked: true; reason: 'check-failed'; message: string }
  | { blocked: false }

/**
 * 校验项目下是否已有分镜脚本（用于「项目配置」入口）。
 * - 任意一集 list 非空 → blocked
 * - 任一集请求失败 → fail-closed（禁止打开）
 * - 无分集时视为未生成分镜 → 可打开
 */
export async function checkSeriesProjectConfigStoryboardGuard(
  projectId: number,
  episodeIds: number[]
): Promise<SeriesStoryboardGuardResult> {
  const ids = episodeIds.filter((id) => Number.isFinite(id) && id > 0)
  if (!projectId) {
    return { blocked: true, reason: 'check-failed', message: '缺少项目信息' }
  }
  if (ids.length === 0) return { blocked: false }

  const results = await Promise.all(
    ids.map(async (episodeId) => {
      try {
        const rows = await userStoryboardList({ projectId, episodeId })
        return { ok: true as const, hasScript: Array.isArray(rows) && rows.length > 0 }
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        return {
          ok: false as const,
          message: err?.msg || err?.message || '检查分镜脚本失败'
        }
      }
    })
  )

  for (const r of results) {
    if (!r.ok) {
      return { blocked: true, reason: 'check-failed', message: r.message }
    }
    if (r.hasScript) {
      return { blocked: true, reason: 'has-storyboard' }
    }
  }
  return { blocked: false }
}

/** @deprecated 使用 checkSeriesProjectConfigStoryboardGuard；保留兼容旧调用 */
export async function seriesProjectHasStoryboardScript(
  projectId: number,
  episodeIds: number[]
): Promise<boolean> {
  const r = await checkSeriesProjectConfigStoryboardGuard(projectId, episodeIds)
  return r.blocked && r.reason === 'has-storyboard'
}
