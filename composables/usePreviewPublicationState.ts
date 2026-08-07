import type { ComputedRef, Ref } from 'vue'
import { computed, watch } from 'vue'
import { userEpisodeDetail } from '~/utils/businessApi'
import { applyEpisodeRowToCreationStore } from '~/utils/hydrateCreationStoreFromProjectDetail'
import { isProjectPublished } from '~/utils/projectAudit'
import { useCreationStore } from '~/stores/creation'

type PreviewPublicationStateOptions = {
  pageReady: Ref<boolean>
  isPreviewStep: ComputedRef<boolean>
}

/**
 * 成品预览的审核/发布状态入口。
 * 项目公开态来自 project/detail；剧集审核态在进入预览时按 episode/detail 恢复，保证刷新后仍可靠。
 */
export function usePreviewPublicationState(options: PreviewPublicationStateOptions) {
  const creationStore = useCreationStore()
  let episodeLoadGeneration = 0
  let loadedEpisodeKey = ''

  const isPublished = computed(() => isProjectPublished(creationStore.currentProjectIsPublic))

  const auditFailureReason = computed(() => {
    if (!options.isPreviewStep.value) return ''
    const isSeries = creationStore.currentProjectType === 'series'
    const status = isSeries
      ? creationStore.currentEpisodeStatus
      : creationStore.currentProjectStatus
    if (status !== 5) return ''
    // 开源分支 store 可能无 statusReason 字段，统一回落文案
    const storeAny = creationStore as {
      currentEpisodeStatusReason?: string | null
      currentProjectStatusReason?: string | null
    }
    const reason = isSeries
      ? storeAny.currentEpisodeStatusReason
      : storeAny.currentProjectStatusReason
    return String(reason || '').trim() || '未提供具体失败原因'
  })

  watch(
    () =>
      [
        options.pageReady.value,
        options.isPreviewStep.value,
        creationStore.currentProjectType,
        creationStore.currentProjectId,
        creationStore.currentEpisodeId
      ] as const,
    ([ready, preview, projectType, projectId, episodeId]) => {
      const generation = ++episodeLoadGeneration
      if (!ready || !preview || projectType !== 'series') return
      const pid = Number(projectId)
      const eid = Number(episodeId)
      if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(eid) || eid <= 0) return

      const episodeKey = `${pid}:${eid}`
      if (loadedEpisodeKey === episodeKey) return
      loadedEpisodeKey = episodeKey

      void userEpisodeDetail({ id: eid })
        .then((episode) => {
          if (generation !== episodeLoadGeneration) return
          if (
            creationStore.currentProjectId !== pid ||
            creationStore.currentEpisodeId !== eid ||
            creationStore.currentProjectType !== 'series'
          ) {
            return
          }
          applyEpisodeRowToCreationStore(creationStore, episode)
        })
        .catch(() => {
          if (generation === episodeLoadGeneration && loadedEpisodeKey === episodeKey) {
            loadedEpisodeKey = ''
          }
        })
    },
    { immediate: true }
  )

  return {
    isPublished,
    auditFailureReason
  }
}
