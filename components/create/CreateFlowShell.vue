<template>
  <div class="create-page" :class="{ 'create-page--series-upload': isSeriesFlowChrome }">
    <!-- 主内容区：左右布局 -->
    <!-- 页面就绪前的骨架屏，避免步骤从第 1 步闪到持久化步骤 -->
    <div v-if="!pageReady" class="main-layout">
      <HomeSidebar skeleton />
      <div class="create-main">
        <div v-if="!isSeriesFlowChrome" class="create-workflow create-workflow--skeleton">
          <div class="create-workflow__scroll">
            <div
              v-for="n in displayStepSkeletonCount"
              :key="n"
              class="flow-step-pill flow-step-pill--strip flow-step-pill--skeleton"
            >
              <div class="skeleton-icon"></div>
              <div class="skeleton-line skeleton-line-flow-title"></div>
            </div>
          </div>
        </div>
        <div class="preview-panel">
          <div class="preview-header">
            <div class="skeleton-title skeleton-title-lg"></div>
            <div v-if="!isSeriesFlowChrome" class="preview-actions">
              <div class="skeleton-btn"></div>
              <div class="skeleton-btn skeleton-btn-primary"></div>
            </div>
          </div>
          <div
            class="preview-content"
            :class="{
              'step-series-script-upload': isSeriesScriptUpload,
              'step-series-episode-list': isSeriesEpisodeList
            }"
          >
            <div class="skeleton-block"></div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="main-layout">
      <HomeSidebar
        ref="homeSidebarRef"
        @brand="goHomeFromCreate"
        @gallery="goHomeFromCreate"
        @works="openWorksPanel"
        @assets="openAssetsPanel"
        @recharge="openRechargeFromMenu"
        @login="goLogin"
        @toggle-user-menu="toggleUserMenu"
      />

      <div class="create-main">
        <div class="create-main__flow-stack">
          <!-- 顶部工具栏：未就绪时显示头部骨架屏 -->
          <div v-if="!pageReady" class="toolbar toolbar-skeleton">
            <div class="toolbar-left">
              <div class="skeleton-back"></div>
              <div class="skeleton-title-input"></div>
            </div>
            <div v-if="!isSeriesFlowChrome" class="toolbar-right">
              <div class="skeleton-btn-toolbar"></div>
              <div class="skeleton-btn-toolbar skeleton-btn-toolbar-primary"></div>
            </div>
          </div>
          <div v-else-if="isSeriesScriptUpload" class="toolbar toolbar--series-upload">
            <div class="toolbar-left">
              <button type="button" class="back-btn" @click="goBack">
                <LeftOutlined />
              </button>
              <div class="toolbar-title-block">
                <div class="toolbar-title-input-wrap" :style="titleInputWrapStyle">
                  <span ref="titleMeasureEl" class="title-input-measure" aria-hidden="true">{{
                    titleMeasureText
                  }}</span>
                  <a-input
                    v-model:value="creationStore.workTitle"
                    placeholder="作品名称"
                    class="title-input"
                    size="large"
                    :bordered="false"
                    maxlength="100"
                    @blur="onSeriesWorkTitleBlur"
                    @input="syncTitleInputWidth"
                  />
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="isSeriesEpisodeList"
            class="toolbar toolbar--series-upload toolbar--series-episode-list"
          >
            <div class="toolbar-left toolbar-left--wrap">
              <button type="button" class="back-btn" @click="goBack">
                <LeftOutlined />
              </button>
              <div class="toolbar-title-block">
                <div class="toolbar-title-input-wrap" :style="titleInputWrapStyle">
                  <span ref="titleMeasureEl" class="title-input-measure" aria-hidden="true">{{
                    titleMeasureText
                  }}</span>
                  <a-input
                    v-model:value="creationStore.workTitle"
                    placeholder="作品名称"
                    class="title-input"
                    size="large"
                    :bordered="false"
                    maxlength="100"
                    @blur="onSeriesWorkTitleBlur"
                    @input="syncTitleInputWidth"
                  />
                </div>
              </div>
              <span class="toolbar-series-episode-count">共{{ seriesEpisodeCountLabel }}集</span>
            </div>
            <div class="toolbar-right">
              <a-tooltip
                :open="seriesProjectConfigTipOpen"
                :title="SERIES_PROJECT_CONFIG_STORYBOARD_BLOCKED_TIP"
                placement="bottomRight"
                :trigger="[]"
                @openChange="onSeriesProjectConfigTipOpenChange"
              >
                <a-button
                  size="large"
                  class="toolbar-btn-draft"
                  :loading="seriesProjectConfigChecking"
                  :disabled="seriesProjectConfigChecking"
                  @click="onSeriesProjectConfigClick"
                >
                  <div class="text-gradient">项目配置</div>
                </a-button>
              </a-tooltip>
            </div>
          </div>
          <div v-else class="toolbar">
            <div class="toolbar-left">
              <button type="button" class="back-btn" @click="goBack">
                <LeftOutlined />
              </button>
              <div class="toolbar-title-block">
                <div class="toolbar-title-input-wrap" :style="titleInputWrapStyle">
                  <span ref="titleMeasureEl" class="title-input-measure" aria-hidden="true">{{
                    titleMeasureText
                  }}</span>
                  <a-input
                    v-model:value="creationStore.workTitle"
                    placeholder="作品名称"
                    class="title-input"
                    size="large"
                    :bordered="false"
                    maxlength="100"
                    @blur="onSeriesWorkTitleBlur"
                    @input="syncTitleInputWidth"
                  />
                </div>
                <!--          <span class="toolbar-episode">第1集</span>-->
              </div>
            </div>
            <div class="toolbar-right">
              <GlobalGenerateTaskPopover
                :project-id="activeProjectId"
                @stop="handleGlobalTaskStop"
                @restart="handleGlobalTaskRestart"
                @resume="handleGlobalTaskResume"
              />
              <a-button
                v-if="activeProjectId"
                size="large"
                class="toolbar-btn-draft"
                @click="openProjectGenConfig"
              >
                <div class="text-gradient">生成配置</div>
              </a-button>
              <a-button
                v-if="flowStepIndex === 0"
                size="large"
                class="toolbar-btn-draft"
                :loading="globalSettingConfirmLoading"
                @click="globalSettingContext.save()"
              >
                <div class="text-gradient">保存</div>
              </a-button>
              <a-button
                v-if="flowStepIndex === 1"
                size="large"
                class="toolbar-btn-draft"
                :loading="saveDraftSubmitting"
                :disabled="saveDraftSubmitting || toolbarPrimaryLoading"
                @click="saveDraft"
              >
                <div class="text-gradient">存草稿</div>
              </a-button>
              <a-dropdown
                v-if="isPreviewStep"
                :open="exportMenuOpen"
                trigger="click"
                placement="bottomRight"
                overlay-class-name="preview-export-dropdown-overlay"
                @update:open="onExportMenuOpenChange"
              >
                <a-button
                  type="primary"
                  size="large"
                  class="toolbar-btn-export"
                  :class="{ 'toolbar-btn-guide-breathing': publishGuideActive }"
                  :disabled="previewExportBusy"
                  :loading="previewExportBusy"
                >
                  导出/发布
                </a-button>
                <template #overlay>
                  <div class="preview-export-menu" role="menu" aria-label="选择导出为">
                    <div class="preview-export-menu__title">选择导出为</div>
                    <button
                      type="button"
                      class="preview-export-menu__btn"
                      role="menuitem"
                      :disabled="previewExportBusy"
                      @click="onExportFullVideo"
                    >
                      <span class="text-gradient">导出完整视频</span>
                    </button>
                    <button
                      type="button"
                      class="preview-export-menu__btn"
                      role="menuitem"
                      :disabled="previewExportBusy"
                      @click="onExportSegments"
                    >
                      <span class="preview-export-menu__btn-text">导出分段素材</span>
                    </button>
                    <a-tooltip
                      v-if="publishToCasePlazaDisabled"
                      :title="publishToCasePlazaTooltip"
                      placement="left"
                      :overlay-style="{ zIndex: 11000, maxWidth: '280px' }"
                      :get-popup-container="getPublishTooltipPopupContainer"
                    >
                      <span
                        class="preview-export-menu__btn-wrap"
                      >
                        <button
                          type="button"
                          class="preview-export-menu__btn"
                          role="menuitem"
                          disabled
                        >
                          <span class="preview-export-menu__btn-text">发布至案例广场</span>
                        </button>
                      </span>
                    </a-tooltip>
                    <button
                      v-else
                      type="button"
                      class="preview-export-menu__btn"
                      role="menuitem"
                      :disabled="previewExportBusy"
                      @click="onPublishToCasePlaza"
                    >
                      <span class="preview-export-menu__btn-text">发布至案例广场</span>
                    </button>
                  </div>
                </template>
              </a-dropdown>
              <a-button
                v-else
                type="primary"
                size="large"
                :disabled="toolbarPrimaryDisabled || nextStepDelayLoading"
                :loading="toolbarPrimaryLoading"
                @click="handleNextStepWithDelay"
              >
                {{ toolbarPrimaryLabel }}
              </a-button>
            </div>
          </div>
          <div class="preview_bg_box">
            <div
              v-if="previewAuditFailureReason"
              class="preview-audit-failure"
              role="alert"
            >
              <span class="preview-audit-failure__title">审核失败</span>
              <span class="preview-audit-failure__reason">{{ previewAuditFailureReason }}</span>
            </div>
            <div
              v-if="!isSeriesFlowChrome"
              class="create-workflow"
            >
              <div class="create-workflow__scroll">
                <template v-for="(step, displayIndex) in displaySteps" :key="step.key">
                  <div class="flow-step-pill-wrap">
                    <a-tooltip
                      :open="publishGuideTooltipOpen && flowStepIndex === stepRealIndex(step.key)"
                      title="请先完成作品"
                      placement="bottom"
                      :trigger="[]"
                      overlay-class-name="publish-guide-tooltip"
                    >
                      <button
                        type="button"
                        class="flow-step-pill flow-step-pill--strip"
                        :class="{
                          'flow-step-pill--active': flowStepIndex === stepRealIndex(step.key),
                          'flow-step-pill--completed':
                            stepStatus[stepRealIndex(step.key)] === 'completed',
                          'flow-step-pill--pending':
                            stepStatus[stepRealIndex(step.key)] === 'pending',
                          'flow-step-pill--disabled':
                            stepStatus[stepRealIndex(step.key)] === 'disabled',
                          'flow-step-pill--locked-ahead':
                            stepRealIndex(step.key) > unlockedStepIndex,
                          'flow-step-pill--guide-breathing':
                            publishGuideActive &&
                            !isPreviewStep &&
                            flowStepIndex === stepRealIndex(step.key)
                        }"
                        :disabled="toolbarPrimaryLoading || stepApiLoading"
                        @pointerenter="preloadCreateStepRoute(stepRealIndex(step.key))"
                        @click="onFlowStepPillClick(stepRealIndex(step.key))"
                      >
                        <span class="flow-step-pill__icon" aria-hidden="true">
                          <LoadingOutlined
                            v-if="
                              step.key === 'scene-character' &&
                              (creationStore.isExtractingAssets || isStep3VisualStepGenerating)
                            "
                            class="flow-step-pill__loading"
                            spin
                          />
                          <LoadingOutlined
                            v-else-if="
                              step.key === 'storyboard-script' && isStoryboardScriptStepGenerating
                            "
                            class="flow-step-pill__loading"
                            spin
                          />
                          <LoadingOutlined
                            v-else-if="
                              step.key === 'storyboard-video' && isStoryboardVideoFlowStepGenerating
                            "
                            class="flow-step-pill__loading"
                            spin
                          />
                          <LoadingOutlined
                            v-else-if="step.key === 'dubbing' && isDubbingStepGenerating"
                            class="flow-step-pill__loading"
                            spin
                          />
                          <img
                            v-else
                            :src="
                              stepFlowIcons[step.key][
                                flowStepIndex === stepRealIndex(step.key) ||
                                stepStatus[stepRealIndex(step.key)] === 'completed'
                                  ? 'sel'
                                  : 'nor'
                              ]
                            "
                            alt=""
                            class="flow-step-pill__img"
                            :class="{
                              'flow-step-pill__img--active':
                                flowStepIndex === stepRealIndex(step.key) ||
                                stepStatus[stepRealIndex(step.key)] === 'completed'
                            }"
                          />
                        </span>
                        <span class="flow-step-pill__title">{{ step.title }}</span>
                      </button>
                    </a-tooltip>
                  </div>
                  <div
                    v-if="displayIndex < displaySteps.length - 1"
                    class="flow-step-connector flow-step-connector--h"
                    :class="{
                      'flow-step-connector--done': isConnectorTrailDone(stepRealIndex(step.key)),
                      'flow-step-connector--next': flowStepIndex === stepRealIndex(step.key)
                    }"
                  >
                    <img
                      :src="
                        isConnectorTrailDone(stepRealIndex(step.key))
                          ? processIconSel
                          : processIconNor
                      "
                      alt=""
                      class="flow-step-connector__img"
                      :class="{
                        'flow-step-connector__img--next': flowStepIndex === stepRealIndex(step.key)
                      }"
                    />
                    <span
                      v-if="flowStepIndex === stepRealIndex(step.key)"
                      class="flow-step-connector__march"
                      aria-hidden="true"
                    >
                      <i class="march-chevron c1"></i>
                      <i class="march-chevron c2"></i>
                      <i class="march-chevron c3"></i>
                    </span>
                  </div>
                </template>
              </div>
              <!-- <div class="create-workflow__meta">
              <span class="create-workflow__progress">完成度 {{ completionRate }}%</span>
            </div> -->
            </div>

            <div class="preview-panel">
              <!-- <div class="preview-header">
              <h3 class="preview-title">{{ currentStepData.title }}</h3>
              <div class="preview-actions">
                <a-button size="small" @click="prevStep" :disabled="creationStore.currentStepIndex <= 0">
                  <template #icon><LeftOutlined /></template>
                  上一步
                </a-button>
                <a-button type="primary" size="small" @click="handleNextStep">
                  <template #icon><RightOutlined /></template>
                  {{ creationStore.currentStepIndex === steps.length - 1 ? '完成' : '下一步' }}
                </a-button>
              </div>
            </div> -->
              <div class="preview-content" :class="previewContentStepClass">
                <!--                      <div-->
                <!--                        v-if="createStepSwapPlaceholder"-->
                <!--                        class="create-step-swap-placeholder"-->
                <!--                        aria-busy="true"-->
                <!--                        aria-live="polite"-->
                <!--                      >-->
                <!--                        <LoadingOutlined spin class="create-step-swap-placeholder__ico" />-->
                <!--                        <span class="create-step-swap-placeholder__text">步骤加载中…</span>-->
                <!--                      </div>-->
                <slot />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 第三步：智能体选择弹窗 -->
    <ExtractAgentModal
      v-model:open="creationStore.showExtractAgentModal"
      :agents="creationStore.extractAgents"
      :model-codes="creationStore.extractModelCodes"
      :scope="extractModalScope"
      :action-mode="creationStore.extractModalActionMode"
      @update:agents="updateExtractAgents"
      @update:model-codes="updateExtractModelCodes"
      @start="startExtractAssets"
    />

    <RechargeModal v-model:open="showRechargeModal" @paid="handleRechargePaid" />
    <CreateFirstStepModal
      :open="showGlobalSettingModal"
      flow-edit-mode
      :project-type-locked="globalSettingProjectTypeLocked"
      :confirm-loading="globalSettingConfirmLoading"
      :title="creationTitleDraft"
      :project-type="globalSettingProjectTypeDraft"
      :aspect-ratio="creationGlobalSettingDraft.aspectRatio"
      :script-type="creationGlobalSettingDraft.scriptType"
      :model-strategy="creationGlobalSettingDraft.modelStrategy"
      :creation-mode="creationGlobalSettingDraft.creationMode"
      :model-value="creationGlobalSettingDraft"
      @update:open="onGlobalSettingModalOpenChange"
      @update:title="creationTitleDraft = $event"
      @update:project-type="globalSettingProjectTypeDraft = $event"
      @update:aspect-ratio="updateGlobalSettingDraftField('aspectRatio', $event)"
      @update:script-type="updateGlobalSettingDraftField('scriptType', $event)"
      @update:model-strategy="updateGlobalSettingDraftField('modelStrategy', $event)"
      @update:creation-mode="updateGlobalSettingDraftField('creationMode', $event)"
      @update:model-value="patchGlobalSettingDraftStyle($event)"
      @confirm="() => handleGlobalSettingConfirm({ navigateAfterSave: false })"
    />
    <ProjectGenConfigModal
      v-model:open="showProjectGenConfigModal"
      :project-id="activeProjectId"
      :episode-id="creationStore.currentEpisodeId"
    />
    <UserMenuDropdown
      ref="userMenuDropdownRef"
      :open="showUserMenuCard"
      :floating-style="userMenuCardStyle"
      @faq="openFaq"
      @billing="openBilling"
      @recharge="openRechargeFromMenu"
      @logout="handleLogout"
    />

    <PublishCasePlazaModal
      v-model:open="publishCasePlazaModalOpen"
      :project-id="activeProjectId"
      :initial-project-desc="publishInitialProjectDesc"
      @success="onPublishCasePlazaMetaSuccess"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 创作流程壳层：侧栏、流程条、工具栏、弹窗与 provide。
 * 业务逻辑已拆至 composables（原 pages/create/index.vue 单文件脚本）。
 */
import {
  ref,
  shallowRef,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  provide
} from 'vue'
import { suspendAllTaskSseFollows } from '~/composables/useTaskSseFollow'
import { message, Modal } from 'ant-design-vue'
import {
  isFullVideoExportStale,
  isProjectPublicLockError,
  isProjectPublished,
  PUBLISH_STALE_EXPORT_TIP,
  projectPublicLockUserHint,
  resolvePublishToCasePlazaBlockReason,
  shouldConfirmReplacePublishedVideo
} from '~/utils/projectAudit'
import { syncFullVideoExportMediaToStore } from '~/utils/syncFullVideoExportMedia'
import { LeftOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import { defineAsyncComponent } from 'vue'
import HomeSidebar from '~/components/layout/HomeSidebar.vue'
import type { CreationStep } from '~/types'
import UserMenuDropdown from '~/components/common/UserMenuDropdown.vue'
import {
  routePathToCreationStep,
  creationStepToRoutePath,
  CREATE_FLOW_STEP_ORDER,
  isSeriesScriptUploadPath,
  isSeriesEpisodeListPath,
  isSeriesFlowChromePath
} from '~/utils/createFlowRoutes'
import { getCreateFlowDisplaySteps } from '~/utils/createFlowStepMeta'
import { shouldSkipFlowProjectScopedApis } from '~/utils/createFlowProjectContext'
import {
  fetchFlowUserTaskList,
  invalidateFlowUserTaskListCache
} from '~/utils/userTaskListFlowOnce'
import { dispatchCreateFlowTaskCommand } from '~/utils/createFlowTaskCommand'
import { resolveRouteProjectId } from '~/utils/hydrateCreationStoreFromProjectDetail'
import { createFlowShellKey, type PreviewExportBridge } from '~/utils/createFlowInjection'
import { downloadExportedFinalVideo } from '~/composables/useEpisodeVideoExport'
import { useCreationStore } from '~/stores/creation'
import ellipse7Nor from '~/assets/img/icon/Ellipse-7-nor.svg'
import ellipse7Sel from '~/assets/img/icon/Ellipse-7-sel.svg'
import ellipse10Nor from '~/assets/img/icon/Ellipse-10-nor.svg'
import ellipse10Sel from '~/assets/img/icon/Ellipse-10-sel.svg'
import ellipse15Nor from '~/assets/img/icon/Ellipse-15-nor.svg'
import ellipse15Sel from '~/assets/img/icon/Ellipse-15-sel.svg'
import ellipse11Nor from '~/assets/img/icon/Ellipse-11-nor.svg'
import ellipse11Sel from '~/assets/img/icon/Ellipse-11-sel.svg'
import ellipse12Nor from '~/assets/img/icon/Ellipse-12-nor.svg'
import ellipse12Sel from '~/assets/img/icon/Ellipse-12-sel.svg'
import ellipse13Nor from '~/assets/img/icon/Ellipse-13-nor.svg'
import ellipse13Sel from '~/assets/img/icon/Ellipse-13-sel.svg'
import ellipse14Nor from '~/assets/img/icon/Ellipse-14-nor.svg'
import ellipse14Sel from '~/assets/img/icon/Ellipse-14-sel.svg'
import processIconNor from '~/assets/img/icon/process-nor.svg'
import processIconSel from '~/assets/img/icon/process-sel.svg'
import { useCreateFlowStoryboardSync } from '~/composables/useCreateFlowStoryboardSync'
import { useScriptChangeExtractGate } from '~/composables/useScriptChangeExtractGate'
import { useCreateFlowExtractAgents } from '~/composables/useCreateFlowExtractAgents'
import { useCreateFlowGlobalSettingModal } from '~/composables/useCreateFlowGlobalSettingModal'
import { useCreateFlowRouteAndSteps } from '~/composables/useCreateFlowRouteAndSteps'
import { useCreateFlowSidebarChrome } from '~/composables/useCreateFlowSidebarChrome'
import { useCreateFlowShellLiveGenBootstrap } from '~/composables/useCreateFlowShellLiveGenBootstrap'
import { useGlobalSettingProjectHydrate } from '~/composables/useGlobalSettingProjectHydrate'
import { useCreateFlowTitleMeasure } from '~/composables/useCreateFlowTitleMeasure'
import { usePreviewPublicationState } from '~/composables/usePreviewPublicationState'
import { htmlPlainTextLength } from '~/utils/htmlPlain'
import { userEpisodeList, userProjectUpdate } from '~/utils/businessApi'
import {
  SERIES_PROJECT_CONFIG_STORYBOARD_BLOCKED_TIP,
  checkSeriesProjectConfigStoryboardGuard
} from '~/utils/seriesProjectConfigGuard'
import { requestCancelUserTask, normUserTaskCancelType } from '~/utils/userTaskCancelFlow'
import { normUserTaskType } from '~/utils/taskPartialFailed'
import {
  isStoryboardScriptFlowStepGenerating,
  isDubbingFlowStepGenerating,
  isStoryboardVideoFlowStepGenerating as checkStoryboardVideoFlowStepGenerating
} from '~/utils/storyboardFlowStepLoading'
import { isStep3FlowStepGenerating } from '~/utils/step3LiveGenRestore'
import type { UserTaskRow } from '~/types/business-api'

const PublishCasePlazaModal = defineAsyncComponent(
  () => import('~/components/common/PublishCasePlazaModal.vue')
)
const ExtractAgentModal = defineAsyncComponent(
  () => import('~/components/steps/ExtractAgentModal.vue')
)
const CreateFirstStepModal = defineAsyncComponent(
  () => import('~/components/steps/CreateFirstStepModal.vue')
)
const ProjectGenConfigModal = defineAsyncComponent(
  () => import('~/components/steps/ProjectGenConfigModal.vue')
)
const GlobalGenerateTaskPopover = defineAsyncComponent(
  () => import('~/components/steps/GlobalGenerateTaskPopover.vue')
)
const RechargeModal = defineAsyncComponent(() => import('~/components/common/RechargeModal.vue'))
const route = useRoute()
const router = useRouter()
const isSeriesScriptUpload = computed(() => isSeriesScriptUploadPath(route.path))
const isSeriesEpisodeList = computed(() => isSeriesEpisodeListPath(route.path))
const isSeriesFlowChrome = computed(() => isSeriesFlowChromePath(route.path))

const stepFlowIcons: Record<CreationStep, { nor: string; sel: string }> = {
  'global-setting': { nor: ellipse7Nor, sel: ellipse7Sel },
  'story-script': { nor: ellipse10Nor, sel: ellipse10Sel },
  'scene-character': { nor: ellipse15Nor, sel: ellipse15Sel },
  'storyboard-script': { nor: ellipse11Nor, sel: ellipse11Sel },
  'storyboard-video': { nor: ellipse12Nor, sel: ellipse12Sel },
  dubbing: { nor: ellipse13Nor, sel: ellipse13Sel },
  preview: { nor: ellipse14Nor, sel: ellipse14Sel }
}

const creationStore = useCreationStore()

const seriesEpisodeCountLabel = computed(() => {
  const n = creationStore.seriesEpisodeListTotal
  return n != null && n >= 0 ? String(n) : '—'
})

const pageReady = ref(false)
const isDubbingGenerating = ref(false)
const isDubbingStepGenerating = computed(
  () => isDubbingGenerating.value || isDubbingFlowStepGenerating(creationStore, route)
)

const isStoryboardVideoFlowStepGenerating = computed(() =>
  checkStoryboardVideoFlowStepGenerating(creationStore, route)
)

const isStoryboardScriptStepGenerating = computed(() =>
  isStoryboardScriptFlowStepGenerating(creationStore, route)
)

const isStep3VisualStepGenerating = computed(() => isStep3FlowStepGenerating(creationStore, route))

const storyboardSync = useCreateFlowStoryboardSync()
const extract = useCreateFlowExtractAgents()
const scriptChangeGate = useScriptChangeExtractGate()
const routeSteps = useCreateFlowRouteAndSteps(extract.openExtractAgentModalIfNeeded)
const globalSetting = useCreateFlowGlobalSettingModal()
const sidebar = useCreateFlowSidebarChrome()
const homeSidebarRef = ref<InstanceType<typeof HomeSidebar> | null>(null)
const titleMeasure = useCreateFlowTitleMeasure(pageReady)

const {
  steps,
  flowStepIndex,
  previewContentStepClass,
  stepStatus,
  unlockedStepIndex,
  stepApiLoading,
  handleStepClick,
  handleNextStep: runNextStep,
  handleSubmit,
  nextStepSubmitting,
  toolbarPrimaryLabel,
  toolbarPrimaryDisabled,
  goBack,
  saveDraft,
  saveDraftSubmitting,
  syncProjectContextFromRoute,
  fetchCreationStepStatus,
  isConnectorTrailDone,
  goToCreateStep
} = routeSteps

/** 剧集流程条隐藏「项目配置」，仅展示后 6 步 */
const displaySteps = computed(() => getCreateFlowDisplaySteps(creationStore.currentProjectType))
const displayStepSkeletonCount = computed(() => displaySteps.value.length)

function stepRealIndex(stepKey: CreationStep): number {
  const i = CREATE_FLOW_STEP_ORDER.indexOf(stepKey)
  return i >= 0 ? i : 0
}

const { storyboardListLoading, storyboardListSyncReady } = routeSteps

const nextStepDelayLoading = ref(false)
const showProjectGenConfigModal = ref(false)

const isPreviewStep = computed(() => flowStepIndex.value >= steps.length - 1)
const {
  isPublished: previewIsPublished,
  auditFailureReason: previewAuditFailureReason
} = usePreviewPublicationState({ pageReady, isPreviewStep })
/** shallow：避免桥接内 Ref 被深层解包导致 loading 状态丢失 */
const previewExportBridge = shallowRef<PreviewExportBridge | null>(null)
const exportMenuOpen = ref(false)
/** 已确认「新版替换旧版」的 pendingVideoUrl；换新片后需再确认 */
const replacePublishedVideoAckedUrl = ref('')
/** 已确认「工程已改待重新导出」类替换提示；导出状态变化后重置 */
const replaceStaleExportAcked = ref(false)
/**
 * 图二确认后若当前仍是「旧版待重导」，强制禁用发布直至本次重新导出完整视频成功。
 * 避免残留 pendingVideoUrl + 本地 status 未刷新时误开放发布入口。
 */
const publishBlockedUntilFreshExport = ref(false)
const exportedEpisodeEditorId = ref<number | null>(null)

const fullVideoExportState = computed(() => ({
  finalVideoUrl: creationStore.currentFinalVideoUrl,
  pendingVideoUrl: creationStore.currentPendingVideoUrl,
  exportStatus: creationStore.currentExportStatus
}))

/** 未导出 / 工程已改待重新导出：禁用并悬停提示 */
const publishToCasePlazaTooltip = computed(() => {
  if (publishBlockedUntilFreshExport.value) return PUBLISH_STALE_EXPORT_TIP
  return resolvePublishToCasePlazaBlockReason(fullVideoExportState.value) || ''
})
const publishToCasePlazaDisabled = computed(() => Boolean(publishToCasePlazaTooltip.value))

function getPublishTooltipPopupContainer() {
  return document.body
}

const hasPublishedHistory = computed(() => {
  if (previewIsPublished.value || isProjectPublished(creationStore.currentProjectIsPublic)) {
    return true
  }
  const status =
    creationStore.currentProjectType === 'series'
      ? creationStore.currentEpisodeStatus
      : creationStore.currentProjectStatus
  return status === 4
})

watch(
  () =>
    [
      creationStore.currentExportStatus,
      creationStore.currentFinalVideoUrl,
      creationStore.currentPendingVideoUrl,
      creationStore.currentProjectId,
      creationStore.currentEpisodeId
    ] as const,
  () => {
    replaceStaleExportAcked.value = false
  }
)

async function confirmReplacePublishedVideoIfNeeded(): Promise<boolean> {
  const pendingVideoUrl = String(creationStore.currentPendingVideoUrl || '').trim()
  const exportState = fullVideoExportState.value
  if (
    !shouldConfirmReplacePublishedVideo({
      pendingVideoUrl,
      ackedPendingVideoUrl: replacePublishedVideoAckedUrl.value,
      finalVideoUrl: exportState.finalVideoUrl,
      exportStatus: exportState.exportStatus,
      hasPublishedHistory: hasPublishedHistory.value,
      staleExportAcked: replaceStaleExportAcked.value
    })
  ) {
    return true
  }
  const confirmingStale = isFullVideoExportStale(exportState)
  return new Promise((resolve) => {
    Modal.confirm({
      title: '提示',
      content: '您确定将发布的新版内容会替换旧版内容吗？',
      okText: '确定',
      cancelText: '取消',
      centered: true,
      onOk: () => {
        if (confirmingStale) {
          replaceStaleExportAcked.value = true
          // 改过内容后确认替换：必须先导出新版再发布
          publishBlockedUntilFreshExport.value = true
        } else if (pendingVideoUrl) {
          replacePublishedVideoAckedUrl.value = pendingVideoUrl
        }
        resolve(true)
      },
      onCancel: () => resolve(false)
    })
  })
}

async function onExportMenuOpenChange(open: boolean) {
  if (!open) {
    exportMenuOpen.value = false
    return
  }
  if (previewExportBusy.value) {
    exportMenuOpen.value = false
    return
  }
  // 打开前同步 exportStatus，避免本地仍是旧的「导出成功」态导致无法拦截发布
  try {
    await syncFullVideoExportMediaToStore(creationStore)
  } catch {
    // 同步失败不阻断打开菜单，仍走本地已有状态判断
  }
  const ok = await confirmReplacePublishedVideoIfNeeded()
  exportMenuOpen.value = ok
}
const saveExportedLocalLoading = ref(false)
/** 「发布至案例广场」链路执行中（更新项目 → 按需提审 → 发布；不再合成完整视频） */
const publishFlowRunning = ref(false)
const publishCasePlazaModalOpen = ref(false)

/** 发布弹窗回显：描述用项目配置；封面不走风格图，由弹窗按需拉 detail */
const publishInitialProjectDesc = computed(() =>
  String(creationStore.formData.globalSetting?.description || '').trim()
)

const previewExportBusy = computed(
  () =>
    Boolean(
      previewExportBridge.value?.exporting.value ||
      previewExportBridge.value?.segmentsDownloading.value
    ) ||
    publishFlowRunning.value ||
    saveExportedLocalLoading.value
)

function registerPreviewExportBridge(bridge: PreviewExportBridge | null) {
  previewExportBridge.value = bridge
  if (!bridge) {
    exportMenuOpen.value = false
  }
}

/** 导出完整视频：合成成功后不再弹窗，直接自动保存至本地 */
async function onExportFullVideo() {
  exportMenuOpen.value = false
  const bridge = previewExportBridge.value
  if (!bridge) {
    message.warning('预览页尚未就绪，请稍后再试')
    return
  }
  const result = await bridge.exportFullVideo()
  if (!result?.videoUrl) return
  // 二次导出成功后恢复「发布至案例广场」
  publishBlockedUntilFreshExport.value = false
  const editorId = Number(result.episodeEditorId)
  exportedEpisodeEditorId.value =
    Number.isFinite(editorId) && editorId > 0 ? editorId : creationStore.currentEpisodeEditorId
  await saveExportedVideoToLocal()
}

async function onExportSegments() {
  exportMenuOpen.value = false
  const bridge = previewExportBridge.value
  if (!bridge) {
    message.warning('预览页尚未就绪，请稍后再试')
    return
  }
  await bridge.exportSegments()
}

/** 完整导出成功（含切步/刷新恢复场景）：自动保存至本地；发布链路合成不触发下载 */
function handlePreviewExportSuccess(_videoUrl: string) {
  if (publishFlowRunning.value) return
  publishBlockedUntilFreshExport.value = false
  exportedEpisodeEditorId.value = creationStore.currentEpisodeEditorId
  void saveExportedVideoToLocal()
}

async function saveExportedVideoToLocal() {
  if (saveExportedLocalLoading.value) return
  const projectId = Number(creationStore.currentProjectId)
  const episodeId =
    creationStore.currentProjectType === 'movie' ? 0 : Number(creationStore.currentEpisodeId)
  const editorId = Number(exportedEpisodeEditorId.value ?? creationStore.currentEpisodeEditorId)
  const hasEditor = Number.isFinite(editorId) && editorId > 0
  const hasProject = Number.isFinite(projectId) && projectId > 0
  if (!hasEditor && !hasProject) {
    message.warning('暂无可保存的成片')
    return
  }
  saveExportedLocalLoading.value = true
  const messageKey = 'export'
  try {
    // 下载接口会先完整读取附件流；在流真正返回前持续展示加载态，不能提前提示成功。
    message.loading({ content: '正在下载中...', key: messageKey, duration: 0 })
    await downloadExportedFinalVideo({
      episodeEditorId: hasEditor ? editorId : null,
      projectId: hasProject ? projectId : null,
      episodeId: Number.isFinite(episodeId) && episodeId >= 0 ? episodeId : 0
    })
    if (String(creationStore.currentPendingVideoUrl || '').trim()) {
      message.warning({
        content: '下载成功；新片需重新提交审核（线上仍展示旧版）',
        key: messageKey,
        duration: 4
      })
    } else {
      message.success({ content: '下载成功', key: messageKey, duration: 2 })
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error({
      content: err?.msg || err?.message || '成片下载失败',
      key: messageKey,
      duration: 4
    })
  } finally {
    saveExportedLocalLoading.value = false
  }
}

/** 发布至案例广场入口：需已有当前可用成片；合成/下载仅「导出完整视频」可触发 */
function onPublishToCasePlaza() {
  exportMenuOpen.value = false
  if (publishFlowRunning.value || publishCasePlazaModalOpen.value) return
  const projectId = Number(creationStore.currentProjectId ?? activeProjectId.value)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.warning('缺少项目信息，无法发布')
    return
  }
  const blockReason = resolvePublishToCasePlazaBlockReason(fullVideoExportState.value)
  if (blockReason) {
    message.warning(blockReason)
    return
  }
  publishCasePlazaModalOpen.value = true
}

/**
 * 发布链路（严格顺序，任一步失败即终止）：
 * 1. 更新项目封面/描述（已在弹窗内完成，成功才会回调到这里）
 * 2. 提交审核 / 重新提交审核（按需）
 * 3. 发布
 * 不再调用合成完整视频 / 下载接口（仅「导出完整视频」可触发）
 */
async function onPublishCasePlazaMetaSuccess(payload: {
  projectId: number
  coverUrl: string
  projectDesc: string
}) {
  if (publishFlowRunning.value) return
  const nextDesc = String(payload.projectDesc || '').trim()
  const nextCover = String(payload.coverUrl || '').trim()
  if (nextDesc) {
    creationStore.updateFormData({
      globalSetting: {
        ...creationStore.formData.globalSetting,
        description: nextDesc
      }
    })
  }
  const blockReason = resolvePublishToCasePlazaBlockReason(fullVideoExportState.value)
  if (blockReason) {
    message.warning(blockReason)
    return
  }
  publishFlowRunning.value = true
  try {
    await handleSubmit({
      alsoPublish: true,
      coverUrl: nextCover,
      projectDesc: nextDesc
    })
  } finally {
    publishFlowRunning.value = false
  }
}

function openProjectGenConfig() {
  if (!activeProjectId.value) {
    message.warning('请先选择作品后再配置生成参数')
    return
  }
  showProjectGenConfigModal.value = true
}
const toolbarPrimaryLoading = computed(() => nextStepDelayLoading.value || nextStepSubmitting.value)
const activeProjectId = computed(() => {
  const routeProjectId = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
  if (creationStore.currentProjectId && creationStore.currentProjectId > 0)
    return creationStore.currentProjectId
  if (Number.isFinite(routeProjectId) && routeProjectId > 0) return routeProjectId
  return null
})

/** 进入创作流程时 bootstrap 权威 task/list，切换步骤与各弹窗恢复均复用缓存 */
watch(
  activeProjectId,
  (pid, prevPid) => {
    if (shouldSkipFlowProjectScopedApis(route)) return
    if (prevPid && pid !== prevPid) invalidateFlowUserTaskListCache(prevPid)
    if (!pid) {
      if (prevPid) invalidateFlowUserTaskListCache(prevPid)
      return
    }
    void fetchFlowUserTaskList(pid, { intent: 'bootstrap' })
  },
  { immediate: true }
)

const seriesProjectConfigChecking = ref(false)
const seriesProjectConfigTipOpen = ref(false)
let seriesProjectConfigTipTimer: ReturnType<typeof setTimeout> | null = null

function onSeriesProjectConfigTipOpenChange(open: boolean) {
  if (!open) seriesProjectConfigTipOpen.value = false
}

function showSeriesProjectConfigBlockedTip() {
  seriesProjectConfigTipOpen.value = true
  if (seriesProjectConfigTipTimer) clearTimeout(seriesProjectConfigTipTimer)
  seriesProjectConfigTipTimer = setTimeout(() => {
    seriesProjectConfigTipOpen.value = false
    seriesProjectConfigTipTimer = null
  }, 3200)
}

async function onSeriesProjectConfigClick() {
  if (seriesProjectConfigChecking.value) return
  const pid = activeProjectId.value
  if (!pid) {
    message.warning('缺少项目信息')
    return
  }
  seriesProjectConfigChecking.value = true
  try {
    const rows = await userEpisodeList({ projectId: pid })
    const episodeIds = rows
      .map((ep) => ep.id)
      .filter((id): id is number => typeof id === 'number' && id > 0)
    const guard = await checkSeriesProjectConfigStoryboardGuard(pid, episodeIds)
    if (guard.blocked) {
      if (guard.reason === 'has-storyboard') {
        showSeriesProjectConfigBlockedTip()
      } else {
        message.error(guard.message || '无法确认分镜状态，暂不可修改项目配置')
      }
      return
    }
    await hydrateFromProjectApi(route, { force: true })
    globalSetting.openGlobalSettingModal()
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '打开项目配置失败')
  } finally {
    seriesProjectConfigChecking.value = false
  }
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function handleGlobalTaskRestart(task: UserTaskRow) {
  const taskId = parseTaskId(task.id)
  if (!taskId) {
    message.warning('任务ID无效，无法重新开始')
    return
  }
  const ty = normUserTaskCancelType(task.taskType)
  const status = String(task?.status ?? '').toUpperCase()
  await goToCreateStep(resolveTaskOwnerStepIndex(task.taskType))
  if (status === 'FAILED' && ty === 'storyboard_script_batch') {
    dispatchCreateFlowTaskCommand('restart', { taskId, taskType: task.taskType ?? null })
  } else {
    creationStore.removePausedTaskFollow(taskId)
    dispatchCreateFlowTaskCommand('track', { taskId, taskType: task.taskType ?? null })
  }
  window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
}

/**
 * 任务类型 → 所属流程步骤（CREATION_FLOW_STEPS 下标）。
 * 续生/重新开始/继续跟进都必须先落到任务所属步骤页，再由该页受理指令；
 * 素材准备（2）仅承接智能提取与形态/形态图等第三步任务。
 */
function resolveTaskOwnerStepIndex(taskType: unknown): number {
  const ty = normUserTaskType(taskType)
  if (ty === 'storyboard_audio_generate') {
    return 5
  }
  if (ty === 'storyboard_video_prompt_batch' || ty === 'storyboard_video_generate') {
    return 4
  }
  if (
    ty === 'storyboard_script_batch' ||
    ty === 'storyboard_image_prompt_batch' ||
    ty === 'storyboard_image_generate' ||
    ty === 'storyboard_image_batch'
  ) {
    return 3
  }
  return 2
}

async function handleGlobalTaskResume(task: UserTaskRow) {
  const taskId = parseTaskId(task.id)
  if (!taskId) {
    message.warning('任务ID无效，无法续生')
    return
  }
  const ty = normUserTaskType(task.taskType)
  const hide = message.loading('正在重新生成...', 0)
  try {
    creationStore.removePausedTaskFollow(taskId)
    await goToCreateStep(resolveTaskOwnerStepIndex(task.taskType))
    dispatchCreateFlowTaskCommand('resume', { taskId, taskType: task.taskType ?? null })
    if (ty === 'storyboard_script_batch') {
      message.success('分镜续生已提交')
    } else if (ty === 'asset_extract') {
      message.success('智能提取续跑已提交')
    } else if (ty === 'storyboard_image_prompt_batch') {
      message.success('分镜图提示词续生已提交')
    } else if (ty === 'storyboard_video_prompt_batch') {
      message.success('分镜视频提示词续生已提交')
    } else if (ty === 'storyboard_video_generate') {
      message.success('分镜视频续生已提交')
    } else {
      message.success('续生已提交')
    }
  } catch (e: unknown) {
    message.error(bizErrMsg(e) || '续生失败')
  } finally {
    hide()
    /** 任务列表刷新由各步骤 resume 处理器在续生接口完成后统一派发，避免与 finally 重复触发 */
  }
}

function bizErrMsg(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return String(x?.msg ?? x?.message ?? (e as Error)?.message ?? '')
}

async function handleGlobalTaskStop(task: UserTaskRow) {
  const taskId = parseTaskId(task.id)
  if (!taskId) {
    message.warning('任务ID无效，无法停止')
    return
  }
  try {
    await requestCancelUserTask(task)
    message.success('已请求停止生成')
  } catch (e: unknown) {
    const ax = e as { response?: { status?: number }; msg?: string; message?: string }
    const st = ax?.response?.status
    if (st === 404) {
      message.warning('停止接口未就绪（404），已仅停止本页进度展示')
    } else {
      message.warning(bizErrMsg(e) || '停止任务请求失败，已仅停止本页进度展示')
    }
  }
  creationStore.addPausedTaskFollow(taskId)
  window.dispatchEvent(
    new CustomEvent('create-flow-stop-task', {
      detail: { taskId, taskType: task.taskType ?? null }
    })
  )
  window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
}

async function handleNextStepWithDelay() {
  clearPublishGuide()
  if (toolbarPrimaryDisabled.value || toolbarPrimaryLoading.value) return
  nextStepDelayLoading.value = true
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 500))
    await runNextStep()
  } finally {
    nextStepDelayLoading.value = false
  }
}

/**
 * 「我的作品」卡片发布入口跳转引导（query.publishGuide=1）：
 * - 已完成（落在成品预览）：呼吸灯高亮「导出/发布」按钮
 * - 未完成（落在中间步骤）：呼吸灯 + tooltip 高亮当前流程 tab（推进到哪一步就亮哪一步）
 */
const publishGuideActive = ref(false)
const publishGuideTooltipOpen = ref(false)
let publishGuideTimer: ReturnType<typeof setTimeout> | null = null

function clearPublishGuide() {
  publishGuideActive.value = false
  publishGuideTooltipOpen.value = false
  if (publishGuideTimer) {
    clearTimeout(publishGuideTimer)
    publishGuideTimer = null
  }
}

function onFlowStepPillClick(index: number) {
  clearPublishGuide()
  void handleStepClick(index)
}

function activatePublishGuide() {
  publishGuideActive.value = true
  // 未完成：tooltip 挂在当前流程 tab；已完成预览步仅呼吸灯「导出/发布」
  publishGuideTooltipOpen.value = !isPreviewStep.value
  if (publishGuideTimer) clearTimeout(publishGuideTimer)
  publishGuideTimer = setTimeout(() => {
    clearPublishGuide()
  }, 10000)

  // 消费掉 publishGuide 参数，避免刷新/回退重复触发
  const nextQuery: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (key === 'publishGuide' || value == null) continue
    nextQuery[key] = Array.isArray(value) ? String(value[0] ?? '') : String(value)
  }
  void router.replace({ path: route.path, query: nextQuery })
}

watch(
  () => [String(route.query.publishGuide ?? ''), pageReady.value] as const,
  ([guide, ready]) => {
    if (!ready || guide !== '1') return
    nextTick(() => activatePublishGuide())
  },
  { immediate: true }
)

/** 打开导出下拉即视为引导完成 */
watch(exportMenuOpen, (open) => {
  if (open) clearPublishGuide()
})

onBeforeUnmount(() => {
  if (publishGuideTimer) {
    clearTimeout(publishGuideTimer)
    publishGuideTimer = null
  }
})

const {
  showGlobalSettingModal,
  globalSettingConfirmLoading,
  creationTitleDraft,
  globalSettingProjectTypeDraft,
  creationGlobalSettingDraft,
  patchGlobalSettingDraftStyle,
  updateGlobalSettingDraftField,
  handleGlobalSettingConfirm,
  syncGlobalSettingDraftFromStore,
  openGlobalSettingModal
} = globalSetting

/** 流程内编辑已有作品时锁定作品类型（电影 / 剧集均不可改） */
const globalSettingProjectTypeLocked = computed(
  () =>
    creationStore.currentProjectType === 'movie' || creationStore.currentProjectType === 'series'
)

function onGlobalSettingModalOpenChange(open: boolean) {
  showGlobalSettingModal.value = open
}

const globalSettingContext = {
  confirmLoading: globalSettingConfirmLoading,
  titleDraft: creationTitleDraft,
  projectTypeDraft: globalSettingProjectTypeDraft,
  draft: creationGlobalSettingDraft,
  projectTypeLocked: globalSettingProjectTypeLocked,
  showModal: showGlobalSettingModal,
  syncFromStore: syncGlobalSettingDraftFromStore,
  openModal: openGlobalSettingModal,
  updateField: updateGlobalSettingDraftField,
  patchStyle: patchGlobalSettingDraftStyle,
  save: () => handleGlobalSettingConfirm({ navigateAfterSave: false })
}

const {
  showRechargeModal,
  showUserMenuCard,
  userMenuTriggerRef,
  userMenuDropdownRef,
  userMenuCardStyle,
  goLogin,
  goHomeFromCreate,
  openWorksPanel,
  openAssetsPanel,
  openTutorial,
  toggleUserMenu,
  openFaq,
  openBilling,
  openRechargeFromMenu,
  handleLogout,
  handleDocumentClick,
  updateUserMenuPosition,
  handleRechargePaid,
  handleOpenRechargeByEvent
} = sidebar

const { hydrateFromProjectApi } = useGlobalSettingProjectHydrate()

useCreateFlowShellLiveGenBootstrap({
  route,
  syncProjectContextFromRoute
})

watch(
  () => homeSidebarRef.value?.userMenuTriggerRef,
  (trigger) => {
    userMenuTriggerRef.value = trigger ?? null
  },
  { flush: 'post' }
)

const { titleMeasureEl, titleMeasureText, titleInputWrapStyle, syncTitleInputWidth } = titleMeasure

function preloadCreateStepRoute(index: number) {
  if (!import.meta.client) return
  const key = steps[index]?.key
  if (!key) return
  void preloadRouteComponents({ path: creationStepToRoutePath(key), query: { ...route.query } })
}

const workTitleSaveBaseline = ref('')

function syncWorkTitleSaveBaseline() {
  workTitleSaveBaseline.value = (creationStore.workTitle || '').trim() || '未命名作品'
}

async function onSeriesWorkTitleBlur() {
  const trimmed = (creationStore.workTitle || '').trim() || '未命名作品'
  creationStore.setWorkTitle(trimmed)
  if (trimmed === workTitleSaveBaseline.value) {
    nextTick(() => syncTitleInputWidth())
    return
  }
  const routePid = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
  const pid =
    creationStore.currentProjectId ?? (Number.isFinite(routePid) && routePid > 0 ? routePid : null)
  if (!pid) {
    workTitleSaveBaseline.value = trimmed
    creationStore.updateFormData({
      globalSetting: { ...creationStore.formData.globalSetting, title: trimmed }
    })
    nextTick(() => syncTitleInputWidth())
    return
  }
  try {
    await userProjectUpdate({ id: pid, projectName: trimmed })
    workTitleSaveBaseline.value = trimmed
    creationStore.updateFormData({
      globalSetting: { ...creationStore.formData.globalSetting, title: trimmed }
    })
  } catch (e: unknown) {
    if (isProjectPublicLockError(e)) {
      message.error(projectPublicLockUserHint())
      creationStore.setWorkTitle(workTitleSaveBaseline.value)
      return
    }
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '保存标题失败')
    creationStore.setWorkTitle(workTitleSaveBaseline.value)
  } finally {
    nextTick(() => syncTitleInputWidth())
  }
}

const { extractModalScope, updateExtractAgents, updateExtractModelCodes, startExtractAssets } =
  extract

provide(createFlowShellKey, {
  goToStep: goToCreateStep,
  stopExtractAssets: extract.stopExtractAssets,
  openExtractModalFromScp: extract.handleOpenExtractModalFromScp,
  openContinueExtractModal: () => {
    extract.extractModalScope.value = 'all'
    scriptChangeGate.openContinueExtractModal()
  },
  dismissScriptChangeLightBanner: scriptChangeGate.dismissLightBanner,
  jumpToStoryboardScriptFromVideo: storyboardSync.handleJumpToStoryboardScriptFromVideo,
  clearStoryboardScriptJumpTooltip: storyboardSync.clearStoryboardScriptJumpTooltip,
  storyboardScriptTooltipTargetIndex: storyboardSync.storyboardScriptTooltipTargetIndex,
  storyboardScriptTooltipKey: storyboardSync.storyboardScriptTooltipKey,
  syncVideoAndDubbingFromScriptPanels: storyboardSync.syncVideoAndDubbingFromScriptPanels,
  storyboardListLoading,
  storyboardListSyncReady,
  setDubbingGenerating: (v: boolean) => {
    isDubbingGenerating.value = v
  },
  globalSetting: globalSettingContext,
  openProjectGenConfig,
  registerPreviewExportBridge,
  notifyPreviewExportSuccess: handlePreviewExportSuccess
})

onMounted(() => {
  const panel = String(route.query.panel ?? '').toLowerCase()
  if (panel === 'works') {
    void router.replace('/works')
    return
  }
  if (panel === 'assets') {
    void router.replace('/assets')
    return
  }

  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', updateUserMenuPosition)
  window.addEventListener('scroll', updateUserMenuPosition, true)
  window.addEventListener('open-recharge-modal', handleOpenRechargeByEvent as EventListener)
  nextTick(() => {
    const finishPageReady = () => {
      if (creationStore.currentStepIndex < 0 || creationStore.currentStepIndex >= steps.length) {
        creationStore.setCurrentStepIndex(0)
      }
      pageReady.value = true
    }

    if (!shouldSkipFlowProjectScopedApis(route)) {
      syncProjectContextFromRoute()
      // 刷新后必须以 project/detail 回填创作模式等项目配置。
      // 不能因 persist 已有同 projectId 就跳过：否则专业版 UI 限制会在批量出片后刷新失效。
      // 等 hydrate 完成再放开 pageReady，避免专业版分镜列表先闪成「需生图」的普通版布局。
      void hydrateFromProjectApi(route)
        .then(() => {
          syncGlobalSettingDraftFromStore()
        })
        .finally(() => {
          finishPageReady()
        })
      fetchCreationStepStatus()
    } else {
      finishPageReady()
    }
  })
})

watch(
  () => [route.query.projectId, route.query.id, route.query.workId, route.query.episodeId],
  () => {
    if (shouldSkipFlowProjectScopedApis(route)) return
    syncProjectContextFromRoute()
    const routePid = resolveRouteProjectId(route.query as Record<string, unknown>)
    if (routePid != null && routePid > 0 && creationStore.currentProjectId === routePid) {
      return
    }
    void hydrateFromProjectApi(route).then((hydrated) => {
      if (hydrated) syncGlobalSettingDraftFromStore()
    })
  }
)

/**
 * 第三步 bootstrap + 剧本就绪后再尝试自动弹窗。
 * 须等 step/status（含 stepInitAdvance）同步结束：生成剧集可能先短暂落到素材准备再回退剧本，
 * 若在回退前弹窗会造成「闪一下又关」。
 */
watch(
  () => ({
    ready: creationStore.step3AssetListSyncReady,
    path: route.path,
    hasScript: htmlPlainTextLength(creationStore.formData.storyScript.content || '') > 0,
    stepLoading: stepApiLoading.value,
    stepInitAdvance: String(route.query.stepInitAdvance ?? ''),
    pendingContinue: creationStore.pendingOpenContinueExtractModal
  }),
  ({ ready, path, hasScript, stepLoading, stepInitAdvance, pendingContinue }) => {
    if (stepLoading || !ready || !hasScript) return
    if (stepInitAdvance === '1' || stepInitAdvance === 'true') return
    if (routePathToCreationStep(path) !== 'scene-character') return
    nextTick(() => {
      if (pendingContinue || creationStore.pendingOpenContinueExtractModal) {
        extract.extractModalScope.value = 'all'
        scriptChangeGate.consumePendingOpenExtractModal()
        return
      }
      extract.openExtractAgentModalIfNeeded('current-route')
      void scriptChangeGate.refreshLightBannerOnPreparePage({ skipIfPendingOpen: true })
    })
  },
  { flush: 'post' }
)

watch(
  () => [pageReady.value, route.query.projectId, route.query.id, route.query.workId] as const,
  ([ready]) => {
    if (ready) nextTick(() => syncWorkTitleSaveBaseline())
  },
  { immediate: true }
)

watch(
  () => route.path,
  (path, previousPath) => {
    if (previousPath && path !== previousPath) {
      // 第三步组件会在资产列表重新同步完成后置回 true；路由切换期间禁止复用上次的 ready 状态。
      creationStore.setStep3AssetListSyncReady(false)
      suspendAllTaskSseFollows()
    }
    nextTick(() => syncTitleInputWidth())
  },
  { flush: 'sync' }
)

/**
 * 剧集隔离：同一路由下切换作品/集数（scope 变化）也必须挂起全部任务 SSE。
 * 仅靠 route.path watch 覆盖不了「剧集列表 → 第 2 集」这类只改 episodeId query 的切换，
 * 旧集 SSE 回调会把进度/终态写进新集的扁平 store（跨集污染）。
 * 挂起只断浏览器连接，持久化任务快照保留，切回原集由 scope bootstrap 恢复。
 */
watch(
  () => creationStore.step3GenVisualScopeKey(),
  (scopeKey, prevScopeKey) => {
    if (prevScopeKey && scopeKey !== prevScopeKey) {
      suspendAllTaskSseFollows()
    }
  },
  { flush: 'sync' }
)

onBeforeUnmount(() => {
  // 离开创作壳层：挂起 SSE，并把当前扁平 generating 落盘到作品 scope，供切回后恢复
  suspendAllTaskSseFollows()
  try {
    creationStore.syncStep3GenVisualToCurrentScope()
    creationStore.syncStep4PlusLiveGenToCurrentScope()
  } catch {
    /* ignore */
  }
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', updateUserMenuPosition)
  window.removeEventListener('scroll', updateUserMenuPosition, true)
  window.removeEventListener('open-recharge-modal', handleOpenRechargeByEvent as EventListener)
  if (seriesProjectConfigTipTimer) {
    clearTimeout(seriesProjectConfigTipTimer)
    seriesProjectConfigTipTimer = null
  }
})
</script>

<style lang="scss" scoped>
.home-theme-page {
  padding: 0 !important;
}
.create-page {
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  background: var(
    --home-bg-gradient,
    linear-gradient(165deg, #001731 0%, #0d0d0f 42%, #121212 100%)
  );
  background-color: var(--home-bg-solid, #060a12);
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--home-text, #e6edf3);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      radial-gradient(circle at 10% 20%, rgba(14, 89, 250, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 90% 80%, rgba(0, 171, 216, 0.05) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }
}

/* 剧集「上传剧本」首屏：与设计稿一致的渐变底 */
.create-page--series-upload {
  background: linear-gradient(172deg, #001731 0%, #121212 48%);
  background-color: #121212;
}

/* 骨架屏样式 */
.skeleton-title,
.skeleton-subtitle,
.skeleton-line,
.skeleton-circle,
.skeleton-btn,
.skeleton-block,
.skeleton-back,
.skeleton-title-input,
.skeleton-btn-toolbar {
  position: relative;
  overflow: hidden;
  background-color: rgba(74, 231, 253, 0.12);
}

.skeleton-title {
  width: 120px;
  height: 18px;
  border-radius: 999px;
  margin-bottom: 0.5rem;
}

.skeleton-title-lg {
  width: 160px;
  height: 22px;
}

.skeleton-subtitle {
  width: 80px;
  height: 12px;
  border-radius: 999px;
}

.skeleton-step {
  cursor: default;
}

.skeleton-circle {
  width: 28px;
  height: 28px;
  border-radius: 999px;
}

.skeleton-line {
  height: 10px;
  border-radius: 999px;
  margin-bottom: 6px;
}

.skeleton-line-lg {
  width: 70%;
}

.skeleton-line-sm {
  width: 50%;
}

.skeleton-btn {
  width: 80px;
  height: 32px;
  border-radius: 999px;
}

.skeleton-btn-primary {
  width: 96px;
}

.skeleton-block {
  width: 100%;
  height: 100%;
  min-height: 360px;
  border-radius: var(--radius-xl);
}

/* 头部骨架：返回按钮、标题输入框、右侧按钮 */
.skeleton-back {
  width: 72px;
  height: 40px;
  border-radius: var(--radius-md);
}

.skeleton-title-input {
  width: 300px;
  height: 40px;
  border-radius: var(--radius-md);
}

.skeleton-btn-toolbar {
  width: 100px;
  height: 40px;
  border-radius: var(--radius-md);
}

.skeleton-btn-toolbar-primary {
  width: 110px;
}

.skeleton-title::after,
.skeleton-subtitle::after,
.skeleton-line::after,
.skeleton-circle::after,
.skeleton-btn::after,
.skeleton-block::after,
.skeleton-back::after,
.skeleton-title-input::after,
.skeleton-btn-toolbar::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: skeleton-shimmer 1.4s infinite;
}

@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* 顶部工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  // z-index: 100;
  padding: 4px 14px 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-title-block {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
  min-width: 0;
}

.toolbar-title-input-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  max-width: min(50vw, 560px);
  vertical-align: middle;
}

.toolbar-title-input-wrap :deep(.ant-input),
.toolbar-title-input-wrap :deep(.ant-input-affix-wrapper) {
  width: 100%;
  padding-inline: 0;
}

.title-input-measure {
  position: absolute;
  left: 0;
  top: 0;
  z-index: -1;
  visibility: hidden;
  white-space: pre;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.5;
  font-family: inherit;
  pointer-events: none;
}

.toolbar-episode {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--home-muted, #8e97a5);
  white-space: nowrap;
}

.toolbar-right .toolbar-btn-draft {
  background: none !important;
  border-color: rgba(74, 231, 253, 0.35) !important;
  color: #e6edf3 !important;
  /* loading 与文案同一行，避免块级子元素导致换行 */
  display: inline-flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: center;
  white-space: nowrap;
  vertical-align: middle;

  .text-gradient {
    display: inline;
    white-space: nowrap;
    line-height: 1.2;
  }

  :deep(.ant-btn-loading-icon) {
    display: inline-flex !important;
    align-items: center;
    flex-shrink: 0;
  }
}

.back-btn {
  background: none;
  border: none;
  color: var(--home-muted, #8e97a5);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 20px;
  // padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
}

.back-btn:hover {
  background: rgba(74, 231, 253, 0.08);
  color: #fff;
}

.toolbar .toolbar-left .title-input {
  width: 100% !important;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff !important;
  background: none !important;
}

.title-input::placeholder {
  color: var(--home-muted, #8e97a5) !important;
}

.toolbar-right {
  display: flex;
  gap: 14px;
  button {
    font-size: 14px;
    height: 32px;
    padding: 0 12px;
  }
}

.toolbar--series-upload {
  min-height: 48px;
  padding: 0 20px 0 16px;
  flex-shrink: 0;
}

.toolbar--series-episode-list {
  justify-content: space-between;
  gap: 12px;
}

/* 剧集管理：压缩标题栏与列表内容间距 */
.create-page--series-upload .preview_bg_box {
  margin-top: 0;
  margin-bottom: 8px;
}

.create-page--series-upload .preview-panel {
  margin-bottom: 8px;
}

.toolbar-left--wrap {
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.toolbar-left--wrap .toolbar-title-block {
  flex: 0 1 auto;
  width: auto;
}

.toolbar-series-episode-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--home-muted, #8e97a5);
  white-space: nowrap;
}

/* 主布局：左侧栏（与首页共用 HomeSidebar）+ 右侧主工作区 */
.main-layout {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
  overflow: hidden;
  min-height: 0;
  height: 100%;
  position: relative;
  z-index: 1;
}

.create-main__embed-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 0.5rem 1rem;
  display: flex;
  flex-direction: column;
}

.create-main__embed-scroll > .home-new-sub-page {
  flex: 1 0 auto;
  min-height: 0;
}

.create-main__flow-stack {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  padding-right: 24px;
  position: relative;
}
/* 流程页右侧：流程 / 我的作品 / 资产库 切换过渡 */
.create-main-switch-enter-active,
.create-main-switch-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.create-main-switch-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.create-main-switch-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* —— 右侧主区：横向流程 + 内容区 —— */
.create-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  // background: linear-gradient(180deg, rgba(6, 10, 18, 0.4) 0%, rgba(8, 10, 14, 0.95) 100%);
}

.create-main__transition-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.create-workflow {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  position: relative;
  z-index: 1;
  margin-bottom: 10px;
}

.create-workflow__scroll {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 0;
  /* 步骤标题不压缩时，窄视口可横向滚动，避免「项…」截断 */
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  flex: 1;
  padding: 4px 24px;
  scrollbar-width: thin;
  position: relative;
  isolation: isolate;
  z-index: 2;
  border: none;
  border-radius: 8px 8px 0 0;
  /* 叠在页面渐变上：高透明 + 强模糊，避免「描边框」感 */
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.05) 42%,
    rgba(255, 255, 255, 0.05) 100%
  );
  //backdrop-filter: blur(44px) saturate(1.9) brightness(1.06);
  //-webkit-backdrop-filter: blur(44px) saturate(1.9) brightness(1.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    0 12px 40px rgba(0, 0, 0, 0.22),
    0 2px 8px rgba(0, 0, 0, 0.12);
}

/* 顶部柔和高光层，模拟 iOS 玻璃折射 */
.create-workflow__scroll::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.14) 0%,
    rgba(255, 255, 255, 0.04) 28%,
    transparent 62%
  );
  z-index: 0;
}

.create-workflow__scroll > * {
  position: relative;
  z-index: 1;
}

.create-workflow__scroll::-webkit-scrollbar {
  height: 4px;
}

.create-workflow__scroll::-webkit-scrollbar-thumb {
  background: rgba(74, 231, 253, 0.25);
  border-radius: 4px;
}

.create-workflow__meta {
  flex-shrink: 0;
  padding-left: 0.5rem;
}

.create-workflow__progress {
  font-size: 12px;
  font-weight: 600;
  color: var(--home-muted, #8e97a5);
  white-space: nowrap;
}

.create-workflow--skeleton .create-workflow__scroll {
  gap: 0.5rem;
}

.flow-step-block {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
}

/* Figma：横向条上的单格约 191×40，竖向侧栏用圆角块 + 内边距 */
.flow-step-pill {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  padding: 0.5rem 0.625rem;
  min-height: 2.5rem;
  text-align: left;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  color: var(--home-muted, #8e97a5);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease;
  font: inherit;
  box-sizing: border-box;
}
//
//.flow-step-pill:hover:not(:disabled) {
//  border-color: rgba(74, 231, 253, 0.45);
//  background: linear-gradient(270deg, rgba(14, 89, 250, 0.3) 0%, rgba(0, 171, 216, 0.3) 100%);
//  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.12), 0 8px 24px rgba(0, 0, 0, 0.35);
//  color: var(--home-cyan, #4ae7fd);
//  border-radius: 100px 100px 100px 100px;
//}

//.flow-step-pill:focus-visible {
//  outline: 2px solid rgba(74, 231, 253, 0.45);
//  outline-offset: 2px;
//}

/* 顶部横向流程条：按内容撑开，保证「项目配置」等四字标题完整显示 */
.flow-step-pill-wrap {
  flex: 0 0 auto;
  display: inline-flex;
  max-width: 100%;
}

.flow-step-pill--strip {
  width: auto;
  min-width: auto;
  max-width: none;
  flex: 0 0 auto;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0 28px;
}

.flow-step-pill--strip .flow-step-pill__title {
  flex-shrink: 0;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
}

.flow-step-connector--h {
  width: 28px;
  height: 10px;
  min-width: 28px;
  margin: 0 2px;
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flow-step-connector__img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

/* 当前步骤后的一个连接图标：弱化底图，突出“逐步前进”的菱形动画 */
.flow-step-connector__img--next {
  opacity: 0.35;
}

.flow-step-connector--next {
  position: relative;
}

.flow-step-connector__march {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
}

.march-chevron {
  --size: 7px;
  --stroke: 2px;
  position: absolute;
  top: 50%;
  left: -2px;
  width: var(--size);
  height: var(--size);
  transform: translateY(-50%) rotate(45deg);
  border-top: var(--stroke) solid #4ae7fd;
  border-right: var(--stroke) solid #4ae7fd;
  border-radius: 1px;
  opacity: 0;
  box-shadow: 0 0 6px rgba(74, 231, 253, 0.55);
  animation: connectorChevronMarch 1.2s linear infinite;
}

.march-chevron.c2 {
  animation-delay: 0.4s;
}
.march-chevron.c3 {
  animation-delay: 0.8s;
}

.flow-step-connector--done .march-chevron {
  border-top-color: #00abd8;
  border-right-color: #00abd8;
}

.flow-step-pill--active {
  border-color: transparent;
  background: linear-gradient(135deg, rgba(14, 89, 250, 0.34) 0%, rgba(0, 171, 216, 0.26) 100%);
  backdrop-filter: blur(16px) saturate(1.55);
  -webkit-backdrop-filter: blur(16px) saturate(1.55);
  box-shadow:
    0 4px 22px rgba(14, 89, 250, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);
  color: var(--home-cyan, #4ae7fd);
  border-radius: 100px;
  padding: 0 28px;
}

.flow-step-pill--completed:not(.flow-step-pill--active) {
  color: rgba(230, 237, 243, 0.85);
}

.flow-step-pill--disabled {
  opacity: 0.45;
}

.flow-step-pill--locked-ahead:not(:disabled) {
  cursor: pointer;
}

.flow-step-pill:disabled {
  cursor: wait;
  opacity: 0.7;
}

.flow-step-pill__icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flow-step-pill__img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
  opacity: 0.92;
  filter: grayscale(0.15);
  margin-top: 2px;
}

.flow-step-pill--pending:not(.flow-step-pill--active) .flow-step-pill__img {
  opacity: 0.75;
}

.flow-step-pill__img--active {
  opacity: 1;
  filter: none;
}

.flow-step-pill__loading {
  font-size: 1.125rem;
  color: var(--home-cyan, #4ae7fd);
}

.flow-step-pill__check {
  font-size: 1rem;
  color: var(--home-cyan, #4ae7fd);
}

.flow-step-pill--active .flow-step-pill__check {
  color: #fff;
}

.flow-step-pill__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.flow-step-pill__title {
  font-size: 14px;
  line-height: 1.35;
  font-weight: 600;
  color: inherit;
}

.flow-step-pill--active .flow-step-pill__title {
  font-weight: 600;
  color: var(--home-cyan, #4ae7fd);
}

.flow-step-pill--completed:not(.flow-step-pill--active) .flow-step-pill__title {
  color: #ffffff;
}

.flow-step-pill__guide {
  font-size: 12px;
  line-height: 1.45;
  color: rgba(142, 151, 165, 0.95);
  font-weight: 400;
}

.flow-step-pill--active .flow-step-pill__guide {
  color: rgba(74, 231, 253, 0.75);
}

/* Figma 步骤间 32×10 渐变连接，竖向改为窄条 */
.flow-step-connector {
  align-self: center;
  width: 10px;
  height: 28px;
  margin: 2px 0;
  border-radius: 4px;
  flex-shrink: 0;
}

.flow-step-connector--skeleton {
  background: rgba(74, 231, 253, 0.08);
}

.flow-step-pill--skeleton {
  cursor: default;
  pointer-events: none;
  gap: 0.625rem;
}

.skeleton-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: rgba(74, 231, 253, 0.12);
  flex-shrink: 0;
}

.skeleton-line-flow-title {
  height: 12px;
  width: 72%;
  border-radius: 4px;
}
.preview_bg_box {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  z-index: 1;
  background: #111621;
  border: none;
  border-radius: 8px;
  margin: 10px 12px;
}
.preview-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: auto;
  margin: 0 12px 12px;
  overflow: hidden;
  //background: #111621;
  border-radius: 8px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(74, 231, 253, 0.1);
  background: rgba(12, 16, 24, 0.6);
}

.preview-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.preview-actions {
  display: flex;
  gap: 0.75rem;
}

.preview-content {
  position: relative;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--home-text, #e6edf3);
}

.create-step-swap-placeholder {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  background: rgba(6, 10, 18, 0.78);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
  cursor: progress;
}

.create-step-swap-placeholder__ico {
  font-size: 1.75rem;
  color: var(--home-accent, #4ae7fd);
}

.create-step-swap-placeholder__text {
  font-size: 0.9rem;
  color: var(--home-muted, #8e97a5);
}

.preview-content.step-global-setting {
  padding: 0;
  overflow: hidden;
}

.preview-content.step-story-script {
  padding: 0;
  overflow-y: auto;
}

.preview-content.step-series-script-upload {
  padding: 0;
}

.preview-content.step-series-episode-list {
  padding: 0;
}

.preview-content :deep(.storyboard-step) {
  /* 让内容根据列表高度自然撑开，交由 preview-content 滚动 */
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.preview-content:has(.storyboard-cards) {
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

/* 场景/角色/道具步：外层不滚动，由 SceneCharacterProp 内 .scp-content 承担滚动，顶栏与标题固定 */
.preview-content.step-preview {
  padding: 0;
  overflow: hidden;
}

.preview-content.step-preview :deep(.video-preview-step) {
  flex: 1;
  height: 100%;
  min-height: 0;
}

.preview-content.step-scene-character {
  overflow: hidden;
}

.preview-content.step-scene-character :deep(.create-step-scp) {
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.preview-content.step-scene-character :deep(.empty-asset-view) {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.step-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  overflow: visible;
}

.global-setting-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1.25rem;
  padding: 2rem 1.5rem;
  min-height: 280px;
}

.global-setting-placeholder__desc {
  margin: 0;
  max-width: 28rem;
  color: var(--home-muted, #8e97a5);
  font-size: 0.95rem;
  line-height: 1.6;
}

.global-setting-placeholder__hint {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(142, 151, 165, 0.85);
}

.step-content.story-script-wrapper {
  min-height: 480px;
}

.content-header {
  margin-bottom: 1rem;
}

.step-description-text {
  color: var(--home-muted, #8e97a5);
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
  font-weight: 500;
}

.form-section {
  flex: 1;
}

.setting-form {
  max-width: 100%;
}

.script-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.script-textarea {
  flex: 1;
  font-size: 1rem;
  line-height: 1.8;
}

.asset-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 第三步：提取中视图（占位，先对齐图5） */
.extracting-view {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid rgba(74, 231, 253, 0.15);
  border-radius: var(--radius-xl);
  background: rgba(12, 16, 24, 0.65);
  min-height: 520px;
}

.extracting-title {
  font-weight: 700;
  color: var(--home-text, #e6edf3);
}

.extracting-actions {
  display: flex;
  gap: 0.75rem;
}

.extracting-placeholder {
  flex: 1;
  border-top: 1px solid rgba(74, 231, 253, 0.12);
  padding-top: 1rem;
}

.dots {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(74, 231, 253, 0.45);
  animation: dotPulse 1.2s infinite ease-in-out;
}

@keyframes dotPulse {
  0% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.25);
  }
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
}

@keyframes connectorChevronMarch {
  0% {
    left: -2px;
    opacity: 0;
  }
  15% {
    opacity: 0.9;
  }
  70% {
    opacity: 1;
  }
  100% {
    left: calc(100% - 4px);
    opacity: 0;
  }
}

.assets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.add-asset-card {
  aspect-ratio: 1;
  border: 2px dashed rgba(74, 231, 253, 0.28);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--home-muted, #8e97a5);
  background: rgba(12, 16, 24, 0.4);
}

.add-asset-card:hover {
  border-color: rgba(74, 231, 253, 0.55);
  color: var(--home-cyan, #4ae7fd);
  background: rgba(14, 89, 250, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.add-icon {
  font-size: 3rem;
  font-weight: 300;
  margin-bottom: 0.5rem;
}

.asset-card {
  aspect-ratio: 1;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  cursor: pointer;
}

.asset-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.asset-card img {
  width: 100%;
  height: 80%;
  object-fit: cover;
}

.asset-name {
  padding: 0.75rem;
  font-weight: 500;
  text-align: center;
  background: rgba(12, 16, 24, 0.85);
  color: var(--home-text, #e6edf3);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--home-muted, #8e97a5);
  font-size: 1.125rem;
  font-weight: 500;
}

.preview-video {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-placeholder {
  width: 100%;
  max-width: 800px;
  aspect-ratio: 16 / 9;
  background: rgba(12, 16, 24, 0.75);
  border: 1px solid rgba(74, 231, 253, 0.12);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--home-muted, #8e97a5);
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  color: rgba(74, 231, 253, 0.35);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-layout {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .create-workflow {
    flex-wrap: wrap;
    padding: 0.5rem 0.75rem;
  }

  .create-workflow__meta {
    width: 100%;
    padding-left: 0;
    padding-top: 0.25rem;
  }

  .preview-panel {
    margin: 0 1rem 1rem;
  }

  .preview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .preview-actions {
    width: 100%;
  }

  .preview-actions .ant-btn {
    flex: 1;
  }

  .toolbar {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .toolbar-right {
    width: 100%;
  }

  .toolbar-right .ant-btn {
    flex: 1;
  }

  .toolbar-title-input-wrap {
    width: 100% !important;
    max-width: none !important;
  }

  .title-input {
    width: 100% !important;
  }

  .assets-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .flow-step-pill--strip {
    min-width: auto;
    max-width: none;
    padding: 0 0.5rem;
  }

  .preview-content {
    padding: 1rem;
  }

  .assets-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style lang="scss">
/* 下拉/引导 tooltip 挂到 body，需非 scoped */
.preview-export-dropdown-overlay,
.preview-export-dropdown-overlay .ant-dropdown-menu {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  border: none !important;
}

/* 蓝湖「成品预览」导出下拉：面板 230×130、按钮 182×32、描边/悬停半透明青底 */
.preview-export-menu {
  width: 230px;
  padding: 12px 24px 16px;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.3);
  background: #121212;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
}

.preview-export-menu__btn-wrap {
  display: block;
  width: 182px;
  max-width: 100%;
}

.preview-export-menu__btn-wrap .preview-export-menu__btn {
  width: 100%;
}

.preview-export-menu__title {
  color: #8e97a5;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;
  margin-bottom: 0;
}

.preview-export-menu__btn {
  width: 182px;
  max-width: 100%;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 1);
  background: rgba(18, 18, 18, 0.8);
  color: transparent;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}

.preview-export-menu__btn .text-gradient,
.preview-export-menu__btn-text {
  display: inline;
  white-space: nowrap;
  line-height: 1.2;
  color: #fff;
  -webkit-text-fill-color: #fff;
  background: none;
  -webkit-background-clip: unset;
  background-clip: unset;
}

.preview-export-menu__btn:hover:not(:disabled) {
  background: rgba(74, 231, 253, 0.2);
  border-color: rgba(74, 231, 253, 1);
}

.preview-export-menu__btn:hover:not(:disabled) .text-gradient,
.preview-export-menu__btn:hover:not(:disabled) .preview-export-menu__btn-text {
  color: #fff;
  -webkit-text-fill-color: #fff;
}

.preview-export-menu__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 顶栏「导出视频」：取消悬停上移与背景色变化 */
.toolbar-right .toolbar-btn-export.ant-btn-primary:hover,
.toolbar-right .toolbar-btn-export.ant-btn-primary:focus {
  transform: none !important;
  box-shadow: none !important;
  background: var(--home-grad, linear-gradient(270deg, #0e59fa 0%, #00abd8 100%)) !important;
  color: #fff !important;
}

.toolbar-right .toolbar-btn-export.ant-btn-primary:active {
  transform: none !important;
}

/* 发布引导呼吸灯：沿用项目青色高亮（--home-cyan #4ae7fd）光晕脉动 */
.toolbar-right .toolbar-btn-guide-breathing.ant-btn-primary,
.flow-step-pill--guide-breathing {
  animation: publishGuideBreathing 1.6s ease-in-out infinite;
}

.flow-step-pill--guide-breathing {
  position: relative;
  z-index: 2;
  border-radius: 10px;
}

@keyframes publishGuideBreathing {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(74, 231, 253, 0.55);
  }
  50% {
    box-shadow:
      0 0 6px 2px rgba(74, 231, 253, 0.55),
      0 0 22px 8px rgba(14, 89, 250, 0.35);
  }
}

/* 引导 tooltip「请先完成作品」：深色圆角气泡，与项目风格一致 */
.publish-guide-tooltip .ant-tooltip-inner {
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(28, 32, 40, 0.96);
  border: 1px solid rgba(74, 231, 253, 0.18);
  box-shadow: 0 8px 24px rgba(8, 12, 24, 0.45);
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  min-height: 0;
}

.publish-guide-tooltip .ant-tooltip-arrow::before,
.publish-guide-tooltip .ant-tooltip-arrow::after {
  background: rgba(28, 32, 40, 0.96);
}
</style>
