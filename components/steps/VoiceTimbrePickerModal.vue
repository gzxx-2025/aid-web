<template>
  <a-modal
    v-model:open="innerOpen"
    :width="860"
    :footer="null"
    :destroy-on-close="true"
    wrap-class-name="create-flow-modal voice-timbre-picker-wrap"
    class="voice-timbre-picker-modal"
    centered
    :z-index="11000"
    @cancel="onCancel"
  >
    <template #closeIcon>
      <CloseOutlined class="voice-picker-close" />
    </template>

    <div class="voice-picker-shell">
      <h2 class="voice-picker-title">配音角色</h2>

      <div class="voice-picker-filters">
        <a-select
          :key="`fn-${filterResetKey}`"
          v-model:value="filterName"
          class="voice-picker-select"
          allow-clear
          :options="nameOptions"
          placeholder="姓名"
          :get-popup-container="popupContainer"
        />
        <a-select
          :key="`fa-${filterResetKey}`"
          v-model:value="filterAge"
          class="voice-picker-select"
          allow-clear
          :options="ageOptions"
          placeholder="年龄"
          :get-popup-container="popupContainer"
        />
        <a-select
          :key="`fac-${filterResetKey}`"
          v-model:value="filterAccent"
          class="voice-picker-select"
          allow-clear
          :options="accentOptions"
          placeholder="口音"
          :get-popup-container="popupContainer"
        />
      </div>

      <div class="voice-picker-list">
        <div
          v-for="v in filteredVoices"
          :key="v.id"
          :class="['voice-card', { 'is-selected': selectedId === v.id }]"
        >
          <div
            class="voice-card-avatar-wrap"
            :class="{ 'is-audio-playing': playingId === v.id }"
            @click.stop="onAvatarClick(v)"
          >
            <img class="voice-card-avatar" :src="v.avatar" :alt="v.name" />
            <div class="voice-card-avatar-mask" />
            <div v-if="playingId === v.id" class="voice-card-play-inner voice-card-pause">
              <span class="pause-bars" />
            </div>
            <div v-else class="voice-card-play-inner">
              <img
                class="voice-card-play-icon"
                :src="iconStartUrl"
                alt="试听"
                width="24"
                height="24"
              />
            </div>
          </div>
          <div class="voice-card-text">
            <div class="voice-card-name">{{ v.name }}</div>
            <div class="voice-card-tags">{{ v.gender }}/{{ v.ageLabel }}</div>
          </div>
          <button
            type="button"
            class="voice-card-select-btn"
            :class="{ 'is-active': selectedId === v.id }"
            @click.stop="confirmVoice(v)"
          >
            选择TA
          </button>
        </div>
      </div>
    </div>

    <audio ref="audioRef" class="voice-picker-audio" @ended="onAudioEnded" @pause="onAudioPause" />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import iconStartUrl from '~/assets/img/icon/icon_start.svg'
import { userVoiceLibraryList } from '~/utils/businessApi'

export type VoiceTimbreItem = {
  id: string
  name: string
  gender: string
  ageLabel: string
  accent: string
  avatar: string
  /** 试听地址 */
  previewUrl: string
  /** 音色库记录ID，用于 TTS 接口 voiceLibraryId */
  voiceLibraryId?: number
}

const props = defineProps<{
  open: boolean
  initialVoiceName?: string
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  confirm: [
    payload: {
      name: string
      avatarUrl: string
      id: string
      previewUrl: string
      voiceLibraryId?: number
    }
  ]
}>()

const innerOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

/** 从接口加载的音色列表 */
const allVoices = ref<VoiceTimbreItem[]>([])
const loading = ref(false)

const GENDER_MAP: Record<string, string> = { female: '女性', male: '男性', neutral: '中性' }
const AGE_MAP: Record<string, string> = {
  child: '儿童',
  teen: '少年',
  young: '青年',
  adult: '成年',
  middle: '中年',
  elderly: '老年'
}

async function loadVoices() {
  loading.value = true
  try {
    const res = await userVoiceLibraryList({ pageNum: 1, pageSize: 100 })
    allVoices.value = res.data.map((item: any) => ({
      id: String(item.id),
      name: item.voiceName || '未命名',
      gender: GENDER_MAP[item.gender] || item.gender || '未知',
      ageLabel: AGE_MAP[item.ageRange] || item.ageRange || '未知',
      accent:
        item.language === 'zh-CN'
          ? '普通话'
          : item.language === 'en-US'
            ? '英语'
            : item.language === 'ja-JP'
              ? '日语'
              : item.language || '普通话',
      avatar: item.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${item.id}`,
      previewUrl: item.sampleUrl || '',
      voiceLibraryId: Number(item.id)
    }))
  } catch {
    // 接口失败时列表为空
  } finally {
    loading.value = false
  }
}

/** 使用 null + 打开时 key 递增，确保仅显示占位符「姓名/年龄/口音」 */
const filterName = ref<string | null>(null)
const filterAge = ref<string | null>(null)
const filterAccent = ref<string | null>(null)
const filterResetKey = ref(0)

function popupContainer(triggerNode: HTMLElement) {
  return (triggerNode?.closest?.('.ant-modal-content') as HTMLElement) || document.body
}
const selectedId = ref<string | null>(null)
const playingId = ref<string | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)

const nameOptions = computed(() =>
  [...new Set(allVoices.value.map((x) => x.name))].map((n) => ({ value: n, label: n }))
)
const ageOptions = computed(() =>
  [...new Set(allVoices.value.map((x) => x.ageLabel))].map((a) => ({ value: a, label: a }))
)
const accentOptions = computed(() =>
  [...new Set(allVoices.value.map((x) => x.accent))].map((x) => ({ value: x, label: x }))
)

const filteredVoices = computed(() => {
  return allVoices.value.filter((v) => {
    if (filterName.value && v.name !== filterName.value) return false
    if (filterAge.value && v.ageLabel !== filterAge.value) return false
    if (filterAccent.value && v.accent !== filterAccent.value) return false
    return true
  })
})

function stopAudio() {
  const a = audioRef.value
  if (a) {
    a.pause()
    a.src = ''
  }
  playingId.value = null
}

function confirmVoice(v: VoiceTimbreItem) {
  stopAudio()
  emit('confirm', {
    name: v.name,
    avatarUrl: v.avatar,
    id: v.id,
    previewUrl: v.previewUrl,
    voiceLibraryId: v.voiceLibraryId
  })
  emit('update:open', false)
}

function onAvatarClick(v: VoiceTimbreItem) {
  const a = audioRef.value
  if (!a) return
  if (playingId.value === v.id) {
    a.pause()
    playingId.value = null
    return
  }
  stopAudio()
  playingId.value = v.id
  a.src = v.previewUrl
  a.play().catch(() => {
    message.warning('试听加载失败，请检查网络或替换为有效试听地址')
    playingId.value = null
  })
}

function onAudioEnded() {
  playingId.value = null
}

function onAudioPause() {
  if (audioRef.value && audioRef.value.ended) return
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      filterResetKey.value += 1
      filterName.value = null
      filterAge.value = null
      filterAccent.value = null
      stopAudio()
      // 加载音色列表
      loadVoices().then(() => {
        const name = props.initialVoiceName?.trim()
        const found = name ? allVoices.value.find((x) => x.name === name) : null
        selectedId.value = found?.id ?? allVoices.value[0]?.id ?? null
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
/* 与创建流程深色主题一致 */
.voice-timbre-picker-wrap .ant-modal-content {
  background: var(--create-surface-modal, rgba(25, 26, 29, 1)) !important;
  border-radius: var(--radius-lg, 1rem) !important;
  padding: 0 !important;
  box-shadow: var(--shadow-lg, 0 10px 24px -4px rgba(0, 0, 0, 0.12)) !important;
  overflow: hidden;
}
.voice-timbre-picker-wrap .ant-modal-header {
  display: none !important;
}
.voice-timbre-picker-wrap .ant-modal-close {
  color: var(--home-muted, #8e97a5) !important;
  top: 16px !important;
  right: 16px !important;
}
.voice-timbre-picker-wrap .ant-modal-close:hover {
  color: var(--accent-400, #38bdf8) !important;
}
.voice-timbre-picker-wrap .ant-modal-body {
  padding: 0 !important;
  background: #191a1d !important;
}
.voice-timbre-picker-wrap .voice-picker-select .ant-select-selector {
  background: #0a0d12 !important;
  border: none !important;
  border-radius: 8px !important;
  min-height: 36px !important;
}
.voice-timbre-picker-wrap .voice-picker-select.ant-select-focused .ant-select-selector,
.voice-timbre-picker-wrap .voice-picker-select:hover .ant-select-selector {
  border-color: var(--accent-400, #38bdf8) !important;
}
.voice-timbre-picker-wrap .voice-picker-select .ant-select-selection-placeholder {
  color: var(--home-muted, #8e97a5) !important;
}
.voice-timbre-picker-wrap .voice-picker-select .ant-select-selection-item {
  color: var(--home-text, #e6edf3) !important;
}
.voice-timbre-picker-wrap .voice-picker-select .ant-select-arrow {
  color: var(--home-muted, #8e97a5) !important;
}
</style>

<style scoped>
.voice-picker-close {
  font-size: 14px;
}

.voice-picker-shell {
  background: #27282d;
  box-shadow: 0px 0px 6px 2px rgba(255, 255, 255, 0.2);
  padding: 12px;
}

.voice-picker-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.4;
}

.voice-picker-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.voice-picker-select {
  min-width: 0;
  flex: 1;
}

.voice-picker-list {
  display: grid;
  grid-template-columns: repeat(3, 32%);
  grid-auto-rows: max-content;
  align-content: start;
  gap: 2%;
  max-height: min(35vh, 420px);
  overflow-y: auto;
  padding-right: 2px;
}

.voice-card {
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

.voice-card.is-selected {
  border-color: rgba(74, 231, 253, 0.25);
}

.voice-card-avatar-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
}

.voice-card-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.voice-card-avatar-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.voice-card-avatar-wrap:hover .voice-card-avatar-mask,
.voice-card-avatar-wrap.is-audio-playing .voice-card-avatar-mask {
  opacity: 1;
}

.voice-card-play-inner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.voice-card-play-icon {
  display: block;
  width: 24px;
  height: 24px;
}

.voice-card-avatar-wrap:hover .voice-card-play-inner,
.voice-card-avatar-wrap.is-audio-playing .voice-card-play-inner {
  opacity: 1;
}

.voice-card-pause {
  opacity: 1 !important;
}

.voice-card-pause .pause-bars {
  display: flex;
  gap: 3px;
  align-items: center;
  height: 14px;
}

.voice-card-pause .pause-bars::before,
.voice-card-pause .pause-bars::after {
  content: '';
  width: 4px;
  height: 14px;
  background: #4ae7fd;
  border-radius: 1px;
}

.voice-card-text {
  min-width: 0;
  flex: 1;
}

.voice-card-name {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 14px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-card-tags {
  font-size: 12px;
  color: #8e97a5;
  margin-top: 4px;
  line-height: 1.3;
}

.voice-card-select-btn {
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

.voice-card-select-btn:hover {
  background: rgba(74, 231, 253, 0.1);
  color: #4ae7fd;
}

.voice-card-select-btn.is-active {
  background: rgba(74, 231, 253, 0.1);
  color: #4ae7fd;
}

.voice-picker-audio {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
