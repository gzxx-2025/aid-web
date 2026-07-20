import { ref } from 'vue'
import { userModelList, userModelListByFuncCodes } from '~/utils/businessApi'
import { pickFirstNonEmptyModelPool, uniqueTrimmedCodes } from '~/utils/modelListByFuncBatch'
import type { AiModelType, UserModelListItem } from '~/types/business-api'

interface UseModelListOptions<T> {
  modelType?: AiModelType
  /** model/list 生成模式细分，如 image_to_video */
  generateMode?: string
  /** v2.34.0：按功能编码查询模型列表，优先级高于 modelType */
  funcCode?: string
  /** funcCode 无数据时依次尝试的备选编码 */
  funcCodeFallbacks?: readonly string[]
  fallback?: T[]
  mapItem?: (item: UserModelListItem) => T
  onError?: (error: unknown) => void
  keepFallbackOnEmpty?: boolean
}

export function useModelList<T = UserModelListItem>(options: UseModelListOptions<T>) {
  const {
    modelType,
    generateMode,
    funcCode,
    funcCodeFallbacks = [],
    fallback = [],
    mapItem,
    onError,
    keepFallbackOnEmpty = true
  } = options

  const modelList = ref<T[]>([...fallback])
  /** listByFunc 原始列表，供 capability 解析 */
  const rawModelList = ref<UserModelListItem[]>([])
  const loading = ref(false)

  async function loadByFuncCodes(codes: readonly string[]): Promise<UserModelListItem[]> {
    const unique = uniqueTrimmedCodes(codes)
    if (!unique.length) return []
    try {
      const groups = await userModelListByFuncCodes(unique)
      return pickFirstNonEmptyModelPool(groups, unique)
    } catch {
      return []
    }
  }

  async function loadModels() {
    loading.value = true
    try {
      let list: UserModelListItem[] = []
      if (funcCode || funcCodeFallbacks.length > 0) {
        const codes = [
          ...(funcCode ? [funcCode] : []),
          ...funcCodeFallbacks.filter((c) => c !== funcCode)
        ]
        list = await loadByFuncCodes(codes)
      }
      if (list.length === 0 && modelType) {
        list = await userModelList({
          modelType,
          ...(generateMode ? { generateMode } : {})
        })
      } else if (list.length === 0 && !funcCode && funcCodeFallbacks.length === 0) {
        list = await userModelList({
          ...(modelType ? { modelType } : {}),
          ...(generateMode ? { generateMode } : {})
        })
      }

      rawModelList.value = list
      const mapped = mapItem ? list.map(mapItem) : (list as unknown as T[])
      if (mapped.length > 0) {
        modelList.value = mapped
      } else if (!keepFallbackOnEmpty) {
        modelList.value = []
        rawModelList.value = []
      }
      return mapped
    } catch (e: unknown) {
      if (fallback.length > 0) {
        modelList.value = [...fallback]
      }
      rawModelList.value = []
      onError?.(e)
      return [...modelList.value]
    } finally {
      loading.value = false
    }
  }

  return {
    modelList,
    rawModelList,
    loading,
    loadModels
  }
}
