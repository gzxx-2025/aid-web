<template>
  <div class="savft-root">
    <div class="savft-scroll">
      <div class="savft-grid">
        <button type="button" class="savft-add-card" @click="openCaptureModal">
          <PlusOutlined class="savft-add-card__icon" />
          <span>新增视频帧</span>
        </button>

        <button
          v-for="frame in frames"
          :key="frame.id"
          type="button"
          :class="['savft-card', { 'is-selected': isFrameSelected(frame) }]"
          :title="frame.name"
          @click="toggleFrame(frame)"
        >
          <div class="savft-card__media">
            <ShimmerImage
              :src="frame.thumbnail || frame.url"
              img-class="savft-card__img"
              wrapper-class="savft-card__shimmer"
              object-fit="cover"
              reveal-direction="fade"
            />
            <img
              class="savft-card__select"
              :src="isFrameSelected(frame) ? dialogSelectSelIcon : dialogSelectNorIcon"
              alt=""
            >
          </div>
          <span class="savft-card__meta">{{ formatDate(frame.createdAt) }}</span>
        </button>
      </div>
    </div>

    <CaptureVideoFrameModal
      v-model:open="captureModalOpen"
      :project-id="captureProjectId"
      :episode-id="captureEpisodeId"
      :z-index="modalZIndex"
      @captured="onCaptured"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import CaptureVideoFrameModal from './CaptureVideoFrameModal.vue'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import type { CapturedVideoFrame } from '~/utils/videoFrameCapture'
import {
  appendVideoFrame,
  listVideoFrames,
  type VideoFrameLocalItem
} from '~/utils/videoFrameLocalStore'
import { videoFrameScopeKey } from '~/utils/videoFrameScope'

type VideoFrameAssetItem = {
  id: string
  url: string
  thumbnail: string
  title: string
  name: string
  importDate: string
  source: '视频帧'
  kind: 'image'
}

interface Props {
  open: boolean
  projectId: number
  episodeId?: number | null
  isSelected?: (item: VideoFrameAssetItem) => boolean
  modalZIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  episodeId: null,
  isSelected: () => false,
  modalZIndex: 1200
})

const emit = defineEmits<{
  toggle: [item: VideoFrameAssetItem]
}>()

const frames = ref<VideoFrameLocalItem[]>([])
const captureModalOpen = ref(false)
const captureProjectId = ref(0)
const captureEpisodeId = ref<number | null>(null)

function reloadFrames() {
  frames.value = listVideoFrames(props.projectId, props.episodeId)
}

function toAssetItem(frame: VideoFrameLocalItem): VideoFrameAssetItem {
  return {
    id: frame.id,
    url: frame.url,
    thumbnail: frame.thumbnail || frame.url,
    title: frame.name,
    name: frame.name,
    importDate: frame.createdAt,
    source: '视频帧',
    kind: 'image'
  }
}

function isFrameSelected(frame: VideoFrameLocalItem): boolean {
  return props.isSelected(toAssetItem(frame))
}

function toggleFrame(frame: VideoFrameLocalItem) {
  emit('toggle', toAssetItem(frame))
}

function openCaptureModal() {
  if (!Number.isFinite(Number(props.projectId)) || Number(props.projectId) <= 0) {
    message.error('项目无效，无法截帧')
    return
  }
  // 固定本次上传作用域，避免上传期间切作品后把旧帧写入新作品。
  captureProjectId.value = Number(props.projectId)
  const episodeId = Number(props.episodeId)
  captureEpisodeId.value = Number.isFinite(episodeId) && episodeId > 0 ? episodeId : null
  captureModalOpen.value = true
}

function createFrameId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `vf-${crypto.randomUUID()}`
  }
  return `vf-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function onCaptured(payload: CapturedVideoFrame) {
  const saved = appendVideoFrame(captureProjectId.value, captureEpisodeId.value, {
    id: createFrameId(),
    url: payload.url,
    thumbnail: payload.url,
    name: payload.name,
    sourceVideoId: payload.sourceVideoId,
    sourceLabel: payload.sourceLabel,
    capturedAtMs: payload.capturedAtMs
  })
  const capturedScope = videoFrameScopeKey(captureProjectId.value, captureEpisodeId.value)
  const currentScope = videoFrameScopeKey(props.projectId, props.episodeId)
  if (capturedScope === currentScope) frames.value = [...frames.value, saved]
}

function formatDate(value: string): string {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

watch(
  () => props.open,
  (open) => {
    if (open) reloadFrames()
    else captureModalOpen.value = false
  },
  { immediate: true }
)

watch(
  () => [props.projectId, props.episodeId] as const,
  () => {
    captureModalOpen.value = false
    if (props.open) reloadFrames()
  }
)
</script>

<style scoped lang="scss">
.savft-root {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  border-right: 1px solid rgba(74, 231, 253, 0.3);
  border-bottom: 1px solid rgba(74, 231, 253, 0.3);
  border-left: 1px solid rgba(74, 231, 253, 0.3);
  background: rgb(17, 22, 33);
}

.savft-scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 14px;
  scrollbar-color: rgba(120, 140, 170, 0.45) transparent;
  scrollbar-width: thin;
}

.savft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  gap: 12px;
}

.savft-add-card,
.savft-card {
  height: 132px;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(18, 18, 18, 1);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    color 0.2s;
}

.savft-add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed rgba(74, 231, 253, 0.55);
  color: var(--home-muted, #8e97a5);

  &:hover {
    border-color: var(--accent-500, #4ae7fd);
    color: var(--accent-500, #4ae7fd);
    background: rgba(74, 231, 253, 0.06);
  }
}

.savft-add-card__icon {
  font-size: 28px;
}

.savft-card {
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--home-muted, #8e97a5);

  &:hover:not(.is-selected) {
    border-color: rgba(255, 255, 255, 0.14);
  }

  &.is-selected {
    border-color: var(--accent-500, #4ae7fd);
    box-shadow:
      0 0 0 1px rgba(74, 231, 253, 0.25),
      0 0 16px rgba(74, 231, 253, 0.12);
  }
}

.savft-card__media {
  position: relative;
  height: 100px;
  background: rgba(6, 10, 18, 0.85);
}

.savft-card__shimmer,
.savft-card__media :deep(.shimmer-image) {
  width: 100%;
  height: 100%;
}

.savft-card__img,
.savft-card__media :deep(.shimmer-image__img.savft-card__img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.savft-card__select {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  display: block;
  width: 24px;
  height: 24px;
  object-fit: contain;
  pointer-events: none;
}

.savft-card__meta {
  display: block;
  padding: 6px 8px;
  overflow: hidden;
  font-size: 12px;
  line-height: 20px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .savft-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
