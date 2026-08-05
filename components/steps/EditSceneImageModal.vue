<template>
  <a-modal
    v-model:open="modalOpen"
    :width="'100vw'"
    :style="{ top: 0, paddingBottom: 0, maxWidth: '100vw' }"
    :footer="null"
    :closable="false"
    :maskClosable="false"
    wrap-class-name="create-flow-modal edit-scene-image-modal"
    class="edit-scene-image-modal"
    @cancel="handleCancel"
  >
    <div class="edit-scene-image-container">
      <!-- 头部：返回按钮和场景切换 -->
      <div class="modal-header">
        <a-button type="text" class="back-btn" @click="handleCancel">
          <template #icon><ArrowLeftOutlined /></template>
          <span>返回</span>
        </a-button>
        <HorizontalScrollTabBar
          ref="sceneTabBarRef"
          root-class="scene-switcher"
          track-class="scene-switcher-track"
        >
          <div
            v-for="(scene, index) in scenes"
            :key="index"
            :class="[
              'scene-image-tab',
              {
                active: isSelectingSceneImage ? selectedSceneImageIndex === index : currentSceneIndex === index,
                'selecting-mode': isSelectingSceneImage,
                'scene-image-tab--generating': isSceneModalImageGenerating(index)
              }
            ]"
            @click="isSelectingSceneImage ? selectSceneImageFromTab(index) : switchScene(index)"
          >
            <div class="scene-image-thumbnail">
              <ShimmerImage
                v-if="getFirstSceneImage(index)?.url"
                :src="getFirstSceneImage(index)!.url"
                img-class="thumbnail-image"
                object-fit="cover"
                reveal-direction="fade"
              />
              <div v-else class="thumbnail-placeholder">
                <PictureOutlined />
              </div>
              <div
                v-if="isSceneModalImageGenerating(index)"
                class="scene-tab-generating-mask"
                role="status"
                aria-live="polite"
              >
                <LoadingOutlined spin class="scene-tab-generating-mask__icon" />
              </div>
            </div>
            <span class="scene-label">{{ scene.name }}</span>
          </div>
        </HorizontalScrollTabBar>
      </div>

      <div class="main-content-wrapper">
        <div class="right-panel">
          <div v-if="rightPanelLoading" class="panel-skeleton right-panel-skeleton">
            <div class="skeleton-stage-layout">
              <aside class="skeleton-history-panel">
                <div class="skeleton-panel-title"></div>
                <div class="skeleton-history-list">
                  <div v-for="n in 6" :key="`sk-h-${n}`" class="skeleton-history-item"></div>
                </div>
                <div class="skeleton-history-actions">
                  <div class="skeleton-btn"></div>
                  <div class="skeleton-btn"></div>
                </div>
              </aside>

              <section class="skeleton-canvas-panel">
                <div class="skeleton-canvas-toolbar">
                  <div v-for="n in 5" :key="`sk-t-${n}`" class="skeleton-chip"></div>
                </div>
                <div class="skeleton-canvas-main"></div>
              </section>

              <aside class="skeleton-config-panel">
                <div class="skeleton-config-tabs">
                  <div class="skeleton-tab"></div>
                  <div class="skeleton-tab"></div>
                </div>
                <div class="skeleton-file-row"></div>
                <div class="skeleton-textarea"></div>
                <div class="skeleton-select-row">
                  <div class="skeleton-select"></div>
                  <div class="skeleton-select"></div>
                  <div class="skeleton-select"></div>
                  <div class="skeleton-select"></div>
                </div>
                <div class="skeleton-primary-btn"></div>
              </aside>
            </div>
          </div>
          <div v-else class="figma-stage-layout">
            <aside class="stage-history-panel">
              <h4 class="panel-title">生成记录</h4>
              <div class="history-list">
                <HistoryRecordWrap
                  v-for="(img, index) in currentSceneImages"
                  :key="`history-${index}`"
                  :show-set-main="canSetMainFromHistory(index)"
                  :set-main-label="addImageButtonLabel"
                  :set-main-loading="isAddingSceneImage"
                  @set-main="handleSetMainFromHistory(index)"
                >
                  <button
                    type="button"
                    :class="[
                      'history-item',
                      {
                        active: currentImageIndex === index,
                        'history-item--main': isHistoryItemMain(index),
                        'history-item--generating': isHistoryItemGenerating(index)
                      }
                    ]"
                    @click="switchImage(index)"
                  >
                    <ShimmerImage
                      v-if="img.url"
                      :src="img.url"
                      :alt="`历史图${index + 1}`"
                      img-class="history-item__image"
                      object-fit="cover"
                      reveal-direction="fade"
                    />
                    <div v-else-if="!isHistoryItemGenerating(index)" class="history-empty">空</div>
                    <div
                      v-if="isHistoryItemGenerating(index)"
                      class="history-generating-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="history-generating-mask__icon" />
                    </div>
                    <span v-if="isHistoryItemMain(index)" class="history-main-mark" aria-hidden="true">
                      <img :src="dialogSelectSelIcon" alt="" class="history-main-mark__icon" />
                    </span>
                    <div
                      v-if="canDeleteHistoryImage(img)"
                      class="history-delete-icon"
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="handleDeleteImage(index)"
                      @keydown.enter.stop.prevent="handleDeleteImage(index)"
                    >
                      <img :src="deleteIcon" alt="删除" />
                    </div>
                  </button>
                </HistoryRecordWrap>
              </div>
              <div class="history-actions">
                <a-button block @click="handleUploadLocalImage">
                  <template #icon><UploadOutlined /></template>
                  <EllipsisTooltip title="选择本地文件" />
                </a-button>
                <a-button block @click="handleOpenAssetLibrary">
                  <template #icon><FolderOutlined /></template>
                  <EllipsisTooltip title="资产库导入" />
                </a-button>
              </div>
            </aside>

            <section class="stage-canvas-panel">
              <div class="canvas-content-stack">
                <div class="canvas-toolbar">
                  <a-button
                    v-if="showTouchEditToolbar"
                    type="text"
                    size="small"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'drawing' }"
                    @mouseenter="canvasToolbarHoverKey = 'drawing'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleModifyImage(currentImageIndex)"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('drawing')" alt="" />
                    </template>
                    点选改图
                  </a-button>
                  <a-tooltip
                    v-if="showToolbarSettingCard && !whiteBaseImageReadyForSettingCard"
                    title="请先在列表中点击自动生成按钮生成图片以后再进行操作"
                  >
                    <span class="canvas-toolbar-tooltip-wrap">
                      <a-button
                        type="text"
                        size="small"
                        disabled
                        :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'chat' }"
                        @mouseenter="canvasToolbarHoverKey = 'chat'"
                        @mouseleave="canvasToolbarHoverKey = null"
                      >
                        <template #icon>
                          <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('chat')" alt="" />
                        </template>
                        生成设定图
                      </a-button>
                    </span>
                  </a-tooltip>
                  <SettingCardImagePopover
                    v-else-if="showToolbarSettingCard"
                    :image-index="currentImageIndex"
                    :is-supported="isSettingCardTypeSupported"
                    :is-white-base-ready="whiteBaseImageReadyForSettingCard"
                    :generating="showSettingCardToolbarLoading"
                    @select="handleSettingCardSelect"
                  >
                    <a-button
                      type="text"
                      size="small"
                      :loading="showSettingCardToolbarLoading"
                      :disabled="showSettingCardToolbarLoading"
                      :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'chat' }"
                      @mouseenter="canvasToolbarHoverKey = 'chat'"
                      @mouseleave="canvasToolbarHoverKey = null"
                    >
                      <template #icon>
                        <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('chat')" alt="" />
                      </template>
                      生成设定图
                    </a-button>
                  </SettingCardImagePopover>
                  <a-button
                    v-else-if="isSceneEditMode"
                    type="text"
                    size="small"
                    :loading="showSceneSplitToolbarLoading"
                    :disabled="showSceneSplitToolbarLoading"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'fourGrid' }"
                    @mouseenter="canvasToolbarHoverKey = 'fourGrid'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleSceneSplitFourGrid(currentImageIndex)"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('fourGrid')" alt="" />
                    </template>
                    拆分四宫格
                  </a-button>
                  <a-button
                    v-else
                    type="text"
                    size="small"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'chat' }"
                    @mouseenter="canvasToolbarHoverKey = 'chat'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleDialogueImage(currentImageIndex)"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('chat')" alt="" />
                    </template>
                    对话作图
                  </a-button>
                  <UpscaleModelPopover
                    :image-index="currentImageIndex"
                    resolution-format="lower"
                    :generating="showUpscaleToolbarLoading"
                    :prefetched-models="upscaleModelPool"
                    @select="handleUpscaleModelSelect"
                  >
                    <a-button
                      type="text"
                      size="small"
                      :loading="showUpscaleToolbarLoading"
                      :disabled="showUpscaleToolbarLoading"
                      :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'hd' }"
                      @mouseenter="canvasToolbarHoverKey = 'hd'"
                      @mouseleave="canvasToolbarHoverKey = null"
                    >
                      <template #icon>
                        <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('hd')" alt="" />
                      </template>
                      变清晰
                    </a-button>
                  </UpscaleModelPopover>
                  <a-button
                    type="text"
                    size="small"
                    :loading="showMultiViewToolbarLoading"
                    :disabled="showMultiViewToolbarLoading"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'camera' }"
                    @mouseenter="canvasToolbarHoverKey = 'camera'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleMultiAngle(currentImageIndex)"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('camera')" alt="" />
                    </template>
                    多机位
                  </a-button>
                  <a-button
                    v-if="currentImg?._pending"
                    type="text"
                    size="small"
                    :loading="isAddingSceneImage"
                    :disabled="isAddingSceneImage"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'add' }"
                    @mouseenter="canvasToolbarHoverKey = 'add'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleAddSceneImage()"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('add')" alt="" />
                    </template>
                    {{ addImageButtonLabel }}
                  </a-button>
                  <a-button
                    v-else-if="currentImg && isCurrentImageCancelAddVisible"
                    type="text"
                    size="small"
                    :loading="isCancellingAdd"
                    :disabled="Boolean(cancelAddDisabledTooltip) || isCancellingAdd"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'add' }"
                    @mouseenter="canvasToolbarHoverKey = 'add'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleCancelAddImage(currentImageIndex)"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('add')" alt="" />
                    </template>
                    <a-tooltip v-if="cancelAddDisabledTooltip" :title="cancelAddDisabledTooltip">
                      <span>取消添加</span>
                    </a-tooltip>
                    <template v-else>
                      取消添加
                    </template>
                  </a-button>
                  <a-button
                    v-else
                    type="text"
                    size="small"
                    :loading="isAddingSceneImage"
                    :disabled="isAddingSceneImage"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'add' }"
                    @mouseenter="canvasToolbarHoverKey = 'add'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleAddSceneImage()"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('add')" alt="" />
                    </template>
                    {{ addImageButtonLabel }}
                  </a-button>
                </div>
                <!-- 与 EditStoryboardImageModal 中间卡片头部一致：展示当前图标题（与外层列表同源） -->
                <div v-if="currentImg" class="scene-canvas-meta">
                  <div class="scene-canvas-meta-left">
                    <a-input
                      v-if="editingImageTitleIndex === currentImageIndex"
                      v-model:value="editingImageTitle"
                      size="small"
                      class="scene-meta-title-input"
                      @blur="handleImageTitleBlur(currentImageIndex)"
                      @press-enter="handleImageTitleBlur(currentImageIndex)"
                    />
                    <span
                      v-else
                      class="scene-canvas-meta-title"
                      @click="startEditImageTitle(currentImageIndex)"
                    >
                      {{ currentImageDisplayTitle }}
                    </span>
                  </div>
                </div>
                <div :class="['canvas-preview', { 'is-selected': currentImageIndex >= 0 }]">
                  <div class="canvas-image-frame canvas-image-frame--enhance-wrap">
                    <div
                      v-if="showSceneSplitOverlay"
                      class="canvas-upscale-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="canvas-upscale-mask__icon" />
                      <p class="canvas-upscale-mask__text">{{ sceneSplitProgressText }}</p>
                    </div>
                    <div
                      v-else-if="showCanvasTaskRunningOverlay"
                      class="canvas-upscale-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="canvas-upscale-mask__icon" />
                      <p class="canvas-upscale-mask__text">{{ upscaleProgressText }}</p>
                    </div>
                    <div
                      v-else-if="showUpscaleFailedOverlay"
                      class="canvas-upscale-mask canvas-upscale-mask--failed"
                      role="alert"
                    >
                      <p class="canvas-upscale-mask__err">{{ upscaleFailedMessage }}</p>
                      <a-button size="small" type="primary" ghost @click="clearUpscaleOverlay">
                        知道了
                      </a-button>
                    </div>
                    <ShimmerImage
                      v-if="currentImg?.url"
                      :src="currentImg.url"
                      img-class="canvas-image"
                      object-fit="contain"
                      reveal-direction="fade"
                      wrapper-class="canvas-shimmer-image"
                      @click="handlePreviewCanvasImage"
                    />
                    <div v-else-if="showCurrentGeneratingPlaceholder" class="canvas-empty canvas-generating">
                      <LoadingOutlined spin class="canvas-upscale-mask__icon" />
                      <p class="canvas-generating__text">{{ sceneGenerateOverlayText }}</p>
                    </div>
                    <div v-else class="canvas-empty">还没有内容,先去左侧创建一个吧</div>
                  </div>
                </div>
              </div>
            </section>

            <aside class="stage-config-panel">
              <div class="config-tabs">
                <button :class="['config-tab', { active: leftActiveTab === 'generate' }]" @click="leftActiveTab = 'generate'">{{ generateTabLabel }}</button>
                <button :class="['config-tab', { active: leftActiveTab === 'dialogue' }]" @click="leftActiveTab = 'dialogue'">对话作图</button>
              </div>
              <div class="scene-config-below-tabs">
                <div class="scene-config-scroll create-modal-config-scroll">
                  <div class="config-body create-modal-config-body">
                    <div v-if="leftActiveTab === 'generate'" class="create-modal-tab-panel">
                      <div class="create-modal-tab-chrome">
                        <PromptScriptFileHeader
                          icon-type="scene"
                          theme="scene-modal"
                          :file-name="currentScene.name"
                          :show-reference-button="false"
                          :show-generate-prompt-button="false"
                          :setting-click-blocked-tooltip="manualSettingEditBlockedTooltip || undefined"
                          @click-file="handleOpenSceneSetting"
                        />
                        <GenerateSourceImagesStrip
                          :images="generateSourceImages"
                          :show-adder="generateSourceImages.length < 4"
                          :show-adder-text="!generateSourceImages.length"
                          adder-text="导入参考图"
                          @remove="generateSourceImages.splice($event, 1)"
                          @open-adder="showGenerateImportModal = true"
                        />
                      </div>
                      <div class="create-modal-prompt-shell">
                        <RichTextEditor
                          v-model="promptText"
                          :max-length="3000"
                          placeholder="描述希望对参考图做的编辑，如：改成风衣造型、保留城市夜景背景"
                          class="prompt-input"
                        />
                      </div>
                      <GenerateModelConfigBlock
                        v-model:aspect-ratio="activeAspectRatio"
                        v-model:count="activeCount"
                        v-model:quality="activeQuality"
                        :aspect-ratio-options="leftActiveTab === 'generate' ? editAspectRatioSelectOptions : dialogueAspectRatioSelectOptions"
                        :count-options="leftActiveTab === 'generate' ? editCountSelectOptions : dialogueCountSelectOptions"
                        :quality-options="leftActiveTab === 'generate' ? editQualitySelectOptions : dialogueQualitySelectOptions"
                        select-class="setting-select"
                        density="scene"
                        :show-quality-3k="true"
                        :show-action="false"
                      >
                        <template #model>
                          <ModelSelectDropdown
                            :value="selectedModel"
                            :options="modelOptions"
                            :expanded="modelDropdownExpanded"
                            @toggle="modelDropdownExpanded = !modelDropdownExpanded"
                            @close="modelDropdownExpanded = false"
                            @select="handleSelectModel($event)"
                          />
                        </template>
                      </GenerateModelConfigBlock>
                    </div>
                    <DialogueDrawPanel
                      v-else
                      source-type="asset"
                      :max-source-count="4"
                      :source-images="dialogueSourceImages"
                      :instruction-html="dialogueInstructionHtml"
                      :model-value="selectedDialogueModel"
                      :model-options="dialogueModelOptions"
                      :model-expanded="dialogueModelDropdownExpanded"
                      :aspect-ratio="dialogueSettings.aspectRatio"
                      :count="dialogueSettings.count"
                      :quality="dialogueSettings.quality"
                      :aspect-ratio-options="dialogueAspectRatioSelectOptions"
                      :count-options="dialogueCountSelectOptions"
                      :quality-options="dialogueQualitySelectOptions"
                      @open-source-picker="showDialogueImportModal = true"
                      @remove-source-image="removeDialogueSourceImage"
                      @update:instruction-html="dialogueInstructionHtml = $event"
                      @update:model-expanded="dialogueModelDropdownExpanded = $event"
                      @select-model="handleSelectDialogueModel"
                      @update:aspect-ratio="dialogueSettings.aspectRatio = $event"
                      @update:count="dialogueSettings.count = $event"
                      @update:quality="dialogueSettings.quality = $event"
                    />
                  </div>
                </div>
                <div class="scene-config-footer">
                  <a-button
                    type="primary"
                    block
                    size="large"
                    class="generate-btn"
                    :loading="showGenerateFooterButtonLoading"
                    :disabled="showGenerateFooterButtonLoading"
                    @click="leftActiveTab === 'generate' ? handleStartGenerate() : handleStartDialogueGenerate()"
                  >
                    <template #icon>
                      <img src="@/assets/img/icon/star_white.svg" alt="">
                    </template>
                    开始生图
                  </a-button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>

    <!-- 场景设定编辑弹窗 -->
    <SceneSettingModal
      v-model:open="showSceneSettingModal"
      :scene-name="currentScene.name"
      :initial-content="sceneSettingContent"
      @sync-title="handleSettingModalSyncSceneTitle"
      @save="handleSaveSceneSetting"
      @save-and-update="handleSaveAndUpdateSceneSetting"
    />

    <!-- 导入参考图弹窗 -->
    <ImportReferenceImageModal
      v-model:open="showImportReferenceModal"
      @import="handleReferenceImageImport"
    />

    <!-- 资源库导入弹窗 -->
    <ImportScriptModal
      v-model:open="showAssetLibraryModal"
      title="导入图片"
      accept-asset-type="image"
      @import="handleAssetLibraryImport"
    />
    <SelectSceneImageModal
      v-model:open="showDialogueImportModal"
      :scenes="scenesForImportModal"
      :editing-scene-index="currentSceneIndex"
      multiple
      title="选择参考画面"
      @select-multiple="handleDialogueImportMultiple"
    />
    <SelectSceneImageModal
      v-model:open="showGenerateImportModal"
      :scenes="scenesForImportModal"
      :editing-scene-index="currentSceneIndex"
      multiple
      title="导入参考图"
      @select-multiple="handleGenerateImportMultiple"
    />
    <MultiAngleCameraModal
      v-model:open="showMultiAngleModal"
      :image-url="multiAngleImageUrl"
      :model-value="multiViewSelectedModel"
      :model-options="multiViewModelOptions"
      :model-expanded="multiViewModelDropdownExpanded"
      @update:model-expanded="multiViewModelDropdownExpanded = $event"
      @select-model="handleSelectMultiViewModel"
      @generate="handleMultiAngleGenerate"
    />
    <TouchEditModal
      v-if="showTouchEditToolbar"
      v-model:open="showTouchEditModal"
      :image-url="touchEditImageUrl"
    />

  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, defineAsyncComponent } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { openImagePreviewModal } from '~/utils/openImagePreviewModal'
import {
  ArrowLeftOutlined,
  UploadOutlined,
  FolderOutlined,
  PictureOutlined,
  LoadingOutlined,
} from '@ant-design/icons-vue'
import HorizontalScrollTabBar from '~/components/common/HorizontalScrollTabBar.vue'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import HistoryRecordWrap from '~/components/common/HistoryRecordWrap.vue'
import EllipsisTooltip from '~/components/common/EllipsisTooltip.vue'
import SceneSettingModal from './SceneSettingModal.vue'
import ImportReferenceImageModal from './ImportReferenceImageModal.vue'
import ImportScriptModal from './ImportScriptModal.vue'
import DialogueDrawPanel from './DialogueDrawPanel.vue'
import GenerateSourceImagesStrip from './GenerateSourceImagesStrip.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'
import { useCreationStore } from '~/stores/creation'
import {
  applyStep3GenVisualFromRoute,
  findSceneModalSseTaskInScopes,
  waitForCreationStoreHydrated
} from '~/composables/useCreationStoreHydration'
import { useCreateFlowScopeChangedResume } from '~/composables/useCreateFlowLiveGenResume'
import {
  modalGenSessionScopeFromScopeKey,
  modalGenSessionScopeFromStore
} from '~/utils/modalGenSessionScope'
import {
  buildModalFollowLockKey,
  clearModalFollowLocksNotMatchingLiveGenScope,
  shouldApplyModalTaskProgressToCanvas
} from '~/utils/liveGenScopeIsolation'
import {
  nextModalSseRestoreDelayMs,
  resolveDeferredModalFollowHandling,
  tryAcquireModalFollowLock
} from '~/utils/modalSseFollowReconnectPolicy'
import {
  listModalTabFollowsToSuspend,
  shouldAllowModalTabSseConnect
} from '~/utils/modalTabSseMutex'
import {
  drainStep3SseQueue,
  hasStep3SseSlot,
  releaseStep3SseSlot,
  requeueStep3SseItemToEnd,
  tryAcquireStep3SseSlot
} from '~/utils/step3SseConcurrencyGate'
import { shouldRelinquishModalFollowOnDeferred } from '~/utils/sceneModalOuterFollowHandoff'
import {
  formatTaskSseJoinedLiveText,
  formatTaskSseLiveText
} from '~/utils/taskSseProgressText'
import {
  clearSceneImageModalGenSession,
  clearSceneImageModalUserDismissed,
  isSceneImageModalUserDismissed,
  persistSceneImageModalGenSession,
  readSceneImageModalGenSession
} from '~/utils/sceneImageModalGenSession'
import PromptScriptFileHeader from './PromptScriptFileHeader.vue'
import GenerateModelConfigBlock from './GenerateModelConfigBlock.vue'
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import { isHtmlContentEmpty, htmlToPlainText } from '~/utils/htmlPlain'
import type { MultiAngleGeneratePayload } from '~/utils/multiAngleCameraPrompt'
import UpscaleModelPopover from './UpscaleModelPopover.vue'
import SettingCardImagePopover from './SettingCardImagePopover.vue'
import { buildModalEditorScopeKey } from '~/composables/useModalTaskScope'
import {
  followFormImageUpscaleTask,
  runFormImageUpscaleTask
} from '~/composables/useFormImageUpscaleTask'
import {
  followFormImageGenerateCardTask,
  parseFormCardImageTaskResult,
  recoverFormImageGenerateCardResultFromDetail,
  runFormImageGenerateCardTask
} from '~/composables/useFormImageGenerateCardTask'
import {
  followMultiViewImageTask,
  runMultiViewImageTask
} from '~/composables/useMultiViewImageTask'
import { followEditImageTask, runEditImageTask, formatCreationImageProgressText } from '~/composables/useEditImageTask'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import { useModelGenerateSettings } from '~/composables/useModelGenerateSettings'
import { isTaskOngoingStatus } from '~/composables/useTaskOngoing'
import { suspendTaskSseFollow, waitUserTaskSseTerminal } from '~/composables/useTaskSseFollow'
import { getStep3FormImageTaskMeta } from '~/utils/step3FormImageTaskRegistry'
import {
  claimFormImagesFromTaskComplete,
  isFormCardImageTaskType,
  parseImageIdsFromTaskInputSnapshot,
  setFormImageInUse,
  unsetFormImageInUse
} from '~/utils/formImageAutoUse'
import type { SceneModalSseTaskKind, SceneModalSseTaskSnapshot } from '~/stores/creation'
import {
  userAssetRpsFormImageCreate,
  userAssetRpsFormImageDelete,
  userAssetRpsFormImageList,
  userAssetRpsFormImageUpdate,
  userAssetRpsFormImageSceneSplit,
  userTaskDetail,
  userTaskDetailCached,
  userModelListByFuncCodes,
} from '~/utils/businessApi'
import { fetchFlowUserTaskListOnce } from '~/utils/userTaskListFlowOnce'
import { useModelList } from '~/composables/useModelList'
import { mapUserModelListItemToModelOption } from '~/utils/userModelOption'
import { AI_MODEL_FUNC_CODE } from '~/utils/aiModelFuncCodes'
import {
  fetchAgentDefaultModelCodes,
  getAgentDefaultModelCacheKey,
  FORM_IMAGE_AGENT_BIZ_CATEGORY,
  resolvePreferredModelId,
  resolveSelectedModelOption,
  IMAGE_MULTI_VIEW_AGENT_BIZ_CATEGORY,
  IMAGE_MULTI_VIEW_AGENT_CODE
} from '~/utils/extractAgentBiz'
import { modelsFromListByFuncGroups, uniqueTrimmedCodes } from '~/utils/modelListByFuncBatch'
import { buildAidAgentListScopeParams } from '~/utils/createFlowProjectContext'
import type { AssetExtractType, UserModelListItem, UserTaskRow } from '~/types/business-api'
import drawingNorIcon from '@/assets/img/icon/drawing-nor.svg'
import drawingSelIcon from '@/assets/img/icon/drawing-sel.svg'
import chatNorIcon from '@/assets/img/icon/chat-nor.svg'
import chatSelIcon from '@/assets/img/icon/chat-sel.svg'
import hdNorIcon from '@/assets/img/icon/hd-nor.svg'
import hdSelIcon from '@/assets/img/icon/hd-sel.svg'
import cameraNorIcon from '@/assets/img/icon/camera-nor.svg'
import cameraSelIcon from '@/assets/img/icon/camera-sel.svg'
import addIcon from '@/assets/img/icon/add.svg'
import addSelIcon from '@/assets/img/icon/add-sel.svg'
import fourlNorIcon from '@/assets/img/icon/fourl-nor.svg'
import fourlSelIcon from '@/assets/img/icon/fourl-sel.svg'
import deleteIcon from '@/assets/img/icon/del-black.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'

/** 子弹窗异步拆分：不阻塞编辑弹窗本体首帧渲染 */
const SelectSceneImageModal = defineAsyncComponent(() => import('./SelectSceneImageModal.vue'))
const TouchEditModal = defineAsyncComponent(() => import('./TouchEditModal.vue'))
const MultiAngleCameraModal = defineAsyncComponent(() => import('./MultiAngleCameraModal.vue'))

interface Props {
  open: boolean
  sceneIndex: number
  initialImageIndex?: number | null
  scenes: Array<{ name: string; images?: any[]; setting?: string }>
  imageType?: 'scene' | 'character' | 'prop' | 'form' // scene 为添加场景图，其余为添加形态图
  /** 个人资产主表 id，有则在本弹窗内同步形态图（上传/资产库/AI 生成） */
  rpsAssetId?: number | null
  /** 与当前资产形态顺序对应的 formId 列表（来自服务端） */
  rpsFormIds?: number[]
  /**
   * 形态编辑弹窗：tab 切换到第 N 项时，用于初始化的主表资产 id。
   * - 仅在 imageType = scene/character/prop 时需要
   * - imageType = form 时 tab 对应的是 formId，本字段会被忽略
   */
  rpsAssetIdsByIndex?: Record<number, number | null>
  /**
   * 形态编辑弹窗：tab 切换到第 N 项时，用于初始化的 formId 列表。
   * - 仅在 imageType = scene/character/prop 时需要
   * - imageType = form 时 tab 对应的是 formId，本字段会被忽略
   */
  rpsFormIdsByIndex?: Record<number, number[]>
  /**
   * `imageType === 'form'`（编辑形态 Tab）时：形态所属主资产类型。
   * 角色形态弹窗需与 `imageType=character` 一致展示「生成设定图」；道具形态仍为「对话作图」。
   */
  formParentAssetType?: 'character' | 'prop' | null
  /** 非空时：右侧 PromptScriptFileHeader（名称行）不可点开设定编辑，悬停展示说明 */
  manualSettingEditBlockedTooltip?: string | null
  /** 弹窗实例作用域（如角色形态 `0-1`），用于隔离不同列表项的生图 loading 与回写 */
  editorScopeKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  imageType: 'scene',
  rpsAssetId: null,
  rpsFormIds: () => [],
  formParentAssetType: null,
  manualSettingEditBlockedTooltip: null,
  editorScopeKey: ''
})

type CanvasToolbarKey = 'drawing' | 'chat' | 'hd' | 'camera' | 'add' | 'fourGrid'
const canvasToolbarHoverKey = ref<CanvasToolbarKey | null>(null)
const canvasToolbarIconMap: Record<CanvasToolbarKey, { nor: string; sel: string }> = {
  drawing: { nor: drawingNorIcon, sel: drawingSelIcon },
  chat: { nor: chatNorIcon, sel: chatSelIcon },
  hd: { nor: hdNorIcon, sel: hdSelIcon },
  camera: { nor: cameraNorIcon, sel: cameraSelIcon },
  add: { nor: addIcon, sel: addSelIcon },
  fourGrid: { nor: fourlNorIcon, sel: fourlSelIcon }
}
const getCanvasToolbarIcon = (key: CanvasToolbarKey) =>
  (canvasToolbarHoverKey.value === key ? canvasToolbarIconMap[key].sel : canvasToolbarIconMap[key].nor)

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update': [sceneIndex: number, data: any, editorScopeKey?: string]
}>()

const route = useRoute()
const creationStore = useCreationStore()

function sceneModalSessionScope() {
  return modalGenSessionScopeFromStore(creationStore)
}

function claimFormImagesForModal(taskType: unknown, completeData: unknown) {
  const pid = Number(creationStore.currentProjectId)
  return claimFormImagesFromTaskComplete(taskType, completeData, {
    projectId: Number.isFinite(pid) && pid > 0 ? pid : undefined
  })
}

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// 场景图为「添加场景图」，角色/道具/形态编辑均为「添加形态图」
const addImageButtonLabel = computed(() =>
  props.imageType === 'scene' ? '添加场景图' : '添加形态图'
)

/** 与外层列表一致：场景图用「场景图N」，形态/角色/道具用「形态图N」 */
function getImageTitleFallback(index: number): string {
  const n = index + 1
  return props.imageType === 'scene' ? `场景图${n}` : `形态图${n}`
}

/** 仅编辑场景主资产图（非角色/道具/形态） */
const isSceneEditMode = computed(() => props.imageType === 'scene')

function resolveRpsImageIdFromLocalImage(img: { rpsImageId?: number; id?: string } | null | undefined): number | null {
  const direct = Number(img?.rpsImageId)
  if (Number.isFinite(direct) && direct > 0) return direct
  const idStr = String(img?.id || '')
  const m = idStr.match(/^img-(\d+)$/)
  if (m?.[1]) {
    const parsed = Number(m[1])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

/** 右侧 Tab：编辑图片（genMode=edit） */
const generateTabLabel = computed(() => '编辑图片')

const currentSceneIndex = ref(props.sceneIndex)

function rpsAssetIdForSceneIndex(sceneIdx: number): number | null {
  if (props.imageType === 'form') return props.rpsAssetId ?? null
  const map = props.rpsAssetIdsByIndex
  if (map) {
    const v = map[sceneIdx]
    return v != null && Number.isFinite(Number(v)) ? Number(v) : null
  }
  return props.rpsAssetId ?? null
}

const activeRpsAssetId = computed<number | null>(() =>
  rpsAssetIdForSceneIndex(currentSceneIndex.value)
)

function rpsFormIdsForSceneIndex(sceneIdx: number): number[] {
  if (props.imageType === 'form') return props.rpsFormIds ?? []
  const map = props.rpsFormIdsByIndex
  if (map) {
    const arr = map[sceneIdx]
    return Array.isArray(arr) ? arr : []
  }
  return props.rpsFormIds ?? []
}

const activeRpsFormIds = computed<number[]>(() =>
  rpsFormIdsForSceneIndex(currentSceneIndex.value)
)

function resolveFormIdForSceneIndex(sceneIdx: number): number | null {
  const formIds = rpsFormIdsForSceneIndex(sceneIdx) ?? []
  const fid = Number(formIds[sceneIdx] ?? formIds[0] ?? NaN)
  return Number.isFinite(fid) && fid > 0 ? fid : null
}

/** 画布 loading 遮罩唯一键：含资产/形态/弹窗实例，避免列表 A/B 同为 `0-0` 时串流 */
function buildCanvasOverlayKey(sceneIdx: number, imgIdx: number): string {
  const scope = buildEditorScopeKeyForSceneIndex(sceneIdx)
  const assetId = rpsAssetIdForSceneIndex(sceneIdx) ?? ''
  const formId = resolveFormIdForSceneIndex(sceneIdx) ?? ''
  return `${scope}|${props.imageType}|${assetId}|${formId}|${sceneIdx}|${imgIdx}`
}

function emitSceneUpdate(sceneIndex: number, data: any, scopeKey?: string) {
  emit(
    'update',
    sceneIndex,
    data,
    scopeKey ?? buildEditorScopeKeyForSceneIndex(sceneIndex)
  )
}

function buildEditorScopeKeyForSceneIndex(sceneIdx: number): string {
  return buildModalEditorScopeKey(props.editorScopeKey, sceneIdx)
}

function captureModalScopeSnapshot(sceneIdx = currentSceneIndex.value) {
  return {
    editorScopeKey: buildEditorScopeKeyForSceneIndex(sceneIdx),
    assetId: activeRpsAssetId.value
  }
}

function isSameModalScope(snapshot: ReturnType<typeof captureModalScopeSnapshot>) {
  return (
    snapshot.editorScopeKey === buildEditorScopeKeyForSceneIndex(currentSceneIndex.value) &&
    snapshot.assetId === activeRpsAssetId.value
  )
}

function cloneScenesForTask() {
  return props.scenes.map((s) => ({
    ...s,
    images: [...(s.images || [])]
  }))
}

// 切换场景/角色/道具 Tab 时，左右两侧分别展示骨架屏
const leftPanelLoading = ref(false)
const rightPanelLoading = ref(false)
const TAB_SWITCH_SKELETON_MS = 380
const leftActiveTab = ref<'generate' | 'dialogue'>('generate')
const viewMode = ref<'list' | 'card'>('list')
const currentImageIndex = ref(props.initialImageIndex !== null && props.initialImageIndex !== undefined ? props.initialImageIndex : 0)
const editingImageTitleIndex = ref<number | null>(null)
const editingImageTitle = ref('')

function mapSourceLabelToRpsType(source?: string): 'upload' | 'official' | 'ai' {
  if (!source) return 'upload'
  if (/自动|对话|生成|\bAI\b|ai/i.test(source)) return 'ai'
  if (/本地|本地上传/i.test(source)) return 'upload'
  return 'official'
}

function resolveRpsSourceType(img: any): 'upload' | 'official' | 'ai' {
  const t = img?._rpsSourceType
  if (t === 'upload' || t === 'official' || t === 'ai') return t
  return mapSourceLabelToRpsType(img?.source)
}

/** 设置当前从表形态为使用中（列表与 Tab 展示主图） */
async function reserveSetRpsForm(payload: {
  imageId?: number
  formId?: number
  imageType: 'scene' | 'character' | 'prop' | 'form'
}): Promise<boolean> {
  let imageId = payload.imageId
  if ((imageId == null || !Number.isFinite(Number(imageId))) && payload.formId != null && Number.isFinite(Number(payload.formId))) {
    try {
      const list = await userAssetRpsFormImageList({ formId: Number(payload.formId) })
      const preferred =
        (Array.isArray(list) ? list : []).find((x: any) => Number(x?.isUse) === 1 && Number.isFinite(Number(x?.id))) ??
        (Array.isArray(list) ? list : []).find((x: any) => Number.isFinite(Number(x?.id))) ??
        null
      imageId = preferred ? Number(preferred.id) : undefined
    } catch {
      imageId = undefined
    }
  }
  if (imageId == null || !Number.isFinite(Number(imageId))) return true
  const ok = await setFormImageInUse(Number(imageId), {
    projectId: Number(creationStore.currentProjectId) || undefined
  })
  if (!ok) {
    message.error('设置主图失败')
    return false
  }
  return true
}

/** 取消从表形态使用（列表与 Tab 不再展示该主图） */
async function resolveInUseImageIdByFormId(formId?: number): Promise<number | null> {
  if (formId == null || !Number.isFinite(Number(formId))) return null
  try {
    const list = await userAssetRpsFormImageList({ formId: Number(formId), isUse: null })
    const first = Array.isArray(list) ? list[0] : null
    const id = Number(first?.id)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

async function reserveUnsetRpsForm(payload: { imageId?: number; formId?: number }): Promise<boolean> {
  let targetImageId =
    payload.imageId != null && Number.isFinite(Number(payload.imageId)) ? Number(payload.imageId) : null
  if (targetImageId == null) {
    targetImageId = await resolveInUseImageIdByFormId(payload.formId)
  }
  if (targetImageId == null) return true
  const pid = Number(creationStore.currentProjectId)
  const result = await unsetFormImageInUse(Number(targetImageId), {
    projectId: Number.isFinite(pid) && pid > 0 ? pid : undefined
  })
  if (!result.ok) {
    message.error(result.reason || '取消主图失败')
    return false
  }
  return true
}

/**
 * 通过 form-image/list 解析当前选中图对应的形态图实例 ID（imgId）。
 * 匹配优先级：rpsImageId > imageUrl > name > 首条可用记录。
 */
async function resolveImageIdFromFormImageList(payload: {
  formId?: number
  imageId?: number
  imageUrl?: string
  imageTitle?: string
}): Promise<number | null> {
  const formId =
    payload.formId != null && Number.isFinite(Number(payload.formId)) ? Number(payload.formId) : null
  if (formId == null) {
    return payload.imageId != null && Number.isFinite(Number(payload.imageId)) ? Number(payload.imageId) : null
  }

  try {
    const list = await userAssetRpsFormImageList({ formId })
    if (!Array.isArray(list) || list.length === 0) return null

    const normalizedInputId =
      payload.imageId != null && Number.isFinite(Number(payload.imageId)) ? Number(payload.imageId) : null
    if (normalizedInputId != null) {
      const hitById = list.find((x: any) => Number.isFinite(Number(x?.id)) && Number(x.id) === normalizedInputId)
      if (hitById?.id != null && Number.isFinite(Number(hitById.id))) return Number(hitById.id)
    }

    const normalizedUrl = String(payload.imageUrl || '').trim()
    if (normalizedUrl) {
      const hitByUrl = list.find((x: any) => String(x?.imageUrl || '').trim() === normalizedUrl)
      if (hitByUrl?.id != null && Number.isFinite(Number(hitByUrl.id))) return Number(hitByUrl.id)
    }

    const normalizedTitle = String(payload.imageTitle || '').trim()
    if (normalizedTitle) {
      const hitByName = list.find((x: any) => String(x?.name || '').trim() === normalizedTitle)
      if (hitByName?.id != null && Number.isFinite(Number(hitByName.id))) return Number(hitByName.id)
    }

    const fallback = list.find((x: any) => x?.id != null && Number.isFinite(Number(x.id)))
    return fallback?.id != null && Number.isFinite(Number(fallback.id)) ? Number(fallback.id) : null
  } catch {
    return null
  }
}

/** 只把“已设置”的图片同步给父组件（决定外部列表和顶部 tab 展示） */
function buildVisibleImagesForParent() {
  return localSceneImages.value
    .filter((img) => !img._pending && img?._isSet === true)
    .map((img) => {
      const { _pending, _rpsSourceType, _isSet, ...rest } = img
      return rest
    })
}

/** 编辑弹窗内：优先走 form-image 层（create/update）同步 */
async function syncImageToRpsApi(
  imageUrl: string,
  imageTitle: string,
  sourceType: 'upload' | 'official' | 'ai',
  currentImage?: any
): Promise<{ formId?: number; imageId?: number } | null> {
  const assetId = activeRpsAssetId.value
  if (assetId == null || !imageUrl?.trim()) return null

  const formIds = activeRpsFormIds.value ?? []
  let existingFormId: number | undefined
  // 新增待添加图片时，currentImageIndex 可能已切到末尾导致 formIds 越界；
  // 如果 currentImage 自身已经带 rpsFormId，则直接使用它。
  const maybeCurrentFormId = Number(currentImage?.rpsFormId)

  if (props.imageType === 'form') {
    // 形态图编辑弹窗：无论当前正在编辑该形态下第几张图片
    // 创建形态图都应使用“当前形态（sceneIndex）”对应的 formId。
    const id = formIds[currentSceneIndex.value]
    existingFormId = id != null && Number.isFinite(Number(id)) ? Number(id) : undefined
  } else {
    const id = formIds[currentImageIndex.value]
    existingFormId = id != null && Number.isFinite(Number(id)) ? Number(id) : undefined
  }

  let resolvedFormId = Number.isFinite(maybeCurrentFormId) ? maybeCurrentFormId : existingFormId
  if (resolvedFormId == null) {
    message.warning(`缺少形态ID，无法创建形态图（imageType=${props.imageType}, sceneIndex=${currentSceneIndex.value}, currentImageIndex=${currentImageIndex.value}）`)
    return null
  }

  const maybeImageId = Number(currentImage?.rpsImageId)
  try {
    if (Number.isFinite(maybeImageId)) {
      const updated = await userAssetRpsFormImageUpdate({
        imageId: maybeImageId,
        imageUrl,
        name: imageTitle
      })
      return { formId: resolvedFormId, imageId: Number(updated?.id ?? maybeImageId) }
    }
    const created = await userAssetRpsFormImageCreate({
      formId: resolvedFormId,
      imageUrl,
      name: imageTitle,
      sourceType: sourceType === 'ai' ? 'ai_auto' : sourceType,
      asInUse: false
    })
    return { formId: resolvedFormId, imageId: Number(created?.id) }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '同步个人资产形态失败')
    return null
  }
}

function emitSceneTabUpdate(images: any[], tabIndex?: number) {
  const ci = tabIndex ?? currentSceneIndex.value
  const prev = props.scenes[ci] || { name: '', images: [] }
  emit('update', ci, {
    ...prev,
    images
  })
}

const promptText = ref('')
const referenceImages = ref<Array<{ url?: string }>>([
  { url: undefined },
  { url: undefined },
  { url: undefined },
  { url: undefined }
])

const generationSettings = ref({
  model: '',
  aspectRatio: '16:9',
  count: 1,
  quality: '2k'
})

/** 右侧「对话作图」Tab 的模型与出图参数（须在 selectedDialogueModel / useModelGenerateSettings 之前声明） */
const dialogueSettings = ref({
  model: '',
  aspectRatio: '16:9',
  count: 1,
  quality: '2k'
})

// 模型选择相关
const modelDropdownExpanded = ref(false)
const dialogueModelDropdownExpanded = ref(false)

// 模型选项列表
const fallbackModelOptions: ModelOption[] = [

]

const mapSceneModalModelItem = (item: Parameters<typeof mapUserModelListItemToModelOption>[0]): ModelOption =>
  mapUserModelListItemToModelOption(item, { iconBg: '#10B981' })

const { modelList: modelOptions, rawModelList } =
  useModelList<ModelOption>({
    funcCode: AI_MODEL_FUNC_CODE.SCENE_IMAGE,
    modelType: 'image',
    fallback: fallbackModelOptions,
    mapItem: mapSceneModalModelItem,
    onError: (e) => {
      const err = e as { msg?: string; message?: string }
      message.warning(err?.msg || err?.message || '加载生图模型失败，已使用默认模型')
    }
  })

const {
  modelList: dialogueModelOptions,
  rawModelList: dialogueRawModelList
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.IMAGE_EDIT,
  modelType: 'image',
  fallback: fallbackModelOptions,
  mapItem: mapSceneModalModelItem,
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载对话作图模型失败，已使用默认模型')
  }
})

/** 主场景/角色/道具生图：main_scene_image / main_character_image / main_prop_image */
function applySceneModalImageModelPool(
  groups: Awaited<ReturnType<typeof userModelListByFuncCodes>>,
  assetType: AssetExtractType
) {
  const imageFuncCode = FORM_IMAGE_AGENT_BIZ_CATEGORY[assetType]
  const list = modelsFromListByFuncGroups(groups, imageFuncCode)
  if (list.length > 0) {
    rawModelList.value = list
    modelOptions.value = list.map(mapSceneModalModelItem)
    return true
  }
  return false
}

/** 对话作图：image_edit */
function applySceneModalDialogueModelPool(
  groups: Awaited<ReturnType<typeof userModelListByFuncCodes>>
) {
  const list = modelsFromListByFuncGroups(groups, AI_MODEL_FUNC_CODE.IMAGE_EDIT)
  if (list.length > 0) {
    dialogueRawModelList.value = list
    dialogueModelOptions.value = list.map(mapSceneModalModelItem)
    return true
  }
  return false
}

function applySceneModalMultiViewModelPool(
  groups: Awaited<ReturnType<typeof userModelListByFuncCodes>>
) {
  const list = modelsFromListByFuncGroups(groups, AI_MODEL_FUNC_CODE.IMAGE_MULTI_VIEW)
  if (list.length > 0) {
    multiViewModelOptions.value = list.map((item) =>
      mapUserModelListItemToModelOption(item, { iconBg: '#60A5FA' })
    )
    return true
  }
  return false
}

async function initImageModelOptions() {
  const assetType = resolveSceneModalAssetType()
  const agentCode = String(creationStore.extractAgents[assetType]?.id || '').trim()
  const formImageBiz = FORM_IMAGE_AGENT_BIZ_CATEGORY[assetType]
  const funcCodes = uniqueTrimmedCodes([
    formImageBiz,
    AI_MODEL_FUNC_CODE.IMAGE_EDIT,
    AI_MODEL_FUNC_CODE.IMAGE_MULTI_VIEW,
    AI_MODEL_FUNC_CODE.IMAGE_UPSCALE
  ])
  const listScope = buildAidAgentListScopeParams(creationStore)
  const agentPayloads = [
    { bizCategoryCode: formImageBiz, agentCode, ...listScope },
    {
      bizCategoryCode: IMAGE_MULTI_VIEW_AGENT_BIZ_CATEGORY,
      agentCode: IMAGE_MULTI_VIEW_AGENT_CODE,
      ...listScope
    }
  ]

  const [agentCodes, modelGroups] = await Promise.all([
    fetchAgentDefaultModelCodes(agentPayloads),
    userModelListByFuncCodes(funcCodes, listScope)
  ])

  // 批量 listByFunc 已请求过各池；空结果不再用不同入参单码重打
  if (!applySceneModalImageModelPool(modelGroups, assetType)) {
    rawModelList.value = []
    modelOptions.value = []
  }
  if (!applySceneModalDialogueModelPool(modelGroups)) {
    dialogueRawModelList.value = []
    dialogueModelOptions.value = []
  }
  if (!applySceneModalMultiViewModelPool(modelGroups)) {
    multiViewModelOptions.value = []
  }

  upscaleModelPool.value = modelsFromListByFuncGroups(modelGroups, AI_MODEL_FUNC_CODE.IMAGE_UPSCALE)

  const agentDefaultModelCode =
    agentCodes[getAgentDefaultModelCacheKey(formImageBiz, agentCode, listScope)] || ''
  const multiViewAgentDefault =
    agentCodes[
      getAgentDefaultModelCacheKey(
        IMAGE_MULTI_VIEW_AGENT_BIZ_CATEGORY,
        IMAGE_MULTI_VIEW_AGENT_CODE,
        listScope
      )
    ] || ''

  generationSettings.value.model = resolvePreferredModelId(modelOptions.value, {
    agentDefaultCode: agentDefaultModelCode
  })
  dialogueSettings.value.model = resolvePreferredModelId(dialogueModelOptions.value, {
    agentDefaultCode: agentDefaultModelCode
  })
  syncEditSettingsToModel()
  syncDialogueSettingsToModel()
  multiViewSettings.value.model = resolvePreferredModelId(multiViewModelOptions.value, {
    agentDefaultCode: multiViewAgentDefault
  })
}

const selectedModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(modelOptions.value, generationSettings.value.model)
)

const selectedDialogueModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(dialogueModelOptions.value, dialogueSettings.value.model)
)

const generationSettingsForCapability = computed({
  get: () => ({
    aspectRatio: generationSettings.value.aspectRatio,
    count: generationSettings.value.count,
    quality: generationSettings.value.quality
  }),
  set: (v) => {
    generationSettings.value.aspectRatio = v.aspectRatio
    generationSettings.value.count = v.count
    generationSettings.value.quality = v.quality
  }
})

const {
  aspectRatioSelectOptions: editAspectRatioSelectOptions,
  countSelectOptions: editCountSelectOptionsRaw,
  qualitySelectOptions: editQualitySelectOptions,
  syncSettingsToModel: syncEditSettingsToModel
} = useModelGenerateSettings({
  selectedModel,
  rawModelList,
  generationSettings: generationSettingsForCapability,
  include3k: true
})

/** 接口限制 imageCount 为 1~4 */
const editCountSelectOptions = computed(() => {
  const capped = editCountSelectOptionsRaw.value.filter((o) => o.value >= 1 && o.value <= 4)
  if (capped.length) return capped
  return [
    { value: 1, label: '1张' },
    { value: 2, label: '2张' },
    { value: 3, label: '3张' },
    { value: 4, label: '4张' }
  ]
})

const dialogueSettingsForCapability = computed({
  get: () => ({
    aspectRatio: dialogueSettings.value.aspectRatio,
    count: dialogueSettings.value.count,
    quality: dialogueSettings.value.quality
  }),
  set: (v) => {
    dialogueSettings.value.aspectRatio = v.aspectRatio
    dialogueSettings.value.count = v.count
    dialogueSettings.value.quality = v.quality
  }
})

const {
  aspectRatioSelectOptions: dialogueAspectRatioSelectOptions,
  countSelectOptions: dialogueCountSelectOptionsRaw,
  qualitySelectOptions: dialogueQualitySelectOptions,
  syncSettingsToModel: syncDialogueSettingsToModel
} = useModelGenerateSettings({
  selectedModel: selectedDialogueModel,
  rawModelList: dialogueRawModelList,
  generationSettings: dialogueSettingsForCapability,
  include3k: true
})

const dialogueCountSelectOptions = computed(() => {
  const capped = dialogueCountSelectOptionsRaw.value.filter((o) => o.value >= 1 && o.value <= 4)
  if (capped.length) return capped
  return [
    { value: 1, label: '1张' },
    { value: 2, label: '2张' },
    { value: 3, label: '3张' },
    { value: 4, label: '4张' }
  ]
})

const handleSelectModel = (model: ModelOption) => {
  generationSettings.value.model = model.id
  modelDropdownExpanded.value = false
  syncEditSettingsToModel()
}

const handleSelectDialogueModel = (model: ModelOption) => {
  dialogueSettings.value.model = model.id
  dialogueModelDropdownExpanded.value = false
  syncDialogueSettingsToModel()
}

const handleSelectMultiViewModel = (model: ModelOption) => {
  multiViewSettings.value.model = model.id
  multiViewModelDropdownExpanded.value = false
}

const fallbackMultiViewModelOptions: ModelOption[] = [
  {
    id: 'wan2.7-image',
    name: '万相 2.7',
    iconBg: '#60A5FA',
    desc: '多机位形态生图',
    prices: []
  }
]

const {
  modelList: multiViewModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.IMAGE_MULTI_VIEW,
  modelType: 'image',
  fallback: fallbackMultiViewModelOptions,
  mapItem: (item) => mapUserModelListItemToModelOption(item, { iconBg: '#60A5FA' }),
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载多机位模型失败，已使用默认模型')
  }
})

const multiViewSettings = ref({ model: '' })
const multiViewSelectedModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(multiViewModelOptions.value, multiViewSettings.value.model)
)

const multiViewModelDropdownExpanded = ref(false)

/** 变清晰：listByFunc(image_upscale) 模型池，供 UpscaleModelPopover 复用 */
const upscaleModelPool = ref<UserModelListItem[]>([])

function resolveSceneModalAssetType(): AssetExtractType {
  if (
    props.imageType === 'character' ||
    (props.imageType === 'form' && props.formParentAssetType === 'character')
  ) {
    return 'character'
  }
  if (props.imageType === 'prop' || (props.imageType === 'form' && props.formParentAssetType === 'prop')) {
    return 'prop'
  }
  return 'scene'
}

const generationCost = computed(() => {
  const costMap: Record<string, number> = {
    '1k': 1,
    '2k': 2,
    '4k': 4
  }
  return (costMap[generationSettings.value.quality] || 2) * generationSettings.value.count
})

type DialogueSourceImage = { url: string; title?: string }
const dialogueSourceImages = ref<DialogueSourceImage[]>([])
const dialogueInstructionHtml = ref('')
const showDialogueImportModal = ref(false)

/** "编辑图片" Tab 的参考图列表（genMode=edit，≥1 张） */
const generateSourceImages = ref<DialogueSourceImage[]>([])
const showGenerateImportModal = ref(false)

const activeAspectRatio = computed({
  get: () => (leftActiveTab.value === 'generate' ? generationSettings.value.aspectRatio : dialogueSettings.value.aspectRatio),
  set: (value: string) => {
    if (leftActiveTab.value === 'generate') {
      generationSettings.value.aspectRatio = value
    } else {
      dialogueSettings.value.aspectRatio = value
    }
  }
})

const activeCount = computed({
  get: () => (leftActiveTab.value === 'generate' ? generationSettings.value.count : dialogueSettings.value.count),
  set: (value: number) => {
    if (leftActiveTab.value === 'generate') {
      generationSettings.value.count = value
    } else {
      dialogueSettings.value.count = value
    }
  }
})

const activeQuality = computed({
  get: () => (leftActiveTab.value === 'generate' ? generationSettings.value.quality : dialogueSettings.value.quality),
  set: (value: string) => {
    if (leftActiveTab.value === 'generate') {
      generationSettings.value.quality = value
    } else {
      dialogueSettings.value.quality = value
    }
  }
})

const currentScene = computed(() => {
  return props.scenes[currentSceneIndex.value] || { name: '', images: [] }
})

// 锁：在“编辑从 rps 接口回填”的弹窗场景下，禁止 watch(props.scenes) 覆盖 left 列表数据。
// left 列表必须以 form-image/list 返回为准（支持 isUse=0/1 全量展示）。
let lockLocalSceneImagesFromRps = false

// 本地场景图片列表（包含待添加的图片）
const localSceneImages = ref<any[]>([])

function syncLocalSceneImagesFromSceneIndex(
  sceneIdx: number,
  opts?: { preservePending?: boolean }
) {
  const sceneImages = props.scenes[sceneIdx]?.images || []
  const sceneIds = new Set(sceneImages.map((img: any) => img.id).filter(Boolean))
  const pendingOnly = opts?.preservePending
    ? localSceneImages.value.filter((img: any) => img?._pending && img?.id && !sceneIds.has(img.id))
    : []
  localSceneImages.value = [
    ...sceneImages.map((img: any) => ({ ...img, _isSet: true })),
    ...pendingOnly
  ]
  const n = localSceneImages.value.length
  if (n === 0) {
    currentImageIndex.value = 0
  } else if (currentImageIndex.value >= n) {
    currentImageIndex.value = n - 1
  }
}

// 初始化本地场景图片列表（pending 仅保留父级尚不存在的 id，避免与 scene 重复叠加）
watch(() => [props.scenes, currentSceneIndex.value], () => {
  // 只要弹窗是“从 rps 接口编辑”的上下文（父级传了 rpsAssetId / rpsFormIds），
  // 左侧列表需要完全依赖 `/api/user/asset/rps/form-image/list` 的返回，
  // 否则会被父级回填的（通常仅 isUse=1）数据覆盖。
  const hasRpsContext = activeRpsAssetId.value != null || activeRpsFormIds.value.length > 0
  if (hasRpsContext) return
  if (lockLocalSceneImagesFromRps) return
  if (props.imageType !== 'scene') return
  syncLocalSceneImagesFromSceneIndex(currentSceneIndex.value, { preservePending: true })
}, { immediate: true, deep: true })

const currentSceneImages = computed(() => {
  return localSceneImages.value
})

/** 导入参考图弹窗：当前场景以左侧生成记录为准（含 isUse=0 等未同步到父级的图） */
const scenesForImportModal = computed(() => {
  return props.scenes.map((scene, index) => {
    if (index !== currentSceneIndex.value) return scene
    const images = localSceneImages.value
      .filter((img) => Boolean(img?.url))
      .map((img, i) => ({
        id: img.id,
        url: img.url,
        thumbnail: img.thumbnail || img.url,
        title: img.title || img.name || `场景图${i + 1}`,
        source: img.source,
        importDate: img.importDate
      }))
    return { ...scene, images }
  })
})
const currentImg = computed(() => {
  return currentSceneImages.value[currentImageIndex.value] || null
})

/** 中间画布标题：与外层列表 `img.title` 同源 */
const currentImageDisplayTitle = computed(() => {
  const img = currentImg.value
  if (!img) return ''
  const title = String(img.title || img.name || '').trim()
  if (title) return title
  return getImageTitleFallback(currentImageIndex.value)
})

function handlePreviewCanvasImage() {
  const img = currentImg.value
  const url = String(img?.url || '').trim()
  if (!url) return
  openImagePreviewModal({
    url,
    title: img?.title || '预览'
  })
}

/** 角色主资产编辑或「角色下的形态」编辑：设定卡接口仅角色 */
const showToolbarSettingCard = computed(
  () =>
    props.imageType === 'character' ||
    (props.imageType === 'form' && props.formParentAssetType === 'character')
)

const isSettingCardTypeSupported = computed(() => showToolbarSettingCard.value)

/** 设定卡参考图允许的来源：AI 白底主图 / 资产库 / 本地上传 */
const SETTING_CARD_BASE_SOURCE_TYPES = new Set(['ai_auto', 'upload', 'official'])

function resolveFormImageSourceTypeForSettingCard(img: unknown): string {
  const row = img as { _serverSourceType?: string; _rpsSourceType?: string; source?: string } | null
  const server = String(row?._serverSourceType || '').trim().toLowerCase()
  if (server) return server
  const rps = resolveRpsSourceType(row)
  if (rps === 'ai') return 'ai_auto'
  return rps
}

function isSettingCardBaseImage(img: unknown): boolean {
  const row = img as { rpsImageId?: number; url?: string } | null
  if (!String(row?.url || '').trim()) return false
  const rid = Number(row?.rpsImageId)
  if (!Number.isFinite(rid) || rid <= 0) return false
  return SETTING_CARD_BASE_SOURCE_TYPES.has(resolveFormImageSourceTypeForSettingCard(row))
}

const whiteBaseImageReadyForSettingCard = computed(() => {
  if (!isSettingCardTypeSupported.value) return false
  return isSettingCardBaseImage(currentImg.value)
})

function canDeleteHistoryImage(img: { rpsImageId?: number } | null | undefined): boolean {
  const rpsImageId = Number(img?.rpsImageId)
  return Number.isFinite(rpsImageId)
}

const showSceneSettingModal = ref(false)
const sceneSettingContent = ref('')
const showImportReferenceModal = ref(false)
const currentReferenceImageIndex = ref(0)
const showAssetLibraryModal = ref(false)
const showMultiAngleModal = ref(false)
const multiAngleTargetIndex = ref<number | null>(null)
const multiAngleImageUrl = ref('')
const addingSceneImageAtKey = ref('')
const cancellingAddAtKey = ref('')
const isAddingSceneImage = computed(
  () =>
    !!addingSceneImageAtKey.value &&
    addingSceneImageAtKey.value ===
      buildCanvasOverlayKey(currentSceneIndex.value, currentImageIndex.value)
)
const isCancellingAdd = computed(
  () =>
    !!cancellingAddAtKey.value &&
    cancellingAddAtKey.value ===
      buildCanvasOverlayKey(currentSceneIndex.value, currentImageIndex.value)
)
const isSelectingSceneImage = ref(false)
const selectedSceneImageIndex = ref<number | null>(null)
const addingAfterIndex = ref<number | null>(null)
// 待添加的图片（导入后暂存，需要手动添加）
const pendingImage = ref<any | null>(null)
/** 与父级传入的 id 统一为字符串，避免接口 number / 本地 string 导致 Set.has 失败 */
function normalizeImageId(id: unknown): string | null {
  if (id === undefined || id === null || id === '') return null
  return String(id)
}

// 在当前会话中添加的图片ID集合（用于显示"取消添加"按钮；与父级场景图列表同步）
const addedImageIds = ref<Set<string>>(new Set())

/** 父级已持久化的场景图 id 写入集合（刷新后依赖 props 恢复「取消添加」态） */
function syncAddedImageIdsFromParentScenes() {
  const si = currentSceneIndex.value
  const sceneImages = props.scenes[si]?.images || []
  const next = new Set<string>()
  for (const im of sceneImages) {
    const key = normalizeImageId(im?.id)
    if (key && !(im as { _pending?: boolean })?._pending) next.add(key)
  }
  addedImageIds.value = next
}

/** 当前图是否在父级列表中且可显示「取消添加」（与 addedImageIds 一致） */
const isCurrentImageCancelAddVisible = computed(() => {
  const img = currentImg.value as { id?: unknown } | null
  const key = normalizeImageId(img?.id)
  return Boolean(key && addedImageIds.value.has(key))
})

/** 当前场景已设为主图且可在外部展示的图片数量 */
const currentSceneMainImageCount = computed(() => {
  const sceneImages = props.scenes[currentSceneIndex.value]?.images || []
  let count = 0
  for (const im of sceneImages) {
    const key = normalizeImageId((im as { id?: unknown })?.id)
    if (key && addedImageIds.value.has(key)) count += 1
  }
  return count
})

/** 只剩 1 张主图时，禁止取消添加并给出提示 */
const cancelAddDisabledTooltip = computed(() => {
  if (!isCurrentImageCancelAddVisible.value) return ''
  if (currentSceneMainImageCount.value <= 1) {
    return '当前只有一张主图，不可取消'
  }
  return ''
})

const sceneTabBarRef = ref<InstanceType<typeof HorizontalScrollTabBar> | null>(null)

function scrollActiveSceneTabIntoView() {
  sceneTabBarRef.value?.scrollItemIntoView('.scene-image-tab.active')
  sceneTabBarRef.value?.refresh()
}

const mainContentRef = ref<HTMLElement | null>(null)
const imageRefs = ref<Array<HTMLElement | null>>([])

const setImageRef = (el: any, index: number) => {
  if (el && el instanceof HTMLElement) {
    imageRefs.value[index] = el
  }
}

// 切换场景
const switchScene = async (index: number) => {
  if (index === currentSceneIndex.value) return

  const nextEditorScopeKey = buildEditorScopeKeyForSceneIndex(index)
  suspendSceneModalFollowsExceptEditorScope(nextEditorScopeKey)

  leftPanelLoading.value = true
  rightPanelLoading.value = true
  currentSceneIndex.value = index
  currentImageIndex.value = 0
  syncLocalSceneImagesFromSceneIndex(index)

  await nextTick()
  scrollActiveSceneTabIntoView()
  await ensureModalLoadingRestored(index)
  void restoreSceneModalSseIfNeeded(index)
  setTimeout(() => {
    leftPanelLoading.value = false
    rightPanelLoading.value = false
  }, TAB_SWITCH_SKELETON_MS)
}

/** 顶部 Tab 互斥：挂起非目标 editorScope 的浏览器 SSE，释放并发槽 */
function suspendSceneModalFollowsExceptEditorScope(keepEditorScopeKey: string) {
  const liveGenScopeKey = currentModalLiveGenScopeKey()
  const tasks = creationStore.step3GenVisualByScope[liveGenScopeKey]?.modalSseTasks || {}
  const activeFollows = Object.entries(tasks)
    .map(([tabKey, snap]) => ({
      tabKey,
      taskId: Number((snap as { taskId?: number } | undefined)?.taskId)
    }))
    .filter((f) => Number.isFinite(f.taskId) && f.taskId > 0)

  const toSuspend = listModalTabFollowsToSuspend({
    currentTabKey: keepEditorScopeKey,
    activeFollows
  })
  for (const tid of toSuspend) {
    suspendTaskSseFollow(tid)
    if (hasStep3SseSlot(tid)) releaseStep3SseSlot(tid)
  }
  for (const f of activeFollows) {
    if (f.tabKey !== keepEditorScopeKey) {
      deleteModalFollowLock(f.tabKey, liveGenScopeKey)
    }
  }
  drainStep3SseQueue((item) => {
    if (item.owner === 'modal') {
      requeueStep3SseItemToEnd(item)
      return { kind: 'skipped' as const }
    }
    const acq = tryAcquireStep3SseSlot({ taskId: item.taskId, owner: 'outer' })
    if (acq.kind !== 'acquired' && acq.kind !== 'already-active') return acq
    if (import.meta.client) {
      window.dispatchEvent(
        new CustomEvent('create-flow-track-task', {
          detail: { taskId: item.taskId }
        })
      )
    }
    return acq
  })
}

// 切换图片
const switchImage = async (index: number) => {
  if (index === currentImageIndex.value) return
  currentImageIndex.value = index

  // 滚动到对应图片，确保图片滚动到顶部
  await nextTick()
  const targetElement = imageRefs.value[index]
  if (targetElement && mainContentRef.value) {
    const container = mainContentRef.value
    const elementTop = targetElement.offsetTop
    const containerTop = container.scrollTop
    const containerHeight = container.clientHeight

    // 计算需要滚动的距离，使目标元素滚动到容器顶部
    const scrollTo = elementTop - container.offsetTop
    container.scrollTo({
      top: scrollTo,
      behavior: 'smooth'
    })
  }
}

// 打开场景设定
const handleOpenSceneSetting = () => {
  if (props.manualSettingEditBlockedTooltip) return
  sceneSettingContent.value = (currentScene.value as any).setting || ''
  showSceneSettingModal.value = true
}

const handleSettingModalSyncSceneTitle = (fullDisplayName: string) => {
  emit('update', currentSceneIndex.value, { newAssetDisplayName: fullDisplayName })
}

// 保存场景设定（同步到外层列表）
const handleSaveSceneSetting = (content: string) => {
  sceneSettingContent.value = content
  showSceneSettingModal.value = false
  emit('update', currentSceneIndex.value, { setting: content })
  message.success('场景设定已保存')
}

const handleSaveAndUpdateSceneSetting = (content: string) => {
  sceneSettingContent.value = content
  showSceneSettingModal.value = false
  emit('update', currentSceneIndex.value, { setting: content })
  message.info('正在调用提取场景模型生成场景图...')
  setTimeout(() => {
    message.success('场景图已生成')
  }, 2000)
}

// 生成提示词
const handleGeneratePrompt = () => {
  message.info('正在生成提示词...')
  // 模拟生成提示词
  setTimeout(() => {
    promptText.value = '一个废土风格的场景，有废墟和荒芜的土地，远处有山脉，天空是灰暗的'
    message.success('提示词生成成功')
  }, 1000)
}

// 导入参考图
const handleImportReferenceImage = (index: number) => {
  currentReferenceImageIndex.value = index
  showImportReferenceModal.value = true
}

// 处理参考图导入
const handleReferenceImageImport = async (file: File | string) => {
  if (typeof file === 'string') {
    referenceImages.value[currentReferenceImageIndex.value] = { url: file }
  } else {
    const url = await uploadImageToOssWithToast(file)
    if (!url) return
    referenceImages.value[currentReferenceImageIndex.value] = { url }
  }
  message.success('参考图导入成功')
}

// 移除参考图
const removeReferenceImage = (index: number) => {
  referenceImages.value[index] = { url: undefined }
}

// 开始生图（编辑图片：genMode=edit，必须 ≥1 张参考图）
const handleStartGenerate = async () => {
  if (showEditGenerateButtonLoading.value) return
  if (isHtmlContentEmpty(promptText.value)) {
    message.warning('请输入描述内容')
    return
  }

  const promptPlainText = htmlToPlainText(promptText.value || '').trim()
  const refImages = generateSourceImages.value.map((img) => img.url).filter(Boolean) as string[]

  if (refImages.length === 0) {
    message.warning('编辑图片需至少上传 1 张参考图')
    return
  }

  const formIds = activeRpsFormIds.value
  const currentImgRow = localSceneImages.value[currentImageIndex.value] as Record<string, unknown> | undefined
  let formId: number | null = Number(currentImgRow?.rpsFormId)
  if (!Number.isFinite(formId) || formId <= 0) {
    formId = formIds.length > 0 ? formIds[0] : null
  }
  if (formId == null) {
    message.warning('当前缺少形态信息，无法发起生图')
    return
  }

  const modelCode = String(selectedModel.value?.id || '').trim()
  if (!modelCode) {
    message.warning('请先选择生图模型')
    return
  }

  const sceneIdx = currentSceneIndex.value
  const modalScope = captureModalScopeSnapshot(sceneIdx)
  const taskScopeKey = modalScope.editorScopeKey
  /** 剧集隔离：任务归属启动时作品/集；切集后终态收尾不得写当前集 store、不得 toast */
  const liveScope = captureCreationLiveGenScope()
  ensureGeneratingPlaceholderImage(sceneIdx)
  const imgIdx = currentImageIndex.value
  beginCanvasTaskOverlay(sceneIdx, imgIdx, '生图任务提交中...', 'edit-image')

  const result = await runEditImageTask({
    formId,
    genMode: 'edit',
    referenceImages: refImages,
    prompt: promptPlainText,
    modelCode,
    aspectRatio: generationSettings.value.aspectRatio || '1:1',
    size: generationSettings.value.quality?.toUpperCase() || '2K',
    imageCount: generationSettings.value.count || 1,
    onSubmitted: ({ taskId }) => {
      persistSceneModalSseTask(sceneIdx, imgIdx, 'edit-image', taskId, { formId })
    },
    onProgress: (p) => {
      const hit = resolvePersistedSceneModalSseTask(taskScopeKey)
      if (hit) syncSceneModalSseProgress(hit, p, liveScope.scopeKey)
      applyCanvasProgressIfCurrent({
        liveGenScopeKey: liveScope.scopeKey,
        editorScopeKey: taskScopeKey,
        text: formatCreationImageProgressText(p)
      })
      if (
        p.items?.length &&
        shouldApplyModalTaskProgressToCanvas({
          taskLiveGenScopeKey: liveScope.scopeKey,
          currentLiveGenScopeKey: currentModalLiveGenScopeKey(),
          taskEditorScopeKey: taskScopeKey,
          currentEditorScopeKey: buildEditorScopeKeyForSceneIndex(currentSceneIndex.value),
          modalOpen: props.open
        })
      ) {
        void claimFormImagesForModal('form_edit_chat', { items: p.items }).then(async () => {
          const focusId = p.items![p.items!.length - 1]?.imageId ?? null
          await initFormImageListOnOpen({ focusImageId: focusId })
          emitSceneTabUpdate(buildVisibleImagesForParent())
        })
      }
    }
  })

  // 关弹窗再进 / 双重 restore / suspend：旧 SSE 被抢占，勿清 Pinia / 勿 toast；释放锁后交给 restore 续跟
  if (result.ok === false && result.deferred) {
    if (taskScopeKey) {
      handleDeferredSceneModalFollow({
        sceneIdx,
        editorScopeKey: taskScopeKey,
        liveGenScopeKey: liveScope.scopeKey,
        errorMessage: result.errorMessage
      })
    }
    return
  }

  endCanvasTaskOverlay(sceneIdx, imgIdx)

  /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast、不回写图片 */
  if (!matchesCreationLiveGenScope(liveScope)) {
    creationStore.clearSceneModalSseTask(taskScopeKey, liveScope.scopeKey)
    return
  }

  if (result.ok === false) {
    creationStore.clearSceneModalSseTask(taskScopeKey)
    clearSceneImageModalGenSession(sceneModalSessionScope())
    clearSceneModalGeneratingUi(sceneIdx)
    message.error(result.errorMessage || '生图失败')
    return
  }
  creationStore.clearSceneModalSseTask(taskScopeKey)
  clearSceneImageModalGenSession(sceneModalSessionScope())
  clearSceneModalGeneratingUi(sceneIdx)
  await claimFormImagesForModal('form_edit_chat', { items: result.items })
  await refreshAfterEditChatGenerate(result.items, modalScope)

  const successCount = result.items.length
  const failMsg = result.failCount ? `，${result.failCount} 张失败` : ''
  message.success(`编辑图片完成，共生成 ${successCount} 张${failMsg}`)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }
}

// 本地上传图片
const handleUploadLocalImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (file) {
      const url = await uploadImageToOssWithToast(file)
      if (!url) return
      // 新增待添加图片后 currentImageIndex 会切到末尾；
      // 为避免 formId 依赖索引取不到，先继承当前选中图片的 rpsFormId。
      const selectedImg = localSceneImages.value[currentImageIndex.value] as any
      const selectedFormId = Number(selectedImg?.rpsFormId)
      const maybeSelectedFormId = Number.isFinite(selectedFormId) ? selectedFormId : undefined
      const now = new Date()
      // 不直接添加到列表，只存储到待添加状态
      pendingImage.value = {
        id: Date.now().toString(),
        url: url,
        thumbnail: url,
        title: file.name.replace(/\.[^/.]+$/, '') || `场景图${currentSceneImages.value.length + 1}`,
        createdAt: now.toISOString(),
        source: '本地上传',
        importDate: now.toISOString(),
        _rpsSourceType: 'upload' as const,
        _isSet: false,
        ...(maybeSelectedFormId != null ? { rpsFormId: maybeSelectedFormId } : {}),
        angles: []
      }

      // 将待添加的图片添加到本地列表末尾（仅用于预览，标记为待添加）
      localSceneImages.value.push({ ...pendingImage.value, _pending: true })

      // 切换到待添加的图片
      currentImageIndex.value = localSceneImages.value.length - 1

      // 不通知父组件更新，避免同步到外部场景列表

      // 上传成功后立即同步到个人资产（不等待“确认添加”）
      const createdResult = await syncImageToRpsApi(
        url,
        pendingImage.value.title || '',
        'upload',
        pendingImage.value
      )
      if (createdResult) {
        const pendingIndex = localSceneImages.value.length - 1
        // 为了让弹窗/父级“左侧图片列表”立刻出现，需要在 create 成功后拉取 list，
        // 并把该 pending 图片直接标记为“已展示” (_isSet=true)。
        if (createdResult.formId != null && createdResult.imageId != null && pendingIndex >= 0) {
          try {
            const list = await userAssetRpsFormImageList({
              formId: Number(createdResult.formId),
              isUse: null
            })
            const hit =
              (Array.isArray(list) &&
                list.find((x: any) => Number.isFinite(Number(x?.id)) && Number(x.id) === Number(createdResult.imageId))) ||
              (Array.isArray(list) &&
                list.find((x: any) => String(x?.imageUrl || '').trim() === String(url).trim())) ||
              null

            if (hit) {
              const imageUrlFromList = String(hit.imageUrl || url)
              const nextTitle = String(hit.name || pendingImage.value.title || '')
              localSceneImages.value[pendingIndex] = {
                ...localSceneImages.value[pendingIndex],
                url: imageUrlFromList,
                thumbnail: imageUrlFromList,
                title: nextTitle || localSceneImages.value[pendingIndex].title,
                rpsFormId: Number(hit.formId ?? createdResult.formId),
                rpsImageId: Number(hit.id ?? createdResult.imageId),
                _isSet: Number(hit?.isUse) === 1
              }
              delete localSceneImages.value[pendingIndex]._pending

              // 清掉 pendingImage 引用，避免后续“确认添加”逻辑重复执行
              pendingImage.value = null

              emitSceneTabUpdate(buildVisibleImagesForParent())
              message.success('已添加到列表')
            } else {
              // list 未命中时退化：至少写回 id，保留 _pending 让用户可继续点“确认添加”
              pendingImage.value = {
                ...pendingImage.value,
                ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
                ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
              }
              localSceneImages.value[pendingIndex] = {
                ...localSceneImages.value[pendingIndex],
                ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
                ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
              }
              message.info(`图片已导入，请点击"${addImageButtonLabel.value}"按钮确认添加`)
            }
          } catch {
            // list 请求失败不阻断体验：仍保留 pending，允许用户点确认添加
            pendingImage.value = {
              ...pendingImage.value,
              ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
              ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
            }
            if (pendingIndex >= 0) {
              localSceneImages.value[pendingIndex] = {
                ...localSceneImages.value[pendingIndex],
                ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
                ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
              }
            }
            message.info(`图片已导入，请点击"${addImageButtonLabel.value}"按钮确认添加`)
          }
        } else {
          // create 成功但缺失返回字段：退化为旧行为（等待用户确认添加）
          pendingImage.value = {
            ...pendingImage.value,
            ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
            ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
          }
          const pendingIndex2 = localSceneImages.value.length - 1
          if (pendingIndex2 >= 0) {
            localSceneImages.value[pendingIndex2] = {
              ...localSceneImages.value[pendingIndex2],
              ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
              ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
            }
          }
          message.info(`图片已导入，请点击"${addImageButtonLabel.value}"按钮确认添加`)
        }
      }
      // 成功命中 list 并自动添加后，message 已在 try/catch 内处理，无需重复提示

      // 滚动到待添加的图片
      nextTick(() => {
        switchImage(currentImageIndex.value)
      })
    }
  }
  input.click()
}

// 打开资源库
const handleOpenAssetLibrary = () => {
  showAssetLibraryModal.value = true
}

// 处理资源库导入
const handleAssetLibraryImport = async (asset: any) => {
  // 不直接添加到列表，只存储到待添加状态，不更新场景列表
  const imageUrl = asset.url || asset.thumbnail || 'https://picsum.photos/800/450?random=' + Date.now()
  // 同步继承当前选中项的 rpsFormId，避免新增项 formId 推断越界。
  const selectedImg = localSceneImages.value[currentImageIndex.value] as any
  const selectedFormId = Number(selectedImg?.rpsFormId)
  const maybeSelectedFormId = Number.isFinite(selectedFormId) ? selectedFormId : undefined
  const now = new Date()
  pendingImage.value = {
    id: Date.now().toString(),
    url: imageUrl,
    thumbnail: imageUrl,
    title: asset.name || `场景图${currentSceneImages.value.length + 1}`,
    createdAt: now.toISOString(),
    source: '资源库导入',
    importDate: now.toISOString(),
    _rpsSourceType: 'official' as const,
    _isSet: false,
    ...(maybeSelectedFormId != null ? { rpsFormId: maybeSelectedFormId } : {}),
    angles: []
  }

  // 将待添加的图片添加到本地列表末尾（仅用于预览，标记为待添加）
  localSceneImages.value.push({ ...pendingImage.value, _pending: true })

  // 切换到待添加的图片
  currentImageIndex.value = localSceneImages.value.length - 1

  // 不通知父组件更新，避免同步到外部场景列表

  // 资产库导入成功后立即同步到个人资产（不等待“确认添加”）
  const createdResult = await syncImageToRpsApi(
    imageUrl,
    pendingImage.value?.title || '',
    'official',
    pendingImage.value
  )
  if (createdResult && pendingImage.value) {
    const pendingIndex = localSceneImages.value.length - 1
    if (createdResult.formId != null && createdResult.imageId != null && pendingIndex >= 0) {
      try {
        const list = await userAssetRpsFormImageList({
          formId: Number(createdResult.formId),
          isUse: null
        })
        const hit =
          (Array.isArray(list) &&
            list.find(
              (x: any) => Number.isFinite(Number(x?.id)) && Number(x.id) === Number(createdResult.imageId)
            )) ||
          (Array.isArray(list) &&
            list.find((x: any) => String(x?.imageUrl || '').trim() === String(imageUrl).trim())) ||
          null

        if (hit) {
          const imageUrlFromList = String(hit.imageUrl || imageUrl)
          const nextTitle = String(hit.name || pendingImage.value.title || '')
          localSceneImages.value[pendingIndex] = {
            ...localSceneImages.value[pendingIndex],
            url: imageUrlFromList,
            thumbnail: imageUrlFromList,
            title: nextTitle || localSceneImages.value[pendingIndex].title,
            rpsFormId: Number(hit.formId ?? createdResult.formId),
            rpsImageId: Number(hit.id ?? createdResult.imageId),
            _isSet: Number(hit?.isUse) === 1
          }
          delete localSceneImages.value[pendingIndex]._pending

          pendingImage.value = null
          emitSceneTabUpdate(buildVisibleImagesForParent())
          message.success('已添加到列表')
        } else {
          pendingImage.value = {
            ...pendingImage.value,
            ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
            ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
          }
          localSceneImages.value[pendingIndex] = {
            ...localSceneImages.value[pendingIndex],
            ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
            ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
          }
          message.info(`图片已导入，请点击"${addImageButtonLabel.value}"按钮确认添加`)
        }
      } catch {
        pendingImage.value = {
          ...pendingImage.value,
          ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
          ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
        }
        localSceneImages.value[pendingIndex] = {
          ...localSceneImages.value[pendingIndex],
          ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
          ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
        }
        message.info(`图片已导入，请点击"${addImageButtonLabel.value}"按钮确认添加`)
      }
    } else {
      pendingImage.value = {
        ...pendingImage.value,
        ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
        ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
      }
      localSceneImages.value[pendingIndex] = {
        ...localSceneImages.value[pendingIndex],
        ...(createdResult.formId != null ? { rpsFormId: createdResult.formId } : {}),
        ...(createdResult.imageId != null ? { rpsImageId: createdResult.imageId } : {})
      }
      message.info(`图片已导入，请点击"${addImageButtonLabel.value}"按钮确认添加`)
    }
  }

  showAssetLibraryModal.value = false

  // 滚动到待添加的图片
  nextTick(() => {
    switchImage(currentImageIndex.value)
  })
}

// 编辑图片标题
const startEditImageTitle = (index: number) => {
  editingImageTitleIndex.value = index
  const img = currentSceneImages.value[index]
  editingImageTitle.value =
    String(img?.title || img?.name || '').trim() || getImageTitleFallback(index)
}

const handleImageTitleBlur = (index: number) => {
  if (editingImageTitleIndex.value === index && editingImageTitle.value.trim()) {
    const updatedScenes = [...props.scenes]
    if (updatedScenes[currentSceneIndex.value].images && updatedScenes[currentSceneIndex.value].images[index]) {
      updatedScenes[currentSceneIndex.value].images[index].title = editingImageTitle.value.trim()
      emit('update', currentSceneIndex.value, updatedScenes[currentSceneIndex.value])
      message.success('标题已更新')
    }
    // 同步本地列表标题，保证中间区与左侧/外层一致
    if (localSceneImages.value[index]) {
      localSceneImages.value[index] = {
        ...localSceneImages.value[index],
        title: editingImageTitle.value.trim()
      }
    }
  }
  editingImageTitleIndex.value = null
  editingImageTitle.value = ''
}

// 移除图片
const removeImage = (index: number) => {
  const updatedScenes = [...props.scenes]
  if (updatedScenes[currentSceneIndex.value].images) {
    updatedScenes[currentSceneIndex.value].images.splice(index, 1)
    // 调整当前图片索引
    if (currentImageIndex.value >= updatedScenes[currentSceneIndex.value].images.length) {
      currentImageIndex.value = Math.max(0, updatedScenes[currentSceneIndex.value].images.length - 1)
    }
    emit('update', currentSceneIndex.value, updatedScenes[currentSceneIndex.value])
    message.success('图片已移除')
  }
}

function handleDialogueImportMultiple(payload: { sceneIndex: number; images: any[] }) {
  void payload.sceneIndex
  const list = (payload.images || [])
    .map((img) => {
      const url = String(img?.url || img?.thumbnail || '').trim()
      if (!url) return null
      return { url, title: img?.title || img?.name }
    })
    .filter(Boolean) as DialogueSourceImage[]
  const existed = new Set(dialogueSourceImages.value.map((item) => item.url))
  const toAppend = list.filter((item) => !existed.has(item.url))
  dialogueSourceImages.value = [...dialogueSourceImages.value, ...toAppend]
  message.success(`已导入 ${toAppend.length} 张参考图`)
}

function handleGenerateImportMultiple(payload: { sceneIndex: number; images: any[] }) {
  void payload.sceneIndex
  const list = (payload.images || [])
    .map((img) => {
      const url = String(img?.url || img?.thumbnail || '').trim()
      if (!url) return null
      return { url, title: img?.title || img?.name }
    })
    .filter(Boolean) as DialogueSourceImage[]
  const existed = new Set(generateSourceImages.value.map((item) => item.url))
  const toAppend = list.filter((item) => !existed.has(item.url))
  // 最多 4 张参考图
  const remaining = 4 - generateSourceImages.value.length
  const finalAppend = toAppend.slice(0, remaining)
  if (finalAppend.length < toAppend.length) {
    message.warning('参考图最多 4 张，已截取前几张')
  }
  generateSourceImages.value = [...generateSourceImages.value, ...finalAppend]
  if (finalAppend.length > 0) {
    message.success(`已导入 ${finalAppend.length} 张参考图`)
  }
}

function removeDialogueSourceImage(index: number) {
  dialogueSourceImages.value = dialogueSourceImages.value.filter((_, i) => i !== index)
}

/** 「对话作图」Tab：genMode=chat，参考图 0~N 张（0 张为纯文生图） */
const handleStartDialogueGenerate = async () => {
  if (showDialogueGenerateButtonLoading.value) return
  const instructionText = htmlToPlainText(dialogueInstructionHtml.value || '').trim()
  if (!instructionText) {
    message.warning('请输入修改要求')
    return
  }

  const refUrls = dialogueSourceImages.value
    .map((img) => String(img.url || '').trim())
    .filter(Boolean)

  const formIds = activeRpsFormIds.value
  const currentImgRow = localSceneImages.value[currentImageIndex.value] as Record<string, unknown> | undefined
  let formId: number | null = Number(currentImgRow?.rpsFormId)
  if (!Number.isFinite(formId) || formId <= 0) {
    formId = formIds.length > 0 ? formIds[0] : null
  }
  if (formId == null) {
    message.warning('当前缺少形态信息，无法发起生图')
    return
  }

  const modelCode = String(selectedDialogueModel.value?.id || '').trim()
  if (!modelCode) {
    message.warning('请先选择生图模型')
    return
  }

  const sceneIdx = currentSceneIndex.value
  const modalScope = captureModalScopeSnapshot(sceneIdx)
  const taskScopeKey = modalScope.editorScopeKey
  /** 剧集隔离：任务归属启动时作品/集；切集后终态收尾不得写当前集 store、不得 toast */
  const liveScope = captureCreationLiveGenScope()
  ensureGeneratingPlaceholderImage(sceneIdx)
  const imgIdx = currentImageIndex.value
  beginCanvasTaskOverlay(sceneIdx, imgIdx, '生图任务提交中...', 'dialogue')

  const result = await runEditImageTask({
    formId,
    genMode: 'chat',
    referenceImages: refUrls.length > 0 ? refUrls : undefined,
    prompt: instructionText,
    modelCode,
    aspectRatio: dialogueSettings.value.aspectRatio || '1:1',
    size: dialogueSettings.value.quality?.toUpperCase() || '2K',
    imageCount: dialogueSettings.value.count || 1,
    onSubmitted: ({ taskId }) => {
      persistSceneModalSseTask(sceneIdx, imgIdx, 'dialogue', taskId, { formId })
    },
    onProgress: (p) => {
      const hit = resolvePersistedSceneModalSseTask(taskScopeKey)
      if (hit) syncSceneModalSseProgress(hit, p, liveScope.scopeKey)
      applyCanvasProgressIfCurrent({
        liveGenScopeKey: liveScope.scopeKey,
        editorScopeKey: taskScopeKey,
        text: formatCreationImageProgressText(p)
      })
      if (
        p.items?.length &&
        shouldApplyModalTaskProgressToCanvas({
          taskLiveGenScopeKey: liveScope.scopeKey,
          currentLiveGenScopeKey: currentModalLiveGenScopeKey(),
          taskEditorScopeKey: taskScopeKey,
          currentEditorScopeKey: buildEditorScopeKeyForSceneIndex(currentSceneIndex.value),
          modalOpen: props.open
        })
      ) {
        void claimFormImagesForModal('form_edit_chat', { items: p.items }).then(async () => {
          const focusId = p.items![p.items!.length - 1]?.imageId ?? null
          await initFormImageListOnOpen({ focusImageId: focusId })
          emitSceneTabUpdate(buildVisibleImagesForParent())
        })
      }
    }
  })

  // 关弹窗再进 / 双重 restore / suspend：旧 SSE 被抢占，勿清 Pinia / 勿 toast；释放锁后交给 restore 续跟
  if (result.ok === false && result.deferred) {
    if (taskScopeKey) {
      handleDeferredSceneModalFollow({
        sceneIdx,
        editorScopeKey: taskScopeKey,
        liveGenScopeKey: liveScope.scopeKey,
        errorMessage: result.errorMessage
      })
    }
    return
  }

  endCanvasTaskOverlay(sceneIdx, imgIdx)

  /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast、不回写图片 */
  if (!matchesCreationLiveGenScope(liveScope)) {
    creationStore.clearSceneModalSseTask(taskScopeKey, liveScope.scopeKey)
    return
  }

  if (result.ok === false) {
    creationStore.clearSceneModalSseTask(taskScopeKey)
    clearSceneImageModalGenSession(sceneModalSessionScope())
    clearSceneModalGeneratingUi(sceneIdx)
    message.error(result.errorMessage || '生图失败')
    return
  }
  creationStore.clearSceneModalSseTask(taskScopeKey)
  clearSceneImageModalGenSession(sceneModalSessionScope())
  clearSceneModalGeneratingUi(sceneIdx)
  await claimFormImagesForModal('form_edit_chat', { items: result.items })
  await refreshAfterEditChatGenerate(result.items, modalScope)

  const successCount = result.items.length
  const failMsg = result.failCount ? `，${result.failCount} 张失败` : ''
  message.success(`对话作图完成，共生成 ${successCount} 张${failMsg}`)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }
}

// 图片操作
const handlePreviewImage = (index: number) => {
  const img = currentSceneImages.value[index]
  if (img && img.url) {
    openImagePreviewModal({
      url: img.url,
      title: img.title || `场景图${index + 1}`
    })
  } else {
    message.warning('暂无图片可预览')
  }
}

const handleReplaceImage = (index: number) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (file) {
      const url = await uploadImageToOssWithToast(file)
      if (!url) return
      const tabIdx = currentSceneIndex.value
      const updatedScenes = [...props.scenes]
      if (updatedScenes[tabIdx].images && updatedScenes[tabIdx].images[index]) {
        updatedScenes[tabIdx].images[index].url = url
        updatedScenes[tabIdx].images[index].thumbnail = url
        currentImageIndex.value = index
        const snapshotImages = [...updatedScenes[tabIdx].images]
        const title = snapshotImages[index]?.title || ''
        const rpsImageIdRaw = Number(snapshotImages[index]?.rpsImageId)
        if (Number.isFinite(rpsImageIdRaw)) {
          try {
            await userAssetRpsFormImageUpdate({
              imageId: rpsImageIdRaw,
              imageUrl: url,
              name: title
            })
          } catch (e: unknown) {
            const err = e as { msg?: string; message?: string }
            message.warning(err?.msg || err?.message || '同步个人资产形态图失败')
          }
        }
        if (Number.isFinite(rpsImageIdRaw)) {
          emitSceneTabUpdate(snapshotImages, tabIdx)
        } else {
          ;(async () => {
            const result = await syncImageToRpsApi(url, title, 'upload', snapshotImages[index])
            if (result?.imageId != null) {
              snapshotImages[index] = { ...snapshotImages[index], rpsImageId: result.imageId }
            }
            if (result?.formId != null) {
              snapshotImages[index] = { ...snapshotImages[index], rpsFormId: result.formId }
            }
            emitSceneTabUpdate(snapshotImages, tabIdx)
          })()
        }
        message.success('图片已替换')
      }
    }
  }
  input.click()
}

const handleDownloadImage = (index: number) => {
  const img = currentSceneImages.value[index]
  if (img && img.url) {
    // 创建下载链接
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `场景图${index + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  } else {
    message.warning('暂无图片可下载')
  }
}

const handleDeleteImage = (index: number) => {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这张图片吗？',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      const img = currentSceneImages.value[index] as { rpsImageId?: number } | undefined
      const rpsImageId = Number(img?.rpsImageId)
      if (Number.isFinite(rpsImageId)) {
        try {
          await userAssetRpsFormImageDelete({ imageId: rpsImageId })
        } catch (e: unknown) {
          const err = e as { msg?: string; message?: string }
          message.warning(err?.msg || err?.message || '删除后端形态图失败，仅移除本地展示')
        }
      }
      // 重新拉取，确保后端可能已调整 isUse 主图状态
      await initFormImageListOnOpen()
      emitSceneTabUpdate(buildVisibleImagesForParent())
    }
  })
}

const handleModifyImage = (index: number) => {
  const img = currentSceneImages.value[index]
  if (!img?.url) {
    message.warning('请先选择一张可编辑的图片')
    return
  }
  touchEditImageUrl.value = img.url
  showTouchEditModal.value = true
}

/** 点选改图入口（暂不开放） */
const showTouchEditToolbar = false
const showTouchEditModal = ref(false)
const touchEditImageUrl = ref('')

/** 形态图高清（upscale）画布遮罩 */
const upscaleUiPhase = ref<'idle' | 'running' | 'failed'>('idle')
const upscaleTargetKey = ref('')
const upscaleProgressText = ref('高清处理中…')
const upscaleFailedMessage = ref('')
const upscaleContext = ref<{
  sceneIndex: number
  imageIndex: number
  editorScopeKey: string
  assetId: number | null
} | null>(null)

const showUpscaleFailedOverlay = computed(() => {
  if (upscaleUiPhase.value !== 'failed') return false
  return (
    upscaleTargetKey.value ===
    buildCanvasOverlayKey(currentSceneIndex.value, currentImageIndex.value)
  )
})

/** 画布 / 左侧生成记录共用的任务 loading（生图、高清、设定卡等） */
function isCanvasTaskOverlayActive(sceneIdx: number, imgIdx: number): boolean {
  if (upscaleUiPhase.value !== 'running') return false
  return upscaleTargetKey.value === buildCanvasOverlayKey(sceneIdx, imgIdx)
}

const showCanvasTaskRunningOverlay = computed(() =>
  isCanvasTaskOverlayActive(currentSceneIndex.value, currentImageIndex.value)
)

const sceneGenerateOverlayText = computed(() => upscaleProgressText.value)

/** 画布遮罩当前任务类型，用于工具栏按钮 loading 与任务一一对应 */
const canvasOverlayTaskKind = ref<SceneModalSseTaskKind | null>(null)

const showSettingCardToolbarLoading = computed(
  () =>
    showCanvasTaskRunningOverlay.value && canvasOverlayTaskKind.value === 'setting-card'
)

const showUpscaleToolbarLoading = computed(
  () => showCanvasTaskRunningOverlay.value && canvasOverlayTaskKind.value === 'upscale'
)

const showMultiViewToolbarLoading = computed(
  () => showCanvasTaskRunningOverlay.value && canvasOverlayTaskKind.value === 'multi-view'
)

const showCurrentGeneratingPlaceholder = computed(
  () => !!currentImg.value?._generating && isHistoryItemGenerating(currentImageIndex.value)
)

function resolveActiveSceneModalTaskKind(sceneIdx: number): SceneModalSseTaskKind | null {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return null
  if (canvasOverlayTaskKind.value) return canvasOverlayTaskKind.value
  const persisted = resolvePersistedSceneModalSseTask(editorScopeKey)
  if (persisted?.taskKind) return persisted.taskKind
  const session = readSessionForScene(sceneIdx)
  if (session?.taskKind) return mapSessionTaskKind(session.taskKind)
  return null
}

const showEditGenerateButtonLoading = computed(() => {
  if (!isSceneModalImageGenerating(currentSceneIndex.value)) return false
  return resolveActiveSceneModalTaskKind(currentSceneIndex.value) === 'edit-image'
})

const showDialogueGenerateButtonLoading = computed(() => {
  if (!isSceneModalImageGenerating(currentSceneIndex.value)) return false
  return resolveActiveSceneModalTaskKind(currentSceneIndex.value) === 'dialogue'
})

const showGenerateFooterButtonLoading = computed(() =>
  leftActiveTab.value === 'generate'
    ? showEditGenerateButtonLoading.value
    : showDialogueGenerateButtonLoading.value
)

function clearUpscaleOverlay() {
  upscaleUiPhase.value = 'idle'
  upscaleTargetKey.value = ''
  upscaleFailedMessage.value = ''
  upscaleProgressText.value = '高清处理中…'
  upscaleContext.value = null
  canvasOverlayTaskKind.value = null
}

function resolvePersistedSceneModalSseTask(editorScopeKey: string): SceneModalSseTaskSnapshot | null {
  return (
    findSceneModalSseTaskInScopes(creationStore, editorScopeKey, route) ??
    creationStore.findSceneModalSseTaskAcrossScopes(editorScopeKey) ??
    creationStore.getSceneModalSseTask(editorScopeKey)
  )
}

function mapSessionTaskKind(raw: string | undefined): SceneModalSseTaskKind {
  if (raw === 'dialogue') return 'dialogue'
  if (raw === 'upscale') return 'upscale'
  if (raw === 'multi-view') return 'multi-view'
  if (raw === 'setting-card') return 'setting-card'
  if (raw === 'form-image') return 'form-image'
  return 'edit-image'
}

function rebuildPersistedFromSession(sceneIdx: number): SceneModalSseTaskSnapshot | null {
  const session = readSessionForScene(sceneIdx)
  if (!session?.taskId) return null
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return null
  return {
    taskId: session.taskId,
    taskKind: mapSessionTaskKind(session.taskKind),
    sceneIdx,
    imageIdx: session.imageIdx ?? currentImageIndex.value,
    editorScopeKey,
    formId: resolveFormIdForSceneIndex(sceneIdx)
  }
}

/** 弹窗内发起任务时同步列表卡片 generating，便于刷新后列表/流程条恢复 loading */
function syncExternalGeneratingForModalScope(sceneIdx: number) {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return

  const sceneMatch = editorScopeKey.match(/^scene-(\d+)$/i)
  if (sceneMatch) {
    creationStore.setSceneGenerationStatus(Number(sceneMatch[1]), 'generating')
    return
  }

  const charMatch = editorScopeKey.match(/^character-(\d+)$/i)
  if (charMatch) {
    const ci = Number(charMatch[1])
    creationStore.setCharacterFormGenerationStatus(`${ci}-0`, 'generating')
    return
  }

  const propMatch = editorScopeKey.match(/^prop-(\d+)$/i)
  if (propMatch) {
    const pi = Number(propMatch[1])
    creationStore.setPropFormGenerationStatus(`${pi}-0`, 'generating')
    return
  }

  if (/^\d+-\d+$/.test(editorScopeKey)) {
    if (props.imageType === 'form' && props.formParentAssetType === 'prop') {
      creationStore.setPropFormGenerationStatus(editorScopeKey, 'generating')
    } else {
      creationStore.setCharacterFormGenerationStatus(editorScopeKey, 'generating')
    }
  }
}

function slotHasLoadedImagesForModal(sceneIdx: number): boolean {
  const parentImages = props.scenes[sceneIdx]?.images
  if (Array.isArray(parentImages) && parentImages.some((img) => String(img?.url ?? '').trim())) {
    return true
  }
  if (sceneIdx === currentSceneIndex.value) {
    return localSceneImages.value.some((img) => String(img?.url ?? '').trim())
  }
  return false
}

/** 形态图已就绪时，将外层 Pinia generating 回落为 success，避免弹窗 Tab/记录卡误显 loading */
function markExternalGeneratingCompleteForModalScope(sceneIdx: number) {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return
  const hasImages = slotHasLoadedImagesForModal(sceneIdx)
  const nextStatus = hasImages ? 'success' : 'idle'

  const sceneMatch = editorScopeKey.match(/^scene-(\d+)$/i)
  if (sceneMatch) {
    creationStore.setSceneGenerationStatus(Number(sceneMatch[1]), nextStatus)
    return
  }

  const charMatch = editorScopeKey.match(/^character-(\d+)$/i)
  if (charMatch) {
    const ci = Number(charMatch[1])
    // 角色主资产弹窗：与 syncExternal 一致，只同步默认形态槽 `${ci}-0`
    creationStore.setCharacterFormGenerationStatus(`${ci}-0`, nextStatus)
    return
  }

  const propMatch = editorScopeKey.match(/^prop-(\d+)$/i)
  if (propMatch) {
    const pi = Number(propMatch[1])
    creationStore.setPropFormGenerationStatus(`${pi}-0`, nextStatus)
    return
  }

  if (/^\d+-\d+$/.test(editorScopeKey)) {
    if (props.imageType === 'form' && props.formParentAssetType === 'prop') {
      creationStore.setPropFormGenerationStatus(editorScopeKey, nextStatus)
    } else {
      creationStore.setCharacterFormGenerationStatus(editorScopeKey, nextStatus)
    }
  }
}

/** 刷新后：任务已终态但 session / Pinia generating 仍残留时，打开弹窗前先对齐 */
async function clearStaleSceneModalGeneratingState(sceneIdx: number) {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return

  const session = readSessionForScene(sceneIdx)
  if (session?.taskId) {
    try {
      const detail = await userTaskDetailCached(session.taskId)
      if (detail && isTerminalUserTaskStatus(detail.status)) {
        clearSceneImageModalGenSession(sceneModalSessionScope())
        creationStore.clearSceneModalSseTask(editorScopeKey)
      }
    } catch {
      /* 网络失败时保留 session，避免误清进行中的 loading */
    }
  }

  if (
    !resolvePersistedSceneModalSseTask(editorScopeKey) &&
    !hasModalFollowLock(editorScopeKey) &&
    isEditorScopeGeneratingExternally(sceneIdx) &&
    slotHasLoadedImagesForModal(sceneIdx)
  ) {
    markExternalGeneratingCompleteForModalScope(sceneIdx)
    clearLocalGeneratingPlaceholders()
    creationStore.refreshStep3VisualGeneratingFlag()
  }
}

/** 与 syncExternalGeneratingForModalScope 成对：SSE 失败/取消后清除外层 Tab/列表 generating */
function clearExternalGeneratingForModalScope(sceneIdx: number) {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return

  const sceneMatch = editorScopeKey.match(/^scene-(\d+)$/i)
  if (sceneMatch) {
    creationStore.setSceneGenerationStatus(Number(sceneMatch[1]), 'idle')
    return
  }

  const charMatch = editorScopeKey.match(/^character-(\d+)$/i)
  if (charMatch) {
    const ci = Number(charMatch[1])
    creationStore.setCharacterFormGenerationStatus(`${ci}-0`, 'idle')
    return
  }

  const propMatch = editorScopeKey.match(/^prop-(\d+)$/i)
  if (propMatch) {
    const pi = Number(propMatch[1])
    creationStore.setPropFormGenerationStatus(`${pi}-0`, 'idle')
    return
  }

  if (/^\d+-\d+$/.test(editorScopeKey)) {
    if (props.imageType === 'form' && props.formParentAssetType === 'prop') {
      creationStore.setPropFormGenerationStatus(editorScopeKey, 'idle')
    } else {
      creationStore.setCharacterFormGenerationStatus(editorScopeKey, 'idle')
    }
  }
}

function isTerminalUserTaskStatus(status: unknown): boolean {
  const st = String(status ?? '').trim().toUpperCase()
  return st === 'SUCCEEDED' || st === 'FAILED' || st === 'CANCELLED' || st === 'PARTIAL_FAILED'
}

function normModalTaskType(ty: unknown): string {
  return String(ty ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
}

function parseFormIdFromTaskSnapshot(raw: unknown): number | null {
  if (raw == null) return null
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return null
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    const pick = (v: unknown): number | null => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    const direct = pick(o.formId ?? o.form_id)
    if (direct != null) return direct
    const body = o.body
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>
      return pick(b.formId ?? b.form_id)
    }
  } catch {
    /* ignore */
  }
  const m = s.match(/"formId"\s*:\s*(\d+)/)
  if (m?.[1]) return Number(m[1])
  return null
}

function parseFormIdsFromTaskSnapshot(raw: unknown): number[] {
  if (raw == null) return []
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return []
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    const pick = (v: unknown): number[] => {
      if (!Array.isArray(v)) return []
      return v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    }
    const a = pick(o.formIds ?? o.form_ids)
    if (a.length) return a
    const body = o.body
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>
      return pick(b.formIds ?? b.form_ids)
    }
    const single = parseFormIdFromTaskSnapshot(s)
    return single != null ? [single] : []
  } catch {
    const single = parseFormIdFromTaskSnapshot(s)
    return single != null ? [single] : []
  }
}

function collectModalFormIdsForSceneIndex(sceneIdx: number): number[] {
  const ids = new Set<number>()
  // 仅当前 Tab 对应形态，禁止并入整份 activeRpsFormIds（否则同角色其它形态的生图任务会串到当前 Tab）
  const fid = resolveFormIdForSceneIndex(sceneIdx)
  if (fid != null) ids.add(fid)
  for (const img of localSceneImages.value) {
    const n = Number((img as { rpsFormId?: number })?.rpsFormId)
    if (Number.isFinite(n) && n > 0) ids.add(n)
  }
  return [...ids]
}

function isEditorScopeGeneratingExternally(sceneIdx: number): boolean {
  const scope = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!scope) return false
  const sceneMatch = scope.match(/^scene-(\d+)$/i)
  if (sceneMatch) {
    return creationStore.sceneGenerationStatus[Number(sceneMatch[1])] === 'generating'
  }
  const charMatch = scope.match(/^character-(\d+)$/i)
  if (charMatch) {
    const ci = Number(charMatch[1])
    // 勿用 startsWith(`${ci}-`)：同角色其它形态 generating 不应点亮当前角色 Tab
    return creationStore.characterFormGenerationStatus[`${ci}-0`] === 'generating'
  }
  const propMatch = scope.match(/^prop-(\d+)$/i)
  if (propMatch) {
    const pi = Number(propMatch[1])
    return creationStore.propFormGenerationStatus[`${pi}-0`] === 'generating'
  }
  if (/^\d+-\d+$/.test(scope)) {
    return (
      creationStore.characterFormGenerationStatus[scope] === 'generating' ||
      creationStore.propFormGenerationStatus[scope] === 'generating'
    )
  }
  return creationStore.sceneGenerationStatus[sceneIdx] === 'generating'
}

function parseImageIdFromTaskSnapshot(raw: unknown): number | null {
  if (raw == null) return null
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return null
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    const pick = (v: unknown): number | null => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    const direct = pick(o.imageId ?? o.image_id)
    if (direct != null) return direct
    const body = o.body
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>
      return pick(b.imageId ?? b.image_id)
    }
  } catch {
    /* ignore */
  }
  const m = s.match(/"imageId"\s*:\s*(\d+)/)
  if (m?.[1]) return Number(m[1])
  return null
}

function resolveImageIdxByRpsImageId(imageId: number): number {
  const idx = localSceneImages.value.findIndex(
    (x: { rpsImageId?: number }) => Number(x?.rpsImageId) === imageId
  )
  return idx >= 0 ? idx : Math.max(0, currentImageIndex.value)
}

function parseSettingCardResultData(
  raw: unknown
): { imageUrl: string; imageId: number | null } | null {
  const parsed = parseFormCardImageTaskResult(raw)
  if (!parsed.imageUrl) return null
  return { imageUrl: parsed.imageUrl, imageId: parsed.imageId }
}

function mapTaskTypeToModalKind(ty: string): SceneModalSseTaskKind {
  if (ty === 'form_edit_chat') return 'edit-image'
  if (ty === 'form_multi_view') return 'multi-view'
  if (ty === 'form_image' || ty === 'form_image_batch') return 'form-image'
  if (ty === 'image_upscale') return 'upscale'
  if (isFormCardImageTaskType(ty)) return 'setting-card'
  return 'edit-image'
}

function taskSnapshotMatchesModalFormIds(
  rec: { inputSnapshot?: string | null; taskType?: string | null },
  formIds: Set<number>
): boolean {
  const multi = parseFormIdsFromTaskSnapshot(rec.inputSnapshot)
  if (multi.some((id) => formIds.has(id))) return true
  const single = parseFormIdFromTaskSnapshot(rec.inputSnapshot)
  return single != null && formIds.has(single)
}

async function fetchRecentProjectTaskRows(projectId: number): Promise<UserTaskRow[]> {
  return fetchFlowUserTaskListOnce(Number(projectId)).catch(() => [])
}

async function resolveOngoingSettingCardModalTask(
  sceneIdx: number,
  editorScopeKey: string,
  preloadedRows?: UserTaskRow[]
): Promise<SceneModalSseTaskSnapshot | null> {
  const pid = creationStore.currentProjectId
  if (pid == null || !Number.isFinite(Number(pid)) || Number(pid) <= 0) return null

  const modalSourceImageIds = localSceneImages.value
    .map((img) =>
      Number((img as { rpsImageId?: number; id?: number })?.rpsImageId ?? (img as { id?: number })?.id)
    )
    .filter((id) => Number.isFinite(id) && id > 0)

  const rows = preloadedRows ?? (await fetchRecentProjectTaskRows(Number(pid)))
  for (const row of rows) {
    if (!row || !isTaskOngoingStatus(row.status)) continue
    if (!isFormCardImageTaskType(row.taskType)) continue

    const tid = Number(row.id)
    if (!Number.isFinite(tid) || tid <= 0) continue

    let snapshotRec: { inputSnapshot?: string | null; taskType?: string | null } = row
    if (!row.inputSnapshot) {
      try {
        snapshotRec = await userTaskDetail({ taskId: tid })
      } catch {
        /* keep list row */
      }
    }

    const batchImageIds = parseImageIdsFromTaskInputSnapshot(snapshotRec.inputSnapshot)
    const sourceImageId =
      batchImageIds.find((id) => modalSourceImageIds.includes(id)) ??
      parseImageIdFromTaskSnapshot(snapshotRec.inputSnapshot)
    if (sourceImageId == null) continue
    if (batchImageIds.length && !batchImageIds.includes(sourceImageId)) continue

    const imgIdx = resolveImageIdxByRpsImageId(sourceImageId)
    const rowAtIdx = localSceneImages.value[imgIdx] as { rpsImageId?: number } | undefined
    if (Number(rowAtIdx?.rpsImageId) !== sourceImageId) continue

    return {
      taskId: tid,
      taskKind: 'setting-card',
      sceneIdx,
      imageIdx: imgIdx,
      editorScopeKey,
      imageId: sourceImageId
    }
  }
  return null
}

async function resolveFallbackSceneModalSseTask(
  sceneIdx: number,
  editorScopeKey: string
): Promise<SceneModalSseTaskSnapshot | null> {
  const pid = creationStore.currentProjectId
  if (pid == null || !Number.isFinite(Number(pid)) || Number(pid) <= 0) return null

  const rows = await fetchRecentProjectTaskRows(Number(pid))
  const settingCardTask = await resolveOngoingSettingCardModalTask(sceneIdx, editorScopeKey, rows)
  if (settingCardTask) return settingCardTask

  const sessionTask = rebuildPersistedFromSession(sceneIdx)
  if (sessionTask) return sessionTask

  const formIds = collectModalFormIdsForSceneIndex(sceneIdx)
  if (!formIds.length) return null
  const formIdSet = new Set(formIds)

  for (const row of rows) {
    if (!row || !isTaskOngoingStatus(row.status)) continue
    const ty = normModalTaskType(row.taskType)
    if (
      ty !== 'form_edit_chat' &&
      ty !== 'form_multi_view' &&
      ty !== 'form_image' &&
      ty !== 'form_image_batch' &&
      ty !== 'image_upscale' &&
      ty !== 'form_card_image' &&
      ty !== 'form_card_image_batch'
    ) {
      continue
    }
    const tid = Number(row.id)
    if (!Number.isFinite(tid) || tid <= 0) continue

    let snapshotRec: { inputSnapshot?: string | null; taskType?: string | null } = row
    if (!row.inputSnapshot) {
      try {
        snapshotRec = await userTaskDetail({ taskId: tid })
      } catch {
        /* keep list row */
      }
    }
    if (!taskSnapshotMatchesModalFormIds(snapshotRec, formIdSet)) continue

    const matchedFormId =
      parseFormIdsFromTaskSnapshot(snapshotRec.inputSnapshot).find((id) => formIdSet.has(id)) ??
      parseFormIdFromTaskSnapshot(snapshotRec.inputSnapshot)

    const currentFormId = resolveFormIdForSceneIndex(sceneIdx)
    // 双保险：任务绑定的 formId 必须是当前 Tab 形态
    if (
      currentFormId != null &&
      matchedFormId != null &&
      Number(matchedFormId) !== Number(currentFormId)
    ) {
      continue
    }

    return {
      taskId: tid,
      taskKind: mapTaskTypeToModalKind(ty),
      sceneIdx,
      imageIdx: currentImageIndex.value >= 0 ? currentImageIndex.value : 0,
      editorScopeKey,
      formId: matchedFormId ?? formIds[0] ?? null
    }
  }
  return null
}

type GenericModalTaskFollowResult =
  | { ok: true; completeData?: unknown; eventType?: 'complete' | 'partial_failed' }
  | { ok: false; errorMessage: string; completeData?: unknown; deferred?: boolean }

const FORM_IMAGE_TASK_SETTLED_EVENT = 'create-flow-form-image-task-settled'

function resolveModalStep3Tab(): 'scene' | 'character' | 'prop' {
  if (props.imageType === 'scene') return 'scene'
  if (props.imageType === 'prop' || props.formParentAssetType === 'prop') return 'prop'
  return 'character'
}

/** 弹窗接管列表 SSE 后，终态须通知外层列表 finalize，否则卡片 loading 只清 Pinia、本地 ref 会残留 */
function notifyFormImageTaskSettledFromModal(payload: {
  taskId: number
  ok: boolean
  completeData?: unknown
  errorMessage?: string
  taskType?: string | null
  tab?: 'scene' | 'character' | 'prop'
}) {
  if (!import.meta.client) return
  const taskId = Number(payload.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) return
  const meta = getStep3FormImageTaskMeta(taskId)
  window.dispatchEvent(
    new CustomEvent(FORM_IMAGE_TASK_SETTLED_EVENT, {
      detail: {
        taskId,
        ok: payload.ok,
        completeData: payload.completeData,
        errorMessage: payload.errorMessage,
        taskType: payload.taskType ?? meta?.taskType ?? 'form_image',
        tab: payload.tab ?? meta?.tab ?? resolveModalStep3Tab()
      }
    })
  )
}

async function followGenericExtractTaskForModal(payload: {
  taskId: number
  onProgress?: (p: { percent?: number; stepTitle?: string; message?: string }) => void
}): Promise<GenericModalTaskFollowResult> {
  const taskId = Number(payload.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return { ok: false, errorMessage: '任务ID无效' }
  }

  try {
    const terminal = await waitUserTaskSseTerminal({
      taskId,
      onProgress: payload.onProgress
    })

    if (terminal.kind === 'superseded') {
      return { ok: false, errorMessage: 'Task SSE superseded', deferred: true }
    }

    if (terminal.kind === 'timeout') {
      return { ok: false, errorMessage: '生图任务超时，请在任务中心查看进度' }
    }

    const r = terminal.event
    if (r.type === 'complete' || r.type === 'partial_failed') {
      return { ok: true, completeData: r.data, eventType: r.type }
    }
    if (r.type === 'cancelled') {
      return { ok: false, errorMessage: r.message || '任务已取消' }
    }
    return { ok: false, errorMessage: r.errorMessage || '生图任务失败' }
  } catch (e: unknown) {
    return { ok: false, errorMessage: String((e as Error)?.message || '生图任务异常') }
  }
}

let resumeSceneModalFollowGen = 0
/** 值形如 `${projectId:episodeId}::${editorScopeKey}`，禁止裸 character-0 */
const activeSceneModalFollowScopeKeys = new Set<string>()
/** 本轮弹窗内 deferred 自动续跟次数；关弹窗 / 重开清零，防止 stream 风暴 */
const sceneModalDeferredRestoreAttempts = new Map<string, number>()
const sceneModalDeferredRestoreTimers = new Map<string, ReturnType<typeof setTimeout>>()

function currentModalLiveGenScopeKey(): string {
  return creationStore.step3GenVisualScopeKey()
}

function addModalFollowLock(editorScopeKey: string, liveGenScopeKey = currentModalLiveGenScopeKey()) {
  const key = buildModalFollowLockKey(liveGenScopeKey, editorScopeKey)
  if (key) activeSceneModalFollowScopeKeys.add(key)
}

function hasModalFollowLock(
  editorScopeKey: string,
  liveGenScopeKey = currentModalLiveGenScopeKey()
): boolean {
  const key = buildModalFollowLockKey(liveGenScopeKey, editorScopeKey)
  return !!key && activeSceneModalFollowScopeKeys.has(key)
}

function deleteModalFollowLock(
  editorScopeKey: string,
  liveGenScopeKey = currentModalLiveGenScopeKey()
) {
  const key = buildModalFollowLockKey(liveGenScopeKey, editorScopeKey)
  if (key) activeSceneModalFollowScopeKeys.delete(key)
}

function resetSceneModalDeferredRestoreState() {
  for (const timer of sceneModalDeferredRestoreTimers.values()) {
    clearTimeout(timer)
  }
  sceneModalDeferredRestoreTimers.clear()
  sceneModalDeferredRestoreAttempts.clear()
}

/**
 * deferred 统一收口，杜绝「删锁 + 立刻 restore」与新跟随互抢打爆 `/task/stream`。
 * @returns true = 已被继任跟随接管，调用方 finally 不得 endFollow / 删锁 / 清 overlay
 */
function handleDeferredSceneModalFollow(opts: {
  sceneIdx: number
  editorScopeKey: string
  liveGenScopeKey?: string
  errorMessage?: unknown
}): boolean {
  const liveGenScopeKey = opts.liveGenScopeKey || currentModalLiveGenScopeKey()
  const attemptKey = buildModalFollowLockKey(liveGenScopeKey, opts.editorScopeKey)
  const attemptCount = attemptKey ? sceneModalDeferredRestoreAttempts.get(attemptKey) ?? 0 : 0
  const decision = resolveDeferredModalFollowHandling({
    errorMessage: opts.errorMessage,
    restoreAttemptCount: attemptCount
  })

  if (decision.kind === 'superseded') {
    // 关窗主动 suspend 也会标 superseded：须 endFollow 交给外层，不能按「继任接管」让出
    return shouldRelinquishModalFollowOnDeferred({
      modalOpen: !!props.open,
      decisionKind: 'superseded'
    })
  }

  if (opts.editorScopeKey) {
    deleteModalFollowLock(opts.editorScopeKey, liveGenScopeKey)
  }

  if (decision.kind === 'stop' || !attemptKey || typeof window === 'undefined') {
    return false
  }

  sceneModalDeferredRestoreAttempts.set(attemptKey, attemptCount + 1)
  const delayMs = nextModalSseRestoreDelayMs({ attemptCount })
  const gen = resumeSceneModalFollowGen
  const prevTimer = sceneModalDeferredRestoreTimers.get(attemptKey)
  if (prevTimer) clearTimeout(prevTimer)
  const timer = setTimeout(() => {
    sceneModalDeferredRestoreTimers.delete(attemptKey)
    if (!props.open || gen !== resumeSceneModalFollowGen) return
    void restoreSceneModalSseIfNeeded(opts.sceneIdx)
  }, delayMs)
  sceneModalDeferredRestoreTimers.set(attemptKey, timer)
  return false
}

/** 仅当前作品 + 当前 editor 可见时写画布进度文案；Pinia 仍按任务归属 scope 更新 */
function applyCanvasProgressIfCurrent(opts: {
  liveGenScopeKey: string
  editorScopeKey: string
  text: string
}) {
  if (
    !shouldApplyModalTaskProgressToCanvas({
      taskLiveGenScopeKey: opts.liveGenScopeKey,
      currentLiveGenScopeKey: currentModalLiveGenScopeKey(),
      taskEditorScopeKey: opts.editorScopeKey,
      currentEditorScopeKey: buildEditorScopeKeyForSceneIndex(currentSceneIndex.value),
      modalOpen: props.open
    })
  ) {
    return
  }
  upscaleProgressText.value = opts.text
}

function persistSceneModalSseTask(
  sceneIdx: number,
  imageIdx: number,
  taskKind: SceneModalSseTaskKind,
  taskId: number,
  extra?: {
    formId?: number | null
    imageId?: number | null
    message?: string
    stepTitle?: string
  }
) {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return
  const liveGenScopeKey = currentModalLiveGenScopeKey()
  addModalFollowLock(editorScopeKey, liveGenScopeKey)
  const prev = resolvePersistedSceneModalSseTask(editorScopeKey)
  creationStore.setSceneModalSseTask(
    editorScopeKey,
    {
      taskId,
      taskKind,
      sceneIdx,
      imageIdx,
      editorScopeKey,
      formId: extra?.formId ?? resolveFormIdForSceneIndex(sceneIdx),
      imageId: extra?.imageId ?? null,
      ...(extra?.message ? { message: extra.message } : prev?.message ? { message: prev.message } : {}),
      ...(extra?.stepTitle
        ? { stepTitle: extra.stepTitle }
        : prev?.stepTitle
          ? { stepTitle: prev.stepTitle }
          : {})
    },
    liveGenScopeKey
  )
  persistSceneImageModalGenSession(
    editorScopeKey,
    sceneIdx,
    {
      taskKind,
      imageIdx,
      taskId
    },
    sceneModalSessionScope()
  )
  syncExternalGeneratingForModalScope(sceneIdx)
}

function beginCanvasTaskOverlay(
  sceneIdx: number,
  imgIdx: number,
  progressText: string,
  taskKind: SceneModalSseTaskKind | null = null
) {
  upscaleTargetKey.value = buildCanvasOverlayKey(sceneIdx, imgIdx)
  upscaleUiPhase.value = 'running'
  upscaleProgressText.value = progressText
  canvasOverlayTaskKind.value = taskKind
}

function endCanvasTaskOverlay(sceneIdx: number, imgIdx: number) {
  if (upscaleTargetKey.value === buildCanvasOverlayKey(sceneIdx, imgIdx)) {
    upscaleUiPhase.value = 'idle'
    upscaleTargetKey.value = ''
    upscaleProgressText.value = '高清处理中…'
    canvasOverlayTaskKind.value = null
  }
}

function defaultProgressTextForTaskKind(taskKind: SceneModalSseTaskKind): string {
  if (taskKind === 'upscale') return '高清处理中…'
  if (taskKind === 'multi-view') return '多机位生图中...'
  if (taskKind === 'form-image') return '正在生成形态图…'
  if (taskKind === 'setting-card') return '设定卡生成中…'
  if (taskKind === 'dialogue') return '对话作图中…'
  return '生图中…'
}

function readSessionForScene(sceneIdx: number) {
  const session = readSceneImageModalGenSession(sceneModalSessionScope())
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!session || session.editorScopeKey !== editorScopeKey) return null
  return session
}

function removeLocalGeneratingPlaceholders(images: any[]): any[] {
  return images.filter((img) => !img?._localGeneratingPlaceholder)
}

function clearLocalGeneratingPlaceholders() {
  const next = removeLocalGeneratingPlaceholders(localSceneImages.value)
  if (next.length !== localSceneImages.value.length) {
    localSceneImages.value = next
    if (currentImageIndex.value >= next.length) {
      currentImageIndex.value = Math.max(0, next.length - 1)
    }
  }
}

/** SSE 终态（含 error）后统一清除 Tab / 生成记录 / 外层列表 loading */
function clearSceneModalGeneratingUi(sceneIdx: number) {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (editorScopeKey) deleteModalFollowLock(editorScopeKey)
  clearLocalGeneratingPlaceholders()
  clearExternalGeneratingForModalScope(sceneIdx)
  emitSceneTabUpdate(buildVisibleImagesForParent(), sceneIdx)
}

function ensureGeneratingPlaceholderImage(sceneIdx: number) {
  if (sceneIdx !== currentSceneIndex.value) return
  const images = [...localSceneImages.value]
  const pendingIdx = images.findIndex((img) => img?._generating)
  if (pendingIdx >= 0) {
    currentImageIndex.value = pendingIdx
    return
  }
  images.push({
    id: `local-generating-${buildEditorScopeKeyForSceneIndex(sceneIdx)}-${Date.now()}`,
    url: '',
    thumbnail: '',
    title: '生成中',
    _generating: true,
    _localGeneratingPlaceholder: true
  })
  localSceneImages.value = images
  currentImageIndex.value = images.length - 1
}

function finalizeLocalImagesWhileGenerating(mapped: any[]): any[] {
  let next = removeLocalGeneratingPlaceholders(mapped)
  if (next.some((m) => m?._generating)) {
    return next
  }

  const editorScopeKey = buildEditorScopeKeyForSceneIndex(currentSceneIndex.value)
  if (!editorScopeKey || isSceneImageModalUserDismissed(editorScopeKey, sceneModalSessionScope())) {
    return next
  }

  if (!isSceneModalImageGenerating(currentSceneIndex.value)) {
    return next
  }

  return [
    ...next,
    {
      id: `local-generating-${editorScopeKey}-${Date.now()}`,
      url: '',
      thumbnail: '',
      title: '生成中',
      _generating: true,
      _localGeneratingPlaceholder: true
    }
  ]
}

function isSceneModalImageGenerating(sceneIdx: number): boolean {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return false
  if (isSceneImageModalUserDismissed(editorScopeKey, sceneModalSessionScope())) return false

  if (hasModalFollowLock(editorScopeKey)) return true

  if (readSessionForScene(sceneIdx)?.taskId) return true

  const persisted = resolvePersistedSceneModalSseTask(editorScopeKey)
  if (persisted) return true

  if (isEditorScopeGeneratingExternally(sceneIdx)) return true

  if (sceneIdx === currentSceneIndex.value) {
    return localSceneImages.value.some((img) => img?._generating)
  }
  return false
}

function isHistoryItemMain(imageIndex: number): boolean {
  const img = localSceneImages.value[imageIndex] as { _isSet?: boolean } | undefined
  return img?._isSet === true
}

function canSetMainFromHistory(imageIndex: number): boolean {
  const img = localSceneImages.value[imageIndex] as { url?: string } | undefined
  if (!img?.url || isHistoryItemGenerating(imageIndex) || isHistoryItemMain(imageIndex)) return false
  return true
}

async function handleSetMainFromHistory(imageIndex: number) {
  if (isAddingSceneImage.value) return
  currentImageIndex.value = imageIndex
  await handleAddSceneImage()
}

function isHistoryItemGenerating(imageIndex: number): boolean {
  const sceneIdx = currentSceneIndex.value
  if (!isSceneModalImageGenerating(sceneIdx)) return false

  const pendingIdx = currentSceneImages.value.findIndex((item) => item?._generating)
  if (pendingIdx >= 0) return imageIndex === pendingIdx

  const img = currentSceneImages.value[imageIndex]
  if (img?._generating) return true
  if (isCanvasTaskOverlayActive(sceneIdx, imageIndex)) return true

  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  const task = editorScopeKey ? resolvePersistedSceneModalSseTask(editorScopeKey) : null
  if (task) {
    const targetIdx = task.imageIdx ?? currentImageIndex.value
    return imageIndex === targetIdx
  }

  if (isEditorScopeGeneratingExternally(sceneIdx)) {
    return imageIndex === currentImageIndex.value
  }
  return false
}

function syncSceneModalSseProgress(
  snap: SceneModalSseTaskSnapshot,
  p: { message?: string; stepTitle?: string },
  liveGenScopeKey: string = currentModalLiveGenScopeKey()
) {
  if (!snap.editorScopeKey) return
  creationStore.setSceneModalSseTask(
    snap.editorScopeKey,
    {
      ...snap,
      ...(String(p.message ?? '').trim() ? { message: String(p.message).trim() } : {}),
      ...(String(p.stepTitle ?? '').trim() ? { stepTitle: String(p.stepTitle).trim() } : {})
    },
    liveGenScopeKey
  )
}

function primeSceneModalLoadingUi(sceneIdx: number) {
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey || isSceneImageModalUserDismissed(editorScopeKey, sceneModalSessionScope())) return

  const persisted = resolvePersistedSceneModalSseTask(editorScopeKey)
  const session = readSessionForScene(sceneIdx)
  const external = isEditorScopeGeneratingExternally(sceneIdx)
  const hasSessionTask = !!(session?.taskId)

  if (
    !persisted &&
    !external &&
    !hasSessionTask &&
    !hasModalFollowLock(editorScopeKey)
  ) {
    return
  }

  if (persisted) {
    if (persisted.taskKind === 'dialogue') {
      leftActiveTab.value = 'dialogue'
    } else if (persisted.taskKind === 'edit-image') {
      leftActiveTab.value = 'generate'
    }
    const imageIdx = persisted.imageIdx ?? session?.imageIdx ?? currentImageIndex.value
    if (sceneIdx === currentSceneIndex.value) {
      currentImageIndex.value = imageIdx
    }
    beginCanvasTaskOverlay(
      sceneIdx,
      imageIdx,
      formatTaskSseLiveText(persisted, defaultProgressTextForTaskKind(persisted.taskKind)),
      persisted.taskKind
    )
  } else if (session?.taskKind === 'dialogue') {
    leftActiveTab.value = 'dialogue'
  } else if (session?.taskKind === 'edit-image') {
    leftActiveTab.value = 'generate'
  }

  if (sceneIdx === currentSceneIndex.value) {
    const hasGeneratingRow = localSceneImages.value.some((img) => img?._generating)
    if (!hasGeneratingRow && (persisted || external)) {
      ensureGeneratingPlaceholderImage(sceneIdx)
    }
  }
}

async function ensureModalLoadingRestored(sceneIdx: number) {
  await waitForCreationStoreHydrated(creationStore, route)
  applyStep3GenVisualFromRoute(creationStore, route)
  await clearStaleSceneModalGeneratingState(sceneIdx)
  primeSceneModalLoadingUi(sceneIdx)
}

function sceneModalTaskKindToAutoUseType(taskKind: SceneModalSseTaskKind): string | null {
  if (taskKind === 'edit-image' || taskKind === 'dialogue') return 'form_edit_chat'
  if (taskKind === 'form-image') return 'form_image'
  if (taskKind === 'multi-view') return 'form_multi_view'
  if (taskKind === 'setting-card') return 'form_card_image_batch'
  return null
}

async function claimFormImagesFromSceneModalTaskResult(
  taskKind: SceneModalSseTaskKind,
  result: unknown
): Promise<void> {
  const taskType = sceneModalTaskKindToAutoUseType(taskKind)
  if (!taskType) return
  if (taskKind === 'edit-image' || taskKind === 'dialogue') {
    const r = result as Awaited<ReturnType<typeof followEditImageTask>>
    if (r.ok === false) return
    await claimFormImagesForModal(taskType, { items: r.items })
    return
  }
  if (taskKind === 'multi-view') {
    const r = result as Awaited<ReturnType<typeof followMultiViewImageTask>>
    if (r.ok === false) return
    await claimFormImagesForModal(taskType, { imageId: r.imageId })
    return
  }
  if (taskKind === 'setting-card') {
    const r = result as Awaited<ReturnType<typeof followFormImageGenerateCardTask>>
    if (r.ok === false) return
    if (r.imageId != null) {
      await claimFormImagesForModal(taskType, { imageId: r.imageId })
    }
  }
}

async function applySettingCardGenerateSuccess(
  result: { imageUrl: string; imageId: number | null },
  opts?: { silentComplete?: boolean; skipClaim?: boolean }
) {
  if (!opts?.skipClaim && result.imageId != null) {
    await claimFormImagesForModal('form_card_image_batch', { imageId: result.imageId })
  }
  await refreshFormImageListAfterTask(result.imageId, { imageUrl: result.imageUrl })
  let idx = localSceneImages.value.findIndex((x: any) => {
    const byId =
      result.imageId != null &&
      Number.isFinite(result.imageId) &&
      Number(x?.rpsImageId) === result.imageId
    const byUrl = String(x?.url || '').trim() === result.imageUrl
    return byId || byUrl
  })
  if (idx < 0) {
    idx = appendSettingCardToLocalListIfMissing({
      imageId: result.imageId,
      imageUrl: result.imageUrl,
      title: '角色设定卡'
    })
  }
  if (idx >= 0) currentImageIndex.value = idx
  emitSceneTabUpdate(buildVisibleImagesForParent())
  if (!opts?.silentComplete) message.success('角色设定卡已生成')
}

async function resolveSettingCardFollowResult(
  taskId: number,
  result: Awaited<ReturnType<typeof followFormImageGenerateCardTask>>
): Promise<Awaited<ReturnType<typeof followFormImageGenerateCardTask>>> {
  if (result.ok) return result
  const recovered = await recoverFormImageGenerateCardResultFromDetail(taskId)
  if (recovered?.ok) return recovered
  return result
}

function notifyFormCardBatchSettled(sourceImageIds: number[]) {
  if (!import.meta.client) return
  window.dispatchEvent(
    new CustomEvent('create-flow-form-card-batch-settled', {
      detail: { sourceImageIds }
    })
  )
}

function isDeferredModalFollowResult(result: unknown): boolean {
  return (
    !!result &&
    typeof result === 'object' &&
    (result as { ok?: unknown }).ok === false &&
    (result as { deferred?: unknown }).deferred === true
  )
}

async function applySceneModalSseTaskResult(
  snap: SceneModalSseTaskSnapshot,
  result: unknown,
  opts?: { silentComplete?: boolean }
): Promise<number[] | undefined> {
  const { sceneIdx, imageIdx, taskKind } = snap
  const scopeKey = snap.editorScopeKey

  if (isDeferredModalFollowResult(result)) {
    return undefined
  }

  if (taskKind === 'edit-image' || taskKind === 'dialogue') {
    const r = result as Awaited<ReturnType<typeof followEditImageTask>>
    if (r.ok === false) {
      if (!opts?.silentComplete) message.error(r.errorMessage || '生图失败')
      clearSceneModalGeneratingUi(sceneIdx)
      return undefined
    }
    await claimFormImagesFromSceneModalTaskResult(taskKind, r)
    await refreshAfterEditChatGenerate(r.items)
    clearSceneModalGeneratingUi(sceneIdx)
    if (!opts?.silentComplete) message.success('生图完成')
    return undefined
  }

  if (taskKind === 'form-image') {
    const r = result as GenericModalTaskFollowResult
    if (r.ok === false) {
      if (!opts?.silentComplete) message.error(r.errorMessage || '生图失败')
      clearSceneModalGeneratingUi(sceneIdx)
      notifyFormImageTaskSettledFromModal({
        taskId: snap.taskId,
        ok: false,
        completeData: r.completeData,
        errorMessage: r.errorMessage || '生图失败',
        taskType: 'form_image'
      })
      return undefined
    }
    await initFormImageListOnOpen()
    emitSceneTabUpdate(buildVisibleImagesForParent())
    clearSceneModalGeneratingUi(sceneIdx)
    notifyFormImageTaskSettledFromModal({
      taskId: snap.taskId,
      ok: true,
      completeData: r.completeData,
      taskType: r.eventType === 'partial_failed' ? 'form_image_batch' : 'form_image'
    })
    if (!opts?.silentComplete) message.success('生图完成')
    return undefined
  }

  if (taskKind === 'upscale') {
    const r = result as Awaited<ReturnType<typeof followFormImageUpscaleTask>>
    if (r.ok === false) {
      if (!opts?.silentComplete) message.error(r.errorMessage || '高清任务失败')
      clearSceneModalGeneratingUi(sceneIdx)
      return undefined
    }
    if (
      isSameModalScope({ editorScopeKey: scopeKey, assetId: activeRpsAssetId.value }) &&
      currentSceneIndex.value === sceneIdx &&
      localSceneImages.value[imageIdx]
    ) {
      const row = localSceneImages.value[imageIdx] as any
      row.url = r.imageUrl
      row.thumbnail = r.imageUrl
      localSceneImages.value = [...localSceneImages.value]
      emitSceneTabUpdate(buildVisibleImagesForParent())
    }
    clearSceneModalGeneratingUi(sceneIdx)
    if (!opts?.silentComplete) message.success('高清处理完成')
    return undefined
  }

  if (taskKind === 'multi-view') {
    const r = result as Awaited<ReturnType<typeof followMultiViewImageTask>>
    if (r.ok === false) {
      if (!opts?.silentComplete) message.error(r.errorMessage || '多机位生图失败')
      clearSceneModalGeneratingUi(sceneIdx)
      return undefined
    }
    await claimFormImagesFromSceneModalTaskResult(taskKind, r)
    await refreshFormImageListAfterTask(r.imageId)
    clearSceneModalGeneratingUi(sceneIdx)
    if (!opts?.silentComplete) message.success('多机位生图完成')
    return undefined
  }

  if (taskKind === 'setting-card') {
    const taskId = snap.taskId
    let r = await resolveSettingCardFollowResult(
      taskId,
      result as Awaited<ReturnType<typeof followFormImageGenerateCardTask>>
    )
    let sourceImageIds: number[] = []
    try {
      const detail = await userTaskDetail({ taskId })
      sourceImageIds = parseImageIdsFromTaskInputSnapshot(detail?.inputSnapshot)
      if (detail?.resultData != null) {
        await claimFormImagesForModal('form_card_image_batch', detail.resultData)
      }
    } catch {
      /* ignore */
    }
    if (!sourceImageIds.length && snap.imageId != null) {
      const single = Number(snap.imageId)
      if (Number.isFinite(single) && single > 0) sourceImageIds = [single]
    }

    if (r.ok === false) {
      if (!opts?.silentComplete) message.error(r.errorMessage || '设定卡生成失败')
      clearSceneModalGeneratingUi(sceneIdx)
      return sourceImageIds
    }

    if (r.imageUrl) {
      await applySettingCardGenerateSuccess(
        { imageUrl: r.imageUrl, imageId: r.imageId ?? null },
        { ...opts, silentComplete: true, skipClaim: true }
      )
    } else {
      await initFormImageListOnOpen()
      emitSceneTabUpdate(buildVisibleImagesForParent())
      if (!opts?.silentComplete) message.success('角色设定卡已生成')
    }

    clearSceneModalGeneratingUi(sceneIdx)
    return sourceImageIds
  }

  return undefined
}

async function runSceneModalSseFollow(
  snap: SceneModalSseTaskSnapshot,
  opts?: { silentComplete?: boolean }
) {
  const { sceneIdx, imageIdx, taskKind, taskId, editorScopeKey } = snap
  /** 任务归属作品/集：切项目后仍用此键写 Pinia / 释放锁，避免串桶 */
  const liveGenScopeKey = currentModalLiveGenScopeKey()
  const currentEditorScopeKey = buildEditorScopeKeyForSceneIndex(currentSceneIndex.value)
  if (
    !shouldAllowModalTabSseConnect({
      currentTabKey: currentEditorScopeKey,
      targetTabKey: editorScopeKey
    })
  ) {
    return
  }

  const lockKey = buildModalFollowLockKey(liveGenScopeKey, editorScopeKey)
  if (!editorScopeKey || !tryAcquireModalFollowLock(activeSceneModalFollowScopeKeys, lockKey)) {
    return
  }

  const gate = tryAcquireStep3SseSlot({
    taskId,
    owner: 'modal',
    allowPreemptOuter: true
  })
  if (gate.kind === 'enqueued' || gate.kind === 'rejected') {
    deleteModalFollowLock(editorScopeKey, liveGenScopeKey)
    return
  }
  if (gate.kind === 'preempt' && import.meta.client) {
    suspendTaskSseFollow(gate.releaseTaskId)
    window.dispatchEvent(
      new CustomEvent('create-flow-stop-task', {
        detail: { taskId: gate.releaseTaskId, silent: true }
      })
    )
  }

  creationStore.beginStep3FormImageTaskFollow(taskId)

  if (import.meta.client) {
    window.dispatchEvent(
      new CustomEvent('create-flow-stop-task', { detail: { taskId, silent: true } })
    )
  }

  beginCanvasTaskOverlay(
    sceneIdx,
    imageIdx,
    taskKind === 'upscale'
      ? '高清处理中…'
      : taskKind === 'multi-view'
        ? '多机位生图中...'
        : taskKind === 'form-image'
          ? '正在生成形态图…'
          : taskKind === 'setting-card'
            ? '设定卡生成中…'
            : '生图中...',
    taskKind
  )

  let result: unknown
  /** superseded 时锁/follow/overlay 归继任跟随，本路 finally 不得回收 */
  let relinquishedToSuccessor = false
  try {
    if (taskKind === 'edit-image' || taskKind === 'dialogue') {
      result = await followEditImageTask({
        taskId,
        onProgress: (p) => {
          syncSceneModalSseProgress(snap, p, liveGenScopeKey)
          applyCanvasProgressIfCurrent({
            liveGenScopeKey,
            editorScopeKey,
            text: formatCreationImageProgressText(p)
          })
          if (
            p.items?.length &&
            shouldApplyModalTaskProgressToCanvas({
              taskLiveGenScopeKey: liveGenScopeKey,
              currentLiveGenScopeKey: currentModalLiveGenScopeKey(),
              taskEditorScopeKey: editorScopeKey,
              currentEditorScopeKey: buildEditorScopeKeyForSceneIndex(currentSceneIndex.value),
              modalOpen: props.open
            })
          ) {
            void claimFormImagesForModal('form_edit_chat', { items: p.items }).then(async () => {
              const focusId = p.items![p.items!.length - 1]?.imageId ?? null
              await initFormImageListOnOpen({ focusImageId: focusId })
              emitSceneTabUpdate(buildVisibleImagesForParent())
            })
          }
        }
      })
    } else if (taskKind === 'form-image') {
      result = await followGenericExtractTaskForModal({
        taskId,
        onProgress: (p) => {
          syncSceneModalSseProgress(snap, p, liveGenScopeKey)
          applyCanvasProgressIfCurrent({
            liveGenScopeKey,
            editorScopeKey,
            text: formatTaskSseJoinedLiveText(p, '正在生成形态图…')
          })
        }
      })
    } else if (taskKind === 'upscale') {
      result = await followFormImageUpscaleTask({
        taskId,
        onProgress: (p) => {
          syncSceneModalSseProgress(snap, p, liveGenScopeKey)
          applyCanvasProgressIfCurrent({
            liveGenScopeKey,
            editorScopeKey,
            text: formatTaskSseJoinedLiveText(p, '高清处理中…')
          })
        }
      })
    } else if (taskKind === 'multi-view') {
      result = await followMultiViewImageTask({
        taskId,
        onProgress: (p) => {
          syncSceneModalSseProgress(snap, p, liveGenScopeKey)
          applyCanvasProgressIfCurrent({
            liveGenScopeKey,
            editorScopeKey,
            text: formatTaskSseJoinedLiveText(p, '多机位生图中...')
          })
        }
      })
    } else if (taskKind === 'setting-card') {
      result = await followFormImageGenerateCardTask({
        taskId,
        onProgress: (p) => {
          syncSceneModalSseProgress(snap, p, liveGenScopeKey)
          applyCanvasProgressIfCurrent({
            liveGenScopeKey,
            editorScopeKey,
            text: formatTaskSseJoinedLiveText(p, '设定卡生成中…')
          })
        }
      })
    } else {
      result = { ok: false as const, errorMessage: '未知任务类型' }
    }

    if (isDeferredModalFollowResult(result)) {
      relinquishedToSuccessor = handleDeferredSceneModalFollow({
        sceneIdx,
        editorScopeKey,
        liveGenScopeKey,
        errorMessage: (result as { errorMessage?: unknown }).errorMessage
      })
      return
    }

    const settingCardSourceIds = await applySceneModalSseTaskResult(snap, result, opts)
    creationStore.clearSceneModalSseTask(editorScopeKey, liveGenScopeKey)
    clearSceneImageModalGenSession(
      modalGenSessionScopeFromScopeKey(liveGenScopeKey) ?? sceneModalSessionScope()
    )
    if (settingCardSourceIds !== undefined) {
      notifyFormCardBatchSettled(settingCardSourceIds)
      creationStore.refreshStep3VisualGeneratingFlag()
    }
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  } finally {
    if (!relinquishedToSuccessor) {
      creationStore.endStep3FormImageTaskFollow(taskId)
    }
    if (!isDeferredModalFollowResult(result) && !relinquishedToSuccessor) {
      deleteModalFollowLock(editorScopeKey, liveGenScopeKey)
      endCanvasTaskOverlay(sceneIdx, imageIdx)
      if (hasStep3SseSlot(taskId)) {
        releaseStep3SseSlot(taskId)
        drainStep3SseQueue((item) => {
          if (item.owner === 'modal') {
            requeueStep3SseItemToEnd(item)
            return { kind: 'skipped' as const }
          }
          const acq = tryAcquireStep3SseSlot({ taskId: item.taskId, owner: 'outer' })
          if (acq.kind !== 'acquired' && acq.kind !== 'already-active') return acq
          if (import.meta.client) {
            window.dispatchEvent(
              new CustomEvent('create-flow-track-task', {
                detail: { taskId: item.taskId }
              })
            )
          }
          return acq
        })
      }
    }
    creationStore.refreshStep3VisualGeneratingFlag()
  }
}

async function applyTerminalSceneModalTaskIfNeeded(
  persisted: SceneModalSseTaskSnapshot,
  editorScopeKey: string
): Promise<boolean> {
  try {
    const detail = await userTaskDetailCached(persisted.taskId)
    if (!detail || !isTerminalUserTaskStatus(detail.status)) return false

    const st = String(detail.status || '').toUpperCase()
    let settingCardSourceIds: number[] | undefined
    if (st === 'SUCCEEDED' && persisted.taskKind === 'setting-card') {
      let cardResult = await resolveSettingCardFollowResult(persisted.taskId, {
        ok: false as const,
        errorMessage: '设定卡生成失败'
      })
      if (cardResult.ok) {
        settingCardSourceIds = await applySceneModalSseTaskResult(persisted, cardResult, {
          silentComplete: true
        })
      } else {
        const parsed = parseSettingCardResultData(detail.resultData)
        if (parsed?.imageUrl) {
          settingCardSourceIds = await applySceneModalSseTaskResult(
            persisted,
            { ok: true as const, imageUrl: parsed.imageUrl, imageId: parsed.imageId },
            { silentComplete: true }
          )
        }
      }
    } else if (st === 'SUCCEEDED' || st === 'PARTIAL_FAILED') {
      await claimFormImagesForModal(
        sceneModalTaskKindToAutoUseType(persisted.taskKind) ?? detail.taskType,
        detail.resultData
      )
      await initFormImageListOnOpen()
      emitSceneTabUpdate(buildVisibleImagesForParent())
      clearSceneModalGeneratingUi(persisted.sceneIdx)
      if (persisted.taskKind === 'form-image') {
        notifyFormImageTaskSettledFromModal({
          taskId: persisted.taskId,
          ok: true,
          completeData: detail.resultData,
          taskType: detail.taskType ?? 'form_image'
        })
      }
    } else {
      clearSceneModalGeneratingUi(persisted.sceneIdx)
      if (persisted.taskKind === 'form-image') {
        notifyFormImageTaskSettledFromModal({
          taskId: persisted.taskId,
          ok: false,
          completeData: detail.resultData,
          errorMessage: '生图失败',
          taskType: detail.taskType ?? 'form_image'
        })
      }
    }

    creationStore.clearSceneModalSseTask(editorScopeKey)
    clearSceneImageModalGenSession(sceneModalSessionScope())
    endCanvasTaskOverlay(persisted.sceneIdx, persisted.imageIdx)
    if (settingCardSourceIds !== undefined) {
      notifyFormCardBatchSettled(settingCardSourceIds)
      creationStore.refreshStep3VisualGeneratingFlag()
    }
    return true
  } catch {
    return false
  }
}

async function restoreSceneModalSseIfNeeded(sceneIdx: number) {
  if (!props.open) return
  const editorScopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
  if (!editorScopeKey) return

  await ensureModalLoadingRestored(sceneIdx)

  if (hasModalFollowLock(editorScopeKey)) return

  const gen = ++resumeSceneModalFollowGen

  let persisted =
    resolvePersistedSceneModalSseTask(editorScopeKey) ??
    rebuildPersistedFromSession(sceneIdx) ??
    (await resolveFallbackSceneModalSseTask(sceneIdx, editorScopeKey))

  if (gen !== resumeSceneModalFollowGen) return
  if (!persisted) {
    await clearStaleSceneModalGeneratingState(sceneIdx)
    if (isEditorScopeGeneratingExternally(sceneIdx)) {
      primeSceneModalLoadingUi(sceneIdx)
    }
    return
  }

  if (!creationStore.getSceneModalSseTask(editorScopeKey)) {
    creationStore.setSceneModalSseTask(editorScopeKey, persisted)
  }
  syncExternalGeneratingForModalScope(sceneIdx)

  const pendingIdx = localSceneImages.value.findIndex((img) => img?._generating)
  if (pendingIdx >= 0) {
    persisted = { ...persisted, imageIdx: pendingIdx }
    creationStore.setSceneModalSseTask(editorScopeKey, persisted)
    if (sceneIdx === currentSceneIndex.value) {
      currentImageIndex.value = pendingIdx
    }
  } else if (sceneIdx === currentSceneIndex.value && persisted.imageIdx >= 0) {
    currentImageIndex.value = persisted.imageIdx
  }

  primeSceneModalLoadingUi(sceneIdx)

  const terminalHandled = await applyTerminalSceneModalTaskIfNeeded(persisted, editorScopeKey)
  if (gen !== resumeSceneModalFollowGen) return
  if (terminalHandled) return

  await runSceneModalSseFollow(persisted, { silentComplete: true })
}

const isSceneSplitting = ref(false)
const sceneSplitTargetKey = ref('')
const sceneSplitProgressText = ref('正在拆分四宫格…')

/** 仅当前画布条目展示拆分 loading，避免切 Tab/换图后按钮仍转圈挡住其它入口 */
const showSceneSplitOverlay = computed(() => {
  if (!isSceneSplitting.value) return false
  return (
    sceneSplitTargetKey.value ===
    buildCanvasOverlayKey(currentSceneIndex.value, currentImageIndex.value)
  )
})

const showSceneSplitToolbarLoading = computed(() => showSceneSplitOverlay.value)

/** 场景图：中间工具栏「拆分四宫格」— 后端切图、上传 OSS 并入库 */
async function handleSceneSplitFourGrid(index: number) {
  if (!isSceneEditMode.value) return
  if (isSceneSplitting.value) return

  const img = currentSceneImages.value[index] as {
    url?: string
    title?: string
    name?: string
    _pending?: boolean
    rpsImageId?: number
    canSplit?: boolean
  } | undefined

  if (!img?.url) {
    message.warning('请先选择一张可用图片')
    return
  }
  if (img._pending) {
    message.warning(`请先完成「${addImageButtonLabel.value}」后再拆分`)
    return
  }

  currentImageIndex.value = index
  const sceneIdx = currentSceneIndex.value
  sceneSplitTargetKey.value = buildCanvasOverlayKey(sceneIdx, index)
  isSceneSplitting.value = true
  sceneSplitProgressText.value = '正在准备…'

  try {
    let sourceImageId = resolveRpsImageIdFromLocalImage(img)
    if (sourceImageId == null) {
      sceneSplitProgressText.value = '正在同步图片信息…'
      const syncResult = await syncImageToRpsApi(
        String(img.url).trim(),
        String(img.title || img.name || ''),
        resolveRpsSourceType(img),
        img
      )
      if (syncResult?.imageId != null) {
        img.rpsImageId = syncResult.imageId
        sourceImageId = syncResult.imageId
      }
    }
    if (sourceImageId == null) {
      message.warning('当前图片尚未同步到服务端，无法拆分')
      return
    }

    const projectId = Number(creationStore.currentProjectId)
    if (!Number.isFinite(projectId) || projectId <= 0) {
      message.warning('项目信息缺失，无法拆分')
      return
    }

    sceneSplitProgressText.value = '正在拆分四宫格…'
    const result = await userAssetRpsFormImageSceneSplit({ projectId, sourceImageId })

    lastInitFormImageListKey = ''
    await initFormImageListOnOpen()

    const firstChildId = result.children?.[0]?.id
    if (firstChildId != null) {
      const childIdx = localSceneImages.value.findIndex(
        (x: { rpsImageId?: number }) => Number(x?.rpsImageId) === Number(firstChildId)
      )
      if (childIdx >= 0) currentImageIndex.value = childIdx
    }

    emitSceneTabUpdate(buildVisibleImagesForParent())
    message.success('四宫格拆分完成，已加入左侧列表')
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '四宫格拆分失败')
  } finally {
    isSceneSplitting.value = false
    sceneSplitTargetKey.value = ''
    sceneSplitProgressText.value = '正在拆分四宫格…'
  }
}

/** 场景 / 道具 / 形态(form) 等：中间工具栏进入右侧「对话作图」并带入当前图为参考 */
function handleDialogueImage(index: number) {
  leftActiveTab.value = 'dialogue'
  currentImageIndex.value = index
  const img = currentSceneImages.value[index]
  if (img && img.url) {
    const existed = dialogueSourceImages.value.some((item) => item.url === img.url)
    if (!existed) {
      dialogueSourceImages.value = [
        ...dialogueSourceImages.value,
        { url: img.url, title: img.title || img.name }
      ]
    }
    message.info('已切换到对话作图，并添加当前图片为参考图')
  } else {
    message.info('已切换到对话作图')
  }
}

async function handleSettingCardSelect(payload: {
  agentCode?: string
  modelCode?: string
  imageIndex: number
}) {
  if (!isSettingCardTypeSupported.value) {
    message.warning('设定卡生成仅支持角色形态')
    return
  }
  if (!whiteBaseImageReadyForSettingCard.value) {
    message.warning('请先在列表中点击自动生成按钮生成图片以后再进行操作')
    return
  }

  const agentCode = String(payload.agentCode || '').trim()
  const modelCode = String(payload.modelCode || '').trim()
  if (!agentCode && !modelCode) {
    message.warning('请选择智能体')
    return
  }

  const sceneIdx = currentSceneIndex.value
  const imgIdx = payload.imageIndex
  const img = currentSceneImages.value[imgIdx] as { rpsImageId?: number } | undefined
  const imageId = Number(img?.rpsImageId)
  if (!Number.isFinite(imageId) || imageId <= 0) {
    message.warning('图片ID不能为空')
    return
  }

  beginCanvasTaskOverlay(sceneIdx, imgIdx, '设定卡生成中…', 'setting-card')
  let submittedTaskId: number | null = null
  /** SSE 被新跟随抢占时保留 overlay / Pinia，交由 restore 续跟 */
  let deferOverlayCleanup = false
  const liveScope = captureCreationLiveGenScope()
  try {
    const scopeKey = buildEditorScopeKeyForSceneIndex(sceneIdx)
    let res = await runFormImageGenerateCardTask({
      imageId,
      projectId: creationStore.currentProjectId,
      ...(agentCode ? { agentCode } : {}),
      ...(modelCode ? { modelCode } : {}),
      onSubmitted: ({ taskId }) => {
        submittedTaskId = taskId
        persistSceneModalSseTask(sceneIdx, imgIdx, 'setting-card', taskId, { imageId })
      },
      onProgress: (p) => {
        applyCanvasProgressIfCurrent({
          liveGenScopeKey: liveScope.scopeKey,
          editorScopeKey: scopeKey,
          text: formatTaskSseJoinedLiveText(p, '设定卡生成中…')
        })
      }
    })
    if (res.ok === false && submittedTaskId != null) {
      res = await resolveSettingCardFollowResult(submittedTaskId, res)
    }
    if (isDeferredModalFollowResult(res)) {
      deferOverlayCleanup = true
      if (scopeKey) {
        handleDeferredSceneModalFollow({
          sceneIdx,
          editorScopeKey: scopeKey,
          liveGenScopeKey: liveScope.scopeKey,
          errorMessage: (res as { errorMessage?: unknown }).errorMessage
        })
      }
      return
    }
    if (res.ok === false) {
      if (scopeKey) creationStore.clearSceneModalSseTask(scopeKey)
      clearSceneImageModalGenSession(sceneModalSessionScope())
      clearSceneModalGeneratingUi(sceneIdx)
      message.error(res.errorMessage)
      return
    }
    if (!res.imageUrl) {
      if (scopeKey) creationStore.clearSceneModalSseTask(scopeKey)
      clearSceneModalGeneratingUi(sceneIdx)
      message.success('角色设定卡已生成')
      return
    }
    if (scopeKey) creationStore.clearSceneModalSseTask(scopeKey)
    await applySettingCardGenerateSuccess({
      imageUrl: res.imageUrl,
      imageId: res.imageId ?? null
    })
    clearSceneModalGeneratingUi(sceneIdx)
  } finally {
    if (!deferOverlayCleanup) {
      endCanvasTaskOverlay(sceneIdx, imgIdx)
    }
  }
}

const handleUpscaleModelSelect = async (payload: {
  modelCode: string
  resolution: string
  imageIndex: number
}) => {
  const sceneIdx = currentSceneIndex.value
  const index = payload.imageIndex
  const img = currentSceneImages.value[index] as any
  if (!img?.url) {
    message.warning('请先选择一张可用图片')
    return
  }
  const rid = Number(img?.rpsImageId)
  let imageId: number | null = Number.isFinite(rid) && rid > 0 ? rid : null
  if (imageId == null) {
    imageId = await resolveImageIdFromFormImageList({
      formId: img?.rpsFormId,
      imageId: img?.rpsImageId,
      imageUrl: img?.url,
      imageTitle: img?.title || img?.name
    })
  }
  if (imageId == null || !Number.isFinite(imageId)) {
    message.error('未找到形态图实例 ID，无法提交高清任务（请确认已同步到个人资产形态图）')
    return
  }

  /** 剧集隔离：任务归属启动时作品/集；切集后终态收尾不得写当前集 store、不得 toast */
  const liveScope = captureCreationLiveGenScope()

  beginCanvasTaskOverlay(sceneIdx, index, '正在提交高清任务…', 'upscale')
  const scenesSnapshot = cloneScenesForTask()
  upscaleContext.value = {
    sceneIndex: sceneIdx,
    imageIndex: index,
    editorScopeKey: buildEditorScopeKeyForSceneIndex(sceneIdx),
    assetId: activeRpsAssetId.value
  }

  let upscaleResult: Awaited<ReturnType<typeof runFormImageUpscaleTask>>
  try {
    upscaleResult = await runFormImageUpscaleTask({
      imageId,
      modelCode: payload.modelCode,
      resolution: payload.resolution,
      onSubmitted: ({ taskId }) => {
        persistSceneModalSseTask(sceneIdx, index, 'upscale', taskId, { imageId })
      },
      onProgress: (p) => {
        const editorScopeKey = upscaleContext.value?.editorScopeKey || ''
        applyCanvasProgressIfCurrent({
          liveGenScopeKey: liveScope.scopeKey,
          editorScopeKey,
          text:
            formatTaskSseJoinedLiveText(p, '') ||
            (typeof p.percent === 'number' ? `${Math.round(p.percent)}%` : '') ||
            '高清处理中…'
        })
      }
    })
  } catch (e: unknown) {
    upscaleUiPhase.value = 'failed'
    canvasOverlayTaskKind.value = null
    upscaleFailedMessage.value = String((e as Error)?.message || '高清任务异常')
    return
  }

  const ctx = upscaleContext.value
  if (!ctx) {
    clearUpscaleOverlay()
    return
  }

  /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast、不回写图片 */
  if (!matchesCreationLiveGenScope(liveScope)) {
    creationStore.clearSceneModalSseTask(ctx.editorScopeKey, liveScope.scopeKey)
    return
  }

  // 关弹窗再进 / 双重 restore / suspend：旧 SSE 被抢占，勿清 Pinia / 勿标失败；按策略延迟续跟
  if (upscaleResult.ok === false && upscaleResult.deferred) {
    if (ctx.editorScopeKey) {
      handleDeferredSceneModalFollow({
        sceneIdx,
        editorScopeKey: ctx.editorScopeKey,
        liveGenScopeKey: liveScope.scopeKey,
        errorMessage: upscaleResult.errorMessage
      })
    }
    return
  }

  if (upscaleResult.ok === false) {
    creationStore.clearSceneModalSseTask(ctx.editorScopeKey)
    clearSceneImageModalGenSession(sceneModalSessionScope())
    clearSceneModalGeneratingUi(sceneIdx)
    upscaleUiPhase.value = 'failed'
    canvasOverlayTaskKind.value = null
    upscaleFailedMessage.value = upscaleResult.errorMessage || '高清任务失败'
    return
  }

  creationStore.clearSceneModalSseTask(ctx.editorScopeKey)
  clearSceneImageModalGenSession(sceneModalSessionScope())
  endCanvasTaskOverlay(sceneIdx, index)
  upscaleContext.value = null
  const sameScope =
    ctx.editorScopeKey === buildEditorScopeKeyForSceneIndex(currentSceneIndex.value) &&
    ctx.assetId === activeRpsAssetId.value
  if (sameScope && currentSceneIndex.value === ctx.sceneIndex && localSceneImages.value[ctx.imageIndex]) {
    const row = localSceneImages.value[ctx.imageIndex] as any
    row.url = upscaleResult.imageUrl
    row.thumbnail = upscaleResult.imageUrl
    localSceneImages.value = [...localSceneImages.value]
    emitSceneTabUpdate(buildVisibleImagesForParent())
  } else {
    const prev = scenesSnapshot[ctx.sceneIndex] || { name: '', images: [] as any[] }
    const imgs = [...(prev.images || [])]
    if (imgs[ctx.imageIndex]) {
      imgs[ctx.imageIndex] = {
        ...imgs[ctx.imageIndex],
        url: upscaleResult.imageUrl,
        thumbnail: upscaleResult.imageUrl
      }
      emitSceneUpdate(ctx.sceneIndex, { ...prev, images: imgs }, ctx.editorScopeKey)
    }
  }
  clearSceneModalGeneratingUi(sceneIdx)
  message.success('高清处理完成')
}

const handleMultiAngle = (index: number) => {
  const img = currentSceneImages.value[index]
  if (!img?.url) {
    message.warning('请先选择一张可用图片')
    return
  }
  multiAngleTargetIndex.value = index
  multiAngleImageUrl.value = img.url
  showMultiAngleModal.value = true
}

const handleMultiAngleGenerate = async (payload: MultiAngleGeneratePayload) => {
  const index = multiAngleTargetIndex.value
  if (index === null) return
  // 须与左侧列表一致：RPS 形态编辑时 localSceneImages 可能多于 props.scenes[].images（父级常仅同步 isUse=1），用 sceneRow.images 下标会误判并静默 return
  if (!currentSceneImages.value[index]) {
    message.warning('当前图片已失效，请关闭多机位弹窗后重试')
    return
  }
  const sceneIdx = currentSceneIndex.value
  const modalScope = captureModalScopeSnapshot(sceneIdx)
  const taskScopeKey = modalScope.editorScopeKey
  /** 剧集隔离：任务归属启动时作品/集；切集后终态收尾不得写当前集 store、不得 toast */
  const liveScope = captureCreationLiveGenScope()

  const rawImg = currentSceneImages.value[index] as Record<string, unknown>
  const imageUrl = String(rawImg?.url || rawImg?.thumbnail || payload.imageUrl || '').trim()

  // 解析 formId 用于接口调用
  let formId: number | null = Number(rawImg?.rpsFormId)
  if (!Number.isFinite(formId) || formId <= 0) formId = null

  if (formId == null) {
    message.warning('当前图片缺少形态信息，无法发起多机位生图')
    return
  }

  // 与接口 modelCode 一致：须来自 image_multi_view 功能池（listByFunc）
  const modelCode = String(multiViewSelectedModel.value?.id || '').trim()
  if (!modelCode) {
    message.warning('暂无可用多机位模型，请联系管理员配置 image_multi_view 功能池')
    return
  }

  beginCanvasTaskOverlay(sceneIdx, index, '多机位生图任务提交中...', 'multi-view')

  const result = await runMultiViewImageTask({
    formId,
    imageUrl,
    anglePrompt: payload.multiAnglePromptConcat,
    modelCode,
    aspectRatio: generationSettings.value.aspectRatio || undefined,
    onSubmitted: ({ taskId }) => {
      persistSceneModalSseTask(sceneIdx, index, 'multi-view', taskId, { formId })
    },
    onProgress: (p) => {
      applyCanvasProgressIfCurrent({
        liveGenScopeKey: liveScope.scopeKey,
        editorScopeKey: taskScopeKey,
        text: formatTaskSseJoinedLiveText(p, '多机位生图中...')
      })
    }
  })

  // 关弹窗再进 / suspend：旧 SSE 被抢占，勿清 overlay / Pinia / 勿 toast；释放锁后交给 restore 续跟
  if (result.ok === false && result.deferred) {
    if (taskScopeKey) {
      handleDeferredSceneModalFollow({
        sceneIdx,
        editorScopeKey: taskScopeKey,
        liveGenScopeKey: liveScope.scopeKey,
        errorMessage: result.errorMessage
      })
    }
    return
  }

  /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast、不回写图片 */
  if (!matchesCreationLiveGenScope(liveScope)) {
    creationStore.clearSceneModalSseTask(taskScopeKey, liveScope.scopeKey)
    return
  }

  endCanvasTaskOverlay(sceneIdx, index)

  if (result.ok === false) {
    creationStore.clearSceneModalSseTask(taskScopeKey)
    clearSceneImageModalGenSession(sceneModalSessionScope())
    clearSceneModalGeneratingUi(sceneIdx)
    message.error(result.errorMessage || '多机位生图失败')
    return
  }
  creationStore.clearSceneModalSseTask(taskScopeKey)
  clearSceneImageModalGenSession(sceneModalSessionScope())
  await claimFormImagesForModal('form_multi_view', { imageId: result.imageId })

  // 以 form-image/list 为准回填 URL（task resultData 中的 imageUrl 可能未走 @MediaUrl，直接展示会裂图）
  if (isSameModalScope(modalScope)) {
    await refreshFormImageListAfterTask(result.imageId)
  }

  clearSceneModalGeneratingUi(sceneIdx)

  message.success('多机位生图完成')

  // 通知全局任务列表刷新
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }
}

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

const handleAddSceneImage = async () => {
  if (isAddingSceneImage.value) return

  const currentImg = localSceneImages.value[currentImageIndex.value] as any
  if (currentImg?._pending) {
    await handleConfirmAddImage(currentImageIndex.value)
    return
  }

  // 如果当前是“已导入但尚未设置为主图”的图片：直接调用 form/use
  if (currentImg && !currentImg._pending) {
    const imageUrl = String(currentImg?.url || '').trim()
    const formId = Number(currentImg?.rpsFormId)
    const currentRpsImageId = Number(currentImg?.rpsImageId)

    if (imageUrl && Number.isFinite(formId) && Number.isFinite(currentRpsImageId)) {
      const sceneIdx = currentSceneIndex.value
      const imgIdx = currentImageIndex.value
      addingSceneImageAtKey.value = buildCanvasOverlayKey(sceneIdx, imgIdx)
      try {
        const resolvedImageId = await resolveImageIdFromFormImageList({
          formId,
          imageId: currentRpsImageId,
          imageUrl,
          imageTitle: String(currentImg?.title || '')
        })

        const targetImageId = Number(resolvedImageId ?? currentRpsImageId)
        const setOk = await reserveSetRpsForm({
          imageId: targetImageId,
          formId,
          imageType: props.imageType
        })

        if (setOk) {
          currentImg._isSet = true
          ;(currentImg as { rpsImageId?: number }).rpsImageId = targetImageId
          const key = normalizeImageId(currentImg.id)
          if (key) addedImageIds.value = new Set([...addedImageIds.value, key])
          emitSceneTabUpdate(buildVisibleImagesForParent())
          message.success('已设置为主图')
        }
      } finally {
        if (
          addingSceneImageAtKey.value ===
          buildCanvasOverlayKey(currentSceneIndex.value, currentImageIndex.value)
        ) {
          addingSceneImageAtKey.value = ''
        }
      }
      return
    }
  }

  // 兜底：若当前选中项不是 pending，则尝试定位最近导入的 pending 图
  if (pendingImage.value?.id) {
    const pendingIndex = localSceneImages.value.findIndex((img: any) => img?.id === pendingImage.value?.id && img?._pending)
    if (pendingIndex >= 0) {
      currentImageIndex.value = pendingIndex
      await handleConfirmAddImage(pendingIndex)
      return
    }
  }

  message.warning(`请先通过“本地上传图片”或“资源库导入”导入图片，再点击${addImageButtonLabel.value}`)
}

// 获取场景的第一张图片
const getFirstSceneImage = (sceneIndex: number) => {
  const scene = props.scenes[sceneIndex]
  if (scene?.images && scene.images.length > 0) {
    return scene.images[0]
  }
  return null
}

// 在指定索引后添加场景图（从其他场景选择）
const handleAddSceneImageAfter = (index: number) => {
  addingAfterIndex.value = index
  isSelectingSceneImage.value = true
  selectedSceneImageIndex.value = null
}

// 确认添加待添加的图片
const handleConfirmAddImage = async (index: number) => {
  const sceneIdx = currentSceneIndex.value
  const overlayKey = buildCanvasOverlayKey(sceneIdx, index)
  if (addingSceneImageAtKey.value === overlayKey) return
  addingSceneImageAtKey.value = overlayKey
  try {
  if (!pendingImage.value) {
    // 如果没有pendingImage，检查当前图片是否有_pending标记
    const img = localSceneImages.value[index]
    if (!img || !img._pending) {
      message.warning('没有待添加的图片')
      return
    }
  }

  // 移除待添加标记，正式添加到列表
  const img = localSceneImages.value[index]
  if (img) {
    delete img._pending
    // 记录已添加的图片ID（用于显示"取消添加"按钮）
    const addKey = normalizeImageId(img.id)
    if (addKey) {
      addedImageIds.value = new Set([...addedImageIds.value, addKey])
    }
  }

  // 清空待添加状态
  pendingImage.value = null

  let synced = false
  if (img?.url && (img?.rpsImageId == null || !Number.isFinite(Number(img?.rpsImageId)))) {
    const result = await syncImageToRpsApi(
      img.url,
      img.title || '',
      resolveRpsSourceType(img),
      img
    )
    if (result?.imageId != null) {
      img.rpsImageId = result.imageId
      synced = true
    }
    if (result?.formId != null) {
      img.rpsFormId = result.formId
    }
  }
  const formId =
    img?.rpsFormId != null && Number.isFinite(Number(img.rpsFormId))
      ? Number(img.rpsFormId)
      : undefined
  const resolvedImageId = await resolveImageIdFromFormImageList({
    formId,
    imageId:
      img?.rpsImageId != null && Number.isFinite(Number(img.rpsImageId)) ? Number(img.rpsImageId) : undefined,
    imageUrl: img?.url,
    imageTitle: img?.title
  })
  const setOk =
    !img?.url
      ? true
      : await reserveSetRpsForm({
          imageId: resolvedImageId ?? undefined,
          formId,
          imageType: props.imageType
        })
  if (!setOk) {
    message.warning('设置展示图失败，请稍后重试')
    return
  }
  if (img) {
    img._isSet = true
    if (resolvedImageId != null && Number.isFinite(Number(resolvedImageId))) {
      ;(img as { rpsImageId?: number }).rpsImageId = Number(resolvedImageId)
    }
    if (formId != null && Number.isFinite(Number(formId))) {
      ;(img as { rpsFormId?: number }).rpsFormId = Number(formId)
    }
  }

  const images = buildVisibleImagesForParent()

  emitSceneTabUpdate(images)

  message.success('场景图已添加')

  // 延迟清空 lastAddedImageIndex，以便用户可以点击"取消添加"
  // 但允许继续添加新的图片（通过导入新的图片来重置状态）
  } finally {
    if (addingSceneImageAtKey.value === buildCanvasOverlayKey(sceneIdx, index)) {
      addingSceneImageAtKey.value = ''
    }
  }
}

// 取消添加的场景图（从父级列表移除并同步左侧/Tab，不能先标 _pending 再算「外部索引」否则会找不到）
const handleCancelAddImage = async (index: number) => {
  const sceneIdx = currentSceneIndex.value
  const overlayKey = buildCanvasOverlayKey(sceneIdx, index)
  if (cancellingAddAtKey.value === overlayKey) return
  const img = localSceneImages.value[index]
  if (!img) return

  if (cancelAddDisabledTooltip.value) {
    return
  }

  if (!img._isSet) {
    message.info('该图片尚未设置为展示图')
    return
  }

  cancellingAddAtKey.value = overlayKey
  try {
  const ci = currentSceneIndex.value
  const parentImages = props.scenes[ci]?.images || []
  const inParent = parentImages.some((x: any) => x.id === img.id)
  const formId = (img as { rpsFormId?: number }).rpsFormId
  const imageId = (img as { rpsImageId?: number }).rpsImageId
  const resolvedImageId = await resolveImageIdFromFormImageList({
    formId: formId != null && Number.isFinite(Number(formId)) ? Number(formId) : undefined,
    imageId: imageId != null && Number.isFinite(Number(imageId)) ? Number(imageId) : undefined,
    imageUrl: (img as { url?: string }).url,
    imageTitle: (img as { title?: string }).title
  })
  const unsetOk =
    activeRpsAssetId.value == null
      ? true
      : await reserveUnsetRpsForm({
          imageId: resolvedImageId ?? undefined,
          formId
        })
  if (!unsetOk) {
    // 接口错误提示已在 reserveUnsetRpsForm 内统一提示，避免重复弹两条
    return
  }

  if (inParent) {
    img._isSet = false
    emitSceneTabUpdate(buildVisibleImagesForParent())
  }

  const delKey = normalizeImageId(img.id)
  if (delKey) {
    const n = new Set(addedImageIds.value)
    n.delete(delKey)
    addedImageIds.value = n
  }

  nextTick(() => {
    const n = localSceneImages.value.length
    if (n === 0) {
      currentImageIndex.value = 0
    } else if (currentImageIndex.value >= n) {
      currentImageIndex.value = n - 1
    }
  })

  message.success(`已取消设置`)
  } finally {
    if (cancellingAddAtKey.value === overlayKey) {
      cancellingAddAtKey.value = ''
    }
  }
}

// 从场景切换器选择场景图
const selectSceneImageFromTab = (sceneIndex: number) => {
  const firstImage = getFirstSceneImage(sceneIndex)
  if (!firstImage) {
    message.warning('该场景暂无场景图')
    return
  }

  selectedSceneImageIndex.value = sceneIndex
}

// 取消选择场景图模式
const cancelSelectSceneImage = () => {
  isSelectingSceneImage.value = false
  selectedSceneImageIndex.value = null
  addingAfterIndex.value = null
}

// 取消/返回
const handleCancel = () => {
  // 如果正在选择场景图，先确认选择并添加场景图
  if (isSelectingSceneImage.value) {
    if (selectedSceneImageIndex.value !== null) {
      // 确认选择，添加场景图
      const selectedSceneIndex = selectedSceneImageIndex.value
      const firstImage = getFirstSceneImage(selectedSceneIndex)

      if (firstImage) {
        // 深拷贝图片数据，避免引用问题
        const now = new Date()
        const newImage = {
          ...firstImage,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          source: '场景关联',
          importDate: now.toISOString(),
          createdAt: now.toISOString()
        }

        const updatedScenes = [...props.scenes]
        if (!updatedScenes[currentSceneIndex.value].images) {
          updatedScenes[currentSceneIndex.value].images = []
        }

        // 如果指定了插入位置，在指定索引后插入；否则追加到末尾
        if (addingAfterIndex.value !== null) {
          updatedScenes[currentSceneIndex.value].images.splice(addingAfterIndex.value + 1, 0, newImage)
          currentImageIndex.value = addingAfterIndex.value + 1
        } else {
          updatedScenes[currentSceneIndex.value].images.push(newImage)
          currentImageIndex.value = updatedScenes[currentSceneIndex.value].images.length - 1
        }

        // 通知父组件更新场景数据
        emit('update', currentSceneIndex.value, updatedScenes[currentSceneIndex.value])
        message.success('场景图已添加')
      }
    }

    // 退出选择模式
    cancelSelectSceneImage()
  } else {
    // 如果不是在选择模式，同步所有已添加的图片到外部列表（排除待添加的图片）
    const updatedScenes = [...props.scenes]
    if (!updatedScenes[currentSceneIndex.value].images) {
      updatedScenes[currentSceneIndex.value].images = []
    }
    // 只同步已确认添加的图片（没有_pending标记的）
    updatedScenes[currentSceneIndex.value].images = localSceneImages.value
      .filter(img => !img._pending && img?._isSet === true)
      .map(img => {
        const { _pending, _isSet, _rpsSourceType, ...rest } = img
        return rest
      })

    // 如果有已添加的图片，通知父组件更新
    if (updatedScenes[currentSceneIndex.value].images.length > 0) {
      emit('update', currentSceneIndex.value, updatedScenes[currentSceneIndex.value])
    }
  }

  // 关闭弹窗（无论是否在选择模式，都关闭弹窗）
  modalOpen.value = false
}

// 监听场景切换
watch(() => props.sceneIndex, (newIndex) => {
  if (newIndex !== currentSceneIndex.value) {
    switchScene(newIndex)
  }
})

let initFormImageListSeq = 0
let lastInitFormImageListKey = ''

function buildInitFormImageListKey() {
  const formIds = activeRpsFormIds.value ?? []
  return `${props.imageType}|${currentSceneIndex.value}|${activeRpsAssetId.value ?? ''}|${Array.isArray(formIds) ? formIds.join(',') : ''}`
}

function mapFormImageRowToLocalImage(row: any, formIdFallback: number, orderIndex: number) {
  const idRaw = Number(row?.id)
  const id = Number.isFinite(idRaw) ? `img-${idRaw}` : `form-${formIdFallback}-${orderIndex}`
  const url = String(row?.imageUrl || '').trim()
  return {
    id,
    url,
    thumbnail: url,
    title: String(row?.name || '').trim() || `形态图${orderIndex + 1}`,
    source: 'server',
    importDate: String(row?.updateTime || row?.createTime || '') || '',
    angles: [],
    rpsFormId: Number(row?.formId ?? formIdFallback),
    rpsImageId: Number(row?.id ?? NaN),
    /** 服务端 sourceType（如 ai_auto / ai_builder），用于设定卡参考图校验 */
    _serverSourceType: String(row?.sourceType || '').trim() || undefined,
    // 本弹窗内部标记：仅当接口返回 isUse=1 时才认为“已设置”
    _isSet: Number(row?.isUse) === 1,
    /** 是否可拆分四宫格（scene 且未拆过、非拆分产物） */
    canSplit: row?.canSplit === true
  }
}

/**
 * 弹窗打开时初始化形态图列表：
 * - imageType === 'form'：按当前 form tab 的 formId 拉取 isUse=1 图片
 * - imageType !== 'form'：按 activeRpsFormIds 拉取形态图全量（isUse=0/1）
 */
async function initFormImageListOnOpen(options?: { focusImageId?: number | null }) {
  if (!props.open) return
  const seq = ++initFormImageListSeq

  const focusImageId =
    options?.focusImageId != null && Number.isFinite(Number(options.focusImageId))
      ? Number(options.focusImageId)
      : null

  function applyFocusIndex() {
    if (focusImageId == null) return
    const idx = localSceneImages.value.findIndex(
      (img: any) => Number(img?.rpsImageId) === focusImageId
    )
    if (idx >= 0) currentImageIndex.value = idx
  }

  // 兜底：本弹窗需要 formIds 才有意义
  const formIds = activeRpsFormIds.value ?? []
  if (props.imageType === 'form' && formIds.length === 0) return

  const hasRpsContext = activeRpsAssetId.value != null || (formIds?.length ?? 0) > 0
  if (hasRpsContext) lockLocalSceneImagesFromRps = true

  // 只保留 pending，避免被初始化覆盖
  const pendingOnly = localSceneImages.value.filter((img: any) => img?._pending)

  if (props.imageType === 'form') {
    const formId = formIds[currentSceneIndex.value]
    const fid = Number(formId)
    if (fid == null || !Number.isFinite(fid)) return
    try {
      const list = await userAssetRpsFormImageList({ formId: fid, isUse: null })
      if (seq !== initFormImageListSeq) return
      const images = (Array.isArray(list) ? list : []).map((r: any, i: number) => mapFormImageRowToLocalImage(r, fid, i))
      localSceneImages.value = finalizeLocalImagesWhileGenerating([...images, ...pendingOnly])
      if (focusImageId != null) {
        applyFocusIndex()
      } else {
        currentImageIndex.value = images.length ? 0 : Math.max(0, pendingOnly.length - 1)
      }
    } catch {
      // 初始化失败不阻断，保持当前展示
    }
    return
  }

  try {
    const images: any[] = []

    // formIds 为空时：使用 assetId/assetType 兜底，仍触发 list 初始化
    if (formIds.length === 0) {
      const assetId = activeRpsAssetId.value
      const assetType = props.imageType === 'scene' ? 'scene' : props.imageType === 'character' ? 'character' : 'prop'

      const list = await userAssetRpsFormImageList({
        formId: undefined,
        assetId: assetId != null && Number.isFinite(Number(assetId)) ? Number(assetId) : undefined,
        assetType,
        isUse: null
      })

      if (seq !== initFormImageListSeq) return
      const arr = Array.isArray(list) ? list : []
      for (const [idx, r] of arr.entries()) {
        const fidFallback = Number(r?.formId)
        images.push(
          mapFormImageRowToLocalImage(r, Number.isFinite(fidFallback) ? fidFallback : 0, idx)
        )
      }
    } else {
      const results = await Promise.all(
        formIds
          .map((f) => Number(f))
          .filter((n) => Number.isFinite(n))
          .map(async (fid) => {
            const list = await userAssetRpsFormImageList({ formId: fid, isUse: null })
            return [fid, list] as const
          })
      )
      if (seq !== initFormImageListSeq) return

      for (const [fid, list] of results) {
        const arr = Array.isArray(list) ? list : []
        // form-image/list 可能返回 isUse=0/1 全量；
        // 左侧列表初始化需要展示“所有图片”，不要只取 isUse=1 的那一张。
        for (const r of arr) {
          if (!r) continue
          images.push(mapFormImageRowToLocalImage(r, fid, images.length))
        }
      }
    }

    localSceneImages.value = finalizeLocalImagesWhileGenerating([...images, ...pendingOnly])
    if (focusImageId != null) {
      applyFocusIndex()
    } else {
      currentImageIndex.value = images.length ? 0 : Math.max(0, pendingOnly.length - 1)
    }
  } catch {
    // ignore
  }
}

/** 编辑作图 / 对话作图成功后，从 form-image/list 回填可展示 URL（SSE resultData 的 imageUrl 可能未走 @MediaUrl） */
async function refreshAfterEditChatGenerate(
  items: Array<{ imageId: number; imageUrl: string }>,
  modalScope?: ReturnType<typeof captureModalScopeSnapshot>
) {
  const focusImageId = items.length ? items[items.length - 1]?.imageId ?? null : null
  if (!modalScope || isSameModalScope(modalScope)) {
    await refreshFormImageListAfterTask(focusImageId)
  }
  emitSceneTabUpdate(buildVisibleImagesForParent())
}

/** 任务落库后刷新形态图列表；SSE 略早于 list 可见时短重试 */
async function refreshFormImageListAfterTask(
  focusImageId?: number | null,
  opts?: { imageUrl?: string | null; retryDelaysMs?: number[] }
) {
  const fid =
    focusImageId != null && Number.isFinite(Number(focusImageId)) ? Number(focusImageId) : null
  const imageUrl = String(opts?.imageUrl || '').trim()
  const delays = opts?.retryDelaysMs ?? [450, 900, 1500]

  const isFound = () =>
    localSceneImages.value.some((img: any) => {
      if (fid != null && Number(img?.rpsImageId) === fid) return true
      if (imageUrl && String(img?.url || '').trim() === imageUrl) return true
      return false
    })

  lastInitFormImageListKey = ''
  await initFormImageListOnOpen({ focusImageId: fid })
  if (isFound()) return

  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay))
    await initFormImageListOnOpen({ focusImageId: fid })
    if (isFound()) return
  }
}

function appendSettingCardToLocalListIfMissing(payload: {
  imageId: number | null
  imageUrl: string
  title?: string
}): number {
  const url = String(payload.imageUrl || '').trim()
  if (!url) return -1

  const existingIdx = localSceneImages.value.findIndex((x: any) => {
    if (payload.imageId != null && Number(x?.rpsImageId) === payload.imageId) return true
    return String(x?.url || '').trim() === url
  })
  if (existingIdx >= 0) return existingIdx

  const formIds = activeRpsFormIds.value ?? []
  const rawFormId =
    props.imageType === 'form' ? formIds[currentSceneIndex.value] : formIds[currentSceneIndex.value]
  const fid = Number(rawFormId)
  const newRow = {
    id:
      payload.imageId != null && Number.isFinite(payload.imageId)
        ? `img-${payload.imageId}`
        : `card-${Date.now()}`,
    url,
    thumbnail: url,
    title: payload.title || '角色设定卡',
    source: 'server',
    importDate: new Date().toISOString(),
    angles: [],
    rpsFormId: Number.isFinite(fid) ? fid : 0,
    rpsImageId: payload.imageId ?? undefined,
    _serverSourceType: 'ai_builder',
    _isSet: true,
    canSplit: false
  }
  localSceneImages.value = [...localSceneImages.value, newRow]
  return localSceneImages.value.length - 1
}

// 监听初始图片索引（当弹窗打开时，如果有指定初始图片索引，则选中该图片）
watch(() => [props.open, props.initialImageIndex], ([isOpen, imageIndex]) => {
  if (isOpen && typeof imageIndex === 'number' && imageIndex >= 0) {
    // 确保场景已切换完成后再设置图片索引
    nextTick(() => {
      if (currentSceneImages.value.length > imageIndex) {
        currentImageIndex.value = imageIndex
        // 滚动到选中的图片
        nextTick(() => {
          switchImage(imageIndex)
        })
      }
    })
  }
}, { immediate: true })

// 关闭弹窗时清空会话态；释放 live follow 锁，便于步骤页外层静默续跟同一 taskId
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      resumeSceneModalFollowGen++
      resetSceneModalDeferredRestoreState()
      // 先挂起弹窗 registry SSE，避免外层 useTaskStream 与弹窗 orphan 双连
      const editorScopeKey = buildEditorScopeKeyForSceneIndex(currentSceneIndex.value)
      const persisted = editorScopeKey
        ? resolvePersistedSceneModalSseTask(editorScopeKey)
        : null
      if (persisted?.taskId) {
        suspendTaskSseFollow(persisted.taskId)
        if (hasStep3SseSlot(persisted.taskId)) releaseStep3SseSlot(persisted.taskId)
      }
      for (const tid of creationStore.step3FormImageTaskFollowTaskIds) {
        const n = Number(tid)
        if (Number.isFinite(n) && n > 0) {
          suspendTaskSseFollow(n)
          if (hasStep3SseSlot(n)) releaseStep3SseSlot(n)
        }
      }
      // 关窗后不再由弹窗占坑；外层 restoreAndTrack 可重新 startTrackTask
      activeSceneModalFollowScopeKeys.clear()
      drainStep3SseQueue((item) => {
        if (item.owner === 'modal') {
          requeueStep3SseItemToEnd(item)
          return { kind: 'skipped' as const }
        }
        const acq = tryAcquireStep3SseSlot({ taskId: item.taskId, owner: 'outer' })
        if (acq.kind !== 'acquired' && acq.kind !== 'already-active') return acq
        window.dispatchEvent(
          new CustomEvent('create-flow-track-task', { detail: { taskId: item.taskId } })
        )
        return acq
      })
      addedImageIds.value = new Set()
      pendingImage.value = null
      lockLocalSceneImagesFromRps = false
    } else {
      // 每次打开给予新的续跟预算，避免上一轮 stop 次数残留
      resetSceneModalDeferredRestoreState()
      // 先清空本实例画布/工具栏 loading，再按当前 editorScope 恢复，避免串到其它弹窗入口
      clearUpscaleOverlay()
      isSceneSplitting.value = false
      sceneSplitTargetKey.value = ''
      sceneSplitProgressText.value = '正在拆分四宫格…'
    }
  }
)

// 弹窗打开时：初始化当前形态图列表（按 form-image/list 拉取 isUse=1 图片）
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    clearSceneImageModalUserDismissed(sceneModalSessionScope())
    void initImageModelOptions()
    const si = props.sceneIndex
    currentSceneIndex.value = si
    await ensureModalLoadingRestored(si)
    await nextTick()
    const key = buildInitFormImageListKey()
    if (key !== lastInitFormImageListKey) {
      lastInitFormImageListKey = key
      await initFormImageListOnOpen()
      primeSceneModalLoadingUi(si)
    }
    void restoreSceneModalSseIfNeeded(si)
    scrollActiveSceneTabIntoView()
    sceneTabBarRef.value?.refresh()
  },
  { immediate: true }
)

watch(
  () => props.scenes.length,
  () => {
    if (!props.open) return
    nextTick(() => sceneTabBarRef.value?.refresh())
  }
)

// 弹窗内部切换形态/场景 tab 时：只要是“形态图列表”模式，刷新接口返回的列表
watch(
  () => currentSceneIndex.value,
  async () => {
    if (!props.open) return
    await ensureModalLoadingRestored(currentSceneIndex.value)
    const key = buildInitFormImageListKey()
    if (key !== lastInitFormImageListKey) {
      lastInitFormImageListKey = key
      await nextTick()
      await initFormImageListOnOpen()
      primeSceneModalLoadingUi(currentSceneIndex.value)
    }
    void restoreSceneModalSseIfNeeded(currentSceneIndex.value)
  }
)

// 弹窗打开时：如果父级异步回填 rpsFormIds 导致首帧为空，则在 rpsFormIds 变更后再初始化
watch(
  () => (props.open ? props.rpsFormIds : []),
  async (val) => {
    if (!props.open) return
    const formIds = Array.isArray(val) ? val : []
    if (formIds.length === 0) return
    const key = buildInitFormImageListKey()
    if (key === lastInitFormImageListKey) return
    lastInitFormImageListKey = key
    await nextTick()
    await initFormImageListOnOpen()
  },
  { deep: true }
)

// 弹窗打开期间：父级 scenes 异步回填或刷新后再次同步，避免只依赖 open 瞬间的空数据
watch(
  () =>
    props.open
      ? ([currentSceneIndex.value, props.scenes[currentSceneIndex.value]?.images ?? []] as const)
      : null,
  () => {
    if (!props.open) return
    syncAddedImageIdsFromParentScenes()
  },
  { deep: true, immediate: true }
)

const GLOBAL_TASKS_UPDATED_EVENT = 'create-flow-global-tasks-updated'

function handleGlobalTasksUpdatedForModal() {
  if (!props.open) return
  void (async () => {
    await initFormImageListOnOpen()
    primeSceneModalLoadingUi(currentSceneIndex.value)
    void restoreSceneModalSseIfNeeded(currentSceneIndex.value)
  })()
}

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (typeof window === 'undefined') return
    if (isOpen && !wasOpen) {
      window.addEventListener(GLOBAL_TASKS_UPDATED_EVENT, handleGlobalTasksUpdatedForModal)
    } else if (!isOpen && wasOpen) {
      window.removeEventListener(GLOBAL_TASKS_UPDATED_EVENT, handleGlobalTasksUpdatedForModal)
    }
  }
)

useCreateFlowScopeChangedResume(() => {
  // 切作品/切集：清掉旧桶跟随锁，避免同名 character-0 挡住新作品 restore
  clearModalFollowLocksNotMatchingLiveGenScope(
    activeSceneModalFollowScopeKeys,
    currentModalLiveGenScopeKey()
  )
  if (!props.open) return
  void restoreSceneModalSseIfNeeded(currentSceneIndex.value)
})
</script>

<style lang="scss" scoped src="~/assets/css/edit-scene-image-modal.scoped.scss"></style>
