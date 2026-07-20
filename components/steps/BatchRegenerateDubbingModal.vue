<template>
  <a-modal
    v-model:open="localOpen"
    :width="1100"
    :footer="null"
    :title="null"
    :closable="false"
    class="batch-regenerate-dubbing-modal"
    wrap-class-name="create-flow-modal batch-regenerate-dubbing-wrap"
    @cancel="handleCancel"
  >
    <div class="brdm">
      <header class="brdm-header">
        <h2 class="brdm-title">{{ modalTitle }}</h2>
        <button type="button" class="brdm-close" aria-label="关闭" @click="handleCancel">
          <CloseOutlined />
        </button>
      </header>

      <div class="brdm-toolbar">
        <button type="button" class="brdm-select-all" @click="toggleSelectAll">
          <img
            class="brdm-check-icon"
            :src="isAllSelectableChecked ? dialogSelectSelIcon : dialogSelectNorIcon"
            alt=""
          />
          <span class="brdm-select-all-text">全选 ({{ selectedIds.size }}/{{ selectableCount }})</span>
        </button>
        <span class="brdm-pending">待处理 ({{ pendingCount }})</span>
      </div>

      <div class="brdm-body">
        <div class="brdm-grid">
          <article
            v-for="(item, index) in cardList"
            :key="item.panel.id"
            :class="[
              'brdm-card',
              {
                'brdm-card--selected': item.canSelect && selectedIds.has(item.panel.id),
                'brdm-card--disabled': !item.canSelect
              }
            ]"
            @click="onCardClick(item)"
          >
            <div class="brdm-card-media">
              <template v-if="item.canSelect">
                <VideoPosterImg
                  :src="item.thumbnailUrl"
                  img-class="brdm-card-img"
                />
                <img
                  class="brdm-card-select"
                  :src="selectedIds.has(item.panel.id) ? dialogSelectSelIcon : dialogSelectNorIcon"
                  alt=""
                />
              </template>
              <a-tooltip v-else title="暂无分镜视频">
                <div class="brdm-card-media-cover">
                  <img
                    :src="workCoverPlaceholderUrl"
                    class="brdm-card-placeholder-img"
                    alt=""
                  />
                </div>
              </a-tooltip>
            </div>

            <div class="brdm-card-meta">
              <div class="brdm-card-name">{{ formatCardTitle(item.panel.title) }}</div>

              <template v-if="item.hasDialogue">
                <button
                  type="button"
                  :class="['brdm-card-field', { 'brdm-card-field--disabled': !item.canSelect }]"
                  :disabled="!item.canSelect"
                  @click.stop="item.canSelect ? openRolePicker(index) : undefined"
                >
                  <span class="brdm-field-label">发言角色：</span>
                  <span class="brdm-field-value">{{ item.panel.speakerRole || '暂无' }}</span>
                  <RightOutlined v-if="item.canSelect" class="brdm-field-arrow" />
                </button>
                <button
                  type="button"
                  :class="['brdm-card-field', { 'brdm-card-field--disabled': !item.canSelect }]"
                  :disabled="!item.canSelect"
                  @click.stop="item.canSelect ? openVoicePicker(index) : undefined"
                >
                  <span class="brdm-field-label">配音角色：</span>
                  <span class="brdm-field-value">
                    <img
                      v-if="item.panel.dubbingVoiceAvatarUrl"
                      :src="item.panel.dubbingVoiceAvatarUrl"
                      class="brdm-voice-avatar"
                      alt=""
                    />
                    <span v-else class="brdm-voice-placeholder" />
                    {{ item.panel.dubbingVoiceName || '无音色' }}
                  </span>
                  <RightOutlined v-if="item.canSelect" class="brdm-field-arrow" />
                </button>
              </template>
              <template v-else>
                <div class="brdm-card-field brdm-card-field--static">
                  <span class="brdm-field-label">发言角色：暂无</span>
                </div>
                <p class="brdm-no-dialogue-tip">无台词，暂不支持生成配音</p>
              </template>
            </div>
          </article>
        </div>
      </div>

      <footer class="brdm-footer">
        <div class="brdm-footer-left">
          <div class="brdm-voice-field">
            <label class="brdm-voice-label">音色</label>
            <button type="button" class="brdm-voice-select" @click="openGlobalVoicePicker">
              <span class="brdm-voice-select-icon" aria-hidden="true">
                <SoundOutlined />
              </span>
              <span class="brdm-voice-select-text">{{ globalVoiceName || '请选择音色' }}</span>
              <DownOutlined class="brdm-voice-select-arrow" />
            </button>
          </div>
          <button type="button" class="brdm-lip-check" @click="globalLipSync = !globalLipSync">
            <img
              class="brdm-check-icon"
              :src="globalLipSync ? dialogSelectSelIcon : dialogSelectNorIcon"
              alt=""
            />
            <span>角色对口型</span>
          </button>
        </div>
        <a-button
          type="primary"
          class="brdm-submit-btn"
          :disabled="selectedIds.size === 0"
          @click="handleBatchGenerate"
        >
          <template #icon><img src="@/assets/img/icon/star_white.svg" alt="" /></template>
          批量生成
        </a-button>
      </footer>
    </div>

    <SpeakerRolePickerModal
      v-model:open="speakerRoleOpen"
      :characters="sceneCharacters"
      :initial-name="editingPanelRole"
      @confirm="onSpeakerRoleConfirm"
    />
    <VoiceTimbrePickerModal
      v-model:open="voicePickerOpen"
      :initial-voice-name="editingPanelVoiceName"
      @confirm="onVoiceConfirm"
    />
    <VoiceTimbrePickerModal
      v-model:open="globalVoicePickerOpen"
      :initial-voice-name="globalVoiceName"
      @confirm="onGlobalVoiceConfirm"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { RightOutlined, DownOutlined, SoundOutlined, CloseOutlined } from '@ant-design/icons-vue'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import workCoverPlaceholderUrl from '~/assets/img/home/pic_bg.svg'
import VideoPosterImg from '~/components/common/VideoPosterImg.vue'
import type { DubbingPanel, StoryboardVideoPanel, StoryboardPanel } from '~/types'
import SpeakerRolePickerModal from './SpeakerRolePickerModal.vue'
import VoiceTimbrePickerModal from './VoiceTimbrePickerModal.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    panels: DubbingPanel[]
    scriptPanels?: StoryboardPanel[]
    videoPanels?: StoryboardVideoPanel[]
    sceneCharacters?: string[]
    title?: string
    /** 打开时是否默认全选可选项 */
    preselectAll?: boolean
  }>(),
  {
    scriptPanels: () => [],
    videoPanels: () => [],
    sceneCharacters: () => [],
    title: '批量生成分镜配音',
    preselectAll: false
  }
)

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'update:panel-role', index: number, role: string): void
  (e: 'update:panel-voice', index: number, payload: { name: string; avatarUrl: string; id: string }): void
  (e: 'batch-generate', selectedPanelIds: string[], options: { globalVoiceName?: string; globalVoiceAvatarUrl?: string; lipSync?: boolean }): void
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const modalTitle = computed(() => props.title)

const selectedIds = ref<Set<string>>(new Set())
const globalVoiceName = ref('')
const globalVoiceAvatarUrl = ref('')
const globalLipSync = ref(false)
const speakerRoleOpen = ref(false)
const voicePickerOpen = ref(false)
const globalVoicePickerOpen = ref(false)
const editingPanelIndex = ref<number>(-1)
const editingPanelRole = ref('')
const editingPanelVoiceName = ref('')

function getThumbnailUrl(panelIndex: number): string {
  const panel = props.panels[panelIndex]
  if (panel?.dubbingLipSyncVideoUrl) return panel.dubbingLipSyncVideoUrl
  const vPanel = props.videoPanels?.[panelIndex]
  const v = vPanel?.videos?.find((x: any) => x.isStoryboardVideo) || vPanel?.videos?.[0]
  return v?.url || ''
}

function hasDialogue(panelIndex: number): boolean {
  const script = props.scriptPanels?.[panelIndex]?.scriptContent?.trim()
  if (script) return true
  const d = props.panels[panelIndex]?.dialogue?.trim()
  return !!d
}

function formatCardTitle(title: string) {
  const match = title.match(/^分镜配音\d*[：:]\s*(.+)$/)
  if (match) return `分镜配音:${match[1]}`
  return title.replace(/：/g, ':')
}

const cardList = computed(() =>
  props.panels.map((panel, i) => {
    const thumbnailUrl = getThumbnailUrl(i)
    return {
      panel,
      panelIndex: i,
      thumbnailUrl,
      hasDialogue: hasDialogue(i),
      canSelect: !!(thumbnailUrl && String(thumbnailUrl).trim())
    }
  })
)

const selectableCount = computed(() => cardList.value.filter((c) => c.canSelect).length)

const pendingCount = computed(() =>
  cardList.value.filter((c) => c.canSelect && c.panel.status !== 'done').length
)

const isAllSelectableChecked = computed(() => {
  const selectable = cardList.value.filter((c) => c.canSelect)
  if (selectable.length === 0) return false
  return selectable.every((c) => selectedIds.value.has(c.panel.id))
})

function toggleSelect(id: string) {
  const item = cardList.value.find((c) => c.panel.id === id)
  if (!item?.canSelect) return
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function onCardClick(item: { panel: DubbingPanel; canSelect: boolean }) {
  if (item.canSelect) toggleSelect(item.panel.id)
}

function toggleSelectAll() {
  const selectable = cardList.value.filter((c) => c.canSelect).map((c) => c.panel.id)
  if (selectable.every((id) => selectedIds.value.has(id))) {
    const next = new Set(selectedIds.value)
    selectable.forEach((id) => next.delete(id))
    selectedIds.value = next
  } else {
    const next = new Set(selectedIds.value)
    selectable.forEach((id) => next.add(id))
    selectedIds.value = next
  }
}

function openRolePicker(index: number) {
  const item = cardList.value[index]
  if (!item?.hasDialogue) return
  editingPanelIndex.value = item.panelIndex
  editingPanelRole.value = item.panel.speakerRole || ''
  speakerRoleOpen.value = true
}

function onSpeakerRoleConfirm(name: string) {
  const i = editingPanelIndex.value
  if (i >= 0) emit('update:panel-role', i, name)
  editingPanelIndex.value = -1
}

function openVoicePicker(index: number) {
  const item = cardList.value[index]
  if (!item?.hasDialogue) return
  editingPanelIndex.value = item.panelIndex
  editingPanelVoiceName.value = item.panel.dubbingVoiceName || ''
  voicePickerOpen.value = true
}

function onVoiceConfirm(payload: { name: string; avatarUrl: string; id: string }) {
  const i = editingPanelIndex.value
  if (i >= 0) emit('update:panel-voice', i, payload)
  editingPanelIndex.value = -1
}

function openGlobalVoicePicker() {
  globalVoicePickerOpen.value = true
}

function onGlobalVoiceConfirm(payload: { name: string; avatarUrl: string; id: string }) {
  globalVoiceName.value = payload.name
  globalVoiceAvatarUrl.value = payload.avatarUrl || ''
}

function handleBatchGenerate() {
  if (selectedIds.value.size === 0) return
  emit('batch-generate', [...selectedIds.value], {
    globalVoiceName: globalVoiceName.value || undefined,
    globalVoiceAvatarUrl: globalVoiceAvatarUrl.value || undefined,
    lipSync: globalLipSync.value
  })
  localOpen.value = false
}

function handleCancel() {
  localOpen.value = false
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (props.preselectAll) {
      selectedIds.value = new Set(
        cardList.value.filter((c) => c.canSelect).map((c) => c.panel.id)
      )
    } else {
      selectedIds.value = new Set()
    }
  }
)
</script>

<style scoped>
.batch-regenerate-dubbing-modal :deep(.ant-modal-content) {
  padding: 0 !important;
  border-radius: 4px;
  overflow: hidden;
  background: #191a1d;
  border: 1px solid rgba(74, 231, 253, 0.22);
}

.batch-regenerate-dubbing-modal :deep(.ant-modal-header) {
  display: none;
}

.batch-regenerate-dubbing-modal :deep(.ant-modal-body) {
  padding: 0 !important;
}

.brdm {
  color: #e6edf3;
  height: 698px;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.brdm-header {
  flex-shrink: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brdm-title {
  margin: 0;
  font-size: 18px;
  line-height: 24px;
  font-weight: 600;
  color: #fff;
}

.brdm-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(142, 151, 165, 1);
  cursor: pointer;
  font-size: 24px;
  flex-shrink: 0;
}

.brdm-close:hover {
  color: #4ae7fd;
}

.brdm-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 14px;
}

.brdm-check-icon {
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
}

.brdm-select-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  user-select: none;
  color: inherit;
}

.brdm-select-all-text {
  font-size: 14px;
  color: #fff;
}

.brdm-pending {
  font-size: 14px;
  color: #4ae7fd;
}

.brdm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.brdm-body::-webkit-scrollbar {
  display: none;
}

.brdm-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.brdm-card {
  position: relative;
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 6px;
  background: #121212;
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.brdm-card:hover:not(.brdm-card--disabled):not(.brdm-card--selected) {
  border-color: rgba(74, 231, 253, 0.5);
}

.brdm-card--selected {
  border-color: rgba(74, 231, 253, 0.6);
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.25);
}

.brdm-card--disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

.brdm-card-media {
  position: relative;
  height: 165px;
  background: #101522;
}

.brdm-card-media-cover {
  width: 100%;
  height: 165px;
}

.brdm-card-img,
.brdm-card-media :deep(.brdm-card-img),
.brdm-card-media :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.brdm-card-placeholder-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.brdm-card-select {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
  pointer-events: none;
  z-index: 2;
}

.brdm-card-meta {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brdm-card-name {
  font-size: 14px;
  color: #fff;
  line-height: 20px;
  margin-bottom: 2px;
}

.brdm-card-field {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: rgba(142, 151, 165, 0.12);
  cursor: pointer;
  text-align: left;
  font-size: 12px;
}

.brdm-card-field:hover:not(:disabled) {
  background: rgba(142, 151, 165, 0.2);
}

.brdm-card-field--disabled,
.brdm-card-field:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  pointer-events: none;
}

.brdm-card-field--static {
  cursor: default;
  pointer-events: none;
}

.brdm-field-label {
  color: #8e97a5;
  flex-shrink: 0;
}

.brdm-field-value {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
}

.brdm-voice-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.brdm-voice-placeholder {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(120, 235, 255, 0.35);
  flex-shrink: 0;
}

.brdm-field-arrow {
  font-size: 12px;
  color: #8e97a5;
  flex-shrink: 0;
}

.brdm-no-dialogue-tip {
  margin: 0;
  font-size: 12px;
  color: #8e97a5;
  line-height: 18px;
}

.brdm-footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0 0;
}

.brdm-footer-left {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
}

.brdm-voice-field {
  min-width: 0;
}

.brdm-voice-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #8e97a5;
}

.brdm-voice-select {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 178px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: #121212;
  cursor: pointer;
  color: #fff;
  font-size: 14px;
}

.brdm-voice-select:hover {
  border-color: rgba(74, 231, 253, 0.35);
}

.brdm-voice-select-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #1e64ff;
  flex-shrink: 0;
}

.brdm-voice-select-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.brdm-voice-select-arrow {
  font-size: 12px;
  color: #8e97a5;
  flex-shrink: 0;
}

.brdm-lip-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 10px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: #fff;
  cursor: pointer;
  user-select: none;
}

.brdm-submit-btn {
  width: 126px;
  height: 40px;
  border-radius: 6px !important;
  border: none !important;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.brdm-submit-btn :deep(img) {
  width: 16px;
  height: 16px;
}
</style>
