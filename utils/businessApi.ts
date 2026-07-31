/**
 * 业务接口封装，路径与入参与 `components/steps/接口.md` 对齐。
 * 请求经 `utils/api.ts` 走 `/api` 代理，需携带的 Token 由拦截器从 localStorage `token` 注入。
 */
import {
  request,
  resolveClientApiUrl,
  buildUserApiAuthHeaders,
  isInsufficientBalanceMessage,
  openRechargeModalFromInsufficientBalance
} from '~/utils/api'
import { isMergedAssetOfficial } from '~/utils/mergedAssetSource'
import { chunkRpsDeleteIds, mergeRpsDeleteBatchResults } from '~/utils/rpsDeleteBatch'
import { normalizeUpdateMainRequest } from '~/utils/rpsUpdateMainPayload'
import type {
  ApiEnvelope,
  ApiListEnvelope,
  ApiListEnvelopeData,
  LoginRequest,
  LoginData,
  UserInfoFromApi,
  UserBalanceFromApi,
  SendCodeRequest,
  AuthPublicConfigData,
  WechatNotifyPreferenceData,
  ResetPasswordRequest,
  WechatQrcodeData,
  WechatLoginCheckData,
  WechatLoginSuccessData,
  RealAuthVerifyRequest,
  RealAuthStatusData,
  RechargePackageItem,
  RechargeOrderCreateRequest,
  RechargeOrderCreateData,
  RechargeOrderQueryData,
  RechargeOrderRow,
  RechargeOrderListResponse,
  CreditConsumeRecordRow,
  CreditConsumeListResponse,
  UserProjectCreateRequest,
  PublicProjectVideoListRequest,
  PublicProjectVideoRow,
  PublicProjectDetailRow,
  UserProjectUpdateRequest,
  UserEpisodeCreateRequest,
  UserEpisodeRow,
  UserEpisodeDetailRequest,
  UserEpisodeUpdateRequest,
  UserEpisodeDeleteRequest,
  UserProjectListRequest,
  UserProjectRow,
  UserAssetListRequest,
  UserAssetRow,
  UserAssetOfficialQueryRequest,
  UserAssetOfficialRow,
  UserAssetCustomTypeItem,
  UserAssetCustomListRequest,
  UserAssetCustomRow,
  UserAssetCustomCreateRequest,
  UserAssetCustomCreateData,
  UserAssetCustomDetailRequest,
  UserAssetCustomUpdateRequest,
  UserAssetCustomDeleteRequest,
  MergedAssetPageRequest,
  MergedAssetVO,
  AssetCenterCategoryTreeVO,
  AssetCenterListRequest,
  AssetCenterItemVO,
  AssetCenterDetailRequest,
  AssetCenterDetailVO,
  UserAssetRpsListRequest,
  UserAssetRpsRow,
  RoleVoiceBindingVO,
  UserAssetRpsCreateRequest,
  UserAssetRpsFormListRequest,
  UserAssetRpsFormRow,
  UserAssetRpsFormCreateRequest,
  UserAssetRpsFormUseRequest,
  UserAssetRpsFormUseBatchData,
  UserAssetRpsFormUnuseRequest,
  UserAssetRpsFormImageCreateRequest,
  UserAssetRpsFormImageUpdateRequest,
  UserAssetRpsFormImageListRequest,
  UserAssetRpsFormImageDeleteRequest,
  UserAssetRpsSceneImageSplitRequest,
  UserAssetRpsSceneImageSplitData,
  UserAssetRpsFormImageUpscaleRequest,
  UserAssetRpsFormImageUpscaleSubmitData,
  UserAssetRpsFormImageRow,
  UserAssetRpsUpdateFormRequest,
  UserAssetRpsUpdateMainRequest,
  UserAssetRpsDeleteRequest,
  UserAssetRpsDeleteBatchData,
  UserAssetRpsCreateOtherRequest,
  UserAssetRpsAiExtractRequest,
  OssRemoteUploadResult,
  TouchEditPointDetectRequest,
  TouchEditPointDetectData,
  CreationStepRequest,
  CreationStepState,
  CreationStepAdvanceRequest,
  ScriptDetailByProjectRequest,
  ScriptDetailRow,
  ScriptSaveRequest,
  ScriptUploadRequest,
  ProjectOrEpisodeIdRequest,
  UserProjectPublishRequest,
  UserStoryboardCreateData,
  UserStoryboardCreateRequest,
  UserStoryboardDeleteRequest,
  UserStoryboardListRequest,
  UserStoryboardListRow,
  UserStoryboardDetailRequest,
  StoryboardGenerateImagePromptRequest,
  StoryboardGenerateImagePromptData,
  StoryboardGenerateImageWithPromptRequest,
  StoryboardGenerateImageWithPromptData,
  StoryboardGenerateImagePromptResumeRequest,
  StoryboardGenerateImagePromptResumeData,
  StoryboardGenerateVideoPromptRequest,
  StoryboardGenerateVideoPromptData,
  StoryboardGenerateVideoWithPromptRequest,
  StoryboardGenerateVideoWithPromptData,
  StoryboardGenerateGridVideoWithPromptRequest,
  StoryboardGenerateGridVideoWithPromptData,
  StoryboardGenerateVideoPromptImageRequest,
  StoryboardGenerateVideoPromptImageData,
  StoryboardGenerateVideoPromptGridRequest,
  StoryboardGenerateVideoPromptGridData,
  StoryboardGenerateVideoPromptResumeRequest,
  StoryboardGenerateVideoPromptResumeData,
  StoryboardSaveVideoPromptRequest,
  StoryboardSetFinalRequest,
  StoryboardImagePromptResolveRequest,
  StoryboardImagePromptResolveData,
  StoryboardImagePromptReferenceItem,
  StoryboardAudioReferenceItem,
  ReferenceAudioUploadRequest,
  ReferenceAudioVO,
  ReferenceAudioDeleteRequest,
  UserModelListByFuncRequest,
  StoryboardGenerateMediaData,
  StoryboardGenerateMediaRequest,
  StoryboardVideoGenerateData,
  StoryboardVideoGenerateRequest,
  StoryboardVideoImageGenerateData,
  StoryboardVideoImageGenerateRequest,
  StoryboardVideoEdgeGenerateData,
  StoryboardVideoEdgeGenerateRequest,
  StoryboardVideoGridGenerateData,
  StoryboardVideoGridGenerateRequest,
  StoryboardVideoResumeRequest,
  StoryboardGenerateImageResumeRequest,
  StoryboardGenerateImageRequest,
  StoryboardGenerateImageData,
  UserStoryboardUpdateRequest,
  UserStoryboardSortRequest,
  StoryboardGenerateScriptRequest,
  StoryboardGenerateScriptData,
  StoryboardGenerateScriptResumeRequest,
  StoryboardGenerateScriptResumeData,
  StoryboardRecordListByStoryboardRequest,
  StoryboardRecordRow,
  StoryboardSetFinalImageRequest,
  StoryboardSetFinalImageBatchData,
  StoryboardRecordDeleteRequest,
  StoryboardUnSetFinalImageRequest,
  StoryboardSetFinalVideoRequest,
  StoryboardUnSetFinalVideoRequest,
  StoryboardUnSetFinalAudioRequest,
  StoryboardUploadRequest,
  StoryboardUploadData,
  StoryboardUploadImageRequest,
  StoryboardUploadImageData,
  StoryboardUploadVideoRequest,
  StoryboardUploadVideoData,
  StoryboardGenerateAudioRequest,
  StoryboardAudioTaskVO,
  StoryboardLipSyncRequest,
  StoryboardLipSyncAcceptVO,
  StoryboardLipSyncBatchRequest,
  StoryboardLipSyncBatchAcceptVO,
  StoryboardAudioBatchRequest,
  StoryboardAudioBatchAcceptVO,
  StoryboardGenerateDubbingRequest,
  StoryboardDubbingTaskVO,
  StoryboardComposeRequest,
  ComposeAcceptResult,
  ComposeStatusRequest,
  ComposeStatusResult,
  EpisodeExportRequest,
  EpisodeExportResult,
  EpisodeExportStatusRequest,
  EpisodeExportStatusResult,
  EpisodeTimelineGetRequest,
  EpisodeTimelineSaveRequest,
  EpisodeTimelineResult,
  EpisodeSegmentVideosRequest,
  EpisodeSegmentVideosResult,
  EpisodeSegmentZipDownloadRequest,
  EpisodeFinalVideoDownloadRequest,
  ScriptSplitPreviewRequest,
  ScriptSplitPreviewVO,
  ScriptSplitConfirmVO,
  InviteCodeCheckRequest,
  InviteCodeCheckVO,
  InviteInfoVO,
  InviteUsersRequest,
  InvitedUserVO,
  InviteRebatesRequest,
  InviteRebateItemVO,
  VoicePreviewRequest,
  VoicePreviewResult,
  UserAssetExtractEstimateData,
  UserAssetExtractEstimateRequest,
  UserAssetExtractFormGenerateRequest,
  UserAssetExtractFormGenerateData,
  UserAssetExtractFormGenerateImageRequest,
  UserAssetExtractFormGenerateImageData,
  UserAssetExtractFormGenerateCardImageRequest,
  UserAssetExtractFormGenerateCardImageData,
  UserAssetExtractFormGenerateMultiViewImageRequest,
  UserAssetExtractFormGenerateMultiViewImageData,
  UserAssetExtractStoryboardGenerateMultiViewGridImageRequest,
  UserAssetExtractStoryboardGenerateMultiViewGridImageData,
  UserAssetExtractFormGenerateEditImageRequest,
  UserAssetExtractFormGenerateEditImageData,
  UserAssetExtractFormGenerateCreationImageRequest,
  UserAssetExtractFormGenerateCreationImageData,
  UserStoryboardGenerateEditImageRequest,
  UserStoryboardGenerateEditImageData,
  UserStoryboardGenerateUpscaleRequest,
  UserStoryboardGenerateUpscaleData,
  UserStoryboardGenerateMultiViewGridImageRequest,
  UserStoryboardGenerateMultiViewGridImageData,
  UserAssetExtractCancelRequest,
  UserAssetExtractResumeRequest,
  UserAssetExtractResumeData,
  UserAssetExtractParallelRequest,
  ProjectGenConfigQueryRequest,
  ProjectGenConfigVO,
  ProjectGenConfigSaveRequest,
  ProjectGenConfigSavedItem,
  AidAgentListRequest,
  AgentListGroupVO,
  UserModelListItem,
  UserModelListByFuncGroupVO,
  UserModelListRequest,
  UserTaskListRequest,
  UserTaskDetailRequest,
  UserTaskCancelRequest,
  UserTaskCancelBatchRequest,
  UserTaskCancelBatchData,
  UserTaskResumeRequest,
  UserTaskResumeData,
  UserTaskRow,
  UserTaskDetailData,
  OfficialPromptCategoryItem,
  OfficialPromptItemListRequest,
  OfficialPromptItem,
  OfficialPromptItemDetailRequest,
  EnumDictListRequest,
  EnumDictGroup,
  VoiceTagBundleData,
  PaginatedListResult,
  HomeBannerListRequest,
  HomeBannerVO,
  PublicBillingDetailRequest,
  PublicBillingDetailData,
  UserFaqListRequest,
  UserFaqListItem,
  UserFaqDetailRequest,
  UserFaqDetail
} from '~/types/business-api'

/** 分页列表默认每页条数（与产品约定一致） */
export const API_DEFAULT_PAGE_SIZE = 20

function unwrap<T>(res: ApiEnvelope<T>): T {
  return res.data as T
}

let authPublicConfigInflight: Promise<AuthPublicConfigData> | null = null

/**
 * 3.0 查询 C 端公开配置（验证码策略、短信/邮箱发码策略等）。
 * 启动插件与登录页会在冷启动时并发调用，做 in-flight 合并避免重复请求。
 */
export function authPublicConfig(): Promise<AuthPublicConfigData> {
  if (authPublicConfigInflight) return authPublicConfigInflight
  const promise = request
    .post<ApiEnvelope<AuthPublicConfigData>>('/auth/public-config', {})
    .then((res) => unwrap(res))
    .finally(() => {
      if (authPublicConfigInflight === promise) {
        authPublicConfigInflight = null
      }
    })
  authPublicConfigInflight = promise
  return promise
}

/** 1. 统一登录（开启行为验证码时由请求拦截器或显式 headers 携带 captcha-token） */
export async function authLogin(body: LoginRequest, captchaToken?: string): Promise<LoginData> {
  const headers = captchaToken ? { 'captcha-token': captchaToken } : undefined
  // 邀请码仅注册瞬间生效；空串不传，避免后端收到空白字段
  const inviteCode = String(body.inviteCode || '').trim()
  const payload: LoginRequest = { ...body }
  if (inviteCode) payload.inviteCode = inviteCode
  else delete payload.inviteCode
  const res = await request.post<ApiEnvelope<LoginData>>('/auth/login', payload, { headers })
  return unwrap(res)
}

/** 2. 退出登录 */
export async function authLogout(): Promise<void> {
  await request.post<ApiEnvelope>('/auth/logout')
}

/** 3. 发送验证码（开启行为验证码时由请求拦截器或显式 headers 携带 captcha-token） */
export async function authSendCode(body: SendCodeRequest, captchaToken?: string): Promise<void> {
  const headers = captchaToken ? { 'captcha-token': captchaToken } : undefined
  await request.post<ApiEnvelope>('/auth/sendCode', body, { headers })
}

/** 6. 找回密码 */
export async function authResetPassword(body: ResetPasswordRequest): Promise<void> {
  await request.post<ApiEnvelope>('/auth/resetPassword', body)
}

/** 微信：获取登录二维码（可选携带 inviteCode，仅新用户扫码注册时绑定） */
export async function wechatLoginQrcode(inviteCode?: string): Promise<WechatQrcodeData> {
  const code = String(inviteCode || '').trim()
  const res = await request.get<ApiEnvelope<WechatQrcodeData>>(
    '/auth/wechat/qrcode',
    code ? { inviteCode: code } : undefined
  )
  return unwrap(res)
}

/** 微信：检查登录状态（轮询） */
export async function wechatLoginCheck(sceneStr: string): Promise<ApiEnvelope<WechatLoginCheckData>> {
  return request.get<ApiEnvelope<WechatLoginCheckData>>('/auth/wechat/check', { sceneStr })
}

/** 微信：获取绑定二维码（需登录） */
export async function wechatBindQrcode(): Promise<WechatQrcodeData> {
  const res = await request.get<ApiEnvelope<WechatQrcodeData>>('/auth/wechat/bind/qrcode')
  return unwrap(res)
}

/** 微信：检查绑定状态 */
export async function wechatBindCheck(sceneStr: string): Promise<ApiEnvelope<unknown>> {
  return request.get<ApiEnvelope<unknown>>('/auth/wechat/bind/check', { sceneStr })
}

/** 实名认证 */
export async function realAuthVerify(body: RealAuthVerifyRequest): Promise<unknown> {
  const res = await request.post<ApiEnvelope<unknown>>('/realAuth/verify', body)
  return unwrap(res)
}

export async function realAuthStatus(): Promise<RealAuthStatusData> {
  const res = await request.get<ApiEnvelope<RealAuthStatusData>>('/realAuth/status')
  return unwrap(res)
}

let userProfileInflight: Promise<UserInfoFromApi> | null = null

/**
 * 查询个人信息 POST /api/user/profile。
 * 刷新时多个入口（auth-sync 插件、页面守卫、余额组件）会并发拉取，
 * in-flight 合并保证同一时刻只有一个请求；不做 TTL 缓存，余额等实时字段始终以最新响应为准。
 */
export function userProfile(): Promise<UserInfoFromApi> {
  if (userProfileInflight) return userProfileInflight
  const promise = request
    .post<ApiEnvelope<UserInfoFromApi>>('/api/user/profile', {})
    .then((res) => unwrap(res))
    .finally(() => {
      if (userProfileInflight === promise) {
        userProfileInflight = null
      }
    })
  userProfileInflight = promise
  return promise
}

let userBalanceInflight: Promise<UserBalanceFromApi> | null = null

/**
 * 快捷查询账户积分 POST /api/user/balance。
 * 用于生成任务终态后刷新侧栏积分；in-flight 合并避免并发重复请求。
 */
export function userBalance(): Promise<UserBalanceFromApi> {
  if (userBalanceInflight) return userBalanceInflight
  const promise = request
    .post<ApiEnvelope<UserBalanceFromApi>>('/api/user/balance', {})
    .then((res) => unwrap(res))
    .finally(() => {
      if (userBalanceInflight === promise) {
        userBalanceInflight = null
      }
    })
  userBalanceInflight = promise
  return promise
}

/** 查询微信推送偏好 POST /api/user/wechat-notify/preference */
export async function wechatNotifyPreference(): Promise<WechatNotifyPreferenceData> {
  const res = await request.post<ApiEnvelope<WechatNotifyPreferenceData>>(
    '/api/user/wechat-notify/preference',
    {}
  )
  return unwrap(res)
}

/** 开启微信推送 POST /api/user/wechat-notify/enable */
export async function wechatNotifyEnable(): Promise<WechatNotifyPreferenceData> {
  const res = await request.post<ApiEnvelope<WechatNotifyPreferenceData>>(
    '/api/user/wechat-notify/enable',
    {}
  )
  return unwrap(res)
}

/** 关闭微信推送 POST /api/user/wechat-notify/disable */
export async function wechatNotifyDisable(): Promise<WechatNotifyPreferenceData> {
  const res = await request.post<ApiEnvelope<WechatNotifyPreferenceData>>(
    '/api/user/wechat-notify/disable',
    {}
  )
  return unwrap(res)
}

/** 充值：套餐列表（POST，空请求体） */
export async function rechargePackageList(): Promise<RechargePackageItem[]> {
  const res = await request.post<ApiEnvelope<RechargePackageItem[]>>('/recharge/package/list', {})
  return unwrap(res)
}

/** 充值：创建订单 */
export async function rechargeOrderCreate(body: RechargeOrderCreateRequest): Promise<RechargeOrderCreateData> {
  const res = await request.post<ApiEnvelope<RechargeOrderCreateData>>('/recharge/order/create', body)
  return unwrap(res)
}

/** 充值：查询订单状态（POST + JSON body，与接口文档 `/recharge/order/query` 一致） */
export async function rechargeOrderQuery(orderNo: string): Promise<RechargeOrderQueryData> {
  const res = await request.post<ApiEnvelope<RechargeOrderQueryData>>('/recharge/order/query', {
    orderNo
  })
  return unwrap(res)
}

/** 从列表接口响应中取出记录数组（优先 `data` 为数组；兼容根级 `rows` 等旧结构） */
function extractPageRows<T>(res: unknown): { rows: T[]; total: number } {
  const r = res as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return { rows: [], total: 0 }
  const rawData = r.data
  if (Array.isArray(rawData)) {
    const total = typeof r.total === 'number' ? r.total : rawData.length
    return { rows: rawData as T[], total }
  }
  const dataObj =
    rawData && typeof rawData === 'object' && !Array.isArray(rawData)
      ? (rawData as Record<string, unknown>)
      : undefined
  const pickArray = (x: unknown): T[] | null => (Array.isArray(x) ? (x as T[]) : null)
  const rows =
    pickArray(r.rows) ??
    pickArray(dataObj?.rows) ??
    pickArray(dataObj?.list) ??
    pickArray(r.list) ??
    pickArray(dataObj?.records) ??
    pickArray(r.records) ??
    []
  const totalRaw =
    (typeof r.total === 'number' ? r.total : undefined) ??
    (typeof dataObj?.total === 'number' ? (dataObj.total as number) : undefined)
  const total = typeof totalRaw === 'number' ? totalRaw : rows.length
  return { rows, total }
}

/** 从分页接口响应解析 rows / total / pageNum / pageSize / hasMore */
function extractPaginatedResponse<T>(
  res: unknown,
  fallbackPageNum = 1,
  fallbackPageSize = API_DEFAULT_PAGE_SIZE
): PaginatedListResult<T> {
  const { rows, total } = extractPageRows<T>(res)
  const r = res as Record<string, unknown> | null
  const pageNum =
    r && typeof r.pageNum === 'number' && r.pageNum > 0 ? r.pageNum : fallbackPageNum
  const pageSize =
    r && typeof r.pageSize === 'number' && r.pageSize > 0 ? r.pageSize : fallbackPageSize
  return {
    rows,
    total,
    pageNum,
    pageSize,
    hasMore: pageNum * pageSize < total
  }
}

async function fetchAllPaginatedRows<T, B extends { pageNum?: number; pageSize?: number }>(
  fetchPage: (body: B) => Promise<PaginatedListResult<T>>,
  baseBody: Omit<B, 'pageNum' | 'pageSize'>,
  pageSize = API_DEFAULT_PAGE_SIZE
): Promise<T[]> {
  let pageNum = 1
  const all: T[] = []
  let total = Infinity
  while (all.length < total) {
    const page = await fetchPage({ ...baseBody, pageNum, pageSize } as B)
    total = page.total
    if (!page.rows.length) break
    all.push(...page.rows)
    if (!page.hasMore) break
    pageNum += 1
  }
  return all
}

/** 充值：订单列表（成功时 code 可能为 0；列表在响应体 `data` 数组中，见 {@link RechargeOrderListResponse}） */
export async function rechargeOrderList(params?: {
  payStatus?: string
  pageNum?: number
  pageSize?: number
}): Promise<{ total: number; rows: RechargeOrderRow[] }> {
  const res = (await request.post('/recharge/order/list', params ?? {})) as RechargeOrderListResponse
  const { rows, total } = extractPageRows<RechargeOrderRow>(res)
  const normalized = rows.map((row) => ({
    ...row,
    payStatus:
      typeof row.payStatus === 'string'
        ? row.payStatus.toLowerCase()
        : row.payStatus != null
          ? String(row.payStatus)
          : ''
  }))
  return { total, rows: normalized }
}

/** 充值：继续支付（POST + JSON，与接口文档 `/recharge/order/repay` 一致） */
export async function rechargeOrderRepay(orderNo: string): Promise<RechargeOrderCreateData> {
  const res = await request.post<ApiEnvelope<RechargeOrderCreateData>>('/recharge/order/repay', {
    orderNo
  })
  return unwrap(res)
}

/** 充值：取消订单（POST + JSON body，与接口文档一致） */
export async function rechargeOrderCancel(orderNo: string): Promise<void> {
  await request.post<ApiEnvelope>('/recharge/order/cancel', { orderNo })
}

/** 积分消耗明细：分页列表 POST /api/user/credit/consume/list */
export async function creditConsumeList(params?: {
  pageNum?: number
  pageSize?: number
}): Promise<{ total: number; rows: CreditConsumeRecordRow[] }> {
  const res = (await request.post('/api/user/credit/consume/list', params ?? {})) as CreditConsumeListResponse
  const { rows, total } = extractPageRows<CreditConsumeRecordRow>(res)
  return { total, rows }
}

/** 用户项目：列表查询（/api/user/project/list） */
export async function userProjectList(body?: UserProjectListRequest): Promise<{ total: number; rows: UserProjectRow[] }> {
  const reqBody = body ?? {}
  const key = stableRequestKey(reqBody)
  return runListDedupe(key, userProjectListInflight, userProjectListBurst, async () => {
    const res = (await request.post('/api/user/project/list', reqBody)) as ApiListEnvelope<UserProjectRow> &
      ApiListEnvelopeData<UserProjectRow> & {
        rows?: UserProjectRow[]
        data?: UserProjectRow[]
        total?: number
      }
    // 后端多为 { total, data: [...] }；旧版可能为根级 rows
    const rows = Array.isArray(res.rows) ? res.rows : Array.isArray(res.data) ? res.data : []
    const total = typeof res.total === 'number' ? res.total : rows.length
    return { total, rows }
  })
}

/** 用户项目：获取详情（/api/user/project/detail） */
export async function userProjectDetail(id: number): Promise<UserProjectRow> {
  const res = await request.post<ApiEnvelope<UserProjectRow>>('/api/user/project/detail', { id })
  return unwrap(res)
}

/** 公开项目视频：分页列表（/api/public/project/video/list） */
export async function publicProjectVideoList(
  body?: PublicProjectVideoListRequest
): Promise<{ total: number; rows: PublicProjectVideoRow[] }> {
  const reqBody = body ?? {}
  const key = stableRequestKey(reqBody)
  return runListDedupe(key, publicProjectVideoListInflight, publicProjectVideoListBurst, async () => {
    const res = (await request.post(
      '/api/public/project/video',
      reqBody
    )) as ApiListEnvelope<PublicProjectVideoRow> &
      ApiListEnvelopeData<PublicProjectVideoRow> & {
        rows?: PublicProjectVideoRow[]
        data?: PublicProjectVideoRow[]
        total?: number
      }
    const rows = Array.isArray(res.rows) ? res.rows : Array.isArray(res.data) ? res.data : []
    const total = typeof res.total === 'number' ? res.total : rows.length
    return { total, rows }
  })
}

const publicProjectDetailInflight = new Map<string, Promise<PublicProjectDetailRow>>()
const publicProjectDetailBurst: { current: { key: string; data: PublicProjectDetailRow; at: number } | null } =
  { current: null }

/** 公开项目：详情（/api/public/project/detail） */
export async function publicProjectDetail(id: number): Promise<PublicProjectDetailRow> {
  const key = String(id)
  const now = Date.now()
  const burst = publicProjectDetailBurst.current
  if (burst && burst.key === key && now - burst.at < 450) {
    return burst.data
  }
  const existing = publicProjectDetailInflight.get(key)
  if (existing) return existing
  const p = (async () => {
    const res = await request.post<ApiEnvelope<PublicProjectDetailRow>>(
      '/api/public/project/detail',
      { id }
    )
    const data = unwrap(res)
    publicProjectDetailBurst.current = { key, data, at: Date.now() }
    return data
  })().finally(() => publicProjectDetailInflight.delete(key))
  publicProjectDetailInflight.set(key, p)
  return p
}

/** 用户项目：删除（/api/user/project/delete） */
export async function userProjectDelete(id: number): Promise<void> {
  await request.post<ApiEnvelope>('/api/user/project/delete', { id })
}

/** 提交项目审核 POST /api/user/project/submit-audit */
export async function userProjectSubmitAudit(body: ProjectOrEpisodeIdRequest): Promise<void> {
  await request.post<ApiEnvelope>('/api/user/project/submit-audit', body)
}

/** 提交剧集审核 POST /api/user/episode/submit-audit（仅剧集） */
export async function userEpisodeSubmitAudit(body: ProjectOrEpisodeIdRequest): Promise<void> {
  await request.post<ApiEnvelope>('/api/user/episode/submit-audit', body)
}

/** 公开项目 POST /api/user/project/publish（须审核通过 status=4；须传描述与封面） */
export async function userProjectPublish(body: UserProjectPublishRequest): Promise<UserProjectRow> {
  const res = await request.post<ApiEnvelope<UserProjectRow>>('/api/user/project/publish', body)
  return unwrap(res)
}

/** 关闭项目公开 POST /api/user/project/unpublish */
export async function userProjectUnpublish(body: ProjectOrEpisodeIdRequest): Promise<UserProjectRow> {
  const res = await request.post<ApiEnvelope<UserProjectRow>>('/api/user/project/unpublish', body)
  return unwrap(res)
}

/** 用户项目：创建（/api/user/project/create） */
export async function userProjectCreate(body: UserProjectCreateRequest): Promise<{ data: UserProjectRow; msg: string }> {
  const res = await request.post<ApiEnvelope<UserProjectRow>>('/api/user/project/create', body)
  return {
    data: unwrap(res),
    msg: res.msg || '操作成功'
  }
}

/** 用户项目：修改（/api/user/project/update） */
export async function userProjectUpdate(body: UserProjectUpdateRequest): Promise<UserProjectRow> {
  const res = await request.post<ApiEnvelope<UserProjectRow>>('/api/user/project/update', body)
  return unwrap(res)
}

/** 用户剧集：列表（/api/user/episode/list） */
export async function userEpisodeList(body: { projectId: number }): Promise<UserEpisodeRow[]> {
  const res = (await request.post('/api/user/episode/list', body)) as {
    data?: UserEpisodeRow[]
    rows?: UserEpisodeRow[]
  }
  const list = res.data ?? res.rows ?? []
  return Array.isArray(list) ? list : []
}

/** 用户剧集：创建（/api/user/episode/create） */
export async function userEpisodeCreate(body: UserEpisodeCreateRequest): Promise<UserEpisodeRow> {
  const res = await request.post<ApiEnvelope<UserEpisodeRow>>('/api/user/episode/create', body)
  return unwrap(res)
}

/** 用户剧集：详情（/api/user/episode/detail） */
export async function userEpisodeDetail(body: UserEpisodeDetailRequest): Promise<UserEpisodeRow> {
  const res = await request.post<ApiEnvelope<UserEpisodeRow>>('/api/user/episode/detail', body)
  return unwrap(res)
}

/** 用户剧集：修改（/api/user/episode/update） */
export async function userEpisodeUpdate(body: UserEpisodeUpdateRequest): Promise<UserEpisodeRow> {
  const res = await request.post<ApiEnvelope<UserEpisodeRow>>('/api/user/episode/update', body)
  return unwrap(res)
}

/** 用户剧集：删除（/api/user/episode/delete） */
export async function userEpisodeDelete(body: UserEpisodeDeleteRequest): Promise<void> {
  await request.post<ApiEnvelope>('/api/user/episode/delete', body)
}

/** 从标准信封取出 `data` 数组 */
function extractDataArray<T>(res: unknown): T[] {
  const r = res as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return []
  const d = r.data
  return Array.isArray(d) ? (d as T[]) : []
}

/** 官方资产行 → 旧版列表行（兼容导入弹窗等） */
export function officialRowToUserAssetRow(r: UserAssetOfficialRow): UserAssetRow {
  return {
    id: r.id,
    assetType: r.assetType,
    assetName: r.assetName,
    personalityDesc: r.promptText ?? undefined,
    refImageUrl: r.imageUrl ?? null,
    extraImages: null,
    sourceType: 0
  }
}

/** 个人 RPS 主表行 → 旧版列表行（主图+其余形态进 extraImages） */
export function rpsRowToUserAssetRow(r: UserAssetRpsRow): UserAssetRow {
  const forms = r.forms ?? []
  const first = forms[0]
  const rest = forms.slice(1)
  const extraImages =
    rest
      .map((f) => (f.imageUrl || '').trim())
      .filter(Boolean)
      .join(';') || null
  const intro =
    (typeof r.introduction === 'string' && r.introduction.trim() ? r.introduction.trim() : '') ||
    (typeof first?.introduction === 'string' && first.introduction.trim() ? first.introduction.trim() : '') ||
    (typeof first?.promptText === 'string' && first.promptText.trim() ? first.promptText.trim() : '') ||
    undefined
  return {
    id: r.id,
    assetType: r.assetType,
    assetName: r.assetName,
    personalityDesc: intro,
    refImageUrl: first?.imageUrl ?? null,
    extraImages,
    sourceType: r.sourceType ?? undefined,
    createTime: r.createTime ?? undefined,
    updateTime: r.updateTime ?? undefined
  }
}

export function sortUserAssetRpsRows(rows: UserAssetRpsRow[]): UserAssetRpsRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.createTime || ''
    const tb = b.createTime || ''
    if (ta && tb) return ta.localeCompare(tb)
    return (a.id ?? 0) - (b.id ?? 0)
  })
}

/** 官方资产：POST /api/user/asset/official/query（全量，不分页） */
export async function userAssetOfficialQuery(
  body?: UserAssetOfficialQueryRequest
): Promise<UserAssetOfficialRow[]> {
  const res = await request.post('/api/user/asset/official/query', body ?? {})
  return extractDataArray<UserAssetOfficialRow>(res)
}

/** 用户自定义资产类型：POST /api/user/asset/custom/type/list */
export async function userAssetCustomTypeList(): Promise<UserAssetCustomTypeItem[]> {
  return runListDedupe('asset-custom-type-list', userAssetCustomTypeListInflight, userAssetCustomTypeListBurst, async () => {
    const res = await request.post<ApiEnvelope<UserAssetCustomTypeItem[]>>(
      '/api/user/asset/custom/type/list',
      {}
    )
    const data = unwrap(res)
    return Array.isArray(data) ? data : []
  })
}

/** 用户自定义资产分页：POST /api/user/asset/custom/list */
export async function userAssetCustomList(
  body: UserAssetCustomListRequest = {}
): Promise<{ total: number; list: UserAssetCustomRow[] }> {
  const res = await request.post<ApiEnvelope<{ total?: number; list?: UserAssetCustomRow[] }>>(
    '/api/user/asset/custom/list',
    body
  )
  const data = unwrap(res) ?? {}
  const list = Array.isArray(data.list) ? data.list : []
  const total = typeof data.total === 'number' ? data.total : list.length
  return { total, list }
}

/** 用户自定义资产创建：POST /api/user/asset/custom/create */
export async function userAssetCustomCreate(
  body: UserAssetCustomCreateRequest
): Promise<UserAssetCustomCreateData> {
  const res = await request.post<ApiEnvelope<UserAssetCustomCreateData>>('/api/user/asset/custom/create', body)
  return unwrap(res)
}

/** 用户自定义资产详情：POST /api/user/asset/custom/detail */
export async function userAssetCustomDetail(
  body: UserAssetCustomDetailRequest
): Promise<UserAssetCustomRow> {
  const res = await request.post<ApiEnvelope<UserAssetCustomRow>>('/api/user/asset/custom/detail', body)
  return unwrap(res)
}

/** 用户自定义资产修改：POST /api/user/asset/custom/update */
export async function userAssetCustomUpdate(body: UserAssetCustomUpdateRequest): Promise<boolean> {
  const res = await request.post<ApiEnvelope<boolean>>('/api/user/asset/custom/update', body)
  return Boolean(unwrap(res))
}

/** 用户自定义资产删除：POST /api/user/asset/custom/delete */
export async function userAssetCustomDelete(body: UserAssetCustomDeleteRequest): Promise<boolean> {
  const res = await request.post<ApiEnvelope<boolean>>('/api/user/asset/custom/delete', body)
  return Boolean(unwrap(res))
}

/** 合并个人+官方参考资产分页：POST /api/user/asset/custom/page */
export async function userAssetMergedPage(
  body: MergedAssetPageRequest = {}
): Promise<{ total: number; list: MergedAssetVO[] }> {
  const reqBody = body ?? {}
  const key = stableRequestKey(reqBody)
  return runListDedupe(key, userAssetMergedPageInflight, userAssetMergedPageBurst, async () => {
    const res = await request.post<ApiEnvelope<{ total?: number; list?: MergedAssetVO[] }>>(
      '/api/user/asset/custom/page',
      reqBody
    )
    const data = unwrap(res) ?? {}
    const list = Array.isArray(data.list) ? data.list : []
    const total = typeof data.total === 'number' ? data.total : list.length
    return { total, list }
  })
}

/** 从分类树接口响应中取出树数组（兼容 data / rows / data.tree 等结构） */
function extractAssetCenterCategoryTree(res: unknown): unknown[] {
  const { rows } = extractPageRows<unknown>(res)
  if (rows.length) return rows
  const r = res as Record<string, unknown> | null
  const data = r?.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>
    for (const key of ['tree', 'list', 'children']) {
      if (Array.isArray(nested[key])) return nested[key] as unknown[]
    }
  }
  return []
}

function treeNodeNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 归一化分类树节点（接口实际结构：list[].episodes[].categories[]） */
function normalizeAssetCenterTreeNode(
  raw: unknown,
  ctx: { projectId?: number; projectName?: string; episodeId?: number | null } = {}
): AssetCenterCategoryTreeVO {
  const n = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const projectId = treeNodeNum(n.projectId ?? n.id) ?? ctx.projectId ?? 0
  const projectName =
    String(n.projectName ?? ctx.projectName ?? '').trim() || `项目${projectId}`

  // 分类叶子：categories[] 项
  const categoryCodeRaw = n.categoryCode ?? n.code ?? n.key
  const hasCategoryCode =
    categoryCodeRaw != null && String(categoryCodeRaw).trim().length > 0
  const episodesArr = n.episodes
  const categoriesArr = n.categories
  if (
    hasCategoryCode &&
    !Array.isArray(episodesArr) &&
    !Array.isArray(categoriesArr)
  ) {
    const code = String(categoryCodeRaw).trim()
    const categoryNameRaw = n.categoryName ?? n.label ?? n.name
    return {
      projectId,
      projectName,
      episodeId: ctx.episodeId ?? treeNodeNum(n.episodeId),
      categoryCode: code,
      categoryName:
        categoryNameRaw != null && String(categoryNameRaw).trim()
          ? String(categoryNameRaw).trim()
          : code,
      assetCount: typeof n.assetCount === 'number' ? n.assetCount : null
    }
  }

  // 剧集层：episodes[] 项（含 categories[]）
  if (Array.isArray(categoriesArr)) {
    const episodeId = treeNodeNum(n.episodeId) ?? ctx.episodeId ?? 0
    const episodeTitle =
      n.episodeTitle != null && String(n.episodeTitle).trim()
        ? String(n.episodeTitle).trim()
        : n.episodeName != null && String(n.episodeName).trim()
          ? String(n.episodeName).trim()
          : null
    return {
      projectId,
      projectName,
      projectType: (n.projectType as string) ?? null,
      episodeId,
      episodeNo: treeNodeNum(n.episodeNo),
      episodeTitle,
      assetCount: typeof n.assetCount === 'number' ? n.assetCount : null,
      children: categoriesArr.map((c) =>
        normalizeAssetCenterTreeNode(c, { projectId, projectName, episodeId })
      )
    }
  }

  // 项目层：list[] 项（含 episodes[]）
  const childSource = Array.isArray(episodesArr)
    ? episodesArr
    : Array.isArray(n.children)
      ? n.children
      : null
  if (childSource) {
    return {
      projectId,
      projectName,
      projectType: (n.projectType as string) ?? null,
      assetCount: typeof n.assetCount === 'number' ? n.assetCount : null,
      children: childSource.map((c) =>
        normalizeAssetCenterTreeNode(c, { projectId, projectName })
      )
    }
  }

  return {
    projectId,
    projectName,
    projectType: (n.projectType as string) ?? null,
    episodeId: treeNodeNum(n.episodeId),
    episodeNo: treeNodeNum(n.episodeNo),
    episodeTitle:
      n.episodeTitle != null && String(n.episodeTitle).trim()
        ? String(n.episodeTitle).trim()
        : n.episodeName != null && String(n.episodeName).trim()
          ? String(n.episodeName).trim()
          : null,
    categoryCode: hasCategoryCode ? String(categoryCodeRaw).trim() : null,
    categoryName: hasCategoryCode ? String(n.categoryName ?? categoryCodeRaw).trim() : null,
    assetCount: typeof n.assetCount === 'number' ? n.assetCount : null
  }
}

function normalizeAssetCenterCategoryTree(raw: unknown): AssetCenterCategoryTreeVO[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((item) => normalizeAssetCenterTreeNode(item))
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    for (const key of ['list', 'tree', 'children', 'rows', 'data']) {
      const v = o[key]
      if (Array.isArray(v)) return v.map((item) => normalizeAssetCenterTreeNode(item))
    }
  }
  return []
}

/** 个人资产中心分类树：POST /api/user/asset/center/category/tree */
export async function userAssetCenterCategoryTree(
  body: Record<string, never> = {}
): Promise<AssetCenterCategoryTreeVO[]> {
  const res = await request.post('/api/user/asset/center/category/tree', body)
  return normalizeAssetCenterCategoryTree(extractAssetCenterCategoryTree(res))
}

/** 个人资产中心列表：POST /api/user/asset/center/list */
export async function userAssetCenterList(
  body: AssetCenterListRequest
): Promise<{ total: number; list: AssetCenterItemVO[] }> {
  const res = await request.post('/api/user/asset/center/list', body)
  const { rows, total } = extractPageRows<AssetCenterItemVO>(res)
  return { total, list: rows }
}

/** 个人资产中心明细：POST /api/user/asset/center/detail */
export async function userAssetCenterDetail(
  body: AssetCenterDetailRequest
): Promise<AssetCenterDetailVO> {
  const res = await request.post<ApiEnvelope<AssetCenterDetailVO>>(
    '/api/user/asset/center/detail',
    body
  )
  return unwrap(res)
}

/** 合并参考资产行 → 旧版列表行（导入弹窗等） */
export function mergedAssetToUserAssetRow(r: MergedAssetVO): UserAssetRow {
  return {
    id: r.id,
    assetType: r.assetType,
    assetName: r.assetName,
    personalityDesc: r.personalityDesc ?? r.promptText ?? undefined,
    refImageUrl: r.imageUrl ?? null,
    extraImages: null,
    sourceType: isMergedAssetOfficial(r.sourceFlag) ? 0 : 1,
    createTime: r.createTime ?? undefined
  }
}

/** 资产中心列表项 → 旧版列表行 */
export function assetCenterItemToUserAssetRow(r: AssetCenterItemVO): UserAssetRow {
  const mediaUrl = String(r.mediaUrl ?? r.coverUrl ?? '').trim()
  const name = String(r.name ?? r.assetName ?? '').trim()
  const categoryCode = String(r.categoryCode ?? r.assetType ?? '').trim()
  return {
    id: r.id,
    projectId: r.projectId,
    episodeId: r.episodeId,
    assetType: categoryCode || r.assetType || '',
    assetName: name || r.assetName || '',
    refImageUrl: mediaUrl || null,
    extraImages: null,
    createTime: r.createTime ?? undefined,
    updateTime: r.updateTime ?? undefined
  }
}

/** 资产中心明细 → 旧版列表行（content 摘要写入 personalityDesc） */
export function assetCenterDetailToUserAssetRow(r: AssetCenterDetailVO): UserAssetRow {
  const c = r.content ?? {}
  const intro =
    (typeof c.introduction === 'string' && c.introduction.trim()) ||
    (typeof c.summary === 'string' && c.summary.trim()) ||
    (typeof c.storyScript === 'string' && c.storyScript.trim()) ||
    (typeof c.originalText === 'string' && c.originalText.trim()) ||
    undefined
  const mediaUrl = r.imageUrl ?? r.coverUrl ?? r.videoUrl ?? null
  return {
    id: r.id,
    projectId: r.projectId,
    episodeId: r.episodeId,
    assetType: r.assetType ?? r.categoryCode,
    assetName: r.name ?? r.assetName ?? undefined,
    personalityDesc: intro,
    refImageUrl: mediaUrl,
    extraImages: null,
    createTime: r.createTime ?? undefined,
    updateTime: r.updateTime ?? undefined
  }
}

/** 个人资产（角色/场景/道具等）：POST /api/user/asset/rps/list */
export async function userAssetRpsList(
  body?: UserAssetRpsListRequest
): Promise<{ rows: UserAssetRpsRow[]; total: number }> {
  const reqBody = body ?? {}
  const key = stableRequestKey(reqBody)
  return runListDedupe(key, rpsListInflight, rpsListBurst, async () => {
    const res = await request.post('/api/user/asset/rps/list', reqBody)
    const rows = extractDataArray<UserAssetRpsRow>(res)
    return { rows, total: rows.length }
  })
}

/** 个人资产形态列表：POST /api/user/asset/rps/form/list */
export async function userAssetRpsFormList(
  body: UserAssetRpsFormListRequest = {}
): Promise<UserAssetRpsFormRow[]> {
  const key = stableRequestKey(body)
  return runListDedupe(key, rpsFormListInflight, rpsFormListBurst, async () => {
    const res = await request.post<ApiEnvelope<UserAssetRpsFormRow[]>>('/api/user/asset/rps/form/list', body)
    const data = unwrap(res)
    return Array.isArray(data) ? data : []
  })
}

/** 形态增删改后调用，避免 450ms 列表缓存导致「已生成形态」仍被当作待生成而隐藏主列表 */
export function invalidateUserAssetRpsFormListCache() {
  rpsFormListBurst.current = null
  rpsFormListInflight.clear()
}

/** 个人资产主表创建：POST /api/user/asset/rps/create */
export async function userAssetRpsCreate(body: UserAssetRpsCreateRequest): Promise<UserAssetRpsRow> {
  const res = await request.post<ApiEnvelope<UserAssetRpsRow>>('/api/user/asset/rps/create', body)
  return unwrap(res)
}

/** 个人资产形态创建：POST /api/user/asset/rps/form/create */
export async function userAssetRpsFormCreate(body: UserAssetRpsFormCreateRequest): Promise<UserAssetRpsRow> {
  const res = await request.post<ApiEnvelope<UserAssetRpsRow>>('/api/user/asset/rps/form/create', body)
  return unwrap(res)
}

/** 个人资产形态图创建：POST /api/user/asset/rps/form-image/create */
export async function userAssetRpsFormImageCreate(
  body: UserAssetRpsFormImageCreateRequest
): Promise<UserAssetRpsFormImageRow> {
  const res = await request.post<ApiEnvelope<UserAssetRpsFormImageRow>>('/api/user/asset/rps/form-image/create', body)
  return unwrap(res)
}

/** 个人资产形态图更新：POST /api/user/asset/rps/form-image/update */
export async function userAssetRpsFormImageUpdate(
  body: UserAssetRpsFormImageUpdateRequest
): Promise<UserAssetRpsFormImageRow> {
  const res = await request.post<ApiEnvelope<UserAssetRpsFormImageRow>>('/api/user/asset/rps/form-image/update', body)
  return unwrap(res)
}

/** 个人资产形态图列表：POST /api/user/asset/rps/form-image/list */
export async function userAssetRpsFormImageList(
  body: UserAssetRpsFormImageListRequest
): Promise<UserAssetRpsFormImageRow[]> {
  const key = stableRequestKey(body)
  return runListDedupe(key, rpsFormImageListInflight, rpsFormImageListBurst, async () => {
    const res = await request.post<ApiEnvelope<UserAssetRpsFormImageRow[]>>('/api/user/asset/rps/form-image/list', body)
    const data = unwrap(res)
    return Array.isArray(data) ? data : []
  })
}

/** 个人资产形态图删除：POST /api/user/asset/rps/form-image/delete */
export async function userAssetRpsFormImageDelete(body: UserAssetRpsFormImageDeleteRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/asset/rps/form-image/delete', body)
}

/** 场景形态图拆分四宫格：POST /api/user/asset/rps/form-image/scene/split */
export async function userAssetRpsFormImageSceneSplit(
  body: UserAssetRpsSceneImageSplitRequest
): Promise<UserAssetRpsSceneImageSplitData> {
  const res = await request.post<ApiEnvelope<UserAssetRpsSceneImageSplitData>>(
    '/api/user/asset/rps/form-image/scene/split',
    body
  )
  return unwrap(res)
}

/** 形态图高清（异步）：POST /api/user/asset/rps/form-image/upscale（v2.24+） */
export async function userAssetRpsFormImageUpscale(
  body: UserAssetRpsFormImageUpscaleRequest
): Promise<UserAssetRpsFormImageUpscaleSubmitData> {
  const res = await request.post<ApiEnvelope<UserAssetRpsFormImageUpscaleSubmitData>>(
    '/api/user/asset/rps/form-image/upscale',
    body
  )
  return unwrap(res)
}

/** 从表形态设为使用中：POST /api/user/asset/rps/form/use（支持单个 / 批量） */
export async function userAssetRpsFormUse(
  body: UserAssetRpsFormUseRequest
): Promise<UserAssetRpsFormUseBatchData | null> {
  const res = await request.post<ApiEnvelope<UserAssetRpsFormUseBatchData>>(
    '/api/user/asset/rps/form/use',
    body
  )
  return unwrap(res) ?? null
}

/** 取消从表形态使用：POST /api/user/asset/rps/form/unuse（支持单个 / 批量，出参同 use） */
export async function userAssetRpsFormUnuse(
  body: UserAssetRpsFormUnuseRequest
): Promise<UserAssetRpsFormUseBatchData | null> {
  const res = await request.post<ApiEnvelope<UserAssetRpsFormUseBatchData>>(
    '/api/user/asset/rps/form/unuse',
    body
  )
  return unwrap(res) ?? null
}

/** 个人资产编辑：更新主表 POST /api/user/asset/rps/update-main（文档 2.5） */
export async function userAssetRpsUpdateMain(
  body: UserAssetRpsUpdateMainRequest,
  options?: { createSource?: string | null; isManual?: boolean }
): Promise<UserAssetRpsRow> {
  const payload = normalizeUpdateMainRequest(body, options)
  const res = await request.post<ApiEnvelope<UserAssetRpsRow>>('/api/user/asset/rps/update-main', payload)
  return unwrap(res)
}

/** 多机位形态生图（v2.35.0 真实接口）：POST /api/user/asset/extract/form/generate-multi-view-image */
export async function userAssetExtractFormGenerateMultiViewImage(
  body: UserAssetExtractFormGenerateMultiViewImageRequest
): Promise<UserAssetExtractFormGenerateMultiViewImageData> {
  const res = await request.post<ApiEnvelope<UserAssetExtractFormGenerateMultiViewImageData>>(
    '/api/user/asset/extract/form/generate-multi-view-image',
    body
  )
  return unwrap(res)
}

/**
 * @deprecated v2.62 请改用 userStoryboardGenerateMultiViewGridImage
 */
export async function userAssetExtractStoryboardGenerateMultiViewGridImage(
  body: UserAssetExtractStoryboardGenerateMultiViewGridImageRequest
): Promise<UserAssetExtractStoryboardGenerateMultiViewGridImageData> {
  const res = await request.post<ApiEnvelope<UserAssetExtractStoryboardGenerateMultiViewGridImageData>>(
    '/api/user/asset/extract/storyboard/generate-multi-view-grid-image',
    body
  )
  return unwrap(res)
}

/**
 * 分镜机位生图（v2.62）：POST /api/user/storyboard/generate/multi-view-grid-image
 * angles 长度 1 → 单机位；长度 9 → 九宫格。
 */
export async function userStoryboardGenerateMultiViewGridImage(
  body: UserStoryboardGenerateMultiViewGridImageRequest
): Promise<UserStoryboardGenerateMultiViewGridImageData> {
  const res = await request.post<ApiEnvelope<UserStoryboardGenerateMultiViewGridImageData>>(
    '/api/user/storyboard/generate/multi-view-grid-image',
    body
  )
  return unwrap(res)
}

/** 形态图片创作（编辑图片 / 对话作图）：POST /api/user/asset/extract/form/generate-creation-image */
export async function userAssetExtractFormGenerateCreationImage(
  body: UserAssetExtractFormGenerateCreationImageRequest
): Promise<UserAssetExtractFormGenerateCreationImageData> {
  const res = await request.post<ApiEnvelope<UserAssetExtractFormGenerateCreationImageData>>(
    '/api/user/asset/extract/form/generate-creation-image',
    body
  )
  return unwrap(res)
}

/** @deprecated 请改用 userAssetExtractFormGenerateCreationImage */
export async function userAssetExtractFormGenerateEditImage(
  body: UserAssetExtractFormGenerateEditImageRequest
): Promise<UserAssetExtractFormGenerateEditImageData> {
  return userAssetExtractFormGenerateCreationImage(body)
}

/** 个人资产编辑：仅更新从表形态 POST /api/user/asset/rps/update-form（文档 2.6，出参为单条 RpsFormVO） */
export async function userAssetRpsUpdateForm(body: UserAssetRpsUpdateFormRequest): Promise<UserAssetRpsFormRow> {
  const res = await request.post<ApiEnvelope<UserAssetRpsFormRow>>('/api/user/asset/rps/update-form', body)
  return unwrap(res)
}

/**
 * 个人资产删除（单个 / 批量同接口）：POST /api/user/asset/rps/delete
 * - 单删传 `id`（可带 `formId`）：出参无 data，返回 null
 * - 批量传 `ids`：返回统一批量结果（成功 / 失败明细）
 */
export async function userAssetRpsDelete(
  body: UserAssetRpsDeleteRequest
): Promise<UserAssetRpsDeleteBatchData | null> {
  const res = await request.post<ApiEnvelope<UserAssetRpsDeleteBatchData>>(
    '/api/user/asset/rps/delete',
    body
  )
  return unwrap(res) ?? null
}

/**
 * 批量删除主资产（传 ids；超出 50 自动分片；单条失败不阻断其它分片）。
 */
export async function userAssetRpsDeleteBatchByIds(
  assetIds: number[]
): Promise<{
  successIds: number[]
  failCount: number
  failures: Array<{ id?: number | null; reason?: string }>
}> {
  const chunks = chunkRpsDeleteIds(assetIds)
  if (!chunks.length) {
    return { successIds: [], failCount: 0, failures: [] }
  }

  const parts: Array<UserAssetRpsDeleteBatchData | null> = []
  for (const chunk of chunks) {
    try {
      parts.push(await userAssetRpsDelete({ ids: chunk }))
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      const reason = String(err?.msg || err?.message || '删除失败').trim() || '删除失败'
      parts.push({
        total: chunk.length,
        successCount: 0,
        failCount: chunk.length,
        successIds: [],
        failures: chunk.map((id) => ({ id, reason }))
      })
    }
  }

  return mergeRpsDeleteBatchResults(parts)
}

/** 其他类型个人资产：POST /api/user/asset/rps/create-other */
export async function userAssetRpsCreateOther(body: UserAssetRpsCreateOtherRequest): Promise<UserAssetRpsRow> {
  const res = await request.post<ApiEnvelope<UserAssetRpsRow>>('/api/user/asset/rps/create-other', body)
  return unwrap(res)
}

/** AI 提取个人资产（开发中）：POST /api/user/asset/rps/ai/extract */
export async function userAssetRpsAiExtract(body: UserAssetRpsAiExtractRequest): Promise<unknown> {
  const res = await request.post<ApiEnvelope<unknown>>('/api/user/asset/rps/ai/extract', body)
  return unwrap(res)
}

/**
 * @deprecated v2.0 改用 userAssetRpsList
 * 个人资产列表（走 rps/list 并映射为旧行结构）
 */
export async function userAssetList(body?: UserAssetListRequest): Promise<{ total: number; rows: UserAssetRow[] }> {
  const { rows } = await userAssetRpsList({
    projectId: body?.projectId,
    episodeId: body?.episodeId,
    assetType: body?.assetType
  })
  const mapped = rows.map(rpsRowToUserAssetRow)
  return { total: mapped.length, rows: mapped }
}

/**
 * @deprecated v2.0 改用 userAssetOfficialQuery
 * 官方资产（走 official/query 并映射为旧行结构）
 */
export async function userAssetOfficialList(body?: UserAssetListRequest): Promise<{ total: number; rows: UserAssetRow[] }> {
  let list = await userAssetOfficialQuery({
    assetType: body?.assetType,
    assetName: body?.assetName
  })
  if (body?.assetName?.trim()) {
    const q = body.assetName.trim().toLowerCase()
    list = list.filter((r) => (r.assetName || '').toLowerCase().includes(q))
  }
  const rows = list.map(officialRowToUserAssetRow)
  return { total: rows.length, rows }
}

const OSS_UPLOAD_TIMEOUT_MS = 300000

/** OSS 单文件上传（multipart）/api/user/oss/upload */
export async function ossRemoteUploadSingle(
  file: File,
  customDir?: string
): Promise<OssRemoteUploadResult> {
  const fd = new FormData()
  fd.append('files', file)
  if (customDir != null && customDir !== '') fd.append('customDir', customDir)
  const res = await request.post<ApiEnvelope<OssRemoteUploadResult[]>>(
    '/api/user/oss/upload',
    fd,
    {
      timeout: OSS_UPLOAD_TIMEOUT_MS,
      headers: { 'Content-Type': false } as unknown as Record<string, string>
    }
  )
  const data = unwrap(res)
  if (Array.isArray(data)) {
    if (data.length === 0) throw Object.assign(new Error('上传失败：未返回文件地址'), { code: 500 })
    return data[0]!
  }
  if (data && typeof data === 'object') return data as OssRemoteUploadResult
  throw Object.assign(new Error('上传失败：返回数据格式异常'), { code: 500 })
}

/** OSS 多文件上传（/api/user/oss/upload） */
export async function ossRemoteUploadMultiple(
  files: File[],
  customDir?: string
): Promise<OssRemoteUploadResult[]> {
  const fd = new FormData()
  for (const f of files) {
    fd.append('files', f)
  }
  if (customDir != null && customDir !== '') fd.append('customDir', customDir)
  const res = await request.post<ApiEnvelope<OssRemoteUploadResult[]>>(
    '/api/user/oss/upload',
    fd,
    {
      timeout: OSS_UPLOAD_TIMEOUT_MS,
      headers: { 'Content-Type': false } as unknown as Record<string, string>
    }
  )
  return unwrap(res)
}

/** 任意数量图片：按 3 个一批调用统一上传接口 */
export async function ossRemoteUploadImages(files: File[], customDir = 'images'): Promise<string[]> {
  const urls: string[] = []
  let i = 0
  while (i < files.length) {
    const chunk = files.slice(i, i + 3)
    if (chunk.length === 1) {
      const one = await ossRemoteUploadSingle(chunk[0]!, customDir)
      urls.push(one.url)
    } else {
      const list = await ossRemoteUploadMultiple(chunk, customDir)
      urls.push(...list.map((x) => x.url))
    }
    i += 3
  }
  return urls
}

/** 点选改图：按坐标识别编辑目标（如空调、窗户等） */
export async function userTouchEditPointDetect(
  body: TouchEditPointDetectRequest
): Promise<TouchEditPointDetectData> {
  const res = await request.post<ApiEnvelope<TouchEditPointDetectData>>('/api/user/media/touch/edit/point', body)
  return unwrap(res)
}

/** 创作步骤：查询状态（/api/user/step/status） */
export async function creationStepStatus(body: CreationStepRequest): Promise<CreationStepState> {
  const res = await request.post<ApiEnvelope<CreationStepState>>('/api/user/step/status', body)
  return unwrap(res)
}

/** 创作步骤：手动推进（/api/user/step/advance） */
export async function creationStepAdvance(body: CreationStepAdvanceRequest): Promise<CreationStepState> {
  const res = await request.post<ApiEnvelope<CreationStepState>>('/api/user/step/advance', body)
  return unwrap(res)
}

const scriptDetailInflight = new Map<string, Promise<ScriptDetailRow | null>>()
const scriptDetailBurst: ListBurstSlot<ScriptDetailRow | null> = { current: null }

function scriptDetailDedupeKey(body: ScriptDetailByProjectRequest): string {
  const pid = body.projectId != null && Number.isFinite(Number(body.projectId)) ? Number(body.projectId) : 0
  const eid = body.episodeId != null && Number.isFinite(Number(body.episodeId)) ? Number(body.episodeId) : 0
  return `${pid}:${eid}`
}

/**
 * 根据项目/剧集获取剧本详情（/api/user/script/detailByProject）
 * 电影 episodeId 传 0；剧集传具体集数 ID。
 * 剧本不存在时（常见 code 500）返回 `null`，不抛错。
 */
export async function userScriptDetailByProject(
  body: ScriptDetailByProjectRequest
): Promise<ScriptDetailRow | null> {
  const key = scriptDetailDedupeKey(body)
  return runListDedupe(key, scriptDetailInflight, scriptDetailBurst, async () => {
    try {
      const res = await request.post<ApiEnvelope<ScriptDetailRow>>('/api/user/script/detailByProject', body)
      return unwrap(res)
    } catch (e: unknown) {
      const err = e as { code?: number; msg?: string }
      if (err?.code === 500 && /剧本不存在/.test(String(err?.msg ?? ''))) {
        return null
      }
      throw e
    }
  })
}

/** 保存剧本（版本+1，旧版进历史）/api/user/script/save */
export async function userScriptSave(body: ScriptSaveRequest): Promise<ScriptDetailRow> {
  const res = await request.post<ApiEnvelope<ScriptDetailRow>>('/api/user/script/save', body)
  return unwrap(res)
}

/** 静默保存剧本（不升版本）/api/user/script/autoSave */
export async function userScriptAutoSave(body: ScriptSaveRequest): Promise<ScriptDetailRow> {
  const res = await request.post<ApiEnvelope<ScriptDetailRow>>('/api/user/script/autoSave', body)
  return unwrap(res)
}

/** 上传剧本文件（multipart）POST /api/user/script/upload */
export async function userScriptUpload(body: ScriptUploadRequest): Promise<ScriptDetailRow> {
  const fd = new FormData()
  fd.append('file', body.file)
  fd.append('projectId', String(body.projectId))
  if (body.episodeId != null && Number.isFinite(body.episodeId) && body.episodeId > 0) {
    fd.append('episodeId', String(body.episodeId))
  }
  const res = await request.post<ApiEnvelope<ScriptDetailRow>>('/api/user/script/upload', fd, {
    timeout: OSS_UPLOAD_TIMEOUT_MS,
    headers: { 'Content-Type': false } as unknown as Record<string, string>
  })
  return unwrap(res)
}

/** 剧本分集预览（只解析不入库）POST /api/user/script/split/preview */
export async function userScriptSplitPreview(
  body: ScriptSplitPreviewRequest
): Promise<ScriptSplitPreviewVO> {
  const res = await request.post<ApiEnvelope<ScriptSplitPreviewVO>>(
    '/api/user/script/split/preview',
    body
  )
  const data = unwrap(res)
  return {
    totalEpisodes: Number(data?.totalEpisodes) || 0,
    totalCharCount: data?.totalCharCount ?? null,
    episodeKeyword: data?.episodeKeyword ?? null,
    items: Array.isArray(data?.items) ? data.items : []
  }
}

/** 剧本分集确认入库 POST /api/user/script/split/confirm */
export async function userScriptSplitConfirm(
  body: ScriptSplitPreviewRequest
): Promise<ScriptSplitConfirmVO> {
  const res = await request.post<ApiEnvelope<ScriptSplitConfirmVO>>(
    '/api/user/script/split/confirm',
    body
  )
  const data = unwrap(res)
  return {
    totalEpisodes: Number(data?.totalEpisodes) || 0,
    episodes: Array.isArray(data?.episodes) ? data.episodes : []
  }
}

/** 分镜工作台：查询分镜列表 POST /api/user/storyboard/list */
export async function userStoryboardList(body: UserStoryboardListRequest): Promise<UserStoryboardListRow[]> {
  const key = stableRequestKey(body)
  return runListDedupe(key, storyboardListInflight, storyboardListBurst, async () => {
    const res = await request.post<ApiEnvelope<UserStoryboardListRow[]>>(
      '/api/user/storyboard/list',
      body
    )
    const data = unwrap(res)
    return Array.isArray(data) ? data : []
  })
}

/** 分镜工作台：查询分镜详情 POST /api/user/storyboard/detail */
export async function userStoryboardDetail(body: UserStoryboardDetailRequest): Promise<UserStoryboardListRow> {
  const res = await request.post<ApiEnvelope<UserStoryboardListRow>>('/api/user/storyboard/detail', body)
  return unwrap(res)
}

/** 分镜工作台：新增分镜 POST /api/user/storyboard/create */
export async function userStoryboardCreate(body: UserStoryboardCreateRequest): Promise<UserStoryboardCreateData> {
  const res = await request.post<ApiEnvelope<UserStoryboardCreateData>>('/api/user/storyboard/create', body)
  return unwrap(res)
}

/** 分镜工作台：删除分镜 POST /api/user/storyboard/delete（返回实际软删除条数） */
export async function userStoryboardDelete(body: UserStoryboardDeleteRequest): Promise<number> {
  const res = await request.post<ApiEnvelope<number>>('/api/user/storyboard/delete', body)
  return unwrap(res)
}

/** 分镜工作台：更新分镜配置 POST /api/user/storyboard/update */
export async function userStoryboardUpdate(body: UserStoryboardUpdateRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/update', body)
}

/** @deprecated 请使用 userStoryboardUpdate */
export async function userStoryboardSave(body: UserStoryboardUpdateRequest): Promise<void> {
  return userStoryboardUpdate(body)
}

/** 分镜工作台：批量调整排序 POST /api/user/storyboard/sort */
export async function userStoryboardSort(body: UserStoryboardSortRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/sort', body)
}

/** 分镜工作台：批量生成分镜脚本（异步任务）POST /api/user/storyboard/generate/script */
export async function userStoryboardGenerateScript(
  body: StoryboardGenerateScriptRequest
): Promise<StoryboardGenerateScriptData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateScriptData>>(
    '/api/user/storyboard/generate/script',
    body
  )
  return unwrap(res)
}

/** 统一续生：POST /api/user/task/resume（按 taskId 识别任务类型） */
export async function userTaskResume(body: UserTaskResumeRequest): Promise<UserTaskResumeData> {
  const res = await request.post<ApiEnvelope<UserTaskResumeData>>('/api/user/task/resume', body)
  return unwrap(res)
}

/** @deprecated 请使用 userTaskResume */
export async function userStoryboardGenerateScriptResume(
  body: StoryboardGenerateScriptResumeRequest
): Promise<StoryboardGenerateScriptResumeData> {
  return userTaskResume(body)
}

/** 分镜工作台：批量生成分镜图脚本 POST /api/user/storyboard/generate/image-prompt */
export async function userStoryboardGenerateImagePrompt(
  body: StoryboardGenerateImagePromptRequest
): Promise<StoryboardGenerateImagePromptData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateImagePromptData>>(
    '/api/user/storyboard/generate/image-prompt',
    body
  )
  return unwrap(res)
}

/** @deprecated 请使用 userTaskResume */
export async function userStoryboardGenerateImagePromptResume(
  body: StoryboardGenerateImagePromptResumeRequest
): Promise<StoryboardGenerateImagePromptResumeData> {
  return userTaskResume(body)
}

/** 分镜工作台：批量生成分镜图提示词 + 自动出图 POST /api/user/storyboard/generate/image-with-prompt（任务3） */
export async function userStoryboardGenerateImageWithPrompt(
  body: StoryboardGenerateImageWithPromptRequest
): Promise<StoryboardGenerateImageWithPromptData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateImageWithPromptData>>(
    '/api/user/storyboard/generate/image-with-prompt',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：批量生成分镜视频提示词 POST /api/user/storyboard/generate/video-prompt（v3.0） */
export async function userStoryboardGenerateVideoPrompt(
  body: StoryboardGenerateVideoPromptRequest
): Promise<StoryboardGenerateVideoPromptData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateVideoPromptData>>(
    '/api/user/storyboard/generate/video-prompt',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：批量生成图生方向分镜视频提示词 POST /api/user/storyboard/generate/video-prompt-image */
export async function userStoryboardGenerateVideoPromptImage(
  body: StoryboardGenerateVideoPromptImageRequest
): Promise<StoryboardGenerateVideoPromptImageData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateVideoPromptImageData>>(
    '/api/user/storyboard/generate/video-prompt-image',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：批量生成宫格方向分镜视频提示词 POST /api/user/storyboard/generate/video-prompt-grid */
export async function userStoryboardGenerateVideoPromptGrid(
  body: StoryboardGenerateVideoPromptGridRequest
): Promise<StoryboardGenerateVideoPromptGridData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateVideoPromptGridData>>(
    '/api/user/storyboard/generate/video-prompt-grid',
    body
  )
  return unwrap(res)
}

/** @deprecated 请使用 userTaskResume */
export async function userStoryboardGenerateVideoPromptResume(
  body: StoryboardGenerateVideoPromptResumeRequest
): Promise<StoryboardGenerateVideoPromptResumeData> {
  return userTaskResume(body)
}

/** 分镜工作台：批量生成分镜视频提示词 + 自动出片 POST /api/user/storyboard/generate/video-with-prompt（任务4，按创作模式自动路由） */
export async function userStoryboardGenerateVideoWithPrompt(
  body: StoryboardGenerateVideoWithPromptRequest
): Promise<StoryboardGenerateVideoWithPromptData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateVideoWithPromptData>>(
    '/api/user/storyboard/generate/video-with-prompt',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：批量生成宫格视频提示词 + 自动出宫格视频 POST /api/user/storyboard/generate/grid-video-with-prompt（仅 auto_grid） */
export async function userStoryboardGenerateGridVideoWithPrompt(
  body: StoryboardGenerateGridVideoWithPromptRequest
): Promise<StoryboardGenerateGridVideoWithPromptData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateGridVideoWithPromptData>>(
    '/api/user/storyboard/generate/grid-video-with-prompt',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：手动保存分镜视频提示词 POST /api/user/storyboard/save/video-prompt（v3.0） */
export async function userStoryboardSaveVideoPrompt(body: StoryboardSaveVideoPromptRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/save/video-prompt', body)
}

/** 分镜工作台：设置分镜最终产物 POST /api/user/storyboard/setFinal */
export async function userStoryboardSetFinal(body: StoryboardSetFinalRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/setFinal', body)
}

/** 分镜工作台：解析 image_prompt 中的 @图片N[name] POST /api/user/storyboard/image-prompt/resolve */
export async function userStoryboardImagePromptResolve(
  body: StoryboardImagePromptResolveRequest
): Promise<StoryboardImagePromptResolveData> {
  const key = stableRequestKey(body)
  return runListDedupe(key, imagePromptResolveInflight, imagePromptResolveBurst, async () => {
    const res = await request.post<ApiEnvelope<StoryboardImagePromptResolveData>>(
      '/api/user/storyboard/image-prompt/resolve',
      body
    )
    const data = unwrap(res)
    const references: StoryboardImagePromptReferenceItem[] = Array.isArray(data?.references)
      ? data.references
      : []
    const referenceImageIds = Array.isArray(data?.referenceImageIds)
      ? data.referenceImageIds
      : references
          .map((r) => Number(r?.imageId))
          .filter((id) => Number.isFinite(id) && id > 0)
    const referenceImageUrls = Array.isArray(data?.referenceImageUrls)
      ? data.referenceImageUrls
      : references.map((r) => String(r?.url || '').trim()).filter(Boolean)
    const audioReferences: StoryboardAudioReferenceItem[] = Array.isArray(data?.audioReferences)
      ? data.audioReferences
      : []
    return {
      referenceImageIds,
      referenceImageUrls,
      unresolvedNames: Array.isArray(data?.unresolvedNames) ? data.unresolvedNames : [],
      references,
      referenceAudioUrls: Array.isArray(data?.referenceAudioUrls) ? data.referenceAudioUrls : [],
      audioReferences,
      unresolvedAudioNames: Array.isArray(data?.unresolvedAudioNames) ? data.unresolvedAudioNames : [],
      unresolvedAudioRecordIds: Array.isArray(data?.unresolvedAudioRecordIds)
        ? data.unresolvedAudioRecordIds
        : [],
      unresolvedReferenceAudioIds: Array.isArray(data?.unresolvedReferenceAudioIds)
        ? data.unresolvedReferenceAudioIds
        : []
    }
  })
}

/** 登记用户上传参考音频 POST /api/user/reference-audio/upload */
export async function userReferenceAudioUpload(
  body: ReferenceAudioUploadRequest
): Promise<ReferenceAudioVO> {
  const res = await request.post<ApiEnvelope<ReferenceAudioVO>>(
    '/api/user/reference-audio/upload',
    body
  )
  return unwrap(res) as ReferenceAudioVO
}

/** 逻辑删除参考音频 POST /api/user/reference-audio/delete */
export async function userReferenceAudioDelete(body: ReferenceAudioDeleteRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/reference-audio/delete', body)
}

/** 分镜工作台：发起画面生成/抽卡 POST /api/user/storyboard/generate/media */
export async function userStoryboardGenerateMedia(
  body: StoryboardGenerateMediaRequest
): Promise<StoryboardGenerateMediaData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateMediaData>>(
    '/api/user/storyboard/generate/media',
    body
  )
  return unwrap(res)
}

/** 多参生视频（v2.58）：POST /api/user/storyboard/generate/video */
export async function userStoryboardGenerateVideo(
  body: StoryboardVideoGenerateRequest
): Promise<StoryboardVideoGenerateData> {
  const res = await request.post<ApiEnvelope<StoryboardVideoGenerateData>>(
    '/api/user/storyboard/generate/video',
    body
  )
  return unwrap(res)
}

/** 图生视频出片（图生方向）：POST /api/user/storyboard/generate/video/image */
export async function userStoryboardGenerateVideoImage(
  body: StoryboardVideoImageGenerateRequest
): Promise<StoryboardVideoImageGenerateData> {
  const res = await request.post<ApiEnvelope<StoryboardVideoImageGenerateData>>(
    '/api/user/storyboard/generate/video/image',
    body
  )
  return unwrap(res)
}

/** 首尾帧生视频出片：POST /api/user/storyboard/generate/video/edge */
export async function userStoryboardGenerateVideoEdge(
  body: StoryboardVideoEdgeGenerateRequest
): Promise<StoryboardVideoEdgeGenerateData> {
  const res = await request.post<ApiEnvelope<StoryboardVideoEdgeGenerateData>>(
    '/api/user/storyboard/generate/video/edge',
    body
  )
  return unwrap(res)
}

/** 宫格生视频出片：POST /api/user/storyboard/generate/video/grid */
export async function userStoryboardGenerateVideoGrid(
  body: StoryboardVideoGridGenerateRequest
): Promise<StoryboardVideoGridGenerateData> {
  const res = await request.post<ApiEnvelope<StoryboardVideoGridGenerateData>>(
    '/api/user/storyboard/generate/video/grid',
    body
  )
  return unwrap(res)
}

/** @deprecated 请使用 userTaskResume */
export async function userStoryboardGenerateVideoResume(
  body: StoryboardVideoResumeRequest
): Promise<StoryboardVideoGenerateData> {
  return userTaskResume(body) as Promise<StoryboardVideoGenerateData>
}

/** @deprecated 请使用 userTaskResume */
export async function userStoryboardGenerateImageResume(
  body: StoryboardGenerateImageResumeRequest
): Promise<UserTaskResumeData> {
  return userTaskResume(body)
}

/** 分镜工作台：生成分镜图 POST /api/user/storyboard/generate/image（v2.63+ 批量父任务） */
export async function userStoryboardGenerateImage(
  body: StoryboardGenerateImageRequest
): Promise<StoryboardGenerateImageData> {
  const res = await request.post<ApiEnvelope<StoryboardGenerateImageData>>(
    '/api/user/storyboard/generate/image',
    body
  )
  return unwrap(res)
}

/** 分镜编辑图 / 对话作图（v2.57）：POST /api/user/storyboard/generate/edit-image */
export async function userStoryboardGenerateEditImage(
  body: UserStoryboardGenerateEditImageRequest
): Promise<UserStoryboardGenerateEditImageData> {
  const res = await request.post<ApiEnvelope<UserStoryboardGenerateEditImageData>>(
    '/api/user/storyboard/generate/edit-image',
    body
  )
  return unwrap(res)
}

/** 分镜图高清（v2.57）：POST /api/user/storyboard/generate/upscale */
export async function userStoryboardGenerateUpscale(
  body: UserStoryboardGenerateUpscaleRequest
): Promise<UserStoryboardGenerateUpscaleData> {
  const res = await request.post<ApiEnvelope<UserStoryboardGenerateUpscaleData>>(
    '/api/user/storyboard/generate/upscale',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：项目内生成内容列表 POST /api/user/storyboard/record/list-by-storyboard（v2.57.7） */
export async function userStoryboardRecordListByStoryboard(
  body: StoryboardRecordListByStoryboardRequest
): Promise<StoryboardRecordRow[]> {
  const res = await request.post<ApiEnvelope<StoryboardRecordRow[]>>(
    '/api/user/storyboard/record/list-by-storyboard',
    body
  )
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

/** 分镜工作台：物理删除分镜生成记录 POST /api/user/storyboard/record/delete */
export async function userStoryboardRecordDelete(body: StoryboardRecordDeleteRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/record/delete', body)
}

/** 分镜工作台：设置分镜最终图片 POST /api/user/storyboard/setFinalImage（支持单个 / 批量） */
export async function userStoryboardSetFinalImage(
  body: StoryboardSetFinalImageRequest
): Promise<StoryboardSetFinalImageBatchData | null> {
  const res = await request.post<ApiEnvelope<StoryboardSetFinalImageBatchData>>(
    '/api/user/storyboard/setFinalImage',
    body
  )
  return unwrap(res) ?? null
}

/** 分镜工作台：取消分镜最终图片 POST /api/user/storyboard/unSetFinalImage（v2.58） */
export async function userStoryboardUnSetFinalImage(
  body: StoryboardUnSetFinalImageRequest
): Promise<StoryboardSetFinalImageBatchData | null> {
  const res = await request.post<ApiEnvelope<StoryboardSetFinalImageBatchData>>(
    '/api/user/storyboard/unSetFinalImage',
    body
  )
  return unwrap(res) ?? null
}

/** 分镜工作台：设置分镜最终视频 POST /api/user/storyboard/setFinalVideo（v2.62，支持单个 / 批量） */
export async function userStoryboardSetFinalVideo(
  body: StoryboardSetFinalVideoRequest
): Promise<StoryboardSetFinalImageBatchData | null> {
  const res = await request.post<ApiEnvelope<StoryboardSetFinalImageBatchData>>(
    '/api/user/storyboard/setFinalVideo',
    body
  )
  return unwrap(res) ?? null
}

/** 分镜工作台：取消分镜最终视频 POST /api/user/storyboard/unSetFinalVideo（v2.62） */
export async function userStoryboardUnSetFinalVideo(
  body: StoryboardUnSetFinalVideoRequest
): Promise<StoryboardSetFinalImageBatchData | null> {
  const res = await request.post<ApiEnvelope<StoryboardSetFinalImageBatchData>>(
    '/api/user/storyboard/unSetFinalVideo',
    body
  )
  return unwrap(res) ?? null
}

/** 分镜工作台：取消分镜最终配音 POST /api/user/storyboard/unSetFinalAudio（与 unSetFinalVideo 对称） */
export async function userStoryboardUnSetFinalAudio(body: StoryboardUnSetFinalAudioRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/unSetFinalAudio', body)
}

/** 分镜工作台：用户自行上传分镜媒体 POST /api/user/storyboard/upload（图片 / 视频） */
export async function userStoryboardUpload(
  body: StoryboardUploadRequest
): Promise<StoryboardUploadData> {
  const res = await request.post<ApiEnvelope<StoryboardUploadData>>(
    '/api/user/storyboard/upload',
    body
  )
  return unwrap(res)
}

/** @deprecated 请使用 userStoryboardUpload({ ..., mediaType: 'image', imageUrl }) */
export async function userStoryboardUploadImage(
  body: StoryboardUploadImageRequest
): Promise<StoryboardUploadImageData> {
  return userStoryboardUpload({
    projectId: body.projectId,
    episodeId: body.episodeId,
    storyboardId: body.storyboardId,
    imageUrl: body.imageUrl,
    mediaType: 'image'
  })
}

/** @deprecated 请使用 userStoryboardUpload({ ..., mediaType: 'video', imageUrl }) */
export async function userStoryboardUploadVideo(
  body: StoryboardUploadVideoRequest
): Promise<StoryboardUploadVideoData> {
  return userStoryboardUpload({
    projectId: body.projectId,
    episodeId: body.episodeId,
    storyboardId: body.storyboardId,
    imageUrl: String(body.imageUrl || body.videoUrl || ''),
    mediaType: 'video'
  })
}

/**
 * 分镜工作台：发起 AI 配音 POST /api/user/storyboard/generate/audio
 * 正常同步返回 status=SUCCEEDED + audioUrl；仅兜底 PROCESSING 时需轮询 audio/{taskId}。
 * ttsText 出参为服务端清洗后的正文；另含 durationMs、lipSyncStatus。
 */
export async function userStoryboardGenerateAudio(
  body: StoryboardGenerateAudioRequest
): Promise<StoryboardAudioTaskVO> {
  const res = await request.post<ApiEnvelope<StoryboardAudioTaskVO>>(
    '/api/user/storyboard/generate/audio',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：查询配音/对口型任务 GET /api/user/storyboard/audio/{taskId} */
export async function userStoryboardAudioTask(taskId: number): Promise<StoryboardAudioTaskVO> {
  const res = await request.get<ApiEnvelope<StoryboardAudioTaskVO>>(`/api/user/storyboard/audio/${taskId}`)
  return unwrap(res)
}

/**
 * 分镜工作台：发起对口型合成（受理型异步）POST /api/user/storyboard/lipSync
 * 返回 taskId，进度走 GET /api/user/task/stream/{taskId}（与批量对口型同通道）。
 */
export async function userStoryboardLipSync(
  body: StoryboardLipSyncRequest
): Promise<StoryboardLipSyncAcceptVO> {
  const res = await request.post<ApiEnvelope<StoryboardLipSyncAcceptVO>>(
    '/api/user/storyboard/lipSync',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：批量对口型（受理型异步，SSE storyboard_lip_sync_generate）POST /api/user/storyboard/lipSync/batch */
export async function userStoryboardLipSyncBatch(
  body: StoryboardLipSyncBatchRequest
): Promise<StoryboardLipSyncBatchAcceptVO> {
  const res = await request.post<ApiEnvelope<StoryboardLipSyncBatchAcceptVO>>(
    '/api/user/storyboard/lipSync/batch',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：批量配音（受理型异步，SSE storyboard_audio_generate）POST /api/user/storyboard/generate/audio/batch */
export async function userStoryboardGenerateAudioBatch(
  body: StoryboardAudioBatchRequest
): Promise<StoryboardAudioBatchAcceptVO> {
  const res = await request.post<ApiEnvelope<StoryboardAudioBatchAcceptVO>>(
    '/api/user/storyboard/generate/audio/batch',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：发起音画同步（异步，SSE + dubbing/{taskId}）POST /api/user/storyboard/generate/dubbing */
export async function userStoryboardGenerateDubbing(
  body: StoryboardGenerateDubbingRequest
): Promise<StoryboardDubbingTaskVO> {
  const res = await request.post<ApiEnvelope<StoryboardDubbingTaskVO>>(
    '/api/user/storyboard/generate/dubbing',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：查询音画同步任务 GET /api/user/storyboard/dubbing/{taskId} */
export async function userStoryboardDubbingTask(taskId: number): Promise<StoryboardDubbingTaskVO> {
  const res = await request.get<ApiEnvelope<StoryboardDubbingTaskVO>>(
    `/api/user/storyboard/dubbing/${taskId}`
  )
  return unwrap(res)
}

/** 分镜一键配音 + 合成（异步受理）POST /api/user/compose/voiceover */
export async function userComposeVoiceover(
  body: StoryboardComposeRequest
): Promise<ComposeAcceptResult> {
  const res = await request.post<ApiEnvelope<ComposeAcceptResult>>(
    '/api/user/compose/voiceover',
    body
  )
  return unwrap(res)
}

/** 合成进度查询（纯轮询）POST /api/user/compose/status */
export async function userComposeStatus(
  body: ComposeStatusRequest
): Promise<ComposeStatusResult> {
  const res = await request.post<ApiEnvelope<ComposeStatusResult>>(
    '/api/user/compose/status',
    body
  )
  return unwrap(res)
}

/** 前端剪辑器拼接合成（异步受理）POST /api/user/episode/export */
export async function userEpisodeExport(body: EpisodeExportRequest): Promise<EpisodeExportResult> {
  const res = await request.post<ApiEnvelope<EpisodeExportResult>>('/api/user/episode/export', body)
  return unwrap(res)
}

/** 导出进度查询 POST /api/user/episode/export/status */
export async function userEpisodeExportStatus(
  body: EpisodeExportStatusRequest
): Promise<EpisodeExportStatusResult> {
  const res = await request.post<ApiEnvelope<EpisodeExportStatusResult>>(
    '/api/user/episode/export/status',
    body
  )
  return unwrap(res)
}

/** 剪辑时间轴读取（带自动初始化）POST /api/user/episode/timeline/get */
export async function userEpisodeTimelineGet(
  body: EpisodeTimelineGetRequest
): Promise<EpisodeTimelineResult> {
  const res = await request.post<ApiEnvelope<EpisodeTimelineResult>>(
    '/api/user/episode/timeline/get',
    body
  )
  return unwrap(res)
}

/** 剪辑时间轴保存（整份覆盖）POST /api/user/episode/timeline/save */
export async function userEpisodeTimelineSave(
  body: EpisodeTimelineSaveRequest
): Promise<EpisodeTimelineResult> {
  const res = await request.post<ApiEnvelope<EpisodeTimelineResult>>(
    '/api/user/episode/timeline/save',
    body
  )
  return unwrap(res)
}

/** 分段素材批量导出清单 POST /api/user/episode/export/segments */
export async function userEpisodeExportSegments(
  body: EpisodeSegmentVideosRequest
): Promise<EpisodeSegmentVideosResult> {
  const res = await request.post<ApiEnvelope<EpisodeSegmentVideosResult>>(
    '/api/user/episode/export/segments',
    body
  )
  return unwrap(res)
}

/**
 * 分段素材打包下载 POST /api/user/episode/export/segments/zip
 * 返回二进制 zip 流（非 JSON），不走信封加密；用 fetch + blob 接收。
 */
export async function userEpisodeExportSegmentsZip(
  body: EpisodeSegmentZipDownloadRequest
): Promise<{ blob: Blob; filename: string }> {
  const url = resolveClientApiUrl('/api/user/episode/export/segments/zip')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildUserApiAuthHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/zip, application/json'
    },
    body: JSON.stringify({
      projectId: body.projectId,
      episodeId: body.episodeId,
      includeImages: body.includeImages ?? true,
      includeVideos: body.includeVideos ?? true,
      includeAudios: body.includeAudios ?? true,
      includeSubtitles: body.includeSubtitles ?? true
    })
  })

  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  if (!res.ok || contentType.includes('application/json')) {
    let msg = '分段素材打包失败'
    try {
      const data = (await res.json()) as { msg?: string; message?: string; code?: number }
      msg = String(data?.msg || data?.message || msg)
      if (isInsufficientBalanceMessage(msg)) {
        openRechargeModalFromInsufficientBalance(msg)
      }
    } catch {
      /* ignore parse */
    }
    throw new Error(msg)
  }

  const blob = await res.blob()
  if (!blob || blob.size <= 0) {
    throw new Error('暂无可导出素材')
  }

  const headerName =
    String(res.headers.get('download-filename') || '').trim() ||
    parseContentDispositionFilename(res.headers.get('content-disposition'))
  const filename =
    headerName ||
    `分镜素材_${body.projectId}_${body.episodeId}.zip`

  return { blob, filename }
}

/**
 * 成片 mp4 附件流下载 POST /api/user/episode/export/download
 * 响应为二进制视频流（非 JSON），不走信封加密；用 fetch + blob 接收。
 */
export async function userEpisodeExportDownload(
  body: EpisodeFinalVideoDownloadRequest
): Promise<{ blob: Blob; filename: string }> {
  const url = resolveClientApiUrl('/api/user/episode/export/download')
  const payload: Record<string, number> = {}
  const editorId = Number(body.episodeEditorId)
  if (Number.isFinite(editorId) && editorId > 0) {
    payload.episodeEditorId = editorId
  } else {
    const projectId = Number(body.projectId)
    const episodeId = Number(body.episodeId)
    if (!Number.isFinite(projectId) || projectId <= 0) {
      throw new Error('参数有误')
    }
    payload.projectId = projectId
    payload.episodeId = Number.isFinite(episodeId) && episodeId >= 0 ? episodeId : 0
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildUserApiAuthHeaders(),
      'Content-Type': 'application/json',
      Accept: 'video/mp4, application/json'
    },
    body: JSON.stringify(payload)
  })

  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  if (!res.ok || contentType.includes('application/json')) {
    let msg = '成片下载失败'
    try {
      const data = (await res.json()) as { msg?: string; message?: string; code?: number }
      msg = String(data?.msg || data?.message || msg)
      if (isInsufficientBalanceMessage(msg)) {
        openRechargeModalFromInsufficientBalance(msg)
      }
    } catch {
      /* ignore parse */
    }
    throw new Error(msg)
  }

  const blob = await res.blob()
  if (!blob || blob.size <= 0) {
    throw new Error('暂无成片')
  }

  const headerName =
    String(res.headers.get('download-filename') || '').trim() ||
    parseContentDispositionFilename(res.headers.get('content-disposition'))
  const filename = headerName || `成片_${payload.projectId ?? payload.episodeEditorId}.mp4`

  return { blob, filename }
}

function parseContentDispositionFilename(raw: string | null): string {
  const header = String(raw || '')
  if (!header) return ''
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''))
    } catch {
      return utf8[1].trim()
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() || ''
}

/** 触发浏览器保存 blob 文件 */
export function triggerBrowserBlobDownload(blob: Blob, filename: string) {
  if (typeof document === 'undefined') return
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename || 'download.zip'
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    try {
      a.remove()
      URL.revokeObjectURL(href)
    } catch {
      /* ignore */
    }
  }, 2_000)
}

/** 邀请码预校验（匿名）POST /api/user/invite/check */
export async function userInviteCheck(body: InviteCodeCheckRequest): Promise<InviteCodeCheckVO> {
  const res = await request.post<ApiEnvelope<InviteCodeCheckVO>>('/api/user/invite/check', body)
  return unwrap(res)
}

/** 我的邀请信息 POST /api/user/invite/info */
export async function userInviteInfo(): Promise<InviteInfoVO> {
  const res = await request.post<ApiEnvelope<InviteInfoVO>>('/api/user/invite/info', {})
  return unwrap(res)
}

/** 我邀请的用户列表 POST /api/user/invite/users */
export async function userInviteUsers(
  body: InviteUsersRequest = {}
): Promise<{ data: InvitedUserVO[]; total: number }> {
  const res = await request.post<ApiListEnvelopeData<InvitedUserVO>>(
    '/api/user/invite/users',
    body
  )
  return { data: Array.isArray(res.data) ? res.data : [], total: Number(res.total) || 0 }
}

/** 我的返佣明细 POST /api/user/invite/rebates */
export async function userInviteRebates(
  body: InviteRebatesRequest = {}
): Promise<{ data: InviteRebateItemVO[]; total: number }> {
  const res = await request.post<ApiListEnvelopeData<InviteRebateItemVO>>(
    '/api/user/invite/rebates',
    body
  )
  return { data: Array.isArray(res.data) ? res.data : [], total: Number(res.total) || 0 }
}

/** 文字转语音同步试听（字数上限见 /auth/public-config voicePreview）POST /api/user/voice/preview */
export async function userVoicePreview(body: VoicePreviewRequest): Promise<VoicePreviewResult> {
  const res = await request.post<ApiEnvelope<VoicePreviewResult>>('/api/user/voice/preview', body)
  return unwrap(res)
}

/** AI 模型列表：POST /api/user/model/list */
export async function userModelList(body: UserModelListRequest = {}): Promise<UserModelListItem[]> {
  const res = await request.post<ApiEnvelope<UserModelListItem[]>>('/api/user/model/list', body)
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

function emptyListByFuncGroup(funcCode: string): UserModelListByFuncGroupVO {
  return { funcCode, models: [] }
}

/** 将 listByFunc 出参归一化为与入参 funcCodes 顺序一致的分组列表 */
function normalizeListByFuncGroups(
  data: unknown,
  requestedCodes: readonly string[]
): UserModelListByFuncGroupVO[] {
  if (!requestedCodes.length) return []

  if (!Array.isArray(data) || data.length === 0) {
    return requestedCodes.map(emptyListByFuncGroup)
  }

  const first = data[0]
  if (first && typeof first === 'object' && ('funcCode' in first || 'models' in first)) {
    const byCode = new Map<string, UserModelListByFuncGroupVO>()
    for (const raw of data as UserModelListByFuncGroupVO[]) {
      const code = String(raw?.funcCode || '').trim()
      if (!code) continue
      byCode.set(code, {
        ...raw,
        funcCode: code,
        models: Array.isArray(raw.models) ? raw.models : []
      })
    }
    return requestedCodes.map((code) => byCode.get(code) ?? emptyListByFuncGroup(code))
  }

  // 兼容旧版：单 funcCode 请求时 data 为扁平模型数组
  if (requestedCodes.length === 1) {
    return [{ funcCode: requestedCodes[0], models: data as UserModelListItem[] }]
  }

  return requestedCodes.map(emptyListByFuncGroup)
}

/** 按多个功能编码批量查询模型列表：POST /api/user/model/listByFunc */
export async function userModelListByFuncCodes(
  funcCodes: readonly string[],
  scope?: Pick<UserModelListByFuncRequest, 'projectId' | 'episodeId'>
): Promise<UserModelListByFuncGroupVO[]> {
  const codes = [...new Set(funcCodes.map((c) => String(c || '').trim()).filter(Boolean))]
  if (!codes.length) return []
  const body: UserModelListByFuncRequest = { funcCodes: codes }
  const projectId = Number(scope?.projectId)
  if (Number.isFinite(projectId) && projectId > 0) {
    body.projectId = projectId
    if (scope?.episodeId != null && Number.isFinite(Number(scope.episodeId))) {
      body.episodeId = Number(scope.episodeId)
    }
  }
  const key = stableRequestKey(body)
  return runListDedupe(key, modelListByFuncInflight, modelListByFuncBurst, async () => {
    const res = await request.post<ApiEnvelope<UserModelListByFuncGroupVO[] | UserModelListItem[]>>(
      '/api/user/model/listByFunc',
      body
    )
    return normalizeListByFuncGroups(unwrap(res), codes)
  })
}

/** 按功能编码查询可用模型列表：POST /api/user/model/listByFunc（v2.34.0） */
export async function userModelListByFunc(
  funcCode: string,
  scope?: Pick<UserModelListByFuncRequest, 'projectId' | 'episodeId'>
): Promise<UserModelListItem[]> {
  const normalized = String(funcCode || '').trim()
  if (!normalized) return []
  const groups = await userModelListByFuncCodes([normalized], scope)
  // 专业版可能把 main_storyboard_video 重映射为 multi_pro，按首个非空分组取模型
  const hit =
    groups.find((g) => String(g.funcCode || '').trim() === normalized) ||
    groups.find((g) => Array.isArray(g.models) && g.models.length > 0)
  return Array.isArray(hit?.models) ? hit!.models! : []
}

/** C 端一次性拉取音色筛选字典：POST /api/user/voice-library/tags（并发合并 + 短时缓存） */
const voiceLibraryTagsInflight = new Map<string, Promise<VoiceTagBundleData>>()
const voiceLibraryTagsBurst: ListBurstSlot<VoiceTagBundleData> = { current: null }

export async function userVoiceLibraryTags(): Promise<VoiceTagBundleData> {
  return runListDedupe(
    'voice-library-tags',
    voiceLibraryTagsInflight,
    voiceLibraryTagsBurst,
    async () => {
      const res = await request.post<ApiEnvelope<VoiceTagBundleData>>(
        '/api/user/voice-library/tags',
        {}
      )
      return unwrap(res)
    },
    30_000
  )
}

/** C 端查询音色列表：POST /api/user/voice-library/list */
export async function userVoiceLibraryList(body: {
  pageNum?: number
  pageSize?: number
  language?: string
  gender?: string
  ageRange?: string
  voiceName?: string
  characterType?: string
  voiceStyle?: string
  toneTag?: string
  emotionTag?: string
} = {}): Promise<{ data: any[]; total: number }> {
  const res = await request.post<{ code: number; msg: string; data: any[]; total: number }>(
    '/api/user/voice-library/list',
    body
  )
  return { data: Array.isArray(res.data) ? res.data : [], total: Number(res.total) || 0 }
}

/** 角色音色绑定：POST /api/user/asset/rps/voice/bind */
export async function userRoleVoiceBind(body: {
  assetId: number
  voiceLibraryId: number
  overrideSpeed?: number
  overridePitch?: number
  overrideEmotion?: string
}): Promise<RoleVoiceBindingVO> {
  const res = await request.post<ApiEnvelope<RoleVoiceBindingVO>>('/api/user/asset/rps/voice/bind', body)
  return unwrap(res)
}

/** 查询角色音色绑定：POST /api/user/asset/rps/voice/query */
export async function userRoleVoiceQuery(body: { assetId: number }): Promise<RoleVoiceBindingVO | null> {
  const res = await request.post<ApiEnvelope<RoleVoiceBindingVO | null>>(
    '/api/user/asset/rps/voice/query',
    body
  )
  return unwrap(res)
}

/** 解除角色音色绑定：POST /api/user/asset/rps/voice/unbind */
export async function userRoleVoiceUnbind(body: { assetId: number }): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/asset/rps/voice/unbind', body)
}

/** C 端：按业务分类分组查询启用智能体列表 POST /aid/agent/list */
export async function aidAgentList(body?: AidAgentListRequest): Promise<AgentListGroupVO[]> {
  const payload = body ?? {}
  const key = stableRequestKey(payload)
  return runListDedupe(key, aidAgentListInflight, aidAgentListBurst, async () => {
    const res = await request.post<ApiEnvelope<AgentListGroupVO[]>>('/aid/agent/list', payload)
    const data = unwrap(res)
    return Array.isArray(data) ? data : []
  })
}

/** 资产提取费用预估：POST /api/user/asset/extract/estimate */
export async function userAssetExtractEstimate(
  body: UserAssetExtractEstimateRequest
): Promise<UserAssetExtractEstimateData> {
  const res = await request.post<ApiEnvelope<UserAssetExtractEstimateData>>(
    '/api/user/asset/extract/estimate',
    body
  )
  return unwrap(res)
}

/** 查询项目级生成配置（懒加载 + aid_config 兜底）：POST /api/user/project/gen-config/get */
export async function userProjectGenConfigGet(
  body: ProjectGenConfigQueryRequest
): Promise<ProjectGenConfigVO[]> {
  const res = await request.post<ApiEnvelope<ProjectGenConfigVO[]>>(
    '/api/user/project/gen-config/get',
    body
  )
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

/** 保存项目级生成配置（部分更新）：POST /api/user/project/gen-config/save */
export async function userProjectGenConfigSave(
  body: ProjectGenConfigSaveRequest
): Promise<ProjectGenConfigSavedItem[]> {
  const res = await request.post<ApiEnvelope<ProjectGenConfigSavedItem[]>>(
    '/api/user/project/gen-config/save',
    body
  )
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

/** 资产提取任务提交：POST /api/user/asset/extract/parallel */
export async function userAssetExtractParallel(
  body: UserAssetExtractParallelRequest
): Promise<UserTaskRow> {
  const res = await request.post<ApiEnvelope<UserTaskRow>>('/api/user/asset/extract/parallel', body)
  return unwrap(res)
}

/** 取消任务：POST /api/user/asset/extract/cancel — @deprecated 请使用 userTaskCancel */
export async function userAssetExtractCancel(body: UserAssetExtractCancelRequest): Promise<unknown> {
  return userTaskCancel({ taskId: body.taskId })
}

/** @deprecated 请使用 userTaskResume */
export async function userAssetExtractResume(
  body: UserAssetExtractResumeRequest
): Promise<UserAssetExtractResumeData> {
  return userTaskResume(body)
}

/** 资产形态生成（父任务 form_generate_batch）：POST /api/user/asset/extract/form/generate */
export async function userAssetExtractFormGenerate(
  body: UserAssetExtractFormGenerateRequest
): Promise<UserAssetExtractFormGenerateData> {
  const res = await request.post<ApiEnvelope<UserAssetExtractFormGenerateData>>(
    '/api/user/asset/extract/form/generate',
    body
  )
  return unwrap(res)
}

/** 形态图生成（父任务 form_image_batch，v2.41+ 纯文生图）：POST /api/user/asset/extract/form/generate-image */
export async function userAssetExtractFormGenerateImage(
  body: UserAssetExtractFormGenerateImageRequest
): Promise<UserAssetExtractFormGenerateImageData> {
  const res = await request.post<ApiEnvelope<UserAssetExtractFormGenerateImageData>>(
    '/api/user/asset/extract/form/generate-image',
    body
  )
  return unwrap(res)
}

/** 角色设定卡生成（第二阶段 form_card_image_batch）：POST /api/user/asset/extract/form/generate-card-image */
export async function userAssetExtractFormGenerateCardImage(
  body: UserAssetExtractFormGenerateCardImageRequest
): Promise<UserAssetExtractFormGenerateCardImageData> {
  const res = await request.post<ApiEnvelope<UserAssetExtractFormGenerateCardImageData>>(
    '/api/user/asset/extract/form/generate-card-image',
    body
  )
  return unwrap(res)
}

/** 刷新/路由抖动时同一请求体会在短时间内连发多次；并发合并 + 短时缓存避免 Network 里同名「list」刷屏 */
const API_LIST_BURST_CACHE_MS = 450
/** 任务 list 恢复场景跨 bootstrap / scope-resume / 角标预拉，间隔常 >450ms，单独延长缓存 */
const USER_TASK_LIST_BURST_CACHE_MS = 3000

function stableRequestKey(body: unknown): string {
  if (body == null || typeof body !== 'object') return JSON.stringify(body)
  const o = body as Record<string, unknown>
  const keys = Object.keys(o).sort()
  const sorted: Record<string, unknown> = {}
  for (const k of keys) sorted[k] = o[k]
  return JSON.stringify(sorted)
}

/** 列表类接口共用的：短时 burst 缓存 + 同 key 并发合并（避免四处复制同一套 if/inflight/finally） */
type ListBurstSlot<T> = { current: { key: string; data: T; at: number } | null }

const storyboardListInflight = new Map<string, Promise<UserStoryboardListRow[]>>()
const storyboardListBurst: ListBurstSlot<UserStoryboardListRow[]> = { current: null }

const imagePromptResolveInflight = new Map<string, Promise<StoryboardImagePromptResolveData>>()
const imagePromptResolveBurst: ListBurstSlot<StoryboardImagePromptResolveData> = { current: null }

const modelListByFuncInflight = new Map<string, Promise<UserModelListByFuncGroupVO[]>>()
const modelListByFuncBurst: ListBurstSlot<UserModelListByFuncGroupVO[]> = { current: null }

const aidAgentListInflight = new Map<string, Promise<AgentListGroupVO[]>>()
const aidAgentListBurst: ListBurstSlot<AgentListGroupVO[]> = { current: null }

function runListDedupe<T>(
  key: string,
  inflight: Map<string, Promise<T>>,
  burst: ListBurstSlot<T>,
  fetcher: () => Promise<T>,
  burstMs = API_LIST_BURST_CACHE_MS
): Promise<T> {
  const now = Date.now()
  const b = burst.current
  if (b && b.key === key && now - b.at < burstMs) {
    return Promise.resolve(b.data)
  }
  const existing = inflight.get(key)
  if (existing) return existing
  const p = (async () => {
    const data = await fetcher()
    burst.current = { key, data, at: Date.now() }
    return data
  })().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

const userTaskListPageInflight = new Map<string, Promise<PaginatedListResult<UserTaskRow>>>()
const userTaskListPageBurst: ListBurstSlot<PaginatedListResult<UserTaskRow>> = {
  current: null
}

const userTaskListInflight = new Map<string, Promise<UserTaskRow[]>>()
const userTaskListBurst: ListBurstSlot<UserTaskRow[]> = { current: null }

function userTaskListDedupeKey(body: UserTaskListRequest): string {
  const pid =
    body.projectId != null && Number.isFinite(Number(body.projectId)) ? Number(body.projectId) : null
  return JSON.stringify({
    p: pid,
    t: body.taskType ?? null,
    s: body.status ?? null,
    pn: body.pageNum ?? null,
    ps: body.pageSize ?? null
  })
}

const userTaskListRecentInflight = new Map<string, Promise<UserTaskRow[]>>()
const userTaskListRecentBurst: ListBurstSlot<UserTaskRow[]> = { current: null }

/** 任务恢复/续跟只拉最近一页，避免 userTaskList 全量分页在 Network 里连打多次 list */
export const USER_TASK_LIST_RESTORE_PAGE_SIZE = 50

/** 任务终态刷新时清掉 list 短时缓存，避免角标仍读到旧的「进行中」行 */
export function invalidateUserTaskListCache(): void {
  userTaskListPageBurst.current = null
  userTaskListBurst.current = null
  userTaskListRecentBurst.current = null
}

/** 通用任务列表（分页）：POST /api/user/task/list */
export async function userTaskListPage(
  body: UserTaskListRequest = {}
): Promise<PaginatedListResult<UserTaskRow>> {
  const pageNum = body.pageNum ?? 1
  const pageSize = body.pageSize ?? API_DEFAULT_PAGE_SIZE
  const key = userTaskListDedupeKey({ ...body, pageNum, pageSize })
  return runListDedupe(
    key,
    userTaskListPageInflight,
    userTaskListPageBurst,
    async () => {
      const res = await request.post('/api/user/task/list', { ...body, pageNum, pageSize })
      return extractPaginatedResponse<UserTaskRow>(res, pageNum, pageSize)
    },
    USER_TASK_LIST_BURST_CACHE_MS
  )
}

/** 拉取满足条件的全部任务（内部分页循环，供任务恢复等场景） */
export async function fetchAllUserTaskRows(
  body: Omit<UserTaskListRequest, 'pageNum' | 'pageSize'> = {}
): Promise<UserTaskRow[]> {
  return fetchAllPaginatedRows(userTaskListPage, body)
}

/** 只拉第一页最近任务（恢复/续跟：避免全量分页连续请求 /task/list） */
export async function userTaskListRecentPage(
  body: Omit<UserTaskListRequest, 'pageNum' | 'pageSize'> = {},
  pageSize = USER_TASK_LIST_RESTORE_PAGE_SIZE
): Promise<UserTaskRow[]> {
  const key = userTaskListDedupeKey({ ...body, pageNum: 1, pageSize })
  return runListDedupe(
    key,
    userTaskListRecentInflight,
    userTaskListRecentBurst,
    async () => {
      const { rows } = await userTaskListPage({ ...body, pageNum: 1, pageSize })
      return rows
    },
    USER_TASK_LIST_BURST_CACHE_MS
  )
}

/** 通用任务列表：POST /api/user/task/list（未传 pageNum/pageSize 时自动拉取全部页） */
export async function userTaskList(body: UserTaskListRequest = {}): Promise<UserTaskRow[]> {
  if (body.pageNum != null || body.pageSize != null) {
    const { rows } = await userTaskListPage(body)
    return rows
  }
  const key = userTaskListDedupeKey(body)
  return runListDedupe(key, userTaskListInflight, userTaskListBurst, () => fetchAllUserTaskRows(body))
}

const userProjectListInflight = new Map<string, Promise<{ total: number; rows: UserProjectRow[] }>>()
const userProjectListBurst: ListBurstSlot<{ total: number; rows: UserProjectRow[] }> = { current: null }

const publicProjectVideoListInflight = new Map<
  string,
  Promise<{ total: number; rows: PublicProjectVideoRow[] }>
>()
const publicProjectVideoListBurst: ListBurstSlot<{ total: number; rows: PublicProjectVideoRow[] }> = {
  current: null
}

const userHomeBannerListInflight = new Map<string, Promise<PaginatedListResult<HomeBannerVO>>>()
const userHomeBannerListBurst: ListBurstSlot<PaginatedListResult<HomeBannerVO>> = { current: null }

const userAssetCustomTypeListInflight = new Map<string, Promise<UserAssetCustomTypeItem[]>>()
const userAssetCustomTypeListBurst: ListBurstSlot<UserAssetCustomTypeItem[]> = { current: null }

const userAssetMergedPageInflight = new Map<string, Promise<{ total: number; list: MergedAssetVO[] }>>()
const userAssetMergedPageBurst: ListBurstSlot<{ total: number; list: MergedAssetVO[] }> = {
  current: null
}

const rpsListInflight = new Map<string, Promise<{ rows: UserAssetRpsRow[]; total: number }>>()
const rpsListBurst: ListBurstSlot<{ rows: UserAssetRpsRow[]; total: number }> = { current: null }

const rpsFormListInflight = new Map<string, Promise<UserAssetRpsFormRow[]>>()
const rpsFormListBurst: ListBurstSlot<UserAssetRpsFormRow[]> = { current: null }

const rpsFormImageListInflight = new Map<string, Promise<UserAssetRpsFormImageRow[]>>()
const rpsFormImageListBurst: ListBurstSlot<UserAssetRpsFormImageRow[]> = { current: null }

/** 通用任务详情：POST /api/user/task/detail */
export async function userTaskDetail(body: UserTaskDetailRequest): Promise<UserTaskDetailData> {
  const res = await request.post<ApiEnvelope<UserTaskDetailData>>('/api/user/task/detail', body)
  return unwrap(res)
}

const userTaskDetailInflight = new Map<number, Promise<UserTaskDetailData>>()
const userTaskDetailBurst = new Map<number, { data: UserTaskDetailData; at: number }>()
const USER_TASK_DETAIL_BURST_MS = 3000

/** 刷新/恢复阶段合并同 taskId 的 detail 请求；SSE 终态后请 {@link invalidateUserTaskDetailCache} 再 force 拉取 */
export async function userTaskDetailCached(
  taskId: number,
  options?: { force?: boolean }
): Promise<UserTaskDetailData | null> {
  const id = Number(taskId)
  if (!Number.isFinite(id) || id <= 0) return null
  if (!options?.force) {
    const burst = userTaskDetailBurst.get(id)
    if (burst && Date.now() - burst.at < USER_TASK_DETAIL_BURST_MS) {
      return burst.data
    }
    const inflight = userTaskDetailInflight.get(id)
    if (inflight) return inflight
  } else {
    userTaskDetailBurst.delete(id)
  }
  const p = userTaskDetail({ taskId: id })
    .then((data) => {
      userTaskDetailBurst.set(id, { data, at: Date.now() })
      return data
    })
    .finally(() => {
      userTaskDetailInflight.delete(id)
    })
  userTaskDetailInflight.set(id, p)
  return p.catch(() => null)
}

export function invalidateUserTaskDetailCache(taskId?: number): void {
  if (taskId != null && Number.isFinite(Number(taskId)) && Number(taskId) > 0) {
    userTaskDetailBurst.delete(Number(taskId))
    return
  }
  userTaskDetailBurst.clear()
}

/** 停止生成/取消单个任务：POST /api/user/task/cancel */
export async function userTaskCancel(body: UserTaskCancelRequest): Promise<unknown> {
  const res = await request.post<ApiEnvelope<unknown>>('/api/user/task/cancel', body)
  return unwrap(res)
}

/** 批量取消 PENDING 独立任务（停止剩余）：POST /api/user/task/cancel-batch */
export async function userTaskCancelBatch(
  body: UserTaskCancelBatchRequest
): Promise<UserTaskCancelBatchData> {
  const res = await request.post<ApiEnvelope<UserTaskCancelBatchData>>(
    '/api/user/task/cancel-batch',
    body
  )
  const data = unwrap(res)
  return {
    cancelCount: Number(data?.cancelCount ?? 0)
  }
}

/** 官方只读参数词库：分类列表 POST /api/user/prompt/official/category/list */
export async function userPromptOfficialCategoryList(): Promise<OfficialPromptCategoryItem[]> {
  const res = await request.post<ApiEnvelope<OfficialPromptCategoryItem[]>>('/api/user/prompt/official/category/list', {})
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

/** 官方只读参数词库：词条列表（分页） POST /api/user/prompt/official/item/list */
export async function userPromptOfficialItemListPage(
  body: OfficialPromptItemListRequest
): Promise<PaginatedListResult<OfficialPromptItem>> {
  const pageNum = body.pageNum ?? 1
  const pageSize = body.pageSize ?? API_DEFAULT_PAGE_SIZE
  const res = await request.post('/api/user/prompt/official/item/list', { ...body, pageNum, pageSize })
  return extractPaginatedResponse<OfficialPromptItem>(res, pageNum, pageSize)
}

/** 官方词库词条全量拉取 pageSize（数据量有限，避免初始化时分页循环多次请求） */
const OFFICIAL_PROMPT_ITEM_ALL_PAGE_SIZE = 2000

const officialPromptItemListCache = new Map<string, OfficialPromptItem[]>()
const officialPromptItemListInflight = new Map<string, Promise<OfficialPromptItem[]>>()

function officialPromptItemListCacheKey(
  body: Omit<OfficialPromptItemListRequest, 'pageNum' | 'pageSize'>
): string {
  const codes = body.categoryCodes?.length
    ? [...body.categoryCodes].sort().join(',')
    : (body.categoryCode ?? '')
  return `${codes}|${body.keyword ?? ''}`
}

/** 拉取满足条件的全部官方词条（单次大页请求，避免循环分页） */
export async function fetchAllOfficialPromptItems(
  body: Omit<OfficialPromptItemListRequest, 'pageNum' | 'pageSize'>
): Promise<OfficialPromptItem[]> {
  const { rows } = await userPromptOfficialItemListPage({
    ...body,
    pageNum: 1,
    pageSize: OFFICIAL_PROMPT_ITEM_ALL_PAGE_SIZE
  })
  return rows
}

/** 官方只读参数词库：词条列表 POST /api/user/prompt/official/item/list（未传分页时单次拉取并缓存） */
export async function userPromptOfficialItemList(
  body: OfficialPromptItemListRequest
): Promise<OfficialPromptItem[]> {
  if (body.pageNum != null || body.pageSize != null) {
    const { rows } = await userPromptOfficialItemListPage(body)
    return rows
  }

  const cacheKey = officialPromptItemListCacheKey(body)
  const cached = officialPromptItemListCache.get(cacheKey)
  if (cached) return cached

  let inflight = officialPromptItemListInflight.get(cacheKey)
  if (!inflight) {
    inflight = fetchAllOfficialPromptItems(body).then((rows) => {
      officialPromptItemListCache.set(cacheKey, rows)
      return rows
    }).finally(() => {
      officialPromptItemListInflight.delete(cacheKey)
    })
    officialPromptItemListInflight.set(cacheKey, inflight)
  }
  return inflight
}

/** 官方只读参数词库：词条详情 POST /api/user/prompt/official/item/detail */
export async function userPromptOfficialItemDetail(
  body: OfficialPromptItemDetailRequest
): Promise<OfficialPromptItem> {
  const res = await request.post<ApiEnvelope<OfficialPromptItem>>('/api/user/prompt/official/item/detail', body)
  return unwrap(res)
}

const userDictEnumListInflight = new Map<string, Promise<EnumDictGroup[]>>()
const userDictEnumListBurst: ListBurstSlot<EnumDictGroup[]> = { current: null }

/** 枚举字典：查询枚举 POST /api/user/dict/enum/list */
export async function userDictEnumList(body: EnumDictListRequest): Promise<EnumDictGroup[]> {
  const enumTypes = body.enumTypes ?? []
  // 去重 key 按类型名排序，避免同一批枚举因顺序不同打成两次
  const key = stableRequestKey({ enumTypes: [...enumTypes].map(String).sort() })
  return runListDedupe(key, userDictEnumListInflight, userDictEnumListBurst, async () => {
    const res = await request.post<ApiEnvelope<EnumDictGroup[]>>('/api/user/dict/enum/list', body)
    const data = unwrap(res)
    return Array.isArray(data) ? data : []
  })
}

/** 首页 Banner 列表：POST /api/user/home/banner/list */
export async function userHomeBannerList(
  body: HomeBannerListRequest = {}
): Promise<PaginatedListResult<HomeBannerVO>> {
  const pageNum = body.pageNum ?? 1
  const pageSize = body.pageSize ?? 10
  const reqBody = { ...body, pageNum, pageSize }
  const key = stableRequestKey(reqBody)
  return runListDedupe(key, userHomeBannerListInflight, userHomeBannerListBurst, async () => {
    const res = await request.post('/api/user/home/banner/list', reqBody)
    return extractPaginatedResponse<HomeBannerVO>(res, pageNum, pageSize)
  })
}

/** 计费详情（公共）：POST /api/public/billing/detail */
export async function publicBillingDetail(
  body: PublicBillingDetailRequest = {}
): Promise<PublicBillingDetailData> {
  const res = await request.post<ApiEnvelope<PublicBillingDetailData>>('/api/public/billing/detail', body)
  const data = unwrap(res)
  return {
    creditUnit: data?.creditUnit ?? 'Credits',
    llm: Array.isArray(data?.llm) ? data.llm : [],
    image: Array.isArray(data?.image) ? data.image : [],
    video: Array.isArray(data?.video) ? data.video : [],
    voice: Array.isArray(data?.voice) ? data.voice : []
  }
}

/** 常见问题列表：POST /api/user/faq/list */
export async function userFaqList(
  body: UserFaqListRequest = {}
): Promise<PaginatedListResult<UserFaqListItem>> {
  const pageNum = body.pageNum ?? 1
  const pageSize = body.pageSize ?? API_DEFAULT_PAGE_SIZE
  const res = await request.post('/api/user/faq/list', { ...body, pageNum, pageSize })
  return extractPaginatedResponse<UserFaqListItem>(res, pageNum, pageSize)
}

/** 常见问题详情：POST /api/user/faq/detail */
export async function userFaqDetail(body: UserFaqDetailRequest): Promise<UserFaqDetail> {
  const res = await request.post<ApiEnvelope<UserFaqDetail>>('/api/user/faq/detail', body)
  return unwrap(res)
}

export type { WechatLoginSuccessData }
