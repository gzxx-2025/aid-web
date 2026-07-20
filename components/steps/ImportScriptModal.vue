<template>
  <a-modal
    v-model:open="modalOpen"
    :width="modalWidth"
    :footer="null"
    :z-index="zIndex"
    centered
    class="import-script-modal"
    wrap-class-name="create-flow-modal import-script-modal-wrap"
    @cancel="handleCancel"
  >
    <div class="import-script-modal-shell">
    <div class="modal-header">
      <ModalTitleWatermark :title="title" watermark="IMPORT" />
      <div class="header-tabs">
        <div class="import-tab-bar__inner">
          <div class="import-tab-inner">
            <button
              type="button"
              :class="['import-tab', { 'import-tab--active': activeTab === 'current' }]"
              @click="activeTab = 'current'"
            >
              本作品资产
            </button>
            <button
              type="button"
              :class="['import-tab', { 'import-tab--active': activeTab === 'history' }]"
              @click="activeTab = 'history'"
            >
              历史作品资产
            </button>
            <button
              type="button"
              :class="['import-tab', { 'import-tab--active': activeTab === 'material' }]"
              @click="activeTab = 'material'"
            >
              素材库
            </button>
            <button
              type="button"
              :class="['import-tab', { 'import-tab--active': activeTab === 'shared' }]"
              @click="activeTab = 'shared'"
            >
              共享给我的资产
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="import-container">
      <!-- 左侧：文档结构树 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h3 class="sidebar-title">导入文档</h3>
        </div>
        <div class="document-tree">
          <!-- 根据标签页显示不同的树结构 -->

          <!-- 本作品资产：显示当前项目节点及其分类 -->
          <template v-if="activeTab === 'current'">
            <p v-if="!displayProjectId" class="tree-empty-hint">
              暂无作品 ID，请从创作流程进入或先创建作品
            </p>
            <div v-else class="tree-item">
              <div
                class="tree-node"
                :class="{ active: selectedNode === `project-${displayProjectId}` }"
                @click.stop="handleProjectClick(`project-${displayProjectId}`, currentProject)"
              >
                <span class="tree-icon" @click.stop="toggleNode(`project-${displayProjectId}`)">{{
                  expandedNodes[`project-${displayProjectId}`] ? '▼' : '▶'
                }}</span>
                <span class="tree-label">{{ currentProject.name }}</span>
              </div>
              <div v-if="expandedNodes[`project-${displayProjectId}`]" class="tree-children">
                <div
                  v-for="item in documentStructure"
                  :key="item.key"
                  :class="[
                    'tree-item',
                    { active: selectedNode === `${displayProjectId}-${item.key}` }
                  ]"
                  @click="selectNode(`${displayProjectId}-${item.key}`, item, currentProject)"
                >
                  <div class="tree-node leaf">
                    <!--                    <FolderOutlined class="tree-icon" />-->
                    <img
                      class="tree-icon"
                      :src="
                        selectedNode === `${displayProjectId}-${item.key}`
                          ? fileWhiteSelIcon
                          : fileWhiteIcon
                      "
                      alt=""
                    />
                    <span class="tree-label">{{ item.label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 历史作品资产：显示"我的作品"树 -->
          <template v-else-if="activeTab === 'history'">
            <div class="tree-item">
              <div class="tree-node" @click="toggleNode('my-works')">
                <span class="tree-icon">{{ expandedNodes['my-works'] ? '▼' : '▶' }}</span>
                <span class="tree-label">我的作品</span>
              </div>
              <div v-if="expandedNodes['my-works']" class="tree-children">
                <!-- 项目列表 -->
                <div
                  v-for="project in projects"
                  :key="project.id"
                  :class="['tree-item', { active: selectedNode === `project-${project.id}` }]"
                >
                  <div
                    class="tree-node"
                    @click.stop="handleProjectClick(`project-${project.id}`, project)"
                  >
                    <span class="tree-icon" @click.stop="toggleNode(`project-${project.id}`)">{{
                      expandedNodes[`project-${project.id}`] ? '▼' : '▶'
                    }}</span>
                    <span class="tree-label">{{ project.name }}</span>
                  </div>
                  <div v-if="expandedNodes[`project-${project.id}`]" class="tree-children">
                    <div
                      v-for="item in documentStructure"
                      :key="item.key"
                      :class="[
                        'tree-item',
                        { active: selectedNode === `${project.id}-${item.key}` }
                      ]"
                      @click="selectNode(`${project.id}-${item.key}`, item, project)"
                    >
                      <div class="tree-node leaf">
                        <!--                        <FolderOutlined class="tree-icon" />-->
                        <img
                          class="tree-icon"
                          :src="
                            selectedNode === `${project.id}-${item.key}`
                              ? fileWhiteSelIcon
                              : fileWhiteIcon
                          "
                          alt=""
                        />

                        <span class="tree-label">{{ item.label }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 素材库：显示素材库树 -->
          <template v-else-if="activeTab === 'material'">
            <div class="tree-item">
              <div
                class="tree-node"
                :class="{ active: selectedNode === 'material-library' }"
                @click="selectMaterialLibrary"
              >
                <span class="tree-icon">{{ expandedNodes['material-library'] ? '▼' : '▶' }}</span>
                <span class="tree-label">素材库</span>
              </div>
              <div v-if="expandedNodes['material-library']" class="tree-children">
                <div
                  v-for="category in materialCategories"
                  :key="category.key"
                  :class="['tree-item', { active: selectedNode === `material-${category.key}` }]"
                  @click="selectMaterialCategory(category)"
                >
                  <div class="tree-node leaf">
                    <img
                      class="tree-icon"
                      :src="
                        selectedNode === `material-${category.key}`
                          ? fileWhiteSelIcon
                          : fileWhiteIcon
                      "
                      alt=""
                    />
                    <span class="tree-label">{{ category.label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 共享给我的资产：显示共享资产树 -->
          <template v-else-if="activeTab === 'shared'">
            <div class="tree-item">
              <div class="tree-node" @click="toggleNode('shared-assets')">
                <span class="tree-icon">{{ expandedNodes['shared-assets'] ? '▼' : '▶' }}</span>
                <span class="tree-label">共享给我的资产</span>
              </div>
              <div v-if="expandedNodes['shared-assets']" class="tree-children">
                <div class="tree-item">
                  <div class="tree-node leaf">
                    <img class="tree-icon" src="@/assets/img/icon/file-white.svg" alt="" />
                    <span class="tree-label">共享文件夹</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 右侧：资产库 -->
      <div class="main-content">
        <!-- 面包屑导航 -->
        <div class="breadcrumb">
          <span
            class="breadcrumb-item"
            :class="isBreadcrumbCurrent(-1) ? 'breadcrumb-current' : 'breadcrumb-muted'"
            @click="navigateToRoot"
          >
            个人资产库
          </span>
          <template v-for="(item, index) in breadcrumbPath" :key="index">
            <RightOutlined class="breadcrumb-separator" />
            <span
              class="breadcrumb-item"
              :class="isBreadcrumbCurrent(index) ? 'breadcrumb-current' : 'breadcrumb-muted'"
              @click="navigateToBreadcrumb(index)"
            >
              {{ item }}
            </span>
          </template>
        </div>

        <!-- 内容区域 -->
        <div class="content-area">
          <AssetList
            :category="selectedNode"
            :type="activeTab"
            :project-id="getProjectId()"
            :episode-id="importModalEpisodeId"
            :current-path="currentPath"
            :selected-category="selectedCategory"
            :multiple="multiple"
            :selected-asset-ids="multiple ? selectedAssetIds : []"
            @select="handleAssetSelect"
            @navigate="handleNavigate"
          />
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="modal-footer">
      <div class="footer-left">
        <a-button class="import-btn-dashed" @click="handleSelectFile">
          <template #icon><UploadOutlined /></template>
          选择本地文件
        </a-button>
      </div>
      <div class="footer-right">
        <a-button @click="handleCancel">
          <div class="text-gradient">取消</div>
        </a-button>
        <a-button
          type="primary"
          :disabled="multiple ? selectedAssets.length === 0 : !selectedAsset"
          @click="handleConfirm"
        >
          确定
        </a-button>
      </div>
    </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { FolderOutlined, UploadOutlined, RightOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import AssetList from './ImportAssetList.vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import { useCreationStore } from '~/stores/creation'
import { userProjectList, userScriptUpload } from '~/utils/businessApi'
import { scriptApiTextToEditorHtml } from '~/utils/htmlPlain'
import fileWhiteIcon from '@/assets/img/icon/file-white.svg'
import fileWhiteSelIcon from '@/assets/img/icon/flie-white-sel.svg'

const creationStore = useCreationStore()

/** 与创作上下文一致，供本作品 personal 资产查询 */
const importModalEpisodeId = computed(() => {
  const e = creationStore.currentEpisodeId
  if (e != null && e >= 0) return e
  return 0
})

/** 判断是否为视频资产（按 type、扩展名或 mimeType） */
function isVideoAsset(asset: any): boolean {
  if (!asset) return false
  if (asset.type === 'video') return true
  const url = asset.url || asset.src || ''
  const name = asset.name || asset.title || ''
  const mime = asset.mimeType || asset.type || ''
  const videoExt = /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i
  if (videoExt.test(url) || videoExt.test(name)) return true
  if (typeof mime === 'string' && mime.startsWith('video/')) return true
  return false
}

interface Props {
  open: boolean
  title?: string
  /** 嵌套弹窗时传入更高 z-index，避免被父级弹窗遮挡 */
  zIndex?: number
  /** 多选模式：为 true 时可多选资产，确定时触发 import-multiple */
  multiple?: boolean
  /** 仅接受某类资产：video 时只允许视频，选择非视频会提示错误 */
  acceptAssetType?: 'image' | 'video' | 'script' | 'all'
  /** 打开时默认顶栏 Tab（如素材库） */
  initialTab?: 'current' | 'history' | 'material' | 'shared' | null
  /** 与 initialTab=material 配合：左侧自动选中的素材分类 key，如 pose / expression / effect */
  initialMaterialCategory?: string | null
  /** 导入剧本前确认（如覆盖当前编辑器内容）；返回 false 则取消导入 */
  beforeScriptImport?: () => Promise<boolean>
}

const props = withDefaults(defineProps<Props>(), {
  title: '导入剧本',
  zIndex: 1000,
  multiple: false,
  acceptAssetType: 'all',
  initialTab: null,
  initialMaterialCategory: null
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  import: [content: string | any]
  'import-multiple': [assets: any[]]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const modalWidth = computed(() => {
  if (typeof window === 'undefined') return 1200
  return Math.min(1200, Math.max(320, window.innerWidth - 48))
})

const selectedNode = ref<string | null>(null)
const selectedCategory = ref<any>(null)
const activeTab = ref('current')
const expandedNodes = ref<Record<string, boolean>>({
  'material-library': true
})
const selectedAsset = ref<any>(null)
/** 多选模式下的已选资产列表 */
const selectedAssets = ref<any[]>([])
const selectedAssetIds = computed(() => selectedAssets.value.map((a) => a.id).filter(Boolean))

// 当前路径（用于文件夹导航）
const currentPath = ref<string[]>([])

// 项目列表（打开弹窗时拉取，并与 Store 当前作品对齐）
const projects = ref<Array<{ id: string; name: string }>>([])

const currentProjectId = ref('')
const currentProject = computed(() => {
  const list = projects.value
  const hit = list.find((p) => p.id === currentProjectId.value)
  if (hit) return hit
  if (list[0]) return list[0]
  const cid = creationStore.currentProjectId
  return { id: cid ? String(cid) : '', name: creationStore.workTitle || '未命名作品' }
})

/** 左侧树与节点 id 使用，避免 project- 空串 */
const displayProjectId = computed(() => {
  if (currentProjectId.value) return currentProjectId.value
  if (creationStore.currentProjectId) return String(creationStore.currentProjectId)
  return projects.value[0]?.id ?? ''
})

async function loadProjectsForModal() {
  try {
    const { rows } = await userProjectList({ pageNum: 1, pageSize: 200 })
    projects.value = rows.map((r) => ({
      id: String(r.id),
      name: r.projectName?.trim() || `项目${r.id}`
    }))
    const cid = creationStore.currentProjectId
    if (cid && projects.value.some((p) => p.id === String(cid))) {
      currentProjectId.value = String(cid)
    } else if (cid) {
      projects.value.unshift({
        id: String(cid),
        name: creationStore.workTitle || `项目${cid}`
      })
      currentProjectId.value = String(cid)
    } else if (projects.value.length) {
      currentProjectId.value = projects.value[0].id
    }
  } catch {
    const cid = creationStore.currentProjectId
    if (cid) {
      projects.value = [{ id: String(cid), name: creationStore.workTitle || `项目${cid}` }]
      currentProjectId.value = String(cid)
    }
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void loadProjectsForModal()
  }
)

// 素材库分类
const materialCategories = [
  { key: 'scene', label: '场景库' },
  { key: 'character', label: '角色库' },
  { key: 'prop', label: '道具库' },
  { key: 'file', label: '文件库' },
  { key: 'pose', label: '姿势库' },
  { key: 'effect', label: '特效库' },
  { key: 'expression', label: '表情库' },
  { key: 'draft', label: '手绘稿库' },
  { key: 'misc', label: '其他素材库' },
  { key: 'style', label: '风格库' }
]

// 面包屑路径
const breadcrumbPath = computed(() => {
  const path: string[] = []

  if (activeTab.value === 'material') {
    // 素材库标签页
    if (selectedNode.value === 'material-library') {
      path.push('素材库')
    } else if (selectedNode.value?.startsWith('material-')) {
      path.push('素材库')
      const categoryKey = selectedNode.value.replace('material-', '')
      const category = materialCategories.find((c) => c.key === categoryKey)
      if (category) {
        path.push(category.label)
      }
    }
  } else if (activeTab.value === 'history') {
    // 历史作品资产标签页
    if (selectedNode.value) {
      const parts = selectedNode.value.split('-')
      if (parts[0] === 'project' && parts.length === 2) {
        // 选中项目节点
        const projectId = parts[1]
        const project = projects.value.find((p) => p.id === projectId)
        if (project) {
          path.push(project.name)
        }
      } else if (parts.length >= 2) {
        // 选中具体分类
        const projectId = parts[0]
        const categoryKey = parts[1]
        const project = projects.value.find((p) => p.id === projectId)
        if (project) {
          path.push(project.name)
          const category = documentStructure.find((s) => s.key === categoryKey)
          if (category) {
            path.push(category.label)
          }
        }
      }
    }
  } else if (activeTab.value === 'current') {
    // 本作品资产标签页
    if (selectedNode.value) {
      const parts = selectedNode.value.split('-')
      if (parts[0] === 'project' && parts.length === 2) {
        // 选中项目节点
        path.push(currentProject.value.name)
      } else if (parts.length >= 2) {
        // 选中具体分类
        path.push(currentProject.value.name)
        const categoryKey = parts[1]
        const category = documentStructure.find((s) => s.key === categoryKey)
        if (category) {
          path.push(category.label)
        }
      }
    }
  }

  // 添加当前路径（文件夹导航路径）
  path.push(...currentPath.value)

  return path
})

/** 面包屑当前级：仅当前级显示高亮色，其它级统一灰色 */
const isBreadcrumbCurrent = (index: number) => {
  // index=-1 代表“个人资产库”
  if (index === -1) {
    return breadcrumbPath.value.length === 0
  }
  return index === breadcrumbPath.value.length - 1
}

// 监听标签页切换
watch(activeTab, (newTab) => {
  selectedNode.value = null
  selectedCategory.value = null
  currentPath.value = []
  selectedAsset.value = null
  selectedAssets.value = []

  // 根据标签页初始化展开状态
  if (newTab === 'material') {
    expandedNodes.value['material-library'] = true
    // 默认选中素材库
    selectMaterialLibrary()
  } else if (newTab === 'history') {
    expandedNodes.value['my-works'] = true
  } else if (newTab === 'current') {
    const pid = currentProjectId.value || String(creationStore.currentProjectId ?? '')
    if (pid) {
      expandedNodes.value[`project-${pid}`] = true
      selectNode(`project-${pid}`, null, currentProject.value)
    }
  }
})

// 选择素材库
const selectMaterialLibrary = () => {
  selectedNode.value = 'material-library'
  selectedCategory.value = { key: 'material-library', label: '素材库' }
  expandedNodes.value['material-library'] = true
  currentPath.value = []
  selectedAsset.value = null
}

// 选择素材库分类
const selectMaterialCategory = (category: any) => {
  selectedNode.value = `material-${category.key}`
  selectedCategory.value = category
  currentPath.value = []
  selectedAsset.value = null
  selectedAssets.value = []
}

/** 姿态图/表情图/特效图：打开即定位素材库 + 对应子库 */
watch(
  () => props.open,
  (open) => {
    if (!open || props.initialTab !== 'material' || !props.initialMaterialCategory) return
    activeTab.value = 'material'
    nextTick(() => {
      const cat = materialCategories.find((c) => c.key === props.initialMaterialCategory)
      if (cat) {
        expandedNodes.value['material-library'] = true
        selectMaterialCategory(cat)
      }
    })
  }
)

onMounted(() => {
  const cid = creationStore.currentProjectId
  if (cid) {
    currentProjectId.value = String(cid)
    expandedNodes.value[`project-${currentProjectId.value}`] = true
    selectNode(`project-${currentProjectId.value}`, null, currentProject.value)
  }
})

// 文档结构
const documentStructure = [
  { key: 'global-setting', label: '全局设定' },
  { key: 'story-script', label: '故事剧本' },
  { key: 'scene-setting', label: '场景设定' },
  { key: 'character-setting', label: '角色设定' },
  { key: 'prop-setting', label: '道具设定' },
  { key: 'scene-image', label: '场景图' },
  { key: 'character-image', label: '角色图' },
  { key: 'prop-image', label: '道具图' },
  { key: 'storyboard-script', label: '分镜脚本' },
  { key: 'storyboard-image', label: '分镜图' },
  { key: 'storyboard-video', label: '分镜视频' },
  { key: 'dubbing', label: '配音对口型' },
  { key: 'preview', label: '视频预览' }
]

const currentCategoryLabel = computed(() => {
  if (!selectedCategory.value) return '故事剧本'
  return selectedCategory.value.label || '故事剧本'
})

// 获取当前项目名称
const currentProjectName = computed(() => {
  if (!selectedNode.value) return ''
  const projectId = selectedNode.value.split('-')[0]
  const project = projects.value.find((p) => p.id === projectId)
  return project?.name || ''
})

// 切换节点展开
const toggleNode = (key: string) => {
  expandedNodes.value[key] = !expandedNodes.value[key]
}

// 处理项目节点点击（只选中，不展开/折叠）
const handleProjectClick = (key: string, project?: any) => {
  // 只选中项目节点，不自动展开
  selectNode(key, null, project)
}

// 选择节点
const selectNode = (key: string, category?: any, project?: any) => {
  selectedNode.value = key
  selectedCategory.value = category || documentStructure.find((item) => key.includes(item.key))
  selectedAsset.value = null // 重置选中的资产
  currentPath.value = [] // 重置路径

  // 注意：不再自动展开项目节点，让用户通过点击箭头来控制展开/折叠
}

/** 解析当前选中节点对应的项目数字 ID（供右侧列表 personal 查询） */
function getProjectId(): string | null {
  if (!selectedNode.value) return null
  const sn = selectedNode.value
  if (sn.startsWith('project-')) {
    return sn.replace(/^project-/, '')
  }
  const i = sn.indexOf('-')
  if (i > 0) {
    const head = sn.slice(0, i)
    if (/^\d+$/.test(head)) return head
  }
  return null
}

function isScriptImportContext(): boolean {
  return props.acceptAssetType === 'script' || props.acceptAssetType === 'all'
}

async function confirmScriptImportIfNeeded(): Promise<boolean> {
  if (!isScriptImportContext() || !props.beforeScriptImport) return true
  try {
    return await props.beforeScriptImport()
  } catch {
    return false
  }
}

async function emitScriptImport(content: string, successMessage = '导入成功') {
  if (!(await confirmScriptImportIfNeeded())) return
  emit('import', content)
  modalOpen.value = false
  message.success(successMessage)
}

// 选择文件
const handleSelectFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  if (props.acceptAssetType === 'video') {
    input.accept = 'video/*'
  } else if (props.acceptAssetType === 'image') {
    input.accept = 'image/*'
    if (props.multiple) input.multiple = true
  } else {
    input.accept = '.txt,.doc,.docx'
  }
  input.onchange = (e: any) => {
    const files = e.target.files as FileList | null
    if (!files?.length) return
    void (async () => {
      if (props.acceptAssetType === 'video') {
        const file = files[0]
        if (!file.type.startsWith('video/')) {
          message.error('仅支持导入视频，请选择视频文件')
          return
        }
        const { uploadVideoToOssWithToast } = await import('~/utils/ossUpload')
        const url = await uploadVideoToOssWithToast(file)
        if (!url) return
        const name = file.name.replace(/\.[^/.]+$/, '') || '视频'
        emit('import', { type: 'video', url, name, title: name })
        modalOpen.value = false
        message.success('视频已导入')
        return
      }
      if (props.acceptAssetType === 'image') {
        const imageFiles: File[] = []
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          if (!file.type.startsWith('image/')) {
            message.warning(`已跳过非图片：${file.name}`)
            continue
          }
          imageFiles.push(file)
        }
        if (!imageFiles.length) return
        const { uploadImagesToOssWithToast } = await import('~/utils/ossUpload')
        const urls = await uploadImagesToOssWithToast(imageFiles)
        if (!urls) return
        const now = new Date().toISOString()
        const items: any[] = urls.map((url, i) => {
          const file = imageFiles[i]!
          const base = file.name.replace(/\.[^/.]+$/, '') || `图片${i + 1}`
          return {
            id: `local-img-${Date.now()}-${i}`,
            type: 'image',
            url,
            thumbnail: url,
            name: base,
            title: base,
            updatedAt: now
          }
        })
        if (props.multiple) {
          emit('import-multiple', items)
        } else {
          emit('import', items[0])
        }
        modalOpen.value = false
        message.success(`已导入 ${items.length} 张图片`)
        return
      }
      const file = files[0]
      const nameLower = (file.name || '').toLowerCase()
      const isScriptFile =
        props.acceptAssetType === 'script' ||
        props.acceptAssetType === 'all' ||
        /\.(txt|doc|docx)$/.test(nameLower)
      if (isScriptFile) {
        if (!(await confirmScriptImportIfNeeded())) return
        const projectIdRaw =
          getProjectId() ||
          (creationStore.currentProjectId ? String(creationStore.currentProjectId) : null)
        const projectId = projectIdRaw ? Number(projectIdRaw) : NaN
        if (Number.isFinite(projectId) && projectId > 0) {
          try {
            const row = await userScriptUpload({ file, projectId, episodeId: importModalEpisodeId.value > 0 ? importModalEpisodeId.value : undefined })
            const html = scriptApiTextToEditorHtml(String(row.originalText ?? ''))
            emit('import', html)
            modalOpen.value = false
            message.success('剧本上传成功')
          } catch (e: unknown) {
            const err = e as { msg?: string; message?: string }
            message.error(err?.msg || err?.message || '剧本上传失败')
          }
          return
        }
        const reader = new FileReader()
        reader.onload = (event: any) => {
          const content = event.target.result
          emit('import', content)
          modalOpen.value = false
          message.success('导入成功')
        }
        reader.readAsText(file, 'UTF-8')
        return
      }
      const reader = new FileReader()
      reader.onload = (event: any) => {
        const content = event.target.result
        emit('import', content)
        modalOpen.value = false
        message.success('导入成功')
      }
      reader.readAsText(file, 'UTF-8')
    })()
  }
  input.click()
}

// 取消
const handleCancel = () => {
  modalOpen.value = false
  selectedAsset.value = null
  selectedAssets.value = []
}

// 处理资产选择
const handleAssetSelect = (asset: any) => {
  if (props.multiple) {
    const idx = selectedAssets.value.findIndex((a) => a.id === asset.id)
    if (idx >= 0) {
      selectedAssets.value = selectedAssets.value.filter((a) => a.id !== asset.id)
    } else {
      selectedAssets.value = [...selectedAssets.value, asset]
    }
  } else {
    selectedAsset.value = asset
  }
}

// 处理导航（进入文件夹）
const handleNavigate = (folderName: string) => {
  currentPath.value.push(folderName)

  // 根据文件夹名称和当前标签页，同步选中左侧树节点
  if (activeTab.value === 'material') {
    // 素材库：根据文件夹名称找到对应的分类
    const category = materialCategories.find((c) => c.label === folderName)
    if (category) {
      selectedNode.value = `material-${category.key}`
      selectedCategory.value = category
      // 确保素材库节点是展开的
      expandedNodes.value['material-library'] = true
    }
  } else if (activeTab.value === 'current') {
    // 本作品资产：根据文件夹名称找到对应的分类
    const category = documentStructure.find((c) => c.label === folderName)
    const pid = displayProjectId.value
    if (category && pid) {
      selectedNode.value = `${pid}-${category.key}`
      selectedCategory.value = category
      expandedNodes.value[`project-${pid}`] = true
    }
  } else if (activeTab.value === 'history') {
    // 历史作品资产：根据文件夹名称找到对应的分类
    // 需要从当前选中节点中获取项目ID
    if (selectedNode.value) {
      const parts = selectedNode.value.split('-')
      if (parts.length >= 2 && parts[0] !== 'project') {
        const projectId = parts[0]
        const category = documentStructure.find((c) => c.label === folderName)
        if (category) {
          selectedNode.value = `${projectId}-${category.key}`
          selectedCategory.value = category
          // 确保项目节点和"我的作品"节点是展开的
          expandedNodes.value[`project-${projectId}`] = true
          expandedNodes.value['my-works'] = true
        }
      } else if (parts[0] === 'project' && parts.length === 2) {
        // 如果当前选中的是项目节点，根据文件夹名称找到分类
        const projectId = parts[1]
        const category = documentStructure.find((c) => c.label === folderName)
        if (category) {
          selectedNode.value = `${projectId}-${category.key}`
          selectedCategory.value = category
          // 确保项目节点和"我的作品"节点是展开的
          expandedNodes.value[`project-${projectId}`] = true
          expandedNodes.value['my-works'] = true
        }
      }
    }
  }
}

// 导航到根目录
const navigateToRoot = () => {
  currentPath.value = []
}

// 导航到面包屑指定位置
const navigateToBreadcrumb = (index: number) => {
  // 计算需要保留的路径长度
  // 面包屑格式：个人资产库 > 项目名 > [分类] > 路径1 > 路径2...
  // 个人资产库不算在路径中，需要计算项目名和分类占用的位置
  if (selectedNode.value) {
    const parts = selectedNode.value.split('-')
    let basePathLength = 1 // 项目名或素材库

    if (activeTab.value === 'material') {
      // 素材库标签页
      if (selectedNode.value !== 'material-library') {
        // 有分类，分类也占一个位置
        basePathLength = 2
      }
    } else {
      // 其他标签页
      if (parts.length > 2 || (parts[0] === 'project' && parts.length === 2)) {
        // 有分类，分类也占一个位置
        basePathLength = 2
      }
    }

    const targetIndex = index - basePathLength
    if (targetIndex >= 0) {
      currentPath.value = currentPath.value.slice(0, targetIndex + 1)
    } else {
      currentPath.value = []
      // 如果回到根目录，同步选中状态
      navigateToRoot()
    }
  }
}

// 确认
const handleConfirm = () => {
  if (props.multiple) {
    if (selectedAssets.value.length === 0) {
      message.warning('请至少选择一项资产')
      return
    }
    const count = selectedAssets.value.length
    emit('import-multiple', [...selectedAssets.value])
    modalOpen.value = false
    selectedAssets.value = []
    message.success(`已选择 ${count} 项`)
  } else {
    if (!selectedAsset.value) {
      message.warning('请选择要导入的资产')
      return
    }
    if (props.acceptAssetType === 'video') {
      if (!isVideoAsset(selectedAsset.value)) {
        message.error('仅支持导入视频，请选择视频文件')
        return
      }
      emit('import', selectedAsset.value)
      modalOpen.value = false
      message.success('视频已导入')
      selectedAsset.value = null
      return
    }
    if (selectedAsset.value.type === 'image') {
      emit('import', selectedAsset.value)
      modalOpen.value = false
      message.success('图片已导入')
    } else if (props.acceptAssetType === 'script' || props.acceptAssetType === 'all') {
      const content =
        selectedAsset.value.content ||
        `# ${selectedAsset.value.name}\n\n这是从 ${selectedAsset.value.name} 导入的内容。`
      void emitScriptImport(content)
    } else {
      message.warning('请选择要导入的资产')
    }
  }
}
</script>

<style lang="scss" scoped>
.import-script-modal :deep(.ant-modal) {
  background: transparent !important;
}

.import-script-modal :deep(.ant-modal-content) {
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.35);
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: min(720px, calc(100dvh - 48px));
  height: min(720px, calc(100dvh - 48px));
}

.import-script-modal :deep(.ant-modal-body) {
  padding: 16px 20px 20px;
  background: #191a1d;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.import-script-modal-shell {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.import-script-modal :deep(.ant-modal-header) {
  display: none;
}

.modal-header {
  flex-shrink: 0;
  padding: 0 0 0.75rem;
  background: #191a1d;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.header-tabs {
  display: flex;
  justify-content: center;
  width: 100%;
}

.import-tab-bar__inner {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 6px 0;
  background: #202434;
  border-radius: 8px;
  .import-tab-inner {
    background: #294b5d;
    border-radius: 8px;
    .import-tab--active {
      background: #4ae7fd;
      color: #121212 !important;
    }
  }
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
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.import-tab:hover {
  color: #ffffff;
}
.import-container {
  display: flex;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  margin: 0 auto;
  border: 1px solid rgba(74, 231, 253, 0.2);
  border-radius: 8px;
  overflow: hidden;
  background: #0d1422;
  height: 60vh;
}

.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid rgba(74, 231, 253, 0.12);
  display: flex;
  flex-direction: column;
  background: #081120;
  min-height: 0;
  overflow: hidden;
}

.sidebar-header {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(74, 231, 253, 0.14);
  background: rgba(19, 33, 57, 0.55);
}

.sidebar-title {
  font-size: 1.125rem;
  color: var(--home-text, #e6edf3);
  margin: 0;
}

.document-tree {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.625rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.document-tree::-webkit-scrollbar {
  display: none;
}

.tree-empty-hint {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 13px;
  line-height: 1.5;
  color: var(--home-muted, #8e97a5);
}

.tree-item {
  margin-bottom: 0.25rem;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--home-text, #e6edf3);
  font-size: 14px;
}

.tree-node:hover {
  background: rgba(14, 89, 250, 0.12);
}

.tree-item.active .tree-node {
  background: rgba(14, 47, 100, 0.45);
  font-weight: 500;
  border-left: 2px solid rgba(0, 171, 216, 0.85);
  padding-left: calc(0.625rem - 2px); 
  span{
    color: #4ae7fd;
  }
}

.tree-item.active .tree-node .tree-icon {
  color: var(--home-cyan, #4ae7fd);
}

.tree-node.leaf {
  padding-left: 2rem;
}

.tree-icon {
  font-size: 0.875rem;
  color: var(--home-muted, #8e97a5);
  width: 16px;
  min-width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.2s ease;
}

.tree-icon:hover {
  color: var(--home-cyan, #4ae7fd);
}

.tree-node.active .tree-icon {
  color: var(--home-cyan, #4ae7fd);
}

.tree-label {
  flex: 1;
}

.tree-children {
  margin-left: 1rem;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #111621;
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 13px;
    color: var(--home-muted, #8e97a5);
    .breadcrumb-item.breadcrumb-muted {
      color: #8e97a5 !important;
    }
  }
}
.breadcrumb-item {
  cursor: pointer;
  transition: color 0.2s ease;
}

.breadcrumb-item:hover {
  color: var(--home-cyan, #4ae7fd);
}

.breadcrumb-item.breadcrumb-current {
  color: var(--home-text, #e6edf3) !important;
  font-weight: 500;
  cursor: default;
}

.breadcrumb-item.breadcrumb-current:hover {
  color: var(--home-text, #e6edf3) !important;
}

.breadcrumb-separator {
  font-size: 0.75rem;
  color: rgba(142, 151, 165, 0.65);
}

.content-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-area :deep(.import-asset-list),
.content-area :deep(.asset-list-container),
.content-area :deep(.asset-grid-scroll) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.content-area :deep(.import-asset-list::-webkit-scrollbar),
.content-area :deep(.asset-list-container::-webkit-scrollbar),
.content-area :deep(.asset-grid-scroll::-webkit-scrollbar) {
  display: none;
}

.modal-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #191a1d;
  padding: 16px 0 0;
}

.footer-left {
  display: flex;
  align-items: center;
}

.import-btn-dashed {
  border-radius: 8px !important;
  border: 1px dashed rgba(74, 231, 253, 0.35) !important;
  background: #121212 !important;
  color: #ffffff !important;
  height: 30px;
  padding: 0 12px !important;
  font-size: 14px !important;
}

.import-btn-dashed:hover {
  border-color: rgba(74, 231, 253, 0.55) !important;
  color: #4ae7fd !important;
}

.footer-right {
  display: flex;
  gap: 0.75rem;
}

.footer-right :deep(.ant-btn) {
  min-width: 96px;
  border-radius: 10px;
  height: 34px;
}

.footer-right :deep(.ant-btn-default) {
  border: 1px solid rgba(74, 231, 253, 0.3);
  background: rgba(18, 18, 18, 1);
  color: #e6edf3;
}

.footer-right :deep(.ant-btn-primary) {
  border: none;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
}

@media (max-width: 1200px) {
  .import-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid rgba(74, 231, 253, 0.12);
    max-height: 200px;
  }
}
</style>
