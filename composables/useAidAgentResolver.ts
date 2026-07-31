import type { AssetExtractType } from '~/types/business-api'
import {
  CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY,
  FORM_GENERATE_AGENT_BIZ_CATEGORY,
  FORM_IMAGE_AGENT_BIZ_CATEGORY
} from '~/utils/extractAgentBiz'
import { resolveProjectGenAgentCode } from '~/utils/projectGenConfig'

/** 形态文案生成：仅读项目生成配置 agentCode */
export function resolveFormGenerateAgentCode(
  assetType: AssetExtractType,
  projectId?: number | null
): Promise<string> {
  return resolveProjectGenAgentCode(projectId, FORM_GENERATE_AGENT_BIZ_CATEGORY[assetType])
}

/** 形态图生成：仅读项目生成配置 agentCode */
export function resolveFormImageAgentCode(
  assetType: AssetExtractType,
  projectId?: number | null
): Promise<string> {
  return resolveProjectGenAgentCode(projectId, FORM_IMAGE_AGENT_BIZ_CATEGORY[assetType])
}

/** 角色设定卡：仅读项目生成配置 agentCode */
export function resolveCharacterCardImageAgentCode(projectId?: number | null): Promise<string> {
  return resolveProjectGenAgentCode(projectId, CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY)
}

/** @deprecated 生成配置已统一走 projectGenConfig，保留空实现避免旧引用报错 */
export function clearAidAgentResolverCache() {
  /* no-op */
}
