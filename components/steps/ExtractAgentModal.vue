<template>
  <a-modal
    v-model:open="localOpen"
    :width="extractModalWidth"
    :footer="null"
    :closable="true"
    centered
    class="extract-agent-modal"
    wrap-class-name="create-flow-modal"
    @cancel="handleCancel"
  >
    <template #title>
      <ModalTitleWatermark :title="extractModalTitle" watermark="EXTRACT" />
    </template>

    <div class="extract-body">
      <div
        class="extract-progress"
        role="progressbar"
        :aria-valuenow="Math.round(progressPercent)"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="提取进度"
      >
        <div class="extract-progress__track">
          <div
            class="extract-progress__fill"
            :style="{ width: progressPercent + '%' }"
            @transitionend="onProgressFillTransitionEnd"
          />
        </div>
      </div>

      <div class="extract-shell">
        <div class="extract-columns" :class="extractColumnsClass">
          <div v-for="col in visibleColumns" :key="col.kind" class="extract-col">
            <div class="extract-col__head">
              <span class="extract-col__head-text">{{ col.label }}</span>
              <span
                class="extract-col__head-ico"
                aria-hidden="true"
                role="button"
                tabindex="0"
                @click.stop="openPicker(col.kind)"
                @keydown.enter.prevent="openPicker(col.kind)"
              >
                <img src="/assets/img/icon/Subtract.svg" alt="" />
              </span>
            </div>
            <div class="extract-col__box">
              <button type="button" class="extract-col__card" @click.stop="openPicker(col.kind)">
                <figure class="extract-col__figure">
                  <div class="extract-col__img-wrap">
                    <img
                      v-if="localAgents[col.kind].thumbnail"
                      :src="localAgents[col.kind].thumbnail"
                      :alt="localAgents[col.kind].name || col.label + '智能体'"
                      class="extract-col__img"
                    />
                    <div v-else class="extract-col__img-placeholder">
                      <ThunderboltOutlined />
                    </div>
                  </div>
                  <figcaption class="extract-col__caption">
                    <div class="extract-col__name">
                      {{ localAgents[col.kind].name || '点击选择智能体' }}
                    </div>
                    <p class="extract-col__desc">
                      {{
                        localAgents[col.kind].desc ||
                        (localAgents[col.kind].name ? '暂无描述' : '从列表中选择适合本环节的智能体')
                      }}
                    </p>
                  </figcaption>
                </figure>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="extract-footer">
      <a-button class="extract-btn-cancel" size="large" @click="handleCancel">
        <div class="text-gradient">取消</div>
      </a-button>
      <a-button
        type="primary"
        size="large"
        class="extract-btn-ok"
        :disabled="isExtracting"
        @click="handleStart"
      >
        <template #icon><img src="@/assets/img/icon/star_white.svg" alt="" /></template>
        开始提取
      </a-button>
    </div>
  </a-modal>

  <AgentPickerModal
    v-model:open="pickerOpen"
    :agents="pickerAgents"
    :models="pickerAvailableModels"
    :default-query="pickerDefaultQuery"
    :initial-model-code="localModelCodes[pickerKind]"
    @select="handlePicked"
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ThunderboltOutlined } from '@ant-design/icons-vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import AgentPickerModal, { type AgentOption } from './AgentPickerModal.vue'
import { useCreationStore } from '~/stores/creation'
import type { UserModelListItem } from '~/types/business-api'
import {
  EXTRACT_PARALLEL_AGENT_BIZ_CATEGORY,
  agentOptionsFromGenConfigVo,
  emptyExtractModelCodes,
  pickFirstAgentOption,
  type ExtractModelCodes
} from '~/utils/extractAgentBiz'
import { getProjectGenConfigBySceneCode } from '~/utils/projectGenConfig'

export interface ExtractAgents {
  scene: AgentOption
  character: AgentOption
  prop: AgentOption
}

/** 弹窗展示列：all 为三列；单项时仅展示对应提取模型 */
export type ExtractModalScope = 'all' | 'scene' | 'character' | 'prop'

type AgentKind = 'scene' | 'character' | 'prop'

const columnConfig: { kind: AgentKind; label: string }[] = [
  { kind: 'scene', label: '提取场景' },
  { kind: 'character', label: '提取角色' },
  { kind: 'prop', label: '提取道具' }
]

interface Props {
  open: boolean
  agents: ExtractAgents
  modelCodes?: ExtractModelCodes
  /** 为 all 时三列；为 scene/character/prop 时仅展示该列 */
  scope?: ExtractModalScope
}

const props = withDefaults(defineProps<Props>(), {
  scope: 'all',
  modelCodes: () => emptyExtractModelCodes()
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:agents': [value: ExtractAgents]
  'update:modelCodes': [value: ExtractModelCodes]
  start: [payload: { agents: ExtractAgents; modelCodes: ExtractModelCodes; scope: ExtractModalScope }]
}>()

const visibleColumns = computed(() => {
  if (props.scope === 'all') return columnConfig
  return columnConfig.filter((c) => c.kind === props.scope)
})

const extractModalTitle = computed(() => {
  if (props.scope === 'scene') return '提取场景'
  if (props.scope === 'character') return '提取角色'
  if (props.scope === 'prop') return '提取道具'
  return '提取场景/角色/道具'
})

const extractColumnsClass = computed(() => {
  const n = visibleColumns.value.length
  if (n === 1) return 'extract-columns--1'
  if (n === 2) return 'extract-columns--2'
  return 'extract-columns--3'
})

const extractModalWidth = computed(() => (props.scope === 'all' ? 1100 : 420))

const creationStore = useCreationStore()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const emptyAgent = (): AgentOption => ({ id: '', name: '', thumbnail: '', desc: '' })

const localAgents = reactive<ExtractAgents>({
  scene: emptyAgent(),
  character: emptyAgent(),
  prop: emptyAgent()
})

const localModelCodes = reactive<ExtractModelCodes>(emptyExtractModelCodes())

const agentsLoadingKind = ref<AgentKind | null>(null)
const agentsByKind = reactive<Record<AgentKind, AgentOption[]>>({
  scene: [],
  character: [],
  prop: []
})

const modelsByKind = reactive<Record<AgentKind, UserModelListItem[]>>({
  scene: [],
  character: [],
  prop: []
})

watch(
  () => props.agents,
  (val) => {
    localAgents.scene = { ...val.scene }
    localAgents.character = { ...val.character }
    localAgents.prop = { ...val.prop }
  },
  { immediate: true, deep: true }
)

watch(
  () => props.modelCodes,
  (val) => {
    localModelCodes.scene = String(val?.scene || '').trim()
    localModelCodes.character = String(val?.character || '').trim()
    localModelCodes.prop = String(val?.prop || '').trim()
  },
  { immediate: true, deep: true }
)

const pickerOpen = ref(false)
const pickerKind = ref<AgentKind>('scene')
const pickerDefaultQuery = ref('')

const pickerAgents = computed(() => agentsByKind[pickerKind.value] ?? [])

const pickerAvailableModels = computed(() => modelsByKind[pickerKind.value] ?? [])

function kindLabel(kind: AgentKind): string {
  if (kind === 'scene') return '场景'
  if (kind === 'character') return '角色'
  return '道具'
}

function applySelectionForKind(kind: AgentKind, list: AgentOption[], autoPickDefault: boolean) {
  if (!list.length) return
  const currentId = localAgents[kind].id?.trim()
  const matched = currentId ? list.find((a) => a.id === currentId) : null
  if (matched) {
    localAgents[kind] = { ...matched }
    return
  }
  if (autoPickDefault) {
    const first = pickFirstAgentOption(list)
    if (first) localAgents[kind] = { ...first }
  }
}

function applyGenConfigForKind(
  kind: AgentKind,
  cfg: Awaited<ReturnType<typeof getProjectGenConfigBySceneCode>>,
  autoPickDefault: boolean
) {
  const agents = cfg ? agentOptionsFromGenConfigVo(cfg) : []
  agentsByKind[kind] = agents
  modelsByKind[kind] = Array.isArray(cfg?.availableModels) ? cfg.availableModels : []

  if (autoPickDefault) {
    const agentCode = String(cfg?.agentCode || '').trim()
    if (agentCode) {
      const matched = agents.find((a) => a.id === agentCode)
      localAgents[kind] = matched
        ? { ...matched }
        : { id: agentCode, name: agentCode, thumbnail: '', desc: '' }
    } else {
      applySelectionForKind(kind, agents, true)
    }
    const modelCode = String(cfg?.modelCode || '').trim()
    if (modelCode) localModelCodes[kind] = modelCode
    return
  }

  applySelectionForKind(kind, agents, false)
}

async function loadGenConfigForKinds(kinds: AgentKind[], options?: { autoPickDefault?: boolean }) {
  if (!kinds.length) return
  const projectId = Number(creationStore.currentProjectId)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.warning('请先选择作品')
    return
  }

  agentsLoadingKind.value = kinds.length === 1 ? kinds[0]! : null
  try {
    for (const kind of kinds) {
      const sceneCode = EXTRACT_PARALLEL_AGENT_BIZ_CATEGORY[kind]
      const cfg = await getProjectGenConfigBySceneCode(projectId, sceneCode)
      applyGenConfigForKind(kind, cfg, options?.autoPickDefault ?? false)
    }
    emit('update:agents', {
      scene: { ...localAgents.scene },
      character: { ...localAgents.character },
      prop: { ...localAgents.prop }
    })
    emit('update:modelCodes', {
      scene: localModelCodes.scene,
      character: localModelCodes.character,
      prop: localModelCodes.prop
    })
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载生成配置失败')
    for (const kind of kinds) {
      agentsByKind[kind] = []
      modelsByKind[kind] = []
    }
  } finally {
    agentsLoadingKind.value = null
  }
}

const openPicker = async (kind: AgentKind) => {
  pickerKind.value = kind
  pickerDefaultQuery.value = kindLabel(kind)
  if (!agentsByKind[kind].length) {
    await loadGenConfigForKinds([kind])
  }
  if (!agentsByKind[kind].length) {
    message.warning(`暂无可用${kindLabel(kind)}智能体`)
    return
  }
  pickerOpen.value = true
}

const handlePicked = (payload: { agent?: AgentOption; modelCode?: string }) => {
  if (payload.agent) {
    localAgents[pickerKind.value] = { ...payload.agent }
  }
  if (payload.modelCode) {
    localModelCodes[pickerKind.value] = String(payload.modelCode).trim()
  }
  emit('update:agents', {
    scene: { ...localAgents.scene },
    character: { ...localAgents.character },
    prop: { ...localAgents.prop }
  })
  emit('update:modelCodes', {
    scene: localModelCodes.scene,
    character: localModelCodes.character,
    prop: localModelCodes.prop
  })
}

/** 与 .extract-progress__fill 的 transition 时长一致（毫秒） */
const PROGRESS_DURATION_MS = 1400

const progressPercent = ref(0)
const isExtracting = ref(false)
let extractPendingPayload: {
  agents: ExtractAgents
  modelCodes: ExtractModelCodes
} | null = null
let extractFallbackTimer: ReturnType<typeof setTimeout> | null = null

const clearExtractFallback = () => {
  if (extractFallbackTimer != null) {
    clearTimeout(extractFallbackTimer)
    extractFallbackTimer = null
  }
}

const finishExtractAndClose = () => {
  clearExtractFallback()
  if (!extractPendingPayload) return
  const payload = extractPendingPayload
  extractPendingPayload = null
  isExtracting.value = false
  emit('start', { agents: payload.agents, modelCodes: payload.modelCodes, scope: props.scope })
  localOpen.value = false
  progressPercent.value = 0
}

const onProgressFillTransitionEnd = (e: TransitionEvent) => {
  if (e.propertyName !== 'width') return
  if (!isExtracting.value || !extractPendingPayload) return
  finishExtractAndClose()
}

const handleStart = () => {
  if (isExtracting.value) return
  for (const col of visibleColumns.value) {
    const a = localAgents[col.kind]
    if (!a?.id?.trim()) {
      message.warning(`请先为「${col.label}」选择智能体`)
      return
    }
  }
  const payload = {
    agents: {
      scene: { ...localAgents.scene },
      character: { ...localAgents.character },
      prop: { ...localAgents.prop }
    },
    modelCodes: {
      scene: localModelCodes.scene,
      character: localModelCodes.character,
      prop: localModelCodes.prop
    }
  }
  isExtracting.value = true
  extractPendingPayload = payload
  progressPercent.value = 0
  clearExtractFallback()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      progressPercent.value = 100
    })
  })
  extractFallbackTimer = setTimeout(() => {
    extractFallbackTimer = null
    if (isExtracting.value && extractPendingPayload) finishExtractAndClose()
  }, PROGRESS_DURATION_MS + 80)
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      clearExtractFallback()
      isExtracting.value = false
      progressPercent.value = 0
      extractPendingPayload = null
    } else {
      progressPercent.value = 0
      void loadGenConfigForKinds(
        props.scope === 'all'
          ? (['scene', 'character', 'prop'] as AgentKind[])
          : ([props.scope] as AgentKind[]),
        { autoPickDefault: true }
      )
    }
  }
)

const handleCancel = () => {
  clearExtractFallback()
  isExtracting.value = false
  progressPercent.value = 0
  extractPendingPayload = null
  localOpen.value = false
}
</script>

<style lang="scss" scoped>
/* 与 AgentPickerModal 一致的深色弹窗壳 */
.extract-agent-modal :deep(.ant-modal) {
  background: transparent !important;
}

.extract-agent-modal :deep(.ant-modal-content) {
  padding: 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.extract-agent-modal :deep(.ant-modal-header) {
  margin: 0;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: none !important;
  background: #191a1d;
}

.extract-agent-modal :deep(.ant-modal-title) {
  width: 100%;
}

.extract-agent-modal :deep(.ant-modal-close) {
  top: 1rem;
  inset-inline-end: 1rem;
  color: rgba(255, 255, 255, 0.75);
}

.extract-agent-modal :deep(.ant-modal-close:hover) {
  color: #4ae7fd;
}

.extract-agent-modal :deep(.ant-modal-body) {
  padding: 0;
  background: #191a1d;
}

.extract-body {
  background: #191a1d;
}

.extract-progress {
  width: 100%;
}

.extract-progress__track {
  height: 4px;
  width: 100%;
  background: #121212;
  border-radius: 2px;
  overflow: hidden;
}

.extract-progress__fill {
  height: 100%;
  width: 0%;
  border-radius: 2px;
  background: linear-gradient(90deg, #0e59fa 0%, #00abd8 50%, #4ae7fd 100%);
  box-shadow: 0 0 10px rgba(74, 231, 253, 0.35);
  transition: width 1.4s cubic-bezier(0.33, 1, 0.68, 1);
  will-change: width;
}

.extract-shell {
  padding: 0 0 1.25rem;
  background: #191a1d;
}

.extract-subtitle {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: rgba(142, 151, 165, 0.95);
  font-weight: 500;
  text-align: center;
}

.extract-columns {
  display: grid;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(22, 26, 36, 0.6);
  border-bottom: 1px solid rgba(74, 231, 253, 0.3);
  border-left: 1px solid rgba(74, 231, 253, 0.3);
  border-right: 1px solid rgba(74, 231, 253, 0.3);
}

.extract-columns--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.extract-columns--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.extract-columns--1 {
  grid-template-columns: minmax(0, 1fr);
}

.extract-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  &:not(:last-child) {
    border-right: 1px solid rgba(74, 231, 253, 0.3);
  }
}

.extract-col__head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-bottom: 0.5rem;
  background: rgba(32, 36, 52, 1);
  height: 40px;
  border-bottom: 1px solid rgba(74, 231, 253, 0.3);
}

.extract-col__head-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #fff;
  flex-shrink: 0;
  cursor: pointer;
  img {
    width: 14px;
    height: 14px;
  }
}

.extract-col__head-text {
  font-size: 16px;
  font-weight: 600;
  color: #e6edf3;
}

.extract-col__figure {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.extract-col__box {
  padding: 22px 12px 12px;
  .extract-col__card {
    flex: 1;
    display: block;
    width: 100%;
    margin: 0;
    border: 1px solid transparent;
    overflow: hidden;
    cursor: pointer;
    background: rgba(22, 26, 36, 0.6);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;
  }
}

/* 整块卡片（含图+文案）统一高亮，不再单独给子元素加 hover */
//.extract-col__card:hover {
//  border: 1px solid rgba(74, 231, 253, 0.95);
//  box-shadow:
//    0 0 0 1px rgba(74, 231, 253, 0.35),
//    0 8px 28px rgba(0, 163, 255, 0.18);
//  background: rgba(22, 28, 40, 0.92);
//}

//.extract-col__card:focus-visible {
//  outline: 2px solid rgba(74, 231, 253, 0.65);
//  outline-offset: 2px;
//}

.extract-col__img-wrap {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(10, 14, 22, 0.9);
  border: 1px solid rgba(74, 231, 253, 0.28);
}

.extract-col__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.extract-col__img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(74, 231, 253, 0.45);
  font-size: 2rem;
}

.extract-col__caption {
  margin-top: 0.75rem;
  width: 100%;
  padding: 14px 0;
  text-align: center;
  background: #111111;
}

.extract-col__name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.4;
  margin: 0 0 0.4rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.extract-col__desc {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.55;
  color: rgba(142, 151, 165, 0.98);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.extract-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  background: #191a1d;

  :deep(.extract-btn-cancel) {
    min-width: 96px;
    border-radius: 10px !important;
    border: 1px solid rgba(74, 231, 253, 0.3) !important;
    background: rgba(18, 18, 18, 1) !important;
    color: #e6edf3 !important;
  }
}

.extract-btn-cancel:hover {
  border-color: rgba(74, 231, 253, 0.45) !important;
  color: #4ae7fd !important;
}

.extract-btn-ok {
  min-width: 120px;
  border-radius: 10px !important;
  border: none !important;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  color: #fff !important;
  box-shadow: none !important;
  display: flex;
  align-items: center;
  gap: 8px;
  img{
    width: 16px;
    height: 16px;
  }
}

.extract-btn-ok:hover:not(:disabled) {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  color: #fff !important;
}

@media (max-width: 900px) {
  .extract-columns--2,
  .extract-columns--3 {
    grid-template-columns: 1fr;
  }

  .extract-columns--2 .extract-col:not(:last-child),
  .extract-columns--3 .extract-col:not(:last-child) {
    border-right: none;
    border-bottom: 1px solid rgba(74, 231, 253, 0.12);
  }
}
</style>
