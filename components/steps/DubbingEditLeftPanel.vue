<template>
  <div class="dubbing-edit-left">
    <div class="config-tabs config-tabs--two">
      <button
        type="button"
        :class="['config-tab', { active: leftTab === 'tts' }]"
        @click="leftTab = 'tts'"
      >
        文本朗读
      </button>
      <button
        type="button"
        :class="['config-tab', { active: leftTab === 'upload' }]"
        @click="leftTab = 'upload'"
      >
        上传本地配音
      </button>
    </div>

    <div class="dubbing-edit-scroll">
      <div v-if="leftTab === 'tts'" class="dubbing-left-tts">
        <RichTextEditor
          v-model="dialogueModel"
          :min-height="dubbingEditorHeight"
          :max-height="dubbingEditorHeight"
          :max-length="50"
          placeholder="请输入要配音的台词"
          class="dubbing-dialogue-input"
        />
        <div class="dubbing-tts-actions">
          <a-button
            type="link"
            class="dubbing-preview-btn"
            :class="{ 'is-playing': ttsPreviewPlaying }"
            :loading="ttsPreviewLoading"
            :disabled="ttsPreviewLoading"
            @click="emit('preview-listen')"
          >
            <span class="dubbing-preview-btn__inner">
              <span
                v-if="ttsPreviewPlaying && !ttsPreviewLoading"
                class="voice-preview-eq"
                aria-hidden="true"
              >
                <span class="voice-preview-eq-bar voice-preview-eq-bar-1" />
                <span class="voice-preview-eq-bar voice-preview-eq-bar-2" />
                <span class="voice-preview-eq-bar voice-preview-eq-bar-3" />
              </span>
              <CaretRightOutlined v-else-if="!ttsPreviewLoading" />
              <span>{{
                ttsPreviewLoading ? '生成中…' : ttsPreviewPlaying ? '播放中' : '试听'
              }}</span>
            </span>
          </a-button>
          <span class="dubbing-tts-hint">试听音色可获取准确的语调时长</span>
          <span
            v-if="ttsPreviewDurationSec != null && !ttsPreviewLoading"
            class="dubbing-tts-duration"
            >时长 {{ formatPreviewDuration(ttsPreviewDurationSec) }}</span
          >
        </div>
        <div class="dubbing-dialogue-footer">
          <span class="dubbing-char-count">{{ dialoguePlainLen }}/50</span>
          <button
            type="button"
            class="dubbing-clear-btn"
            aria-label="清空"
            @click="dialogueModel = ''"
          >
            <DeleteOutlined />
          </button>
        </div>

        <div class="dubbing-field dubbing-voice-field">
          <div class="dubbing-field-label">配音音色：</div>
          <button type="button" class="dubbing-voice-picker" @click="emit('pick-voice')">
            <div class="dubbing-voice-avatar">
              <UserOutlined v-if="!voiceAvatarUrl" />
              <img v-else :src="voiceAvatarUrl" alt="" />
            </div>
            <span class="dubbing-voice-name">{{ voiceNameModel || '无音色' }}</span>
            <RightOutlined class="dubbing-voice-arrow" />
          </button>
        </div>

        <div class="dubbing-field dubbing-emotion-field">
          <div class="dubbing-emotion-header">
            <div class="dubbing-field-label">情感</div>
            <span v-if="emotionOverflowCount > 0" class="dubbing-emotion-count">
              共 {{ EMOTIONS.length }}
            </span>
          </div>
          <div
            :class="[
              'dubbing-emotion-shell',
              { 'is-collapsed': !emotionExpanded && emotionOverflowCount > 0 }
            ]"
          >
            <div class="dubbing-emotion-grid">
              <button
                v-for="emo in visibleEmotions"
                :key="emo"
                type="button"
                :class="['dubbing-emotion-btn', { active: emotionModel === emo }]"
                @click="emotionModel = emo"
              >
                {{ emo }}
              </button>
            </div>
            <div
              v-if="!emotionExpanded && emotionOverflowCount > 0"
              class="dubbing-emotion-fade"
              aria-hidden="true"
            />
          </div>
          <button
            v-if="emotionOverflowCount > 0"
            type="button"
            class="dubbing-emotion-toggle"
            :aria-expanded="emotionExpanded"
            @click="emotionExpanded = !emotionExpanded"
          >
            <span>{{ emotionExpanded ? '收起' : `展开全部（+${emotionOverflowCount}）` }}</span>
            <UpOutlined v-if="emotionExpanded" class="dubbing-emotion-toggle-icon" />
            <DownOutlined v-else class="dubbing-emotion-toggle-icon" />
          </button>
        </div>
      </div>

      <div v-else class="dubbing-left-upload">
        <a-upload-dragger
          v-model:file-list="uploadFileList"
          name="file"
          :max-count="1"
          accept="audio/*,.mp3,.wav,.m4a,.aac"
          :before-upload="beforeUploadAudio"
          @remove="onRemoveUpload"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p class="ant-upload-text">点击或拖拽音频文件到此区域</p>
          <p class="ant-upload-hint">支持常见音频格式，将用于本段分镜配音</p>
        </a-upload-dragger>
        <p v-if="localAudioName" class="dubbing-upload-name">已选：{{ localAudioName }}</p>
      </div>
    </div>

    <div class="dubbing-bottom-actions">
      <div class="dubbing-lip-row">
        <span class="dubbing-lip-label">对口型</span>
        <a-switch v-model:checked="lipSyncModel" />
      </div>
      <a-button type="primary" block size="large" class="dubbing-start-btn" @click="onStartDubbing">
        <img src="@/assets/img/icon/star_white.svg" alt="">
        开始配音
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import {
  CaretRightOutlined,
  DeleteOutlined,
  UserOutlined,
  RightOutlined,
  DownOutlined,
  UpOutlined,
  InboxOutlined
} from '@ant-design/icons-vue'
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import { htmlPlainTextLength, isHtmlContentEmpty } from '~/utils/htmlPlain'

const props = withDefaults(
  defineProps<{
    dialogue: string
    emotion: string
    /** 情绪选项（由父弹窗拉取 tags 后下发，避免重复请求） */
    emotionOptions?: string[]
    lipSync: boolean
    voiceName: string
    voiceAvatarUrl?: string
    /** 试听接口请求中 */
    ttsPreviewLoading?: boolean
    /** 试听音频播放中（展示动效） */
    ttsPreviewPlaying?: boolean
    /** 最近一次试听成功后的音频时长（秒） */
    ttsPreviewDurationSec?: number | null
  }>(),
  {
    emotionOptions: () => [],
    ttsPreviewLoading: false,
    ttsPreviewPlaying: false,
    ttsPreviewDurationSec: null
  }
)

const EMOTION_GRID_COLS = 3
const EMOTION_COLLAPSED_ROWS = 4
const EMOTION_COLLAPSED_COUNT = EMOTION_GRID_COLS * EMOTION_COLLAPSED_ROWS

const EMOTIONS = computed(() =>
  props.emotionOptions?.length
    ? props.emotionOptions
    : ['中性', '开心', '悲伤', '愤怒', '激动']
)

const emotionExpanded = ref(false)
const emotionModel = ref(props.emotion || '中性')

const emotionOverflowCount = computed(() =>
  Math.max(0, EMOTIONS.value.length - EMOTION_COLLAPSED_COUNT)
)

/** 折叠时固定 4 行；若当前选中不在前 12 项，替换末位以保证选中可见 */
const visibleEmotions = computed(() => {
  const all = EMOTIONS.value
  if (emotionExpanded.value || all.length <= EMOTION_COLLAPSED_COUNT) return all
  const head = all.slice(0, EMOTION_COLLAPSED_COUNT)
  const selected = String(emotionModel.value || '').trim()
  if (!selected || head.includes(selected)) return head
  const next = head.slice(0, EMOTION_COLLAPSED_COUNT - 1)
  next.push(selected)
  return next
})

function formatPreviewDuration(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return '—'
  return `${sec.toFixed(1)} 秒`
}

const emit = defineEmits<{
  'update:dialogue': [v: string]
  'update:emotion': [v: string]
  'update:lipSync': [v: boolean]
  'update:voiceName': [v: string]
  'preview-listen': []
  'pick-voice': []
  'start-dubbing': [payload: { mode: 'tts' | 'upload'; localFile: File | null }]
}>()

const leftTab = ref<'tts' | 'upload'>('tts')
const uploadFileList = ref<UploadProps['fileList']>([])
const localAudioFile = ref<File | null>(null)
const localAudioName = ref('')

const dialogueModel = ref(props.dialogue)
const dialoguePlainLen = computed(() => htmlPlainTextLength(dialogueModel.value))
const lipSyncModel = ref(props.lipSync)
const voiceNameModel = ref(props.voiceName)
const viewportHeight = ref(1080)

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function updateViewportHeight() {
  if (!import.meta.client) return
  viewportHeight.value = window.innerHeight
}

const dubbingEditorHeight = computed(() => {
  const vp = clamp(viewportHeight.value, 768, 1400)
  const ratio = (vp - 768) / (1400 - 768)
  const height = Math.round(96 + ratio * (190 - 96))
  return `${height}px`
})

onMounted(() => {
  if (!import.meta.client) return
  updateViewportHeight()
  window.addEventListener('resize', updateViewportHeight)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('resize', updateViewportHeight)
})

watch(
  () => props.dialogue,
  (v) => {
    dialogueModel.value = v
  }
)
watch(
  () => props.emotion,
  (v) => {
    emotionModel.value = v || '中性'
  }
)
watch(
  () => props.lipSync,
  (v) => {
    lipSyncModel.value = !!v
  }
)
watch(
  () => props.voiceName,
  (v) => {
    voiceNameModel.value = v || ''
  }
)

watch(dialogueModel, (v) => emit('update:dialogue', v))
watch(emotionModel, (v) => emit('update:emotion', v))
watch(lipSyncModel, (v) => emit('update:lipSync', v))
watch(voiceNameModel, (v) => emit('update:voiceName', v))

const beforeUploadAudio: UploadProps['beforeUpload'] = (file) => {
  localAudioFile.value = file as File
  localAudioName.value = (file as File).name
  return false
}

function onRemoveUpload() {
  localAudioFile.value = null
  localAudioName.value = ''
}

function onStartDubbing() {
  if (leftTab.value === 'upload') {
    if (!localAudioFile.value) {
      message.warning('请先上传音频文件')
      return
    }
    emit('start-dubbing', { mode: 'upload', localFile: localAudioFile.value })
    return
  }
  if (isHtmlContentEmpty(dialogueModel.value)) {
    message.warning('请先为分镜添加台词')
    return
  }
  const vn = (voiceNameModel.value || '').trim()
  if (!vn || vn === '无音色') {
    message.warning('请先选择配音音色')
    return
  }
  emit('start-dubbing', { mode: 'tts', localFile: null })
}

defineExpose({
  leftTab,
  getLocalAudioFile: () => localAudioFile.value
})
</script>

<style lang="scss" scoped>
.dubbing-edit-left {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: rgba(25, 26, 29, 1);
  border-right: none;
}
:deep(.ql-container.ql-snow) {
  background: rgba(18, 18, 18, 1);
  border-radius: 8px;
}
.config-tabs--two {
  display: flex;
  width: 70%;
  margin: auto;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  background: rgba(35, 67, 74, 1);
  margin-bottom: 12px;
  flex-shrink: 0;
  padding: 0;
}

.config-tabs--two .config-tab {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(225, 239, 255, 0.7);
  font-size: 14px;
  line-height: 1.2;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 4px;
}

.config-tabs--two .config-tab.active {
  color: #0b1522 !important;
  font-weight: 600;
  background: rgba(74, 231, 253, 1);
}

.dubbing-edit-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.dubbing-edit-scroll::-webkit-scrollbar {
  width: 8px;
}

.dubbing-edit-scroll::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.55);
  border-radius: 4px;
}

.dubbing-left-tts,
.dubbing-left-upload {
  padding: 10px 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dubbing-dialogue-input {
  resize: none;
}

.dubbing-dialogue-input :deep(.ql-editor) {
  resize: none;
  font-size: 12px;
}

.dubbing-tts-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.dubbing-preview-btn {
  padding: 0;
  height: auto;
  font-weight: 600;
  font-size: 14px;
}

.dubbing-preview-btn__inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dubbing-preview-btn.is-playing {
  color: rgba(74, 231, 253, 0.95);
}

.voice-preview-eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.voice-preview-eq-bar {
  width: 2px;
  background: currentColor;
  border-radius: 1px;
  animation: voice-preview-eq 0.45s ease-in-out infinite alternate;
}

.voice-preview-eq-bar-1 {
  height: 6px;
  animation-delay: 0s;
}

.voice-preview-eq-bar-2 {
  height: 11px;
  animation-delay: 0.12s;
}

.voice-preview-eq-bar-3 {
  height: 8px;
  animation-delay: 0.24s;
}

@keyframes voice-preview-eq {
  0% {
    transform: scaleY(0.35);
    opacity: 0.7;
  }
  100% {
    transform: scaleY(1);
    opacity: 1;
  }
}

.dubbing-tts-hint {
  font-size: 0.78rem;
  color: var(--home-muted, #8e97a5);
}

.dubbing-tts-duration {
  font-size: 0.78rem;
  color: rgba(74, 231, 253, 0.95);
  font-weight: 600;
}

.dubbing-dialogue-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -0.5rem;
}

.dubbing-char-count {
  font-size: 0.8rem;
  color: var(--home-muted, #8e97a5);
}

.dubbing-clear-btn {
  border: none;
  background: none;
  color: var(--home-muted, #8e97a5);
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
}

.dubbing-clear-btn:hover {
  color: var(--red-500);
}

.dubbing-field-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.5rem;
}

.dubbing-voice-picker {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border: 1px solid var(--gray-200, rgba(96, 124, 158, 0.22));
  border-radius: var(--radius-md);
  background: var(--create-surface-panel);
  cursor: pointer;
  text-align: left;
}

.dubbing-voice-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--home-muted, #8e97a5);
  overflow: hidden;
  flex-shrink: 0;
}

.dubbing-voice-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dubbing-voice-name {
  flex: 1;
  font-size: 0.9rem;
  color: var(--home-text, #e6edf3);
}

.dubbing-voice-arrow {
  color: var(--home-muted, #8e97a5);
  font-size: 0.75rem;
}

.dubbing-emotion-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.dubbing-emotion-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.dubbing-emotion-header .dubbing-field-label {
  margin-bottom: 0;
}

.dubbing-emotion-count {
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  color: var(--home-muted, #8e97a5);
  white-space: nowrap;
}

.dubbing-emotion-shell {
  position: relative;
}

.dubbing-emotion-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.dubbing-emotion-btn {
  padding: 0.45rem 0.35rem;
  border: 1px solid var(--gray-200, rgba(96, 124, 158, 0.22));
  border-radius: var(--radius-m);
  background: var(--create-surface-panel);
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--home-text, #e6edf3);
  line-height: 1.1;
  min-height: 2rem;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.dubbing-emotion-btn:hover {
  border-color: rgba(94, 234, 212, 0.35);
  background: rgba(94, 234, 212, 0.06);
}

.dubbing-emotion-btn.active {
  border-color: rgba(94, 234, 212, 0.72);
  background: rgba(94, 234, 212, 0.1);
  color: #dffcf5;
  box-shadow: inset 0 0 0 1px rgba(94, 234, 212, 0.12);
}

.dubbing-emotion-fade {
  pointer-events: none;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1.6rem;
  background: linear-gradient(
    to bottom,
    rgba(16, 22, 32, 0),
    rgba(16, 22, 32, 0.72) 55%,
    rgba(16, 22, 32, 0.92)
  );
}

.dubbing-emotion-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  align-self: center;
  margin-top: 0.1rem;
  padding: 0.28rem 0.85rem;
  border: 1px solid rgba(96, 124, 158, 0.28);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--home-muted, #9aa6b8);
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.dubbing-emotion-toggle:hover {
  color: #dffcf5;
  border-color: rgba(94, 234, 212, 0.4);
  background: rgba(94, 234, 212, 0.08);
}

.dubbing-emotion-toggle-icon {
  font-size: 0.65rem;
}

.dubbing-lip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.dubbing-lip-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
}

.dubbing-lip-row :deep(.ant-switch) {
  background: rgba(106, 123, 148, 0.7) !important;
  border: 1px solid rgba(180, 198, 224, 0.48) !important;
}

.dubbing-lip-row :deep(.ant-switch.ant-switch-checked) {
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  border-color: rgba(0, 171, 216, 0.95) !important;
}

.dubbing-lip-row :deep(.ant-switch .ant-switch-handle::before) {
  background: #ffffff !important;
}

.dubbing-start-btn {
  height: 44px;
  font-size: 14px;
  border-radius: var(--radius-md);
  img{
    width: 18px;
    height: 18px;
    margin-right: 16px;
  }
}

.dubbing-bottom-actions {
  flex-shrink: 0;
  margin-top: auto;
  padding: 0.75rem 0 0.25rem;
  background: rgba(25, 26, 29, 1);
  border-top: 1px solid rgba(96, 124, 158, 0.16);
}

.dubbing-upload-name {
  font-size: 0.85rem;
  color: var(--home-muted, #8e97a5);
  margin: 0;
}

:deep(.ant-upload-wrapper .ant-upload-drag),
:deep(.ant-upload.ant-upload-drag) {
  background: var(--create-surface-input, rgba(28, 38, 54, 0.92)) !important;
  border-color: var(--gray-200, rgba(96, 124, 158, 0.22)) !important;
}

:deep(.ant-upload-wrapper .ant-upload-drag:hover) {
  border-color: var(--accent-400, #38bdf8) !important;
}

:deep(.ant-upload-text) {
  color: var(--home-text, #e6edf3) !important;
}

:deep(.ant-upload-hint) {
  color: var(--home-muted, #8e97a5) !important;
}

:deep(.ant-upload-drag-icon .anticon) {
  color: var(--accent-400, #38bdf8) !important;
}
</style>
