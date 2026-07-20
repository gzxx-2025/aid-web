// 用户相关类型
export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  role: 'admin' | 'user'
}

// 应用状态类型
export interface AppState {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
}

// 创作流程步骤
export type CreationStep =
  | 'global-setting'
  | 'story-script'
  | 'scene-character'
  | 'storyboard-script'
  | 'storyboard-video'
  | 'dubbing'
  | 'preview'

// 作品类型
export interface Work {
  id: string
  title: string
  description: string
  coverImage: string
  author: User
  createdAt: string
  updatedAt: string
  status: 'draft' | 'in-progress' | 'completed'
  views: number
  likes: number
  tags: string[]
  currentStep: CreationStep
}

// 资产类型
export type AssetType = 'character' | 'scene' | 'prop' | 'bgm' | 'voice'

export interface Asset {
  id: string
  name: string
  type: AssetType
  thumbnail: string
  createdAt: string
  isPublic: boolean
  author: User
}

// 步骤数据
export interface GlobalSettingData {
  // 基础信息
  title: string
  genre: string
  style: string
  description: string
  // 画面比例
  aspectRatio: '16:9' | '9:16' | '4:3' | '3:4' | '1:1' | '21:9'
  // 剧本类型（ScriptTypeEnum）
  scriptType: 'plot' | 'monologue'
  // 模型策略（GenModeEnum）
  modelStrategy: 'economy' | 'performance'
  // 创作模式（CreationModeEnum）
  creationMode: 'i2v' | 'multi' | 'pro' | 'auto_grid'
  // 画面风格
  selectedStyle: {
    id: string
    name: string
    thumbnail: string
    /** 与 official/query 的 assetName 一致，提交作品时写入 videoStyleType */
    assetName?: string
    /** 与 official/query 的 promptText 一致，提交作品时写入 videoStyleValue */
    promptText?: string | null
  } | null
  // 我的风格库
  myStyles: Array<{
    id: string
    name: string
    thumbnail: string
  }>
}

export interface StoryScriptData {
  content: string
}

export interface SceneCharacterData {
  characters: string[]
  scenes: string[]
  props: string[]
}

export interface StoryboardScriptData {
  panels: StoryboardPanel[]
}

export interface StoryboardPanel {
  id: string
  title: string
  description?: string
  duration?: number
  images?: any[]
  /** 列表接口 `finalImageUrl`，与 `images` 中 isSelected=1 的主图一致 */
  finalImageUrl?: string | null
  scriptContent?: string
  /** 工作台 `dialogueText`，同步到配音步骤 `dialogue` */
  dialogueText?: string | null
}

/** 分镜视频单条（第五步） */
export interface StoryboardVideoPanel {
  id: string
  title: string
  /** 生视频模式：如 多参 */
  videoMode?: string
  /** 详情描述 */
  detailDescription?: string
  /** 右侧保存的视频列表（编辑分镜适配弹窗内同步） */
  videos?: Array<{ id: string; url?: string; title?: string; [key: string]: any }>
  /** 自动生成中 */
  generating?: boolean
  /** 自动生成失败时的错误信息，有则展示「重新生成」 */
  generateError?: string
}

export interface StoryboardVideoData {
  panels: StoryboardVideoPanel[]
}

/** 配音对口型单条（分镜配音 N） */
export interface DubbingPanel {
  id: string
  /** 如：分镜配音1: 分镜1-1 */
  title: string
  /** 台词 */
  dialogue?: string
  /** 配音类型：旁白/画外音 等 */
  dubbingType?: string
  /** 发言角色 */
  speakerRole?: string
  /** 未配音 | 已配音 */
  status?: 'pending' | 'done'
  /** 编辑分镜配音：配音音色展示名 */
  dubbingVoiceName?: string
  /** 音色头像（选音色弹窗） */
  dubbingVoiceAvatarUrl?: string
  /** 情感：中性、高兴 等 */
  dubbingEmotion?: string
  /** 是否对口型 */
  dubbingLipSync?: boolean
  /** 用户已在弹窗内确认「设置分镜配音对口型」（与 status/dialogue 一起用于展示「取消设置」） */
  storyboardDubbingConfirmed?: boolean
  /** 用户本地上传配音文件经 OSS 后的地址（对口型流程用） */
  dubbingUploadedAudioUrl?: string
  /** 配音生成后的对口型视频地址（优先于分镜原视频展示） */
  dubbingLipSyncVideoUrl?: string
  /** 当前设为对口型的条目标识：'__source__'=原分镜视频，否则=生成记录的 id，用于区分同 URL 的多条 */
  dubbingLipSyncKey?: string
  /** 本分镜的生成历史（弹窗右侧列表），批量生成与弹窗内「开始配音」均追加到此列表 */
  dubbingGenHistory?: Array<{
    id: string
    url: string
    title: string
    dialogue: string
    voiceName: string
    emotion: string
  }>
}

export interface DubbingData {
  voiceActors: string[]
  bgm: string
  /** 配音对口型列表（与分镜脚本/分镜视频一一对应） */
  panels: DubbingPanel[]
}

// 作品数据
export interface WorkData {
  globalSetting: GlobalSettingData
  storyScript: StoryScriptData
  sceneCharacter: SceneCharacterData
  storyboardScript: StoryboardScriptData
  storyboardVideo: StoryboardVideoData
  dubbing: DubbingData
}

// 计数器状态
export interface CounterState {
  count: number
}
