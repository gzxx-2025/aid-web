<template>
  <a-modal
    v-model:open="localOpen"
    :width="1100"
    :footer="null"
    :closable="true"
    centered
    class="agent-picker-modal"
    wrap-class-name="create-flow-modal agent-picker-wrap"
    @cancel="handleCancel"
  >
    <template #title>
      <ModalTitleWatermark title="选择智能体" />
    </template>

    <div class="picker-shell">
      <div class="picker-search">
        <a-input
          v-model:value="query"
          placeholder="搜索智能体..."
          allow-clear
          size="large"
          class="picker-search-input"
        >
          <template #prefix>
            <SearchOutlined class="picker-search-ico" />
          </template>
        </a-input>
      </div>

      <div class="picker-scroll">
        <h3 class="picker-section-label">我的智能体</h3>
        <div v-if="filtered.length === 0" class="picker-empty">
          <p>未找到相关智能体</p>
        </div>
        <div v-else class="agent-grid">
          <button
            v-for="agent in filtered"
            :key="agent.id"
            type="button"
            class="agent-card"
            :class="{ 'agent-card--selected': selected?.id === agent.id }"
            @click="selectAgent(agent)"
          >
            <div class="agent-card__avatar-wrap">
              <img
                v-if="agent.thumbnail"
                :src="agent.thumbnail"
                :alt="agent.name"
                class="agent-card__avatar"
              />
              <div v-else class="agent-card__avatar agent-card__avatar--placeholder">
                {{ agent.name.slice(0, 1) }}
              </div>
            </div>
            <div class="agent-card__name">{{ agent.name }}</div>
            <div v-if="agent.desc" class="agent-card__desc">{{ agent.desc }}</div>
          </button>
        </div>

        <template v-if="showModelSection">
          <h3 class="picker-section-label picker-section-label--models">可用模型</h3>
          <div v-if="modelsLoading" class="picker-models-loading">模型加载中…</div>
          <div v-else-if="filteredModels.length === 0" class="picker-models-empty">
            暂无可用模型，将使用智能体默认模型
          </div>
          <div v-else class="agent-grid agent-grid--models">
            <button
              v-for="model in filteredModels"
              :key="model.modelCode"
              type="button"
              class="agent-card agent-card--model"
              :class="{ 'agent-card--selected': selectedModelCode === model.modelCode }"
              @click="selectModel(model.modelCode)"
            >
              <div class="agent-card__avatar-wrap">
                <div class="agent-card__avatar agent-card__avatar--placeholder agent-card__avatar--model">
                  {{ model.name.slice(0, 1) }}
                </div>
              </div>
              <div class="agent-card__name">{{ model.name }}</div>
              <div v-if="model.desc" class="agent-card__desc">{{ model.desc }}</div>
            </button>
          </div>
        </template>
      </div>

      <div class="picker-footer">
        <a-button class="picker-btn-cancel" size="large" @click="handleCancel">
          <div class="text-gradient">取消</div>
        </a-button>
        <a-button
          type="primary"
          size="large"
          class="picker-btn-ok"
          :disabled="!canConfirm"
          @click="handleConfirm"
        >
          确定
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import { userModelList, userModelListByFunc } from '~/utils/businessApi'
import type { AiModelType, UserModelListItem } from '~/types/business-api'

export interface ModelPickerOption {
  modelCode: string
  name: string
  desc?: string
}

export interface AgentOption {
  /** 智能体 agentCode，用于形态/分镜等需传 agentCode 的接口 */
  id: string
  name: string
  desc?: string
  thumbnail?: string
  /** 业务分类编码（列表分组用；parallel 提交用 id/agentCode） */
  bizCategoryCode?: string
  /** 智能体默认 modelCode（切换智能体时优先选中） */
  defaultModelCode?: string
}

interface Props {
  open: boolean
  defaultQuery?: string
  agents: AgentOption[]
  /** 预置模型池（如 gen-config/get 的 availableModels），传入则不再请求 listByFunc */
  models?: UserModelListItem[]
  /** 传入时展示模型列表并调用 POST /api/user/model/listByFunc（未传 models 时） */
  funcCode?: string
  /** funcCode 无数据时按 modelType 拉取 /api/user/model/list（如分镜视频） */
  modelType?: AiModelType
  /** 已选 modelCode，打开弹窗时回显 */
  initialModelCode?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultQuery: '',
  models: () => [],
  funcCode: '',
  modelType: undefined,
  initialModelCode: ''
})

const showModelSection = computed(
  () =>
    Boolean(
      (Array.isArray(props.models) && props.models.length > 0) ||
        String(props.funcCode || '').trim() ||
        props.modelType
    )
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [payload: { agent?: AgentOption; modelCode?: string }]
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const query = ref(props.defaultQuery)
const selected = ref<AgentOption | null>(null)
const selectedModelCode = ref('')

function selectAgent(agent: AgentOption) {
  if (selected.value?.id === agent.id) {
    selected.value = null
    selectedModelCode.value = ''
    return
  }
  selected.value = agent
  void applyAgentDefaultModel(agent)
}

/** 切换智能体：刷新模型池后选中该智能体默认 modelCode（须在池内） */
async function applyAgentDefaultModel(agent: AgentOption) {
  if (!showModelSection.value) return
  if (!modelOptions.value.length) {
    await loadModelsForPicker()
  }
  const defaultCode = String(agent.defaultModelCode || '').trim()
  if (defaultCode && modelOptions.value.some((m) => m.modelCode === defaultCode)) {
    selectedModelCode.value = defaultCode
    return
  }
  selectedModelCode.value = ''
}

function selectModel(modelCode: string) {
  const code = String(modelCode || '').trim()
  if (!code) return
  if (selectedModelCode.value === code) {
    selectedModelCode.value = ''
    return
  }
  selectedModelCode.value = code
}

function mapModelItem(item: UserModelListItem): ModelPickerOption {
  const modelCode = String(item.modelCode || '').trim()
  const provider = String(item.providerName || '').trim()
  const typeLabel = String(item.modelType || '').trim()
  return {
    modelCode,
    name: String(item.modelName || modelCode || '未命名模型'),
    desc: provider || typeLabel || undefined
  }
}

const modelOptions = ref<ModelPickerOption[]>([])
const modelsLoading = ref(false)

function applyPresetModels(list: UserModelListItem[]) {
  modelOptions.value = list.map(mapModelItem).filter((m) => m.modelCode)
}

async function loadModelsForPicker() {
  if (!showModelSection.value) {
    modelOptions.value = []
    return
  }
  const preset = props.models
  if (Array.isArray(preset) && preset.length) {
    applyPresetModels(preset)
    return
  }
  const code = String(props.funcCode || '').trim()
  modelsLoading.value = true
  try {
    let list: UserModelListItem[] = []
    if (code) {
      list = await userModelListByFunc(code)
    }
    if (!list.length && props.modelType) {
      list = await userModelList({ modelType: props.modelType })
    }
    modelOptions.value = list.map(mapModelItem).filter((m) => m.modelCode)
  } catch {
    modelOptions.value = []
  } finally {
    modelsLoading.value = false
  }
}

watch(
  () => props.defaultQuery,
  (v) => {
    query.value = v
  }
)

watch(
  () => props.open,
  (v) => {
    if (v) {
      selected.value = null
      query.value = props.defaultQuery
      selectedModelCode.value = String(props.initialModelCode || '').trim()
      if (showModelSection.value) void loadModelsForPicker()
    }
  }
)

watch(
  () => [props.funcCode, props.modelType, props.models] as const,
  () => {
    if (props.open && showModelSection.value) void loadModelsForPicker()
  },
  { deep: true }
)

watch(modelOptions, (list) => {
  if (!props.open || !list.length) return
  const current = selectedModelCode.value.trim()
  if (current && !list.some((m) => m.modelCode === current)) {
    selectedModelCode.value = ''
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.agents
  return props.agents.filter((a) => (a.name + (a.desc || '')).toLowerCase().includes(q))
})

const filteredModels = computed(() => {
  const list = modelOptions.value
  const q = query.value.trim().toLowerCase()
  const preset = String(props.defaultQuery || '').trim().toLowerCase()
  // 打开弹窗时 defaultQuery 常为「场景/角色/道具」，仅用于智能体筛选，勿用它滤空模型列表
  if (!q || (preset && q === preset)) return list
  return list.filter((m) =>
    (m.name + (m.desc || '') + m.modelCode).toLowerCase().includes(q)
  )
})

const canConfirm = computed(
  () => Boolean(selected.value) || Boolean(selectedModelCode.value.trim())
)

const handleConfirm = () => {
  if (!canConfirm.value) return
  const mc = selectedModelCode.value.trim()
  emit('select', {
    ...(selected.value ? { agent: selected.value } : {}),
    ...(mc ? { modelCode: mc } : {})
  })
  localOpen.value = false
}

const handleCancel = () => {
  localOpen.value = false
}
</script>

<style lang="scss">
/*
 * 弹窗 teleport 到 body，壳层勿 scoped（大屏无 compact-viewport 全局兜底时会失效）
 */
html.app-shell-create .ant-modal-wrap.agent-picker-wrap .ant-modal,
html.app-shell-create .ant-modal.agent-picker-modal {
  background: transparent !important;
}

html.app-shell-create .ant-modal-wrap.agent-picker-wrap .ant-modal-content,
html.app-shell-create .ant-modal.agent-picker-modal .ant-modal-content {
  padding: 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  height: min(720px, calc(100dvh - 48px));
  max-height: calc(100dvh - 48px);
}

html.app-shell-create .ant-modal-wrap.agent-picker-wrap .ant-modal-header,
html.app-shell-create .ant-modal.agent-picker-modal .ant-modal-header {
  margin: 0;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: none !important;
  background: #191a1d;
  flex-shrink: 0;
}

html.app-shell-create .ant-modal-wrap.agent-picker-wrap .ant-modal-title,
html.app-shell-create .ant-modal.agent-picker-modal .ant-modal-title {
  width: 100%;
}

html.app-shell-create .ant-modal-wrap.agent-picker-wrap .ant-modal-close,
html.app-shell-create .ant-modal.agent-picker-modal .ant-modal-close {
  top: 1rem;
  inset-inline-end: 1rem;
  color: rgba(255, 255, 255, 0.75);
}

html.app-shell-create .ant-modal-wrap.agent-picker-wrap .ant-modal-close:hover,
html.app-shell-create .ant-modal.agent-picker-modal .ant-modal-close:hover {
  color: #4ae7fd;
}

html.app-shell-create .ant-modal-wrap.agent-picker-wrap .ant-modal-body,
html.app-shell-create .ant-modal.agent-picker-modal .ant-modal-body {
  padding: 0;
  background: #191a1d;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

<style lang="scss" scoped>

.picker-shell {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  max-height: 100%;
}

.picker-search {
  flex-shrink: 0;
  padding: 10px 66px 10px 96px;
  background: rgba(32, 36, 52, 1);
  .picker-search-input {
    background: rgba(10, 18, 30, 1) !important;
    border: 1px solid rgba(7, 63, 86, 1) !important;
  }
}

.picker-search-input :deep(.ant-input-affix-wrapper) {
  border-radius: 10px;
  color: #e6edf3 !important;
}

.picker-search-input :deep(.ant-input-affix-wrapper:hover),
.picker-search-input :deep(.ant-input-affix-wrapper-focused) {
  border-color: rgba(74, 231, 253, 0.45) !important;
}

.picker-search-input :deep(.ant-input) {
  background: transparent !important;
  color: #e6edf3 !important;
}

.picker-search-input :deep(.ant-input::placeholder) {
  color: rgba(142, 151, 165, 0.9);
}

.picker-search-ico {
  color: rgba(142, 151, 165, 0.95);
  font-size: 1rem;
}

.picker-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.25rem 1.5rem 1rem;
  background: #191a1d;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.picker-section-label {
  margin: 0 0 1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #e6edf3;
}

.picker-section-label--models {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(74, 231, 253, 0.12);
}

.picker-models-loading,
.picker-models-empty {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: rgba(142, 151, 165, 0.95);
  margin-bottom: 0.5rem;
}

.agent-grid--models {
  margin-bottom: 0.25rem;
}

.agent-card--model .agent-card__avatar--model {
  background: rgba(14, 89, 250, 0.18);
  color: #7eb8ff;
}

.picker-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  color: rgba(142, 151, 165, 0.95);
  font-size: 0.9375rem;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .agent-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .agent-grid {
    grid-template-columns: 1fr;
  }
}

.agent-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.25rem 1rem 1.35rem;
  border-radius: 12px;
  border: 1px solid rgba(96, 124, 158, 0.28);
  background: rgba(22, 26, 36, 0.95);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.agent-card:hover {
  border-color: #4ae7fd;
}

.agent-card--selected {
  border-color: #4ae7fd;
}

.agent-card__avatar-wrap {
  margin-bottom: 0.85rem;
}

.agent-card__avatar {
  width: 88px;
  height: 88px;
  border-radius: 12px;
  object-fit: cover;
  display: block;
}

.agent-card__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 231, 253, 0.12);
  color: #4ae7fd;
  font-size: 1.75rem;
  font-weight: 800;
}

.agent-card__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.35;
  margin-bottom: 0.35rem;
}

.agent-card__desc {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgba(142, 151, 165, 0.98);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.picker-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.25rem;
  border-top: 1px solid rgba(74, 231, 253, 0.12);
  background: #191a1d;
  .picker-btn-cancel {
    min-width: 96px;
    border-radius: 10px !important;
    border: 1px solid rgba(74, 231, 253, 0.3) !important;
    background: rgba(18, 18, 18, 1) !important;
    color: #e6edf3 !important;
  }
}

.picker-btn-cancel:hover {
  border-color: rgba(74, 231, 253, 0.45) !important;
  color: #4ae7fd !important;
}

.picker-btn-ok {
  min-width: 96px;
  border-radius: 10px !important;
  border: none !important;
  font-weight: 600;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  color: #fff !important;
  box-shadow: none !important;
}

.picker-btn-ok:hover:not(:disabled) {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  color: #fff !important;
}

.picker-btn-ok:disabled {
  opacity: 0.45;
}
</style>
