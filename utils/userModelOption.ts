import type { ModelOption } from '~/components/steps/ModelSelectDropdown.vue'
import type { UserModelListItem } from '~/types/business-api'

export type UserModelOptionSource = Pick<
  UserModelListItem,
  'id' | 'modelCode' | 'modelName' | 'providerName' | 'providerLogo'
>

export interface MapUserModelOptionConfig {
  iconBg?: string
  includePrices?: boolean
}

const DEFAULT_ICON_BG = '#10B981'

/** 将 model/list、listByFunc、gen-config/get 的模型项转为下拉选项（含 providerLogo） */
export function mapUserModelListItemToModelOption(
  item: UserModelOptionSource,
  config: MapUserModelOptionConfig = {}
): ModelOption {
  const code = String(item.modelCode || '').trim()
  const sid = Number(item.id)
  const logo = String(item.providerLogo || '').trim()
  return {
    id: code || String(item.id),
    serverModelId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
    name: item.modelName || code || '未命名模型',
    icon: logo || undefined,
    iconBg: config.iconBg ?? DEFAULT_ICON_BG,
    desc: item.providerName ? `服务商：${item.providerName}` : '',
    prices: config.includePrices ? [] : []
  }
}

/** 智能体选择弹窗等场景的轻量模型项 */
export function mapUserModelListItemToPickerOption(item: UserModelListItem) {
  const modelCode = String(item.modelCode || '').trim()
  const provider = String(item.providerName || '').trim()
  const typeLabel = String(item.modelType || '').trim()
  const logo = String(item.providerLogo || '').trim()
  return {
    modelCode,
    name: String(item.modelName || modelCode || '未命名模型'),
    desc: provider || typeLabel || undefined,
    logo: logo || undefined
  }
}

export function resolveUserModelProviderLogo(item?: UserModelOptionSource | null): string {
  return String(item?.providerLogo || '').trim()
}
