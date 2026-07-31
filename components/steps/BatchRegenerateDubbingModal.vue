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
        <div v-if="listLoading" class="brdm-loading">加载分镜数据中…</div>
        <div v-else class="brdm-grid">
          <article
            v-for="item in cardList"
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
                <ShimmerVideo
                  v-if="item.thumbnailUrl"
                  :src="item.thumbnailUrl"
                  video-class="brdm-card-img"
                  object-fit="cover"
                  reveal-direction="fade"
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
                    class="empty-image-icon empty-image-icon--xl brdm-card-placeholder-img"
                    alt=""
                  />
                </div>
              </a-tooltip>
            </div>

            <div class="brdm-card-meta">
              <div class="brdm-card-name">{{ formatCardTitle(item.panel.title) }}</div>

              <div
                v-if="item.needsNoDubbing"
                class="brdm-card-field brdm-card-field--static brdm-card-field--no-dubbing"
              >
                无需配音
              </div>
              <template v-else-if="item.hasDialogue">
                <div class="brdm-card-field brdm-card-field--static">
                  <span class="brdm-field-label">发言角色：</span>
                  <span class="brdm-field-value">{{ item.speakerRole }}</span>
                </div>
                <div class="brdm-card-field brdm-card-field--static">
                  <span class="brdm-field-label">配音音色：</span>
                  <span class="brdm-field-value">
                    <span class="brdm-voice-placeholder" />
                    {{ item.voiceName }}
                  </span>
                </div>
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
        <a-button
          type="primary"
          class="brdm-submit-btn"
          :disabled="selectedIds.size === 0 || listLoading"
          @click="handleBatchGenerate"
        >
          <template #icon><img src="@/assets/img/icon/star_white.svg" alt="" /></template>
          批量生成
        </a-button>
      </footer>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import { emptyImageIconUrl as workCoverPlaceholderUrl } from '~/utils/emptyImageIcon'
import ShimmerVideo from '~/components/common/ShimmerVideo.vue'
import type { DubbingPanel, StoryboardVideoPanel, StoryboardPanel } from '~/types'
import type { UserStoryboardListRow } from '~/types/business-api'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { userStoryboardList } from '~/utils/businessApi'
import {
  resolveBatchDubbingCardSpeakerMeta,
  storyboardRowHasDubbingDialogue,
  storyboardRowNeedsNoDubbing
} from '~/utils/storyboardDubbingSpeaker'
import { mapStoryboardListRowToPanel } from '~/utils/storyboardPanelMap'
import { applyStoryboardScriptPanelsFromApi } from '~/composables/useCreateFlowStoryboardSync'

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
  (
    e: 'batch-generate',
    selectedPanelIds: string[],
    options: {
      overwrite?: boolean
    }
  ): void
}>()

const route = useRoute()
const creationStore = useCreationStore()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const modalTitle = computed(() => props.title)

const selectedIds = ref<Set<string>>(new Set())
const listLoading = ref(false)
let modalOpenInitGen = 0
/** 卡片权威数据源：POST /api/user/storyboard/list */
const storyboardRowsById = ref<Map<number, UserStoryboardListRow>>(new Map())
/** 打开弹窗后以 /storyboard/list 刷新结果为卡片数据源（与批量分镜弹窗一致） */
const refreshedDubbingPanels = ref<DubbingPanel[] | null>(null)
const refreshedScriptPanels = ref<StoryboardPanel[] | null>(null)
const refreshedVideoPanels = ref<StoryboardVideoPanel[] | null>(null)

const effectivePanels = computed(() => refreshedDubbingPanels.value ?? props.panels)
const effectiveScriptPanels = computed(() => refreshedScriptPanels.value ?? props.scriptPanels)
const effectiveVideoPanels = computed(() => refreshedVideoPanels.value ?? props.videoPanels)

function resetModalSessionState() {
  selectedIds.value = new Set()
  storyboardRowsById.value = new Map()
  refreshedDubbingPanels.value = null
  refreshedScriptPanels.value = null
  refreshedVideoPanels.value = null
}

function resolveStoryboardIdForPanel(panel: DubbingPanel, panelIndex: number): number | null {
  const fromScript = parseServerStoryboardId(effectiveScriptPanels.value?.[panelIndex]?.id)
  if (fromScript != null) return fromScript
  return parseServerStoryboardId(panel.id)
}

function hasApiListLoaded(): boolean {
  return storyboardRowsById.value.size > 0
}

/** 卡片封面：优先分镜原视频，其次配音主视频（finalComposeVideoUrl），最后本地缓存 */
function pickStoryboardVideoUrl(
  storyboardId: number | null,
  panelIndex: number
): string {
  if (storyboardId != null && hasApiListLoaded()) {
    const row = storyboardRowsById.value.get(storyboardId)
    if (!row) return ''
    const fromSourceVideo = String(row.finalVideoUrl ?? '').trim()
    if (fromSourceVideo) return fromSourceVideo
    return String(row.finalComposeVideoUrl ?? '').trim()
  }

  const panel = effectivePanels.value[panelIndex]
  if (panel?.dubbingLipSyncVideoUrl) return panel.dubbingLipSyncVideoUrl
  const fromPanel = effectiveVideoPanels.value?.[panelIndex]
  const url = String(fromPanel?.finalVideoUrl ?? '').trim()
  if (url) return url
  const main = fromPanel?.videos?.find((v) => v.isStoryboardVideo && String(v.url ?? '').trim())
  return String(main?.url ?? '').trim()
}

/** 是否已有分镜原视频（批量配音前置条件） */
function hasStoryboardSourceVideo(storyboardId: number | null, panelIndex: number): boolean {
  if (storyboardId != null && hasApiListLoaded()) {
    const row = storyboardRowsById.value.get(storyboardId)
    if (!row) return false
    if (String(row.finalVideoUrl ?? '').trim()) return true
    return row.finalVideoId != null && Number(row.finalVideoId) > 0
  }
  const fromPanel = effectiveVideoPanels.value?.[panelIndex]
  if (String(fromPanel?.finalVideoUrl ?? '').trim()) return true
  return !!fromPanel?.videos?.some((v) => v.isStoryboardVideo && String(v.url ?? '').trim())
}

function isStoryboardDubbingDone(storyboardId: number | null, panel: DubbingPanel): boolean {
  if (storyboardId != null && hasApiListLoaded()) {
    const row = storyboardRowsById.value.get(storyboardId)
    if (!row) return false
    return !!String(row.finalComposeVideoUrl ?? '').trim()
  }
  if (panel.status === 'done') return true
  if (String(panel.dubbingLipSyncVideoUrl ?? '').trim()) return true
  return false
}

function formatCardTitle(title: string) {
  const match = title.match(/^分镜配音\d*[：:]\s*(.+)$/)
  if (match) return `分镜配音:${match[1]}`
  return title.replace(/：/g, ':')
}

const cardList = computed(() =>
  effectivePanels.value.map((panel, i) => {
    const storyboardId = resolveStoryboardIdForPanel(panel, i)
    const row = storyboardId != null ? storyboardRowsById.value.get(storyboardId) : undefined
    const scriptPanel = effectiveScriptPanels.value?.[i]
    const speakerMeta = resolveBatchDubbingCardSpeakerMeta({
      speakerRoles: row?.speakerRoles ?? scriptPanel?.speakerRoles,
      speakerVoices: row?.speakerVoices ?? scriptPanel?.speakerVoices,
      fallbackSpeakerRole: panel.speakerRole,
      fallbackVoiceName: panel.dubbingVoiceName
    })
    const thumbnailUrl = pickStoryboardVideoUrl(storyboardId, i)
    const hasDialogue =
      storyboardRowHasDubbingDialogue(row) ||
      !!String(scriptPanel?.dialogueText ?? '').trim() ||
      !!scriptPanel?.scriptContent?.trim() ||
      !!panel.dialogue?.trim()
    const needsNoDubbing = storyboardRowNeedsNoDubbing(row)
    return {
      panel,
      panelIndex: i,
      thumbnailUrl,
      hasDialogue,
      needsNoDubbing,
      speakerRole: speakerMeta.speakerRole,
      voiceName: speakerMeta.voiceName,
      isDubbingDone: isStoryboardDubbingDone(storyboardId, panel),
      canSelect: hasStoryboardSourceVideo(storyboardId, i) && hasDialogue && !needsNoDubbing
    }
  })
)

const selectableCount = computed(() => cardList.value.filter((c) => c.canSelect).length)

const pendingCount = computed(() =>
  cardList.value.filter((c) => c.canSelect && !c.isDubbingDone).length
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

async function loadModalListData(expectedGen: number) {
  listLoading.value = true
  try {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (expectedGen !== modalOpenInitGen) return
    if (!ctx) {
      message.warning('缺少项目信息，请从「我的作品」打开作品后再操作')
      return
    }

    // 卡片列表统一走 /api/user/storyboard/list：
    // 发言角色/配音音色（speakerRoles + speakerVoices）、原视频、配音主视频均由此接口提供
    const storyboardRows = await userStoryboardList({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId
    })
    if (expectedGen !== modalOpenInitGen) return

    const sorted = [...storyboardRows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const scriptPanels = sorted.map((row, index) => mapStoryboardListRowToPanel(row, index))
    applyStoryboardScriptPanelsFromApi(scriptPanels)

    const rowMap = new Map<number, UserStoryboardListRow>()
    for (const row of storyboardRows) {
      const sid = Number(row.id)
      if (Number.isFinite(sid) && sid > 0) rowMap.set(sid, row)
    }
    storyboardRowsById.value = rowMap
    refreshedScriptPanels.value = creationStore.formData.storyboardScript
      .panels as StoryboardPanel[]
    refreshedDubbingPanels.value = creationStore.formData.dubbing.panels as DubbingPanel[]
    refreshedVideoPanels.value = creationStore.formData.storyboardVideo
      .panels as StoryboardVideoPanel[]
  } catch (e: unknown) {
    if (expectedGen !== modalOpenInitGen) return
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '获取分镜配音数据失败')
  } finally {
    if (expectedGen === modalOpenInitGen) listLoading.value = false
  }
}

function handleBatchGenerate() {
  if (selectedIds.value.size === 0 || listLoading.value) return
  emit('batch-generate', [...selectedIds.value], {})
  localOpen.value = false
}

function handleCancel() {
  localOpen.value = false
}

async function handleModalContentInit() {
  if (!props.open) return
  const gen = ++modalOpenInitGen
  resetModalSessionState()
  await loadModalListData(gen)
  if (gen !== modalOpenInitGen) return
  if (props.preselectAll) {
    selectedIds.value = new Set(
      cardList.value.filter((c) => c.canSelect).map((c) => c.panel.id)
    )
  }
}

/**
 * 父级用 v-if 挂载时 open 已为 true：无 immediate 时 watch 不会触发，
 * 导致 /api/user/storyboard/list 从未请求。
 */
watch(
  () => props.open,
  (open) => {
    if (!open) {
      modalOpenInitGen++
      resetModalSessionState()
      return
    }
    void handleModalContentInit()
  },
  { immediate: true }
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

.brdm-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  font-size: 14px;
  color: #8e97a5;
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
  overflow: hidden;
}

.brdm-card-media .shimmer-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.brdm-card-media-cover {
  width: 100%;
  height: 165px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  opacity: 0.75;
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
  text-align: left;
  font-size: 12px;
}

.brdm-card-field--static {
  cursor: default;
  pointer-events: none;
}

.brdm-card-field--no-dubbing {
  color: #8e97a5;
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

.brdm-voice-placeholder {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(120, 235, 255, 0.35);
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
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 16px 0 0;
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
