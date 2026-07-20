import { userTaskDetail } from '~/utils/businessApi'

export function isTaskOngoingStatus(status: unknown): boolean {
  const st = String(status ?? '').trim().toUpperCase()
  return (
    st === 'PENDING' ||
    st === 'PROCESSING' ||
    st === 'QUEUED' ||
    st === 'RUNNING' ||
    st === 'WAITING' ||
    st === '0'
  )
}

/** 通用任务（aid_extract_task）是否仍在进行中 */
export async function isUserOrMediaTaskOngoing(taskId: number): Promise<boolean> {
  const id = Number(taskId)
  if (!Number.isFinite(id) || id <= 0) return false
  try {
    const detail = await userTaskDetail({ taskId: id })
    return isTaskOngoingStatus(detail.status)
  } catch {
    return false
  }
}
