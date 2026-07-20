import type { StoryboardPanel } from '~/types'
import type { UserStoryboardListRow } from '~/types/business-api'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import { scriptApiTextToEditorHtml } from '~/utils/htmlPlain'
import {
  extractStoryboardTitleSuffix,
  formatStoryboardScriptTitle
} from '~/utils/storyboardPanelTitle'

const STORYBOARD_SCRIPT_SKELETON_ID_PREFIX = 'gen-skeleton-'

/** 分镜脚本生成中前端占位行（仅 UI，未落库） */
export function isStoryboardScriptSkeletonPanelId(id: unknown): boolean {
  return String(id ?? '').startsWith(STORYBOARD_SCRIPT_SKELETON_ID_PREFIX)
}

export function stripStoryboardScriptSkeletonPanels(panels: StoryboardPanel[]): StoryboardPanel[] {
  return panels.filter((p) => !isStoryboardScriptSkeletonPanelId(p.id))
}

/** 已落库的分镜脚本行（纯数字 id），用于判断列表是否应展示空态 */
export function getPersistedStoryboardScriptPanels(panels: StoryboardPanel[]): StoryboardPanel[] {
  return stripStoryboardScriptSkeletonPanels(panels).filter(
    (p) => parseServerStoryboardId(p.id) != null
  )
}

function mapFinalImageToPanelImages(row: UserStoryboardListRow): StoryboardPanel['images'] {
  const url = (row.finalImageUrl ?? '').trim()
  if (!url) return undefined
  const imageId = row.finalImageId
  return [
    {
      id: imageId != null ? String(imageId) : `final-image-${row.id}`,
      url,
      thumbnail: url,
      title: '分镜图',
      isSelected: true,
      _fromServer: true,
      _serverRow: { id: imageId ?? undefined, isSelected: 1 }
    }
  ]
}

/** 将 /api/user/storyboard/list 行映射为分镜脚本步骤面板数据（序号按列表下标，不用 sortOrder/id） */
export function mapStoryboardListRowToPanel(
  row: UserStoryboardListRow,
  index: number
): StoryboardPanel {
  const story = (row.storyScript ?? '').trim()
  const dialogue = row.dialogueText != null ? String(row.dialogueText).trim() : ''
  const suffix = extractStoryboardTitleSuffix(row.title)
  const finalImageUrl = (row.finalImageUrl ?? '').trim() || undefined
  return {
    id: String(row.id),
    title: formatStoryboardScriptTitle(index, suffix),
    scriptContent: story ? scriptApiTextToEditorHtml(story) : undefined,
    dialogueText: dialogue || undefined,
    finalImageUrl,
    images: mapFinalImageToPanelImages(row)
  }
}
