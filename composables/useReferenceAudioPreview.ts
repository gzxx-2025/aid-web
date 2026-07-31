/**
 * 参考音频单实例试听（素材条 / 已导入素材 / 音色 Tab 共用）
 */
import { onUnmounted, ref, type Ref } from 'vue'
import { message } from 'ant-design-vue'

export function useReferenceAudioPreview() {
  const playingId: Ref<string | null> = ref(null)
  let audio: HTMLAudioElement | null = null

  function ensureAudio(): HTMLAudioElement {
    if (!audio && import.meta.client) {
      audio = new Audio()
      audio.addEventListener('ended', () => {
        playingId.value = null
      })
      audio.addEventListener('pause', () => {
        if (audio && !audio.ended && audio.paused) {
          /* 手动 pause 时由调用方清 playingId */
        }
      })
    }
    if (!audio) {
      throw new Error('Audio unavailable')
    }
    return audio
  }

  function stop() {
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      try {
        audio.load()
      } catch {
        /* ignore */
      }
    }
    playingId.value = null
  }

  async function play(url: string, id: string) {
    const src = String(url || '').trim()
    if (!src) {
      message.warning('暂无可试听地址')
      return
    }
    if (playingId.value === id) {
      stop()
      return
    }
    try {
      const a = ensureAudio()
      stop()
      playingId.value = id
      a.src = src
      await a.play()
    } catch {
      playingId.value = null
      message.warning('试听加载失败，请检查网络或文件地址')
    }
  }

  function isPlaying(id: string): boolean {
    return playingId.value === id
  }

  onUnmounted(() => stop())

  return {
    playingId,
    play,
    stop,
    isPlaying
  }
}
