import { ref, computed } from 'vue'
import { useModelList } from '~/composables/useModelList'
import { AI_MODEL_FUNC_CODE } from '~/utils/aiModelFuncCodes'
import { resolveMaxDefaultSizeCodeFromModels } from '~/utils/modelCapability'
import type { ModelOption } from '~/components/steps/ModelSelectDropdown.vue'

const FALLBACK_UPSCALE_MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'jimeng-image-ultra',
    name: '即梦超清',
    iconBg: '#60A5FA',
    desc: '图片高清',
    prices: []
  }
]

/** 编辑弹窗「变清晰」：加载 image_upscale 模型池并解析最大 defaultSizeCode 作为 resolution */
export function useUpscaleModelResolution() {
  const resolutionLower = ref('2k')
  const resolutionUpper = ref('2K')

  const {
    modelList: upscaleModelOptions,
    rawModelList,
    loadModels,
    loading: upscaleModelsLoading
  } = useModelList<ModelOption>({
    funcCode: AI_MODEL_FUNC_CODE.IMAGE_UPSCALE,
    modelType: 'image',
    fallback: FALLBACK_UPSCALE_MODEL_OPTIONS,
    mapItem: (item) => {
      const code = String(item.modelCode || '').trim()
      const sid = Number(item.id)
      return {
        id: code || String(item.id),
        serverModelId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
        name: item.modelName || code || '未命名模型',
        iconBg: '#60A5FA',
        desc: item.providerName ? `服务商：${item.providerName}` : '',
        prices: []
      }
    }
  })

  const upscaleSelectedModel = computed<ModelOption | null>(
    () => upscaleModelOptions.value[0] || FALLBACK_UPSCALE_MODEL_OPTIONS[0] || null
  )

  function syncResolutionFromRawList() {
    const models = rawModelList.value
    if (!models.length) return
    resolutionLower.value = resolveMaxDefaultSizeCodeFromModels(models, 'lower')
    resolutionUpper.value = resolveMaxDefaultSizeCodeFromModels(models, 'upper')
  }

  /** 进入弹窗时调用：已有列表则直接解析，否则请求 listByFunc(image_upscale) */
  async function ensureUpscaleModelsLoaded() {
    if (rawModelList.value.length > 0) {
      syncResolutionFromRawList()
      return
    }
    await loadModels()
    syncResolutionFromRawList()
  }

  return {
    upscaleModelOptions,
    upscaleSelectedModel,
    rawModelList,
    resolutionLower,
    resolutionUpper,
    ensureUpscaleModelsLoaded,
    upscaleModelsLoading
  }
}
