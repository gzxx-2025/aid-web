/** 与 `components/steps/接口.md` 中「通用响应格式」一致 */

export interface ApiEnvelope<T = unknown> {
  code: number
  msg: string
  data?: T
}

/**
 * 分页列表（旧版）：记录数组在根级 `rows`
 * @deprecated 新接口已改为使用 {@link ApiListEnvelopeData}
 */
export interface ApiListEnvelope<T> {
  code: number
  msg: string
  total: number
  rows: T[]
}

/**
 * 分页列表（新版）：记录数组在 `data` 中，不再使用根级 `rows`
 * 例：`{ code, msg, total, data: [ {...}, ... ] }`
 */
export interface ApiListEnvelopeData<T> {
  code: number
  msg: string
  total: number
  data: T[]
}

/** /auth/login */
export interface LoginRequest {
  loginType: 'password' | 'sms' | 'email'
  account?: string
  password?: string
  code?: string
}

export interface SocialBindItem {
  platformSource: string
  openid: string
  unionid?: string
}

export interface UserInfoFromApi {
  userId: number
  userName: string
  nickName?: string
  avatar?: string
  phonenumber?: string
  email?: string
  balance?: number
  frozenBalance?: number
  memberLevel?: string
  memberLevelName?: string
  memberExpireTime?: string
  totalRecharge?: number
  totalConsumption?: number
  isReal?: boolean
  realName?: string
  idCard?: string
}

export interface LoginData {
  token: string
  userInfo: UserInfoFromApi
  social?: SocialBindItem[]
}

/** /auth/sendCode */
export interface SendCodeRequest {
  target?: string
  codeType: 'sms' | 'email'
  scene: 'login' | 'bind' | 'unbind' | 'reset'
}

/** /auth/public-config */
export interface AuthCaptchaPublicConfig {
  enabled: boolean
  type?: 'SLIDER' | 'ROTATE' | 'WORD_IMAGE_CLICK' | 'CONCAT' | null
  reason?: string
  urlCount?: number
  localCount?: number
  applicationOk?: boolean
  imagesReady?: boolean
}

export interface AuthCodePolicyConfig {
  channel: 'sms' | 'email'
  codeLength: number
  codeExpireMinutes: number
  sendIntervalSeconds: number
  dailyLimit: number
}

/** /auth/public-config → crypto */
export interface AuthCryptoPublicConfig {
  enabled: boolean
  publicKey: string | null
  algorithm?: string
}

export interface AuthPublicConfigData {
  captcha: AuthCaptchaPublicConfig
  smsPolicy: AuthCodePolicyConfig
  emailPolicy: AuthCodePolicyConfig
  crypto?: AuthCryptoPublicConfig
  serverTime?: number
}

/** /captcha/gen（已开启） */
export interface CaptchaGenData {
  id: string
  type: string
  backgroundImage: string
  templateImage: string
  backgroundImageWidth: number
  backgroundImageHeight: number
  templateImageWidth: number
  templateImageHeight: number
}

/** /captcha/gen（未开启 / 降级） */
export interface CaptchaGenDisabledData {
  enabled: false
}

/** /captcha/check */
export interface CaptchaCheckData {
  token: string
}

/** /auth/resetPassword */
export interface ResetPasswordRequest {
  target: string
  resetType: 'phone' | 'email'
  code: string
  newPassword: string
  confirmPassword: string
}

/** 微信扫码 */
export interface WechatQrcodeData {
  sceneStr: string
  qrCodeUrl: string
  expireSeconds: number
}

export interface WechatLoginSuccessData {
  token: string
  userInfo: UserInfoFromApi
  social?: SocialBindItem[]
}

/** /realAuth/verify */
export interface RealAuthVerifyRequest {
  realName: string
  idCard: string
}

/** /realAuth/status */
export interface RealAuthStatusData {
  hasPhone: boolean
  enabled: boolean
  authType: string
  needPhone: boolean
  isReal: boolean
  realName?: string
  idCard?: string
}

/** /recharge/package/list */
export interface RechargePackageItem {
  id: number
  packageName: string
  credits: number
  originalPrice: number
  discount: number
  payPrice: number
  icon?: string
  description?: string
}

/** /recharge/order/create */
export interface RechargeOrderCreateRequest {
  packageId: number
  payType: 'alipay' | 'wxpay'
}

export interface RechargeOrderCreateData {
  orderNo: string | null
  qrCode: string | null
  pendingOrderNo: string | null
  pendingPayPrice: number | null
  pendingProductName: string | null
  pendingRemainSeconds: number | null
}

/** /recharge/order/query/{orderNo} */
export interface RechargeOrderQueryData {
  orderNo: string
  productName: string
  credits: number
  payPrice: number
  payStatus: 'pending' | 'paid' | 'failed' | 'closed' | 'refunded'
  payTime?: string
  createTime?: string
  canRepay: boolean
}

export interface RechargeOrderRow {
  orderNo: string
  productName: string
  credits: number
  payPrice: number
  payStatus: string
  payTime?: string
  createTime?: string
  canRepay: boolean
}

/** 充值订单列表 `/recharge/order/list` 响应（记录数组在 `data`，无根级 `rows`） */
export type RechargeOrderListResponse = ApiListEnvelopeData<RechargeOrderRow>

/** /api/user/project/list */
export type UserProjectType = 'movie' | 'series'

export interface UserProjectListRequest {
  projectName?: string
  projectType?: UserProjectType
  status?: 0 | 1 | 2 | 3 | 4 | 5
  pageNum?: number
  pageSize?: number
}

/** /api/public/project/video/list */
export interface PublicProjectVideoListRequest {
  projectName?: string
  pageNum?: number
  pageSize?: number
}

export interface PublicProjectVideoRow {
  id: number
  projectName: string
  coverUrl?: string | null
  finalVideoUrl?: string | null
}

/** /api/public/project/detail */
export interface PublicProjectDetailRow {
  id: number
  projectName: string
  coverUrl?: string | null
  finalVideoUrl?: string | null
  updateTime?: string | null
  projectDesc?: string | null
  videoStyleType?: string | null
}

export interface UserProjectRow {
  id: number
  projectName: string
  projectDesc?: string | null
  projectType: UserProjectType
  coverUrl?: string | null
  aspectRatio?: string | null
  scriptType?: string | null
  videoStyleType?: string | null
  videoStyleValue?: string | null
  defaultGenMode?: string | null
  defaultStoryboardMode?: string | null
  defaultCreationMode?: string | null
  status: 0 | 1 | 2 | 3 | 4 | 5
  statusReason?: string | null
  isPublic?: string | null
  createTime?: string | null
  updateTime?: string | null
  /** 剧集项目：分集数量（列表接口可能返回，用于作品卡片展示） */
  episodeCount?: number | null
}

export interface UserProjectCreateRequest {
  projectName: string
  projectDesc?: string
  projectType: UserProjectType
  coverUrl?: string
  aspectRatio?: string
  scriptType?: 'plot' | 'monologue'
  /** 官方风格为 assetName；历史/自定义可为枚举或占位字符串 */
  videoStyleType?: string
  videoStyleValue?: string
  defaultGenMode?: 'economy' | 'performance'
  defaultStoryboardMode?: 'single' | 'grid'
  defaultCreationMode?: 'i2v' | 'multi' | 'pro' | 'auto_grid'
}

/** /api/user/episode/list、create */
export interface UserEpisodeRow {
  id: number
  projectId: number
  episodeNo?: number
  comicTitle?: string | null
  comicDesc?: string | null
  status?: number
  createTime?: string | null
  updateTime?: string | null
}

export interface UserEpisodeCreateRequest {
  projectId: number
  comicTitle: string
  comicDesc?: string
  comicCoverUrl?: string
  genMode?: 'economy' | 'performance'
  storyboardMode?: 'single' | 'grid'
  creationMode?: 'i2v' | 'multi' | 'pro' | 'auto_grid'
}

/** /api/user/project/update */
export interface UserProjectUpdateRequest {
  id: number
  projectName?: string
  projectDesc?: string
  coverUrl?: string
  aspectRatio?: string
  scriptType?: 'plot' | 'monologue'
  videoStyleType?: string
  videoStyleValue?: string
  defaultGenMode?: 'economy' | 'performance'
  defaultStoryboardMode?: 'single' | 'grid'
  defaultCreationMode?: 'i2v' | 'multi' | 'pro' | 'auto_grid'
}

/** 与官方/个人资产接口 assetType 对齐 */
export type UserAssetApiType =
  | 'style'
  | 'reference_scene'
  | 'reference_character'
  | 'reference_prop'
  | 'scene'
  | 'character'
  | 'prop'
  | 'file'
  | 'pose'
  | 'effect'
  | 'expression'
  | 'mood'
  | 'camera'
  | 'other'

/** @deprecated v2.0 已废弃 /api/user/asset/query */
export type UserAssetQuerySource = 'personal' | 'official' | 'all'

/** @deprecated v2.0 已废弃，请用 official/query 或 rps/list */
export interface UserAssetQueryRequest {
  source?: UserAssetQuerySource
  projectId?: number
  episodeId?: number
  assetType?: UserAssetApiType | string
  assetName?: string
  pageNum?: number
  pageSize?: number
}

/** POST /api/user/asset/official/query */
export interface UserAssetOfficialQueryRequest {
  assetType?: UserAssetApiType | string
  assetName?: string
}

export interface UserAssetOfficialRow {
  id: number
  assetType: string
  assetName: string
  promptText?: string | null
  imageUrl?: string | null
}

/** POST /api/user/asset/custom/type/list */
export interface UserAssetCustomTypeItem {
  code: string
  name: string
  description?: string
}

/** POST /api/user/asset/custom/list */
export interface UserAssetCustomListRequest {
  assetType?: string
  keyword?: string
  pageNum?: number
  pageSize?: number
}

export interface UserAssetCustomRow {
  id: number
  assetType: string
  assetName: string
  personalityDesc?: string | null
  promptText?: string | null
  imageUrl?: string | null
  sourceType?: string | null
  sortOrder?: number | null
  remark?: string | null
  createTime?: string | null
}

/** POST /api/user/asset/custom/create */
export interface UserAssetCustomCreateRequest {
  assetType: string
  assetName: string
  personalityDesc?: string
  promptText?: string
  imageUrl?: string
  remark?: string
}

export interface UserAssetCustomCreateData {
  id: number
}

/** POST /api/user/asset/custom/detail */
export interface UserAssetCustomDetailRequest {
  id: number
}

/** POST /api/user/asset/custom/update */
export interface UserAssetCustomUpdateRequest {
  id: number
  assetName?: string
  personalityDesc?: string
  promptText?: string
  imageUrl?: string
  remark?: string
}

/** POST /api/user/asset/custom/delete */
export interface UserAssetCustomDeleteRequest {
  id: number
}

/** POST /api/user/asset/rps/list */
export interface UserAssetRpsListRequest {
  projectId?: number
  episodeId?: number
  assetType?: UserAssetApiType | string
  /** 0 未使用 1 已使用，不传查全部 */
  isUse?: number
}

/** 个人资产从表形态 */
export interface UserAssetRpsFormRow {
  id: number
  assetId?: number | null
  name: string
  imageUrl?: string | null
  promptText?: string | null
  /** v2.25.0+ 形态层解析字段（scene/prop） */
  summary?: string | null
  introduction?: string | null
  changeReason?: string | null
  /** 视觉描述状态：pending / completed */
  visualDescStatus?: string | null
  canAutoGenerateImage?: boolean | null
  promptVariantCount?: number | null
  imageCount?: number | null
  currentImageId?: number | null
  /** 0 未使用 1 已使用（列表/Tab 主图展示） */
  isUse?: number | null
  images?: UserAssetRpsFormImageRow[]
}

/** 个人资产主表（含形态列表） */
export interface UserAssetRpsRow {
  id: number
  assetType: string
  assetName: string
  forms?: UserAssetRpsFormRow[]
  createTime?: string | null
  updateTime?: string | null
  /** 若后端仍返回手动/自动标记 */
  sourceType?: number | null
  /** v2.25.0+ /rps/list 结构化主表字段（原 profileData 打散；null 字段可能不出现在 JSON） */
  introduction?: string | null
  summary?: string | null
  aliasesName?: string | null
  gender?: string | null
  ageRange?: string | null
  roleLevel?: string | null
  archetype?: string | null
  eraPeriod?: string | null
  occupation?: string | null
  costumeTier?: number | string | null
  socialClass?: string | null
  visualKeywords?: string[] | null
  personalityTags?: string[] | null
  suggestedColors?: string[] | null
  primaryIdentifier?: string | null
  expectedAppearances?: Array<{ id?: number; label?: string; name?: string }> | string | null
  availableSlots?: string[] | string | null
  hasCrowd?: number | null
  crowdDescription?: string | null
  /** 兼容旧版整包 JSON */
  profileData?: string | null
}

/** POST /api/user/asset/rps/create */
export interface UserAssetRpsCreateRequest {
  projectId: number
  episodeId: number
  name: string
  assetType: 'scene' | 'character' | 'prop' | string
}

/** POST /api/user/asset/rps/form/create */
export interface UserAssetRpsFormCreateRequest {
  projectId: number
  episodeId: number
  assetId: number
  imageUrl: string
  name?: string
  sourceType: 'upload' | 'official' | 'ai'
}

/** POST /api/user/asset/rps/form/list */
export interface UserAssetRpsFormListRequest {
  projectId?: number
  episodeId?: number
  assetType?: UserAssetApiType | string
  assetId?: number
}

/** POST /api/user/asset/rps/form/use */
export interface UserAssetRpsFormUseRequest {
  /** v2.18.6+ 推荐：图片实例ID */
  imageId?: number
  /** 兼容旧前端：等同 imageId */
  id: number
}

/** POST /api/user/asset/rps/form/unuse */
export interface UserAssetRpsFormUnuseRequest {
  /** v2.18.6+ 推荐：图片实例ID */
  imageId?: number
  /** 兼容旧前端：等同 imageId */
  id: number
}

/** 个人资产形态图片 */
export interface UserAssetRpsFormImageRow {
  id: number
  /** v2.18.6+ 创建接口可能返回 imgId（图片实例ID） */
  imgId?: number
  formId: number
  name?: string | null
  imageUrl?: string | null
  sourceType?: string | null
  isUse?: number | null
  descriptionIndex?: number | null
  promptSnapshot?: string | null
  referenceImages?: string[] | null
  /** 是否可拆分四宫格（scene 且未拆过、非拆分产物时为 true） */
  canSplit?: boolean | null
}

/** POST /api/user/asset/rps/form-image/create */
export interface UserAssetRpsFormImageCreateRequest {
  formId: number
  imageUrl: string
  name?: string
  sourceType: 'upload' | 'official' | 'ai_auto' | 'ai_manual' | 'migrate' | string
  asInUse?: boolean
}

/** POST /api/user/asset/rps/form-image/update */
export interface UserAssetRpsFormImageUpdateRequest {
  imageId: number
  name?: string
  imageUrl?: string
  descriptionIndex?: number
  promptSnapshot?: string
  referenceImages?: string[]
}

/** POST /api/user/asset/rps/form-image/list */
export interface UserAssetRpsFormImageListRequest {
  formId?: number
  projectId?: number
  episodeId?: number
  assetId?: number
  assetType?: UserAssetApiType | string
  isUse?: number
}

/** POST /api/user/asset/rps/form-image/delete */
export interface UserAssetRpsFormImageDeleteRequest {
  imageId: number
}

/** POST /api/user/asset/rps/form-image/scene/split */
export interface UserAssetRpsSceneImageSplitRequest {
  sourceImageId: number
}

export interface UserAssetRpsSceneImageSplitChildRow {
  id: number
  formId: number
  formName?: string
  assetId?: number
  assetName?: string
  assetType?: string
  projectId?: number
  episodeId?: number
  name?: string
  imageUrl?: string
  sourceType?: string
  isUse?: number
  imageStatus?: string
  sortOrder?: number
}

export interface UserAssetRpsSceneImageSplitData {
  sourceImageId: number
  assetId: number
  formId: number
  children: UserAssetRpsSceneImageSplitChildRow[]
}

/** POST /api/user/asset/rps/form-image/upscale（v2.24+ 异步高清） */
export interface UserAssetRpsFormImageUpscaleRequest {
  imageId: number
  modelCode?: string
  resolution?: string
}

/** upscale 提交后立即返回 */
export interface UserAssetRpsFormImageUpscaleSubmitData {
  taskId: number
  status: string
}

/**
 * POST /api/user/asset/rps/update-main（文档 2.5）
 * id 必填；其余按需传入。支持顶层打散（推荐）或整体 profileData JSON 字符串。
 * 后端兼容驼峰字段名。
 */
export interface UserAssetRpsUpdateMainRequest {
  id: number
  name?: string
  profileData?: string

  /** —— 角色 character（2.5.1）—— */
  gender?: string
  aliases?: string
  aliasesName?: string
  ageRange?: string
  archetype?: string
  eraPeriod?: string
  occupation?: string
  roleLevel?: string
  costumeTier?: number
  introduction?: string
  socialClass?: string
  visualKeywords?: string[]
  personalityTags?: string[]
  suggestedColors?: string[]
  primaryIdentifier?: string
  /** 子形象列表：JSON 数组字符串 */
  expectedAppearances?: string

  /** —— 场景 scene（2.5.2）—— */
  summary?: string
  /** 是否有人群：0 无 / 1 有 */
  hasCrowd?: number
  crowdDescription?: string
  /**
   * 角色可落位区域：主表须传 **JSON 数组字符串**（如 `'["位置1"]'`）
   * 勿与形态接口的数组形态混淆。
   */
  availableSlots?: string

  /** —— 道具 prop（2.5.3）复用 name / summary / introduction —— */
}

/**
 * POST /api/user/asset/rps/update-form（文档 2.6）
 * id 必填；平铺模式为增量合并。若同时传 promptText 与平铺字段，以 promptText 为准。
 */
export interface UserAssetRpsUpdateFormRequest {
  id: number
  name?: string
  changeReason?: string
  promptVersion?: string
  /** 旧模式：整包 JSON 字符串 */
  promptText?: string

  /** 场景形态（2.6.1） */
  summary?: string
  introduction?: string
  hasCrowd?: number
  crowdDescription?: string
  /** 场景形态：直接传数组，勿 stringify */
  availableSlots?: string[]

  /** 角色形态（2.6.2） */
  appearanceId?: number
  /** 外观完整视觉描述，单条字符串 */
  descriptions?: string

  /** 道具形态（2.6.3）复用 summary / introduction */

  /**
   * @deprecated 图片能力走 form-image/create|delete；无特殊需求勿传
   */
  imageUrl?: string
}

/** POST /api/user/asset/rps/delete */
export interface UserAssetRpsDeleteRequest {
  /** 资产主表 ID：仅传该字段时删除整条资产数据 */
  id?: number
  /** 形态 ID：仅传该字段时删除对应形态图 */
  formId?: number
}

/** POST /api/user/asset/rps/create-other */
export interface UserAssetRpsCreateOtherRequest {
  imageUrl: string
  name?: string
}

/** POST /api/user/asset/rps/ai/extract（开发中，字段以后端为准） */
export interface UserAssetRpsAiExtractRequest {
  projectId: number
  episodeId: number
  model: string
  imageSize?: string
  resolution?: string
  refImages?: string[]
  promptText?: string
  genType: 'multicam' | 'triview'
  /** genType=multicam 时必传，JSON 字符串 */
  multicamParams?: string
  /** 可选：提取场景/角色/道具，供后端路由（若未实现则由 promptText 区分） */
  assetType?: 'scene' | 'character' | 'prop'
}

export interface UserAssetListRequest {
  projectId?: number
  episodeId?: number
  assetType?: UserAssetApiType
  assetName?: string
}

export interface UserAssetRow {
  id: number
  projectId?: number | null
  episodeId?: number | null
  assetType: UserAssetApiType | string
  assetName: string
  personalityDesc?: string | null
  refImageUrl?: string | null
  extraImages?: string | null
  sourceType?: number | null
  createTime?: string | null
  updateTime?: string | null
}

/** /api/user/oss/remote/upload、/uploads 单条结果 */
export interface OssRemoteUploadResult {
  url: string
  fileName: string
  originalFileName: string
  fileSize: number
}

/** 点选改图：点击坐标识别 */
export interface TouchEditPointDetectRequest {
  image: string
  prompt: string
}

export interface TouchEditPointDetectData {
  name?: string
  label?: string
  objectName?: string
  data?: {
    name?: string
    label?: string
    objectName?: string
  }
}

/** @deprecated 请使用 UserAssetRpsCreateRequest + /api/user/asset/rps/create */
export interface UserAssetCreateRequest {
  projectId: number
  episodeId: number
  assetType: UserAssetApiType | string
  assetName: string
  personalityDesc?: string
  refImageUrl?: string
  extraImages?: string
  sourceType?: number
}

/** /api/user/step/status & /api/user/step/advance */
export interface CreationStepRequest {
  projectId: number
  episodeId?: number
}

export type CreationStepStatus = 'completed' | 'current' | 'waiting'

export interface CreationStepItem {
  step: number
  name: string
  status: CreationStepStatus
}

export interface CreationStepState {
  currentStep: number
  steps: CreationStepItem[]
}

export interface CreationStepAdvanceRequest extends CreationStepRequest {
  completedStep: number
}

/** /api/user/script/detailByProject */
export interface ScriptDetailByProjectRequest {
  projectId: number
  episodeId: number
}

export interface ScriptDetailRow {
  id: number
  projectId: number
  episodeId: number
  originalText?: string | null
  simplifiedText?: string | null
  isExtracted?: number
  comicVersion?: number
  status?: number
  createTime?: string | null
  updateTime?: string | null
}

/** /api/user/script/save、/api/user/script/autoSave */
export interface ScriptSaveRequest {
  projectId: number
  episodeId: number
  originalText: string
}

/** POST /api/user/script/upload（multipart） */
export interface ScriptUploadRequest {
  file: File
  projectId: number
  /** 电影传 0；剧集单集传集 ID；整篇导入不传或传 0 */
  episodeId?: number
}

/** POST /api/user/project/submit-audit、/api/user/episode/submit-audit、/api/user/project/publish */
export interface ProjectOrEpisodeIdRequest {
  id: number
}

/** /api/user/storyboard/list 分镜工作台：查询分镜列表 */
export interface UserStoryboardListRequest {
  projectId: number
  /** 剧集 ID；电影传 0 或不传（与接口文档一致） */
  episodeId?: number
}

export interface UserStoryboardListRow {
  id: number
  projectId: number
  episodeId?: number
  sortOrder?: number
  title?: string
  storyScript?: string | null
  dialogueText?: string | null
  /** 分镜图脚本（图生图 prompt），由 /generate/image-prompt 写入 */
  imagePrompt?: string | null
  /** 多参方向视频提示词，由 /generate/video-prompt 写入 */
  videoPrompt?: string | null
  /** 图生方向视频提示词，由 /generate/video-prompt-image 写入 */
  videoPromptImage?: string | null
  finalImageId?: number | null
  finalVideoId?: number | null
  finalAudioId?: number | null
  /** 主图完整 URL（is_selected=1 权威源，未设置主图时为 null） */
  finalImageUrl?: string | null
  createTime?: string | null
}

/** POST /api/user/storyboard/detail 查询分镜详情 */
export interface UserStoryboardDetailRequest {
  id: number
}

/** /api/user/storyboard/create */
export interface UserStoryboardCreateRequest {
  projectId: number
  episodeId?: number
  title?: string
}

export interface UserStoryboardCreateData {
  id: number
  projectId: number
  episodeId?: number
  sortOrder?: number
  title?: string
  createTime?: string
}

/** /api/user/storyboard/delete — 单删传 `[id]`，批删传 `[id1, id2, ...]`，单次最多 200 条 */
export interface UserStoryboardDeleteRequest {
  ids: number[]
}

/** /api/user/storyboard/update */
export interface UserStoryboardUpdateRequest {
  id: number
  title?: string
  storyScript?: string
  dialogueText?: string
  sortOrder?: number
}

/** @deprecated 请使用 UserStoryboardUpdateRequest */
export type UserStoryboardSaveRequest = UserStoryboardUpdateRequest

/** /api/user/storyboard/sort */
export interface UserStoryboardSortRequest {
  sortedIds: number[]
}

/** POST /api/user/storyboard/generate/script 批量生成分镜脚本 */
export interface StoryboardGenerateScriptRequest {
  projectId: number
  episodeId: number
  sceneIds?: number[]
  agentCode?: string
  modelCode?: string
  /** StoryboardShotDensityEnum.value，如「标准模式」 */
  mode?: string
  overwrite?: boolean
}

export interface StoryboardGenerateScriptData {
  taskId: number
  status: string
  /** 本任务总批次数（一个场次=一批） */
  totalBatches?: number
  /** 提交时固定为 0，镜头数由执行阶段决定 */
  totalShots?: number
}

/** POST /api/user/task/resume — 统一续生（按 taskId 识别任务类型） */
export interface UserTaskResumeRequest {
  taskId: number
}

export interface UserTaskResumeData {
  taskId: number
  status: string
  totalBatches?: number
  totalShots?: number
}

/** @deprecated 请使用 UserTaskResumeRequest */
export interface StoryboardGenerateScriptResumeRequest {
  taskId: number
}

export interface StoryboardGenerateScriptResumeData {
  taskId: number
  status: string
  totalBatches?: number
}

/** POST /api/user/storyboard/generate/image-prompt 批量生成分镜图脚本 */
export interface StoryboardGenerateImagePromptRequest {
  projectId: number
  episodeId: number
  storyboardIds: number[]
  agentCode?: string
  modelCode?: string
  overwrite?: boolean
}

export interface StoryboardGenerateImagePromptData {
  taskId: number
  status: string
  totalShots?: number
}

/** @deprecated 请使用 UserTaskResumeRequest */
export interface StoryboardGenerateImagePromptResumeRequest {
  taskId: number
}

export interface StoryboardGenerateImagePromptResumeData {
  taskId: number
  status: string
  totalShots?: number
}

/** POST /api/user/storyboard/generate/video-prompt 批量生成分镜视频提示词（多参方向，写 video_prompt） */
export interface StoryboardGenerateVideoPromptRequest {
  projectId: number
  episodeId: number
  /**
   * 目标分镜 ID 列表。
   * 不传或为空 → 处理本剧集全部分镜（由 overwrite 区分继续生成/重新生成）；
   * 传了 → 仅处理这些分镜且默认覆盖。
   */
  storyboardIds?: number[]
  /** 智能体编码；默认 aid_visual_director；强校验 biz_category_code=main_storyboard_video_prompt */
  agentCode?: string
  /** 文本模型；走用户传 → 项目配置 → aid_config 三级兜底 */
  modelCode?: string
  /**
   * 仅在不传 storyboardIds（全集）时生效：
   * false=继续生成（跳过已有 video_prompt）；true=重新生成（全部覆盖）。
   */
  overwrite?: boolean
}

export interface StoryboardGenerateVideoPromptData {
  taskId: number
  status: string
  totalShots?: number
}

/** @deprecated 请使用 UserTaskResumeRequest */
export interface StoryboardGenerateVideoPromptResumeRequest {
  taskId: number
}

export interface StoryboardGenerateVideoPromptResumeData {
  taskId: number
  status: string
  totalShots?: number
}

/** POST /api/user/storyboard/save/video-prompt 手动保存分镜视频提示词（v3.0，多参方向） */
export interface StoryboardSaveVideoPromptRequest {
  storyboardId: number
  videoPrompt: string
}

/** POST /api/user/storyboard/generate/video-prompt-image 批量生成图生方向分镜视频提示词（写 video_prompt_image） */
export interface StoryboardGenerateVideoPromptImageRequest {
  projectId: number
  episodeId: number
  storyboardIds?: number[]
  /** 默认 aid_visual_director_image；强校验 biz_category_code=main_storyboard_video_prompt_image */
  agentCode?: string
  /** 文本模型；走用户传 → 项目配置 → aid_config 三级兜底 */
  modelCode?: string
  /**
   * 仅在不传 storyboardIds（全集）时生效：
   * false=继续生成（跳过已有 video_prompt_image）；true=重新生成（全部覆盖）。
   */
  overwrite?: boolean
}

export type StoryboardGenerateVideoPromptImageData = StoryboardGenerateVideoPromptData

/** POST /api/user/storyboard/setFinal 设置分镜最终产物（image/video/audio） */
export interface StoryboardSetFinalRequest {
  storyboardId: number
  recordId: number
  recordType: 'image' | 'video' | 'audio'
}

/** POST /api/user/storyboard/image-prompt/resolve 解析 image_prompt 中的 @图片N[name] */
export interface StoryboardImagePromptResolveRequest {
  projectId: number
  episodeId: number
  imagePrompt?: string | null
}

export interface StoryboardImagePromptResolveData {
  referenceImageIds: number[]
  referenceImageUrls: string[]
  unresolvedNames: string[]
}

/** /api/user/storyboard/generate/media */
export type StoryboardGenerateMediaType = 'image' | 'grid' | 'i2v' | 'multi' | 'edge'

export interface StoryboardGenerateMediaParams {
  sceneIds?: string
  characterIds?: string
  propIds?: string
  poseIds?: string
  expressionIds?: string
  effectIds?: string
  sketchIds?: string
  shotSize?: string
  cameraAngle?: string
  focalLength?: string
  colorTone?: string
  lighting?: string
  exposureBlur?: string
  imagePrompt?: string
  cameraMovement?: string
  shootingTechnique?: string
  videoPrompt?: string
}

export interface StoryboardGenerateMediaRequest {
  storyboardId: number
  genType: StoryboardGenerateMediaType
  modelId: number
  userInputText?: string
  promptId?: number
  baseImageId?: number
  firstImageId?: number
  lastImageId?: number
  videoDuration?: number
  soundDesc?: string
  genParams?: StoryboardGenerateMediaParams
}

export interface StoryboardGenerateMediaData {
  id: number
  storyboardId: number
  genType: StoryboardGenerateMediaType
  fileUrl?: string | null
  modelId: number
  userInputText?: string | null
  baseImageId?: number | null
  firstImageId?: number | null
  lastImageId?: number | null
  videoDuration?: number | null
  soundDesc?: string | null
  costCredits?: number | null
  isSelected?: number | null
  taskId?: number | null
  status?: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | string
  createTime?: string | null
}

/** 分镜视频出片批量受理项 */
export interface StoryboardVideoGenerateItemResult {
  storyboardId: number
  accepted: boolean
  reason?: string | null
}

/** POST /api/user/storyboard/generate/video（v2.58+ 多参生视频，支持批量） */
export interface StoryboardVideoGenerateRequest {
  storyboardIds: number[]
  modelName?: string
  videoPrompt?: string | null
  baseImageRecordId?: number | null
  /** 单镜头临时参考图：key = @图片N[name] 的 name，value = 外部图片 URL */
  referenceOverrides?: Record<string, string> | null
  aspectRatio?: string
  durationSeconds?: number
  count?: number
  generateAudio?: boolean
  userInputText?: string | null
}

export interface StoryboardVideoGenerateData {
  taskId: number
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'PARTIAL_FAILED' | 'FAILED' | 'CANCELLED' | string
  modelName?: string
  totalShots?: number
  countPerShot?: number
  totalSubtasks?: number
  items?: StoryboardVideoGenerateItemResult[]
  /** @deprecated 旧版单镜头字段，批量接口不再返回 */
  storyboardId?: number
  count?: number
}

/** POST /api/user/storyboard/generate/video/image（图生方向，支持批量） */
export interface StoryboardVideoImageGenerateRequest {
  storyboardIds: number[]
  /** 仅单镜头生效；不传/多镜头各镜头回落 final_image_id */
  images?: string[]
  videoPrompt?: string | null
  modelName?: string
  baseImageRecordId?: number | null
  aspectRatio?: string
  durationSeconds?: number
  count?: number
  generateAudio?: boolean
  userInputText?: string | null
}

export type StoryboardVideoImageGenerateData = StoryboardVideoGenerateData

/** @deprecated 请使用 UserTaskResumeRequest */
export interface StoryboardVideoResumeRequest {
  taskId: number
}

/** @deprecated 请使用 UserTaskResumeRequest */
export interface StoryboardGenerateImageResumeRequest {
  taskId: number
}

/** 分镜图出图批量受理项 */
export interface StoryboardImageGenerateItemResult {
  storyboardId: number
  accepted: boolean
  reason?: string | null
}

/** POST /api/user/storyboard/generate/image（v2.63+ 批量父任务 + 智能体标准链路） */
export interface StoryboardGenerateImageRequest {
  storyboardIds: number[]
  agentCode?: string
  /** 仅单镜头生效；多镜头各镜头回落库内 image_prompt */
  imagePrompt?: string
  modelName?: string
  aspectRatio?: string
  size?: string
  /** 仅单镜头（storyboardIds 长度==1）生效，范围 [1,8]；多镜头恒 1 */
  count?: number
  scenario?: string
  negativePrompt?: string
  userInputText?: string
}

export interface StoryboardGenerateImageData {
  taskId: number
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'PARTIAL_FAILED' | 'FAILED' | 'CANCELLED' | string
  modelName?: string
  totalShots?: number
  countPerShot?: number
  totalSubtasks?: number
  items?: StoryboardImageGenerateItemResult[]
  /** @deprecated 旧版单镜头字段，批量接口不再返回 */
  storyboardId?: number
  imageUrl?: string | null
  providerTaskId?: string | null
  recordId?: number | null
}

/** GET /api/user/media/task/{taskId} */
export interface MediaTaskDetail {
  id: number
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | string
  ossUrl?: string | null
  imageUrl?: string | null
  originUrl?: string | null
  errorMessage?: string | null
  mediaType?: string | null
  bizTaskType?: string | null
}

/** 项目内生成内容列表 type：image 含 image/grid；video 含 i2v/multi/edge */
export type StoryboardRecordListType = 'image' | 'video'

/** @deprecated 请使用 StoryboardRecordListType */
export type StoryboardRecordListGenType = StoryboardRecordListType

/** POST /api/user/storyboard/record/list-by-storyboard 入参（v2.57.7） */
export interface StoryboardRecordListByStoryboardRequest {
  projectId: number
  /** 电影项目固定 0；剧集项目必须 > 0 */
  episodeId: number
  type: StoryboardRecordListType
}

/** POST /api/user/storyboard/record/list-by-storyboard 出参行 */
export interface StoryboardRecordListByStoryboardRow {
  id: number
  storyboardId: number
  genType: StoryboardGenerateMediaType | string
  fileUrl?: string | null
  isSelected?: number | null
  createTime?: string | null
  /** 旧 /record/list 可能返回；list-by-storyboard 不返回 */
  status?: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | string
  taskId?: number | null
}

/** 生成记录行（与 list-by-storyboard 出参一致） */
export type StoryboardRecordRow = StoryboardRecordListByStoryboardRow

/** POST /api/user/storyboard/setFinalImage 设置分镜最终图片 */
export interface StoryboardSetFinalImageRequest {
  storyboardId: number
  recordId: number
}

/** POST /api/user/storyboard/unSetFinalImage 取消分镜最终图片（v2.58） */
export type StoryboardUnSetFinalImageRequest = StoryboardSetFinalImageRequest

/** POST /api/user/storyboard/setFinalVideo 设置分镜最终视频（v2.62） */
export type StoryboardSetFinalVideoRequest = StoryboardSetFinalImageRequest

/** POST /api/user/storyboard/unSetFinalVideo 取消分镜最终视频（v2.62） */
export type StoryboardUnSetFinalVideoRequest = StoryboardSetFinalVideoRequest

/** POST /api/user/storyboard/unSetFinalAudio 取消分镜最终配音（与 unSetFinalVideo 对称） */
export type StoryboardUnSetFinalAudioRequest = StoryboardSetFinalImageRequest

/** POST /api/user/storyboard/record/delete 物理删除分镜生成记录（分镜图 / 分镜视频） */
export type StoryboardRecordDeleteRequest = StoryboardSetFinalImageRequest

/** POST /api/user/storyboard/upload-image 用户自行上传分镜图（v2.58） */
export interface StoryboardUploadImageRequest {
  projectId: number
  episodeId: number
  storyboardId: number
  imageUrl: string
}

/** POST /api/user/storyboard/upload-image 出参 data */
export interface StoryboardUploadImageData {
  id: number
  storyboardId: number
  genType: string
  fileUrl?: string | null
  modelId?: number | null
  userInputText?: string | null
  costCredits?: number | null
  isSelected?: number | null
  status?: string | null
  createTime?: string | null
}

/** POST /api/user/storyboard/generate/audio */
export interface StoryboardGenerateAudioRequest {
  storyboardId: number
  ttsText: string
  voiceLibraryId?: number
  voiceModelId?: number
  timbreCode?: string
  emotion?: string
  emotionScale?: number
  speechRate?: number
  loudnessRate?: number
  pitch?: number
  audioFormat?: string
  sampleRate?: number
}

/** GET /api/user/storyboard/audio/{taskId} 与 generate/audio 返回 */
export interface StoryboardAudioTaskVO {
  id: number
  storyboardId?: number
  audioSource?: number
  audioUrl?: string | null
  ttsText?: string
  voiceModelId?: number
  timbreCode?: string
  voiceLibraryId?: number | null
  enableLipSync?: number
  status?: string
  errorMessage?: string | null
  syncVideoUrl?: string | null
  createTime?: string | null
}

/** /api/user/model/list */
export type AiModelType = 'text' | 'image' | 'video' | 'audio'

export interface UserModelListRequest {
  modelType?: AiModelType
  /** 生成模式细分，如 image_to_video */
  generateMode?: string
}

export interface UserModelCapability {
  aspectRatioOptions?: string[]
  defaultAspectRatio?: string
  sizeOptions?: string[]
  defaultSize?: string
  defaultOutputCount?: number
  durationOptions?: number[]
  defaultDurationSeconds?: number
  allowCustomWH?: boolean
  sceneRules?: Record<string, unknown>
}

export interface UserModelListItem {
  id: number
  modelCode: string
  modelName: string
  modelType: AiModelType
  costCredits?: number | null
  priority?: number | null
  providerName?: string | null
  generateMode?: string | null
  maxOutputCount?: number | null
  defaultOutputCount?: number | null
  supportsAspectRatio?: boolean | null
  supportsDuration?: boolean | null
  supportsMultiImageInput?: boolean | null
  defaultAspectRatio?: string | null
  defaultSizeCode?: string | null
  defaultDurationSeconds?: number | null
  capability?: UserModelCapability | null
}

/** POST /api/user/model/listByFunc 批量入参 */
export interface UserModelListByFuncRequest {
  /** 单个功能编码（兼容旧调用） */
  funcCode?: string
  /** 多个功能编码，一次拉取各池模型列表 */
  funcCodes?: string[]
}

/** POST /api/user/model/listByFunc 批量出参分组 */
export interface UserModelListByFuncGroupVO {
  funcCode?: string | null
  models?: UserModelListItem[]
}

/** /api/user/asset/extract/estimate */
export type AssetExtractType = 'character' | 'scene' | 'prop'

export interface UserAssetExtractEstimateRequest {
  projectId: number
  episodeId?: number
  extractTypes?: AssetExtractType[]
}

export interface UserAssetExtractEstimateData {
  projectType?: 'movie' | 'series' | string
  extractTypes?: AssetExtractType[]
  characterTotalChars?: number
  episodeCount?: number
  characterGroupCount?: number
  characterGroupName?: string
  existingCharacterCount?: number
  scenePropTotalChars?: number
  scenePropTypes?: AssetExtractType[]
}

/** C 端：POST /aid/agent/list（按 bizCategoryCodes 分组返回） */
export interface AidAgentListRequest {
  bizCategoryCodes?: string[]
}

export interface AgentInfoVO {
  id?: number
  agentCode?: string
  name?: string
  subTitle?: string
  introduction?: string
  modelCode?: string | null
  temperature?: number | null
  topP?: number | null
  maxTokens?: number | null
  bizCategoryCode?: string
  status?: number
}

export interface AgentListGroupVO {
  bizCategoryCode?: string | null
  agents?: AgentInfoVO[]
}

/** 项目级生成配置 sceneCode（固定 15 个，见接口文档 Project Generation Config） */
export type ProjectGenConfigSceneCode =
  | 'main_character_extract'
  | 'main_scene_extract'
  | 'main_prop_extract'
  | 'main_character_form'
  | 'main_scene_form'
  | 'main_prop_form'
  | 'main_character_image'
  | 'main_scene_image'
  | 'main_prop_image'
  | 'main_character_card_image'
  | 'main_storyboard_script'
  | 'main_storyboard_stylist'
  | 'main_storyboard_video_prompt'
  | 'main_storyboard_video_prompt_image'
  | 'main_storyboard_image'

export type ProjectGenConfigSource = 'project' | 'default' | 'none'

/** POST /api/user/project/gen-config/get — 单场景配置 */
export interface ProjectGenConfigVO {
  sceneCode: ProjectGenConfigSceneCode | string
  agentCode?: string | null
  modelCode?: string | null
  resolution?: string | null
  aspectRatio?: string | null
  source: ProjectGenConfigSource
  mode?: 'economy' | 'performance' | string | null
  availableModels: UserModelListItem[]
  /** 该场景可选智能体池（agentCode 列表），主要用于后端校验 */
  agentPool?: string[]
  /** 该场景可选智能体下拉项（已按创作模式过滤），前端渲染智能体选择器的唯一数据源 */
  agentOptions?: AgentInfoVO[]
  /** 该场景是否适用于当前创作模式（当前接口仅返回适用场景，恒为 true） */
  applicable?: boolean
}

/** POST /api/user/project/gen-config/get */
export interface ProjectGenConfigQueryRequest {
  projectId: number
  /** 剧集类项目必传：按该剧集 creation_mode 解析分镜场景 */
  episodeId?: number
}

/** POST /api/user/project/gen-config/save — 单场景保存项 */
export interface ProjectGenConfigSaveItem {
  sceneCode: ProjectGenConfigSceneCode | string
  agentCode: string
  modelCode: string
  resolution?: string
  aspectRatio?: string
}

/** POST /api/user/project/gen-config/save */
export interface ProjectGenConfigSaveRequest {
  projectId: number
  configs: ProjectGenConfigSaveItem[]
}

/** POST /api/user/project/gen-config/save — 出参单项 */
export interface ProjectGenConfigSavedItem {
  sceneCode: string
  agentCode: string
  modelCode: string
  resolution?: string | null
  aspectRatio?: string | null
  source: 'project'
}

/** /api/user/asset/extract/parallel（v2026-06 modelCodes 替代 modelCode） */
export interface UserAssetExtractParallelRequest {
  projectId: number
  episodeId?: number
  extractTypes: AssetExtractType[]
  /** key=extractType，value=agentCode（如 aid_prop_extractor） */
  agentCodes: Partial<Record<AssetExtractType, string>> & Record<string, string>
  /** key=extractType，value=modelCode；未传的 type 走后端 3 级兜底（项目配置 → aid_config） */
  modelCodes?: Partial<Record<AssetExtractType, string>> & Record<string, string>
  overwrite?: boolean
}

/** POST /api/user/asset/extract/cancel — 停止提取/形态父任务等（见接口文档 v2.25+ / v2.28+） */
export interface UserAssetExtractCancelRequest {
  taskId: number
}

/** @deprecated 请使用 UserTaskResumeRequest */
export interface UserAssetExtractResumeRequest {
  taskId: number
}

export interface UserAssetExtractResumeData {
  taskId: number
  status: string
}

/** 提取/形态父任务同步返回（form_generate_batch / form_image_batch） */
export interface AssetExtractTaskSyncVO {
  taskId?: number
  status?: string
  totalCount?: number
  assets?: unknown | null
  resultData?: string | null
  errorMessage?: string | null
}

/** /api/user/asset/extract/form/generate（v2.28+ 父任务；三类资产均必填 agentCode） */
export interface UserAssetExtractFormGenerateRequest {
  assetIds: number[]
  /** 必填；biz_category_code：character→main_character_form / scene→main_scene_form / prop→main_prop_form */
  agentCode: string
  /** 文本模型；不传用智能体默认 modelCode */
  modelCode?: string
}

/** @deprecated v2.28+ 同步仅返回父任务，见 AssetExtractTaskSyncVO */
export interface UserAssetExtractFormGenerateTaskItem {
  assetId: number
  taskId: number
  status?: string
}

/** @deprecated 失败项在 SSE complete / resultData，不在同步响应 */
export interface UserAssetExtractFormGenerateFailedAsset {
  assetId: number
  message: string
}

export type UserAssetExtractFormGenerateData = AssetExtractTaskSyncVO & {
  taskIds?: number[]
  tasks?: UserAssetExtractFormGenerateTaskItem[]
  failedAssets?: UserAssetExtractFormGenerateFailedAsset[]
}

/** /api/user/asset/extract/form/generate-image（v2026-06 新增 resolution / aspectRatio，走 3 级兜底） */
export interface UserAssetExtractFormGenerateImageRequest {
  formIds: number[]
  agentCode: string
  /** 不传走项目配置兜底；传则须为 image 类型模型 */
  modelCode?: string
  /** 清晰度档位（如 1K / 2K / 4K）；不传走项目配置兜底 */
  resolution?: string
  /** 图片比例（如 16:9 / 1:1）；不传走项目配置兜底 */
  aspectRatio?: string
}

export interface UserAssetExtractFormGenerateImageTaskItem {
  formId: number
  taskId: number
  status?: string
}

export interface UserAssetExtractFormGenerateImageFailedForm {
  formId: number
  message: string
}

export type UserAssetExtractFormGenerateImageData = AssetExtractTaskSyncVO & {
  taskIds?: number[]
  tasks?: UserAssetExtractFormGenerateImageTaskItem[]
  failedForms?: UserAssetExtractFormGenerateImageFailedForm[]
}

/** POST /api/user/asset/extract/form/generate-card-image（v2026-06 纯批量 imageIds） */
export interface UserAssetExtractFormGenerateCardImageRequest {
  /** 白底主图 aid_role_prop_scene_form_image.id 列表，须 sourceType=ai_auto */
  imageIds: number[]
  /** 智能体编码，biz_category=main_character_card_image */
  agentCode: string
  /** 图片模型；不传走项目配置兜底 */
  modelCode?: string
  /** 清晰度档位（如 1K / 2K / 4K）；不传走项目配置兜底 */
  resolution?: string
  /** 图片比例（设定卡默认 21:9）；不传走项目配置兜底 */
  aspectRatio?: string
}

export type UserAssetExtractFormGenerateCardImageData = AssetExtractTaskSyncVO

/** 通用任务（/api/user/task/list|status 与提交任务返回） */
export type UserTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | string

export interface UserTaskRow {
  id: number
  projectId?: number
  episodeId?: number
  userId?: number
  taskType?: string
  status: UserTaskStatus
  inputSnapshot?: string | null
  resultData?: string | null
  errorMessage?: string | null
  totalCount?: number
  modelCode?: string | null
  createTime?: string | null
  updateTime?: string | null
}

export interface UserTaskListRequest {
  projectId?: number
  taskType?: string
  status?: UserTaskStatus
}

/** /api/user/task/detail */
export interface UserTaskDetailRequest {
  taskId: number
}

/** 停止/取消进行中的任务：POST /api/user/task/cancel（与后端约定，未上线时可能 404） */
export interface UserTaskCancelRequest {
  taskId: number
}

export interface UserTaskDetailData {
  taskId: number
  projectId?: number
  episodeId?: number
  taskType?: string
  status: UserTaskStatus
  inputSnapshot?: string | null
  resultData?: string | null
  errorMessage?: string | null
  totalCount?: number
  modelCode?: string | null
  createTime?: string | null
  updateTime?: string | null
}

/** 官方只读参数词库：分类列表 /api/user/prompt/official/category/list */
export interface OfficialPromptCategoryItem {
  categoryCode: string
  categoryName: string
  itemCount?: number
  sortOrder?: number
}

/** 官方只读参数词库：词条列表 /api/user/prompt/official/item/list */
export interface OfficialPromptItemListRequest {
  categoryCode?: string
  categoryCodes?: string[]
  keyword?: string
}

export interface OfficialPromptItem {
  id: number
  categoryCode: string
  categoryName?: string
  itemName?: string
  promptText?: string
  promptTextEn?: string
  coverUrl?: string
  sortOrder?: number
  remark?: string
}

/** 官方只读参数词库：词条详情 /api/user/prompt/official/item/detail */
export interface OfficialPromptItemDetailRequest {
  id: number
}

/** 枚举字典：查询枚举 /api/user/dict/enum/list */
export interface EnumDictListRequest {
  enumTypes: string[]
}

export interface EnumDictListItem {
  value: string
  desc: string
}

export interface EnumDictGroup {
  enumType: string
  items: EnumDictListItem[]
}

/** POST /api/user/asset/extract/form/generate-multi-view-image（v2.35.0 多机位形态生图） */
export interface UserAssetExtractFormGenerateMultiViewImageRequest {
  formId: number
  imageUrl: string
  anglePrompt: string
  modelCode: string
  aspectRatio?: string
}

export interface UserAssetExtractFormGenerateMultiViewImageData {
  taskId: number
  status: string
}

/** @deprecated v2.62 已迁移至 UserStoryboardGenerateMultiViewGridImageRequest */
export interface UserAssetExtractStoryboardGenerateMultiViewGridImageRequest {
  formId: number
  imageUrl: string
  /** 必须 1 或 9 个元素，每个非空 */
  angles: string[]
  modelCode: string
  aspectRatio?: string
}

/** @deprecated v2.62 已迁移至 UserStoryboardGenerateMultiViewGridImageData */
export interface UserAssetExtractStoryboardGenerateMultiViewGridImageData {
  taskId: number
  status: string
}

/** POST /api/user/storyboard/generate/multi-view-grid-image（v2.62 分镜机位生图，angles 长度 1 或 9） */
export interface UserStoryboardGenerateMultiViewGridImageRequest {
  storyboardId: number
  imageUrl: string
  /** 必须 1 或 9 个元素，每个非空 */
  angles: string[]
  modelCode: string
  aspectRatio?: string
}

export interface UserStoryboardGenerateMultiViewGridImageData {
  taskId: number
  status: string
}

/** storyboard_multi_view_image / storyboard_multi_grid_image SSE complete / resultData */
export interface StoryboardMultiViewGridCompleteData {
  storyboardId?: number
  recordId?: number
  imageUrl?: string
  genType?: string
  anglesCount?: number
  aspectRatio?: string
}

/** 形态图片创作模式：edit=编辑图片（必传参考图）；chat=对话作图（参考图可选） */
export type FormCreationImageGenMode = 'edit' | 'chat'

/** POST /api/user/asset/extract/form/generate-creation-image（编辑图片 / 对话作图） */
export interface UserAssetExtractFormGenerateCreationImageRequest {
  formId: number
  genMode: FormCreationImageGenMode
  /** edit 必传 ≥1 张；chat 可省略或空数组（纯文生图） */
  referenceImages?: string[]
  prompt: string
  modelCode: string
  aspectRatio: string
  size: string
  imageCount: number
}

export interface UserAssetExtractFormGenerateCreationImageData {
  taskId: number
  status: string
}

/** @deprecated 请改用 UserAssetExtractFormGenerateCreationImageRequest */
export type UserAssetExtractFormGenerateEditImageRequest =
  UserAssetExtractFormGenerateCreationImageRequest

/** @deprecated 请改用 UserAssetExtractFormGenerateCreationImageData */
export type UserAssetExtractFormGenerateEditImageData =
  UserAssetExtractFormGenerateCreationImageData

/** generate-creation-image SSE complete 事件 data 结构 */
export interface EditImageCompleteData {
  formId?: number
  storyboardId?: number
  imageCount?: number
  imageIds?: number[]
  recordIds?: number[]
  items?: Array<{ imageId: number; imageUrl: string; recordId?: number }>
  aspectRatio?: string
  size?: string
  failCount?: number
  failedItems?: Array<{ index: number; message: string }>
}

/** POST /api/user/storyboard/generate/edit-image（v2.57 分镜编辑图/对话作图） */
export interface UserStoryboardGenerateEditImageRequest {
  storyboardId: number
  referenceImage: string
  prompt: string
  modelCode: string
  aspectRatio: string
  size: string
  imageCount: number
}

export interface UserStoryboardGenerateEditImageData {
  taskId: number
  status: string
}

/** POST /api/user/storyboard/generate/upscale（v2.57 分镜图高清） */
export interface UserStoryboardGenerateUpscaleRequest {
  genRecordId: number
  modelCode: string
  resolution?: string
}

export interface UserStoryboardGenerateUpscaleData {
  taskId: number
  status: string
}

/** storyboard_image_upscale SSE complete / resultData */
export interface StoryboardUpscaleCompleteData {
  genRecordId?: number
  recordId?: number
  imageUrl?: string
  imageId?: number
}

/** @deprecated v2.0 起后端已下线，前端仅做兼容映射保留 */
export interface UserPromptGetDataRequest {
  category?: string
  officialOnly?: boolean
  status?: string
}

/** @deprecated v2.0 起后端已下线，前端仅做兼容映射保留 */
export interface PromptLibItem {
  id: number
  promptType: string
  promptName?: string
  promptContent?: string
  coverUrl?: string
  sortOrder?: number
  status?: string
}

/** @deprecated v2.0 起后端已下线，前端仅做兼容映射保留 */
export interface PromptEnumItem {
  enumType: string
  value: string
  desc: string
  category?: string
}

/** @deprecated v2.0 起后端已下线，前端仅做兼容映射保留 */
export interface UserPromptGetDataData {
  promptLibList?: PromptLibItem[]
  enumList?: PromptEnumItem[]
}

/** POST /api/user/voice-library/tags — C 端一次性拉取音色筛选字典 */
export interface VoiceTagItem {
  tagCode: string
  tagName: string
}

export interface VoiceEnumItem {
  code: string
  name: string
}

export interface VoiceTagBundleData {
  characterTypes?: VoiceTagItem[]
  voiceStyles?: VoiceTagItem[]
  toneTags?: VoiceTagItem[]
  emotionTags?: VoiceTagItem[]
  enums?: Record<string, VoiceEnumItem[]>
}
