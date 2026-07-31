<template>
  <div class="saim-voice-tab">
    <div v-if="loading" class="saim-voice-empty">
      <a-spin size="large" />
      <p class="saim-voice-empty__text">正在加载官方音色…</p>
    </div>
    <div v-else-if="voices.length === 0" class="saim-voice-empty">
      <p class="saim-voice-empty__text">暂无官方音色</p>
    </div>
    <div v-else class="saim-voice-list">
      <div
        v-for="v in voices"
        :key="v.id"
        :class="['saim-voice-card', { 'is-selected': selectedIds.has(v.id) }]"
      >
        <div
          class="saim-voice-card__avatar-wrap"
          :class="{ 'is-audio-playing': playingId === v.id }"
          @click.stop="onAvatarClick(v)"
        >
          <ShimmerImage
            :src="v.avatar"
            :alt="v.name"
            img-class="saim-voice-card__avatar"
            wrapper-class="saim-voice-card__shimmer"
            object-fit="cover"
            reveal-direction="fade"
            :min-shimmer-ms="280"
          />
          <div class="saim-voice-card__avatar-mask" />
          <div v-if="playingId === v.id" class="saim-voice-card__play-inner saim-voice-card__pause">
            <span class="saim-voice-card__eq" aria-hidden="true">
              <span class="saim-eq-bar saim-eq-bar-1" />
              <span class="saim-eq-bar saim-eq-bar-2" />
              <span class="saim-eq-bar saim-eq-bar-3" />
            </span>
          </div>
          <div v-else class="saim-voice-card__play-inner">
            <img class="saim-voice-card__play-icon" :src="iconStartUrl" alt="试听" width="24" height="24" />
          </div>
        </div>
        <div class="saim-voice-card__text">
          <div class="saim-voice-card__name">{{ v.name }}</div>
          <div class="saim-voice-card__tags">{{ v.gender }}/{{ v.ageLabel }}</div>
        </div>
        <button
          type="button"
          class="saim-voice-card__select-btn"
          :class="{ 'is-active': selectedIds.has(v.id) }"
          @click.stop="onSelect(v)"
        >
          {{ selectedIds.has(v.id) ? '已选择' : '选择TA' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import iconStartUrl from '~/assets/img/icon/icon_start.svg'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import { userVoiceLibraryList } from '~/utils/businessApi'
import { useReferenceAudioPreview } from '~/composables/useReferenceAudioPreview'

export type OfficialVoicePick = {
  id: string
  name: string
  gender: string
  ageLabel: string
  avatar: string
  previewUrl: string
  voiceLibraryId?: number
}

const props = defineProps<{
  open: boolean
  /** 已选用的官方音色 id 集合（用于按钮态） */
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  select: [voice: OfficialVoicePick]
}>()

const GENDER_MAP: Record<string, string> = { female: '女性', male: '男性', neutral: '中性' }
const AGE_MAP: Record<string, string> = {
  child: '儿童',
  teen: '少年',
  young: '青年',
  adult: '成年',
  middle: '中年',
  elderly: '老年'
}

const voices = ref<OfficialVoicePick[]>([])
const loading = ref(false)
const { playingId, play, stop } = useReferenceAudioPreview()

async function loadVoices() {
  loading.value = true
  try {
    const res = await userVoiceLibraryList({ pageNum: 1, pageSize: 100 })
    const rows = Array.isArray(res?.data) ? res.data : []
    voices.value = rows.map((item: any) => ({
      id: String(item.id),
      name: item.voiceName || '未命名',
      gender: GENDER_MAP[item.gender] || item.gender || '未知',
      ageLabel: AGE_MAP[item.ageRange] || item.ageRange || '未知',
      avatar: item.avatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${item.id}`,
      previewUrl: item.sampleUrl || '',
      voiceLibraryId: Number(item.id) > 0 ? Number(item.id) : undefined
    }))
  } catch {
    voices.value = []
  } finally {
    loading.value = false
  }
}

function onAvatarClick(v: OfficialVoicePick) {
  void play(v.previewUrl, v.id)
}

function onSelect(v: OfficialVoicePick) {
  emit('select', v)
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      stop()
      void loadVoices()
    } else {
      stop()
    }
  },
  { immediate: true }
)

onUnmounted(() => stop())
</script>

<style scoped>
.saim-voice-tab {
  --create-ref-audio-bg: var(--accent-100, rgba(74, 231, 253, 0.1));
  --create-ref-audio-border: var(--accent-400, rgba(74, 231, 253, 0.42));
  --create-ref-audio-text: var(--accent-500, #4ae7fd);
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.saim-voice-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 280px;
  color: var(--home-muted, #8e97a5);
}

.saim-voice-empty__text {
  margin: 0;
  font-size: 13px;
}

.saim-voice-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-content: start;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 140, 170, 0.45) transparent;
}

.saim-voice-list::-webkit-scrollbar {
  width: 4px;
}

.saim-voice-list::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.45);
  border-radius: 4px;
}

.saim-voice-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(13, 17, 23, 0.95);
  border: 1px solid rgba(96, 124, 158, 0.15);
  border-radius: 8px;
  min-height: 64px;
}

.saim-voice-card.is-selected {
  border-color: var(--create-ref-audio-border);
  background: var(--create-ref-audio-bg);
}

.saim-voice-card__avatar-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
}

.saim-voice-card__avatar-wrap :deep(.saim-voice-card__shimmer) {
  width: 100%;
  height: 100%;
}

.saim-voice-card__avatar-wrap :deep(.saim-voice-card__avatar) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.saim-voice-card__avatar-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.saim-voice-card__avatar-wrap:hover .saim-voice-card__avatar-mask,
.saim-voice-card__avatar-wrap.is-audio-playing .saim-voice-card__avatar-mask,
.saim-voice-card:hover .saim-voice-card__avatar-mask {
  opacity: 1;
}

.saim-voice-card__play-inner {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.saim-voice-card__play-icon {
  display: block;
  width: 24px;
  height: 24px;
}

.saim-voice-card__avatar-wrap:hover .saim-voice-card__play-inner,
.saim-voice-card__avatar-wrap.is-audio-playing .saim-voice-card__play-inner,
.saim-voice-card:hover .saim-voice-card__play-inner {
  opacity: 1;
}

.saim-voice-card__pause {
  opacity: 1 !important;
}

.saim-voice-card__eq {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
}

.saim-eq-bar {
  width: 3px;
  background: var(--create-ref-audio-text, #4ae7fd);
  border-radius: 2px;
  transform-origin: center bottom;
  animation: saim-voice-eq 0.45s ease-in-out infinite alternate;
}

.saim-eq-bar-1 {
  height: 8px;
  animation-delay: 0s;
}

.saim-eq-bar-2 {
  height: 16px;
  animation-delay: 0.12s;
}

.saim-eq-bar-3 {
  height: 11px;
  animation-delay: 0.24s;
}

@keyframes saim-voice-eq {
  0% {
    transform: scaleY(0.35);
    opacity: 0.7;
  }
  100% {
    transform: scaleY(1);
    opacity: 1;
  }
}

.saim-voice-card__text {
  flex: 1;
  min-width: 0;
}

.saim-voice-card__name {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.saim-voice-card__tags {
  margin-top: 2px;
  font-size: 12px;
  color: var(--home-muted, #8e97a5);
}

.saim-voice-card__select-btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid rgba(96, 124, 158, 0.35);
  background: rgba(10, 13, 18, 0.9);
  color: #e6edf3;
  font-size: 12px;
  cursor: pointer;
}

.saim-voice-card__select-btn.is-active,
.saim-voice-card__select-btn:hover {
  border-color: var(--create-ref-audio-border);
  color: var(--create-ref-audio-text);
}
</style>
