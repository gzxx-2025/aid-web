<template>
  <a-modal
    v-model:open="localOpen"
    :width="1100"
    :footer="null"
    :title="null"
    :closable="false"
    class="batch-generate-asset-modal"
    wrap-class-name="create-flow-modal batch-generate-asset-wrap"
    :force-render="true"
    @cancel="handleCancel"
    @after-open-change="handleModalAfterOpenChange"
  >
    <div class="bgam">
      <header class="bgam-header">
        <div class="bgam-title-wrap">
          <h2 class="bgam-title">{{ modalTitle }}</h2>
          <p class="bgam-subtitle">{{ modalSubtitle }}</p>
        </div>
        <button type="button" class="bgam-close" aria-label="关闭" @click="handleCancel">
          <CloseOutlined />
        </button>
      </header>

      <div class="bgam-toolbar">
        <button type="button" class="bgam-select-all" :disabled="listLoading" @click="toggleSelectAll">
          <img
            class="bgam-check-icon"
            :src="isAllSelectableChecked ? dialogSelectSelIcon : dialogSelectNorIcon"
            alt=""
          />
          <span class="bgam-select-all-text">全选 ({{ selectedIds.length }}/{{ selectableCount }})</span>
        </button>
        <span v-if="listLoading" class="bgam-pending bgam-pending--muted">正在同步列表…</span>
        <span v-else class="bgam-pending bgam-pending--muted">已有图片 ({{ withImageCount }}/{{ displayItems.length }})</span>
      </div>

      <div class="bgam-body">
        <div v-if="listLoading" class="bgam-list-loading">正在从服务器同步资产列表…</div>
        <div v-else class="bgam-grid">
          <template v-for="item in displayItems" :key="item.id">
            <a-tooltip
              v-if="!item.selectable && item.disabledTooltip"
              :title="item.disabledTooltip"
            >
              <article
                :class="[
                  'bgam-card',
                  {
                    'bgam-card--selected': isSelected(item.id),
                    'bgam-card--disabled': !item.selectable
                  }
                ]"
                @click="toggleSelect(item.id, item.selectable)"
              >
                <div class="bgam-card-media">
                  <ShimmerImage
                    v-if="item.cover"
                    :src="item.cover"
                    :alt="item.name"
                    img-class="bgam-card-img"
                    object-fit="cover"
                    reveal-direction="fade"
                  />
                  <div v-else class="bgam-card-empty">
                    <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--sm bgam-card-empty__icon" />
                  </div>
                  <img
                    v-if="item.selectable"
                    class="bgam-card-select"
                    :src="isSelected(item.id) ? dialogSelectSelIcon : dialogSelectNorIcon"
                    alt=""
                  />
                </div>
                <div class="bgam-card-meta">
                  <div class="bgam-card-name">{{ item.name || defaultName }}</div>
                </div>
              </article>
            </a-tooltip>
            <article
              v-else
              :class="[
                'bgam-card',
                {
                  'bgam-card--selected': isSelected(item.id),
                  'bgam-card--disabled': !item.selectable
                }
              ]"
              @click="toggleSelect(item.id, item.selectable)"
            >
              <div class="bgam-card-media">
                <ShimmerImage
                  v-if="item.cover"
                  :src="item.cover"
                  :alt="item.name"
                  img-class="bgam-card-img"
                  object-fit="cover"
                  reveal-direction="fade"
                />
                <div v-else class="bgam-card-empty">
                  <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--sm bgam-card-empty__icon" />
                </div>
                <img
                  v-if="item.selectable"
                  class="bgam-card-select"
                  :src="isSelected(item.id) ? dialogSelectSelIcon : dialogSelectNorIcon"
                  alt=""
                />
              </div>
              <div class="bgam-card-meta">
                <div class="bgam-card-name">{{ item.name || defaultName }}</div>
              </div>
            </article>
          </template>
        </div>
      </div>

      <footer class="bgam-footer">
        <div class="bgam-config">
        </div>
        <div class="bgam-actions">
          <a-button class="bgam-btn-cancel" @click="handleCancel">
            <div class="text-gradient">取消</div>
          </a-button>
          <a-button
            class="bgam-btn-ok"
            type="primary"
            :loading="confirmLoading"
            :disabled="selectedIds.length === 0 || listLoading || confirmLoading"
            @click="handleConfirm"
          >
            批量生成
          </a-button>
        </div>
      </footer>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import { emptyImageIconUrl } from '~/utils/emptyImageIcon'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import { useCreationStore } from '~/stores/creation'
import {
  CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY,
  FORM_IMAGE_AGENT_BIZ_CATEGORY
} from '~/utils/extractAgentBiz'
import { getProjectGenConfigBySceneCode } from '~/utils/projectGenConfig'

const creationStore = useCreationStore()

type BatchAssetType = 'scene' | 'character' | 'prop'
type BatchAssetMode = 'image' | 'setting-card'

interface BatchAssetItem {
  id?: string | number
  name?: string
  /** 已有场景/角色/道具设定（富文本非空），无预览图时仍可勾选批量生成 */
  hasSetting?: boolean
  /** 设定卡模式：是否已有可生成的白底角色主图 */
  settingCardReady?: boolean
  images?: Array<{
    url?: string
    thumbnail?: string
    importDate?: string
    updatedAt?: string
    createdAt?: string
  }>
}

const props = withDefaults(
  defineProps<{
    open: boolean
    type: BatchAssetType
    /** image：批量生图；setting-card：批量生成设定卡（仅角色） */
    mode?: BatchAssetMode
    items?: BatchAssetItem[]
    /** 智能提取弹窗已选 modelCode，打开时优先回显 */
    defaultModelCode?: string
    /** 打开弹窗时刷新资产列表（拉取 /api/user/asset/rps/list） */
    onRefreshItems?: () => Promise<void>
  }>(),
  {
    mode: 'image',
    items: () => [],
    defaultModelCode: '',
    onRefreshItems: undefined
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [
    payload: {
      type: BatchAssetType
      mode: BatchAssetMode
      agent: string
      model: string
      resolution: string
      selectedItemIds: Array<string | number>
    }
  ]
}>()

const isSettingCardMode = computed(() => props.mode === 'setting-card')

function resolveBizCategoryCode(): string {
  if (isSettingCardMode.value) return CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY
  return FORM_IMAGE_AGENT_BIZ_CATEGORY[props.type]
}

const localOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const selectedIds = ref<Array<string | number>>([])
const listLoading = ref(false)
const confirmLoading = ref(false)
/** 打开弹窗期间的刷新代数，避免快速开关时旧请求回写 */
let modalOpenInitGen = 0
/** 本次打开是否已完成接口刷新；刷新前不展示本地缓存封面 */
const listSynced = ref(false)

async function loadModalListData() {
  if (!props.onRefreshItems) {
    listSynced.value = true
    return
  }
  listLoading.value = true
  listSynced.value = false
  try {
    await props.onRefreshItems()
    listSynced.value = true
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '刷新资产列表失败')
    // 刷新失败时退回当前父组件数据，避免空白不可用
    listSynced.value = true
  } finally {
    listLoading.value = false
  }
}

/** 打开只刷资产列表；智能体/模型走「生成配置」，不再拉 agent/list、listByFunc */
async function handleModalContentInit() {
  if (!props.open) return
  const gen = ++modalOpenInitGen
  selectedIds.value = []
  await loadModalListData()
  if (gen !== modalOpenInitGen) return
}

function resetModalTransientState() {
  modalOpenInitGen++
  listSynced.value = false
  listLoading.value = false
  confirmLoading.value = false
  selectedIds.value = []
}

function handleModalAfterOpenChange(open: boolean) {
  if (!open) resetModalTransientState()
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      resetModalTransientState()
      return
    }
    void handleModalContentInit()
  }
)

watch(
  () => [props.type, props.mode] as const,
  () => {
    if (!props.open) return
    void handleModalContentInit()
  }
)

/** 确认时读一次 gen-config（有缓存），不再拉智能体/模型列表 */
async function resolveSubmitDefaultsFromGenConfig(): Promise<{
  agent: string
  model: string
  resolution: string
} | null> {
  const projectId = Number(creationStore.currentProjectId)
  const sceneCode = resolveBizCategoryCode()
  let agent = ''
  /** 生成配置优先；defaultModelCode 仅作无配置时的兜底（避免旧 extractImageModelCodes 盖住新配置） */
  let model = ''
  /** 透传生成配置清晰度；勿写死 4k，也不要只认 1k/2k/4k（Image2 等为 1024x1024） */
  let resolution = ''
  if (Number.isFinite(projectId) && projectId > 0) {
    try {
      const cfg = await getProjectGenConfigBySceneCode(projectId, sceneCode)
      agent = String(cfg?.agentCode || '').trim()
      model = String(cfg?.modelCode || '').trim() || String(props.defaultModelCode || '').trim()
      resolution = String(cfg?.resolution || '').trim()
    } catch {
      /* ignore：交给下方空 agent 提示 */
    }
  }
  if (!model) model = String(props.defaultModelCode || '').trim()
  if (!agent) {
    message.warning(
      isSettingCardMode.value
        ? '请先在「生成配置」中为「角色设定卡」配置智能体'
        : '请先在「生成配置」中配置形态图智能体'
    )
    return null
  }
  return { agent, model, resolution }
}

const modalTitle = computed(() => {
  if (isSettingCardMode.value) return '批量生成设定卡'
  if (props.type === 'scene') return '批量生成场景图'
  if (props.type === 'character') return '批量生成角色图'
  return '批量生成道具图'
})

const modalSubtitle = computed(() => {
  if (isSettingCardMode.value) {
    return '生成结果将更新到角色设定卡，历史记录可在生图历史中查看'
  }
  if (props.type === 'scene') return '生成结果将更新到场景图，历史记录可在生图历史中查看'
  if (props.type === 'character') return '生成结果将更新到角色图，历史记录可在生图历史中查看'
  return '生成结果将更新到道具图，历史记录可在生图历史中查看'
})

const emptyCardLabel = computed(() => {
  if (props.type === 'scene') return '缺少场景设定'
  if (props.type === 'character') return '缺少角色设定'
  return '缺少道具设定'
})

const noPreviewLabel = computed(() => {
  if (props.type === 'scene') return '暂无场景图'
  if (props.type === 'character') return '暂无角色图'
  return '暂无道具图'
})

const defaultName = computed(() => {
  if (props.type === 'scene') return '未命名场景'
  if (props.type === 'character') return '未命名角色'
  return '未命名道具'
})

const normalizedItems = computed(() =>
  (props.items || []).map((it, idx) => {
    const first = (it.images || [])[0] || {}
    const cover = first.url || first.thumbnail || ''
    const dateRaw = first.importDate || first.updatedAt || first.createdAt || ''
    const hasSetting = Boolean(it.hasSetting)
    const settingCardReady = Boolean(it.settingCardReady)
    const selectable = isSettingCardMode.value
      ? settingCardReady
      : Boolean(cover) || hasSetting
    const disabledTooltip =
      isSettingCardMode.value && !selectable ? '请先生成角色图' : ''
    return {
      id: it.id ?? `${props.type}-${idx}`,
      name: it.name || '',
      cover,
      date: formatDate(dateRaw),
      selectable,
      disabledTooltip
    }
  })
)

/** 接口同步完成前不展示缓存列表，与分镜批量弹窗「打开先拉 list」对齐 */
const displayItems = computed(() => (listSynced.value ? normalizedItems.value : []))

const withImageCount = computed(() => displayItems.value.filter((i) => !!i.cover).length)

const selectableCount = computed(() => displayItems.value.filter((i) => i.selectable).length)

const isAllSelectableChecked = computed(() => {
  const selectable = displayItems.value.filter((i) => i.selectable)
  if (selectable.length === 0) return false
  return selectable.every((i) => selectedIds.value.includes(i.id))
})

function toggleSelectAll() {
  if (listLoading.value) return
  const selectableIds = displayItems.value.filter((i) => i.selectable).map((i) => i.id)
  if (selectableIds.every((id) => selectedIds.value.includes(id))) {
    selectedIds.value = selectedIds.value.filter((id) => !selectableIds.includes(id))
    return
  }
  const next = new Set([...selectedIds.value, ...selectableIds])
  selectedIds.value = [...next]
}

function formatDate(str: string) {
  if (!str) return '--'
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('zh-CN')
}

function handleCancel() {
  localOpen.value = false
}

async function handleConfirm() {
  if (listLoading.value || confirmLoading.value) return
  if (selectedIds.value.length === 0) return
  confirmLoading.value = true
  try {
    const defaults = await resolveSubmitDefaultsFromGenConfig()
    if (!defaults) return
    emit('confirm', {
      type: props.type,
      mode: props.mode ?? 'image',
      agent: defaults.agent,
      model: defaults.model,
      resolution: defaults.resolution,
      selectedItemIds: [...selectedIds.value]
    })
    localOpen.value = false
  } finally {
    confirmLoading.value = false
  }
}

function isSelected(id: string | number) {
  return selectedIds.value.includes(id)
}

function toggleSelect(id: string | number, selectable: boolean) {
  if (!selectable) return
  if (isSelected(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
    return
  }
  selectedIds.value = [...selectedIds.value, id]
}
</script>

<style scoped>
.batch-generate-asset-modal :deep(.ant-modal-content) {
  padding: 0 !important;
  border-radius: 4px;
  overflow: hidden;
  background: #181a23;
  border: 1px solid rgba(74, 231, 253, 0.22);
}

.batch-generate-asset-modal :deep(.ant-modal-header) {
  display: none;
}

.batch-generate-asset-modal :deep(.ant-modal-body) {
  padding: 0 !important;
}

.bgam {
  color: #e6edf3;
  height: min(698px, calc(100dvh - 80px));
  max-height: min(698px, calc(100dvh - 80px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.bgam-header {
  flex-shrink: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.bgam-close {
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

.bgam-close:hover {
  color: #4ae7fd;
}

.bgam-title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.bgam-title {
  margin: 0;
  font-size: 18px;
  line-height: 1;
  font-weight: 600;
  color: #fff;
}

.bgam-subtitle {
  margin: 0;
  font-size: 12px;
  color: #8e97a5;
}

.bgam-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px 14px 0;
}

.bgam-check-icon {
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
  flex-shrink: 0;
  pointer-events: none;
}

.bgam-select-all {
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

.bgam-select-all-text {
  font-size: 14px;
  color: #fff;
}

.bgam-pending {
  font-size: 14px;
  color: #4ae7fd;
}

.bgam-pending--muted {
  color: #dce6f2;
}

.bgam-body {
  flex: 1;
  min-height: 0;
  padding: 0 16px 12px 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.bgam-list-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  font-size: 14px;
  color: #8b95a8;
}

.bgam-body::-webkit-scrollbar {
  display: none;
}

.bgam-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.bgam-grid :deep(.ant-tooltip) {
  display: contents;
}

.bgam-card {
  position: relative;
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 6px;
  background: #121621;
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.bgam-card:hover:not(.bgam-card--disabled):not(.bgam-card--selected) {
  border-color: rgba(74, 231, 253, 0.5);
}

.bgam-card--disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

.bgam-card-media {
  position: relative;
  height: 168px;
  background: #101522;
  overflow: hidden;
}

.bgam-card-media .shimmer-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.bgam-card-img,
.bgam-card-media :deep(.bgam-card-img),
.bgam-card-media :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bgam-card-empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  padding: 8px;
  text-align: center;
}

.bgam-card-empty__icon {
  opacity: 0.75;
}

.bgam-card-select {
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

.bgam-card-meta {
  padding: 8px;
  background: #0f1118;
}

.bgam-card-name {
  font-size: 16px;
  color: #fff;
  line-height: 22px;
  margin-bottom: 4px;
}

.bgam-footer {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
}

.bgam-config {
  display: grid;
  grid-template-columns: repeat(3, minmax(180px, 1fr));
  gap: 10px;
  min-width: 0;
}

.bgam-field {
  min-width: 0;
}

.bgam-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #8e97a5;
}

.bgam-select {
  width: 100%;
}

.bgam-select :deep(.ant-select-selector) {
  height: 36px !important;
  border-radius: 4px !important;
  background: #0d1018 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
}

.bgam-select :deep(.ant-select-selection-item),
.bgam-select.ant-select-open :deep(.ant-select-selection-item) {
  line-height: 34px !important;
  color: #e6edf3 !important;
}

.bgam-select :deep(.ant-select-selection-placeholder) {
  line-height: 34px !important;
  color: #8e97a5 !important;
}

.bgam-select :deep(.ant-select-arrow) {
  color: rgba(255, 255, 255, 0.45) !important;
}

.bgam-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bgam-btn-cancel {
  width: 96px;
  height: 40px;
  border-radius: 6px !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  background: #0d1018 !important;
  color: #fff !important;
}

.bgam-btn-ok {
  width: 120px;
  height: 40px;
  border-radius: 6px !important;
  border: none !important;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
}
</style>

<style>
.bgam-select-popup.ant-select-dropdown {
  background: #111621 !important;
  border: 1px solid rgba(74, 231, 253, 0.28) !important;
}

.bgam-select-popup .ant-select-item {
  color: #e6edf3 !important;
}

.bgam-select-popup .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  background: rgba(74, 231, 253, 0.2) !important;
  color: #4ae7fd !important;
}

.bgam-select-popup .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: rgba(74, 231, 253, 0.12) !important;
}
</style>
