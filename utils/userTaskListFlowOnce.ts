import type { UserTaskRow } from '~/types/business-api'
import { invalidateUserTaskListCache, userTaskListRecentPage } from '~/utils/businessApi'

export const FLOW_USER_TASK_LIST_READY_EVENT = 'create-flow-user-task-list-ready'

export type FlowUserTaskListReadyDetail = {
  projectId: number
  rows: UserTaskRow[]
}

const inflightByProjectId = new Map<number, Promise<UserTaskRow[]>>()
const sessionCache = new Map<number, UserTaskRow[]>()

let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
let refreshDebounceProjectId: number | null = null

function isValidProjectId(projectId: number): boolean {
  return Number.isFinite(projectId) && projectId > 0
}

/**
 * 剧集隔离：任务列表接口按 projectId 返回同作品全部集的任务。
 * 恢复/续跟/角标场景必须先过滤：明确归属其它集（episodeId > 0 且 ≠ 当前集）的行剔除；
 * episodeId 缺失或 ≤ 0（项目级/历史任务）保留。currentEpisodeId 无效（null/0）时不过滤。
 */
export function filterUserTaskRowsForEpisode(
  rows: UserTaskRow[],
  currentEpisodeId: number | null | undefined
): UserTaskRow[] {
  const currentEp = Number(currentEpisodeId)
  if (!Number.isFinite(currentEp) || currentEp <= 0) return rows
  return rows.filter((row) => {
    const rowEp = Number(row?.episodeId)
    if (!Number.isFinite(rowEp) || rowEp <= 0) return true
    return rowEp === currentEp
  })
}

export function getCachedFlowUserTaskList(projectId: number): UserTaskRow[] | null {
  if (!isValidProjectId(projectId)) return null
  const rows = sessionCache.get(projectId)
  return rows ? [...rows] : null
}

export function hasFlowUserTaskListCache(projectId: number): boolean {
  return isValidProjectId(projectId) && sessionCache.has(projectId)
}

export function dispatchFlowUserTaskListReady(projectId: number, rows: UserTaskRow[]): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<FlowUserTaskListReadyDetail>(FLOW_USER_TASK_LIST_READY_EVENT, {
      detail: { projectId, rows }
    })
  )
}

/**
 * 创作流程内同一 projectId 只拉一次最近任务列表（切换步骤复用缓存）。
 * SSE 终态等需刷新时请用 {@link scheduleFlowUserTaskListRefresh} 或传 force: true。
 */
export function fetchFlowUserTaskListOnce(
  projectId: number,
  options?: { force?: boolean }
): Promise<UserTaskRow[]> {
  const pid = Number(projectId)
  if (!isValidProjectId(pid)) return Promise.resolve([])

  if (!options?.force) {
    const cached = sessionCache.get(pid)
    if (cached) return Promise.resolve([...cached])
    const inflight = inflightByProjectId.get(pid)
    if (inflight) return inflight
  } else {
    /** 并发 force 共用同一个 in-flight，避免 N 个终态同时打出 N 次 list */
    const inflight = inflightByProjectId.get(pid)
    if (inflight) return inflight
    /** 必须清掉 businessApi 层 3s burst，否则 force 仍可能打到旧「进行中」行 */
    invalidateUserTaskListCache()
  }

  const promise = userTaskListRecentPage({ projectId: pid })
    .then((rows) => {
      sessionCache.set(pid, rows)
      dispatchFlowUserTaskListReady(pid, rows)
      return rows
    })
    .finally(() => {
      if (inflightByProjectId.get(pid) === promise) {
        inflightByProjectId.delete(pid)
      }
    })

  inflightByProjectId.set(pid, promise)
  return promise
}

/** SSE 完成 / 任务状态变更：合并防抖后最多刷新一次 list，并广播 ready 事件 */
export function scheduleFlowUserTaskListRefresh(
  projectId: number,
  options?: { force?: boolean; debounceMs?: number }
): void {
  if (typeof window === 'undefined') return
  const pid = Number(projectId)
  if (!isValidProjectId(pid)) return

  refreshDebounceProjectId = pid
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer)
  /** 并行多任务终态错峰完成时，拉长合并窗口，避免 N 次 list */
  const debounceMs = options?.debounceMs ?? 900

  refreshDebounceTimer = setTimeout(() => {
    refreshDebounceTimer = null
    const targetPid = refreshDebounceProjectId
    refreshDebounceProjectId = null
    if (targetPid == null) return
    void fetchFlowUserTaskListOnce(targetPid, { force: options?.force ?? true })
  }, debounceMs)
}

export function invalidateFlowUserTaskListCache(projectId?: number): void {
  if (refreshDebounceTimer) {
    clearTimeout(refreshDebounceTimer)
    refreshDebounceTimer = null
  }
  refreshDebounceProjectId = null

  if (projectId == null) {
    inflightByProjectId.clear()
    sessionCache.clear()
    return
  }
  const pid = Number(projectId)
  inflightByProjectId.delete(pid)
  sessionCache.delete(pid)
}
