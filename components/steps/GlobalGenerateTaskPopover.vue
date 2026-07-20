<template>
  <a-popover
    v-if="hasAnyPanelTask"
    v-model:open="panelOpen"
    trigger="click"
    placement="bottomRight"
    overlay-class-name="global-generate-task-popover"
  >
    <template #content>
      <div class="global-task-panel">
        <div class="global-task-panel__head">
          <div class="global-task-panel__title">任务中心</div>
        </div>

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

      </div>
    </template>

    <button
      type="button"
      class="global-task-circle"
      :class="{
        'is-open': panelOpen,
        'global-task-circle--partial-only': badgeStyle === 'partial-only',
        'global-task-circle--failed-only': badgeStyle === 'failed-only'
      }"
      :aria-label="circleAriaLabel"
      :title="circleTitle"
    >
      <span class="global-task-circle__count">{{ badgeNumber }}</span>
    </button>
  </a-popover>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { UserTaskRow } from '~/types/business-api'
import { userTaskList } from '~/utils/businessApi'
import { isPartialFailedResumableTaskType, isStoryboardVideoGenerateTaskType, normUserTaskType } from '~/utils/taskPartialFailed'
import { useCreationStore } from '~/stores/creation'
import iconStop from '~/assets/img/icon/icon-stop.svg'
import iconStar from '~/assets/img/icon/icon-star.svg'

const creationStore = useCreationStore()
const { taskIdsWithLocalFollowPaused } = storeToRefs(creationStore)

/** 与第三步卡片/流程条一致：仅当存在进行中的视觉生成、资产提取，或 Pinia 内仍有 generating 卡片时，才预拉 /task/list 作为角标（避免进页无任务也连打三次接口） */
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

const props = defineProps<{
  projectId: number | null
}>()

const emit = defineEmits<{
  stop: [task: UserTaskRow]
  restart: [task: UserTaskRow]
  resume: [task: UserTaskRow]
}>()

const panelOpen = ref(false)
const loading = ref(false)
const ongoingTaskList = ref<UserTaskRow[]>([])
const partialTaskList = ref<UserTaskRow[]>([])
const failedTaskList = ref<UserTaskRow[]>([])

const hasAnyPanelTask = computed(
  () =>
    ongoingTaskList.value.length > 0 ||
    partialTaskList.value.length > 0 ||
    failedTaskList.value.length > 0
)

const badgeNumber = computed(() => {
  if (ongoingTaskList.value.length > 0) return ongoingTaskList.value.length
  if (partialTaskList.value.length > 0) return partialTaskList.value.length
  return failedTaskList.value.length
})

const badgeStyle = computed<'ongoing' | 'partial-only' | 'failed-only'>(() => {
  if (ongoingTaskList.value.length > 0) return 'ongoing'
  if (partialTaskList.value.length > 0) return 'partial-only'
  return 'failed-only'
})

const circleAriaLabel = computed(() => {
  if (ongoingTaskList.value.length > 0) return `进行中任务 ${ongoingTaskList.value.length}`
  if (partialTaskList.value.length > 0) return `部分成功任务 ${partialTaskList.value.length}`
  if (failedTaskList.value.length > 0) return `失败任务 ${failedTaskList.value.length}`
  return '任务'
})

const circleTitle = computed(() => {
  if (ongoingTaskList.value.length > 0) return '进行中任务'
  if (partialTaskList.value.length > 0) return '部分成功任务（可续生）'
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
    n === 'storyboard_video_generate'
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

function restartButtonTitle(task: UserTaskRow): string {
  return isLocalFollowPaused(task) ? '继续跟进进度' : '重新开始生成'
}

let reloadTasksInFlight: Promise<void> | null = null

async function reloadTasks() {
  if (!props.projectId) {
    ongoingTaskList.value = []
    partialTaskList.value = []
    failedTaskList.value = []
    return
  }
  if (reloadTasksInFlight) return reloadTasksInFlight
  reloadTasksInFlight = (async () => {
    loading.value = true
    try {
      const merged = (await userTaskList({ projectId: props.projectId }).catch(() => [] as UserTaskRow[])).filter(
        (t) => t && isTrackedTaskType(t.taskType)
      )
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))

      const seen = new Set<number>()
      const dedup: UserTaskRow[] = []
      for (const t of merged) {
        const id = Number(t.id)
        if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
        seen.add(id)
        dedup.push(t)
      }

      const ongoing: UserTaskRow[] = []
      const partialRows: UserTaskRow[] = []
      const failedRows: UserTaskRow[] = []
      for (const t of dedup) {
        const s = taskStatusUpper(t)
        if (
          isPartialFailedResumableTaskType(t.taskType) &&
          (s === 'PARTIAL_FAILED' ||
            (s === 'FAILED' && isStoryboardVideoGenerateTaskType(t.taskType)))
        ) {
          partialRows.push(t)
        } else if (s === 'FAILED') {
          failedRows.push(t)
        } else if (s === 'PENDING' || s === 'PROCESSING' || s === 'RUNNING' || s === 'QUEUED' || s === 'WAITING') {
          ongoing.push(t)
        }
      }
      ongoingTaskList.value = ongoing
      partialTaskList.value = partialRows
      failedTaskList.value = failedRows

      const listed = new Set(
        [...ongoing, ...partialRows, ...failedRows]
          .map((t) => Number(t.id))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
      creationStore.prunePausedTaskFollowKeepOnlyListed(listed)
    } finally {
      loading.value = false
    }
  })().finally(() => {
    reloadTasksInFlight = null
  })
  return reloadTasksInFlight
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
    if (open) void reloadTasks()
  }
)

watch(
  () =>
    [
      props.projectId,
      creationStore.isGeneratingStep3Visual,
      creationStore.isExtractingAssets,
      step3HasPersistedGenerating.value,
      creationStore.isGeneratingStoryboard,
      creationStore.isGeneratingStoryboardImageBatch,
      creationStore.isGeneratingStoryboardVideo
    ] as const,
  ([pid]) => {
    if (!pid) {
      ongoingTaskList.value = []
      partialTaskList.value = []
      failedTaskList.value = []
      return
    }
    void reloadTasks()
  },
  { immediate: true }
)

const GLOBAL_TASKS_EVENT = 'create-flow-global-tasks-updated'

let globalTasksDebounceTimer: ReturnType<typeof setTimeout> | null = null
function onGlobalTasksUpdated() {
  if (globalTasksDebounceTimer) clearTimeout(globalTasksDebounceTimer)
  globalTasksDebounceTimer = setTimeout(() => {
    globalTasksDebounceTimer = null
    void reloadTasks()
  }, 450)
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener(GLOBAL_TASKS_EVENT, onGlobalTasksUpdated)
  }
})

onUnmounted(() => {
  if (globalTasksDebounceTimer) {
    clearTimeout(globalTasksDebounceTimer)
    globalTasksDebounceTimer = null
  }
  if (import.meta.client) {
    window.removeEventListener(GLOBAL_TASKS_EVENT, onGlobalTasksUpdated)
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
