<template>
  <div
    :class="['generate-source-images-strip', `generate-source-images-strip--${variant}`]"
  >
    <!--
      单行 flex-wrap 流：前 4 张 → 导入按钮 →（展开）溢出卡片 → 箭头
      导入按钮始终插在第 4 张后，不会被挤到列表末尾；箭头始终跟在当前可见卡片之后
    -->
    <div class="generate-source-images-list">
      <div
        v-for="entry in pinnedEntries"
        :key="resolveItemKey(entry.img, entry.originalIndex)"
        :class="[
          'generate-source-thumb',
          {
            'is-clickable': enablePreview || isAudioItem(entry.img),
            'generate-source-thumb--audio': isAudioItem(entry.img),
            'is-playing': isAudioPlaying(entry.img, entry.originalIndex)
          }
        ]"
        @click="onThumbClick(entry.img, entry.originalIndex)"
      >
        <template v-if="isAudioItem(entry.img)">
          <span
            v-if="formatAudioDurationSec(entry.img)"
            class="generate-source-audio-duration"
          >{{ formatAudioDurationSec(entry.img) }}</span>
          <span
            v-if="isAudioPlaying(entry.img, entry.originalIndex)"
            class="generate-source-audio-eq"
            aria-hidden="true"
          >
            <span class="generate-source-eq-bar generate-source-eq-bar-1" />
            <span class="generate-source-eq-bar generate-source-eq-bar-2" />
            <span class="generate-source-eq-bar generate-source-eq-bar-3" />
          </span>
          <img
            v-else
            class="generate-source-audio-icon"
            :src="audioIconUrl"
            alt=""
          />
          <span class="generate-source-audio-name">{{ resolveAlt(entry.img, entry.originalIndex) }}</span>
        </template>
        <ShimmerImage
          v-else-if="useShimmer"
          :src="resolveSrc(entry.img)"
          :alt="resolveAlt(entry.img, entry.originalIndex)"
          img-class="generate-source-thumb__image"
          object-fit="cover"
          reveal-direction="fade"
        />
        <img
          v-else
          :src="resolveSrc(entry.img)"
          :alt="resolveAlt(entry.img, entry.originalIndex)"
        />
        <button
          type="button"
          class="generate-source-thumb__remove"
          @click.stop="$emit('remove', entry.originalIndex)"
        >
          <CloseOutlined />
        </button>
      </div>

      <button
        v-if="showAdder"
        type="button"
        class="generate-source-thumb generate-source-thumb--adder"
        @click="$emit('open-adder')"
      >
        <PlusOutlined />
        <span v-if="showAdderText" class="adder-text">{{ adderText }}</span>
      </button>

      <span v-if="emptyHint" class="generate-source-empty-hint">{{ emptyHint }}</span>

      <template v-if="expanded">
        <div
          v-for="entry in overflowEntries"
          :key="resolveItemKey(entry.img, entry.originalIndex)"
          :class="[
            'generate-source-thumb',
            {
              'is-clickable': enablePreview || isAudioItem(entry.img),
              'generate-source-thumb--audio': isAudioItem(entry.img),
              'is-playing': isAudioPlaying(entry.img, entry.originalIndex)
            }
          ]"
          @click="onThumbClick(entry.img, entry.originalIndex)"
        >
          <template v-if="isAudioItem(entry.img)">
            <span
              v-if="formatAudioDurationSec(entry.img)"
              class="generate-source-audio-duration"
            >{{ formatAudioDurationSec(entry.img) }}</span>
            <span
              v-if="isAudioPlaying(entry.img, entry.originalIndex)"
              class="generate-source-audio-eq"
              aria-hidden="true"
            >
              <span class="generate-source-eq-bar generate-source-eq-bar-1" />
              <span class="generate-source-eq-bar generate-source-eq-bar-2" />
              <span class="generate-source-eq-bar generate-source-eq-bar-3" />
            </span>
            <img
              v-else
              class="generate-source-audio-icon"
              :src="audioIconUrl"
              alt=""
            />
            <span class="generate-source-audio-name">{{ resolveAlt(entry.img, entry.originalIndex) }}</span>
          </template>
          <ShimmerImage
            v-else-if="useShimmer"
            :src="resolveSrc(entry.img)"
            :alt="resolveAlt(entry.img, entry.originalIndex)"
            img-class="generate-source-thumb__image"
            object-fit="cover"
            reveal-direction="fade"
          />
          <img
            v-else
            :src="resolveSrc(entry.img)"
            :alt="resolveAlt(entry.img, entry.originalIndex)"
          />
          <button
            type="button"
            class="generate-source-thumb__remove"
            @click.stop="$emit('remove', entry.originalIndex)"
          >
            <CloseOutlined />
          </button>
        </div>
      </template>

      <button
        v-if="showCollapseToggle"
        type="button"
        class="generate-source-collapse-toggle"
        :aria-expanded="expanded"
        :aria-label="expanded ? '收起参考图列表' : '展开全部参考图'"
        @click="expanded = !expanded"
      >
        <UpOutlined v-if="expanded" />
        <DownOutlined v-else />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { CloseOutlined, DownOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons-vue'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import { useReferenceAudioPreview } from '~/composables/useReferenceAudioPreview'
import audioIconUrl from '~/assets/img/icon/music-nor.svg'
import {
  getOverflowReferenceStripEntries,
  getPinnedReferenceStripEntries,
  shouldAutoCollapseReferenceStrip,
  shouldShowReferenceStripCollapseToggle
} from '~/utils/referenceImagesStripCollapse'

export type GenerateSourceStripImage = {
  id?: string | number
  url?: string
  thumbnail?: string
  title?: string
  name?: string
  kind?: 'image' | 'audio'
  audioSource?: 'voice_sample' | 'upload'
  /** 音频时长（毫秒），素材条左上角展示秒数 */
  durationMs?: number
}

interface Props {
  images: GenerateSourceStripImage[]
  /** scene：场景/对话作图条；i2v：分镜视频文本域上方条 */
  variant?: 'scene' | 'i2v'
  showAdder?: boolean
  showAdderText?: boolean
  adderText?: string
  emptyHint?: string
  /** 点击缩略图是否触发 preview（分镜视频参考图需要） */
  enablePreview?: boolean
  /** 场景条用 ShimmerImage；i2v 条保持原生 img 与现网一致 */
  useShimmer?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'scene',
  showAdder: false,
  showAdderText: true,
  adderText: '导入参考图',
  emptyHint: '',
  enablePreview: false,
  useShimmer: true
})

const emit = defineEmits<{
  remove: [index: number]
  preview: [img: GenerateSourceStripImage]
  'open-adder': []
}>()

const expanded = ref(false)
const { playingId, play, stop } = useReferenceAudioPreview()

function isAudioItem(img: GenerateSourceStripImage) {
  return img?.kind === 'audio' || img?.audioSource === 'voice_sample' || img?.audioSource === 'upload'
}

function audioPlayKey(img: GenerateSourceStripImage, idx: number) {
  return `strip-audio-${img.id ?? idx}-${img.url || ''}`
}

function isAudioPlaying(img: GenerateSourceStripImage, idx: number) {
  return isAudioItem(img) && playingId.value === audioPlayKey(img, idx)
}

/** 左上角秒数：有 durationMs 才展示 */
function formatAudioDurationSec(img: GenerateSourceStripImage): string {
  const ms = Number(img?.durationMs)
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const sec = ms / 1000
  if (sec >= 10) return `${Math.round(sec)}s`
  const rounded = Math.round(sec * 10) / 10
  return `${rounded}s`
}

const showCollapseToggle = computed(() =>
  shouldShowReferenceStripCollapseToggle(props.images?.length ?? 0)
)

const pinnedEntries = computed(() =>
  getPinnedReferenceStripEntries(props.images ?? []).map((e) => ({
    img: e.item,
    originalIndex: e.originalIndex
  }))
)

const overflowEntries = computed(() =>
  getOverflowReferenceStripEntries(props.images ?? []).map((e) => ({
    img: e.item,
    originalIndex: e.originalIndex
  }))
)

watch(
  () => props.images?.length ?? 0,
  (count) => {
    if (shouldAutoCollapseReferenceStrip(count)) {
      expanded.value = false
    }
  }
)

function resolveSrc(img: GenerateSourceStripImage) {
  return String(img?.url || img?.thumbnail || '')
}

function resolveAlt(img: GenerateSourceStripImage, idx: number) {
  return img?.title || img?.name || `参考图${idx + 1}`
}

function resolveItemKey(img: GenerateSourceStripImage, idx: number) {
  return img?.id != null ? `ref-${img.id}` : `${resolveSrc(img)}-${idx}`
}

function onThumbClick(img: GenerateSourceStripImage, idx = 0) {
  if (isAudioItem(img)) {
    void play(String(img.url || ''), audioPlayKey(img, idx))
    return
  }
  if (!props.enablePreview) return
  if (img?.url || img?.thumbnail) {
    emit('preview', img)
  }
}

onBeforeUnmount(() => stop())
</script>

<style scoped lang="scss">
.generate-source-images-strip {
  padding: 8px 10px;
  background: rgba(18, 18, 18, 1);
  border-radius: 10px;
  margin-bottom: 4px;
}

.generate-source-images-strip--i2v {
  flex-shrink: 0;
}

.generate-source-images-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.generate-source-images-strip--i2v .generate-source-images-list {
  gap: 4px;
}

.generate-source-thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px dashed rgba(128, 154, 188, 0.35);
  background: rgba(8, 12, 20, 0.9);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
}

.generate-source-thumb.is-clickable {
  cursor: pointer;
}

.generate-source-thumb--audio {
  --create-ref-audio-bg: var(--accent-100, rgba(74, 231, 253, 0.1));
  --create-ref-audio-border: var(--accent-400, rgba(74, 231, 253, 0.42));
  --create-ref-audio-text: var(--accent-500, #4ae7fd);
  border-style: solid;
  border-color: var(--create-ref-audio-border);
  background: var(--create-ref-audio-bg);
  padding: 6px 4px 5px;
  gap: 6px;
  justify-content: flex-end;
}

.generate-source-thumb--audio.is-playing {
  box-shadow: 0 0 0 1px var(--create-ref-audio-text);
}

.generate-source-audio-duration {
  position: absolute;
  top: 3px;
  left: 4px;
  z-index: 1;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.generate-source-audio-icon {
  display: block;
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
  filter: brightness(0) saturate(100%) invert(78%) sepia(42%) saturate(548%) hue-rotate(143deg)
    brightness(101%) contrast(101%);
}

.generate-source-audio-eq {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  height: 18px;
  flex-shrink: 0;
}

.generate-source-eq-bar {
  width: 3px;
  background: var(--create-ref-audio-text);
  border-radius: 1px;
  transform-origin: center bottom;
  animation: generate-source-voice-eq 0.45s ease-in-out infinite alternate;
}

.generate-source-eq-bar-1 {
  height: 8px;
  animation-delay: 0s;
}

.generate-source-eq-bar-2 {
  height: 16px;
  animation-delay: 0.12s;
}

.generate-source-eq-bar-3 {
  height: 11px;
  animation-delay: 0.24s;
}

@keyframes generate-source-voice-eq {
  0% {
    transform: scaleY(0.35);
    opacity: 0.7;
  }
  100% {
    transform: scaleY(1);
    opacity: 1;
  }
}

.generate-source-audio-name {
  max-width: 100%;
  padding: 0 2px;
  margin-top: 0;
  font-size: 10px;
  line-height: 1.2;
  color: var(--create-ref-audio-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.generate-source-thumb .shimmer-image {
  width: 100%;
  height: 100%;
}

.generate-source-thumb img,
.generate-source-thumb :deep(.generate-source-thumb__image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.generate-source-thumb--audio img.generate-source-audio-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.generate-source-thumb__remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 77, 79, 0.95);
  color: #fff;
  cursor: pointer;
  font-size: 10px;
  line-height: 1;
  opacity: 0;
  transform: scale(0.9);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 2;
}

.generate-source-thumb:hover .generate-source-thumb__remove {
  opacity: 1;
  transform: scale(1);
}

.generate-source-thumb--adder {
  border: 1px dashed rgba(188, 205, 228, 0.6);
  background: transparent;
  color: rgba(225, 239, 255, 0.85);
  cursor: pointer;
  font-size: 18px;
}

.generate-source-thumb--adder:hover {
  border-color: rgba(74, 231, 253, 0.85);
  color: rgba(74, 231, 253, 1);
}

.generate-source-thumb--adder .adder-text {
  font-size: 12px;
  margin-top: 2px;
  white-space: nowrap;
}

.generate-source-empty-hint {
  margin-left: 4px;
  color: rgba(188, 205, 228, 0.62);
  font-size: 12px;
}

.generate-source-collapse-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(225, 239, 255, 0.85);
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  align-self: center;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.generate-source-collapse-toggle:hover {
  background: rgba(74, 231, 253, 0.16);
  color: rgba(74, 231, 253, 1);
}
</style>
