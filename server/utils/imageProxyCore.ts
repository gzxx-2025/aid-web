import type { H3Event } from 'h3'
import { createError, getQuery, setHeader } from 'h3'

const UPSTREAM_HEADERS = {
  Accept: 'image/*,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

function normalizeTargetUrl(rawUrl: string): URL {
  let value = rawUrl.trim()
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: '缺少 url 参数' })
  }

  if (value.startsWith('//')) {
    value = `https:${value}`
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw createError({ statusCode: 400, statusMessage: '仅支持 http/https' })
    }
    return parsed
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 400, statusMessage: 'url 格式无效' })
  }
}

function sniffImageContentType(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (
    buffer.length >= 6 &&
    (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')
  ) {
    return 'image/gif'
  }
  return null
}

/**
 * 同源图片代理：供前端 Canvas 切图等场景拉取 OSS/CDN 图片，避免跨域污染 canvas。
 */
export async function handleImageProxyRequest(event: H3Event) {
  const rawUrl = String(getQuery(event).url || '').trim()
  const parsed = normalizeTargetUrl(rawUrl)

  if (rawUrl.length > 2048) {
    throw createError({ statusCode: 400, statusMessage: 'url 过长' })
  }

  let upstream: Response
  try {
    upstream = await fetch(parsed.toString(), {
      headers: UPSTREAM_HEADERS,
      redirect: 'follow'
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: '图片拉取失败' })
  }

  if (!upstream.ok) {
    throw createError({
      statusCode: upstream.status >= 400 ? upstream.status : 502,
      statusMessage: '图片拉取失败'
    })
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  if (buffer.length === 0) {
    throw createError({ statusCode: 502, statusMessage: '图片内容为空' })
  }

  const sniffedType = sniffImageContentType(buffer)
  if (!sniffedType) {
    throw createError({ statusCode: 502, statusMessage: '图片内容无效' })
  }

  setHeader(event, 'Content-Type', sniffedType)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return buffer
}
