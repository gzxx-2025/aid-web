<template>
  <a-modal
    v-model:open="modalOpen"
    :width="'100vw'"
    :style="{ top: 0, paddingBottom: 0, maxWidth: '100vw' }"
    :footer="null"
    :closable="false"
    :mask-closable="false"
    wrap-class-name="create-flow-modal edit-scene-image-modal"
    class="edit-scene-image-modal"
    @cancel="handleCancel"
  >
    <div class="edit-scene-image-container">
      <div class="modal-header">
        <a-button type="text" class="back-btn" @click="handleCancel">
          <template #icon><ArrowLeftOutlined /></template>
          <span>返回</span>
        </a-button>
        <HorizontalScrollTabBar
          ref="sceneTabBarRef"
          root-class="scene-switcher scene-switcher--dubbing"
          track-class="scene-switcher-inner"
        >
          <div
            v-for="(item, index) in sceneItems"
            :key="item.id"
            :class="[
              'scene-image-tab',
              'scene-image-tab--dubbing',
              { active: currentSceneIndex === index }
            ]"
            @click="switchScene(index)"
          >
              <div class="scene-image-thumbnail">
                <div v-if="isSceneGenerating(index)" class="thumbnail-loading-wrap">
                  <LoadingOutlined spin class="thumbnail-loading-icon" />
                </div>
                <div v-else-if="item.videoUrl" class="thumbnail-video-wrap">
                  <video :src="item.videoUrl" class="thumbnail-video" muted />
                </div>
                <div v-else class="thumbnail-placeholder">
                  <VideoCameraOutlined />
                </div>
              </div>
              <span class="scene-label scene-label--dubbing">{{ item.name }}</span>
              <div
                class="dubbing-tab-status"
                :class="{
                  'is-done': item.configured,
                  'is-pending': !item.configured && !isSceneGenerating(index),
                  'is-generating': isSceneGenerating(index)
                }"
              >
                <LoadingOutlined
                  v-if="isSceneGenerating(index)"
                  spin
                  class="dubbing-tab-status-icon"
                />
                <CheckCircleFilled v-else-if="item.configured" class="dubbing-tab-status-icon ok" />
                <InfoCircleOutlined v-else class="dubbing-tab-status-icon" />
                <span v-if="isSceneGenerating(index)" class="dubbing-tab-status-text">生成中...</span>
                <span v-else-if="!item.configured" class="dubbing-tab-status-text">未设置分镜配音</span>
              </div>
            </div>
        </HorizontalScrollTabBar>
      </div>

      <div class="main-content-wrapper">
        <div
          v-if="leftPanelLoading || rightPanelLoading"
          class="panel-skeleton right-panel-skeleton"
        >
          <div class="skeleton-stage-layout">
            <aside class="skeleton-history-panel">
              <div class="skeleton-panel-title" />
              <div class="skeleton-history-list">
                <div v-for="n in 6" :key="`sk-h-${n}`" class="skeleton-history-item" />
              </div>
              <div class="skeleton-history-actions">
                <div class="skeleton-btn" />
                <div class="skeleton-btn" />
              </div>
            </aside>
            <section class="skeleton-canvas-panel">
              <div class="skeleton-canvas-toolbar">
                <div v-for="n in 5" :key="`sk-t-${n}`" class="skeleton-chip" />
              </div>
              <div class="skeleton-canvas-main" />
            </section>
            <aside class="skeleton-config-panel">
              <div class="skeleton-config-tabs">
                <div class="skeleton-tab" />
                <div class="skeleton-tab" />
                <div class="skeleton-tab" />
              </div>
              <div class="skeleton-file-row" />
              <div class="skeleton-textarea" />
              <div class="skeleton-select-row">
                <div v-for="n in 4" :key="`sk-s-${n}`" class="skeleton-select" />
              </div>
              <div class="skeleton-primary-btn" />
            </aside>
          </div>
        </div>
        <div v-else class="figma-stage-layout dubbing-stage-layout">
          <!-- 左：生成记录（与分镜图弹窗一致） -->
          <aside class="stage-history-panel">
            <h4 class="panel-title">生成记录</h4>
            <div class="history-list">
              <template v-if="rightNavEntries.length === 0">
                <div class="history-empty-msg">暂无记录</div>
              </template>
              <template v-else>
                <button
                  v-for="nav in rightNavEntries"
                  :key="nav.key"
                  type="button"
                  :class="[
                    'history-item',
                    'dubbing-history-item',
                    { active: selectedNavKey === nav.key }
                  ]"
                  @click="onRightNavClick(nav.key)"
                >
                  <div v-if="nav.type === 'loading'" class="nav-thumb-loading">
                    <a-spin size="small" />
                  </div>
                  <video
                    v-else-if="nav.url"
                    :src="nav.url"
                    class="history-thumb-video"
                    muted
                    playsinline
                  />
                  <div v-else class="history-empty">—</div>
                </button>
              </template>
            </div>
          </aside>

          <!-- 中：当前选中项的大图预览 -->
          <section class="stage-canvas-panel dubbing-stage-canvas">
            <div v-if="dubbingCanvasMode === 'empty'" class="dubbing-canvas-empty">
              <VideoCameraOutlined />
              <p>暂无分镜视频，请先在「分镜视频」步骤生成或上传</p>
            </div>
            <div v-else-if="dubbingCanvasMode === 'loading'" class="dubbing-canvas-loading">
              <a-spin size="large" />
              <p class="dubbing-canvas-loading-title">{{ dubbingPreviewTitle }}</p>
              <p class="dubbing-gen-loading-text">正在生成中...</p>
            </div>
            <div v-else class="dubbing-canvas-preview">
              <div class="dubbing-gen-card-title">{{ dubbingPreviewTitle }}</div>
              <div class="dubbing-video-hero dubbing-video-hero--in-card">
                <video
                  ref="heroVideoRef"
                  :src="dubbingPreviewUrl"
                  class="dubbing-hero-video"
                  muted
                  playsinline
                />
                <div class="dubbing-hero-play" @click="previewGenVideo(dubbingPreviewUrl)">
                  <span class="dubbing-hero-play-icon"><CaretRightOutlined /></span>
                </div>
                <div v-if="dubbingPreviewUrl" class="dubbing-hero-top-actions">
                  <a-button type="text" class="dubbing-hero-action" @click.stop="fullscreenHero">
                    <FullscreenOutlined />
                  </a-button>
                  <a-button
                    type="text"
                    class="dubbing-hero-action"
                    @click.stop="downloadPreviewVideo"
                  >
                    <DownloadOutlined />
                  </a-button>
                </div>
              </div>
              <div class="dubbing-gen-card-actions dubbing-canvas-actions">
                <template v-if="selectedNavKey === navKeySource">
                  <a-button
                    v-if="currentPanelLipSyncKey === navKeySource"
                    type="default"
                    size="small"
                    danger
                    @click="onCancelDubbingSetting"
                  >
                    取消设置
                  </a-button>
                  <a-button
                    v-else
                    type="primary"
                    size="small"
                    class="btn-set-lipsync"
                    @click="applySourceVideoAsLipSync"
                  >
                    <CheckOutlined class="mr-1" />
                    设置为配音对口型
                  </a-button>
                </template>
                <template v-else>
                  <a-button
                    v-if="currentPanelLipSyncKey === selectedNavKey"
                    type="default"
                    size="small"
                    danger
                    @click="onCancelDubbingSetting"
                  >
                    取消设置
                  </a-button>
                  <a-button
                    v-else
                    type="primary"
                    size="small"
                    class="btn-set-lipsync"
                    @click="applyGeneratedLipSyncFromPreview"
                  >
                    设置为配音对口型
                  </a-button>
                </template>
              </div>
              <div class="dubbing-gen-footer dubbing-canvas-footer">
                <template v-if="uploadPendingActive">
                  <a-button
                    type="primary"
                    size="small"
                    class="btn-set-lipsync"
                    @click="confirmSetLipSync"
                  >
                    <template #icon><PlusOutlined /></template>
                    设置分镜配音对口型
                  </a-button>
                </template>
              </div>
            </div>
          </section>

          <!-- 右：配音配置（Tab 下整块可滚动，低分辨率可滚到「开始配音」） -->
          <aside class="stage-config-panel dubbing-stage-config">
            <div class="dubbing-config-below-tabs">
              <DubbingEditLeftPanel
                :dialogue="draftDialogue"
                :emotion="draftEmotion"
                :lip-sync="draftLipSync"
                :voice-name="draftVoiceName"
                :voice-avatar-url="draftVoiceAvatarUrl"
                :tts-preview-loading="ttsPreviewLoading"
                :tts-preview-duration-sec="ttsPreviewDurationSec"
                @update:dialogue="draftDialogue = $event"
                @update:emotion="draftEmotion = $event"
                @update:lip-sync="draftLipSync = $event"
                @update:voice-name="draftVoiceName = $event"
                @preview-listen="onPreviewListen"
                @pick-voice="onPickVoice"
                @start-dubbing="onStartDubbingPrepare"
              />
            </div>
          </aside>
        </div>
      </div>
    </div>

    <VoiceTimbrePickerModal
      v-model:open="voicePickerOpen"
      :initial-voice-name="draftVoiceName"
      @confirm="onVoiceTimbreConfirm"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { h } from 'vue'
import {
  ArrowLeftOutlined,
  VideoCameraOutlined,
  CheckCircleFilled,
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined,
  CaretRightOutlined,
  FullscreenOutlined,
  DownloadOutlined,
  CheckOutlined,
  PlusOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'
import HorizontalScrollTabBar from '~/components/common/HorizontalScrollTabBar.vue'
import DubbingEditLeftPanel from './DubbingEditLeftPanel.vue'
import VoiceTimbrePickerModal from './VoiceTimbrePickerModal.vue'
import type { DubbingPanel, StoryboardVideoPanel, StoryboardPanel } from '~/types'
import { requestStoryboardDubbingGenerate } from '~/composables/useStoryboardDubbingGenerate'
import {
  userStoryboardGenerateAudio,
  userStoryboardAudioTask,
  userVoiceLibraryTags
} from '~/utils/businessApi'
import { fetchStoryboardRecordsForStoryboard } from '~/utils/storyboardRecordBatch'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { useCreationStore } from '~/stores/creation'
import type { StoryboardRecordRow, StoryboardAudioTaskVO } from '~/types/business-api'
import { htmlToPlainText } from '~/utils/htmlPlain'

const props = withDefaults(
  defineProps<{
    open: boolean
    sceneIndex: number
    dubbingPanels: DubbingPanel[]
    storyboardVideoPanels?: StoryboardVideoPanel[]
    storyboardScriptPanels?: StoryboardPanel[]
    /** 父组件批量生成中的分镜下标，用于弹窗内头部 tab 与右侧列表的 loading */
    batchGeneratingIndices?: number[]
    /** 弹窗实例作用域，配合分镜 id 隔离配音生成 loading */
    editorScopeKey?: string
  }>(),
  { batchGeneratingIndices: () => [], editorScopeKey: 'storyboard-dubbing' }
)

const emit = defineEmits<{
  'update:open': [boolean]
  'update:panels': [panels: DubbingPanel[]]
  'update:storyboardVideoPanels': [panels: StoryboardVideoPanel[]]
}>()

const route = useRoute()
const creationStore = useCreationStore()

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const currentSceneIndex = ref(0)

function resolveDubbingPanelKey(index: number): string {
  const p = props.dubbingPanels[index]
  const id = String(p?.id || '').trim()
  return id || `idx-${index}`
}

const sceneTabBarRef = ref<InstanceType<typeof HorizontalScrollTabBar> | null>(null)
const heroVideoRef = ref<HTMLVideoElement | null>(null)
const leftPanelLoading = ref(false)
const rightPanelLoading = ref(false)
const TAB_SWITCH_SKELETON_MS = 260

/** 与「添加场景图」一致：开始配音后待确认 */
const pendingDubbingByIndex = ref<Record<number, boolean>>({})
const pendingPayloadByIndex = ref<
  Record<number, { mode: 'tts' | 'upload'; localFile: File | null }>
>({})
/** 本会话内点击「设置分镜配音对口型」后，可用「取消设置」恢复到此快照前（对齐「取消添加」） */
const preConfirmPanelByIndex = ref<Record<number, DubbingPanel>>({})
const confirmedDubbingThisSession = ref<Set<number>>(new Set())

const navKeySource = '__source__'
const navKeyLoading = '__loading__'

type DubbingGenItem = {
  id: string
  url: string
  title: string
  dialogue: string
  voiceName: string
  emotion: string
}

const genHistoryByIndex = ref<Record<number, DubbingGenItem[]>>({})
/** 按分镜 panel.id 记录 loading，避免切换 Tab 后下标串流 */
const genLoadingByPanelKey = ref<Record<string, boolean>>({})
const selectedNavKeyByIndex = ref<Record<number, string>>({})
const generatingMetaByIndex = ref<
  Record<number, { voice: string; emotion: string; timeLabel: string }>
>({})

const genHistoryForScene = computed(() => genHistoryByIndex.value[currentSceneIndex.value] || [])
const genLoadingForScene = computed(
  () => !!genLoadingByPanelKey.value[resolveDubbingPanelKey(currentSceneIndex.value)]
)

/** 当前场景是否处于批量生成中（来自父组件），用于与弹窗内「开始配音」的 loading 一并展示 */
const isCurrentSceneBatchGenerating = computed(() => {
  const list = props.batchGeneratingIndices || []
  return list.includes(currentSceneIndex.value)
})

/** 某分镜是否正在生成（弹窗内开始配音 or 父组件批量生成） */
function isSceneGenerating(index: number): boolean {
  return (
    !!genLoadingByPanelKey.value[resolveDubbingPanelKey(index)] ||
    (props.batchGeneratingIndices || []).includes(index)
  )
}

const generatingCardTitle = computed(() => {
  const m = generatingMetaByIndex.value[currentSceneIndex.value]
  if (!m) return '文本朗读 | 配音'
  return `文本朗读 | 配音 ${m.voice} ${m.emotion} ${m.timeLabel}`
})

/** 加载卡片标题：弹窗内生成用 generatingCardTitle，批量生成用「正在生成中...」 */
const loadingCardTitle = computed(() => {
  if (
    isCurrentSceneBatchGenerating.value &&
    !generatingMetaByIndex.value[currentSceneIndex.value]
  ) {
    return '正在生成中...'
  }
  return generatingCardTitle.value
})

function formatDubTime(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function scrollToGenAnchor(key: string) {
  nextTick(() => {
    document.getElementById(`dubbing-gen-anchor-${key}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    })
  })
}

function isPanelDubbingConfigured(p: DubbingPanel | undefined): boolean {
  if (!p) return false
  if (p.dubbingLipSyncVideoUrl && String(p.dubbingLipSyncVideoUrl).trim()) return true
  if (p.storyboardDubbingConfirmed === true) return true
  if (p.status === 'done') return true
  if (String(p.status) === 'done') return true
  if (p.dialogue && String(p.dialogue).trim()) return true
  // 确认提交后必定会写入音色展示名（含「无音色」），作兜底以免 status 未持久化时仍误判为未设置
  if (p.dubbingVoiceName != null && String(p.dubbingVoiceName).trim() !== '') return true
  return false
}

const uploadPendingActive = computed(() => {
  const i = currentSceneIndex.value
  return !!pendingDubbingByIndex.value[i] && pendingPayloadByIndex.value[i]?.mode === 'upload'
})

const isCurrentPanelConfigured = computed(() =>
  isPanelDubbingConfigured(props.dubbingPanels[currentSceneIndex.value])
)

/** 当前分镜已设为配音对口型的条目 key：__source__ 表示原分镜视频，否则为生成项 id，用于仅一条显示「取消设置」 */
const currentPanelLipSyncKey = computed(() => {
  const i = currentSceneIndex.value
  const p = props.dubbingPanels[i]
  const key = p?.dubbingLipSyncKey
  if (key != null && String(key).trim() !== '') return key
  const url = p?.dubbingLipSyncVideoUrl
  if (!url || !String(url).trim()) return null
  if (currentVideoUrl.value === url) return navKeySource
  const gen = genHistoryForScene.value.find((p) => p.url === url)
  return gen ? gen.id : null
})

async function onStartDubbingPrepare(payload: { mode: 'tts' | 'upload'; localFile: File | null }) {
  persistCurrentDraft()
  const i = currentSceneIndex.value
  if (payload.mode === 'upload') {
    pendingDubbingByIndex.value = { ...pendingDubbingByIndex.value, [i]: true }
    pendingPayloadByIndex.value = { ...pendingPayloadByIndex.value, [i]: payload }
    message.info('可在右侧点击「设置分镜配音对口型」确认提交')
    return
  }
  const vp = props.storyboardVideoPanels || []
  const vPanel = vp[i]
  // vPanel?.videos?.find((x: { isStoryboardVideo?: boolean }) => x.isStoryboardVideo) ||
  // vPanel?.videos?.[0]
  const v0 = vPanel?.videos?.find((x) => !!x.isStoryboardVideo) || vPanel?.videos?.[0]
  const src = v0?.url || ''
  if (!src) {
    message.warning('暂无分镜视频')
    return
  }
  generatingMetaByIndex.value = {
    ...generatingMetaByIndex.value,
    [i]: {
      voice: draftVoiceName.value,
      emotion: draftEmotion.value,
      timeLabel: formatDubTime()
    }
  }
  const panelKey = resolveDubbingPanelKey(i)
  genLoadingByPanelKey.value = { ...genLoadingByPanelKey.value, [panelKey]: true }
  selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [i]: navKeyLoading }
  scrollToGenAnchor(navKeyLoading)
  try {
    const { videoUrl } = await requestStoryboardDubbingGenerate({
      dialogue: draftDialogue.value.trim(),
      voiceName: draftVoiceName.value,
      emotion: draftEmotion.value,
      lipSync: draftLipSync.value,
      sourceVideoUrl: src
    })
    const item: DubbingGenItem = {
      id: `dub-gen-${Date.now()}-${i}`,
      url: videoUrl,
      title: `文本朗读 | 配音 ${draftVoiceName.value} ${draftEmotion.value} ${formatDubTime()}`,
      dialogue: draftDialogue.value.trim(),
      voiceName: draftVoiceName.value,
      emotion: draftEmotion.value
    }
    genHistoryByIndex.value = {
      ...genHistoryByIndex.value,
      [i]: [...(genHistoryByIndex.value[i] || []), item]
    }
    selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [i]: item.id }
    scrollToGenAnchor(item.id)
    applyGeneratedLipSync(item)
    message.success('配音视频已生成，已自动设为配音对口型')
  } catch {
    message.error('配音生成失败，请重试')
    selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [i]: navKeySource }
  } finally {
    const gl = { ...genLoadingByPanelKey.value }
    delete gl[panelKey]
    genLoadingByPanelKey.value = gl
    const gm = { ...generatingMetaByIndex.value }
    delete gm[i]
    generatingMetaByIndex.value = gm
  }
}

async function confirmSetLipSync() {
  const i = currentSceneIndex.value
  const panel = props.dubbingPanels[i]
  if (!panel) return

  const payload = pendingPayloadByIndex.value[i]
  if (!payload || payload.mode !== 'upload') {
    message.warning('请使用文本朗读生成后，在卡片上点击「设置为配音对口型」')
    return
  }

  let dubbingUploadedAudioUrl: string | undefined
  if (payload.localFile) {
    const { uploadAudioToOssWithToast } = await import('~/utils/ossUpload')
    const url = await uploadAudioToOssWithToast(payload.localFile)
    if (!url) return
    dubbingUploadedAudioUrl = url
  }

  preConfirmPanelByIndex.value = {
    ...preConfirmPanelByIndex.value,
    [i]: JSON.parse(JSON.stringify(panel)) as DubbingPanel
  }

  const next = props.dubbingPanels.map((p, idx) => {
    if (idx !== i) return p
    return {
      ...p,
      dubbingEmotion: draftEmotion.value,
      dubbingLipSync: draftLipSync.value,
      dubbingVoiceName: draftVoiceName.value || '无音色',
      dubbingVoiceAvatarUrl: draftVoiceAvatarUrl.value || undefined,
      dubbingUploadedAudioUrl,
      status: 'done' as const,
      storyboardDubbingConfirmed: true as const,
      dialogue: p.dialogue || `本地配音：${payload.localFile?.name || '音频'}`
    }
  })
  emit('update:panels', next)
  const np = { ...pendingDubbingByIndex.value }
  delete np[i]
  pendingDubbingByIndex.value = np
  const pp = { ...pendingPayloadByIndex.value }
  delete pp[i]
  pendingPayloadByIndex.value = pp
  confirmedDubbingThisSession.value = new Set([...confirmedDubbingThisSession.value, i])
  message.success('已记录本地配音，对口型任务开发中')
}

/** 将原分镜视频设为配音对口型（列表第一个视频） */
function applySourceVideoAsLipSync() {
  const i = currentSceneIndex.value
  const panel = props.dubbingPanels[i]
  const src = currentVideoUrl.value
  if (!panel || !src) return
  preConfirmPanelByIndex.value = {
    ...preConfirmPanelByIndex.value,
    [i]: JSON.parse(JSON.stringify(panel)) as DubbingPanel
  }
  const script = scriptPanels.value[i]?.scriptContent?.trim() || ''
  const next = props.dubbingPanels.map((p, idx) =>
    idx !== i
      ? p
      : {
          ...p,
          dialogue: draftDialogue.value.trim() || script || p.dialogue || '',
          dubbingVoiceName: draftVoiceName.value || p.dubbingVoiceName || '无音色',
          dubbingEmotion: draftEmotion.value || p.dubbingEmotion,
          dubbingLipSync: draftLipSync.value,
          dubbingVoiceAvatarUrl: draftVoiceAvatarUrl.value || p.dubbingVoiceAvatarUrl,
          dubbingLipSyncVideoUrl: src,
          dubbingLipSyncKey: navKeySource,
          status: 'done' as const,
          storyboardDubbingConfirmed: true as const
        }
  )
  emit('update:panels', next)
  confirmedDubbingThisSession.value = new Set([...confirmedDubbingThisSession.value, i])
  message.success('已设置为配音对口型')
}

function applyGeneratedLipSyncFromPreview() {
  const k = selectedNavKey.value
  const item = genHistoryForScene.value.find((x) => x.id === k)
  if (item) applyGeneratedLipSync(item)
}

function applyGeneratedLipSync(item: DubbingGenItem) {
  const i = currentSceneIndex.value
  const panel = props.dubbingPanels[i]
  if (!panel) return
  preConfirmPanelByIndex.value = {
    ...preConfirmPanelByIndex.value,
    [i]: JSON.parse(JSON.stringify(panel)) as DubbingPanel
  }
  const history = genHistoryForScene.value
  const next = props.dubbingPanels.map((p, idx) =>
    idx !== i
      ? p
      : {
          ...p,
          dialogue: item.dialogue,
          dubbingVoiceName: item.voiceName,
          dubbingEmotion: item.emotion,
          dubbingLipSync: draftLipSync.value,
          dubbingVoiceAvatarUrl: draftVoiceAvatarUrl.value || undefined,
          dubbingLipSyncVideoUrl: item.url,
          dubbingLipSyncKey: item.id,
          dubbingGenHistory: history,
          status: 'done' as const,
          storyboardDubbingConfirmed: true as const
        }
  )
  emit('update:panels', next)
  confirmedDubbingThisSession.value = new Set([...confirmedDubbingThisSession.value, i])
  message.success('已设置为配音对口型')
}

function cancelPendingDubbing() {
  const i = currentSceneIndex.value
  const np = { ...pendingDubbingByIndex.value }
  delete np[i]
  pendingDubbingByIndex.value = np
  const pp = { ...pendingPayloadByIndex.value }
  delete pp[i]
  pendingPayloadByIndex.value = pp
  loadDraftForIndex(i)
  message.success('已取消设置')
}

/** 对齐场景图「取消添加」：待确认时取消待提交；已确认本会话则恢复提交前；已入库的配音则清空该分镜配音 */
function onCancelDubbingSetting() {
  const i = currentSceneIndex.value
  if (pendingDubbingByIndex.value[i]) {
    cancelPendingDubbing()
    return
  }
  if (confirmedDubbingThisSession.value.has(i)) {
    const prev = preConfirmPanelByIndex.value[i]
    if (prev) {
      const next = props.dubbingPanels.map((p, idx) =>
        idx === i ? ({ ...prev } as DubbingPanel) : p
      )
      emit('update:panels', next)
    }
    const ns = new Set(confirmedDubbingThisSession.value)
    ns.delete(i)
    confirmedDubbingThisSession.value = ns
    const pre = { ...preConfirmPanelByIndex.value }
    delete pre[i]
    preConfirmPanelByIndex.value = pre
    loadDraftForIndex(i)
    message.success('已取消设置')
    return
  }
  const p = props.dubbingPanels[i]
  if (isPanelDubbingConfigured(p)) {
    const next = props.dubbingPanels.map((x, idx) =>
      idx === i
        ? {
            ...x,
            dialogue: '',
            status: 'pending' as const,
            dubbingEmotion: undefined,
            dubbingLipSync: false,
            dubbingVoiceName: undefined,
            dubbingVoiceAvatarUrl: undefined,
            dubbingLipSyncVideoUrl: undefined,
            dubbingLipSyncKey: undefined,
            storyboardDubbingConfirmed: false
          }
        : x
    )
    const vp = props.storyboardVideoPanels || []
    const nextVp = vp.map((panel, idx) => (idx === i ? { ...panel, videos: [] } : { ...panel }))
    emit('update:panels', next)
    emit('update:storyboardVideoPanels', nextVp)

    const d = { ...draftByIndex.value }
    delete d[i]
    draftByIndex.value = d

    const found = nextVp.findIndex((_, j) => panelHasStoryboardVideoUrl(nextVp, j))
    const nextIdx = found >= 0 ? found : 0

    nextTick(() => {
      currentSceneIndex.value = nextIdx
      loadDraftForIndex(nextIdx)
    })
    message.success('已取消分镜配音设置')
    return
  }
  message.info('当前无可取消的设置')
}

const draftDialogue = ref('')
const draftEmotion = ref('中性')
const draftLipSync = ref(false)
const draftVoiceName = ref('')
const draftVoiceAvatarUrl = ref('')
const draftVoiceLibraryId = ref(0)
const voicePickerOpen = ref(false)
const ttsPreviewLoadingByPanelKey = ref<Record<string, boolean>>({})
const ttsPreviewDurationByPanelKey = ref<Record<string, number | null>>({})

const ttsPreviewLoading = computed(
  () => !!ttsPreviewLoadingByPanelKey.value[resolveDubbingPanelKey(currentSceneIndex.value)]
)
const ttsPreviewDurationSec = computed(
  () => ttsPreviewDurationByPanelKey.value[resolveDubbingPanelKey(currentSceneIndex.value)] ?? null
)
const emotionNameToCode = ref<Map<string, string>>(new Map())

type Draft = {
  dialogue: string
  emotion: string
  lipSync: boolean
  voiceName: string
  voiceAvatarUrl: string
  voiceLibraryId?: number
}
const draftByIndex = ref<Record<number, Draft>>({})

const videoPanels = computed(() => props.storyboardVideoPanels || [])
const scriptPanels = computed(() => props.storyboardScriptPanels || [])

const serverVideoRecordsByIndex = ref<
  Record<
    number,
    Array<{ id: string; url: string; isSelected?: boolean; _serverRow?: StoryboardRecordRow }>
  >
>({})

function resolveStoryboardIdForIndex(i: number): number | null {
  const raw = scriptPanels.value[i]?.id ?? videoPanels.value[i]?.id
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

function mapRecordRowToVideoThumb(r: StoryboardRecordRow) {
  const url = (r.fileUrl || '').trim()
  return {
    id: String(r.id ?? ''),
    url,
    isSelected: r.isSelected === 1,
    _serverRow: r
  }
}

async function refreshServerVideoRecords(i: number) {
  const storyboardId = resolveStoryboardIdForIndex(i)
  if (!storyboardId) return
  try {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return
    const rows = await fetchStoryboardRecordsForStoryboard(ctx, storyboardId, 'video')
    const mapped = rows
      .filter((r) => !!String(r?.fileUrl ?? '').trim())
      .map(mapRecordRowToVideoThumb)
    serverVideoRecordsByIndex.value = { ...serverVideoRecordsByIndex.value, [i]: mapped }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '获取生成记录失败')
  }
}

function getVideoUrl(index: number): string {
  const panel = videoPanels.value[index]
  const localList = panel?.videos || []
  if (localList.length) {
    const v = localList.find((x: any) => x.isStoryboardVideo) || localList[0]
    return v?.url || ''
  }
  const serverList = serverVideoRecordsByIndex.value[index] || []
  const sv = serverList.find((x) => x.isSelected) || serverList[0]
  return sv?.url || ''
}

function panelHasStoryboardVideoUrl(vPanels: StoryboardVideoPanel[], idx: number): boolean {
  const panel = vPanels[idx]
  if (!panel?.videos?.length) return false
  const v = panel.videos.find((x: any) => x.isStoryboardVideo) || panel.videos[0]
  return !!v?.url
}

/** Tab 文案：已生成分镜视频则不显示「分镜生成中」；未生成则显示「未设置分镜」 */
function formatDubbingSceneTabLabel(
  title: string,
  hasStoryboardVideo: boolean,
  index: number
): string {
  const raw = (title || '').trim()
  if (hasStoryboardVideo) {
    return (
      raw
        .replace(/[:：]\s*分镜生成中\s*$/u, '')
        .replace(/\s*分镜生成中\s*$/u, '')
        .trim() ||
      raw ||
      `分镜视频${index + 1}`
    )
  }
  if (/分镜生成中/.test(raw)) {
    return raw.replace(/分镜生成中/g, '未设置分镜')
  }
  const base =
    raw
      .replace(/[:：]\s*分镜生成中\s*$/u, '')
      .replace(/[:：]\s*$/, '')
      .trim() || raw
  if (!base) return `分镜视频${index + 1}：未设置分镜`
  return base.includes('未设置分镜') ? base : `${base}：未设置分镜`
}

/** Tab 主标题：去掉「未设置分镜」后缀，由下方状态行单独展示 */
function formatDubbingSceneTabPrimaryLabel(
  title: string,
  hasStoryboardVideo: boolean,
  index: number
): string {
  const label = formatDubbingSceneTabLabel(title, hasStoryboardVideo, index)
  if (hasStoryboardVideo) return label
  return label.replace(/[:：]\s*未设置分镜\s*$/u, '').trim() || label
}

const sceneItems = computed(() =>
  props.dubbingPanels.map((p, i) => {
    const videoUrl = getVideoUrl(i)
    const hasVideo = !!videoUrl
    return {
      id: p.id,
      name: formatDubbingSceneTabPrimaryLabel(p.title || '', hasVideo, i),
      videoUrl,
      configured: isPanelDubbingConfigured(p)
    }
  })
)

const currentVideoUrl = computed(() => getVideoUrl(currentSceneIndex.value))

/** 当前场景是否显示「正在生成中」卡片（弹窗内开始配音 or 父组件批量生成） */
const showLoadingCardForScene = computed(
  () => !!genLoadingForScene.value || !!isCurrentSceneBatchGenerating.value
)

/** 当前场景处于生成中时，自动选中右侧列表的「正在生成中」项 */
watch(showLoadingCardForScene, (show) => {
  if (show) {
    const i = currentSceneIndex.value
    if (selectedNavKeyByIndex.value[i] !== navKeyLoading) {
      selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [i]: navKeyLoading }
      scrollToGenAnchor(navKeyLoading)
    }
  }
})

const rightNavEntries = computed(() => {
  const entries: { key: string; type: 'source' | 'gen' | 'loading'; url?: string }[] = []
  if (currentVideoUrl.value) {
    entries.push({ key: navKeySource, type: 'source', url: currentVideoUrl.value })
  }
  for (const item of genHistoryForScene.value) {
    entries.push({ key: item.id, type: 'gen', url: item.url })
  }
  if (showLoadingCardForScene.value) {
    entries.push({ key: navKeyLoading, type: 'loading' })
  }
  return entries
})

const selectedNavKey = computed(() => {
  const i = currentSceneIndex.value
  const k = selectedNavKeyByIndex.value[i]
  return k || navKeySource
})

/** 中间栏预览：与左侧「生成记录」选中项一致 */
const dubbingCanvasMode = computed(() => {
  if (!currentVideoUrl.value) return 'empty' as const
  if (selectedNavKey.value === navKeyLoading && showLoadingCardForScene.value)
    return 'loading' as const
  return 'preview' as const
})

const dubbingPreviewUrl = computed(() => {
  const k = selectedNavKey.value
  if (k === navKeyLoading) return ''
  if (k === navKeySource) return currentVideoUrl.value || ''
  const item = genHistoryForScene.value.find((x) => x.id === k)
  return item?.url || ''
})

const dubbingPreviewTitle = computed(() => {
  const k = selectedNavKey.value
  if (k === navKeyLoading) return loadingCardTitle.value
  if (k === navKeySource) return '分镜视频'
  const item = genHistoryForScene.value.find((x) => x.id === k)
  return item?.title || '配音生成'
})

function onRightNavClick(key: string) {
  const i = currentSceneIndex.value
  selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [i]: key }
  scrollToGenAnchor(key)
}

function previewGenVideo(url: string) {
  if (!url) return
  Modal.info({
    title: '配音预览',
    content: h('video', {
      src: url,
      controls: true,
      style: { width: '100%', maxHeight: '70vh', display: 'block' }
    }),
    width: '80%',
    okText: '关闭',
    zIndex: 12000,
    centered: true
  })
}

function persistCurrentDraft() {
  const i = currentSceneIndex.value
  draftByIndex.value[i] = {
    dialogue: draftDialogue.value,
    emotion: draftEmotion.value,
    lipSync: draftLipSync.value,
    voiceName: draftVoiceName.value,
    voiceAvatarUrl: draftVoiceAvatarUrl.value,
    voiceLibraryId: draftVoiceLibraryId.value > 0 ? draftVoiceLibraryId.value : undefined
  }
}

function loadDraftForIndex(i: number) {
  if (i < 0 || i >= props.dubbingPanels.length) {
    draftDialogue.value = ''
    draftVoiceAvatarUrl.value = ''
    draftVoiceLibraryId.value = 0
    return
  }
  const saved = draftByIndex.value[i]
  const panel = props.dubbingPanels[i]
  const script = scriptPanels.value[i]?.scriptContent?.trim() || ''
  if (saved) {
    draftDialogue.value = saved.dialogue
    draftEmotion.value = saved.emotion
    draftLipSync.value = saved.lipSync
    draftVoiceName.value = saved.voiceName
    draftVoiceAvatarUrl.value = saved.voiceAvatarUrl || ''
    draftVoiceLibraryId.value =
      saved.voiceLibraryId != null && saved.voiceLibraryId > 0 ? saved.voiceLibraryId : 0
    return
  }
  draftDialogue.value = panel?.dialogue?.trim() ? panel.dialogue : script.slice(0, 50)
  draftEmotion.value = panel?.dubbingEmotion || '中性'
  draftLipSync.value = !!panel?.dubbingLipSync
  draftVoiceName.value = panel?.dubbingVoiceName || ''
  draftVoiceAvatarUrl.value = panel?.dubbingVoiceAvatarUrl || ''
  draftVoiceLibraryId.value = 0
}

function switchScene(index: number) {
  if (index === currentSceneIndex.value || index < 0 || index >= props.dubbingPanels.length) return
  persistCurrentDraft()
  leftPanelLoading.value = true
  rightPanelLoading.value = true
  currentSceneIndex.value = index
  loadDraftForIndex(index)
  nextTick().then(() => {
    scrollActiveSceneTabIntoView()
    setTimeout(() => {
      leftPanelLoading.value = false
      rightPanelLoading.value = false
    }, TAB_SWITCH_SKELETON_MS)
  })
}

function scrollActiveSceneTabIntoView() {
  sceneTabBarRef.value?.scrollItemIntoView('.scene-image-tab.active')
  sceneTabBarRef.value?.refresh()
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      ttsPreviewLoadingByPanelKey.value = {}
      ttsPreviewDurationByPanelKey.value = {}
      void refreshEmotionTagCodeMap()
      leftPanelLoading.value = true
      rightPanelLoading.value = true
      draftByIndex.value = {}
      pendingDubbingByIndex.value = {}
      pendingPayloadByIndex.value = {}
      preConfirmPanelByIndex.value = {}
      confirmedDubbingThisSession.value = new Set()
      // 从 panel 恢复生成历史，使批量生成与弹窗内生成的视频均以「新增一条」形式展示
      const nextGen: Record<number, DubbingGenItem[]> = {}
      props.dubbingPanels.forEach((p, i) => {
        nextGen[i] = [...(p.dubbingGenHistory || [])]
      })
      genHistoryByIndex.value = nextGen
      // 打开弹窗时批量拉取各分镜的视频生成记录（用于右侧列表/预览的“源分镜视频”）
      serverVideoRecordsByIndex.value = {}
      props.dubbingPanels.forEach((_, i) => {
        refreshServerVideoRecords(i)
      })
      currentSceneIndex.value = Math.min(
        Math.max(0, props.sceneIndex),
        Math.max(0, props.dubbingPanels.length - 1)
      )
      loadDraftForIndex(currentSceneIndex.value)
      nextTick().then(() => {
        scrollActiveSceneTabIntoView()
        sceneTabBarRef.value?.refresh()
        setTimeout(() => {
          leftPanelLoading.value = false
          rightPanelLoading.value = false
        }, TAB_SWITCH_SKELETON_MS)
      })
    }
  }
)

watch(
  () => props.sceneIndex,
  (v) => {
    if (props.open && v >= 0 && v < props.dubbingPanels.length) {
      switchScene(v)
      refreshServerVideoRecords(v)
    }
  }
)

watch(
  () => props.dubbingPanels,
  (panels) => {
    if (!props.open || !panels?.length) return
    panels.forEach((p, i) => {
      const hist = p.dubbingGenHistory || []
      if (hist.length > 0) genHistoryByIndex.value[i] = [...hist]
    })
  },
  { deep: true }
)

function handleCancel() {
  persistCurrentDraft()
  emit('update:open', false)
}

async function refreshEmotionTagCodeMap() {
  try {
    const data = await userVoiceLibraryTags()
    const m = new Map<string, string>()
    for (const t of data.emotionTags || []) {
      const code = (t.tagCode || '').trim().toLowerCase()
      if (!code) continue
      m.set(code, code)
      if (t.tagName) m.set(t.tagName.trim(), code)
    }
    emotionNameToCode.value = m
  } catch {
    emotionNameToCode.value = new Map([
      ['中性', 'neutral'],
      ['高兴', 'happy'],
      ['开心', 'happy'],
      ['悲伤', 'sad'],
      ['生气', 'angry'],
      ['愤怒', 'angry'],
      ['激动', 'excited'],
      ['neutral', 'neutral'],
      ['happy', 'happy'],
      ['sad', 'sad'],
      ['angry', 'angry']
    ])
  }
}

function resolveEmotionApiCode(label: string): string {
  const raw = (label || '').trim()
  if (!raw) return 'neutral'
  const hit = emotionNameToCode.value.get(raw)
  if (hit) return hit
  if (/^[a-z][a-z0-9_]*$/i.test(raw)) return raw.toLowerCase()
  return 'neutral'
}

async function pollStoryboardAudioTask(taskId: number): Promise<StoryboardAudioTaskVO> {
  const maxAttempts = 80
  const intervalMs = 1000
  for (let n = 0; n < maxAttempts; n++) {
    const row = await userStoryboardAudioTask(taskId)
    const st = String(row.status || '').toUpperCase()
    if (st === 'SUCCEEDED' && String(row.audioUrl || '').trim()) return row
    if (st === 'FAILED') {
      const em = String(row.errorMessage || '').trim() || '配音失败'
      throw new Error(em)
    }
    await new Promise<void>((r) => setTimeout(r, intervalMs))
  }
  throw new Error('生成超时，请稍后重试')
}

function loadAudioDurationSec(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = new Audio()
    a.preload = 'metadata'
    a.onloadedmetadata = () => {
      const d = a.duration
      a.removeAttribute('src')
      a.load()
      if (Number.isFinite(d) && d > 0) resolve(d)
      else reject(new Error('无法读取音频时长'))
    }
    a.onerror = () => reject(new Error('无法加载试听音频'))
    a.src = url
  })
}

async function onPreviewListen() {
  const panelKey = resolveDubbingPanelKey(currentSceneIndex.value)
  if (ttsPreviewLoadingByPanelKey.value[panelKey]) return
  const plain = htmlToPlainText(draftDialogue.value).trim()
  if (!plain) {
    message.warning('请输入内容')
    return
  }
  const lid = draftVoiceLibraryId.value
  if (!lid || lid <= 0) {
    message.warning('请选择音色')
    return
  }
  const storyboardId = resolveStoryboardIdForIndex(currentSceneIndex.value)
  if (!storyboardId) {
    message.warning('缺少分镜信息，无法试听')
    return
  }
  ttsPreviewLoadingByPanelKey.value = { ...ttsPreviewLoadingByPanelKey.value, [panelKey]: true }
  ttsPreviewDurationByPanelKey.value = { ...ttsPreviewDurationByPanelKey.value, [panelKey]: null }
  try {
    const submitted = await userStoryboardGenerateAudio({
      storyboardId,
      ttsText: plain,
      voiceLibraryId: lid,
      emotion: resolveEmotionApiCode(draftEmotion.value),
      emotionScale: 4,
      audioFormat: 'mp3',
      sampleRate: 24000
    })
    const taskId = Number(submitted?.id)
    if (!Number.isFinite(taskId) || taskId <= 0) throw new Error('任务创建失败')
    const done = await pollStoryboardAudioTask(taskId)
    const url = String(done.audioUrl || '').trim()
    if (!url) throw new Error('未返回音频地址')
    const sec = await loadAudioDurationSec(url)
    ttsPreviewDurationByPanelKey.value = {
      ...ttsPreviewDurationByPanelKey.value,
      [panelKey]: sec
    }
    message.success(`试听完成，时长 ${sec.toFixed(1)} 秒`)
    const play = new Audio(url)
    void play.play().catch(() => {
      message.warning('自动播放被浏览器拦截，请再点击一次试听')
    })
  } catch (e: unknown) {
    const err = e as { message?: string; msg?: string }
    message.error(err?.message || err?.msg || '试听失败，请稍后重试')
  } finally {
    const next = { ...ttsPreviewLoadingByPanelKey.value }
    delete next[panelKey]
    ttsPreviewLoadingByPanelKey.value = next
  }
}

function onPickVoice() {
  voicePickerOpen.value = true
}

function onVoiceTimbreConfirm(payload: {
  name: string
  avatarUrl: string
  id: string
  previewUrl: string
  voiceLibraryId?: number
}) {
  draftVoiceName.value = payload.name
  draftVoiceAvatarUrl.value = payload.avatarUrl
  draftVoiceLibraryId.value =
    payload.voiceLibraryId != null && payload.voiceLibraryId > 0 ? payload.voiceLibraryId : 0
  message.success(`已选择音色：${payload.name}`)
}

function previewHeroVideo() {
  const url = currentVideoUrl.value
  if (!url) return
  Modal.info({
    title: props.dubbingPanels[currentSceneIndex.value]?.title || '分镜视频预览',
    content: h('video', {
      src: url,
      controls: true,
      style: { width: '100%', maxHeight: '70vh', display: 'block' }
    }),
    width: '80%',
    okText: '关闭',
    zIndex: 12000,
    centered: true
  })
}

function fullscreenHero() {
  const el = heroVideoRef.value
  if (!el) {
    previewGenVideo(dubbingPreviewUrl.value)
    return
  }
  el.requestFullscreen?.().catch(() => previewGenVideo(dubbingPreviewUrl.value))
}

function downloadPreviewVideo() {
  const url = dubbingPreviewUrl.value
  if (!url) {
    message.warning('暂无视频可下载')
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download =
    dubbingPreviewTitle.value || props.dubbingPanels[currentSceneIndex.value]?.title || '分镜视频'
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  message.success('开始下载')
}
</script>

<style scoped>
/* 与 EditStoryboardImageModal 全屏分镜弹窗一致 */
.edit-scene-image-modal :deep(.ant-modal) {
  max-width: 100vw;
  margin: 0;
  padding: 0;
  top: 0;
  height: 100vh;
}

.edit-scene-image-modal :deep(.ant-modal-content) {
  height: 100vh !important;
  display: flex !important;
  flex-direction: column !important;
  border-radius: 0 !important;
  background: rgba(11, 15, 23, 1) !important;
  padding: 0 !important;
}

.edit-scene-image-modal :deep(.ant-modal-body) {
  flex: 1;
  padding: 0;
  overflow: hidden;
}

.edit-scene-image-container {
  display: flex;
  flex-direction: column;
  height: 99vh;
  max-height: 100vh;
  background: #0b0f17;
  overflow: hidden;
  min-height: 0;
}

.edit-scene-image-container .main-content-wrapper {
  flex: 1;
  min-height: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: rgba(25, 26, 29, 1);
  border-bottom: 1px solid rgba(128, 154, 188, 0.26);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: rgba(225, 239, 255, 0.9) !important;
  font-size: 14px;
}

.back-btn:hover {
  color: #4ae7fd !important;
  background: rgba(74, 231, 253, 0.08) !important;
}

.scene-switcher {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  padding: 0.25rem 0;
  justify-content: center;
}

.scene-switcher--dubbing {
  overflow: hidden;
}

.scene-switcher-inner {
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.scene-image-tab--dubbing {
  min-width: 92px;
  max-width: 120px;
}

.scene-label--dubbing {
  white-space: normal;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: center;
  line-height: 1.2;
  font-size: 0.7rem;
}

.dubbing-tab-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  font-size: 0.62rem;
  color: rgba(188, 205, 228, 0.75);
  line-height: 1.1;
  text-align: center;
}

.dubbing-tab-status.is-done .dubbing-tab-status-icon.ok {
  color: #52c41a;
  font-size: 0.9rem;
}

.dubbing-tab-status.is-generating {
  color: var(--accent-600, #4ae7fd);
}

.main-content-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}

/* 与 EditStoryboardImageModal 一致：左 144 | 中 自适应 | 右 398 */
.figma-stage-layout.dubbing-stage-layout {
  display: grid;
  grid-template-columns: 144px minmax(0, 1fr) 398px;
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  flex: 1;
  background: #0b0f17;
}

.figma-stage-layout.dubbing-stage-layout > * {
  min-height: 0;
}

.panel-skeleton {
  flex: 1;
  overflow: auto;
  padding: 0;
  min-height: 200px;
}

.right-panel-skeleton {
  flex: 1;
  min-height: 0;
}

.skeleton-stage-layout {
  display: grid;
  grid-template-columns: 144px minmax(0, 1fr) 398px;
  gap: 0;
  width: 100%;
  height: 100%;
}

.skeleton-history-panel,
.skeleton-canvas-panel,
.skeleton-config-panel {
  border: 1px solid rgba(128, 154, 188, 0.26);
  background: rgba(25, 26, 29, 1);
  min-height: 0;
}

.skeleton-history-panel {
  display: flex;
  flex-direction: column;
  padding: 10px 7px;
}

.skeleton-panel-title {
  height: 14px;
  border-radius: 4px;
  margin: 0 4px 10px;
}

.skeleton-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 12px;
}

.skeleton-history-item {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  flex-shrink: 0;
}

.skeleton-history-actions {
  margin-top: auto;
  padding: 0 4px;
  display: grid;
  gap: 6px;
}

.skeleton-btn {
  height: 32px;
  border-radius: 6px;
}

.skeleton-canvas-panel {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-canvas-toolbar {
  display: grid;
  grid-template-columns: repeat(5, minmax(60px, 1fr));
  gap: 8px;
}

.skeleton-chip {
  height: 28px;
  border-radius: 7px;
}

.skeleton-canvas-main {
  flex: 1;
  min-height: 280px;
  border-radius: 12px;
}

.skeleton-config-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-config-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.skeleton-tab {
  height: 32px;
  border-radius: 8px;
}

.skeleton-file-row {
  height: 52px;
  border-radius: 10px;
}

.skeleton-textarea {
  height: 140px;
  border-radius: 10px;
}

.skeleton-select-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.skeleton-select {
  height: 44px;
  border-radius: 10px;
}

.skeleton-primary-btn {
  margin-top: auto;
  height: 42px;
  border-radius: 10px;
}

.skeleton-panel-title,
.skeleton-history-item,
.skeleton-btn,
.skeleton-chip,
.skeleton-canvas-main,
.skeleton-tab,
.skeleton-file-row,
.skeleton-textarea,
.skeleton-select,
.skeleton-primary-btn {
  background: linear-gradient(
    90deg,
    #2b2b2b 20%,
    #444444 50%,
    #2b2b2b 80%
  );
  background-size: 300% 100%;
  animation: storyboard-skeleton-shimmer 1.4s linear infinite;
}

@keyframes storyboard-skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

.stage-history-panel,
.stage-config-panel.dubbing-stage-config {
  border: 1px solid rgba(128, 154, 188, 0.26);
  background: rgba(25, 26, 29, 1);
}

.stage-history-panel {
  display: flex;
  flex-direction: column;
  padding: 10px 7px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.stage-history-panel .panel-title {
  margin: 0 0 10px;
  font-size: 12px;
  color: rgba(225, 239, 255, 0.7);
  flex-shrink: 0;
}

.stage-history-panel .history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  flex: 1;
  padding: 0 12px 10px;
  scrollbar-gutter: stable;
}

.history-empty-msg {
  padding: 12px 8px;
  font-size: 12px;
  color: rgba(225, 239, 255, 0.45);
  text-align: center;
  line-height: 1.4;
}

.stage-history-panel .history-item {
  width: 88px;
  height: 88px;
  flex: 0 0 88px;
  padding: 0;
  border-radius: 8px;
  border: 2px solid rgba(120, 140, 170, 0.3);
  overflow: hidden;
  background: rgba(18, 24, 36, 0.92);
  cursor: pointer;
}

.stage-history-panel .history-item.active {
  border-color: rgba(74, 231, 253, 1);
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.18);
}

.history-thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.stage-history-panel .history-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(225, 239, 255, 0.55);
  font-size: 12px;
}

.dubbing-stage-canvas {
  min-width: 0;
  min-height: 0;
  border-radius: 12px;
  border: 1px solid rgba(128, 154, 188, 0.22);
  background:
    radial-gradient(circle at 1px 1px, rgba(74, 231, 253, 0.1) 1px, transparent 0), #07090d;
  background-size:
    14px 14px,
    auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
}

.dubbing-stage-config {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  height: 100%;
}

.dubbing-config-below-tabs {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  padding: 12px;
  box-sizing: border-box;
  padding-right: 16px;
}

.dubbing-config-below-tabs::-webkit-scrollbar {
  width: 8px;
}

.dubbing-config-below-tabs::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.55);
  border-radius: 4px;
}

.dubbing-stage-config :deep(.dubbing-edit-left) {
  height: auto !important;
  min-height: 0;
  flex: 0 0 auto;
}

@media (max-height: 900px) {
  .dubbing-config-below-tabs {
    padding: 8px 12px 8px 8px;
  }
}

.dubbing-canvas-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: rgba(188, 205, 228, 0.75);
  text-align: center;
  padding: 2rem;
}

.dubbing-canvas-empty .anticon {
  font-size: 2.5rem;
  color: #4ae7fd;
  opacity: 0.85;
}

.dubbing-canvas-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 200px;
  color: #fff;
}

.dubbing-canvas-loading-title {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.85);
}

.dubbing-canvas-preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.dubbing-canvas-actions {
  margin-top: 0;
}

.dubbing-canvas-footer {
  margin-top: auto;
  padding-top: 0.75rem;
}

.nav-thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dubbing-history-item .nav-thumb-loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 10, 18, 0.55);
}

/* 分镜 tab：未选中无边框/背景；选中整卡青色描边 */
.scene-image-tab {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 0.5rem 0.75rem;
  width: 172px;
  min-width: 172px;
  max-width: 172px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: none;
}

.scene-image-tab:hover:not(.active) {
  border-color: transparent;
  background: transparent;
}

.scene-image-tab.active {
  border-color: rgba(74, 231, 253, 1);
  background: transparent;
  box-shadow: none;
}

.scene-image-thumbnail {
  width: 100%;
  height: 54px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: rgba(6, 10, 18, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.thumbnail-video-wrap {
  width: 100%;
  height: 100%;
}

.thumbnail-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--home-muted, #8e97a5);
  font-size: 1.25rem;
}

.thumbnail-loading-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 10, 18, 0.55);
  color: var(--accent-600);
}

.thumbnail-loading-icon {
  font-size: 1.25rem;
}

.scene-label {
  font-size: 0.75rem;
  color: rgba(188, 205, 228, 0.85);
  max-width: 100%;
}

.scene-image-tab.active .scene-label--dubbing {
  font-weight: 500;
}

.dubbing-video-hero {
  position: relative;
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--gray-200, rgba(96, 124, 158, 0.22));
  background: rgba(6, 10, 18, 0.55);
  aspect-ratio: 16 / 9;
  height: 38vh;
}

.dubbing-video-hero--in-card {
  box-shadow: none;
}

.dubbing-hero-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dubbing-hero-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.2);
}

.dubbing-hero-play:hover {
  background: rgba(0, 0, 0, 0.35);
}

.dubbing-hero-play-icon {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  color: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.9);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.dubbing-hero-play:hover .dubbing-hero-play-icon {
  transform: scale(1.06);
}

.dubbing-hero-top-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
  z-index: 2;
}

.dubbing-hero-action {
  color: #fff !important;
  background: rgba(0, 0, 0, 0.45) !important;
  border-radius: var(--radius-sm);
}

.dubbing-gen-main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dubbing-gen-card {
  border: 1px solid rgba(128, 154, 188, 0.26);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  background: rgba(18, 24, 36, 0.92);
  transition: box-shadow 0.2s;
}

.dubbing-gen-card--active {
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.45);
}

.dubbing-gen-card--loading {
  border: 2px solid var(--accent-500, #22c55e);
  background: var(--gray-900, #1a1a1a);
}

.dubbing-gen-card--loading .dubbing-gen-card-title {
  color: #e5e5e5;
}

.dubbing-gen-card-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.75rem;
}

.dubbing-gen-card-body {
  margin-bottom: 0.75rem;
}

.dubbing-gen-card-actions {
  margin-top: 0.5rem;
  /* 与 EditStoryboardVideoModal 的「设置为分镜视频」按钮一致 */
  .btn-set-lipsync {
    background: none !important;
    border: 1px solid rgba(74, 231, 253, 0.3) !important;
    color: rgba(225, 239, 255, 0.92) !important;
    flex-shrink: 0;
  }
}

.btn-set-lipsync:hover,
.btn-set-lipsync:focus {
  background: rgba(74, 231, 253, 0.08) !important;
  border-color: rgba(74, 231, 253, 0.55) !important;
  color: #4ae7fd !important;
}
.btn-set-lipsync:focus {
  background: rgba(74, 231, 253, 0.08) !important;
  border-color: rgba(74, 231, 253, 0.55) !important;
  color: #4ae7fd !important;
}
.dubbing-video-hero--accent {
  border-color: var(--accent-500, #22c55e) !important;
}

.dubbing-gen-loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  gap: 1rem;
  color: #fff;
}

.dubbing-gen-loading-text {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.85);
}

.dubbing-gen-nav .nav-thumb-loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 10, 18, 0.55);
  min-height: 80px;
}


.dubbing-gen-footer-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--home-muted, #8e97a5);
  line-height: 1.5;
}

.images-container {
  display: flex;
  min-height: min(52vh, 420px);
  align-items: stretch;
}

.dubbing-video-placeholder-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--create-border-dashed, rgba(74, 168, 188, 0.38));
  background: var(--create-surface-canvas, rgba(30, 40, 58, 0.9));
  color: var(--home-muted, #8e97a5);
  text-align: center;
}

.dubbing-video-placeholder-main .anticon {
  font-size: 2.5rem;
  color: var(--accent-400, #38bdf8);
  opacity: 0.85;
}

.dubbing-video-placeholder-main p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--home-text, #e6edf3);
  line-height: 1.5;
  max-width: 22rem;
}
</style>
