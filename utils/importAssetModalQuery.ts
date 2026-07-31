import type { AssetCenterCategoryTreeVO, UserAssetRow } from '~/types/business-api'
import { CREATION_FLOW_STEP_TITLE_MAP } from '~/utils/createFlowStepMeta'
import {
  assetCenterItemToUserAssetRow,
  mergedAssetToUserAssetRow,
  userAssetCenterList,
  userAssetMergedPage
} from '~/utils/businessApi'

/** 素材库左侧/网格：与 ImportScriptModal materialCategories 一致 */
export const MATERIAL_CATEGORY_ROWS: Array<{ key: string; label: string; apiType: string }> = [
  { key: 'scene', label: '场景库', apiType: 'reference_scene' },
  { key: 'character', label: '角色库', apiType: 'reference_character' },
  { key: 'prop', label: '道具库', apiType: 'reference_prop' },
  { key: 'file', label: '文件库', apiType: 'file' },
  { key: 'pose', label: '姿势库', apiType: 'pose' },
  { key: 'effect', label: '特效库', apiType: 'effect' },
  { key: 'expression', label: '表情库', apiType: 'expression' },
  /** 接口暂无独立类型时与 file 共用统计 */
  { key: 'draft', label: '手绘稿库', apiType: 'file' },
  { key: 'misc', label: '其他素材库', apiType: 'file' },
  { key: 'style', label: '风格库', apiType: 'style' }
]

/** 本作品资产：文档节点 → center/list 的 categoryCode / assetType */
export const DOCUMENT_STRUCTURE: Array<{ key: string; label: string; apiType: string }> = [
  { key: 'global-setting', label: CREATION_FLOW_STEP_TITLE_MAP['global-setting'], apiType: 'file' },
  { key: 'story-script', label: CREATION_FLOW_STEP_TITLE_MAP['story-script'], apiType: 'file' },
  { key: 'scene-setting', label: '场景设定', apiType: 'scene' },
  { key: 'character-setting', label: '角色设定', apiType: 'character' },
  { key: 'prop-setting', label: '道具设定', apiType: 'prop' },
  { key: 'scene-image', label: '场景图', apiType: 'scene' },
  { key: 'character-image', label: '角色图', apiType: 'character' },
  { key: 'prop-image', label: '道具图', apiType: 'prop' },
  { key: 'storyboard-script', label: CREATION_FLOW_STEP_TITLE_MAP['storyboard-script'], apiType: 'file' },
  { key: 'storyboard-image', label: '分镜图', apiType: 'file' },
  { key: 'storyboard-video', label: CREATION_FLOW_STEP_TITLE_MAP['storyboard-video'], apiType: 'file' },
  { key: 'dubbing', label: CREATION_FLOW_STEP_TITLE_MAP.dubbing, apiType: 'file' },
  { key: 'preview', label: CREATION_FLOW_STEP_TITLE_MAP.preview, apiType: 'file' }
]

/** 资产中心 categoryCode → center/list 可选 assetType */
export const CENTER_CATEGORY_TO_ASSET_TYPE: Record<string, string> = {
  script: 'file',
  role: 'character',
  scene: 'scene',
  prop: 'prop',
  role_setting: 'character',
  scene_setting: 'scene',
  prop_setting: 'prop',
  role_image: 'character',
  scene_image: 'scene',
  prop_image: 'prop',
  storyboard_script: 'file',
  storyboard_image: 'file',
  storyboard_video: 'file',
  dubbing: 'file',
  preview_video: 'file',
  global_setting: 'file'
}

/** 接口分类兜底（与 center/category/tree 出参 categoryCode 对齐） */
export const CENTER_CATEGORY_FALLBACK: Array<{ categoryCode: string; categoryName: string }> = [
  { categoryCode: 'script', categoryName: '剧本' },
  { categoryCode: 'role', categoryName: '角色' },
  { categoryCode: 'scene', categoryName: '场景' },
  { categoryCode: 'prop', categoryName: '道具' },
  { categoryCode: 'role_setting', categoryName: '角色设定' },
  { categoryCode: 'scene_setting', categoryName: '场景设定' },
  { categoryCode: 'prop_setting', categoryName: '道具设定' },
  { categoryCode: 'role_image', categoryName: '角色图' },
  { categoryCode: 'scene_image', categoryName: '场景图' },
  { categoryCode: 'prop_image', categoryName: '道具图' },
  { categoryCode: 'storyboard_script', categoryName: '分镜脚本' },
  { categoryCode: 'storyboard_image', categoryName: '分镜图' },
  { categoryCode: 'storyboard_video', categoryName: '分镜视频' },
  { categoryCode: 'dubbing', categoryName: '配音' },
  { categoryCode: 'preview_video', categoryName: '预览视频' }
]

/** 文档节点 key → API assetType */
export const DOCUMENT_KEY_TO_API_TYPE: Record<string, string> = Object.fromEntries(
  DOCUMENT_STRUCTURE.map((d) => [d.key, d.apiType])
)

export function categoryCodeToApiType(categoryCode: string): string | undefined {
  return (
    CENTER_CATEGORY_TO_ASSET_TYPE[categoryCode] ??
    DOCUMENT_KEY_TO_API_TYPE[categoryCode]
  )
}

/** 资产中心分类是否为图片类（角色/场景/道具/分镜图等） */
const IMAGE_CATEGORY_CODE_SET = new Set([
  'role_image',
  'scene_image',
  'prop_image',
  'storyboard_image',
  'character-image',
  'scene-image',
  'prop-image',
  'storyboard-image'
])

export function isImageCategoryCode(code: string | null | undefined): boolean {
  if (!code) return false
  if (IMAGE_CATEGORY_CODE_SET.has(code)) return true
  return code.endsWith('_image')
}

/** 从导入弹窗选中节点解析 categoryCode */
export function resolveImportModalCategoryCode(
  category: string | null | undefined,
  selectedCategory?: { key?: string } | null
): string | null {
  if (selectedCategory?.key) return String(selectedCategory.key)
  const cat = String(category || '').trim()
  if (!cat || cat === 'material-library') return null
  if (cat.startsWith('material-')) return cat.replace(/^material-/, '')
  if (cat.startsWith('project-') || cat.startsWith('episode-')) return null
  const parts = cat.split('-')
  if (parts.length >= 3 && /^\d+$/.test(parts[0] ?? '') && /^\d+$/.test(parts[1] ?? '')) {
    return parts.slice(2).join('-')
  }
  const dash = cat.indexOf('-')
  if (dash > 0) return cat.slice(dash + 1)
  return null
}

export type ImportAssetDisplayMode = 'folder' | 'image' | 'file'

export function resolveImportAssetDisplayMode(
  items: Array<{ type?: string; thumbnail?: string }>,
  categoryCode: string | null
): ImportAssetDisplayMode {
  if (!items.length) return 'folder'
  if (items.every((a) => a.type === 'folder')) return 'folder'
  if (isImageCategoryCode(categoryCode)) return 'image'
  if (items.some((a) => a.type === 'image' && a.thumbnail)) return 'image'
  if (items.some((a) => a.type === 'video' && a.thumbnail)) return 'image'
  return 'file'
}

export function materialKeyToApiType(key: string): string {
  return MATERIAL_CATEGORY_ROWS.find((r) => r.key === key)?.apiType ?? 'file'
}

export function materialLabelToKey(label: string): string | null {
  return MATERIAL_CATEGORY_ROWS.find((r) => r.label === label)?.key ?? null
}

export function documentLabelToKey(label: string): string | null {
  return DOCUMENT_STRUCTURE.find((d) => d.label === label)?.key ?? null
}

function formatApiDate(s?: string | null): string {
  if (!s) return ''
  const d = new Date(s.replace(/-/g, '/'))
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('zh-CN')
}

/** 将接口行转为导入弹窗卡片数据 */
export function mapUserAssetRowToImportItem(row: UserAssetRow) {
  const url = (row.refImageUrl || '').trim()
  const extras = row.extraImages
    ? String(row.extraImages)
        .split(/[;,\s]+/)
        .map((x) => x.trim())
        .filter(Boolean)
    : []
  const name = row.assetName || '未命名'
  const categoryCode = String(row.assetType || '').trim()
  const video = /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(url)
  const thumb = url || extras[0] || ''
  let type: 'image' | 'video' | 'script' = 'script'
  if (video) type = 'video'
  else if (thumb || isImageCategoryCode(categoryCode)) type = 'image'

  return {
    id: String(row.id),
    name,
    type,
    updatedAt: formatApiDate(row.updateTime || row.createTime),
    size: 0,
    thumbnail: type === 'video' ? '' : thumb,
    url: url || thumb,
    content: row.personalityDesc || '',
    raw: row
  }
}

export async function fetchOfficialTypeTotal(assetType: string): Promise<number> {
  const rows = await fetchOfficialMaterialAllRows()
  return countRowsByAssetType(rows).get(assetType) || 0
}

export async function fetchPersonalTypeTotal(
  projectId: number,
  episodeId: number,
  categoryCode?: string
): Promise<number> {
  const { total } = await userAssetCenterList({
    projectId,
    episodeId,
    ...(categoryCode ? { categoryCode } : {}),
    pageNum: 1,
    pageSize: 1
  })
  return total
}

const officialMaterialAllCache = { rows: null as UserAssetRow[] | null }
let officialMaterialAllInflight: Promise<UserAssetRow[]> | null = null

export function clearOfficialMaterialAllCache() {
  officialMaterialAllCache.rows = null
  officialMaterialAllInflight = null
}

/**
 * 素材库：不传 assetType / keyword，一次（必要时翻页）拉齐官方素材，按 scope 缓存。
 * 与原先多次按 assetType 请求 OFFICIAL 的展示范围一致。
 */
export async function fetchOfficialMaterialAllRows(
  options?: { force?: boolean }
): Promise<UserAssetRow[]> {
  if (!options?.force && officialMaterialAllCache.rows) {
    return officialMaterialAllCache.rows
  }
  if (!options?.force && officialMaterialAllInflight) {
    return officialMaterialAllInflight
  }

  const task = (async () => {
    const pageSize = 100
    let pageNum = 1
    let total = Infinity
    const all: UserAssetRow[] = []

    while (all.length < total) {
      const { list, total: t } = await userAssetMergedPage({
        sourceFlag: 'OFFICIAL',
        pageNum,
        pageSize
      })
      total = Number.isFinite(t) ? t : list.length
      all.push(...list.map(mergedAssetToUserAssetRow))
      if (!list.length || list.length < pageSize) break
      pageNum += 1
      if (pageNum > 50) break
    }

    officialMaterialAllCache.rows = all
    return all
  })()

  officialMaterialAllInflight = task
  try {
    return await task
  } finally {
    officialMaterialAllInflight = null
  }
}

/** 按 assetType 统计数量 */
export function countRowsByAssetType(rows: UserAssetRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const type = String(row.assetType || '').trim()
    if (!type) continue
    map.set(type, (map.get(type) || 0) + 1)
  }
  return map
}

/** 从全量官方素材中筛某一 assetType */
export function filterRowsByAssetType(
  rows: UserAssetRow[],
  assetType: string
): UserAssetRow[] {
  const type = String(assetType || '').trim()
  if (!type) return rows
  return rows.filter((r) => String(r.assetType || '').trim() === type)
}

/** 素材库分类文件夹：用全量 list 按 apiType 聚合计数（draft/misc 与 file 共用同一计数，与原先一致） */
export function buildMaterialFolderItems(
  countByType: Map<string, number>,
  updatedAt: string
): Array<{
  id: string
  name: string
  type: 'folder'
  updatedAt: string
  itemCount: number
}> {
  return MATERIAL_CATEGORY_ROWS.map((c) => ({
    id: `folder-m-${c.key}`,
    name: c.label,
    type: 'folder' as const,
    updatedAt,
    itemCount: countByType.get(c.apiType) || 0
  }))
}

/** 官方素材列表：有全量缓存则本地过滤，否则按 assetType 单次请求 */
export async function fetchOfficialAssetsAsRows(assetType: string): Promise<UserAssetRow[]> {
  if (officialMaterialAllCache.rows) {
    return filterRowsByAssetType(officialMaterialAllCache.rows, assetType)
  }
  const { list } = await userAssetMergedPage({
    assetType,
    sourceFlag: 'OFFICIAL',
    pageNum: 1,
    pageSize: 100
  })
  return list.map(mergedAssetToUserAssetRow)
}

/** 本作品/历史个人资产列表（center/list）；不传 categoryCode 时拉该范围内全部分类混合 */
export async function fetchPersonalCenterRows(
  projectId: number,
  episodeId: number,
  categoryCode?: string,
  assetType?: string
): Promise<UserAssetRow[]> {
  const { list } = await userAssetCenterList({
    projectId,
    episodeId,
    ...(categoryCode ? { categoryCode } : {}),
    ...(assetType ? { assetType } : {}),
    pageNum: 1,
    pageSize: 100
  })
  return list.map(assetCenterItemToUserAssetRow)
}

const personalCenterAllCache = new Map<string, UserAssetRow[]>()
const personalCenterAllInflight = new Map<string, Promise<UserAssetRow[]>>()

function personalCenterCacheKey(projectId: number, episodeId: number): string {
  return `${projectId}:${episodeId}`
}

export function clearPersonalCenterAllCache(projectId?: number, episodeId?: number) {
  if (projectId == null) {
    personalCenterAllCache.clear()
    personalCenterAllInflight.clear()
    return
  }
  const key = personalCenterCacheKey(projectId, episodeId ?? 0)
  personalCenterAllCache.delete(key)
  personalCenterAllInflight.delete(key)
}

/**
 * 不传 categoryCode，一次（必要时翻页）拉齐该项目/剧集下全部分类资产，并按 scope 缓存。
 * 供导入弹窗文件夹统计与进入分类后过滤复用，避免按分类多次请求 list。
 */
export async function fetchPersonalCenterAllRows(
  projectId: number,
  episodeId: number,
  options?: { force?: boolean }
): Promise<UserAssetRow[]> {
  const key = personalCenterCacheKey(projectId, episodeId)
  if (!options?.force && personalCenterAllCache.has(key)) {
    return personalCenterAllCache.get(key)!
  }
  if (!options?.force) {
    const inflight = personalCenterAllInflight.get(key)
    if (inflight) return inflight
  }

  const task = (async () => {
    const pageSize = 100
    let pageNum = 1
    let total = Infinity
    const all: UserAssetRow[] = []

    while (all.length < total) {
      const { list, total: t } = await userAssetCenterList({
        projectId,
        episodeId,
        pageNum,
        pageSize
      })
      total = Number.isFinite(t) ? t : list.length
      all.push(...list.map(assetCenterItemToUserAssetRow))
      if (!list.length || list.length < pageSize) break
      pageNum += 1
      if (pageNum > 50) break
    }

    personalCenterAllCache.set(key, all)
    return all
  })()

  personalCenterAllInflight.set(key, task)
  try {
    return await task
  } finally {
    personalCenterAllInflight.delete(key)
  }
}

/** 按 categoryCode（映射到 UserAssetRow.assetType）统计数量 */
export function countRowsByCategoryCode(rows: UserAssetRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const code = String(row.assetType || '').trim()
    if (!code) continue
    map.set(code, (map.get(code) || 0) + 1)
  }
  return map
}

/** 从全量 list 中筛出某一分类 */
export function filterRowsByCategoryCode(
  rows: UserAssetRow[],
  categoryCode: string
): UserAssetRow[] {
  const code = String(categoryCode || '').trim()
  if (!code) return rows
  return rows.filter((r) => String(r.assetType || '').trim() === code)
}

/** 进入分类：有全量缓存则本地过滤，否则按 categoryCode 单次请求 */
export async function fetchPersonalCenterRowsByCategory(
  projectId: number,
  episodeId: number,
  categoryCode: string
): Promise<UserAssetRow[]> {
  const key = personalCenterCacheKey(projectId, episodeId)
  const cached = personalCenterAllCache.get(key)
  if (cached) return filterRowsByCategoryCode(cached, categoryCode)
  return fetchPersonalCenterRows(projectId, episodeId, categoryCode)
}

/** 分类文件夹卡片：优先树 assetCount，否则用全量 list 聚合计数 */
export function buildCategoryFolderItems(
  categories: AssetCenterCategoryTreeVO[],
  countByCode: Map<string, number>,
  idPrefix: string,
  updatedAt: string
): Array<{
  id: string
  name: string
  type: 'folder'
  updatedAt: string
  itemCount: number
}> {
  return categories.map((cat) => {
    const code = cat.categoryCode || ''
    const fromTree = typeof cat.assetCount === 'number' ? cat.assetCount : null
    const total = fromTree != null ? fromTree : countByCode.get(code) || 0
    return {
      id: `${idPrefix}${code}`,
      name: cat.categoryName || code,
      type: 'folder' as const,
      updatedAt,
      itemCount: total
    }
  })
}

/** @deprecated 请用 fetchPersonalCenterRows */
export async function fetchPersonalRpsAsRows(
  projectId: number,
  episodeId: number,
  assetType: string
): Promise<UserAssetRow[]> {
  const doc = DOCUMENT_STRUCTURE.find((d) => d.apiType === assetType)
  const categoryCode = doc?.key ?? assetType
  return fetchPersonalCenterRows(projectId, episodeId, categoryCode, assetType)
}

function isCategoryTreeNode(node: AssetCenterCategoryTreeVO): boolean {
  const code = String(node.categoryCode ?? '').trim()
  return code.length > 0
}

export function findAssetCenterProject(
  tree: AssetCenterCategoryTreeVO[],
  projectId: number
): AssetCenterCategoryTreeVO | undefined {
  const pid = Number(projectId)
  if (!Number.isFinite(pid)) return undefined
  return tree.find((p) => Number(p.projectId) === pid)
}

export function findAssetCenterEpisode(
  projectNode: AssetCenterCategoryTreeVO | undefined,
  episodeId: number
): AssetCenterCategoryTreeVO | undefined {
  const eid = Number(episodeId)
  return projectNode?.children?.find((ep) => Number(ep.episodeId ?? 0) === eid)
}

/** 剧集节点展示名（与接口 VO 字段一致） */
export function episodeDisplayLabel(ep: AssetCenterCategoryTreeVO): string {
  return (
    ep.episodeTitle ||
    (ep.episodeNo != null ? `第${ep.episodeNo}集` : '电影')
  )
}

/** 分类子节点（过滤无 categoryCode 的占位节点） */
export function getEpisodeCategories(
  episodeNode: AssetCenterCategoryTreeVO | undefined
): AssetCenterCategoryTreeVO[] {
  return (episodeNode?.children ?? []).filter(isCategoryTreeNode)
}

/** 节点 assetCount；分类层用自身计数，剧集层汇总子分类 */
export function resolveNodeAssetCount(node: AssetCenterCategoryTreeVO): number | null {
  if (typeof node.assetCount === 'number') return node.assetCount
  const cats = getEpisodeCategories(node)
  if (!cats.length) return null
  let sum = 0
  let has = false
  for (const c of cats) {
    if (typeof c.assetCount === 'number') {
      sum += c.assetCount
      has = true
    }
  }
  return has ? sum : null
}

/** 当前作品：在分类树中定位项目 → 剧集节点（兼容项目下直接挂分类的两层结构） */
export function resolveCurrentEpisodeNode(
  tree: AssetCenterCategoryTreeVO[],
  projectId: number,
  episodeId: number
): AssetCenterCategoryTreeVO | undefined {
  const project = findAssetCenterProject(tree, projectId)
  const children = project?.children ?? []
  if (!children.length) return undefined

  // 电影等：分类直接挂在项目下
  if (children.some(isCategoryTreeNode)) {
    return {
      ...project!,
      episodeId: Number.isFinite(episodeId) ? episodeId : 0,
      children: children.filter(isCategoryTreeNode)
    }
  }

  let hit = findAssetCenterEpisode(project, episodeId)
  if (hit) return hit
  if (episodeId === 0 || episodeId == null) {
    hit =
      project!.children!.find((c) => Number(c.episodeId ?? 0) === 0) ??
      project!.children![0]
  }
  if (!hit && project!.children!.length === 1) {
    hit = project!.children![0]
  }
  return hit
}

/** 分类文件夹数量：优先接口 assetCount，否则一次拉全量后按分类聚合（带缓存） */
export async function resolveCategoryFolderCount(
  projectId: number,
  episodeId: number,
  cat: AssetCenterCategoryTreeVO
): Promise<number> {
  if (typeof cat.assetCount === 'number') return cat.assetCount
  const code = cat.categoryCode
  if (!code) return 0
  try {
    const rows = await fetchPersonalCenterAllRows(projectId, episodeId)
    return countRowsByCategoryCode(rows).get(code) || 0
  } catch {
    return 0
  }
}
