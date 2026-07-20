import type { StoryboardPanel, StoryboardVideoPanel } from '~/types'
import type { StoryboardRecordListType, StoryboardRecordRow } from '~/types/business-api'
import { userStoryboardRecordListByStoryboard } from '~/utils/businessApi'
import { pickStoryboardCoverImage, sortStoryboardImagesForParent } from '~/utils/storyboardImageCover'

export type ProjectEpisodeContext = { projectId: number; episodeId: number }

export function groupStoryboardRecordsByStoryboardId(
  rows: StoryboardRecordRow[]
): Map<number, StoryboardRecordRow[]> {
  const map = new Map<number, StoryboardRecordRow[]>()
  for (const r of rows) {
    const sid = Number(r.storyboardId)
    if (!Number.isFinite(sid) || sid <= 0) continue
    const list = map.get(sid) ?? []
    list.push(r)
    map.set(sid, list)
  }
  return map
}

export async function fetchProjectStoryboardRecords(
  ctx: ProjectEpisodeContext,
  type: StoryboardRecordListType
): Promise<StoryboardRecordRow[]> {
  return userStoryboardRecordListByStoryboard({
    projectId: ctx.projectId,
    episodeId: ctx.episodeId,
    type
  })
}

export async function fetchStoryboardRecordsForStoryboard(
  ctx: ProjectEpisodeContext,
  storyboardId: number,
  type: StoryboardRecordListType
): Promise<StoryboardRecordRow[]> {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return []
  const rows = await fetchProjectStoryboardRecords(ctx, type)
  return rows.filter((r) => Number(r.storyboardId) === sid)
}

export async function fetchProjectImageAndVideoRecordMaps(ctx: ProjectEpisodeContext): Promise<{
  imageRows: StoryboardRecordRow[]
  videoRows: StoryboardRecordRow[]
  imageByStoryboardId: Map<number, StoryboardRecordRow[]>
  videoByStoryboardId: Map<number, StoryboardRecordRow[]>
}> {
  const [imageRows, videoRows] = await Promise.all([
    fetchProjectStoryboardRecords(ctx, 'image'),
    fetchProjectStoryboardRecords(ctx, 'video')
  ])
  return {
    imageRows,
    videoRows,
    imageByStoryboardId: groupStoryboardRecordsByStoryboardId(imageRows),
    videoByStoryboardId: groupStoryboardRecordsByStoryboardId(videoRows)
  }
}

export function mapRecordRowToPanelImageItem(
  r: StoryboardRecordRow,
  options?: { title?: string }
): { id: string; url: string; thumbnail: string; title: string; [key: string]: unknown } {
  const url = String(r.fileUrl ?? '').trim()
  const title = options?.title?.trim() || '未命名'
  return {
    id: String(r.id ?? ''),
    url,
    thumbnail: url,
    title,
    source: '生成记录',
    importDate: r.createTime || undefined,
    createdAt: r.createTime || undefined,
    isSelected: r.isSelected === 1,
    _fromServer: true,
    _serverRow: r
  }
}

export function mapRecordRowToPanelVideoItem(
  r: StoryboardRecordRow,
  options?: { title?: string }
): { id: string; url: string; title: string; [key: string]: unknown } {
  const url = String(r.fileUrl ?? '').trim()
  const label = options?.title?.trim() || '分镜视频'
  return {
    id: String(r.id ?? ''),
    url,
    title: label,
    source: '生成记录',
    importDate: r.createTime || undefined,
    isStoryboardVideo: r.isSelected === 1,
    _fromServer: true,
    _serverRow: r
  }
}

export function hydrateScriptPanelsWithImageRecords(
  panels: StoryboardPanel[],
  imageByStoryboardId: Map<number, StoryboardRecordRow[]>
): StoryboardPanel[] {
  return panels.map((panel) => {
    const sid = Number(panel.id)
    const rows = imageByStoryboardId.get(sid) ?? []
    if (!rows.length) return panel

    const images = sortStoryboardImagesForParent(
      rows
        .filter((r) => !!String(r.fileUrl ?? '').trim())
        .map((r) => mapRecordRowToPanelImageItem(r))
    )
    const cover = pickStoryboardCoverImage(images)
    const coverUrl = String(cover?.url || cover?.thumbnail || '').trim()
    return {
      ...panel,
      images,
      ...(coverUrl ? { finalImageUrl: coverUrl } : {})
    }
  })
}

export function hydrateVideoPanelsWithVideoRecords(
  panels: StoryboardVideoPanel[],
  scriptPanels: StoryboardPanel[],
  videoByStoryboardId: Map<number, StoryboardRecordRow[]>
): StoryboardVideoPanel[] {
  return panels.map((panel, index) => {
    const sid = Number(scriptPanels[index]?.id)
    const rows = videoByStoryboardId.get(sid) ?? []
    if (!rows.length) return panel

    const videos = rows
      .filter((r) => !!String(r.fileUrl ?? '').trim())
      .map((r) => mapRecordRowToPanelVideoItem(r, { title: panel.title }))
    return { ...panel, videos }
  })
}
