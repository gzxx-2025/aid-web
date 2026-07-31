<template>
  <div class="dubbing-step create-step-dubbing storyboard-step" data-onboarding="dubbing-track">
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
          <span>配音完成进度：{{ progressText }}</span>
          <LoadingOutlined
            v-if="isSyncGeneratingStoryboard || batchGeneratingIndicesArray.length > 0"
            class="storyboard-progress-icon storyboard-progress-loading"
            spin
          />
        </div>
      </div>
      <div class="storyboard-toolbar-right">
        <StoryboardToolbarOpsDropdown
          v-if="!isSyncGeneratingStoryboard || dubOnboardingShowToolbar"
          v-model:open="toolbarOpsOpen"
          :items="dubbingToolbarOpsItems"
          :loading="batchDeleteSubmitting || batchGeneratingIndicesArray.length > 0"
          :disabled="panels.length === 0"
          @select="handleDubbingToolbarOpsSelect"
        />
      </div>
    </div>

    <div
      :class="[
        'storyboard-step-shell dubbing-wrap',
        {
          'storyboard-step-shell--has-list dubbing-wrap--has-list': panels.length > 0,
          'storyboard-step-shell--bootstrap-pending': showDubbingBootstrapMask
        }
      ]"
    >
      <div
        v-if="showDubbingBootstrapMask"
        class="storyboard-list-bootstrap-mask"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <LoadingOutlined spin class="storyboard-list-bootstrap-mask__icon" />
        <p class="storyboard-list-bootstrap-mask__text">正在同步音画同步列表…</p>
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
      <div v-else-if="showDubbingEmptyState" class="storyboard-empty-content">
        <div class="storyboard-empty-inner">
          <div class="storyboard-empty-icon-wrap">
            <img :src="emptyFjIcon" alt="" />
          </div>
          <p class="storyboard-empty-title">暂无音画同步</p>
          <p class="dubbing-empty-desc">请先在「分镜设计」中生成分镜，音画同步列表将自动生成。</p>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-else-if="viewMode === 'list'" class="storyboard-list">
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
          :class="{ 'storyboard-list--dragging': isDubbingDragging }"
          ghost-class="storyboard-list-item--ghost"
          chosen-class="storyboard-list-item--chosen"
          drag-class="storyboard-list-item--dragging"
          @start="onDubbingDragStart"
          @end="onDubbingDragEnd"
          @change="onDubbingListDragChange"
        >
          <template #item="{ element: panel, index }">
            <div
              class="storyboard-list-item"
              @mouseenter="hoverIndex = index"
              @mouseleave="hoverIndex = null"
            >
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
                    <span class="storyboard-title-text">{{ displayPanelTitle(panel, index) }}</span>
                  </template>
                </div>
                <div class="storyboard-list-actions">
                  <button class="storyboard-action-link" type="button" @click="emit('go-step', 3)">
                    分镜设计
                  </button>
                  <button class="storyboard-action-link" type="button" @click="emit('go-step', 4)">
                    视频生成
                  </button>
                  <a-button size="small" @click="handleEditDubbing(index)">
                    <LoadingOutlined
                      v-if="isDubbingBatchGenerating(index)"
                      spin
                      class="dubbing-edit-btn-loading"
                    />
                    <span>编辑分镜配音</span>
                  </a-button>
                  <a-button size="small" @click="handleCopyPanel(index)"> 复制分镜 </a-button>
                  <a-button size="small" danger @click="removePanel(index)"> 删除分镜 </a-button>
                </div>
              </div>
              <!-- 主体区：高度与分镜脚本/分镜视频列表行一致；遮罩铺满本区域（不含顶部标题与操作按钮） -->
              <div class="dubbing-list-body-shell">
                <div class="dubbing-list-body dubbing-list-body--compact">
                  <div class="dubbing-video-block">
                    <div class="storyboard-block-title">音画同步：</div>
                    <div
                      class="dubbing-video-area dubbing-video-area--list"
                      :class="{
                        'has-video': hasVideoForIndex(index),
                        'is-generating': isDubbingBatchGenerating(index)
                      }"
                    >
                      <template v-if="isDubbingBatchGenerating(index)">
                        <div class="dubbing-video-generating">
                          <LoadingOutlined spin class="dubbing-video-generating-icon" />
                          <span>生成中...</span>
                        </div>
                      </template>
                      <template v-else-if="hasVideoForIndex(index)">
                        <ShimmerVideo
                          :src="getVideoUrlForIndex(index)"
                          video-class="dubbing-video-preview"
                          wrapper-class="dubbing-video-shimmer"
                          object-fit="cover"
                          reveal-direction="fade"
                        />
                        <button
                          type="button"
                          class="dubbing-video-play-btn"
                          title="预览视频"
                          aria-label="预览视频"
                          @click.stop="handlePreviewDubbingVideo(index)"
                        />
                      </template>
                      <template v-else>
                        <div class="dubbing-video-placeholder dubbing-video-placeholder--list" />
                      </template>
                    </div>
                  </div>
                  <div class="dubbing-info-block dubbing-info-block--list">
                    <div class="storyboard-block-title">台词：</div>
                    <template v-if="isDubbingBatchGenerating(index)">
                      <div class="dubbing-skeleton">
                        <div class="dubbing-skeleton-line dubbing-skeleton-line--lg" />
                        <div class="dubbing-skeleton-line dubbing-skeleton-line--md" />
                        <div class="dubbing-skeleton-line dubbing-skeleton-line--sm" />
                      </div>
                    </template>
                    <template v-else>
                      <div class="dubbing-dialogue-render">
                        {{ getRenderedDialogue(index) }}
                      </div>
                      <div class="dubbing-meta dubbing-meta--inline">
                        <div class="dubbing-meta-item">
                          <span class="dubbing-meta-label">配音类型：</span>
                          <span class="dubbing-meta-value">{{
                            panel.dubbingType || '旁白/画外音'
                          }}</span>
                        </div>
                        <div class="dubbing-meta-item">
                          <span class="dubbing-meta-label">发言角色：</span>
                          <span class="dubbing-meta-value">{{ panel.speakerRole || '艾米' }}</span>
                        </div>
                      </div>
                      <div class="dubbing-status dubbing-status--list">
                        <span class="dubbing-status-label">状态：</span>
                        <span
                          :class="[
                            'dubbing-status-value',
                            panel.status === 'done' ? 'done' : 'pending'
                          ]"
                        >
                          {{ panel.status === 'done' ? '已配音' : '未配音' }}
                        </span>
                      </div>
                    </template>
                  </div>
                </div>
                <!-- 无分镜视频时：鼠标移入铺满主体区的遮罩 -->
                <Transition name="dubbing-mask-fade">
                  <div
                    v-show="!hasVideoForIndex(index) && hoverIndex === index"
                    class="dubbing-body-mask"
                    @click.stop="goToStoryboardVideo()"
                  >
                    <a-button type="primary" class="dubbing-mask-btn dubbing-mask-btn--list">
                      前往视频生成
                    </a-button>
                    <p class="dubbing-mask-tip">暂无分镜数据，添加视频后即可进行音画同步</p>
                  </div>
                </Transition>
              </div>
            </div>
          </template>
        </Draggable>
      </div>

      <!-- 卡片视图：点击「卡片」按钮后以网格卡片形式展示音画同步列表 -->
      <div v-else class="storyboard-cards dubbing-cards">
        <div
          v-for="(panel, index) in panels"
          :key="panel.id"
          class="storyboard-card dubbing-card"
          @mouseenter="hoverIndex = index"
          @mouseleave="hoverIndex = null"
        >
          <div class="storyboard-card-header">
            <div class="storyboard-card-title">
              <span class="storyboard-card-title-text">{{ displayPanelTitle(panel, index) }}</span>
            </div>
            <a-dropdown
              trigger="click"
              placement="bottomRight"
              overlay-class-name="dubbing-card-menu-overlay"
            >
              <a-button type="text" size="small" class="storyboard-card-more" @click.stop>
                <template #icon><MoreOutlined /></template>
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="emit('go-step', 3)">@分镜设计</a-menu-item>
                  <a-menu-item @click="emit('go-step', 4)">@视频生成</a-menu-item>
                  <a-menu-item @click="handleEditDubbing(index)">
                    <LoadingOutlined
                      v-if="isDubbingBatchGenerating(index)"
                      spin
                      class="dubbing-edit-btn-loading"
                    />
                    编辑分镜配音
                  </a-menu-item>
                  <a-menu-item @click="handleCopyPanel(index)">复制分镜</a-menu-item>
                  <a-menu-item danger @click="removePanel(index)">删除分镜</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
          <div class="dubbing-card-body-shell">
            <div class="storyboard-card-body dubbing-card-body-inner">
              <div class="dubbing-video-block dubbing-video-block--card">
                <div class="storyboard-block-title dubbing-card-video-title">音画同步：</div>
                <div
                  class="dubbing-video-area card-video-area dubbing-video-area--card"
                  :class="{
                    'has-video': hasVideoForIndex(index),
                    'is-generating': isDubbingBatchGenerating(index)
                  }"
                >
                  <template v-if="isDubbingBatchGenerating(index)">
                    <div class="dubbing-video-generating">
                      <LoadingOutlined spin class="dubbing-video-generating-icon" />
                      <span>生成中...</span>
                    </div>
                  </template>
                  <template v-else-if="hasVideoForIndex(index)">
                    <ShimmerVideo
                      :src="getVideoUrlForIndex(index)"
                      video-class="dubbing-video-preview"
                      wrapper-class="dubbing-video-shimmer"
                      object-fit="cover"
                      reveal-direction="fade"
                    />
                    <button
                      type="button"
                      class="dubbing-video-play-btn dubbing-video-play-btn--card"
                      title="预览视频"
                      aria-label="预览视频"
                      @click.stop="handlePreviewDubbingVideo(index)"
                    />
                  </template>
                  <template v-else>
                    <div class="dubbing-video-placeholder dubbing-video-placeholder--card" />
                  </template>
                </div>
              </div>
              <div class="storyboard-block-title dubbing-card-subtitle">台词：</div>
              <template v-if="isDubbingBatchGenerating(index)">
                <div class="dubbing-skeleton dubbing-skeleton--card">
                  <div class="dubbing-skeleton-line dubbing-skeleton-line--lg" />
                  <div class="dubbing-skeleton-line dubbing-skeleton-line--sm" />
                </div>
              </template>
              <div v-else class="dubbing-dialogue-render dubbing-dialogue-render--card">
                {{ getRenderedDialogue(index) }}
              </div>
            </div>
            <Transition name="dubbing-mask-fade">
              <div
                v-show="!hasVideoForIndex(index) && hoverIndex === index"
                class="dubbing-body-mask dubbing-body-mask--card"
                @click.stop="goToStoryboardVideo()"
              >
                <a-button type="primary" class="dubbing-mask-btn">
                  <template #icon><VideoCameraOutlined /></template>
                  前往视频生成
                </a-button>
                <p class="dubbing-mask-tip">暂无分镜数据，添加视频后即可进行音画同步</p>
              </div>
            </Transition>
          </div>
          <!-- 遮罩不包含底部状态栏 -->
          <div class="dubbing-card-footer">
            <span :class="['dubbing-status-value', panel.status === 'done' ? 'done' : 'pending']">
              <InfoCircleOutlined class="dubbing-footer-icon" />
              {{ panel.status === 'done' ? '已配音' : '未配音' }}
            </span>
            <span class="dubbing-card-role">
              <UserOutlined class="dubbing-footer-icon" />
              发言角色: {{ panel.speakerRole || '艾米' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <EditStoryboardDubbingModal
      v-if="dubbingEditModalOpen"
      :key="`storyboard-dubbing-${panels[dubbingEditSceneIndex]?.id ?? dubbingEditSceneIndex}`"
      v-model:open="dubbingEditModalOpen"
      :scene-index="dubbingEditSceneIndex"
      :editor-scope-key="`storyboard-dubbing-${panels[dubbingEditSceneIndex]?.id ?? dubbingEditSceneIndex}`"
      :dubbing-panels="panels"
      :storyboard-video-panels="videoPanels"
      :storyboard-script-panels="scriptPanels"
      :batch-generating-indices="batchGeneratingIndicesArray"
      @update:panels="onDubbingPanelsSave"
      @update:storyboard-video-panels="(v) => emit('update:storyboardVideoPanels', v)"
    />

    <BatchRegenerateDubbingModal
      v-if="batchRegenerateModalOpen"
      v-model:open="batchRegenerateModalOpen"
      :title="batchRegenerateModalTitle"
      :preselect-all="batchRegeneratePreselectAll"
      :panels="panels"
      :script-panels="scriptPanels"
      :video-panels="videoPanels"
      :scene-characters="sceneCharacters"
      @batch-generate="onBatchGenerate"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  defineAsyncComponent,
  inject,
  nextTick,
  onMounted,
  onBeforeUnmount,
  onUnmounted,
  watch
} from 'vue'
import { Modal, message } from 'ant-design-vue'
import listNorIcon from '~/assets/img/icon/list-nor.svg'
import listSelIcon from '~/assets/img/icon/list-sel.svg'
import cardNorIcon from '~/assets/img/icon/card-nor.svg'
import cardSelIcon from '~/assets/img/icon/card-sel.svg'
import emptyFjIcon from '~/assets/img/icon/empty-fj.svg'
import generatingCenterIcon from '~/assets/img/icon/tmp00000001.png'
import {
  InfoCircleOutlined,
  MoreOutlined,
  DeleteOutlined,
  VideoCameraOutlined,
  UserOutlined,
  LoadingOutlined,
  AudioOutlined,
  HolderOutlined
} from '@ant-design/icons-vue'
import type { DubbingPanel, StoryboardVideoPanel, StoryboardPanel } from '~/types'
import ShimmerVideo from '~/components/common/ShimmerVideo.vue'
import { useStoryboardAudioBatchGenerate } from '~/composables/useStoryboardAudioBatchGenerate'
import { openVideoPreviewModal } from '~/utils/openVideoPreviewModal'
import { useCreationStore } from '~/stores/creation'
import { moveItemBeforeIndex } from '~/utils/moveItemBeforeIndex'
import Draggable from 'vuedraggable'
import {
  STORYBOARD_WORKBENCH_NEED_PROJECT_MSG,
  useStoryboardWorkbenchMutations
} from '~/composables/useStoryboardWorkbenchMutations'
import StoryboardToolbarOpsDropdown, {
  type StoryboardOpsMenuItem
} from './StoryboardToolbarOpsDropdown.vue'
import {
  extractStoryboardTitleSuffix,
  formatStoryboardDubbingTitle,
  formatStoryboardScriptTitle,
  formatStoryboardVideoTitle,
  resolveStoryboardListDisplayTitle
} from '~/utils/storyboardPanelTitle'
import { createDefaultDubbingPanel } from '~/composables/useCreateFlowStoryboardSync'
import {
  userStoryboardList,
  userStoryboardUpdate,
  userStoryboardUnSetFinalAudio
} from '~/utils/businessApi'
import { resolveStoryboardAudioRecordId } from '~/utils/storyboardFinalRecordId'
import { getPanelStoryboardVideo } from '~/utils/storyboardVideoCover'
import { useStoryboardDubbingBackgroundRestore } from '~/composables/useStoryboardDubbingBackgroundRestore'
import { useCreateFlowScopeChangedResume } from '~/composables/useCreateFlowLiveGenResume'
import { createCoalescedAsyncRunner } from '~/utils/coalescedAsyncRunner'
import { createFlowShellKey } from '~/utils/createFlowInjection'
import {
  consumeCreateFlowStepModalIntent,
  createFlowStepModalIntent,
  peekCreateFlowStepModalIntent
} from '~/utils/createFlowStepModalIntent'
import {
  hasPersistedStoryboardScriptBatchGenWork,
  hasPersistedStoryboardVideoBatchGenWork
} from '~/utils/storyboardListBootstrap'
import { isDubbingFlowStepGenerating } from '~/utils/storyboardFlowStepLoading'
import AsyncModalLoading from '~/components/common/AsyncModalLoading.vue'
import {
  createPreloadableAsyncComponent,
  preloadComponentWhenIdle
} from '~/utils/preloadableAsyncComponent'

const editStoryboardDubbingModalLoader = createPreloadableAsyncComponent(
  () => import('./EditStoryboardDubbingModal.vue'),
  AsyncModalLoading
)
const EditStoryboardDubbingModal = editStoryboardDubbingModalLoader.component
let cancelEditStoryboardDubbingModalPreload: (() => void) | null = null
const BatchRegenerateDubbingModal = defineAsyncComponent(
  () => import('./BatchRegenerateDubbingModal.vue')
)

const route = useRoute()

interface Props {
  description: string
  modelValue: DubbingPanel[]
  /** 分镜视频列表，用于判断是否有视频、编辑分镜配音前校验 */
  storyboardVideoPanels?: StoryboardVideoPanel[]
  /** 分镜脚本：台词自动取自对应分镜的脚本内容 */
  storyboardScriptPanels?: StoryboardPanel[]
  /** 素材准备中的角色列表，用于「替换发言角色」弹窗 */
  sceneCharacters?: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: DubbingPanel[]): void
  (e: 'go-step', stepIndex: number): void
  (e: 'update:storyboardVideoPanels', value: StoryboardVideoPanel[]): void
  (e: 'generating', value: boolean): void
}>()

const creationStore = useCreationStore()
const createFlowShell = inject(createFlowShellKey, null)
const wb = useStoryboardWorkbenchMutations()

const storyboardListLoading = computed(() => createFlowShell?.storyboardListLoading.value ?? false)
const storyboardListSyncReady = computed(
  () => createFlowShell?.storyboardListSyncReady.value ?? true
)

function hasOngoingDubbingGenWork(): boolean {
  if (!storyboardListSyncReady.value) {
    if (hasPersistedStoryboardScriptBatchGenWork(creationStore, route)) return true
    if (hasPersistedStoryboardVideoBatchGenWork(creationStore, route)) return true
    return false
  }
  return isDubbingFlowStepGenerating(creationStore, route)
}

const showDubbingBootstrapMask = computed(
  () =>
    (storyboardListLoading.value || !storyboardListSyncReady.value) && !hasOngoingDubbingGenWork()
)
const viewMode = ref<'list' | 'card'>('list')
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const hoverIndex = ref<number | null>(null)
const dubbingEditModalOpen = ref(false)
const dubbingEditSceneIndex = ref(0)

const panels = computed(() => props.modelValue || [])
const scriptPanels = computed(() => (props.storyboardScriptPanels || []) as StoryboardPanel[])
const videoPanels = computed(() => props.storyboardVideoPanels || [])

const dubbingBackgroundRestore = useStoryboardDubbingBackgroundRestore(creationStore, route)
const storyboardAudioBatchGen = useStoryboardAudioBatchGenerate()
let pageDisposed = false
let pageMounted = false
let dubbingRestoreGeneration = 0
let storyboardAudioFollowHandoffRequested = false
const listInteractive = ref(true)
const batchRegenerateOverwrite = ref(false)

async function runStoryboardDubbingRestoreOnce() {
  if (!import.meta.client || !pageMounted || pageDisposed || !creationStore.isHydrated) return
  const gen = ++dubbingRestoreGeneration
  const restoreIsActive = () => pageMounted && !pageDisposed && gen === dubbingRestoreGeneration
  const waitForFollowHandoff = storyboardAudioFollowHandoffRequested
  storyboardAudioFollowHandoffRequested = false
  if (waitForFollowHandoff) {
    await storyboardAudioBatchGen.waitForFollowIdle()
    if (!restoreIsActive()) return
  }
  await dubbingBackgroundRestore.restoreOngoingDubbingTasks(
    panels.value,
    scriptPanels.value,
    videoPanels.value,
    (next) => {
      if (!restoreIsActive()) return
      emit('update:modelValue', next)
    }
  )
  if (!restoreIsActive()) return
  await storyboardAudioBatchGen.restoreOngoingBatchIfNeeded({
    panels: panels.value,
    scriptPanels: scriptPanels.value,
    onPanelsUpdate: (next) => {
      if (!restoreIsActive()) return
      emit('update:modelValue', next)
    },
    onGenerating: (v) => {
      if (!restoreIsActive()) return
      emit('generating', v)
    }
  })
}

const storyboardDubbingRestoreRunner = createCoalescedAsyncRunner(runStoryboardDubbingRestoreOnce)

function restoreStoryboardDubbingTasksIfNeeded() {
  if (!import.meta.client || !pageMounted || pageDisposed || !creationStore.isHydrated) {
    return Promise.resolve()
  }
  return storyboardDubbingRestoreRunner.request()
}

onMounted(() => {
  pageMounted = true
  cancelEditStoryboardDubbingModalPreload = preloadComponentWhenIdle(
    editStoryboardDubbingModalLoader.preload
  )
  void restoreStoryboardDubbingTasksIfNeeded()
})

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
    dubbingRestoreGeneration += 1
    storyboardAudioFollowHandoffRequested = true
    dubbingBackgroundRestore.cancelPendingRestore()
    void storyboardAudioBatchGen.cancelResumeFollow()
    void restoreStoryboardDubbingTasksIfNeeded()
  },
  { flush: 'sync' }
)

/** 挂载后由 watch 补跑最新 scope；未水合时先短路，isHydrated 翻转后自动恢复。 */
watch(
  () =>
    [
      creationStore.isHydrated,
      creationStore.currentProjectId,
      creationStore.currentEpisodeId,
      route.query.projectId,
      route.query.episodeId,
      panels.value.length
    ] as const,
  () => {
    if (!creationStore.isHydrated) return
    void restoreStoryboardDubbingTasksIfNeeded()
  },
  { immediate: true }
)

useCreateFlowScopeChangedResume(() => {
  // 项目/剧集切换由同步 watch 完成交接；流程 Tab 返回只请求当前 scope 恢复。
  return restoreStoryboardDubbingTasksIfNeeded()
})

onBeforeUnmount(() => {
  pageMounted = false
  pageDisposed = true
  storyboardDubbingRestoreRunner.dispose()
  dubbingRestoreGeneration += 1
  listInteractive.value = false
  dubbingBackgroundRestore.cancelPendingRestore()
  storyboardAudioBatchGen.cancelResumeFollow()
})

onUnmounted(() => {
  cancelEditStoryboardDubbingModalPreload?.()
  cancelEditStoryboardDubbingModalPreload = null
  dubbingBackgroundRestore.cancelPendingRestore()
  if (import.meta.client) {
    window.removeEventListener(
      ONBOARDING_PREPARE_ANCHOR_EVENT,
      handleOnboardingPrepareAnchor as EventListener
    )
  }
})
const batchRegenerateModalOpen = ref(false)
const batchRegenerateModalTitle = ref('批量生成分镜配音')
const batchRegeneratePreselectAll = ref(false)
const toolbarOpsOpen = ref(false)

function handleOnboardingPrepareAnchor(e: Event) {
  const anchor = (e as CustomEvent<{ anchor?: string }>).detail?.anchor
  if (anchor === 'dub-batch-dubbing') {
    toolbarOpsOpen.value = true
    return
  }
  if (anchor === 'dub-close-dropdown') {
    toolbarOpsOpen.value = false
  }
}
const batchDeleteSubmitting = ref(false)
const isDubbingDragging = ref(false)
/** 转为数组供编辑弹窗使用，用于弹窗内头部 tab 与右侧列表的 loading（按作品存在 Pinia） */
const batchGeneratingIndicesArray = computed(() => [...creationStore.dubbingBatchGeneratingIndices])

function isDubbingBatchGenerating(index: number) {
  return creationStore.dubbingBatchGeneratingIndices.includes(index)
}

function displayPanelTitle(panel: DubbingPanel, index: number): string {
  return resolveStoryboardListDisplayTitle(panel.title, index, 'dubbing')
}
const sceneCharacters = computed(() => props.sceneCharacters || [])

function storyboardApiErr(e: unknown): string {
  const x = e as { msg?: string; message?: string }
  return x?.msg || x?.message || '操作失败'
}

function onDubbingDragStart() {
  isDubbingDragging.value = true
}

function onDubbingDragEnd() {
  isDubbingDragging.value = false
}

interface DubbingDragChangeEvent {
  moved?: {
    oldIndex: number
    newIndex: number
  }
}

async function onDubbingListDragChange(evt: DubbingDragChangeEvent) {
  const moved = evt?.moved
  if (!moved) return
  const from = moved.oldIndex
  const to = moved.newIndex
  const insertBeforeIndex = from < to ? to + 1 : to
  await applyDubbingStepReorder(from, insertBeforeIndex)
}

async function applyDubbingStepReorder(from: number, insertBefore: number) {
  const s = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  const v = [...creationStore.formData.storyboardVideo.panels]
  const d = [...(creationStore.formData.dubbing.panels as DubbingPanel[])]
  if (d.length <= 1) return
  const nextS = moveItemBeforeIndex(s, from, insertBefore)
  const nextV = v.length === nextS.length ? moveItemBeforeIndex(v, from, insertBefore) : v
  const nextD = moveItemBeforeIndex(d, from, insertBefore)
  creationStore.formData.storyboardScript.panels = nextS
  creationStore.formData.storyboardVideo.panels = nextV
  creationStore.formData.dubbing.panels = nextD
  emit('update:modelValue', nextD)
  if (nextS.length > 0 && nextS.every((p) => wb.parseServerStoryboardId(p.id) != null)) {
    try {
      await wb.sortRemoteToMatchPanels(nextS)
    } catch (err: unknown) {
      message.warning(`排序同步失败：${storyboardApiErr(err)}`)
    }
  }
}
const isSyncGeneratingStoryboard = computed(() => creationStore.isGeneratingStoryboard)
const showScriptSyncGeneratingView = computed(
  () =>
    (isSyncGeneratingStoryboard.value &&
      panels.value.length === 0 &&
      !creationStore.storyboardGenerationError) ||
    (!storyboardListSyncReady.value &&
      hasPersistedStoryboardScriptBatchGenWork(creationStore, route))
)
const showDubbingEmptyState = computed(
  () =>
    !showScriptSyncGeneratingView.value &&
    !showDubbingBootstrapMask.value &&
    panels.value.length === 0
)
const syncGenerationPercent = computed(() => {
  const total = Number(creationStore.storyboardGenerationProgress.total || 0)
  const completed = Number(creationStore.storyboardGenerationProgress.completed || 0)
  if (total <= 0) return 0
  const percent = Math.round((completed / total) * 100)
  return Math.min(100, Math.max(0, percent))
})

/** 分镜脚本 / 配音台词常为富文本 HTML（含复制分镜后的副本），列表区只展示纯文本 */
function stripDialogueHtmlForDisplay(raw: string): string {
  const t = (raw || '').trim()
  if (!t) return ''
  if (import.meta.client && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(t, 'text/html')
      const text = doc.body.textContent ?? ''
      const normalized = text
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (normalized) return normalized
    } catch {
      /* 回退到正则 */
    }
  }
  return t
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 台词：自动渲染（分镜脚本内容 / 自动配音文案），非可编辑文本域 */
function getRenderedDialogue(index: number): string {
  const script = scriptPanels.value[index]?.scriptContent?.trim()
  if (script) return stripDialogueHtmlForDisplay(script)
  const d = panels.value[index]?.dialogue?.trim()
  if (d) return stripDialogueHtmlForDisplay(d)
  return '将在完善分镜设计或「批量生成分镜配音」后展示台词。'
}

const progressText = computed(() => {
  const done = panels.value.filter((p) => p.status === 'done').length
  return `${done}/${panels.value.length}`
})

const dubbingCompletedCount = computed(
  () =>
    panels.value.filter(
      (p) => !!(p.dubbingLipSyncVideoUrl && String(p.dubbingLipSyncVideoUrl).trim())
    ).length
)

const dubbingBatchGenerateLabel = computed(() =>
  dubbingCompletedCount.value > 0 ? '重新批量生成分镜配音' : '批量生成分镜配音'
)

const dubbingToolbarOpsItems = computed((): StoryboardOpsMenuItem[] => [
  {
    key: 'batch-dubbing',
    label: dubbingBatchGenerateLabel.value,
    icon: AudioOutlined,

    disabled: panels.value.length === 0 || batchGeneratingIndicesArray.value.length > 0,
    disabledTooltip:
      panels.value.length === 0 ? '暂无分镜，请先在「分镜设计」中生成分镜' : undefined
  },
  {
    key: 'batch-delete',
    label: '批量删除',
    icon: DeleteOutlined,
    danger: true,
    disabled: panels.value.length === 0 || batchDeleteSubmitting.value
  }
])

function handleDubbingToolbarOpsSelect(key: string) {
  if (key === 'batch-dubbing') {
    openBatchDubbingModal()
    return
  }
  if (key === 'batch-delete') {
    handleBatchDeleteDubbingPanels()
  }
}

function openBatchDubbingModal() {
  if (panels.value.length === 0) {
    message.warning('暂无分镜，请先在「分镜设计」中生成分镜')
    return
  }
  batchRegenerateModalTitle.value = dubbingBatchGenerateLabel.value
  batchRegenerateOverwrite.value = dubbingCompletedCount.value > 0
  batchRegeneratePreselectAll.value = false
  batchRegenerateModalOpen.value = true
}

function handleBatchDeleteDubbingPanels() {
  const count = panels.value.length
  if (!count || batchDeleteSubmitting.value) return
  Modal.confirm({
    title: '确认批量删除全部音画同步结果？',
    content: `将清除当前 ${count} 条分镜的音画同步数据（不删除分镜脚本与分镜视频），且不可恢复。`,
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
        const scripts = [...scriptPanels.value] as StoryboardPanel[]
        let finalAudioIdByStoryboard = new Map<number, number | null>()
        try {
          const rows = await userStoryboardList({
            projectId: ctx.projectId,
            episodeId: ctx.episodeId
          })
          finalAudioIdByStoryboard = new Map(rows.map((r) => [r.id, r.finalAudioId ?? null]))
        } catch {
          /* 列表拉取失败时仍尝试用本地 recordId 取消 */
        }
        for (let i = 0; i < scripts.length; i++) {
          const sp = scripts[i]
          const sid = sp ? wb.parseServerStoryboardId(sp.id) : null
          if (sid == null) continue
          const panel = panels.value[i]
          const recordId = resolveStoryboardAudioRecordId(panel, finalAudioIdByStoryboard.get(sid))
          if (recordId != null) {
            try {
              await userStoryboardUnSetFinalAudio({ storyboardId: sid, recordId })
            } catch {
              /* 幂等：无最终配音或已被取消时忽略 */
            }
          }
          try {
            await userStoryboardUpdate({ id: sid, dialogueText: '' })
          } catch {
            /* 单条同步失败不阻断其余 */
          }
        }
        const next = panels.value.map((p) => ({
          ...p,
          dialogue: '',
          status: 'pending' as const,
          dubbingEmotion: undefined,
          dubbingLipSync: false,
          dubbingVoiceName: undefined,
          dubbingVoiceAvatarUrl: undefined,
          dubbingLipSyncVideoUrl: undefined,
          dubbingLipSyncKey: undefined,
          dubbingUploadedAudioUrl: undefined,
          dubbingGenHistory: undefined,
          storyboardDubbingConfirmed: false
        }))
        emit('update:modelValue', next)
        message.success('已删除全部音画同步结果')
      } catch (e: unknown) {
        message.error(storyboardApiErr(e))
        throw e
      } finally {
        batchDeleteSubmitting.value = false
      }
    }
  })
}

/** 对应分镜视频是否已设置主视频（含已生成的音画同步视频） */
function getVideoForIndex(index: number) {
  const dub = panels.value[index]
  if (dub?.dubbingLipSyncVideoUrl) {
    return { url: dub.dubbingLipSyncVideoUrl, title: '音画同步', isDubbingOutput: true }
  }
  const panel = videoPanels.value[index]
  const mainVideo = getPanelStoryboardVideo(panel)
  return mainVideo?.url ? mainVideo : null
}

function hasVideoForIndex(index: number): boolean {
  const v = getVideoForIndex(index)
  return !!v?.url
}

function getVideoUrlForIndex(index: number): string {
  const v = getVideoForIndex(index)
  return v?.url || ''
}

function goToStoryboardVideo() {
  emit('go-step', 4)
}

/** 音画同步：弹窗预览视频（与图片预览同壳层，适配各分辨率） */
function handlePreviewDubbingVideo(index: number) {
  const v = getVideoForIndex(index)
  const url = v?.url
  if (!url) {
    message.warning('暂无视频可预览')
    return
  }
  const title = v?.title || panels.value[index]?.title || `音画同步 ${index + 1}`
  openVideoPreviewModal({ url, title })
}

/** 编辑分镜配音：无分镜视频时先提示 */
function handleEditDubbing(index: number) {
  if (!hasVideoForIndex(index)) {
    message.warning('请先生成该分镜的视频片段，再进行音画同步。请先到「视频生成」步骤添加视频。')
    emit('go-step', 4)
    return
  }
  void editStoryboardDubbingModalLoader.preload()
  dubbingEditSceneIndex.value = index
  dubbingEditModalOpen.value = true
}

/** 消费跨步骤意图：打开对应分镜音画同步弹窗 */
function tryConsumeStepModalIntent() {
  if (pageDisposed) return
  const pending = peekCreateFlowStepModalIntent()
  if (!pending || pending.kind !== 'storyboard-dubbing') return
  if (pending.panelIndex < 0 || pending.panelIndex >= panels.value.length) return
  const index = consumeCreateFlowStepModalIntent('storyboard-dubbing')
  if (index == null) return
  viewMode.value = 'list'
  nextTick(() => {
    if (pageDisposed) return
    handleEditDubbing(index)
  })
}

watch(
  () => [panels.value.length, createFlowStepModalIntent.value?.token] as const,
  () => {
    tryConsumeStepModalIntent()
  },
  { immediate: true }
)

async function onBatchGenerate(
  selectedPanelIds: string[],
  options: {
    overwrite?: boolean
  }
) {
  if (selectedPanelIds.length === 0) return

  const panelIndices = selectedPanelIds
    .map((id) => panels.value.findIndex((p) => p.id === id))
    .filter((i) => i >= 0)

  if (!panelIndices.length) return

  const overwrite = options.overwrite ?? batchRegenerateOverwrite.value
  const result = await storyboardAudioBatchGen.runBatchForIndices({
    panelIndices,
    scriptPanels: scriptPanels.value,
    panels: panels.value,
    overwrite,
    onPanelsUpdate: (next) => {
      if (pageDisposed) return
      emit('update:modelValue', next)
    },
    onGenerating: (v) => {
      if (pageDisposed) return
      emit('generating', v)
    }
  })
  if (pageDisposed || !result.ok) return
}

function onDubbingPanelsSave(next: DubbingPanel[]) {
  const cloned = next.map((p) => ({ ...p }))
  // 弹窗内大量 update:panels 仅用于本地 UI（生成历史 / 对口型状态），须先回写本地
  emit('update:modelValue', cloned)
  creationStore.formData.dubbing.panels = cloned

  const idx = dubbingEditSceneIndex.value
  if (idx < 0 || idx >= cloned.length) return

  const scripts = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  const sp = scripts[idx]
  if (!sp) return

  const prevDialogue = sp.dialogueText != null ? String(sp.dialogueText).trim() : ''
  const dialogue = cloned[idx]?.dialogue != null ? String(cloned[idx]!.dialogue).trim() : ''
  // 台词未变：不调 /api/user/storyboard/update（打开弹窗同步 compose 历史时会连发多次 panels）
  if (dialogue === prevDialogue) return

  const sid = wb.parseServerStoryboardId(sp.id)
  if (sid == null) {
    message.warning('该分镜未同步到服务器，无法保存配音信息，请刷新分镜列表后重试')
    return
  }

  scripts[idx] = {
    ...sp,
    dialogueText: dialogue || null,
    // 用户改过台词后，服务端清洗字幕需等下次 list 刷新；先清空以免预览字幕过期
    subtitleText: null
  }
  if (cloned[idx]) {
    cloned[idx] = { ...cloned[idx]!, subtitleText: null }
  }
  creationStore.formData.storyboardScript.panels = scripts
  creationStore.formData.dubbing.panels = cloned
  emit('update:modelValue', cloned)

  void (async () => {
    try {
      await wb.saveRemote({
        id: sid,
        title: scripts[idx]!.title,
        ...(dialogue ? { dialogueText: dialogue } : {})
      })
    } catch (e: unknown) {
      message.warning(`配音信息同步失败：${storyboardApiErr(e)}`)
    }
  })()
}

const startEditTitle = (panel: DubbingPanel) => {
  editingId.value = panel.id
  editingTitle.value = panel.title
}

const finishEditTitle = async (panel: DubbingPanel) => {
  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    editingId.value = null
    return
  }

  const idx = panels.value.findIndex((p) => p.id === panel.id)
  const nextTitleRaw = editingTitle.value.trim() || panel.title
  const nextTitle =
    idx >= 0
      ? formatStoryboardDubbingTitle(idx, extractStoryboardTitleSuffix(nextTitleRaw))
      : nextTitleRaw
  const nextPanels = panels.value.map((item) =>
    item.id === panel.id ? { ...item, title: nextTitle } : item
  )
  emit('update:modelValue', nextPanels)
  editingId.value = null

  if (idx < 0) return
  const scriptList = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  const sp = scriptList[idx]
  const sid = sp ? wb.parseServerStoryboardId(sp.id) : null
  if (!sp || sid == null) {
    message.warning('该分镜未同步到服务器，无法保存标题，请刷新分镜列表后重试')
    return
  }
  scriptList[idx] = {
    ...sp,
    title: formatStoryboardScriptTitle(idx, extractStoryboardTitleSuffix(nextTitle))
  }
  creationStore.formData.storyboardScript.panels = scriptList
  try {
    await wb.saveRemote({ id: sid, title: scriptList[idx]!.title })
  } catch (e: unknown) {
    message.warning(`标题同步失败：${storyboardApiErr(e)}`)
  }
}

const cancelEditTitle = () => {
  editingId.value = null
  editingTitle.value = ''
}

const handleCopyPanel = async (index: number) => {
  const ctx = await wb.getProjectEpisodeContext()
  if (!ctx) {
    message.warning(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
    return
  }
  const scripts = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
  const srcScript = scripts[index]
  const srcSid = srcScript ? wb.parseServerStoryboardId(srcScript.id) : null
  if (!srcScript || srcSid == null) {
    message.warning('该分镜未同步到服务器，无法复制，请刷新分镜列表后重试')
    return
  }

  const panel = panels.value[index]
  if (!panel) return
  const nextIndex = panels.value.length
  const suffix = extractStoryboardTitleSuffix(panel.title) || `${panel.title}_副本`
  let newScript: StoryboardPanel
  try {
    const newScriptTitle = formatStoryboardScriptTitle(
      nextIndex,
      extractStoryboardTitleSuffix(srcScript.title) || '未命名'
    )
    const data = await wb.createRemote(newScriptTitle)
    if (!data) throw new Error('no data')
    newScript = {
      id: String(data.id),
      title: (data.title && data.title.trim()) || newScriptTitle,
      scriptContent: srcScript.scriptContent,
      dialogueText: srcScript.dialogueText,
      subtitleText: srcScript.subtitleText,
      finalVideoUrl: srcScript.finalVideoUrl
    }
    const newSid = wb.parseServerStoryboardId(newScript.id)
    if (newSid != null) {
      const story = wb.scriptHtmlToStoryScriptApi(srcScript.scriptContent)
      const d = srcScript.dialogueText != null ? String(srcScript.dialogueText).trim() : ''
      await wb.saveRemote({
        id: newSid,
        title: newScript.title,
        ...(story !== undefined ? { storyScript: story } : {}),
        ...(d ? { dialogueText: d } : {})
      })
    }
  } catch (e: unknown) {
    message.error(storyboardApiErr(e))
    return
  }

  const videos = [...(creationStore.formData.storyboardVideo.panels as StoryboardVideoPanel[])]
  const srcVideo = videos[index]
  const newVideo: StoryboardVideoPanel = srcVideo
    ? {
        ...srcVideo,
        id: `video-${newScript.id}-${nextIndex}`,
        title: formatStoryboardVideoTitle(nextIndex, extractStoryboardTitleSuffix(srcVideo.title))
      }
    : {
        id: `video-${newScript.id}-${nextIndex}`,
        title: formatStoryboardVideoTitle(nextIndex, extractStoryboardTitleSuffix(newScript.title)),
        videos: []
      }

  const newPanel: DubbingPanel = createDefaultDubbingPanel(newScript, nextIndex)
  newPanel.id = `dubbing-${newScript.id}-${nextIndex}`
  newPanel.dialogue = panel.dialogue
  newPanel.subtitleText = panel.subtitleText
  newPanel.dubbingType = panel.dubbingType
  newPanel.speakerRole = panel.speakerRole
  newPanel.status = 'pending'
  if (suffix && suffix !== `${panel.title}_副本`) {
    newPanel.title = formatStoryboardDubbingTitle(nextIndex, suffix)
  }
  const nextScripts = [...scripts, newScript]
  const nextVideos = [...videos, newVideo]
  const nextDubbings = [...panels.value, newPanel]
  creationStore.formData.storyboardScript.panels = nextScripts
  creationStore.formData.storyboardVideo.panels = nextVideos
  emit('update:storyboardVideoPanels', nextVideos)
  emit('update:modelValue', nextDubbings)
  if (nextScripts.every((p) => wb.parseServerStoryboardId(p.id) != null)) {
    try {
      await wb.sortRemoteToMatchPanels(nextScripts)
    } catch {
      /* 排序失败不阻断复制成功提示 */
    }
  }
  message.success('分镜已复制')
}

const removePanel = (idx: number) => {
  Modal.confirm({
    title: '确认删除分镜?',
    content: '将同时删除该条音画同步结果及对应的分镜脚本、分镜视频。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const ctx = await wb.getProjectEpisodeContext()
      if (!ctx) {
        message.error(STORYBOARD_WORKBENCH_NEED_PROJECT_MSG)
        throw new Error('no project context')
      }
      const scripts = [...(creationStore.formData.storyboardScript.panels as StoryboardPanel[])]
      const sp = scripts[idx]
      const sid = sp ? wb.parseServerStoryboardId(sp.id) : null
      if (!sp || sid == null) {
        message.error('该分镜未同步到服务器，无法删除，请刷新分镜列表后重试')
        throw new Error('no server storyboard id')
      }
      try {
        await wb.deleteRemote(sp.id)
      } catch (e: unknown) {
        message.error(storyboardApiErr(e))
        throw e
      }

      const nextScripts = scripts.filter((_, i) => i !== idx)
      const nextVideos = (
        creationStore.formData.storyboardVideo.panels as StoryboardVideoPanel[]
      ).filter((_, i) => i !== idx)
      const nextPanels = panels.value.filter((_, i) => i !== idx)
      creationStore.formData.storyboardScript.panels = nextScripts
      creationStore.formData.storyboardVideo.panels = nextVideos
      emit('update:storyboardVideoPanels', nextVideos)
      emit('update:modelValue', nextPanels)
      message.success('分镜已删除')
    }
  })
}

onMounted(() => {
  if (panels.value.length === 0 && creationStore.storyboardGenerationError) {
    creationStore.clearStoryboardScriptGenerationOutcome()
  }
  if (import.meta.client) {
    window.addEventListener(
      ONBOARDING_PREPARE_ANCHOR_EVENT,
      handleOnboardingPrepareAnchor as EventListener
    )
  }
})
</script>

<style scoped>
.dubbing-step {
  width: 100%;
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

.dubbing-empty-desc {
  margin: 0;
  font-size: 13px;
  color: #8e97a5;
  text-align: center;
  max-width: 22rem;
  line-height: 1.5;
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

.dubbing-edit-btn-loading {
  margin-right: 6px;
  font-size: 14px;
}

.dubbing-list-body--compact {
  display: grid;
  grid-template-columns: 1fr 4fr;
  gap: 0.75rem;
  align-items: stretch;
  height: 100%;
  min-height: 0;
  padding: 0.75rem;
  box-sizing: border-box;
}

.dubbing-video-block {
  min-width: 0;
}

.storyboard-block-title {
  font-size: 0.82rem;
  color: var(--home-muted, #8e97a5);
  margin-bottom: 0.35rem;
  font-weight: 600;
}

.dubbing-video-area {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: rgba(6, 10, 18, 0.55);
}

/* 列表：与视频生成步骤预览区同高 200px */
.dubbing-video-area--list {
  height: 200px;
  min-height: 200px;
  max-height: 200px;
  border: 1px dashed rgba(74, 231, 253, 0.3);
}

.dubbing-video-area.is-generating {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dubbing-video-generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--accent-600);
  font-size: 14px;
  font-weight: 500;
}

.dubbing-video-generating-icon {
  font-size: 28px;
}

.dubbing-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dubbing-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgba(74, 231, 253, 0.12) 25%,
    rgba(74, 231, 253, 0.22) 50%,
    rgba(74, 231, 253, 0.12) 75%
  );
  background-size: 200% 100%;
  animation: dubbing-skeleton-shine 1.2s ease-in-out infinite;
}

.dubbing-skeleton-line--lg {
  width: 100%;
}

.dubbing-skeleton-line--md {
  width: 75%;
}

.dubbing-skeleton-line--sm {
  width: 50%;
}

.dubbing-skeleton--card .dubbing-skeleton-line--lg {
  width: 100%;
}

.dubbing-video-area.has-video .dubbing-video-shimmer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.dubbing-video-area.has-video .dubbing-video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dubbing-card-video-title {
  margin-bottom: 0.35rem;
}

.dubbing-video-placeholder--list {
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: transparent;
}

.dubbing-mask-fade-enter-active,
.dubbing-mask-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dubbing-mask-fade-enter-from,
.dubbing-mask-fade-leave-to {
  opacity: 0;
}

/* 铺满主体区（不含头部标题与按钮）的遮罩 */
.dubbing-body-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(0, 0, 0, 0.52);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  cursor: pointer;
  border-radius: var(--radius-md);
}

.dubbing-mask-btn {
  border-radius: var(--radius-full);
  font-weight: 600;
}

.dubbing-mask-btn--list {
  height: 36px;
  padding: 0 1.25rem;
  font-size: 0.9rem;
}

.dubbing-body-mask .dubbing-mask-tip {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.92);
  text-align: center;
  padding: 0 1.25rem;
  line-height: 1.45;
  max-width: 420px;
}

.dubbing-info-block--list {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.dubbing-dialogue-render {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--home-text, #e6edf3);
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0.45rem 0.55rem;
  border-radius: var(--radius-sm);
}

.dubbing-meta--inline {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-top: 0.35rem;
  flex-shrink: 0;
}

.dubbing-status--list {
  margin-top: auto;
  padding-top: 0.35rem;
  flex-shrink: 0;
}

.dubbing-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dubbing-meta-item {
  font-size: 0.85rem;
  color: var(--home-text, #e6edf3);
}

.dubbing-meta-label {
  color: var(--home-muted, #8e97a5);
  margin-right: 0.35rem;
}

.dubbing-meta-value {
  font-weight: 500;
}

.dubbing-status {
  margin-top: auto;
  font-size: 0.85rem;
}

.dubbing-status-label {
  color: var(--home-muted, #8e97a5);
  margin-right: 0.35rem;
}

.dubbing-status-value.pending {
  color: var(--home-muted, #8e97a5);
}

.dubbing-status-value.done {
  color: #52c41a;
  font-weight: 600;
}

/* 卡片视图布局见 assets/css/storyboard-step-shared.css */
.storyboard-cards.dubbing-cards {
  padding-top: 0.5rem;
}

.storyboard-card-title-text {
  font-size: inherit;
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

.dubbing-card-body-inner {
  padding: 0.75rem 0 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dubbing-card-body-shell {
  position: relative;
  padding: 0 1rem;
}

.dubbing-card .dubbing-video-block {
  margin-bottom: 0;
}

.dubbing-video-area--card {
  cursor: default;
}

.dubbing-list-body .dubbing-video-area--card {
  height: 140px;
  min-height: 140px;
  max-height: 140px;
}

.dubbing-video-area--card.has-video .dubbing-video-shimmer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.dubbing-video-area--card.has-video .dubbing-video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dubbing-video-placeholder--card {
  width: 100%;
  height: 100%;
  background: rgba(6, 10, 18, 0.55);
}

.dubbing-card-subtitle {
  margin-bottom: 0.15rem !important;
}

.dubbing-dialogue-render--card {
  max-height: 52px;
  overflow-y: auto;
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--home-text, #e6edf3);
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0.35rem 0.45rem;
  border: 1px solid rgba(74, 231, 253, 0.12);
  border-radius: var(--radius-sm);
  background: var(--create-surface-canvas);
}

.dubbing-body-mask--card {
  border-radius: 0;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.dubbing-body-mask--card .dubbing-mask-tip {
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.78rem;
}

/* 卡片底部：未配音 + 发言角色（不在遮罩内） */
.dubbing-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 1rem 0.85rem;
  border-top: 1px solid rgba(74, 231, 253, 0.08);
  font-size: 0.85rem;
  color: var(--home-text, #e6edf3);
}

.dubbing-footer-icon {
  margin-right: 0.25rem;
  color: var(--home-muted, #8e97a5);
  font-size: 0.9em;
}

.dubbing-card-role {
  display: inline-flex;
  align-items: center;
  color: var(--home-muted, #8e97a5);
}

.dubbing-card .dubbing-meta {
  flex-direction: row;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--home-muted, #8e97a5);
}
</style>
