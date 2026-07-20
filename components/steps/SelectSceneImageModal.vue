<template>
  <a-modal
    v-model:open="modalOpen"
    :width="1200"
    :footer="null"
    :title="null"
    class="select-scene-image-modal"
    wrap-class-name="create-flow-modal select-scene-image-modal-wrap"
    @cancel="handleCancel"
  >
    <!-- 头部：标题和场景切换器 -->
    <div class="modal-header">
      <div class="header-top">
        <ModalTitleWatermark :title="title" watermark="IMPORT" />
      </div>
      <!-- 场景切换器：显示所有场景，当前场景高亮 -->
      <div class="header-tabs">
        <div class="import-tab-bar__inner">
          <HorizontalScrollTabBar ref="sceneTabBarRef" track-class="import-tab-inner">
            <button
              v-for="(scene, index) in scenes"
              :key="index"
              type="button"
              :class="['import-tab', { 'import-tab--active': currentSceneIndex === index }]"
              @click="switchScene(index)"
            >
              <span class="scene-tab-name">{{ scene.name || `未命名${index + 1}` }}</span>
            </button>
            <template #suffix>
              <div class="scene-count">场景数: {{ scenes.length }}项</div>
            </template>
          </HorizontalScrollTabBar>
        </div>
      </div>
    </div>

    <!-- 内容区域：显示当前选中场景的场景图列表 -->
    <div class="import-container">
      <div class="content-area">
        <div v-if="currentSceneImages.length === 0" class="empty-state">
          <div class="empty-icon-wrapper">
            <PictureOutlined class="empty-icon" />
          </div>
          <p class="empty-text">该场景暂无场景图</p>
        </div>
        <div v-else class="images-grid">
          <div
            v-for="(img, index) in currentSceneImages"
            :key="img.id || index"
            :class="[
              'image-card',
              {
                selected: isMulti ? selectedImageIndexSet.has(index) : selectedImageIndex === index
              }
            ]"
            @click="selectImage(index)"
          >
            <div class="image-wrapper">
              <img v-if="img.url" :src="img.url" alt="" class="scene-image" />
              <div v-else class="image-placeholder">
                <PictureOutlined />
                <p>暂无图片</p>
              </div>
            </div>
            <div class="image-info">
              <p class="image-title">{{ img.title || `场景图${index + 1}` }}</p>
              <div class="image-meta">
                <span v-if="img.source" class="image-source">{{ img.source }}</span>
                <span v-if="img.importDate" class="image-date">{{
                  formatDate(img.importDate)
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="modal-footer">
      <div class="footer-left">
        <a-button @click="handleUploadLocalImage">
          <template #icon><UploadOutlined /></template>
          选择本地文件
        </a-button>
        <a-button @click="showAssetLibraryModal = true">
          <template #icon><FolderOutlined /></template>
          资产库导入
        </a-button>
      </div>
      <div class="footer-right">
        <a-button @click="handleCancel">取消</a-button>
        <a-button
          type="primary"
          @click="handleConfirm"
          :disabled="isMulti ? selectedImageIndexSet.size === 0 : selectedImageIndex === null"
        >
          {{ isMulti ? '导入所选图片' : '选择此场景图' }}
        </a-button>
      </div>
    </div>

    <ImportScriptModal v-model:open="showAssetLibraryModal" @import="handleAssetLibraryImport" />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import HorizontalScrollTabBar from '~/components/common/HorizontalScrollTabBar.vue'
import { message } from 'ant-design-vue'
import {
  PictureOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  FolderOutlined
} from '@ant-design/icons-vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import ImportScriptModal from './ImportScriptModal.vue'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'

interface Props {
  open: boolean
  scenes: Array<{ name: string; images?: any[] }>
  editingSceneIndex: number // 当前正在编辑的场景索引
  /** 是否多选（默认单选） */
  multiple?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  title: '导入场景'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [sceneIndex: number, imageIndex: number, image: any]
  'select-multiple': [payload: { sceneIndex: number; images: any[] }]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const sceneTabBarRef = ref<InstanceType<typeof HorizontalScrollTabBar> | null>(null)

function refreshSceneTabBar() {
  sceneTabBarRef.value?.refresh()
}

function scrollActiveSceneTabIntoView() {
  nextTick(() => {
    sceneTabBarRef.value?.scrollItemIntoView('.import-tab--active')
    sceneTabBarRef.value?.refresh()
  })
}

const currentSceneIndex = ref(props.editingSceneIndex)
const selectedImageIndex = ref<number | null>(null)
const selectedImageIndexSet = ref<Set<number>>(new Set())
const isMulti = computed(() => !!props.multiple)
const showAssetLibraryModal = ref(false)
const extraImagesBySceneIndex = ref<Record<number, any[]>>({})

function ensureSceneExtraImages(index: number): any[] {
  if (!extraImagesBySceneIndex.value[index]) {
    extraImagesBySceneIndex.value[index] = []
  }
  return extraImagesBySceneIndex.value[index]
}

const currentSceneImages = computed(() => {
  const scene = props.scenes[currentSceneIndex.value]
  const extras = extraImagesBySceneIndex.value[currentSceneIndex.value] || []
  return [...(scene?.images || []), ...extras]
})

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 切换场景
const switchScene = (index: number) => {
  currentSceneIndex.value = index
  selectedImageIndex.value = null // 切换场景时清空选择
  selectedImageIndexSet.value = new Set()
  scrollActiveSceneTabIntoView()
}

watch(
  () => [props.open, props.scenes.length],
  ([open]) => {
    if (open) {
      nextTick(() => {
        refreshSceneTabBar()
        scrollActiveSceneTabIntoView()
      })
    }
  }
)

// 选择图片
const selectImage = (index: number) => {
  if (isMulti.value) {
    const next = new Set(selectedImageIndexSet.value)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    selectedImageIndexSet.value = next
    return
  }
  selectedImageIndex.value = index
}

// 取消
const handleCancel = () => {
  modalOpen.value = false
  selectedImageIndex.value = null
  selectedImageIndexSet.value = new Set()
}

// 确认选择
const handleConfirm = () => {
  if (isMulti.value) {
    if (selectedImageIndexSet.value.size === 0) {
      message.warning('请选择要导入的图片')
      return
    }
    const indices = Array.from(selectedImageIndexSet.value).sort((a, b) => a - b)
    const images = indices.map((i) => currentSceneImages.value[i]).filter(Boolean)
    if (!images.length) {
      message.error('选择的图片不存在')
      return
    }
    emit('select-multiple', { sceneIndex: currentSceneIndex.value, images })
    modalOpen.value = false
    selectedImageIndexSet.value = new Set()
    message.success(`已选择 ${images.length} 张图片`)
    return
  }

  if (selectedImageIndex.value === null) {
    message.warning('请选择要添加的场景图')
    return
  }

  const image = currentSceneImages.value[selectedImageIndex.value]
  if (!image) {
    message.error('选择的场景图不存在')
    return
  }

  // 发送选择事件：场景索引、图片索引、图片数据
  emit('select', currentSceneIndex.value, selectedImageIndex.value, image)
  modalOpen.value = false
  selectedImageIndex.value = null
  message.success('场景图已选择')
}

const handleUploadLocalImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const url = await uploadImageToOssWithToast(file)
    if (!url) return

    const now = new Date().toISOString()
    const list = ensureSceneExtraImages(currentSceneIndex.value)
    list.push({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      thumbnail: url,
      title: file.name.replace(/\.[^/.]+$/, '') || `场景图${currentSceneImages.value.length + 1}`,
      source: '本地上传',
      importDate: now
    })
    message.success('本地图片已添加')
  }
  input.click()
}

const handleAssetLibraryImport = (asset: any) => {
  const imageUrl = asset?.url || asset?.thumbnail
  if (!imageUrl) {
    message.warning('未获取到可用图片地址')
    return
  }

  const now = new Date().toISOString()
  const list = ensureSceneExtraImages(currentSceneIndex.value)
  list.push({
    id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: imageUrl,
    thumbnail: imageUrl,
    title: asset?.name || `场景图${currentSceneImages.value.length + 1}`,
    source: '资产库导入',
    importDate: now
  })
  showAssetLibraryModal.value = false
  message.success('已从资产库添加图片')
}
</script>

<style lang="scss" scoped>
.select-scene-image-modal :deep(.ant-modal-content) {
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.35);
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: min(640px, 68vh);
  max-height: calc(100dvh - 48px);
}

.select-scene-image-modal :deep(.ant-modal-body) {
  padding: 0;
  background: #191a1d;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.select-scene-image-modal :deep(.ant-modal-header) {
  display: none;
}

/* 头部 */
.modal-header {
  flex-shrink: 0;
  padding: 0 0 0.75rem;
  background: #191a1d;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.header-top {
  display: block;
}

/* 场景切换器 */
.header-tabs {
  display: flex;
  justify-content: center;
  width: 100%;
}

.import-tab-bar__inner {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 6px 16px;
  background: #202434;
  border-radius: 8px;
}

.import-tab-inner {
  background: #294b5d;
  border-radius: 8px;
  gap: 0;
}

.import-tab {
  position: relative;
  margin: 0;
  padding: 0.25rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #d9e6f2;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
  white-space: nowrap;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.import-tab:hover {
  color: #ffffff;
}

.import-tab--active {
  background: #4ae7fd;
  span {
    color: #121212 !important;
  }
}

.scene-tab-name {
  font-size: 14px;
}

.scene-count {
  font-size: 14px;
  color: #d9e6f2;
  white-space: nowrap;
}

/* 内容区域 */
.import-container {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: min(540px, 56vh);
  border-radius: 8px;
  overflow: hidden;
}

.content-area {
  flex: 1 1 auto;
  min-height: min(480px, 50vh);
  padding: 1.5rem;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 160px;
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
  color: var(--gray-300);
}

.empty-text {
  color: #8e97a5;
  font-size: 1rem;
}

/* 图片网格 */
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.image-card {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(18, 18, 18, 0.42);
  cursor: pointer;
  transition: all 0.2s ease;
}

.image-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
}

.image-card.selected {
  border-color: rgba(74, 231, 253, 1);
  box-shadow:
    0 0 0 1px rgba(74, 231, 253, 0.25),
    0 0 16px rgba(74, 231, 253, 0.12);
}

.image-wrapper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: rgba(6, 10, 18, 0.55);
}

.scene-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--gray-400);
  gap: 0.5rem;
}

.check-icon {
  font-size: 3rem;
  color: var(--primary-600);
}

.image-info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
  background: rgba(18,18, 18, 0.7);
}

.image-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e6edf3;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: #8e97a5;
  line-height: 1;
}

.image-source {
  padding: 0;
  background: transparent;
  color: #8e97a5;
}

.image-date {
  color: #8e97a5;
}

/* 底部操作栏 */
.modal-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #191a1d;
  padding: 16px 0 0;
}

.footer-left,
.footer-right {
  display: flex;
  gap: 0.75rem;
}

.footer-left :deep(.ant-btn),
.footer-right :deep(.ant-btn) {
  min-width: 96px;
  border-radius: 10px;
  height: 34px;
}
.footer-left :deep(.ant-btn){
  font-size: 12px;
}
.footer-left :deep(.ant-btn-default),
.footer-right :deep(.ant-btn-default) {
  border: 1px solid rgba(74, 231, 253, 0.3);
  background: rgba(18, 18, 18, 1);
  color: #e6edf3;
}

.footer-right :deep(.ant-btn-primary) {
  border: none;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
}

/* 小分辨率：列表区高度由 create-flow-compact-viewport.css 统一控制 */
@media (max-width: 1600px) and (max-height: 900px) {
  .select-scene-image-modal :deep(.ant-modal-content) {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    height: 100% !important;
    max-height: 100% !important;
  }
}
</style>
