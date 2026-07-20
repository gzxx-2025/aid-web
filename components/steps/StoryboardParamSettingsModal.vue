<template>
  <a-modal
    v-model:open="modalOpen"
    :width="1100"
    :footer="null"
    :title="null"
    :closable="false"
    class="storyboard-param-settings-modal"
    wrap-class-name="create-flow-modal"
    destroy-on-close
    @cancel="handleCancel"
  >
    <div class="spsm-inner">
      <header class="spsm-header">
        <h2 class="spsm-title">灵感空间</h2>
        <button type="button" class="spsm-close" aria-label="关闭" @click="handleCancel">
          <CloseOutlined />
        </button>
      </header>

      <div class="spsm-body">
        <!-- 左侧：上传按钮 + 图片网格 -->
        <aside class="spsm-left">
          <!-- 分镜视频：单个上传按钮 -->
          <template v-if="mode === 'storyboardVideo'">
            <div class="spsm-upload-row">
              <button type="button" class="spsm-upload-btn" @click="onImportReference">
                <img src="@/assets/img/icon/dialog-add.svg" alt="">
                <div>导入参考图</div>
              </button>
            </div>
          </template>

          <!-- 分镜图 / 多参生视频：多个上传按钮 -->
          <template v-else>
            <div class="spsm-upload-row">
              <button
                v-for="cat in uploadCategories"
                :key="cat.key"
                type="button"
                class="spsm-upload-btn"
                @click="onImportClick(cat.key)"
              >
                <img src="@/assets/img/icon/dialog-add.svg" alt="">
                <div>{{ cat.label }}</div>
              </button>
            </div>
          </template>

          <div class="spsm-grid-scroll spsm-hidden-scrollbar">
            <div v-if="allGridImages.length" class="spsm-grid">
              <div
                v-for="item in allGridImages"
                :key="item.key"
                :class="[
                  'spsm-grid-item',
                  {
                    'spsm-grid-item--selected':
                      mode !== 'storyboardVideo' && isGridItemSelected(item)
                  }
                ]"
                @click="onGridItemClick(item)"
                @dblclick.stop="onGridItemPreview(item)"
              >
                <a-image
                  v-if="item.img.url || item.img.thumbnail"
                  :src="item.img.url || item.img.thumbnail"
                  :preview="false"
                  class="spsm-grid-img"
                />
                <img
                  v-if="mode !== 'storyboardVideo'"
                  class="spsm-grid-select"
                  :src="isGridItemSelected(item) ? dialogSelectSelIcon : dialogSelectNorIcon"
                  alt=""
                />
                <span class="spsm-grid-name" :title="item.displayName">{{ item.displayName }}</span>
                <button
                  v-if="item.removable"
                  type="button"
                  class="spsm-grid-remove"
                  title="移除"
                  @click.stop="removeGridItem(item)"
                >
                  ×
                </button>
              </div>
            </div>
            <div v-else class="spsm-grid-empty">
              <span>暂无图片，请点击上方按钮导入</span>
            </div>
          </div>
        </aside>

        <!-- 右侧：参数选择区 -->
        <aside class="spsm-right">
          <div
            :class="[
              'spsm-settings-scroll spsm-hidden-scrollbar',
              { 'spsm-settings-readonly': mode === 'storyboardVideo' }
            ]"
          >
            <!-- 图生视频：右侧只读展示 -->
            <template v-if="mode === 'storyboardVideo'">
              <div class="spsm-readonly-hint">右侧内容仅支持多参生视频</div>
              <div class="spsm-readonly-block">
                <div class="spsm-field">
                  <div class="spsm-switch-row">
                    <div class="spsm-switch-label">
                      <span class="spsm-dot" />
                      九宫格多机位
                    </div>
                    <a-switch
                      :checked="draftNineGridEnabled"
                      :disabled="true"
                      size="small"
                    />
                  </div>
                </div>
                <div class="spsm-field">
                  <div class="spsm-field-title">镜头运动</div>
                  <SettingSelectField
                    :model-value="draftSelectedCameraMovement"
                    :options="cameraMovementOptions"
                    placeholder="请选择镜头运动"
                    panel-title="选择镜头运动"
                    :open="false"
                  />
                  <div class="spsm-textarea-wrap">
                    <a-input
                      :value="draftCameraMovementDesc"
                      placeholder="请输入镜头运动描述"
                      class="spsm-input-actions"
                      disabled
                      readonly
                    />
                  </div>
                </div>
                <div class="spsm-field">
                  <div class="spsm-field-title">特殊拍摄手法</div>
                  <SettingSelectField
                    :model-value="draftSelectedShootingTechnique"
                    :options="shootingTechniqueOptions"
                    placeholder="请选择特殊拍摄手法"
                    panel-title="选择特殊拍摄手法"
                    :open="false"
                  />
                </div>
              </div>
            </template>

            <!-- 多参生视频：右侧仅展示镜头/拍摄参数（无分区标题） -->
            <template v-else-if="mode === 'imageToVideo'">
              <div class="spsm-field">
                <div class="spsm-switch-row">
                  <div class="spsm-switch-label">
                    <span class="spsm-dot" />
                    九宫格多机位
                  </div>
                  <a-switch
                    v-model:checked="draftI2vNineGridEnabled"
                    :disabled="!draftI2vPrimaryReference"
                    size="small"
                  />
                </div>
              </div>
              <div class="spsm-field">
                <div class="spsm-field-title">镜头运动</div>
                <SettingSelectField
                  v-model:model-value="draftI2vSelectedCameraMovement"
                  :options="cameraMovementOptions"
                  placeholder="请选择镜头运动"
                  panel-title="选择镜头运动"
                  :open="draftI2vActiveVideoSettingKey === 'cameraMovement'"
                  @update:open="(v) => (draftI2vActiveVideoSettingKey = v ? 'cameraMovement' : null)"
                />
                <div class="spsm-textarea-wrap">
                  <a-input
                    v-model:value="draftI2vCameraMovementDesc"
                    placeholder="请输入镜头运动描述"
                    class="spsm-input-actions"
                  >
                    <template #suffix>
                      <DeleteOutlined
                        class="spsm-input-action"
                        @click.stop="draftI2vCameraMovementDesc = ''"
                      />
                      <CopyOutlined
                        class="spsm-input-action"
                        @click.stop="copyDraftText(draftI2vCameraMovementDesc)"
                      />
                    </template>
                  </a-input>
                </div>
              </div>
              <div class="spsm-field">
                <div class="spsm-field-title">特殊拍摄手法</div>
                <SettingSelectField
                  v-model:model-value="draftI2vSelectedShootingTechnique"
                  :options="shootingTechniqueOptions"
                  placeholder="请选择特殊拍摄手法"
                  panel-title="选择特殊拍摄手法"
                  :open="draftI2vActiveVideoSettingKey === 'shootingTechnique'"
                  @update:open="(v) => (draftI2vActiveVideoSettingKey = v ? 'shootingTechnique' : null)"
                />
              </div>
            </template>

            <!-- 生成分镜图 -->
            <template v-else>
              <div class="spsm-field">
                <div class="spsm-field-title">构图</div>
                <SettingSelectField
                  v-model:model-value="draftSelectedComposition"
                  :options="compositionOptions"
                  placeholder="请选择构图"
                  panel-title="选择构图"
                  :open="draftActiveSettingKey === 'composition'"
                  @update:open="(v) => (draftActiveSettingKey = v ? 'composition' : null)"
                />
                <div class="spsm-textarea-wrap spsm-textarea-wrap--rich">
                  <RichTextEditor
                    v-model="draftCompositionDesc"
                    min-height="238px"
                    placeholder="请输入构图描述"
                  />
                  <div class="spsm-textarea-actions">
                    <a-button type="text" size="small" @click="copyDraftHtml(draftCompositionDesc)">
                      <CopyOutlined />
                    </a-button>
                    <a-button type="text" size="small" @click="draftCompositionDesc = ''">
                      <DeleteOutlined />
                    </a-button>
                  </div>
                </div>
              </div>
              <div class="spsm-field">
                <div class="spsm-field-title">景别</div>
                <SettingSelectField
                  v-model:model-value="draftSelectedShotSize"
                  :options="shotSizeOptions"
                  placeholder="请选择景别"
                  panel-title="选择景别"
                  :open="draftActiveSettingKey === 'shotSize'"
                  @update:open="(v) => (draftActiveSettingKey = v ? 'shotSize' : null)"
                />
              </div>
              <div class="spsm-field">
                <div class="spsm-field-title">拍摄角度</div>
                <SettingSelectField
                  v-model:model-value="draftSelectedCameraAngle"
                  :options="cameraAngleOptions"
                  placeholder="请选择拍摄角度"
                  panel-title="选择拍摄角度"
                  :open="draftActiveSettingKey === 'cameraAngle'"
                  @update:open="(v) => (draftActiveSettingKey = v ? 'cameraAngle' : null)"
                />
              </div>
              <div class="spsm-field">
                <div class="spsm-field-title">镜头焦距</div>
                <SettingSelectField
                  v-model:model-value="draftSelectedFocalLength"
                  :options="focalLengthOptions"
                  placeholder="请选择镜头焦距"
                  panel-title="选择镜头焦距"
                  :open="draftActiveSettingKey === 'focalLength'"
                  @update:open="(v) => (draftActiveSettingKey = v ? 'focalLength' : null)"
                />
              </div>
              <div class="spsm-field">
                <div class="spsm-field-title">色彩倾向</div>
                <SettingSelectField
                  v-model:model-value="draftSelectedColorTone"
                  :options="colorToneOptions"
                  placeholder="请选择色彩倾向"
                  panel-title="选择色彩倾向"
                  :open="draftActiveSettingKey === 'colorTone'"
                  @update:open="(v) => (draftActiveSettingKey = v ? 'colorTone' : null)"
                />
              </div>
              <div class="spsm-field">
                <div class="spsm-field-title">光线</div>
                <SettingSelectField
                  v-model:model-value="draftSelectedLighting"
                  :options="lightingOptions"
                  placeholder="请选择光线"
                  panel-title="选择光线"
                  :open="draftActiveSettingKey === 'lighting'"
                  @update:open="(v) => (draftActiveSettingKey = v ? 'lighting' : null)"
                />
              </div>
              <div class="spsm-field">
                <div class="spsm-field-title">摄影技法</div>
                <SettingSelectField
                  v-model:model-value="draftSelectedTechnique"
                  :options="techniqueOptions"
                  placeholder="请选择摄影技法"
                  panel-title="选择摄影技法"
                  :open="draftActiveSettingKey === 'technique'"
                  @update:open="(v) => (draftActiveSettingKey = v ? 'technique' : null)"
                />
              </div>
            </template>
          </div>
        </aside>
      </div>

      <footer class="spsm-footer">
        <a-button class="spsm-btn-cancel" @click="handleCancel">
          <span class="text-gradient">取消</span>
        </a-button>
        <a-button type="primary" class="spsm-btn-ok" @click="handleConfirm">确定</a-button>
      </footer>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { CloseOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import SettingSelectField from './SettingSelectField.vue'
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import { usePromptDictionary } from '~/composables/usePromptDictionary'
import { htmlPlainTextLength } from '~/utils/htmlPlain'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import {
  collectStoryboardPromptAssets,
  extractReferencedAssetIdsFromHtml,
  mergePromptAssets,
  type PromptAssetItem
} from '~/utils/storyboardPromptAssetRef'

type AssetCategoryKey =
  | 'scene'
  | 'character'
  | 'prop'
  | 'pose'
  | 'expression'
  | 'effect'
  | 'draft'

export type ParamSettingsConfirmPayload = {
  sceneImages: any[]
  characterImages: any[]
  propImages: any[]
  otherImages: any[]
  nineGridEnabled: boolean
  referenceImage: { id?: string; url?: string; thumbnail?: string; title?: string } | null
  referenceImages: any[]
  selectedComposition: { key: string; value: string } | null
  selectedShotSize: { key: string; value: string } | null
  selectedCameraAngle: { key: string; value: string } | null
  selectedFocalLength: { key: string; value: string } | null
  selectedColorTone: { key: string; value: string } | null
  selectedLighting: { key: string; value: string } | null
  selectedTechnique: { key: string; value: string } | null
  compositionDesc: string
  activeSettingKey: string | null
  selectedCameraMovement: { key: string; value: string } | null
  cameraMovementDesc: string
  selectedShootingTechnique: { key: string; value: string } | null
  activeVideoSettingKey: string | null
  imageToVideoNineGridEnabled?: boolean
  imageToVideoSelectedCameraMovement?: { key: string; value: string } | null
  imageToVideoCameraMovementDesc?: string
  imageToVideoSelectedShootingTechnique?: { key: string; value: string } | null
  imageToVideoActiveVideoSettingKey?: string | null
}

type GridImageSource = 'scene' | 'character' | 'prop' | 'other' | 'reference'

type GridImageItem = {
  key: string
  img: any
  source: GridImageSource
  index: number
  displayName: string
  removable: boolean
}

const props = withDefaults(
  defineProps<{
    open: boolean
    mode: 'storyboard' | 'imageToVideo' | 'storyboardVideo'
    sceneImages?: any[]
    characterImages?: any[]
    propImages?: any[]
    otherImages?: any[]
    nineGridEnabled?: boolean
    referenceImage?: { id?: string; url?: string; thumbnail?: string; title?: string } | null
    referenceImages?: any[]
    selectedComposition?: { key: string; value: string } | null
    selectedShotSize?: { key: string; value: string } | null
    selectedCameraAngle?: { key: string; value: string } | null
    selectedFocalLength?: { key: string; value: string } | null
    selectedColorTone?: { key: string; value: string } | null
    selectedLighting?: { key: string; value: string } | null
    selectedTechnique?: { key: string; value: string } | null
    compositionDesc?: string
    activeSettingKey?: string | null
    selectedCameraMovement?: { key: string; value: string } | null
    cameraMovementDesc?: string
    selectedShootingTechnique?: { key: string; value: string } | null
    activeVideoSettingKey?: string | null
    /** 多参灵感空间内展示的图生视频参数 */
    imageToVideoNineGridEnabled?: boolean
    imageToVideoReferenceImages?: any[]
    imageToVideoSelectedCameraMovement?: { key: string; value: string } | null
    imageToVideoCameraMovementDesc?: string
    imageToVideoSelectedShootingTechnique?: { key: string; value: string } | null
    imageToVideoActiveVideoSettingKey?: string | null
    /** 主描述框 HTML，用于恢复左侧图片选中态 */
    prompt?: string
    extraPromptAssets?: PromptAssetItem[]
  }>(),
  {
    sceneImages: () => [],
    characterImages: () => [],
    propImages: () => [],
    otherImages: () => [],
    nineGridEnabled: false,
    referenceImage: null,
    referenceImages: () => [],
    compositionDesc: '',
    prompt: '',
    extraPromptAssets: () => [],
    imageToVideoReferenceImages: () => []
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  openSelectModal: [type: AssetCategoryKey | 'other']
  previewAssetImage: [img: any]
  importReference: []
  previewReference: []
  toggleAssetRef: [payload: { asset: PromptAssetItem; selected: boolean }]
  syncAssetRefs: [assets: PromptAssetItem[]]
  confirm: [payload: ParamSettingsConfirmPayload]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const uploadCategories = [
  { key: 'scene' as const, label: '导入场景' },
  { key: 'character' as const, label: '导入角色' },
  { key: 'prop' as const, label: '导入道具' },
  { key: 'pose' as const, label: '导入姿态图' },
  { key: 'expression' as const, label: '导入表情图' },
  { key: 'effect' as const, label: '导入特效图' },
  { key: 'draft' as const, label: '导入手绘图' }
]

const categoryDefaultNames: Record<AssetCategoryKey, string> = {
  scene: '场景',
  character: '角色',
  prop: '道具',
  pose: '姿态图',
  expression: '表情图',
  effect: '特效图',
  draft: '手绘图'
}

const draftSceneImages = ref<any[]>([])
const draftCharacterImages = ref<any[]>([])
const draftPropImages = ref<any[]>([])
const draftOtherImages = ref<any[]>([])
const draftNineGridEnabled = ref(false)
const draftReferenceImages = ref<any[]>([])
const draftReferenceImage = ref<{ id?: string; url?: string; thumbnail?: string; title?: string } | null>(
  null
)
const draftI2vNineGridEnabled = ref(false)
const draftI2vSelectedCameraMovement = ref<{ key: string; value: string } | null>(null)
const draftI2vCameraMovementDesc = ref('')
const draftI2vSelectedShootingTechnique = ref<{ key: string; value: string } | null>(null)
const draftI2vActiveVideoSettingKey = ref<string | null>(null)
const draftSelectedComposition = ref<{ key: string; value: string } | null>(null)
const draftSelectedShotSize = ref<{ key: string; value: string } | null>(null)
const draftSelectedCameraAngle = ref<{ key: string; value: string } | null>(null)
const draftSelectedFocalLength = ref<{ key: string; value: string } | null>(null)
const draftSelectedColorTone = ref<{ key: string; value: string } | null>(null)
const draftSelectedLighting = ref<{ key: string; value: string } | null>(null)
const draftSelectedTechnique = ref<{ key: string; value: string } | null>(null)
const draftCompositionDesc = ref('')
const draftActiveSettingKey = ref<string | null>(null)
const draftSelectedCameraMovement = ref<{ key: string; value: string } | null>(null)
const draftCameraMovementDesc = ref('')
const draftSelectedShootingTechnique = ref<{ key: string; value: string } | null>(null)
const draftActiveVideoSettingKey = ref<string | null>(null)
const selectedGridKeys = ref<Set<string>>(new Set())
const draftI2vReferenceImages = ref<any[]>([])

const draftI2vPrimaryReference = computed(() => {
  const first = draftI2vReferenceImages.value[0]
  if (!first?.url && !first?.thumbnail) return null
  return first
})

const enableDraftPromptAssetRefs = computed(
  () =>
    props.mode === 'storyboard' ||
    props.mode === 'imageToVideo' ||
    props.mode === 'storyboardVideo'
)

const draftPromptAssets = computed<PromptAssetItem[]>(() => {
  if (!enableDraftPromptAssetRefs.value) return []
  const startIndex =
    (props.extraPromptAssets?.length ?? 0) > 0
      ? Math.max(...props.extraPromptAssets!.map((a) => a.imageIndex)) + 1
      : 1
  if (props.mode === 'storyboardVideo') {
    const refs = draftReferenceImages.value.filter((img) => img?.url || img?.thumbnail)
    if (!refs.length) {
      return props.extraPromptAssets?.length ? [...props.extraPromptAssets] : []
    }
    const local = collectStoryboardPromptAssets(
      refs.map((ref, idx) => ({
        ...ref,
        id: ref.id || `ref-${idx}-${ref.url || ref.thumbnail}`,
        title: ref.title || ref.name || `参考图${idx + 1}`
      })),
      [],
      [],
      [],
      startIndex
    )
    return props.extraPromptAssets?.length
      ? mergePromptAssets(props.extraPromptAssets, local)
      : local
  }
  const local = collectStoryboardPromptAssets(
    draftSceneImages.value,
    draftCharacterImages.value,
    draftPropImages.value,
    draftOtherImages.value,
    startIndex
  )
  return props.extraPromptAssets?.length
    ? mergePromptAssets(props.extraPromptAssets, local)
    : local
})

function findPromptAssetForGridItem(item: GridImageItem): PromptAssetItem | null {
  const assetId = String(item.img?.id ?? '')
  if (!assetId) return null
  return draftPromptAssets.value.find((a) => a.assetId === assetId) ?? null
}

function isGridItemSelected(item: GridImageItem): boolean {
  return selectedGridKeys.value.has(item.key)
}

function restoreGridSelectionFromPrompt() {
  const ids = extractReferencedAssetIdsFromHtml(props.prompt ?? '')
  if (!ids.size) {
    selectedGridKeys.value = new Set()
    return
  }
  const keys = new Set<string>()
  for (const item of allGridImages.value) {
    const assetId = String(item.img?.id ?? '')
    if (assetId && ids.has(assetId)) keys.add(item.key)
  }
  selectedGridKeys.value = keys
}

const {
  ensureLoaded,
  cameraMovementOptions,
  shootingTechniqueOptions,
  compositionOptions,
  shotSizeOptions,
  cameraAngleOptions,
  focalLengthOptions,
  colorToneOptions,
  lightingOptions,
  techniqueOptions
} = usePromptDictionary()

onMounted(() => {
  void ensureLoaded()
})

function cloneList(list: any[]) {
  return list.map((item) => ({ ...item }))
}

function initDraftFromProps() {
  draftSceneImages.value = cloneList(props.sceneImages)
  draftCharacterImages.value = cloneList(props.characterImages)
  draftPropImages.value = cloneList(props.propImages)
  draftOtherImages.value = cloneList(props.otherImages)
  draftNineGridEnabled.value = props.nineGridEnabled
  const refsFromProps =
    props.referenceImages?.length > 0
      ? cloneList(props.referenceImages)
      : props.referenceImage?.url || props.referenceImage?.thumbnail
        ? [{ ...props.referenceImage }]
        : []
  draftReferenceImages.value = refsFromProps
  draftReferenceImage.value = refsFromProps[0] ? { ...refsFromProps[0] } : null
  draftI2vNineGridEnabled.value = props.imageToVideoNineGridEnabled ?? props.nineGridEnabled ?? false
  draftI2vReferenceImages.value = cloneList(
    props.imageToVideoReferenceImages?.length
      ? props.imageToVideoReferenceImages
      : refsFromProps
  )
  draftI2vSelectedCameraMovement.value = props.imageToVideoSelectedCameraMovement
    ? { ...props.imageToVideoSelectedCameraMovement }
    : props.selectedCameraMovement
      ? { ...props.selectedCameraMovement }
      : null
  draftI2vCameraMovementDesc.value =
    props.imageToVideoCameraMovementDesc ?? props.cameraMovementDesc ?? ''
  draftI2vSelectedShootingTechnique.value = props.imageToVideoSelectedShootingTechnique
    ? { ...props.imageToVideoSelectedShootingTechnique }
    : props.selectedShootingTechnique
      ? { ...props.selectedShootingTechnique }
      : null
  draftI2vActiveVideoSettingKey.value =
    props.imageToVideoActiveVideoSettingKey ?? props.activeVideoSettingKey ?? null
  draftSelectedComposition.value = props.selectedComposition ? { ...props.selectedComposition } : null
  draftSelectedShotSize.value = props.selectedShotSize ? { ...props.selectedShotSize } : null
  draftSelectedCameraAngle.value = props.selectedCameraAngle ? { ...props.selectedCameraAngle } : null
  draftSelectedFocalLength.value = props.selectedFocalLength ? { ...props.selectedFocalLength } : null
  draftSelectedColorTone.value = props.selectedColorTone ? { ...props.selectedColorTone } : null
  draftSelectedLighting.value = props.selectedLighting ? { ...props.selectedLighting } : null
  draftSelectedTechnique.value = props.selectedTechnique ? { ...props.selectedTechnique } : null
  draftCompositionDesc.value = props.compositionDesc ?? ''
  draftActiveSettingKey.value = props.activeSettingKey ?? null
  draftSelectedCameraMovement.value = props.selectedCameraMovement
    ? { ...props.selectedCameraMovement }
    : null
  draftCameraMovementDesc.value = props.cameraMovementDesc ?? ''
  draftSelectedShootingTechnique.value = props.selectedShootingTechnique
    ? { ...props.selectedShootingTechnique }
    : null
  draftActiveVideoSettingKey.value = props.activeVideoSettingKey ?? null
  nextTick(() => restoreGridSelectionFromPrompt())
}

watch(
  () => props.open,
  (v) => {
    if (v) initDraftFromProps()
  }
)

const allGridImages = computed<GridImageItem[]>(() => {
  if (props.mode === 'storyboardVideo') {
    return draftReferenceImages.value
      .filter((img) => img?.url || img?.thumbnail)
      .map((img, index) => ({
        key: `reference-${img.id || index}`,
        img,
        source: 'reference' as GridImageSource,
        index,
        displayName: img.title || img.name || `参考图${index + 1}`,
        removable: true
      }))
  }

  const items: GridImageItem[] = []
  draftSceneImages.value.forEach((img, index) => {
    items.push({
      key: `scene-${img.id || index}`,
      img,
      source: 'scene',
      index,
      displayName: img.title || img.name || `场景${index + 1}`,
      removable: false
    })
  })
  draftCharacterImages.value.forEach((img, index) => {
    items.push({
      key: `character-${img.id || index}`,
      img,
      source: 'character',
      index,
      displayName: img.title || img.name || `角色${index + 1}`,
      removable: false
    })
  })
  draftPropImages.value.forEach((img, index) => {
    items.push({
      key: `prop-${img.id || index}`,
      img,
      source: 'prop',
      index,
      displayName: img.title || img.name || `道具${index + 1}`,
      removable: false
    })
  })
  draftOtherImages.value.forEach((img, index) => {
    items.push({
      key: `other-${img.id || index}`,
      img,
      source: 'other',
      index,
      displayName: img.title || img.name || `参考${index + 1}`,
      removable: true
    })
  })
  return items
})

function onImportClick(type: AssetCategoryKey) {
  emit('openSelectModal', type)
}

function onImportReference() {
  emit('importReference')
}

function onGridItemClick(item: GridImageItem) {
  if (item.source === 'reference') {
    if (props.mode === 'storyboardVideo') {
      onGridItemPreview(item)
    } else {
      onGridItemPreview(item)
    }
    return
  }
  const next = new Set(selectedGridKeys.value)
  const wasSelected = next.has(item.key)
  if (wasSelected) next.delete(item.key)
  else next.add(item.key)
  selectedGridKeys.value = next

  const asset = findPromptAssetForGridItem(item)
  if (asset && enableDraftPromptAssetRefs.value) {
    emit('toggleAssetRef', { asset, selected: !wasSelected })
  }
}

function onGridItemPreview(item: GridImageItem) {
  if (item.source === 'reference') {
    emit('previewReference')
    return
  }
  emit('previewAssetImage', item.img)
}

function removeGridItem(item: GridImageItem) {
  if (item.source === 'reference') {
    draftReferenceImages.value = draftReferenceImages.value.filter((_, i) => i !== item.index)
    draftReferenceImage.value = draftReferenceImages.value[0]
      ? { ...draftReferenceImages.value[0] }
      : null
    if (!draftReferenceImages.value.length) {
      draftNineGridEnabled.value = false
    }
    return
  }
  if (item.source === 'other') {
    draftOtherImages.value = draftOtherImages.value.filter((_, i) => i !== item.index)
  }
  const next = new Set(selectedGridKeys.value)
  next.delete(item.key)
  selectedGridKeys.value = next
  const asset = findPromptAssetForGridItem(item)
  if (asset) {
    emit('toggleAssetRef', { asset, selected: false })
  }
}

function appendDraftImages(type: AssetCategoryKey | 'other', items: any[]) {
  if (!items?.length) return
  const list = items.map((item) => ({
    ...item,
    id: item.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url: item.url || item.thumbnail,
    thumbnail: item.thumbnail || item.url,
    title: item.title || item.name || `${categoryDefaultNames[type === 'other' ? 'pose' : type] || '参考'}`
  }))
  if (type === 'scene') {
    draftSceneImages.value = [...draftSceneImages.value, ...list]
  } else if (type === 'character') {
    draftCharacterImages.value = [...draftCharacterImages.value, ...list]
  } else if (type === 'prop') {
    draftPropImages.value = [...draftPropImages.value, ...list]
  } else {
    draftOtherImages.value = [...draftOtherImages.value, ...list]
  }

  nextTick(() => {
    const newAssets: PromptAssetItem[] = []
    for (const img of list) {
      const assetId = String(img.id)
      const gridItem = allGridImages.value.find((g) => String(g.img?.id) === assetId)
      if (!gridItem) continue
      selectedGridKeys.value = new Set([...selectedGridKeys.value, gridItem.key])
      const asset = findPromptAssetForGridItem(gridItem)
      if (asset) newAssets.push(asset)
    }
    if (newAssets.length && enableDraftPromptAssetRefs.value) {
      emit('syncAssetRefs', newAssets)
    }
  })
}

function appendDraftReferences(items: any[]) {
  if (!items?.length) return
  const list = items.map((item, idx) => ({
    ...item,
    id: item.id || `ref-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    url: item.url || item.thumbnail,
    thumbnail: item.thumbnail || item.url,
    title: item.title || item.name || '参考图'
  }))
  if (props.mode === 'storyboardVideo') {
    draftReferenceImages.value = list.slice(0, 1)
    draftReferenceImage.value = draftReferenceImages.value[0]
      ? { ...draftReferenceImages.value[0] }
      : null
    return
  }
  draftReferenceImages.value = [...draftReferenceImages.value, ...list]
  if (!draftReferenceImage.value && draftReferenceImages.value[0]) {
    draftReferenceImage.value = { ...draftReferenceImages.value[0] }
  }
}

function setDraftReference(item: any) {
  appendDraftReferences([item])
}

function buildConfirmPayload(): ParamSettingsConfirmPayload {
  const referenceImages = cloneList(draftReferenceImages.value)
  const primaryReference = referenceImages[0] ? { ...referenceImages[0] } : null
  return {
    sceneImages: cloneList(draftSceneImages.value),
    characterImages: cloneList(draftCharacterImages.value),
    propImages: cloneList(draftPropImages.value),
    otherImages: cloneList(draftOtherImages.value),
    nineGridEnabled: draftNineGridEnabled.value,
    referenceImage: primaryReference,
    referenceImages,
    selectedComposition: draftSelectedComposition.value ? { ...draftSelectedComposition.value } : null,
    selectedShotSize: draftSelectedShotSize.value ? { ...draftSelectedShotSize.value } : null,
    selectedCameraAngle: draftSelectedCameraAngle.value ? { ...draftSelectedCameraAngle.value } : null,
    selectedFocalLength: draftSelectedFocalLength.value ? { ...draftSelectedFocalLength.value } : null,
    selectedColorTone: draftSelectedColorTone.value ? { ...draftSelectedColorTone.value } : null,
    selectedLighting: draftSelectedLighting.value ? { ...draftSelectedLighting.value } : null,
    selectedTechnique: draftSelectedTechnique.value ? { ...draftSelectedTechnique.value } : null,
    compositionDesc: draftCompositionDesc.value,
    activeSettingKey: draftActiveSettingKey.value,
    selectedCameraMovement: draftSelectedCameraMovement.value
      ? { ...draftSelectedCameraMovement.value }
      : null,
    cameraMovementDesc: draftCameraMovementDesc.value,
    selectedShootingTechnique: draftSelectedShootingTechnique.value
      ? { ...draftSelectedShootingTechnique.value }
      : null,
    activeVideoSettingKey: draftActiveVideoSettingKey.value,
    ...(props.mode === 'imageToVideo'
      ? {
          imageToVideoNineGridEnabled: draftI2vNineGridEnabled.value,
          imageToVideoSelectedCameraMovement: draftI2vSelectedCameraMovement.value
            ? { ...draftI2vSelectedCameraMovement.value }
            : null,
          imageToVideoCameraMovementDesc: draftI2vCameraMovementDesc.value,
          imageToVideoSelectedShootingTechnique: draftI2vSelectedShootingTechnique.value
            ? { ...draftI2vSelectedShootingTechnique.value }
            : null,
          imageToVideoActiveVideoSettingKey: draftI2vActiveVideoSettingKey.value
        }
      : {})
  }
}

function copyDraftText(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text)
  message.success('已复制')
}

function copyDraftHtml(html: string) {
  if (!htmlPlainTextLength(html)) return
  navigator.clipboard.writeText(html)
  message.success('已复制')
}

function handleCancel() {
  emit('update:open', false)
}

function handleConfirm() {
  emit('confirm', buildConfirmPayload())
  emit('update:open', false)
}

defineExpose({
  isOpen: () => props.open,
  appendDraftImages,
  appendDraftReferences,
  setDraftReference
})
</script>

<style lang="scss" scoped>
.storyboard-param-settings-modal :deep(.ant-modal-content) {
  padding: 0 !important;
  background: rgba(25, 26, 29, 1) !important;
  border-radius: 12px !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 80px);
}

.storyboard-param-settings-modal :deep(.ant-modal-body) {
  padding: 0 !important;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.spsm-inner {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 698px;
  max-height: 100%;
}

.spsm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 16px;
  flex-shrink: 0;
}

.spsm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(225, 239, 255, 0.95);
}

.spsm-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(142, 151, 165, 1);
  cursor: pointer;
  font-size: 14px;

  &:hover {
    color: rgba(225, 239, 255, 0.9);
    background: rgba(74, 231, 253, 0.08);
  }
}

.spsm-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 66% 31%;
  gap: 24px;
  overflow: hidden;
}

.spsm-left {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.spsm-upload-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 16px;
  margin-bottom: 14px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.spsm-upload-btn {
  flex-shrink: 0;
  height: 46px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px dashed rgba(74, 231, 253, 0.3);
  background: rgba(18, 18, 18, 1);
  cursor: pointer;
  color: rgba(142, 151, 165, 1);
  font-size: 12px;
  white-space: nowrap;
  transition: border-color 0.15s ease, color 0.15s ease;

  img {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  &:hover {
    border-color: rgba(74, 231, 253, 0.55);
    color: rgba(225, 239, 255, 0.85);
  }
}

.spsm-hidden-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.spsm-grid-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: rgba(18, 18, 18, 1);
  padding: 12px;
  box-sizing: border-box;
  border-radius: 8px;
}

.spsm-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.spsm-grid-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: rgba(142, 151, 165, 0.65);
  font-size: 12px;
}
.spsm-grid-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(74, 231, 253, 0.3);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  height: 140px;
  padding: 4px;
  box-sizing: border-box;
  &:hover {
    border-color: rgba(74, 231, 253, 0.5);
  }
  :deep(.ant-image) {
    width: 100%;
    object-fit: cover;
    height: 106px;
    .ant-image-img {
      height: 100%;
      border-radius: 8px;
    }
  }
}

.spsm-grid-item--selected {
  border: 1px solid rgba(74, 231, 253, 1);
  box-shadow:
    0 0 0 1px rgba(74, 231, 253, 0.25),
    0 0 16px rgba(74, 231, 253, 0.12);
}

.spsm-grid-select {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  object-fit: contain;
  pointer-events: none;
  z-index: 2;
}

.spsm-grid-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.spsm-grid-name {
  display: block;
  padding: 6px 6px 4px 0;
  font-size: 12px;
  color: rgba(142, 151, 165, 1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.spsm-grid-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  padding: 0;
  line-height: 16px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  z-index: 2;
}

.spsm-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.spsm-readonly-hint {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(74, 231, 253, 0.08);
  border: 1px solid rgba(74, 231, 253, 0.22);
  color: rgba(142, 151, 165, 1);
  font-size: 12px;
  line-height: 1.5;
}

.spsm-readonly-block {
  pointer-events: none;
  opacity: 0.72;
}

.spsm-section-title {
  margin: 4px 0 12px;
  color: rgba(225, 239, 255, 0.92);
  font-size: 13px;
  font-weight: 600;
}

.spsm-section-title--multi {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(74, 231, 253, 0.12);
}

.spsm-switch-label {
  display: flex;
  align-items: center;
  color: rgba(142, 151, 165, 1);
  font-size: 13px;
  font-weight: 600;
}

.spsm-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-500, #4ae7fd);
  margin-right: 6px;
}

.spsm-switch-row :deep(.ant-switch) {
  background: rgba(106, 123, 148, 0.65) !important;
  border: 1px solid rgba(180, 198, 224, 0.45);
}

.spsm-switch-row :deep(.ant-switch.ant-switch-checked) {
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
}

.spsm-right {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px 20px;
  border: 1px solid rgba(142, 151, 165, .2);
  border-radius: 8px;
}

.spsm-settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.spsm-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spsm-field-title {
  color: rgba(142, 151, 165, 1);
  font-weight: 600;
  font-size: 13px;
}

.spsm-textarea-wrap {
  position: relative;
}

.spsm-textarea-wrap--rich {
  height: 238px;
  border-radius: 8px;
  overflow: hidden;
}

.spsm-textarea-wrap--rich :deep(.rich-text-editor),
.spsm-textarea-wrap--rich :deep(.rich-text-editor__host),
.spsm-textarea-wrap--rich :deep(.ql-container.ql-snow) {
  height: 100%;
  background: #121212 !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 8px;
}

.spsm-textarea-wrap--rich :deep(.ql-container.ql-snow:hover),
.spsm-textarea-wrap--rich :deep(.ql-container.ql-snow:focus-within) {
  border-color: transparent !important;
}

.spsm-textarea-wrap--rich :deep(.ql-editor) {
  min-height: 238px !important;
  height: 238px;
  background: #121212 !important;
  border: none !important;
  border-radius: 8px;
  color: rgba(225, 239, 255, 0.9);
  padding-bottom: 28px;
  overflow-y: auto;
}

.spsm-textarea-actions {
  position: absolute;
  right: 4px;
  bottom: 4px;
  display: flex;
  gap: 4px;
  z-index: 1;

  :deep(.ant-btn) {
    color: #8e97a5 !important;
  }
}

.spsm-input-actions {
  width: 100%;
}

.spsm-input-action {
  margin-left: 6px;
  cursor: pointer;
  color: #8e97a5 !important;
}

.spsm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px;
  flex-shrink: 0;
}

.spsm-btn-cancel {
  min-width: 80px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(128, 154, 188, 0.35) !important;
  background: rgba(18, 18, 18, 1) !important;
  color: rgba(225, 239, 255, 0.9) !important;
}

.spsm-btn-ok {
  min-width: 80px;
  height: 36px;
  border-radius: 8px;
  border: none !important;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
}
</style>
