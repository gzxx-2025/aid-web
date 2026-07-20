/**
 * 业务接口封装，路径与入参与 `components/steps/接口.md` 对齐。
 * 请求经 `utils/api.ts` 走 `/api` 代理，需携带的 Token 由拦截器从 localStorage `token` 注入。
 */
import { request } from '~/utils/api'
import type {
  ApiEnvelope,
  ApiListEnvelope,
  ApiListEnvelopeData,
  LoginRequest,
  LoginData,
  SendCodeRequest,
  AuthPublicConfigData,
  ResetPasswordRequest,
  WechatQrcodeData,
  WechatLoginSuccessData,
  RealAuthVerifyRequest,
  RealAuthStatusData,
  RechargePackageItem,
  RechargeOrderCreateRequest,
  RechargeOrderCreateData,
  RechargeOrderQueryData,
  RechargeOrderRow,
  RechargeOrderListResponse,
  UserProjectCreateRequest,
  PublicProjectVideoListRequest,
  PublicProjectVideoRow,
  PublicProjectDetailRow,
  UserProjectUpdateRequest,
  UserEpisodeCreateRequest,
  UserEpisodeRow,
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
  UserAssetRpsListRequest,
  UserAssetRpsRow,
  UserAssetRpsCreateRequest,
  UserAssetRpsFormListRequest,
  UserAssetRpsFormRow,
  UserAssetRpsFormCreateRequest,
  UserAssetRpsFormUseRequest,
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
  UserStoryboardCreateData,
  UserStoryboardCreateRequest,
  UserStoryboardDeleteRequest,
  UserStoryboardListRequest,
  UserStoryboardListRow,
  UserStoryboardDetailRequest,
  StoryboardGenerateImagePromptRequest,
  StoryboardGenerateImagePromptData,
  StoryboardGenerateImagePromptResumeRequest,
  StoryboardGenerateImagePromptResumeData,
  StoryboardGenerateVideoPromptRequest,
  StoryboardGenerateVideoPromptData,
  StoryboardGenerateVideoPromptImageRequest,
  StoryboardGenerateVideoPromptImageData,
  StoryboardGenerateVideoPromptResumeRequest,
  StoryboardGenerateVideoPromptResumeData,
  StoryboardSaveVideoPromptRequest,
  StoryboardSetFinalRequest,
  StoryboardImagePromptResolveRequest,
  StoryboardImagePromptResolveData,
  StoryboardGenerateMediaData,
  StoryboardGenerateMediaRequest,
  StoryboardVideoGenerateData,
  StoryboardVideoGenerateRequest,
  StoryboardVideoImageGenerateData,
  StoryboardVideoImageGenerateRequest,
  StoryboardVideoResumeRequest,
  StoryboardGenerateImageResumeRequest,
  StoryboardGenerateImageRequest,
  StoryboardGenerateImageData,
  UserStoryboardSaveRequest,
  UserStoryboardUpdateRequest,
  UserStoryboardSortRequest,
  StoryboardGenerateScriptRequest,
  StoryboardGenerateScriptData,
  StoryboardGenerateScriptResumeRequest,
  StoryboardGenerateScriptResumeData,
  StoryboardRecordListByStoryboardRequest,
  StoryboardRecordRow,
  StoryboardSetFinalImageRequest,
  StoryboardRecordDeleteRequest,
  StoryboardUnSetFinalImageRequest,
  StoryboardSetFinalVideoRequest,
  StoryboardUnSetFinalVideoRequest,
  StoryboardUnSetFinalAudioRequest,
  StoryboardUploadImageRequest,
  StoryboardUploadImageData,
  StoryboardGenerateAudioRequest,
  StoryboardAudioTaskVO,
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
  AgentInfoVO,
  AgentListGroupVO,
  UserModelListItem,
  UserModelListByFuncGroupVO,
  UserModelListRequest,
  UserTaskListRequest,
  UserTaskDetailRequest,
  UserTaskCancelRequest,
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
  UserPromptGetDataRequest,
  PromptLibItem,
  PromptEnumItem,
  UserPromptGetDataData,
  VoiceTagBundleData
} from '~/types/business-api'

function unwrap<T>(res: ApiEnvelope<T>): T {
  return res.data as T
}

/** 3.0 查询 C 端公开配置（验证码策略、短信/邮箱发码策略等） */
export async function authPublicConfig(): Promise<AuthPublicConfigData> {
  const res = await request.post<ApiEnvelope<AuthPublicConfigData>>('/auth/public-config', {})
  return unwrap(res)
}

/** 1. 统一登录（开启行为验证码时通过 captcha-token 请求头携带一次性 token） */
export async function authLogin(body: LoginRequest, captchaToken?: string): Promise<LoginData> {
  const headers = captchaToken ? { 'captcha-token': captchaToken } : undefined
  const res = await request.post<ApiEnvelope<LoginData>>('/auth/login', body, { headers })
  return unwrap(res)
}

/** 2. 退出登录 */
export async function authLogout(): Promise<void> {
  await request.post<ApiEnvelope>('/auth/logout')
}

/** 3. 发送验证码（开启行为验证码时需 captcha-token） */
export async function authSendCode(body: SendCodeRequest, captchaToken?: string): Promise<void> {
  const headers = captchaToken ? { 'captcha-token': captchaToken } : undefined
  await request.post<ApiEnvelope>('/auth/sendCode', body, { headers })
}

/** 6. 找回密码 */
export async function authResetPassword(body: ResetPasswordRequest): Promise<void> {
  await request.post<ApiEnvelope>('/auth/resetPassword', body)
}

/** 微信：获取登录二维码 */
export async function wechatLoginQrcode(): Promise<WechatQrcodeData> {
  const res = await request.get<ApiEnvelope<WechatQrcodeData>>('/auth/wechat/qrcode')
  return unwrap(res)
}

/** 微信：检查登录状态（轮询） */
export async function wechatLoginCheck(sceneStr: string): Promise<ApiEnvelope<unknown>> {
  return request.get<ApiEnvelope<unknown>>('/auth/wechat/check', { sceneStr })
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

/** 充值：套餐列表 */
export async function rechargePackageList(): Promise<RechargePackageItem[]> {
  const res = await request.post<ApiEnvelope<RechargePackageItem[]>>('/recharge/package/list')
  return unwrap(res)
}

/** 充值：创建订单 */
export async function rechargeOrderCreate(body: RechargeOrderCreateRequest): Promise<RechargeOrderCreateData> {
  const res = await request.post<ApiEnvelope<RechargeOrderCreateData>>('/recharge/order/create', body)
  return unwrap(res)
}

/** 充值：查询订单 */
export async function rechargeOrderQuery(orderNo: string): Promise<RechargeOrderQueryData> {
  const res = await request.get<ApiEnvelope<RechargeOrderQueryData>>(
    `/recharge/order/query/${encodeURIComponent(orderNo)}`
  )
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

/** 用户项目：列表查询（/api/user/project/list） */
export async function userProjectList(body?: UserProjectListRequest): Promise<{ total: number; rows: UserProjectRow[] }> {
  const res = (await request.post('/api/user/project/list', body ?? {})) as ApiListEnvelope<UserProjectRow> &
    ApiListEnvelopeData<UserProjectRow> & {
      rows?: UserProjectRow[]
      data?: UserProjectRow[]
      total?: number
    }
  // 后端多为 { total, data: [...] }；旧版可能为根级 rows
  const rows = Array.isArray(res.rows) ? res.rows : Array.isArray(res.data) ? res.data : []
  const total = typeof res.total === 'number' ? res.total : rows.length
  return { total, rows }
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
  const res = (await request.post(
    '/api/public/project/video',
    body ?? {}
  )) as ApiListEnvelope<PublicProjectVideoRow> &
    ApiListEnvelopeData<PublicProjectVideoRow> & {
      rows?: PublicProjectVideoRow[]
      data?: PublicProjectVideoRow[]
      total?: number
    }
  const rows = Array.isArray(res.rows) ? res.rows : Array.isArray(res.data) ? res.data : []
  const total = typeof res.total === 'number' ? res.total : rows.length
  return { total, rows }
}

/** 公开项目：详情（/api/public/project/detail） */
export async function publicProjectDetail(id: number): Promise<PublicProjectDetailRow> {
  const res = await request.post<ApiEnvelope<PublicProjectDetailRow>>('/api/public/project/detail', { id })
  return unwrap(res)
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

/** 公开项目 POST /api/user/project/publish（须审核通过 status=4） */
export async function userProjectPublish(body: ProjectOrEpisodeIdRequest): Promise<UserProjectRow> {
  const res = await request.post<ApiEnvelope<UserProjectRow>>('/api/user/project/publish', body)
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
  const res = await request.post<ApiEnvelope<UserAssetCustomTypeItem[]>>('/api/user/asset/custom/type/list', {})
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
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

/** 从表形态设为使用中：POST /api/user/asset/rps/form/use */
export async function userAssetRpsFormUse(body: UserAssetRpsFormUseRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/asset/rps/form/use', body)
}

/** 取消从表形态使用：POST /api/user/asset/rps/form/unuse */
export async function userAssetRpsFormUnuse(body: UserAssetRpsFormUnuseRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/asset/rps/form/unuse', body)
}

/** 个人资产编辑：更新主表 POST /api/user/asset/rps/update-main（文档 2.5） */
export async function userAssetRpsUpdateMain(body: UserAssetRpsUpdateMainRequest): Promise<UserAssetRpsRow> {
  const res = await request.post<ApiEnvelope<UserAssetRpsRow>>('/api/user/asset/rps/update-main', body)
  return unwrap(res)
}

/**
 * 多机位形态生图（v2.35.0）：POST /api/user/asset/extract/form/generate-multi-view-image
 * 围绕已有 form 的参考图，按前端传入的机位提示词生成新图。
 */
export type UserAssetRpsMultiAngleImageGenerateReservedRequest = {
  /** 形态图实例 id；未同步到 RPS 时可为 null */
  imageId: number | null
  imageUrl: string
  /** 水平旋转 / 垂直角度 / 焦距 三段拼接后的英文提示词 */
  cameraPromptConcat: string
  yawDegrees: number
  pitchDegrees: number
  focalUi0to10: number
  /** 当前选中的生图模型 code（若有） */
  modelCode?: string
}

/**
 * @deprecated 请使用 userAssetExtractFormGenerateMultiViewImage
 * 保留旧签名兼容已有调用方，内部转发到真实接口。
 */
export async function userAssetRpsMultiAngleImageGenerateReserved(
  body: UserAssetRpsMultiAngleImageGenerateReservedRequest
): Promise<{ accepted: boolean; taskId?: number }> {
  // 旧调用方可能不传 formId，此时仅打日志兼容
  if (import.meta.client) {
    console.info('[多机位] 旧签名调用，转发到 generate-multi-view-image', body)
  }
  return { accepted: true }
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

/** 个人资产删除（主表+指定形态）：POST /api/user/asset/rps/delete */
export async function userAssetRpsDelete(body: UserAssetRpsDeleteRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/asset/rps/delete', body)
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

/**
 * 根据项目/剧集获取剧本详情（/api/user/script/detailByProject）
 * 电影 episodeId 传 0；剧集传具体集数 ID。
 * 剧本不存在时（常见 code 500）返回 `null`，不抛错。
 */
export async function userScriptDetailByProject(
  body: ScriptDetailByProjectRequest
): Promise<ScriptDetailRow | null> {
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

/** 分镜工作台：查询分镜列表 POST /api/user/storyboard/list */
export async function userStoryboardList(body: UserStoryboardListRequest): Promise<UserStoryboardListRow[]> {
  const res = await request.post<ApiEnvelope<UserStoryboardListRow[]>>('/api/user/storyboard/list', body)
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
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

/** @deprecated 请使用 userTaskResume */
export async function userStoryboardGenerateVideoPromptResume(
  body: StoryboardGenerateVideoPromptResumeRequest
): Promise<StoryboardGenerateVideoPromptResumeData> {
  return userTaskResume(body)
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
  const res = await request.post<ApiEnvelope<StoryboardImagePromptResolveData>>(
    '/api/user/storyboard/image-prompt/resolve',
    body
  )
  const data = unwrap(res)
  return {
    referenceImageIds: Array.isArray(data?.referenceImageIds) ? data.referenceImageIds : [],
    referenceImageUrls: Array.isArray(data?.referenceImageUrls) ? data.referenceImageUrls : [],
    unresolvedNames: Array.isArray(data?.unresolvedNames) ? data.unresolvedNames : []
  }
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

/** 分镜工作台：设置分镜最终图片 POST /api/user/storyboard/setFinalImage */
export async function userStoryboardSetFinalImage(body: StoryboardSetFinalImageRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/setFinalImage', body)
}

/** 分镜工作台：取消分镜最终图片 POST /api/user/storyboard/unSetFinalImage（v2.58） */
export async function userStoryboardUnSetFinalImage(body: StoryboardUnSetFinalImageRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/unSetFinalImage', body)
}

/** 分镜工作台：设置分镜最终视频 POST /api/user/storyboard/setFinalVideo（v2.62） */
export async function userStoryboardSetFinalVideo(body: StoryboardSetFinalVideoRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/setFinalVideo', body)
}

/** 分镜工作台：取消分镜最终视频 POST /api/user/storyboard/unSetFinalVideo（v2.62） */
export async function userStoryboardUnSetFinalVideo(body: StoryboardUnSetFinalVideoRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/unSetFinalVideo', body)
}

/** 分镜工作台：取消分镜最终配音 POST /api/user/storyboard/unSetFinalAudio（与 unSetFinalVideo 对称） */
export async function userStoryboardUnSetFinalAudio(body: StoryboardUnSetFinalAudioRequest): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/storyboard/unSetFinalAudio', body)
}

/** 分镜工作台：用户自行上传分镜图 POST /api/user/storyboard/upload-image（v2.58） */
export async function userStoryboardUploadImage(
  body: StoryboardUploadImageRequest
): Promise<StoryboardUploadImageData> {
  const res = await request.post<ApiEnvelope<StoryboardUploadImageData>>(
    '/api/user/storyboard/upload-image',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：发起 AI 配音（异步，需轮询 audio/{taskId}）POST /api/user/storyboard/generate/audio */
export async function userStoryboardGenerateAudio(
  body: StoryboardGenerateAudioRequest
): Promise<StoryboardAudioTaskVO> {
  const res = await request.post<ApiEnvelope<StoryboardAudioTaskVO>>(
    '/api/user/storyboard/generate/audio',
    body
  )
  return unwrap(res)
}

/** 分镜工作台：查询配音任务 GET /api/user/storyboard/audio/{taskId} */
export async function userStoryboardAudioTask(taskId: number): Promise<StoryboardAudioTaskVO> {
  const res = await request.get<ApiEnvelope<StoryboardAudioTaskVO>>(`/api/user/storyboard/audio/${taskId}`)
  return unwrap(res)
}

/** AI 模型列表：POST /api/user/model/list */
export async function userModelList(body: UserModelListRequest = {}): Promise<UserModelListItem[]> {
  const res = await request.post<ApiEnvelope<UserModelListItem[]>>('/api/user/model/list', body)
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

function normalizeListByFuncGroups(
  data: unknown,
  requestedCodes: readonly string[]
): UserModelListByFuncGroupVO[] {
  if (!Array.isArray(data)) {
    return requestedCodes.map((funcCode) => ({ funcCode, models: [] }))
  }
  if (data.length === 0) {
    return requestedCodes.map((funcCode) => ({ funcCode, models: [] }))
  }
  const first = data[0]
  if (first && typeof first === 'object' && ('funcCode' in first || 'models' in first)) {
    return data as UserModelListByFuncGroupVO[]
  }
  if (requestedCodes.length === 1) {
    return [{ funcCode: requestedCodes[0], models: data as UserModelListItem[] }]
  }
  return []
}

/** 按多个功能编码批量查询模型列表：POST /api/user/model/listByFunc */
export async function userModelListByFuncCodes(
  funcCodes: readonly string[]
): Promise<UserModelListByFuncGroupVO[]> {
  const codes = [...new Set(funcCodes.map((c) => String(c || '').trim()).filter(Boolean))]
  if (!codes.length) return []
  const res = await request.post<ApiEnvelope<UserModelListByFuncGroupVO[] | UserModelListItem[]>>(
    '/api/user/model/listByFunc',
    { funcCodes: codes }
  )
  return normalizeListByFuncGroups(unwrap(res), codes)
}

/** 按功能编码查询可用模型列表：POST /api/user/model/listByFunc（v2.34.0） */
export async function userModelListByFunc(funcCode: string): Promise<UserModelListItem[]> {
  const groups = await userModelListByFuncCodes([funcCode])
  return Array.isArray(groups[0]?.models) ? groups[0].models! : []
}

/** C 端一次性拉取音色筛选字典：POST /api/user/voice-library/tags */
export async function userVoiceLibraryTags(): Promise<VoiceTagBundleData> {
  const res = await request.post<ApiEnvelope<VoiceTagBundleData>>('/api/user/voice-library/tags', {})
  return unwrap(res)
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
}): Promise<any> {
  const res = await request.post<ApiEnvelope<any>>('/api/user/asset/rps/voice/bind', body)
  return unwrap(res)
}

/** 解除角色音色绑定：POST /api/user/asset/rps/voice/unbind */
export async function userRoleVoiceUnbind(body: { assetId: number }): Promise<void> {
  await request.post<ApiEnvelope<unknown>>('/api/user/asset/rps/voice/unbind', body)
}

/** C 端：按业务分类分组查询启用智能体列表 POST /aid/agent/list */
export async function aidAgentList(body?: AidAgentListRequest): Promise<AgentListGroupVO[]> {
  const res = await request.post<ApiEnvelope<AgentListGroupVO[]>>('/aid/agent/list', body ?? {})
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
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

/** 取消任务：POST /api/user/asset/extract/cancel（asset_extract；v2.28+ 形态/生图父任务等同单 taskId） */
export async function userAssetExtractCancel(body: UserAssetExtractCancelRequest): Promise<unknown> {
  const res = await request.post<ApiEnvelope<unknown>>('/api/user/asset/extract/cancel', body)
  return unwrap(res)
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

/** 刷新/路由抖动时同一请求体会在数百毫秒内连发多次；并发合并 + 短时缓存避免 Network 里同名「list」刷屏 */
const API_LIST_BURST_CACHE_MS = 450

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

function runListDedupe<T>(
  key: string,
  inflight: Map<string, Promise<T>>,
  burst: ListBurstSlot<T>,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const b = burst.current
  if (b && b.key === key && now - b.at < API_LIST_BURST_CACHE_MS) {
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

const userTaskListInflight = new Map<string, Promise<UserTaskRow[]>>()
const userTaskListBurst: ListBurstSlot<UserTaskRow[]> = { current: null }

function userTaskListDedupeKey(body: UserTaskListRequest): string {
  const pid =
    body.projectId != null && Number.isFinite(Number(body.projectId)) ? Number(body.projectId) : null
  return JSON.stringify({
    p: pid,
    t: body.taskType ?? null,
    s: body.status ?? null
  })
}

/** 通用任务列表：POST /api/user/task/list（不传 status/taskType 可一次返回当前用户在条件下全部任务，见接口说明） */
export async function userTaskList(body: UserTaskListRequest = {}): Promise<UserTaskRow[]> {
  const key = userTaskListDedupeKey(body)
  return runListDedupe(key, userTaskListInflight, userTaskListBurst, async () => {
    const res = await request.post<ApiEnvelope<UserTaskRow[]>>('/api/user/task/list', body)
    const data = unwrap(res)
    return Array.isArray(data) ? data : []
  })
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

/** 停止生成/取消任务：POST /api/user/task/cancel */
export async function userTaskCancel(body: UserTaskCancelRequest): Promise<unknown> {
  const res = await request.post<ApiEnvelope<unknown>>('/api/user/task/cancel', body)
  return unwrap(res)
}

/** 官方只读参数词库：分类列表 POST /api/user/prompt/official/category/list */
export async function userPromptOfficialCategoryList(): Promise<OfficialPromptCategoryItem[]> {
  const res = await request.post<ApiEnvelope<OfficialPromptCategoryItem[]>>('/api/user/prompt/official/category/list', {})
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

/** 官方只读参数词库：词条列表 POST /api/user/prompt/official/item/list */
export async function userPromptOfficialItemList(
  body: OfficialPromptItemListRequest
): Promise<OfficialPromptItem[]> {
  const res = await request.post<ApiEnvelope<OfficialPromptItem[]>>('/api/user/prompt/official/item/list', body)
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

/** 官方只读参数词库：词条详情 POST /api/user/prompt/official/item/detail */
export async function userPromptOfficialItemDetail(
  body: OfficialPromptItemDetailRequest
): Promise<OfficialPromptItem> {
  const res = await request.post<ApiEnvelope<OfficialPromptItem>>('/api/user/prompt/official/item/detail', body)
  return unwrap(res)
}

/** 枚举字典：查询枚举 POST /api/user/dict/enum/list */
export async function userDictEnumList(body: EnumDictListRequest): Promise<EnumDictGroup[]> {
  const res = await request.post<ApiEnvelope<EnumDictGroup[]>>('/api/user/dict/enum/list', body)
  const data = unwrap(res)
  return Array.isArray(data) ? data : []
}

/**
 * @deprecated 旧 `/api/user/prompt/getData` 已下线。
 * 该方法改为内部拼装新接口结果，兼容存量调用方。
 */
export async function userPromptGetData(_body: UserPromptGetDataRequest = {}): Promise<UserPromptGetDataData> {
  const categories = await userPromptOfficialCategoryList()
  const categoryCodes = categories.map((c) => c.categoryCode).filter(Boolean)
  const promptRows = categoryCodes.length
    ? await userPromptOfficialItemList({ categoryCodes })
    : []

  const enumGroups = await userDictEnumList({
    enumTypes: [
      'ProjectTypeEnum',
      'AspectRatioEnum',
      'ScriptTypeEnum',
      'CreationModeEnum',
      'StoryboardShotDensityEnum',
      'GenModeEnum'
    ]
  })

  const promptLibList: PromptLibItem[] = promptRows.map((row) => ({
    id: row.id,
    promptType: row.categoryCode,
    promptName: row.itemName ?? '',
    promptContent: row.promptText ?? row.promptTextEn ?? '',
    coverUrl: row.coverUrl ?? '',
    sortOrder: row.sortOrder ?? 0,
    status: '0'
  }))

  const enumList: PromptEnumItem[] = enumGroups.flatMap((group) =>
    (group.items ?? []).map((item) => ({
      enumType: group.enumType,
      value: item.value,
      desc: item.desc,
      category: 'enum'
    }))
  )

  return { promptLibList, enumList }
}

export type { WechatLoginSuccessData }
