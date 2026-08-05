<template>
  <a-popover
    v-if="hasAnyPanelTask"
    v-model:open="panelOpen"
    trigger="click"
    placement="bottomRight"
    overlay-class-name="global-generate-task-popover"
  >
    <template #content>
      <div ref="panelScrollRef" class="global-task-panel" @scroll="onPanelScroll">
        <div class="global-task-panel__head">
          <div class="global-task-panel__title">任务中心</div>
        </div>

        <div v-if="loading && !loadedTaskRows.length" class="global-task-panel__loading">加载中…</div>

        <template v-else>
        <template v-if="ongoingTaskList.length > 0">
          <div class="global-task-panel__subtitle">进行中</div>
          <div class="global-task-panel__list">
            <div v-for="task in ongoingTaskList" :key="`o-${task.id}`" class="global-task-panel__item">
              <div class="global-task-panel__item-main">
                <div class="global-task-panel__name">{{ taskTypeLabel(task.taskType) }}</div>
                <div class="global-task-panel__model">模型：{{ task.modelCode || '-' }}</div>
              </div>
              <div class="global-task-panel__ops">
                <button
                  v-if="showTaskStop(task)"
                  type="button"
                  class="global-task-panel__icon-btn"
                  title="停止生成"
                  @click="handleStop(task)"
                >
                  <img :src="iconStop" alt="停止生成" />
                </button>
                <button
                  v-if="showTaskRestart(task)"
                  type="button"
                  class="global-task-panel__icon-btn global-task-panel__icon-btn--restart"
                  :title="restartButtonTitle(task)"
                  @click="handleRestart(task)"
                >
                  <img :src="iconStar" :alt="restartButtonTitle(task)" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-if="partialTaskList.length > 0">
          <div class="global-task-panel__subtitle global-task-panel__subtitle--partial">部分成功（可续生）</div>
          <div class="global-task-panel__list">
            <div v-for="task in partialTaskList" :key="`p-${task.id}`" class="global-task-panel__item">
              <div class="global-task-panel__item-main">
                <div class="global-task-panel__name">{{ taskTypeLabel(task.taskType) }}</div>
                <div class="global-task-panel__model">模型：{{ task.modelCode || '-' }}</div>
              </div>
              <div class="global-task-panel__ops">
                <button
                  type="button"
                  class="global-task-panel__icon-btn global-task-panel__icon-btn--restart"
                  title="续生失败项"
                  @click="handleResume(task)"
                >
                  <img :src="iconStar" alt="续生失败项" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-if="cancelledTaskList.length > 0">
          <div class="global-task-panel__subtitle global-task-panel__subtitle--cancelled">已取消（可重新生成）</div>
          <div class="global-task-panel__list">
            <div v-for="task in cancelledTaskList" :key="`c-${task.id}`" class="global-task-panel__item">
              <div class="global-task-panel__item-main">
                <div class="global-task-panel__name">{{ taskTypeLabel(task.taskType) }}</div>
                <div class="global-task-panel__model">模型：{{ task.modelCode || '-' }}</div>
              </div>
              <div class="global-task-panel__ops">
                <button
                  v-if="showCancelledRegenerate(task)"
                  type="button"
                  class="global-task-panel__icon-btn global-task-panel__icon-btn--restart"
                  title="重新生成"
                  @click="handleResume(task)"
                >
                  <img :src="iconStar" alt="重新生成" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-if="failedTaskList.length > 0">
          <div class="global-task-panel__subtitle global-task-panel__subtitle--failed">失败（可重试）</div>
          <div class="global-task-panel__list">
            <div v-for="task in failedTaskList" :key="`f-${task.id}`" class="global-task-panel__item">
              <div class="global-task-panel__item-main">
                <div class="global-task-panel__name">{{ taskTypeLabel(task.taskType) }}</div>
                <div class="global-task-panel__model">模型：{{ task.modelCode || '-' }}</div>
              </div>
              <div class="global-task-panel__ops">
                <button
                  v-if="showTaskRestart(task)"
                  type="button"
                  class="global-task-panel__icon-btn global-task-panel__icon-btn--restart"
                  :title="restartButtonTitle(task)"
                  @click="handleRestart(task)"
                >
                  <img :src="iconStar" :alt="restartButtonTitle(task)" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <InfiniteScrollLoadFooter
          :loading="loadingMore"
          :has-more="tasksHasMore"
          :has-items="loadedTaskRows.length > 0"
          end-text="已加载全部任务"
        />
        <div
          v-if="!loading && !ongoingTaskList.length && !partialTaskList.length && !cancelledTaskList.length && !failedTaskList.length"
          class="global-task-panel__empty"
        >
          暂无任务记录
        </div>
        </template>
      </div>
    </template>

    <a-tooltip
      :title="panelOpen ? undefined : circleTitle"
      placement="bottom"
      :mouse-enter-delay="0.25"
    >
      <button
        type="button"
        class="global-task-circle"
        :class="{
          'is-open': panelOpen,
          'global-task-circle--partial-only': badgeStyle === 'partial-only',
          'global-task-circle--cancelled-only': badgeStyle === 'cancelled-only',
          'global-task-circle--failed-only': badgeStyle === 'failed-only'
        }"
        :aria-label="circleAriaLabel"
      >
        <span class="global-task-circle__count">{{ badgeNumber }}</span>
      </button>
    </a-tooltip>
  </a-popover>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import type { UserTaskRow } from '~/types/business-api'
import {
  USER_TASK_LIST_RESTORE_PAGE_SIZE,
  userTaskListPage
} from '~/utils/businessApi'
import {
  FLOW_USER_TASK_LIST_READY_EVENT,
  fetchFlowUserTaskList,
  getCachedFlowUserTaskList,
  scheduleFlowUserTaskListRefresh,
  type FlowUserTaskListReadyDetail
} from '~/utils/userTaskListFlowOnce'
import {
  isTaskOngoingStatus,
  markUserTaskLocallyTerminal
} from '~/composables/useTaskOngoing'
import {
  isCancelledResumableTask,
  isPartialFailedResumableTaskType,
  isStoryboardVideoGenerateTaskType,
  isUserTaskStatusCancelled,
  normUserTaskType
} from '~/utils/taskPartialFailed'
import { isStoryboardScriptFlowStepGenerating } from '~/utils/storyboardFlowStepLoading'
import { waitInfiniteScrollAppendDelay } from '~/utils/infiniteScrollDelay'
import { useCreationStore } from '~/stores/creation'
import iconStop from '~/assets/img/icon/icon-stop.svg'
import iconStar from '~/assets/img/icon/icon-star.svg'

const creationStore = useCreationStore()
const route = useRoute()
const { taskIdsWithLocalFollowPaused } = storeToRefs(creationStore)

/** 与第三步卡片/流程条一致：Pinia 内仍有 generating 卡片时展示角标 */
const step3HasPersistedGenerating = computed(() => {
  const sc = creationStore.sceneGenerationStatus
  const ch = creationStore.characterFormGenerationStatus
  const pr = creationStore.propFormGenerationStatus
  return (
    Object.values(sc ?? {}).some((s) => s === 'generating') ||
    Object.values(ch ?? {}).some((s) => s === 'generating') ||
    Object.values(pr ?? {}).some((s) => s === 'generating')
  )
})

const isStoryboardScriptStepGenerating = computed(() =>
  isStoryboardScriptFlowStepGenerating(creationStore, route)
)

const props = defineProps<{
  projectId: number | null
}>()

const emit = defineEmits<{
  stop: [task: UserTaskRow]
  restart: [task: UserTaskRow]
  resume: [task: UserTaskRow]
}>()

const panelOpen = ref(false)
const panelScrollRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const tasksPageNum = ref(0)
const tasksHasMore = ref(true)
const loadedTaskRows = ref<UserTaskRow[]>([])
const ongoingTaskList = ref<UserTaskRow[]>([])
const partialTaskList = ref<UserTaskRow[]>([])
const cancelledTaskList = ref<UserTaskRow[]>([])
const failedTaskList = ref<UserTaskRow[]>([])

const hasAnyPanelTask = computed(
  () =>
    ongoingTaskList.value.length > 0 ||
    partialTaskList.value.length > 0 ||
    cancelledTaskList.value.length > 0 ||
    failedTaskList.value.length > 0 ||
    creationStore.isGeneratingStep3Visual ||
    creationStore.isExtractingAssets ||
    step3HasPersistedGenerating.value ||
    isStoryboardScriptStepGenerating.value ||
    creationStore.isGeneratingStoryboardVideo
)

const badgeNumber = computed(() => {
  if (ongoingTaskList.value.length > 0) return ongoingTaskList.value.length
  if (partialTaskList.value.length > 0) return partialTaskList.value.length
  if (cancelledTaskList.value.length > 0) return cancelledTaskList.value.length
  if (failedTaskList.value.length > 0) return failedTaskList.value.length
  if (
    creationStore.isGeneratingStep3Visual ||
    creationStore.isExtractingAssets ||
    step3HasPersistedGenerating.value ||
    isStoryboardScriptStepGenerating.value ||
    creationStore.isGeneratingStoryboardVideo
  ) {
    return 1
  }
  return 0
})

const badgeStyle = computed<'ongoing' | 'partial-only' | 'cancelled-only' | 'failed-only'>(() => {
  if (ongoingTaskList.value.length > 0) return 'ongoing'
  if (partialTaskList.value.length > 0) return 'partial-only'
  if (cancelledTaskList.value.length > 0) return 'cancelled-only'
  return 'failed-only'
})

const circleAriaLabel = computed(() => {
  if (ongoingTaskList.value.length > 0) return `进行中任务 ${ongoingTaskList.value.length}`
  if (partialTaskList.value.length > 0) return `部分成功任务 ${partialTaskList.value.length}`
  if (cancelledTaskList.value.length > 0) return `已取消任务 ${cancelledTaskList.value.length}`
  if (failedTaskList.value.length > 0) return `失败任务 ${failedTaskList.value.length}`
  return '任务'
})

const circleTitle = computed(() => {
  if (ongoingTaskList.value.length > 0) return '进行中任务'
  if (partialTaskList.value.length > 0) return '部分成功任务（可续生）'
  if (cancelledTaskList.value.length > 0) return '已取消任务（可重新生成）'
  if (failedTaskList.value.length > 0) return '失败任务（点击查看）'
  return '任务'
})

function isTrackedTaskType(ty: unknown): boolean {
  const n = normUserTaskType(ty)
  return (
    n === 'asset_extract' ||
    n === 'form_generate' ||
    n === 'form_generate_batch' ||
    n === 'form_image' ||
    n === 'form_image_batch' ||
    n === 'image_upscale' ||
    n === 'storyboard_script_batch' ||
    n === 'storyboard_image_prompt_batch' ||
    n === 'storyboard_video_prompt_batch' ||
    n === 'storyboard_video_generate' ||
    n === 'storyboard_audio_generate'
  )
}

function taskTypeLabel(type?: string | null) {
  const n = normUserTaskType(type)
  if (n === 'asset_extract') return '智能提取'
  if (n === 'form_generate') return '形态生成'
  if (n === 'form_generate_batch') return '形态生成（批量）'
  if (n === 'form_image') return '形态图生成'
  if (n === 'form_image_batch') return '形态图生成（批量）'
  if (n === 'image_upscale') return '图片高清'
  if (n === 'storyboard_script_batch') return '分镜脚本生成'
  if (n === 'storyboard_image_prompt_batch') return '分镜图提示词生成'
  if (n === 'storyboard_video_prompt_batch') return '分镜视频提示词生成'
  if (n === 'storyboard_video_generate') return '分镜视频出片'
  if (n === 'storyboard_audio_generate') return '批量分镜配音'
  return type || '任务'
}

function taskStatusUpper(task: UserTaskRow): string {
  return String(task?.status ?? '').toUpperCase()
}

function isLocalFollowPaused(task: UserTaskRow): boolean {
  const id = Number(task.id)
  return Number.isFinite(id) && id > 0 && taskIdsWithLocalFollowPaused.value.includes(id)
}

/** 失败任务，或用户已点「停止」但列表仍显示进行中的任务：展示「继续跟进」 */
function showTaskRestart(task: UserTaskRow): boolean {
  return taskStatusUpper(task) === 'FAILED' || isLocalFollowPaused(task)
}

function showTaskStop(task: UserTaskRow): boolean {
  if (taskStatusUpper(task) === 'FAILED') return false
  if (isLocalFollowPaused(task)) return false
  return true
}

function showCancelledRegenerate(task: UserTaskRow): boolean {
  return isCancelledResumableTask(task)
}

function restartButtonTitle(task: UserTaskRow): string {
  return isLocalFollowPaused(task) ? '继续跟进进度' : '重新开始生成'
}

let suppressScrollPagination = false

function mergeTaskRows(existing: UserTaskRow[], incoming: UserTaskRow[]): UserTaskRow[] {
  const seen = new Set<number>()
  const merged: UserTaskRow[] = []
  for (const row of [...existing, ...incoming]) {
    const id = Number(row.id)
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    merged.push(row)
  }
  return merged.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
}

/**
 * 剧集隔离：任务列表接口按 projectId 返回同作品全部集的任务。
 * 明确归属其它集（episodeId > 0 且 ≠ 当前集）的任务不进本集面板/角标；
 * episodeId 缺失或 ≤ 0（项目级/历史任务）保留。
 */
function matchesCurrentEpisode(task: UserTaskRow): boolean {
  const rowEp = Number(task?.episodeId)
  if (!Number.isFinite(rowEp) || rowEp <= 0) return true
  const currentEp = Number(creationStore.currentEpisodeId)
  if (!Number.isFinite(currentEp) || currentEp <= 0) return true
  return rowEp === currentEp
}

function applyCategorizedTasks(rows: UserTaskRow[]) {
  const tracked = rows.filter(
    (t) => t && isTrackedTaskType(t.taskType) && matchesCurrentEpisode(t)
  )
  const ongoing: UserTaskRow[] = []
  const partialRows: UserTaskRow[] = []
  const cancelledRows: UserTaskRow[] = []
  const failedRows: UserTaskRow[] = []
  for (const t of tracked) {
    const s = taskStatusUpper(t)
    if (isUserTaskStatusCancelled(s)) {
      if (isTrackedTaskType(t.taskType)) {
        cancelledRows.push(t)
      }
      continue
    }
    if (
      isPartialFailedResumableTaskType(t.taskType) &&
      (s === 'PARTIAL_FAILED' ||
        (s === 'FAILED' && isStoryboardVideoGenerateTaskType(t.taskType)))
    ) {
      partialRows.push(t)
    } else if (s === 'FAILED') {
      failedRows.push(t)
    } else if (isTaskOngoingStatus(s)) {
      ongoing.push(t)
    }
  }
  ongoingTaskList.value = ongoing
  partialTaskList.value = partialRows
  cancelledTaskList.value = cancelledRows
  failedTaskList.value = failedRows
  const listed = new Set(
    [...ongoing, ...partialRows, ...cancelledRows, ...failedRows]
      .map((t) => Number(t.id))
      .filter((n) => Number.isFinite(n) && n > 0)
  )
  creationStore.prunePausedTaskFollowKeepOnlyListed(listed)
}

function applyFlowTaskListRows(rows: UserTaskRow[]) {
  loadedTaskRows.value = rows
  tasksPageNum.value = 1
  tasksHasMore.value = rows.length >= USER_TASK_LIST_RESTORE_PAGE_SIZE
  applyCategorizedTasks(rows)
}

function applyFlowSessionTaskListIfCached(projectId: number | null) {
  if (!projectId) return
  const cached = getCachedFlowUserTaskList(projectId)
  if (!cached?.length) return
  /** 缓存可能滞后：应用本地终态标记，不打 N 次 detail */
  applyFlowTaskListRows(cached)
}

function onFlowUserTaskListReady(event: Event) {
  const detail = (event as CustomEvent<FlowUserTaskListReadyDetail>).detail
  if (!detail || detail.projectId !== props.projectId) return
  applyFlowTaskListRows(detail.rows)
}

async function loadTasksPage(reset = false, options?: { allowFillScroll?: boolean; forceNetwork?: boolean }) {
  if (!props.projectId) {
    loadedTaskRows.value = []
    ongoingTaskList.value = []
    partialTaskList.value = []
    cancelledTaskList.value = []
    failedTaskList.value = []
    tasksHasMore.value = false
    return
  }
  if (!reset && (!tasksHasMore.value || loadingMore.value || loading.value)) return

  const startedAt = Date.now()
  const blockScrollLoad = reset && !options?.allowFillScroll
  if (blockScrollLoad) suppressScrollPagination = true

  if (reset) {
    loading.value = true
    tasksPageNum.value = 0
    tasksHasMore.value = true
    loadedTaskRows.value = []
    if (panelScrollRef.value) {
      panelScrollRef.value.scrollTop = 0
    }
  } else {
    loadingMore.value = true
  }

  const nextPage = reset ? 1 : tasksPageNum.value + 1
  try {
    let pageRows: UserTaskRow[]
    let pageHasMore: boolean
    if (reset) {
      pageRows = await fetchFlowUserTaskList(props.projectId, {
        intent: options?.forceNetwork === true ? 'mutate' : 'read'
      })
      pageHasMore = pageRows.length >= USER_TASK_LIST_RESTORE_PAGE_SIZE
    } else {
      const page = await userTaskListPage({
        projectId: props.projectId,
        pageNum: nextPage,
        pageSize: USER_TASK_LIST_RESTORE_PAGE_SIZE
      })
      await waitInfiniteScrollAppendDelay(startedAt)
      pageRows = page.rows
      pageHasMore = page.hasMore
    }
    loadedTaskRows.value = reset ? pageRows : mergeTaskRows(loadedTaskRows.value, pageRows)
    tasksPageNum.value = nextPage
    tasksHasMore.value = pageHasMore
    applyCategorizedTasks(loadedTaskRows.value)
  } catch {
    if (reset) {
      loadedTaskRows.value = []
      ongoingTaskList.value = []
      partialTaskList.value = []
      cancelledTaskList.value = []
      failedTaskList.value = []
    }
  } finally {
    loading.value = false
    loadingMore.value = false
    if (blockScrollLoad) {
      await nextTick()
      suppressScrollPagination = false
    }
  }
}

function onPanelScroll() {
  if (suppressScrollPagination) return
  const el = panelScrollRef.value
  if (!el || loading.value || loadingMore.value || !tasksHasMore.value) return
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distance <= 120) {
    void loadTasksPage(false)
  }
}

function handleStop(task: UserTaskRow) {
  emit('stop', task)
}

function handleRestart(task: UserTaskRow) {
  emit('restart', task)
}

function handleResume(task: UserTaskRow) {
  emit('resume', task)
}

watch(
  () => panelOpen.value,
  (open) => {
    if (open) {
      void (async () => {
        await loadTasksPage(true, { allowFillScroll: true, forceNetwork: true })
        await nextTick()
        if (panelScrollRef.value && tasksHasMore.value) onPanelScroll()
      })()
    }
  }
)

watch(
  () => props.projectId,
  (pid, prevPid) => {
    if (!pid) {
      ongoingTaskList.value = []
      partialTaskList.value = []
      cancelledTaskList.value = []
      failedTaskList.value = []
      loadedTaskRows.value = []
      return
    }
    if (pid !== prevPid) {
      ongoingTaskList.value = []
      partialTaskList.value = []
      cancelledTaskList.value = []
      failedTaskList.value = []
      loadedTaskRows.value = []
    }
    void applyFlowSessionTaskListIfCached(pid)
  },
  { immediate: true }
)

/** 剧集隔离：切集后按新集重算面板分类与角标（列表数据是同 project 全集的） */
watch(
  () => creationStore.currentEpisodeId,
  (ep, prevEp) => {
    if (ep === prevEp) return
    if (loadedTaskRows.value.length) {
      applyCategorizedTasks(loadedTaskRows.value)
    } else {
      void applyFlowSessionTaskListIfCached(props.projectId)
    }
  }
)

const GLOBAL_TASKS_EVENT = 'create-flow-global-tasks-updated'

function onGlobalTasksUpdated(event: Event) {
  if (creationStore.isGeneratingStoryboardVideo) return
  if (!props.projectId) return
  const tid = Number((event as CustomEvent<{ taskId?: number }>).detail?.taskId)
  if (Number.isFinite(tid) && tid > 0) markUserTaskLocallyTerminal(tid)
  /** SSE 终态等：合并防抖后最多刷新一次 list，由 ready 事件更新角标 */
  scheduleFlowUserTaskListRefresh(props.projectId, { force: true })
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener(GLOBAL_TASKS_EVENT, onGlobalTasksUpdated)
    window.addEventListener(FLOW_USER_TASK_LIST_READY_EVENT, onFlowUserTaskListReady as EventListener)
    void applyFlowSessionTaskListIfCached(props.projectId)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener(GLOBAL_TASKS_EVENT, onGlobalTasksUpdated)
    window.removeEventListener(
      FLOW_USER_TASK_LIST_READY_EVENT,
      onFlowUserTaskListReady as EventListener
    )
  }
})
</script>

<style scoped lang="scss">
.global-task-btn {
  position: relative;
}

.global-task-circle {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: #00836d;
  color: #ffffff;
  font-size: 14px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.global-task-circle__count {
  line-height: 1;
}

.global-task-circle:hover,
.global-task-circle.is-open {
  background: #00b092;
}

.global-task-circle.global-task-circle--partial-only {
  background: #b45309;
}

.global-task-circle.global-task-circle--partial-only:hover,
.global-task-circle.global-task-circle--partial-only.is-open {
  background: #d97706;
}

.global-task-circle.global-task-circle--cancelled-only {
  background: #475569;
}

.global-task-circle.global-task-circle--cancelled-only:hover,
.global-task-circle.global-task-circle--cancelled-only.is-open {
  background: #64748b;
}

.global-task-circle.global-task-circle--failed-only {
  background: #991b1b;
}

.global-task-circle.global-task-circle--failed-only:hover,
.global-task-circle.global-task-circle--failed-only.is-open {
  background: #b91c1c;
}

.global-task-panel__subtitle {
  color: #9aa4b2;
  font-size: 12px;
  font-weight: 600;
  margin: 12px 0 8px;
}

.global-task-panel__subtitle:first-of-type {
  margin-top: 0;
}

.global-task-panel__subtitle--partial {
  color: #fbbf24;
}

.global-task-panel__subtitle--cancelled {
  color: #94a3b8;
}

.global-task-panel__subtitle--failed {
  color: #fca5a5;
}

:global(.global-generate-task-popover .ant-popover-inner) {
  background: #131722;
  border: 1px solid rgba(74, 231, 253, 0.24);
  border-radius: 10px;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.38);
}

:global(.global-generate-task-popover .ant-popover-arrow::before) {
  background: #131722;
}

.global-task-panel {
  width: 360px;
  max-height: 420px;
  overflow: auto;
}

.global-task-panel__loading {
  padding: 16px 0;
  text-align: center;
  color: #8e97a5;
  font-size: 12px;
}

.global-task-panel__item {
  animation: global-task-item-in 0.28s ease both;
}

@keyframes global-task-item-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.global-task-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.global-task-panel__title {
  color: #e6edf3;
  font-size: 16px;
  font-weight: 600;
}

.global-task-panel__empty {
  color: #8e97a5;
  padding: 18px 8px;
}

.global-task-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.global-task-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.18);
  background: rgba(10, 17, 30, 0.74);
}

.global-task-panel__name {
  color: #eef2ff;
  font-size: 14px;
  font-weight: 500;
}

.global-task-panel__model {
  margin-top: 4px;
  color: #8e97a5;
  font-size: 12px;
}

.global-task-panel__ops {
  display: flex;
  align-items: center;
  gap: 8px;
}

.global-task-panel__icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 91, 109, 0.4);
  border-radius: 6px;
  background: rgba(33, 14, 24, 0.9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.global-task-panel__icon-btn--restart {
  border-color: rgba(74, 231, 253, 0.45);
  background: rgba(5, 35, 44, 0.9);
}

.global-task-panel__icon-btn img {
  width: 14px;
  height: 14px;
}
</style>
