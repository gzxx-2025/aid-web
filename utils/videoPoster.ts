/** 截取视频首帧为 data URL，用于列表封面展示 */
export function captureVideoFirstFrame(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!videoUrl?.trim()) {
      reject(new Error('empty video url'))
      return
    }

    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
      try {
        video.pause()
        video.removeAttribute('src')
        video.load()
      } catch {
        /* ignore */
      }
    }

    const onError = () => finish(() => reject(new Error('video load failed')))

    video.addEventListener('error', onError, { once: true })

    video.addEventListener(
      'loadeddata',
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        const seekTime = duration > 0 ? Math.min(0.1, duration * 0.01) : 0
        video.currentTime = seekTime
      },
      { once: true }
    )

    video.addEventListener(
      'seeked',
      () => {
        try {
          const width = video.videoWidth || 320
          const height = video.videoHeight || 180
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            onError()
            return
          }
          ctx.drawImage(video, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          finish(() => resolve(dataUrl))
        } catch {
          onError()
        }
      },
      { once: true }
    )

    video.src = videoUrl
    video.load()
  })
}
