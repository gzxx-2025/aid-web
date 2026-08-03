import type { H3Event } from 'h3'
import {
  createError,
  getHeader,
  getQuery,
  sendStream,
  setHeader,
  setResponseStatus
} from 'h3'

const MAX_URL_LENGTH = 4096
const MAX_REDIRECTS = 5
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MEDIA_ACCEPT = 'video/*,audio/*,application/octet-stream,*/*;q=0.8'

function parseAllowedHosts(event: H3Event): string[] {
  const config = useRuntimeConfig(event)
  return String(config.mediaProxyAllowedHosts || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function matchesAllowedHost(host: string, rule: string): boolean {
  if (!rule.startsWith('*.')) return host === rule
  const suffix = rule.slice(1)
  return host.endsWith(suffix) && host.length > suffix.length
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b, c] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

export function isBlockedMediaHostname(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '')
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }
  if (isBlockedIpv4(host)) return true
  if (!host.includes(':')) return false

  // IPv4-mapped、未指定、回环、ULA、链路/站点本地与组播 IPv6 地址。
  return (
    host === '::' ||
    host === '::1' ||
    host.startsWith('::ffff:') ||
    /^(fc|fd)/i.test(host) ||
    /^fe[89a-f]/i.test(host) ||
    /^ff/i.test(host)
  )
}

export function assertPublicMediaUrl(event: H3Event, parsed: URL) {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: '仅支持 http/https' })
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '')
  const allowedHosts = parseAllowedHosts(event)
  if (allowedHosts.length && !allowedHosts.some((rule) => matchesAllowedHost(host, rule))) {
    throw createError({ statusCode: 403, statusMessage: '媒体域名未授权' })
  }

  if (isBlockedMediaHostname(host)) {
    throw createError({ statusCode: 400, statusMessage: '不允许的媒体地址' })
  }
}

export function parsePublicMediaUrl(
  event: H3Event,
  rawUrl: string,
  maxUrlLength = MAX_URL_LENGTH
): URL {
  if (!rawUrl) {
    throw createError({ statusCode: 400, statusMessage: '缺少 url 参数' })
  }
  if (rawUrl.length > maxUrlLength) {
    throw createError({ statusCode: 400, statusMessage: 'url 过长' })
  }

  try {
    const parsed = new URL(rawUrl)
    assertPublicMediaUrl(event, parsed)
    return parsed
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 400, statusMessage: 'url 格式无效' })
  }
}

function readRangeHeaders(event: H3Event): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: MEDIA_ACCEPT,
    'Accept-Encoding': 'identity'
  }
  const range = String(getHeader(event, 'range') || '').trim()
  if (range) {
    const bytes = range.slice(6)
    if (!/^bytes=\d*-\d*$/i.test(range) || !bytes.split('-').some(Boolean)) {
      throw createError({ statusCode: 416, statusMessage: 'Range 格式无效' })
    }
    headers.Range = range
  }
  const ifRange = String(getHeader(event, 'if-range') || '').trim()
  if (ifRange && ifRange.length <= 512) headers['If-Range'] = ifRange
  return headers
}

export async function fetchMediaWithSafeRedirects(
  event: H3Event,
  initialUrl: URL,
  headers: Record<string, string>
): Promise<Response> {
  let target = initialUrl
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    assertPublicMediaUrl(event, target)
    const response = await fetch(target, { headers, redirect: 'manual' })
    if (!REDIRECT_STATUSES.has(response.status)) return response

    const location = response.headers.get('location')
    if (!location) {
      throw createError({ statusCode: 502, statusMessage: '媒体重定向无效' })
    }
    if (redirectCount === MAX_REDIRECTS) {
      throw createError({ statusCode: 502, statusMessage: '媒体重定向过多' })
    }
    await response.body?.cancel()
    target = new URL(location, target)
  }
  throw createError({ statusCode: 502, statusMessage: '媒体重定向过多' })
}

function copyMediaResponseHeaders(event: H3Event, upstream: Response) {
  const headerNames = [
    'accept-ranges',
    'content-length',
    'content-range',
    'etag',
    'last-modified'
  ]
  for (const name of headerNames) {
    const value = upstream.headers.get(name)
    if (value) setHeader(event, name, value)
  }
}

/**
 * 标准同源流媒体代理：透传 Range 请求与 206 响应，供视频随机定位和 Canvas 截帧使用。
 * 可通过 NUXT_MEDIA_PROXY_ALLOWED_HOSTS 配置逗号分隔的固定 CDN 域名白名单。
 */
export async function handleMediaProxyRequest(event: H3Event) {
  const rawUrl = String(getQuery(event).url || '').trim()
  const target = parsePublicMediaUrl(event, rawUrl)
  const requestHeaders = readRangeHeaders(event)

  let upstream: Response
  try {
    upstream = await fetchMediaWithSafeRedirects(event, target, requestHeaders)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: '媒体拉取失败' })
  }

  if (upstream.status === 416) {
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges')
    if (contentRange) setHeader(event, 'Content-Range', contentRange)
    if (acceptRanges) setHeader(event, 'Accept-Ranges', acceptRanges)
    setResponseStatus(event, 416)
    return ''
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

  copyMediaResponseHeaders(event, upstream)
  setResponseStatus(event, upstream.status === 206 ? 206 : 200)
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cross-Origin-Resource-Policy', 'same-origin')

  return sendStream(event, upstream.body)
}
