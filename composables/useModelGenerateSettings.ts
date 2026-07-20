import { computed, watch, type Ref } from 'vue'
import type { ModelOption } from '~/components/steps/ModelSelectDropdown.vue'
import type { UserModelListItem } from '~/types/business-api'
import {
  buildAspectRatioSelectOptions,
  buildCountSelectOptions,
  buildQualitySelectOptions,
  coerceGenerationSettings,
  parseModelCapability,
  type ModelCapabilitySnapshot
} from '~/utils/modelCapability'

export interface GenerationSettingsState {
  aspectRatio: string
  count: number
  quality: string
}

interface UseModelGenerateSettingsOptions {
  selectedModel: Ref<ModelOption>
  rawModelList: Ref<UserModelListItem[]>
  generationSettings: Ref<GenerationSettingsState>
  include3k?: boolean
}

/**
 * 根据 listByFunc 返回的模型 capability 驱动比例 / 张数 / 画质下拉
 */
export function useModelGenerateSettings(options: UseModelGenerateSettingsOptions) {
  const { selectedModel, rawModelList, generationSettings, include3k = false } = options

  const selectedRawModel = computed(() => {
    const code = String(selectedModel.value?.id || '').trim()
    const sid = selectedModel.value?.serverModelId
    return (
      rawModelList.value.find(
        (m) =>
          (sid != null && Number(m.id) === sid) ||
          String(m.modelCode || '').trim() === code
      ) ?? null
    )
  })

  const capabilitySnapshot = computed<ModelCapabilitySnapshot>(() =>
    parseModelCapability(selectedRawModel.value)
  )

  const aspectRatioSelectOptions = computed(() =>
    buildAspectRatioSelectOptions(capabilitySnapshot.value)
  )
  const countSelectOptions = computed(() => buildCountSelectOptions(capabilitySnapshot.value))
  const qualitySelectOptions = computed(() =>
    buildQualitySelectOptions(capabilitySnapshot.value, { include3k })
  )

  function syncSettingsToModel() {
    generationSettings.value = coerceGenerationSettings(
      generationSettings.value,
      capabilitySnapshot.value,
      { include3k }
    )
  }

  watch(selectedRawModel, () => syncSettingsToModel())

  return {
    capabilitySnapshot,
    aspectRatioSelectOptions,
    countSelectOptions,
    qualitySelectOptions,
    syncSettingsToModel
  }
}
