<template>
  <div
    ref="styleScrollRootRef"
    class="global-setting create-step-global-setting"
    @scroll="onFeaturedStylesScroll"
  >
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
        <p v-if="styleLocked" class="style-lock-hint">
          当前项目已生成角色、场景或道具，风格已锁定；其它项目配置仍可正常保存。
        </p>
        <!-- 我的风格库 -->
        <div class="my-styles">
          <h4 class="subsection-title title-one">我的风格库</h4>
          <div class="styles-grid">
            <div
              v-if="selectedStyleShortcut"
              class="style-card active selected-style-shortcut"
              role="button"
              tabindex="0"
              aria-label="定位当前选择的风格"
              @click="locateSelectedStyle"
              @keydown.enter.prevent="locateSelectedStyle"
              @keydown.space.prevent="locateSelectedStyle"
            >
              <span class="current-style-badge">当前风格</span>
              <span class="style-selected-mark style-selected-mark--visible" aria-hidden="true">
                <img :src="dialogSelectSelIcon" alt="" class="style-selected-mark__icon" />
              </span>
              <span class="style-active-ring" aria-hidden="true" />

              <div class="style-thumb">
                <ShimmerImage
                  v-if="selectedStyleThumbnail || selectedStyleImageLoading"
                  :src="selectedStyleThumbnail ? resolveStyleThumbSrc(selectedStyleThumbnail) : ''"
                  :alt="selectedStyleShortcut.name"
                  wrapper-class="style-thumb-shimmer"
                  img-class="style-thumb-img"
                  object-fit="cover"
                  reveal-direction="fade"
                  :min-shimmer-ms="280"
                />
                <div v-else class="style-thumb-placeholder">
                  <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--md" />
                </div>
              </div>
              <div class="style-overlay">
                <EllipsisTooltip :title="selectedStyleShortcut.name" />
              </div>
            </div>
          </div>
        </div>

        <!-- 精选风格库 -->
        <div
          class="featured-styles"
          :class="{ 'featured-styles--collapsed': !isFeaturedExpanded }"
        >
          <div class="subsection-header">
            <h4 class="subsection-title">精选风格库</h4>
            <a class="collapse-link" @click="toggleFeaturedStyles">
              {{ isFeaturedExpanded ? '收起' : '展开' }}
            </a>
          </div>
          <p v-if="!stylesLoaded" class="dict-placeholder">加载中…</p>
          <p v-else-if="styleLoadError" class="dict-placeholder">加载失败，请稍后重试</p>
          <p v-else-if="!mergedStyleList.length" class="dict-placeholder">暂无数据</p>
          <TransitionGroup
            v-if="stylesLoaded"
            name="style-card-append"
            tag="div"
            class="styles-grid"
            :class="{ 'styles-grid--appending': styleLoadingMore }"
          >
            <div
              key="add-style"
              :class="['style-card', 'add-style', { 'is-style-locked': styleLocked }]"
              role="button"
              :tabindex="styleLocked ? -1 : 0"
              :aria-disabled="styleLocked"
              :aria-label="styleLocked ? '风格已锁定，无法添加风格' : '添加风格'"
              @click="openCreateStyleModal"
              @keydown.enter.prevent="openCreateStyleModal"
              @keydown.space.prevent="openCreateStyleModal"
            >
              <PlusOutlined class="add-icon" />
              <span class="add-text">添加风格</span>
            </div>
            <div
              v-for="style in displayedFeaturedStyles"
              :key="style.id"
              :data-style-card-id="style.id"
              :class="[
                'style-card',
                {
                  active: isCurrentStyle(style),
                  featured: style.featured,
                  'is-style-locked': styleLocked && !isCurrentStyle(style),
                  'style-card--located': locatedStyleId === style.id
                }
              ]"
              :aria-disabled="styleLocked && !isCurrentStyle(style)"
              @click="selectStyle(style)"
            >
              <span v-if="style.featured" class="featured-badge">精选</span>
              <span
                class="style-selected-mark"
                :class="{ 'style-selected-mark--visible': isCurrentStyle(style) }"
                aria-hidden="true"
              >
                <img :src="dialogSelectSelIcon" alt="" class="style-selected-mark__icon" />
              </span>
              <span class="style-active-ring" aria-hidden="true" />

              <div class="style-thumb">
                <ShimmerImage
                  v-if="style.thumbnail"
                  :key="`${stylesLoadRevision}-${style.id}`"
                  :src="resolveStyleThumbSrc(style.thumbnail)"
                  :alt="style.name"
                  wrapper-class="style-thumb-shimmer"
                  img-class="style-thumb-img"
                  object-fit="cover"
                  reveal-direction="fade"
                  :min-shimmer-ms="280"
                />
                <div v-else class="style-thumb-placeholder">
                  <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--md" />
                </div>
              </div>
              <div class="style-overlay">
                <EllipsisTooltip :title="style.name" />
              </div>
            </div>
          </TransitionGroup>
          <InfiniteScrollLoadFooter
            v-if="stylesLoaded && isFeaturedExpanded && mergedStyleList.length"
            :loading="styleLoadingMore"
            :has-more="styleHasMore"
            :has-items="mergedStyleList.length > 0"
            end-text="已加载全部风格"
          />
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
          <a-form-item class="asset-form-item asset-form-item--full asset-form-item--upload">
            <div class="style-cover-upload style-cover-upload--header">
              <input
                ref="styleCoverInputRef"
                type="file"
                accept="image/*"
                hidden
                @change="onStyleCoverFileChange"
              />
              <button
                type="button"
                class="style-cover-upload__box"
                :class="{ 'style-cover-upload__box--filled': !!styleForm.imageUrl }"
                :disabled="styleCoverUploading"
                @click="triggerStyleCoverUpload"
              >
                <ShimmerImage
                  v-if="styleForm.imageUrl"
                  :src="styleForm.imageUrl"
                  alt="风格图片"
                  wrapper-class="style-cover-upload__preview"
                  img-class="style-cover-upload__img"
                  object-fit="cover"
                  reveal-direction="fade"
                  :min-shimmer-ms="280"
                />
                <span v-else-if="styleCoverUploading" class="style-cover-upload__hint">上传中…</span>
                <span v-else class="style-cover-upload__placeholder">
                  <PlusOutlined class="style-cover-upload__icon" />
                  <span>上传图片</span>
                </span>
              </button>
              <div class="style-cover-upload__meta">
                <p class="style-cover-upload__tip">支持 JPG、PNG，最大 10MB</p>
                <a
                  v-if="styleForm.imageUrl"
                  class="style-cover-upload__remove"
                  @click.prevent="clearStyleCover"
                >
                  移除图片
                </a>
              </div>
            </div>
          </a-form-item>
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
          <a-form-item label="提示词" required class="asset-form-item asset-form-item--full">
            <a-textarea
              v-model:value="styleForm.promptText"
              :rows="4"
              placeholder="请输入用于生成画面的风格提示词"
            />
          </a-form-item>
          <a-form-item label="备注" class="asset-form-item asset-form-item--full">
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
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { CheckOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons-vue'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import { message } from 'ant-design-vue'
import type { GlobalSettingData } from '~/types'
import {
  usePromptDictionary,
  resolveSelectedStyle,
  buildStyleLibraryCardId,
  type StyleLibraryCard
} from '~/composables/usePromptDictionary'
import { resolveProjectStyleReference } from '~/utils/buildProjectVideoStyleFields'
import { useStyleLibraryMergedPagination } from '~/composables/useStyleLibraryMergedPagination'
import { userAssetCustomCreate } from '~/utils/businessApi'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import EllipsisTooltip from '~/components/common/EllipsisTooltip.vue'
import InfiniteScrollLoadFooter from '~/components/common/InfiniteScrollLoadFooter.vue'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import { emptyImageIconUrl } from '~/utils/emptyImageIcon'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'
import { buildRetinaDisplayImageUrl } from '~/utils/displayImageUrl'
import { isSameProjectStyleSelection } from '~/utils/projectStyleSelection'

interface Props {
  modelValue: GlobalSettingData
  description?: string
  styleLibraryOnly?: boolean
  /** 风格卡片 CSS 宽度，用于请求 Retina 清晰图 */
  styleThumbSizePx?: number
}

const props = withDefaults(defineProps<Props>(), {
  description: '设定作品类型、画幅与创作策略',
  styleLibraryOnly: false,
  styleThumbSizePx: 160
})

const styleLibraryOnly = computed(() => props.styleLibraryOnly)
const styleLocked = computed(() => props.modelValue.styleLocked === true)

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

const styleScrollRootRef = ref<HTMLElement | null>(null)
const {
  customStyles,
  officialStyles,
  mergedStyleList,
  loading: styleListLoading,
  loadingMore: styleLoadingMore,
  initialLoaded: styleInitialLoaded,
  loadError: styleLoadError,
  hasMore: styleHasMore,
  reload: reloadStyleLibrary,
  loadNextPage: loadNextStylePage,
  moveCustomStyleToFront,
  onScrollWhenExpanded
} = useStyleLibraryMergedPagination(styleScrollRootRef)

const stylesLoaded = computed(() => styleInitialLoaded.value && !styleListLoading.value)
const stylesLoadRevision = ref(0)

const isFeaturedExpanded = ref(true)
/** 折叠态保持 6 列 × 2 行；首格由“添加风格”占用。 */
const FEATURED_COLLAPSED_STYLE_COUNT = 11
const displayedFeaturedStyles = computed(() =>
  isFeaturedExpanded.value
    ? mergedStyleList.value
    : mergedStyleList.value.slice(0, FEATURED_COLLAPSED_STYLE_COUNT)
)

type SelectedStyleValue = NonNullable<GlobalSettingData['selectedStyle']>

function findStyleSelectionInLoadedList(
  selection: SelectedStyleValue
): StyleLibraryCard | undefined {
  const resolved = resolveSelectedStyle(selection, mergedStyleList.value)
  if (!resolved) return undefined
  return mergedStyleList.value.find((style) => style.id === resolved.id)
}

const loadedSelectedStyle = computed(() => {
  const current = props.modelValue.selectedStyle
  return current ? findStyleSelectionInLoadedList(current) : undefined
})

const selectedStyleShortcut = computed(() => {
  const current = props.modelValue.selectedStyle
  if (!current) return null
  return loadedSelectedStyle.value ?? current
})

const selectedStyleImageHydrating = ref(false)
const selectedStyleImageLoading = computed(() => Boolean(
  props.modelValue.selectedStyle &&
  !loadedSelectedStyle.value &&
  (
    !stylesLoaded.value ||
    selectedStyleImageHydrating.value ||
    (styleHasMore.value && !styleLoadError.value)
  )
))
const selectedStyleThumbnail = computed(() => {
  const loaded = loadedSelectedStyle.value
  if (loaded) return String(loaded.thumbnail || '').trim()

  const current = props.modelValue.selectedStyle
  if (!current) return ''
  // 项目详情只携带公开风格快照时，thumbnail 可能是项目封面；必须等风格库真实记录补齐。
  if (!resolveProjectStyleReference(current) && String(current.promptText || '').trim()) return ''
  return String(current.thumbnail || '').trim()
})

const locatedStyleId = ref<string | null>(null)
let locateRequestId = 0
let selectedStyleLoadRequestId = 0
let locatedStyleTimer: ReturnType<typeof setTimeout> | null = null

function onFeaturedStylesScroll() {
  onScrollWhenExpanded(isFeaturedExpanded.value)
}

function findCurrentStyleInLoadedList(): StyleLibraryCard | undefined {
  return loadedSelectedStyle.value
}

async function waitForStylePageIdle(): Promise<void> {
  if (!styleListLoading.value && !styleLoadingMore.value) return
  await new Promise<void>((resolve) => {
    const stop = watch(
      [styleListLoading, styleLoadingMore],
      ([loading, loadingMore]) => {
        if (loading || loadingMore) return
        stop()
        resolve()
      },
      { flush: 'post' }
    )
  })
}

function scrollStyleCardIntoView(styleId: string): boolean {
  const root = styleScrollRootRef.value
  if (!root) return false
  const card = Array.from(root.querySelectorAll<HTMLElement>('[data-style-card-id]'))
    .find((element) => element.dataset.styleCardId === styleId)
  if (!card) return false

  const rootRect = root.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  const centeredTop = root.scrollTop + cardRect.top - rootRect.top
    - (root.clientHeight - cardRect.height) / 2
  root.scrollTo({ top: Math.max(0, centeredTop), behavior: 'smooth' })

  locatedStyleId.value = styleId
  if (locatedStyleTimer) clearTimeout(locatedStyleTimer)
  locatedStyleTimer = setTimeout(() => {
    if (locatedStyleId.value === styleId) locatedStyleId.value = null
  }, 2400)
  return true
}

/** 当前风格不在首屏时继续读取后续页，用真实风格记录补齐名称、图片和稳定资产身份。 */
async function ensureCurrentStyleLoaded(): Promise<StyleLibraryCard | undefined> {
  const selection = props.modelValue.selectedStyle
  if (!selection) return undefined

  const requestId = ++selectedStyleLoadRequestId
  selectedStyleImageHydrating.value = true
  try {
    await waitForStylePageIdle()
    if (requestId !== selectedStyleLoadRequestId) return undefined

    let target = findStyleSelectionInLoadedList(selection)
    while (!target && styleHasMore.value && !styleLoadError.value) {
      await loadNextStylePage()
      await waitForStylePageIdle()
      if (requestId !== selectedStyleLoadRequestId) return undefined
      target = findStyleSelectionInLoadedList(selection)
    }
    return target
  } finally {
    if (requestId === selectedStyleLoadRequestId) {
      selectedStyleImageHydrating.value = false
    }
  }
}

/** 展开精选库；目标尚未加载时继续翻页，加载到后定位同一条真实资产卡片。 */
async function locateSelectedStyle() {
  if (!props.modelValue.selectedStyle) return
  const requestId = ++locateRequestId
  isFeaturedExpanded.value = true
  await nextTick()
  const target = findCurrentStyleInLoadedList() ?? await ensureCurrentStyleLoaded()

  if (requestId !== locateRequestId) return
  if (!target) {
    message.warning(styleLoadError.value ? '风格加载失败，请稍后重试' : '未找到当前风格')
    return
  }

  await nextTick()
  if (!scrollStyleCardIntoView(target.id)) {
    message.warning('未找到当前风格')
  }
}

const styleFormOpen = ref(false)
const creatingStyle = ref(false)
const styleCoverUploading = ref(false)
const styleCoverInputRef = ref<HTMLInputElement | null>(null)
const styleForm = ref({
  assetType: 'style',
  assetName: '',
  personalityDesc: '',
  promptText: '',
  imageUrl: '',
  remark: ''
})

const styleTypeSelectOptions = computed(() => [{ value: 'style', label: '风格' }])

function resolveStyleThumbSrc(url: string): string {
  return buildRetinaDisplayImageUrl(url, props.styleThumbSizePx)
}

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
  assetId?: number
  sourceFlag?: 'official' | 'custom'
  assetName?: string
  promptText?: string | null
}) => {
  if (styleLocked.value && !isCurrentStyle(style)) {
    message.warning('已有资产，无法切换风格')
    return
  }
  if (isCurrentStyle(style)) return
  selectedStyleLoadRequestId += 1
  selectedStyleImageHydrating.value = false
  emit('update:modelValue', {
    ...props.modelValue,
    selectedStyle: {
      id: style.id,
      name: style.name,
      thumbnail: style.thumbnail,
      ...(style.assetId != null ? { assetId: style.assetId } : {}),
      ...(style.sourceFlag ? { sourceFlag: style.sourceFlag } : {}),
      ...(style.assetName != null && style.assetName !== '' ? { assetName: style.assetName } : {}),
      ...(style.promptText != null ? { promptText: style.promptText } : {})
    },
    style: style.name,
    styleSelectionTouched: true
  })
}

function isCurrentStyle(style: Pick<StyleLibraryCard, 'id' | 'assetId' | 'sourceFlag' | 'name' | 'assetName' | 'promptText'>): boolean {
  const current = props.modelValue.selectedStyle
  if (!current) return false
  if (resolveProjectStyleReference(current)) {
    return isSameProjectStyleSelection(current, style)
  }
  // 旧项目缺少稳定来源或资产 ID 时，只允许唯一命中的卡片显示为当前风格。
  const legacyMatches = mergedStyleList.value.filter((item) =>
    isSameProjectStyleSelection(current, item)
  )
  return legacyMatches.length === 1 && legacyMatches[0]?.id === style.id
}

// 切换精选风格库显示
const toggleFeaturedStyles = () => {
  isFeaturedExpanded.value = !isFeaturedExpanded.value
  if (isFeaturedExpanded.value) {
    // 展开后内容可能仍贴底，补一次触底检测
    onScrollWhenExpanded(true)
  }
}

function openCreateStyleModal() {
  if (styleLocked.value) {
    message.warning('风格已锁定，无法添加风格')
    return
  }
  if (creatingStyle.value) return
  styleCoverUploading.value = false
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
  styleCoverUploading.value = false
  if (styleCoverInputRef.value) styleCoverInputRef.value.value = ''
}

function triggerStyleCoverUpload() {
  if (styleCoverUploading.value) return
  styleCoverInputRef.value?.click()
}

function clearStyleCover() {
  styleForm.value.imageUrl = ''
  if (styleCoverInputRef.value) styleCoverInputRef.value.value = ''
}

async function onStyleCoverFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    message.warning('只能上传图片文件')
    return
  }
  if (file.size / 1024 / 1024 >= 10) {
    message.warning('图片大小不能超过 10MB')
    return
  }

  styleCoverUploading.value = true
  try {
    const url = await uploadImageToOssWithToast(file)
    if (url) styleForm.value.imageUrl = url
  } finally {
    styleCoverUploading.value = false
  }
}

function validateStyleForm(): string | null {
  if (!styleForm.value.assetName.trim()) return '请填写资产名称'
  if (!styleForm.value.promptText.trim()) return '请填写风格提示词'
  return null
}

async function submitStyleForm() {
  if (styleLocked.value) {
    message.warning('风格已锁定，无法添加风格')
    styleFormOpen.value = false
    return
  }
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

    await loadAllStyles(buildStyleLibraryCardId('custom', created.id))

    const newStyleId = buildStyleLibraryCardId('custom', created.id)
    const newStyle = customStyles.value.find((s) => s.id === newStyleId)
    if (newStyle && !styleLocked.value) {
      emit('update:modelValue', {
        ...props.modelValue,
        selectedStyle: {
          id: newStyle.id,
          name: newStyle.name,
          thumbnail: newStyle.thumbnail,
          assetId: newStyle.assetId,
          sourceFlag: newStyle.sourceFlag,
          assetName: newStyle.assetName,
          promptText: newStyle.promptText
        },
        style: newStyle.name,
        styleSelectionTouched: true,
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

watch(
  customStyles,
  () => {
    syncMyStylesFromCustom()
  },
  { deep: true }
)

onMounted(() => {
  void ensureLoaded()
  void loadAllStyles()
})

onBeforeUnmount(() => {
  locateRequestId += 1
  selectedStyleLoadRequestId += 1
  selectedStyleImageHydrating.value = false
  if (locatedStyleTimer) clearTimeout(locatedStyleTimer)
})

async function loadAllStyles(preferredCustomId?: string) {
  await reloadStyleLibrary()
  stylesLoadRevision.value += 1
  if (preferredCustomId) {
    moveCustomStyleToFront(preferredCustomId)
  }
  syncMyStylesFromCustom()
  if (!preferredCustomId && props.modelValue.selectedStyle) {
    await ensureCurrentStyleLoaded()
  }
  // 新建/未选时默认精选风格库第一项；无精选时回退合并列表第一项
  const first = officialStyles.value[0] ?? mergedStyleList.value[0]
  if (!props.modelValue.selectedStyle && first) {
    emit('update:modelValue', {
      ...props.modelValue,
      selectedStyle: {
        id: first.id,
        name: first.name,
        thumbnail: first.thumbnail,
        ...(first.assetId != null ? { assetId: first.assetId } : {}),
        ...(first.sourceFlag ? { sourceFlag: first.sourceFlag } : {}),
        ...(first.assetName != null && first.assetName !== '' ? { assetName: first.assetName } : {}),
        ...(first.promptText != null ? { promptText: first.promptText } : {})
      }
    })
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

.styles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1.25rem;
}

.style-lock-hint {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid rgba(250, 173, 20, 0.38);
  border-radius: 6px;
  color: #ffd666;
  background: rgba(250, 173, 20, 0.08);
  font-size: 0.875rem;
  line-height: 1.5;
}

.style-card {
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition:
    border-color 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.38s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid rgba(74, 231, 253, 0.2);
  background: rgba(12, 16, 24, 0.9);
  isolation: isolate;
  will-change: transform, box-shadow;
}

.style-card:hover:not(.active) {
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
  border-color: rgba(74, 231, 253, 0.45);
  transform: translateY(-2px);
}

.style-card.is-style-locked {
  cursor: not-allowed;
  opacity: 0.48;
  filter: grayscale(0.28);
}

.style-card.is-style-locked:hover {
  border-color: rgba(74, 231, 253, 0.2);
  box-shadow: none;
  transform: none;
}

.style-card.active {
  border-color: rgba(74, 231, 253, 0.95);
  transform: translateY(-2px) scale(1.02);
  box-shadow:
    0 0 0 2px rgba(14, 89, 250, 0.45),
    0 0 18px rgba(74, 231, 253, 0.38),
    0 10px 28px rgba(0, 0, 0, 0.45);
}

.selected-style-shortcut {
  outline: none;
}

.selected-style-shortcut:focus-visible {
  box-shadow:
    0 0 0 2px rgba(14, 89, 250, 0.55),
    0 0 0 4px rgba(74, 231, 253, 0.5),
    0 10px 28px rgba(0, 0, 0, 0.45);
}

.current-style-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 4;
  padding: 4px 7px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  box-shadow: 0 4px 12px rgba(14, 89, 250, 0.35);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  pointer-events: none;
}

.style-active-ring {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  pointer-events: none;
  z-index: 3;
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.38s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.style-card.active .style-active-ring {
  opacity: 1;
  transform: scale(1);
  animation: style-card-ring-breathe 2.6s ease-in-out infinite;
}

.style-card--located {
  animation: style-card-located 0.72s ease-in-out 2;
}

@keyframes style-card-located {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(14, 89, 250, 0.45),
      0 0 18px rgba(74, 231, 253, 0.38),
      0 10px 28px rgba(0, 0, 0, 0.45);
  }

  50% {
    box-shadow:
      0 0 0 4px rgba(74, 231, 253, 0.95),
      0 0 32px rgba(74, 231, 253, 0.82),
      0 12px 32px rgba(0, 0, 0, 0.5);
  }
}

@keyframes style-card-ring-breathe {
  0%,
  100% {
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.16),
      0 0 10px rgba(74, 231, 253, 0.22);
  }

  50% {
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.28),
      0 0 16px rgba(74, 231, 253, 0.42);
  }
}

.style-selected-mark {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
  pointer-events: none;
  opacity: 0;
  transform: scale(0.55);
  transition:
    opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.38s cubic-bezier(0.34, 1.35, 0.64, 1);
}

.style-selected-mark__icon {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.style-selected-mark--visible {
  opacity: 1;
  transform: scale(1);
}

.style-thumb {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.style-card :deep(.style-thumb-shimmer) {
  width: 100%;
  height: 100%;
}

.style-card :deep(.style-thumb-img) {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center;
  image-rendering: auto;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(0);
  transition: filter 0.38s cubic-bezier(0.4, 0, 0.2, 1);
}

.style-card.active :deep(.style-thumb-img) {
  filter: brightness(1.06) saturate(1.08);
}

.style-card .style-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.style-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(18, 18, 18, 0.4);
  width: 100%;
  height: 28px;
  line-height: 28px;
  padding: 0 6px;
  text-align: center;
  z-index: 2;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  transition:
    background 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    font-weight 0.38s cubic-bezier(0.4, 0, 0.2, 1);
}

.style-overlay :deep(.ellipsis-tooltip-text) {
  width: 100%;
  text-align: center;
}

.style-card.active .style-overlay {
  background: linear-gradient(180deg, transparent 0%, rgba(14, 89, 250, 0.82) 100%);
  color: #fff;
  font-weight: 600;
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

.style-card.add-style.is-style-locked:hover {
  border-color: rgba(74, 231, 253, 0.2);
  background: rgba(12, 16, 24, 0.55);
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

/* 与 BatchRegenerateDubbingModal .brdm 同思路：限高 + 中部滚动 + 底栏固定 */
.asset-form-modal {
  padding: 8px 0 0;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(100vh - 160px);
  overflow: hidden;
}

.asset-form-modal__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.asset-form-modal__grid::-webkit-scrollbar {
  display: none;
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

.asset-form-item--upload {
  margin-bottom: 18px;
}

.asset-form-item--upload :deep(.ant-form-item-label) {
  display: none;
}

.style-cover-upload {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.style-cover-upload--header {
  width: 100%;
  align-items: center;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(74, 231, 253, 0.22);
  background: rgba(8, 11, 18, 0.55);
  box-sizing: border-box;
}

.style-cover-upload__box {
  width: 120px;
  height: 120px;
  border: 1px dashed rgba(74, 231, 253, 0.35);
  border-radius: 8px;
  background: rgba(8, 11, 18, 0.96);
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.style-cover-upload__box:hover:not(:disabled) {
  border-color: rgba(74, 231, 253, 0.55);
  background: rgba(14, 89, 250, 0.1);
}

.style-cover-upload__box:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.style-cover-upload__box--filled {
  border-style: solid;
  border-color: rgba(74, 231, 253, 0.25);
}

.style-cover-upload__placeholder,
.style-cover-upload__hint {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #8e97a5;
  font-size: 12px;
}

.style-cover-upload__icon {
  font-size: 22px;
  color: rgba(74, 231, 253, 0.55);
}

.style-cover-upload :deep(.style-cover-upload__preview) {
  width: 100%;
  height: 100%;
}

.style-cover-upload :deep(.style-cover-upload__img) {
  width: 100%;
  height: 100%;
  display: block;
}

.style-cover-upload__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.style-cover-upload__tip {
  margin: 0;
  color: #7f8ba0;
  font-size: 12px;
  line-height: 18px;
}

.style-cover-upload__remove {
  color: var(--home-cyan, #4ae7fd);
  font-size: 12px;
  cursor: pointer;
}

.style-cover-upload__remove:hover {
  color: #7ef0ff;
}

.asset-form-modal__footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 0;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
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

.featured-styles--collapsed .styles-grid {
  overflow: visible;
}

/* 上拉加载：新卡片淡入上移，避免生硬跳出 */
.style-card-append-enter-active {
  transition:
    opacity 0.36s ease,
    transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.style-card-append-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

.styles-grid--appending {
  transition: opacity 0.2s ease;
}

/* 创建项目弹窗右侧：折叠后固定展示 2 行（6 列） */
.create-step-global-setting .featured-styles--collapsed .styles-grid {
  --featured-style-card-size: calc((100% - 5 * 8px) / 6);
  min-height: calc(var(--featured-style-card-size) * 2 + 8px);
}

@media (prefers-reduced-motion: reduce) {
  .style-card,
  .style-selected-mark,
  .style-active-ring,
  .style-overlay,
  .style-card :deep(.style-thumb-img),
  .style-card-append-enter-active {
    transition: none !important;
  }

  .style-card-append-enter-from {
    opacity: 1;
    transform: none;
  }

  .style-card.active .style-active-ring {
    animation: none;
  }

  .style-card--located {
    animation: none;
  }

  .style-card:hover:not(.active),
  .style-card.active {
    transform: none;
  }
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
  .asset-form-item--full,
  .asset-form-item--upload {
    grid-column: 1 / -1;
  }

  .style-cover-upload--header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
