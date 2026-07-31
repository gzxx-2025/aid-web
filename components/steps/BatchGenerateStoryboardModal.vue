<template>
  <a-modal
    v-model:open="localOpen"
    :width="1100"
    :footer="null"
    :title="null"
    :closable="false"
    class="batch-generate-storyboard-modal"
    wrap-class-name="create-flow-modal batch-generate-storyboard-wrap"
    :force-render="true"
    @cancel="handleCancel"
    @after-open-change="handleModalAfterOpenChange"
  >
    <div class="bgsm">
      <header class="bgsm-header">
        <div class="bgsm-title-wrap">
          <h2 class="bgsm-title">{{ modalTitle }}</h2>
          <p v-if="modalSubtitle" class="bgsm-subtitle">{{ modalSubtitle }}</p>
        </div>
        <button type="button" class="bgsm-close" aria-label="关闭" @click="handleCancel">
          <CloseOutlined />
        </button>
      </header>

      <div class="bgsm-toolbar">
        <button type="button" class="bgsm-select-all" @click="toggleSelectAll">
          <img
            class="bgsm-check-icon"
            :src="isAllSelectableChecked ? dialogSelectSelIcon : dialogSelectNorIcon"
            alt=""
          />
          <span class="bgsm-select-all-text">全选 ({{ selectedIds.size }}/{{ selectableCount }})</span>
        </button>
        <span v-if="mode === 'video'" class="bgsm-pending">待处理 ({{ pendingCount }})</span>
        <span v-else class="bgsm-pending bgsm-pending--muted">已有图片 ({{ withImageCount }}/{{ panels.length }})</span>
      </div>

      <div class="bgsm-body">
        <div class="bgsm-grid">
        <template v-for="item in cardList" :key="item.panel.id">
          <a-tooltip v-if="!item.canSelect" :title="item.disabledTooltip">
            <article class="bgsm-card bgsm-card--disabled">
              <div class="bgsm-card-media">
                <ShimmerVideo
                  v-if="item.cover && item.coverKind === 'video'"
                  :src="item.cover"
                  video-class="bgsm-card-img"
                  object-fit="cover"
                  reveal-direction="fade"
                />
                <ShimmerImage
                  v-else-if="item.cover"
                  :src="item.cover"
                  :alt="item.label"
                  img-class="bgsm-card-img"
                  object-fit="cover"
                  reveal-direction="fade"
                />
                <div v-else class="bgsm-card-empty">
                  <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--xl bgsm-card-empty__icon" />
                </div>
              </div>
              <div class="bgsm-card-meta">
                <div class="bgsm-card-name">{{ item.label }}</div>
              </div>
            </article>
          </a-tooltip>
          <article
            v-else
            :class="[
              'bgsm-card',
              { 'bgsm-card--selected': selectedIds.has(item.panel.id) }
            ]"
            @click="onCardClick(item)"
          >
            <div class="bgsm-card-media">
              <ShimmerVideo
                v-if="item.cover && item.coverKind === 'video'"
                :src="item.cover"
                video-class="bgsm-card-img"
                object-fit="cover"
                reveal-direction="fade"
              />
              <ShimmerImage
                v-else-if="item.cover"
                :src="item.cover"
                :alt="item.label"
                img-class="bgsm-card-img"
                object-fit="cover"
                reveal-direction="fade"
              />
              <div v-else class="bgsm-card-empty">
                <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--xl bgsm-card-empty__icon" />
              </div>
              <img
                class="bgsm-card-select"
                :src="selectedIds.has(item.panel.id) ? dialogSelectSelIcon : dialogSelectNorIcon"
                alt=""
              />
            </div>
            <div class="bgsm-card-meta">
              <div class="bgsm-card-name">{{ item.label }}</div>
            </div>
          </article>
        </template>
        </div>
      </div>

      <footer class="bgsm-footer">
        <div class="bgsm-footer-left" :class="{ 'bgsm-footer-left--video': mode === 'video' }">
          <template v-if="mode === 'video'">
            <div class="bgsm-field bgsm-field--video-model">
              <label class="bgsm-label">生视频模型</label>
              <ModelSelectDropdown
                v-if="videoModelOptions.length"
                class="bgsm-video-model-select"
                :value="selectedVideoModel"
                :options="videoModelOptions"
                :expanded="videoModelDropdownExpanded"
                @toggle="videoModelDropdownExpanded = !videoModelDropdownExpanded"
                @close="videoModelDropdownExpanded = false"
                @select="handleSelectVideoModel"
              />
              <div v-else-if="videoModelsLoading" class="bgsm-video-model-placeholder">加载中…</div>
              <div v-else class="bgsm-video-model-placeholder">暂无可用模型</div>
            </div>
            <div v-if="videoQualityOptions.length" class="bgsm-field bgsm-field--video-param">
              <label class="bgsm-label">清晰度</label>
              <a-select
                v-model:value="videoQuality"
                class="bgsm-select"
                popup-class-name="bgsm-select-popup"
                size="large"
                :options="videoQualityOptions"
                :disabled="!videoQualityOptions.length"
              />
            </div>
            <div v-if="videoConfigShowDuration && videoDurationOptions.length" class="bgsm-field bgsm-field--video-param">
              <label class="bgsm-label">时长</label>
              <a-select
                v-model:value="videoDuration"
                class="bgsm-select"
                popup-class-name="bgsm-select-popup"
                size="large"
                :options="videoDurationOptions"
                :disabled="!videoDurationOptions.length"
              />
            </div>
            <div v-if="videoConfigShowAudio && videoAudioOptions.length" class="bgsm-field bgsm-field--video-param">
              <label class="bgsm-label">音频</label>
              <a-select
                v-model:value="videoAudio"
                class="bgsm-select"
                popup-class-name="bgsm-select-popup"
                size="large"
                :options="videoAudioOptions"
                :disabled="!videoAudioOptions.length"
              />
            </div>
          </template>
        </div>
        <div class="bgsm-actions">
          <a-button class="bgsm-btn-cancel" @click="handleCancel">
            <div class="text-gradient">取消</div>
          </a-button>
          <a-button
            type="primary"
            class="bgsm-btn-ok"
            :disabled="selectedIds.size === 0 || listLoading"
            @click="handleConfirm"
          >
            <template v-if="mode === 'video'" #icon>
              <img src="@/assets/img/icon/star_white.svg" alt="" />
            </template>
            批量生成
          </a-button>
        </div>
      </footer>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CloseOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import { emptyImageIconUrl } from '~/utils/emptyImageIcon'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import ShimmerVideo from '~/components/common/ShimmerVideo.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import { resolveStoryboardPanelCoverImage } from '~/utils/storyboardImageCover'
import {
  isAutoGeneratedStoryboardPanel,
  manualStoryboardTooltip
} from '~/utils/storyboardManual'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import { aidAgentList, userModelList, userModelListByFuncCodes } from '~/utils/businessApi'
import { modelsFromListByFuncGroups, pickFirstNonEmptyModelPool } from '~/utils/modelListByFuncBatch'
import { waitForCreationStoreHydrated } from '~/composables/useCreationStoreHydration'
import { useCreationStore } from '~/stores/creation'
import { buildAidAgentListScopeParams } from '~/utils/createFlowProjectContext'
import {
  STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY,
  agentOptionsFromGroup,
  fetchAgentDefaultModelCode,
  resolveAgentModelCodeInGroup,
  resolvePreferredModelId,
  resolvePreferredModelIdFromAgentCodes,
  resolveSelectedModelOption
} from '~/utils/extractAgentBiz'
import { STORYBOARD_GEN_CONFIG_SCENE_CODES, getProjectGenConfigBySceneCode } from '~/utils/projectGenConfig'
import {
  isProCreationMode,
  resolveBatchStoryboardVideoAgentBizCategories,
  resolveBatchStoryboardVideoModelFuncCodes,
  shouldPassStoryboardVideoDuration
} from '~/utils/creationModeUiRules'
import { useVideoModelGenerateSettings } from '~/composables/useVideoModelGenerateSettings'
import { mapUserModelListItemToModelOption } from '~/utils/userModelOption'
import type { StoryboardPanel, StoryboardVideoPanel } from '~/types'
import type { UserModelListItem } from '~/types/business-api'
import { refreshStoryboardPanelsFromApiForBatchModal } from '~/utils/batchModalListRefresh'

const route = useRoute()
const creationStore = useCreationStore()
let videoModelLoadGen = 0
let modalOpenInitGen = 0
const listLoading = ref(false)
const refreshedPanels = ref<StoryboardPanel[] | null>(null)
const refreshedVideoPanels = ref<StoryboardVideoPanel[] | null>(null)

const props = withDefaults(
  defineProps<{
    open: boolean
    mode: 'image' | 'video'
    panels?: StoryboardPanel[]
    videoPanels?: StoryboardVideoPanel[]
    title?: string
    /** 打开时是否默认全选可选项 */
    preselectAll?: boolean
  }>(),
  {
    panels: () => [],
    videoPanels: () => [],
    title: '',
    preselectAll: false
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [
    payload: {
      mode: 'image' | 'video'
      selectedStoryboardIds: number[]
      agent?: string
      model?: string
      videoModel?: string
      resolution?: string
      durationSeconds?: number
      /** 音画同出偏好；模型不支持时固定为 none */
      soundEffects?: 'none' | 'with-sound'
    }
  ]
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const selectedIds = ref<Set<string>>(new Set())
const agent = ref('')
const model = ref('')
const agentOptions = ref<Array<{ label: string; value: string }>>([])
const modelOptions = ref<Array<{ label: string; value: string }>>([])
const agentsLoading = ref(false)
const videoModel = ref('')
const videoModelOptions = ref<ModelOption[]>([])
const videoRawModelList = ref<UserModelListItem[]>([])
const videoModelsLoading = ref(false)
const videoModelDropdownExpanded = ref(false)
const videoQuality = ref('1080p')
const videoDuration = ref('5')
const videoAspectRatio = ref('16:9')
const videoCount = ref(1)
const videoAudio = ref('with_audio')

const projectCreationMode = computed(
  () => creationStore.formData.globalSetting?.creationMode || 'i2v'
)

const selectedVideoModel = computed(() =>
  resolveSelectedModelOption(videoModelOptions.value, videoModel.value)
)

const videoSettingsForCapability = computed({
  get: () => ({
    aspectRatio: videoAspectRatio.value,
    count: videoCount.value,
    quality: videoQuality.value,
    duration: videoDuration.value,
    audio: videoAudio.value
  }),
  set: (v) => {
    videoAspectRatio.value = v.aspectRatio
    videoCount.value = v.count
    videoQuality.value = v.quality
    videoDuration.value = v.duration
    videoAudio.value = v.audio
  }
})

const {
  qualitySelectOptions: videoQualityOptions,
  durationSelectOptions: videoDurationOptions,
  audioSelectOptions: videoAudioOptions,
  supportsDuration: modelSupportsDuration,
  supportsAudio: videoConfigShowAudio,
  syncSettingsToModel: syncVideoSettingsToModel
} = useVideoModelGenerateSettings({
  selectedModelCode: videoModel,
  rawModelList: videoRawModelList,
  generationSettings: videoSettingsForCapability
})

/** 仅图生视频展示时长；其它创作模式隐藏，且确认时不传 durationSeconds */
const videoConfigShowDuration = computed(
  () =>
    shouldPassStoryboardVideoDuration(projectCreationMode.value) && modelSupportsDuration.value
)

const mapVideoModelOption = (item: UserModelListItem): ModelOption =>
  mapUserModelListItemToModelOption(item, { iconBg: '#60A5FA' })

function handleSelectVideoModel(option: ModelOption) {
  videoModel.value = option.id
  videoModelDropdownExpanded.value = false
  syncVideoSettingsToModel()
}

/** 切到支持音画同出的模型时，按本地偏好恢复；不支持时强制无声（不污染 persist） */
watch(videoConfigShowAudio, (ok) => {
  if (!ok) {
    videoAudio.value = 'silent'
    return
  }
  const saved = creationStore.storyboardVideoGenerateSettings.soundEffects
  if (saved === 'with-sound') videoAudio.value = 'with_audio'
  else if (saved === 'none') videoAudio.value = 'silent'
  else videoAudio.value = 'with_audio'
})

watch(videoModel, () => syncVideoSettingsToModel())

const modalTitle = computed(() => {
  if (props.title) return props.title
  return props.mode === 'image' ? '批量生成分镜图' : '批量生成分镜视频'
})

const modalSubtitle = computed(() => {
  if (props.mode === 'image') {
    return '生成结果将更新到分镜图，历史记录可在生图历史中查看'
  }
  return ''
})

const effectivePanels = computed(() => refreshedPanels.value ?? props.panels)
const effectiveVideoPanels = computed(() => refreshedVideoPanels.value ?? props.videoPanels)

const cardList = computed(() =>
  effectivePanels.value.map((panel, index) => {
    const storyboardImageUrl = String(resolveStoryboardPanelCoverImage(panel)?.url ?? '').trim()
    const hasStoryboardImage = !!storyboardImageUrl
    const isAutoPanel = isAutoGeneratedStoryboardPanel(panel, creationStore)
    const videoPanel = effectiveVideoPanels.value[index]
    const videoCover = String(
      videoPanel?.videos?.find((v) => v.isStoryboardVideo && String(v.url ?? '').trim())?.url ?? ''
    ).trim()
    const displayCover =
      props.mode === 'video' ? storyboardImageUrl || videoCover : storyboardImageUrl
    const coverKind =
      props.mode === 'video' && !hasStoryboardImage && videoCover
        ? ('video' as const)
        : ('image' as const)

    let canSelect = isAutoPanel
    let disabledTooltip = ''
    if (props.mode === 'video') {
      if (!isAutoPanel) {
        canSelect = false
        disabledTooltip = manualStoryboardTooltip('video')
      } else if (
        !hasStoryboardImage &&
        !isProCreationMode(projectCreationMode.value)
      ) {
        // 专业版不出分镜图，批量出片不要求分镜图
        canSelect = false
        disabledTooltip = '需要先生成当前分镜视频对应的分镜图'
      }
    } else if (!isAutoPanel) {
      canSelect = false
      disabledTooltip = manualStoryboardTooltip('image')
    }

    return {
      panel,
      panelIndex: index,
      cover: displayCover,
      coverKind,
      label: panel.title || `分镜${index + 1}`,
      canSelect,
      disabledTooltip
    }
  })
)

const selectableCount = computed(() => cardList.value.filter((c) => c.canSelect).length)

const withImageCount = computed(
  () => cardList.value.filter((c) => !!c.cover).length
)

const pendingCount = computed(() =>
  cardList.value.filter((c) => {
    if (!c.canSelect) return false
    const vp = effectiveVideoPanels.value[c.panelIndex]
    const hasVideo = (vp?.videos || []).some(
      (v) => v.isStoryboardVideo && String(v.url ?? '').trim()
    )
    return !hasVideo
  }).length
)

const isAllSelectableChecked = computed(() => {
  const selectable = cardList.value.filter((c) => c.canSelect)
  if (selectable.length === 0) return false
  return selectable.every((c) => selectedIds.value.has(c.panel.id))
})

function toggleSelect(id: string) {
  const item = cardList.value.find((c) => c.panel.id === id)
  if (!item?.canSelect) return
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function onCardClick(item: { panel: StoryboardPanel; canSelect: boolean }) {
  if (item.canSelect) toggleSelect(item.panel.id)
}

function toggleSelectAll() {
  const selectable = cardList.value.filter((c) => c.canSelect).map((c) => c.panel.id)
  if (selectable.every((id) => selectedIds.value.has(id))) {
    const next = new Set(selectedIds.value)
    selectable.forEach((id) => next.delete(id))
    selectedIds.value = next
  } else {
    const next = new Set(selectedIds.value)
    selectable.forEach((id) => next.add(id))
    selectedIds.value = next
  }
}

function modelListScope() {
  return buildAidAgentListScopeParams(creationStore)
}

async function loadImageAgents() {
  agentsLoading.value = true
  try {
    const bizCategoryCode = STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY
    const groups = await aidAgentList({
      bizCategoryCodes: [bizCategoryCode],
      ...modelListScope()
    })
    const opts = agentOptionsFromGroup(groups, bizCategoryCode)
    agentOptions.value = opts.map((o) => ({ label: o.name, value: o.id }))

    const projectId = Number(creationStore.currentProjectId)
    let defaultAgent = ''
    if (Number.isFinite(projectId) && projectId > 0) {
      try {
        const cfg = await getProjectGenConfigBySceneCode(projectId, STORYBOARD_GEN_CONFIG_SCENE_CODES.image)
        defaultAgent = String(cfg?.agentCode || '').trim()
      } catch {
        /* ignore */
      }
    }
    agent.value = defaultAgent && opts.some((o) => o.id === defaultAgent) ? defaultAgent : ''
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载智能体列表失败')
    agentOptions.value = []
    agent.value = ''
  } finally {
    agentsLoading.value = false
  }
}

async function loadImageModelOptions() {
  const bizCategoryCode = STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY
  let list: UserModelListItem[] = []
  try {
    const groups = await userModelListByFuncCodes([bizCategoryCode], modelListScope())
    list = modelsFromListByFuncGroups(groups, bizCategoryCode)
  } catch {
    list = []
  }
  if (!list.length) {
    try {
      list = await userModelList({ modelType: 'image' })
    } catch {
      list = []
    }
  }
  modelOptions.value = list.map((item) => ({
    label: item.modelName || item.modelCode || '未命名模型',
    value: String(item.modelCode || item.id)
  }))
}

async function initImageModelSelection() {
  await loadImageModelOptions()
  const projectId = Number(creationStore.currentProjectId)
  let cfgModel = ''
  if (Number.isFinite(projectId) && projectId > 0) {
    try {
      const cfg = await getProjectGenConfigBySceneCode(projectId, STORYBOARD_GEN_CONFIG_SCENE_CODES.image)
      cfgModel = String(cfg?.modelCode || '').trim()
    } catch {
      /* ignore */
    }
  }
  const scope = modelListScope()
  const agentDefaultModelCode = await fetchAgentDefaultModelCode({
    bizCategoryCode: STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY,
    agentCode: agent.value,
    ...scope
  })
  const optionIds = modelOptions.value.map((x) => ({ id: x.value }))
  model.value = resolvePreferredModelId(optionIds, {
    savedId: cfgModel,
    agentDefaultCode: agentDefaultModelCode
  })
}

async function loadVideoModelOptions() {
  if (!import.meta.client) return
  const gen = ++videoModelLoadGen
  videoModelsLoading.value = true
  try {
    await waitForCreationStoreHydrated(creationStore, route)
    if (gen !== videoModelLoadGen) return

    // 与编辑分镜视频弹窗一致：listByFunc + 按创作模式主 Tab 解析 funcCode（含 projectId 作用域）
    const funcCodes = resolveBatchStoryboardVideoModelFuncCodes(projectCreationMode.value)
    let list: UserModelListItem[] = []
    if (funcCodes.length) {
      try {
        const groups = await userModelListByFuncCodes(funcCodes, modelListScope())
        if (gen !== videoModelLoadGen) return
        list = pickFirstNonEmptyModelPool(groups, funcCodes)
      } catch {
        list = []
      }
    }
    if (!list.length) {
      try {
        list = await userModelList({ modelType: 'video' })
        if (gen !== videoModelLoadGen) return
      } catch {
        list = []
      }
    }
    videoRawModelList.value = list
    videoModelOptions.value = list.map(mapVideoModelOption)
  } catch (e: unknown) {
    if (gen !== videoModelLoadGen) return
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载视频模型失败')
    videoRawModelList.value = []
    videoModelOptions.value = []
  } finally {
    if (gen === videoModelLoadGen) {
      videoModelsLoading.value = false
    }
  }
}

async function initVideoModelSelection() {
  await loadVideoModelOptions()
  const saved = creationStore.storyboardVideoGenerateSettings
  if (saved.resolution) videoQuality.value = String(saved.resolution).toLowerCase()
  const savedDuration = Number(saved.durationSeconds)
  if (Number.isFinite(savedDuration) && savedDuration > 0) {
    videoDuration.value = String(Math.floor(savedDuration))
  }
  // 音频先按本地偏好恢复；不支持音画同出的模型由后续 syncVideoSettingsToModel 强制 silent
  if (saved.soundEffects === 'with-sound') videoAudio.value = 'with_audio'
  else if (saved.soundEffects === 'none') videoAudio.value = 'silent'
  else videoAudio.value = 'with_audio'

  const agentBizCodes = resolveBatchStoryboardVideoAgentBizCategories(projectCreationMode.value)
  let agentDefaultCodes: string[] = []
  if (agentBizCodes.length) {
    try {
      const groups = await aidAgentList({
        bizCategoryCodes: agentBizCodes,
        ...modelListScope()
      })
      agentDefaultCodes = agentBizCodes
        .map((biz) => resolveAgentModelCodeInGroup(groups, biz))
        .filter(Boolean)
    } catch {
      agentDefaultCodes = []
    }
  }

  const preferred =
    resolvePreferredModelIdFromAgentCodes(videoModelOptions.value, {
      savedId: String(saved.videoModel || '').trim(),
      agentDefaultCodes
    }) ||
    videoModelOptions.value[0]?.id ||
    ''
  videoModel.value = preferred
  syncVideoSettingsToModel()
}

function handleCancel() {
  localOpen.value = false
}

function resetSelectionOnOpen() {
  if (props.preselectAll) {
    selectedIds.value = new Set(
      cardList.value.filter((c) => c.canSelect).map((c) => c.panel.id)
    )
  } else {
    selectedIds.value = new Set()
  }
}

async function loadModalListData() {
  listLoading.value = true
  try {
    const panels = await refreshStoryboardPanelsFromApiForBatchModal(route)
    if (!panels) {
      message.warning('缺少项目信息，请从「我的作品」打开作品后再操作')
      return
    }
    refreshedPanels.value = panels
    refreshedVideoPanels.value = creationStore.formData.storyboardVideo
      .panels as StoryboardVideoPanel[]
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '刷新分镜列表失败')
  } finally {
    listLoading.value = false
  }
}

function clearModalListCache() {
  refreshedPanels.value = null
  refreshedVideoPanels.value = null
}

async function handleModalContentInit() {
  if (!props.open) return
  const gen = ++modalOpenInitGen
  await loadModalListData()
  if (gen !== modalOpenInitGen) return
  resetSelectionOnOpen()
  if (props.mode === 'image') {
    await loadImageAgents()
    if (gen !== modalOpenInitGen) return
    await initImageModelSelection()
    return
  }
  if (props.mode === 'video') {
    await initVideoModelSelection()
  }
}

function handleModalAfterOpenChange(open: boolean) {
  if (!open) {
    videoModelDropdownExpanded.value = false
    modalOpenInitGen++
    videoModelLoadGen++
    clearModalListCache()
    return
  }
  void handleModalContentInit()
}

function handleConfirm() {
  if (listLoading.value) return
  if (selectedIds.value.size === 0) return
  const selectedStoryboardIds = [...selectedIds.value]
    .map((id) => parseServerStoryboardId(id))
    .filter((sid): sid is number => sid != null)
  if (!selectedStoryboardIds.length) {
    message.warning('所选分镜尚未保存到服务器')
    return
  }
  if (props.mode === 'image' && !String(agent.value || '').trim()) {
    message.warning('请选择智能体')
    return
  }
  if (props.mode === 'video' && !String(videoModel.value || '').trim()) {
    message.warning('请选择生视频模型')
    return
  }
  const durationSec = Number(videoDuration.value)
  const soundEffects: 'none' | 'with-sound' = videoConfigShowAudio.value
    ? videoAudio.value === 'with_audio'
      ? 'with-sound'
      : 'none'
    : 'none'
  emit('confirm', {
    mode: props.mode,
    selectedStoryboardIds,
    ...(props.mode === 'image'
      ? { agent: agent.value, model: model.value }
      : {
          videoModel: videoModel.value,
          resolution: String(videoQuality.value || '').trim().toLowerCase() || undefined,
          soundEffects,
          ...(videoConfigShowDuration.value && Number.isFinite(durationSec) && durationSec > 0
            ? { durationSeconds: durationSec }
            : {})
        })
  })
  localOpen.value = false
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      handleModalAfterOpenChange(false)
      return
    }
    void handleModalContentInit()
  },
  { immediate: true }
)

watch(projectCreationMode, () => {
  if (props.open && props.mode === 'video') {
    void initVideoModelSelection()
  }
})
</script>

<style scoped>
.batch-generate-storyboard-modal :deep(.ant-modal-content) {
  padding: 0 !important;
  border-radius: 4px;
  overflow: hidden;
  background: #191a1d;
  border: 1px solid rgba(74, 231, 253, 0.22);
}

.batch-generate-storyboard-modal :deep(.ant-modal-header) {
  display: none;
}

.batch-generate-storyboard-modal :deep(.ant-modal-body) {
  padding: 0 !important;
}

.bgsm {
  color: #e6edf3;
  height: min(698px, calc(100dvh - 80px));
  max-height: min(698px, calc(100dvh - 80px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.bgsm-header {
  flex-shrink: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.bgsm-title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.bgsm-title {
  margin: 0;
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;
  color: #fff;
}

.bgsm-subtitle {
  margin: 0;
  font-size: 12px;
  color: #8e97a5;
}

.bgsm-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(142, 151, 165, 1);
  cursor: pointer;
  font-size: 24px;
  flex-shrink: 0;
}

.bgsm-close:hover {
  color: #4ae7fd;
}

.bgsm-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 14px;
}

.bgsm-check-icon {
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
}

.bgsm-select-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  user-select: none;
  color: inherit;
}

.bgsm-select-all-text {
  font-size: 14px;
  color: #fff;
}

.bgsm-pending {
  font-size: 14px;
  color: #4ae7fd;
}

.bgsm-pending--muted {
  color: #dce6f2;
}

.bgsm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.bgsm-body::-webkit-scrollbar {
  display: none;
}

.bgsm-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.bgsm-grid :deep(.ant-tooltip) {
  display: contents;
}

.bgsm-card {
  position: relative;
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 6px;
  background: #121621;
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.bgsm-card:hover:not(.bgsm-card--disabled):not(.bgsm-card--selected) {
  border-color: rgba(74, 231, 253, 0.5);
}

.bgsm-card--selected {
  border-color: rgba(74, 231, 253, 0.6);
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.25);
}

.bgsm-card--disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

.bgsm-card-media {
  position: relative;
  height: 165px;
  background: #101522;
  overflow: hidden;
}

.bgsm-card-media .shimmer-image,
.bgsm-card-media .shimmer-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.bgsm-card-img,
.bgsm-card-media :deep(.bgsm-card-img),
.bgsm-card-media :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bgsm-card-empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  padding: 8px;
  text-align: center;
}

.bgsm-card-empty__icon {
  opacity: 0.75;
}

.bgsm-card-select {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
  pointer-events: none;
  z-index: 2;
}

.bgsm-card-meta {
  padding: 8px;
  background: #0f1118;
}

.bgsm-card-name {
  font-size: 14px;
  color: #fff;
  line-height: 20px;
}

.bgsm-footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0 0;
  flex-wrap: nowrap;
}

.bgsm-footer .bgsm-actions {
  flex-shrink: 0;
}

.bgsm-footer-left {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 10px;
  min-width: 0;
}

.bgsm-footer-left--video {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.bgsm-field--video-model {
  width: 200px;
  flex: 0 0 200px;
}

.bgsm-field--video-param {
  width: 120px;
  flex: 0 0 120px;
}

.bgsm-video-model-placeholder {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 11px;
  border-radius: 4px;
  background: #0d1018;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #8e97a5;
  font-size: 14px;
}

.bgsm-video-model-select {
  width: 100%;
}

/* class 打在组件根节点上，不能再嵌套 .model-select-dropdown */
.bgsm-video-model-select :deep(.selected-model) {
  height: 36px !important;
  min-height: 36px;
  padding: 0 11px !important;
  border-radius: 4px !important;
  background: #0d1018 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
}

.bgsm-video-model-select :deep(.selected-model:hover) {
  border-color: rgba(74, 231, 253, 0.35) !important;
  background: #0d1018 !important;
}

.bgsm-video-model-select :deep(.selected-model.expanded) {
  background: #0d1018 !important;
  border-color: rgba(74, 231, 253, 0.35) !important;
}

.bgsm-video-model-select :deep(.selected-model.expanded.is-open-down) {
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.bgsm-video-model-select :deep(.selected-model.expanded.is-open-up) {
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
}

.bgsm-video-model-select :deep(.model-icon-wrapper) {
  display: none;
}

.bgsm-video-model-select :deep(.model-preview) {
  gap: 0;
}

.bgsm-video-model-select :deep(.model-name) {
  font-size: 14px;
  line-height: 34px;
  color: #e6edf3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bgsm-video-model-select :deep(.expand-icon) {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.bgsm-field {
  min-width: 0;
}

.bgsm-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #8e97a5;
}

.bgsm-select {
  width: 100%;
}

.bgsm-select :deep(.ant-select-selector) {
  height: 36px !important;
  border-radius: 4px !important;
  background: #0d1018 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
}

.bgsm-select :deep(.ant-select-selection-item),
.bgsm-select.ant-select-open :deep(.ant-select-selection-item) {
  line-height: 34px !important;
  color: #e6edf3 !important;
}

.bgsm-select :deep(.ant-select-selection-placeholder) {
  line-height: 34px !important;
  color: #8e97a5 !important;
}

.bgsm-select :deep(.ant-select-arrow) {
  color: rgba(255, 255, 255, 0.45) !important;
}

.bgsm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.bgsm-btn-cancel {
  width: 96px;
  height: 40px;
  border-radius: 6px !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  background: #0d1018 !important;
  color: #fff !important;
}

.bgsm-btn-ok {
  min-width: 120px;
  height: 40px;
  border-radius: 6px !important;
  border: none !important;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.bgsm-btn-ok :deep(img) {
  width: 16px;
  height: 16px;
}
</style>

<style>
.bgsm-select-popup.ant-select-dropdown {
  background: #111621 !important;
  border: 1px solid rgba(74, 231, 253, 0.28) !important;
}

.bgsm-select-popup .ant-select-item {
  color: #e6edf3 !important;
}

.bgsm-select-popup .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  background: rgba(74, 231, 253, 0.2) !important;
  color: #4ae7fd !important;
}

.bgsm-select-popup .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: rgba(74, 231, 253, 0.12) !important;
}
</style>
