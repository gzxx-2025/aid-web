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
            v-for="(tab, index) in headerTabsForDisplay"
            :key="tab.storyboardId ?? `scene-${index}`"
            :class="[
              'scene-image-tab',
              {
                active: currentSceneIndex === index,
                'scene-image-tab--generating': isSceneModalImageGenerating(index)
              }
            ]"
            @click="switchScene(index)"
          >
            <div class="scene-image-thumbnail">
              <ShimmerImage
                v-if="tab.thumbnailUrl"
                :src="tab.thumbnailUrl"
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
            <span class="scene-label">{{ tab.name }}</span>
          </div>
        </HorizontalScrollTabBar>
      </div>

      <!-- 主要内容区域：与 EditSceneImageModal 一致的三栏布局（左：生成记录 | 中：画布与列表 | 右：配置） -->
      <div class="main-content-wrapper">
        <div class="right-panel storyboard-right-panel">
          <div
            v-if="leftPanelLoading || rightPanelLoading"
            class="panel-skeleton right-panel-skeleton"
          >
            <div class="skeleton-stage-layout">
              <aside class="skeleton-history-panel">
                <div class="skeleton-panel-title" />
                <div class="skeleton-history-list">
                  <div v-for="n in 6" :key="`sk-h-${n}`" class="skeleton-history-item" />
                </div>
                <div class="skeleton-history-actions">
                  <div class="skeleton-btn" />
                  <div class="skeleton-btn" />
                </div>
              </aside>
              <section class="skeleton-canvas-panel">
                <div class="skeleton-canvas-toolbar">
                  <div v-for="n in 5" :key="`sk-t-${n}`" class="skeleton-chip" />
                </div>
                <div class="skeleton-canvas-main" />
              </section>
              <aside class="skeleton-config-panel">
                <div class="skeleton-config-tabs">
                  <div class="skeleton-tab" />
                  <div class="skeleton-tab" />
                  <div class="skeleton-tab" />
                </div>
                <div class="skeleton-file-row" />
                <div class="skeleton-textarea" />
                <div class="skeleton-select-row">
                  <div v-for="n in 4" :key="`sk-s-${n}`" class="skeleton-select" />
                </div>
                <div class="skeleton-primary-btn" />
              </aside>
            </div>
          </div>

          <div v-else class="figma-stage-layout storyboard-figma-stage">
            <!-- 左栏：生成记录 + 导入 -->
            <aside class="stage-history-panel">
              <h4 class="panel-title">生成记录</h4>
              <div class="history-list">
                <HistoryRecordWrap
                  v-for="(img, index) in currentSceneImages"
                  :key="`history-${index}`"
                  :show-set-main="canSetMainFromHistory(index)"
                  set-main-label="添加分镜图"
                  :set-main-loading="isSettingFinalImage"
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
                    <span
                      v-if="isHistoryItemMain(index)"
                      class="history-main-mark"
                      aria-hidden="true"
                    >
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
                <a-button
                  block
                  :loading="isUploadingLocalImage"
                  :disabled="isUploadingLocalImage"
                  @click="handleUploadLocalImage"
                >
                  <template #icon><UploadOutlined /></template>
                  <EllipsisTooltip title="选择本地文件" />
                </a-button>
                <a-button block @click="handleOpenAssetLibrary">
                  <template #icon><FolderOutlined /></template>
                  <EllipsisTooltip title="资产库导入" />
                </a-button>
              </div>
            </aside>

            <!-- 中栏：与 EditSceneImageModal 一致 — 主工具栏 + 大图预览 -->
            <section class="stage-canvas-panel storyboard-stage-canvas">
              <div ref="mainContentRef" class="canvas-content-stack storyboard-canvas-stack">
                <!-- 与 EditSceneImageModal 一致：无图时也展示完整工具栏 + 带边框画布区 -->
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
                  <a-button
                    type="text"
                    size="small"
                    :loading="showDialogueToolbarLoading"
                    :disabled="showDialogueToolbarLoading"
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
                    resolution-format="upper"
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
                    v-if="showCancelAddStoryboardImage"
                    type="text"
                    size="small"
                    :loading="isSettingFinalImage"
                    :disabled="isSettingFinalImage"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'add' }"
                    @mouseenter="canvasToolbarHoverKey = 'add'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleCancelAddImage(currentImageIndex)"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('add')" alt="" />
                    </template>
                    取消添加
                  </a-button>
                  <a-button
                    v-else
                    type="text"
                    size="small"
                    :class="{ 'toolbar-tab-hover': canvasToolbarHoverKey === 'add' }"
                    @mouseenter="canvasToolbarHoverKey = 'add'"
                    @mouseleave="canvasToolbarHoverKey = null"
                    @click="handleAddStoryboardImage()"
                  >
                    <template #icon>
                      <img class="toolbar-tab-icon" :src="getCanvasToolbarIcon('add')" alt="" />
                    </template>
                    添加分镜图
                  </a-button>
                </div>

                <div v-if="currentImg" class="storyboard-canvas-meta">
                  <div class="storyboard-canvas-meta-left">
                    <a-input
                      v-if="editingImageTitleIndex === currentImageIndex"
                      v-model:value="editingImageTitle"
                      size="small"
                      class="storyboard-meta-title-input"
                      @blur="handleImageTitleBlur(currentImageIndex)"
                      @press-enter="handleImageTitleBlur(currentImageIndex)"
                    />
                    <span
                      v-else
                      class="storyboard-canvas-meta-title"
                      @click="startEditImageTitle(currentImageIndex)"
                    >
                      {{ currentImg.title || STORYBOARD_GENERATED_IMAGE_DEFAULT_TITLE }}
                    </span>
                    <span v-if="currentImg.source" class="image-source">{{
                      currentImg.source
                    }}</span>
                    <span v-if="currentImg.importDate" class="image-date">{{
                      formatDate(currentImg.importDate)
                    }}</span>
                  </div>
                </div>

                <div :class="['canvas-preview', { 'is-selected': currentImageIndex >= 0 }]">
                  <div class="canvas-image-frame canvas-image-frame--enhance-wrap">
                    <div
                      v-if="showCanvasImageGenMask || showUpscaleRunningOverlay"
                      class="canvas-upscale-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="canvas-upscale-mask__icon" />
                      <p class="canvas-upscale-mask__text">
                        {{ showCanvasImageGenMask ? sceneImageGenMaskText : upscaleProgressText }}
                      </p>
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
                    <div
                      v-if="currentImg?.angles && currentImg.angles.length === 4"
                      class="four-grid-images four-grid-images--canvas"
                    >
                      <div
                        v-for="(angle, angleIndex) in currentImg.angles"
                        :key="angleIndex"
                        class="grid-image-item"
                      >
                        <ShimmerImage
                          :src="angle.url"
                          img-class="grid-image"
                          object-fit="cover"
                          reveal-direction="fade"
                          wrapper-class="grid-shimmer-image"
                          @click="handlePreviewImageUrl(angle.url)"
                        />
                        <div class="angle-label">{{ angle.angle }}</div>
                      </div>
                    </div>
                    <ShimmerImage
                      v-else-if="currentImg?.url"
                      :src="currentImg.url"
                      img-class="canvas-image"
                      object-fit="contain"
                      reveal-direction="fade"
                      wrapper-class="canvas-shimmer-image"
                      @click="handlePreviewCanvasImage"
                    />
                    <div
                      v-else-if="showCurrentGeneratingPlaceholder"
                      class="canvas-empty canvas-generating"
                    >
                      <LoadingOutlined spin class="canvas-upscale-mask__icon" />
                      <p class="canvas-generating__text">{{ storyboardGenerateOverlayText }}</p>
                    </div>
                    <div v-else class="canvas-empty">还没有内容,先去左侧创建一个吧</div>
                  </div>
                </div>
              </div>
            </section>

            <!-- 右栏：模式 Tab + 生成配置（与 EditSceneImageModal 右侧一致） -->
            <aside class="stage-config-panel storyboard-stage-config">
              <div class="config-tabs">
                <button
                  type="button"
                  :class="['config-tab', { active: leftActiveTab === 'generate' }]"
                  @click="leftActiveTab = 'generate'"
                >
                  生成分镜图
                </button>
                <button
                  type="button"
                  :class="['config-tab', { active: leftActiveTab === 'dialogue' }]"
                  @click="leftActiveTab = 'dialogue'"
                >
                  对话作图
                </button>
              </div>
              <!-- Tab 以下：中间可滚动，底部「开始生图」固定在右栏 -->
              <div class="storyboard-config-below-tabs">
                <div class="storyboard-config-scroll create-modal-config-scroll">
                  <div class="config-body storyboard-config-body create-modal-config-body">
                    <div
                      v-if="leftActiveTab === 'generate'"
                      class="storyboard-left create-modal-tab-panel"
                    >
                      <StoryboardGeneratePanel
                        ref="storyboardGeneratePanelRef"
                        mode="storyboard"
                        :use-precise-layout="false"
                        :suppress-prompt-reactive-sync="storyboardPromptProgrammaticSyncDepth > 0"
                        :scene-file-name="currentScene.name"
                        :show-reference-button="true"
                        reference-display-mode="label"
                        :show-generate-prompt-button="true"
                        :generate-prompt-loading="showGeneratingPromptForScene"
                        icon-type="scene"
                        header-theme="scene-modal"
                        v-model:prompt="storyboardPrompt"
                        prompt-placeholder="描述想要生成的画面，如：一只可爱的猫咪"
                        :scene-images="sceneImages"
                        :character-images="characterImages"
                        :prop-images="propImages"
                        :other-images="otherImages"
                        :extra-prompt-assets="resolvedPromptAssets"
                        v-model:is-setting-expanded="isSettingExpanded"
                        :selected-composition="selectedComposition"
                        :selected-shot-size="selectedShotSize"
                        :selected-camera-angle="selectedCameraAngle"
                        :selected-focal-length="selectedFocalLength"
                        :selected-color-tone="selectedColorTone"
                        :selected-lighting="selectedLighting"
                        :selected-technique="selectedTechnique"
                        :composition-desc="compositionDesc"
                        v-model:active-setting-key="activeSettingKey"
                        @open-script="openStoryboardScriptEditor"
                        @generate-prompt="handleGeneratePrompt"
                        @open-select-modal="openSelectModal"
                        @remove-other-image="removeOtherImage"
                        @preview-asset-image="previewAssetImage"
                        @copy-prompt="copyStoryboardPrompt"
                        @copy-composition-desc="copyCompositionDesc"
                        @update:selected-composition="selectedComposition = $event"
                        @update:selected-shot-size="selectedShotSize = $event"
                        @update:selected-camera-angle="selectedCameraAngle = $event"
                        @update:selected-focal-length="selectedFocalLength = $event"
                        @update:selected-color-tone="selectedColorTone = $event"
                        @update:selected-lighting="selectedLighting = $event"
                        @update:selected-technique="selectedTechnique = $event"
                        @update:composition-desc="compositionDesc = $event"
                        @param-settings-confirm="applyParamSettingsConfirm"
                      >
                        <GenerateModelConfigBlock
                          v-model:aspect-ratio="generationSettings.aspectRatio"
                          v-model:count="generationSettings.count"
                          v-model:quality="generationSettings.quality"
                          :aspect-ratio-options="aspectRatioSelectOptions"
                          :count-options="countSelectOptions"
                          :quality-options="qualitySelectOptions"
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
                              @select="handleSelectModel"
                            />
                          </template>
                        </GenerateModelConfigBlock>
                      </StoryboardGeneratePanel>
                    </div>
                    <DialogueDrawPanel
                      v-if="leftActiveTab === 'dialogue'"
                      source-type="storyboard"
                      :max-source-count="1"
                      :source-images="dialogueSourceImages"
                      :instruction-html="dialogueInstructionHtml"
                      :model-value="dialogueSelectedModel"
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
                <div v-if="leftActiveTab === 'generate'" class="storyboard-config-footer">
                  <a-button
                    type="primary"
                    block
                    size="large"
                    class="generate-btn"
                    :loading="showStoryboardGenerateButtonLoading"
                    :disabled="showStoryboardGenerateButtonLoading || showGeneratingPromptForScene"
                    @click="handleStartGenerate"
                  >
                    <template #icon>
                      <img src="@/assets/img/icon/star_white.svg" alt="" />
                    </template>
                    开始生图
                  </a-button>
                </div>
                <div v-else-if="leftActiveTab === 'dialogue'" class="storyboard-config-footer">
                  <a-button
                    type="primary"
                    block
                    size="large"
                    class="generate-btn"
                    :loading="showGeneratingDialogueButton"
                    :disabled="showGeneratingDialogueButton"
                    @click="handleStartDialogueDraw"
                  >
                    <template #icon>
                      <img src="@/assets/img/icon/star_white.svg" alt="" />
                    </template>
                    开始作图
                  </a-button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>

    <!-- 资源库导入弹窗（主内容区添加分镜图） -->
    <ImportScriptModal
      v-model:open="showAssetLibraryModal"
      title="导入图片"
      accept-asset-type="image"
      @import="handleAssetLibraryImport"
    />
    <SelectSceneImageModal
      v-model:open="showDialogueImportModal"
      :scenes="props.scenes"
      :editing-scene-index="currentSceneIndex"
      multiple
      title="选择分镜画面"
      @select-multiple="handleDialogueImportMultiple"
    />
    <!-- 姿态图/表情图/特效图：直达素材库对应子库 -->
    <ImportScriptModal
      v-model:open="showMaterialFromLibraryModal"
      title="导入图片"
      :multiple="true"
      accept-asset-type="image"
      initial-tab="material"
      :initial-material-category="materialLibraryCategoryKey"
      @import-multiple="handleMaterialLibraryOtherImport"
    />

    <!-- 选择场景/角色/道具/其他 通用弹窗（多选） -->
    <SelectAssetImageModal
      v-model:open="selectAssetModalOpen"
      :type="selectAssetModalType"
      :step-tab-name="currentScene.name?.trim() || `分镜${currentSceneIndex + 1}`"
      :step-panel-images="currentSceneImages"
      @confirm="onSelectAssetConfirm"
    />

    <StoryboardScriptModal
      :key="`sb-img-${currentSceneIndex}-${scriptEditorKey}`"
      v-model:open="showStoryboardScriptModal"
      :panel-title="currentScene.name"
      :initial-content="currentScriptContentForModal"
      @save="handleSaveScriptInImageModal"
      @update:title="handleScriptTitleInImageModal"
    />
    <MultiAngleCameraModal
      v-model:open="showMultiAngleModal"
      :image-url="multiAngleImageUrl"
      fixed-nine-grid
      :model-value="nineGridSelectedModel"
      :model-options="nineGridModelOptions"
      :model-expanded="multiViewModelDropdownExpanded"
      @update:model-expanded="multiViewModelDropdownExpanded = $event"
      @select-model="handleSelectNineGridModel"
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
import {
  ref,
  computed,
  watch,
  nextTick,
  h,
  onMounted,
  onUnmounted,
  defineAsyncComponent
} from 'vue'
import { useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { openImagePreviewModal } from '~/utils/openImagePreviewModal'
import {
  ArrowLeftOutlined,
  LeftOutlined,
  PlusOutlined,
  UploadOutlined,
  FolderOutlined,
  MoreOutlined,
  DownloadOutlined,
  PictureOutlined,
  MessageOutlined,
  ThunderboltOutlined as ThunderboltIcon,
  CameraOutlined,
  DownOutlined,
  RightOutlined,
  CopyOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'
import HorizontalScrollTabBar from '~/components/common/HorizontalScrollTabBar.vue'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import HistoryRecordWrap from '~/components/common/HistoryRecordWrap.vue'
import EllipsisTooltip from '~/components/common/EllipsisTooltip.vue'
import ImportScriptModal from './ImportScriptModal.vue'
import DialogueDrawPanel from './DialogueDrawPanel.vue'
import StoryboardGeneratePanel from './StoryboardGeneratePanel.vue'
import type { ParamSettingsConfirmPayload } from './StoryboardParamSettingsModal.vue'
import GenerateModelConfigBlock from './GenerateModelConfigBlock.vue'
import StoryboardScriptModal from './StoryboardScriptModal.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import type { MultiAngleGeneratePayload } from '~/utils/multiAngleCameraPrompt'
import UpscaleModelPopover from './UpscaleModelPopover.vue'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'
import {
  collectStoryboardPromptAssets,
  mergePromptAssets,
  patchEmptyResolvedPromptAssets,
  storyboardPromptHtmlToPlain,
  storyboardPromptPlainToHtml,
  type PromptAssetItem
} from '~/utils/storyboardPromptAssetRef'
import {
  buildStoryboardPromptParamGroups,
  extractImagePromptParamSelectionsFromPlain,
  plainHasImageLabeledParamFields
} from '~/utils/storyboardPromptParamRef'
import { usePromptDictionary, PROMPT_TYPE } from '~/composables/usePromptDictionary'
import {
  userStoryboardGenerateImagePrompt,
  userStoryboardRecordDelete,
  userStoryboardSetFinalImage,
  userStoryboardUnSetFinalImage,
  userStoryboardUpload,
  userAssetRpsFormImageList
} from '~/utils/businessApi'
import {
  fetchStoryboardRecordsForStoryboard,
  clearProjectStoryboardRecordCache
} from '~/utils/storyboardRecordBatch'
import { fetchUserStoryboardDetailOnce } from '~/utils/storyboardDetailOnce'
import { useStoryboardModalHeaderTabs } from '~/composables/useStoryboardModalHeaderTabs'
import { resolveStoryboardRecordDisplayName } from '~/utils/storyboardRecordRow'
import {
  awaitStoryboardPromptGenerateTask,
  resumeStoryboardPromptGenerateTask,
  fetchStoryboardPromptPlainWithRetry,
  resolveStoryboardImageAssetsFromPlain,
  resolveStoryboardPromptAgentCode,
  resolveStoryboardPromptModelCode
} from '~/utils/storyboardPromptGenerateFlow'
import {
  STORYBOARD_GEN_CONFIG_SCENE_CODES,
  resolveStoryboardGenConfigLlmFields
} from '~/utils/projectGenConfig'
import {
  formatTaskSseJoinedLiveText,
  formatTaskSseLiveText,
  formatTaskSseLiveTextWithCounts
} from '~/utils/taskSseProgressText'
import { useCreationStore } from '~/stores/creation'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import {
  applyCreationStoreScopeLiveGenFromRoute,
  waitForCreationStoreHydrated,
  findStoryboardImageGenTaskInScopes,
  clearStoryboardImageGenTaskInAllScopes,
  resolveCurrentStep4LiveGenScopeBlobs
} from '~/composables/useCreationStoreHydration'
import { useCreateFlowScopeChangedResume } from '~/composables/useCreateFlowLiveGenResume'
import {
  modalGenSessionScopeFromScopeKey,
  modalGenSessionScopeFromStore,
  type ModalGenSessionScope
} from '~/utils/modalGenSessionScope'
import {
  runStoryboardImageUpscaleTask,
  followStoryboardImageUpscaleTask
} from '~/composables/useStoryboardImageUpscaleTask'
import {
  runStoryboardMultiViewGridImageTask,
  followStoryboardMultiViewGridImageTask
} from '~/composables/useStoryboardMultiViewGridImageTask'
import {
  followStoryboardEditImageTask,
  runStoryboardEditImageTask
} from '~/composables/useStoryboardEditImageTask'
import {
  followStoryboardImageGenerateTask,
  isStoryboardImageTaskOngoing,
  runStoryboardImageGenerateTask,
  STORYBOARD_IMAGE_GEN_SSE_COMPLETE_EVENT,
  STORYBOARD_IMAGE_GEN_SSE_TERMINAL_EVENT
} from '~/composables/useStoryboardImageGenerateTask'
import { TASK_SSE_TIMEOUT_MS, suspendTaskSseFollow } from '~/composables/useTaskSseFollow'
import { listModalTabFollowsToSuspend } from '~/utils/modalTabSseMutex'
import {
  buildModalTaskOverlayKey,
  matchesAnyModalTaskOverlayKey,
  matchesModalTaskOverlayKey
} from '~/composables/useModalTaskScope'
import { useModelList } from '~/composables/useModelList'
import { mapUserModelListItemToModelOption } from '~/utils/userModelOption'
import { useModelGenerateSettings } from '~/composables/useModelGenerateSettings'
import {
  AI_MODEL_FUNC_CODE,
  IMAGE_MULTI_GRID_FUNC_CODE_FALLBACKS,
  STORYBOARD_IMAGE_FUNC_CODE_FALLBACKS
} from '~/utils/aiModelFuncCodes'
import {
  clearAgentDefaultModelCache,
  fetchAgentDefaultModelCodes,
  getAgentDefaultModelCacheKey,
  resolvePreferredModelIdFromAgentCodes,
  resolveSelectedModelOption,
  STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY,
  STORYBOARD_IMAGE_PROMPT_AGENT_BIZ_CATEGORY
} from '~/utils/extractAgentBiz'
import { userModelListByFuncCodes } from '~/utils/businessApi'
import {
  modelsFromListByFuncGroups,
  pickFirstNonEmptyModelPool,
  uniqueTrimmedCodes
} from '~/utils/modelListByFuncBatch'
import { buildAidAgentListScopeParams } from '~/utils/createFlowProjectContext'
import {
  isStoryboardImageSelected,
  pickStoryboardCoverImage,
  sortStoryboardImagesForParent
} from '~/utils/storyboardImageCover'
import type { StoryboardRecordRow, UserModelListItem } from '~/types/business-api'
import {
  isPendingStoryboardRecord,
  findPendingStoryboardRecordTaskId,
  findPendingStoryboardRecordId
} from '~/utils/storyboardRecordPending'
import { htmlToPlainText } from '~/utils/htmlPlain'
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
import deleteIcon from '@/assets/img/icon/del-black.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'

/** 子弹窗异步拆分：不阻塞编辑弹窗本体首帧渲染 */
const SelectSceneImageModal = defineAsyncComponent(() => import('./SelectSceneImageModal.vue'))
const SelectAssetImageModal = defineAsyncComponent(() => import('./SelectAssetImageModal.vue'))
const MultiAngleCameraModal = defineAsyncComponent(() => import('./MultiAngleCameraModal.vue'))
const TouchEditModal = defineAsyncComponent(() => import('./TouchEditModal.vue'))

interface Props {
  open: boolean
  sceneIndex: number
  initialImageIndex?: number | null
  scenes: Array<{
    name: string
    images?: any[]
    scriptContent?: string
    storyboardId?: number | string
  }>
  /** 弹窗实例作用域，配合 storyboardId 隔离不同分镜的生图 loading */
  editorScopeKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  editorScopeKey: 'storyboard-image'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  update: [sceneIndex: number, data: any]
}>()

const route = useRoute()
const creationStore = useCreationStore()

const { headerTabs, refreshHeaderTabs } = useStoryboardModalHeaderTabs({
  open: () => props.open,
  recordType: 'image',
  // 打开/切 Tab 由 syncSceneDetailAndRestore 统一 force 一次，避免与画布刷新双打
  autoRefreshOnOpen: false,
  scenes: () =>
    props.scenes.map((scene) => ({
      name: scene.name,
      storyboardId: scene.storyboardId
    })),
  creationStore,
  route,
  headerOptions: () => ({
    resolveFallbackThumbnailUrl: (sceneIndex) => {
      const cover = pickStoryboardCoverImage(props.scenes[sceneIndex]?.images)
      return String(cover?.url || cover?.thumbnail || '').trim()
    }
  })
})

const headerTabsForDisplay = computed(() => {
  if (headerTabs.value.length) return headerTabs.value
  return props.scenes.map((scene, sceneIndex) => ({
    sceneIndex,
    storyboardId: Number.isFinite(Number(scene.storyboardId))
      ? Number(scene.storyboardId)
      : undefined,
    name: scene.name,
    thumbnailUrl: String(
      pickStoryboardCoverImage(scene.images)?.url ||
        pickStoryboardCoverImage(scene.images)?.thumbnail ||
        ''
    ).trim(),
    hasFinalAsset: false
  }))
})

function storyboardImageModalSessionScope() {
  return modalGenSessionScopeFromStore(creationStore)
}

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const currentSceneIndex = ref(props.sceneIndex)

function resolveStoryboardIdForSceneIndex(sceneIdx: number): string {
  const raw = props.scenes[sceneIdx]?.storyboardId
  const id = Number(raw)
  if (Number.isFinite(id) && id > 0) return String(id)
  return `idx-${sceneIdx}`
}

function overlayKeyParts(sceneIdx: number, imgIdx: number, taskKind: string) {
  return {
    editorScopeKey: props.editorScopeKey,
    sceneIdx,
    entityId: resolveStoryboardIdForSceneIndex(sceneIdx),
    itemIdx: imgIdx,
    taskKind
  }
}

const storyboardGenerateTargetKey = ref('')
const promptGenerateTargetKey = ref('')
let resumeStoryboardImageFollowGen = 0
let resumeStoryboardPromptFollowGen = 0
let resumeDialogueFollowGen = 0
const activePromptFollowStoryboardIds = new Set<number>()
let resumeCanvasOverlayFollowGen = 0

import {
  clearModalImageGenSession,
  clearModalImageGenUserDismissed,
  isModalImageGenSessionActive,
  isModalImageGenUserDismissed,
  markModalImageGenUserDismissed,
  persistModalImageGenSession,
  readModalImageGenSession,
  type ModalImageGenSessionTab
} from '~/utils/storyboardImageModalGenSession'
import { resolveStoryboardImageModalCloseDismiss } from '~/utils/storyboardImageModalAutoReopen'
import {
  activeStoryboardImageModalGenFollowIds,
  activeStoryboardImageModalDialogueFollowIds,
  activeStoryboardImageModalOverlayFollowIds,
  releaseStoryboardImageModalLiveOwned
} from '~/utils/storyboardImageModalOwnedFollow'

const activeStoryboardImageFollowStoryboardIds = activeStoryboardImageModalGenFollowIds
const activeDialogueFollowStoryboardIds = activeStoryboardImageModalDialogueFollowIds
const activeCanvasOverlayFollowStoryboardIds = activeStoryboardImageModalOverlayFollowIds

function getModalImageGenTask(storyboardId: number) {
  return findStoryboardImageGenTaskInScopes(creationStore, storyboardId, route)
}

function isDialogueModalTask(task: ReturnType<typeof getModalImageGenTask>): boolean {
  return task?.kind === 'dialogue'
}

function isCanvasOverlayModalTask(
  task: ReturnType<typeof getModalImageGenTask> | null | undefined
): boolean {
  return task?.kind === 'upscale' || task?.kind === 'multiangle' || task?.kind === 'ninegrid'
}

function sceneHasCompletedGeneratedImage(sceneIdx: number): boolean {
  const images = props.scenes[sceneIdx]?.images ?? []
  return images.some((img) => {
    const url = String(img?.url ?? img?.thumbnail ?? '').trim()
    return !!url && !img?._generating
  })
}

function hasActiveModalImageGenSession(storyboardId: number): boolean {
  return isModalImageGenSessionActive(storyboardId, storyboardImageModalSessionScope())
}

function clearStoryboardPanelImageGenerating(storyboardId: number) {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return
  // 弹窗收尾不能误清同一分镜正在进行的列表批量任务。
  if (
    creationStore.isGeneratingStoryboardImageBatch ||
    creationStore.storyboardImageBatchActiveTaskId != null ||
    creationStore.storyboardImageBatchActiveImageTaskId != null ||
    creationStore.storyboardImageBatchTargetStoryboardIds.includes(sid)
  ) {
    return
  }
  creationStore.clearStoryboardPanelImageGenStatus(sid)
}

function readSessionForScene(sceneIdx: number) {
  const session = readModalImageGenSession(storyboardImageModalSessionScope())
  if (
    !session ||
    isModalImageGenUserDismissed(session.storyboardId, storyboardImageModalSessionScope())
  )
    return null
  if (session.sceneIdx !== sceneIdx) return null
  return session
}

function isModalOverlaySessionTab(tab?: ModalImageGenSessionTab): boolean {
  return tab === 'upscale' || tab === 'multiangle' || tab === 'ninegrid'
}

function isModalStoryboardGenerateSession(
  session: ReturnType<typeof readSessionForScene>
): boolean {
  if (!session) return false
  return session.tab === 'generate' || !session.tab
}

/** 当前分镜是否应走「生成分镜图」恢复（排除对话/变清晰/多机位/九宫格） */
function shouldRestoreStoryboardImageGenerate(sceneIdx: number): boolean {
  const session = readSessionForScene(sceneIdx)
  if (session?.tab === 'dialogue' || isModalOverlaySessionTab(session?.tab)) {
    return false
  }
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return false
  const task = getModalImageGenTask(storyboardId)
  if (isDialogueModalTask(task) || isCanvasOverlayModalTask(task)) return false
  return true
}

function clearStaleStoryboardGenUiForScene(sceneIdx: number) {
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid != null && activeStoryboardImageFollowStoryboardIds.has(sid)) return

  const overlayKey = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, -1, 'storyboard-gen'))
  if (storyboardGenerateTargetKey.value === overlayKey) {
    storyboardGenerateTargetKey.value = ''
  }
  if (!activeStoryboardImageFollowStoryboardIds.size) {
    isGeneratingStoryboardImage.value = false
  }
  storyboardGenerateProgressText.value = '分镜图生成中…'
}

function isStoryboardImageGenerationInProgress(storyboardId: number): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  const task = getModalImageGenTask(storyboardId)
  if (isDialogueModalTask(task) || isCanvasOverlayModalTask(task)) return false
  if (activeStoryboardImageFollowStoryboardIds.has(sid)) return true
  if (task) return true
  const session = readModalImageGenSession(storyboardImageModalSessionScope())
  return (
    session?.storyboardId === sid &&
    (session.tab === 'generate' || !session.tab) &&
    hasActiveModalImageGenSession(storyboardId)
  )
}

function isDialogueGenerationInProgress(storyboardId: number): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  const task = getModalImageGenTask(storyboardId)
  if (isDialogueModalTask(task)) return true
  if (activeDialogueFollowStoryboardIds.has(sid)) return true
  const session = readModalImageGenSession(storyboardImageModalSessionScope())
  return (
    session?.storyboardId === sid &&
    session.tab === 'dialogue' &&
    hasActiveModalImageGenSession(storyboardId)
  )
}

function isModalOverlayGenerationInProgress(storyboardId: number): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  const task = getModalImageGenTask(storyboardId)
  if (isCanvasOverlayModalTask(task)) return true
  if (activeCanvasOverlayFollowStoryboardIds.has(sid)) return true
  const session = readModalImageGenSession(storyboardImageModalSessionScope())
  return (
    session?.storyboardId === sid &&
    isModalOverlaySessionTab(session.tab) &&
    hasActiveModalImageGenSession(storyboardId)
  )
}

function sceneStoryboardIdNum(sceneIdx: number): number | null {
  const id = Number(props.scenes[sceneIdx]?.storyboardId)
  if (Number.isFinite(id) && id > 0) return id
  const session = readSessionForScene(sceneIdx)
  if (session) return session.storyboardId
  return null
}

/** 弹窗单镜生图/对话作图任务绑定的 sceneIdx（避免污染其它分镜 tab） */
function resolveModalImageGenOwnerSceneIdx(storyboardId: number): number | null {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return null

  const task = getModalImageGenTask(sid)
  const session = readModalImageGenSession(storyboardImageModalSessionScope())
  const hasActiveGen =
    activeStoryboardImageFollowStoryboardIds.has(sid) ||
    activeDialogueFollowStoryboardIds.has(sid) ||
    activeCanvasOverlayFollowStoryboardIds.has(sid) ||
    !!task ||
    (session?.storyboardId === sid && hasActiveModalImageGenSession(sid))
  if (!hasActiveGen) return null

  if (task?.sceneIdx != null && Number.isFinite(task.sceneIdx)) {
    return task.sceneIdx
  }
  if (session?.storyboardId === sid && Number.isFinite(session.sceneIdx)) {
    return session.sceneIdx
  }
  const idx = props.scenes.findIndex((_, i) => sceneStoryboardIdNum(i) === sid)
  return idx >= 0 ? idx : null
}

function isModalImageGenOwnerScene(sceneIdx: number): boolean {
  const session = readSessionForScene(sceneIdx)
  if (session) return true
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null) return false
  return resolveModalImageGenOwnerSceneIdx(sid) === sceneIdx
}

function hasModalImageGenPendingState(storyboardId: number): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  if (hasActiveModalImageGenSession(sid)) return true
  if (getModalImageGenTask(sid)) return true
  if (activeStoryboardImageFollowStoryboardIds.has(sid)) return true
  if (activeDialogueFollowStoryboardIds.has(sid)) return true
  if (activeCanvasOverlayFollowStoryboardIds.has(sid)) return true
  return false
}

function isAnyModalGenerationPendingForScene(sceneIdx: number): boolean {
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null) return false
  return (
    isStoryboardImageGenerationInProgress(sid) ||
    isDialogueGenerationInProgress(sid) ||
    isModalOverlayGenerationInProgress(sid) ||
    activeStoryboardImageFollowStoryboardIds.has(sid) ||
    activeDialogueFollowStoryboardIds.has(sid) ||
    activeCanvasOverlayFollowStoryboardIds.has(sid)
  )
}

function syncModalImageGenSessionTaskId(
  storyboardId: number,
  sceneIdx: number,
  taskId: number,
  extra?: { tab?: ModalImageGenSessionTab; imageIdx?: number },
  sessionScope?: ModalGenSessionScope | null,
  scopeKey?: string
) {
  const targetSessionScope = sessionScope ?? storyboardImageModalSessionScope()
  const session = readModalImageGenSession(targetSessionScope)
  persistModalImageGenSession(
    storyboardId,
    sceneIdx,
    scopeKey ?? session?.scopeKey ?? creationStore.step3GenVisualScopeKey(),
    {
      tab: extra?.tab ?? session?.tab ?? 'generate',
      imageIdx: extra?.imageIdx ?? session?.imageIdx,
      taskId
    },
    targetSessionScope
  )
}

/** 提交响应晚于项目切换时，任务仍归提交作用域，并在 SSE owner 建立后立即挂起。 */
function suspendLateModalImageFollowIfScopeChanged(
  taskId: number,
  taskScope: ReturnType<typeof captureCreationLiveGenScope>
) {
  if (!import.meta.client) return
  queueMicrotask(() => {
    if (!matchesCreationLiveGenScope(taskScope)) suspendTaskSseFollow(taskId)
  })
}

/** 当前分镜是否处于弹窗单镜生图/对话作图中（含刷新恢复态） */
function isSceneModalImageGenerating(sceneIdx: number): boolean {
  if (!isModalImageGenOwnerScene(sceneIdx)) return false
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null) return false
  if (isModalImageGenUserDismissed(sid, storyboardImageModalSessionScope())) return false
  return (
    isStoryboardImageGenerationInProgress(sid) ||
    isDialogueGenerationInProgress(sid) ||
    isModalOverlayGenerationInProgress(sid)
  )
}

function clearStaleModalGeneratingPlaceholders() {
  for (let i = 0; i < props.scenes.length; i++) {
    if (!isModalImageGenOwnerScene(i)) {
      clearLocalGeneratingPlaceholdersForScene(i)
    }
  }
}

function isHistoryItemMain(imageIndex: number): boolean {
  const img = currentSceneImages.value[imageIndex]
  return isStoryboardImageSelected(img)
}

function canSetMainFromHistory(imageIndex: number): boolean {
  const img = currentSceneImages.value[imageIndex] as { url?: string } | undefined
  // 与编辑分镜视频一致：有可展示 URL 即可设主图；无 recordId 时会在确认时先 upload 落库
  if (!img?.url || isHistoryItemGenerating(imageIndex) || isHistoryItemMain(imageIndex))
    return false
  return true
}

async function handleSetMainFromHistory(imageIndex: number) {
  if (isSettingFinalImage.value) return
  currentImageIndex.value = imageIndex
  await handleConfirmAddImage(imageIndex)
}

function isHistoryItemGenerating(imageIndex: number): boolean {
  if (!isSceneModalImageGenerating(currentSceneIndex.value)) return false
  const images = currentSceneImages.value
  const img = images[imageIndex]
  if (img?._generating) return true

  const sid = currentStoryboardId.value
  const session = readSessionForScene(currentSceneIndex.value)
  const hasPendingRecord = images.some((item) => item?._generating)

  // 变清晰/多机位/九宫格会新增生成记录：有 pending 时仅在其上展示；否则展示本地占位
  if (sid != null && isModalOverlayGenerationInProgress(sid)) {
    if (hasPendingRecord) return false
    const placeholderIdx = images.findIndex((item) => item?._localGeneratingPlaceholder)
    if (placeholderIdx >= 0) return imageIndex === placeholderIdx
    return false
  }

  if (sid != null && isDialogueGenerationInProgress(sid)) {
    if (hasPendingRecord) return false
    const targetIdx = session?.imageIdx ?? currentImageIndex.value
    return imageIndex === targetIdx
  }

  const pendingIdx = images.findIndex((item) => item?._generating)
  if (pendingIdx >= 0) return imageIndex === pendingIdx
  return imageIndex === currentImageIndex.value
}

function removeLocalGeneratingPlaceholders(images: any[]): any[] {
  return images.filter((img) => !img?._localGeneratingPlaceholder)
}

function appendLocalGeneratingPlaceholder(next: any[], sid: number): any[] {
  return [
    ...next,
    {
      id: `local-generating-${sid}-${Date.now()}`,
      url: '',
      thumbnail: '',
      title: STORYBOARD_GENERATED_IMAGE_DEFAULT_TITLE,
      _generating: true,
      _localGeneratingPlaceholder: true
    }
  ]
}

function ensureGeneratingPlaceholderImage(sceneIdx: number) {
  const images = [...(props.scenes[sceneIdx]?.images || [])]
  const pendingIdx = images.findIndex((img) => img?._generating)
  if (pendingIdx >= 0) {
    if (sceneIdx === currentSceneIndex.value) currentImageIndex.value = pendingIdx
    return
  }
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null) return
  const next = appendLocalGeneratingPlaceholder(images, sid)
  emit('update', sceneIdx, { images: next })
  if (sceneIdx === currentSceneIndex.value) {
    currentImageIndex.value = next.length - 1
  }
}

/** 变清晰/多机位/九宫格：在生成记录末尾补 loading 占位，不改变当前画布选中图 */
function ensureOverlayGeneratingPlaceholderImage(sceneIdx: number) {
  const images = [...(props.scenes[sceneIdx]?.images || [])]
  if (images.some((img) => img?._generating)) return
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null) return
  emit('update', sceneIdx, { images: appendLocalGeneratingPlaceholder(images, sid) })
}

function clearLocalGeneratingPlaceholdersForScene(sceneIdx: number) {
  const images = props.scenes[sceneIdx]?.images || []
  const next = removeLocalGeneratingPlaceholders(images)
  if (next.length !== images.length) {
    emit('update', sceneIdx, { images: next })
    if (sceneIdx === currentSceneIndex.value && currentImageIndex.value >= next.length) {
      currentImageIndex.value = Math.max(0, next.length - 1)
    }
  }
}

/** 拉取服务端记录后，若任务仍在进行则保留/补回本地 generating 占位，避免有图时刷新丢失 loading */
function finalizeMappedImagesWhileGenerating(sceneIdx: number, mapped: any[]): any[] {
  let next = removeLocalGeneratingPlaceholders(mapped)
  if (next.some((m) => m?._generating)) {
    return next
  }

  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null || isModalImageGenUserDismissed(sid, storyboardImageModalSessionScope())) {
    return next
  }

  const stillGenerating =
    isStoryboardImageGenerationInProgress(sid) || isDialogueGenerationInProgress(sid)
  if (!stillGenerating || !isModalImageGenOwnerScene(sceneIdx)) {
    return next
  }

  const task = getModalImageGenTask(sid)
  if (isDialogueModalTask(task)) {
    return next
  }

  const session = readSessionForScene(sceneIdx)
  if (session?.tab === 'dialogue') {
    return next
  }
  if (isModalOverlaySessionTab(session?.tab)) {
    if (next.some((m) => m?._generating)) return next
    if (isModalOverlayGenerationInProgress(sid) && isModalImageGenOwnerScene(sceneIdx)) {
      return appendLocalGeneratingPlaceholder(next, sid)
    }
    return next
  }

  return appendLocalGeneratingPlaceholder(next, sid)
}

function isModalStoryboardImageUiActive(
  storyboardId: number | null | undefined,
  sceneIdx?: number
): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  if (isModalImageGenUserDismissed(sid, storyboardImageModalSessionScope())) return false
  const task = getModalImageGenTask(storyboardId)
  if (isDialogueModalTask(task) || isCanvasOverlayModalTask(task)) return false
  if (activeStoryboardImageFollowStoryboardIds.has(sid)) return true
  if (task) return true
  if (
    hasActiveModalImageGenSession(storyboardId) &&
    readModalImageGenSession(storyboardImageModalSessionScope())?.tab !== 'dialogue' &&
    !isModalOverlaySessionTab(readModalImageGenSession(storyboardImageModalSessionScope())?.tab)
  ) {
    return true
  }
  if (
    sceneIdx != null &&
    matchesModalTaskOverlayKey(
      storyboardGenerateTargetKey.value,
      overlayKeyParts(sceneIdx, -1, 'storyboard-gen')
    )
  ) {
    return true
  }
  return false
}

function clearModalStoryboardImageGenTaskEverywhere(storyboardId: number) {
  clearStoryboardImageGenTaskInAllScopes(creationStore, storyboardId, route)
}

function clearModalStoryboardImageLoadingUi(storyboardId: number, sceneIdx: number) {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return

  clearModalStoryboardImageGenTaskEverywhere(sid)
  clearModalImageGenSession(storyboardImageModalSessionScope())
  clearModalImageGenUserDismissed(storyboardImageModalSessionScope())
  activeStoryboardImageFollowStoryboardIds.delete(sid)
  clearStoryboardPanelImageGenerating(sid)

  if (!activeStoryboardImageFollowStoryboardIds.size) {
    isGeneratingStoryboardImage.value = false
  }

  const overlayKey = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, -1, 'storyboard-gen'))
  if (storyboardGenerateTargetKey.value === overlayKey) {
    storyboardGenerateTargetKey.value = ''
  }
  storyboardGenerateProgressText.value = '分镜图生成中…'
  clearLocalGeneratingPlaceholdersForScene(sceneIdx)
}

function clearModalDialogueLoadingUi(storyboardId: number, sceneIdx: number, imageIdx: number) {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return

  creationStore.clearStoryboardImageGenTask(sid)
  clearModalImageGenSession(storyboardImageModalSessionScope())
  clearModalImageGenUserDismissed(storyboardImageModalSessionScope())
  activeDialogueFollowStoryboardIds.delete(sid)
  clearStoryboardPanelImageGenerating(sid)

  endCanvasTaskOverlay()
  clearLocalGeneratingPlaceholdersForScene(sceneIdx)
  void imageIdx
}

/** 用户主动关闭弹窗：仅清除对话作图 UI，后台任务继续在弹窗外执行 */
function dismissModalDialogueUi(storyboardId: number, sceneIdx: number, imageIdx: number) {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return

  markModalImageGenUserDismissed(sid, storyboardImageModalSessionScope())
  clearModalImageGenSession(storyboardImageModalSessionScope())
  releaseStoryboardImageModalLiveOwned(sid)

  const overlayKey = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, imageIdx, 'dialogue'))
  if (upscaleTargetKey.value === overlayKey) {
    endCanvasTaskOverlay()
  }
}

/** 用户主动关闭弹窗：仅清除弹窗 UI，后台任务继续在弹窗外执行 */
function dismissModalStoryboardImageUi(storyboardId: number, sceneIdx: number) {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return

  markModalImageGenUserDismissed(sid, storyboardImageModalSessionScope())
  clearModalImageGenSession(storyboardImageModalSessionScope())
  releaseStoryboardImageModalLiveOwned(sid)

  if (!activeStoryboardImageFollowStoryboardIds.size) {
    isGeneratingStoryboardImage.value = false
  }

  const overlayKey = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, -1, 'storyboard-gen'))
  if (storyboardGenerateTargetKey.value === overlayKey) {
    storyboardGenerateTargetKey.value = ''
  }
  storyboardGenerateProgressText.value = '分镜图生成中…'
}

/** 同步恢复变清晰/多机位/九宫格画布 loading（不等待 API） */
function primeCanvasOverlayFromSession(sceneIdx: number) {
  const session = readSessionForScene(sceneIdx)
  if (!session || !isModalOverlaySessionTab(session.tab)) return

  const imageIdx = session.imageIdx ?? currentImageIndex.value
  const tab = session.tab as Extract<ModalImageGenSessionTab, 'upscale' | 'multiangle' | 'ninegrid'>
  const defaultText =
    tab === 'upscale' ? '高清处理中…' : tab === 'ninegrid' ? '九宫格生图中...' : '多机位生图中...'

  if (sceneIdx === currentSceneIndex.value) {
    currentImageIndex.value = imageIdx
  }

  beginCanvasTaskOverlay(sceneIdx, imageIdx, tab, defaultText, { persistSession: false })
}

function ensureModalSessionFromStoreTask(sceneIdx: number) {
  if (readSessionForScene(sceneIdx)) return
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return
  const task = getModalImageGenTask(storyboardId)
  if (!task) return
  const tab: ModalImageGenSessionTab =
    task.kind === 'dialogue'
      ? 'dialogue'
      : task.kind === 'upscale'
        ? 'upscale'
        : task.kind === 'ninegrid'
          ? 'ninegrid'
          : task.kind === 'multiangle'
            ? 'multiangle'
            : 'generate'
  persistModalImageGenSession(storyboardId, sceneIdx, creationStore.step3GenVisualScopeKey(), {
    tab,
    imageIdx: task.imageIdx,
    taskId: task.taskId
  })
}

/** 等待 Pinia 持久化恢复后，同步还原弹窗内 loading 状态，并联动分镜列表卡片 loading */
async function ensureModalLoadingRestored(sceneIdx: number) {
  await waitForCreationStoreHydrated(creationStore, route)
  applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
  ensureModalSessionFromStoreTask(sceneIdx)
  clearStaleModalGeneratingPlaceholders()
  if (!isModalImageGenOwnerScene(sceneIdx)) return
  primeStoryboardImageLoadingUi(sceneIdx)
  primeDialogueLoadingUi(sceneIdx)
  primeCanvasOverlayFromSession(sceneIdx)
}

function isStoryboardPanelImageGenerating(storyboardId: number | null | undefined): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  return creationStore.storyboardPanelImageGenStatusByStoryboardId[String(sid)] === 'generating'
}

/** 同步恢复弹窗内 loading UI（不等待 API），避免刷新后打开弹窗时按钮/画布无 loading */
function primeStoryboardImageLoadingUi(sceneIdx: number) {
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return
  if (isModalImageGenUserDismissed(storyboardId, storyboardImageModalSessionScope())) return
  if (!isModalImageGenOwnerScene(sceneIdx)) return

  const task = getModalImageGenTask(storyboardId)
  if (isDialogueModalTask(task) || isCanvasOverlayModalTask(task)) return

  const session = readSessionForScene(sceneIdx)
  const hasPendingTask = !!task
  const sessionActive =
    !!session &&
    session.storyboardId === storyboardId &&
    (session.tab === 'generate' || !session.tab) &&
    hasActiveModalImageGenSession(storyboardId)
  const isFollowing = activeStoryboardImageFollowStoryboardIds.has(storyboardId)
  if (!hasPendingTask && !sessionActive && !isFollowing) return

  const overlayKey = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, -1, 'storyboard-gen'))
  storyboardGenerateTargetKey.value = overlayKey
  isGeneratingStoryboardImage.value = true
  const batchLive = formatTaskSseLiveTextWithCounts(
    creationStore.storyboardImageBatchProgress,
    '分镜图生成中'
  )
  const singleLive = formatTaskSseLiveText(task || {}, '')
  if (singleLive || (creationStore.isGeneratingStoryboardImageBatch && batchLive)) {
    storyboardGenerateProgressText.value = singleLive || batchLive
  }

  const hasGeneratingRow = (props.scenes[sceneIdx]?.images || []).some((img) => img?._generating)
  if (!hasGeneratingRow) {
    ensureGeneratingPlaceholderImage(sceneIdx)
  }
}

/** 同步恢复对话作图画布 loading（不等待 API） */
function primeDialogueLoadingUi(sceneIdx: number) {
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return
  if (isModalImageGenUserDismissed(storyboardId, storyboardImageModalSessionScope())) return
  if (!isModalImageGenOwnerScene(sceneIdx)) return

  const task = getModalImageGenTask(storyboardId)
  const session = readSessionForScene(sceneIdx)
  const isDialogue = isDialogueModalTask(task) || session?.tab === 'dialogue'
  if (!isDialogue) return
  const isFollowing = activeDialogueFollowStoryboardIds.has(storyboardId)
  const sessionActive =
    !!session && session.tab === 'dialogue' && hasActiveModalImageGenSession(storyboardId)
  if (!task && !isFollowing && !sessionActive) return

  const imageIdx = task?.imageIdx ?? session?.imageIdx ?? currentImageIndex.value
  if (sceneIdx === currentSceneIndex.value) {
    leftActiveTab.value = 'dialogue'
    currentImageIndex.value = imageIdx
  }

  upscaleTargetKey.value = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, imageIdx, 'dialogue'))
  upscaleUiPhase.value = 'running'
  canvasOverlayTaskKind.value = 'dialogue'
  const live = formatTaskSseLiveText(task || {}, '')
  upscaleProgressText.value = live || '对话作图中...'
}

const sceneTabBarRef = ref<InstanceType<typeof HorizontalScrollTabBar> | null>(null)
type CanvasToolbarKey = 'drawing' | 'chat' | 'hd' | 'camera' | 'add'
const canvasToolbarHoverKey = ref<CanvasToolbarKey | null>(null)
const canvasToolbarIconMap: Record<CanvasToolbarKey, { nor: string; sel: string }> = {
  drawing: { nor: drawingNorIcon, sel: drawingSelIcon },
  chat: { nor: chatNorIcon, sel: chatSelIcon },
  hd: { nor: hdNorIcon, sel: hdSelIcon },
  camera: { nor: cameraNorIcon, sel: cameraSelIcon },
  add: { nor: addIcon, sel: addSelIcon }
}
const getCanvasToolbarIcon = (key: CanvasToolbarKey) =>
  canvasToolbarHoverKey.value === key
    ? canvasToolbarIconMap[key].sel
    : canvasToolbarIconMap[key].nor

// 左侧 Tab：生成分镜图 / 对话作图
const leftActiveTab = ref<'generate' | 'dialogue'>('generate')
const showStoryboardScriptModal = ref(false)
/** 每次打开分镜脚本编辑时递增，保证与列表最新 scriptContent 对齐 */
const scriptEditorKey = ref(0)

function openStoryboardScriptEditor() {
  scriptEditorKey.value += 1
  showStoryboardScriptModal.value = true
}

// 生成设置与模型
const modelDropdownExpanded = ref(false)
let initImageModelGen = 0
const cachedStoryboardImageAgentModelCodes = ref<string[]>([])
type DialogueSourceImage = { url: string; title?: string }
const dialogueSourceImages = ref<DialogueSourceImage[]>([])
const dialogueInstructionHtml = ref('')
const showDialogueImportModal = ref(false)
const dialogueModelDropdownExpanded = ref(false)
const dialogueSettings = ref({
  model: '',
  aspectRatio: '16:9',
  count: 1,
  quality: '2k'
})
const generationSettings = ref({
  model: '',
  aspectRatio: '16:9',
  count: 1,
  quality: '3k'
})

const fallbackModelOptions: ModelOption[] = [
  {
    id: 'dream-5.0-lite',
    name: '即梦5.0lite',
    iconBg: '#60A5FA',
    tag: '性价比最高',
    tagType: 'cost-effective',
    desc: '原生文字精准渲染、复杂逻辑推理',
    prices: [
      { resolution: '2k', cost: 4 },
      { resolution: '3k', cost: 4 }
    ]
  },
  {
    id: 'dream-4.5',
    name: '即梦4.5',
    iconBg: '#60A5FA',
    desc: '原生文字精准渲染、复杂逻辑推理',
    prices: [
      { resolution: '2k', cost: 3 },
      { resolution: '4k', cost: 3 }
    ]
  },
  {
    id: 'dream-4.0',
    name: '即梦4.0',
    iconBg: '#60A5FA',
    desc: '兼顾清晰度与美感,日常出图优选',
    prices: [
      { resolution: '2k', cost: 2 },
      { resolution: '4k', cost: 2 }
    ]
  }
]

function mapStoryboardModalModelItem(
  item: Parameters<typeof mapUserModelListItemToModelOption>[0]
): ModelOption {
  return mapUserModelListItemToModelOption(item, { iconBg: '#60A5FA' })
}

const {
  modelList: modelOptions,
  rawModelList
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.STORYBOARD_IMAGE,
  funcCodeFallbacks: STORYBOARD_IMAGE_FUNC_CODE_FALLBACKS,
  modelType: 'image',
  projectId: () => creationStore.currentProjectId,
  episodeId: () => creationStore.currentEpisodeId,
  fallback: fallbackModelOptions,
  mapItem: mapStoryboardModalModelItem,
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载模型列表失败，已使用默认模型')
  }
})

const selectedModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(modelOptions.value, generationSettings.value.model)
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

const { aspectRatioSelectOptions, countSelectOptions, qualitySelectOptions, syncSettingsToModel } =
  useModelGenerateSettings({
    selectedModel,
    rawModelList,
    generationSettings: generationSettingsForCapability,
    include3k: true
  })

const handleSelectModel = (model: ModelOption) => {
  generationSettings.value.model = model.id
  modelDropdownExpanded.value = false
  syncSettingsToModel()
}

const {
  modelList: dialogueModelOptions,
  rawModelList: dialogueRawModelList
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.IMAGE_EDIT,
  modelType: 'image',
  fallback: fallbackModelOptions,
  mapItem: mapStoryboardModalModelItem,
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载对话作图模型失败，已使用默认模型')
  }
})

const dialogueSelectedModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(dialogueModelOptions.value, dialogueSettings.value.model)
)

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
  selectedModel: dialogueSelectedModel,
  rawModelList: dialogueRawModelList,
  generationSettings: dialogueSettingsForCapability,
  include3k: true
})

/** 接口限制 imageCount 为 1~4 */
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

function handleSelectDialogueModel(model: ModelOption) {
  dialogueSettings.value.model = model.id
  dialogueModelDropdownExpanded.value = false
  syncDialogueSettingsToModel()
}

const multiViewModelDropdownExpanded = ref(false)

/** 变清晰：listByFunc(image_upscale) 模型池 */
const upscaleModelPool = ref<UserModelListItem[]>([])

function handleSelectNineGridModel(model: ModelOption) {
  nineGridSettings.value.model = model.id
  multiViewModelDropdownExpanded.value = false
}

function applyStoryboardImageModelDefault(options: ModelOption[], agentDefaultCodes: string[]) {
  if (!options.length) return
  generationSettings.value.model = resolvePreferredModelIdFromAgentCodes(options, {
    agentDefaultCodes
  })
  syncSettingsToModel()
}

function applyStoryboardDialogueModelDefault(options: ModelOption[], agentDefaultCodes: string[]) {
  if (!options.length) return
  dialogueSettings.value.model = resolvePreferredModelIdFromAgentCodes(options, {
    agentDefaultCodes
  })
  syncDialogueSettingsToModel()
}

function reapplyStoryboardImageModelDefaultIfEmpty() {
  if (!props.open) return
  const codes = cachedStoryboardImageAgentModelCodes.value
  if (!String(generationSettings.value.model || '').trim() && modelOptions.value.length) {
    applyStoryboardImageModelDefault(modelOptions.value, codes)
  }
  if (!String(dialogueSettings.value.model || '').trim() && dialogueModelOptions.value.length) {
    applyStoryboardDialogueModelDefault(dialogueModelOptions.value, codes)
  }
}

async function initImageModelOptions() {
  const gen = ++initImageModelGen
  clearAgentDefaultModelCache()
  /** 分镜图出片池 main_storyboard_image；优先用同 scope 已选分镜图提示词智能体 agentCode 在对应分组内匹配 modelCode */
  const storyboardImageAgentCode = String(
    creationStore.storyboardStylistGenerateSettings?.agentId ||
      creationStore.storyboardStylistAgent?.id ||
      ''
  ).trim()

  const storyboardImageFuncCodes = [
    AI_MODEL_FUNC_CODE.STORYBOARD_IMAGE,
    ...STORYBOARD_IMAGE_FUNC_CODE_FALLBACKS
  ]
  const funcCodes = uniqueTrimmedCodes([
    ...storyboardImageFuncCodes,
    AI_MODEL_FUNC_CODE.IMAGE_EDIT,
    AI_MODEL_FUNC_CODE.IMAGE_MULTI_VIEW,
    AI_MODEL_FUNC_CODE.IMAGE_UPSCALE,
    ...IMAGE_MULTI_GRID_FUNC_CODE_FALLBACKS
  ])
  const listScope = buildAidAgentListScopeParams(creationStore)
  const agentPayloads = [
    {
      bizCategoryCode: STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY,
      agentCode: storyboardImageAgentCode,
      ...listScope
    },
    {
      bizCategoryCode: STORYBOARD_IMAGE_PROMPT_AGENT_BIZ_CATEGORY,
      agentCode: storyboardImageAgentCode,
      ...listScope
    }
  ]

  const [agentCodes, modelGroups] = await Promise.all([
    fetchAgentDefaultModelCodes(agentPayloads),
    userModelListByFuncCodes(funcCodes, listScope)
  ])

  if (gen !== initImageModelGen) return

  // 批量 listByFunc 已请求过各池；空结果不再用不同入参单码重打
  const imageList = pickFirstNonEmptyModelPool(modelGroups, storyboardImageFuncCodes)
  rawModelList.value = imageList
  modelOptions.value = imageList.map(mapStoryboardModalModelItem)

  const dialogueList = modelsFromListByFuncGroups(modelGroups, AI_MODEL_FUNC_CODE.IMAGE_EDIT)
  dialogueRawModelList.value = dialogueList
  dialogueModelOptions.value = dialogueList.map(mapStoryboardModalModelItem)

  const multiViewList = modelsFromListByFuncGroups(modelGroups, AI_MODEL_FUNC_CODE.IMAGE_MULTI_VIEW)
  multiViewModelOptions.value = multiViewList.map(mapStoryboardModalModelItem)

  const nineGridList = pickFirstNonEmptyModelPool(modelGroups, IMAGE_MULTI_GRID_FUNC_CODE_FALLBACKS)
  nineGridModelOptions.value = nineGridList.map(mapStoryboardModalModelItem)

  upscaleModelPool.value = modelsFromListByFuncGroups(modelGroups, AI_MODEL_FUNC_CODE.IMAGE_UPSCALE)

  const imageAgentDefault =
    agentCodes[
      getAgentDefaultModelCacheKey(
        STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY,
        storyboardImageAgentCode,
        listScope
      )
    ] || ''
  const promptAgentDefault =
    agentCodes[
      getAgentDefaultModelCacheKey(
        STORYBOARD_IMAGE_PROMPT_AGENT_BIZ_CATEGORY,
        storyboardImageAgentCode,
        listScope
      )
    ] || ''

  cachedStoryboardImageAgentModelCodes.value = [imageAgentDefault, promptAgentDefault].filter(
    Boolean
  )

  applyStoryboardImageModelDefault(modelOptions.value, cachedStoryboardImageAgentModelCodes.value)
  applyStoryboardDialogueModelDefault(
    dialogueModelOptions.value,
    cachedStoryboardImageAgentModelCodes.value
  )

  const mvFirst = multiViewModelOptions.value[0]
  if (mvFirst && !multiViewModelOptions.value.some((m) => m.id === multiViewSettings.value.model)) {
    multiViewSettings.value.model = mvFirst.id
  }
  const ngFirst = nineGridModelOptions.value[0]
  if (ngFirst && !nineGridModelOptions.value.some((m) => m.id === nineGridSettings.value.model)) {
    nineGridSettings.value.model = ngFirst.id
  }
}

const fallbackMultiViewModelOptions: ModelOption[] = []

const { modelList: multiViewModelOptions } =
  useModelList<ModelOption>({
    funcCode: AI_MODEL_FUNC_CODE.IMAGE_MULTI_VIEW,
    modelType: 'image',
    fallback: fallbackMultiViewModelOptions,
    mapItem: mapStoryboardModalModelItem
  })

const multiViewSettings = ref({ model: '' })
const multiViewSelectedModel = computed<ModelOption>(
  () =>
    multiViewModelOptions.value.find((m) => m.id === multiViewSettings.value.model) ||
    multiViewModelOptions.value[0] ||
    fallbackMultiViewModelOptions[0]
)

const { modelList: nineGridModelOptions } =
  useModelList<ModelOption>({
    funcCode: AI_MODEL_FUNC_CODE.IMAGE_MULTI_GRID,
    funcCodeFallbacks: IMAGE_MULTI_GRID_FUNC_CODE_FALLBACKS,
    modelType: 'image',
    fallback: fallbackMultiViewModelOptions,
    mapItem: mapStoryboardModalModelItem
  })

const nineGridSettings = ref({ model: '' })
const nineGridAspectRatio = ref('1:1')

const nineGridSelectedModel = computed<ModelOption>(
  () =>
    nineGridModelOptions.value.find((m) => m.id === nineGridSettings.value.model) ||
    nineGridModelOptions.value[0] ||
    fallbackMultiViewModelOptions[0]
)

function copyStoryboardPrompt() {
  const plain = storyboardPromptPlainText.value
  if (plain) {
    navigator.clipboard.writeText(plain)
    message.success('已复制')
  }
}

function copyCompositionDesc() {
  if (compositionDesc.value) {
    navigator.clipboard.writeText(compositionDesc.value)
    message.success('已复制')
  }
}

const handleStartGenerate = async () => {
  if (showStoryboardGenerateButtonLoading.value) return

  const promptPlain = storyboardPromptPlainText.value.trim()
  if (!promptPlain) {
    message.warning('请输入描述内容或先生成提示词')
    return
  }
  if (!currentStoryboardId.value) {
    message.warning('分镜ID缺失，无法发起生成')
    return
  }

  const modelCode = String(selectedModel.value?.id || '').trim()
  if (!modelCode) {
    message.warning('请先选择生图模型')
    return
  }

  const quality = String(generationSettings.value.quality || '').trim()
  const size = quality ? quality.toUpperCase() : ''
  const aspectRatio = String(generationSettings.value.aspectRatio || '').trim() || '16:9'
  const count = Math.max(1, Math.min(8, Number(generationSettings.value.count) || 1))
  const agentCode = String(
    creationStore.storyboardStylistGenerateSettings?.agentId ||
      creationStore.storyboardStylistAgent?.id ||
      ''
  ).trim()

  const sceneIdx = currentSceneIndex.value
  const beforeCount = (props.scenes[sceneIdx]?.images || []).length

  // size=清晰度档（1K/2K…），与 aspectRatio 同时下发；对齐对话作图 / 场景弹窗 / 批量出图
  await runStoryboardImageGenerateForScene(sceneIdx, {
    submitBody: {
      storyboardIds: [currentStoryboardId.value],
      ...(agentCode ? { agentCode } : {}),
      imagePrompt: promptPlain,
      modelName: modelCode,
      aspectRatio,
      size: size || undefined,
      count
    },
    beforeCount,
    progressSubmitText: '分镜图提交中…'
  })
}

async function runStoryboardImageGenerateForScene(
  sceneIdx: number,
  opts: {
    submitBody?: Parameters<typeof runStoryboardImageGenerateTask>[0]['body']
    resumeTaskId?: number
    resumeRecordId?: number | null
    beforeCount?: number
    progressSubmitText?: string
    silentComplete?: boolean
  }
) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return
  if (!opts.submitBody) {
    const session = readSessionForScene(sceneIdx)
    const task = getModalImageGenTask(storyboardId)
    if (
      isDialogueModalTask(task) ||
      isCanvasOverlayModalTask(task) ||
      session?.tab === 'dialogue' ||
      isModalOverlaySessionTab(session?.tab)
    ) {
      return
    }
  }

  /** 剧集隔离：任务归属启动时 scope；切集后终态收尾不得写当前集扁平 store、不得 toast、不得回写记录 */
  const taskScope = captureCreationLiveGenScope()
  const taskSessionScope = modalGenSessionScopeFromScopeKey(taskScope.scopeKey)

  const overlayParts = overlayKeyParts(sceneIdx, -1, 'storyboard-gen')
  storyboardGenerateTargetKey.value = buildModalTaskOverlayKey(overlayParts)
  isGeneratingStoryboardImage.value = true
  if (opts.resumeTaskId) {
    const persisted = findStoryboardImageGenTaskInScopes(creationStore, storyboardId, route)
    const batchLive = formatTaskSseLiveTextWithCounts(
      creationStore.storyboardImageBatchProgress,
      '分镜图生成中'
    )
    const singleLive = formatTaskSseLiveText(persisted || {}, '')
    storyboardGenerateProgressText.value =
      singleLive ||
      (creationStore.isGeneratingStoryboardImageBatch ? batchLive : '') ||
      '分镜图生成中…'
  } else {
    storyboardGenerateProgressText.value = opts.progressSubmitText || '分镜图生成中…'
  }
  persistModalImageGenSession(
    storyboardId,
    sceneIdx,
    taskScope.scopeKey,
    { tab: 'generate' },
    taskSessionScope
  )
  ensureGeneratingPlaceholderImage(sceneIdx)

  const beforeCount = opts.beforeCount
  let completeHandled = false
  let keepPendingUi = false

  const finalizeStoryboardImageGenerateSuccess = async (
    recordId: number | null | undefined,
    options?: { skipMessage?: boolean }
  ) => {
    if (!matchesCreationLiveGenScope(taskScope)) {
      if (!completeHandled) {
        completeHandled = true
        creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
        clearModalImageGenSession(taskSessionScope)
      }
      return
    }
    if (!completeHandled) {
      completeHandled = true
      clearModalStoryboardImageLoadingUi(storyboardId, sceneIdx)
      storyboardGenerateProgressText.value = '同步生成记录…'
      // SSE 完成后必须绕过打开弹窗时的空/旧 list 缓存，否则会不打 list-by-storyboard、画布空白
      await refreshSceneRecords(sceneIdx, recordId ?? undefined, beforeCount, { force: true })
    }
    if (!opts.silentComplete && !options?.skipMessage) {
      message.success('分镜图生成成功')
    }
  }

  const onProgress = (p: {
    successCount?: number
    totalCount?: number
    stepTitle?: string
    message?: string
    recordId?: number | null
    items?: Array<{ recordId?: number; imageUrl?: string; imageId?: number }>
  }) => {
    const live = String(p.message || p.stepTitle || '').trim()
    if (live) {
      storyboardGenerateProgressText.value = live
      const task = findStoryboardImageGenTaskInScopes(creationStore, storyboardId, route)
      if (task?.taskId) {
        creationStore.setStoryboardImageGenTask(
          storyboardId,
          {
            taskId: task.taskId,
            sceneIdx,
            kind: 'storyboard',
            message: p.message,
            stepTitle: p.stepTitle
          },
          taskScope.scopeKey
        )
      }
    } else if (p.successCount != null && p.totalCount != null) {
      storyboardGenerateProgressText.value = `已生成 ${p.successCount}/${p.totalCount} 张…`
    }
    if (
      p.recordId != null ||
      (p.items && p.items.length > 0) ||
      (p.stepTitle === '生成完成' && (p.successCount ?? 0) > 0)
    ) {
      const rid =
        p.recordId ??
        p.items?.[p.items.length - 1]?.recordId ??
        p.items?.[p.items.length - 1]?.imageId ??
        null
      void finalizeStoryboardImageGenerateSuccess(rid != null ? Number(rid) : null, {
        skipMessage: true
      })
    }
  }

  activeStoryboardImageFollowStoryboardIds.add(storyboardId)

  try {
    const projectEpisode = await resolveStoryScriptSaveContext(creationStore, route)
    if (!matchesCreationLiveGenScope(taskScope)) {
      creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
      clearModalImageGenSession(taskSessionScope)
      return
    }

    let result: Awaited<ReturnType<typeof runStoryboardImageGenerateTask>>

    if (opts.resumeTaskId) {
      result = await followStoryboardImageGenerateTask({
        taskId: opts.resumeTaskId,
        storyboardId,
        recordId: opts.resumeRecordId ?? null,
        projectEpisode,
        onProgress
      })
    } else if (opts.submitBody) {
      result = await runStoryboardImageGenerateTask({
        body: opts.submitBody,
        projectEpisode,
        notifyGlobalTasks: false,
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardImageGenTask(
            storyboardId,
            { taskId, sceneIdx, kind: 'storyboard' },
            taskScope.scopeKey
          )
          syncModalImageGenSessionTaskId(
            storyboardId,
            sceneIdx,
            taskId,
            { tab: 'generate' },
            taskSessionScope,
            taskScope.scopeKey
          )
          suspendLateModalImageFollowIfScopeChanged(taskId, taskScope)
        },
        onProgress
      })
    } else {
      return
    }

    if (!result.ok && 'deferred' in result && result.deferred) {
      keepPendingUi = true
      return
    }

    if (!result.ok) {
      /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast */
      if (!matchesCreationLiveGenScope(taskScope)) {
        creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
        clearModalImageGenSession(taskSessionScope)
        return
      }
      if (!opts.silentComplete) {
        message.error('errorMessage' in result ? result.errorMessage || '生图失败' : '生图失败')
      }
      clearModalStoryboardImageLoadingUi(storyboardId, sceneIdx)
      await refreshSceneRecords(sceneIdx, undefined, undefined, { force: true })
      return
    }

    await finalizeStoryboardImageGenerateSuccess(result.recordId)
  } catch (e: unknown) {
    if (!matchesCreationLiveGenScope(taskScope)) {
      creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
      clearModalImageGenSession(taskSessionScope)
      return
    }
    if (!opts.silentComplete) {
      const err = e as { msg?: string; message?: string }
      message.error(String(err?.msg || err?.message || '生图失败'))
    }
    clearModalStoryboardImageLoadingUi(storyboardId, sceneIdx)
    await refreshSceneRecords(sceneIdx, undefined, undefined, { force: true })
  } finally {
    activeStoryboardImageFollowStoryboardIds.delete(storyboardId)
    if (!keepPendingUi && !activeStoryboardImageFollowStoryboardIds.size) {
      isGeneratingStoryboardImage.value = false
    }
  }
}

// 左侧资产面板：场景/角色/道具/其他（多选回传的图片列表）
const sceneImages = ref<any[]>([])
const storyboardGeneratePanelRef = ref<InstanceType<typeof StoryboardGeneratePanel> | null>(null)
const characterImages = ref<any[]>([])
const propImages = ref<any[]>([])
const otherImages = ref<any[]>([]) // 姿态图、表情图、特效图、手绘稿合并列表

// 选择弹窗状态
const selectAssetModalOpen = ref(false)
const selectAssetModalType = ref<
  'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other'
>('scene')
const showOtherListDropdown = ref(false)

type SettingKey =
  | 'composition'
  | 'shotSize'
  | 'cameraAngle'
  | 'focalLength'
  | 'colorTone'
  | 'lighting'
  | 'technique'

const activeSettingKey = ref<SettingKey | null>(null)

// 左侧（分镜）面板状态
const isSettingExpanded = ref(false)
const compositionDesc = ref('')
const selectedComposition = ref<{ key: string; value: string } | null>(null)
const selectedShotSize = ref<{ key: string; value: string } | null>(null)
const selectedCameraAngle = ref<{ key: string; value: string } | null>(null)
const selectedFocalLength = ref<{ key: string; value: string } | null>(null)
const selectedColorTone = ref<{ key: string; value: string } | null>(null)
const selectedLighting = ref<{ key: string; value: string } | null>(null)
const selectedTechnique = ref<{ key: string; value: string } | null>(null)

const storyboardPrompt = ref('')
const resolvedPromptAssets = ref<PromptAssetItem[]>([])
/** 接口回填提示词时暂停面板内 prompt/参数联动，避免 Quill 与 watcher 递归更新 */
const storyboardPromptProgrammaticSyncDepth = ref(0)
const isGeneratingPrompt = ref(false)
const isGeneratingStoryboardImage = ref(false)
const storyboardGenerateProgressText = ref('分镜图生成中…')
const showStoryboardGenerateOverlay = computed(() => {
  const sceneIdx = currentSceneIndex.value
  const sid = currentStoryboardId.value
  if (sid != null && isDialogueGenerationInProgress(sid)) return false

  if (isModalStoryboardImageUiActive(sid, sceneIdx)) return true

  if (
    creationStore.isGeneratingStoryboardImageBatch &&
    sid != null &&
    isStoryboardPanelImageGenerating(sid) &&
    !findStoryboardImageGenTaskInScopes(creationStore, sid, route)
  ) {
    return true
  }

  return false
})
const showCanvasImageGenMask = computed(() => {
  const sid = currentStoryboardId.value
  if (
    sid != null &&
    (isDialogueGenerationInProgress(sid) || isModalOverlayGenerationInProgress(sid))
  ) {
    return false
  }
  return showStoryboardGenerateOverlay.value
})
const sceneImageGenMaskText = computed(() => {
  const sid = currentStoryboardId.value
  if (sid != null && isDialogueGenerationInProgress(sid)) {
    return upscaleProgressText.value || '对话作图中...'
  }
  if (sid != null && isModalOverlayGenerationInProgress(sid)) {
    const session = readSessionForScene(currentSceneIndex.value)
    const overlayKind = resolveCanvasOverlayTaskKind(getModalImageGenTask(sid), session?.tab)
    return (
      upscaleProgressText.value ||
      (overlayKind ? canvasOverlayDefaultProgressText(overlayKind) : '生成中...')
    )
  }
  return storyboardGenerateOverlayText.value
})
const showStoryboardGenerateButtonLoading = computed(() => showStoryboardGenerateOverlay.value)
const storyboardGenerateOverlayText = computed(() => {
  const sid = currentStoryboardId.value
  if (creationStore.isGeneratingStoryboardImageBatch && isStoryboardPanelImageGenerating(sid)) {
    return formatTaskSseLiveTextWithCounts(
      creationStore.storyboardImageBatchProgress,
      '分镜图生成中'
    )
  }
  const persisted =
    sid != null ? findStoryboardImageGenTaskInScopes(creationStore, sid, route) : null
  const fromStore = formatTaskSseLiveText(persisted || {}, '')
  if (fromStore) return fromStore
  return formatTaskSseLiveText(
    { message: storyboardGenerateProgressText.value },
    storyboardGenerateProgressText.value || '分镜图生成中…'
  )
})
const showGeneratingPromptForScene = computed(() => {
  const sid = currentStoryboardId.value
  if (sid != null && activePromptFollowStoryboardIds.has(sid)) return true
  return matchesModalTaskOverlayKey(
    promptGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, -1, 'prompt-gen')
  )
})

const storyboardPromptAssets = computed(() => {
  const startIndex =
    resolvedPromptAssets.value.length > 0
      ? Math.max(...resolvedPromptAssets.value.map((a) => a.imageIndex)) + 1
      : 1
  const local = collectStoryboardPromptAssets(
    sceneImages.value,
    characterImages.value,
    propImages.value,
    otherImages.value,
    startIndex
  )
  return resolvedPromptAssets.value.length
    ? mergePromptAssets(resolvedPromptAssets.value, local)
    : local
})

const {
  ensureLoaded: ensurePromptDictLoaded,
  compositionOptions,
  shotSizeOptions,
  cameraAngleOptions,
  focalLengthOptions,
  colorToneOptions,
  lightingOptions,
  techniqueOptions
} = usePromptDictionary()

const storyboardPromptParamGroups = computed(() =>
  buildStoryboardPromptParamGroups({
    composition: compositionOptions.value,
    shotSize: shotSizeOptions.value,
    cameraAngle: cameraAngleOptions.value,
    focalLength: focalLengthOptions.value,
    colorTone: colorToneOptions.value,
    lighting: lightingOptions.value,
    technique: techniqueOptions.value
  })
)

const storyboardPromptPlainText = computed(() =>
  storyboardPromptHtmlToPlain(storyboardPrompt.value)
)

function applyParamSelectionsFromPlain(plain: string) {
  const selections = extractImagePromptParamSelectionsFromPlain(
    plain,
    storyboardPromptParamGroups.value
  )
  selectedComposition.value = selections[PROMPT_TYPE.composition] ?? null
  selectedShotSize.value = selections[PROMPT_TYPE.shot_size] ?? null
  selectedCameraAngle.value = selections[PROMPT_TYPE.camera_angle] ?? null
  selectedFocalLength.value = selections[PROMPT_TYPE.focal_length] ?? null
  selectedColorTone.value = selections[PROMPT_TYPE.color_tone] ?? null
  selectedLighting.value = selections[PROMPT_TYPE.lighting] ?? null
  selectedTechnique.value = selections[PROMPT_TYPE.exposure_blur] ?? null
}

async function applyStoryboardPromptFromApi(plain: string) {
  const text = String(plain || '').trim()
  if (!text) {
    resolvedPromptAssets.value = []
    storyboardPrompt.value = ''
    return
  }

  storyboardPromptProgrammaticSyncDepth.value += 1
  try {
    await ensurePromptDictLoaded()

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    const imageResolve = await resolveStoryboardImageAssetsFromPlain(text, ctx)
    resolvedPromptAssets.value = imageResolve.resolvedAssets
    if (imageResolve.unresolvedNames.length) {
      message.warning(`部分参考图未匹配：${imageResolve.unresolvedNames.join('、')}`)
    }

    // 构图 / 景别等：@标签 + 「景别：/构图：」等结构化字段前端词库解析
    applyParamSelectionsFromPlain(text)
    storyboardPrompt.value = storyboardPromptPlainToHtml(
      text,
      storyboardPromptAssets.value,
      storyboardPromptParamGroups.value,
      { enableImageLabeledParams: true }
    )
    await nextTick()
  } finally {
    storyboardPromptProgrammaticSyncDepth.value -= 1
  }
}

function storyboardBizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

async function fetchStoryboardImagePrompt(storyboardId: number): Promise<string> {
  const row = await fetchUserStoryboardDetailOnce(storyboardId)
  return String(row?.imagePrompt ?? '').trim()
}

async function fetchStoryboardImagePromptAfterGenerate(storyboardId: number): Promise<string> {
  return fetchStoryboardPromptPlainWithRetry(storyboardId, 'imagePrompt')
}

/** 分镜图提示词：手动「生成设置」优先，否则读项目生成配置 */
async function resolveImagePromptSubmitFields() {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  const manualAgent = resolveStoryboardPromptAgentCode(
    creationStore.storyboardStylistGenerateSettings
  )
  const manualModel = resolveStoryboardPromptModelCode(
    creationStore.storyboardStylistGenerateSettings
  )
  const manualPick = Boolean(manualAgent || manualModel)
  return resolveStoryboardGenConfigLlmFields(
    ctx?.projectId ?? null,
    STORYBOARD_GEN_CONFIG_SCENE_CODES.stylist,
    manualPick,
    manualAgent,
    manualModel
  )
}

async function loadCurrentStoryboardPrompt() {
  const id = currentStoryboardId.value
  if (!id) {
    resolvedPromptAssets.value = []
    storyboardPrompt.value = ''
    return
  }
  try {
    const plain = await fetchStoryboardImagePrompt(id)
    await applyStoryboardPromptFromApi(plain)
  } catch {
    resolvedPromptAssets.value = []
    storyboardPrompt.value = ''
  }
}

async function syncSceneDetailAndRestore(sceneIdx: number) {
  void loadCurrentStoryboardPrompt()
  await ensureModalLoadingRestored(sceneIdx)
  // 打开/切 Tab：顶部 Tab 与画布共用一次 force list-by-storyboard（外层 list 只带主图）
  await refreshHeaderTabs(true)
  await refreshSceneRecords(sceneIdx)
  void restoreStoryboardImageGenerateIfNeeded(sceneIdx)
  void restoreStoryboardDialogueGenerateIfNeeded(sceneIdx)
  void restoreStoryboardPromptGenerateIfNeeded(sceneIdx)
  void restoreStoryboardCanvasOverlayGenerateIfNeeded(sceneIdx)
}

const handleGeneratePrompt = async () => {
  if (showGeneratingPromptForScene.value) return
  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜ID缺失，无法生成提示词')
    return
  }

  const sceneIdx = currentSceneIndex.value
  promptGenerateTargetKey.value = buildModalTaskOverlayKey(
    overlayKeyParts(sceneIdx, -1, 'prompt-gen')
  )
  isGeneratingPrompt.value = true
  const hideLoading = message.loading('正在生成提示词...', 0)
  let keepPendingUi = false

  try {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      message.warning('缺少项目信息，请从「我的作品」打开作品后再操作')
      return
    }

    const llmFields = await resolveImagePromptSubmitFields()
    const submitted = await userStoryboardGenerateImagePrompt({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      storyboardIds: [storyboardId],
      ...llmFields,
      overwrite: true
    })

    const taskId = Number(submitted.taskId)
    if (!Number.isFinite(taskId) || taskId <= 0) {
      message.error('提交失败：未返回任务ID')
      return
    }

    creationStore.setStoryboardImagePromptGenTask(storyboardId, { taskId, sceneIdx })
    activePromptFollowStoryboardIds.add(storyboardId)

    let taskOutcome = await awaitStoryboardPromptGenerateTask(taskId)
    if (taskOutcome.ok === false) {
      if ('deferred' in taskOutcome && taskOutcome.deferred) {
        keepPendingUi = true
        return
      }
      const errMsg = taskOutcome.errorMessage
      if (errMsg.includes('取消')) {
        message.warning(errMsg)
      } else {
        message.error(errMsg)
      }
      return
    }
    if (taskOutcome.ok && 'partial' in taskOutcome && taskOutcome.partial) {
      const partialWarning = taskOutcome.partialWarning
      message.warning(partialWarning)
      const shouldResume = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '部分生成失败',
          content: partialWarning,
          okText: '续生',
          cancelText: '暂不续生',
          onOk: () => resolve(true),
          onCancel: () => resolve(false)
        })
      })
      if (shouldResume) {
        taskOutcome = await resumeStoryboardPromptGenerateTask(taskId, 'image')
        if (taskOutcome.ok === false) {
          if ('deferred' in taskOutcome && taskOutcome.deferred) {
            keepPendingUi = true
            return
          }
          message.error(taskOutcome.errorMessage)
          return
        }
        if (taskOutcome.ok && 'partial' in taskOutcome && taskOutcome.partial) {
          message.warning(taskOutcome.partialWarning)
        }
      }
    }

    const prompt = await fetchStoryboardImagePromptAfterGenerate(storyboardId)
    if (!prompt) {
      message.warning('生成完成，但未获取到提示词内容')
      return
    }

    await applyStoryboardPromptFromApi(prompt)
    message.success('提示词生成成功')
  } catch (e: unknown) {
    message.error(storyboardBizErr(e))
  } finally {
    hideLoading()
    activePromptFollowStoryboardIds.delete(storyboardId)
    if (!keepPendingUi) {
      isGeneratingPrompt.value = false
      promptGenerateTargetKey.value = ''
      creationStore.clearStoryboardImagePromptGenTask(storyboardId)
    }
  }
}

const currentImageIndex = ref(
  props.initialImageIndex !== null && props.initialImageIndex !== undefined
    ? props.initialImageIndex
    : 0
)
const editingImageTitleIndex = ref<number | null>(null)
const editingImageTitle = ref('')

const currentScene = computed(() => {
  return props.scenes[currentSceneIndex.value] || { name: '', images: [] }
})

const currentStoryboardId = computed<number | null>(() => {
  const raw = (currentScene.value as { storyboardId?: number | string }).storyboardId
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
})

function joinAssetIds(list: any[]): string | undefined {
  const ids = list.map((x) => Number(x?.id)).filter((n) => Number.isFinite(n) && n > 0)
  return ids.length ? ids.join(',') : undefined
}

const currentScriptContentForModal = computed(
  () => (currentScene.value as { scriptContent?: string }).scriptContent ?? ''
)

function handleSaveScriptInImageModal(payload: { title: string; content: string }) {
  const content = payload?.content ?? ''
  const title = payload?.title ?? ''
  emit('update', currentSceneIndex.value, {
    scriptContent: content,
    ...(title.trim() ? { title } : {})
  })
  showStoryboardScriptModal.value = false
  message.success('分镜脚本已保存')
}

function handleScriptTitleInImageModal(title: string) {
  const t = title?.trim()
  if (!t) return
  emit('update', currentSceneIndex.value, { title: t })
}

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
  localSceneImages.value = [...sceneImages.map((img: any) => ({ ...img })), ...pendingOnly]
  const n = localSceneImages.value.length
  if (n === 0) {
    currentImageIndex.value = 0
  } else if (currentImageIndex.value >= n) {
    currentImageIndex.value = n - 1
  }
}

const STORYBOARD_GENERATED_IMAGE_DEFAULT_TITLE = '未命名'

/** 右侧生图接口会把 prompt 写入 userInputText，不再用作展示标题 */
function isAutoGeneratedStoryboardImageTitle(title: string): boolean {
  const t = title.trim()
  if (!t || t === '分镜图' || t === '九宫格') return true
  return /^(分镜图|九宫格)\s*[|｜]/.test(t)
}

function buildStoryboardImageTitleByRecordId(sceneIdx: number): Map<string, string> {
  const map = new Map<string, string>()
  for (const im of props.scenes[sceneIdx]?.images ?? []) {
    const id = String(im?.id ?? '').trim()
    const title = String(im?.title ?? '').trim()
    if (!id || !title || isAutoGeneratedStoryboardImageTitle(title)) continue
    map.set(id, title)
  }
  return map
}

function mapRecordRowToImageItem(r: StoryboardRecordRow, titleById?: Map<string, string>): any {
  const url = (r.fileUrl || '').trim()
  const id = String(r.id ?? '')
  const customTitle = titleById?.get(id)?.trim()
  const title =
    customTitle || resolveStoryboardRecordDisplayName(r) || STORYBOARD_GENERATED_IMAGE_DEFAULT_TITLE
  return {
    id,
    url,
    thumbnail: url,
    title: customTitle || STORYBOARD_GENERATED_IMAGE_DEFAULT_TITLE,
    source: '生成记录',
    importDate: r.createTime || undefined,
    createdAt: r.createTime || undefined,
    isSelected: r.isSelected === 1,
    _generating: isPendingStoryboardRecord(r),
    _fromServer: true,
    _serverRow: r
  }
}

async function fetchImageRecordsForStoryboard(
  storyboardId: number,
  options?: { force?: boolean }
): Promise<StoryboardRecordRow[]> {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return []
  return fetchStoryboardRecordsForStoryboard(ctx, storyboardId, 'image', options)
}

/** 刷新或重新打开弹窗后，恢复当前分镜的生图 loading 与 SSE 追踪（按 storyboardId 隔离） */
async function restoreStoryboardImageGenerateIfNeeded(sceneIdx: number) {
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return
  if (!shouldRestoreStoryboardImageGenerate(sceneIdx)) return
  if (!isModalImageGenOwnerScene(sceneIdx)) {
    clearLocalGeneratingPlaceholdersForScene(sceneIdx)
    return
  }

  primeStoryboardImageLoadingUi(sceneIdx)

  if (activeStoryboardImageFollowStoryboardIds.has(storyboardId)) {
    return
  }

  const gen = ++resumeStoryboardImageFollowGen

  let rows: StoryboardRecordRow[] = []
  try {
    rows = await fetchImageRecordsForStoryboard(storyboardId)
    const mapped = finalizeMappedImagesWhileGenerating(
      sceneIdx,
      sortStoryboardImagesForParent(mapRecordRowsToImageItems(rows, sceneIdx))
    )
    const prevImages = props.scenes[sceneIdx]?.images
    if (!isSameStoryboardImageRecordList(mapped, prevImages)) {
      emit('update', sceneIdx, { images: mapped })
    }
    syncAddedImageIdsFromList(mapped)

    const pendingIdx = mapped.findIndex((m) => m._generating)
    if (pendingIdx >= 0 && sceneIdx === currentSceneIndex.value) {
      currentImageIndex.value = pendingIdx
    }
  } catch {
    /* 记录拉取失败时仍尝试用 Pinia 中的 taskId 恢复 */
  }

  if (gen !== resumeStoryboardImageFollowGen) return

  if (!shouldRestoreStoryboardImageGenerate(sceneIdx)) return

  const persisted = getModalImageGenTask(storyboardId)
  const session = readSessionForScene(sceneIdx)
  if (persisted?.kind === 'dialogue' || isCanvasOverlayModalTask(persisted)) return
  if (session?.tab === 'dialogue' || isModalOverlaySessionTab(session?.tab)) return

  const taskIdFromRecord = findPendingStoryboardRecordTaskId(rows)
  const recordIdFromRecord = findPendingStoryboardRecordId(rows)
  const sessionTaskId = isModalStoryboardGenerateSession(session) ? (session?.taskId ?? null) : null
  const taskId = persisted?.taskId ?? sessionTaskId ?? taskIdFromRecord ?? null

  if (!taskId) {
    if (hasModalImageGenPendingState(storyboardId)) {
      primeStoryboardImageLoadingUi(sceneIdx)
      return
    }
    // 无进行中任务时清掉可能残留的 panel generating，避免流程 tab loading 卡死
    clearModalStoryboardImageLoadingUi(storyboardId, sceneIdx)
    return
  }

  const ongoing = await isStoryboardImageTaskOngoing(taskId)
  if (gen !== resumeStoryboardImageFollowGen) return

  if (!ongoing) {
    if (hasModalImageGenPendingState(storyboardId)) {
      primeStoryboardImageLoadingUi(sceneIdx)
      await runStoryboardImageGenerateForScene(sceneIdx, {
        resumeTaskId: taskId,
        resumeRecordId: recordIdFromRecord,
        silentComplete: true
      })
      return
    }
    clearModalStoryboardImageLoadingUi(storyboardId, sceneIdx)
    return
  }

  await runStoryboardImageGenerateForScene(sceneIdx, {
    resumeTaskId: taskId,
    resumeRecordId: recordIdFromRecord,
    silentComplete: true
  })
}

/** 刷新或重新打开弹窗后，恢复当前分镜的对话作图 loading 与 SSE 追踪（按 storyboardId 隔离） */
async function restoreStoryboardDialogueGenerateIfNeeded(sceneIdx: number) {
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return
  if (!isModalImageGenOwnerScene(sceneIdx)) {
    clearLocalGeneratingPlaceholdersForScene(sceneIdx)
    return
  }

  primeDialogueLoadingUi(sceneIdx)

  if (activeDialogueFollowStoryboardIds.has(storyboardId)) {
    return
  }

  const gen = ++resumeDialogueFollowGen
  const persisted = getModalImageGenTask(storyboardId)
  const session = readSessionForScene(sceneIdx)
  const isDialogue = isDialogueModalTask(persisted) || session?.tab === 'dialogue'
  if (!isDialogue || isCanvasOverlayModalTask(persisted)) return

  const taskId = persisted?.taskId ?? session?.taskId ?? null
  const imageIdx = persisted?.imageIdx ?? session?.imageIdx ?? currentImageIndex.value

  if (!taskId) {
    if (hasModalImageGenPendingState(storyboardId)) {
      primeDialogueLoadingUi(sceneIdx)
    }
    return
  }

  const ongoing = await isStoryboardImageTaskOngoing(taskId)
  if (gen !== resumeDialogueFollowGen) return

  if (!ongoing) {
    if (hasModalImageGenPendingState(storyboardId)) {
      primeDialogueLoadingUi(sceneIdx)
      await runStoryboardDialogueDrawForScene(sceneIdx, imageIdx, {
        resumeTaskId: taskId,
        silentComplete: true
      })
      return
    }
    clearModalDialogueLoadingUi(storyboardId, sceneIdx, imageIdx)
    return
  }

  await runStoryboardDialogueDrawForScene(sceneIdx, imageIdx, {
    resumeTaskId: taskId,
    silentComplete: true
  })
}

/** 刷新或重新打开弹窗后，恢复当前分镜的提示词生成 loading 与 SSE 追踪（按 storyboardId 隔离） */
async function restoreStoryboardPromptGenerateIfNeeded(sceneIdx: number) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return
  if (activePromptFollowStoryboardIds.has(storyboardId)) return

  const persisted = creationStore.getStoryboardImagePromptGenTask(storyboardId)
  const taskId = persisted?.taskId ?? null
  if (!taskId) return

  const gen = ++resumeStoryboardPromptFollowGen
  const ongoing = await isStoryboardImageTaskOngoing(taskId)
  if (gen !== resumeStoryboardPromptFollowGen) return

  if (!ongoing) {
    creationStore.clearStoryboardImagePromptGenTask(storyboardId)
    return
  }

  promptGenerateTargetKey.value = buildModalTaskOverlayKey(
    overlayKeyParts(sceneIdx, -1, 'prompt-gen')
  )
  isGeneratingPrompt.value = true
  activePromptFollowStoryboardIds.add(storyboardId)
  let keepPendingUi = false

  try {
    let taskOutcome = await awaitStoryboardPromptGenerateTask(taskId)
    if (gen !== resumeStoryboardPromptFollowGen) {
      keepPendingUi = true
      return
    }
    if (taskOutcome.ok === false) {
      keepPendingUi = 'deferred' in taskOutcome && taskOutcome.deferred
      return
    }

    if (taskOutcome.ok && 'partial' in taskOutcome && taskOutcome.partial) {
      const partialWarning =
        'partialWarning' in taskOutcome && taskOutcome.partialWarning
          ? taskOutcome.partialWarning
          : '部分生成失败'
      const shouldResume = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '部分生成失败',
          content: partialWarning,
          okText: '续生',
          cancelText: '暂不续生',
          onOk: () => resolve(true),
          onCancel: () => resolve(false)
        })
      })
      if (shouldResume) {
        taskOutcome = await resumeStoryboardPromptGenerateTask(taskId, 'image')
        if (taskOutcome.ok === false && 'deferred' in taskOutcome && taskOutcome.deferred) {
          keepPendingUi = true
          return
        }
      }
    }

    if (taskOutcome.ok !== false && sceneIdx === currentSceneIndex.value) {
      const prompt = await fetchStoryboardImagePromptAfterGenerate(storyboardId)
      if (prompt) await applyStoryboardPromptFromApi(prompt)
    }
  } catch {
    /* ignore */
  } finally {
    activePromptFollowStoryboardIds.delete(storyboardId)
    if (
      !keepPendingUi &&
      promptGenerateTargetKey.value ===
        buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, -1, 'prompt-gen'))
    ) {
      promptGenerateTargetKey.value = ''
    }
    if (!keepPendingUi) {
      isGeneratingPrompt.value = false
      creationStore.clearStoryboardImagePromptGenTask(storyboardId)
    }
  }
}

function mapRecordRowsToImageItems(rows: StoryboardRecordRow[], sceneIdx: number): any[] {
  const titleById = buildStoryboardImageTitleByRecordId(sceneIdx)
  return rows
    .filter((r) => !!String(r?.fileUrl ?? '').trim() || isPendingStoryboardRecord(r))
    .map((r) => mapRecordRowToImageItem(r, titleById))
}

function resolveStoryboardRecordId(img: any): number | null {
  const fromRow = img?._serverRow?.id
  if (fromRow != null && Number.isFinite(Number(fromRow)) && Number(fromRow) > 0) {
    return Number(fromRow)
  }
  const id = Number(img?.id)
  if (img?._fromServer && Number.isFinite(id) && id > 0) return id
  return null
}

function syncAddedImageIdsFromList(images: any[]) {
  const next = new Set<string>()
  images.forEach((im) => {
    if (!im?.id) return
    if (isStoryboardImageSelected(im)) {
      next.add(String(im.id))
    }
  })
  addedImageIds.value = next
}

function isSameStoryboardImageRecordList(a: any[] | undefined, b: any[] | undefined): boolean {
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
      !!item?.isStoryboardImage === !!other?.isStoryboardImage &&
      isStoryboardImageSelected(item) === isStoryboardImageSelected(other)
    )
  })
}

async function refreshSceneRecords(
  sceneIdx: number,
  selectRecordId?: number | null,
  minCountBefore?: number,
  options?: { force?: boolean }
) {
  const raw = props.scenes[sceneIdx]?.storyboardId
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const rows = await fetchImageRecordsForStoryboard(id, { force: options?.force })
    let mapped = sortStoryboardImagesForParent(mapRecordRowsToImageItems(rows, sceneIdx))
    mapped = finalizeMappedImagesWhileGenerating(sceneIdx, mapped)
    const prevImages = props.scenes[sceneIdx]?.images
    if (isSameStoryboardImageRecordList(mapped, prevImages)) {
      syncAddedImageIdsFromList(mapped)
      return
    }
    // 同步到父组件（右侧列表三弹窗共用：以服务端记录为准）
    // 仅更新图片列表：弹窗打开/刷新生成记录不应触发保存分镜配置
    emit('update', sceneIdx, { images: mapped })
    syncAddedImageIdsFromList(mapped)

    await nextTick()

    if (selectRecordId != null && Number.isFinite(Number(selectRecordId))) {
      const idx = mapped.findIndex((m) => String(m.id) === String(selectRecordId))
      if (idx >= 0) {
        currentImageIndex.value = idx
        return
      }
    }

    if (typeof minCountBefore === 'number' && mapped.length > minCountBefore) {
      currentImageIndex.value = mapped.length - 1
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '获取生成记录失败')
  }
}

/** 任意 SSE 跟进方收到 complete 时同步弹窗记录与 loading（避免批量恢复抢占 SSE 后弹窗无响应） */
async function applyModalStoryboardImageGenSseComplete(detail: {
  taskId?: number
  storyboardId?: number
  recordId?: number | null
  items?: Array<{ recordId?: number; imageId?: number; storyboardId?: number }>
}) {
  const taskId = Number(detail?.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) return

  let storyboardId = Number(detail?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) {
    const fromItem = detail?.items?.find((it) => Number(it?.storyboardId) > 0)
    storyboardId = Number(fromItem?.storyboardId)
  }
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return

  const task = getModalImageGenTask(storyboardId)
  if (isDialogueModalTask(task) || isCanvasOverlayModalTask(task)) return

  const session = readModalImageGenSession(storyboardImageModalSessionScope())
  const sessionMatches =
    session?.storyboardId === storyboardId &&
    (session.tab === 'generate' || !session.tab) &&
    !isModalImageGenUserDismissed(storyboardId, storyboardImageModalSessionScope())
  const taskMatches = task?.taskId === taskId && task?.kind !== 'dialogue'
  const sessionTaskMatches = sessionMatches && session?.taskId === taskId
  if (!taskMatches && !sessionTaskMatches) return

  const sceneIdx = resolveModalImageGenOwnerSceneIdx(storyboardId) ?? session?.sceneIdx
  if (sceneIdx == null || sceneIdx < 0 || !isModalImageGenOwnerScene(sceneIdx)) return
  if (
    !hasModalImageGenPendingState(storyboardId) &&
    !activeStoryboardImageFollowStoryboardIds.has(storyboardId)
  ) {
    return
  }

  const recordId =
    detail?.recordId ??
    detail?.items?.[detail.items.length - 1]?.recordId ??
    detail?.items?.[detail.items.length - 1]?.imageId ??
    null

  clearModalStoryboardImageLoadingUi(storyboardId, sceneIdx)
  await refreshSceneRecords(sceneIdx, recordId != null ? Number(recordId) : undefined, undefined, {
    force: true
  })
}

function resolveStoryboardIdForImageGenTask(taskId: number): number | null {
  const tid = Number(taskId)
  if (!Number.isFinite(tid) || tid <= 0) return null
  for (const { blob } of resolveCurrentStep4LiveGenScopeBlobs(creationStore, route)) {
    for (const [sidRaw, snap] of Object.entries(blob.storyboardImageGenTasksByStoryboardId || {})) {
      if (Number((snap as { taskId?: number }).taskId) === tid) {
        const sid = Number(sidRaw)
        if (Number.isFinite(sid) && sid > 0) return sid
      }
    }
  }
  const session = readModalImageGenSession(storyboardImageModalSessionScope())
  if (session?.taskId === tid) return session.storyboardId
  return null
}

/** SSE 返回 error / cancelled / failed 时同步清除弹窗与分镜列表 loading */
async function applyModalStoryboardImageGenSseTerminal(detail: {
  taskId?: number
  storyboardId?: number
  ok?: boolean
  errorMessage?: string
}) {
  if (detail?.ok) return
  const taskId = Number(detail?.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) return

  let storyboardId = Number(detail?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) {
    storyboardId = Number(resolveStoryboardIdForImageGenTask(taskId) ?? 0)
  }
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return

  const task = getModalImageGenTask(storyboardId)
  if (isDialogueModalTask(task) || isCanvasOverlayModalTask(task)) return

  const session = readModalImageGenSession(storyboardImageModalSessionScope())
  const sessionMatches =
    session?.storyboardId === storyboardId &&
    (session.tab === 'generate' || !session.tab) &&
    !isModalImageGenUserDismissed(storyboardId, storyboardImageModalSessionScope())
  const taskMatches = task?.taskId === taskId && task?.kind !== 'dialogue'
  const sessionTaskMatches = sessionMatches && session?.taskId === taskId
  if (
    !taskMatches &&
    !sessionTaskMatches &&
    !activeStoryboardImageFollowStoryboardIds.has(storyboardId) &&
    !hasModalImageGenPendingState(storyboardId)
  ) {
    clearStoryboardPanelImageGenerating(storyboardId)
    clearModalStoryboardImageGenTaskEverywhere(storyboardId)
    return
  }

  const sceneIdx = resolveModalImageGenOwnerSceneIdx(storyboardId) ?? session?.sceneIdx
  if (sceneIdx == null || sceneIdx < 0) {
    clearStoryboardPanelImageGenerating(storyboardId)
    clearModalStoryboardImageGenTaskEverywhere(storyboardId)
    return
  }

  clearModalStoryboardImageLoadingUi(storyboardId, sceneIdx)
  await refreshSceneRecords(sceneIdx)
}

function handleStoryboardImageGenSseCompleteEvent(event: Event) {
  if (!props.open) return
  const detail = (event as CustomEvent).detail as Parameters<
    typeof applyModalStoryboardImageGenSseComplete
  >[0]
  void applyModalStoryboardImageGenSseComplete(detail)
}

function handleStoryboardImageGenSseTerminalEvent(event: Event) {
  const detail = (event as CustomEvent).detail as Parameters<
    typeof applyModalStoryboardImageGenSseTerminal
  >[0]
  void applyModalStoryboardImageGenSseTerminal(detail)
}

onMounted(() => {
  if (!import.meta.client) return
  window.addEventListener(
    STORYBOARD_IMAGE_GEN_SSE_COMPLETE_EVENT,
    handleStoryboardImageGenSseCompleteEvent
  )
  window.addEventListener(
    STORYBOARD_IMAGE_GEN_SSE_TERMINAL_EVENT,
    handleStoryboardImageGenSseTerminalEvent
  )
})

onUnmounted(() => {
  if (!import.meta.client) return
  window.removeEventListener(
    STORYBOARD_IMAGE_GEN_SSE_COMPLETE_EVENT,
    handleStoryboardImageGenSseCompleteEvent
  )
  window.removeEventListener(
    STORYBOARD_IMAGE_GEN_SSE_TERMINAL_EVENT,
    handleStoryboardImageGenSseTerminalEvent
  )
})

watch(
  () => [props.scenes, currentSceneIndex.value],
  () => {
    syncLocalSceneImagesFromSceneIndex(currentSceneIndex.value, { preservePending: true })
  },
  { immediate: true, deep: true }
)

const currentSceneImages = computed(() => {
  return localSceneImages.value
})

/** 当前选中的分镜图（与左侧「生成记录」、中间画布一致） */
const currentImg = computed(() => {
  const imgs = currentSceneImages.value
  const i = currentImageIndex.value
  if (!imgs.length || i < 0 || i >= imgs.length) return null
  return imgs[i]
})

const showCurrentGeneratingPlaceholder = computed(
  () => !!currentImg.value?._generating && isHistoryItemGenerating(currentImageIndex.value)
)

function handlePreviewCanvasImage() {
  const img = currentImg.value
  const url = String(img?.url || '').trim()
  if (!url) return
  openImagePreviewModal({
    url,
    title: img?.title || '预览'
  })
}

function handlePreviewImageUrl(url: string) {
  const src = String(url || '').trim()
  if (!src) return
  openImagePreviewModal({
    url: src,
    title: '预览'
  })
}

const showCancelAddStoryboardImage = computed(() => {
  const img = currentImg.value as {
    id?: string
    _pending?: boolean
    isSelected?: boolean
    _serverRow?: { isSelected?: number | null }
  } | null
  if (!img?.id || img._pending) return false
  const id = String(img.id)
  return isStoryboardImageSelected(img) || addedImageIds.value.has(id)
})

const showAssetLibraryModal = ref(false)
const showMaterialFromLibraryModal = ref(false)
const showMultiAngleModal = ref(false)
const multiAngleTargetIndex = ref<number | null>(null)
const multiAngleImageUrl = ref('')
/** pose | expression | effect，与素材库左侧分类 key 一致 */
const materialLibraryCategoryKey = ref<string>('pose')
/** 是否由「+ 导入其他」打开素材库，确认导入后需把图片地址写入描述文本域 */
const materialImportAppendToStoryPrompt = ref(false)
watch(showMaterialFromLibraryModal, (open) => {
  if (!open) materialImportAppendToStoryPrompt.value = false
})
const isSelectingSceneImage = ref(false)
const selectedSceneImageIndex = ref<number | null>(null)
const addingAfterIndex = ref<number | null>(null)
const pendingImage = ref<any | null>(null)
const addedImageIds = ref<Set<string>>(new Set())
const isSettingFinalImage = ref(false)
const uploadingLocalImageAtKey = ref('')

const isUploadingLocalImage = computed(() =>
  matchesModalTaskOverlayKey(
    uploadingLocalImageAtKey.value,
    overlayKeyParts(currentSceneIndex.value, currentImageIndex.value, 'local-upload')
  )
)

const mainContentRef = ref<HTMLElement | null>(null)

// 切换分镜 Tab 时，左右两侧分别展示骨架屏
const leftPanelLoading = ref(false)
const rightPanelLoading = ref(false)
const TAB_SWITCH_SKELETON_MS = 380

function scrollActiveSceneTabIntoView() {
  sceneTabBarRef.value?.scrollItemIntoView('.scene-image-tab.active')
  sceneTabBarRef.value?.refresh()
}

const switchScene = async (index: number) => {
  if (index === currentSceneIndex.value) return

  const keepSid = sceneStoryboardIdNum(index)
  suspendOtherStoryboardImageModalFollows(keepSid)

  showStoryboardScriptModal.value = false
  leftPanelLoading.value = true
  rightPanelLoading.value = true
  currentSceneIndex.value = index
  currentImageIndex.value = 0
  syncLocalSceneImagesFromSceneIndex(index)

  await nextTick()
  scrollActiveSceneTabIntoView()
  clearStaleModalGeneratingPlaceholders()
  void syncSceneDetailAndRestore(index)
  setTimeout(() => {
    leftPanelLoading.value = false
    rightPanelLoading.value = false
  }, TAB_SWITCH_SKELETON_MS)
}

/** 顶部 Tab 互斥：只保留目标分镜的浏览器 SSE */
function suspendOtherStoryboardImageModalFollows(keepStoryboardId: number | null) {
  const keepKey = keepStoryboardId != null && keepStoryboardId > 0 ? String(keepStoryboardId) : ''
  const owned = new Set<number>([
    ...activeStoryboardImageFollowStoryboardIds,
    ...activeDialogueFollowStoryboardIds,
    ...activeCanvasOverlayFollowStoryboardIds
  ])
  const activeFollows: Array<{ tabKey: string; taskId: number }> = []
  for (const sid of owned) {
    const task = getModalImageGenTask(sid)
    const tid = Number(task?.taskId)
    if (!Number.isFinite(tid) || tid <= 0) continue
    activeFollows.push({ tabKey: String(sid), taskId: tid })
  }
  const toSuspend = listModalTabFollowsToSuspend({
    currentTabKey: keepKey,
    activeFollows
  })
  for (const tid of toSuspend) {
    suspendTaskSseFollow(tid)
  }
  for (const sid of [...owned]) {
    if (keepStoryboardId != null && sid === keepStoryboardId) continue
    releaseStoryboardImageModalLiveOwned(sid)
  }
}

const switchImage = (imageIndex: number) => {
  if (imageIndex === currentImageIndex.value) return
  currentImageIndex.value = imageIndex
}

const handleUploadLocalImage = () => {
  if (isUploadingLocalImage.value) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const storyboardId = currentStoryboardId.value
    if (!storyboardId) {
      message.warning('分镜信息异常，请刷新后重试')
      return
    }

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      message.warning('缺少项目信息，请从「我的作品」打开作品后再操作')
      return
    }

    const sceneIdx = currentSceneIndex.value
    const imgIdx = currentImageIndex.value
    uploadingLocalImageAtKey.value = buildModalTaskOverlayKey(
      overlayKeyParts(sceneIdx, imgIdx, 'local-upload')
    )
    const hideLoading = message.loading('正在上传图片...', 0)
    try {
      const url = await uploadImageToOssWithToast(file)
      if (!url) return

      const record = await userStoryboardUpload({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardId,
        imageUrl: url,
        mediaType: 'image'
      })

      const recordId = Number(record?.id)
      if (!Number.isFinite(recordId) || recordId <= 0) {
        throw new Error('上传落库失败：未返回记录ID')
      }

      pendingImage.value = null
      const uploadCtx = await resolveStoryScriptSaveContext(creationStore, route)
      if (uploadCtx) clearProjectStoryboardRecordCache(uploadCtx)
      await refreshSceneRecords(currentSceneIndex.value, recordId, undefined, { force: true })
      message.success('图片已上传，请点击「添加分镜图」设为主图')
    } catch (err: unknown) {
      const ax = err as { msg?: string; message?: string }
      message.error(ax?.msg || ax?.message || '分镜图上传失败，请重试')
    } finally {
      hideLoading()
      if (
        uploadingLocalImageAtKey.value ===
        buildModalTaskOverlayKey(
          overlayKeyParts(currentSceneIndex.value, currentImageIndex.value, 'local-upload')
        )
      ) {
        uploadingLocalImageAtKey.value = ''
      }
    }
  }
  input.click()
}

const handleOpenAssetLibrary = () => {
  showAssetLibraryModal.value = true
}

function applyParamSettingsConfirm(payload: ParamSettingsConfirmPayload) {
  sceneImages.value = payload.sceneImages
  characterImages.value = payload.characterImages
  propImages.value = payload.propImages
  otherImages.value = payload.otherImages
  selectedComposition.value = payload.selectedComposition
  selectedShotSize.value = payload.selectedShotSize
  selectedCameraAngle.value = payload.selectedCameraAngle
  selectedFocalLength.value = payload.selectedFocalLength
  selectedColorTone.value = payload.selectedColorTone
  selectedLighting.value = payload.selectedLighting
  selectedTechnique.value = payload.selectedTechnique
  compositionDesc.value = payload.compositionDesc
  activeSettingKey.value = payload.activeSettingKey as SettingKey | null

  const localAssets = collectStoryboardPromptAssets(
    payload.sceneImages,
    payload.characterImages,
    payload.propImages,
    payload.otherImages
  )
  resolvedPromptAssets.value = patchEmptyResolvedPromptAssets(
    resolvedPromptAssets.value,
    localAssets
  )
}

// 打开选择场景/角色/道具/其他弹窗
function openSelectModal(
  type: 'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other'
) {
  if (type === 'pose' || type === 'expression' || type === 'effect' || type === 'draft') {
    materialImportAppendToStoryPrompt.value = false
    materialLibraryCategoryKey.value = type
    showMaterialFromLibraryModal.value = true
    return
  }
  if (type === 'other') {
    materialImportAppendToStoryPrompt.value = true
    materialLibraryCategoryKey.value = 'misc'
    showMaterialFromLibraryModal.value = true
    return
  }
  selectAssetModalType.value = type
  selectAssetModalOpen.value = true
}

function handleMaterialLibraryOtherImport(assets: any[]) {
  if (!assets?.length) return
  materialImportAppendToStoryPrompt.value = false
  const list = assets.map((item) => ({
    ...item,
    url: item.url || item.thumbnail,
    thumbnail: item.thumbnail || item.url,
    title: item.title || item.name || '参考图',
    id: item.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }))
  if (storyboardGeneratePanelRef.value?.isParamSettingsOpen?.()) {
    const type =
      materialLibraryCategoryKey.value === 'misc' ? 'other' : materialLibraryCategoryKey.value
    storyboardGeneratePanelRef.value.applyParamDraftAssets(type as any, list)
    message.success(`已添加 ${list.length} 项`)
    showMaterialFromLibraryModal.value = false
    return
  }
  otherImages.value = [...otherImages.value, ...list]
  message.success(`已添加 ${list.length} 项`)
  showMaterialFromLibraryModal.value = false
}

// 选择弹窗确认：将选中的图片写入对应列表
function onSelectAssetConfirm(items: any[]) {
  if (!items?.length) return
  const list = items.map((item) => ({
    ...item,
    id: item.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }))
  if (storyboardGeneratePanelRef.value?.isParamSettingsOpen?.()) {
    storyboardGeneratePanelRef.value.applyParamDraftAssets(selectAssetModalType.value, list)
    message.success(`已添加 ${list.length} 项`)
    return
  }
  if (selectAssetModalType.value === 'scene') {
    sceneImages.value = [...sceneImages.value, ...list]
  } else if (selectAssetModalType.value === 'character') {
    characterImages.value = [...characterImages.value, ...list]
  } else if (selectAssetModalType.value === 'prop') {
    propImages.value = [...propImages.value, ...list]
  } else {
    otherImages.value = [...otherImages.value, ...list]
  }
  message.success(`已添加 ${list.length} 项`)
}

// 预览单张资产图
function previewAssetImage(img: any) {
  const url = img?.url || img?.thumbnail
  if (!url) return
  openImagePreviewModal({
    url,
    title: img?.title || img?.name || '预览'
  })
}

// 从「其他」列表中移除一项
function removeOtherImage(index: number) {
  otherImages.value = otherImages.value.filter((_, i) => i !== index)
}

const assetLibraryImportInFlight = ref(false)

const handleAssetLibraryImport = (asset: any) => {
  const imageUrl = String(asset?.url || asset?.thumbnail || '').trim()
  if (!imageUrl) {
    message.error('图片地址无效')
    return
  }
  if (assetLibraryImportInFlight.value) return

  showAssetLibraryModal.value = false
  assetLibraryImportInFlight.value = true

  void (async () => {
    const sceneIdx = currentSceneIndex.value
    const imgIdx = currentImageIndex.value
    uploadingLocalImageAtKey.value = buildModalTaskOverlayKey(
      overlayKeyParts(sceneIdx, imgIdx, 'asset-import')
    )
    const hideLoading = message.loading('正在导入图片...', 0)
    try {
      const storyboardId = currentStoryboardId.value
      if (!storyboardId) {
        message.warning('分镜信息异常，请刷新后重试')
        return
      }

      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (!ctx) {
        message.warning('缺少项目信息，请从「我的作品」打开作品后再操作')
        return
      }

      // 当前分镜已有相同 URL 的生成记录时不再 upload，避免同图重复落库
      const existingRows = await fetchImageRecordsForStoryboard(storyboardId, { force: true })
      const existing = existingRows.find(
        (r) => String(r?.fileUrl ?? '').trim() === imageUrl && Number(r?.id) > 0
      )
      if (existing) {
        pendingImage.value = null
        await refreshSceneRecords(sceneIdx, Number(existing.id), undefined, { force: true })
        message.success('该图片已在生成记录中')
        return
      }

      // 与本地上传、编辑分镜视频「资产库导入」对齐：先 upload 落库，再刷新记录列表
      const record = await userStoryboardUpload({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardId,
        imageUrl,
        mediaType: 'image'
      })

      const recordId = Number(record?.id)
      if (!Number.isFinite(recordId) || recordId <= 0) {
        throw new Error('导入落库失败：未返回记录ID')
      }

      pendingImage.value = null
      clearProjectStoryboardRecordCache(ctx)
      await refreshSceneRecords(sceneIdx, recordId, undefined, { force: true })
      message.success('图片已导入，请点击「添加分镜图」设为主图')
    } catch (err: unknown) {
      const ax = err as { msg?: string; message?: string }
      message.error(ax?.msg || ax?.message || '资产库导入失败，请重试')
    } finally {
      hideLoading()
      assetLibraryImportInFlight.value = false
      if (
        uploadingLocalImageAtKey.value ===
        buildModalTaskOverlayKey(
          overlayKeyParts(currentSceneIndex.value, currentImageIndex.value, 'asset-import')
        )
      ) {
        uploadingLocalImageAtKey.value = ''
      }
    }
  })()
}

const startEditImageTitle = (index: number) => {
  editingImageTitleIndex.value = index
  editingImageTitle.value =
    currentSceneImages.value[index]?.title || STORYBOARD_GENERATED_IMAGE_DEFAULT_TITLE
}

const handleImageTitleBlur = (index: number) => {
  if (editingImageTitleIndex.value === index) {
    const nextTitle = editingImageTitle.value.trim() || STORYBOARD_GENERATED_IMAGE_DEFAULT_TITLE
    const updatedScenes = [...props.scenes]
    if (updatedScenes[currentSceneIndex.value].images?.[index]) {
      updatedScenes[currentSceneIndex.value].images[index].title = nextTitle
      emit('update', currentSceneIndex.value, {
        images: updatedScenes[currentSceneIndex.value].images
      })
      message.success('标题已更新')
    }
  }
  editingImageTitleIndex.value = null
  editingImageTitle.value = ''
}

const isDeletingRecord = ref(false)

function canDeleteHistoryImage(img: any): boolean {
  if (!img || img._generating || isDeletingRecord.value) return false
  if (resolveStoryboardRecordId(img)) return true
  return !!img._pending
}

function removeLocalPendingImage(index: number) {
  const img = localSceneImages.value[index] as Record<string, unknown> | undefined
  if (!img) return

  const imgId = String(img.id || '')
  const nextAddedIds = new Set(addedImageIds.value)
  nextAddedIds.delete(imgId)
  addedImageIds.value = nextAddedIds

  const ci = currentSceneIndex.value
  const parentImages = props.scenes[ci]?.images || []
  const inParent = parentImages.some((x: any) => x.id === img.id)

  if (inParent) {
    const nextImages = parentImages.filter((x: any) => x.id !== img.id)
    emit('update', ci, { ...props.scenes[ci], images: nextImages })
  }

  localSceneImages.value = localSceneImages.value.filter((_, i) => i !== index)
  if (pendingImage.value?.id === img.id) pendingImage.value = null

  nextTick(() => {
    const n = localSceneImages.value.length
    if (n === 0) {
      currentImageIndex.value = 0
    } else if (currentImageIndex.value >= n) {
      currentImageIndex.value = n - 1
    }
  })
}

const handleDownloadImage = (imageIndex: number) => {
  const img = currentSceneImages.value[imageIndex]
  if (img && img.url) {
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `场景图${imageIndex + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  } else {
    message.warning('暂无图片可下载')
  }
}

const handleDeleteImage = (imageIndex: number) => {
  const img = currentSceneImages.value[imageIndex]
  if (!canDeleteHistoryImage(img)) {
    message.warning('当前记录无法删除')
    return
  }

  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这条生成记录吗？删除后不可恢复。',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      const recordId = resolveStoryboardRecordId(img)
      const storyboardId = currentStoryboardId.value

      if (recordId && storyboardId) {
        isDeletingRecord.value = true
        try {
          const ctx = await resolveStoryScriptSaveContext(creationStore, route)
          await userStoryboardRecordDelete({ storyboardId, recordId })
          if (ctx) clearProjectStoryboardRecordCache(ctx)
          await refreshSceneRecords(currentSceneIndex.value, undefined, undefined, { force: true })
          message.success('删除成功')
        } catch (e: unknown) {
          const err = e as { msg?: string; message?: string }
          message.error(err?.msg || err?.message || '删除失败')
          throw e
        } finally {
          isDeletingRecord.value = false
        }
        return
      }

      removeLocalPendingImage(imageIndex)
      message.success('已删除')
    }
  })
}

const handleModifyImage = (imageIndex: number) => {
  const img = currentSceneImages.value[imageIndex]
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

/** 分镜图高清（/storyboard/generate/upscale）：画布遮罩 */
const upscaleUiPhase = ref<'idle' | 'running' | 'failed'>('idle')
const upscaleTargetKey = ref('')
const upscaleProgressText = ref('高清处理中…')
const upscaleFailedMessage = ref('')
const upscaleContext = ref<{ sceneIndex: number; imageIndex: number } | null>(null)

const CANVAS_OVERLAY_TASK_KINDS = ['upscale', 'dialogue', 'multiangle', 'ninegrid'] as const

type StoryboardCanvasOverlayTaskKind = (typeof CANVAS_OVERLAY_TASK_KINDS)[number]

/** 画布遮罩当前任务类型，工具栏 loading 与任务一一对应 */
const canvasOverlayTaskKind = ref<StoryboardCanvasOverlayTaskKind | null>(null)

function beginCanvasTaskOverlay(
  sceneIdx: number,
  imgIdx: number,
  taskKind: StoryboardCanvasOverlayTaskKind,
  progressText: string,
  opts?: { persistSession?: boolean }
) {
  upscaleTargetKey.value = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, imgIdx, taskKind))
  upscaleUiPhase.value = 'running'
  upscaleProgressText.value = progressText
  canvasOverlayTaskKind.value = taskKind

  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId != null) {
    ensureOverlayGeneratingPlaceholderImage(sceneIdx)
  }

  if (opts?.persistSession === false) return

  if (storyboardId == null) return
  const sessionTab: ModalImageGenSessionTab =
    taskKind === 'dialogue'
      ? 'dialogue'
      : taskKind === 'upscale'
        ? 'upscale'
        : taskKind === 'ninegrid'
          ? 'ninegrid'
          : taskKind === 'multiangle'
            ? 'multiangle'
            : 'generate'
  persistModalImageGenSession(storyboardId, sceneIdx, creationStore.step3GenVisualScopeKey(), {
    tab: sessionTab,
    imageIdx: imgIdx
  })
}

function endCanvasTaskOverlay(clearSession = true) {
  upscaleUiPhase.value = 'idle'
  upscaleTargetKey.value = ''
  upscaleProgressText.value = '高清处理中…'
  canvasOverlayTaskKind.value = null
  if (clearSession) {
    clearModalImageGenSession(storyboardImageModalSessionScope())
  }
}

function isToolbarLoadingForTaskKind(taskKind: StoryboardCanvasOverlayTaskKind): boolean {
  if (upscaleUiPhase.value !== 'running') return false
  return matchesModalTaskOverlayKey(
    upscaleTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, currentImageIndex.value, taskKind)
  )
}

const showUpscaleToolbarLoading = computed(() => isToolbarLoadingForTaskKind('upscale'))

const showMultiViewToolbarLoading = computed(() => {
  if (upscaleUiPhase.value !== 'running') return false
  return isToolbarLoadingForTaskKind('multiangle') || isToolbarLoadingForTaskKind('ninegrid')
})

const showDialogueToolbarLoading = computed(() => isToolbarLoadingForTaskKind('dialogue'))

const showUpscaleRunningOverlay = computed(() => {
  if (upscaleUiPhase.value !== 'running') return false
  return matchesAnyModalTaskOverlayKey(upscaleTargetKey.value, {
    editorScopeKey: props.editorScopeKey,
    sceneIdx: currentSceneIndex.value,
    entityId: resolveStoryboardIdForSceneIndex(currentSceneIndex.value),
    itemIdx: currentImageIndex.value,
    taskKinds: [...CANVAS_OVERLAY_TASK_KINDS]
  })
})

const showUpscaleFailedOverlay = computed(() => {
  if (upscaleUiPhase.value !== 'failed') return false
  return matchesAnyModalTaskOverlayKey(upscaleTargetKey.value, {
    editorScopeKey: props.editorScopeKey,
    sceneIdx: currentSceneIndex.value,
    entityId: resolveStoryboardIdForSceneIndex(currentSceneIndex.value),
    itemIdx: currentImageIndex.value,
    taskKinds: [...CANVAS_OVERLAY_TASK_KINDS]
  })
})

const showGeneratingDialogueButton = computed(() => isToolbarLoadingForTaskKind('dialogue'))

function clearUpscaleOverlay() {
  upscaleUiPhase.value = 'idle'
  upscaleTargetKey.value = ''
  upscaleFailedMessage.value = ''
  upscaleProgressText.value = '高清处理中…'
  upscaleContext.value = null
  canvasOverlayTaskKind.value = null
}

function resolveCanvasOverlayTaskKind(
  persisted: ReturnType<typeof getModalImageGenTask>,
  sessionTab?: ModalImageGenSessionTab
): Extract<StoryboardCanvasOverlayTaskKind, 'upscale' | 'multiangle' | 'ninegrid'> | null {
  if (persisted?.kind === 'upscale' || sessionTab === 'upscale') return 'upscale'
  if (persisted?.kind === 'ninegrid' || sessionTab === 'ninegrid') return 'ninegrid'
  if (persisted?.kind === 'multiangle' || sessionTab === 'multiangle') return 'multiangle'
  return null
}

function clearModalCanvasOverlayLoadingUi(
  storyboardId: number,
  sceneIdx: number,
  imageIdx: number,
  taskKind: Extract<StoryboardCanvasOverlayTaskKind, 'upscale' | 'multiangle' | 'ninegrid'>
) {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return

  creationStore.clearStoryboardImageGenTask(sid)
  clearModalImageGenSession(storyboardImageModalSessionScope())
  clearModalImageGenUserDismissed(storyboardImageModalSessionScope())
  activeCanvasOverlayFollowStoryboardIds.delete(sid)
  clearStoryboardPanelImageGenerating(sid)
  endCanvasTaskOverlay()
  upscaleContext.value = null
  clearLocalGeneratingPlaceholdersForScene(sceneIdx)
  clearStaleStoryboardGenUiForScene(sceneIdx)
  void imageIdx
  void taskKind
}

function canvasOverlayDefaultProgressText(
  taskKind: Extract<StoryboardCanvasOverlayTaskKind, 'upscale' | 'multiangle' | 'ninegrid'>
): string {
  if (taskKind === 'upscale') return '高清处理中…'
  if (taskKind === 'ninegrid') return '九宫格生图中...'
  return '多机位生图中...'
}

function canvasOverlaySuccessMessage(
  taskKind: Extract<StoryboardCanvasOverlayTaskKind, 'upscale' | 'multiangle' | 'ninegrid'>
): string {
  if (taskKind === 'upscale') return '高清处理完成'
  if (taskKind === 'ninegrid') return '九宫格生图完成'
  return '多机位生图完成'
}

function canvasOverlayFailureMessage(
  taskKind: Extract<StoryboardCanvasOverlayTaskKind, 'upscale' | 'multiangle' | 'ninegrid'>
): string {
  if (taskKind === 'upscale') return '高清任务失败'
  if (taskKind === 'ninegrid') return '九宫格生图失败'
  return '多机位生图失败'
}

async function runStoryboardCanvasOverlayFollowForScene(
  sceneIdx: number,
  imageIdx: number,
  taskKind: Extract<StoryboardCanvasOverlayTaskKind, 'upscale' | 'multiangle' | 'ninegrid'>,
  opts: {
    resumeTaskId: number
    beforeCount?: number
    silentComplete?: boolean
    fallbackRecordId?: number | null
  }
) {
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return

  /** 剧集隔离：任务归属启动时 scope；切集后终态收尾不得写当前集扁平 store、不得 toast */
  const taskScope = captureCreationLiveGenScope()
  const taskSessionScope = modalGenSessionScopeFromScopeKey(taskScope.scopeKey)

  beginCanvasTaskOverlay(sceneIdx, imageIdx, taskKind, canvasOverlayDefaultProgressText(taskKind), {
    persistSession: false
  })
  upscaleContext.value = { sceneIndex: sceneIdx, imageIndex: imageIdx }
  activeCanvasOverlayFollowStoryboardIds.add(storyboardId)

  const onProgress = (p: { percent?: number; stepTitle?: string; message?: string }) => {
    upscaleProgressText.value =
      formatTaskSseJoinedLiveText(p, '') ||
      (typeof p.percent === 'number' ? `${Math.round(p.percent)}%` : '') ||
      canvasOverlayDefaultProgressText(taskKind)
    const task = getModalImageGenTask(storyboardId)
    if (task?.taskId) {
      creationStore.setStoryboardImageGenTask(
        storyboardId,
        {
          taskId: task.taskId,
          sceneIdx,
          kind: taskKind,
          imageIdx,
          message: p.message,
          stepTitle: p.stepTitle
        },
        taskScope.scopeKey
      )
    }
  }

  try {
    let result:
      | Awaited<ReturnType<typeof followStoryboardImageUpscaleTask>>
      | Awaited<ReturnType<typeof followStoryboardMultiViewGridImageTask>>

    if (taskKind === 'upscale') {
      result = await followStoryboardImageUpscaleTask({
        taskId: opts.resumeTaskId,
        onProgress
      })
    } else {
      const taskLabel = taskKind === 'ninegrid' ? '九宫格' : '多机位'
      result = await followStoryboardMultiViewGridImageTask({
        taskId: opts.resumeTaskId,
        taskLabel,
        timeoutMs: TASK_SSE_TIMEOUT_MS,
        onProgress
      })
    }

    if (!result.ok && 'deferred' in result && result.deferred) {
      // 被新 SSE 接管或良性断连且任务仍进行中：保留 Pinia，勿 toast / 勿标失败
      return
    }

    /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast */
    if (!matchesCreationLiveGenScope(taskScope)) {
      creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
      clearModalImageGenSession(taskSessionScope)
      return
    }

    if (!result.ok) {
      if (!opts.silentComplete) {
        message.error(
          'errorMessage' in result
            ? result.errorMessage || canvasOverlayFailureMessage(taskKind)
            : canvasOverlayFailureMessage(taskKind)
        )
      }
      upscaleUiPhase.value = 'failed'
      canvasOverlayTaskKind.value = taskKind
      upscaleFailedMessage.value =
        'errorMessage' in result
          ? result.errorMessage || canvasOverlayFailureMessage(taskKind)
          : canvasOverlayFailureMessage(taskKind)
      creationStore.clearStoryboardImageGenTask(storyboardId)
      clearStoryboardPanelImageGenerating(storyboardId)
      clearLocalGeneratingPlaceholdersForScene(sceneIdx)
      clearModalImageGenSession(storyboardImageModalSessionScope())
      return
    }

    clearModalCanvasOverlayLoadingUi(storyboardId, sceneIdx, imageIdx, taskKind)
    clearStaleStoryboardGenUiForScene(sceneIdx)
    await refreshSceneRecords(
      sceneIdx,
      result.recordId ?? opts.fallbackRecordId ?? undefined,
      opts.beforeCount,
      { force: true }
    )

    if (!opts.silentComplete) {
      message.success(canvasOverlaySuccessMessage(taskKind))
    }
  } finally {
    activeCanvasOverlayFollowStoryboardIds.delete(storyboardId)
  }
}

/** 刷新或重新打开弹窗后，恢复变清晰/多机位/九宫格 SSE 追踪（按 storyboardId 隔离） */
async function restoreStoryboardCanvasOverlayGenerateIfNeeded(sceneIdx: number) {
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return
  if (!isModalImageGenOwnerScene(sceneIdx)) return

  primeCanvasOverlayFromSession(sceneIdx)

  if (activeCanvasOverlayFollowStoryboardIds.has(storyboardId)) return

  const gen = ++resumeCanvasOverlayFollowGen
  const persisted = getModalImageGenTask(storyboardId)
  const session = readSessionForScene(sceneIdx)
  const taskKind = resolveCanvasOverlayTaskKind(persisted, session?.tab)
  if (!taskKind) return

  const imageIdx = persisted?.imageIdx ?? session?.imageIdx ?? currentImageIndex.value
  const taskId = persisted?.taskId ?? session?.taskId ?? null

  if (!taskId) {
    if (hasModalImageGenPendingState(storyboardId)) {
      primeCanvasOverlayFromSession(sceneIdx)
    }
    return
  }

  const ongoing = await isStoryboardImageTaskOngoing(taskId)
  if (gen !== resumeCanvasOverlayFollowGen) return

  const beforeCount = (props.scenes[sceneIdx]?.images || []).length

  if (!ongoing) {
    if (hasModalImageGenPendingState(storyboardId)) {
      primeCanvasOverlayFromSession(sceneIdx)
      await runStoryboardCanvasOverlayFollowForScene(sceneIdx, imageIdx, taskKind, {
        resumeTaskId: taskId,
        beforeCount,
        silentComplete: true
      })
    } else {
      clearModalCanvasOverlayLoadingUi(storyboardId, sceneIdx, imageIdx, taskKind)
    }
    return
  }

  await runStoryboardCanvasOverlayFollowForScene(sceneIdx, imageIdx, taskKind, {
    resumeTaskId: taskId,
    beforeCount,
    silentComplete: true
  })
}

/**
 * 通过 form-image/list 解析分镜图对应的形态图实例 ID（需图片带 rpsFormId 或由列表匹配 url/标题）。
 */
async function resolveStoryboardFormImageId(payload: {
  formId?: number
  imageId?: number
  imageUrl?: string
  imageTitle?: string
}): Promise<number | null> {
  const formId =
    payload.formId != null && Number.isFinite(Number(payload.formId))
      ? Number(payload.formId)
      : null
  if (formId == null) {
    return payload.imageId != null && Number.isFinite(Number(payload.imageId))
      ? Number(payload.imageId)
      : null
  }

  try {
    const list = await userAssetRpsFormImageList({ formId })
    if (!Array.isArray(list) || list.length === 0) return null

    const normalizedInputId =
      payload.imageId != null && Number.isFinite(Number(payload.imageId))
        ? Number(payload.imageId)
        : null
    if (normalizedInputId != null) {
      const hitById = list.find(
        (x: any) => Number.isFinite(Number(x?.id)) && Number(x.id) === normalizedInputId
      )
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
      if (hitByName?.id != null && Number.isFinite(Number(hitByName.id)))
        return Number(hitByName.id)
    }

    const fallback = list.find((x: any) => x?.id != null && Number.isFinite(Number(x.id)))
    return fallback?.id != null && Number.isFinite(Number(fallback.id)) ? Number(fallback.id) : null
  } catch {
    return null
  }
}

const handleDialogueImage = (imageIndex: number) => {
  leftActiveTab.value = 'dialogue'
  currentImageIndex.value = imageIndex
  const img = currentSceneImages.value[imageIndex]
  if (img && img.url) {
    dialogueSourceImages.value = [{ url: img.url, title: img.title || img.name }]
    message.info('已切换到对话作图，当前图片已设为参考图')
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
  if (!list.length) {
    message.warning('未选择有效图片')
    return
  }
  dialogueSourceImages.value = [list[0]]
  message.success(list.length > 1 ? '已选用第一张作为参考图（仅支持 1 张）' : '已导入参考图')
}

function removeDialogueSourceImage(index: number) {
  dialogueSourceImages.value = dialogueSourceImages.value.filter((_, i) => i !== index)
}

async function handleStartDialogueDraw() {
  if (showGeneratingDialogueButton.value) return

  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜ID缺失，无法发起对话作图')
    return
  }

  const referenceImage = String(dialogueSourceImages.value[0]?.url || '').trim()
  if (!referenceImage) {
    message.warning('请先添加参考图')
    return
  }

  const prompt = htmlToPlainText(dialogueInstructionHtml.value || '').trim()
  if (!prompt) {
    message.warning('请输入修改要求')
    return
  }

  const modelCode = String(dialogueSelectedModel.value?.id || '').trim()
  if (!modelCode) {
    message.warning('请先选择生图模型')
    return
  }

  const aspectRatio = dialogueSettings.value.aspectRatio || '16:9'
  const size =
    String(dialogueSettings.value.quality || '2k')
      .trim()
      .toUpperCase() || '2K'
  const imageCount = Math.max(1, Math.min(4, Number(dialogueSettings.value.count) || 1))

  const sceneIdx = currentSceneIndex.value
  const imageIndex = currentImageIndex.value
  const beforeCount = (props.scenes[sceneIdx]?.images || []).length

  await runStoryboardDialogueDrawForScene(sceneIdx, imageIndex, {
    submitPayload: {
      storyboardId,
      referenceImage,
      prompt,
      modelCode,
      aspectRatio,
      size,
      imageCount
    },
    beforeCount
  })
}

async function runStoryboardDialogueDrawForScene(
  sceneIdx: number,
  imageIndex: number,
  opts: {
    submitPayload?: {
      storyboardId: number
      referenceImage: string
      prompt: string
      modelCode: string
      aspectRatio: string
      size: string
      imageCount: number
    }
    resumeTaskId?: number
    beforeCount?: number
    progressSubmitText?: string
    silentComplete?: boolean
  }
) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return

  /** 剧集隔离：任务归属启动时 scope；切集后终态收尾不得写当前集扁平 store、不得 toast */
  const taskScope = captureCreationLiveGenScope()
  const taskSessionScope = modalGenSessionScopeFromScopeKey(taskScope.scopeKey)

  beginCanvasTaskOverlay(
    sceneIdx,
    imageIndex,
    'dialogue',
    opts.progressSubmitText || '对话作图任务提交中...'
  )
  persistModalImageGenSession(
    storyboardId,
    sceneIdx,
    taskScope.scopeKey,
    { tab: 'dialogue', imageIdx: imageIndex },
    taskSessionScope
  )
  if (sceneIdx === currentSceneIndex.value) {
    leftActiveTab.value = 'dialogue'
  }

  const beforeCount = opts.beforeCount
  let completeHandled = false

  const finalizeDialogueDrawSuccess = async (
    recordId: number | null | undefined,
    options?: { skipMessage?: boolean; failCount?: number; successCount?: number }
  ) => {
    if (!matchesCreationLiveGenScope(taskScope)) {
      if (!completeHandled) {
        completeHandled = true
        creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
        clearModalImageGenSession(taskSessionScope)
      }
      return
    }
    if (!completeHandled) {
      completeHandled = true
      clearModalDialogueLoadingUi(storyboardId, sceneIdx, imageIndex)
      await refreshSceneRecords(sceneIdx, recordId ?? undefined, beforeCount, { force: true })
    }
    if (!opts.silentComplete && !options?.skipMessage) {
      const successCount = options?.successCount ?? 1
      const failMsg = options?.failCount ? `，${options.failCount} 张失败` : ''
      message.success(`对话作图完成，共生成 ${successCount} 张${failMsg}`)
    }
  }

  const onProgress = (p: {
    successCount?: number
    totalCount?: number
    stepTitle?: string
    message?: string
    items?: Array<{ recordId?: number; imageId?: number; imageUrl?: string }>
  }) => {
    if (p.successCount != null && p.totalCount != null) {
      upscaleProgressText.value = `已生成 ${p.successCount}/${p.totalCount} 张...`
    } else {
      upscaleProgressText.value = p.stepTitle || p.message || '对话作图中...'
    }
    const task = getModalImageGenTask(storyboardId)
    if (task?.taskId) {
      creationStore.setStoryboardImageGenTask(
        storyboardId,
        {
          taskId: task.taskId,
          sceneIdx,
          kind: 'dialogue',
          imageIdx: imageIndex,
          message: p.message,
          stepTitle: p.stepTitle
        },
        taskScope.scopeKey
      )
    }
    if (p.items && p.items.length > 0) {
      const lastRecordId =
        p.items[p.items.length - 1]?.recordId ?? p.items[p.items.length - 1]?.imageId ?? null
      void finalizeDialogueDrawSuccess(lastRecordId != null ? Number(lastRecordId) : null, {
        skipMessage: true
      })
    }
  }

  activeDialogueFollowStoryboardIds.add(storyboardId)

  try {
    let result: Awaited<ReturnType<typeof followStoryboardEditImageTask>>

    if (opts.resumeTaskId) {
      result = await followStoryboardEditImageTask({ taskId: opts.resumeTaskId, onProgress })
    } else if (opts.submitPayload) {
      result = await runStoryboardEditImageTask({
        ...opts.submitPayload,
        notifyGlobalTasks: false,
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardImageGenTask(
            storyboardId,
            { taskId, sceneIdx, kind: 'dialogue', imageIdx: imageIndex },
            taskScope.scopeKey
          )
          syncModalImageGenSessionTaskId(
            storyboardId,
            sceneIdx,
            taskId,
            {
              tab: 'dialogue',
              imageIdx: imageIndex
            },
            taskSessionScope,
            taskScope.scopeKey
          )
          suspendLateModalImageFollowIfScopeChanged(taskId, taskScope)
        },
        onProgress
      })
    } else {
      return
    }

    if (!result.ok && 'deferred' in result && result.deferred) {
      return
    }

    if (!result.ok) {
      /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast */
      if (!matchesCreationLiveGenScope(taskScope)) {
        creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
        clearModalImageGenSession(taskSessionScope)
        return
      }
      if (!opts.silentComplete) {
        message.error(
          'errorMessage' in result ? result.errorMessage || '对话作图失败' : '对话作图失败'
        )
      }
      clearModalDialogueLoadingUi(storyboardId, sceneIdx, imageIndex)
      return
    }

    const lastRecordId =
      result.items[result.items.length - 1]?.recordId ??
      result.items[result.items.length - 1]?.imageId ??
      null
    await finalizeDialogueDrawSuccess(lastRecordId, {
      failCount: result.failCount,
      successCount: result.items.length
    })
  } finally {
    activeDialogueFollowStoryboardIds.delete(storyboardId)
  }
}

const handleUpscaleModelSelect = async (payload: {
  modelCode: string
  resolution: string
  imageIndex: number
}) => {
  const sceneIdx = currentSceneIndex.value
  const imageIndex = payload.imageIndex
  const img = currentSceneImages.value[imageIndex] as any
  if (!img?.url) {
    message.warning('请先选择一张可用图片')
    return
  }

  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) {
    message.warning('分镜ID缺失，无法发起变清晰')
    return
  }

  const genRecordId = resolveStoryboardRecordId(img)
  if (genRecordId == null) {
    message.warning('当前图片无有效生成记录，请先生成分镜图后再使用变清晰')
    return
  }

  const modelCode = String(payload.modelCode || '').trim()
  if (!modelCode) {
    message.warning('暂无可用高清模型，请联系管理员配置 image_upscale 功能池')
    return
  }

  const beforeCount = (props.scenes[sceneIdx]?.images || []).length

  /** 剧集隔离：任务归属启动时 scope；切集后终态收尾不得写当前集扁平 store、不得 toast */
  const taskScope = captureCreationLiveGenScope()
  const taskSessionScope = modalGenSessionScopeFromScopeKey(taskScope.scopeKey)

  beginCanvasTaskOverlay(sceneIdx, imageIndex, 'upscale', '正在提交高清任务…')
  upscaleContext.value = { sceneIndex: sceneIdx, imageIndex }
  activeCanvasOverlayFollowStoryboardIds.add(storyboardId)

  let upscaleResult: Awaited<ReturnType<typeof runStoryboardImageUpscaleTask>>
  try {
    upscaleResult = await runStoryboardImageUpscaleTask({
      genRecordId,
      modelCode,
      resolution: payload.resolution,
      notifyGlobalTasks: false,
      onSubmitted: ({ taskId }) => {
        creationStore.setStoryboardImageGenTask(
          storyboardId,
          { taskId, sceneIdx, kind: 'upscale', imageIdx: imageIndex },
          taskScope.scopeKey
        )
        syncModalImageGenSessionTaskId(
          storyboardId,
          sceneIdx,
          taskId,
          {
            tab: 'upscale',
            imageIdx: imageIndex
          },
          taskSessionScope,
          taskScope.scopeKey
        )
        suspendLateModalImageFollowIfScopeChanged(taskId, taskScope)
      },
      onProgress: (p) => {
        upscaleProgressText.value =
          formatTaskSseJoinedLiveText(p, '') ||
          (typeof p.percent === 'number' ? `${Math.round(p.percent)}%` : '') ||
          '高清处理中…'
        const task = getModalImageGenTask(storyboardId)
        if (task?.taskId) {
          creationStore.setStoryboardImageGenTask(
            storyboardId,
            {
              taskId: task.taskId,
              sceneIdx,
              kind: 'upscale',
              imageIdx: imageIndex,
              message: p.message,
              stepTitle: p.stepTitle
            },
            taskScope.scopeKey
          )
        }
      }
    })
  } catch (e: unknown) {
    if (!matchesCreationLiveGenScope(taskScope)) {
      creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
      clearModalImageGenSession(taskSessionScope)
      return
    }
    upscaleUiPhase.value = 'failed'
    canvasOverlayTaskKind.value = 'upscale'
    clearModalImageGenSession(storyboardImageModalSessionScope())
    creationStore.clearStoryboardImageGenTask(storyboardId)
    clearStoryboardPanelImageGenerating(storyboardId)
    upscaleFailedMessage.value = String((e as Error)?.message || '高清任务异常')
    return
  } finally {
    activeCanvasOverlayFollowStoryboardIds.delete(storyboardId)
  }

  /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast */
  if (!matchesCreationLiveGenScope(taskScope)) {
    creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
    clearModalImageGenSession(taskSessionScope)
    return
  }

  const ctx = upscaleContext.value
  if (!ctx) {
    clearUpscaleOverlay()
    return
  }

  if (!upscaleResult.ok) {
    upscaleUiPhase.value = 'failed'
    canvasOverlayTaskKind.value = 'upscale'
    clearModalImageGenSession(storyboardImageModalSessionScope())
    creationStore.clearStoryboardImageGenTask(storyboardId)
    clearStoryboardPanelImageGenerating(storyboardId)
    clearLocalGeneratingPlaceholdersForScene(sceneIdx)
    upscaleFailedMessage.value =
      'errorMessage' in upscaleResult
        ? upscaleResult.errorMessage || '高清任务失败'
        : '高清任务失败'
    return
  }

  clearModalCanvasOverlayLoadingUi(storyboardId, sceneIdx, imageIndex, 'upscale')

  await refreshSceneRecords(ctx.sceneIndex, upscaleResult.recordId ?? genRecordId, beforeCount, {
    force: true
  })

  message.success('高清处理完成')
}

const handleMultiAngle = (imageIndex: number) => {
  const img = currentSceneImages.value[imageIndex]
  if (!img?.url) {
    message.warning('请先选择一张可用图片')
    return
  }
  multiAngleTargetIndex.value = imageIndex
  multiAngleImageUrl.value = img.url
  showMultiAngleModal.value = true
}

const handleMultiAngleGenerate = async (payload: MultiAngleGeneratePayload) => {
  const imageIndex = multiAngleTargetIndex.value
  if (imageIndex === null) return
  if (!currentSceneImages.value[imageIndex]) {
    message.warning('当前图片已失效，请关闭多机位弹窗后重试')
    return
  }

  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜ID缺失，无法发起多机位生图')
    return
  }

  const rawImg = currentSceneImages.value[imageIndex] as Record<string, unknown>
  const imageUrl = String(rawImg?.url || rawImg?.thumbnail || payload.imageUrl || '').trim()
  if (!imageUrl) {
    message.warning('当前图片地址无效，无法发起多机位生图')
    return
  }

  const isNineGrid = payload.mode === 'nineGridFixed'
  const modelCode = String(
    (isNineGrid ? nineGridSelectedModel.value : multiViewSelectedModel.value)?.id || ''
  ).trim()
  if (!modelCode) {
    message.warning(isNineGrid ? '暂无可用九宫格生图模型' : '请先选择多机位生图模型')
    return
  }

  let angles: string[]
  if (isNineGrid) {
    angles = (payload.nineGridAngles || []).map((a) => String(a || '').trim())
    if (angles.length !== 9 || angles.some((a) => !a)) {
      message.warning('九宫格机位数据异常，请重试')
      return
    }
  } else {
    const anglePrompt = String(payload.multiAnglePromptConcat || '').trim()
    if (!anglePrompt) {
      message.warning('机位提示词不能为空')
      return
    }
    angles = [anglePrompt]
  }

  const sceneIdx = currentSceneIndex.value
  const beforeCount = (props.scenes[sceneIdx]?.images || []).length
  const overlayKind = isNineGrid ? 'ninegrid' : 'multiangle'

  /** 剧集隔离：任务归属启动时 scope；切集后终态收尾不得写当前集扁平 store、不得 toast */
  const taskScope = captureCreationLiveGenScope()
  const taskSessionScope = modalGenSessionScopeFromScopeKey(taskScope.scopeKey)

  beginCanvasTaskOverlay(
    sceneIdx,
    imageIndex,
    overlayKind,
    isNineGrid ? '九宫格生图任务提交中...' : '多机位生图任务提交中...'
  )
  activeCanvasOverlayFollowStoryboardIds.add(storyboardId)

  let result: Awaited<ReturnType<typeof runStoryboardMultiViewGridImageTask>>
  try {
    result = await runStoryboardMultiViewGridImageTask({
      storyboardId,
      imageUrl,
      angles,
      modelCode,
      aspectRatio: isNineGrid
        ? nineGridAspectRatio.value || '1:1'
        : generationSettings.value.aspectRatio || '1:1',
      notifyGlobalTasks: false,
      onSubmitted: ({ taskId }) => {
        creationStore.setStoryboardImageGenTask(
          storyboardId,
          { taskId, sceneIdx, kind: overlayKind, imageIdx: imageIndex },
          taskScope.scopeKey
        )
        syncModalImageGenSessionTaskId(
          storyboardId,
          sceneIdx,
          taskId,
          {
            tab: overlayKind,
            imageIdx: imageIndex
          },
          taskSessionScope,
          taskScope.scopeKey
        )
        suspendLateModalImageFollowIfScopeChanged(taskId, taskScope)
      },
      onProgress: (p) => {
        upscaleProgressText.value =
          p.stepTitle || p.message || (isNineGrid ? '九宫格生图中...' : '多机位生图中...')
        const task = getModalImageGenTask(storyboardId)
        if (task?.taskId) {
          creationStore.setStoryboardImageGenTask(
            storyboardId,
            {
              taskId: task.taskId,
              sceneIdx,
              kind: overlayKind,
              imageIdx: imageIndex,
              message: p.message,
              stepTitle: p.stepTitle
            },
            taskScope.scopeKey
          )
        }
      }
    })
  } catch (e: unknown) {
    if (!matchesCreationLiveGenScope(taskScope)) {
      creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
      clearModalImageGenSession(taskSessionScope)
      return
    }
    clearModalImageGenSession(storyboardImageModalSessionScope())
    creationStore.clearStoryboardImageGenTask(storyboardId)
    clearStoryboardPanelImageGenerating(storyboardId)
    endCanvasTaskOverlay()
    message.error(
      String((e as Error)?.message || (isNineGrid ? '九宫格生图失败' : '多机位生图失败'))
    )
    return
  } finally {
    activeCanvasOverlayFollowStoryboardIds.delete(storyboardId)
  }

  // 关弹窗再进：旧跟随被抢占 / 良性断连且任务仍进行中 → 勿清 Pinia、勿 toast
  if (!result.ok && 'deferred' in result && result.deferred) {
    return
  }

  /** 剧集隔离：已切集则只清任务所属 scope 桶快照，不写当前集 UI/store、不 toast */
  if (!matchesCreationLiveGenScope(taskScope)) {
    creationStore.clearStoryboardImageGenTask(storyboardId, taskScope.scopeKey)
    clearModalImageGenSession(taskSessionScope)
    return
  }

  if (!result.ok) {
    clearModalImageGenSession(storyboardImageModalSessionScope())
    creationStore.clearStoryboardImageGenTask(storyboardId)
    clearStoryboardPanelImageGenerating(storyboardId)
    endCanvasTaskOverlay()
    message.error(
      'errorMessage' in result
        ? result.errorMessage || (isNineGrid ? '九宫格生图失败' : '多机位生图失败')
        : isNineGrid
          ? '九宫格生图失败'
          : '多机位生图失败'
    )
    return
  }

  clearModalCanvasOverlayLoadingUi(storyboardId, sceneIdx, imageIndex, overlayKind)
  await refreshSceneRecords(sceneIdx, result.recordId, beforeCount, { force: true })

  message.success(isNineGrid ? '九宫格生图完成' : '多机位生图完成')
}

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

const getFirstSceneImage = (sceneIndex: number) => {
  const scene = props.scenes[sceneIndex]
  return pickStoryboardCoverImage(scene?.images)
}

/** 无生成记录时，按 URL 落库为分镜图片记录（资产库导入 / 历史 pending 兜底） */
async function persistManualStoryboardImageUrl(imageUrl: string): Promise<number | null> {
  const url = String(imageUrl || '').trim()
  if (!url) return null

  const storyboardId = currentStoryboardId.value
  if (!storyboardId) return null

  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return null

  const record = await userStoryboardUpload({
    projectId: ctx.projectId,
    episodeId: ctx.episodeId,
    storyboardId,
    imageUrl: url,
    mediaType: 'image'
  })
  const recordId = Number(record?.id)
  return Number.isFinite(recordId) && recordId > 0 ? recordId : null
}

async function resolveOrPersistStoryboardImageRecordId(img: any): Promise<number | null> {
  const existing = resolveStoryboardRecordId(img)
  if (existing) return existing
  return persistManualStoryboardImageUrl(String(img?.url || ''))
}

const handleConfirmAddImage = async (index: number) => {
  if (isSettingFinalImage.value) return

  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜信息异常，请刷新后重试')
    return
  }

  const img = localSceneImages.value[index] as any
  if (!img) {
    message.warning('没有可设置的图片')
    return
  }

  if (!String(img.url || '').trim()) {
    message.warning('产物未完成')
    return
  }

  isSettingFinalImage.value = true
  try {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      message.warning('缺少项目信息，无法设置主图')
      return
    }

    // 与编辑分镜视频一致：无 recordId 时先 upload 落库再 setFinal
    const recordId = await resolveOrPersistStoryboardImageRecordId(img)
    if (!recordId) {
      message.warning('图片落库失败，无法设为分镜图')
      return
    }

    await userStoryboardSetFinalImage({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      storyboardId,
      recordId
    })
    clearProjectStoryboardRecordCache(ctx)
    await refreshHeaderTabs(true)

    if (img._pending) {
      delete img._pending
      pendingImage.value = null
    }

    await refreshSceneRecords(currentSceneIndex.value, recordId, undefined, { force: true })
    const imgId = String(recordId)
    addedImageIds.value = new Set([...addedImageIds.value, imgId])
    message.success('设置成功')
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '设置分镜主图失败')
  } finally {
    isSettingFinalImage.value = false
  }
}

/** 将当前图设为分镜主图（调用 setFinalImage）；无记录时先 upload 落库 */
const handleAddStoryboardImage = async () => {
  const idx = currentImageIndex.value
  const img = localSceneImages.value[idx] as any
  if (!img) {
    message.warning('请先选择一张图片')
    return
  }
  if (img?._pending) {
    await handleConfirmAddImage(idx)
    return
  }
  if (pendingImage.value?.id) {
    const pendingIndex = localSceneImages.value.findIndex(
      (x: any) => x?.id === pendingImage.value?.id && x?._pending
    )
    if (pendingIndex >= 0) {
      currentImageIndex.value = pendingIndex
      await handleConfirmAddImage(pendingIndex)
      return
    }
  }
  if (resolveStoryboardRecordId(img) || String(img.url || '').trim()) {
    await handleConfirmAddImage(idx)
    return
  }
  message.warning('请先通过「选择本地文件」「资产库导入」导入图片，或选择已生成的分镜图记录')
}

const handleCancelAddImage = async (index: number) => {
  if (isSettingFinalImage.value) return

  const img = localSceneImages.value[index] as Record<string, unknown> | undefined
  if (!img) return

  const imgId = String(img.id || '')
  const nextAddedIds = new Set(addedImageIds.value)
  nextAddedIds.delete(imgId)
  addedImageIds.value = nextAddedIds

  // 服务端生成记录：调用 unSetFinalImage 取消最终图选中
  if (img._fromServer) {
    const storyboardId = currentStoryboardId.value
    const recordId = resolveStoryboardRecordId(img)
    if (!storyboardId || !recordId) {
      message.warning('分镜信息异常，请刷新后重试')
      return
    }

    isSettingFinalImage.value = true
    try {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      await userStoryboardUnSetFinalImage({
        ...(ctx ? { projectId: ctx.projectId, episodeId: ctx.episodeId } : {}),
        storyboardId,
        recordId
      })
      if (ctx) clearProjectStoryboardRecordCache(ctx)
      await refreshSceneRecords(currentSceneIndex.value, undefined, undefined, { force: true })
      message.success('已取消添加')
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '取消分镜主图失败')
    } finally {
      isSettingFinalImage.value = false
    }
    return
  }

  const ci = currentSceneIndex.value
  const parentImages = props.scenes[ci]?.images || []
  const inParent = parentImages.some((x: any) => x.id === img.id)

  if (inParent) {
    const nextImages = parentImages.filter((x: any) => x.id !== img.id)
    emit('update', ci, { ...props.scenes[ci], images: nextImages })
  }

  localSceneImages.value = localSceneImages.value.filter((_, i) => i !== index)
  if (pendingImage.value?.id === img.id) pendingImage.value = null

  nextTick(() => {
    const n = localSceneImages.value.length
    if (n === 0) {
      currentImageIndex.value = 0
    } else if (currentImageIndex.value >= n) {
      currentImageIndex.value = n - 1
    }
  })

  message.success('已取消添加，请重新点击「添加分镜图」确认添加')
}

const handleCancel = () => {
  const sceneIdx = currentSceneIndex.value

  if (isSelectingSceneImage.value) {
    if (selectedSceneImageIndex.value !== null) {
      const selectedSceneIndex = selectedSceneImageIndex.value
      const firstImage = getFirstSceneImage(selectedSceneIndex)

      if (firstImage) {
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

        if (addingAfterIndex.value !== null) {
          updatedScenes[currentSceneIndex.value].images.splice(
            addingAfterIndex.value + 1,
            0,
            newImage
          )
          currentImageIndex.value = addingAfterIndex.value + 1
        } else {
          updatedScenes[currentSceneIndex.value].images.push(newImage)
          currentImageIndex.value = updatedScenes[currentSceneIndex.value].images.length - 1
        }

        emit('update', currentSceneIndex.value, updatedScenes[currentSceneIndex.value])
        message.success('分镜图已添加')
      }
    }

    isSelectingSceneImage.value = false
    selectedSceneImageIndex.value = null
    addingAfterIndex.value = null
  } else {
    const updatedScenes = [...props.scenes]
    if (!updatedScenes[currentSceneIndex.value].images) {
      updatedScenes[currentSceneIndex.value].images = []
    }
    updatedScenes[currentSceneIndex.value].images = localSceneImages.value
      .filter((img) => !img._pending)
      .map((img) => {
        const { _pending, ...rest } = img
        return rest
      })

    if (updatedScenes[currentSceneIndex.value].images.length > 0) {
      emit('update', currentSceneIndex.value, updatedScenes[currentSceneIndex.value])
    }
  }

  // 生成中返回：先 mark dismissed，避免外层 tryReopen 因仍有 gen session 再次打开弹窗
  const closeDismiss = resolveStoryboardImageModalCloseDismiss({
    session: readModalImageGenSession(storyboardImageModalSessionScope()),
    currentSceneIdx: sceneIdx,
    currentImageIdx: currentImageIndex.value,
    currentStoryboardId: sceneStoryboardIdNum(sceneIdx),
    hasPendingForCurrent: isAnyModalGenerationPendingForScene(sceneIdx)
  })
  if (closeDismiss?.type === 'dialogue') {
    dismissModalDialogueUi(closeDismiss.storyboardId, closeDismiss.sceneIdx, closeDismiss.imageIdx)
  } else if (closeDismiss?.type === 'overlay') {
    markModalImageGenUserDismissed(closeDismiss.storyboardId, storyboardImageModalSessionScope())
    clearModalImageGenSession(storyboardImageModalSessionScope())
    releaseStoryboardImageModalLiveOwned(closeDismiss.storyboardId)
  } else if (closeDismiss?.type === 'storyboard') {
    dismissModalStoryboardImageUi(closeDismiss.storyboardId, closeDismiss.sceneIdx)
  } else {
    const sid = sceneStoryboardIdNum(sceneIdx)
    if (sid != null) releaseStoryboardImageModalLiveOwned(sid)
  }

  modalOpen.value = false
}

watch(
  () => props.sceneIndex,
  (newIndex) => {
    if (newIndex !== currentSceneIndex.value) {
      switchScene(newIndex)
    }
  }
)

watch(
  () => [props.open, props.initialImageIndex],
  ([isOpen, imageIndex]) => {
    if (isOpen && typeof imageIndex === 'number' && imageIndex >= 0) {
      nextTick(() => {
        if (currentSceneImages.value.length > imageIndex) {
          currentImageIndex.value = imageIndex
        }
      })
    }
  },
  { immediate: true }
)

watch(modelOptions, () => reapplyStoryboardImageModelDefaultIfEmpty(), { flush: 'post' })
watch(dialogueModelOptions, () => reapplyStoryboardImageModelDefaultIfEmpty(), { flush: 'post' })

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      const si = props.sceneIndex
      const sid = sceneStoryboardIdNum(si)
      if (sid != null) {
        clearModalImageGenUserDismissed(storyboardImageModalSessionScope())
      }
      ensureModalSessionFromStoreTask(si)
      void ensurePromptDictLoaded()
      void initImageModelOptions()
      currentSceneIndex.value = props.sceneIndex
      showStoryboardScriptModal.value = false
      const sceneImages = props.scenes[si]?.images || []
      syncAddedImageIdsFromList(sceneImages)
      primeStoryboardImageLoadingUi(si)
      primeDialogueLoadingUi(si)
      primeCanvasOverlayFromSession(si)
      void syncSceneDetailAndRestore(si)
      nextTick(() => scrollActiveSceneTabIntoView())
    } else {
      initImageModelGen++
      const si = currentSceneIndex.value
      if (!isAnyModalGenerationPendingForScene(si)) {
        resumeStoryboardImageFollowGen++
        resumeDialogueFollowGen++
      }
      resumeStoryboardPromptFollowGen++
      showStoryboardScriptModal.value = false
      addedImageIds.value.clear()
      pendingImage.value = null
    }
  },
  { immediate: true }
)

watch(
  () => currentStoryboardId.value,
  (id, prevId) => {
    if (!props.open) return
    if (!id || id === prevId) return
    if (prevId == null) return
    void syncSceneDetailAndRestore(currentSceneIndex.value)
  }
)

watch(
  () => props.scenes.length,
  () => {
    if (!props.open) return
    nextTick(() => sceneTabBarRef.value?.refresh())
  }
)

/** 资产 / 参数选项变化时，将描述中的 @ 文本占位同步为可点击引用块 */
watch(
  [storyboardPromptAssets, storyboardPromptParamGroups, resolvedPromptAssets],
  () => {
    if (storyboardPromptProgrammaticSyncDepth.value > 0) return
    if (!storyboardPrompt.value) return
    const plain = storyboardPromptHtmlToPlain(storyboardPrompt.value)
    if (!plain.includes('@') && !plainHasImageLabeledParamFields(plain)) return
    const next = storyboardPromptPlainToHtml(
      plain,
      storyboardPromptAssets.value,
      storyboardPromptParamGroups.value,
      { enableImageLabeledParams: true }
    )
    if (next && next !== storyboardPrompt.value) {
      storyboardPrompt.value = next
    }
  },
  { deep: true }
)

useCreateFlowScopeChangedResume(() => {
  if (!props.open) return
  const si = currentSceneIndex.value
  void (async () => {
    await ensureModalLoadingRestored(si)
    void restoreStoryboardImageGenerateIfNeeded(si)
    void restoreStoryboardDialogueGenerateIfNeeded(si)
    void restoreStoryboardPromptGenerateIfNeeded(si)
    void restoreStoryboardCanvasOverlayGenerateIfNeeded(si)
  })()
})
</script>

<style lang="scss" scoped src="~/assets/css/edit-storyboard-image-modal.scoped.scss"></style>
