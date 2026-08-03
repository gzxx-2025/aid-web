import type { H3Event } from 'h3'
import { createError, getQuery, setHeader } from 'h3'
import { fetchMediaWithSafeRedirects, parsePublicMediaUrl } from './mediaProxyCore'

const MAX_IMAGE_URL_LENGTH = 2048
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

const UPSTREAM_HEADERS = {
  Accept: 'image/*,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end))
}

function sniffImageContentType(buffer: Uint8Array): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 12 &&
    ascii(buffer, 0, 4) === 'RIFF' &&
    ascii(buffer, 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (
    buffer.length >= 6 &&
    (ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a')
  ) {
    return 'image/gif'
  }
  return null
}

async function readImageBytes(upstream: Response): Promise<Uint8Array> {
  const declaredLength = Number(upstream.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    await upstream.body?.cancel()
    throw createError({ statusCode: 413, statusMessage: '图片内容过大' })
  }

  const reader = upstream.body?.getReader()
  if (!reader) throw createError({ statusCode: 502, statusMessage: '图片内容为空' })
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.length) continue
      total += value.length
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel()
        throw createError({ statusCode: 413, statusMessage: '图片内容过大' })
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

/**
 * 同源图片代理：供前端 Canvas 切图等场景拉取 OSS/CDN 图片，避免跨域污染 canvas。
 */
export async function handleImageProxyRequest(event: H3Event) {
  const rawUrl = String(getQuery(event).url || '').trim()
  const parsed = parsePublicMediaUrl(event, rawUrl, MAX_IMAGE_URL_LENGTH)

  let upstream: Response
  try {
    upstream = await fetchMediaWithSafeRedirects(event, parsed, UPSTREAM_HEADERS)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: '图片拉取失败' })
  }

  if (!upstream.ok) {
    throw createError({
      statusCode: upstream.status >= 400 ? upstream.status : 502,
      statusMessage: '图片拉取失败'
    })
  }

  const buffer = await readImageBytes(upstream)
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
