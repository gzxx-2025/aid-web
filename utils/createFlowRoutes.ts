import type { CreationStep } from '~/types'

/** 创作流程步骤顺序（与左侧流程条一致） */
export const CREATE_FLOW_STEP_ORDER: CreationStep[] = [
  'global-setting',
  'story-script',
  'scene-character',
  'storyboard-script',
  'storyboard-video',
  'dubbing',
  'preview'
]

export function creationStepToRoutePath(step: CreationStep): string {
  return `/create/${step}`
}

/** 从 `/create/story-script` 等路径解析步骤；`/create` 无子路径时返回 null */
export function routePathToCreationStep(path: string): CreationStep | null {
  const m = path.match(/^\/create\/([^/?#]+)/)
  if (!m) return null
  const seg = m[1]
  if (seg === 'index') return null
  const hit = CREATE_FLOW_STEP_ORDER.find((k) => k === seg)
  return hit ?? null
}

export function creationStepIndexFromPath(path: string): number {
  const key = routePathToCreationStep(path)
  if (!key) return 0
  const i = CREATE_FLOW_STEP_ORDER.indexOf(key)
  return i >= 0 ? i : 0
}

/** 剧集流程首屏：上传剧本（无顶部步骤条） */
export const CREATE_SERIES_SCRIPT_UPLOAD_SEGMENT = 'series-script-upload'
export const CREATE_SERIES_SCRIPT_UPLOAD_PATH = `/create/${CREATE_SERIES_SCRIPT_UPLOAD_SEGMENT}` as const

export function isSeriesScriptUploadPath(path: string): boolean {
  const normalized = (path.split('?')[0] || '').replace(/\/+$/, '') || '/'
  return normalized === CREATE_SERIES_SCRIPT_UPLOAD_PATH
}

/** 剧集：分集列表（解析剧本后进入，无顶部步骤条） */
export const CREATE_SERIES_EPISODE_LIST_SEGMENT = 'series-episode-list'
export const CREATE_SERIES_EPISODE_LIST_PATH = `/create/${CREATE_SERIES_EPISODE_LIST_SEGMENT}` as const

export function isSeriesEpisodeListPath(path: string): boolean {
  const normalized = (path.split('?')[0] || '').replace(/\/+$/, '') || '/'
  return normalized === CREATE_SERIES_EPISODE_LIST_PATH
}

/** 剧集专用壳层：上传页 + 分集列表（隐藏创作步骤条、同套顶栏风格） */
export function isSeriesFlowChromePath(path: string): boolean {
  return isSeriesScriptUploadPath(path) || isSeriesEpisodeListPath(path)
}

/** 创作流程返回来源：独立「我的作品」页 */
export const CREATE_FLOW_FROM_WORKS = 'works' as const
/** 创作流程返回来源：流程页内嵌作品库面板 */
export const CREATE_FLOW_FROM_PANEL_WORKS = 'panel-works' as const

export type CreateFlowBackTarget =
  | { type: 'path'; path: string }
  | { type: 'route'; path: string; query: Record<string, string | string[] | null | undefined> }

/** 根据路由 query.from 解析流程页顶部返回按钮的目标 */
export function resolveCreateFlowBackTarget(
  route: { path: string; query: Record<string, unknown> }
): CreateFlowBackTarget {
  const from = String(route.query.from ?? '')
  if (from === CREATE_FLOW_FROM_WORKS) {
    return { type: 'path', path: '/works' }
  }
  if (from === CREATE_FLOW_FROM_PANEL_WORKS) {
    const query: Record<string, string | string[] | null | undefined> = {
      ...(route.query as Record<string, string | string[] | null | undefined>)
    }
    delete query.from
    query.panel = 'works'
    return { type: 'route', path: route.path, query }
  }
  return { type: 'path', path: '/' }
}

export function withCreateFlowFromQuery(
  query: Record<string, string>,
  embedded: boolean
): Record<string, string> {
  return {
    ...query,
    from: embedded ? CREATE_FLOW_FROM_PANEL_WORKS : CREATE_FLOW_FROM_WORKS
  }
}

/** 流程页右侧面板为内嵌「我的作品 / 资产库」时（query.panel），非流程编辑主视图 */
export function isCreateFlowEmbeddedLibraryPanel(
  query: Record<string, unknown>
): boolean {
  const panel = String(query.panel ?? '').toLowerCase()
  return panel === 'works' || panel === 'assets'
}
