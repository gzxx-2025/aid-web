import { Modal } from 'ant-design-vue'
import { useRoute } from 'vue-router'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { userAssetRpsList } from '~/utils/businessApi'
import { scriptExtractBaselineStore } from '~/utils/scriptExtractBaseline'
import { normalizeScriptContent } from '~/utils/scriptContentFingerprint'

const SCRIPT_CHANGE_MODAL_TITLE = '剧本已更新'
const SCRIPT_CHANGE_MODAL_CONTENT =
  '检测到剧本有实质性更新，且素材库已有内容。可继续提取以补充新角色/场景/道具，或重新提取（会删除此前自动提取的内容并重新计费）。'

/** 离开剧本页进入素材准备前的强提示；其它入口仅轻提示 */
export function useScriptChangeExtractGate() {
  const creationStore = useCreationStore()
  const route = useRoute()

  async function hasAnyExtractedAssets(projectId: number, episodeId: number): Promise<boolean> {
    const local = creationStore.formData.sceneCharacter
    if (
      (local.scenes?.length ?? 0) > 0 ||
      (local.characters?.length ?? 0) > 0 ||
      (local.props?.length ?? 0) > 0
    ) {
      return true
    }
    try {
      const [scenes, characters, props] = await Promise.all([
        userAssetRpsList({ projectId, episodeId, assetType: 'scene', pageNum: 1, pageSize: 1 }),
        userAssetRpsList({ projectId, episodeId, assetType: 'character', pageNum: 1, pageSize: 1 }),
        userAssetRpsList({ projectId, episodeId, assetType: 'prop', pageNum: 1, pageSize: 1 })
      ])
      const count = (r: { total?: number; rows?: unknown[] } | null | undefined) =>
        Number(r?.total) > 0 || (Array.isArray(r?.rows) && (r?.rows?.length ?? 0) > 0)
      return count(scenes) || count(characters) || count(props)
    } catch {
      return false
    }
  }

  async function resolvePromptContext(): Promise<{
    projectId: number
    episodeId: number
    comicVersion: number
    scriptHtml: string
    hasExtractedAssets: boolean
  } | null> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return null
    const scriptHtml = creationStore.formData.storyScript.content || ''
    const hasExtractedAssets = await hasAnyExtractedAssets(ctx.projectId, ctx.episodeId)
    return {
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      comicVersion: Number(creationStore.scriptComicVersion) || 0,
      scriptHtml,
      hasExtractedAssets
    }
  }

  async function shouldPromptNow(): Promise<boolean> {
    const ctx = await resolvePromptContext()
    if (!ctx) return false
    return scriptExtractBaselineStore.shouldPromptScriptChangeExtract({
      ...ctx,
      isExtracting: creationStore.isExtractingAssets
    })
  }

  function markIgnoredForCurrentChange(ctx: {
    projectId: number
    episodeId: number
    comicVersion: number
    scriptHtml: string
  }) {
    const n = normalizeScriptContent(ctx.scriptHtml)
    scriptExtractBaselineStore.setIgnoredScriptChangeKey(
      ctx.projectId,
      ctx.episodeId,
      scriptExtractBaselineStore.buildChangeKey(ctx.comicVersion, n.hash)
    )
  }

  /**
   * 从剧本页进入素材准备前调用。
   * @returns true=可继续跳转；false=用户取消（应留在剧本页）
   */
  async function confirmLeaveScriptToPrepare(): Promise<boolean> {
    const ctx = await resolvePromptContext()
    if (!ctx) return true
    const need = scriptExtractBaselineStore.shouldPromptScriptChangeExtract({
      ...ctx,
      isExtracting: creationStore.isExtractingAssets
    })
    if (!need) return true

    return await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: SCRIPT_CHANGE_MODAL_TITLE,
        content: SCRIPT_CHANGE_MODAL_CONTENT,
        okText: '去提取',
        cancelText: '暂不提取',
        centered: true,
        onOk: () => {
          creationStore.setExtractModalActionMode('continueOrReextract')
          creationStore.setPendingOpenContinueExtractModal(true)
          resolve(true)
        },
        onCancel: () => {
          markIgnoredForCurrentChange(ctx)
          creationStore.setScriptChangeLightBannerVisible(false)
          resolve(false)
        }
      })
    })
  }

  function openContinueExtractModal() {
    creationStore.setExtractModalActionMode('continueOrReextract')
    creationStore.showExtractAgentModal = true
  }

  function dismissLightBanner() {
    void (async () => {
      const ctx = await resolvePromptContext()
      if (ctx) markIgnoredForCurrentChange(ctx)
      creationStore.setScriptChangeLightBannerVisible(false)
    })()
  }

  async function refreshLightBannerOnPreparePage(options?: { skipIfPendingOpen?: boolean }) {
    if (options?.skipIfPendingOpen && creationStore.pendingOpenContinueExtractModal) return
    const need = await shouldPromptNow()
    creationStore.setScriptChangeLightBannerVisible(need)
  }

  function consumePendingOpenExtractModal(): boolean {
    if (!creationStore.pendingOpenContinueExtractModal) return false
    creationStore.setPendingOpenContinueExtractModal(false)
    creationStore.setScriptChangeLightBannerVisible(false)
    openContinueExtractModal()
    return true
  }

  return {
    confirmLeaveScriptToPrepare,
    refreshLightBannerOnPreparePage,
    consumePendingOpenExtractModal,
    dismissLightBanner,
    openContinueExtractModal,
    shouldPromptNow
  }
}
