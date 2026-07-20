import { readableStreamToBlob } from '@/utils/streamToBlob'

export type TimelineSegmentLike = {
  id: string
  url: string
  startTime: number
  endTime: number
  duration: number
  dialogue: string
  trimStart?: number
  trimEnd?: number
}

export type TimelineSubtitleLike = {
  id: string
  text: string
  startTime: number
  duration: number
}

export type TimelineAudioLike = {
  id: string
  url: string
  startTime: number
  duration: number
  volume?: number
  fadeIn?: number
  fadeOut?: number
  loop?: boolean
  kind?: 'voice' | 'music'
}

export type WebAVExportOpts = {
  width: number
  height: number
  bgColor?: string
  bgmVolume?: number
}

function assertClient() {
  if (import.meta.server) throw new Error('WebAV 导出只能在浏览器端运行')
}

async function fetchReadableBody(url: string): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`素材下载失败：${res.status} ${res.statusText}`)
  if (!res.body) throw new Error('素材无可读流（response.body 为空）')
  return res.body as unknown as ReadableStream<Uint8Array>
}

export function useWebAVExport() {
  async function exportTimelineToMp4(opts: {
    segments: TimelineSegmentLike[]
    subtitles?: TimelineSubtitleLike[]
    audioTracks?: TimelineAudioLike[]
    bgmUrl?: string // backward compatible
    exportOpts?: Partial<WebAVExportOpts>
    onLog?: (msg: string) => void
  }): Promise<Blob> {
    assertClient()
    const { segments, subtitles = [], audioTracks = [], bgmUrl, exportOpts, onLog = () => {} } = opts
    if (!segments?.length) throw new Error('没有可导出的片段')
    if (segments.some((s) => !s.url)) throw new Error('存在空的视频 URL，无法导出')

    const { width, height, bgColor = '#000', bgmVolume = 0.25 } = {
      width: 1280,
      height: 720,
      ...exportOpts
    } satisfies WebAVExportOpts

    onLog('加载 WebAV 依赖…')
    const webav = await import('@webav/av-cliper')
    const { MP4Clip, AudioClip, ImgClip, OffscreenSprite, renderTxt2ImgBitmap, Rect, Combinator } = webav as any

    const secToUs = (s: number) => Math.max(0, Math.round(s * 1_000_000))

    onLog('创建合成器…')
    const com = new Combinator({ width, height, bgColor })

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const startUs = secToUs(seg.startTime)
      const durUs = secToUs(seg.duration)
      onLog(`加载视频 ${i + 1}/${segments.length}`)
      const body = await fetchReadableBody(seg.url)
      let clip = new MP4Clip(body)
      await clip.ready

      const trimStartUs = secToUs(seg.trimStart || 0)
      const trimEndUs = secToUs(typeof seg.trimEnd === 'number' ? seg.trimEnd : seg.duration)
      if (trimStartUs > 0) {
        const [, rest] = await clip.split(trimStartUs)
        clip = rest
      }
      const keepUs = Math.max(1, trimEndUs - trimStartUs)
      const [kept] = await clip.split(keepUs)
      clip = kept

      const spr = new OffscreenSprite(clip)
      spr.time = { offset: startUs, duration: durUs }
      spr.zIndex = 1
      await com.addSprite(spr)
    }

    // 字幕轨导出
    for (let i = 0; i < subtitles.length; i++) {
      const sub = subtitles[i]
      const text = (sub.text || '').trim()
      if (!text || sub.duration <= 0) continue
      onLog(`生成字幕 ${i + 1}/${subtitles.length}`)
      const bmp = await renderTxt2ImgBitmap(
        text,
        'font-size:40px;color:#fff;background:rgba(0,0,0,0.60);padding:10px 16px;border-radius:10px;line-height:1.35;max-width:90%;text-align:center;'
      )
      const spr = new OffscreenSprite(new ImgClip(bmp))
      spr.time = { offset: secToUs(sub.startTime), duration: secToUs(sub.duration) }
      const w = bmp.width || Math.round(width * 0.9)
      const h = bmp.height || 90
      spr.rect = new Rect(Math.round((width - w) / 2), Math.round(height - 64 - h), w, h)
      spr.zIndex = 20
      await com.addSprite(spr)
    }

    const mergedAudioTracks: TimelineAudioLike[] = [...audioTracks]
    if (bgmUrl?.trim()) {
      mergedAudioTracks.push({
        id: `bgm-${Date.now()}`,
        url: bgmUrl.trim(),
        startTime: 0,
        duration: segments[segments.length - 1].endTime,
        volume: bgmVolume,
        loop: true,
        kind: 'music'
      })
    }

    for (let i = 0; i < mergedAudioTracks.length; i++) {
      const a = mergedAudioTracks[i]
      if (!a.url || a.duration <= 0) continue
      try {
        onLog(`加载音频 ${i + 1}/${mergedAudioTracks.length}`)
        const body = await fetchReadableBody(a.url)
        const clip = new AudioClip(body, { loop: !!a.loop })
        await clip.ready
        const spr = new OffscreenSprite(clip)
        spr.time = { offset: secToUs(a.startTime), duration: secToUs(a.duration) }
        ;(spr as any).volume = typeof a.volume === 'number' ? a.volume : (a.kind === 'music' ? bgmVolume : 1)
        spr.zIndex = 0
        await com.addSprite(spr)
      } catch {
        onLog('音频加载失败，已跳过')
      }
    }

    onLog('开始导出…')
    const out = com.output() as ReadableStream<Uint8Array>
    return await readableStreamToBlob(out, 'video/mp4')
  }

  return { exportTimelineToMp4 }
}

