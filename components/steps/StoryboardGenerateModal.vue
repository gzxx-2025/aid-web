<template>
  <a-modal
    v-model:open="localOpen"
    :width="modalWidth"
    :footer="isFigmaLayout ? null : undefined"
    :closable="isFigmaLayout"
    centered
    class="storyboard-generate-modal"
    :class="{ 'storyboard-generate-modal--figma': isFigmaLayout }"
    wrap-class-name="create-flow-modal"
    @cancel="handleCancel"
  >
    <template #title>
      <ModalTitleWatermark
        v-if="isFigmaLayout"
        :title="modalTitle"
        :watermark="figmaTitleWatermark"
      />
      <div v-else class="modal-header">
        <span class="modal-title">{{ modalTitle }}</span>
        <p class="modal-subtitle">{{ modalSubtitle }}</p>
      </div>
    </template>

    <!-- 分镜脚本 / 分镜视频：同宽 Figma 双栏；左侧智能体区与脚本完全一致 -->
    <div v-if="isFigmaLayout" class="story-gen-figma">
      <div class="story-gen-figma__grid">
        <div class="story-gen-figma__col story-gen-figma__col--agent">
          <div class="story-gen-figma__label">智能体</div>
          <div class="story-gen-extract-columns extract-columns extract-columns--1">
            <div class="extract-col">
              <div class="extract-col__head">
                <span class="extract-col__head-text">{{ agentColumnHeadTitle }}</span>
                <span
                  v-if="source === 'script'"
                  class="extract-col__head-ico"
                  aria-hidden="true"
                  role="button"
                  tabindex="0"
                  @click.stop="openAgentPicker('script')"
                  @keydown.enter.prevent="openAgentPicker('script')"
                >
                  <img src="/assets/img/icon/Subtract.svg" alt="" />
                </span>
                <span
                  v-else
                  class="extract-col__head-ico"
                  aria-hidden="true"
                  role="button"
                  tabindex="0"
                  @click.stop="openAgentPicker('video')"
                  @keydown.enter.prevent="openAgentPicker('video')"
                >
                  <img src="/assets/img/icon/Subtract.svg" alt="" />
                </span>
              </div>
              <div class="extract-col__box">
                <button
                  type="button"
                  class="extract-col__card"
                  @click="openAgentPicker(source === 'video' ? 'video' : 'script')"
                >
                  <figure class="extract-col__figure">
                    <div class="extract-col__img-wrap">
                      <img
                        v-if="currentAgent.thumbnail"
                        :src="currentAgent.thumbnail"
                        :alt="currentAgent.name || '智能体'"
                        class="extract-col__img"
                      />
                      <div v-else-if="source === 'script' && scriptAgentsLoading" class="extract-col__img-placeholder">
                        <LoadingOutlined spin />
                      </div>
                      <div v-else class="extract-col__img-placeholder">
                        <ThunderboltOutlined />
                      </div>
                    </div>
                    <figcaption class="extract-col__caption">
                      <div class="extract-col__name">
                        {{
                          source === 'script' && scriptAgentsLoading
                            ? '加载智能体…'
                            : currentAgent.name || '点击选择智能体'
                        }}
                      </div>
                      <p class="extract-col__desc">
                        {{
                          currentAgent.desc ||
                          (currentAgent.name ? '暂无描述' : '从列表中选择适合本环节的智能体')
                        }}
                      </p>
                    </figcaption>
                  </figure>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 脚本：镜头密度 -->
        <div v-if="source === 'script'" class="story-gen-figma__col story-gen-figma__col--density">
          <div class="story-gen-figma__label">镜头密度</div>
          <p v-if="!dictLoaded" class="story-gen-dict-placeholder">加载中…</p>
          <p v-else-if="!shotDensityOptionsResolved.length" class="story-gen-dict-placeholder">暂无数据</p>
          <div v-else class="story-gen-density-list" role="listbox" aria-label="镜头密度">
            <button
              v-for="opt in shotDensityOptionsResolved"
              :key="opt.value"
              type="button"
              role="option"
              :aria-selected="localShotDensity === opt.value"
              :class="['story-gen-density-card', { 'story-gen-density-card--active': localShotDensity === opt.value }]"
              @click="localShotDensity = opt.value"
            >
              <span class="story-gen-density-card__title">{{ opt.label }}</span>
              <span class="story-gen-density-card__desc">{{ opt.desc }}</span>
            </button>
          </div>
        </div>

        <!-- 视频：生视频模型 + 比例 / 清晰度 / 音效（设计稿布局） -->
        <div v-else-if="source === 'video'" class="story-gen-figma__col story-gen-figma__col--video">
          <div class="story-gen-figma__label">生视频模型</div>
          <p v-if="videoModelsLoading" class="story-gen-dict-placeholder">加载中…</p>
          <p v-else-if="!videoModelOptionsResolved.length" class="story-gen-dict-placeholder">暂无数据</p>
          <div v-else class="story-gen-vm-grid" role="listbox" aria-label="生视频模型">
            <button
              v-for="m in videoModelOptionsResolved"
              :key="m.id"
              type="button"
              role="option"
              :aria-selected="localVideoModel === m.id"
              class="story-gen-vm-card"
              :class="{ 'story-gen-vm-card--active': localVideoModel === m.id }"
              @click="selectVideoModel(m.id)"
            >
              <div class="story-gen-vm-card__top">
                <span v-if="m.tag" class="story-gen-vm-card__tag">{{ m.tag }}</span>
                <div v-else class="story-gen-vm-card__tag-spacer" aria-hidden="true" />
                <div class="story-gen-vm-card__icon-wrap">
                  <component :is="m.icon" class="story-gen-vm-card__icon-el" />
                </div>
              </div>
              <div class="story-gen-vm-card__name">{{ m.name }}</div>
              <div class="story-gen-vm-card__desc">{{ m.desc }}</div>
              <div class="story-gen-vm-card__costs">
                <span v-for="(c, i) in m.cost" :key="i" class="story-gen-vm-card__cost">{{ c }}</span>
              </div>
            </button>
          </div>

          <div class="story-gen-video-select-row">
            <div class="story-gen-video-field story-gen-video-field--select">
              <div class="story-gen-video-field__label">比例</div>
              <a-select
                v-model:value="localAspectRatio"
                class="story-gen-video-select"
                popup-class-name="story-gen-video-select-dropdown"
                :options="aspectRatioOptionsResolved"
                :disabled="!aspectRatioOptionsResolved.length"
                not-found-content="暂无数据"
                size="large"
              />
            </div>
            <div class="story-gen-video-field story-gen-video-field--select">
              <div class="story-gen-video-field__label">清晰度</div>
              <a-select
                v-model:value="localResolution"
                class="story-gen-video-select"
                popup-class-name="story-gen-video-select-dropdown"
                :options="resolutionOptionsResolved"
                :disabled="!resolutionOptionsResolved.length"
                not-found-content="暂无数据"
                size="large"
              />
            </div>
            <div class="story-gen-video-field story-gen-video-field--select">
              <div class="story-gen-video-field__label">音效</div>
              <a-select
                v-model:value="localSoundEffects"
                class="story-gen-video-select"
                popup-class-name="story-gen-video-select-dropdown"
                :options="soundEffectsOptionsResolved"
                :disabled="!soundEffectsOptionsResolved.length"
                not-found-content="暂无数据"
                size="large"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="story-gen-figma__footer">
        <span
          v-if="source === 'video' && mode === 'settings'"
          class="story-gen-figma__footer-cost"
        >
          消耗 {{ costPerVideo }}/视频
        </span>
        <div class="story-gen-figma__footer-actions">
          <a-button class="story-gen-figma__btn-cancel" size="large" @click="handleCancel">
            <div class="text-gradient">取消</div>
          </a-button>
          <a-button
            v-if="mode === 'settings'"
            type="primary"
            size="large"
            class="story-gen-figma__btn-ok"
            @click="handleSaveSettings"
          >
            保存设置
          </a-button>
          <a-button v-else type="primary" size="large" class="story-gen-figma__btn-ok" @click="handleConfirm">
            确定
          </a-button>
        </div>
      </div>
    </div>
  </a-modal>

  <AgentPickerModal
    v-if="isFigmaLayout"
    v-model:open="agentPickerOpen"
    :agents="activeAgentPickerList"
    :models="agentPickerAvailableModels"
    :default-query="agentPickerDefaultQuery"
    :initial-model-code="agentPickerInitialModelCode"
    @select="onUnifiedAgentPicked"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, h, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { LoadingOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import AgentPickerModal, { type AgentOption } from '~/components/steps/AgentPickerModal.vue'
import { useCreationStore } from '~/stores/creation'
import { userModelListByFunc } from '~/utils/businessApi'
import { AI_MODEL_FUNC_CODE } from '~/utils/aiModelFuncCodes'
import {
  agentOptionsFromGenConfigVo,
  filterStoryboardScriptAgentsByScriptType,
  pickFirstAgentOption,
  resolveStoryboardScriptApiScriptType
} from '~/utils/extractAgentBiz'
import {
  getProjectGenConfigBySceneCode,
  getProjectGenVideoPromptPickerData,
  STORYBOARD_GEN_CONFIG_SCENE_CODES
} from '~/utils/projectGenConfig'
import type { UserModelListItem } from '~/types/business-api'
import {
  usePromptDictionary,
  filterAspectRatiosForVideoModal,
  resolveShotDensityValue
} from '~/composables/usePromptDictionary'

/** StoryboardShotDensityEnum.value，如「精简模式」「标准模式」「细拆模式」 */
export type ShotDensity = string

/** 内置四款 id 或字典 ModelTypeEnum 的 value */
export type VideoModelId = string
export type AspectRatioOption = '16:9' | '9:16' | '4:3' | '1:1'
export type ResolutionOption = '720p' | '1080p'
export type SoundEffectsOption = 'none' | 'with-sound'

export interface StoryboardVideoGenerateSettings {
  agentId: string
  videoModel: string
  videoPromptModelCode?: string
  aspectRatio: AspectRatioOption
  resolution: ResolutionOption
  soundEffects: SoundEffectsOption
  /** 用户在弹窗内手动切换了提示词智能体/文本模型 */
  manualAgentModelPick?: boolean
  /** 用户在弹窗内手动切换了图生视频模型 */
  manualVideoModelPick?: boolean
}

interface StoryboardAgent {
  id: string
  name: string
  desc: string
  thumbnail?: string
}

interface VideoModelOption {
  id: string
  name: string
  desc: string
  tag?: string
  icon: any
  cost: string[]
}

const ViduIcon = () => h('div', { class: 'video-model-icon-svg video-model-icon-vidu' }, 'V')

const DEFAULT_SHOT_DENSITY = '标准模式'
const VALID_RESOLUTION = new Set<string>(['720p', '1080p'])
const VALID_SOUND = new Set<string>(['none', 'with-sound'])
const STATIC_RESOLUTION_OPTIONS = [
  { value: '720p' as const, label: '720P' },
  { value: '1080p' as const, label: '1080P' }
]

const {
  ensureLoaded,
  loaded: dictLoaded,
  aspectRatioEnumOptions,
  audioSourceEnumOptions,
  storyboardShotDensityEnumOptions
} = usePromptDictionary()

const aspectRatioOptionsResolved = computed(() =>
  filterAspectRatiosForVideoModal(aspectRatioEnumOptions.value).map((r) => ({
    label: r.label,
    value: r.value as AspectRatioOption
  }))
)

const videoModelOptionsResolved = ref<VideoModelOption[]>([])
const videoModelsLoading = ref(false)
const initialVideoModelCode = ref('')

const shotDensityOptionsResolved = computed(() =>
  storyboardShotDensityEnumOptions.value.map((r) => ({
    value: r.value,
    label: r.value,
    desc: r.label
  }))
)

const resolutionOptionsResolved = computed(() =>
  STATIC_RESOLUTION_OPTIONS.filter((r) => VALID_RESOLUTION.has(r.value)).map((r) => ({
    label: r.label,
    value: r.value as ResolutionOption
  }))
)

const soundEffectsOptionsResolved = computed(() =>
  audioSourceEnumOptions.value
    .filter((r) => VALID_SOUND.has(r.value))
    .map((r) => ({ label: r.label, value: r.value as SoundEffectsOption }))
)

const props = withDefaults(
  defineProps<{
    open: boolean
    mode: 'settings' | 'generate'
    /** 弹窗来源：分镜脚本 或 分镜视频，内容不同 */
    source?: 'script' | 'video'
    agent: StoryboardAgent
    shotDensity?: ShotDensity
    /** 分镜视频专用 */
    videoModel?: string
    aspectRatio?: AspectRatioOption
    resolution?: ResolutionOption
    soundEffects?: SoundEffectsOption
    costPerVideo?: number
  }>(),
  {
    source: 'script',
    mode: 'settings',
    shotDensity: DEFAULT_SHOT_DENSITY,
    videoModel: 'vidu-q2-pro',
    aspectRatio: '16:9',
    resolution: '720p',
    soundEffects: 'none',
    costPerVideo: 7
  }
)

const emit = defineEmits<{
  'update:open': [v: boolean]
  save: [
    settings:
      | { agentId: string; shotDensity: ShotDensity; modelCode?: string }
      | StoryboardVideoGenerateSettings
  ]
  confirm: [
    settings:
      | { agentId: string; shotDensity: ShotDensity; modelCode?: string; manualAgentModelPick?: boolean }
      | StoryboardVideoGenerateSettings
  ]
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const isFigmaLayout = computed(() => props.source === 'script' || props.source === 'video')

const modalWidth = computed(() => (isFigmaLayout.value ? 1100 : 560))

const agentColumnHeadTitle = computed(() => (props.source === 'video' ? '视觉导演' : '分镜编剧'))

const figmaTitleWatermark = computed(() => {
  if (props.mode === 'settings') return 'CONFIG'
  return props.source === 'video' ? 'VIDEO' : 'EXTRACT'
})

const modalTitle = computed(() =>
  props.mode === 'settings' ? '生成设置' : props.source === 'video' ? '自动生成分镜视频' : '自动生成分镜'
)

const modalSubtitle = computed(() =>
  props.source === 'video' ? '为分镜视频设置生成参数' : '为分镜脚本设置生成参数'
)

const currentAgent = computed(() => props.agent)

const creationStore = useCreationStore()

/** 脚本 / 视频共用：选择智能体 */
const agentPickerOpen = ref(false)
const agentPickerContext = ref<'script' | 'video'>('script')
/** 用户在弹窗内手动切换了智能体/文本模型（自动批量不传参，仅手动才传 agentCode/modelCode） */
const userPickedAgentOrModel = ref(false)
/** 用户手动切换了图生视频模型（modelName） */
const userPickedVideoModel = ref(false)
const scriptAgentOptions = ref<AgentOption[]>([])
const scriptAgentsLoading = ref(false)
const scriptAvailableModels = ref<UserModelListItem[]>([])
const videoAgentOptions = ref<AgentOption[]>([])
const videoAgentsLoading = ref(false)
const videoAvailableModels = ref<UserModelListItem[]>([])

const activeAgentPickerList = computed(() => {
  if (agentPickerContext.value === 'video') return videoAgentOptions.value
  return scriptAgentOptions.value
})

const agentPickerAvailableModels = computed(() => {
  if (agentPickerContext.value === 'video') return videoAvailableModels.value
  return scriptAvailableModels.value
})

const agentPickerDefaultQuery = computed(() => {
  if (agentPickerContext.value === 'video') return ''
  return '分镜'
})

const agentPickerInitialModelCode = computed(() => {
  if (agentPickerContext.value === 'video') {
    return String(creationStore.storyboardVideoGenerateSettings.videoPromptModelCode || '').trim()
  }
  return String(creationStore.storyboardGenerateSettings.modelCode || '').trim()
})

function applyScriptAgentSelection(autoPickDefault: boolean) {
  const list = scriptAgentOptions.value
  if (!list.length) return

  const currentId = String(currentAgent.value?.id || '').trim()
  const matched = currentId ? list.find((a) => a.id === currentId) : null
  if (matched) {
    creationStore.updateStoryboardAgent({
      id: matched.id,
      name: matched.name,
      desc: matched.desc || '',
      thumbnail: matched.thumbnail
    })
    return
  }
  if (autoPickDefault) {
    const first = pickFirstAgentOption(list)
    if (first) {
      creationStore.updateStoryboardAgent({
        id: first.id,
        name: first.name,
        desc: first.desc || '',
        thumbnail: first.thumbnail
      })
    }
  }
}

async function loadScriptAgents(autoPickDefault = false) {
  scriptAgentsLoading.value = true
  try {
    const pid = Number(creationStore.currentProjectId)
    if (!Number.isFinite(pid) || pid <= 0) {
      scriptAgentOptions.value = []
      scriptAvailableModels.value = []
      return
    }

    const cfg = await getProjectGenConfigBySceneCode(pid, STORYBOARD_GEN_CONFIG_SCENE_CODES.script)
    const allAgents = cfg ? agentOptionsFromGenConfigVo(cfg) : []
    scriptAvailableModels.value = Array.isArray(cfg?.availableModels) ? cfg.availableModels : []
    const scriptType = resolveStoryboardScriptApiScriptType(
      creationStore.formData.globalSetting.scriptType
    )
    scriptAgentOptions.value = filterStoryboardScriptAgentsByScriptType(allAgents, scriptType)

    if (autoPickDefault) {
      const agentCode = String(cfg?.agentCode || '').trim()
      if (agentCode) {
        const matched = scriptAgentOptions.value.find((a) => a.id === agentCode)
        creationStore.updateStoryboardAgent(
          matched
            ? {
                id: matched.id,
                name: matched.name,
                desc: matched.desc || '',
                thumbnail: matched.thumbnail
              }
            : { id: agentCode, name: agentCode, desc: '', thumbnail: '' }
        )
      } else {
        applyScriptAgentSelection(true)
      }
      const modelCode = String(cfg?.modelCode || '').trim()
      if (modelCode) {
        creationStore.setStoryboardGenerateSettings({ modelCode })
      }
    } else {
      applyScriptAgentSelection(false)
    }

    if (autoPickDefault && !scriptAgentOptions.value.length) {
      message.warning('暂无可用分镜脚本智能体')
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载分镜脚本智能体失败')
    scriptAgentOptions.value = []
    scriptAvailableModels.value = []
  } finally {
    scriptAgentsLoading.value = false
  }
}

function applyVideoAgentSelection(autoPickDefault: boolean) {
  const list = videoAgentOptions.value
  if (!list.length) return

  const currentId = String(creationStore.storyboardVideoAgent?.id || '').trim()
  const matched = currentId ? list.find((a) => a.id === currentId) : null
  if (matched) {
    creationStore.updateStoryboardVideoAgent({
      id: matched.id,
      name: matched.name,
      desc: matched.desc || '',
      thumbnail: matched.thumbnail
    })
    return
  }
  if (autoPickDefault) {
    const first = pickFirstAgentOption(list)
    if (first) {
      creationStore.updateStoryboardVideoAgent({
        id: first.id,
        name: first.name,
        desc: first.desc || '',
        thumbnail: first.thumbnail
      })
    }
  }
}

async function loadVideoAgents(autoPickDefault = false) {
  videoAgentsLoading.value = true
  try {
    const pid = Number(creationStore.currentProjectId)
    if (!Number.isFinite(pid) || pid <= 0) {
      videoAgentOptions.value = []
      videoAvailableModels.value = []
      return
    }

    const data = await getProjectGenVideoPromptPickerData(pid)
    videoAgentOptions.value = data?.agents ?? []
    videoAvailableModels.value = data?.availableModels ?? []

    if (autoPickDefault) {
      const agentCode = String(data?.agentCode || '').trim()
      if (agentCode) {
        const matched = videoAgentOptions.value.find((a) => a.id === agentCode)
        creationStore.updateStoryboardVideoAgent(
          matched
            ? {
                id: matched.id,
                name: matched.name,
                desc: matched.desc || '',
                thumbnail: matched.thumbnail
              }
            : { id: agentCode, name: agentCode, desc: '', thumbnail: '' }
        )
      } else {
        applyVideoAgentSelection(true)
      }
      const modelCode = String(data?.modelCode || '').trim()
      if (modelCode) {
        creationStore.setStoryboardVideoGenerateSettings({ videoPromptModelCode: modelCode })
      }
    } else {
      applyVideoAgentSelection(false)
    }

    if (autoPickDefault && !videoAgentOptions.value.length) {
      message.warning('暂无可用分镜视频提示词智能体')
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载分镜视频提示词智能体失败')
    videoAgentOptions.value = []
    videoAvailableModels.value = []
  } finally {
    videoAgentsLoading.value = false
  }
}

function selectVideoModel(modelId: string) {
  userPickedVideoModel.value = true
  localVideoModel.value = modelId
}

/** 图生出片模型池：listByFunc(main_storyboard_video_image) */
async function loadImageVideoModelOptions() {
  videoModelsLoading.value = true
  try {
    const list = await userModelListByFunc(AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_IMAGE)
    videoModelOptionsResolved.value = list
      .map((m) => ({
        id: String(m.modelCode || '').trim(),
        name: String(m.modelName || m.modelCode || '未命名'),
        desc: String(m.providerName || '').trim(),
        icon: ViduIcon,
        cost: [] as string[],
        tag: undefined as string | undefined
      }))
      .filter((m) => m.id)
    const first = videoModelOptionsResolved.value[0]?.id || ''
    initialVideoModelCode.value = first
    const saved = String(props.videoModel || '').trim()
    if (saved && videoModelOptionsResolved.value.some((m) => m.id === saved)) {
      localVideoModel.value = saved
    } else if (first) {
      localVideoModel.value = first
    }
  } catch {
    videoModelOptionsResolved.value = []
  } finally {
    videoModelsLoading.value = false
  }
}

async function openAgentPicker(context?: 'script' | 'video') {
  agentPickerContext.value = context ?? (props.source === 'video' ? 'video' : 'script')

  if (agentPickerContext.value === 'script') {
    if (!scriptAgentOptions.value.length) {
      await loadScriptAgents(false)
    }
    if (!scriptAgentOptions.value.length) {
      message.warning('暂无可用分镜脚本智能体')
      return
    }
  } else if (!videoAgentOptions.value.length) {
    await loadVideoAgents(false)
    if (!videoAgentOptions.value.length) {
      message.warning('暂无可用分镜视频提示词智能体')
      return
    }
  }

  agentPickerOpen.value = true
}

function onUnifiedAgentPicked(payload: { agent?: AgentOption; modelCode?: string }) {
  userPickedAgentOrModel.value = true
  const agent = payload.agent
  const modelCode = String(payload.modelCode || '').trim()
  if (agentPickerContext.value === 'video') {
    if (agent) {
      creationStore.updateStoryboardVideoAgent({
        id: agent.id,
        name: agent.name,
        desc: agent.desc || '',
        thumbnail: agent.thumbnail
      })
    }
    if (modelCode) {
      creationStore.setStoryboardVideoGenerateSettings({ videoPromptModelCode: modelCode })
    } else if (agent) {
      creationStore.setStoryboardVideoGenerateSettings({ videoPromptModelCode: '' })
    }
  } else {
    if (agent) {
      creationStore.updateStoryboardAgent({
        id: agent.id,
        name: agent.name,
        desc: agent.desc || '',
        thumbnail: agent.thumbnail
      })
    }
    if (agent || modelCode) {
      creationStore.setStoryboardGenerateSettings({
        ...(agent ? { agentId: agent.id } : {}),
        ...(modelCode ? { modelCode } : agent ? { modelCode: '' } : {})
      })
    }
  }
}

const localShotDensity = ref<ShotDensity>(props.shotDensity ?? DEFAULT_SHOT_DENSITY)
const localVideoModel = ref<string>(props.videoModel ?? 'vidu-q2-pro')
const localAspectRatio = ref<AspectRatioOption>(props.aspectRatio ?? '16:9')
const localResolution = ref<ResolutionOption>(props.resolution ?? '720p')
const localSoundEffects = ref<SoundEffectsOption>(props.soundEffects ?? 'none')

onMounted(() => {
  void ensureLoaded()
})

watch(
  [() => props.shotDensity, storyboardShotDensityEnumOptions],
  ([v]) => {
    if (v != null) {
      localShotDensity.value = resolveShotDensityValue(v, storyboardShotDensityEnumOptions.value)
    }
  },
  { immediate: true }
)
watch(
  () => [props.videoModel, props.aspectRatio, props.resolution, props.soundEffects],
  () => {
    if (props.videoModel != null) localVideoModel.value = props.videoModel
    if (props.aspectRatio != null) localAspectRatio.value = props.aspectRatio
    if (props.resolution != null) localResolution.value = props.resolution
    if (props.soundEffects != null) localSoundEffects.value = props.soundEffects
  },
  { immediate: true }
)
watch(
  () => props.open,
  (v) => {
    if (v) {
      void ensureLoaded()
      userPickedAgentOrModel.value = false
      userPickedVideoModel.value = false
      if (props.source === 'script') {
        localShotDensity.value = resolveShotDensityValue(
          props.shotDensity,
          storyboardShotDensityEnumOptions.value
        )
        void loadScriptAgents(true)
      } else {
        localAspectRatio.value = props.aspectRatio ?? '16:9'
        localResolution.value = props.resolution ?? '720p'
        localSoundEffects.value = props.soundEffects ?? 'none'
        void loadVideoAgents(true)
        void loadImageVideoModelOptions()
      }
    }
  }
)

function snapToFirstOption<T extends string>(current: T, allowed: T[], fallback: T): T {
  if (!allowed.length) return current ?? fallback
  if (allowed.includes(current)) return current
  return allowed[0]
}

watch(
  [aspectRatioOptionsResolved, () => localAspectRatio.value],
  ([opts]) => {
    const values = opts.map((o) => o.value)
    localAspectRatio.value = snapToFirstOption(
      localAspectRatio.value,
      values as AspectRatioOption[],
      '16:9'
    )
  },
  { flush: 'post' }
)

watch(
  [videoModelOptionsResolved, () => localVideoModel.value],
  () => {
    const opts = videoModelOptionsResolved.value
    const ids = opts.map((o) => o.id)
    localVideoModel.value = snapToFirstOption(localVideoModel.value, ids, ids[0] || 'vidu-q2-pro')
  },
  { flush: 'post' }
)

watch(
  [resolutionOptionsResolved, () => localResolution.value],
  ([opts]) => {
    const values = opts.map((o) => o.value)
    localResolution.value = snapToFirstOption(
      localResolution.value,
      values as ResolutionOption[],
      '720p'
    )
  },
  { flush: 'post' }
)

watch(
  [soundEffectsOptionsResolved, () => localSoundEffects.value],
  ([opts]) => {
    const values = opts.map((o) => o.value)
    localSoundEffects.value = snapToFirstOption(
      localSoundEffects.value,
      values as SoundEffectsOption[],
      'none'
    )
  },
  { flush: 'post' }
)

watch(
  [shotDensityOptionsResolved, () => localShotDensity.value],
  ([opts]) => {
    localShotDensity.value = resolveShotDensityValue(
      localShotDensity.value,
      opts.map((o) => ({ value: o.value, label: o.desc }))
    )
  },
  { flush: 'post' }
)

function handleCancel() {
  localOpen.value = false
}

function handleSaveSettings() {
  if (props.source === 'video') {
    emit('save', {
      agentId: currentAgent.value.id,
      videoModel: localVideoModel.value,
      videoPromptModelCode: String(
        creationStore.storyboardVideoGenerateSettings.videoPromptModelCode || ''
      ).trim(),
      aspectRatio: localAspectRatio.value,
      resolution: localResolution.value,
      soundEffects: localSoundEffects.value
    })
  } else {
    emit('save', {
      agentId: currentAgent.value.id,
      shotDensity: localShotDensity.value,
      modelCode: String(creationStore.storyboardGenerateSettings.modelCode || '').trim() || undefined
    })
  }
  localOpen.value = false
}

function handleConfirm() {
  if (props.source === 'video') {
    emit('confirm', {
      agentId: currentAgent.value.id,
      videoModel: localVideoModel.value,
      videoPromptModelCode: userPickedAgentOrModel.value
        ? String(creationStore.storyboardVideoGenerateSettings.videoPromptModelCode || '').trim()
        : '',
      aspectRatio: localAspectRatio.value,
      resolution: localResolution.value,
      soundEffects: localSoundEffects.value,
      manualAgentModelPick: userPickedAgentOrModel.value,
      manualVideoModelPick: userPickedVideoModel.value
    })
  } else {
    emit('confirm', {
      agentId: currentAgent.value.id,
      shotDensity: localShotDensity.value,
      modelCode: userPickedAgentOrModel.value
        ? String(creationStore.storyboardGenerateSettings.modelCode || '').trim() || undefined
        : undefined,
      manualAgentModelPick: userPickedAgentOrModel.value
    })
  }
  localOpen.value = false
}
</script>

<style scoped>
.storyboard-generate-modal :deep(.ant-modal-header) {
  padding-bottom: 0.25rem;
}

.storyboard-generate-modal :deep(.ant-modal-footer) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* 分镜脚本：Figma 1100 弹窗（与提取/创作流深色壳一致） */
.storyboard-generate-modal.storyboard-generate-modal--figma :deep(.ant-modal-content) {
  padding: 0 !important;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.storyboard-generate-modal.storyboard-generate-modal--figma :deep(.ant-modal-header) {
  margin: 0;
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: none !important;
  background: #191a1d;
}

.storyboard-generate-modal.storyboard-generate-modal--figma :deep(.ant-modal-title) {
  width: 100%;
}

.storyboard-generate-modal.storyboard-generate-modal--figma :deep(.modal-title-watermark__bg) {
  opacity: 0.2;
}

.storyboard-generate-modal.storyboard-generate-modal--figma :deep(.ant-modal-close) {
  top: 1rem;
  inset-inline-end: 1rem;
  color: rgba(255, 255, 255, 0.75);
}

.storyboard-generate-modal.storyboard-generate-modal--figma :deep(.ant-modal-close:hover) {
  color: #4ae7fd;
}

.storyboard-generate-modal.storyboard-generate-modal--figma :deep(.ant-modal-body) {
  padding: 0 !important;
  background: #191a1d;
}

.story-gen-figma__grid {
  display: grid;
  grid-template-columns: 350px minmax(0, 1fr);
  gap: 0;
  padding: 0 1.5rem 1rem;
  align-items: start;
}

/* 左右栏之间 1px 分割线 */
.story-gen-figma__col--density,
.story-gen-figma__col--video {
  border-left: 1px solid rgba(74, 231, 253, 0.3);
  padding-left: 1rem;
  margin-left: 1rem;
  min-width: 0;
}

@media (max-width: 960px) {
  .story-gen-figma__grid {
    grid-template-columns: 1fr;
  }

  .story-gen-figma__col--density,
  .story-gen-figma__col--video {
    border-left: none;
    margin-left: 0;
    padding-left: 0;
    border-top: 1px solid rgba(74, 231, 253, 0.3);
    padding-top: 1rem;
    margin-top: 1rem;
  }
}

.story-gen-figma__label {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 10px;
  line-height: 1.4;
}

/* 左侧：与 ExtractAgentModal 单列 extract-columns / extract-col 一致 */
.story-gen-extract-columns.extract-columns {
  display: grid;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(22, 26, 36, 0.6);
  border:1px solid rgba(74, 231, 253, 0.3) ;
}

.story-gen-extract-columns.extract-columns--1 {
  grid-template-columns: minmax(0, 1fr);
}

.story-gen-figma .extract-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.story-gen-figma .extract-col__head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-bottom: 0.5rem;
  background: rgba(32, 36, 52, 1);
  height: 40px;
}

.story-gen-figma .extract-col__head-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #fff;
  flex-shrink: 0;
}

.story-gen-figma .extract-col__head-ico img {
  width: 14px;
  height: 14px;
}

.story-gen-figma .extract-col__head-text {
  font-size: 16px;
  font-weight: 600;
  color: #e6edf3;
}

.story-gen-figma .extract-col__figure {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.extract-col__box{
  padding:22px 12px 12px;
}
.story-gen-figma .extract-col__card {
  flex: 1;
  display: block;
  width: 100%;
  margin: 0;
  padding: 12px 0;
  border-radius: 12px;
  border: 1px solid transparent;
  overflow: hidden;
  cursor: pointer;
  background:rgba(22, 26, 36, 0.6);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.story-gen-figma .extract-col__card:hover {
  border: 1px solid rgba(74, 231, 253, 0.95);
  box-shadow:
    0 0 0 1px rgba(74, 231, 253, 0.35),
    0 8px 28px rgba(0, 163, 255, 0.18);
  background: rgba(22, 28, 40, 0.92);
}

.story-gen-figma .extract-col__card:focus-visible {
  outline: 2px solid rgba(74, 231, 253, 0.65);
  outline-offset: 2px;
}

.story-gen-figma .extract-col__img-wrap {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(10, 14, 22, 0.9);
  border: 1px solid rgba(74, 231, 253, 0.28);
}

.story-gen-figma .extract-col__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.story-gen-figma .extract-col__img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(74, 231, 253, 0.45);
  font-size: 2rem;
}

.story-gen-figma .extract-col__caption {
  margin-top: 0.75rem;
  width: 100%;
  text-align: center;
  background: #111111;
  padding: 10px 0;
}

.story-gen-figma .extract-col__name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.4;
  margin: 0 0 0.4rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-gen-figma .extract-col__desc {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.55;
  color: rgba(142, 151, 165, 0.98);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-gen-dict-placeholder {
  margin: 0;
  padding: 12px 0;
  font-size: 14px;
  color: #8e97a5;
  line-height: 1.5;
}

.story-gen-density-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.story-gen-density-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-height: 82px;
  padding: 14px 16px;
  width: 100%;
  text-align: left;
  border: 2px solid rgba(74, 231, 253, 0.3);
  border-radius: 8px;
  background: #111621;
  color: #fff;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.story-gen-density-card:hover:not(.story-gen-density-card--active) {
  border-color: rgba(74, 231, 253, 0.55);
  background: rgba(22, 28, 40, 0.4);
}

.story-gen-density-card--active {
  border-color: #4ae7fd;
  background: rgba(22, 28, 40, 0.5);
  box-shadow:
    0 0 0 1px rgba(74, 231, 253, 0.2),
    0 6px 20px rgba(0, 163, 255, 0.12);
}

.story-gen-density-card__title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  line-height: 1.375;
}

.story-gen-density-card__desc {
  font-size: 14px;
  line-height: 1.45;
  color: #8e97a5;
}

.story-gen-density-card--active .story-gen-density-card__desc {
  color: rgba(142, 151, 165, 0.95);
}

/* 分镜视频右侧：2×2 模型卡 + 比例/清晰度/音效芯片行 */
.story-gen-vm-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.story-gen-vm-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  min-height: 148px;
  padding: 12px 12px 14px;
  text-align: left;
  border: 3px solid rgba(74, 231, 253, 0.3);
  border-radius: 8px;
  background: #111621;
  color: #fff;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.story-gen-vm-card:hover:not(.story-gen-vm-card--active) {
  border-color: rgba(74, 231, 253, 0.55);
  background: rgba(22, 28, 40, 0.45);
}

.story-gen-vm-card--active {
  border-color: #4ae7fd;
  background: rgba(22, 28, 40, 0.55);
  box-shadow:
    0 0 0 1px rgba(74, 231, 253, 0.2),
    0 6px 20px rgba(0, 163, 255, 0.12);
}

.story-gen-vm-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
}

.story-gen-vm-card__tag {
  font-size: 12px;
  line-height: 1.2;
  font-weight: 600;
  color: #7ef0ff;
  background: rgba(74, 231, 253, 0.14);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(74, 231, 253, 0.35);
}

.story-gen-vm-card__tag-spacer {
  flex-shrink: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.story-gen-vm-card__icon-wrap {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  overflow: hidden;
}

.story-gen-vm-card__icon-el {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.story-gen-vm-card__name {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.35;
}

.story-gen-vm-card__desc {
  font-size: 13px;
  line-height: 1.45;
  color: #8e97a5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-gen-vm-card__costs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: auto;
  padding-top: 4px;
}

.story-gen-vm-card__cost {
  font-size: 12px;
  line-height: 1.3;
  color: rgba(142, 151, 165, 0.95);
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* 比例 / 清晰度 / 音效：一行三列下拉（图二） */
.story-gen-video-select-row {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.story-gen-video-field--select {
  min-width: 0;
}

.story-gen-video-field--select .story-gen-video-field__label {
  font-size: 14px;
  font-weight: 500;
  color: #8e97a5;
  margin-bottom: 8px;
  line-height: 1.4;
}

.story-gen-video-select {
  width: 100%;
}

.story-gen-figma .story-gen-video-select :deep(.ant-select-selector) {
  background: rgba(18, 18, 18, 1) !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 8px !important;
  color: #e6edf3 !important;
  min-height: 40px !important;
  padding: 4px 11px !important;
  align-items: center !important;
}

.story-gen-figma .story-gen-video-select:hover :deep(.ant-select-selector),
.story-gen-figma .story-gen-video-select.ant-select-focused :deep(.ant-select-selector),
.story-gen-figma .story-gen-video-select.ant-select-open :deep(.ant-select-selector) {
  background: rgba(18, 18, 18, 1) !important;
  border: none !important;
  box-shadow: none !important;
}

.story-gen-figma .story-gen-video-select :deep(.ant-select-selection-item),
.story-gen-figma .story-gen-video-select :deep(.ant-select-selection-placeholder) {
  color: #e6edf3 !important;
  line-height: 30px !important;
}

.story-gen-figma .story-gen-video-select :deep(.ant-select-arrow) {
  color: rgba(255, 255, 255, 0.55);
}

@media (max-width: 960px) {
  .story-gen-vm-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .story-gen-video-select-row {
    grid-template-columns: 1fr;
  }
}

.story-gen-figma__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 1rem 0 0;
  border-top: 1px solid rgba(74, 231, 253, 0.12);
  background: #191a1d;
}

.story-gen-figma__footer-cost {
  font-size: 14px;
  color: #8e97a5;
  line-height: 40px;
}

.story-gen-figma__footer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.story-gen-figma__btn-cancel {
  min-width: 104px;
  border-radius: 10px !important;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
  background: #121212 !important;
  color: #e6edf3 !important;
  height: 40px;
}

.story-gen-figma__btn-cancel:hover {
  border-color: rgba(74, 231, 253, 0.45) !important;
  color: #4ae7fd !important;
}

.story-gen-figma__btn-ok {
  min-width: 104px;
  height: 40px;
  border-radius: 10px !important;
  border: none !important;
  font-weight: 600;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  color: #fff !important;
  box-shadow: none !important;
}

.story-gen-figma__btn-ok:hover:not(:disabled) {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  color: #fff !important;
}

.modal-header {
  padding-right: 0.5rem;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  display: block;
}

.modal-subtitle {
  font-size: 0.8125rem;
  color: var(--home-muted, #8e97a5);
  margin: 0.25rem 0 0;
}

.modal-body {
  padding: 0.5rem 0 1rem;
}

.form-section {
  margin-bottom: 1.25rem;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.5rem;
}

.agent-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: var(--create-surface-canvas);
  cursor: pointer;
  transition: all 0.2s;
}

.agent-card:hover {
  border-color: var(--accent-400, #4ae7fd);
  background: rgba(74, 231, 253, 0.08);
}

.agent-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--create-surface-panel);
  border-radius: var(--radius-md);
  color: var(--home-muted, #8e97a5);
  font-size: 1.25rem;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.25rem;
}

.agent-desc {
  font-size: 0.8125rem;
  color: var(--home-muted, #8e97a5);
  line-height: 1.4;
}

.agent-arrow {
  color: var(--home-muted, #8e97a5);
  font-size: 0.75rem;
}

.shot-density-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.shot-density-card {
  padding: 0.75rem 1rem;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: var(--create-surface-canvas);
  cursor: pointer;
  transition: all 0.2s;
}

.shot-density-card:hover {
  border-color: var(--accent-400, #4ae7fd);
  background: rgba(74, 231, 253, 0.08);
}

.shot-density-card.active {
  border-color: var(--accent-500, #4ae7fd);
  background: rgba(74, 231, 253, 0.14);
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.22);
}

.shot-density-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--home-text, #e6edf3);
}

.shot-density-desc {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--home-muted, #8e97a5);
}

.shot-density-card.active .shot-density-name,
.shot-density-card.active .shot-density-desc {
  color: var(--home-text, #e6edf3);
}

.shot-density-card.active .shot-density-desc {
  color: var(--home-muted, #a8b4c4);
  opacity: 1;
}

/* 分镜视频：生视频模型 */
.video-model-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.video-model-card {
  padding: 0.75rem 1rem;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: var(--create-surface-canvas);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.video-model-card:hover {
  border-color: var(--accent-400, #4ae7fd);
  background: rgba(74, 231, 253, 0.08);
}

.video-model-card.active {
  border-color: var(--accent-500, #4ae7fd);
  background: rgba(74, 231, 253, 0.14);
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.28);
}

.video-model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.video-model-tag {
  font-size: 0.6875rem;
  color: var(--accent-400, #7ef0ff);
  background: rgba(74, 231, 253, 0.12);
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-sm);
}

.video-model-icon-wrap {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.video-model-icon-svg {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  color: #fff;
}

.video-model-icon-vidu {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.video-model-icon-keling {
  background: linear-gradient(135deg, #1f2937, #111827);
}

.video-model-name {
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.25rem;
}

.video-model-desc {
  font-size: 0.8125rem;
  color: var(--home-muted, #8e97a5);
  line-height: 1.4;
  margin-bottom: 0.35rem;
}

.video-model-cost {
  font-size: 0.75rem;
  color: var(--home-muted, #8e97a5);
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
}

.video-model-card.active .video-model-name {
  color: var(--home-text, #e6edf3);
}

.video-model-card.active .video-model-desc,
.video-model-card.active .video-model-cost {
  color: var(--home-muted, #a8b4c4);
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-section-half {
  flex: 1;
  min-width: 0;
}

.form-select {
  width: 100%;
}

.form-select-full {
  max-width: 100%;
}

.footer-left {
  margin-right: auto;
  display: flex;
  align-items: center;
}

.footer-cost {
  font-size: 0.875rem;
  color: var(--home-muted, #8e97a5);
}
</style>

<!-- 下拉挂载在 body，需非 scoped -->
<style>
.story-gen-video-select-dropdown.ant-select-dropdown {
  background: #111621 !important;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
  border-radius: 8px !important;
  padding: 4px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45) !important;
}

.story-gen-video-select-dropdown .ant-select-item {
  color: #e6edf3 !important;
  border-radius: 6px !important;
}

.story-gen-video-select-dropdown .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: rgba(74, 231, 253, 0.12) !important;
}

.story-gen-video-select-dropdown
  .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  background: rgba(74, 231, 253, 0.2) !important;
  color: #fff !important;
  font-weight: 500;
}
</style>
