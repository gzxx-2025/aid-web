<template>
  <div ref="storyboardStepRootRef" class="storyboard-script create-step-storyboard-script storyboard-step">
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
<!--          <ClockCircleOutlined class="storyboard-progress-icon" />-->
          <span>分镜完成进度：{{ progressText }}</span>
          <LoadingOutlined
            v-if="isGenerating || isGeneratingImageBatch"
            class="storyboard-progress-loading"
            spin
          />
        </div>
      </div>
      <div class="storyboard-toolbar-right">
        <a-button size="small" class="storyboard-action-btn" @click="addPanel">
          <template #icon><PlusOutlined /></template>
          添加分镜
        </a-button>
        <StoryboardToolbarOpsDropdown
          v-if="!isGenerating && !isGeneratingImageBatch"
          v-model:open="toolbarOpsOpen"
          :items="scriptToolbarOpsItems"
          :loading="batchDeleteSubmitting"
          @select="handleScriptToolbarOpsSelect"
        />
        <a-button
          v-else-if="isGeneratingImageBatch"
          size="small"
          danger
          class="storyboard-action-btn"
          @click="stopImageBatchGeneration"
        >
          <template #icon><StopOutlined /></template>
          停止生成
        </a-button>
        <a-button v-else size="small" danger class="storyboard-action-btn" @click="stopGeneration">
          <template #icon><StopOutlined /></template>
          停止生成
        </a-button>
      </div>
    </div>

    <div
      :class="[
        'storyboard-step-shell storyboard-script-empty',
        { 'storyboard-step-shell--has-list storyboard-script-empty--has-list': persistedPanels.length > 0 && (!isGenerating || isGeneratingImageBatch) }
      ]"
    >
      <!-- 生成中：骨架屏 + 执行任务中 -->
      <div v-if="isGenerating" class="storyboard-generating-view">
        <div class="storyboard-generating-center">
          <img :src="generatingCenterIcon" alt="" class="storyboard-generating-center-icon" />
          <div class="storyboard-generating-center-title">
            {{ storyboardScriptProgressMessage || '正在按场次生成分镜脚本…' }}
          </div>
          <div class="storyboard-generating-center-progress">
            第 {{ progress.completed }}/{{ progress.total }} 场次
          </div>
        </div>
      </div>
      <div v-else-if="showStoryboardEmptyState" class="storyboard-empty-content">
        <div class="storyboard-empty-inner">
          <div class="storyboard-empty-icon-wrap">
           <img src="/assets/img/icon/empty-fj.svg" alt="">
          </div>
          <p class="storyboard-empty-title">暂无分镜</p>
          <a-button class="storyboard-empty-add-btn" size="small" @click="addPanel"
            >
           <div class="text-gradient">添加分镜</div>
          </a-button
          >
        </div>
      </div>
      <!-- 卡片视图 -->
      <div v-else-if="viewMode === 'card'" class="storyboard-cards">
        <div v-if="showStoryboardPartialBanner" class="storyboard-partial-banner">
          <div class="storyboard-partial-banner__text">{{ generationError }}</div>
          <a-button
            v-if="canResumePartialFailed"
            type="primary"
            size="small"
            class="storyboard-resume-btn"
            :loading="isResumingPartialFailed"
            @click="handleResumePartialFailed"
          >
            续生失败项
          </a-button>
        </div>
        <div v-if="failedPanels.length > 0" class="storyboard-failed-list storyboard-failed-list--inline">
          <div
            v-for="(item, idx) in failedPanels"
            :key="`failed-inline-${item.id || idx}`"
            class="storyboard-failed-item"
          >
            <div class="storyboard-failed-item__title">{{ item.title || `分镜脚本${idx + 1}` }}</div>
            <div class="storyboard-failed-item__desc">{{ item.message || '生成失败，请重试' }}</div>
          </div>
        </div>
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
                  <a-menu-item @click="openStoryboardImage(index)">
                    <EditOutlined />
                    编辑分镜图
                  </a-menu-item>
                  <a-menu-item @click="handleCopyPanel(index)">
                    <CopyOutlined />
                    复制分镜
                  </a-menu-item>
                  <a-menu-item danger @click="removePanel(index)">
                    <DeleteOutlined />
                    删除分镜
                  </a-menu-item>
                  <a-menu-item @click="emit('go-step', 4)">
                    <InfoCircleOutlined />
                    分镜视频
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
            <div class="storyboard-block storyboard-block-small">
              <div class="storyboard-block-title">分镜图：</div>
              <div
                :class="[
                  'storyboard-block-card',
                  {
                    'has-image': !!getPanelCoverImage(panel)?.url,
                    'storyboard-image-loading': isPanelImageGenerating(panel)
                  }
                ]"
                @click="!getPanelCoverImage(panel) && !isPanelImageGenerating(panel) && openStoryboardImage(index)"
              >
                <template v-if="isPanelImageGenerating(panel)">
                  <div class="asset-visual-generating-block" role="status" aria-live="polite">
                    <div class="asset-visual-generating-block__shimmer" aria-hidden="true" />
                    <LoadingOutlined spin class="asset-visual-generating-block__icon" />
                    <p class="asset-visual-generating-block__text">正在生成分镜图…</p>
                  </div>
                </template>
                <template v-else-if="getPanelCoverImage(panel)">
                  <div class="storyboard-block-card-header">
                    <span class="storyboard-block-image-title">{{
                      getPanelCoverImage(panel)?.title || '分镜图'
                    }}</span>
                    <img
                      class="storyboard-block-delete-icon"
                      src="@/assets/img/icon/Delelte.svg"
                      alt="删除"
                      @click.stop="handleDeleteStoryboardImage(index, getPanelCoverImageIndex(panel))"
                    />
                  </div>
                  <div class="storyboard-block-image-wrap" @click.stop="openStoryboardImage(index)">
                    <a-image
                      :src="getPanelCoverImage(panel)?.url || getPanelCoverImage(panel)?.thumbnail"
                      :preview="false"
                      class="storyboard-block-thumb"
                    />
                  </div>
                  <div class="scene-card-image-footer asset-action-footer">
                    <a-button
                      @click.stop="handlePreviewStoryboardImage(index, getPanelCoverImageIndex(panel))"
                    >
                      <template #icon><img :src="iconPreview" alt="" class="footer-action-icon" /></template>
                      预览
                    </a-button>
                    <a-button @click.stop="openStoryboardImage(index)">
                      <template #icon><img :src="iconReplace" alt="" class="footer-action-icon" /></template>
                      替换
                    </a-button>
                    <a-button
                      @click.stop="handleDownloadStoryboardImage(index, getPanelCoverImageIndex(panel))"
                    >
                      <template #icon><img :src="iconDownload" alt="" class="footer-action-icon" /></template>
                      下载
                    </a-button>
                  </div>
                </template>
                <template v-else>
                  <EditOutlined class="storyboard-block-icon" />
                  <div class="storyboard-block-text">编辑分镜图片</div>
                  <div class="storyboard-block-sub">点击去创建此分镜图片</div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 列表视图 -->
      <div v-else ref="storyboardListRef" class="storyboard-list">
        <div v-if="showStoryboardPartialBanner" class="storyboard-partial-banner">
          <div class="storyboard-partial-banner__text">{{ generationError }}</div>
          <a-button
            v-if="canResumePartialFailed"
            type="primary"
            size="small"
            class="storyboard-resume-btn"
            :loading="isResumingPartialFailed"
            @click="handleResumePartialFailed"
          >
            续生失败项
          </a-button>
        </div>
        <div v-if="failedPanels.length > 0" class="storyboard-failed-list storyboard-failed-list--inline">
          <div
            v-for="(item, idx) in failedPanels"
            :key="`failed-inline-${item.id || idx}`"
            class="storyboard-failed-item"
          >
            <div class="storyboard-failed-item__title">{{ item.title || `分镜脚本${idx + 1}` }}</div>
            <div class="storyboard-failed-item__desc">{{ item.message || '生成失败，请重试' }}</div>
          </div>
        </div>
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
          :class="{ 'storyboard-list--dragging': isShotDragging }"
          ghost-class="storyboard-list-item--ghost"
          chosen-class="storyboard-list-item--chosen"
          drag-class="storyboard-list-item--dragging"
          @start="onShotDragStart"
          @end="onShotDragEnd"
          @change="onShotListDragChange"
        >
          <template #item="{ element: panel, index }">
            <div>
              <!-- 行首/行间插入：热区在「分镜脚本」列对齐，虚线贯穿整行 -->
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
                  </div>
                </Transition>
              </div>
              <div class="storyboard-list-item" :data-panel-index="index">
                <div class="storyboard-list-header">
                  <span class="storyboard-drag-handle" aria-label="拖动排序" title="拖动排序" @click.stop>
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
                    <button class="storyboard-action-link" type="button" @click="emit('go-step', 4)">
                      分镜视频
                    </button>
                    <button class="storyboard-action-link" type="button" @click="emit('go-step', 5)">
                      配音对口型
                    </button>
                    <a-tooltip
                      :open="editScriptTooltipVisibleIndex === index"
                      placement="bottom"
                      title="点击编辑，修改该条分镜素材"
                      overlay-class-name="storyboard-edit-script-tooltip"
                      @update:open="(open) => onEditScriptTooltipOpenChange(open, index)"
                    >
                      <a-button
                        size="small"
                        :class="{
                          'storyboard-edit-script-btn--highlight':
                            editScriptTooltipVisibleIndex === index
                        }"
                        @click="openStoryboardScriptModal(index)"
                        >修改分镜脚本</a-button
                      >
                    </a-tooltip>
                    <a-button size="small" @click="openStoryboardImage(index)">编辑分镜图</a-button>
                    <a-button size="small" @click="handleCopyPanel(index)">
                      复制分镜
                    </a-button>
                    <a-button size="small" danger @click="removePanel(index)">
                      删除分镜
                    </a-button>
                  </div>
                </div>
                <div class="storyboard-list-body">
                  <div
                    class="storyboard-block storyboard-block-small"
                    @mouseenter="clearInsertSlotImmediate"
                  >
                    <div class="storyboard-block-title">分镜图：</div>
                    <div
                      :class="[
                        'storyboard-block-card',
                        {
                          'has-image': !!getPanelCoverImage(panel)?.url,
                          'storyboard-image-loading': isPanelImageGenerating(panel)
                        }
                      ]"
                      @click="!getPanelCoverImage(panel) && !isPanelImageGenerating(panel) && openStoryboardImage(index)"
                    >
                      <template v-if="isPanelImageGenerating(panel)">
                  <div class="asset-visual-generating-block" role="status" aria-live="polite">
                    <div class="asset-visual-generating-block__shimmer" aria-hidden="true" />
                    <LoadingOutlined spin class="asset-visual-generating-block__icon" />
                    <p class="asset-visual-generating-block__text">正在生成分镜图…</p>
                  </div>
                </template>
                <template v-else-if="getPanelCoverImage(panel)">
                        <div class="storyboard-block-card-header">
                          <span class="storyboard-block-image-title">{{
                            getPanelCoverImage(panel)?.title || '分镜图'
                          }}</span>
                          <img
                            class="storyboard-block-delete-icon"
                            src="@/assets/img/icon/Delelte.svg"
                            alt="删除"
                            @click.stop="
                              handleDeleteStoryboardImage(index, getPanelCoverImageIndex(panel))
                            "
                          />
                        </div>
                        <div
                          class="storyboard-block-image-wrap"
                          @click.stop="openStoryboardImage(index)"
                        >
                          <a-image
                            :src="getPanelCoverImage(panel)?.url || getPanelCoverImage(panel)?.thumbnail"
                            :preview="false"
                            class="storyboard-block-thumb"
                          />
                        </div>
                        <div class="scene-card-image-footer asset-action-footer">
                          <a-button
                            @click.stop="
                              handlePreviewStoryboardImage(index, getPanelCoverImageIndex(panel))
                            "
                          >
                            <template #icon><img :src="iconPreview" alt="" class="footer-action-icon" /></template>
                            预览
                          </a-button>
                          <a-button @click.stop="openStoryboardImage(index)">
                            <template #icon><img :src="iconReplace" alt="" class="footer-action-icon" /></template>
                            替换
                          </a-button>
                          <a-button
                            @click.stop="
                              handleDownloadStoryboardImage(index, getPanelCoverImageIndex(panel))
                            "
                          >
                            <template #icon><img :src="iconDownload" alt="" class="footer-action-icon" /></template>
                            下载
                          </a-button>
                        </div>
                      </template>
                      <template v-else>
                        <img src="@/assets/img/icon/pencil.svg" alt="">
                        <div class="storyboard-block-text">编辑分镜</div>
                        <div class="storyboard-block-sub">点击去创建此分镜</div>
                      </template>
                    </div>
                  </div>
                  <div
                    class="storyboard-block storyboard-block-small"
                    @mouseenter="clearInsertSlotImmediate"
                  >
                    <div class="storyboard-block-title">参考图片：</div>
                    <div class="storyboard-reference-card">暂无参考图</div>
                  </div>
                  <div class="storyboard-block storyboard-block-script storyboard-script-insert-host">
                    <div
                      v-if="index > 0"
                      class="storyboard-script-insert-edge storyboard-script-insert-edge--top"
                      @mouseenter="onInsertSlotEnter(index)"
                      @mouseleave="onInsertSlotLeave"
                    />
                    <div class="storyboard-block-title" @mouseenter="clearInsertSlotImmediate">
                      分镜脚本：
                    </div>
                    <div
                      v-if="panel.scriptContent"
                      class="storyboard-script-content"
                      @click="openStoryboardScriptModal(index)"
                      @mouseenter="clearInsertSlotImmediate"
                  v-html="renderStoryboardScriptContent(panel.scriptContent)"
                    >
                    </div>
                    <div
                      v-else
                      class="storyboard-script-tip"
                      @click="openStoryboardScriptModal(index)"
                      @mouseenter="clearInsertSlotImmediate"
                    >
                      可点击「修改分镜脚本」或「自动生成分镜」生成脚本
                    </div>
                    <div
                      class="storyboard-script-insert-edge storyboard-script-insert-edge--bottom"
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
              <div class="storyboard-insert-label" 
              @click.stop="addPanel">
                <PlusOutlined />
                <div class="text-gradient">添加分镜</div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <EditStoryboardImageModal
      v-if="currentPanelIndex >= 0"
      :key="`storyboard-image-${panels[currentPanelIndex]?.id ?? currentPanelIndex}`"
      v-model:open="isImageModalOpen"
      :scene-index="currentPanelIndex"
      :editor-scope-key="`storyboard-image-${panels[currentPanelIndex]?.id ?? currentPanelIndex}`"
      :scenes="storyboardScenes"
      @update="handleStoryboardUpdate"
    />
    <StoryboardScriptModal
      v-model:open="showStoryboardScriptModal"
      :panel-title="currentScriptPanelTitle"
      :initial-content="currentScriptPanelContent"
      @save="handleSaveStoryboardScript"
    />
    <!-- 自动生成分镜弹窗：确定后开始生成 -->
    <StoryboardGenerateModal
      v-model:open="showAutoGenerateModal"
      mode="generate"
      :agent="creationStore.storyboardAgent"
      :shot-density="creationStore.storyboardGenerateSettings.shotDensity"
      @confirm="handleConfirmAutoGenerate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick, inject } from 'vue'
import { useRoute } from 'vue-router'
import { h } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  PlusOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  DeleteOutlined,
  CopyOutlined,
  LoadingOutlined,
  StopOutlined,
  HolderOutlined,
  EditOutlined,
  ThunderboltOutlined,
  PictureOutlined
} from '@ant-design/icons-vue'
import listNorIcon from '~/assets/img/icon/list-nor.svg'
import listSelIcon from '~/assets/img/icon/list-sel.svg'
import cardNorIcon from '~/assets/img/icon/card-nor.svg'
import cardSelIcon from '~/assets/img/icon/card-sel.svg'
import iconPreview from '~/assets/img/icon/Preview.svg'
import iconReplace from '~/assets/img/icon/Replace.svg'
import iconDownload from '~/assets/img/icon/download.svg'
import generatingCenterIcon from '~/assets/img/icon/tmp00000001.png'
import { looksLikeHtmlFragment, scriptApiTextToEditorHtml } from '~/utils/htmlPlain'
import { moveItemBeforeIndex } from '~/utils/moveItemBeforeIndex'
import { useCreationStore } from '~/stores/creation'
import Draggable from 'vuedraggable'
import {
  STORYBOARD_WORKBENCH_NEED_PROJECT_MSG,
  useStoryboardWorkbenchMutations
} from '~/composables/useStoryboardWorkbenchMutations'
import { createFlowShellKey } from '~/utils/createFlowInjection'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import { useStoryboardScriptBatchGenerate } from '~/composables/useStoryboardScriptBatchGenerate'
import { useStoryboardImageBatchGenerate } from '~/composables/useStoryboardImageBatchGenerate'
import {
  pickStoryboardCoverImage,
  resolveStoryboardPanelCoverImage
} from '~/utils/storyboardImageCover'
import {
  applyStoryboardScriptPanelsFromApi
} from '~/composables/useCreateFlowStoryboardSync'
import { mapStoryboardListRowToPanel, getPersistedStoryboardScriptPanels, stripStoryboardScriptSkeletonPanels } from '~/utils/storyboardPanelMap'
import {
  extractStoryboardTitleSuffix,
  formatStoryboardScriptTitle,
  resolveStoryboardListDisplayTitle
} from '~/utils/storyboardPanelTitle'
import { userStoryboardList } from '~/utils/businessApi'
import { extractSceneIdsFromPartialFailed } from '~/utils/taskPartialFailed'
import {
  fetchProjectImageAndVideoRecordMaps,
  hydrateScriptPanelsWithImageRecords
} from '~/utils/storyboardRecordBatch'
import EditStoryboardImageModal from './EditStoryboardImageModal.vue'
import StoryboardScriptModal from './StoryboardScriptModal.vue'
import StoryboardGenerateModal from './StoryboardGenerateModal.vue'
import StoryboardToolbarOpsDropdown, {
  type StoryboardOpsMenuItem
} from './StoryboardToolbarOpsDropdown.vue'

interface StoryboardPanel {
  id: string
  title: string
  images?: any[]
  finalImageUrl?: string | null
  scriptContent?: string
  dialogueText?: string | null
}

interface Props {
  modelValue: StoryboardPanel[]
  editScriptTooltipTargetIndex?: number | null
  editScriptTooltipKey?: number
}

const props = withDefaults(defineProps<Props>(), {
  editScriptTooltipTargetIndex: null,
  editScriptTooltipKey: 0
})
const emit = defineEmits<{
  (e: 'update:modelValue', value: StoryboardPanel[]): void
  (e: 'go-step', stepIndex: number): void
  (e: 'generation-complete', panels: StoryboardPanel[]): void
}>()

const route = useRoute()
const creationStore = useCreationStore()
const wb = useStoryboardWorkbenchMutations()
const storyboardScriptGen = useStoryboardScriptBatchGenerate()
const storyboardImageBatchGen = useStoryboardImageBatchGenerate()
const createFlowShell = inject(createFlowShellKey, null)

let storyboardRestoreGeneration = 0
let storyboardImageRestoreGeneration = 0

function storyboardApiErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

const viewMode = ref<'list' | 'card'>('list')
const showAutoGenerateModal = ref(false)
const scriptManualAgentModelPick = ref(false)
const toolbarOpsOpen = ref(false)
const batchDeleteSubmitting = ref(false)
const generationStopped = ref(false)
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const isImageModalOpen = ref(false)
const currentPanelIndex = ref(-1)
const showStoryboardScriptModal = ref(false)
const currentScriptPanelIndex = ref(-1)
const editScriptTooltipVisibleIndex = ref<number | null>(null)
let editScriptTooltipTimer: ReturnType<typeof setTimeout> | null = null
const storyboardStepRootRef = ref<HTMLElement | null>(null)
const storyboardListRef = ref<HTMLElement | null>(null)
const bottomAddBarRef = ref<HTMLElement | null>(null)
/** 列表拖拽排序（仅列表视图）：与分镜视频、配音列表同索引联动 */
const isShotDragging = ref(false)

function onShotDragStart() {
  isShotDragging.value = true
}

function onShotDragEnd() {
  isShotDragging.value = false
}

interface StoryboardDragChangeEvent {
  moved?: {
    oldIndex: number
    newIndex: number
  }
}

async function onShotListDragChange(evt: StoryboardDragChangeEvent) {
  const moved = evt?.moved
  if (!moved) return
  const from = moved.oldIndex
  const to = moved.newIndex
  const insertBefore = from < to ? to + 1 : to
  await applyShotReorder(from, insertBefore)
}

async function applyShotReorder(from: number, insertBefore: number) {
  const s = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  if (s.length <= 1) return
  const nextS = moveItemBeforeIndex(s, from, insertBefore)
  const v = [...creationStore.formData.storyboardVideo.panels]
  const d = [...creationStore.formData.dubbing.panels]
  const nextV = v.length === nextS.length ? moveItemBeforeIndex(v, from, insertBefore) : v
  const nextD = d.length === nextS.length ? moveItemBeforeIndex(d, from, insertBefore) : d
  creationStore.formData.storyboardScript.panels = nextS
  creationStore.formData.storyboardVideo.panels = nextV
  creationStore.formData.dubbing.panels = nextD
  emit('update:modelValue', nextS)
  if (nextS.length > 0 && nextS.every((p) => wb.parseServerStoryboardId(p.id) != null)) {
    try {
      await wb.sortRemoteToMatchPanels(nextS)
    } catch (err: unknown) {
      message.warning(`排序同步失败：${storyboardApiErr(err)}`)
    }
  }
}

const panels = computed(() => props.modelValue || [])
const persistedPanels = computed(() => getPersistedStoryboardScriptPanels(panels.value))
const showStoryboardEmptyState = computed(
  () => !isGenerating.value && !isGeneratingImageBatch.value && persistedPanels.value.length === 0
)

function displayPanelTitle(panel: StoryboardPanel, index: number): string {
  return resolveStoryboardListDisplayTitle(panel.title, index, 'script')
}

function getPanelCoverImage(panel: StoryboardPanel) {
  return resolveStoryboardPanelCoverImage(panel)
}

async function refreshPanelsFromStoryboardListApi() {
  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) return
  try {
    const list = await userStoryboardList({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId
    })
    const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    let panels = sorted.map((row, index) => mapStoryboardListRowToPanel(row, index))
    try {
      const { imageByStoryboardId } = await fetchProjectImageAndVideoRecordMaps(ctx)
      panels = hydrateScriptPanelsWithImageRecords(panels, imageByStoryboardId)
    } catch {
      /* 生成记录拉取失败时仍展示分镜列表 */
    }
    applyStoryboardScriptPanelsFromApi(panels)
    emit('update:modelValue', creationStore.formData.storyboardScript.panels as StoryboardPanel[])
  } catch (e: unknown) {
    message.warning(`刷新分镜列表失败：${storyboardApiErr(e)}`)
  }
}

function getPanelCoverImageIndex(panel: StoryboardPanel): number {
  const cover = getPanelCoverImage(panel)
  if (!cover?.id || !panel.images?.length) return -1
  return panel.images.findIndex((im) => String(im?.id ?? '') === String(cover.id))
}

const currentScriptPanelTitle = computed(() => {
  const idx = currentScriptPanelIndex.value
  if (idx < 0 || idx >= panels.value.length) return ''
  return panels.value[idx]?.title ?? ''
})

const currentScriptPanelContent = computed(() => {
  const idx = currentScriptPanelIndex.value
  if (idx < 0 || idx >= panels.value.length) return ''
  return panels.value[idx]?.scriptContent ?? ''
})

const storyboardScenes = computed(() =>
  panels.value.map((panel) => ({
    name: panel.title,
    images: Array.isArray(panel.images) ? panel.images.map((img) => ({ ...img })) : [],
    scriptContent: panel.scriptContent ?? '',
    storyboardId: Number.isFinite(Number(panel.id)) ? Number(panel.id) : undefined
  }))
)

function renderStoryboardScriptContent(content?: string): string {
  const raw = (content ?? '').trim()
  if (!raw) return ''
  if (looksLikeHtmlFragment(raw)) return raw
  return scriptApiTextToEditorHtml(raw)
}

const isGenerating = computed(() => creationStore.isGeneratingStoryboard)
const isGeneratingImageBatch = computed(() => creationStore.isGeneratingStoryboardImageBatch)
const generationError = computed(() => creationStore.storyboardGenerationError)
const isPartialStoryboardError = computed(() => {
  const msg = String(generationError.value || '')
  if (!msg) return false
  if (msg.includes('部分') || msg.includes('续生')) return true
  return !!creationStore.storyboardScriptPartialFailedData?.failedItems?.length
})
const showStoryboardPartialBanner = computed(
  () => isPartialStoryboardError.value && !!generationError.value && persistedPanels.value.length > 0
)
const progress = computed(() => creationStore.storyboardGenerationProgress)
const imageBatchProgress = computed(() => creationStore.storyboardImageBatchProgress)
const storyboardScriptProgressMessage = computed(
  () => storyboardScriptGen.taskProgressMessage.value
)

const progressText = computed(() => {
  if (isGenerating.value) {
    return `第 ${progress.value.completed}/${progress.value.total} 场次`
  }
  if (isGeneratingImageBatch.value) {
    return `${imageBatchProgress.value.completed}/${imageBatchProgress.value.total}`
  }
  const completed = storyboardImageCompletedCount.value
  const total = persistedPanels.value.length
  return `${completed}/${total}`
})

function isPanelImageGenerating(panel: StoryboardPanel): boolean {
  const sid = wb.parseServerStoryboardId(panel.id)
  if (sid == null) return false
  return creationStore.storyboardPanelImageGenStatusByStoryboardId[String(sid)] === 'generating'
}

const storyboardImageCompletedCount = computed(
  () => panels.value.filter((p) => !!getPanelCoverImage(p)?.url).length
)

const scriptAutoGenerateLabel = computed(() =>
  panels.value.length > 0 ? '重新生成分镜' : '自动生成分镜'
)

const scriptBatchImageLabel = computed(() =>
  storyboardImageCompletedCount.value > 0 ? '重新批量生成分镜图' : '批量生成分镜图'
)

const scriptToolbarOpsItems = computed((): StoryboardOpsMenuItem[] => [
  {
    key: 'auto-script',
    label: scriptAutoGenerateLabel.value,
    icon: ThunderboltOutlined
  },
  {
    key: 'batch-image',
    label: scriptBatchImageLabel.value,
    icon: PictureOutlined,
    disabled: panels.value.length === 0 || isGeneratingImageBatch.value || isGenerating.value,
    disabledTooltip:
      panels.value.length === 0 ? '暂无分镜，请先添加或自动生成分镜' : undefined
  },
  {
    key: 'batch-delete',
    label: '批量删除分镜',
    icon: DeleteOutlined,
    danger: true,
    disabled: panels.value.length === 0 || batchDeleteSubmitting.value
  }
])

function handleScriptToolbarOpsSelect(key: string) {
  if (key === 'auto-script') {
    openAutoGenerateModal()
    return
  }
  if (key === 'batch-image') {
    void handleBatchGenerateStoryboardImages()
    return
  }
  if (key === 'batch-delete') {
    handleBatchDeleteStoryboardPanels()
  }
}

async function handleBatchGenerateStoryboardImages() {
  if (isGeneratingImageBatch.value || panels.value.length === 0) return
  const overwrite = storyboardImageCompletedCount.value > 0
  try {
    const result = await storyboardImageBatchGen.runBatchForPanels(panels.value, overwrite)
    emit('update:modelValue', result.panels)
    if (result.ok) {
      message.success(overwrite ? '已重新批量生成分镜图' : '批量生成分镜图完成')
    } else if (result.message) {
      message.error(result.message)
    }
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '批量生成分镜图失败')
  }
}

async function stopImageBatchGeneration() {
  await storyboardImageBatchGen.requestStop()
  message.info('已停止生成')
}

function handleBatchDeleteStoryboardPanels() {
  const count = panels.value.length
  if (!count || batchDeleteSubmitting.value) return
  Modal.confirm({
    title: '确认批量删除全部分镜？',
    content: `将删除当前 ${count} 个分镜及其分镜图、脚本、分镜视频与配音对口型，且不可恢复。`,
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
        await wb.deleteRemoteBatch(panels.value.map((p) => p.id))
        emit('update:modelValue', [])
        creationStore.formData.storyboardVideo.panels = []
        creationStore.formData.dubbing.panels = []
        message.success('已删除全部分镜')
      } catch (e: unknown) {
        message.error(storyboardApiErr(e))
        throw e
      } finally {
        batchDeleteSubmitting.value = false
      }
    }
  })
}

const generationPercent = computed(() => {
  const total = Number(progress.value.total || 0)
  const completed = Number(progress.value.completed || 0)
  if (total <= 0) return 0
  const percent = Math.round((completed / total) * 100)
  return Math.min(100, Math.max(0, percent))
})
const failedPanels = computed(() => {
  if (!generationError.value) return []

  const partialData = creationStore.storyboardScriptPartialFailedData
  const failedItems = partialData?.failedItems
  if (Array.isArray(failedItems) && failedItems.length > 0) {
    const scenes = creationStore.formData.sceneCharacter?.scenes || []
    return failedItems.map((item, idx) => {
      const batchIndex = Number(item.batchIndex ?? idx)
      const sceneAtIndex = scenes[Number.isFinite(batchIndex) ? batchIndex : idx]
      const sceneName = String(item.sceneName ?? sceneAtIndex ?? '').trim()
      const message = String(item.message ?? item.reason ?? '生成失败，请重试').trim()
      return {
        id: `failed-${String(item.sceneId ?? item.scene_id ?? item.batchId ?? batchIndex)}`,
        title: sceneName || `场次${(Number.isFinite(batchIndex) ? batchIndex : idx) + 1}`,
        message
      }
    })
  }

  return []
})

const isResumingPartialFailed = ref(false)
const canResumePartialFailed = computed(() => {
  const taskId = creationStore.storyboardScriptActiveTaskId
  return !!generationError.value && Number.isFinite(Number(taskId)) && Number(taskId) > 0
})

async function handleResumePartialFailed() {
  const taskId = Number(creationStore.storyboardScriptActiveTaskId)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    message.warning('无可续生的任务')
    return
  }
  isResumingPartialFailed.value = true
  generationStopped.value = false
  creationStore.setStoryboardGenerating(true)
  creationStore.setStoryboardError(null)
  creationStore.setStoryboardScriptPartialFailedData(null)
  try {
    const result = await storyboardScriptGen.resumePartialFailedGenerate(taskId, panels.value)
    syncStoryboardScriptPanelsFromTaskResult(result.panels)
    if (result.ok) {
      message.success('分镜续生完成')
      emit('generation-complete', result.panels)
    } else if (result.message) {
      message.warning(result.message)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '续生失败'
    if (getPersistedStoryboardScriptPanels(panels.value).length > 0) {
      creationStore.setStoryboardError(msg)
    } else {
      clearStoryboardScriptToEmptyState()
      emit('update:modelValue', [])
    }
    message.error(msg)
  } finally {
    isResumingPartialFailed.value = false
    if (!creationStore.storyboardGenerationError) {
      creationStore.setStoryboardGenerating(false)
    }
  }
}

function openAutoGenerateModal() {
  showAutoGenerateModal.value = true
}

function handleConfirmAutoGenerate(settings: {
  agentId: string
  shotDensity: string
  modelCode?: string
  manualAgentModelPick?: boolean
}) {
  scriptManualAgentModelPick.value = settings.manualAgentModelPick === true
  creationStore.setStoryboardGenerateSettings({
    shotDensity: settings.shotDensity,
    ...(scriptManualAgentModelPick.value
      ? { agentId: settings.agentId, modelCode: settings.modelCode }
      : { agentId: '', modelCode: '' })
  })
  startGeneration()
}

function prepareGeneratingProgress() {
  const scenes = creationStore.formData.sceneCharacter?.scenes || []
  const total = Math.max(
    scenes.filter((s) => String(s ?? '').trim().length > 0).length,
    1
  )
  creationStore.setStoryboardProgress(0, total)
}

function clearStoryboardScriptToEmptyState() {
  applyStoryboardScriptPanelsFromApi([])
  creationStore.clearStoryboardScriptGenerationOutcome()
  creationStore.setStoryboardProgress(0, 0)
}

function syncStoryboardScriptPanelsFromTaskResult(next: StoryboardPanel[]): StoryboardPanel[] {
  const persisted = getPersistedStoryboardScriptPanels(next)
  if (persisted.length === 0) {
    clearStoryboardScriptToEmptyState()
    emit('update:modelValue', [])
    return persisted
  }
  applyStoryboardScriptPanelsFromApi(next)
  emit('update:modelValue', creationStore.formData.storyboardScript.panels as StoryboardPanel[])
  return persisted
}

type StoryboardScriptGenerateOptions = {
  sceneIds?: number[]
}

async function startGeneration(options?: StoryboardScriptGenerateOptions) {
  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }

  generationStopped.value = false
  creationStore.setStoryboardGenerating(true)
  creationStore.setStoryboardError(null)
  prepareGeneratingProgress()

  const routeCtx = captureCreationLiveGenScope()
  try {
    const result = await storyboardScriptGen.runBatchGenerate(panels.value, {
      manualAgentModelPick: scriptManualAgentModelPick.value,
      ...(options?.sceneIds?.length ? { sceneIds: options.sceneIds } : {})
    })
    if (!matchesCreationLiveGenScope(routeCtx)) {
      creationStore.mergeStep4PlusLiveGenForScopeKey(routeCtx.scopeKey, {
        isGeneratingStoryboard: false,
        storyboardGenerationProgress: { completed: 0, total: 0 },
        storyboardGenerationError: null,
        storyboardScriptActiveTaskId: null
      })
      return
    }

    if (result.ok) {
      syncStoryboardScriptPanelsFromTaskResult(result.panels)
      creationStore.setStoryboardGenerating(false)
      message.success('分镜生成完成')
      emit('generation-complete', result.panels)
      return
    }

    if (generationStopped.value) {
      creationStore.stopStoryboardGeneration()
      message.info('已停止生成')
      return
    }

    const persistedAfterFail = syncStoryboardScriptPanelsFromTaskResult(result.panels)
    if (persistedAfterFail.length > 0) {
      creationStore.setStoryboardError(result.message || '分镜生成失败，请稍后重试。')
    }
    creationStore.setStoryboardGenerating(false)
    message.error(result.message || '分镜生成失败')
  } catch (err) {
    if (!matchesCreationLiveGenScope(routeCtx)) return
    const failMessage = err instanceof Error ? err.message : '分镜生成异常中断，请重试。'
    if (getPersistedStoryboardScriptPanels(panels.value).length > 0) {
      creationStore.setStoryboardError(failMessage)
    } else {
      clearStoryboardScriptToEmptyState()
      emit('update:modelValue', [])
    }
    creationStore.setStoryboardGenerating(false)
    message.error('分镜生成失败')
  }
}

async function stopGeneration() {
  generationStopped.value = true
  await storyboardScriptGen.requestStop()
  creationStore.stopStoryboardGeneration()
  message.info('已停止生成')
}

async function restoreStoryboardScriptGenerationIfNeeded() {
  if (!creationStore.isHydrated) return
  storyboardScriptGen.cancelResumeFollow()
  const gen = ++storyboardRestoreGeneration
  await storyboardScriptGen.restoreOngoingGenerationIfNeeded(
    panels.value,
    (next) => {
      if (gen !== storyboardRestoreGeneration) return
      syncStoryboardScriptPanelsFromTaskResult(next)
    },
    () => {
      if (gen !== storyboardRestoreGeneration) return
      prepareGeneratingProgress()
    }
  )
}

watch(
  () =>
    [
      persistedPanels.value.length,
      creationStore.storyboardGenerationError,
      isGenerating.value,
      isGeneratingImageBatch.value
    ] as const,
  ([persistedCount, err, generating, imageBatchGenerating]) => {
    if (persistedCount > 0 || generating || imageBatchGenerating) return
    if (!err) return
    clearStoryboardScriptToEmptyState()
    emit('update:modelValue', [])
  }
)

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
    void restoreStoryboardScriptGenerationIfNeeded()
  },
  { immediate: true }
)

async function restoreStoryboardImageBatchIfNeeded() {
  if (!creationStore.isHydrated) return
  storyboardImageBatchGen.cancelResumeFollow()
  const gen = ++storyboardImageRestoreGeneration
  await storyboardImageBatchGen.restoreOngoingBatchIfNeeded(panels.value, (next) => {
    if (gen !== storyboardImageRestoreGeneration) return
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
    void restoreStoryboardImageBatchIfNeeded()
  },
  { immediate: true }
)

function handleGlobalTrackTaskEvent(event: Event) {
  const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
  const ty = String(detail?.taskType ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (ty === 'storyboard_image_prompt_batch') {
    storyboardImageBatchGen.onGlobalTrackTask(event, (result) => {
      emit('update:modelValue', result.panels)
      if (result.ok) {
        message.success('批量生成分镜图完成')
      } else if (result.message) {
        message.error(result.message)
      }
    })
    return
  }
  generationStopped.value = false
  prepareGeneratingProgress()
  storyboardScriptGen.onGlobalTrackTask(event, (result) => {
    syncStoryboardScriptPanelsFromTaskResult(result.panels)
    if (result.ok) {
      message.success('分镜生成完成')
      emit('generation-complete', result.panels)
    } else if (result.message && !generationStopped.value) {
      if (result.message.includes('部分') || result.message.includes('续生')) {
        message.warning(result.message)
      } else {
        message.error(result.message)
      }
    }
  })
}

function handleGlobalResumeTaskEvent(event: Event) {
  const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
  const ty = String(detail?.taskType ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (ty !== 'storyboard_script_batch') return
  const taskId = Number(detail?.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) return
  creationStore.setStoryboardScriptActiveTaskId(taskId)
  void handleResumePartialFailed()
}

function handleGlobalRestartTaskEvent(event: Event) {
  const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
  const ty = String(detail?.taskType ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (ty !== 'storyboard_script_batch') return
  const sceneIds = extractSceneIdsFromPartialFailed(
    creationStore.storyboardScriptPartialFailedData
  )
  void startGeneration(sceneIds.length ? { sceneIds } : undefined)
}

async function handleGlobalStopTaskEvent(event: Event) {
  const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
  const ty = String(detail?.taskType ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (ty === 'storyboard_image_prompt_batch') {
    void storyboardImageBatchGen.onGlobalStopTask(event)
    return
  }
  const isStoryboardTask =
    ty === 'storyboard_script_batch' ||
    storyboardScriptGen.activeTaskId.value === Number(detail?.taskId) ||
    creationStore.storyboardScriptActiveTaskId === Number(detail?.taskId)
  if (!isStoryboardTask) return
  generationStopped.value = true
  await storyboardScriptGen.requestStop()
  creationStore.stopStoryboardGeneration()
}

onMounted(() => {
  const stripped = stripStoryboardScriptSkeletonPanels(panels.value)
  const persisted = getPersistedStoryboardScriptPanels(stripped)
  if (persisted.length === 0) {
    if (panels.value.length > 0 || creationStore.storyboardGenerationError) {
      clearStoryboardScriptToEmptyState()
      emit('update:modelValue', [])
    }
  } else if (stripped.length !== panels.value.length) {
    applyStoryboardScriptPanelsFromApi(stripped)
  }
  if (import.meta.client) {
    window.addEventListener('create-flow-stop-task', handleGlobalStopTaskEvent)
    window.addEventListener('create-flow-track-task', handleGlobalTrackTaskEvent)
    window.addEventListener('create-flow-restart-task', handleGlobalRestartTaskEvent)
    window.addEventListener('create-flow-resume-task', handleGlobalResumeTaskEvent)
    void restoreStoryboardScriptGenerationIfNeeded()
    void restoreStoryboardImageBatchIfNeeded()
  }
})

onUnmounted(() => {
  storyboardScriptGen.cancelResumeFollow()
  storyboardImageBatchGen.cancelResumeFollow()
  if (import.meta.client) {
    window.removeEventListener('create-flow-stop-task', handleGlobalStopTaskEvent)
    window.removeEventListener('create-flow-track-task', handleGlobalTrackTaskEvent)
    window.removeEventListener('create-flow-restart-task', handleGlobalRestartTaskEvent)
    window.removeEventListener('create-flow-resume-task', handleGlobalResumeTaskEvent)
  }
  clearEditScriptTooltipState()
  if (insertLeaveTimer) {
    clearTimeout(insertLeaveTimer)
    insertLeaveTimer = null
  }
})

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

  const n = panels.value.length
  const defaultTitle = formatStoryboardScriptTitle(atIndex, '未命名')
  let newPanel: StoryboardPanel

  try {
    const data = await wb.createRemote(defaultTitle)
    if (!data) throw new Error('no data')
    newPanel = {
      id: String(data.id),
      title: (data.title && data.title.trim()) || defaultTitle
    }
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
    return
  }

  const next = [...panels.value]
  next.splice(atIndex, 0, newPanel)
  emit('update:modelValue', next)
  if (next.every((p) => wb.parseServerStoryboardId(p.id) != null)) {
    try {
      await wb.sortRemoteToMatchPanels(next)
    } catch (e: unknown) {
      message.warning(storyboardApiErr(e))
    }
  }
  clearInsertSlotImmediate()
  message.success('已插入空白分镜')
  scrollToLatestPanel()
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

/** 从分镜视频跳回时：前几项默认已在列表顶部，无需滚动 */
const JUMP_SCROLL_SKIP_HEAD_COUNT = 2

function getPreviewScrollContainer(): HTMLElement | null {
  return storyboardStepRootRef.value?.closest('.preview-content') as HTMLElement | null
}

function getPanelListItem(index: number): HTMLElement | null {
  const listEl = storyboardListRef.value
  if (!listEl) return null
  return listEl.querySelector(`[data-panel-index="${index}"]`) as HTMLElement | null
}

function scrollToPanelIndex(targetIndex: number, behavior: ScrollBehavior = 'smooth') {
  let attempts = 0
  const maxAttempts = 8

  const run = () => {
    attempts += 1
    const preview = getPreviewScrollContainer()
    const target = getPanelListItem(targetIndex)
    if (!target) {
      if (attempts < maxAttempts) requestAnimationFrame(run)
      return
    }

    if (targetIndex < JUMP_SCROLL_SKIP_HEAD_COUNT) {
      if (!preview || preview.scrollTop <= 8) return
    }

    if (preview) {
      const previewRect = preview.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const topOffset = 16
      const alreadyVisible =
        targetRect.top >= previewRect.top + topOffset &&
        targetRect.bottom <= previewRect.bottom - 8
      if (alreadyVisible) return

      const nextTop = preview.scrollTop + (targetRect.top - previewRect.top) - topOffset
      preview.scrollTo({ top: Math.max(0, nextTop), behavior })
      return
    }

    target.scrollIntoView({ behavior, block: 'start' })
  }

  nextTick(() => {
    nextTick(() => {
      requestAnimationFrame(run)
    })
  })
}

const addPanel = async () => {
  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }

  const nextIndex = panels.value.length
  const defaultTitle = formatStoryboardScriptTitle(nextIndex, '未命名')
  let newPanel: StoryboardPanel

  try {
    const data = await wb.createRemote(defaultTitle)
    if (!data) throw new Error('no data')
    newPanel = {
      id: String(data.id),
      title: (data.title && data.title.trim()) || defaultTitle
    }
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
    return
  }

  emit('update:modelValue', [...panels.value, newPanel])
  scrollToLatestPanel()
}

const startEditTitle = (panel: StoryboardPanel) => {
  editingId.value = panel.id
  editingTitle.value = panel.title
}

const finishEditTitle = async (panel: StoryboardPanel) => {
  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    editingId.value = null
    return
  }
  const sid = wb.parseServerStoryboardId(panel.id)
  if (sid == null) {
    message.warning('该分镜未同步到服务器，无法保存标题，请刷新分镜列表后重试')
    editingId.value = null
    return
  }

  const nextTitleRaw = editingTitle.value.trim() || panel.title
  const idx = panels.value.findIndex((p) => p.id === panel.id)
  const nextTitle =
    idx >= 0
      ? formatStoryboardScriptTitle(idx, extractStoryboardTitleSuffix(nextTitleRaw))
      : nextTitleRaw
  const nextPanels = panels.value.map((item) =>
    item.id === panel.id ? { ...item, title: nextTitle } : item
  )
  emit('update:modelValue', nextPanels)
  editingId.value = null

  try {
    await wb.saveRemote({ id: sid, title: nextTitle })
  } catch (e: unknown) {
    message.warning(`标题同步失败：${storyboardApiErr(e)}`)
  }
}

const cancelEditTitle = () => {
  editingId.value = null
  editingTitle.value = ''
}

const openStoryboardImage = (index: number) => {
  currentPanelIndex.value = index
  isImageModalOpen.value = true
}

watch(isImageModalOpen, (open, wasOpen) => {
  if (wasOpen && !open) {
    void refreshPanelsFromStoryboardListApi()
  }
})

function clearEditScriptTooltipState() {
  editScriptTooltipVisibleIndex.value = null
  if (editScriptTooltipTimer) {
    clearTimeout(editScriptTooltipTimer)
    editScriptTooltipTimer = null
  }
  createFlowShell?.clearStoryboardScriptJumpTooltip()
}

function onEditScriptTooltipOpenChange(open: boolean, index: number) {
  if (!open && editScriptTooltipVisibleIndex.value === index) {
    clearEditScriptTooltipState()
  }
}

function showEditScriptTooltipForIndex(targetIndex: number) {
  if (targetIndex < 0 || targetIndex >= panels.value.length) return
  viewMode.value = 'list'
  editScriptTooltipVisibleIndex.value = targetIndex
  scrollToPanelIndex(targetIndex)
  if (editScriptTooltipTimer) clearTimeout(editScriptTooltipTimer)
  editScriptTooltipTimer = setTimeout(() => {
    clearEditScriptTooltipState()
  }, 6000)
}

const openStoryboardScriptModal = (index: number) => {
  clearEditScriptTooltipState()
  currentScriptPanelIndex.value = index
  showStoryboardScriptModal.value = true
}

watch(
  () => props.editScriptTooltipKey,
  (key) => {
    if (!key) return
    const targetIndex = props.editScriptTooltipTargetIndex
    if (targetIndex === null || targetIndex === undefined) return
    nextTick(() => showEditScriptTooltipForIndex(targetIndex))
  },
  { immediate: true }
)

watch(
  () => panels.value.length,
  () => {
    const targetIndex = props.editScriptTooltipTargetIndex
    if (targetIndex === null || targetIndex === undefined) return
    if (!props.editScriptTooltipKey) return
    if (editScriptTooltipVisibleIndex.value === targetIndex) return
    nextTick(() => showEditScriptTooltipForIndex(targetIndex))
  }
)

interface StoryboardScriptModalSavePayload {
  title: string
  content: string
}

const handleSaveStoryboardScript = async (payload: StoryboardScriptModalSavePayload) => {
  const idx = currentScriptPanelIndex.value
  if (idx < 0 || idx >= panels.value.length) return

  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }
  const sid = wb.parseServerStoryboardId(panels.value[idx]!.id)
  if (sid == null) {
    message.warning('该分镜未同步到服务器，无法保存脚本，请刷新分镜列表后重试')
    return
  }

  const nextTitle = payload.title?.trim() || panels.value[idx]!.title || '未命名'
  const nextContent = payload.content ?? ''
  const nextPanels = panels.value.map((panel, i) =>
    i === idx ? { ...panel, title: nextTitle, scriptContent: nextContent } : panel
  )
  emit('update:modelValue', nextPanels)
  showStoryboardScriptModal.value = false
  clearEditScriptTooltipState()

  const updated = nextPanels[idx]
  try {
    const storyScript = wb.scriptHtmlToStoryScriptApi(nextContent)
    await wb.saveRemote({
      id: sid,
      title: nextTitle,
      ...(storyScript !== undefined ? { storyScript } : {}),
      ...(updated.dialogueText != null && String(updated.dialogueText).trim()
        ? { dialogueText: String(updated.dialogueText).trim() }
        : {})
    })
  } catch (e: unknown) {
    message.warning(`脚本同步失败：${storyboardApiErr(e)}`)
  }
  message.success('分镜脚本已保存')
}

// 复制分镜（与场景/角色/道具复制逻辑一致）
const handleCopyPanel = async (index: number) => {
  const panel = panels.value[index]
  if (!panel) return

  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }
  if (wb.parseServerStoryboardId(panel.id) == null) {
    message.warning('该分镜未同步到服务器，无法复制，请刷新分镜列表后重试')
    return
  }

  const nextIndex = panels.value.length
  const suffix = extractStoryboardTitleSuffix(panel.title) || `${panel.title}_副本`
  const newTitle = formatStoryboardScriptTitle(nextIndex, suffix)

  let newPanel: StoryboardPanel
  try {
    const data = await wb.createRemote(newTitle)
    if (!data) throw new Error('no data')
    newPanel = {
      id: String(data.id),
      title: (data.title && data.title.trim()) || newTitle,
      scriptContent: panel.scriptContent,
      dialogueText: panel.dialogueText,
      images:
        Array.isArray(panel.images) && panel.images.length > 0
          ? panel.images.map((img: any) => ({
              ...img,
              id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
              createdAt: new Date().toISOString()
            }))
          : undefined
    }
    emit('update:modelValue', [...panels.value, newPanel])
    const sid = wb.parseServerStoryboardId(newPanel.id)
    if (sid) {
      const story = wb.scriptHtmlToStoryScriptApi(panel.scriptContent)
      const d = panel.dialogueText != null ? String(panel.dialogueText).trim() : ''
      await wb.saveRemote({
        id: sid,
        title: newPanel.title,
        ...(story !== undefined ? { storyScript: story } : {}),
        ...(d ? { dialogueText: d } : {})
      })
    }
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
    return
  }

  try {
    const merged = [...panels.value, newPanel]
    if (merged.every((p) => wb.parseServerStoryboardId(p.id) != null)) {
      await wb.sortRemoteToMatchPanels(merged)
    }
  } catch {
    /* 排序失败不阻断复制成功提示 */
  }
  message.success('分镜已复制')
}

// 删除分镜（与场景/角色/道具删除逻辑一致：确认后删除）
const removePanel = (idx: number) => {
  Modal.confirm({
    title: '确认删除分镜?',
    content: '将同时删除该分镜的分镜图、脚本内容及对应的分镜视频、配音对口型。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const panel = panels.value[idx]
      if (!panel) return

      const ctx = await wb.getProjectEpisodeContext()
      if (!ctx) {
        message.error(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
        throw new Error('no project context')
      }
      const sid = wb.parseServerStoryboardId(panel.id)
      if (sid == null) {
        message.error('该分镜未同步到服务器，无法删除，请刷新分镜列表后重试')
        throw new Error('no server storyboard id')
      }

      try {
        await wb.deleteRemote(panel.id)
      } catch (e: unknown) {
        message.error(storyboardApiErr(e))
        throw e
      }

      const nextPanels = panels.value.filter((_, i) => i !== idx)
      emit('update:modelValue', nextPanels)
      message.success('分镜已删除')
    }
  })
}

const handleStoryboardUpdate = async (sceneIndex: number, data: any) => {
  if (sceneIndex < 0 || sceneIndex >= panels.value.length) return
  const nextPanels = panels.value.map((panel, i) => {
    if (i !== sceneIndex) return panel
    const next: StoryboardPanel = { ...panel }
    if (Array.isArray(data?.images)) {
      next.images = data.images.map((img: any) => ({ ...img }))
      const cover = pickStoryboardCoverImage(next.images)
      const coverUrl = String(cover?.url || cover?.thumbnail || '').trim()
      next.finalImageUrl = coverUrl || undefined
    }
    if (data?.scriptContent !== undefined) {
      next.scriptContent = data.scriptContent
    }
    if (data?.title !== undefined && String(data.title).trim()) {
      next.title = String(data.title).trim()
    }
    return next
  })
  emit('update:modelValue', nextPanels)

  const updated = nextPanels[sceneIndex]
  const needSave =
    data?.scriptContent !== undefined ||
    (data?.title !== undefined && String(data.title).trim().length > 0)
  if (!needSave) return

  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }
  const sid = wb.parseServerStoryboardId(updated.id)
  if (sid == null) {
    message.warning('该分镜未同步到服务器，无法保存，请刷新分镜列表后重试')
    return
  }

  try {
    const storyScript =
      data?.scriptContent !== undefined
        ? wb.scriptHtmlToStoryScriptApi(String(data.scriptContent))
        : undefined
    await wb.saveRemote({
      id: sid,
      ...(data?.title !== undefined && String(data.title).trim()
        ? { title: String(data.title).trim() }
        : { title: updated.title }),
      ...(storyScript !== undefined ? { storyScript } : {}),
      ...(updated.dialogueText != null && String(updated.dialogueText).trim()
        ? { dialogueText: String(updated.dialogueText).trim() }
        : {})
    })
  } catch (e: unknown) {
    message.warning(`分镜同步失败：${storyboardApiErr(e)}`)
  }
}

// 分镜图：预览、下载、删除（与第三步场景角色道具一致）
const handlePreviewStoryboardImage = (panelIndex: number, imageIndex: number) => {
  const panel = panels.value[panelIndex]
  const img = panel?.images?.[imageIndex]
  if (img?.url) {
    Modal.info({
      title: img.title || `分镜图${imageIndex + 1}`,
      content: h('img', {
        src: img.url,
        style: { width: '100%', maxHeight: '70vh', objectFit: 'contain' }
      }),
      width: '80%',
      okText: '关闭'
    })
  } else {
    message.warning('暂无图片可预览')
  }
}

const handleDownloadStoryboardImage = (panelIndex: number, imageIndex: number) => {
  const panel = panels.value[panelIndex]
  const img = panel?.images?.[imageIndex]
  if (img?.url) {
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `分镜图${panelIndex + 1}-${imageIndex + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  } else {
    message.warning('暂无图片可下载')
  }
}

const handleDeleteStoryboardImage = (panelIndex: number, imageIndex: number) => {
  const panel = panels.value[panelIndex]
  if (!panel?.images?.length || imageIndex < 0 || imageIndex >= panel.images.length) return
  const nextImages = panel.images.filter((_, i) => i !== imageIndex)
  const nextPanels = panels.value.map((p, i) =>
    i === panelIndex ? { ...p, images: nextImages } : p
  )
  emit('update:modelValue', nextPanels)
  message.success('分镜图已删除')
}
</script>

<style lang="scss" scoped>
.storyboard-script {
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
.storyboard-generating-view,
.storyboard-error-view {
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
  font-size: 0.9375rem;
  line-height: 1.5;
  font-weight: 500;
}

.storyboard-generating-center-progress {
  color: var(--home-muted, #8e97a5);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.storyboard-error-view {
  flex: 1;
  padding: 1rem;
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: var(--radius-lg);
}

.storyboard-partial-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.08);
  border-radius: 8px;
}

.storyboard-partial-banner__text {
  flex: 1;
  color: #fbbf24;
  font-size: 0.875rem;
  line-height: 1.45;
}

.storyboard-resume-btn {
  flex-shrink: 0;
}

.storyboard-error-text {
  color: var(--red-700);
  font-size: 0.9rem;
}

.storyboard-failed-list {
  margin-top: 0.85rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.65rem;
}

.storyboard-failed-list--inline {
  margin-top: 0;
  margin-bottom: 0.85rem;
}

.storyboard-failed-item {
  border: 1px solid rgba(255, 82, 97, 0.35);
  background: rgba(255, 82, 97, 0.08);
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
}

.storyboard-failed-item__title {
  font-size: 0.9rem;
  color: var(--home-text, #e6edf3);
  font-weight: 600;
}

.storyboard-failed-item__desc {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #ff7a84;
}

/* 空状态样式见 assets/css/storyboard-step-shared.css */

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
  color: var(--home-cyan, #4ae7fd);
}

.storyboard-block-title {
  font-size: 12px;
  color: var(--home-muted, #8e97a5);
  margin-bottom: 0.45rem;
  font-weight: 600;
}

.storyboard-block-card {
  border: 1px dashed rgba(74, 231, 253, 0.28);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  gap:4px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--home-muted, #8e97a5);
  background: transparent;
  cursor: pointer;
}

.storyboard-list .storyboard-block-card {
  height: 200px;
}

.storyboard-block-card.has-image {
  padding: 0;
  border-style: solid;
  border-color: rgba(74, 231, 253, 0.12);
  cursor: default;
  position: relative;
  overflow: hidden;
}

.storyboard-block-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.35rem;
  flex-shrink: 0;
}

.storyboard-block-card.has-image .storyboard-block-card-header {
  position: relative;
  z-index: 3;
  min-height: 36px;
  padding: 8px 4px;
  margin-bottom: 0;
  gap: 0.75rem;
  background: transparent;
  border-bottom: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 8px 8px 0 0;
  box-sizing: border-box;
}

.storyboard-block-card-header .storyboard-block-image-title {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--home-text, #e6edf3);
}

.storyboard-block-delete-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.storyboard-block-image-wrap {
  cursor: pointer;
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: rgba(6, 10, 18, 0.55);
  text-align: center;
}

.storyboard-block-card.has-image .storyboard-block-image-wrap {
  border-radius: 0;
}

.storyboard-block-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.storyboard-block-thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

// .storyboard-image-footer {
//   position: absolute;
//   left: 0;
//   right: 0;
//   bottom: 0;
//   margin: auto;
//   display: flex;
//   align-items: center;
//   gap: 0.35rem;
//   height: 40px;
//   justify-content: center;
//   border-radius: 8px;
//   background: rgba(9, 13, 22, 0.66);
//   backdrop-filter: blur(2px);
// }

.storyboard-block-btn {
  font-size: 0.8rem;
  color: var(--home-text, #e6edf3);
  padding: 0 0.5rem;
}

.storyboard-block-image-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: center;
}

.storyboard-block-icon {
  font-size: 1.25rem;
}

.storyboard-block-text {
  font-size: 12px;
  color: #ffffff;
}

.storyboard-block-sub {
  font-size: 0.75rem;
  color: var(--home-muted, #8e97a5);
}

.storyboard-reference-card {
  border: 1px solid rgba(74, 231, 253, 0.12);
  border-radius: 8px;
  min-height: 200px;
  display: flex;
  font-size: 12px;
  align-items: center;
  justify-content: center;
  color: var(--home-muted, #8e97a5);
  background: transparent;
}

.storyboard-script-tip {
  height: 200px;
  padding: 0.2rem 0;
  color: var(--home-muted, #8e97a5);
  background: transparent;
  font-size: 0.85rem;
  line-height: 1.5;
  cursor: pointer;
  overflow: auto;
}

.storyboard-script-content {
  padding: 0.2rem 0;
  color: var(--home-text, #e6edf3);
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: pointer;
  height: 200px;
  overflow: auto;
}

.storyboard-script-content :deep(p) {
  margin: 0 0 0.5rem;
}

.storyboard-script-content :deep(p:last-child) {
  margin-bottom: 0;
}

.storyboard-script-content :deep(ul),
.storyboard-script-content :deep(ol) {
  margin: 0.2rem 0 0.6rem 1.2rem;
  padding: 0;
}

.storyboard-script-content :deep(li) {
  margin: 0.15rem 0;
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

/* 列表：行间/列内插入空白分镜 */
.storyboard-insert-gap {
  position: relative;
  min-height: 14px;
  margin: 0;
  flex-shrink: 0;
}

.storyboard-insert-fade-enter-active,
.storyboard-insert-fade-leave-active {
  transition: opacity 0.28s ease;
}

.storyboard-insert-fade-enter-from,
.storyboard-insert-fade-leave-to {
  opacity: 0;
}

.storyboard-insert-ui {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 4;
  pointer-events: auto;
}

.storyboard-insert-dash-line {
  flex: 1;
  min-width: 0;
  height: 0;
  border-top: 2px dashed rgba(0, 171, 216, 0.65);
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
  max-width: 200px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* 列表末行「+ 添加」条保留正常流布局 */
.storyboard-list > .storyboard-insert-gap:last-child {
  position: relative;
  bottom: auto;
  z-index: auto;
  padding-top: 0;
  background: transparent;
}

/* 分镜图批量生成：loading 块铺满外层卡片，避免双层边框与内边距 */
.storyboard-image-loading {
  border: none;
  padding: 0;
  background: transparent;
  cursor: default;
  overflow: hidden;
}

.create-step-storyboard-script .asset-visual-generating-block {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 180px;
  padding: 24px 16px;
  border: 1px solid rgba(74, 231, 253, 0.35);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, rgba(18, 22, 38, 0.96) 0%, rgba(25, 32, 52, 0.99) 100%);
  overflow: hidden;
  box-sizing: border-box;
}

.create-step-storyboard-script .storyboard-image-loading .asset-visual-generating-block {
  min-height: 100%;
  border-radius: 8px;
}

.create-step-storyboard-script .asset-visual-generating-block__shimmer {
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
  animation: storyboard-image-shimmer 1.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes storyboard-image-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.create-step-storyboard-script .asset-visual-generating-block__icon {
  position: relative;
  z-index: 1;
  font-size: 28px;
  color: #4ae7fd;
}

.create-step-storyboard-script .asset-visual-generating-block__text {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(230, 237, 243, 0.88);
  text-align: center;
}

.storyboard-script-insert-host {
  position: relative;
}

.storyboard-script-insert-edge {
  position: absolute;
  left: 0;
  right: 0;
  height: 14px;
  z-index: 2;
  cursor: pointer;
}

.storyboard-script-insert-edge--top {
  top: -2px;
}

.storyboard-script-insert-edge--bottom {
  bottom: -2px;
}
</style>
