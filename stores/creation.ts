import { defineStore } from 'pinia'
import type { WorkData, CreationStep } from '~/types'
import type { ExtractAgents } from '~/components/steps/ExtractAgentModal.vue'
import type { UserProjectType } from '~/types/business-api'
import { plainDeep } from '~/utils/plainDeep'
import type { TaskPartialFailedData } from '~/utils/taskPartialFailed'

/** 批量提取完成后：主表已入库但尚无形态，需用户点击「生成形态」的资产 */
export type PendingExtractFormAssetItem = {
  assetId: number
  assetType: 'scene' | 'character' | 'prop'
  title: string
}

// 场景图片数据
export interface SceneImage {
  id: string
  title: string
  url: string
  thumbnail?: string
  source: string
  importDate: string
}

// 角色/道具图片数据
export interface CharacterImage {
  id: string
  title: string
  url: string
  thumbnail?: string
  source: string
  importDate: string
}

// 场景生成状态
export type SceneGenerationStatus = 'idle' | 'generating' | 'success' | 'failed'

/** 第三步形态图生成 UI 状态按「作品 + 剧集」隔离，避免多 Tab/多作品互相覆盖 */
export type Step3GenVisualScopeMaps = {
  scene: Record<number, SceneGenerationStatus>
  character: Record<string, SceneGenerationStatus>
  prop: Record<string, SceneGenerationStatus>
  /** 场景/角色/道具编辑弹窗内 SSE 任务，key 为 editorScopeKey */
  modalSseTasks?: Record<string, SceneModalSseTaskSnapshot>
}

export type SceneModalSseTaskKind =
  | 'edit-image'
  | 'dialogue'
  | 'upscale'
  | 'multi-view'
  | 'setting-card'
  | 'form-image'

/** 第三步编辑弹窗 SSE 任务（按 editorScopeKey 隔离，刷新后恢复 loading） */
export type SceneModalSseTaskSnapshot = {
  taskId: number
  taskKind: SceneModalSseTaskKind
  sceneIdx: number
  imageIdx: number
  formId?: number | null
  imageId?: number | null
  editorScopeKey: string
}

/** 分镜图单镜生图任务（按 storyboardId 隔离，刷新后恢复弹窗 loading） */
export type StoryboardImageGenTaskSnapshot = {
  taskId: number
  sceneIdx: number
}

/** 分镜视频单镜生成任务（按 storyboardId 隔离） */
export type StoryboardVideoGenTaskSnapshot = {
  taskId: number
  sceneIdx: number
  taskKind: 'i2v' | 'multi'
}

/** 分镜脚本 / 分镜视频 / 配音批量 loading 等，与 step3 使用同一 scope key */
export type Step4PlusLiveGenSnapshot = {
  isGeneratingStoryboard: boolean
  storyboardGenerationProgress: { completed: number; total: number }
  storyboardGenerationError: string | null
  /** 分镜图批量生成（提示词 + 出图），与分镜脚本批量隔离 */
  isGeneratingStoryboardImageBatch: boolean
  storyboardImageBatchProgress: { completed: number; total: number }
  storyboardImageBatchError: string | null
  /** 分镜图批量父任务 id（storyboard_image_prompt_batch，刷新后恢复 SSE） */
  storyboardImageBatchActiveTaskId: number | null
  /** 分镜图出图父任务 id（storyboard_image_generate） */
  storyboardImageBatchActiveImageTaskId: number | null
  /** 分镜列表单镜出图 loading，key 为 storyboardId 字符串 */
  storyboardPanelImageGenStatusByStoryboardId: Record<string, SceneGenerationStatus>
  isGeneratingStoryboardVideo: boolean
  /** 分镜视频批量生成进度（提示词 + 出片） */
  storyboardVideoBatchProgress: { completed: number; total: number }
  storyboardVideoBatchError: string | null
  /** 分镜视频提示词批量父任务 id（storyboard_video_prompt_batch） */
  storyboardVideoBatchActivePromptTaskId: number | null
  /** 分镜视频出片父任务 id（storyboard_video_generate） */
  storyboardVideoBatchActiveVideoTaskId: number | null
  /** 分镜列表单镜出视频 loading，key 为 storyboardId 字符串 */
  storyboardPanelVideoGenStatusByStoryboardId: Record<string, SceneGenerationStatus>
  dubbingBatchGeneratingIndices: number[]
  /** 分镜脚本批量生成任务 id（按作品隔离，刷新后用于恢复 SSE） */
  storyboardScriptActiveTaskId: number | null
  /** 分镜脚本批量 PARTIAL_FAILED 时的 SSE 失败明细（供续生 UI 展示） */
  storyboardScriptPartialFailedData: TaskPartialFailedData | null
  /** 分镜图弹窗生图任务，key 为 storyboardId 字符串 */
  storyboardImageGenTasksByStoryboardId: Record<string, StoryboardImageGenTaskSnapshot>
  /** 分镜视频弹窗任务，key 为 storyboardId 字符串 */
  storyboardVideoGenTasksByStoryboardId: Record<string, StoryboardVideoGenTaskSnapshot>
}

export function liveGenScopeKeyFromIds(projectId: number | null, episodeId: number | null): string {
  const pid = projectId != null && Number.isFinite(Number(projectId)) ? Number(projectId) : 0
  const e =
    episodeId === null || episodeId === undefined ? 'null' : String(Number(episodeId))
  return `${pid}:${e}`
}

/** 第三步提取/批量生图 + 分镜可选 modelCode，按「作品:剧集」隔离，避免跨作品污染 */
export type ExtractModelCodesMap = {
  scene: string
  character: string
  prop: string
}

export type OptionalModelCodesScopeSnapshot = {
  /** 智能提取 / 形态文案（LLM） */
  extractText: ExtractModelCodesMap
  /** 形态图 generate-image / 批量生图 */
  extractImage: ExtractModelCodesMap
  storyboardScriptModelCode: string
  storyboardStylistModelCode: string
  /** 分镜脚本「生成设置」智能体（与 modelCode 同 scope 隔离） */
  storyboardScriptAgentId: string
  storyboardScriptAgentName: string
  storyboardScriptAgentDesc: string
  storyboardScriptAgentThumbnail: string
  /** @deprecated 旧版合并字段，仅可落到 extractText，禁止用于生图 */
  extract?: ExtractModelCodesMap
}

/** 分镜视频「生成设置」按作品:剧集隔离，避免 A 作品智能体/模型污染 B 作品 */
export type StoryboardVideoSettingsScopeSnapshot = {
  agentId: string
  agentName: string
  agentDesc: string
  agentThumbnail: string
  /** 图生视频模型（与 generate/video-prompt 的文本 modelCode 无关） */
  videoModel: string
  /** 生成视频提示词用的文本 modelCode；未选则不传接口 */
  videoPromptModelCode: string
  aspectRatio: '16:9' | '9:16' | '4:3' | '1:1'
  resolution: '720p' | '1080p'
  soundEffects: 'none' | 'with-sound'
}

function emptyStoryboardVideoSettingsScopeSnapshot(): StoryboardVideoSettingsScopeSnapshot {
  return {
    agentId: '',
    agentName: '',
    agentDesc: '',
    agentThumbnail: '',
    videoModel: '',
    videoPromptModelCode: '',
    aspectRatio: '16:9',
    resolution: '720p',
    soundEffects: 'none'
  }
}

function normalizeStoryboardVideoSettingsScopeSnapshot(
  raw: Partial<StoryboardVideoSettingsScopeSnapshot> | null | undefined
): StoryboardVideoSettingsScopeSnapshot {
  const empty = emptyStoryboardVideoSettingsScopeSnapshot()
  if (!raw) return empty
  const ar = String(raw.aspectRatio ?? empty.aspectRatio)
  const aspectRatio =
    ar === '16:9' || ar === '9:16' || ar === '4:3' || ar === '1:1' ? ar : empty.aspectRatio
  const res = String(raw.resolution ?? empty.resolution).toLowerCase()
  const resolution = res === '1080p' ? '1080p' : '720p'
  const se = String(raw.soundEffects ?? empty.soundEffects)
  const soundEffects = se === 'with-sound' ? 'with-sound' : 'none'
  return {
    agentId: String(raw.agentId ?? '').trim(),
    agentName: String(raw.agentName ?? '').trim(),
    agentDesc: String(raw.agentDesc ?? '').trim(),
    agentThumbnail: String(raw.agentThumbnail ?? '').trim(),
    videoModel: String(raw.videoModel ?? '').trim(),
    videoPromptModelCode: String(raw.videoPromptModelCode ?? '').trim(),
    aspectRatio,
    resolution,
    soundEffects
  }
}

function snapshotStoryboardVideoSettingsFromStore(store: {
  storyboardVideoAgent: { id: string; name: string; desc: string; thumbnail?: string }
  storyboardVideoGenerateSettings: {
    agentId?: string
    videoModel?: string
    videoPromptModelCode?: string
    aspectRatio?: StoryboardVideoSettingsScopeSnapshot['aspectRatio']
    resolution?: StoryboardVideoSettingsScopeSnapshot['resolution']
    soundEffects?: StoryboardVideoSettingsScopeSnapshot['soundEffects']
  }
}): StoryboardVideoSettingsScopeSnapshot {
  return normalizeStoryboardVideoSettingsScopeSnapshot({
    agentId: String(store.storyboardVideoGenerateSettings?.agentId ?? store.storyboardVideoAgent?.id ?? '').trim(),
    agentName: String(store.storyboardVideoAgent?.name ?? '').trim(),
    agentDesc: String(store.storyboardVideoAgent?.desc ?? '').trim(),
    agentThumbnail: String(store.storyboardVideoAgent?.thumbnail ?? '').trim(),
    videoModel: String(store.storyboardVideoGenerateSettings?.videoModel ?? '').trim(),
    videoPromptModelCode: String(store.storyboardVideoGenerateSettings?.videoPromptModelCode ?? '').trim(),
    aspectRatio: store.storyboardVideoGenerateSettings?.aspectRatio,
    resolution: store.storyboardVideoGenerateSettings?.resolution,
    soundEffects: store.storyboardVideoGenerateSettings?.soundEffects
  })
}

function applyStoryboardVideoSettingsToStore(
  store: {
    storyboardVideoAgent: { id: string; name: string; desc: string; thumbnail: string }
    storyboardVideoGenerateSettings: {
      agentId: string
      videoModel: string
      videoPromptModelCode: string
      aspectRatio: StoryboardVideoSettingsScopeSnapshot['aspectRatio']
      resolution: StoryboardVideoSettingsScopeSnapshot['resolution']
      soundEffects: StoryboardVideoSettingsScopeSnapshot['soundEffects']
    }
  },
  snap: StoryboardVideoSettingsScopeSnapshot
) {
  const normalized = normalizeStoryboardVideoSettingsScopeSnapshot(snap)
  store.storyboardVideoAgent = {
    id: normalized.agentId,
    name: normalized.agentName,
    desc: normalized.agentDesc,
    thumbnail: normalized.agentThumbnail
  }
  store.storyboardVideoGenerateSettings = {
    agentId: normalized.agentId,
    videoModel: normalized.videoModel,
    videoPromptModelCode: normalized.videoPromptModelCode,
    aspectRatio: normalized.aspectRatio,
    resolution: normalized.resolution,
    soundEffects: normalized.soundEffects
  }
}

function migrateStoryboardVideoSettingsFromPersist(store: {
  currentProjectId: number | null
  currentEpisodeId: number | null
  storyboardVideoSettingsByScope?: Record<string, StoryboardVideoSettingsScopeSnapshot>
  storyboardVideoAgent?: { id: string; name: string; desc: string; thumbnail?: string }
  storyboardVideoGenerateSettings?: StoryboardVideoSettingsScopeSnapshot
}) {
  if (!store.storyboardVideoSettingsByScope || typeof store.storyboardVideoSettingsByScope !== 'object') {
    store.storyboardVideoSettingsByScope = {}
  }
  const key = liveGenScopeKeyFromIds(store.currentProjectId, store.currentEpisodeId)
  applyStoryboardVideoSettingsToStore(
    store as Parameters<typeof applyStoryboardVideoSettingsToStore>[0],
    store.storyboardVideoSettingsByScope[key]
      ? normalizeStoryboardVideoSettingsScopeSnapshot(store.storyboardVideoSettingsByScope[key])
      : emptyStoryboardVideoSettingsScopeSnapshot()
  )
}

function emptyExtractModelCodes(): ExtractModelCodesMap {
  return { scene: '', character: '', prop: '' }
}

function emptyOptionalModelCodesScopeSnapshot(): OptionalModelCodesScopeSnapshot {
  return {
    extractText: emptyExtractModelCodes(),
    extractImage: emptyExtractModelCodes(),
    storyboardScriptModelCode: '',
    storyboardStylistModelCode: '',
    storyboardScriptAgentId: '',
    storyboardScriptAgentName: '',
    storyboardScriptAgentDesc: '',
    storyboardScriptAgentThumbnail: ''
  }
}

function normalizeOptionalModelCodesScopeSnapshot(
  raw: Partial<OptionalModelCodesScopeSnapshot> | null | undefined
): OptionalModelCodesScopeSnapshot {
  const empty = emptyOptionalModelCodesScopeSnapshot()
  if (!raw) return empty
  const legacyExtract = raw.extract ?? emptyExtractModelCodes()
  return {
    extractText: {
      scene: String(raw.extractText?.scene ?? legacyExtract.scene ?? '').trim(),
      character: String(raw.extractText?.character ?? legacyExtract.character ?? '').trim(),
      prop: String(raw.extractText?.prop ?? legacyExtract.prop ?? '').trim()
    },
    extractImage: {
      scene: String(raw.extractImage?.scene ?? '').trim(),
      character: String(raw.extractImage?.character ?? '').trim(),
      prop: String(raw.extractImage?.prop ?? '').trim()
    },
    storyboardScriptModelCode: String(raw.storyboardScriptModelCode ?? '').trim(),
    storyboardStylistModelCode: String(raw.storyboardStylistModelCode ?? '').trim(),
    storyboardScriptAgentId: String(raw.storyboardScriptAgentId ?? '').trim(),
    storyboardScriptAgentName: String(raw.storyboardScriptAgentName ?? '').trim(),
    storyboardScriptAgentDesc: String(raw.storyboardScriptAgentDesc ?? '').trim(),
    storyboardScriptAgentThumbnail: String(raw.storyboardScriptAgentThumbnail ?? '').trim()
  }
}

function snapshotOptionalModelCodesFromStore(store: {
  extractModelCodes: ExtractModelCodesMap
  extractImageModelCodes: ExtractModelCodesMap
  storyboardAgent: { id: string; name: string; desc: string; thumbnail?: string }
  storyboardGenerateSettings: { agentId?: string; modelCode?: string }
  storyboardStylistGenerateSettings: { modelCode?: string }
}): OptionalModelCodesScopeSnapshot {
  return {
    extractText: {
      scene: String(store.extractModelCodes?.scene ?? '').trim(),
      character: String(store.extractModelCodes?.character ?? '').trim(),
      prop: String(store.extractModelCodes?.prop ?? '').trim()
    },
    extractImage: {
      scene: String(store.extractImageModelCodes?.scene ?? '').trim(),
      character: String(store.extractImageModelCodes?.character ?? '').trim(),
      prop: String(store.extractImageModelCodes?.prop ?? '').trim()
    },
    storyboardScriptModelCode: String(store.storyboardGenerateSettings?.modelCode ?? '').trim(),
    storyboardStylistModelCode: String(store.storyboardStylistGenerateSettings?.modelCode ?? '').trim(),
    storyboardScriptAgentId: String(
      store.storyboardGenerateSettings?.agentId ?? store.storyboardAgent?.id ?? ''
    ).trim(),
    storyboardScriptAgentName: String(store.storyboardAgent?.name ?? '').trim(),
    storyboardScriptAgentDesc: String(store.storyboardAgent?.desc ?? '').trim(),
    storyboardScriptAgentThumbnail: String(store.storyboardAgent?.thumbnail ?? '').trim()
  }
}

type OptionalModelCodesStoreSlice = {
  extractModelCodes: ExtractModelCodesMap
  extractImageModelCodes: ExtractModelCodesMap
  storyboardAgent: { id: string; name: string; desc: string; thumbnail: string }
  storyboardGenerateSettings: { agentId: string; modelCode: string; shotDensity?: string }
  storyboardStylistGenerateSettings: { modelCode: string; agentId?: string }
}

function applyOptionalModelCodesToStore(
  store: OptionalModelCodesStoreSlice,
  snap: OptionalModelCodesScopeSnapshot
) {
  const normalized = normalizeOptionalModelCodesScopeSnapshot(snap)
  store.extractModelCodes = { ...normalized.extractText }
  store.extractImageModelCodes = { ...normalized.extractImage }
  store.storyboardGenerateSettings.modelCode = normalized.storyboardScriptModelCode
  store.storyboardStylistGenerateSettings.modelCode = normalized.storyboardStylistModelCode
  store.storyboardGenerateSettings.agentId = normalized.storyboardScriptAgentId
  store.storyboardAgent = {
    id: normalized.storyboardScriptAgentId,
    name: normalized.storyboardScriptAgentName,
    desc: normalized.storyboardScriptAgentDesc,
    thumbnail: normalized.storyboardScriptAgentThumbnail
  }
}

function migrateOptionalModelCodesFromPersist(
  store: OptionalModelCodesStoreSlice & {
    currentProjectId: number | null
    currentEpisodeId: number | null
    optionalModelCodesByScope?: Record<string, OptionalModelCodesScopeSnapshot>
  }
) {
  if (!store.optionalModelCodesByScope || typeof store.optionalModelCodesByScope !== 'object') {
    store.optionalModelCodesByScope = {}
  }
  const key = liveGenScopeKeyFromIds(store.currentProjectId, store.currentEpisodeId)

  /** 丢弃 localStorage 里未分桶的扁平字段，避免刷新后写入当前作品（此前 bug 根因） */
  store.extractModelCodes = emptyExtractModelCodes()
  store.extractImageModelCodes = emptyExtractModelCodes()
  store.storyboardGenerateSettings.modelCode = ''
  store.storyboardGenerateSettings.agentId = ''
  store.storyboardStylistGenerateSettings.modelCode = ''
  store.storyboardAgent.id = ''
  store.storyboardAgent.name = ''
  store.storyboardAgent.desc = ''
  store.storyboardAgent.thumbnail = ''

  const scoped = store.optionalModelCodesByScope[key]
  applyOptionalModelCodesToStore(
    store,
    scoped ? normalizeOptionalModelCodesScopeSnapshot(scoped) : emptyOptionalModelCodesScopeSnapshot()
  )
}

function emptyStep4PlusLiveGenSnapshot(): Step4PlusLiveGenSnapshot {
  return {
    isGeneratingStoryboard: false,
    storyboardGenerationProgress: { completed: 0, total: 0 },
    storyboardGenerationError: null,
    isGeneratingStoryboardImageBatch: false,
    storyboardImageBatchProgress: { completed: 0, total: 0 },
    storyboardImageBatchError: null,
    storyboardImageBatchActiveTaskId: null,
    storyboardImageBatchActiveImageTaskId: null,
    storyboardPanelImageGenStatusByStoryboardId: {},
    isGeneratingStoryboardVideo: false,
    storyboardVideoBatchProgress: { completed: 0, total: 0 },
    storyboardVideoBatchError: null,
    storyboardVideoBatchActivePromptTaskId: null,
    storyboardVideoBatchActiveVideoTaskId: null,
    storyboardPanelVideoGenStatusByStoryboardId: {},
    dubbingBatchGeneratingIndices: [],
    storyboardScriptActiveTaskId: null,
    storyboardScriptPartialFailedData: null,
    storyboardImageGenTasksByStoryboardId: {},
    storyboardVideoGenTasksByStoryboardId: {}
  }
}

function migrateStep4PlusLiveGenAfterRestore(store: {
  step4PlusLiveGenByScope?: Record<string, Step4PlusLiveGenSnapshot>
  dubbingBatchGeneratingIndices?: number[]
  step3GenVisualScopeKey?: () => string
  currentProjectId: number | null
  currentEpisodeId: number | null
  isGeneratingStoryboard: boolean
  storyboardGenerationProgress: { completed: number; total: number }
  storyboardGenerationError: string | null
  isGeneratingStoryboardImageBatch: boolean
  storyboardImageBatchProgress: { completed: number; total: number }
  storyboardImageBatchError: string | null
  storyboardImageBatchActiveTaskId: number | null
  storyboardImageBatchActiveImageTaskId: number | null
  storyboardPanelImageGenStatusByStoryboardId: Record<string, SceneGenerationStatus>
  isGeneratingStoryboardVideo: boolean
  storyboardVideoBatchProgress: { completed: number; total: number }
  storyboardVideoBatchError: string | null
  storyboardVideoBatchActivePromptTaskId: number | null
  storyboardVideoBatchActiveVideoTaskId: number | null
  storyboardPanelVideoGenStatusByStoryboardId: Record<string, SceneGenerationStatus>
  storyboardScriptActiveTaskId: number | null
  storyboardScriptPartialFailedData?: TaskPartialFailedData | null
}) {
  if (!store.step4PlusLiveGenByScope || typeof store.step4PlusLiveGenByScope !== 'object') {
    // eslint-disable-next-line no-param-reassign
    store.step4PlusLiveGenByScope = {}
  }
  if (!Array.isArray(store.dubbingBatchGeneratingIndices)) {
    // eslint-disable-next-line no-param-reassign
    store.dubbingBatchGeneratingIndices = []
  }
  const key =
    typeof store.step3GenVisualScopeKey === 'function'
      ? store.step3GenVisualScopeKey()
      : liveGenScopeKeyFromIds(store.currentProjectId, store.currentEpisodeId)
  const blob = store.step4PlusLiveGenByScope[key]
  if (blob) {
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboard = Boolean(blob.isGeneratingStoryboard)
    // eslint-disable-next-line no-param-reassign
    store.storyboardGenerationProgress = blob.storyboardGenerationProgress || { completed: 0, total: 0 }
    // eslint-disable-next-line no-param-reassign
    store.storyboardGenerationError = blob.storyboardGenerationError ?? null
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboardImageBatch = Boolean(blob.isGeneratingStoryboardImageBatch)
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchProgress = blob.storyboardImageBatchProgress || { completed: 0, total: 0 }
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchError = blob.storyboardImageBatchError ?? null
    const imageBatchTid = Number(blob.storyboardImageBatchActiveTaskId)
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchActiveTaskId =
      Number.isFinite(imageBatchTid) && imageBatchTid > 0 ? imageBatchTid : null
    const imageGenBatchTid = Number(blob.storyboardImageBatchActiveImageTaskId)
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchActiveImageTaskId =
      Number.isFinite(imageGenBatchTid) && imageGenBatchTid > 0 ? imageGenBatchTid : null
    // eslint-disable-next-line no-param-reassign
    store.storyboardPanelImageGenStatusByStoryboardId =
      blob.storyboardPanelImageGenStatusByStoryboardId &&
      typeof blob.storyboardPanelImageGenStatusByStoryboardId === 'object'
        ? { ...blob.storyboardPanelImageGenStatusByStoryboardId }
        : {}
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboardVideo = Boolean(blob.isGeneratingStoryboardVideo)
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchProgress = blob.storyboardVideoBatchProgress || { completed: 0, total: 0 }
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchError = blob.storyboardVideoBatchError ?? null
    const videoPromptBatchTid = Number(blob.storyboardVideoBatchActivePromptTaskId)
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchActivePromptTaskId =
      Number.isFinite(videoPromptBatchTid) && videoPromptBatchTid > 0 ? videoPromptBatchTid : null
    const videoBatchTid = Number(blob.storyboardVideoBatchActiveVideoTaskId)
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchActiveVideoTaskId =
      Number.isFinite(videoBatchTid) && videoBatchTid > 0 ? videoBatchTid : null
    // eslint-disable-next-line no-param-reassign
    store.storyboardPanelVideoGenStatusByStoryboardId =
      blob.storyboardPanelVideoGenStatusByStoryboardId &&
      typeof blob.storyboardPanelVideoGenStatusByStoryboardId === 'object'
        ? { ...blob.storyboardPanelVideoGenStatusByStoryboardId }
        : {}
    // eslint-disable-next-line no-param-reassign
    store.dubbingBatchGeneratingIndices = Array.isArray(blob.dubbingBatchGeneratingIndices)
      ? [...blob.dubbingBatchGeneratingIndices]
      : []
    const tid = Number(blob.storyboardScriptActiveTaskId)
    // eslint-disable-next-line no-param-reassign
    store.storyboardScriptActiveTaskId = Number.isFinite(tid) && tid > 0 ? tid : null
    // eslint-disable-next-line no-param-reassign
    store.storyboardScriptPartialFailedData = blob.storyboardScriptPartialFailedData ?? null
    const patch: Partial<Step4PlusLiveGenSnapshot> = {}
    if (
      !blob.storyboardPanelImageGenStatusByStoryboardId ||
      typeof blob.storyboardPanelImageGenStatusByStoryboardId !== 'object'
    ) {
      patch.storyboardPanelImageGenStatusByStoryboardId = {}
    }
    if (
      !blob.storyboardImageGenTasksByStoryboardId ||
      typeof blob.storyboardImageGenTasksByStoryboardId !== 'object'
    ) {
      patch.storyboardImageGenTasksByStoryboardId = {}
    }
    if (
      !blob.storyboardVideoGenTasksByStoryboardId ||
      typeof blob.storyboardVideoGenTasksByStoryboardId !== 'object'
    ) {
      patch.storyboardVideoGenTasksByStoryboardId = {}
    }
    if (
      !blob.storyboardPanelVideoGenStatusByStoryboardId ||
      typeof blob.storyboardPanelVideoGenStatusByStoryboardId !== 'object'
    ) {
      patch.storyboardPanelVideoGenStatusByStoryboardId = {}
    }
    if (Object.keys(patch).length) {
      // eslint-disable-next-line no-param-reassign
      store.step4PlusLiveGenByScope[key] = { ...blob, ...patch }
    }
  }
}

function migrateStep3GenVisualMapsFromPersist(store: {
  currentProjectId: number | null
  currentEpisodeId: number | null
  step3GenVisualByScope?: Record<string, Step3GenVisualScopeMaps>
  sceneGenerationStatus: Record<number, SceneGenerationStatus>
  characterFormGenerationStatus: Record<string, SceneGenerationStatus>
  propFormGenerationStatus: Record<string, SceneGenerationStatus>
}) {
  const pid =
    store.currentProjectId != null && Number.isFinite(Number(store.currentProjectId))
      ? Number(store.currentProjectId)
      : 0
  const e =
    store.currentEpisodeId === null || store.currentEpisodeId === undefined
      ? 'null'
      : String(Number(store.currentEpisodeId))
  const sk = `${pid}:${e}`

  if (!store.step3GenVisualByScope || typeof store.step3GenVisualByScope !== 'object') {
    store.step3GenVisualByScope = {}
  }

  const legacyScene =
    store.sceneGenerationStatus && typeof store.sceneGenerationStatus === 'object'
      ? store.sceneGenerationStatus
      : {}
  const legacyChar =
    store.characterFormGenerationStatus && typeof store.characterFormGenerationStatus === 'object'
      ? store.characterFormGenerationStatus
      : {}
  const legacyProp =
    store.propFormGenerationStatus && typeof store.propFormGenerationStatus === 'object'
      ? store.propFormGenerationStatus
      : {}

  const hasLegacy =
    Object.keys(legacyScene).length > 0 ||
    Object.keys(legacyChar).length > 0 ||
    Object.keys(legacyProp).length > 0

  let scoped = store.step3GenVisualByScope[sk]
  const scopedEmpty =
    !scoped ||
    (!Object.keys(scoped.scene || {}).length &&
      !Object.keys(scoped.character || {}).length &&
      !Object.keys(scoped.prop || {}).length)

  if (hasLegacy && scopedEmpty) {
    store.step3GenVisualByScope[sk] = {
      scene: { ...legacyScene },
      character: { ...legacyChar },
      prop: { ...legacyProp },
      modalSseTasks: { ...(scoped?.modalSseTasks || {}) }
    }
    scoped = store.step3GenVisualByScope[sk]
  }

  if (scoped && !scoped.modalSseTasks) {
    store.step3GenVisualByScope[sk] = {
      scene: { ...(scoped.scene || {}) },
      character: { ...(scoped.character || {}) },
      prop: { ...(scoped.prop || {}) },
      modalSseTasks: {}
    }
    scoped = store.step3GenVisualByScope[sk]
  }

  store.sceneGenerationStatus = scoped?.scene ? { ...scoped.scene } : {}
  store.characterFormGenerationStatus = scoped?.character ? { ...scoped.character } : {}
  store.propFormGenerationStatus = scoped?.prop ? { ...scoped.prop } : {}
}

function pausedTasksFollowSessionKey(projectId: number): string {
  return `cf-paused-task-follow:${projectId}`
}

export const useCreationStore = defineStore('creation', {
  state: () => ({
    // 作品标题
    workTitle: '未命名作品',
    
    // 当前步骤索引
    currentStepIndex: 0,

    // 当前创作上下文（用于步骤接口等需要 projectId/episodeId 的场景）
    currentProjectId: null as number | null,
    /** 电影可为 0；未选择剧集时为 null */
    currentEpisodeId: null as number | null,
    /** 与后端一致：movie=电影（剧本 episodeId 用 0），series=剧集 */
    currentProjectType: null as UserProjectType | null,
    /** 剧集：是否已从「上传剧本」首屏进入故事剧本（避免 /create 再次挡回上传页） */
    seriesFlowEnteredStoryScript: false,
    /** 剧集列表页：分集总数（供顶栏「共 N 集」展示） */
    seriesEpisodeListTotal: null as number | null,
    
    // 表单数据
    formData: {
      globalSetting: {
        title: '',
        genre: '',
        style: '',
        description: '',
        aspectRatio: '16:9' as const,
        scriptType: 'plot' as const,
        modelStrategy: 'economy' as const,
        creationMode: 'i2v' as const,
        selectedStyle: null as { id: string; name: string; thumbnail: string } | null,
        myStyles: [] as Array<{ id: string; name: string; thumbnail: string }>
      },
      storyScript: {
        content: ''
      },
      sceneCharacter: {
        characters: [] as string[],
        scenes: [] as string[],
        props: [] as string[]
      },
      storyboardScript: {
        panels: [] as import('~/types').StoryboardPanel[]
      },
      storyboardVideo: {
        panels: [] as import('~/types').StoryboardVideoPanel[]
      },
      dubbing: {
        voiceActors: [] as string[],
        bgm: '',
        panels: [] as import('~/types').DubbingPanel[]
      }
    } as WorkData,
    
    /** 第三步：rps 列表 bootstrap（拉取 + pending 对齐 + 任务恢复）是否已完成 */
    step3AssetListSyncReady: false,

    // 第三步：提取智能体选择与提取状态
    showExtractAgentModal: false,
    isExtractingAssets: false,
    extractingStage: 'scene' as 'scene' | 'character' | 'prop',
    extractingStages: {
      scene: false,
      character: false,
      prop: false
    },
    /** 第三步：提取任务进度（SSE/轮询都会更新它） */
    extractingTaskProgress: {
      percent: 0,
      stepTitle: '',
      message: '',
      stepIndex: null as number | null,
      stepTotal: null as number | null
    },
    extractAgents: {
      scene: { id: '', name: '', desc: '', thumbnail: '' },
      character: { id: '', name: '', desc: '', thumbnail: '' },
      prop: { id: '', name: '', desc: '', thumbnail: '' }
    } as ExtractAgents,
    /** 智能提取 / 形态文案（text）modelCode */
    extractModelCodes: {
      scene: '',
      character: '',
      prop: ''
    } as ExtractModelCodesMap,
    /** 形态图 generate-image / 批量生图（image）modelCode，与 extractModelCodes 分桶 */
    extractImageModelCodes: {
      scene: '',
      character: '',
      prop: ''
    } as ExtractModelCodesMap,
    /** 与 step3GenVisualByScope 同 key：作品内各剧集/跨作品互不污染 modelCode */
    optionalModelCodesByScope: {} as Record<string, OptionalModelCodesScopeSnapshot>,
    /** 分镜视频生成设置（智能体/模型/比例等），按作品:剧集分桶 */
    storyboardVideoSettingsByScope: {} as Record<string, StoryboardVideoSettingsScopeSnapshot>,
    
    // 场景角色道具的扩展数据（图片、形态等）
    sceneImages: {} as Record<number, SceneImage[]>,
    characterImages: {} as Record<number, CharacterImage[]>,
    propImages: {} as Record<number, CharacterImage[]>,
    characterFormImages: {} as Record<string, CharacterImage[]>, // key: "characterIndex-formIndex"
    propFormImages: {} as Record<string, CharacterImage[]>, // key: "propIndex-formIndex"
    manualScenes: [] as number[], // 手动添加的场景索引数组
    /** 手动添加场景的主资产 id（刷新后按 id 恢复，不依赖列表索引） */
    manualSceneAssetIds: [] as number[],
    manualCharacters: [] as number[], // 手动添加的角色索引数组
    manualProps: [] as number[], // 手动添加的道具索引数组
    characterForms: {} as Record<number, Array<{ name: string; voiceover?: string }>>,
    propForms: {} as Record<number, Array<{ name: string }>>,
    sceneGenerationStatus: {} as Record<number, SceneGenerationStatus>,
    characterFormGenerationStatus: {} as Record<string, SceneGenerationStatus>,
    propFormGenerationStatus: {} as Record<string, SceneGenerationStatus>,
    /** key 与 step3GenVisualScopeKey() 一致：`${projectId}:${episodeKey}` */
    step3GenVisualByScope: {} as Record<string, Step3GenVisualScopeMaps>,
    /** 配音步骤：批量生成中的分镜下标（与分镜脚本/视频 loading 一并按作品隔离） */
    dubbingBatchGeneratingIndices: [] as number[],
    /** 分镜脚本 / 分镜视频 / 配音批量 等 UI 状态按作品分桶 */
    step4PlusLiveGenByScope: {} as Record<string, Step4PlusLiveGenSnapshot>,
    // 分镜脚本：生成设置与生成状态
    storyboardAgent: {
      id: '',
      name: '',
      desc: '',
      thumbnail: ''
    },
    storyboardGenerateSettings: {
      agentId: '',
      /** StoryboardShotDensityEnum.value，如「标准模式」 */
      shotDensity: '标准模式' as string,
      /** 分镜脚本智能体弹窗所选 modelCode，用于 POST /storyboard/generate/script */
      modelCode: ''
    },
    /** 分镜图提示词（image-prompt）：biz_category=main_storyboard_stylist */
    storyboardStylistAgent: {
      id: '',
      name: '',
      desc: '',
      thumbnail: ''
    },
    storyboardStylistGenerateSettings: {
      agentId: '',
      /** 文本模型 modelCode；未选则不传 image-prompt 的 modelCode */
      modelCode: ''
    },
    // 分镜视频：生成设置（未在「生成设置」选择前保持为空，接口不传 agentCode/modelCode）
    storyboardVideoAgent: {
      id: '',
      name: '',
      desc: '',
      thumbnail: ''
    },
    storyboardVideoGenerateSettings: {
      agentId: '',
      videoModel: '',
      videoPromptModelCode: '',
      aspectRatio: '16:9' as '16:9' | '9:16' | '4:3' | '1:1',
      resolution: '720p' as '720p' | '1080p',
      soundEffects: 'none' as 'none' | 'with-sound'
    },
    isGeneratingStoryboard: false,
    storyboardGenerationProgress: { completed: 0, total: 0 },
    storyboardGenerationError: null as string | null,
    /** 当前作品 scope 内进行中的分镜脚本批量任务 id（与 step4PlusLiveGenByScope 同步） */
    storyboardScriptActiveTaskId: null as number | null,
    storyboardScriptPartialFailedData: null as TaskPartialFailedData | null,
    /** 分镜图批量生成中（提示词 + 出图），与分镜脚本批量隔离 */
    isGeneratingStoryboardImageBatch: false,
    storyboardImageBatchProgress: { completed: 0, total: 0 },
    storyboardImageBatchError: null as string | null,
    storyboardImageBatchActiveTaskId: null as number | null,
    storyboardImageBatchActiveImageTaskId: null as number | null,
    storyboardPanelImageGenStatusByStoryboardId: {} as Record<string, SceneGenerationStatus>,
    // 分镜视频自动生成中（列表每项 loading、左侧步骤 loading、顶部进度 loading、按钮变停止生成）
    isGeneratingStoryboardVideo: false,
    storyboardVideoBatchProgress: { completed: 0, total: 0 },
    storyboardVideoBatchError: null as string | null,
    storyboardVideoBatchActivePromptTaskId: null as number | null,
    storyboardVideoBatchActiveVideoTaskId: null as number | null,
    storyboardPanelVideoGenStatusByStoryboardId: {} as Record<string, SceneGenerationStatus>,

    /** 第三步：场景/角色形态/道具形态「自动生成」进行中的视觉反馈（流程步骤条 loading） */
    isGeneratingStep3Visual: false,

    /**
     * 第三步形态图 SSE 跟进计数（跨流程步骤切换时仍保持流程条 loading，组件卸载不重置）。
     * 与 scene/character/prop GenerationStatus 中的 generating 一并驱动 isGeneratingStep3Visual。
     */
    step3FormImageTaskFollowCount: 0,

    // 持久化数据是否已恢复（用于避免刷新时的步骤闪烁）
    isHydrated: false,

    /** 与后端已同步的剧本 Markdown 原文（静默保存 dirty 判断；加载/显式保存后更新，不写入 persist paths） */
    scriptServerHtmlBaseline: '',

    /** 提取完成、尚未执行形态生成的资产（小卡片列表，不写入 persist） */
    pendingExtractFormAssets: [] as PendingExtractFormAssetItem[],

    /**
     * 顶部「进行中」里用户已点「停止」的任务 id（不持久化）。
     * 用于在服务端仍返回 PROCESSING 时展示「继续跟进」而非再次自动连 SSE。
     */
    taskIdsWithLocalFollowPaused: [] as number[]
  }),

  getters: {
    currentStep: (state): CreationStep => {
      const steps: CreationStep[] = [
        'global-setting',
        'story-script',
        'scene-character',
        'storyboard-script',
        'storyboard-video',
        'dubbing',
        'preview'
      ]
      return steps[state.currentStepIndex] || 'global-setting'
    }
  },

  actions: {
    // 更新作品标题
    setWorkTitle(title: string) {
      this.workTitle = title
    },
    
    // 设置当前步骤
    setCurrentStepIndex(index: number) {
      this.currentStepIndex = index
    },

    // 设置当前创作上下文
    setCurrentProjectContext(payload: { projectId?: number | null; episodeId?: number | null }) {
      const prevProjectId = this.currentProjectId
      const prevEpisodeId = this.currentEpisodeId

      const normEp = (e: unknown): number | null => {
        if (e === null || e === undefined) return null
        const n = Number(e)
        return Number.isFinite(n) && n >= 0 ? n : null
      }

      let nextProjectId = this.currentProjectId
      if (payload.projectId !== undefined) {
        const pid = Number(payload.projectId)
        nextProjectId = Number.isFinite(pid) && pid > 0 ? pid : null
      }
      let nextEpisodeId = this.currentEpisodeId
      if (payload.episodeId !== undefined) {
        if (payload.episodeId === null) {
          nextEpisodeId = null
        } else {
          const eid = Number(payload.episodeId)
          nextEpisodeId = Number.isFinite(eid) && eid >= 0 ? eid : null
        }
      }

      const projectChanged =
        payload.projectId !== undefined && Number(prevProjectId ?? 0) !== Number(nextProjectId ?? 0)
      const episodeChanged =
        payload.episodeId !== undefined && normEp(prevEpisodeId) !== normEp(nextEpisodeId)

      /** 须在改写 currentProjectId 之前落盘：此时内存里的分镜/视频/配音 loading 仍属上一作品 */
      if (projectChanged || episodeChanged) {
        const prevScopeKey = liveGenScopeKeyFromIds(prevProjectId, prevEpisodeId)
        this.syncStep3GenVisualToCurrentScope()
        this.persistOptionalModelCodesForScopeKey(prevScopeKey)
        this.persistStoryboardVideoSettingsForScopeKey(prevScopeKey)
        this.persistStep4PlusLiveGenForScopeKey(prevScopeKey)
      }

      if (payload.projectId !== undefined) {
        if (nextProjectId !== this.currentProjectId) {
          this.seriesFlowEnteredStoryScript = false
          this.seriesEpisodeListTotal = null
          this.hydratePausedTaskFollowFromSession(nextProjectId)
        }
        this.currentProjectId = nextProjectId
      }
      if (payload.episodeId !== undefined) {
        this.currentEpisodeId = nextEpisodeId
      }

      if (projectChanged || episodeChanged) {
        this.resetLiveStep3TransientUiForContextSwitch()
        this.resetStepFormDataForContextSwitch()
        const nextScopeKey = liveGenScopeKeyFromIds(this.currentProjectId, this.currentEpisodeId)
        this.restoreStep4PlusLiveGenForScopeKey(nextScopeKey)
        this.applyOptionalModelCodesFromScopeKey(nextScopeKey)
        this.applyStoryboardVideoSettingsFromScopeKey(nextScopeKey)
        this.applyStep3GenVisualFromScopeKey(nextScopeKey)
      }
    },

    /**
     * 切换作品/剧集时清空各步骤表单与资产列表（formData 未按作品分桶，须主动清空避免串流）。
     */
    resetStepFormDataForContextSwitch() {
      this.formData.storyScript = { content: '' }
      this.formData.sceneCharacter = { characters: [], scenes: [], props: [] }
      this.formData.storyboardScript = { panels: [] }
      this.formData.storyboardVideo = { panels: [] }
      this.formData.dubbing = { voiceActors: [], bgm: '', panels: [] }
      this.sceneImages = {}
      this.characterImages = {}
      this.propImages = {}
      this.characterFormImages = {}
      this.propFormImages = {}
      this.manualScenes = []
      this.manualSceneAssetIds = []
      this.manualCharacters = []
      this.manualProps = []
      this.characterForms = {}
      this.propForms = {}
      this.scriptServerHtmlBaseline = ''
    },

    /**
     * 切换作品/剧集时清空第三步「进行中」全局 UI（提取遮罩、形态待生成列表、跟任务 SSE 等由页面侧关闭）。
     * 避免作品 A 提取中切到作品 B 仍显示 A 的提取状态。
     */
    resetLiveStep3TransientUiForContextSwitch() {
      this.isExtractingAssets = false
      this.extractingStage = 'scene'
      this.extractingStages = {
        scene: false,
        character: false,
        prop: false
      }
      this.clearExtractingTaskProgress()
      this.isGeneratingStep3Visual = false
      this.step3FormImageTaskFollowCount = 0
      this.pendingExtractFormAssets = []
      this.showExtractAgentModal = false
      this.step3AssetListSyncReady = false
    },

    setStep3AssetListSyncReady(ready: boolean) {
      this.step3AssetListSyncReady = ready
    },

    setCurrentProjectType(type: UserProjectType | null) {
      this.currentProjectType = type
    },

    setSeriesFlowEnteredStoryScript(v: boolean) {
      this.seriesFlowEnteredStoryScript = v
    },

    setSeriesEpisodeListTotal(n: number | null) {
      this.seriesEpisodeListTotal = n
    },

    setScriptServerHtmlBaseline(html: string) {
      this.scriptServerHtmlBaseline = html
    },
    
    // 更新表单数据
    updateFormData(data: Partial<WorkData>) {
      this.formData = { ...this.formData, ...plainDeep(data) }
    },
    
    // 更新场景角色道具数据
    updateSceneCharacterData(data: Partial<WorkData['sceneCharacter']>) {
      this.formData.sceneCharacter = { ...this.formData.sceneCharacter, ...data }
    },
    
    // 更新提取状态
    setExtractingAssets(isExtracting: boolean) {
      this.isExtractingAssets = isExtracting
    },
    
    setExtractingStage(stage: 'scene' | 'character' | 'prop') {
      this.extractingStage = stage
    },
    
    setExtractingStages(stages: { scene: boolean; character: boolean; prop: boolean }) {
      this.extractingStages = stages
    },

    setExtractingTaskProgress(payload: Partial<{
      percent: number
      stepTitle: string
      message: string
      stepIndex: number | null
      stepTotal: number | null
    }>) {
      this.extractingTaskProgress = {
        ...this.extractingTaskProgress,
        ...payload
      }
    },

    clearExtractingTaskProgress() {
      this.extractingTaskProgress = {
        percent: 0,
        stepTitle: '',
        message: '',
        stepIndex: null,
        stepTotal: null
      }
    },
    
    // 更新智能体
    updateExtractAgents(agents: ExtractAgents) {
      this.extractAgents = agents
    },

    updateExtractModelCodes(codes: { scene?: string; character?: string; prop?: string }) {
      this.extractModelCodes = {
        scene: String(codes.scene ?? this.extractModelCodes.scene ?? '').trim(),
        character: String(codes.character ?? this.extractModelCodes.character ?? '').trim(),
        prop: String(codes.prop ?? this.extractModelCodes.prop ?? '').trim()
      }
      this.syncOptionalModelCodesToCurrentScope()
    },

    updateExtractImageModelCodes(codes: { scene?: string; character?: string; prop?: string }) {
      this.extractImageModelCodes = {
        scene: String(codes.scene ?? this.extractImageModelCodes.scene ?? '').trim(),
        character: String(codes.character ?? this.extractImageModelCodes.character ?? '').trim(),
        prop: String(codes.prop ?? this.extractImageModelCodes.prop ?? '').trim()
      }
      this.syncOptionalModelCodesToCurrentScope()
    },

    persistOptionalModelCodesForScopeKey(scopeKey: string) {
      if (!scopeKey || scopeKey.startsWith('0:')) return
      this.optionalModelCodesByScope[scopeKey] = snapshotOptionalModelCodesFromStore(this)
    },

    applyOptionalModelCodesFromScopeKey(scopeKey: string) {
      const snap = this.optionalModelCodesByScope[scopeKey] ?? emptyOptionalModelCodesScopeSnapshot()
      applyOptionalModelCodesToStore(this, snap)
    },

    persistStoryboardVideoSettingsForScopeKey(scopeKey: string) {
      if (!scopeKey || scopeKey.startsWith('0:')) return
      this.storyboardVideoSettingsByScope[scopeKey] = snapshotStoryboardVideoSettingsFromStore(this)
    },

    applyStoryboardVideoSettingsFromScopeKey(scopeKey: string) {
      const snap =
        this.storyboardVideoSettingsByScope[scopeKey] ?? emptyStoryboardVideoSettingsScopeSnapshot()
      applyStoryboardVideoSettingsToStore(this, snap)
    },

    syncStoryboardVideoSettingsToCurrentScope() {
      const pid =
        this.currentProjectId != null && Number.isFinite(Number(this.currentProjectId))
          ? Number(this.currentProjectId)
          : 0
      if (!(pid > 0)) return
      this.persistStoryboardVideoSettingsForScopeKey(this.step3GenVisualScopeKey())
    },

    syncOptionalModelCodesToCurrentScope() {
      const pid =
        this.currentProjectId != null && Number.isFinite(Number(this.currentProjectId))
          ? Number(this.currentProjectId)
          : 0
      if (!(pid > 0)) return
      this.persistOptionalModelCodesForScopeKey(this.step3GenVisualScopeKey())
    },
    
    // 场景图片相关
    setSceneImages(sceneIndex: number, images: SceneImage[]) {
      this.sceneImages[sceneIndex] = images
    },
    
    addSceneImage(sceneIndex: number, image: SceneImage) {
      if (!this.sceneImages[sceneIndex]) {
        this.sceneImages[sceneIndex] = []
      }
      this.sceneImages[sceneIndex].push(image)
    },
    
    // 角色图片相关
    setCharacterImages(characterIndex: number, images: CharacterImage[]) {
      this.characterImages[characterIndex] = images
    },
    
    addCharacterImage(characterIndex: number, image: CharacterImage) {
      if (!this.characterImages[characterIndex]) {
        this.characterImages[characterIndex] = []
      }
      this.characterImages[characterIndex].push(image)
    },
    
    // 道具图片相关
    setPropImages(propIndex: number, images: CharacterImage[]) {
      this.propImages[propIndex] = images
    },
    
    addPropImage(propIndex: number, image: CharacterImage) {
      if (!this.propImages[propIndex]) {
        this.propImages[propIndex] = []
      }
      this.propImages[propIndex].push(image)
    },
    
    // 角色形态图片相关
    setCharacterFormImages(key: string, images: CharacterImage[]) {
      this.characterFormImages[key] = images
    },
    
    // 道具形态图片相关
    setPropFormImages(key: string, images: CharacterImage[]) {
      this.propFormImages[key] = images
    },
    
    // 手动添加标记
    addManualScene(index: number) {
      if (!this.manualScenes.includes(index)) {
        this.manualScenes.push(index)
      }
    },
    
    removeManualScene(index: number) {
      this.manualScenes = this.manualScenes.filter(i => i !== index)
    },

    addManualSceneAssetId(assetId: number) {
      const id = Number(assetId)
      if (!Number.isFinite(id) || id <= 0) return
      if (!this.manualSceneAssetIds.includes(id)) {
        this.manualSceneAssetIds.push(id)
      }
    },

    removeManualSceneAssetId(assetId: number) {
      const id = Number(assetId)
      if (!Number.isFinite(id)) return
      this.manualSceneAssetIds = this.manualSceneAssetIds.filter((x) => x !== id)
    },
    
    addManualCharacter(index: number) {
      if (!this.manualCharacters.includes(index)) {
        this.manualCharacters.push(index)
      }
    },
    
    removeManualCharacter(index: number) {
      this.manualCharacters = this.manualCharacters.filter(i => i !== index)
    },
    
    addManualProp(index: number) {
      if (!this.manualProps.includes(index)) {
        this.manualProps.push(index)
      }
    },
    
    removeManualProp(index: number) {
      this.manualProps = this.manualProps.filter(i => i !== index)
    },
    
    // 角色形态
    setCharacterForms(characterIndex: number, forms: Array<{ name: string; voiceover?: string }>) {
      this.characterForms[characterIndex] = forms
    },
    
    // 道具形态
    setPropForms(propIndex: number, forms: Array<{ name: string }>) {
      this.propForms[propIndex] = forms
    },
    
    /** `${projectId}:${episodeId|null}`；切换路由前应用 lastStep3VisualScopeKey 写入上一作品快照 */
    step3GenVisualScopeKey(): string {
      return liveGenScopeKeyFromIds(this.currentProjectId, this.currentEpisodeId)
    },

    persistStep4PlusLiveGenForScopeKey(key: string) {
      if (!key) return
      const prev = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      this.step4PlusLiveGenByScope[key] = {
        isGeneratingStoryboard: this.isGeneratingStoryboard,
        storyboardGenerationProgress: { ...this.storyboardGenerationProgress },
        storyboardGenerationError: this.storyboardGenerationError,
        isGeneratingStoryboardImageBatch: this.isGeneratingStoryboardImageBatch,
        storyboardImageBatchProgress: { ...this.storyboardImageBatchProgress },
        storyboardImageBatchError: this.storyboardImageBatchError,
        storyboardImageBatchActiveTaskId: this.storyboardImageBatchActiveTaskId,
        storyboardImageBatchActiveImageTaskId: this.storyboardImageBatchActiveImageTaskId,
        storyboardPanelImageGenStatusByStoryboardId: {
          ...this.storyboardPanelImageGenStatusByStoryboardId
        },
        isGeneratingStoryboardVideo: this.isGeneratingStoryboardVideo,
        storyboardVideoBatchProgress: { ...this.storyboardVideoBatchProgress },
        storyboardVideoBatchError: this.storyboardVideoBatchError,
        storyboardVideoBatchActivePromptTaskId: this.storyboardVideoBatchActivePromptTaskId,
        storyboardVideoBatchActiveVideoTaskId: this.storyboardVideoBatchActiveVideoTaskId,
        storyboardPanelVideoGenStatusByStoryboardId: {
          ...this.storyboardPanelVideoGenStatusByStoryboardId
        },
        dubbingBatchGeneratingIndices: [...this.dubbingBatchGeneratingIndices],
        storyboardScriptActiveTaskId: this.storyboardScriptActiveTaskId,
        storyboardScriptPartialFailedData: this.storyboardScriptPartialFailedData,
        storyboardImageGenTasksByStoryboardId: {
          ...(prev.storyboardImageGenTasksByStoryboardId || {})
        },
        storyboardVideoGenTasksByStoryboardId: {
          ...(prev.storyboardVideoGenTasksByStoryboardId || {})
        }
      }
    },

    restoreStep4PlusLiveGenForScopeKey(key: string) {
      const s = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      this.isGeneratingStoryboard = s.isGeneratingStoryboard
      this.storyboardGenerationProgress = { ...s.storyboardGenerationProgress }
      this.storyboardGenerationError = s.storyboardGenerationError
      this.isGeneratingStoryboardImageBatch = s.isGeneratingStoryboardImageBatch
      this.storyboardImageBatchProgress = { ...s.storyboardImageBatchProgress }
      this.storyboardImageBatchError = s.storyboardImageBatchError
      const imageBatchTid = Number(s.storyboardImageBatchActiveTaskId)
      this.storyboardImageBatchActiveTaskId =
        Number.isFinite(imageBatchTid) && imageBatchTid > 0 ? imageBatchTid : null
      const imageGenBatchTid = Number(s.storyboardImageBatchActiveImageTaskId)
      this.storyboardImageBatchActiveImageTaskId =
        Number.isFinite(imageGenBatchTid) && imageGenBatchTid > 0 ? imageGenBatchTid : null
      this.storyboardPanelImageGenStatusByStoryboardId = {
        ...(s.storyboardPanelImageGenStatusByStoryboardId || {})
      }
      this.isGeneratingStoryboardVideo = s.isGeneratingStoryboardVideo
      this.storyboardVideoBatchProgress = { ...s.storyboardVideoBatchProgress }
      this.storyboardVideoBatchError = s.storyboardVideoBatchError
      const videoPromptBatchTid = Number(s.storyboardVideoBatchActivePromptTaskId)
      this.storyboardVideoBatchActivePromptTaskId =
        Number.isFinite(videoPromptBatchTid) && videoPromptBatchTid > 0 ? videoPromptBatchTid : null
      const videoBatchTid = Number(s.storyboardVideoBatchActiveVideoTaskId)
      this.storyboardVideoBatchActiveVideoTaskId =
        Number.isFinite(videoBatchTid) && videoBatchTid > 0 ? videoBatchTid : null
      this.storyboardPanelVideoGenStatusByStoryboardId = {
        ...(s.storyboardPanelVideoGenStatusByStoryboardId || {})
      }
      this.dubbingBatchGeneratingIndices = [...s.dubbingBatchGeneratingIndices]
      const tid = Number(s.storyboardScriptActiveTaskId)
      this.storyboardScriptActiveTaskId = Number.isFinite(tid) && tid > 0 ? tid : null
      this.storyboardScriptPartialFailedData = s.storyboardScriptPartialFailedData ?? null
    },

    /** 异步任务已脱离当前作品上下文时，只更新对应 scope 桶，避免污染当前扁平状态 */
    mergeStep4PlusLiveGenForScopeKey(scopeKey: string, partial: Partial<Step4PlusLiveGenSnapshot>) {
      const base = this.step4PlusLiveGenByScope[scopeKey] ?? emptyStep4PlusLiveGenSnapshot()
      this.step4PlusLiveGenByScope[scopeKey] = {
        ...base,
        ...partial,
        storyboardGenerationProgress:
          partial.storyboardGenerationProgress != null
            ? { ...base.storyboardGenerationProgress, ...partial.storyboardGenerationProgress }
            : base.storyboardGenerationProgress,
        storyboardImageBatchProgress:
          partial.storyboardImageBatchProgress != null
            ? { ...base.storyboardImageBatchProgress, ...partial.storyboardImageBatchProgress }
            : base.storyboardImageBatchProgress,
        storyboardVideoBatchProgress:
          partial.storyboardVideoBatchProgress != null
            ? { ...base.storyboardVideoBatchProgress, ...partial.storyboardVideoBatchProgress }
            : base.storyboardVideoBatchProgress,
        storyboardPanelImageGenStatusByStoryboardId:
          partial.storyboardPanelImageGenStatusByStoryboardId != null
            ? { ...partial.storyboardPanelImageGenStatusByStoryboardId }
            : { ...(base.storyboardPanelImageGenStatusByStoryboardId || {}) },
        storyboardPanelVideoGenStatusByStoryboardId:
          partial.storyboardPanelVideoGenStatusByStoryboardId != null
            ? { ...partial.storyboardPanelVideoGenStatusByStoryboardId }
            : { ...(base.storyboardPanelVideoGenStatusByStoryboardId || {}) },
        dubbingBatchGeneratingIndices:
          partial.dubbingBatchGeneratingIndices != null
            ? [...partial.dubbingBatchGeneratingIndices]
            : base.dubbingBatchGeneratingIndices,
        storyboardImageGenTasksByStoryboardId:
          partial.storyboardImageGenTasksByStoryboardId != null
            ? { ...partial.storyboardImageGenTasksByStoryboardId }
            : { ...(base.storyboardImageGenTasksByStoryboardId || {}) },
        storyboardVideoGenTasksByStoryboardId:
          partial.storyboardVideoGenTasksByStoryboardId != null
            ? { ...partial.storyboardVideoGenTasksByStoryboardId }
            : { ...(base.storyboardVideoGenTasksByStoryboardId || {}) }
      }
    },

    syncStep4PlusLiveGenToCurrentScope() {
      this.persistStep4PlusLiveGenForScopeKey(this.step3GenVisualScopeKey())
    },

    setDubbingBatchGeneratingIndices(indices: number[]) {
      this.dubbingBatchGeneratingIndices = [...indices]
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    /** 异步批量中已切换作品时，仅从原 scope 桶移除某下标，避免脏数据一直占着「生成中」 */
    removeDubbingBatchIndexFromScope(scopeKey: string, index: number) {
      const base = this.step4PlusLiveGenByScope[scopeKey] ?? emptyStep4PlusLiveGenSnapshot()
      const next = (base.dubbingBatchGeneratingIndices || []).filter((x) => x !== index)
      this.mergeStep4PlusLiveGenForScopeKey(scopeKey, { dubbingBatchGeneratingIndices: next })
    },

    /** 将当前内存中的第三步生成 UI 同步进当前作品 scope（供持久化与切换恢复） */
    syncStep3GenVisualToCurrentScope() {
      const pid =
        this.currentProjectId != null && Number.isFinite(Number(this.currentProjectId))
          ? Number(this.currentProjectId)
          : 0
      if (!(pid > 0)) return
      const key = this.step3GenVisualScopeKey()
      const prev = this.step3GenVisualByScope[key]
      this.step3GenVisualByScope[key] = {
        scene: { ...this.sceneGenerationStatus },
        character: { ...this.characterFormGenerationStatus },
        prop: { ...this.propFormGenerationStatus },
        modalSseTasks: { ...(prev?.modalSseTasks || {}) }
      }
    },

    applyStep3GenVisualFromScopeKey(scopeKey: string) {
      const blob = this.step3GenVisualByScope[scopeKey]
      this.sceneGenerationStatus = blob?.scene ? { ...blob.scene } : {}
      this.characterFormGenerationStatus = blob?.character ? { ...blob.character } : {}
      this.propFormGenerationStatus = blob?.prop ? { ...blob.prop } : {}
    },

    writeStep3GenVisualScopeKey(scopeKey: string, maps: Step3GenVisualScopeMaps) {
      if (!scopeKey) return
      const prev = this.step3GenVisualByScope[scopeKey]
      this.step3GenVisualByScope[scopeKey] = {
        scene: { ...(maps.scene || {}) },
        character: { ...(maps.character || {}) },
        prop: { ...(maps.prop || {}) },
        modalSseTasks: {
          ...(maps.modalSseTasks || prev?.modalSseTasks || {})
        }
      }
    },

    refreshStep3VisualGeneratingFlag() {
      const fromMaps =
        Object.values(this.sceneGenerationStatus).some((s) => s === 'generating') ||
        Object.values(this.characterFormGenerationStatus).some((s) => s === 'generating') ||
        Object.values(this.propFormGenerationStatus).some((s) => s === 'generating')
      this.isGeneratingStep3Visual = fromMaps || this.step3FormImageTaskFollowCount > 0
    },

    beginStep3FormImageTaskFollow() {
      this.step3FormImageTaskFollowCount++
      this.refreshStep3VisualGeneratingFlag()
    },

    endStep3FormImageTaskFollow() {
      if (this.step3FormImageTaskFollowCount > 0) this.step3FormImageTaskFollowCount--
      this.refreshStep3VisualGeneratingFlag()
    },

    /** 形态图任务结束且不在第三步页面时，将仍标为 generating 的卡片回落为 success/idle */
    resolveAllStep3GeneratingStatuses(target: SceneGenerationStatus) {
      let changed = false
      for (const [k, st] of Object.entries(this.sceneGenerationStatus)) {
        if (st !== 'generating') continue
        const idx = Number(k)
        if (!Number.isFinite(idx)) continue
        this.sceneGenerationStatus[idx] = target
        changed = true
      }
      for (const [key, st] of Object.entries(this.characterFormGenerationStatus)) {
        if (st !== 'generating') continue
        this.characterFormGenerationStatus[key] = target
        changed = true
      }
      for (const [key, st] of Object.entries(this.propFormGenerationStatus)) {
        if (st !== 'generating') continue
        this.propFormGenerationStatus[key] = target
        changed = true
      }
      if (changed) this.syncStep3GenVisualToCurrentScope()
      this.refreshStep3VisualGeneratingFlag()
    },

    // 场景生成状态
    setSceneGenerationStatus(sceneIndex: number, status: SceneGenerationStatus) {
      this.sceneGenerationStatus[sceneIndex] = status
      this.syncStep3GenVisualToCurrentScope()
      this.refreshStep3VisualGeneratingFlag()
    },

    // 角色形态生成状态
    setCharacterFormGenerationStatus(formKey: string, status: SceneGenerationStatus) {
      this.characterFormGenerationStatus[formKey] = status
      this.syncStep3GenVisualToCurrentScope()
      this.refreshStep3VisualGeneratingFlag()
    },

    // 道具形态生成状态
    setPropFormGenerationStatus(formKey: string, status: SceneGenerationStatus) {
      this.propFormGenerationStatus[formKey] = status
      this.syncStep3GenVisualToCurrentScope()
      this.refreshStep3VisualGeneratingFlag()
    },

    // 分镜脚本生成设置
    setStoryboardGenerateSettings(settings: {
      agentId?: string
      shotDensity?: string
      modelCode?: string
    }) {
      if (settings.agentId !== undefined) this.storyboardGenerateSettings.agentId = settings.agentId
      if (settings.shotDensity !== undefined) this.storyboardGenerateSettings.shotDensity = settings.shotDensity
      if (settings.modelCode !== undefined) {
        this.storyboardGenerateSettings.modelCode = String(settings.modelCode || '').trim()
      }
      this.syncOptionalModelCodesToCurrentScope()
    },

    /** 分镜脚本：选择智能体后同步名称/描述/缩略图与 agentId */
    updateStoryboardAgent(agent: { id: string; name: string; desc: string; thumbnail?: string }) {
      this.storyboardAgent = {
        id: agent.id,
        name: agent.name,
        desc: agent.desc,
        thumbnail: agent.thumbnail || ''
      }
      this.storyboardGenerateSettings.agentId = agent.id
      this.syncOptionalModelCodesToCurrentScope()
    },

    setStoryboardStylistGenerateSettings(settings: { agentId?: string; modelCode?: string }) {
      if (settings.agentId !== undefined) {
        this.storyboardStylistGenerateSettings.agentId = String(settings.agentId || '').trim()
      }
      if (settings.modelCode !== undefined) {
        this.storyboardStylistGenerateSettings.modelCode = String(settings.modelCode || '').trim()
      }
      this.syncOptionalModelCodesToCurrentScope()
    },

    updateStoryboardStylistAgent(agent: { id: string; name: string; desc: string; thumbnail?: string }) {
      this.storyboardStylistAgent = {
        id: agent.id,
        name: agent.name,
        desc: agent.desc,
        thumbnail: agent.thumbnail || ''
      }
      this.storyboardStylistGenerateSettings.agentId = agent.id
    },

    // 分镜视频生成设置
    setStoryboardVideoGenerateSettings(settings: {
      agentId?: string
      videoModel?: string
      videoPromptModelCode?: string
      aspectRatio?: '16:9' | '9:16' | '4:3' | '1:1'
      resolution?: '720p' | '1080p'
      soundEffects?: 'none' | 'with-sound'
    }) {
      if (settings.agentId !== undefined) this.storyboardVideoGenerateSettings.agentId = settings.agentId
      if (settings.videoModel !== undefined) this.storyboardVideoGenerateSettings.videoModel = settings.videoModel
      if (settings.videoPromptModelCode !== undefined) {
        this.storyboardVideoGenerateSettings.videoPromptModelCode = settings.videoPromptModelCode
      }
      if (settings.aspectRatio !== undefined) this.storyboardVideoGenerateSettings.aspectRatio = settings.aspectRatio
      if (settings.resolution !== undefined) this.storyboardVideoGenerateSettings.resolution = settings.resolution
      if (settings.soundEffects !== undefined) this.storyboardVideoGenerateSettings.soundEffects = settings.soundEffects
      this.syncStoryboardVideoSettingsToCurrentScope()
    },

    /** 分镜视频：选择智能体后同步展示信息与 agentId */
    updateStoryboardVideoAgent(agent: { id: string; name: string; desc: string; thumbnail?: string }) {
      this.storyboardVideoAgent = {
        id: agent.id,
        name: agent.name,
        desc: agent.desc,
        thumbnail: agent.thumbnail || ''
      }
      this.storyboardVideoGenerateSettings.agentId = agent.id
      this.syncStoryboardVideoSettingsToCurrentScope()
    },

    setStoryboardGenerating(flag: boolean) {
      this.isGeneratingStoryboard = flag
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardScriptGenerationOutcome() {
      this.storyboardGenerationError = null
      this.storyboardScriptActiveTaskId = null
      this.storyboardScriptPartialFailedData = null
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardPartialFailedOutcome(
      message: string,
      taskId: number,
      data: TaskPartialFailedData | null
    ) {
      this.storyboardGenerationError = message
      this.storyboardScriptActiveTaskId = taskId
      this.storyboardScriptPartialFailedData = data
      this.isGeneratingStoryboard = false
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardScriptActiveTaskId(taskId: number | null) {
      const n = Number(taskId)
      this.storyboardScriptActiveTaskId = Number.isFinite(n) && n > 0 ? n : null
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardScriptPartialFailedData(data: TaskPartialFailedData | null) {
      this.storyboardScriptPartialFailedData = data
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardProgress(completed: number, total: number) {
      this.storyboardGenerationProgress = { completed, total }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardError(msg: string | null) {
      this.storyboardGenerationError = msg
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    stopStoryboardGeneration() {
      this.isGeneratingStoryboard = false
      this.clearStoryboardScriptGenerationOutcome()
    },

    setStoryboardImageBatchGenerating(flag: boolean) {
      this.isGeneratingStoryboardImageBatch = flag
      if (!flag) {
        this.storyboardImageBatchError = null
        this.storyboardImageBatchActiveTaskId = null
        this.storyboardImageBatchActiveImageTaskId = null
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardImageBatchActiveTaskId(taskId: number | null) {
      const n = Number(taskId)
      this.storyboardImageBatchActiveTaskId = Number.isFinite(n) && n > 0 ? n : null
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardImageBatchActiveImageTaskId(taskId: number | null) {
      const n = Number(taskId)
      this.storyboardImageBatchActiveImageTaskId = Number.isFinite(n) && n > 0 ? n : null
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardImageBatchProgress(completed: number, total: number) {
      this.storyboardImageBatchProgress = { completed, total }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardImageBatchError(msg: string | null) {
      this.storyboardImageBatchError = msg
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardPanelImageGenStatus(storyboardId: number, status: SceneGenerationStatus) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      this.storyboardPanelImageGenStatusByStoryboardId = {
        ...this.storyboardPanelImageGenStatusByStoryboardId,
        [String(sid)]: status
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardPanelImageGenStatus(storyboardId: number) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const next = { ...this.storyboardPanelImageGenStatusByStoryboardId }
      delete next[String(sid)]
      this.storyboardPanelImageGenStatusByStoryboardId = next
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    stopStoryboardImageBatchGeneration() {
      this.isGeneratingStoryboardImageBatch = false
      this.storyboardImageBatchError = null
      this.storyboardImageBatchActiveTaskId = null
      this.storyboardImageBatchActiveImageTaskId = null
      this.storyboardPanelImageGenStatusByStoryboardId = {}
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardImageGenTask(
      storyboardId: number,
      payload: { taskId: number; sceneIdx: number },
      scopeKey?: string
    ) {
      const sid = Number(storyboardId)
      const tid = Number(payload.taskId)
      const sceneIdx = Number(payload.sceneIdx)
      if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(tid) || tid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardImageGenTasksByStoryboardId: {
          ...(base.storyboardImageGenTasksByStoryboardId || {}),
          [String(sid)]: { taskId: tid, sceneIdx: Number.isFinite(sceneIdx) ? sceneIdx : 0 }
        }
      })
    },

    clearStoryboardImageGenTask(storyboardId: number, scopeKey?: string) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const next = { ...(base.storyboardImageGenTasksByStoryboardId || {}) }
      delete next[String(sid)]
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardImageGenTasksByStoryboardId: next
      })
    },

    getStoryboardImageGenTask(
      storyboardId: number,
      scopeKey?: string
    ): StoryboardImageGenTaskSnapshot | null {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return null
      const key = scopeKey || this.step3GenVisualScopeKey()
      const blob = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const hit = blob.storyboardImageGenTasksByStoryboardId?.[String(sid)]
      if (!hit) return null
      const tid = Number(hit.taskId)
      if (!Number.isFinite(tid) || tid <= 0) return null
      return { taskId: tid, sceneIdx: Number(hit.sceneIdx) || 0 }
    },

    setStoryboardVideoGenTask(
      storyboardId: number,
      payload: { taskId: number; sceneIdx: number; taskKind: 'i2v' | 'multi' },
      scopeKey?: string
    ) {
      const sid = Number(storyboardId)
      const tid = Number(payload.taskId)
      const sceneIdx = Number(payload.sceneIdx)
      if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(tid) || tid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardVideoGenTasksByStoryboardId: {
          ...(base.storyboardVideoGenTasksByStoryboardId || {}),
          [String(sid)]: {
            taskId: tid,
            sceneIdx: Number.isFinite(sceneIdx) ? sceneIdx : 0,
            taskKind: payload.taskKind
          }
        }
      })
    },

    clearStoryboardVideoGenTask(storyboardId: number, scopeKey?: string) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const next = { ...(base.storyboardVideoGenTasksByStoryboardId || {}) }
      delete next[String(sid)]
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardVideoGenTasksByStoryboardId: next
      })
    },

    getStoryboardVideoGenTask(
      storyboardId: number,
      scopeKey?: string
    ): StoryboardVideoGenTaskSnapshot | null {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return null
      const key = scopeKey || this.step3GenVisualScopeKey()
      const blob = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const hit = blob.storyboardVideoGenTasksByStoryboardId?.[String(sid)]
      if (!hit) return null
      const tid = Number(hit.taskId)
      if (!Number.isFinite(tid) || tid <= 0) return null
      return {
        taskId: tid,
        sceneIdx: Number(hit.sceneIdx) || 0,
        taskKind: hit.taskKind === 'multi' ? 'multi' : 'i2v'
      }
    },

    setSceneModalSseTask(
      editorScopeKey: string,
      snapshot: SceneModalSseTaskSnapshot,
      scopeKey?: string
    ) {
      const scope = String(editorScopeKey || '').trim()
      const tid = Number(snapshot.taskId)
      if (!scope || !Number.isFinite(tid) || tid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const prev = this.step3GenVisualByScope[key] || {
        scene: {},
        character: {},
        prop: {},
        modalSseTasks: {}
      }
      this.step3GenVisualByScope[key] = {
        scene: { ...(prev.scene || {}) },
        character: { ...(prev.character || {}) },
        prop: { ...(prev.prop || {}) },
        modalSseTasks: {
          ...(prev.modalSseTasks || {}),
          [scope]: { ...snapshot, editorScopeKey: scope }
        }
      }
    },

    clearSceneModalSseTask(editorScopeKey: string, scopeKey?: string) {
      const scope = String(editorScopeKey || '').trim()
      if (!scope) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const prev = this.step3GenVisualByScope[key]
      if (!prev?.modalSseTasks?.[scope]) return
      const next = { ...(prev.modalSseTasks || {}) }
      delete next[scope]
      this.step3GenVisualByScope[key] = {
        scene: { ...(prev.scene || {}) },
        character: { ...(prev.character || {}) },
        prop: { ...(prev.prop || {}) },
        modalSseTasks: next
      }
    },

    getSceneModalSseTask(
      editorScopeKey: string,
      scopeKey?: string
    ): SceneModalSseTaskSnapshot | null {
      const scope = String(editorScopeKey || '').trim()
      if (!scope) return null
      const key = scopeKey || this.step3GenVisualScopeKey()
      const hit = this.step3GenVisualByScope[key]?.modalSseTasks?.[scope]
      if (!hit) return null
      const tid = Number(hit.taskId)
      if (!Number.isFinite(tid) || tid <= 0) return null
      return hit
    },

    /** 当前 scope 未命中时，跨作品 scope 桶查找（避免刷新后 scope 键短暂不一致） */
    findSceneModalSseTaskAcrossScopes(editorScopeKey: string): SceneModalSseTaskSnapshot | null {
      const scope = String(editorScopeKey || '').trim()
      if (!scope) return null
      const direct = this.getSceneModalSseTask(scope)
      if (direct) return direct
      for (const blob of Object.values(this.step3GenVisualByScope || {}) as Step3GenVisualScopeMaps[]) {
        const hit = blob?.modalSseTasks?.[scope]
        const tid = Number(hit?.taskId)
        if (hit && Number.isFinite(tid) && tid > 0) return hit
      }
      return null
    },

    setGeneratingStoryboardVideo(flag: boolean) {
      this.isGeneratingStoryboardVideo = flag
      if (!flag) {
        this.storyboardVideoBatchError = null
        this.storyboardVideoBatchActivePromptTaskId = null
        this.storyboardVideoBatchActiveVideoTaskId = null
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardVideoBatchProgress(completed: number, total: number) {
      this.storyboardVideoBatchProgress = { completed, total }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardVideoBatchError(msg: string | null) {
      this.storyboardVideoBatchError = msg
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardVideoBatchActivePromptTaskId(taskId: number | null) {
      const n = Number(taskId)
      this.storyboardVideoBatchActivePromptTaskId = Number.isFinite(n) && n > 0 ? n : null
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardVideoBatchActiveVideoTaskId(taskId: number | null) {
      const n = Number(taskId)
      this.storyboardVideoBatchActiveVideoTaskId = Number.isFinite(n) && n > 0 ? n : null
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardPanelVideoGenStatus(storyboardId: number, status: SceneGenerationStatus) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      this.storyboardPanelVideoGenStatusByStoryboardId = {
        ...this.storyboardPanelVideoGenStatusByStoryboardId,
        [String(sid)]: status
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardPanelVideoGenStatus(storyboardId: number) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const next = { ...this.storyboardPanelVideoGenStatusByStoryboardId }
      delete next[String(sid)]
      this.storyboardPanelVideoGenStatusByStoryboardId = next
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    stopStoryboardVideoBatchGeneration() {
      this.isGeneratingStoryboardVideo = false
      this.storyboardVideoBatchError = null
      this.storyboardVideoBatchActivePromptTaskId = null
      this.storyboardVideoBatchActiveVideoTaskId = null
      this.storyboardPanelVideoGenStatusByStoryboardId = {}
      this.storyboardVideoBatchProgress = { completed: 0, total: 0 }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setGeneratingStep3Visual(flag: boolean) {
      if (flag) {
        this.beginStep3FormImageTaskFollow()
      } else {
        this.step3FormImageTaskFollowCount = 0
        this.refreshStep3VisualGeneratingFlag()
      }
    },

    setPendingExtractFormAssets(items: PendingExtractFormAssetItem[]) {
      this.pendingExtractFormAssets = Array.isArray(items) ? [...items] : []
    },

    mergePendingExtractFormAssets(items: PendingExtractFormAssetItem[]) {
      const key = (x: PendingExtractFormAssetItem) => `${x.assetType}:${x.assetId}`
      const map = new Map<string, PendingExtractFormAssetItem>()
      for (const x of this.pendingExtractFormAssets) map.set(key(x), x)
      for (const x of items ?? []) map.set(key(x), x)
      this.pendingExtractFormAssets = Array.from(map.values())
    },

    removePendingExtractFormAsset(assetId: number, assetType?: PendingExtractFormAssetItem['assetType']) {
      this.pendingExtractFormAssets = this.pendingExtractFormAssets.filter(
        (x) => !(x.assetId === assetId && (!assetType || x.assetType === assetType))
      )
    },

    patchPendingExtractFormAssetTitle(
      assetId: number,
      assetType: PendingExtractFormAssetItem['assetType'],
      title: string
    ) {
      const idx = this.pendingExtractFormAssets.findIndex(
        (x) => x.assetId === assetId && x.assetType === assetType
      )
      if (idx < 0) return
      const next = [...this.pendingExtractFormAssets]
      next[idx] = { ...next[idx], title }
      this.pendingExtractFormAssets = next
    },

    clearPendingExtractFormAssets() {
      this.pendingExtractFormAssets = []
    },

    hydratePausedTaskFollowFromSession(projectId: number | null) {
      if (typeof window === 'undefined' || projectId == null || !Number.isFinite(projectId) || projectId <= 0) {
        this.taskIdsWithLocalFollowPaused = []
        return
      }
      try {
        const raw = window.sessionStorage.getItem(pausedTasksFollowSessionKey(projectId))
        const parsed = raw ? JSON.parse(raw) : []
        this.taskIdsWithLocalFollowPaused = Array.isArray(parsed)
          ? parsed.map((x: unknown) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
          : []
      } catch {
        this.taskIdsWithLocalFollowPaused = []
      }
    },

    syncPausedTaskFollowSession() {
      if (typeof window === 'undefined') return
      const pid = this.currentProjectId
      if (pid == null || !Number.isFinite(pid) || pid <= 0) return
      try {
        window.sessionStorage.setItem(
          pausedTasksFollowSessionKey(pid),
          JSON.stringify(this.taskIdsWithLocalFollowPaused)
        )
      } catch {
        /* ignore quota / private mode */
      }
    },

    addPausedTaskFollow(taskId: number) {
      const id = Number(taskId)
      if (!Number.isFinite(id) || id <= 0) return
      if (!this.taskIdsWithLocalFollowPaused.includes(id)) {
        this.taskIdsWithLocalFollowPaused.push(id)
      }
      this.syncPausedTaskFollowSession()
    },

    removePausedTaskFollow(taskId: number) {
      const id = Number(taskId)
      this.taskIdsWithLocalFollowPaused = this.taskIdsWithLocalFollowPaused.filter((x) => x !== id)
      this.syncPausedTaskFollowSession()
    },

    /** 仅保留仍出现在当前任务列表中的 id（任务已从列表消失时清标记） */
    prunePausedTaskFollowKeepOnlyListed(listedTaskIds: Set<number>) {
      this.taskIdsWithLocalFollowPaused = this.taskIdsWithLocalFollowPaused.filter((id) =>
        listedTaskIds.has(id)
      )
      this.syncPausedTaskFollowSession()
    },

    // 重置所有数据
    reset() {
      this.workTitle = '未命名作品'
      this.currentStepIndex = 0
      this.currentProjectId = null
      this.currentEpisodeId = null
      this.currentProjectType = null
      this.formData = {
        globalSetting: {
          title: '',
          genre: '',
          style: '',
          description: '',
          aspectRatio: '16:9',
          scriptType: 'plot',
          modelStrategy: 'economy',
          creationMode: 'i2v',
          selectedStyle: null,
          myStyles: []
        },
        storyScript: {
          content: ''
        },
        sceneCharacter: {
          characters: [],
          scenes: [],
          props: []
        },
        storyboardScript: {
          panels: []
        },
        storyboardVideo: {
          panels: []
        },
        dubbing: {
          voiceActors: [],
          bgm: '',
          panels: []
        }
      }
      this.sceneImages = {}
      this.characterImages = {}
      this.propImages = {}
      this.characterFormImages = {}
      this.propFormImages = {}
      this.manualScenes = []
      this.manualSceneAssetIds = []
      this.manualCharacters = []
      this.manualProps = []
      this.characterForms = {}
      this.propForms = {}
      this.sceneGenerationStatus = {}
      this.characterFormGenerationStatus = {}
      this.propFormGenerationStatus = {}
      this.step3GenVisualByScope = {}
      this.step4PlusLiveGenByScope = {}
      this.extractModelCodes = emptyExtractModelCodes()
      this.extractImageModelCodes = emptyExtractModelCodes()
      this.optionalModelCodesByScope = {}
      this.storyboardVideoSettingsByScope = {}
      this.storyboardGenerateSettings.modelCode = ''
      this.storyboardStylistGenerateSettings.modelCode = ''
      this.dubbingBatchGeneratingIndices = []
      this.isExtractingAssets = false
      this.extractingStages = {
        scene: false,
        character: false,
        prop: false
      }
      this.clearExtractingTaskProgress()
      this.storyboardVideoGenerateSettings = {
        agentId: '',
        videoModel: '',
        videoPromptModelCode: '',
        aspectRatio: '16:9',
        resolution: '720p',
        soundEffects: 'none'
      }
      this.storyboardVideoAgent = {
        id: '',
        name: '',
        desc: '',
        thumbnail: ''
      }
      this.isGeneratingStoryboard = false
      this.storyboardGenerationProgress = { completed: 0, total: 0 }
      this.storyboardGenerationError = null
      this.storyboardScriptActiveTaskId = null
      this.storyboardScriptPartialFailedData = null
      this.isGeneratingStoryboardImageBatch = false
      this.storyboardImageBatchProgress = { completed: 0, total: 0 }
      this.storyboardImageBatchError = null
      this.storyboardImageBatchActiveTaskId = null
      this.storyboardImageBatchActiveImageTaskId = null
      this.storyboardPanelImageGenStatusByStoryboardId = {}
      this.isGeneratingStoryboardVideo = false
      this.storyboardVideoBatchProgress = { completed: 0, total: 0 }
      this.storyboardVideoBatchError = null
      this.storyboardVideoBatchActivePromptTaskId = null
      this.storyboardVideoBatchActiveVideoTaskId = null
      this.storyboardPanelVideoGenStatusByStoryboardId = {}
      this.isGeneratingStep3Visual = false
      this.step3FormImageTaskFollowCount = 0
      this.scriptServerHtmlBaseline = ''
      this.pendingExtractFormAssets = []
      this.taskIdsWithLocalFollowPaused = []
      this.step3AssetListSyncReady = false
    }
  },

  persist: {
    key: 'creation-store',
    // 只持久化需要的数据，排除临时状态
    paths: [
      'workTitle',
      'currentStepIndex',
      'currentProjectId',
      'currentEpisodeId',
      'currentProjectType',
      'formData',
      'extractAgents',
      'optionalModelCodesByScope',
      'storyboardVideoSettingsByScope',
      'sceneImages',
      'characterImages',
      'propImages',
      'characterFormImages',
      'propFormImages',
      'manualScenes',
      'manualSceneAssetIds',
      'manualCharacters',
      'manualProps',
      'characterForms',
      'propForms',
      'step3GenVisualByScope',
      'step4PlusLiveGenByScope',
      // 与 scoped 同步写入，兼容旧版仅扁平持久化的数据（afterRestore 会迁入 scoped）
      'sceneGenerationStatus',
      'characterFormGenerationStatus',
      'propFormGenerationStatus',
      'storyboardAgent',
      'storyboardGenerateSettings',
      'storyboardStylistAgent',
      'storyboardStylistGenerateSettings',
      'storyboardVideoAgent',
      'storyboardVideoGenerateSettings'
    ],
    // 持久化数据恢复完成后，标记已就绪，页面可从骨架屏切换到实际内容
    afterRestore: (ctx) => {
      const store = ctx.store as any
      const raw = store.formData?.storyScript?.content
      if (store.formData?.storyScript && typeof raw !== 'string') {
        store.formData.storyScript.content =
          raw == null ? '' : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : ''
      }
      // eslint-disable-next-line no-param-reassign
      store.isHydrated = true
      migrateStep3GenVisualMapsFromPersist(store)
      migrateOptionalModelCodesFromPersist(store)
      migrateStoryboardVideoSettingsFromPersist(store)
      migrateStep4PlusLiveGenAfterRestore(store)
      if (typeof store.refreshStep3VisualGeneratingFlag === 'function') {
        store.refreshStep3VisualGeneratingFlag()
      }
      if (typeof window !== 'undefined') {
        const pid = Number(store.currentProjectId)
        if (Number.isFinite(pid) && pid > 0) {
          store.hydratePausedTaskFollowFromSession(pid)
        }
      }
    }
  }
})
