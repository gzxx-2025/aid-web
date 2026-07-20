import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { UserProjectType } from '~/types/business-api'
import { userProjectDetail } from '~/utils/businessApi'

type CreationLike = {
  currentProjectId: number | null
  currentEpisodeId: number | null
  currentProjectType: UserProjectType | null
  setCurrentProjectType: (t: UserProjectType | null) => void
}

/** 从 URL 或 Pinia 解析作品 ID（与 resolveStoryScriptSaveContext 一致：URL 优先） */
export function resolveProjectIdFromRouteAndStore(
  store: Pick<CreationLike, 'currentProjectId'>,
  route: RouteLocationNormalizedLoaded
): number | null {
  const routeProjectIdRaw = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
  const routeProjectId = Number.isFinite(routeProjectIdRaw) && routeProjectIdRaw > 0 ? routeProjectIdRaw : null
  const storePid = Number(store.currentProjectId)
  const storeProjectId = Number.isFinite(storePid) && storePid > 0 ? storePid : null
  return routeProjectId ?? storeProjectId
}

function parseRouteEpisodeId(route: RouteLocationNormalizedLoaded): number | null {
  const raw = route.query.episodeId
  if (raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * 解析剧本保存/拉取所需的 projectId + episodeId（与 detailByProject 一致：电影 episodeId=0，剧集需有效集 ID）
 */
export async function resolveStoryScriptSaveContext(
  store: CreationLike,
  route: RouteLocationNormalizedLoaded
): Promise<{ projectId: number; episodeId: number } | null> {
  const projectId = resolveProjectIdFromRouteAndStore(store, route)
  if (!projectId) return null

  let projectType = store.currentProjectType
  if (!projectType) {
    try {
      const detail = await userProjectDetail(projectId)
      projectType = detail.projectType
      store.setCurrentProjectType(projectType)
    } catch {
      return null
    }
  }

  const routeEp = parseRouteEpisodeId(route)
  let episodeId: number
  if (projectType === 'movie') {
    episodeId =
      routeEp !== null && routeEp >= 0
        ? routeEp
        : store.currentEpisodeId != null && store.currentEpisodeId >= 0
          ? store.currentEpisodeId
          : 0
  } else {
    const e =
      routeEp != null && routeEp > 0
        ? routeEp
        : store.currentEpisodeId != null && store.currentEpisodeId > 0
          ? store.currentEpisodeId
          : null
    if (e == null || e <= 0) return null
    episodeId = e
  }

  return { projectId, episodeId }
}
