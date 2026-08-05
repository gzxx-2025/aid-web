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
        <a-tooltip :title="batchVideoDisabledTooltip">
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
        {
          'storyboard-step-shell--has-list': panels.length > 0,
          'storyboard-step-shell--bootstrap-pending': showStoryboardVideoBootstrapMask
        }
      ]"
    >
      <div
        v-if="showStoryboardVideoBootstrapMask"
        class="storyboard-list-bootstrap-mask"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <LoadingOutlined spin class="storyboard-list-bootstrap-mask__icon" />
        <p class="storyboard-list-bootstrap-mask__text">正在同步分镜视频列表…</p>
      </div>
      <div v-if="showScriptSyncGeneratingView" class="storyboard-generating-view">
        <div class="storyboard-generating-center">
          <img :src="generatingCenterIcon" alt="" class="storyboard-generating-center-icon" />
          <div class="storyboard-generating-center-title">正在把剧本进行一格一格分镜拆解...</div>
          <div class="storyboard-generating-center-progress">
            提取中（{{ syncGenerationPercent }}%）
          </div>
        </div>
      </div>
      <div v-else-if="showStoryboardVideoEmptyState" class="storyboard-empty-content">
        <div class="storyboard-empty-inner">
          <div class="storyboard-empty-icon-wrap">
            <img :src="emptyFjIcon" alt="" />
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
                <span class="storyboard-card-title-text">{{
                  displayPanelTitle(panel, index)
                }}</span>
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
                  <a-menu-item @click="jumpToScriptWithImageModal(index)">
                    <InfoCircleOutlined />
                    分镜设计
                  </a-menu-item>
                  <a-menu-item
                    v-if="getPanelStoryboardVideo(panel)"
                    @click="jumpToDubbingWithModal(index)"
                  >
                    <InfoCircleOutlined />
                    音画同步
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
          <div class="storyboard-card-body">
            <div class="storyboard-block storyboard-block-video">
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
                v-else-if="panelVideoGenerateError(panel, index)"
                class="storyboard-block-card scene-card scene-card-failed storyboard-video-generate-failed"
              >
                <div class="scene-card-failed-content">
                  <div class="scene-card-failed-icon">
                    <img :src="iconEmptyFail" alt="" class="scene-card-failed-icon-image" />
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
                class="storyboard-block-card storyboard-video-set has-image"
              >
                <div class="storyboard-block-card-header">
                  <span class="storyboard-block-image-title">{{
                    getPanelStoryboardVideo(panel)?.title || '分镜视频'
                  }}</span>
                  <AssetCardCancelIcon
                    label="取消分镜视频"
                    @click="handleCancelStoryboardVideo(index)"
                  />
                </div>
                <div class="storyboard-video-preview-wrap">
                  <ShimmerVideo
                    :ref="(el) => setPanelVideoRef(el, index)"
                    :src="getPanelStoryboardVideo(panel)?.url || ''"
                    video-class="storyboard-video-preview"
                    object-fit="cover"
                    reveal-direction="fade"
                    lazy
                    preload="metadata"
                    @load="markPanelVideoMediaReady(index)"
                    @ended="onPanelVideoEnded(index)"
                    @pause="onPanelVideoPause(index)"
                  />
                  <button
                    v-if="
                      getPanelStoryboardVideo(panel)?.url &&
                      playingPanelIndex !== index &&
                      panelVideoMediaReady[index]
                    "
                    type="button"
                    class="dubbing-video-play-btn dubbing-video-play-btn--card"
                    title="播放视频"
                    aria-label="播放视频"
                    @click.stop="handlePlayPanelVideo(index)"
                  />
                  <div
                    v-if="getPanelStoryboardVideo(panel)?.url"
                    class="storyboard-video-top-actions"
                  >
                    <a-button
                      type="text"
                      size="small"
                      class="storyboard-video-action-btn"
                      @click.stop="handleFullscreenPanelVideo(index)"
                    >
                      <FullscreenOutlined />
                    </a-button>
                  </div>
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
          v-if="listInteractive && panels.length > 0"
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
                      <span class="storyboard-title-text">{{
                        displayPanelTitle(panel, index)
                      }}</span>
                    </template>
                  </div>
                  <div class="storyboard-list-actions">
                    <button
                      class="storyboard-action-link"
                      type="button"
                      @click="jumpToScriptWithImageModal(index)"
                    >
                      分镜设计
                    </button>
                    <button
                      v-if="getPanelStoryboardVideo(panel)"
                      class="storyboard-action-link"
                      type="button"
                      @click="jumpToDubbingWithModal(index)"
                    >
                      音画同步
                    </button>
                    <a-button size="small" @click="openEditVideoModal(index)"
                      >编辑分镜视频</a-button
                    >
                    <a-button size="small" @click="handleCopyPanel(index)"> 复制分镜 </a-button>
                    <a-button size="small" danger @click="removePanel(index)"> 删除分镜 </a-button>
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
                        v-else-if="panelVideoGenerateError(panel, index)"
                        class="storyboard-block-card scene-card scene-card-failed storyboard-video-generate-failed"
                      >
                        <div class="scene-card-failed-content">
                          <div class="scene-card-failed-icon">
                            <img :src="iconEmptyFail" alt="" class="scene-card-failed-icon-image" />
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
                        class="storyboard-block-card storyboard-video-set has-image"
                      >
                        <div class="storyboard-block-card-header">
                          <span class="storyboard-block-image-title">{{
                            getPanelStoryboardVideo(panel)?.title || '分镜视频'
                          }}</span>
                          <AssetCardCancelIcon
                            label="取消分镜视频"
                            @click="handleCancelStoryboardVideo(index)"
                          />
                        </div>
                        <div class="storyboard-video-preview-wrap">
                          <ShimmerVideo
                            :ref="(el) => setPanelVideoRef(el, index)"
                            :src="getPanelStoryboardVideo(panel)?.url || ''"
                            video-class="storyboard-video-preview"
                            object-fit="cover"
                            reveal-direction="fade"
                            lazy
                            preload="metadata"
                            @load="markPanelVideoMediaReady(index)"
                            @ended="onPanelVideoEnded(index)"
                            @pause="onPanelVideoPause(index)"
                          />
                          <button
                            v-if="
                              getPanelStoryboardVideo(panel)?.url &&
                              playingPanelIndex !== index &&
                              panelVideoMediaReady[index]
                            "
                            type="button"
                            class="dubbing-video-play-btn dubbing-video-play-btn--card"
                            title="播放视频"
                            aria-label="播放视频"
                            @click.stop="handlePlayPanelVideo(index)"
                          />
                          <div
                            v-if="getPanelStoryboardVideo(panel)?.url"
                            class="storyboard-video-top-actions"
                          >
                            <a-button
                              type="text"
                              size="small"
                              class="storyboard-video-action-btn"
                              @click.stop="handleFullscreenPanelVideo(index)"
                            >
                              <FullscreenOutlined />
                            </a-button>
                          </div>
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
      v-if="isVideoModalOpen && currentPanelIndex >= 0"
      :key="`storyboard-video-${panels[currentPanelIndex]?.id ?? currentPanelIndex}`"
      v-model:open="isVideoModalOpen"
      :scene-index="currentPanelIndex"
      :editor-scope-key="`storyboard-video-${panels[currentPanelIndex]?.id ?? currentPanelIndex}`"
      :scenes="videoScenes"
      @update="handleVideoUpdate"
      @jump-to-storyboard-script="handleJumpToStoryboardScript"
    />
    <BatchGenerateStoryboardModal
      v-if="batchGenerateVideoModalOpen"
      v-model:open="batchGenerateVideoModalOpen"
      mode="video"
      :title="batchVideoGenerateLabel"
      :panels="(storyboardScriptPanels || []) as StoryboardPanel[]"
      :video-panels="panels"
      @confirm="handleBatchGenerateVideoConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  inject,
  nextTick,
  onMounted,
  onBeforeUnmount,
  onUnmounted,
  ref,
  watch
} from 'vue'
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
import emptyFjIcon from '~/assets/img/icon/empty-fj.svg'
import { GENERATING_CENTER_ICON_URL as generatingCenterIcon } from '~/utils/generatingCenterIcon'
import ShimmerVideo from '~/components/common/ShimmerVideo.vue'
import AssetCardCancelIcon from '~/components/common/AssetCardCancelIcon.vue'
import {
  PlusOutlined,
  EditOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  VideoCameraOutlined,
  LoadingOutlined,
  StopOutlined,
  HolderOutlined,
  FullscreenOutlined
} from '@ant-design/icons-vue'
import type { StoryboardVideoPanel, StoryboardPanel, DubbingPanel } from '~/types'
import { moveItemBeforeIndex } from '~/utils/moveItemBeforeIndex'
import { useCreationStore } from '~/stores/creation'
import Draggable from 'vuedraggable'
import {
  STORYBOARD_WORKBENCH_NEED_PROJECT_MSG,
  useStoryboardWorkbenchMutations
} from '~/composables/useStoryboardWorkbenchMutations'
import {
  useStoryboardVideoBatchGenerate,
  isStoryboardVideoModalRestoreFollowing,
  applyStoryboardVideoPanelUiFromStore,
  activeStoryboardVideoModalOwnedFollowIds
} from '~/composables/useStoryboardVideoBatchGenerate'
import { shouldSilentStoryboardBatchToast } from '~/utils/taskSseSilentDisconnect'
import { suspendTaskSseFollow } from '~/composables/useTaskSseFollow'
import {
  waitForCreationStoreHydrated,
  applyCreationStoreScopeLiveGenFromRoute,
  findStoryboardVideoGenTaskInScopes,
  resolveStoryboardVideoGenEntriesByTaskId
} from '~/composables/useCreationStoreHydration'
import { useCreateFlowScopeChangedResume } from '~/composables/useCreateFlowLiveGenResume'
import { modalGenSessionScopeFromStore } from '~/utils/modalGenSessionScope'
import {
  clearStoryboardVideoModalUserDismissed,
  isStoryboardVideoModalUserDismissed,
  markStoryboardVideoModalUserDismissed,
  readStoryboardVideoModalGenSession
} from '~/utils/storyboardVideoModalGenSession'
import { createFlowShellKey } from '~/utils/createFlowInjection'
import {
  consumeCreateFlowStepModalIntent,
  createFlowStepModalIntent,
  peekCreateFlowStepModalIntent,
  requestCreateFlowStepModal
} from '~/utils/createFlowStepModalIntent'
import {
  ackCreateFlowTaskCommand,
  consumePendingCreateFlowTaskCommand,
  createFlowTaskCommandEvent
} from '~/utils/createFlowTaskCommand'
import {
  hasPersistedStoryboardScriptBatchGenWork,
  hasPersistedStoryboardVideoBatchGenWork
} from '~/utils/storyboardListBootstrap'
import {
  shouldDropImageBatchRestoreBecauseFollowing,
  shouldRestoreImageBatchSse
} from '~/utils/storyboardImageBatchRestoreGate'
import { createCoalescedAsyncRunner } from '~/utils/coalescedAsyncRunner'
import { openVideoPreviewModal } from '~/utils/openVideoPreviewModal'
import StoryboardToolbarOpsDropdown, {
  type StoryboardOpsMenuItem
} from './StoryboardToolbarOpsDropdown.vue'
import { createDefaultVideoPanel } from '~/composables/useCreateFlowStoryboardSync'
import { fetchOriginalVideoRecordsForStoryboard } from '~/utils/storyboardRecordBatch'
import {
  resolveStoryboardVideoRecordId,
  resolveStoryboardVideoRecordIdFromRows
} from '~/utils/storyboardFinalRecordId'
import {
  extractStoryboardTitleSuffix,
  formatStoryboardScriptTitle,
  formatStoryboardVideoTitle,
  resolveStoryboardListDisplayTitle
} from '~/utils/storyboardPanelTitle'
import { isProCreationMode, shouldPassStoryboardVideoDuration } from '~/utils/creationModeUiRules'
import AsyncModalLoading from '~/components/common/AsyncModalLoading.vue'
import {
  createPreloadableAsyncComponent,
  preloadComponentWhenIdle
} from '~/utils/preloadableAsyncComponent'

/** 重型弹窗按需加载，避免首次进入分镜视频页时拉取上百个模块 */
const editStoryboardVideoModalLoader = createPreloadableAsyncComponent(
  () => import('./EditStoryboardVideoModal.vue'),
  AsyncModalLoading
)
const EditStoryboardVideoModal = editStoryboardVideoModalLoader.component
let cancelEditStoryboardVideoModalPreload: (() => void) | null = null
const BatchGenerateStoryboardModal = defineAsyncComponent(
  () => import('./BatchGenerateStoryboardModal.vue')
)

interface Props {
  description: string
  modelValue: StoryboardVideoPanel[]
  /** 分镜脚本 panels，用于进入第五步时同步生成视频 panels */
  storyboardScriptPanels?: Array<{ id: string; title: string; [key: string]: any }>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: StoryboardVideoPanel[]): void
  (e: 'go-step' | 'jump-to-storyboard-script', panelIndex: number): void
}>()

const creationStore = useCreationStore()
const route = useRoute()
const wb = useStoryboardWorkbenchMutations()
const videoBatchGen = useStoryboardVideoBatchGenerate()
let pageDisposed = false
let pageMounted = false
const listInteractive = ref(true)
const createFlowShell = inject(createFlowShellKey, null)

const storyboardListLoading = computed(() => createFlowShell?.storyboardListLoading.value ?? false)
const storyboardListSyncReady = computed(
  () => createFlowShell?.storyboardListSyncReady.value ?? true
)

function hasOngoingStoryboardVideoGenWork(): boolean {
  if (!storyboardListSyncReady.value) {
    if (hasPersistedStoryboardScriptBatchGenWork(creationStore, route)) return true
    if (hasPersistedStoryboardVideoBatchGenWork(creationStore, route)) return true
    return false
  }
  if (creationStore.isGeneratingStoryboard) return true
  if (creationStore.isGeneratingStoryboardVideo) return true
  const promptTid = Number(creationStore.storyboardVideoBatchActivePromptTaskId)
  if (Number.isFinite(promptTid) && promptTid > 0) return true
  const videoTid = Number(creationStore.storyboardVideoBatchActiveVideoTaskId)
  return Number.isFinite(videoTid) && videoTid > 0
}

const showStoryboardVideoBootstrapMask = computed(
  () =>
    (storyboardListLoading.value || !storyboardListSyncReady.value) &&
    !hasOngoingStoryboardVideoGenWork()
)

function storyboardApiErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

const viewMode = ref<'list' | 'card'>('list')
const batchGenerateVideoModalOpen = ref(false)
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
// 3）专业版（pro）不出分镜图，有分镜脚本即可批量生成分镜视频，不校验分镜图/参考图。
const canAutoGenerateVideo = computed(() => {
  const scriptPanels = props.storyboardScriptPanels || []
  if (scriptPanels.length === 0) return false
  if (isProCreationMode(creationStore.formData.globalSetting?.creationMode)) {
    return true
  }
  const hasImageOrRef = (p: any) => {
    const hasImage = p.images && Array.isArray(p.images) && p.images.length > 0
    const hasRef =
      (p.referenceImage && (p.referenceImage.url || p.referenceImage.thumbnail)) ||
      (p.referenceImages && Array.isArray(p.referenceImages) && p.referenceImages.length > 0)
    return hasImage || hasRef
  }
  return scriptPanels.some(hasImageOrRef)
})

/** 批量生成分镜视频不可用时的提示（专业版不提示「需先有分镜图」） */
const batchVideoDisabledTooltip = computed(() => {
  if (canAutoGenerateVideo.value) {
    return panels.value.length === 0 ? '暂无分镜视频' : ''
  }
  if (isProCreationMode(creationStore.formData.globalSetting?.creationMode)) {
    return '暂无分镜视频'
  }
  return '需先有分镜图或参考图（至少一条）'
})

const isGeneratingVideo = computed(() => creationStore.isGeneratingStoryboardVideo)
const isSyncGeneratingStoryboard = computed(() => creationStore.isGeneratingStoryboard)
const showScriptSyncGeneratingView = computed(
  () =>
    (isSyncGeneratingStoryboard.value &&
      panels.value.length === 0 &&
      !creationStore.storyboardGenerationError) ||
    (!storyboardListSyncReady.value &&
      hasPersistedStoryboardScriptBatchGenWork(creationStore, route))
)
const showStoryboardVideoEmptyState = computed(
  () =>
    !showScriptSyncGeneratingView.value &&
    !showStoryboardVideoBootstrapMask.value &&
    panels.value.length === 0
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
  () => {
    const scriptPanels = props.storyboardScriptPanels || []
    const current = props.modelValue || []
    return {
      scriptLen: scriptPanels.length,
      scriptSig: scriptPanels.map((p) => p.id).join('\u0000'),
      videoLen: current.length
    }
  },
  ({ scriptLen, videoLen }) => {
    if (scriptLen <= 0 || videoLen > 0) return
    if (suppressEmptyResyncFromScript.value) return
    const scriptPanels = props.storyboardScriptPanels || []
    const next: StoryboardVideoPanel[] = scriptPanels.map((p, i) =>
      createDefaultVideoPanel(p as StoryboardPanel, i)
    )
    emit('update:modelValue', next)
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

/** 当前分镜已设置为分镜视频的那条；videos 空时回落 finalVideoUrl（批量生成后同步缺口） */
function getPanelStoryboardVideo(panel: StoryboardVideoPanel) {
  const list = Array.isArray(panel.videos) ? panel.videos : []
  const fromVideos = list.find((v: any) => v.isStoryboardVideo) || null
  if (fromVideos) return fromVideos
  const finalUrl = String(panel.finalVideoUrl ?? '').trim()
  if (!finalUrl) return null
  return {
    id: `final-video-fallback`,
    url: finalUrl,
    title: panel.title || '分镜视频',
    source: '生成记录',
    isStoryboardVideo: true
  }
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

function resolvePanelStoryboardId(index: number): number | null {
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  const sp = scriptPanels[index]
  if (sp) {
    const sid = wb.parseServerStoryboardId(sp.id)
    if (sid != null) return sid
  }
  const storePanels = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
  const storeSp = storePanels[index]
  return storeSp ? wb.parseServerStoryboardId(storeSp.id) : null
}

/** 卡片失败：仅以 store 持久化状态为准，避免 panel 本地脏数据污染；已设置主视频则不再展示失败 */
function panelVideoGenerateError(panel: StoryboardVideoPanel, index: number): string | undefined {
  const mainVideo = getPanelStoryboardVideo(panel)
  if (mainVideo && String(mainVideo.url ?? '').trim()) return undefined

  const sid = resolvePanelStoryboardId(index)
  if (sid == null) return undefined
  const key = String(sid)
  const batchTargets = creationStore.storyboardVideoBatchTargetStoryboardIds
  const isBatchActive =
    creationStore.isGeneratingStoryboardVideo ||
    creationStore.storyboardVideoBatchActivePromptTaskId != null ||
    creationStore.storyboardVideoBatchActiveVideoTaskId != null
  if (
    batchTargets.length > 0 &&
    isBatchActive &&
    !creationStore.isStoryboardVideoBatchTarget(sid)
  ) {
    return undefined
  }
  const storeErr = String(
    creationStore.storyboardPanelVideoGenErrorByStoryboardId[key] ?? ''
  ).trim()
  if (storeErr) return storeErr
  if (creationStore.storyboardPanelVideoGenStatusByStoryboardId[key] === 'failed') {
    return '视频生成失败'
  }
  return undefined
}

/** 卡片 loading：与分镜脚本 isPanelImageGenerating 一致，直接读 store */
function isPanelVideoGenerating(panel: StoryboardVideoPanel, index: number): boolean {
  const sid = resolvePanelStoryboardId(index)
  if (sid == null) return false

  const scopeKey = creationStore.step3GenVisualScopeKey()
  const modalTask =
    creationStore.step4PlusLiveGenByScope[scopeKey]?.storyboardVideoGenTasksByStoryboardId?.[
      String(sid)
    ]
  const isBatchActive =
    creationStore.isGeneratingStoryboardVideo ||
    creationStore.storyboardVideoBatchActivePromptTaskId != null ||
    creationStore.storyboardVideoBatchActiveVideoTaskId != null

  // 弹窗单条生视频：外层列表不展示 loading（与分镜图弹窗一致）
  if ((modalTask || isStoryboardVideoModalRestoreFollowing(sid)) && !isBatchActive) {
    return false
  }

  if (
    creationStore.storyboardVideoBatchTargetStoryboardIds.length > 0 &&
    isBatchActive &&
    !creationStore.isStoryboardVideoBatchTarget(sid)
  ) {
    return false
  }

  return creationStore.storyboardPanelVideoGenStatusByStoryboardId[String(sid)] === 'generating'
}

const batchVideoGenerateLabel = computed(() =>
  videoCompletedCount.value > 0 ? '批量生成分镜视频' : '批量生成分镜视频'
)

const videoToolbarOpsItems = computed((): StoryboardOpsMenuItem[] => [
  {
    key: 'batch-video',
    label: batchVideoGenerateLabel.value,
    icon: VideoCameraOutlined,

    disabled: !canAutoGenerateVideo.value || panels.value.length === 0 || isGeneratingVideo.value,
    disabledTooltip: batchVideoDisabledTooltip.value || undefined
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
  if (key === 'batch-video') {
    openBatchGenerateVideoModal()
    return
  }
  if (key === 'batch-delete') {
    handleBatchDeleteVideoPanels()
  }
}

function openBatchGenerateVideoModal() {
  if (!canAutoGenerateVideo.value || panels.value.length === 0) {
    message.warning(batchVideoDisabledTooltip.value || '暂无分镜视频')
    return
  }
  batchGenerateVideoModalOpen.value = true
}

async function handleBatchGenerateVideoConfirm(payload: {
  mode: 'image' | 'video'
  selectedStoryboardIds: number[]
  videoModel?: string
  resolution?: string
  durationSeconds?: number
  soundEffects?: 'none' | 'with-sound'
}) {
  if (payload.mode !== 'video') return
  const videoModel = String(payload.videoModel || '').trim()
  const resolution = String(payload.resolution || '')
    .trim()
    .toLowerCase()
  const passDuration = shouldPassStoryboardVideoDuration(
    creationStore.formData.globalSetting?.creationMode
  )
  const durationSeconds = Number(payload.durationSeconds)
  const soundEffects =
    payload.soundEffects === 'with-sound' || payload.soundEffects === 'none'
      ? payload.soundEffects
      : 'none'
  creationStore.setStoryboardVideoGenerateSettings({
    ...(videoModel ? { videoModel } : {}),
    ...(resolution ? { resolution } : {}),
    soundEffects,
    ...(passDuration && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? { durationSeconds }
      : { durationSeconds: null })
  })
  await startBatchVideoGenerate(payload.selectedStoryboardIds, !!videoModel)
}

async function startBatchVideoGenerate(
  selectedStoryboardIds?: number[],
  manualVideoModelPick = false
) {
  if (isGeneratingVideo.value || batchVideoSubmitting.value) return
  if (!canAutoGenerateVideo.value) {
    message.warning(batchVideoDisabledTooltip.value || '暂无分镜视频')
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
      selectedStoryboardIds,
      manualVideoModelPick,
      onPanelsUpdate: (next) => {
        if (pageDisposed) return
        emit('update:modelValue', next)
      }
    })
    if (pageDisposed) return
    if (result.ok) {
      message.success('分镜视频批量生成完成')
    } else if (result.message && !shouldSilentStoryboardBatchToast(result.message)) {
      if (result.message.includes('停止') || result.message.includes('取消')) {
        message.info(result.message)
      } else if (result.message.includes('部分')) {
        message.warning(result.message)
      } else {
        message.error(result.message)
      }
    }
  } catch (e: unknown) {
    if (pageDisposed) return
    const errMsg = storyboardApiErr(e)
    if (shouldSilentStoryboardBatchToast(errMsg)) return
    message.error(errMsg)
    creationStore.stopStoryboardVideoBatchGeneration()
  } finally {
    batchVideoSubmitting.value = false
    // 提交期间 store watcher 会主动让路给批量 owner；owner 结束后立即按终态 store
    // 重投影一次，避免最后一次 watcher 变更因 submitting gate 被跳过而遗留旧 loading。
    mergeStoryboardVideoPanelUiFromStore()
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
            await userStoryboardUnSetFinalVideo({
              projectId: ctx.projectId,
              episodeId: ctx.episodeId,
              storyboardId: sid,
              recordId
            })
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

async function regeneratePanel(index: number) {
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  const scriptPanel = scriptPanels[index]
  const videoPanel = panels.value[index]
  if (!scriptPanel || !videoPanel) return

  videoGenerationStopped.value = false
  const result = await videoBatchGen.regenerateSinglePanel({
    scriptPanel,
    videoPanel,
    panelIndex: index,
    videoPanels: panels.value,
    onPanelsUpdate: (next) => {
      if (pageDisposed) return
      emit('update:modelValue', next)
    }
  })

  if (pageDisposed) return
  if (result.ok) {
    message.success('重新生成成功')
  } else if (result.message && !shouldSilentStoryboardBatchToast(result.message)) {
    message.error(result.message)
  }
}

function openEditVideoModal(index: number) {
  void editStoryboardVideoModalLoader.preload()
  currentPanelIndex.value = index
  isVideoModalOpen.value = true
}

/** 跳转分镜设计并打开「编辑分镜图」 */
function jumpToScriptWithImageModal(index: number) {
  requestCreateFlowStepModal('storyboard-image', index)
  emit('go-step', 3)
}

/** 跳转音画同步并打开对应分镜配音弹窗（仅已设主视频时展示入口） */
function jumpToDubbingWithModal(index: number) {
  requestCreateFlowStepModal('storyboard-dubbing', index)
  emit('go-step', 5)
}

/** 消费跨步骤意图：打开编辑分镜视频（从分镜设计进入视频生成） */
function tryConsumeStepModalIntent() {
  if (pageDisposed) return
  const pending = peekCreateFlowStepModalIntent()
  if (!pending || pending.kind !== 'storyboard-video') return
  if (pending.panelIndex < 0 || pending.panelIndex >= panels.value.length) return
  const index = consumeCreateFlowStepModalIntent('storyboard-video')
  if (index == null) return
  viewMode.value = 'list'
  nextTick(() => {
    if (pageDisposed) return
    openEditVideoModal(index)
  })
}

watch(
  () => [panels.value.length, createFlowStepModalIntent.value?.token] as const,
  () => {
    tryConsumeStepModalIntent()
  },
  { immediate: true }
)

watch(isVideoModalOpen, (open, wasOpen) => {
  if (!wasOpen || open) return
  const sessionScope = modalGenSessionScopeFromStore(creationStore)
  const session = readStoryboardVideoModalGenSession(sessionScope)
  const sid =
    session?.storyboardId ??
    (currentPanelIndex.value >= 0 ? resolvePanelStoryboardId(currentPanelIndex.value) : null)
  if (sid != null && Number(sid) > 0) {
    const n = Number(sid)
    markStoryboardVideoModalUserDismissed(n, sessionScope)
    activeStoryboardVideoModalOwnedFollowIds.delete(n)
    const snap = findStoryboardVideoGenTaskInScopes(creationStore, n, route)
    const tid = Number(snap?.taskId)
    if (Number.isFinite(tid) && tid > 0) suspendTaskSseFollow(tid)
  }
  // 关窗后仅恢复列表自身的批量任务；弹窗 taskId 保留快照，重新打开弹窗时再续跟。
  void nextTick(() => {
    void restoreStoryboardVideoBatchIfNeeded()
  })
})

const playingPanelIndex = ref(-1)
const panelVideoRefs = new Map<number, HTMLVideoElement>()
const panelVideoComponentRefs = new Map<number, unknown>()
const panelVideoMediaReady = ref<Record<number, boolean>>({})

function resolveShimmerVideoEl(el: unknown): HTMLVideoElement | null {
  if (!el) return null
  if (el instanceof HTMLVideoElement) return el
  const ref = (el as { videoRef?: HTMLVideoElement | null | { value?: HTMLVideoElement | null } })
    .videoRef
  if (ref instanceof HTMLVideoElement) return ref
  if (ref && typeof ref === 'object' && 'value' in ref) return ref.value ?? null
  return null
}

function syncPanelVideoRef(panelIndex: number) {
  const video = resolveShimmerVideoEl(panelVideoComponentRefs.get(panelIndex))
  if (video) panelVideoRefs.set(panelIndex, video)
  else panelVideoRefs.delete(panelIndex)
}

function setPanelVideoRef(el: unknown, panelIndex: number) {
  if (el) panelVideoComponentRefs.set(panelIndex, el)
  else panelVideoComponentRefs.delete(panelIndex)
  syncPanelVideoRef(panelIndex)
}

function getPanelVideoEl(panelIndex: number): HTMLVideoElement | null {
  const cached = panelVideoRefs.get(panelIndex)
  if (cached) return cached
  syncPanelVideoRef(panelIndex)
  return panelVideoRefs.get(panelIndex) ?? null
}

function markPanelVideoMediaReady(panelIndex: number) {
  panelVideoMediaReady.value = { ...panelVideoMediaReady.value, [panelIndex]: true }
  syncPanelVideoRef(panelIndex)
}

function pauseAllPanelVideos(exceptIndex = -1) {
  panelVideoRefs.forEach((videoEl, i) => {
    if (i === exceptIndex) return
    videoEl.pause()
    videoEl.currentTime = 0
    videoEl.muted = true
  })
}

function handlePlayPanelVideo(panelIndex: number) {
  const panel = panels.value[panelIndex]
  const video = getPanelStoryboardVideo(panel)
  if (!video?.url) return

  pauseAllPanelVideos(panelIndex)

  const videoEl = getPanelVideoEl(panelIndex)
  if (!videoEl) return

  videoEl.muted = false
  playingPanelIndex.value = panelIndex
  void videoEl.play().catch(() => {
    playingPanelIndex.value = -1
    videoEl.muted = true
    message.warning('无法自动播放，请稍后重试')
  })
}

function onPanelVideoEnded(panelIndex: number) {
  if (playingPanelIndex.value !== panelIndex) return
  playingPanelIndex.value = -1
  const videoEl = panelVideoRefs.get(panelIndex)
  if (videoEl) {
    videoEl.muted = true
    videoEl.currentTime = 0
  }
}

function onPanelVideoPause(panelIndex: number) {
  const videoEl = panelVideoRefs.get(panelIndex)
  if (!videoEl || !videoEl.paused || playingPanelIndex.value !== panelIndex) return
  playingPanelIndex.value = -1
  videoEl.muted = true
}

async function handleFullscreenPanelVideo(panelIndex: number) {
  const videoEl = getPanelVideoEl(panelIndex)
  if (!videoEl) return
  try {
    if (videoEl.paused) {
      pauseAllPanelVideos(panelIndex)
      videoEl.muted = false
      playingPanelIndex.value = panelIndex
      await videoEl.play()
    }
    await videoEl.requestFullscreen()
  } catch {
    message.warning('全屏预览不可用')
  }
}

/** 分镜视频：预览（与图片预览同壳层，适配各分辨率） */
function handlePreviewStoryboardVideo(panelIndex: number) {
  const panel = panels.value[panelIndex]
  const video = getPanelStoryboardVideo(panel)
  if (video?.url) {
    openVideoPreviewModal({
      url: video.url,
      title: video.title || `分镜视频${panelIndex + 1}`
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

/** 分镜视频：取消设为分镜视频（与弹窗 unsetAsStoryboardVideo 一致） */
async function handleCancelStoryboardVideo(panelIndex: number) {
  const panel = panels.value[panelIndex]
  const finalVideo = getPanelStoryboardVideo(panel)
  if (!finalVideo) return

  const storyboardId = resolvePanelStoryboardId(panelIndex)
  if (storyboardId == null) {
    message.warning('分镜信息异常，请刷新后重试')
    return
  }

  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.error(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }

  let recordId = resolveStoryboardVideoRecordId(finalVideo)
  if (recordId == null) {
    const sp = (props.storyboardScriptPanels || [])[panelIndex] as StoryboardPanel | undefined
    const fromPanel = sp?.finalVideoId
    if (fromPanel != null && Number(fromPanel) > 0) recordId = Number(fromPanel)
  }
  if (recordId == null) {
    try {
      const rows = await fetchOriginalVideoRecordsForStoryboard(ctx, storyboardId)
      recordId = resolveStoryboardVideoRecordIdFromRows(finalVideo, rows)
    } catch {
      /* 回退解析失败时走下方统一提示 */
    }
  }
  if (recordId == null) {
    message.warning('分镜信息异常，请刷新后重试')
    return
  }

  try {
    await userStoryboardUnSetFinalVideo({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      storyboardId,
      recordId
    })
    const next = panels.value.map((p, i) => {
      if (i !== panelIndex) return p
      const videos = Array.isArray(p.videos)
        ? p.videos.filter((v) => !(v as { isStoryboardVideo?: boolean }).isStoryboardVideo)
        : []
      return { ...p, videos, generating: false, generateError: undefined }
    })
    emit('update:modelValue', next)
    message.success('已取消分镜视频')
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
  }
}

function isSameStoryboardVideoRecordList(a: any[] | undefined, b: any[] | undefined): boolean {
  const left = Array.isArray(a) ? a : []
  const right = Array.isArray(b) ? b : []
  if (left.length !== right.length) return false
  return left.every((item, index) => {
    const other = right[index]
    return (
      String(item?.id ?? item?.url ?? item?.thumbnail ?? '') ===
        String(other?.id ?? other?.url ?? other?.thumbnail ?? '') &&
      !!item?._generating === !!other?._generating &&
      !!item?._localGeneratingPlaceholder === !!other?._localGeneratingPlaceholder &&
      !!item?.isStoryboardVideo === !!other?.isStoryboardVideo
    )
  })
}

function clearPanelVideoGenFailureIfMainVideoSet(sceneIndex: number, videos: unknown) {
  if (!Array.isArray(videos)) return
  const hasMainVideo = videos.some(
    (v) =>
      !!(v as { isStoryboardVideo?: boolean; url?: string })?.isStoryboardVideo &&
      String((v as { url?: string })?.url ?? '').trim()
  )
  if (!hasMainVideo) return
  const sid = resolvePanelStoryboardId(sceneIndex)
  if (sid == null) return
  creationStore.clearStoryboardPanelVideoGenError(sid)
  creationStore.clearStoryboardPanelVideoGenStatus(sid)
}

function handleVideoUpdate(sceneIndex: number, data: any) {
  if (sceneIndex < 0 || sceneIndex >= panels.value.length) return
  if (Array.isArray(data?.videos)) {
    clearPanelVideoGenFailureIfMainVideoSet(sceneIndex, data.videos)
  }
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
  const prevPanel = panels.value[sceneIndex]
  const nextPanel = nextPanels[sceneIndex]
  const panelUnchanged =
    !!prevPanel &&
    !!nextPanel &&
    String(prevPanel.title ?? '') === String(nextPanel.title ?? '') &&
    isSameStoryboardVideoRecordList(prevPanel.videos, nextPanel.videos)
  if (!panelUnchanged) {
    emit('update:modelValue', nextPanels)
  }

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
  requestCreateFlowStepModal('storyboard-image', panelIndex)
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
    creationStore.addManualStoryboard(data.id)
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


onBeforeUnmount(() => {
  pageMounted = false
  pageDisposed = true
  storyboardVideoBatchRestoreRunner.dispose()
  listInteractive.value = false
  storyboardVideoRestoreGeneration += 1
  videoBatchGen.cancelResumeFollow()
})

onUnmounted(() => {
  cancelEditStoryboardVideoModalPreload?.()
  cancelEditStoryboardVideoModalPreload = null
  if (insertLeaveTimer) {
    clearTimeout(insertLeaveTimer)
    insertLeaveTimer = null
  }
  if (import.meta.client) {
    window.removeEventListener('create-flow-track-task', handleGlobalTrackTaskEvent)
    window.removeEventListener('create-flow-stop-task', handleGlobalStopTaskEvent)
    window.removeEventListener('create-flow-resume-task', handleGlobalResumeTaskEvent)

  }
})

let storyboardVideoRestoreGeneration = 0
/** 防止 panels ↔ store 双向同步在同一 tick 内互相触发 */
let panelVideoUiSyncDepth = 0
/** 防止 store hydrate ↔ applyImmediatePanelLoadingRestore watcher 同 tick 递归 */
let panelVideoStoreRestoreDepth = 0

function mergeStoryboardVideoPanelUiFromStore(): void {
  if (!pageMounted || pageDisposed || batchVideoSubmitting.value) return
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  const next = applyStoryboardVideoPanelUiFromStore(creationStore, scriptPanels, panels.value)
  if (
    next.some(
      (p, i) =>
        p.generating !== panels.value[i]?.generating ||
        p.generateError !== panels.value[i]?.generateError
    )
  ) {
    panelVideoUiSyncDepth += 1
    try {
      emit('update:modelValue', next)
    } finally {
      panelVideoUiSyncDepth -= 1
    }
  }
}

watch(
  () => ({
    statusSig: JSON.stringify(creationStore.storyboardPanelVideoGenStatusByStoryboardId),
    errorSig: JSON.stringify(creationStore.storyboardPanelVideoGenErrorByStoryboardId),
    batchTargets: JSON.stringify(creationStore.storyboardVideoBatchTargetStoryboardIds),
    batchVideo: creationStore.isGeneratingStoryboardVideo
  }),
  () => {
    if (!import.meta.client || batchVideoSubmitting.value || panelVideoUiSyncDepth > 0) return
    mergeStoryboardVideoPanelUiFromStore()
  }
)

let storyboardVideoBatchServerDiscoveryRequested = false
let storyboardVideoBatchFollowHandoffRequested = false

function hasServerStoryboardIdsForVideoRestore(): boolean {
  const scripts = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  return scripts.some((p) => wb.parseServerStoryboardId(p.id) != null)
}

async function runStoryboardVideoBatchRestoreOnce() {
  if (!import.meta.client || !pageMounted || pageDisposed || batchVideoSubmitting.value) return
  await waitForCreationStoreHydrated(creationStore, route)
  if (!pageMounted || pageDisposed) return
  const discoverServerTasks = storyboardVideoBatchServerDiscoveryRequested
  const waitForFollowHandoff = storyboardVideoBatchFollowHandoffRequested
  storyboardVideoBatchServerDiscoveryRequested = false
  storyboardVideoBatchFollowHandoffRequested = false

  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
  videoBatchGen.applyImmediatePanelLoadingRestore(scriptPanels, panels.value)
  mergeStoryboardVideoPanelUiFromStore()
  if (shouldDropImageBatchRestoreBecauseFollowing(videoBatchGen.isBatchFollowInFlight())) {
    if (!waitForFollowHandoff) return
    await videoBatchGen.waitForFollowIdle()
    if (!pageMounted || pageDisposed) return
    applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
    videoBatchGen.applyImmediatePanelLoadingRestore(scriptPanels, panels.value)
    mergeStoryboardVideoPanelUiFromStore()
  }

  const hasPersistedVideoWork =
    Boolean(creationStore.isGeneratingStoryboardVideo) ||
    Number(creationStore.storyboardVideoBatchActivePromptTaskId) > 0 ||
    Number(creationStore.storyboardVideoBatchActiveVideoTaskId) > 0 ||
    hasPersistedStoryboardVideoBatchGenWork(creationStore, route)
  const hasLocalRestoreIntent = shouldRestoreImageBatchSse({
    isGenerating: hasPersistedVideoWork,
    following: false,
    hasServerStoryboardIds: hasServerStoryboardIdsForVideoRestore(),
    hasActiveTaskId:
      Number(creationStore.storyboardVideoBatchActivePromptTaskId) > 0 ||
      Number(creationStore.storyboardVideoBatchActiveVideoTaskId) > 0
  })
  if (!hasLocalRestoreIntent && !discoverServerTasks) return

  if (!hasPersistedVideoWork) videoBatchGen.cancelResumeFollow()
  const gen = ++storyboardVideoRestoreGeneration
  await videoBatchGen.restoreOngoingBatchIfNeeded(
    scriptPanels,
    panels.value,
    (next) => {
      if (!pageMounted || pageDisposed || gen !== storyboardVideoRestoreGeneration) return
      // restore 入参可能是 list 同步前的空快照，禁止把已显示列表盖成空态
      if (!next.length && panels.value.length > 0) return
      emit('update:modelValue', next)
    },
    { discoverServerTasks }
  )
}

const storyboardVideoBatchRestoreRunner = createCoalescedAsyncRunner(
  runStoryboardVideoBatchRestoreOnce
)

function restoreStoryboardVideoBatchIfNeeded(options?: {
  discoverServerTasks?: boolean
  waitForFollowHandoff?: boolean
}) {
  if (!import.meta.client || !pageMounted || pageDisposed || batchVideoSubmitting.value) {
    return Promise.resolve()
  }
  if (options?.discoverServerTasks) storyboardVideoBatchServerDiscoveryRequested = true
  if (options?.waitForFollowHandoff) storyboardVideoBatchFollowHandoffRequested = true
  if (
    shouldDropImageBatchRestoreBecauseFollowing(videoBatchGen.isBatchFollowInFlight()) &&
    !storyboardVideoBatchFollowHandoffRequested
  ) {
    return Promise.resolve()
  }
  return storyboardVideoBatchRestoreRunner.request()
}

let videoModalAutoReopenAttempted = false

/** 刷新或切回原作品后尝试自动重开分镜视频编辑弹窗 */
function tryReopenStoryboardVideoModalAfterRefresh(fromScopeChange = false) {
  if (!import.meta.client || isVideoModalOpen.value) return
  if (!fromScopeChange && videoModalAutoReopenAttempted) return

  const sessionScope = modalGenSessionScopeFromStore(creationStore)
  const session = readStoryboardVideoModalGenSession(sessionScope)
  if (!session) return

  const { storyboardId, sceneIdx } = session
  if (isStoryboardVideoModalUserDismissed(storyboardId, sessionScope)) return
  if (sceneIdx < 0 || sceneIdx >= panels.value.length) return

  videoModalAutoReopenAttempted = true
  currentPanelIndex.value = sceneIdx
  isVideoModalOpen.value = true
}

watch(
  () => creationStore.isHydrated,
  (hydrated) => {
    if (!hydrated || !import.meta.client || !pageMounted || pageDisposed) return
    const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
    panelVideoStoreRestoreDepth += 1
    try {
      applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
      videoBatchGen.applyImmediatePanelLoadingRestore(scriptPanels, panels.value)
      mergeStoryboardVideoPanelUiFromStore()
      tryReopenStoryboardVideoModalAfterRefresh()
    } finally {
      panelVideoStoreRestoreDepth -= 1
    }
  },
  { immediate: true }
)

/** 与分镜脚本分镜图一致：hydrate 后立即恢复 store loading，不等待 restore 异步 */
watch(
  () => ({
    hydrated: creationStore.isHydrated,
    panelLen: panels.value.length,
    scriptLen: (props.storyboardScriptPanels || []).length,
    statusSig: JSON.stringify(creationStore.storyboardPanelVideoGenStatusByStoryboardId),
    errorSig: JSON.stringify(creationStore.storyboardPanelVideoGenErrorByStoryboardId),
    batchVideo: creationStore.isGeneratingStoryboardVideo,
    promptTid: creationStore.storyboardVideoBatchActivePromptTaskId,
    videoTid: creationStore.storyboardVideoBatchActiveVideoTaskId
  }),
  () => {
    if (
      !creationStore.isHydrated ||
      !import.meta.client ||
      !pageMounted ||
      pageDisposed ||
      batchVideoSubmitting.value
    ) {
      return
    }
    if (panelVideoStoreRestoreDepth > 0 || panelVideoUiSyncDepth > 0) return
    const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
    panelVideoStoreRestoreDepth += 1
    try {
      videoBatchGen.applyImmediatePanelLoadingRestore(scriptPanels, panels.value, {
        skipScopeHydrate: true
      })
    } finally {
      panelVideoStoreRestoreDepth -= 1
    }
  },
  { immediate: true }
)

watch(
  () => storyboardListSyncReady.value,
  (ready) => {
    if (!ready || !import.meta.client || !pageMounted || pageDisposed || !creationStore.isHydrated) {
      return
    }
    const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
    videoBatchGen.applyImmediatePanelLoadingRestore(scriptPanels, panels.value)
    mergeStoryboardVideoPanelUiFromStore()
    // 列表同步后必须完整 restore：跨集清空 panels 时首轮可能早退，仅刷 loading 不够
    void restoreStoryboardVideoBatchIfNeeded({ discoverServerTasks: true })
  }
)

watch(
  () =>
    [
      creationStore.currentProjectId,
      creationStore.currentEpisodeId,
      route.query.projectId,
      route.query.episodeId
    ] as const,
  (scope, previousScope) => {
    if (!previousScope || scope.every((value, index) => value === previousScope[index])) return
    void videoBatchGen.cancelResumeFollow()
    void restoreStoryboardVideoBatchIfNeeded({
      discoverServerTasks: true,
      waitForFollowHandoff: true
    })
  },
  { flush: 'sync' }
)

watch(
  () =>
    [
      creationStore.isHydrated,
      creationStore.currentProjectId,
      creationStore.currentEpisodeId,
      creationStore.storyboardVideoBatchActivePromptTaskId,
      creationStore.storyboardVideoBatchActiveVideoTaskId,
      (props.storyboardScriptPanels || []).length,
      panels.value.length,
      route.query.projectId,
      route.query.episodeId
    ] as const,
  () => {
    void restoreStoryboardVideoBatchIfNeeded()
  },
  { immediate: true }
)

useCreateFlowScopeChangedResume(() => {
  tryReopenStoryboardVideoModalAfterRefresh(true)
  return restoreStoryboardVideoBatchIfNeeded({ discoverServerTasks: true })
})

function handleGlobalTrackTaskEvent(event: Event) {
  const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
  const ty = String(detail?.taskType ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  if (ty !== 'storyboard_video_prompt_batch' && ty !== 'storyboard_video_generate') return
  const taskId = Number(detail?.taskId)
  if (ty === 'storyboard_video_generate' && Number.isFinite(taskId) && taskId > 0) {
    const modalEntries = resolveStoryboardVideoGenEntriesByTaskId(creationStore, taskId, route)
    const modalEntry = modalEntries[0]
    if (modalEntry) {
      ackCreateFlowTaskCommand('track', taskId)
      const indexByStoryboard = panels.value.findIndex(
        (_, index) => resolvePanelStoryboardId(index) === modalEntry.storyboardId
      )
      const sceneIdx =
        indexByStoryboard >= 0
          ? indexByStoryboard
          : modalEntry.sceneIdx >= 0 && modalEntry.sceneIdx < panels.value.length
            ? modalEntry.sceneIdx
            : -1
      if (sceneIdx >= 0) {
        clearStoryboardVideoModalUserDismissed(modalGenSessionScopeFromStore(creationStore))
        openEditVideoModal(sceneIdx)
      }
      return
    }
  }
  ackCreateFlowTaskCommand('track', Number(detail?.taskId))
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  videoBatchGen.onGlobalTrackTask(
    event,
    scriptPanels,
    panels.value,
    (next) => {
      if (pageDisposed) return
      emit('update:modelValue', next)
    },
    (result) => {
      if (pageDisposed) return
      if (result.ok) {
        message.success('分镜视频批量生成完成')
      } else if (result.message && !shouldSilentStoryboardBatchToast(result.message)) {
        message.error(result.message)
      }
    }
  )
}

function handleGlobalStopTaskEvent(event: Event) {
  void videoBatchGen.onGlobalStopTask(event)
}

/**
 * 全局任务面板先跳步骤再派发指令；本页挂载晚于派发时事件已错过，
 * 挂载完成后补投属于本页的 pending 指令（分镜视频提示词/出片批量任务）。
 */
function deliverPendingCreateFlowTaskCommands() {
  const acceptsOwnTask = (d: { taskType: string | null }) => {
    const ty = String(d.taskType ?? '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_')
    return ty === 'storyboard_video_prompt_batch' || ty === 'storyboard_video_generate'
  }
  const resume = consumePendingCreateFlowTaskCommand('resume', acceptsOwnTask)
  if (resume) {
    handleGlobalResumeTaskEvent(createFlowTaskCommandEvent('resume', resume))
  }
  const track = consumePendingCreateFlowTaskCommand('track', acceptsOwnTask)
  if (track) {
    handleGlobalTrackTaskEvent(createFlowTaskCommandEvent('track', track))
  }
}

function handleGlobalResumeTaskEvent(event: Event) {
  const detail = (event as CustomEvent<{ taskId?: number; taskType?: string | null }>).detail
  const ty = String(detail?.taskType ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  if (ty !== 'storyboard_video_prompt_batch' && ty !== 'storyboard_video_generate') return
  ackCreateFlowTaskCommand('resume', Number(detail?.taskId))
  const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
  videoBatchGen.onGlobalResumeTask(
    event,
    scriptPanels,
    panels.value,
    (next) => {
      if (pageDisposed) return
      emit('update:modelValue', next)
    },
    (result) => {
      if (pageDisposed) return
      if (result.ok) {
        message.success('分镜视频续生完成')
      } else if (result.message && !shouldSilentStoryboardBatchToast(result.message)) {
        if (result.message.includes('部分') || result.message.includes('续生')) {
          message.warning(result.message)
        } else {
          message.error(result.message)
        }
      }
    }
  )
}

onMounted(() => {
  pageMounted = true
  cancelEditStoryboardVideoModalPreload = preloadComponentWhenIdle(
    editStoryboardVideoModalLoader.preload
  )
  if (panels.value.length === 0 && creationStore.storyboardGenerationError) {
    creationStore.clearStoryboardScriptGenerationOutcome()
  }
  if (import.meta.client) {
    window.addEventListener('create-flow-track-task', handleGlobalTrackTaskEvent)
    window.addEventListener('create-flow-stop-task', handleGlobalStopTaskEvent)
    window.addEventListener('create-flow-resume-task', handleGlobalResumeTaskEvent)

    deliverPendingCreateFlowTaskCommands()
  }
  if (creationStore.isHydrated) {
    const scriptPanels = (props.storyboardScriptPanels || []) as StoryboardPanel[]
    applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
    videoBatchGen.applyImmediatePanelLoadingRestore(scriptPanels, panels.value)
    mergeStoryboardVideoPanelUiFromStore()
    tryReopenStoryboardVideoModalAfterRefresh()
  }
  void restoreStoryboardVideoBatchIfNeeded({ discoverServerTasks: true })
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
    creationStore.addManualStoryboard(data.id)
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
    const scriptTitle = formatStoryboardScriptTitle(vIdx, extractStoryboardTitleSuffix(nextTitle))
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
    creationStore.addManualStoryboard(data.id)
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
    content: '将同时删除该分镜的视频内容及对应的分镜脚本、音画同步结果。',
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
        creationStore.removeManualStoryboard(Number(sp.id))
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
  height: var(--storyboard-list-media-height, 200px);
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

.storyboard-list-body .storyboard-video-preview-wrap {
  aspect-ratio: auto;
}

.storyboard-video-preview-wrap .shimmer-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.storyboard-video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.storyboard-video-top-actions {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  z-index: 4;
  display: flex;
  gap: 0.25rem;
}

.storyboard-video-action-btn {
  color: rgba(255, 255, 255, 0.9) !important;
  background: rgba(0, 0, 0, 0.4) !important;
}

.storyboard-video-action-btn:hover {
  color: white !important;
  background: rgba(0, 0, 0, 0.6) !important;
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
  height: var(--storyboard-list-media-height, 200px);
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
