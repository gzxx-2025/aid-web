import type { UserModelListItem } from '~/types/business-api'

export interface ModelCapabilitySnapshot {
  aspectRatioOptions: string[]
  sizeOptions: string[]
  maxOutputCount: number
  defaultAspectRatio: string
  defaultSize: string
  defaultOutputCount: number
  durationOptions: number[]
  defaultDurationSeconds: number
  supportsDuration: boolean
}

export interface VideoGenerationSettingsState {
  aspectRatio: string
  count: number
  quality: string
  duration: string
  audio: string
}

export interface SelectOption<T extends string | number = string> {
  value: T
  label: string
}

const DEFAULT_ASPECT_RATIOS = ['16:9', '9:16', '1:1']
const DEFAULT_SIZE_OPTIONS = ['1k', '2k', '4k']
const DEFAULT_VIDEO_SIZE_OPTIONS = ['720p', '1080p']
const DEFAULT_DURATION_OPTIONS = [5, 10]
const DEFAULT_MAX_COUNT = 4
const MAX_STORYBOARD_VIDEO_COUNT = 4

const DEFAULT_AUDIO_OPTIONS: SelectOption<string>[] = [
  { value: 'silent', label: '无声视频' },
  { value: 'with_audio', label: '带音频' }
]

function normalizeSizeCode(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  if (/^\d+k$/i.test(t)) return t.toLowerCase()
  return t.toLowerCase()
}

/** 图片清晰度档位排序（1k < 2k < 4k < 8k） */
export function rankSizeCode(raw: string): number {
  const n = normalizeSizeCode(raw)
  if (!n) return -1
  const mk = n.match(/^(\d+)k$/)
  if (mk) return Number(mk[1])
  if (n === '720p') return 720
  if (n === '1080p') return 1080
  return 0
}

/** 从 image_upscale 模型池取 defaultSizeCode 的最大值，用作变清晰 resolution */
export function resolveMaxDefaultSizeCodeFromModels(
  models: UserModelListItem[],
  format: 'lower' | 'upper' = 'lower'
): string {
  let bestRaw = ''
  let bestRank = -1
  for (const item of models) {
    const code = String(item?.defaultSizeCode || '').trim()
    if (!code) continue
    const rank = rankSizeCode(code)
    if (rank > bestRank) {
      bestRank = rank
      bestRaw = code
    }
  }
  const fallback = format === 'upper' ? '2K' : '2k'
  if (!bestRaw) return fallback
  const normalized = normalizeSizeCode(bestRaw)
  if (format === 'upper') {
    return /^\d+k$/.test(normalized) ? normalized.toUpperCase() : bestRaw
  }
  return normalized || fallback
}

function formatSizeLabel(code: string): string {
  const n = normalizeSizeCode(code)
  if (/^\d+k$/.test(n)) return n.toUpperCase()
  return code
}

/** 从 listByFunc / model/list 单项解析生成配置下拉数据源 */
export function parseModelCapability(item?: UserModelListItem | null): ModelCapabilitySnapshot {
  const cap = (item?.capability ?? {}) as Record<string, unknown>
  const aspectFromCap = Array.isArray(cap.aspectRatioOptions)
    ? (cap.aspectRatioOptions as string[]).map(String).filter(Boolean)
    : []
  const sizeFromCap = Array.isArray(cap.sizeOptions)
    ? (cap.sizeOptions as string[]).map(normalizeSizeCode).filter(Boolean)
    : []

  const aspectRatioOptions =
    aspectFromCap.length > 0
      ? aspectFromCap
      : item?.supportsAspectRatio === false
        ? []
        : [...DEFAULT_ASPECT_RATIOS]

  const rawSizes =
    sizeFromCap.length > 0
      ? sizeFromCap
      : item?.defaultSizeCode
        ? [normalizeSizeCode(String(item.defaultSizeCode))]
        : [...DEFAULT_SIZE_OPTIONS]

  const sizeOptions = [...new Set(rawSizes.filter(Boolean))]
  const maxFromItem = Number(item?.maxOutputCount)
  const maxOutputCount =
    Number.isFinite(maxFromItem) && maxFromItem > 0
      ? Math.min(Math.floor(maxFromItem), 9)
      : DEFAULT_MAX_COUNT

  const defaultAspectRatio =
    String(cap.defaultAspectRatio ?? item?.defaultAspectRatio ?? aspectRatioOptions[0] ?? '16:9').trim() ||
    '16:9'

  const defaultSizeRaw = String(cap.defaultSize ?? item?.defaultSizeCode ?? sizeOptions[0] ?? '2k')
  const defaultSize = normalizeSizeCode(defaultSizeRaw) || sizeOptions[0] || '2k'

  const defaultOut = Number(item?.defaultOutputCount ?? cap.defaultOutputCount)
  const defaultOutputCount =
    Number.isFinite(defaultOut) && defaultOut > 0 ? Math.floor(defaultOut) : 1

  const durationFromCap = Array.isArray(cap.durationOptions)
    ? (cap.durationOptions as number[])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
    : []
  const durationOptions =
    durationFromCap.length > 0
      ? [...new Set(durationFromCap)]
      : item?.supportsDuration === false
        ? []
        : [...DEFAULT_DURATION_OPTIONS]

  const defaultDur = Number(cap.defaultDurationSeconds ?? item?.defaultDurationSeconds)
  const defaultDurationSeconds =
    Number.isFinite(defaultDur) && defaultDur > 0 && durationOptions.includes(defaultDur)
      ? Math.floor(defaultDur)
      : durationOptions[0] ?? 5

  const supportsDuration = item?.supportsDuration !== false && durationOptions.length > 0

  return {
    aspectRatioOptions,
    sizeOptions: sizeOptions.length ? sizeOptions : [...DEFAULT_SIZE_OPTIONS],
    maxOutputCount,
    defaultAspectRatio,
    defaultSize,
    defaultOutputCount,
    durationOptions,
    defaultDurationSeconds,
    supportsDuration
  }
}

/** 视频画质：优先 capability.sizeOptions（720P/1080P），否则回退默认 */
export function parseVideoQualityOptions(item?: UserModelListItem | null): string[] {
  const snapshot = parseModelCapability(item)
  const sizes = snapshot.sizeOptions
    .map((s) => String(s || '').trim())
    .filter(Boolean)
  if (sizes.length) return sizes
  return [...DEFAULT_VIDEO_SIZE_OPTIONS]
}

export function buildAspectRatioSelectOptions(
  snapshot: ModelCapabilitySnapshot
): SelectOption<string>[] {
  return snapshot.aspectRatioOptions.map((value) => ({ value, label: value }))
}

export function buildCountSelectOptions(snapshot: ModelCapabilitySnapshot): SelectOption<number>[] {
  const max = Math.max(1, snapshot.maxOutputCount)
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1
    return { value: n, label: `${n}张` }
  })
}

export function buildQualitySelectOptions(
  snapshot: ModelCapabilitySnapshot,
  opts?: { include3k?: boolean }
): SelectOption<string>[] {
  const include3k = opts?.include3k ?? false
  return snapshot.sizeOptions
    .filter((code) => include3k || code !== '3k')
    .map((value) => ({ value, label: formatSizeLabel(value) }))
}

export function buildVideoQualitySelectOptions(
  snapshot: ModelCapabilitySnapshot
): SelectOption<string>[] {
  const sizes = snapshot.sizeOptions
    .map((s) => String(s || '').trim())
    .filter(Boolean)
  const list = sizes.length ? sizes : [...DEFAULT_VIDEO_SIZE_OPTIONS]
  return list.map((value) => ({
    value: value.toLowerCase(),
    label: /^\d+p$/i.test(value) ? value.toUpperCase() : formatSizeLabel(value)
  }))
}

export function buildDurationSelectOptions(
  snapshot: ModelCapabilitySnapshot
): SelectOption<string>[] {
  return snapshot.durationOptions.map((sec) => ({
    value: String(sec),
    label: `${sec} s`
  }))
}

/** 分镜图生视频数量：接口上限 4 */
export function buildVideoCountSelectOptions(snapshot: ModelCapabilitySnapshot): SelectOption<number>[] {
  const max = Math.min(
    MAX_STORYBOARD_VIDEO_COUNT,
    Math.max(1, snapshot.maxOutputCount || MAX_STORYBOARD_VIDEO_COUNT)
  )
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1
    return { value: n, label: `${n}个` }
  })
}

export function buildAudioSelectOptions(): SelectOption<string>[] {
  return [...DEFAULT_AUDIO_OPTIONS]
}

/** 用枚举字典为比例 value 补充中文 label */
export function mergeAspectRatioLabels(
  values: string[],
  enumLabels: { value: string; label: string }[]
): SelectOption<string>[] {
  const labelMap = new Map(enumLabels.map((o) => [o.value, o.label]))
  return values.map((value) => ({
    value,
    label: labelMap.get(value) ? `${value}（${labelMap.get(value)}）` : value
  }))
}

export function coerceVideoGenerationSettings(
  current: VideoGenerationSettingsState,
  snapshot: ModelCapabilitySnapshot
): VideoGenerationSettingsState {
  const ratios = buildAspectRatioSelectOptions(snapshot)
  const counts = buildVideoCountSelectOptions(snapshot)
  const qualities = buildVideoQualitySelectOptions(snapshot)
  const durations = buildDurationSelectOptions(snapshot)
  const audios = buildAudioSelectOptions()

  let aspectRatio = current.aspectRatio
  if (!ratios.some((o) => o.value === aspectRatio)) {
    aspectRatio = ratios.some((o) => o.value === snapshot.defaultAspectRatio)
      ? snapshot.defaultAspectRatio
      : ratios[0]?.value ?? '16:9'
  }

  let count = current.count
  if (!counts.some((o) => o.value === count)) {
    count = counts.some((o) => o.value === snapshot.defaultOutputCount)
      ? Math.min(snapshot.defaultOutputCount, MAX_STORYBOARD_VIDEO_COUNT)
      : counts[0]?.value ?? 1
  }

  let quality = normalizeSizeCode(current.quality)
  if (!qualities.some((o) => o.value === quality)) {
    const def = normalizeSizeCode(snapshot.defaultSize)
    quality = qualities.some((o) => o.value === def) ? def : qualities[0]?.value ?? '1080p'
  }

  let duration = current.duration
  if (!durations.length) {
    duration = String(snapshot.defaultDurationSeconds)
  } else if (!durations.some((o) => o.value === duration)) {
    const def = String(snapshot.defaultDurationSeconds)
    duration = durations.some((o) => o.value === def) ? def : durations[0]?.value ?? '5'
  }

  let audio = current.audio
  if (!audios.some((o) => o.value === audio)) {
    audio = audios[0]?.value ?? 'silent'
  }

  return { aspectRatio, count, quality, duration, audio }
}

/** 切换模型时校正当前选中值 */
export function coerceGenerationSettings(
  current: { aspectRatio: string; count: number; quality: string },
  snapshot: ModelCapabilitySnapshot,
  opts?: { include3k?: boolean }
): { aspectRatio: string; count: number; quality: string } {
  const ratios = buildAspectRatioSelectOptions(snapshot)
  const counts = buildCountSelectOptions(snapshot)
  const qualities = buildQualitySelectOptions(snapshot, opts)

  let aspectRatio = current.aspectRatio
  if (!ratios.some((o) => o.value === aspectRatio)) {
    aspectRatio = ratios.some((o) => o.value === snapshot.defaultAspectRatio)
      ? snapshot.defaultAspectRatio
      : ratios[0]?.value ?? '16:9'
  }

  let count = current.count
  if (!counts.some((o) => o.value === count)) {
    count = counts.some((o) => o.value === snapshot.defaultOutputCount)
      ? snapshot.defaultOutputCount
      : counts[0]?.value ?? 1
  }

  let quality = normalizeSizeCode(current.quality)
  if (!qualities.some((o) => o.value === quality)) {
    quality = qualities.some((o) => o.value === snapshot.defaultSize)
      ? snapshot.defaultSize
      : qualities[0]?.value ?? '2k'
  }

  return { aspectRatio, count, quality }
}
