import { aidAgentList } from '~/utils/businessApi'
import type { AssetExtractType } from '~/types/business-api'
import {
  CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY,
  FORM_GENERATE_AGENT_BIZ_CATEGORY,
  FORM_IMAGE_AGENT_BIZ_CATEGORY,
  agentOptionsFromGroup,
  pickFirstAgentOption
} from '~/utils/extractAgentBiz'
import { resolveProjectGenAgentCode } from '~/utils/projectGenConfig'

const cache = new Map<string, Promise<string>>()

async function resolveAgentCodeByBizCategory(bizCategoryCode: string): Promise<string> {
  const key = bizCategoryCode.trim()
  if (!key) throw new Error('智能体业务分类无效')

  let pending = cache.get(key)
  if (!pending) {
    pending = (async () => {
      const groups = await aidAgentList({ bizCategoryCodes: [key] })
      const options = agentOptionsFromGroup(groups, key)
      const first = pickFirstAgentOption(options)
      if (!first?.id) {
        throw new Error(`未配置业务分类「${key}」的可用智能体，请联系管理员`)
      }
      return first.id
    })()
    cache.set(key, pending)
  }
  return pending
}

async function resolveAgentCodeForScene(
  bizCategoryCode: string,
  projectId?: number | null
): Promise<string> {
  const fromProject = await resolveProjectGenAgentCode(projectId, bizCategoryCode)
  if (fromProject) return fromProject
  return resolveAgentCodeByBizCategory(bizCategoryCode)
}

/** 形态文案生成：优先项目配置 agentCode，否则 list 首项 */
export function resolveFormGenerateAgentCode(
  assetType: AssetExtractType,
  projectId?: number | null
): Promise<string> {
  return resolveAgentCodeForScene(FORM_GENERATE_AGENT_BIZ_CATEGORY[assetType], projectId)
}

/** 形态图生成 */
export function resolveFormImageAgentCode(
  assetType: AssetExtractType,
  projectId?: number | null
): Promise<string> {
  return resolveAgentCodeForScene(FORM_IMAGE_AGENT_BIZ_CATEGORY[assetType], projectId)
}

/** 角色设定卡 */
export function resolveCharacterCardImageAgentCode(projectId?: number | null): Promise<string> {
  return resolveAgentCodeForScene(CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY, projectId)
}

export function clearAidAgentResolverCache() {
  cache.clear()
}
