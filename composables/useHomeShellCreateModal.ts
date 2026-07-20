import { reactive } from 'vue'
import { message } from 'ant-design-vue'
import type { GlobalSettingData } from '~/types'
import type { UserProjectCreateRequest } from '~/types/business-api'
import { userProjectCreate } from '~/utils/businessApi'
import { buildProjectVideoStyleFields } from '~/utils/buildProjectVideoStyleFields'
import { CREATE_SERIES_SCRIPT_UPLOAD_PATH } from '~/utils/createFlowRoutes'
import { CREATE_FIRST_STEP_DEFAULTS } from '~/utils/createFirstStepDefaults'

export type HomeShellCreateModalApi = ReturnType<typeof buildHomeShellCreateModal>

let cached: HomeShellCreateModalApi | null = null

function buildHomeShellCreateModal() {
  const router = useRouter()
  const creationStore = useCreationStore()

  return reactive({
    showCreateFirstStepModal: false,
    createConfirmLoading: false,
    /** 为 true 时弹窗左侧作品类型跟随父级（我的作品页按 tab）；首页我要创作为 false，固定默认剧集 */
    syncProjectTypeFromParent: false,
    creationTitleDraft: '未命名作品',
    creationProjectTypeDraft: 'series' as 'movie' | 'series',
    creationGlobalSettingDraft: JSON.parse(
      JSON.stringify(creationStore.formData.globalSetting)
    ) as GlobalSettingData,

    syncCreateDraftFromStore() {
      this.creationTitleDraft = creationStore.workTitle || '未命名作品'
      this.creationGlobalSettingDraft = JSON.parse(
        JSON.stringify(creationStore.formData.globalSetting)
      )
      this.creationProjectTypeDraft = CREATE_FIRST_STEP_DEFAULTS.projectType
    },

    updateGlobalSettingDraft(value: GlobalSettingData) {
      this.creationGlobalSettingDraft = value
    },

    /** 仅更新风格库字段，避免冲掉左侧基本信息草稿 */
    patchGlobalSettingDraftStyle(
      patch: Pick<GlobalSettingData, 'selectedStyle' | 'myStyles' | 'style'>
    ) {
      this.creationGlobalSettingDraft = {
        ...this.creationGlobalSettingDraft,
        selectedStyle: patch.selectedStyle,
        myStyles: patch.myStyles,
        style: patch.style
      }
    },

    updateGlobalSettingDraftField<K extends keyof GlobalSettingData>(key: K, value: GlobalSettingData[K]) {
      this.creationGlobalSettingDraft = {
        ...this.creationGlobalSettingDraft,
        [key]: value
      }
    },

    openCreateModal(options?: { worksTab?: 'film' | 'series' }) {
      const base = JSON.parse(JSON.stringify(creationStore.formData.globalSetting)) as GlobalSettingData
      const d = CREATE_FIRST_STEP_DEFAULTS
      this.creationTitleDraft = '未命名作品'
      this.creationGlobalSettingDraft = {
        ...base,
        scriptType: d.scriptType,
        modelStrategy: d.modelStrategy,
        creationMode: d.creationMode
      }
      if (options?.worksTab) {
        this.syncProjectTypeFromParent = true
        this.creationProjectTypeDraft = options.worksTab === 'series' ? 'series' : 'movie'
      } else {
        this.syncProjectTypeFromParent = false
        this.creationProjectTypeDraft = d.projectType
      }
      this.showCreateFirstStepModal = true
    },

    async handleCreateConfirm() {
      if (this.createConfirmLoading) return
      const draftStylePayload = buildProjectVideoStyleFields(
        this.creationGlobalSettingDraft.selectedStyle,
        this.creationGlobalSettingDraft.style
      )
      if (!draftStylePayload) {
        message.warning('请选择主题风格')
        return
      }
      this.createConfirmLoading = true
      try {
        const finalTitle = (this.creationTitleDraft || '').trim() || '未命名作品'
        const finalGlobalSetting: GlobalSettingData = {
          ...this.creationGlobalSettingDraft,
          title: finalTitle,
          style:
            this.creationGlobalSettingDraft.selectedStyle?.name ||
            this.creationGlobalSettingDraft.style ||
            ''
        }

        const createPayload: UserProjectCreateRequest = {
          projectName: finalTitle,
          projectDesc: finalGlobalSetting.description || '',
          projectType: this.creationProjectTypeDraft,
          coverUrl: finalGlobalSetting.selectedStyle?.thumbnail || '',
          aspectRatio: finalGlobalSetting.aspectRatio,
          scriptType: finalGlobalSetting.scriptType,
          videoStyleType: draftStylePayload.videoStyleType,
          videoStyleValue: draftStylePayload.videoStyleValue,
          defaultGenMode: finalGlobalSetting.modelStrategy,
          defaultCreationMode: finalGlobalSetting.creationMode
        }

        const createRes = await userProjectCreate(createPayload)

        creationStore.setWorkTitle(finalTitle)
        creationStore.updateFormData({
          globalSetting: finalGlobalSetting
        })
        creationStore.setCurrentProjectType(this.creationProjectTypeDraft)
        creationStore.setCurrentProjectContext({
          projectId: createRes.data.id,
          episodeId: this.creationProjectTypeDraft === 'movie' ? 0 : null
        })
        creationStore.setCurrentStepIndex(1)
        message.success(createRes.msg || '项目创建成功')
        const pid = String(createRes.data.id)
        const createQuery = { projectId: pid, id: pid }
        setTimeout(() => {
          this.createConfirmLoading = false
          this.showCreateFirstStepModal = false
          if (this.creationProjectTypeDraft === 'series') {
            router.push({ path: CREATE_SERIES_SCRIPT_UPLOAD_PATH, query: createQuery })
          } else {
            router.push({ path: '/create', query: { ...createQuery, stepInitAdvance: '1' } })
          }
        }, 2000)
      } catch (error: unknown) {
        this.createConfirmLoading = false
        const backendMsg =
          error && typeof error === 'object' && 'msg' in error
            ? String((error as { msg?: string }).msg)
            : error instanceof Error
              ? error.message
              : ''
        message.error(backendMsg || '创建项目失败，请稍后重试')
      }
    }
  })
}

/** 首页壳层（案例广场 / 我的作品 / 资产库）共用的「创建作品第一步」弹窗状态；放在 layout 渲染，避免与路由 out-in 过渡内的 Teleport 冲突 */
export function useHomeShellCreateModal(): HomeShellCreateModalApi {
  if (!cached) {
    cached = buildHomeShellCreateModal()
  }
  return cached
}
