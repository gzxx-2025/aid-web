import type { UserAssetRow } from '~/types/business-api'
import {
  userAssetOfficialQuery,
  userAssetRpsList,
  officialRowToUserAssetRow,
  rpsRowToUserAssetRow
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

/** 本作品资产：文档节点 → /api/user/asset/rps/list 的 assetType */
export const DOCUMENT_STRUCTURE: Array<{ key: string; label: string; apiType: string }> = [
  { key: 'global-setting', label: '全局设定', apiType: 'file' },
  { key: 'story-script', label: '故事剧本', apiType: 'file' },
  { key: 'scene-setting', label: '场景设定', apiType: 'scene' },
  { key: 'character-setting', label: '角色设定', apiType: 'character' },
  { key: 'prop-setting', label: '道具设定', apiType: 'prop' },
  { key: 'scene-image', label: '场景图', apiType: 'scene' },
  { key: 'character-image', label: '角色图', apiType: 'character' },
  { key: 'prop-image', label: '道具图', apiType: 'prop' },
  { key: 'storyboard-script', label: '分镜脚本', apiType: 'file' },
  { key: 'storyboard-image', label: '分镜图', apiType: 'file' },
  { key: 'storyboard-video', label: '分镜视频', apiType: 'file' },
  { key: 'dubbing', label: '配音对口型', apiType: 'file' },
  { key: 'preview', label: '视频预览', apiType: 'file' }
]

/** 文档节点 key → API assetType */
export const DOCUMENT_KEY_TO_API_TYPE: Record<string, string> = Object.fromEntries(
  DOCUMENT_STRUCTURE.map((d) => [d.key, d.apiType])
)

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
  const video = /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(url)
  const thumb = url || extras[0] || ''
  let type: 'image' | 'video' | 'script' = 'script'
  if (video) type = 'video'
  else if (thumb) type = 'image'

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
  const list = await userAssetOfficialQuery({ assetType })
  return list.length
}

export async function fetchPersonalTypeTotal(
  projectId: number,
  episodeId: number,
  assetType: string
): Promise<number> {
  const { rows } = await userAssetRpsList({ projectId, episodeId, assetType })
  return rows.length
}

/** 官方素材列表（已映射为 UserAssetRow，供导入列表使用） */
export async function fetchOfficialAssetsAsRows(assetType: string): Promise<UserAssetRow[]> {
  const list = await userAssetOfficialQuery({ assetType })
  return list.map(officialRowToUserAssetRow)
}

/** 本作品个人资产列表（已映射为 UserAssetRow） */
export async function fetchPersonalRpsAsRows(
  projectId: number,
  episodeId: number,
  assetType: string
): Promise<UserAssetRow[]> {
  const { rows } = await userAssetRpsList({ projectId, episodeId, assetType })
  return rows.map(rpsRowToUserAssetRow)
}
