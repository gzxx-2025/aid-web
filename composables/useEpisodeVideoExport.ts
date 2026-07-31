import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useCreationStore, liveGenScopeKeyFromIds } from '~/stores/creation'
import { openRechargeModalFromInsufficientBalance } from '~/utils/api'
import {
  userEpisodeExport,
  userEpisodeExportStatus,
  userEpisodeExportDownload,
  triggerBrowserBlobDownload
} from '~/utils/businessApi'
import { resolveExportPlaybackUrl } from '~/utils/projectAudit'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  mapTimelineToExportGroups,
  mapUiTimelineToServer,
  type PreviewAudioItem,
  type PreviewSubtitleItem,
  type PreviewVideoClip
} from '~/utils/episodeTimelineMap'
import type { EpisodeExportComposeGroup, TimelineData } from '~/types/business-api'
import {
  clampEpisodeExportProgressPercent,
  EPISODE_EXPORT_COMPLETE_HOLD_MS
} from '~/utils/episodeExportProgress'

/** export/status 轮询间隔 */
const EXPORT_STATUS_POLL_MS = 10_000
/** 成片合成最长等待（超时后保留任务，回到页面可 resume） */
const EXPORT_STATUS_MAX_WAIT_MS = 45 * 60 * 1000

export type EpisodeVideoExportTimelinePayload = {
  videoClips: PreviewVideoClip[]
  voiceItems: PreviewAudioItem[]
  subtitleItems: PreviewSubtitleItem[]
  musicItems: PreviewAudioItem[]
  videoVolumePreset: Record<string, number>
  globalBgm?: string
}

export type EpisodeVideoExportProgress = {
  message: string
  exportProgress?: number
  exportStatus?: number
}

export type EpisodeVideoExportOutcome = {
  videoUrl: string
  coverUrl?: string | null
  episodeEditorId: number
  needReaudit?: boolean
  pendingVideoUrl?: string | null
  finalVideoUrl?: string | null
}

/** 切步骤暂停 SSE 时抛出；调用方应忽略，不提示失败、不清任务 */
export class EpisodeExportFollowPausedError extends Error {
  constructor(message = 'EPISODE_EXPORT_FOLLOW_PAUSED') {
    super(message)
    this.name = 'EpisodeExportFollowPausedError'
  }
}

/**
 * SSE 已结束或断连，但 export/status 尚未落到终态。
 * 保留 persist，供回到预览页继续跟进，不可 clear。
 */
export class EpisodeExportFollowIncompleteError extends Error {
  constructor(message = 'EPISODE_EXPORT_FOLLOW_INCOMPLETE') {
    super(message)
    this.name = 'EpisodeExportFollowIncompleteError'
  }
}

export function isEpisodeExportFollowPausedError(e: unknown): boolean {
  return (
    e instanceof EpisodeExportFollowPausedError ||
    (e instanceof Error && e.name === 'EpisodeExportFollowPausedError')
  )
}

export function isEpisodeExportFollowIncompleteError(e: unknown): boolean {
  return (
    e instanceof EpisodeExportFollowIncompleteError ||
    (e instanceof Error && e.name === 'EpisodeExportFollowIncompleteError')
  )
}

/** pause / incomplete：均应保留任务，不清 persist */
export function shouldKeepEpisodeExportFollowTask(e: unknown): boolean {
  return isEpisodeExportFollowPausedError(e) || isEpisodeExportFollowIncompleteError(e)
}

/**
 * 导出可用的媒体地址：排除浏览器本地 blob/data，以及历史错误落库的 `cdnDomain/blob:...`。
 */
function normalizeMediaUrl(url: unknown): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^(blob:|data:)/i.test(raw)) return ''
  // 后端 @MediaUrl 把 blob: 当相对路径拼 CDN 后的脏数据
  if (/\/blob:/i.test(raw) || /^https?:\/\/[^/]+\/blob:/i.test(raw)) return ''
  return raw
}

function buildCanonicalTimeline(
  payload: EpisodeVideoExportTimelinePayload,
  resolution: 'SD' | 'HD' | 'FHD' | '2K' | '4K'
): TimelineData {
  const timeline = mapUiTimelineToServer(payload, { resolution })
  const explicitBgmUrl = normalizeMediaUrl(payload.globalBgm)
  if (explicitBgmUrl) {
    timeline.bgm.url = explicitBgmUrl
  }
  return timeline
}

/** 与后端成片指纹字段对齐：groups + BGM + 分辨率（见接口.md 成片复用规则） */
const EXPORT_MATERIAL_FP_PREFIX = 'aid-export-material-fp:'

function buildExportMaterialFingerprint(
  groups: EpisodeExportComposeGroup[],
  globalBgmUrl: string | undefined,
  resolution: string
): string {
  return JSON.stringify({
    groups,
    globalBgmUrl: globalBgmUrl || '',
    resolution: String(resolution || 'FHD').toUpperCase()
  })
}

function readLastExportMaterialFingerprint(scopeKey: string): string | null {
  if (import.meta.server) return null
  try {
    return sessionStorage.getItem(EXPORT_MATERIAL_FP_PREFIX + scopeKey)
  } catch {
    return null
  }
}

function writeLastExportMaterialFingerprint(scopeKey: string, fingerprint: string) {
  if (import.meta.server) return
  try {
    sessionStorage.setItem(EXPORT_MATERIAL_FP_PREFIX + scopeKey, fingerprint)
  } catch {
    /* ignore quota / private mode */
  }
}

function buildExportStatusQuery(payload: {
  episodeEditorId?: number | null
  projectId?: number
  episodeId?: number
}) {
  const episodeEditorId = Number(payload.episodeEditorId)
  if (Number.isFinite(episodeEditorId) && episodeEditorId > 0) {
    return { episodeEditorId }
  }
  const projectId = Number(payload.projectId)
  const episodeId = Number(payload.episodeId)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    throw new Error('缺少项目信息，请从作品库重新进入')
  }
  if (!Number.isFinite(episodeId) || episodeId < 0) {
    throw new Error('缺少剧集信息')
  }
  return { projectId, episodeId }
}

export async function resolveEpisodeEditorId(
  projectId: number,
  episodeId: number,
  existingId?: number | null
): Promise<number | null> {
  const cached = Number(existingId)
  if (Number.isFinite(cached) && cached > 0) return cached
  try {
    const status = await userEpisodeExportStatus({ projectId, episodeId })
    const id = Number(status.episodeEditorId)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

function mapExportStatusToOutcome(status: {
  episodeEditorId: number
  exportStatus: number
  finalVideoUrl?: string | null
  coverUrl?: string | null
  pendingVideoUrl?: string | null
  needReaudit?: boolean
  errorMsg?: string | null
}): EpisodeVideoExportOutcome {
  const episodeEditorId = Number(status.episodeEditorId)
  const exportStatus = Number(status.exportStatus)
  if (exportStatus === 3) {
    throw new Error(String(status.errorMsg || '').trim() || '视频合成失败')
  }
  if (exportStatus !== 2) {
    throw new EpisodeExportFollowIncompleteError('合成尚未落盘，请稍后回到预览继续')
  }
  const videoUrl = resolveExportPlaybackUrl(status)
  if (!videoUrl) throw new Error('合成完成但未返回视频地址')
  return {
    videoUrl,
    coverUrl: status.coverUrl ?? null,
    episodeEditorId,
    needReaudit: Boolean(status.needReaudit),
    pendingVideoUrl: normalizeMediaUrl(status.pendingVideoUrl) || null,
    finalVideoUrl: normalizeMediaUrl(status.finalVideoUrl) || null
  }
}

async function fetchExportStatusOnce(payload: {
  episodeEditorId?: number | null
  projectId?: number
  episodeId?: number
}) {
  return userEpisodeExportStatus(buildExportStatusQuery(payload))
}

async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new EpisodeExportFollowPausedError()
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(new EpisodeExportFollowPausedError())
    }
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

/**
 * 按文档轮询 `POST /api/user/episode/export/status` 直至终态。
 * 注意：`exportTaskId` 是 `aid_media_task.id`，不能拿去调 `/api/user/task/detail` 或任务 SSE。
 * signal abort → {@link EpisodeExportFollowPausedError}（切步骤暂停，不清任务）。
 * 超时仍非终态 → {@link EpisodeExportFollowIncompleteError}（保留任务供 resume）。
 */
export async function followEpisodeExportViaStatus(payload: {
  episodeEditorId?: number | null
  projectId?: number
  episodeId?: number
  onProgress?: (progress: EpisodeVideoExportProgress) => void
  signal?: AbortSignal
}): Promise<EpisodeVideoExportOutcome> {
  const hasEditor =
    Number.isFinite(Number(payload.episodeEditorId)) && Number(payload.episodeEditorId) > 0
  const hasProjectEpisode =
    Number.isFinite(Number(payload.projectId)) &&
    Number(payload.projectId) > 0 &&
    Number.isFinite(Number(payload.episodeId)) &&
    Number(payload.episodeId) >= 0
  if (!hasEditor && !hasProjectEpisode) {
    throw new Error('缺少导出进度查询参数')
  }

  const query = {
    episodeEditorId: payload.episodeEditorId,
    projectId: payload.projectId,
    episodeId: payload.episodeId
  }
  const store = useCreationStore()

  payload.onProgress?.({
    message: '视频合成中…',
    exportStatus: 1
  })

  const startedAt = Date.now()
  while (true) {
    if (payload.signal?.aborted) {
      throw new EpisodeExportFollowPausedError()
    }

    const status = await fetchExportStatusOnce(query)
    if (payload.signal?.aborted) {
      throw new EpisodeExportFollowPausedError()
    }

    // 首次导出后回写的剪辑记录 id，后续轮询优先用它
    const statusEditorId = Number(status.episodeEditorId)
    if (Number.isFinite(statusEditorId) && statusEditorId > 0) {
      query.episodeEditorId = statusEditorId
      store.setCurrentMediaContext({ episodeEditorId: statusEditorId })
    }

    const exportStatus = Number(status.exportStatus)
    const percent = clampEpisodeExportProgressPercent(status.exportProgress, exportStatus)

    if (exportStatus === 2) {
      payload.onProgress?.({
        message: status.needReaudit ? '新片合成完成，需重新提交审核' : '合成完成',
        exportProgress: 100,
        exportStatus: 2
      })
      // 先让进度条停在 100%，再交给下载接口
      await sleepWithAbort(EPISODE_EXPORT_COMPLETE_HOLD_MS, payload.signal)
      return mapExportStatusToOutcome(status)
    }

    if (exportStatus === 3) {
      return mapExportStatusToOutcome(status)
    }

    if (exportStatus === 0) {
      throw new Error(String(status.errorMsg || '').trim() || '当前没有进行中的导出任务，请重新导出')
    }

    if (exportStatus !== 1) {
      throw new Error(`未知的导出状态：${exportStatus}`)
    }

    const progressText = percent != null ? ` ${Math.floor(percent)}%` : ''
    payload.onProgress?.({
      message: `视频合成中…${progressText}`,
      exportProgress: percent,
      exportStatus: 1
    })

    if (Date.now() - startedAt >= EXPORT_STATUS_MAX_WAIT_MS) {
      throw new EpisodeExportFollowIncompleteError('合成仍在进行，已保留任务')
    }

    await sleepWithAbort(EXPORT_STATUS_POLL_MS, payload.signal)
  }
}

/** @deprecated 成片导出应走 status 轮询，保留别名避免旧调用方报错 */
export async function followEpisodeExportViaSse(
  payload: Parameters<typeof followEpisodeExportViaStatus>[0] & { taskId?: number }
): Promise<EpisodeVideoExportOutcome> {
  return followEpisodeExportViaStatus(payload)
}

export async function exportEpisodeVideoFromTimeline(opts: {
  store?: ReturnType<typeof useCreationStore>
  route: RouteLocationNormalizedLoaded
  timeline: EpisodeVideoExportTimelinePayload
  resolution?: 'SD' | 'HD' | 'FHD' | '2K' | '4K'
  /**
   * 强制重新合成（会重新扣费）。
   * - 不传：由本函数根据「相对上次成功导出的素材是否变化」自动决定
   * - true：始终跳过复用
   * - false：即使素材变化也不强制（仍交给后端指纹；一般勿传）
   *
   * 文档：素材变化会使后端指纹变化并自动重合成；传 true 可在指纹一致时仍强制重合成。
   * 前端在检测到内容相对上次导出有改动时会传 true，避免误复用旧成片。
   */
  forceRecompose?: boolean
  onProgress?: (progress: EpisodeVideoExportProgress) => void
  signal?: AbortSignal
}): Promise<EpisodeVideoExportOutcome> {
  const store = opts.store ?? useCreationStore()
  const ctx = await resolveStoryScriptSaveContext(store, opts.route)
  if (!ctx) {
    throw new Error('缺少作品信息，请从作品库重新进入')
  }

  const resolution = opts.resolution ?? 'FHD'
  const timeline = buildCanonicalTimeline(opts.timeline, resolution)
  const { groups, globalBgmUrl } = mapTimelineToExportGroups(timeline)
  if (!groups.length) {
    throw new Error('暂无可导出视频，请先同步前面步骤')
  }
  const episodeEditorId = await resolveEpisodeEditorId(
    ctx.projectId,
    ctx.episodeId,
    store.currentEpisodeEditorId
  )
  const scopeKey = liveGenScopeKeyFromIds(ctx.projectId, ctx.episodeId)
  const materialFingerprint = buildExportMaterialFingerprint(groups, globalBgmUrl, resolution)
  const lastMaterialFingerprint = readLastExportMaterialFingerprint(scopeKey)
  // 再次导出且素材相对上次成功导出有变化 → 传 true 强制重合成；未变化则不传，允许复用
  const contentChangedSinceLastExport =
    Boolean(episodeEditorId) &&
    Boolean(lastMaterialFingerprint) &&
    lastMaterialFingerprint !== materialFingerprint
  const forceRecompose =
    opts.forceRecompose === true || (opts.forceRecompose !== false && contentChangedSinceLastExport)

  const exportBody: Parameters<typeof userEpisodeExport>[0] = {
    groups,
    globalBgmUrl,
    resolution,
    timelineJson: JSON.stringify(timeline),
    ...(forceRecompose ? { forceRecompose: true } : {})
  }
  if (episodeEditorId) {
    exportBody.episodeEditorId = episodeEditorId
  } else {
    exportBody.projectId = ctx.projectId
    exportBody.episodeId = ctx.episodeId
  }

  try {
    const accepted = await userEpisodeExport(exportBody)
    const acceptedEditorId = Number(accepted.episodeEditorId)
    const reused = Boolean(accepted.reused)
    const acceptedStatus = Number(accepted.exportStatus)
    const editorId =
      Number.isFinite(acceptedEditorId) && acceptedEditorId > 0 ? acceptedEditorId : episodeEditorId

    if (reused && acceptedStatus === 2) {
      const reusedUrl = normalizeMediaUrl(accepted.finalVideoUrl)
      if (reusedUrl) {
        writeLastExportMaterialFingerprint(scopeKey, materialFingerprint)
        opts.onProgress?.({ message: '已复用已有成片', exportProgress: 100, exportStatus: 2 })
        await sleepWithAbort(EPISODE_EXPORT_COMPLETE_HOLD_MS, opts.signal)
        store.clearEpisodeExportFollowTask(scopeKey)
        const status = await fetchExportStatusOnce(
          Number.isFinite(acceptedEditorId) && acceptedEditorId > 0
            ? { episodeEditorId: acceptedEditorId }
            : { projectId: ctx.projectId, episodeId: ctx.episodeId }
        )
        return mapExportStatusToOutcome(status)
      }
    }

    // exportTaskId 仅为 aid_media_task.id（排查用），进度只走 export/status，禁止 task/detail / SSE
    if (!editorId && !(ctx.projectId > 0 && ctx.episodeId >= 0)) {
      throw new Error('导出任务创建失败，未返回剪辑记录')
    }

    if (editorId) {
      store.setCurrentMediaContext({ episodeEditorId: editorId })
    }

    store.setEpisodeExportFollowTask(scopeKey, {
      episodeEditorId: editorId,
      active: true
    })

    opts.onProgress?.({
      message: '已提交合成任务，正在处理…',
      exportStatus: acceptedStatus || 1
    })

    try {
      // 成功也不在此 clear：由 UI 消费结果后再清，避免切步竞态丢弹窗且无法 resume
      const outcome = await followEpisodeExportViaStatus({
        episodeEditorId: editorId,
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        onProgress: opts.onProgress,
        signal: opts.signal
      })
      writeLastExportMaterialFingerprint(scopeKey, materialFingerprint)
      return outcome
    } catch (e: unknown) {
      if (shouldKeepEpisodeExportFollowTask(e)) {
        throw e
      }
      store.clearEpisodeExportFollowTask(scopeKey)
      throw e
    }
  } catch (e: unknown) {
    if (shouldKeepEpisodeExportFollowTask(e)) throw e
    const err = e as { msg?: string; message?: string }
    const msg = String(err?.msg || err?.message || '').trim() || '导出失败'
    openRechargeModalFromInsufficientBalance(msg)
    throw e
  }
}

export async function fetchEpisodeExportStatusForContext(payload: {
  projectId: number
  episodeId: number
  episodeEditorId?: number | null
}) {
  return userEpisodeExportStatus(
    buildExportStatusQuery({
      projectId: payload.projectId,
      episodeId: payload.episodeId,
      episodeEditorId: payload.episodeEditorId
    })
  )
}

function guessExportFilename(url: string): string {
  try {
    const path = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined)
      .pathname
    const base = path.split('/').pop() || ''
    if (/\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(base)) {
      return decodeURIComponent(base.split('?')[0] || base)
    }
  } catch {
    /* ignore */
  }
  return `完整视频_${Date.now()}.mp4`
}

/** 解析 Nuxt 同源 API 路径（兼容部署在 /aid/ 等子路径） */
function resolveSameOriginApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (typeof window === 'undefined') return p
  try {
    const { app } = useRuntimeConfig()
    const base = String(app?.baseURL ?? '/')
    if (!base || base === '/' || base === '/_nuxt/' || base === '/_nuxt') {
      return p
    }
    const normalized = base.endsWith('/') ? base.slice(0, -1) : base
    return `${normalized}${p}`
  } catch {
    return p
  }
}

function buildMediaDownloadProxyUrl(remoteUrl: string, filename: string): string {
  const params = new URLSearchParams({
    url: remoteUrl,
    filename
  })
  return `${resolveSameOriginApiUrl('/api/media-download')}?${params.toString()}`
}

function isSameOriginUrl(url: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

function triggerAnchorDownload(href: string, filename: string) {
  if (typeof document === 'undefined') return
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 隐藏 iframe 触发同源 attachment 下载，避免当前页跳转到资源地址 */
function triggerIframeDownload(href: string) {
  if (typeof document === 'undefined') return
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.src = href
  document.body.appendChild(iframe)
  window.setTimeout(() => {
    try {
      iframe.remove()
    } catch {
      /* ignore */
    }
  }, 120_000)
}

/**
 * 将导出成片保存到本地（触发浏览器下载，不跳转打开 CDN 播放页）。
 * 跨域资源走同源 `/api/media-download` 代理并带 Content-Disposition: attachment。
 * @deprecated 优先使用 downloadExportedFinalVideo（/episode/export/download blob）
 */
export async function openExportedVideo(videoUrl: string): Promise<void> {
  const url = normalizeMediaUrl(videoUrl)
  if (!url) throw new Error('暂无可保存的视频地址')
  if (typeof window === 'undefined') throw new Error('仅支持在浏览器中下载')

  const filename = guessExportFilename(url)

  // 同源地址可直接带 download 属性下载
  if (isSameOriginUrl(url)) {
    triggerAnchorDownload(url, filename)
    return
  }

  // 跨域：必须走同源代理，禁止回退到 CDN 直链（直链会被浏览器当成播放页打开）
  const proxyUrl = buildMediaDownloadProxyUrl(url, filename)
  triggerIframeDownload(proxyUrl)
}

/**
 * 成片 mp4 附件流下载：POST /api/user/episode/export/download（blob）
 * 优先 episodeEditorId；否则 projectId + episodeId（电影 episodeId=0）
 */
export async function downloadExportedFinalVideo(payload: {
  episodeEditorId?: number | null
  projectId?: number | null
  episodeId?: number | null
}): Promise<void> {
  if (typeof window === 'undefined') throw new Error('仅支持在浏览器中下载')
  const { blob, filename } = await userEpisodeExportDownload({
    episodeEditorId: payload.episodeEditorId,
    projectId: payload.projectId ?? undefined,
    episodeId: payload.episodeId ?? undefined
  })
  triggerBrowserBlobDownload(blob, filename)
}
