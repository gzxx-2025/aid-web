import { withAppBasePath } from '~/utils/appBasePath'
import { triggerBrowserBlobDownload,userEpisodeExportDownload } from '~/utils/businessApi'
function normalizeMediaUrl(url: unknown): string {
  const raw = String(url || '').trim()
  if (!raw || /^(blob:|data:)/i.test(raw) || /\/blob:/i.test(raw)) return ''
  return raw
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

function buildMediaDownloadProxyUrl(remoteUrl: string, filename: string): string {
  const params = new URLSearchParams({
    url: remoteUrl,
    filename
  })
  // 同源 API 路径（兼容部署在 /aid/ 等子路径）
  return `${withAppBasePath('/api/media-download')}?${params.toString()}`
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
