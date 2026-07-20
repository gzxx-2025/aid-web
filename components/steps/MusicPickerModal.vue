<template>
  <a-modal
    v-model:open="innerOpen"
    :width="860"
    :footer="null"
    :destroy-on-close="true"
    wrap-class-name="create-flow-modal music-picker-wrap"
    class="music-picker-modal"
    centered
    :z-index="11000"
    @cancel="onCancel"
  >
    <template #closeIcon>
      <CloseOutlined class="music-picker-close" />
    </template>

    <div class="music-picker-shell">
      <h2 class="music-picker-title">背景音乐</h2>

      <div class="music-picker-list">
        <div
          :class="['music-card', 'music-card-none', { 'is-selected': selectedId === NO_MUSIC_ID }]"
        >
          <div class="music-card-icon-wrap music-card-icon-wrap-none">
            <AudioMutedOutlined class="music-card-none-icon" />
          </div>
          <div class="music-card-text">
            <div class="music-card-name">无音乐</div>
            <div class="music-card-tags">不添加背景音乐</div>
          </div>
          <button
            type="button"
            class="music-card-select-btn"
            :class="{ 'is-active': selectedId === NO_MUSIC_ID }"
            @click.stop="confirmNoMusic"
          >
            选择
          </button>
        </div>

        <div
          v-for="item in musicLibrary"
          :key="item.id"
          :class="['music-card', { 'is-selected': selectedId === item.id }]"
        >
          <div
            class="music-card-icon-wrap"
            :class="{ 'is-audio-playing': playingId === item.id }"
            @click.stop="onPreviewClick(item)"
          >
            <img
              v-if="item.coverUrl"
              class="music-card-cover"
              :src="item.coverUrl"
              :alt="item.name"
            />
            <img v-else class="music-card-cover music-card-cover-fallback" :src="musicIconUrl" alt="" />
            <div class="music-card-icon-mask" />
            <div v-if="playingId === item.id" class="music-card-play-inner music-card-pause">
              <span class="pause-bars" />
            </div>
            <div v-else class="music-card-play-inner">
              <img class="music-card-play-icon" :src="iconStartUrl" alt="试听" width="24" height="24" />
            </div>
          </div>
          <div class="music-card-text">
            <div class="music-card-name">{{ item.name }}</div>
            <div class="music-card-tags">官方音乐库</div>
          </div>
          <button
            type="button"
            class="music-card-select-btn"
            :class="{ 'is-active': selectedId === item.id }"
            @click.stop="confirmMusic(item)"
          >
            选择
          </button>
        </div>
      </div>

      <div class="music-picker-footer">
        <div class="music-picker-volume-row">
          <span class="music-picker-volume-label">音量</span>
          <a-slider v-model:value="volumePercent" :min="0" :max="100" :step="1" class="music-picker-volume-slider" />
          <span class="music-picker-volume-value">{{ volumePercent }}%</span>
        </div>
        <button type="button" class="music-picker-upload" @click="triggerUpload">
          <CloudUploadOutlined class="music-picker-upload-icon" />
          <span class="music-picker-upload-text">上传本地音频</span>
        </button>
        <input
          ref="fileInputRef"
          class="music-picker-file-input"
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.aac"
          @change="onFileSelected"
        />
      </div>
    </div>

    <audio ref="audioRef" class="music-picker-audio" @ended="onAudioEnded" />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { CloseOutlined, CloudUploadOutlined, AudioMutedOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import iconStartUrl from '~/assets/img/icon/icon_start.svg'
import musicIconUrl from '~/assets/img/icon/music-nor.svg'
import { userAssetOfficialQuery } from '~/utils/businessApi'
import type { UserAssetOfficialRow } from '~/types/business-api'

export type MusicLibraryItem = {
  id: string
  name: string
  audioUrl: string
  coverUrl?: string
}

export type MusicPickerConfirmPayload =
  | { type: 'none'; volume: number }
  | { type: 'library'; id: string; name: string; url: string; volume: number }
  | { type: 'local'; name: string; url: string; volume: number }

const NO_MUSIC_ID = '__none__'

const props = defineProps<{
  open: boolean
  initialMusicName?: string
  /** 0~2，与时间轴音量一致 */
  initialVolume?: number
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  confirm: [MusicPickerConfirmPayload]
}>()

const innerOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const musicLibrary = ref<MusicLibraryItem[]>([])
const loading = ref(false)
const selectedId = ref<string>(NO_MUSIC_ID)
const playingId = ref<string | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const volumePercent = ref(13)

function volumeToPercent(volume: number) {
  return Math.max(0, Math.min(100, Math.round((volume / 2) * 100)))
}

function percentToVolume(percent: number) {
  return Math.max(0, Math.min(2, Number(((percent / 100) * 2).toFixed(2))))
}

function resolveBgmAudioUrl(row: UserAssetOfficialRow): string {
  const prompt = String(row.promptText || '').trim()
  const image = String(row.imageUrl || '').trim()
  if (/^https?:\/\//i.test(prompt) && /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(prompt)) return prompt
  if (/^https?:\/\//i.test(prompt) && !/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(prompt)) return prompt
  if (/^https?:\/\//i.test(image) && /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(image)) return image
  if (/^https?:\/\//i.test(image) && !/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(image)) return image
  return prompt || image
}

function resolveBgmCoverUrl(row: UserAssetOfficialRow, audioUrl: string): string | undefined {
  const image = String(row.imageUrl || '').trim()
  if (!image || image === audioUrl) return undefined
  if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(image)) return image
  return undefined
}

async function loadMusicLibrary() {
  loading.value = true
  try {
    const rows = await userAssetOfficialQuery({ assetType: 'bgm' })
    musicLibrary.value = rows
      .map((row) => {
        const audioUrl = resolveBgmAudioUrl(row)
        if (!audioUrl) return null
        return {
          id: String(row.id),
          name: row.assetName || '未命名音乐',
          audioUrl,
          coverUrl: resolveBgmCoverUrl(row, audioUrl)
        } satisfies MusicLibraryItem
      })
      .filter(Boolean) as MusicLibraryItem[]
  } catch {
    musicLibrary.value = []
  } finally {
    loading.value = false
  }
}

function stopAudio() {
  const a = audioRef.value
  if (a) {
    a.pause()
    a.src = ''
  }
  playingId.value = null
}

function emitConfirm(payload: MusicPickerConfirmPayload) {
  stopAudio()
  emit('confirm', payload)
  emit('update:open', false)
}

function confirmNoMusic() {
  selectedId.value = NO_MUSIC_ID
  emitConfirm({ type: 'none', volume: percentToVolume(volumePercent.value) })
}

function confirmMusic(item: MusicLibraryItem) {
  selectedId.value = item.id
  emitConfirm({
    type: 'library',
    id: item.id,
    name: item.name,
    url: item.audioUrl,
    volume: percentToVolume(volumePercent.value)
  })
}

function onPreviewClick(item: MusicLibraryItem) {
  const a = audioRef.value
  if (!a) return
  if (playingId.value === item.id) {
    a.pause()
    playingId.value = null
    return
  }
  stopAudio()
  playingId.value = item.id
  a.src = item.audioUrl
  a.volume = Math.max(0, Math.min(1, volumePercent.value / 100))
  a.play().catch(() => {
    message.warning('试听加载失败，请检查网络或替换为有效音频地址')
    playingId.value = null
  })
}

function onAudioEnded() {
  playingId.value = null
}

function triggerUpload() {
  fileInputRef.value?.click()
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) {
    message.warning('请选择音频文件')
    return
  }
  const url = URL.createObjectURL(file)
  selectedId.value = `local-${Date.now()}`
  emitConfirm({
    type: 'local',
    name: file.name,
    url,
    volume: percentToVolume(volumePercent.value)
  })
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      stopAudio()
      volumePercent.value = volumeToPercent(typeof props.initialVolume === 'number' ? props.initialVolume : 0.25)
      loadMusicLibrary().then(() => {
        const name = props.initialMusicName?.trim()
        if (!name || name === '无音乐') {
          selectedId.value = NO_MUSIC_ID
          return
        }
        const found = musicLibrary.value.find((x) => x.name === name)
        selectedId.value = found?.id ?? NO_MUSIC_ID
      })
    } else {
      stopAudio()
    }
  }
)

function onCancel() {
  stopAudio()
  emit('update:open', false)
}

onUnmounted(() => stopAudio())
</script>

<style>
.music-picker-wrap .ant-modal-content {
  background: var(--create-surface-modal, rgba(25, 26, 29, 1)) !important;
  border-radius: var(--radius-lg, 1rem) !important;
  padding: 0 !important;
  box-shadow: var(--shadow-lg, 0 10px 24px -4px rgba(0, 0, 0, 0.12)) !important;
  overflow: hidden;
}
.music-picker-wrap .ant-modal-header {
  display: none !important;
}
.music-picker-wrap .ant-modal-close {
  color: var(--home-muted, #8e97a5) !important;
  top: 16px !important;
  right: 16px !important;
}
.music-picker-wrap .ant-modal-close:hover {
  color: var(--accent-400, #38bdf8) !important;
}
.music-picker-wrap .ant-modal-body {
  padding: 0 !important;
  background: #191a1d !important;
}
.music-picker-wrap .music-picker-volume-slider .ant-slider-rail {
  background: rgba(255, 255, 255, 0.12) !important;
}
.music-picker-wrap .music-picker-volume-slider .ant-slider-track {
  background: #4ae7fd !important;
}
.music-picker-wrap .music-picker-volume-slider .ant-slider-handle::after {
  box-shadow: 0 0 0 2px #4ae7fd !important;
}
</style>

<style scoped>
.music-picker-close {
  font-size: 14px;
}

.music-picker-shell {
  display: flex;
  flex-direction: column;
  background: #27282d;
  box-shadow: 0px 0px 6px 2px rgba(255, 255, 255, 0.2);
  padding: 12px;
  min-height: min(52vh, 480px);
}

.music-picker-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.4;
  flex-shrink: 0;
}

.music-picker-list {
  display: grid;
  grid-template-columns: repeat(3, 32%);
  grid-auto-rows: max-content;
  align-content: start;
  gap: 2%;
  flex: 1;
  min-height: 0;
  max-height: min(35vh, 420px);
  overflow-y: auto;
  padding-right: 2px;
}

.music-picker-footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  flex-shrink: 0;
}

.music-picker-volume-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(13, 17, 23, 0.95);
  border: 1px solid rgba(96, 124, 158, 0.15);
  border-radius: 8px;
  min-width: 0;
  width: min(200px, 52%);
}

.music-picker-volume-label,
.music-picker-volume-value {
  flex-shrink: 0;
  font-size: 13px;
  color: #e6edf3;
  min-width: 28px;
}

.music-picker-volume-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #8e97a5;
  min-width: 36px;
}

.music-picker-volume-slider {
  flex: 1;
  min-width: 80px;
  margin: 0;
}

.music-picker-upload {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 14px;
  border: 1px dashed rgba(96, 124, 158, 0.35);
  border-radius: 8px;
  background: rgba(13, 17, 23, 0.6);
  color: #e6edf3;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.music-picker-upload:hover {
  border-color: rgba(74, 231, 253, 0.45);
  background: rgba(74, 231, 253, 0.06);
}

.music-picker-upload-icon {
  font-size: 18px;
  color: #4ae7fd;
}

.music-picker-upload-text {
  font-size: 13px;
  font-weight: 500;
}

.music-picker-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.music-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(13, 17, 23, 0.95);
  border: 1px solid rgba(96, 124, 158, 0.15);
  border-radius: 8px;
  min-height: 64px;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.music-card.is-selected {
  border-color: rgba(74, 231, 253, 0.25);
}

.music-card-icon-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(249, 115, 22, 0.15);
}

.music-card-icon-wrap-none {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  background: rgba(96, 124, 158, 0.12);
}

.music-card-none-icon {
  font-size: 20px;
  color: #8e97a5;
}

.music-card-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.music-card-cover-fallback {
  object-fit: contain;
  padding: 8px;
  box-sizing: border-box;
}

.music-card-icon-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.music-card-icon-wrap:hover .music-card-icon-mask,
.music-card-icon-wrap.is-audio-playing .music-card-icon-mask {
  opacity: 1;
}

.music-card-play-inner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.music-card-play-icon {
  display: block;
  width: 24px;
  height: 24px;
}

.music-card-icon-wrap:hover .music-card-play-inner,
.music-card-icon-wrap.is-audio-playing .music-card-play-inner {
  opacity: 1;
}

.music-card-pause {
  opacity: 1 !important;
}

.music-card-pause .pause-bars {
  display: flex;
  gap: 3px;
  align-items: center;
  height: 14px;
}

.music-card-pause .pause-bars::before,
.music-card-pause .pause-bars::after {
  content: '';
  width: 4px;
  height: 14px;
  background: #4ae7fd;
  border-radius: 1px;
}

.music-card-text {
  min-width: 0;
  flex: 1;
}

.music-card-name {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 14px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-card-tags {
  font-size: 12px;
  color: #8e97a5;
  margin-top: 4px;
  line-height: 1.3;
}

.music-card-select-btn {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid rgba(96, 124, 158, 0.35);
  border-radius: 6px;
  background: transparent;
  color: #e6edf3;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.2s,
    color 0.2s,
    background 0.2s;
}

.music-card-select-btn:hover {
  background: rgba(74, 231, 253, 0.1);
  color: #4ae7fd;
}

.music-card-select-btn.is-active {
  background: rgba(74, 231, 253, 0.1);
  color: #4ae7fd;
}

.music-picker-audio {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
