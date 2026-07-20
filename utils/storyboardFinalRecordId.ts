import type { DubbingPanel } from '~/types'

/** 从分镜视频条目解析服务端 recordId（用于 unSetFinalVideo） */
export function resolveStoryboardVideoRecordId(
  video: { id?: string; _serverRow?: { id?: number }; _fromServer?: boolean } | null | undefined
): number | null {
  const fromRow = video?._serverRow?.id
  if (fromRow != null && Number.isFinite(Number(fromRow)) && Number(fromRow) > 0) {
    return Number(fromRow)
  }
  const id = Number(video?.id)
  if (video?._fromServer && Number.isFinite(id) && id > 0) return id
  return null
}

/** 从配音面板或服务端 finalAudioId 解析 recordId（用于 unSetFinalAudio） */
export function resolveStoryboardAudioRecordId(
  panel: DubbingPanel | null | undefined,
  serverFinalAudioId?: number | null
): number | null {
  if (serverFinalAudioId != null && Number.isFinite(Number(serverFinalAudioId)) && serverFinalAudioId > 0) {
    return Number(serverFinalAudioId)
  }
  const key = panel?.dubbingLipSyncKey
  if (!key || key === '__source__' || String(key).startsWith('batch-')) return null
  const n = Number(key)
  return Number.isFinite(n) && n > 0 ? n : null
}
