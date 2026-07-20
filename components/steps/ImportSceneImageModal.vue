<template>
  <a-modal
    v-model:open="modalOpen"
    :width="1100"
    :footer="null"
    :closable="true"
    centered
    class="import-scene-image-modal"
    wrap-class-name="create-flow-modal"
    @cancel="handleCancel"
  >
    <template #title>
      <ModalTitleWatermark :title="props.title" watermark="IMPORT" />
    </template>

    <div class="import-body">
      <div class="import-tab-bar">
        <div></div>
        <div class="import-tab-bar__inner">
          <button
            type="button"
            :class="['import-tab', { 'import-tab--active': activeSubTab === 'current' }]"
            @click="activeSubTab = 'current'"
          >
            本作品资产
          </button>
          <button
            type="button"
            :class="['import-tab', { 'import-tab--active': activeSubTab === 'history' }]"
            @click="activeSubTab = 'history'"
          >
            历史作品资产
          </button>
        </div>
        <span class="import-tab-bar__count">{{ countLabel }}：{{ scenesList.length }}项</span>
      </div>

      <div class="import-content">
        <div v-if="loading" class="import-empty">
          <InboxOutlined class="import-empty__icon" />
          <p class="import-empty__text">加载中...</p>
        </div>
        <div v-else-if="scenesList.length > 0" class="import-scenes-row">
          <button
            v-for="scene in scenesList"
            :key="scene.id"
            type="button"
            :class="[
              'import-scene-card',
              { 'import-scene-card--selected': selectedSceneId === scene.id }
            ]"
            @click="selectScene(scene)"
          >
            <div class="import-scene-card__thumb">
              <img v-if="scene.thumbnail" :src="scene.thumbnail" :alt="scene.name" />
              <div v-else class="import-scene-card__placeholder">
                <FileTextOutlined />
              </div>
            </div>
            <div class="import-scene-card__label">
              <span class="import-scene-card__name">{{ scene.name }}</span>
            </div>
          </button>
        </div>
        <div v-else class="import-empty">
          <InboxOutlined class="import-empty__icon" />
          <p class="import-empty__text">暂无可导入资产</p>
        </div>
      </div>
    </div>

    <div class="import-footer">
      <div class="import-footer__left">
        <a-button class="import-btn-dashed" @click="handleSelectLocalFile">
          <template #icon><UploadOutlined /></template>
          选择本地文件
        </a-button>
        <a-button class="import-btn-dashed" @click="handleOpenAssetLibrary">
          <template #icon><FolderOutlined /></template>
          资产库导入
        </a-button>
      </div>
      <div class="import-footer__right">
        <a-button class="import-btn-cancel" size="large" @click="handleCancel">
          <div class="text-gradient">取消</div>
        </a-button>
        <a-button
          type="primary"
          size="large"
          class="import-btn-ok"
          :disabled="!selectedAsset"
          @click="handleConfirm"
        >
          确定
        </a-button>
      </div>
    </div>

    <ImportScriptModal
      v-model:open="showAssetLibraryModal"
      title="导入图片"
      @import="handleDirectImport"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  UploadOutlined,
  FolderOutlined,
  FileTextOutlined,
  InboxOutlined
} from '@ant-design/icons-vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import ImportScriptModal from './ImportScriptModal.vue'
import { useCreationStore } from '~/stores/creation'
import { userAssetRpsFormList, userProjectList } from '~/utils/businessApi'
import type { UserAssetApiType } from '~/types/business-api'

interface Props {
  open: boolean
  assetType?: UserAssetApiType
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  assetType: 'scene',
  title: '导入场景'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  import: [file: File | string]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const activeSubTab = ref<'current' | 'history'>('current')
const selectedAsset = ref<any>(null)
const selectedSceneId = ref<string | null>(null)
const showAssetLibraryModal = ref(false)
const scenesList = ref<any[]>([])
const loading = ref(false)
const creationStore = useCreationStore()

const titleMap: Record<string, string> = {
  scene: '导入场景',
  character: '导入角色',
  prop: '导入道具'
}

const countLabelMap: Record<string, string> = {
  scene: '场景数',
  character: '角色数',
  prop: '道具数'
}

const countLabel = computed(() => countLabelMap[props.assetType] || '资产数')

function pickThumb(form: any): string {
  const imgs = Array.isArray(form?.images) ? form.images : []
  const inUse = imgs.find((x: any) => Number(x?.isUse) === 1)
  const latest = imgs[0]
  return inUse?.imageUrl || latest?.imageUrl || form?.imageUrl || ''
}

async function loadCurrentAssets() {
  const projectId = creationStore.currentProjectId
  if (!projectId) {
    scenesList.value = []
    return
  }
  const payload: Record<string, any> = {
    projectId,
    assetType: props.assetType
  }
  if (creationStore.currentEpisodeId != null && creationStore.currentEpisodeId >= 0) {
    payload.episodeId = creationStore.currentEpisodeId
  }
  const rows = await userAssetRpsFormList(payload)
  scenesList.value = rows
    .map((row, index) => {
      const thumbnail = pickThumb(row)
      return {
        id: `current-${row.id}-${index}`,
        name: row.name || `${countLabel.value.replace('数', '')}${index + 1}`,
        thumbnail,
        url: thumbnail,
        rpsFormId: row.id,
        rpsImageId: row.currentImageId,
        type: props.assetType
      }
    })
    .filter((x) => !!x.thumbnail)
}

async function loadHistoryAssets() {
  const { rows: projects } = await userProjectList({ pageNum: 1, pageSize: 50 })
  const currentProjectId = Number(creationStore.currentProjectId || 0)
  const historyProjects = (projects || []).filter((p) => Number(p.id) !== currentProjectId)
  if (!historyProjects.length) {
    scenesList.value = []
    return
  }
  const formBatches = await Promise.all(
    historyProjects.map(async (p) => {
      try {
        const forms = await userAssetRpsFormList({
          projectId: Number(p.id),
          assetType: props.assetType
        })
        return forms.map((f, index) => {
          const thumbnail = pickThumb(f)
          return {
            id: `history-${p.id}-${f.id}-${index}`,
            name: f.name || `${countLabel.value.replace('数', '')}${index + 1}`,
            thumbnail,
            url: thumbnail,
            projectName: p.projectName || `项目${p.id}`,
            rpsFormId: f.id,
            rpsImageId: f.currentImageId,
            type: props.assetType
          }
        })
      } catch {
        return []
      }
    })
  )
  scenesList.value = formBatches.flat().filter((x) => !!x.thumbnail)
}

async function loadScenesByTab() {
  loading.value = true
  try {
    if (activeSubTab.value === 'current') await loadCurrentAssets()
    else await loadHistoryAssets()
  } catch (e: any) {
    scenesList.value = []
    message.error(e?.msg || e?.message || `${titleMap[props.assetType] || '资产'}加载失败`)
  } finally {
    loading.value = false
  }
}

const selectScene = (scene: any) => {
  selectedSceneId.value = scene.id
  selectedAsset.value = { ...scene, type: props.assetType }
  message.success(`${titleMap[props.assetType] || '资产'}已选择`)
}

const handleSelectLocalFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: Event) => {
    const t = e.target as HTMLInputElement
    const file = t.files?.[0]
    if (file) {
      emit('import', file)
      modalOpen.value = false
      selectedAsset.value = null
      selectedSceneId.value = null
      showAssetLibraryModal.value = false
      message.success('导入成功')
    }
  }
  input.click()
}

const handleOpenAssetLibrary = () => {
  showAssetLibraryModal.value = true
}

const handleDirectImport = (asset: any) => {
  if (typeof asset === 'string') {
    emit('import', asset)
  } else if (asset && asset.type === 'image') {
    emit('import', asset)
  } else {
    emit('import', asset)
  }
  showAssetLibraryModal.value = false
  modalOpen.value = false
  selectedAsset.value = null
  selectedSceneId.value = null
  message.success('导入成功')
}

const handleConfirm = () => {
  if (!selectedAsset.value) {
    message.warning('请选择要导入的图片或场景')
    return
  }

  if (selectedAsset.value.type === 'local') {
    emit('import', selectedAsset.value.file)
  } else if (selectedAsset.value.type === 'library') {
    const assetObj = selectedAsset.value.url
      ? { url: selectedAsset.value.url, name: selectedAsset.value.name || '导入的图片' }
      : { ...selectedAsset.value }
    emit('import', assetObj)
  } else if (selectedAsset.value.type === 'scene' || selectedAsset.value.type === 'character' || selectedAsset.value.type === 'prop') {
    emit('import', selectedAsset.value)
  }

  modalOpen.value = false
  selectedAsset.value = null
  selectedSceneId.value = null
  message.success('导入成功')
}

const handleCancel = () => {
  modalOpen.value = false
  selectedAsset.value = null
  selectedSceneId.value = null
  showAssetLibraryModal.value = false
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    selectedAsset.value = null
    selectedSceneId.value = null
    void loadScenesByTab()
  }
)

watch(
  () => activeSubTab.value,
  () => {
    if (!props.open) return
    selectedAsset.value = null
    selectedSceneId.value = null
    void loadScenesByTab()
  }
)
</script>

<style lang="scss" scoped>
.import-scene-image-modal :deep(.ant-modal) {
  background: transparent !important;
}

.import-scene-image-modal :deep(.ant-modal-content) {
  padding: 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.import-scene-image-modal :deep(.ant-modal-header) {
  margin: 0;
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: none !important;
  background: #191a1d;
}

.import-scene-image-modal :deep(.ant-modal-title) {
  width: 100%;
}

.import-scene-image-modal :deep(.ant-modal-close) {
  top: 1rem;
  inset-inline-end: 1rem;
  color: rgba(255, 255, 255, 0.75);
}

.import-scene-image-modal :deep(.ant-modal-close:hover) {
  color: #4ae7fd;
}

.import-scene-image-modal :deep(.ant-modal-body) {
  padding: 0;
  background: #191a1d;
}

.import-body {
  background: #191a1d;
  min-height: 400px;
}

.import-subtitle {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #8e97a5;
  text-align: center;
}

/* Tab 条：Figma #202434 底条 + 选中青底 */
.import-tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 40px;
  padding: 6px 0.75rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  background: #202434;
}

.import-tab-bar__inner {
  display: flex;
  align-items: center;
  gap: 0;
}

.import-tab {
  position: relative;
  margin: 0;
  padding: 0.35rem 1.1rem;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #ffffff;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.import-tab:hover {
  color: #e6edf3;
}
.import-tab-bar {
  .import-tab-bar__inner {
    background: rgba(41, 75, 93,1);
    border-radius: 8px;
    .import-tab--active {
      background: #4ae7fd;
      color: #121212 !important;
    }
  }
}

.import-tab-bar__count {
  flex-shrink: 0;
  font-size: 12px;
  color: #8e97a5;
  font-family: 'PingFang SC', system-ui, sans-serif;
}

.import-content {
  min-height: 220px;
  max-height: min(420px, 52vh);
  overflow-y: auto;
  border-radius: 8px;
}

.import-scenes-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  padding: 0.25rem 0 0.5rem;
}

@media (max-width: 900px) {
  .import-scenes-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .import-scenes-row {
    grid-template-columns: 1fr;
  }
}

.import-scene-card {
  position: relative;
  display: block;
  margin: 0;
  padding: 0;
  aspect-ratio: 328 / 154;
  border: 1px solid rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: #111621;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.import-scene-card:hover {
  border-color: rgba(74, 231, 253, 0.45);
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.15);
}

.import-scene-card--selected {
  border: 2px solid #4ae7fd;
  box-shadow:
    0 0 0 1px rgba(74, 231, 253, 0.25),
    0 8px 24px rgba(0, 163, 255, 0.12);
}

.import-scene-card__thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #111621;
}

.import-scene-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.import-scene-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(142, 151, 165, 0.6);
  font-size: 2rem;
}

.import-scene-card__label {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.5rem;
  background: rgba(18,18,18,.7);
}

.import-scene-card__name {
  font-size: 14px;
  line-height: 1.43;
  color: #ffffff;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.import-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  color: #8e97a5;
}

.import-empty__icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
  opacity: 0.65;
}

.import-empty__text {
  margin: 0;
  font-size: 0.9375rem;
}

.import-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: #191a1d;
}

.import-footer__left {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.import-footer__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.import-btn-dashed {
  border-radius: 8px !important;
  border: 1px dashed rgba(74, 231, 253, 0.35) !important;
  background: #121212 !important;
  color: #ffffff !important;
  height: 28px;
  padding: 0 10px !important;
  font-size: 14px !important;
}

.import-btn-dashed:hover {
  border-color: rgba(74, 231, 253, 0.55) !important;
  color: #4ae7fd !important;
}

.import-btn-cancel {
  min-width: 96px;
  border-radius: 10px !important;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
  background: rgba(18, 18, 18, 1) !important;
  color: #e6edf3 !important;
}

.import-btn-cancel:hover {
  border-color: rgba(74, 231, 253, 0.45) !important;
  color: #4ae7fd !important;
}

.import-btn-ok {
  min-width: 100px;
  border-radius: 10px !important;
  border: none !important;
  font-weight: 600;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  color: #fff !important;
  box-shadow: none !important;
}

.import-btn-ok:hover:not(:disabled) {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  color: #fff !important;
}
</style>
