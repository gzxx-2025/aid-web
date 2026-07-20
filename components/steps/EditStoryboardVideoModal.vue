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
            v-for="(tab, index) in sceneTabsForHeader"
            :key="index"
            :class="['scene-image-tab', { active: currentSceneIndex === index }]"
            @click="switchScene(index)"
          >
            <div class="scene-image-thumbnail">
              <div v-if="isSceneVideoGenerating(index)" class="thumbnail-loading-wrap">
                <LoadingOutlined spin class="thumbnail-loading-icon" />
              </div>
              <div v-else-if="getFirstVideo(index)?.url" class="thumbnail-video-wrap">
                <video :src="getFirstVideo(index)?.url" class="thumbnail-video" muted />
              </div>
              <div v-else class="thumbnail-placeholder">
                <VideoCameraOutlined />
              </div>
            </div>
            <span class="scene-label">{{ tab.tabLabel }}</span>
          </div>
        </HorizontalScrollTabBar>
      </div>

      <div class="main-content-wrapper">
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

        <div v-else class="figma-stage-layout video-stage-layout">
          <!-- 左：生成记录（与 EditStoryboardImageModal 一致） -->
          <aside class="stage-history-panel">
            <h4 class="panel-title">生成记录</h4>
            <div class="history-list">
              <template v-if="currentSceneVideos.length === 0">
                <div class="history-empty-msg">暂无生成记录</div>
              </template>
              <template v-else>
                <button
                  v-for="(v, idx) in currentSceneVideos"
                  :key="v.id || idx"
                  type="button"
                  :class="[
                    'history-item',
                    'video-history-item',
                    { active: selectedVideoIdx === idx }
                  ]"
                  @click="selectedVideoIdx = idx"
                >
                  <video v-if="v.url" :src="v.url" class="history-thumb-video" muted playsinline />
                  <div v-else class="history-empty">空</div>
                  <div
                    v-if="selectedVideoIdx === idx && canDeleteHistoryVideo(v)"
                    class="history-delete-icon"
                    role="button"
                    tabindex="0"
                    @click.stop.prevent="handleDeleteVideo(idx)"
                    @keydown.enter.stop.prevent="handleDeleteVideo(idx)"
                  >
                    <img :src="deleteIcon" alt="删除" />
                  </div>
                </button>
              </template>
            </div>
            <div class="history-actions">
              <a-button block @click="handleUploadLocalVideo">
                <template #icon><UploadOutlined /></template>
                <EllipsisTooltip title="本地上传视频" />
              </a-button>
              <a-button block @click="handleOpenVideoLibrary">
                <template #icon><FolderOutlined /></template>
                <EllipsisTooltip title="资源库导入视频" />
              </a-button>
            </div>
          </aside>

          <!-- 中：工具栏 + 列表/预览 -->
          <section class="stage-canvas-panel video-stage-canvas">
            <div class="video-canvas-toolbar">
              <div class="view-switcher">
                <button
                  :class="['view-btn', { active: viewMode === 'list' }]"
                  @click="viewMode = 'list'"
                >
                  <UnorderedListOutlined class="view-btn-icon" />
                  列表
                </button>
                <button
                  :class="['view-btn', { active: viewMode === 'card' }]"
                  @click="viewMode = 'card'"
                >
                  <AppstoreOutlined class="view-btn-icon" />
                  卡片
                </button>
              </div>
            </div>
            <div class="video-canvas-body video-canvas-body--enhance-wrap">
              <div
                v-if="showVideoGenerateCanvasOverlay"
                class="canvas-upscale-mask"
                role="status"
                aria-live="polite"
              >
                <LoadingOutlined spin class="canvas-upscale-mask__icon" />
                <p class="canvas-upscale-mask__text">{{ videoGenerateOverlayLabel }}</p>
              </div>
              <div v-if="currentSceneVideos.length === 0" class="canvas-empty video-canvas-empty">
                还没有内容,先去右侧配置并生成吧
              </div>
              <div v-else-if="viewMode === 'list'" class="videos-list videos-list--in-canvas">
                <div v-for="(v, idx) in currentSceneVideos" :key="v.id || idx" class="video-card">
                  <div class="video-card-header">
                    <span class="video-source">{{ v.source || '本地上传' }}</span>
                    <span v-if="v.importDate" class="video-date">{{
                      formatDate(v.importDate)
                    }}</span>
                  </div>
                  <div class="video-preview-wrap">
                    <video
                      v-if="v.url"
                      :ref="(el) => setVideoPreviewRef(el as HTMLVideoElement | null, idx)"
                      :src="v.url"
                      class="video-preview"
                      playsinline
                      muted
                      @ended="onVideoPreviewEnded(idx)"
                      @pause="onVideoPreviewPause(idx)"
                    />
                    <div v-else class="video-placeholder">
                      <VideoCameraOutlined />
                      <span>未设置分镜视频</span>
                    </div>
                    <div
                      v-if="v.url && playingVideoIdx !== idx"
                      class="video-play-overlay"
                      @click.stop="handlePlayVideo(idx)"
                    >
                      <span class="play-icon"><CaretRightOutlined /></span>
                    </div>
                    <div v-if="v.url" class="video-top-actions">
                      <a-button
                        type="text"
                        size="small"
                        class="video-action-btn"
                        @click.stop="handleFullscreenVideo(idx)"
                      >
                        <FullscreenOutlined />
                      </a-button>
                      <a-button
                        type="text"
                        size="small"
                        class="video-action-btn"
                        @click.stop="handleDownloadVideo(idx, v)"
                      >
                        <DownloadOutlined />
                      </a-button>
                    </div>
                  </div>
                  <div class="video-card-actions">
                    <a-button
                      v-if="!v.isStoryboardVideo"
                      type="primary"
                      size="small"
                      class="btn-set-storyboard"
                      :loading="isSettingFinalVideo"
                      :disabled="isSettingFinalVideo"
                      @click="setAsStoryboardVideo(idx)"
                    >
                      <CheckOutlined class="mr-1" />
                      设置为分镜视频
                    </a-button>
                    <a-button
                      v-else
                      size="small"
                      class="btn-set-storyboard-done"
                      :loading="isSettingFinalVideo"
                      :disabled="isSettingFinalVideo"
                      @click="unsetAsStoryboardVideo(idx)"
                    >
                      <CheckCircleFilled class="mr-1" />
                      取消设置
                    </a-button>
                  </div>
                </div>
              </div>
              <div v-else class="videos-list videos-list-card videos-list--in-canvas">
                <div
                  v-for="(v, idx) in currentSceneVideos"
                  :key="v.id || idx"
                  class="video-card video-card-view"
                >
                  <div class="video-card-header">
                    <span class="video-source">{{ v.source || '本地上传' }}</span>
                    <span v-if="v.importDate" class="video-date">{{
                      formatDate(v.importDate)
                    }}</span>
                  </div>
                  <div class="video-preview-wrap">
                    <video
                      v-if="v.url"
                      :ref="(el) => setVideoPreviewRef(el as HTMLVideoElement | null, idx)"
                      :src="v.url"
                      class="video-preview"
                      playsinline
                      muted
                      @ended="onVideoPreviewEnded(idx)"
                      @pause="onVideoPreviewPause(idx)"
                    />
                    <div v-else class="video-placeholder">
                      <VideoCameraOutlined />
                      <span>未设置分镜视频</span>
                    </div>
                    <div
                      v-if="v.url && playingVideoIdx !== idx"
                      class="video-play-overlay"
                      @click.stop="handlePlayVideo(idx)"
                    >
                      <span class="play-icon"><CaretRightOutlined /></span>
                    </div>
                    <div v-if="v.url" class="video-top-actions">
                      <a-button
                        type="text"
                        size="small"
                        class="video-action-btn"
                        @click.stop="handleFullscreenVideo(idx)"
                      >
                        <FullscreenOutlined />
                      </a-button>
                      <a-button
                        type="text"
                        size="small"
                        class="video-action-btn"
                        @click.stop="handleDownloadVideo(idx, v)"
                      >
                        <DownloadOutlined />
                      </a-button>
                    </div>
                  </div>
                  <div class="video-card-actions">
                    <a-button
                      v-if="!v.isStoryboardVideo"
                      type="primary"
                      size="small"
                      class="btn-set-storyboard"
                      :loading="isSettingFinalVideo"
                      :disabled="isSettingFinalVideo"
                      @click="setAsStoryboardVideo(idx)"
                    >
                      <CheckOutlined class="mr-1" />
                      设置为分镜视频
                    </a-button>
                    <a-button
                      v-else
                      size="small"
                      class="btn-set-storyboard-done"
                      :loading="isSettingFinalVideo"
                      :disabled="isSettingFinalVideo"
                      @click="unsetAsStoryboardVideo(idx)"
                    >
                      <CheckCircleFilled class="mr-1" />
                      取消设置
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 右：生成配置（原左侧表单） -->
          <aside class="stage-config-panel video-stage-config">
            <div class="config-tabs config-tabs--three">
              <button
                type="button"
                :class="['config-tab', { active: leftActiveTab === 'imageToVideo' }]"
                @click="leftActiveTab = 'imageToVideo'"
              >
                图生视频
              </button>
              <button
                type="button"
                :class="['config-tab', { active: leftActiveTab === 'multiParam' }]"
                @click="leftActiveTab = 'multiParam'"
              >
                多参生视频
              </button>
              <button
                type="button"
                :class="['config-tab', { active: leftActiveTab === 'startEndFrame' }]"
                @click="leftActiveTab = 'startEndFrame'"
              >
                首尾帧视频
              </button>
            </div>

            <div class="video-config-below-tabs">
              <div class="video-config-scroll create-modal-config-scroll">
                <div class="video-config-body create-modal-config-body">
                  <!-- 图生视频：与编辑分镜脚本同一套 StoryboardGeneratePanel（mode=storyboardVideo 区分分镜视频） -->
                  <div v-if="leftActiveTab === 'imageToVideo'" class="video-left-content create-modal-tab-panel">
                    <StoryboardGeneratePanel
                      ref="imageToVideoPanelRef"
                      mode="storyboardVideo"
                      :use-precise-layout="false"
                      :scene-file-name="scriptRowLabel"
                      icon-type="scene"
                      :show-reference-button="false"
                      :show-generate-prompt-button="true"
                      :generate-prompt-loading="showGeneratingVideoPromptForScene"
                      :show-save-prompt-button="true"
                      :save-prompt-loading="isSavingVideoPrompt"
                      :extra-prompt-assets="resolvedVideoPromptAssets"
                      v-model:prompt="imageToVideoPrompt"
                      prompt-placeholder="描述你想要生成的画面内容和动作,如:一个穿着红色裙子的小女孩在草地上奔跑"
                      v-model:is-setting-expanded="isImageToVideoSettingExpanded"
                      v-model:nine-grid-enabled="nineGridEnabled"
                      v-model:reference-image="referenceImage"
                      :reference-images="referenceImages"
                      v-model:selected-camera-movement="selectedCameraMovement"
                      v-model:camera-movement-desc="cameraMovementDesc"
                      v-model:selected-shooting-technique="selectedImageToVideoShootingTechnique"
                      v-model:active-video-setting-key="activeImageToVideoSettingKey"
                      :scene-images="sceneImages"
                      :character-images="characterImages"
                      :prop-images="propImages"
                      :other-images="otherImages"
                      @open-script="openStoryboardScriptEditor"
                      @generate-prompt="handleImageToVideoGeneratePrompt"
                      @save-prompt="handleSaveVideoPrompt"
                      @import-reference="handleImportReference"
                      @preview-reference="onPreviewReferenceImage"
                      @preview-reference-image="previewReferenceImage"
                      @remove-reference-image="removeReferenceImageAt"
                      @clear-reference="clearReferenceImage"
                      @copy-prompt="copyImageToVideoPrompt"
                      @copy-camera-movement-desc="copyCameraDesc"
                      @param-settings-confirm="applyImageToVideoParamSettingsConfirm"
                    >
                      <GenerateModelConfigBlock
                        v-model:aspect-ratio="videoAspectRatio"
                        v-model:count="videoCount"
                        v-model:quality="videoQuality"
                        v-model:duration="videoDuration"
                        v-model:audio="videoAudio"
                        mode="video"
                        select-class="setting-select-inline"
                        density="scene"
                        :show-quality-3k="false"
                        :show-action="false"
                        :show-duration="videoConfigShowDuration"
                        :video-aspect-ratio-options="videoAspectRatioOptions"
                        :video-duration-options="videoDurationOptions"
                        :video-count-options="videoCountOptions"
                        :video-quality-options="videoQualityOptions"
                        :video-audio-options="videoAudioOptions"
                        :select-popup-class-name="'video-modal-select-dropdown'"
                      >
                        <template #model>
                          <ModelSelectDropdown
                            :key="`i2v-model-${imageToVideoModel}-${imageToVideoModelOptions.length}`"
                            :value="selectedImageToVideoModel"
                            :options="imageToVideoModelOptions"
                            :expanded="imageToVideoModelDropdownExpanded"
                            @toggle="imageToVideoModelDropdownExpanded = !imageToVideoModelDropdownExpanded"
                            @close="imageToVideoModelDropdownExpanded = false"
                            @select="handleSelectImageToVideoModel"
                          />
                        </template>
                      </GenerateModelConfigBlock>
                    </StoryboardGeneratePanel>
                  </div>

                  <!-- 多参生视频：场景/角色/道具/其他 + 描述框 + 右侧仅特殊拍摄手法 -->
                  <div v-else-if="leftActiveTab === 'multiParam'" class="video-left-content create-modal-tab-panel">
                    <StoryboardGeneratePanel
                      ref="multiParamPanelRef"
                      mode="imageToVideo"
                      :use-precise-layout="false"
                      :scene-file-name="scriptRowLabel"
                      icon-type="scene"
                      :show-generate-prompt-button="true"
                      :generate-prompt-loading="showGeneratingMultiParamPromptForScene"
                      v-model:prompt="multiParamPrompt"
                      :extra-prompt-assets="resolvedMultiParamPromptAssets"
                      :prompt-placeholder="'描述你想要生成的画面内容和动作,如:一个穿着红色裙子的小女孩在草地上奔跑'"
                      :scene-images="sceneImages"
                      :character-images="characterImages"
                      :prop-images="propImages"
                      :other-images="otherImages"
                      v-model:is-setting-expanded="isMultiParamSettingExpanded"
                      v-model:selected-shooting-technique="multiParamShootingTechnique"
                      v-model:active-video-setting-key="activeMultiParamSettingKey"
                      :image-to-video-nine-grid-enabled="nineGridEnabled"
                      :image-to-video-reference-images="referenceImages"
                      :image-to-video-selected-camera-movement="selectedCameraMovement"
                      :image-to-video-camera-movement-desc="cameraMovementDesc"
                      :image-to-video-selected-shooting-technique="selectedImageToVideoShootingTechnique"
                      :image-to-video-active-video-setting-key="activeImageToVideoSettingKey"
                      @open-script="openStoryboardScriptEditor"
                      @generate-prompt="handleMultiParamGeneratePrompt"
                      @import-reference="handleMultiParamImportReference"
                      @open-select-modal="openSelectAssetModal"
                      @remove-multi-param-asset-reference="removeMultiParamAssetReference"
                      @remove-other-image="removeOtherImage"
                      @preview-asset-image="previewAssetImage"
                      @copy-prompt="copyMultiParamPrompt"
                      @param-settings-confirm="applyMultiParamSettingsConfirm"
                    >
                      <GenerateModelConfigBlock
                        v-model:aspect-ratio="videoAspectRatio"
                        v-model:count="videoCount"
                        v-model:quality="videoQuality"
                        v-model:duration="videoDuration"
                        v-model:audio="videoAudio"
                        mode="video"
                        select-class="setting-select-inline"
                        density="scene"
                        :show-quality-3k="false"
                        :show-action="false"
                        :show-duration="videoConfigShowDuration"
                        :video-aspect-ratio-options="videoAspectRatioOptions"
                        :video-duration-options="videoDurationOptions"
                        :video-count-options="videoCountOptions"
                        :video-quality-options="videoQualityOptions"
                        :video-audio-options="videoAudioOptions"
                        :select-popup-class-name="'video-modal-select-dropdown'"
                      >
                        <template #model>
                          <ModelSelectDropdown
                            :key="`multi-model-${multiParamVideoModel}-${multiParamVideoModelOptions.length}`"
                            :value="selectedMultiParamVideoModel"
                            :options="multiParamVideoModelOptions"
                            :expanded="multiParamVideoModelDropdownExpanded"
                            @toggle="multiParamVideoModelDropdownExpanded = !multiParamVideoModelDropdownExpanded"
                            @close="multiParamVideoModelDropdownExpanded = false"
                            @select="handleSelectMultiParamVideoModel"
                          />
                        </template>
                      </GenerateModelConfigBlock>
                    </StoryboardGeneratePanel>
                  </div>

                  <div v-else class="video-left-content">
                    <div class="tab-placeholder">
                      <p>首尾帧视频功能开发中</p>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="leftActiveTab === 'imageToVideo' || leftActiveTab === 'multiParam'"
                class="video-config-footer"
              >
                <a-button
                  v-if="leftActiveTab === 'imageToVideo'"
                  type="primary"
                  block
                  size="large"
                  class="generate-btn"
                  :loading="showImageToVideoGenerateLoading"
                  :disabled="showImageToVideoGenerateLoading || showGeneratingVideoPromptForScene"
                  @click="handleImageToVideoStartGenerate"
                >
                  <template #icon>
                    <img src="@/assets/img/icon/star_white.svg" alt="">
                  </template>
                  开始生成视频
                </a-button>
                <a-button
                  v-else
                  type="primary"
                  block
                  size="large"
                  class="generate-btn"
                  :loading="showMultiParamGenerateLoading"
                  :disabled="showMultiParamGenerateLoading"
                  @click="handleMultiParamStartGenerate"
                >
                  <template #icon>
                    <img src="@/assets/img/icon/star_white.svg" alt="">
                  </template>
                  开始生成视频
                </a-button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <!-- 图生视频：导入参考图弹窗 -->
    <SelectAssetImageModal
      v-model:open="selectReferenceModalOpen"
      type="reference"
      :step-tab-name="referenceStepTabName"
      :step-panel-images="currentPanelStoryboardImages"
      :storyboard-script-groups="storyboardScriptAssetGroups"
      @confirm="onSelectReferenceConfirm"
    />
    <!-- 多参生视频：场景/角色/道具/其他 资产选择弹窗 -->
    <SelectAssetImageModal
      v-model:open="selectAssetModalOpen"
      :type="selectAssetModalType"
      :step-tab-name="referenceStepTabName"
      :step-panel-images="currentPanelStoryboardImages"
      :storyboard-script-groups="storyboardScriptAssetGroups"
      @confirm="onSelectAssetConfirm"
    />
    <!-- 多参生视频：导入参考图（场景/角色/道具分类选择） -->
    <SelectAssetImageModal
      v-model:open="selectMultiParamReferenceModalOpen"
      type="multiParamReference"
      :step-tab-name="referenceStepTabName"
      :step-panel-images="currentPanelStoryboardImages"
      :storyboard-script-groups="storyboardScriptAssetGroups"
      @confirm="onSelectMultiParamReferenceConfirm"
    />
    <!-- 资源库导入视频（沿用 ImportScriptModal，仅支持视频，非视频提示文件类型错误） -->
    <ImportScriptModal
      v-model:open="showVideoLibraryModal"
      title="导入视频"
      :accept-asset-type="'video'"
      @import="handleVideoLibraryImport"
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

    <StoryboardScriptModal
      :key="`sb-vid-${currentSceneIndex}-${scriptEditorKey}`"
      v-model:open="showStoryboardScriptModal"
      :panel-title="scriptModalPanelTitle"
      :initial-content="scriptContentForModal"
      @save="handleSaveScriptFromVideoModal"
      @update:title="handleScriptTitleFromVideoModal"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  UploadOutlined,
  FolderOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  VideoCameraOutlined,
  CheckOutlined,
  CheckCircleFilled,
  CaretRightOutlined,
  FullscreenOutlined,
  DownloadOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'
import {
  buildModalTaskOverlayKey,
  matchesModalTaskOverlayKey
} from '~/composables/useModalTaskScope'
import HorizontalScrollTabBar from '~/components/common/HorizontalScrollTabBar.vue'
import EllipsisTooltip from '~/components/common/EllipsisTooltip.vue'
import StoryboardGeneratePanel from './StoryboardGeneratePanel.vue'
import type { ParamSettingsConfirmPayload } from './StoryboardParamSettingsModal.vue'
import StoryboardScriptModal from './StoryboardScriptModal.vue'
import SelectAssetImageModal from './SelectAssetImageModal.vue'
import { uploadVideoToOssWithToast } from '~/utils/ossUpload'
import ImportScriptModal from './ImportScriptModal.vue'
import GenerateModelConfigBlock from './GenerateModelConfigBlock.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import {
  userStoryboardDetail,
  userStoryboardGenerateVideoPrompt,
  userStoryboardGenerateVideoPromptImage,
  userStoryboardRecordDelete,
  userStoryboardSetFinalVideo,
  userStoryboardUnSetFinalVideo,
  aidAgentList,
  userModelListByFuncCodes
} from '~/utils/businessApi'
import { fetchStoryboardRecordsForStoryboard } from '~/utils/storyboardRecordBatch'
import {
  awaitStoryboardPromptGenerateTask,
  fetchStoryboardPromptPlainWithRetry,
  readStoryboardDetailPromptField,
  resumeStoryboardPromptGenerateTask,
  resolveStoryboardImageAssetsFromPlain,
  sanitizeStoryboardPromptModelCode
} from '~/utils/storyboardPromptGenerateFlow'
import {
  STORYBOARD_GEN_CONFIG_SCENE_CODES,
  resolveStoryboardGenConfigLlmFields
} from '~/utils/projectGenConfig'
import {
  validateImageToVideoPromptPlain,
  validateMultiParamVideoPromptPlain
} from '~/utils/storyboardVideoPromptSave'
import { useModelList } from '~/composables/useModelList'
import { useVideoModelGenerateSettings } from '~/composables/useVideoModelGenerateSettings'
import {
  filterAspectRatiosForVideoModal,
  PROMPT_TYPE,
  usePromptDictionary
} from '~/composables/usePromptDictionary'
import {
  followStoryboardVideoGenerateTask,
  isStoryboardVideoTaskOngoing,
  runStoryboardImageVideoGenerateTask,
  runStoryboardMultiVideoGenerateTask
} from '~/composables/useStoryboardVideoGenerateTask'
import { isStoryboardVideoModalRestoreFollowing } from '~/composables/useStoryboardVideoBatchGenerate'
import { AI_MODEL_FUNC_CODE } from '~/utils/aiModelFuncCodes'
import { modelsFromListByFuncGroups, uniqueTrimmedCodes } from '~/utils/modelListByFuncBatch'
import {
  clearAgentDefaultModelCache,
  resolveAgentModelCodeInGroup,
  resolvePreferredModelIdFromAgentCodes,
  resolveSelectedModelOption,
  resolveStoryboardVideoPromptSubmitAgentCode,
  STORYBOARD_VIDEO_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_IMAGE_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_PROMPT_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_PROMPT_IMAGE_AGENT_BIZ_CATEGORY
} from '~/utils/extractAgentBiz'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  buildMultiParamVideoPromptParamGroups,
  buildStoryboardVideoPromptParamGroups,
  extractVideoPromptParamSelectionsFromPlain,
  plainHasVideoLabeledParamFields
} from '~/utils/storyboardPromptParamRef'
import type { StoryboardRecordRow } from '~/types/business-api'
import {
  findPendingStoryboardRecordTaskId,
  isPendingStoryboardRecord
} from '~/utils/storyboardRecordPending'
import type { StoryboardPanel } from '~/types'
import {
  storyboardPromptHtmlToPlain,
  storyboardPromptPlainToHtml,
  storyboardPromptMarkdownPlainToHtml,
  collectStoryboardPromptAssets,
  patchEmptyResolvedPromptAssets,
  mergePromptAssets,
  buildStoryboardVideoReferenceOverrides,
  listUnresolvedPromptImagePlaceholders,
  type PromptAssetItem
} from '~/utils/storyboardPromptAssetRef'
import { scriptApiTextToEditorHtml, looksLikeMarkdown } from '~/utils/htmlPlain'
import deleteIcon from '@/assets/img/home/delete-white.svg'

interface Props {
  open: boolean
  sceneIndex: number
  scenes: Array<{
    name: string
    videos?: any[]
    scriptContent?: string
    scriptPanelTitle?: string
    storyboardId?: number | string
    /** 第四步对应分镜图，用于导入弹窗第二 Tab */
    storyboardImages?: any[]
  }>
  /** 弹窗实例作用域，配合 storyboardId 隔离生视频 loading */
  editorScopeKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  editorScopeKey: 'storyboard-video'
})
const emit = defineEmits<{
  'update:open': [value: boolean]
  'jump-to-storyboard-script': [sceneIndex: number]
  update: [
    sceneIndex: number,
    data: { name?: string; videos?: any[]; scriptContent?: string; scriptTitle?: string }
  ]
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const creationStore = useCreationStore()
const route = useRoute()

const currentSceneIndex = ref(props.sceneIndex)

function resolveStoryboardIdForSceneIndex(sceneIdx: number): string {
  const raw = props.scenes[sceneIdx]?.storyboardId
  const id = Number(raw)
  if (Number.isFinite(id) && id > 0) return String(id)
  return `idx-${sceneIdx}`
}

function overlayKeyParts(sceneIdx: number, taskKind: string) {
  return {
    editorScopeKey: props.editorScopeKey,
    sceneIdx,
    entityId: resolveStoryboardIdForSceneIndex(sceneIdx),
    itemIdx: -1,
    taskKind
  }
}

const videoGenerateTargetKey = ref('')
let resumeStoryboardVideoFollowGen = 0
const activeStoryboardVideoFollowStoryboardIds = new Set<number>()
/** 提示词 SSE 跟进中的 taskId / 分镜，避免 restore 在 SSE 期间打 task/detail */
const activeStoryboardPromptFollowTaskIds = new Set<number>()
const activeStoryboardPromptFollowStoryboardIds = new Set<number>()

const showImageToVideoGenerateLoading = computed(() =>
  matchesModalTaskOverlayKey(
    videoGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, 'i2v')
  )
)
const showMultiParamGenerateLoading = computed(() =>
  matchesModalTaskOverlayKey(
    videoGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, 'multi')
  )
)

const videoGenerateProgressText = ref('分镜视频提交中…')

const showVideoGenerateCanvasOverlay = computed(
  () => showImageToVideoGenerateLoading.value || showMultiParamGenerateLoading.value
)

function isSceneVideoGenerating(sceneIdx: number): boolean {
  if (
    matchesModalTaskOverlayKey(
      videoGenerateTargetKey.value,
      overlayKeyParts(sceneIdx, 'i2v')
    ) ||
    matchesModalTaskOverlayKey(
      videoGenerateTargetKey.value,
      overlayKeyParts(sceneIdx, 'multi')
    )
  ) {
    return true
  }
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (Number.isFinite(storyboardId) && storyboardId > 0) {
    if (
      activeStoryboardVideoFollowStoryboardIds.has(storyboardId) ||
      isStoryboardVideoModalRestoreFollowing(storyboardId)
    ) {
      return true
    }
  }
  const videos = props.scenes[sceneIdx]?.videos || []
  return videos.some((v: { _generating?: boolean }) => !!v._generating)
}

function shouldKeepStoryboardVideoStepLoading(): boolean {
  if (activeStoryboardVideoFollowStoryboardIds.size > 0) return true
  const scopeKey = creationStore.step3GenVisualScopeKey()
  const blob = creationStore.step4PlusLiveGenByScope[scopeKey]
  return Object.keys(blob?.storyboardVideoGenTasksByStoryboardId || {}).length > 0
}

const videoGenerateOverlayLabel = computed(() => videoGenerateProgressText.value)

const viewMode = ref<'list' | 'card'>('list')
const leftActiveTab = ref<'imageToVideo' | 'multiParam' | 'startEndFrame'>('imageToVideo')

const leftPanelLoading = ref(false)
const rightPanelLoading = ref(false)
const TAB_SWITCH_SKELETON_MS = 380

const currentSceneName = computed(
  () => props.scenes[currentSceneIndex.value]?.name || '分镜脚本1: 未命名'
)

const scriptPanels = computed(
  () => (creationStore.formData.storyboardScript.panels || []) as StoryboardPanel[]
)

function resolveScriptPanelForSceneIndex(sceneIdx: number): StoryboardPanel | undefined {
  const scene = props.scenes[sceneIdx]
  const sid = Number(scene?.storyboardId)
  if (Number.isFinite(sid) && sid > 0) {
    const hit = scriptPanels.value.find((p) => Number(p.id) === sid)
    if (hit) return hit
  }
  return scriptPanels.value[sceneIdx]
}

function cleanStoryboardScriptTabLabel(raw: string, fallbackIndex: number): string {
  const t = String(raw || '').trim()
  const cleaned = t
    .replace(/^分镜视频\d+[：:]\s*/i, '')
    .replace(/[:：]\s*分镜生成中\s*$/u, '')
    .replace(/\s*分镜生成中\s*$/u, '')
    .trim()
  return cleaned || `分镜脚本${fallbackIndex + 1}`
}

/** 参考图弹窗第二 Tab：用分镜脚本标题，避免沿用视频面板的「分镜生成中」 */
const referenceStepTabName = computed(() => {
  const sp = resolveScriptPanelForSceneIndex(currentSceneIndex.value)
  return cleanStoryboardScriptTabLabel(sp?.title || scriptRowLabel.value, currentSceneIndex.value)
})

const currentStoryboardId = computed<number | null>(() => {
  const raw = props.scenes[currentSceneIndex.value]?.storyboardId
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
})

const scriptRowLabel = computed(() => {
  const s = props.scenes[currentSceneIndex.value] as
    | { scriptPanelTitle?: string; name?: string }
    | undefined
  return s?.scriptPanelTitle || s?.name || '分镜脚本'
})

const scriptModalPanelTitle = computed(() => scriptRowLabel.value)

/** 图生视频 Tab：与分镜脚本同一头部组件，标题标明分镜视频 */
const storyboardVideoHeaderLabel = computed(() => {
  const base = scriptRowLabel.value?.trim() || '未命名'
  return `【分镜视频】${base}`
})

const scriptContentForModal = computed(
  () =>
    (props.scenes[currentSceneIndex.value] as { scriptContent?: string } | undefined)
      ?.scriptContent ?? ''
)

const showStoryboardScriptModal = ref(false)
const scriptEditorKey = ref(0)

function openStoryboardScriptEditor() {
  // 分镜视频内点击脚本标题：关闭当前弹窗并跳转第 4 步分镜脚本列表
  showStoryboardScriptModal.value = false
  modalOpen.value = false
  emit('jump-to-storyboard-script', currentSceneIndex.value)
}

function handleSaveScriptFromVideoModal(payload: { title: string; content: string }) {
  const content = payload?.content ?? ''
  const title = payload?.title ?? ''
  emit('update', currentSceneIndex.value, {
    scriptContent: content,
    ...(title.trim() ? { title } : {})
  })
  showStoryboardScriptModal.value = false
  message.success('分镜脚本已同步到分镜脚本步骤')
}

function handleScriptTitleFromVideoModal(title: string) {
  const t = title?.trim()
  if (!t) return
  emit('update', currentSceneIndex.value, { scriptTitle: t })
}
const currentSceneVideos = computed(() => {
  const list = props.scenes[currentSceneIndex.value]?.videos || []
  return [...list]
})

function mapRecordRowToImageItem(r: StoryboardRecordRow): any {
  const url = (r.fileUrl || '').trim()
  return {
    id: String(r.id ?? ''),
    url,
    thumbnail: url,
    title: '分镜图',
    source: '生成记录',
    importDate: r.createTime || undefined,
    _fromServer: true,
    _serverRow: r
  }
}

function localStoryboardImagesForScene(sceneIdx: number): any[] {
  const sp = resolveScriptPanelForSceneIndex(sceneIdx)
  const raw = sp?.images || props.scenes[sceneIdx]?.storyboardImages || []
  if (!Array.isArray(raw)) return []
  return raw.filter((img) => String(img?.url || img?.thumbnail || '').trim())
}

const stepPanelImagesCache = ref<Record<number, any[]>>({})
const selectReferenceModalOpen = ref(false)

async function refreshStepPanelImagesForReference(sceneIdx = currentSceneIndex.value) {
  const local = localStoryboardImagesForScene(sceneIdx)
  if (local.length) {
    stepPanelImagesCache.value = { ...stepPanelImagesCache.value, [sceneIdx]: local }
    return
  }
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) {
    stepPanelImagesCache.value = { ...stepPanelImagesCache.value, [sceneIdx]: [] }
    return
  }
  try {
    const rows = await fetchProjectRecordsForStoryboard(storyboardId, 'image')
    const mapped = rows
      .filter((r) => String(r?.fileUrl ?? '').trim())
      .map(mapRecordRowToImageItem)
    stepPanelImagesCache.value = { ...stepPanelImagesCache.value, [sceneIdx]: mapped }
  } catch {
    stepPanelImagesCache.value = { ...stepPanelImagesCache.value, [sceneIdx]: [] }
  }
}

function mapRecordRowToVideoItem(r: StoryboardRecordRow): any {
  const url = (r.fileUrl || '').trim()
  const label = '分镜视频'
  return {
    id: String(r.id ?? ''),
    url,
    title: label,
    source: '生成记录',
    importDate: r.createTime || undefined,
    isStoryboardVideo: r.isSelected === 1,
    _generating: isPendingStoryboardRecord(r),
    _fromServer: true,
    _serverRow: r
  }
}

async function fetchProjectRecordsForStoryboard(
  storyboardId: number,
  type: 'image' | 'video'
): Promise<StoryboardRecordRow[]> {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return []
  return fetchStoryboardRecordsForStoryboard(ctx, storyboardId, type)
}

async function refreshVideoRecords(sceneIdx: number) {
  const raw = props.scenes[sceneIdx]?.storyboardId
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const rows = await fetchProjectRecordsForStoryboard(id, 'video')
    const mapped = rows
      .filter((r) => !!String(r?.fileUrl ?? '').trim() || isPendingStoryboardRecord(r))
      .map(mapRecordRowToVideoItem)
    emit('update', sceneIdx, { videos: mapped })

    const pendingIdx = mapped.findIndex((m) => m._generating)
    if (pendingIdx >= 0 && sceneIdx === currentSceneIndex.value) {
      selectedVideoIdx.value = pendingIdx
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '获取生成记录失败')
  }
}

async function runStoryboardVideoGenerateForScene(
  sceneIdx: number,
  opts: {
    taskKind: 'i2v' | 'multi'
    submitImageVideoBody?: Parameters<typeof runStoryboardImageVideoGenerateTask>[0]['body']
    submitMultiBody?: Parameters<typeof runStoryboardMultiVideoGenerateTask>[0]['body']
    resumeTaskId?: number
    progressSubmit?: string
    progressRunning?: string
    silentComplete?: boolean
  }
) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return

  videoGenerateTargetKey.value = buildModalTaskOverlayKey(
    overlayKeyParts(sceneIdx, opts.taskKind)
  )
  videoGenerateProgressText.value = opts.progressSubmit || '分镜视频提交中…'

  const onProgress = (p: { stepTitle?: string; message?: string }) => {
    videoGenerateProgressText.value =
      p.stepTitle || p.message || opts.progressRunning || '分镜视频生成中…'
  }

  const overlayParts = overlayKeyParts(sceneIdx, opts.taskKind)
  activeStoryboardVideoFollowStoryboardIds.add(storyboardId)
  creationStore.setGeneratingStoryboardVideo(true)

  try {
    let result:
      | Awaited<ReturnType<typeof runStoryboardImageVideoGenerateTask>>
      | Awaited<ReturnType<typeof runStoryboardMultiVideoGenerateTask>>

    if (opts.resumeTaskId) {
      videoGenerateProgressText.value = opts.progressRunning || '分镜视频生成中…'
      result = await followStoryboardVideoGenerateTask({
        taskId: opts.resumeTaskId,
        onProgress
      })
    } else if (opts.taskKind === 'i2v' && opts.submitImageVideoBody) {
      result = await runStoryboardImageVideoGenerateTask({
        body: opts.submitImageVideoBody,
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardVideoGenTask(storyboardId, {
            taskId,
            sceneIdx,
            taskKind: 'i2v'
          })
        },
        onProgress: (p) => {
          videoGenerateProgressText.value = opts.progressRunning || '图生视频生成中…'
          onProgress(p)
        }
      })
    } else if (opts.taskKind === 'multi' && opts.submitMultiBody) {
      result = await runStoryboardMultiVideoGenerateTask({
        body: opts.submitMultiBody,
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardVideoGenTask(storyboardId, {
            taskId,
            sceneIdx,
            taskKind: 'multi'
          })
        },
        onProgress: (p) => {
          videoGenerateProgressText.value = opts.progressRunning || '多参视频生成中…'
          onProgress(p)
        }
      })
    } else {
      return
    }

    if (!result.ok) {
      if (!opts.silentComplete) {
        message.error('errorMessage' in result ? result.errorMessage || '视频生成失败' : '视频生成失败')
      }
      creationStore.clearStoryboardVideoGenTask(storyboardId)
      return
    }

    await refreshVideoRecords(sceneIdx)
    if (!opts.silentComplete) {
      message.success('视频生成完成')
    }
    creationStore.clearStoryboardVideoGenTask(storyboardId)
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  } catch (e: unknown) {
    if (!opts.silentComplete) {
      message.error(storyboardVideoBizErr(e))
    }
    creationStore.clearStoryboardVideoGenTask(storyboardId)
  } finally {
    activeStoryboardVideoFollowStoryboardIds.delete(storyboardId)
    if (!shouldKeepStoryboardVideoStepLoading()) {
      creationStore.setGeneratingStoryboardVideo(false)
    }
    if (
      videoGenerateTargetKey.value === buildModalTaskOverlayKey(overlayParts)
    ) {
      clearVideoGenerateOverlayForScene(sceneIdx, opts.taskKind)
    }
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  }
}

function clearVideoGenerateOverlayForScene(sceneIdx: number, taskKind?: 'i2v' | 'multi') {
  const kinds = taskKind ? [taskKind] : (['i2v', 'multi'] as const)
  for (const k of kinds) {
    if (
      matchesModalTaskOverlayKey(
        videoGenerateTargetKey.value,
        overlayKeyParts(sceneIdx, k)
      )
    ) {
      videoGenerateTargetKey.value = ''
      videoGenerateProgressText.value = '分镜视频提交中…'
      return
    }
  }
}

async function waitForStoryboardVideoModalRestore(
  storyboardId: number,
  gen: number
): Promise<boolean> {
  if (!import.meta.client) return false
  while (isStoryboardVideoModalRestoreFollowing(storyboardId)) {
    if (gen !== resumeStoryboardVideoFollowGen) return false
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return gen === resumeStoryboardVideoFollowGen
}

async function syncStoryboardVideoGenerateUiAfterSettled(sceneIdx: number) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return
  if (
    activeStoryboardVideoFollowStoryboardIds.has(storyboardId) ||
    isStoryboardVideoModalRestoreFollowing(storyboardId)
  ) {
    return
  }

  const persisted = creationStore.getStoryboardVideoGenTask(storyboardId)
  if (persisted?.taskId) {
    const ongoing = await isStoryboardVideoTaskOngoing(persisted.taskId)
    if (ongoing) return
    creationStore.clearStoryboardVideoGenTask(storyboardId)
  }

  clearVideoGenerateOverlayForScene(sceneIdx, persisted?.taskKind)
  if (!shouldSkipStoryboardVideoRestore(storyboardId)) {
    await refreshVideoRecords(sceneIdx)
  }
}

function handleStoryboardVideoGenSettledEvent(event: Event) {
  if (!props.open) return
  const detail = (event as CustomEvent<{ storyboardId?: number }>).detail
  const sid = Number(detail?.storyboardId)
  const sceneIdx = props.scenes.findIndex((s) => Number(s?.storyboardId) === sid)
  if (sceneIdx < 0) return
  void syncStoryboardVideoGenerateUiAfterSettled(sceneIdx)
}

function handleGlobalTasksUpdatedForVideoModal() {
  if (!props.open) return
  void syncStoryboardVideoGenerateUiAfterSettled(currentSceneIndex.value)
}

function shouldSkipStoryboardVideoRestore(storyboardId: number, taskId?: number | null): boolean {
  const sceneIdx = props.scenes.findIndex(
    (s) => Number(s?.storyboardId) === storyboardId
  )
  if (sceneIdx >= 0 && isStoryboardVideoPromptGeneratingForScene(sceneIdx)) return true
  if (activeStoryboardPromptFollowStoryboardIds.has(storyboardId)) return true
  const tid = Number(taskId)
  if (Number.isFinite(tid) && tid > 0 && activeStoryboardPromptFollowTaskIds.has(tid)) return true
  return false
}

async function restoreStoryboardVideoGenerateIfNeeded(sceneIdx: number) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return
  if (shouldSkipStoryboardVideoRestore(storyboardId)) return

  const gen = resumeStoryboardVideoFollowGen

  let rows: StoryboardRecordRow[] = []
  try {
    rows = await fetchProjectRecordsForStoryboard(storyboardId, 'video')
    if (gen !== resumeStoryboardVideoFollowGen) return
    if (shouldSkipStoryboardVideoRestore(storyboardId)) return

    const mapped = rows
      .filter((r) => !!String(r?.fileUrl ?? '').trim() || isPendingStoryboardRecord(r))
      .map(mapRecordRowToVideoItem)
    emit('update', sceneIdx, { videos: mapped })
    const pendingIdx = mapped.findIndex((m) => m._generating)
    if (pendingIdx >= 0 && sceneIdx === currentSceneIndex.value) {
      selectedVideoIdx.value = pendingIdx
    }
  } catch {
    /* ignore */
  }

  if (gen !== resumeStoryboardVideoFollowGen) return
  if (shouldSkipStoryboardVideoRestore(storyboardId)) return

  const persisted = creationStore.getStoryboardVideoGenTask(storyboardId)
  const taskId = findPendingStoryboardRecordTaskId(rows) ?? persisted?.taskId ?? null
  const taskKind = persisted?.taskKind ?? 'i2v'

  if (!taskId || activeStoryboardVideoFollowStoryboardIds.has(storyboardId)) return
  if (shouldSkipStoryboardVideoRestore(storyboardId, taskId)) return

  if (isStoryboardVideoModalRestoreFollowing(storyboardId)) {
    videoGenerateTargetKey.value = buildModalTaskOverlayKey(
      overlayKeyParts(sceneIdx, taskKind)
    )
    videoGenerateProgressText.value =
      taskKind === 'multi' ? '多参视频生成中…' : '图生视频生成中…'

    const settled = await waitForStoryboardVideoModalRestore(storyboardId, gen)
    if (!settled) return

    clearVideoGenerateOverlayForScene(sceneIdx, taskKind)
    if (!shouldSkipStoryboardVideoRestore(storyboardId)) {
      await refreshVideoRecords(sceneIdx)
    }
    return
  }

  const ongoing = await isStoryboardVideoTaskOngoing(taskId)
  if (gen !== resumeStoryboardVideoFollowGen) return
  if (shouldSkipStoryboardVideoRestore(storyboardId, taskId)) return

  if (!ongoing) {
    creationStore.clearStoryboardVideoGenTask(storyboardId)
    clearVideoGenerateOverlayForScene(sceneIdx, taskKind)
    if (!shouldSkipStoryboardVideoRestore(storyboardId)) {
      await refreshVideoRecords(sceneIdx)
    }
    return
  }

  await runStoryboardVideoGenerateForScene(sceneIdx, {
    taskKind,
    resumeTaskId: taskId,
    progressRunning: taskKind === 'multi' ? '多参视频生成中…' : '图生视频生成中…',
    silentComplete: true
  })
}

/** 左侧「生成记录」当前选中项（高亮缩略图） */
const selectedVideoIdx = ref(0)
watch(
  currentSceneVideos,
  (list) => {
    if (!list.length) {
      selectedVideoIdx.value = 0
      return
    }
    if (selectedVideoIdx.value >= list.length) {
      selectedVideoIdx.value = list.length - 1
    }
  },
  { deep: true }
)

/** 当前分镜视频对应分镜脚本的分镜图（第二 Tab，按分镜一一对应） */
const currentPanelStoryboardImages = computed(() => {
  const idx = currentSceneIndex.value
  const cached = stepPanelImagesCache.value[idx]
  if (cached?.length) return cached
  return localStoryboardImagesForScene(idx)
})

/** 各分镜脚本的分镜图，供「选择分镜画面」本作品资产 Tab */
const storyboardScriptAssetGroups = computed(() =>
  scriptPanels.value
    .map((panel, idx) => {
      const images = (Array.isArray(panel.images) ? panel.images : [])
        .filter((img) => String(img?.url || img?.thumbnail || '').trim())
        .map((img, j) => ({
          ...img,
          id: img.id || `sb-ref-${idx}-${j}-${img.url || img.thumbnail || j}`
        }))
      const shortName = cleanStoryboardScriptTabLabel(panel.title, idx).replace(
        /^分镜脚本\d+[：:]\s*/i,
        ''
      )
      return {
        label: `分镜脚本${idx + 1}: ${shortName || '未命名'}`,
        images
      }
    })
    .filter((g) => g.images.length > 0)
)

watch(selectReferenceModalOpen, (open) => {
  if (open) void refreshStepPanelImagesForReference()
})

watch(currentSceneIndex, () => {
  pauseAllVideoPreviews()
  playingVideoIdx.value = -1
  videoPreviewRefs.clear()
  if (selectReferenceModalOpen.value) void refreshStepPanelImagesForReference()
})

watch(
  () => scriptPanels.value.map((p) => p.images),
  () => {
    stepPanelImagesCache.value = {}
    if (selectReferenceModalOpen.value) {
      void refreshStepPanelImagesForReference()
    }
  },
  { deep: true }
)

// ---------- 图生视频 tab：九宫格 + 参考图 + 镜头运动 + 特殊拍摄手法 ----------
const imageToVideoPrompt = ref('')
const resolvedVideoPromptAssets = ref<PromptAssetItem[]>([])
const isGeneratingVideoPrompt = ref(false)
const isSavingVideoPrompt = ref(false)
const videoPromptGenerateTargetKey = ref('')
const imageToVideoPromptPlain = computed(() => storyboardPromptHtmlToPlain(imageToVideoPrompt.value))

const showGeneratingVideoPromptForScene = computed(() =>
  matchesModalTaskOverlayKey(
    videoPromptGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, 'video-prompt-gen')
  )
)

const videoPromptParamGroups = computed(() =>
  buildStoryboardVideoPromptParamGroups({
    cameraMovement: cameraMovementOptions.value,
    shootingTechnique: shootingTechniqueOptions.value
  })
)

function applyVideoParamSelectionsFromPlain(plain: string) {
  const selections = extractVideoPromptParamSelectionsFromPlain(plain, videoPromptParamGroups.value)
  selectedCameraMovement.value = selections[PROMPT_TYPE.camera_movement] ?? null
  selectedImageToVideoShootingTechnique.value = selections[PROMPT_TYPE.shooting_technique] ?? null
}

function renderStoryboardVideoPromptApiTextToEditor(
  plain: string,
  options?: {
    assets?: PromptAssetItem[]
    paramGroups?: ReturnType<typeof buildStoryboardVideoPromptParamGroups>
    enableAssetRefs?: boolean
    /** 多参生视频：解析 # 标题 / 列表等 Markdown */
    enableMarkdown?: boolean
  }
): string {
  const text = String(plain || '').trim()
  if (!text) return ''
  if (options?.enableMarkdown || options?.enableAssetRefs) {
    if (
      options.enableAssetRefs &&
      (text.includes('@') || looksLikeMarkdown(text) || plainHasVideoLabeledParamFields(text))
    ) {
      return storyboardPromptMarkdownPlainToHtml(text, options.assets ?? [], options.paramGroups ?? [], {
        enableVideoLabeledParams: true,
        enableAssetRefs: true
      })
    }
    if (options.enableMarkdown && looksLikeMarkdown(text)) {
      return scriptApiTextToEditorHtml(text)
    }
  }
  if (options?.enableAssetRefs && text.includes('@')) {
    return storyboardPromptPlainToHtml(text, options.assets ?? [], options.paramGroups ?? [], {
      enableVideoLabeledParams: true,
      enableAssetRefs: true
    })
  }
  return scriptApiTextToEditorHtml(text)
}

async function applyVideoPromptFromApi(plain: string) {
  const text = String(plain || '').trim()
  if (!text) {
    resolvedVideoPromptAssets.value = []
    imageToVideoPrompt.value = ''
    return
  }

  await ensureDictLoaded()
  applyVideoParamSelectionsFromPlain(text)
  resolvedVideoPromptAssets.value = []
  imageToVideoPrompt.value = renderStoryboardVideoPromptApiTextToEditor(text)
}

async function fetchStoryboardImageToVideoPrompt(storyboardId: number): Promise<string> {
  const row = await userStoryboardDetail({ id: storyboardId })
  return readStoryboardDetailPromptField(row, 'videoPromptImage')
}

async function fetchStoryboardMultiVideoPrompt(storyboardId: number): Promise<string> {
  const row = await userStoryboardDetail({ id: storyboardId })
  return readStoryboardDetailPromptField(row, 'videoPrompt')
}

async function fetchStoryboardImageToVideoPromptAfterGenerate(storyboardId: number): Promise<string> {
  return fetchStoryboardPromptPlainWithRetry(storyboardId, 'videoPromptImage')
}

async function fetchStoryboardMultiVideoPromptAfterGenerate(storyboardId: number): Promise<string> {
  return fetchStoryboardPromptPlainWithRetry(storyboardId, 'videoPrompt')
}

function resolveImageVideoPromptAgentCode(): string {
  return resolveStoryboardVideoPromptSubmitAgentCode(
    'video_prompt_image',
    creationStore.storyboardVideoGenerateSettings.agentId
  )
}

function resolveMultiVideoPromptAgentCode(): string {
  return resolveStoryboardVideoPromptSubmitAgentCode(
    'video_prompt',
    creationStore.storyboardVideoGenerateSettings.agentId
  )
}

function resolveVideoPromptModelCode(): string {
  return sanitizeStoryboardPromptModelCode(
    creationStore.storyboardVideoGenerateSettings.videoPromptModelCode
  )
}

/** 图生视频提示词：手动「生成设置」优先，否则读项目生成配置 */
async function resolveImageVideoPromptSubmitFields() {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  const manualAgent = resolveImageVideoPromptAgentCode()
  const manualModel = resolveVideoPromptModelCode()
  const manualPick = Boolean(manualAgent || manualModel)
  return resolveStoryboardGenConfigLlmFields(
    ctx?.projectId ?? null,
    STORYBOARD_GEN_CONFIG_SCENE_CODES.videoPromptImage,
    manualPick,
    manualAgent,
    manualModel
  )
}

/** 多参视频提示词：手动「生成设置」优先，否则读项目生成配置 */
async function resolveMultiVideoPromptSubmitFields() {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  const manualAgent = resolveMultiVideoPromptAgentCode()
  const manualModel = resolveVideoPromptModelCode()
  const manualPick = Boolean(manualAgent || manualModel)
  return resolveStoryboardGenConfigLlmFields(
    ctx?.projectId ?? null,
    STORYBOARD_GEN_CONFIG_SCENE_CODES.videoPrompt,
    manualPick,
    manualAgent,
    manualModel
  )
}
const multiParamPromptParamGroups = computed(() =>
  buildMultiParamVideoPromptParamGroups({
    cameraMovement: cameraMovementOptions.value,
    shootingTechnique: shootingTechniqueOptions.value
  })
)

const multiParamPrompt = ref('')
const multiParamPromptPlain = computed(() => storyboardPromptHtmlToPlain(multiParamPrompt.value))
const resolvedMultiParamPromptAssets = ref<PromptAssetItem[]>([])
const isGeneratingMultiParamPrompt = ref(false)
const multiParamPromptGenerateTargetKey = ref('')

const showGeneratingMultiParamPromptForScene = computed(() =>
  matchesModalTaskOverlayKey(
    multiParamPromptGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, 'multi-video-prompt-gen')
  )
)

function isStoryboardVideoPromptGeneratingForScene(sceneIdx = currentSceneIndex.value): boolean {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (Number.isFinite(storyboardId) && storyboardId > 0) {
    if (activeStoryboardPromptFollowStoryboardIds.has(storyboardId)) return true
  }
  return (
    matchesModalTaskOverlayKey(
      videoPromptGenerateTargetKey.value,
      overlayKeyParts(sceneIdx, 'video-prompt-gen')
    ) ||
    matchesModalTaskOverlayKey(
      multiParamPromptGenerateTargetKey.value,
      overlayKeyParts(sceneIdx, 'multi-video-prompt-gen')
    )
  )
}

async function runStoryboardVideoPromptGenerateFlow(opts: {
  sceneIdx: number
  taskKind: 'video-prompt-gen' | 'multi-video-prompt-gen'
  loadingMessage: string
  successMessage: string
  isGenerating: { value: boolean }
  targetKey: { value: string }
  submit: (ctx: { projectId: number; episodeId: number }, storyboardId: number) => Promise<{
    taskId?: number
  }>
  fetchPromptAfterGenerate: (storyboardId: number) => Promise<string>
  applyPrompt: (plain: string) => Promise<void>
}) {
  if (isStoryboardVideoPromptGeneratingForScene(opts.sceneIdx)) return

  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜ID缺失，无法生成提示词')
    return
  }

  opts.targetKey.value = buildModalTaskOverlayKey(
    overlayKeyParts(opts.sceneIdx, opts.taskKind)
  )
  opts.isGenerating.value = true
  activeStoryboardPromptFollowStoryboardIds.add(storyboardId)
  resumeStoryboardVideoFollowGen++
  const hideLoading = message.loading(opts.loadingMessage, 0)
  let followedTaskId: number | null = null

  try {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      message.warning('缺少项目信息，请从「我的作品」打开作品后再操作')
      return
    }

    const submitted = await opts.submit(ctx, storyboardId)
    const taskId = Number(submitted.taskId)
    if (!Number.isFinite(taskId) || taskId <= 0) {
      message.error('提交失败：未返回任务ID')
      return
    }

    followedTaskId = taskId
    activeStoryboardPromptFollowTaskIds.add(taskId)

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
        taskOutcome = await resumeStoryboardPromptGenerateTask(taskId, 'video')
        if (taskOutcome.ok === false) {
          message.error(taskOutcome.errorMessage)
          return
        }
        if (taskOutcome.ok && 'partial' in taskOutcome && taskOutcome.partial) {
          message.warning(taskOutcome.partialWarning)
        }
      }
    }

    const prompt = await opts.fetchPromptAfterGenerate(storyboardId)
    if (!prompt) {
      message.warning('生成完成，但未获取到视频提示词内容')
      return
    }

    await opts.applyPrompt(prompt)
    message.success(opts.successMessage)
  } catch (e: unknown) {
    message.error(storyboardVideoBizErr(e))
  } finally {
    if (followedTaskId != null) {
      activeStoryboardPromptFollowTaskIds.delete(followedTaskId)
    }
    activeStoryboardPromptFollowStoryboardIds.delete(storyboardId)
    resumeStoryboardVideoFollowGen++
    hideLoading()
    opts.isGenerating.value = false
    opts.targetKey.value = ''
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  }
}

async function applyMultiParamPromptFromApi(plain: string) {
  const text = String(plain || '').trim()
  if (!text) {
    resolvedMultiParamPromptAssets.value = []
    multiParamPrompt.value = ''
    return
  }

  await ensureDictLoaded()

  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  const imageResolve = await resolveStoryboardImageAssetsFromPlain(text, ctx)
  resolvedMultiParamPromptAssets.value = imageResolve.resolvedAssets
  if (imageResolve.unresolvedNames.length) {
    message.warning(`部分参考图未匹配：${imageResolve.unresolvedNames.join('、')}`)
  }

  const selections = extractVideoPromptParamSelectionsFromPlain(text, multiParamPromptParamGroups.value)
  selectedCameraMovement.value = selections[PROMPT_TYPE.camera_movement] ?? null
  multiParamShootingTechnique.value = selections[PROMPT_TYPE.shooting_technique] ?? null

  multiParamPrompt.value = renderStoryboardVideoPromptApiTextToEditor(text, {
    assets: resolvedMultiParamPromptAssets.value,
    paramGroups: multiParamPromptParamGroups.value,
    enableAssetRefs: true,
    enableMarkdown: true
  })
}

const referenceImages = ref<
  Array<{ id?: string; url?: string; thumbnail?: string; title?: string; name?: string }>
>([])
const referenceImage = computed({
  get: () => {
    const first = referenceImages.value[0]
    return first ?? null
  },
  set: (v) => {
    if (!v) {
      referenceImages.value = []
      return
    }
    if (referenceImages.value.length === 0) {
      referenceImages.value = [v]
    } else {
      referenceImages.value = [v, ...referenceImages.value.slice(1)]
    }
  }
})
const nineGridEnabled = ref(false)
const isImageToVideoSettingExpanded = ref(true)
type ImageToVideoSettingKey = 'cameraMovement' | 'shootingTechnique'
const activeImageToVideoSettingKey = ref<ImageToVideoSettingKey | null>(null)
const selectedCameraMovement = ref<{ key: string; value: string } | null>(null)
const cameraMovementDesc = ref('')
const selectedImageToVideoShootingTechnique = ref<{ key: string; value: string } | null>(null)

// ---------- 多参生视频 tab：场景/角色/道具/其他 + 仅特殊拍摄手法 ----------
const isMultiParamSettingExpanded = ref(true)
const activeMultiParamSettingKey = ref<string | null>(null)
const multiParamShootingTechnique = ref<{ key: string; value: string } | null>(null)

const sceneImages = ref<any[]>([])
const imageToVideoPanelRef = ref<InstanceType<typeof StoryboardGeneratePanel> | null>(null)
const multiParamPanelRef = ref<InstanceType<typeof StoryboardGeneratePanel> | null>(null)

function getActiveStoryboardPanel() {
  if (leftActiveTab.value === 'imageToVideo') return imageToVideoPanelRef.value
  if (leftActiveTab.value === 'multiParam') return multiParamPanelRef.value
  return null
}
const characterImages = ref<any[]>([])
const propImages = ref<any[]>([])
const otherImages = ref<any[]>([])
const selectAssetModalOpen = ref(false)
const selectMultiParamReferenceModalOpen = ref(false)
const selectAssetModalType = ref<
  'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other'
>('scene')
const showMaterialFromLibraryModal = ref(false)
const materialLibraryCategoryKey = ref<string>('pose')

const { ensureLoaded: ensureDictLoaded, aspectRatioEnumOptions, cameraMovementOptions, shootingTechniqueOptions } =
  usePromptDictionary()

const aspectRatioLabelsForVideo = computed(() =>
  filterAspectRatiosForVideoModal(aspectRatioEnumOptions.value)
)

const imageToVideoModel = ref('')
const multiParamVideoModel = ref('')
const imageToVideoModelDropdownExpanded = ref(false)
const multiParamVideoModelDropdownExpanded = ref(false)
let initVideoModelGen = 0
const cachedImageToVideoAgentModelCodes = ref<string[]>([])
const cachedMultiParamAgentModelCodes = ref<string[]>([])

const activeVideoModel = computed({
  get: () => (leftActiveTab.value === 'multiParam' ? multiParamVideoModel.value : imageToVideoModel.value),
  set: (v: string) => {
    if (leftActiveTab.value === 'multiParam') multiParamVideoModel.value = v
    else imageToVideoModel.value = v
  }
})

const mapVideoModelOption = (item: {
  id?: number
  modelCode?: string | null
  modelName?: string | null
  providerName?: string | null
}): ModelOption => {
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
  modelList: imageToVideoModelOptions,
  rawModelList: imageToVideoRawModelList,
  loadModels: loadImageToVideoModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_IMAGE,
  modelType: 'video',
  fallback: [],
  keepFallbackOnEmpty: false,
  mapItem: mapVideoModelOption,
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载图生视频模型失败')
  }
})

const {
  modelList: multiParamVideoModelOptions,
  rawModelList: multiParamRawModelList,
  loadModels: loadMultiParamVideoModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO,
  modelType: 'video',
  fallback: [],
  keepFallbackOnEmpty: false,
  mapItem: mapVideoModelOption,
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载多参生视频模型失败')
  }
})

const videoRawModelList = computed(() =>
  leftActiveTab.value === 'multiParam' ? multiParamRawModelList.value : imageToVideoRawModelList.value
)

const selectedImageToVideoModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(imageToVideoModelOptions.value, imageToVideoModel.value)
)

const selectedMultiParamVideoModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(multiParamVideoModelOptions.value, multiParamVideoModel.value)
)

function handleSelectImageToVideoModel(model: ModelOption) {
  imageToVideoModel.value = model.id
  imageToVideoModelDropdownExpanded.value = false
  syncVideoSettingsToModel()
}

function handleSelectMultiParamVideoModel(model: ModelOption) {
  multiParamVideoModel.value = model.id
  multiParamVideoModelDropdownExpanded.value = false
  syncVideoSettingsToModel()
}

const videoAspectRatio = ref('16:9')
const videoDuration = ref('5')
const videoCount = ref(1)
const videoQuality = ref('1080p')
const videoAudio = ref('silent')

const videoSettingsForCapability = computed({
  get: () => ({
    aspectRatio: videoAspectRatio.value,
    count: videoCount.value,
    quality: videoQuality.value,
    duration: videoDuration.value,
    audio: videoAudio.value
  }),
  set: (v) => {
    videoAspectRatio.value = v.aspectRatio
    videoCount.value = v.count
    videoQuality.value = v.quality
    videoDuration.value = v.duration
    videoAudio.value = v.audio
  }
})

const {
  aspectRatioSelectOptions: videoAspectRatioOptions,
  countSelectOptions: videoCountOptions,
  qualitySelectOptions: videoQualityOptions,
  durationSelectOptions: videoDurationOptions,
  audioSelectOptions: videoAudioOptions,
  supportsDuration: videoConfigShowDuration,
  syncSettingsToModel: syncVideoSettingsToModel
} = useVideoModelGenerateSettings({
  selectedModelCode: activeVideoModel,
  rawModelList: videoRawModelList,
  generationSettings: videoSettingsForCapability,
  aspectRatioEnumLabels: aspectRatioLabelsForVideo
})

const videoCost = computed(() => 12)

function applySavedVideoGenerateSettings() {
  const saved = creationStore.storyboardVideoGenerateSettings
  if (saved.aspectRatio) videoAspectRatio.value = saved.aspectRatio
  if (saved.resolution) videoQuality.value = String(saved.resolution).toLowerCase()
  if (saved.soundEffects === 'with-sound') videoAudio.value = 'with_audio'
  else if (saved.soundEffects === 'none') videoAudio.value = 'silent'
}

function applyVideoModelDefaultFromAgent(
  target: 'imageToVideo' | 'multiParam',
  options: ModelOption[],
  agentDefaultCodes: string[]
) {
  if (!options.length) return
  const selected = resolvePreferredModelIdFromAgentCodes(options, { agentDefaultCodes })
  if (!selected) return
  if (target === 'imageToVideo') imageToVideoModel.value = selected
  else multiParamVideoModel.value = selected
}

function reapplyVideoModelDefaultIfEmpty() {
  if (!props.open) return
  if (!String(imageToVideoModel.value || '').trim() && imageToVideoModelOptions.value.length) {
    applyVideoModelDefaultFromAgent(
      'imageToVideo',
      imageToVideoModelOptions.value,
      cachedImageToVideoAgentModelCodes.value
    )
  }
  if (!String(multiParamVideoModel.value || '').trim() && multiParamVideoModelOptions.value.length) {
    applyVideoModelDefaultFromAgent(
      'multiParam',
      multiParamVideoModelOptions.value,
      cachedMultiParamAgentModelCodes.value
    )
  }
  syncVideoSettingsToModel()
}

async function initVideoModelOptions() {
  const gen = ++initVideoModelGen
  clearAgentDefaultModelCache()

  const imagePromptAgentCode = resolveImageVideoPromptAgentCode()
  const multiPromptAgentCode = resolveMultiVideoPromptAgentCode()
  const funcCodes = uniqueTrimmedCodes([
    AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_IMAGE,
    AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO
  ])

  const [agentGroups, modelGroups] = await Promise.all([
    aidAgentList({
      bizCategoryCodes: [
        STORYBOARD_VIDEO_PROMPT_IMAGE_AGENT_BIZ_CATEGORY,
        STORYBOARD_VIDEO_PROMPT_AGENT_BIZ_CATEGORY,
        STORYBOARD_VIDEO_IMAGE_AGENT_BIZ_CATEGORY,
        STORYBOARD_VIDEO_AGENT_BIZ_CATEGORY
      ]
    }),
    userModelListByFuncCodes(funcCodes),
    ensureDictLoaded()
  ])

  if (gen !== initVideoModelGen) return

  const imageToVideoList = modelsFromListByFuncGroups(
    modelGroups,
    AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_IMAGE
  )
  if (imageToVideoList.length > 0) {
    imageToVideoRawModelList.value = imageToVideoList
    imageToVideoModelOptions.value = imageToVideoList.map(mapVideoModelOption)
  } else {
    await loadImageToVideoModelOptions()
  }

  const multiParamList = modelsFromListByFuncGroups(modelGroups, AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO)
  if (multiParamList.length > 0) {
    multiParamRawModelList.value = multiParamList
    multiParamVideoModelOptions.value = multiParamList.map(mapVideoModelOption)
  } else {
    await loadMultiParamVideoModelOptions()
  }

  /** 优先提示词智能体 modelCode，再尝试出片智能体 modelCode（与 listByFunc 视频池对齐） */
  cachedImageToVideoAgentModelCodes.value = [
    resolveAgentModelCodeInGroup(
      agentGroups,
      STORYBOARD_VIDEO_PROMPT_IMAGE_AGENT_BIZ_CATEGORY,
      imagePromptAgentCode
    ),
    resolveAgentModelCodeInGroup(
      agentGroups,
      STORYBOARD_VIDEO_IMAGE_AGENT_BIZ_CATEGORY,
      imagePromptAgentCode
    )
  ].filter(Boolean)
  cachedMultiParamAgentModelCodes.value = [
    resolveAgentModelCodeInGroup(
      agentGroups,
      STORYBOARD_VIDEO_PROMPT_AGENT_BIZ_CATEGORY,
      multiPromptAgentCode
    ),
    resolveAgentModelCodeInGroup(
      agentGroups,
      STORYBOARD_VIDEO_AGENT_BIZ_CATEGORY,
      multiPromptAgentCode
    )
  ].filter(Boolean)

  applySavedVideoGenerateSettings()

  applyVideoModelDefaultFromAgent(
    'imageToVideo',
    imageToVideoModelOptions.value,
    cachedImageToVideoAgentModelCodes.value
  )
  applyVideoModelDefaultFromAgent(
    'multiParam',
    multiParamVideoModelOptions.value,
    cachedMultiParamAgentModelCodes.value
  )
  syncVideoSettingsToModel()
}

async function loadStoryboardVideoPromptForScene() {
  if (isStoryboardVideoPromptGeneratingForScene()) return
  const id = currentStoryboardId.value
  if (!id) {
    resolvedVideoPromptAssets.value = []
    imageToVideoPrompt.value = ''
    return
  }
  try {
    const plain = await fetchStoryboardImageToVideoPrompt(id)
    await applyVideoPromptFromApi(plain)
  } catch {
    resolvedVideoPromptAssets.value = []
    imageToVideoPrompt.value = ''
  }
}

async function loadStoryboardMultiVideoPromptForScene() {
  if (isStoryboardVideoPromptGeneratingForScene()) return
  const id = currentStoryboardId.value
  if (!id) {
    resolvedMultiParamPromptAssets.value = []
    multiParamPrompt.value = ''
    return
  }
  try {
    const plain = await fetchStoryboardMultiVideoPrompt(id)
    await applyMultiParamPromptFromApi(plain)
  } catch {
    resolvedMultiParamPromptAssets.value = []
    multiParamPrompt.value = ''
  }
}

watch(activeVideoModel, () => syncVideoSettingsToModel())

watch(imageToVideoModelOptions, () => reapplyVideoModelDefaultIfEmpty(), { flush: 'post' })
watch(multiParamVideoModelOptions, () => reapplyVideoModelDefaultIfEmpty(), { flush: 'post' })

watch(leftActiveTab, () => {
  syncVideoSettingsToModel()
})

function storyboardVideoBizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

/** 图生视频接口：参考图最多 1 张 */
const MAX_IMAGE_TO_VIDEO_REFERENCE_COUNT = 1

function collectReferenceImageUrls(): string[] {
  return referenceImages.value
    .map((r) => String(r.url || r.thumbnail || '').trim())
    .filter(Boolean)
}

function collectMultiParamAssetImages(): Array<{ url?: string; thumbnail?: string }> {
  return [...sceneImages.value, ...characterImages.value, ...propImages.value, ...otherImages.value].filter(
    (img) => img?.url || img?.thumbnail
  )
}

function validateImageToVideoReferenceImages(images: string[]): boolean {
  if (!images.length) {
    message.warning('请上传或选择至少一张参考图片')
    return false
  }
  if (images.length > MAX_IMAGE_TO_VIDEO_REFERENCE_COUNT) {
    message.warning('图生视频最多只能上传一张参考图片')
    return false
  }
  return true
}

function validateMultiParamAssetImages(): boolean {
  if (!collectMultiParamAssetImages().length) {
    message.warning('多参生视频至少需要上传一张图片素材')
    return false
  }
  return true
}

function normalizeImageToVideoReferenceItems<T extends { url?: string; thumbnail?: string }>(items: T[]): T[] {
  if (items.length <= MAX_IMAGE_TO_VIDEO_REFERENCE_COUNT) return items
  message.warning('图生视频最多只能上传一张参考图片，已使用第一张')
  return items.slice(0, MAX_IMAGE_TO_VIDEO_REFERENCE_COUNT)
}

function resolveBaseImageRecordId(): number | undefined {
  const refId = Number(referenceImage.value?.id)
  if (Number.isFinite(refId) && refId > 0) return refId
  return undefined
}

async function runStoryboardImageVideoGenerateTaskForScene(opts: {
  sceneIdx: number
  progressSubmit: string
  progressRunning: string
  videoPrompt?: string
  userInputText?: string
}) {
  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜ID缺失，无法发起生成')
    return
  }

  const images = collectReferenceImageUrls()
  if (!validateImageToVideoReferenceImages(images)) return

  const modelName = String(imageToVideoModel.value || '').trim()
  if (!modelName) {
    message.warning('请先选择图生视频模型')
    return
  }

  const durationSec = Number(videoDuration.value)
  const body = {
    storyboardIds: [storyboardId],
    images,
    modelName,
    videoPrompt: opts.videoPrompt?.trim() || undefined,
    baseImageRecordId: resolveBaseImageRecordId(),
    aspectRatio: videoAspectRatio.value || undefined,
    durationSeconds:
      videoConfigShowDuration.value && Number.isFinite(durationSec) && durationSec > 0
        ? durationSec
        : undefined,
    count: videoCount.value,
    generateAudio: videoAudio.value === 'with_audio',
    userInputText: opts.userInputText
  }

  persistVideoGenerateSettings(modelName)

  await runStoryboardVideoGenerateForScene(opts.sceneIdx, {
    taskKind: 'i2v',
    submitImageVideoBody: body,
    progressSubmit: opts.progressSubmit,
    progressRunning: opts.progressRunning
  })
}

async function runStoryboardMultiVideoGenerateTaskForScene(opts: {
  sceneIdx: number
  progressSubmit: string
  progressRunning: string
  videoPrompt?: string
  userInputText?: string
}) {
  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜ID缺失，无法发起生成')
    return
  }

  if (!validateMultiParamAssetImages()) return

  const modelName = String(multiParamVideoModel.value || '').trim()
  if (!modelName) {
    message.warning('请先选择多参生视频模型')
    return
  }

  const durationSec = Number(videoDuration.value)
  const promptPlain = opts.videoPrompt?.trim() || multiParamPromptPlain.value.trim()
  const localAssets = collectStoryboardPromptAssets(
    sceneImages.value,
    characterImages.value,
    propImages.value,
    otherImages.value
  )
  const mergedAssets = mergePromptAssets(
    patchEmptyResolvedPromptAssets(resolvedMultiParamPromptAssets.value, localAssets),
    localAssets
  )
  const unresolved = listUnresolvedPromptImagePlaceholders(promptPlain, mergedAssets)
  if (unresolved.length) {
    message.error(
      `参考图缺失：${unresolved.map((p) => `图片${p.imageIndex}[${p.name}]`).join('、')}，请补齐资产或修改提示词`
    )
    return
  }
  const referenceOverrides = buildStoryboardVideoReferenceOverrides(promptPlain, mergedAssets)
  const body = {
    storyboardIds: [storyboardId],
    modelName,
    videoPrompt: promptPlain || undefined,
    ...(Object.keys(referenceOverrides).length ? { referenceOverrides } : {}),
    aspectRatio: videoAspectRatio.value || undefined,
    durationSeconds:
      videoConfigShowDuration.value && Number.isFinite(durationSec) && durationSec > 0
        ? durationSec
        : undefined,
    count: videoCount.value,
    generateAudio: videoAudio.value === 'with_audio',
    userInputText: opts.userInputText
  }

  persistVideoGenerateSettings(modelName)

  await runStoryboardVideoGenerateForScene(opts.sceneIdx, {
    taskKind: 'multi',
    submitMultiBody: body,
    progressSubmit: opts.progressSubmit,
    progressRunning: opts.progressRunning
  })
}

function persistVideoGenerateSettings(modelName: string) {
  const ar = videoAspectRatio.value
  const savedAspect =
    ar === '16:9' || ar === '9:16' || ar === '4:3' || ar === '1:1' ? ar : undefined
  const q = videoQuality.value.toLowerCase()
  const savedResolution = q === '720p' || q === '1080p' ? (q as '720p' | '1080p') : undefined
  creationStore.setStoryboardVideoGenerateSettings({
    videoModel: modelName,
    ...(savedAspect ? { aspectRatio: savedAspect } : {}),
    ...(savedResolution ? { resolution: savedResolution } : {}),
    soundEffects: videoAudio.value === 'with_audio' ? 'with-sound' : 'none'
  })
}

watch(
  () => props.sceneIndex,
  (v) => {
    currentSceneIndex.value = v
  }
)

watch(
  () => props.open,
  (open) => {
    if (open) {
      imageToVideoModel.value = ''
      multiParamVideoModel.value = ''
      imageToVideoModelDropdownExpanded.value = false
      multiParamVideoModelDropdownExpanded.value = false
      void initVideoModelOptions()
      currentSceneIndex.value = props.sceneIndex
      showStoryboardScriptModal.value = false
      nextTick(() => {
        scrollActiveSceneTabIntoView()
        sceneTabBarRef.value?.refresh()
      })
      if (import.meta.client) {
        window.addEventListener(
          'create-flow-global-tasks-updated',
          handleGlobalTasksUpdatedForVideoModal
        )
        window.addEventListener(
          'create-flow-storyboard-video-gen-settled',
          handleStoryboardVideoGenSettledEvent
        )
      }
      void restoreStoryboardVideoGenerateIfNeeded(props.sceneIndex)
      void loadStoryboardVideoPromptForScene()
      void loadStoryboardMultiVideoPromptForScene()
    } else {
      initVideoModelGen++
      resumeStoryboardVideoFollowGen++
      showStoryboardScriptModal.value = false
      if (import.meta.client) {
        window.removeEventListener(
          'create-flow-global-tasks-updated',
          handleGlobalTasksUpdatedForVideoModal
        )
        window.removeEventListener(
          'create-flow-storyboard-video-gen-settled',
          handleStoryboardVideoGenSettledEvent
        )
      }
    }
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

watch(
  () => currentStoryboardId.value,
  (id) => {
    if (!props.open) return
    if (!id) return
    void restoreStoryboardVideoGenerateIfNeeded(currentSceneIndex.value)
  }
)

watch(
  () => [currentStoryboardId.value, currentSceneIndex.value] as const,
  ([storyboardId, sceneIdx], prev) => {
    if (!props.open) return
    if (isStoryboardVideoPromptGeneratingForScene(sceneIdx)) return
    const prevStoryboardId = prev?.[0]
    if (storyboardId !== prevStoryboardId) {
      referenceImages.value = []
    }
    void loadStoryboardVideoPromptForScene()
    void loadStoryboardMultiVideoPromptForScene()
  }
)

watch(
  [resolvedMultiParamPromptAssets, multiParamPromptParamGroups],
  () => {
    if (!multiParamPrompt.value) return
    const plain = storyboardPromptHtmlToPlain(multiParamPrompt.value)
    if (
      !plain.includes('@') &&
      !looksLikeMarkdown(plain) &&
      !plainHasVideoLabeledParamFields(plain)
    ) {
      return
    }
    const next = renderStoryboardVideoPromptApiTextToEditor(plain, {
      assets: resolvedMultiParamPromptAssets.value,
      paramGroups: multiParamPromptParamGroups.value,
      enableAssetRefs: true,
      enableMarkdown: true
    })
    if (next && next !== multiParamPrompt.value) {
      multiParamPrompt.value = next
    }
  },
  { deep: true }
)

/** 词库就绪后，将文本域中的镜头运动等结构化字段同步到右侧下拉（图生视频 prompt 来自 detail.videoPromptImage） */
watch(
  videoPromptParamGroups,
  () => {
    if (!imageToVideoPrompt.value) return
    const plain = storyboardPromptHtmlToPlain(imageToVideoPrompt.value)
    if (!plainHasVideoLabeledParamFields(plain)) return
    applyVideoParamSelectionsFromPlain(plain)
  },
  { deep: true }
)

// 仅当用户手动点击「设置为分镜视频」后才在顶部 tab 显示缩略图，上传视频不自动占位
function getFirstVideo(index: number) {
  const list = props.scenes[index]?.videos || []
  return list.find((v: any) => v.isStoryboardVideo) || null
}

/** 与编辑分镜配音弹窗 Tab 一致：已设置分镜视频则不显示「分镜生成中」，未设置则显示「未设置分镜」 */
function formatStoryboardVideoTabLabel(
  title: string,
  hasStoryboardVideo: boolean,
  index: number
): string {
  const raw = (title || '').trim()
  if (hasStoryboardVideo) {
    return (
      raw
        .replace(/[:：]\s*分镜生成中\s*$/u, '')
        .replace(/\s*分镜生成中\s*$/u, '')
        .trim() ||
      raw ||
      `分镜视频${index + 1}`
    )
  }
  if (/分镜生成中/.test(raw)) {
    return raw.replace(/分镜生成中/g, '未设置分镜')
  }
  const base =
    raw
      .replace(/[:：]\s*分镜生成中\s*$/u, '')
      .replace(/[:：]\s*$/, '')
      .trim() || raw
  if (!base) return `分镜视频${index + 1}：未设置分镜`
  return base.includes('未设置分镜') ? base : `${base}：未设置分镜`
}

const sceneTabsForHeader = computed(() =>
  props.scenes.map((scene, i) => ({
    tabLabel: formatStoryboardVideoTabLabel(scene.name || '', !!getFirstVideo(i)?.url, i)
  }))
)

const sceneTabBarRef = ref<InstanceType<typeof HorizontalScrollTabBar> | null>(null)

function scrollActiveSceneTabIntoView() {
  sceneTabBarRef.value?.scrollItemIntoView('.scene-image-tab.active')
  sceneTabBarRef.value?.refresh()
}

function switchScene(index: number) {
  if (index === currentSceneIndex.value) return
  pauseAllVideoPreviews()
  playingVideoIdx.value = -1
  videoPreviewRefs.clear()
  showStoryboardScriptModal.value = false
  leftPanelLoading.value = true
  rightPanelLoading.value = true
  currentSceneIndex.value = index
  selectedVideoIdx.value = 0
  void restoreStoryboardVideoGenerateIfNeeded(index)
  nextTick().then(() => {
    scrollActiveSceneTabIntoView()
    setTimeout(() => {
      leftPanelLoading.value = false
      rightPanelLoading.value = false
    }, TAB_SWITCH_SKELETON_MS)
  })
}

function handleCancel() {
  pauseAllVideoPreviews()
  playingVideoIdx.value = -1
  videoPreviewRefs.clear()
  emit('update:open', false)
}

async function handleSaveVideoPrompt() {
  if (isSavingVideoPrompt.value || showGeneratingVideoPromptForScene.value) return
  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜ID缺失，无法保存提示词')
    return
  }

  const plain = imageToVideoPromptPlain.value.trim()
  const validation = validateImageToVideoPromptPlain(plain)
  if (validation.ok === false) {
    message.warning(validation.message)
    return
  }

  isSavingVideoPrompt.value = true
  const hideLoading = message.loading('正在保存视频提示词...', 0)
  try {
    // 图生方向无独立 save 接口；出片时传 videoPrompt 会自动落库 video_prompt_image
    message.success('提示词格式正确，点击「开始生成」时将自动保存并出片')
  } finally {
    hideLoading()
    isSavingVideoPrompt.value = false
  }
}

async function handleImageToVideoGeneratePrompt() {
  const sceneIdx = currentSceneIndex.value
  await runStoryboardVideoPromptGenerateFlow({
    sceneIdx,
    taskKind: 'video-prompt-gen',
    loadingMessage: '正在生成视频提示词...',
    successMessage: '视频提示词生成成功',
    isGenerating: isGeneratingVideoPrompt,
    targetKey: videoPromptGenerateTargetKey,
    submit: async (ctx, storyboardId) => {
      const llmFields = await resolveImageVideoPromptSubmitFields()
      return userStoryboardGenerateVideoPromptImage({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardIds: [storyboardId],
        ...llmFields
      })
    },
    fetchPromptAfterGenerate: fetchStoryboardImageToVideoPromptAfterGenerate,
    applyPrompt: applyVideoPromptFromApi
  })
}

function applyImageToVideoParamSettingsConfirm(payload: ParamSettingsConfirmPayload) {
  nineGridEnabled.value = payload.nineGridEnabled
  const refs = payload.referenceImages?.length
    ? [...payload.referenceImages]
    : payload.referenceImage
      ? [{ ...payload.referenceImage }]
      : []
  referenceImages.value = normalizeImageToVideoReferenceItems(refs)
  selectedCameraMovement.value = payload.selectedCameraMovement
  cameraMovementDesc.value = payload.cameraMovementDesc
  selectedImageToVideoShootingTechnique.value = payload.selectedShootingTechnique
  activeImageToVideoSettingKey.value = payload.activeVideoSettingKey as ImageToVideoSettingKey | null
}

function applyMultiParamSettingsConfirm(payload: ParamSettingsConfirmPayload) {
  sceneImages.value = payload.sceneImages
  characterImages.value = payload.characterImages
  propImages.value = payload.propImages
  otherImages.value = payload.otherImages
  multiParamShootingTechnique.value =
    payload.imageToVideoSelectedShootingTechnique ?? payload.selectedShootingTechnique ?? null
  activeMultiParamSettingKey.value = payload.activeVideoSettingKey
  if (payload.imageToVideoNineGridEnabled !== undefined) {
    nineGridEnabled.value = payload.imageToVideoNineGridEnabled
  }
  if (payload.imageToVideoSelectedCameraMovement !== undefined) {
    selectedCameraMovement.value = payload.imageToVideoSelectedCameraMovement
  }
  if (payload.imageToVideoCameraMovementDesc !== undefined) {
    cameraMovementDesc.value = payload.imageToVideoCameraMovementDesc
  }
  if (payload.imageToVideoSelectedShootingTechnique !== undefined) {
    selectedImageToVideoShootingTechnique.value = payload.imageToVideoSelectedShootingTechnique
  }
  if (payload.imageToVideoActiveVideoSettingKey !== undefined) {
    activeImageToVideoSettingKey.value =
      payload.imageToVideoActiveVideoSettingKey as ImageToVideoSettingKey | null
  }
}

function handleImportReference() {
  selectReferenceModalOpen.value = true
}

function handleMultiParamImportReference() {
  selectMultiParamReferenceModalOpen.value = true
}

function mapMultiParamReferenceImportItem(item: any, idx: number) {
  return {
    ...item,
    id: item.id || `multi-ref-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    url: item.url || item.thumbnail,
    thumbnail: item.thumbnail || item.url,
    title: item.title || item.name
  }
}

function inferMultiParamAssetType(item: any): 'scene' | 'character' | 'prop' | 'other' {
  const id = String(item?.id ?? '')
  if (id.includes('proj-scene') || id.includes('scene')) return 'scene'
  if (id.includes('proj-char') || id.includes('character')) return 'character'
  if (id.includes('proj-prop') || id.includes('prop')) return 'prop'
  const title = String(item?.title || item?.name || '')
  if (/^场景\d*/.test(title)) return 'scene'
  if (/^角色\d*/.test(title)) return 'character'
  if (/^道具\d*/.test(title)) return 'prop'
  return 'other'
}

function appendMultiParamAssetImages(type: 'scene' | 'character' | 'prop' | 'other', list: any[]) {
  if (!list.length) return
  if (type === 'scene') {
    sceneImages.value = [...sceneImages.value, ...list]
  } else if (type === 'character') {
    characterImages.value = [...characterImages.value, ...list]
  } else if (type === 'prop') {
    propImages.value = [...propImages.value, ...list]
  } else {
    otherImages.value = [...otherImages.value, ...list]
  }
}

function onSelectMultiParamReferenceConfirm(items: any[]) {
  if (!items?.length) return
  const list = items.map(mapMultiParamReferenceImportItem)
  if (getActiveStoryboardPanel()?.isParamSettingsOpen?.()) {
    for (const item of list) {
      getActiveStoryboardPanel()?.applyParamDraftAssets(inferMultiParamAssetType(item), [item])
    }
    message.success(`已导入 ${list.length} 张参考图`)
    return
  }
  for (const item of list) {
    appendMultiParamAssetImages(inferMultiParamAssetType(item), [item])
  }
  message.success(`已导入 ${list.length} 张参考图`)
}

function removeMultiParamAssetReference(index: number) {
  const all = [
    ...sceneImages.value,
    ...characterImages.value,
    ...propImages.value,
    ...otherImages.value
  ]
  const target = all[index]
  if (!target) return
  const key = String(target.id || target.url || target.thumbnail || '')
  const filterOut = (arr: any[]) =>
    arr.filter((img) => String(img.id || img.url || img.thumbnail || '') !== key)
  sceneImages.value = filterOut(sceneImages.value)
  characterImages.value = filterOut(characterImages.value)
  propImages.value = filterOut(propImages.value)
  otherImages.value = filterOut(otherImages.value)
}

function mapReferenceImportItem(item: any, idx: number) {
  return {
    id: item.id || `ref-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    url: item.url || item.thumbnail,
    thumbnail: item.thumbnail || item.url,
    title: item.title || item.name
  }
}

function onSelectReferenceConfirm(items: any[]) {
  if (!items?.length) return
  const mapped = normalizeImageToVideoReferenceItems(items.map(mapReferenceImportItem))
  const panel = getActiveStoryboardPanel()
  if (panel?.isParamSettingsOpen?.()) {
    panel.applyParamDraftReferences(mapped)
    message.success('已导入参考图')
    return
  }
  referenceImages.value = mapped
  message.success('已导入参考图')
}

function clearReferenceImage() {
  referenceImages.value = []
  nineGridEnabled.value = false
  message.success('已移除')
}

function removeReferenceImageAt(index: number) {
  const next = [...referenceImages.value]
  next.splice(index, 1)
  referenceImages.value = next
  if (!next.length) {
    nineGridEnabled.value = false
  }
}

function previewReferenceImage(ref: { url?: string; thumbnail?: string }) {
  const src = ref?.url || ref?.thumbnail
  if (!src) return
  window.open(src, '_blank', 'noopener')
}

function onPreviewReferenceImage() {
  const r = referenceImage.value
  if (r && (r.url || r.thumbnail)) previewReferenceImage(r)
}

function copyCameraDesc() {
  if (cameraMovementDesc.value) {
    navigator.clipboard.writeText(cameraMovementDesc.value)
    message.success('已复制')
  }
}

function copyImageToVideoPrompt() {
  const plain = imageToVideoPromptPlain.value
  if (plain) {
    navigator.clipboard.writeText(plain)
    message.success('已复制')
  }
}

async function handleImageToVideoStartGenerate() {
  if (showImageToVideoGenerateLoading.value) return
  const promptPlain = imageToVideoPromptPlain.value.trim()
  if (!promptPlain) {
    message.warning('请输入视频提示词，或先生成提示词')
    return
  }
  const validation = validateImageToVideoPromptPlain(promptPlain)
  if (validation.ok === false) {
    message.warning(validation.message)
    return
  }
  const supplementary = cameraMovementDesc.value.trim().slice(0, 500)
  await runStoryboardImageVideoGenerateTaskForScene({
    sceneIdx: currentSceneIndex.value,
    progressSubmit: '图生视频任务提交中…',
    progressRunning: '图生视频生成中…',
    videoPrompt: promptPlain,
    userInputText: supplementary || undefined
  })
}

async function handleMultiParamGeneratePrompt() {
  const sceneIdx = currentSceneIndex.value
  await runStoryboardVideoPromptGenerateFlow({
    sceneIdx,
    taskKind: 'multi-video-prompt-gen',
    loadingMessage: '正在生成多参视频提示词...',
    successMessage: '多参视频提示词生成成功',
    isGenerating: isGeneratingMultiParamPrompt,
    targetKey: multiParamPromptGenerateTargetKey,
    submit: async (ctx, storyboardId) => {
      const llmFields = await resolveMultiVideoPromptSubmitFields()
      return userStoryboardGenerateVideoPrompt({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardIds: [storyboardId],
        ...llmFields
      })
    },
    fetchPromptAfterGenerate: fetchStoryboardMultiVideoPromptAfterGenerate,
    applyPrompt: applyMultiParamPromptFromApi
  })
}

function copyMultiParamPrompt() {
  const plain = multiParamPromptPlain.value
  if (plain) {
    navigator.clipboard.writeText(plain)
    message.success('已复制')
  }
}

async function handleMultiParamStartGenerate() {
  if (showMultiParamGenerateLoading.value) return
  const promptPlain = multiParamPromptPlain.value.trim()
  if (!promptPlain) {
    message.warning('请输入描述内容，或先生成提示词')
    return
  }
  const validation = validateMultiParamVideoPromptPlain(promptPlain)
  if (validation.ok === false) {
    message.warning(validation.message)
    return
  }
  if (!currentStoryboardId.value) {
    message.warning('分镜ID缺失，无法发起生成')
    return
  }
  const supplementary = multiParamShootingTechnique.value?.value?.trim().slice(0, 500)
  await runStoryboardMultiVideoGenerateTaskForScene({
    sceneIdx: currentSceneIndex.value,
    progressSubmit: '多参生视频任务提交中…',
    progressRunning: '多参视频生成中…',
    videoPrompt: promptPlain,
    userInputText: supplementary || undefined
  })
}

function openSelectAssetModal(
  type: 'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other'
) {
  if (type === 'pose' || type === 'expression' || type === 'effect' || type === 'draft') {
    materialLibraryCategoryKey.value = type
    showMaterialFromLibraryModal.value = true
    return
  }
  if (type === 'other') {
    materialLibraryCategoryKey.value = 'misc'
    showMaterialFromLibraryModal.value = true
    return
  }
  selectAssetModalType.value = type
  selectAssetModalOpen.value = true
}

function handleMaterialLibraryOtherImport(assets: any[]) {
  if (!assets?.length) return
  const list = assets.map((item) => ({
    ...item,
    url: item.url || item.thumbnail,
    thumbnail: item.thumbnail || item.url,
    title: item.title || item.name || '参考图',
    id: item.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }))
  if (getActiveStoryboardPanel()?.isParamSettingsOpen?.()) {
    const type = materialLibraryCategoryKey.value === 'misc' ? 'other' : materialLibraryCategoryKey.value
    getActiveStoryboardPanel()?.applyParamDraftAssets(type as any, list)
    message.success(`已添加 ${list.length} 项`)
    showMaterialFromLibraryModal.value = false
    return
  }
  otherImages.value = [...otherImages.value, ...list]
  message.success(`已添加 ${list.length} 项`)
  showMaterialFromLibraryModal.value = false
}

function onSelectAssetConfirm(items: any[]) {
  if (!items?.length) return
  const list = items.map((item) => ({
    ...item,
    id: item.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }))
  if (getActiveStoryboardPanel()?.isParamSettingsOpen?.()) {
    getActiveStoryboardPanel()?.applyParamDraftAssets(selectAssetModalType.value, list)
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

function removeOtherImage(index: number) {
  otherImages.value = otherImages.value.filter((_, i) => i !== index)
}

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

const isSettingFinalVideo = ref(false)

function resolveStoryboardVideoRecordId(video: any): number | null {
  const fromRow = video?._serverRow?.id
  if (fromRow != null && Number.isFinite(Number(fromRow)) && Number(fromRow) > 0) {
    return Number(fromRow)
  }
  const id = Number(video?.id)
  if (video?._fromServer && Number.isFinite(id) && id > 0) return id
  return null
}

async function setAsStoryboardVideo(idx: number) {
  if (isSettingFinalVideo.value) return

  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜信息异常，请刷新后重试')
    return
  }

  const video = currentSceneVideos.value[idx]
  if (!video) {
    message.warning('没有可设置的视频')
    return
  }

  const recordId = resolveStoryboardVideoRecordId(video)
  if (!recordId) {
    message.warning('当前视频无有效生成记录，无法设为分镜视频')
    return
  }

  if (!String(video.url || '').trim()) {
    message.warning('产物未完成')
    return
  }

  isSettingFinalVideo.value = true
  try {
    await userStoryboardSetFinalVideo({ storyboardId, recordId })
    await refreshVideoRecords(currentSceneIndex.value)
    message.success('确认成功')
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '设置分镜视频失败')
  } finally {
    isSettingFinalVideo.value = false
  }
}

async function unsetAsStoryboardVideo(idx: number) {
  if (isSettingFinalVideo.value) return

  const storyboardId = currentStoryboardId.value
  if (!storyboardId) {
    message.warning('分镜信息异常，请刷新后重试')
    return
  }

  const video = currentSceneVideos.value[idx]
  if (!video) return

  const recordId = resolveStoryboardVideoRecordId(video)
  if (!recordId) {
    message.warning('分镜信息异常，请刷新后重试')
    return
  }

  isSettingFinalVideo.value = true
  try {
    await userStoryboardUnSetFinalVideo({ storyboardId, recordId })
    await refreshVideoRecords(currentSceneIndex.value)
    message.success('取消成功')
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '取消分镜视频失败')
  } finally {
    isSettingFinalVideo.value = false
  }
}

const playingVideoIdx = ref(-1)
const videoPreviewRefs = new Map<number, HTMLVideoElement>()

function setVideoPreviewRef(el: HTMLVideoElement | null, idx: number) {
  if (el) videoPreviewRefs.set(idx, el)
  else videoPreviewRefs.delete(idx)
}

function pauseAllVideoPreviews(exceptIdx = -1) {
  videoPreviewRefs.forEach((videoEl, i) => {
    if (i === exceptIdx) return
    videoEl.pause()
    videoEl.currentTime = 0
    videoEl.muted = true
  })
}

function handlePlayVideo(idx: number) {
  const list = props.scenes[currentSceneIndex.value]?.videos || []
  const v = list[idx]
  if (!v?.url) return

  pauseAllVideoPreviews(idx)

  const videoEl = videoPreviewRefs.get(idx)
  if (!videoEl) return

  videoEl.muted = false
  playingVideoIdx.value = idx
  void videoEl.play().catch(() => {
    playingVideoIdx.value = -1
    videoEl.muted = true
    message.warning('无法自动播放，请稍后重试')
  })
}

function onVideoPreviewEnded(idx: number) {
  if (playingVideoIdx.value !== idx) return
  playingVideoIdx.value = -1
  const videoEl = videoPreviewRefs.get(idx)
  if (videoEl) {
    videoEl.muted = true
    videoEl.currentTime = 0
  }
}

function onVideoPreviewPause(idx: number) {
  const videoEl = videoPreviewRefs.get(idx)
  if (!videoEl || !videoEl.paused || playingVideoIdx.value !== idx) return
  playingVideoIdx.value = -1
  videoEl.muted = true
}

async function handleFullscreenVideo(idx: number) {
  const videoEl = videoPreviewRefs.get(idx)
  if (!videoEl) return
  try {
    if (videoEl.paused) {
      pauseAllVideoPreviews(idx)
      videoEl.muted = false
      playingVideoIdx.value = idx
      await videoEl.play()
    }
    await videoEl.requestFullscreen()
  } catch {
    message.warning('全屏预览不可用')
  }
}

function handleDownloadVideo(_idx: number, v: any) {
  const url = v?.url
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = v?.title || '分镜视频'
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  message.success('开始下载')
}

function handleUploadLocalVideo() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const url = await uploadVideoToOssWithToast(file)
      if (!url) return
      const now = new Date()
      const newVideo = {
        id: `v-${Date.now()}`,
        url,
        title: file.name.replace(/\.[^/.]+$/, '') || '本地视频',
        source: '本地上传',
        importDate: now.toISOString()
      }
      const cur = props.scenes[currentSceneIndex.value]
      const newVideos = [...(cur?.videos || []), newVideo]
      emit('update', currentSceneIndex.value, { videos: newVideos })
      message.success('视频已添加')
    }
  }
  input.click()
}

const showVideoLibraryModal = ref(false)

function isVideoAsset(asset: any): boolean {
  if (!asset || typeof asset !== 'object') return false
  if (asset.type === 'video') return true
  const url = asset.url || asset.src || ''
  const name = asset.name || asset.title || ''
  if (
    /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(url) ||
    /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(name)
  )
    return true
  return false
}

function handleOpenVideoLibrary() {
  showVideoLibraryModal.value = true
}

function handleVideoLibraryImport(asset: any) {
  if (!isVideoAsset(asset)) {
    message.error('仅支持导入视频，请选择视频文件')
    return
  }
  const url = asset.url || asset.src
  const title =
    asset.title || asset.name || (asset.name && asset.name.replace(/\.[^/.]+$/, '')) || '资源库视频'
  const now = new Date()
  const newVideo = {
    id: asset.id || `v-${Date.now()}`,
    url,
    title,
    source: '资源库导入',
    importDate: now.toISOString()
  }
  const cur = props.scenes[currentSceneIndex.value]
  const newVideos = [...(cur?.videos || []), newVideo]
  emit('update', currentSceneIndex.value, { videos: newVideos })
  message.success('视频已添加')
}

const isDeletingRecord = ref(false)

function canDeleteHistoryVideo(video: any): boolean {
  if (!video || video._generating || isDeletingRecord.value) return false
  if (resolveStoryboardVideoRecordId(video)) return true
  return !!String(video?.url || '').trim()
}

function removeLocalVideo(index: number) {
  const scene = props.scenes[currentSceneIndex.value]
  const videos = (scene?.videos || []).filter((_, i) => i !== index)
  emit('update', currentSceneIndex.value, { videos })
  nextTick(() => {
    if (videos.length === 0) {
      selectedVideoIdx.value = 0
    } else if (selectedVideoIdx.value >= videos.length) {
      selectedVideoIdx.value = videos.length - 1
    }
  })
}

function handleDeleteVideo(videoIndex: number) {
  const video = currentSceneVideos.value[videoIndex]
  if (!canDeleteHistoryVideo(video)) {
    message.warning('当前记录无法删除')
    return
  }

  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这条生成记录吗？删除后不可恢复。',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      const recordId = resolveStoryboardVideoRecordId(video)
      const storyboardId = currentStoryboardId.value

      if (recordId && storyboardId) {
        isDeletingRecord.value = true
        try {
          await userStoryboardRecordDelete({ storyboardId, recordId })
          await refreshVideoRecords(currentSceneIndex.value)
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

      removeLocalVideo(videoIndex)
      message.success('已删除')
    }
  })
}
</script>

<style lang="scss" scoped>
/* 与 EditStoryboardImageModal 全屏分镜弹窗一致 */
.edit-scene-image-modal :deep(.ant-modal) {
  max-width: 100vw;
  margin: 0;
  padding: 0;
  top: 0;
  height: 100vh;
}

.edit-scene-image-modal :deep(.ant-modal-content) {
  height: 100vh !important;
  display: flex !important;
  flex-direction: column !important;
  border-radius: 0 !important;
  background: rgba(11, 15, 23, 1) !important;
  padding: 0 !important;
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
  font-weight: 600;
  color: rgba(225, 239, 255, 0.9) !important;
  font-size: 14px;
}

.back-btn:hover {
  color: #4ae7fd !important;
  background: rgba(74, 231, 253, 0.08) !important;
}

.scene-switcher {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0;
}

.scene-switcher-track {
  gap: 0.5rem;
}

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

.thumbnail-video-wrap {
  width: 100%;
  height: 100%;
}

.thumbnail-video {
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

.thumbnail-loading-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 10, 18, 0.55);
  color: var(--accent-600);
}

.thumbnail-loading-icon {
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

.main-content-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}

/* 与 EditStoryboardImageModal 一致：左 144 | 中 自适应 | 右 398 */
.figma-stage-layout.video-stage-layout {
  display: grid;
  grid-template-columns: 144px minmax(0, 1fr) 398px;
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  flex: 1;
  background: #0b0f17;
}

.figma-stage-layout.video-stage-layout > * {
  min-height: 0;
}

.stage-history-panel,
.stage-config-panel.video-stage-config {
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

.panel-title--skeleton {
  height: 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  margin-bottom: 10px;
}

.history-list {
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

.history-list--skeleton {
  gap: 8px;
}

.history-item--skeleton {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.history-actions--skeleton {
  padding: 0 4px;
  display: grid;
  gap: 6px;
}

.skeleton-btn-bar {
  height: 32px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}

.history-empty-msg {
  padding: 12px 8px;
  font-size: 12px;
  color: rgba(225, 239, 255, 0.45);
  text-align: center;
  line-height: 1.4;
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

.history-thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.stage-history-panel .history-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(225, 239, 255, 0.55);
  font-size: 12px;
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

.video-stage-canvas {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(128, 154, 188, 0.22);
  background:
    radial-gradient(circle at 1px 1px, rgba(74, 231, 253, 0.1) 1px, transparent 0), #07090d;
  background-size:
    14px 14px,
    auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  .video-card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  .btn-set-storyboard {
    font-size: 14px;
    background: none !important;
    flex-shrink: 0;
    border: 1px solid rgba(74, 231, 253, 0.3) !important;
  }
}
}

.video-canvas-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 10px;
}

.video-canvas-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 4px;
}

.video-canvas-body--enhance-wrap {
  position: relative;
}

.video-stage-canvas .canvas-upscale-mask {
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

.video-stage-canvas .canvas-upscale-mask__icon {
  font-size: 32px;
  color: #4ae7fd;
}

.video-stage-canvas .canvas-upscale-mask__text {
  margin: 0;
  font-size: 13px;
  color: rgba(225, 239, 255, 0.88);
  max-width: 90%;
}

.video-canvas-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: rgba(188, 205, 228, 0.65);
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
}

.videos-list--in-canvas {
  padding-bottom: 0.5rem;
}

/* 与 EditStoryboardImageModal 右栏「生成分镜图 / 生成设定图 / 九宫格」Tab 一致 */
.video-stage-config {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 12px 12px 12px;
  overflow: hidden;
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

.video-config-below-tabs {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-right: 0;
}

.video-config-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-right: 4px;
}

.video-config-scroll::-webkit-scrollbar {
  width: 0px;
}

.video-config-scroll::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.55);
  border-radius: 4px;
}

.video-config-footer {
  flex-shrink: 0;
  padding: 10px 2px 4px;
  border-top: 1px solid rgba(128, 154, 188, 0.2);
  background: rgba(25, 26, 29, 1);
}

.video-config-footer :deep(.generate-btn) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0;
  font-size: 16px;
  img{
    width: 18px;
    height: 18px;
  }
}

.video-config-below-tabs :deep(.storyboard-generate-panel) {
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}

.video-config-below-tabs :deep(.storyboard-generate-panel.is-compact-height) {
  overflow-y: visible !important;
}

.video-config-body {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.video-left-content {
  flex: 1 1 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
}

.video-left-content :deep(.storyboard-generate-panel) {
  flex: 1 1 0;
  min-height: 0;
}

.video-config-below-tabs :deep(.storyboard-generate-panel.use-param-modal) {
  height: 100% !important;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden !important;
}

@media (max-height: 900px) {
  .video-stage-config {
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

.setting-select-inline {
  width: 100%;
  min-width: 0;
}

.setting-select-inline :deep(.ant-select-selector) {
  height: 44px !important;
  border-radius: 10px !important;
  background: #0a0d12 !important;
  border: 1px solid rgba(78, 94, 122, 0.42) !important;
  box-shadow: none !important;
}

.setting-select-inline :deep(.ant-select-selector:hover),
.setting-select-inline :deep(.ant-select-focused .ant-select-selector),
.setting-select-inline :deep(.ant-select-open .ant-select-selector) {
  background: #0a0d12 !important;
  border-color: rgba(120, 140, 170, 0.45) !important;
}

.setting-select-inline :deep(.ant-select-selection-item) {
  line-height: 42px !important;
  font-size: 13px;
  color: #d7e8ff !important;
}

:deep(
  .video-modal-select-dropdown .ant-select-item-option-active:not(.ant-select-item-option-disabled)
),
:deep(
  .video-modal-select-dropdown
    .ant-select-item-option-selected:not(.ant-select-item-option-disabled)
) {
  background: rgba(18, 18, 18, 1) !important;
}

.generate-btn {
  margin-top: 0.5rem;
}

.mr-1 {
  margin-right: 0.25rem;
}

.tab-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-500);
  font-size: 0.9rem;
}

.panel-skeleton {
  flex: 1;
  overflow: auto;
  padding: 1rem 1.25rem;
  min-height: 200px;
}

.panel-skeleton :deep(.ant-skeleton-content .ant-skeleton-title),
.panel-skeleton :deep(.ant-skeleton-content .ant-skeleton-paragraph > li) {
  background: linear-gradient(
    90deg,
    #2b2b2b 20%,
    #444444 50%,
    #2b2b2b 80%
  );
  background-size: 300% 100%;
  animation: storyboard-skeleton-shimmer 1.4s linear infinite;
}

.right-panel-skeleton {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.skeleton-stage-layout {
  display: grid;
  grid-template-columns: 144px minmax(0, 1fr) 398px;
  gap: 0;
  width: 100%;
  height: 100%;
}

.skeleton-history-panel,
.skeleton-canvas-panel,
.skeleton-config-panel {
  border: 1px solid rgba(128, 154, 188, 0.26);
  background: rgba(25, 26, 29, 1);
  min-height: 0;
}

.skeleton-history-panel {
  display: flex;
  flex-direction: column;
  padding: 10px 7px;
}

.skeleton-panel-title {
  height: 14px;
  border-radius: 4px;
  margin: 0 4px 10px;
}

.skeleton-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 12px;
}

.skeleton-history-item {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  flex-shrink: 0;
}

.skeleton-history-actions {
  margin-top: auto;
  padding: 0 4px;
  display: grid;
  gap: 6px;
}

.skeleton-btn {
  height: 32px;
  border-radius: 6px;
}

.skeleton-canvas-panel {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-canvas-toolbar {
  display: grid;
  grid-template-columns: repeat(5, minmax(60px, 1fr));
  gap: 8px;
}

.skeleton-chip {
  height: 28px;
  border-radius: 7px;
}

.skeleton-canvas-main {
  flex: 1;
  min-height: 280px;
  border-radius: 12px;
}

.skeleton-config-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-config-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.skeleton-tab {
  height: 32px;
  border-radius: 8px;
}

.skeleton-file-row {
  height: 52px;
  border-radius: 10px;
}

.skeleton-textarea {
  height: 140px;
  border-radius: 10px;
}

.skeleton-select-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.skeleton-select {
  height: 44px;
  border-radius: 10px;
}

.skeleton-primary-btn {
  margin-top: auto;
  height: 42px;
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
  background: rgba(18, 24, 36, 0.85);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
  color: rgba(188, 205, 228, 0.85);
  transition: all 0.2s ease;
}

.view-btn:hover {
  border-color: rgba(74, 231, 253, 0.45);
  background: rgba(74, 231, 253, 0.08);
}

.view-btn.active {
  border-color: rgba(74, 231, 253, 0.85);
  background: rgba(74, 231, 253, 0.12);
  color: #4ae7fd;
  font-weight: 600;
  box-shadow: 0 0 0 2px rgba(74, 231, 253, 0.12);
}

.view-btn-icon {
  font-size: 1rem;
}

.videos-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.videos-list-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.video-card {
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--create-surface-panel);
}

.video-card-view {
  max-width: 320px;
}

.video-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--gray-500);
}

.video-source {
  padding: 0.125rem 0.5rem;
  background: rgba(6, 10, 18, 0.55);
  border-radius: var(--radius-sm);
  color: var(--gray-600);
}

.video-date {
  color: var(--gray-500);
}

.video-preview-wrap {
  position: relative;
  width: 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: rgba(6, 10, 18, 0.55);
  aspect-ratio: 16 / 9;
  height: 38vh;
}

.video-preview-wrap .video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.video-play-overlay:hover {
  background: rgba(0, 0, 0, 0.35);
}

.play-icon {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  color: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.9);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.video-play-overlay:hover .play-icon {
  transform: scale(1.06);
 
}

.video-top-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
}

.video-action-btn {
  color: rgba(255, 255, 255, 0.9) !important;
  background: rgba(0, 0, 0, 0.4) !important;
}

.video-action-btn:hover {
  color: white !important;
  background: rgba(0, 0, 0, 0.6) !important;
}





.btn-set-storyboard-done {
  flex-shrink: 0;
  font-size: 14px;
  color: #52c41a !important;
  background: rgba(82, 196, 26, 0.12) !important;
  border-color: rgba(82, 196, 26, 0.4) !important;
}

.btn-set-storyboard-done:hover,
.btn-set-storyboard-done:focus {
  color: #73d13d !important;
  background: rgba(82, 196, 26, 0.2) !important;
  border-color: rgba(82, 196, 26, 0.55) !important;
}

.btn-set-storyboard-done .anticon {
  color: #52c41a;
}

.video-placeholder {
  height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--create-surface-canvas);
  border-radius: var(--radius-sm);
  color: var(--gray-500);
}
</style>
