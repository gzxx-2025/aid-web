<template>
  <div class="video-preview-step">
    <div class="preview-toolbar">
      <a-button size="small" @click="syncFromPreviousSteps">
        <template #icon><SyncOutlined /></template>
        从前面步骤同步到时间轴
      </a-button>
      <a-button type="primary" size="small" :loading="exporting" @click="handleExport">
        <template #icon><ExportOutlined /></template>
        导出视频
      </a-button>

      <input ref="audioInputRef" class="hidden-file-input" type="file" accept="audio/*" @change="onAudioFileSelected" />
    </div>

    <div class="preview-simple-wrap">
      <div class="preview-player-wrap">
        <div class="preview-player-area">
          <div ref="canvasHostRef" class="preview-canvas-host" :class="{ 'preview-canvas-host-behind': showNativePreviewVideo }" />
          <video
            v-if="showNativePreviewVideo"
            ref="nativePreviewVideoRef"
            :key="nativePreviewVideoUrl"
            :src="nativePreviewVideoUrl"
            class="preview-native-video"
            playsinline
            preload="auto"
            @loadedmetadata="syncNativePreviewVideoTime"
            @canplay="syncNativePreviewVideoTime"
          />
          <div v-if="activeSubtitleText" class="preview-subtitle-overlay">{{ activeSubtitleText }}</div>
          <div v-if="showNoVideoOverlay" class="preview-no-video-overlay">
            <VideoCameraOutlined class="preview-no-video-icon" />
            <p>暂无视频无法播放</p>
          </div>
          <div v-if="!videoClips.length" class="preview-placeholder">
            <EyeOutlined class="placeholder-icon" />
            <p>请先同步前面步骤</p>
          </div>
          <div v-else :class="['preview-overlay-controls', { 'preview-overlay-controls-playing': playing }]">
            <button type="button" class="play-btn" aria-label="播放/暂停" @click="togglePlay">
              <PauseOutlined v-if="playing" />
              <PlayCircleOutlined v-else />
            </button>
            <button type="button" class="volume-btn" aria-label="音量" @click="toggleMute">
              <SoundOutlined v-if="!muted" />
              <AudioMutedOutlined v-else />
            </button>
          </div>
        </div>
      </div>

      <div
        class="timeline-wrap"
        ref="timelineWrapRef"
        @pointerdown="onTimelinePointerDown"
        @scroll="onTimelineUserScroll"
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
                  <div v-else class="clip-thumb-placeholder" />
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
                  @dblclick.stop="editSubtitle(item.id)"
                >
                  <span class="clip-text">{{ item.text || '有字幕' }}</span>
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
                </div>
                <div v-if="subtitleRange.active" class="subtitle-range-mask" :style="subtitleRangeStyle" />
              </div>
            </div>

            <div class="track-row track-row-aux track-row-music">
              <div class="track-label">音乐</div>
              <div
                class="track-strip track-strip-aux track-strip-music"
                :class="{ 'track-strip-music--hovered': musicStripHovered }"
                data-track="music"
                @mouseenter="onMusicStripMouseEnter"
                @mouseleave="onMusicStripMouseLeave"
              >
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
                </div>
                <div
                  v-show="musicStripHovered"
                  class="music-edit-btn-viewport"
                  :style="{ left: `${musicEditBtnLeftPx}px` }"
                >
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

      <Transition name="audio-panel-slide">
        <div v-if="selectedVoiceItem" class="audio-config-shell">
          <div class="audio-config-divider" aria-hidden="true" />
          <div class="audio-config-panel">
            <div class="audio-config-title">音频设置（配音）</div>
            <div class="audio-config-row">
              <span>音量</span>
              <a-slider v-model:value="selectedVoiceItem.volume" :min="0" :max="2" :step="0.05" @change="scheduleRebuild('audio')" />
            </div>
            <div class="audio-config-row">
              <span>淡入(s)</span>
              <a-input-number v-model:value="selectedVoiceItem.fadeIn" :min="0" :step="0.1" size="small" @change="scheduleRebuild('audio')" />
              <span>淡出(s)</span>
              <a-input-number v-model:value="selectedVoiceItem.fadeOut" :min="0" :step="0.1" size="small" @change="scheduleRebuild('audio')" />
              <a-checkbox v-model:checked="selectedVoiceItem.loop" @change="scheduleRebuild('audio')">循环</a-checkbox>
            </div>
            <div class="audio-config-row">
              <span>音量曲线(0~2)</span>
              <a-input
                v-model:value="selectedAudioCurveText"
                placeholder="例: 0.6,1,0.7"
                @blur="applyCurveText"
              />
            </div>
          </div>
        </div>
      </Transition>
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
      v-if="editingVideoClipIndex >= 0"
      :key="`preview-video-${storyboardVideoPanels[editingVideoClipIndex]?.id ?? editingVideoClipIndex}`"
      v-model:open="isVideoModalOpen"
      :scene-index="editingVideoClipIndex"
      :editor-scope-key="`preview-video-${storyboardVideoPanels[editingVideoClipIndex]?.id ?? editingVideoClipIndex}`"
      :scenes="videoScenes"
      @update="handleVideoUpdate"
    />

    <EditStoryboardDubbingModal
      v-if="editingDubbingClipIndex >= 0"
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
      v-model:open="isMusicModalOpen"
      :initial-music-name="activeMusicItem?.name"
      :initial-volume="activeMusicItem?.volume ?? 0.25"
      @confirm="onMusicPickerConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  SyncOutlined,
  ExportOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseOutlined,
  SoundOutlined,
  AudioMutedOutlined,
  EditOutlined,
  VideoCameraOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { StoryboardVideoPanel, DubbingPanel, StoryboardPanel } from '~/types'
import { useWebAVExport } from '@/composables/useWebAVExport'
import { useCreationStore } from '~/stores/creation'
import EditStoryboardVideoModal from './EditStoryboardVideoModal.vue'
import EditStoryboardDubbingModal from './EditStoryboardDubbingModal.vue'
import MusicPickerModal from './MusicPickerModal.vue'
import type { MusicPickerConfirmPayload } from './MusicPickerModal.vue'

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
}

type TimelineSubtitleItem = TimelineBase & {
  kind: 'subtitle'
  text: string
  videoClipId?: string
  fontSize: number
}

const props = defineProps<{
  storyboardVideoPanels: StoryboardVideoPanel[]
  dubbingPanels: DubbingPanel[]
  bgm?: string
}>()

const creationStore = useCreationStore()
const isVideoModalOpen = ref(false)
const editingVideoClipIndex = ref(-1)
const isDubbingModalOpen = ref(false)
const editingDubbingClipIndex = ref(-1)
const isMusicModalOpen = ref(false)
const musicStripHovered = ref(false)
const musicEditBtnLeftPx = ref(0)
const videoVolumePreset = ref<Record<string, number>>({})
const volumeHoverClipId = ref<string | null>(null)
const volumeDrag = ref<{ clipId: string; startY: number; startVolume: number; barHeight: number } | null>(null)

const timelineWrapRef = ref<HTMLElement | null>(null)
const subtitleStripRef = ref<HTMLElement | null>(null)
const canvasHostRef = ref<HTMLElement | null>(null)
const nativePreviewVideoRef = ref<HTMLVideoElement | null>(null)
const audioInputRef = ref<HTMLInputElement | null>(null)

const playing = ref(false)
const muted = ref(false)
const exporting = ref(false)
const { exportTimelineToMp4 } = useWebAVExport()

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
/** 相邻片段之间的视觉间隔（像素） */
const CLIP_GAP_PX = 4
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
  const gapTotal = n > 1 ? CLIP_GAP_PX * (n - 1) : 0

  if (!n) {
    return {
      totalWidthPx: Math.max(400, timelineStripWidthPx.value),
      entries: [] as ClipLayoutEntry[]
    }
  }

  const stripW = Math.max(200, timelineStripWidthPx.value)
  const usable = stripW - gapTotal
  const equalShare = usable / n
  const fitsInViewport = equalShare >= MIN_CLIP_WIDTH_PX

  let widths: number[]

  if (fitsInViewport) {
    const hasVideo = clips.some((c) => hasClipVideoUrl(c))
    if (!hasVideo) {
      widths = clips.map(() => equalShare)
    } else if (n === 1) {
      widths = [usable]
    } else {
      const totalDur = clips.reduce((s, c) => s + c.duration, 0) || 1
      widths = clips.map((c) => Math.max(MIN_CLIP_WIDTH_PX, (c.duration / totalDur) * usable))
      const sum = widths.reduce((a, b) => a + b, 0)
      if (Math.abs(sum - usable) > 0.5) {
        const scale = usable / sum
        widths = widths.map((w) => w * scale)
      }
    }
  } else {
    widths = clips.map((c) => {
      if (hasClipVideoUrl(c)) {
        return Math.max(MIN_CLIP_WIDTH_PX, c.duration * scalePxPerSec)
      }
      return MIN_CLIP_WIDTH_PX
    })
  }

  let left = 0
  const entries: ClipLayoutEntry[] = clips.map((clip, i) => {
    const entry: ClipLayoutEntry = {
      id: clip.id,
      leftPx: left,
      widthPx: widths[i]!,
      startSec: clip.start,
      durationSec: clip.duration
    }
    left += widths[i]! + (i < n - 1 ? CLIP_GAP_PX : 0)
    return entry
  })

  return {
    totalWidthPx: Math.max(stripW, left),
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
const playheadLeftPx = computed(() => trackLabelWidth.value + secToLayoutPx(currentTime.value))
const scrubbing = ref(false)
const scrubClientX = ref<number | null>(null)
const autoFollowEnabled = ref(true)
let autoFollowResumeTimer: number | null = null
let suppressScrollFollowPause = false
const selectedVideoClip = computed(() => {
  if (selectedClip.value?.track !== 'video') return null
  return videoClips.value.find((x) => x.id === selectedClip.value?.id) || null
})
const selectedVoiceItem = computed(() => {
  if (selectedClip.value?.track !== 'voice') return null
  return voiceItems.value.find((x) => x.id === selectedClip.value?.id) || null
})
const selectedAudioCurveText = ref('')
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

function secToLayoutPx(sec: number): number {
  const entries = clipDisplayLayout.value.entries
  if (!entries.length) return Math.max(0, sec * scalePxPerSec)

  for (const entry of entries) {
    const endSec = entry.startSec + entry.durationSec
    if (sec <= endSec + 0.0001) {
      if (sec <= entry.startSec + 0.0001) return entry.leftPx
      const ratio = (sec - entry.startSec) / entry.durationSec
      return entry.leftPx + ratio * entry.widthPx
    }
  }

  const last = entries[entries.length - 1]!
  return last.leftPx + last.widthPx
}

function layoutPxToSec(px: number): number {
  const entries = clipDisplayLayout.value.entries
  if (!entries.length) return Math.max(0, px / scalePxPerSec)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    const rightPx = entry.leftPx + entry.widthPx
    const isLast = i === entries.length - 1
    if (px < rightPx || (isLast && px <= rightPx + 0.001)) {
      if (px <= entry.leftPx) return entry.startSec
      const ratio = Math.max(0, Math.min(1, (px - entry.leftPx) / entry.widthPx))
      return entry.startSec + ratio * entry.durationSec
    }
  }

  const last = entries[entries.length - 1]!
  return last.startSec + last.durationSec
}

function clipStyle(
  seg: { start: number; duration: number; id?: string; videoClipId?: string },
  gapIndex?: number
) {
  const layout = clipDisplayLayout.value
  const idx = getVideoClipGapIndex(seg, gapIndex)
  const entry = layout.entries[idx]
  if (!entry) return { left: '0px', width: '8px' }

  const isLast = idx >= layout.entries.length - 1
  const clipEndSec = entry.startSec + entry.durationSec
  const segEnd = seg.start + seg.duration
  const isFullClip =
    Math.abs(seg.start - entry.startSec) < 0.02 && Math.abs(segEnd - clipEndSec) < 0.02

  if (isFullClip) {
    const width = Math.max(8, entry.widthPx - (isLast ? 0 : CLIP_GAP_PX))
    return {
      left: entry.leftPx + 'px',
      width: width + 'px'
    }
  }

  const leftPx = secToLayoutPx(seg.start)
  const rightPx = secToLayoutPx(segEnd)
  return {
    left: leftPx + 'px',
    width: Math.max(8, rightPx - leftPx) + 'px'
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
  for (const clip of videoClips.value) {
    const end = clip.start + clip.duration
    if (t >= clip.start - 0.001 && t < end - 0.001) return clip
  }
  return null
}

function hasPlayableVideoAtTime(timeSec: number): boolean {
  const clip = getVideoClipAtTime(timeSec)
  return !!clip && hasClipVideoUrl(clip)
}

/** 从指定时间点起，向后查找连续有视频的分镜段，返回该段结束时间（秒） */
function getContinuousPlayableEndSec(fromSec: number): number | null {
  const clips = getOrderedVideoClips()
  if (!clips.length) return null

  const t = Number(fromSec.toFixed(3))
  let startIdx = clips.findIndex((c) => {
    const end = c.start + c.duration
    return t >= c.start - 0.001 && t < end - 0.001
  })
  if (startIdx < 0) {
    startIdx = clips.findIndex((c) => Math.abs(t - (c.start + c.duration)) < 0.02)
  }
  if (startIdx < 0) return null

  const startClip = clips[startIdx]!
  if (!hasClipVideoUrl(startClip)) return null

  let endSec = startClip.start + startClip.duration
  for (let i = startIdx + 1; i < clips.length; i++) {
    const prev = clips[i - 1]!
    const curr = clips[i]!
    if (Math.abs(curr.start - (prev.start + prev.duration)) > 0.02) break
    if (!hasClipVideoUrl(curr)) break
    endSec = curr.start + curr.duration
  }
  return Number(endSec.toFixed(3))
}

function refreshPreviewPlayEndSec(fromSec: number) {
  previewPlayEndSec = getContinuousPlayableEndSec(fromSec) ?? fromSec
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

function mapVolumeToGain(vol: number) {
  return Math.max(0, Math.min(1, vol / 2))
}

function getPreviewAudioEl(id: string, url: string) {
  let el = previewAudioEls.get(id)
  if (!el) {
    el = new Audio()
    el.preload = 'auto'
    previewAudioEls.set(id, el)
  }
  if (el.src !== url) el.src = url
  return el
}

function stopAllPreviewAudios() {
  for (const el of previewAudioEls.values()) {
    try {
      el.pause()
    } catch {}
  }
}

function syncPreviewAudios() {
  const t = currentTime.value
  const shouldPlay = playing.value && !muted.value

  for (const voice of voiceItems.value) {
    if (!voice.url) continue
    const audio = getPreviewAudioEl(`voice-${voice.id}`, voice.url)
    audio.volume = mapVolumeToGain(voice.volume ?? 1)
    const inRange = t >= voice.start && t < voice.start + voice.duration
    if (shouldPlay && inRange) {
      const offset = t - voice.start
      if (Math.abs(audio.currentTime - offset) > 0.25) {
        try {
          audio.currentTime = Math.max(0, offset)
        } catch {}
      }
      if (audio.paused) audio.play().catch(() => {})
    } else if (!audio.paused) {
      audio.pause()
    }
  }

  for (const music of musicItems.value) {
    if (!music.url) continue
    const audio = getPreviewAudioEl(`music-${music.id}`, music.url)
    audio.volume = mapVolumeToGain(music.volume ?? 1)
    const inRange = t >= music.start && t < music.start + music.duration
    if (shouldPlay && inRange) {
      const sourceDur = music.sourceDuration && music.sourceDuration > 0 ? music.sourceDuration : music.duration
      let offset = t - music.start
      if (music.loop && sourceDur > 0) {
        offset = offset % sourceDur
      } else {
        offset = Math.max(0, Math.min(offset, sourceDur))
      }
      if (Math.abs(audio.currentTime - offset) > 0.25) {
        try {
          audio.currentTime = Math.max(0, offset)
        } catch {}
      }
      if (audio.paused) audio.play().catch(() => {})
    } else if (!audio.paused) {
      audio.pause()
    }
  }
}

function syncNativePreviewVideoTime() {
  const el = nativePreviewVideoRef.value
  const clip = getVideoClipAtTime(currentTime.value)
  if (!el || !clip || !hasClipVideoUrl(clip)) return

  const voice = getVoiceItemForVideoClip(clip.id)
  const vol = getVideoVolume(clip.id)
  el.muted = muted.value || !!voice?.url
  if (!voice?.url) el.volume = muted.value ? 0 : mapVolumeToGain(vol)

  const offset = Math.max(0, currentTime.value - clip.start + (clip.trimStart || 0))
  try {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      const target = Math.min(offset, Math.max(0, el.duration - 0.05))
      if (Math.abs(el.currentTime - target) > 0.12) el.currentTime = target
    } else if (Math.abs(el.currentTime - offset) > 0.12) {
      el.currentTime = offset
    }
  } catch {}

  if (playing.value) {
    if (el.paused) el.play().catch(() => {})
  } else if (!el.paused) {
    el.pause()
  }
}

function stopPreviewPlaybackLoop() {
  if (previewPlayRaf !== null) {
    cancelAnimationFrame(previewPlayRaf)
    previewPlayRaf = null
  }
}

function finishPreviewPlayback() {
  stopPreviewPlaybackLoop()
  stopAllPreviewAudios()
  const el = nativePreviewVideoRef.value
  if (el) {
    try {
      el.pause()
    } catch {}
  }
  playing.value = false
}

function startPreviewPlaybackLoop() {
  stopPreviewPlaybackLoop()
  previewPlayStartedAt = performance.now()
  previewPlayStartSec = currentTime.value
  refreshPreviewPlayEndSec(previewPlayStartSec)

  const tick = () => {
    if (!playing.value) {
      previewPlayRaf = null
      return
    }
    const elapsed = (performance.now() - previewPlayStartedAt) / 1000
    const maxSec = Math.min(totalDuration.value, previewPlayEndSec)
    const next = Math.min(maxSec, previewPlayStartSec + elapsed)
    currentTime.value = Number(next.toFixed(3))
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
    const videos = panels[sceneIndex].videos || []
    const storyboardVideo = videos.find((v: any) => v.isStoryboardVideo) || videos[0]
    if (storyboardVideo?.url) {
      clip.url = storyboardVideo.url
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

  const lipVideo = dub.dubbingLipSyncVideoUrl?.trim()
  const vPanel = props.storyboardVideoPanels[index]
  const fallbackVideo =
    vPanel?.videos?.find((v: any) => v.isStoryboardVideo)?.url ||
    vPanel?.videos?.[0]?.url ||
    ''
  const nextVideoUrl = lipVideo || fallbackVideo
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
      voice.url = voiceUrl
      voice.name = dub.title || voice.name
      voice.start = clip.start
      if (voice.duration > clip.duration) voice.duration = clip.duration
    } else {
      voiceItems.value.push({
        id: `voice-${clip.id}`,
        kind: 'voice',
        name: dub.title || `配音 ${index + 1}`,
        url: voiceUrl,
        videoClipId: clip.id,
        start: clip.start,
        duration: clip.duration,
        volume: presetVol,
        fadeIn: 0,
        fadeOut: 0,
        loop: false,
        volumeCurve: [presetVol, presetVol, presetVol]
      })
    }
  }

  const dialogue = dub.dialogue?.trim()
  const sub = subtitleItems.value.find((s) => s.videoClipId === clip.id)
  if (dialogue) {
    if (sub) {
      sub.text = dialogue
      sub.start = clip.start
      if (sub.duration > clip.duration) sub.duration = Math.max(MIN_DURATION, Number(clip.duration.toFixed(2)))
    } else {
      subtitleItems.value.push({
        id: `sub-${clip.id}`,
        kind: 'subtitle',
        text: dialogue,
        fontSize: 40,
        videoClipId: clip.id,
        start: clip.start,
        duration: Math.min(3, clip.duration)
      })
    }
  } else if (sub) {
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
}

function handleStoryboardVideoPanelsUpdate(next: StoryboardVideoPanel[]) {
  creationStore.formData.storyboardVideo.panels = next.map((p) => ({ ...p }))
  next.forEach((panel, index) => {
    const clip = videoClips.value[index] || videoClips.value.find((c) => c.id === panel.id)
    if (!clip) return
    const storyboardVideo = panel.videos?.find((v: any) => v.isStoryboardVideo) || panel.videos?.[0]
    if (storyboardVideo?.url && storyboardVideo.url !== clip.url) {
      clip.url = storyboardVideo.url
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
  let cursor = 0
  for (let i = 0; i < videoClips.value.length; i++) {
    const v = videoClips.value[i]
    const oldStart = v.start
    v.start = Number(cursor.toFixed(2))
    cursor += v.duration
    const voice = voiceItems.value[i]
    if (voice) {
      voice.start = v.start
      if (voice.duration > v.duration) voice.duration = v.duration
    }
    const sub = subtitleItems.value[i]
    if (sub) {
      sub.start = v.start
      if (sub.duration > v.duration) sub.duration = v.duration
    }
    if (Math.abs(oldStart - v.start) > 0.001) {
      // aligned
    }
  }
  if (musicItems.value.length) {
    syncMusicTimelineDurations()
  }
}

function relayoutVideoTrackWithLinkedByOrder() {
  const ordered = [...videoClips.value].sort((a, b) => a.start - b.start)
  let cursor = 0
  const startMapBefore = new Map<string, number>()
  ordered.forEach((v) => startMapBefore.set(v.id, v.start))

  for (const v of ordered) {
    const oldStart = v.start
    v.start = Number(cursor.toFixed(2))
    const delta = v.start - oldStart
    if (Math.abs(delta) > 0.0001) {
      subtitleItems.value.forEach((s) => {
        if (s.videoClipId === v.id) s.start = Math.max(0, Number((s.start + delta).toFixed(2)))
      })
      voiceItems.value.forEach((a) => {
        if (a.videoClipId === v.id) a.start = Math.max(0, Number((a.start + delta).toFixed(2)))
      })
    }
    constrainLinkedItemsToVideo(v.id)
    cursor += v.duration
  }

  videoClips.value = ordered
  if (musicItems.value.length) {
    syncMusicTimelineDurations()
  }
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
  for (const clip of clips) {
    if (!hasClipVideoUrl(clip)) {
      applyClipTimelineDuration(clip, EMPTY_CLIP_DURATION)
      continue
    }
    const d = await probeVideoDuration(clip.url)
    applyClipTimelineDuration(clip, d)
  }
  videoClips.value = clips
  relayoutVideoTrackAndLinkedTracks()
  scheduleRebuild('all')
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
    const url =
      dub?.dubbingLipSyncVideoUrl?.trim() ||
      vPanel?.videos?.find((v: any) => v.isStoryboardVideo)?.url ||
      vPanel?.videos?.[0]?.url ||
      ''

    const name = dub?.title || vPanel?.title || `分镜${i + 1}`
    const dialogue = dub?.dialogue?.trim() || ''
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
    if (voiceUrl) {
      const presetVol = videoVolumePreset.value[clip.id] ?? 1
      nextVoice.push({
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
      })
    }

    if (dialogue) {
      nextSub.push({
        id: `sub-${clip.id}`,
        kind: 'subtitle',
        text: dialogue,
        fontSize: 40,
        videoClipId: clip.id,
        start,
        duration: Math.min(3, clipDur)
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
  void hydrateVideoDurationsFromSource()
  void hydrateMusicDurationsFromSource()
  return true
}

function syncFromPreviousSteps() {
  if (!buildTimelineFromProps({ showSuccessMessage: true })) {
    message.warning('暂无分镜/配音数据，请先完成前面步骤')
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
  const res = await fetch(url)
  if (!res.ok) return null
  const blob = await res.blob()
  mediaBlobCache.set(url, blob)
  return blob.stream() as ReadableStream<Uint8Array>
}

function scheduleRebuild(_reason: 'video' | 'subtitle' | 'audio' | 'all' = 'all') {
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
  rebuildTimer = window.setTimeout(() => {
    void rebuildCanvas()
  }, 80)
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
      const [, rest] = await mp4.split(trimStartUs)
      mp4 = rest
    }
    const keepUs = Math.max(1, trimEndUs - trimStartUs)
    const [kept] = await mp4.split(keepUs)
    mp4 = kept

    const spr = new VisibleSprite(mp4)
    spr.time = { offset: secToUs(clip.start), duration: secToUs(clip.duration) }
    spr.zIndex = 1
    spr.rect = new Rect(0, 0, 1280, 720)
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
  await nextTick()
  syncNativePreviewVideoTime()
  syncPreviewAudios()
  startPreviewPlaybackLoop()
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
  if (musicStripHovered.value) updateMusicEditBtnPosition()
  if (suppressScrollFollowPause || !playing.value) return
  pauseAutoFollow()
  scheduleAutoFollowResume()
}

function scrollPlayheadIntoView() {
  const wrap = timelineWrapRef.value
  if (!wrap) return
  const playheadPx = secToLayoutPx(currentTime.value)
  const viewportLeft = wrap.scrollLeft
  const viewportWidth = wrap.clientWidth - trackLabelWidth.value
  const margin = 96
  let nextScrollLeft = wrap.scrollLeft
  if (playheadPx < viewportLeft + margin) {
    nextScrollLeft = Math.max(0, playheadPx - margin)
  } else if (playheadPx > viewportLeft + viewportWidth - margin) {
    nextScrollLeft = Math.max(0, playheadPx - viewportWidth + margin)
  }
  if (Math.abs(nextScrollLeft - wrap.scrollLeft) < 1) return
  suppressScrollFollowPause = true
  wrap.scrollLeft = nextScrollLeft
  requestAnimationFrame(() => {
    suppressScrollFollowPause = false
  })
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
    if (playing.value && autoFollowEnabled.value) {
      ensurePlayheadVisible()
    }
    syncNativePreviewVideoTime()
    if (playing.value) syncPreviewAudios()
  }
)

watch(showNativePreviewVideo, (visible) => {
  if (visible) nextTick(() => syncNativePreviewVideoTime())
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

  if (track === 'voice') {
    const voiceItem = item as TimelineAudioItem
    selectedAudioCurveText.value = (voiceItem.volumeCurve || [voiceItem.volume, voiceItem.volume, voiceItem.volume]).join(',')
  }
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
  suppressScrollFollowPause = true
  wrap.scrollLeft = nextScrollLeft
  requestAnimationFrame(() => {
    suppressScrollFollowPause = false
  })
}

function ensurePlayheadVisible() {
  if (!autoFollowEnabled.value) return
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
    if (v.start < clip.start) v.start = clip.start
    if (v.start + v.duration > clipEnd) v.duration = Math.max(MIN_DURATION, Number((clipEnd - v.start).toFixed(2)))
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
}

function updateMusicEditBtnPosition() {
  const wrap = timelineWrapRef.value
  if (!wrap) return
  musicEditBtnLeftPx.value = Math.max(0, wrap.scrollLeft + wrap.clientWidth / 2 - trackLabelWidth.value / 2)
}

function onMusicStripMouseEnter() {
  musicStripHovered.value = true
  updateMusicEditBtnPosition()
}

function onMusicStripMouseLeave() {
  musicStripHovered.value = false
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

function onAudioFileSelected(e: Event) {
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

  const url = URL.createObjectURL(file)
  if (track === 'voice' && replaceId) {
    const existing = voiceItems.value.find((v) => v.id === replaceId)
    if (existing) {
      existing.name = file.name
      existing.url = url
      if (targetVideoClipId) existing.videoClipId = targetVideoClipId
      message.success('已替换配音')
      scheduleRebuild('audio')
      return
    }
  }
  const item: TimelineAudioItem = {
    id: `${track}-${Date.now()}`,
    kind: track,
    name: file.name,
    url,
    start: Number(currentTime.value.toFixed(2)),
    duration: 5,
    volume: track === 'music' ? 0.25 : 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: track === 'music',
    volumeCurve: track === 'music' ? [0.25, 0.25, 0.25] : [1, 1, 1]
  }
  if (track === 'voice') {
    const activeVideo = targetVideoClipId
      ? (videoClips.value.find((v) => v.id === targetVideoClipId) || null)
      : getActiveVideoClipForOperation()
    if (!activeVideo) {
      message.warning('请先选中或定位到某个分镜视频片段再添加配音')
      return
    }
    item.videoClipId = activeVideo.id
    item.start = Math.max(activeVideo.start, Math.min(activeVideo.start + activeVideo.duration - MIN_DURATION, item.start))
    item.duration = Math.min(item.duration, activeVideo.duration)
  }
  if (track === 'voice') voiceItems.value.push(item)
  else {
    openEditMusicModal()
    return
  }
  resolveOverlap(track, item.id)
  if (track === 'voice') scheduleRebuild('audio')
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

async function handleExport() {
  if (import.meta.server) return
  if (!videoClips.value.length) {
    message.warning('暂无可导出视频，请先同步前面步骤')
    return
  }
  exporting.value = true
  const key = 'export'
  try {
    message.loading({ content: '准备导出…', key, duration: 0 })
    const ordered = [...videoClips.value].sort((a, b) => a.start - b.start)
    const segs = ordered.map((c) => ({
      id: c.id,
      url: c.url,
      startTime: c.start,
      endTime: c.start + c.duration,
      duration: c.duration,
      dialogue: ''
    }))

    const subtitles = subtitleItems.value.map((s) => ({
      id: s.id,
      text: s.text,
      startTime: s.start,
      duration: s.duration
    }))
    const audios = [...voiceItems.value, ...musicItems.value].map((a) => ({
      id: a.id,
      url: a.url,
      startTime: a.start,
      duration: a.duration,
      volume: a.volume,
      fadeIn: a.fadeIn,
      fadeOut: a.fadeOut,
      loop: a.loop,
      kind: a.kind
    }))

    const blob = await exportTimelineToMp4({
      segments: segs as any,
      subtitles,
      audioTracks: audios,
      onLog: (msg) => message.loading({ content: msg, key, duration: 0 }),
      exportOpts: { width: 1280, height: 720 }
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `video-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    message.success({ content: '导出完成，已开始下载', key, duration: 2 })
  } catch (e: any) {
    message.error({ content: e?.message || '导出失败', key, duration: 4 })
  } finally {
    exporting.value = false
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
  if (musicStripHovered.value) updateMusicEditBtnPosition()
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('resize', updateTimelineStripWidth)
  void ensureCanvas()
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
    const url =
      dub?.dubbingLipSyncVideoUrl?.trim() ||
      vp?.videos?.find((v: any) => v.isStoryboardVideo)?.url ||
      vp?.videos?.[0]?.url ||
      ''
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

function resetPreviewTimelineState() {
  stopPlayback()
  stopPreviewPlaybackLoop()
  stopAllPreviewAudios()
  previewAudioEls.clear()
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
  rebuildTimer = null
  currentPreviewToken.value += 1

  videoClips.value = []
  voiceItems.value = []
  subtitleItems.value = []
  musicItems.value = []
  videoVolumePreset.value = {}
  selectedClip.value = null
  selectedAudioCurveText.value = ''
  currentTime.value = 0
  playing.value = false
  scrubbing.value = false
  musicStripHovered.value = false
  snapIndicatorPx.value = null
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

  if (buildTimelineFromProps()) {
    lastHydratedScopeKey = scope
    selectedClip.value = videoClips.value[0]
      ? { track: 'video', id: videoClips.value[0]!.id }
      : null
    return
  }

  autoInitPlaceholderClipsFromProps()
  if (videoClips.value.length) {
    lastHydratedScopeKey = scope
  }
}

watch(projectScopeKey, (next, prev) => {
  if (prev === undefined || next === prev) return
  resetPreviewTimelineState()
  nextTick(() => hydrateTimelineForCurrentProject())
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
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('resize', updateTimelineStripWidth)
  timelineResizeObserver?.disconnect()
  timelineResizeObserver = null
  if (autoFollowResumeTimer) window.clearTimeout(autoFollowResumeTimer)
  stopPreviewPlaybackLoop()
  stopAllPreviewAudios()
  previewAudioEls.clear()
  try { avCanvas?.destroy?.() } catch {}
  avCanvas = null
  avUnsubTime?.(); avUnsubPlaying?.(); avUnsubPaused?.()
  mediaBlobCache.forEach((blob) => {
    try {
      URL.revokeObjectURL(URL.createObjectURL(blob))
    } catch {}
  })
  if (rebuildTimer) window.clearTimeout(rebuildTimer)
})

function applyCurveText() {
  const item = selectedVoiceItem.value
  if (!item) return
  const nums = selectedAudioCurveText.value
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x))
    .map((x) => Math.max(0, Math.min(2, x)))
  if (nums.length >= 2) {
    const curve = nums.length >= 3 ? nums.slice(0, 3) : [nums[0], nums[Math.floor(nums.length / 2)], nums[nums.length - 1]]
    item.volumeCurve = curve
    scheduleRebuild('audio')
  }
}
</script>

<style lang="scss" scoped>
.video-preview-step {
  --vp-timeline-label-w: 72PX;
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
}

.preview-canvas-host {
  width: 100%;
  height: 100%;
  background: #000;
}

.preview-canvas-host :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
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
  object-fit: cover;
  object-position: center;
  background: #000;
}

.preview-subtitle-overlay {
  position: absolute;
  left: 50%;
  bottom: 18%;
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

.preview-overlay-controls .play-btn,
.preview-overlay-controls .volume-btn {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: #fff;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
}

.preview-overlay-controls-playing .play-btn {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.preview-player-area:hover .preview-overlay-controls-playing .play-btn {
  opacity: 1;
  pointer-events: auto;
}

.preview-overlay-controls .volume-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 40px;
  height: 40px;
  font-size: 18px;
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
  min-height: 50px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  position: relative;
  overflow: visible;
}

.track-row-video {
  min-height: 76px;
}

.track-row-volume {
  min-height: 50px;
}

.track-row-aux {
  min-height: 50px;
}

.track-strip-volume {
  height: 46px;
}

.volume-bar-segment {
  position: absolute;
  top: 4px;
  height: 38px;
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
  font-size: 12px;
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
  height: 46px;
}

.track-strip-dubbing {
  height: 46px;
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

.track-strip-music {
  overflow: visible;
}

.track-strip-music--hovered .track-clip-music::after,
.track-strip-music--hovered .track-clip-music-empty::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(8, 12, 20, 0.42);
  pointer-events: none;
  z-index: 1;
}

.music-edit-btn-viewport {
  position: absolute;
  top: 4px;
  height: 38px;
  width: 0;
  z-index: 6;
  pointer-events: none;
}

.music-edit-btn-viewport .clip-edit-btn {
  pointer-events: auto;
  position: absolute;
  left: 0;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
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
  height: 46px;
  min-width: 0;
}

.track-strip-video {
  height: 68px;
}

.track-strip-clickable {
  cursor: crosshair;
}

.track-clip {
  position: absolute;
  top: 4px;
  height: 38px;
  border-radius: 6px;
  overflow: hidden;
  user-select: none;
  touch-action: none;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: left 0.18s ease, width 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.clip-text {
  font-size: 12px;
  color: #fff;
  padding: 0 8px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 38px;
}

.track-clip-video {
  top: 4px;
  height: 60px;
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
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  border-radius: 8px;
  background: rgba(74, 231, 253, 0.16);
  color: #e8fbff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
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

.audio-config-shell {
  flex-shrink: 0;
  overflow: hidden;
}

.audio-config-divider {
  height: 1px;
  margin: 2px 0 8px;
  background: linear-gradient(90deg, transparent, rgba(74, 231, 253, 0.35), transparent);
  transform-origin: center;
}

.audio-panel-slide-enter-active,
.audio-panel-slide-leave-active {
  transition:
    max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.24s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.audio-panel-slide-enter-active .audio-config-divider,
.audio-panel-slide-leave-active .audio-config-divider {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease;
}

.audio-panel-slide-enter-from,
.audio-panel-slide-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(10px);
}

.audio-panel-slide-enter-from .audio-config-divider,
.audio-panel-slide-leave-to .audio-config-divider {
  transform: scaleX(0.35);
  opacity: 0;
}

.audio-panel-slide-enter-to,
.audio-panel-slide-leave-from {
  max-height: 240px;
  opacity: 1;
  transform: translateY(0);
}

.audio-config-panel {
  flex-shrink: 0;
  border: 1px solid var(--dark-border);
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  max-height: 18vh;
  overflow: auto;
}

.audio-config-title {
  margin-bottom: 8px;
  color: var(--dark-text);
  font-weight: 600;
}

.audio-config-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
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
