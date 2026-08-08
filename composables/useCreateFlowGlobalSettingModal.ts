import { ref } from 'vue'
import { message } from 'ant-design-vue'
import type { GlobalSettingData } from '~/types'
import type { UserProjectUpdateRequest } from '~/types/business-api'
import { useCreationStore } from '~/stores/creation'
import { creationStepToRoutePath } from '~/utils/createFlowRoutes'
import { userProjectUpdate } from '~/utils/businessApi'
import { buildProjectVideoStyleFields } from '~/utils/buildProjectVideoStyleFields'
import { resetProjectDetailHydrateCache } from '~/utils/hydrateCreationStoreFromProjectDetail'
import { isProjectPublicLockError, projectPublicLockUserHint } from '~/utils/projectAudit'

/**
 * 壳层「项目配置」弹窗状态与确认（CreateFirstStepModal）
 */
export function useCreateFlowGlobalSettingModal() {
  const router = useRouter()
  const route = useRoute()
  const creationStore = useCreationStore()

  const showGlobalSettingModal = ref(false)
  const globalSettingConfirmLoading = ref(false)
  const creationTitleDraft = ref('未命名作品')
  const globalSettingProjectTypeDraft = ref<'movie' | 'series'>('movie')
  const creationGlobalSettingDraft = ref<GlobalSettingData>(
    JSON.parse(JSON.stringify(creationStore.formData.globalSetting))
  )

  function syncGlobalSettingDraftFromStore() {
    creationTitleDraft.value = creationStore.workTitle || '未命名作品'
    creationGlobalSettingDraft.value = JSON.parse(JSON.stringify(creationStore.formData.globalSetting))
    const pt = creationStore.currentProjectType
    if (pt === 'movie' || pt === 'series') {
      globalSettingProjectTypeDraft.value = pt
    } else {
      globalSettingProjectTypeDraft.value =
        creationGlobalSettingDraft.value.scriptType === 'monologue' ? 'series' : 'movie'
    }
  }

  function openGlobalSettingModal() {
    syncGlobalSettingDraftFromStore()
    showGlobalSettingModal.value = true
  }

  function updateGlobalSettingDraft(value: GlobalSettingData) {
    creationGlobalSettingDraft.value = value
  }

  function patchGlobalSettingDraftStyle(
    patch: Pick<
      GlobalSettingData,
      'selectedStyle' | 'myStyles' | 'style' | 'styleSelectionTouched' | 'styleLocked'
    >
  ) {
    creationGlobalSettingDraft.value = {
      ...creationGlobalSettingDraft.value,
      selectedStyle: patch.selectedStyle,
      myStyles: patch.myStyles,
      style: patch.style,
      styleSelectionTouched: patch.styleSelectionTouched,
      styleLocked: patch.styleLocked
    }
  }

  function updateGlobalSettingDraftField<K extends keyof GlobalSettingData>(key: K, value: GlobalSettingData[K]) {
    creationGlobalSettingDraft.value = {
      ...creationGlobalSettingDraft.value,
      [key]: value
    }
  }

  async function handleGlobalSettingConfirm(options?: { navigateAfterSave?: boolean }) {
    if (globalSettingConfirmLoading.value) return
    globalSettingConfirmLoading.value = true
    try {
      const finalTitle = (creationTitleDraft.value || '').trim() || '未命名作品'
      const finalGlobalSetting: GlobalSettingData = {
        ...creationGlobalSettingDraft.value,
        title: finalTitle,
        style: creationGlobalSettingDraft.value.selectedStyle?.name || creationGlobalSettingDraft.value.style || ''
      }
      const videoStylePayload = buildProjectVideoStyleFields(
        finalGlobalSetting.selectedStyle,
        finalGlobalSetting.style
      )
      if (!videoStylePayload) {
        message.warning('请选择主题风格')
        return
      }
      if (
        finalGlobalSetting.styleSelectionTouched === true &&
        (!videoStylePayload.styleSource || !videoStylePayload.styleAssetId)
      ) {
        message.warning('请选择有效风格')
        return
      }
      const pid = creationStore.currentProjectId
      if (!pid) {
        message.error('缺少项目信息，无法保存')
        return
      }

      const updatePayload: UserProjectUpdateRequest = {
        id: pid,
        projectName: finalTitle,
        projectDesc: finalGlobalSetting.description || '',
        aspectRatio: finalGlobalSetting.aspectRatio,
        scriptType: finalGlobalSetting.scriptType,
        defaultGenMode: finalGlobalSetting.modelStrategy,
        defaultCreationMode: finalGlobalSetting.creationMode
      }
      // 只有用户主动选择了另一风格才通知后端重建快照；普通保存不携带任何风格字段。
      if (finalGlobalSetting.styleSelectionTouched === true && finalGlobalSetting.styleLocked !== true) {
        Object.assign(updatePayload, videoStylePayload)
      }

      const updatedProject = await userProjectUpdate(updatePayload)
      const savedGlobalSetting: GlobalSettingData = {
        ...finalGlobalSetting,
        styleSelectionTouched: false,
        styleLocked:
          updatedProject.styleLocked == null
            ? finalGlobalSetting.styleLocked === true
            : updatedProject.styleLocked === true
      }

      creationStore.setWorkTitle(finalTitle)
      creationStore.updateFormData({ globalSetting: savedGlobalSetting })
      resetProjectDetailHydrateCache()
      showGlobalSettingModal.value = false
      message.success('已保存')
      if (options?.navigateAfterSave) {
        creationStore.setCurrentStepIndex(1)
        await router.push({
          path: creationStepToRoutePath('story-script'),
          query: { ...route.query }
        })
      }
    } catch (e: unknown) {
      if (isProjectPublicLockError(e)) {
        message.error(projectPublicLockUserHint())
        return
      }
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '保存失败，请稍后重试')
    } finally {
      globalSettingConfirmLoading.value = false
    }
  }

  return {
    showGlobalSettingModal,
    globalSettingConfirmLoading,
    creationTitleDraft,
    globalSettingProjectTypeDraft,
    creationGlobalSettingDraft,
    syncGlobalSettingDraftFromStore,
    openGlobalSettingModal,
    updateGlobalSettingDraft,
    patchGlobalSettingDraftStyle,
    updateGlobalSettingDraftField,
    handleGlobalSettingConfirm
  }
}
