<template>
  <div class="create-first-step-form" :class="{ 'create-first-step-form--page': pageLayout }">
    <div class="left-panel">
      <div class="head_box">
        <img src="../../assets/img/createProcess/Union-l.svg" alt="" />
        <h4 class="block-title">基本信息</h4>
      </div>
      <div class="content_box">
        <div class="field-group inline-options">
          <label class="field-label">作品类型</label>
          <div class="chip-group">
            <button
              v-for="opt in projectTypeOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: displayProjectType === opt.value, 'is-disabled': projectTypeLocked }"
              :aria-disabled="projectTypeLocked"
              @click="!projectTypeLocked && pickProjectType(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">作品名称</label>
          <div class="name-input-wrap">
            <input
              :value="title"
              type="text"
              maxlength="25"
              class="name-input"
              placeholder="请输入作品名称"
              @input="onTitleInput"
            />
            <span class="count-text">{{ title.length }}/25</span>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">视频比例</label>
          <div class="ratio-grid">
            <button
              v-for="ratio in ratioOptions"
              :key="ratio.value"
              type="button"
              class="ratio-item"
              :class="{ active: aspectRatio === ratio.value }"
              @mouseenter="hoveredRatio = ratio.value"
              @mouseleave="hoveredRatio = null"
              @focus="hoveredRatio = ratio.value"
              @blur="hoveredRatio = null"
              @click="emit('update:aspectRatio', ratio.value)"
            >
              <img :src="ratioIconSrc(ratio)" :alt="ratio.label" />
              <span>{{ ratio.label }}</span>
            </button>
          </div>
        </div>

        <div class="field-group inline-options">
          <label class="field-label">剧本类型</label>
          <p v-if="!enumOptionsLoaded" class="dict-placeholder">加载中…</p>
          <p v-else-if="!scriptTypeOptions.length" class="dict-placeholder">暂无数据</p>
          <div v-else class="chip-group">
            <button
              v-for="opt in scriptTypeOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: displayScriptType === opt.value }"
              @click="pickScriptType(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="field-group inline-options">
          <label class="field-label">模型策略</label>
          <p v-if="!enumOptionsLoaded" class="dict-placeholder">加载中…</p>
          <p v-else-if="!modelStrategyOptions.length" class="dict-placeholder">暂无数据</p>
          <div v-else class="chip-group">
            <button
              v-for="opt in modelStrategyOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: displayModelStrategy === opt.value }"
              @click="pickModelStrategy(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="field-group inline-options">
          <label class="field-label">创作模式</label>
          <p v-if="!enumOptionsLoaded" class="dict-placeholder">加载中…</p>
          <p v-else-if="!creationModeOptions.length" class="dict-placeholder">暂无数据</p>
          <div v-else class="chip-group">
            <button
              v-for="opt in creationModeOptions"
              :key="opt.value"
              type="button"
              class="chip"
              :class="{ active: displayCreationMode === opt.value }"
              @click="pickCreationMode(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

      </div>
    </div>

    <div class="right-panel">
      <div class="head_box">
        <img src="../../assets/img/createProcess/Union-r.svg" alt="" />
        <h4 class="block-title">我的风格库</h4>
      </div>
      <GlobalSetting
        v-if="contentReady"
        :model-value="modelValue"
        :style-library-only="true"
        description=""
        @update:model-value="onRightPanelModelUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import GlobalSetting from '~/components/steps/GlobalSetting.vue'
import type { GlobalSettingData } from '~/types'
import { CREATE_FIRST_STEP_DEFAULTS } from '~/utils/createFirstStepDefaults'
import { userDictEnumList } from '~/utils/businessApi'
import {
  buildEnumChipOptions,
  normalizeCreationModeValue,
  normalizeModelStrategyValue,
  normalizeScriptTypeValue,
  type GlobalSettingCreationMode,
  type GlobalSettingModelStrategy,
  type GlobalSettingScriptType
} from '~/utils/globalSettingEnums'
import ratio16by9Icon from '~/assets/img/createProcess/16-9.svg'
import ratio9by16Icon from '~/assets/img/createProcess/9-16.svg'
import ratio4by3Icon from '~/assets/img/createProcess/4-3.svg'
import ratio3by4Icon from '~/assets/img/createProcess/3-4.svg'
import ratio1by1Icon from '~/assets/img/createProcess/1-1.svg'
import ratio21by9Icon from '~/assets/img/createProcess/21-9.svg'
import ratio21by9IconSel from '~/assets/img/createProcess/21-9-sel.svg'
import ratio1by1IconSel from '~/assets/img/createProcess/1-1-sel.svg'
import ratio4by3IconSel from '~/assets/img/createProcess/4-3-sel.svg'
import ratio3by4IconSel from '~/assets/img/createProcess/3-4-sel.svg'
import ratio9by16IconSel from '~/assets/img/createProcess/9-16-sel.svg'
import ratio16by9IconSel from '~/assets/img/createProcess/16-9-sel.svg'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

type RatioValue = '16:9' | '9:16' | '4:3' | '3:4' | '1:1' | '21:9'
type ProjectTypeValue = 'movie' | 'series'
type ScriptTypeValue = GlobalSettingScriptType
type StrategyValue = GlobalSettingModelStrategy
type CreationModeValue = GlobalSettingCreationMode

interface Props {
  open: boolean
  title: string
  projectType: ProjectTypeValue
  aspectRatio: RatioValue
  scriptType: ScriptTypeValue
  modelStrategy: StrategyValue
  creationMode: CreationModeValue
  modelValue: GlobalSettingData
  flowEditMode?: boolean
  projectTypeLocked?: boolean
  syncProjectTypeFromParent?: boolean
  /** 页面内嵌布局（非弹窗） */
  pageLayout?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  flowEditMode: false,
  projectTypeLocked: false,
  syncProjectTypeFromParent: false,
  pageLayout: false
})

const emit = defineEmits<{
  'update:title': [value: string]
  'update:projectType': [value: ProjectTypeValue]
  'update:aspectRatio': [value: RatioValue]
  'update:scriptType': [value: ScriptTypeValue]
  'update:modelStrategy': [value: StrategyValue]
  'update:creationMode': [value: CreationModeValue]
  'update:modelValue': [value: GlobalSettingData]
}>()

type EnumOption = { value: string; label: string }

const projectTypeOptions = ref<Array<{ value: ProjectTypeValue; label: string }>>([
  { value: 'series', label: '剧集' },
  { value: 'movie', label: '电影' }
])

const scriptTypeOptions = ref<Array<{ value: ScriptTypeValue; label: string }>>([])
const creationModeOptions = ref<Array<{ value: CreationModeValue; label: string }>>([])
const modelStrategyOptions = ref<Array<{ value: StrategyValue; label: string }>>([])
const enumOptionsLoaded = ref(false)

const ratioIconByValue: Record<
  RatioValue,
  { icon: string; iconSel: string; label: string }
> = {
  '16:9': { icon: ratio16by9Icon, iconSel: ratio16by9IconSel, label: '16 : 9' },
  '9:16': { icon: ratio9by16Icon, iconSel: ratio9by16IconSel, label: '9 : 16' },
  '4:3': { icon: ratio4by3Icon, iconSel: ratio4by3IconSel, label: '4 : 3' },
  '3:4': { icon: ratio3by4Icon, iconSel: ratio3by4IconSel, label: '3 : 4' },
  '1:1': { icon: ratio1by1Icon, iconSel: ratio1by1IconSel, label: '1 : 1' },
  '21:9': { icon: ratio21by9Icon, iconSel: ratio21by9IconSel, label: '21 : 9' }
}

const ratioOptions = ref<Array<{ label: string; value: RatioValue; icon: string; iconSel: string }>>(
  Object.entries(ratioIconByValue).map(([value, meta]) => ({
    value: value as RatioValue,
    label: meta.label,
    icon: meta.icon,
    iconSel: meta.iconSel
  }))
)

function groupOptions(groups: { enumType: string; items: { value: string; desc: string }[] }[], enumType: string): EnumOption[] {
  return buildEnumChipOptions(groups, enumType)
}

const isNewProjectModal = computed(() => !props.flowEditMode)
const leftPanelReady = ref(false)

const contentReady = computed(
  () => props.open && (props.flowEditMode || props.pageLayout || leftPanelReady.value)
)

const leftPanelDraft = reactive({
  projectType: CREATE_FIRST_STEP_DEFAULTS.projectType as ProjectTypeValue,
  scriptType: CREATE_FIRST_STEP_DEFAULTS.scriptType as ScriptTypeValue,
  modelStrategy: CREATE_FIRST_STEP_DEFAULTS.modelStrategy as StrategyValue,
  creationMode: CREATE_FIRST_STEP_DEFAULTS.creationMode as CreationModeValue
})

const displayProjectType = computed(() =>
  isNewProjectModal.value ? leftPanelDraft.projectType : props.projectType
)
const displayScriptType = computed(() =>
  isNewProjectModal.value ? leftPanelDraft.scriptType : props.scriptType
)
const displayModelStrategy = computed(() =>
  isNewProjectModal.value ? leftPanelDraft.modelStrategy : props.modelStrategy
)
const displayCreationMode = computed(() =>
  isNewProjectModal.value ? leftPanelDraft.creationMode : props.creationMode
)

const PROJECT_TYPE_ORDER: ProjectTypeValue[] = ['series', 'movie']

function sortOptionsByOrder<T extends { value: string }>(options: T[], order: readonly string[]): T[] {
  return [...options].sort((a, b) => {
    const ai = order.indexOf(a.value)
    const bi = order.indexOf(b.value)
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi)
  })
}

async function loadCreateModalEnums() {
  enumOptionsLoaded.value = false
  try {
    const groups = await userDictEnumList({
      enumTypes: [
        'ProjectTypeEnum',
        'AspectRatioEnum',
        'ScriptTypeEnum',
        'CreationModeEnum',
        'GenModeEnum'
      ]
    })

    const projectTypes = groupOptions(groups, 'ProjectTypeEnum')
      .map((o) => {
        if (o.value === 'series') return { value: 'series' as const, label: '剧集' }
        if (o.value === 'movie') return { value: 'movie' as const, label: '电影' }
        return null
      })
      .filter(Boolean) as Array<{ value: ProjectTypeValue; label: string }>
    if (projectTypes.length) {
      projectTypeOptions.value = sortOptionsByOrder(projectTypes, PROJECT_TYPE_ORDER)
    }

    const aspectRatios = groupOptions(groups, 'AspectRatioEnum')
      .map((o) => (o.value in ratioIconByValue ? (o.value as RatioValue) : null))
      .filter(Boolean) as RatioValue[]
    if (aspectRatios.length) {
      ratioOptions.value = aspectRatios.map((v) => {
        const meta = ratioIconByValue[v]
        return { value: v, label: meta.label, icon: meta.icon, iconSel: meta.iconSel }
      })
    }

    const scripts = groupOptions(groups, 'ScriptTypeEnum')
      .map((o) => {
        const value = normalizeScriptTypeValue(o.value)
        return value ? { value, label: o.label } : null
      })
      .filter(Boolean) as Array<{ value: ScriptTypeValue; label: string }>
    if (scripts.length) scriptTypeOptions.value = scripts

    const creations = groupOptions(groups, 'CreationModeEnum')
      .map((o) => {
        const value = normalizeCreationModeValue(o.value)
        return value ? { value, label: o.label } : null
      })
      .filter(Boolean) as Array<{ value: CreationModeValue; label: string }>
    if (creations.length) creationModeOptions.value = creations

    const genModes = groupOptions(groups, 'GenModeEnum')
      .map((o) => {
        const value = normalizeModelStrategyValue(o.value)
        return value ? { value, label: o.label } : null
      })
      .filter(Boolean) as Array<{ value: StrategyValue; label: string }>
    if (genModes.length) modelStrategyOptions.value = genModes
  } catch {
    scriptTypeOptions.value = []
    creationModeOptions.value = []
    modelStrategyOptions.value = []
  } finally {
    enumOptionsLoaded.value = true
    if (props.open && !props.flowEditMode && !props.pageLayout) initNewProjectLeftPanel()
  }
}

function resetLeftPanelDraft() {
  const d = CREATE_FIRST_STEP_DEFAULTS
  leftPanelDraft.projectType = d.projectType
  leftPanelDraft.scriptType = d.scriptType
  leftPanelDraft.modelStrategy = d.modelStrategy
  leftPanelDraft.creationMode = d.creationMode
}

function applyParentProjectType() {
  if (!props.syncProjectTypeFromParent) return
  const pt = props.projectType
  if (pt === 'series' || pt === 'movie') {
    leftPanelDraft.projectType = pt
  }
}

function syncLeftPanelToParent() {
  emit('update:projectType', leftPanelDraft.projectType)
  emit('update:scriptType', leftPanelDraft.scriptType)
  emit('update:modelStrategy', leftPanelDraft.modelStrategy)
  emit('update:creationMode', leftPanelDraft.creationMode)
}

async function initNewProjectLeftPanel() {
  resetLeftPanelDraft()
  applyParentProjectType()
  syncLeftPanelToParent()
}

function onRightPanelModelUpdate(next: GlobalSettingData) {
  emit('update:modelValue', {
    selectedStyle: next.selectedStyle,
    myStyles: next.myStyles,
    style: next.style
  } as GlobalSettingData)
}

function pickProjectType(v: ProjectTypeValue) {
  if (isNewProjectModal.value) leftPanelDraft.projectType = v
  emit('update:projectType', v)
}

function pickScriptType(v: ScriptTypeValue) {
  if (isNewProjectModal.value) leftPanelDraft.scriptType = v
  emit('update:scriptType', v)
}

function pickModelStrategy(v: StrategyValue) {
  if (isNewProjectModal.value) leftPanelDraft.modelStrategy = v
  emit('update:modelStrategy', v)
}

function pickCreationMode(v: CreationModeValue) {
  if (isNewProjectModal.value) leftPanelDraft.creationMode = v
  emit('update:creationMode', v)
}

function ensureEnumSelection<T extends string>(
  current: T,
  options: Array<{ value: T }>,
  emitUpdate: (v: T) => void,
  normalize?: (raw: string) => T | null
) {
  if (!options.length) return
  const normalized = normalize ? normalize(String(current)) : null
  if (normalized && options.some((o) => o.value === normalized)) {
    if (normalized !== current) emitUpdate(normalized)
    return
  }
  if (options.some((o) => o.value === current)) return
  emitUpdate(options[0]!.value)
}

const hoveredRatio = ref<RatioValue | null>(null)

function ratioIconSrc(ratio: { value: RatioValue; icon: string; iconSel: string }) {
  const selected = props.aspectRatio === ratio.value
  const hover = hoveredRatio.value === ratio.value
  return selected || hover ? ratio.iconSel : ratio.icon
}

const onTitleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:title', target.value)
}

onMounted(() => {
  void loadCreateModalEnums()
})

watch(
  [() => props.modelStrategy as unknown as string, () => modelStrategyOptions.value],
  ([current, options]) => {
    if (props.flowEditMode) {
      ensureEnumSelection(current as StrategyValue, options, (v) => emit('update:modelStrategy', v), normalizeModelStrategyValue)
    }
  },
  { immediate: true }
)

watch(
  [() => props.scriptType, () => scriptTypeOptions.value],
  ([current, options]) => {
    if (props.flowEditMode) {
      ensureEnumSelection(current, options, (v) => emit('update:scriptType', v), normalizeScriptTypeValue)
    }
  },
  { immediate: true }
)

watch(
  [() => props.creationMode, () => creationModeOptions.value],
  ([current, options]) => {
    if (props.flowEditMode) {
      ensureEnumSelection(current, options, (v) => emit('update:creationMode', v), normalizeCreationModeValue)
    }
  },
  { immediate: true }
)

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      leftPanelReady.value = false
      return
    }
    if (props.flowEditMode || props.pageLayout) {
      leftPanelReady.value = true
      return
    }
    leftPanelReady.value = false
    await nextTick()
    await initNewProjectLeftPanel()
    await nextTick()
    leftPanelReady.value = true
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.create-first-step-form {
  display: grid;
  grid-template-columns: 324px 1fr;
  gap: 16px;
  min-height: 0;
}

.create-first-step-form--page {
  flex: 1;
  min-height: 0;
  height: 100%;
  grid-template-columns: minmax(280px, 340px) 1fr;
  align-content: stretch;
}

.left-panel,
.right-panel {
  border: 1px solid rgba(74, 231, 253, 0.22);
  background: rgba(8, 12, 22, 0.72);
  border-radius: 10px;
  box-sizing: border-box;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.create-first-step-form--page .left-panel,
.create-first-step-form--page .right-panel {
  border-color: rgba(74, 231, 253, 0.15);
  background: rgba(6, 10, 18, 0.55);
  height: 100%;
}

.content_box {
  padding: 10px 14px 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.head_box {
  height: 40px;
  width: 100%;
  background: rgba(32, 36, 52, 0.85);
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 16px;
  border-bottom: 1px solid rgba(74, 231, 253, 0.2);
  flex-shrink: 0;

  .block-title {
    font-size: 15px;
    margin-bottom: 0;
    line-height: 22px;
    color: var(--home-text, #e6edf3);
    font-weight: 600;
  }
}

.field-group {
  margin-bottom: 14px;

  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .chip {
      border: 1px solid rgba(74, 231, 253, 0.25);
      background: rgba(255, 255, 255, 0.02);
      color: var(--home-muted, #8e97a5) !important;
      border-radius: 6px;
      padding: 0 10px;
      cursor: pointer;
      font-size: 12px;
      line-height: 26px;
      box-sizing: border-box;
      transition: all 0.2s ease;

      &.is-disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
      }
    }

    .chip.active,
    .chip:hover {
      color: var(--home-accent, #4ae7fd) !important;
      border-color: var(--home-accent, #4ae7fd);
      background: rgba(74, 231, 253, 0.08);
    }
  }

  .name-input-wrap {
    position: relative;

    .name-input {
      width: 100%;
      height: 36px;
      border-radius: 6px;
      border: 1px solid rgba(74, 231, 253, 0.15);
      background: rgba(0, 0, 0, 0.35);
      color: var(--home-text, #e6edf3) !important;
      padding: 0 58px 0 12px;
      font-size: 14px;
      line-height: 20px;
      outline: none;
      transition: border-color 0.2s ease;

      &:focus {
        border-color: rgba(74, 231, 253, 0.45);
      }
    }

    .count-text {
      position: absolute;
      right: 10px;
      top: 8px;
      font-size: 12px;
      color: var(--home-muted, #8e97a5) !important;
    }
  }

  .ratio-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;

    .ratio-item {
      transition: all 0.2s ease;

      span {
        color: var(--home-muted, #8e97a5) !important;
      }
    }

    .ratio-item:hover,
    .ratio-item.active {
      border-color: var(--home-accent, #4ae7fd);
      background: rgba(74, 231, 253, 0.06);

      span {
        color: var(--home-accent, #4ae7fd) !important;
      }
    }
  }
}

.field-label {
  display: block;
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--home-text, #e6edf3);
  font-weight: 500;
}

.ratio-item {
  border: 1px solid rgba(74, 231, 253, 0.25);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 5px 6px;
  cursor: pointer;
  min-height: 28px;
  font-size: 12px;
  line-height: 16px;
}

.ratio-item img {
  width: 16px;
  height: 16px;
}

.right-panel :deep(.global-setting) {
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.right-panel :deep(.setting-sections) {
  gap: 16px;
}

.right-panel :deep(.section-title) {
  font-size: 14px;
  margin-bottom: 10px;
}

.right-panel :deep(.styles-grid) {
  grid-template-columns: repeat(auto-fill, minmax(106px, 0fr));
  gap: 8px;
}

.right-panel :deep(.style-card) {
  aspect-ratio: auto;
  width: 107px;
  height: 107px;
}

.right-panel :deep(.style-card.add-style) {
  border-style: dashed;
  border-color: rgba(74, 231, 253, 0.3);
  background: #151724;

  span {
    color: #8e97a5 !important;
  }

  :deep(.add-text) {
    color: #8e97a5 !important;
  }

  :deep(.add-icon) {
    color: #8e97a5 !important;
  }

  :deep(.add-icon svg),
  :deep(.add-icon svg path) {
    fill: currentColor !important;
  }
}

.dict-placeholder {
  margin: 0 0 8px;
  font-size: 12px;
  color: #8e97a5;
}
</style>
