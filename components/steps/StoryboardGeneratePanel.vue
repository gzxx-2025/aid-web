<template>
  <div
    ref="panelRootRef"
    :class="[
      'storyboard-generate-panel',
      {
        'is-compact-height': isCompactHeight && !useParamSettingsModal,
        'use-param-modal': useParamSettingsModal
      }
    ]"
    :style="panelCssVars"
  >
    <div ref="headerWrapRef">
      <PromptScriptFileHeader
        :icon-type="iconType"
        :theme="headerTheme"
        :file-name="sceneFileName"
        :show-reference-button="showReferenceButton"
        :reference-display-mode="referenceDisplayMode"
        :show-generate-prompt-button="showGeneratePromptButton"
        :generate-prompt-loading="generatePromptLoading"
        :show-save-prompt-button="showSavePromptButton"
        :save-prompt-loading="savePromptLoading"
        :scene-file-clickable="sceneFileClickable"
        @click-file="onSceneFileClick"
        @import-reference="$emit('importReference')"
        @generate-prompt="$emit('generatePrompt')"
      />
    </div>

    <div
      v-if="!useParamSettingsModal"
      :class="['storyboard-top', { 'storyboard-top-expanded': isSettingExpanded }]"
    >
      <div class="storyboard-left-col">
        <div class="asset-panel">
          <!-- 分镜视频·图生视频：九宫格多机位 + 单张参考图（与编辑分镜脚本同一套布局组件） -->
          <template v-if="mode === 'storyboardVideo'">
            <div class="asset-row asset-row-switch">
              <div class="asset-label">
                <span class="asset-dot" />
                九宫格多机位
              </div>
              <a-switch
                :checked="nineGridEnabled"
                :disabled="!referenceImage"
                size="small"
                @update:checked="$emit('update:nineGridEnabled', $event)"
              />
            </div>
            <div class="asset-row">
              <div class="asset-reference-single">
                <div class="asset-reference-item" @click="onStoryboardVideoReferenceClick">
                  <a-image
                    v-if="referenceImage?.url || referenceImage?.thumbnail"
                    :src="String(referenceImage?.url || referenceImage?.thumbnail || '')"
                    :preview="false"
                    class="asset-reference-img"
                  />
                  <div v-else class="asset-reference-placeholder">
                    <img src="@/assets/img/icon/dialog-add.svg" alt="">
                    <span>导入参考图</span>
                  </div>
                  <div
                    v-if="referenceImage?.url || referenceImage?.thumbnail"
                    class="asset-reference-remove"
                    @click.stop="$emit('clearReference')"
                  >
                    <CloseOutlined />
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
          <!-- 场景 -->
          <div class="asset-row">
            <div class="asset-label">场景</div>
            <div class="asset-horizontal-wrap">
              <button
                v-if="sceneImages.length > 1"
                type="button"
                class="asset-arrow asset-arrow-left"
                @click="scrollRow('scene', -1)"
              >
                <LeftOutlined />
              </button>
              <div ref="sceneRowRef" class="asset-horizontal">
                <div
                  v-for="(img, idx) in sceneImages"
                  :key="img.id || idx"
                  class="asset-thumb-item"
                  @click="$emit('previewAssetImage', img)"
                >
                  <a-image
                    v-if="img.url || img.thumbnail"
                    :src="img.url || img.thumbnail"
                    :preview="false"
                    class="asset-thumb-img"
                  />
                  <span class="asset-thumb-name">{{ img.title || img.name || '场景' }}</span>
                </div>
                <button
                  type="button"
                  class="asset-card asset-card-inline"
                  @click="$emit('openSelectModal', 'scene')"
                >
                  <div class="asset-icon"><img src="@/assets/img/icon/dialog-add.svg" alt=""></div>
                  <span>导入场景</span>
                </button>
              </div>
              <button
                v-if="sceneImages.length > 1"
                type="button"
                class="asset-arrow asset-arrow-right"
                @click="scrollRow('scene', 1)"
              >
                <RightOutlined />
              </button>
            </div>
          </div>
          <!-- 角色 -->
          <div class="asset-row">
            <div class="asset-label">角色</div>
            <div class="asset-horizontal-wrap">
              <button
                v-if="characterImages.length > 1"
                type="button"
                class="asset-arrow asset-arrow-left"
                @click="scrollRow('character', -1)"
              >
                <LeftOutlined />
              </button>
              <div ref="characterRowRef" class="asset-horizontal">
                <div
                  v-for="(img, idx) in characterImages"
                  :key="img.id || idx"
                  class="asset-thumb-item"
                  @click="$emit('previewAssetImage', img)"
                >
                  <a-image
                    v-if="img.url || img.thumbnail"
                    :src="img.url || img.thumbnail"
                    :preview="false"
                    class="asset-thumb-img"
                  />
                  <span class="asset-thumb-name">{{ img.title || img.name || '角色' }}</span>
                </div>
                <button
                  type="button"
                  class="asset-card asset-card-inline"
                  @click="$emit('openSelectModal', 'character')"
                >
                  <div class="asset-icon"><img src="@/assets/img/icon/dialog-add.svg" alt=""></div>
                  <span>导入角色</span>
                </button>
              </div>
              <button
                v-if="characterImages.length > 1"
                type="button"
                class="asset-arrow asset-arrow-right"
                @click="scrollRow('character', 1)"
              >
                <RightOutlined />
              </button>
            </div>
          </div>
          <!-- 道具 -->
          <div class="asset-row">
            <div class="asset-label">道具</div>
            <div class="asset-horizontal-wrap">
              <button
                v-if="propImages.length > 1"
                type="button"
                class="asset-arrow asset-arrow-left"
                @click="scrollRow('prop', -1)"
              >
                <LeftOutlined />
              </button>
              <div ref="propRowRef" class="asset-horizontal">
                <div
                  v-for="(img, idx) in propImages"
                  :key="img.id || idx"
                  class="asset-thumb-item"
                  @click="$emit('previewAssetImage', img)"
                >
                  <a-image
                    v-if="img.url || img.thumbnail"
                    :src="img.url || img.thumbnail"
                    :preview="false"
                    class="asset-thumb-img"
                  />
                  <span class="asset-thumb-name">{{ img.title || img.name || '道具' }}</span>
                </div>
                <button
                  type="button"
                  class="asset-card asset-card-inline"
                  @click="$emit('openSelectModal', 'prop')"
                >
                  <div class="asset-icon"><img src="@/assets/img/icon/dialog-add.svg" alt=""></div>
                  <span>导入道具</span>
                </button>
              </div>
              <button
                v-if="propImages.length > 1"
                type="button"
                class="asset-arrow asset-arrow-right"
                @click="scrollRow('prop', 1)"
              >
                <RightOutlined />
              </button>
            </div>
          </div>
          <!-- 其他：四宫格 + 与场景一致的缩略图横滑；引用以 @名称 展示在下方描述文本域 -->
          <div class="asset-row asset-row-other">
            <div class="asset-label">其他</div>
            <div class="asset-other-content">
              <div class="asset-grid asset-grid-other-top">
                <button
                  type="button"
                  class="asset-card small"
                  @click="$emit('openSelectModal', 'pose')"
                >
                  <div class="asset-icon"><img src="@/assets/img/icon/dialog-add.svg" alt=""></div>
                  <span>姿态图</span>
                </button>
                <button
                  type="button"
                  class="asset-card small"
                  @click="$emit('openSelectModal', 'expression')"
                >
                  <div class="asset-icon"><img src="@/assets/img/icon/dialog-add.svg" alt=""></div>
                  <span>表情图</span>
                </button>
                <button
                  type="button"
                  class="asset-card small"
                  @click="$emit('openSelectModal', 'effect')"
                >
                  <div class="asset-icon"><img src="@/assets/img/icon/dialog-add.svg" alt=""></div>
                  <span>特效图</span>
                </button>
                <button
                  type="button"
                  class="asset-card small"
                  @click="$emit('openSelectModal', 'draft')"
                >
                  <div class="asset-icon"><img src="@/assets/img/icon/dialog-add.svg" alt=""></div>
                  <span>手绘稿</span>
                </button>
              </div>
              <!-- 仅有「姿态/表情/特效/手绘」四类入口；导入缩略图后才显示横滑与「导入其他」 -->
              <div v-if="otherImages.length > 0" class="asset-horizontal-wrap">
                <div class="asset-horizontal">
                  <div
                    v-for="(img, idx) in otherImages"
                    :key="img.id || idx"
                    class="asset-thumb-item asset-thumb-item--removable"
                    @click="$emit('previewAssetImage', img)"
                  >
                    <a-image
                      v-if="img.url || img.thumbnail"
                      :src="img.url || img.thumbnail"
                      :preview="false"
                      class="asset-thumb-img"
                    />
                    <span class="asset-thumb-name">{{ img.title || img.name || '参考' }}</span>
                    <button
                      type="button"
                      class="asset-thumb-remove"
                      title="移除"
                      @click.stop="$emit('removeOtherImage', idx)"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    type="button"
                    class="asset-card asset-card-inline"
                    @click="$emit('openSelectModal', 'other')"
                  >
                    <div class="asset-icon">+</div>
                    <span>导入其他</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          </template>
        </div>
        <!-- 展开时：描述框在左侧栏下方 -->
        <div v-if="isSettingExpanded" class="storyboard-prompt storyboard-prompt-in-left-col">
          <RichTextEditor
            ref="promptEditorExpandedRef"
            :model-value="prompt"
            :placeholder="promptPlaceholder"
            :min-height="promptHeightExpanded"
            :max-height="promptHeightExpanded"
            :max-length="3000"
            :enable-prompt-asset-refs="enablePromptAssetRefs"
            :prompt-assets="storyboardPromptAssets"
            :enable-prompt-param-refs="enablePromptParamRefs"
            :prompt-param-groups="storyboardPromptParamGroups"
            @update:model-value="$emit('update:prompt', $event)"
            @prompt-param-change="onPromptParamChange"
          />
            <div class="prompt-footer">
            <div class="prompt-actions">
              <a-button
                v-if="showSavePromptButton"
                type="primary"
                size="small"
                class="save-prompt-btn"
                :loading="savePromptLoading"
                :disabled="savePromptLoading || generatePromptLoading"
                @click="$emit('savePrompt')"
              >
                保存提示词
              </a-button>
              <a-button type="text" size="small" @click="$emit('copyPrompt')"
                ><CopyOutlined
              /></a-button>
              <a-button type="text" size="small" @click="$emit('update:prompt', '')"
                ><DeleteOutlined
              /></a-button>
            </div>
          </div>
        </div>
      </div>
      <div :class="['setting-panel', { expanded: isSettingExpanded }]">
        <div class="setting-body">
          <!-- 分镜视频·图生视频：镜头运动 + 特殊拍摄手法 -->
          <template v-if="mode === 'storyboardVideo'">
            <div class=" setting-field">
              <div class="setting-title">镜头运动</div>
              <SettingSelectField
                :model-value="selectedCameraMovement"
                :options="cameraMovementOptions"
                placeholder="请选择镜头运动"
                panel-title="选择镜头运动"
                :open="activeVideoSettingKey === 'cameraMovement'"
                @update:open="
                  (v: boolean) =>
                    $emit('update:activeVideoSettingKey', v ? 'cameraMovement' : null)
                "
                @update:model-value="$emit('update:selectedCameraMovement', $event)"
              />
              <div class="setting-textarea">
                <a-input
                  :model-value="cameraMovementDesc"
                  placeholder="请输入镜头运动描述"
                  class="setting-input-with-actions"
                  @update:model-value="$emit('update:cameraMovementDesc', $event)"
                >
                  <template #suffix>
                    <DeleteOutlined
                      class="input-action"
                      @click.stop="$emit('update:cameraMovementDesc', '')"
                    />
                    <CopyOutlined class="input-action" @click.stop="$emit('copyCameraMovementDesc')" />
                  </template>
                </a-input>
              </div>
            </div>
            <div class="setting-field">
              <div class="setting-title">特殊拍摄手法</div>
              <SettingSelectField
                :model-value="selectedShootingTechnique"
                :options="shootingTechniqueOptions"
                placeholder="请选择特殊拍摄手法"
                panel-title="选择特殊拍摄手法"
                :open="activeVideoSettingKey === 'shootingTechnique'"
                @update:open="
                  (v: boolean) =>
                    $emit('update:activeVideoSettingKey', v ? 'shootingTechnique' : null)
                "
                @update:model-value="$emit('update:selectedShootingTechnique', $event)"
              />
            </div>
          </template>
          <!-- 多参生视频：仅特殊拍摄手法 -->
          <template v-else-if="mode === 'imageToVideo'">
            <div class="setting-field">
              <div class="setting-title">特殊拍摄手法</div>
              <SettingSelectField
                :model-value="selectedShootingTechnique"
                :options="shootingTechniqueOptions"
                placeholder="请选择特殊拍摄手法"
                panel-title="选择特殊拍摄手法"
                :open="activeVideoSettingKey === 'shootingTechnique'"
                @update:open="
                  (v: boolean) =>
                    $emit('update:activeVideoSettingKey', v ? 'shootingTechnique' : null)
                "
                @update:model-value="$emit('update:selectedShootingTechnique', $event)"
              />
            </div>
          </template>
          <!-- 生成分镜图：构图、景别、拍摄角度等 7 项 -->
          <template v-else>
            <div class="setting-field">
              <div class="setting-title">构图</div>
              <SettingSelectField
                :model-value="selectedComposition"
                :options="compositionOptions"
                placeholder="请选择构图"
                panel-title="选择构图"
                :open="activeSettingKey === 'composition'"
                @update:open="
                  (v: boolean) => $emit('update:activeSettingKey', v ? 'composition' : null)
                "
                @update:model-value="$emit('update:selectedComposition', $event)"
              />
              <div class="setting-textarea">
                <RichTextEditor
                  :model-value="compositionDesc ?? ''"
                  min-height="52px"
                  placeholder="请输入构图描述"
                  @update:model-value="$emit('update:compositionDesc', $event)"
                />
                <div class="setting-actions">
                  <a-button type="text" size="small" @click="$emit('copyCompositionDesc')"
                    ><CopyOutlined
                  /></a-button>
                  <a-button
                    type="text"
                    size="small"
                    @click="$emit('update:compositionDesc', '')"
                    ><DeleteOutlined
                  /></a-button>
                </div>
              </div>
            </div>
            <div class="setting-field">
              <div class="setting-title">景别</div>
              <SettingSelectField
                :model-value="selectedShotSize"
                :options="shotSizeOptions"
                placeholder="请选择景别"
                panel-title="选择景别"
                :open="activeSettingKey === 'shotSize'"
                @update:open="
                  (v: boolean) => $emit('update:activeSettingKey', v ? 'shotSize' : null)
                "
                @update:model-value="$emit('update:selectedShotSize', $event)"
              />
            </div>
            <div class="setting-field">
              <div class="setting-title">拍摄角度</div>
              <SettingSelectField
                :model-value="selectedCameraAngle"
                :options="cameraAngleOptions"
                placeholder="请选择拍摄角度"
                panel-title="选择拍摄角度"
                :open="activeSettingKey === 'cameraAngle'"
                @update:open="
                  (v: boolean) => $emit('update:activeSettingKey', v ? 'cameraAngle' : null)
                "
                @update:model-value="$emit('update:selectedCameraAngle', $event)"
              />
            </div>
            <div class="setting-field">
              <div class="setting-title">镜头焦距</div>
              <SettingSelectField
                :model-value="selectedFocalLength"
                :options="focalLengthOptions"
                placeholder="请选择镜头焦距"
                panel-title="选择镜头焦距"
                :open="activeSettingKey === 'focalLength'"
                @update:open="
                  (v: boolean) => $emit('update:activeSettingKey', v ? 'focalLength' : null)
                "
                @update:model-value="$emit('update:selectedFocalLength', $event)"
              />
            </div>
            <div class="setting-field">
              <div class="setting-title">色彩倾向</div>
              <SettingSelectField
                :model-value="selectedColorTone"
                :options="colorToneOptions"
                placeholder="请选择色彩倾向"
                panel-title="选择色彩倾向"
                :open="activeSettingKey === 'colorTone'"
                @update:open="
                  (v: boolean) => $emit('update:activeSettingKey', v ? 'colorTone' : null)
                "
                @update:model-value="$emit('update:selectedColorTone', $event)"
              />
            </div>
            <div class="setting-field">
              <div class="setting-title">光线</div>
              <SettingSelectField
                :model-value="selectedLighting"
                :options="lightingOptions"
                placeholder="请选择光线"
                panel-title="选择光线"
                :open="activeSettingKey === 'lighting'"
                @update:open="
                  (v: boolean) => $emit('update:activeSettingKey', v ? 'lighting' : null)
                "
                @update:model-value="$emit('update:selectedLighting', $event)"
              />
            </div>
            <div class="setting-field">
              <div class="setting-title">摄影技法</div>
              <SettingSelectField
                :model-value="selectedTechnique"
                :options="techniqueOptions"
                placeholder="请选择摄影技法"
                panel-title="选择摄影技法"
                :open="activeSettingKey === 'technique'"
                @update:open="
                  (v: boolean) => $emit('update:activeSettingKey', v ? 'technique' : null)
                "
                @update:model-value="$emit('update:selectedTechnique', $event)"
              />
            </div>
          </template>
        </div>
        <div class="setting-header" @click="$emit('update:isSettingExpanded', !isSettingExpanded)">
          <div class="text-gradient">
            <span>{{ isSettingExpanded ? '收起' : '展开' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 参数弹窗模式：描述框撑满中间区域 -->
    <div
      v-if="useParamSettingsModal"
      ref="promptCollapsedRef"
      class="storyboard-prompt storyboard-prompt-full storyboard-prompt-modal create-modal-prompt-shell"
    >
      <!-- 分镜视频·图生视频：参考图导入区（替代灵感空间入口） -->
      <div v-if="mode === 'storyboardVideo'" class="i2v-reference-strip">
        <div class="i2v-reference-list">
          <div
            v-for="(img, idx) in storyboardVideoReferenceList"
            :key="img.id || `ref-${idx}`"
            class="i2v-reference-thumb"
            @click="onStoryboardVideoReferenceThumbClick(img)"
          >
            <img :src="img.url || img.thumbnail" :alt="img.title || img.name || `参考图${idx + 1}`" />
            <button
              type="button"
              class="i2v-reference-thumb__remove"
              @click.stop="removeStoryboardVideoReference(idx)"
            >
              <CloseOutlined />
            </button>
          </div>
          <button
            v-if="storyboardVideoReferenceList.length < 1"
            type="button"
            class="i2v-reference-thumb i2v-reference-thumb--adder"
            @click="emit('importReference')"
          >
            <PlusOutlined />
            <span class="adder-text">导入参考图</span>
          </button>
        </div>
      </div>
      <!-- 多参生视频：场景/角色/道具参考图导入区 -->
      <div v-else-if="mode === 'imageToVideo'" class="i2v-reference-strip">
        <div class="i2v-reference-list">
          <div
            v-for="(img, idx) in multiParamAssetReferenceList"
            :key="img.id || `multi-ref-${idx}`"
            class="i2v-reference-thumb"
            @click="emit('previewAssetImage', img)"
          >
            <img :src="img.url || img.thumbnail" :alt="img.title || img.name || `参考图${idx + 1}`" />
            <button
              type="button"
              class="i2v-reference-thumb__remove"
              @click.stop="removeMultiParamAssetReference(idx)"
            >
              <CloseOutlined />
            </button>
          </div>
          <button
            type="button"
            class="i2v-reference-thumb i2v-reference-thumb--adder"
            @click="emit('importReference')"
          >
            <PlusOutlined />
            <span class="adder-text">导入参考图</span>
          </button>
        </div>
      </div>
      <RichTextEditor
        ref="promptEditorCollapsedRef"
        :model-value="prompt"
        :placeholder="promptPlaceholder"
        min-height="120px"
        :max-length="3000"
        :enable-prompt-asset-refs="enablePromptAssetRefs"
        :prompt-assets="storyboardPromptAssets"
        :enable-prompt-param-refs="enablePromptParamRefs"
        :prompt-param-groups="storyboardPromptParamGroups"
        @update:model-value="$emit('update:prompt', $event)"
        @prompt-param-change="onPromptParamChange"
      />
      <div class="prompt-footer prompt-footer-modal">
        <div class="prompt-actions">
          <a-button type="text" size="small" @click="$emit('copyPrompt')"
            ><CopyOutlined
          /></a-button>
          <a-button type="text" size="small" @click="$emit('update:prompt', '')"
            ><DeleteOutlined
          /></a-button>
        </div>
        <div v-if="mode !== 'storyboardVideo' && mode !== 'imageToVideo'" class="prompt-footer-right">
          <button type="button" class="param-settings-btn" @click="paramSettingsOpen = true">
            <div class="text-gradient"><span>灵感空间</span></div>
          </button>
        </div>
      </div>
    </div>

    <!-- 未展开时：描述框占满一行（内联模式） -->
    <div
      v-else-if="!isSettingExpanded"
      ref="promptCollapsedRef"
      class="storyboard-prompt storyboard-prompt-full"
    >
      <RichTextEditor
        ref="promptEditorCollapsedRef"
        :model-value="prompt"
        :placeholder="promptPlaceholder"
        :min-height="promptHeightCollapsed"
        :max-height="promptHeightCollapsed"
        :max-length="3000"
        :enable-prompt-asset-refs="enablePromptAssetRefs"
        :prompt-assets="storyboardPromptAssets"
        :enable-prompt-param-refs="enablePromptParamRefs"
        :prompt-param-groups="storyboardPromptParamGroups"
        @update:model-value="$emit('update:prompt', $event)"
        @prompt-param-change="onPromptParamChange"
      />
      <div class="prompt-footer">
        <div class="prompt-actions">
          <a-button type="text" size="small" @click="$emit('copyPrompt')"
            ><CopyOutlined
          /></a-button>
          <a-button type="text" size="small" @click="$emit('update:prompt', '')"
            ><DeleteOutlined
          /></a-button>
        </div>
      </div>
    </div>

    <div ref="slotWrapRef" class="storyboard-slot-wrap">
      <slot />
    </div>

    <StoryboardParamSettingsModal
      v-if="useParamSettingsModal && mode !== 'storyboardVideo'"
      ref="paramSettingsModalRef"
      v-model:open="paramSettingsOpen"
      :mode="mode"
      :scene-images="sceneImages"
      :character-images="characterImages"
      :prop-images="propImages"
      :other-images="otherImages"
      :nine-grid-enabled="nineGridEnabled"
      :reference-image="referenceImage"
      :reference-images="referenceImages"
      :selected-composition="selectedComposition"
      :selected-shot-size="selectedShotSize"
      :selected-camera-angle="selectedCameraAngle"
      :selected-focal-length="selectedFocalLength"
      :selected-color-tone="selectedColorTone"
      :selected-lighting="selectedLighting"
      :selected-technique="selectedTechnique"
      :composition-desc="compositionDesc"
      :active-setting-key="activeSettingKey"
      :selected-camera-movement="selectedCameraMovement"
      :camera-movement-desc="cameraMovementDesc"
      :selected-shooting-technique="selectedShootingTechnique"
      :active-video-setting-key="activeVideoSettingKey"
      :image-to-video-nine-grid-enabled="imageToVideoNineGridEnabled ?? nineGridEnabled"
      :image-to-video-reference-images="imageToVideoReferenceImages ?? referenceImages"
      :image-to-video-selected-camera-movement="imageToVideoSelectedCameraMovement ?? selectedCameraMovement"
      :image-to-video-camera-movement-desc="imageToVideoCameraMovementDesc ?? cameraMovementDesc"
      :image-to-video-selected-shooting-technique="
        imageToVideoSelectedShootingTechnique ?? selectedShootingTechnique
      "
      :image-to-video-active-video-setting-key="
        imageToVideoActiveVideoSettingKey ?? activeVideoSettingKey
      "
      :prompt="prompt"
      :extra-prompt-assets="extraPromptAssets"
      @open-select-modal="$emit('openSelectModal', $event)"
      @preview-asset-image="$emit('previewAssetImage', $event)"
      @import-reference="$emit('importReference')"
      @preview-reference="$emit('previewReference')"
      @toggle-asset-ref="onDraftToggleAssetRef"
      @sync-asset-refs="onDraftSyncAssetRefs"
      @confirm="onParamSettingsConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import {
  LeftOutlined,
  RightOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  PlusOutlined,
  CloseOutlined
} from '@ant-design/icons-vue'
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import { htmlPlainTextLength } from '~/utils/htmlPlain'
import {
  collectStoryboardPromptAssets,
  mergePromptAssets,
  storyboardPromptHtmlToPlain,
  storyboardPromptPlainToHtml,
  stripPromptImageAssetPlaceholdersFromPlain,
  type PromptAssetItem,
  plainTextLengthForPrompt
} from '~/utils/storyboardPromptAssetRef'
import {
  buildStoryboardPromptParamGroups,
  buildMultiParamVideoPromptParamGroups,
  buildStoryboardVideoPromptParamGroups,
  insertParamLabelIntoMarkdownSection,
  type PromptParamType
} from '~/utils/storyboardPromptParamRef'
import SettingSelectField from './SettingSelectField.vue'
import PromptScriptFileHeader from './PromptScriptFileHeader.vue'
import StoryboardParamSettingsModal, {
  type ParamSettingsConfirmPayload
} from './StoryboardParamSettingsModal.vue'
import {
  usePromptDictionary,
  PROMPT_TYPE,
  resolvePromptSelection
} from '~/composables/usePromptDictionary'
import type { SettingSelectOption } from '~/components/steps/SettingSelectField.vue'

const props = withDefaults(
  defineProps<{
    mode: 'storyboard' | 'imageToVideo' | 'storyboardVideo'
    sceneFileName: string
    prompt: string
    promptPlaceholder?: string
    sceneImages: any[]
    characterImages: any[]
    propImages: any[]
    otherImages: any[]
    isSettingExpanded: boolean
    /** 点击左侧分镜脚本条是否打开编辑（分镜脚本/分镜视频弹窗内为 true） */
    sceneFileClickable?: boolean
    /** 顶部是否显示「参考图」（分镜图弹窗内可关闭） */
    showReferenceButton?: boolean
    /** button：可点击上传；label：仅展示文案 */
    referenceDisplayMode?: 'button' | 'label'
    /** 顶部是否显示「生成提示词」（分镜图弹窗内可关闭） */
    showGeneratePromptButton?: boolean
    /** 生成提示词进行中 */
    generatePromptLoading?: boolean
    /** 是否显示「保存提示词」（分镜视频手动落库） */
    showSavePromptButton?: boolean
    /** 保存提示词进行中 */
    savePromptLoading?: boolean
    /** 与 PromptScriptFileHeader 一致：panel 为步骤页；modal-dark 为弹窗深色 */
    headerTheme?: 'panel' | 'modal-dark' | 'scene-modal'
    /** 头部左侧图标类型 */
    iconType?: 'scene' | 'file-text'
    // 图生视频
    selectedShootingTechnique?: { key: string; value: string } | null
    activeVideoSettingKey?: string | null
    // 生成分镜图
    selectedComposition?: { key: string; value: string } | null
    selectedShotSize?: { key: string; value: string } | null
    selectedCameraAngle?: { key: string; value: string } | null
    selectedFocalLength?: { key: string; value: string } | null
    selectedColorTone?: { key: string; value: string } | null
    selectedLighting?: { key: string; value: string } | null
    selectedTechnique?: { key: string; value: string } | null
    compositionDesc?: string
    activeSettingKey?: string | null
    /** 分镜视频·图生视频：九宫格与参考图 */
    nineGridEnabled?: boolean
    referenceImage?: { id?: string; url?: string; thumbnail?: string; title?: string } | null
    referenceImages?: any[]
    /** 分镜视频·图生视频：镜头运动 */
    selectedCameraMovement?: { key: string; value: string } | null
    cameraMovementDesc?: string
    /** 多参灵感空间内展示的图生视频参数（与多参参数分离） */
    imageToVideoNineGridEnabled?: boolean
    imageToVideoReferenceImages?: any[]
    imageToVideoSelectedCameraMovement?: { key: string; value: string } | null
    imageToVideoCameraMovementDesc?: string
    imageToVideoSelectedShootingTechnique?: { key: string; value: string } | null
    imageToVideoActiveVideoSettingKey?: string | null
    /**
     * 为 true 时按面板剩余高度精确计算中部双栏高度（适合固定高度父级）。
     * 为 false 时仅用断点高度 + 由外层滚动承载（适合分镜图弹窗 Tab 下整块滚动）。
     */
    usePreciseLayout?: boolean
    /** 接口解析出的 @图片N[name] 资产（与生成分镜图脚本对齐） */
    extraPromptAssets?: PromptAssetItem[]
    /** 为 true 时中间素材/参数区移入「灵感空间」弹窗，描述框撑满 */
    useParamSettingsModal?: boolean
  }>(),
  {
    sceneFileClickable: true,
    showReferenceButton: false,
    referenceDisplayMode: 'button' as const,
    showGeneratePromptButton: true,
    generatePromptLoading: false,
    showSavePromptButton: false,
    savePromptLoading: false,
    headerTheme: 'panel',
    iconType: 'file-text',
    usePreciseLayout: true,
    useParamSettingsModal: true,
    referenceImages: () => [],
    imageToVideoReferenceImages: () => []
  }
)

const paramSettingsOpen = ref(false)
const paramSettingsModalRef = ref<InstanceType<typeof StoryboardParamSettingsModal> | null>(null)

const promptEditorExpandedRef = ref<InstanceType<typeof RichTextEditor> | null>(null)
const promptEditorCollapsedRef = ref<InstanceType<typeof RichTextEditor> | null>(null)

const enablePromptAssetRefs = computed(
  () => props.mode === 'storyboard' || props.mode === 'imageToVideo'
)
const enablePromptParamRefs = computed(
  () => props.mode === 'storyboard' || props.mode === 'storyboardVideo' || props.mode === 'imageToVideo'
)

const storyboardPromptAssets = computed(() => {
  const startIndex =
    (props.extraPromptAssets?.length ?? 0) > 0
      ? Math.max(...props.extraPromptAssets!.map((a) => a.imageIndex)) + 1
      : 1

  if (props.mode === 'storyboard' || props.mode === 'imageToVideo') {
    const local = collectStoryboardPromptAssets(
      props.sceneImages,
      props.characterImages,
      props.propImages,
      props.otherImages,
      startIndex
    )
    return props.extraPromptAssets?.length
      ? mergePromptAssets(props.extraPromptAssets, local)
      : local
  }
  if (props.mode === 'storyboardVideo') {
    return props.extraPromptAssets?.length ? [...props.extraPromptAssets] : []
  }
  return props.extraPromptAssets?.length ? [...props.extraPromptAssets] : []
})

const viewportHeight = ref(1080)
const panelClientHeight = ref(0)
/** 仅在与父级「精确高度」配合时使用；父级用外层滚动承载时（usePreciseLayout=false）勿启用，否则会与外层滚动冲突 */
const isCompactHeight = computed(
  () =>
    props.usePreciseLayout && (viewportHeight.value <= 980 || panelClientHeight.value <= 760)
)
const panelRootRef = ref<HTMLElement | null>(null)
const headerWrapRef = ref<HTMLElement | null>(null)
const slotWrapRef = ref<HTMLElement | null>(null)
const promptCollapsedRef = ref<HTMLElement | null>(null)
const preciseTopCollapsedHeight = ref<string | null>(null)
const preciseTopExpandedHeight = ref<string | null>(null)
let layoutObserver: ResizeObserver | null = null

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function updateViewportHeight() {
  if (!import.meta.client) return
  viewportHeight.value = window.innerHeight
  recomputePreciseLayout()
}

function fitHeightByBreakpoints(v768: number, v900: number, v1080: number, v1400: number) {
  const vp = clamp(viewportHeight.value, 768, 1400)
  if (vp <= 900) {
    const ratio = (vp - 768) / (900 - 768)
    return `${Math.round(v768 + ratio * (v900 - v768))}px`
  }
  if (vp <= 1080) {
    const ratio = (vp - 900) / (1080 - 900)
    return `${Math.round(v900 + ratio * (v1080 - v900))}px`
  }
  const ratio = (vp - 1080) / (1400 - 1080)
  return `${Math.round(v1080 + ratio * (v1400 - v1080))}px`
}

/**
 * 外层滚动模式：高度不要随 1080+ 继续变大（否则顶部区域会越拉越高，出现不必要的滚动条）。
 * 这里把视口高度上限钉在 1080，对齐设计稿“1080 以上一屏铺满”的观感。
 */
function fitHeightOuterScroll(v768: number, v900: number, v1080: number) {
  const vp = clamp(viewportHeight.value, 768, 1080)
  if (vp <= 900) {
    const ratio = (vp - 768) / (900 - 768)
    return `${Math.round(v768 + ratio * (v900 - v768))}px`
  }
  const ratio = (vp - 900) / (1080 - 900)
  return `${Math.round(v900 + ratio * (v1080 - v900))}px`
}

const promptHeightExpanded = computed(() => {
  return fitHeightByBreakpoints(28, 36, 66, 105)
})

const promptHeightCollapsed = computed(() => {
  return fitHeightByBreakpoints(36, 46, 78, 120)
})

function pxToNumber(v: string) {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function maxPx(a: string, b: string) {
  return `${Math.max(pxToNumber(a), pxToNumber(b))}px`
}

const panelCssVars = computed<Record<string, string>>(() => {
  const outerScroll = !props.usePreciseLayout
  const promptExpanded = outerScroll
    ? fitHeightOuterScroll(28, 36, 66)
    : fitHeightByBreakpoints(28, 36, 66, 105)
  const promptCollapsed = outerScroll
    ? fitHeightOuterScroll(36, 46, 78)
    : fitHeightByBreakpoints(36, 46, 78, 120)
  const topCollapsed = outerScroll
    ? fitHeightOuterScroll(96, 148, 246)
    : fitHeightByBreakpoints(96, 148, 246, 320)
  // 1080+ 时展开态需要更高一些（约 374px）才能完全露出左侧素材区（避免被裁切）
  const topExpanded = outerScroll
    ? fitHeightOuterScroll(112, 168, 374)
    : fitHeightByBreakpoints(112, 168, 340, 500)
  const isLowViewport = viewportHeight.value <= 900
  // 低分辨率（高度较低）下的按钮高度微调：
  // - 场景/角色/道具行里的「导入」按钮（asset-card-inline）跟随 --storyboard-thumb-height：40px 更好点按
  // - “其他”四个入口按钮（.asset-card.small）跟随 --storyboard-card-small-height：46px 与设计稿一致
  const thumbHeight = isLowViewport ? '40px' : fitHeightByBreakpoints(32, 38, 46, 54)
  const cardSmallHeight = isLowViewport ? '46px' : fitHeightByBreakpoints(22, 28, 38, 46)

  return {
    // 外层滚动模式：避免低高度把区域压成几十像素，但不要强行放大到 1400px 的高度（会导致 1080+ 无故出现滚动条）
    '--storyboard-prompt-expanded-height': outerScroll ? maxPx(promptExpanded, '66px') : promptExpanded,
    '--storyboard-prompt-collapsed-height': outerScroll ? maxPx(promptCollapsed, '78px') : promptCollapsed,
    '--storyboard-top-collapsed-height':
      props.usePreciseLayout && preciseTopCollapsedHeight.value
        ? preciseTopCollapsedHeight.value
        : outerScroll
          ? maxPx(topCollapsed, isLowViewport ? '240px' : '246px')
          : topCollapsed,
    '--storyboard-top-expanded-height':
      props.usePreciseLayout && preciseTopExpandedHeight.value
        ? preciseTopExpandedHeight.value
        : outerScroll
          ? maxPx(topExpanded, isLowViewport ? '388px' : '374px')
          : topExpanded,
    '--storyboard-block-gap': fitHeightByBreakpoints(2, 3, 6, 10),
    '--storyboard-row-gap': fitHeightByBreakpoints(3, 5, 10, 14),
    '--storyboard-panel-padding-y': fitHeightByBreakpoints(2, 4, 6, 9),
    '--storyboard-panel-padding-x': fitHeightByBreakpoints(4, 6, 8, 12),
    '--storyboard-card-height': fitHeightByBreakpoints(24, 30, 42, 52),
    '--storyboard-card-small-height': cardSmallHeight,
    '--storyboard-thumb-height': thumbHeight,
    '--storyboard-thumb-img-height': fitHeightByBreakpoints(22, 26, 32, 38),
    '--storyboard-field-gap': fitHeightByBreakpoints(2, 4, 8, 14)
  }
})

function readPanelGapPx() {
  const panel = panelRootRef.value
  if (!panel || !import.meta.client) return 0
  const styles = window.getComputedStyle(panel)
  const raw = styles.rowGap || styles.gap || '0'
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function recomputePreciseLayout() {
  if (!import.meta.client) return
  if (!props.usePreciseLayout) {
    preciseTopCollapsedHeight.value = null
    preciseTopExpandedHeight.value = null
    if (panelRootRef.value) panelClientHeight.value = panelRootRef.value.clientHeight
    return
  }
  const panel = panelRootRef.value
  const header = headerWrapRef.value
  const slotWrap = slotWrapRef.value
  if (!panel || !header || !slotWrap) return

  const panelH = panel.clientHeight
  panelClientHeight.value = panelH
  const headerH = header.offsetHeight
  const slotH = slotWrap.offsetHeight
  const gap = readPanelGapPx()

  const expandedGaps = gap * 2
  const expandedTop = panelH - headerH - slotH - expandedGaps
  preciseTopExpandedHeight.value = `${Math.round(clamp(expandedTop, 112, 420))}px`

  const collapsedPromptH = promptCollapsedRef.value?.offsetHeight ?? 0
  const collapsedGaps = gap * 3
  const collapsedTop = panelH - headerH - slotH - collapsedPromptH - collapsedGaps
  preciseTopCollapsedHeight.value = `${Math.round(clamp(collapsedTop, 96, 460))}px`
}

const {
  ensureLoaded,
  cameraMovementOptions,
  shootingTechniqueOptions,
  compositionOptions,
  shotSizeOptions,
  cameraAngleOptions,
  focalLengthOptions,
  colorToneOptions,
  lightingOptions,
  techniqueOptions
} = usePromptDictionary()

onMounted(() => {
  void ensureLoaded()
  if (import.meta.client) {
    updateViewportHeight()
    window.addEventListener('resize', updateViewportHeight)
    if (props.usePreciseLayout && typeof ResizeObserver !== 'undefined') {
      layoutObserver = new ResizeObserver(() => {
        recomputePreciseLayout()
      })
      if (panelRootRef.value) layoutObserver.observe(panelRootRef.value)
      if (headerWrapRef.value) layoutObserver.observe(headerWrapRef.value)
      if (slotWrapRef.value) layoutObserver.observe(slotWrapRef.value)
      if (promptCollapsedRef.value) layoutObserver.observe(promptCollapsedRef.value)
    }
    nextTick(() => {
      recomputePreciseLayout()
    })
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('resize', updateViewportHeight)
  if (layoutObserver) {
    layoutObserver.disconnect()
    layoutObserver = null
  }
})

watch(
  () => props.isSettingExpanded,
  () => {
    nextTick(() => {
      if (props.usePreciseLayout && layoutObserver && promptCollapsedRef.value) {
        layoutObserver.observe(promptCollapsedRef.value)
      }
      recomputePreciseLayout()
    })
  },
  { immediate: true }
)

watch(
  () => props.usePreciseLayout,
  (on) => {
    if (!import.meta.client) return
    if (layoutObserver) {
      layoutObserver.disconnect()
      layoutObserver = null
    }
    preciseTopCollapsedHeight.value = null
    preciseTopExpandedHeight.value = null
    if (on && typeof ResizeObserver !== 'undefined') {
      layoutObserver = new ResizeObserver(() => {
        recomputePreciseLayout()
      })
      nextTick(() => {
        if (panelRootRef.value) layoutObserver!.observe(panelRootRef.value)
        if (headerWrapRef.value) layoutObserver!.observe(headerWrapRef.value)
        if (slotWrapRef.value) layoutObserver!.observe(slotWrapRef.value)
        if (promptCollapsedRef.value) layoutObserver!.observe(promptCollapsedRef.value)
        recomputePreciseLayout()
      })
    } else {
      nextTick(() => recomputePreciseLayout())
    }
  }
)

const emit = defineEmits<{
  'update:prompt': [value: string]
  'update:isSettingExpanded': [value: boolean]
  generatePrompt: []
  savePrompt: []
  importReference: []
  openScript: []
  openSelectModal: [
    type: 'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other'
  ]
  removeOtherImage: [index: number]
  removeMultiParamAssetReference: [index: number]
  removeReferenceImage: [index: number]
  previewAssetImage: [img: any]
  previewReferenceImage: [img: { url?: string; thumbnail?: string }]
  copyPrompt: []
  copyCompositionDesc: []
  'update:compositionDesc': [value: string]
  'update:activeSettingKey': [value: string | null]
  'update:activeVideoSettingKey': [value: string | null]
  'update:selectedShootingTechnique': [value: { key: string; value: string } | null]
  'update:selectedComposition': [value: { key: string; value: string } | null]
  'update:selectedShotSize': [value: { key: string; value: string } | null]
  'update:selectedCameraAngle': [value: { key: string; value: string } | null]
  'update:selectedFocalLength': [value: { key: string; value: string } | null]
  'update:selectedColorTone': [value: { key: string; value: string } | null]
  'update:selectedLighting': [value: { key: string; value: string } | null]
  'update:selectedTechnique': [value: { key: string; value: string } | null]
  'update:nineGridEnabled': [value: boolean]
  'update:referenceImage': [value: { id?: string; url?: string; thumbnail?: string; title?: string } | null]
  'update:referenceImages': [value: any[]]
  'update:selectedCameraMovement': [value: { key: string; value: string } | null]
  'update:cameraMovementDesc': [value: string]
  clearReference: []
  previewReference: []
  copyCameraMovementDesc: []
  paramSettingsConfirm: [payload: ParamSettingsConfirmPayload]
}>()

const storyboardPromptParamGroups = computed(() => {
  if (props.mode === 'storyboard') {
    return buildStoryboardPromptParamGroups({
      composition: compositionOptions.value,
      shotSize: shotSizeOptions.value,
      cameraAngle: cameraAngleOptions.value,
      focalLength: focalLengthOptions.value,
      colorTone: colorToneOptions.value,
      lighting: lightingOptions.value,
      technique: techniqueOptions.value
    })
  }
  if (props.mode === 'storyboardVideo') {
    return buildStoryboardVideoPromptParamGroups({
      cameraMovement: cameraMovementOptions.value,
      shootingTechnique: shootingTechniqueOptions.value
    })
  }
  if (props.mode === 'imageToVideo') {
    return buildMultiParamVideoPromptParamGroups({
      cameraMovement: cameraMovementOptions.value,
      shootingTechnique: shootingTechniqueOptions.value
    })
  }
  return []
})

const paramSelectionBindings = computed(() => {
  if (props.mode === 'storyboard') {
    return [
      {
        paramType: PROMPT_TYPE.composition as PromptParamType,
        get: () => props.selectedComposition,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedComposition', v)
      },
      {
        paramType: PROMPT_TYPE.shot_size as PromptParamType,
        get: () => props.selectedShotSize,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedShotSize', v)
      },
      {
        paramType: PROMPT_TYPE.camera_angle as PromptParamType,
        get: () => props.selectedCameraAngle,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedCameraAngle', v)
      },
      {
        paramType: PROMPT_TYPE.focal_length as PromptParamType,
        get: () => props.selectedFocalLength,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedFocalLength', v)
      },
      {
        paramType: PROMPT_TYPE.color_tone as PromptParamType,
        get: () => props.selectedColorTone,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedColorTone', v)
      },
      {
        paramType: PROMPT_TYPE.lighting as PromptParamType,
        get: () => props.selectedLighting,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedLighting', v)
      },
      {
        paramType: PROMPT_TYPE.exposure_blur as PromptParamType,
        get: () => props.selectedTechnique,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedTechnique', v)
      }
    ]
  }
  if (props.mode === 'storyboardVideo') {
    return [
      {
        paramType: PROMPT_TYPE.camera_movement as PromptParamType,
        get: () => props.selectedCameraMovement,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedCameraMovement', v)
      },
      {
        paramType: PROMPT_TYPE.shooting_technique as PromptParamType,
        get: () => props.selectedShootingTechnique,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedShootingTechnique', v)
      }
    ]
  }
  if (props.mode === 'imageToVideo') {
    return [
      {
        paramType: PROMPT_TYPE.shooting_technique as PromptParamType,
        get: () =>
          props.imageToVideoSelectedShootingTechnique ?? props.selectedShootingTechnique ?? null,
        emit: (v: { key: string; value: string } | null) => emit('update:selectedShootingTechnique', v)
      },
      {
        paramType: PROMPT_TYPE.camera_movement as PromptParamType,
        get: () => props.imageToVideoSelectedCameraMovement ?? null,
        emit: () => {
          /* 多参灵感空间镜头运动由父级 applyMultiParamSettingsConfirm 维护 */
        }
      }
    ]
  }
  return []
})

function getActivePromptEditor() {
  if (props.useParamSettingsModal) {
    return promptEditorCollapsedRef.value
  }
  return props.isSettingExpanded
    ? promptEditorExpandedRef.value
    : promptEditorCollapsedRef.value
}

function syncStoryboardPromptAssetRefsInEditor() {
  if (!enablePromptAssetRefs.value || paramSettingsOpen.value) return
  getActivePromptEditor()?.syncMissingPromptAssetRefs()
}

/** 图生视频：参考图在描述框外展示，移除文本域内残留的 @图片 引用 */
function syncStoryboardVideoPromptWithoutImageRefs() {
  if (props.mode !== 'storyboardVideo' || paramSettingsOpen.value) return
  const editor = getActivePromptEditor()
  const currentHtml = editor?.getHtml?.() || props.prompt
  const plain = editor?.getPlainPrompt?.() || storyboardPromptHtmlToPlain(props.prompt)
  const hasAssetEmbed = currentHtml.includes('scp-prompt-asset-ref')
  if (!hasAssetEmbed && !plain.includes('@') && !plain.includes('图片')) return

  const imageNames = storyboardVideoReferenceList.value.map((img) =>
    String(img.title || img.name || '').trim()
  )
  const cleaned = stripPromptImageAssetPlaceholdersFromPlain(plain, imageNames)
  if (cleaned === plain && !hasAssetEmbed) return

  const html = storyboardPromptPlainToHtml(
    cleaned,
    [],
    storyboardPromptParamGroups.value,
    { enableVideoLabeledParams: true, enableAssetRefs: false }
  )
  emit('update:prompt', html)
}

function syncStoryboardPromptParamRefsInEditor() {
  if (!enablePromptParamRefs.value || paramSettingsOpen.value) return
  const editor = getActivePromptEditor()
  if (!editor) return
  for (const binding of paramSelectionBindings.value) {
    editor.syncPromptParamRef(binding.paramType, binding.get())
  }
}

function buildPromptAssetsFromPayload(payload: ParamSettingsConfirmPayload) {
  const startIndex =
    (props.extraPromptAssets?.length ?? 0) > 0
      ? Math.max(...props.extraPromptAssets!.map((a) => a.imageIndex)) + 1
      : 1
  if (props.mode === 'storyboardVideo') {
    return props.extraPromptAssets?.length ? [...props.extraPromptAssets] : []
  }
  const local = collectStoryboardPromptAssets(
    payload.sceneImages,
    payload.characterImages,
    payload.propImages,
    payload.otherImages,
    startIndex
  )
  return props.extraPromptAssets?.length
    ? mergePromptAssets(props.extraPromptAssets, local)
    : local
}

function getMainPromptEditor() {
  return promptEditorCollapsedRef.value
}

function onDraftToggleAssetRef(payload: { asset: PromptAssetItem; selected: boolean }) {
  getMainPromptEditor()?.togglePromptAssetRef(payload.asset, payload.selected)
}

function onDraftSyncAssetRefs(assets: PromptAssetItem[]) {
  const editor = getMainPromptEditor()
  if (!editor) return
  for (const asset of assets) {
    editor.upsertPromptAssetRef(asset)
  }
}

function syncParamRefsFromPayload(payload: ParamSettingsConfirmPayload) {
  const editor = getMainPromptEditor()
  if (!editor || !enablePromptParamRefs.value) return

  if (props.mode === 'storyboard') {
    editor.syncPromptParamRef(PROMPT_TYPE.composition as PromptParamType, payload.selectedComposition)
    editor.syncPromptParamRef(PROMPT_TYPE.shot_size as PromptParamType, payload.selectedShotSize)
    editor.syncPromptParamRef(PROMPT_TYPE.camera_angle as PromptParamType, payload.selectedCameraAngle)
    editor.syncPromptParamRef(PROMPT_TYPE.focal_length as PromptParamType, payload.selectedFocalLength)
    editor.syncPromptParamRef(PROMPT_TYPE.color_tone as PromptParamType, payload.selectedColorTone)
    editor.syncPromptParamRef(PROMPT_TYPE.lighting as PromptParamType, payload.selectedLighting)
    editor.syncPromptParamRef(PROMPT_TYPE.exposure_blur as PromptParamType, payload.selectedTechnique)
  } else if (props.mode === 'storyboardVideo') {
    editor.syncPromptParamRef(
      PROMPT_TYPE.camera_movement as PromptParamType,
      payload.selectedCameraMovement
    )
    editor.syncPromptParamRef(
      PROMPT_TYPE.shooting_technique as PromptParamType,
      payload.selectedShootingTechnique
    )
  } else if (props.mode === 'imageToVideo') {
    editor.syncPromptParamRef(
      PROMPT_TYPE.shooting_technique as PromptParamType,
      payload.imageToVideoSelectedShootingTechnique ?? payload.selectedShootingTechnique
    )
    if (payload.imageToVideoSelectedCameraMovement !== undefined) {
      editor.syncPromptParamRef(
        PROMPT_TYPE.camera_movement as PromptParamType,
        payload.imageToVideoSelectedCameraMovement ?? null
      )
    }
  }
}

function onParamSettingsConfirm(payload: ParamSettingsConfirmPayload) {
  emit('paramSettingsConfirm', payload)
  const assetsFromPayload = buildPromptAssetsFromPayload(payload)
  nextTick(() => {
    if (enablePromptAssetRefs.value) {
      getMainPromptEditor()?.syncMissingPromptAssetRefs(assetsFromPayload)
    }

    let promptPatched = false
    if (props.mode === 'imageToVideo') {
      const cameraMovement = payload.imageToVideoSelectedCameraMovement ?? null
      if (cameraMovement?.value && cameraMovement.key !== 'none') {
        const editor = getMainPromptEditor()
        const plain = editor?.getPlainPrompt?.() || storyboardPromptHtmlToPlain(props.prompt)
        const nextPlain = insertParamLabelIntoMarkdownSection(plain, '运镜', cameraMovement.value)
        if (nextPlain !== plain) {
          const html = storyboardPromptPlainToHtml(
            nextPlain,
            storyboardPromptAssets.value,
            storyboardPromptParamGroups.value
          )
          emit('update:prompt', html)
          promptPatched = true
        }
      }
    }

    const runParamSync = () => {
      syncParamRefsFromPayload(payload)
      if (enablePromptAssetRefs.value || enablePromptParamRefs.value) {
        getMainPromptEditor()?.hydratePromptRefEmbeds()
      }
    }

    if (promptPatched) nextTick(runParamSync)
    else runParamSync()
  })
}

function isParamSettingsOpen() {
  return paramSettingsOpen.value
}

function applyParamDraftAssets(
  type: 'scene' | 'character' | 'prop' | 'pose' | 'expression' | 'effect' | 'draft' | 'other',
  items: any[]
) {
  paramSettingsModalRef.value?.appendDraftImages(type, items)
}

function applyParamDraftReference(item: any) {
  paramSettingsModalRef.value?.appendDraftReferences([item])
}

function applyParamDraftReferences(items: any[]) {
  paramSettingsModalRef.value?.appendDraftReferences(items)
}

defineExpose({
  isParamSettingsOpen,
  applyParamDraftAssets,
  applyParamDraftReference,
  applyParamDraftReferences
})

function onPromptParamChange(payload: {
  paramType: PromptParamType
  selection: { key: string; value: string } | null
}) {
  const binding = paramSelectionBindings.value.find((b) => b.paramType === payload.paramType)
  binding?.emit(payload.selection)
}

watch(
  () => [
    props.sceneImages,
    props.characterImages,
    props.propImages,
    props.otherImages,
    props.referenceImage,
    props.referenceImages,
    props.isSettingExpanded,
    props.mode
  ],
  () =>
    nextTick(() => {
      if (paramSettingsOpen.value) return
      if (props.mode === 'storyboardVideo') {
        syncStoryboardVideoPromptWithoutImageRefs()
      } else {
        syncStoryboardPromptAssetRefsInEditor()
      }
      getActivePromptEditor()?.hydratePromptRefEmbeds()
    }),
  { deep: true }
)

watch(
  () => [
    props.selectedComposition,
    props.selectedShotSize,
    props.selectedCameraAngle,
    props.selectedFocalLength,
    props.selectedColorTone,
    props.selectedLighting,
    props.selectedTechnique,
    props.selectedCameraMovement,
    props.selectedShootingTechnique,
    props.imageToVideoSelectedCameraMovement,
    props.imageToVideoSelectedShootingTechnique,
    props.isSettingExpanded,
    props.mode,
    storyboardPromptParamGroups.value
  ],
  () =>
    nextTick(() => {
      if (paramSettingsOpen.value) return
      syncStoryboardPromptParamRefsInEditor()
      getActivePromptEditor()?.hydratePromptRefEmbeds()
    }),
  { deep: true }
)

function migrateSelectionIfNeeded(
  cur: { key: string; value: string } | null | undefined,
  opts: SettingSelectOption[],
  promptType: string,
  updater: (v: { key: string; value: string }) => void
) {
  if (!cur) return
  const n = resolvePromptSelection(cur, opts, promptType)
  if (n && (n.key !== cur.key || n.value !== cur.value)) updater(n)
}

watch(
  [
    () => props.selectedComposition,
    compositionOptions,
    () => props.selectedShotSize,
    shotSizeOptions,
    () => props.selectedCameraAngle,
    cameraAngleOptions,
    () => props.selectedFocalLength,
    focalLengthOptions,
    () => props.selectedColorTone,
    colorToneOptions,
    () => props.selectedLighting,
    lightingOptions,
    () => props.selectedTechnique,
    techniqueOptions,
    () => props.selectedCameraMovement,
    cameraMovementOptions,
    () => props.selectedShootingTechnique,
    shootingTechniqueOptions
  ],
  () => {
    migrateSelectionIfNeeded(
      props.selectedComposition,
      compositionOptions.value,
      PROMPT_TYPE.composition,
      (v) => emit('update:selectedComposition', v)
    )
    migrateSelectionIfNeeded(
      props.selectedShotSize,
      shotSizeOptions.value,
      PROMPT_TYPE.shot_size,
      (v) => emit('update:selectedShotSize', v)
    )
    migrateSelectionIfNeeded(
      props.selectedCameraAngle,
      cameraAngleOptions.value,
      PROMPT_TYPE.camera_angle,
      (v) => emit('update:selectedCameraAngle', v)
    )
    migrateSelectionIfNeeded(
      props.selectedFocalLength,
      focalLengthOptions.value,
      PROMPT_TYPE.focal_length,
      (v) => emit('update:selectedFocalLength', v)
    )
    migrateSelectionIfNeeded(
      props.selectedColorTone,
      colorToneOptions.value,
      PROMPT_TYPE.color_tone,
      (v) => emit('update:selectedColorTone', v)
    )
    migrateSelectionIfNeeded(
      props.selectedLighting,
      lightingOptions.value,
      PROMPT_TYPE.lighting,
      (v) => emit('update:selectedLighting', v)
    )
    migrateSelectionIfNeeded(
      props.selectedTechnique,
      techniqueOptions.value,
      PROMPT_TYPE.exposure_blur,
      (v) => emit('update:selectedTechnique', v)
    )
    migrateSelectionIfNeeded(
      props.selectedCameraMovement,
      cameraMovementOptions.value,
      PROMPT_TYPE.camera_movement,
      (v) => emit('update:selectedCameraMovement', v)
    )
    migrateSelectionIfNeeded(
      props.selectedShootingTechnique,
      shootingTechniqueOptions.value,
      PROMPT_TYPE.shooting_technique,
      (v) => emit('update:selectedShootingTechnique', v)
    )
  },
  { flush: 'post' }
)

const storyboardVideoReferenceList = computed(() => {
  const fromList = (props.referenceImages ?? []).filter((img) => img?.url || img?.thumbnail)
  if (fromList.length) return fromList
  const single = props.referenceImage
  if (single?.url || single?.thumbnail) return [single]
  return []
})

const multiParamAssetReferenceList = computed(() => {
  if (props.mode !== 'imageToVideo') return []
  return [...props.sceneImages, ...props.characterImages, ...props.propImages, ...props.otherImages].filter(
    (img) => img?.url || img?.thumbnail
  )
})

function removeMultiParamAssetReference(index: number) {
  emit('removeMultiParamAssetReference', index)
}

function onStoryboardVideoReferenceClick() {
  const r = props.referenceImage
  if (r?.url || r?.thumbnail) {
    emit('previewReference')
  } else {
    emit('importReference')
  }
}

function onStoryboardVideoReferenceThumbClick(img: {
  url?: string
  thumbnail?: string
}) {
  if (img?.url || img?.thumbnail) {
    emit('previewReferenceImage', img)
  } else {
    emit('importReference')
  }
}

function removeStoryboardVideoReference(index: number) {
  emit('removeReferenceImage', index)
}

function onSceneFileClick() {
  if (props.sceneFileClickable) {
    emit('openScript')
  }
}

const sceneRowRef = ref<HTMLElement | null>(null)
const characterRowRef = ref<HTMLElement | null>(null)
const propRowRef = ref<HTMLElement | null>(null)

/** 横向滚动缩略图：必须在子组件内使用本地 ref（父组件拿不到这里的 DOM，原先 emit 后父级 scroll 不生效） */
function scrollRow(row: 'scene' | 'character' | 'prop', direction: number) {
  const refMap = {
    scene: sceneRowRef,
    character: characterRowRef,
    prop: propRowRef
  }
  const el = refMap[row].value
  if (!el) return
  const step = 200
  try {
    el.scrollBy({ left: step * direction, behavior: 'smooth' })
  } catch {
    el.scrollLeft += step * direction
  }
}

</script>

<style lang="scss" scoped>
.storyboard-generate-panel {
  display: flex;
  flex-direction: column;
  gap: var(--storyboard-block-gap, 4px);
  overflow: hidden;
  height: 100%;
  min-height: 0;
  .asset-panel .asset-reference-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  color: var(--gray-600);
  padding: 10px;
  span{
    color: rgba(142, 151, 165, 1) !important;

  }
}

.storyboard-generate-panel.is-compact-height {
  overflow-y: scroll !important;
  overflow-x: hidden;
  padding-right: 3px;
  max-height: 100%;
  min-height: 0;
}

.storyboard-generate-panel.is-compact-height::-webkit-scrollbar {
  width: 6px;
}

.storyboard-generate-panel.is-compact-height::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.55);
  border-radius: 4px;
}
.asset-reference-single {
  grid-column: 1 / -1;
  min-height: 120px;
}
}

.storyboard-top {
  display: grid;
  /* 右列用 1fr 占满剩余宽度；原先185px+170px 固定总宽小于侧栏时会出现右侧留白（低分辨率更明显） */
  grid-template-columns: 174px minmax(0, 1fr);
  width: 100%;
  gap: var(--storyboard-row-gap, 12px);
  min-height: 0;
  flex: 0 0 auto;
  align-items: stretch;
}

/* 未展开：左右两列同高 290px */
.storyboard-top:not(.storyboard-top-expanded) {
  grid-template-rows: var(--storyboard-top-collapsed-height, 290px);
}

/* 展开：左右同高；略增高行高，让上方素材区尽量不出现纵向滚动条 */
.storyboard-top-expanded {
  grid-template-columns: 174px minmax(0, 1fr);
  grid-template-rows: var(--storyboard-top-expanded-height, 450px);
}

.storyboard-left-col {
  display: flex;
  flex-direction: column;
  gap: var(--storyboard-row-gap, 12px);
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  align-self: stretch;
}

.storyboard-top:not(.storyboard-top-expanded) .storyboard-left-col {
  max-height: var(--storyboard-top-collapsed-height, 290px);
}

.storyboard-top-expanded .storyboard-left-col {
  height: 100%;
  max-height: 100%;
}

/* 分镜视频·图生视频：单张参考图 */
.asset-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-500);
  margin-right: 0.35rem;
  vertical-align: middle;
}


.asset-panel .asset-row-switch .asset-label {
  display: flex;
  align-items: center;
  margin-bottom: 0;
  color: rgba(142, 151, 165, 1) !important;
}


.asset-row-switch :deep(.ant-switch) {
  flex-shrink: 0;
  background: rgba(106, 123, 148, 0.65) !important;
  border: 1px solid rgba(180, 198, 224, 0.45);
}

.asset-row-switch :deep(.ant-switch.ant-switch-checked) {
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%) !important;
  border-color: rgba(0, 171, 216, 0.95);
}

.asset-row-switch :deep(.ant-switch .ant-switch-handle::before) {
  background: #ffffff !important;
}

.asset-reference-item {
  aspect-ratio: 1;
  max-width: 100px;
  min-height: 50px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px dashed var(--create-border-dashed);
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.asset-reference-item:hover {
  border-color: var(--gray-200);
}

.asset-reference-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}


.asset-reference-remove {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  cursor: pointer;
}

.asset-reference-remove:hover {
  background: rgba(0, 0, 0, 0.7);
}

.asset-plus {
  font-size: 1.5rem;
}

.setting-input-with-actions {
  width: 100%;
}

.input-action {
  margin-left: 0.35rem;
  cursor: pointer;
  color: #8E97A5 !important;
}

.asset-panel {
  display: flex;
  flex-direction: column;
  padding: var(--storyboard-panel-padding-y, 6px) var(--storyboard-panel-padding-x, 8px);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
  min-height: 0;
  /* 与右侧 .setting-body 一致的细滚动条（未展开时素材区可能仍需滚动） */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 140, 170, 0.45) transparent;
}

.asset-panel::-webkit-scrollbar {
  width: 4px;
}

.asset-panel::-webkit-scrollbar-track {
  background: transparent;
}

.asset-panel::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.35);
  border-radius: 3px;
}

.asset-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 231, 253, 0.35);
}

.asset-panel .asset-row {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: var(--storyboard-row-gap, 12px);
  align-items: center;
}

.asset-panel .asset-row-switch {
  grid-template-columns: 112px 1fr;
  align-items: center;
  margin-bottom: var(--storyboard-panel-padding-y, 8px);
}
.asset-panel .asset-label {
  color: rgba(142, 151, 165, 1) !important;
  font-weight: 600;
  text-align: center;
}

.storyboard-top:not(.storyboard-top-expanded) .storyboard-left-col .asset-panel {
  flex: 1;
  overflow-y: auto;
  flex-shrink: 1;
}

/* 展开：压缩下方描述区高度，上方素材区占满剩余空间且不再出现纵向滚动条 */
.storyboard-top-expanded .asset-panel {
  flex: 1;
  min-height: 0;
  overflow-y: hidden;
  overflow-x: hidden;
  flex-shrink: 1;
}

/* 1080+：优先铺满并减少左侧不必要滚动 */
@media (min-height: 1080px) {
  /* 高分辨率：参照设计稿，一屏铺满展示，不允许上方双栏“自动顶高”导致出现滚动条 */
  .storyboard-top:not(.storyboard-top-expanded) {
    grid-template-rows: var(--storyboard-top-collapsed-height, 290px);
  }

  .storyboard-top-expanded {
    grid-template-rows: var(--storyboard-top-expanded-height, 450px);
  }

  .storyboard-top:not(.storyboard-top-expanded) .storyboard-left-col .asset-panel {
    overflow-y: hidden;
  }

  .storyboard-top-expanded .asset-panel {
    overflow-y: hidden;
  }

  .setting-panel:not(.expanded) .setting-body,
  .setting-panel.expanded .setting-body {
    overflow-y: hidden;
  }
}

/* 低高度且点击“展开”：左侧素材区允许内部滚动，避免内容被截断 */
@media (max-height: 900px) {
  .storyboard-top-expanded .asset-panel {
    overflow-y: auto;
  }
}
.asset-card {
  height: var(--storyboard-card-height, 50px);
  border-radius: var(--radius-md);
  border: 1px dashed var(--create-border-dashed);
  background: rgba(18, 18, 18, 1);
  color: var(--gray-700);
  width: 40%;
  cursor: pointer;
  transition: all 0.15s ease;
  span{
    color: #8E97A5 !important;
    font-size: 12px;
  }
}

.asset-card:hover {
  border-color: var(--accent-300);
  background: var(--accent-50);
  color: var(--accent-700);
}

.asset-card.small {
  height: var(--storyboard-card-small-height, 44px);
}

.asset-icon {
  font-size: 1rem;
  font-weight: 700;
  line-height: 14px;
}

.asset-row-other .asset-grid-other-top {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.asset-thumb-item--removable {
  position: relative;
}

.asset-thumb-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  padding: 0;
  line-height: 16px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  z-index: 2;
}

.asset-thumb-remove:hover {
  background: rgba(220, 38, 38, 0.9);
}

.asset-horizontal-wrap {
  display: flex;
  align-items: center;
  gap: var(--storyboard-block-gap, 6px);
  min-width: 0;
}

.asset-arrow {
  flex-shrink: 0;
  width: 28px;
  height: var(--storyboard-card-height, 36px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gray-200);
  border-radius: 4px;
  background: var(--create-surface-panel);
  cursor: pointer;
  color: var(--gray-600);
}

.asset-arrow:hover {
  border-color: var(--primary-400);
  color: var(--primary-600);
}

.asset-horizontal {
  display: flex;
  align-items: center;
  gap: var(--storyboard-block-gap, 6px);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
  min-width: 0;
  flex: 1;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.asset-horizontal::-webkit-scrollbar {
  display: none;
}

.asset-thumb-item {
  flex-shrink: 0;
  width: 72px;
  height: var(--storyboard-thumb-height, 52px);
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--gray-200);
  transition: border-color 0.2s;
  display: flex;
  flex-direction: column;
}

.asset-thumb-item:hover {
  border-color: var(--primary-400);
}

.asset-thumb-img {
  width: 100%;
  height: var(--storyboard-thumb-img-height, 36px);
  min-height: var(--storyboard-thumb-img-height, 36px);
  object-fit: cover;
  display: block;
}

.asset-thumb-name {
  display: block;
  padding: 2px 4px;
  font-size: 0.65rem;
  line-height: 1.2;
  color: var(--gray-600);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-height: 0;
}

.asset-card-inline {
  flex-shrink: 0;
  width: 72px;
  height: var(--storyboard-thumb-height, 52px);
  margin: 0;
}

.asset-other-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.asset-card-import-other {
  width: 30%;
  max-width: 140px;
}

.storyboard-prompt-in-left-col {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 0;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.storyboard-prompt-in-left-col :deep(.ql-editor) {
  flex: 1;
  min-height: 0;
  border: none;
  resize: none;
}

.storyboard-top-expanded .storyboard-prompt-in-left-col {
  flex: 0 0 auto;
  min-height: 0;
}

/* 展开后描述区变矮，避免与上方抢高导致素材区出滚动条 */
.storyboard-top-expanded .storyboard-prompt-in-left-col :deep(.ql-editor) {
  flex: 0 0 auto !important;
  height: var(--storyboard-prompt-expanded-height, 88px) !important;
  min-height: var(--storyboard-prompt-expanded-height, 88px) !important;
  max-height: var(--storyboard-prompt-expanded-height, 88px) !important;
}

.storyboard-prompt-full {
  width: 100%;
  flex-shrink: 0;
  margin-top: 0;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.storyboard-prompt-full :deep(.ql-container) {
  border: none;
  resize: none;
}

/* 未展开：主描述文本域固定高度 102px */
.storyboard-prompt-full :deep(.ql-editor) {
  height: var(--storyboard-prompt-collapsed-height, 97px) !important;
  min-height: var(--storyboard-prompt-collapsed-height, 97px) !important;
  max-height: var(--storyboard-prompt-collapsed-height, 97px) !important;
  resize: none !important;
  box-sizing: border-box;
}

.storyboard-prompt {
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-200);
  background: var(--create-surface-panel);
  padding: var(--storyboard-panel-padding-y, 6px) var(--storyboard-panel-padding-x, 6px);
  display: flex;
  flex-direction: column;
  gap: var(--storyboard-block-gap, 10px);
}

.storyboard-prompt :deep(.ql-editor) {
  background: transparent;
  color: var(--gray-700);
  border: none;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-weight: 600;
    line-height: 1.45;
    margin: 0.4em 0 0.25em;
  }

  h1 {
    font-size: 1.05em;
  }

  h2 {
    font-size: 1em;
  }

  h3,
  h4,
  h5,
  h6 {
    font-size: 0.95em;
  }

  ul,
  ol {
    margin: 0.25em 0;
    padding-left: 1.35em;
  }

  li {
    margin: 0.12em 0;
  }

  blockquote {
    margin: 0.25em 0;
    padding-left: 0.75em;
    border-left: 2px solid rgba(74, 231, 253, 0.45);
    color: rgba(255, 255, 255, 0.85);
  }

  p {
    margin: 0.2em 0;
  }
}

.prompt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem var(--storyboard-panel-padding-x, 0.75rem);
  font-size: 0.8rem;
  color: var(--gray-500);
}

.prompt-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.prompt-actions :deep(.ant-btn),
.setting-actions :deep(.ant-btn) {
  color: #8E97A5 !important;
}

.prompt-actions :deep(.ant-btn .anticon),
.setting-actions :deep(.ant-btn .anticon) {
  color: #8E97A5 !important;
}

.prompt-actions :deep(.ant-btn:hover),
.setting-actions :deep(.ant-btn:hover) {
  color: #8E97A5 !important;
}

.prompt-count {
  flex-shrink: 0;
}

.setting-panel {
  padding: var(--storyboard-panel-padding-y, 6px) var(--storyboard-panel-padding-x, 8px);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--storyboard-block-gap, 12px);
  min-height: 0;
  min-width: 0;
  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
}

.setting-panel:not(.expanded) .setting-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.setting-panel.expanded {
  min-height: 0;
  align-self: stretch;
}

.setting-panel.expanded .setting-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.setting-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 0;
  color: var(--gray-600);
  cursor: pointer;
  flex-shrink: 0;
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 8px;
}

.setting-chevron {
  transition: transform 0.2s ease;
}

.setting-chevron.expanded {
  transform: rotate(180deg);
}

.setting-body {
  display: flex;
  flex-direction: column;
  gap: var(--storyboard-field-gap, 12px);
  min-height: 0;
  /* Firefox：细滚动条 */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 140, 170, 0.45) transparent;
  .setting-field{
  display: flex;
  flex-direction: column;
  gap: var(--storyboard-block-gap, 6px);
  .setting-title {
    color: rgba(142, 151, 165, 1) !important;
    font-weight: 600;
    font-size: 0.85rem;
  }
}
}

/* WebKit：收窄滚动条占位宽度（默认约 15px 过宽） */
.setting-body::-webkit-scrollbar {
  width: 4px;
}

.setting-body::-webkit-scrollbar-track {
  background: transparent;
}

.setting-body::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.35);
  border-radius: 3px;
}

.setting-body::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 231, 253, 0.35);
}

.setting-textarea {
  position: relative;
}

.setting-textarea :deep(.ql-editor) {
  background: var(--create-surface-panel);
  color: var(--gray-700);
  //border-color: var(--gray-300);
}

.setting-actions {
  position: absolute;
  right: 0.35rem;
  bottom: 0.25rem;
  display: flex;
  gap: 0.25rem;
}

/* 768～900 常见高度：再压窄双栏，减轻纵向占用 */
@media (max-height: 820px) {
  .storyboard-top {
    grid-template-columns: 156px minmax(0, 1fr);
  }

  .storyboard-top-expanded {
    grid-template-columns: 156px minmax(0, 1fr);
  }

  .setting-header {
    padding: 2px 0;
  }
}

/* 参数弹窗模式：描述框撑满中间区域 */
.storyboard-generate-panel.use-param-modal {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.storyboard-generate-panel.use-param-modal > div:first-child,
.storyboard-generate-panel.use-param-modal > .storyboard-slot-wrap {
  flex-shrink: 0;
}

.storyboard-generate-panel.use-param-modal .storyboard-prompt-modal {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 0;
  padding: 0;
  gap: 0;
  background: transparent;
  border: none !important;
}

.storyboard-generate-panel.use-param-modal .storyboard-prompt-modal :deep(.rich-text-editor) {
  flex: 1 1 0;
  min-height: 0;
  background: #121212 !important;
}

.storyboard-generate-panel.use-param-modal .storyboard-prompt-modal :deep(.ql-editor) {
  background: #121212 !important;
  background-color: #121212 !important;
  border: none !important;
}

.prompt-footer-modal {
  flex-shrink: 0;
}

.prompt-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.param-settings-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid rgba(74,231,253,0.3);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.param-settings-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

/* 分镜视频·图生视频：参考图导入区（弹窗模式，文本域上方） */
.i2v-reference-strip {
  flex-shrink: 0;
  padding: 8px 10px;
  background: rgba(18, 18, 18, 1);
  border-radius: 10px;
  margin-bottom: 4px;
}

.i2v-reference-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.i2v-reference-thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px dashed rgba(128, 154, 188, 0.35);
  background: rgba(8, 12, 20, 0.9);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}

.i2v-reference-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.i2v-reference-thumb__remove {
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

.i2v-reference-thumb:hover .i2v-reference-thumb__remove {
  opacity: 1;
  transform: scale(1);
}

.i2v-reference-thumb--adder {
  border: 1px dashed rgba(188, 205, 228, 0.6);
  background: transparent;
  color: rgba(225, 239, 255, 0.85);
  cursor: pointer;
  font-size: 18px;
}

.i2v-reference-thumb--adder:hover {
  border-color: rgba(74, 231, 253, 0.85);
  color: rgba(74, 231, 253, 1);
}

.i2v-reference-thumb--adder .adder-text {
  font-size: 12px;
  margin-top: 2px;
  white-space: nowrap;
}
</style>
