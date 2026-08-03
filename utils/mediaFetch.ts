import { resolveSameOriginApiUrl } from '~/utils/sameOriginApiUrl'

function isSameOriginUrl(url: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

function buildMediaProxyUrl(remoteUrl: string): string {
  const params = new URLSearchParams({ url: remoteUrl })
  return `${resolveSameOriginApiUrl('/media/proxy')}?${params.toString()}`
}

/**
 * 将跨域媒体地址转换为同源代理地址，供 video/audio 直接播放。
 * 预览与 Canvas 截帧必须使用相同地址，避免媒体可播放却无法读取画面的情况。
 */
export function resolveMediaPlaybackUrl(url: string): string {
  const remote = String(url || '').trim()
  if (
    !remote ||
    remote.startsWith('blob:') ||
    remote.startsWith('data:') ||
    isSameOriginUrl(remote)
  ) {
    return remote
  }
  return buildMediaProxyUrl(remote)
}

/**
 * 拉取媒体 Blob。跨域 CDN 统一走同源 `/media/proxy`，避免浏览器 CORS 控制台报错。
 */
export async function fetchMediaBlob(url: string): Promise<Blob | null> {
  const remote = String(url || '').trim()
  if (!remote) return null

  const tryFetch = async (href: string, init?: RequestInit): Promise<Blob | null> => {
    try {
      const res = await fetch(href, init)
      if (!res.ok) return null
      const blob = await res.blob()
      return blob.size > 0 ? blob : null
    } catch {
      return null
    }
  }

  if (remote.startsWith('blob:') || remote.startsWith('data:') || isSameOriginUrl(remote)) {
    return tryFetch(remote, { credentials: 'same-origin' })
  }

  // 跨域：不直连 CDN（无 CORS 时会刷控制台），一律走同源代理
  return tryFetch(buildMediaProxyUrl(remote), {
    credentials: 'same-origin',
    referrerPolicy: 'no-referrer'
  })
}

/** 供 WebAV MP4Clip / AudioClip 使用的可读流 */
export async function fetchMediaStream(url: string): Promise<ReadableStream<Uint8Array> | null> {
  const blob = await fetchMediaBlob(url)
  if (!blob) return null
  return blob.stream() as ReadableStream<Uint8Array>
}
