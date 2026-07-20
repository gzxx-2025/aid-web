import { computed, watch, type Ref } from 'vue'
import type { UserModelListItem } from '~/types/business-api'
import {
  buildAspectRatioSelectOptions,
  buildAudioSelectOptions,
  buildDurationSelectOptions,
  buildVideoCountSelectOptions,
  buildVideoQualitySelectOptions,
  coerceVideoGenerationSettings,
  mergeAspectRatioLabels,
  parseModelCapability,
  type ModelCapabilitySnapshot,
  type VideoGenerationSettingsState
} from '~/utils/modelCapability'

interface UseVideoModelGenerateSettingsOptions {
  selectedModelCode: Ref<string>
  rawModelList: Ref<UserModelListItem[]>
  generationSettings: Ref<VideoGenerationSettingsState>
  /** AspectRatioEnum 字典项，用于比例下拉展示名 */
  aspectRatioEnumLabels?: Ref<{ value: string; label: string }[]>
}

/**
 * 图生视频模型配置：listByFunc(main_storyboard_video) capability + 枚举字典比例文案
 */
export function useVideoModelGenerateSettings(options: UseVideoModelGenerateSettingsOptions) {
  const { selectedModelCode, rawModelList, generationSettings, aspectRatioEnumLabels } = options

  const selectedRawModel = computed(() => {
    const code = String(selectedModelCode.value || '').trim()
    if (!code) return null
    const normalized = code.toLowerCase()
    return (
      rawModelList.value.find((m) => {
        const mc = String(m.modelCode || '').trim()
        if (mc && (mc === code || mc.toLowerCase() === normalized)) return true
        const sid = Number(m.id)
        if (Number.isFinite(sid) && sid > 0 && String(sid) === code) return true
        const rawId = String(m.id ?? '').trim()
        if (rawId && (rawId === code || rawId.toLowerCase() === normalized)) return true
        return false
      }) ?? null
    )
  })

  const capabilitySnapshot = computed<ModelCapabilitySnapshot>(() =>
    parseModelCapability(selectedRawModel.value)
  )

  const aspectRatioSelectOptions = computed(() => {
    const base = buildAspectRatioSelectOptions(capabilitySnapshot.value)
    const labels = aspectRatioEnumLabels?.value ?? []
    if (!labels.length) return base
    return mergeAspectRatioLabels(
      base.map((o) => o.value),
      labels
    )
  })

  const countSelectOptions = computed(() => buildVideoCountSelectOptions(capabilitySnapshot.value))
  const qualitySelectOptions = computed(() =>
    buildVideoQualitySelectOptions(capabilitySnapshot.value)
  )
  const durationSelectOptions = computed(() =>
    buildDurationSelectOptions(capabilitySnapshot.value)
  )
  const audioSelectOptions = computed(() => buildAudioSelectOptions())

  const supportsDuration = computed(() => capabilitySnapshot.value.supportsDuration)

  function syncSettingsToModel() {
    generationSettings.value = coerceVideoGenerationSettings(
      generationSettings.value,
      capabilitySnapshot.value
    )
  }

  watch(selectedRawModel, () => syncSettingsToModel())

  return {
    capabilitySnapshot,
    aspectRatioSelectOptions,
    countSelectOptions,
    qualitySelectOptions,
    durationSelectOptions,
    audioSelectOptions,
    supportsDuration,
    syncSettingsToModel
  }
}
