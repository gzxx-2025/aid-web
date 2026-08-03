export type CapturedVideoFrame = {
  url: string
  name: string
  sourceVideoId?: string
  sourceLabel?: string
  capturedAtMs: number
}

const DEFAULT_FRAME_INTERVAL_SECONDS = 1 / 30
const SEEK_TOLERANCE_SECONDS = 0.005
const VIDEO_EVENT_TIMEOUT_MS = 8000
const PRESENTED_FRAME_FALLBACK_MS = 250

type VideoFrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

/** 将时间限制在浏览器可解码的视频帧范围内，避免精确 duration 落入结束黑帧。 */
export function clampVideoFrameTime(target: number, duration: number): number {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
  const lastFrameTime = Math.max(0, safeDuration - DEFAULT_FRAME_INTERVAL_SECONDS)
  const safeTarget = Number.isFinite(target) ? target : 0
  return Math.min(Math.max(0, safeTarget), lastFrameTime)
}

/** 从已定位到目标时间的 video 元素截取 PNG 文件。 */
export async function captureVideoElementFrame(
  video: HTMLVideoElement,
  fileName: string
): Promise<File> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) throw new Error('视频尚未就绪')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建画布')

  try {
    context.drawImage(video, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('截帧编码失败'))),
        'image/png'
      )
    })
    const name = /\.png$/i.test(fileName) ? fileName : `${fileName}.png`
    return new File([blob], name, { type: 'image/png' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new Error('视频跨域保护导致截帧失败', { cause: error })
    }
    throw error
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

interface TimelineFrameOptions {
  count?: number
  maxWidth?: number
  shouldContinue?: () => boolean
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: 'loadedmetadata' | 'seeked'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error('视频加载超时')), VIDEO_EVENT_TIMEOUT_MS)
    const onSuccess = () => finish()
    const onError = () => finish(new Error('视频加载失败'))
    const finish = (error?: Error) => {
      window.clearTimeout(timer)
      video.removeEventListener(eventName, onSuccess)
      video.removeEventListener('error', onError)
      if (error) reject(error)
      else resolve()
    }
    video.addEventListener(eventName, onSuccess, { once: true })
    video.addEventListener('error', onError, { once: true })
  })
}

function waitForCurrentFrameData(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error('视频画面解码超时')), VIDEO_EVENT_TIMEOUT_MS)
    const onReady = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) finish()
    }
    const onError = () => finish(new Error('视频画面解码失败'))
    const finish = (error?: Error) => {
      window.clearTimeout(timer)
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('error', onError)
      if (error) reject(error)
      else resolve()
    }
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('canplay', onReady)
    video.addEventListener('error', onError)
    onReady()
  })
}

/** 等待目标帧提交到渲染管线；不支持 requestVideoFrameCallback 时使用双 RAF 降级。 */
function waitForPresentedVideoFrame(video: HTMLVideoElement): Promise<void> {
  const frameVideo = video as VideoFrameCallbackVideo
  if (!frameVideo.requestVideoFrameCallback) {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    })
  }

  return new Promise((resolve) => {
    let settled = false
    let callbackHandle: number | null = null
    const timer = window.setTimeout(finish, PRESENTED_FRAME_FALLBACK_MS)
    function finish() {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (callbackHandle != null) frameVideo.cancelVideoFrameCallback?.(callbackHandle)
      resolve()
    }
    callbackHandle = frameVideo.requestVideoFrameCallback!(finish)
  })
}

/**
 * 可靠定位并等待目标视频帧可读取。
 * 事件监听先于 currentTime 赋值，且已位于目标帧时不会制造一个永远不触发的 seeked。
 */
export async function seekVideoToFrame(video: HTMLVideoElement, target: number): Promise<number> {
  const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0
  if (!duration) throw new Error('视频时长无效')

  const safeTarget = clampVideoFrameTime(target, duration)
  const alreadyPositioned =
    !video.seeking && Math.abs(video.currentTime - safeTarget) < SEEK_TOLERANCE_SECONDS

  if (!alreadyPositioned) {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => finish(new Error('视频定位超时')), VIDEO_EVENT_TIMEOUT_MS)
      const onSeeked = () => finish()
      const onError = () => finish(new Error('视频定位失败'))
      const finish = (error?: Error) => {
        window.clearTimeout(timer)
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
        if (error) reject(error)
        else resolve()
      }

      video.addEventListener('seeked', onSeeked)
      video.addEventListener('error', onError)
      try {
        if (Math.abs(video.currentTime - safeTarget) >= SEEK_TOLERANCE_SECONDS) {
          video.currentTime = safeTarget
        } else if (!video.seeking) {
          finish()
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error('视频定位失败'))
      }
    })
  }

  await waitForCurrentFrameData(video)
  await waitForPresentedVideoFrame(video)
  return video.currentTime
}

function captureVideoThumbnail(video: HTMLVideoElement, maxWidth: number): string {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (!sourceWidth || !sourceHeight) throw new Error('视频尚未就绪')

  const width = Math.min(sourceWidth, maxWidth)
  const height = Math.max(1, Math.round((width / sourceWidth) * sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建画布')
  context.drawImage(video, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.78)
  canvas.width = 0
  canvas.height = 0
  return dataUrl
}

/** 生成仅用于当前弹窗展示的视频时间轴缩略图，不写入本地或数据库。 */
export async function captureVideoTimelineFrames(
  sourceUrl: string,
  options: TimelineFrameOptions = {}
): Promise<string[]> {
  const count = Math.max(1, Math.floor(options.count || 10))
  const maxWidth = Math.max(32, Math.floor(options.maxWidth || 160))
  if (!sourceUrl || options.shouldContinue?.() === false) return []

  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  try {
    const loadedMetadata = waitForVideoEvent(video, 'loadedmetadata')
    video.src = sourceUrl
    await loadedMetadata
    const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0
    if (!duration) return []

    const lastFrameTime = clampVideoFrameTime(duration, duration)
    const frames: string[] = []
    for (let index = 0; index < count; index += 1) {
      if (options.shouldContinue?.() === false) return []
      const time = count === 1 ? 0 : (lastFrameTime * index) / (count - 1)
      await seekVideoToFrame(video, time)
      if (options.shouldContinue?.() === false) return []
      frames.push(captureVideoThumbnail(video, maxWidth))
    }
    return frames
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}
