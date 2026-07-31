import type { GlobalSettingData } from '~/types'

export type StoryboardVideoGenerateRoute = 'i2v' | 'multi'

export type CreationModeValue = GlobalSettingData['creationMode']

/** 创作模式 → 批量/自动出片路由（宫格 auto_grid 单独走 /video/grid，见后续迭代） */
export function resolveStoryboardVideoGenerateRoute(
  creationMode?: string | null
): StoryboardVideoGenerateRoute | 'auto_grid' {
  const mode = String(creationMode || 'i2v').trim()
  if (mode === 'multi' || mode === 'pro') return 'multi'
  if (mode === 'auto_grid') return 'auto_grid'
  return 'i2v'
}

export function isStoryboardVideoBatchRouteSupported(
  creationMode?: string | null
): boolean {
  return resolveStoryboardVideoGenerateRoute(creationMode) !== 'auto_grid'
}

export function storyboardVideoBatchUnsupportedMessage(): string {
  return '当前创作模式为宫格专业版，批量出片请稍后在分镜视频弹窗中单独操作'
}
