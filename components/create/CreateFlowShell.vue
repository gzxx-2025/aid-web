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
              v-for="n in 7"
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
        mode="create"
        :works-active="createSidebarView === 'works'"
        :assets-active="createSidebarView === 'assets'"
        @brand="goHomeFromCreate"
        @gallery="goHomeFromCreate"
        @works="openWorksPanel"
        @assets="openAssetsPanel"
        @login="goLogin"
        @recharge="onRecharge"
        @toggle-user-menu="toggleUserMenu"
      />

      <!-- 右侧：嵌入「我的作品 / 资产库」或与流程编辑区互斥 -->
      <div
        class="create-main"
        :class="{ 'create-main--embed-lib': pageReady && createSidebarView !== 'flow' }"
      >
        <div class="create-main__transition-wrap">
          <Transition name="create-main-switch" mode="out-in">
            <div
              v-if="pageReady && createSidebarView === 'works'"
              key="works"
              class="create-main__embed-scroll"
            >
              <WorksLibraryPanel
                embedded
                @switch-to-flow="onWorksEmbedSwitchToFlow"
                @open-create="onWorksEmbedOpenCreate"
              />
            </div>
            <div
              v-else-if="pageReady && createSidebarView === 'assets'"
              key="assets"
              class="create-main__embed-scroll"
            >
              <AssetsLibraryPanel />
            </div>
            <div v-else key="flow" class="create-main__flow-stack">
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
                    <div class="toolbar-title-input-wrap">
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
                    <div class="toolbar-title-input-wrap">
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
                      />
                    </div>
                  </div>
                  <span class="toolbar-series-episode-count"
                    >共{{ seriesEpisodeCountLabel }}集</span
                  >
                </div>
              </div>
              <div v-else class="toolbar">
                <div class="toolbar-left">
                  <button type="button" class="back-btn" @click="goBack">
                    <LeftOutlined />
                  </button>
                  <div class="toolbar-title-block">
                    <div class="toolbar-title-input-wrap">
                      <span ref="titleMeasureEl" class="title-input-measure" aria-hidden="true">{{
                        titleMeasureText
                      }}</span>
                      <a-input
                        v-model:value="creationStore.workTitle"
                        placeholder="作品名称"
                        class="title-input"
                        size="large"
                        :bordered="false"
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
                    @click="saveDraft"
                  >
                    <div class="text-gradient">存草稿</div>
                  </a-button>
                  <a-button
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
                <div v-if="!isSeriesFlowChrome" class="create-workflow">
                  <div class="create-workflow__scroll">
                    <template v-for="(step, index) in steps" :key="step.key">
                      <button
                        type="button"
                        class="flow-step-pill flow-step-pill--strip"
                        :class="{
                          'flow-step-pill--active': flowStepIndex === index,
                          'flow-step-pill--completed': stepStatus[index] === 'completed',
                          'flow-step-pill--pending': stepStatus[index] === 'pending',
                          'flow-step-pill--disabled': stepStatus[index] === 'disabled',
                          'flow-step-pill--locked-ahead': index > unlockedStepIndex
                        }"
                        :disabled="toolbarPrimaryLoading || stepApiLoading"
                        @pointerenter="preloadCreateStepRoute(index)"
                        @click="handleStepClick(index)"
                      >
                        <span class="flow-step-pill__icon" aria-hidden="true">
                          <LoadingOutlined
                            v-if="
                              step.key === 'scene-character' &&
                              (creationStore.isExtractingAssets ||
                                creationStore.isGeneratingStep3Visual)
                            "
                            class="flow-step-pill__loading"
                            spin
                          />
                          <LoadingOutlined
                            v-else-if="
                              step.key === 'storyboard-script' &&
                              (creationStore.isGeneratingStoryboard ||
                                creationStore.isGeneratingStoryboardImageBatch)
                            "
                            class="flow-step-pill__loading"
                            spin
                          />
                          <LoadingOutlined
                            v-else-if="
                              step.key === 'storyboard-video' &&
                              (creationStore.isGeneratingStoryboardVideo ||
                                creationStore.isGeneratingStoryboard)
                            "
                            class="flow-step-pill__loading"
                            spin
                          />
                          <LoadingOutlined
                            v-else-if="
                              step.key === 'dubbing' &&
                              (isDubbingStepGenerating || creationStore.isGeneratingStoryboard)
                            "
                            class="flow-step-pill__loading"
                            spin
                          />
                          <img
                            v-else
                            :src="
                              stepFlowIcons[step.key][
                                flowStepIndex === index || stepStatus[index] === 'completed'
                                  ? 'sel'
                                  : 'nor'
                              ]
                            "
                            alt=""
                            class="flow-step-pill__img"
                            :class="{
                              'flow-step-pill__img--active':
                                flowStepIndex === index || stepStatus[index] === 'completed'
                            }"
                          />
                        </span>
                        <span class="flow-step-pill__title">{{ step.title }}</span>
                      </button>
                      <div
                        v-if="index < steps.length - 1"
                        class="flow-step-connector flow-step-connector--h"
                        :class="{
                          'flow-step-connector--done': isConnectorTrailDone(index),
                          'flow-step-connector--next': flowStepIndex === index
                        }"
                      >
                        <img
                          :src="isConnectorTrailDone(index) ? processIconSel : processIconNor"
                          alt=""
                          class="flow-step-connector__img"
                          :class="{ 'flow-step-connector__img--next': flowStepIndex === index }"
                        />
                        <span
                          v-if="flowStepIndex === index"
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
          </Transition>
        </div>
      </div>
    </div>

    <!-- 第三步：智能体选择弹窗 -->
    <ExtractAgentModal
      v-model:open="creationStore.showExtractAgentModal"
      :agents="creationStore.extractAgents"
      :model-codes="creationStore.extractModelCodes"
      :scope="extractModalScope"
      @update:agents="updateExtractAgents"
      @update:model-codes="updateExtractModelCodes"
      @start="startExtractAssets"
    />

    <CreateFirstStepModal
      :open="homeCreateModal.showCreateFirstStepModal"
      :confirm-loading="homeCreateModal.createConfirmLoading"
      :title="homeCreateModal.creationTitleDraft"
      :project-type="homeCreateModal.creationProjectTypeDraft"
      :sync-project-type-from-parent="homeCreateModal.syncProjectTypeFromParent"
      :aspect-ratio="homeCreateModal.creationGlobalSettingDraft.aspectRatio"
      :script-type="homeCreateModal.creationGlobalSettingDraft.scriptType"
      :model-strategy="homeCreateModal.creationGlobalSettingDraft.modelStrategy"
      :creation-mode="homeCreateModal.creationGlobalSettingDraft.creationMode"
      :model-value="homeCreateModal.creationGlobalSettingDraft"
      @update:open="homeCreateModal.showCreateFirstStepModal = $event"
      @update:title="homeCreateModal.creationTitleDraft = $event"
      @update:project-type="homeCreateModal.creationProjectTypeDraft = $event"
      @update:aspect-ratio="homeCreateModal.updateGlobalSettingDraftField('aspectRatio', $event)"
      @update:script-type="homeCreateModal.updateGlobalSettingDraftField('scriptType', $event)"
      @update:model-strategy="
        homeCreateModal.updateGlobalSettingDraftField('modelStrategy', $event)
      "
      @update:creation-mode="homeCreateModal.updateGlobalSettingDraftField('creationMode', $event)"
      @update:model-value="homeCreateModal.patchGlobalSettingDraftStyle($event)"
      @confirm="onHomeCreateFirstConfirm"
    />
    <RechargeModal v-model:open="showRechargeModal" @paid="handleRechargePaid" />
    <ProjectGenConfigModal
      v-model:open="showProjectGenConfigModal"
      :project-id="activeProjectId"
    />
    <UserMenuDropdown
      ref="userMenuDropdownRef"
      :open="showUserMenuCard"
      :floating-style="userMenuCardStyle"
      @faq="openFaq"
      @billing="openBilling"
      @about="openAbout"
      @logout="handleLogout"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 创作流程壳层：侧栏、流程条、工具栏、弹窗与 provide。
 * 业务逻辑已拆至 composables（原 pages/create/index.vue 单文件脚本）。
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, provide } from 'vue'
import { message } from 'ant-design-vue'
import { LeftOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import HomeSidebar from '~/components/layout/HomeSidebar.vue'
import WorksLibraryPanel from '~/components/home/WorksLibraryPanel.vue'
import AssetsLibraryPanel from '~/components/home/AssetsLibraryPanel.vue'
import type { CreationStep } from '~/types'
import CreateFirstStepModal from '~/components/steps/CreateFirstStepModal.vue'
import ExtractAgentModal from '~/components/steps/ExtractAgentModal.vue'
import ProjectGenConfigModal from '~/components/steps/ProjectGenConfigModal.vue'
import GlobalGenerateTaskPopover from '~/components/steps/GlobalGenerateTaskPopover.vue'
import RechargeModal from '~/components/common/RechargeModal.vue'
import UserMenuDropdown from '~/components/common/UserMenuDropdown.vue'
import {
  routePathToCreationStep,
  creationStepToRoutePath,
  isCreateFlowEmbeddedLibraryPanel,
  isSeriesScriptUploadPath,
  isSeriesEpisodeListPath,
  isSeriesFlowChromePath
} from '~/utils/createFlowRoutes'
import { createFlowShellKey } from '~/utils/createFlowInjection'
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
import { useCreateFlowExtractAgents } from '~/composables/useCreateFlowExtractAgents'
import { useCreateFlowGlobalSettingModal } from '~/composables/useCreateFlowGlobalSettingModal'
import { useCreateFlowRouteAndSteps } from '~/composables/useCreateFlowRouteAndSteps'
import { useCreateFlowSidebarChrome } from '~/composables/useCreateFlowSidebarChrome'
import { useHomeShellCreateModal } from '~/composables/useHomeShellCreateModal'
import { useCreateFlowTitleMeasure } from '~/composables/useCreateFlowTitleMeasure'
import { htmlPlainTextLength } from '~/utils/htmlPlain'
import { userAssetExtractCancel, userProjectUpdate, userTaskCancel } from '~/utils/businessApi'
import { resumeStoryboardPromptGenerateTask } from '~/utils/storyboardPromptGenerateFlow'
import { resumeStoryboardVideoGenerateTask } from '~/composables/useStoryboardVideoGenerateTask'
import { normUserTaskType } from '~/utils/taskPartialFailed'
import type { UserTaskRow } from '~/types/business-api'

const route = useRoute()
const createStepSwapPlaceholder = useState('create-flow-step-swap-placeholder', () => false)

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
const homeCreateModal = useHomeShellCreateModal()

const seriesEpisodeCountLabel = computed(() => {
  const n = creationStore.seriesEpisodeListTotal
  return n != null && n >= 0 ? String(n) : '—'
})

const pageReady = ref(false)
const isDubbingGenerating = ref(false)
const isDubbingStepGenerating = computed(
  () => isDubbingGenerating.value || (creationStore.dubbingBatchGeneratingIndices?.length ?? 0) > 0
)

const storyboardSync = useCreateFlowStoryboardSync()
const extract = useCreateFlowExtractAgents()
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
  nextStepSubmitting,
  toolbarPrimaryLabel,
  toolbarPrimaryDisabled,
  goBack,
  saveDraft,
  syncProjectContextFromRoute,
  fetchCreationStepStatus,
  isStepCompleted,
  isConnectorTrailDone,
  goToCreateStep
} = routeSteps

const nextStepDelayLoading = ref(false)
const showProjectGenConfigModal = ref(false)

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
  const ty = normCancelTaskType(task.taskType)
  const stepIndex = ty === 'storyboard_script_batch' ? 3 : 2
  const status = String(task?.status ?? '').toUpperCase()
  await goToCreateStep(stepIndex)
  if (status === 'FAILED' && ty === 'storyboard_script_batch') {
    window.dispatchEvent(
      new CustomEvent('create-flow-restart-task', {
        detail: { taskId, taskType: task.taskType ?? null }
      })
    )
  } else {
    creationStore.removePausedTaskFollow(taskId)
    window.dispatchEvent(
      new CustomEvent('create-flow-track-task', {
        detail: { taskId, taskType: task.taskType ?? null }
      })
    )
  }
  window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
}

function resolveResumeTaskStepIndex(taskType: unknown): number {
  const ty = normUserTaskType(taskType)
  if (
    ty === 'storyboard_script_batch' ||
    ty === 'storyboard_image_prompt_batch' ||
    ty === 'storyboard_video_prompt_batch'
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
  const hide = message.loading('正在续生...', 0)
  try {
    if (ty === 'storyboard_image_prompt_batch') {
      const outcome = await resumeStoryboardPromptGenerateTask(taskId, 'image')
      if (outcome.ok === false) {
        message.error(outcome.errorMessage)
        return
      }
      if (outcome.ok && 'partial' in outcome && outcome.partial) {
        message.warning(outcome.partialWarning)
      } else {
        message.success('分镜图提示词续生完成')
      }
      return
    }
    if (ty === 'storyboard_video_prompt_batch') {
      const outcome = await resumeStoryboardPromptGenerateTask(taskId, 'video')
      if (outcome.ok === false) {
        message.error(outcome.errorMessage)
        return
      }
      if (outcome.ok && 'partial' in outcome && outcome.partial) {
        message.warning(outcome.partialWarning)
      } else {
        message.success('分镜视频提示词续生完成')
      }
      return
    }
    if (ty === 'storyboard_video_generate') {
      const outcome = await resumeStoryboardVideoGenerateTask({ taskId })
      if (!outcome.ok) {
        message.error('errorMessage' in outcome ? outcome.errorMessage || '续生失败' : '续生失败')
        return
      }
      message.success('分镜视频续生已提交')
      return
    }

    await goToCreateStep(resolveResumeTaskStepIndex(task.taskType))
    window.dispatchEvent(
      new CustomEvent('create-flow-resume-task', {
        detail: { taskId, taskType: task.taskType ?? null }
      })
    )
  } catch (e: unknown) {
    message.error(bizErrMsg(e) || '续生失败')
  } finally {
    hide()
    window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
  }
}

function normCancelTaskType(ty: unknown): string {
  return String(ty ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
}

function bizErrMsg(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return String(x?.msg ?? x?.message ?? (e as Error)?.message ?? '')
}

/**
 * 停止任务：优先走文档 `POST /api/user/asset/extract/cancel`（提取、v2.28+ 形态/生图父任务等）；
 * 若返回「任务不符」等则回退 `POST /api/user/task/cancel`。
 */
async function requestCancelUserTask(task: UserTaskRow): Promise<void> {
  const taskId = parseTaskId(task.id)
  if (!taskId) throw new Error('任务ID无效')
  const ty = normCancelTaskType(task.taskType)

  if (ty === 'asset_extract') {
    await userAssetExtractCancel({ taskId })
    return
  }

  const tryExtractCancelFirst = new Set([
    'form_image',
    'form_image_batch',
    'form_generate',
    'form_generate_batch'
  ])
  if (tryExtractCancelFirst.has(ty)) {
    try {
      await userAssetExtractCancel({ taskId })
      return
    } catch (e: unknown) {
      const m = bizErrMsg(e)
      if (m.includes('任务不符') || m.includes('不支持')) {
        await userTaskCancel({ taskId })
        return
      }
      throw e
    }
  }

  await userTaskCancel({ taskId })
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
  if (toolbarPrimaryDisabled.value || toolbarPrimaryLoading.value) return
  nextStepDelayLoading.value = true
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 500))
    await runNextStep()
  } finally {
    nextStepDelayLoading.value = false
  }
}

const {
  globalSettingConfirmLoading,
  creationTitleDraft,
  globalSettingProjectTypeDraft,
  creationGlobalSettingDraft,
  patchGlobalSettingDraftStyle,
  updateGlobalSettingDraftField,
  handleGlobalSettingConfirm,
  syncGlobalSettingDraftFromStore
} = globalSetting

const globalSettingProjectTypeLocked = computed(() => creationStore.currentProjectType === 'movie')

const globalSettingContext = {
  confirmLoading: globalSettingConfirmLoading,
  titleDraft: creationTitleDraft,
  projectTypeDraft: globalSettingProjectTypeDraft,
  draft: creationGlobalSettingDraft,
  projectTypeLocked: globalSettingProjectTypeLocked,
  syncFromStore: syncGlobalSettingDraftFromStore,
  updateField: updateGlobalSettingDraftField,
  patchStyle: patchGlobalSettingDraftStyle,
  save: () => handleGlobalSettingConfirm({ navigateAfterSave: false })
}

const {
  createSidebarView,
  setPanel,
  showRechargeModal,
  showUserMenuCard,
  userMenuTriggerRef,
  userMenuDropdownRef,
  userMenuCardStyle,
  goLogin,
  goHomeFromCreate,
  openWorksPanel,
  openAssetsPanel,
  toggleUserMenu,
  openFaq,
  openBilling,
  openAbout,
  handleLogout,
  handleDocumentClick,
  updateUserMenuPosition,
  onRecharge,
  handleRechargePaid,
  handleOpenRechargeByEvent
} = sidebar

watch(
  () => homeSidebarRef.value?.userMenuTriggerRef,
  (trigger) => {
    userMenuTriggerRef.value = trigger ?? null
  },
  { flush: 'post' }
)

function onWorksEmbedSwitchToFlow() {
  setPanel('flow')
}

function onWorksEmbedOpenCreate(tab: 'film' | 'series') {
  homeCreateModal.openCreateModal({ worksTab: tab })
}

function onHomeCreateFirstConfirm() {
  return homeCreateModal.handleCreateConfirm()
}

const { titleMeasureEl, titleMeasureText, syncTitleInputWidth } = titleMeasure

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
  jumpToStoryboardScriptFromVideo: storyboardSync.handleJumpToStoryboardScriptFromVideo,
  clearStoryboardScriptJumpTooltip: storyboardSync.clearStoryboardScriptJumpTooltip,
  storyboardScriptTooltipTargetIndex: storyboardSync.storyboardScriptTooltipTargetIndex,
  storyboardScriptTooltipKey: storyboardSync.storyboardScriptTooltipKey,
  syncVideoAndDubbingFromScriptPanels: storyboardSync.syncVideoAndDubbingFromScriptPanels,
  setDubbingGenerating: (v: boolean) => {
    isDubbingGenerating.value = v
  },
  globalSetting: globalSettingContext,
  openProjectGenConfig
})

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', updateUserMenuPosition)
  window.addEventListener('scroll', updateUserMenuPosition, true)
  window.addEventListener('open-recharge-modal', handleOpenRechargeByEvent as EventListener)
  nextTick(() => {
    syncProjectContextFromRoute()
    if (creationStore.currentStepIndex < 0 || creationStore.currentStepIndex >= steps.length) {
      creationStore.setCurrentStepIndex(0)
    }
    pageReady.value = true
    fetchCreationStepStatus()
  })
})

watch(
  () => [route.query.projectId, route.query.id, route.query.workId, route.query.episodeId],
  () => {
    syncProjectContextFromRoute()
  }
)

/** 第三步 bootstrap 与剧本均就绪后再尝试自动弹窗（切作品时二者完成顺序不固定） */
watch(
  () => ({
    ready: creationStore.step3AssetListSyncReady,
    path: route.path,
    hasScript: htmlPlainTextLength(creationStore.formData.storyScript.content || '') > 0,
    onFlowMainView:
      createSidebarView.value === 'flow' && !isCreateFlowEmbeddedLibraryPanel(route.query)
  }),
  ({ ready, path, hasScript, onFlowMainView }) => {
    if (!ready || !hasScript || !onFlowMainView) return
    if (routePathToCreationStep(path) !== 'scene-character') return
    nextTick(() => {
      extract.openExtractAgentModalIfNeeded('current-route')
    })
  },
  { flush: 'post' }
)

watch(
  () => isSeriesFlowChrome.value,
  (on) => {
    if (on) nextTick(() => syncWorkTitleSaveBaseline())
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', updateUserMenuPosition)
  window.removeEventListener('scroll', updateUserMenuPosition, true)
  window.removeEventListener('open-recharge-modal', handleOpenRechargeByEvent as EventListener)
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
  padding: 20px 14px 0;
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
  width: 88% !important;
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
  min-height: 56px;
  padding: 0 20px 0 16px;
  flex-shrink: 0;
}

.toolbar-left--wrap {
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
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

.create-main__embed-scroll > .home-sub-page {
  flex: 1;
  min-height: 0;
}

.create-main__embed-scroll > .home-sub-page.assets-library-figma .assets-lib-grid-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
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
  overflow-x: hidden;
  overflow-y: hidden;
  min-width: 0;
  flex: 1;
  padding: 4px 48px;
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

/* 顶部横向流程条（Figma 约 191×40 / 格） */
.flow-step-pill--strip {
  width: auto;
  min-width: 0;
  max-width: none;
  //flex: 1 1 0;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0 0.65rem;
}

.flow-step-pill--strip .flow-step-pill__title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
    min-width: 4.5rem;
    max-width: 9rem;
    padding: 0 0.45rem;
  }

  .preview-content {
    padding: 1rem;
  }

  .assets-grid {
    grid-template-columns: 1fr;
  }
}
</style>
