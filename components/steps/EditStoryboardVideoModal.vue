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
            :key="tab.storyboardId ?? `scene-${index}`"
            :class="['scene-image-tab', { active: currentSceneIndex === index }]"
            @click="switchScene(index)"
          >
            <div class="scene-image-thumbnail">
              <div v-if="isSceneVideoGenerating(index)" class="thumbnail-loading-wrap">
                <LoadingOutlined spin class="thumbnail-loading-icon" />
              </div>
              <!-- 优先用分镜图封面（轻量），避免顶部 Tab 并发拉齐 mp4 -->
              <div v-else-if="tab.coverImageUrl" class="thumbnail-video-wrap">
                <ShimmerImage
                  :src="tab.coverImageUrl"
                  img-class="thumbnail-video"
                  object-fit="cover"
                  reveal-direction="fade"
                />
              </div>
              <div
                v-else-if="tab.videoUrl && index === currentSceneIndex"
                class="thumbnail-video-wrap"
              >
                <ShimmerVideo
                  :src="tab.videoUrl"
                  video-class="thumbnail-video"
                  object-fit="cover"
                  reveal-direction="fade"
                  preload="metadata"
                  :gated="false"
                />
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

        <div v-else class="figma-stage-layout video-stage-layout">
          <!-- 左：生成记录（与 EditStoryboardImageModal 一致） -->
          <aside class="stage-history-panel">
            <h4 class="panel-title">生成记录</h4>
            <div class="history-list">
              <template v-if="currentSceneVideos.length === 0">
                <div class="history-empty-msg">暂无生成记录</div>
              </template>
              <template v-else>
                <HistoryRecordWrap
                  v-for="(v, idx) in currentSceneVideos"
                  :key="v.id || idx"
                  :show-set-main="canSetMainFromHistory(idx)"
                  set-main-label="选为分镜视频"
                  :set-main-loading="isSettingFinalVideo"
                  @set-main="handleSetMainFromHistory(idx)"
                >
                  <button
                    type="button"
                    :class="[
                      'history-item',
                      'video-history-item',
                      {
                        active: selectedVideoIdx === idx,
                        'history-item--main': isHistoryVideoMain(idx),
                        'history-item--generating': isHistoryVideoItemGenerating(idx)
                      }
                    ]"
                    @click="selectedVideoIdx = idx"
                  >
                    <ShimmerVideo
                      v-if="v.url && selectedVideoIdx === idx"
                      :src="v.url"
                      video-class="history-thumb-video"
                      object-fit="cover"
                      reveal-direction="fade"
                      preload="metadata"
                      :gated="false"
                    />
                    <ShimmerVideo
                      v-else-if="v.url"
                      :src="v.url"
                      video-class="history-thumb-video"
                      object-fit="cover"
                      reveal-direction="fade"
                      lazy
                      preload="metadata"
                    />
                    <div v-else-if="!isHistoryVideoItemGenerating(idx)" class="history-empty">
                      空
                    </div>
                    <div
                      v-if="isHistoryVideoItemGenerating(idx)"
                      class="history-generating-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="history-generating-mask__icon" />
                    </div>
                    <span
                      v-if="isHistoryVideoMain(idx)"
                      class="history-main-mark"
                      aria-hidden="true"
                    >
                      <img :src="dialogSelectSelIcon" alt="" class="history-main-mark__icon" />
                    </span>
                    <div
                      v-if="canDeleteHistoryVideo(v)"
                      class="history-delete-icon"
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="handleDeleteVideo(idx)"
                      @keydown.enter.stop.prevent="handleDeleteVideo(idx)"
                    >
                      <img :src="deleteIcon" alt="删除" />
                    </div>
                  </button>
                </HistoryRecordWrap>
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
            <div ref="videoCanvasBodyRef" class="video-canvas-body video-canvas-body--enhance-wrap">
              <div
                v-if="currentSceneVideos.length === 0 && !isSceneVideoGenerating(currentSceneIndex)"
                class="canvas-empty video-canvas-empty"
              >
                还没有内容,先去右侧配置并生成吧
              </div>
              <div v-else-if="viewMode === 'list'" class="videos-list videos-list--in-canvas">
                <div
                  v-for="(v, idx) in currentSceneVideos"
                  :key="v.id || idx"
                  :class="[
                    'video-card',
                    { 'video-card--generating': isVideoCanvasItemGenerating(idx) }
                  ]"
                >
                  <div v-if="v.importDate" class="video-card-header">
                    <span class="video-date">{{ formatDate(v.importDate) }}</span>
                  </div>
                  <div class="video-preview-wrap">
                    <ShimmerVideo
                      v-if="v.url"
                      :key="`${idx}-${v.url}`"
                      :ref="(el) => setVideoPreviewRef(el, idx)"
                      :src="v.url"
                      video-class="video-preview"
                      object-fit="contain"
                      reveal-direction="fade"
                      lazy
                      preload="metadata"
                      @load="markVideoPreviewMediaReady(idx)"
                      @ended="onVideoPreviewEnded(idx)"
                      @pause="onVideoPreviewPause(idx)"
                      @click.stop="toggleVideoPreviewPlayback(idx)"
                    />
                    <div v-else-if="!isVideoCanvasItemGenerating(idx)" class="video-placeholder">
                      <VideoCameraOutlined />
                      <span>未设置分镜视频</span>
                    </div>
                    <div v-else class="video-placeholder video-placeholder--blank" />
                    <div
                      v-if="isVideoCanvasItemGenerating(idx)"
                      class="video-card-generating-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="video-card-generating-mask__icon" />
                      <span class="video-card-generating-mask__text">{{
                        videoGenerateOverlayLabel
                      }}</span>
                    </div>
                    <button
                      v-if="v.url && playingVideoIdx !== idx && videoPreviewMediaReady[idx]"
                      type="button"
                      class="dubbing-video-play-btn"
                      title="播放视频"
                      aria-label="播放视频"
                      @click.stop="toggleVideoPreviewPlayback(idx)"
                    />
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
                  <div v-if="!isVideoCanvasItemGenerating(idx)" class="video-card-actions">
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
                  :class="[
                    'video-card',
                    'video-card-view',
                    { 'video-card--generating': isVideoCanvasItemGenerating(idx) }
                  ]"
                >
                  <div v-if="v.importDate" class="video-card-header">
                    <span class="video-date">{{ formatDate(v.importDate) }}</span>
                  </div>
                  <div class="video-preview-wrap">
                    <ShimmerVideo
                      v-if="v.url"
                      :key="`${idx}-${v.url}`"
                      :ref="(el) => setVideoPreviewRef(el, idx)"
                      :src="v.url"
                      video-class="video-preview"
                      object-fit="contain"
                      reveal-direction="fade"
                      lazy
                      preload="metadata"
                      @load="markVideoPreviewMediaReady(idx)"
                      @ended="onVideoPreviewEnded(idx)"
                      @pause="onVideoPreviewPause(idx)"
                      @click.stop="toggleVideoPreviewPlayback(idx)"
                    />
                    <div v-else-if="!isVideoCanvasItemGenerating(idx)" class="video-placeholder">
                      <VideoCameraOutlined />
                      <span>未设置分镜视频</span>
                    </div>
                    <div v-else class="video-placeholder video-placeholder--blank" />
                    <div
                      v-if="isVideoCanvasItemGenerating(idx)"
                      class="video-card-generating-mask"
                      role="status"
                      aria-live="polite"
                    >
                      <LoadingOutlined spin class="video-card-generating-mask__icon" />
                      <span class="video-card-generating-mask__text">{{
                        videoGenerateOverlayLabel
                      }}</span>
                    </div>
                    <button
                      v-if="v.url && playingVideoIdx !== idx && videoPreviewMediaReady[idx]"
                      type="button"
                      class="dubbing-video-play-btn"
                      title="播放视频"
                      aria-label="播放视频"
                      @click.stop="toggleVideoPreviewPlayback(idx)"
                    />
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
                  <div v-if="!isVideoCanvasItemGenerating(idx)" class="video-card-actions">
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
            <div :class="['config-tabs', videoTabBarClass]">
              <button
                v-if="showImageToVideoTab"
                type="button"
                :class="['config-tab', { active: leftActiveTab === 'imageToVideo' }]"
                @click="leftActiveTab = 'imageToVideo'"
              >
                图生视频
              </button>
              <button
                v-if="showMultiParamTab"
                type="button"
                :class="['config-tab', { active: leftActiveTab === 'multiParam' }]"
                @click="leftActiveTab = 'multiParam'"
              >
                多参生视频
              </button>
              <button
                v-if="showGridVideoTab"
                type="button"
                :class="['config-tab', { active: leftActiveTab === 'gridVideo' }]"
                @click="leftActiveTab = 'gridVideo'"
              >
                宫格生视频
              </button>
              <button
                v-if="showStartEndFrameTab"
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
                  <!-- 图生视频 / 宫格生视频：共用提示词与模型配置；宫格模式隐藏九宫格开关，文本域上方仍展示导入参考图 -->
                  <div v-if="isPrimaryVideoTab" class="video-left-content create-modal-tab-panel">
                    <StoryboardGeneratePanel
                      ref="imageToVideoPanelRef"
                      mode="storyboardVideo"
                      :use-precise-layout="false"
                      :show-storyboard-video-assets="!isGridVideoTab"
                      :suppress-prompt-reactive-sync="videoPromptProgrammaticSyncDepth > 0"
                      :scene-file-name="scriptRowLabel"
                      icon-type="scene"
                      :show-reference-button="false"
                      :show-generate-prompt-button="true"
                      :generate-prompt-loading="showGeneratingVideoPromptForScene"
                      :show-save-prompt-button="!isGridVideoTab"
                      :save-prompt-loading="isSavingVideoPrompt"
                      :extra-prompt-assets="resolvedVideoPromptAssets"
                      v-model:prompt="imageToVideoPrompt"
                      prompt-placeholder="描述你想要生成的画面内容和动作,如:一个穿着红色裙子的小女孩在草地上奔跑"
                      v-model:is-setting-expanded="isImageToVideoSettingExpanded"
                      v-model:nine-grid-enabled="nineGridEnabled"
                      v-model:reference-image="referenceImage"
                      :reference-images="referenceImages"
                      :reference-audios="referenceAudios"
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
                      @remove-reference-audio="removeReferenceAudioAt"
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
                        :show-audio="videoConfigShowAudio"
                        :duration-tip="videoDurationTip"
                        :video-aspect-ratio-options="videoAspectRatioOptions"
                        :video-duration-options="videoDurationOptions"
                        :video-count-options="videoCountOptions"
                        :video-quality-options="videoQualityOptions"
                        :video-audio-options="videoAudioOptions"
                        :select-popup-class-name="'video-modal-select-dropdown'"
                      >
                        <template #model>
                          <ModelSelectDropdown
                            v-if="isGridVideoTab"
                            :key="`grid-model-${gridVideoModel}-${gridVideoModelOptions.length}`"
                            :value="selectedGridVideoModel"
                            :options="gridVideoModelOptions"
                            :expanded="gridVideoModelDropdownExpanded"
                            @toggle="
                              gridVideoModelDropdownExpanded = !gridVideoModelDropdownExpanded
                            "
                            @close="gridVideoModelDropdownExpanded = false"
                            @select="handleSelectGridVideoModel"
                          />
                          <ModelSelectDropdown
                            v-else
                            :key="`i2v-model-${imageToVideoModel}-${imageToVideoModelOptions.length}`"
                            :value="selectedImageToVideoModel"
                            :options="imageToVideoModelOptions"
                            :expanded="imageToVideoModelDropdownExpanded"
                            @toggle="
                              imageToVideoModelDropdownExpanded = !imageToVideoModelDropdownExpanded
                            "
                            @close="imageToVideoModelDropdownExpanded = false"
                            @select="handleSelectImageToVideoModel"
                          />
                        </template>
                      </GenerateModelConfigBlock>
                    </StoryboardGeneratePanel>
                  </div>

                  <!-- 多参生视频：场景/角色/道具/其他 + 描述框 + 右侧仅特殊拍摄手法 -->
                  <div
                    v-else-if="leftActiveTab === 'multiParam'"
                    class="video-left-content create-modal-tab-panel"
                  >
                    <StoryboardGeneratePanel
                      ref="multiParamPanelRef"
                      mode="imageToVideo"
                      :use-precise-layout="false"
                      :suppress-prompt-reactive-sync="videoPromptProgrammaticSyncDepth > 0"
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
                      :reference-audios="referenceAudios"
                      :image-to-video-nine-grid-enabled="nineGridEnabled"
                      :image-to-video-reference-images="referenceImages"
                      :image-to-video-selected-camera-movement="selectedCameraMovement"
                      :image-to-video-camera-movement-desc="cameraMovementDesc"
                      :image-to-video-selected-shooting-technique="
                        selectedImageToVideoShootingTechnique
                      "
                      :image-to-video-active-video-setting-key="activeImageToVideoSettingKey"
                      @open-script="openStoryboardScriptEditor"
                      @generate-prompt="handleMultiParamGeneratePrompt"
                      @import-reference="handleMultiParamImportReference"
                      @open-select-modal="openSelectAssetModal"
                      @remove-multi-param-asset-reference="removeMultiParamAssetReference"
                      @remove-reference-audio="removeReferenceAudioAt"
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
                        :show-audio="videoConfigShowAudio"
                        :duration-tip="videoDurationTip"
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
                            @toggle="
                              multiParamVideoModelDropdownExpanded =
                                !multiParamVideoModelDropdownExpanded
                            "
                            @close="multiParamVideoModelDropdownExpanded = false"
                            @select="handleSelectMultiParamVideoModel"
                          />
                        </template>
                      </GenerateModelConfigBlock>
                    </StoryboardGeneratePanel>
                  </div>

                  <div
                    v-else-if="leftActiveTab === 'startEndFrame'"
                    class="video-left-content create-modal-tab-panel"
                  >
                    <StoryboardGeneratePanel
                      ref="edgeVideoPanelRef"
                      mode="edgeVideo"
                      :use-precise-layout="false"
                      :show-script-file-header="false"
                      :show-generate-prompt-button="false"
                      v-model:prompt="edgeVideoPrompt"
                      :prompt-placeholder="'描述你想要生成的画面内容和动作,如:一个穿着红色裙子的小女孩在草地上奔跑'"
                      v-model:is-setting-expanded="isEdgeVideoSettingExpanded"
                      :reference-audios="referenceAudios"
                      :scene-images="[]"
                      :character-images="[]"
                      :prop-images="[]"
                      :other-images="[]"
                      @remove-reference-audio="removeReferenceAudioAt"
                      @copy-prompt="copyEdgeVideoPrompt"
                    >
                      <template #prompt-prefix>
                        <div class="edge-frame-strip">
                          <div class="edge-frame-card">
                            <div
                              class="edge-frame-thumb"
                              role="button"
                              tabindex="0"
                              @click="onEdgeFrameCardClick('first')"
                              @keydown.enter.prevent="onEdgeFrameCardClick('first')"
                            >
                              <ShimmerImage
                                v-if="firstFrameImage?.url || firstFrameImage?.thumbnail"
                                :src="firstFrameImage.url || firstFrameImage.thumbnail"
                                alt="首帧"
                                img-class="edge-frame-thumb__media"
                                object-fit="cover"
                                reveal-direction="fade"
                              />
                              <div v-else class="edge-frame-placeholder">
                                <PlusOutlined />
                                <span>上传首帧</span>
                              </div>
                              <button
                                v-if="firstFrameImage?.url || firstFrameImage?.thumbnail"
                                type="button"
                                class="edge-frame-remove"
                                aria-label="删除首帧"
                                @click.stop="clearEdgeFrame('first')"
                              >
                                <CloseOutlined />
                              </button>
                            </div>
                          </div>
                          <button
                            v-if="showEdgeFrameSwap"
                            type="button"
                            class="edge-frame-swap"
                            aria-label="交换首尾帧"
                            @click.stop="swapEdgeFrames"
                          >
                            <SwapOutlined />
                          </button>
                          <div class="edge-frame-card">
                            <div
                              class="edge-frame-thumb"
                              role="button"
                              tabindex="0"
                              @click="onEdgeFrameCardClick('last')"
                              @keydown.enter.prevent="onEdgeFrameCardClick('last')"
                            >
                              <ShimmerImage
                                v-if="lastFrameImage?.url || lastFrameImage?.thumbnail"
                                :src="lastFrameImage.url || lastFrameImage.thumbnail"
                                alt="尾帧"
                                img-class="edge-frame-thumb__media"
                                object-fit="cover"
                                reveal-direction="fade"
                              />
                              <div v-else class="edge-frame-placeholder">
                                <PlusOutlined />
                                <span>上传尾帧</span>
                              </div>
                              <button
                                v-if="lastFrameImage?.url || lastFrameImage?.thumbnail"
                                type="button"
                                class="edge-frame-remove"
                                aria-label="删除尾帧"
                                @click.stop="clearEdgeFrame('last')"
                              >
                                <CloseOutlined />
                              </button>
                            </div>
                          </div>
                        </div>
                      </template>
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
                        :show-audio="videoConfigShowAudio"
                        :duration-tip="videoDurationTip"
                        :video-aspect-ratio-options="videoAspectRatioOptions"
                        :video-duration-options="videoDurationOptions"
                        :video-count-options="videoCountOptions"
                        :video-quality-options="videoQualityOptions"
                        :video-audio-options="videoAudioOptions"
                        :select-popup-class-name="'video-modal-select-dropdown'"
                      >
                        <template #model>
                          <ModelSelectDropdown
                            :key="`edge-model-${edgeVideoModel}-${edgeVideoModelOptions.length}`"
                            :value="selectedEdgeVideoModel"
                            :options="edgeVideoModelOptions"
                            :expanded="edgeVideoModelDropdownExpanded"
                            @toggle="
                              edgeVideoModelDropdownExpanded = !edgeVideoModelDropdownExpanded
                            "
                            @close="edgeVideoModelDropdownExpanded = false"
                            @select="handleSelectEdgeVideoModel"
                          />
                        </template>
                      </GenerateModelConfigBlock>
                    </StoryboardGeneratePanel>
                  </div>

                  <div v-else class="video-left-content">
                    <div class="tab-placeholder">
                      <p>请选择视频生成方式</p>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="
                  isPrimaryVideoTab ||
                  leftActiveTab === 'multiParam' ||
                  leftActiveTab === 'startEndFrame'
                "
                class="video-config-footer"
              >
                <a-button
                  v-if="isPrimaryVideoTab"
                  type="primary"
                  block
                  size="large"
                  class="generate-btn"
                  :loading="
                    isGridVideoTab ? showGridVideoGenerateLoading : showImageToVideoGenerateLoading
                  "
                  :disabled="
                    (isGridVideoTab
                      ? showGridVideoGenerateLoading
                      : showImageToVideoGenerateLoading) || showGeneratingVideoPromptForScene
                  "
                  @click="
                    isGridVideoTab
                      ? handleGridVideoStartGenerate()
                      : handleImageToVideoStartGenerate()
                  "
                >
                  <template #icon>
                    <img src="@/assets/img/icon/star_white.svg" alt="" />
                  </template>
                  开始生成视频
                </a-button>
                <a-button
                  v-else-if="leftActiveTab === 'multiParam'"
                  type="primary"
                  block
                  size="large"
                  class="generate-btn"
                  :loading="showMultiParamGenerateLoading"
                  :disabled="showMultiParamGenerateLoading"
                  @click="handleMultiParamStartGenerate"
                >
                  <template #icon>
                    <img src="@/assets/img/icon/star_white.svg" alt="" />
                  </template>
                  开始生成视频
                </a-button>
                <a-button
                  v-else
                  type="primary"
                  block
                  size="large"
                  class="generate-btn"
                  :loading="showEdgeVideoGenerateLoading"
                  :disabled="showEdgeVideoGenerateLoading"
                  @click="handleEdgeVideoStartGenerate"
                >
                  <template #icon>
                    <img src="@/assets/img/icon/star_white.svg" alt="" />
                  </template>
                  开始生成视频
                </a-button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <!-- 首尾帧生视频：首帧/尾帧图片选择 -->
    <SelectAssetImageModal
      v-model:open="selectEdgeFrameModalOpen"
      type="reference"
      enable-voice-tab
      :video-model="activeVideoRawModel"
      :project-id="Number(creationStore.currentProjectId) || 0"
      :episode-id="Number(creationStore.currentEpisodeId) || 0"
      :step-tab-name="referenceStepTabName"
      :step-panel-images="currentPanelStoryboardImages"
      :storyboard-script-groups="storyboardScriptAssetGroups"
      @confirm="onSelectEdgeFrameConfirm"
    />
    <!-- 图生视频：导入参考图弹窗 -->
    <SelectAssetImageModal
      v-model:open="selectReferenceModalOpen"
      type="reference"
      enable-voice-tab
      :video-model="activeVideoRawModel"
      :project-id="Number(creationStore.currentProjectId) || 0"
      :episode-id="Number(creationStore.currentEpisodeId) || 0"
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
      enable-voice-tab
      :video-model="activeVideoRawModel"
      :project-id="Number(creationStore.currentProjectId) || 0"
      :episode-id="Number(creationStore.currentEpisodeId) || 0"
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
import { ref, computed, watch, nextTick, defineAsyncComponent } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  captureCreationLiveGenScope,
  matchesCreationLiveGenScope
} from '~/composables/useCreationLiveGenScopeGuard'
import { openImagePreviewModal } from '~/utils/openImagePreviewModal'
import { resolveSafeHttpUrl } from '~/utils/safeNavigation'
import {
  ArrowLeftOutlined,
  UploadOutlined,
  FolderOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  VideoCameraOutlined,
  CheckOutlined,
  CheckCircleFilled,
  FullscreenOutlined,
  DownloadOutlined,
  LoadingOutlined,
  PlusOutlined,
  CloseOutlined,
  SwapOutlined
} from '@ant-design/icons-vue'
import {
  buildModalTaskOverlayKey,
  matchesModalTaskOverlayKey
} from '~/composables/useModalTaskScope'
import HorizontalScrollTabBar from '~/components/common/HorizontalScrollTabBar.vue'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import ShimmerVideo from '~/components/common/ShimmerVideo.vue'
import { useVideoPlaybackSpaceShortcut } from '~/composables/useVideoPlaybackSpaceShortcut'
import HistoryRecordWrap from '~/components/common/HistoryRecordWrap.vue'
import EllipsisTooltip from '~/components/common/EllipsisTooltip.vue'
import StoryboardGeneratePanel from './StoryboardGeneratePanel.vue'
import type { ParamSettingsConfirmPayload } from './StoryboardParamSettingsModal.vue'
import StoryboardScriptModal from './StoryboardScriptModal.vue'
import { uploadVideoToOssWithToast } from '~/utils/ossUpload'
import ImportScriptModal from './ImportScriptModal.vue'
import GenerateModelConfigBlock from './GenerateModelConfigBlock.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import {
  userStoryboardGenerateVideoPrompt,
  userStoryboardGenerateVideoPromptImage,
  userStoryboardGenerateVideoPromptGrid,
  userStoryboardRecordDelete,
  userStoryboardSetFinalVideo,
  userStoryboardUnSetFinalVideo,
  userStoryboardUpload,
  userReferenceAudioDelete,
  aidAgentList,
  userModelListByFuncCodes
} from '~/utils/businessApi'
import {
  fetchStoryboardRecordsForStoryboard,
  clearProjectStoryboardRecordCache
} from '~/utils/storyboardRecordBatch'
import { mergeVideoBatchSuccessItemsIntoVideos } from '~/utils/storyboardVideoSseFill'
import { fetchUserStoryboardDetailOnce } from '~/utils/storyboardDetailOnce'
import { useStoryboardModalHeaderTabs } from '~/composables/useStoryboardModalHeaderTabs'
import {
  resolveStoryboardVideoRecordId,
  resolveStoryboardVideoRecordIdFromRows
} from '~/utils/storyboardFinalRecordId'
import {
  isOriginalStoryboardVideoRecord,
  resolveStoryboardRecordDisplayName,
  resolveStoryboardVideoSourceLabel
} from '~/utils/storyboardRecordRow'
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
  validateGridVideoPromptPlain,
  validateMultiParamVideoPromptPlain,
  validateEdgeVideoPromptPlain
} from '~/utils/storyboardVideoPromptSave'
import { useModelList } from '~/composables/useModelList'
import { mapUserModelListItemToModelOption } from '~/utils/userModelOption'
import {
  canSwitchModelWithReferenceAudio,
  MODEL_NO_REF_AUDIO_TIP,
  parseReferenceAudioCapability
} from '~/utils/referenceAudioCapability'
import { collectReferenceAudioIds, type ReferenceMediaItem } from '~/utils/referenceMediaItem'
import {
  buildGenerateReferenceAudioFields,
  mergeReferenceAudioLists,
  removeAudioFromPromptAndList,
  splitReferenceConfirmItems,
  syncAudioPlaceholdersIntoPrompt
} from '~/utils/storyboardVideoReferenceAudioWire'
import { useVideoModelGenerateSettings } from '~/composables/useVideoModelGenerateSettings'
import {
  buildRecommendedDurationTipText,
  readRecommendedDurationSeconds,
  resolveVideoDurationOption
} from '~/utils/resolveVideoDurationOption'
import {
  filterAspectRatiosForVideoModal,
  PROMPT_TYPE,
  usePromptDictionary
} from '~/composables/usePromptDictionary'
import {
  followStoryboardVideoGenerateTask,
  isStoryboardVideoTaskOngoing,
  runStoryboardImageVideoGenerateTask,
  runStoryboardMultiVideoGenerateTask,
  runStoryboardEdgeVideoGenerateTask,
  runStoryboardGridVideoGenerateTask
} from '~/composables/useStoryboardVideoGenerateTask'
import {
  isStoryboardVideoModalRestoreFollowing,
  activeStoryboardVideoModalOwnedFollowIds
} from '~/composables/useStoryboardVideoBatchGenerate'
import {
  applyCreationStoreScopeLiveGenFromRoute,
  findStoryboardVideoGenTaskInScopes,
  waitForCreationStoreHydrated
} from '~/composables/useCreationStoreHydration'
import { suspendTaskSseFollow } from '~/composables/useTaskSseFollow'
import { listModalTabFollowsToSuspend } from '~/utils/modalTabSseMutex'
import { useCreateFlowScopeChangedResume } from '~/composables/useCreateFlowLiveGenResume'
import {
  modalGenSessionScopeFromScopeKey,
  modalGenSessionScopeFromStore
} from '~/utils/modalGenSessionScope'
import { formatTaskSseLiveText } from '~/utils/taskSseProgressText'
import {
  clearStoryboardVideoModalGenSession,
  markStoryboardVideoModalUserDismissed,
  persistStoryboardVideoModalGenSession,
  clearStoryboardVideoModalUserDismissed,
  readStoryboardVideoModalGenSession,
  isStoryboardVideoModalUserDismissed
} from '~/utils/storyboardVideoModalGenSession'
import { resolveOngoingTaskId } from '~/utils/modalGenTaskRestore'
import { AI_MODEL_FUNC_CODE } from '~/utils/aiModelFuncCodes'
import { buildAidAgentListScopeParams } from '~/utils/createFlowProjectContext'
import {
  modelsFromListByFuncGroups,
  pickFirstNonEmptyModelPool
} from '~/utils/modelListByFuncBatch'
import {
  clearAgentDefaultModelCache,
  resolveAgentModelCodeInGroup,
  resolvePreferredModelIdFromAgentCodes,
  resolveSelectedModelOption,
  resolveStoryboardVideoPromptSubmitAgentCode,
  STORYBOARD_VIDEO_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_GRID_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_IMAGE_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_PROMPT_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_PROMPT_GRID_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_PROMPT_IMAGE_AGENT_BIZ_CATEGORY
} from '~/utils/extractAgentBiz'
import { buildStoryboardVideoResolutionField } from '~/utils/storyboardVideoGenerateParams'
import { resolveGenerateAudioFlag } from '~/utils/modelCapability'
import { useCreationStore } from '~/stores/creation'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  isStoryboardVideoTabVisible,
  resolvePrimaryStoryboardVideoTab,
  resolveStoryboardVideoAgentBizCategories,
  resolveStoryboardVideoModelFuncCodes,
  showStoryboardGridVideoTab,
  showStoryboardImageToVideoTab,
  showStoryboardMultiParamVideoTab,
  type StoryboardVideoModalTabKey
} from '~/utils/creationModeUiRules'
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
import { resolveStoryboardPanelCoverImage } from '~/utils/storyboardImageCover'
import {
  storyboardPromptHtmlToPlain,
  storyboardPromptPlainToHtml,
  storyboardPromptMarkdownPlainToHtml,
  collectStoryboardPromptAssets,
  patchEmptyResolvedPromptAssets,
  mergePromptAssets,
  buildStoryboardVideoReferenceOverrides,
  mergeReferenceImageItems,
  splitResolvedPromptAssetsToReferenceBuckets,
  promptAssetToReferenceImageItem,
  isEmptyPromptAssetUrl,
  type PromptAssetItem
} from '~/utils/storyboardPromptAssetRef'
import {
  prependDefaultReferenceImageToPlainPrompt,
  promptPlainHasAssetPlaceholders
} from '~/utils/storyboardPromptDefaultRefInject'
import { scriptApiTextToEditorHtml, looksLikeMarkdown } from '~/utils/htmlPlain'
import deleteIcon from '@/assets/img/icon/del-black.svg'
import dialogSelectSelIcon from '@/assets/img/icon/dialog-select-sel.svg'

/** 子弹窗异步拆分：不阻塞编辑弹窗本体首帧渲染 */
const SelectAssetImageModal = defineAsyncComponent(() => import('./SelectAssetImageModal.vue'))

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

const { headerTabs, refreshHeaderTabs } = useStoryboardModalHeaderTabs({
  open: () => props.open,
  recordType: 'video',
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
    // 顶部 Tab 优先走分镜图封面；不要回落 mp4，否则会并发拉视频导致弹窗卡顿
    resolveFallbackThumbnailUrl: (sceneIndex) => resolveSceneCoverImageUrl(sceneIndex)
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
    thumbnailUrl: resolveSceneCoverImageUrl(sceneIndex),
    hasFinalAsset: !!getFirstVideo(sceneIndex)?.url
  }))
})

const projectCreationMode = computed(
  () => creationStore.formData.globalSetting?.creationMode || 'i2v'
)

const showImageToVideoTab = computed(() => showStoryboardImageToVideoTab(projectCreationMode.value))
const showMultiParamTab = computed(() =>
  showStoryboardMultiParamVideoTab(projectCreationMode.value)
)
const showGridVideoTab = computed(() => showStoryboardGridVideoTab(projectCreationMode.value))
const showStartEndFrameTab = computed(() => true)

const visibleVideoTabCount = computed(
  () =>
    Number(showImageToVideoTab.value) +
    Number(showMultiParamTab.value) +
    Number(showGridVideoTab.value) +
    Number(showStartEndFrameTab.value)
)

const videoTabBarClass = computed(() =>
  visibleVideoTabCount.value <= 2 ? 'config-tabs--two' : 'config-tabs--three'
)

function syncLeftActiveTabForCreationMode(preferPrimary = false) {
  const current = leftActiveTab.value
  if (!preferPrimary && isStoryboardVideoTabVisible(current, projectCreationMode.value)) {
    return
  }
  leftActiveTab.value = resolvePrimaryStoryboardVideoTab(projectCreationMode.value)
}

const currentSceneIndex = ref(props.sceneIndex)

function resolveStoryboardIdForSceneIndex(sceneIdx: number): string {
  const raw = props.scenes[sceneIdx]?.storyboardId
  const id = Number(raw)
  if (Number.isFinite(id) && id > 0) return String(id)
  return `idx-${sceneIdx}`
}

function storyboardVideoModalSessionScope() {
  return modalGenSessionScopeFromStore(creationStore)
}

/** 提交响应晚于项目切换时，任务仍归提交作用域，并在 SSE owner 建立后立即挂起。 */
function suspendLateModalVideoFollowIfScopeChanged(
  taskId: number,
  taskScope: ReturnType<typeof captureCreationLiveGenScope>
) {
  if (!import.meta.client) return
  queueMicrotask(() => {
    if (!matchesCreationLiveGenScope(taskScope)) suspendTaskSseFollow(taskId)
  })
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
let resumeStoryboardVideoPromptFollowGen = 0
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
const showEdgeVideoGenerateLoading = computed(() =>
  matchesModalTaskOverlayKey(
    videoGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, 'edge')
  )
)
const showGridVideoGenerateLoading = computed(() =>
  matchesModalTaskOverlayKey(
    videoGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, 'grid')
  )
)

const videoGenerateProgressText = ref('分镜视频提交中…')
const videoCanvasBodyRef = ref<HTMLElement | null>(null)

const videoGenerateOverlayLabel = computed(() => videoGenerateProgressText.value)

function resolveGeneratingVideoIndex(): number {
  const list = currentSceneVideos.value
  const pendingIdx = list.findIndex((item) => item?._generating)
  if (pendingIdx >= 0) return pendingIdx
  if (!isSceneVideoGenerating(currentSceneIndex.value)) return -1
  const localIdx = list.findIndex((item) => item?._localGeneratingPlaceholder)
  if (localIdx >= 0) return localIdx
  return list.length > 0 ? list.length - 1 : -1
}

function isVideoCanvasItemGenerating(videoIndex: number): boolean {
  const v = currentSceneVideos.value[videoIndex]
  if (!isSceneVideoGenerating(currentSceneIndex.value)) return false
  if (v?._generating) return true
  const genIdx = resolveGeneratingVideoIndex()
  return genIdx >= 0 && videoIndex === genIdx
}

function scrollVideoCanvasToIndex(sceneIdx: number, index: number) {
  if (sceneIdx !== currentSceneIndex.value || index < 0) return
  nextTick(() => {
    nextTick(() => {
      const body = videoCanvasBodyRef.value
      if (!body) return
      const cards = body.querySelectorAll('.video-card')
      const target = cards[index] as HTMLElement | undefined
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        return
      }
      body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' })
    })
  })
}

function sceneStoryboardIdNum(sceneIdx: number): number | null {
  const raw = props.scenes[sceneIdx]?.storyboardId
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

function defaultVideoProgressTextForTaskKind(taskKind?: string): string {
  if (taskKind === 'multi') return '多参视频生成中…'
  if (taskKind === 'edge') return '首尾帧视频生成中…'
  if (taskKind === 'grid') return '宫格视频生成中…'
  return '图生视频生成中…'
}

function normalizeModalVideoGenTaskKind(raw: unknown): 'i2v' | 'multi' | 'edge' | 'grid' {
  const k = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (k === 'multi') return 'multi'
  if (k === 'edge') return 'edge'
  if (k === 'grid') return 'grid'
  return 'i2v'
}

function readSessionForScene(sceneIdx: number) {
  const session = readStoryboardVideoModalGenSession(storyboardVideoModalSessionScope())
  if (!session) return null
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid != null && session.storyboardId === sid) return session
  if (session.sceneIdx === sceneIdx) return session
  return null
}

function resolveModalVideoGenOwnerSceneIdx(storyboardId: number): number | null {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return null

  const task = findStoryboardVideoGenTaskInScopes(creationStore, sid, route)
  const session = readStoryboardVideoModalGenSession(storyboardVideoModalSessionScope())
  const sessionActive =
    session?.storyboardId === sid &&
    !isStoryboardVideoModalUserDismissed(sid, storyboardVideoModalSessionScope()) &&
    (session.taskId != null || session.taskKind != null)
  const hasActiveGen =
    activeStoryboardVideoModalOwnedFollowIds.has(sid) ||
    isStoryboardVideoModalRestoreFollowing(sid) ||
    !!task ||
    sessionActive
  if (!hasActiveGen) return null

  if (task?.sceneIdx != null && Number.isFinite(task.sceneIdx)) {
    return task.sceneIdx
  }
  if (session?.storyboardId === sid && Number.isFinite(session.sceneIdx)) {
    return session.sceneIdx
  }
  const idx = props.scenes.findIndex((s) => Number(s?.storyboardId) === sid)
  return idx >= 0 ? idx : null
}

function isModalVideoGenOwnerScene(sceneIdx: number): boolean {
  const session = readSessionForScene(sceneIdx)
  if (session?.storyboardId != null) {
    return resolveModalVideoGenOwnerSceneIdx(session.storyboardId) === sceneIdx
  }
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null) return false
  return resolveModalVideoGenOwnerSceneIdx(sid) === sceneIdx
}

function shouldRestoreStoryboardVideoGenerate(sceneIdx: number): boolean {
  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null) return false
  if (isStoryboardVideoPromptGeneratingForScene(sceneIdx)) return false
  return isModalVideoGenOwnerScene(sceneIdx)
}

function resolveVideoGenTaskSnapshotForStoryboard(storyboardId: number, sceneIdx: number) {
  const persisted = findStoryboardVideoGenTaskInScopes(creationStore, storyboardId, route)
  const session = readSessionForScene(sceneIdx)
  const sessionMatches =
    session?.storyboardId === storyboardId &&
    !isStoryboardVideoModalUserDismissed(storyboardId, storyboardVideoModalSessionScope())
  const sessionTaskId =
    sessionMatches && session?.taskId != null && Number(session.taskId) > 0
      ? Number(session.taskId)
      : null
  const sessionTaskKind =
    sessionMatches &&
    session?.taskKind &&
    session.taskKind !== 'video-prompt-gen' &&
    session.taskKind !== 'multi-video-prompt-gen'
      ? normalizeModalVideoGenTaskKind(session.taskKind)
      : null
  return {
    persisted,
    taskId: persisted?.taskId ?? sessionTaskId ?? null,
    taskKind: persisted?.taskKind ?? sessionTaskKind ?? ('i2v' as const)
  }
}

function hasStoryboardVideoPendingState(storyboardId: number): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  if (activeStoryboardVideoModalOwnedFollowIds.has(sid)) return true
  if (isStoryboardVideoModalRestoreFollowing(sid)) return true
  return !!findStoryboardVideoGenTaskInScopes(creationStore, sid, route)
}

/** 弹窗内跟进已完成并 refresh 过的分镜，避免 global-tasks-updated 再打 list */
const modalOwnedVideoRecordsRefreshedIds = new Set<number>()

function isStoryboardVideoGenerationInProgress(storyboardId: number | null | undefined): boolean {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return false
  return hasStoryboardVideoPendingState(sid)
}

function removeLocalGeneratingPlaceholders(videos: any[]): any[] {
  return videos.filter((v) => !v?._localGeneratingPlaceholder)
}

function ensureGeneratingPlaceholderVideo(sceneIdx: number) {
  const videos = [...(props.scenes[sceneIdx]?.videos || [])]
  const pendingIdx = videos.findIndex((v) => v?._generating || v?._localGeneratingPlaceholder)
  if (pendingIdx >= 0) {
    if (sceneIdx === currentSceneIndex.value) {
      selectedVideoIdx.value = pendingIdx
      scrollVideoCanvasToIndex(sceneIdx, pendingIdx)
    }
    return
  }
  const newIdx = videos.length
  videos.push({
    id: `local-generating-${sceneStoryboardIdNum(sceneIdx) ?? sceneIdx}-${Date.now()}`,
    url: '',
    title: '分镜视频',
    source: '生成记录',
    _generating: true,
    _localGeneratingPlaceholder: true
  })
  emit('update', sceneIdx, { videos })
  if (sceneIdx === currentSceneIndex.value) {
    selectedVideoIdx.value = newIdx
    scrollVideoCanvasToIndex(sceneIdx, newIdx)
  }
}

function clearLocalGeneratingPlaceholdersForScene(sceneIdx: number) {
  const videos = props.scenes[sceneIdx]?.videos || []
  const next = removeLocalGeneratingPlaceholders(videos)
  if (next.length !== videos.length) {
    emit('update', sceneIdx, { videos: next })
    if (sceneIdx === currentSceneIndex.value && selectedVideoIdx.value >= next.length) {
      selectedVideoIdx.value = Math.max(0, next.length - 1)
    }
  }
}

/** 拉取服务端记录后，若任务仍在进行则保留/补回本地 generating 占位，避免有视频时刷新丢失 loading */
function finalizeMappedVideosWhileGenerating(sceneIdx: number, mapped: any[]): any[] {
  let next = removeLocalGeneratingPlaceholders(mapped)
  if (next.some((m) => m?._generating)) {
    return next
  }

  const sid = sceneStoryboardIdNum(sceneIdx)
  if (sid == null) return next

  const stillGenerating = isStoryboardVideoGenerationInProgress(sid)
  if (!stillGenerating) return next

  return [
    ...next,
    {
      id: `local-generating-${sid}-${Date.now()}`,
      url: '',
      title: '分镜视频',
      source: '生成记录',
      _generating: true,
      _localGeneratingPlaceholder: true
    }
  ]
}

function clearModalStoryboardVideoLoadingUi(
  storyboardId: number,
  sceneIdx: number,
  taskKind?: 'i2v' | 'multi' | 'edge' | 'grid'
) {
  const sid = Number(storyboardId)
  if (!Number.isFinite(sid) || sid <= 0) return

  creationStore.clearStoryboardVideoGenTask(sid)
  activeStoryboardVideoModalOwnedFollowIds.delete(sid)
  clearStoryboardVideoModalGenSession(storyboardVideoModalSessionScope())
  clearVideoGenerateOverlayForScene(sceneIdx, taskKind)
  clearLocalGeneratingPlaceholdersForScene(sceneIdx)
}

/** 同步恢复弹窗内生视频 loading UI（不等待 API），避免刷新后打开弹窗时按钮/画布无 loading */
function primeStoryboardVideoLoadingUi(sceneIdx: number) {
  const storyboardId = sceneStoryboardIdNum(sceneIdx)
  if (storyboardId == null) return

  const task = findStoryboardVideoGenTaskInScopes(creationStore, storyboardId, route)
  const isFollowing =
    activeStoryboardVideoModalOwnedFollowIds.has(storyboardId) ||
    isStoryboardVideoModalRestoreFollowing(storyboardId)
  const overlayActive =
    matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, 'i2v')) ||
    matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, 'multi')) ||
    matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, 'edge')) ||
    matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, 'grid'))

  if (!task && !isFollowing && !overlayActive) return

  const taskKind = task?.taskKind ?? 'i2v'
  videoGenerateTargetKey.value = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, taskKind))
  const live = formatTaskSseLiveText(task || {}, '')
  videoGenerateProgressText.value = live || defaultVideoProgressTextForTaskKind(taskKind)

  const hasGeneratingRow = (props.scenes[sceneIdx]?.videos || []).some(
    (v) => v?._generating || v?._localGeneratingPlaceholder
  )
  if (!hasGeneratingRow) {
    ensureGeneratingPlaceholderVideo(sceneIdx)
  } else if (sceneIdx === currentSceneIndex.value) {
    const genIdx = (props.scenes[sceneIdx]?.videos || []).findIndex(
      (v) => v?._generating || v?._localGeneratingPlaceholder
    )
    if (genIdx >= 0) {
      selectedVideoIdx.value = genIdx
      scrollVideoCanvasToIndex(sceneIdx, genIdx)
    }
  }
}

/** 为所有进行中的分镜补占位 loading，当前分镜同步 overlay / 按钮态 */
function ensurePendingStoryboardVideoLoadingPlaceholders(focusSceneIdx: number) {
  props.scenes.forEach((_, idx) => {
    const storyboardId = sceneStoryboardIdNum(idx)
    if (storyboardId == null || !hasStoryboardVideoPendingState(storyboardId)) {
      clearLocalGeneratingPlaceholdersForScene(idx)
      return
    }
    if (!isModalVideoGenOwnerScene(idx)) {
      clearLocalGeneratingPlaceholdersForScene(idx)
      return
    }
    if (idx === focusSceneIdx) return
    const hasGeneratingRow = (props.scenes[idx]?.videos || []).some(
      (v) => v?._generating || v?._localGeneratingPlaceholder
    )
    if (!hasGeneratingRow) ensureGeneratingPlaceholderVideo(idx)
  })
  if (isModalVideoGenOwnerScene(focusSceneIdx)) {
    primeStoryboardVideoLoadingUi(focusSceneIdx)
  }
}

/** 等待 Pinia 持久化恢复后，同步还原弹窗内 loading 状态 */
async function ensureModalVideoLoadingRestored(sceneIdx: number) {
  await waitForCreationStoreHydrated(creationStore, route)
  applyCreationStoreScopeLiveGenFromRoute(creationStore, route)
  ensurePendingStoryboardVideoLoadingPlaceholders(sceneIdx)
}

function isHistoryVideoMain(videoIndex: number): boolean {
  return !!currentSceneVideos.value[videoIndex]?.isStoryboardVideo
}

function canSetMainFromHistory(videoIndex: number): boolean {
  const video = currentSceneVideos.value[videoIndex]
  if (!video?.url || isHistoryVideoItemGenerating(videoIndex) || isHistoryVideoMain(videoIndex)) {
    return false
  }
  return true
}

async function handleSetMainFromHistory(videoIndex: number) {
  selectedVideoIdx.value = videoIndex
  await setAsStoryboardVideo(videoIndex)
}

function isHistoryVideoItemGenerating(videoIndex: number): boolean {
  return isVideoCanvasItemGenerating(videoIndex)
}

function isSceneVideoGenerating(sceneIdx: number): boolean {
  if (
    matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, 'i2v')) ||
    matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, 'multi')) ||
    matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, 'edge')) ||
    matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, 'grid'))
  ) {
    return true
  }
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (Number.isFinite(storyboardId) && storyboardId > 0) {
    if (hasStoryboardVideoPendingState(storyboardId)) {
      return isModalVideoGenOwnerScene(sceneIdx)
    }
  }
  const videos = props.scenes[sceneIdx]?.videos || []
  if (!videos.some((v: { _generating?: boolean }) => !!v._generating)) return false
  return Number.isFinite(storyboardId) && storyboardId > 0 && isModalVideoGenOwnerScene(sceneIdx)
}

const viewMode = ref<'list' | 'card'>('list')
const leftActiveTab = ref<StoryboardVideoModalTabKey>('imageToVideo')

const isGridVideoTab = computed(() => leftActiveTab.value === 'gridVideo')
const isImageToVideoTab = computed(() => leftActiveTab.value === 'imageToVideo')
const isPrimaryVideoTab = computed(() => isImageToVideoTab.value || isGridVideoTab.value)

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
  message.success('分镜脚本已同步到分镜设计步骤')
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
    const mapped = rows.filter((r) => String(r?.fileUrl ?? '').trim()).map(mapRecordRowToImageItem)
    stepPanelImagesCache.value = { ...stepPanelImagesCache.value, [sceneIdx]: mapped }
  } catch {
    stepPanelImagesCache.value = { ...stepPanelImagesCache.value, [sceneIdx]: [] }
  }
}

function mapRecordRowToVideoItem(r: StoryboardRecordRow): any {
  const url = (r.fileUrl || '').trim()
  const label = resolveStoryboardRecordDisplayName(r) || '分镜视频'
  return {
    id: String(r.id ?? ''),
    url,
    title: label,
    source: resolveStoryboardVideoSourceLabel({ _fromServer: true, _serverRow: r }),
    importDate: r.createTime || undefined,
    isStoryboardVideo: r.isSelected === 1 && isOriginalStoryboardVideoRecord(r),
    _generating: isPendingStoryboardRecord(r),
    _fromServer: true,
    _serverRow: r
  }
}

async function fetchProjectRecordsForStoryboard(
  storyboardId: number,
  type: 'image' | 'video',
  options?: { force?: boolean }
): Promise<StoryboardRecordRow[]> {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return []
  const rows = await fetchStoryboardRecordsForStoryboard(ctx, storyboardId, type, options)
  if (type === 'video') {
    return rows.filter((r) => isOriginalStoryboardVideoRecord(r))
  }
  return rows
}

function isSameVideoRecordList(a: any[] | undefined, b: any[] | undefined): boolean {
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

async function refreshVideoRecords(
  sceneIdx: number,
  options?: { focusLatest?: boolean; force?: boolean }
) {
  const raw = props.scenes[sceneIdx]?.storyboardId
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const rows = await fetchProjectRecordsForStoryboard(id, 'video', { force: options?.force })
    const mapped = finalizeMappedVideosWhileGenerating(
      sceneIdx,
      rows
        .filter((r) => !!String(r?.fileUrl ?? '').trim() || isPendingStoryboardRecord(r))
        .map(mapRecordRowToVideoItem)
    )
    const prevVideos = props.scenes[sceneIdx]?.videos
    if (isSameVideoRecordList(mapped, prevVideos)) {
      if (sceneIdx !== currentSceneIndex.value) return
      if (options?.focusLatest && mapped.length > 0) {
        const latestIdx = mapped.length - 1
        if (selectedVideoIdx.value !== latestIdx) {
          selectedVideoIdx.value = latestIdx
          scrollVideoCanvasToIndex(sceneIdx, latestIdx)
        }
      }
      return
    }
    emit('update', sceneIdx, { videos: mapped })

    if (sceneIdx !== currentSceneIndex.value) return

    const pendingIdx = mapped.findIndex((m) => m._generating)
    if (pendingIdx >= 0) {
      selectedVideoIdx.value = pendingIdx
      scrollVideoCanvasToIndex(sceneIdx, pendingIdx)
      return
    }

    if (options?.focusLatest && mapped.length > 0) {
      const latestIdx = mapped.length - 1
      selectedVideoIdx.value = latestIdx
      scrollVideoCanvasToIndex(sceneIdx, latestIdx)
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '获取生成记录失败')
  }
}

/** 生成/删除等写操作后：清缓存并强制重拉；同场景并发调用合并为一次请求 */
let refreshVideoRecordsFreshInflight: Promise<void> | null = null
let refreshVideoRecordsFreshInflightSceneIdx = -1
let refreshVideoRecordsFreshWantFocusLatest = false

async function refreshVideoRecordsFresh(sceneIdx: number, options?: { focusLatest?: boolean }) {
  if (options?.focusLatest) refreshVideoRecordsFreshWantFocusLatest = true

  if (refreshVideoRecordsFreshInflight && refreshVideoRecordsFreshInflightSceneIdx === sceneIdx) {
    await refreshVideoRecordsFreshInflight
    return
  }

  refreshVideoRecordsFreshInflightSceneIdx = sceneIdx
  refreshVideoRecordsFreshInflight = (async () => {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (ctx) clearProjectStoryboardRecordCache(ctx)
    await refreshVideoRecords(sceneIdx, {
      focusLatest: refreshVideoRecordsFreshWantFocusLatest,
      force: true
    })
  })().finally(() => {
    refreshVideoRecordsFreshInflight = null
    refreshVideoRecordsFreshInflightSceneIdx = -1
    refreshVideoRecordsFreshWantFocusLatest = false
  })

  await refreshVideoRecordsFreshInflight
}

/** 用 SSE complete 的 items 合并进当前分镜 videos（列表刷新后的兜底回填） */
function applyTerminalVideoItemsToScene(sceneIdx: number, data: unknown) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return
  const title = String(props.scenes[sceneIdx]?.name || '').trim() || '分镜视频'
  const merged = mergeVideoBatchSuccessItemsIntoVideos(
    props.scenes[sceneIdx]?.videos,
    storyboardId,
    data,
    { title }
  )
  if (!merged.changed) return
  emit('update', sceneIdx, { videos: merged.videos })
  if (sceneIdx !== currentSceneIndex.value) return
  if (merged.focusIndex != null && merged.focusIndex >= 0) {
    selectedVideoIdx.value = merged.focusIndex
    scrollVideoCanvasToIndex(sceneIdx, merged.focusIndex)
  }
}

async function runStoryboardVideoGenerateForScene(
  sceneIdx: number,
  opts: {
    taskKind: 'i2v' | 'multi' | 'edge' | 'grid'
    submitImageVideoBody?: Parameters<typeof runStoryboardImageVideoGenerateTask>[0]['body']
    submitMultiBody?: Parameters<typeof runStoryboardMultiVideoGenerateTask>[0]['body']
    submitEdgeBody?: Parameters<typeof runStoryboardEdgeVideoGenerateTask>[0]['body']
    submitGridBody?: Parameters<typeof runStoryboardGridVideoGenerateTask>[0]['body']
    resumeTaskId?: number
    progressSubmit?: string
    progressRunning?: string
    silentComplete?: boolean
  }
) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return

  /**
   * 剧集隔离：任务归属于启动时的作品/集（scope 快照）。
   * 任务快照始终写回该快照 scope 桶；切集后终态收尾不得写当前集扁平 store、不得 toast。
   */
  const taskScope = captureCreationLiveGenScope()
  const taskSessionScope = modalGenSessionScopeFromScopeKey(taskScope.scopeKey)

  persistStoryboardVideoModalGenSession(
    storyboardId,
    sceneIdx,
    opts.resumeTaskId
      ? { taskKind: opts.taskKind, taskId: opts.resumeTaskId }
      : { taskKind: opts.taskKind },
    taskSessionScope
  )

  videoGenerateTargetKey.value = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, opts.taskKind))
  if (opts.resumeTaskId) {
    const persisted = findStoryboardVideoGenTaskInScopes(creationStore, storyboardId, route)
    videoGenerateProgressText.value =
      formatTaskSseLiveText(persisted || {}, '') ||
      opts.progressRunning ||
      defaultVideoProgressTextForTaskKind(opts.taskKind)
  } else {
    videoGenerateProgressText.value = opts.progressSubmit || '分镜视频提交中…'
  }
  ensureGeneratingPlaceholderVideo(sceneIdx)

  const onProgress = (p: { stepTitle?: string; message?: string; taskId?: number }) => {
    const live = String(p.stepTitle || p.message || '').trim()
    if (live) {
      videoGenerateProgressText.value = live
    }
    const tid = Number(
      p.taskId ?? findStoryboardVideoGenTaskInScopes(creationStore, storyboardId, route)?.taskId
    )
    if (Number.isFinite(tid) && tid > 0) {
      creationStore.setStoryboardVideoGenTask(
        storyboardId,
        {
          taskId: tid,
          sceneIdx,
          taskKind: opts.taskKind,
          message: p.message,
          stepTitle: p.stepTitle
        },
        taskScope.scopeKey
      )
      persistStoryboardVideoModalGenSession(
        storyboardId,
        sceneIdx,
        {
          taskKind: opts.taskKind,
          taskId: tid
        },
        taskSessionScope
      )
    }
  }

  const overlayParts = overlayKeyParts(sceneIdx, opts.taskKind)
  activeStoryboardVideoModalOwnedFollowIds.add(storyboardId)
  modalOwnedVideoRecordsRefreshedIds.delete(storyboardId)
  let keepPendingUi = false

  try {
    let result:
      | Awaited<ReturnType<typeof runStoryboardImageVideoGenerateTask>>
      | Awaited<ReturnType<typeof runStoryboardMultiVideoGenerateTask>>
      | Awaited<ReturnType<typeof runStoryboardEdgeVideoGenerateTask>>
      | Awaited<ReturnType<typeof runStoryboardGridVideoGenerateTask>>

    if (opts.resumeTaskId) {
      result = await followStoryboardVideoGenerateTask({
        taskId: opts.resumeTaskId,
        onProgress
      })
    } else if (opts.taskKind === 'i2v' && opts.submitImageVideoBody) {
      result = await runStoryboardImageVideoGenerateTask({
        body: opts.submitImageVideoBody,
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardVideoGenTask(
            storyboardId,
            { taskId, sceneIdx, taskKind: 'i2v' },
            taskScope.scopeKey
          )
          persistStoryboardVideoModalGenSession(
            storyboardId,
            sceneIdx,
            {
              taskKind: 'i2v',
              taskId
            },
            taskSessionScope
          )
          suspendLateModalVideoFollowIfScopeChanged(taskId, taskScope)
        },
        onProgress
      })
    } else if (opts.taskKind === 'multi' && opts.submitMultiBody) {
      result = await runStoryboardMultiVideoGenerateTask({
        body: opts.submitMultiBody,
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardVideoGenTask(
            storyboardId,
            { taskId, sceneIdx, taskKind: 'multi' },
            taskScope.scopeKey
          )
          persistStoryboardVideoModalGenSession(
            storyboardId,
            sceneIdx,
            {
              taskKind: 'multi',
              taskId
            },
            taskSessionScope
          )
          suspendLateModalVideoFollowIfScopeChanged(taskId, taskScope)
        },
        onProgress
      })
    } else if (opts.taskKind === 'edge' && opts.submitEdgeBody) {
      result = await runStoryboardEdgeVideoGenerateTask({
        body: opts.submitEdgeBody,
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardVideoGenTask(
            storyboardId,
            { taskId, sceneIdx, taskKind: 'edge' },
            taskScope.scopeKey
          )
          persistStoryboardVideoModalGenSession(
            storyboardId,
            sceneIdx,
            {
              taskKind: 'edge',
              taskId
            },
            taskSessionScope
          )
          suspendLateModalVideoFollowIfScopeChanged(taskId, taskScope)
        },
        onProgress
      })
    } else if (opts.taskKind === 'grid' && opts.submitGridBody) {
      result = await runStoryboardGridVideoGenerateTask({
        body: opts.submitGridBody,
        onSubmitted: ({ taskId }) => {
          creationStore.setStoryboardVideoGenTask(
            storyboardId,
            { taskId, sceneIdx, taskKind: 'grid' },
            taskScope.scopeKey
          )
          persistStoryboardVideoModalGenSession(
            storyboardId,
            sceneIdx,
            {
              taskKind: 'grid',
              taskId
            },
            taskSessionScope
          )
          suspendLateModalVideoFollowIfScopeChanged(taskId, taskScope)
        },
        onProgress
      })
    } else {
      return
    }

    /**
     * SSE 被挂起 / 被新跟随抢占 / 任务仍后台进行：不是失败。
     * 保留 scope 桶内任务快照供切回后恢复，不 toast、不清 loading、不刷记录。
     */
    if (!result.ok && 'deferred' in result && result.deferred) {
      keepPendingUi = true
      return
    }

    /**
     * 剧集隔离：终态到达时已切到其它作品/集 → 只清理任务所属 scope 桶的快照，
     * 禁止写当前集扁平 store、禁止 toast、禁止刷新/回写当前集数据。
     */
    if (!matchesCreationLiveGenScope(taskScope)) {
      creationStore.clearStoryboardVideoGenTask(storyboardId, taskScope.scopeKey)
      clearStoryboardVideoModalGenSession(taskSessionScope)
      if (import.meta.client) {
        window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
      }
      return
    }

    if (!result.ok) {
      if (!opts.silentComplete) {
        message.error(
          'errorMessage' in result ? result.errorMessage || '视频生成失败' : '视频生成失败'
        )
      }
      clearModalStoryboardVideoLoadingUi(storyboardId, sceneIdx, opts.taskKind)
      await refreshVideoRecordsFresh(sceneIdx)
      modalOwnedVideoRecordsRefreshedIds.add(storyboardId)
      return
    }

    // 先清 loading/占位（避免随后 clear 读到旧 props 把回填盖空），再强制拉列表，最后用 SSE items 兜底
    clearModalStoryboardVideoLoadingUi(storyboardId, sceneIdx, opts.taskKind)
    await refreshVideoRecordsFresh(sceneIdx, { focusLatest: true })
    modalOwnedVideoRecordsRefreshedIds.add(storyboardId)
    if ('data' in result) {
      applyTerminalVideoItemsToScene(sceneIdx, result.data)
    }
    if (!opts.silentComplete) {
      message.success('视频生成完成')
    }
    // 全局任务刷新只在 finally 派发一次，避免与 sync 回调叠打 list-by-storyboard
  } catch (e: unknown) {
    if (!matchesCreationLiveGenScope(taskScope)) {
      creationStore.clearStoryboardVideoGenTask(storyboardId, taskScope.scopeKey)
      clearStoryboardVideoModalGenSession(taskSessionScope)
    } else {
      if (!opts.silentComplete) {
        message.error(storyboardVideoBizErr(e))
      }
      clearModalStoryboardVideoLoadingUi(storyboardId, sceneIdx, opts.taskKind)
      await refreshVideoRecordsFresh(sceneIdx)
      modalOwnedVideoRecordsRefreshedIds.add(storyboardId)
    }
  } finally {
    activeStoryboardVideoModalOwnedFollowIds.delete(storyboardId)
    if (matchesCreationLiveGenScope(taskScope) && !keepPendingUi) {
      if (videoGenerateTargetKey.value === buildModalTaskOverlayKey(overlayParts)) {
        clearVideoGenerateOverlayForScene(sceneIdx, opts.taskKind)
      }
    }
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  }
}

function clearVideoGenerateOverlayForScene(
  sceneIdx: number,
  taskKind?: 'i2v' | 'multi' | 'edge' | 'grid'
) {
  const kinds = taskKind ? [taskKind] : (['i2v', 'multi', 'edge', 'grid'] as const)
  for (const k of kinds) {
    if (matchesModalTaskOverlayKey(videoGenerateTargetKey.value, overlayKeyParts(sceneIdx, k))) {
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

async function syncStoryboardVideoGenerateUiAfterSettled(
  sceneIdx: number,
  options?: { forceRefresh?: boolean }
) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return
  if (
    activeStoryboardVideoModalOwnedFollowIds.has(storyboardId) ||
    isStoryboardVideoModalRestoreFollowing(storyboardId)
  ) {
    return
  }

  // 弹窗自己的生成链路已 refresh：忽略随后的 global-tasks-updated
  if (!options?.forceRefresh && modalOwnedVideoRecordsRefreshedIds.has(storyboardId)) {
    return
  }

  const persisted = findStoryboardVideoGenTaskInScopes(creationStore, storyboardId, route)
  const hasGeneratingRow = (props.scenes[sceneIdx]?.videos || []).some(
    (v) => v?._generating || v?._localGeneratingPlaceholder
  )
  const hadPending =
    options?.forceRefresh === true ||
    !!persisted?.taskId ||
    hasStoryboardVideoPendingState(storyboardId) ||
    hasGeneratingRow

  if (persisted?.taskId) {
    const ongoing = await isStoryboardVideoTaskOngoing(persisted.taskId)
    if (ongoing) return
  }

  // 弹窗内生成已自行 refresh 后，global-tasks-updated 不应再打 list-by-storyboard
  if (!hadPending) return

  clearModalStoryboardVideoLoadingUi(storyboardId, sceneIdx, persisted?.taskKind)
  if (!shouldSkipStoryboardVideoRestore(storyboardId)) {
    await refreshVideoRecordsFresh(sceneIdx, { focusLatest: true })
    modalOwnedVideoRecordsRefreshedIds.add(storyboardId)
  }
}

function handleStoryboardVideoGenSettledEvent(event: Event) {
  if (!props.open) return
  const detail = (event as CustomEvent<{ storyboardId?: number }>).detail
  const sid = Number(detail?.storyboardId)
  const sceneIdx = props.scenes.findIndex((s) => Number(s?.storyboardId) === sid)
  if (sceneIdx < 0) return
  void syncStoryboardVideoGenerateUiAfterSettled(sceneIdx, { forceRefresh: true })
}

function handleGlobalTasksUpdatedForVideoModal() {
  if (!props.open) return
  if (
    isGeneratingVideoPrompt.value ||
    isGeneratingMultiParamPrompt.value ||
    isStoryboardVideoPromptGeneratingForScene(currentSceneIndex.value)
  ) {
    return
  }
  void syncStoryboardVideoGenerateUiAfterSettled(currentSceneIndex.value)
}

function shouldSkipStoryboardVideoRestore(storyboardId: number, taskId?: number | null): boolean {
  const sceneIdx = props.scenes.findIndex((s) => Number(s?.storyboardId) === storyboardId)
  if (sceneIdx >= 0 && isStoryboardVideoPromptGeneratingForScene(sceneIdx)) return true
  if (activeStoryboardPromptFollowStoryboardIds.has(storyboardId)) return true
  const tid = Number(taskId)
  if (Number.isFinite(tid) && tid > 0 && activeStoryboardPromptFollowTaskIds.has(tid)) return true
  return false
}

async function restoreStoryboardVideoGenerateIfNeeded(sceneIdx: number) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return

  if (!isModalVideoGenOwnerScene(sceneIdx)) {
    clearLocalGeneratingPlaceholdersForScene(sceneIdx)
    return
  }
  if (!shouldRestoreStoryboardVideoGenerate(sceneIdx)) return
  if (shouldSkipStoryboardVideoRestore(storyboardId)) return

  primeStoryboardVideoLoadingUi(sceneIdx)

  if (activeStoryboardVideoModalOwnedFollowIds.has(storyboardId)) {
    return
  }

  const gen = ++resumeStoryboardVideoFollowGen

  let rows: StoryboardRecordRow[] = []
  try {
    rows = await fetchProjectRecordsForStoryboard(storyboardId, 'video')
    if (gen !== resumeStoryboardVideoFollowGen) return
    if (shouldSkipStoryboardVideoRestore(storyboardId)) return

    const mapped = finalizeMappedVideosWhileGenerating(
      sceneIdx,
      rows
        .filter((r) => !!String(r?.fileUrl ?? '').trim() || isPendingStoryboardRecord(r))
        .map(mapRecordRowToVideoItem)
    )
    emit('update', sceneIdx, { videos: mapped })
    const pendingIdx = mapped.findIndex((m) => m._generating)
    if (pendingIdx >= 0 && sceneIdx === currentSceneIndex.value) {
      selectedVideoIdx.value = pendingIdx
      scrollVideoCanvasToIndex(sceneIdx, pendingIdx)
    }
  } catch {
    /* ignore */
  }

  if (gen !== resumeStoryboardVideoFollowGen) return
  if (shouldSkipStoryboardVideoRestore(storyboardId)) return

  const {
    persisted,
    taskId: persistedTaskId,
    taskKind
  } = resolveVideoGenTaskSnapshotForStoryboard(storyboardId, sceneIdx)
  const taskIdRaw = findPendingStoryboardRecordTaskId(rows) ?? persistedTaskId ?? null

  if (!taskIdRaw) {
    if (hasStoryboardVideoPendingState(storyboardId)) {
      primeStoryboardVideoLoadingUi(sceneIdx)
      return
    }
    // 记录/Pinia 已无进行中任务，但步骤条可能仍残留弹窗启动时的 isGeneratingStoryboardVideo
    clearModalStoryboardVideoLoadingUi(storyboardId, sceneIdx, taskKind)
    return
  }
  if (activeStoryboardVideoModalOwnedFollowIds.has(storyboardId)) return
  if (shouldSkipStoryboardVideoRestore(storyboardId, taskIdRaw)) return

  const validatedTaskId = await resolveOngoingTaskId(taskIdRaw)
  if (gen !== resumeStoryboardVideoFollowGen) return
  if (shouldSkipStoryboardVideoRestore(storyboardId, taskIdRaw)) return

  if (!validatedTaskId) {
    creationStore.clearStoryboardVideoGenTask(storyboardId)
    clearStoryboardVideoModalGenSession(storyboardVideoModalSessionScope())
    if (hasStoryboardVideoPendingState(storyboardId)) {
      primeStoryboardVideoLoadingUi(sceneIdx)
      await runStoryboardVideoGenerateForScene(sceneIdx, {
        taskKind,
        resumeTaskId: taskIdRaw,
        progressRunning: defaultVideoProgressTextForTaskKind(taskKind),
        silentComplete: true
      })
      return
    }
    clearModalStoryboardVideoLoadingUi(storyboardId, sceneIdx, taskKind)
    if (!shouldSkipStoryboardVideoRestore(storyboardId)) {
      await refreshVideoRecordsFresh(sceneIdx, { focusLatest: true })
    }
    return
  }

  const taskId = validatedTaskId

  if (isStoryboardVideoModalRestoreFollowing(storyboardId)) {
    videoGenerateTargetKey.value = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, taskKind))
    videoGenerateProgressText.value =
      formatTaskSseLiveText(persisted || {}, '') || defaultVideoProgressTextForTaskKind(taskKind)

    const settled = await waitForStoryboardVideoModalRestore(storyboardId, gen)
    if (!settled) return

    const stillOngoing = await isStoryboardVideoTaskOngoing(taskId)
    if (gen !== resumeStoryboardVideoFollowGen) return
    if (!stillOngoing) {
      clearModalStoryboardVideoLoadingUi(storyboardId, sceneIdx, taskKind)
      if (!shouldSkipStoryboardVideoRestore(storyboardId)) {
        await refreshVideoRecordsFresh(sceneIdx, { focusLatest: true })
      }
      return
    }
  }

  await runStoryboardVideoGenerateForScene(sceneIdx, {
    taskKind,
    resumeTaskId: taskId,
    progressRunning: defaultVideoProgressTextForTaskKind(taskKind),
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
  videoPreviewComponentRefs.clear()
  videoPreviewMediaReady.value = {}
  if (selectReferenceModalOpen.value) void refreshStepPanelImagesForReference()
  if (selectEdgeFrameModalOpen.value) void refreshStepPanelImagesForReference()
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
/** 接口回填提示词时暂停面板内 prompt/参数联动，避免 Quill 与 watcher 递归更新 */
const videoPromptProgrammaticSyncDepth = ref(0)
const isGeneratingVideoPrompt = ref(false)
const isSavingVideoPrompt = ref(false)
const videoPromptGenerateTargetKey = ref('')
const imageToVideoPromptPlain = computed(() =>
  storyboardPromptHtmlToPlain(imageToVideoPrompt.value)
)

const showGeneratingVideoPromptForScene = computed(() => {
  const promptTaskKind = isGridVideoTab.value ? 'grid-video-prompt-gen' : 'video-prompt-gen'
  return matchesModalTaskOverlayKey(
    videoPromptGenerateTargetKey.value,
    overlayKeyParts(currentSceneIndex.value, promptTaskKind)
  )
})

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
      return storyboardPromptMarkdownPlainToHtml(
        text,
        options.assets ?? [],
        options.paramGroups ?? [],
        {
          enableVideoLabeledParams: true,
          enableAssetRefs: true
        }
      )
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
  const raw = String(plain || '').trim()
  if (!raw) {
    resolvedVideoPromptAssets.value = []
    imageToVideoPrompt.value = ''
    return
  }

  videoPromptProgrammaticSyncDepth.value += 1
  try {
    await ensureDictLoaded()

    const audioIds = collectReferenceAudioIds(referenceAudios.value)
    const originalHasPlaceholders = promptPlainHasAssetPlaceholders(raw)
    const inject = prependDefaultReferenceImageToPlainPrompt(raw, referenceImages.value[0] ?? null)
    const text = inject.plain
    const injectedAsset = inject.injected ? (inject.asset as PromptAssetItem) : null

    applyVideoParamSelectionsFromPlain(text)

    const localAssets = collectStoryboardPromptAssets(
      sceneImages.value,
      characterImages.value,
      propImages.value,
      otherImages.value
    )
    const localWithInjected = injectedAsset ? [injectedAsset, ...localAssets] : localAssets

    let resolvedAssets: PromptAssetItem[] = []
    if (originalHasPlaceholders || audioIds.length > 0) {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      const imageResolve = await resolveStoryboardImageAssetsFromPlain(text, ctx, {
        referenceAudioIds: audioIds
      })
      if (imageResolve.unresolvedReferenceAudioIds?.length) {
        message.warning('参考音频不可用，请重新选择')
      }
      resolvedAssets = patchEmptyResolvedPromptAssets(
        imageResolve.resolvedAssets,
        localWithInjected
      )
      if (imageResolve.unresolvedNames.length) {
        message.warning(`部分参考图未匹配：${imageResolve.unresolvedNames.join('、')}`)
      }
    } else if (injectedAsset) {
      resolvedAssets = [injectedAsset]
    }

    resolvedVideoPromptAssets.value = resolvedAssets
    imageToVideoPrompt.value = renderStoryboardVideoPromptApiTextToEditor(text, {
      assets: resolvedVideoPromptAssets.value,
      paramGroups: videoPromptParamGroups.value,
      enableAssetRefs: true,
      enableMarkdown: false
    })
    syncResolvedPromptAssetsToImportReferences(resolvedAssets, 'imageToVideo')
    await nextTick()
  } finally {
    videoPromptProgrammaticSyncDepth.value -= 1
  }
}

async function fetchStoryboardImageToVideoPrompt(storyboardId: number): Promise<string> {
  const row = await fetchUserStoryboardDetailOnce(storyboardId)
  return readStoryboardDetailPromptField(row, 'videoPromptImage')
}

async function fetchStoryboardMultiVideoPrompt(storyboardId: number): Promise<string> {
  const row = await fetchUserStoryboardDetailOnce(storyboardId)
  return readStoryboardDetailPromptField(row, 'videoPrompt')
}

async function fetchStoryboardImageToVideoPromptAfterGenerate(
  storyboardId: number
): Promise<string> {
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

function resolveGridVideoPromptAgentCode(): string {
  return resolveStoryboardVideoPromptSubmitAgentCode(
    'video_prompt_grid',
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

/** 宫格视频提示词：手动「生成设置」优先，否则读项目生成配置 */
async function resolveGridVideoPromptSubmitFields() {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  const manualAgent = resolveGridVideoPromptAgentCode()
  const manualModel = resolveVideoPromptModelCode()
  const manualPick = Boolean(manualAgent || manualModel)
  return resolveStoryboardGenConfigLlmFields(
    ctx?.projectId ?? null,
    STORYBOARD_GEN_CONFIG_SCENE_CODES.videoPromptGrid,
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

const edgeVideoPrompt = ref('')
const edgeVideoPromptPlain = computed(() => storyboardPromptHtmlToPlain(edgeVideoPrompt.value))
/** 首尾帧提示词按分镜本地缓存，与多参 videoPrompt 完全隔离（不从接口回落 videoPrompt） */
const edgeVideoPromptByStoryboardId = ref<Record<string, string>>({})
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
      videoPromptGenerateTargetKey.value,
      overlayKeyParts(sceneIdx, 'grid-video-prompt-gen')
    ) ||
    matchesModalTaskOverlayKey(
      multiParamPromptGenerateTargetKey.value,
      overlayKeyParts(sceneIdx, 'multi-video-prompt-gen')
    )
  )
}

type VideoPromptGenTaskKind =
  | 'video-prompt-gen'
  | 'grid-video-prompt-gen'
  | 'multi-video-prompt-gen'

function resolveVideoPromptGenUiRefs(taskKind: VideoPromptGenTaskKind) {
  if (taskKind === 'multi-video-prompt-gen') {
    return {
      targetKey: multiParamPromptGenerateTargetKey,
      isGenerating: isGeneratingMultiParamPrompt
    }
  }
  return {
    targetKey: videoPromptGenerateTargetKey,
    isGenerating: isGeneratingVideoPrompt
  }
}

/** 刷新或重新打开弹窗后，恢复当前分镜的视频提示词生成 loading 与 SSE 追踪 */
async function restoreStoryboardVideoPromptGenerateIfNeeded(sceneIdx: number) {
  const storyboardId = Number(props.scenes[sceneIdx]?.storyboardId)
  if (!Number.isFinite(storyboardId) || storyboardId <= 0) return
  if (activeStoryboardPromptFollowStoryboardIds.has(storyboardId)) return

  const persisted = creationStore.getStoryboardVideoPromptGenTask(storyboardId)
  const taskId = persisted?.taskId ?? null
  if (!taskId) return

  const taskKind: VideoPromptGenTaskKind = persisted?.taskKind ?? 'video-prompt-gen'
  const ui = resolveVideoPromptGenUiRefs(taskKind)

  const gen = ++resumeStoryboardVideoPromptFollowGen
  const ongoing = await isStoryboardVideoTaskOngoing(taskId)
  if (gen !== resumeStoryboardVideoPromptFollowGen) return

  if (!ongoing) {
    creationStore.clearStoryboardVideoPromptGenTask(storyboardId)
    return
  }

  ui.targetKey.value = buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, taskKind))
  ui.isGenerating.value = true
  activeStoryboardPromptFollowStoryboardIds.add(storyboardId)
  activeStoryboardPromptFollowTaskIds.add(taskId)
  let keepPendingUi = false

  try {
    let taskOutcome = await awaitStoryboardPromptGenerateTask(taskId)
    if (gen !== resumeStoryboardVideoPromptFollowGen) {
      keepPendingUi = true
      return
    }
    if (taskOutcome.ok === false) {
      keepPendingUi = 'deferred' in taskOutcome && taskOutcome.deferred
      return
    }

    if (taskOutcome.ok && 'partial' in taskOutcome && taskOutcome.partial) {
      const partialWarning = taskOutcome.partialWarning
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
        if (taskOutcome.ok === false && 'deferred' in taskOutcome && taskOutcome.deferred) {
          keepPendingUi = true
          return
        }
      }
    }

    if (taskOutcome.ok !== false && sceneIdx === currentSceneIndex.value) {
      const prompt =
        taskKind === 'multi-video-prompt-gen'
          ? await fetchStoryboardMultiVideoPromptAfterGenerate(storyboardId)
          : await fetchStoryboardImageToVideoPromptAfterGenerate(storyboardId)
      if (prompt) {
        if (taskKind === 'multi-video-prompt-gen') {
          await applyMultiParamPromptFromApi(prompt)
        } else {
          await applyVideoPromptFromApi(prompt)
        }
        await refreshRecommendedDurationAfterPromptGenerate(storyboardId)
      }
    }
  } catch {
    /* ignore */
  } finally {
    activeStoryboardPromptFollowStoryboardIds.delete(storyboardId)
    activeStoryboardPromptFollowTaskIds.delete(taskId)
    if (
      !keepPendingUi &&
      ui.targetKey.value === buildModalTaskOverlayKey(overlayKeyParts(sceneIdx, taskKind))
    ) {
      ui.targetKey.value = ''
    }
    if (!keepPendingUi) {
      ui.isGenerating.value = false
      creationStore.clearStoryboardVideoPromptGenTask(storyboardId)
    }
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  }
}

async function runStoryboardVideoPromptGenerateFlow(opts: {
  sceneIdx: number
  taskKind: VideoPromptGenTaskKind
  loadingMessage: string
  successMessage: string
  isGenerating: { value: boolean }
  targetKey: { value: string }
  submit: (
    ctx: { projectId: number; episodeId: number },
    storyboardId: number
  ) => Promise<{
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

  opts.targetKey.value = buildModalTaskOverlayKey(overlayKeyParts(opts.sceneIdx, opts.taskKind))
  opts.isGenerating.value = true
  activeStoryboardPromptFollowStoryboardIds.add(storyboardId)
  resumeStoryboardVideoFollowGen++
  const hideLoading = message.loading(opts.loadingMessage, 0)
  let followedTaskId: number | null = null
  let keepPendingUi = false

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
    creationStore.setStoryboardVideoPromptGenTask(storyboardId, {
      taskId,
      sceneIdx: opts.sceneIdx,
      taskKind: opts.taskKind
    })
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }

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
        taskOutcome = await resumeStoryboardPromptGenerateTask(taskId, 'video')
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

    const prompt = await opts.fetchPromptAfterGenerate(storyboardId)
    if (!prompt) {
      message.warning('生成完成，但未获取到视频提示词内容')
      return
    }

    await opts.applyPrompt(prompt)
    if (opts.sceneIdx === currentSceneIndex.value) {
      await refreshRecommendedDurationAfterPromptGenerate(storyboardId)
    }
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
    if (!keepPendingUi) {
      opts.isGenerating.value = false
      opts.targetKey.value = ''
      creationStore.clearStoryboardVideoPromptGenTask(storyboardId)
    }
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  }
}

async function applyMultiParamPromptFromApi(plain: string) {
  const raw = String(plain || '').trim()
  if (!raw) {
    resolvedMultiParamPromptAssets.value = []
    multiParamPrompt.value = ''
    return
  }

  videoPromptProgrammaticSyncDepth.value += 1
  try {
    await ensureDictLoaded()

    const audioIds = collectReferenceAudioIds(referenceAudios.value)
    const originalHasPlaceholders = promptPlainHasAssetPlaceholders(raw)
    const inject = prependDefaultReferenceImageToPlainPrompt(raw, sceneImages.value[0] ?? null)
    const text = inject.plain
    const injectedAsset = inject.injected ? (inject.asset as PromptAssetItem) : null

    const localAssets = collectStoryboardPromptAssets(
      sceneImages.value,
      characterImages.value,
      propImages.value,
      otherImages.value
    )
    const localWithInjected = injectedAsset ? [injectedAsset, ...localAssets] : localAssets

    let resolvedAssets: PromptAssetItem[] = []
    if (originalHasPlaceholders || audioIds.length > 0) {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      const imageResolve = await resolveStoryboardImageAssetsFromPlain(text, ctx, {
        referenceAudioIds: audioIds
      })
      if (imageResolve.unresolvedReferenceAudioIds?.length) {
        message.warning('参考音频不可用，请重新选择')
      }
      resolvedAssets = patchEmptyResolvedPromptAssets(
        imageResolve.resolvedAssets,
        localWithInjected
      )
      if (imageResolve.unresolvedNames.length) {
        message.warning(`部分参考图未匹配：${imageResolve.unresolvedNames.join('、')}`)
      }
    } else if (injectedAsset) {
      resolvedAssets = [injectedAsset]
    }

    resolvedMultiParamPromptAssets.value = resolvedAssets

    const selections = extractVideoPromptParamSelectionsFromPlain(
      text,
      multiParamPromptParamGroups.value
    )
    selectedCameraMovement.value = selections[PROMPT_TYPE.camera_movement] ?? null
    multiParamShootingTechnique.value = selections[PROMPT_TYPE.shooting_technique] ?? null

    multiParamPrompt.value = renderStoryboardVideoPromptApiTextToEditor(text, {
      assets: resolvedMultiParamPromptAssets.value,
      paramGroups: multiParamPromptParamGroups.value,
      enableAssetRefs: true,
      enableMarkdown: true
    })
    syncResolvedPromptAssetsToImportReferences(resolvedAssets, 'multiParam')
    await nextTick()
  } finally {
    videoPromptProgrammaticSyncDepth.value -= 1
  }
}

function saveEdgeVideoPromptToCache(storyboardId: string | number | null | undefined) {
  if (!storyboardId) return
  edgeVideoPromptByStoryboardId.value[String(storyboardId)] = edgeVideoPrompt.value
}

function restoreEdgeVideoPromptFromCache(storyboardId: string | number | null | undefined) {
  if (!storyboardId) {
    edgeVideoPrompt.value = ''
    return
  }
  edgeVideoPrompt.value = edgeVideoPromptByStoryboardId.value[String(storyboardId)] ?? ''
}

function loadStoryboardEdgeVideoPromptForScene() {
  restoreEdgeVideoPromptFromCache(currentStoryboardId.value)
}

watch(edgeVideoPrompt, () => {
  saveEdgeVideoPromptToCache(currentStoryboardId.value)
})

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

// ---------- 首尾帧生视频 tab ----------
type EdgeFrameImage = {
  id?: string | number
  url?: string
  thumbnail?: string
  title?: string
  name?: string
  _fromServer?: boolean
  _serverRow?: { id?: number }
}

const isEdgeVideoSettingExpanded = ref(true)
const firstFrameImage = ref<EdgeFrameImage | null>(null)
const lastFrameImage = ref<EdgeFrameImage | null>(null)
const edgeFrameImagesByStoryboardId = ref<
  Record<string, { first: EdgeFrameImage | null; last: EdgeFrameImage | null }>
>({})
const selectEdgeFrameModalOpen = ref(false)
const edgeFramePickTarget = ref<'first' | 'last'>('first')
const edgeVideoPanelRef = ref<InstanceType<typeof StoryboardGeneratePanel> | null>(null)

watch(selectEdgeFrameModalOpen, (open) => {
  if (open) void refreshStepPanelImagesForReference()
})

const showEdgeFrameSwap = computed(
  () =>
    !!(firstFrameImage.value?.url || firstFrameImage.value?.thumbnail) ||
    !!(lastFrameImage.value?.url || lastFrameImage.value?.thumbnail)
)

const sceneImages = ref<any[]>([])
const imageToVideoPanelRef = ref<InstanceType<typeof StoryboardGeneratePanel> | null>(null)
const multiParamPanelRef = ref<InstanceType<typeof StoryboardGeneratePanel> | null>(null)

function getActiveStoryboardPanel() {
  if (leftActiveTab.value === 'imageToVideo' || leftActiveTab.value === 'gridVideo') {
    return imageToVideoPanelRef.value
  }
  if (leftActiveTab.value === 'multiParam') return multiParamPanelRef.value
  if (leftActiveTab.value === 'startEndFrame') return edgeVideoPanelRef.value
  return null
}
const characterImages = ref<any[]>([])
const propImages = ref<any[]>([])
const otherImages = ref<any[]>([])

function mapStoryboardCoverToReferenceImage(cover: {
  id?: string | number
  url?: string
  thumbnail?: string
  title?: string
  name?: string
  isSelected?: boolean
  _fromServer?: boolean
  _serverRow?: { id?: number }
}) {
  const url = String(cover?.url || cover?.thumbnail || '').trim()
  if (!url) return null
  const rawId = cover?.id ?? cover?._serverRow?.id
  return {
    id: rawId != null && String(rawId).trim() ? String(rawId) : `storyboard-cover-${Date.now()}`,
    url,
    thumbnail: String(cover?.thumbnail || cover?.url || url),
    title: cover?.title || cover?.name || '分镜图',
    name: cover?.name || cover?.title || '分镜图',
    ...(cover?._fromServer ? { _fromServer: true, _serverRow: cover._serverRow } : {}),
    ...(cover?.isSelected != null ? { isSelected: cover.isSelected } : {})
  }
}

/** 当前分镜脚本已确认主图（isSelected=1 / finalImageUrl），供图生视频与多参默认参考图 */
function resolveDefaultStoryboardReferenceImage(sceneIdx: number) {
  const sp = resolveScriptPanelForSceneIndex(sceneIdx)
  const scene = props.scenes[sceneIdx]
  const cover = resolveStoryboardPanelCoverImage({
    images: sp?.images ?? scene?.storyboardImages,
    finalImageUrl: sp?.finalImageUrl
  })
  if (!cover) return null
  return mapStoryboardCoverToReferenceImage(cover)
}

function resetStoryboardReferenceState() {
  referenceImages.value = []
  sceneImages.value = []
  characterImages.value = []
  propImages.value = []
  otherImages.value = []
}

const selectAssetModalOpen = ref(false)
const selectMultiParamReferenceModalOpen = ref(false)
const selectAssetModalType = ref<
  'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other'
>('scene')
const showMaterialFromLibraryModal = ref(false)
const materialLibraryCategoryKey = ref<string>('pose')

const {
  ensureLoaded: ensureDictLoaded,
  aspectRatioEnumOptions,
  cameraMovementOptions,
  shootingTechniqueOptions
} = usePromptDictionary()

const aspectRatioLabelsForVideo = computed(() =>
  filterAspectRatiosForVideoModal(aspectRatioEnumOptions.value)
)

const imageToVideoModel = ref('')
const multiParamVideoModel = ref('')
const edgeVideoModel = ref('')
const gridVideoModel = ref('')
const imageToVideoModelDropdownExpanded = ref(false)
const multiParamVideoModelDropdownExpanded = ref(false)
const edgeVideoModelDropdownExpanded = ref(false)
const gridVideoModelDropdownExpanded = ref(false)
let initVideoModelGen = 0
const cachedImageToVideoAgentModelCodes = ref<string[]>([])
const cachedMultiParamAgentModelCodes = ref<string[]>([])
const cachedGridVideoAgentModelCodes = ref<string[]>([])

const activeVideoModel = computed({
  get: () => {
    if (leftActiveTab.value === 'multiParam') return multiParamVideoModel.value
    if (leftActiveTab.value === 'startEndFrame') return edgeVideoModel.value
    if (leftActiveTab.value === 'gridVideo') return gridVideoModel.value
    return imageToVideoModel.value
  },
  set: (v: string) => {
    if (leftActiveTab.value === 'multiParam') multiParamVideoModel.value = v
    else if (leftActiveTab.value === 'startEndFrame') edgeVideoModel.value = v
    else if (leftActiveTab.value === 'gridVideo') gridVideoModel.value = v
    else imageToVideoModel.value = v
  }
})

const mapVideoModelOption = (
  item: Parameters<typeof mapUserModelListItemToModelOption>[0]
): ModelOption => mapUserModelListItemToModelOption(item, { iconBg: '#60A5FA' })

const {
  modelList: imageToVideoModelOptions,
  rawModelList: imageToVideoRawModelList,
  loadModels: loadImageToVideoModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_IMAGE,
  modelType: 'video',
  projectId: () => creationStore.currentProjectId,
  episodeId: () => creationStore.currentEpisodeId,
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
  funcCodeFallbacks: [AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_MULTI_PRO],
  modelType: 'video',
  projectId: () => creationStore.currentProjectId,
  episodeId: () => creationStore.currentEpisodeId,
  fallback: [],
  keepFallbackOnEmpty: false,
  mapItem: mapVideoModelOption,
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载多参生视频模型失败')
  }
})

const {
  modelList: edgeVideoModelOptions,
  rawModelList: edgeVideoRawModelList,
  loadModels: loadEdgeVideoModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_EDGE,
  modelType: 'video',
  projectId: () => creationStore.currentProjectId,
  episodeId: () => creationStore.currentEpisodeId,
  fallback: [],
  keepFallbackOnEmpty: false,
  mapItem: mapVideoModelOption,
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载首尾帧视频模型失败')
  }
})

const {
  modelList: gridVideoModelOptions,
  rawModelList: gridVideoRawModelList,
  loadModels: loadGridVideoModelOptions
} = useModelList<ModelOption>({
  funcCode: AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_GRID,
  modelType: 'video',
  projectId: () => creationStore.currentProjectId,
  episodeId: () => creationStore.currentEpisodeId,
  fallback: [],
  keepFallbackOnEmpty: false,
  mapItem: mapVideoModelOption,
  onError: (e) => {
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '加载宫格视频模型失败')
  }
})

const videoRawModelList = computed(() => {
  if (leftActiveTab.value === 'multiParam') return multiParamRawModelList.value
  if (leftActiveTab.value === 'startEndFrame') return edgeVideoRawModelList.value
  if (leftActiveTab.value === 'gridVideo') return gridVideoRawModelList.value
  return imageToVideoRawModelList.value
})

/** 当前 Tab 选中的原始模型项（供参考音频 capability / 导入弹窗） */
const activeVideoRawModel = computed(() => {
  const code = String(activeVideoModel.value || '').trim()
  const list = videoRawModelList.value || []
  if (!code) return list[0] || null
  return (
    list.find((m) => String(m.modelCode || '').trim() === code || String(m.id) === code) ||
    list[0] ||
    null
  )
})

/** 各出片方向共用的参考音频选用列表（官方 + 上传） */
const referenceAudios = ref<ReferenceMediaItem[]>([])

const selectedImageToVideoModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(imageToVideoModelOptions.value, imageToVideoModel.value)
)

const selectedMultiParamVideoModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(multiParamVideoModelOptions.value, multiParamVideoModel.value)
)

const selectedEdgeVideoModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(edgeVideoModelOptions.value, edgeVideoModel.value)
)

const selectedGridVideoModel = computed<ModelOption>(() =>
  resolveSelectedModelOption(gridVideoModelOptions.value, gridVideoModel.value)
)

function guardSelectVideoModel(
  model: ModelOption,
  rawList: { modelCode?: string; id?: number; capability?: unknown }[]
): boolean {
  const raw =
    rawList.find(
      (m) =>
        String(m.modelCode || '').trim() === String(model.id) || String(m.id) === String(model.id)
    ) || null
  const check = canSwitchModelWithReferenceAudio(
    parseReferenceAudioCapability(raw),
    referenceAudios.value.length > 0
  )
  if (!check.ok) {
    message.warning('message' in check ? check.message : MODEL_NO_REF_AUDIO_TIP)
    return false
  }
  return true
}

function handleSelectImageToVideoModel(model: ModelOption) {
  imageToVideoModelDropdownExpanded.value = false
  if (!guardSelectVideoModel(model, imageToVideoRawModelList.value)) return
  imageToVideoModel.value = model.id
  syncVideoSettingsToModel()
}

function handleSelectMultiParamVideoModel(model: ModelOption) {
  multiParamVideoModelDropdownExpanded.value = false
  if (!guardSelectVideoModel(model, multiParamRawModelList.value)) return
  multiParamVideoModel.value = model.id
  syncVideoSettingsToModel()
}

function handleSelectEdgeVideoModel(model: ModelOption) {
  edgeVideoModelDropdownExpanded.value = false
  if (!guardSelectVideoModel(model, edgeVideoRawModelList.value)) return
  edgeVideoModel.value = model.id
  syncVideoSettingsToModel()
}

function handleSelectGridVideoModel(model: ModelOption) {
  gridVideoModelDropdownExpanded.value = false
  if (!guardSelectVideoModel(model, gridVideoRawModelList.value)) return
  gridVideoModel.value = model.id
  syncVideoSettingsToModel()
}

function writePromptPlainToActiveEditor(plain: string) {
  const text = String(plain || '')
  if (leftActiveTab.value === 'multiParam') {
    multiParamPrompt.value = renderStoryboardVideoPromptApiTextToEditor(text, {
      assets: resolvedMultiParamPromptAssets.value,
      paramGroups: multiParamPromptParamGroups.value,
      enableAssetRefs: true,
      enableMarkdown: true
    })
    return
  }
  if (leftActiveTab.value === 'startEndFrame') {
    edgeVideoPrompt.value = renderStoryboardVideoPromptApiTextToEditor(text, {
      enableAssetRefs: true,
      enableMarkdown: false
    })
    return
  }
  imageToVideoPrompt.value = renderStoryboardVideoPromptApiTextToEditor(text, {
    assets: resolvedVideoPromptAssets.value,
    paramGroups: videoPromptParamGroups.value,
    enableAssetRefs: true,
    enableMarkdown: false
  })
}

function applyImportedReferenceAudios(audios: ReferenceMediaItem[]) {
  if (!audios.length) return
  referenceAudios.value = mergeReferenceAudioLists(referenceAudios.value, audios)
  const basePlain =
    leftActiveTab.value === 'multiParam'
      ? multiParamPromptPlain.value
      : leftActiveTab.value === 'startEndFrame'
        ? edgeVideoPromptPlain.value
        : imageToVideoPromptPlain.value
  writePromptPlainToActiveEditor(syncAudioPlaceholdersIntoPrompt(basePlain, audios))
}

async function removeReferenceAudioAt(index: number) {
  const target = referenceAudios.value[index]
  if (!target) return
  if (target.audioSource === 'upload' && Number(target.referenceAudioId) > 0) {
    try {
      await userReferenceAudioDelete({ id: Number(target.referenceAudioId) })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '删除参考音频失败')
      return
    }
  }
  const basePlain =
    leftActiveTab.value === 'multiParam'
      ? multiParamPromptPlain.value
      : leftActiveTab.value === 'startEndFrame'
        ? edgeVideoPromptPlain.value
        : imageToVideoPromptPlain.value
  const r = removeAudioFromPromptAndList(basePlain, referenceAudios.value, index)
  referenceAudios.value = r.audios
  writePromptPlainToActiveEditor(r.plain)
}

const videoAspectRatio = ref('16:9')
const videoDuration = ref('5')
const videoCount = ref(1)
const videoQuality = ref('1080p')
const videoAudio = ref('with_audio')

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
  capabilitySnapshot: videoCapabilitySnapshot,
  aspectRatioSelectOptions: videoAspectRatioOptions,
  countSelectOptions: videoCountOptions,
  qualitySelectOptions: videoQualityOptions,
  durationSelectOptions: videoDurationOptions,
  audioSelectOptions: videoAudioOptions,
  supportsDuration: videoConfigShowDuration,
  supportsAudio: videoConfigShowAudio,
  syncSettingsToModel: syncVideoSettingsToModel
} = useVideoModelGenerateSettings({
  selectedModelCode: activeVideoModel,
  rawModelList: videoRawModelList,
  generationSettings: videoSettingsForCapability,
  aspectRatioEnumLabels: aspectRatioLabelsForVideo
})

const videoCost = computed(() => 12)

/** detail.recommendedDurationSeconds 原始值；无效时由模型默认兜底 */
const recommendedDurationSecondsRaw = ref<number | null>(null)

const resolvedRecommendedDurationSeconds = computed(() =>
  resolveVideoDurationOption({
    recommendedDurationSeconds: recommendedDurationSecondsRaw.value,
    durationOptions: videoCapabilitySnapshot.value.durationOptions,
    defaultDurationSeconds: videoCapabilitySnapshot.value.defaultDurationSeconds
  })
)

const videoDurationTip = computed(() => {
  if (!videoConfigShowDuration.value) return ''
  // 无 detail 推荐时长时不展示提示，避免把模型默认秒数误当成「推荐最优」
  if (recommendedDurationSecondsRaw.value == null) return ''
  return buildRecommendedDurationTipText(
    videoDuration.value,
    resolvedRecommendedDurationSeconds.value
  )
})

function applyRecommendedVideoDuration() {
  if (!videoConfigShowDuration.value) return
  videoDuration.value = String(resolvedRecommendedDurationSeconds.value)
}

function applyRecommendedDurationFromDetailRow(
  row: { recommendedDurationSeconds?: number | null } | null | undefined
) {
  recommendedDurationSecondsRaw.value = readRecommendedDurationSeconds(row)
  applyRecommendedVideoDuration()
}

async function loadRecommendedDurationForScene(options?: { force?: boolean }) {
  const id = currentStoryboardId.value
  // 先清空，避免切分镜/重开弹窗短暂套用上一镜推荐秒数
  recommendedDurationSecondsRaw.value = null
  if (!id) {
    applyRecommendedVideoDuration()
    return
  }
  try {
    const row = await fetchUserStoryboardDetailOnce(id, { force: options?.force === true })
    if (currentStoryboardId.value !== id) return
    applyRecommendedDurationFromDetailRow(row)
  } catch {
    if (currentStoryboardId.value !== id) return
    recommendedDurationSecondsRaw.value = null
    applyRecommendedVideoDuration()
  }
}

/** 生成提示词完成后 detail 可能更新推荐时长；复用刚写入的短缓存并写回下拉默认值 */
async function refreshRecommendedDurationAfterPromptGenerate(storyboardId: number) {
  if (currentStoryboardId.value !== storyboardId) return
  try {
    const row = await fetchUserStoryboardDetailOnce(storyboardId)
    if (currentStoryboardId.value !== storyboardId) return
    applyRecommendedDurationFromDetailRow(row)
  } catch {
    /* 保留生成前的时长默认值 */
  }
}

function applySavedVideoGenerateSettings() {
  const saved = creationStore.storyboardVideoGenerateSettings
  if (saved.aspectRatio) videoAspectRatio.value = saved.aspectRatio
  if (saved.resolution) videoQuality.value = String(saved.resolution).toLowerCase()
  // 时长默认始终优先 detail.recommendedDurationSeconds，不再用本地保存秒数覆盖
  // 音频先按本地偏好恢复；不支持音画同出的模型由后续 syncVideoSettingsToModel 强制 silent
  if (saved.soundEffects === 'with-sound') videoAudio.value = 'with_audio'
  else if (saved.soundEffects === 'none') videoAudio.value = 'silent'
  else videoAudio.value = 'with_audio'
}

function resolveCurrentGenerateAudio(): boolean {
  return resolveGenerateAudioFlag(videoAudio.value === 'with_audio', videoConfigShowAudio.value)
}

function applyVideoModelDefaultFromAgent(
  target: 'imageToVideo' | 'multiParam' | 'startEndFrame' | 'gridVideo',
  options: ModelOption[],
  agentDefaultCodes: string[]
) {
  if (!options.length) return
  const selected =
    resolvePreferredModelIdFromAgentCodes(options, { agentDefaultCodes }) || options[0]?.id || ''
  if (!selected) return
  if (target === 'imageToVideo') imageToVideoModel.value = selected
  else if (target === 'multiParam') multiParamVideoModel.value = selected
  else if (target === 'gridVideo') gridVideoModel.value = selected
  else edgeVideoModel.value = selected
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
  if (
    !String(multiParamVideoModel.value || '').trim() &&
    multiParamVideoModelOptions.value.length
  ) {
    applyVideoModelDefaultFromAgent(
      'multiParam',
      multiParamVideoModelOptions.value,
      cachedMultiParamAgentModelCodes.value
    )
  }
  if (!String(edgeVideoModel.value || '').trim() && edgeVideoModelOptions.value.length) {
    edgeVideoModel.value = edgeVideoModelOptions.value[0]!.id
  }
  if (!String(gridVideoModel.value || '').trim() && gridVideoModelOptions.value.length) {
    applyVideoModelDefaultFromAgent(
      'gridVideo',
      gridVideoModelOptions.value,
      cachedGridVideoAgentModelCodes.value
    )
  }
  syncVideoSettingsToModel()
  applyRecommendedVideoDuration()
}

async function initVideoModelOptions() {
  const gen = ++initVideoModelGen
  clearAgentDefaultModelCache()

  const creationMode = projectCreationMode.value
  const imagePromptAgentCode = resolveImageVideoPromptAgentCode()
  const multiPromptAgentCode = resolveMultiVideoPromptAgentCode()
  const gridPromptAgentCode = resolveGridVideoPromptAgentCode()
  const funcCodes = resolveStoryboardVideoModelFuncCodes(creationMode)
  const agentBizCodes = resolveStoryboardVideoAgentBizCategories(creationMode)

  const listScope = buildAidAgentListScopeParams(creationStore)
  const [agentGroups, modelGroups] = await Promise.all([
    agentBizCodes.length
      ? aidAgentList({ bizCategoryCodes: agentBizCodes, ...listScope })
      : Promise.resolve([] as Awaited<ReturnType<typeof aidAgentList>>),
    // 专业版：带 projectId，后端将 main_storyboard_video 重映射为 multi_pro
    userModelListByFuncCodes(funcCodes, listScope),
    ensureDictLoaded()
  ])

  if (gen !== initVideoModelGen) return

  // 批量解析；仍空时用同 scope 的 loadModels 兜底（可落到 model/list，避免下拉空白）
  if (showStoryboardImageToVideoTab(creationMode)) {
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
  }

  if (showStoryboardMultiParamVideoTab(creationMode)) {
    // 专业版 listByFunc 带 projectId 后分组 funcCode 可能为 multi_pro
    const multiParamList = pickFirstNonEmptyModelPool(modelGroups, [
      AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_MULTI_PRO,
      AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO
    ])
    if (multiParamList.length > 0) {
      multiParamRawModelList.value = multiParamList
      multiParamVideoModelOptions.value = multiParamList.map(mapVideoModelOption)
    } else {
      await loadMultiParamVideoModelOptions()
    }
  }

  const edgeList = modelsFromListByFuncGroups(modelGroups, AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_EDGE)
  if (edgeList.length > 0) {
    edgeVideoRawModelList.value = edgeList
    edgeVideoModelOptions.value = edgeList.map(mapVideoModelOption)
  } else {
    await loadEdgeVideoModelOptions()
  }

  if (showStoryboardGridVideoTab(creationMode)) {
    const gridList = modelsFromListByFuncGroups(
      modelGroups,
      AI_MODEL_FUNC_CODE.STORYBOARD_VIDEO_GRID
    )
    if (gridList.length > 0) {
      gridVideoRawModelList.value = gridList
      gridVideoModelOptions.value = gridList.map(mapVideoModelOption)
    } else {
      await loadGridVideoModelOptions()
    }
  }

  /** 优先出片智能体 modelCode，再尝试提示词智能体（与 listByFunc 视频池对齐） */
  if (showStoryboardImageToVideoTab(creationMode)) {
    cachedImageToVideoAgentModelCodes.value = [
      resolveAgentModelCodeInGroup(
        agentGroups,
        STORYBOARD_VIDEO_IMAGE_AGENT_BIZ_CATEGORY,
        imagePromptAgentCode
      ),
      resolveAgentModelCodeInGroup(
        agentGroups,
        STORYBOARD_VIDEO_PROMPT_IMAGE_AGENT_BIZ_CATEGORY,
        imagePromptAgentCode
      )
    ].filter(Boolean)
  } else {
    cachedImageToVideoAgentModelCodes.value = []
  }

  if (showStoryboardMultiParamVideoTab(creationMode)) {
    cachedMultiParamAgentModelCodes.value = [
      resolveAgentModelCodeInGroup(
        agentGroups,
        STORYBOARD_VIDEO_AGENT_BIZ_CATEGORY,
        multiPromptAgentCode
      ),
      resolveAgentModelCodeInGroup(
        agentGroups,
        STORYBOARD_VIDEO_PROMPT_AGENT_BIZ_CATEGORY,
        multiPromptAgentCode
      )
    ].filter(Boolean)
  } else {
    cachedMultiParamAgentModelCodes.value = []
  }

  if (showStoryboardGridVideoTab(creationMode)) {
    cachedGridVideoAgentModelCodes.value = [
      resolveAgentModelCodeInGroup(
        agentGroups,
        STORYBOARD_VIDEO_GRID_AGENT_BIZ_CATEGORY,
        gridPromptAgentCode
      ),
      resolveAgentModelCodeInGroup(
        agentGroups,
        STORYBOARD_VIDEO_PROMPT_GRID_AGENT_BIZ_CATEGORY,
        gridPromptAgentCode
      )
    ].filter(Boolean)
  } else {
    cachedGridVideoAgentModelCodes.value = []
  }

  applySavedVideoGenerateSettings()

  if (showStoryboardImageToVideoTab(creationMode)) {
    applyVideoModelDefaultFromAgent(
      'imageToVideo',
      imageToVideoModelOptions.value,
      cachedImageToVideoAgentModelCodes.value
    )
  }
  if (showStoryboardMultiParamVideoTab(creationMode)) {
    applyVideoModelDefaultFromAgent(
      'multiParam',
      multiParamVideoModelOptions.value,
      cachedMultiParamAgentModelCodes.value
    )
  }
  if (!String(edgeVideoModel.value || '').trim() && edgeVideoModelOptions.value.length) {
    edgeVideoModel.value = edgeVideoModelOptions.value[0]!.id
  }
  if (showStoryboardGridVideoTab(creationMode)) {
    applyVideoModelDefaultFromAgent(
      'gridVideo',
      gridVideoModelOptions.value,
      cachedGridVideoAgentModelCodes.value
    )
  }
  syncVideoSettingsToModel()
  applyRecommendedVideoDuration()
}

async function loadStoryboardVideoPromptForScene() {
  if (isStoryboardVideoPromptGeneratingForScene()) return
  const id = currentStoryboardId.value
  if (!id) {
    resolvedVideoPromptAssets.value = []
    imageToVideoPrompt.value = ''
    return
  }
  const persisted = creationStore.getStoryboardVideoPromptGenTask(id)
  if (
    (persisted?.taskKind === 'video-prompt-gen' ||
      persisted?.taskKind === 'grid-video-prompt-gen') &&
    (await isStoryboardVideoTaskOngoing(persisted.taskId))
  ) {
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
  const persisted = creationStore.getStoryboardVideoPromptGenTask(id)
  if (
    persisted?.taskKind === 'multi-video-prompt-gen' &&
    (await isStoryboardVideoTaskOngoing(persisted.taskId))
  ) {
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

watch(activeVideoModel, () => {
  syncVideoSettingsToModel()
  applyRecommendedVideoDuration()
})

/** 切到支持音画同出的模型时，按本地偏好恢复；不支持时强制无声（不污染 persist） */
watch(videoConfigShowAudio, (ok) => {
  if (!ok) {
    videoAudio.value = 'silent'
    return
  }
  const saved = creationStore.storyboardVideoGenerateSettings.soundEffects
  if (saved === 'with-sound') videoAudio.value = 'with_audio'
  else if (saved === 'none') videoAudio.value = 'silent'
  else videoAudio.value = 'with_audio'
})

watch(imageToVideoModelOptions, () => reapplyVideoModelDefaultIfEmpty(), { flush: 'post' })
watch(multiParamVideoModelOptions, () => reapplyVideoModelDefaultIfEmpty(), { flush: 'post' })
watch(edgeVideoModelOptions, () => reapplyVideoModelDefaultIfEmpty(), { flush: 'post' })
watch(gridVideoModelOptions, () => reapplyVideoModelDefaultIfEmpty(), { flush: 'post' })

watch(leftActiveTab, () => {
  syncVideoSettingsToModel()
  applyRecommendedVideoDuration()
})

watch(projectCreationMode, () => {
  syncLeftActiveTabForCreationMode()
})

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (isOpen) {
      syncLeftActiveTabForCreationMode(true)
      return
    }
    if (!wasOpen) return
    const sid = Number(props.scenes[currentSceneIndex.value]?.storyboardId)
    if (Number.isFinite(sid) && sid > 0) {
      activeStoryboardVideoModalOwnedFollowIds.delete(sid)
    }
  },
  { immediate: true }
)

function storyboardVideoBizErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

/** 图生视频接口：参考图最多 1 张 */
const MAX_IMAGE_TO_VIDEO_REFERENCE_COUNT = 1

function collectReferenceImageUrls(): string[] {
  return referenceImages.value.map((r) => String(r.url || r.thumbnail || '').trim()).filter(Boolean)
}

function collectMultiParamAssetImages(): Array<{ url?: string; thumbnail?: string }> {
  return [
    ...sceneImages.value,
    ...characterImages.value,
    ...propImages.value,
    ...otherImages.value
  ].filter((img) => img?.url || img?.thumbnail)
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

function normalizeImageToVideoReferenceItems<T extends { url?: string; thumbnail?: string }>(
  items: T[]
): T[] {
  if (items.length <= MAX_IMAGE_TO_VIDEO_REFERENCE_COUNT) return items
  message.warning('图生视频最多只能上传一张参考图片，已使用第一张')
  return items.slice(0, MAX_IMAGE_TO_VIDEO_REFERENCE_COUNT)
}

/** 无主图时保持为空；有主图时默认填入图生视频参考图与多参场景参考图 */
function applyDefaultStoryboardReferenceImages(sceneIdx: number) {
  const main = resolveDefaultStoryboardReferenceImage(sceneIdx)
  if (!main) return
  referenceImages.value = normalizeImageToVideoReferenceItems([main])
  sceneImages.value = [main]
}

/** 将 resolve 解析出的参考图同步到「导入参考图」展示区，供校验与出片接口使用 */
function syncResolvedPromptAssetsToImportReferences(
  assets: PromptAssetItem[],
  mode: 'imageToVideo' | 'multiParam'
) {
  const withUrl = assets.filter((a) => !isEmptyPromptAssetUrl(a.url))
  if (!withUrl.length) return

  if (mode === 'imageToVideo') {
    const refs = withUrl
      .slice()
      .sort((a, b) => a.imageIndex - b.imageIndex)
      .map(promptAssetToReferenceImageItem)
      .filter((item): item is NonNullable<typeof item> => item != null)
    if (!refs.length) return
    referenceImages.value = normalizeImageToVideoReferenceItems(
      mergeReferenceImageItems(referenceImages.value, refs)
    )
    return
  }

  const buckets = splitResolvedPromptAssetsToReferenceBuckets(withUrl, (item) =>
    inferMultiParamAssetType(item)
  )
  sceneImages.value = mergeReferenceImageItems(sceneImages.value, buckets.scene)
  characterImages.value = mergeReferenceImageItems(characterImages.value, buckets.character)
  propImages.value = mergeReferenceImageItems(propImages.value, buckets.prop)
  otherImages.value = mergeReferenceImageItems(otherImages.value, buckets.other)
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
    ...buildStoryboardVideoResolutionField(videoQuality.value),
    count: videoCount.value,
    generateAudio: resolveCurrentGenerateAudio(),
    ...buildGenerateReferenceAudioFields(referenceAudios.value),
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
    ...buildStoryboardVideoResolutionField(videoQuality.value),
    count: videoCount.value,
    generateAudio: resolveCurrentGenerateAudio(),
    ...buildGenerateReferenceAudioFields(referenceAudios.value),
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
  const savedResolution = String(videoQuality.value || '')
    .trim()
    .toLowerCase()
  const durationSec = Number(videoDuration.value)
  creationStore.setStoryboardVideoGenerateSettings({
    videoModel: modelName,
    ...(savedAspect ? { aspectRatio: savedAspect } : {}),
    ...(savedResolution ? { resolution: savedResolution } : {}),
    ...(videoConfigShowDuration.value && Number.isFinite(durationSec) && durationSec > 0
      ? { durationSeconds: durationSec }
      : { durationSeconds: null }),
    // 不支持音画同出时不写入，避免把临时 coerce 的 silent 覆盖用户偏好
    ...(videoConfigShowAudio.value
      ? { soundEffects: videoAudio.value === 'with_audio' ? 'with-sound' : 'none' }
      : {})
  })
}

async function syncSceneDetailAndRestore(sceneIdx: number) {
  await ensureModalVideoLoadingRestored(sceneIdx)
  // 打开/切 Tab：顶部 Tab 与画布共用一次 force list-by-storyboard（外层 list 只带主视频）
  await refreshHeaderTabs(true)
  await refreshVideoRecords(sceneIdx)
  void restoreStoryboardVideoPromptGenerateIfNeeded(sceneIdx)
  void restoreStoryboardVideoGenerateIfNeeded(sceneIdx)
  void loadRecommendedDurationForScene()
  if (!isStoryboardVideoPromptGeneratingForScene(sceneIdx)) {
    void loadStoryboardVideoPromptForScene()
    void loadStoryboardMultiVideoPromptForScene()
    void loadStoryboardEdgeVideoPromptForScene()
  }
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
      edgeVideoModel.value = ''
      gridVideoModel.value = ''
      edgeVideoPromptByStoryboardId.value = {}
      imageToVideoModelDropdownExpanded.value = false
      multiParamVideoModelDropdownExpanded.value = false
      edgeVideoModelDropdownExpanded.value = false
      void initVideoModelOptions()
      currentSceneIndex.value = props.sceneIndex
      showStoryboardScriptModal.value = false
      const si = props.sceneIndex
      const openSid = sceneStoryboardIdNum(si)
      if (openSid != null)
        clearStoryboardVideoModalUserDismissed(storyboardVideoModalSessionScope())
      ensurePendingStoryboardVideoLoadingPlaceholders(si)
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
      resetStoryboardReferenceState()
      applyDefaultStoryboardReferenceImages(si)
      void syncSceneDetailAndRestore(si)
    } else {
      initVideoModelGen++
      resumeStoryboardVideoFollowGen++
      resumeStoryboardVideoPromptFollowGen++
      showStoryboardScriptModal.value = false
      saveEdgeVideoPromptToCache(currentStoryboardId.value)
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
  () => [currentStoryboardId.value, currentSceneIndex.value] as const,
  ([storyboardId, sceneIdx], prev) => {
    if (!props.open) return
    const prevStoryboardId = prev?.[0]
    if (storyboardId === prevStoryboardId) return
    if (prevStoryboardId) {
      saveEdgeVideoPromptToCache(prevStoryboardId)
      edgeFrameImagesByStoryboardId.value[String(prevStoryboardId)] = {
        first: firstFrameImage.value,
        last: lastFrameImage.value
      }
    }
    if (storyboardId !== prevStoryboardId && prevStoryboardId !== undefined) {
      resetStoryboardReferenceState()
      if (storyboardId) {
        const cached = edgeFrameImagesByStoryboardId.value[String(storyboardId)]
        firstFrameImage.value = cached?.first ?? null
        lastFrameImage.value = cached?.last ?? null
      } else {
        firstFrameImage.value = null
        lastFrameImage.value = null
      }
      applyDefaultStoryboardReferenceImages(sceneIdx)
    }
  }
)

watch(
  [resolvedMultiParamPromptAssets, multiParamPromptParamGroups],
  () => {
    if (videoPromptProgrammaticSyncDepth.value > 0) return
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
    if (videoPromptProgrammaticSyncDepth.value > 0) return
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

function resolveSceneCoverImageUrl(sceneIdx: number): string {
  const sp = resolveScriptPanelForSceneIndex(sceneIdx)
  const scene = props.scenes[sceneIdx]
  const cover = resolveStoryboardPanelCoverImage({
    images: sp?.images ?? scene?.storyboardImages,
    finalImageUrl: sp?.finalImageUrl
  })
  return String(cover?.thumbnail || cover?.url || '').trim()
}

function resolveSceneTabVideoUrl(sceneIdx: number, tabThumbnailUrl?: string): string {
  const fromTab = String(tabThumbnailUrl || '').trim()
  // headerTabs 里可能仍是视频记录 fileUrl；仅当没有封面图时留给当前 Tab 用
  if (fromTab && !/\.(png|jpe?g|webp|gif|bmp|svg)(\b|$)/i.test(fromTab.split('?')[0]!)) {
    return fromTab
  }
  return String(getFirstVideo(sceneIdx)?.url ?? '').trim()
}

const sceneTabsForHeader = computed(() =>
  headerTabsForDisplay.value.map((tab, i) => {
    const coverImageUrl = resolveSceneCoverImageUrl(i)
    const videoUrl = coverImageUrl ? '' : resolveSceneTabVideoUrl(i, tab.thumbnailUrl)
    return {
      storyboardId: tab.storyboardId,
      tabLabel: formatStoryboardVideoTabLabel(
        tab.name || props.scenes[i]?.name || '',
        tab.hasFinalAsset || !!getFirstVideo(i)?.url,
        i
      ),
      coverImageUrl,
      videoUrl,
      thumbnailUrl: coverImageUrl || videoUrl
    }
  })
)

const sceneTabBarRef = ref<InstanceType<typeof HorizontalScrollTabBar> | null>(null)

function scrollActiveSceneTabIntoView() {
  sceneTabBarRef.value?.scrollItemIntoView('.scene-image-tab.active')
  sceneTabBarRef.value?.refresh()
}

function switchScene(index: number) {
  if (index === currentSceneIndex.value) return
  const keepSid = sceneStoryboardIdNum(index)
  suspendOtherStoryboardVideoModalFollows(keepSid)
  pauseAllVideoPreviews()
  playingVideoIdx.value = -1
  videoPreviewRefs.clear()
  videoPreviewComponentRefs.clear()
  videoPreviewMediaReady.value = {}
  showStoryboardScriptModal.value = false
  leftPanelLoading.value = true
  rightPanelLoading.value = true
  currentSceneIndex.value = index
  selectedVideoIdx.value = 0
  void syncSceneDetailAndRestore(index)
  nextTick().then(() => {
    scrollActiveSceneTabIntoView()
    setTimeout(() => {
      leftPanelLoading.value = false
      rightPanelLoading.value = false
    }, TAB_SWITCH_SKELETON_MS)
  })
}

/** 顶部 Tab 互斥：挂起非当前分镜的视频 SSE */
function suspendOtherStoryboardVideoModalFollows(keepStoryboardId: number | null) {
  const keepKey = keepStoryboardId != null && keepStoryboardId > 0 ? String(keepStoryboardId) : ''
  const activeFollows: Array<{ tabKey: string; taskId: number }> = []
  for (const sid of activeStoryboardVideoModalOwnedFollowIds) {
    const task = findStoryboardVideoGenTaskInScopes(creationStore, sid, route)
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
  for (const sid of [...activeStoryboardVideoModalOwnedFollowIds]) {
    if (keepStoryboardId != null && sid === keepStoryboardId) continue
    activeStoryboardVideoModalOwnedFollowIds.delete(sid)
  }
}

function handleCancel() {
  pauseAllVideoPreviews()
  playingVideoIdx.value = -1
  videoPreviewRefs.clear()
  videoPreviewComponentRefs.clear()
  const sid = Number(props.scenes[currentSceneIndex.value]?.storyboardId)
  if (Number.isFinite(sid) && sid > 0) {
    // 关窗释放 live follow，保留 Pinia taskId 供下次打开弹窗恢复；dismiss 防止自动重开。
    if (
      findStoryboardVideoGenTaskInScopes(creationStore, sid, route) ||
      activeStoryboardVideoModalOwnedFollowIds.has(sid)
    ) {
      markStoryboardVideoModalUserDismissed(sid, storyboardVideoModalSessionScope())
    }
    activeStoryboardVideoModalOwnedFollowIds.delete(sid)
  }
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
  if (isGridVideoTab.value) {
    await runStoryboardVideoPromptGenerateFlow({
      sceneIdx,
      taskKind: 'grid-video-prompt-gen',
      loadingMessage: '正在生成宫格视频提示词...',
      successMessage: '宫格视频提示词生成成功',
      isGenerating: isGeneratingVideoPrompt,
      targetKey: videoPromptGenerateTargetKey,
      submit: async (ctx, storyboardId) => {
        const llmFields = await resolveGridVideoPromptSubmitFields()
        return userStoryboardGenerateVideoPromptGrid({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          storyboardIds: [storyboardId],
          ...llmFields
        })
      },
      fetchPromptAfterGenerate: fetchStoryboardImageToVideoPromptAfterGenerate,
      applyPrompt: applyVideoPromptFromApi
    })
    return
  }
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
  activeImageToVideoSettingKey.value =
    payload.activeVideoSettingKey as ImageToVideoSettingKey | null
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
  const { images, audios } = splitReferenceConfirmItems(items)
  applyImportedReferenceAudios(audios)
  if (!images.length) {
    if (audios.length) message.success(`已导入 ${audios.length} 条参考音频`)
    return
  }
  const list = images.map(mapMultiParamReferenceImportItem)
  if (getActiveStoryboardPanel()?.isParamSettingsOpen?.()) {
    for (const item of list) {
      getActiveStoryboardPanel()?.applyParamDraftAssets(inferMultiParamAssetType(item), [item])
    }
    message.success(
      audios.length
        ? `已导入 ${list.length} 张参考图、${audios.length} 条参考音频`
        : `已导入 ${list.length} 张参考图`
    )
    return
  }
  for (const item of list) {
    appendMultiParamAssetImages(inferMultiParamAssetType(item), [item])
  }
  message.success(
    audios.length
      ? `已导入 ${list.length} 张参考图、${audios.length} 条参考音频`
      : `已导入 ${list.length} 张参考图`
  )
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
  const { images, audios } = splitReferenceConfirmItems(items)
  applyImportedReferenceAudios(audios)
  if (!images.length) {
    if (audios.length) message.success(`已导入 ${audios.length} 条参考音频`)
    return
  }
  const mapped = normalizeImageToVideoReferenceItems(images.map(mapReferenceImportItem))
  const panel = getActiveStoryboardPanel()
  if (panel?.isParamSettingsOpen?.()) {
    panel.applyParamDraftReferences(mapped)
    message.success(audios.length ? '已导入参考图与参考音频' : '已导入参考图')
    return
  }
  referenceImages.value = mapped
  message.success(audios.length ? '已导入参考图与参考音频' : '已导入参考图')
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
  const src = resolveSafeHttpUrl(ref?.url || ref?.thumbnail, window.location.href)
  if (!src) return
  window.open(src, '_blank', 'noopener,noreferrer')
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

async function runStoryboardGridVideoGenerateTaskForScene(opts: {
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

  const modelName = String(gridVideoModel.value || '').trim()
  if (!modelName) {
    message.warning('请先选择宫格视频模型')
    return
  }

  const durationSec = Number(videoDuration.value)
  const body = {
    storyboardIds: [storyboardId],
    modelName,
    videoPrompt: opts.videoPrompt?.trim() || undefined,
    aspectRatio: videoAspectRatio.value || undefined,
    durationSeconds:
      videoConfigShowDuration.value && Number.isFinite(durationSec) && durationSec > 0
        ? durationSec
        : undefined,
    ...buildStoryboardVideoResolutionField(videoQuality.value),
    count: videoCount.value,
    generateAudio: resolveCurrentGenerateAudio(),
    ...buildGenerateReferenceAudioFields(referenceAudios.value),
    userInputText: opts.userInputText
  }

  persistVideoGenerateSettings(modelName)

  await runStoryboardVideoGenerateForScene(opts.sceneIdx, {
    taskKind: 'grid',
    submitGridBody: body,
    progressSubmit: opts.progressSubmit,
    progressRunning: opts.progressRunning
  })
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

async function handleGridVideoStartGenerate() {
  if (showGridVideoGenerateLoading.value) return
  const promptPlain = imageToVideoPromptPlain.value.trim()
  if (!promptPlain) {
    message.warning('请输入视频提示词，或先生成提示词')
    return
  }
  const validation = validateGridVideoPromptPlain(promptPlain)
  if (validation.ok === false) {
    message.warning(validation.message)
    return
  }
  const supplementary = cameraMovementDesc.value.trim().slice(0, 500)
  await runStoryboardGridVideoGenerateTaskForScene({
    sceneIdx: currentSceneIndex.value,
    progressSubmit: '宫格视频任务提交中…',
    progressRunning: '宫格视频生成中…',
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

function copyEdgeVideoPrompt() {
  const plain = edgeVideoPromptPlain.value
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

function mapEdgeFrameImportItem(item: any): EdgeFrameImage {
  const serverRow = item?._serverRow
  const recordId = Number(serverRow?.id ?? item?.id)
  const idStr = String(item?.id ?? '')
  const isGenRecord =
    !!item?._fromServer &&
    Number.isFinite(recordId) &&
    recordId > 0 &&
    !idStr.startsWith('local-') &&
    !idStr.startsWith('sb-ref-') &&
    !idStr.startsWith('ref-') &&
    !idStr.startsWith('proj-') &&
    !idStr.startsWith('lib-')
  return {
    ...item,
    id: isGenRecord ? recordId : item.id || `local-${Date.now()}`,
    url: item.url || item.thumbnail,
    thumbnail: item.thumbnail || item.url,
    title: item.title || item.name,
    _fromServer: isGenRecord,
    _serverRow: isGenRecord ? { id: recordId } : serverRow
  }
}

function buildEdgeFrameApiFields(frame: EdgeFrameImage | null, role: 'first' | 'last') {
  if (!frame) return {}
  const url = String(frame.url || frame.thumbnail || '').trim()
  const recordId = Number(frame._serverRow?.id)
  const canUseRecordId = !!frame._fromServer && Number.isFinite(recordId) && recordId > 0

  if (url) {
    return role === 'first' ? { firstImageUrl: url } : { lastImageUrl: url }
  }
  if (canUseRecordId) {
    return role === 'first' ? { firstImageRecordId: recordId } : { lastImageRecordId: recordId }
  }
  return {}
}

function validateEdgeFrameImages(): boolean {
  const firstFields = buildEdgeFrameApiFields(firstFrameImage.value, 'first')
  if (!firstFields.firstImageUrl && !firstFields.firstImageRecordId) {
    message.warning('请选首帧')
    return false
  }
  return true
}

function onEdgeFrameCardClick(target: 'first' | 'last') {
  const current = target === 'first' ? firstFrameImage.value : lastFrameImage.value
  if (current?.url || current?.thumbnail) {
    previewAssetImage(current)
    return
  }
  edgeFramePickTarget.value = target
  selectEdgeFrameModalOpen.value = true
}

function onSelectEdgeFrameConfirm(items: any[]) {
  if (!items?.length) return
  const { images, audios } = splitReferenceConfirmItems(items)
  applyImportedReferenceAudios(audios)
  const imageItem = images[0]
  if (!imageItem) {
    if (audios.length) message.success(`已导入 ${audios.length} 条参考音频`)
    return
  }
  const mapped = mapEdgeFrameImportItem(imageItem)
  if (edgeFramePickTarget.value === 'first') {
    firstFrameImage.value = mapped
  } else {
    lastFrameImage.value = mapped
  }
  message.success(
    audios.length
      ? `已导入${edgeFramePickTarget.value === 'first' ? '首帧' : '尾帧'}与参考音频`
      : `已导入${edgeFramePickTarget.value === 'first' ? '首帧' : '尾帧'}`
  )
}

function clearEdgeFrame(target: 'first' | 'last') {
  if (target === 'first') firstFrameImage.value = null
  else lastFrameImage.value = null
}

function cloneEdgeFrameImage(frame: EdgeFrameImage | null): EdgeFrameImage | null {
  if (!frame) return null
  return {
    ...frame,
    _serverRow: frame._serverRow ? { ...frame._serverRow } : undefined
  }
}

function swapEdgeFrames() {
  const first = firstFrameImage.value
  const last = lastFrameImage.value
  if (!first && !last) {
    message.warning('请先上传首帧或尾帧')
    return
  }
  firstFrameImage.value = cloneEdgeFrameImage(last)
  lastFrameImage.value = cloneEdgeFrameImage(first)
  message.success('已交换首尾帧')
}

async function runStoryboardEdgeVideoGenerateTaskForScene(opts: {
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

  if (!validateEdgeFrameImages()) return

  const modelName = String(edgeVideoModel.value || '').trim()
  const durationSec = Number(videoDuration.value)
  const promptPlain = opts.videoPrompt?.trim() || edgeVideoPromptPlain.value.trim()
  const firstFields = buildEdgeFrameApiFields(firstFrameImage.value, 'first')
  const lastFields = buildEdgeFrameApiFields(lastFrameImage.value, 'last')
  const audioFields = buildGenerateReferenceAudioFields(referenceAudios.value)
  const item = {
    storyboardId,
    ...firstFields,
    ...lastFields,
    ...(audioFields.referenceAudioIds ? { referenceAudioIds: audioFields.referenceAudioIds } : {})
  }
  const count = Math.min(4, Math.max(1, Number(videoCount.value) || 1))
  const body = {
    storyboardIds: [storyboardId],
    items: [item],
    ...(modelName ? { modelName } : {}),
    ...(promptPlain ? { videoPrompt: promptPlain } : {}),
    aspectRatio: videoAspectRatio.value || undefined,
    durationSeconds:
      videoConfigShowDuration.value && Number.isFinite(durationSec) && durationSec > 0
        ? durationSec
        : undefined,
    ...buildStoryboardVideoResolutionField(videoQuality.value),
    count,
    generateAudio: resolveCurrentGenerateAudio(),
    ...(opts.userInputText?.trim()
      ? { userInputText: opts.userInputText.trim().slice(0, 500) }
      : {})
  }

  if (modelName) persistVideoGenerateSettings(modelName)

  await runStoryboardVideoGenerateForScene(opts.sceneIdx, {
    taskKind: 'edge',
    submitEdgeBody: body,
    progressSubmit: opts.progressSubmit,
    progressRunning: opts.progressRunning
  })
}

async function handleEdgeVideoStartGenerate() {
  if (showEdgeVideoGenerateLoading.value) return
  const promptPlain = edgeVideoPromptPlain.value.trim()
  if (promptPlain) {
    const validation = validateEdgeVideoPromptPlain(promptPlain)
    if (validation.ok === false) {
      message.warning(validation.message)
      return
    }
  }
  if (!currentStoryboardId.value) {
    message.warning('分镜ID缺失，无法发起生成')
    return
  }
  await runStoryboardEdgeVideoGenerateTaskForScene({
    sceneIdx: currentSceneIndex.value,
    progressSubmit: '首尾帧视频任务提交中…',
    progressRunning: '首尾帧视频生成中…',
    videoPrompt: promptPlain || undefined
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
    const type =
      materialLibraryCategoryKey.value === 'misc' ? 'other' : materialLibraryCategoryKey.value
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
  openImagePreviewModal({
    url,
    title: img?.title || img?.name || '预览'
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

async function resolveStoryboardVideoRecordIdForUnset(
  video: any,
  storyboardId: number
): Promise<number | null> {
  const direct = resolveStoryboardVideoRecordId(video)
  if (direct) return direct
  const rows = await fetchProjectRecordsForStoryboard(storyboardId, 'video')
  return resolveStoryboardVideoRecordIdFromRows(video, rows)
}

async function persistManualStoryboardVideoUrl(videoUrl: string): Promise<number | null> {
  const url = videoUrl.trim()
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
    mediaType: 'video'
  })
  const recordId = Number(record?.id)
  return Number.isFinite(recordId) && recordId > 0 ? recordId : null
}

async function resolveOrPersistStoryboardVideoRecordId(video: any): Promise<number | null> {
  const existing = resolveStoryboardVideoRecordId(video)
  if (existing) return existing
  return persistManualStoryboardVideoUrl(String(video?.url || ''))
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

  if (!String(video.url || '').trim()) {
    message.warning('产物未完成')
    return
  }

  isSettingFinalVideo.value = true
  try {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      message.warning('缺少项目信息，无法设置主视频')
      return
    }

    const recordId = await resolveOrPersistStoryboardVideoRecordId(video)
    if (!recordId) {
      message.warning('视频落库失败，无法设为分镜视频')
      return
    }

    await userStoryboardSetFinalVideo({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      storyboardId,
      recordId
    })
    clearProjectStoryboardRecordCache(ctx)
    await refreshHeaderTabs(true)
    creationStore.clearStoryboardPanelVideoGenError(storyboardId)
    creationStore.clearStoryboardPanelVideoGenStatus(storyboardId)
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

  let recordId = resolveStoryboardVideoRecordId(video)
  if (!recordId) {
    recordId = await resolveStoryboardVideoRecordIdForUnset(video, storyboardId)
  }
  if (!recordId) {
    message.warning('分镜信息异常，请刷新后重试')
    return
  }

  isSettingFinalVideo.value = true
  try {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    await userStoryboardUnSetFinalVideo({
      ...(ctx ? { projectId: ctx.projectId, episodeId: ctx.episodeId } : {}),
      storyboardId,
      recordId
    })
    if (ctx) clearProjectStoryboardRecordCache(ctx)
    await refreshHeaderTabs(true)
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
const videoPreviewComponentRefs = new Map<number, unknown>()
const videoPreviewMediaReady = ref<Record<number, boolean>>({})

function resolveShimmerVideoEl(el: unknown): HTMLVideoElement | null {
  if (!el) return null
  if (el instanceof HTMLVideoElement) return el
  const ref = (el as { videoRef?: HTMLVideoElement | null | { value?: HTMLVideoElement | null } })
    .videoRef
  if (ref instanceof HTMLVideoElement) return ref
  if (ref && typeof ref === 'object' && 'value' in ref) return ref.value ?? null
  return null
}

function syncVideoPreviewRef(idx: number) {
  const video = resolveShimmerVideoEl(videoPreviewComponentRefs.get(idx))
  if (video) videoPreviewRefs.set(idx, video)
  else videoPreviewRefs.delete(idx)
}

function setVideoPreviewRef(el: unknown, idx: number) {
  if (el) videoPreviewComponentRefs.set(idx, el)
  else videoPreviewComponentRefs.delete(idx)
  syncVideoPreviewRef(idx)
}

function getVideoPreviewEl(idx: number): HTMLVideoElement | null {
  const cached = videoPreviewRefs.get(idx)
  if (cached) return cached
  syncVideoPreviewRef(idx)
  return videoPreviewRefs.get(idx) ?? null
}

function markVideoPreviewMediaReady(idx: number) {
  videoPreviewMediaReady.value = { ...videoPreviewMediaReady.value, [idx]: true }
  syncVideoPreviewRef(idx)
}

function pauseAllVideoPreviews(exceptIdx = -1) {
  videoPreviewRefs.forEach((videoEl, i) => {
    if (i === exceptIdx) return
    videoEl.pause()
    videoEl.currentTime = 0
    videoEl.muted = true
  })
}

async function toggleVideoPreviewPlayback(idx: number) {
  const v = currentSceneVideos.value[idx]
  if (!v?.url) return

  const videoEl = getVideoPreviewEl(idx)
  if (!videoEl) return

  if (!videoEl.paused) {
    videoEl.pause()
    videoEl.muted = true
    playingVideoIdx.value = -1
    return
  }

  pauseAllVideoPreviews(idx)
  if (videoEl.ended) videoEl.currentTime = 0
  videoEl.muted = false
  playingVideoIdx.value = idx
  selectedVideoIdx.value = idx
  try {
    await videoEl.play()
  } catch {
    playingVideoIdx.value = -1
    videoEl.muted = true
    message.warning('无法自动播放，请稍后重试')
  }
}

const canToggleVideoPreviewWithSpace = computed(
  () => modalOpen.value && currentSceneVideos.value.some((video) => Boolean(video?.url))
)

function toggleSelectedVideoPreviewPlayback() {
  const currentPlayingIdx = playingVideoIdx.value
  if (currentPlayingIdx >= 0) {
    void toggleVideoPreviewPlayback(currentPlayingIdx)
    return
  }

  const selectedIdx = selectedVideoIdx.value
  const targetIdx = currentSceneVideos.value[selectedIdx]?.url
    ? selectedIdx
    : currentSceneVideos.value.findIndex((video) => Boolean(video?.url))
  if (targetIdx >= 0) void toggleVideoPreviewPlayback(targetIdx)
}

useVideoPlaybackSpaceShortcut(canToggleVideoPreviewWithSpace, toggleSelectedVideoPreviewPlayback)

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
  const videoEl = getVideoPreviewEl(idx)
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

    const hideLoading = message.loading('正在上传视频...', 0)
    try {
      const url = await uploadVideoToOssWithToast(file)
      if (!url) return

      await userStoryboardUpload({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardId,
        imageUrl: url,
        mediaType: 'video'
      })
      await refreshVideoRecords(currentSceneIndex.value, { focusLatest: true })
      message.success('视频已添加')
    } catch (err: unknown) {
      const ax = err as { msg?: string; message?: string }
      message.error(ax?.msg || ax?.message || '视频上传失败，请重试')
    } finally {
      hideLoading()
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
  if (!url) {
    message.error('视频地址无效')
    return
  }

  void (async () => {
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

    const hideLoading = message.loading('正在导入视频...', 0)
    try {
      await userStoryboardUpload({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        storyboardId,
        imageUrl: url,
        mediaType: 'video'
      })
      await refreshVideoRecords(currentSceneIndex.value, { focusLatest: true })
      message.success('视频已添加')
    } catch (err: unknown) {
      const ax = err as { msg?: string; message?: string }
      message.error(ax?.msg || ax?.message || '视频导入失败，请重试')
    } finally {
      hideLoading()
    }
  })()
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
          const ctx = await resolveStoryScriptSaveContext(creationStore, route)
          await userStoryboardRecordDelete({ storyboardId, recordId })
          if (ctx) clearProjectStoryboardRecordCache(ctx)
          await refreshVideoRecords(currentSceneIndex.value, { force: true })
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

useCreateFlowScopeChangedResume(() => {
  if (!props.open) return
  const si = currentSceneIndex.value
  void (async () => {
    await ensureModalVideoLoadingRestored(si)
    void restoreStoryboardVideoPromptGenerateIfNeeded(si)
    void restoreStoryboardVideoGenerateIfNeeded(si)
  })()
})
</script>

<style lang="scss" scoped src="~/assets/css/edit-storyboard-video-modal.scoped.scss"></style>
