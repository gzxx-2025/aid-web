<template>
  <a-modal
    v-model:open="modalOpen"
    :width="modalWidth"
    :footer="null"
    :title="null"
    :closable="false"
    :z-index="zIndex"
    centered
    class="import-script-modal"
    wrap-class-name="create-flow-modal import-script-modal-wrap"
    @cancel="handleCancel"
  >
    <div class="import-script-modal-shell">
    <header class="modal-header">
      <div class="header-top">
        <ModalTitleWatermark :title="title" watermark="IMPORT" />
        <button type="button" class="import-script-close" aria-label="关闭" @click="handleCancel">
          <CloseOutlined />
        </button>
      </div>
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
    </header>

    <div class="import-container">
      <!-- 左侧：文档结构树 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h3 class="sidebar-title">导入文档</h3>
        </div>
        <div class="document-tree">
          <!-- 根据标签页显示不同的树结构 -->

          <!-- 本作品资产：分类树中当前项目 → 当前剧集 → 分类 -->
          <template v-if="activeTab === 'current'">
            <p v-if="!displayProjectId" class="tree-empty-hint">
              暂无作品 ID，请从创作流程进入或先创建作品
            </p>
            <p v-else-if="assetCenterTreeLoading" class="tree-empty-hint">加载分类树…</p>
            <p v-else-if="!currentEpisodeCategories.length" class="tree-empty-hint">暂无本作品资产</p>
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
                  v-for="cat in currentEpisodeCategories"
                  :key="`tree-cur-${cat.categoryCode}`"
                  :class="[
                    'tree-item',
                    {
                      active:
                        selectedNode ===
                        `${displayProjectId}-${cat.categoryCode}`
                    }
                  ]"
                  @click="selectCurrentCategory(cat)"
                >
                  <div class="tree-node leaf">
                    <img
                      class="tree-icon"
                      :src="
                        selectedNode === `${displayProjectId}-${cat.categoryCode}`
                          ? fileWhiteSelIcon
                          : fileWhiteIcon
                      "
                      alt=""
                    />
                    <span class="tree-label">{{ cat.categoryName || cat.categoryCode }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 历史作品资产：资产中心分类树（项目→剧集→分类） -->
          <template v-else-if="activeTab === 'history'">
            <p v-if="assetCenterTreeLoading" class="tree-empty-hint">加载分类树…</p>
            <p v-else-if="!assetCenterTree.length" class="tree-empty-hint">暂无历史作品资产</p>
            <template v-else>
              <div
                v-for="project in assetCenterTree"
                :key="`tree-p-${project.projectId}`"
                class="tree-item"
              >
                <div
                  class="tree-node"
                  :class="{ active: selectedNode === `project-${project.projectId}` }"
                  @click.stop="handleHistoryProjectClick(project)"
                >
                  <span
                    class="tree-icon"
                    @click.stop="toggleNode(`project-${project.projectId}`)"
                  >{{ expandedNodes[`project-${project.projectId}`] ? '▼' : '▶' }}</span>
                  <span class="tree-label">{{ project.projectName || `项目${project.projectId}` }}</span>
                </div>
                <div v-if="expandedNodes[`project-${project.projectId}`]" class="tree-children">
                  <div
                    v-for="episode in project.children || []"
                    :key="`tree-e-${project.projectId}-${episode.episodeId ?? 0}`"
                    class="tree-item"
                  >
                    <div
                      class="tree-node"
                      :class="{
                        active:
                          selectedNode ===
                          `episode-${project.projectId}-${episode.episodeId ?? 0}`
                      }"
                      @click.stop="handleHistoryEpisodeClick(project, episode)"
                    >
                      <span
                        class="tree-icon"
                        @click.stop="
                          toggleNode(`episode-${project.projectId}-${episode.episodeId ?? 0}`)
                        "
                      >{{
                        expandedNodes[`episode-${project.projectId}-${episode.episodeId ?? 0}`]
                          ? '▼'
                          : '▶'
                      }}</span>
                      <span class="tree-label">{{ episodeDisplayLabel(episode) }}</span>
                    </div>
                    <div
                      v-if="expandedNodes[`episode-${project.projectId}-${episode.episodeId ?? 0}`]"
                      class="tree-children"
                    >
                      <div
                        v-for="cat in episode.children || []"
                        :key="`tree-c-${project.projectId}-${episode.episodeId ?? 0}-${cat.categoryCode}`"
                        :class="[
                          'tree-item',
                          {
                            active:
                              selectedNode ===
                              `${project.projectId}-${episode.episodeId ?? 0}-${cat.categoryCode}`
                          }
                        ]"
                        @click="selectHistoryCategory(project, episode, cat)"
                      >
                        <div class="tree-node leaf">
                          <img
                            class="tree-icon"
                            :src="
                              selectedNode ===
                              `${project.projectId}-${episode.episodeId ?? 0}-${cat.categoryCode}`
                                ? fileWhiteSelIcon
                                : fileWhiteIcon
                            "
                            alt=""
                          />
                          <span class="tree-label">{{ cat.categoryName || cat.categoryCode }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
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
            :episode-id="importListEpisodeId"
            :asset-center-tree="assetCenterTree"
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
import { UploadOutlined, RightOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import AssetList from './ImportAssetList.vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import { useCreationStore } from '~/stores/creation'
import { userProjectList, userScriptUpload, userAssetCenterCategoryTree } from '~/utils/businessApi'
import type { AssetCenterCategoryTreeVO } from '~/types/business-api'
import {
  clearOfficialMaterialAllCache,
  clearPersonalCenterAllCache,
  episodeDisplayLabel,
  findAssetCenterEpisode,
  findAssetCenterProject,
  getEpisodeCategories,
  resolveCurrentEpisodeNode,
  CENTER_CATEGORY_FALLBACK
} from '~/utils/importAssetModalQuery'
import { scriptApiTextToEditorHtml } from '~/utils/htmlPlain'
import {
  assertScriptPlainTextFile,
  SCRIPT_UPLOAD_ACCEPT,
  validateScriptUploadFile
} from '~/utils/scriptFileUpload'
import fileWhiteIcon from '@/assets/img/icon/file-white.svg'
import fileWhiteSelIcon from '@/assets/img/icon/flie-white-sel.svg'

const creationStore = useCreationStore()

/** 与创作上下文一致，供本作品 personal 资产查询 */
const importModalEpisodeId = computed(() => {
  const e = creationStore.currentEpisodeId
  if (e != null && e >= 0) return e
  return 0
})

/** 右侧列表 episodeId：历史作品取自分类树选中节点 */
const importListEpisodeId = computed(() => {
  if (activeTab.value === 'history' && selectedCategory.value?.episodeId != null) {
    return Number(selectedCategory.value.episodeId)
  }
  return importModalEpisodeId.value
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
const assetCenterTree = ref<AssetCenterCategoryTreeVO[]>([])
const assetCenterTreeLoading = ref(false)

async function loadAssetCenterTree() {
  if (assetCenterTreeLoading.value) return
  assetCenterTreeLoading.value = true
  try {
    assetCenterTree.value = await userAssetCenterCategoryTree({})
  } catch {
    assetCenterTree.value = []
  } finally {
    assetCenterTreeLoading.value = false
  }
}

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

/** 本作品：分类树中当前项目 → 当前剧集 → 分类列表 */
const currentEpisodeTreeNode = computed(() => {
  const pid = Number(displayProjectId.value)
  if (!Number.isFinite(pid) || pid <= 0) return undefined
  return resolveCurrentEpisodeNode(
    assetCenterTree.value,
    pid,
    importModalEpisodeId.value
  )
})

const currentEpisodeCategories = computed(() => {
  const fromTree = getEpisodeCategories(currentEpisodeTreeNode.value)
  if (fromTree.length) return fromTree
  if (assetCenterTreeLoading.value) return []
  const pid = Number(displayProjectId.value)
  if (!Number.isFinite(pid) || pid <= 0) return []
  // 树已返回但当前节点无分类时，用本地分类兜底，避免空白
  return CENTER_CATEGORY_FALLBACK.map((d) => ({
    projectId: pid,
    projectName: currentProject.value.name,
    categoryCode: d.categoryCode,
    categoryName: d.categoryName,
    assetCount: null
  }))
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
    if (open) {
      clearPersonalCenterAllCache()
      clearOfficialMaterialAllCache()
      void loadProjectsForModal()
      void loadAssetCenterTree()
    }
  }
)

watch(assetCenterTree, (tree) => {
  if (!props.open || !tree.length) return
  const pid = displayProjectId.value
  if (activeTab.value === 'current' && pid) {
    expandedNodes.value[`project-${pid}`] = true
    if (!selectedNode.value) {
      selectNode(`project-${pid}`, null, currentProject.value)
    }
  }
})

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
    if (selectedNode.value) {
      const parts = selectedNode.value.split('-')
      if (parts[0] === 'project' && parts.length === 2) {
        const projectId = Number(parts[1])
        const project = assetCenterTree.value.find((p) => p.projectId === projectId)
        if (project) path.push(project.projectName || `项目${projectId}`)
      } else if (parts.length >= 3 && /^\d+$/.test(parts[0] ?? '') && /^\d+$/.test(parts[1] ?? '')) {
        const projectId = Number(parts[0])
        const episodeId = Number(parts[1])
        const categoryCode = parts.slice(2).join('-')
        const project = assetCenterTree.value.find((p) => p.projectId === projectId)
        const episode = project?.children?.find((ep) => (ep.episodeId ?? 0) === episodeId)
        const category = episode?.children?.find((c) => c.categoryCode === categoryCode)
        if (project) path.push(project.projectName || `项目${projectId}`)
        if (episode) {
          path.push(episodeDisplayLabel(episode))
        }
        if (category) path.push(category.categoryName || categoryCode)
      }
    }
  } else if (activeTab.value === 'current') {
    if (selectedNode.value) {
      if (selectedNode.value.startsWith('project-')) {
        path.push(currentProject.value.name)
      } else {
        const dash = selectedNode.value.indexOf('-')
        if (dash > 0) {
          path.push(currentProject.value.name)
          const categoryKey = selectedNode.value.slice(dash + 1)
          const category = currentEpisodeCategories.value.find(
            (c) => c.categoryCode === categoryKey
          )
          if (category) path.push(category.categoryName || categoryKey)
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

// 文档结构由接口 /api/user/asset/center/category/tree 下发，见 currentEpisodeCategories

function categoryToSelection(
  cat: AssetCenterCategoryTreeVO,
  projectId: number,
  episodeId: number
) {
  const code = cat.categoryCode || ''
  return {
    key: code,
    label: cat.categoryName || code,
    projectId,
    episodeId
  }
}

function selectCurrentCategory(cat: AssetCenterCategoryTreeVO) {
  const pid = Number(displayProjectId.value)
  if (!Number.isFinite(pid) || pid <= 0) return
  const epId = importModalEpisodeId.value
  const code = cat.categoryCode || ''
  selectedNode.value = `${pid}-${code}`
  selectedCategory.value = categoryToSelection(cat, pid, epId)
  selectedAsset.value = null
  selectedAssets.value = []
  currentPath.value = []
}

// 切换节点展开
const toggleNode = (key: string) => {
  expandedNodes.value[key] = !expandedNodes.value[key]
}

// 处理项目节点点击（只选中，不展开/折叠）
const handleProjectClick = (key: string, project?: any) => {
  selectNode(key, null, project)
}

function handleHistoryProjectClick(project: AssetCenterCategoryTreeVO) {
  const key = `project-${project.projectId}`
  selectedNode.value = key
  selectedCategory.value = { projectId: project.projectId, label: project.projectName }
  selectedAsset.value = null
  selectedAssets.value = []
  currentPath.value = []
}

function handleHistoryEpisodeClick(
  project: AssetCenterCategoryTreeVO,
  episode: AssetCenterCategoryTreeVO
) {
  const epId = episode.episodeId ?? 0
  const key = `episode-${project.projectId}-${epId}`
  selectedNode.value = key
  selectedCategory.value = {
    projectId: project.projectId,
    episodeId: epId,
    label: episode.episodeTitle || `第${episode.episodeNo ?? ''}集`
  }
  selectedAsset.value = null
  selectedAssets.value = []
  currentPath.value = []
}

function selectHistoryCategory(
  project: AssetCenterCategoryTreeVO,
  episode: AssetCenterCategoryTreeVO,
  cat: AssetCenterCategoryTreeVO
) {
  const epId = episode.episodeId ?? 0
  const code = cat.categoryCode || ''
  selectedNode.value = `${project.projectId}-${epId}-${code}`
  selectedCategory.value = {
    key: code,
    label: cat.categoryName || code,
    projectId: project.projectId,
    episodeId: epId
  }
  selectedAsset.value = null
  selectedAssets.value = []
  currentPath.value = []
}

// 选择节点
const selectNode = (key: string, category?: any, _project?: any) => {
  selectedNode.value = key
  if (category?.categoryCode) {
    const dash = key.indexOf('-')
    const pid = dash > 0 ? Number(key.slice(0, dash)) : Number(displayProjectId.value)
    selectedCategory.value = categoryToSelection(
      category,
      Number.isFinite(pid) ? pid : Number(displayProjectId.value),
      importModalEpisodeId.value
    )
  } else {
    selectedCategory.value = category
  }
  selectedAsset.value = null
  currentPath.value = []
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
    input.accept = SCRIPT_UPLOAD_ACCEPT
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
        nameLower.endsWith('.txt')
      if (isScriptFile) {
        const formatError = validateScriptUploadFile(file)
        if (formatError) {
          message.error(formatError)
          return
        }
        if (!(await confirmScriptImportIfNeeded())) return
        const projectIdRaw =
          getProjectId() ||
          (creationStore.currentProjectId ? String(creationStore.currentProjectId) : null)
        const projectId = projectIdRaw ? Number(projectIdRaw) : NaN
        if (Number.isFinite(projectId) && projectId > 0) {
          try {
            try {
              await assertScriptPlainTextFile(file)
            } catch (e: unknown) {
              const err = e as { message?: string }
              message.error(err?.message || '内容非文本')
              return
            }
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
    // 再次点击同一项：取消选中（与批量生成分镜图列表一致）
    selectedAsset.value = selectedAsset.value?.id === asset.id ? null : asset
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
    const pid = displayProjectId.value
    const cat = currentEpisodeCategories.value.find(
      (c) => (c.categoryName || c.categoryCode) === folderName
    )
    if (cat && pid) {
      selectCurrentCategory(cat)
      expandedNodes.value[`project-${pid}`] = true
    }
  } else if (activeTab.value === 'history') {
    if (selectedNode.value?.startsWith('project-')) {
      const projectId = Number(selectedNode.value.replace(/^project-/, ''))
      const project = findAssetCenterProject(assetCenterTree.value, projectId)
      const episodes = project?.children ?? []
      if (episodes.length === 1) {
        const episode = episodes[0]!
        const cat = getEpisodeCategories(episode).find(
          (c) => (c.categoryName || c.categoryCode) === folderName
        )
        if (project && cat) {
          selectHistoryCategory(project, episode, cat)
          expandedNodes.value[`project-${projectId}`] = true
          expandedNodes.value[`episode-${projectId}-${episode.episodeId ?? 0}`] = true
          return
        }
      }
      const episode = episodes.find((ep) => episodeDisplayLabel(ep) === folderName)
      if (project && episode) {
        handleHistoryEpisodeClick(project, episode)
        expandedNodes.value[`project-${projectId}`] = true
        expandedNodes.value[`episode-${projectId}-${episode.episodeId ?? 0}`] = true
      }
    } else if (selectedNode.value?.startsWith('episode-')) {
      const m = selectedNode.value.match(/^episode-(\d+)-(\d+)$/)
      if (m) {
        const projectId = Number(m[1])
        const episodeId = Number(m[2])
        const project = findAssetCenterProject(assetCenterTree.value, projectId)
        const episode = findAssetCenterEpisode(project, episodeId)
        const cat = episode?.children?.find(
          (c) => (c.categoryName || c.categoryCode) === folderName
        )
        if (project && episode && cat) {
          selectHistoryCategory(project, episode, cat)
          expandedNodes.value[`project-${projectId}`] = true
          expandedNodes.value[`episode-${projectId}-${episodeId}`] = true
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
/* 与 BatchRegenerateDubbingModal .brdm 同高 */
.import-script-modal-shell {
  color: #e6edf3;
  height: 698px;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  background: #191a1d;
}

.modal-header {
  flex-shrink: 0;
  padding: 12px 16px 0.75rem;
  background: #191a1d;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.header-top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  padding-right: 32px;
}

.import-script-close {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  font-size: 16px;

  &:hover {
    color: #4ae7fd;
  }
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
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  align-self: stretch;
  margin: 0 16px;
  border: 1px solid rgba(74, 231, 253, 0.2);
  border-radius: 8px;
  overflow: hidden;
  background: #0d1422;
  box-sizing: border-box;
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
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-area :deep(.asset-list),
.content-area :deep(.import-asset-list),
.content-area :deep(.asset-list-container),
.content-area :deep(.asset-grid-scroll) {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.content-area :deep(.asset-list::-webkit-scrollbar),
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
  padding: 12px 16px 16px;
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
    max-height: 180px;
  }
}
</style>

<style lang="scss">
.ant-modal-wrap.import-script-modal-wrap .ant-modal.import-script-modal .ant-modal-content {
  padding: 0 !important;
  overflow: hidden;
  border-radius: 12px;
  background: #191a1d;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.ant-modal-wrap.import-script-modal-wrap .ant-modal.import-script-modal .ant-modal-header {
  display: none !important;
}

.ant-modal-wrap.import-script-modal-wrap .ant-modal.import-script-modal .ant-modal-body {
  padding: 0 !important;
  background: #191a1d;
}
</style>
