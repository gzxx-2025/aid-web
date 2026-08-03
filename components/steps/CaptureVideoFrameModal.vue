<template>
  <a-modal
    v-model:open="modalOpen"
    :width="1050"
    :footer="null"
    :z-index="zIndex"
    :closable="!confirming"
    :mask-closable="!confirming"
    :keyboard="!confirming"
    title="截取视频帧"
    class="capture-video-frame-modal"
    wrap-class-name="create-flow-modal capture-video-frame-modal-wrap"
    @cancel="closeModal"
  >
    <div class="cvfm-content">
      <template v-if="videos.length > 0">
        <section class="cvfm-picker" aria-label="选择分镜原视频">
          <button
            v-if="canScrollLeft"
            type="button"
            class="cvfm-scroll-btn cvfm-scroll-btn--left"
            aria-label="向左查看更多视频"
            @click="scrollVideoStrip(-1)"
          >
            <LeftOutlined />
          </button>
          <div ref="videoStripRef" class="cvfm-video-strip" @scroll="updateScrollState">
            <button
              v-for="video in videos"
              :key="video.id"
              type="button"
              :class="['cvfm-video-card', { 'is-active': selectedVideoId === video.id }]"
              :title="video.label"
              @click="selectVideo(video.id)"
            >
              <video
                class="cvfm-video-card__media"
                :src="video.url"
                :poster="video.poster"
                muted
                playsinline
                preload="metadata"
              />
              <span class="cvfm-video-card__label">{{ video.label }}</span>
            </button>
          </div>
          <button
            v-if="canScrollRight"
            type="button"
            class="cvfm-scroll-btn cvfm-scroll-btn--right"
            aria-label="向右查看更多视频"
            @click="scrollVideoStrip(1)"
          >
            <RightOutlined />
          </button>
        </section>

        <section class="cvfm-preview">
          <video
            v-if="selectedVideo"
            :key="`${selectedVideo.id}-${selectedVideoPlaybackUrl}`"
            ref="videoRef"
            class="cvfm-preview__video"
            :src="selectedVideoPlaybackUrl"
            :poster="selectedVideo.poster"
            crossorigin="anonymous"
            playsinline
            preload="auto"
            aria-label="视频预览，点击或按空格播放或暂停"
            @click="togglePlayback"
            @loadedmetadata="onLoadedMetadata"
            @timeupdate="onTimeUpdate"
            @play="onVideoPlay"
            @pause="onVideoPause"
            @ended="onVideoEnded"
            @error="onVideoError"
          />
          <button
            v-if="selectedVideo && videoReady && !videoError && !isPlaying"
            type="button"
            class="dubbing-video-play-btn dubbing-video-play-btn--card"
            aria-label="播放视频"
            @click="togglePlayback"
          />
          <div v-if="videoError" class="cvfm-preview__error">
            <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--md" >
            <span>视频加载失败，请切换其它视频</span>
          </div>
        </section>

        <section class="cvfm-timeline" aria-label="视频截帧时间轴">
          <div class="cvfm-timeline__main">
            <button
              type="button"
              class="cvfm-play-btn"
              :disabled="!videoReady || videoError"
              :aria-label="isPlaying ? '暂停视频' : '播放视频'"
              @click="togglePlayback"
            >
              <PauseCircleOutlined v-if="isPlaying" />
              <PlayCircleOutlined v-else />
            </button>
            <div :class="['cvfm-filmstrip', { 'is-disabled': !videoReady || videoError }]">
              <span
                v-for="(frame, index) in timelineFrames"
                :key="`${selectedVideoId}-${index}`"
                class="cvfm-filmstrip__frame"
                :style="{ backgroundImage: `url(${frame})` }"
              />
              <span v-if="timelineFrames.length === 0" class="cvfm-filmstrip__placeholder" />
              <span class="cvfm-filmstrip__playhead" :style="{ left: `${timelineProgress}%` }" />
              <input
                class="cvfm-filmstrip__input"
                type="range"
                min="0"
                :max="duration || 0"
                step="0.001"
                :value="currentTime"
                :disabled="!videoReady || videoError"
                aria-label="选择截帧时间"
                @input="onScrubInput"
              >
            </div>
            <span class="cvfm-time">{{ formatVideoTime(currentTime) }}</span>
          </div>
          <div class="cvfm-timeline__quick">
            <span>快速选取</span>
            <button
              type="button"
              class="cvfm-boundary-btn"
              :disabled="!videoReady || videoError"
              @click="seekToBoundary('start')"
            >
              首帧
            </button>
            <button
              type="button"
              class="cvfm-boundary-btn"
              :disabled="!videoReady || videoError"
              @click="seekToBoundary('end')"
            >
              尾帧
            </button>
          </div>
        </section>
      </template>

      <div v-else class="cvfm-empty">
        <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--xl" >
        <p>暂无视频</p>
        <span>请先生成当前作品或剧集的分镜视频</span>
      </div>

      <footer class="cvfm-footer">
        <a-button class="cvfm-cancel-btn" :disabled="confirming" @click="closeModal">
          取消
        </a-button>
        <a-button
          type="primary"
          class="cvfm-confirm-btn"
          :loading="confirming"
          :disabled="!selectedVideo || !videoReady || videoError"
          @click="confirmCapture"
        >
          确认截帧
        </a-button>
      </footer>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  LeftOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RightOutlined
} from '@ant-design/icons-vue'
import { useCreationStore } from '~/stores/creation'
import {
  collectOriginalStoryboardVideosFromPanels,
  type StoryboardVideoPick
} from '~/utils/collectProjectStoryboardVideos'
import {
  clampVideoFrameTime,
  captureVideoElementFrame,
  captureVideoTimelineFrames,
  seekVideoToFrame,
  type CapturedVideoFrame
} from '~/utils/videoFrameCapture'
import { formatVideoFrameName } from '~/utils/videoFrameName'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'
import { emptyImageIconUrl } from '~/utils/emptyImageIcon'
import { resolveMediaPlaybackUrl } from '~/utils/mediaFetch'
import { useVideoPlaybackSpaceShortcut } from '~/composables/useVideoPlaybackSpaceShortcut'

interface Props {
  open: boolean
  projectId: number
  episodeId?: number | null
  zIndex?: number
}
const props = withDefaults(defineProps<Props>(), {
  episodeId: null,
  zIndex: 1200
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  captured: [payload: CapturedVideoFrame]
}>()
const creationStore = useCreationStore()
const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})
const videos = computed<StoryboardVideoPick[]>(() =>
  collectOriginalStoryboardVideosFromPanels(creationStore.formData.storyboardVideo.panels)
)
const selectedVideoId = ref('')
const selectedVideo = computed(
  () => videos.value.find((video) => video.id === selectedVideoId.value) || null
)
const selectedVideoPlaybackUrl = computed(() =>
  selectedVideo.value ? resolveMediaPlaybackUrl(selectedVideo.value.url) : ''
)
const videoRef = ref<HTMLVideoElement | null>(null)
const videoStripRef = ref<HTMLElement | null>(null)
const duration = ref(0)
const currentTime = ref(0)
const videoReady = ref(false)
const videoError = ref(false)
const isPlaying = ref(false)
const confirming = ref(false)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const timelineFrames = ref<string[]>([])
const timelineProgress = computed(() => {
  if (!duration.value) return 0
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})
const canTogglePlaybackWithSpace = computed(
  () => modalOpen.value && videoReady.value && !videoError.value && !confirming.value
)
useVideoPlaybackSpaceShortcut(canTogglePlaybackWithSpace, togglePlayback)
let resizeObserver: ResizeObserver | null = null
let timelineFrameGeneration = 0
let playbackAnimationFrame: number | null = null

function stopPlaybackProgressAnimation() {
  if (playbackAnimationFrame == null) return
  window.cancelAnimationFrame(playbackAnimationFrame)
  playbackAnimationFrame = null
}

function syncPlaybackProgressFrame() {
  const video = videoRef.value
  if (!video || video.paused || video.ended) {
    playbackAnimationFrame = null
    return
  }
  currentTime.value = Math.max(0, video.currentTime || 0)
  playbackAnimationFrame = window.requestAnimationFrame(syncPlaybackProgressFrame)
}

function startPlaybackProgressAnimation() {
  stopPlaybackProgressAnimation()
  playbackAnimationFrame = window.requestAnimationFrame(syncPlaybackProgressFrame)
}

function syncSelectedVideo() {
  const currentExists = videos.value.some((video) => video.id === selectedVideoId.value)
  if (!currentExists) selectedVideoId.value = videos.value[0]?.id || ''
  void nextTick(updateScrollState)
}
function resetVideoState() {
  stopPlaybackProgressAnimation()
  duration.value = 0
  currentTime.value = 0
  videoReady.value = false
  videoError.value = false
  isPlaying.value = false
  timelineFrameGeneration += 1
  timelineFrames.value = []
}
function selectVideo(id: string) {
  if (selectedVideoId.value === id) return
  videoRef.value?.pause()
  selectedVideoId.value = id
}
function onLoadedMetadata() {
  const video = videoRef.value
  if (!video) return
  duration.value = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0
  currentTime.value = Math.max(0, video.currentTime || 0)
  videoReady.value = video.videoWidth > 0 && video.videoHeight > 0
  videoError.value = false
  void refreshTimelineFrames()
}
async function refreshTimelineFrames() {
  const sourceUrl = selectedVideoPlaybackUrl.value
  const generation = ++timelineFrameGeneration
  timelineFrames.value = []
  if (!sourceUrl || !videoReady.value || videoError.value) return

  try {
    const frames = await captureVideoTimelineFrames(sourceUrl, {
      count: 10,
      shouldContinue: () => generation === timelineFrameGeneration && props.open
    })
    if (generation === timelineFrameGeneration) timelineFrames.value = frames
  } catch {
    if (generation === timelineFrameGeneration) timelineFrames.value = []
  }
}
function onTimeUpdate() {
  const video = videoRef.value
  if (!video || video.seeking) return
  currentTime.value = Math.max(0, video.currentTime || 0)
}
function onVideoPlay() {
  isPlaying.value = true
  startPlaybackProgressAnimation()
}
function onVideoPause() {
  isPlaying.value = false
  stopPlaybackProgressAnimation()
  onTimeUpdate()
}
function onVideoEnded() {
  isPlaying.value = false
  stopPlaybackProgressAnimation()
  onTimeUpdate()
}
function onVideoError() {
  stopPlaybackProgressAnimation()
  videoReady.value = false
  videoError.value = true
  isPlaying.value = false
}
async function togglePlayback() {
  const video = videoRef.value
  if (!video || !videoReady.value || videoError.value || confirming.value) return
  if (!video.paused) {
    video.pause()
    return
  }
  if (video.ended && duration.value > 0) video.currentTime = 0
  try {
    await video.play()
  } catch {
    message.error('视频播放失败')
  }
}
function setVideoTime(value: number) {
  const video = videoRef.value
  if (!video || !videoReady.value) return
  const safeValue = Math.min(Math.max(0, value), duration.value || 0)
  video.pause()
  isPlaying.value = false
  currentTime.value = safeValue
  video.currentTime = safeValue
}
function onScrubInput(event: Event) {
  setVideoTime(Number((event.target as HTMLInputElement).value))
}

function seekToBoundary(boundary: 'start' | 'end') {
  if (boundary === 'start') {
    setVideoTime(0)
    return
  }
  setVideoTime(clampVideoFrameTime(duration.value, duration.value))
}

async function confirmCapture() {
  const video = videoRef.value
  const source = selectedVideo.value
  if (confirming.value || !video || !source || !videoReady.value || videoError.value) return

  confirming.value = true
  try {
    video.pause()
    await seekVideoToFrame(video, currentTime.value)
    const capturedAtMs = Math.max(0, Math.floor((video.currentTime || 0) * 1000))
    const name = formatVideoFrameName(source.label, capturedAtMs, new Date())
    const file = await captureVideoElementFrame(video, name)
    const url = await uploadImageToOssWithToast(file)
    if (!url) return
    emit('captured', {
      url,
      name,
      sourceVideoId: source.id,
      sourceLabel: source.label,
      capturedAtMs
    })
    modalOpen.value = false
  } catch (error) {
    console.error('[capture-video-frame] capture failed', error)
    message.error('截帧失败，请稍后重试')
  } finally {
    confirming.value = false
  }
}

function closeModal() {
  if (confirming.value) return
  modalOpen.value = false
}

function cleanupVideo() {
  const video = videoRef.value
  if (video) {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
  selectedVideoId.value = ''
  resetVideoState()
}

function updateScrollState() {
  const element = videoStripRef.value
  if (!element) {
    canScrollLeft.value = false
    canScrollRight.value = false
    return
  }
  const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
  canScrollLeft.value = element.scrollLeft > 2
  canScrollRight.value = maxScrollLeft - element.scrollLeft > 2
}

function scrollVideoStrip(direction: -1 | 1) {
  const element = videoStripRef.value
  if (!element) return
  element.scrollBy({
    left: direction * Math.max(180, element.clientWidth * 0.8),
    behavior: 'smooth'
  })
}

function formatVideoTime(value: number): string {
  const totalMilliseconds = Math.max(0, Math.floor((Number(value) || 0) * 1000))
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = totalMilliseconds % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      syncSelectedVideo()
      return
    }
    cleanupVideo()
  }
)

watch(
  () => [props.projectId, props.episodeId] as const,
  () => {
    if (props.open) {
      cleanupVideo()
      syncSelectedVideo()
    }
  }
)

watch(videos, () => {
  if (props.open) syncSelectedVideo()
})

watch(selectedVideoId, resetVideoState)

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateScrollState)
    if (videoStripRef.value) resizeObserver.observe(videoStripRef.value)
  }
  window.addEventListener('resize', updateScrollState)
})

watch(videoStripRef, (element, previous) => {
  if (previous) resizeObserver?.unobserve(previous)
  if (element) resizeObserver?.observe(element)
  void nextTick(updateScrollState)
})

onBeforeUnmount(() => {
  cleanupVideo()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', updateScrollState)
})
</script>

<style scoped lang="scss">
.cvfm-content {
  display: flex;
  min-height: 520px;
  flex-direction: column;
  gap: 16px;
  color: var(--home-text, #e6edf3);
}
.cvfm-picker {
  position: relative;
  flex-shrink: 0;
}

.cvfm-video-strip {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 2px;
  scrollbar-width: none;
  scroll-behavior: smooth;

  &::-webkit-scrollbar {
    display: none;
  }
}

.cvfm-video-card {
  width: 132px;
  min-width: 132px;
  height: 88px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: var(--create-surface-canvas, rgba(17, 22, 33, 0.96));
  color: var(--home-text, #e6edf3);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover,
  &.is-active {
    border-color: var(--accent-500, #4ae7fd);
  }

  &.is-active {
    box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.25);
  }
}

.cvfm-video-card__media {
  display: block;
  width: 100%;
  height: 62px;
  background: #080b12;
  object-fit: cover;
  pointer-events: none;
}

.cvfm-video-card__label {
  display: block;
  padding: 4px 7px;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cvfm-scroll-btn {
  position: absolute;
  top: 25px;
  z-index: 3;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(74, 231, 253, 0.35);
  border-radius: 50%;
  background: rgba(12, 18, 29, 0.92);
  color: var(--accent-500, #4ae7fd);
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.38);
}

.cvfm-scroll-btn--left {
  left: 6px;
}
.cvfm-scroll-btn--right {
  right: 6px;
}

.cvfm-preview {
  position: relative;
  display: flex;
  min-height: min(420px, 46vh);
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(74, 231, 253, 0.2);
  border-radius: 10px;
  background: #080b12;
}

.cvfm-preview__video {
  display: block;
  width: 100%;
  height: min(52vh, 480px);
  cursor: pointer;
  object-fit: contain;
}
.cvfm-preview__error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #080b12;
  color: var(--home-muted, #8e97a5);
}

.cvfm-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cvfm-timeline__main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cvfm-timeline__quick {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 44px;
  color: var(--home-muted, #8e97a5);
  font-size: 12px;
}

.cvfm-play-btn,
.cvfm-boundary-btn {
  flex-shrink: 0;
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 6px;
  background: var(--create-surface-input, rgba(28, 38, 54, 0.92));
  color: var(--home-text, #e6edf3);
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--accent-500, #4ae7fd);
    color: var(--accent-500, #4ae7fd);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.cvfm-play-btn {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 18px;
}

.cvfm-boundary-btn {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
}

.cvfm-filmstrip {
  position: relative;
  display: flex;
  height: 48px;
  flex: 1 1 auto;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: #0a0e15;

  &.is-disabled {
    opacity: 0.5;
  }
}

.cvfm-filmstrip__frame,
.cvfm-filmstrip__placeholder {
  min-width: 0;
  flex: 1 1 0;
  background-position: center;
  background-size: cover;
}

.cvfm-filmstrip__frame + .cvfm-filmstrip__frame {
  border-left: 1px solid rgba(8, 11, 18, 0.7);
}

.cvfm-filmstrip__placeholder {
  background:
    linear-gradient(90deg, rgba(74, 231, 253, 0.08), transparent 45%, rgba(74, 231, 253, 0.08)),
    #0a0e15;
}

.cvfm-filmstrip__playhead {
  position: absolute;
  z-index: 2;
  top: -5px;
  bottom: -5px;
  width: 2px;
  background: #35d66b;
  pointer-events: none;
  transform: translateX(-1px);
  transition: left 80ms linear;
  will-change: left;
  box-shadow: 0 0 6px rgba(53, 214, 107, 0.75);

  &::before {
    position: absolute;
    top: 0;
    left: 50%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #35d66b;
    content: '';
    transform: translate(-50%, -50%);
  }
}

.cvfm-filmstrip__input {
  position: absolute;
  z-index: 3;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  opacity: 0;

  &:disabled {
    cursor: not-allowed;
  }
}

.cvfm-time {
  width: 72px;
  flex-shrink: 0;
  color: var(--home-muted, #8e97a5);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

.cvfm-empty {
  display: flex;
  min-height: 430px;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--home-muted, #8e97a5);

  p {
    margin: 14px 0 4px;
    color: var(--home-text, #e6edf3);
    font-size: 16px;
  }

  span {
    font-size: 13px;
  }
}

.cvfm-footer {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid rgba(74, 231, 253, 0.15);
}

.cvfm-cancel-btn,
.cvfm-confirm-btn {
  min-width: 96px;
  height: 36px;
  border-radius: 8px;
}

@media (max-width: 760px) {
  .cvfm-content {
    min-height: 440px;
  }

  .cvfm-preview {
    min-height: 240px;
  }

  .cvfm-time {
    display: none;
  }

  .cvfm-boundary-btn {
    padding: 0 8px;
  }
}
</style>

<style scoped src="~/assets/css/capture-video-frame-modal-responsive.scss" lang="scss"></style>
