/**
 * 创建/更新作品时的视频风格字段：
 * - 官方风格（/api/user/asset/official/query）：videoStyleType ← assetName，videoStyleValue ← promptText
 * - 自定义上传等无 promptText：退化为 videoStyleType ← 资产名称或 `custom`，videoStyleValue ← 封面图 URL 或 id
 */
export type ProjectStyleSelection = {
  id: string
  name: string
  thumbnail: string
  assetName?: string
  promptText?: string | null
}

export function buildProjectVideoStyleFields(
  selected: ProjectStyleSelection | null,
  fallbackStyleLabel?: string
): { videoStyleType: string; videoStyleValue: string } | null {
  if (!selected) return null
  const prompt = String(selected.promptText ?? '').trim()
  const typeFromAsset = String(selected.assetName ?? selected.name ?? '').trim()

  if (prompt) {
    return {
      videoStyleType: typeFromAsset || String(selected.name ?? '').trim(),
      videoStyleValue: prompt
    }
  }

  const fb = String(fallbackStyleLabel ?? '').trim()
  const value = String(selected.thumbnail || selected.id || fb || '').trim()
  if (!value) return null

  return {
    videoStyleType: typeFromAsset || 'custom',
    videoStyleValue: value
  }
}
