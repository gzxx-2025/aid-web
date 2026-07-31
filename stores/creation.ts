import { defineStore } from 'pinia'
import type { WorkData, CreationStep } from '~/types'
import type { ExtractAgents } from '~/components/steps/ExtractAgentModal.vue'
import type { UserProjectType } from '~/types/business-api'
import { plainDeep } from '~/utils/plainDeep'
import type { TaskPartialFailedData } from '~/utils/taskPartialFailed'
import {
  EMPTY_COUNT_PROGRESS,
  mergeCountProgressFromSse,
  normalizeCountProgress,
  type CountProgressSnapshot,
  type TaskSseProgressInput
} from '~/utils/taskSseProgressText'
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

/** 第三步智能提取 loading 按「作品 + 剧集」隔离，切作品后回到原作品可立即恢复遮罩 */
export type ExtractUiScopeSnapshot = {
  isExtractingAssets: boolean
  extractingStage: 'scene' | 'character' | 'prop'
  extractingStages: { scene: boolean; character: boolean; prop: boolean }
  extractingTaskProgress: {
    percent: number
    stepTitle: string
    message: string
    stepIndex: number | null
    stepTotal: number | null
  }
}

function emptyExtractUiScopeSnapshot(): ExtractUiScopeSnapshot {
  return {
    isExtractingAssets: false,
    extractingStage: 'scene',
    extractingStages: { scene: false, character: false, prop: false },
    extractingTaskProgress: {
      percent: 0,
      stepTitle: '',
      message: '',
      stepIndex: null,
      stepTotal: null
    }
  }
}

function snapshotExtractUiFromStore(store: {
  isExtractingAssets: boolean
  extractingStage: 'scene' | 'character' | 'prop'
  extractingStages: { scene: boolean; character: boolean; prop: boolean }
  extractingTaskProgress: ExtractUiScopeSnapshot['extractingTaskProgress']
}): ExtractUiScopeSnapshot {
  return {
    isExtractingAssets: !!store.isExtractingAssets,
    extractingStage: store.extractingStage,
    extractingStages: { ...store.extractingStages },
    extractingTaskProgress: { ...store.extractingTaskProgress }
  }
}

function applyExtractUiSnapshotToStore(
  store: {
    isExtractingAssets: boolean
    extractingStage: 'scene' | 'character' | 'prop'
    extractingStages: { scene: boolean; character: boolean; prop: boolean }
    extractingTaskProgress: ExtractUiScopeSnapshot['extractingTaskProgress']
  },
  snap: ExtractUiScopeSnapshot | null | undefined
) {
  const s = snap ?? emptyExtractUiScopeSnapshot()
  store.isExtractingAssets = s.isExtractingAssets
  store.extractingStage = s.extractingStage
  store.extractingStages = { ...s.extractingStages }
  store.extractingTaskProgress = { ...s.extractingTaskProgress }
}

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
  /** SSE 最新进度文案（刷新后恢复 loading 展示） */
  message?: string
  stepTitle?: string
}

/** 分镜图弹窗单镜生图任务类型 */
export type StoryboardModalImageGenKind =
  | 'storyboard'
  | 'dialogue'
  | 'upscale'
  | 'multiangle'
  | 'ninegrid'

/** 分镜图单镜生图任务（按 storyboardId 隔离，刷新后恢复弹窗 loading） */
export type StoryboardImageGenTaskSnapshot = {
  taskId: number
  sceneIdx: number
  /** 默认 storyboard（生成分镜图） */
  kind?: StoryboardModalImageGenKind
  /** 对话作图时的图片索引 */
  imageIdx?: number
  /** SSE 最新进度文案（刷新后恢复 loading 展示） */
  message?: string
  stepTitle?: string
}

/** 分镜视频单镜生成任务（按 storyboardId 隔离） */
export type StoryboardVideoGenTaskSnapshot = {
  taskId: number
  sceneIdx: number
  taskKind: 'i2v' | 'multi' | 'edge' | 'grid'
  /** SSE 最新进度文案（刷新后恢复 loading 展示） */
  message?: string
  stepTitle?: string
}

/** 分镜配音弹窗生成任务（按 storyboardId 隔离，刷新后 compose/status 轮询恢复） */
export type StoryboardDubbingGenTaskSnapshot = {
  taskId?: number
  composeBatchId?: string
  audioRecordId?: number
  sceneIdx: number
  lipSync?: boolean
  message?: string
  stepTitle?: string
}

/** 分镜视频弹窗单条提示词生成任务（图生 / 宫格 / 多参，刷新后恢复 SSE） */
export type StoryboardVideoPromptGenTaskKind =
  | 'video-prompt-gen'
  | 'grid-video-prompt-gen'
  | 'multi-video-prompt-gen'

export type StoryboardVideoPromptGenTaskSnapshot = {
  taskId: number
  sceneIdx: number
  taskKind: StoryboardVideoPromptGenTaskKind
}

/** 分镜脚本 / 分镜视频 / 配音批量 loading 等，与 step3 使用同一 scope key */
export type Step4PlusLiveGenSnapshot = {
  isGeneratingStoryboard: boolean
  storyboardGenerationProgress: CountProgressSnapshot
  storyboardGenerationError: string | null
  /** 分镜图批量生成（提示词 + 出图），与分镜脚本批量隔离 */
  isGeneratingStoryboardImageBatch: boolean
  storyboardImageBatchProgress: CountProgressSnapshot
  storyboardImageBatchError: string | null
  /** 分镜图批量父任务 id（storyboard_image_prompt_batch，刷新后恢复 SSE） */
  storyboardImageBatchActiveTaskId: number | null
  /** 分镜图出图父任务 id（storyboard_image_generate） */
  storyboardImageBatchActiveImageTaskId: number | null
  /** 分镜列表单镜出图 loading，key 为 storyboardId 字符串 */
  storyboardPanelImageGenStatusByStoryboardId: Record<string, SceneGenerationStatus>
  /** 当前批量出图任务包含的分镜 id（刷新后恢复卡片 loading；手动新增分镜不在此列表） */
  storyboardImageBatchTargetStoryboardIds: number[]
  isGeneratingStoryboardVideo: boolean
  /** 分镜视频批量生成进度（提示词 + 出片） */
  storyboardVideoBatchProgress: CountProgressSnapshot
  storyboardVideoBatchError: string | null
  /** 分镜视频提示词批量父任务 id（storyboard_video_prompt_batch） */
  storyboardVideoBatchActivePromptTaskId: number | null
  /** 分镜视频出片父任务 id（storyboard_video_generate） */
  storyboardVideoBatchActiveVideoTaskId: number | null
  /** 分镜列表单镜出视频 loading，key 为 storyboardId 字符串 */
  storyboardPanelVideoGenStatusByStoryboardId: Record<string, SceneGenerationStatus>
  /** 分镜列表单镜出视频失败文案（按作品:剧集隔离，刷新后恢复「生成失败」卡片） */
  storyboardPanelVideoGenErrorByStoryboardId: Record<string, string>
  /** 当前批量出片任务包含的分镜 id（刷新后恢复卡片 loading；手动新增分镜不在此列表） */
  storyboardVideoBatchTargetStoryboardIds: number[]
  dubbingBatchGeneratingIndices: number[]
  /** 分镜脚本批量生成任务 id（按作品隔离，刷新后用于恢复 SSE） */
  storyboardScriptActiveTaskId: number | null
  /** 分镜脚本批量 PARTIAL_FAILED 时的 SSE 失败明细（供续生 UI 展示） */
  storyboardScriptPartialFailedData: TaskPartialFailedData | null
  /** 分镜图弹窗生图任务，key 为 storyboardId 字符串 */
  storyboardImageGenTasksByStoryboardId: Record<string, StoryboardImageGenTaskSnapshot>
  /** 分镜图弹窗提示词生成任务，key 为 storyboardId 字符串 */
  storyboardImagePromptGenTasksByStoryboardId: Record<string, StoryboardImageGenTaskSnapshot>
  /** 分镜视频弹窗任务，key 为 storyboardId 字符串 */
  storyboardVideoGenTasksByStoryboardId: Record<string, StoryboardVideoGenTaskSnapshot>
  /** 分镜视频弹窗单条提示词生成任务，key 为 storyboardId 字符串 */
  storyboardVideoPromptGenTasksByStoryboardId: Record<string, StoryboardVideoPromptGenTaskSnapshot>
  /** 分镜配音弹窗任务，key 为 storyboardId 字符串 */
  storyboardDubbingGenTasksByStoryboardId: Record<string, StoryboardDubbingGenTaskSnapshot>
  /**
   * 成品预览导出进行中标记（>0 表示需 resume 轮询 export/status）。
   * 注意：不是 /api/user/task 的 taskId；成片进度只查 export/status。
   */
  episodeExportTaskId: number | null
  /** 成品预览导出对应的剪辑记录 id（轮询 export/status 优先用） */
  episodeExportEditorId: number | null
}

export function liveGenScopeKeyFromIds(projectId: number | null, episodeId: number | null): string {
  const pid = projectId != null && Number.isFinite(Number(projectId)) ? Number(projectId) : 0
  // 电影/未写入剧集：persist 常为 null，路由/API 常为 0，统一为 0 避免刷新后 scope 错位
  if (episodeId === null || episodeId === undefined) {
    return `${pid}:0`
  }
  const n = Number(episodeId)
  const ep = Number.isFinite(n) && n >= 0 ? n : 0
  return `${pid}:${ep}`
}

function scopeKeyLegacyAliases(key: string): string[] {
  const keys = [key]
  const m = /^(\d+):(.+)$/.exec(String(key || '').trim())
  if (!m) return keys
  const pid = m[1]
  const ep = m[2]
  if (ep === 'null') keys.push(`${pid}:0`)
  if (ep === '0') keys.push(`${pid}:null`)
  return keys
}

/** 将旧版 `projectId:null` scope 桶合并进 `projectId:0`，避免刷新后读不到持久化状态 */
function migrateLegacyLiveGenScopeKeys(store: {
  step4PlusLiveGenByScope?: Record<string, Step4PlusLiveGenSnapshot>
}) {
  const map = store.step4PlusLiveGenByScope
  if (!map || typeof map !== 'object') return
  for (const key of Object.keys(map)) {
    const m = /^(\d+):null$/.exec(key)
    if (!m) continue
    const canonical = `${m[1]}:0`
    const legacy = map[key]
    if (!legacy) {
      delete map[key]
      continue
    }
    const existing = map[canonical]
    if (!existing) {
      map[canonical] = legacy
    } else {
      map[canonical] = {
        ...existing,
        ...legacy,
        storyboardPanelImageGenStatusByStoryboardId: {
          ...(existing.storyboardPanelImageGenStatusByStoryboardId || {}),
          ...(legacy.storyboardPanelImageGenStatusByStoryboardId || {})
        },
        storyboardImageBatchTargetStoryboardIds: legacy.storyboardImageBatchTargetStoryboardIds
          ?.length
          ? [...legacy.storyboardImageBatchTargetStoryboardIds]
          : existing.storyboardImageBatchTargetStoryboardIds || [],
        storyboardPanelVideoGenStatusByStoryboardId: {
          ...(existing.storyboardPanelVideoGenStatusByStoryboardId || {}),
          ...(legacy.storyboardPanelVideoGenStatusByStoryboardId || {})
        },
        storyboardPanelVideoGenErrorByStoryboardId: {
          ...(existing.storyboardPanelVideoGenErrorByStoryboardId || {}),
          ...(legacy.storyboardPanelVideoGenErrorByStoryboardId || {})
        },
        storyboardVideoBatchTargetStoryboardIds: legacy.storyboardVideoBatchTargetStoryboardIds
          ?.length
          ? [...legacy.storyboardVideoBatchTargetStoryboardIds]
          : existing.storyboardVideoBatchTargetStoryboardIds || [],
        isGeneratingStoryboardVideo:
          Boolean(existing.isGeneratingStoryboardVideo) ||
          Boolean(legacy.isGeneratingStoryboardVideo),
        storyboardVideoBatchActivePromptTaskId:
          legacy.storyboardVideoBatchActivePromptTaskId ??
          existing.storyboardVideoBatchActivePromptTaskId,
        storyboardVideoBatchActiveVideoTaskId:
          legacy.storyboardVideoBatchActiveVideoTaskId ??
          existing.storyboardVideoBatchActiveVideoTaskId,
        storyboardVideoBatchProgress:
          Number(legacy.storyboardVideoBatchProgress?.total) >
          Number(existing.storyboardVideoBatchProgress?.total)
            ? { ...legacy.storyboardVideoBatchProgress }
            : existing.storyboardVideoBatchProgress
      }
    }
    delete map[key]
  }
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
  /** 清晰度档（如 720p / 1080p / 1k），与模型 capability.sizeOptions 对齐 */
  resolution: string
  /** 出片时长（秒），批量/编辑弹窗共用 */
  durationSeconds?: number
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
    durationSeconds: undefined,
    soundEffects: 'with-sound'
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
  const resolution =
    String(raw.resolution ?? empty.resolution)
      .trim()
      .toLowerCase() || empty.resolution
  const durationRaw = Number(raw.durationSeconds)
  const durationSeconds =
    Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : undefined
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
    durationSeconds,
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
    durationSeconds?: number
    soundEffects?: StoryboardVideoSettingsScopeSnapshot['soundEffects']
  }
}): StoryboardVideoSettingsScopeSnapshot {
  return normalizeStoryboardVideoSettingsScopeSnapshot({
    agentId: String(
      store.storyboardVideoGenerateSettings?.agentId ?? store.storyboardVideoAgent?.id ?? ''
    ).trim(),
    agentName: String(store.storyboardVideoAgent?.name ?? '').trim(),
    agentDesc: String(store.storyboardVideoAgent?.desc ?? '').trim(),
    agentThumbnail: String(store.storyboardVideoAgent?.thumbnail ?? '').trim(),
    videoModel: String(store.storyboardVideoGenerateSettings?.videoModel ?? '').trim(),
    videoPromptModelCode: String(
      store.storyboardVideoGenerateSettings?.videoPromptModelCode ?? ''
    ).trim(),
    aspectRatio: store.storyboardVideoGenerateSettings?.aspectRatio,
    resolution: store.storyboardVideoGenerateSettings?.resolution,
    durationSeconds: store.storyboardVideoGenerateSettings?.durationSeconds,
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
      durationSeconds?: number
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
    durationSeconds: normalized.durationSeconds,
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
  if (
    !store.storyboardVideoSettingsByScope ||
    typeof store.storyboardVideoSettingsByScope !== 'object'
  ) {
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
    storyboardStylistModelCode: String(
      store.storyboardStylistGenerateSettings?.modelCode ?? ''
    ).trim(),
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
    scoped
      ? normalizeOptionalModelCodesScopeSnapshot(scoped)
      : emptyOptionalModelCodesScopeSnapshot()
  )
}

function emptyStep4PlusLiveGenSnapshot(): Step4PlusLiveGenSnapshot {
  return {
    isGeneratingStoryboard: false,
    storyboardGenerationProgress: { ...EMPTY_COUNT_PROGRESS },
    storyboardGenerationError: null,
    isGeneratingStoryboardImageBatch: false,
    storyboardImageBatchProgress: { ...EMPTY_COUNT_PROGRESS },
    storyboardImageBatchError: null,
    storyboardImageBatchActiveTaskId: null,
    storyboardImageBatchActiveImageTaskId: null,
    storyboardPanelImageGenStatusByStoryboardId: {},
    storyboardImageBatchTargetStoryboardIds: [],
    isGeneratingStoryboardVideo: false,
    storyboardVideoBatchProgress: { ...EMPTY_COUNT_PROGRESS },
    storyboardVideoBatchError: null,
    storyboardVideoBatchActivePromptTaskId: null,
    storyboardVideoBatchActiveVideoTaskId: null,
    storyboardPanelVideoGenStatusByStoryboardId: {},
    storyboardPanelVideoGenErrorByStoryboardId: {},
    storyboardVideoBatchTargetStoryboardIds: [],
    dubbingBatchGeneratingIndices: [],
    storyboardScriptActiveTaskId: null,
    storyboardScriptPartialFailedData: null,
    storyboardImageGenTasksByStoryboardId: {},
    storyboardImagePromptGenTasksByStoryboardId: {},
    storyboardVideoGenTasksByStoryboardId: {},
    storyboardVideoPromptGenTasksByStoryboardId: {},
    storyboardDubbingGenTasksByStoryboardId: {},
    episodeExportTaskId: null,
    episodeExportEditorId: null
  }
}

/** 剧集隔离：仅合并当前 scope（含 null/0 别名）的失败态，禁止跨 episode 桶合并 */
function mergeStoryboardVideoFailuresFromCurrentScope(
  store: { step4PlusLiveGenByScope?: Record<string, Step4PlusLiveGenSnapshot> },
  scopeKey: string,
  status: Record<string, SceneGenerationStatus>,
  errors: Record<string, string>
) {
  for (const alias of scopeKeyLegacyAliases(scopeKey)) {
    const scopeBlob = store.step4PlusLiveGenByScope?.[alias]
    if (!scopeBlob) continue
    for (const [k, v] of Object.entries(
      scopeBlob.storyboardPanelVideoGenStatusByStoryboardId || {}
    )) {
      if (v === 'failed') status[k] = v
    }
    for (const [k, v] of Object.entries(
      scopeBlob.storyboardPanelVideoGenErrorByStoryboardId || {}
    )) {
      const text = String(v ?? '').trim()
      if (text) errors[k] = text
    }
  }
}

function scoreStep4PlusLiveGenBlobForMigrate(blob: Step4PlusLiveGenSnapshot): number {
  let score = 0
  if (blob.isGeneratingStoryboard) score += 100
  if (blob.isGeneratingStoryboardImageBatch) score += 100
  if (blob.isGeneratingStoryboardVideo) score += 100
  const imageBatchTid = Number(blob.storyboardImageBatchActiveTaskId)
  if (Number.isFinite(imageBatchTid) && imageBatchTid > 0) score += 40
  const imageGenBatchTid = Number(blob.storyboardImageBatchActiveImageTaskId)
  if (Number.isFinite(imageGenBatchTid) && imageGenBatchTid > 0) score += 40
  score += Object.values(blob.storyboardPanelImageGenStatusByStoryboardId || {}).filter(
    (s) => s === 'generating'
  ).length
  score += blob.storyboardImageBatchTargetStoryboardIds?.length ?? 0
  score += Object.values(blob.storyboardPanelVideoGenStatusByStoryboardId || {}).filter(
    (s) => s === 'generating'
  ).length
  score += blob.storyboardVideoBatchTargetStoryboardIds?.length ?? 0
  score += Object.keys(blob.storyboardImageGenTasksByStoryboardId || {}).length * 20
  score += Object.keys(blob.storyboardImagePromptGenTasksByStoryboardId || {}).length * 20
  score += Object.keys(blob.storyboardVideoGenTasksByStoryboardId || {}).length * 20
  score += Object.keys(blob.storyboardVideoPromptGenTasksByStoryboardId || {}).length * 20
  score += Object.keys(blob.storyboardDubbingGenTasksByStoryboardId || {}).length * 20
  return score
}

function collectModalOwnedTaskIds(
  tasks?: Record<string, { taskId?: number } | undefined>
): Set<number> {
  return new Set(
    Object.values(tasks || {})
      .map((task) => Number(task?.taskId))
      .filter((taskId) => Number.isFinite(taskId) && taskId > 0)
  )
}

function sanitizeLegacyModalPanelGenerating(
  statuses: Record<string, SceneGenerationStatus> | undefined,
  modalTasks: Record<string, { taskId?: number } | undefined> | undefined
): Record<string, SceneGenerationStatus> {
  const modalStoryboardIds = new Set(Object.keys(modalTasks || {}))
  return Object.fromEntries(
    Object.entries(statuses || {}).filter(
      ([storyboardId, status]) => status !== 'generating' || !modalStoryboardIds.has(storyboardId)
    )
  )
}

function migrateStep4PlusLiveGenAfterRestore(store: {
  step4PlusLiveGenByScope?: Record<string, Step4PlusLiveGenSnapshot>
  dubbingBatchGeneratingIndices?: number[]
  step3GenVisualScopeKey?: () => string
  currentProjectId: number | null
  currentEpisodeId: number | null
  isGeneratingStoryboard: boolean
  storyboardGenerationProgress: CountProgressSnapshot
  storyboardGenerationError: string | null
  isGeneratingStoryboardImageBatch: boolean
  storyboardImageBatchProgress: CountProgressSnapshot
  storyboardImageBatchError: string | null
  storyboardImageBatchActiveTaskId: number | null
  storyboardImageBatchActiveImageTaskId: number | null
  storyboardPanelImageGenStatusByStoryboardId: Record<string, SceneGenerationStatus>
  storyboardImageBatchTargetStoryboardIds: number[]
  isGeneratingStoryboardVideo: boolean
  storyboardVideoBatchProgress: CountProgressSnapshot
  storyboardVideoBatchError: string | null
  storyboardVideoBatchActivePromptTaskId: number | null
  storyboardVideoBatchActiveVideoTaskId: number | null
  storyboardPanelVideoGenStatusByStoryboardId: Record<string, SceneGenerationStatus>
  storyboardPanelVideoGenErrorByStoryboardId?: Record<string, string>
  storyboardVideoBatchTargetStoryboardIds: number[]
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
  let blob: Step4PlusLiveGenSnapshot | undefined
  let bestScore = 0
  const consider = (candidate?: Step4PlusLiveGenSnapshot) => {
    if (!candidate) return
    const score = scoreStep4PlusLiveGenBlobForMigrate(candidate)
    if (score > bestScore) {
      bestScore = score
      blob = candidate
    }
  }
  /** 剧集隔离：刷新回灌只允许当前 scope（含 null/0 别名），禁止跨 episode 桶挑「最活跃」的灌回 */
  for (const alias of scopeKeyLegacyAliases(key)) {
    consider(store.step4PlusLiveGenByScope[alias])
  }
  if (!blob || bestScore <= 0) {
    for (const alias of scopeKeyLegacyAliases(key)) {
      const hit = store.step4PlusLiveGenByScope[alias]
      if (hit) {
        blob = hit
        break
      }
    }
  }
  if (blob) {
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboard = Boolean(blob.isGeneratingStoryboard)
    // eslint-disable-next-line no-param-reassign
    store.storyboardGenerationProgress = normalizeCountProgress(blob.storyboardGenerationProgress)
    // eslint-disable-next-line no-param-reassign
    store.storyboardGenerationError = blob.storyboardGenerationError ?? null
    const modalImageTaskIds = collectModalOwnedTaskIds(blob.storyboardImageGenTasksByStoryboardId)
    const imageGenBatchTid = Number(blob.storyboardImageBatchActiveImageTaskId)
    const restoredImageGenBatchTid =
      Number.isFinite(imageGenBatchTid) &&
      imageGenBatchTid > 0 &&
      !modalImageTaskIds.has(imageGenBatchTid)
        ? imageGenBatchTid
        : null
    const restoredImagePanelStatus = sanitizeLegacyModalPanelGenerating(
      blob.storyboardPanelImageGenStatusByStoryboardId,
      blob.storyboardImageGenTasksByStoryboardId
    )
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboardImageBatch = Boolean(
      blob.isGeneratingStoryboardImageBatch &&
        (Number(blob.storyboardImageBatchActiveTaskId) > 0 ||
          restoredImageGenBatchTid != null ||
          (blob.storyboardImageBatchTargetStoryboardIds?.length ?? 0) > 0 ||
          Object.values(restoredImagePanelStatus).some((status) => status === 'generating'))
    )
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchProgress = normalizeCountProgress(blob.storyboardImageBatchProgress)
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchError = blob.storyboardImageBatchError ?? null
    const imageBatchTid = Number(blob.storyboardImageBatchActiveTaskId)
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchActiveTaskId =
      Number.isFinite(imageBatchTid) && imageBatchTid > 0 ? imageBatchTid : null
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchActiveImageTaskId = restoredImageGenBatchTid
    // eslint-disable-next-line no-param-reassign
    store.storyboardPanelImageGenStatusByStoryboardId =
      blob.storyboardPanelImageGenStatusByStoryboardId &&
      typeof blob.storyboardPanelImageGenStatusByStoryboardId === 'object'
        ? restoredImagePanelStatus
        : {}
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchTargetStoryboardIds = Array.isArray(
      blob.storyboardImageBatchTargetStoryboardIds
    )
      ? blob.storyboardImageBatchTargetStoryboardIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      : []
    const modalVideoStoryboardIds = new Set(
      Object.keys(blob.storyboardVideoGenTasksByStoryboardId || {})
    )
    const modalVideoTaskIds = collectModalOwnedTaskIds(blob.storyboardVideoGenTasksByStoryboardId)
    const videoBatchTid = Number(blob.storyboardVideoBatchActiveVideoTaskId)
    const restoredVideoBatchTid =
      Number.isFinite(videoBatchTid) && videoBatchTid > 0 && !modalVideoTaskIds.has(videoBatchTid)
        ? videoBatchTid
        : null
    const restoredVideoPanelStatus = sanitizeLegacyModalPanelGenerating(
      blob.storyboardPanelVideoGenStatusByStoryboardId,
      blob.storyboardVideoGenTasksByStoryboardId
    )
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboardVideo = Boolean(
      blob.isGeneratingStoryboardVideo &&
      ((blob.storyboardVideoBatchTargetStoryboardIds?.length ?? 0) > 0 ||
        Number(blob.storyboardVideoBatchActivePromptTaskId) > 0 ||
        restoredVideoBatchTid != null ||
        Object.entries(restoredVideoPanelStatus).some(
          ([storyboardId, status]) =>
            status === 'generating' && !modalVideoStoryboardIds.has(storyboardId)
        ))
    )
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchProgress = normalizeCountProgress(blob.storyboardVideoBatchProgress)
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchError = blob.storyboardVideoBatchError ?? null
    const videoPromptBatchTid = Number(blob.storyboardVideoBatchActivePromptTaskId)
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchActivePromptTaskId =
      Number.isFinite(videoPromptBatchTid) && videoPromptBatchTid > 0 ? videoPromptBatchTid : null
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchActiveVideoTaskId = restoredVideoBatchTid
    // eslint-disable-next-line no-param-reassign
    store.storyboardPanelVideoGenStatusByStoryboardId =
      blob.storyboardPanelVideoGenStatusByStoryboardId &&
      typeof blob.storyboardPanelVideoGenStatusByStoryboardId === 'object'
        ? restoredVideoPanelStatus
        : {}
    // eslint-disable-next-line no-param-reassign
    store.storyboardPanelVideoGenErrorByStoryboardId =
      blob.storyboardPanelVideoGenErrorByStoryboardId &&
      typeof blob.storyboardPanelVideoGenErrorByStoryboardId === 'object'
        ? { ...blob.storyboardPanelVideoGenErrorByStoryboardId }
        : {}
    mergeStoryboardVideoFailuresFromCurrentScope(
      store,
      key,
      store.storyboardPanelVideoGenStatusByStoryboardId,
      store.storyboardPanelVideoGenErrorByStoryboardId
    )
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchTargetStoryboardIds = Array.isArray(
      blob.storyboardVideoBatchTargetStoryboardIds
    )
      ? blob.storyboardVideoBatchTargetStoryboardIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      : []
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
      !blob.storyboardImagePromptGenTasksByStoryboardId ||
      typeof blob.storyboardImagePromptGenTasksByStoryboardId !== 'object'
    ) {
      patch.storyboardImagePromptGenTasksByStoryboardId = {}
    }
    if (
      !blob.storyboardVideoGenTasksByStoryboardId ||
      typeof blob.storyboardVideoGenTasksByStoryboardId !== 'object'
    ) {
      patch.storyboardVideoGenTasksByStoryboardId = {}
    }
    if (
      !blob.storyboardVideoPromptGenTasksByStoryboardId ||
      typeof blob.storyboardVideoPromptGenTasksByStoryboardId !== 'object'
    ) {
      patch.storyboardVideoPromptGenTasksByStoryboardId = {}
    }
    if (
      !blob.storyboardDubbingGenTasksByStoryboardId ||
      typeof blob.storyboardDubbingGenTasksByStoryboardId !== 'object'
    ) {
      patch.storyboardDubbingGenTasksByStoryboardId = {}
    }
    if (
      !blob.storyboardPanelVideoGenStatusByStoryboardId ||
      typeof blob.storyboardPanelVideoGenStatusByStoryboardId !== 'object'
    ) {
      patch.storyboardPanelVideoGenStatusByStoryboardId = {}
    }
    if (
      !blob.storyboardPanelVideoGenErrorByStoryboardId ||
      typeof blob.storyboardPanelVideoGenErrorByStoryboardId !== 'object'
    ) {
      patch.storyboardPanelVideoGenErrorByStoryboardId = {}
    }
    if (Object.keys(patch).length) {
      // eslint-disable-next-line no-param-reassign
      store.step4PlusLiveGenByScope[key] = { ...blob, ...patch }
    }
  } else {
    const empty = emptyStep4PlusLiveGenSnapshot()
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboard = empty.isGeneratingStoryboard
    // eslint-disable-next-line no-param-reassign
    store.storyboardGenerationProgress = { ...empty.storyboardGenerationProgress }
    // eslint-disable-next-line no-param-reassign
    store.storyboardGenerationError = empty.storyboardGenerationError
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboardImageBatch = empty.isGeneratingStoryboardImageBatch
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchProgress = { ...empty.storyboardImageBatchProgress }
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchError = empty.storyboardImageBatchError
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchActiveTaskId = empty.storyboardImageBatchActiveTaskId
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchActiveImageTaskId = empty.storyboardImageBatchActiveImageTaskId
    // eslint-disable-next-line no-param-reassign
    store.storyboardPanelImageGenStatusByStoryboardId = {
      ...empty.storyboardPanelImageGenStatusByStoryboardId
    }
    // eslint-disable-next-line no-param-reassign
    store.storyboardImageBatchTargetStoryboardIds = [
      ...empty.storyboardImageBatchTargetStoryboardIds
    ]
    // eslint-disable-next-line no-param-reassign
    store.isGeneratingStoryboardVideo = empty.isGeneratingStoryboardVideo
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchProgress = { ...empty.storyboardVideoBatchProgress }
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchError = empty.storyboardVideoBatchError
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchActivePromptTaskId = empty.storyboardVideoBatchActivePromptTaskId
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchActiveVideoTaskId = empty.storyboardVideoBatchActiveVideoTaskId
    const preservedVideoStatus: Record<string, SceneGenerationStatus> = {}
    const preservedVideoErrors: Record<string, string> = {}
    for (const [k, v] of Object.entries(store.storyboardPanelVideoGenStatusByStoryboardId || {})) {
      if (v === 'failed') preservedVideoStatus[k] = v
    }
    for (const [k, v] of Object.entries(store.storyboardPanelVideoGenErrorByStoryboardId || {})) {
      const text = String(v ?? '').trim()
      if (text) preservedVideoErrors[k] = text
    }
    for (const scopeBlob of Object.values(store.step4PlusLiveGenByScope || {})) {
      for (const [k, v] of Object.entries(
        scopeBlob.storyboardPanelVideoGenStatusByStoryboardId || {}
      )) {
        if (v === 'failed') preservedVideoStatus[k] = v
      }
      for (const [k, v] of Object.entries(
        scopeBlob.storyboardPanelVideoGenErrorByStoryboardId || {}
      )) {
        const text = String(v ?? '').trim()
        if (text) preservedVideoErrors[k] = text
      }
    }
    // eslint-disable-next-line no-param-reassign
    store.storyboardPanelVideoGenStatusByStoryboardId = preservedVideoStatus
    // eslint-disable-next-line no-param-reassign
    store.storyboardPanelVideoGenErrorByStoryboardId = preservedVideoErrors
    // eslint-disable-next-line no-param-reassign
    store.storyboardVideoBatchTargetStoryboardIds = [
      ...empty.storyboardVideoBatchTargetStoryboardIds
    ]
    // eslint-disable-next-line no-param-reassign
    store.dubbingBatchGeneratingIndices = [...empty.dubbingBatchGeneratingIndices]
    // eslint-disable-next-line no-param-reassign
    store.storyboardScriptActiveTaskId = empty.storyboardScriptActiveTaskId
    // eslint-disable-next-line no-param-reassign
    store.storyboardScriptPartialFailedData = empty.storyboardScriptPartialFailedData
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
    /** 剧集：是否已从「上传剧本」首屏进入剧本创作（避免 /create 再次挡回上传页） */
    seriesFlowEnteredStoryScript: false,
    /** 剧集列表页：分集总数（供顶栏「共 N 集」展示） */
    seriesEpisodeListTotal: null as number | null,
    /** 当前项目审核/公开状态（来自 project/detail） */
    currentProjectStatus: null as number | null,
    currentProjectIsPublic: null as string | null,
    /** 当前项目/剧集成片上下文（电影取项目级，剧集取当前集） */
    currentEpisodeEditorId: null as number | null,
    currentFinalVideoUrl: null as string | null,
    currentPendingVideoUrl: null as string | null,
    currentExportStatus: null as number | null,
    currentEpisodeStatus: null as number | null,

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
        creationMode: 'pro' as const,
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

    // 素材准备的扩展数据（图片、形态等）
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
    /** 手动添加的分镜 id（服务端 storyboard id，刷新后按 id 恢复） */
    manualStoryboardIds: [] as number[],
    characterForms: {} as Record<number, Array<{ name: string; voiceover?: string }>>,
    propForms: {} as Record<number, Array<{ name: string }>>,
    sceneGenerationStatus: {} as Record<number, SceneGenerationStatus>,
    characterFormGenerationStatus: {} as Record<string, SceneGenerationStatus>,
    propFormGenerationStatus: {} as Record<string, SceneGenerationStatus>,
    /** key 与 step3GenVisualScopeKey() 一致：`${projectId}:${episodeKey}` */
    step3GenVisualByScope: {} as Record<string, Step3GenVisualScopeMaps>,
    /** 智能提取 loading 按作品/剧集分桶（内存态，切作品时写入/读出） */
    extractUiByScope: {} as Record<string, ExtractUiScopeSnapshot>,
    /** 当前会话内各 scope 正在连接的 asset_extract SSE taskId（连接关闭后必须清除，否则切换回来不会重连） */
    assetExtractFollowByScope: {} as Record<string, number>,
    /** CreateFlowShell 内 useCreateFlowExtractAgents 当前仍打开的 SSE taskId */
    assetExtractShellLiveTaskId: null as number | null,
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
      resolution: '720p',
      durationSeconds: undefined as number | undefined,
      soundEffects: 'with-sound' as 'none' | 'with-sound'
    },
    isGeneratingStoryboard: false,
    storyboardGenerationProgress: { ...EMPTY_COUNT_PROGRESS },
    storyboardGenerationError: null as string | null,
    /** 当前作品 scope 内进行中的分镜脚本批量任务 id（与 step4PlusLiveGenByScope 同步） */
    storyboardScriptActiveTaskId: null as number | null,
    storyboardScriptPartialFailedData: null as TaskPartialFailedData | null,
    /** 分镜图批量生成中（提示词 + 出图），与分镜脚本批量隔离 */
    isGeneratingStoryboardImageBatch: false,
    storyboardImageBatchProgress: { ...EMPTY_COUNT_PROGRESS },
    storyboardImageBatchError: null as string | null,
    storyboardImageBatchActiveTaskId: null as number | null,
    storyboardImageBatchActiveImageTaskId: null as number | null,
    storyboardPanelImageGenStatusByStoryboardId: {} as Record<string, SceneGenerationStatus>,
    storyboardImageBatchTargetStoryboardIds: [] as number[],
    // 分镜视频自动生成中（列表每项 loading、左侧步骤 loading、顶部进度 loading、按钮变停止生成）
    isGeneratingStoryboardVideo: false,
    storyboardVideoBatchProgress: { ...EMPTY_COUNT_PROGRESS },
    storyboardVideoBatchError: null as string | null,
    storyboardVideoBatchActivePromptTaskId: null as number | null,
    storyboardVideoBatchActiveVideoTaskId: null as number | null,
    storyboardPanelVideoGenStatusByStoryboardId: {} as Record<string, SceneGenerationStatus>,
    storyboardPanelVideoGenErrorByStoryboardId: {} as Record<string, string>,
    storyboardVideoBatchTargetStoryboardIds: [] as number[],

    /** 第三步：场景/角色形态/道具形态「自动生成」进行中的视觉反馈（流程步骤条 loading） */
    isGeneratingStep3Visual: false,

    /**
     * 第三步形态图 SSE 跟进计数（跨流程步骤切换时仍保持流程条 loading，组件卸载不重置）。
     * 与 scene/character/prop GenerationStatus 中的 generating 一并驱动 isGeneratingStep3Visual。
     */
    step3FormImageTaskFollowCount: 0,

    /**
     * 已 begin 尚未 end 的形态相关 taskId（切 Tab 断 SSE 不 end，切回重连勿重复 begin）。
     * 与 step3FormImageTaskFollowCount 成对维护。
     */
    step3FormImageTaskFollowTaskIds: [] as number[],

    // 持久化数据是否已恢复（用于避免刷新时的步骤闪烁）
    isHydrated: false,

    /** 与后端已同步的剧本 Markdown 原文（静默保存 dirty 判断；加载/显式保存后更新，不写入 persist paths） */
    scriptServerHtmlBaseline: '',
    /** 当前作品/剧集剧本 comicVersion（detail/save 回写；不 persist，切作品清零） */
    scriptComicVersion: 0,
    /** 提取弹窗按钮模式：空列表「开始提取」或剧本变更后「继续/重新提取」 */
    extractModalActionMode: 'start' as 'start' | 'continueOrReextract',
    /** 素材准备页：剧本有效变更轻提示条 */
    scriptChangeLightBannerVisible: false,
    /** 强提示点「去提取」后：跳转素材页再打开继续/重新提取弹窗 */
    pendingOpenContinueExtractModal: false,

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

      const prevScopeKey = liveGenScopeKeyFromIds(prevProjectId, prevEpisodeId)
      const nextScopeKey = liveGenScopeKeyFromIds(
        payload.projectId !== undefined ? nextProjectId : prevProjectId,
        payload.episodeId !== undefined ? nextEpisodeId : prevEpisodeId
      )
      const scopeWillChange = (projectChanged || episodeChanged) && prevScopeKey !== nextScopeKey

      /** 须在改写 currentProjectId 之前落盘：此时内存里的分镜/视频/配音 loading 仍属上一作品 */
      if (scopeWillChange) {
        this.syncStep3GenVisualToCurrentScope()
        this.syncStep4PlusLiveGenToCurrentScope()
        this.persistExtractUiForScopeKey(prevScopeKey)
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

      if (scopeWillChange) {
        this.resetLiveStep3TransientUiForContextSwitch()
        this.resetStepFormDataForContextSwitch()
        this.restoreStep4PlusLiveGenForScopeKey(nextScopeKey)
        this.applyStep3GenVisualFromScopeKey(nextScopeKey)
        this.applyOptionalModelCodesFromScopeKey(nextScopeKey)
        this.applyStoryboardVideoSettingsFromScopeKey(nextScopeKey)
        this.applyExtractUiFromScopeKey(nextScopeKey)
        this.refreshStep3VisualGeneratingFlag()
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
      this.manualStoryboardIds = []
      this.characterForms = {}
      this.propForms = {}
      this.scriptServerHtmlBaseline = ''
      this.scriptComicVersion = 0
      this.extractModalActionMode = 'start'
      this.scriptChangeLightBannerVisible = false
      this.pendingOpenContinueExtractModal = false
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
      this.step3FormImageTaskFollowTaskIds = []
      this.pendingExtractFormAssets = []
      this.showExtractAgentModal = false
      this.extractModalActionMode = 'start'
      this.scriptChangeLightBannerVisible = false
      this.pendingOpenContinueExtractModal = false
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

    setCurrentMediaContext(payload: {
      projectStatus?: number | null
      projectIsPublic?: string | null
      episodeEditorId?: number | null
      finalVideoUrl?: string | null
      pendingVideoUrl?: string | null
      exportStatus?: number | null
      episodeStatus?: number | null
    }) {
      if (payload.projectStatus !== undefined) {
        this.currentProjectStatus = payload.projectStatus
      }
      if (payload.projectIsPublic !== undefined) {
        this.currentProjectIsPublic = payload.projectIsPublic
      }
      if (payload.episodeEditorId !== undefined) {
        const id = Number(payload.episodeEditorId)
        this.currentEpisodeEditorId = Number.isFinite(id) && id > 0 ? id : null
      }
      if (payload.finalVideoUrl !== undefined) {
        this.currentFinalVideoUrl = String(payload.finalVideoUrl || '').trim() || null
      }
      if (payload.pendingVideoUrl !== undefined) {
        this.currentPendingVideoUrl = String(payload.pendingVideoUrl || '').trim() || null
      }
      if (payload.exportStatus !== undefined) {
        const st = Number(payload.exportStatus)
        this.currentExportStatus = Number.isFinite(st) ? st : null
      }
      if (payload.episodeStatus !== undefined) {
        const st = Number(payload.episodeStatus)
        this.currentEpisodeStatus = Number.isFinite(st) ? st : null
      }
    },

    setScriptServerHtmlBaseline(html: string) {
      this.scriptServerHtmlBaseline = html
    },

    setScriptComicVersion(version: number) {
      const n = Number(version)
      this.scriptComicVersion = Number.isFinite(n) && n >= 0 ? n : 0
    },

    setExtractModalActionMode(mode: 'start' | 'continueOrReextract') {
      this.extractModalActionMode = mode === 'continueOrReextract' ? 'continueOrReextract' : 'start'
    },

    setScriptChangeLightBannerVisible(visible: boolean) {
      this.scriptChangeLightBannerVisible = !!visible
    },

    setPendingOpenContinueExtractModal(pending: boolean) {
      this.pendingOpenContinueExtractModal = !!pending
    },

    // 更新表单数据
    updateFormData(data: Partial<WorkData>) {
      this.formData = { ...this.formData, ...plainDeep(data) }
    },

    // 更新素材准备数据
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

    setExtractingTaskProgress(
      payload: Partial<{
        percent: number
        stepTitle: string
        message: string
        stepIndex: number | null
        stepTotal: number | null
      }>
    ) {
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

    persistExtractUiForScopeKey(scopeKey: string) {
      if (!scopeKey || scopeKey.startsWith('0:')) return
      const snap = snapshotExtractUiFromStore(this)
      const hasLiveExtract =
        snap.isExtractingAssets ||
        snap.extractingStages.scene ||
        snap.extractingStages.character ||
        snap.extractingStages.prop ||
        String(snap.extractingTaskProgress.stepTitle || '').trim() ||
        String(snap.extractingTaskProgress.message || '').trim() ||
        (typeof snap.extractingTaskProgress.percent === 'number' &&
          snap.extractingTaskProgress.percent > 0)
      if (hasLiveExtract) {
        this.extractUiByScope[scopeKey] = snap
      } else {
        delete this.extractUiByScope[scopeKey]
      }
    },

    applyExtractUiFromScopeKey(scopeKey: string) {
      applyExtractUiSnapshotToStore(this, this.extractUiByScope[scopeKey])
    },

    clearExtractUiForScopeKey(scopeKey: string) {
      if (!scopeKey) return
      delete this.extractUiByScope[scopeKey]
      delete this.assetExtractFollowByScope[scopeKey]
    },

    setAssetExtractFollowTask(scopeKey: string, taskId: number | null) {
      if (!scopeKey) return
      if (taskId != null && Number.isFinite(taskId) && taskId > 0) {
        this.assetExtractFollowByScope[scopeKey] = taskId
      } else {
        delete this.assetExtractFollowByScope[scopeKey]
      }
    },

    getAssetExtractFollowTask(scopeKey: string): number | null {
      const id = this.assetExtractFollowByScope[scopeKey]
      return id != null && Number.isFinite(id) && id > 0 ? id : null
    },

    setAssetExtractShellLiveTaskId(taskId: number | null) {
      this.assetExtractShellLiveTaskId =
        taskId != null && Number.isFinite(taskId) && taskId > 0 ? taskId : null
    },

    getAssetExtractShellLiveTaskId(): number | null {
      const id = this.assetExtractShellLiveTaskId
      return id != null && Number.isFinite(id) && id > 0 ? id : null
    },

    isAssetExtractSseLiveForTask(taskId: number): boolean {
      const id = Number(taskId)
      if (!Number.isFinite(id) || id <= 0) return false
      return this.getAssetExtractShellLiveTaskId() === id
    },

    syncExtractUiToCurrentScope() {
      this.persistExtractUiForScopeKey(this.step3GenVisualScopeKey())
    },

    finishAssetExtractUiForCurrentScope() {
      const key = this.step3GenVisualScopeKey()
      this.setExtractingAssets(false)
      this.extractingStage = 'scene'
      this.extractingStages = { scene: false, character: false, prop: false }
      this.clearExtractingTaskProgress()
      this.setAssetExtractFollowTask(key, null)
      this.clearExtractUiForScopeKey(key)
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
      const snap =
        this.optionalModelCodesByScope[scopeKey] ?? emptyOptionalModelCodesScopeSnapshot()
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
      this.manualScenes = this.manualScenes.filter((i) => i !== index)
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
      this.manualCharacters = this.manualCharacters.filter((i) => i !== index)
    },

    addManualProp(index: number) {
      if (!this.manualProps.includes(index)) {
        this.manualProps.push(index)
      }
    },

    removeManualProp(index: number) {
      this.manualProps = this.manualProps.filter((i) => i !== index)
    },

    addManualStoryboard(storyboardId: number) {
      const id = Number(storyboardId)
      if (!Number.isFinite(id) || id <= 0) return
      if (!this.manualStoryboardIds.includes(id)) {
        this.manualStoryboardIds.push(id)
      }
    },

    removeManualStoryboard(storyboardId: number) {
      const id = Number(storyboardId)
      if (!Number.isFinite(id)) return
      this.manualStoryboardIds = this.manualStoryboardIds.filter((x) => x !== id)
    },

    pruneManualStoryboardIds(validIds: number[]) {
      const set = new Set(validIds.filter((id) => Number.isFinite(id) && id > 0))
      this.manualStoryboardIds = this.manualStoryboardIds.filter((id) => set.has(id))
    },

    isManualStoryboard(storyboardId: number): boolean {
      const id = Number(storyboardId)
      if (!Number.isFinite(id) || id <= 0) return false
      return this.manualStoryboardIds.includes(id)
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
        storyboardImageBatchTargetStoryboardIds: [...this.storyboardImageBatchTargetStoryboardIds],
        isGeneratingStoryboardVideo: this.isGeneratingStoryboardVideo,
        storyboardVideoBatchProgress: { ...this.storyboardVideoBatchProgress },
        storyboardVideoBatchError: this.storyboardVideoBatchError,
        storyboardVideoBatchActivePromptTaskId: this.storyboardVideoBatchActivePromptTaskId,
        storyboardVideoBatchActiveVideoTaskId: this.storyboardVideoBatchActiveVideoTaskId,
        storyboardPanelVideoGenStatusByStoryboardId: {
          ...this.storyboardPanelVideoGenStatusByStoryboardId
        },
        storyboardPanelVideoGenErrorByStoryboardId: {
          ...this.storyboardPanelVideoGenErrorByStoryboardId
        },
        storyboardVideoBatchTargetStoryboardIds: [...this.storyboardVideoBatchTargetStoryboardIds],
        dubbingBatchGeneratingIndices: [...this.dubbingBatchGeneratingIndices],
        storyboardScriptActiveTaskId: this.storyboardScriptActiveTaskId,
        storyboardScriptPartialFailedData: this.storyboardScriptPartialFailedData,
        storyboardImageGenTasksByStoryboardId: {
          ...(prev.storyboardImageGenTasksByStoryboardId || {})
        },
        storyboardImagePromptGenTasksByStoryboardId: {
          ...(prev.storyboardImagePromptGenTasksByStoryboardId || {})
        },
        storyboardVideoGenTasksByStoryboardId: {
          ...(prev.storyboardVideoGenTasksByStoryboardId || {})
        },
        storyboardVideoPromptGenTasksByStoryboardId: {
          ...(prev.storyboardVideoPromptGenTasksByStoryboardId || {})
        },
        storyboardDubbingGenTasksByStoryboardId: {
          ...(prev.storyboardDubbingGenTasksByStoryboardId || {})
        },
        episodeExportTaskId: prev.episodeExportTaskId ?? null,
        episodeExportEditorId: prev.episodeExportEditorId ?? null
      }
    },

    restoreStep4PlusLiveGenForScopeKey(key: string) {
      const s = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      this.isGeneratingStoryboard = s.isGeneratingStoryboard
      this.storyboardGenerationProgress = { ...s.storyboardGenerationProgress }
      this.storyboardGenerationError = s.storyboardGenerationError
      const modalImageTaskIds = collectModalOwnedTaskIds(s.storyboardImageGenTasksByStoryboardId)
      const imageGenBatchTid = Number(s.storyboardImageBatchActiveImageTaskId)
      const restoredImageGenBatchTid =
        Number.isFinite(imageGenBatchTid) &&
        imageGenBatchTid > 0 &&
        !modalImageTaskIds.has(imageGenBatchTid)
          ? imageGenBatchTid
          : null
      const restoredImagePanelStatus = sanitizeLegacyModalPanelGenerating(
        s.storyboardPanelImageGenStatusByStoryboardId,
        s.storyboardImageGenTasksByStoryboardId
      )
      this.isGeneratingStoryboardImageBatch = Boolean(
        s.isGeneratingStoryboardImageBatch &&
          (Number(s.storyboardImageBatchActiveTaskId) > 0 ||
            restoredImageGenBatchTid != null ||
            (s.storyboardImageBatchTargetStoryboardIds?.length ?? 0) > 0 ||
            Object.values(restoredImagePanelStatus).some((status) => status === 'generating'))
      )
      this.storyboardImageBatchProgress = { ...s.storyboardImageBatchProgress }
      this.storyboardImageBatchError = s.storyboardImageBatchError
      const imageBatchTid = Number(s.storyboardImageBatchActiveTaskId)
      this.storyboardImageBatchActiveTaskId =
        Number.isFinite(imageBatchTid) && imageBatchTid > 0 ? imageBatchTid : null
      this.storyboardImageBatchActiveImageTaskId = restoredImageGenBatchTid
      this.storyboardPanelImageGenStatusByStoryboardId = restoredImagePanelStatus
      this.storyboardImageBatchTargetStoryboardIds = Array.isArray(
        s.storyboardImageBatchTargetStoryboardIds
      )
        ? s.storyboardImageBatchTargetStoryboardIds
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
        : []
      const modalVideoTaskIds = collectModalOwnedTaskIds(s.storyboardVideoGenTasksByStoryboardId)
      const videoBatchTid = Number(s.storyboardVideoBatchActiveVideoTaskId)
      const restoredVideoBatchTid =
        Number.isFinite(videoBatchTid) &&
        videoBatchTid > 0 &&
        !modalVideoTaskIds.has(videoBatchTid)
          ? videoBatchTid
          : null
      const restoredVideoPanelStatus = sanitizeLegacyModalPanelGenerating(
        s.storyboardPanelVideoGenStatusByStoryboardId,
        s.storyboardVideoGenTasksByStoryboardId
      )
      this.isGeneratingStoryboardVideo = Boolean(
        s.isGeneratingStoryboardVideo &&
          (Number(s.storyboardVideoBatchActivePromptTaskId) > 0 ||
            restoredVideoBatchTid != null ||
            (s.storyboardVideoBatchTargetStoryboardIds?.length ?? 0) > 0 ||
            Object.values(restoredVideoPanelStatus).some((status) => status === 'generating'))
      )
      this.storyboardVideoBatchProgress = { ...s.storyboardVideoBatchProgress }
      this.storyboardVideoBatchError = s.storyboardVideoBatchError
      const videoPromptBatchTid = Number(s.storyboardVideoBatchActivePromptTaskId)
      this.storyboardVideoBatchActivePromptTaskId =
        Number.isFinite(videoPromptBatchTid) && videoPromptBatchTid > 0 ? videoPromptBatchTid : null
      this.storyboardVideoBatchActiveVideoTaskId = restoredVideoBatchTid
      this.storyboardPanelVideoGenStatusByStoryboardId = restoredVideoPanelStatus
      this.storyboardPanelVideoGenErrorByStoryboardId = {
        ...(s.storyboardPanelVideoGenErrorByStoryboardId || {})
      }
      this.storyboardVideoBatchTargetStoryboardIds = Array.isArray(
        s.storyboardVideoBatchTargetStoryboardIds
      )
        ? s.storyboardVideoBatchTargetStoryboardIds
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
        : []
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
            ? normalizeCountProgress({
                ...base.storyboardGenerationProgress,
                ...partial.storyboardGenerationProgress
              })
            : base.storyboardGenerationProgress,
        storyboardImageBatchProgress:
          partial.storyboardImageBatchProgress != null
            ? normalizeCountProgress({
                ...base.storyboardImageBatchProgress,
                ...partial.storyboardImageBatchProgress
              })
            : base.storyboardImageBatchProgress,
        storyboardVideoBatchProgress:
          partial.storyboardVideoBatchProgress != null
            ? normalizeCountProgress({
                ...base.storyboardVideoBatchProgress,
                ...partial.storyboardVideoBatchProgress
              })
            : base.storyboardVideoBatchProgress,
        storyboardPanelImageGenStatusByStoryboardId:
          partial.storyboardPanelImageGenStatusByStoryboardId != null
            ? { ...partial.storyboardPanelImageGenStatusByStoryboardId }
            : { ...(base.storyboardPanelImageGenStatusByStoryboardId || {}) },
        storyboardImageBatchTargetStoryboardIds:
          partial.storyboardImageBatchTargetStoryboardIds != null
            ? partial.storyboardImageBatchTargetStoryboardIds
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id) && id > 0)
            : [...(base.storyboardImageBatchTargetStoryboardIds || [])],
        storyboardPanelVideoGenStatusByStoryboardId:
          partial.storyboardPanelVideoGenStatusByStoryboardId != null
            ? { ...partial.storyboardPanelVideoGenStatusByStoryboardId }
            : { ...(base.storyboardPanelVideoGenStatusByStoryboardId || {}) },
        storyboardPanelVideoGenErrorByStoryboardId:
          partial.storyboardPanelVideoGenErrorByStoryboardId != null
            ? { ...partial.storyboardPanelVideoGenErrorByStoryboardId }
            : { ...(base.storyboardPanelVideoGenErrorByStoryboardId || {}) },
        storyboardVideoBatchTargetStoryboardIds:
          partial.storyboardVideoBatchTargetStoryboardIds != null
            ? partial.storyboardVideoBatchTargetStoryboardIds
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id) && id > 0)
            : [...(base.storyboardVideoBatchTargetStoryboardIds || [])],
        dubbingBatchGeneratingIndices:
          partial.dubbingBatchGeneratingIndices != null
            ? [...partial.dubbingBatchGeneratingIndices]
            : base.dubbingBatchGeneratingIndices,
        storyboardImageGenTasksByStoryboardId:
          partial.storyboardImageGenTasksByStoryboardId != null
            ? { ...partial.storyboardImageGenTasksByStoryboardId }
            : { ...(base.storyboardImageGenTasksByStoryboardId || {}) },
        storyboardImagePromptGenTasksByStoryboardId:
          partial.storyboardImagePromptGenTasksByStoryboardId != null
            ? { ...partial.storyboardImagePromptGenTasksByStoryboardId }
            : { ...(base.storyboardImagePromptGenTasksByStoryboardId || {}) },
        storyboardVideoGenTasksByStoryboardId:
          partial.storyboardVideoGenTasksByStoryboardId != null
            ? { ...partial.storyboardVideoGenTasksByStoryboardId }
            : { ...(base.storyboardVideoGenTasksByStoryboardId || {}) },
        storyboardVideoPromptGenTasksByStoryboardId:
          partial.storyboardVideoPromptGenTasksByStoryboardId != null
            ? { ...partial.storyboardVideoPromptGenTasksByStoryboardId }
            : { ...(base.storyboardVideoPromptGenTasksByStoryboardId || {}) },
        storyboardDubbingGenTasksByStoryboardId:
          partial.storyboardDubbingGenTasksByStoryboardId != null
            ? { ...partial.storyboardDubbingGenTasksByStoryboardId }
            : { ...(base.storyboardDubbingGenTasksByStoryboardId || {}) }
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
      const scopeKey = this.step3GenVisualScopeKey()
      const fromModal = scopeKeyLegacyAliases(scopeKey).some((alias) => {
        const blob = this.step3GenVisualByScope[alias]
        return Object.keys(blob?.modalSseTasks || {}).length > 0
      })
      // follow 计数由 begin/endStep3FormImageTaskFollow 成对维护。
      // 形态文案（form_generate）故意不写 generating map，只靠计数驱动角标/流程条；
      // 不可在此处因 !fromMaps 强行清零，否则 SSE 一开始图标就不会出现。
      // 卡住清理请走 finish/reset 等显式入口。
      this.isGeneratingStep3Visual = fromMaps || this.step3FormImageTaskFollowCount > 0 || fromModal
    },

    /**
     * @param taskId 传入时按任务幂等：同一 taskId 多次 begin 不计两次；切 Tab 断线重连不会叠高计数。
     */
    beginStep3FormImageTaskFollow(taskId?: number | null) {
      const tid = Number(taskId)
      if (Number.isFinite(tid) && tid > 0) {
        if (this.step3FormImageTaskFollowTaskIds.includes(tid)) {
          this.refreshStep3VisualGeneratingFlag()
          return
        }
        this.step3FormImageTaskFollowTaskIds = [...this.step3FormImageTaskFollowTaskIds, tid]
      }
      this.step3FormImageTaskFollowCount++
      this.refreshStep3VisualGeneratingFlag()
    },

    /**
     * @param taskId 传入时按任务幂等：未 begin 过或已 end 的 taskId 不再递减。
     */
    endStep3FormImageTaskFollow(taskId?: number | null) {
      const tid = Number(taskId)
      if (Number.isFinite(tid) && tid > 0) {
        if (!this.step3FormImageTaskFollowTaskIds.includes(tid)) {
          this.refreshStep3VisualGeneratingFlag()
          return
        }
        this.step3FormImageTaskFollowTaskIds = this.step3FormImageTaskFollowTaskIds.filter(
          (id) => id !== tid
        )
      }
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
      if (settings.shotDensity !== undefined)
        this.storyboardGenerateSettings.shotDensity = settings.shotDensity
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

    updateStoryboardStylistAgent(agent: {
      id: string
      name: string
      desc: string
      thumbnail?: string
    }) {
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
      resolution?: string
      durationSeconds?: number | null
      soundEffects?: 'none' | 'with-sound'
    }) {
      if (settings.agentId !== undefined)
        this.storyboardVideoGenerateSettings.agentId = settings.agentId
      if (settings.videoModel !== undefined)
        this.storyboardVideoGenerateSettings.videoModel = settings.videoModel
      if (settings.videoPromptModelCode !== undefined) {
        this.storyboardVideoGenerateSettings.videoPromptModelCode = settings.videoPromptModelCode
      }
      if (settings.aspectRatio !== undefined)
        this.storyboardVideoGenerateSettings.aspectRatio = settings.aspectRatio
      if (settings.resolution !== undefined) {
        this.storyboardVideoGenerateSettings.resolution = String(settings.resolution || '')
          .trim()
          .toLowerCase()
      }
      if (settings.durationSeconds !== undefined) {
        const n = Number(settings.durationSeconds)
        this.storyboardVideoGenerateSettings.durationSeconds =
          Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
      }
      if (settings.soundEffects !== undefined)
        this.storyboardVideoGenerateSettings.soundEffects = settings.soundEffects
      this.syncStoryboardVideoSettingsToCurrentScope()
    },

    /** 分镜视频：选择智能体后同步展示信息与 agentId */
    updateStoryboardVideoAgent(agent: {
      id: string
      name: string
      desc: string
      thumbnail?: string
    }) {
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
      this.storyboardGenerationProgress = {
        ...this.storyboardGenerationProgress,
        completed,
        total
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    applyStoryboardScriptSseProgress(p: TaskSseProgressInput) {
      this.storyboardGenerationProgress = mergeCountProgressFromSse(
        this.storyboardGenerationProgress,
        p
      )
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardScriptProgress() {
      this.storyboardGenerationProgress = { ...EMPTY_COUNT_PROGRESS }
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
      this.storyboardImageBatchProgress = {
        ...this.storyboardImageBatchProgress,
        completed,
        total
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    applyStoryboardImageBatchSseProgress(p: TaskSseProgressInput) {
      this.storyboardImageBatchProgress = mergeCountProgressFromSse(
        this.storyboardImageBatchProgress,
        p
      )
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardImageBatchProgress() {
      this.storyboardImageBatchProgress = { ...EMPTY_COUNT_PROGRESS }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardImageBatchError(msg: string | null) {
      this.storyboardImageBatchError = msg
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardImageBatchTargetStoryboardIds(storyboardIds: number[]) {
      this.storyboardImageBatchTargetStoryboardIds = (storyboardIds ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardImageBatchTargetStoryboardIds() {
      this.storyboardImageBatchTargetStoryboardIds = []
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    isStoryboardImageBatchTarget(storyboardId: number): boolean {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return false
      return this.storyboardImageBatchTargetStoryboardIds.includes(sid)
    },

    setStoryboardPanelImageGenStatus(storyboardId: number, status: SceneGenerationStatus) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const key = String(sid)
      if (this.storyboardPanelImageGenStatusByStoryboardId[key] === status) return
      this.storyboardPanelImageGenStatusByStoryboardId = {
        ...this.storyboardPanelImageGenStatusByStoryboardId,
        [key]: status
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardPanelImageGenStatus(storyboardId: number) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const key = String(sid)
      if (!(key in this.storyboardPanelImageGenStatusByStoryboardId)) return
      const next = { ...this.storyboardPanelImageGenStatusByStoryboardId }
      delete next[key]
      this.storyboardPanelImageGenStatusByStoryboardId = next
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    stopStoryboardImageBatchGeneration() {
      this.isGeneratingStoryboardImageBatch = false
      this.storyboardImageBatchError = null
      this.storyboardImageBatchActiveTaskId = null
      this.storyboardImageBatchActiveImageTaskId = null
      this.storyboardImageBatchTargetStoryboardIds = []
      this.storyboardPanelImageGenStatusByStoryboardId = {}
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    setStoryboardImageGenTask(
      storyboardId: number,
      payload: {
        taskId: number
        sceneIdx: number
        kind?: StoryboardModalImageGenKind
        imageIdx?: number
        message?: string
        stepTitle?: string
      },
      scopeKey?: string
    ) {
      const sid = Number(storyboardId)
      const tid = Number(payload.taskId)
      const sceneIdx = Number(payload.sceneIdx)
      if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(tid) || tid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const prev = base.storyboardImageGenTasksByStoryboardId?.[String(sid)]
      const msg = String(payload.message ?? prev?.message ?? '').trim()
      const step = String(payload.stepTitle ?? prev?.stepTitle ?? '').trim()
      const kind = payload.kind ?? prev?.kind
      const imageIdxRaw = payload.imageIdx ?? prev?.imageIdx
      const imageIdx =
        imageIdxRaw != null && Number.isFinite(Number(imageIdxRaw))
          ? Number(imageIdxRaw)
          : undefined
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardImageGenTasksByStoryboardId: {
          ...(base.storyboardImageGenTasksByStoryboardId || {}),
          [String(sid)]: {
            taskId: tid,
            sceneIdx: Number.isFinite(sceneIdx) ? sceneIdx : 0,
            ...(kind ? { kind } : {}),
            ...(imageIdx != null ? { imageIdx } : {}),
            ...(msg ? { message: msg } : {}),
            ...(step ? { stepTitle: step } : {})
          }
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
      return {
        taskId: tid,
        sceneIdx: Number(hit.sceneIdx) || 0,
        ...(hit.kind ? { kind: hit.kind } : {}),
        ...(hit.imageIdx != null && Number.isFinite(Number(hit.imageIdx))
          ? { imageIdx: Number(hit.imageIdx) }
          : {}),
        ...(String(hit.message ?? '').trim() ? { message: String(hit.message).trim() } : {}),
        ...(String(hit.stepTitle ?? '').trim() ? { stepTitle: String(hit.stepTitle).trim() } : {})
      }
    },

    setStoryboardImagePromptGenTask(
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
        storyboardImagePromptGenTasksByStoryboardId: {
          ...(base.storyboardImagePromptGenTasksByStoryboardId || {}),
          [String(sid)]: { taskId: tid, sceneIdx: Number.isFinite(sceneIdx) ? sceneIdx : 0 }
        }
      })
    },

    clearStoryboardImagePromptGenTask(storyboardId: number, scopeKey?: string) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const next = { ...(base.storyboardImagePromptGenTasksByStoryboardId || {}) }
      delete next[String(sid)]
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardImagePromptGenTasksByStoryboardId: next
      })
    },

    getStoryboardImagePromptGenTask(
      storyboardId: number,
      scopeKey?: string
    ): StoryboardImageGenTaskSnapshot | null {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return null
      const key = scopeKey || this.step3GenVisualScopeKey()
      const blob = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const hit = blob.storyboardImagePromptGenTasksByStoryboardId?.[String(sid)]
      if (!hit) return null
      const tid = Number(hit.taskId)
      if (!Number.isFinite(tid) || tid <= 0) return null
      return { taskId: tid, sceneIdx: Number(hit.sceneIdx) || 0 }
    },

    setStoryboardVideoPromptGenTask(
      storyboardId: number,
      payload: {
        taskId: number
        sceneIdx: number
        taskKind: StoryboardVideoPromptGenTaskKind
      },
      scopeKey?: string
    ) {
      const sid = Number(storyboardId)
      const tid = Number(payload.taskId)
      const sceneIdx = Number(payload.sceneIdx)
      if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(tid) || tid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardVideoPromptGenTasksByStoryboardId: {
          ...(base.storyboardVideoPromptGenTasksByStoryboardId || {}),
          [String(sid)]: {
            taskId: tid,
            sceneIdx: Number.isFinite(sceneIdx) ? sceneIdx : 0,
            taskKind: payload.taskKind
          }
        }
      })
    },

    clearStoryboardVideoPromptGenTask(storyboardId: number, scopeKey?: string) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const next = { ...(base.storyboardVideoPromptGenTasksByStoryboardId || {}) }
      delete next[String(sid)]
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardVideoPromptGenTasksByStoryboardId: next
      })
    },

    getStoryboardVideoPromptGenTask(
      storyboardId: number,
      scopeKey?: string
    ): StoryboardVideoPromptGenTaskSnapshot | null {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return null
      const key = scopeKey || this.step3GenVisualScopeKey()
      const blob = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const hit = blob.storyboardVideoPromptGenTasksByStoryboardId?.[String(sid)]
      if (!hit) return null
      const tid = Number(hit.taskId)
      if (!Number.isFinite(tid) || tid <= 0) return null
      const taskKind =
        hit.taskKind === 'multi-video-prompt-gen' ? 'multi-video-prompt-gen' : 'video-prompt-gen'
      return {
        taskId: tid,
        sceneIdx: Number(hit.sceneIdx) || 0,
        taskKind
      }
    },

    setStoryboardVideoGenTask(
      storyboardId: number,
      payload: {
        taskId: number
        sceneIdx: number
        taskKind: 'i2v' | 'multi' | 'edge' | 'grid'
        message?: string
        stepTitle?: string
      },
      scopeKey?: string
    ) {
      const sid = Number(storyboardId)
      const tid = Number(payload.taskId)
      const sceneIdx = Number(payload.sceneIdx)
      if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(tid) || tid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const prev = base.storyboardVideoGenTasksByStoryboardId?.[String(sid)]
      const msg = String(payload.message ?? prev?.message ?? '').trim()
      const step = String(payload.stepTitle ?? prev?.stepTitle ?? '').trim()
      const taskKind = payload.taskKind ?? prev?.taskKind ?? 'i2v'
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardVideoGenTasksByStoryboardId: {
          ...(base.storyboardVideoGenTasksByStoryboardId || {}),
          [String(sid)]: {
            taskId: tid,
            sceneIdx: Number.isFinite(sceneIdx) ? sceneIdx : 0,
            taskKind,
            ...(msg ? { message: msg } : {}),
            ...(step ? { stepTitle: step } : {})
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
        taskKind:
          hit.taskKind === 'multi'
            ? 'multi'
            : hit.taskKind === 'edge'
              ? 'edge'
              : hit.taskKind === 'grid'
                ? 'grid'
                : 'i2v',
        ...(String(hit.message ?? '').trim() ? { message: String(hit.message).trim() } : {}),
        ...(String(hit.stepTitle ?? '').trim() ? { stepTitle: String(hit.stepTitle).trim() } : {})
      }
    },

    setStoryboardDubbingGenTask(
      storyboardId: number,
      payload: {
        taskId?: number
        composeBatchId?: string
        audioRecordId?: number
        sceneIdx: number
        lipSync?: boolean
        message?: string
        stepTitle?: string
      },
      scopeKey?: string
    ) {
      const sid = Number(storyboardId)
      const sceneIdx = Number(payload.sceneIdx)
      const composeBatchId = String(payload.composeBatchId || '').trim()
      const audioRecordId = Number(payload.audioRecordId)
      const tid = Number(payload.taskId)
      const hasTask = Number.isFinite(tid) && tid > 0
      const hasAudio = Number.isFinite(audioRecordId) && audioRecordId > 0
      const hasCompose = !!composeBatchId && hasAudio
      if (!Number.isFinite(sid) || sid <= 0 || (!hasTask && !hasCompose)) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const prev = base.storyboardDubbingGenTasksByStoryboardId?.[String(sid)]
      const msg = String(payload.message ?? prev?.message ?? '').trim()
      const step = String(payload.stepTitle ?? prev?.stepTitle ?? '').trim()
      const lipSync = payload.lipSync != null ? Boolean(payload.lipSync) : prev?.lipSync
      const prevAudio = Number(prev?.audioRecordId)
      const mergedAudio = hasAudio
        ? audioRecordId
        : Number.isFinite(prevAudio) && prevAudio > 0
          ? prevAudio
          : undefined
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardDubbingGenTasksByStoryboardId: {
          ...(base.storyboardDubbingGenTasksByStoryboardId || {}),
          [String(sid)]: {
            sceneIdx: Number.isFinite(sceneIdx) ? sceneIdx : 0,
            ...(hasCompose ? { composeBatchId, audioRecordId } : {}),
            ...(hasTask ? { taskId: tid } : {}),
            ...(!hasCompose && mergedAudio != null ? { audioRecordId: mergedAudio } : {}),
            ...(lipSync != null ? { lipSync } : {}),
            ...(msg ? { message: msg } : {}),
            ...(step ? { stepTitle: step } : {})
          }
        }
      })
    },

    clearStoryboardDubbingGenTask(storyboardId: number, scopeKey?: string) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const key = scopeKey || this.step3GenVisualScopeKey()
      const base = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const next = { ...(base.storyboardDubbingGenTasksByStoryboardId || {}) }
      delete next[String(sid)]
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        storyboardDubbingGenTasksByStoryboardId: next
      })
    },

    getStoryboardDubbingGenTask(
      storyboardId: number,
      scopeKey?: string
    ): StoryboardDubbingGenTaskSnapshot | null {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return null
      const key = scopeKey || this.step3GenVisualScopeKey()
      const blob = this.step4PlusLiveGenByScope[key] ?? emptyStep4PlusLiveGenSnapshot()
      const hit = blob.storyboardDubbingGenTasksByStoryboardId?.[String(sid)]
      if (!hit) return null
      const composeBatchId = String(hit.composeBatchId || '').trim()
      const audioRecordId = Number(hit.audioRecordId)
      const tid = Number(hit.taskId)
      const hasTask = Number.isFinite(tid) && tid > 0
      const hasAudio = Number.isFinite(audioRecordId) && audioRecordId > 0
      const hasCompose = !!composeBatchId && hasAudio
      if (!hasTask && !hasCompose) return null
      return {
        sceneIdx: Number(hit.sceneIdx) || 0,
        ...(hasCompose ? { composeBatchId, audioRecordId } : {}),
        ...(hasTask ? { taskId: tid } : {}),
        ...(!hasCompose && hasAudio ? { audioRecordId } : {}),
        ...(hit.lipSync != null ? { lipSync: Boolean(hit.lipSync) } : {}),
        ...(String(hit.message ?? '').trim() ? { message: String(hit.message).trim() } : {}),
        ...(String(hit.stepTitle ?? '').trim() ? { stepTitle: String(hit.stepTitle).trim() } : {})
      }
    },

    setEpisodeExportFollowTask(
      scopeKey: string,
      payload: { episodeEditorId?: number | null; taskId?: number; active?: boolean }
    ) {
      const key = String(scopeKey || '').trim()
      if (!key || key.startsWith('0:')) return
      const editorId = Number(payload.episodeEditorId)
      const hasEditor = Number.isFinite(editorId) && editorId > 0
      // 兼容旧调用：曾误存 media taskId；现仅作「导出跟进中」标记（固定 1）
      const marker = payload.active === true || hasEditor || Number(payload.taskId) > 0 ? 1 : 0
      if (!marker) return
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        episodeExportTaskId: marker,
        episodeExportEditorId: hasEditor ? editorId : null
      })
    },

    clearEpisodeExportFollowTask(scopeKey?: string) {
      const key = String(scopeKey || this.step3GenVisualScopeKey() || '').trim()
      if (!key) return
      this.mergeStep4PlusLiveGenForScopeKey(key, {
        episodeExportTaskId: null,
        episodeExportEditorId: null
      })
    },

    getEpisodeExportFollowTask(scopeKey?: string): {
      episodeEditorId: number | null
    } | null {
      const key = String(scopeKey || this.step3GenVisualScopeKey() || '').trim()
      if (!key) return null
      const blob = this.step4PlusLiveGenByScope[key]
      if (!blob) return null
      const marker = Number(blob.episodeExportTaskId)
      const editorId = Number(blob.episodeExportEditorId)
      const hasEditor = Number.isFinite(editorId) && editorId > 0
      // marker>0 或已有 editorId，均视为导出跟进中（兼容历史误存的超大 media taskId）
      if (!(marker > 0 || hasEditor)) return null
      return {
        episodeEditorId: hasEditor ? editorId : null
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
      this.refreshStep3VisualGeneratingFlag()
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
      this.refreshStep3VisualGeneratingFlag()
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

    /**
     * 当前 scope 未命中时按 null/0 历史别名查找（刷新后 scope 键短暂不一致的兜底）。
     * 剧集隔离：editorScopeKey 是索引型键（scene-0 / 0-1），不全局唯一，
     * 禁止跨 episode/作品桶枚举，否则会把他集同名键的弹窗任务恢复到本集。
     */
    findSceneModalSseTaskAcrossScopes(editorScopeKey: string): SceneModalSseTaskSnapshot | null {
      const scope = String(editorScopeKey || '').trim()
      if (!scope) return null
      const direct = this.getSceneModalSseTask(scope)
      if (direct) return direct
      for (const alias of scopeKeyLegacyAliases(this.step3GenVisualScopeKey())) {
        const hit = this.step3GenVisualByScope[alias]?.modalSseTasks?.[scope]
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
      this.storyboardVideoBatchProgress = {
        ...this.storyboardVideoBatchProgress,
        completed,
        total
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    applyStoryboardVideoBatchSseProgress(p: TaskSseProgressInput) {
      this.storyboardVideoBatchProgress = mergeCountProgressFromSse(
        this.storyboardVideoBatchProgress,
        p
      )
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardVideoBatchProgress() {
      this.storyboardVideoBatchProgress = { ...EMPTY_COUNT_PROGRESS }
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

    setStoryboardVideoBatchTargetStoryboardIds(storyboardIds: number[]) {
      this.storyboardVideoBatchTargetStoryboardIds = (storyboardIds ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardVideoBatchTargetStoryboardIds() {
      this.storyboardVideoBatchTargetStoryboardIds = []
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    isStoryboardVideoBatchTarget(storyboardId: number): boolean {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return false
      return this.storyboardVideoBatchTargetStoryboardIds.includes(sid)
    },

    setStoryboardPanelVideoGenStatus(storyboardId: number, status: SceneGenerationStatus) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      const key = String(sid)
      if (this.storyboardPanelVideoGenStatusByStoryboardId[key] === status) return
      this.storyboardPanelVideoGenStatusByStoryboardId = {
        ...this.storyboardPanelVideoGenStatusByStoryboardId,
        [key]: status
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

    setStoryboardPanelVideoGenError(storyboardId: number, message: string) {
      const sid = Number(storyboardId)
      const text = String(message ?? '').trim()
      if (!Number.isFinite(sid) || sid <= 0 || !text) return
      const key = String(sid)
      if (this.storyboardPanelVideoGenErrorByStoryboardId[key] === text) return
      this.storyboardPanelVideoGenErrorByStoryboardId = {
        ...this.storyboardPanelVideoGenErrorByStoryboardId,
        [key]: text
      }
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    clearStoryboardPanelVideoGenError(storyboardId: number) {
      const sid = Number(storyboardId)
      if (!Number.isFinite(sid) || sid <= 0) return
      if (!this.storyboardPanelVideoGenErrorByStoryboardId[String(sid)]) return
      const next = { ...this.storyboardPanelVideoGenErrorByStoryboardId }
      delete next[String(sid)]
      this.storyboardPanelVideoGenErrorByStoryboardId = next
      this.syncStep4PlusLiveGenToCurrentScope()
    },

    /**
     * 分镜视频批量任务的统一终态迁移：成功、部分失败、失败、取消都必须从 running
     * 一次性进入 terminal，禁止遗留任一可被刷新恢复逻辑识别为工作的字段。
     */
    finalizeStoryboardVideoBatchGeneration() {
      const currentScopeKey = this.step3GenVisualScopeKey()
      const currentScope = this.step4PlusLiveGenByScope[currentScopeKey]
      const modalStoryboardIds = new Set(
        Object.keys(currentScope?.storyboardVideoGenTasksByStoryboardId || {})
      )
      this.isGeneratingStoryboardVideo = false
      this.storyboardVideoBatchError = null
      this.storyboardVideoBatchActivePromptTaskId = null
      this.storyboardVideoBatchActiveVideoTaskId = null
      const nextStatus: Record<string, SceneGenerationStatus> = {}
      for (const [key, status] of Object.entries(
        this.storyboardPanelVideoGenStatusByStoryboardId as Record<string, SceneGenerationStatus>
      )) {
        if (status === 'failed' || modalStoryboardIds.has(key)) nextStatus[key] = status
      }
      this.storyboardPanelVideoGenStatusByStoryboardId = nextStatus
      this.storyboardVideoBatchTargetStoryboardIds = []
      this.storyboardVideoBatchProgress = { completed: 0, total: 0 }
      this.syncStep4PlusLiveGenToCurrentScope()

      // null/0 旧 scope 与当前 scope 表示同一作品。它们只能作为兼容读源，不能在
      // 当前桶终态后继续保留 batch 工作凭证，否则刷新 hydrate 会把 loading 复活。
      for (const alias of scopeKeyLegacyAliases(currentScopeKey)) {
        if (alias === currentScopeKey) continue
        const legacy = this.step4PlusLiveGenByScope[alias]
        if (!legacy) continue
        const legacyModalStoryboardIds = new Set(
          Object.keys(legacy.storyboardVideoGenTasksByStoryboardId || {})
        )
        const legacyStatus = Object.fromEntries(
          Object.entries(legacy.storyboardPanelVideoGenStatusByStoryboardId || {}).filter(
            ([storyboardId, status]) =>
              status === 'failed' || legacyModalStoryboardIds.has(storyboardId)
          )
        ) as Record<string, SceneGenerationStatus>
        this.mergeStep4PlusLiveGenForScopeKey(alias, {
          isGeneratingStoryboardVideo: false,
          storyboardVideoBatchProgress: { completed: 0, total: 0 },
          storyboardVideoBatchError: null,
          storyboardVideoBatchActivePromptTaskId: null,
          storyboardVideoBatchActiveVideoTaskId: null,
          storyboardPanelVideoGenStatusByStoryboardId: legacyStatus,
          storyboardVideoBatchTargetStoryboardIds: []
        })
      }
    },

    stopStoryboardVideoBatchGeneration() {
      this.finalizeStoryboardVideoBatchGeneration()
    },

    setGeneratingStep3Visual(flag: boolean) {
      if (flag) {
        this.beginStep3FormImageTaskFollow()
      } else {
        this.step3FormImageTaskFollowCount = 0
        this.step3FormImageTaskFollowTaskIds = []
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

    removePendingExtractFormAsset(
      assetId: number,
      assetType?: PendingExtractFormAssetItem['assetType']
    ) {
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
      if (
        typeof window === 'undefined' ||
        projectId == null ||
        !Number.isFinite(projectId) ||
        projectId <= 0
      ) {
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
      this.currentProjectStatus = null
      this.currentProjectIsPublic = null
      this.currentEpisodeEditorId = null
      this.currentFinalVideoUrl = null
      this.currentPendingVideoUrl = null
      this.currentExportStatus = null
      this.currentEpisodeStatus = null
      this.formData = {
        globalSetting: {
          title: '',
          genre: '',
          style: '',
          description: '',
          aspectRatio: '16:9',
          scriptType: 'plot',
          modelStrategy: 'economy',
          creationMode: 'pro',
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
      this.manualStoryboardIds = []
      this.characterForms = {}
      this.propForms = {}
      this.sceneGenerationStatus = {}
      this.characterFormGenerationStatus = {}
      this.propFormGenerationStatus = {}
      this.step3GenVisualByScope = {}
      this.extractUiByScope = {}
      this.assetExtractFollowByScope = {}
      this.assetExtractShellLiveTaskId = null
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
        soundEffects: 'with-sound'
      }
      this.storyboardVideoAgent = {
        id: '',
        name: '',
        desc: '',
        thumbnail: ''
      }
      this.isGeneratingStoryboard = false
      this.storyboardGenerationProgress = { ...EMPTY_COUNT_PROGRESS }
      this.storyboardGenerationError = null
      this.storyboardScriptActiveTaskId = null
      this.storyboardScriptPartialFailedData = null
      this.isGeneratingStoryboardImageBatch = false
      this.storyboardImageBatchProgress = { ...EMPTY_COUNT_PROGRESS }
      this.storyboardImageBatchError = null
      this.storyboardImageBatchActiveTaskId = null
      this.storyboardImageBatchActiveImageTaskId = null
      this.storyboardPanelImageGenStatusByStoryboardId = {}
      this.storyboardImageBatchTargetStoryboardIds = []
      this.isGeneratingStoryboardVideo = false
      this.storyboardVideoBatchProgress = { ...EMPTY_COUNT_PROGRESS }
      this.storyboardVideoBatchError = null
      this.storyboardVideoBatchActivePromptTaskId = null
      this.storyboardVideoBatchActiveVideoTaskId = null
      this.storyboardPanelVideoGenStatusByStoryboardId = {}
      this.storyboardPanelVideoGenErrorByStoryboardId = {}
      this.storyboardVideoBatchTargetStoryboardIds = []
      this.isGeneratingStep3Visual = false
      this.step3FormImageTaskFollowCount = 0
      this.step3FormImageTaskFollowTaskIds = []
      this.scriptServerHtmlBaseline = ''
      this.scriptComicVersion = 0
      this.extractModalActionMode = 'start'
      this.scriptChangeLightBannerVisible = false
      this.pendingOpenContinueExtractModal = false
      this.pendingExtractFormAssets = []
      this.taskIdsWithLocalFollowPaused = []
      this.step3AssetListSyncReady = false
    },

    /**
     * Pinia persist 的 afterRestore 在 Nuxt 刷新时可能晚于步骤页 watch(immediate)。
     * 步骤页 SSE 恢复前调用，确保 step4PlusLiveGenByScope 等已灌回扁平字段。
     */
    finalizeClientHydration() {
      if (this.isHydrated) return
      const raw = this.formData?.storyScript?.content
      if (this.formData?.storyScript && typeof raw !== 'string') {
        this.formData.storyScript.content =
          raw == null ? '' : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : ''
      }
      migrateStep3GenVisualMapsFromPersist(this)
      migrateOptionalModelCodesFromPersist(this)
      migrateStoryboardVideoSettingsFromPersist(this)
      migrateLegacyLiveGenScopeKeys(this)
      migrateStep4PlusLiveGenAfterRestore(this)
      this.refreshStep3VisualGeneratingFlag()
      if (typeof window !== 'undefined') {
        const pid = Number(this.currentProjectId)
        if (Number.isFinite(pid) && pid > 0) {
          this.hydratePausedTaskFollowFromSession(pid)
        }
      }
      this.isHydrated = true
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
      'manualStoryboardIds',
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
      ;(ctx.store as ReturnType<typeof useCreationStore>).finalizeClientHydration()
    }
  }
})
