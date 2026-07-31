<template>
  <div class="asset-list">
    <div v-if="listLoading" class="asset-list__loading">加载中…</div>
    <template v-else>
      <div v-if="assets.length === 0" class="empty-state">
        <div class="empty-icon-wrapper">
          <img :src="noDataIconUrl" alt="" class="empty-image-icon empty-image-icon--xl" />
        </div>
        <p class="empty-text">暂无数据</p>
      </div>

      <!-- 文件夹：宽扁卡片网格 -->
      <div v-else-if="displayMode === 'folder'" class="assets-grid assets-grid--folder">
        <div
          v-for="asset in assets"
          :key="asset.id"
          :class="['asset-card', 'is-folder', { active: isAssetSelected(asset) }]"
          @click="selectAsset(asset)"
        >
          <div class="asset-thumbnail asset-thumbnail--folder" @click.stop="handleThumbnailClick(asset)">
            <img
              src="@/assets/img/icon/file_gray.svg"
              alt=""
              class="asset-icon folder-icon"
            />
          </div>
          <div class="asset-info">
            <div class="asset-name">{{ asset.name }}</div>
            <div class="asset-meta">
              <span class="asset-count">{{ asset.itemCount ?? 0 }}项</span>
              <span v-if="formatTime(asset.updatedAt)" class="asset-time">{{
                formatTime(asset.updatedAt)
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 图片：缩略图卡片网格（上图下文）；选中态对齐批量生成分镜图列表 -->
      <div v-else-if="displayMode === 'image'" class="assets-grid assets-grid--image">
        <div
          v-for="asset in assets"
          :key="asset.id"
          :class="[
            'asset-card',
            'asset-card--image',
            { 'asset-card--selected': isAssetSelected(asset) }
          ]"
          @click="selectAsset(asset)"
        >
          <div
            class="asset-thumbnail asset-thumbnail--image"
            @click.stop="handleAssetThumbnailClick(asset)"
          >
            <PreviewableImageThumb
              v-if="asset.thumbnail"
              :src="asset.thumbnail"
              :alt="asset.name"
              :title="asset.name"
              object-fit="cover"
            />
            <img
              v-else
              :src="noDataIconUrl"
              alt=""
              class="asset-image-placeholder"
            />
            <span v-if="asset.featured" class="featured-badge">精选</span>
            <img
              class="asset-card-select"
              :src="isAssetSelected(asset) ? dialogSelectSelIcon : dialogSelectNorIcon"
              alt=""
              role="checkbox"
              :aria-checked="isAssetSelected(asset)"
              @click.stop="selectAsset(asset)"
            />
          </div>
          <div class="asset-info asset-info--image">
            <div class="asset-name">{{ asset.name }}</div>
          </div>
        </div>
      </div>

      <!-- 文件：宽扁卡片网格 -->
      <div v-else class="assets-grid assets-grid--card">
        <div
          v-for="asset in assets"
          :key="asset.id"
          :class="['asset-card', { active: isAssetSelected(asset) }]"
          @click="selectAsset(asset)"
        >
          <div
            class="asset-thumbnail asset-thumbnail--file"
            @click.stop="handleAssetThumbnailClick(asset)"
          >
            <VideoCameraOutlined
              v-if="asset.type === 'video'"
              class="asset-icon asset-icon--center"
            />
            <FileTextOutlined v-else class="asset-icon asset-icon--center" />
            <span v-if="asset.featured" class="featured-badge">精选</span>
          </div>
          <div class="asset-info">
            <div class="asset-name">{{ asset.name }}</div>
            <div v-if="showAssetMeta(asset)" class="asset-meta">
              <span v-if="formatTime(asset.updatedAt)" class="asset-time">{{
                formatTime(asset.updatedAt)
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <a-modal
      v-model:open="previewOpen"
      :width="previewModalWidth"
      :footer="null"
      :title="null"
      :closable="false"
      centered
      class="import-asset-preview-modal"
      wrap-class-name="create-flow-modal import-asset-preview-modal-wrap"
      destroy-on-close
      @cancel="closePreview"
    >
      <div class="import-asset-preview-modal-shell">
        <header class="import-asset-preview-modal-header">
          <h3 class="import-asset-preview-modal-title">{{ previewTitle }}</h3>
          <button
            type="button"
            class="import-asset-preview-modal-close"
            aria-label="关闭"
            @click="closePreview"
          >
            <CloseOutlined />
          </button>
        </header>
        <div class="import-asset-preview-modal-content">
          <div v-if="previewLoading" class="import-asset-preview-modal__loading">加载预览…</div>
          <ImagePreviewViewer
            v-else-if="previewImageUrl"
            :url="previewImageUrl"
            :alt="previewTitle"
            max-height="62vh"
          />
          <div
            v-else
            class="import-asset-preview-modal__body"
            v-html="previewHtml"
          />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CloseOutlined, FileTextOutlined, VideoCameraOutlined } from '@ant-design/icons-vue'
import PreviewableImageThumb from '~/components/common/PreviewableImageThumb.vue'
import ImagePreviewViewer from '~/components/common/ImagePreviewViewer.vue'
import { noDataIconUrl } from '~/utils/emptyImageIcon'
import dialogSelectNorIcon from '@/assets/img/icon/dialog-select-nor.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'
import { userAssetCenterDetail } from '~/utils/businessApi'
import type { AssetCenterDetailVO } from '~/types/business-api'
import { scriptApiTextToEditorHtml } from '~/utils/htmlPlain'
import {
  mapUserAssetRowToImportItem,
  materialKeyToApiType,
  materialLabelToKey,
  fetchOfficialAssetsAsRows,
  fetchOfficialMaterialAllRows,
  countRowsByAssetType,
  buildMaterialFolderItems,
  fetchPersonalCenterAllRows,
  fetchPersonalCenterRowsByCategory,
  countRowsByCategoryCode,
  buildCategoryFolderItems,
  findAssetCenterProject,
  findAssetCenterEpisode,
  getEpisodeCategories,
  resolveCurrentEpisodeNode,
  resolveNodeAssetCount,
  episodeDisplayLabel,
  fetchPersonalTypeTotal,
  resolveImportModalCategoryCode,
  resolveImportAssetDisplayMode
} from '~/utils/importAssetModalQuery'
import type { AssetCenterCategoryTreeVO } from '~/types/business-api'

interface Props {
  category: string | null
  type: string
  projectId?: string | null
  episodeId?: number | null
  assetCenterTree?: AssetCenterCategoryTreeVO[]
  currentPath?: string[]
  selectedCategory?: any
  multiple?: boolean
  selectedAssetIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  assetCenterTree: () => [],
  currentPath: () => [],
  selectedCategory: null,
  multiple: false,
  selectedAssetIds: () => []
})

const emit = defineEmits<{
  select: [asset: any]
  navigate: [folderName: string]
}>()

const selectedAssetId = ref<string | null>(null)
const listLoading = ref(false)
const assets = ref<any[]>([])
let loadSeq = 0

const activeCategoryCode = computed(() =>
  resolveImportModalCategoryCode(props.category, props.selectedCategory)
)

const displayMode = computed(() =>
  resolveImportAssetDisplayMode(assets.value, activeCategoryCode.value)
)

const previewOpen = ref(false)
const previewLoading = ref(false)
const previewTitle = ref('')
const previewImageUrl = ref('')
const previewHtml = ref('')

const previewModalWidth = computed(() => {
  if (typeof window === 'undefined') return 1200
  return Math.min(1200, Math.max(320, window.innerWidth - 48))
})

const isAssetSelected = (asset: any) => {
  if (props.multiple && props.selectedAssetIds?.length) {
    return props.selectedAssetIds.includes(asset.id)
  }
  return selectedAssetId.value === asset.id
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPreviewContent(detail: AssetCenterDetailVO): { imageUrl: string; html: string } {
  const c = detail.content ?? {}
  const imageUrl = String(detail.imageUrl || '').trim()
  const videoUrl = String(detail.videoUrl || '').trim()
  const audioUrl = String(detail.audioUrl || '').trim()
  const coverUrl = String(detail.coverUrl || '').trim()

  if (imageUrl) {
    return { imageUrl, html: '' }
  }
  if (videoUrl) {
    return {
      imageUrl: '',
      html: `<video class="import-asset-preview-modal__video" src="${escapeHtml(videoUrl)}" controls playsinline></video>`
    }
  }
  if (audioUrl) {
    return {
      imageUrl: '',
      html: `<audio class="import-asset-preview-modal__audio" src="${escapeHtml(audioUrl)}" controls></audio>`
    }
  }

  const originalText = typeof c.originalText === 'string' ? c.originalText.trim() : ''
  if (originalText) {
    return {
      imageUrl: '',
      html: `<div class="import-asset-preview-modal__rich">${scriptApiTextToEditorHtml(originalText)}</div>`
    }
  }
  const simplifiedText = typeof c.simplifiedText === 'string' ? c.simplifiedText.trim() : ''
  if (simplifiedText) {
    return {
      imageUrl: '',
      html: `<div class="import-asset-preview-modal__rich">${scriptApiTextToEditorHtml(simplifiedText)}</div>`
    }
  }
  const storyScript = typeof c.storyScript === 'string' ? c.storyScript.trim() : ''
  if (storyScript) {
    return {
      imageUrl: '',
      html: `<pre class="import-asset-preview-modal__plain">${escapeHtml(storyScript)}</pre>`
    }
  }
  const text =
    (typeof c.dialogueText === 'string' && c.dialogueText.trim()) ||
    (typeof c.ttsText === 'string' && c.ttsText.trim()) ||
    (typeof c.promptText === 'string' && c.promptText.trim()) ||
    (typeof c.introduction === 'string' && c.introduction.trim()) ||
    (typeof c.summary === 'string' && c.summary.trim()) ||
    ''
  if (text) {
    return {
      imageUrl: '',
      html: `<pre class="import-asset-preview-modal__plain">${escapeHtml(text)}</pre>`
    }
  }
  if (coverUrl) {
    return { imageUrl: coverUrl, html: '' }
  }
  return { imageUrl: '', html: '<p class="import-asset-preview-modal__empty">暂无预览内容</p>' }
}

function closePreview() {
  previewOpen.value = false
  previewImageUrl.value = ''
  previewHtml.value = ''
  previewTitle.value = ''
}

async function handleFilePreview(asset: any) {
  const raw = asset?.raw ?? {}
  const id = Number(raw.id ?? asset.id)
  const categoryCode =
    activeCategoryCode.value ||
    (typeof raw.categoryCode === 'string' ? raw.categoryCode.trim() : '')
  if (!Number.isFinite(id) || id <= 0) {
    message.warning('无法预览该资产')
    return
  }
  if (!categoryCode) {
    message.warning('缺少分类信息，无法预览')
    return
  }
  previewTitle.value = asset.name || '预览'
  previewOpen.value = true
  previewLoading.value = true
  previewImageUrl.value = ''
  previewHtml.value = ''
  try {
    const detail = await userAssetCenterDetail({
      categoryCode,
      id
    })
    previewTitle.value = detail.name || detail.categoryName || asset.name || '预览'
    const content = buildPreviewContent(detail)
    previewImageUrl.value = content.imageUrl
    previewHtml.value = content.html
  } catch (e: any) {
    message.error(e?.msg ?? e?.message ?? '加载预览失败')
    previewOpen.value = false
  } finally {
    previewLoading.value = false
  }
}

async function runLoadAssets(seq: number) {
  const path0 = props.currentPath.length === 0
  const nowLabel = () => new Date().toLocaleDateString('zh-CN')

  if (props.type === 'material' && path0 && props.category === 'material-library') {
    // 不传 assetType/keyword 一次拉全量官方素材，按 assetType 聚合文件夹
    const allRows = await fetchOfficialMaterialAllRows()
    if (seq !== loadSeq) return
    assets.value = buildMaterialFolderItems(countRowsByAssetType(allRows), nowLabel())
    return
  }

  if (
    props.type === 'material' &&
    path0 &&
    props.category?.startsWith('material-') &&
    props.category !== 'material-library'
  ) {
    const key = props.category.replace('material-', '')
    const apiType = materialKeyToApiType(key)
    const rows = await fetchOfficialAssetsAsRows(apiType)
    if (seq !== loadSeq) return
    assets.value = rows.map(mapUserAssetRowToImportItem)
    return
  }

  if (props.type === 'material' && !path0) {
    const folderLabel = props.currentPath[props.currentPath.length - 1] || ''
    const key = materialLabelToKey(folderLabel)
    if (key) {
      const apiType = materialKeyToApiType(key)
      const rows = await fetchOfficialAssetsAsRows(apiType)
      if (seq !== loadSeq) return
      assets.value = rows.map(mapUserAssetRowToImportItem)
      return
    }
  }

  if (props.type === 'current' && path0 && props.category?.startsWith('project-')) {
    const pid = props.projectId ? Number(props.projectId) : NaN
    const ep = props.episodeId != null && props.episodeId >= 0 ? Number(props.episodeId) : 0
    if (!Number.isFinite(pid) || pid <= 0) {
      assets.value = []
      return
    }
    const episodeNode = resolveCurrentEpisodeNode(props.assetCenterTree, pid, ep)
    const categories = getEpisodeCategories(episodeNode)
    // 不传 categoryCode 一次拉全量，前端按分类聚合展示文件夹
    const needListCount = categories.some((c) => typeof c.assetCount !== 'number')
    const countByCode = needListCount
      ? countRowsByCategoryCode(await fetchPersonalCenterAllRows(pid, ep))
      : new Map<string, number>()
    if (seq !== loadSeq) return
    assets.value = buildCategoryFolderItems(categories, countByCode, 'folder-p-', nowLabel())
    return
  }

  if (
    props.type === 'current' &&
    path0 &&
    props.category &&
    !props.category.startsWith('project-')
  ) {
    const dash = props.category.indexOf('-')
    if (dash > 0) {
      const projectIdStr = props.category.slice(0, dash)
      const docKey = props.category.slice(dash + 1)
      const pid = Number(projectIdStr)
      const ep = props.episodeId != null && props.episodeId >= 0 ? Number(props.episodeId) : 0
      if (Number.isFinite(pid) && pid > 0 && docKey) {
        const rows = await fetchPersonalCenterRowsByCategory(pid, ep, docKey)
        if (seq !== loadSeq) return
        assets.value = rows.map(mapUserAssetRowToImportItem)
        return
      }
    }
  }

  if (props.type === 'current' && !path0 && props.projectId) {
    const folderLabel = props.currentPath[props.currentPath.length - 1] || ''
    const pid = Number(props.projectId)
    const ep = props.episodeId != null && props.episodeId >= 0 ? Number(props.episodeId) : 0
    const episodeNode = resolveCurrentEpisodeNode(props.assetCenterTree, pid, ep)
    const cat = getEpisodeCategories(episodeNode).find(
      (c) => (c.categoryName || c.categoryCode) === folderLabel
    )
    if (cat?.categoryCode && Number.isFinite(pid) && pid > 0) {
      const rows = await fetchPersonalCenterRowsByCategory(pid, ep, cat.categoryCode)
      if (seq !== loadSeq) return
      assets.value = rows.map(mapUserAssetRowToImportItem)
      return
    }
  }

  if (props.type === 'history' && path0 && props.category?.startsWith('project-')) {
    const pid = Number(props.category.replace(/^project-/, ''))
    const project = findAssetCenterProject(props.assetCenterTree, pid)
    const episodes = project?.children ?? []

    if (episodes.length === 1) {
      const ep = episodes[0]!
      const epId = ep.episodeId ?? 0
      const categories = getEpisodeCategories(ep)
      const needListCount = categories.some((c) => typeof c.assetCount !== 'number')
      const countByCode = needListCount
        ? countRowsByCategoryCode(await fetchPersonalCenterAllRows(pid, epId))
        : new Map<string, number>()
      if (seq !== loadSeq) return
      assets.value = buildCategoryFolderItems(
        categories,
        countByCode,
        `folder-hc-${pid}-${epId}-`,
        nowLabel()
      )
      return
    }

    const folders = await Promise.all(
      (project?.children ?? []).map(async (ep) => {
        const epId = ep.episodeId ?? 0
        const cached = resolveNodeAssetCount(ep)
        // 剧集总数：优先树汇总；否则不传 categoryCode 一次取 total
        const total =
          cached != null ? cached : await fetchPersonalTypeTotal(pid, epId)
        return {
          id: `folder-he-${pid}-${epId}`,
          name: episodeDisplayLabel(ep),
          type: 'folder' as const,
          updatedAt: nowLabel(),
          itemCount: total ?? 0
        }
      })
    )
    if (seq !== loadSeq) return
    assets.value = folders
    return
  }

  if (props.type === 'history' && path0 && props.category?.startsWith('episode-')) {
    const m = props.category.match(/^episode-(\d+)-(\d+)$/)
    if (m) {
      const pid = Number(m[1])
      const ep = Number(m[2])
      const project = findAssetCenterProject(props.assetCenterTree, pid)
      const episode = findAssetCenterEpisode(project, ep)
      const categories = getEpisodeCategories(episode)
      const needListCount = categories.some((c) => typeof c.assetCount !== 'number')
      const countByCode = needListCount
        ? countRowsByCategoryCode(await fetchPersonalCenterAllRows(pid, ep))
        : new Map<string, number>()
      if (seq !== loadSeq) return
      assets.value = buildCategoryFolderItems(
        categories,
        countByCode,
        `folder-hc-${pid}-${ep}-`,
        nowLabel()
      )
      return
    }
  }

  if (props.type === 'history' && props.category) {
    const dash = props.category.indexOf('-')
    if (dash > 0) {
      const parts = props.category.split('-')
      const pid = Number(parts[0])
      if (!Number.isFinite(pid) || pid <= 0) {
        assets.value = []
        return
      }
      let ep = 0
      let docKey = ''
      if (parts.length >= 3 && /^\d+$/.test(parts[1] ?? '')) {
        ep = Number(parts[1])
        docKey = parts.slice(2).join('-')
      } else {
        docKey = parts.slice(1).join('-')
        ep = props.episodeId != null && props.episodeId >= 0 ? Number(props.episodeId) : 0
      }
      if (docKey && docKey !== 'project') {
        const rows = await fetchPersonalCenterRowsByCategory(pid, ep, docKey)
        if (seq !== loadSeq) return
        assets.value = rows.map(mapUserAssetRowToImportItem)
        return
      }
    }
  }

  if (props.type === 'history') {
    assets.value = []
    return
  }

  assets.value = []
}

async function loadAssets() {
  const seq = ++loadSeq
  listLoading.value = true
  assets.value = []
  try {
    await runLoadAssets(seq)
  } catch (e: any) {
    if (seq === loadSeq) {
      message.error(e?.msg ?? e?.message ?? '加载资产失败')
      assets.value = []
    }
  } finally {
    if (seq === loadSeq) listLoading.value = false
  }
}

onMounted(() => {
  void loadAssets()
})

watch(
  () => [
    props.category,
    props.type,
    props.projectId,
    props.episodeId,
    props.assetCenterTree,
    props.currentPath,
    props.selectedCategory
  ],
  () => {
    selectedAssetId.value = null
    void loadAssets()
  },
  { deep: true }
)

const selectAsset = (asset: any) => {
  if (asset.type === 'folder') {
    emit('navigate', asset.name)
  } else if (props.multiple) {
    selectedAssetId.value = null
    emit('select', asset)
  } else {
    selectedAssetId.value = selectedAssetId.value === asset.id ? null : asset.id
    emit('select', asset)
  }
}

const handleAssetThumbnailClick = (asset: any) => {
  if (asset.type === 'folder') {
    emit('navigate', asset.name)
    return
  }
  if (displayMode.value === 'file' || asset.type === 'script' || asset.type === 'video') {
    void handleFilePreview(asset)
    return
  }
  if (props.multiple) {
    selectedAssetId.value = null
    emit('select', asset)
  } else {
    selectedAssetId.value = selectedAssetId.value === asset.id ? null : asset.id
    emit('select', asset)
  }
}

const handleThumbnailClick = handleAssetThumbnailClick

const formatTime = (time: string) => {
  const raw = String(time || '').trim()
  if (!raw) return ''
  const date = new Date(raw.includes('-') ? raw.replace(/-/g, '/') : raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN')
}

function showAssetMeta(asset: any) {
  return !!formatTime(asset.updatedAt)
}
</script>

<style lang="scss" scoped>
.asset-list {
  padding: 0.875rem;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
}

.asset-list__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  color: var(--home-muted, #8e97a5);
  font-size: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
}

.empty-icon-wrapper {
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  color: var(--home-muted, #8e97a5);
  font-size: 1rem;
}

/* 文件夹 / 文件卡片 / 图片 网格 */
.assets-grid {
  display: grid;
  gap: 0.75rem;
}

.assets-grid--folder {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

/* 文件卡片：最初宽扁比例 */
.assets-grid--card {
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
}

.assets-grid--image {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 1200px) {
  .assets-grid--image {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .assets-grid--image {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.asset-card {
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #0b172a;
  position: relative;
  min-width: 0;
}

.asset-card:hover,
.asset-card.active {
  border-color: #4ae7fd;
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.25);
  background: #0d1a31;
}

.asset-card--image:hover:not(.asset-card--selected) {
  border-color: rgba(74, 231, 253, 0.5);
  box-shadow: none;
  background: #0b172a;
}

.asset-card--image.asset-card--selected {
  border-color: rgba(74, 231, 253, 0.6);
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.25);
  background: #0b172a;
}

.asset-card-select {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
  z-index: 3;
  cursor: pointer;
  /* 需可点：下方 PreviewableImageThumb 会 stop 并走预览，不能穿透 */
  pointer-events: auto;
}

.asset-thumbnail {
  width: 100%;
  background: #07101f;
  display: flex;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
}

.asset-thumbnail--folder {
  aspect-ratio: 328 / 133;
  align-items: center;
  justify-content: center;
}

/* 文件卡片：与文件夹同比例，图标居中 */
.asset-thumbnail--file {
  aspect-ratio: 328 / 133;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: #0a1528;
  }
}

.asset-thumbnail--image {
  aspect-ratio: 4 / 3;
  align-items: stretch;
  justify-content: stretch;
  min-height: 120px;
}

.asset-card--image {
  display: flex;
  flex-direction: column;
}

.asset-image-placeholder {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 24px;
  box-sizing: border-box;
  opacity: 0.45;
}

.asset-info--image {
  padding: 8px 10px 10px;
  flex-shrink: 0;
}

.asset-info--image .asset-name {
  margin-bottom: 0;
  font-size: 13px;
  line-height: 1.3;
}

.asset-icon {
  font-size: 3rem;
  color: var(--gray-400);
}

.asset-icon--center {
  margin: auto;
}

.folder-icon {
  width: 46px !important;
  height: 42px !important;
  color: #90a2bb;
  flex-shrink: 0;
}

.featured-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: var(--accent-500);
  color: #121212 !important;
  font-size: 0.75rem;
  padding: 4px;
  border-radius: var(--radius-sm);
  z-index: 2;
}

.asset-info {
  padding: 0.5rem 0.625rem 0.625rem;
  background: rgba(8, 14, 24, 0.9);
}

.asset-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  gap: 0.5rem;
}

.asset-count,
.asset-time {
  color: #8e97a5 !important;
}

/* 与 ImportScriptModal / StoryboardScriptModal 同高同宽策略 */
.import-asset-preview-modal-shell {
  color: #e6edf3;
  height: 698px;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  background: #191a1d;
}

.import-asset-preview-modal-header {
  flex-shrink: 0;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px;
}

.import-asset-preview-modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #e6edf3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.import-asset-preview-modal-close {
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
  font-size: 16px;
  flex-shrink: 0;

  &:hover {
    color: #4ae7fd;
  }
}

.import-asset-preview-modal-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 16px 16px;
}

.import-asset-preview-modal__loading {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8e97a5;
}

.import-asset-preview-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  color: #e6edf3;
  font-size: 14px;
  line-height: 1.6;
}

.import-asset-preview-modal__plain {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  color: #d9e6f2;
}

.import-asset-preview-modal__img {
  max-width: 100%;
  border-radius: 6px;
  display: block;
}

.import-asset-preview-modal__video,
.import-asset-preview-modal__audio {
  width: 100%;
  max-width: 100%;
  border-radius: 6px;
  display: block;
}

.import-asset-preview-modal__empty {
  color: #8e97a5;
  text-align: center;
  padding: 2rem 0;
}

:deep(.import-asset-preview-modal__rich) {
  color: #e6edf3;

  p {
    margin: 0 0 0.75em;
  }
}
</style>

<!-- Modal teleport 到 body：隐藏 Ant 默认头，高度由内层 shell 控制 -->
<style lang="scss">
.ant-modal-wrap.import-asset-preview-modal-wrap .ant-modal.import-asset-preview-modal .ant-modal-content {
  padding: 0 !important;
  overflow: hidden;
  border-radius: 12px;
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.ant-modal-wrap.import-asset-preview-modal-wrap .ant-modal.import-asset-preview-modal .ant-modal-header {
  display: none !important;
}

.ant-modal-wrap.import-asset-preview-modal-wrap .ant-modal.import-asset-preview-modal .ant-modal-body {
  padding: 0 !important;
  background: #191a1d;
}
</style>
