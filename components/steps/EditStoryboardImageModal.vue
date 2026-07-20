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
                active: currentSceneIndex === index
              }
            ]"
            @click="switchScene(index)"
          >
            <div class="scene-image-thumbnail">
              <a-image
                v-if="getFirstSceneImage(index)?.url"
                :src="getFirstSceneImage(index)?.url"
                :preview="false"
                class="thumbnail-image"
              />
              <div v-else class="thumbnail-placeholder">
                <PictureOutlined />
              </div>
            </div>
            <span class="scene-label">{{ scene.name }}</span>
          </div>
        </HorizontalScrollTabBar>
      </div>

      <!-- 主要内容区域：与 EditSceneImageModal 一致的三栏布局（左：生成记录 | 中：画布与列表 | 右：配置） -->
      <div class="main-content-wrapper">
        <div class="right-panel storyboard-right-panel">
          <div v-if="leftPanelLoading || rightPanelLoading" class="panel-skeleton right-panel-skeleton">
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
                <button
                  v-for="(img, index) in currentSceneImages"
                  :key="`history-${index}`"
                  type="button"
                  :class="['history-item', { active: currentImageIndex === index }]"
                  @click="switchImage(index)"
                >
                  <img v-if="img.url" :src="img.url" :alt="`历史图${index + 1}`" />
                  <div v-else-if="img._generating" class="history-generating" aria-label="生成中">
                    <a-spin size="small" />
                  </div>
                  <div v-else class="history-empty">空</div>
                  <div
                    v-if="currentImageIndex === index && canDeleteHistoryImage(img)"
                    class="history-delete-icon"
                    role="button"
                    tabindex="0"
                    @click.stop.prevent="handleDeleteImage(index)"
                    @keydown.enter.stop.prevent="handleDeleteImage(index)"
                  >
                    <img :src="deleteIcon" alt="删除" />
                  </div>
                </button>
              </div>
              <div class="history-actions">
                <a-button block :loading="isUploadingLocalImage" :disabled="isUploadingLocalImage" @click="handleUploadLocalImage">
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
                    danger
                    :loading="isSettingFinalImage"
                    :disabled="isSettingFinalImage"
                    @click="handleCancelAddImage(currentImageIndex)"
                  >
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

                <div :class="['canvas-preview', { 'is-selected': currentImageIndex >= 0 }]">
                  <div class="canvas-image-frame canvas-image-frame--enhance-wrap">
                    <div
                      v-if="showUpscaleRunningOverlay || showStoryboardGenerateOverlay"
                      class="canvas-upscale-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="canvas-upscale-mask__icon" />
                      <p class="canvas-upscale-mask__text">
                        {{ showStoryboardGenerateOverlay ? storyboardGenerateProgressText : upscaleProgressText }}
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
                        <a-image
                          :src="angle.url"
                          :preview="{ src: angle.url }"
                          class="grid-image"
                        />
                        <div class="angle-label">{{ angle.angle }}</div>
                      </div>
                    </div>
                    <a-image
                      v-else-if="currentImg?.url"
                      :src="currentImg.url"
                      :preview="{ src: currentImg.url }"
                      class="canvas-image"
                    />
                    <div v-else-if="currentImg?._generating" class="canvas-empty canvas-generating">
                      <LoadingOutlined spin class="canvas-upscale-mask__icon" />
                      <p class="canvas-generating__text">分镜图生成中…</p>
                    </div>
                    <div v-else class="canvas-empty">还没有内容,先去左侧创建一个吧</div>
                  </div>
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
                      <span v-if="currentImg.source" class="image-source">{{ currentImg.source }}</span>
                      <span v-if="currentImg.importDate" class="image-date">{{ formatDate(currentImg.importDate) }}</span>
                    </div>
                    <!-- <a-dropdown>
                      <a-button type="text" size="small" class="storyboard-meta-more">
                        <template #icon><MoreOutlined /></template>
                      </a-button>
                      <template #overlay>
                        <a-menu>
                          <a-menu-item @click="handleDownloadImage(currentImageIndex)">
                            <DownloadOutlined />
                            下载
                          </a-menu-item>
                          <a-menu-item danger @click="handleDeleteImage(currentImageIndex)">
                            <DeleteOutlined />
                            删除
                          </a-menu-item>
                        </a-menu>
                      </template>
                    </a-dropdown> -->
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
                    <div v-if="leftActiveTab === 'generate'" class="storyboard-left create-modal-tab-panel">
                      <StoryboardGeneratePanel
                        ref="storyboardGeneratePanelRef"
                        mode="storyboard"
                        :use-precise-layout="false"
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
                      <img src="@/assets/img/icon/star_white.svg" alt="">
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
                      <img src="@/assets/img/icon/star_white.svg" alt="">
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
      v-model:open="showTouchEditModal"
      :image-url="touchEditImageUrl"
    />

  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, h } from 'vue'
import { useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
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
import EllipsisTooltip from '~/components/common/EllipsisTooltip.vue'
import ImportScriptModal from './ImportScriptModal.vue'
import SelectSceneImageModal from './SelectSceneImageModal.vue'
import SelectAssetImageModal from './SelectAssetImageModal.vue'
import DialogueDrawPanel from './DialogueDrawPanel.vue'
import StoryboardGeneratePanel from './StoryboardGeneratePanel.vue'
import type { ParamSettingsConfirmPayload } from './StoryboardParamSettingsModal.vue'
import GenerateModelConfigBlock from './GenerateModelConfigBlock.vue'
import StoryboardScriptModal from './StoryboardScriptModal.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import MultiAngleCameraModal from './MultiAngleCameraModal.vue'
import type { MultiAngleGeneratePayload } from '~/utils/multiAngleCameraPrompt'
import UpscaleModelPopover from './UpscaleModelPopover.vue'
import TouchEditModal from './TouchEditModal.vue'
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
  userStoryboardDetail,
  userStoryboardRecordDelete,
  userStoryboardSetFinalImage,
  userStoryboardUnSetFinalImage,
  userStoryboardUploadImage,
  userAssetRpsFormImageList,
  userAssetRpsMultiAngleImageGenerateReserved
} from '~/utils/businessApi'
import { fetchStoryboardRecordsForStoryboard } from '~/utils/storyboardRecordBatch'
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
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { useCreationStore } from '~/stores/creation'
import { runStoryboardImageUpscaleTask } from '~/composables/useStoryboardImageUpscaleTask'
import { runStoryboardMultiViewGridImageTask } from '~/composables/useStoryboardMultiViewGridImageTask'
import { runStoryboardEditImageTask } from '~/composables/useStoryboardEditImageTask'
import {
  followStoryboardImageGenerateTask,
  isStoryboardImageTaskOngoing,
  runStoryboardImageGenerateTask
} from '~/composables/useStoryboardImageGenerateTask'
import {
  buildModalTaskOverlayKey,
  matchesAnyModalTaskOverlayKey,
  matchesModalTaskOverlayKey
} from '~/composables/useModalTaskScope'
import { useModelList } from '~/composables/useModelList'
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
import {
  isStoryboardImageSelected,
  pickStoryboardCoverImage,
  sortStoryboardImagesForParent
} from '~/utils/storyboardImageCover'
import type { StoryboardRecordRow } from '~/types/business-api'
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
import deleteIcon from '@/assets/img/home/delete-white.svg'

interface Props {
  open: boolean
  sceneIndex: number
  initialImageIndex?: number | null
  scenes: Array<{ name: string; images?: any[]; scriptContent?: string; storyboardId?: number | string }>
  /** 弹窗实例作用域，配合 storyboardId 隔离不同分镜的生图 loading */
  editorScopeKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  editorScopeKey: 'storyboard-image'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update': [sceneIndex: number, data: any]
}>()

const route = useRoute()
const creationStore = useCreationStore()

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
const activeStoryboardImageFollowStoryboardIds = new Set<number>()

const sceneTabBarRef = ref<InstanceType<typeof HorizontalScrollTabBar> | null>(null)
type CanvasToolbarKey = 'drawing' | 'chat' | 'hd' | 'camera' | 'add'
const canvasToolbarHoverKey = ref<CanvasToolbarKey | null>(null)
const canvasToolbarIconMap: Record<CanvasToolbarKey, { nor: string; sel: string }> = {
  drawing: { nor: drawingNorIcon, sel: drawingSelIcon },
  chat: { nor: chatNorIcon, sel: chatSelIcon },
  hd: { nor: hdNorIcon, sel: hdSelIcon },
  camera: { nor: cameraNorIcon, sel: cameraSelIcon },
  add: { nor: addIcon, sel: addIcon }
}
const getCanvasToolbarIcon = (key: CanvasToolbarKey) =>
  (canvasToolbarHoverKey.value === key ? canvasToolbarIconMap[key].sel : canvasToolbarIconMap[key].nor)

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

function mapStoryboardModalModelItem(item: {
  id?: number
  modelCode?: string | null
  modelName?: string | null
  providerName?: string | null
}): ModelOption {
  const code = String(item.modelCode || '').trim()
  const sid = Number(item.id)
  return {
    id: code || String(item.id),
    serverModelId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
    name: item.modelName || code || '未命名模型',
    iconBg: '#60A5FA',
    desc: item.providerName ? `服务商：${item.providerName}` : '',
    prices: []
  }
}

const {
  modelList: modelOptions,
  rawModelList,
  loadModels: loadImageModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.STORYBOARD_IMAGE,
  funcCodeFallbacks: STORYBOARD_IMAGE_FUNC_CODE_FALLBACKS,
  modelType: 'image',
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

const {
  aspectRatioSelectOptions,
  countSelectOptions,
  qualitySelectOptions,
  syncSettingsToModel
} = useModelGenerateSettings({
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
  rawModelList: dialogueRawModelList,
  loadModels: loadDialogueModelOptions
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
    ...IMAGE_MULTI_GRID_FUNC_CODE_FALLBACKS
  ])
  const agentPayloads = [
    { bizCategoryCode: STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY, agentCode: storyboardImageAgentCode },
    { bizCategoryCode: STORYBOARD_IMAGE_PROMPT_AGENT_BIZ_CATEGORY, agentCode: storyboardImageAgentCode }
  ]

  const [agentCodes, modelGroups] = await Promise.all([
    fetchAgentDefaultModelCodes(agentPayloads),
    userModelListByFuncCodes(funcCodes)
  ])

  if (gen !== initImageModelGen) return

  const imageList = pickFirstNonEmptyModelPool(modelGroups, storyboardImageFuncCodes)
  if (imageList.length > 0) {
    rawModelList.value = imageList
    modelOptions.value = imageList.map(mapStoryboardModalModelItem)
  } else {
    await loadImageModelOptions()
  }

  const dialogueList = modelsFromListByFuncGroups(modelGroups, AI_MODEL_FUNC_CODE.IMAGE_EDIT)
  if (dialogueList.length > 0) {
    dialogueRawModelList.value = dialogueList
    dialogueModelOptions.value = dialogueList.map(mapStoryboardModalModelItem)
  } else {
    await loadDialogueModelOptions()
  }

  const multiViewList = modelsFromListByFuncGroups(modelGroups, AI_MODEL_FUNC_CODE.IMAGE_MULTI_VIEW)
  if (multiViewList.length > 0) {
    multiViewModelOptions.value = multiViewList.map(mapStoryboardModalModelItem)
  } else {
    await loadMultiViewModelOptions()
  }

  const nineGridList = pickFirstNonEmptyModelPool(modelGroups, IMAGE_MULTI_GRID_FUNC_CODE_FALLBACKS)
  if (nineGridList.length > 0) {
    nineGridModelOptions.value = nineGridList.map(mapStoryboardModalModelItem)
  } else {
    await loadNineGridModelOptions()
  }

  const imageAgentDefault =
    agentCodes[
      getAgentDefaultModelCacheKey(STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY, storyboardImageAgentCode)
    ] || ''
  const promptAgentDefault =
    agentCodes[
      getAgentDefaultModelCacheKey(STORYBOARD_IMAGE_PROMPT_AGENT_BIZ_CATEGORY, storyboardImageAgentCode)
    ] || ''

  cachedStoryboardImageAgentModelCodes.value = [imageAgentDefault, promptAgentDefault].filter(Boolean)

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
  modelList: multiViewModelOptions,
  loadModels: loadMultiViewModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.IMAGE_MULTI_VIEW,
  modelType: 'image',
  fallback: fallbackMultiViewModelOptions,
  mapItem: (item) => {
    const code = String(item.modelCode || '').trim()
    const sid = Number(item.id)
    return {
      id: code || String(item.id),
      serverModelId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
      name: item.modelName || code || '未命名模型',
      iconBg: '#60A5FA',
      desc: item.providerName ? `服务商：${item.providerName}` : '',
      prices: []
    }
  }
})

const multiViewSettings = ref({ model: 'wan2.7-image' })
const multiViewSelectedModel = computed<ModelOption>(
  () =>
    multiViewModelOptions.value.find((m) => m.id === multiViewSettings.value.model) ||
    multiViewModelOptions.value[0] ||
    fallbackMultiViewModelOptions[0]
)

const {
  modelList: nineGridModelOptions,
  loadModels: loadNineGridModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.IMAGE_MULTI_GRID,
  funcCodeFallbacks: IMAGE_MULTI_GRID_FUNC_CODE_FALLBACKS,
  modelType: 'image',
  fallback: fallbackMultiViewModelOptions,
  mapItem: (item) => {
    const code = String(item.modelCode || '').trim()
    const sid = Number(item.id)
    return {
      id: code || String(item.id),
      serverModelId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
      name: item.modelName || code || '未命名模型',
      iconBg: '#60A5FA',
      desc: item.providerName ? `服务商：${item.providerName}` : '',
      prices: []
    }
  }
})

const nineGridSettings = ref({ model: 'wan2.7-image' })
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
  const aspectRatio = generationSettings.value.aspectRatio || '16:9'
  const count = Math.max(1, Math.min(8, Number(generationSettings.value.count) || 1))
  const agentCode = String(
    creationStore.storyboardStylistGenerateSettings?.agentId ||
      creationStore.storyboardStylistAgent?.id ||
      ''
  ).trim()

  const sceneIdx = currentSceneIndex.value
  const beforeCount = (props.scenes[sceneIdx]?.images || []).length

  await runStoryboardImageGenerateForScene(sceneIdx, {
    submitBody: {
      storyboardIds: [currentStoryboardId.value],
      ...(agentCode ? { agentCode } : {}),
      imagePrompt: promptPlain,
      modelName: modelCode,
      aspectRatio: size ? undefined : aspectRatio,
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

  const overlayParts = overlayKeyParts(sceneIdx, -1, 'storyboard-gen')
  storyboardGenerateTargetKey.value = buildModalTaskOverlayKey(overlayParts)
  isGeneratingStoryboardImage.value = true
  storyboardGenerateProgressText.value = opts.progressSubmitText || '分镜图生成中…'

  const beforeCount = opts.beforeCount
  const onProgress = (p: {
    successCount?: number
    totalCount?: number
    stepTitle?: string
    message?: string
    recordId?: number | null
    items?: Array<{ recordId?: number; imageUrl?: string; imageId?: number }>
  }) => {
    if (p.successCount != null && p.totalCount != null) {
      storyboardGenerateProgressText.value = `已生成 ${p.successCount}/${p.totalCount} 张…`
    } else {
      storyboardGenerateProgressText.value = p.stepTitle || p.message || '分镜图生成中…'
    }
    if (p.recordId != null || (p.items && p.items.length > 0)) {
      void refreshSceneRecords(sceneIdx, p.recordId ?? undefined, beforeCount)
    }
  }

  activeStoryboardImageFollowStoryboardIds.add(storyboardId)

  const projectEpisode = await resolveStoryScriptSaveContext(creationStore, route)

  try {
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
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardImageGenTask(storyboardId, { taskId, sceneIdx })
        },
        onProgress
      })
    } else {
      return
    }

    if (!result.ok) {
      if (!opts.silentComplete) {
        message.error('errorMessage' in result ? result.errorMessage || '生图失败' : '生图失败')
      }
      creationStore.clearStoryboardImageGenTask(storyboardId)
      return
    }

    storyboardGenerateProgressText.value = '同步生成记录…'
    await refreshSceneRecords(sceneIdx, result.recordId, beforeCount)

    if (!opts.silentComplete) {
      message.success('分镜图生成成功')
    }
    creationStore.clearStoryboardImageGenTask(storyboardId)
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  } finally {
    activeStoryboardImageFollowStoryboardIds.delete(storyboardId)
    if (!activeStoryboardImageFollowStoryboardIds.size) {
      isGeneratingStoryboardImage.value = false
    }
    if (
      storyboardGenerateTargetKey.value === buildModalTaskOverlayKey(overlayParts)
    ) {
      storyboardGenerateTargetKey.value = ''
      storyboardGenerateProgressText.value = '分镜图生成中…'
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
const selectAssetModalType = ref<'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other'>('scene')
const showOtherListDropdown = ref(false)

type SettingKey = 'composition' | 'shotSize' | 'cameraAngle' | 'focalLength' | 'colorTone' | 'lighting' | 'technique'

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
const isGeneratingPrompt = ref(false)
const isGeneratingStoryboardImage = ref(false)
const storyboardGenerateProgressText = ref('分镜图生成中…')
const showStoryboardGenerateOverlay = computed(() =>
  matchesModalTaskOverlayKey(
    storyboardGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, -1, 'storyboard-gen')
  )
)
const showStoryboardGenerateButtonLoading = computed(() => showStoryboardGenerateOverlay.value)
const showGeneratingPromptForScene = computed(() =>
  matchesModalTaskOverlayKey(
    promptGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, -1, 'prompt-gen')
  )
)

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
  const selections = extractImagePromptParamSelectionsFromPlain(plain, storyboardPromptParamGroups.value)
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
}

function storyboardBizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

async function fetchStoryboardImagePrompt(storyboardId: number): Promise<string> {
  const row = await userStoryboardDetail({ id: storyboardId })
  return String(row?.imagePrompt ?? '').trim()
}

async function fetchStoryboardImagePromptAfterGenerate(storyboardId: number): Promise<string> {
  return fetchStoryboardPromptPlainWithRetry(storyboardId, 'imagePrompt')
}

/** 分镜图提示词：手动「生成设置」优先，否则读项目生成配置 */
async function resolveImagePromptSubmitFields() {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  const manualAgent = resolveStoryboardPromptAgentCode(creationStore.storyboardStylistGenerateSettings)
  const manualModel = resolveStoryboardPromptModelCode(creationStore.storyboardStylistGenerateSettings)
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

    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }

    let taskOutcome = await awaitStoryboardPromptGenerateTask(taskId)
    if (taskOutcome.ok === false) {
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
    isGeneratingPrompt.value = false
    promptGenerateTargetKey.value = ''
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  }
}

const currentImageIndex = ref(props.initialImageIndex !== null && props.initialImageIndex !== undefined ? props.initialImageIndex : 0)
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
  const ids = list
    .map((x) => Number(x?.id))
    .filter((n) => Number.isFinite(n) && n > 0)
  return ids.length ? ids.join(',') : undefined
}

const currentScriptContentForModal = computed(
  () => (currentScene.value as { scriptContent?: string }).scriptContent ?? ''
)

function handleSaveScriptInImageModal(payload: { title: string; content: string }) {
  const content = payload?.content ?? ''
  const title = payload?.title ?? ''
  emit('update', currentSceneIndex.value, { scriptContent: content, ...(title.trim() ? { title } : {}) })
  showStoryboardScriptModal.value = false
  message.success('分镜脚本已保存')
}

function handleScriptTitleInImageModal(title: string) {
  const t = title?.trim()
  if (!t) return
  emit('update', currentSceneIndex.value, { title: t })
}

const localSceneImages = ref<any[]>([])

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

async function fetchImageRecordsForStoryboard(storyboardId: number): Promise<StoryboardRecordRow[]> {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return []
  return fetchStoryboardRecordsForStoryboard(ctx, storyboardId, 'image')
}

/** 刷新或重新打开弹窗后，恢复当前分镜的生图 loading 与 SSE 追踪（按 storyboardId 隔离） */
async function restoreStoryboardImageGenerateIfNeeded(sceneIdx: number) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return

  const gen = ++resumeStoryboardImageFollowGen

  let rows: StoryboardRecordRow[] = []
  try {
    rows = await fetchImageRecordsForStoryboard(storyboardId)
    const mapped = sortStoryboardImagesForParent(mapRecordRowsToImageItems(rows, sceneIdx))
    emit('update', sceneIdx, { images: mapped })
    syncAddedImageIdsFromList(mapped)

    const pendingIdx = mapped.findIndex((m) => m._generating)
    if (pendingIdx >= 0 && sceneIdx === currentSceneIndex.value) {
      currentImageIndex.value = pendingIdx
    }
  } catch {
    /* 记录拉取失败时仍尝试用 Pinia 中的 taskId 恢复 */
  }

  if (gen !== resumeStoryboardImageFollowGen) return

  const persisted = creationStore.getStoryboardImageGenTask(storyboardId)
  const taskIdFromRecord = findPendingStoryboardRecordTaskId(rows)
  const recordIdFromRecord = findPendingStoryboardRecordId(rows)
  const taskId = taskIdFromRecord ?? persisted?.taskId ?? null

  if (!taskId || activeStoryboardImageFollowStoryboardIds.has(storyboardId)) return

  const ongoing = await isStoryboardImageTaskOngoing(taskId)
  if (gen !== resumeStoryboardImageFollowGen) return

  if (!ongoing) {
    creationStore.clearStoryboardImageGenTask(storyboardId)
    return
  }

  await runStoryboardImageGenerateForScene(sceneIdx, {
    resumeTaskId: taskId,
    resumeRecordId: recordIdFromRecord,
    silentComplete: true
  })
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

async function refreshSceneRecords(
  sceneIdx: number,
  selectRecordId?: number | null,
  minCountBefore?: number
) {
  const raw = props.scenes[sceneIdx]?.storyboardId
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const rows = await fetchImageRecordsForStoryboard(id)
    const mapped = sortStoryboardImagesForParent(mapRecordRowsToImageItems(rows, sceneIdx))
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

watch(() => [props.scenes, currentSceneIndex.value], () => {
  const sceneImages = currentScene.value.images || []
  const pendingImages = localSceneImages.value.filter((img: any) => img._pending)
  const sceneIds = new Set(sceneImages.map((img: any) => img.id).filter(Boolean))
  const pendingOnly = pendingImages.filter((img: any) => img?.id && !sceneIds.has(img.id))
  localSceneImages.value = [
    ...sceneImages.map((img: any) => ({ ...img })),
    ...pendingOnly
  ]
  const n = localSceneImages.value.length
  if (currentImageIndex.value >= n && n > 0) {
    currentImageIndex.value = n - 1
  }
}, { immediate: true, deep: true })

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

const showCancelAddStoryboardImage = computed(() => {
  const img = currentImg.value as
    | { id?: string; _pending?: boolean; isSelected?: boolean; _serverRow?: { isSelected?: number | null } }
    | null
  if (!img?.id || img._pending) return false
  return isStoryboardImageSelected(img)
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

  showStoryboardScriptModal.value = false
  leftPanelLoading.value = true
  rightPanelLoading.value = true
  currentSceneIndex.value = index
  currentImageIndex.value = 0

  await nextTick()
  scrollActiveSceneTabIntoView()
  await loadCurrentStoryboardPrompt()
  void restoreStoryboardImageGenerateIfNeeded(index)
  setTimeout(() => {
    leftPanelLoading.value = false
    rightPanelLoading.value = false
  }, TAB_SWITCH_SKELETON_MS)
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

      const record = await userStoryboardUploadImage({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardId,
        imageUrl: url
      })

      const recordId = Number(record?.id)
      if (!Number.isFinite(recordId) || recordId <= 0) {
        throw new Error('上传落库失败：未返回记录ID')
      }

      pendingImage.value = null
      await refreshSceneRecords(currentSceneIndex.value, recordId)
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
function openSelectModal(type: 'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other') {
  if (
    type === 'pose' ||
    type === 'expression' ||
    type === 'effect' ||
    type === 'draft'
  ) {
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
    const type = materialLibraryCategoryKey.value === 'misc' ? 'other' : materialLibraryCategoryKey.value
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
  Modal.info({
    title: img?.title || img?.name || '预览',
    content: h('img', {
      src: url,
      style: { width: '100%', maxHeight: '70vh', objectFit: 'contain' }
    }),
    width: '80%',
    okText: '关闭'
  })
}

// 从「其他」列表中移除一项
function removeOtherImage(index: number) {
  otherImages.value = otherImages.value.filter((_, i) => i !== index)
}

const handleAssetLibraryImport = (asset: any) => {
  const imageUrl = asset.url || asset.thumbnail || 'https://picsum.photos/800/450?random=' + Date.now()
  const now = new Date()
  pendingImage.value = {
    id: Date.now().toString(),
    url: imageUrl,
    thumbnail: imageUrl,
    title: asset.name || `场景图${currentSceneImages.value.length + 1}`,
    createdAt: now.toISOString(),
    source: '资源库导入',
    importDate: now.toISOString(),
    angles: []
  }

  localSceneImages.value.push({ ...pendingImage.value, _pending: true })
  currentImageIndex.value = localSceneImages.value.length - 1

  message.info('图片已导入，请点击"添加分镜图"按钮确认添加')
  showAssetLibraryModal.value = false
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
  addedImageIds.value.delete(imgId)

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
          await userStoryboardRecordDelete({ storyboardId, recordId })
          await refreshSceneRecords(currentSceneIndex.value)
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
  progressText: string
) {
  upscaleTargetKey.value = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, imgIdx, taskKind))
  upscaleUiPhase.value = 'running'
  upscaleProgressText.value = progressText
  canvasOverlayTaskKind.value = taskKind
}

function endCanvasTaskOverlay() {
  upscaleUiPhase.value = 'idle'
  upscaleTargetKey.value = ''
  upscaleProgressText.value = '高清处理中…'
  canvasOverlayTaskKind.value = null
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
  return (
    isToolbarLoadingForTaskKind('multiangle') || isToolbarLoadingForTaskKind('ninegrid')
  )
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

const showGeneratingDialogueButton = computed(() =>
  isToolbarLoadingForTaskKind('dialogue')
)

function clearUpscaleOverlay() {
  upscaleUiPhase.value = 'idle'
  upscaleTargetKey.value = ''
  upscaleFailedMessage.value = ''
  upscaleProgressText.value = '高清处理中…'
  upscaleContext.value = null
  canvasOverlayTaskKind.value = null
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
  const size = String(dialogueSettings.value.quality || '2k').trim().toUpperCase() || '2K'
  const imageCount = Math.max(1, Math.min(4, Number(dialogueSettings.value.count) || 1))

  const sceneIdx = currentSceneIndex.value
  const imageIndex = currentImageIndex.value
  const beforeCount = (props.scenes[sceneIdx]?.images || []).length

  beginCanvasTaskOverlay(sceneIdx, imageIndex, 'dialogue', '对话作图任务提交中...')

  const result = await runStoryboardEditImageTask({
    storyboardId,
    referenceImage,
    prompt,
    modelCode,
    aspectRatio,
    size,
    imageCount,
    onProgress: (p) => {
      if (p.successCount != null && p.totalCount != null) {
        upscaleProgressText.value = `已生成 ${p.successCount}/${p.totalCount} 张...`
      } else {
        upscaleProgressText.value = p.stepTitle || p.message || '对话作图中...'
      }
    }
  })

  endCanvasTaskOverlay()

  if (!result.ok) {
    message.error('errorMessage' in result ? result.errorMessage || '对话作图失败' : '对话作图失败')
    return
  }

  upscaleProgressText.value = '同步生成记录…'
  const lastRecordId =
    result.items[result.items.length - 1]?.recordId ??
    result.items[result.items.length - 1]?.imageId ??
    null
  await refreshSceneRecords(sceneIdx, lastRecordId, beforeCount)

  const successCount = result.items.length
  const failMsg = result.failCount ? `，${result.failCount} 张失败` : ''
  message.success(`对话作图完成，共生成 ${successCount} 张${failMsg}`)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
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

  beginCanvasTaskOverlay(sceneIdx, imageIndex, 'upscale', '正在提交高清任务…')
  upscaleContext.value = { sceneIndex: sceneIdx, imageIndex }

  let upscaleResult: Awaited<ReturnType<typeof runStoryboardImageUpscaleTask>>
  try {
    upscaleResult = await runStoryboardImageUpscaleTask({
      genRecordId,
      modelCode,
      resolution: payload.resolution,
      onProgress: (p) => {
        upscaleProgressText.value =
          [p.stepTitle, p.message].filter(Boolean).join(' · ') ||
          (typeof p.percent === 'number' ? `${Math.round(p.percent)}%` : '') ||
          '高清处理中…'
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

  if (!upscaleResult.ok) {
    upscaleUiPhase.value = 'failed'
    canvasOverlayTaskKind.value = null
    upscaleFailedMessage.value =
      'errorMessage' in upscaleResult ? upscaleResult.errorMessage || '高清任务失败' : '高清任务失败'
    return
  }

  endCanvasTaskOverlay()
  upscaleContext.value = null
  upscaleProgressText.value = '同步生成记录…'

  await refreshSceneRecords(
    ctx.sceneIndex,
    upscaleResult.recordId ?? genRecordId,
    beforeCount
  )

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }

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
  beginCanvasTaskOverlay(
    sceneIdx,
    imageIndex,
    isNineGrid ? 'ninegrid' : 'multiangle',
    isNineGrid ? '九宫格生图任务提交中...' : '多机位生图任务提交中...'
  )

  const result = await runStoryboardMultiViewGridImageTask({
    storyboardId,
    imageUrl,
    angles,
    modelCode,
    aspectRatio: isNineGrid
      ? nineGridAspectRatio.value || '1:1'
      : generationSettings.value.aspectRatio || '1:1',
    onProgress: (p) => {
      upscaleProgressText.value =
        p.stepTitle || p.message || (isNineGrid ? '九宫格生图中...' : '多机位生图中...')
    }
  })

  endCanvasTaskOverlay()

  if (!result.ok) {
    message.error(
      'errorMessage' in result
        ? result.errorMessage || (isNineGrid ? '九宫格生图失败' : '多机位生图失败')
        : isNineGrid
          ? '九宫格生图失败'
          : '多机位生图失败'
    )
    return
  }

  upscaleProgressText.value = '同步生成记录…'
  await refreshSceneRecords(sceneIdx, result.recordId, beforeCount)

  message.success(isNineGrid ? '九宫格生图完成' : '多机位生图完成')

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }
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

  const recordId = resolveStoryboardRecordId(img)
  if (!recordId) {
    message.warning(
      img._pending
        ? '本地导入的图片暂无生成记录，请先生成分镜图后再设为主图'
        : '当前图片无有效生成记录，无法设为主图'
    )
    return
  }

  if (!String(img.url || '').trim()) {
    message.warning('产物未完成')
    return
  }

  isSettingFinalImage.value = true
  try {
    await userStoryboardSetFinalImage({ storyboardId, recordId })

    if (img._pending) {
      delete img._pending
      pendingImage.value = null
    }

    await refreshSceneRecords(currentSceneIndex.value, recordId)
    addedImageIds.value.add(String(img.id))
    message.success('确认成功')
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '设置分镜主图失败')
  } finally {
    isSettingFinalImage.value = false
  }
}

/** 将当前图设为分镜主图（调用 setFinalImage）；待导入图需先有生成记录 */
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
  if (resolveStoryboardRecordId(img)) {
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
  addedImageIds.value.delete(imgId)

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
      await userStoryboardUnSetFinalImage({ storyboardId, recordId })
      await refreshSceneRecords(currentSceneIndex.value)
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
          updatedScenes[currentSceneIndex.value].images.splice(addingAfterIndex.value + 1, 0, newImage)
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
      .filter(img => !img._pending)
      .map(img => {
        const { _pending, ...rest } = img
        return rest
      })

    if (updatedScenes[currentSceneIndex.value].images.length > 0) {
      emit('update', currentSceneIndex.value, updatedScenes[currentSceneIndex.value])
    }
  }

  modalOpen.value = false
}

watch(() => props.sceneIndex, (newIndex) => {
  if (newIndex !== currentSceneIndex.value) {
    switchScene(newIndex)
  }
})

watch(() => [props.open, props.initialImageIndex], ([isOpen, imageIndex]) => {
  if (isOpen && typeof imageIndex === 'number' && imageIndex >= 0) {
    nextTick(() => {
      if (currentSceneImages.value.length > imageIndex) {
        currentImageIndex.value = imageIndex
      }
    })
  }
}, { immediate: true })

watch(modelOptions, () => reapplyStoryboardImageModelDefaultIfEmpty(), { flush: 'post' })
watch(dialogueModelOptions, () => reapplyStoryboardImageModelDefaultIfEmpty(), { flush: 'post' })

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    void ensurePromptDictLoaded()
    void initImageModelOptions()
    currentSceneIndex.value = props.sceneIndex
    showStoryboardScriptModal.value = false
    const si = props.sceneIndex
    const sceneImages = props.scenes[si]?.images || []
    syncAddedImageIdsFromList(sceneImages)
    void loadCurrentStoryboardPrompt()
    void restoreStoryboardImageGenerateIfNeeded(si)
    nextTick(() => scrollActiveSceneTabIntoView())
  } else {
    initImageModelGen++
    resumeStoryboardImageFollowGen++
    showStoryboardScriptModal.value = false
    addedImageIds.value.clear()
    pendingImage.value = null
  }
}, { immediate: true })

watch(
  () => currentStoryboardId.value,
  (id) => {
    if (!props.open) return
    if (!id) return
    void loadCurrentStoryboardPrompt()
    void restoreStoryboardImageGenerateIfNeeded(currentSceneIndex.value)
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
</script>

<style lang="scss" scoped>
.storyboard-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  overflow: hidden;
  min-height: 0;
}

/* 未展开：右侧设置区窄列(固定宽度)，不占满整行 */
/* 已移除分镜生成子组件的遗留样式，统一由 StoryboardGeneratePanel 维护 */
.edit-scene-image-modal :deep(.ant-modal) {
  max-width: 100vw;
  margin: 0;
  padding: 0;
  top: 0;
  height: 100vh;
}

.edit-scene-image-modal {
  ::v-deep(.ant-modal-content) {
    height: 100vh !important;
    display: flex !important;
    flex-direction: column !important;
    border-radius: 0 !important;
    background: rgba(11, 15, 23, 1) !important;
    padding: 0 !important;
  }
}

.edit-scene-image-modal :deep(.ant-modal-body) {
  flex: 1;
  padding: 0;
  overflow: hidden;
}

.edit-scene-image-container {
  display: flex;
  flex-direction: column;
  height: 99vh;
  max-height: 100vh;
  background: #0b0f17;
  overflow: hidden;
  min-height: 0;
}

.edit-scene-image-container .main-content-wrapper {
  flex: 1;
  min-height: 0;
}

/* 头部（与 EditSceneImageModal 一致） */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: rgba(25, 26, 29, 1);
  border-bottom: 1px solid rgba(128, 154, 188, 0.26);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(225, 239, 255, 0.9) !important;
  font-size: 14px;

  &:hover {
    color: #4ae7fd !important;
    background: rgba(74, 231, 253, 0.08) !important;
  }
}

.scene-switcher {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0;
}

.scene-switcher-track {
  gap: 0.5rem;
  padding: 0 6px 2px;
}

/* 场景 tab缩略图：未选中无边框/背景；选中整卡青色描边 */
.scene-image-tab {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  width: 172px;
  min-width: 172px;
  max-width: 172px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  min-width: 80px;
  box-shadow: none;
}

.scene-image-tab:hover:not(.active) {
  border-color: transparent;
  background: transparent;
}

.scene-image-tab.active {
  border-color: rgba(74, 231, 253, 1);
  background: transparent;
  box-shadow: none;
}

.scene-image-thumbnail {
  width: 100%;
  height: 54px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: rgba(6, 10, 18, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.scene-image-thumbnail :deep(.ant-image),
.scene-image-thumbnail :deep(.thumbnail-image) {
  width: 100% !important;
  height: 100% !important;
  max-width: 100%;
  display: block;
}

.scene-image-thumbnail :deep(.ant-image-img),
.scene-image-thumbnail :deep(img) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-400);
  font-size: 1.25rem;
}

.scene-label {
  font-size: 12px;
  color: var(--gray-700);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
  padding: 0 10px 0;
}

.scene-image-tab.active .scene-label {
  color: rgba(218, 233, 255, 0.92);
  font-weight: 600;
}

/* 主要内容区域 */
.main-content-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 三栏布局（与 EditSceneImageModal .figma-stage-layout 一致） */
.figma-stage-layout {
  display: grid;
  grid-template-columns: 144px minmax(0, 1fr) 398px;
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: #0b0f17;
}

.figma-stage-layout > * {
  min-height: 0;
}

.stage-history-panel,
.stage-config-panel {
  border: 1px solid rgba(128, 154, 188, 0.26);
  background: rgba(25, 26, 29, 1);
}

.stage-history-panel {
  display: flex;
  flex-direction: column;
  padding: 10px 7px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.stage-history-panel .panel-title {
  margin: 0 0 10px;
  font-size: 12px;
  color: rgba(225, 239, 255, 0.7);
  flex-shrink: 0;
}

.stage-history-panel .history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  flex: 1;
  padding: 0 12px 10px;
  scrollbar-gutter: stable;
}

.stage-history-panel .history-item {
  position: relative;
  width: 88px;
  height: 88px;
  flex: 0 0 88px;
  padding: 0;
  border-radius: 8px;
  border: 2px solid rgba(120, 140, 170, 0.3);
  overflow: hidden;
  background: rgba(18, 24, 36, 0.92);
  cursor: pointer;
}

.history-delete-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 5;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 77, 79, 0.6);
  cursor: pointer;
}

.history-delete-icon img {
  width: 16px;
  height: 16px;
  display: block;
}

.stage-history-panel .history-item.active {
  border-color: rgba(74, 231, 253, 1);
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.18);
}

.stage-history-panel .history-item img,
.stage-history-panel .history-empty,
.stage-history-panel .history-generating {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stage-history-panel .history-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(225, 239, 255, 0.55);
  font-size: 12px;
}

.stage-history-panel .history-generating {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 18, 28, 0.88);
}

.stage-history-panel .history-actions {
  margin-top: auto;
  padding: 0 0.25rem;
  display: grid;
  gap: 0.375rem;
  flex-shrink: 0;
  background: rgba(25, 26, 29, 1);
}

.stage-history-panel .history-actions :deep(.ant-btn) {
  width: 100%;
  min-width: 0;
  height: 1.75rem;
  padding: 0 0.375rem;
  font-size: 0.75rem;
  line-height: 1.2;
  border: 1px dashed rgba(74, 231, 253, 0.3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.stage-history-panel .history-actions :deep(.ant-btn > .ant-btn-icon) {
  flex-shrink: 0;
  margin-inline-end: 0 !important;
}

.stage-history-panel .history-actions :deep(.ant-btn > span:not(.ant-btn-icon)) {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.stage-history-panel .history-actions :deep(.ant-btn .ellipsis-tooltip-text) {
  display: block;
  width: 100%;
  max-width: 100%;
}

.stage-canvas-panel.storyboard-stage-canvas {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(128, 154, 188, 0.22);
  background:
    radial-gradient(circle at 1px 1px, rgba(74, 231, 253, 0.1) 1px, transparent 0),
    #07090d;
  background-size: 14px 14px, auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 与 EditSceneImageModal .canvas-content-stack 同宽、同顶距 */
.storyboard-canvas-stack {
  width: 562px;
  max-width: 100%;
  margin: 0 auto;
  margin-top: 56px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 0 auto;
  min-height: 0;
}

/* 与 EditSceneImageModal 中间栏：顶条 + 五按钮工具栏 + 预览框 */
.storyboard-canvas-subbar {
  flex-shrink: 0;
  width: 100%;
}

.storyboard-canvas-subbar .storyboard-toolbar-inner {
  justify-content: flex-end;
}

.storyboard-stage-canvas .canvas-toolbar {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  margin: 0 auto;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;
  background: rgba(17, 22, 33, 1);
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid rgba(128, 154, 188, 0.18);
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn-text) {
  width: 6.25rem;
  min-width: 6.25rem;
  height: 2.25rem;
  padding: 0 0.375rem;
  flex-shrink: 0;
}

.storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn-text:hover) {
  background: rgba(18, 18, 18, 1) !important;
}

.storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn) {
  height: 1.75rem;
  padding: 0 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: rgba(142, 151, 165, 1);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn > span:not(.ant-btn-icon)) {
  flex: 0 1 auto;
  min-width: 0;
  max-width: none;
  overflow: visible;
  white-space: nowrap;
}

.storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn .toolbar-tab-icon) {
  width: 14px;
  height: 14px;
  display: block;
}

.storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn.toolbar-tab-hover),
.storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn.toolbar-tab-hover > span) {
  color: #fff !important;
}

.figma-stage-layout .storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn-text),
.figma-stage-layout .storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn-text .ant-btn-icon),
.figma-stage-layout .storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn-text .anticon),
.figma-stage-layout .storyboard-stage-canvas .canvas-toolbar :deep(.ant-btn-text > span) {
  color: rgba(142, 151, 165, 1) !important;
}

/* 与 EditSceneImageModal .canvas-preview 同尺寸（492×278） */
.storyboard-stage-canvas .canvas-preview {
  margin: auto;
  width: 492px;
  max-width: 100%;
  height: 278px;
  flex: 0 0 auto;
  border-radius: 12px;
  border: 1px solid rgba(128, 154, 188, 0.34);
  background: rgba(8, 12, 20, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.storyboard-stage-canvas .canvas-preview.is-selected {
  border-color: #4ae7fd;
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.2), 0 10px 24px rgba(4, 11, 23, 0.55);
}

.storyboard-stage-canvas .canvas-image-frame {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.storyboard-stage-canvas .canvas-image-frame--enhance-wrap {
  position: relative;
}

.storyboard-stage-canvas .canvas-upscale-mask {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 16px;
  text-align: center;
  background: rgba(10, 14, 22, 0.85);
  backdrop-filter: blur(5px);
}

.storyboard-stage-canvas .canvas-upscale-mask--failed {
  gap: 12px;
}

.storyboard-stage-canvas .canvas-upscale-mask__icon {
  font-size: 32px;
  color: #4ae7fd;
}

.storyboard-stage-canvas .canvas-upscale-mask__text {
  margin: 0;
  font-size: 13px;
  color: rgba(225, 239, 255, 0.88);
  max-width: 90%;
}

.storyboard-stage-canvas .canvas-upscale-mask__err {
  margin: 0;
  font-size: 13px;
  color: #ff9db4;
  max-width: 92%;
  line-height: 1.45;
}

.storyboard-stage-canvas .canvas-image-frame .four-grid-images--canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 6px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 6px;
}

.storyboard-stage-canvas .canvas-image-frame .four-grid-images--canvas .grid-image-item {
  position: relative;
  min-width: 0;
  min-height: 0;
  aspect-ratio: unset;
  overflow: hidden;
  border-radius: 6px;
}

.storyboard-stage-canvas :deep(.canvas-image) {
  width: 100%;
  height: 100%;
  object-fit: cover ;
}

.storyboard-stage-canvas :deep(.ant-image) {
  width: 100% !important;
  height: 100% !important;
}

.storyboard-stage-canvas :deep(.canvas-image .ant-image-img) {
  object-fit: cover !important;
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.storyboard-stage-canvas .four-grid-images--canvas :deep(.ant-image-img) {
  object-fit: cover !important;
  width: 100% !important;
  height: 100% !important;
}

.storyboard-stage-canvas .canvas-empty {
  color: rgba(225, 239, 255, 0.55);
  font-size: 14px;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.storyboard-stage-canvas .canvas-generating {
  flex-direction: column;
  gap: 12px;
}

.storyboard-stage-canvas .canvas-generating__text {
  margin: 0;
  color: rgba(225, 239, 255, 0.72);
  font-size: 14px;
}

.storyboard-canvas-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 10px;
  padding: 8px 4px 0;
  max-width: 562px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.storyboard-canvas-meta-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  min-width: 0;
  flex: 1;
  font-size: 12px;
}

.storyboard-canvas-meta-title {
  font-weight: 600;
  color: rgba(225, 239, 255, 0.95);
  cursor: pointer;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.storyboard-meta-title-input {
  max-width: 100%;
}

.storyboard-meta-more {
  color: rgba(225, 239, 255, 0.75) !important;
  flex-shrink: 0;
}

.storyboard-toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  width: 100%;
}

.storyboard-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.toolbar-aux-btn {
  color: rgba(225, 239, 255, 0.88) !important;
  font-size: 12px;
  height: 28px;
  padding: 0 8px;
}

.toolbar-aux-btn:hover {
  color: #4ae7fd !important;
  background: rgba(74, 231, 253, 0.08) !important;
}

.toolbar-aux-btn--primary {
  color: #4ae7fd !important;
}

.storyboard-stage-config {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 12px 12px 12px;
}

.config-tabs {
  display: flex;
  width: 70%;
  justify-content: center;
  border-radius: 8px;
  background: rgba(35, 67, 74, 1);
  margin-bottom: 18px;
  margin-left: auto;
  margin-right: auto;
  flex-shrink: 0;
}

.config-tab {
  flex: 1;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(225, 239, 255, 0.7);
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.config-tabs .config-tab.active {
  color: #0b1522 !important;
  font-weight: 600;
  background: rgba(74, 231, 253, 1);
}

.config-tabs--three {
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  background: rgba(35, 67, 74, 1);
  margin-bottom: 12px;
  flex-shrink: 0;
}

.config-tabs--three .config-tab {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(225, 239, 255, 0.7);
  font-size: 14px;
  line-height: 1.2;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 4px;
}

.config-tabs--three .config-tab.active {
  color: #0b1522 !important;
  font-weight: 600;
  background: rgba(74, 231, 253, 1);
}

.config-tab-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.storyboard-config-below-tabs {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-right: 0;
}

.storyboard-config-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-right: 4px;
}

.storyboard-config-scroll::-webkit-scrollbar {
  width: 0;
}

.storyboard-config-scroll::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.55);
  border-radius: 4px;
}

.storyboard-config-footer {
  flex-shrink: 0;
  padding: 10px 2px 4px;
  border-top: 1px solid rgba(128, 154, 188, 0.2);
  background: rgba(25, 26, 29, 1);
}

.storyboard-config-footer :deep(.generate-btn) {
  margin: 0;
  height: 46px;
  border-radius: 10px;
  font-size: 16px;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
  border: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  img{
    width: 18px;
    height: 18px;
  }
}

.storyboard-config-footer :deep(.generate-btn:hover) {
  filter: brightness(1.06);
}

.storyboard-config-body {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 2px 2px;
  min-height: 0;
}

.storyboard-config-body .storyboard-left {
  padding: 0;
  gap: 0;
  min-height: 0;
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.storyboard-config-body .storyboard-left :deep(.storyboard-generate-panel) {
  flex: 1 1 0;
  min-height: 0;
}

/* 由外层 storyboard-config-below-tabs 滚动；面板按内容增高，避免内部 height:100% 裁切底部按钮 */
.storyboard-config-below-tabs :deep(.storyboard-generate-panel) {
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}

.storyboard-config-below-tabs :deep(.storyboard-generate-panel.use-param-modal) {
  height: 100% !important;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden !important;
}

.storyboard-config-below-tabs :deep(.storyboard-generate-panel.is-compact-height) {
  overflow-y: visible !important;
}

@media (max-height: 900px) {
  .storyboard-stage-config {
    padding: 8px 8px 8px;
  }

  .config-tabs--three {
    margin-bottom: 8px;
  }

  .config-tabs--three .config-tab {
    height: 28px;
    font-size: 13px;
  }
}

.tab-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(188, 205, 228, 0.55);
  font-size: 0.875rem;
}

.dialogue-tab {
  width: 100%;
  min-height: 0;
}

.dialogue-tab :deep(.dialogue-draw-panel) {
  height: 100%;
}

.dialogue-upload-strip {
  width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 64px;
  padding: 10px;
  border-radius: 12px;
  background: #121212;
}

.dialogue-upload-thumb {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(128, 154, 188, 0.28);
  background: rgba(8, 12, 20, 0.9);
  flex-shrink: 0;
}

.dialogue-upload-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dialogue-upload-thumb__remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 77, 79, 0.95);
  color: #fff;
  cursor: pointer;
  font-size: 10px;
  line-height: 1;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 2;
}

.dialogue-upload-thumb:hover .dialogue-upload-thumb__remove {
  opacity: 1;
  transform: scale(1);
}

.dialogue-upload-thumb--adder {
  border: 1px dashed rgba(188, 205, 228, 0.6);
  background: transparent;
  color: rgba(225, 239, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.dialogue-upload-thumb--adder:hover {
  border-color: rgba(74, 231, 253, 0.85);
  color: rgba(74, 231, 253, 1);
}

.dialogue-upload-empty-hint {
  margin-left: 4px;
  color: rgba(188, 205, 228, 0.62);
  font-size: 12px;
}

.dialogue-instruction {
  border-radius: 12px;
}

.dialogue-instruction :deep(.rich-text-editor__host) {
  border-radius: 12px;
  overflow: hidden;
}

/* 主舞台容器（与 EditSceneImageModal 右侧面板一致：占满头部以下区域） */
.right-panel.storyboard-right-panel {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(128, 154, 188, 0.22);
  flex-shrink: 0;
  background: rgba(17, 22, 33, 0.85);
}

/* 左右面板切换分镜 Tab 时的独立骨架屏 */
.panel-skeleton {
  flex: 1;
  overflow: auto;
  padding: 1rem 1.25rem;
  min-height: 200px;
  background: transparent;
}

.panel-skeleton :deep(.ant-skeleton-content .ant-skeleton-title),
.panel-skeleton :deep(.ant-skeleton-content .ant-skeleton-paragraph > li) {
  background: linear-gradient(
    90deg,
    #2b2b2b 20%,
    #444444 50%,
    #2b2b2b 80%
  ) !important;
  background-size: 300% 100% !important;
  animation: storyboard-skeleton-shimmer 1.4s linear infinite !important;
}

.left-panel-skeleton {
  border-bottom: none;
}

.right-panel-skeleton {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0 !important;
  overflow: hidden;
}

.skeleton-stage-layout {
  display: grid;
  grid-template-columns: 144px minmax(0, 1fr) 398px;
  height: 100%;
  min-height: 0;
  background: #0b0f17;
}

.skeleton-history-panel,
.skeleton-canvas-panel,
.skeleton-config-panel {
  border: 1px solid rgba(128, 154, 188, 0.24);
  background: rgba(25, 26, 29, 1);
  min-width: 0;
  min-height: 0;
}

.skeleton-history-panel {
  display: flex;
  flex-direction: column;
  padding: 10px 7px;
}

.skeleton-panel-title {
  width: 64px;
  height: 12px;
  border-radius: 6px;
  margin-bottom: 10px;
}

.skeleton-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.skeleton-history-item {
  width: 100%;
  height: 60px;
  border-radius: 8px;
}

.skeleton-history-actions {
  margin-top: auto;
  padding-top: 8px;
  display: grid;
  gap: 6px;
}

.skeleton-btn {
  width: 100%;
  height: 28px;
  border-radius: 8px;
}

.skeleton-canvas-panel {
  display: flex;
  flex-direction: column;
  padding: 14px;
  background: rgba(25, 26, 29, 1);
}

.skeleton-canvas-toolbar {
  margin: 0 auto 10px;
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid rgba(128, 154, 188, 0.22);
  background: rgba(17, 22, 33, 0.75);
  display: flex;
  gap: 8px;
}

.skeleton-chip {
  width: 78px;
  height: 26px;
  border-radius: 6px;
}

.skeleton-canvas-main {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  border: 1px solid rgba(128, 154, 188, 0.24);
}

.skeleton-config-panel {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
}

.skeleton-config-tabs {
  display: flex;
  gap: 6px;
  padding: 3px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}

.skeleton-tab {
  flex: 1;
  height: 32px;
  border-radius: 6px;
}

.skeleton-file-row {
  height: 42px;
  border-radius: 10px;
}

.skeleton-textarea {
  height: 200px;
  border-radius: 10px;
}

.skeleton-select-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.skeleton-select {
  height: 36px;
  border-radius: 8px;
}

.skeleton-primary-btn {
  margin-top: auto;
  height: 40px;
  border-radius: 10px;
}

.skeleton-panel-title,
.skeleton-history-item,
.skeleton-btn,
.skeleton-chip,
.skeleton-canvas-main,
.skeleton-tab,
.skeleton-file-row,
.skeleton-textarea,
.skeleton-select,
.skeleton-primary-btn {
  background: linear-gradient(90deg, #2b2b2b 20%, #444444 50%, #2b2b2b 80%);
  background-size: 300% 100%;
  animation: storyboard-skeleton-shimmer 1.4s linear infinite;
}

@keyframes storyboard-skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

.view-switcher {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid rgba(120, 140, 170, 0.28);
  background: rgba(8, 12, 20, 0.85);
  color: rgba(225, 239, 255, 0.88);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn-icon {
  font-size: 1rem;
}

.view-btn.active {
  border-color: rgba(74, 231, 253, 0.55);
  background: rgba(74, 231, 253, 0.12);
  color: #4ae7fd;
}

.right-actions {
  display: flex;
  gap: 0.75rem;
}

.right-actions :deep(.ant-btn) {
  height: 36px;
  border-radius: 8px;
  font-size: 13px;
}

.right-actions :deep(.ant-btn-default) {
  background: rgba(8, 12, 20, 0.9) !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  color: rgba(225, 239, 255, 0.9) !important;
}

.right-actions :deep(.ant-btn-default:hover) {
  border-color: rgba(74, 231, 253, 0.45) !important;
  color: #4ae7fd !important;
}

.right-actions :deep(.ant-btn-primary) {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
}

.empty-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(188, 205, 228, 0.55);
  font-size: 14px;
}

.images-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.image-card {
  border: 1px solid rgba(128, 154, 188, 0.26);
  border-radius: 12px;
  padding: 1.5rem;
  background: rgba(25, 26, 29, 0.95);
  transition: all 0.2s ease;
}

.image-card.active {
  border-color: #4ae7fd;
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.2), 0 10px 24px rgba(4, 11, 23, 0.45);
}

.image-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.image-header-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.image-title {
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(225, 239, 255, 0.95);
}

.image-title:hover {
  background: rgba(74, 231, 253, 0.1);
}

.image-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: rgba(188, 205, 228, 0.65);
}

.image-source {
  padding: 0.125rem 0.5rem;
  background: rgba(8, 12, 20, 0.9);
  border-radius: var(--radius-sm);
  color: rgba(188, 205, 228, 0.8);
}

.image-date {
  color: rgba(188, 205, 228, 0.55);
}

.image-card-body {
  margin-bottom: 1rem;
}

.main-image {
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: var(--radius-md);
}

/* 四宫格图样式 */
.four-grid-images {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.grid-image-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.grid-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.angle-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  color: white;
  padding: 0.5rem;
  font-size: 0.75rem;
  text-align: center;
}

.image-placeholder {
  aspect-ratio: 16 / 9;
  border: 2px dashed rgba(74, 231, 253, 0.28);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: rgba(188, 205, 228, 0.5);
  background: rgba(8, 12, 20, 0.5);
}

.image-placeholder .anticon {
  font-size: 3rem;
}

.image-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.image-card-actions-right {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.image-card-actions :deep(.ant-btn),
.image-card-actions-right :deep(.ant-btn) {
  border-radius: 8px;
  font-size: 12px;
}

.image-card-actions :deep(.ant-btn-default) {
  background: rgba(8, 12, 20, 0.9) !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  color: rgba(225, 239, 255, 0.88) !important;
}

.image-card-actions :deep(.ant-btn-primary) {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  border: none !important;
}

/* 卡片视图样式 */
.images-container-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, 286px);
  gap: 1.5rem;
}

.image-card-view {
  width: 286px;
  height: 130px;
  border: 1px solid rgba(128, 154, 188, 0.26);
  border-radius: 12px;
  background: rgba(25, 26, 29, 0.95);
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.image-card-view:hover {
  border-color: rgba(74, 231, 253, 0.45);
  box-shadow: 0 8px 24px rgba(4, 11, 23, 0.5);
}

.image-card-view.active {
  border-color: #4ae7fd;
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.2), 0 10px 24px rgba(4, 11, 23, 0.45);
}

.card-image-wrapper {
  position: relative;
  width: 100%;
  height: calc(130px - 40px);
  overflow: hidden;
  background: rgba(8, 12, 20, 0.94);
}

.card-image-top-actions {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  gap: 0.5rem;
  z-index: 10;
}

.card-image-top-actions .card-action-btn {
  background: rgba(8, 12, 20, 0.85) !important;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(78, 94, 122, 0.45) !important;
  color: rgba(225, 239, 255, 0.92) !important;
  transition: all 0.2s ease;
}

.card-image-top-actions .card-action-btn:hover {
  background: rgba(74, 231, 253, 0.12) !important;
  border-color: rgba(74, 231, 253, 0.5) !important;
  color: #4ae7fd !important;
}

.card-bottom-right .card-action-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 12, 20, 0.75);
  border: 1px solid rgba(78, 94, 122, 0.42);
  color: rgba(225, 239, 255, 0.88);
  transition: all 0.2s ease;
}

.card-bottom-right .card-action-btn:hover {
  background: rgba(74, 231, 253, 0.1);
  border-color: rgba(74, 231, 253, 0.45);
  color: #4ae7fd;
}

.card-image-body {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-main-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: rgba(188, 205, 228, 0.45);
}

.card-image-placeholder .anticon {
  font-size: 3rem;
}

.card-actions-bar {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.5rem;
  background: rgba(17, 22, 33, 0.95);
  border-top: 1px solid rgba(128, 154, 188, 0.22);
  flex-shrink: 0;
}

.card-bottom-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.card-bottom-left .ant-btn {
  height: 28px;
  font-size: 0.75rem;
  padding: 0 0.75rem;
}

.card-bottom-left :deep(.ant-btn-default) {
  background: rgba(8, 12, 20, 0.9) !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  color: rgba(225, 239, 255, 0.88) !important;
}

.card-bottom-left :deep(.ant-btn-primary) {
  background: linear-gradient(270deg, #2a6cfb 0%, #4ae7fd 100%) !important;
  border: none !important;
}

.image-card-header :deep(.ant-input) {
  background: rgba(8, 12, 20, 0.9) !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  color: #d7e8ff !important;
}

.card-bottom-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
</style>

