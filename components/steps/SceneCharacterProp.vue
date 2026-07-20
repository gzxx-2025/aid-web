<template>
  <div class="scp-root create-step-scp">
    <!-- 顶部切换：场景 / 角色 / 道具 -->
    <div class="scp-topbar">
      <div class="scp-tabs" role="tablist" aria-label="场景角色道具切换">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="['scp-tab', { active: activeTab === t.key, disabled: isExtracting }]"
          :disabled="isExtracting"
          @click="!isExtracting && (activeTab = t.key)"
        >
          <span class="scp-tab-label">{{ t.label }}</span>
          <LoadingOutlined
            v-if="isTabLoading(t.key)"
            class="scp-tab-loading"
            spin
          />
        </button>
      </div>
      <p
        v-if="
          !isExtracting &&
          ((activeTab === 'scene' && localValue.scenes.length > 0) ||
            (activeTab === 'character' && localValue.characters.length > 0) ||
            (activeTab === 'prop' && localValue.props.length > 0))
        "
        class="scp-topbar-hint"
      >
        <template v-if="activeTab === 'scene'">
          (已识别 {{ localValue.scenes.length }} 个场景，可选择生成新场景图或导入已有图片)
        </template>
        <template v-else-if="activeTab === 'character'">
          (已识别 {{ localValue.characters.length }} 个角色，可选择生成新角色图或导入已有图片)
        </template>
        <template v-else>
          (已识别 {{ localValue.props.length }} 个道具，可选择生成新道具图或导入已有图片)
        </template>
      </p>
      <div class="scp-topbar__right">
        <!-- :disabled="topbarAddDisabled" -->
        <a-button
          class="scp-topbar-add-btn"
          @click="handleEmptyAssetAddClick"
        >
          <template #icon>
            <span class="scp-topbar-add-btn__ico-wrap">
              <img :src="topbarAddIconNor" alt="" class="scp-topbar-add-btn__ico scp-topbar-add-btn__ico--nor" />
              <img :src="topbarAddIconSel" alt="" class="scp-topbar-add-btn__ico scp-topbar-add-btn__ico--sel" />
            </span>
          </template>
          {{ emptyAssetAddLabel }}
        </a-button>
        <a-dropdown
          v-if="!isExtracting && showBatchGenerateTopbarBtn"
          v-model:open="batchOpsDropdownOpen"
          trigger="click"
          placement="bottomRight"
          overlay-class-name="scp-topbar-ops-dropdown-overlay"
        >
          <a-button
            type="primary"
            class="scp-topbar-batch-btn scp-topbar-ops-btn"
            :loading="batchGenerateTopbarLoading || batchDeleteSubmitting"
          >
            批量操作
            <DownOutlined
              class="scp-topbar-ops-btn__arrow"
              :class="{ 'scp-topbar-ops-btn__arrow--open': batchOpsDropdownOpen }"
            />
          </a-button>
          <template #overlay>
            <div class="scp-topbar-ops-panel" role="menu" aria-label="批量操作">
              <div class="scp-topbar-ops-panel__list">
                <a-tooltip
                  v-if="batchFormGenerateMenuDisabled && batchFormGenerateDisabledTooltip"
                  :title="batchFormGenerateDisabledTooltip"
                  placement="left"
                  :mouse-enter-delay="0.2"
                >
                  <span class="scp-topbar-ops-panel__item-wrap">
                    <button
                      type="button"
                      class="scp-topbar-ops-panel__item scp-topbar-ops-panel__item--disabled"
                      disabled
                      role="menuitem"
                    >
                      <ThunderboltOutlined />
                      <span>{{ batchFormGenerateMenuLabel }}</span>
                    </button>
                  </span>
                </a-tooltip>
                <button
                  v-else
                  type="button"
                  class="scp-topbar-ops-panel__item"
                  role="menuitem"
                  @click="handleBatchFormGenerateClick"
                >
                  <ThunderboltOutlined />
                  <span>{{ batchFormGenerateMenuLabel }}</span>
                </button>
                <button
                  type="button"
                  class="scp-topbar-ops-panel__item"
                  role="menuitem"
                  :disabled="batchImageGenerateMenuDisabled"
                  @click="handleBatchImageGenerateClick"
                >
                  <PictureOutlined />
                  <span>{{ batchImageGenerateMenuLabel }}</span>
                </button>
                <button
                  v-if="activeTab === 'character'"
                  type="button"
                  class="scp-topbar-ops-panel__item"
                  role="menuitem"
                  :disabled="batchCardGenerateMenuDisabled"
                  @click="handleBatchCardGenerateClick"
                >
                  <IdcardOutlined />
                  <span>批量生成设定卡</span>
                </button>
                <button
                  type="button"
                  class="scp-topbar-ops-panel__item scp-topbar-ops-panel__item--danger"
                  role="menuitem"
                  :disabled="batchDeleteMenuDisabled || batchDeleteSubmitting"
                  @click="handleBatchDeleteClick"
                >
                  <DeleteOutlined />
                  <span>批量删除</span>
                </button>
              </div>
            </div>
          </template>
        </a-dropdown>
      </div>
    </div>

    <div
      v-if="!isExtracting && extractingProgressText"
      class="scp-task-restore-banner"
      role="status"
      aria-live="polite"
    >
      <span class="scp-task-restore-banner__text">{{ extractingProgressText }}</span>
    </div>

    <!-- 内容 -->
    <div class="scp-content">
      <!-- 提取中状态 -->
      <div v-if="isExtracting" class="extracting-view">
        <div class="extracting-title" role="status" aria-live="polite">{{ extractingLiveTitle }}</div>
        <div class="extracting-actions">
          <a-button size="small" danger @click="$emit('stop-extract')">停止生成</a-button>
        </div>
        <div class="extracting-placeholder">
          <img src="@/assets/img/icon/tmp00000001.png" alt="" class="extracting-placeholder-image" />
        </div>
      </div>

      <!-- 场景 / 角色 / 道具：有数据展示对应列表，无数据共用空状态 -->
      <div
        v-else-if="!isExtracting"
        class="asset-section"
        :class="{ 'asset-section--bootstrap-pending': showAssetBootstrapMask || showActiveTabAssetLoading }"
      >
        <div
          v-if="showAssetBootstrapMask || showActiveTabAssetLoading"
          class="scp-asset-bootstrap-mask"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <LoadingOutlined spin class="scp-asset-bootstrap-mask__icon" />
          <p class="scp-asset-bootstrap-mask__text">{{ assetLoadingMaskText }}</p>
        </div>
        <div v-else-if="activeTab === 'scene' && localValue.scenes.length > 0" class="scene-generation-view">
          <!-- 提取完成、尚未生成形态：小卡片横滑列表 -->
          <div v-if="pendingSceneFormCards.length > 0" class="scp-pending-form-strip-wrap">
            <p class="scp-pending-form-strip-hint">以下场景需先「生成形态」后再编辑详情与配图</p>
            <div class="scp-pending-form-strip" role="list">
              <div
                v-for="card in pendingSceneFormCards"
                :key="`pending-scene-${card.assetId}`"
                class="scp-pending-form-card character-form-card"
                role="listitem"
              >
                <div class="scp-pending-form-card__head">
                  <span class="scp-pending-form-card__title">
                    <EnvironmentOutlined class="scp-pending-form-card__title-ico" aria-hidden="true" />
                    <span
                      v-if="pendingFormCardPrefix(card)"
                      class="scp-pending-form-card__title-prefix"
                    >{{ pendingFormCardPrefix(card) }}</span>
                    <a-input
                      v-if="editingPendingFormCardKey === pendingFormCardEditKey(card)"
                      v-model:value="editingPendingFormTitle"
                      size="small"
                      class="scp-pending-form-card__title-input"
                      @blur="handlePendingFormCardTitleBlur(card)"
                      @press-enter="handlePendingFormCardTitleBlur(card)"
                      @click.stop
                    />
                    <span
                      v-else
                      class="scp-pending-form-card__title-text scp-pending-form-card__title-editable"
                      @click="startEditPendingFormCardTitle(card)"
                    >{{ pendingFormCardEditableSuffix(card) }}</span>
                  </span>
                  <a-dropdown trigger="hover" placement="bottomRight">
                    <span class="scp-pending-form-card__more" role="button" tabindex="0" @click.prevent>
                      <MoreOutlined />
                    </span>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item danger @click="handleDeletePendingFormCard(card)">
                          <DeleteOutlined /> 删除
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
                <div class="scp-pending-form-card__body">
                  <a-button
                    type="primary"
                    class="scp-pending-form-card__gen-btn"
                    :loading="!!pendingFormGenBusy[card.assetId]"
                    :disabled="!!pendingFormGenBusy[card.assetId]"
                    @click="runPendingExtractFormGenerate(card)"
                  >
                    <div class="text-gradient">
                      生成形态
                    </div>
                  </a-button>
                </div>
              </div>
            </div>
          </div>
          <!-- 场景卡片列表（顶栏说明文案在 .scp-topbar-hint） -->
          <div class="scene-cards-container">
            <!-- 场景列表：统一为原「手动」单列布局（含自动识别项） -->
            <div v-if="visibleManualScenesList.length > 0" class="scene-cards-manual">
              <div
                v-for="scene in visibleManualScenesList"
                :key="`manual-scene-${scene.index}`"
                class="scene-card-wrapper"
              >
                <!-- 头部横条：和卡片同级，占满一行 -->
                <div class="scene-card-header-bar">
                  <div class="scene-card-title-wrapper">
                    <span class="scene-card-title-prefix">{{ getScenePrefix(scene.name) }}</span>
                    <a-input
                      v-if="editingSceneIndex === scene.index"
                      v-model:value="editingSceneName"
                      size="small"
                      class="scene-name-input"
                      @blur="handleSceneNameBlur(scene.index)"
                      @press-enter="handleSceneNameBlur(scene.index)"
                      @click.stop
                    />
                    <span
                      v-else
                      class="scene-card-title-editable"
                      @click="startEditSceneName(scene.index, scene.name)"
                    >
                      {{ getSceneName(scene.name) }}
                    </span>
                  </div>
                  <div class="scene-card-actions-header">
                    <a-button size="small" @click="handleEditSceneSetting(scene.index)">
                      修改场景设定
                    </a-button>
                    <a-button size="small" @click="handleEditSceneImage(scene.index)">
                      编辑场景图
                    </a-button>
                    <a-button size="small" @click="handleCopyScene(scene.index)">
                      复制场景
                    </a-button>
                    <a-button size="small" danger @click="removeScene(scene.index)">
                      删除场景
                    </a-button>
                  </div>
                </div>
                <!-- 卡片内容：定宽，和头部横条同级（含原「自动」列表的生成中/失败态） -->
                <template v-if="sceneGenerationStatus[scene.index] === 'generating'">
                  <div class="character-form-content scene-image-form-content">
                    <div class="asset-visual-generating-block" role="status" aria-live="polite">
                      <div class="asset-visual-generating-block__shimmer" aria-hidden="true" />
                      <LoadingOutlined spin class="asset-visual-generating-block__icon" />
                      <p class="asset-visual-generating-block__text">正在生成场景图…</p>
                    </div>
                  </div>
                </template>
                <template v-else-if="sceneGenerationStatus[scene.index] === 'failed'">
                  <div class="character-form-content scene-image-form-content">
                    <div class="scene-card scene-card-failed character-form-generate-failed">
                      <div class="scene-card-failed-content">
                        <div class="scene-card-failed-icon">
                          <img :src="iconEmptyFail" alt="" class="scene-card-failed-icon-image">
                        </div>
                        <div class="scene-card-failed-text">生成失败</div>
                        <a-button
                          type="primary"
                          class="scene-card-failed-retry"
                          :disabled="isManualScene(scene.index)"
                          @click="handleAutoGenerateScene(scene.index)"
                        >
                          重新生成
                        </a-button>
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else-if="sceneImages[scene.index] && sceneImages[scene.index].length > 0">
                  <div class="scene-card-list">
                    <div
                    v-for="(img, imgIdx) in sceneImages[scene.index]"
                    :key="`manual-scene-${scene.index}-img-${imgIdx}`"
                    class="scene-card scene-card-auto"
                  >
                    <div class="scene-card-header-with-image">
                      <a-input
                        v-if="editingImageTitleIndex === `${scene.index}-${imgIdx}`"
                        v-model:value="editingImageTitle"
                        size="small"
                        class="image-title-input"
                        @blur="handleImageTitleBlur(scene.index, imgIdx)"
                        @press-enter="handleImageTitleBlur(scene.index, imgIdx)"
                        @click.stop
                      />
                      <span
                        v-else
                        class="scene-card-title-editable"
                        @click="startEditImageTitle(scene.index, imgIdx, img.title || `场景图${imgIdx + 1}`)"
                      >
                        {{ img.title || `场景图${imgIdx + 1}` }}
                      </span>
                      <img style="cursor: pointer" @click="handleDeleteSceneImageByIndex(scene.index, imgIdx)" src="@/assets/img/icon/Delelte.svg" alt="">
                    </div>
                    <div class="scene-card-image-body">
                      <img
                        :src="img.url"
                        class="scene-main-image"
                        @click="handleEditSceneImageWithIndex(scene.index, imgIdx)"
                      >
                    </div>
                    <div class="scene-card-image-footer asset-action-footer">
                      <a-button @click="handlePreviewSceneImageByIndex(scene.index, imgIdx)">
                        <template #icon><img :src="iconPreview" alt="" class="footer-action-icon"></template>
                        预览
                      </a-button>
                      <a-button @click="handleReplaceSceneImageByIndex(scene.index, imgIdx)">
                        <template #icon><img :src="iconReplace" alt="" class="footer-action-icon"></template>
                        替换
                      </a-button>
                      <a-button @click="handleDownloadSceneImageByIndex(scene.index, imgIdx)">
                        <template #icon><img :src="iconDownload" alt="" class="footer-action-icon"></template>
                        下载
                      </a-button>
                    </div>
                  </div>
                  </div>
                </template>
                <div v-else class="character-form-content scene-image-form-content">
                  <div class="character-form-card manual-generate-card">
                    <div class="asset-generate-card__actions">
                      <a-button
                        type="primary"
                        class="asset-generate-card__action asset-generate-card__action--primary"
                        :disabled="isManualScene(scene.index) || sceneGenerationStatus[scene.index] === 'generating'"
                        @click="handleAutoGenerateScene(scene.index)"
                      >
                        自动生成
                      </a-button>
                      <div class="asset-generate-card__or">或</div>
                      <a-button
                        class="asset-generate-card__action"
                        @click="handleImportSceneImage(scene.index)"
                      >
                        图片导入
                      </a-button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'character' && localValue.characters.length > 0" class="character-generation-view">
          <div v-if="pendingCharacterFormCards.length > 0" class="scp-pending-form-strip-wrap">
            <p class="scp-pending-form-strip-hint">以下角色需先「生成形态」后再编辑详情与配图</p>
            <div class="scp-pending-form-strip" role="list">
              <div
                v-for="card in pendingCharacterFormCards"
                :key="`pending-character-${card.assetId}`"
                class="scp-pending-form-card character-form-card"
                role="listitem"
              >
                <div class="scp-pending-form-card__head">
                  <span class="scp-pending-form-card__title">
                    <UserOutlined class="scp-pending-form-card__title-ico" aria-hidden="true" />
                    <span
                      v-if="pendingFormCardPrefix(card)"
                      class="scp-pending-form-card__title-prefix"
                    >{{ pendingFormCardPrefix(card) }}</span>
                    <a-input
                      v-if="editingPendingFormCardKey === pendingFormCardEditKey(card)"
                      v-model:value="editingPendingFormTitle"
                      size="small"
                      class="scp-pending-form-card__title-input"
                      @blur="handlePendingFormCardTitleBlur(card)"
                      @press-enter="handlePendingFormCardTitleBlur(card)"
                      @click.stop
                    />
                    <span
                      v-else
                      class="scp-pending-form-card__title-text scp-pending-form-card__title-editable"
                      @click="startEditPendingFormCardTitle(card)"
                    >{{ pendingFormCardEditableSuffix(card) }}</span>
                  </span>
                  <a-dropdown trigger="hover" placement="bottomRight">
                    <span class="scp-pending-form-card__more" role="button" tabindex="0" @click.prevent>
                      <MoreOutlined />
                    </span>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item danger @click="handleDeletePendingFormCard(card)">
                          <DeleteOutlined /> 删除
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
                <div class="scp-pending-form-card__body">
                  <a-button
                    type="primary"
                    class="scp-pending-form-card__gen-btn"
                    :loading="!!pendingFormGenBusy[card.assetId]"
                    :disabled="!!pendingFormGenBusy[card.assetId]"
                    @click="runPendingExtractFormGenerate(card)"
                  >
                  <div class="text-gradient">
                      生成形态
                    </div>
                  </a-button>
                </div>
              </div>
            </div>
          </div>
          <!-- 角色列表（顶栏说明文案在 .scp-topbar-hint） -->
          <div class="character-cards-container">
            <div v-if="visibleManualCharactersList.length > 0" class="character-cards-manual">
              <div
                v-for="character in visibleManualCharactersList"
                :key="`manual-character-${character.index}`"
                class="character-card-wrapper"
              >
                <!-- 头部横条：和卡片同级，占满一行 -->
                <div class="character-card-header-bar">
                  <div class="character-card-title-wrapper">
                    <span class="character-card-title-prefix">{{ getCharacterPrefix(character.name) }}</span>
                    <a-input
                      v-if="editingCharacterIndex === character.index"
                      v-model:value="editingCharacterName"
                      size="small"
                      class="character-name-input"
                      @blur="handleCharacterNameBlur(character.index)"
                      @press-enter="handleCharacterNameBlur(character.index)"
                      @click.stop
                    />
                    <span
                      v-else
                      class="character-card-title-editable"
                      @click="startEditCharacterName(character.index, character.name)"
                    >
                      {{ getCharacterName(character.name) }}
                    </span>
                  </div>
                  <div class="character-card-actions-header">
                    <a-button size="small" @click="handleEditCharacterSetting(character.index)">
                      修改角色设定
                    </a-button>
                    <a-button size="small" danger @click="removeCharacter(character.index)">
                      删除角色
                    </a-button>
                  </div>
                </div>

                <!-- 形态列表 -->
                <div v-if="characterForms[character.index] && characterForms[character.index].length > 0" class="character-forms-list">
                  <div
                    v-for="(form, formIndex) in characterForms[character.index]"
                    :key="`form-${character.index}-${formIndex}`"
                    class="character-form-item"
                  >
                    <div class="character-form-header">
                      <div class="character-form-title-wrapper">
                        <span class="character-form-title-prefix">{{ getFormPrefix(form.name) }}</span>
                        <a-input
                          v-if="editingFormIndex === `${character.index}-${formIndex}`"
                          v-model:value="editingFormName"
                          size="small"
                          class="form-name-input"
                          @blur="handleFormNameBlur(character.index, formIndex)"
                          @press-enter="handleFormNameBlur(character.index, formIndex)"
                          @click.stop
                        />
                        <span
                          v-else
                          class="character-form-title-editable"
                          @click="startEditFormName(character.index, formIndex, form.name)"
                        >
                          {{ getFormName(form.name) }}
                        </span>
                        <div class="character-form-voiceover">
                        <span class="voiceover-label">配音:</span>
                        <a-button
                          type="text"
                          size="small"
                          class="voiceover-btn"
                          @click="openVoiceTimbrePicker(character.index, formIndex)"
                        >
                          {{ form.voiceover || '无配音' }}
                          <RightOutlined />
                        </a-button>
                        <a-button
                          v-if="form.voiceover"
                          type="text"
                          size="small"
                          :class="['voice-preview-btn', { 'is-playing': playingVoicePreviewKey === `${character.index}-${formIndex}` }]"
                          @click="toggleVoicePreview(character.index, formIndex)"
                        >
                          <span v-if="playingVoicePreviewKey === `${character.index}-${formIndex}`" class="voice-preview-eq" aria-hidden="true">
                            <span class="voice-preview-eq-bar voice-preview-eq-bar-1" />
                            <span class="voice-preview-eq-bar voice-preview-eq-bar-2" />
                            <span class="voice-preview-eq-bar voice-preview-eq-bar-3" />
                          </span>
                          {{ playingVoicePreviewKey === `${character.index}-${formIndex}` ? '播放中' : '试听' }}
                        </a-button>
                      </div>
                      </div>
                  
                      <div class="character-form-actions">
                        <a-button size="small" @click="handleEditCharacterFormImage(character.index, formIndex)">
                          编辑形态图
                        </a-button>
                        <a-button size="small" @click="handleCopyCharacterForm(character.index, formIndex)">
                          复制形态
                        </a-button>
                        <a-button size="small" danger @click="handleDeleteCharacterForm(character.index, formIndex)">
                          删除形态
                        </a-button>
                      </div>
                    </div>
                    <div class="character-form-content">
                      <template
                        v-if="characterFormGenerationStatus[`${character.index}-${formIndex}`] === 'generating'"
                      >
                        <div class="asset-visual-generating-block" role="status" aria-live="polite">
                          <div class="asset-visual-generating-block__shimmer" aria-hidden="true" />
                          <LoadingOutlined spin class="asset-visual-generating-block__icon" />
                          <p class="asset-visual-generating-block__text">正在生成角色形态图…</p>
                        </div>
                      </template>
                      <template
                        v-else-if="characterFormGenerationStatus[`${character.index}-${formIndex}`] === 'failed'"
                      >
                        <div class="scene-card scene-card-failed character-form-generate-failed">
                          <div class="scene-card-failed-content">
                            <div class="scene-card-failed-icon">
                              <img :src="iconEmptyFail" alt="" class="scene-card-failed-icon-image">
                            </div>
                            <div class="scene-card-failed-text">生成失败</div>
                            <a-button
                              type="primary"
                              class="scene-card-failed-retry"
                              :disabled="isManualCharacter(character.index)"
                              @click="handleAutoGenerateCharacterForm(character.index, formIndex)"
                            >
                              重新生成
                            </a-button>
                          </div>
                        </div>
                      </template>
                      <!-- 如果有图片，显示图片列表 -->
                      <template v-else-if="characterFormImages[`${character.index}-${formIndex}`] && characterFormImages[`${character.index}-${formIndex}`].length > 0">
                        <div class="scene-card-list character-form-images-list">
                          <div
                            v-for="(img, imgIdx) in characterFormImages[`${character.index}-${formIndex}`]"
                            :key="`character-form-${character.index}-${formIndex}-img-${imgIdx}`"
                            class="scene-card scene-card-auto"
                          >
                            <div class="scene-card-header-with-image">
                              <a-input
                                v-if="editingImageTitleIndex === `character-form-${character.index}-${formIndex}-${imgIdx}`"
                                v-model:value="editingImageTitle"
                                size="small"
                                class="image-title-input"
                                @blur="handleCharacterFormImageTitleBlur(character.index, formIndex, imgIdx)"
                                @press-enter="handleCharacterFormImageTitleBlur(character.index, formIndex, imgIdx)"
                                @click.stop
                              />
                              <span
                                v-else
                                class="scene-card-title-editable"
                                @click="startEditCharacterFormImageTitle(character.index, formIndex, imgIdx, img.title || `形态图${imgIdx + 1}`)"
                              >
                                {{ img.title || `形态图${imgIdx + 1}` }}
                              </span>
                              <img
                                style="cursor: pointer"
                                @click="handleDeleteCharacterFormImageByIndex(character.index, formIndex, imgIdx)"
                                src="@/assets/img/icon/Delelte.svg"
                                alt=""
                              >
                            </div>
                            <div class="scene-card-image-body">
                              <img
                                :src="img.url"
                                class="scene-main-image"
                                @click="handleEditCharacterFormImageWithIndex(character.index, formIndex, imgIdx)"
                              >
                            </div>
                            <div class="scene-card-image-footer asset-action-footer">
                              <a-button @click="handlePreviewCharacterFormImageByIndex(character.index, formIndex, imgIdx)">
                                <template #icon><img :src="iconPreview" alt="" class="footer-action-icon"></template>
                                预览
                              </a-button>
                              <a-button @click="handleReplaceCharacterFormImageByIndex(character.index, formIndex, imgIdx)">
                                <template #icon><img :src="iconReplace" alt="" class="footer-action-icon"></template>
                                替换
                              </a-button>
                              <a-button @click="handleDownloadCharacterFormImageByIndex(character.index, formIndex, imgIdx)">
                                <template #icon><img :src="iconDownload" alt="" class="footer-action-icon"></template>
                                下载
                              </a-button>
                            </div>
                          </div>
                        </div>
                      </template>
                      <!-- 没有图片时显示按钮 -->
                      <div v-else class="character-form-card manual-generate-card">
                        <div class="asset-generate-card__actions">
                          <a-button
                            type="primary"
                            class="asset-generate-card__action asset-generate-card__action--primary"
                            :disabled="
                              isManualCharacter(character.index) ||
                              characterFormGenerationStatus[`${character.index}-${formIndex}`] === 'generating'
                            "
                            @click="handleAutoGenerateCharacterForm(character.index, formIndex)"
                          >
                            自动生成
                          </a-button>
                          <div class="asset-generate-card__or">或</div>
                          <a-button
                            class="asset-generate-card__action"
                            @click="handleImportCharacterFormImage(character.index, formIndex)"
                          >
                            图片导入
                          </a-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 新增形态按钮 -->
                <div class="character-add-form">
                  <a-button type="primary" @click="handleAddCharacterForm(character.index)">
                    <template #icon><PlusOutlined /></template>
                    <div class="text-gradient">新增形态</div>
                  </a-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'prop' && localValue.props.length > 0" class="prop-generation-view">
          <div v-if="pendingPropFormCards.length > 0" class="scp-pending-form-strip-wrap">
            <p class="scp-pending-form-strip-hint">以下道具需先「生成形态」后再编辑详情与配图</p>
            <div class="scp-pending-form-strip" role="list">
              <div
                v-for="card in pendingPropFormCards"
                :key="`pending-prop-${card.assetId}`"
                class="scp-pending-form-card character-form-card"
                role="listitem"
              >
                <div class="scp-pending-form-card__head">
                  <span class="scp-pending-form-card__title">
                    <BlockOutlined class="scp-pending-form-card__title-ico" aria-hidden="true" />
                    <span
                      v-if="pendingFormCardPrefix(card)"
                      class="scp-pending-form-card__title-prefix"
                    >{{ pendingFormCardPrefix(card) }}</span>
                    <a-input
                      v-if="editingPendingFormCardKey === pendingFormCardEditKey(card)"
                      v-model:value="editingPendingFormTitle"
                      size="small"
                      class="scp-pending-form-card__title-input"
                      @blur="handlePendingFormCardTitleBlur(card)"
                      @press-enter="handlePendingFormCardTitleBlur(card)"
                      @click.stop
                    />
                    <span
                      v-else
                      class="scp-pending-form-card__title-text scp-pending-form-card__title-editable"
                      @click="startEditPendingFormCardTitle(card)"
                    >{{ pendingFormCardEditableSuffix(card) }}</span>
                  </span>
                  <a-dropdown trigger="hover" placement="bottomRight">
                    <span class="scp-pending-form-card__more" role="button" tabindex="0" @click.prevent>
                      <MoreOutlined />
                    </span>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item danger @click="handleDeletePendingFormCard(card)">
                          <DeleteOutlined /> 删除
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
                <div class="scp-pending-form-card__body">
                  <a-button
                    type="primary"
                    class="scp-pending-form-card__gen-btn"
                    :loading="!!pendingFormGenBusy[card.assetId]"
                    :disabled="!!pendingFormGenBusy[card.assetId]"
                    @click="runPendingExtractFormGenerate(card)"
                  >
                    <div class="text-gradient">
                      生成形态
                    </div>
                  </a-button>
                </div>
              </div>
            </div>
          </div>
          <!-- 道具列表（顶栏说明文案在 .scp-topbar-hint） -->
          <div class="prop-cards-container">
            <div v-if="visibleManualPropsList.length > 0" class="prop-cards-manual">
              <div
                v-for="prop in visibleManualPropsList"
                :key="`manual-prop-${prop.index}`"
                class="prop-card-wrapper"
              >
                <!-- 头部横条：和卡片同级，占满一行 -->
                <div class="prop-card-header-bar">
                  <div class="prop-card-title-wrapper">
                    <span class="prop-card-title-prefix">{{ getPropPrefix(prop.name) }}</span>
                    <a-input
                      v-if="editingPropIndex === prop.index"
                      v-model:value="editingPropName"
                      size="small"
                      class="prop-name-input"
                      @blur="handlePropNameBlur(prop.index)"
                      @press-enter="handlePropNameBlur(prop.index)"
                      @click.stop
                    />
                    <span
                      v-else
                      class="prop-card-title-editable"
                      @click="startEditPropName(prop.index, prop.name)"
                    >
                      {{ getPropName(prop.name) }}
                    </span>
                  </div>
                  <div class="prop-card-actions-header">
                    <a-button size="small" @click="handleEditPropSetting(prop.index)">
                      修改道具设定
                    </a-button>
                    <a-button size="small" danger @click="removeProp(prop.index)">
                      删除道具
                    </a-button>
                  </div>
                </div>

                <!-- 形态列表 -->
                <div v-if="propForms[prop.index] && propForms[prop.index].length > 0" class="prop-forms-list">
                  <div
                    v-for="(form, formIndex) in propForms[prop.index]"
                    :key="`prop-form-${prop.index}-${formIndex}`"
                    class="prop-form-item"
                  >
                    <div class="prop-form-header">
                      <div class="prop-form-title-wrapper">
                        <span class="prop-form-title-prefix">{{ getPropFormPrefix(form.name) }}</span>
                        <a-input
                          v-if="editingPropFormIndex === `${prop.index}-${formIndex}`"
                          v-model:value="editingPropFormName"
                          size="small"
                          class="prop-form-name-input"
                          @blur="handlePropFormNameBlur(prop.index, formIndex)"
                          @press-enter="handlePropFormNameBlur(prop.index, formIndex)"
                          @click.stop
                        />
                        <span
                          v-else
                          class="prop-form-title-editable"
                          @click="startEditPropFormName(prop.index, formIndex, form.name)"
                        >
                          {{ getPropFormName(form.name) }}
                        </span>
                      </div>
                      <div class="prop-form-actions">
                        <a-button size="small" @click="handleEditPropFormImage(prop.index, formIndex)">
                          编辑形态图
                        </a-button>
                        <a-button size="small" @click="handleCopyPropForm(prop.index, formIndex)">
                          复制形态
                        </a-button>
                        <a-button size="small" danger @click="handleDeletePropForm(prop.index, formIndex)">
                          删除形态
                        </a-button>
                      </div>
                    </div>
                    <div class="prop-form-content">
                      <template
                        v-if="propFormGenerationStatus[`${prop.index}-${formIndex}`] === 'generating'"
                      >
                        <div class="asset-visual-generating-block" role="status" aria-live="polite">
                          <div class="asset-visual-generating-block__shimmer" aria-hidden="true" />
                          <LoadingOutlined spin class="asset-visual-generating-block__icon" />
                          <p class="asset-visual-generating-block__text">正在生成道具形态图…</p>
                        </div>
                      </template>
                      <template
                        v-else-if="propFormGenerationStatus[`${prop.index}-${formIndex}`] === 'failed'"
                      >
                        <div class="scene-card scene-card-failed character-form-generate-failed">
                          <div class="scene-card-failed-content">
                            <div class="scene-card-failed-icon">
                              <img :src="iconEmptyFail" alt="" class="scene-card-failed-icon-image">
                            </div>
                            <div class="scene-card-failed-text">生成失败</div>
                            <a-button
                              type="primary"
                              class="scene-card-failed-retry"
                              :disabled="isManualProp(prop.index)"
                              @click="handleAutoGeneratePropForm(prop.index, formIndex)"
                            >
                              重新生成
                            </a-button>
                          </div>
                        </div>
                      </template>
                      <!-- 如果有图片，显示图片列表 -->
                      <template v-else-if="propFormImages[`${prop.index}-${formIndex}`] && propFormImages[`${prop.index}-${formIndex}`].length > 0">
                        <div class="scene-card-list prop-form-images-list">
                          <div
                            v-for="(img, imgIdx) in propFormImages[`${prop.index}-${formIndex}`]"
                            :key="`prop-form-${prop.index}-${formIndex}-img-${imgIdx}`"
                            class="scene-card scene-card-auto"
                          >
                            <div class="scene-card-header-with-image">
                              <a-input
                                v-if="editingImageTitleIndex === `prop-form-${prop.index}-${formIndex}-${imgIdx}`"
                                v-model:value="editingImageTitle"
                                size="small"
                                class="image-title-input"
                                @blur="handlePropFormImageTitleBlur(prop.index, formIndex, imgIdx)"
                                @press-enter="handlePropFormImageTitleBlur(prop.index, formIndex, imgIdx)"
                                @click.stop
                              />
                              <span
                                v-else
                                class="scene-card-title-editable"
                                @click="startEditPropFormImageTitle(prop.index, formIndex, imgIdx, img.title || `形态图${imgIdx + 1}`)"
                              >
                                {{ img.title || `形态图${imgIdx + 1}` }}
                              </span>
                              <img
                                style="cursor: pointer"
                                @click="handleDeletePropFormImageByIndex(prop.index, formIndex, imgIdx)"
                                src="@/assets/img/icon/Delelte.svg"
                                alt=""
                              >
                            </div>
                            <div class="scene-card-image-body">
                              <img
                                :src="img.url"
                                class="scene-main-image"
                                @click="handleEditPropFormImageWithIndex(prop.index, formIndex, imgIdx)"
                              >
                            </div>
                            <div class="scene-card-image-footer asset-action-footer">
                              <a-button @click="handlePreviewPropFormImageByIndex(prop.index, formIndex, imgIdx)">
                                <template #icon><img :src="iconPreview" alt="" class="footer-action-icon"></template>
                                预览
                              </a-button>
                              <a-button @click="handleReplacePropFormImageByIndex(prop.index, formIndex, imgIdx)"> 
                                <template #icon><img :src="iconReplace" alt="" class="footer-action-icon"></template>
                                替换
                              </a-button>
                              <a-button @click="handleDownloadPropFormImageByIndex(prop.index, formIndex, imgIdx)">
                                <template #icon><img :src="iconDownload" alt="" class="footer-action-icon"></template>
                                下载
                              </a-button>
                            </div>
                          </div>
                        </div>
                      </template>
                      <!-- 没有图片时显示按钮 -->
                      <div v-else class="prop-form-card manual-generate-card">
                        <div class="asset-generate-card__actions">
                          <a-button
                            type="primary"
                            class="asset-generate-card__action asset-generate-card__action--primary"
                            :disabled="
                              isManualProp(prop.index) ||
                              propFormGenerationStatus[`${prop.index}-${formIndex}`] === 'generating'
                            "
                            @click="handleAutoGeneratePropForm(prop.index, formIndex)"
                          >
                            自动生成
                          </a-button>
                          <div class="asset-generate-card__or">或</div>
                          <a-button
                            class="asset-generate-card__action"
                            @click="handleImportPropFormImage(prop.index, formIndex)"
                          >
                            图片导入
                          </a-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 新增形态按钮 -->
                <div class="character-add-form">
                  <a-button type="primary" @click="handleAddPropForm(prop.index)">
                    <template #icon><PlusOutlined /></template>
                    <div class="text-gradient">新增形态</div>
                  </a-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 场景 / 角色 / 道具 无数据时共用 -->
        <div v-else class="empty-asset-view">
          <div
            class="scp-asset-empty"
            :class="`scp-asset-empty--${activeTab}`"
            role="status"
            aria-live="polite"
          >
            <div class="scp-asset-empty__grid" aria-hidden="true" />
            <div class="scp-asset-empty__icon-wrap">
              <img src="/assets/img/icon/Union.svg" alt="">
            </div>
            <div class="tips">{{ emptyExtractTips }}</div>
            <div v-if="!isExtracting" class="scp-actions">
              <a-button
                type="primary"
                class="btn-primary"
                @click="(e) => onClickAutoExtract(activeTab, e)"
              >
                <div class="text-gradient">
                  {{ autoExtractEmptyButtonLabel }}
                </div>
              </a-button>
            </div>
      
          </div>
        </div>
      </div>
    </div>

    <!-- 场景设定编辑弹窗 -->
    <SceneSettingModal
      v-model:open="showSceneSettingModal"
      setting-variant="scene"
      :scene-name="currentSceneName"
      :initial-content="sceneSettings[currentSceneName]?.content || ''"
      @save="handleSaveSceneSetting"
      @save-and-update="handleSaveAndUpdateSceneImage"
    />

    <!-- 导入场景图弹窗 -->
    <ImportSceneImageModal
      v-model:open="showImportSceneImageModal"
      asset-type="scene"
      title="导入场景"
      @import="handleSceneImageImport"
    />

    <!-- 编辑场景图弹窗 -->
    <EditSceneImageModal
      v-if="currentEditSceneIndex >= 0"
      :key="`scene-edit-${currentEditSceneIndex}`"
      v-model:open="showEditSceneImageModal"
      :editor-scope-key="`scene-${currentEditSceneIndex}`"
      :scene-index="currentEditSceneIndex"
      :initial-image-index="currentEditImageIndex"
      :scenes="localValue.scenes.map((name, index) => ({
        name,
        images: sceneImages[index] || [],
        setting: sceneSettings[name]?.content || ''
      }))"
      :rps-asset-id="sceneAssetIds[currentEditSceneIndex] ?? null"
      :rps-form-ids="sceneFormIdsByIndex[currentEditSceneIndex] ?? []"
      :rps-asset-ids-by-index="sceneAssetIds"
      :rps-form-ids-by-index="sceneFormIdsByIndex"
      @update="handleSceneImageUpdate"
    />

    <!-- 角色设定编辑弹窗 -->
    <SceneSettingModal
      v-model:open="showCharacterSettingModal"
      setting-variant="character"
      :scene-name="currentCharacterName"
      :initial-content="characterSettings[currentCharacterName]?.content || ''"
      @save="handleSaveCharacterSetting"
    />

    <!-- 道具设定编辑弹窗 -->
    <SceneSettingModal
      v-model:open="showPropSettingModal"
      setting-variant="prop"
      :scene-name="currentPropName"
      :initial-content="propSettings[currentPropName]?.content || ''"
      @save="handleSavePropSetting"
    />

    <!-- 导入角色图弹窗 -->
    <ImportSceneImageModal
      v-model:open="showImportCharacterImageModal"
      asset-type="character"
      title="导入角色"
      @import="handleCharacterImageImport"
    />

    <!-- 编辑角色图弹窗 -->
    <EditSceneImageModal
      v-if="currentEditCharacterIndex >= 0"
      :key="`character-edit-${currentEditCharacterIndex}`"
      v-model:open="showEditCharacterImageModal"
      :editor-scope-key="`character-${currentEditCharacterIndex}`"
      :scene-index="currentEditCharacterIndex"
      :initial-image-index="currentEditCharacterImageIndex"
      :scenes="localValue.characters.map((name, index) => ({
        name,
        images: characterImages[index] || [],
        setting: characterSettings[name]?.content || ''
      }))"
      image-type="character"
      :rps-asset-id="characterAssetIds[currentEditCharacterIndex] ?? null"
      :rps-form-ids="characterFormIdsByIndex[currentEditCharacterIndex] ?? []"
      :rps-asset-ids-by-index="characterAssetIds"
      :rps-form-ids-by-index="characterFormIdsByIndex"
      @update="handleCharacterImageUpdate"
    />

    <!-- 导入角色形态图弹窗 -->
    <ImportSceneImageModal
      v-model:open="showImportCharacterFormImageModal"
      asset-type="character"
      title="导入角色"
      @import="handleCharacterFormImageImport"
    />

    <!-- 编辑角色形态图弹窗 -->
    <EditSceneImageModal
      v-if="currentEditCharacterFormKey"
      :key="`character-form-edit-${currentEditCharacterFormKey}`"
      v-model:open="showEditCharacterFormImageModal"
      :editor-scope-key="currentEditCharacterFormKey"
      :scene-index="Number(currentEditCharacterFormKey.split('-')[1])"
      :initial-image-index="currentEditCharacterFormImageIndex"
      :scenes="characterForms[Number(currentEditCharacterFormKey.split('-')[0])]?.map((form, formIndex) => ({
        name: form.name,
        images: characterFormImages[`${currentEditCharacterFormKey.split('-')[0]}-${formIndex}`] || []
      })) || []"
      image-type="form"
      form-parent-asset-type="character"
      :rps-asset-id="characterAssetIds[Number(currentEditCharacterFormKey.split('-')[0])] ?? null"
      :rps-form-ids="characterFormIdsByIndex[Number(currentEditCharacterFormKey.split('-')[0])] ?? []"
      @update="(formIndex, data, scopeKey) => handleCharacterFormImageUpdate(String(scopeKey || currentEditCharacterFormKey), data)"
    />

    <!-- 导入道具图弹窗 -->
    <ImportSceneImageModal
      v-model:open="showImportPropImageModal"
      asset-type="prop"
      title="导入道具"
      @import="handlePropImageImport"
    />

    <BatchGenerateAssetModal
      v-model:open="showBatchGenerateModal"
      :type="batchGenerateType"
      :items="batchGenerateItems"
      :default-model-code="creationStore.extractImageModelCodes[batchGenerateType]"
      @confirm="handleBatchGenerateConfirm"
    />

    <!-- 编辑道具图弹窗 -->
    <EditSceneImageModal
      v-if="currentEditPropIndex >= 0"
      :key="`prop-edit-${currentEditPropIndex}`"
      v-model:open="showEditPropImageModal"
      :editor-scope-key="`prop-${currentEditPropIndex}`"
      :scene-index="currentEditPropIndex"
      :initial-image-index="currentEditPropImageIndex"
      :scenes="localValue.props.map((name, index) => ({
        name,
        images: propImages[index] || [],
        setting: propSettings[name]?.content || ''
      }))"
      image-type="prop"
      :rps-asset-id="propAssetIds[currentEditPropIndex] ?? null"
      :rps-form-ids="propFormIdsByIndex[currentEditPropIndex] ?? []"
      :rps-asset-ids-by-index="propAssetIds"
      :rps-form-ids-by-index="propFormIdsByIndex"
      @update="handlePropImageUpdate"
    />

    <!-- 导入道具形态图弹窗 -->
    <ImportSceneImageModal
      v-model:open="showImportPropFormImageModal"
      asset-type="prop"
      title="导入道具"
      @import="handlePropFormImageImport"
    />

    <!-- 编辑道具形态图弹窗 -->
    <EditSceneImageModal
      v-if="currentEditPropFormKey"
      :key="`prop-form-edit-${currentEditPropFormKey}`"
      v-model:open="showEditPropFormImageModal"
      :editor-scope-key="currentEditPropFormKey"
      :scene-index="Number(currentEditPropFormKey.split('-')[1])"
      :initial-image-index="currentEditPropFormImageIndex"
      :scenes="propForms[Number(currentEditPropFormKey.split('-')[0])]?.map((form, formIndex) => ({
        name: form.name,
        images: propFormImages[`${currentEditPropFormKey.split('-')[0]}-${formIndex}`] || []
      })) || []"
      image-type="form"
      form-parent-asset-type="prop"
      :rps-asset-id="propAssetIds[Number(currentEditPropFormKey.split('-')[0])] ?? null"
      :rps-form-ids="propFormIdsByIndex[Number(currentEditPropFormKey.split('-')[0])] ?? []"
      @update="(formIndex, data, scopeKey) => handlePropFormImageUpdate(String(scopeKey || currentEditPropFormKey), data)"
    />
    <VoiceTimbrePickerModal
      v-model:open="showVoiceTimbrePickerModal"
      :initial-voice-name="voicePickerInitialName"
      @confirm="handleVoiceTimbreConfirm"
    />
    <audio
      ref="voicePreviewAudioRef"
      class="voice-preview-audio"
      @ended="handleVoicePreviewEnded"
      @pause="handleVoicePreviewPaused"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, h } from 'vue'
import { message, Input, Modal } from 'ant-design-vue'
import {
  LoadingOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  FileTextOutlined,
  PictureOutlined,
  EditOutlined,
  CopyOutlined,
  MoreOutlined,
  DownloadOutlined,
  RightOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  UserOutlined,
  BlockOutlined,
  DownOutlined,
  IdcardOutlined
} from '@ant-design/icons-vue'
import type { SceneCharacterData } from '~/types'
import { useRoute } from 'vue-router'
import {
  htmlPlainTextLength,
  htmlToPlainText,
  isHtmlContentEmpty,
  scriptApiTextToEditorHtml
} from '~/utils/htmlPlain'
import { useCreationStore } from '~/stores/creation'
import {
  resolveFormGenerateAgentCode,
  resolveFormImageAgentCode
} from '~/composables/useAidAgentResolver'
import { resolveFormImageModelCodeForTab } from '~/utils/extractAgentBiz'
import {
  FORM_GENERATE_SCENE_CODE_BY_TYPE,
  FORM_IMAGE_SCENE_CODE_BY_TYPE,
  resolveProjectGenImageSubmitFields,
  resolveProjectGenLlmSubmitFields
} from '~/utils/projectGenConfig'
import {
  userAssetExtractFormGenerate,
  userAssetExtractFormGenerateImage,
  userAssetRpsList,
  userAssetRpsCreate,
  userAssetRpsDelete,
  userAssetRpsFormCreate,
  userAssetRpsFormImageCreate,
  userAssetRpsFormImageList,
  userAssetRpsFormUse,
  userAssetRpsFormImageUpdate,
  userAssetRpsFormUnuse,
  userModelList,
  userModelListByFunc,
  userTaskList,
  userTaskDetail,
  userAssetRpsUpdateForm,
  userAssetRpsUpdateMain,
  rpsRowToUserAssetRow,
  sortUserAssetRpsRows
} from '~/utils/businessApi'
import { resolveFormImageBatchCompleteOutcome } from '~/utils/formImageTaskOutcome'
import {
  claimFormImagesFromTaskComplete,
  isFormImageAutoUseTaskType
} from '~/utils/formImageAutoUse'
import { resolveStoryScriptSaveContext, resolveProjectIdFromRouteAndStore } from '~/utils/storyScriptSaveContext'
import { inferExtractAssetTabFromSse } from '~/utils/inferExtractAssetTabFromSse'
import { routePathToCreationStep } from '~/utils/createFlowRoutes'
import { useTaskStream, taskStreamDoneForRace } from '~/composables/useTaskStream'
import { runFormImageGenerateCardBatchTask } from '~/composables/useFormImageGenerateCardTask'
import { resolveCharacterCardImageAgentCode } from '~/composables/useAidAgentResolver'
import { formatPartialFailedMessage, resumeUserTask } from '~/utils/taskPartialFailed'
import type { TaskPartialFailedData } from '~/utils/taskPartialFailed'
import type {
  AssetExtractType,
  UserAssetExtractFormGenerateData,
  UserAssetExtractFormGenerateImageData,
  UserAssetRow,
  UserAssetRpsFormImageRow,
  UserAssetRpsFormRow,
  UserAssetRpsRow,
  UserAssetRpsUpdateMainRequest,
  UserTaskRow,
  UserTaskStatus as TaskStatus
} from '~/types/business-api'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'
import SceneSettingModal from './SceneSettingModal.vue'
import ImportSceneImageModal from './ImportSceneImageModal.vue'
import EditSceneImageModal from './EditSceneImageModal.vue'
import BatchGenerateAssetModal from './BatchGenerateAssetModal.vue'
import VoiceTimbrePickerModal from './VoiceTimbrePickerModal.vue'
import iconAddScene from '~/assets/img/icon/extract.svg'
import iconAddSceneSel from '~/assets/img/icon/extract-sel.svg'
import iconAddCharacter from '~/assets/img/icon/character.svg'
import iconAddPropSel from '~/assets/img/icon/character-sel.svg'
import iconAddProp from '~/assets/img/icon/prop.svg'
import iconAddCharacterSel from '~/assets/img/icon/prop-sel.svg'
import iconPreview from '~/assets/img/icon/Preview.svg'
import iconReplace from '~/assets/img/icon/Replace.svg'
import iconDownload from '~/assets/img/icon/download.svg'
import iconEmptyFail from '~/assets/img/icon/empty_fail.svg'

type TabKey = 'scene' | 'character' | 'prop'
type CharacterFormItem = {
  name: string
  voiceover?: string
  voiceoverId?: string
  voiceoverAvatarUrl?: string
  voiceoverPreviewUrl?: string
}

interface Props {
  modelValue: SceneCharacterData
  storyScriptContent: string
  isExtracting?: boolean
  extractingStage?: 'scene' | 'character' | 'prop'
  extractingStages?: {
    scene: boolean
    character: boolean
    prop: boolean
  }
}

const props = withDefaults(defineProps<Props>(), {
  isExtracting: false,
  extractingStage: 'scene'
})

const emit = defineEmits<{
  'update:modelValue': [value: SceneCharacterData]
  'stop-extract': []
  /** 打开智能体弹窗：仅展示对应一列，开始提取后只跑该类型 */
  'open-extract-modal': [scope: 'scene' | 'character' | 'prop']
}>()

const creationStore = useCreationStore()
const route = useRoute()

/** 形态图生图（image）modelCode：仅读本作品分桶的 extractImageModelCodes */
function resolveStoredExtractImageModelCode(tab: TabKey): string | undefined {
  const code = String(creationStore.extractImageModelCodes[tab] || '').trim()
  return code || undefined
}

async function resolveSubmitImageModelCode(
  tab: TabKey,
  explicitFromModal?: string
): Promise<string | undefined> {
  const raw =
    String(explicitFromModal || '').trim() || resolveStoredExtractImageModelCode(tab) || ''
  return resolveFormImageModelCodeForTab(tab, raw, userModelListByFunc)
}

function resolveCurrentProjectId(): number | null {
  return resolveProjectIdFromRouteAndStore(creationStore, route)
}

/** 形态文案 form/generate：读项目生成配置（main_*_form），不用并行提取的 extractModelCodes */
async function resolveFormTextSubmitFields(tab: TabKey) {
  const projectId = resolveCurrentProjectId()
  const sceneCode = FORM_GENERATE_SCENE_CODE_BY_TYPE[tab]
  const fields = await resolveProjectGenLlmSubmitFields(projectId, sceneCode)
  let agentCode = fields.agentCode
  if (!agentCode) {
    agentCode = await resolveFormGenerateAgentCode(tab, projectId)
  }
  if (!agentCode) {
    const label = tab === 'scene' ? '场景' : tab === 'character' ? '角色' : '道具'
    throw new Error(`请先在「生成配置」中为「${label}形态」配置智能体`)
  }
  return {
    agentCode,
    ...(fields.modelCode ? { modelCode: fields.modelCode } : {})
  }
}

async function resolveFormImageApiSubmitFields(
  tab: TabKey,
  opts?: { modelFromModal?: string; resolutionFromModal?: string; agentFromModal?: string }
) {
  const projectId = resolveCurrentProjectId()
  const sceneCode = FORM_IMAGE_SCENE_CODE_BY_TYPE[tab]
  const manualModel =
    String(opts?.modelFromModal || '').trim() || resolveStoredExtractImageModelCode(tab) || ''
  const validatedModel = manualModel
    ? await resolveSubmitImageModelCode(tab, manualModel)
    : undefined
  const fields = await resolveProjectGenImageSubmitFields(projectId, sceneCode, {
    ...(validatedModel ? { modelCode: validatedModel } : {}),
    ...(opts?.resolutionFromModal
      ? { resolution: normalizeImageResolution(opts.resolutionFromModal) }
      : {})
  })
  let agentCode = fields.agentCode
  if (!agentCode) {
    agentCode =
      String(opts?.agentFromModal || '').trim() ||
      (await resolveFormImageAgentCode(tab, projectId))
  }
  return {
    agentCode,
    ...(fields.modelCode ? { modelCode: fields.modelCode } : {}),
    ...(fields.resolution ? { resolution: fields.resolution } : {}),
    ...(fields.aspectRatio ? { aspectRatio: fields.aspectRatio } : {})
  }
}

/** 批量弹窗 resolution 归一化为接口档位（1K / 2K / 4K） */
function normalizeImageResolution(raw: string | undefined | null): string | undefined {
  const s = String(raw || '').trim()
  if (!s) return undefined
  const lower = s.toLowerCase()
  if (lower === '1k') return '1K'
  if (lower === '2k') return '2K'
  if (lower === '4k') return '4K'
  return s
}

const activeTab = ref<TabKey>('scene')
/** bootstrap / 恢复 Tab 时已主动 load，跳过一次 watch 内重复 load */
let suppressActiveTabAssetLoadOnce = false

// 提取进行中：Tab 与 store.extractingStage、SSE 推断阶段对齐（含刷新后恢复任务）
watch(
  () => [props.isExtracting, props.extractingStage] as const,
  ([extracting, stage]) => {
    if (extracting && stage) {
      activeTab.value = stage
    }
  },
  { immediate: true }
)

const localValue = ref<SceneCharacterData>({
  characters: [],
  scenes: [],
  props: []
})

// 场景来源标记：记录哪些场景是手动添加的（必须在 watch 之前定义）
const manualScenes = ref<Set<number>>(new Set())
// 角色来源标记：记录哪些角色是手动添加的
const manualCharacters = ref<Set<number>>(new Set())
// 道具来源标记：记录哪些道具是手动添加的
const manualProps = ref<Set<number>>(new Set())
const isManualScene = (index: number) => manualScenes.value.has(index)
const isManualCharacter = (index: number) => manualCharacters.value.has(index)
const isManualProp = (index: number) => manualProps.value.has(index)

/** 后端 sourceType=1 表示手动添加的主资产 */
function isRpsManualSourceType(sourceType: unknown): boolean {
  return sourceType === 1 || sourceType === '1'
}

/** 刷新/重拉列表前：合并 Pinia 与本地 ref 中已记录的手动索引 */
function collectPersistedManualIndices(
  kind: 'scene' | 'character' | 'prop',
  listLength: number
): Set<number> {
  const localSet =
    kind === 'scene' ? manualScenes.value : kind === 'character' ? manualCharacters.value : manualProps.value
  const fromStore =
    kind === 'scene'
      ? creationStore.manualScenes
      : kind === 'character'
        ? creationStore.manualCharacters
        : creationStore.manualProps
  const merged = new Set<number>()
  localSet.forEach((i) => {
    if (i >= 0 && i < listLength) merged.add(i)
  })
  ;(fromStore || []).forEach((i) => {
    if (i >= 0 && i < listLength) merged.add(i)
  })
  return merged
}

function buildManualIndexListFromRps(
  sortedRps: UserAssetRpsRow[],
  options: {
    persistedIndices: Set<number>
    prevManualAssetIds: Set<number>
    persistedManualAssetIds?: Set<number>
  }
): number[] {
  const { persistedIndices, prevManualAssetIds, persistedManualAssetIds } = options
  return sortedRps
    .map((raw, i) => {
      const aid = raw.id != null && Number.isFinite(Number(raw.id)) ? Number(raw.id) : null
      if (isRpsManualSourceType(raw.sourceType)) return i
      if (persistedIndices.has(i)) return i
      if (aid != null && prevManualAssetIds.has(aid)) return i
      if (aid != null && persistedManualAssetIds?.has(aid)) return i
      return -1
    })
    .filter((i) => i >= 0)
}
/** 列表索引 → 服务端资产 id（用于删除接口；来自 query 列表或 create 返回） */
const sceneAssetIds = ref<Record<number, number>>({})
const characterAssetIds = ref<Record<number, number>>({})
const propAssetIds = ref<Record<number, number>>({})
/** 列表索引 → 该主表下所有形态 id（删除时需逐个调用 rps/delete） */
const sceneFormIdsByIndex = ref<Record<number, number[]>>({})
const characterFormIdsByIndex = ref<Record<number, number[]>>({})
const propFormIdsByIndex = ref<Record<number, number[]>>({})
// 角色的形态数据：Record<角色索引, 形态数组>
const characterForms = ref<Record<number, CharacterFormItem[]>>({})
// 道具的形态数据：Record<道具索引, 形态数组>
const propForms = ref<Record<number, Array<{ name: string }>>>({})

watch(
  () => props.modelValue,
  (val) => {
    localValue.value = {
      characters: [...(val?.characters || [])],
      scenes: [...(val?.scenes || [])],
      props: [...(val?.props || [])]
    }
    const newScenesLength = localValue.value.scenes.length
    const newCharactersLength = localValue.value.characters.length
    const newPropsLength = localValue.value.props.length
    // 从 store 恢复手动添加的索引（解决切换流程后返回时“添加的”变成“自动生成”的 bug）
    if (newScenesLength > 0) {
      const validManualScenes = new Set<number>(
        (creationStore.manualScenes || []).filter((i) => i < newScenesLength)
      )
      manualScenes.value = validManualScenes
    } else {
      manualScenes.value.clear()
      sceneAssetIds.value = {}
      sceneFormIdsByIndex.value = {}
    }
    if (newCharactersLength > 0) {
      const validManualCharacters = new Set<number>(
        (creationStore.manualCharacters || []).filter((i) => i < newCharactersLength)
      )
      manualCharacters.value = validManualCharacters
    } else {
      manualCharacters.value.clear()
      characterAssetIds.value = {}
      characterFormIdsByIndex.value = {}
    }
    if (newPropsLength > 0) {
      const validManualProps = new Set<number>(
        (creationStore.manualProps || []).filter((i) => i < newPropsLength)
      )
      manualProps.value = validManualProps
    } else {
      manualProps.value.clear()
      propAssetIds.value = {}
      propFormIdsByIndex.value = {}
    }
  },
  { immediate: true, deep: true }
)

function splitExtraImageUrls(extra: string | null | undefined): string[] {
  if (!extra?.trim()) return []
  return extra
    .split(/[;,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function buildImagesFromAssetRow(row: UserAssetRow): Array<{
  id: string
  title: string
  url: string
  thumbnail: string
  source: string
  importDate: string
}> {
  const list: Array<{
    id: string
    title: string
    url: string
    thumbnail: string
    source: string
    importDate: string
  }> = []
  const date = row.updateTime || row.createTime || ''
  if (row.refImageUrl) {
    list.push({
      id: String(row.id),
      title: row.assetName || '主图',
      url: row.refImageUrl,
      thumbnail: row.refImageUrl,
      source: 'server',
      importDate: date
    })
  }
  let n = 0
  for (const url of splitExtraImageUrls(row.extraImages)) {
    n += 1
    list.push({
      id: `${row.id}-ex-${n}`,
      title: `参考图${n}`,
      url,
      thumbnail: url,
      source: 'server',
      importDate: date
    })
  }
  return list
}

function reindexAssetIdMap(map: Record<number, number>, removedIdx: number): Record<number, number> {
  const next: Record<number, number> = {}
  for (const key of Object.keys(map)) {
    const i = Number(key)
    if (!Number.isFinite(i)) continue
    if (i === removedIdx) continue
    if (i < removedIdx) next[i] = map[i]!
    else next[i - 1] = map[i]!
  }
  return next
}

function reindexFormIdsByIndexMap(map: Record<number, number[]>, removedIdx: number): Record<number, number[]> {
  const next: Record<number, number[]> = {}
  for (const key of Object.keys(map)) {
    const i = Number(key)
    if (!Number.isFinite(i)) continue
    if (i === removedIdx) continue
    if (i < removedIdx) next[i] = map[i]!
    else next[i - 1] = map[i]!
  }
  return next
}

function reindexSceneGenerationStatusMap(
  map: Record<number, 'idle' | 'generating' | 'success' | 'failed'>,
  removedIdx: number
): Record<number, 'idle' | 'generating' | 'success' | 'failed'> {
  const next: Record<number, 'idle' | 'generating' | 'success' | 'failed'> = {}
  for (const key of Object.keys(map)) {
    const i = Number(key)
    if (!Number.isFinite(i)) continue
    if (i === removedIdx) continue
    if (i < removedIdx) next[i] = map[i]!
    else next[i - 1] = map[i]!
  }
  return next
}

function reindexFormGenerationStatusMap(
  map: Record<string, FormGenStatus>,
  removedAssetIdx: number
): Record<string, FormGenStatus> {
  const next: Record<string, FormGenStatus> = {}
  for (const key of Object.keys(map)) {
    const [assetIdxRaw, formIdxRaw] = key.split('-')
    const assetIdx = Number(assetIdxRaw)
    const formIdx = Number(formIdxRaw)
    if (!Number.isFinite(assetIdx) || !Number.isFinite(formIdx)) continue
    if (assetIdx === removedAssetIdx) continue
    const nextKey = assetIdx < removedAssetIdx ? `${assetIdx}-${formIdx}` : `${assetIdx - 1}-${formIdx}`
    next[nextKey] = map[key]!
  }
  return next
}

/**
 * POST /api/user/asset/rps/delete：
 * - 删除整条角色/道具：只传 id（后端级联删形态与图），不要带 formId。
 */
async function rpsDeleteWholeAsset(assetId: number | null | undefined): Promise<void> {
  if (assetId == null || !Number.isFinite(Number(assetId))) return
  try {
    await userAssetRpsDelete({ id: Number(assetId) })
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    const text = `${err?.msg ?? ''} ${err?.message ?? ''}`.toLowerCase()
    if (/不存在|已删除|not found|404/.test(text)) return
    throw e
  }
}

/** 无主资产 id 时的兜底：仅按形态逐个删除（只传 formId） */
async function rpsDeleteOrphanFormsOnly(formIds: number[]): Promise<void> {
  for (const formId of formIds) {
    if (formId == null || !Number.isFinite(Number(formId))) continue
    try {
      await userAssetRpsDelete({ formId: Number(formId) })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      const text = `${err?.msg ?? ''} ${err?.message ?? ''}`.toLowerCase()
      if (/不存在|已删除|not found|404/.test(text)) continue
      throw e
    }
  }
}

/** 删除单个形态（与 removeCharacter 中单条逻辑一致） */
async function rpsDeleteSingleForm(assetId: number, formId: number): Promise<void> {
  try {
    await userAssetRpsDelete({ id: assetId, formId })
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    const text = `${err?.msg ?? ''} ${err?.message ?? ''}`.toLowerCase()
    if (/不存在|已删除|not found|404/.test(text)) return
    throw e
  }
}

/** 将接口返回的主表 VO 中的 forms[].id 写回本地映射 */
function applyRpsRowFormIds(kind: 'scene' | 'character' | 'prop', index: number, row: UserAssetRpsRow) {
  const ids = (row.forms ?? [])
    .map((f) => f.id)
    .filter((n): n is number => n != null && Number.isFinite(Number(n)))
  if (kind === 'scene') {
    sceneFormIdsByIndex.value = { ...sceneFormIdsByIndex.value, [index]: ids }
  } else if (kind === 'character') {
    characterFormIdsByIndex.value = { ...characterFormIdsByIndex.value, [index]: ids }
  } else {
    propFormIdsByIndex.value = { ...propFormIdsByIndex.value, [index]: ids }
  }
}

/** 手动/新增资产后：优先用 create 返回值，否则再拉 rps/list 补齐形态 id */
async function syncAssetFormIdsFromServer(
  kind: 'character' | 'prop',
  index: number,
  assetId: number,
  rowHint?: UserAssetRpsRow | null
) {
  if (rowHint) applyRpsRowFormIds(kind, index, rowHint)
  const cached =
    kind === 'character'
      ? characterFormIdsByIndex.value[index] ?? []
      : propFormIdsByIndex.value[index] ?? []
  if (cached.some((id) => Number.isFinite(Number(id)) && Number(id) > 0)) return
  const fetched = await fetchRpsRowByAssetId({ tab: kind, assetId })
  if (fetched) applyRpsRowFormIds(kind, index, fetched)
}

async function resolveFormIdForAssetForm(
  tab: 'character' | 'prop',
  assetIndex: number,
  formIndex: number
): Promise<number | null> {
  const assetId =
    tab === 'character' ? characterAssetIds.value[assetIndex] : propAssetIds.value[assetIndex]
  if (assetId == null || !Number.isFinite(Number(assetId))) return null
  await syncAssetFormIdsFromServer(tab, assetIndex, Number(assetId))
  const cached =
    tab === 'character'
      ? characterFormIdsByIndex.value[assetIndex] ?? []
      : propFormIdsByIndex.value[assetIndex] ?? []
  const fromCache = cached[formIndex]
  if (fromCache != null && Number.isFinite(Number(fromCache))) return Number(fromCache)
  const latestRow = await fetchRpsRowByAssetIdWithLocalFallback({ tab, assetId: Number(assetId) })
  const forms = latestRow?.forms ?? []
  const row = forms[formIndex]
  if (row?.id != null && Number.isFinite(Number(row.id))) {
    applyRpsRowFormIds(tab, assetIndex, latestRow as UserAssetRpsRow)
    return Number(row.id)
  }
  return null
}

async function resolveInUseImageIdByFormId(formId: number): Promise<number | null> {
  try {
    const list = await userAssetRpsFormImageList({ formId, isUse: 1 })
    const first = list.find((x) => x?.id != null && Number.isFinite(Number(x.id)))
    return first ? Number(first.id) : null
  } catch {
    return null
  }
}

async function tryUseFormImage(payload: { imageId?: number | null; formId?: number | null }): Promise<number | null> {
  let targetImageId: number | null =
    payload.imageId != null && Number.isFinite(Number(payload.imageId)) ? Number(payload.imageId) : null
  if (targetImageId == null && payload.formId != null && Number.isFinite(Number(payload.formId))) {
    try {
      const list = await userAssetRpsFormImageList({ formId: Number(payload.formId) })
      const preferred =
        list.find((x) => Number(x?.isUse) === 1 && x?.id != null && Number.isFinite(Number(x.id))) ??
        list.find((x) => x?.id != null && Number.isFinite(Number(x.id))) ??
        null
      targetImageId = preferred ? Number(preferred.id) : null
    } catch {
      targetImageId = null
    }
  }
  if (targetImageId == null) return null
  try {
    const id = Number(targetImageId)
    await userAssetRpsFormUse({ imageId: id, id })
    return id
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '设置主图失败')
    return null
  }
}

/** form-image/create 返回字段兼容：新后端返回 imgId，旧结构仍可能返回 id */
function resolveCreatedFormImageId(created: any): number | null {
  const imgId = created?.imgId
  if (imgId != null && Number.isFinite(Number(imgId))) return Number(imgId)
  return null
}

/** 列表「删除」：POST form/unuse，仅取消使用中状态（不删形态记录） */
async function tryUnuseFormImage(payload: { imageId?: number | null; formId?: number | null }): Promise<boolean> {
  let targetImageId: number | null =
    payload.imageId != null && Number.isFinite(Number(payload.imageId)) ? Number(payload.imageId) : null
  if (targetImageId == null && payload.formId != null && Number.isFinite(Number(payload.formId))) {
    targetImageId = await resolveInUseImageIdByFormId(Number(payload.formId))
  }
  if (targetImageId == null) return true
  try {
    const id = Number(targetImageId)
    await userAssetRpsFormUnuse({ imageId: id, id })
    return true
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '取消主图失败')
    return false
  }
}

/** rps/update 必填 formId；形态创建仅在编辑弹窗内通过上传/资产库/AI 完成，此处不再占位 form/create */
function ensureFormIdForRpsUpdate(
  kind: 'scene' | 'character' | 'prop',
  assetIndex: number,
  formIndex: number
): number | null {
  const ids =
    kind === 'scene'
      ? sceneFormIdsByIndex.value[assetIndex] ?? []
      : kind === 'character'
        ? characterFormIdsByIndex.value[assetIndex] ?? []
        : propFormIdsByIndex.value[assetIndex] ?? []
  const id = ids[formIndex]
  return id != null && Number.isFinite(Number(id)) ? Number(id) : null
}

function mapImportSourceType(source: string): 'upload' | 'official' {
  return source === '本地上传' ? 'upload' : 'official'
}

async function syncImageTitleToRps(imageLike: any, nextTitle: string): Promise<boolean> {
  const imageId =
    imageLike?.rpsImageId != null && Number.isFinite(Number(imageLike.rpsImageId))
      ? Number(imageLike.rpsImageId)
      : null
  if (imageId == null) return true
  try {
    await userAssetRpsFormImageUpdate({ imageId, name: nextTitle })
    return true
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '图片名称同步失败')
    return false
  }
}

/** rps/list 的 forms[*].images：列表仅展示 is_use=1 且有效 URL 的图片 */
function isRpsFormImageInUse(img: UserAssetRpsFormImageRow | null | undefined): boolean {
  return Number(img?.isUse) === 1
}

function inUseImagesFromRpsForm(f: UserAssetRpsFormRow): UserAssetRpsFormImageRow[] {
  return (f.images ?? []).filter(
    (img) => isRpsFormImageInUse(img) && String(img?.imageUrl || '').trim()
  )
}

/** 同形态已有 rpsImageId 图片时，去掉 form.imageUrl 旧字段回退产生的占位卡（刷新恢复常见） */
function sanitizeSceneImageList(imgs: any[]): any[] {
  if (!Array.isArray(imgs) || !imgs.length) return []
  const byForm = new Map<number, { withId: any[]; fallback: any[]; other: any[] }>()
  const noForm: any[] = []
  for (const img of imgs) {
    const fid = Number(img?.rpsFormId)
    if (!Number.isFinite(fid) || fid <= 0) {
      noForm.push(img)
      continue
    }
    let bucket = byForm.get(fid)
    if (!bucket) {
      bucket = { withId: [], fallback: [], other: [] }
      byForm.set(fid, bucket)
    }
    const hasRpsImageId = img?.rpsImageId != null && Number.isFinite(Number(img.rpsImageId))
    const idStr = String(img?.id ?? '')
    if (hasRpsImageId) bucket.withId.push(img)
    else if (idStr.startsWith('form-')) bucket.fallback.push(img)
    else bucket.other.push(img)
  }
  const out: any[] = [...noForm]
  for (const bucket of byForm.values()) {
    if (bucket.withId.length > 0) out.push(...bucket.withId, ...bucket.other)
    else out.push(...bucket.fallback, ...bucket.other)
  }
  return out
}

/** 同一场景资产：已有 images[] 主图时去掉 legacy form.imageUrl / 「主图」占位 */
function sanitizeSceneImageListForForms(imgs: any[], forms: UserAssetRpsFormRow[]): any[] {
  let result = sanitizeSceneImageList(imgs)
  if (result.length <= 1) return result

  const formById = new Map<number, UserAssetRpsFormRow>()
  for (const f of forms) {
    const id = Number(f?.id)
    if (Number.isFinite(id) && id > 0) formById.set(id, f)
  }

  const byForm = new Map<number, any[]>()
  const noForm: any[] = []
  for (const img of result) {
    const fid = Number(img?.rpsFormId)
    if (!Number.isFinite(fid) || fid <= 0) {
      noForm.push(img)
      continue
    }
    if (!byForm.has(fid)) byForm.set(fid, [])
    byForm.get(fid)!.push(img)
  }

  const out: any[] = [...noForm]
  for (const [formId, formImgs] of byForm) {
    let kept = [...formImgs]
    if (kept.length <= 1) {
      out.push(...kept)
      continue
    }
    const legacyUrl = String(formById.get(formId)?.imageUrl || '').trim()
    if (legacyUrl) {
      const withoutLegacy = kept.filter((x) => String(x?.url ?? '').trim() !== legacyUrl)
      if (withoutLegacy.length > 0) kept = withoutLegacy
    }
    const nonGenericTitle = kept.filter((x) => {
      const t = String(x?.title ?? '').trim()
      return t && t !== '主图'
    })
    if (nonGenericTitle.length > 0) {
      kept = kept.filter((x) => String(x?.title ?? '').trim() !== '主图')
    }
    out.push(...kept)
  }
  return out
}

function step3SlotHasImageForFormId(formId: number): boolean {
  const fid = Number(formId)
  if (!Number.isFinite(fid) || fid <= 0) return false
  for (const imgs of Object.values(sceneImages.value)) {
    if ((imgs ?? []).some((img) => Number(img?.rpsFormId) === fid && String(img?.url ?? '').trim())) {
      return true
    }
  }
  for (const [k, ids] of Object.entries(sceneFormIdsByIndex.value)) {
    const si = Number(k)
    if (!Number.isFinite(si)) continue
    if (!(ids ?? []).some((id) => Number(id) === fid)) continue
    const imgs = sceneImages.value[si] ?? []
    if (imgs.some((img) => Number(img?.rpsFormId) === fid && String(img?.url ?? '').trim())) return true
  }
  for (const [k, ids] of Object.entries(characterFormIdsByIndex.value)) {
    const ci = Number(k)
    if (!Number.isFinite(ci)) continue
    const fi = (ids ?? []).findIndex((id) => Number(id) === fid)
    if (fi < 0) continue
    const slotKey = `${ci}-${fi}`
    const imgs = characterFormImages.value[slotKey] ?? []
    if (imgs.some((img) => String(img?.url ?? '').trim())) return true
  }
  for (const [k, ids] of Object.entries(propFormIdsByIndex.value)) {
    const pi = Number(k)
    if (!Number.isFinite(pi)) continue
    const fi = (ids ?? []).findIndex((id) => Number(id) === fid)
    if (fi < 0) continue
    const slotKey = `${pi}-${fi}`
    const imgs = propFormImages.value[slotKey] ?? []
    if (imgs.some((img) => String(img?.url ?? '').trim())) return true
  }
  return false
}

function sanitizeStep3SceneImagesState() {
  let changed = false
  const next: Record<number, any[]> = { ...sceneImages.value }
  for (const key of Object.keys(next)) {
    const si = Number(key)
    if (!Number.isFinite(si)) continue
    let sanitized = sanitizeSceneImageList(next[si] ?? [])
    if (sanitized.length > 1) {
      const nonGenericTitle = sanitized.filter((x) => String(x?.title ?? '').trim() !== '主图')
      if (nonGenericTitle.length > 0) sanitized = nonGenericTitle
    }
    if (sanitized.length !== (next[si]?.length ?? 0)) {
      next[si] = sanitized
      changed = true
    }
  }
  if (changed) sceneImages.value = next
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 切换项目/剧集后清空本地资产，避免与其它 Tab 未刷新数据混用 */
function clearPersonalAssetPayload() {
  manualScenes.value.clear()
  manualCharacters.value.clear()
  manualProps.value.clear()
  creationStore.manualScenes = []
  creationStore.manualCharacters = []
  creationStore.manualProps = []
  creationStore.manualSceneAssetIds = []
  sceneImages.value = {}
  characterImages.value = {}
  propImages.value = {}
  sceneAssetIds.value = {}
  characterAssetIds.value = {}
  propAssetIds.value = {}
  sceneFormIdsByIndex.value = {}
  characterFormIdsByIndex.value = {}
  propFormIdsByIndex.value = {}
  characterForms.value = {}
  propForms.value = {}
  sceneGenerationStatus.value = {}
  characterFormGenerationStatus.value = {}
  propFormGenerationStatus.value = {}
  creationStore.sceneGenerationStatus = {}
  creationStore.characterFormGenerationStatus = {}
  creationStore.propFormGenerationStatus = {}
  creationStore.clearPendingExtractFormAssets()
  update({ scenes: [], characters: [], props: [] })
}

let loadAssetTabGeneration = 0
/** 各 Tab 独立 generation，用于切换 Tab 时正确结束 loading（与全局 loadAssetTabGeneration 解耦） */
const tabAssetLoadGen: Record<TabKey, number> = { scene: 0, character: 0, prop: 0 }
const tabAssetLoading = reactive<Record<TabKey, boolean>>({
  scene: false,
  character: false,
  prop: false
})

function setTabAssetLoading(tab: TabKey, loading: boolean) {
  tabAssetLoading[tab] = loading
}

/** 主表嵌套 forms（rps/list 已批量返回形态与使用中图片） */
function getFormsForRpsRow(raw: UserAssetRpsRow): UserAssetRpsFormRow[] {
  return raw.forms ?? []
}

function assetHasPersistedForm(raw: UserAssetRpsRow): boolean {
  return getFormsForRpsRow(raw).some((f) => Number.isFinite(Number(f?.id)) && Number(f?.id) > 0)
}

/**
 * 按当前 Tab 的 rps + 形态列表同步「待生成形态」小卡片：
 * - 刷新/重新进入第三步后从服务端恢复无形态资产；
 * - 某资产已生成形态后自动从 pending 移除；
 * - 保留用户侧已有标题（与 merge 行为一致）。
 */
function reconcilePendingExtractForTabFromRps(tab: TabKey, sortedRps: UserAssetRpsRow[]) {
  const need = new Map<number, string>()
  for (const raw of sortedRps) {
    const id = Number(raw.id)
    if (!Number.isFinite(id) || id <= 0) continue
    if (assetHasPersistedForm(raw)) continue
    need.set(id, String(raw.assetName || '').trim() || '未命名')
  }
  const otherTabs = creationStore.pendingExtractFormAssets.filter((x) => x.assetType !== tab)
  const prevThisTab = creationStore.pendingExtractFormAssets.filter((x) => x.assetType === tab)
  const nextThisTab: Array<{ assetId: number; assetType: TabKey; title: string }> = []
  for (const [assetId, serverTitle] of need) {
    const prev = prevThisTab.find((x) => x.assetId === assetId)
    nextThisTab.push({
      assetId,
      assetType: tab,
      title: (prev?.title && prev.title.trim()) || serverTitle
    })
  }
  creationStore.setPendingExtractFormAssets([...otherTabs, ...nextThisTab])
}

function safeStr(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (v == null) return ''
  return String(v).trim()
}

/** 主表 summary 与 introduction 全文相同则弹窗只展示一块，避免「概要/视觉描述」重复 */
function sameMainSummaryAndIntroduction(summary: string, intro: string): boolean {
  const a = summary.trim()
  const b = intro.trim()
  return Boolean(a && b && a === b)
}

function parseStringListField(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === 'string' && v.trim()) {
    const t = v.trim()
    if (t.startsWith('[')) {
      try {
        const p = JSON.parse(t) as unknown
        if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean)
      } catch {
        /* ignore */
      }
    }
    return t.split(/[,，、|\n]/).map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function stringListFromRowField(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  return parseStringListField(v)
}

function formatTagList(arr: string[], sep = '、'): string {
  if (!arr?.length) return ''
  return arr.map((x) => String(x).trim()).filter(Boolean).join(sep)
}

function parseAvailableSlots(v: UserAssetRpsRow['availableSlots']): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === 'string' && v.trim()) {
    const t = v.trim()
    if (t.startsWith('[')) {
      try {
        const p = JSON.parse(t) as unknown
        if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean)
      } catch {
        /* ignore */
      }
    }
    return t.split(/\n/).map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function expectedAppearancesPlain(v: UserAssetRpsRow['expectedAppearances']): string {
  if (!v) return ''
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (item && typeof item === 'object') {
          const o = item as { id?: number; label?: string; name?: string }
          const label = safeStr(o.label) || safeStr(o.name)
          if (!label) return ''
          const idPart = o.id != null && Number.isFinite(Number(o.id)) ? `#${o.id} ` : ''
          return `${idPart}${label}`.trim()
        }
        return String(item).trim()
      })
      .filter(Boolean)
      .join('\n')
  }
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v) as unknown
      if (Array.isArray(p)) return expectedAppearancesPlain(p as UserAssetRpsRow['expectedAppearances'])
    } catch {
      /* ignore */
    }
    return v.trim()
  }
  return ''
}

function settingBlock(label: string, body: string): string {
  const b = (body || '').trim()
  if (!b) return ''
  return `<p><strong>${label}</strong></p>${scriptApiTextToEditorHtml(b)}`
}

/** 将 /api/user/asset/rps/list v2.25+ 主表结构化字段拼成设定弹窗富文本 */
function settingEditorHtmlFromRpsMainRow(raw: UserAssetRpsRow, variant: TabKey): string {
  const parts: string[] = []
  const rowType = String(raw.assetType || variant).toLowerCase()

  if (variant === 'scene' || rowType === 'scene') {
    const summary = safeStr(raw.summary)
    const intro = safeStr(raw.introduction)
    if (sameMainSummaryAndIntroduction(summary, intro)) {
      parts.push(settingBlock('场景视觉描述', intro))
    } else {
      if (summary) parts.push(settingBlock('概要', summary))
      if (intro) parts.push(settingBlock('场景视觉描述', intro))
    }
    const slots = parseAvailableSlots(raw.availableSlots)
    if (slots.length) parts.push(settingBlock('角色可落位', slots.join('\n')))
    const hasCrowd = raw.hasCrowd
    const crowdDesc = safeStr(raw.crowdDescription)
    // 无人群且无说明时不展示「人群」小节（避免仅显示「无人群」占版面）
    if (hasCrowd === 1) {
      parts.push(settingBlock('人群', crowdDesc ? `有人群：${crowdDesc}` : '有人群'))
    } else if (crowdDesc) {
      parts.push(
        settingBlock('人群', hasCrowd === 0 ? `无人群：${crowdDesc}` : crowdDesc)
      )
    }
  } else if (variant === 'character' || rowType === 'character') {
    const intro = safeStr(raw.introduction)
    if (intro) parts.push(settingBlock('角色介绍', intro))
    const aliases = safeStr(raw.aliasesName)
    if (aliases) parts.push(settingBlock('别名', aliases.replace(/,/g, '、')))
    const basics: string[] = []
    const g = safeStr(raw.gender)
    if (g) basics.push(`性别：${g}`)
    const ar = safeStr(raw.ageRange)
    if (ar) basics.push(`年龄段：${ar}`)
    const rl = safeStr(raw.roleLevel)
    if (rl) basics.push(`重要性：${rl}`)
    const arch = safeStr(raw.archetype)
    if (arch) basics.push(`原型：${arch}`)
    const era = safeStr(raw.eraPeriod)
    if (era) basics.push(`时代背景：${era}`)
    const occ = safeStr(raw.occupation)
    if (occ) basics.push(`职业：${occ}`)
    const ct = raw.costumeTier
    if (ct != null && String(ct).trim()) basics.push(`服装等级：${String(ct).trim()}`)
    const sc = safeStr(raw.socialClass)
    if (sc) basics.push(`社会阶层：${sc}`)
    if (basics.length) parts.push(settingBlock('基本信息', basics.join('\n')))
    const vk = formatTagList(stringListFromRowField(raw.visualKeywords))
    if (vk) parts.push(settingBlock('视觉关键词', vk))
    const pt = formatTagList(stringListFromRowField(raw.personalityTags))
    if (pt) parts.push(settingBlock('性格标签', pt))
    const scol = formatTagList(stringListFromRowField(raw.suggestedColors))
    if (scol) parts.push(settingBlock('推荐色系', scol))
    const pid = safeStr(raw.primaryIdentifier)
    if (pid) parts.push(settingBlock('主要识别特征', pid))
    const exp = expectedAppearancesPlain(raw.expectedAppearances)
    if (exp) parts.push(settingBlock('子形象列表', exp))
  } else {
    const summary = safeStr(raw.summary)
    const intro = safeStr(raw.introduction)
    if (sameMainSummaryAndIntroduction(summary, intro)) {
      parts.push(settingBlock('道具视觉描述', intro))
    } else {
      if (summary) parts.push(settingBlock('道具概要', summary))
      if (intro) parts.push(settingBlock('道具视觉描述', intro))
    }
  }

  let html = parts.join('')
  if (!html.trim() && raw.profileData?.trim()) {
    const pd = raw.profileData.trim()
    try {
      const j = JSON.parse(pd) as Record<string, unknown>
      const lines: string[] = []
      for (const [k, val] of Object.entries(j)) {
        if (val == null || val === '') continue
        const s =
          typeof val === 'string'
            ? val
            : Array.isArray(val)
              ? (val as unknown[]).map((x) => String(x)).join('、')
              : typeof val === 'object'
                ? JSON.stringify(val)
                : String(val)
        if (s.trim()) lines.push(`${k}：${s}`)
      }
      if (lines.length) html = scriptApiTextToEditorHtml(lines.join('\n\n'))
    } catch {
      html = scriptApiTextToEditorHtml(pd)
    }
  }
  return html
}

/** 富文本片段 → 纯文本，尽量保留换行（与 settingBlock + Quill 结构配合） */
function htmlToPlainPreserveLineBreaks(html: string): string {
  if (!html) return ''
  let s = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
  s = s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
  return s
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 按「约定」小节标题拆分：与 `settingBlock` 输出的 `<p><strong>标题</strong></p>` 一致；
 * Quill 可能带 class，故标签用宽松匹配。
 */
function splitSettingHtmlBySectionTitles(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!html?.trim()) return out
  const re = /<p[^>]*>\s*<strong[^>]*>\s*([^<]+?)\s*<\/strong>\s*<\/p>/gi
  const matches: { title: string; start: number; headerEnd: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    matches.push({ title: m[1].trim(), start: m.index, headerEnd: m.index + m[0].length })
  }
  for (let i = 0; i < matches.length; i++) {
    const bodyStart = matches[i].headerEnd
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].start : html.length
    out[matches[i].title] = htmlToPlainPreserveLineBreaks(html.slice(bodyStart, bodyEnd))
  }
  return out
}

function splitTagLikePlain(text: string): string[] {
  if (!text?.trim()) return []
  return text
    .split(/[,，、|/\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseCharacterBasicsSection(text: string): Partial<UserAssetRpsUpdateMainRequest> {
  const o: Partial<UserAssetRpsUpdateMainRequest> = {}
  if (!text?.trim()) return o
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    const tryField = (label: string, key: keyof UserAssetRpsUpdateMainRequest) => {
      const re = new RegExp(`^${label}[：:]\\s*(.+)$`)
      const mm = t.match(re)
      if (mm) (o as Record<string, string>)[key as string] = mm[1].trim()
    }
    tryField('性别', 'gender')
    tryField('年龄段', 'ageRange')
    tryField('重要性', 'roleLevel')
    tryField('原型', 'archetype')
    tryField('时代背景', 'eraPeriod')
    tryField('职业', 'occupation')
    tryField('社会阶层', 'socialClass')
    const ct = t.match(/^服装等级[：:]\s*(\d+)\s*$/)
    if (ct) o.costumeTier = Number(ct[1])
  }
  return o
}

function parseCrowdSection(text: string): Pick<UserAssetRpsUpdateMainRequest, 'hasCrowd' | 'crowdDescription'> {
  const t = (text || '').trim()
  const empty: Pick<UserAssetRpsUpdateMainRequest, 'hasCrowd' | 'crowdDescription'> = {}
  if (!t) return empty
  if (/^有人群[：:]/.test(t)) {
    return { hasCrowd: 1, crowdDescription: t.replace(/^有人群[：:]\s*/, '').trim() }
  }
  if (t === '有人群') return { hasCrowd: 1, crowdDescription: '' }
  if (/^无人群[：:]/.test(t)) {
    return { hasCrowd: 0, crowdDescription: t.replace(/^无人群[：:]\s*/, '').trim() }
  }
  if (t === '无人群') return { hasCrowd: 0, crowdDescription: '' }
  return { crowdDescription: t }
}

function expectedAppearancesJsonFromPlain(text: string): string | undefined {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return undefined
  const arr: Array<{ id: number; label: string }> = []
  let autoId = 0
  for (const line of lines) {
    const m = line.match(/^#?\s*(\d+)\s+(.+)$/)
    if (m) {
      arr.push({ id: Number(m[1]), label: m[2].trim() })
      continue
    }
    const m2 = line.match(/^#(\d+)\s*$/)
    if (m2) {
      arr.push({ id: Number(m2[1]), label: '' })
      continue
    }
    arr.push({ id: autoId++, label: line })
  }
  return JSON.stringify(arr)
}

const SCENE_SECTION_KEYS = new Set(['概要', '场景视觉描述', '角色可落位', '人群'])
const CHARACTER_SECTION_KEYS = new Set([
  '角色介绍',
  '别名',
  '基本信息',
  '视觉关键词',
  '性格标签',
  '推荐色系',
  '主要识别特征',
  '子形象列表'
])
const PROP_SECTION_KEYS = new Set(['道具概要', '道具视觉描述'])

function sectionsLookStructured(
  sections: Record<string, string>,
  keys: Set<string>
): boolean {
  return Object.keys(sections).some((k) => keys.has(k))
}

/**
 * 将设定弹窗 HTML 解析为 `update-main` 平铺字段（与 `settingEditorHtmlFromRpsMainRow` 小节名一一对应）。
 * 若无约定小节标题，则退回整篇 → introduction / summary。
 */
function buildUpdateMainPayloadFromSettingHtml(
  html: string,
  variant: TabKey
): Partial<UserAssetRpsUpdateMainRequest> {
  const sections = splitSettingHtmlBySectionTitles(html)
  const payload: Partial<UserAssetRpsUpdateMainRequest> = {}

  if (variant === 'scene') {
    if (sectionsLookStructured(sections, SCENE_SECTION_KEYS)) {
      const hasSummary = '概要' in sections
      const hasIntro = '场景视觉描述' in sections
      if (hasIntro && !hasSummary) {
        Object.assign(
          payload,
          profilePlainFromSettingHtml(scriptApiTextToEditorHtml(sections['场景视觉描述'] ?? ''))
        )
      } else if (hasSummary && !hasIntro) {
        Object.assign(
          payload,
          profilePlainFromSettingHtml(scriptApiTextToEditorHtml(sections['概要'] ?? ''))
        )
      } else {
        if ('概要' in sections) payload.summary = sections['概要'] ?? ''
        if ('场景视觉描述' in sections) payload.introduction = sections['场景视觉描述'] ?? ''
      }
      if ('角色可落位' in sections) {
        const slots = (sections['角色可落位'] ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        payload.availableSlots = JSON.stringify(slots)
      }
      if ('人群' in sections) {
        Object.assign(payload, parseCrowdSection(sections['人群'] ?? ''))
      }
      return payload
    }
    const { introduction, summary } = profilePlainFromSettingHtml(html)
    return { introduction, summary }
  }

  if (variant === 'character') {
    if (sectionsLookStructured(sections, CHARACTER_SECTION_KEYS)) {
      if ('角色介绍' in sections) payload.introduction = sections['角色介绍'] ?? ''
      if ('别名' in sections) {
        const raw = sections['别名'] ?? ''
        payload.aliasesName = splitTagLikePlain(raw).join(',')
      }
      if ('基本信息' in sections) {
        Object.assign(payload, parseCharacterBasicsSection(sections['基本信息'] ?? ''))
      }
      if ('视觉关键词' in sections) {
        payload.visualKeywords = splitTagLikePlain(sections['视觉关键词'] ?? '')
      }
      if ('性格标签' in sections) {
        payload.personalityTags = splitTagLikePlain(sections['性格标签'] ?? '')
      }
      if ('推荐色系' in sections) {
        payload.suggestedColors = splitTagLikePlain(sections['推荐色系'] ?? '')
      }
      if ('主要识别特征' in sections) {
        payload.primaryIdentifier = (sections['主要识别特征'] ?? '').trim()
      }
      if ('子形象列表' in sections) {
        const plain = sections['子形象列表'] ?? ''
        const j = expectedAppearancesJsonFromPlain(plain)
        payload.expectedAppearances =
          j !== undefined ? j : plain.trim() === '' ? '[]' : undefined
      }
      return payload
    }
    return profilePlainFromSettingHtml(html)
  }

  if (sectionsLookStructured(sections, PROP_SECTION_KEYS)) {
    const hasSum = '道具概要' in sections
    const hasIntro = '道具视觉描述' in sections
    if (hasIntro && !hasSum) {
      Object.assign(
        payload,
        profilePlainFromSettingHtml(scriptApiTextToEditorHtml(sections['道具视觉描述'] ?? ''))
      )
    } else if (hasSum && !hasIntro) {
      Object.assign(
        payload,
        profilePlainFromSettingHtml(scriptApiTextToEditorHtml(sections['道具概要'] ?? ''))
      )
    } else {
      if ('道具概要' in sections) payload.summary = sections['道具概要'] ?? ''
      if ('道具视觉描述' in sections) payload.introduction = sections['道具视觉描述'] ?? ''
    }
    return payload
  }
  return profilePlainFromSettingHtml(html)
}

function applyRpsSettingsToLocalMaps(
  variant: TabKey,
  names: string[],
  sortedRps: UserAssetRpsRow[],
  mapRef: { value: Record<string, { content: string; isNew?: boolean }> }
) {
  const next = { ...mapRef.value }
  names.forEach((name, i) => {
    const raw = sortedRps[i]
    if (!raw) return
    const fromApi = settingEditorHtmlFromRpsMainRow(raw, variant)
    next[name] = { content: fromApi, isNew: !fromApi.trim() }
  })
  mapRef.value = next
}

/** 仅请求当前 Tab 对应 assetType，与其它 Tab 的本地数据合并 */
async function loadPersonalAssetsForTab(tab: TabKey, options?: { allowWhenExtracting?: boolean }) {
  if (props.isExtracting && !options?.allowWhenExtracting) return
  const step = routePathToCreationStep(route.path)
  if (step !== 'scene-character') return

  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return

  const gen = ++loadAssetTabGeneration
  const tabGen = ++tabAssetLoadGen[tab]
  setTabAssetLoading(tab, true)
  const assetType = tab === 'scene' ? 'scene' : tab === 'character' ? 'character' : 'prop'

  try {
    const { rows: rpsRows } = await userAssetRpsList({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      assetType
    })
    if (gen !== loadAssetTabGeneration) return

    const sortedRps = sortUserAssetRpsRows(rpsRows)
    const rows = sortedRps.map(rpsRowToUserAssetRow)

    if (tab === 'scene') {
      const prevManualSceneAssetIds = new Set(
        Array.from(manualScenes.value)
          .map((i) => sceneAssetIds.value[i])
          .filter((id): id is number => id != null && Number.isFinite(Number(id)))
          .map((id) => Number(id))
      )
      const sceneNames = rows.map((r, i) => r.assetName || `场景${i + 1}`)
      const sceneImagesNext: Record<number, any[]> = {}
      sortedRps.forEach((raw, i) => {
        const date = raw.updateTime || raw.createTime || ''
        let imgs: any[] = []
        const forms = getFormsForRpsRow(raw)

        const pushInUseFormImages = (f: UserAssetRpsFormRow) => {
          const formId = f.id
          if (formId == null || !Number.isFinite(Number(formId))) return
          const list = inUseImagesFromRpsForm(f)
          for (const img of list) {
            const url = String(img?.imageUrl || '').trim()
            if (!url) continue
            const imageId = Number(img?.id)
            if (
              imgs.some(
                (x) =>
                  (Number.isFinite(imageId) && Number(x?.rpsImageId) === imageId) ||
                  String(x?.url ?? '').trim() === url
              )
            ) {
              continue
            }
            imgs.push({
              id: Number.isFinite(imageId) ? `img-${imageId}` : `form-${formId}`,
              rpsFormId: Number(formId),
              ...(Number.isFinite(imageId) ? { rpsImageId: imageId } : {}),
              title: String(img?.name || f.name || '主图'),
              url,
              thumbnail: url,
              source: 'server',
              importDate: date
            })
          }
        }

        // 优先 images[]；同一场景任一形态已有图时，不再用其它形态的 form.imageUrl 旧字段（刷新恢复常见双形态占位）
        for (const f of forms) {
          pushInUseFormImages(f)
        }
        if (imgs.length === 0) {
          for (const f of forms) {
            const formId = f.id
            if (formId == null || !Number.isFinite(Number(formId))) continue
            const hasNestedImageRecords = (f.images ?? []).some((img) => String(img?.imageUrl || '').trim())
            if (hasNestedImageRecords) continue
            const fallbackUrl = String(f.imageUrl || '').trim()
            if (!fallbackUrl || f.isUse === 0) continue
            if (imgs.some((x) => String(x?.url ?? '').trim() === fallbackUrl)) continue
            imgs.push({
              id: `form-${formId}`,
              rpsFormId: Number(formId),
              title: f.name?.trim() || '主图',
              url: fallbackUrl,
              thumbnail: fallbackUrl,
              source: 'server',
              importDate: date
            })
          }
        }
        if (imgs.length > 1) {
          const nonGenericTitle = imgs.filter((x) => String(x?.title ?? '').trim() !== '主图')
          if (nonGenericTitle.length > 0) imgs = nonGenericTitle
        }
        if (imgs.length) sceneImagesNext[i] = sanitizeSceneImageListForForms(imgs, forms)
      })
      sceneImages.value = sceneImagesNext
      const nextSceneGenStatus: Record<number, 'idle' | 'generating' | 'success' | 'failed'> = {
        ...creationStore.sceneGenerationStatus
      }
      sceneNames.forEach((_, i) => {
        if (sceneImagesNext[i] && sceneImagesNext[i].length > 0) {
          nextSceneGenStatus[i] = 'success'
        } else if (nextSceneGenStatus[i] !== 'failed' && nextSceneGenStatus[i] !== 'generating') {
          nextSceneGenStatus[i] = 'idle'
        }
      })
      sceneGenerationStatus.value = nextSceneGenStatus
      Object.entries(nextSceneGenStatus).forEach(([k, status]) => {
        const idx = Number(k)
        if (Number.isFinite(idx)) creationStore.setSceneGenerationStatus(idx, status)
      })
      const sceneAssetIdsNext: Record<number, number> = {}
      const sceneFormIdsNext: Record<number, number[]> = {}
      sortedRps.forEach((raw, i) => {
        if (raw.id != null && Number.isFinite(Number(raw.id))) sceneAssetIdsNext[i] = Number(raw.id)
        sceneFormIdsNext[i] = getFormsForRpsRow(raw)
          .map((f) => f.id)
          .filter((n): n is number => n != null && Number.isFinite(Number(n)))
          .map((n) => Number(n))
      })
      const persistedManualSceneIndices = collectPersistedManualIndices('scene', sortedRps.length)
      const persistedManualSceneAssetIds = new Set(
        (creationStore.manualSceneAssetIds || []).filter((id) => Number.isFinite(Number(id))).map((id) => Number(id))
      )
      const manualSceneIdx = buildManualIndexListFromRps(sortedRps, {
        persistedIndices: persistedManualSceneIndices,
        prevManualAssetIds: prevManualSceneAssetIds,
        persistedManualAssetIds: persistedManualSceneAssetIds
      })
      manualScenes.value = new Set(manualSceneIdx)
      creationStore.manualScenes = manualSceneIdx
      manualSceneIdx.forEach((i) => {
        const aid = sceneAssetIdsNext[i]
        if (aid != null && Number.isFinite(Number(aid))) {
          creationStore.addManualSceneAssetId(Number(aid))
        }
      })
      sceneAssetIds.value = sceneAssetIdsNext
      sceneFormIdsByIndex.value = sceneFormIdsNext
      update({
        scenes: sceneNames,
        characters: [...localValue.value.characters],
        props: [...localValue.value.props]
      })
      applyRpsSettingsToLocalMaps('scene', sceneNames, sortedRps, sceneSettings)
      syncStep3AfterApiLoad()
      reconcilePendingExtractForTabFromRps('scene', sortedRps)
      return
    }

    if (tab === 'character') {
      const prevManualCharacterAssetIds = new Set(
        Array.from(manualCharacters.value)
          .map((i) => characterAssetIds.value[i])
          .filter((id): id is number => id != null && Number.isFinite(Number(id)))
          .map((id) => Number(id))
      )
      const characterNames = rows.map((r, i) => r.assetName || `角色${i + 1}`)
      const characterImagesNext: Record<number, any[]> = {}
      const characterFormImagesNext: Record<string, any[]> = {}
      sortedRps.forEach((raw, i) => {
        const rawForms = getFormsForRpsRow(raw)
        const date = raw.updateTime || raw.createTime || ''
        const assetImages: any[] = []
        for (let fi = 0; fi < rawForms.length; fi++) {
          const f = rawForms[fi]
          if (f.id == null || !Number.isFinite(Number(f.id))) continue
          const formId = Number(f.id)
          const inUse = inUseImagesFromRpsForm(f)
          const mapped = inUse
            .map((img) => {
              const url = String(img?.imageUrl || '').trim()
              if (!url) return null
              const imageId = Number(img?.id)
              return {
                id: Number.isFinite(imageId) ? `img-${imageId}` : `form-${formId}`,
                rpsFormId: formId,
                ...(Number.isFinite(imageId) ? { rpsImageId: imageId } : {}),
                title: String(img?.name || f.name || `形态图${fi + 1}`),
                url,
                thumbnail: url,
                source: 'server',
                importDate: date
              }
            })
            .filter(Boolean) as any[]
          if (mapped.length > 0) {
            characterFormImagesNext[`${i}-${fi}`] = mapped
            assetImages.push(...mapped)
            continue
          }
          const fallbackUrl = String(f.imageUrl || '').trim()
          if (!fallbackUrl || f.isUse === 0) continue
          const fallback = {
            id: `form-${formId}`,
            rpsFormId: formId,
            title: f.name?.trim() || `形态图${fi + 1}`,
            url: fallbackUrl,
            thumbnail: fallbackUrl,
            source: 'server',
            importDate: date
          }
          characterFormImagesNext[`${i}-${fi}`] = [fallback]
          assetImages.push(fallback)
        }
        if (assetImages.length) characterImagesNext[i] = assetImages
      })
      /**
       * 主表已存在但从表 forms 仍为空时（新建角色尚未上传形态图），与 addCharacter 本地态一致，
       * 保留一个「形态1：未命名」占位，避免刷新后整块形态区消失。
       */
      const charFormsNext: Record<number, CharacterFormItem[]> = {}
      for (let i = 0; i < sortedRps.length; i++) {
        const rawForms = getFormsForRpsRow(sortedRps[i])
        if (rawForms.length > 0) {
          charFormsNext[i] = rawForms.map((f, idx) => ({
            name: f.name?.trim() ? f.name : `形态${idx + 1}: 未命名`,
            voiceover: undefined,
            voiceoverId: undefined,
            voiceoverAvatarUrl: undefined,
            voiceoverPreviewUrl: undefined
          }))
        } else {
          charFormsNext[i] = [{ name: '形态1: 未命名', voiceover: undefined, voiceoverId: undefined, voiceoverAvatarUrl: undefined, voiceoverPreviewUrl: undefined }]
        }
      }
      characterForms.value = charFormsNext
      characterImages.value = characterImagesNext
      characterFormImages.value = characterFormImagesNext
      const nextCharacterFormGenStatus: Record<string, FormGenStatus> = {
        ...creationStore.characterFormGenerationStatus
      }
      Object.keys(charFormsNext).forEach((ck) => {
        const ci = Number(ck)
        const forms = charFormsNext[ci] ?? []
        forms.forEach((_, fi) => {
          const key = `${ci}-${fi}`
          const hasImage = Array.isArray(characterFormImagesNext[key]) && characterFormImagesNext[key]!.length > 0
          if (hasImage) {
            nextCharacterFormGenStatus[key] = 'success'
          } else if (nextCharacterFormGenStatus[key] !== 'failed' && nextCharacterFormGenStatus[key] !== 'generating') {
            nextCharacterFormGenStatus[key] = 'idle'
          }
        })
      })
      characterFormGenerationStatus.value = nextCharacterFormGenStatus
      Object.entries(nextCharacterFormGenStatus).forEach(([key, status]) => {
        creationStore.setCharacterFormGenerationStatus(key, status)
      })
      const characterAssetIdsNext: Record<number, number> = {}
      const characterFormIdsNext: Record<number, number[]> = {}
      sortedRps.forEach((raw, i) => {
        if (raw.id != null && Number.isFinite(Number(raw.id))) characterAssetIdsNext[i] = Number(raw.id)
        characterFormIdsNext[i] = getFormsForRpsRow(raw)
          .map((f) => f.id)
          .filter((n): n is number => n != null && Number.isFinite(Number(n)))
          .map((n) => Number(n))
      })
      const persistedManualCharacterIndices = collectPersistedManualIndices('character', sortedRps.length)
      const manualCharIdx = buildManualIndexListFromRps(sortedRps, {
        persistedIndices: persistedManualCharacterIndices,
        prevManualAssetIds: prevManualCharacterAssetIds
      })
      manualCharacters.value = new Set(manualCharIdx)
      creationStore.manualCharacters = manualCharIdx
      characterAssetIds.value = characterAssetIdsNext
      characterFormIdsByIndex.value = characterFormIdsNext
      update({
        scenes: [...localValue.value.scenes],
        characters: characterNames,
        props: [...localValue.value.props]
      })
      applyRpsSettingsToLocalMaps('character', characterNames, sortedRps, characterSettings)
      syncStep3AfterApiLoad()
      reconcilePendingExtractForTabFromRps('character', sortedRps)
      return
    }

    const prevManualPropAssetIds = new Set(
      Array.from(manualProps.value)
        .map((i) => propAssetIds.value[i])
        .filter((id): id is number => id != null && Number.isFinite(Number(id)))
        .map((id) => Number(id))
    )
    const propNames = rows.map((r, i) => r.assetName || `道具${i + 1}`)
    const propImagesNext: Record<number, any[]> = {}
    const propFormImagesNext: Record<string, any[]> = {}
    sortedRps.forEach((raw, i) => {
      const rawForms = getFormsForRpsRow(raw)
      const date = raw.updateTime || raw.createTime || ''
      const assetImages: any[] = []
      for (let fi = 0; fi < rawForms.length; fi++) {
        const f = rawForms[fi]
        if (f.id == null || !Number.isFinite(Number(f.id))) continue
        const formId = Number(f.id)
        const inUse = inUseImagesFromRpsForm(f)
        const mapped = inUse
          .map((img) => {
            const url = String(img?.imageUrl || '').trim()
            if (!url) return null
            const imageId = Number(img?.id)
            return {
              id: Number.isFinite(imageId) ? `img-${imageId}` : `form-${formId}`,
              rpsFormId: formId,
              ...(Number.isFinite(imageId) ? { rpsImageId: imageId } : {}),
              title: String(img?.name || f.name || `形态图${fi + 1}`),
              url,
              thumbnail: url,
              source: 'server',
              importDate: date
            }
          })
          .filter(Boolean) as any[]
        if (mapped.length > 0) {
          propFormImagesNext[`${i}-${fi}`] = mapped
          assetImages.push(...mapped)
          continue
        }
        const fallbackUrl = String(f.imageUrl || '').trim()
        if (!fallbackUrl || f.isUse === 0) continue
        const fallback = {
          id: `form-${formId}`,
          rpsFormId: formId,
          title: f.name?.trim() || `形态图${fi + 1}`,
          url: fallbackUrl,
          thumbnail: fallbackUrl,
          source: 'server',
          importDate: date
        }
        propFormImagesNext[`${i}-${fi}`] = [fallback]
        assetImages.push(fallback)
      }
      if (assetImages.length) propImagesNext[i] = assetImages
    })
    /** 同角色：主表存在、forms 为空时保留默认空形态槽，与 addProp 刷新前表现一致 */
    const propFormsNext: Record<number, Array<{ name: string }>> = {}
    for (let i = 0; i < sortedRps.length; i++) {
      const rawForms = getFormsForRpsRow(sortedRps[i])
      if (rawForms.length > 0) {
        propFormsNext[i] = rawForms.map((f, idx) => ({
          name: f.name?.trim() ? f.name : `形态${idx + 1}: 未命名`
        }))
      } else {
        propFormsNext[i] = [{ name: '形态1: 未命名' }]
      }
    }
    propForms.value = propFormsNext
    propImages.value = propImagesNext
    propFormImages.value = propFormImagesNext
    const nextPropFormGenStatus: Record<string, FormGenStatus> = {
      ...creationStore.propFormGenerationStatus
    }
    Object.keys(propFormsNext).forEach((pk) => {
      const pi = Number(pk)
      const forms = propFormsNext[pi] ?? []
      forms.forEach((_, fi) => {
        const key = `${pi}-${fi}`
        const hasImage = Array.isArray(propFormImagesNext[key]) && propFormImagesNext[key]!.length > 0
        if (hasImage) {
          nextPropFormGenStatus[key] = 'success'
        } else if (nextPropFormGenStatus[key] !== 'failed' && nextPropFormGenStatus[key] !== 'generating') {
          nextPropFormGenStatus[key] = 'idle'
        }
      })
    })
    propFormGenerationStatus.value = nextPropFormGenStatus
    Object.entries(nextPropFormGenStatus).forEach(([key, status]) => {
      creationStore.setPropFormGenerationStatus(key, status)
    })
    const propAssetIdsNext: Record<number, number> = {}
    const propFormIdsNext: Record<number, number[]> = {}
    sortedRps.forEach((raw, i) => {
      if (raw.id != null && Number.isFinite(Number(raw.id))) propAssetIdsNext[i] = Number(raw.id)
      propFormIdsNext[i] = getFormsForRpsRow(raw)
        .map((f) => f.id)
        .filter((n): n is number => n != null && Number.isFinite(Number(n)))
        .map((n) => Number(n))
    })
    const persistedManualPropIndices = collectPersistedManualIndices('prop', sortedRps.length)
    const manualPropIdx = buildManualIndexListFromRps(sortedRps, {
      persistedIndices: persistedManualPropIndices,
      prevManualAssetIds: prevManualPropAssetIds
    })
    manualProps.value = new Set(manualPropIdx)
    creationStore.manualProps = manualPropIdx
    propAssetIds.value = propAssetIdsNext
    propFormIdsByIndex.value = propFormIdsNext
    update({
      scenes: [...localValue.value.scenes],
      characters: [...localValue.value.characters],
      props: propNames
    })
    applyRpsSettingsToLocalMaps('prop', propNames, sortedRps, propSettings)
    syncStep3AfterApiLoad()
    reconcilePendingExtractForTabFromRps('prop', sortedRps)
  } catch (e: unknown) {
    if (gen !== loadAssetTabGeneration) return
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载资产列表失败')
  } finally {
    if (tabGen === tabAssetLoadGen[tab]) {
      setTabAssetLoading(tab, false)
    }
  }
}

/** 须在 `projectContextDeps` 的 immediate watch 之前初始化，避免 TDZ（Cannot access before initialization） */
type FormGenStatus = 'idle' | 'generating' | 'success' | 'failed'
const sceneGenerationStatus = ref<Record<number, FormGenStatus>>({
  ...creationStore.sceneGenerationStatus
})
const characterFormGenerationStatus = ref<Record<string, FormGenStatus>>({
  ...creationStore.characterFormGenerationStatus
})
const propFormGenerationStatus = ref<Record<string, FormGenStatus>>({
  ...creationStore.propFormGenerationStatus
})
/** 当前页并行跟进的 SSE 任务（刷新后可同时恢复多条形态/生图任务） */
const activeTrackedTaskIds = ref<number[]>([])
const activeTaskStreamClosers = new Map<number, () => void>()
/** 作品/剧集切换时自增，用于丢弃旧任务 SSE 的后续回调与 finally，避免误 toast、误清 store */
let taskFollowSession = 0

function hasActiveTrackedTasks(): boolean {
  return activeTaskStreamClosers.size > 0 || activeTrackedTaskIds.value.length > 0
}

function clearActiveTaskStream(taskId?: number) {
  if (taskId != null && Number.isFinite(taskId)) {
    const close = activeTaskStreamClosers.get(taskId)
    if (close) {
      try {
        close()
      } catch {
        /* ignore */
      }
    }
    activeTaskStreamClosers.delete(taskId)
    activeTrackedTaskIds.value = activeTrackedTaskIds.value.filter((id) => id !== taskId)
    return
  }
  for (const close of activeTaskStreamClosers.values()) {
    try {
      close()
    } catch {
      /* ignore */
    }
  }
  activeTaskStreamClosers.clear()
  activeTrackedTaskIds.value = []
}

/** 项目/剧集切换时清空并拉当前 Tab；不含 isExtracting，避免提取结束误清空 */
const projectContextDeps = () => [
  creationStore.currentProjectId,
  creationStore.currentEpisodeId,
  creationStore.currentProjectType,
  route.query.projectId,
  route.query.id,
  route.query.workId,
  route.query.episodeId
]

let assetRouteWatchBootstrapped = false

/** 合并路由/Pinia 连续波动触发的多次 watch，避免刷新时 rps/list 等连打 2～3 遍 */
let projectAssetBootstrapEpoch = 0
let projectAssetBootstrapDebounceTimer: ReturnType<typeof setTimeout> | null = null

/** 上次已加载的「作品+剧集」scope；切换前把 Pinia 里仍是上一作品的扁平生成态写回分桶 */
const lastStep3VisualScopeKey = ref('')

/**
 * 当前作品/剧集下：三步 rps 拉取 +「待生成形态」reconcile + 任务恢复跑完之前为 false。
 * 避免刷新后先闪「完整卡片（自动生成/导入）」再切到「待生成形态」小卡片。
 */
const step3AssetBootstrapReady = ref(false)

/**
 * 刷新/切作品时若仍有形态图生成任务，不应被全屏 bootstrap 遮罩盖住。
 * bootstrap 完成前不信任 Pinia 持久化的 generating（可能是刷新前遗留），避免遮罩被误关导致列表闪一下。
 */
function hasOngoingStep3VisualWork(): boolean {
  if (creationStore.isExtractingAssets) return true
  if (hasActiveTrackedTasks()) return true
  if (Object.values(pendingFormGenBusy.value).some(Boolean)) return true
  if (!step3AssetBootstrapReady.value) return false
  if (creationStore.isGeneratingStep3Visual) return true
  const p = creationStore.extractingTaskProgress
  if (String(p?.stepTitle || '').trim() || String(p?.message || '').trim()) return true
  if (typeof p?.percent === 'number' && p.percent > 0) return true
  if (Object.values(sceneGenerationStatus.value).some((s) => s === 'generating')) return true
  if (Object.values(characterFormGenerationStatus.value).some((s) => s === 'generating')) return true
  if (Object.values(propFormGenerationStatus.value).some((s) => s === 'generating')) return true
  return false
}

/** 初始化/切作品/刷新同步未完成且无已验证的进行中任务时展示「正在同步…」遮罩 */
const showAssetBootstrapMask = computed(
  () => !step3AssetBootstrapReady.value && !hasOngoingStep3VisualWork()
)

/** 切换 Tab 拉取列表时的 loading；仅在该 Tab 尚无数据时展示，避免遮住已有列表 */
const showActiveTabAssetLoading = computed(() => {
  if (!step3AssetBootstrapReady.value || props.isExtracting) return false
  if (!tabAssetLoading[activeTab.value]) return false
  if (activeTab.value === 'scene') return localValue.value.scenes.length === 0
  if (activeTab.value === 'character') return localValue.value.characters.length === 0
  return localValue.value.props.length === 0
})

const activeTabAssetLoadingText = computed(() => {
  if (activeTab.value === 'scene') return '正在加载场景列表…'
  if (activeTab.value === 'character') return '正在加载角色列表…'
  return '正在加载道具列表…'
})

/** 初始化同步与 Tab 懒加载共用同一套全屏遮罩文案 */
const assetLoadingMaskText = computed(() =>
  showAssetBootstrapMask.value ? '正在同步场景、角色与道具…' : activeTabAssetLoadingText.value
)

const SCP_ACTIVE_TAB_SESSION_PREFIX = 'scp-active-tab:'

/** 切换作品/剧集时断开上一条任务的 SSE，避免旧任务回调继续改 store 或与新作品恢复逻辑打架 */
function stopOngoingTaskStreamForRouteContextChange() {
  taskFollowSession++
  clearActiveTaskStream()
  pendingFormGenBusy.value = {}
}

async function runProjectAssetBootstrap(epoch: number) {
  step3AssetBootstrapReady.value = false
  creationStore.setStep3AssetListSyncReady(false)
  try {
    const nextScopeKey = creationStore.step3GenVisualScopeKey()
    if (
      assetRouteWatchBootstrapped &&
      lastStep3VisualScopeKey.value &&
      lastStep3VisualScopeKey.value !== nextScopeKey
    ) {
      creationStore.writeStep3GenVisualScopeKey(lastStep3VisualScopeKey.value, {
        scene: { ...creationStore.sceneGenerationStatus },
        character: { ...creationStore.characterFormGenerationStatus },
        prop: { ...creationStore.propFormGenerationStatus }
      })
      creationStore.persistOptionalModelCodesForScopeKey(lastStep3VisualScopeKey.value)
    }

    const scopeChanged =
      assetRouteWatchBootstrapped &&
      lastStep3VisualScopeKey.value &&
      lastStep3VisualScopeKey.value !== nextScopeKey

    // 同作品刷新时 Pinia 仍可能带着旧列表名，先清空展示层，避免 reconcile 前闪完整卡片
    clearPersonalAssetPayload()
    if (scopeChanged) {
      stopOngoingTaskStreamForRouteContextChange()
      defaultTextModelCode.value = ''
    }
    assetRouteWatchBootstrapped = true

    creationStore.applyOptionalModelCodesFromScopeKey(nextScopeKey)
    creationStore.applyStep3GenVisualFromScopeKey(nextScopeKey)
    sceneGenerationStatus.value = { ...creationStore.sceneGenerationStatus }
    characterFormGenerationStatus.value = { ...creationStore.characterFormGenerationStatus }
    propFormGenerationStatus.value = { ...creationStore.propFormGenerationStatus }

    if (epoch !== projectAssetBootstrapEpoch) return

    const hasOngoingVisualWork = hasOngoingStep3VisualWork()

    const pid = creationStore.currentProjectId
    let savedTab: TabKey | null = null
    if (pid != null && Number.isFinite(Number(pid)) && typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(`${SCP_ACTIVE_TAB_SESSION_PREFIX}${Number(pid)}`)
        if (raw === 'scene' || raw === 'character' || raw === 'prop') savedTab = raw
      } catch {
        /* ignore */
      }
    }
    // 进入页面仅拉当前 Tab（默认场景）；切换 Tab 时由 activeTab watch 按需加载
    const tabToLoad: TabKey = hasOngoingVisualWork
      ? resolveTabKeyForStep3OngoingRestore()
      : (savedTab ?? activeTab.value)

    if (tabToLoad !== activeTab.value) {
      suppressActiveTabAssetLoadOnce = true
      activeTab.value = tabToLoad
    }

    await loadPersonalAssetsForTab(tabToLoad)
    if (epoch !== projectAssetBootstrapEpoch) return
    await restoreAndTrackOngoingTasks()

    if (epoch !== projectAssetBootstrapEpoch) return
    lastStep3VisualScopeKey.value = nextScopeKey
  } finally {
    if (epoch === projectAssetBootstrapEpoch) {
      step3AssetBootstrapReady.value = true
      creationStore.setStep3AssetListSyncReady(true)
    }
  }
}

watch(
  projectContextDeps,
  () => {
    projectAssetBootstrapEpoch++
    const epoch = projectAssetBootstrapEpoch
    if (projectAssetBootstrapDebounceTimer) clearTimeout(projectAssetBootstrapDebounceTimer)
    projectAssetBootstrapDebounceTimer = setTimeout(() => {
      projectAssetBootstrapDebounceTimer = null
      void runProjectAssetBootstrap(epoch)
    }, 48)
  },
  { immediate: true }
)

onMounted(() => {
  /** 任务列表由 watch(immediate) 内 restoreAndTrackOngoingTasks → reloadOngoingTasks({ force: true }) 拉取，避免与 onMounted 重复打 /task/list */
  window.addEventListener('create-flow-track-task', handleTrackTaskEvent as EventListener)
  window.addEventListener('create-flow-stop-task', handleStopTaskEvent as EventListener)
  window.addEventListener('create-flow-resume-task', handleResumeTaskEvent as EventListener)
})

/**
 * 连续切换 Tab 时，较早的 loadPersonalAssetsForTab 会因 loadAssetTabGeneration 不匹配被整段丢弃，
 * 形态 ref 可能短时间与列表行数不一致，先补占位与接口成功后的结构一致，避免只出现「新增形态」的空壳闪烁。
 */
function ensureCharacterFormsPlaceholderForList() {
  const n = localValue.value.characters.length
  if (n === 0) return
  const cur = characterForms.value
  let changed = false
  const next: Record<number, CharacterFormItem[]> = { ...cur }
  const blankForm = (): CharacterFormItem => ({
    name: '形态1: 未命名',
    voiceover: undefined,
    voiceoverId: undefined,
    voiceoverAvatarUrl: undefined,
    voiceoverPreviewUrl: undefined
  })
  for (let i = 0; i < n; i++) {
    if (!next[i]?.length) {
      next[i] = [blankForm()]
      changed = true
    }
  }
  if (changed) characterForms.value = next
}

function ensurePropFormsPlaceholderForList() {
  const n = localValue.value.props.length
  if (n === 0) return
  const cur = propForms.value
  let changed = false
  const next: Record<number, Array<{ name: string }>> = { ...cur }
  for (let i = 0; i < n; i++) {
    if (!next[i]?.length) {
      next[i] = [{ name: '形态1: 未命名' }]
      changed = true
    }
  }
  if (changed) propForms.value = next
}

function ensureFormsPlaceholdersForActiveTab() {
  const tab = activeTab.value
  if (tab === 'character') ensureCharacterFormsPlaceholderForList()
  else if (tab === 'prop') ensurePropFormsPlaceholderForList()
}

/** 提取结束后仅刷新当前 Tab 列表，与本地提取结果不冲突 */
watch(
  () => props.isExtracting,
  (extracting, wasExtracting) => {
    if (wasExtracting === true && extracting === false) {
      ensureFormsPlaceholdersForActiveTab()
      void loadPersonalAssetsForTab(activeTab.value)
    }
  }
)

watch(
  () => activeTab.value,
  (v) => {
    ensureFormsPlaceholdersForActiveTab()
    if (suppressActiveTabAssetLoadOnce) {
      suppressActiveTabAssetLoadOnce = false
    } else {
      void loadPersonalAssetsForTab(activeTab.value)
    }
    const pid = creationStore.currentProjectId
    if (pid != null && Number.isFinite(Number(pid)) && typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(`${SCP_ACTIVE_TAB_SESSION_PREFIX}${Number(pid)}`, v)
      } catch {
        /* ignore */
      }
    }
  }
)

const update = (next: SceneCharacterData) => {
  localValue.value = next
  emit('update:modelValue', next)
}

const hasStory = computed(() => htmlPlainTextLength(props.storyScriptContent ?? '') > 0)

const extractingStageLabel = computed(() => {
  if (props.extractingStage === 'scene') return '场景'
  if (props.extractingStage === 'character') return '角色'
  return '道具'
})

/** 提取进行中：主文案优先 SSE 的 message，其次 stepTitle，最后兜底句式 */
const extractingLiveTitle = computed(() => {
  const p = creationStore.extractingTaskProgress
  const msg = String(p?.message || '').trim()
  const step = String(p?.stepTitle || '').trim()
  const live = msg || step
  return live || `正在为您提取${extractingStageLabel.value}...`
})

const isExtracting = computed(() => props.isExtracting)
const extractingProgressText = computed(() => {
  const p = creationStore.extractingTaskProgress
  const percent = Number(p?.percent ?? 0)
  const title = (p?.stepTitle || '').trim()
  const msg = (p?.message || '').trim()
  const stepIndex = p?.stepIndex
  const stepTotal = p?.stepTotal
  const stepText = stepIndex != null && stepTotal != null ? `（${stepIndex}/${stepTotal}）` : ''

  if (!title && !msg) return ''
  const pct = Math.round(Math.min(100, Math.max(0, percent)))
  const showPct =
    isExtracting.value && Number.isFinite(percent)
      ? true
      : Number.isFinite(percent) && percent > 0
  const percentText = showPct ? `${pct}% ` : ''
  return `${percentText}${title}${stepText}${msg ? `：${msg}` : ''}`
})
const extractingStages = computed(() => props.extractingStages || {
  scene: false,
  character: false,
  prop: false
})

const tabs = [
  { key: 'scene' as const, label: '场景' },
  { key: 'character' as const, label: '角色' },
  { key: 'prop' as const, label: '道具' }
]

/** 共用空状态：标题与说明随当前 Tab 切换 */
const emptyAssetTitle = computed(() => {
  if (activeTab.value === 'scene') return `场景（${localValue.value.scenes.length}）`
  if (activeTab.value === 'character') return `角色（${localValue.value.characters.length}）`
  return `道具（${localValue.value.props.length}）`
})

const emptyAssetAddLabel = computed(() => {
  if (activeTab.value === 'scene') return '添加场景'
  if (activeTab.value === 'character') return '添加角色'
  return '添加道具'
})

/** 空状态：提示文案随 Tab（场景/角色/道具）切换 */
const emptyExtractTips = computed(() => {
  if (activeTab.value === 'scene') return '点击此按钮，为您智能提取场景'
  if (activeTab.value === 'character') return '点击此按钮，为您智能提取角色'
  return '点击此按钮，为您智能提取道具'
})

/** 顶栏「添加场景/角色/道具」：默认图标 */
const topbarAddIconNor = computed(() => {
  if (activeTab.value === 'scene') return iconAddScene
  if (activeTab.value === 'character') return iconAddCharacter
  return iconAddProp
})

/** 顶栏「添加」：悬停且可点时展示选中态图标 */
const topbarAddIconSel = computed(() => {
  if (activeTab.value === 'scene') return iconAddSceneSel
  if (activeTab.value === 'character') return iconAddCharacterSel
  return iconAddPropSel
})

/** 与原先列表头一致：无数据时不可手动添加（需先自动提取） */
const topbarAddDisabled = computed(() => {
  if (isExtracting.value) return true
  if (activeTab.value === 'scene') return localValue.value.scenes.length === 0
  if (activeTab.value === 'character') return localValue.value.characters.length === 0
  return localValue.value.props.length === 0
})

/** 当前 Tab 下「待生成形态」小卡片 */
const activeTabPendingFormCards = computed(() => {
  if (activeTab.value === 'scene') return pendingSceneFormCards.value
  if (activeTab.value === 'character') return pendingCharacterFormCards.value
  return pendingPropFormCards.value
})

const showBatchGenerateTopbarBtn = computed(() => {
  if (activeTab.value === 'scene') return localValue.value.scenes.length > 0
  if (activeTab.value === 'character') return localValue.value.characters.length > 0
  return localValue.value.props.length > 0
})

const batchFormGenerateMenuLabel = computed(() => {
  if (activeTab.value === 'scene') return '批量生成场景形态'
  if (activeTab.value === 'character') return '批量生成角色形态'
  return '批量生成道具形态'
})

const batchImageGenerateMenuLabel = computed(() => {
  if (activeTab.value === 'scene') return '批量生成场景图'
  if (activeTab.value === 'character') return '批量生成角色图'
  return '批量生成道具图'
})

/** 当前 Tab 下是否仍有待生成形态的资产（批量删除后重新提取会恢复为 true） */
const batchFormGenerateAlreadyGenerated = computed(() => activeTabPendingFormCards.value.length === 0)

const batchFormGenerateBusyDisabled = computed(() => {
  if (batchFormGenerateAlreadyGenerated.value) return false
  if (batchFormGenerateSubmitting.value) return true
  const cards = activeTabPendingFormCards.value
  return cards.length > 0 && cards.every((c) => !!pendingFormGenBusy.value[c.assetId])
})

const batchFormGenerateMenuDisabled = computed(
  () => batchFormGenerateAlreadyGenerated.value || batchFormGenerateBusyDisabled.value
)

const batchImageGenerateMenuDisabled = computed(() => {
  if (activeTab.value === 'scene') return localValue.value.scenes.length === 0
  if (activeTab.value === 'character') return localValue.value.characters.length === 0
  return localValue.value.props.length === 0
})

const batchDeleteMenuDisabled = computed(() => batchImageGenerateMenuDisabled.value)

const batchFormGenerateDisabledTooltip = computed(() => {
  if (batchFormGenerateAlreadyGenerated.value) return '当前已经生成过形态无法再次生成'
  if (batchFormGenerateBusyDisabled.value) return '资产形态正在生成中，请稍候'
  return ''
})

const batchGenerateTopbarLoading = computed(() => {
  if (batchFormGenerateSubmitting.value) return true
  return activeTabPendingFormCards.value.some((c) => !!pendingFormGenBusy.value[c.assetId])
})

/** 空状态「自动提取」主按钮文案（随 Tab 切换） */
const autoExtractEmptyButtonLabel = computed(() => {
  if (activeTab.value === 'scene') return '自动提取场景'
  if (activeTab.value === 'character') return '自动提取角色'
  return '自动提取道具'
})

// 手动增删
const addScene = async () => {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) {
    message.warning('缺少项目或剧集信息，请从「我的作品」进入创作流程后再添加')
    return
  }
  try {
    const pendingName = `场景${localValue.value.scenes.length + 1}: 未命名`
    let row = await userAssetRpsCreate({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      name: pendingName,
      assetType: 'scene'
    })
    const mainAssetId =
      row.id != null && Number.isFinite(Number(row.id)) ? Number(row.id) : 0
    // 创建主资产后，若后端未返回任何形态，则立即补建一条默认形态。
    if ((row.forms ?? []).length === 0 && mainAssetId > 0) {
      try {
        row = await userAssetRpsFormCreate({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          assetId: mainAssetId,
          imageUrl: '',
          name: '形态1: 未命名',
          sourceType: 'official'
        })
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.warning(err?.msg || err?.message || '场景形态初始化失败，可在后续导图时自动补齐')
      }
    }
    const newIndex = localValue.value.scenes.length
    const name = row.assetName || pendingName
    update({ ...localValue.value, scenes: [...localValue.value.scenes, name] })
    manualScenes.value.add(newIndex)
    creationStore.addManualScene(newIndex)
    sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [newIndex]: 'idle' }
    creationStore.setSceneGenerationStatus(newIndex, 'idle')
    sceneSettings.value[name] = {
      content: (rpsRowToUserAssetRow(row).personalityDesc || '').trim(),
      isNew: true
    }
    const imgs = buildImagesFromAssetRow(rpsRowToUserAssetRow(row))
    if (imgs.length) {
      sceneImages.value = { ...sceneImages.value, [newIndex]: imgs }
    }
    if (mainAssetId > 0) {
      sceneAssetIds.value = { ...sceneAssetIds.value, [newIndex]: mainAssetId }
      creationStore.addManualSceneAssetId(mainAssetId)
    }
    const formIds = (row.forms ?? [])
      .map((f) => f.id)
      .filter((n) => n != null && Number.isFinite(Number(n)))
    sceneFormIdsByIndex.value = { ...sceneFormIdsByIndex.value, [newIndex]: formIds }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '创建场景失败')
  }
}

const removeScene = (idx: number) => {
  const sceneName = localValue.value.scenes[idx]
  
  // 显示确认删除弹窗
  Modal.confirm({
    title: '确认删除场景及相关剧情?',
    content: '将同时删除场景图与相关剧情内容。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const aid = sceneAssetIds.value[idx]
      try {
        // 删除场景时仅传主资产 id，后端级联删除该场景全部形态与图片
        if (aid != null) {
          await userAssetRpsDelete({ id: aid })
          creationStore.removeManualSceneAssetId(Number(aid))
        }
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '删除场景失败')
        throw e
      }

      update({ ...localValue.value, scenes: localValue.value.scenes.filter((_, i) => i !== idx) })
      
      // 更新手动场景索引
      const newManualScenes = new Set<number>()
      manualScenes.value.forEach((index) => {
        if (index < idx) {
          newManualScenes.add(index)
        } else if (index > idx) {
          newManualScenes.add(index - 1)
        }
      })
      manualScenes.value = newManualScenes
      // 同步到 store：删除 idx 并调整大于 idx 的索引
      creationStore.manualScenes = Array.from(newManualScenes)
      
      // 删除场景设置
      delete sceneSettings.value[sceneName]
      
      // 删除场景图片
      if (sceneImages.value[idx]) {
        delete sceneImages.value[idx]
        // 重新索引场景图片
        const newSceneImages: Record<number, any[]> = {}
        Object.keys(sceneImages.value).forEach((key) => {
          const oldIndex = Number(key)
          if (oldIndex < idx) {
            newSceneImages[oldIndex] = sceneImages.value[oldIndex]
          } else if (oldIndex > idx) {
            newSceneImages[oldIndex - 1] = sceneImages.value[oldIndex]
          }
        })
        sceneImages.value = newSceneImages
      }

      sceneAssetIds.value = reindexAssetIdMap(sceneAssetIds.value, idx)
      sceneFormIdsByIndex.value = reindexFormIdsByIndexMap(sceneFormIdsByIndex.value, idx)
      sceneGenerationStatus.value = reindexSceneGenerationStatusMap(sceneGenerationStatus.value, idx)
      creationStore.sceneGenerationStatus = { ...sceneGenerationStatus.value }
      creationStore.syncStep3GenVisualToCurrentScope()

      message.success('场景及相关内容已删除')
    }
  })
}

/** 场景列表（全部项，使用原手动区 UI） */
const manualScenesList = computed(() => {
  return localValue.value.scenes.map((name, index) => ({ name, index }))
})

/** 角色列表（全部项，使用原手动区 UI） */
const manualCharactersList = computed(() => {
  return localValue.value.characters.map((name, index) => ({ name, index }))
})

/** 道具列表（全部项，使用原手动区 UI） */
const manualPropsList = computed(() => {
  return localValue.value.props.map((name, index) => ({ name, index }))
})

const pendingSceneFormCards = computed(() =>
  creationStore.pendingExtractFormAssets.filter((x) => x.assetType === 'scene')
)
const pendingCharacterFormCards = computed(() =>
  creationStore.pendingExtractFormAssets.filter((x) => x.assetType === 'character')
)
const pendingPropFormCards = computed(() =>
  creationStore.pendingExtractFormAssets.filter((x) => x.assetType === 'prop')
)

/** 已在「待生成形态」小卡片中的资产不再渲染下方完整行，避免重复 */
const visibleManualScenesList = computed(() => {
  const pending = new Set(pendingSceneFormCards.value.map((x) => x.assetId))
  return manualScenesList.value.filter((s) => {
    const formIds = sceneFormIdsByIndex.value[s.index] ?? []
    if (formIds.some((id) => Number.isFinite(Number(id)) && Number(id) > 0)) return true
    const aid = sceneAssetIds.value[s.index]
    return !(aid != null && Number.isFinite(Number(aid)) && pending.has(Number(aid)))
  })
})

const visibleManualCharactersList = computed(() => {
  const pending = new Set(pendingCharacterFormCards.value.map((x) => x.assetId))
  return manualCharactersList.value.filter((c) => {
    const formIds = characterFormIdsByIndex.value[c.index] ?? []
    if (formIds.some((id) => Number.isFinite(Number(id)) && Number(id) > 0)) return true
    const aid = characterAssetIds.value[c.index]
    return !(aid != null && Number.isFinite(Number(aid)) && pending.has(Number(aid)))
  })
})

const visibleManualPropsList = computed(() => {
  const pending = new Set(pendingPropFormCards.value.map((x) => x.assetId))
  return manualPropsList.value.filter((p) => {
    const formIds = propFormIdsByIndex.value[p.index] ?? []
    if (formIds.some((id) => Number.isFinite(Number(id)) && Number(id) > 0)) return true
    const aid = propAssetIds.value[p.index]
    return !(aid != null && Number.isFinite(Number(aid)) && pending.has(Number(aid)))
  })
})

const addCharacter = async () => {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) {
    message.warning('缺少项目或剧集信息，请从「我的作品」进入创作流程后再添加')
    return
  }
  try {
    const pendingName = `角色${localValue.value.characters.length + 1}: 未命名`
    let row = await userAssetRpsCreate({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      name: pendingName,
      assetType: 'character'
    })
    // 与场景/道具保持一致：若主资产返回没有形态，则补建默认形态。
    if ((row.forms ?? []).length === 0 && row.id != null && Number.isFinite(Number(row.id))) {
      try {
        row = await userAssetRpsFormCreate({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          assetId: Number(row.id),
          imageUrl: '',
          name: '形态1: 未命名',
          sourceType: 'official'
        })
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.warning(err?.msg || err?.message || '角色形态初始化失败，可稍后点击「新增形态」继续')
      }
    }
    const newIndex = localValue.value.characters.length
    const name = row.assetName || pendingName
    update({ ...localValue.value, characters: [...localValue.value.characters, name] })
    manualCharacters.value.add(newIndex)
    creationStore.addManualCharacter(newIndex)
    characterForms.value[newIndex] = [{ name: '形态1: 未命名' }]
    characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [`${newIndex}-0`]: 'idle' }
    creationStore.setCharacterFormGenerationStatus(`${newIndex}-0`, 'idle')
    characterSettings.value[name] = {
      content: (rpsRowToUserAssetRow(row).personalityDesc || '').trim(),
      isNew: true
    }
    const imgs = buildImagesFromAssetRow(rpsRowToUserAssetRow(row))
    if (imgs.length) {
      characterImages.value = { ...characterImages.value, [newIndex]: imgs }
    }
    if (row.id != null && Number.isFinite(Number(row.id))) {
      const assetId = Number(row.id)
      characterAssetIds.value = { ...characterAssetIds.value, [newIndex]: assetId }
      await syncAssetFormIdsFromServer('character', newIndex, assetId, row)
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '创建角色失败')
  }
}

const removeCharacter = (idx: number) => {
  const characterName = localValue.value.characters[idx]
  
  Modal.confirm({
    title: '确认删除角色及相关内容?',
    content: '将同时删除角色图与相关内容。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const aid = characterAssetIds.value[idx]
      const formIds = characterFormIdsByIndex.value[idx] ?? []
      try {
        if (aid != null && Number.isFinite(Number(aid))) {
          await rpsDeleteWholeAsset(aid)
        } else if (formIds.length > 0) {
          await rpsDeleteOrphanFormsOnly(formIds)
        }
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '删除角色失败')
        throw e
      }

      update({ ...localValue.value, characters: localValue.value.characters.filter((_, i) => i !== idx) })
      
      // 更新手动角色索引
      const newManualCharacters = new Set<number>()
      manualCharacters.value.forEach((index) => {
        if (index < idx) {
          newManualCharacters.add(index)
        } else if (index > idx) {
          newManualCharacters.add(index - 1)
        }
      })
      manualCharacters.value = newManualCharacters
      creationStore.manualCharacters = Array.from(newManualCharacters)
      
      // 删除角色形态
      if (characterForms.value[idx]) {
        delete characterForms.value[idx]
        // 重新索引角色形态
        const newCharacterForms: Record<number, CharacterFormItem[]> = {}
        Object.keys(characterForms.value).forEach((key) => {
          const oldIndex = Number(key)
          if (oldIndex < idx) {
            newCharacterForms[oldIndex] = characterForms.value[oldIndex]
          } else if (oldIndex > idx) {
            newCharacterForms[oldIndex - 1] = characterForms.value[oldIndex]
          }
        })
        characterForms.value = newCharacterForms
      }
      
      // 删除角色图片
      if (characterImages.value[idx]) {
        delete characterImages.value[idx]
        // 重新索引角色图片
        const newCharacterImages: Record<number, any[]> = {}
        Object.keys(characterImages.value).forEach((key) => {
          const oldIndex = Number(key)
          if (oldIndex < idx) {
            newCharacterImages[oldIndex] = characterImages.value[oldIndex]
          } else if (oldIndex > idx) {
            newCharacterImages[oldIndex - 1] = characterImages.value[oldIndex]
          }
        })
        characterImages.value = newCharacterImages
      }
      
      // 删除角色形态图片（需要重新索引）
      const newCharacterFormImages: Record<string, any[]> = {}
      Object.keys(characterFormImages.value).forEach((key) => {
        const [charIdx] = key.split('-').map(Number)
        if (charIdx < idx) {
          newCharacterFormImages[key] = characterFormImages.value[key]
        } else if (charIdx > idx) {
          const newKey = `${charIdx - 1}-${key.split('-')[1]}`
          newCharacterFormImages[newKey] = characterFormImages.value[key]
        }
        // charIdx === idx 的情况，直接删除，不添加到新对象中
      })
      characterFormImages.value = newCharacterFormImages

      characterAssetIds.value = reindexAssetIdMap(characterAssetIds.value, idx)
      characterFormIdsByIndex.value = reindexFormIdsByIndexMap(characterFormIdsByIndex.value, idx)
      characterFormGenerationStatus.value = reindexFormGenerationStatusMap(characterFormGenerationStatus.value, idx)
      creationStore.characterFormGenerationStatus = { ...characterFormGenerationStatus.value }
      creationStore.syncStep3GenVisualToCurrentScope()

      message.success('角色及相关内容已删除')
    }
  })
}

const addProp = async () => {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) {
    message.warning('缺少项目或剧集信息，请从「我的作品」进入创作流程后再添加')
    return
  }
  try {
    const pendingName = `道具${localValue.value.props.length + 1}: 未命名`
    let row = await userAssetRpsCreate({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      name: pendingName,
      assetType: 'prop'
    })
    // 与场景/角色保持一致：若主资产返回没有形态，则补建默认形态。
    if ((row.forms ?? []).length === 0 && row.id != null && Number.isFinite(Number(row.id))) {
      try {
        row = await userAssetRpsFormCreate({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          assetId: Number(row.id),
          imageUrl: '',
          name: '形态1: 未命名',
          sourceType: 'official'
        })
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.warning(err?.msg || err?.message || '道具形态初始化失败，可稍后点击「新增形态」继续')
      }
    }
    const newIndex = localValue.value.props.length
    const name = row.assetName || pendingName
    update({ ...localValue.value, props: [...localValue.value.props, name] })
    manualProps.value.add(newIndex)
    creationStore.addManualProp(newIndex)
    propForms.value[newIndex] = [{ name: '形态1: 未命名' }]
    propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [`${newIndex}-0`]: 'idle' }
    creationStore.setPropFormGenerationStatus(`${newIndex}-0`, 'idle')
    propSettings.value[name] = {
      content: (rpsRowToUserAssetRow(row).personalityDesc || '').trim(),
      isNew: true
    }
    const imgs = buildImagesFromAssetRow(rpsRowToUserAssetRow(row))
    if (imgs.length) {
      propImages.value = { ...propImages.value, [newIndex]: imgs }
    }
    if (row.id != null && Number.isFinite(Number(row.id))) {
      const assetId = Number(row.id)
      propAssetIds.value = { ...propAssetIds.value, [newIndex]: assetId }
      await syncAssetFormIdsFromServer('prop', newIndex, assetId, row)
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '创建道具失败')
  }
}

const handleEmptyAssetAddClick = () => {
  if (activeTab.value === 'scene') addScene()
  else if (activeTab.value === 'character') addCharacter()
  else addProp()
}

const removeProp = (idx: number) => {
  const propName = localValue.value.props[idx]
  
  Modal.confirm({
    title: '确认删除道具及相关内容?',
    content: '将同时删除道具图与相关内容。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const aid = propAssetIds.value[idx]
      const formIds = propFormIdsByIndex.value[idx] ?? []
      try {
        if (aid != null && Number.isFinite(Number(aid))) {
          await rpsDeleteWholeAsset(aid)
        } else if (formIds.length > 0) {
          await rpsDeleteOrphanFormsOnly(formIds)
        }
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '删除道具失败')
        throw e
      }

      update({ ...localValue.value, props: localValue.value.props.filter((_, i) => i !== idx) })
      
      // 更新手动道具索引
      const newManualProps = new Set<number>()
      manualProps.value.forEach((index) => {
        if (index < idx) {
          newManualProps.add(index)
        } else if (index > idx) {
          newManualProps.add(index - 1)
        }
      })
      manualProps.value = newManualProps
      creationStore.manualProps = Array.from(newManualProps)
      
      // 删除道具形态
      if (propForms.value[idx]) {
        delete propForms.value[idx]
        // 重新索引道具形态
        const newPropForms: Record<number, Array<{ name: string }>> = {}
        Object.keys(propForms.value).forEach((key) => {
          const oldIndex = Number(key)
          if (oldIndex < idx) {
            newPropForms[oldIndex] = propForms.value[oldIndex]
          } else if (oldIndex > idx) {
            newPropForms[oldIndex - 1] = propForms.value[oldIndex]
          }
        })
        propForms.value = newPropForms
      }
      
      // 删除道具图片
      if (propImages.value[idx]) {
        delete propImages.value[idx]
        // 重新索引道具图片
        const newPropImages: Record<number, any[]> = {}
        Object.keys(propImages.value).forEach((key) => {
          const oldIndex = Number(key)
          if (oldIndex < idx) {
            newPropImages[oldIndex] = propImages.value[oldIndex]
          } else if (oldIndex > idx) {
            newPropImages[oldIndex - 1] = propImages.value[oldIndex]
          }
        })
        propImages.value = newPropImages
      }
      
      // 删除道具形态图片（需要重新索引）
      const newPropFormImages: Record<string, any[]> = {}
      Object.keys(propFormImages.value).forEach((key) => {
        const [propIdx] = key.split('-').map(Number)
        if (propIdx < idx) {
          newPropFormImages[key] = propFormImages.value[key]
        } else if (propIdx > idx) {
          const newKey = `${propIdx - 1}-${key.split('-')[1]}`
          newPropFormImages[newKey] = propFormImages.value[key]
        }
        // propIdx === idx 的情况，直接删除，不添加到新对象中
      })
      propFormImages.value = newPropFormImages

      propAssetIds.value = reindexAssetIdMap(propAssetIds.value, idx)
      propFormIdsByIndex.value = reindexFormIdsByIndexMap(propFormIdsByIndex.value, idx)
      propFormGenerationStatus.value = reindexFormGenerationStatusMap(propFormGenerationStatus.value, idx)
      creationStore.propFormGenerationStatus = { ...propFormGenerationStatus.value }
      creationStore.syncStep3GenVisualToCurrentScope()

      message.success('道具及相关内容已删除')
    }
  })
}

/**
 * 鼠标点击后主按钮会保持 :focus，创作页全局样式会留下描边/外发光；点击后主动 blur。
 * 键盘 Tab 进入的 :focus-visible 不 blur，避免影响无障碍。
 */
const blurScpAutoExtractButton = (e: MouseEvent) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('button.ant-btn') as HTMLButtonElement | null
  if (!btn) return
  if (btn.matches(':focus-visible')) return
  requestAnimationFrame(() => btn.blur())
}

function onClickAutoExtract(scope: TabKey, e: MouseEvent) {
  handleAutoExtract(scope)
  blurScpAutoExtractButton(e)
}

// 自动提取：由创作页打开 ExtractAgentModal（单列）并执行对应提取流程
function handleAutoExtract(scope: TabKey) {
  if (!hasStory.value) {
    message.warning('请先添加剧本故事')
    return
  }
  emit('open-extract-modal', scope)
}

function handleBatchFormGenerateClick() {
  if (batchFormGenerateMenuDisabled.value) return
  batchOpsDropdownOpen.value = false
  void runBatchPendingFormGenerate()
}

function handleBatchImageGenerateClick() {
  if (batchImageGenerateMenuDisabled.value) return
  batchOpsDropdownOpen.value = false
  batchGenerateType.value = activeTab.value
  showBatchGenerateModal.value = true
}

const batchCardGenerateSubmitting = ref(false)

const batchCardGenerateMenuDisabled = computed(
  () => activeTab.value !== 'character' || batchCardGenerateSubmitting.value || collectCharacterWhiteBaseImageIds().length === 0
)

function resolveCharacterFormImageSourceType(img: unknown): string {
  if (!img || typeof img !== 'object') return ''
  const row = img as Record<string, unknown>
  return String(row.sourceType ?? row.source_type ?? '').trim()
}

function collectCharacterWhiteBaseImageIds(): number[] {
  const ids = new Set<number>()
  for (const imgs of Object.values(characterFormImages.value)) {
    if (!Array.isArray(imgs)) continue
    for (const img of imgs) {
      const sourceType = resolveCharacterFormImageSourceType(img)
      if (sourceType && sourceType !== 'ai_auto') continue
      const raw = (img as { rpsImageId?: number; id?: number })?.rpsImageId ?? (img as { id?: number })?.id
      const id = Number(raw)
      if (Number.isFinite(id) && id > 0) ids.add(id)
    }
  }
  return [...ids]
}

async function handleBatchCardGenerateClick() {
  if (batchCardGenerateMenuDisabled.value || batchCardGenerateSubmitting.value) return
  batchOpsDropdownOpen.value = false
  const imageIds = collectCharacterWhiteBaseImageIds()
  if (!imageIds.length) {
    message.warning('暂无可批量生成的白底角色主图')
    return
  }
  batchCardGenerateSubmitting.value = true
  try {
    const projectId = creationStore.currentProjectId
    const agentCode = await resolveCharacterCardImageAgentCode(projectId)
    const result = await runFormImageGenerateCardBatchTask({
      imageIds,
      projectId,
      agentCode: agentCode || undefined
    })
    if (result.ok) {
      if (result.batch) {
        const { successCount, failCount, partialFailMessages } = result.batch
        if (failCount > 0) {
          const detail = partialFailMessages?.slice(0, 3).join('；')
          message.warning(
            detail
              ? `设定卡已生成 ${successCount} 张，${failCount} 张失败：${detail}`
              : `设定卡已生成 ${successCount} 张，${failCount} 张失败`
          )
        } else {
          message.success(`角色设定卡批量生成完成，共 ${successCount} 张`)
        }
      } else {
        message.success(`已提交 ${imageIds.length} 张角色设定卡批量生成任务`)
      }
      await loadPersonalAssetsForTab('character')
    } else {
      message.error('errorMessage' in result ? result.errorMessage : '批量设定卡生成失败')
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '批量设定卡生成失败')
  } finally {
    batchCardGenerateSubmitting.value = false
  }
}

function handleBatchDeleteClick() {
  if (batchDeleteMenuDisabled.value || batchDeleteSubmitting.value) return
  batchOpsDropdownOpen.value = false
  handleBatchDeleteForActiveTab()
}

function collectActiveTabAssetIds(): number[] {
  const ids = new Set<number>()
  for (const card of activeTabPendingFormCards.value) {
    if (Number.isFinite(card.assetId) && card.assetId > 0) ids.add(card.assetId)
  }
  const map =
    activeTab.value === 'scene'
      ? sceneAssetIds.value
      : activeTab.value === 'character'
        ? characterAssetIds.value
        : propAssetIds.value
  for (const raw of Object.values(map)) {
    const id = Number(raw)
    if (Number.isFinite(id) && id > 0) ids.add(id)
  }
  return [...ids]
}

function handleBatchDeleteForActiveTab() {
  const tab = activeTab.value
  const typeLabel = tab === 'scene' ? '场景' : tab === 'character' ? '角色' : '道具'
  const count =
    tab === 'scene'
      ? localValue.value.scenes.length
      : tab === 'character'
        ? localValue.value.characters.length
        : localValue.value.props.length
  if (count === 0) return

  Modal.confirm({
    title: `确认批量删除全部${typeLabel}？`,
    content: `将删除当前 ${count} 个${typeLabel}及其相关形态、配图${tab === 'scene' ? '与剧情' : ''}内容，且不可恢复。`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      batchDeleteSubmitting.value = true
      const assetIds = collectActiveTabAssetIds()
      try {
        for (const id of assetIds) {
          await rpsDeleteWholeAsset(id)
          if (tab === 'scene') creationStore.removeManualSceneAssetId(id)
        }
        creationStore.setPendingExtractFormAssets(
          creationStore.pendingExtractFormAssets.filter((x) => x.assetType !== tab)
        )
        await loadPersonalAssetsForTab(tab)
        message.success(`已删除全部${typeLabel}`)
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || `批量删除${typeLabel}失败`)
        throw e
      } finally {
        batchDeleteSubmitting.value = false
      }
    }
  })
}

/** 异步生图/SSE 返回前若已切换作品，禁止写 Pinia 或 toast（避免串状态） */
function captureStep3RouteContext() {
  return {
    scopeKey: creationStore.step3GenVisualScopeKey(),
    projectId: creationStore.currentProjectId,
    episodeId: creationStore.currentEpisodeId
  }
}

function matchesStep3RouteContext(ctx: ReturnType<typeof captureStep3RouteContext>) {
  return (
    creationStore.step3GenVisualScopeKey() === ctx.scopeKey &&
    creationStore.currentProjectId === ctx.projectId &&
    creationStore.currentEpisodeId === ctx.episodeId
  )
}

function patchSceneGenStatus(
  index: number,
  status: FormGenStatus,
  routeCtx: ReturnType<typeof captureStep3RouteContext>
) {
  creationStore.setSceneGenerationStatus(index, status)
  if (matchesStep3RouteContext(routeCtx)) {
    sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [index]: status }
  }
}

function patchCharacterFormGenStatus(
  formKey: string,
  status: FormGenStatus,
  routeCtx: ReturnType<typeof captureStep3RouteContext>
) {
  creationStore.setCharacterFormGenerationStatus(formKey, status)
  if (matchesStep3RouteContext(routeCtx)) {
    characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [formKey]: status }
  }
}

function patchPropFormGenStatus(
  formKey: string,
  status: FormGenStatus,
  routeCtx: ReturnType<typeof captureStep3RouteContext>
) {
  creationStore.setPropFormGenerationStatus(formKey, status)
  if (matchesStep3RouteContext(routeCtx)) {
    propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [formKey]: status }
  }
}

function resolveAllLocalStep3GeneratingTo(status: FormGenStatus) {
  const routeCtx = captureStep3RouteContext()
  for (const [k, st] of Object.entries(sceneGenerationStatus.value)) {
    if (st === 'generating') patchSceneGenStatus(Number(k), status, routeCtx)
  }
  for (const [key, st] of Object.entries(characterFormGenerationStatus.value)) {
    if (st === 'generating') patchCharacterFormGenStatus(key, status, routeCtx)
  }
  for (const [key, st] of Object.entries(propFormGenerationStatus.value)) {
    if (st === 'generating') patchPropFormGenStatus(key, status, routeCtx)
  }
  creationStore.resolveAllStep3GeneratingStatuses(status)
}

function sceneSlotHasLoadedImages(sceneIndex: number): boolean {
  return (sceneImages.value[sceneIndex]?.length ?? 0) > 0
}

function characterFormSlotHasLoadedImages(formKey: string): boolean {
  return (characterFormImages.value[formKey]?.length ?? 0) > 0
}

function propFormSlotHasLoadedImages(formKey: string): boolean {
  return (propFormImages.value[formKey]?.length ?? 0) > 0
}

/** 任务已产出图片但 reconcile/离页恢复仍标 generating 时，回落为 success 以展示图片 */
function reconcileStep3GeneratingWithLoadedImages() {
  let changed = false
  for (const [k, st] of Object.entries(sceneGenerationStatus.value)) {
    const idx = Number(k)
    if (!Number.isFinite(idx) || st !== 'generating') continue
    if (!sceneSlotHasLoadedImages(idx)) continue
    sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [idx]: 'success' }
    creationStore.setSceneGenerationStatus(idx, 'success')
    changed = true
  }
  for (const [key, st] of Object.entries(characterFormGenerationStatus.value)) {
    if (st !== 'generating') continue
    if (!characterFormSlotHasLoadedImages(key)) continue
    characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [key]: 'success' }
    creationStore.setCharacterFormGenerationStatus(key, 'success')
    changed = true
  }
  for (const [key, st] of Object.entries(propFormGenerationStatus.value)) {
    if (st !== 'generating') continue
    if (!propFormSlotHasLoadedImages(key)) continue
    propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [key]: 'success' }
    creationStore.setPropFormGenerationStatus(key, 'success')
    changed = true
  }
  if (changed) creationStore.refreshStep3VisualGeneratingFlag()
}

type FormImageSuccessItem = {
  formId: number
  imageId?: number
  imageUrl?: string
}

function parseFormImageSuccessItemsFromComplete(data: unknown): FormImageSuccessItem[] {
  if (data == null) return []
  let o: Record<string, unknown>
  if (typeof data === 'string') {
    const text = data.trim()
    if (!text) return []
    try {
      o = JSON.parse(text) as Record<string, unknown>
    } catch {
      return []
    }
  } else if (typeof data === 'object' && !Array.isArray(data)) {
    o = data as Record<string, unknown>
  } else {
    return []
  }

  const pickItem = (raw: unknown): FormImageSuccessItem | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const rec = raw as Record<string, unknown>
    const formId = Number(rec.formId ?? rec.form_id)
    if (!Number.isFinite(formId) || formId <= 0) return null
    const imageIdRaw = rec.imageId ?? rec.image_id ?? rec.id
    const imageId =
      imageIdRaw != null && Number.isFinite(Number(imageIdRaw)) && Number(imageIdRaw) > 0
        ? Number(imageIdRaw)
        : undefined
    const imageUrl = String(rec.imageUrl ?? rec.image_url ?? rec.url ?? '').trim() || undefined
    return { formId, imageId, imageUrl }
  }

  const fromList = Array.isArray(o.successItems)
    ? o.successItems.map(pickItem).filter((x): x is FormImageSuccessItem => x != null)
    : []
  if (fromList.length) return fromList

  const single = pickItem(o)
  return single ? [single] : []
}

function markStep3SlotSuccessByFormId(formId: number): boolean {
  for (const [k, ids] of Object.entries(propFormIdsByIndex.value)) {
    const pi = Number(k)
    if (!Number.isFinite(pi)) continue
    const fi = (ids ?? []).findIndex((id) => Number(id) === formId)
    if (fi >= 0) {
      const slotKey = `${pi}-${fi}`
      propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [slotKey]: 'success' }
      creationStore.setPropFormGenerationStatus(slotKey, 'success')
      return true
    }
  }
  for (const [k, ids] of Object.entries(characterFormIdsByIndex.value)) {
    const ci = Number(k)
    if (!Number.isFinite(ci)) continue
    const fi = (ids ?? []).findIndex((id) => Number(id) === formId)
    if (fi >= 0) {
      const slotKey = `${ci}-${fi}`
      characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [slotKey]: 'success' }
      creationStore.setCharacterFormGenerationStatus(slotKey, 'success')
      return true
    }
  }
  for (const [k, ids] of Object.entries(sceneFormIdsByIndex.value)) {
    const si = Number(k)
    if (!Number.isFinite(si)) continue
    if (!(ids ?? []).some((id) => Number(id) === formId)) continue
    sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [si]: 'success' }
    creationStore.setSceneGenerationStatus(si, 'success')
    return true
  }
  return false
}

/** SSE complete 后立刻写入图片并清除 generating（避免刷新恢复时列表尚未回填导致卡 loading） */
function applyFormImageCompleteDataToStep3Ui(data: unknown): boolean {
  const items = parseFormImageSuccessItemsFromComplete(data)
  if (!items.length) return false

  let changed = false
  const now = new Date().toISOString()

  for (const item of items) {
    const { formId, imageId, imageUrl } = item
    if (imageUrl) {
      for (const [k, ids] of Object.entries(sceneFormIdsByIndex.value)) {
        const si = Number(k)
        if (!Number.isFinite(si)) continue
        if (!(ids ?? []).some((id) => Number(id) === formId)) continue
        const prev = sceneImages.value[si] ?? []
        // 该场景已有展示图时，刷新恢复不再追加 SSE 占位
        if (prev.some((img) => String(img?.url ?? '').trim())) {
          break
        }
        const alreadyHasFormImage = prev.some(
          (img) => Number(img?.rpsFormId) === formId && String(img?.url ?? '').trim()
        )
        const alreadyHasImage =
          alreadyHasFormImage ||
          (imageId != null && prev.some((img) => Number(img?.rpsImageId) === imageId)) ||
          prev.some((img) => String(img?.url ?? '').trim() === imageUrl)
        if (!alreadyHasImage) {
          const rawSceneName = String(localValue.value.scenes[si] ?? '').trim()
          const sceneTitle =
            rawSceneName.replace(/^场景\d+:\s*/, '').trim() || rawSceneName || '主图'
          sceneImages.value = {
            ...sceneImages.value,
            [si]: [
              ...prev,
              {
                id: imageId != null ? `img-${imageId}` : `form-${formId}`,
                rpsFormId: formId,
                ...(imageId != null ? { rpsImageId: imageId } : {}),
                title: sceneTitle,
                url: imageUrl,
                thumbnail: imageUrl,
                source: 'server',
                importDate: now
              }
            ]
          }
          changed = true
        }
        break
      }

      for (const [k, ids] of Object.entries(characterFormIdsByIndex.value)) {
        const ci = Number(k)
        if (!Number.isFinite(ci)) continue
        const fi = (ids ?? []).findIndex((id) => Number(id) === formId)
        if (fi < 0) continue
        const slotKey = `${ci}-${fi}`
        const prev = characterFormImages.value[slotKey] ?? []
        const alreadyHasFormImage = prev.some(
          (img) => Number(img?.rpsFormId) === formId && String(img?.url ?? '').trim()
        )
        const alreadyHasImage =
          alreadyHasFormImage ||
          (imageId != null && prev.some((img) => Number(img?.rpsImageId) === imageId)) ||
          prev.some((img) => String(img?.url ?? '').trim() === imageUrl)
        if (!alreadyHasImage) {
          const entry = {
            id: imageId != null ? `img-${imageId}` : `form-${formId}`,
            rpsFormId: formId,
            ...(imageId != null ? { rpsImageId: imageId } : {}),
            title: `形态图${fi + 1}`,
            url: imageUrl,
            thumbnail: imageUrl,
            source: 'server',
            importDate: now
          }
          characterFormImages.value = { ...characterFormImages.value, [slotKey]: [...prev, entry] }
          const assetImgs = [...(characterImages.value[ci] ?? []), entry]
          characterImages.value = { ...characterImages.value, [ci]: assetImgs }
          changed = true
        }
        break
      }

      for (const [k, ids] of Object.entries(propFormIdsByIndex.value)) {
        const pi = Number(k)
        if (!Number.isFinite(pi)) continue
        const fi = (ids ?? []).findIndex((id) => Number(id) === formId)
        if (fi < 0) continue
        const slotKey = `${pi}-${fi}`
        const prev = propFormImages.value[slotKey] ?? []
        const alreadyHasFormImage = prev.some(
          (img) => Number(img?.rpsFormId) === formId && String(img?.url ?? '').trim()
        )
        const alreadyHasImage =
          alreadyHasFormImage ||
          (imageId != null && prev.some((img) => Number(img?.rpsImageId) === imageId)) ||
          prev.some((img) => String(img?.url ?? '').trim() === imageUrl)
        if (!alreadyHasImage) {
          const entry = {
            id: imageId != null ? `img-${imageId}` : `form-${formId}`,
            rpsFormId: formId,
            ...(imageId != null ? { rpsImageId: imageId } : {}),
            title: `形态图${fi + 1}`,
            url: imageUrl,
            thumbnail: imageUrl,
            source: 'server',
            importDate: now
          }
          propFormImages.value = { ...propFormImages.value, [slotKey]: [...prev, entry] }
          const assetImgs = [...(propImages.value[pi] ?? []), entry]
          propImages.value = { ...propImages.value, [pi]: assetImgs }
          changed = true
        }
        break
      }
    }

    if (markStep3SlotSuccessByFormId(formId)) changed = true
  }

  if (changed) creationStore.refreshStep3VisualGeneratingFlag()
  return changed
}

function markStep3SlotsSuccessFromCompleteData(data: unknown) {
  for (const item of parseFormImageSuccessItemsFromComplete(data)) {
    markStep3SlotSuccessByFormId(item.formId)
  }
  reconcileStep3GeneratingWithLoadedImages()
}

function collectGeneratingFormIdsForStep3(): Set<number> {
  const formIds = new Set<number>()
  for (const [ks, st] of Object.entries(sceneGenerationStatus.value)) {
    if (st !== 'generating') continue
    const si = Number(ks)
    if (!Number.isFinite(si)) continue
    for (const fid of sceneFormIdsByIndex.value[si] ?? []) {
      const n = Number(fid)
      if (Number.isFinite(n) && n > 0) formIds.add(n)
    }
  }
  for (const [key, st] of Object.entries(characterFormGenerationStatus.value)) {
    if (st !== 'generating' || key.startsWith('pending-')) continue
    const parts = key.split('-')
    const ci = Number(parts[0])
    const fi = Number(parts[1])
    if (!Number.isFinite(ci) || !Number.isFinite(fi)) continue
    const fid = characterFormIdsByIndex.value[ci]?.[fi]
    const n = Number(fid)
    if (Number.isFinite(n) && n > 0) formIds.add(n)
  }
  for (const [key, st] of Object.entries(propFormGenerationStatus.value)) {
    if (st !== 'generating' || key.startsWith('pending-')) continue
    const parts = key.split('-')
    const pi = Number(parts[0])
    const fi = Number(parts[1])
    if (!Number.isFinite(pi) || !Number.isFinite(fi)) continue
    const fid = propFormIdsByIndex.value[pi]?.[fi]
    const n = Number(fid)
    if (Number.isFinite(n) && n > 0) formIds.add(n)
  }
  return formIds
}

/** 刷新后任务已终态、本地仍 generating：按 resultData 补调 /form/use 再拉列表 */
async function claimFormImagesFromMatchingTerminalTasks(generatingFormIds: Set<number>) {
  if (!generatingFormIds.size) return
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return
  const allRows = await userTaskList({ projectId: ctx.projectId }).catch(() => [] as UserTaskRow[])
  for (const row of allRows) {
    if (!row || !isFormImageAutoUseTaskType(row.taskType)) continue
    const st = String(row.status || '').toUpperCase()
    if (st !== 'SUCCEEDED' && st !== 'PARTIAL_FAILED') continue
    const tid = parseTaskId(row.id)
    if (tid == null) continue
    try {
      const detail = await userTaskDetail({ taskId: tid })
      const multi = parseFormIdsFromBatchInputSnapshot(detail)
      const singleFormId = parseFormIdFromInputSnapshotRecord(detail)
      const covered =
        multi.some((fid) => generatingFormIds.has(fid)) ||
        (singleFormId != null && generatingFormIds.has(singleFormId))
      if (!covered) continue
      await claimFormImagesFromTaskComplete(detail.taskType ?? row.taskType, detail.resultData)
    } catch {
      /* ignore */
    }
  }
}

/** 刷新后任务已在服务端完成、但 Pinia 仍标 generating 时，强制拉列表对齐 */
async function recoverStaleGeneratingAfterCompletedFormImageTasks() {
  if (routePathToCreationStep(route.path) !== 'scene-character') return
  const stillGenerating =
    Object.values(sceneGenerationStatus.value).some((s) => s === 'generating') ||
    Object.values(characterFormGenerationStatus.value).some((s) => s === 'generating') ||
    Object.values(propFormGenerationStatus.value).some((s) => s === 'generating')
  if (!stillGenerating) return

  const hasOngoingFormImage = ongoingTasks.value.some(
    (t) => t && isStep3FormRelatedTaskType(t.taskType) && isOngoingUserTaskStatus(t.status)
  )
  if (hasOngoingFormImage || hasActiveTrackedTasks()) return

  await claimFormImagesFromMatchingTerminalTasks(collectGeneratingFormIdsForStep3())
  const tabsToRefresh = new Set<TabKey>()
  if (Object.values(sceneGenerationStatus.value).some((s) => s === 'generating')) tabsToRefresh.add('scene')
  if (Object.values(characterFormGenerationStatus.value).some((s) => s === 'generating')) {
    tabsToRefresh.add('character')
  }
  if (Object.values(propFormGenerationStatus.value).some((s) => s === 'generating')) tabsToRefresh.add('prop')
  for (const tab of tabsToRefresh) {
    await loadPersonalAssetsForTab(tab)
  }
  sanitizeStep3SceneImagesState()
  reconcileStep3GeneratingWithLoadedImages()
}

function finalizeSceneGenerateSuccessOffPage(
  index: number,
  sceneName: string,
  routeCtx: ReturnType<typeof captureStep3RouteContext>
) {
  creationStore.resolveAllStep3GeneratingStatuses('success')
  patchSceneGenStatus(index, 'success', routeCtx)
  message.success(`「${sceneName}」场景图生成成功`)
}

/** 形态图任务结束：在第三步则刷新列表；否则仅更新 Pinia，避免切走后卡片一直 generating */
type FormGenerateBatchOutcome = {
  successCount: number
  failCount: number
  failedMessages: string[]
}

function parseFormGenerateBatchCompleteOutcome(data: unknown): FormGenerateBatchOutcome | null {
  if (data == null) return null
  let o: Record<string, unknown>
  if (typeof data === 'string') {
    const text = data.trim()
    if (!text) return null
    try {
      o = JSON.parse(text) as Record<string, unknown>
    } catch {
      return null
    }
  } else if (typeof data === 'object' && !Array.isArray(data)) {
    o = data as Record<string, unknown>
  } else {
    return null
  }
  const successCount = Number(o.successCount ?? o.success_count)
  const failCount = Number(o.failCount ?? o.fail_count)
  if (!Number.isFinite(successCount) && !Number.isFinite(failCount)) return null
  const failedMessages: string[] = []
  const failedItems = Array.isArray(o.failedItems) ? o.failedItems : Array.isArray(o.failed_items) ? o.failed_items : []
  for (const raw of failedItems) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const rec = raw as Record<string, unknown>
    const msg = String(rec.message ?? rec.msg ?? '').trim()
    if (msg) failedMessages.push(msg)
  }
  return {
    successCount: Number.isFinite(successCount) ? successCount : 0,
    failCount: Number.isFinite(failCount) ? failCount : 0,
    failedMessages
  }
}

async function finalizeStep3FormGenerateTaskOutcome(tab: TabKey, taskId: number) {
  const onStep3Page = routePathToCreationStep(route.path) === 'scene-character'
  let assetIds: number[] = []
  let batchOutcome: FormGenerateBatchOutcome | null = null
  try {
    const detail = await userTaskDetail({ taskId })
    assetIds = parseAssetIdsFromInputSnapshotRecord(detail)
    batchOutcome = parseFormGenerateBatchCompleteOutcome(detail.resultData)
  } catch {
    /* ignore */
  }
  if (onStep3Page) {
    await loadPersonalAssetsForTab(tab)
    clearPendingFormGenBusyForAssetIds(assetIds)
    for (const aid of assetIds) {
      clearStep3ImageGeneratingSlotsForFormTextAssetId(aid)
    }
    reconcileStep3GeneratingWithLoadedImages()
    if (batchOutcome) {
      const { successCount, failCount, failedMessages } = batchOutcome
      if (successCount > 0 && failCount > 0) {
        message.warning(
          `形态生成完成：成功 ${successCount} 个，失败 ${failCount} 个${failedMessages.length ? `（${failedMessages.slice(0, 3).join('；')}）` : ''}`
        )
      } else if (successCount > 0) {
        message.success(`已成功生成 ${successCount} 个形态，可点击「自动生成」生成配图`)
      } else if (failCount > 0) {
        message.error(failedMessages[0] || '批量形态生成失败，请重试')
      }
    } else if (assetIds.length > 1) {
      message.success('批量形态生成完成，可点击「自动生成」生成配图')
    }
  } else {
    creationStore.resolveAllStep3GeneratingStatuses('success')
  }
  creationStore.clearExtractingTaskProgress()
  notifyGlobalGenerateTaskListUpdated()
}

async function finalizeStep3FormGenerateTaskFailure(tab: TabKey, taskId: number, errorMessage: string) {
  const onStep3Page = routePathToCreationStep(route.path) === 'scene-character'
  let assetIds: number[] = []
  try {
    const detail = await userTaskDetail({ taskId })
    assetIds = parseAssetIdsFromInputSnapshotRecord(detail)
  } catch {
    /* ignore */
  }
  clearPendingFormGenBusyForAssetIds(assetIds)
  if (onStep3Page) {
    for (const aid of assetIds) {
      clearStep3ImageGeneratingSlotsForFormTextAssetId(aid)
    }
    await loadPersonalAssetsForTab(tab)
  } else {
    creationStore.resolveAllStep3GeneratingStatuses('failed')
  }
  creationStore.clearExtractingTaskProgress()
  notifyGlobalGenerateTaskListUpdated()
  message.error(errorMessage)
}

async function finalizeStep3FormImageTaskOutcome(
  tab: TabKey,
  options?: { partialFailMessages?: string[]; completeData?: unknown; taskType?: string | null }
) {
  const onStep3Page = routePathToCreationStep(route.path) === 'scene-character'
  if (options?.completeData != null && options?.taskType != null) {
    await claimFormImagesFromTaskComplete(options.taskType, options.completeData)
  }
  if (onStep3Page) {
    const completeItems =
      options?.completeData != null ? parseFormImageSuccessItemsFromComplete(options.completeData) : []
    const targetFormIds = completeItems.map((item) => item.formId)

    // 刷新恢复：仅以 rps/list 为准并多次重试，不再合并 SSE completeData（避免「主图」空占位卡）
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await delayMs(attempt === 1 ? 450 : 1200)
      await loadPersonalAssetsForTab(tab)
      sanitizeStep3SceneImagesState()
      if (targetFormIds.length === 0 || targetFormIds.every((fid) => step3SlotHasImageForFormId(fid))) {
        break
      }
    }

    if (completeItems.length > 0) {
      markStep3SlotsSuccessFromCompleteData(options.completeData)
    }
    reconcileStep3GeneratingWithLoadedImages()
  } else {
    creationStore.resolveAllStep3GeneratingStatuses('success')
  }
  creationStore.clearExtractingTaskProgress()
  notifyGlobalGenerateTaskListUpdated()
  const partial = options?.partialFailMessages?.filter(Boolean) ?? []
  if (partial.length) {
    message.warning(`部分形态图生成失败：${partial.join('；')}`)
  }
}

async function finalizeStep3FormImageTaskFailure(tab: TabKey, errorMessage: string) {
  const onStep3Page = routePathToCreationStep(route.path) === 'scene-character'
  if (onStep3Page) {
    resolveAllLocalStep3GeneratingTo('failed')
    await loadPersonalAssetsForTab(tab)
  } else {
    creationStore.resolveAllStep3GeneratingStatuses('failed')
  }
  creationStore.clearExtractingTaskProgress()
  notifyGlobalGenerateTaskListUpdated()
  message.error(errorMessage)
}

const handleAutoGenerateScene = (index: number) => {
  if (isManualScene(index)) {
    message.info('手动添加的场景请使用「图片导入」上传配图')
    return
  }
  const sceneName = localValue.value.scenes[index]
  const aid = sceneAssetIds.value[index]
  if (aid == null) {
    message.warning('缺少场景资产ID，请先完成智能提取')
    return
  }

  sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [index]: 'generating' }
  creationStore.setSceneGenerationStatus(index, 'generating')
  void (async () => {
    const routeCtx = captureStep3RouteContext()
    try {
      const latestRow = await fetchRpsRowByAssetIdWithLocalFallback({ tab: 'scene', assetId: Number(aid), sceneIndex: index })
      if (!matchesStep3RouteContext(routeCtx)) return
      const formsNeedingImage =
        (latestRow?.forms ?? [])
          .filter((f) => f?.id != null && Number.isFinite(Number(f.id)))
          .filter((f) => !(String(f.imageUrl ?? '').trim()))
          .map((f) => Number(f.id))
      const fallbackFormIds = (latestRow?.forms ?? [])
        .filter((f) => f?.id != null && Number.isFinite(Number(f.id)))
        .map((f) => Number(f.id))
      const targetFormIds = formsNeedingImage.length > 0 ? formsNeedingImage : fallbackFormIds.slice(0, 1)
      if (targetFormIds.length === 0) {
        throw new Error('未找到可生成的场景形态，请先完成形态生成')
      }
      for (let i = 0; i < targetFormIds.length; i++) {
        const formId = targetFormIds[i]!
        const displayName = targetFormIds.length === 1 ? sceneName : `${sceneName}（${i + 1}/${targetFormIds.length}）`
        const createdImageId = await runFormImageGenerate({ formId, formName: displayName, tab: 'scene' })
        if (!matchesStep3RouteContext(routeCtx)) {
          finalizeSceneGenerateSuccessOffPage(index, sceneName, routeCtx)
          return
        }
        await tryUseFormImage({ imageId: createdImageId, formId })
        if (!matchesStep3RouteContext(routeCtx)) {
          finalizeSceneGenerateSuccessOffPage(index, sceneName, routeCtx)
          return
        }
      }
      if (matchesStep3RouteContext(routeCtx)) {
        await loadPersonalAssetsForTab('scene')
        sanitizeStep3SceneImagesState()
        reconcileStep3GeneratingWithLoadedImages()
      } else {
        finalizeSceneGenerateSuccessOffPage(index, sceneName, routeCtx)
        return
      }
      patchSceneGenStatus(index, 'success', routeCtx)
      message.success(`「${sceneName}」场景图生成成功`)
    } catch (e: unknown) {
      if (!matchesStep3RouteContext(routeCtx)) {
        if (isBenignStep3TaskAbortError(e)) {
          creationStore.resolveAllStep3GeneratingStatuses('idle')
        }
        return
      }
      if (isBenignStep3TaskAbortError(e)) {
        patchSceneGenStatus(index, 'idle', routeCtx)
        message.warning('生成已中断（例如刷新页面），若任务仍在进行可稍候再试或重新点击自动生成')
      } else {
        patchSceneGenStatus(index, 'failed', routeCtx)
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || `「${sceneName}」场景图生成失败，请重试`)
      }
    } finally {
      if (matchesStep3RouteContext(routeCtx)) {
        creationStore.clearExtractingTaskProgress()
      }
    }
  })()
}

const showImportSceneImageModal = ref(false)
const currentImportSceneIndex = ref(-1)

const handleImportSceneImage = (index: number) => {
  currentImportSceneIndex.value = index
  showImportSceneImageModal.value = true
}

// 场景图片数据存储
const sceneImages = ref<Record<number, any[]>>({})

/** 待生成形态小卡片上：按资产 ID 防止重复点击 */
const pendingFormGenBusy = ref<Record<number, boolean>>({})
/** 顶栏「批量生成形态」提交中 */
const batchFormGenerateSubmitting = ref(false)
/** 顶栏「批量删除」提交中 */
const batchDeleteSubmitting = ref(false)
/** 顶栏「其他操作」下拉展开态 */
const batchOpsDropdownOpen = ref(false)

watch(activeTab, () => {
  batchOpsDropdownOpen.value = false
})

// 是否有场景正在生成
const isGeneratingScene = computed(() => {
  return Object.values(sceneGenerationStatus.value).some((status) => status === 'generating')
})

const isGeneratingCharacterForm = computed(() =>
  Object.values(characterFormGenerationStatus.value).some((s) => s === 'generating')
)

const isGeneratingPropForm = computed(() =>
  Object.values(propFormGenerationStatus.value).some((s) => s === 'generating')
)

const isAnyStep3VisualGenerating = computed(
  () =>
    isGeneratingScene.value || isGeneratingCharacterForm.value || isGeneratingPropForm.value
)

const defaultTextModelCode = ref('')

async function ensureDefaultTextModelCode(): Promise<string> {
  if (defaultTextModelCode.value) return defaultTextModelCode.value
  const list = await userModelList({ modelType: 'text' })
  const first = list[0]
  if (!first?.modelCode) {
    throw new Error('未获取到可用文本模型，请先在模型管理中配置 text 模型')
  }
  defaultTextModelCode.value = first.modelCode
  return defaultTextModelCode.value
}

const GLOBAL_TASKS_UPDATED_EVENT = 'create-flow-global-tasks-updated'

let notifyGlobalTasksDebounceTimer: ReturnType<typeof setTimeout> | null = null
/** 合并短时间内的多次通知，避免任务角标与 Popover 对 /task/list 风暴式请求 */
function notifyGlobalGenerateTaskListUpdated() {
  if (typeof window === 'undefined') return
  if (notifyGlobalTasksDebounceTimer) clearTimeout(notifyGlobalTasksDebounceTimer)
  notifyGlobalTasksDebounceTimer = setTimeout(() => {
    notifyGlobalTasksDebounceTimer = null
    window.dispatchEvent(new CustomEvent(GLOBAL_TASKS_UPDATED_EVENT))
  }, 400)
}

type UserTaskSseOutcome =
  | { type: 'complete'; data: unknown }
  | { type: 'partial_failed'; data: TaskPartialFailedData | null; errorMessage: string }
  | { type: 'error'; errorMessage: string }

function normalizeTaskStreamToUserOutcome(
  r: Awaited<ReturnType<typeof useTaskStream>['done']>
): UserTaskSseOutcome {
  if (r.type === 'error') return { type: 'error', errorMessage: r.errorMessage || '任务失败' }
  if (r.type === 'cancelled') return { type: 'error', errorMessage: r.message || '任务已取消' }
  if (r.type === 'partial_failed') {
    return {
      type: 'partial_failed',
      data: r.data,
      errorMessage: formatPartialFailedMessage(r.data, '部分生成失败，可续生')
    }
  }
  return { type: 'complete', data: r.data }
}

async function startTrackTask(payload: { taskId: number; taskType?: string | null; tab?: TabKey }) {
  if (typeof window === 'undefined') return
  if (activeTaskStreamClosers.has(payload.taskId)) return
  if (!activeTrackedTaskIds.value.includes(payload.taskId)) {
    activeTrackedTaskIds.value = [...activeTrackedTaskIds.value, payload.taskId]
  }
  const sessionAtStart = taskFollowSession
  notifyGlobalGenerateTaskListUpdated()

  const ty = normUserTaskType(payload.taskType)

  // 根据任务类型做基础 UI 状态恢复
  if (ty === 'asset_extract') {
    creationStore.setExtractingAssets(true)
    /** 刷新后恢复：必须与任务实际 extractTypes 一致，避免仅提角色却三 Tab 全 loading、标题误显示「场景」 */
    let extractTypesForUi: AssetExtractType[] = ['scene', 'character', 'prop']
    try {
      const detail = await userTaskDetail({ taskId: payload.taskId })
      const parsed = parseExtractTypesFromInputSnapshotRecord(detail)
      if (parsed?.length) extractTypesForUi = parsed
    } catch {
      /* ignore */
    }
    const first = extractTypesForUi[0] ?? 'scene'
    creationStore.setExtractingStage(first)
    creationStore.setExtractingStages({
      scene: extractTypesForUi.includes('scene'),
      character: extractTypesForUi.includes('character'),
      prop: extractTypesForUi.includes('prop')
    })
  } else if (isStep3FormRelatedTaskType(payload.taskType)) {
    creationStore.beginStep3FormImageTaskFollow()
  }

  let streamConnected = false
  try {
    const stream = useTaskStream(payload.taskId)
    activeTaskStreamClosers.set(payload.taskId, () => stream.close())
    if (isStep3FormRelatedTaskType(payload.taskType)) {
      await hydrateStep3GeneratingFromTaskId(payload.taskId)
    }
    const stopWatch = watch(
      () => stream.lastProgress.value,
      (p) => {
        if (sessionAtStart !== taskFollowSession) return
        if (!p) return
        const msgText = String(p.message || '').trim()
        const titleText = String(p.stepTitle || '').trim()
        creationStore.setExtractingTaskProgress({
          percent: typeof p.progress === 'number' ? p.progress : creationStore.extractingTaskProgress.percent,
          stepTitle: titleText || msgText || creationStore.extractingTaskProgress.stepTitle || '任务进行中',
          message: msgText || titleText,
          stepIndex: typeof p.stepIndex === 'number' ? p.stepIndex : null,
          stepTotal: typeof p.stepTotal === 'number' ? p.stepTotal : null
        })
        if (ty === 'asset_extract') {
          const stage = inferExtractAssetTabFromSse({
            stage: p.stage,
            stepTitle: p.stepTitle || '',
            message: p.message || ''
          })
          if (stage) {
            creationStore.setExtractingStage(stage)
            activeTab.value = stage
            void loadPersonalAssetsForTab(stage, { allowWhenExtracting: true })
          }
        }
      },
      { immediate: true }
    )
    let res: UserTaskSseOutcome
    try {
      if (isFormImageUserTaskType(payload.taskType)) {
        res = await raceFormImageSseOrPollTaskDone(payload.taskId, stream)
      } else {
        res = normalizeTaskStreamToUserOutcome(await stream.done)
      }
    } finally {
      streamConnected = stream.connected.value
      stopWatch()
      if (!isFormImageUserTaskType(payload.taskType)) {
        try {
          stream.close()
        } catch {
          /* ignore */
        }
      }
    }
    if (res.type === 'partial_failed') {
      if (sessionAtStart !== taskFollowSession) return
      if (ty === 'asset_extract') {
        for (const t of ['scene', 'character', 'prop'] as const) {
          await loadPersonalAssetsForTab(t, { allowWhenExtracting: true })
        }
        message.warning(res.errorMessage || '部分生成失败，可在任务中心点击续生')
        return
      }
      if (isFormImageUserTaskType(payload.taskType) || isFormImageAutoUseTaskType(payload.taskType)) {
        const tabForLoad = payload.tab ?? activeTab.value
        const outcome = resolveFormImageBatchCompleteOutcome(res.data)
        await finalizeStep3FormImageTaskOutcome(tabForLoad, {
          partialFailMessages: outcome?.ok
            ? outcome.partialFailMessages
            : [res.errorMessage || '部分形态图生成失败'],
          completeData: res.data,
          taskType: payload.taskType
        })
        return
      }
      message.warning(res.errorMessage || '部分生成失败，可在任务中心点击续生')
      return
    }

    if (res.type === 'error') {
      if (sessionAtStart !== taskFollowSession) return
      const tabForLoad = payload.tab ?? activeTab.value
      if (isStep3FormGenerateTaskType(payload.taskType)) {
        await finalizeStep3FormGenerateTaskFailure(
          tabForLoad,
          payload.taskId,
          res.errorMessage || '形态生成失败，请稍后重试'
        )
        return
      }
      if (isFormImageUserTaskType(payload.taskType)) {
        try {
          const d = await userTaskDetail({ taskId: payload.taskId })
          if (isFormImageUserTaskType(d.taskType) && String(d.status || '').toUpperCase() === 'SUCCEEDED') {
            const outcome = resolveFormImageBatchCompleteOutcome(d.resultData)
            if (outcome?.ok === false) {
              await finalizeStep3FormImageTaskFailure(tabForLoad, outcome.errorMessage)
              return
            }
            await finalizeStep3FormImageTaskOutcome(tabForLoad, {
              partialFailMessages: outcome?.ok ? outcome.partialFailMessages : undefined,
              completeData: d.resultData ?? null,
              taskType: d.taskType ?? payload.taskType
            })
            return
          }
        } catch {
          /* ignore */
        }
        await finalizeStep3FormImageTaskFailure(tabForLoad, res.errorMessage || '任务失败')
        return
      }
      message.error(res.errorMessage || '任务失败')
      return
    }

    if (sessionAtStart !== taskFollowSession) return
    const tabForLoad = payload.tab ?? activeTab.value
    if (res.type === 'complete') {
      if (isStep3FormGenerateTaskType(payload.taskType)) {
        await finalizeStep3FormGenerateTaskOutcome(tabForLoad, payload.taskId)
        return
      }
      if (isFormImageUserTaskType(payload.taskType) || ty === 'image_upscale') {
        const outcome = resolveFormImageBatchCompleteOutcome(res.data)
        if (outcome?.ok === false) {
          await finalizeStep3FormImageTaskFailure(tabForLoad, outcome.errorMessage)
          return
        }
        await finalizeStep3FormImageTaskOutcome(tabForLoad, {
          partialFailMessages: outcome?.ok ? outcome.partialFailMessages : undefined,
          completeData: res.data,
          taskType: payload.taskType
        })
        return
      }
      if (ty === 'asset_extract') {
        for (const t of ['scene', 'character', 'prop'] as const) {
          await loadPersonalAssetsForTab(t, { allowWhenExtracting: true })
        }
        return
      }
      return
    }
    if (isFormImageUserTaskType(payload.taskType)) {
      await finalizeStep3FormImageTaskOutcome(tabForLoad)
    } else if (isStep3FormGenerateTaskType(payload.taskType)) {
      await finalizeStep3FormGenerateTaskOutcome(tabForLoad, payload.taskId)
    }
  } catch (e: unknown) {
    if (sessionAtStart !== taskFollowSession) return
    if (isFormImageUserTaskType(payload.taskType)) {
      try {
        const d = await userTaskDetail({ taskId: payload.taskId })
        if (isFormImageUserTaskType(d.taskType) && String(d.status || '').toUpperCase() === 'SUCCEEDED') {
          const tabForLoad = payload.tab ?? activeTab.value
          const outcome = resolveFormImageBatchCompleteOutcome(d.resultData)
          if (outcome?.ok === false) {
            await finalizeStep3FormImageTaskFailure(tabForLoad, outcome.errorMessage)
            return
          }
          await finalizeStep3FormImageTaskOutcome(tabForLoad, {
            partialFailMessages: outcome?.ok ? outcome.partialFailMessages : undefined,
            completeData: d.resultData ?? null,
            taskType: d.taskType ?? payload.taskType
          })
          return
        }
      } catch {
        /* ignore */
      }
    }
    if (!streamConnected) {
      const msg = String((e as { message?: string })?.message || '')
      if (msg && !isBenignStep3TaskAbortError(e)) message.error(msg)
      return
    }
    const msg = String((e as { message?: string })?.message || '任务连接异常')
    if (!isBenignStep3TaskAbortError(e)) message.error(msg)
  } finally {
    if (sessionAtStart !== taskFollowSession) {
      clearActiveTaskStream(payload.taskId)
      if (isStep3FormRelatedTaskType(payload.taskType)) {
        creationStore.endStep3FormImageTaskFollow()
      }
      notifyGlobalGenerateTaskListUpdated()
      return
    }
    creationStore.setExtractingAssets(false)
    creationStore.setExtractingStages({ scene: false, character: false, prop: false })
    if (isStep3FormRelatedTaskType(payload.taskType)) {
      creationStore.endStep3FormImageTaskFollow()
    }
    creationStore.clearExtractingTaskProgress()
    clearActiveTaskStream(payload.taskId)
    notifyGlobalGenerateTaskListUpdated()
  }
}

let restoreTasksGeneration = 0
const ongoingTasks = ref<UserTaskRow[]>([])
const ongoingTasksLoading = ref(false)

/** 刷新/关页导致 fetch/SSE 中断，不应记为「生成失败」 */
function isBenignStep3TaskAbortError(e: unknown): boolean {
  const err = e as { name?: string; message?: string }
  if (err?.name === 'AbortError') return true
  const msg = String((e as Error)?.message ?? e ?? '').toLowerCase()
  if (!msg) return false
  return (
    msg.includes('abort') ||
    msg.includes('cancel') ||
    msg.includes('user aborted') ||
    msg.includes('signal is aborted') ||
    msg.includes('networkerror') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('network error') ||
    msg.includes('err_network') ||
    msg.includes('connection') ||
    msg.includes('断开') ||
    msg.includes('body stream') ||
    (msg.includes('fetch') && msg.includes('failed'))
  )
}

/** 列表接口不返回 inputSnapshot，需与详情接口共用同一解析逻辑 */
function parseFormIdFromInputSnapshotRecord(rec: { inputSnapshot?: string | null }): number | null {
  const raw = rec.inputSnapshot
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim()
  const pickFiniteFormId = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    let v = pickFiniteFormId(o.formId ?? o.form_id ?? o['formID'] ?? o['form_Id'])
    if (v != null) return v
    const idsRaw = o.formIds ?? o.form_ids ?? o['formIDList']
    if (Array.isArray(idsRaw) && idsRaw.length === 1) {
      v = pickFiniteFormId(idsRaw[0])
      if (v != null) return v
    }
    const single = o.form ?? o['Form']
    if (single && typeof single === 'object' && !Array.isArray(single)) {
      const sf = single as Record<string, unknown>
      v = pickFiniteFormId(sf.formId ?? sf.form_id ?? sf.id)
      if (v != null) return v
    }
    const body = o.body
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>
      v = pickFiniteFormId(b.formId ?? b.form_id ?? b['formID'])
      if (v != null) return v
      const bids = b.formIds ?? b.form_ids
      if (Array.isArray(bids) && bids.length === 1) {
        v = pickFiniteFormId(bids[0])
        if (v != null) return v
      }
    }
  } catch {
    /* ignore */
  }
  const m = s.match(/"formId"\s*:\s*(\d+)/)
  if (m) return Number(m[1])
  const m2 = s.match(/"form_id"\s*:\s*(\d+)/)
  if (m2) return Number(m2[1])
  return null
}

/** 父任务 form_image_batch：inputSnapshot 内 formIds 列表 */
function parseFormIdsFromBatchInputSnapshot(rec: { inputSnapshot?: string | null }): number[] {
  const raw = rec.inputSnapshot
  if (raw == null || String(raw).trim() === '') return []
  try {
    const o = JSON.parse(String(raw).trim()) as Record<string, unknown>
    const pick = (v: unknown): number[] => {
      if (!Array.isArray(v)) return []
      return v
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0)
    }
    const a = pick(o.formIds ?? o.form_ids)
    if (a.length) return a
    const body = o.body
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>
      return pick(b.formIds ?? b.form_ids)
    }
  } catch {
    /* ignore */
  }
  return []
}

/** form_generate_batch：inputSnapshot 内 assetIds 列表（待生成形态小卡片） */
function parseAssetIdsFromInputSnapshotRecord(rec: { inputSnapshot?: string | null }): number[] {
  const raw = rec.inputSnapshot
  if (raw == null || String(raw).trim() === '') return []
  try {
    const o = JSON.parse(String(raw).trim()) as Record<string, unknown>
    const pick = (v: unknown): number[] => {
      if (!Array.isArray(v)) return []
      return v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    }
    const a = pick(o.assetIds ?? o.asset_ids)
    if (a.length) return a
    const body = o.body
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>
      return pick(b.assetIds ?? b.asset_ids)
    }
    const single = pickFinitePositiveNumber(o.assetId ?? o.asset_id)
    return single != null ? [single] : []
  } catch {
    /* ignore */
  }
  return []
}

function pickFinitePositiveNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 形态文案生成（form_generate / form_generate_batch）：仅标记待生成形态小卡片 busy，不占用图片 generating 槽位 */
function applyAssetIdToPendingFormTextGeneratingBusy(assetId: number): boolean {
  const aid = Number(assetId)
  if (!Number.isFinite(aid) || aid <= 0) return false
  pendingFormGenBusy.value = { ...pendingFormGenBusy.value, [aid]: true }
  clearStep3ImageGeneratingSlotsForFormTextAssetId(aid)
  return true
}

/** 形态文案生成进行中时，主列表不应展示「正在生成场景/角色/道具图」loading */
function clearStep3ImageGeneratingSlotsForFormTextAssetId(assetId: number) {
  const aid = Number(assetId)
  if (!Number.isFinite(aid) || aid <= 0) return
  let changed = false
  const pendingKey = `pending-${aid}`

  const si = findSceneIndexByAssetId(aid)
  if (si >= 0 && sceneGenerationStatus.value[si] === 'generating') {
    sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [si]: 'idle' }
    creationStore.setSceneGenerationStatus(si, 'idle')
    changed = true
  }

  if (characterFormGenerationStatus.value[pendingKey] === 'generating') {
    characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [pendingKey]: 'idle' }
    creationStore.setCharacterFormGenerationStatus(pendingKey, 'idle')
    changed = true
  }
  if (propFormGenerationStatus.value[pendingKey] === 'generating') {
    propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [pendingKey]: 'idle' }
    creationStore.setPropFormGenerationStatus(pendingKey, 'idle')
    changed = true
  }

  const ci = findCharacterIndexByAssetId(aid)
  if (ci >= 0) {
    const formCount = characterForms.value[ci]?.length ?? 1
    for (let fi = 0; fi < formCount; fi++) {
      const key = `${ci}-${fi}`
      if (characterFormGenerationStatus.value[key] === 'generating') {
        characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [key]: 'idle' }
        creationStore.setCharacterFormGenerationStatus(key, 'idle')
        changed = true
      }
    }
  }

  const pi = findPropIndexByAssetId(aid)
  if (pi >= 0) {
    const formCount = propForms.value[pi]?.length ?? 1
    for (let fi = 0; fi < formCount; fi++) {
      const key = `${pi}-${fi}`
      if (propFormGenerationStatus.value[key] === 'generating') {
        propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [key]: 'idle' }
        creationStore.setPropFormGenerationStatus(key, 'idle')
        changed = true
      }
    }
  }

  if (changed) creationStore.refreshStep3VisualGeneratingFlag()
}

function clearPendingFormGenBusyForAssetIds(assetIds: number[]) {
  if (!assetIds.length) return
  const next = { ...pendingFormGenBusy.value }
  let changed = false
  for (const aid of assetIds) {
    if (next[aid]) {
      delete next[aid]
      changed = true
    }
  }
  if (changed) pendingFormGenBusy.value = next
}

function extractFormGenerateImageSubmitTaskId(submit: UserAssetExtractFormGenerateImageData): number | null {
  const tid = parseTaskId(submit.taskId)
  if (tid != null) return tid
  const oneTask = submit.tasks?.length === 1 ? submit.tasks[0] : undefined
  const t2 = parseTaskId(oneTask?.taskId)
  if (t2 != null) return t2
  if (submit.taskIds?.length === 1) return parseTaskId(submit.taskIds[0])
  return null
}

function extractFormGenerateTextSubmitTaskId(submit: UserAssetExtractFormGenerateData): number | null {
  const tid = parseTaskId(submit.taskId)
  if (tid != null) return tid
  const oneTask = submit.tasks?.length === 1 ? submit.tasks[0] : undefined
  const t2 = parseTaskId(oneTask?.taskId)
  if (t2 != null) return t2
  if (submit.taskIds?.length === 1) return parseTaskId(submit.taskIds[0])
  return null
}

const EXTRACT_TYPE_SET = new Set<string>(['scene', 'character', 'prop'])

function normalizeExtractTypeToken(tok: string): AssetExtractType | null {
  let k = String(tok ?? '')
    .trim()
    .toLowerCase()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim().toLowerCase()
  }
  if (!EXTRACT_TYPE_SET.has(k)) return null
  return k as AssetExtractType
}

/** 后端常见非 JSON 快照：`character,scene` 或 `character|scene`（接口文档摘要示例） */
function parseExtractTypesFromCsvLike(s: string): AssetExtractType[] | null {
  const parts = s.split(/[,，|;\s]+/).map((x) => x.trim()).filter(Boolean)
  if (!parts.length) return null
  const out: AssetExtractType[] = []
  for (const p of parts) {
    const t = normalizeExtractTypeToken(p)
    if (t && !out.includes(t)) out.push(t)
  }
  return out.length ? out : null
}

function collectExtractTypesFromUnknownList(list: unknown[]): AssetExtractType[] | null {
  const out: AssetExtractType[] = []
  for (const x of list) {
    const t = normalizeExtractTypeToken(String(x ?? ''))
    if (t && !out.includes(t)) out.push(t)
  }
  return out.length ? out : null
}

/**
 * 从提取任务 inputSnapshot 解析 extractTypes（与 /extract/parallel 入参一致）。
 * 兼容：① JSON 对象含 extractTypes 数组或逗号分隔字符串；② 顶层 JSON 数组；③ 非 JSON 的逗号分隔纯字符串（文档示例 `inputSnapshot":"character,scene,prop"`）。
 * 解析不到时返回 null，由调用方回退为「全类型」。
 */
function parseExtractTypesFromInputSnapshotRecord(
  rec: { inputSnapshot?: string | null }
): AssetExtractType[] | null {
  const raw = rec.inputSnapshot
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim()

  try {
    const parsed = JSON.parse(s) as unknown
    if (Array.isArray(parsed)) {
      return collectExtractTypesFromUnknownList(parsed)
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>

      const pickList = (v: unknown): unknown[] | null => {
        if (!Array.isArray(v) || v.length === 0) return null
        return v
      }

      const fromStringField = (v: unknown): AssetExtractType[] | null => {
        if (typeof v !== 'string' || !v.trim()) return null
        return parseExtractTypesFromCsvLike(v.trim())
      }

      const strTypes =
        fromStringField(o.extractTypes) ||
        fromStringField(o.extract_types) ||
        (o.body && typeof o.body === 'object' && !Array.isArray(o.body)
          ? fromStringField((o.body as Record<string, unknown>).extractTypes) ||
            fromStringField((o.body as Record<string, unknown>).extract_types)
          : null)
      if (strTypes?.length) return strTypes

      const list =
        pickList(o.extractTypes) ||
        pickList(o.extract_types) ||
        (o.body && typeof o.body === 'object' && !Array.isArray(o.body)
          ? pickList((o.body as Record<string, unknown>).extractTypes) ||
            pickList((o.body as Record<string, unknown>).extract_types)
          : null)
      if (list) {
        const arr = collectExtractTypesFromUnknownList(list)
        if (arr?.length) return arr
      }

      const nested = o.inputSnapshot ?? o.input_snapshot
      if (typeof nested === 'string' && nested.trim() && nested.trim() !== s) {
        return parseExtractTypesFromInputSnapshotRecord({ inputSnapshot: nested })
      }
    }
  } catch {
    /* 非 JSON：走 CSV */
  }

  return parseExtractTypesFromCsvLike(s)
}

function normUserTaskType(ty: unknown): string {
  return String(ty ?? '').trim().toLowerCase().replace(/-/g, '_')
}

function isStep3FormGenerateTaskType(ty: unknown): boolean {
  const n = normUserTaskType(ty)
  return n === 'form_generate' || n === 'form_generate_batch'
}

function isFormImageUserTaskType(ty: unknown): boolean {
  const n = normUserTaskType(ty)
  return n === 'form_image' || n === 'form_image_batch'
}

function isStep3FormRelatedTaskType(ty: unknown): boolean {
  return (
    isStep3FormGenerateTaskType(ty) ||
    isFormImageUserTaskType(ty) ||
    normUserTaskType(ty) === 'image_upscale'
  )
}

function isImageUpscaleUserTaskType(ty: unknown): boolean {
  return normUserTaskType(ty) === 'image_upscale'
}

function isOngoingUserTaskStatus(status: unknown): boolean {
  const u = String(status ?? '').trim().toUpperCase()
  return u === 'PENDING' || u === 'PROCESSING' || u === 'RUNNING' || u === 'QUEUED' || u === 'WAITING'
}

/** 将形态 formId 映射到场景/角色/道具卡片的 generating（与 reconcile 共用） */
function applyFormIdToStep3GeneratingSlots(formId: number): boolean {
  for (const [k, ids] of Object.entries(propFormIdsByIndex.value)) {
    const pi = Number(k)
    if (!Number.isFinite(pi)) continue
    const fi = (ids ?? []).findIndex((id) => Number(id) === formId)
    if (fi >= 0) {
      const slotKey = `${pi}-${fi}`
      if (propFormSlotHasLoadedImages(slotKey)) return true
      propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [slotKey]: 'generating' }
      creationStore.setPropFormGenerationStatus(slotKey, 'generating')
      return true
    }
  }
  for (const [k, ids] of Object.entries(characterFormIdsByIndex.value)) {
    const ci = Number(k)
    if (!Number.isFinite(ci)) continue
    const fi = (ids ?? []).findIndex((id) => Number(id) === formId)
    if (fi >= 0) {
      const slotKey = `${ci}-${fi}`
      if (characterFormSlotHasLoadedImages(slotKey)) return true
      characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [slotKey]: 'generating' }
      creationStore.setCharacterFormGenerationStatus(slotKey, 'generating')
      return true
    }
  }
  for (const [k, ids] of Object.entries(sceneFormIdsByIndex.value)) {
    const si = Number(k)
    if (!Number.isFinite(si)) continue
    const fi = (ids ?? []).findIndex((id) => Number(id) === formId)
    if (fi >= 0) {
      if (sceneSlotHasLoadedImages(si)) return true
      sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [si]: 'generating' }
      creationStore.setSceneGenerationStatus(si, 'generating')
      return true
    }
  }
  return false
}

function sleepMsAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const id = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(id)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** 形态图：以 SSE 终态为准；未解析到结果时最多补查一次 task/detail */
function raceFormImageSseOrPollTaskDone(
  taskId: number,
  stream: ReturnType<typeof useTaskStream>
): Promise<UserTaskSseOutcome> {
  const finishFromDetail = async (): Promise<UserTaskSseOutcome | null> => {
    try {
      const d = await userTaskDetail({ taskId })
      if (!isFormImageUserTaskType(d.taskType)) return null
      const st = String(d.status || '').toUpperCase()
      if (st === 'SUCCEEDED') {
        const outcome = resolveFormImageBatchCompleteOutcome(d.resultData)
        if (outcome?.ok === false) {
          return { type: 'error', errorMessage: outcome.errorMessage }
        }
        return { type: 'complete', data: d.resultData ?? null }
      }
      if (st === 'FAILED') {
        return { type: 'error', errorMessage: String(d.errorMessage || '形态图生成失败') }
      }
    } catch {
      /* ignore */
    }
    return null
  }

  const mapStreamResult = async (r: Awaited<ReturnType<typeof taskStreamDoneForRace>>): Promise<UserTaskSseOutcome> => {
    if (r.type === 'complete') {
      const outcome = resolveFormImageBatchCompleteOutcome(r.data)
      if (outcome?.ok === false) {
        return { type: 'error', errorMessage: outcome.errorMessage }
      }
      return { type: 'complete', data: r.data }
    }
    if (r.type === 'error') {
      const fromDetail = await finishFromDetail()
      if (fromDetail) return fromDetail
      return { type: 'error', errorMessage: r.errorMessage || '形态图生成失败' }
    }
    if (r.type === 'cancelled') {
      return { type: 'error', errorMessage: r.message || '任务已取消' }
    }
    if (r.type === 'partial_failed') {
      return {
        type: 'partial_failed',
        data: r.data,
        errorMessage: formatPartialFailedMessage(r.data, '部分形态图生成失败')
      }
    }
    const fromDetail = await finishFromDetail()
    if (fromDetail) return fromDetail
    return { type: 'complete', data: null }
  }

  return taskStreamDoneForRace(stream)
    .then(async (r) => {
      try {
        stream.close()
      } catch {
        /* ignore */
      }
      return mapStreamResult(r)
    })
    .catch(async (e: unknown) => {
      try {
        stream.close()
      } catch {
        /* ignore */
      }
      const fromDetail = await finishFromDetail()
      if (fromDetail) return fromDetail
      return { type: 'error', errorMessage: String((e as Error)?.message || '任务连接异常') }
    })
}

/** 追踪形态图 / 形态文案 SSE 前：形态图恢复主列表 generating；形态文案仅恢复 pendingFormGenBusy */
async function hydrateStep3GeneratingFromTaskId(taskId: number): Promise<boolean> {
  if (routePathToCreationStep(route.path) !== 'scene-character') return false
  try {
    const detail = await userTaskDetail({ taskId })
    if (!isOngoingUserTaskStatus(detail.status)) return false
    if (isFormImageUserTaskType(detail.taskType)) {
      const multi = parseFormIdsFromBatchInputSnapshot(detail)
      if (multi.length > 0) {
        let any = false
        for (const fid of multi) {
          if (applyFormIdToStep3GeneratingSlots(fid)) any = true
        }
        return any
      }
      const formId = parseFormIdFromInputSnapshotRecord(detail)
      if (formId == null) return false
      return applyFormIdToStep3GeneratingSlots(formId)
    }
    if (isStep3FormGenerateTaskType(detail.taskType)) {
      const assetIds = parseAssetIdsFromInputSnapshotRecord(detail)
      if (!assetIds.length) return false
      let any = false
      for (const aid of assetIds) {
        if (applyAssetIdToPendingFormTextGeneratingBusy(aid)) any = true
      }
      return any
    }
    return false
  } catch {
    return false
  }
}

/** @deprecated 兼容旧调用 */
async function hydrateFormImageGeneratingFromTaskId(taskId: number): Promise<boolean> {
  return hydrateStep3GeneratingFromTaskId(taskId)
}

/**
 * 刷新后：根据仍在排队/处理中的形态图/形态文案任务恢复 UI。
 * - 形态图（form_image*）：恢复主列表图片 generating
 * - 形态文案（form_generate*）：仅恢复待生成形态小卡片 pendingFormGenBusy
 * 返回值：任务覆盖到的 formId / assetId 集合，用于清除 Pinia 持久化遗留的「假 generating」。
 */
async function reconcileOngoingStep3TasksToUi(): Promise<{ coverFormIds: Set<number>; coverAssetIds: Set<number> }> {
  const coverFormIds = new Set<number>()
  const coverAssetIds = new Set<number>()
  if (routePathToCreationStep(route.path) !== 'scene-character') {
    return { coverFormIds, coverAssetIds }
  }
  const tasks = ongoingTasks.value.filter(
    (t) => t && isStep3FormRelatedTaskType(t.taskType) && isOngoingUserTaskStatus(t.status)
  )
  if (!tasks.length) return { coverFormIds, coverAssetIds }

  for (const t of tasks) {
    let snapshotRec: { inputSnapshot?: string | null; taskType?: string | null } = t
    const tid = parseTaskId(t.id)
    if (tid != null) {
      try {
        snapshotRec = await userTaskDetail({ taskId: tid })
      } catch {
        /* keep list行 */
      }
    }
    if (isStep3FormGenerateTaskType(snapshotRec.taskType ?? t.taskType)) {
      const assetIds = parseAssetIdsFromInputSnapshotRecord(snapshotRec)
      for (const aid of assetIds) {
        coverAssetIds.add(aid)
        applyAssetIdToPendingFormTextGeneratingBusy(aid)
      }
      continue
    }
    if (!isFormImageUserTaskType(snapshotRec.taskType ?? t.taskType)) continue
    const multi = parseFormIdsFromBatchInputSnapshot(snapshotRec)
    if (multi.length > 0) {
      for (const fid of multi) {
        coverFormIds.add(fid)
        applyFormIdToStep3GeneratingSlots(fid)
      }
      continue
    }
    const formId = parseFormIdFromInputSnapshotRecord(snapshotRec)
    if (formId == null) continue
    coverFormIds.add(formId)
    applyFormIdToStep3GeneratingSlots(formId)
  }
  return { coverFormIds, coverAssetIds }
}

/** @deprecated 兼容旧调用 */
async function reconcileOngoingFormImageTasksToStep3Ui(): Promise<Set<number>> {
  const { coverFormIds } = await reconcileOngoingStep3TasksToUi()
  return coverFormIds
}

/**
 * Pinia 持久化了各卡片的 generating；刷新后若任务列表已无对应形态图任务，会与真实状态脱节（无 SSE、任务角标不显示）。
 * 在 reconcile 之后调用：凡本地仍标为 generating、且当前进行中的形态图任务不覆盖其 formId 的 slot，一律回落为 idle。
 */
function clearStalePersistedGeneratingWithoutOngoingStep3Cover(cover: {
  coverFormIds: Set<number>
  coverAssetIds: Set<number>
}) {
  const coverFormIds = cover.coverFormIds
  const coverAssetIds = cover.coverAssetIds
  if (routePathToCreationStep(route.path) !== 'scene-character') return
  const noCover = coverFormIds.size === 0 && coverAssetIds.size === 0
  let changed = false

  for (const [ks, st] of Object.entries(sceneGenerationStatus.value)) {
    const idx = Number(ks)
    if (!Number.isFinite(idx) || st !== 'generating') continue
    if (sceneSlotHasLoadedImages(idx)) {
      sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [idx]: 'success' }
      creationStore.setSceneGenerationStatus(idx, 'success')
      changed = true
      continue
    }
    const fids = sceneFormIdsByIndex.value[idx] ?? []
    const aid = sceneAssetIds.value[idx]
    const coveredByFormTextAsset =
      aid != null && Number.isFinite(Number(aid)) && coverAssetIds.has(Number(aid))
    if (coveredByFormTextAsset) {
      sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [idx]: 'idle' }
      creationStore.setSceneGenerationStatus(idx, 'idle')
      changed = true
      continue
    }
    if (!fids.length && !noCover) continue
    const covered = fids.length ? fids.some((id) => coverFormIds.has(id)) : false
    if (!covered) {
      sceneGenerationStatus.value = { ...sceneGenerationStatus.value, [idx]: 'idle' }
      creationStore.setSceneGenerationStatus(idx, 'idle')
      changed = true
    }
  }

  for (const [key, st] of Object.entries(characterFormGenerationStatus.value)) {
    if (st !== 'generating') continue
    if (key.startsWith('pending-')) {
      const aid = Number(key.slice('pending-'.length))
      if (Number.isFinite(aid) && coverAssetIds.has(aid)) {
        characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [key]: 'idle' }
        creationStore.setCharacterFormGenerationStatus(key, 'idle')
        changed = true
        continue
      }
      if (!noCover) continue
    }
    if (characterFormSlotHasLoadedImages(key)) {
      characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [key]: 'success' }
      creationStore.setCharacterFormGenerationStatus(key, 'success')
      changed = true
      continue
    }
    const parts = key.split('-')
    const ci = Number(parts[0])
    const fi = Number(parts[1])
    if (!Number.isFinite(ci) || !Number.isFinite(fi)) continue
    const charAssetId = characterAssetIds.value[ci]
    if (
      charAssetId != null &&
      Number.isFinite(Number(charAssetId)) &&
      coverAssetIds.has(Number(charAssetId))
    ) {
      characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [key]: 'idle' }
      creationStore.setCharacterFormGenerationStatus(key, 'idle')
      changed = true
      continue
    }
    const fid = characterFormIdsByIndex.value[ci]?.[fi]
    if (fid == null || !Number.isFinite(fid)) {
      if (!noCover) continue
    } else if (coverFormIds.has(fid)) {
      continue
    }
    characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [key]: 'idle' }
    creationStore.setCharacterFormGenerationStatus(key, 'idle')
    changed = true
  }

  for (const [key, st] of Object.entries(propFormGenerationStatus.value)) {
    if (st !== 'generating') continue
    if (key.startsWith('pending-')) {
      const aid = Number(key.slice('pending-'.length))
      if (Number.isFinite(aid) && coverAssetIds.has(aid)) {
        propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [key]: 'idle' }
        creationStore.setPropFormGenerationStatus(key, 'idle')
        changed = true
        continue
      }
      if (!noCover) continue
    }
    if (propFormSlotHasLoadedImages(key)) {
      propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [key]: 'success' }
      creationStore.setPropFormGenerationStatus(key, 'success')
      changed = true
      continue
    }
    const parts = key.split('-')
    const pi = Number(parts[0])
    const fi = Number(parts[1])
    if (!Number.isFinite(pi) || !Number.isFinite(fi)) continue
    const propAssetId = propAssetIds.value[pi]
    if (
      propAssetId != null &&
      Number.isFinite(Number(propAssetId)) &&
      coverAssetIds.has(Number(propAssetId))
    ) {
      propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [key]: 'idle' }
      creationStore.setPropFormGenerationStatus(key, 'idle')
      changed = true
      continue
    }
    const fid = propFormIdsByIndex.value[pi]?.[fi]
    if (fid == null || !Number.isFinite(fid)) {
      if (!noCover) continue
    } else if (coverFormIds.has(fid)) {
      continue
    }
    propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [key]: 'idle' }
    creationStore.setPropFormGenerationStatus(key, 'idle')
    changed = true
  }

  if (
    changed &&
    !Object.values(sceneGenerationStatus.value).some((s) => s === 'generating') &&
    !Object.values(characterFormGenerationStatus.value).some((s) => s === 'generating') &&
    !Object.values(propFormGenerationStatus.value).some((s) => s === 'generating') &&
    !Object.values(pendingFormGenBusy.value).some(Boolean)
  ) {
    creationStore.refreshStep3VisualGeneratingFlag()
  }
  if (changed) notifyGlobalGenerateTaskListUpdated()
}

/** @deprecated 兼容旧调用 */
function clearStalePersistedGeneratingWithoutOngoingFormImageCover(coverFormIds: Set<number>) {
  clearStalePersistedGeneratingWithoutOngoingStep3Cover({ coverFormIds, coverAssetIds: new Set() })
}

/**
 * 无进行中的第三步生成/提取且本地无 generating 卡片时，跳过后端 /task/list（省流量）。
 * 注意：仅进行中的「智能提取」asset_extract 在刷新后不会把 isExtractingAssets 写回内存，
 * 故「恢复跟进」路径必须传 force，否则会误判空闲而不拉列表，导致无法重连 SSE。
 */
function shouldFetchOngoingUserTaskList(): boolean {
  if (creationStore.isExtractingAssets) return true
  if (creationStore.isGeneratingStep3Visual) return true
  if (hasActiveTrackedTasks()) return true
  if (Object.values(pendingFormGenBusy.value).some(Boolean)) return true
  if (Object.values(sceneGenerationStatus.value).some((s) => s === 'generating')) return true
  if (Object.values(characterFormGenerationStatus.value).some((s) => s === 'generating')) return true
  if (Object.values(propFormGenerationStatus.value).some((s) => s === 'generating')) return true
  return false
}

/** 并发合并：短时间多次 reload 只保留一次 in-flight，避免 /task/list 成倍触发 */
let reloadOngoingTasksPromise: Promise<void> | null = null

async function reloadOngoingTasks(options?: { force?: boolean }) {
  if (!options?.force && !shouldFetchOngoingUserTaskList()) {
    ongoingTasks.value = []
    ongoingTasksLoading.value = false
    return
  }
  if (reloadOngoingTasksPromise) return reloadOngoingTasksPromise
  reloadOngoingTasksPromise = (async () => {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      ongoingTasks.value = []
      return
    }
    ongoingTasksLoading.value = true
    try {
      /** 文档：不传或仅 projectId 可查当前项目全部通用任务；前端再筛类型与进行中状态，避免连打 5 次 list */
      const allRows = await userTaskList({ projectId: ctx.projectId }).catch(() => [] as UserTaskRow[])
      const seen = new Set<number>()
      const merged: UserTaskRow[] = []
      const pushRow = (row: UserTaskRow | null | undefined) => {
        if (!row) return
        const id = Number(row.id)
        if (!Number.isFinite(id)) return
        if (seen.has(id)) return
        seen.add(id)
        merged.push(row)
      }
      for (const row of allRows) {
        if (!row) continue
        const n = normUserTaskType(row.taskType)
        if (
          n !== 'asset_extract' &&
          !isStep3FormGenerateTaskType(n) &&
          !isFormImageUserTaskType(n) &&
          n !== 'image_upscale'
        ) {
          continue
        }
        if (!isOngoingUserTaskStatus(row.status)) continue
        pushRow(row)
      }
      merged.sort((a, b) => {
        const ai = Number(a.id || 0)
        const bi = Number(b.id || 0)
        if (ai !== bi) return bi - ai
        const at = (a.createTime || '')
        const bt = (b.createTime || '')
        return bt.localeCompare(at)
      })
      ongoingTasks.value = merged
    } catch {
      // ignore
    } finally {
      ongoingTasksLoading.value = false
    }
  })().finally(() => {
    reloadOngoingTasksPromise = null
  })
  return reloadOngoingTasksPromise
}

function isStoryboardScriptBatchTaskType(ty: unknown): boolean {
  return String(ty ?? '').trim().toLowerCase().replace(/-/g, '_') === 'storyboard_script_batch'
}

function handleTrackTaskFromGlobal(payload?: { taskId?: number; taskType?: string | null }) {
  if (isStoryboardScriptBatchTaskType(payload?.taskType)) return
  const taskId = Number(payload?.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) return
  void startTrackTask({ taskId, taskType: payload?.taskType ?? null, tab: activeTab.value })
}

function handleStopTaskFromGlobal(payload?: { taskId?: number }) {
  const taskId = Number(payload?.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) return
  if (activeTaskStreamClosers.has(taskId) || activeTrackedTaskIds.value.includes(taskId)) {
    taskFollowSession++
    creationStore.setExtractingAssets(false)
    creationStore.endStep3FormImageTaskFollow()
    creationStore.clearExtractingTaskProgress()
    clearActiveTaskStream(taskId)
    message.info('已停止本页任务进度展示')
  }
}

function handleTrackTaskEvent(event: Event) {
  const customEvent = event as CustomEvent<{ taskId?: number; taskType?: string | null }>
  handleTrackTaskFromGlobal(customEvent.detail)
}

async function handleResumeTaskFromGlobal(payload?: { taskId?: number; taskType?: string | null }) {
  if (isStoryboardScriptBatchTaskType(payload?.taskType)) return
  const taskId = Number(payload?.taskId)
  if (!Number.isFinite(taskId) || taskId <= 0) return
  const ty = normUserTaskType(payload?.taskType)
  if (ty !== 'asset_extract') return
  try {
    await resumeUserTask(taskId, ty)
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
    await startTrackTask({ taskId, taskType: payload?.taskType ?? null, tab: activeTab.value })
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '续生失败')
  }
}

function handleResumeTaskEvent(event: Event) {
  const customEvent = event as CustomEvent<{ taskId?: number; taskType?: string | null }>
  void handleResumeTaskFromGlobal(customEvent.detail)
}

function handleStopTaskEvent(event: Event) {
  const customEvent = event as CustomEvent<{ taskId?: number }>
  handleStopTaskFromGlobal(customEvent.detail)
}

/** 刷新恢复 generating 后，供 SSE 结束拉列表：优先有生成中卡片的 Tab，避免仍用默认 scene */
function resolveTabKeyForStep3OngoingRestore(): TabKey {
  if (Object.values(propFormGenerationStatus.value).some((s) => s === 'generating')) return 'prop'
  if (Object.values(characterFormGenerationStatus.value).some((s) => s === 'generating')) return 'character'
  if (Object.values(sceneGenerationStatus.value).some((s) => s === 'generating')) return 'scene'
  return activeTab.value
}

async function restoreAndTrackOngoingTasks() {
  if (typeof window === 'undefined') return
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return

  const gen = ++restoreTasksGeneration
  try {
    await reloadOngoingTasks({ force: true })
    if (gen !== restoreTasksGeneration) return
    const cover = await reconcileOngoingStep3TasksToUi()
    if (gen !== restoreTasksGeneration) return
    clearStalePersistedGeneratingWithoutOngoingStep3Cover(cover)
    if (gen !== restoreTasksGeneration) return
    reconcileStep3GeneratingWithLoadedImages()
    if (gen !== restoreTasksGeneration) return

    const step3Tasks = ongoingTasks.value.filter(
      (t) => t && isStep3FormRelatedTaskType(t.taskType) && isOngoingUserTaskStatus(t.status)
    )
    const extractTask = ongoingTasks.value.find(
      (t) => t && normUserTaskType(t.taskType) === 'asset_extract' && isOngoingUserTaskStatus(t.status)
    )

    for (const t of step3Tasks) {
      const tid = parseTaskId(t.id)
      if (tid == null) continue
      if (creationStore.taskIdsWithLocalFollowPaused.includes(tid)) continue
      if (activeTaskStreamClosers.has(tid) || activeTrackedTaskIds.value.includes(tid)) continue
      void startTrackTask({
        taskId: tid,
        taskType: t.taskType ?? null,
        tab: resolveTabKeyForStep3OngoingRestore()
      })
    }

    if (extractTask?.id) {
      const extractId = Number(extractTask.id)
      const userPausedFollow =
        Number.isFinite(extractId) &&
        extractId > 0 &&
        creationStore.taskIdsWithLocalFollowPaused.includes(extractId)
      if (
        !userPausedFollow &&
        !activeTaskStreamClosers.has(extractId) &&
        !activeTrackedTaskIds.value.includes(extractId)
      ) {
        void startTrackTask({
          taskId: extractId,
          taskType: extractTask.taskType ?? null,
          tab: activeTab.value
        })
      }
    }

    if (gen !== restoreTasksGeneration) return
    creationStore.refreshStep3VisualGeneratingFlag()
    await recoverStaleGeneratingAfterCompletedFormImageTasks()
  } catch {
    // ignore restore errors
  }
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function runTaskWithSseFallback(taskId: number): Promise<{ status: TaskStatus; errorMessage?: string | null }> {
  notifyGlobalGenerateTaskListUpdated()
  creationStore.beginStep3FormImageTaskFollow()
  let streamConnected = false
  const stream = useTaskStream(taskId)
  activeTaskStreamClosers.set(taskId, () => stream.close())
  if (!activeTrackedTaskIds.value.includes(taskId)) {
    activeTrackedTaskIds.value = [...activeTrackedTaskIds.value, taskId]
  }
  try {
    const stopWatch = watch(
      () => stream.lastProgress.value,
      (p) => {
        if (!p) return
        if (p.stepTitle || p.message || typeof p.progress === 'number') {
          const msgText = String(p.message || '').trim()
          const titleText = String(p.stepTitle || '').trim()
          creationStore.setExtractingTaskProgress({
            percent: typeof p.progress === 'number' ? p.progress : creationStore.extractingTaskProgress.percent,
            stepTitle: titleText || msgText || creationStore.extractingTaskProgress.stepTitle,
            message: msgText || titleText,
            stepIndex: typeof p.stepIndex === 'number' ? p.stepIndex : null,
            stepTotal: typeof p.stepTotal === 'number' ? p.stepTotal : null
          })
        }
      },
      { immediate: true }
    )
    let res: Awaited<typeof stream.done>
    try {
      res = await stream.done
    } finally {
      streamConnected = stream.connected.value
      stopWatch()
      stream.close()
    }
    if (res.type === 'error') {
      return { status: 'FAILED', errorMessage: res.errorMessage || '任务失败' }
    }
    if (res.type === 'cancelled') {
      return { status: 'FAILED', errorMessage: res.message || '任务已取消' }
    }
    if (res.type === 'partial_failed') {
      return {
        status: 'PARTIAL_FAILED',
        errorMessage: formatPartialFailedMessage(res.data, '部分生成失败，可续生')
      }
    }
    if (res.type === 'complete') {
      const outcome = resolveFormImageBatchCompleteOutcome(res.data)
      if (outcome?.ok === false) {
        return { status: 'FAILED', errorMessage: outcome.errorMessage }
      }
    }
    return { status: 'SUCCEEDED', errorMessage: null }
  } catch (e: unknown) {
    if (!streamConnected) {
      return { status: 'FAILED', errorMessage: String((e as { message?: string })?.message || '任务失败') }
    }
    return {
      status: 'FAILED',
      errorMessage: String((e as { message?: string })?.message || '任务连接异常，请稍后重试')
    }
  } finally {
    clearActiveTaskStream(taskId)
    creationStore.endStep3FormImageTaskFollow()
    notifyGlobalGenerateTaskListUpdated()
  }
}

/** form/list 单行兼容：部分后端 VO 未带 assetId 或 id 写在 formId */
function normalizeFormRowFromApi(f: UserAssetRpsFormRow & { formId?: number }): UserAssetRpsFormRow | null {
  const rawId = f?.id ?? f?.formId
  if (rawId == null || !Number.isFinite(Number(rawId))) return null
  return { ...f, id: Number(rawId) }
}

function findLocalFormIdsForAsset(tab: TabKey, assetId: number, sceneIndex?: number): number[] {
  const aid = Number(assetId)
  if (tab === 'scene') {
    if (sceneIndex != null && Number.isFinite(sceneIndex) && Number(sceneAssetIds.value[sceneIndex]) === aid) {
      return sceneFormIdsByIndex.value[sceneIndex] ?? []
    }
    for (const [k, v] of Object.entries(sceneAssetIds.value)) {
      if (Number(v) === aid) return sceneFormIdsByIndex.value[Number(k)] ?? []
    }
    return []
  }
  if (tab === 'character') {
    for (const [k, v] of Object.entries(characterAssetIds.value)) {
      if (Number(v) === aid) return characterFormIdsByIndex.value[Number(k)] ?? []
    }
    return []
  }
  for (const [k, v] of Object.entries(propAssetIds.value)) {
    if (Number(v) === aid) return propFormIdsByIndex.value[Number(k)] ?? []
  }
  return []
}

async function fetchRpsRowByAssetId(payload: { tab: TabKey; assetId: number }) {
  const ctx = await resolveStoryScriptSaveContext(creationStore, route)
  if (!ctx) return null
  const assetType = payload.tab === 'scene' ? 'scene' : payload.tab === 'character' ? 'character' : 'prop'
  const { rows } = await userAssetRpsList({
    projectId: ctx.projectId,
    episodeId: ctx.episodeId,
    assetType
  })
  const found = rows.find((r) => r?.id != null && Number(r.id) === Number(payload.assetId))
  if (!found) return null
  const normalized = (found.forms ?? [])
    .map((f) => normalizeFormRowFromApi(f as UserAssetRpsFormRow & { formId?: number }))
    .filter((x): x is UserAssetRpsFormRow => x != null)
  if (!normalized.length) return null
  return { ...found, forms: normalized }
}

async function fetchRpsRowByAssetIdWithLocalFallback(payload: {
  tab: TabKey
  assetId: number
  sceneIndex?: number
}) {
  const row = await fetchRpsRowByAssetId(payload)
  if (row?.forms?.length) return row
  const localIds = findLocalFormIdsForAsset(payload.tab, payload.assetId, payload.sceneIndex).filter(
    (id) => id != null && Number.isFinite(Number(id))
  )
  if (!localIds.length) return row
  return {
    id: payload.assetId,
    forms: localIds.map((id) => ({ id: Number(id), name: ' ' }) as UserAssetRpsFormRow)
  }
}

async function runFormImageGenerate(payload: {
  formId: number
  formName: string
  tab: TabKey
}): Promise<number | null> {
  const beforeIds = new Set<number>()
  try {
    const beforeList = await userAssetRpsFormImageList({ formId: payload.formId })
    for (const row of beforeList) {
      if (row?.id != null && Number.isFinite(Number(row.id))) beforeIds.add(Number(row.id))
    }
  } catch {
    // 忽略前置查询异常，避免阻断生图主流程
  }

  const imageFields = await resolveFormImageApiSubmitFields(payload.tab)
  const submit = await userAssetExtractFormGenerateImage({
    formIds: [payload.formId],
    agentCode: imageFields.agentCode,
    ...(imageFields.modelCode ? { modelCode: imageFields.modelCode } : {}),
    ...(imageFields.resolution ? { resolution: imageFields.resolution } : {}),
    ...(imageFields.aspectRatio ? { aspectRatio: imageFields.aspectRatio } : {})
  })
  const taskRow = submit.tasks?.find((t) => Number(t.formId) === Number(payload.formId))
  const taskId =
    extractFormGenerateImageSubmitTaskId(submit) ??
    parseTaskId(taskRow?.taskId) ??
    (submit.taskIds?.length === 1 ? parseTaskId(submit.taskIds[0]) : null)
  if (!taskId) throw new Error('形态图生成任务提交失败：未返回任务ID')

  creationStore.setExtractingTaskProgress({
    percent: 0,
    stepTitle: `生成形态图：${payload.formName}`,
    message: ''
  })

  const res = await runTaskWithSseFallback(taskId)
  if (res.status !== 'SUCCEEDED') throw new Error(res.errorMessage || '形态图生成失败，请稍后重试')

  try {
    const list = await userAssetRpsFormImageList({ formId: payload.formId })
    const normalized = (Array.isArray(list) ? list : [])
      .filter((x) => x?.id != null && Number.isFinite(Number(x.id)))
      .map((x) => ({ id: Number(x.id), isUse: Number(x?.isUse) === 1 }))
    const created = normalized.find((x) => !beforeIds.has(x.id))
    if (created) return created.id
    const inUse = normalized.find((x) => x.isUse)
    if (inUse) return inUse.id
    const last = normalized[normalized.length - 1]
    return last?.id ?? null
  } catch {
    return null
  }
}

async function runSingleFormGenerate(
  payload: {
    assetId: number
    tab: 'character' | 'prop'
    formKey: string
    formName: string
    /** 调用方已解析的形态 id（如手动添加角色/道具后） */
    formId?: number | null
  }
) {
  const { assetId, tab, formKey, formName } = payload
  if (props.isExtracting) {
    message.warning('资产提取进行中，请提取完成后再生成形态图')
    return
  }
  const routeCtx = captureStep3RouteContext()
  const parts = formKey.split('-')
  const assetIdx = Number(parts[0])
  const formIdx = Number(parts[1])
  if (!Number.isFinite(assetIdx) || !Number.isFinite(formIdx)) {
    message.error('形态索引无效')
    return
  }
  let formId: number | null =
    payload.formId != null && Number.isFinite(Number(payload.formId)) ? Number(payload.formId) : null
  if (formId == null) {
    formId = await resolveFormIdForAssetForm(tab, assetIdx, formIdx)
    if (!matchesStep3RouteContext(routeCtx)) return
  }
  if (formId == null) {
    message.warning('未找到该形态的 ID，请稍后重试或先点击「新增形态」保存后再生成')
    return
  }

  if (tab === 'character') {
    characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [formKey]: 'generating' }
    creationStore.setCharacterFormGenerationStatus(formKey, 'generating')
  } else {
    propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [formKey]: 'generating' }
    creationStore.setPropFormGenerationStatus(formKey, 'generating')
  }
  try {
    const createdImageId = await runFormImageGenerate({ formId, formName, tab })
    if (!matchesStep3RouteContext(routeCtx)) {
      creationStore.resolveAllStep3GeneratingStatuses('success')
      if (tab === 'character') patchCharacterFormGenStatus(formKey, 'success', routeCtx)
      else patchPropFormGenStatus(formKey, 'success', routeCtx)
      message.success(`「${formName}」形态图生成成功`)
      return
    }
    await tryUseFormImage({ imageId: createdImageId, formId })
    if (!matchesStep3RouteContext(routeCtx)) {
      creationStore.resolveAllStep3GeneratingStatuses('success')
      if (tab === 'character') patchCharacterFormGenStatus(formKey, 'success', routeCtx)
      else patchPropFormGenStatus(formKey, 'success', routeCtx)
      message.success(`「${formName}」形态图生成成功`)
      return
    }
    await loadPersonalAssetsForTab(tab)
    sanitizeStep3SceneImagesState()
    reconcileStep3GeneratingWithLoadedImages()
    if (tab === 'character') {
      patchCharacterFormGenStatus(formKey, 'success', routeCtx)
    } else {
      patchPropFormGenStatus(formKey, 'success', routeCtx)
    }
    message.success(`「${formName}」形态图生成成功`)
  } catch (e: unknown) {
    if (!matchesStep3RouteContext(routeCtx)) {
      if (isBenignStep3TaskAbortError(e)) {
        creationStore.resolveAllStep3GeneratingStatuses('idle')
      }
      return
    }
    if (isBenignStep3TaskAbortError(e)) {
      if (tab === 'character') {
        patchCharacterFormGenStatus(formKey, 'idle', routeCtx)
      } else {
        patchPropFormGenStatus(formKey, 'idle', routeCtx)
      }
      message.warning('生成已中断（例如刷新页面），若任务仍在进行可稍候再试或重新点击自动生成')
    } else {
      if (tab === 'character') {
        patchCharacterFormGenStatus(formKey, 'failed', routeCtx)
      } else {
        patchPropFormGenStatus(formKey, 'failed', routeCtx)
      }
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '形态图生成失败，请重试')
    }
  } finally {
    if (matchesStep3RouteContext(routeCtx)) {
      creationStore.clearExtractingTaskProgress()
    }
  }
}

function findSceneIndexByAssetId(assetId: number): number {
  for (const [k, v] of Object.entries(sceneAssetIds.value)) {
    if (Number(v) === Number(assetId)) return Number(k)
  }
  return -1
}

function findCharacterIndexByAssetId(assetId: number): number {
  for (const [k, v] of Object.entries(characterAssetIds.value)) {
    if (Number(v) === Number(assetId)) return Number(k)
  }
  return -1
}

function findPropIndexByAssetId(assetId: number): number {
  for (const [k, v] of Object.entries(propAssetIds.value)) {
    if (Number(v) === Number(assetId)) return Number(k)
  }
  return -1
}

function resetPendingFormGenerateSlotsForAssetIds(assetIds: number[], tab: TabKey) {
  clearPendingFormGenBusyForAssetIds(assetIds)
  for (const aid of assetIds) {
    clearStep3ImageGeneratingSlotsForFormTextAssetId(aid)
  }
}

async function runBatchPendingFormGenerate() {
  if (props.isExtracting) {
    message.warning('资产提取进行中，请提取完成后再生成形态')
    return
  }
  const tab = activeTab.value
  const cards = activeTabPendingFormCards.value
  if (!cards.length) {
    message.warning('暂无待生成形态的资产')
    return
  }
  const assetIds = cards
    .map((c) => c.assetId)
    .filter((id) => Number.isFinite(id) && id > 0 && !pendingFormGenBusy.value[id])
  if (!assetIds.length) {
    message.warning('资产形态正在生成中，请稍候')
    return
  }
  batchFormGenerateSubmitting.value = true
  for (const aid of assetIds) {
    applyAssetIdToPendingFormTextGeneratingBusy(aid)
  }
  try {
    const textFields = await resolveFormTextSubmitFields(tab)
    const submitBody: { assetIds: number[]; agentCode: string; modelCode?: string } = {
      assetIds,
      agentCode: textFields.agentCode,
      ...(textFields.modelCode ? { modelCode: textFields.modelCode } : {})
    }
    const submit = await userAssetExtractFormGenerate(submitBody)
    const taskId = extractFormGenerateTextSubmitTaskId(submit)
    if (!taskId) throw new Error('批量形态生成任务提交失败：未返回任务ID')

    const typeLabel = tab === 'scene' ? '场景' : tab === 'character' ? '角色' : '道具'
    message.success(`已提交 ${assetIds.length} 个${typeLabel}的批量形态生成任务`)
    void startTrackTask({
      taskId,
      taskType: 'form_generate_batch',
      tab
    })
  } catch (e: unknown) {
    resetPendingFormGenerateSlotsForAssetIds(assetIds, tab)
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '批量形态生成失败，请重试')
  } finally {
    batchFormGenerateSubmitting.value = false
  }
}

async function runPendingExtractFormGenerate(
  item: { assetId: number; assetType: TabKey; title: string },
  options?: {
    /** 角色/道具：形态卡 loading 用 `${ci}-${fi}`，默认 `pending-${assetId}` */
    formStatusKey?: string
    /** 场景：列表刚追加时可直接传索引，避免映射未就绪 */
    sceneIndexOverride?: number
    /** 手动添加的场景/形态不在「待生成形态」队列，跳过 remove */
    skipRemovePendingCard?: boolean
  }
) {
  if (props.isExtracting) {
    message.warning('资产提取进行中，请提取完成后再生成形态')
    return
  }
  const { assetId, assetType: tab, title: formName } = item
  if (
    pendingFormGenBusy.value[assetId]
  ) {
    message.warning('该资产形态正在生成中，请稍候')
    return
  }
  pendingFormGenBusy.value = { ...pendingFormGenBusy.value, [assetId]: true }
  clearStep3ImageGeneratingSlotsForFormTextAssetId(assetId)
  try {
    const textFields = await resolveFormTextSubmitFields(tab)
    const submitBody: { assetIds: number[]; agentCode: string; modelCode?: string } = {
      assetIds: [assetId],
      agentCode: textFields.agentCode,
      ...(textFields.modelCode ? { modelCode: textFields.modelCode } : {})
    }
    const submit = await userAssetExtractFormGenerate(submitBody)
    const taskId = extractFormGenerateTextSubmitTaskId(submit)
    if (!taskId) throw new Error('形态生成任务提交失败：未返回任务ID')

    creationStore.setExtractingTaskProgress({
      percent: 0,
      stepTitle: `生成形态：${formName}`,
      message: ''
    })
    const result = await runTaskWithSseFallback(taskId)
    if (result.status !== 'SUCCEEDED') throw new Error(result.errorMessage || '形态生成失败，请稍后重试')

    await loadPersonalAssetsForTab(tab)

    // 仅生成形态文案，不自动调生图；配图请在大卡上点「自动生成」
    if (!options?.skipRemovePendingCard) {
      creationStore.removePendingExtractFormAsset(assetId, tab)
    }
    clearStep3ImageGeneratingSlotsForFormTextAssetId(assetId)
    message.success(`「${formName}」形态已生成，可点击「自动生成」生成配图`)
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '形态生成失败，请重试')
  } finally {
    creationStore.clearExtractingTaskProgress()
    pendingFormGenBusy.value = { ...pendingFormGenBusy.value, [assetId]: false }
  }
}

function handleDeletePendingFormCard(item: { assetId: number; assetType: TabKey; title: string }) {
  Modal.confirm({
    title: '确认删除该资产？',
    content: `将删除「${item.title}」及其相关内容，且不可恢复。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await userAssetRpsDelete({ id: item.assetId })
        creationStore.removePendingExtractFormAsset(item.assetId, item.assetType)
        await loadPersonalAssetsForTab(item.assetType)
        message.success('已删除')
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '删除失败')
      }
    }
  })
}

onBeforeUnmount(() => {
  if (projectAssetBootstrapDebounceTimer) {
    clearTimeout(projectAssetBootstrapDebounceTimer)
    projectAssetBootstrapDebounceTimer = null
  }
  projectAssetBootstrapEpoch++
  stopVoicePreview()
  window.removeEventListener('create-flow-track-task', handleTrackTaskEvent as EventListener)
  window.removeEventListener('create-flow-stop-task', handleStopTaskEvent as EventListener)
  window.removeEventListener('create-flow-resume-task', handleResumeTaskEvent as EventListener)
  /** 切换流程步骤时不重置第三步生成 loading、不中断形态图 SSE，由 Pinia + 壳层流程条持续展示 */
})

/** Tab 上仅在「自动提取」或「形态图生成中」时展示 loading，切换 Tab 拉列表不在此展示 */
const isTabLoading = (key: TabKey) => {
  if (props.isExtracting && props.extractingStages?.[key]) return true
  if (key === 'scene' && isGeneratingScene.value) return true
  if (key === 'character' && isGeneratingCharacterForm.value) return true
  if (key === 'prop' && isGeneratingPropForm.value) return true
  return false
}

const handleSceneImageImport = async (fileOrAsset: File | string | any) => {
  const now = new Date()
  let imageUrl: string
  let imageTitle: string
  let source: string
  const targetIndex = currentImportSceneIndex.value

  if (targetIndex < 0 || targetIndex >= localValue.value.scenes.length) {
    message.error('导入失败：未找到目标场景')
    return
  }

  // 图片导入：始终添加到当前点击的场景，不新增场景条目
  if (!sceneImages.value[targetIndex]) {
    sceneImages.value[targetIndex] = []
  }
  
  // 处理不同类型的导入
  if (fileOrAsset instanceof File) {
    const uploaded = await uploadImageToOssWithToast(fileOrAsset)
    if (!uploaded) return
    imageUrl = uploaded
    imageTitle = fileOrAsset.name.replace(/\.[^/.]+$/, '') || `场景图${sceneImages.value[targetIndex].length + 1}`
    source = '本地上传'
  } else if (typeof fileOrAsset === 'string') {
    // 字符串URL
    imageUrl = fileOrAsset
    imageTitle = `场景图${sceneImages.value[targetIndex].length + 1}`
    source = '资源库导入'
  } else if (fileOrAsset && typeof fileOrAsset === 'object') {
    // 资产对象（包含 type: 'scene' 的选择项）
    imageUrl = fileOrAsset.url || fileOrAsset.thumbnail || 'https://picsum.photos/800/450?random=' + Date.now()
    imageTitle = fileOrAsset.name?.replace(/\.[^/.]+$/, '') || `场景图${sceneImages.value[targetIndex].length + 1}`
    source = fileOrAsset.type === 'scene' ? '场景资产导入' : '资源库导入'
  } else {
    message.error('导入失败：无效的图片数据')
    return
  }

  let rpsFormId: number | undefined
  let rpsImageId: number | undefined
  const sceneAssetId = sceneAssetIds.value[targetIndex]
  if (sceneAssetId != null && Number.isFinite(Number(sceneAssetId))) {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (ctx) {
      try {
        const currentImageCount = sceneImages.value[targetIndex]?.length ?? 0
        const existingFormId = ensureFormIdForRpsUpdate('scene', targetIndex, currentImageCount)
        if (existingFormId != null) {
          rpsFormId = existingFormId
        } else {
          const row = await userAssetRpsFormCreate({
            projectId: ctx.projectId,
            episodeId: ctx.episodeId,
            assetId: Number(sceneAssetId),
            imageUrl,
            name: imageTitle,
            sourceType: mapImportSourceType(source)
          })
          applyRpsRowFormIds('scene', targetIndex, row)
          const ids = sceneFormIdsByIndex.value[targetIndex] ?? []
          const last = ids[ids.length - 1]
          if (last != null && Number.isFinite(Number(last))) rpsFormId = Number(last)
        }
        if (rpsFormId != null) {
          const created = await userAssetRpsFormImageCreate({
            formId: rpsFormId,
            imageUrl,
            name: imageTitle,
            sourceType: mapImportSourceType(source),
            asInUse: true
          })
          rpsImageId = resolveCreatedFormImageId(created) ?? undefined
          if (rpsImageId != null) {
            await tryUseFormImage({ imageId: rpsImageId })
          }
        }
      } catch {
        // 场景导入不阻断前端体验，后端失败时保留本地回显
      }
    }
  }
  
  // 添加图片到场景
  if (!sceneImages.value[targetIndex]) {
    sceneImages.value[targetIndex] = []
  }
  
  sceneImages.value[targetIndex].push({
    id: Date.now().toString(),
    ...(rpsFormId != null ? { rpsFormId } : {}),
    ...(rpsImageId != null ? { rpsImageId } : {}),
    url: imageUrl,
    thumbnail: imageUrl,
    title: imageTitle,
    createdAt: now.toISOString(),
    source: source,
    importDate: now.toISOString(),
    angles: []
  })
  
  // 强制触发响应式更新
  sceneImages.value = { ...sceneImages.value }
  
  const sceneName = localValue.value.scenes[targetIndex]
  message.success(`已为「${sceneName}」导入场景图片`)
  showImportSceneImageModal.value = false
}

// 获取场景的第一张图片（用于显示）
const getSceneImage = (index: number) => {
  const images = sceneImages.value[index]
  return images && images.length > 0 ? images[0] : null
}

// 场景图片操作
const handlePreviewSceneImage = (index: number) => {
  const img = getSceneImage(index)
  if (img) {
    message.info('点击图片可放大预览')
  }
}

const handleReplaceSceneImage = (index: number) => {
  handleImportSceneImage(index)
}

const handleDownloadSceneImage = (index: number) => {
  const img = getSceneImage(index)
  if (img && img.url) {
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `场景图${index + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  }
}

const handleDeleteSceneImage = (index: number) => {
  if (sceneImages.value[index] && sceneImages.value[index].length > 0) {
    sceneImages.value[index] = []
    message.success('场景图片已删除')
  }
}

// 按索引操作场景图片（支持多张图片）
const handlePreviewSceneImageByIndex = (sceneIndex: number, imageIndex: number) => {
  const images = sceneImages.value[sceneIndex]
  if (images && images[imageIndex] && images[imageIndex].url) {
    // 使用 a-image 的预览功能
    const img = new Image()
    img.src = images[imageIndex].url
    // 创建一个临时的 a-image 组件来触发预览
    // 由于 a-image 的预览功能需要组件实例，这里使用 Modal 来显示大图
    Modal.info({
      icon: () => null,
      title: images[imageIndex].title || `场景图${imageIndex + 1}`,
      content: h('img', {
        src: images[imageIndex].url,
        style: { width: '100%', maxHeight: '70vh', objectFit: 'contain' }
      }),
      width: '80%',
      okText: '关闭'
    })
  } else {
    message.warning('暂无图片可预览')
  }
}

const handleReplaceSceneImageByIndex = (sceneIndex: number, imageIndex: number) => {
  currentImportSceneIndex.value = sceneIndex
  showImportSceneImageModal.value = true
  // TODO: 替换指定索引的图片
}

const handleDownloadSceneImageByIndex = (sceneIndex: number, imageIndex: number) => {
  const images = sceneImages.value[sceneIndex]
  const img = images && images[imageIndex]
  if (img && img.url) {
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `场景图${sceneIndex + 1}-${imageIndex + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  }
}

const handleDeleteSceneImageByIndex = async (sceneIndex: number, imageIndex: number) => {
  const images = sceneImages.value[sceneIndex]
  if (!images || images.length <= imageIndex) return
  const img = images[imageIndex]
  const imageId =
    img?.rpsImageId != null && Number.isFinite(Number(img.rpsImageId)) ? Number(img.rpsImageId) : null
  const formId =
    img?.rpsFormId != null && Number.isFinite(Number(img.rpsFormId))
      ? Number(img.rpsFormId)
      : ((sceneFormIdsByIndex.value[sceneIndex] ?? [])[imageIndex] ?? null)
  if (!(await tryUnuseFormImage({ imageId, formId }))) return
  images.splice(imageIndex, 1)
  sceneImages.value = { ...sceneImages.value }
  message.success('已取消主图展示')
  syncStep3AssetsToCreationStore()
}

// 场景名称编辑
const editingSceneIndex = ref<number | null>(null)
const editingSceneName = ref('')

/** 「待生成形态」横滑卡片标题编辑 */
const editingPendingFormCardKey = ref<string | null>(null)
const editingPendingFormTitle = ref('')

// 场景图名称编辑
const editingImageTitleIndex = ref<string | null>(null)
const editingImageTitle = ref('')

/** 富文本设定 → 文档 2.5：introduction 为详细描述；summary 为概要（场景/道具主表） */
function profilePlainFromSettingHtml(html: string): { introduction: string; summary: string } {
  const introduction = htmlToPlainText(html ?? '').trim()
  const summary =
    introduction.length > 300 ? `${introduction.slice(0, 300).trim()}…` : introduction
  return { introduction, summary }
}

// 获取场景前缀（如"场景2:"）
const getScenePrefix = (name: string) => {
  const match = name.match(/^(场景\d+):/)
  return match ? match[1] + ':' : ''
}

// 获取场景名称（去掉前缀）
const getSceneName = (name: string) => {
  const match = name.match(/^场景\d+:\s*(.+)$/)
  return match ? match[1] : name
}

// 开始编辑场景名称
const startEditSceneName = (index: number, currentName: string) => {
  editingSceneIndex.value = index
  editingSceneName.value = getSceneName(currentName)
}

// 完成编辑场景名称
const handleSceneNameBlur = async (index: number) => {
  if (editingSceneIndex.value !== index || !editingSceneName.value.trim()) {
    editingSceneIndex.value = null
    editingSceneName.value = ''
    return
  }
  const prefix = getScenePrefix(localValue.value.scenes[index])
  const newName = prefix ? `${prefix} ${editingSceneName.value.trim()}` : editingSceneName.value.trim()
  const oldName = localValue.value.scenes[index]
  if (newName === oldName) {
    editingSceneIndex.value = null
    editingSceneName.value = ''
    return
  }

  const assetId = sceneAssetIds.value[index]
  if (assetId != null) {
    try {
      await userAssetRpsUpdateMain({ id: assetId, name: newName })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '场景名称同步失败')
      editingSceneIndex.value = null
      editingSceneName.value = ''
      return
    }
  }

  const newScenes = [...localValue.value.scenes]
  newScenes[index] = newName
  update({ ...localValue.value, scenes: newScenes })
  if (sceneSettings.value[oldName]) {
    sceneSettings.value[newName] = sceneSettings.value[oldName]
    delete sceneSettings.value[oldName]
  }
  message.success(assetId != null ? '场景名称已更新' : '场景名称已更新（仅本地）')
  editingSceneIndex.value = null
  editingSceneName.value = ''
}

// 开始编辑场景图名称
const startEditImageTitle = (sceneIndex: number, imageIndex: number, currentTitle: string) => {
  editingImageTitleIndex.value = `${sceneIndex}-${imageIndex}`
  editingImageTitle.value = currentTitle || `场景图${imageIndex + 1}`
}

// 完成编辑场景图名称
const handleImageTitleBlur = async (sceneIndex: number, imageIndex: number) => {
  if (editingImageTitleIndex.value === `${sceneIndex}-${imageIndex}` && editingImageTitle.value.trim()) {
    const images = sceneImages.value[sceneIndex]
    if (images && images[imageIndex]) {
      const nextTitle = editingImageTitle.value.trim()
      const ok = await syncImageTitleToRps(images[imageIndex], nextTitle)
      if (!ok) {
        editingImageTitleIndex.value = null
        editingImageTitle.value = ''
        return
      }
      images[imageIndex].title = nextTitle
      // 强制触发响应式更新
      sceneImages.value = { ...sceneImages.value }
      message.success('场景图名称已更新')
    }
  }
  editingImageTitleIndex.value = null
  editingImageTitle.value = ''
}

// 场景设定相关
const sceneSettings = ref<Record<string, { content: string; isNew?: boolean }>>({})
const showSceneSettingModal = ref(false)
const currentSceneIndex = ref(-1)
const currentSceneName = computed(() => {
  if (currentSceneIndex.value >= 0 && currentSceneIndex.value < localValue.value.scenes.length) {
    return localValue.value.scenes[currentSceneIndex.value]
  }
  return ''
})

const handleEditSceneSetting = (index: number) => {
  currentSceneIndex.value = index
  const sceneName = localValue.value.scenes[index]
  // 如果没有保存过内容，初始化为空
  if (!sceneSettings.value[sceneName]) {
    sceneSettings.value[sceneName] = { content: '', isNew: true }
  }
  showSceneSettingModal.value = true
}

const showEditSceneImageModal = ref(false)
const currentEditSceneIndex = ref(-1)

const handleEditSceneImage = (index: number) => {
  currentEditSceneIndex.value = index
  currentEditImageIndex.value = null // 不指定图片索引，默认选中第一张
  showEditSceneImageModal.value = true
}

// 带图片索引的编辑场景图（点击图片时调用）
const currentEditImageIndex = ref<number | null>(null)
const handleEditSceneImageWithIndex = (sceneIndex: number, imageIndex: number) => {
  currentEditSceneIndex.value = sceneIndex
  currentEditImageIndex.value = imageIndex
  showEditSceneImageModal.value = true
}

// 处理场景图片更新（从编辑弹窗返回）
const handleSceneImageUpdate = async (sceneIndex: number, sceneData: any) => {
  const sceneName = localValue.value.scenes[sceneIndex]
  if (sceneData && sceneData.setting !== undefined && sceneName) {
    const assetId = sceneAssetIds.value[sceneIndex]
    if (assetId != null) {
      try {
        const fields = buildUpdateMainPayloadFromSettingHtml(String(sceneData.setting ?? ''), 'scene')
        await userAssetRpsUpdateMain({
          id: Number(assetId),
          ...fields
        })
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '场景设定同步失败')
        return
      }
    }
    sceneSettings.value[sceneName] = {
      content: sceneData.setting,
      isNew: false
    }
    sceneSettings.value = { ...sceneSettings.value }
  }
  if (sceneData && sceneData.images) {
    // 确保使用数组的深拷贝，避免引用问题
    sceneImages.value[sceneIndex] = Array.isArray(sceneData.images) 
      ? sceneData.images.map((img: any) => ({ ...img }))
      : []
    // 强制触发响应式更新
    sceneImages.value = { ...sceneImages.value }
  }
  if (sceneData?.rpsRow) {
    applyRpsRowFormIds('scene', sceneIndex, sceneData.rpsRow)
  }
}

const handleCopyScene = (index: number) => {
  const sceneName = localValue.value.scenes[index]
  const newIndex = localValue.value.scenes.length
  
  // 生成新的场景名称（保持场景编号格式）
  const sceneNameMatch = sceneName.match(/^(场景\d+):\s*(.+)$/)
  let newSceneName: string
  
  if (sceneNameMatch) {
    // 如果有场景编号格式，生成新的编号
    const newSceneNumber = newIndex + 1
    newSceneName = `场景${newSceneNumber}: ${sceneNameMatch[2]}`
  } else {
    // 如果没有场景编号格式，直接添加副本后缀
    newSceneName = `${sceneName}_副本`
  }
  
  // 添加新场景
  update({
    ...localValue.value,
    scenes: [...localValue.value.scenes, newSceneName]
  })
  
  // 复制场景设定
  if (sceneSettings.value[sceneName]) {
    sceneSettings.value[newSceneName] = {
      content: sceneSettings.value[sceneName].content,
      isNew: true
    }
  }
  
  // 复制场景图片（深拷贝）
  if (sceneImages.value[index] && sceneImages.value[index].length > 0) {
    sceneImages.value[newIndex] = sceneImages.value[index].map((img: any) => ({
      ...img,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    }))
  }
  
  // 标记为手动添加的场景
  manualScenes.value.add(newIndex)
  creationStore.addManualScene(newIndex)
  
  message.success('场景已复制')
}

// 保存场景设定
const handleSaveSceneSetting = async (content: string) => {
  if (!currentSceneName.value) return
  const idx = currentSceneIndex.value
  const assetId = sceneAssetIds.value[idx]
  if (assetId != null) {
    try {
      const fields = buildUpdateMainPayloadFromSettingHtml(content, 'scene')
      await userAssetRpsUpdateMain({ id: Number(assetId), ...fields })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '场景设定同步失败')
      return
    }
  }
  sceneSettings.value[currentSceneName.value] = {
    content,
    isNew: false
  }
  showSceneSettingModal.value = false
  message.success(assetId != null ? '场景设定已保存并同步' : '场景设定已保存（仅本地）')
}

// 保存并更新场景图
const handleSaveAndUpdateSceneImage = async (content: string) => {
  if (!currentSceneName.value) return
  const idx = currentSceneIndex.value
  const assetId = sceneAssetIds.value[idx]
  if (assetId != null) {
    try {
      const fields = buildUpdateMainPayloadFromSettingHtml(content, 'scene')
      await userAssetRpsUpdateMain({ id: Number(assetId), ...fields })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '场景设定同步失败')
      return
    }
  }
  sceneSettings.value[currentSceneName.value] = {
    content,
    isNew: false
  }
  showSceneSettingModal.value = false
  message.info('场景设定已同步，可在编辑场景图中发起新生成')
}

// ========== 角色相关方法 ==========
// 角色名称编辑
const editingCharacterIndex = ref<number | null>(null)
const editingCharacterName = ref('')

const getCharacterPrefix = (name: string) => {
  const match = name.match(/^(角色\d+):/)
  return match ? match[1] + ':' : ''
}

const getCharacterName = (name: string) => {
  const match = name.match(/^角色\d+:\s*(.+)$/)
  return match ? match[1] : name
}

const startEditCharacterName = (index: number, currentName: string) => {
  editingCharacterIndex.value = index
  editingCharacterName.value = getCharacterName(currentName)
}

const handleCharacterNameBlur = async (index: number) => {
  if (editingCharacterIndex.value !== index || !editingCharacterName.value.trim()) {
    editingCharacterIndex.value = null
    editingCharacterName.value = ''
    return
  }
  const prefix = getCharacterPrefix(localValue.value.characters[index])
  const newName = prefix ? `${prefix} ${editingCharacterName.value.trim()}` : editingCharacterName.value.trim()
  const oldName = localValue.value.characters[index]
  if (newName === oldName) {
    editingCharacterIndex.value = null
    editingCharacterName.value = ''
    return
  }

  const assetId = characterAssetIds.value[index]
  if (assetId != null) {
    try {
      await userAssetRpsUpdateMain({ id: assetId, name: newName })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '角色名称同步失败')
      editingCharacterIndex.value = null
      editingCharacterName.value = ''
      return
    }
  }

  const newCharacters = [...localValue.value.characters]
  newCharacters[index] = newName
  update({ ...localValue.value, characters: newCharacters })
  if (characterSettings.value[oldName]) {
    characterSettings.value[newName] = characterSettings.value[oldName]
    delete characterSettings.value[oldName]
  }
  message.success(assetId != null ? '角色名称已更新' : '角色名称已更新（仅本地）')
  editingCharacterIndex.value = null
  editingCharacterName.value = ''
}

// 角色设定
const showCharacterSettingModal = ref(false)
const currentCharacterIndex = ref(-1)
const currentCharacterName = computed(() => {
  if (currentCharacterIndex.value >= 0 && currentCharacterIndex.value < localValue.value.characters.length) {
    return localValue.value.characters[currentCharacterIndex.value]
  }
  return ''
})
const characterSettings = ref<Record<string, { content: string; isNew?: boolean }>>({})

const handleEditCharacterSetting = (index: number) => {
  currentCharacterIndex.value = index
  const characterName = localValue.value.characters[index]
  if (!characterSettings.value[characterName]) {
    characterSettings.value[characterName] = { content: '', isNew: true }
  }
  showCharacterSettingModal.value = true
}

const handleSaveCharacterSetting = async (content: string) => {
  if (!currentCharacterName.value) return
  const idx = currentCharacterIndex.value
  const assetId = characterAssetIds.value[idx]
  if (assetId != null) {
    try {
      const fields = buildUpdateMainPayloadFromSettingHtml(content, 'character')
      await userAssetRpsUpdateMain({ id: Number(assetId), ...fields })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '角色设定同步失败')
      return
    }
  }
  characterSettings.value[currentCharacterName.value] = {
    content,
    isNew: false
  }
  showCharacterSettingModal.value = false
  message.success(assetId != null ? '角色设定已保存并同步' : '角色设定已保存（仅本地）')
}

// 形态管理
const editingFormIndex = ref<string | null>(null)
const editingFormName = ref('')

const getFormPrefix = (name: string) => {
  const match = name.match(/^(形态\d+):/)
  return match ? match[1] + ':' : ''
}

const getFormName = (name: string) => {
  const match = name.match(/^形态\d+:\s*(.+)$/)
  return match ? match[1] : name
}

const startEditFormName = (characterIndex: number, formIndex: number, currentName: string) => {
  editingFormIndex.value = `${characterIndex}-${formIndex}`
  editingFormName.value = getFormName(currentName)
}

const handleFormNameBlur = async (characterIndex: number, formIndex: number) => {
  if (editingFormIndex.value !== `${characterIndex}-${formIndex}` || !editingFormName.value.trim()) {
    editingFormIndex.value = null
    editingFormName.value = ''
    return
  }
  const prev = characterForms.value[characterIndex][formIndex].name
  const prefix = getFormPrefix(prev)
  const newName = prefix ? `${prefix} ${editingFormName.value.trim()}` : editingFormName.value.trim()
  if (newName === prev) {
    editingFormIndex.value = null
    editingFormName.value = ''
    return
  }

  const assetId = characterAssetIds.value[characterIndex]
  if (assetId != null) {
    const formId = ensureFormIdForRpsUpdate('character', characterIndex, formIndex)
    if (formId == null) {
      message.error('无法同步形态名称：请先在「编辑形态图」弹窗中上传、从资产库导入或通过 AI 生成图片以创建形态')
      editingFormIndex.value = null
      editingFormName.value = ''
      return
    }
    try {
      await userAssetRpsUpdateForm({ id: formId, name: newName })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '形态名称同步失败')
      editingFormIndex.value = null
      editingFormName.value = ''
      return
    }
  }

  characterForms.value[characterIndex][formIndex].name = newName
  message.success(assetId != null ? '形态名称已更新' : '形态名称已更新（仅本地）')
  editingFormIndex.value = null
  editingFormName.value = ''
}

const handleAddCharacterForm = async (characterIndex: number) => {
  if (!characterForms.value[characterIndex]) {
    characterForms.value[characterIndex] = []
  }
  const formCount = characterForms.value[characterIndex].length + 1
  const formName = `形态${formCount}: 未命名`
  const aid = characterAssetIds.value[characterIndex]
  if (aid != null && Number.isFinite(Number(aid))) {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (ctx) {
      try {
        const row = await userAssetRpsFormCreate({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          assetId: Number(aid),
          imageUrl: '',
          name: formName,
          sourceType: 'official'
        })
        applyRpsRowFormIds('character', characterIndex, row)
        if (aid != null) await syncAssetFormIdsFromServer('character', characterIndex, Number(aid), row)
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '新增形态失败')
        return
      }
    }
  }
  const fi = characterForms.value[characterIndex].length
  characterForms.value[characterIndex].push({ name: formName, voiceover: undefined, voiceoverId: undefined, voiceoverAvatarUrl: undefined, voiceoverPreviewUrl: undefined })
  const formKey = `${characterIndex}-${fi}`
  characterFormGenerationStatus.value = { ...characterFormGenerationStatus.value, [formKey]: 'idle' }
  creationStore.setCharacterFormGenerationStatus(formKey, 'idle')
  message.success('形态已添加')
}

const handleCopyCharacterForm = (characterIndex: number, formIndex: number) => {
  const form = characterForms.value[characterIndex][formIndex]
  const newForm = {
    name: form.name.replace(/形态\d+/, (match) => {
      const num = parseInt(match.replace('形态', '')) || 1
      return `形态${characterForms.value[characterIndex].length + 1}`
    }),
    voiceover: form.voiceover,
    voiceoverId: form.voiceoverId,
    voiceoverAvatarUrl: form.voiceoverAvatarUrl,
    voiceoverPreviewUrl: form.voiceoverPreviewUrl
  }
  characterForms.value[characterIndex].push(newForm)
  message.success('形态已复制')
}

const showVoiceTimbrePickerModal = ref(false)
const currentVoiceCharacterIndex = ref<number>(-1)
const currentVoiceFormIndex = ref<number>(-1)
const voicePickerInitialName = ref('')
const voicePreviewAudioRef = ref<HTMLAudioElement | null>(null)
const playingVoicePreviewKey = ref<string | null>(null)

const openVoiceTimbrePicker = (characterIndex: number, formIndex: number) => {
  const form = characterForms.value[characterIndex]?.[formIndex]
  if (!form) return
  currentVoiceCharacterIndex.value = characterIndex
  currentVoiceFormIndex.value = formIndex
  voicePickerInitialName.value = form.voiceover || ''
  showVoiceTimbrePickerModal.value = true
}

const stopVoicePreview = () => {
  const audio = voicePreviewAudioRef.value
  if (audio) {
    audio.pause()
    audio.src = ''
  }
  playingVoicePreviewKey.value = null
}

const handleVoiceTimbreConfirm = (payload: { name: string; avatarUrl: string; id: string; previewUrl: string }) => {
  const characterIndex = currentVoiceCharacterIndex.value
  const formIndex = currentVoiceFormIndex.value
  const targetForm = characterForms.value[characterIndex]?.[formIndex]
  if (!targetForm) return
  targetForm.voiceover = payload.name
  targetForm.voiceoverId = payload.id
  targetForm.voiceoverAvatarUrl = payload.avatarUrl
  targetForm.voiceoverPreviewUrl = payload.previewUrl
  stopVoicePreview()
  message.success(`已选择配音：${payload.name}`)
}

const toggleVoicePreview = async (characterIndex: number, formIndex: number) => {
  const form = characterForms.value[characterIndex]?.[formIndex]
  if (!form?.voiceover) return
  const previewUrl = String(form.voiceoverPreviewUrl || 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3').trim()
  if (!previewUrl) {
    message.warning('该配音暂无试听音频')
    return
  }
  const key = `${characterIndex}-${formIndex}`
  const audio = voicePreviewAudioRef.value
  if (!audio) return

  if (playingVoicePreviewKey.value === key) {
    stopVoicePreview()
    return
  }

  stopVoicePreview()
  playingVoicePreviewKey.value = key
  audio.src = previewUrl
  try {
    await audio.play()
  } catch {
    playingVoicePreviewKey.value = null
    message.warning('试听失败，请稍后重试')
  }
}

const handleVoicePreviewEnded = () => {
  playingVoicePreviewKey.value = null
}

const handleVoicePreviewPaused = () => {
  const audio = voicePreviewAudioRef.value
  if (!audio || audio.ended) return
  if (!audio.src) playingVoicePreviewKey.value = null
}

const handleDeleteCharacterForm = (characterIndex: number, formIndex: number) => {
  Modal.confirm({
    title: '确认删除形态?',
    content: '删除后将无法恢复。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const aid = characterAssetIds.value[characterIndex]
      const formIds = characterFormIdsByIndex.value[characterIndex] ?? []
      const fid = formIds[formIndex]
      try {
        if (aid != null && fid != null) {
          await rpsDeleteSingleForm(aid, fid)
        } else if (aid != null) {
          message.warning('未找到服务端形态 ID，已仅从界面移除')
        }
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '删除形态失败')
        throw e
      }

      characterForms.value[characterIndex].splice(formIndex, 1)
      characterForms.value[characterIndex].forEach((form, index) => {
        const match = form.name.match(/^(形态\d+):\s*(.+)$/)
        if (match) {
          form.name = `形态${index + 1}: ${match[2]}`
        }
      })

      const newIds = [...formIds]
      newIds.splice(formIndex, 1)
      characterFormIdsByIndex.value = { ...characterFormIdsByIndex.value, [characterIndex]: newIds }

      const next: Record<string, any[]> = {}
      for (const k of Object.keys(characterFormImages.value)) {
        const [c, f] = k.split('-').map(Number)
        if (c !== characterIndex) {
          next[k] = characterFormImages.value[k]
        } else if (f === formIndex) {
          continue
        } else if (f > formIndex) {
          next[`${c}-${f - 1}`] = characterFormImages.value[k]
        } else {
          next[k] = characterFormImages.value[k]
        }
      }
      characterFormImages.value = next

      message.success('形态已删除')
    }
  })
}

// 角色图片相关
// 角色图片数据存储：Record<角色索引, 图片数组>
const characterImages = ref<Record<number, any[]>>({})
// 角色形态图片数据存储：Record<"characterIndex-formIndex", 图片数组>
const characterFormImages = ref<Record<string, any[]>>({})

const showImportCharacterImageModal = ref(false)
const currentImportCharacterIndex = ref(-1)

const handleImportCharacterImage = (index: number) => {
  currentImportCharacterIndex.value = index
  showImportCharacterImageModal.value = true
}

const handleCharacterImageImport = async (fileOrAsset: File | string | any) => {
  const now = new Date()
  let imageUrl: string
  let imageTitle: string
  let source: string
  const targetIndex = currentImportCharacterIndex.value
  
  // 添加图片到角色
  if (!characterImages.value[targetIndex]) {
    characterImages.value[targetIndex] = []
  }
  
  // 处理不同类型的导入
  if (fileOrAsset instanceof File) {
    const uploaded = await uploadImageToOssWithToast(fileOrAsset)
    if (!uploaded) return
    imageUrl = uploaded
    imageTitle = fileOrAsset.name.replace(/\.[^/.]+$/, '') || `角色图${characterImages.value[targetIndex].length + 1}`
    source = '本地上传'
  } else if (typeof fileOrAsset === 'string') {
    // 字符串URL
    imageUrl = fileOrAsset
    imageTitle = `角色图${characterImages.value[targetIndex].length + 1}`
    source = '资源库导入'
  } else if (fileOrAsset && typeof fileOrAsset === 'object') {
    // 资产对象
    imageUrl = fileOrAsset.url || fileOrAsset.thumbnail || 'https://picsum.photos/800/450?random=' + Date.now()
    imageTitle = fileOrAsset.name?.replace(/\.[^/.]+$/, '') || `角色图${characterImages.value[targetIndex].length + 1}`
    source = '资源库导入'
  } else {
    message.error('导入失败：无效的图片数据')
    return
  }
  
  let rpsFormId: number | undefined
  let rpsImageId: number | undefined
  const characterAssetId = characterAssetIds.value[targetIndex]
  if (characterAssetId != null && Number.isFinite(Number(characterAssetId))) {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (ctx) {
      try {
        const currentImageCount = characterImages.value[targetIndex]?.length ?? 0
        const existingFormId = ensureFormIdForRpsUpdate('character', targetIndex, currentImageCount)
        if (existingFormId != null) {
          rpsFormId = existingFormId
        } else {
          const row = await userAssetRpsFormCreate({
            projectId: ctx.projectId,
            episodeId: ctx.episodeId,
            assetId: Number(characterAssetId),
            imageUrl,
            name: imageTitle,
            sourceType: mapImportSourceType(source)
          })
          applyRpsRowFormIds('character', targetIndex, row)
          const ids = characterFormIdsByIndex.value[targetIndex] ?? []
          const last = ids[ids.length - 1]
          if (last != null && Number.isFinite(Number(last))) rpsFormId = Number(last)
        }
        if (rpsFormId != null) {
          const created = await userAssetRpsFormImageCreate({
            formId: rpsFormId,
            imageUrl,
            name: imageTitle,
            sourceType: mapImportSourceType(source)
          })
          rpsImageId = resolveCreatedFormImageId(created) ?? undefined
          if (rpsImageId != null) {
            await tryUseFormImage({ imageId: rpsImageId })
          }
        }
      } catch {
        // 不阻断本地回显
      }
    }
  }

  // 添加图片到角色
  if (!characterImages.value[targetIndex]) {
    characterImages.value[targetIndex] = []
  }
  
  characterImages.value[targetIndex].push({
    id: Date.now().toString(),
    ...(rpsFormId != null ? { rpsFormId } : {}),
    ...(rpsImageId != null ? { rpsImageId } : {}),
    url: imageUrl,
    thumbnail: imageUrl,
    title: imageTitle,
    createdAt: now.toISOString(),
    source: source,
    importDate: now.toISOString(),
    angles: []
  })
  
  // 强制触发响应式更新
  characterImages.value = { ...characterImages.value }
  
  const characterName = localValue.value.characters[targetIndex]
  message.success(`已为「${characterName}」导入角色图片`)
  showImportCharacterImageModal.value = false
}

const showEditCharacterImageModal = ref(false)
const currentEditCharacterIndex = ref(-1)
const currentEditCharacterImageIndex = ref<number | null>(null)

const handleEditCharacterImage = (index: number) => {
  currentEditCharacterIndex.value = index
  currentEditCharacterImageIndex.value = null
  showEditCharacterImageModal.value = true
}

const handleEditCharacterImageWithIndex = (characterIndex: number, imageIndex: number) => {
  currentEditCharacterIndex.value = characterIndex
  currentEditCharacterImageIndex.value = imageIndex
  showEditCharacterImageModal.value = true
}

const handleCharacterImageUpdate = async (characterIndex: number, characterData: any) => {
  const characterName = localValue.value.characters[characterIndex]
  if (characterData && characterData.setting !== undefined && characterName) {
    const assetId = characterAssetIds.value[characterIndex]
    if (assetId != null) {
      try {
        const fields = buildUpdateMainPayloadFromSettingHtml(String(characterData.setting ?? ''), 'character')
        await userAssetRpsUpdateMain({
          id: Number(assetId),
          ...fields
        })
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '角色设定同步失败')
        return
      }
    }
    characterSettings.value[characterName] = {
      content: characterData.setting,
      isNew: false
    }
    characterSettings.value = { ...characterSettings.value }
  }
  if (characterData && characterData.images) {
    characterImages.value[characterIndex] = Array.isArray(characterData.images) 
      ? characterData.images.map((img: any) => ({ ...img }))
      : []
    characterImages.value = { ...characterImages.value }
  }
  if (characterData?.rpsRow) {
    applyRpsRowFormIds('character', characterIndex, characterData.rpsRow)
  }
}

const handleAutoGenerateCharacter = (index: number) => {
  const characterName = localValue.value.characters[index]
  message.info(`正在为「${characterName}」自动生成角色图（待接入实际技能/接口）`)
}

const showImportCharacterFormImageModal = ref(false)
const currentImportCharacterFormKey = ref<string>('') // "characterIndex-formIndex"

const handleImportCharacterFormImage = (characterIndex: number, formIndex: number) => {
  currentImportCharacterFormKey.value = `${characterIndex}-${formIndex}`
  showImportCharacterFormImageModal.value = true
}

const handleCharacterFormImageImport = async (fileOrAsset: File | string | any) => {
  const now = new Date()
  let imageUrl: string
  let imageTitle: string
  let source: string
  const [characterIndex, formIndex] = currentImportCharacterFormKey.value.split('-').map(Number)
  const formKey = currentImportCharacterFormKey.value
  
  // 添加图片到角色形态
  if (!characterFormImages.value[formKey]) {
    characterFormImages.value[formKey] = []
  }
  
  // 处理不同类型的导入
  if (fileOrAsset instanceof File) {
    const uploaded = await uploadImageToOssWithToast(fileOrAsset)
    if (!uploaded) return
    imageUrl = uploaded
    imageTitle = fileOrAsset.name.replace(/\.[^/.]+$/, '') || `形态图${characterFormImages.value[formKey].length + 1}`
    source = '本地上传'
  } else if (typeof fileOrAsset === 'string') {
    imageUrl = fileOrAsset
    imageTitle = `形态图${characterFormImages.value[formKey].length + 1}`
    source = '资源库导入'
  } else if (fileOrAsset && typeof fileOrAsset === 'object') {
    imageUrl = fileOrAsset.url || fileOrAsset.thumbnail || 'https://picsum.photos/800/450?random=' + Date.now()
    imageTitle = fileOrAsset.name?.replace(/\.[^/.]+$/, '') || `形态图${characterFormImages.value[formKey].length + 1}`
    source = '资源库导入'
  } else {
    message.error('导入失败：无效的图片数据')
    return
  }

  const formId = ensureFormIdForRpsUpdate('character', characterIndex, formIndex)
  let createdImageId: number | undefined
  if (formId != null) {
    try {
      const created = await userAssetRpsFormImageCreate({
        formId,
        imageUrl,
        name: imageTitle,
        sourceType: mapImportSourceType(source)
      })
      createdImageId = resolveCreatedFormImageId(created) ?? undefined
      if (createdImageId != null) {
        await tryUseFormImage({ imageId: createdImageId })
      }
    } catch {
      // 不阻断本地回显，避免用户操作丢失
    }
  }
  
  characterFormImages.value[formKey].push({
    id: Date.now().toString(),
    ...(formId != null ? { rpsFormId: formId } : {}),
    ...(createdImageId != null ? { rpsImageId: createdImageId } : {}),
    url: imageUrl,
    thumbnail: imageUrl,
    title: imageTitle,
    createdAt: now.toISOString(),
    source: source,
    importDate: now.toISOString(),
    angles: []
  })
  
  characterFormImages.value = { ...characterFormImages.value }
  
  const formName = characterForms.value[characterIndex][formIndex].name
  message.success(`已为「${formName}」导入形态图片`)
  showImportCharacterFormImageModal.value = false
}

const showEditCharacterFormImageModal = ref(false)
const currentEditCharacterFormKey = ref<string>('') // "characterIndex-formIndex"
const currentEditCharacterFormImageIndex = ref<number | null>(null)

const handleEditCharacterFormImage = (characterIndex: number, formIndex: number) => {
  currentEditCharacterFormKey.value = `${characterIndex}-${formIndex}`
  currentEditCharacterFormImageIndex.value = null
  showEditCharacterFormImageModal.value = true
}

const handleEditCharacterFormImageWithIndex = (characterIndex: number, formIndex: number, imageIndex: number) => {
  currentEditCharacterFormKey.value = `${characterIndex}-${formIndex}`
  currentEditCharacterFormImageIndex.value = imageIndex
  showEditCharacterFormImageModal.value = true
}

const handleCharacterFormImageUpdate = (formKey: string, formData: any) => {
  if (formData && formData.images) {
    characterFormImages.value[formKey] = Array.isArray(formData.images) 
      ? formData.images.map((img: any) => ({ ...img }))
      : []
    characterFormImages.value = { ...characterFormImages.value }
  }
  if (formData?.rpsRow) {
    const ci = Number(formKey.split('-')[0])
    if (Number.isFinite(ci)) applyRpsRowFormIds('character', ci, formData.rpsRow)
  }
}

const handleAutoGenerateCharacterForm = async (characterIndex: number, formIndex: number) => {
  if (isManualCharacter(characterIndex)) {
    message.info('手动添加的角色请使用「图片导入」上传配图')
    return
  }
  const form = characterForms.value[characterIndex]?.[formIndex]
  if (!form) return
  const formKey = `${characterIndex}-${formIndex}`
  const formName = form.name
  let aid = characterAssetIds.value[characterIndex]
  if (aid == null) {
    await loadPersonalAssetsForTab('character')
    aid = characterAssetIds.value[characterIndex]
  }
  if (aid == null) {
    message.warning('缺少角色资产ID，请刷新页面后重试')
    return
  }
  const formId = await resolveFormIdForAssetForm('character', characterIndex, formIndex)
  void runSingleFormGenerate({
    assetId: Number(aid),
    tab: 'character',
    formKey,
    formName,
    formId
  })
}

// 角色图片操作函数
const startEditCharacterImageTitle = (characterIndex: number, imageIndex: number, currentTitle: string) => {
  editingImageTitleIndex.value = `character-${characterIndex}-${imageIndex}`
  editingImageTitle.value = currentTitle || `角色图${imageIndex + 1}`
}

const handleCharacterImageTitleBlur = async (characterIndex: number, imageIndex: number) => {
  if (editingImageTitleIndex.value === `character-${characterIndex}-${imageIndex}` && editingImageTitle.value.trim()) {
    const images = characterImages.value[characterIndex]
    if (images && images[imageIndex]) {
      const nextTitle = editingImageTitle.value.trim()
      const ok = await syncImageTitleToRps(images[imageIndex], nextTitle)
      if (!ok) {
        editingImageTitleIndex.value = null
        editingImageTitle.value = ''
        return
      }
      images[imageIndex].title = nextTitle
      characterImages.value = { ...characterImages.value }
      message.success('角色图名称已更新')
    }
  }
  editingImageTitleIndex.value = null
  editingImageTitle.value = ''
}

const handlePreviewCharacterImageByIndex = (characterIndex: number, imageIndex: number) => {
  const images = characterImages.value[characterIndex]
  if (images && images[imageIndex] && images[imageIndex].url) {
    Modal.info({
      icon: () => null,
      title: images[imageIndex].title || `角色图${imageIndex + 1}`,
      content: h('img', {
        src: images[imageIndex].url,
        style: { width: '100%', maxHeight: '70vh', objectFit: 'contain' }
      }),
      width: '80%',
      okText: '关闭'
    })
  }
}

const handleReplaceCharacterImageByIndex = (characterIndex: number, imageIndex: number) => {
  currentImportCharacterIndex.value = characterIndex
  showImportCharacterImageModal.value = true
  // TODO: 替换指定索引的图片
}

const handleDownloadCharacterImageByIndex = (characterIndex: number, imageIndex: number) => {
  const images = characterImages.value[characterIndex]
  const img = images && images[imageIndex]
  if (img && img.url) {
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `角色图${characterIndex + 1}-${imageIndex + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  }
}

const handleDeleteCharacterImageByIndex = async (characterIndex: number, imageIndex: number) => {
  const images = characterImages.value[characterIndex]
  if (!images || images.length <= imageIndex) return
  const img = images[imageIndex]
  const imageId =
    img?.rpsImageId != null && Number.isFinite(Number(img.rpsImageId)) ? Number(img.rpsImageId) : null
  const formId =
    img?.rpsFormId != null && Number.isFinite(Number(img.rpsFormId))
      ? Number(img.rpsFormId)
      : ((characterFormIdsByIndex.value[characterIndex] ?? [])[imageIndex] ?? null)
  if (!(await tryUnuseFormImage({ imageId, formId }))) return
  images.splice(imageIndex, 1)
  characterImages.value = { ...characterImages.value }
  message.success('已取消主图展示')
  syncStep3AssetsToCreationStore()
}

// ========== 道具相关方法 ==========
// 道具名称编辑
const editingPropIndex = ref<number | null>(null)
const editingPropName = ref('')

const getPropPrefix = (name: string) => {
  const match = name.match(/^(道具\d+):/)
  return match ? match[1] + ':' : ''
}

const getPropName = (name: string) => {
  const match = name.match(/^道具\d+:\s*(.+)$/)
  return match ? match[1] : name
}

const startEditPropName = (index: number, currentName: string) => {
  editingPropIndex.value = index
  editingPropName.value = getPropName(currentName)
}

const handlePropNameBlur = async (index: number) => {
  if (editingPropIndex.value !== index || !editingPropName.value.trim()) {
    editingPropIndex.value = null
    editingPropName.value = ''
    return
  }
  const prefix = getPropPrefix(localValue.value.props[index])
  const newName = prefix ? `${prefix} ${editingPropName.value.trim()}` : editingPropName.value.trim()
  const oldName = localValue.value.props[index]
  if (newName === oldName) {
    editingPropIndex.value = null
    editingPropName.value = ''
    return
  }

  const assetId = propAssetIds.value[index]
  if (assetId != null) {
    try {
      await userAssetRpsUpdateMain({ id: assetId, name: newName })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '道具名称同步失败')
      editingPropIndex.value = null
      editingPropName.value = ''
      return
    }
  }

  const newProps = [...localValue.value.props]
  newProps[index] = newName
  update({ ...localValue.value, props: newProps })
  if (propSettings.value[oldName]) {
    propSettings.value[newName] = propSettings.value[oldName]
    delete propSettings.value[oldName]
  }
  message.success(assetId != null ? '道具名称已更新' : '道具名称已更新（仅本地）')
  editingPropIndex.value = null
  editingPropName.value = ''
}

function pendingFormCardEditKey(card: { assetId: number; assetType: TabKey }) {
  return `${card.assetType}-${card.assetId}`
}

function pendingFormCardLocalIndex(card: { assetId: number; assetType: TabKey }): number {
  if (card.assetType === 'scene') return findSceneIndexByAssetId(card.assetId)
  if (card.assetType === 'character') return findCharacterIndexByAssetId(card.assetId)
  return findPropIndexByAssetId(card.assetId)
}

function pendingFormCardPrefix(card: { assetId: number; assetType: TabKey }): string {
  const idx = pendingFormCardLocalIndex(card)
  if (idx < 0) return ''
  if (card.assetType === 'scene') return getScenePrefix(localValue.value.scenes[idx])
  if (card.assetType === 'character') return getCharacterPrefix(localValue.value.characters[idx])
  return getPropPrefix(localValue.value.props[idx])
}

function pendingFormCardEditableSuffix(card: { assetId: number; assetType: TabKey; title: string }): string {
  const idx = pendingFormCardLocalIndex(card)
  if (card.assetType === 'scene') {
    const full = idx >= 0 ? localValue.value.scenes[idx] : card.title
    return getSceneName(full)
  }
  if (card.assetType === 'character') {
    const full = idx >= 0 ? localValue.value.characters[idx] : card.title
    return getCharacterName(full)
  }
  const full = idx >= 0 ? localValue.value.props[idx] : card.title
  return getPropName(full)
}

function startEditPendingFormCardTitle(card: { assetId: number; assetType: TabKey; title: string }) {
  editingPendingFormCardKey.value = pendingFormCardEditKey(card)
  editingPendingFormTitle.value = pendingFormCardEditableSuffix(card)
}

async function handlePendingFormCardTitleBlur(card: { assetId: number; assetType: TabKey; title: string }) {
  const key = pendingFormCardEditKey(card)
  if (editingPendingFormCardKey.value !== key || !editingPendingFormTitle.value.trim()) {
    editingPendingFormCardKey.value = null
    editingPendingFormTitle.value = ''
    return
  }

  const trimmed = editingPendingFormTitle.value.trim()
  let idx = -1
  let prevFull = card.title
  let newFullName = ''

  if (card.assetType === 'scene') {
    idx = findSceneIndexByAssetId(card.assetId)
    if (idx >= 0) {
      prevFull = localValue.value.scenes[idx]
      const prefix = getScenePrefix(prevFull)
      newFullName = prefix ? `${prefix} ${trimmed}` : trimmed
    } else {
      newFullName = trimmed
      prevFull = card.title
    }
  } else if (card.assetType === 'character') {
    idx = findCharacterIndexByAssetId(card.assetId)
    if (idx >= 0) {
      prevFull = localValue.value.characters[idx]
      const prefix = getCharacterPrefix(prevFull)
      newFullName = prefix ? `${prefix} ${trimmed}` : trimmed
    } else {
      newFullName = trimmed
      prevFull = card.title
    }
  } else {
    idx = findPropIndexByAssetId(card.assetId)
    if (idx >= 0) {
      prevFull = localValue.value.props[idx]
      const prefix = getPropPrefix(prevFull)
      newFullName = prefix ? `${prefix} ${trimmed}` : trimmed
    } else {
      newFullName = trimmed
      prevFull = card.title
    }
  }

  if (newFullName === prevFull) {
    editingPendingFormCardKey.value = null
    editingPendingFormTitle.value = ''
    return
  }

  try {
    await userAssetRpsUpdateMain({ id: card.assetId, name: newFullName })
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '名称同步失败')
    editingPendingFormCardKey.value = null
    editingPendingFormTitle.value = ''
    return
  }

  creationStore.patchPendingExtractFormAssetTitle(card.assetId, card.assetType, newFullName)

  if (idx >= 0) {
    if (card.assetType === 'scene') {
      const newScenes = [...localValue.value.scenes]
      newScenes[idx] = newFullName
      update({ ...localValue.value, scenes: newScenes })
      if (sceneSettings.value[prevFull]) {
        sceneSettings.value[newFullName] = sceneSettings.value[prevFull]
        delete sceneSettings.value[prevFull]
      }
    } else if (card.assetType === 'character') {
      const newCharacters = [...localValue.value.characters]
      newCharacters[idx] = newFullName
      update({ ...localValue.value, characters: newCharacters })
      if (characterSettings.value[prevFull]) {
        characterSettings.value[newFullName] = characterSettings.value[prevFull]
        delete characterSettings.value[prevFull]
      }
    } else {
      const newProps = [...localValue.value.props]
      newProps[idx] = newFullName
      update({ ...localValue.value, props: newProps })
      if (propSettings.value[prevFull]) {
        propSettings.value[newFullName] = propSettings.value[prevFull]
        delete propSettings.value[prevFull]
      }
    }
  }

  message.success('名称已更新')
  editingPendingFormCardKey.value = null
  editingPendingFormTitle.value = ''
}

// 道具设定
const showPropSettingModal = ref(false)
const currentPropIndex = ref(-1)
const currentPropName = computed(() => {
  if (currentPropIndex.value >= 0 && currentPropIndex.value < localValue.value.props.length) {
    return localValue.value.props[currentPropIndex.value]
  }
  return ''
})
const propSettings = ref<Record<string, { content: string; isNew?: boolean }>>({})

const handleEditPropSetting = (index: number) => {
  currentPropIndex.value = index
  const propName = localValue.value.props[index]
  if (!propSettings.value[propName]) {
    propSettings.value[propName] = { content: '', isNew: true }
  }
  showPropSettingModal.value = true
}

const handleSavePropSetting = async (content: string) => {
  if (!currentPropName.value) return
  const idx = currentPropIndex.value
  const assetId = propAssetIds.value[idx]
  if (assetId != null) {
    try {
      const fields = buildUpdateMainPayloadFromSettingHtml(content, 'prop')
      await userAssetRpsUpdateMain({ id: Number(assetId), ...fields })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '道具设定同步失败')
      return
    }
  }
  propSettings.value[currentPropName.value] = {
    content,
    isNew: false
  }
  showPropSettingModal.value = false
  message.success(assetId != null ? '道具设定已保存并同步' : '道具设定已保存（仅本地）')
}

// 道具图片相关
// 道具图片数据存储：Record<道具索引, 图片数组>
const propImages = ref<Record<number, any[]>>({})
// 道具形态图片数据存储：Record<"propIndex-formIndex", 图片数组>
const propFormImages = ref<Record<string, any[]>>({})

/**
 * 主栏图 → 形态区：仅在服务端已有至少一条形态 id 时迁移，避免 forms=[] 仍出现「形态1 + 图」的幽灵数据。
 * 不在这里注入默认形态（与 rps/list 的 forms 一致，由 addCharacter/addProp 等创建）。
 */
function ensureCharacterPropFormsAndMigrateMainImages() {
  const nc = localValue.value.characters.length
  const nextCharFormImgs = { ...characterFormImages.value }
  let changed = false
  for (let i = 0; i < nc; i++) {
    const formIds = characterFormIdsByIndex.value[i] ?? []
    if (formIds.length === 0) continue
    const key = `${i}-0`
    const main = characterImages.value[i]
    const formImgs = characterFormImages.value[key]
    if (main?.length && (!formImgs || formImgs.length === 0)) {
      nextCharFormImgs[key] = main.map((x: any) => ({ ...x }))
      changed = true
    }
  }
  const np = localValue.value.props.length
  const nextPropFormImgs = { ...propFormImages.value }
  for (let i = 0; i < np; i++) {
    const formIds = propFormIdsByIndex.value[i] ?? []
    if (formIds.length === 0) continue
    const key = `${i}-0`
    const main = propImages.value[i]
    const formImgs = propFormImages.value[key]
    if (main?.length && (!formImgs || formImgs.length === 0)) {
      nextPropFormImgs[key] = main.map((x: any) => ({ ...x }))
      changed = true
    }
  }
  if (!changed) return
  characterFormImages.value = nextCharFormImgs
  propFormImages.value = nextPropFormImgs
}

watch(
  [
    () => localValue.value.characters.length,
    () => localValue.value.props.length,
    characterImages,
    propImages
  ],
  () => {
    ensureCharacterPropFormsAndMigrateMainImages()
  },
  { immediate: true, deep: true }
)

const showImportPropImageModal = ref(false)
const currentImportPropIndex = ref(-1)

const handleImportPropImage = (index: number) => {
  currentImportPropIndex.value = index
  showImportPropImageModal.value = true
}

const handlePropImageImport = async (fileOrAsset: File | string | any) => {
  const now = new Date()
  let imageUrl: string
  let imageTitle: string
  let source: string
  const targetIndex = currentImportPropIndex.value
  
  // 添加图片到道具
  if (!propImages.value[targetIndex]) {
    propImages.value[targetIndex] = []
  }
  
  // 处理不同类型的导入
  if (fileOrAsset instanceof File) {
    const uploaded = await uploadImageToOssWithToast(fileOrAsset)
    if (!uploaded) return
    imageUrl = uploaded
    imageTitle = fileOrAsset.name.replace(/\.[^/.]+$/, '') || `道具图${propImages.value[targetIndex].length + 1}`
    source = '本地上传'
  } else if (typeof fileOrAsset === 'string') {
    // 字符串URL
    imageUrl = fileOrAsset
    imageTitle = `道具图${propImages.value[targetIndex].length + 1}`
    source = '资源库导入'
  } else if (fileOrAsset && typeof fileOrAsset === 'object') {
    // 资产对象
    imageUrl = fileOrAsset.url || fileOrAsset.thumbnail || 'https://picsum.photos/800/450?random=' + Date.now()
    imageTitle = fileOrAsset.name?.replace(/\.[^/.]+$/, '') || `道具图${propImages.value[targetIndex].length + 1}`
    source = '资源库导入'
  } else {
    message.error('导入失败：无效的图片数据')
    return
  }
  
  let rpsFormId: number | undefined
  let rpsImageId: number | undefined
  const propAssetId = propAssetIds.value[targetIndex]
  if (propAssetId != null && Number.isFinite(Number(propAssetId))) {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (ctx) {
      try {
        const currentImageCount = propImages.value[targetIndex]?.length ?? 0
        const existingFormId = ensureFormIdForRpsUpdate('prop', targetIndex, currentImageCount)
        if (existingFormId != null) {
          rpsFormId = existingFormId
        } else {
          const row = await userAssetRpsFormCreate({
            projectId: ctx.projectId,
            episodeId: ctx.episodeId,
            assetId: Number(propAssetId),
            imageUrl,
            name: imageTitle,
            sourceType: mapImportSourceType(source)
          })
          applyRpsRowFormIds('prop', targetIndex, row)
          const ids = propFormIdsByIndex.value[targetIndex] ?? []
          const last = ids[ids.length - 1]
          if (last != null && Number.isFinite(Number(last))) rpsFormId = Number(last)
        }
        if (rpsFormId != null) {
          const created = await userAssetRpsFormImageCreate({
            formId: rpsFormId,
            imageUrl,
            name: imageTitle,
            sourceType: mapImportSourceType(source)
          })
          rpsImageId = resolveCreatedFormImageId(created) ?? undefined
          if (rpsImageId != null) {
            await tryUseFormImage({ imageId: rpsImageId })
          }
        }
      } catch {
        // 不阻断本地回显
      }
    }
  }

  // 添加图片到道具
  if (!propImages.value[targetIndex]) {
    propImages.value[targetIndex] = []
  }
  
  propImages.value[targetIndex].push({
    id: Date.now().toString(),
    ...(rpsFormId != null ? { rpsFormId } : {}),
    ...(rpsImageId != null ? { rpsImageId } : {}),
    url: imageUrl,
    thumbnail: imageUrl,
    title: imageTitle,
    createdAt: now.toISOString(),
    source: source,
    importDate: now.toISOString(),
    angles: []
  })
  
  // 强制触发响应式更新
  propImages.value = { ...propImages.value }
  
  const propName = localValue.value.props[targetIndex]
  message.success(`已为「${propName}」导入道具图片`)
  showImportPropImageModal.value = false
}

const showEditPropImageModal = ref(false)
const currentEditPropIndex = ref(-1)
const currentEditPropImageIndex = ref<number | null>(null)

const handleEditPropImage = (index: number) => {
  currentEditPropIndex.value = index
  currentEditPropImageIndex.value = null
  showEditPropImageModal.value = true
}

const handleEditPropImageWithIndex = (propIndex: number, imageIndex: number) => {
  currentEditPropIndex.value = propIndex
  currentEditPropImageIndex.value = imageIndex
  showEditPropImageModal.value = true
}

const handlePropImageUpdate = async (propIndex: number, propData: any) => {
  const propName = localValue.value.props[propIndex]
  if (propData && propData.setting !== undefined && propName) {
    const assetId = propAssetIds.value[propIndex]
    if (assetId != null) {
      try {
        const fields = buildUpdateMainPayloadFromSettingHtml(String(propData.setting ?? ''), 'prop')
        await userAssetRpsUpdateMain({
          id: Number(assetId),
          ...fields
        })
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '道具设定同步失败')
        return
      }
    }
    propSettings.value[propName] = {
      content: propData.setting,
      isNew: false
    }
    propSettings.value = { ...propSettings.value }
  }
  if (propData && propData.images) {
    propImages.value[propIndex] = Array.isArray(propData.images) 
      ? propData.images.map((img: any) => ({ ...img }))
      : []
    propImages.value = { ...propImages.value }
  }
  if (propData?.rpsRow) {
    applyRpsRowFormIds('prop', propIndex, propData.rpsRow)
  }
}

const handleAutoGenerateProp = (index: number) => {
  const propName = localValue.value.props[index]
  message.info(`正在为「${propName}」自动生成道具图（待接入实际技能/接口）`)
}

const showBatchGenerateModal = ref(false)
const batchGenerateType = ref<'scene' | 'character' | 'prop'>('scene')

const batchGenerateItems = computed(() => {
  if (batchGenerateType.value === 'scene') {
    return localValue.value.scenes.flatMap((name, index) => {
      if (isManualScene(index)) return []
      return [
        {
          id: `scene-${index}`,
          name,
          images: sceneImages.value[index] || [],
          hasSetting: !isHtmlContentEmpty(sceneSettings.value[name]?.content || '')
        }
      ]
    })
  }
  if (batchGenerateType.value === 'character') {
    return localValue.value.characters.flatMap((name, index) => {
      if (isManualCharacter(index)) return []
      return [
        {
          id: `character-${index}`,
          name,
          images: characterImages.value[index] || [],
          hasSetting: !isHtmlContentEmpty(characterSettings.value[name]?.content || '')
        }
      ]
    })
  }
  return localValue.value.props.flatMap((name, index) => {
    if (isManualProp(index)) return []
    return [
      {
        id: `prop-${index}`,
        name,
        images: propImages.value[index] || [],
        hasSetting: !isHtmlContentEmpty(propSettings.value[name]?.content || '')
      }
    ]
  })
})

const handleBatchGenerateConfirm = async (payload: {
  type: 'scene' | 'character' | 'prop'
  agent: string
  model: string
  resolution: string
  selectedItemIds: Array<string | number>
}) => {
  if (props.isExtracting) {
    message.warning('资产提取进行中，请完成后再批量生图')
    return
  }
  const tab: TabKey = payload.type
  const prefix = tab === 'scene' ? 'scene' : tab === 'character' ? 'character' : 'prop'
  const idMap =
    tab === 'scene'
      ? sceneFormIdsByIndex.value
      : tab === 'character'
        ? characterFormIdsByIndex.value
        : propFormIdsByIndex.value

  const formIds: number[] = []
  const seenForm = new Set<number>()
  const seenAssetIdx = new Set<number>()
  for (const rawId of payload.selectedItemIds) {
    const s = String(rawId)
    if (!s.startsWith(`${prefix}-`)) continue
    const idx = Number(s.slice(prefix.length + 1))
    if (!Number.isFinite(idx) || idx < 0) continue
    if (tab === 'scene' && isManualScene(idx)) continue
    if (tab === 'character' && isManualCharacter(idx)) continue
    if (tab === 'prop' && isManualProp(idx)) continue
    seenAssetIdx.add(idx)
    for (const id of idMap[idx] ?? []) {
      const n = Number(id)
      if (!Number.isFinite(n) || n <= 0) continue
      if (seenForm.has(n)) continue
      seenForm.add(n)
      formIds.push(n)
    }
  }

  if (!formIds.length) {
    message.warning('所选条目下没有可生成的形态，请先完成形态提取或添加形态')
    return
  }

  const modelFromModal = String(payload.model || '').trim()
  if (modelFromModal) {
    creationStore.updateExtractImageModelCodes({ [tab]: modelFromModal })
  }

  const imageFields = await resolveFormImageApiSubmitFields(tab, {
    modelFromModal: payload.model,
    resolutionFromModal: payload.resolution,
    agentFromModal: payload.agent
  })

  try {
    const submit = await userAssetExtractFormGenerateImage({
      formIds,
      agentCode: imageFields.agentCode,
      ...(imageFields.modelCode ? { modelCode: imageFields.modelCode } : {}),
      ...(imageFields.resolution ? { resolution: imageFields.resolution } : {}),
      ...(imageFields.aspectRatio ? { aspectRatio: imageFields.aspectRatio } : {})
    })
    const taskId = extractFormGenerateImageSubmitTaskId(submit)
    if (!taskId) {
      message.error('批量生图任务提交失败：未返回任务ID')
      return
    }
    const typeLabel = tab === 'scene' ? '场景图' : tab === 'character' ? '角色图' : '道具图'
    message.success(`已提交 ${formIds.length} 个形态的${typeLabel}批量生成任务`)
    void startTrackTask({
      taskId,
      taskType: 'form_image_batch',
      tab
    })
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '批量生图提交失败')
  }
}

// 道具形态管理
const editingPropFormIndex = ref<string | null>(null)
const editingPropFormName = ref('')

const getPropFormPrefix = (name: string) => {
  const match = name.match(/^(形态\d+):/)
  return match ? match[1] + ':' : ''
}

const getPropFormName = (name: string) => {
  const match = name.match(/^形态\d+:\s*(.+)$/)
  return match ? match[1] : name
}

const startEditPropFormName = (propIndex: number, formIndex: number, currentName: string) => {
  editingPropFormIndex.value = `${propIndex}-${formIndex}`
  editingPropFormName.value = getPropFormName(currentName)
}

const handlePropFormNameBlur = async (propIndex: number, formIndex: number) => {
  if (editingPropFormIndex.value !== `${propIndex}-${formIndex}` || !editingPropFormName.value.trim()) {
    editingPropFormIndex.value = null
    editingPropFormName.value = ''
    return
  }
  const prev = propForms.value[propIndex][formIndex].name
  const prefix = getPropFormPrefix(prev)
  const newName = prefix ? `${prefix} ${editingPropFormName.value.trim()}` : editingPropFormName.value.trim()
  if (newName === prev) {
    editingPropFormIndex.value = null
    editingPropFormName.value = ''
    return
  }

  const assetId = propAssetIds.value[propIndex]
  if (assetId != null) {
    const formId = ensureFormIdForRpsUpdate('prop', propIndex, formIndex)
    if (formId == null) {
      message.error('无法同步形态名称：请先在「编辑形态图」弹窗中上传、从资产库导入或通过 AI 生成图片以创建形态')
      editingPropFormIndex.value = null
      editingPropFormName.value = ''
      return
    }
    try {
      await userAssetRpsUpdateForm({ id: formId, name: newName })
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '形态名称同步失败')
      editingPropFormIndex.value = null
      editingPropFormName.value = ''
      return
    }
  }

  propForms.value[propIndex][formIndex].name = newName
  message.success(assetId != null ? '形态名称已更新' : '形态名称已更新（仅本地）')
  editingPropFormIndex.value = null
  editingPropFormName.value = ''
}

const handleAddPropForm = async (propIndex: number) => {
  if (!propForms.value[propIndex]) {
    propForms.value[propIndex] = []
  }
  const formCount = propForms.value[propIndex].length + 1
  const formName = `形态${formCount}: 未命名`
  const aid = propAssetIds.value[propIndex]
  if (aid != null && Number.isFinite(Number(aid))) {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (ctx) {
      try {
        const row = await userAssetRpsFormCreate({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          assetId: Number(aid),
          imageUrl: '',
          name: formName,
          sourceType: 'official'
        })
        applyRpsRowFormIds('prop', propIndex, row)
        if (aid != null) await syncAssetFormIdsFromServer('prop', propIndex, Number(aid), row)
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '新增形态失败')
        return
      }
    }
  }
  const fi = propForms.value[propIndex].length
  propForms.value[propIndex].push({ name: formName })
  const formKey = `${propIndex}-${fi}`
  propFormGenerationStatus.value = { ...propFormGenerationStatus.value, [formKey]: 'idle' }
  creationStore.setPropFormGenerationStatus(formKey, 'idle')
  message.success('形态已添加')
}

const handleCopyPropForm = (propIndex: number, formIndex: number) => {
  const form = propForms.value[propIndex][formIndex]
  const newForm = {
    name: form.name.replace(/形态\d+/, (match) => {
      const num = parseInt(match.replace('形态', '')) || 1
      return `形态${propForms.value[propIndex].length + 1}`
    })
  }
  propForms.value[propIndex].push(newForm)
  message.success('形态已复制')
}

const handleDeletePropForm = (propIndex: number, formIndex: number) => {
  Modal.confirm({
    title: '确认删除形态?',
    content: '删除后将无法恢复。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const aid = propAssetIds.value[propIndex]
      const formIds = propFormIdsByIndex.value[propIndex] ?? []
      const fid = formIds[formIndex]
      try {
        if (aid != null && fid != null) {
          await rpsDeleteSingleForm(aid, fid)
        } else if (aid != null) {
          message.warning('未找到服务端形态 ID，已仅从界面移除')
        }
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '删除形态失败')
        throw e
      }

      propForms.value[propIndex].splice(formIndex, 1)
      propForms.value[propIndex].forEach((form, index) => {
        const match = form.name.match(/^(形态\d+):\s*(.+)$/)
        if (match) {
          form.name = `形态${index + 1}: ${match[2]}`
        }
      })

      const newIds = [...formIds]
      newIds.splice(formIndex, 1)
      propFormIdsByIndex.value = { ...propFormIdsByIndex.value, [propIndex]: newIds }

      const next: Record<string, any[]> = {}
      for (const k of Object.keys(propFormImages.value)) {
        const [c, f] = k.split('-').map(Number)
        if (c !== propIndex) {
          next[k] = propFormImages.value[k]
        } else if (f === formIndex) {
          continue
        } else if (f > formIndex) {
          next[`${c}-${f - 1}`] = propFormImages.value[k]
        } else {
          next[k] = propFormImages.value[k]
        }
      }
      propFormImages.value = next

      message.success('形态已删除')
    }
  })
}

const showImportPropFormImageModal = ref(false)
const currentImportPropFormKey = ref<string>('') // "propIndex-formIndex"

const handleImportPropFormImage = (propIndex: number, formIndex: number) => {
  currentImportPropFormKey.value = `${propIndex}-${formIndex}`
  showImportPropFormImageModal.value = true
}

const handlePropFormImageImport = async (fileOrAsset: File | string | any) => {
  const now = new Date()
  let imageUrl: string
  let imageTitle: string
  let source: string
  const [propIndex, formIndex] = currentImportPropFormKey.value.split('-').map(Number)
  const formKey = currentImportPropFormKey.value
  
  // 添加图片到道具形态
  if (!propFormImages.value[formKey]) {
    propFormImages.value[formKey] = []
  }
  
  // 处理不同类型的导入
  if (fileOrAsset instanceof File) {
    const uploaded = await uploadImageToOssWithToast(fileOrAsset)
    if (!uploaded) return
    imageUrl = uploaded
    imageTitle = fileOrAsset.name.replace(/\.[^/.]+$/, '') || `形态图${propFormImages.value[formKey].length + 1}`
    source = '本地上传'
  } else if (typeof fileOrAsset === 'string') {
    imageUrl = fileOrAsset
    imageTitle = `形态图${propFormImages.value[formKey].length + 1}`
    source = '资源库导入'
  } else if (fileOrAsset && typeof fileOrAsset === 'object') {
    imageUrl = fileOrAsset.url || fileOrAsset.thumbnail || 'https://picsum.photos/800/450?random=' + Date.now()
    imageTitle = fileOrAsset.name?.replace(/\.[^/.]+$/, '') || `形态图${propFormImages.value[formKey].length + 1}`
    source = '资源库导入'
  } else {
    message.error('导入失败：无效的图片数据')
    return
  }

  const formId = ensureFormIdForRpsUpdate('prop', propIndex, formIndex)
  let createdImageId: number | undefined
  if (formId != null) {
    try {
      const created = await userAssetRpsFormImageCreate({
        formId,
        imageUrl,
        name: imageTitle,
        sourceType: mapImportSourceType(source)
      })
      createdImageId = resolveCreatedFormImageId(created) ?? undefined
      if (createdImageId != null) {
        await tryUseFormImage({ imageId: createdImageId })
      }
    } catch {
      // 不阻断本地回显，避免用户操作丢失
    }
  }
  
  propFormImages.value[formKey].push({
    id: Date.now().toString(),
    ...(formId != null ? { rpsFormId: formId } : {}),
    ...(createdImageId != null ? { rpsImageId: createdImageId } : {}),
    url: imageUrl,
    thumbnail: imageUrl,
    title: imageTitle,
    createdAt: now.toISOString(),
    source: source,
    importDate: now.toISOString(),
    angles: []
  })
  
  propFormImages.value = { ...propFormImages.value }
  
  const formName = propForms.value[propIndex][formIndex].name
  message.success(`已为「${formName}」导入形态图片`)
  showImportPropFormImageModal.value = false
}

const showEditPropFormImageModal = ref(false)
const currentEditPropFormKey = ref<string>('') // "propIndex-formIndex"
const currentEditPropFormImageIndex = ref<number | null>(null)

const handleEditPropFormImage = (propIndex: number, formIndex: number) => {
  currentEditPropFormKey.value = `${propIndex}-${formIndex}`
  currentEditPropFormImageIndex.value = null
  showEditPropFormImageModal.value = true
}

const handleEditPropFormImageWithIndex = (propIndex: number, formIndex: number, imageIndex: number) => {
  currentEditPropFormKey.value = `${propIndex}-${formIndex}`
  currentEditPropFormImageIndex.value = imageIndex
  showEditPropFormImageModal.value = true
}

const handlePropFormImageUpdate = (formKey: string, formData: any) => {
  if (formData && formData.images) {
    propFormImages.value[formKey] = Array.isArray(formData.images) 
      ? formData.images.map((img: any) => ({ ...img }))
      : []
    propFormImages.value = { ...propFormImages.value }
  }
  if (formData?.rpsRow) {
    const pi = Number(formKey.split('-')[0])
    if (Number.isFinite(pi)) applyRpsRowFormIds('prop', pi, formData.rpsRow)
  }
}

const handleAutoGeneratePropForm = async (propIndex: number, formIndex: number) => {
  if (isManualProp(propIndex)) {
    message.info('手动添加的道具请使用「图片导入」上传配图')
    return
  }
  const form = propForms.value[propIndex]?.[formIndex]
  if (!form) return
  const formKey = `${propIndex}-${formIndex}`
  const formName = form.name
  let aid = propAssetIds.value[propIndex]
  if (aid == null) {
    await loadPersonalAssetsForTab('prop')
    aid = propAssetIds.value[propIndex]
  }
  if (aid == null) {
    message.warning('缺少道具资产ID，请刷新页面后重试')
    return
  }
  const formId = await resolveFormIdForAssetForm('prop', propIndex, formIndex)
  void runSingleFormGenerate({
    assetId: Number(aid),
    tab: 'prop',
    formKey,
    formName,
    formId
  })
}

// 角色形态图片操作函数
const startEditCharacterFormImageTitle = (characterIndex: number, formIndex: number, imageIndex: number, currentTitle: string) => {
  editingImageTitleIndex.value = `character-form-${characterIndex}-${formIndex}-${imageIndex}`
  editingImageTitle.value = currentTitle || `形态图${imageIndex + 1}`
}

const handleCharacterFormImageTitleBlur = async (characterIndex: number, formIndex: number, imageIndex: number) => {
  const formKey = `${characterIndex}-${formIndex}`
  if (editingImageTitleIndex.value === `character-form-${characterIndex}-${formIndex}-${imageIndex}` && editingImageTitle.value.trim()) {
    const images = characterFormImages.value[formKey]
    if (images && images[imageIndex]) {
      const nextTitle = editingImageTitle.value.trim()
      const ok = await syncImageTitleToRps(images[imageIndex], nextTitle)
      if (!ok) {
        editingImageTitleIndex.value = null
        editingImageTitle.value = ''
        return
      }
      images[imageIndex].title = nextTitle
      characterFormImages.value = { ...characterFormImages.value }
      message.success('形态图名称已更新')
    }
  }
  editingImageTitleIndex.value = null
  editingImageTitle.value = ''
}

const handlePreviewCharacterFormImageByIndex = (characterIndex: number, formIndex: number, imageIndex: number) => {
  const formKey = `${characterIndex}-${formIndex}`
  const images = characterFormImages.value[formKey]
  if (images && images[imageIndex] && images[imageIndex].url) {
    Modal.info({
      icon: () => null,
      title: images[imageIndex].title || `形态图${imageIndex + 1}`,
      content: h('img', {
        src: images[imageIndex].url,
        style: { width: '100%', maxHeight: '70vh', objectFit: 'contain' }
      }),
      width: '80%',
      okText: '关闭'
    })
  }
}

const handleReplaceCharacterFormImageByIndex = (characterIndex: number, formIndex: number, imageIndex: number) => {
  currentImportCharacterFormKey.value = `${characterIndex}-${formIndex}`
  showImportCharacterFormImageModal.value = true
  // TODO: 替换指定索引的图片
}

const handleDownloadCharacterFormImageByIndex = (characterIndex: number, formIndex: number, imageIndex: number) => {
  const formKey = `${characterIndex}-${formIndex}`
  const images = characterFormImages.value[formKey]
  const img = images && images[imageIndex]
  if (img && img.url) {
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `形态图${characterIndex + 1}-${formIndex + 1}-${imageIndex + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  }
}

const handleDeleteCharacterFormImageByIndex = async (characterIndex: number, formIndex: number, imageIndex: number) => {
  const formKey = `${characterIndex}-${formIndex}`
  const images = characterFormImages.value[formKey]
  if (!images || images.length <= imageIndex) return
  const img = images[imageIndex]
  const imageId =
    img?.rpsImageId != null && Number.isFinite(Number(img.rpsImageId)) ? Number(img.rpsImageId) : null
  const formId =
    img?.rpsFormId != null && Number.isFinite(Number(img.rpsFormId))
      ? Number(img.rpsFormId)
      : ensureFormIdForRpsUpdate('character', characterIndex, formIndex)
  if (!(await tryUnuseFormImage({ imageId, formId }))) return
  images.splice(imageIndex, 1)
  characterFormImages.value = { ...characterFormImages.value }
  message.success('已取消主图展示')
  syncStep3AssetsToCreationStore()
}

// 道具形态图片操作函数
const startEditPropFormImageTitle = (propIndex: number, formIndex: number, imageIndex: number, currentTitle: string) => {
  editingImageTitleIndex.value = `prop-form-${propIndex}-${formIndex}-${imageIndex}`
  editingImageTitle.value = currentTitle || `形态图${imageIndex + 1}`
}

const handlePropFormImageTitleBlur = async (propIndex: number, formIndex: number, imageIndex: number) => {
  const formKey = `${propIndex}-${formIndex}`
  if (editingImageTitleIndex.value === `prop-form-${propIndex}-${formIndex}-${imageIndex}` && editingImageTitle.value.trim()) {
    const images = propFormImages.value[formKey]
    if (images && images[imageIndex]) {
      const nextTitle = editingImageTitle.value.trim()
      const ok = await syncImageTitleToRps(images[imageIndex], nextTitle)
      if (!ok) {
        editingImageTitleIndex.value = null
        editingImageTitle.value = ''
        return
      }
      images[imageIndex].title = nextTitle
      propFormImages.value = { ...propFormImages.value }
      message.success('形态图名称已更新')
    }
  }
  editingImageTitleIndex.value = null
  editingImageTitle.value = ''
}

const handlePreviewPropFormImageByIndex = (propIndex: number, formIndex: number, imageIndex: number) => {
  const formKey = `${propIndex}-${formIndex}`
  const images = propFormImages.value[formKey]
  if (images && images[imageIndex] && images[imageIndex].url) {
    Modal.info({
      icon: () => null,
      title: images[imageIndex].title || `形态图${imageIndex + 1}`,
      content: h('img', {
        src: images[imageIndex].url,
        style: { width: '100%', maxHeight: '70vh', objectFit: 'contain' }
      }),
      width: '80%',
      okText: '关闭'
    })
  }
}

const handleReplacePropFormImageByIndex = (propIndex: number, formIndex: number, imageIndex: number) => {
  currentImportPropFormKey.value = `${propIndex}-${formIndex}`
  showImportPropFormImageModal.value = true
  // TODO: 替换指定索引的图片
}

const handleDownloadPropFormImageByIndex = (propIndex: number, formIndex: number, imageIndex: number) => {
  const formKey = `${propIndex}-${formIndex}`
  const images = propFormImages.value[formKey]
  const img = images && images[imageIndex]
  if (img && img.url) {
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `形态图${propIndex + 1}-${formIndex + 1}-${imageIndex + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  }
}

const handleDeletePropFormImageByIndex = async (propIndex: number, formIndex: number, imageIndex: number) => {
  const formKey = `${propIndex}-${formIndex}`
  const images = propFormImages.value[formKey]
  if (!images || images.length <= imageIndex) return
  const img = images[imageIndex]
  const imageId =
    img?.rpsImageId != null && Number.isFinite(Number(img.rpsImageId)) ? Number(img.rpsImageId) : null
  const formId =
    img?.rpsFormId != null && Number.isFinite(Number(img.rpsFormId))
      ? Number(img.rpsFormId)
      : ensureFormIdForRpsUpdate('prop', propIndex, formIndex)
  if (!(await tryUnuseFormImage({ imageId, formId }))) return
  images.splice(imageIndex, 1)
  propFormImages.value = { ...propFormImages.value }
  message.success('已取消主图展示')
  syncStep3AssetsToCreationStore()
}

// 道具图片操作函数
const startEditPropImageTitle = (propIndex: number, imageIndex: number, currentTitle: string) => {
  editingImageTitleIndex.value = `prop-${propIndex}-${imageIndex}`
  editingImageTitle.value = currentTitle || `道具图${imageIndex + 1}`
}

const handlePropImageTitleBlur = (propIndex: number, imageIndex: number) => {
  if (editingImageTitleIndex.value === `prop-${propIndex}-${imageIndex}` && editingImageTitle.value.trim()) {
    const images = propImages.value[propIndex]
    if (images && images[imageIndex]) {
      images[imageIndex].title = editingImageTitle.value.trim()
      propImages.value = { ...propImages.value }
      message.success('道具图名称已更新')
    }
  }
  editingImageTitleIndex.value = null
  editingImageTitle.value = ''
}

const handlePreviewPropImageByIndex = (propIndex: number, imageIndex: number) => {
  const images = propImages.value[propIndex]
  if (images && images[imageIndex] && images[imageIndex].url) {
    Modal.info({
      icon: () => null,
      title: images[imageIndex].title || `道具图${imageIndex + 1}`,
      content: h('img', {
        src: images[imageIndex].url,
        style: { width: '100%', maxHeight: '70vh', objectFit: 'contain' }
      }),
      width: '80%',
      okText: '关闭'
    })
  }
}

const handleReplacePropImageByIndex = (propIndex: number, imageIndex: number) => {
  currentImportPropIndex.value = propIndex
  showImportPropImageModal.value = true
  // TODO: 替换指定索引的图片
}

const handleDownloadPropImageByIndex = (propIndex: number, imageIndex: number) => {
  const images = propImages.value[propIndex]
  const img = images && images[imageIndex]
  if (img && img.url) {
    const link = document.createElement('a')
    link.href = img.url
    link.download = img.title || `道具图${propIndex + 1}-${imageIndex + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('图片下载中...')
  }
}

const handleDeletePropImageByIndex = async (propIndex: number, imageIndex: number) => {
  const images = propImages.value[propIndex]
  if (!images || images.length <= imageIndex) return
  const img = images[imageIndex]
  const imageId =
    img?.rpsImageId != null && Number.isFinite(Number(img.rpsImageId)) ? Number(img.rpsImageId) : null
  const formId =
    img?.rpsFormId != null && Number.isFinite(Number(img.rpsFormId))
      ? Number(img.rpsFormId)
      : ((propFormIdsByIndex.value[propIndex] ?? [])[imageIndex] ?? null)
  if (!(await tryUnuseFormImage({ imageId, formId }))) return
  images.splice(imageIndex, 1)
  propImages.value = { ...propImages.value }
  message.success('已取消主图展示')
  syncStep3AssetsToCreationStore()
}

/** 第三步图片/形态写入 Pinia，第四步/第五步「本作品资产」弹窗从此读取 */
let syncingStep3ToStore = false

function numRecordClone(rec: Record<number, any[]>): Record<number, any[]> {
  const o: Record<number, any[]> = {}
  for (const k of Object.keys(rec)) {
    const arr = (rec as Record<number, any[]>)[Number(k)]
    if (Array.isArray(arr)) o[Number(k)] = arr.map((x: any) => ({ ...x }))
  }
  return o
}

function strRecordClone(rec: Record<string, any[]>): Record<string, any[]> {
  const o: Record<string, any[]> = {}
  for (const k of Object.keys(rec)) {
    if (Array.isArray(rec[k])) o[k] = rec[k].map((x: any) => ({ ...x }))
  }
  return o
}

function formsNumClone<T extends { name: string }>(rec: Record<number, T[]>): Record<number, T[]> {
  const o: Record<number, T[]> = {}
  for (const k of Object.keys(rec)) {
    o[Number(k)] = (rec[Number(k)] || []).map((f) => ({ ...f }))
  }
  return o
}

function syncStep3AssetsToCreationStore() {
  creationStore.$patch({
    sceneImages: numRecordClone(sceneImages.value),
    characterImages: numRecordClone(characterImages.value),
    propImages: numRecordClone(propImages.value),
    characterForms: formsNumClone(characterForms.value),
    propForms: formsNumClone(propForms.value),
    characterFormImages: strRecordClone(characterFormImages.value),
    propFormImages: strRecordClone(propFormImages.value)
  })
}

/** rps/list 拉取成功后写入 Pinia，覆盖内存中可能残留的旧形态/旧图，与接口「forms:[]」等保持一致 */
function syncStep3AfterApiLoad() {
  syncingStep3ToStore = true
  try {
    syncStep3AssetsToCreationStore()
  } finally {
    syncingStep3ToStore = false
  }
}

watch(
  [
    sceneImages,
    characterImages,
    propImages,
    characterForms,
    propForms,
    characterFormImages,
    propFormImages
  ],
  () => {
    if (syncingStep3ToStore) return
    syncStep3AssetsToCreationStore()
  },
  { deep: true }
)
</script>

<style lang="scss" scoped>
.scp-root {
  display: flex;
  flex-direction: column;
  gap: .8rem;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.scp-topbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  border-radius: var(--radius-xl);
}

.scp-topbar-hint {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--home-muted, #8e97a5);
  text-align: left;
}

.scp-topbar__right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-shrink: 0;
  margin-left: auto;
  .scp-topbar-task-btn {
    position: relative;
    height: 32px;
    border-radius: 8px;
    border:1px solid #2F3949 !important;
    background: rgba(18, 22, 30, 0.95) !important;
    color: rgba(255, 255, 255, 0.88);
  }

  .scp-topbar-task-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    margin-left: 8px;
    background: rgba(74, 231, 253, 0.18);
    border: 1px solid rgba(74, 231, 253, 0.35);
    color: #4ae7fd;
    font-size: 12px;
    line-height: 18px;
    font-weight: 600;
  }

  .scp-topbar-add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border-color: #2F3949 !important;
  background: rgba(18, 22, 30, 0.95) !important;
  color: var(--home-text, #e6edf3);
  }
  
  .scp-topbar-batch-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    background: #4AE7FD !important;
    color:#121212 !important;
    img{
      width: 16px;
      height: 16px;
    }
    }

  .scp-topbar-ops-btn__arrow {
    margin-left: 2px;
    font-size: 10px;
    line-height: 1;
    transition: transform 0.2s ease;
  }

  .scp-topbar-ops-btn__arrow--open {
    transform: rotate(180deg);
  }
}

.scp-topbar-ops-panel {
  min-width: 196px;
  padding: 8px 10px 10px;
  border-radius: 12px;
  background: rgba(17, 22, 33, 1);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}

.scp-topbar-ops-panel__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scp-topbar-ops-panel__item-wrap {
  display: block;
  width: 100%;
}

.scp-topbar-ops-panel__item {
  width: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  padding: 8px 10px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
  text-align: left;
}

.scp-topbar-ops-panel__item :deep(.anticon) {
  font-size: 16px;
  color: #8e97a5;
  flex-shrink: 0;
  transition: color 0.18s ease;
}

.scp-topbar-ops-panel__item:hover:not(:disabled) {
  background: rgba(32, 36, 52, 1);
}

.scp-topbar-ops-panel__item:hover:not(:disabled) :deep(.anticon) {
  color: rgba(255, 255, 255, 0.88);
}

.scp-topbar-ops-panel__item--disabled,
.scp-topbar-ops-panel__item:disabled {
  color: rgba(255, 255, 255, 0.35);
  cursor: not-allowed;
  text-decoration: line-through;
}

.scp-topbar-ops-panel__item--disabled :deep(.anticon),
.scp-topbar-ops-panel__item:disabled :deep(.anticon) {
  color: rgba(142, 151, 165, 0.45);
}

.scp-topbar-ops-panel__item--danger {
  color: #ffc9c9;
}

.scp-topbar-ops-panel__item--danger :deep(.anticon) {
  color: rgba(255, 180, 180, 0.85);
}

.scp-topbar-ops-panel__item--danger:hover:not(:disabled) {
  background: rgba(32, 36, 52, 1);
  color: #ffe0e0;
}

.scp-topbar-ops-panel__item--danger:hover:not(:disabled) :deep(.anticon) {
  color: #ffb4b4;
}




.scp-topbar-add-btn:hover:not(:disabled) {
  border-color: rgba(74, 231, 253, 0.55);
  color: var(--home-cyan, #4ae7fd);
}


.scp-topbar-add-btn__ico-wrap {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}

.scp-topbar-add-btn__ico {
  position: absolute;
  left: 0;
  top: 0;
  width: 16px;
  height: 16px;
  display: block;
  object-fit: contain;
  object-position: center;
  pointer-events: none;
  transition: opacity 0.22s ease;
}

/* a-button 内部多一层包裹，scoped 需 :deep 才能命中图标 */
.scp-topbar-add-btn :deep(.scp-topbar-add-btn__ico--nor) {
  opacity: 1;
}

.scp-topbar-add-btn :deep(.scp-topbar-add-btn__ico--sel) {
  opacity: 0;
}

.scp-topbar-add-btn:hover:not(:disabled) :deep(.scp-topbar-add-btn__ico--nor) {
  opacity: 0;
}

.scp-topbar-add-btn:hover:not(:disabled) :deep(.scp-topbar-add-btn__ico--sel) {
  opacity: 1;
}

/* 药丸分段 Tab：深底 + 选中段纯色青底黑字 */
.scp-tabs {
  display: flex;
  align-items: stretch;
  flex: 0 0 auto;
  min-width: 0;
  max-width: 240px;
  gap: 0;
  height: 28px;
  background: rgba(32,36,52,.5);
  border: none;
  border-radius: 8px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.scp-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex: 1 1 0;
  width: 5rem;
  padding: 6px 0.75rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
  color: #8E97A5;
  /* 字号见 assets/css/scp-step-shared.css */
}

.scp-tab:hover:not(.disabled):not(.active) {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.scp-tab.active {
  background: #202434;
  color: #ffff;
  box-shadow: none;
  font-weight: 600;
}

.scp-tab.disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.scp-tab-loading {
  font-size: 0.95rem;
  flex-shrink: 0;
}

.scp-tab:not(.active) .scp-tab-loading {
  color: rgba(255, 255, 255, 0.92);
}

.scp-tab.active .scp-tab-loading {
  color: #ffffff;
}

.scp-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  .btn-primary{
     background: #121212 !important;
     border: 1px solid rgba(74, 231, 253, 0.55) !important;
  }
  .btn-primary:hover{
    background: #121212 !important;
    border: 1px solid rgba(74, 231, 253, 0.55) !important;
  }
}

.scp-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.scp-task-restore-banner {
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid rgba(74, 231, 253, 0.22);
  background: rgba(18, 22, 30, 0.6);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
  line-height: 18px;
}

.scp-task-restore-banner__text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scp-task-panel {
  width: 360px;
  max-width: 72vw;
  padding: 6px;
}

.scp-task-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 6px 10px;
}

.scp-task-panel__title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
}

.scp-task-panel__empty {
  padding: 14px 8px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
}

.scp-task-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scp-task-panel__item {
  width: 100%;
  text-align: left;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.18);
  background: rgba(18, 22, 30, 0.6);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all var(--transition-base);
}

.scp-task-panel__item:hover {
  border-color: rgba(74, 231, 253, 0.45);
  background: rgba(14, 89, 250, 0.12);
}

.scp-task-panel__item.active {
  border-color: rgba(74, 231, 253, 0.65);
  background: rgba(14, 89, 250, 0.18);
}

.scp-task-panel__item-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 600;
  font-size: 13px;
}

.scp-task-panel__item-status {
  font-weight: 600;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
}

.scp-task-panel__item-sub {
  margin-top: 6px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.asset-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.asset-section--bootstrap-pending {
  position: relative;
}

.scp-asset-bootstrap-mask {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: rgba(8, 14, 26, 0.97);
  backdrop-filter: blur(6px);
  border-radius: var(--radius-m, 10px);
  pointer-events: auto;
}

.scp-asset-bootstrap-mask__icon {
  font-size: 28px;
  color: var(--home-accent, #4ae7fd);
}

.scp-asset-bootstrap-mask__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.75);
}

.asset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.asset-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--home-text, #e6edf3);
}

/* 场景 / 角色 / 道具 — 空数据展示（对齐创作页深蓝青主题） */
.scp-asset-empty {
  position: relative;
  flex: 1;
  align-self: stretch;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 0;
  padding: 2.5rem 1.5rem;
  border-radius: var(--radius-m);
  overflow: hidden;
  border:1px dashed rgba(74, 231, 253, 0.30);
}



.scp-asset-empty--character {
  box-shadow: inset 0 1px 0 rgba(74, 231, 253, 0.06);
}

.scp-asset-empty--prop {
  box-shadow: inset 0 1px 0 rgba(74, 231, 253, 0.06);
}

.scp-asset-empty__grid {
  position: absolute;
  inset: 0;
  opacity: 0.4;
  //background-image:
  //  linear-gradient(rgba(74, 231, 253, 0.05) 1px, transparent 1px),
  //  linear-gradient(90deg, rgba(74, 231, 253, 0.05) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse 70% 65% at 50% 45%, #000 20%, transparent 72%);
  pointer-events: none;
}

.scp-asset-empty__icon-wrap {
  position: relative;
  z-index: 1;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}
.tips{
      color: #8E97A5;
      margin-bottom: 12px;
  }
.scp-asset-empty__icon {
  font-size: 2.35rem;
  color: #4ae7fd;
}

.scp-asset-empty__title {
  position: relative;
  z-index: 1;
  margin: 0 0 0.65rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  letter-spacing: 0.02em;
}

.scp-asset-empty__desc {
  position: relative;
  z-index: 1;
  margin: 0;
  max-width: 520px;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--home-muted, #8e97a5);
}

.scp-asset-empty__hint {
  position: relative;
  z-index: 1;
  margin-top: 1.35rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  line-height: 1.45;
  color: rgba(74, 231, 253, 0.88);
  background: rgba(74, 231, 253, 0.08);
  border: 1px solid rgba(74, 231, 253, 0.2);
  max-width: min(100%, 480px);
  text-align: left;
}

.scp-asset-empty__hint-ico {
  flex-shrink: 0;
  font-size: 0.95rem;
  color: #4ae7fd;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(74, 231, 253, 0.2);
  border-radius: var(--radius-full);
  background: rgba(18, 22, 30, 0.85);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.chip-text {
  color: var(--home-text, #e6edf3);
  font-weight: 600;
}

.chip-remove {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid rgba(74, 231, 253, 0.22);
  background: rgba(6, 10, 18, 0.6);
  color: var(--home-muted, #8e97a5);
  cursor: pointer;
  transition: all var(--transition-base);
  line-height: 18px;
}

.chip-remove:hover {
  border-color: rgba(74, 231, 253, 0.5);
  color: var(--home-cyan, #4ae7fd);
  background: rgba(14, 89, 250, 0.15);
}

/* 提取中状态 */
.extracting-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1.5rem;
}

.extracting-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  text-align: center;
  max-width: min(560px, 92vw);
  line-height: 1.45;
  word-break: break-word;
}

.extracting-subtitle {
  margin-top: -0.5rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: rgba(255, 255, 255, 0.72);
  text-align: center;
  max-width: 520px;
}

.extracting-actions {
  display: flex;
  gap: 0.75rem;
}

.extracting-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.extracting-placeholder-image {
  width: 200px;
  max-width: 42vw;
  height: auto;
  object-fit: contain;
}


@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 场景生成界面 */
.scene-generation-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 场景卡片容器 */
.scene-cards-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 自动提取的场景：网格布局，定宽展示（列宽见 scp-step-shared.css） */
.scene-cards-auto {
  display: grid;
  gap: 1.25rem;
}
.scene-card-list{
  display: flex;
  flex-wrap: wrap;
  gap:10px;
  padding: 0 12px;
}

/* 手动场景已有图片时，卡片宽度与自动场景卡片一致 */
.scene-card-list > .scene-card-auto {
  width: 24.4%;
  flex-shrink: 0;
  padding: 8px 0;
  margin-top: 4px;
}
/* 手动添加的场景：单列布局，每个项目占满一行 */
.scene-cards-manual {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* 手动场景的包装器：占满一行，垂直布局 */
.scene-card-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid rgba(74, 231, 253, 0.30);
  background: #070d17;
  border-radius: 8px;
  overflow: hidden;
}

/* 失败场景在网格布局中占满整行 */
.scene-cards-auto > .scene-card-wrapper {
  grid-column: 1 / -1;
}

/* 头部横条：占满一行，左侧标题，右侧按钮 */
.scene-card-header-bar {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(74, 231, 253, 0.30);
}
/* 场景内容区与角色/道具保持一致：放到外层容器内 */
.scene-card-wrapper .scene-card-failed {
  padding: 0.75rem;
  background: #080d14;
}

/* 手动场景的卡片：定宽见 scp-step-shared.css --scp-card-width */
.scene-card-manual {
  flex-shrink: 0;
}

/* 场景名称编辑相关 */
.scene-card-title-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}

.scene-card-title-prefix {
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  white-space: nowrap;
}

.scene-card-title-editable {
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  cursor: pointer;
  padding: 0.25rem 0.5rem .25rem 0;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  //flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scene-card-title-editable:hover {
  background: rgba(14, 89, 250, 0.12);
  color: var(--home-cyan, #4ae7fd);
}

.scene-name-input {
  // flex: 1;
  min-width: 240px;
  width: 0;
}

.image-title-input {
  flex: 1;
  min-width: 0;
}

.scene-card-actions-header {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  flex-shrink: 0;
  align-items: center;
  button{
    border: 1px solid #2F3949 !important;
  }
}

.scene-card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  gap: 0.75rem;
  width: 100%;
}

/* 场景卡片基础样式 */
.scene-card {
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  transition: all 0.2s ease;
  position: relative;
}

.scene-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  border-color: rgba(74, 231, 253, 0.35);
}

.scene-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

/* 自动场景/角色/道具：对齐设计稿的头部横条 + 中部双操作块布局 */
.scene-card-auto {
  position: relative;
  padding: 0;
  overflow: hidden;
  background: rgba(8, 13, 24, 0.92);
  border-color: rgba(74, 231, 253, 0.34);
}

.character-card-auto,
.prop-card-auto {
  position: relative;
  padding: 0;
  overflow: hidden;
  background: rgba(8, 13, 24, 0.92);
  border-color: rgba(74, 231, 253, 0.34);
}

.scene-card-auto .scene-card-header,
.character-card-auto .character-card-header,
.prop-card-auto .prop-card-header {
  margin: 0;
  padding: 4px 10px;
  background: #202434;
  border-bottom: 1px solid #006C8F;
}

.scene-card-auto .scene-card-delete-btn {
  position: static;
  color: var(--home-muted, #8e97a5);
  padding: 0.25rem;
  width: auto;
  height: auto;
  z-index: 1;
  background: transparent;
  border-radius: var(--radius-md);
}

.scene-card-auto .scene-card-delete-btn:hover {
  color: #ff7a84;
  background: rgba(255, 82, 97, 0.12);
}

.scene-card-auto .scene-card-header-row {
  padding-right: 0;
}

.scene-card-actions-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.scene-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin: 0;
}

.scene-card-delete-btn {
  color: var(--home-muted, #8e97a5);
  padding: 0.25rem;
  width: auto;
  height: auto;
}

.scene-card-delete-btn:hover {
  color: var(--red-600);
  background: var(--red-50);
}

.scene-card-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.scene-card-auto .scene-card-content,
.character-card-auto .character-card-content,
.prop-card-auto .prop-card-content {
  min-height: 250px;
  padding: 1.15rem 1rem 1.1rem;
  justify-content: center;
}

.asset-generate-card__actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.95rem;
  img{
    width: 24px;
    height: 24px;
  }
}

.asset-generate-card__or {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.82rem;
  flex-shrink: 0;
}

.asset-generate-card__action.ant-btn {
  width: 100px;
  height: 100px;
  border-radius: 10px !important;
  border: 1px dashed rgba(74, 231, 253, 0.42) !important;
  background: rgba(12, 16, 24, 0.62) !important;
  color: rgba(230, 237, 243, 0.9) !important;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  line-height: 1.25;
  padding: 0.45rem;
  box-shadow: none !important;
}

.asset-generate-card__action.ant-btn .anticon {
  font-size: 1.02rem;
}

.asset-generate-card__action.ant-btn:hover {
  border-color: rgba(74, 231, 253, 0.72) !important;
  color: #e9fbff !important;
  background: rgba(20, 40, 68, 0.72) !important;
}

//.asset-generate-card__action--primary.ant-btn {
//  border-style: solid !important;
//  border-color: rgba(74, 231, 253, 0.55) !important;
//  background: linear-gradient(180deg, rgba(18, 127, 233, 0.86) 0%, rgba(33, 97, 242, 0.84) 100%) !important;
//}

.asset-generate-card__action--primary.ant-btn:hover {
  border-color: rgba(74, 231, 253, 0.72) !important;
  color: #e9fbff !important;
  background: rgba(20, 40, 68, 0.72) !important;
}

.scene-card-new {
  border-color: rgba(0, 171, 216, 0.45);
  background: rgba(14, 89, 250, 0.12);
}

.scene-card-divider {
  text-align: center;
  color: var(--home-muted, #8e97a5);
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.25rem 0;

}

/* 有图片时的场景卡片样式（图6） */
.scene-card-header-with-image {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
  gap: 0.75rem;
  padding: 8px 4px;
  min-height: 36px;
  border: 1px solid rgba(74,231,253,0.3);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  img{
    width: 16px;
    height: 16px;
  }
}

.scene-card-header-with-image .scene-card-title-editable {
  padding: 0;
}

.scene-card-header-with-image > .ant-dropdown-trigger,
.scene-card-header-with-image .ant-btn {
  color: var(--home-muted, #8e97a5);
}

.scene-card-image-body {
  margin-bottom: 0;
  text-align: center;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--create-surface-canvas);
  position: relative;
  .ant-image{
    width: 100%;
    height: 15.75rem !important;
  }
}

.scene-main-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
/* 图片底部操作条布局见 storyboard-step-shared.css；按钮字号见 scp-step-shared.css */

.footer-action-icon {
  width: 16px;
  height: 16px;
  display: block;
}

/* AImage 默认按原尺寸展示，强制导入图充满卡片区域（对齐设计稿） */
:deep(.scene-main-image .ant-image),
:deep(.scene-main-image .ant-image-img) {
  width: 100%;
  height: 100%;
}

:deep(.scene-main-image .ant-image-img) {
  object-fit: cover;
}

/* 角色形态图：保持原高度，完整展示不裁剪、不拉伸 */
.character-form-images-list .scene-card-image-body {
  display: flex;
  align-items: center;
  justify-content: center;
}

.character-form-images-list .scene-main-image {
  object-fit: contain;
  object-position: center;
}

.character-form-images-list :deep(.scene-main-image .ant-image-img) {
  object-fit: contain;
  object-position: center;
}

.empty-asset-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

/* ========== 角色生成界面样式 ========== */
.character-generation-view,
.prop-generation-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.character-cards-container,
.prop-cards-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 自动提取的角色/道具：网格布局，定宽展示（列宽见 scp-step-shared.css） */
.character-cards-auto,
.prop-cards-auto {
  display: grid;
  gap: 1.25rem;
}

/* 角色/道具卡片基础样式（与场景卡片一致） */
.character-card,
.prop-card {
  border: 1px solid #006C8F;
  border-radius: var(--radius-sm);
  // padding: 1.25rem;
  background: rgba(12, 16, 24, 0.72);
  transition: all 0.2s ease;
  position: relative;
}

.character-card:hover,
.prop-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  border-color: #33d9ff;
}

.character-card-header,
.prop-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.character-card-header-row,
.prop-card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  gap: 0.75rem;
  width: 100%;
}

.character-card-title,
.prop-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  margin: 0;
}

/* 自动角色/道具的删除按钮在右上角（与场景一致） */
.character-card-auto,
.prop-card-auto {
  position: relative;
}

.character-card-delete-btn,
.prop-card-delete-btn {
  position: static;
  color: var(--home-muted, #8e97a5);
  padding: 0.25rem;
  width: auto;
  height: auto;
  z-index: 1;
  background: transparent;
  border-radius: var(--radius-md);
}

.character-card-delete-btn:hover,
.prop-card-delete-btn:hover {
  color: #ff7a84;
  background: rgba(255, 82, 97, 0.12);
}

.character-card-auto .character-card-header-row,
.prop-card-auto .prop-card-header-row {
  padding-right: 0;
}

.character-card-content,
.prop-card-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.character-card-divider,
.prop-card-divider {
  text-align: center;
  color: var(--home-muted, #8e97a5);
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.25rem 0;
}

/* 手动添加的角色/道具：单列布局，每个项目占满一行 */
.character-cards-manual,
.prop-cards-manual {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.character-card-wrapper,
.prop-card-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid rgba(74, 231, 253, 0.30);
  background: #070d17;
  border-radius: 8px;
  overflow: hidden;
}

.character-card-header-bar,
.prop-card-header-bar {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(74, 231, 253, 0.30);
}

/* 手动添加项内容区外框：对齐分镜列表的深色内容底 */
.scene-card-wrapper
.character-card-wrapper .character-forms-list,
.prop-card-wrapper .prop-forms-list,
.character-card-wrapper .character-add-form,
.prop-card-wrapper .prop-add-form {
  //padding: 0.75rem;
  background: #080d14;
}

.character-card-title-wrapper,
.prop-card-title-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}

.character-card-title-prefix,
.prop-card-title-prefix {
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  white-space: nowrap;
}

.character-card-title-editable,
.prop-card-title-editable {
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  /* 与 .scene-card-title-editable 一致：不占满整行，超长省略 */
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-card-title-editable:hover,
.prop-card-title-editable:hover {
  background: rgba(14, 89, 250, 0.12);
  color: var(--home-cyan, #4ae7fd);
}

.character-name-input,
.prop-name-input {
  /* 与 .scene-name-input 一致：限制编辑框拉伸宽度 */
  min-width: 240px;
  width: 0;
}

.character-card-actions-header,
.prop-card-actions-header {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  flex-shrink: 0;
  align-items: center;
  button{
    border: 1px solid #2F3949 !important;
  }
}

/* 手动角色/道具的卡片：定宽见 scp-step-shared.css --scp-card-width */
.character-card-manual,
.prop-card-manual {
  flex-shrink: 0;
}

/* 角色形态相关 */
.character-forms-list,
.prop-forms-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 0.75rem;
}


.character-form-item{
  padding-left: 12px;
}
.prop-form-item{
  padding-left: 12px;
}
.character-form-header,
.prop-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom:  -4px;
  gap: 1rem;
  padding-left: 12px;
}

.character-form-title-wrapper,
.prop-form-title-wrapper {
  display: flex;
  align-items: center;
  min-width: 0;
}

.character-form-title-prefix,
.prop-form-title-prefix {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  white-space: nowrap;
}

.character-form-title-editable,
.prop-form-title-editable {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-form-title-editable:hover,
.prop-form-title-editable:hover {
  background: rgba(14, 89, 250, 0.12);
  color: var(--home-cyan, #4ae7fd);
}

.form-name-input,
.prop-form-name-input {
  flex: 1;
  min-width: 0;
}

.character-form-voiceover {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: 24px;
}

.voiceover-label {
  font-size: 0.875rem;
  color: var(--home-muted, #8e97a5);
}

.voiceover-btn {
  display: flex;
  align-items: center;
  color: var(--home-muted, #8e97a5);
  border: 1px solid #8E97A5;
  border-radius: 999px;
}

.voice-preview-btn {
  color:rgba(142, 151, 165, 1);
  border: 1px solid #8E97A5;
  border-radius: 999px;
  padding: 0 8px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.voice-preview-btn.is-playing {
  color: #ffd089;
  border-color: rgba(255, 166, 77, 0.6);
  background: rgba(255, 166, 77, 0.12);
}

.voice-preview-eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.voice-preview-eq-bar {
  width: 2px;
  background: currentColor;
  border-radius: 1px;
  animation: voice-preview-eq 0.45s ease-in-out infinite alternate;
}

.voice-preview-eq-bar-1 {
  height: 6px;
  animation-delay: 0s;
}

.voice-preview-eq-bar-2 {
  height: 11px;
  animation-delay: 0.12s;
}

.voice-preview-eq-bar-3 {
  height: 8px;
  animation-delay: 0.24s;
}

@keyframes voice-preview-eq {
  0% {
    transform: scaleY(0.35);
    opacity: 0.7;
  }
  100% {
    transform: scaleY(1);
    opacity: 1;
  }
}

.voice-preview-audio {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.character-form-content,
.prop-form-content {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

/* 场景主图区：与角色/道具「形态内容区」同一底衬与缩进，生成中/失败不再套虚线大框 */
.scene-image-form-content {
  padding-left: 12px;
  padding-right: 0.75rem;
  padding-bottom: 0.75rem;
  background: #080d14;
}

.scene-image-form-content .asset-visual-generating-block {
  margin: 12px 0 0 0;
}

.scene-image-form-content > .character-form-generate-failed {
  margin: 12px 0 0 0;
}

.scene-image-form-content > .character-form-card.manual-generate-card {
  margin: 12px 0 0 0;
}

.form-images-list,
.character-form-images-list,
.prop-form-images-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}

.form-image-card {
  border: 1px solid rgba(74, 231, 253, 0.15);
  border-radius: var(--radius-lg);
  padding: 1rem;
  background: rgba(12, 16, 24, 0.65);
  flex-shrink: 0;
}

/* 手动添加后已有图片时，角色/道具形态卡片样式对齐自动卡片 */
.form-image-card.scene-card-auto {
  padding: 0;
  background: rgba(8, 13, 24, 0.92);
  border-color: rgba(74, 231, 253, 0.34);
  overflow: hidden;
  flex-shrink: 0;
}

.character-form-card,
.prop-form-card {
  width: min(100%, 24%);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

}

/* 手动添加（无图）卡片：与自动生成卡片保持同一尺寸、背景、边框与 hover 效果 */
.scene-card-manual-empty,
.manual-generate-card {
  border: 1px dashed rgba(74, 231, 253, 0.30);
  border-radius: var(--radius-sm);
  background: rgba(12, 16, 24, 0.72);
  min-height: 250px;
  padding: 1.15rem 1rem 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin:  12px 0 0 12px;
}
.scene-card-manual-empty:hover,
.manual-generate-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  border-color: #33d9ff;
}

.character-form-actions,
.prop-form-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-right: 12px;
  align-items: flex-start;
  button{
    border: 1px solid #2F3949 !important;
  }
}

.character-add-form{
  width: 100%;
  margin-top: 12px;
  border-top: 1px solid rgba(74,231,253,0.3);;
  button{
    display: flex;
    align-items: center;
    justify-content: center;
    height: 48px;
    gap:6px;
    width: 100%;
    background: transparent !important;
    border-radius: 0;
  }
}
.prop-add-form {
  margin: 0 auto 12px;
}


/* 生成失败的场景卡片样式 */
.scene-card-failed {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  background: rgba(8, 13, 24, 0.92);
  border: 1px dashed rgba(74, 231, 253, 0.34);
  border-radius: var(--radius-lg);
  width: min(100%, 24.4%);
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
  color: #8E97A5;
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

.character-form-generate-failed {
  width: 100%;
  max-width: 24.4%;
  margin: 12px 0 0 0;
}

/* 第三步自动生成：卡片内可见的加载块（替代不易察觉的 Skeleton） */
.asset-visual-generating-block {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 240px;
  width: 100%;
  margin: 12px 0 0 12px;
  padding: 24px 16px;
  border: 1px solid rgba(74, 231, 253, 0.35);
  border-radius: var(--radius-lg);
  background: linear-gradient(145deg, rgba(18, 22, 38, 0.96) 0%, rgba(25, 32, 52, 0.99) 100%);
  overflow: hidden;
  box-sizing: border-box;
}

.asset-visual-generating-block__shimmer {
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
  animation: scp-asset-shimmer 1.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes scp-asset-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.asset-visual-generating-block__icon {
  position: relative;
  z-index: 1;
  font-size: 32px;
  color: #4ae7fd;
}

.asset-visual-generating-block__text {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.82);
  text-align: center;
}

@media (max-width: 768px) {
  .scp-asset-empty {
    min-height: 0;
    padding: 1.75rem 1rem;
  }

  .scp-asset-empty__hint {
    flex-direction: column;
    text-align: center;
  }

  .scp-topbar {
    flex-direction: column;
    align-items: stretch;
  }
  .scp-tabs {
    justify-content: center;
  }
  .scp-actions {
    justify-content: center;
  }
  .scp-topbar__right {
    justify-content: center;
    width: 100%;
    margin-left: 0;
  }

  .scp-topbar-hint {
    width: 100%;
    flex: none;
    text-align: center;
    padding: 0.35rem 0 0;
  }
}

/* 提取后待生成形态：小卡片横条（与现有深蓝卡片风格一致） */
.scp-pending-form-strip-wrap {
  padding: 0 4px;
}

.scp-pending-form-strip-hint {
  margin: 0 0 0.65rem;
  font-size: 14px;
  line-height: 1.45;
  color: var(--home-white);
}

.scp-pending-form-strip {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1%;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
}

.scp-pending-form-card {
  flex: 0 0 auto;
  min-height: 250px;
  border: 1px solid rgba(74, 231, 253, 0.22);
  border-radius: var(--radius-sm, 8px);
  background: rgba(12, 16, 24, 0.85);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: 10px;
}

.scp-pending-form-card:hover {
  border-color: rgba(74, 231, 253, 0.42);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
}

.scp-pending-form-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 8px;
  border-bottom: 1px solid rgba(74, 231, 253, 0.12);
}

.scp-pending-form-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.scp-pending-form-card__title-ico {
  flex-shrink: 0;
  color: rgba(74, 231, 253, 0.85);
  font-size: 14px;
}

.scp-pending-form-card__title-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scp-pending-form-card__title-prefix {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  white-space: nowrap;
}

.scp-pending-form-card__title-editable {
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s ease, background 0.15s ease;
}

.scp-pending-form-card__title-editable:hover {
  color: var(--home-cyan, #4ae7fd);
  background: rgba(14, 89, 250, 0.12);
}

.scp-pending-form-card__title-input {
  flex: 1;
  min-width: 0;
}

.scp-pending-form-card__more {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--home-muted, #8e97a5);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.scp-pending-form-card__more:hover {
  color: var(--home-cyan, #4ae7fd);
  background: rgba(74, 231, 253, 0.08);
}

.scp-pending-form-card__body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 10px 14px;
}

.scp-pending-form-card__gen-btn {
  font-size: 14px;
  min-width: 108px;
  padding: 4px 8px;
  background: transparent !important;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<style lang="css">
.scp-topbar-ops-dropdown-overlay,
.scp-topbar-ops-dropdown-overlay .ant-dropdown-menu {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  border: none !important;
}
</style>

<style lang="css">
.scp-topbar-ops-dropdown-overlay,
.scp-topbar-ops-dropdown-overlay .ant-dropdown-menu {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  border: none !important;
}
</style>
