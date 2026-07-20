<template>
  <div
    ref="storyboardStepRootRef"
    class="storyboard-video create-step-storyboard-video storyboard-step"
  >
    <div class="storyboard-toolbar">
      <div class="storyboard-toolbar-left">
        <div class="storyboard-view-toggle">
          <a-button
            size="small"
            :type="viewMode === 'list' ? 'primary' : 'default'"
            @click="viewMode = 'list'"
          >
            <template #icon>
              <img
                :src="viewMode === 'list' ? listSelIcon : listNorIcon"
                alt=""
                class="storyboard-view-icon"
              />
            </template>
            列表
          </a-button>
          <a-button
            size="small"
            :type="viewMode === 'card' ? 'primary' : 'default'"
            @click="viewMode = 'card'"
          >
            <template #icon>
              <img
                :src="viewMode === 'card' ? cardSelIcon : cardNorIcon"
                alt=""
                class="storyboard-view-icon"
              />
            </template>
            卡片
          </a-button>
        </div>
        <div class="storyboard-progress">
          <span>视频完成进度：{{ progressText }}</span>
          <LoadingOutlined
            v-if="isGeneratingVideo || isSyncGeneratingStoryboard"
            class="storyboard-progress-loading"
            spin
          />
        </div>
      </div>
      <div class="storyboard-toolbar-right">
        <a-button
          size="small"
          class="storyboard-action-btn"
          :disabled="isGeneratingVideo"
          @click="addPanel"
        >
          <template #icon><PlusOutlined /></template>
          添加分镜视频
        </a-button>
        <a-tooltip :title="canAutoGenerateVideo ? '' : '需先有分镜图或参考图（至少一条）'">
          <span class="storyboard-tooltip-wrap">
            <StoryboardToolbarOpsDropdown
              v-if="!isGeneratingVideo"
              v-model:open="toolbarOpsOpen"
              :items="videoToolbarOpsItems"
              :loading="batchVideoSubmitting || batchDeleteSubmitting"
              :disabled="!canAutoGenerateVideo && panels.length === 0"
              @select="handleVideoToolbarOpsSelect"
            />
            <a-button
              v-else
              size="small"
              danger
              class="storyboard-action-btn"
              @click="stopVideoGeneration"
            >
              <template #icon><StopOutlined /></template>
              停止生成
            </a-button>
          </span>
        </a-tooltip>
      </div>
    </div>

    <div
      :class="[
        'storyboard-step-shell storyboard-video-empty',
        { 'storyboard-step-shell--has-list': panels.length > 0 }
      ]"
    >
      <div v-if="showScriptSyncGeneratingView" class="storyboard-generating-view">
        <div class="storyboard-generating-center">
          <img :src="generatingCenterIcon" alt="" class="storyboard-generating-center-icon" />
          <div class="storyboard-generating-center-title">正在把剧本进行一格一格分镜拆解...</div>
          <div class="storyboard-generating-center-progress">
            提取中（{{ syncGenerationPercent }}%）
          </div>
        </div>
      </div>
      <div v-else-if="panels.length === 0" class="storyboard-empty-content">
        <div class="storyboard-empty-inner">
          <div class="storyboard-empty-icon-wrap">
            <img src="/assets/img/icon/empty-fj.svg" alt="">
          </div>
          <p class="storyboard-empty-title">暂无分镜视频</p>
          <a-button class="storyboard-empty-add-btn" size="small" @click="addPanel">
            <div class="text-gradient">添加分镜视频</div>
          </a-button>
        </div>
      </div>
      <!-- 卡片视图 -->
      <div v-else-if="viewMode === 'card'" class="storyboard-cards">
        <div v-for="(panel, index) in panels" :key="panel.id" class="storyboard-card">
          <div class="storyboard-card-header">
            <div class="storyboard-card-title" @click.stop="startEditTitle(panel)">
              <template v-if="editingId === panel.id">
                <a-input
                  v-model:value="editingTitle"
                  :bordered="false"
                  class="storyboard-title-input"
                  @blur="finishEditTitle(panel)"
                  @press-enter="finishEditTitle(panel)"
                  @keydown.esc="cancelEditTitle"
                />
              </template>
              <template v-else>
                <span class="storyboard-card-title-text">{{ displayPanelTitle(panel, index) }}</span>
              </template>
            </div>
            <a-dropdown trigger="click" placement="bottomRight">
              <a-button type="text" size="small" class="storyboard-card-more" @click.stop>
                <template #icon><MoreOutlined /></template>
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="openEditVideoModal(index)">
                    <EditOutlined />
                    编辑分镜视频
                  </a-menu-item>
                  <a-menu-item @click="handleCopyPanel(index)">
                    <CopyOutlined />
                    复制分镜
                  </a-menu-item>
                  <a-menu-item danger @click="removePanel(index)">
                    <DeleteOutlined />
                    删除分镜
                  </a-menu-item>
                  <a-menu-item @click="emit('go-step', 3)">
                    <InfoCircleOutlined />
                    分镜脚本
                  </a-menu-item>
                  <a-menu-item @click="emit('go-step', 5)">
                    <InfoCircleOutlined />
                    配音对口型
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
          <div class="storyboard-card-body">
            <div class="storyboard-block storyboard-block-video">
              <div class="storyboard-block-title">分镜视频：</div>
              <div v-if="isPanelVideoGenerating(panel, index)" class="storyboard-block-card storyboard-video-loading">
                <div class="asset-visual-generating-block" role="status" aria-live="polite">
                  <div class="asset-visual-generating-block__shimmer" aria-hidden="true" />
                  <LoadingOutlined spin class="asset-visual-generating-block__icon" />
                  <p class="asset-visual-generating-block__text">正在生成分镜视频…</p>
                </div>
              </div>
              <div
                v-else-if="panel.generateError"
                class="storyboard-block-card scene-card scene-card-failed storyboard-video-generate-failed"
              >
                <div class="scene-card-failed-content">
                  <div class="scene-card-failed-icon">
                    <img :src="iconEmptyFail" alt="" class="scene-card-failed-icon-image">
                  </div>
                  <div class="scene-card-failed-text">生成失败</div>
                  <a-button
                    type="primary"
                    class="scene-card-failed-retry"
                    @click.stop="regeneratePanel(index)"
                  >
                    重新生成
                  </a-button>
                </div>
              </div>
              <div
                v-else-if="getPanelStoryboardVideo(panel)"
                class="storyboard-block-card storyboard-video-set"
              >
                <div class="storyboard-video-preview-wrap">
                  <video
                    :src="getPanelStoryboardVideo(panel)?.url"
                    class="storyboard-video-preview"
                    muted
                  />
                  <div class="scene-card-image-footer asset-action-footer">
                    <a-button @click.stop="handlePreviewStoryboardVideo(index)">
                      <template #icon
                        ><img :src="iconPreview" alt="" class="footer-action-icon"
                      /></template>
                      预览
                    </a-button>
                    <a-button @click.stop="openEditVideoModal(index)">
                      <template #icon
                        ><img :src="iconReplace" alt="" class="footer-action-icon"
                      /></template>
                      替换
                    </a-button>
                    <a-button @click.stop="handleDownloadStoryboardVideo(index)">
                      <template #icon
                        ><img :src="iconDownload" alt="" class="footer-action-icon"
                      /></template>
                      下载
                    </a-button>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="storyboard-block-card storyboard-video-placeholder"
                @click="openEditVideoModal(index)"
              >
                <img src="@/assets/img/icon/pencil.svg" alt="" />
                <div class="storyboard-block-text">编辑分镜视频</div>
                <div class="storyboard-block-sub">点击去创建此分镜视频</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-else ref="storyboardListRef" class="storyboard-list">
        <Draggable
          item-key="id"
          handle=".storyboard-drag-handle"
          :model-value="panels"
          :animation="180"
          :force-fallback="true"
          :fallback-on-body="false"
          :scroll="true"
          :bubble-scroll="true"
          :scroll-sensitivity="90"
          :scroll-speed="16"
          fallback-class="storyboard-list-item--fallback"
          :class="{ 'storyboard-list--dragging': isVideoDragging }"
          ghost-class="storyboard-list-item--ghost"
          chosen-class="storyboard-list-item--chosen"
          drag-class="storyboard-list-item--dragging"
          @start="onVideoDragStart"
          @end="onVideoDragEnd"
          @change="onVideoListDragChange"
        >
          <template #item="{ element: panel, index }">
            <div>
              <div
                v-if="index > 0"
                class="storyboard-insert-gap"
                @mouseenter="onInsertSlotEnter(index)"
                @mouseleave="onInsertSlotLeave"
              >
                <Transition name="storyboard-insert-fade">
                  <div v-show="activeInsertSlot === index" class="storyboard-insert-ui">
                    <div class="storyboard-insert-dash-line" aria-hidden="true" />
                    <a-tooltip title="插入空白卡片">
                      <button
                        type="button"
                        class="storyboard-insert-plus"
                        aria-label="插入空白卡片"
                        @click.stop="insertBlankPanelAt(index)"
                      >
                        <PlusOutlined />
                      </button>
                    </a-tooltip>
                    <span class="storyboard-insert-label">插入空白卡片</span>
                    <!--                <span class="storyboard-insert-hint">多参生视频模式下，不支持批量生成分镜图</span>-->
                  </div>
                </Transition>
              </div>
              <div class="storyboard-list-item">
                <div class="storyboard-list-header">
                  <span
                    class="storyboard-drag-handle"
                    aria-label="拖动排序"
                    title="拖动排序"
                    @click.stop
                  >
                    <HolderOutlined />
                  </span>
                  <div class="storyboard-list-title" @click="startEditTitle(panel)">
                    <template v-if="editingId === panel.id">
                      <a-input
                        v-model:value="editingTitle"
                        :bordered="false"
                        class="storyboard-title-input"
                        @blur="finishEditTitle(panel)"
                        @press-enter="finishEditTitle(panel)"
                        @keydown.esc="cancelEditTitle"
                      />
                    </template>
                    <template v-else>
                      <span class="storyboard-title-text">{{ displayPanelTitle(panel, index) }}</span>
                    </template>
                  </div>
                  <div class="storyboard-list-actions">
                    <button
                      class="storyboard-action-link"
                      type="button"
                      @click="emit('go-step', 3)"
                    >
                      分镜脚本
                    </button>
                    <button
                      class="storyboard-action-link"
                      type="button"
                      @click="emit('go-step', 5)"
                    >
                      配音对口型
                    </button>
                    <a-button size="small" @click="openEditVideoModal(index)"
                      >编辑分镜视频</a-button
                    >
                    <a-button size="small" @click="handleCopyPanel(index)">
                      复制分镜
                    </a-button>
                    <a-button size="small" danger @click="removePanel(index)">
                      删除分镜
                    </a-button>
                  </div>
                </div>
                <div class="storyboard-list-body">
                  <div class="storyboard-block storyboard-block-video storyboard-video-insert-host">
                    <div
                      v-if="index > 0"
                      class="storyboard-video-insert-edge storyboard-video-insert-edge--top"
                      @mouseenter="onInsertSlotEnter(index)"
                      @mouseleave="onInsertSlotLeave"
                    />
                    <div class="storyboard-video-insert-mid" @mouseenter="clearInsertSlotImmediate">
                      <div class="storyboard-block-title">分镜视频：</div>
                      <div
                        v-if="isPanelVideoGenerating(panel, index)"
                        class="storyboard-block-card storyboard-video-loading"
                      >
                        <div class="asset-visual-generating-block" role="status" aria-live="polite">
                          <div class="asset-visual-generating-block__shimmer" aria-hidden="true" />
                          <LoadingOutlined spin class="asset-visual-generating-block__icon" />
                          <p class="asset-visual-generating-block__text">正在生成分镜视频…</p>
                        </div>
                      </div>
                      <div
                        v-else-if="panel.generateError"
                        class="storyboard-block-card scene-card scene-card-failed storyboard-video-generate-failed"
                      >
                        <div class="scene-card-failed-content">
                          <div class="scene-card-failed-icon">
                            <img :src="iconEmptyFail" alt="" class="scene-card-failed-icon-image">
                          </div>
                          <div class="scene-card-failed-text">生成失败</div>
                          <a-button
                            type="primary"
                            class="scene-card-failed-retry"
                            @click.stop="regeneratePanel(index)"
                          >
                            重新生成
                          </a-button>
                        </div>
                      </div>
                      <div
                        v-else-if="getPanelStoryboardVideo(panel)"
                        class="storyboard-block-card storyboard-video-set"
                      >
                        <div class="storyboard-video-preview-wrap">
                          <video
                            :src="getPanelStoryboardVideo(panel)?.url"
                            class="storyboard-video-preview"
                            muted
                          />
                          <div class="scene-card-image-footer asset-action-footer">
                            <a-button @click.stop="handlePreviewStoryboardVideo(index)">
                              <template #icon
                                ><img :src="iconPreview" alt="" class="footer-action-icon"
                              /></template>
                              预览
                            </a-button>
                            <a-button @click.stop="openEditVideoModal(index)">
                              <template #icon
                                ><img :src="iconReplace" alt="" class="footer-action-icon"
                              /></template>
                              替换
                            </a-button>
                            <a-button @click.stop="handleDownloadStoryboardVideo(index)">
                              <template #icon
                                ><img :src="iconDownload" alt="" class="footer-action-icon"
                              /></template>
                              下载
                            </a-button>
                          </div>
                        </div>
                      </div>
                      <div
                        v-else
                        class="storyboard-block-card storyboard-video-placeholder"
                        @click="openEditVideoModal(index)"
                      >
                        <img src="@/assets/img/icon/pencil.svg" alt="" />
                        <div class="storyboard-block-text">编辑分镜视频</div>
                        <div class="storyboard-block-sub">点击去创建此分镜视频</div>
                      </div>
                    </div>
                    <div
                      class="storyboard-video-insert-edge storyboard-video-insert-edge--bottom"
                      @mouseenter="onInsertSlotEnter(index + 1)"
                      @mouseleave="onInsertSlotLeave"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Draggable>
        <div
          class="storyboard-insert-gap"
          ref="bottomAddBarRef"
          @mouseenter="onInsertSlotEnter(panels.length)"
          @mouseleave="onInsertSlotLeave"
        >
          <Transition name="storyboard-insert-fade">
            <div
              v-show="activeInsertSlot === panels.length || panels.length > 0"
              class="storyboard-insert-ui"
            >
              <div class="storyboard-insert-dash-line" aria-hidden="true" />
              <div class="storyboard-insert-label" @click.stop="addPanel">
                <PlusOutlined />
                <div class="text-gradient">添加分镜视频</div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <EditStoryboardVideoModal
      v-if="currentPanelIndex >= 0"
      :key="`storyboard-video-${panels[currentPanelIndex]?.id ?? currentPanelIndex}`"
      v-model:open="isVideoModalOpen"
      :scene-index="currentPanelIndex"
      :editor-scope-key="`storyboard-video-${panels[currentPanelIndex]?.id ?? currentPanelIndex}`"
      :scenes="videoScenes"
      @update="handleVideoUpdate"
      @jump-to-storyboard-script="handleJumpToStoryboardScript"
    />
    <!-- 自动生成分镜视频：确认生成参数后批量 video-prompt-image + generate/video/image -->
    <StoryboardGenerateModal
      v-model:open="showAutoGenerateModal"
      mode="generate"
      source="video"
      :agent="creationStore.storyboardVideoAgent"
      :video-model="creationStore.storyboardVideoGenerateSettings.videoModel"
      :aspect-ratio="creationStore.storyboardVideoGenerateSettings.aspectRatio"
      :resolution="creationStore.storyboardVideoGenerateSettings.resolution"
      :sound-effects="creationStore.storyboardVideoGenerateSettings.soundEffects"
      :cost-per-video="7"
      @confirm="handleConfirmAutoGenerate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import listNorIcon from '~/assets/img/icon/list-nor.svg'
import listSelIcon from '~/assets/img/icon/list-sel.svg'
import cardNorIcon from '~/assets/img/icon/card-nor.svg'
import cardSelIcon from '~/assets/img/icon/card-sel.svg'
import iconPreview from '~/assets/img/icon/Preview.svg'
import iconReplace from '~/assets/img/icon/Replace.svg'
import iconDownload from '~/assets/img/icon/download.svg'
import iconEmptyFail from '~/assets/img/icon/empty_fail.svg'
import generatingCenterIcon from '~/assets/img/icon/tmp00000001.png'
import {
  ThunderboltOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  EditOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  VideoCameraOutlined,
  DownloadOutlined,
  LoadingOutlined,
  StopOutlined,
  HolderOutlined
} from '@ant-design/icons-vue'
import type { StoryboardVideoPanel, StoryboardPanel, DubbingPanel } from '~/types'
import { moveItemBeforeIndex } from '~/utils/moveItemBeforeIndex'
import { useCreationStore } from '~/stores/creation'
import Draggable from 'vuedraggable'
import {
  STORYBOARD_WORKBENCH_NEED_PROJECT_MSG,
  useStoryboardWorkbenchMutations
} from '~/composables/useStoryboardWorkbenchMutations'
import { useStoryboardVideoBatchGenerate, isStoryboardVideoModalRestoreFollowing } from '~/composables/useStoryboardVideoBatchGenerate'
import EditStoryboardVideoModal from './EditStoryboardVideoModal.vue'
import StoryboardGenerateModal, {
  type StoryboardVideoGenerateSettings
} from './StoryboardGenerateModal.vue'
import StoryboardToolbarOpsDropdown, {
  type StoryboardOpsMenuItem
} from './StoryboardToolbarOpsDropdown.vue'
import { createDefaultVideoPanel } from '~/composables/useCreateFlowStoryboardSync'
import { userStoryboardList, userStoryboardUnSetFinalVideo } from '~/utils/businessApi'
import { resolveStoryboardVideoRecordId } from '~/utils/storyboardFinalRecordId'
import {
  extractStoryboardTitleSuffix,
  formatStoryboardScriptTitle,
  formatStoryboardVideoTitle,
  resolveStoryboardListDisplayTitle
} from '~/utils/storyboardPanelTitle'

interface Props {
  description: string
  modelValue: StoryboardVideoPanel[]
  /** 分镜脚本 panels，用于进入第五步时同步生成视频 panels */
  storyboardScriptPanels?: Array<{ id: string; title: string; [key: string]: any }>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: StoryboardVideoPanel[]): void
  (e: 'go-step', stepIndex: number): void
  (e: 'jump-to-storyboard-script', panelIndex: number): void
}>()

const creationStore = useCreationStore()
const route = useRoute()
const wb = useStoryboardWorkbenchMutations()
const videoBatchGen = useStoryboardVideoBatchGenerate()

function storyboardApiErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

const viewMode = ref<'list' | 'card'>('list')
const showAutoGenerateModal = ref(false)
const toolbarOpsOpen = ref(false)
const batchVideoSubmitting = ref(false)
const batchDeleteSubmitting = ref(false)
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const isVideoModalOpen = ref(false)
const currentPanelIndex = ref(-1)
const storyboardStepRootRef = ref<HTMLElement | null>(null)
const storyboardListRef = ref<HTMLElement | null>(null)
const bottomAddBarRef = ref<HTMLElement | null>(null)
const isVideoDragging = ref(false)

const panels = computed(() => props.modelValue || [])

function displayPanelTitle(panel: StoryboardVideoPanel, index: number): string {
  return resolveStoryboardListDisplayTitle(panel.title, index, 'video')
}

function onVideoDragStart() {
  isVideoDragging.value = true
}

function onVideoDragEnd() {
  isVideoDragging.value = false
}

interface StoryboardVideoDragChangeEvent {
  moved?: {
    oldIndex: number
    newIndex: number
  }
}

async function onVideoListDragChange(evt: StoryboardVideoDragChangeEvent) {
  const moved = evt?.moved
  if (!moved) return
  const from = moved.oldIndex
  const to = moved.newIndex
  const insertBeforeIndex = from < to ? to + 1 : to
  await applyVideoStepReorder(from, insertBeforeIndex)
}

async function applyVideoStepReorder(from: number, insertBefore: number) {
  const s = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  const v = [...creationStore.formData.storyboardVideo.panels]
  const d = [...(creationStore.formData.dubbing.panels as DubbingPanel[])]
  if (s.length <= 1) return
  const nextS = moveItemBeforeIndex(s, from, insertBefore)
  const nextV = v.length === nextS.length ? moveItemBeforeIndex(v, from, insertBefore) : v
  const nextD = d.length === nextS.length ? moveItemBeforeIndex(d, from, insertBefore) : d
  creationStore.formData.storyboardScript.panels = nextS
  creationStore.formData.storyboardVideo.panels = nextV
  creationStore.formData.dubbing.panels = nextD
  emit('update:modelValue', nextV)
  if (nextS.length > 0 && nextS.every((p) => wb.parseServerStoryboardId(p.id) != null)) {
    try {
      await wb.sortRemoteToMatchPanels(nextS)
    } catch (err: unknown) {
      message.warning(`排序同步失败：${storyboardApiErr(err)}`)
    }
  }
}

// 规则：1）生成了分镜脚本且列表中至少有一条有分镜图或参考图（场景道具角色设置的场景图）可点击；
// 2）分镜是「添加分镜」生成的，只要有一条设置了分镜图也可点击。参考图与分镜视频列表同步，由大模型返回不一定每条都有。
const canAutoGenerateVideo = computed(() => {
  const scriptPanels = props.storyboardScriptPanels || []
  if (scriptPanels.length === 0) return false
  const hasImageOrRef = (p: any) => {
    const hasImage = p.images && Array.isArray(p.images) && p.images.length > 0
    const hasRef =
      (p.referenceImage && (p.referenceImage.url || p.referenceImage.thumbnail)) ||
      (p.referenceImages && Array.isArray(p.referenceImages) && p.referenceImages.length > 0)
    return hasImage || hasRef
  }
  return scriptPanels.some(hasImageOrRef)
})

const isGeneratingVideo = computed(() => creationStore.isGeneratingStoryboardVideo)
const isSyncGeneratingStoryboard = computed(() => creationStore.isGeneratingStoryboard)
const showScriptSyncGeneratingView = computed(
  () =>
    isSyncGeneratingStoryboard.value &&
    panels.value.length === 0 &&
    !creationStore.storyboardGenerationError
)
const videoBatchProgress = computed(() => creationStore.storyboardVideoBatchProgress)
const syncGenerationPercent = computed(() => {
  const total = Number(creationStore.storyboardGenerationProgress.total || 0)
  const completed = Number(creationStore.storyboardGenerationProgress.completed || 0)
  if (total <= 0) return 0
  const percent = Math.round((completed / total) * 100)
  return Math.min(100, Math.max(0, percent))
})

const videoGenerationStopped = ref(false)
const videoGenerationAborted = ref(false) // 单条停止时标记，不关全局

/**
 * 用户主动删到 0 条后，禁止「脚本有数据 + 视频为空」的 watcher 立刻把列表从脚本补回，
 * 否则删最后一条会表现为删不掉。
 */
const suppressEmptyResyncFromScript = ref(false)

// 从分镜脚本同步：当脚本有数据且视频 panels 为空时，按脚本生成视频项（首次进入等）
watch(
  () => [props.storyboardScriptPanels, props.modelValue],
  () => {
    const scriptPanels = props.storyboardScriptPanels || []
    const current = props.modelValue || []
    if (scriptPanels.length > 0 && current.length === 0) {
      if (suppressEmptyResyncFromScript.value) return
      const next: StoryboardVideoPanel[] = scriptPanels.map((p, i) =>
        createDefaultVideoPanel(p as StoryboardPanel, i)
      )
      emit('update:modelValue', next)
    }
  },
  { immediate: true }
)

const videoScenes = computed(() => {
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  return panels.value.map((panel, i) => {
    const byIndex = scriptPanels[i]
    const sid = Number(byIndex?.id)
    const sp =
      Number.isFinite(sid) && sid > 0
        ? scriptPanels.find((s) => Number(s.id) === sid) || byIndex
        : byIndex
    return {
      name: panel.title,
      videos: Array.isArray(panel.videos) ? panel.videos.map((v) => ({ ...v })) : [],
      scriptContent: sp?.scriptContent ?? '',
      scriptPanelTitle: sp?.title ?? panel.title,
      storyboardId: Number.isFinite(Number(sp?.id)) ? Number(sp?.id) : undefined,
      /** 第四步该分镜的分镜图，供导入弹窗「当前分镜」Tab */
      storyboardImages: Array.isArray(sp?.images) ? sp.images.map((img: any) => ({ ...img })) : []
    }
  })
})

/** 当前分镜已设置为分镜视频的那条（仅手动设置后才有） */
function getPanelStoryboardVideo(panel: StoryboardVideoPanel) {
  const list = Array.isArray(panel.videos) ? panel.videos : []
  return list.find((v: any) => v.isStoryboardVideo) || null
}

const videoCompletedCount = computed(
  () => panels.value.filter((p) => getPanelStoryboardVideo(p)).length
)
const progressText = computed(() => {
  if (isGeneratingVideo.value && videoBatchProgress.value.total > 0) {
    return `${videoBatchProgress.value.completed}/${videoBatchProgress.value.total}`
  }
  return `${videoCompletedCount.value}/${panels.value.length}`
})

function isPanelVideoGenerating(panel: StoryboardVideoPanel, index: number): boolean {
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  const sp = scriptPanels[index]
  const sid = sp ? wb.parseServerStoryboardId(sp.id) : null
  if (sid == null) return false

  const isBatchActive =
    creationStore.storyboardVideoBatchActiveVideoTaskId != null ||
    creationStore.storyboardVideoBatchActivePromptTaskId != null
  const scopeKey = creationStore.step3GenVisualScopeKey()
  const modalTask =
    creationStore.step4PlusLiveGenByScope[scopeKey]?.storyboardVideoGenTasksByStoryboardId?.[
      String(sid)
    ]

  // 弹窗单条生视频：外层列表不展示 loading（步骤条 + 弹窗内展示）
  if ((modalTask || isStoryboardVideoModalRestoreFollowing(sid)) && !isBatchActive) {
    return false
  }

  if (panel.generating) return true
  return creationStore.storyboardPanelVideoGenStatusByStoryboardId[String(sid)] === 'generating'
}

const autoGenerateButtonLabel = computed(() =>
  videoCompletedCount.value > 0 ? '重新自动生成分镜视频' : '自动生成分镜视频'
)

const batchVideoGenerateLabel = computed(() =>
  videoCompletedCount.value > 0 ? '重新批量生成分镜视频' : '批量生成分镜视频'
)

const videoToolbarOpsItems = computed((): StoryboardOpsMenuItem[] => [
  {
    key: 'auto-video',
    label: autoGenerateButtonLabel.value,
    icon: ThunderboltOutlined,
    disabled: !canAutoGenerateVideo.value,
    disabledTooltip: !canAutoGenerateVideo.value ? '需先有分镜图或参考图（至少一条）' : undefined
  },
  {
    key: 'batch-video',
    label: batchVideoGenerateLabel.value,
    icon: VideoCameraOutlined,
    disabled: !canAutoGenerateVideo.value || panels.value.length === 0 || isGeneratingVideo.value,
    disabledTooltip: !canAutoGenerateVideo.value
      ? '需先有分镜图或参考图（至少一条）'
      : panels.value.length === 0
        ? '暂无分镜视频'
        : undefined
  },
  {
    key: 'batch-delete',
    label: '批量删除分镜视频',
    icon: DeleteOutlined,
    danger: true,
    disabled: panels.value.length === 0 || batchDeleteSubmitting.value
  }
])

function handleVideoToolbarOpsSelect(key: string) {
  if (key === 'auto-video') {
    openAutoGenerateModal()
    return
  }
  if (key === 'batch-video') {
    void startBatchVideoGenerate()
    return
  }
  if (key === 'batch-delete') {
    handleBatchDeleteVideoPanels()
  }
}

async function startBatchVideoGenerate() {
  if (isGeneratingVideo.value || batchVideoSubmitting.value) return
  if (!canAutoGenerateVideo.value) {
    message.warning('需先有分镜图或参考图（至少一条）')
    return
  }
  batchVideoSubmitting.value = true
  videoGenerationStopped.value = false
  videoGenerationAborted.value = false
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  try {
    const result = await videoBatchGen.runBatchVideosOnly({
      scriptPanels,
      videoPanels: panels.value,
      onPanelsUpdate: (next) => emit('update:modelValue', next)
    })
    if (result.ok) {
      message.success('分镜视频批量生成完成')
    } else if (result.message) {
      if (result.message.includes('停止') || result.message.includes('取消')) {
        message.info(result.message)
      } else if (result.message.includes('部分')) {
        message.warning(result.message)
      } else {
        message.error(result.message)
      }
    }
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
    creationStore.setGeneratingStoryboardVideo(false)
  } finally {
    batchVideoSubmitting.value = false
  }
}

function handleBatchDeleteVideoPanels() {
  const count = panels.value.length
  if (!count || batchDeleteSubmitting.value) return
  Modal.confirm({
    title: '确认批量删除全部分镜视频？',
    content: `将删除当前 ${count} 个分镜视频条目（不删除分镜脚本与配音数据），且不可恢复。`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      batchDeleteSubmitting.value = true
      try {
        const ctx = await wb.getProjectEpisodeContext()
        if (!ctx) {
          message.error(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
          throw new Error('no project context')
        }
        const scripts = [...(props.storyboardScriptPanels || [])] as StoryboardPanel[]
        let finalVideoIdByStoryboard = new Map<number, number | null>()
        try {
          const rows = await userStoryboardList({
            projectId: ctx.projectId,
            episodeId: ctx.episodeId
          })
          finalVideoIdByStoryboard = new Map(rows.map((r) => [r.id, r.finalVideoId ?? null]))
        } catch {
          /* 列表拉取失败时仍尝试用本地 recordId 取消 */
        }
        for (let i = 0; i < scripts.length; i++) {
          const sp = scripts[i]
          const sid = sp ? wb.parseServerStoryboardId(sp.id) : null
          if (sid == null) continue
          const videoPanel = panels.value[i]
          const finalVideo = videoPanel ? getPanelStoryboardVideo(videoPanel) : null
          let recordId = resolveStoryboardVideoRecordId(finalVideo)
          if (recordId == null) {
            const fromServer = finalVideoIdByStoryboard.get(sid)
            if (fromServer != null && fromServer > 0) recordId = fromServer
          }
          if (recordId == null) continue
          try {
            await userStoryboardUnSetFinalVideo({ storyboardId: sid, recordId })
          } catch {
            /* 幂等：无最终视频或已被取消时忽略 */
          }
        }
        const next = panels.value.map((p) => ({
          ...p,
          videos: [],
          generating: false,
          generateError: undefined
        }))
        emit('update:modelValue', next)
        message.success('已删除全部分镜视频')
      } catch (e: unknown) {
        message.error(storyboardApiErr(e))
        throw e
      } finally {
        batchDeleteSubmitting.value = false
      }
    }
  })
}

function shouldOverwriteVideoPrompt(): boolean {
  return videoCompletedCount.value > 0 || panels.value.some((p) => (p.videos?.length ?? 0) > 0)
}

function openAutoGenerateModal() {
  if (isGeneratingVideo.value) return
  if (!canAutoGenerateVideo.value) {
    message.warning('需先有分镜图或参考图（至少一条）')
    return
  }
  showAutoGenerateModal.value = true
}

function handleConfirmAutoGenerate(settings: StoryboardVideoGenerateSettings) {
  const manualAgentPick = settings.manualAgentModelPick === true
  const manualVideoPick = settings.manualVideoModelPick === true
  creationStore.setStoryboardVideoGenerateSettings({
    videoModel: manualVideoPick ? settings.videoModel : '',
    aspectRatio: settings.aspectRatio,
    resolution: settings.resolution,
    soundEffects: settings.soundEffects,
    ...(manualAgentPick
      ? {
          agentId: settings.agentId,
          videoPromptModelCode: settings.videoPromptModelCode
        }
      : { agentId: '', videoPromptModelCode: '' })
  })
  void startAutoGenerate(manualAgentPick, manualVideoPick)
}

async function startAutoGenerate(
  manualPromptAgentModelPick = false,
  manualVideoModelPick = false
) {
  if (isGeneratingVideo.value) return
  videoGenerationStopped.value = false
  videoGenerationAborted.value = false

  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  const overwritePrompt = shouldOverwriteVideoPrompt()

  try {
    const result = await videoBatchGen.runFullAutoGenerate({
      scriptPanels,
      videoPanels: panels.value,
      overwritePrompt,
      manualPromptAgentModelPick,
      manualVideoModelPick,
      onPanelsUpdate: (next) => emit('update:modelValue', next)
    })
    if (result.ok) {
      message.success('分镜视频生成完成')
    } else if (result.message) {
      if (result.message.includes('停止') || result.message.includes('取消')) {
        message.info(result.message)
      } else if (result.message.includes('部分')) {
        message.warning(result.message)
      } else {
        message.error(result.message)
      }
    }
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
    creationStore.setGeneratingStoryboardVideo(false)
  }
}

async function stopVideoGeneration() {
  videoGenerationStopped.value = true
  await videoBatchGen.requestStop()
  const next = (props.modelValue || []).map((p) => ({
    ...p,
    generating: false
  }))
  emit('update:modelValue', next)
  message.info('已停止生成')
}

function stopPanelGeneration(index: number) {
  void stopVideoGeneration()
}

async function regeneratePanel(index: number) {
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  const scriptPanel = scriptPanels[index]
  const videoPanel = panels.value[index]
  if (!scriptPanel || !videoPanel) return

  videoGenerationStopped.value = false
  const result = await videoBatchGen.regenerateSinglePanel({
    scriptPanel,
    videoPanel,
    onPanelUpdate: (panel) => {
      const next = (props.modelValue || []).map((p, i) => (i === index ? panel : p))
      emit('update:modelValue', next)
    }
  })

  if (result.ok) {
    message.success('重新生成成功')
  } else if (result.message) {
    message.error(result.message)
  }
}

function openEditVideoModal(index: number) {
  currentPanelIndex.value = index
  isVideoModalOpen.value = true
}

/** 分镜视频：预览（与预览图片相同的弹窗） */
function handlePreviewStoryboardVideo(panelIndex: number) {
  const panel = panels.value[panelIndex]
  const video = getPanelStoryboardVideo(panel)
  if (video?.url) {
    Modal.info({
      title: video.title || `分镜视频${panelIndex + 1}`,
      content: h('video', {
        src: video.url,
        controls: true,
        style: { width: '100%', maxHeight: '70vh', display: 'block' }
      }),
      width: '80%',
      okText: '关闭'
    })
  } else {
    message.warning('暂无视频可预览')
  }
}

/** 分镜视频：下载 */
function handleDownloadStoryboardVideo(panelIndex: number) {
  const panel = panels.value[panelIndex]
  const video = getPanelStoryboardVideo(panel)
  if (video?.url) {
    const link = document.createElement('a')
    link.href = video.url
    link.download = video.title || `分镜视频${panelIndex + 1}`
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('视频下载中...')
  } else {
    message.warning('暂无视频可下载')
  }
}

function handleVideoUpdate(sceneIndex: number, data: any) {
  if (sceneIndex < 0 || sceneIndex >= panels.value.length) return
  // 只有编辑了分镜脚本/标题等“分镜配置”时，才需要同步到服务器；
  // 打开弹窗/刷新生成记录/设置为分镜视频只会更新 videos 列表，不应触发保存。
  const shouldSave =
    data?.scriptContent !== undefined ||
    (data?.scriptTitle !== undefined && String(data.scriptTitle).trim().length > 0)
  const scriptList = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
  if (
    (data?.scriptContent !== undefined || data?.scriptTitle !== undefined) &&
    Array.isArray(scriptList) &&
    sceneIndex < scriptList.length
  ) {
    creationStore.formData.storyboardScript.panels = scriptList.map((p, i) =>
      i === sceneIndex
        ? {
            ...p,
            ...(data.scriptContent !== undefined && { scriptContent: data.scriptContent }),
            ...(data.scriptTitle !== undefined &&
              String(data.scriptTitle).trim() && { title: String(data.scriptTitle).trim() })
          }
        : p
    )
  }
  const nextPanels = panels.value.map((panel, i) =>
    i === sceneIndex
      ? {
          ...panel,
          ...(data.name != null && { title: data.name }),
          ...(Array.isArray(data.videos) && { videos: data.videos.map((v: any) => ({ ...v })) })
        }
      : panel
  )
  emit('update:modelValue', nextPanels)

  if (!shouldSave) return
  void (async () => {
    const ctx = await wb.getProjectEpisodeContext()
    if (!ctx) {
      message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
      return
    }
    const scriptAfter = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
    const sp = scriptAfter[sceneIndex]
    if (!sp || wb.parseServerStoryboardId(sp.id) == null) {
      message.warning('该分镜未同步到服务器，无法保存，请刷新分镜列表后重试')
      return
    }
    const body = wb.buildSavePayload(sp, sceneIndex)
    if (body) {
      try {
        await wb.saveRemote(body)
      } catch (e: unknown) {
        message.warning(`分镜同步失败：${storyboardApiErr(e)}`)
      }
    }
  })()
}

function handleJumpToStoryboardScript(panelIndex: number) {
  isVideoModalOpen.value = false
  emit('jump-to-storyboard-script', panelIndex)
  emit('go-step', 3)
}

let insertLeaveTimer: ReturnType<typeof setTimeout> | null = null
const activeInsertSlot = ref<number | null>(null)

function onInsertSlotEnter(idx: number) {
  if (insertLeaveTimer) {
    clearTimeout(insertLeaveTimer)
    insertLeaveTimer = null
  }
  activeInsertSlot.value = idx
}

function onInsertSlotLeave() {
  insertLeaveTimer = setTimeout(() => {
    activeInsertSlot.value = null
    insertLeaveTimer = null
  }, 180)
}

function clearInsertSlotImmediate() {
  if (insertLeaveTimer) {
    clearTimeout(insertLeaveTimer)
    insertLeaveTimer = null
  }
  activeInsertSlot.value = null
}

async function insertBlankPanelAt(atIndex: number) {
  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }

  const scriptList = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  const defaultTitle = formatStoryboardScriptTitle(atIndex, '未命名')
  let newScript: StoryboardPanel
  try {
    const data = await wb.createRemote(defaultTitle)
    if (!data) throw new Error('no data')
    newScript = {
      id: String(data.id),
      title: (data.title && data.title.trim()) || defaultTitle
    }
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
    return
  }

  scriptList.splice(atIndex, 0, newScript)
  creationStore.formData.storyboardScript.panels = scriptList

  const newPanel: StoryboardVideoPanel = createDefaultVideoPanel(newScript, atIndex)
  newPanel.id = `video-${newScript.id}-${atIndex}`
  const next = [...panels.value]
  next.splice(atIndex, 0, newPanel)
  suppressEmptyResyncFromScript.value = false
  emit('update:modelValue', next)

  if (scriptList.every((p) => wb.parseServerStoryboardId(p.id) != null)) {
    try {
      await wb.sortRemoteToMatchPanels(scriptList)
    } catch (e: unknown) {
      message.warning(storyboardApiErr(e))
    }
  }

  clearInsertSlotImmediate()
  message.success('已插入空白分镜')
}

onUnmounted(() => {
  if (insertLeaveTimer) {
    clearTimeout(insertLeaveTimer)
    insertLeaveTimer = null
  }
  videoBatchGen.cancelResumeFollow()
  if (import.meta.client) {
    window.removeEventListener('create-flow-track-task', handleGlobalTrackTaskEvent)
    window.removeEventListener('create-flow-stop-task', handleGlobalStopTaskEvent)
  }
})

let storyboardVideoRestoreGeneration = 0

async function restoreStoryboardVideoBatchIfNeeded() {
  if (!creationStore.isHydrated) return
  videoBatchGen.cancelResumeFollow()
  const gen = ++storyboardVideoRestoreGeneration
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  await videoBatchGen.restoreOngoingBatchIfNeeded(scriptPanels, panels.value, (next) => {
    if (gen !== storyboardVideoRestoreGeneration) return
    emit('update:modelValue', next)
  })
}

watch(
  () =>
    [
      creationStore.isHydrated,
      creationStore.currentProjectId,
      creationStore.currentEpisodeId,
      route.query.projectId,
      route.query.episodeId
    ] as const,
  () => {
    void restoreStoryboardVideoBatchIfNeeded()
  },
  { immediate: true }
)

function handleGlobalTrackTaskEvent(event: Event) {
  const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
  const ty = String(detail?.taskType ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (ty !== 'storyboard_video_prompt_batch' && ty !== 'storyboard_video_generate') return
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  videoBatchGen.onGlobalTrackTask(event, scriptPanels, panels.value, (next) => {
    emit('update:modelValue', next)
  }, (result) => {
    if (result.ok) {
      message.success('分镜视频批量生成完成')
    } else if (result.message) {
      message.error(result.message)
    }
  })
}

function handleGlobalStopTaskEvent(event: Event) {
  void videoBatchGen.onGlobalStopTask(event)
}

onMounted(() => {
  if (panels.value.length === 0 && creationStore.storyboardGenerationError) {
    creationStore.clearStoryboardScriptGenerationOutcome()
  }
  if (import.meta.client) {
    window.addEventListener('create-flow-track-task', handleGlobalTrackTaskEvent)
    window.addEventListener('create-flow-stop-task', handleGlobalStopTaskEvent)
  }
})

const addPanel = async () => {
  suppressEmptyResyncFromScript.value = false

  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }

  const scriptList = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  const nextIndex = scriptList.length
  const defaultTitle = formatStoryboardScriptTitle(nextIndex, '未命名')

  let newScript: StoryboardPanel
  try {
    const data = await wb.createRemote(defaultTitle)
    if (!data) throw new Error('no data')
    newScript = {
      id: String(data.id),
      title: (data.title && data.title.trim()) || defaultTitle
    }
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
    return
  }

  creationStore.formData.storyboardScript.panels = [...scriptList, newScript]
  scrollToLatestPanel()
  message.success('已添加分镜')
}

const scrollToLatestPanel = (behavior: ScrollBehavior = 'smooth') => {
  const run = () => {
    const root = storyboardStepRootRef.value
    const preview = root?.closest('.preview-content') as HTMLElement | null
    if (preview) {
      const maxScroll = Math.max(0, preview.scrollHeight - preview.clientHeight)
      if (maxScroll > 0) {
        preview.scrollTo({ top: maxScroll, behavior })
        return
      }
    }
    const listEl = storyboardListRef.value
    const target =
      (bottomAddBarRef.value as HTMLElement | null) ||
      (listEl?.querySelector('.storyboard-list-item:last-of-type') as HTMLElement | null)
    target?.scrollIntoView({ behavior, block: 'end' })
  }
  nextTick(() => {
    nextTick(() => {
      requestAnimationFrame(run)
    })
  })
}

const startEditTitle = (panel: StoryboardVideoPanel) => {
  editingId.value = panel.id
  editingTitle.value = panel.title
}

const finishEditTitle = async (panel: StoryboardVideoPanel) => {
  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    editingId.value = null
    return
  }

  const vIdxEarly = panels.value.findIndex((p) => p.id === panel.id)
  if (vIdxEarly >= 0) {
    const sp0 = (creationStore.formData.storyboardScript.panels as StoryboardPanel[])[vIdxEarly]
    if (!sp0 || wb.parseServerStoryboardId(sp0.id) == null) {
      message.warning('该分镜未同步到服务器，无法保存标题，请刷新分镜列表后重试')
      editingId.value = null
      return
    }
  }

  const nextTitleRaw = editingTitle.value.trim() || panel.title
  const nextTitle =
    vIdxEarly >= 0
      ? formatStoryboardVideoTitle(vIdxEarly, extractStoryboardTitleSuffix(nextTitleRaw))
      : nextTitleRaw
  const nextPanels = panels.value.map((item) =>
    item.id === panel.id ? { ...item, title: nextTitle } : item
  )
  emit('update:modelValue', nextPanels)
  editingId.value = null

  const vIdx = nextPanels.findIndex((p) => p.id === panel.id)
  if (vIdx < 0) return
  const scriptList = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  if (vIdx < scriptList.length) {
    const scriptTitle = formatStoryboardScriptTitle(
      vIdx,
      extractStoryboardTitleSuffix(nextTitle)
    )
    const sp = { ...scriptList[vIdx], title: scriptTitle }
    scriptList[vIdx] = sp
    creationStore.formData.storyboardScript.panels = scriptList
    const sid = wb.parseServerStoryboardId(sp.id)
    if (sid) {
      try {
        await wb.saveRemote({ id: sid, title: scriptTitle })
      } catch (e: unknown) {
        message.warning(`标题同步失败：${storyboardApiErr(e)}`)
      }
    }
  }
}

const cancelEditTitle = () => {
  editingId.value = null
  editingTitle.value = ''
}

const handleCopyPanel = async (index: number) => {
  const ctxFirst = await wb.getProjectEpisodeContext()
  if (!ctxFirst) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }
  const srcScript = (creationStore.formData.storyboardScript.panels as StoryboardPanel[])[index]
  if (!srcScript || wb.parseServerStoryboardId(srcScript.id) == null) {
    message.warning('该分镜未同步到服务器，无法复制，请刷新分镜列表后重试')
    return
  }

  const panel = panels.value[index]
  if (!panel) return
  const nextIndex = panels.value.length
  const suffix = extractStoryboardTitleSuffix(panel.title) || `${panel.title}_副本`
  const newTitle = formatStoryboardVideoTitle(nextIndex, suffix)
  const newPanel: StoryboardVideoPanel = {
    id: `video-${Date.now()}-${nextIndex}`,
    title: newTitle,
    videoMode: panel.videoMode,
    detailDescription: panel.detailDescription,
    videos:
      Array.isArray(panel.videos) && panel.videos.length > 0
        ? panel.videos.map((v: any) => ({
            ...v,
            id: v.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
          }))
        : []
  }
  suppressEmptyResyncFromScript.value = false
  emit('update:modelValue', [...panels.value, newPanel])
  message.success('分镜已复制')

  await nextTick()

  const scripts = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  const src = scripts[index]
  const last = scripts[scripts.length - 1]
  if (!last || wb.parseServerStoryboardId(last.id) != null) return

  const scriptTitleMatch = src?.title ? extractStoryboardTitleSuffix(src.title) : ''
  const newScriptTitle = formatStoryboardScriptTitle(
    scripts.length - 1,
    scriptTitleMatch || `${src?.title ?? '分镜'}_副本`
  )

  try {
    const data = await wb.createRemote(newScriptTitle)
    if (!data) throw new Error('no data')
    const nextScripts = [...scripts]
    nextScripts[nextScripts.length - 1] = {
      ...last,
      id: String(data.id),
      title: (data.title && data.title.trim()) || newScriptTitle,
      scriptContent: src?.scriptContent,
      dialogueText: src?.dialogueText
    }
    creationStore.formData.storyboardScript.panels = nextScripts
    const sid = wb.parseServerStoryboardId(String(data.id))
    if (sid) {
      const story = wb.scriptHtmlToStoryScriptApi(src?.scriptContent)
      const d = src?.dialogueText != null ? String(src.dialogueText).trim() : ''
      await wb.saveRemote({
        id: sid,
        title: nextScripts[nextScripts.length - 1]!.title,
        ...(story !== undefined ? { storyScript: story } : {}),
        ...(d ? { dialogueText: d } : {})
      })
    }
    if (nextScripts.every((p) => wb.parseServerStoryboardId(p.id) != null)) {
      await wb.sortRemoteToMatchPanels(nextScripts)
    }
  } catch (e: unknown) {
    message.warning(`复制分镜未同步服务端：${storyboardApiErr(e)}`)
  }
}

const removePanel = (idx: number) => {
  Modal.confirm({
    title: '确认删除分镜?',
    content: '将同时删除该分镜的视频内容及对应的分镜脚本、配音对口型。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const ctx = await wb.getProjectEpisodeContext()
      if (!ctx) {
        message.error(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
        throw new Error('no project context')
      }
      const scriptList = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
      const sp = scriptList[idx]
      if (!sp || wb.parseServerStoryboardId(sp.id) == null) {
        message.error('该分镜未同步到服务器，无法删除，请刷新分镜列表后重试')
        throw new Error('no server storyboard id')
      }
      try {
        await wb.deleteRemote(sp.id)
      } catch (e: unknown) {
        message.error(storyboardApiErr(e))
        throw e
      }
      const nextPanels = panels.value.filter((_, i) => i !== idx)
      if (nextPanels.length === 0) {
        suppressEmptyResyncFromScript.value = true
      }
      emit('update:modelValue', nextPanels)
      message.success('分镜已删除')
    }
  })
}
</script>

<style scoped>
.storyboard-video {
  width: 100%;
  .storyboard-toolbar {
    .storyboard-toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
  }
}

/* 关键：空态撑满，有列表可滚动 */
.storyboard-step-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.storyboard-empty-content,
.storyboard-generating-view {
  flex: 1;
  min-height: 0;
}

.storyboard-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.storyboard-generating-view {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.storyboard-generating-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  text-align: center;
}

.storyboard-generating-center-icon {
  width: 200px;
  max-width: 42vw;
  height: auto;
}

.storyboard-generating-center-title {
  color: var(--home-text, #e6edf3);
  font-size: 15px;
  line-height: 1.5;
  font-weight: 500;
}

.storyboard-generating-center-progress {
  color: var(--home-muted, #8e97a5);
  font-size: 13px;
  line-height: 1.4;
}

/* 卡片视图布局见 assets/css/storyboard-step-shared.css */
.storyboard-cards {
  padding-top: 0.5rem;
}

.storyboard-card-title-text {
  font-size: inherit;
  line-height: inherit;
  font-weight: inherit;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.storyboard-card-more {
  color: var(--home-muted, #8e97a5);
  flex-shrink: 0;
}

.storyboard-card-more:hover {
  color: var(--home-text, #e6edf3);
}

.storyboard-block-title {
  font-size: 0.82rem;
  color: var(--home-muted, #8e97a5);
  margin-bottom: 0.35rem;
  font-weight: 600;
}

.storyboard-list-body .storyboard-block-video .storyboard-block-card {
  height: 200px;
}

.storyboard-video-placeholder {
  border: 1px dashed rgba(74, 231, 253, 0.28);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--home-muted, #8e97a5);
  cursor: pointer;
}

.storyboard-video-loading {
  border: none;
  padding: 0;
  background: transparent;
  min-height: 140px;
}

.create-step-storyboard-video .asset-visual-generating-block {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 180px;
  width: 100%;
  height: 100%;
  padding: 24px 16px;
  border: 1px solid rgba(74, 231, 253, 0.35);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, rgba(18, 22, 38, 0.96) 0%, rgba(25, 32, 52, 0.99) 100%);
  overflow: hidden;
  box-sizing: border-box;
}

.create-step-storyboard-video .asset-visual-generating-block__shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(74, 231, 253, 0.06) 42%,
    rgba(74, 231, 253, 0.14) 50%,
    rgba(74, 231, 253, 0.06) 58%,
    transparent 100%
  );
  background-size: 220% 100%;
  animation: storyboard-video-shimmer 1.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes storyboard-video-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.create-step-storyboard-video .asset-visual-generating-block__icon {
  position: relative;
  z-index: 1;
  font-size: 28px;
  color: #4ae7fd;
}

.create-step-storyboard-video .asset-visual-generating-block__text {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(230, 237, 243, 0.88);
  text-align: center;
}

.storyboard-video-loading-icon {
  font-size: 1.5rem;
  color: var(--accent-500);
}

.storyboard-video-loading-text {
  font-size: 0.9rem;
}

.storyboard-video-stop-link {
  font-size: 0.85rem;
  color: var(--accent-600);
  cursor: pointer;
}

.storyboard-video-generate-failed {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 140px;
  padding: 0.75rem;
  background: rgba(8, 13, 24, 0.92);
  border: 1px dashed rgba(74, 231, 253, 0.34);
  border-radius: var(--radius-lg);
  box-sizing: border-box;
}

.scene-card-failed-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.scene-card-failed-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scene-card-failed-icon-image {
  width: 100%;
  height: 100%;
  display: block;
}

.scene-card-failed-text {
  font-size: 12px;
  color: #8e97a5;
  line-height: 1.3;
  margin-bottom: 12px;
}

.scene-card-failed-retry {
  height: 24px;
  padding: 0 14px;
  border: none !important;
  color: #fff !important;
  font-size: 12px;
  line-height: 24px;
  box-shadow: none !important;
}

.scene-card-failed-retry:hover {
  background: #40a9ff !important;
  color: #fff !important;
}

.storyboard-video-set {
  border: 1px solid rgba(74, 231, 253, 0.12);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.storyboard-list-body .storyboard-video-set {
  height: 100%;
  min-height: 140px;
}

.storyboard-video-preview-wrap {
  flex: 1;
  min-height: 0;
  background: rgba(6, 10, 18, 0.55);
  position: relative;
  aspect-ratio: 16 / 9;
}

.storyboard-video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.storyboard-block-icon {
  font-size: 1.25rem;
  color: var(--home-muted, #8e97a5);
}

.storyboard-block-text {
  font-size: 12px;
  color: #ffffff;
}

.storyboard-block-sub {
  font-size: 0.75rem;
  color: var(--home-muted, #8e97a5);
}

.storyboard-mode-value {
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--home-text, #e6edf3);
  height: 200px;
  overflow: auto;
}

.storyboard-detail-desc {
  font-size: 0.85rem;
  color: var(--home-muted, #8e97a5);
  line-height: 1.5;
  height: 200px;
  overflow: auto;
}

.storyboard-list-body .storyboard-block-video .storyboard-block-card {
  height: 200px;
}

.storyboard-insert-fade-enter-active,
.storyboard-insert-fade-leave-active {
  transition: opacity 0.28s ease;
}

.storyboard-insert-fade-enter-from,
.storyboard-insert-fade-leave-to {
  opacity: 0;
}

.storyboard-drag-handle {
  cursor: grab;
}

.storyboard-list--dragging .storyboard-drag-handle {
  cursor: grabbing;
}

.storyboard-list-item--ghost {
  opacity: 0.45;
}

.storyboard-list-item--chosen {
  border-color: rgba(74, 231, 253, 0.45);
}

.storyboard-list-item--fallback {
  width: 100%;
  box-sizing: border-box;
}

.storyboard-insert-gap {
  position: relative;
  min-height: 14px;
  margin: 2px 0;
  flex-shrink: 0;
}

.storyboard-insert-ui {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  z-index: 4;
  pointer-events: auto;
}

.storyboard-insert-dash-line {
  flex: 1 1 120px;
  min-width: 40px;
  height: 0;
  border-top: 2px dashed #1677ff;
}

.storyboard-insert-plus {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--accent-500);
  background: var(--create-surface-panel);
  color: var(--accent-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition:
    background 0.15s,
    color 0.15s,
    transform 0.15s;
}

.storyboard-insert-plus:hover {
  background: var(--accent-500);
  color: white;
  transform: scale(1.06);
}

.storyboard-insert-label {
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--home-muted, #8e97a5);
}

.storyboard-insert-hint {
  flex: 1 1 100%;
  font-size: 0.72rem;
  color: var(--home-muted, #8e97a5);
  margin-left: 36px;
  line-height: 1.3;
}

.storyboard-video-insert-host {
  position: relative;
}

.storyboard-video-insert-edge {
  position: absolute;
  left: 0;
  right: 0;
  height: 14px;
  z-index: 2;
  cursor: pointer;
}

.storyboard-video-insert-edge--top {
  top: -2px;
}

.storyboard-video-insert-edge--bottom {
  bottom: -2px;
}

.storyboard-video-insert-mid {
  min-height: 0;
}

/* 列表末行「+ 添加」条保留正常流布局 */
.storyboard-list > .storyboard-insert-gap:last-child {
  position: relative;
  bottom: auto;
  z-index: auto;
}
</style>
