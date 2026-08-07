<template>
  <div class="video-preview-step">
    <div class="preview-toolbar">
      <a-button size="small" :loading="timelineLoading" @click="syncFromPreviousSteps">
        <template #icon><SyncOutlined /></template>
        从前面步骤同步到时间轴
      </a-button>

      <input ref="audioInputRef" class="hidden-file-input" type="file" accept="audio/*" @change="onAudioFileSelected" />
    </div>

    <div class="preview-simple-wrap">
      <div class="preview-player-wrap" data-onboarding="preview-player">
        <div class="preview-player-area" @click="onPreviewPlayerAreaClick">
          <div ref="canvasHostRef" class="preview-canvas-host" :class="{ 'preview-canvas-host-behind': showNativePreviewVideo }" />
          <template v-if="showNativePreviewVideo">
            <video
              ref="nativePreviewVideoARef"
              class="preview-native-video"
              :class="{ 'is-active': nativeActiveSlot === 'A' }"
              playsinline
              preload="auto"
              @loadedmetadata="syncNativePreviewVideoTime"
              @loadeddata="onNativePreviewMediaReady"
              @canplay="onNativePreviewMediaReady"
            />
            <video
              ref="nativePreviewVideoBRef"
              class="preview-native-video"
              :class="{ 'is-active': nativeActiveSlot === 'B' }"
              playsinline
              preload="auto"
              @loadedmetadata="syncNativePreviewVideoTime"
              @loadeddata="onNativePreviewMediaReady"
              @canplay="onNativePreviewMediaReady"
            />
          </template>
          <div
            v-if="previewReadyOverlayMounted"
            class="preview-ready-overlay"
            :class="{ 'is-opaque': previewReadyOverlayOpaque }"
            aria-live="polite"
            aria-busy="true"
          >
            <img
              v-if="previewReadyPosterUrl"
              :src="previewReadyPosterUrl"
              alt=""
              class="preview-ready-overlay__poster"
            />
            <div class="preview-ready-overlay__scrim" />
            <div class="preview-ready-overlay__hint">
              <LoadingOutlined spin class="preview-ready-overlay__spin" />
              <span>{{ previewReadyHintText }}</span>
            </div>
          </div>
          <div v-if="activeSubtitleText" class="preview-subtitle-overlay">{{ activeSubtitleText }}</div>
          <div v-if="showNoVideoOverlay" class="preview-no-video-overlay">
            <VideoCameraOutlined class="preview-no-video-icon" />
            <p>暂无视频无法播放</p>
          </div>
          <div v-if="!videoClips.length && !timelineLoading" class="preview-placeholder">
            <EyeOutlined class="placeholder-icon" />
            <p>请先同步前面步骤</p>
          </div>
          <div v-else class="preview-overlay-controls">
            <button
              v-if="!playing"
              type="button"
              class="dubbing-video-play-btn"
              aria-label="播放"
              @click.stop="togglePlay"
            />
            <button type="button" class="volume-btn" aria-label="音量" @click.stop="toggleMute">
              <SoundOutlined v-if="!muted" />
              <AudioMutedOutlined v-else />
            </button>
          </div>
        </div>
      </div>

      <div
        class="timeline-wrap"
        data-onboarding="preview-timeline"
        ref="timelineWrapRef"
        @pointerdown="onTimelinePointerDown"
        @wheel.passive="onTimelineUserScroll"
      >
        <div class="timeline-inner" :style="{ width: trackLabelWidth + rulerWidthPx + 'px' }">
          <div
            class="timeline-grid-overlay"
            :style="{ width: rulerWidthPx + 'px' }"
            aria-hidden="true"
          >
            <div
              v-for="mark in rulerMarksWithLayout"
              :key="`grid-${mark.sec}`"
              :class="['ruler-grid-line', `ruler-grid-line-${mark.type}`]"
              :style="{ left: mark.leftPx + 'px' }"
            />
          </div>
          <div class="timeline-ruler-gutter" aria-hidden="true" />
          <div class="timeline-ruler" :style="{ width: rulerWidthPx + 'px' }">
            <template v-for="mark in rulerMarksWithLayout" :key="`tick-${mark.sec}`">
              <div
                :class="['ruler-tick', `ruler-tick-${mark.type}`]"
                :style="{ left: mark.leftPx + 'px' }"
              >
                <span v-if="mark.type === 'major'" class="ruler-label">{{ formatTime(mark.sec) }}</span>
              </div>
            </template>
          </div>
          <div class="timeline-playhead" :style="{ left: playheadLeftPx + 'px' }">
            <span class="playhead-head" />
          </div>
          <div v-if="snapEnabled && snapIndicatorPx !== null" class="snap-indicator" :style="{ left: trackLabelWidth + snapIndicatorPx + 'px' }" />

          <div class="timeline-tracks" :style="{ width: rulerWidthPx + 'px' }">
            <div class="track-row track-row-video">
              <div class="track-label">视频</div>
              <div class="track-strip track-strip-video" data-track="video">
                <div
                  v-for="(clip, clipIndex) in videoClips"
                  :key="clip.id"
                  :class="['track-clip', 'track-clip-video', { 'track-clip-selected': selectedClip?.id === clip.id && selectedClip?.track === 'video', 'track-clip-swapping': swappingClipIds.has(clip.id), 'track-clip-video-empty': !hasClipVideoUrl(clip) }]"
                  :style="clipStyle(clip)"
                  @click.stop="selectClip('video', clip.id)"
                  @pointerdown.stop="onClipPointerDown($event, 'video', clip.id)"
                >
                  <video
                    v-if="clip.url"
                    class="clip-thumb-video"
                    :src="clip.url"
                    muted
                    playsinline
                    preload="metadata"
                  />
                  <div v-else class="clip-thumb-placeholder">
                    <img :src="emptyImageIconUrl" alt="" class="clip-thumb-placeholder__icon empty-image-icon empty-image-icon--sm" />
                  </div>
                  <div class="clip-video-meta">
                    <span class="clip-page-badge">{{ getClipPageLabel(clipIndex) }}</span>
                    <span class="clip-text">{{ clip.name }}</span>
                  </div>
                  <div class="clip-hover-mask">
                    <button
                      type="button"
                      class="clip-edit-btn"
                      @click.stop="openEditVideoModalForClip(clip.id)"
                    >
                      <EditOutlined />
                      编辑视频
                    </button>
                  </div>
                  <span class="clip-handle clip-handle-left" @pointerdown.stop="onResizePointerDown($event, 'video', clip.id, 'start')" />
                  <span class="clip-handle clip-handle-right" @pointerdown.stop="onResizePointerDown($event, 'video', clip.id, 'end')" />
                </div>
              </div>
            </div>

            <div class="track-row track-row-volume">
              <div class="track-label">音量</div>
              <div class="track-strip track-strip-volume">
                <div
                  v-for="(clip, clipIndex) in videoClips"
                  :key="`vol-${clip.id}`"
                  class="volume-bar-segment"
                  :class="{ 'volume-bar-segment-active': isVolumeBarActive(clip.id) }"
                  :data-volume-clip="clip.id"
                  :style="clipStyle(clip, clipIndex)"
                  @mouseenter="onVolumeBarMouseEnter(clip.id)"
                  @mouseleave="onVolumeBarMouseLeave(clip.id)"
                >
                  <div
                    class="volume-bar-shell"
                    @pointerdown.stop="onVolumeBarPointerDown($event, clip.id)"
                  >
                    <div
                      class="volume-bar-fill"
                      :class="{ 'volume-bar-fill-dragging': volumeDrag?.clipId === clip.id }"
                      :style="{ height: `${getVideoVolumePercent(clip.id)}%` }"
                    />
                    <div v-if="isVolumeBarActive(clip.id)" class="volume-bar-value">
                      {{ formatVolumeLabel(clip.id) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="track-row track-row-aux track-row-dubbing">
              <div class="track-label">配音</div>
              <div class="track-strip track-strip-aux track-strip-dubbing track-strip-clickable" data-track="voice" @click="onTrackClick($event, 'voice')">
                <div
                  v-for="item in voiceItems"
                  :key="item.id"
                  :class="['track-clip', 'track-clip-dubbing', 'track-clip-dubbing-has-audio', { 'track-clip-selected': selectedClip?.id === item.id && selectedClip?.track === 'voice', 'track-clip-swapping': swappingClipIds.has(item.id) }]"
                  :style="clipStyle(item)"
                  @click.stop="selectClip('voice', item.id)"
                  @pointerdown.stop="onClipPointerDown($event, 'voice', item.id)"
                  @dblclick.stop="openEditDubbingModalForClip(item.videoClipId || item.id)"
                >
                  <div class="dubbing-wave-layer" aria-hidden="true" />
                  <span class="clip-text">{{ item.name || '有配音' }}</span>
                  <div class="clip-hover-mask clip-hover-mask-dubbing">
                    <button
                      type="button"
                      class="clip-edit-btn"
                      @click.stop="openEditDubbingModalForClip(item.videoClipId || item.id)"
                    >
                      <EditOutlined />
                      编辑配音
                    </button>
                  </div>
                  <span class="clip-handle clip-handle-left" @pointerdown.stop="onResizePointerDown($event, 'voice', item.id, 'start')" />
                  <span class="clip-handle clip-handle-right" @pointerdown.stop="onResizePointerDown($event, 'voice', item.id, 'end')" />
                </div>
                <div
                  v-for="(clip, clipIndex) in missingVoiceSlots"
                  :key="`voice-empty-${clip.id}`"
                  class="track-clip track-clip-dubbing track-clip-empty-record"
                  :style="clipStyle(clip)"
                  @pointerdown.stop
                  @click.stop="onMissingVoiceClick(clip.id)"
                >
                  <span class="clip-text">无配音</span>
                  <div class="clip-hover-mask clip-hover-mask-dubbing">
                    <button
                      type="button"
                      class="clip-edit-btn"
                      @click.stop="openEditDubbingModalForClip(clip.id)"
                    >
                      <EditOutlined />
                      编辑配音
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="track-row track-row-aux track-row-subtitle">
              <div class="track-label">字幕</div>
              <div
                ref="subtitleStripRef"
                class="track-strip track-strip-aux track-strip-subtitle track-strip-clickable"
                data-track="subtitle"
                @pointerdown="onSubtitleRangePointerDown"
                @click="onTrackClick($event, 'subtitle')"
              >
                <div
                  v-for="item in subtitleItems"
                  :key="item.id"
                  :class="['track-clip', 'track-clip-subtitle', { 'track-clip-selected': selectedClip?.id === item.id && selectedClip?.track === 'subtitle', 'track-clip-swapping': swappingClipIds.has(item.id) }]"
                  :style="clipStyle(item)"
                  @click.stop="selectClip('subtitle', item.id)"
                  @pointerdown.stop="onClipPointerDown($event, 'subtitle', item.id)"
                >
                  <span class="clip-text">{{ item.text || '有字幕' }}</span>
                  <div class="clip-hover-mask clip-hover-mask-subtitle">
                    <button
                      type="button"
                      class="clip-edit-btn"
                      @click.stop="editSubtitle(item.id)"
                    >
                      <EditOutlined />
                      编辑字幕
                    </button>
                  </div>
                  <span class="clip-handle clip-handle-left" @pointerdown.stop="onResizePointerDown($event, 'subtitle', item.id, 'start')" />
                  <span class="clip-handle clip-handle-right" @pointerdown.stop="onResizePointerDown($event, 'subtitle', item.id, 'end')" />
                </div>
                <div
                  v-for="clip in missingSubtitleSlots"
                  :key="`subtitle-empty-${clip.id}`"
                  class="track-clip track-clip-subtitle track-clip-empty-record"
                  :style="clipStyle(clip)"
                  @pointerdown.stop
                  @click.stop="onMissingSubtitleClick(clip.id)"
                >
                  <span class="clip-text">无字幕</span>
                  <div class="clip-hover-mask clip-hover-mask-subtitle">
                    <button
                      type="button"
                      class="clip-edit-btn"
                      @click.stop="onMissingSubtitleClick(clip.id)"
                    >
                      <EditOutlined />
                      编辑字幕
                    </button>
                  </div>
                </div>
                <div v-if="subtitleRange.active" class="subtitle-range-mask" :style="subtitleRangeStyle" />
              </div>
            </div>

            <div class="track-row track-row-aux track-row-music">
              <div class="track-label">音乐</div>
              <div class="track-strip track-strip-aux track-strip-music" data-track="music">
                <div
                  v-for="bar in musicDisplayBars"
                  :key="bar.key"
                  :class="[
                    'track-clip',
                    'track-clip-music',
                    {
                      'track-clip-music-has-audio': !bar.empty,
                      'track-clip-empty-record': bar.empty,
                      'track-clip-music-empty': bar.empty,
                      'track-clip-selected': !bar.empty && selectedClip?.id === bar.item.id && selectedClip?.track === 'music',
                      'track-clip-swapping': !bar.empty && swappingClipIds.has(bar.item.id)
                    }
                  ]"
                  :style="musicBarStyle(bar.item, bar.empty)"
                  @pointerdown.stop
                  @click.stop="onMusicBarClick(bar)"
                >
                  <div class="music-wave-layer" aria-hidden="true" />
                  <span
                    v-if="!bar.empty && bar.item.sourceDuration && bar.item.duration > bar.item.sourceDuration"
                    class="music-source-cycle"
                    :style="musicSourceCycleStyle(bar.item)"
                    aria-hidden="true"
                  />
                  <span class="clip-text">{{ bar.empty ? '无音乐' : bar.item.name }}</span>
                  <div class="clip-hover-mask clip-hover-mask-music">
                    <button
                      type="button"
                      class="clip-edit-btn"
                      @click.stop="openEditMusicModal"
                    >
                      <EditOutlined />
                      编辑音乐
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <a-modal
      v-model:open="subtitleModalOpen"
      title="编辑字幕"
      ok-text="确定"
      cancel-text="取消"
      wrap-class-name="create-flow-modal"
      @ok="saveSubtitle"
    >
      <div class="subtitle-edit-form">
        <div class="subtitle-edit-form-row">
          <div class="subtitle-edit-form-label">字幕内容</div>
          <a-textarea v-model:value="subtitleDraft" :rows="4" placeholder="请输入字幕内容" />
        </div>
        <div class="subtitle-edit-form-row">
          <div class="subtitle-edit-form-label">字体大小</div>
          <div class="subtitle-size-row">
            <a-slider v-model:value="subtitleFontSizeDraft" :min="20" :max="72" :step="1" />
            <span class="subtitle-size-value">{{ subtitleFontSizeDraft }}px</span>
          </div>
        </div>
      </div>
    </a-modal>

    <EditStoryboardVideoModal
      v-if="isVideoModalOpen && editingVideoClipIndex >= 0"
      :key="`preview-video-${storyboardVideoPanels[editingVideoClipIndex]?.id ?? editingVideoClipIndex}`"
      v-model:open="isVideoModalOpen"
      :scene-index="editingVideoClipIndex"
      :editor-scope-key="`preview-video-${storyboardVideoPanels[editingVideoClipIndex]?.id ?? editingVideoClipIndex}`"
      :scenes="videoScenes"
      @update="handleVideoUpdate"
    />

    <EditStoryboardDubbingModal
      v-if="isDubbingModalOpen && editingDubbingClipIndex >= 0"
      :key="`preview-dubbing-${dubbingPanelsForModal[editingDubbingClipIndex]?.id ?? editingDubbingClipIndex}`"
      v-model:open="isDubbingModalOpen"
      :scene-index="editingDubbingClipIndex"
      :editor-scope-key="`preview-dubbing-${dubbingPanelsForModal[editingDubbingClipIndex]?.id ?? editingDubbingClipIndex}`"
      :dubbing-panels="dubbingPanelsForModal"
      :storyboard-video-panels="storyboardVideoPanels"
      :storyboard-script-panels="scriptPanelsForModal"
      @update:panels="handleDubbingPanelsUpdate"
      @update:storyboard-video-panels="handleStoryboardVideoPanelsUpdate"
    />

    <MusicPickerModal
      v-if="isMusicModalOpen"
      v-model:open="isMusicModalOpen"
      :initial-music-name="activeMusicItem?.name"
      :initial-volume="activeMusicItem?.volume ?? 0.25"
      @confirm="onMusicPickerConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent, h, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  SyncOutlined,
  EyeOutlined,
  SoundOutlined,
  AudioMutedOutlined,
  EditOutlined,
  VideoCameraOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { StoryboardVideoPanel, DubbingPanel, StoryboardPanel } from '~/types'
import {
  exportEpisodeVideoFromTimeline,
  fetchEpisodeExportStatusForContext,
  EpisodeExportFollowPausedError,
  followEpisodeExportViaStatus,
  shouldKeepEpisodeExportFollowTask,
  type EpisodeVideoExportOutcome
} from '~/composables/useEpisodeVideoExport'
import { resolveEpisodeExportProgressDisplay } from '~/utils/episodeExportProgress'
import { useCreateFlowShell } from '~/composables/useCreateFlowShell'
import {
  createDebouncedTimelineSaver,
  downloadEpisodeSegmentsZipForContext,
  loadEpisodeTimeline
} from '~/composables/useEpisodeTimeline'
import { usePreviewPlayerReadyOverlay } from '~/composables/usePreviewPlayerReadyOverlay'
import {
  EPISODE_TIMELINE_REBUILD_EVENT
} from '~/utils/episodeTimelineRebuildSignal'
import { liveGenScopeKeyFromIds, useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { hasPendingReauditVideo } from '~/utils/projectAudit'
import type { MusicPickerConfirmPayload } from './MusicPickerModal.vue'

import AsyncModalLoading from '~/components/common/AsyncModalLoading.vue'
import {
  createPreloadableAsyncComponent,
  preloadComponentWhenIdle
} from '~/utils/preloadableAsyncComponent'

/** 重型编辑弹窗按需加载 + 空闲预加载，避免成片预览页点编辑时几十个 chunk 阻塞 */
const editStoryboardVideoModalLoader = createPreloadableAsyncComponent(
  () => import('./EditStoryboardVideoModal.vue'),
  AsyncModalLoading
)
const EditStoryboardVideoModal = editStoryboardVideoModalLoader.component
const editStoryboardDubbingModalLoader = createPreloadableAsyncComponent(
  () => import('./EditStoryboardDubbingModal.vue'),
  AsyncModalLoading
)
const EditStoryboardDubbingModal = editStoryboardDubbingModalLoader.component
const cancelPreviewEditModalPreloads: Array<() => void> = []
const MusicPickerModal = defineAsyncComponent(() => import('./MusicPickerModal.vue'))
import { emptyImageIconUrl } from '~/utils/emptyImageIcon'
import {
  resolvePreviewSubtitleText,
  resolvePreviewTimelineVideoUrl
} from '~/utils/storyboardVideoCover'
import { resolvePreviewPlayerPosterUrl } from '~/utils/previewPlayerPoster'
import { fetchMediaBlob } from '~/utils/mediaFetch'
import type { TimedSubtitleCue, TimelineData } from '~/types/business-api'

type TrackType = 'video' | 'voice' | 'subtitle' | 'music'
type ResizeSide = 'start' | 'end'

type TimelineBase = {
  id: string
  start: number
  duration: number
}

type TimelineVideoClip = TimelineBase & {
  kind: 'video'
  name: string
  url: string
  trimStart: number
  trimEnd: number
  sourceDuration: number
  storyboardId?: number | null
  genRecordId?: number | null
}

type TimelineAudioItem = TimelineBase & {
  kind: 'voice' | 'music'
  name: string
  url: string
  videoClipId?: string
  sourceDuration?: number
  volume: number
  fadeIn: number
  fadeOut: number
  loop: boolean
  volumeCurve: number[]
  audioRecordId?: number | null
  ttsText?: string | null
  voiceLibraryId?: number | null
  voiceModelId?: number | null
  timbreCode?: string | null
  voiceName?: string | null
}

type TimelineSubtitleItem = TimelineBase & {
  kind: 'subtitle'
  text: string
  videoClipId?: string
  fontSize: number
  cue?: TimedSubtitleCue
  sourceMediaFingerprint?: string | null
  sourceDialogueFingerprint?: string | null
  recognitionStatus?: string | null
  recognitionProvider?: string | null
  recognitionUpdatedAt?: string | null
  recognitionError?: string | null
}

const props = defineProps<{
  storyboardVideoPanels: StoryboardVideoPanel[]
  dubbingPanels: DubbingPanel[]
  bgm?: string
}>()

const route = useRoute()
const creationStore = useCreationStore()
const createFlowShell = useCreateFlowShell()
const isVideoModalOpen = ref(false)
const editingVideoClipIndex = ref(-1)
const isDubbingModalOpen = ref(false)
const editingDubbingClipIndex = ref(-1)
const isMusicModalOpen = ref(false)
const videoVolumePreset = ref<Record<string, number>>({})
const volumeHoverClipId = ref<string | null>(null)
const volumeDrag = ref<{ clipId: string; startY: number; startVolume: number; barHeight: number } | null>(null)

const timelineWrapRef = ref<HTMLElement | null>(null)
const subtitleStripRef = ref<HTMLElement | null>(null)
const canvasHostRef = ref<HTMLElement | null>(null)
const nativePreviewVideoARef = ref<HTMLVideoElement | null>(null)
const nativePreviewVideoBRef = ref<HTMLVideoElement | null>(null)
/** 双缓冲：切换分镜时互换可见层，避免单 video 改 src 黑闪 */
const nativeActiveSlot = ref<'A' | 'B'>('A')
/** 当前可见 native 槽是否已有可展示首帧 */
const nativePreviewFrameReady = ref(false)
const audioInputRef = ref<HTMLInputElement | null>(null)

const playing = ref(false)
const muted = ref(false)
const exporting = ref(false)
const exportProgressPercent = ref(0)
let exportProgressScopeKey = ''
const timelineLoading = ref(false)
const segmentsDownloading = ref(false)
const exportNeedReaudit = ref(false)
const exportPendingVideoUrl = ref('')
const exportFinalVideoUrl = ref('')
/** 最近一次从服务端加载的 timeline，保存时用于保留音色元数据 */
const serverTimelineBaseline = ref<TimelineData | null>(null)
const timelineResolution = ref('FHD')
const timelineSaver = createDebouncedTimelineSaver(2500)

/** 业务接口 reject 多为 { code, msg }，优先用后端 msg */
function exportApiErr(e: unknown, fallback: string): string {
  const x = e as { msg?: string; message?: string }
  const text = String(x?.msg || x?.message || '').trim()
  return text || fallback
}

function showEpisodeExportProgress(
  progress: { exportProgress?: number; exportStatus?: number },
  messageKey = 'export'
) {
  const currentScopeKey = liveGenScopeKeyFromIds(
    creationStore.currentProjectId,
    creationStore.currentEpisodeId
  )
  if (currentScopeKey !== exportProgressScopeKey) {
    exportProgressScopeKey = currentScopeKey
    exportProgressPercent.value = 0
  }
  const exportStatus = Number(progress.exportStatus)
  const percent = resolveEpisodeExportProgressDisplay({
    progress: progress.exportProgress,
    exportStatus,
    previousPercent: exportProgressPercent.value
  })
  exportProgressPercent.value = percent
  const label = exportStatus === 2 ? '视频合成完成，正在准备下载' : '视频合成中'
  const displayPercent = Math.floor(percent)
  // 关闭 message 默认左侧 loading（会单独占一行），改放到文案后面
  message.open({
    key: messageKey,
    type: 'loading',
    duration: 0,
    icon: h('span', { class: 'episode-export-progress-toast__hide-default-icon', 'aria-hidden': true }),
    content: h('div', { class: 'episode-export-progress-toast' }, [
      h('div', { class: 'episode-export-progress-toast__header' }, [
        h('span', { class: 'episode-export-progress-toast__label' }, [
          label,
          h(LoadingOutlined, {
            spin: true,
            class: 'episode-export-progress-toast__spin'
          })
        ]),
        h('span', { class: 'episode-export-progress-toast__percent' }, `${displayPercent}%`)
      ]),
      h(
        'div',
        {
          class: 'episode-export-progress-toast__track',
          role: 'progressbar',
          'aria-label': label,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': displayPercent
        },
        [
          h('span', {
            class: 'episode-export-progress-toast__bar',
            style: { width: `${percent}%` }
          })
        ]
      )
    ])
  })
}

function scheduleTimelinePersist() {
  if (import.meta.server) return
  if (!videoClips.value.length && !serverTimelineBaseline.value) return
  timelineSaver.schedule({
    store: creationStore,
    route,
    previousTimeline: serverTimelineBaseline.value,
    ui: {
      videoClips: videoClips.value,
      voiceItems: voiceItems.value,
      subtitleItems: subtitleItems.value,
      musicItems: musicItems.value,
      videoVolumePreset: videoVolumePreset.value,
      resolution: timelineResolution.value
    }
  })
}

function scrollTimelineToStart() {
  const wrap = timelineWrapRef.value
  if (!wrap) return
  setTimelineScrollLeft(wrap, 0)
}

function resetPlayheadToStart() {
  currentTime.value = 0
  playing.value = false
  nextTick(() => {
    scrollTimelineToStart()
    // 布局宽度可能随后续时长探测变化，再补一次滚动
    requestAnimationFrame(() => scrollTimelineToStart())
  })
}

function applyServerTimelineUi(ui: {
  videoClips: TimelineVideoClip[]
  voiceItems: TimelineAudioItem[]
  subtitleItems: TimelineSubtitleItem[]
  musicItems: TimelineAudioItem[]
  videoVolumePreset: Record<string, number>
  resolution: string
}) {
  videoClips.value = ui.videoClips as TimelineVideoClip[]
  voiceItems.value = ui.voiceItems as TimelineAudioItem[]
  subtitleItems.value = ui.subtitleItems as TimelineSubtitleItem[]
  musicItems.value = ui.musicItems as TimelineAudioItem[]
  videoVolumePreset.value = { ...ui.videoVolumePreset }
  timelineResolution.value = ui.resolution || 'FHD'
  selectedClip.value = videoClips.value[0]
    ? { track: 'video', id: videoClips.value[0]!.id }
    : null
  resetPlayheadToStart()
  preloadPreviewTimelineAudios()
  void hydrateVideoDurationsFromSource().then(() => {
    resetPlayheadToStart()
  })
  void hydrateMusicDurationsFromSource()
  void hydrateVoiceDurationsFromSource()
  scheduleRebuild('all')
}

const scalePxPerSec = 90
/** 与 .timeline-inner padding-left（--vp-timeline-label-w）同步，避免 pxtorem 小屏 rem 与 JS px 不一致 */
const trackLabelWidth = ref(72)

const videoClips = ref<TimelineVideoClip[]>([])
const voiceItems = ref<TimelineAudioItem[]>([])
const subtitleItems = ref<TimelineSubtitleItem[]>([])
const musicItems = ref<TimelineAudioItem[]>([])
const selectedClip = ref<{ track: TrackType; id: string } | null>(null)
const snapIndicatorPx = ref<number | null>(null)
const snapEnabled = ref(true)
const snapSourceMode = ref<'edges' | 'edges-playhead' | 'edges-grid'>('edges-playhead')
const snapDistancePx = ref(12)
const snapDistanceSec = computed(() => snapDistancePx.value / scalePxPerSec)
const swappingClipIds = ref<Set<string>>(new Set())

const MIN_DURATION = 0.1
/** 无分镜视频时的占位时长（秒），进度条更短便于区分 */
const EMPTY_CLIP_DURATION = 1.5
/** 有视频但尚未探测到真实时长时的初始占位 */
const VIDEO_CLIP_FALLBACK_DURATION = 5
/** 分镜块最小宽度（无视频时的占位宽度） */
const MIN_CLIP_WIDTH_PX = EMPTY_CLIP_DURATION * scalePxPerSec

const timelineStripWidthPx = ref(400)

const totalDuration = computed(() => {
  const all = [...videoClips.value, ...voiceItems.value, ...subtitleItems.value, ...musicItems.value]
  return all.reduce((max, it) => Math.max(max, it.start + it.duration), 0)
})

type ClipLayoutEntry = {
  id: string
  leftPx: number
  widthPx: number
  startSec: number
  durationSec: number
}

const clipDisplayLayout = computed(() => {
  const clips = getOrderedVideoClips()
  const n = clips.length

  if (!n) {
    const fallbackW = Math.max(400, timelineStripWidthPx.value)
    return {
      totalWidthPx: fallbackW,
      playheadScalePxPerSec: scalePxPerSec,
      entries: [] as ClipLayoutEntry[]
    }
  }

  const stripW = Math.max(200, timelineStripWidthPx.value)
  const totalDur = clips.reduce((s, c) => s + c.duration, 0) || 1
  const naturalTimeWidth = totalDur * scalePxPerSec
  const fitsInViewport = naturalTimeWidth <= stripW

  // 与字幕/音乐一致：按时间线性映射，不再叠加额外像素间隔
  const playheadScalePxPerSec = fitsInViewport ? stripW / totalDur : scalePxPerSec
  const totalWidthPx = fitsInViewport ? stripW : Math.max(stripW, naturalTimeWidth)

  const entries: ClipLayoutEntry[] = clips.map((clip) => {
    const rawW = clip.duration * playheadScalePxPerSec
    const blockWidth = hasClipVideoUrl(clip)
      ? Math.max(8, rawW)
      : Math.max(MIN_CLIP_WIDTH_PX, rawW)
    return {
      id: clip.id,
      leftPx: clip.start * playheadScalePxPerSec,
      widthPx: blockWidth,
      startSec: clip.start,
      durationSec: clip.duration
    }
  })

  return {
    totalWidthPx,
    playheadScalePxPerSec,
    entries
  }
})

const rulerWidthPx = computed(() => clipDisplayLayout.value.totalWidthPx)

type RulerMarkType = 'major' | 'medium' | 'minor'
const rulerMarks = computed(() => {
  const marks: Array<{ sec: number; type: RulerMarkType }> = []
  const maxSec = Math.max(1, Math.ceil(totalDuration.value))
  const step = scalePxPerSec >= 60 ? 0.2 : scalePxPerSec >= 30 ? 0.5 : 1
  for (let t = 0; t <= maxSec + 0.001; t += step) {
    const sec = Number(t.toFixed(2))
    const isMajor = Math.abs(sec % 5) < 0.001 || (sec === 0)
    const isMedium = !isMajor && Math.abs(sec % 1) < 0.001
    marks.push({ sec, type: isMajor ? 'major' : isMedium ? 'medium' : 'minor' })
  }
  return marks
})

const rulerMarksWithLayout = computed(() =>
  rulerMarks.value.map((mark) => ({
    ...mark,
    leftPx: secToLayoutPx(mark.sec)
  }))
)

const videoScenes = computed(() => {
  const scriptPanels = (creationStore.formData.storyboardScript?.panels || []) as StoryboardPanel[]
  return props.storyboardVideoPanels.map((panel, i) => {
    const byIndex = scriptPanels[i]
    const sid = Number(byIndex?.id)
    const sp =
      Number.isFinite(sid) && sid > 0
        ? scriptPanels.find((s) => Number(s.id) === sid) || byIndex
        : byIndex
    return {
      name: panel.title,
      videos: Array.isArray(panel.videos) ? panel.videos.map((v) => ({ ...v })) : [],
      scriptContent: sp?.scriptContent ?? '',
      scriptPanelTitle: sp?.title ?? panel.title,
      storyboardId: Number.isFinite(Number(sp?.id)) ? Number(sp?.id) : undefined,
      storyboardImages: Array.isArray(sp?.images) ? sp.images.map((img: any) => ({ ...img })) : []
    }
  })
})

const dubbingPanelsForModal = computed(() => {
  const panels = creationStore.formData.dubbing?.panels
  return Array.isArray(panels) && panels.length ? panels : props.dubbingPanels || []
})

const scriptPanelsForModal = computed(
  () => (creationStore.formData.storyboardScript?.panels || []) as StoryboardPanel[]
)

const currentTime = ref(0)
const playheadLeftPx = computed(() => trackLabelWidth.value + secToPlayheadPx(currentTime.value))
const scrubbing = ref(false)
const scrubClientX = ref<number | null>(null)
const autoFollowEnabled = ref(true)
let autoFollowResumeTimer: number | null = null
let suppressScrollFollowPause = false
let programmaticScrollLockUntil = 0
const selectedVideoClip = computed(() => {
  if (selectedClip.value?.track !== 'video') return null
  return videoClips.value.find((x) => x.id === selectedClip.value?.id) || null
})
const missingVoiceSlots = computed(() => {
  const hasVoice = new Set(voiceItems.value.map((item) => item.videoClipId).filter(Boolean) as string[])
  return videoClips.value.filter((clip) => !hasVoice.has(clip.id))
})

const activeMusicItem = computed(() => musicItems.value[0] || null)

const musicDisplayBars = computed(() => {
  const total = Math.max(MIN_DURATION, getVideoTimelineTotalSec())
  if (musicItems.value.length > 0) {
    return musicItems.value.map((item) => ({ key: item.id, item, empty: false }))
  }
  if (!videoClips.value.length) return []
  return [
    {
      key: 'music-empty',
      item: {
        id: 'music-empty',
        kind: 'music' as const,
        name: '无音乐',
        url: '',
        start: 0,
        duration: total,
        volume: 0.25,
        fadeIn: 0,
        fadeOut: 0,
        loop: true,
        volumeCurve: [0.25, 0.25, 0.25]
      },
      empty: true
    }
  ]
})
const missingSubtitleSlots = computed(() => {
  const hasSubtitle = new Set(subtitleItems.value.map((item) => item.videoClipId).filter(Boolean) as string[])
  return videoClips.value.filter((clip) => !hasSubtitle.has(clip.id))
})

function getOrderedVideoClips() {
  return [...videoClips.value].sort((a, b) => a.start - b.start)
}

function getVideoClipGapIndex(seg: { id?: string; videoClipId?: string; start: number }, gapIndex?: number) {
  if (gapIndex !== undefined) return gapIndex
  if (seg.id) {
    const idx = getOrderedVideoClips().findIndex((c) => c.id === seg.id)
    if (idx >= 0) return idx
  }
  if (seg.videoClipId) {
    const idx = getOrderedVideoClips().findIndex((c) => c.id === seg.videoClipId)
    if (idx >= 0) return idx
  }
  const sorted = getOrderedVideoClips()
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (seg.start >= sorted[i].start - 0.001) return i
  }
  return 0
}

function secToPlayheadPx(sec: number): number {
  const scale = clipDisplayLayout.value.playheadScalePxPerSec || scalePxPerSec
  return Math.max(0, sec * scale)
}

function playheadPxToSec(px: number): number {
  const scale = clipDisplayLayout.value.playheadScalePxPerSec || scalePxPerSec
  if (!scale) return 0
  return Math.max(0, px / scale)
}

function secToLayoutPx(sec: number): number {
  return secToPlayheadPx(sec)
}

function layoutPxToSec(px: number): number {
  return playheadPxToSec(px)
}

function setTimelineScrollLeft(wrap: HTMLElement, value: number) {
  programmaticScrollLockUntil = performance.now() + 120
  suppressScrollFollowPause = true
  wrap.scrollLeft = value
  requestAnimationFrame(() => {
    suppressScrollFollowPause = false
  })
}

function clipStyle(
  seg: { start: number; duration: number; id?: string; videoClipId?: string },
  _gapIndex?: number
) {
  const layout = clipDisplayLayout.value
  // 始终按 id 取布局条目，避免用 v-for index 错位（音量轨曾因此与字幕不一致）
  const idx = getVideoClipGapIndex(seg)
  const entry = layout.entries[idx]
  if (!entry) {
    const leftPx = secToPlayheadPx(seg.start)
    const widthPx = Math.max(8, secToPlayheadPx(seg.start + seg.duration) - leftPx)
    return { left: `${leftPx}px`, width: `${widthPx}px` }
  }

  const clipEndSec = entry.startSec + entry.durationSec
  const segEnd = seg.start + seg.duration
  const isFullClip =
    Math.abs(seg.start - entry.startSec) < 0.02 && Math.abs(segEnd - clipEndSec) < 0.02

  if (isFullClip) {
    return {
      left: entry.leftPx + 'px',
      width: Math.max(8, entry.widthPx) + 'px'
    }
  }

  const leftPx = secToPlayheadPx(seg.start)
  const widthPx = Math.max(8, secToPlayheadPx(segEnd) - secToPlayheadPx(seg.start))
  return {
    left: leftPx + 'px',
    width: widthPx + 'px'
  }
}

function musicClipStyle(item: TimelineAudioItem) {
  const leftPx = secToLayoutPx(item.start)
  const rightPx = secToLayoutPx(item.start + item.duration)
  return {
    left: leftPx + 'px',
    width: Math.max(8, rightPx - leftPx) + 'px'
  }
}

function musicBarStyle(item: TimelineAudioItem, empty: boolean) {
  if (empty) {
    const total = Math.max(MIN_DURATION, getVideoTimelineTotalSec())
    return {
      left: '0px',
      width: Math.max(8, secToLayoutPx(total)) + 'px'
    }
  }
  return musicClipStyle(item)
}

function musicSourceCycleStyle(item: TimelineAudioItem) {
  const source = item.sourceDuration || item.duration
  if (!source || !item.duration) return { width: '100%' }
  const ratio = Math.min(1, source / item.duration)
  return { width: `${(ratio * 100).toFixed(2)}%` }
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getClipPageLabel(index: number) {
  const total = videoClips.value.length
  return `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`
}

function hasClipVideoUrl(clip: Pick<TimelineVideoClip, 'url'>) {
  return !!String(clip.url || '').trim()
}

function getVideoClipAtTime(timeSec: number): TimelineVideoClip | null {
  const t = Number(timeSec.toFixed(3))
  const ordered = getOrderedVideoClips()
  for (let i = 0; i < ordered.length; i++) {
    const clip = ordered[i]!
    const end = clip.start + clip.duration
    const isLast = i === ordered.length - 1
    if (t >= clip.start - 0.001 && (t < end - 0.001 || (isLast && t <= end + 0.001))) {
      return clip
    }
  }
  return null
}

function hasPlayableVideoAtTime(timeSec: number): boolean {
  const clip = getVideoClipAtTime(timeSec)
  return !!clip && hasClipVideoUrl(clip)
}

function getNextPlayableClip(afterClip: TimelineVideoClip | null): TimelineVideoClip | null {
  const clips = getOrderedVideoClips()
  if (!clips.length) return null
  const startIdx = afterClip ? clips.findIndex((c) => c.id === afterClip.id) : -1
  for (let i = startIdx + 1; i < clips.length; i++) {
    const clip = clips[i]!
    if (hasClipVideoUrl(clip)) return clip
  }
  return null
}

function findNextPlayableClipStart(fromSec: number): number | null {
  const t = Number(fromSec.toFixed(3))
  for (const clip of getOrderedVideoClips()) {
    if (!hasClipVideoUrl(clip)) continue
    const end = clip.start + clip.duration
    if (end > t + 0.005) {
      return Number(Math.max(clip.start, t).toFixed(3))
    }
  }
  return null
}

/** 时间轴上最后一个可播放分镜的结束时间 */
function getFullTimelinePlayableEndSec(): number {
  const clips = getOrderedVideoClips()
  let endSec = 0
  for (const clip of clips) {
    if (hasClipVideoUrl(clip)) {
      endSec = clip.start + clip.duration
    }
  }
  return Number(endSec.toFixed(3)) || totalDuration.value
}

function refreshPreviewPlayEndSec(_fromSec: number) {
  previewPlayEndSec = getFullTimelinePlayableEndSec()
}

const nativePreviewVideoUrl = computed(() => {
  const clip = getVideoClipAtTime(currentTime.value) || selectedVideoClip.value
  if (clip && hasClipVideoUrl(clip)) return clip.url
  return ''
})

const showNativePreviewVideo = computed(() => {
  if (!videoClips.value.length) return false
  return hasPlayableVideoAtTime(currentTime.value)
})

const showNoVideoOverlay = computed(() => {
  if (!videoClips.value.length) return false
  return !hasPlayableVideoAtTime(currentTime.value)
})

const activeSubtitleText = computed(() => {
  const t = currentTime.value
  const sub = subtitleItems.value.find(
    (s) => s.text?.trim() && t >= s.start && t < s.start + s.duration
  )
  return sub?.text?.trim() || ''
})

async function ensurePreviewAtCurrentTime() {
  if (!videoClips.value.length) return
  if (!avCanvas) await rebuildCanvas()
  if (hasPlayableVideoAtTime(currentTime.value)) {
    avCanvas?.previewFrame?.(Math.round(currentTime.value * 1_000_000))
    await nextTick()
    syncNativePreviewVideoTime()
  }
}

let previewPlayRaf: number | null = null
let previewPlayStartedAt = 0
let previewPlayStartSec = 0
/** 当前播放允许到达的最远时间点（连续有视频分镜段的末尾） */
let previewPlayEndSec = 0
const previewAudioEls = new Map<string, HTMLAudioElement>()
const previewVideoPreloads = new Map<string, HTMLVideoElement>()
/** 各缓冲槽已加载的视频 URL */
let slotSrcA = ''
let slotSrcB = ''
/** 当前正在显示的分镜 id */
let activeNativeClipId = ''
/** 待命缓冲已为哪个分镜准备好（可无缝切换） */
let standbyPreparedClipId = ''
let standbyPrepareToken = 0

function getActiveNativeEl(): HTMLVideoElement | null {
  return nativeActiveSlot.value === 'A' ? nativePreviewVideoARef.value : nativePreviewVideoBRef.value
}

function getStandbyNativeEl(): HTMLVideoElement | null {
  return nativeActiveSlot.value === 'A' ? nativePreviewVideoBRef.value : nativePreviewVideoARef.value
}

function getSlotSrc(slot: 'A' | 'B') {
  return slot === 'A' ? slotSrcA : slotSrcB
}

function setSlotSrc(slot: 'A' | 'B', url: string) {
  if (slot === 'A') slotSrcA = url
  else slotSrcB = url
}

function preloadVideoUrl(url: string, mode: 'metadata' | 'auto' = 'metadata') {
  const normalized = String(url || '').trim()
  if (!normalized) return
  const existing = previewVideoPreloads.get(normalized)
  if (existing) {
    if (mode === 'auto' && existing.preload !== 'auto') {
      existing.preload = 'auto'
      try {
        existing.load()
      } catch {}
    }
    return
  }
  const el = document.createElement('video')
  // 默认只拉元数据，避免与正在播放的分镜抢带宽
  el.preload = mode
  el.muted = true
  el.playsInline = true
  el.src = normalized
  try {
    el.load()
  } catch {}
  previewVideoPreloads.set(normalized, el)
}

function preloadAdjacentClips(clip: TimelineVideoClip | null) {
  if (!clip) return
  preloadVideoUrl(clip.url, 'metadata')
  const next = getNextPlayableClip(clip)
  if (next) preloadVideoUrl(next.url, 'metadata')
}

function waitVideoReady(el: HTMLVideoElement, timeoutMs = 4000): Promise<boolean> {
  if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve(true)
  return new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      el.removeEventListener('canplay', onReady)
      el.removeEventListener('loadeddata', onReady)
      el.removeEventListener('error', onErr)
      window.clearTimeout(timer)
      resolve(ok)
    }
    const onReady = () => done(true)
    const onErr = () => done(false)
    const timer = window.setTimeout(() => done(el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA), timeoutMs)
    el.addEventListener('canplay', onReady)
    el.addEventListener('loadeddata', onReady)
    el.addEventListener('error', onErr)
  })
}

async function loadUrlOntoVideoEl(
  el: HTMLVideoElement,
  slot: 'A' | 'B',
  url: string,
  seekTo = 0
): Promise<boolean> {
  const normalized = String(url || '').trim()
  if (!normalized) return false
  preloadVideoUrl(normalized, 'auto')
  const current = getSlotSrc(slot)
  if (current !== normalized) {
    setSlotSrc(slot, normalized)
    el.src = normalized
    try {
      el.load()
    } catch {}
  }
  const ready = await waitVideoReady(el)
  if (!ready) return false
  try {
    const target = Math.max(0, seekTo)
    if (Number.isFinite(el.duration) && el.duration > 0) {
      el.currentTime = Math.min(target, Math.max(0, el.duration - 0.05))
    } else {
      el.currentTime = target
    }
  } catch {}
  return true
}

/** 仅在切镜前短窗口内预载下一分镜，避免播放中全程抢带宽 */
async function prepareStandbyForClip(clip: TimelineVideoClip | null) {
  if (!clip || !hasClipVideoUrl(clip)) return
  const standby = getStandbyNativeEl()
  if (!standby) return
  if (standbyPreparedClipId === clip.id && standby.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return
  }
  const token = ++standbyPrepareToken
  const slot: 'A' | 'B' = nativeActiveSlot.value === 'A' ? 'B' : 'A'
  const seekTo = Math.max(0, Number(clip.trimStart) || 0)
  const ok = await loadUrlOntoVideoEl(standby, slot, clip.url, seekTo)
  if (token !== standbyPrepareToken) return
  if (ok) standbyPreparedClipId = clip.id
}

async function ensureActiveNativeVideoSrc(url: string, seekTo = 0) {
  const el = getActiveNativeEl()
  if (!el) return
  const slot = nativeActiveSlot.value
  await loadUrlOntoVideoEl(el, slot, url, seekTo)
  refreshNativePreviewFrameReady()
}

function refreshNativePreviewFrameReady() {
  const el = getActiveNativeEl()
  nativePreviewFrameReady.value =
    !!el && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
}

function onNativePreviewMediaReady() {
  syncNativePreviewVideoTime()
  refreshNativePreviewFrameReady()
}

function mapVolumeToGain(vol: number) {
  return Math.max(0, Math.min(1, vol / 2))
}

type PreviewAudioEl = HTMLAudioElement & { _aidUrl?: string; _aidPlayFailed?: boolean }

function getPreviewAudioEl(id: string, url: string) {
  let el = previewAudioEls.get(id) as PreviewAudioEl | undefined
  if (!el) {
    el = new Audio() as PreviewAudioEl
    el.preload = 'auto'
    // 不设 crossOrigin：部分 CDN 未回 CORS 头时会导致配音完全无法加载
    previewAudioEls.set(id, el)
  }
  // 勿用 el.src（浏览器会解析成绝对地址）与入参直接比较，否则每帧重置 src 导致配音播不起来
  if (el._aidUrl !== url) {
    el._aidUrl = url
    el._aidPlayFailed = false
    el.src = url
    try {
      el.load()
    } catch {
      /* ignore */
    }
  }
  return el
}

/** 时间轴音频音量多为 0~1；兼容音量条 0~2 */
function mapTimelineAudioGain(vol: number) {
  if (!Number.isFinite(vol)) return 1
  if (vol <= 1) return Math.max(0, Math.min(1, vol))
  return Math.max(0, Math.min(1, vol / 2))
}

function resolveAudioPlayableDuration(
  item: { sourceDuration?: number; duration: number },
  audio: HTMLAudioElement
): number {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration
  const src = Number(item.sourceDuration)
  // 过小的 sourceDuration 多为脏数据（曾把 0 写成 0.1），回落轨道时长
  if (Number.isFinite(src) && src > 0.5) return src
  return Math.max(0.1, Number(item.duration) || 0.1)
}

function stopAllPreviewAudios() {
  for (const el of previewAudioEls.values()) {
    try {
      el.pause()
    } catch {}
  }
}

function playPreviewAudioEl(audio: PreviewAudioEl) {
  if (!audio.paused) return
  const p = audio.play()
  if (p && typeof p.then === 'function') {
    void p.then(() => {
      audio._aidPlayFailed = false
    }).catch(() => {
      audio._aidPlayFailed = true
    })
  }
}

function preloadPreviewTimelineAudios() {
  for (const voice of voiceItems.value) {
    if (!voice.url) continue
    getPreviewAudioEl(`voice-${voice.id}`, voice.url)
  }
  for (const music of musicItems.value) {
    if (!music.url) continue
    getPreviewAudioEl(`music-${music.id}`, music.url)
  }
}

async function hydrateVoiceDurationsFromSource() {
  let subtitleChanged = false
  for (const voice of voiceItems.value) {
    if (!voice.url) continue
    const probed = await probeAudioDuration(voice.url)
    if (probed > 0.5) {
      voice.sourceDuration = probed
    } else if (!(Number(voice.sourceDuration) > 0.5)) {
      voice.sourceDuration = Math.max(0.1, voice.duration)
    }
    subtitleChanged = syncUntimedSubtitleToVoiceDuration(voice) || subtitleChanged
  }
  if (subtitleChanged) {
    scheduleRebuild('all')
    scheduleTimelinePersist()
  }
}

function syncUntimedSubtitleToVoiceDuration(voice: TimelineAudioItem): boolean {
  if (!voice.videoClipId) return false
  const clip = videoClips.value.find((item) => item.id === voice.videoClipId)
  if (!clip) return false
  const voiceDuration = Number(voice.sourceDuration)
  if (!Number.isFinite(voiceDuration) || voiceDuration <= 0.5) return false
  let changed = false
  subtitleItems.value.forEach((sub) => {
    if (sub.videoClipId !== voice.videoClipId || sub.cue) return
    const nextStart = clip.start
    const nextDuration = resolveUntimedSubtitleDuration(clip, voice)
    if (Math.abs(sub.start - nextStart) > 0.01 || Math.abs(sub.duration - nextDuration) > 0.01) {
      sub.start = nextStart
      sub.duration = nextDuration
      changed = true
    }
  })
  return changed
}

function resolveUntimedSubtitleDuration(clip: TimelineVideoClip, voice?: TimelineAudioItem): number {
  const voiceDuration = Number(voice?.sourceDuration)
  const duration = Number.isFinite(voiceDuration) && voiceDuration > 0.5
    ? Math.min(clip.duration, voiceDuration)
    : clip.duration
  return Math.max(MIN_DURATION, Number(duration.toFixed(2)))
}

function syncPreviewAudios() {
  const t = currentTime.value
  const shouldPlay = playing.value && !muted.value

  for (const voice of voiceItems.value) {
    if (!voice.url) continue
    const audio = getPreviewAudioEl(`voice-${voice.id}`, voice.url)
    audio.volume = mapTimelineAudioGain(voice.volume ?? 1)
    const inRange = t >= voice.start && t < voice.start + voice.duration
    if (shouldPlay && inRange) {
      const playableDur = resolveAudioPlayableDuration(voice, audio)
      const offset = t - voice.start
      const metaReady = Number.isFinite(audio.duration) && audio.duration > 0
      // 元数据就绪后才按真实音频时长截断；未就绪时先播，避免被错误的 0.1s sourceDuration 卡死
      if (metaReady && offset >= playableDur) {
        if (!audio.paused) audio.pause()
        continue
      }
      if (metaReady && Math.abs(audio.currentTime - Math.min(offset, playableDur)) > 0.25) {
        try {
          audio.currentTime = Math.max(0, Math.min(offset, Math.max(0, playableDur - 0.05)))
        } catch {
          /* ignore */
        }
      }
      playPreviewAudioEl(audio)
    } else if (!audio.paused) {
      audio.pause()
    }
  }

  for (const music of musicItems.value) {
    if (!music.url) continue
    const audio = getPreviewAudioEl(`music-${music.id}`, music.url)
    audio.volume = mapTimelineAudioGain(music.volume ?? 1)
    const inRange = t >= music.start && t < music.start + music.duration
    if (shouldPlay && inRange) {
      const playableDur = resolveAudioPlayableDuration(music, audio)
      let offset = t - music.start
      if (music.loop && playableDur > 0) {
        offset = offset % playableDur
      } else {
        offset = Math.max(0, Math.min(offset, playableDur))
      }
      const metaReady = Number.isFinite(audio.duration) && audio.duration > 0
      if (metaReady && Math.abs(audio.currentTime - offset) > 0.25) {
        try {
          audio.currentTime = Math.max(0, offset)
        } catch {
          /* ignore */
        }
      }
      playPreviewAudioEl(audio)
    } else if (!audio.paused) {
      audio.pause()
    }
  }
}

function applyNativeVideoVolume(el: HTMLVideoElement, clip: TimelineVideoClip) {
  const voice = getVoiceItemForVideoClip(clip.id)
  const vol = getVideoVolume(clip.id)
  const voiceUrl = String(voice?.url || '').trim()
  const voiceAudio = voiceUrl
    ? (previewAudioEls.get(`voice-${voice!.id}`) as PreviewAudioEl | undefined)
    : undefined
  // 有独立配音时视频原声静音，改走 Audio 轨；配音播放失败则回退视频声道（compose 成片可能已含配音）
  const voiceFailed = !!voiceAudio?._aidPlayFailed
  const muteForVoice = !!voiceUrl && !voiceFailed
  el.muted = muted.value || muteForVoice
  if (!muteForVoice) el.volume = muted.value ? 0 : mapVolumeToGain(vol)
}

/** 播放中由视频时钟驱动时间轴；切镜前 ~0.8s 才预载下一分镜 */
const STANDBY_PREPARE_REMAIN_SEC = 0.85
/** 播放中仅在漂移过大时纠偏，避免频繁 seek 把播放头拽进未缓冲区 */
const PLAYING_SEEK_DRIFT_SEC = 0.4

function syncNativePreviewVideoTime() {
  const clip = getVideoClipAtTime(currentTime.value)
  if (!clip || !hasClipVideoUrl(clip)) return

  const offset = Math.max(0, currentTime.value - clip.start + (clip.trimStart || 0))
  const clipEnd = clip.start + clip.duration
  const remain = clipEnd - currentTime.value
  const nearClipEnd = remain <= STANDBY_PREPARE_REMAIN_SEC
  const nextClip = getNextPlayableClip(clip)

  // 只在临近切镜时预载待命层（勿在整个播放过程中抢带宽）
  if (nextClip && nearClipEnd) {
    void prepareStandbyForClip(nextClip)
  }

  if (activeNativeClipId !== clip.id) {
    const standby = getStandbyNativeEl()
    const canSeamlessSwap =
      !!standby &&
      standbyPreparedClipId === clip.id &&
      standby.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA

    if (canSeamlessSwap && standby) {
      applyNativeVideoVolume(standby, clip)
      try {
        const seekTo = Math.max(0, Number(clip.trimStart) || 0)
        if (Number.isFinite(standby.duration) && standby.duration > 0) {
          standby.currentTime = Math.min(seekTo, Math.max(0, standby.duration - 0.05))
        } else {
          standby.currentTime = seekTo
        }
      } catch {}
      const prev = getActiveNativeEl()
      nativeActiveSlot.value = nativeActiveSlot.value === 'A' ? 'B' : 'A'
      activeNativeClipId = clip.id
      standbyPreparedClipId = ''
      nativePreviewFrameReady.value = true
      if (playing.value) {
        standby.play().catch(() => {})
      } else {
        try {
          standby.pause()
        } catch {}
      }
      if (prev && prev !== standby) {
        try {
          prev.pause()
        } catch {}
      }
      return
    }

    activeNativeClipId = clip.id
    standbyPreparedClipId = ''
    nativePreviewFrameReady.value = false
    void ensureActiveNativeVideoSrc(clip.url, offset).then(() => {
      const el = getActiveNativeEl()
      if (!el || activeNativeClipId !== clip.id) return
      applyNativeVideoVolume(el, clip)
      refreshNativePreviewFrameReady()
      if (playing.value && el.paused) el.play().catch(() => {})
    })
    return
  }

  const el = getActiveNativeEl()
  if (!el) return
  applyNativeVideoVolume(el, clip)

  try {
    if (playing.value) {
      // 播放中让 video 自然播，仅纠正明显漂移；禁止每帧 seek
      if (!el.seeking && Number.isFinite(el.duration) && el.duration > 0) {
        const target = Math.min(offset, Math.max(0, el.duration - 0.05))
        if (Math.abs(el.currentTime - target) > PLAYING_SEEK_DRIFT_SEC) {
          el.currentTime = target
        }
      }
      if (el.paused) el.play().catch(() => {})
    } else {
      const syncThreshold = 0.08
      if (Number.isFinite(el.duration) && el.duration > 0) {
        const target = Math.min(offset, Math.max(0, el.duration - 0.05))
        if (Math.abs(el.currentTime - target) > syncThreshold) el.currentTime = target
      } else if (Math.abs(el.currentTime - offset) > syncThreshold) {
        el.currentTime = offset
      }
      if (!el.paused) el.pause()
    }
  } catch {}
}

function finishPreviewPlayback() {
  stopPreviewPlaybackLoop()
  stopAllPreviewAudios()
  const el = getActiveNativeEl()
  if (el) {
    try {
      el.pause()
    } catch {}
  }
  const standby = getStandbyNativeEl()
  if (standby) {
    try {
      standby.pause()
    } catch {}
  }
  playing.value = false
}

function stopPreviewPlaybackLoop() {
  if (previewPlayRaf !== null) {
    cancelAnimationFrame(previewPlayRaf)
    previewPlayRaf = null
  }
}

function anchorPreviewPlayClock(atSec: number) {
  previewPlayStartSec = atSec
  previewPlayStartedAt = performance.now()
}

/**
 * 播放头优先跟当前分镜 video.currentTime：
 * 缓冲卡住时时间轴停住，播完再进入下一分镜，避免「画面冻住、分割线继续跑」。
 */
function resolvePlaybackTimelineSec(wallNext: number, maxSec: number): number {
  const clip = getVideoClipAtTime(currentTime.value) || getVideoClipAtTime(wallNext)
  const el = getActiveNativeEl()
  if (!clip || !hasClipVideoUrl(clip) || !el || activeNativeClipId !== clip.id) {
    return Math.min(maxSec, wallNext)
  }

  const trim = Math.max(0, Number(clip.trimStart) || 0)
  const clipEnd = clip.start + clip.duration
  const mediaDur =
    Number.isFinite(el.duration) && el.duration > 0 ? el.duration : clip.sourceDuration || clip.duration

  // 等数据 / 正在 seek：钉住时间轴
  if (el.seeking || el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    anchorPreviewPlayClock(currentTime.value)
    return currentTime.value
  }

  // 解码卡住（有当前帧但几乎无未来数据）且未结束：等待缓冲
  if (
    !el.ended &&
    el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA &&
    el.networkState === HTMLMediaElement.NETWORK_LOADING
  ) {
    anchorPreviewPlayClock(currentTime.value)
    return currentTime.value
  }

  const videoBased = clip.start + Math.max(0, el.currentTime - trim)

  // 媒体已到片尾：推到该分镜时间轴终点，触发切镜
  if (el.ended || el.currentTime >= mediaDur - 0.06) {
    const endAt = Math.min(maxSec, clipEnd)
    anchorPreviewPlayClock(endAt)
    return endAt
  }

  const next = Math.min(maxSec, clipEnd, Math.max(clip.start, videoBased))
  anchorPreviewPlayClock(next)
  return next
}

function startPreviewPlaybackLoop() {
  stopPreviewPlaybackLoop()
  anchorPreviewPlayClock(currentTime.value)
  refreshPreviewPlayEndSec(previewPlayStartSec)
  const startClip = getVideoClipAtTime(previewPlayStartSec)
  preloadAdjacentClips(startClip)
  // 不在开播时全量加载下一分镜，避免与当前片抢带宽

  const tick = () => {
    if (!playing.value) {
      previewPlayRaf = null
      return
    }
    const elapsed = (performance.now() - previewPlayStartedAt) / 1000
    const maxSec = Math.min(totalDuration.value, previewPlayEndSec)
    let wallNext = Math.min(maxSec, previewPlayStartSec + elapsed)
    let next = resolvePlaybackTimelineSec(wallNext, maxSec)

    if (!hasPlayableVideoAtTime(next)) {
      const skipTo = findNextPlayableClipStart(next)
      if (skipTo !== null && skipTo < maxSec - 0.01) {
        anchorPreviewPlayClock(skipTo)
        next = skipTo
        preloadAdjacentClips(getVideoClipAtTime(skipTo))
      }
    }

    currentTime.value = Number(next.toFixed(3))
    followPlayheadSmoothly()
    syncNativePreviewVideoTime()
    syncPreviewAudios()

    if (next >= maxSec - 0.02) {
      currentTime.value = Number(maxSec.toFixed(3))
      finishPreviewPlayback()
      return
    }
    previewPlayRaf = requestAnimationFrame(tick)
  }
  previewPlayRaf = requestAnimationFrame(tick)
}

function getInitialClipDuration(url: string) {
  return hasClipVideoUrl({ url }) ? VIDEO_CLIP_FALLBACK_DURATION : EMPTY_CLIP_DURATION
}

function applyClipTimelineDuration(clip: TimelineVideoClip, duration: number) {
  const d = Math.max(MIN_DURATION, Number(duration.toFixed(2)))
  clip.sourceDuration = d
  clip.duration = d
  clip.trimStart = 0
  clip.trimEnd = d
}

function openEditVideoModalForClip(clipId: string) {
  const panelIdx = props.storyboardVideoPanels.findIndex((p) => p.id === clipId)
  if (panelIdx < 0) {
    const clipIdx = videoClips.value.findIndex((c) => c.id === clipId)
    if (clipIdx >= 0 && clipIdx < props.storyboardVideoPanels.length) {
      editingVideoClipIndex.value = clipIdx
    } else {
      message.warning('该片段暂无关联分镜，请先从前面步骤同步')
      return
    }
  } else {
    editingVideoClipIndex.value = panelIdx
  }
  stopPlayback()
  isVideoModalOpen.value = true
}

function handleVideoUpdate(sceneIndex: number, data: { name?: string; videos?: any[]; scriptContent?: string; scriptTitle?: string }) {
  if (sceneIndex < 0 || sceneIndex >= props.storyboardVideoPanels.length) return
  const panels = [...creationStore.formData.storyboardVideo.panels]
  const prev = panels[sceneIndex]
  if (!prev) return
  panels[sceneIndex] = {
    ...prev,
    title: data.name ?? prev.title,
    videos: data.videos ?? prev.videos
  }
  creationStore.formData.storyboardVideo.panels = panels

  const clip = videoClips.value[sceneIndex] || videoClips.value.find((c) => c.id === panels[sceneIndex]?.id)
  if (clip) {
    clip.name = panels[sceneIndex].title
    const dub = props.dubbingPanels?.[sceneIndex]
    const nextUrl = resolvePreviewTimelineVideoUrl(dub, panels[sceneIndex])
    if (nextUrl) {
      clip.url = nextUrl
      void hydrateVideoDurationsFromSource()
    } else {
      clip.url = ''
      applyClipTimelineDuration(clip, EMPTY_CLIP_DURATION)
      relayoutVideoTrackAndLinkedTracks()
      scheduleRebuild('video')
    }
  }
}

function resolveDubbingPanelIndex(clipId: string): number {
  const panels = dubbingPanelsForModal.value
  const byPanel = panels.findIndex((p) => p.id === clipId)
  if (byPanel >= 0) return byPanel
  const clipIdx = videoClips.value.findIndex((c) => c.id === clipId)
  if (clipIdx >= 0 && clipIdx < panels.length) return clipIdx
  return -1
}

function openEditDubbingModalForClip(clipId: string) {
  const panelIdx = resolveDubbingPanelIndex(clipId)
  if (panelIdx < 0) {
    message.warning('未找到对应配音分镜，请先从前面步骤同步')
    return
  }
  const panels = dubbingPanelsForModal.value
  if (creationStore.formData.dubbing) {
    creationStore.formData.dubbing.panels = panels.map((p) => ({ ...p }))
  }
  editingDubbingClipIndex.value = panelIdx
  stopPlayback()
  isDubbingModalOpen.value = true
}

function applyDubbingPanelToTimeline(index: number, dub: DubbingPanel): boolean {
  const clip = videoClips.value.find((c) => c.id === dub.id) || videoClips.value[index]
  if (!clip) return false

  clip.name = dub.title || clip.name

  const vPanel = props.storyboardVideoPanels[index]
  const nextVideoUrl = resolvePreviewTimelineVideoUrl(dub, vPanel)
  let videoUrlChanged = false
  if (nextVideoUrl && nextVideoUrl !== clip.url) {
    clip.url = nextVideoUrl
    videoUrlChanged = true
  }

  const presetVol = getVideoVolume(clip.id)
  const voiceUrl = dub.dubbingUploadedAudioUrl?.trim()
  const voice = voiceItems.value.find((v) => v.videoClipId === clip.id)
  if (voiceUrl) {
    if (voice) {
      if (voice.url !== voiceUrl) voice.sourceDuration = undefined
      voice.url = voiceUrl
      voice.name = dub.title || voice.name
      voice.start = clip.start
      voice.duration = Math.max(MIN_DURATION, Number(clip.duration.toFixed(2)))
    } else {
      voiceItems.value.push({
        id: `voice-${clip.id}`,
        kind: 'voice',
        name: dub.title || `配音 ${index + 1}`,
        url: voiceUrl,
        videoClipId: clip.id,
        start: clip.start,
        duration: Math.max(MIN_DURATION, Number(clip.duration.toFixed(2))),
        volume: presetVol,
        fadeIn: 0,
        fadeOut: 0,
        loop: false,
        volumeCurve: [presetVol, presetVol, presetVol]
      })
    }
  }

  const subtitleText = resolvePreviewSubtitleText(dub)
  const sub = subtitleItems.value.find((s) => s.videoClipId === clip.id && !s.cue)
  const hasTimedSubtitle = subtitleItems.value.some((s) => s.videoClipId === clip.id && s.cue)
  if (hasTimedSubtitle && sub?.id === `sub-${clip.id}`) {
    subtitleItems.value = subtitleItems.value.filter((item) => item.id !== sub.id)
  } else if (subtitleText && !hasTimedSubtitle) {
    const linkedVoice = voiceItems.value.find((v) => v.videoClipId === clip.id)
    const subtitleDuration = resolveUntimedSubtitleDuration(clip, linkedVoice)
    if (sub) {
      sub.text = subtitleText
      sub.start = clip.start
      sub.duration = subtitleDuration
    } else {
      subtitleItems.value.push({
        id: `sub-${clip.id}`,
        kind: 'subtitle',
        text: subtitleText,
        fontSize: 40,
        videoClipId: clip.id,
        start: clip.start,
        duration: subtitleDuration
      })
    }
  } else if (!subtitleText && sub?.id === `sub-${clip.id}`) {
    subtitleItems.value = subtitleItems.value.filter((item) => item.id !== sub.id)
  } else if (!subtitleText && sub) {
    sub.text = ''
  }

  return videoUrlChanged
}

function handleDubbingPanelsUpdate(next: DubbingPanel[]) {
  const cloned = next.map((p) => ({ ...p }))
  creationStore.formData.dubbing.panels = cloned
  let needsHydrate = false
  cloned.forEach((panel, index) => {
    if (applyDubbingPanelToTimeline(index, panel)) needsHydrate = true
  })
  if (needsHydrate) {
    void hydrateVideoDurationsFromSource()
  } else {
    relayoutVideoTrackAndLinkedTracks()
    scheduleRebuild('all')
  }
  if (voiceItems.value.some((voice) => voice.url)) {
    void hydrateVoiceDurationsFromSource()
  }
}

function handleStoryboardVideoPanelsUpdate(next: StoryboardVideoPanel[]) {
  creationStore.formData.storyboardVideo.panels = next.map((p) => ({ ...p }))
  next.forEach((panel, index) => {
    const clip = videoClips.value[index] || videoClips.value.find((c) => c.id === panel.id)
    if (!clip) return
    const dub = props.dubbingPanels?.[index]
    const nextUrl = resolvePreviewTimelineVideoUrl(dub, panel)
    if (nextUrl && nextUrl !== clip.url) {
      clip.url = nextUrl
    }
  })
  void hydrateVideoDurationsFromSource()
}

function getVoiceItemForVideoClip(clipId: string) {
  return voiceItems.value.find((v) => v.videoClipId === clipId)
}

function getVideoVolume(clipId: string) {
  const voice = getVoiceItemForVideoClip(clipId)
  if (voice) return voice.volume
  return videoVolumePreset.value[clipId] ?? 1
}

function getVideoVolumePercent(clipId: string) {
  return Math.max(0, Math.min(100, (getVideoVolume(clipId) / 2) * 100))
}

function formatVolumeLabel(clipId: string) {
  return `${Math.round(getVideoVolumePercent(clipId))}%`
}

function isVolumeBarActive(clipId: string) {
  return volumeHoverClipId.value === clipId || volumeDrag.value?.clipId === clipId
}

function onVolumeBarMouseEnter(clipId: string) {
  volumeHoverClipId.value = clipId
}

function setVideoVolume(clipId: string, volume: number) {
  const v = Math.max(0, Math.min(2, Number(volume.toFixed(2))))
  const voice = getVoiceItemForVideoClip(clipId)
  if (voice) {
    voice.volume = v
    voice.volumeCurve = [v, v, v]
    if (playing.value) {
      syncPreviewAudios()
    } else {
      scheduleRebuild('audio')
    }
    return
  }
  videoVolumePreset.value = { ...videoVolumePreset.value, [clipId]: v }
  const activeClip = getVideoClipAtTime(currentTime.value)
  if (playing.value && activeClip?.id === clipId) {
    syncNativePreviewVideoTime()
  }
}

function onVolumeBarPointerDown(e: PointerEvent, clipId: string) {
  const shell = e.currentTarget as HTMLElement
  const rect = shell.getBoundingClientRect()
  const barHeight = rect.height || 38
  const ratio = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / barHeight))
  setVideoVolume(clipId, ratio * 2)
  volumeDrag.value = {
    clipId,
    startY: e.clientY,
    startVolume: getVideoVolume(clipId),
    barHeight
  }
  volumeHoverClipId.value = clipId
  pauseAutoFollow()
  try {
    shell.setPointerCapture(e.pointerId)
  } catch {}
}

function onVolumeBarMouseLeave(clipId: string) {
  if (volumeDrag.value?.clipId === clipId) return
  if (volumeHoverClipId.value === clipId) volumeHoverClipId.value = null
}

function updateVolumeFromPointer(e: PointerEvent) {
  const drag = volumeDrag.value
  if (!drag) return
  const wrap = timelineWrapRef.value
  const shell = wrap?.querySelector(
    `[data-volume-clip="${drag.clipId}"] .volume-bar-shell`
  ) as HTMLElement | null
  if (shell) {
    const rect = shell.getBoundingClientRect()
    const barHeight = rect.height || drag.barHeight
    const ratio = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / barHeight))
    setVideoVolume(drag.clipId, ratio * 2)
    return
  }
  const deltaY = drag.startY - e.clientY
  const deltaVol = (deltaY / drag.barHeight) * 2
  setVideoVolume(drag.clipId, drag.startVolume + deltaVol)
}

function stopVolumeDrag() {
  if (!volumeDrag.value) return
  volumeDrag.value = null
  scheduleTimelinePersist()
  if (playing.value) scheduleAutoFollowResume(600)
}

async function probeVideoDuration(url: string): Promise<number> {
  if (!url) return EMPTY_CLIP_DURATION
  return await new Promise((resolve) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    el.src = url
    const done = (v: number) => {
      try {
        el.removeAttribute('src')
        el.load()
      } catch {}
      resolve(Number.isFinite(v) && v > 0 ? v : VIDEO_CLIP_FALLBACK_DURATION)
    }
    el.onloadedmetadata = () => done(el.duration)
    el.onerror = () => done(VIDEO_CLIP_FALLBACK_DURATION)
  })
}

async function probeAudioDuration(url: string): Promise<number> {
  if (!url) return VIDEO_CLIP_FALLBACK_DURATION
  return await new Promise((resolve) => {
    const el = document.createElement('audio')
    el.preload = 'metadata'
    el.src = url
    const done = (v: number) => {
      try {
        el.removeAttribute('src')
        el.load()
      } catch {}
      resolve(Number.isFinite(v) && v > 0 ? v : VIDEO_CLIP_FALLBACK_DURATION)
    }
    el.onloadedmetadata = () => done(el.duration)
    el.onerror = () => done(VIDEO_CLIP_FALLBACK_DURATION)
  })
}

function getVideoTimelineTotalSec() {
  return videoClips.value.reduce((sum, clip) => sum + clip.duration, 0)
}

function applyMusicTimelineDuration(m: TimelineAudioItem) {
  const videoTotal = Math.max(MIN_DURATION, getVideoTimelineTotalSec())
  const source = m.sourceDuration && m.sourceDuration > 0 ? m.sourceDuration : m.duration
  if (m.loop) {
    m.duration = Number(Math.max(videoTotal, MIN_DURATION).toFixed(2))
    return
  }
  const available = Math.max(MIN_DURATION, videoTotal - m.start)
  m.duration = Number(Math.min(source, available).toFixed(2))
}

function syncMusicTimelineDurations() {
  if (!musicItems.value.length) return
  musicItems.value.forEach((m) => applyMusicTimelineDuration(m))
}

async function hydrateMusicDurationsFromSource() {
  if (!musicItems.value.length) return
  for (const m of musicItems.value) {
    if (!m.url) continue
    m.sourceDuration = await probeAudioDuration(m.url)
  }
  syncMusicTimelineDurations()
}

function relayoutVideoTrackAndLinkedTracks() {
  // 按时间顺序紧挨排列，消除 start 与 duration 不一致造成的大间隔
  const ordered = [...videoClips.value].sort((a, b) => a.start - b.start)
  let cursor = 0
  for (const v of ordered) {
    const previousStart = v.start
    v.start = Number(cursor.toFixed(2))
    cursor = Number((cursor + v.duration).toFixed(2))

    // 配音按 videoClipId 对齐（勿用数组下标，缺配音时会错位），轨道宽度始终填满分镜
    voiceItems.value.forEach((voice) => {
      if (voice.videoClipId !== v.id) return
      voice.start = v.start
      voice.duration = Math.max(MIN_DURATION, Number(v.duration.toFixed(2)))
    })

    subtitleItems.value.forEach((sub) => {
      if (sub.videoClipId !== v.id) return
      if (sub.cue) {
        const relativeStart = Math.max(0, Number((sub.start - previousStart).toFixed(2)))
        const maxDuration = Math.max(MIN_DURATION, Number((v.duration - relativeStart).toFixed(2)))
        sub.start = Number((v.start + relativeStart).toFixed(2))
        sub.duration = Math.max(MIN_DURATION, Math.min(sub.duration, maxDuration))
        return
      }
      const linkedVoice = voiceItems.value.find((voice) => voice.videoClipId === v.id && Number(voice.sourceDuration) > 0.5)
      sub.start = v.start
      sub.duration = resolveUntimedSubtitleDuration(v, linkedVoice)
    })
  }
  videoClips.value = ordered
  if (musicItems.value.length) {
    syncMusicTimelineDurations()
  }
}

function relayoutVideoTrackWithLinkedByOrder() {
  relayoutVideoTrackAndLinkedTracks()
}

function normalizeEmptyClipDurations() {
  let changed = false
  videoClips.value.forEach((clip) => {
    if (!hasClipVideoUrl(clip) && Math.abs(clip.duration - EMPTY_CLIP_DURATION) > 0.01) {
      applyClipTimelineDuration(clip, EMPTY_CLIP_DURATION)
      changed = true
    }
  })
  if (changed) {
    relayoutVideoTrackAndLinkedTracks()
    scheduleRebuild('all')
  }
}

async function hydrateVideoDurationsFromSource() {
  if (!videoClips.value.length) return
  const clips = [...videoClips.value]
  // 先全部探测完再写回，避免探测过程中 duration/start 不同步出现大间隔
  const probed = await Promise.all(
    clips.map(async (clip) => {
      if (!hasClipVideoUrl(clip)) return EMPTY_CLIP_DURATION
      return probeVideoDuration(clip.url)
    })
  )
  clips.forEach((clip, i) => {
    applyClipTimelineDuration(clip, probed[i] ?? EMPTY_CLIP_DURATION)
  })
  videoClips.value = clips
  relayoutVideoTrackAndLinkedTracks()
  scheduleRebuild('all')
  clips.forEach((clip) => {
    if (hasClipVideoUrl(clip)) preloadVideoUrl(clip.url)
  })
  void hydrateMusicDurationsFromSource()
}

// --- build from previous steps ---
function buildTimelineFromProps(options?: { showSuccessMessage?: boolean }): boolean {
  const panels = props.dubbingPanels || []
  const videoPanels = props.storyboardVideoPanels || []
  if (!panels.length || !videoPanels.length) return false

  let start = 0
  const nextVideo: TimelineVideoClip[] = []
  const nextVoice: TimelineAudioItem[] = []
  const nextSub: TimelineSubtitleItem[] = []

  for (let i = 0; i < panels.length; i++) {
    const dub = panels[i]
    const vPanel = videoPanels[i]
    const url = resolvePreviewTimelineVideoUrl(dub, vPanel)

    const name = dub?.title || vPanel?.title || `分镜${i + 1}`
    const subtitleText = resolvePreviewSubtitleText(dub)
    const clipDur = getInitialClipDuration(url)

    const clip: TimelineVideoClip = {
      id: dub?.id || `v-${i}-${Date.now()}`,
      kind: 'video',
      name,
      url,
      start,
      duration: clipDur,
      sourceDuration: clipDur,
      trimStart: 0,
      trimEnd: clipDur
    }
    nextVideo.push(clip)

    const voiceUrl = dub?.dubbingUploadedAudioUrl?.trim()
    let timelineVoice: TimelineAudioItem | undefined
    if (voiceUrl) {
      const presetVol = videoVolumePreset.value[clip.id] ?? 1
      timelineVoice = {
        id: `voice-${clip.id}`,
        kind: 'voice',
        name: `配音 ${i + 1}`,
        url: voiceUrl,
        videoClipId: clip.id,
        start,
        duration: clipDur,
        volume: presetVol,
        fadeIn: 0,
        fadeOut: 0,
        loop: false,
        volumeCurve: [presetVol, presetVol, presetVol]
      }
      nextVoice.push(timelineVoice)
    }

    if (subtitleText) {
      nextSub.push({
        id: `sub-${clip.id}`,
        kind: 'subtitle',
        text: subtitleText,
        fontSize: 40,
        videoClipId: clip.id,
        start,
        duration: resolveUntimedSubtitleDuration(clip, timelineVoice)
      })
    }

    start += clip.duration
  }

  videoClips.value = nextVideo
  voiceItems.value = nextVoice
  subtitleItems.value = nextSub
  musicItems.value = props.bgm?.trim()
    ? [
        {
          id: `music-${Date.now()}`,
          kind: 'music',
          name: '背景音乐',
          url: props.bgm!.trim(),
          start: 0,
          duration: Math.max(1, start),
          sourceDuration: Math.max(1, start),
          volume: 0.25,
          fadeIn: 0,
          fadeOut: 0,
          loop: true,
          volumeCurve: [0.25, 0.25, 0.25]
        }
      ]
    : []

  currentTime.value = 0
  playing.value = false
  if (options?.showSuccessMessage) {
    message.success('已同步到时间轴（支持拖拽/新增字幕/新增配音/新增音乐）')
  }
  resetPlayheadToStart()
  preloadPreviewTimelineAudios()
  void hydrateVideoDurationsFromSource().then(() => {
    resetPlayheadToStart()
  })
  void hydrateMusicDurationsFromSource()
  void hydrateVoiceDurationsFromSource()
  return true
}

function syncFromPreviousSteps() {
  void reloadEpisodeTimelineFromServer({ rebuild: true, showMessage: true })
}

function reloadEpisodeTimelineFromServer(opts?: { rebuild?: boolean; showMessage?: boolean }) {
  void (async () => {
    timelineLoading.value = true
    try {
      const { result, ui } = await loadEpisodeTimeline({
        store: creationStore,
        route,
        rebuild: Boolean(opts?.rebuild)
      })
      serverTimelineBaseline.value = result.timeline
      applyServerTimelineUi(ui)
      lastHydratedScopeKey = projectScopeKey.value
      if (opts?.showMessage) {
        message.success('已按最新分镜数据重置时间轴')
      }
      resetPlayheadToStart()
    } catch (e: unknown) {
      if (opts?.showMessage) {
        const msg = String((e as Error)?.message || (e as { msg?: string })?.msg || '')
        if (!buildTimelineFromProps({ showSuccessMessage: true })) {
          message.warning(msg || '暂无分镜/配音数据，请先完成前面步骤')
        } else {
          resetPlayheadToStart()
        }
      }
    } finally {
      timelineLoading.value = false
      nextTick(() => resetPlayheadToStart())
    }
  })()
}

function onEpisodeTimelineRebuildRequested() {
  reloadEpisodeTimelineFromServer({ rebuild: true })
}

async function handleDownloadSegments() {
  if (import.meta.server) return
  if (segmentsDownloading.value) return
  segmentsDownloading.value = true
  const key = 'export-segments'
  try {
    message.loading({ content: '正在打包分段素材…', key, duration: 0 })
    const { filename } = await downloadEpisodeSegmentsZipForContext(
      { store: creationStore, route },
      (msg) => {
        message.loading({ content: msg, key, duration: 0 })
      }
    )
    message.success({
      content: `已开始下载 ${filename || '分段素材.zip'}`,
      key,
      duration: 3
    })
  } catch (e: unknown) {
    message.error({ content: exportApiErr(e, '分段导出失败'), key, duration: 3 })
  } finally {
    segmentsDownloading.value = false
  }
}

// --- AVCanvas preview ---
let avCanvas: any = null
let avUnsubTime: (() => void) | null = null
let avUnsubPlaying: (() => void) | null = null
let avUnsubPaused: (() => void) | null = null
const mediaBlobCache = new Map<string, Blob>()
let rebuildTimer: number | null = null
const currentPreviewToken = ref(0)

async function ensureCanvas() {
  if (import.meta.server) return null
  if (avCanvas) return avCanvas
  const host = canvasHostRef.value
  if (!host) return null
  const { AVCanvas } = await import('@webav/av-canvas')
  avCanvas = new AVCanvas(host, { bgColor: '#000', width: 1280, height: 720 })
  avUnsubTime = avCanvas.on('timeupdate', (t: number) => { currentTime.value = t / 1_000_000 })
  avUnsubPlaying = avCanvas.on('playing', () => { playing.value = true })
  avUnsubPaused = avCanvas.on('paused', () => { playing.value = false })
  return avCanvas
}

async function getCachedStream(url: string): Promise<ReadableStream<Uint8Array> | null> {
  if (mediaBlobCache.has(url)) {
    const blob = mediaBlobCache.get(url)!
    return blob.stream() as ReadableStream<Uint8Array>
  }
  // 跨域 CDN 无 CORS 时走同源 /api/media-proxy，避免 fetch 触发控制台 CORS 报错
  const blob = await fetchMediaBlob(url)
  if (!blob) return null
  mediaBlobCache.set(url, blob)
  return blob.stream() as ReadableStream<Uint8Array>
}

function scheduleRebuild(_reason: 'video' | 'subtitle' | 'audio' | 'all' = 'all') {
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
  rebuildTimer = window.setTimeout(() => {
    rebuildTimer = null
    void rebuildCanvas().catch((error) => {
      console.error('Failed to rebuild preview canvas:', error)
    })
  }, 80)
}

function isVideoSampleBoundaryError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Not found video sample by time')
}

async function rebuildCanvas() {
  if (import.meta.server) return
  const host = canvasHostRef.value
  if (!host) return

  try { avCanvas?.destroy?.() } catch {}
  avCanvas = null
  avUnsubTime?.(); avUnsubPlaying?.(); avUnsubPaused?.()
  avUnsubTime = null
  avUnsubPlaying = null
  avUnsubPaused = null
  await nextTick()

  const token = Date.now()
  currentPreviewToken.value = token
  const cvs = await ensureCanvas()
  if (!cvs) return

  const webav = await import('@webav/av-cliper')
  const { MP4Clip, AudioClip, ImgClip, VisibleSprite, renderTxt2ImgBitmap, Rect } = webav as any
  const secToUs = (s: number) => Math.max(0, Math.round(s * 1_000_000))

  const videosOrdered = [...videoClips.value].sort((a, b) => a.start - b.start)
  for (const clip of videosOrdered) {
    if (!clip.url) continue
    const stream = await getCachedStream(clip.url)
    if (!stream) continue
    let mp4 = new MP4Clip(stream)
    await mp4.ready

    const trimStartUs = secToUs(clip.trimStart || 0)
    const trimEndUs = secToUs(clip.trimEnd || clip.duration)
    if (trimStartUs > 0) {
      if (trimStartUs >= mp4.meta.duration) continue
      try {
        const [, rest] = await mp4.split(trimStartUs)
        mp4 = rest
      } catch (error) {
        // No sample after trimStart means this source has no playable trimmed range.
        if (isVideoSampleBoundaryError(error)) continue
        throw error
      }
    }
    const keepUs = Math.max(1, trimEndUs - trimStartUs)
    if (keepUs < mp4.meta.duration) {
      try {
        const [kept] = await mp4.split(keepUs)
        mp4 = kept
      } catch (error) {
        // Container duration can extend beyond the final sample CTS. In that tail,
        // keeping the remaining clip is equivalent to splitting at the requested end.
        if (!isVideoSampleBoundaryError(error)) throw error
      }
    }

    const spr = new VisibleSprite(mp4)
    spr.time = { offset: secToUs(clip.start), duration: secToUs(clip.duration) }
    spr.zIndex = 1
    // 等比 contain 进 16:9 画布，避免非 16:9 素材被拉伸撑满
    const srcW = Number(mp4.meta?.width) || 1280
    const srcH = Number(mp4.meta?.height) || 720
    const scale = Math.min(1280 / srcW, 720 / srcH)
    const drawW = Math.max(1, Math.round(srcW * scale))
    const drawH = Math.max(1, Math.round(srcH * scale))
    spr.rect = new Rect(
      Math.round((1280 - drawW) / 2),
      Math.round((720 - drawH) / 2),
      drawW,
      drawH
    )
    await cvs.addSprite(spr)
    if (currentPreviewToken.value !== token) return
  }

  for (const sub of subtitleItems.value) {
    const text = (sub.text || '').trim()
    if (!text) continue
    const subtitleFontSize = Math.max(20, Math.min(72, Number(sub.fontSize || 40)))
    const bmp = await renderTxt2ImgBitmap(
      text,
      `font-size:${subtitleFontSize}px;color:#fff;background:rgba(0,0,0,0.6);padding:10px 16px;border-radius:10px;line-height:1.35;max-width:90%;text-align:center;`
    )
    const spr = new VisibleSprite(new ImgClip(bmp))
    spr.time = { offset: secToUs(sub.start), duration: secToUs(sub.duration) }
    spr.zIndex = 20
    const w = bmp.width || 900
    const h = bmp.height || 90
    spr.rect = new Rect(Math.round((1280 - w) / 2), Math.round(720 - 64 - h), w, h)
    await cvs.addSprite(spr)
    if (currentPreviewToken.value !== token) return
  }

  for (const a of [...voiceItems.value, ...musicItems.value]) {
    if (!a.url) continue
    const stream = await getCachedStream(a.url)
    if (!stream) continue
    const clip = new AudioClip(stream, { loop: !!a.loop })
    await clip.ready
    const curve = a.volumeCurve?.length ? a.volumeCurve : [a.volume, a.volume, a.volume]
    const parts = [0, 1, 2]
    for (const idx of parts) {
      const segStart = a.start + a.duration * (idx / 3)
      const segDur = a.duration / 3
      const spr = new VisibleSprite(clip)
      spr.time = { offset: secToUs(segStart), duration: secToUs(segDur) }
      ;(spr as any).volume = Math.max(0, curve[idx] ?? a.volume ?? 1)
      spr.zIndex = 0
      await cvs.addSprite(spr)
    }
    if (currentPreviewToken.value !== token) return
  }

  if (!playing.value && hasPlayableVideoAtTime(currentTime.value)) {
    cvs.previewFrame?.(Math.round(currentTime.value * 1_000_000))
    await nextTick()
    syncNativePreviewVideoTime()
  }
}

async function togglePlay() {
  if (!videoClips.value.length) return
  if (playing.value) {
    stopPlayback()
    return
  }
  const startSec = resolvePlaybackStartSec()
  if (!hasPlayableVideoAtTime(startSec)) {
    message.warning('暂无视频无法播放')
    return
  }
  seekToTime(startSec, { preview: true })
  autoFollowEnabled.value = true
  playing.value = true
  // 必须在用户手势的同步阶段拉起配音 Audio：await 后再 play 易被浏览器自动播放策略拦截
  preloadPreviewTimelineAudios()
  const startClip = getVideoClipAtTime(startSec)
  syncPreviewAudios()
  if (startClip) {
    const el = getActiveNativeEl()
    if (el) applyNativeVideoVolume(el, startClip)
  }
  syncNativePreviewVideoTime()
  // 再同步一次：确保视频静音与配音起播落在同一手势周期
  syncPreviewAudios()
  startPreviewPlaybackLoop()
  preloadAdjacentClips(startClip)
}

function onPreviewPlayerAreaClick() {
  if (!videoClips.value.length) return
  void togglePlay()
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = String(el.tagName || '').toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return !!el.closest?.('input, textarea, select, [contenteditable="true"]')
}

/** 空格：播放 / 暂停（与点击预览区一致） */
function onPreviewKeyboard(e: KeyboardEvent) {
  if (e.code !== 'Space' && e.key !== ' ') return
  if (e.repeat) return
  if (isEditableKeyboardTarget(e.target)) return
  if (!videoClips.value.length) return
  e.preventDefault()
  void togglePlay()
}

function resolvePlaybackStartSec(): number {
  const end = totalDuration.value
  const t = currentTime.value
  const clip = selectedVideoClip.value

  if (end > 0 && t >= end - 0.05) {
    return clip ? clip.start : 0
  }

  return t
}

function seekToTime(sec: number, opts?: { preview?: boolean }) {
  const clamped = Math.max(0, Math.min(totalDuration.value, Number(sec.toFixed(3))))
  currentTime.value = clamped
  if (playing.value) {
    if (!hasPlayableVideoAtTime(clamped)) {
      finishPreviewPlayback()
    } else {
      previewPlayStartedAt = performance.now()
      previewPlayStartSec = clamped
      refreshPreviewPlayEndSec(clamped)
    }
  }
  if (opts?.preview !== false) {
    if (hasPlayableVideoAtTime(clamped)) {
      avCanvas?.previewFrame?.(Math.round(clamped * 1_000_000))
      nextTick(() => {
        syncNativePreviewVideoTime()
        syncPreviewAudios()
      })
    } else {
      syncNativePreviewVideoTime()
      syncPreviewAudios()
    }
  }
}

function pauseAutoFollow() {
  autoFollowEnabled.value = false
  if (autoFollowResumeTimer) {
    window.clearTimeout(autoFollowResumeTimer)
    autoFollowResumeTimer = null
  }
}

function scheduleAutoFollowResume(delayMs = 1500) {
  if (autoFollowResumeTimer) window.clearTimeout(autoFollowResumeTimer)
  autoFollowResumeTimer = window.setTimeout(() => {
    autoFollowEnabled.value = true
    autoFollowResumeTimer = null
    if (playing.value) ensurePlayheadVisible()
  }, delayMs)
}

function onTimelineUserScroll() {
  if (performance.now() < programmaticScrollLockUntil) return
  if (suppressScrollFollowPause || !playing.value) return
  pauseAutoFollow()
  scheduleAutoFollowResume()
}

function scrollPlayheadIntoView() {
  const wrap = timelineWrapRef.value
  if (!wrap) return
  const playheadPx = secToPlayheadPx(currentTime.value)
  const viewportWidth = wrap.clientWidth - trackLabelWidth.value
  const margin = 96
  let nextScrollLeft = wrap.scrollLeft
  if (playheadPx < wrap.scrollLeft + margin) {
    nextScrollLeft = Math.max(0, playheadPx - margin)
  } else if (playheadPx > wrap.scrollLeft + viewportWidth - margin) {
    nextScrollLeft = Math.max(0, playheadPx - viewportWidth + margin)
  }
  if (Math.abs(nextScrollLeft - wrap.scrollLeft) < 1) return
  setTimelineScrollLeft(wrap, nextScrollLeft)
}

/** 播放时让时间轴随分割线连续平移，与播放进度保持同速 */
function followPlayheadSmoothly() {
  if (!playing.value || !autoFollowEnabled.value) return
  const wrap = timelineWrapRef.value
  if (!wrap) return

  const playheadPx = secToPlayheadPx(currentTime.value)
  const viewportWidth = Math.max(1, wrap.clientWidth - trackLabelWidth.value)
  const maxScroll = Math.max(0, wrap.scrollWidth - wrap.clientWidth)
  const anchorPx = viewportWidth * 0.38
  const targetScroll = Math.max(0, Math.min(maxScroll, playheadPx - anchorPx))

  setTimelineScrollLeft(wrap, targetScroll)
}

function stopPlayback() {
  if (!playing.value) return
  finishPreviewPlayback()
  try {
    avCanvas?.pause?.()
  } catch {}
}

watch(
  () => currentTime.value,
  () => {
    if (!totalDuration.value) return
    syncNativePreviewVideoTime()
    if (playing.value) syncPreviewAudios()
  }
)

watch(showNativePreviewVideo, (visible) => {
  if (visible) {
    nativePreviewFrameReady.value = false
    nextTick(() => {
      const clip = getVideoClipAtTime(currentTime.value)
      if (clip?.url) {
        const offset = Math.max(0, currentTime.value - clip.start + (clip.trimStart || 0))
        void ensureActiveNativeVideoSrc(clip.url, offset).then(() => {
          activeNativeClipId = clip.id
          refreshNativePreviewFrameReady()
          syncNativePreviewVideoTime()
        })
      } else {
        syncNativePreviewVideoTime()
      }
    })
  } else {
    slotSrcA = ''
    slotSrcB = ''
    activeNativeClipId = ''
    standbyPreparedClipId = ''
    nativePreviewFrameReady.value = false
  }
})

watch(nativePreviewVideoUrl, (url, prevUrl) => {
  if (!url) {
    return
  }
  preloadVideoUrl(url)
  if (showNativePreviewVideo.value) {
    nextTick(() => {
      const clip = getVideoClipAtTime(currentTime.value)
      if (!clip || clip.url !== url) return
      if (activeNativeClipId === clip.id) {
        if (prevUrl !== url) nativePreviewFrameReady.value = false
        void ensureActiveNativeVideoSrc(url)
      } else {
        syncNativePreviewVideoTime()
      }
    })
  }
})

function toggleMute() {
  muted.value = !muted.value
  syncNativePreviewVideoTime()
  syncPreviewAudios()
}

// --- pointer drag (move/resize) ---
type DragState =
  | { kind: 'move'; track: TrackType; id: string; startX: number; originStart: number }
  | { kind: 'resize'; track: TrackType; id: string; side: ResizeSide; startX: number; originStart: number; originDuration: number }
  | null

const dragState = ref<DragState>(null)
const subtitleRange = ref<{ active: boolean; startSec: number; endSec: number }>({ active: false, startSec: 0, endSec: 0 })
const subtitleRangeStyle = computed(() => {
  const s = Math.min(subtitleRange.value.startSec, subtitleRange.value.endSec)
  const e = Math.max(subtitleRange.value.startSec, subtitleRange.value.endSec)
  const leftPx = secToLayoutPx(s)
  const rightPx = secToLayoutPx(e)
  return { left: `${leftPx}px`, width: `${Math.max(2, rightPx - leftPx)}px` }
})

function pxToSec(px: number) {
  return layoutPxToSec(Math.max(0, px))
}

function pxDeltaToSecDelta(px: number) {
  return px / scalePxPerSec
}

function getStripLeftPx() {
  const wrap = timelineWrapRef.value
  if (!wrap) return 0
  const rect = wrap.getBoundingClientRect()
  return rect.left + wrap.clientLeft + trackLabelWidth.value - wrap.scrollLeft
}

function findItem(track: TrackType, id: string): any {
  const list =
    track === 'video' ? videoClips.value :
    track === 'voice' ? voiceItems.value :
    track === 'subtitle' ? subtitleItems.value :
    musicItems.value
  return list.find((x: any) => x.id === id)
}

function getTrackItems(track: TrackType): Array<TimelineBase> {
  if (track === 'video') return videoClips.value
  if (track === 'voice') return voiceItems.value
  if (track === 'subtitle') return subtitleItems.value
  return musicItems.value
}

function selectClip(track: TrackType, id: string) {
  selectedClip.value = { track, id }
  const item = findItem(track, id)
  if (!item) return

  stopPlayback()
  seekToTime(item.start)
  void ensurePreviewAtCurrentTime()
  nextTick(() => scrollPlayheadIntoView())

}

function markSwapping(ids: string[]) {
  if (!ids.length) return
  const next = new Set(swappingClipIds.value)
  ids.forEach((id) => next.add(id))
  swappingClipIds.value = next
  window.setTimeout(() => {
    const cleared = new Set(swappingClipIds.value)
    ids.forEach((id) => cleared.delete(id))
    swappingClipIds.value = cleared
  }, 260)
}

function snapStart(track: TrackType, id: string, start: number, duration: number, mode: 'move' | 'resize-start' | 'resize-end') {
  if (!snapEnabled.value) {
    snapIndicatorPx.value = null
    return Math.max(0, Number(start.toFixed(2)))
  }
  const candidates: number[] = [0]
  if (snapSourceMode.value === 'edges-playhead') {
    candidates.push(currentTime.value)
  }
  if (snapSourceMode.value === 'edges-grid') {
    const gridStepSec = 1
    const maxT = Math.ceil(Math.max(totalDuration.value, start + duration + 5))
    for (let t = 0; t <= maxT; t += gridStepSec) candidates.push(t)
  }
  const list = getTrackItems(track)
  for (const it of list) {
    if ((it as any).id === id) continue
    candidates.push(it.start, it.start + it.duration)
  }
  let snappedStart = start
  let nearest: number | null = null
  let bestDist = Infinity
  const targetHead = start
  const targetTail = start + duration
  for (const c of candidates) {
    const distHead = Math.abs(c - targetHead)
    if (distHead < bestDist && distHead <= snapDistanceSec.value) {
      bestDist = distHead
      snappedStart = c
      nearest = c
    }
    const distTail = Math.abs(c - targetTail)
    if (distTail < bestDist && distTail <= snapDistanceSec.value) {
      bestDist = distTail
      snappedStart = c - duration
      nearest = c
    }
  }
  snapIndicatorPx.value = nearest === null ? null : secToLayoutPx(nearest)
  if (mode === 'resize-end') return start
  return Math.max(0, Number(snappedStart.toFixed(2)))
}

function resolveOverlap(track: TrackType, movingId: string) {
  const list = getTrackItems(track) as Array<any>
  list.sort((a, b) => a.start - b.start)
  const changedIds = new Set<string>()
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]
    const cur = list[i]
    const prevEnd = prev.start + prev.duration
    if (cur.start < prevEnd) {
      changedIds.add(cur.id)
      cur.start = Number(prevEnd.toFixed(2))
    }
  }
  // 交换策略：移动项大幅跨过中点时和临近项交换优先顺序
  const moving = list.find((x) => x.id === movingId)
  if (!moving) return
  for (const it of list) {
    if (it.id === moving.id) continue
    const overlap = Math.min(moving.start + moving.duration, it.start + it.duration) - Math.max(moving.start, it.start)
    if (overlap > Math.min(moving.duration, it.duration) * 0.6) {
      const temp = moving.start
      moving.start = it.start
      it.start = temp
      changedIds.add(moving.id)
      changedIds.add(it.id)
      break
    }
  }
  if (track === 'video') {
    relayoutVideoTrackWithLinkedByOrder()
  }
  markSwapping(Array.from(changedIds))
}

function onClipPointerDown(e: PointerEvent, track: TrackType, id: string) {
  const item = findItem(track, id)
  if (!item) return
  dragState.value = { kind: 'move', track, id, startX: e.clientX, originStart: item.start }
  selectClip(track, id)
}

function onResizePointerDown(e: PointerEvent, track: TrackType, id: string, side: ResizeSide) {
  const item = findItem(track, id)
  if (!item) return
  dragState.value = { kind: 'resize', track, id, side, startX: e.clientX, originStart: item.start, originDuration: item.duration }
  selectClip(track, id)
}

function onTimelinePointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.track-strip-music') || target.closest('.track-clip-music')) return
  startTimelineScrub(e.clientX)
}

function setCurrentTimeFromClientX(clientX: number) {
  const stripLeft = getStripLeftPx()
  const x = clientX - stripLeft
  const sec = Math.max(0, Math.min(totalDuration.value, pxToSec(x)))
  seekToTime(sec)
}

function startTimelineScrub(clientX: number) {
  scrubbing.value = true
  scrubClientX.value = clientX
  pauseAutoFollow()
  setCurrentTimeFromClientX(clientX)
}

function stopTimelineScrub() {
  scrubbing.value = false
  scrubClientX.value = null
  if (playing.value) scheduleAutoFollowResume(800)
}

function autoScrollTimelineWhileScrub(clientX: number) {
  const wrap = timelineWrapRef.value
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  const edgePx = 36
  const maxStep = 24
  let nextScrollLeft = wrap.scrollLeft
  if (clientX < rect.left + edgePx) {
    const ratio = (rect.left + edgePx - clientX) / edgePx
    const step = Math.min(maxStep, Math.max(2, Math.round(maxStep * ratio)))
    nextScrollLeft = Math.max(0, wrap.scrollLeft - step)
  } else if (clientX > rect.right - edgePx) {
    const ratio = (clientX - (rect.right - edgePx)) / edgePx
    const step = Math.min(maxStep, Math.max(2, Math.round(maxStep * ratio)))
    nextScrollLeft = wrap.scrollLeft + step
  }
  if (nextScrollLeft === wrap.scrollLeft) return
  setTimelineScrollLeft(wrap, nextScrollLeft)
}

function ensurePlayheadVisible() {
  if (!autoFollowEnabled.value) return
  if (playing.value) {
    followPlayheadSmoothly()
    return
  }
  scrollPlayheadIntoView()
}

function onPointerMove(e: PointerEvent) {
  if (volumeDrag.value) {
    updateVolumeFromPointer(e)
  }
  if (scrubbing.value) {
    scrubClientX.value = e.clientX
    autoScrollTimelineWhileScrub(e.clientX)
    setCurrentTimeFromClientX(e.clientX)
  }
  const st = dragState.value
  if (!st) return
  const dx = e.clientX - st.startX
  const dSec = pxDeltaToSecDelta(dx)
  const item = findItem(st.track, st.id)
  if (!item) return

  if (st.kind === 'move') {
    const oldStart = item.start
    const raw = Math.max(0, Number((st.originStart + dSec).toFixed(2)))
    item.start = snapStart(st.track, st.id, raw, item.duration, 'move')
    resolveOverlap(st.track, st.id)
    // 分镜移动时，联动其字幕/配音
    if (st.track === 'video') {
      const delta = item.start - oldStart
      if (Math.abs(delta) > 0.0001) {
        subtitleItems.value.forEach((s) => {
          if (s.videoClipId === item.id) s.start = Math.max(0, Number((s.start + delta).toFixed(2)))
        })
        voiceItems.value.forEach((v) => {
          if (v.videoClipId === item.id) v.start = Math.max(0, Number((v.start + delta).toFixed(2)))
        })
      }
    }
    return
  }

  if (st.side === 'start') {
    const end = st.originStart + st.originDuration
    const newStart = Math.max(0, Number((st.originStart + dSec).toFixed(2)))
    const snapped = snapStart(st.track, st.id, Math.min(newStart, end - MIN_DURATION), end - Math.min(newStart, end - MIN_DURATION), 'resize-start')
    item.start = Math.min(snapped, end - MIN_DURATION)
    item.duration = Math.max(MIN_DURATION, Number((end - item.start).toFixed(2)))
    if (st.track === 'video') constrainLinkedItemsToVideo(item.id)
  } else {
    item.duration = Math.max(MIN_DURATION, Number((st.originDuration + dSec).toFixed(2)))
    resolveOverlap(st.track, st.id)
    if (st.track === 'video') constrainLinkedItemsToVideo(item.id)
  }
}

function onPointerUp() {
  stopVolumeDrag()
  stopTimelineScrub()
  if (!dragState.value) return
  if (dragState.value.track === 'video') {
    relayoutVideoTrackWithLinkedByOrder()
  } else if (dragState.value.track === 'voice') {
    // 配音拖拽/缩放后仍强制对齐所属分镜，避免出现「只有一点」的短条
    const voice = voiceItems.value.find((v) => v.id === dragState.value!.id)
    const clip = voice?.videoClipId
      ? videoClips.value.find((c) => c.id === voice.videoClipId)
      : null
    if (voice && clip) {
      voice.start = clip.start
      voice.duration = Math.max(MIN_DURATION, Number(clip.duration.toFixed(2)))
    }
  }
  dragState.value = null
  snapIndicatorPx.value = null
  scheduleRebuild('all')
}

// --- click to add ---
const subtitleModalOpen = ref(false)
const subtitleDraft = ref('')
const subtitleFontSizeDraft = ref(40)
const editingSubtitleId = ref<string | null>(null)
const pendingAddAudioTrack = ref<'voice' | 'music' | null>(null)
const pendingVoiceVideoClipId = ref<string | null>(null)
const replacingVoiceId = ref<string | null>(null)

function getActiveVideoClipForOperation(): TimelineVideoClip | null {
  if (selectedVideoClip.value) return selectedVideoClip.value
  const t = currentTime.value
  const byTime = getVideoClipAtTime(t)
  return byTime || videoClips.value[0] || null
}

function seekClipAndPreview(sec: number) {
  stopPlayback()
  seekToTime(sec)
  void ensurePreviewAtCurrentTime()
  nextTick(() => scrollPlayheadIntoView())
}

function constrainLinkedItemsToVideo(videoClipId: string) {
  const clip = videoClips.value.find((v) => v.id === videoClipId)
  if (!clip) return
  const clipEnd = clip.start + clip.duration
  subtitleItems.value.forEach((s) => {
    if (s.videoClipId !== videoClipId) return
    if (s.start < clip.start) s.start = clip.start
    if (s.start + s.duration > clipEnd) s.duration = Math.max(MIN_DURATION, Number((clipEnd - s.start).toFixed(2)))
  })
  voiceItems.value.forEach((v) => {
    if (v.videoClipId !== videoClipId) return
    // 配音轨始终覆盖整个分镜区间
    v.start = clip.start
    v.duration = Math.max(MIN_DURATION, Number(clip.duration.toFixed(2)))
  })
}

function onTrackClick(e: MouseEvent, track: 'voice' | 'subtitle' | 'music') {
  if (subtitleRange.value.active) return
  const wrap = timelineWrapRef.value
  if (!wrap) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left + wrap.scrollLeft
  const t = pxToSec(x)
  seekClipAndPreview(t)

  if (track === 'voice') {
    const videoClip = getVideoClipAtTime(t) || getActiveVideoClipForOperation()
    if (!videoClip) {
      message.warning('请先同步分镜视频')
      return
    }
    selectedClip.value = { track: 'video', id: videoClip.id }
    openEditDubbingModalForClip(videoClip.id)
    return
  }

  if (track === 'subtitle') {
    const subAtTime = subtitleItems.value.find((s) => t >= s.start && t < s.start + s.duration)
    if (subAtTime) {
      selectedClip.value = { track: 'subtitle', id: subAtTime.id }
      editSubtitle(subAtTime.id)
      return
    }
    const activeVideo = getVideoClipAtTime(t) || getActiveVideoClipForOperation()
    if (!activeVideo) {
      message.warning('请先选中或定位到某个分镜视频片段')
      return
    }
    const existed = subtitleItems.value.find((s) => s.videoClipId === activeVideo.id)
    if (existed) {
      selectedClip.value = { track: 'subtitle', id: existed.id }
      editSubtitle(existed.id)
      return
    }
    const clipStart = activeVideo.start
    const duration = Math.max(MIN_DURATION, Number(activeVideo.duration.toFixed(2)))
    const id = `sub-${Date.now()}`
    subtitleItems.value.push({
      id,
      kind: 'subtitle',
      text: '请输入字幕',
      fontSize: 40,
      videoClipId: activeVideo.id,
      start: clipStart,
      duration
    })
    resolveOverlap('subtitle', id)
    selectedClip.value = { track: 'subtitle', id }
    editSubtitle(id)
    scheduleRebuild('subtitle')
    return
  }

  if (track === 'music') {
    openEditMusicModal()
  }
}

function onMissingVoiceClick(videoClipId: string) {
  const clip = videoClips.value.find((v) => v.id === videoClipId)
  if (!clip) return
  selectedClip.value = { track: 'video', id: videoClipId }
  seekClipAndPreview(clip.start)
  openEditDubbingModalForClip(videoClipId)
}

function replaceVoiceForItem(voiceId: string) {
  const item = voiceItems.value.find((v) => v.id === voiceId)
  if (!item) return
  selectedClip.value = { track: 'voice', id: voiceId }
  pendingAddAudioTrack.value = 'voice'
  pendingVoiceVideoClipId.value = item.videoClipId || null
  replacingVoiceId.value = voiceId
  audioInputRef.value?.click()
}

function onMissingSubtitleClick(videoClipId: string) {
  const clip = videoClips.value.find((v) => v.id === videoClipId)
  if (!clip) return
  selectedClip.value = { track: 'video', id: videoClipId }
  seekClipAndPreview(clip.start)
  addSubtitleForVideoClip(clip)
}

function addSubtitleForVideoClip(clip: TimelineVideoClip) {
  const existed = subtitleItems.value.find((s) => s.videoClipId === clip.id)
  if (existed) {
    editSubtitle(existed.id)
    return
  }
  const clipStart = clip.start
  const duration = Math.max(MIN_DURATION, Number(clip.duration.toFixed(2)))
  const id = `sub-${Date.now()}`
  subtitleItems.value.push({
    id,
    kind: 'subtitle',
    text: '',
    fontSize: 40,
    videoClipId: clip.id,
    start: clipStart,
    duration
  })
  resolveOverlap('subtitle', id)
  editSubtitle(id)
}

function editSubtitle(id: string) {
  const item = subtitleItems.value.find((x) => x.id === id)
  if (!item) return
  editingSubtitleId.value = id
  subtitleDraft.value = item.text
  subtitleFontSizeDraft.value = item.fontSize || 40
  subtitleModalOpen.value = true
}

function saveSubtitle() {
  const id = editingSubtitleId.value
  if (!id) return
  const item = subtitleItems.value.find((x) => x.id === id)
  if (!item) return
  item.text = subtitleDraft.value.trim()
  item.fontSize = Math.max(20, Math.min(72, Number(subtitleFontSizeDraft.value || 40)))
  subtitleModalOpen.value = false
  editingSubtitleId.value = null
  scheduleRebuild('subtitle')
  scheduleTimelinePersist()
}

function onMusicBarClick(bar: { empty: boolean; item: TimelineAudioItem }) {
  if (!videoClips.value.length) {
    message.warning('请先同步前面步骤')
    return
  }
  if (bar.empty) {
    openEditMusicModal()
    return
  }
  selectedClip.value = { track: 'music', id: bar.item.id }
}

function openEditMusicModal() {
  if (!videoClips.value.length) {
    message.warning('请先同步前面步骤')
    return
  }
  isMusicModalOpen.value = true
}

function syncBgmToStore(url: string) {
  if (creationStore.formData?.dubbing) {
    creationStore.formData.dubbing.bgm = url
  }
}

function applyMusicSelection(payload: MusicPickerConfirmPayload) {
  if (payload.type === 'none') {
    musicItems.value = []
    syncBgmToStore('')
    scheduleRebuild('audio')
    scheduleTimelinePersist()
    message.success('已设置为无音乐')
    return
  }

  const existing = musicItems.value[0]
  const item: TimelineAudioItem = existing
    ? { ...existing }
    : {
        id: `music-${Date.now()}`,
        kind: 'music',
        name: payload.name,
        url: payload.url,
        start: 0,
        duration: Math.max(MIN_DURATION, getVideoTimelineTotalSec()),
        volume: payload.volume,
        fadeIn: 0,
        fadeOut: 0,
        loop: true,
        volumeCurve: [payload.volume, payload.volume, payload.volume]
      }

  item.name = payload.name
  item.url = payload.url
  item.volume = payload.volume
  item.volumeCurve = [payload.volume, payload.volume, payload.volume]
  item.loop = true
  item.start = 0

  musicItems.value = [item]
  syncBgmToStore(payload.url)
  syncMusicTimelineDurations()
  scheduleRebuild('audio')
  scheduleTimelinePersist()
  void probeAudioDuration(payload.url).then((dur) => {
    item.sourceDuration = dur
    syncMusicTimelineDurations()
    scheduleRebuild('audio')
  })
  message.success(payload.type === 'local' ? '已应用本地音乐' : `已选择音乐：${payload.name}`)
}

function onMusicPickerConfirm(payload: MusicPickerConfirmPayload) {
  applyMusicSelection(payload)
}

async function onAudioFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const track = pendingAddAudioTrack.value
  pendingAddAudioTrack.value = null
  const targetVideoClipId = pendingVoiceVideoClipId.value
  pendingVoiceVideoClipId.value = null
  const replaceId = replacingVoiceId.value
  replacingVoiceId.value = null
  if (!file || !track) return

  if (track === 'music') {
    openEditMusicModal()
    return
  }

  const activeVideo = targetVideoClipId
    ? (videoClips.value.find((video) => video.id === targetVideoClipId) || null)
    : getActiveVideoClipForOperation()
  if (!activeVideo) {
    message.warning('请先选中或定位到某个分镜视频片段再添加配音')
    return
  }

  const { uploadAudioToOssWithToast } = await import('~/utils/ossUpload')
  const url = await uploadAudioToOssWithToast(file)
  if (!url) return

  if (replaceId) {
    const existing = voiceItems.value.find((v) => v.id === replaceId)
    if (existing) {
      existing.name = file.name
      existing.url = url
      existing.videoClipId = activeVideo.id
      existing.start = activeVideo.start
      existing.duration = Math.max(MIN_DURATION, Number(activeVideo.duration.toFixed(2)))
      message.success('已替换配音')
      scheduleRebuild('audio')
      scheduleTimelinePersist()
      return
    }
  }
  const item: TimelineAudioItem = {
    id: `voice-${Date.now()}`,
    kind: 'voice',
    name: file.name,
    url,
    start: Number(currentTime.value.toFixed(2)),
    duration: 5,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
    volumeCurve: [1, 1, 1]
  }
  item.videoClipId = activeVideo.id
  item.start = activeVideo.start
  item.duration = Math.max(MIN_DURATION, Number(activeVideo.duration.toFixed(2)))
  void probeAudioDuration(url).then((dur) => {
    item.sourceDuration = dur
    if (syncUntimedSubtitleToVoiceDuration(item)) {
      scheduleRebuild('all')
      scheduleTimelinePersist()
    }
  })
  voiceItems.value.push(item)
  resolveOverlap('voice', item.id)
  scheduleRebuild('audio')
  scheduleTimelinePersist()
}

function onSubtitleRangePointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.track-clip')) return
  const strip = subtitleStripRef.value
  if (!strip) return
  const rect = strip.getBoundingClientRect()
  const start = pxToSec(e.clientX - rect.left)
  subtitleRange.value = { active: true, startSec: start, endSec: start }

  const move = (ev: PointerEvent) => {
    const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left))
    subtitleRange.value.endSec = pxToSec(x)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    const s = Math.min(subtitleRange.value.startSec, subtitleRange.value.endSec)
    const eSec = Math.max(subtitleRange.value.startSec, subtitleRange.value.endSec)
    const d = Number((eSec - s).toFixed(2))
    subtitleRange.value.active = false
    if (d < 0.15) return
    const id = `sub-range-${Date.now()}`
    subtitleItems.value.push({ id, kind: 'subtitle', text: '请输入字幕', fontSize: 40, start: Number(s.toFixed(2)), duration: d })
    const activeVideo = getActiveVideoClipForOperation()
    if (activeVideo) {
      const item = subtitleItems.value[subtitleItems.value.length - 1]
      item.videoClipId = activeVideo.id
      const clipEnd = activeVideo.start + activeVideo.duration
      if (item.start < activeVideo.start) item.start = activeVideo.start
      if (item.start + item.duration > clipEnd) item.duration = Math.max(MIN_DURATION, Number((clipEnd - item.start).toFixed(2)))
    }
    resolveOverlap('subtitle', id)
    editSubtitle(id)
    scheduleRebuild('subtitle')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

async function refreshExportStatusFromServer() {
  if (import.meta.server) return
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return
  const requestedScopeKey = liveGenScopeKeyFromIds(ctx.projectId, ctx.episodeId)
  try {
    const status = await fetchEpisodeExportStatusForContext({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      episodeEditorId: creationStore.currentEpisodeEditorId
    })
    const currentScopeKey = liveGenScopeKeyFromIds(
      creationStore.currentProjectId,
      creationStore.currentEpisodeId
    )
    if (currentScopeKey !== requestedScopeKey) return
    creationStore.setCurrentMediaContext({
      episodeEditorId: status.episodeEditorId,
      finalVideoUrl: status.finalVideoUrl ?? null,
      pendingVideoUrl: status.pendingVideoUrl ?? null,
      exportStatus: status.exportStatus
    })
    exportNeedReaudit.value = Boolean(status.needReaudit)
    exportPendingVideoUrl.value = String(status.pendingVideoUrl || '').trim()
    exportFinalVideoUrl.value = String(status.finalVideoUrl || '').trim()
    if (Number(status.exportStatus) === 1) {
      creationStore.setEpisodeExportFollowTask(requestedScopeKey, {
        episodeEditorId: status.episodeEditorId,
        active: true
      })
      showEpisodeExportProgress({
        exportProgress: status.exportProgress ?? undefined,
        exportStatus: 1
      })
      void resumeEpisodeExportFollowIfNeeded()
    }
  } catch {
    const currentScopeKey = liveGenScopeKeyFromIds(
      creationStore.currentProjectId,
      creationStore.currentEpisodeId
    )
    if (currentScopeKey !== requestedScopeKey) return
    exportNeedReaudit.value = hasPendingReauditVideo({
      pendingVideoUrl: creationStore.currentPendingVideoUrl
    })
    exportPendingVideoUrl.value = String(creationStore.currentPendingVideoUrl || '').trim()
    exportFinalVideoUrl.value = String(creationStore.currentFinalVideoUrl || '').trim()
  }
}

/** 当前页跟进导出进度（export/status 轮询）；切步骤时 abort（暂停），回到预览再恢复 */
let exportFollowAbort: AbortController | null = null
let exportFollowInFlight: Promise<void> | null = null
let exportFollowGeneration = 0

function pauseEpisodeExportFollow() {
  exportFollowGeneration += 1
  try {
    exportFollowAbort?.abort()
  } catch {
    /* ignore */
  }
  exportFollowAbort = null
  exportFollowInFlight = null
}

function applyExportOutcomeToUi(result: EpisodeVideoExportOutcome) {
  creationStore.setCurrentMediaContext({
    episodeEditorId: result.episodeEditorId,
    finalVideoUrl: result.finalVideoUrl ?? null,
    pendingVideoUrl: result.pendingVideoUrl ?? null,
    exportStatus: 2
  })
  exportNeedReaudit.value = Boolean(result.needReaudit)
  exportPendingVideoUrl.value = String(result.pendingVideoUrl || '').trim()
  exportFinalVideoUrl.value = String(result.finalVideoUrl || '').trim()
}

function notifyExportSuccess(
  result: EpisodeVideoExportOutcome,
  messageKey: string,
  options?: { openModal?: boolean }
) {
  applyExportOutcomeToUi(result)
  // 合成成功不等于下载成功；先关闭进度提示，下载阶段由壳层接管同一个 message key。
  message.destroy(messageKey)
  if (options?.openModal !== false) {
    createFlowShell.notifyPreviewExportSuccess(result.videoUrl)
  }
}

async function resumeEpisodeExportFollowIfNeeded() {
  if (import.meta.server) return
  const scopeKey = liveGenScopeKeyFromIds(
    creationStore.currentProjectId,
    creationStore.currentEpisodeId
  )
  const persisted = creationStore.getEpisodeExportFollowTask(scopeKey)
  if (!persisted) return
  if (exportFollowInFlight) return

  const gen = ++exportFollowGeneration
  const abort = new AbortController()
  exportFollowAbort = abort
  const key = 'export'
  exporting.value = true
  showEpisodeExportProgress({ exportProgress: exportProgressPercent.value, exportStatus: 1 }, key)

  const run = (async () => {
    try {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (gen !== exportFollowGeneration || abort.signal.aborted) {
        throw new EpisodeExportFollowPausedError()
      }
      const result = await followEpisodeExportViaStatus({
        episodeEditorId: persisted.episodeEditorId ?? creationStore.currentEpisodeEditorId,
        projectId: ctx?.projectId,
        episodeId: ctx?.episodeId,
        signal: abort.signal,
        onProgress: (progress) => {
          if (gen !== exportFollowGeneration) return
          showEpisodeExportProgress(progress, key)
        }
      })
      // 切步竞态：结果已出仍弹窗，避免丢成功态且无法 resume
      creationStore.clearEpisodeExportFollowTask(scopeKey)
      notifyExportSuccess(result, key, { openModal: true })
    } catch (e: unknown) {
      if (shouldKeepEpisodeExportFollowTask(e) || gen !== exportFollowGeneration) {
        message.destroy(key)
        return
      }
      creationStore.clearEpisodeExportFollowTask(scopeKey)
      message.error({
        content: exportApiErr(e, '导出失败'),
        key,
        duration: 4
      })
    } finally {
      if (gen === exportFollowGeneration) {
        exporting.value = false
        if (exportFollowAbort === abort) exportFollowAbort = null
        exportFollowInFlight = null
      }
    }
  })()

  exportFollowInFlight = run
  await run
}

async function handleExport(): Promise<{
  videoUrl: string
  needReaudit?: boolean
  episodeEditorId?: number
} | null> {
  if (import.meta.server) return null
  if (!videoClips.value.length) {
    message.warning('暂无可导出视频，请先同步前面步骤')
    return null
  }
  if (!videoClips.value.some((clip) => hasClipVideoUrl(clip))) {
    message.warning('时间轴上暂无有效视频片段，请先同步前面步骤')
    return null
  }
  if (exportFollowInFlight) {
    message.info('视频正在合成中，请稍候')
    return null
  }

  pauseEpisodeExportFollow()
  exportProgressPercent.value = 0
  const gen = ++exportFollowGeneration
  const abort = new AbortController()
  exportFollowAbort = abort
  exporting.value = true
  const key = 'export'
  try {
    message.loading({ content: '保存时间轴并准备导出…', key, duration: 0 })
    try {
      const saved = await timelineSaver.flushNow()
      if (saved?.timeline) serverTimelineBaseline.value = saved.timeline
    } catch {
      /* 导出仍继续，timelineJson 会随 export 一并提交 */
    }
    if (gen !== exportFollowGeneration || abort.signal.aborted) {
      message.destroy(key)
      return null
    }
    const scopeKey = liveGenScopeKeyFromIds(
      creationStore.currentProjectId,
      creationStore.currentEpisodeId
    )
    const followPromise = exportEpisodeVideoFromTimeline({
      store: creationStore,
      route,
      timeline: {
        videoClips: videoClips.value,
        voiceItems: voiceItems.value,
        subtitleItems: subtitleItems.value,
        musicItems: musicItems.value,
        videoVolumePreset: videoVolumePreset.value,
        globalBgm: props.bgm
      },
      resolution: (timelineResolution.value as 'FHD') || 'FHD',
      // forceRecompose：素材相对上次成功导出有变化时由 exportEpisodeVideoFromTimeline 自动传 true；
      // 未变化不传，允许后端复用已有成片（见接口.md 成片复用规则）
      signal: abort.signal,
      onProgress: (progress) => {
        if (gen !== exportFollowGeneration) return
        showEpisodeExportProgress(progress, key)
      }
    }).then((result) => {
      creationStore.clearEpisodeExportFollowTask(scopeKey)
      if (gen !== exportFollowGeneration) {
        // 离开瞬间刚好成功：壳层仍在，直接弹窗
        notifyExportSuccess(result, key, { openModal: true })
        return {
          videoUrl: result.videoUrl,
          needReaudit: Boolean(result.needReaudit),
          episodeEditorId: result.episodeEditorId
        }
      }
      // 顶栏导出由壳层根据返回值弹窗；此处只更新 UI，避免重复打开
      notifyExportSuccess(result, key, { openModal: false })
      return {
        videoUrl: result.videoUrl,
        needReaudit: Boolean(result.needReaudit),
        episodeEditorId: result.episodeEditorId
      }
    })
    exportFollowInFlight = followPromise.then(() => undefined).catch(() => undefined)
    const result = await followPromise
    return result
  } catch (e: unknown) {
    if (shouldKeepEpisodeExportFollowTask(e) || gen !== exportFollowGeneration) {
      message.destroy(key)
      return null
    }
    message.error({ content: exportApiErr(e, '导出失败'), key, duration: 4 })
    return null
  } finally {
    if (gen === exportFollowGeneration) {
      exporting.value = false
      if (exportFollowAbort === abort) exportFollowAbort = null
      exportFollowInFlight = null
    }
  }
}

let timelineResizeObserver: ResizeObserver | null = null

function syncTrackLabelWidth() {
  const inner = timelineWrapRef.value?.querySelector('.timeline-inner') as HTMLElement | null
  if (!inner) return
  const pad = parseFloat(getComputedStyle(inner).paddingLeft)
  if (Number.isFinite(pad) && pad > 0) trackLabelWidth.value = pad
}

function updateTimelineStripWidth() {
  const wrap = timelineWrapRef.value
  if (!wrap) return
  syncTrackLabelWidth()
  timelineStripWidthPx.value = Math.max(200, wrap.clientWidth - trackLabelWidth.value)
}

onMounted(() => {
  cancelPreviewEditModalPreloads.push(
    preloadComponentWhenIdle(editStoryboardVideoModalLoader.preload),
    preloadComponentWhenIdle(editStoryboardDubbingModalLoader.preload)
  )
  createFlowShell.registerPreviewExportBridge({
    exportFullVideo: handleExport,
    exportSegments: handleDownloadSegments,
    exporting,
    segmentsDownloading
  })
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('resize', updateTimelineStripWidth)
  window.addEventListener('keydown', onPreviewKeyboard)
  window.addEventListener(EPISODE_TIMELINE_REBUILD_EVENT, onEpisodeTimelineRebuildRequested)
  void ensureCanvas()
  void refreshExportStatusFromServer()
  void resumeEpisodeExportFollowIfNeeded()
  normalizeEmptyClipDurations()
  nextTick(() => {
    updateTimelineStripWidth()
    if (typeof ResizeObserver !== 'undefined' && timelineWrapRef.value) {
      timelineResizeObserver = new ResizeObserver(() => updateTimelineStripWidth())
      timelineResizeObserver.observe(timelineWrapRef.value)
    }
  })
  const loop = () => {
    if (scrubbing.value && scrubClientX.value !== null) {
      autoScrollTimelineWhileScrub(scrubClientX.value)
      setCurrentTimeFromClientX(scrubClientX.value)
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
})

function autoInitPlaceholderClipsFromProps() {
  if (videoClips.value.length) return
  const n = Math.max(props.dubbingPanels?.length || 0, props.storyboardVideoPanels?.length || 0)
  if (!n) return

  const list: TimelineVideoClip[] = []
  let cursor = 0
  for (let i = 0; i < n; i++) {
    const dub = props.dubbingPanels?.[i]
    const vp = props.storyboardVideoPanels?.[i]
    const name = dub?.title || vp?.title || `分镜${i + 1}`
    const url = resolvePreviewTimelineVideoUrl(dub, vp)
    const dur = getInitialClipDuration(url)
    list.push({
      id: dub?.id || vp?.id || `placeholder-${i}-${Date.now()}`,
      kind: 'video',
      name,
      url,
      start: cursor,
      duration: dur,
      sourceDuration: dur,
      trimStart: 0,
      trimEnd: dur
    })
    cursor += dur
  }
  videoClips.value = list
  currentTime.value = 0
  playing.value = false
  selectedClip.value = { track: 'video', id: list[0]!.id }
  void hydrateVideoDurationsFromSource()
}

const projectScopeKey = computed(
  () => `${creationStore.currentProjectId ?? ''}:${creationStore.currentEpisodeId ?? ''}`
)
let lastHydratedScopeKey = ''

const previewReadyPosterUrl = computed(() => {
  const clip = getVideoClipAtTime(currentTime.value) || videoClips.value[0] || null
  if (!clip) return ''
  const clipIndex = videoClips.value.findIndex((c) => c.id === clip.id)
  const scriptPanels = (creationStore.formData.storyboardScript?.panels || []) as StoryboardPanel[]
  return resolvePreviewPlayerPosterUrl({
    storyboardId: clip.storyboardId,
    clipIndex: clipIndex >= 0 ? clipIndex : 0,
    scriptPanels
  })
})

const previewReadyVideoClipCount = computed(() => videoClips.value.length)
const previewReadyHasPlayable = computed(() => hasPlayableVideoAtTime(currentTime.value))

const {
  overlayMounted: previewReadyOverlayMounted,
  overlayOpaque: previewReadyOverlayOpaque,
  hintText: previewReadyHintText
} = usePreviewPlayerReadyOverlay({
  scopeKey: projectScopeKey,
  timelineLoading,
  videoClipCount: previewReadyVideoClipCount,
  hasPlayableAtCurrentTime: previewReadyHasPlayable,
  frameReady: nativePreviewFrameReady,
  posterUrl: previewReadyPosterUrl
})

function resetPreviewTimelineState() {
  stopPlayback()
  stopPreviewPlaybackLoop()
  stopAllPreviewAudios()
  previewAudioEls.clear()
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
  rebuildTimer = null
  timelineSaver.cancel()
  currentPreviewToken.value += 1

  videoClips.value = []
  voiceItems.value = []
  subtitleItems.value = []
  musicItems.value = []
  videoVolumePreset.value = {}
  serverTimelineBaseline.value = null
  selectedClip.value = null
  currentTime.value = 0
  playing.value = false
  scrubbing.value = false
  snapIndicatorPx.value = null
  nativePreviewFrameReady.value = false
  lastHydratedScopeKey = ''

  try {
    avCanvas?.destroy?.()
  } catch {}
  avCanvas = null
  avUnsubTime?.()
  avUnsubPlaying?.()
  avUnsubPaused?.()
  avUnsubTime = null
  avUnsubPlaying = null
  avUnsubPaused = null
  mediaBlobCache.clear()
}

function hydrateTimelineForCurrentProject() {
  const scope = projectScopeKey.value
  if (!scope || scope === 'null:null' || scope === ':') return
  if (lastHydratedScopeKey === scope && videoClips.value.length) return

  void (async () => {
    timelineLoading.value = true
    try {
      const { result, ui } = await loadEpisodeTimeline({
        store: creationStore,
        route,
        rebuild: false
      })
      if (projectScopeKey.value !== scope) return
      serverTimelineBaseline.value = result.timeline
      applyServerTimelineUi(ui)
      lastHydratedScopeKey = scope
    } catch {
      if (projectScopeKey.value !== scope) return
      if (buildTimelineFromProps()) {
        lastHydratedScopeKey = scope
        selectedClip.value = videoClips.value[0]
          ? { track: 'video', id: videoClips.value[0]!.id }
          : null
        return
      }
      autoInitPlaceholderClipsFromProps()
      if (videoClips.value.length) lastHydratedScopeKey = scope
    } finally {
      timelineLoading.value = false
    }
  })()
}

watch(projectScopeKey, (next, prev) => {
  if (prev === undefined || next === prev) return
  const wasExporting = exporting.value
  pauseEpisodeExportFollow()
  exporting.value = false
  exportProgressPercent.value = 0
  exportProgressScopeKey = ''
  if (wasExporting) message.destroy('export')
  resetPreviewTimelineState()
  nextTick(() => {
    hydrateTimelineForCurrentProject()
    void refreshExportStatusFromServer()
    void resumeEpisodeExportFollowIfNeeded()
  })
})

watch(
  () =>
    [
      projectScopeKey.value,
      props.dubbingPanels?.length || 0,
      props.storyboardVideoPanels?.length || 0,
      props.bgm || ''
    ] as const,
  () => {
    hydrateTimelineForCurrentProject()
  },
  { immediate: true }
)

watch(
  () => videoClips.value.map((clip) => `${clip.id}:${clip.duration}`).join('|'),
  () => {
    syncMusicTimelineDurations()
  }
)

onUnmounted(() => {
  for (const cancel of cancelPreviewEditModalPreloads.splice(0)) cancel()
  pauseEpisodeExportFollow()
  createFlowShell.registerPreviewExportBridge(null)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('resize', updateTimelineStripWidth)
  window.removeEventListener('keydown', onPreviewKeyboard)
  window.removeEventListener(EPISODE_TIMELINE_REBUILD_EVENT, onEpisodeTimelineRebuildRequested)
  timelineSaver.cancel()
  timelineResizeObserver?.disconnect()
  timelineResizeObserver = null
  if (autoFollowResumeTimer) window.clearTimeout(autoFollowResumeTimer)
  stopPreviewPlaybackLoop()
  stopAllPreviewAudios()
  previewAudioEls.clear()
  previewVideoPreloads.forEach((el) => {
    try {
      el.removeAttribute('src')
      el.load()
    } catch {}
  })
  previewVideoPreloads.clear()
  slotSrcA = ''
  slotSrcB = ''
  activeNativeClipId = ''
  standbyPreparedClipId = ''
  standbyPrepareToken = 0
  try { avCanvas?.destroy?.() } catch {}
  avCanvas = null
  avUnsubTime?.(); avUnsubPlaying?.(); avUnsubPaused?.()
  mediaBlobCache.clear()
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
})

</script>

<style lang="scss" scoped>
.video-preview-step {
  /* 时间轴尺寸用大写 PX，避开 pxtorem，保证大小分辨率视觉一致 */
  --vp-timeline-label-w: 72PX;
  --vp-track-aux-h: 28PX;
  --vp-track-aux-clip-h: 22PX;
  --vp-track-aux-clip-top: 3PX;
  --vp-track-video-h: 68PX;
  --vp-track-video-clip-h: 60PX;
  --vp-track-row-aux-min: 32PX;
  --vp-track-row-video-min: 72PX;
  --vp-clip-edit-pad-y: 2PX;
  --vp-clip-edit-pad-x: 6PX;
  --vp-clip-edit-font: 11PX;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.preview-toolbar {
  position: relative;
  z-index: 10000;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  button{
    font-size: 14px;
  }
}

.hidden-file-input {
  display: none;
}

.preview-simple-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.preview-player-wrap {
  flex: 1 1 0;
  min-height: 0;
  background: var(--dark-bg);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.preview-player-area {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #000;
}

.preview-canvas-host {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.preview-canvas-host :deep(canvas) {
  width: auto !important;
  height: auto !important;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 16 / 9;
  object-fit: contain;
  display: block;
}

.preview-canvas-host-behind {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.preview-native-video {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  background: #000;
  opacity: 0;
  pointer-events: none;
}

.preview-native-video.is-active {
  z-index: 2;
  opacity: 1;
}

.preview-subtitle-overlay {
  position: absolute;
  left: 50%;
  bottom: 3%;
  z-index: 3;
  transform: translateX(-50%);
  max-width: 86%;
  padding: 6px 14px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 18px;
  line-height: 1.45;
  text-align: center;
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
}

.preview-ready-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease;
  background:
    radial-gradient(ellipse at 50% 40%, rgba(40, 48, 64, 0.95) 0%, rgba(0, 0, 0, 0.96) 70%);
}

.preview-ready-overlay.is-opaque {
  opacity: 1;
}

.preview-ready-overlay__poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  background: #000;
}

.preview-ready-overlay__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.18) 0%,
    rgba(0, 0, 0, 0.45) 100%
  );
}

.preview-ready-overlay__hint {
  position: relative;
  z-index: 1;
  margin-top: 28%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  line-height: 1.2;
}

.preview-ready-overlay__spin {
  font-size: 14px;
}

.preview-no-video-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.88);
  color: rgba(255, 255, 255, 0.72);
  pointer-events: none;
}

.preview-no-video-icon {
  font-size: 40px;
  color: rgba(255, 255, 255, 0.45);
}

.preview-no-video-overlay p {
  margin: 0;
  font-size: 14px;
}

.preview-overlay-controls {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--dark-text-muted);
  gap: var(--spacing-sm);
}

.preview-placeholder .placeholder-icon {
  font-size: 48px;
}

.preview-overlay-controls .dubbing-video-play-btn {
  pointer-events: auto;
  z-index: 4;
}

.preview-overlay-controls .volume-btn {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: #fff;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 4;
}

.timeline-wrap {
  flex: 0 0 auto;
  position: relative;
  background: linear-gradient(180deg, rgba(18, 24, 38, 0.98) 0%, rgba(12, 16, 26, 0.98) 100%);
  border: 1px solid rgba(74, 231, 253, 0.12);
  border-radius: var(--radius-md);
  overflow-x: auto;
  overflow-y: hidden;
  cursor: col-resize;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.timeline-wrap::-webkit-scrollbar {
  display: none;
}

.timeline-inner {
  position: relative;
  min-width: 100%;
  padding-left: var(--vp-timeline-label-w);
}

.timeline-ruler {
  position: sticky;
  top: 0;
  z-index: 4;
  height: 34px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 14, 24, 0.96);
  isolation: isolate;
}

.timeline-grid-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--vp-timeline-label-w);
  pointer-events: none;
  z-index: 0;
}

.ruler-grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  pointer-events: none;
}

.ruler-grid-line-major {
  background: rgba(255, 255, 255, 0.1);
}

.ruler-grid-line-medium {
  background: rgba(255, 255, 255, 0.05);
}

.ruler-grid-line-minor {
  background: rgba(255, 255, 255, 0.025);
}

.ruler-tick {
  position: absolute;
  top: 0;
  width: 1px;
  pointer-events: none;
}

.ruler-tick-major {
  height: 16px;
  background: rgba(255, 255, 255, 0.55);
}

.ruler-tick-medium {
  height: 10px;
  background: rgba(255, 255, 255, 0.28);
}

.ruler-tick-minor {
  height: 6px;
  background: rgba(255, 255, 255, 0.14);
}

.ruler-label {
  position: absolute;
  top: 18px;
  left: 4px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.72);
  white-space: nowrap;
}

.ruler-playhead-cap {
  position: absolute;
  top: 0;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  background: #facc15;
  clip-path: polygon(50% 100%, 0 0, 100% 0);
  pointer-events: none;
  z-index: 5;
}

.timeline-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #facc15 0%, #22c55e 35%, #22c55e 100%);
  pointer-events: none;
  z-index: 6;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.45);
}

.playhead-head {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 10px;
  height: 10px;
  background: #facc15;
  clip-path: polygon(50% 100%, 0 0, 100% 0);
}

.timeline-tracks {
  position: relative;
  padding-top: 2px;
  overflow: visible;
}

.track-row {
  display: flex;
  align-items: center;
  min-height: var(--vp-track-row-aux-min);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  position: relative;
  overflow: visible;
}

.track-row-video {
  min-height: var(--vp-track-row-video-min);
}

.track-row-volume {
  min-height: var(--vp-track-row-aux-min);
}

.track-row-aux {
  min-height: var(--vp-track-row-aux-min);
}

.track-strip-volume {
  height: var(--vp-track-aux-h);
}

.volume-bar-segment {
  position: absolute;
  top: var(--vp-track-aux-clip-top);
  height: var(--vp-track-aux-clip-h);
  pointer-events: auto;
  overflow: visible;
  z-index: 2;
}

.volume-bar-segment-active {
  z-index: 5;
}

.volume-bar-shell {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  cursor: ns-resize;
}

.volume-bar-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(74, 231, 253, 0.54), rgba(59, 130, 246, 0.32));
  transition: height 0.08s ease, background 0.18s ease;
  pointer-events: none;
}

.volume-bar-segment-active .volume-bar-shell {
  border-color: rgba(74, 231, 253, 0.18);
}

.volume-bar-segment-active .volume-bar-fill,
.volume-bar-fill-dragging {
  background: linear-gradient(180deg, rgba(74, 231, 253, 0.48), rgba(59, 130, 246, 0.34));
}

.volume-bar-fill-dragging {
  transition: none;
}

.volume-bar-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11PX;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  pointer-events: none;
  z-index: 2;
}

.track-strip-dubbing,
.track-strip-subtitle,
.track-strip-music,
.track-strip-aux {
  height: var(--vp-track-aux-h);
}

.track-strip-dubbing {
  height: var(--vp-track-aux-h);
}

.dubbing-wave-layer {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    rgba(59, 130, 246, 0.15) 0,
    rgba(59, 130, 246, 0.15) 2px,
    transparent 2px,
    transparent 4px
  );
  mask-image: linear-gradient(
    180deg,
    transparent 0%,
    rgba(0, 0, 0, 0.85) 35%,
    rgba(0, 0, 0, 0.85) 100%
  );
}

.track-clip-dubbing-has-audio {
  background: rgba(37, 99, 235, 0.55);
}

.track-clip-dubbing .clip-text {
  position: relative;
  z-index: 1;
}

.track-clip-dubbing:hover .clip-hover-mask-dubbing,
.track-clip-empty-record:hover .clip-hover-mask-dubbing {
  opacity: 1;
}

.track-clip-subtitle:hover .clip-hover-mask-subtitle {
  opacity: 1;
}

.track-clip-music:hover .clip-hover-mask-music,
.track-clip-music-empty:hover .clip-hover-mask-music {
  opacity: 1;
}

.track-strip-music {
  overflow: visible;
}

.music-wave-layer {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    rgba(249, 115, 22, 0.18) 0,
    rgba(249, 115, 22, 0.18) 2px,
    transparent 2px,
    transparent 4px
  );
  mask-image: linear-gradient(
    180deg,
    transparent 0%,
    rgba(0, 0, 0, 0.85) 35%,
    rgba(0, 0, 0, 0.85) 100%
  );
}

.track-clip-music-has-audio {
  background: rgba(249, 115, 22, 0.55);
}

.track-row:last-child {
  border-bottom: none;
}

.timeline-ruler-gutter {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 9;
  width: 72px;
  height: 34px;
  margin-left: -72px;
  margin-bottom: -34px;
  flex-shrink: 0;
  pointer-events: none;
  background: rgba(10, 14, 24, 0.98);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 6px 0 14px rgba(0, 0, 0, 0.38);
}

.track-label {
  position: sticky;
  left: 0;
  z-index: 8;
  margin-left: -72px;
  width: 72px;
  min-width: 72px;
  padding: 0 10px 0 8px;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(10, 14, 24, 0.98);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 6px 0 14px rgba(0, 0, 0, 0.38);
}

.track-strip {
  position: relative;
  flex: 1;
  height: var(--vp-track-aux-h);
  min-width: 0;
}

.track-strip-video {
  height: var(--vp-track-video-h);
}

.track-strip-clickable {
  cursor: crosshair;
}

.track-clip {
  position: absolute;
  top: var(--vp-track-aux-clip-top);
  height: var(--vp-track-aux-clip-h);
  border-radius: 6px;
  overflow: hidden;
  user-select: none;
  touch-action: none;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.12);
  /* 不同步动画 left/width，避免刷新/同步后重排时出现短暂大间隔 */
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.clip-text {
  font-size: 12px;
  color: #fff;
  padding: 0 8px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: var(--vp-track-aux-clip-h);
}

.track-clip-video {
  top: 4PX;
  height: var(--vp-track-video-clip-h);
  border-radius: 8px;
  border-color: rgba(255, 255, 255, 0.18);
  background: #1a2233;
  cursor: pointer;
}

.track-clip-video-empty {
  border-style: dashed;
  border-color: rgba(74, 231, 253, 0.35);
  background: linear-gradient(135deg, rgba(74, 231, 253, 0.08), rgba(18, 24, 38, 0.95));
  min-width: 96px;
}

.track-clip-selected {
  outline: 2px solid #4ae7fd;
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.35), 0 8px 20px rgba(74, 231, 253, 0.15);
}

.track-clip-video.track-clip-selected::after {
  content: '当前分镜';
  position: absolute;
  right: 6px;
  top: 6px;
  font-size: 10px;
  color: #4ae7fd;
  background: rgba(0, 0, 0, 0.65);
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 3;
}

.track-clip-swapping {
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.55), 0 6px 14px rgba(74, 231, 253, 0.25);
  transform: translateY(-1px);
}

.clip-thumb-video,
.clip-thumb-placeholder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.clip-thumb-placeholder {
  background: linear-gradient(135deg, rgba(74, 231, 253, 0.12), rgba(30, 41, 59, 0.9));
  display: flex;
  align-items: center;
  justify-content: center;
}

.clip-thumb-placeholder__icon {
  opacity: 0.72;
}

.clip-video-meta {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.72) 100%);
  pointer-events: none;
  z-index: 1;
}

.clip-page-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #4ae7fd;
}

.track-clip-video .clip-text {
  font-size: 12px;
  line-height: 1.3;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-hover-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  background: rgba(8, 12, 20, 0.42);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: opacity 0.2s ease;
  z-index: 2;
  pointer-events: none;
}

.track-clip-video:hover .clip-hover-mask {
  opacity: 1;
  pointer-events: auto;
}

.clip-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 3PX;
  padding: var(--vp-clip-edit-pad-y) var(--vp-clip-edit-pad-x);
  border: 1px solid rgba(74, 231, 253, 0.45);
  border-radius: 6PX;
  background: rgba(74, 231, 253, 0.16);
  color: #e8fbff;
  font-size: var(--vp-clip-edit-font);
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.clip-edit-btn:hover {
  background: rgba(74, 231, 253, 0.28);
  border-color: rgba(74, 231, 253, 0.75);
}

.clip-edit-btn:active {
  transform: scale(0.98);
}

.track-clip-dubbing {
  background: rgba(59, 130, 246, 0.6);
}

.track-clip-subtitle {
  background: rgba(34, 197, 94, 0.5);
  cursor: pointer;
}

.track-clip-music {
  overflow: hidden;
  cursor: pointer;
}

.track-clip-music-empty {
  border: 1px dashed rgba(255, 255, 255, 0.35);
  opacity: 0.88;
  background: rgba(249, 115, 22, 0.18);
}

.music-source-cycle {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(255, 255, 255, 0.16);
  border-right: 1px dashed rgba(255, 255, 255, 0.45);
  pointer-events: none;
  z-index: 0;
}

.track-clip-music .clip-text {
  position: relative;
  z-index: 1;
}

.track-clip-empty-record {
  border: 1px dashed rgba(255, 255, 255, 0.35);
  opacity: 0.88;
  cursor: pointer;
}

.track-clip-empty-record .clip-text {
  color: rgba(255, 255, 255, 0.92);
}

.clip-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
}

.clip-handle-left {
  left: 0;
}

.clip-handle-right {
  right: 0;
}

.subtitle-range-mask {
  position: absolute;
  top: 4px;
  bottom: 4px;
  background: rgba(74, 231, 253, 0.25);
  border: 1px dashed rgba(74, 231, 253, 0.85);
}

.snap-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #4ae7fd;
  pointer-events: none;
  z-index: 3;
}

.subtitle-edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subtitle-edit-form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subtitle-edit-form-label {
  color: var(--dark-text, #e6edf3);
  font-size: 13px;
}

.subtitle-size-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.subtitle-size-row :deep(.ant-slider) {
  flex: 1;
  margin: 0;
}

.subtitle-size-value {
  width: 52px;
  text-align: right;
  color: var(--dark-text-muted, #9db0c8);
  font-size: 12px;
}
</style>

<style lang="scss">
.episode-export-progress-toast {
  width: min(280px, 62vw);
  padding: 2px 0;
  text-align: left;
}

.episode-export-progress-toast__hide-default-icon {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  overflow: hidden;
}

.episode-export-progress-toast__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 8px;
  color: #eaf4ff;
  font-size: 13px;
  line-height: 20px;
}

.episode-export-progress-toast__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.episode-export-progress-toast__spin {
  flex-shrink: 0;
  font-size: 14px;
  color: #4ae7fd;
}

.episode-export-progress-toast__percent {
  min-width: 34px;
  color: #55e7ff;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* message.loading 默认图标与自定义块并排时会顶到上一行；有本 toast 时隐藏默认图标 */
html.app-shell-create .ant-message-custom-content:has(.episode-export-progress-toast) > .anticon {
  display: none !important;
}

html.app-shell-create .ant-message-custom-content:has(.episode-export-progress-toast) {
  align-items: stretch;
}

.episode-export-progress-toast__track {
  position: relative;
  height: 8px;
  overflow: hidden;
  border: 1px solid rgba(79, 225, 255, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.28);
}

.episode-export-progress-toast__bar {
  position: absolute;
  inset: 0 auto 0 0;
  overflow: hidden;
  border-radius: inherit;
  background: linear-gradient(90deg, #19c6eb 0%, #49dfd0 58%, #7df6c7 100%);
  box-shadow: 0 0 12px rgba(73, 223, 208, 0.7);
  transition: width 420ms ease-out;
}

.episode-export-progress-toast__bar::after {
  position: absolute;
  inset: 0;
  width: 46%;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.72) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  content: '';
  transform: translateX(-130%) skewX(-18deg);
  animation: episode-export-progress-shimmer 1.35s linear infinite;
}

@keyframes episode-export-progress-shimmer {
  to {
    transform: translateX(310%) skewX(-18deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .episode-export-progress-toast__bar {
    transition: none;
  }

  .episode-export-progress-toast__bar::after {
    animation: none;
  }
}
</style>
