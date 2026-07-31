/**
 * 配音弹窗中间预览：有生成记录时跟配音结果，无记录时回退源视频
 */

export function resolveDubbingPreviewNavKey(input: {
  hist: Array<{ id: string }>
  currentKey?: string | null
  navKeySource: string
  navKeyLoading: string
  hasSourceVideo: boolean
}): string {
  const cur = String(input.currentKey || '').trim()
  if (cur && cur !== input.navKeyLoading && input.hist.some((h) => h.id === cur)) {
    return cur
  }
  if (input.hist.length > 0) {
    return input.hist[input.hist.length - 1]!.id
  }
  if (input.hasSourceVideo) return input.navKeySource
  return cur && cur !== input.navKeyLoading ? cur : input.navKeySource
}
