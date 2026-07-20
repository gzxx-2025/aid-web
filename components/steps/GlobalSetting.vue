<template>
  <div class="global-setting create-step-global-setting">
    <!-- <div class="content-header">
      <p class="step-description-text">{{ description }}</p>
    </div> -->

    <div class="setting-sections">
      <!-- 选择画面比例 -->
      <div v-if="!styleLibraryOnly" class="setting-section">
        <h3 class="section-title">选择画面比例</h3>
        <p v-if="!dictLoaded" class="dict-placeholder">加载中…</p>
        <p v-else-if="!aspectRatios.length" class="dict-placeholder">暂无数据</p>
        <div v-else class="option-group">
          <div
            v-for="ratio in aspectRatios"
            :key="ratio.value"
            :class="['option-card', { active: modelValue.aspectRatio === ratio.value }]"
            @click="updateValue('aspectRatio', ratio.value)"
          >
            <div class="option-checkbox">
              <CheckOutlined v-if="modelValue.aspectRatio === ratio.value" class="check-icon" />
            </div>
            <span class="option-label">{{ ratio.label }}</span>
          </div>
        </div>
      </div>

      <!-- 选择剧本类型 -->
      <div v-if="!styleLibraryOnly" class="setting-section">
        <h3 class="section-title">选择剧本类型</h3>
        <p v-if="!dictLoaded" class="dict-placeholder">加载中…</p>
        <p v-else-if="!scriptTypes.length" class="dict-placeholder">暂无数据</p>
        <div v-else class="option-group">
          <div
            v-for="type in scriptTypes"
            :key="type.value"
            :class="['option-card', { active: modelValue.scriptType === type.value }]"
            @click="updateValue('scriptType', type.value)"
          >
            <span class="option-label">{{ type.label }}</span>
          </div>
        </div>
      </div>

      <!-- 选择模型策略 -->
      <div v-if="!styleLibraryOnly" class="setting-section">
        <h3 class="section-title">选择模型策略</h3>
        <p v-if="!dictLoaded" class="dict-placeholder">加载中…</p>
        <p v-else-if="!modelStrategies.length" class="dict-placeholder">暂无数据</p>
        <div v-else class="option-group">
          <div
            v-for="strategy in modelStrategies"
            :key="strategy.value"
            :class="['option-card', { active: modelValue.modelStrategy === strategy.value }]"
            @click="updateValue('modelStrategy', strategy.value)"
          >
            <span class="option-label">{{ strategy.label }}</span>
          </div>
        </div>
      </div>

      <!-- 选择创作模式 -->
      <div v-if="!styleLibraryOnly" class="setting-section">
        <h3 class="section-title">
          选择创作模式
          <InfoCircleOutlined class="info-icon" />
        </h3>
        <p v-if="!dictLoaded" class="dict-placeholder">加载中…</p>
        <p v-else-if="!creationModes.length" class="dict-placeholder">暂无数据</p>
        <div v-else class="option-group">
          <div
            v-for="mode in creationModes"
            :key="mode.value"
            :class="['option-card', { active: modelValue.creationMode === mode.value }]"
            @click="updateValue('creationMode', mode.value)"
          >
            <span class="option-label">{{ mode.label }}</span>
          </div>
        </div>
      </div>

      <!-- 选择画面风格 -->
      <div class="setting-section">
        <!-- <h3 class="section-title">
          选择画面风格
          <InfoCircleOutlined class="info-icon" />
        </h3> -->

        <!-- 已选风格 -->
        <div v-if="modelValue.selectedStyle" class="selected-style">
          <div class="style-card selected">
            <img
              v-if="modelValue.selectedStyle.thumbnail"
              :src="modelValue.selectedStyle.thumbnail"
              :alt="modelValue.selectedStyle.name"
            />
            <div v-else class="style-thumb-placeholder selected-style-placeholder">
              {{ (modelValue.selectedStyle.name || '风').charAt(0) }}
            </div>
            <div class="style-overlay">
              <span class="style-name">{{ modelValue.selectedStyle.name }}</span>
            </div>
          </div>
        </div>

        <!-- 我的风格库 -->
        <div class="my-styles">
          <h4 class="subsection-title title-one">我的风格库</h4>
          <div class="styles-grid">
            <div class="style-card add-style" @click="openCreateStyleModal">
              <PlusOutlined class="add-icon" />
              <span class="add-text">添加风格</span>
            </div>
          </div>
        </div>

        <!-- 精选风格库 -->
        <div class="featured-styles">
          <div class="subsection-header">
            <h4 class="subsection-title">精选风格库</h4>
            <a class="collapse-link" @click="toggleFeaturedStyles">
              {{ isFeaturedExpanded ? '收起' : '展开' }}
            </a>
          </div>
          <p v-if="!stylesLoaded" class="dict-placeholder">加载中…</p>
          <p v-else-if="!mergedStyleList.length" class="dict-placeholder">暂无数据</p>
          <div v-else class="styles-grid">
            <div
              v-for="style in displayedFeaturedStyles"
              :key="style.id"
              :class="[
                'style-card',
                { active: modelValue.selectedStyle?.id === style.id, featured: style.featured }
              ]"
              @click="selectStyle(style)"
            >
              <span v-if="style.featured" class="featured-badge">精选</span>

              <img v-if="style.thumbnail" :src="style.thumbnail" :alt="style.name" />
              <div v-else class="style-thumb-placeholder">{{ (style.name || '风').charAt(0) }}</div>
              <div class="style-overlay">
                {{ style.name }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <a-modal
      v-model:open="styleFormOpen"
      :footer="null"
      width="50%"
      wrap-class-name="create-flow-modal"
      @cancel="closeStyleFormModal"
    >
      <template #title>
        <ModalTitleWatermark title="新增风格" watermark="STYLE" />
      </template>

      <div class="asset-form-modal">
        <a-form layout="vertical" class="asset-form-modal__grid">
          <a-form-item label="资产类型" required class="asset-form-item asset-form-item--half">
            <a-select
              v-model:value="styleForm.assetType"
              disabled
              placeholder="类型"
              :options="styleTypeSelectOptions"
            />
          </a-form-item>
          <a-form-item label="资产名称" required class="asset-form-item asset-form-item--half">
            <a-input v-model:value="styleForm.assetName" maxlength="100" placeholder="请输入" />
          </a-form-item>
          <a-form-item label="特征描述" class="asset-form-item asset-form-item--full">
            <a-textarea
              v-model:value="styleForm.personalityDesc"
              :rows="4"
              maxlength="500"
              placeholder="请输入"
            />
          </a-form-item>
          <a-form-item label="提示词" class="asset-form-item asset-form-item--full">
            <a-textarea
              v-model:value="styleForm.promptText"
              :rows="4"
              maxlength="500"
              placeholder="请输入"
            />
          </a-form-item>
          <a-form-item label="图片地址" class="asset-form-item asset-form-item--half">
            <a-input v-model:value="styleForm.imageUrl" maxlength="500" placeholder="请输入URL" />
          </a-form-item>
          <a-form-item label="备注" class="asset-form-item asset-form-item--half">
            <a-input v-model:value="styleForm.remark" maxlength="500" placeholder="请输入" />
          </a-form-item>
        </a-form>

        <div class="asset-form-modal__footer">
          <a-button @click="closeStyleFormModal">
            <div class="text-gradient">取消</div>
          </a-button>
          <a-button type="primary" :loading="creatingStyle" @click="submitStyleForm">
            确定
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { CheckOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { GlobalSettingData } from '~/types'
import { usePromptDictionary, resolveSelectedStyle, type StyleLibraryCard } from '~/composables/usePromptDictionary'
import {
  userAssetCustomCreate,
  userAssetCustomList,
  userAssetOfficialQuery
} from '~/utils/businessApi'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'

interface Props {
  modelValue: GlobalSettingData
  description?: string
  styleLibraryOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  description: '设定作品的基础参数和风格',
  styleLibraryOnly: false
})

const styleLibraryOnly = computed(() => props.styleLibraryOnly)

const emit = defineEmits<{
  'update:modelValue': [value: GlobalSettingData]
}>()

const VALID_ASPECT = new Set<string>(['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'])

const {
  ensureLoaded,
  loaded: dictLoaded,
  aspectRatioEnumOptions,
  scriptTypeEnumOptions,
  creationModeEnumOptions,
  genModeEnumOptions
} = usePromptDictionary()

const aspectRatios = computed(() =>
  aspectRatioEnumOptions.value
    .filter((r) => VALID_ASPECT.has(r.value))
    .map((r) => ({
      value: r.value as GlobalSettingData['aspectRatio'],
      label: r.label
    }))
)

const scriptTypes = computed(() =>
  scriptTypeEnumOptions.value.map((r) => ({
    value: r.value as GlobalSettingData['scriptType'],
    label: r.label
  }))
)

const creationModes = computed(() =>
  creationModeEnumOptions.value.map((r) => ({
    value: r.value as GlobalSettingData['creationMode'],
    label: r.label
  }))
)

const modelStrategies = computed(() =>
  genModeEnumOptions.value.map((r) => ({
    value: r.value as GlobalSettingData['modelStrategy'],
    label: r.label
  }))
)

const featuredStylesLoaded = ref(false)
const customStylesLoaded = ref(false)
const stylesLoaded = computed(() => featuredStylesLoaded.value && customStylesLoaded.value)
const officialStyles = ref<StyleLibraryCard[]>([])
const customStyles = ref<StyleLibraryCard[]>([])

const mergedStyleList = computed(() => [...customStyles.value, ...officialStyles.value])

const isFeaturedExpanded = ref(true)
const FEATURED_COLLAPSED_COUNT = 10
const displayedFeaturedStyles = computed(() =>
  isFeaturedExpanded.value
    ? mergedStyleList.value
    : mergedStyleList.value.slice(0, FEATURED_COLLAPSED_COUNT)
)

const styleFormOpen = ref(false)
const creatingStyle = ref(false)
const styleForm = ref({
  assetType: 'style',
  assetName: '',
  personalityDesc: '',
  promptText: '',
  imageUrl: '',
  remark: ''
})

const styleTypeSelectOptions = computed(() => [{ value: 'style', label: '风格' }])

// 更新值
const updateValue = (key: keyof GlobalSettingData, value: any) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value
  })
}

// 选择风格：官方精选带 assetName + promptText，供创建作品写入 videoStyleType / videoStyleValue
const selectStyle = (style: {
  id: string
  name: string
  thumbnail: string
  assetName?: string
  promptText?: string | null
}) => {
  emit('update:modelValue', {
    ...props.modelValue,
    selectedStyle: {
      id: style.id,
      name: style.name,
      thumbnail: style.thumbnail,
      ...(style.assetName != null && style.assetName !== '' ? { assetName: style.assetName } : {}),
      ...(style.promptText != null ? { promptText: style.promptText } : {})
    }
  })
}

// 切换精选风格库显示
const toggleFeaturedStyles = () => {
  isFeaturedExpanded.value = !isFeaturedExpanded.value
}

function openCreateStyleModal() {
  if (creatingStyle.value) return
  styleForm.value = {
    assetType: 'style',
    assetName: '',
    personalityDesc: '',
    promptText: '',
    imageUrl: '',
    remark: ''
  }
  styleFormOpen.value = true
}

function closeStyleFormModal() {
  styleFormOpen.value = false
}

function validateStyleForm(): string | null {
  if (!styleForm.value.assetName.trim()) return '请填写资产名称'
  const imageUrl = styleForm.value.imageUrl.trim()
  if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) return '图片地址需为 http/https URL'
  return null
}

async function submitStyleForm() {
  const errText = validateStyleForm()
  if (errText) {
    message.warning(errText)
    return
  }
  creatingStyle.value = true
  try {
    const payload = {
      assetType: 'style',
      assetName: styleForm.value.assetName.trim(),
      personalityDesc: styleForm.value.personalityDesc.trim() || undefined,
      promptText: styleForm.value.promptText.trim() || undefined,
      imageUrl: styleForm.value.imageUrl.trim() || undefined,
      remark: styleForm.value.remark.trim() || undefined
    }
    const created = await userAssetCustomCreate(payload)
    styleFormOpen.value = false
    message.success('风格添加成功')

    await loadAllStyles(String(created.id))

    const newStyle = customStyles.value.find((s) => s.id === String(created.id))
    if (newStyle) {
      emit('update:modelValue', {
        ...props.modelValue,
        selectedStyle: {
          id: newStyle.id,
          name: newStyle.name,
          thumbnail: newStyle.thumbnail,
          assetName: newStyle.assetName,
          promptText: newStyle.promptText
        },
        myStyles: customStyles.value.map((s) => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail
        }))
      })
    } else {
      syncMyStylesFromCustom()
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '添加风格失败')
  } finally {
    creatingStyle.value = false
  }
}

function syncMyStylesFromCustom() {
  const mapped = customStyles.value.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail
  }))
  if (
    mapped.length === props.modelValue.myStyles.length &&
    mapped.every((s, i) => s.id === props.modelValue.myStyles[i]?.id)
  ) {
    return
  }
  emit('update:modelValue', {
    ...props.modelValue,
    myStyles: mapped
  })
}

watch(
  () => [props.modelValue.selectedStyle, mergedStyleList.value] as const,
  ([sel, list]) => {
    if (!sel || !list.length) return
    const n = resolveSelectedStyle(sel, list)
    if (n && n.id !== sel.id) {
      emit('update:modelValue', { ...props.modelValue, selectedStyle: n })
    }
  },
  { flush: 'post' }
)

onMounted(() => {
  void ensureLoaded()
  void loadAllStyles()
})

async function loadAllStyles(preferredCustomId?: string) {
  await Promise.all([loadCustomStyles(), loadOfficialStyles()])
  if (preferredCustomId) {
    moveCustomStyleToFront(preferredCustomId)
  }
  if (!props.modelValue.selectedStyle && mergedStyleList.value.length > 0) {
    const first = mergedStyleList.value[0]!
    emit('update:modelValue', {
      ...props.modelValue,
      selectedStyle: {
        id: first.id,
        name: first.name,
        thumbnail: first.thumbnail,
        ...(first.assetName != null && first.assetName !== '' ? { assetName: first.assetName } : {}),
        ...(first.promptText != null ? { promptText: first.promptText } : {})
      }
    })
  }
}

function moveCustomStyleToFront(id: string) {
  const idx = customStyles.value.findIndex((s) => s.id === id)
  if (idx <= 0) return
  const item = customStyles.value[idx]!
  customStyles.value = [item, ...customStyles.value.filter((s) => s.id !== id)]
}

async function loadCustomStyles() {
  customStylesLoaded.value = false
  try {
    const { list } = await userAssetCustomList({ assetType: 'style', pageNum: 1, pageSize: 200 })
    customStyles.value = list.map((row, index) => ({
      id: String(row.id),
      name: row.assetName || `我的风格${index + 1}`,
      assetName: row.assetName || '',
      promptText: row.promptText ?? '',
      thumbnail: row.imageUrl || '',
      featured: false
    }))
    syncMyStylesFromCustom()
  } catch {
    customStyles.value = []
  } finally {
    customStylesLoaded.value = true
  }
}

async function loadOfficialStyles() {
  featuredStylesLoaded.value = false
  try {
    const rows = await userAssetOfficialQuery({ assetType: 'style' })
    const mapped = rows.map((row, index) => ({
      id: String(row.id),
      name: row.assetName || `风格${index + 1}`,
      assetName: row.assetName || '',
      promptText: row.promptText ?? '',
      thumbnail: row.imageUrl || '',
      featured: index < 3
    }))
    officialStyles.value = mapped
  } catch {
    officialStyles.value = []
  } finally {
    featuredStylesLoaded.value = true
  }
}
</script>

<style scoped>
.global-setting {
  padding: 1.5rem;
}

.content-header {
  margin-bottom: 2rem;
}

.dict-placeholder {
  margin: 0.5rem 0 0;
  color: var(--home-muted, #8e97a5);
  font-size: 0.9375rem;
}

.step-description-text {
  color: var(--home-muted, #8e97a5);
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
  font-weight: 500;
}

.setting-sections {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  padding: 8px 12px 58px;
}

.setting-section {
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-icon {
  font-size: 1rem;
  color: var(--home-cyan, #4ae7fd);
  cursor: help;
}

.option-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.option-card {
  padding: 0.875rem 1.5rem;
  border: 2px solid rgba(74, 231, 253, 0.22);
  border-radius: var(--radius-lg);
  background: rgba(12, 16, 24, 0.88);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 140px;
  justify-content: center;
}

.option-card:hover {
  border-color: rgba(74, 231, 253, 0.45);
  background: rgba(14, 89, 250, 0.12);
}

.option-card.active {
  border-color: rgba(0, 171, 216, 0.75);
  background: rgba(14, 89, 250, 0.18);
  color: var(--home-cyan, #4ae7fd);
  font-weight: 600;
}

.option-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(74, 231, 253, 0.35);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.option-card.active .option-checkbox {
  border-color: rgba(0, 171, 216, 0.9);
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
}

.check-icon {
  color: white;
  font-size: 0.875rem;
}

.option-label {
  font-size: 0.9375rem;
  color: var(--home-text, #e6edf3);
  font-weight: 500;
}

.option-card.active .option-label {
  color: var(--home-cyan, #4ae7fd);
}
.content_box {
  padding: 8px 16px;
}
/* 风格选择区域 */
.subsection-title {
  font-size: 14px;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0;
}
.title-one {
  margin-bottom: 8px;
}
.head_box {
  padding-left: 16px;
  height: 40px;
  width: 100%;
  background: rgba(32, 36, 52, 1);
  display: flex;
  align-items: center;
  gap: 6px;
}
.subsection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.collapse-link {
  color: var(--home-cyan, #4ae7fd);
  cursor: pointer;
  font-size: 0.875rem;
  transition: color 0.2s ease;
}

.collapse-link:hover {
  color: #7ef0ff;
}

.selected-style {
  margin-bottom: 2rem;
}

/* 已选风格缩略图：固定 100x100，避免撑满容器 */
.selected-style .style-card.selected {
  width: 100px;
  height: 100px;
  aspect-ratio: auto;
}

.selected-style .style-card.selected img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.styles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1.25rem;
}

.style-card {
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid rgba(74, 231, 253, 0.2);
  background: rgba(12, 16, 24, 0.9);
}

.style-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  border-color: rgba(74, 231, 253, 0.45);
}

.style-card.active {
  border-color: rgba(0, 171, 216, 0.85);
  box-shadow: 0 0 0 3px rgba(14, 89, 250, 0.25);
}

.style-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.style-card .style-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 231, 253, 0.08);
  color: var(--home-cyan, #4ae7fd);
  font-size: 1.5rem;
  font-weight: 700;
}

.style-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(18, 18, 18, 0.4);
  width: 100%;
  line-height: 28px;
  padding: 0 6px;
  text-align: center;
}

.style-name {
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
}

.featured-badge {
  position: absolute;
  top: 2px;
  left: 4px;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  color: white;
  font-size: 0.75rem;
  line-height: 1;
  padding: 0.3rem 0.45rem;
  border-radius: 6px;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(14, 89, 250, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 2;
  pointer-events: none;
}

.style-card.add-style {
  border: 2px dashed rgba(74, 231, 253, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(12, 16, 24, 0.55);
}

.style-card.add-style:hover {
  border-color: rgba(74, 231, 253, 0.55);
  background: rgba(14, 89, 250, 0.12);
}

.add-icon {
  font-size: 2rem;
  color: rgba(74, 231, 253, 0.45);
}

.add-text {
  color: var(--home-muted, #8e97a5);
  font-size: 0.875rem;
  font-weight: 500;
}

.my-styles {
  margin-bottom: 16px;
}

.asset-form-modal {
  padding: 8px 0 0;
}

.asset-form-modal__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
}

.asset-form-item {
  margin-bottom: 14px;
}

.asset-form-item--half {
  grid-column: span 1;
}

.asset-form-item--full {
  grid-column: 1 / -1;
}

.asset-form-modal__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.asset-form-modal :deep(.ant-form-item-label > label) {
  color: rgba(220, 231, 245, 0.85);
  font-size: 14px;
  line-height: 20px;
}

.asset-form-modal :deep(.ant-input),
.asset-form-modal :deep(.ant-input-affix-wrapper),
.asset-form-modal :deep(.ant-input-textarea textarea),
.asset-form-modal :deep(.ant-select-selector) {
  background: rgba(8, 11, 18, 0.96) !important;
  border: none !important;
  color: #e6edf3 !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}

.asset-form-modal :deep(input.ant-input),
.asset-form-modal :deep(.ant-input-affix-wrapper) {
  height: 40px;
}

.asset-form-modal :deep(.ant-select-selector) {
  min-height: 40px !important;
  height: 40px !important;
  display: flex;
  align-items: center;
}

.asset-form-modal :deep(.ant-select-selection-item),
.asset-form-modal :deep(.ant-select-selection-placeholder) {
  line-height: 40px !important;
}

.asset-form-modal :deep(.ant-input-textarea textarea) {
  min-height: 110px !important;
  height: 110px !important;
  line-height: 22px;
  padding: 10px 12px;
  resize: none;
}

.asset-form-modal :deep(.ant-input:focus),
.asset-form-modal :deep(.ant-input-focused),
.asset-form-modal :deep(.ant-input-affix-wrapper:focus),
.asset-form-modal :deep(.ant-input-affix-wrapper-focused),
.asset-form-modal :deep(.ant-input-textarea textarea:focus),
.asset-form-modal :deep(.ant-select-focused .ant-select-selector) {
  border: none !important;
  box-shadow: none !important;
}

.asset-form-modal :deep(.ant-input::placeholder),
.asset-form-modal :deep(.ant-input-textarea textarea::placeholder),
.asset-form-modal :deep(.ant-select-selection-placeholder) {
  color: #7f8ba0 !important;
}

.asset-form-modal :deep(.ant-select-arrow) {
  color: #8fa3c0;
}

.featured-styles {
  padding: 8px 0;
}

@media (max-width: 768px) {
  .option-group {
    flex-direction: column;
  }

  .option-card {
    width: 100%;
  }

  .styles-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 1rem;
  }

  .asset-form-modal__grid {
    grid-template-columns: 1fr;
    column-gap: 0;
  }

  .asset-form-item--half,
  .asset-form-item--full {
    grid-column: 1 / -1;
  }
}
</style>
