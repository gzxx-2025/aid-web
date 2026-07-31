import { Readable } from 'node:stream'
import { sendStream } from 'h3'

/**
 * 同源媒体下载代理：把跨域 CDN 视频以 attachment 流式回传，避免浏览器直接打开播放页。
 * GET /api/media-download?url=<encoded>&filename=<optional>
 */
export default defineEventHandler(async (event) => {
  const rawUrl = String(getQuery(event).url || '').trim()
  const filenameRaw = String(getQuery(event).filename || '').trim()

  if (!rawUrl) {
    throw createError({ statusCode: 400, statusMessage: '缺少 url 参数' })
  }
  if (rawUrl.length > 4096) {
    throw createError({ statusCode: 400, statusMessage: 'url 过长' })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'url 格式无效' })
  }

  assertPublicHttpUrl(parsed)

  let upstream: Response
  try {
    upstream = await fetch(rawUrl, {
      headers: { Accept: 'video/*,audio/*,application/octet-stream,*/*;q=0.8' },
      redirect: 'follow'
    })
  } catch {
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
    setHeader(event, 'Content-Length', contentLength)
  }

  let nodeStream: Readable
  try {
    nodeStream = Readable.fromWeb(
      upstream.body as import('node:stream/web').ReadableStream
    )
  } catch {
    // 部分运行时 fromWeb 不可用时回退缓冲（体积大时内存占用更高）
    const buffer = Buffer.from(await upstream.arrayBuffer())
    if (!buffer.length) {
      throw createError({ statusCode: 502, statusMessage: '媒体内容为空' })
    }
    return buffer
  }
  return sendStream(event, nodeStream)
})

function assertPublicHttpUrl(parsed: URL) {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: '仅支持 http/https' })
  }
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    throw createError({ statusCode: 400, statusMessage: '不允许的下载地址' })
  }
}

function sanitizeDownloadFilename(raw: string, pathname: string): string {
  const fromQuery = raw.replace(/[\\/:*?"<>|]+/g, '_').trim()
  if (fromQuery) return fromQuery.slice(0, 180)

  const base = decodeURIComponent(pathname.split('/').pop() || '')
  const cleaned = base.replace(/[\\/:*?"<>|]+/g, '_').trim()
  if (cleaned && /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(cleaned)) {
    return cleaned.split('?')[0]!.slice(0, 180)
  }
  return `完整视频_${Date.now()}.mp4`
}
