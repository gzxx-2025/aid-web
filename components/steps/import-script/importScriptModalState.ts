import type { AssetCenterCategoryTreeVO } from '~/types/business-api'
import {
  CENTER_CATEGORY_FALLBACK,
  getEpisodeCategories,
  resolveCurrentEpisodeNode
} from '~/utils/importAssetModalQuery'
import type { ImportScriptTab } from './ImportScriptSidebarTree'

export interface ImportScriptModalProps {
  open: boolean
  title?: string
  zIndex?: number
  multiple?: boolean
  acceptAssetType?: 'image' | 'video' | 'script' | 'all'
  initialTab?: ImportScriptTab | null
  initialMaterialCategory?: string | null
  beforeScriptImport?: () => Promise<boolean>
  onOpenChange: (open: boolean) => void
  onImport?: (content: string | any) => void
  onImportMultiple?: (assets: any[]) => void
}

export function isVideoAsset(asset: Record<string, unknown> | null | undefined): boolean {
  if (!asset) return false
  if (asset.type === 'video') return true
  const url = String(asset.url || asset.src || '')
  const name = String(asset.name || asset.title || '')
  const mime = String(asset.mimeType || asset.type || '')
  const videoExt = /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i
  return videoExt.test(url) || videoExt.test(name) || mime.startsWith('video/')
}

export function resolveImportModalProjectState(input: {
  projects: Array<{ id: string; name: string }>
  selectedProjectId: string
  storeProjectId: number | null
  storeWorkTitle: string
  episodeId: number
  assetCenterTree: AssetCenterCategoryTreeVO[]
  treeLoading: boolean
}) {
  const selectedProject = input.projects.find((project) => project.id === input.selectedProjectId)
  const currentProject = selectedProject || input.projects[0] || {
    id: input.storeProjectId ? String(input.storeProjectId) : '',
    name: input.storeWorkTitle || '未命名作品'
  }
  const displayProjectId =
    input.selectedProjectId ||
    (input.storeProjectId ? String(input.storeProjectId) : '') ||
    input.projects[0]?.id ||
    ''
  const projectId = Number(displayProjectId)
  const episode = Number.isFinite(projectId) && projectId > 0
    ? resolveCurrentEpisodeNode(input.assetCenterTree, projectId, input.episodeId)
    : undefined
  const treeCategories = getEpisodeCategories(episode)
  const categories = treeCategories.length || input.treeLoading || !Number.isFinite(projectId) || projectId <= 0
    ? treeCategories
    : CENTER_CATEGORY_FALLBACK.map((item) => ({
        projectId,
        projectName: currentProject.name,
        categoryCode: item.categoryCode,
        categoryName: item.categoryName,
        assetCount: null
      }))

  return { currentProject, displayProjectId, currentEpisodeCategories: categories }
}
