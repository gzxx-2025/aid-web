import { watch } from 'vue'
import { useTaskStream, taskStreamDoneForRace, type TaskStreamResult } from '~/composables/useTaskStream'
import { userTaskDetail } from '~/utils/businessApi'
import type { UserTaskDetailData } from '~/types/business-api'

export type TaskSseTerminalWaitResult =
  | { kind: 'sse'; event: TaskStreamResult }
  | { kind: 'timeout' }

export function normalizeTaskStatus(status: unknown): string {
  return String(status ?? '').trim().toUpperCase()
}

export function isTerminalTaskStatus(status: unknown): boolean {
  const st = normalizeTaskStatus(status)
  return st === 'SUCCEEDED' || st === 'FAILED' || st === 'CANCELLED' || st === 'PARTIAL_FAILED'
}

/** SSE 结束后最多补查一次 task/detail（不做轮询） */
export async function fetchUserTaskDetailOnce(taskId: number): Promise<UserTaskDetailData | null> {
  const id = Number(taskId)
  if (!Number.isFinite(id) || id <= 0) return null
  try {
    return await userTaskDetail({ taskId: id })
  } catch {
    return null
  }
}

/** 与后端 SSE 连接最长存活时间对齐（30 分钟） */
export const TASK_SSE_TIMEOUT_MS = 30 * 60 * 1000

const DEFAULT_TASK_SSE_TIMEOUT_MS = TASK_SSE_TIMEOUT_MS

/**
 * 仅通过 SSE 等待任务终态；不再与 task/detail 轮询竞速。
 * SSE 正常结束时由调用方按需 {@link fetchUserTaskDetailOnce} 补查一次详情。
 */
export async function waitUserTaskSseTerminal(payload: {
  taskId: number
  timeoutMs?: number
  onProgress?: (p: { percent?: number; stepTitle?: string; message?: string }) => void
}): Promise<TaskSseTerminalWaitResult> {
  const taskId = Number(payload.taskId)
  const timeoutMs = payload.timeoutMs ?? DEFAULT_TASK_SSE_TIMEOUT_MS
  const { onProgress } = payload

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return { kind: 'timeout' }
  }

  const stream = useTaskStream(taskId)
  const stopWatch = watch(
    () => stream.lastProgress.value,
    (p) => {
      if (!p) return
      onProgress?.({
        percent: typeof p.progress === 'number' ? p.progress : undefined,
        stepTitle: p.stepTitle,
        message: p.message
      })
    },
    { immediate: true }
  )

  let settled = false
  const cleanup = () => {
    if (settled) return
    settled = true
    stopWatch()
    try {
      stream.close()
    } catch {
      /* ignore */
    }
  }

  try {
    const ssePromise = taskStreamDoneForRace(stream).then((event) => ({
      kind: 'sse' as const,
      event
    }))
    const timeoutPromise = new Promise<{ kind: 'timeout' }>((resolve) => {
      setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs)
    })
    const winner = await Promise.race([ssePromise, timeoutPromise])
    cleanup()
    return winner
  } catch {
    cleanup()
    return { kind: 'timeout' }
  }
}
