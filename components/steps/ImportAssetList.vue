<template>
  <div class="asset-list">
    <div v-if="listLoading" class="asset-list__loading">加载中…</div>
    <template v-else>
      <div v-if="assets.length === 0" class="empty-state">
        <div class="empty-icon-wrapper">
          <span class="empty-icon">N</span>
        </div>
        <p class="empty-text">暂无数据</p>
      </div>
      <div v-else class="assets-grid">
        <div
          v-for="asset in assets"
          :key="asset.id"
          :class="[
            'asset-card',
            { active: isAssetSelected(asset), 'is-folder': asset.type === 'folder' }
          ]"
          @click="selectAsset(asset)"
        >
          <div class="asset-thumbnail" @click.stop="handleThumbnailClick(asset)">
            <FileTextOutlined v-if="asset.type === 'script'" class="asset-icon" />
            <!--            <FolderOutlined v-else-if="asset.type === 'folder'" class="asset-icon folder-icon" />-->
            <img
              v-else-if="asset.type === 'folder'"
              src="@/assets/img/icon/file_gray.svg"
              alt=""
              class="asset-icon folder-icon"
            />
            <VideoCameraOutlined v-else-if="asset.type === 'video'" class="asset-icon" />
            <a-image
              v-else-if="asset.thumbnail && asset.type === 'image'"
              :src="asset.thumbnail"
              :alt="asset.name"
              :preview="{
                src: asset.thumbnail
              }"
              class="asset-image"
              @click.stop
            />
            <img v-else-if="asset.thumbnail" :src="asset.thumbnail" :alt="asset.name" />
            <FileTextOutlined v-else class="asset-icon" />
            <span v-if="asset.featured" class="featured-badge">精选</span>
          </div>
          <div class="asset-info">
            <div class="asset-name">{{ asset.name }}</div>
            <div class="asset-meta">
              <span v-if="asset.itemCount !== undefined" class="asset-count"
                >{{ asset.itemCount }}项</span
              >
              <span v-else class="asset-size">{{ formatSize(asset.size) }}</span>
              <span class="asset-time">{{ formatTime(asset.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  FileTextOutlined,
  FolderOutlined,
  RightOutlined,
  VideoCameraOutlined
} from '@ant-design/icons-vue'
import { Image as AImage } from 'ant-design-vue'
import {
  DOCUMENT_KEY_TO_API_TYPE,
  DOCUMENT_STRUCTURE,
  MATERIAL_CATEGORY_ROWS,
  documentLabelToKey,
  mapUserAssetRowToImportItem,
  materialKeyToApiType,
  materialLabelToKey,
  fetchOfficialTypeTotal,
  fetchPersonalTypeTotal,
  fetchOfficialAssetsAsRows,
  fetchPersonalRpsAsRows
} from '~/utils/importAssetModalQuery'

interface Props {
  category: string | null
  type: string
  projectId?: string | null
  /** 本作品 personal 查询时与 projectId 一起传给接口 */
  episodeId?: number | null
  currentPath?: string[]
  selectedCategory?: any
  multiple?: boolean
  selectedAssetIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
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

const isAssetSelected = (asset: any) => {
  if (props.multiple && props.selectedAssetIds?.length) {
    return props.selectedAssetIds.includes(asset.id)
  }
  return selectedAssetId.value === asset.id
}

async function runLoadAssets(seq: number) {
  const path0 = props.currentPath.length === 0
  const nowLabel = () => new Date().toLocaleDateString('zh-CN')

  // 素材库：根层分类文件夹（官方统计）
  if (props.type === 'material' && path0 && props.category === 'material-library') {
    const folders = await Promise.all(
      MATERIAL_CATEGORY_ROWS.map(async (c) => {
        let total = 0
        try {
          total = await fetchOfficialTypeTotal(c.apiType)
        } catch {
          total = 0
        }
        return {
          id: `folder-m-${c.key}`,
          name: c.label,
          type: 'folder' as const,
          updatedAt: nowLabel(),
          itemCount: total
        }
      })
    )
    if (seq !== loadSeq) return
    assets.value = folders
    return
  }

  // 素材库：选中某分类或右侧点进子路径 → 官方资产列表
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

  // 本作品：项目节点下显示文档分类文件夹（personal 统计）
  if (props.type === 'current' && path0 && props.category?.startsWith('project-')) {
    const pid = props.projectId ? Number(props.projectId) : NaN
    const ep = props.episodeId != null && props.episodeId >= 0 ? Number(props.episodeId) : 0
    if (!Number.isFinite(pid) || pid <= 0) {
      assets.value = []
      return
    }
    const folders = await Promise.all(
      DOCUMENT_STRUCTURE.map(async (d) => {
        let total = 0
        try {
          total = await fetchPersonalTypeTotal(pid, ep, d.apiType)
        } catch {
          total = 0
        }
        return {
          id: `folder-p-${d.key}`,
          name: d.label,
          type: 'folder' as const,
          updatedAt: nowLabel(),
          itemCount: total
        }
      })
    )
    if (seq !== loadSeq) return
    assets.value = folders
    return
  }

  // 本作品：选中左侧具体文档节点 `{projectId}-{docKey}`
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
      const apiType = DOCUMENT_KEY_TO_API_TYPE[docKey] || 'file'
      const ep = props.episodeId != null && props.episodeId >= 0 ? Number(props.episodeId) : 0
      if (Number.isFinite(pid) && pid > 0) {
        const rows = await fetchPersonalRpsAsRows(pid, ep, apiType)
        if (seq !== loadSeq) return
        assets.value = rows.map(mapUserAssetRowToImportItem)
        return
      }
    }
  }

  // 本作品：从项目文件夹网格进入子路径
  if (props.type === 'current' && !path0 && props.projectId) {
    const folderLabel = props.currentPath[props.currentPath.length - 1] || ''
    const docKey = documentLabelToKey(folderLabel)
    if (docKey) {
      const pid = Number(props.projectId)
      const apiType = DOCUMENT_KEY_TO_API_TYPE[docKey] || 'file'
      const ep = props.episodeId != null && props.episodeId >= 0 ? Number(props.episodeId) : 0
      if (Number.isFinite(pid) && pid > 0) {
        const rows = await fetchPersonalRpsAsRows(pid, ep, apiType)
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
    props.currentPath,
    props.selectedCategory
  ],
  () => {
    void loadAssets()
  },
  { deep: true }
)

const selectAsset = (asset: any) => {
  if (asset.type === 'folder') {
    emit('navigate', asset.name)
  } else {
    if (props.multiple) {
      selectedAssetId.value = null
      emit('select', asset)
    } else {
      selectedAssetId.value = asset.id
      emit('select', asset)
    }
  }
}

const handleThumbnailClick = (asset: any) => {
  if (asset.type === 'folder') {
    emit('navigate', asset.name)
  } else {
    if (props.multiple) {
      selectedAssetId.value = null
      emit('select', asset)
    } else {
      selectedAssetId.value = asset.id
      emit('select', asset)
    }
  }
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const formatTime = (time: string) => {
  const date = new Date(time)
  return date.toLocaleDateString('zh-CN')
}
</script>

<style lang="scss" scoped>
.asset-list {
  padding: 0.875rem;
  height: 100%;
  overflow-y: auto;
  .assets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 0.75rem;
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
  }
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
  margin-bottom: 1.5rem;
}

.empty-icon {
  font-size: 4rem;
  font-weight: 700;
  color: var(--gray-300);
  font-family: 'Arial', sans-serif;
}

.empty-text {
  color: var(--home-muted, #8e97a5);
  font-size: 1rem;
}

.asset-card {
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #0b172a;
  position: relative;
  .asset-info {
    padding: 0.5rem 0.625rem 0.625rem;
    background: rgba(8, 14, 24, 0.9);
    .asset-meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      .asset-count,
      .asset-time {
        color: #8e97a5 !important;
      }
    }
  }
}

.asset-card:hover {
  border-color: #4ae7fd;
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.25);
  background: #0d1a31;
}

.asset-card.active {
  border-color: #4ae7fd;
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.25);
  background: #0d1a31;
}

.asset-card.is-folder {
  cursor: pointer;
}

.asset-thumbnail {
  width: 100%;
  aspect-ratio: 328 / 133;
  background: #07101f;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.asset-icon {
  font-size: 3rem;
  color: var(--gray-400);
}

.folder-icon {
  color: #90a2bb;
  width: 46px !important;
  height: 42px !important;
}

.asset-thumbnail img,
.asset-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.asset-thumbnail:hover img,
.asset-thumbnail:hover .asset-image {
  transform: scale(1.05);
}

.asset-image :deep(.ant-image) {
  width: 100%;
  height: 100%;
  display: block;
}

.asset-image :deep(.ant-image-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-image :deep(.ant-image-mask) {
  opacity: 0;
  transition: opacity 0.2s ease;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.875rem;
}

.asset-thumbnail:hover .asset-image :deep(.ant-image-mask) {
  opacity: 1;
}

.asset-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--home-text, #e6edf3);
  margin-bottom: 0.35rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-size,
.asset-time,
.asset-count {
  font-size: 0.75rem;
}

.asset-count {
  color: #8fa4bc;
  font-weight: 400;
}
</style>
