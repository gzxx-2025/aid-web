import { createError, getQuery, sendStream, setHeader } from 'h3'
import { fetchMediaWithSafeRedirects, parsePublicMediaUrl } from '../utils/mediaProxyCore'

/**
 * 同源媒体下载代理：把跨域 CDN 视频以 attachment 流式回传，避免浏览器直接打开播放页。
 * GET /api/media-download?url=<encoded>&filename=<optional>
 */
export default defineEventHandler(async (event) => {
  const rawUrl = String(getQuery(event).url || '').trim()
  const filenameRaw = String(getQuery(event).filename || '').trim()

  const parsed = parsePublicMediaUrl(event, rawUrl)

  let upstream: Response
  try {
    upstream = await fetchMediaWithSafeRedirects(event, parsed, {
      Accept: 'video/*,audio/*,application/octet-stream,*/*;q=0.8'
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: '媒体拉取失败' })
  }

  if (!upstream.ok) {
    throw createError({
      statusCode: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
      statusMessage: '媒体拉取失败'
    })
  }

  if (!upstream.body) {
    throw createError({ statusCode: 502, statusMessage: '媒体内容为空' })
  }

  const contentType = String(upstream.headers.get('content-type') || 'application/octet-stream')
  if (/text\/html|application\/json/i.test(contentType)) {
    throw createError({ statusCode: 400, statusMessage: '非媒体资源' })
  }

  const filename = sanitizeDownloadFilename(filenameRaw, parsed.pathname)
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_') || 'video.mp4'

  setHeader(event, 'Content-Type', contentType)
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${asciiFallback.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  )
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  const contentLength = upstream.headers.get('content-length')
  if (contentLength) {
    const length = Number(contentLength)
    if (Number.isFinite(length) && length >= 0) setHeader(event, 'Content-Length', length)
  }

  return sendStream(event, upstream.body)
})

function sanitizeDownloadFilename(raw: string, pathname: string): string {
  const fromQuery = raw.replace(/[\\/:*?"<>|]+/g, '_').trim()
  if (fromQuery) return fromQuery.slice(0, 180)

  let base = pathname.split('/').pop() || ''
  try {
    base = decodeURIComponent(base)
  } catch {
    /* 保留原始文件名，避免畸形百分号导致整个下载请求 500 */
  }
  const cleaned = base.replace(/[\\/:*?"<>|]+/g, '_').trim()
  if (cleaned && /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(cleaned)) {
    return cleaned.split('?')[0]!.slice(0, 180)
  }
  return `完整视频_${Date.now()}.mp4`
}
