import { userProjectGenConfigGet, userProjectGenConfigSave } from '~/utils/businessApi'
import type {
  AssetExtractType,
  ProjectGenConfigSaveItem,
  ProjectGenConfigVO,
  UserModelListItem
} from '~/types/business-api'
import type { AgentOption } from '~/components/steps/AgentPickerModal.vue'
import {
  EXTRACT_PARALLEL_AGENT_BIZ_CATEGORY,
  FORM_GENERATE_AGENT_BIZ_CATEGORY,
  FORM_IMAGE_AGENT_BIZ_CATEGORY,
  STORYBOARD_SCRIPT_AGENT_BIZ_CATEGORY,
  STORYBOARD_STYLIST_MODEL_FUNC_CODE,
  STORYBOARD_VIDEO_PROMPT_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_PROMPT_IMAGE_AGENT_BIZ_CATEGORY,
  STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY,
  CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY,
  agentOptionsFromGenConfigVo
} from '~/utils/extractAgentBiz'

export const STORYBOARD_GEN_CONFIG_SCENE_CODES = {
  script: STORYBOARD_SCRIPT_AGENT_BIZ_CATEGORY,
  stylist: STORYBOARD_STYLIST_MODEL_FUNC_CODE,
  videoPrompt: STORYBOARD_VIDEO_PROMPT_AGENT_BIZ_CATEGORY,
  videoPromptImage: STORYBOARD_VIDEO_PROMPT_IMAGE_AGENT_BIZ_CATEGORY,
  image: STORYBOARD_IMAGE_AGENT_BIZ_CATEGORY
} as const

/** 分镜视频提示词场景（按创作模式仅命中其一） */
export const STORYBOARD_VIDEO_PROMPT_SCENE_CODES = [
  STORYBOARD_VIDEO_PROMPT_AGENT_BIZ_CATEGORY,
  STORYBOARD_VIDEO_PROMPT_IMAGE_AGENT_BIZ_CATEGORY,
  'main_storyboard_video_prompt_grid'
] as const

export interface ProjectGenScenePickerData {
  sceneCode: string
  agents: AgentOption[]
  availableModels: UserModelListItem[]
  agentCode: string
  modelCode: string
}

/** 从 gen-config/get 单场景 VO 解析智能体/模型池（供二次选择弹窗使用） */
export function projectGenScenePickerDataFromVo(vo: ProjectGenConfigVO): ProjectGenScenePickerData {
  return {
    sceneCode: String(vo.sceneCode || '').trim(),
    agents: agentOptionsFromGenConfigVo(vo),
    availableModels: Array.isArray(vo.availableModels) ? vo.availableModels : [],
    agentCode: String(vo.agentCode || '').trim(),
    modelCode: String(vo.modelCode || '').trim()
  }
}

/** 按 sceneCode 取 gen-config 智能体/模型池 */
export async function getProjectGenScenePickerData(
  projectId: number,
  sceneCode: string
): Promise<ProjectGenScenePickerData | null> {
  const cfg = await getProjectGenConfigBySceneCode(projectId, sceneCode)
  if (!cfg) return null
  return projectGenScenePickerDataFromVo(cfg)
}

/** 取当前创作模式下适用的分镜视频提示词场景配置 */
export async function getProjectGenVideoPromptPickerData(
  projectId: number
): Promise<ProjectGenScenePickerData | null> {
  const list = await fetchProjectGenConfigList(projectId)
  const codes = new Set<string>(STORYBOARD_VIDEO_PROMPT_SCENE_CODES)
  const hit = list.find((row) => codes.has(String(row.sceneCode || '').trim()))
  return hit ? projectGenScenePickerDataFromVo(hit) : null
}

export const CHARACTER_CARD_SCENE_CODE = CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY

/** 资产提取 sceneCode */
export const EXTRACT_SCENE_CODE_BY_TYPE: Record<AssetExtractType, string> = {
  ...EXTRACT_PARALLEL_AGENT_BIZ_CATEGORY
}

/** 形态文案 sceneCode */
export const FORM_GENERATE_SCENE_CODE_BY_TYPE: Record<AssetExtractType, string> = {
  ...FORM_GENERATE_AGENT_BIZ_CATEGORY
}

/** 形态图 sceneCode */
export const FORM_IMAGE_SCENE_CODE_BY_TYPE: Record<AssetExtractType, string> = {
  ...FORM_IMAGE_AGENT_BIZ_CATEGORY
}

type ProjectGenConfigCacheEntry = {
  at: number
  list: ProjectGenConfigVO[]
  bySceneCode: Map<string, ProjectGenConfigVO>
}

const CACHE_TTL_MS = 30_000
const cache = new Map<number, ProjectGenConfigCacheEntry>()

function indexBySceneCode(list: ProjectGenConfigVO[]): Map<string, ProjectGenConfigVO> {
  const map = new Map<string, ProjectGenConfigVO>()
  for (const row of list) {
    const code = String(row.sceneCode || '').trim()
    if (code) map.set(code, row)
  }
  return map
}

/** 清除项目配置缓存（切换作品或保存后调用） */
export function clearProjectGenConfigCache(projectId?: number) {
  if (projectId == null) {
    cache.clear()
    return
  }
  cache.delete(Number(projectId))
}

/** 拉取项目 15 项生成配置（带短时缓存） */
export async function fetchProjectGenConfigList(projectId: number): Promise<ProjectGenConfigVO[]> {
  const pid = Number(projectId)
  if (!Number.isFinite(pid) || pid <= 0) return []

  const now = Date.now()
  const hit = cache.get(pid)
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.list

  const list = await userProjectGenConfigGet({ projectId: pid })
  cache.set(pid, { at: now, list, bySceneCode: indexBySceneCode(list) })
  return list
}

/** 按 sceneCode 取单场景配置（含 availableModels 模型池） */
export async function getProjectGenConfigBySceneCode(
  projectId: number,
  sceneCode: string
): Promise<ProjectGenConfigVO | null> {
  const pid = Number(projectId)
  const code = String(sceneCode || '').trim()
  if (!Number.isFinite(pid) || pid <= 0 || !code) return null

  const now = Date.now()
  let entry = cache.get(pid)
  if (!entry || now - entry.at >= CACHE_TTL_MS) {
    const list = await fetchProjectGenConfigList(pid)
    entry = cache.get(pid) ?? { at: now, list, bySceneCode: indexBySceneCode(list) }
  }
  return entry.bySceneCode.get(code) ?? null
}

/** 保存部分场景配置 */
export async function saveProjectGenConfigItems(
  projectId: number,
  configs: ProjectGenConfigSaveItem[]
): Promise<ProjectGenConfigVO[]> {
  const pid = Number(projectId)
  if (!Number.isFinite(pid) || pid <= 0) throw new Error('项目不能空')
  if (!configs.length) throw new Error('配置不能空')

  await userProjectGenConfigSave({ projectId: pid, configs })
  clearProjectGenConfigCache(pid)
  return fetchProjectGenConfigList(pid)
}

/** 保存单场景（供各步骤「生成设置」弹窗同步项目配置） */
export async function saveSingleProjectGenConfigScene(
  projectId: number,
  sceneCode: string,
  agentCode: string,
  modelCode: string,
  imageParams?: { resolution?: string; aspectRatio?: string }
): Promise<void> {
  const agent = String(agentCode || '').trim()
  const model = String(modelCode || '').trim()
  if (!agent || !model) return
  const item: ProjectGenConfigSaveItem = {
    sceneCode,
    agentCode: agent,
    modelCode: model,
    ...(imageParams?.resolution ? { resolution: imageParams.resolution } : {}),
    ...(imageParams?.aspectRatio ? { aspectRatio: imageParams.aspectRatio } : {})
  }
  await saveProjectGenConfigItems(projectId, [item])
}

/** 从配置解析智能体编码；无配置时返回空串 */
export async function resolveProjectGenAgentCode(
  projectId: number | null | undefined,
  sceneCode: string
): Promise<string> {
  const pid = Number(projectId)
  if (!Number.isFinite(pid) || pid <= 0) return ''
  const cfg = await getProjectGenConfigBySceneCode(pid, sceneCode)
  return String(cfg?.agentCode || '').trim()
}

/** 从配置解析模型编码 */
export async function resolveProjectGenModelCode(
  projectId: number | null | undefined,
  sceneCode: string
): Promise<string> {
  const pid = Number(projectId)
  if (!Number.isFinite(pid) || pid <= 0) return ''
  const cfg = await getProjectGenConfigBySceneCode(pid, sceneCode)
  return String(cfg?.modelCode || '').trim()
}

/** 图片场景：解析清晰度 + 比例 */
export async function resolveProjectGenImageParams(
  projectId: number | null | undefined,
  sceneCode: string
): Promise<{ modelCode: string; resolution: string; aspectRatio: string }> {
  const pid = Number(projectId)
  if (!Number.isFinite(pid) || pid <= 0) {
    return { modelCode: '', resolution: '', aspectRatio: '' }
  }
  const cfg = await getProjectGenConfigBySceneCode(pid, sceneCode)
  return {
    modelCode: String(cfg?.modelCode || '').trim(),
    resolution: String(cfg?.resolution || '').trim(),
    aspectRatio: String(cfg?.aspectRatio || '').trim()
  }
}

export type ProjectGenFieldOverrides = {
  agentCode?: string | null
  modelCode?: string | null
  resolution?: string | null
  aspectRatio?: string | null
}

/** 文字类场景：手动值优先，否则取项目生成配置 */
export async function resolveProjectGenLlmSubmitFields(
  projectId: number | null | undefined,
  sceneCode: string,
  overrides?: Pick<ProjectGenFieldOverrides, 'agentCode' | 'modelCode'>
): Promise<{ agentCode: string; modelCode?: string }> {
  const pid = Number(projectId)
  const cfg =
    Number.isFinite(pid) && pid > 0
      ? await getProjectGenConfigBySceneCode(pid, sceneCode)
      : null

  const agentCode =
    String(overrides?.agentCode ?? '').trim() || String(cfg?.agentCode ?? '').trim()
  const modelCode =
    String(overrides?.modelCode ?? '').trim() || String(cfg?.modelCode ?? '').trim()

  return {
    agentCode,
    ...(modelCode ? { modelCode } : {})
  }
}

/** 图片类场景：手动值优先，否则取项目生成配置 */
export async function resolveProjectGenImageSubmitFields(
  projectId: number | null | undefined,
  sceneCode: string,
  overrides?: ProjectGenFieldOverrides
): Promise<{
  agentCode: string
  modelCode?: string
  resolution?: string
  aspectRatio?: string
}> {
  const pid = Number(projectId)
  const cfg =
    Number.isFinite(pid) && pid > 0
      ? await getProjectGenConfigBySceneCode(pid, sceneCode)
      : null

  const agentCode =
    String(overrides?.agentCode ?? '').trim() || String(cfg?.agentCode ?? '').trim()
  const modelCode =
    String(overrides?.modelCode ?? '').trim() || String(cfg?.modelCode ?? '').trim()
  const resolution =
    String(overrides?.resolution ?? '').trim() || String(cfg?.resolution ?? '').trim()
  const aspectRatio =
    String(overrides?.aspectRatio ?? '').trim() || String(cfg?.aspectRatio ?? '').trim()

  return {
    agentCode,
    ...(modelCode ? { modelCode } : {}),
    ...(resolution ? { resolution } : {}),
    ...(aspectRatio ? { aspectRatio } : {})
  }
}

/**
 * 分镜 LLM 批量/自动：手动在弹窗切换时传 manualPick=true 用手动值；
 * 否则显式传项目生成配置（不再依赖后端隐式兜底）。
 */
export async function resolveStoryboardGenConfigLlmFields(
  projectId: number | null | undefined,
  sceneCode: string,
  manualPick: boolean,
  manualAgentCode: string,
  manualModelCode: string
): Promise<{ agentCode?: string; modelCode?: string }> {
  if (manualPick) {
    const agentCode = String(manualAgentCode || '').trim()
    const modelCode = String(manualModelCode || '').trim()
    return {
      ...(agentCode ? { agentCode } : {}),
      ...(modelCode ? { modelCode } : {})
    }
  }
  const fields = await resolveProjectGenLlmSubmitFields(projectId, sceneCode)
  if (!fields.agentCode) return {}
  return {
    agentCode: fields.agentCode,
    ...(fields.modelCode ? { modelCode: fields.modelCode } : {})
  }
}

/**
 * 并行提取提交：优先项目生成配置 agentCode/modelCode；
 * manualModelCodes 中非空项视为用户在弹窗内手动覆盖。
 */
export async function buildParallelExtractSubmitPayload(
  projectId: number,
  types: AssetExtractType[],
  manualModelCodes: Partial<Record<AssetExtractType, string>>
): Promise<{
  agentCodes: Record<string, string>
  modelCodes?: Partial<Record<AssetExtractType, string>>
}> {
  const pid = Number(projectId)
  if (!Number.isFinite(pid) || pid <= 0) {
    throw new Error('缺少项目信息，无法读取生成配置')
  }

  const agentCodes: Record<string, string> = {}
  const modelCodesOut: Partial<Record<AssetExtractType, string>> = {}

  for (const t of types) {
    const sceneCode = EXTRACT_PARALLEL_AGENT_BIZ_CATEGORY[t]
    const manualModel = String(manualModelCodes[t] || '').trim()
    const fields = await resolveProjectGenLlmSubmitFields(pid, sceneCode, {
      ...(manualModel ? { modelCode: manualModel } : {})
    })
    if (!fields.agentCode) {
      const label = t === 'scene' ? '场景' : t === 'character' ? '角色' : '道具'
      throw new Error(`请先在「生成配置」中为「${label}提取」配置智能体`)
    }
    agentCodes[t] = fields.agentCode
    if (fields.modelCode) modelCodesOut[t] = fields.modelCode
  }

  return {
    agentCodes,
    modelCodes: Object.keys(modelCodesOut).length ? modelCodesOut : undefined
  }
}
