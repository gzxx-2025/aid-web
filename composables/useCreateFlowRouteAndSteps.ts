import { computed, ref, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  creationStepAdvance,
  creationStepStatus,
  userEpisodeSubmitAudit,
  userProjectSubmitAudit,
  userScriptDetailByProject,
  userScriptSave,
  userStoryboardList
} from '~/utils/businessApi'
import {
  applyStoryboardScriptPanelsFromApi,
  buildVideoAndDubbingPanelsFromScript
} from '~/composables/useCreateFlowStoryboardSync'
import {
  fetchProjectImageAndVideoRecordMaps,
  hydrateScriptPanelsWithImageRecords,
  hydrateVideoPanelsWithVideoRecords
} from '~/utils/storyboardRecordBatch'
import {
  htmlPlainTextLength,
  resolveStoryScriptEditorHtmlAfterApiLoad,
  storyScriptOriginalTextForApi
} from '~/utils/htmlPlain'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  CREATE_FLOW_STEP_ORDER,
  CREATE_SERIES_SCRIPT_UPLOAD_PATH,
  creationStepIndexFromPath,
  creationStepToRoutePath,
  routePathToCreationStep,
  isSeriesScriptUploadPath,
  isSeriesEpisodeListPath,
  resolveCreateFlowBackTarget
} from '~/utils/createFlowRoutes'
import { CREATION_FLOW_STEPS } from '~/utils/createFlowStepMeta'
import { useCreationStore } from '~/stores/creation'
import type { CreationStep, StoryboardPanel } from '~/types'
import type { CreationStepState } from '~/types/business-api'
import { mapStoryboardListRowToPanel } from '~/utils/storyboardPanelMap'
import { writeCreationStepSyncCache } from '~/utils/creationStepSyncCache'
import type { ExtractModalAutoOpenContext } from '~/composables/useCreateFlowExtractAgents'

function isStoryScriptContentFilled(content: unknown): boolean {
  return typeof content === 'string' && htmlPlainTextLength(content) > 0
}

/**
 * 路由同步、剧本拉取、服务端步骤、流程条与工具栏「下一步」（原 index.vue）
 */
export function useCreateFlowRouteAndSteps(
  openExtractAgentModalIfNeeded: (context?: ExtractModalAutoOpenContext) => void
) {
  const router = useRouter()
  const route = useRoute()
  const creationStore = useCreationStore()
  const createStepSwapPlaceholder = useState('create-flow-step-swap-placeholder', () => false)

  const steps = CREATION_FLOW_STEPS

  const flowStepIndex = computed(() => creationStepIndexFromPath(route.path))

  const currentStep = computed(() => {
    const fromRoute = routePathToCreationStep(route.path)
    if (fromRoute) return fromRoute
    return steps[Math.min(Math.max(creationStore.currentStepIndex, 0), steps.length - 1)]!.key
  })

  const currentStepData = computed(
    () => steps[Math.min(Math.max(flowStepIndex.value, 0), steps.length - 1)]!
  )

  const previewContentStepClass = computed(() => {
    if (isSeriesScriptUploadPath(route.path)) return 'step-series-script-upload'
    if (isSeriesEpisodeListPath(route.path)) return 'step-series-episode-list'
    return `step-${currentStep.value}`
  })

  watch(
    () => route.path,
    () => {
      const k = routePathToCreationStep(route.path)
      if (k !== null) {
        const i = CREATE_FLOW_STEP_ORDER.indexOf(k)
        if (i >= 0 && creationStore.currentStepIndex !== i) {
          creationStore.setCurrentStepIndex(i)
        }
      }
    },
    { immediate: true }
  )

  async function pushCreateStepRoute(stepKey: CreationStep) {
    // 关键：先把遮罩渲染出来（让用户先看到“加载中”），再触发路由切换
    // 这样就不会出现“先卸载/切换页面 → 再出现 loading”的时序问题。
    createStepSwapPlaceholder.value = true
    await nextTick()
    // 给浏览器一次绘制机会，确保遮罩已经显示
    if (import.meta.client) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    }
    await router.push({ path: creationStepToRoutePath(stepKey), query: { ...route.query } })
  }

  async function goToCreateStep(stepIndex: number) {
    const key = steps[stepIndex]?.key
    if (key) {
      await pushCreateStepRoute(key)
    }
  }

  const serverStepStatus = ref<Array<'completed' | 'active' | 'pending'> | null>(null)
  const unlockedStepIndex = ref(0)
  const stepApiLoading = ref(false)
  /** 工具栏「下一步」提交中（含保存剧本等持久化），与页面初始化拉步骤状态的 stepApiLoading 分离，便于按钮立即给出加载反馈 */
  const nextStepSubmitting = ref(false)
  /** 服务端最近一次返回的 currentStep（1~7），用于与路由步骤对照后再决定是否调 advance */
  const serverReportedCurrentStep = ref(1)

  function parseRouteEpisodeId(): number | null {
    const raw = route.query.episodeId
    if (raw === undefined || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  const stepRequestParams = computed(() => {
    const routeProjectIdRaw = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
    const routeProjectId = Number.isFinite(routeProjectIdRaw) && routeProjectIdRaw > 0 ? routeProjectIdRaw : null
    const storePid =
      creationStore.currentProjectId != null && creationStore.currentProjectId > 0
        ? creationStore.currentProjectId
        : null
    // 内嵌「我的作品」切作品时 store 已更新、路由 query 可能仍为旧 id，优先 store 避免串号
    const projectId = storePid ?? routeProjectId
    if (!projectId) return null

    const routeEp = parseRouteEpisodeId()
    const pt = creationStore.currentProjectType

    let episodeId: number | undefined
    if (pt === 'movie') {
      episodeId = creationStore.currentEpisodeId ?? routeEp ?? 0
    } else if (pt === 'series') {
      const e = creationStore.currentEpisodeId ?? routeEp
      if (e != null && e > 0) episodeId = e
    } else {
      const e = creationStore.currentEpisodeId ?? routeEp
      if (e != null && e >= 0) episodeId = e
    }

    return {
      projectId,
      ...(episodeId !== undefined ? { episodeId } : {})
    }
  })

  const syncProjectContextFromRoute = () => {
    if (String(route.query.panel ?? '').toLowerCase() === 'works') return

    const routeProjectIdRaw = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
    const routeProjectId = Number.isFinite(routeProjectIdRaw) && routeProjectIdRaw > 0 ? routeProjectIdRaw : null
    const routeEp = parseRouteEpisodeId()
    if (routeProjectId || routeEp !== null) {
      creationStore.setCurrentProjectContext({
        ...(routeProjectId ? { projectId: routeProjectId } : {}),
        ...(routeEp !== null ? { episodeId: routeEp } : {})
      })
    }
  }

  const storyScriptDetailFetchedKey = ref<string | null>(null)
  const storyScriptDetailLoading = ref(false)
  /** 防止快速切换作品时旧请求晚到覆盖新作品的剧本正文 */
  const storyScriptLoadGeneration = ref(0)
  const storyboardListFetchedKey = ref<string | null>(null)
  const storyboardListLoading = ref(false)
  const storyboardListInFlightKey = ref<string | null>(null)
  const storyboardListLoadGeneration = ref(0)

  async function loadStoryScriptFromApi() {
    const stepKey = routePathToCreationStep(route.path)
    // 第三步自动提取弹窗依赖剧本正文；内嵌切作品时路由可能直接落在 scene-character
    if (stepKey !== 'story-script' && stepKey !== 'scene-character') return

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return

    const fetchKey = `${ctx.projectId}-${ctx.episodeId}`
    if (storyScriptDetailFetchedKey.value === fetchKey) return

    storyScriptLoadGeneration.value += 1
    const gen = storyScriptLoadGeneration.value

    // 切换作品/剧集后 Pinia 可能仍带着上一份 persist 的正文；拉接口前暂存本地 HTML，避免被 Markdown 覆盖
    const previousEditorHtml = (creationStore.formData.storyScript.content || '').trim()
    creationStore.updateFormData({
      storyScript: { content: '' }
    })
    creationStore.setScriptServerHtmlBaseline('')

    storyScriptDetailLoading.value = true
    try {
      const data = await userScriptDetailByProject(ctx)
      if (gen !== storyScriptLoadGeneration.value) return

      const ctxAfter = await resolveStoryScriptSaveContext(creationStore, route)
      if (
        !ctxAfter ||
        ctxAfter.projectId !== ctx.projectId ||
        ctxAfter.episodeId !== ctx.episodeId
      ) {
        return
      }

      storyScriptDetailFetchedKey.value = fetchKey
      if (data) {
        const raw = (data.simplifiedText || data.originalText || '').trim()
        creationStore.updateFormData({
          storyScript: {
            content: resolveStoryScriptEditorHtmlAfterApiLoad(raw, previousEditorHtml)
          }
        })
      } else {
        creationStore.updateFormData({
          storyScript: { content: '' }
        })
      }
      creationStore.setScriptServerHtmlBaseline(
        storyScriptOriginalTextForApi(creationStore.formData.storyScript.content || '')
      )
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '加载剧本失败')
    } finally {
      storyScriptDetailLoading.value = false
    }
  }

  /** 第四/五/六步：从工作台拉取分镜列表（/api/user/storyboard/list），写入 store 并触发分镜视频/配音联动 */
  async function loadStoryboardListFromApi() {
    const stepKey = routePathToCreationStep(route.path)
    if (
      stepKey !== 'storyboard-script' &&
      stepKey !== 'storyboard-video' &&
      stepKey !== 'dubbing' &&
      stepKey !== 'preview'
    ) {
      return
    }

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return

    const fetchKey = `${ctx.projectId}-${ctx.episodeId}`
    const shouldForceRefresh =
      stepKey === 'storyboard-video' || stepKey === 'dubbing' || stepKey === 'preview'
    const requestKey = `${stepKey}:${fetchKey}`
    if (storyboardListInFlightKey.value === requestKey) return
    if (!shouldForceRefresh && storyboardListFetchedKey.value === fetchKey) return

    storyboardListLoadGeneration.value += 1
    const gen = storyboardListLoadGeneration.value

    storyboardListInFlightKey.value = requestKey
    storyboardListLoading.value = true
    try {
      const list = await userStoryboardList({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId
      })
      if (gen !== storyboardListLoadGeneration.value) return

      const ctxAfter = await resolveStoryScriptSaveContext(creationStore, route)
      if (
        !ctxAfter ||
        ctxAfter.projectId !== ctx.projectId ||
        ctxAfter.episodeId !== ctx.episodeId
      ) {
        return
      }

      const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      let panels = sorted.map((row, index) => mapStoryboardListRowToPanel(row, index))

      try {
        const { imageByStoryboardId, videoByStoryboardId } =
          await fetchProjectImageAndVideoRecordMaps(ctx)
        panels = hydrateScriptPanelsWithImageRecords(panels, imageByStoryboardId)
        applyStoryboardScriptPanelsFromApi(panels)
        const scriptPanels = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
        const { video } = buildVideoAndDubbingPanelsFromScript(scriptPanels, [], [])
        const hydratedVideo = hydrateVideoPanelsWithVideoRecords(
          video,
          scriptPanels,
          videoByStoryboardId
        )
        creationStore.formData.storyboardVideo.panels = hydratedVideo
      } catch {
        applyStoryboardScriptPanelsFromApi(panels)
      }
      storyboardListFetchedKey.value = fetchKey
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '加载分镜列表失败')
    } finally {
      if (storyboardListInFlightKey.value === requestKey) {
        storyboardListInFlightKey.value = null
      }
      storyboardListLoading.value = false
    }
  }

  /** 点击「下一步」前按当前步骤调用对应持久化接口（可扩展多步） */
  async function persistCurrentStepBeforeNext(): Promise<boolean> {
    const stepKey = routePathToCreationStep(route.path)
    if (stepKey === 'story-script') {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (!ctx) {
        message.warning('缺少项目信息，请从「我的作品」打开作品后再编辑剧本')
        return false
      }
      const originalText = storyScriptOriginalTextForApi(
        creationStore.formData.storyScript.content || ''
      )
      try {
        const row = await userScriptSave({ ...ctx, originalText })
        const syncedMarkdown = (row.originalText ?? originalText).trim()
        creationStore.setScriptServerHtmlBaseline(syncedMarkdown)
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '保存剧本失败')
        return false
      }
    }
    return true
  }

  const projectContextSig = computed(() => {
    const p = stepRequestParams.value
    return p ? `${p.projectId}:${p.episodeId ?? 'na'}` : ''
  })

  watch(
    () => [
      route.path,
      creationStore.currentProjectId,
      creationStore.currentEpisodeId,
      creationStore.currentProjectType,
      route.query.projectId,
      route.query.id,
      route.query.workId,
      route.query.episodeId
    ],
    (next, prev) => {
      /**
       * 从作品 A 切到 B 时，可能出现「路由已是 story-script，但 query 里 projectId 仍短暂为 A」
       * 或「store 已是 B 而 query 尚未更新」——此时 resolve 得到的 fetchKey 会与已缓存的 key 相同，
       * 若直接命中 `storyScriptDetailFetchedKey === fetchKey` 会跳过接口，B 永远不拉 detailByProject。
       * 任一依赖变化时先作废剧本拉取缓存，再走 load。
       */
      if (prev !== undefined) {
        const sig = next.join('\u0001')
        const prevSig = prev.join('\u0001')
        if (sig !== prevSig) {
          storyScriptDetailFetchedKey.value = null
        }
      }
      void loadStoryScriptFromApi()
      void loadStoryboardListFromApi()
    },
    { immediate: true }
  )

  /** 流程壳未卸载时（内嵌作品库切作品）须重拉步骤解锁状态，否则进度条沿用上一作品 */
  watch(
    projectContextSig,
    (next, prev) => {
      if (!next || next === prev) return
      serverStepStatus.value = null
      storyScriptDetailFetchedKey.value = null
      storyboardListFetchedKey.value = null
      storyboardListInFlightKey.value = null
      storyboardListLoadGeneration.value += 1
      void fetchCreationStepStatus()
    }
  )

  const applyServerStepState = (
    payload: { currentStep?: number; steps?: Array<{ step: number; status: string }> } | null | undefined,
    options?: { syncRoute?: boolean }
  ) => {
    const currentStepValue = Number(payload?.currentStep)
    if (!payload || !Number.isFinite(currentStepValue)) {
      return
    }
    const safeCurrentStep = Math.min(Math.max(currentStepValue, 1), steps.length)
    serverReportedCurrentStep.value = safeCurrentStep
    creationStore.setCurrentStepIndex(safeCurrentStep - 1)
    unlockedStepIndex.value = safeCurrentStep - 1
    const mapped: Array<'completed' | 'active' | 'pending'> = Array.from({ length: steps.length }, () => 'pending')
    for (const item of payload?.steps ?? []) {
      const idx = Number(item?.step) - 1
      if (idx < 0 || idx >= steps.length) continue
      if (item.status === 'completed') mapped[idx] = 'completed'
      else if (item.status === 'current') mapped[idx] = 'active'
      else mapped[idx] = 'pending'
    }
    if (!mapped.includes('active')) {
      mapped[safeCurrentStep - 1] = 'active'
    }
    serverStepStatus.value = mapped
    if (options?.syncRoute) {
      const stepKey = steps[safeCurrentStep - 1]?.key
      if (stepKey) {
        router.replace({ path: creationStepToRoutePath(stepKey), query: { ...route.query } })
      }
    }
    const p = stepRequestParams.value
    if (p) {
      writeCreationStepSyncCache(p.projectId, p.episodeId, safeCurrentStep, safeCurrentStep)
    }
  }

  /**
   * 接口约定：仅当「当前路由对应步骤(1~7)」> 服务端 currentStep 时循环调 advance。
   * completedStep 取推进前服务端的 currentStep（即当前待完成的那一步）。
   */
  async function reconcileAdvanceLoop(
    params: { projectId: number; episodeId?: number },
    statusData: CreationStepState
  ): Promise<CreationStepState> {
    let last = statusData
    let serv = Number(last?.currentStep ?? 1)
    if (!Number.isFinite(serv)) serv = 1
    serv = Math.min(Math.max(Math.floor(serv), 1), steps.length)
    const localRouteStep = Math.min(Math.max(flowStepIndex.value + 1, 1), steps.length)

    let guard = 0
    try {
      while (localRouteStep > serv && guard++ < steps.length) {
        last = await creationStepAdvance({ ...params, completedStep: serv })
        const next = Number(last?.currentStep ?? serv + 1)
        serv = Number.isFinite(next)
          ? Math.min(Math.max(Math.floor(next), 1), steps.length)
          : Math.min(serv + 1, steps.length)
      }
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.warning(err?.msg || err?.message || '步骤同步失败，请稍后重试')
      return statusData
    }
    if (last && Number.isFinite(Number(last.currentStep))) {
      return last
    }
    return statusData
  }

  /** 当前路由步骤超出作品解锁进度时（如内嵌作品库从 B 切回 A），回落到服务端允许的最高步骤 */
  async function ensureRouteWithinUnlockedSteps() {
    if (isSeriesScriptUploadPath(route.path) || isSeriesEpisodeListPath(route.path)) return
    if (routePathToCreationStep(route.path) === null) return
    if (flowStepIndex.value <= unlockedStepIndex.value) return

    const targetKey = steps[unlockedStepIndex.value]?.key
    if (!targetKey) return

    createStepSwapPlaceholder.value = true
    await nextTick()
    if (import.meta.client) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    }
    await router.replace({ path: creationStepToRoutePath(targetKey), query: { ...route.query } })
    createStepSwapPlaceholder.value = false
    if (targetKey === 'scene-character') {
      await nextTick()
      openExtractAgentModalIfNeeded('after-advance-to-scene-character')
    }
  }

  const fetchCreationStepStatus = async () => {
    if (isSeriesScriptUploadPath(route.path) || isSeriesEpisodeListPath(route.path)) return
    const params = stepRequestParams.value
    if (!params) {
      serverStepStatus.value = null
      unlockedStepIndex.value = creationStore.currentStepIndex
      return
    }
    const needAdvanceBeforeStatus =
      route.query.stepInitAdvance === '1' || String(route.query.stepInitAdvance ?? '') === 'true'

    stepApiLoading.value = true
    try {
      // 首页弹窗创建电影后：先手动推进（完成步骤1），再查状态，与路由落到「故事剧本」一致
      if (needAdvanceBeforeStatus) {
        try {
          const adv = await creationStepAdvance({ ...params, completedStep: 1 })
          const s = Number(adv?.currentStep ?? 2)
          if (Number.isFinite(s)) {
            serverReportedCurrentStep.value = Math.min(Math.max(Math.floor(s), 1), steps.length)
          }
        } catch (e: unknown) {
          const err = e as { msg?: string; message?: string }
          message.warning(err?.msg || err?.message || '初始化步骤推进失败，将按服务端状态展示')
        }
      }

      const data = await creationStepStatus(params)
      if (!data || !Number.isFinite(Number(data.currentStep))) {
        message.error('获取步骤状态失败，请稍后重试')
        return
      }
      const serverStep = Math.min(
        Math.max(Math.floor(Number(data.currentStep)), 1),
        steps.length
      )
      const localRouteStep = Math.min(Math.max(flowStepIndex.value + 1, 1), steps.length)
      // 路由步骤高于服务端解锁进度时（切作品残留路由），禁止 reconcile 循环 advance，避免污染新作品步骤
      const merged =
        localRouteStep <= serverStep ? await reconcileAdvanceLoop(params, data) : data
      const toApply =
        merged && Number.isFinite(Number(merged.currentStep)) ? merged : data
      applyServerStepState(toApply)
      await ensureRouteWithinUnlockedSteps()

      if (needAdvanceBeforeStatus) {
        const q = { ...route.query } as Record<string, unknown>
        delete q.stepInitAdvance
        await router.replace({ path: route.path, query: q as typeof route.query })
      }
    } catch (error: any) {
      message.error(error?.msg || error?.message || '获取步骤状态失败')
    } finally {
      stepApiLoading.value = false
    }
  }

  watch(
    () => route.path,
    (path, oldPath) => {
      const leftSeriesChrome =
        oldPath &&
        (isSeriesScriptUploadPath(oldPath) || isSeriesEpisodeListPath(oldPath)) &&
        !isSeriesScriptUploadPath(path) &&
        !isSeriesEpisodeListPath(path)
      if (leftSeriesChrome) {
        void fetchCreationStepStatus()
      }
    }
  )

  const isStepCompleted = (index: number): boolean => {
    const step = steps[index]
    const data = creationStore.formData
    switch (step.key) {
      case 'global-setting':
        // 与接口文档一致：画面比例、剧本类型、视频风格（selectedStyle）
        return !!(
          data.globalSetting.aspectRatio &&
          data.globalSetting.scriptType &&
          data.globalSetting.selectedStyle != null
        )
      case 'story-script':
        return isStoryScriptContentFilled(data.storyScript.content)
      case 'scene-character':
        return (
          data.sceneCharacter.characters.length > 0 &&
          data.sceneCharacter.scenes.length > 0
        )
      case 'storyboard-script':
      case 'storyboard-video':
      case 'dubbing':
        // 与接口文档 v1.8.0 一致：步骤 4/5/6 仅校验总分镜数 > 0
        return data.storyboardScript.panels.length > 0
      case 'preview':
        return true
      default:
        return false
    }
  }

  /**
   * 步骤 index 与 index+1 之间的箭头：仅当「当前路由步骤已严格越过 index」时高亮。
   * 不能用 isStepCompleted(index)，否则第 4/5/6 步共用 panels 判断会导致尚未到达时箭头已全部变蓝。
   */
  const isConnectorTrailDone = (index: number): boolean => {
    return flowStepIndex.value > index
  }

  const stepStatus = computed<Array<'completed' | 'pending' | 'disabled' | 'active'>>(() => {
    if (serverStepStatus.value) {
      return serverStepStatus.value
    }
    return steps.map((_, index) => {
      if (index < flowStepIndex.value) {
        return isStepCompleted(index) ? 'completed' : 'pending'
      } else if (index === flowStepIndex.value) {
        return 'active'
      } else {
        return 'pending'
      }
    })
  })

  const completionRate = computed(() => {
    const completedCount = stepStatus.value.filter(status => status === 'completed').length
    return Math.round((completedCount / steps.length) * 100)
  })

  const canSubmit = computed(() => steps.every((_, index) => isStepCompleted(index)))

  const toolbarPrimaryLabel = computed(() =>
    flowStepIndex.value >= steps.length - 1 ? '提交审核' : '下一步'
  )
  const toolbarPrimaryDisabled = computed(
    () => flowStepIndex.value >= steps.length - 1 && !canSubmit.value
  )

  const goBack = () => {
    const path = route.path
    const inSeriesChrome = isSeriesScriptUploadPath(path) || isSeriesEpisodeListPath(path)
    if (inSeriesChrome) {
      // 电视剧创建流：上传 → 解析 → 分集列表，按浏览器历史逐级返回（不直接回首页）
      if (import.meta.client && typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
        return
      }
      if (isSeriesEpisodeListPath(path)) {
        router.push({ path: CREATE_SERIES_SCRIPT_UPLOAD_PATH, query: { ...route.query } })
        return
      }
      const target = resolveCreateFlowBackTarget(route)
      if (target.type === 'path') {
        router.push(target.path)
      } else {
        router.push({ path: target.path, query: target.query })
      }
      return
    }
    const target = resolveCreateFlowBackTarget(route)
    if (target.type === 'path') {
      router.push(target.path)
    } else {
      router.push({ path: target.path, query: target.query })
    }
  }

  const handleStepClick = async (index: number) => {
    if (stepApiLoading.value || nextStepSubmitting.value) return

    if (index <= unlockedStepIndex.value) {
      if (index === flowStepIndex.value) return
      await pushCreateStepRoute(steps[index]!.key)
      if (steps[index]!.key === 'scene-character') {
        openExtractAgentModalIfNeeded('step-click-scene-character')
      }
      return
    }

    // 未解锁的后续步骤：与工具栏「下一步」相同，推进任务后由服务端状态同步路由
    await handleNextStep()
  }

  const handleNextStep = async () => {
    if (stepApiLoading.value || nextStepSubmitting.value) return
    nextStepSubmitting.value = true
    try {
      if (!(await persistCurrentStepBeforeNext())) return

      const params = stepRequestParams.value
      if (!params) {
        if (flowStepIndex.value < steps.length - 1) {
          const nextIndex = flowStepIndex.value + 1
          await pushCreateStepRoute(steps[nextIndex]!.key)
          if (steps[nextIndex].key === 'scene-character') {
            openExtractAgentModalIfNeeded('after-advance-to-scene-character')
          }
        } else if (canSubmit.value) {
          void handleSubmit()
        } else {
          message.warning('请完成所有步骤后再提交')
        }
        return
      }
      const localRouteStep = Math.min(Math.max(flowStepIndex.value + 1, 1), steps.length)

      if (localRouteStep < serverReportedCurrentStep.value) {
        if (flowStepIndex.value < steps.length - 1) {
          const nextIndex = flowStepIndex.value + 1
          await pushCreateStepRoute(steps[nextIndex]!.key)
          writeCreationStepSyncCache(
            params.projectId,
            params.episodeId,
            nextIndex + 1,
            serverReportedCurrentStep.value
          )
          if (steps[nextIndex]!.key === 'scene-character') {
            openExtractAgentModalIfNeeded('after-advance-to-scene-character')
          }
        } else if (canSubmit.value) {
          void handleSubmit()
        } else {
          message.warning('请完成所有步骤后再提交')
        }
        return
      }

      if (localRouteStep > serverReportedCurrentStep.value) {
        const data = await creationStepStatus(params)
        if (!data || !Number.isFinite(Number(data.currentStep))) {
          message.warning('步骤状态异常，请稍后重试或刷新页面')
          return
        }
        const merged = await reconcileAdvanceLoop(params, data)
        const toApply =
          merged && Number.isFinite(Number(merged.currentStep)) ? merged : data
        applyServerStepState(toApply, { syncRoute: true })
      }

      let data = await creationStepAdvance({
        ...params,
        completedStep: localRouteStep
      })
      if (!data || !Number.isFinite(Number(data.currentStep))) {
        try {
          data = await creationStepStatus(params)
        } catch {
          /* 由下方统一提示 */
        }
      }
      if (!data || !Number.isFinite(Number(data.currentStep))) {
        message.warning('步骤同步异常，请稍后重试或刷新页面')
        return
      }
      applyServerStepState(data, { syncRoute: true })
      const nextIdx = Math.min(
        Math.max(Number(data.currentStep) - 1, 0),
        steps.length - 1
      )
      if (steps[nextIdx]?.key === 'scene-character') {
        openExtractAgentModalIfNeeded('after-advance-to-scene-character')
      }
    } catch (error: any) {
      message.warning(error?.msg || error?.message || '当前步骤未完成，暂时无法推进')
    } finally {
      nextStepSubmitting.value = false
    }
  }

  const prevStep = () => {
    if (flowStepIndex.value > 0) {
      const prev = steps[flowStepIndex.value - 1]
      if (prev) {
        void pushCreateStepRoute(prev.key)
      }
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit.value) {
      message.warning('请完成所有步骤后再提交审核')
      return
    }
    const projectId = creationStore.currentProjectId
    if (!projectId || projectId <= 0) {
      message.error('缺少项目信息，无法提交审核')
      return
    }
    const projectType = creationStore.currentProjectType ?? 'movie'
    try {
      if (projectType === 'series') {
        const episodeId = creationStore.currentEpisodeId
        if (episodeId == null || episodeId <= 0) {
          message.error('请先选择要提交审核的剧集')
          return
        }
        await userEpisodeSubmitAudit({ id: episodeId })
        message.success('剧集已提交审核')
      } else {
        await userProjectSubmitAudit({ id: projectId })
        message.success('项目已提交审核')
      }
      router.push('/works')
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '提交审核失败')
    }
  }

  const saveDraft = () => {
    message.success('草稿已保存')
  }

  const addCharacter = () => {
    creationStore.updateSceneCharacterData({
      characters: [...creationStore.formData.sceneCharacter.characters, `新角色${creationStore.formData.sceneCharacter.characters.length + 1}`]
    })
  }

  return {
    steps,
    flowStepIndex,
    currentStep,
    currentStepData,
    previewContentStepClass,
    goToCreateStep,
    serverStepStatus,
    unlockedStepIndex,
    stepApiLoading,
    nextStepSubmitting,
    parseRouteEpisodeId,
    stepRequestParams,
    syncProjectContextFromRoute,
    loadStoryScriptFromApi,
    storyScriptDetailLoading,
    loadStoryboardListFromApi,
    storyboardListLoading,
    fetchCreationStepStatus,
    applyServerStepState,
    isStepCompleted,
    isConnectorTrailDone,
    stepStatus,
    completionRate,
    canSubmit,
    toolbarPrimaryLabel,
    toolbarPrimaryDisabled,
    goBack,
    handleStepClick,
    handleNextStep,
    prevStep,
    handleSubmit,
    saveDraft,
    addCharacter
  }
}
