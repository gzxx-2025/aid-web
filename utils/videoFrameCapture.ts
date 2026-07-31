export type CapturedVideoFrame = {
  url: string
  name: string
  sourceVideoId?: string
  sourceLabel?: string
  capturedAtMs: number
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
  context.drawImage(video, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('截帧失败'))), 'image/png')
  })
  canvas.width = 0
  canvas.height = 0

  const name = /\.png$/i.test(fileName) ? fileName : `${fileName}.png`
  return new File([blob], name, { type: 'image/png' })
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
    const timer = window.setTimeout(() => finish(new Error('视频加载超时')), 8000)
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

async function seekVideoForThumbnail(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.005) return
  const seeked = waitForVideoEvent(video, 'seeked')
  video.currentTime = time
  await seeked
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

    const lastFrameTime = Math.max(0, duration - 1 / 30)
    const frames: string[] = []
    for (let index = 0; index < count; index += 1) {
      if (options.shouldContinue?.() === false) return []
      const time = count === 1 ? 0 : (lastFrameTime * index) / (count - 1)
      await seekVideoForThumbnail(video, time)
      if (options.shouldContinue?.() === false) return []
      frames.push(captureVideoThumbnail(video, maxWidth))
    }
    return frames
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}
