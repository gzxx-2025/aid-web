<template>
  <a-modal
    v-model:open="localOpen"
    :width="1100"
    :footer="null"
    :title="null"
    :closable="true"
    class="batch-generate-asset-modal"
    wrap-class-name="create-flow-modal"
    @cancel="handleCancel"
  >
    <div class="bgam">
      <header class="bgam-header">
        <div class="bgam-title-wrap">
          <h2 class="bgam-title">{{ modalTitle }}</h2>
          <p class="bgam-subtitle">{{ modalSubtitle }}</p>
        </div>
      </header>

      <div class="bgam-body">
        <div class="bgam-count">已有图片 ({{ withImageCount }}/{{ normalizedItems.length }})</div>

        <div class="bgam-grid">
          <article
            v-for="item in normalizedItems"
            :key="item.id"
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
              <img v-if="item.cover" :src="item.cover" :alt="item.name" class="bgam-card-img" />
              <div v-else class="bgam-card-empty">{{ item.emptyHint }}</div>
              <img
                v-if="item.selectable"
                class="bgam-card-select"
                :src="isSelected(item.id) ? dialogSelectSelIcon : dialogSelectNorIcon"
                alt=""
              />
            </div>
            <div class="bgam-card-meta">
              <div class="bgam-card-name">{{ item.name || defaultName }}</div>
              <div class="bgam-card-date">{{ item.date }}</div>
            </div>
          </article>
        </div>
      </div>

      <footer class="bgam-footer">
        <div class="bgam-config">
          <div class="bgam-field">
            <label class="bgam-label">智能体</label>
            <a-select
              v-model:value="agent"
              class="bgam-select"
              popup-class-name="bgam-select-popup"
              size="large"
              :options="agentOptions"
              :loading="agentsLoading"
            />
          </div>
          <div class="bgam-field">
            <label class="bgam-label">生图模型</label>
            <a-select
              v-model:value="model"
              class="bgam-select"
              popup-class-name="bgam-select-popup"
              size="large"
              :options="modelOptions"
            />
          </div>
          <div class="bgam-field">
            <label class="bgam-label">分辨率</label>
            <a-select
              v-model:value="resolution"
              class="bgam-select"
              popup-class-name="bgam-select-popup"
              size="large"
              :options="resolutionOptions"
            />
          </div>
        </div>
        <div class="bgam-actions">
          <a-button class="bgam-btn-cancel" @click="handleCancel">
            <div class="text-gradient">取消</div>
          </a-button>
          <a-button
            class="bgam-btn-ok"
            type="primary"
            :disabled="selectedIds.length === 0"
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
import { message } from 'ant-design-vue'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import { aidAgentList, userModelList, userModelListByFuncCodes } from '~/utils/businessApi'
import { pickFirstNonEmptyModelPool } from '~/utils/modelListByFuncBatch'
import { useCreationStore } from '~/stores/creation'
import {
  FORM_IMAGE_AGENT_BIZ_CATEGORY,
  EXTRACT_MODEL_FUNC_CODE,
  agentOptionsFromGroup,
  fetchAgentDefaultModelCode,
  resolvePreferredModelId
} from '~/utils/extractAgentBiz'
import { getProjectGenConfigBySceneCode } from '~/utils/projectGenConfig'
import type { UserModelListItem } from '~/types/business-api'

const creationStore = useCreationStore()

type BatchAssetType = 'scene' | 'character' | 'prop'

interface BatchAssetItem {
  id?: string | number
  name?: string
  /** 已有场景/角色/道具设定（富文本非空），无预览图时仍可勾选批量生成 */
  hasSetting?: boolean
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
    items?: BatchAssetItem[]
    /** 智能提取弹窗已选 modelCode，打开时优先回显 */
    defaultModelCode?: string
  }>(),
  {
    items: () => [],
    defaultModelCode: ''
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [
    payload: {
      type: BatchAssetType
      agent: string
      model: string
      resolution: string
      selectedItemIds: Array<string | number>
    }
  ]
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const agent = ref('')
const model = ref('')
const resolution = ref('4k')
const selectedIds = ref<Array<string | number>>([])

const agentOptions = ref<Array<{ label: string; value: string }>>([])

const fallbackModelOptions = [
  { label: '梦图Pro(高一致性)', value: 'nawei-pro' },
  { label: '梦图Std(快速版)', value: 'nawei-std' }
]
const modelOptions = ref<Array<{ label: string; value: string }>>([...fallbackModelOptions])

async function loadImageModelOptionsForType() {
  const codes = [
    FORM_IMAGE_AGENT_BIZ_CATEGORY[props.type],
    EXTRACT_MODEL_FUNC_CODE[props.type]
  ]
  let list: UserModelListItem[] = []
  try {
    const groups = await userModelListByFuncCodes(codes)
    list = pickFirstNonEmptyModelPool(groups, codes)
  } catch {
    list = []
  }
  if (!list.length) {
    try {
      list = await userModelList({ modelType: 'image' })
    } catch {
      list = []
    }
  }
  const mapped = list.map((item) => ({
    label: item.modelName || item.modelCode || '未命名模型',
    value: String(item.modelCode || item.id)
  }))
  modelOptions.value = mapped.length > 0 ? mapped : [...fallbackModelOptions]
}

const resolutionOptions = [
  { label: '2K', value: '2k' },
  { label: '4K', value: '4k' }
]

const agentsLoading = ref(false)

async function loadImageAgentsForType(type: BatchAssetType) {
  agentsLoading.value = true
  try {
    const bizCategoryCode = FORM_IMAGE_AGENT_BIZ_CATEGORY[type]
    const groups = await aidAgentList({ bizCategoryCodes: [bizCategoryCode] })
    const opts = agentOptionsFromGroup(groups, bizCategoryCode)
    agentOptions.value = opts.map((o) => ({ label: o.name, value: o.id }))

    const projectId = Number(creationStore.currentProjectId)
    let defaultAgent = opts[0]?.id ?? ''
    if (Number.isFinite(projectId) && projectId > 0) {
      try {
        const cfg = await getProjectGenConfigBySceneCode(projectId, bizCategoryCode)
        const fromCfg = String(cfg?.agentCode || '').trim()
        if (fromCfg && opts.some((o) => o.id === fromCfg)) {
          defaultAgent = fromCfg
        }
      } catch {
        /* 使用列表首项 */
      }
    }
    agent.value = defaultAgent
    if (!agent.value) {
      message.warning('暂无可用形态图智能体')
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载智能体列表失败')
    agentOptions.value = []
    agent.value = ''
  } finally {
    agentsLoading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    resolution.value = '4k'
    selectedIds.value = []
    void (async () => {
      await Promise.all([loadImageAgentsForType(props.type), initImageModelOptions()])
    })()
  }
)

watch(
  () => props.type,
  (type) => {
    if (!props.open) return
    void (async () => {
      await Promise.all([loadImageAgentsForType(type), initImageModelOptions()])
    })()
  }
)

async function initImageModelOptions() {
  await loadImageModelOptionsForType()

  const projectId = Number(creationStore.currentProjectId)
  let cfgModel = ''
  let cfgResolution = ''
  if (Number.isFinite(projectId) && projectId > 0) {
    try {
      const cfg = await getProjectGenConfigBySceneCode(
        projectId,
        FORM_IMAGE_AGENT_BIZ_CATEGORY[props.type]
      )
      cfgModel = String(cfg?.modelCode || '').trim()
      cfgResolution = String(cfg?.resolution || '').trim()
    } catch {
      /* ignore */
    }
  }

  const agentDefaultModelCode = await fetchAgentDefaultModelCode({
    bizCategoryCode: FORM_IMAGE_AGENT_BIZ_CATEGORY[props.type],
    agentCode: agent.value
  })
  const optionIds = modelOptions.value.map((x) => ({ id: x.value }))
  model.value = resolvePreferredModelId(optionIds, {
    savedId: props.defaultModelCode || cfgModel,
    agentDefaultCode: agentDefaultModelCode
  })

  if (cfgResolution) {
    const normalized = cfgResolution.toLowerCase()
    if (resolutionOptions.some((o) => o.value === normalized || o.label.toLowerCase() === normalized)) {
      resolution.value = normalized
    } else if (cfgResolution === '1K' || cfgResolution === '2K' || cfgResolution === '4K') {
      resolution.value = cfgResolution.toLowerCase()
    }
  }
}

const modalTitle = computed(() => {
  if (props.type === 'scene') return '批量生成场景图'
  if (props.type === 'character') return '批量生成角色图'
  return '批量生成道具图'
})

const modalSubtitle = computed(() => {
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
    const emptyHint = cover
      ? ''
      : hasSetting
        ? noPreviewLabel.value
        : emptyCardLabel.value
    return {
      id: it.id ?? `${props.type}-${idx}`,
      name: it.name || '',
      cover,
      date: formatDate(dateRaw),
      emptyHint,
      /** 已有图可再生成；无图但有设定也可勾选（批量生图依赖设定） */
      selectable: Boolean(cover) || hasSetting
    }
  })
)

const withImageCount = computed(() => normalizedItems.value.filter((i) => !!i.cover).length)

function formatDate(str: string) {
  if (!str) return '--'
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('zh-CN')
}

function handleCancel() {
  localOpen.value = false
}

function handleConfirm() {
  if (selectedIds.value.length === 0) return
  if (!String(agent.value || '').trim()) {
    message.warning('请选择形态图智能体')
    return
  }
  emit('confirm', {
    type: props.type,
    agent: agent.value,
    model: model.value,
    resolution: resolution.value,
    selectedItemIds: [...selectedIds.value]
  })
  localOpen.value = false
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
  margin: 0;
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: none !important;
  background: #181a23;
}

.batch-generate-asset-modal :deep(.ant-modal-close) {
  top: 1rem;
  inset-inline-end: 1rem;
  color: rgba(255, 255, 255, 0.75);
}

.batch-generate-asset-modal :deep(.ant-modal-close:hover) {
  color: #4ae7fd;
}

.batch-generate-asset-modal :deep(.ant-modal-body) {
  padding: 0 !important;
}

.bgam {
  color: #e6edf3;
  min-height: 658px;
  display: flex;
  flex-direction: column;
}

.bgam-header {
  height: 56px;
  display: flex;
  align-items: center;
}

.bgam-title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.bgam-title {
  margin: 0;
  font-size: 24px;
  line-height: 1;
  font-weight: 600;
  color: #fff;
}

.bgam-subtitle {
  margin: 0;
  font-size: 12px;
  color: #8e97a5;
}

.bgam-body {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.bgam-count {
  font-size: 14px;
  color: #dce6f2;
  margin-bottom: 8px;
}

.bgam-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
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
  height: 168px;
  background: #101522;
}

.bgam-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bgam-card-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8e97a5;
  font-size: 14px;
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

.bgam-card-date {
  font-size: 14px;
  color: #8e97a5;
  line-height: 20px;
}

.bgam-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
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
