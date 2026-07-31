import { Readable } from 'node:stream'
import { sendStream } from 'h3'

/**
 * 同源媒体代理：供 WebAV / canvas 预览拉取跨域 CDN 音视频，避免浏览器 CORS 拦截。
 * GET /api/media-proxy?url=<encoded>
 */
export default defineEventHandler(async (event) => {
  const rawUrl = String(getQuery(event).url || '').trim()
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

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  const contentLength = upstream.headers.get('content-length')
  if (contentLength) {
    setHeader(event, 'Content-Length', contentLength)
  }

  try {
    const nodeStream = Readable.fromWeb(
      upstream.body as import('node:stream/web').ReadableStream
    )
    return sendStream(event, nodeStream)
  } catch {
    const buffer = Buffer.from(await upstream.arrayBuffer())
    if (!buffer.length) {
      throw createError({ statusCode: 502, statusMessage: '媒体内容为空' })
    }
    return buffer
  }
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
    throw createError({ statusCode: 400, statusMessage: '不允许的媒体地址' })
  }
}
