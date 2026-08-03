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
              <span v-else-if="!item.configured" class="dubbing-tab-status-text"
                >未设置分镜配音</span
              >
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
          <!-- 左：生成记录（与分镜视频弹窗一致：主视频角标 + hover 设主） -->
          <aside class="stage-history-panel">
            <h4 class="panel-title">生成记录</h4>
            <div class="history-list">
              <template v-if="rightNavEntries.length === 0">
                <div class="history-empty-msg">暂无记录</div>
              </template>
              <template v-else>
                <HistoryRecordWrap
                  v-for="nav in rightNavEntries"
                  :key="nav.key"
                  :show-set-main="canSetMainFromHistory(nav)"
                  set-main-label="设置为音画同步结果"
                  :set-main-loading="isSettingFinalDubbing"
                  @set-main="handleSetMainFromHistory(nav)"
                >
                  <button
                    type="button"
                    :class="[
                      'history-item',
                      'dubbing-history-item',
                      {
                        active: selectedNavKey === nav.key,
                        'history-item--main': isHistoryDubbingMain(nav),
                        'history-item--generating': nav.type === 'loading'
                      }
                    ]"
                    @click="onRightNavClick(nav.key)"
                  >
                    <div
                      v-if="nav.type === 'loading'"
                      class="history-generating-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="history-generating-mask__icon" />
                    </div>
                    <video
                      v-else-if="nav.url"
                      :src="nav.url"
                      class="history-thumb-video"
                      muted
                      playsinline
                    />
                    <div v-else class="history-empty">—</div>
                    <span
                      v-if="isHistoryDubbingMain(nav)"
                      class="history-main-mark"
                      aria-hidden="true"
                    >
                      <img :src="dialogSelectSelIcon" alt="" class="history-main-mark__icon" />
                    </span>
                    <div
                      v-if="selectedNavKey === nav.key && canDeleteHistoryDubbing(nav)"
                      class="history-delete-icon"
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="handleDeleteHistoryDubbing(nav)"
                      @keydown.enter.stop.prevent="handleDeleteHistoryDubbing(nav)"
                    >
                      <img :src="deleteIcon" alt="删除" />
                    </div>
                  </button>
                </HistoryRecordWrap>
              </template>
            </div>
          </aside>

          <!-- 中：当前选中项的大图预览 -->
          <section class="stage-canvas-panel dubbing-stage-canvas">
            <div v-if="dubbingCanvasMode === 'empty'" class="dubbing-canvas-empty">
              <VideoCameraOutlined />
              <p>暂无分镜视频，请先在「视频生成」步骤生成或上传</p>
            </div>
            <div
              v-else-if="dubbingCanvasMode === 'loading'"
              class="dubbing-canvas-preview dubbing-canvas-preview--loading"
            >
              <div class="dubbing-gen-card-title">{{ dubbingPreviewTitle }}</div>
              <div class="dubbing-video-hero dubbing-video-hero--in-card">
                <div class="video-placeholder video-placeholder--blank" />
                <div class="video-card-generating-mask" role="status" aria-live="polite">
                  <LoadingOutlined spin class="video-card-generating-mask__icon" />
                  <span class="video-card-generating-mask__text">{{
                    lipSyncProgressHint || '正在生成中...'
                  }}</span>
                </div>
              </div>
            </div>
            <div v-else class="dubbing-canvas-preview">
              <div class="dubbing-gen-card-title">{{ dubbingPreviewTitle }}</div>
              <div class="dubbing-video-hero dubbing-video-hero--in-card">
                <ShimmerVideo
                  v-if="dubbingPreviewUrl"
                  :key="dubbingPreviewUrl"
                  ref="heroVideoComponentRef"
                  :src="dubbingPreviewUrl"
                  video-class="dubbing-hero-video"
                  object-fit="contain"
                  reveal-direction="fade"
                  @load="markHeroVideoMediaReady"
                  @ended="onHeroVideoEnded"
                  @pause="onHeroVideoPause"
                  @click.stop="toggleHeroVideoPlayback"
                />
                <button
                  v-if="dubbingPreviewUrl && !heroVideoPlaying && heroVideoMediaReady"
                  type="button"
                  class="dubbing-video-play-btn"
                  title="播放视频"
                  aria-label="播放视频"
                  @click.stop="toggleHeroVideoPlayback"
                />
                <div v-if="dubbingPreviewUrl" class="dubbing-hero-top-actions">
                  <a-button
                    type="text"
                    class="dubbing-hero-action"
                    @click.stop="handleFullscreenHeroVideo"
                  >
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
              <div
                v-if="showSetLipSyncActions"
                class="dubbing-gen-card-actions dubbing-canvas-actions"
              >
                <a-button
                  v-if="isSelectedNavLipSyncMain"
                  size="small"
                  class="btn-set-lipsync-done"
                  :loading="isSettingFinalDubbing"
                  :disabled="isSettingFinalDubbing"
                  @click="onCancelDubbingSetting"
                >
                  <CheckCircleFilled class="mr-1" />
                  取消设置
                </a-button>
                <a-button
                  v-else
                  type="primary"
                  size="small"
                  class="btn-set-lipsync"
                  :loading="isSettingFinalDubbing"
                  :disabled="isSettingFinalDubbing || selectedNavKey === navKeyLoading"
                  @click="applyLipSyncFromPreview"
                >
                  <CheckOutlined class="mr-1" />
                  设置为音画同步结果
                </a-button>
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
                    设置分镜音画同步结果
                  </a-button>
                </template>
              </div>
            </div>
          </section>

          <!-- 右：配音配置（中间内容可滚，「对口型 / 开始配音」固定底部） -->
          <aside class="stage-config-panel dubbing-stage-config">
            <div class="dubbing-config-below-tabs">
              <DubbingEditLeftPanel
                :dialogue="draftDialogue"
                :emotion="draftEmotion"
                :emotion-options="emotionLabelOptions"
                :lip-sync="draftLipSync"
                :voice-name="draftVoiceName"
                :voice-avatar-url="draftVoiceAvatarUrl"
                :tts-preview-loading="ttsPreviewLoading"
                :tts-preview-playing="ttsPreviewPlaying"
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
import { ref, computed, watch, nextTick, defineAsyncComponent } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  VideoCameraOutlined,
  CheckCircleFilled,
  InfoCircleOutlined,
  FullscreenOutlined,
  DownloadOutlined,
  CheckOutlined,
  PlusOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'
import HorizontalScrollTabBar from '~/components/common/HorizontalScrollTabBar.vue'
import HistoryRecordWrap from '~/components/common/HistoryRecordWrap.vue'
import ShimmerVideo from '~/components/common/ShimmerVideo.vue'
import { useVideoPlaybackSpaceShortcut } from '~/composables/useVideoPlaybackSpaceShortcut'
import DubbingEditLeftPanel from './DubbingEditLeftPanel.vue'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import deleteIcon from '@/assets/img/icon/del-black.svg'
import type { DubbingPanel, StoryboardVideoPanel, StoryboardPanel } from '~/types'
import {
  runStoryboardDubbingGenerateTask,
  type StoryboardDubbingGenerateParams,
  type StoryboardDubbingGenerateProgress,
  type StoryboardDubbingComposeJob
} from '~/composables/useStoryboardDubbingGenerate'
import {
  userVoicePreview,
  userVoiceLibraryTags,
  userVoiceLibraryList,
  userStoryboardSetFinal,
  userStoryboardUnSetFinalVideo,
  userStoryboardRecordDelete
} from '~/utils/businessApi'
import { useAuthPublicConfig } from '~/composables/useAuthPublicConfig'
import { resolveVoicePreviewPlayUrl } from '~/utils/voicePreviewPlayUrl'
import {
  fetchProjectStoryboardRecords,
  fetchStoryboardRecordsForStoryboard,
  groupStoryboardRecordsByStoryboardId,
  clearProjectStoryboardRecordCache
} from '~/utils/storyboardRecordBatch'
import { useStoryboardModalHeaderTabs } from '~/composables/useStoryboardModalHeaderTabs'
import {
  isComposeStoryboardVideoRecord,
  resolveStoryboardRecordDisplayName
} from '~/utils/storyboardRecordRow'
import {
  isSameDubbingGenHistory,
  mergeComposeRecordsIntoDubbingGenHistory,
  type DubbingGenHistoryItem
} from '~/utils/storyboardDubbingGenHistory'
import { resolveDubbingPreviewNavKey } from '~/utils/resolveDubbingPreviewNavKey'
import { notifyEpisodeTimelineRebuildRequested } from '~/utils/episodeTimelineRebuildSignal'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { useCreationStore } from '~/stores/creation'
import { findStoryboardDubbingGenTaskInScopes } from '~/composables/useCreationStoreHydration'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import {
  modalGenSessionScopeFromScopeKey,
  modalGenSessionScopeFromStore
} from '~/utils/modalGenSessionScope'
import {
  clearStoryboardDubbingModalGenSession,
  clearStoryboardDubbingModalUserDismissed,
  markStoryboardDubbingModalUserDismissed,
  persistStoryboardDubbingModalGenSession,
  readStoryboardDubbingModalGenSession,
  notifyStoryboardDubbingGenSettled
} from '~/utils/storyboardDubbingModalGenSession'
import {
  resolveOngoingComposeDubbingJob,
  resolveComposeJobFromDubbingSnapshots
} from '~/utils/modalGenTaskRestore'
import {
  isStoryboardDubbingGenFollowActive,
  listActiveStoryboardDubbingGenFollowIds,
  releaseStoryboardDubbingGenFollow,
  runStoryboardDubbingGenFollowOnce
} from '~/composables/useStoryboardDubbingGenFollowLock'
import { suspendTaskSseFollow } from '~/composables/useTaskSseFollow'
import { listModalTabFollowsToSuspend } from '~/utils/modalTabSseMutex'
import type { StoryboardRecordRow } from '~/types/business-api'
import { htmlToPlainText } from '~/utils/htmlPlain'
import { getPanelStoryboardVideoUrl } from '~/utils/storyboardVideoCover'

/** 音色选择弹窗异步拆分：不阻塞配音编辑弹窗本体首帧渲染 */
const VoiceTimbrePickerModal = defineAsyncComponent(() => import('./VoiceTimbrePickerModal.vue'))

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

function storyboardDubbingModalSessionScope() {
  return modalGenSessionScopeFromStore(creationStore)
}

/** 提交响应晚于项目切换时，挂起迟到建立的 SSE，切回原 scope 后再恢复。 */
function suspendLateModalDubbingFollowIfScopeChanged(
  taskId: number,
  taskScope: ReturnType<typeof captureCreationLiveGenScope>
) {
  if (!import.meta.client || !Number.isFinite(taskId) || taskId <= 0) return
  queueMicrotask(() => {
    if (!matchesCreationLiveGenScope(taskScope)) suspendTaskSseFollow(taskId)
  })
}

const videoPanels = computed(() => props.storyboardVideoPanels || [])
const scriptPanels = computed(() => props.storyboardScriptPanels || [])

function resolveStoryboardIdForIndex(i: number): number | null {
  const raw = scriptPanels.value[i]?.id ?? videoPanels.value[i]?.id
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

const { headerTabs, projectRecordRows, refreshHeaderTabs } = useStoryboardModalHeaderTabs({
  open: () => props.open,
  recordType: 'compose',
  scenes: () =>
    props.dubbingPanels.map((panel, index) => ({
      name: panel.title || (props.storyboardScriptPanels || [])[index]?.title || `分镜${index + 1}`,
      storyboardId: resolveStoryboardIdForIndex(index) ?? undefined
    })),
  creationStore,
  route,
  headerOptions: () => ({
    resolveFallbackThumbnailUrl: (sceneIndex) => getVideoUrl(sceneIndex),
    resolveDubbingConfigured: (sceneIndex, composeRows) => {
      const panel = props.dubbingPanels[sceneIndex]
      if (isPanelDubbingConfigured(panel)) return true
      return composeRows.some(
        (r) =>
          isComposeStoryboardVideoRecord(r) &&
          r.isSelected === 1 &&
          !!String(r.fileUrl ?? '').trim()
      )
    }
  })
})

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
const heroVideoComponentRef = ref<InstanceType<typeof ShimmerVideo> | null>(null)
const heroVideoPlaying = ref(false)
const heroVideoMediaReady = ref(false)
const leftPanelLoading = ref(false)
const rightPanelLoading = ref(false)
const TAB_SWITCH_SKELETON_MS = 260

/** 与「添加场景图」一致：开始配音后待确认 */
const pendingDubbingByIndex = ref<Record<number, boolean>>({})
const pendingPayloadByIndex = ref<
  Record<number, { mode: 'tts' | 'upload'; localFile: File | null }>
>({})
/** 本会话内点击「设置分镜音画同步结果」后，可用「取消设置」恢复到此快照前（对齐「取消添加」） */
const preConfirmPanelByIndex = ref<Record<number, DubbingPanel>>({})
const confirmedDubbingThisSession = ref<Set<number>>(new Set())

const navKeySource = '__source__'
const navKeyLoading = '__loading__'

type DubbingGenItem = DubbingGenHistoryItem

const genHistoryByIndex = ref<Record<number, DubbingGenItem[]>>({})
/** 按分镜 panel.id 记录 loading，避免切换 Tab 后下标串流 */
const genLoadingByPanelKey = ref<Record<string, boolean>>({})
const selectedNavKeyByIndex = ref<Record<number, string>>({})
const generatingMetaByIndex = ref<
  Record<number, { voice: string; emotion: string; timeLabel: string }>
>({})
/** 对口型 SSE 配音阶段试听（按场景） */
const lipSyncProgressHintByIndex = ref<Record<number, string>>({})

let resumeDubbingFollowGen = 0
const serverVideoRecordsInflightByIndex = new Map<number, Promise<void>>()

function primeDubbingLoadingFromStore() {
  props.dubbingPanels.forEach((_, idx) => {
    const sid = resolveStoryboardIdForIndex(idx)
    if (!sid) return
    const task = findStoryboardDubbingGenTaskInScopes(creationStore, sid, route)
    if (!task) return
    const panelKey = resolveDubbingPanelKey(idx)
    genLoadingByPanelKey.value = { ...genLoadingByPanelKey.value, [panelKey]: true }
    if (idx === currentSceneIndex.value) {
      selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [idx]: navKeyLoading }
    }
  })
}

/** Pinia 任务终态 / 后台 follow 结束后，同步清弹窗内 loading 并切到最新生成结果 */
function clearDubbingLoadingUiForScene(sceneIdx: number) {
  const panelKey = resolveDubbingPanelKey(sceneIdx)
  const hadLoading = !!genLoadingByPanelKey.value[panelKey]
  const gl = { ...genLoadingByPanelKey.value }
  delete gl[panelKey]
  genLoadingByPanelKey.value = gl

  const gm = { ...generatingMetaByIndex.value }
  delete gm[sceneIdx]
  generatingMetaByIndex.value = gm

  if (!hadLoading || selectedNavKeyByIndex.value[sceneIdx] !== navKeyLoading) return

  const hist = genHistoryByIndex.value[sceneIdx] || []
  const latest = hist[hist.length - 1]
  const panel = props.dubbingPanels[sceneIdx]
  const lipKey = panel?.dubbingLipSyncKey
  const nextKey =
    latest?.id || (lipKey != null && String(lipKey).trim() !== '' ? lipKey : null) || navKeySource
  selectedNavKeyByIndex.value = {
    ...selectedNavKeyByIndex.value,
    [sceneIdx]: nextKey
  }
}

function syncDubbingLoadingUiFromStore() {
  if (!props.open) return
  props.dubbingPanels.forEach((_, idx) => {
    const sid = resolveStoryboardIdForIndex(idx)
    if (!sid) return
    const panelKey = resolveDubbingPanelKey(idx)
    if (!genLoadingByPanelKey.value[panelKey]) return

    const persisted = findStoryboardDubbingGenTaskInScopes(creationStore, sid, route)
    const stillFollowing = isStoryboardDubbingGenFollowActive(
      sid,
      creationStore.step3GenVisualScopeKey()
    )
    if (!persisted && !stillFollowing) {
      clearDubbingLoadingUiForScene(idx)
    }
  })
}

function buildDubbingGenerateParams(sceneIdx: number): StoryboardDubbingGenerateParams | null {
  const storyboardId = resolveStoryboardIdForIndex(sceneIdx)
  const vp = props.storyboardVideoPanels || []
  const vPanel = vp[sceneIdx]
  const src = getPanelStoryboardVideoUrl(vPanel) || getVideoUrl(sceneIdx)
  if (!storyboardId || !src) return null

  const draft = draftByIndex.value[sceneIdx]
  const dialogue =
    sceneIdx === currentSceneIndex.value
      ? draftDialogue.value.trim()
      : String(draft?.dialogue ?? '').trim()
  const voiceName =
    sceneIdx === currentSceneIndex.value ? draftVoiceName.value : String(draft?.voiceName ?? '')
  const emotion =
    sceneIdx === currentSceneIndex.value ? draftEmotion.value : String(draft?.emotion ?? '中性')
  const lipSync =
    sceneIdx === currentSceneIndex.value ? draftLipSync.value : Boolean(draft?.lipSync)
  const voiceLibraryId =
    sceneIdx === currentSceneIndex.value
      ? draftVoiceLibraryId.value > 0
        ? draftVoiceLibraryId.value
        : undefined
      : draft?.voiceLibraryId
  const voiceModelId =
    sceneIdx === currentSceneIndex.value
      ? draftVoiceModelId.value > 0
        ? draftVoiceModelId.value
        : undefined
      : draft?.voiceModelId
  const timbreCode =
    sceneIdx === currentSceneIndex.value
      ? draftTimbreCode.value.trim() || undefined
      : draft?.timbreCode

  return {
    storyboardId,
    dialogue,
    voiceName,
    voiceLibraryId,
    voiceModelId,
    timbreCode,
    emotion,
    lipSync,
    sourceVideoUrl: src
  }
}

async function runDubbingGenerateForScene(
  sceneIdx: number,
  opts?: { resumeComposeJob?: StoryboardDubbingComposeJob; silentComplete?: boolean }
) {
  const storyboardId = resolveStoryboardIdForIndex(sceneIdx)
  if (!storyboardId) return

  const followScope = captureCreationLiveGenScope()
  return runStoryboardDubbingGenFollowOnce(
    storyboardId,
    async () => {
      const params = buildDubbingGenerateParams(sceneIdx)
      const lipSync = opts?.resumeComposeJob?.lipSync ?? params?.lipSync ?? false
      if (!opts?.resumeComposeJob && !params) return

      const effectiveParams: StoryboardDubbingGenerateParams =
        params ??
        ({
          storyboardId,
          dialogue: '',
          voiceName: '',
          emotion: '中性',
          lipSync,
          sourceVideoUrl: opts?.resumeComposeJob?.sourceVideoUrl || getVideoUrl(sceneIdx) || ''
        } satisfies StoryboardDubbingGenerateParams)

      const panelKey = resolveDubbingPanelKey(sceneIdx)
      /** 剧集隔离：任务归属启动时 scope；快照读写用 scopeKey，终态 UI/toast 用 liveScope 校验 */
      const liveScope = followScope
      const scopeKey = liveScope.scopeKey
      const taskSessionScope = modalGenSessionScopeFromScopeKey(scopeKey)

      persistStoryboardDubbingModalGenSession(
        storyboardId,
        sceneIdx,
        scopeKey,
        opts?.resumeComposeJob
          ? {
              composeBatchId: opts.resumeComposeJob.composeBatchId,
              audioRecordId: opts.resumeComposeJob.audioRecordId,
              taskId: opts.resumeComposeJob.taskId,
              lipSync: opts.resumeComposeJob.lipSync
            }
          : { lipSync: effectiveParams.lipSync },
        taskSessionScope
      )

      if (!opts?.resumeComposeJob) {
        generatingMetaByIndex.value = {
          ...generatingMetaByIndex.value,
          [sceneIdx]: {
            voice: effectiveParams.voiceName,
            emotion: effectiveParams.emotion,
            timeLabel: formatDubTime()
          }
        }
      }

      genLoadingByPanelKey.value = { ...genLoadingByPanelKey.value, [panelKey]: true }
      if (sceneIdx === currentSceneIndex.value) {
        selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [sceneIdx]: navKeyLoading }
        scrollToGenAnchor(navKeyLoading)
      }

      const onProgress = (p: StoryboardDubbingGenerateProgress) => {
        const composeBatchId = String(
          p.composeBatchId || opts?.resumeComposeJob?.composeBatchId || ''
        ).trim()
        const audioRecordId = Number(p.audioRecordId ?? opts?.resumeComposeJob?.audioRecordId)
        const taskId = Number(p.taskId ?? opts?.resumeComposeJob?.taskId)
        const lipSync = effectiveParams.lipSync
        const hasTask = Number.isFinite(taskId) && taskId > 0
        const hasAudio = Number.isFinite(audioRecordId) && audioRecordId > 0
        if (lipSync) {
          if (!hasTask) return
        } else if (!composeBatchId || !hasAudio) {
          return
        }
        const hint = String(p.message || p.stepTitle || '').trim()
        if (hint) {
          lipSyncProgressHintByIndex.value = {
            ...lipSyncProgressHintByIndex.value,
            [sceneIdx]: hint
          }
        }
        creationStore.setStoryboardDubbingGenTask(
          storyboardId,
          {
            composeBatchId,
            ...(hasAudio ? { audioRecordId } : {}),
            ...(hasTask ? { taskId } : {}),
            sceneIdx,
            lipSync,
            message: p.message,
            stepTitle: p.stepTitle
          },
          scopeKey
        )
        persistStoryboardDubbingModalGenSession(
          storyboardId,
          sceneIdx,
          scopeKey,
          {
            composeBatchId,
            ...(hasAudio ? { audioRecordId } : {}),
            ...(hasTask ? { taskId } : {}),
            lipSync
          },
          taskSessionScope
        )
      }

      let preserveTaskOnExit = false
      try {
        const result = await runStoryboardDubbingGenerateTask({
          params: effectiveParams,
          resumeComposeJob: opts?.resumeComposeJob,
          onProgress,
          onSubmitted: ({ composeBatchId, audioRecordId, taskId }) => {
            const tid = Number(taskId)
            const aid = Number(audioRecordId)
            creationStore.setStoryboardDubbingGenTask(
              storyboardId,
              {
                composeBatchId,
                ...(Number.isFinite(aid) && aid > 0 ? { audioRecordId: aid } : {}),
                ...(Number.isFinite(tid) && tid > 0 ? { taskId: tid } : {}),
                sceneIdx,
                lipSync: effectiveParams.lipSync
              },
              scopeKey
            )
            persistStoryboardDubbingModalGenSession(
              storyboardId,
              sceneIdx,
              scopeKey,
              {
                composeBatchId,
                ...(Number.isFinite(aid) && aid > 0 ? { audioRecordId: aid } : {}),
                ...(Number.isFinite(tid) && tid > 0 ? { taskId: tid } : {}),
                lipSync: effectiveParams.lipSync
              },
              taskSessionScope
            )
            suspendLateModalDubbingFollowIfScopeChanged(tid, liveScope)
          }
        })

        /** 剧集隔离：已切集则不 toast、不回写当前集数据；finally 仍按 scopeKey 清理任务所属桶 */
        if (!matchesCreationLiveGenScope(liveScope)) {
          preserveTaskOnExit = true
          return
        }

        if (result.ok === false) {
          if (result.deferred) {
            preserveTaskOnExit = true
            return
          }
          if (!opts?.silentComplete) {
            message.error(result.errorMessage || '配音生成失败，请重试')
          }
          if (sceneIdx === currentSceneIndex.value) {
            selectedNavKeyByIndex.value = {
              ...selectedNavKeyByIndex.value,
              [sceneIdx]: navKeySource
            }
          }
          return
        }

        const recordId = Number(result.lipSyncVideoRecordId)
        const item: DubbingGenItem = {
          id:
            Number.isFinite(recordId) && recordId > 0
              ? `compose-${recordId}`
              : `dub-gen-${Date.now()}-${sceneIdx}`,
          url: result.videoUrl,
          title: `文本朗读 | 配音 ${effectiveParams.voiceName} ${effectiveParams.emotion} ${formatDubTime()}`,
          dialogue: effectiveParams.dialogue,
          voiceName: effectiveParams.voiceName,
          emotion: effectiveParams.emotion
        }
        genHistoryByIndex.value = {
          ...genHistoryByIndex.value,
          [sceneIdx]: [...(genHistoryByIndex.value[sceneIdx] || []), item]
        }
        const ctx = await resolveStoryScriptSaveContext(creationStore, route)
        if (ctx) {
          clearProjectStoryboardRecordCache(ctx)
          void refreshHeaderTabs(true)
          await refreshServerVideoRecords(sceneIdx, { force: true })
        }
        if (sceneIdx === currentSceneIndex.value) {
          const hist = genHistoryByIndex.value[sceneIdx] || []
          const synced =
            hist.find((h) => h.url === item.url) || hist.find((h) => h.id === item.id) || item
          selectedNavKeyByIndex.value = {
            ...selectedNavKeyByIndex.value,
            [sceneIdx]: synced.id
          }
          scrollToGenAnchor(synced.id)
          if (!opts?.silentComplete) {
            message.success(
              effectiveParams.lipSync
                ? '对口型视频已生成，请点击「设置为音画同步结果」确认使用'
                : '配音视频已生成，请点击「设置为音画同步结果」确认使用'
            )
          }
        }
      } finally {
        if (!preserveTaskOnExit) {
          const nextHint = { ...lipSyncProgressHintByIndex.value }
          delete nextHint[sceneIdx]
          lipSyncProgressHintByIndex.value = nextHint
          creationStore.clearStoryboardDubbingGenTask(storyboardId, scopeKey)
          clearStoryboardDubbingModalGenSession(taskSessionScope)
          clearDubbingLoadingUiForScene(sceneIdx)
        }
        notifyStoryboardDubbingGenSettled(storyboardId, scopeKey)
      }
    },
    followScope.scopeKey
  )
}

async function restoreStoryboardDubbingGenerateIfNeeded(sceneIdx: number) {
  if (!props.open) return
  const storyboardId = resolveStoryboardIdForIndex(sceneIdx)
  if (!storyboardId) return

  const persisted = findStoryboardDubbingGenTaskInScopes(creationStore, storyboardId, route)
  const sessionScope = storyboardDubbingModalSessionScope()
  const session = readStoryboardDubbingModalGenSession(sessionScope)
  const composeJob = resolveComposeJobFromDubbingSnapshots(persisted, session, storyboardId)
  if (!composeJob) {
    creationStore.clearStoryboardDubbingGenTask(storyboardId)
    return
  }
  if (isStoryboardDubbingGenFollowActive(storyboardId, creationStore.step3GenVisualScopeKey())) {
    return
  }

  const panelKey = resolveDubbingPanelKey(sceneIdx)
  genLoadingByPanelKey.value = { ...genLoadingByPanelKey.value, [panelKey]: true }
  if (sceneIdx === currentSceneIndex.value) {
    selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [sceneIdx]: navKeyLoading }
  }

  const gen = ++resumeDubbingFollowGen
  const ongoingJob = await resolveOngoingComposeDubbingJob(composeJob)
  if (gen !== resumeDubbingFollowGen) return

  if (!ongoingJob) {
    creationStore.clearStoryboardDubbingGenTask(storyboardId)
    clearStoryboardDubbingModalGenSession(sessionScope)
    clearDubbingLoadingUiForScene(sceneIdx)
    notifyStoryboardDubbingGenSettled(storyboardId, creationStore.step3GenVisualScopeKey())
    return
  }

  const params = buildDubbingGenerateParams(sceneIdx)
  await runDubbingGenerateForScene(sceneIdx, {
    resumeComposeJob: {
      composeBatchId: ongoingJob.composeBatchId,
      audioRecordId: ongoingJob.audioRecordId,
      taskId: ongoingJob.taskId,
      lipSync: composeJob.lipSync ?? params?.lipSync ?? false,
      sourceVideoUrl: params?.sourceVideoUrl || getVideoUrl(sceneIdx) || ''
    },
    silentComplete: true
  })
}

const genHistoryForScene = computed(() => genHistoryByIndex.value[currentSceneIndex.value] || [])
const genLoadingForScene = computed(
  () => !!genLoadingByPanelKey.value[resolveDubbingPanelKey(currentSceneIndex.value)]
)

const lipSyncProgressHint = computed(() =>
  String(lipSyncProgressHintByIndex.value[currentSceneIndex.value] || '').trim()
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

/** 当前分镜已设为音画同步结果的条目 key：__source__ 表示原分镜视频，否则为生成项 id，用于仅一条显示「取消设置」 */
const currentPanelLipSyncKey = computed(() => {
  const i = currentSceneIndex.value
  const p = props.dubbingPanels[i]
  const key = p?.dubbingLipSyncKey
  if (key != null && String(key).trim() !== '') {
    const k = String(key).trim()
    return k === '__source__' ? navKeySource : k
  }
  const url = p?.dubbingLipSyncVideoUrl
  if (url && String(url).trim()) {
    if (currentVideoUrl.value === url) return navKeySource
    const gen = genHistoryForScene.value.find((item) => item.url === url)
    if (gen) return gen.id
  }
  // 服务端配音轨 isSelected=1 的 compose 即「使用中的音画同步结果」
  const serverList = serverVideoRecordsByIndex.value[i] || []
  const activeCompose = serverList.find(
    (r) => isComposeStoryboardVideoRecord(r._serverRow) && r._serverRow?.isSelected === 1
  )
  if (activeCompose?.url) {
    const hit = genHistoryForScene.value.find((item) => item.url === activeCompose.url)
    if (hit) return hit.id
    const rid = Number(activeCompose.id || activeCompose._serverRow?.id)
    if (Number.isFinite(rid) && rid > 0) return `compose-${rid}`
  }
  return null
})

const isSettingFinalDubbing = ref(false)

/** 从生成历史项解析 compose 生成记录 id（setFinal / unSetFinalVideo 入参） */
function resolveComposeRecordIdFromGenItem(
  item: DubbingGenItem | null | undefined,
  sceneIdx: number
): number | null {
  if (!item) return null
  const idStr = String(item.id || '').trim()
  const fromCompose = /^compose-(\d+)$/.exec(idStr)
  if (fromCompose) {
    const n = Number(fromCompose[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  // 批量配音历史 id：batch-{dubbedVideoRecordId}-{index}
  const fromBatch = /^batch-(\d+)(?:-|$)/.exec(idStr)
  if (fromBatch) {
    const n = Number(fromBatch[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  const plain = Number(idStr)
  if (Number.isFinite(plain) && plain > 0 && !idStr.includes('-')) return plain

  const url = String(item.url || '').trim()
  if (!url) return null
  const serverList = serverVideoRecordsByIndex.value[sceneIdx] || []
  const hit = serverList.find(
    (r) => isComposeStoryboardVideoRecord(r._serverRow) && String(r.url || '').trim() === url
  )
  const rid = Number(hit?.id || hit?._serverRow?.id)
  return Number.isFinite(rid) && rid > 0 ? rid : null
}

type DubbingNavEntry = { key: string; type: 'source' | 'gen' | 'loading'; url?: string }

function resolveNavEntryUrl(nav: DubbingNavEntry | null | undefined): string {
  if (!nav) return ''
  if (nav.url) return String(nav.url).trim()
  if (nav.key === navKeySource) return String(currentVideoUrl.value || '').trim()
  const item = genHistoryForScene.value.find((x) => x.id === nav.key)
  return String(item?.url || '').trim()
}

/** 当前选中预览项是否已是音画同步结果（按 key 或同 URL 判定） */
function isNavLipSyncMain(navKey: string): boolean {
  const main = currentPanelLipSyncKey.value
  if (!main) return false
  if (main === navKey) return true
  const mainEntry = rightNavEntries.value.find((e) => e.key === main)
  const navEntry = rightNavEntries.value.find((e) => e.key === navKey)
  const mainUrl =
    resolveNavEntryUrl(mainEntry) ||
    String(props.dubbingPanels[currentSceneIndex.value]?.dubbingLipSyncVideoUrl || '').trim()
  const navUrl = resolveNavEntryUrl(navEntry)
  return !!(mainUrl && navUrl && mainUrl === navUrl)
}

function isHistoryDubbingMain(nav: DubbingNavEntry): boolean {
  if (nav.type === 'loading') return false
  return isNavLipSyncMain(nav.key)
}

function canSetMainFromHistory(nav: DubbingNavEntry): boolean {
  if (nav.type !== 'gen') return false
  if (!String(nav.url || '').trim()) return false
  return !isHistoryDubbingMain(nav)
}

async function handleSetMainFromHistory(nav: DubbingNavEntry) {
  if (!canSetMainFromHistory(nav) || isSettingFinalDubbing.value) return
  onRightNavClick(nav.key)
  await nextTick()
  await applyLipSyncFromPreview()
}

const isDeletingDubbingRecord = ref(false)

function canDeleteHistoryDubbing(nav: DubbingNavEntry): boolean {
  if (nav.type !== 'gen' || isDeletingDubbingRecord.value) return false
  const item = genHistoryForScene.value.find((x) => x.id === nav.key)
  if (!item) return false
  if (resolveComposeRecordIdFromGenItem(item, currentSceneIndex.value)) return true
  return !!String(item.url || '').trim()
}

function removeLocalDubbingHistoryItem(sceneIdx: number, itemId: string) {
  const prev = genHistoryByIndex.value[sceneIdx] || []
  const deleted = prev.find((h) => h.id === itemId)
  const next = prev.filter((h) => h.id !== itemId)
  genHistoryByIndex.value = { ...genHistoryByIndex.value, [sceneIdx]: next }

  const panel = props.dubbingPanels[sceneIdx]
  const clearLip =
    !!panel &&
    (String(panel.dubbingLipSyncKey || '') === itemId ||
      (!!deleted?.url && String(panel.dubbingLipSyncVideoUrl || '') === deleted.url))

  emit(
    'update:panels',
    props.dubbingPanels.map((p, idx) => {
      if (idx !== sceneIdx) return p
      const base = { ...p, dubbingGenHistory: next }
      if (!clearLip) return base
      return {
        ...base,
        dubbingLipSyncVideoUrl: undefined,
        dubbingLipSyncKey: undefined,
        storyboardDubbingConfirmed: false,
        status: (base.dialogue && String(base.dialogue).trim() ? 'done' : 'pending') as
          | 'done'
          | 'pending'
      }
    })
  )
  if (clearLip) {
    const ns = new Set(confirmedDubbingThisSession.value)
    ns.delete(sceneIdx)
    confirmedDubbingThisSession.value = ns
    const pre = { ...preConfirmPanelByIndex.value }
    delete pre[sceneIdx]
    preConfirmPanelByIndex.value = pre
  }
  reconcileSelectedNavKeyForScene(sceneIdx)
}

function handleDeleteHistoryDubbing(nav: DubbingNavEntry) {
  if (!canDeleteHistoryDubbing(nav)) {
    message.warning('当前记录无法删除')
    return
  }
  const sceneIdx = currentSceneIndex.value
  const item = genHistoryForScene.value.find((x) => x.id === nav.key)
  if (!item) return

  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这条生成记录吗？删除后不可恢复。',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      const recordId = resolveComposeRecordIdFromGenItem(item, sceneIdx)
      const storyboardId = resolveStoryboardIdForIndex(sceneIdx)

      if (recordId && storyboardId) {
        isDeletingDubbingRecord.value = true
        try {
          const ctx = await resolveStoryScriptSaveContext(creationStore, route)
          await userStoryboardRecordDelete({ storyboardId, recordId })
          if (ctx) clearProjectStoryboardRecordCache(ctx)
          removeLocalDubbingHistoryItem(sceneIdx, item.id)
          await refreshServerVideoRecords(sceneIdx, { force: true })
          void refreshHeaderTabs(true)
          message.success('删除成功')
        } catch (e: unknown) {
          const err = e as { msg?: string; message?: string }
          message.error(err?.msg || err?.message || '删除失败')
          throw e
        } finally {
          isDeletingDubbingRecord.value = false
        }
        return
      }

      removeLocalDubbingHistoryItem(sceneIdx, item.id)
      message.success('已删除')
    }
  })
}

const isSelectedNavLipSyncMain = computed(() => {
  const k = selectedNavKey.value
  if (!k || k === navKeyLoading) return false
  return isNavLipSyncMain(k)
})

function resolveActiveComposeRecordId(sceneIdx: number): number | null {
  const serverList = serverVideoRecordsByIndex.value[sceneIdx] || []
  const active = serverList.find(
    (r) => isComposeStoryboardVideoRecord(r._serverRow) && r._serverRow?.isSelected === 1
  )
  const rid = Number(active?.id || active?._serverRow?.id)
  if (Number.isFinite(rid) && rid > 0) return rid

  const p = props.dubbingPanels[sceneIdx]
  const key = String(p?.dubbingLipSyncKey || '').trim()
  const fromKey = /^compose-(\d+)$/.exec(key)
  if (fromKey) {
    const n = Number(fromKey[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  if (key && key !== navKeySource && key !== '__source__') {
    const hist = genHistoryByIndex.value[sceneIdx] || []
    return resolveComposeRecordIdFromGenItem(
      hist.find((h) => h.id === key),
      sceneIdx
    )
  }
  const url = String(p?.dubbingLipSyncVideoUrl || '').trim()
  if (!url) return null
  return resolveComposeRecordIdFromGenItem(
    (genHistoryByIndex.value[sceneIdx] || []).find((h) => h.url === url),
    sceneIdx
  )
}

function patchDubbingPanelAsLipSync(
  sceneIdx: number,
  patch: Partial<DubbingPanel>,
  snapshot = true
) {
  const panel = props.dubbingPanels[sceneIdx]
  if (!panel) return
  if (snapshot) {
    preConfirmPanelByIndex.value = {
      ...preConfirmPanelByIndex.value,
      [sceneIdx]: JSON.parse(JSON.stringify(panel)) as DubbingPanel
    }
  }
  const history = genHistoryByIndex.value[sceneIdx] || panel.dubbingGenHistory || []
  const next = props.dubbingPanels.map((p, idx) =>
    idx !== sceneIdx
      ? p
      : {
          ...p,
          ...patch,
          dubbingGenHistory: history,
          status: 'done' as const,
          storyboardDubbingConfirmed: true as const
        }
  )
  emit('update:panels', next)
  confirmedDubbingThisSession.value = new Set([...confirmedDubbingThisSession.value, sceneIdx])
}

function clearDubbingLipSyncLocal(sceneIdx: number) {
  const next = props.dubbingPanels.map((x, idx) =>
    idx === sceneIdx
      ? {
          ...x,
          dubbingLipSyncVideoUrl: undefined,
          dubbingLipSyncKey: undefined,
          storyboardDubbingConfirmed: false,
          status: (x.dialogue && String(x.dialogue).trim() ? 'done' : 'pending') as
            | 'done'
            | 'pending'
        }
      : x
  )
  emit('update:panels', next)
  const ns = new Set(confirmedDubbingThisSession.value)
  ns.delete(sceneIdx)
  confirmedDubbingThisSession.value = ns
  const pre = { ...preConfirmPanelByIndex.value }
  delete pre[sceneIdx]
  preConfirmPanelByIndex.value = pre
}

async function onStartDubbingPrepare(payload: { mode: 'tts' | 'upload'; localFile: File | null }) {
  persistCurrentDraft()
  const i = currentSceneIndex.value
  if (payload.mode === 'upload') {
    pendingDubbingByIndex.value = { ...pendingDubbingByIndex.value, [i]: true }
    pendingPayloadByIndex.value = { ...pendingPayloadByIndex.value, [i]: payload }
    message.info('可在右侧点击「设置分镜音画同步结果」确认提交')
    return
  }
  const plain = htmlToPlainText(draftDialogue.value).trim()
  if (!plain) {
    message.warning('请输入配音台词')
    return
  }
  if (draftVoiceLibraryId.value <= 0 && draftVoiceModelId.value <= 0) {
    message.warning('请选择音色')
    return
  }
  // MiniMax 前端预检（最终以后端为准）
  {
    const { checkMiniMaxTtsTextLength } = await import('~/utils/ttsTextLimit')
    const hints: Array<string | null | undefined> = [
      draftTimbreCode.value,
      draftVoiceName.value,
      draftVoiceProviderHint.value
    ]
    if (draftVoiceModelId.value > 0) {
      try {
        const { userModelList } = await import('~/utils/businessApi')
        const models = await userModelList({ modelType: 'audio' })
        const hit = models.find((m) => Number(m.id) === Number(draftVoiceModelId.value))
        if (hit) hints.push(hit.providerName, hit.modelCode, hit.modelName)
      } catch {
        /* ignore */
      }
    }
    const tooLong = checkMiniMaxTtsTextLength(plain, hints)
    if (tooLong) {
      message.warning(tooLong)
      return
    }
  }
  const vp = props.storyboardVideoPanels || []
  const vPanel = vp[i]
  const src = getPanelStoryboardVideoUrl(vPanel) || getVideoUrl(i)
  if (!src) {
    message.warning('暂无分镜视频，请先在「视频生成」步骤生成或选定视频')
    return
  }
  await runDubbingGenerateForScene(i)
}

async function confirmSetLipSync() {
  const i = currentSceneIndex.value
  const panel = props.dubbingPanels[i]
  if (!panel) return

  const payload = pendingPayloadByIndex.value[i]
  if (!payload || payload.mode !== 'upload') {
    message.warning('请使用文本朗读生成后，在卡片上点击「设置为音画同步结果」')
    return
  }

  let dubbingUploadedAudioUrl: string | undefined
  if (payload.localFile) {
    const { uploadAudioToOssWithToast } = await import('~/utils/ossUpload')
    const url = await uploadAudioToOssWithToast(payload.localFile)
    if (!url) return
    // /storyboard/upload 新版仅支持 image/video 落库；配音音频只走 OSS，URL 直接用于对口型
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

async function applyLipSyncFromPreview() {
  const k = selectedNavKey.value
  if (!k || k === navKeyLoading || k === navKeySource) return
  const item = genHistoryForScene.value.find((x) => x.id === k)
  if (item) await applyGeneratedLipSync(item)
}

/** 设配音轨 compose 为使用中：POST /api/user/storyboard/setFinal（recordType=video） */
async function applyGeneratedLipSync(item: DubbingGenItem, opts?: { silent?: boolean }) {
  const i = currentSceneIndex.value
  const panel = props.dubbingPanels[i]
  if (!panel) return

  const storyboardId = resolveStoryboardIdForIndex(i)
  if (!storyboardId) {
    if (!opts?.silent) message.warning('分镜信息异常，请刷新后重试')
    return
  }

  if (!String(item.url || '').trim()) {
    if (!opts?.silent) message.warning('产物未完成')
    return
  }

  if (isSettingFinalDubbing.value && !opts?.silent) return

  const run = async () => {
    let recordId = resolveComposeRecordIdFromGenItem(item, i)
    if (recordId == null) {
      await refreshServerVideoRecords(i, { force: true })
      const hist = genHistoryByIndex.value[i] || []
      const refreshed =
        hist.find((h) => h.id === item.id) || hist.find((h) => h.url === item.url) || item
      recordId = resolveComposeRecordIdFromGenItem(refreshed, i)
    }
    if (recordId == null) {
      if (opts?.silent) {
        // 合成刚完成、记录尚未可查时，仅同步本地展示；不假装已 setFinal
        patchDubbingPanelAsLipSync(i, {
          dialogue: item.dialogue,
          dubbingVoiceName: item.voiceName,
          dubbingEmotion: item.emotion,
          dubbingLipSync: draftLipSync.value,
          dubbingVoiceAvatarUrl: draftVoiceAvatarUrl.value || undefined,
          dubbingLipSyncVideoUrl: item.url,
          dubbingLipSyncKey: item.id
        })
        return
      }
      message.warning('未找到配音视频记录，请稍后重试')
      return
    }

    await userStoryboardSetFinal({
      storyboardId,
      recordId,
      recordType: 'video'
    })
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (ctx) clearProjectStoryboardRecordCache(ctx)
    void refreshHeaderTabs(true)

    const keepKey = selectedNavKeyByIndex.value[i] || item.id
    await refreshServerVideoRecords(i, { force: true })

    const hist = genHistoryByIndex.value[i] || []
    const synced =
      hist.find((h) => h.id === `compose-${recordId}`) ||
      hist.find((h) => h.url === item.url) ||
      item
    const nextKey = synced.id.startsWith('compose-') ? synced.id : `compose-${recordId}`
    patchDubbingPanelAsLipSync(i, {
      dialogue: synced.dialogue || item.dialogue,
      dubbingVoiceName: synced.voiceName || item.voiceName,
      dubbingEmotion: synced.emotion || item.emotion,
      dubbingLipSync: draftLipSync.value,
      dubbingVoiceAvatarUrl: draftVoiceAvatarUrl.value || undefined,
      dubbingLipSyncVideoUrl: synced.url || item.url,
      dubbingLipSyncKey: nextKey
    })
    // 刷新后 reconcile 可能改选中项：保持用户当前预览项
    const still =
      hist.some((h) => h.id === keepKey) || keepKey === nextKey || keepKey === navKeySource
    selectedNavKeyByIndex.value = {
      ...selectedNavKeyByIndex.value,
      [i]: still ? (hist.some((h) => h.id === nextKey) ? nextKey : keepKey) : nextKey
    }
    if (!opts?.silent) message.success('确认成功')
    notifyEpisodeTimelineRebuildRequested()
  }

  if (opts?.silent) {
    try {
      await run()
    } catch {
      patchDubbingPanelAsLipSync(i, {
        dialogue: item.dialogue,
        dubbingVoiceName: item.voiceName,
        dubbingEmotion: item.emotion,
        dubbingLipSync: draftLipSync.value,
        dubbingVoiceAvatarUrl: draftVoiceAvatarUrl.value || undefined,
        dubbingLipSyncVideoUrl: item.url,
        dubbingLipSyncKey: item.id
      })
    }
    return
  }

  isSettingFinalDubbing.value = true
  try {
    await run()
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '设置音画同步失败')
  } finally {
    isSettingFinalDubbing.value = false
  }
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

/** 取消音画同步结果：配音轨 compose 走 unSetFinalVideo（与取消分镜视频对称） */
async function onCancelDubbingSetting() {
  if (isSettingFinalDubbing.value) return
  const i = currentSceneIndex.value
  if (pendingDubbingByIndex.value[i]) {
    cancelPendingDubbing()
    return
  }

  const storyboardId = resolveStoryboardIdForIndex(i)
  const lipKey = currentPanelLipSyncKey.value
  const keepNavKey = selectedNavKeyByIndex.value[i] || selectedNavKey.value
  // 优先用当前预览项解析 recordId，避免 key 不一致时误清/漏调接口
  const selectedItem =
    keepNavKey && keepNavKey !== navKeySource && keepNavKey !== navKeyLoading
      ? genHistoryForScene.value.find((x) => x.id === keepNavKey)
      : null
  const composeRecordId =
    resolveComposeRecordIdFromGenItem(selectedItem, i) ?? resolveActiveComposeRecordId(i)

  const restoreNavSelection = () => {
    if (!keepNavKey || keepNavKey === navKeyLoading) return
    const entries = rightNavEntries.value
    if (entries.some((e) => e.key === keepNavKey)) {
      selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [i]: keepNavKey }
      return
    }
    // key 可能在刷新后变为 compose-xxx，按 URL 回落
    const url = selectedItem?.url || entries.find((e) => e.key === keepNavKey)?.url || ''
    if (url) {
      const hit = entries.find((e) => e.url === url)
      if (hit) {
        selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [i]: hit.key }
      }
    }
  }

  // 当前为 compose「使用中」：先调 unSetFinalVideo，再清本地；保持当前生成记录选中
  if (storyboardId && composeRecordId != null && lipKey && lipKey !== navKeySource) {
    isSettingFinalDubbing.value = true
    try {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      await userStoryboardUnSetFinalVideo({
        ...(ctx ? { projectId: ctx.projectId, episodeId: ctx.episodeId } : {}),
        storyboardId,
        recordId: composeRecordId
      })
      if (ctx) clearProjectStoryboardRecordCache(ctx)
      clearDubbingLipSyncLocal(i)
      await refreshServerVideoRecords(i, { force: true })
      restoreNavSelection()
      message.success('取消成功')
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '取消音画同步失败')
    } finally {
      isSettingFinalDubbing.value = false
    }
    return
  }

  if (lipKey === navKeySource || confirmedDubbingThisSession.value.has(i)) {
    // 原视频「使用中」：若仍有 compose 选中则一并取消
    if (storyboardId && composeRecordId != null) {
      isSettingFinalDubbing.value = true
      try {
        const ctx = await resolveStoryScriptSaveContext(creationStore, route)
        await userStoryboardUnSetFinalVideo({
          ...(ctx ? { projectId: ctx.projectId, episodeId: ctx.episodeId } : {}),
          storyboardId,
          recordId: composeRecordId
        })
        if (ctx) clearProjectStoryboardRecordCache(ctx)
        await refreshServerVideoRecords(i, { force: true })
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '取消音画同步失败')
        isSettingFinalDubbing.value = false
        return
      } finally {
        isSettingFinalDubbing.value = false
      }
    }
    const prev = preConfirmPanelByIndex.value[i]
    if (prev) {
      const next = props.dubbingPanels.map((p, idx) =>
        idx === i ? ({ ...prev } as DubbingPanel) : p
      )
      emit('update:panels', next)
    } else {
      clearDubbingLipSyncLocal(i)
    }
    const ns = new Set(confirmedDubbingThisSession.value)
    ns.delete(i)
    confirmedDubbingThisSession.value = ns
    const pre = { ...preConfirmPanelByIndex.value }
    delete pre[i]
    preConfirmPanelByIndex.value = pre
    restoreNavSelection()
    message.success('取消成功')
    return
  }

  if (isPanelDubbingConfigured(props.dubbingPanels[i])) {
    clearDubbingLipSyncLocal(i)
    restoreNavSelection()
    message.success('取消成功')
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
const draftVoiceModelId = ref(0)
const draftTimbreCode = ref('')
/** 音色服务商/模型提示（MiniMax 字数预检） */
const draftVoiceProviderHint = ref('')
const voicePickerOpen = ref(false)
const ttsPreviewLoadingByPanelKey = ref<Record<string, boolean>>({})
const ttsPreviewPlayingByPanelKey = ref<Record<string, boolean>>({})
const ttsPreviewDurationByPanelKey = ref<Record<string, number | null>>({})
type TtsPreviewCacheEntry = {
  signature: string
  playUrl: string
  durationSec: number
}
const ttsPreviewCacheByPanelKey = ref<Record<string, TtsPreviewCacheEntry>>({})
let ttsPreviewAudio: HTMLAudioElement | null = null
let ttsPreviewAudioPanelKey: string | null = null

const ttsPreviewLoading = computed(
  () => !!ttsPreviewLoadingByPanelKey.value[resolveDubbingPanelKey(currentSceneIndex.value)]
)
const ttsPreviewPlaying = computed(
  () => !!ttsPreviewPlayingByPanelKey.value[resolveDubbingPanelKey(currentSceneIndex.value)]
)
const ttsPreviewDurationSec = computed(
  () => ttsPreviewDurationByPanelKey.value[resolveDubbingPanelKey(currentSceneIndex.value)] ?? null
)
const emotionNameToCode = ref<Map<string, string>>(new Map())
/** 情绪按钮文案（与 emotionNameToCode 同源，避免子组件再打一次 tags） */
const emotionLabelOptions = ref<string[]>([])
const { voicePreviewEstimatedMaxChars, loadPublicConfig } = useAuthPublicConfig()

type Draft = {
  dialogue: string
  emotion: string
  lipSync: boolean
  voiceName: string
  voiceAvatarUrl: string
  voiceLibraryId?: number
  voiceModelId?: number
  timbreCode?: string
}
const draftByIndex = ref<Record<number, Draft>>({})

const serverVideoRecordsByIndex = ref<
  Record<
    number,
    Array<{ id: string; url: string; isSelected?: boolean; _serverRow?: StoryboardRecordRow }>
  >
>({})

function mapRecordRowToVideoThumb(r: StoryboardRecordRow) {
  const url = (r.fileUrl || '').trim()
  return {
    id: String(r.id ?? ''),
    url,
    title: resolveStoryboardRecordDisplayName(r) || undefined,
    isSelected: r.isSelected === 1,
    _serverRow: r
  }
}

function syncComposeGenHistoryForScene(sceneIdx: number, rows: StoryboardRecordRow[]) {
  const panel = props.dubbingPanels[sceneIdx]
  const prev = genHistoryByIndex.value[sceneIdx] ?? [...(panel?.dubbingGenHistory || [])]
  const merged = mergeComposeRecordsIntoDubbingGenHistory(prev, rows, panel)
  if (isSameDubbingGenHistory(prev, merged)) return

  genHistoryByIndex.value = { ...genHistoryByIndex.value, [sceneIdx]: merged }
  emit(
    'update:panels',
    props.dubbingPanels.map((p, idx) =>
      idx !== sceneIdx ? p : { ...p, dubbingGenHistory: merged }
    )
  )
}

/** 打开弹窗 / 切换分镜后：根据 panel 或 compose 使用中记录恢复右侧选中项 */
function reconcileSelectedNavKeyForScene(sceneIdx: number) {
  if (genLoadingByPanelKey.value[resolveDubbingPanelKey(sceneIdx)]) return

  const panel = props.dubbingPanels[sceneIdx]
  const hist = genHistoryByIndex.value[sceneIdx] || []
  const lipKey = panel?.dubbingLipSyncKey
  if (lipKey != null && String(lipKey).trim()) {
    const key = String(lipKey).trim()
    // lipKey 指向源视频时：无配音历史才停在源视频；有历史仍走下方兜底展示配音结果
    if ((key === navKeySource || key === '__source__') && !hist.length) {
      selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [sceneIdx]: navKeySource }
      return
    }
    if (hist.some((h) => h.id === key)) {
      selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [sceneIdx]: key }
      return
    }
  }

  const lipUrl = String(panel?.dubbingLipSyncVideoUrl ?? '').trim()
  if (lipUrl) {
    const byUrl = hist.find((h) => h.url === lipUrl)
    if (byUrl) {
      selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [sceneIdx]: byUrl.id }
      return
    }
    const sourceUrl =
      getPanelStoryboardVideoUrl(videoPanels.value[sceneIdx]) || getVideoUrl(sceneIdx)
    if (sourceUrl && sourceUrl === lipUrl && !hist.length) {
      selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [sceneIdx]: navKeySource }
      return
    }
  }

  const serverList = serverVideoRecordsByIndex.value[sceneIdx] || []
  const activeCompose = serverList.find(
    (r) => isComposeStoryboardVideoRecord(r._serverRow) && r._serverRow?.isSelected === 1
  )
  if (activeCompose?.url) {
    const hit = hist.find((h) => h.url === activeCompose.url)
    if (hit) {
      selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [sceneIdx]: hit.id }
      return
    }
  }

  const nextKey = resolveDubbingPreviewNavKey({
    hist,
    currentKey: selectedNavKeyByIndex.value[sceneIdx],
    navKeySource,
    navKeyLoading,
    hasSourceVideo: !!getVideoUrl(sceneIdx)
  })
  selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [sceneIdx]: nextKey }
}

function applyComposeRowsFromProject(rows: StoryboardRecordRow[]) {
  const byStoryboardId = groupStoryboardRecordsByStoryboardId(rows)
  const nextServerRecords = { ...serverVideoRecordsByIndex.value }

  props.dubbingPanels.forEach((_, sceneIdx) => {
    const sid = resolveStoryboardIdForIndex(sceneIdx)
    if (!sid) return
    const sceneRows = byStoryboardId.get(sid) ?? []
    nextServerRecords[sceneIdx] = sceneRows
      .filter((r) => !!String(r?.fileUrl ?? '').trim())
      .map(mapRecordRowToVideoThumb)
    syncComposeGenHistoryForScene(sceneIdx, sceneRows)
  })

  serverVideoRecordsByIndex.value = nextServerRecords
}

let prefetchComposeGenHistoryInflight: Promise<void> | null = null

/** 弹窗打开：一次拉取项目 compose 记录，为全部分镜同步配音生成历史 */
async function prefetchComposeGenHistoryForAllScenes(options?: {
  force?: boolean
  rows?: StoryboardRecordRow[]
}) {
  if (options?.rows?.length) {
    applyComposeRowsFromProject(options.rows)
    return
  }

  if (prefetchComposeGenHistoryInflight && !options?.force) {
    return prefetchComposeGenHistoryInflight
  }

  const request = (async () => {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return

    let rows: StoryboardRecordRow[] = []
    try {
      rows = await fetchProjectStoryboardRecords(ctx, 'compose', { force: options?.force })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.warning(err?.msg || err?.message || '获取配音生成记录失败')
      return
    }

    applyComposeRowsFromProject(rows)
  })()

  prefetchComposeGenHistoryInflight = request
  try {
    await request
  } finally {
    if (prefetchComposeGenHistoryInflight === request) {
      prefetchComposeGenHistoryInflight = null
    }
  }
}

async function refreshServerVideoRecords(i: number, opts?: { force?: boolean }) {
  const storyboardId = resolveStoryboardIdForIndex(i)
  if (!storyboardId) return
  if (!opts?.force && serverVideoRecordsByIndex.value[i] != null) {
    reconcileSelectedNavKeyForScene(i)
    return
  }

  const inflight = serverVideoRecordsInflightByIndex.get(i)
  if (inflight) return inflight

  const request = (async () => {
    try {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (!ctx) return
      const rows = await fetchStoryboardRecordsForStoryboard(ctx, storyboardId, 'compose', {
        force: opts?.force
      })
      const mapped = rows
        .filter((r) => !!String(r?.fileUrl ?? '').trim())
        .map(mapRecordRowToVideoThumb)
      serverVideoRecordsByIndex.value = { ...serverVideoRecordsByIndex.value, [i]: mapped }
      syncComposeGenHistoryForScene(i, rows)
      reconcileSelectedNavKeyForScene(i)
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.warning(err?.msg || err?.message || '获取生成记录失败')
    } finally {
      serverVideoRecordsInflightByIndex.delete(i)
    }
  })()

  serverVideoRecordsInflightByIndex.set(i, request)
  return request
}

function getVideoUrl(index: number): string {
  const panel = videoPanels.value[index]
  const localUrl = getPanelStoryboardVideoUrl(panel)
  if (localUrl) return localUrl
  const scriptPanel = scriptPanels.value[index]
  const fromList = String(scriptPanel?.finalVideoUrl ?? '').trim()
  if (fromList) return fromList
  return ''
}

function panelHasStoryboardVideoUrl(vPanels: StoryboardVideoPanel[], idx: number): boolean {
  const panel = vPanels[idx]
  return !!getPanelStoryboardVideoUrl(panel)
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

const headerTabsForDisplay = computed(() => {
  if (headerTabs.value.length) return headerTabs.value
  return props.dubbingPanels.map((panel, sceneIndex) => ({
    sceneIndex,
    storyboardId: resolveStoryboardIdForIndex(sceneIndex) ?? undefined,
    name: panel.title || `分镜${sceneIndex + 1}`,
    thumbnailUrl: getVideoUrl(sceneIndex),
    hasFinalAsset: false,
    dubbingConfigured: isPanelDubbingConfigured(panel)
  }))
})

const sceneItems = computed(() =>
  props.dubbingPanels.map((p, i) => {
    const tab = headerTabsForDisplay.value[i]
    const sourceVideoUrl = getVideoUrl(i)
    const videoUrl = tab?.thumbnailUrl || sourceVideoUrl
    const hasVideo = !!videoUrl
    const configured = tab?.dubbingConfigured ?? isPanelDubbingConfigured(p)
    return {
      id: p.id,
      name: formatDubbingSceneTabPrimaryLabel(p.title || '', hasVideo, i),
      videoUrl,
      configured
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

const rightNavEntries = computed((): DubbingNavEntry[] => {
  const entries: DubbingNavEntry[] = []
  for (const item of genHistoryForScene.value) {
    if (!String(item.url || '').trim()) continue
    entries.push({ key: item.id, type: 'gen', url: item.url })
  }
  if (showLoadingCardForScene.value) {
    entries.push({ key: navKeyLoading, type: 'loading' })
  }
  return entries
})

/** 中间预览为配音合成/对口型记录时，展示「设置为音画同步结果」操作区 */
const showSetLipSyncActions = computed(() => {
  const k = selectedNavKey.value
  if (!k || k === navKeyLoading || k === navKeySource) return false
  if (!String(dubbingPreviewUrl.value || '').trim()) return false
  return genHistoryForScene.value.some((item) => item.id === k)
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
  resetHeroVideoPreviewState()
  selectedNavKeyByIndex.value = { ...selectedNavKeyByIndex.value, [i]: key }
  scrollToGenAnchor(key)
}

function resolveHeroVideoEl(): HTMLVideoElement | null {
  const ref = heroVideoComponentRef.value?.videoRef
  if (ref instanceof HTMLVideoElement) return ref
  if (ref && typeof ref === 'object' && 'value' in ref) {
    const inner = (ref as { value?: HTMLVideoElement | null }).value
    return inner instanceof HTMLVideoElement ? inner : null
  }
  return null
}

function markHeroVideoMediaReady() {
  heroVideoMediaReady.value = true
}

function pauseHeroVideoPlayback() {
  heroVideoPlaying.value = false
  const videoEl = resolveHeroVideoEl()
  if (!videoEl) return
  videoEl.pause()
  videoEl.currentTime = 0
  videoEl.muted = true
}

function resetHeroVideoPreviewState() {
  heroVideoPlaying.value = false
  heroVideoMediaReady.value = false
  pauseHeroVideoPlayback()
}

async function toggleHeroVideoPlayback() {
  const url = dubbingPreviewUrl.value
  if (!url) return

  const videoEl = resolveHeroVideoEl()
  if (!videoEl) return

  if (!videoEl.paused) {
    videoEl.pause()
    videoEl.muted = true
    heroVideoPlaying.value = false
    return
  }

  if (videoEl.ended) videoEl.currentTime = 0
  videoEl.muted = false
  heroVideoPlaying.value = true
  try {
    await videoEl.play()
  } catch {
    heroVideoPlaying.value = false
    videoEl.muted = true
    message.warning('无法自动播放，请稍后重试')
  }
}

const canToggleHeroVideoWithSpace = computed(
  () => modalOpen.value && Boolean(dubbingPreviewUrl.value) && heroVideoMediaReady.value
)
useVideoPlaybackSpaceShortcut(canToggleHeroVideoWithSpace, toggleHeroVideoPlayback)

function onHeroVideoEnded() {
  heroVideoPlaying.value = false
  const videoEl = resolveHeroVideoEl()
  if (!videoEl) return
  videoEl.muted = true
  videoEl.currentTime = 0
}

function onHeroVideoPause() {
  const videoEl = resolveHeroVideoEl()
  if (!videoEl || !videoEl.paused || !heroVideoPlaying.value) return
  heroVideoPlaying.value = false
  videoEl.muted = true
}

async function handleFullscreenHeroVideo() {
  const videoEl = resolveHeroVideoEl()
  if (!videoEl) return
  try {
    if (videoEl.paused) {
      videoEl.muted = false
      heroVideoPlaying.value = true
      await videoEl.play()
    }
    await videoEl.requestFullscreen()
  } catch {
    message.warning('全屏预览不可用')
  }
}

function persistCurrentDraft() {
  const i = currentSceneIndex.value
  draftByIndex.value[i] = {
    dialogue: draftDialogue.value,
    emotion: draftEmotion.value,
    lipSync: draftLipSync.value,
    voiceName: draftVoiceName.value,
    voiceAvatarUrl: draftVoiceAvatarUrl.value,
    voiceLibraryId: draftVoiceLibraryId.value > 0 ? draftVoiceLibraryId.value : undefined,
    voiceModelId: draftVoiceModelId.value > 0 ? draftVoiceModelId.value : undefined,
    timbreCode: draftTimbreCode.value.trim() || undefined
  }
}

function applyVoiceFromLibraryRow(row: {
  id?: number
  voiceName?: string
  avatarUrl?: string
  modelId?: number
  voiceCode?: string
}) {
  const id = Number(row?.id)
  if (!Number.isFinite(id) || id <= 0) return
  draftVoiceName.value = String(row.voiceName || '').trim() || '未命名'
  draftVoiceAvatarUrl.value = String(row.avatarUrl || '').trim()
  draftVoiceLibraryId.value = id
  const modelId = Number(row.modelId)
  draftVoiceModelId.value = Number.isFinite(modelId) && modelId > 0 ? modelId : 0
  draftTimbreCode.value = String(row.voiceCode || '').trim()
}

/** 无音色时默认选音色库第一项；有展示名但缺 ID 时按名称反查 */
async function ensureVoiceSelectionFromLibrary() {
  if (draftVoiceLibraryId.value > 0) return
  try {
    const res = await userVoiceLibraryList({ pageNum: 1, pageSize: 100 })
    const list = Array.isArray(res.data) ? res.data : []
    if (!list.length) return

    const name = draftVoiceName.value.trim()
    if (name && name !== '无音色') {
      const hit = list.find(
        (row: { voiceName?: string }) => String(row?.voiceName || '').trim() === name
      )
      if (hit) {
        applyVoiceFromLibraryRow(hit)
        return
      }
    }

    if (!name || name === '无音色') {
      applyVoiceFromLibraryRow(list[0]!)
    }
  } catch {
    /* 列表失败时保持现状，用户可手动选音色 */
  }
}

function loadDraftForIndex(i: number) {
  if (i < 0 || i >= props.dubbingPanels.length) {
    draftDialogue.value = ''
    draftVoiceAvatarUrl.value = ''
    draftVoiceLibraryId.value = 0
    draftVoiceModelId.value = 0
    draftTimbreCode.value = ''
    draftVoiceProviderHint.value = ''
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
    draftVoiceModelId.value =
      saved.voiceModelId != null && saved.voiceModelId > 0 ? saved.voiceModelId : 0
    draftTimbreCode.value = saved.timbreCode || ''
    void ensureVoiceSelectionFromLibrary()
    return
  }
  draftDialogue.value = panel?.dialogue?.trim() ? panel.dialogue : script.slice(0, 50)
  draftEmotion.value = panel?.dubbingEmotion || '中性'
  draftLipSync.value = !!panel?.dubbingLipSync
  draftVoiceName.value = panel?.dubbingVoiceName || ''
  draftVoiceAvatarUrl.value = panel?.dubbingVoiceAvatarUrl || ''
  draftVoiceLibraryId.value = 0
  draftVoiceModelId.value = 0
  draftTimbreCode.value = ''
  void ensureVoiceSelectionFromLibrary()
}

function switchScene(index: number) {
  if (index === currentSceneIndex.value || index < 0 || index >= props.dubbingPanels.length) return
  const keepSid = resolveStoryboardIdForIndex(index)
  suspendOtherStoryboardDubbingModalFollows(keepSid)
  stopTtsPreviewPlayback()
  resetHeroVideoPreviewState()
  persistCurrentDraft()
  leftPanelLoading.value = true
  rightPanelLoading.value = true
  currentSceneIndex.value = index
  loadDraftForIndex(index)
  void refreshServerVideoRecords(index).then(() => {
    reconcileSelectedNavKeyForScene(index)
  })
  nextTick().then(() => {
    scrollActiveSceneTabIntoView()
    setTimeout(() => {
      leftPanelLoading.value = false
      rightPanelLoading.value = false
    }, TAB_SWITCH_SKELETON_MS)
    void restoreStoryboardDubbingGenerateIfNeeded(index)
  })
}

/** 顶部 Tab 互斥：挂起非当前分镜的对口型 SSE / follow 占坑 */
function suspendOtherStoryboardDubbingModalFollows(keepStoryboardId: number | null) {
  const scopeKey = creationStore.step3GenVisualScopeKey()
  const keepKey = keepStoryboardId != null && keepStoryboardId > 0 ? String(keepStoryboardId) : ''
  const activeFollows: Array<{ tabKey: string; taskId: number }> = []
  for (const sid of listActiveStoryboardDubbingGenFollowIds(scopeKey)) {
    const task = findStoryboardDubbingGenTaskInScopes(creationStore, sid, route)
    const tid = Number(task?.taskId)
    if (!Number.isFinite(tid) || tid <= 0) continue
    activeFollows.push({ tabKey: String(sid), taskId: tid })
  }
  const toSuspend = listModalTabFollowsToSuspend({
    currentTabKey: keepKey,
    activeFollows
  })
  for (const tid of toSuspend) {
    suspendTaskSseFollow(tid)
  }
  for (const sid of listActiveStoryboardDubbingGenFollowIds(scopeKey)) {
    if (keepStoryboardId != null && sid === keepStoryboardId) continue
    releaseStoryboardDubbingGenFollow(sid, scopeKey)
  }
}

function scrollActiveSceneTabIntoView() {
  sceneTabBarRef.value?.scrollItemIntoView('.scene-image-tab.active')
  sceneTabBarRef.value?.refresh()
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      stopTtsPreviewPlayback()
      pauseHeroVideoPlayback()
      resetHeroVideoPreviewState()
      ttsPreviewLoadingByPanelKey.value = {}
      ttsPreviewPlayingByPanelKey.value = {}
      ttsPreviewDurationByPanelKey.value = {}
      ttsPreviewCacheByPanelKey.value = {}
      void refreshEmotionTagCodeMap()
      void loadPublicConfig()
      leftPanelLoading.value = true
      rightPanelLoading.value = true
      draftByIndex.value = {}
      pendingDubbingByIndex.value = {}
      pendingPayloadByIndex.value = {}
      preConfirmPanelByIndex.value = {}
      confirmedDubbingThisSession.value = new Set()
      serverVideoRecordsByIndex.value = {}
      selectedNavKeyByIndex.value = {}
      // 从 panel 恢复生成历史，使批量生成与弹窗内生成的视频均以「新增一条」形式展示
      const nextGen: Record<number, DubbingGenItem[]> = {}
      props.dubbingPanels.forEach((p, i) => {
        nextGen[i] = [...(p.dubbingGenHistory || [])]
      })
      genHistoryByIndex.value = nextGen
      currentSceneIndex.value = Math.min(
        Math.max(0, props.sceneIndex),
        Math.max(0, props.dubbingPanels.length - 1)
      )
      const openSid = resolveStoryboardIdForIndex(currentSceneIndex.value)
      if (openSid) clearStoryboardDubbingModalUserDismissed(storyboardDubbingModalSessionScope())
      primeDubbingLoadingFromStore()
      loadDraftForIndex(currentSceneIndex.value)
      nextTick().then(() => {
        scrollActiveSceneTabIntoView()
        sceneTabBarRef.value?.refresh()
        setTimeout(() => {
          leftPanelLoading.value = false
          rightPanelLoading.value = false
        }, TAB_SWITCH_SKELETON_MS)
        void restoreStoryboardDubbingGenerateIfNeeded(currentSceneIndex.value)
        syncDubbingLoadingUiFromStore()
      })
      if (import.meta.client) {
        window.addEventListener('storyboard-dubbing-gen-settled', onStoryboardDubbingGenSettled)
      }
    } else {
      stopTtsPreviewPlayback()
      pauseHeroVideoPlayback()
      if (import.meta.client) {
        window.removeEventListener('storyboard-dubbing-gen-settled', onStoryboardDubbingGenSettled)
      }
    }
  },
  { immediate: true }
)

watch(projectRecordRows, (rows) => {
  if (!props.open || !rows.length) return
  applyComposeRowsFromProject(rows)
  reconcileSelectedNavKeyForScene(currentSceneIndex.value)
})

watch(
  () => props.sceneIndex,
  (v) => {
    if (props.open && v >= 0 && v < props.dubbingPanels.length) {
      switchScene(v)
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
    syncDubbingLoadingUiFromStore()
  },
  { deep: true }
)

watch(
  () =>
    creationStore.step4PlusLiveGenByScope[creationStore.step3GenVisualScopeKey()]
      ?.storyboardDubbingGenTasksByStoryboardId,
  () => syncDubbingLoadingUiFromStore(),
  { deep: true }
)

function onStoryboardDubbingGenSettled(event: Event) {
  if (!props.open) return
  const detail = (event as CustomEvent<{ storyboardId?: number; scopeKey?: string }>).detail
  const settledScopeKey = String(detail?.scopeKey || '').trim()
  if (settledScopeKey && settledScopeKey !== creationStore.step3GenVisualScopeKey()) return
  const settledSid = Number(detail?.storyboardId)
  if (Number.isFinite(settledSid) && settledSid > 0) {
    props.dubbingPanels.forEach((_, idx) => {
      if (resolveStoryboardIdForIndex(idx) === settledSid) {
        clearDubbingLoadingUiForScene(idx)
      }
    })
    return
  }
  syncDubbingLoadingUiFromStore()
}

function handleCancel() {
  persistCurrentDraft()
  const sid = resolveStoryboardIdForIndex(currentSceneIndex.value)
  if (
    sid &&
    (creationStore.getStoryboardDubbingGenTask(sid) ||
      genLoadingByPanelKey.value[resolveDubbingPanelKey(currentSceneIndex.value)])
  ) {
    markStoryboardDubbingModalUserDismissed(sid, storyboardDubbingModalSessionScope())
  }
  emit('update:open', false)
}

async function refreshEmotionTagCodeMap() {
  try {
    const data = await userVoiceLibraryTags()
    const m = new Map<string, string>()
    const labels: string[] = []
    for (const t of data.emotionTags || []) {
      const code = (t.tagCode || '').trim().toLowerCase()
      const name = String(t.tagName || t.tagCode || '').trim()
      if (name) labels.push(name)
      if (!code) continue
      m.set(code, code)
      if (t.tagName) m.set(t.tagName.trim(), code)
    }
    emotionNameToCode.value = m
    if (labels.length) emotionLabelOptions.value = labels
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

function buildTtsPreviewSignature(
  previewText: string,
  voiceLibraryId: number,
  voiceModelId: number,
  timbreCode: string
): string {
  return `${previewText}|lib:${voiceLibraryId}|model:${voiceModelId}|t:${timbreCode}`
}

function stopTtsPreviewPlayback() {
  if (ttsPreviewAudio) {
    ttsPreviewAudio.pause()
    ttsPreviewAudio.onended = null
    ttsPreviewAudio.onerror = null
    ttsPreviewAudio.removeAttribute('src')
    ttsPreviewAudio.load()
    ttsPreviewAudio = null
  }
  if (ttsPreviewAudioPanelKey) {
    const next = { ...ttsPreviewPlayingByPanelKey.value }
    delete next[ttsPreviewAudioPanelKey]
    ttsPreviewPlayingByPanelKey.value = next
    ttsPreviewAudioPanelKey = null
  }
}

async function playTtsPreviewUrl(panelKey: string, playUrl: string, durationSec: number) {
  stopTtsPreviewPlayback()
  ttsPreviewPlayingByPanelKey.value = { ...ttsPreviewPlayingByPanelKey.value, [panelKey]: true }
  ttsPreviewAudioPanelKey = panelKey
  ttsPreviewDurationByPanelKey.value = {
    ...ttsPreviewDurationByPanelKey.value,
    [panelKey]: durationSec
  }
  const play = new Audio(playUrl)
  ttsPreviewAudio = play
  play.onended = () => stopTtsPreviewPlayback()
  play.onerror = () => {
    stopTtsPreviewPlayback()
    message.warning('试听播放失败')
  }
  try {
    await play.play()
  } catch {
    stopTtsPreviewPlayback()
    message.warning('自动播放被浏览器拦截，请再点击一次试听')
  }
}

async function resolveVoiceModelForPreview(
  voiceLibraryId: number,
  voiceModelId: number,
  timbreCode: string
): Promise<{ modelId: number; timbreCode?: string }> {
  let modelId = voiceModelId > 0 ? voiceModelId : 0
  let resolvedTimbreCode = timbreCode.trim() || undefined
  if (modelId <= 0 && voiceLibraryId > 0) {
    const { userVoiceLibraryList } = await import('~/utils/businessApi')
    const res = await userVoiceLibraryList({ pageNum: 1, pageSize: 200 })
    const hit = res.data.find((row: { id?: number }) => Number(row?.id) === voiceLibraryId)
    modelId = Number((hit as { modelId?: number } | undefined)?.modelId)
    resolvedTimbreCode =
      String((hit as { voiceCode?: string } | undefined)?.voiceCode || '').trim() ||
      resolvedTimbreCode
  }
  if (!Number.isFinite(modelId) || modelId <= 0) {
    throw new Error('音色模型无效，请重新选择音色')
  }
  return { modelId, timbreCode: resolvedTimbreCode }
}

async function onPreviewListen() {
  const panelKey = resolveDubbingPanelKey(currentSceneIndex.value)
  if (ttsPreviewLoadingByPanelKey.value[panelKey]) return
  const plain = htmlToPlainText(draftDialogue.value).trim()
  if (!plain) {
    message.warning('请输入内容')
    return
  }
  const previewMaxChars = voicePreviewEstimatedMaxChars.value
  if (plain.length > previewMaxChars) {
    message.warning(`试听仅支持前${previewMaxChars}字`)
    return
  }
  const lid = draftVoiceLibraryId.value
  const voiceModelId = draftVoiceModelId.value
  if ((!lid || lid <= 0) && (!voiceModelId || voiceModelId <= 0)) {
    message.warning('请选择音色')
    return
  }
  const previewText = plain
  const timbreCode = draftTimbreCode.value.trim()
  const signature = buildTtsPreviewSignature(previewText, lid, voiceModelId, timbreCode)
  const cached = ttsPreviewCacheByPanelKey.value[panelKey]
  if (cached?.signature === signature && cached.playUrl) {
    await playTtsPreviewUrl(panelKey, cached.playUrl, cached.durationSec)
    return
  }

  ttsPreviewLoadingByPanelKey.value = { ...ttsPreviewLoadingByPanelKey.value, [panelKey]: true }
  ttsPreviewDurationByPanelKey.value = { ...ttsPreviewDurationByPanelKey.value, [panelKey]: null }
  try {
    const { modelId, timbreCode: resolvedTimbreCode } = await resolveVoiceModelForPreview(
      lid,
      voiceModelId,
      timbreCode
    )

    const preview = await userVoicePreview({
      text: previewText,
      voiceModelId: modelId,
      timbreCode: resolvedTimbreCode
    })
    const playUrl = resolveVoicePreviewPlayUrl(preview)
    if (!playUrl) throw new Error('未返回试听音频')

    let sec: number
    const durationMs = Number(preview.durationMs)
    if (Number.isFinite(durationMs) && durationMs > 0) {
      sec = durationMs / 1000
    } else {
      sec = await loadAudioDurationSec(playUrl)
    }

    ttsPreviewCacheByPanelKey.value = {
      ...ttsPreviewCacheByPanelKey.value,
      [panelKey]: { signature, playUrl, durationSec: sec }
    }
    await playTtsPreviewUrl(panelKey, playUrl, sec)
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
  voiceModelId?: number
  timbreCode?: string
  providerName?: string
  modelCode?: string
}) {
  draftVoiceName.value = payload.name
  draftVoiceAvatarUrl.value = payload.avatarUrl
  draftVoiceLibraryId.value =
    payload.voiceLibraryId != null && payload.voiceLibraryId > 0 ? payload.voiceLibraryId : 0
  draftVoiceModelId.value =
    payload.voiceModelId != null && payload.voiceModelId > 0 ? payload.voiceModelId : 0
  draftTimbreCode.value = payload.timbreCode || ''
  draftVoiceProviderHint.value = [payload.providerName, payload.modelCode].filter(Boolean).join('|')
  message.success(`已选择音色：${payload.name}`)
}

watch(
  () => dubbingPreviewUrl.value,
  () => {
    resetHeroVideoPreviewState()
  }
)

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

/* 窄屏略收左右列，把宽度让给中间预览 */
@media (max-width: 1440px) {
  .figma-stage-layout.dubbing-stage-layout {
    grid-template-columns: 128px minmax(0, 1fr) 340px;
  }
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
  background: linear-gradient(90deg, #2b2b2b 20%, #444444 50%, #2b2b2b 80%);
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
  position: relative;
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

.stage-history-panel .history-item.history-item--main {
  border-color: rgba(74, 231, 253, 0.85);
}

.stage-history-panel .history-item.history-item--generating {
  border-color: rgba(74, 231, 253, 0.55);
}

.history-delete-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 5;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.history-delete-icon img {
  width: 30px !important;
  height: 30px !important;
  display: block;
}

.history-generating-mask {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 14, 22, 0.82);
  backdrop-filter: blur(3px);
}

.history-generating-mask__icon {
  font-size: 22px;
  color: #4ae7fd;
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
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
  padding-right: 16px;
}

.dubbing-stage-config :deep(.dubbing-edit-left) {
  flex: 1 1 0;
  height: 100%;
  min-height: 0;
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

.dubbing-canvas-preview {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

.dubbing-canvas-preview--loading {
  flex: 1;
}

.video-placeholder--blank {
  width: 100%;
  height: 100%;
  min-height: 100%;
  background: rgba(12, 18, 28, 0.88);
}

.video-card-generating-mask {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(10, 14, 22, 0.82);
  backdrop-filter: blur(4px);
}

.video-card-generating-mask__icon {
  font-size: 28px;
  color: #4ae7fd;
}

.video-card-generating-mask__text {
  margin: 0;
  font-size: 12px;
  color: rgba(225, 239, 255, 0.88);
  text-align: center;
  padding: 0 12px;
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
  /*
   * 与分镜视频弹窗一致：小分辨率不再额外压矮预览，
   * 用更高 vh 吃满中间列，上限 560 对齐 1920 观感。
   */
  --dubbing-hero-max-h: clamp(240px, 68vh, 560px);
  position: relative;
  width: min(100%, calc(var(--dubbing-hero-max-h) * 16 / 9));
  max-width: 100%;
  margin-inline: auto;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--gray-200, rgba(96, 124, 158, 0.22));
  background: rgba(6, 10, 18, 0.55);
  aspect-ratio: 16 / 9;
  height: auto;
  flex: 0 0 auto;
}

@media (min-height: 1100px) {
  .dubbing-video-hero {
    --dubbing-hero-max-h: clamp(280px, 72vh, 720px);
  }
}

.dubbing-video-hero--in-card {
  box-shadow: none;
}

.dubbing-video-hero .shimmer-video {
  width: 100%;
  height: 100%;
}

.dubbing-hero-video,
.dubbing-video-hero :deep(.dubbing-hero-video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
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

.btn-set-lipsync-done {
  background: rgba(74, 231, 253, 0.12) !important;
  border: 1px solid rgba(74, 231, 253, 0.55) !important;
  color: rgba(225, 239, 255, 0.95) !important;
  flex-shrink: 0;
}

.btn-set-lipsync-done:hover,
.btn-set-lipsync-done:focus {
  background: rgba(74, 231, 253, 0.18) !important;
  border-color: rgba(74, 231, 253, 0.85) !important;
  color: #fff !important;
}

.btn-set-lipsync-done .anticon {
  color: #4ae7fd;
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

.edit-scene-image-modal .dubbing-stage-config :deep(.ql-editor.ql-blank::before) {
  color: #8e97a5 !important;
  -webkit-text-fill-color: #8e97a5 !important;
  opacity: 1 !important;
}
</style>
