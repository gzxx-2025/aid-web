<template>
  <a-modal
    v-model:open="modalOpen"
    :width="1050"
    :footer="null"
    :title="null"
    :closable="false"
    :z-index="modalZIndex"
    class="select-asset-image-modal select-asset-image-modal--figma"
    wrap-class-name="create-flow-modal select-asset-image-modal-wrap"
    @cancel="handleCancel"
  >
    <div class="saim-inner">
      <header class="saim-header">
        <h2 class="saim-title">{{ modalTitle }}</h2>
        <div class="saim-header-actions">
          <button type="button" class="saim-icon-btn" aria-label="关闭" @click="handleCancel">
            <CloseOutlined />
          </button>
        </div>
      </header>
      <div class="content_box">
         <!-- 与 EditStoryboardImageModal 右侧一致的居中分段 Tab -->
      <div class="saim-header-tabs" role="tablist" aria-label="资产来源">
        <div class="config-tabs config-tabs--three saim-config-tabs">
          <button
            v-for="(tab, key) in tabOptions"
            :key="key"
            type="button"
            role="tab"
            :aria-selected="activeTab === key"
            :class="['config-tab', { active: activeTab === key }]"
            @click="setActiveTab(key)"
          >
            {{ tab }}
          </button>
        </div>
      </div>

      <!-- 左侧分类 + 右侧网格 -->
      <div class="saim-body-shell">
        <div class="saim-content-row">
          <aside class="saim-sidebar" aria-label="资产分类">
            <div class="saim-sidebar-scroll">
              <button
                v-for="(cat, idx) in categoryOptions"
                :key="idx"
                type="button"
                :class="['saim-cat', { 'saim-cat--active': selectedCategoryIndex === idx }]"
                @click="selectedCategoryIndex = idx"
                :title="cat"
              >
                {{ cat }}
              </button>
            </div>
          </aside>

          <div class="saim-main">
            <div class="saim-main-scroll">
              <div v-if="assetLoading" class="saim-empty">
                <a-spin size="large" />
                <p class="saim-empty__text">正在加载本作品资产…</p>
              </div>
              <div v-else-if="displayList.length === 0" class="saim-empty">
                <PictureOutlined class="saim-empty__ico" aria-hidden="true" />
                <p class="saim-empty__text">{{ emptyHint }}</p>
              </div>
              <div v-else class="saim-grid">
                <div
                  v-for="(item, index) in displayList"
                  :key="item.id || index"
                  :class="['saim-card', { 'saim-card--selected': isSelected(item) }]"
                  role="button"
                  tabindex="0"
                  @click="toggleSelect(item)"
                  @keydown.enter.prevent="toggleSelect(item)"
                >
                  <div class="saim-card__media">
                    <img v-if="item.url || item.thumbnail"
                         :src="item.url || item.thumbnail"
                         class="saim-card__img" alt="">
                    <div v-else class="saim-card__placeholder">
                      <PictureOutlined />
                    </div>
                    <img
                      class="saim-card-select"
                      :src="isSelected(item) ? dialogSelectSelIcon : dialogSelectNorIcon"
                      alt=""
                    />
                  </div>
                  <!-- <div class="saim-card__title">
                    {{ item.title || item.name || `图片${index + 1}` }}
                  </div> -->
                  <div class="saim-card__meta">
                    {{ formatDate(item.importDate || item.updatedAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <footer class="saim-footer">
        <div v-if="selectedList.length > 0" class="saim-pending-wrap">
          <div class="saim-pending-title">已导入素材（{{ selectedList.length }}）</div>
          <div class="saim-pending-list">
            <div
              v-for="(item, index) in selectedList"
              :key="rowKey(item)"
              class="saim-pending-item"
            >
              <button
                type="button"
                class="saim-pending-thumb"
                :title="item.title || item.name || '预览'"
                @click="previewPendingItem(item)"
              >
                <img
                  v-if="item.url || item.thumbnail"
                  :src="item.url || item.thumbnail"
                  :alt="item.title || item.name || ''"
                />
                <PictureOutlined v-else />
              </button>
              <span class="saim-pending-name" :title="item.title || item.name">
                {{ item.title || item.name || `图片${index + 1}` }}
              </span>
              <button
                type="button"
                class="saim-pending-remove"
                aria-label="删除"
                @click="removePendingItem(item)"
              >
                <CloseOutlined />
              </button>
            </div>
          </div>
        </div>
        <div class="saim-footer__row">
          <div class="saim-footer__left">
            <a-button class="saim-btn-tool" @click="handleSelectLocalFile">
              <template #icon><UploadOutlined /></template>
              选择本地文件
            </a-button>
            <a-button class="saim-btn-tool" @click="handleOpenAssetLibrary">
              <template #icon><FolderOutlined /></template>
              资产库导入
            </a-button>
          </div>
          <div class="saim-footer__right">
            <a-button class="saim-btn-cancel" @click="handleCancel">
              <div class="text-gradient">取消</div>
            </a-button>
            <a-button
              class="saim-btn-ok"
              :disabled="selectedList.length === 0"
              @click="handleConfirm"
            >
              确定
            </a-button>
          </div>
        </div>
      </footer>
    </div>

    <!-- 资产库多选弹窗 -->
    <ImportScriptModal
      v-model:open="assetLibraryOpen"
      :title="assetLibraryTitle"
      :multiple="true"
      :z-index="assetLibraryZIndex"
      @import-multiple="handleAssetLibraryImportMultiple"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { message, Modal } from 'ant-design-vue'
import {
  CloseOutlined,
  PictureOutlined,
  UploadOutlined,
  FolderOutlined
} from '@ant-design/icons-vue'
import ImportScriptModal from './ImportScriptModal.vue'
import { useCreationStore } from '~/stores/creation'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import {
  ensureStep3AssetsForSelect,
  step3SelectNeedsFetch,
  type Step3SelectAssetType
} from '~/utils/step3AssetSelectLoader'

export type AssetImageType =
  | 'scene'
  | 'character'
  | 'prop'
  | 'pose'
  | 'expression'
  | 'effect'
  | 'draft'
  | 'other'
  | 'reference'
  | 'multiParamReference'

const TITLE_MAP: Record<AssetImageType, string> = {
  scene: '选择场景',
  character: '选择角色',
  prop: '选择道具',
  pose: '选择姿态图',
  expression: '选择表情图',
  effect: '选择特效图',
  draft: '选择手绘稿',
  other: '选择其他',
  reference: '选择分镜画面',
  multiParamReference: '导入参考图'
}

/** 按 url / id 去重，避免主列表与各形态图列表重复展示同一张图 */
function dedupeAssetImages(images: any[]): any[] {
  const seen = new Set<string>()
  const out: any[] = []
  for (const img of images) {
    const key = String(img?.url || img?.thumbnail || img?.id || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(img)
  }
  return out
}

const TAB_OPTIONS_MAP: Record<AssetImageType, Record<string, string>> = {
  scene: { current: '本作品资产', step: '当前分镜' },
  character: { current: '本作品资产', step: '当前分镜' },
  prop: { current: '本作品资产', step: '当前分镜' },
  pose: { current: '本作品资产', step: '当前分镜' },
  expression: { current: '本作品资产', step: '当前分镜' },
  effect: { current: '本作品资产', step: '当前分镜' },
  draft: { current: '本作品资产', step: '当前分镜' },
  other: { current: '本作品资产', step: '当前分镜' },
  reference: { current: '本作品资产', step: '当前分镜' },
  multiParamReference: { current: '本作品资产', step: '当前分镜' }
}

const OTHER_TYPE_LABELS: Record<string, string> = {
  pose: '姿态图',
  expression: '表情图',
  effect: '特效图',
  draft: '手绘稿',
  other: '其他参考'
}

interface Props {
  open: boolean
  type: AssetImageType
  stepTabName?: string
  /** 当前分镜下的分镜图（第二 Tab） */
  stepPanelImages?: any[]
  /** 各分镜脚本的分镜图分组（reference 类型「本作品资产」Tab） */
  storyboardScriptGroups?: { label: string; images: any[] }[]
}

const props = withDefaults(defineProps<Props>(), {
  stepTabName: '当前分镜',
  stepPanelImages: () => [],
  storyboardScriptGroups: () => []
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [items: any[]]
}>()

const route = useRoute()
const creationStore = useCreationStore()
const {
  formData,
  sceneImages,
  characterImages,
  propImages,
  characterForms,
  propForms,
  characterFormImages,
  propFormImages
} = storeToRefs(creationStore)

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const modalZIndex = ref(1000)
const assetLibraryZIndex = computed(() => modalZIndex.value + 100)

function resolveStackedModalZIndex(): number {
  if (!import.meta.client) return 1100
  let max = 1000
  document.querySelectorAll('.ant-modal-wrap').forEach((el) => {
    const z = Number.parseInt(window.getComputedStyle(el).zIndex, 10)
    if (Number.isFinite(z) && z > max) max = z
  })
  return max + 100
}

watch(
  () => props.open,
  (open) => {
    if (open) modalZIndex.value = resolveStackedModalZIndex()
  }
)

const modalTitle = computed(() => TITLE_MAP[props.type] || '选择')

const tabOptions = computed(() => {
  const base = TAB_OPTIONS_MAP[props.type] || { current: '本作品资产', step: '当前分镜' }
  return {
    current: base.current,
    step: props.stepTabName || base.step
  }
})

/** 第三步：场景 / 分镜参考图 左侧分组 + 图片 */
function buildSceneGroups(): { label: string; images: any[] }[] {
  const names = formData.value.sceneCharacter?.scenes || []
  if (!names.length) {
    return [{ label: '（暂无场景，请先在第三步添加）', images: [] }]
  }
  return names.map((name, idx) => {
    const raw = sceneImages.value[idx] || []
    const images = raw.map((img: any, j: number) => ({
      ...img,
      id: img.id || `proj-scene-${idx}-${j}-${img.url || j}`
    }))
    return {
      label: formatCategoryLabel('场景', idx, name),
      images
    }
  })
}

function buildCharacterGroups(): { label: string; images: any[] }[] {
  const names = formData.value.sceneCharacter?.characters || []
  if (!names.length) {
    return [{ label: '（暂无角色，请先在第三步添加）', images: [] }]
  }
  return names.map((name, charIdx) => {
    const forms = characterForms.value[charIdx] || []
    const formImgs: any[] = []
    forms.forEach((_, fi) => {
      formImgs.push(...(characterFormImages.value[`${charIdx}-${fi}`] || []))
    })
    const main = characterImages.value[charIdx] || []
    // 接口同步时 main 常为各形态图的合并副本，与 formImgs 叠加会重复展示
    const merged = dedupeAssetImages(formImgs.length > 0 ? formImgs : main)
    const images = merged.map((img: any, j: number) => ({
      ...img,
      id: img.id || `proj-char-${charIdx}-${j}-${img.url || j}`
    }))
    return {
      label: formatCategoryLabel('角色', charIdx, name),
      images
    }
  })
}

function buildPropGroups(): { label: string; images: any[] }[] {
  const names = formData.value.sceneCharacter?.props || []
  if (!names.length) {
    return [{ label: '（暂无道具，请先在第三步添加）', images: [] }]
  }
  return names.map((name, propIdx) => {
    const forms = propForms.value[propIdx] || []
    const formImgs: any[] = []
    forms.forEach((_, fi) => {
      formImgs.push(...(propFormImages.value[`${propIdx}-${fi}`] || []))
    })
    const main = propImages.value[propIdx] || []
    const merged = dedupeAssetImages(formImgs.length > 0 ? formImgs : main)
    const images = merged.map((img: any, j: number) => ({
      ...img,
      id: img.id || `proj-prop-${propIdx}-${j}-${img.url || j}`
    }))
    return {
      label: formatCategoryLabel('道具', propIdx, name),
      images
    }
  })
}

function formatCategoryLabel(prefix: string, index: number, name?: string) {
  const n = (name && String(name).trim()) || '未命名'
  return `${prefix}${index + 1}: ${n}`
}

function hasDisplayableImage(img: any): boolean {
  return !!String(img?.url || img?.thumbnail || '').trim()
}

/** reference 弹窗：仅保留有可用图片的分组 */
function filterGroupsWithImages(groups: { label: string; images: any[] }[]) {
  return groups.filter((g) => g.images.some(hasDisplayableImage))
}

function buildReferenceGroups(): { label: string; images: any[] }[] {
  const sceneGroups = filterGroupsWithImages(buildSceneGroups())
  const characterGroups = filterGroupsWithImages(buildCharacterGroups())
  const propGroups = filterGroupsWithImages(buildPropGroups())
  const storyboardGroups = filterGroupsWithImages(
    (props.storyboardScriptGroups || []).map((g) => ({
      label: g.label,
      images: (g.images || []).map((img: any, j: number) => ({
        ...img,
        id: img.id || `ref-sb-${j}-${img.url || img.thumbnail || j}`
      }))
    }))
  )

  const merged = [...sceneGroups, ...characterGroups, ...propGroups, ...storyboardGroups]
  if (merged.length > 0) return merged

  return [{ label: '（暂无可选参考图，请先在第三步或第四步生图/上传）', images: [] }]
}

const projectAssetGroups = computed(() => {
  const t = props.type
  if (t === 'reference' || t === 'multiParamReference') return buildReferenceGroups()
  if (t === 'scene') return buildSceneGroups()
  if (t === 'character') return buildCharacterGroups()
  if (t === 'prop') return buildPropGroups()
  const label = OTHER_TYPE_LABELS[t] || '其他'
  return [
    {
      label: `（第三步暂无「${label}」清单，请用本地上传或资源库）`,
      images: [] as any[]
    }
  ]
})

const categoryOptions = computed(() => projectAssetGroups.value.map((g) => g.label))

const activeTab = ref<'current' | 'step'>('current')

function setActiveTab(key: string) {
  if (key === 'step' || key === 'current') activeTab.value = key
}

const selectedCategoryIndex = ref(0)
const selectedList = ref<any[]>([])
const assetLoading = ref(false)
let assetLoadGeneration = 0

function isStep3AssetType(type: AssetImageType): type is Step3SelectAssetType {
  return type === 'scene' || type === 'character' || type === 'prop'
}

async function loadStep3AssetsIfNeeded() {
  const type = props.type
  const typesToLoad: Step3SelectAssetType[] =
    type === 'reference' || type === 'multiParamReference'
      ? ['scene', 'character', 'prop']
      : isStep3AssetType(type)
        ? [type]
        : []

  if (!typesToLoad.length) return
  if (!typesToLoad.some((t) => step3SelectNeedsFetch(creationStore, t))) return

  const gen = ++assetLoadGeneration
  assetLoading.value = true
  const isStale = () => gen !== assetLoadGeneration
  try {
    for (const t of typesToLoad) {
      if (isStale()) break
      if (step3SelectNeedsFetch(creationStore, t)) {
        await ensureStep3AssetsForSelect(creationStore, route, t, { isStale })
      }
    }
  } finally {
    if (gen === assetLoadGeneration) assetLoading.value = false
  }
}

const displayList = computed(() => {
  if (activeTab.value === 'step') {
    const imgs = props.stepPanelImages || []
    return imgs.map((img: any, i: number) => ({
      ...img,
      id: img.id || `step-panel-${i}-${img.url || img.thumbnail || i}`
    }))
  }
  const groups = projectAssetGroups.value
  const idx = Math.min(selectedCategoryIndex.value, Math.max(0, groups.length - 1))
  return groups[idx]?.images || []
})

const emptyHint = computed(() => {
  if (activeTab.value === 'step') {
    return '当前分镜暂无分镜图，请先在第四步生图或上传'
  }
  if (props.type === 'reference' || props.type === 'multiParamReference') {
    return '暂无可选参考图，请先在第三步生成场景/角色/道具图，或在第四步上传分镜图'
  }
  return '该分类下暂无图片'
})

const assetLibraryOpen = ref(false)
const assetLibraryTitle = computed(() => `从资源库选择 - ${modalTitle.value}`)

function rowKey(item: any) {
  const u = item.url || item.thumbnail || ''
  return `${activeTab.value}-${selectedCategoryIndex.value}-${item.id}-${u}`
}

watch(modalOpen, (open) => {
  if (open) {
    activeTab.value = 'current'
    selectedCategoryIndex.value = 0
    selectedList.value = []
    void loadStep3AssetsIfNeeded()
  } else {
    assetLoadGeneration++
    assetLoading.value = false
    selectedList.value = []
  }
})

/** 作品/剧集切换时 store 会被清空；弹窗仍打开则重新拉当前上下文资产，避免展示旧作品残留 */
watch(
  () => [
    creationStore.currentProjectId,
    creationStore.currentEpisodeId,
    route.query.projectId,
    route.query.id,
    route.query.workId,
    route.query.episodeId
  ] as const,
  () => {
    if (!modalOpen.value) return
    selectedCategoryIndex.value = 0
    selectedList.value = []
    void loadStep3AssetsIfNeeded()
  }
)

watch(activeTab, () => {
  selectedList.value = []
})

watch(
  () => [projectAssetGroups.value.length, modalOpen.value] as const,
  ([len, open]) => {
    if (open && selectedCategoryIndex.value >= len) {
      selectedCategoryIndex.value = 0
    }
  }
)

function isSelected(item: any) {
  const k = rowKey(item)
  return selectedList.value.some((s) => rowKey(s) === k)
}

function toggleSelect(item: any) {
  const u = item.url || item.thumbnail
  if (!u && !item.id) return
  const k = rowKey(item)
  const idx = selectedList.value.findIndex((s) => rowKey(s) === k)
  if (idx >= 0) {
    selectedList.value = selectedList.value.filter((s) => rowKey(s) !== k)
  } else {
    selectedList.value = [...selectedList.value, { ...item }]
  }
}

function removePendingItem(item: any) {
  const k = rowKey(item)
  selectedList.value = selectedList.value.filter((s) => rowKey(s) !== k)
}

function previewPendingItem(item: any) {
  const url = item?.url || item?.thumbnail
  if (!url) return
  Modal.info({
    title: item?.title || item?.name || '预览',
    content: h('img', {
      src: url,
      style: { width: '100%', maxHeight: '70vh', objectFit: 'contain' }
    }),
    width: '80%',
    okText: '关闭'
  })
}

function formatDate(str: string) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handleSelectLocalFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files?.length) return
    void (async () => {
      const { uploadImagesToOssWithToast } = await import('~/utils/ossUpload')
      const list = Array.from(files)
      const urls = await uploadImagesToOssWithToast(list)
      if (!urls) return
      const now = new Date().toISOString()
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!
        const file = list[i]!
        const name = file.name.replace(/\.[^/.]+$/, '') || `图片${selectedList.value.length + 1}`
        selectedList.value.push({
          id: `local-${Date.now()}-${i}`,
          url,
          thumbnail: url,
          title: name,
          importDate: now,
          name,
          source: '本地上传'
        })
      }
      message.success(`已添加 ${urls.length} 张图片`)
    })()
  }
  input.click()
}

function handleOpenAssetLibrary() {
  assetLibraryOpen.value = true
}

function handleAssetLibraryImportMultiple(items: any[]) {
  if (Array.isArray(items) && items.length) {
    items.forEach((asset) => {
      const url = asset.url || asset.thumbnail
      if (!url) return
      const id = asset.id || `lib-${Date.now()}-${Math.random().toString(36).slice(2)}`
      if (selectedList.value.some((s) => s.id === id)) return
      selectedList.value.push({
        id,
        url,
        thumbnail: url,
        title: asset.name || asset.title,
        name: asset.name,
        importDate: asset.updatedAt || new Date().toISOString(),
        source: '资源库导入'
      })
    })
    message.success(`已添加 ${items.length} 项`)
  }
  assetLibraryOpen.value = false
}

function handleCancel() {
  modalOpen.value = false
}

function handleConfirm() {
  if (selectedList.value.length === 0) {
    message.warning('请至少选择一项')
    return
  }
  emit('confirm', [...selectedList.value])
  modalOpen.value = false
}
</script>

<style lang="scss" scoped>
/* —— Ant Modal 壳：与创作流 Figma 深色弹窗一致 —— */
.select-asset-image-modal.select-asset-image-modal--figma :deep(.ant-modal-content) {
  padding: 0 !important;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  height: min(640px, calc(100dvh - 48px));
  min-height: min(640px, calc(100dvh - 48px));
  max-height: min(640px, calc(100dvh - 48px));
}
.select-asset-image-modal.select-asset-image-modal--figma :deep(.ant-modal-header) {
  display: none;
}

.select-asset-image-modal.select-asset-image-modal--figma :deep(.ant-modal-body) {
  padding: 0 !important;
  background: #191a1d;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.saim-inner {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  color: #e6edf3;
}

.content_box {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.saim-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 16px;
  flex-shrink: 0;
}
/* 与 EditStoryboardImageModal 右侧 config-tabs--three 一致，整体居中 */
.saim-header-tabs {
  display: flex;
  justify-content: center;
  flex-shrink: 0;
  height: 46px;
  align-items: center;
  background: rgba(32, 36, 52, 1);
  border-radius: 8px 8px 0 0;
  border: 1px solid rgba(74, 231, 253, 0.3)
}

.saim-config-tabs.config-tabs--three {
  display: flex;
  width: 100%;
  max-width: min(480px, 100%);
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  background: rgba(35, 67, 74, 1);
  flex-shrink: 0;
  padding: 0;
}

.saim-config-tabs.config-tabs--three .config-tab {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(225, 239, 255, 0.7);
  font-size: 14px;
  line-height: 1.2;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s, background 0.2s;
}

.saim-config-tabs.config-tabs--three .config-tab.active {
  color: #0b1522 !important;
  font-weight: 600;
  background: rgba(74, 231, 253, 1);
}

.saim-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.02em;
}

.saim-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.saim-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  font-size: 26px !important;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}

.saim-icon-btn:hover {
  color: #4ae7fd;
  background: rgba(74, 231, 253, 0.08);
}

/* 主内容外框（设计稿大矩形描边） */
.saim-body-shell {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(17, 22, 33,1);
}

.saim-content-row {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  border-bottom: 1px solid rgba(74, 231, 253, 0.3);
  border-left: 1px solid rgba(74, 231, 253, 0.3);
  border-right: 1px solid rgba(74, 231, 253, 0.3);
}

/* 左侧分类：1px 竖分割线 */
.saim-sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 10px 12px 12px;
  border-right: 1px solid rgba(74, 231, 253, 0.3);
}

.saim-sidebar-scroll {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  gap: 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    width: 0;
    background: transparent;
  }

  &:hover {
    scrollbar-width: thin;
    scrollbar-color: rgba(120, 140, 170, 0.45) transparent;
  }

  &:hover::-webkit-scrollbar {
    width: 4px;
  }

  &:hover::-webkit-scrollbar-track {
    background: transparent;
  }

  &:hover::-webkit-scrollbar-thumb {
    background: rgba(120, 140, 170, 0.45);
    border-radius: 4px;
  }

  &:hover::-webkit-scrollbar-thumb:hover {
    background: rgba(120, 140, 170, 0.65);
  }
}

/* 左侧分类：无边框、无背景；!important 压过 assets 里 .ant-modal-body * 的全局字色 */
.saim-cat {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 0;
  background: transparent !important;
  color: #8e97a5 !important;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
  cursor: pointer;
  transition: color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saim-cat:hover {
  color: rgba(74, 231, 253, 1) !important;
  background: transparent !important;
}

.saim-cat--active {
  color: rgba(74, 231, 253, 1) !important;
  font-weight: 600;
  background: transparent !important;
}

.saim-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.saim-main-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

.saim-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  color: #8e97a5;
}

.saim-empty__ico {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.35;
  color: #8e97a5;
}

.saim-empty__text {
  margin: 0;
  font-size: 14px;
  text-align: center;
  max-width: 280px;
  line-height: 1.5;
}

.saim-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.saim-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(18, 18, 18, 1);
  height: 132px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.saim-card-select {
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
.saim-card:hover:not(.saim-card--selected) {
  border-color: rgba(255, 255, 255, 0.14);
}

.saim-card--selected {
  border: 1px solid rgba(74, 231, 253, 1);
  box-shadow:
    0 0 0 1px rgba(74, 231, 253, 0.25),
    0 0 16px rgba(74, 231, 253, 0.12);
}

.saim-card__media {
  height: 100px;
  position: relative;
  background: rgba(6, 10, 18, 0.85);
}

.saim-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.saim-card__img :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.saim-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.2);
  font-size: 2rem;
}

/* 右上角勾选：未选半透明圆 + 勾；选中实心青圆 + 深色勾 */

.saim-card__title,
.saim-card__meta {
  display: flex;
  justify-content: flex-end;
  padding: 6px 8px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saim-card__title {
  color: #e6edf3;
  font-weight: 500;
}

.saim-card__meta {
  color: #8e97a5;
}

/* 底部操作区 */
.saim-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 1rem 0 0;
  border-top: 1px solid rgba(74, 231, 253, 0.12);
  background: #191a1d;
  flex-shrink: 0;
}

.saim-pending-wrap {
  width: 100%;
  padding: 0 0 4px;
}

.saim-pending-title {
  font-size: 12px;
  color: rgba(142, 151, 165, 1);
  margin-bottom: 8px;
}

.saim-pending-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-height: 120px;
  overflow-y: auto;
  padding: 2px 0;
}

.saim-pending-item {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 200px;
  padding: 4px 8px 4px 4px;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.28);
  background: rgba(18, 18, 18, 1);
}

.saim-pending-thumb {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  background: rgba(6, 10, 18, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(142, 151, 165, 1);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.saim-pending-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #e6edf3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saim-pending-remove {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(142, 151, 165, 1);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;

  &:hover {
    color: #ff7875;
    background: rgba(255, 77, 79, 0.12);
  }
}

.saim-footer__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.saim-footer__left,
.saim-footer__right {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

:deep(.saim-btn-tool.ant-btn) {
  height: 40px;
  padding: 0 16px;
  border-radius: 10px !important;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
  background: rgba(18, 18, 18, 1) !important;
  color: #e6edf3 !important;
  font-size: 13px;
}

:deep(.saim-btn-tool.ant-btn:hover) {
  border-color: rgba(74, 231, 253, 0.5) !important;
  color: #4ae7fd !important;
}

:deep(.saim-btn-tool .anticon) {
  color: inherit;
}

:deep(.saim-btn-cancel.ant-btn) {
  min-width: 104px;
  height: 40px;
  border-radius: 10px !important;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
  background: #121212 !important;
  color: #e6edf3 !important;
}

:deep(.saim-btn-cancel.ant-btn:hover) {
  border-color: rgba(74, 231, 253, 0.45) !important;
  color: #4ae7fd !important;
}

:deep(.saim-btn-ok.ant-btn) {
  min-width: 104px;
  height: 40px;
  border-radius: 10px !important;
  border: none !important;
  font-weight: 600;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  color: #fff !important;
  box-shadow: none !important;
}

:deep(.saim-btn-ok.ant-btn:hover:not(:disabled)) {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  color: #fff !important;
}

:deep(.saim-btn-ok.ant-btn:disabled) {
  opacity: 0.45;
}

@media (max-width: 720px) {
  .saim-content-row {
    flex-direction: column;
    min-height: 0;
  }

  .saim-sidebar {
    width: 100%;
    flex: 0 0 140px;
    max-height: 140px;
    min-height: 0;
    border-right: none;
    border-bottom: 1px solid rgba(74, 231, 253, 0.3);
  }

  .saim-main {
    flex: 1 1 auto;
    min-height: 0;
  }
}
</style>

<!-- 全局字色 .ant-modal-body * 会盖过 scoped，此处提高优先级保证左侧分类字色 -->
<style>
html.app-shell-create .create-flow-modal .select-asset-image-modal--figma .ant-modal-body .saim-cat {
  color: #8e97a5 !important;
}

html.app-shell-create .create-flow-modal .select-asset-image-modal--figma .ant-modal-body .saim-cat:hover,
html.app-shell-create .create-flow-modal .select-asset-image-modal--figma .ant-modal-body .saim-cat.saim-cat--active {
  color: rgba(74, 231, 253, 1) !important;
}
</style>
