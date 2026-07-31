import { computed, ref, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  creationStepAdvance,
  userEpisodeList,
  userEpisodeSubmitAudit,
  userProjectPublish,
  userProjectSubmitAudit,
  userScriptDetailByProject,
  userScriptSave,
  userStoryboardList
} from '~/utils/businessApi'
import { fetchCreationStepStatusOnce } from '~/utils/creationStepStatusOnce'
import { fetchUserProjectDetailOnce } from '~/utils/userProjectDetailOnce'
import {
  auditSubmitBlockedReason,
  canSubmitAudit,
  hasPendingReauditVideo,
  needsSubmitAuditBeforePublish,
  isProjectPublicLockError,
  projectPublicLockUserHint
} from '~/utils/projectAudit'
import { applyEpisodeRowToCreationStore } from '~/utils/hydrateCreationStoreFromProjectDetail'
import { applyStoryboardScriptPanelsFromApi } from '~/composables/useCreateFlowStoryboardSync'
import {
  applyStoryboardVideoPanelUiFromStore,
  applyStoryboardVideoImmediatePanelLoadingRestore
} from '~/composables/useStoryboardVideoBatchGenerate'
import { applyStoryboardImageImmediatePanelLoadingRestore } from '~/composables/useStoryboardImageBatchGenerate'
import {
  hydrateStoryboardVideoLiveGenFromScopes,
  waitForCreationStoreHydrated
} from '~/composables/useCreationStoreHydration'
import {
  htmlPlainTextLength,
  resolveStoryScriptEditorHtmlAfterApiLoad,
  storyScriptOriginalTextForApi
} from '~/utils/htmlPlain'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  CREATE_FLOW_STEP_ORDER,
  CREATE_SERIES_EPISODE_LIST_PATH,
  CREATE_SERIES_SCRIPT_UPLOAD_PATH,
  CREATE_FLOW_FROM_WORKS,
  CREATE_FLOW_FROM_PANEL_WORKS,
  creationStepIndexFromPath,
  creationStepToRoutePath,
  routePathToCreationStep,
  isSeriesScriptUploadPath,
  isSeriesEpisodeListPath,
  resolveCreateFlowBackTarget
} from '~/utils/createFlowRoutes'
import { CREATION_FLOW_STEPS } from '~/utils/createFlowStepMeta'
import { useCreationStore } from '~/stores/creation'
import type { CreationStep, StoryboardPanel, StoryboardVideoPanel } from '~/types'
import type { CreationStepState, UserProjectType } from '~/types/business-api'
import { mapStoryboardListRowToPanel } from '~/utils/storyboardPanelMap'
import { writeCreationStepSyncCache } from '~/utils/creationStepSyncCache'
import type { ExtractModalAutoOpenContext } from '~/composables/useCreateFlowExtractAgents'
import { useScriptChangeExtractGate } from '~/composables/useScriptChangeExtractGate'
import {
  clearStaleCreateFlowProjectContext,
  isProjectMissingApiError,
  shouldSkipFlowProjectScopedApis,
  resolveFlowEpisodeIdFromRoute,
  buildFlowStepRequestParams
} from '~/utils/createFlowProjectContext'
import { shouldSkipCreateFlowSyncRoute } from '~/utils/createFlowNavSerialize'

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
  const scriptChangeGate = useScriptChangeExtractGate()

  /** 当前在剧本页、目标为素材准备时：有效变更则强提示；取消则拦截跳转 */
  async function confirmIfLeavingScriptToPrepare(targetKey: string): Promise<boolean> {
    if (targetKey !== 'scene-character') return true
    if (routePathToCreationStep(route.path) !== 'story-script') return true
    return scriptChangeGate.confirmLeaveScriptToPrepare()
  }

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
  /**
   * 步骤状态拉取世代：快速切换剧集时作废旧请求的 router.replace，
   * 避免与新导航叠加重入 Vue Suspense 触发 `reading 'exposed'` 白屏。
   */
  const stepStatusLoadGeneration = ref(0)
  /** loading 期间又有新触发时，结束后用最新上下文补拉一次 */
  let stepStatusPendingRerun = false

  function isStepStatusFetchCurrent(gen: number, contextSig: string): boolean {
    return (
      gen === stepStatusLoadGeneration.value &&
      contextSig === projectContextSig.value &&
      !isSeriesScriptUploadPath(route.path) &&
      !isSeriesEpisodeListPath(route.path)
    )
  }

  /** 并发导航时 Vue 内部可能抛 exposed/null；吞掉避免整页白屏 */
  async function safeRouterReplace(location: Parameters<typeof router.replace>[0]): Promise<boolean> {
    try {
      await router.replace(location)
      return true
    } catch (e: unknown) {
      if (import.meta.dev) {
        console.warn('[create-flow] router.replace skipped during concurrent navigation', e)
      }
      return false
    }
  }

  function parseRouteEpisodeId(): number | null {
    return resolveFlowEpisodeIdFromRoute(route, creationStore.currentProjectType)
  }

  /** 剧集流程不展示「项目配置」页：误入 /create/global-setting 时重定向 */
  watch(
    () =>
      [
        route.path,
        creationStore.currentProjectType,
        creationStore.currentEpisodeId,
        route.query.episodeId,
        route.query.projectId
      ] as const,
    () => {
      if (creationStore.currentProjectType !== 'series') return
      if (routePathToCreationStep(route.path) !== 'global-setting') return
      const ep = parseRouteEpisodeId()
      const q = { ...route.query }
      if (ep != null && ep > 0) {
        void safeRouterReplace({ path: creationStepToRoutePath('story-script'), query: q })
        return
      }
      void safeRouterReplace({ path: CREATE_SERIES_EPISODE_LIST_PATH, query: q })
    },
    { immediate: true }
  )

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

    return buildFlowStepRequestParams({
      projectId,
      projectType: creationStore.currentProjectType,
      storeEpisodeId: creationStore.currentEpisodeId,
      routeEpisodeId: parseRouteEpisodeId()
    })
  })

  const syncProjectContextFromRoute = () => {
    const routeProjectIdRaw = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
    const routeProjectId = Number.isFinite(routeProjectIdRaw) && routeProjectIdRaw > 0 ? routeProjectIdRaw : null
    const pt = creationStore.currentProjectType
    const routeEp = parseRouteEpisodeId()
    const payload: { projectId?: number; episodeId?: number | null } = {}
    if (routeProjectId) payload.projectId = routeProjectId
    if (pt === 'movie') {
      payload.episodeId = 0
    } else if (routeEp !== null && routeEp > 0) {
      payload.episodeId = routeEp
    } else if (
      routeProjectId != null &&
      routeProjectId !== creationStore.currentProjectId &&
      pt === 'series'
    ) {
      payload.episodeId = null
    }
    if (payload.projectId !== undefined || payload.episodeId !== undefined) {
      creationStore.setCurrentProjectContext(payload)
    }
  }

  const storyScriptDetailFetchedKey = ref<string | null>(null)
  const storyScriptDetailLoading = ref(false)
  const storyScriptDetailInFlightKey = ref<string | null>(null)
  /** 防止快速切换作品时旧请求晚到覆盖新作品的剧本正文 */
  const storyScriptLoadGeneration = ref(0)
  const storyboardListFetchedKey = ref<string | null>(null)
  const storyboardListLoading = ref(false)
  /** 当前作品/剧集分镜列表是否已完成首次同步（刷新/切作品前为 false，避免空态闪烁） */
  const storyboardListSyncReady = ref(false)
  const storyboardListInFlightKey = ref<string | null>(null)
  const storyboardListLoadGeneration = ref(0)

  async function loadStoryScriptFromApi() {
    if (shouldSkipFlowProjectScopedApis(route)) return

    const stepKey = routePathToCreationStep(route.path)
    // 第三步 / 剧集分集列表自动提取依赖剧本正文
    if (
      stepKey !== 'story-script' &&
      stepKey !== 'scene-character' &&
      !isSeriesEpisodeListPath(route.path)
    ) {
      return
    }

    if (import.meta.client) {
      await waitForCreationStoreHydrated(creationStore, route)
    }
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return

    const fetchKey = `${ctx.projectId}-${ctx.episodeId}`
    if (storyScriptDetailFetchedKey.value === fetchKey) return
    if (storyScriptDetailInFlightKey.value === fetchKey) return

    storyScriptDetailInFlightKey.value = fetchKey
    storyScriptLoadGeneration.value += 1
    const gen = storyScriptLoadGeneration.value

    // 请求成功且上下文仍一致后再替换正文，避免路由切换或接口失败把现有剧本清空。
    const previousEditorHtml = (creationStore.formData.storyScript.content || '').trim()

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
        if (data.comicVersion != null) {
          creationStore.setScriptComicVersion(Number(data.comicVersion))
        }
      } else {
        creationStore.updateFormData({
          storyScript: { content: '' }
        })
        creationStore.setScriptComicVersion(0)
      }
      creationStore.setScriptServerHtmlBaseline(
        storyScriptOriginalTextForApi(creationStore.formData.storyScript.content || '')
      )
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '加载剧本失败')
    } finally {
      storyScriptDetailLoading.value = false
      if (storyScriptDetailInFlightKey.value === fetchKey) {
        storyScriptDetailInFlightKey.value = null
      }
    }
  }

  /** 第四/五/六步：从工作台拉取分镜列表（/api/user/storyboard/list），写入 store 并触发分镜视频/配音联动 */
  async function loadStoryboardListFromApi() {
    if (shouldSkipFlowProjectScopedApis(route)) return

    const stepKey = routePathToCreationStep(route.path)
    if (
      stepKey !== 'storyboard-script' &&
      stepKey !== 'storyboard-video' &&
      stepKey !== 'dubbing' &&
      stepKey !== 'preview'
    ) {
      return
    }

    storyboardListSyncReady.value = false
    storyboardListLoading.value = true

    if (import.meta.client) {
      await waitForCreationStoreHydrated(creationStore, route)
    }
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) {
      storyboardListLoading.value = false
      storyboardListSyncReady.value = true
      return
    }

    const fetchKey = `${ctx.projectId}-${ctx.episodeId}`
    const shouldForceRefresh =
      stepKey === 'storyboard-video' || stepKey === 'dubbing' || stepKey === 'preview'
    /** in-flight 去重按作品/剧集维度：同一份列表并发中时，不因步骤名不同而重复请求 */
    const requestKey = fetchKey
    if (storyboardListInFlightKey.value === requestKey) return
    if (!shouldForceRefresh && storyboardListFetchedKey.value === fetchKey) {
      storyboardListLoading.value = false
      storyboardListSyncReady.value = true
      return
    }

    storyboardListLoadGeneration.value += 1
    const gen = storyboardListLoadGeneration.value

    storyboardListInFlightKey.value = requestKey
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
      const panels = sorted.map((row, index) => mapStoryboardListRowToPanel(row, index))

      applyStoryboardScriptPanelsFromApi(panels)
      const scriptPanels = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
      applyStoryboardImageImmediatePanelLoadingRestore(creationStore, route, scriptPanels)
      hydrateStoryboardVideoLiveGenFromScopes(creationStore, route)
      const videoPanels = creationStore.formData.storyboardVideo.panels as StoryboardVideoPanel[]
      applyStoryboardVideoImmediatePanelLoadingRestore(
        creationStore,
        route,
        scriptPanels,
        videoPanels
      )
      creationStore.formData.storyboardVideo.panels = applyStoryboardVideoPanelUiFromStore(
        creationStore,
        scriptPanels,
        videoPanels
      )
      storyboardListFetchedKey.value = fetchKey
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '加载分镜列表失败')
    } finally {
      if (storyboardListInFlightKey.value === requestKey) {
        storyboardListInFlightKey.value = null
      }
      storyboardListLoading.value = false
      storyboardListSyncReady.value = true
    }
  }

  /** 剧本创作步骤：调用 /api/user/script/save 落库（版本+1） */
  async function saveStoryScriptToServer(): Promise<boolean> {
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
      if (row.comicVersion != null) {
        creationStore.setScriptComicVersion(Number(row.comicVersion))
      }
      return true
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '保存剧本失败')
      return false
    }
  }

  /** 点击「下一步」前按当前步骤调用对应持久化接口（可扩展多步） */
  async function persistCurrentStepBeforeNext(): Promise<boolean> {
    const stepKey = routePathToCreationStep(route.path)
    if (stepKey === 'story-script') {
      return saveStoryScriptToServer()
    }
    return true
  }

  const projectContextSig = computed(() => {
    const p = stepRequestParams.value
    return p ? `${p.projectId}:${p.episodeId ?? 'na'}` : ''
  })

  function storyScriptFetchKeyFromDeps(deps: readonly unknown[]): string | null {
    const path = String(deps[0] ?? '')
    const stepKey = routePathToCreationStep(path)
    if (stepKey !== 'story-script' && stepKey !== 'scene-character') return null
    const routeProjectIdRaw = Number(deps[4] ?? deps[5] ?? deps[6])
    const storePid = Number(deps[1])
    const projectId =
      Number.isFinite(storePid) && storePid > 0
        ? storePid
        : Number.isFinite(routeProjectIdRaw) && routeProjectIdRaw > 0
          ? routeProjectIdRaw
          : null
    if (!projectId) return null
    const routeEpRaw = deps[7]
    const storeEp = deps[2]
    const routeEp =
      routeEpRaw !== undefined && routeEpRaw !== '' && Number.isFinite(Number(routeEpRaw)) && Number(routeEpRaw) >= 0
        ? Number(routeEpRaw)
        : null
    const projectType = deps[3] as UserProjectType | null
    let episodeId: number
    if (projectType === 'movie') {
      episodeId =
        routeEp !== null
          ? routeEp
          : storeEp != null && Number(storeEp) >= 0
            ? Number(storeEp)
            : 0
    } else if (projectType === 'series') {
      const e =
        routeEp != null && routeEp > 0
          ? routeEp
          : storeEp != null && Number(storeEp) > 0
            ? Number(storeEp)
            : null
      if (e == null) return null
      episodeId = e
    } else {
      const e =
        routeEp != null
          ? routeEp
          : storeEp != null && Number(storeEp) >= 0
            ? Number(storeEp)
            : null
      if (e == null) return null
      episodeId = e
    }
    return `${projectId}-${episodeId}`
  }

  function shouldLoadStoryScriptForRoute(path: string): boolean {
    const stepKey = routePathToCreationStep(path)
    return (
      stepKey === 'story-script' ||
      stepKey === 'scene-character' ||
      isSeriesEpisodeListPath(path)
    )
  }

  function shouldLoadStoryboardListForRoute(path: string): boolean {
    const stepKey = routePathToCreationStep(path)
    return (
      stepKey === 'storyboard-script' ||
      stepKey === 'storyboard-video' ||
      stepKey === 'dubbing' ||
      stepKey === 'preview'
    )
  }

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
      const path = String(next[0] ?? '')
      const nextKey = storyScriptFetchKeyFromDeps(next)
      const prevKey = prev !== undefined ? storyScriptFetchKeyFromDeps(prev) : null
      if (prev !== undefined && nextKey !== prevKey) {
        storyScriptDetailFetchedKey.value = null
      }
      if (shouldLoadStoryScriptForRoute(path)) {
        void loadStoryScriptFromApi()
      }
      if (shouldLoadStoryboardListForRoute(path)) {
        void loadStoryboardListFromApi()
      }
    },
    { immediate: true }
  )

  /**
   * 内嵌「我的作品 / 资产库」时 project 已切换但 step/status 被 skip；
   * 回到流程主视图后须补拉，否则流程条仍显示上一作品的解锁进度。
   */
  const pendingStepStatusAfterEmbeddedPanel = ref(false)

  /** 流程壳未卸载时（内嵌作品库切作品）须重拉步骤解锁状态，否则进度条沿用上一作品 */
  watch(
    projectContextSig,
    (next, prev) => {
      if (!next || next === prev) return
      // 切换作品/剧集：作废进行中的步骤状态副作用（含 router.replace）
      stepStatusLoadGeneration.value += 1
      if (prev && next.split(':')[0] !== prev.split(':')[0]) {
        storyScriptDetailFetchedKey.value = null
      }
      storyboardListFetchedKey.value = null
      storyboardListInFlightKey.value = null
      storyboardListSyncReady.value = false
      storyboardListLoadGeneration.value += 1
      if (shouldSkipFlowProjectScopedApis(route)) {
        pendingStepStatusAfterEmbeddedPanel.value = true
        serverStepStatus.value = null
        unlockedStepIndex.value = flowStepIndex.value
        return
      }
      serverStepStatus.value = null
      void fetchCreationStepStatus()
    }
  )

  watch(
    () => shouldSkipFlowProjectScopedApis(route),
    (skip, prevSkip) => {
      if (skip || prevSkip !== true) return
      pendingStepStatusAfterEmbeddedPanel.value = false
      serverStepStatus.value = null
      void fetchCreationStepStatus()
    },
    { flush: 'post' }
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
      let stepKey = steps[safeCurrentStep - 1]?.key
      // 剧集不落「项目配置」页，服务端仍停在步骤 1 时改落到剧本创作
      if (creationStore.currentProjectType === 'series' && stepKey === 'global-setting') {
        stepKey = 'story-script'
      }
      if (stepKey) {
        const targetPath = creationStepToRoutePath(stepKey)
        // 已在目标步骤时跳过，避免与进行中的 out-in 叠导航导致白屏
        if (
          !shouldSkipCreateFlowSyncRoute({
            currentPath: route.path,
            targetPath
          })
        ) {
          void safeRouterReplace({ path: targetPath, query: { ...route.query } })
        }
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
  async function ensureRouteWithinUnlockedSteps(
    query: typeof route.query = { ...route.query },
    gen?: number,
    contextSig?: string
  ): Promise<boolean> {
    if (isSeriesScriptUploadPath(route.path) || isSeriesEpisodeListPath(route.path)) return false
    if (routePathToCreationStep(route.path) === null) return false
    if (flowStepIndex.value <= unlockedStepIndex.value) return false

    let targetKey = steps[unlockedStepIndex.value]?.key
    if (creationStore.currentProjectType === 'series' && targetKey === 'global-setting') {
      targetKey = 'story-script'
    }
    if (!targetKey) return false

    createStepSwapPlaceholder.value = true
    try {
      await nextTick()
      if (import.meta.client) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      }
      if (
        gen != null &&
        contextSig != null &&
        !isStepStatusFetchCurrent(gen, contextSig)
      ) {
        return false
      }
      const ok = await safeRouterReplace({
        path: creationStepToRoutePath(targetKey),
        query
      })
      if (!ok) return false
    } finally {
      createStepSwapPlaceholder.value = false
    }
    if (
      gen != null &&
      contextSig != null &&
      !isStepStatusFetchCurrent(gen, contextSig)
    ) {
      return true
    }
    if (targetKey === 'scene-character') {
      await nextTick()
      openExtractAgentModalIfNeeded('after-advance-to-scene-character')
    }
    return true
  }

  const fetchCreationStepStatus = async () => {
    if (stepApiLoading.value) {
      stepStatusPendingRerun = true
      return
    }
    if (isSeriesScriptUploadPath(route.path) || isSeriesEpisodeListPath(route.path)) return
    if (shouldSkipFlowProjectScopedApis(route)) return
    const params = stepRequestParams.value
    if (!params) {
      serverStepStatus.value = null
      unlockedStepIndex.value = creationStore.currentStepIndex
      return
    }
    // 剧集未选集时不请求 step/status，避免后端返回「请选择集数」并污染 UI
    if (
      creationStore.currentProjectType === 'series' &&
      (params.episodeId == null || params.episodeId <= 0)
    ) {
      return
    }
    const needAdvanceBeforeStatus =
      route.query.stepInitAdvance === '1' || String(route.query.stepInitAdvance ?? '') === 'true'
    const initTarget = String(route.query.stepInitTarget ?? '')
    const cleanQuery = { ...route.query }
    delete cleanQuery.stepInitAdvance
    delete cleanQuery.stepInitTarget

    stepApiLoading.value = true
    stepStatusLoadGeneration.value += 1
    const gen = stepStatusLoadGeneration.value
    const contextSig = projectContextSig.value
    try {
      let data = await fetchCreationStepStatusOnce(params)
      if (!isStepStatusFetchCurrent(gen, contextSig)) return
      if (!data || !Number.isFinite(Number(data.currentStep))) {
        message.error('获取步骤状态失败，请稍后重试')
        return
      }

      const isValidStepState = (d: typeof data | null | undefined): d is typeof data =>
        !!d && Number.isFinite(Number(d.currentStep))
      /**
       * advance 返回体可能为空（接口成功但无 data）。服务端 status 是步骤状态的唯一权威数据源：
       * 返回体有效则直接采用，否则重拉一次 status；两者都拿不到时保留 advance 前的有效状态。
       */
      const resolveStepStateAfterAdvance = async (
        adv: typeof data | null | undefined
      ): Promise<typeof data | null> => {
        if (isValidStepState(adv)) return adv
        try {
          // force：advance 已改变服务端状态，4s 内的 status 缓存已失效
          const refreshed = await fetchCreationStepStatusOnce(params, { force: true })
          return isValidStepState(refreshed) ? refreshed : null
        } catch {
          return null
        }
      }

      // 初始化标记只补齐尚未完成的步骤，避免重复进入时把已有进度回写或重复推进。
      if (needAdvanceBeforeStatus && Number(data.currentStep) <= 1) {
        try {
          const next = await resolveStepStateAfterAdvance(
            await creationStepAdvance({ ...params, completedStep: 1 })
          )
          if (next) {
            data = next
            serverReportedCurrentStep.value = Math.min(
              Math.max(Math.floor(Number(next.currentStep)), 1),
              steps.length
            )
          }
        } catch (e: unknown) {
          const err = e as { msg?: string; message?: string }
          message.warning(err?.msg || err?.message || '初始化步骤推进失败，将按服务端状态展示')
        }
      }

      // “生成剧集”已在列表页确认存在剧本，可安全补齐剧本步骤并直接进入素材准备。
      if (
        needAdvanceBeforeStatus &&
        initTarget === 'scene-character' &&
        Number(data.currentStep) === CREATE_FLOW_STEP_ORDER.indexOf('story-script') + 1
      ) {
        try {
          const next = await resolveStepStateAfterAdvance(
            await creationStepAdvance({
              ...params,
              completedStep: CREATE_FLOW_STEP_ORDER.indexOf('story-script') + 1
            })
          )
          if (next) {
            data = next
          }
        } catch (e: unknown) {
          const err = e as { msg?: string; message?: string }
          message.warning(err?.msg || err?.message || '剧本步骤推进失败，将返回剧本创作')
        }
      }

      if (!isStepStatusFetchCurrent(gen, contextSig)) return

      const serverStep = Math.min(
        Math.max(Math.floor(Number(data.currentStep)), 1),
        steps.length
      )
      const localRouteStep = Math.min(Math.max(flowStepIndex.value + 1, 1), steps.length)
      // 路由步骤高于服务端解锁进度时（切作品残留路由），禁止 reconcile 循环 advance，避免污染新作品步骤
      const merged =
        localRouteStep <= serverStep ? await reconcileAdvanceLoop(params, data) : data
      if (!isStepStatusFetchCurrent(gen, contextSig)) return
      const toApply =
        merged && Number.isFinite(Number(merged.currentStep)) ? merged : data
      applyServerStepState(toApply)
      const routeReplaced = await ensureRouteWithinUnlockedSteps(cleanQuery, gen, contextSig)

      if (
        needAdvanceBeforeStatus &&
        !routeReplaced &&
        isStepStatusFetchCurrent(gen, contextSig)
      ) {
        // 仅清理一次性初始化 query；路径不变时也用安全 replace，避免并发导航白屏
        const hasInitQuery =
          route.query.stepInitAdvance != null || route.query.stepInitTarget != null
        if (hasInitQuery) {
          await safeRouterReplace({ path: route.path, query: cleanQuery })
        }
      }
    } catch (error: unknown) {
      if (!isStepStatusFetchCurrent(gen, contextSig)) return
      if (isProjectMissingApiError(error)) {
        serverStepStatus.value = null
        await clearStaleCreateFlowProjectContext({ router, route, store: creationStore })
        return
      }
      const err = error as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '获取步骤状态失败')
    } finally {
      stepApiLoading.value = false
      if (stepStatusPendingRerun) {
        stepStatusPendingRerun = false
        void fetchCreationStepStatus()
      }
    }
  }

  watch(
    () => route.path,
    (path, oldPath) => {
      // 回到剧集列表/上传页：作废进行中的步骤导航，防止旧 replace 打到已卸载页面
      if (isSeriesScriptUploadPath(path) || isSeriesEpisodeListPath(path)) {
        stepStatusLoadGeneration.value += 1
        stepStatusPendingRerun = false
      }
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

  /**
   * 是否允许提交审核。
   * - 剧集无「项目配置」页，不因该步本地表单未填而拦截
   * - 有服务端步骤态时以其为准（成品预览页 formData 可能未完整回填）
   */
  const canSubmit = computed(() => {
    const projectType = creationStore.currentProjectType
    const isSeriesSkip = (key: string | undefined) =>
      projectType === 'series' && key === 'global-setting'

    if (serverStepStatus.value) {
      return serverStepStatus.value.every((status, index) => {
        const key = steps[index]?.key
        if (isSeriesSkip(key)) return true
        // 成品预览可为 current/active，其余步骤须 completed
        if (key === 'preview') return status === 'completed' || status === 'active'
        return status === 'completed'
      })
    }

    return steps.every((step, index) => {
      if (isSeriesSkip(step.key)) return true
      return isStepCompleted(index)
    })
  })

  const toolbarPrimaryLabel = computed(() =>
    flowStepIndex.value >= steps.length - 1 ? '提交审核' : '下一步'
  )
  const toolbarPrimaryDisabled = computed(
    () => flowStepIndex.value >= steps.length - 1 && !canSubmit.value
  )

  const goBack = () => {
    const path = route.path
    const from = String(route.query.from ?? '')
    const backOpts = { projectType: creationStore.currentProjectType }
    const navigateBack = (
      target: ReturnType<typeof resolveCreateFlowBackTarget>,
      replace = true
    ) => {
      const loc =
        target.type === 'path'
          ? { path: target.path }
          : { path: target.path, query: target.query }
      if (replace) void router.replace(loc)
      else void router.push(loc)
    }

    const inSeriesChrome = isSeriesScriptUploadPath(path) || isSeriesEpisodeListPath(path)
    const createStepKey = routePathToCreationStep(path)
    const isSeriesProject =
      creationStore.currentProjectType === 'series' ||
      String(route.query.projectType ?? '').toLowerCase() === 'series' ||
      (Number(route.query.episodeId) > 0 && creationStore.currentProjectType !== 'movie')

    // 剧集流程步骤页（剧本创作等）→ 先回剧集管理（保留 from=works，replace 避免与流程页 history 互跳）
    if (isSeriesProject && createStepKey != null && !inSeriesChrome) {
      const q: Record<string, string | string[] | null | undefined> = { ...route.query }
      delete q.episodeId
      delete q.stepInitAdvance
      void router.replace({ path: CREATE_SERIES_EPISODE_LIST_PATH, query: q })
      return
    }

    // 剧集管理 / 上传页：来自作品库 → 我的作品，并选中「电视剧集」
    if (
      inSeriesChrome &&
      (from === CREATE_FLOW_FROM_WORKS || from === CREATE_FLOW_FROM_PANEL_WORKS)
    ) {
      navigateBack(resolveCreateFlowBackTarget(route, backOpts), true)
      return
    }

    if (inSeriesChrome) {
      // 新建剧集流（上传 → 分集列表）且无 from：按历史逐级返回
      if (import.meta.client && typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
        return
      }
      if (isSeriesEpisodeListPath(path)) {
        void router.push({ path: CREATE_SERIES_SCRIPT_UPLOAD_PATH, query: { ...route.query } })
        return
      }
      navigateBack(resolveCreateFlowBackTarget(route, backOpts), true)
      return
    }

    navigateBack(resolveCreateFlowBackTarget(route, backOpts), true)
  }

  const handleStepClick = async (index: number) => {
    if (stepApiLoading.value || nextStepSubmitting.value) return

    // 剧集不进入「项目配置」步骤页
    if (
      creationStore.currentProjectType === 'series' &&
      steps[index]?.key === 'global-setting'
    ) {
      return
    }

    if (index <= unlockedStepIndex.value) {
      if (index === flowStepIndex.value) return
      const targetKey = steps[index]!.key
      if (!(await confirmIfLeavingScriptToPrepare(targetKey))) return
      await pushCreateStepRoute(targetKey)
      if (targetKey === 'scene-character') {
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

      const leavingScript = routePathToCreationStep(route.path) === 'story-script'
      if (leavingScript && !(await confirmIfLeavingScriptToPrepare('scene-character'))) {
        return
      }

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
        const data = await fetchCreationStepStatusOnce(params)
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
          // force：advance 已改变服务端状态，须绕过 status 短缓存取权威值
          data = await fetchCreationStepStatusOnce(params, { force: true })
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
    // 剧集：剧本创作为展示上的第一步 → 回剧集管理（与顶栏返回一致）
    if (
      creationStore.currentProjectType === 'series' &&
      flowStepIndex.value <= CREATE_FLOW_STEP_ORDER.indexOf('story-script')
    ) {
      const q: Record<string, string | string[] | null | undefined> = { ...route.query }
      delete q.episodeId
      delete q.stepInitAdvance
      void router.replace({ path: CREATE_SERIES_EPISODE_LIST_PATH, query: q })
      return
    }
    if (flowStepIndex.value > 0) {
      const prev = steps[flowStepIndex.value - 1]
      if (prev) {
        void pushCreateStepRoute(prev.key)
      }
    }
  }

  const handleSubmit = async (opts?: {
    alsoPublish?: boolean
    /** 发布弹窗已确认的封面/描述；优先于 detail 回落 */
    coverUrl?: string
    projectDesc?: string
  }): Promise<boolean> => {
    const hasExportedVideo =
      creationStore.currentExportStatus === 2 ||
      Boolean(String(creationStore.currentFinalVideoUrl || '').trim()) ||
      Boolean(String(creationStore.currentPendingVideoUrl || '').trim())
    // 已成功导出成片后的「发布至案例广场」：不因本地步骤表单未回填而拦截
    if (!canSubmit.value && !(opts?.alsoPublish && hasExportedVideo)) {
      message.warning('请完成所有步骤后再提交审核')
      return false
    }
    const projectId = creationStore.currentProjectId
    if (!projectId || projectId <= 0) {
      message.error('缺少项目信息，无法提交审核')
      return false
    }
    const projectType = creationStore.currentProjectType ?? 'movie'
    try {
      const projectDetail = await fetchUserProjectDetailOnce(projectId)
      const resolvePublishBody = () => {
        const coverUrl = String(opts?.coverUrl || projectDetail.coverUrl || '').trim()
        const projectDesc = String(opts?.projectDesc || projectDetail.projectDesc || '').trim()
        if (!coverUrl) {
          message.warning('请上传作品封面')
          return null
        }
        if (!projectDesc) {
          message.warning('请填写作品描述')
          return null
        }
        return { id: projectId, coverUrl, projectDesc }
      }
      if (projectType === 'series') {
        const episodeId = creationStore.currentEpisodeId
        if (episodeId == null || episodeId <= 0) {
          message.error('请先选择要提交审核的剧集')
          return false
        }
        const episodes = await userEpisodeList({ projectId })
        const episode = episodes.find((row) => row.id === episodeId)
        if (!episode) {
          message.error('剧集不存在，请刷新后重试')
          return false
        }
        applyEpisodeRowToCreationStore(creationStore, episode)

        if (episode.status === 3) {
          message.warning('作品审核中，请耐心等待')
          return false
        }

        // 发布链路：仅成片变更（待审新片）或未过审时才提审
        const shouldAudit = needsSubmitAuditBeforePublish(episode)
        if (opts?.alsoPublish) {
          const publishBody = resolvePublishBody()
          if (!publishBody) return false
          if (shouldAudit) {
            await userEpisodeSubmitAudit({ id: episodeId })
          }
          try {
            await userProjectPublish(publishBody)
            message.success(
              shouldAudit
                ? hasPendingReauditVideo(episode)
                  ? '已重新提交审核并发布，请等待审核通过后展示在案例广场'
                  : '已提交审核并发布，请等待审核通过后展示在案例广场'
                : '作品已发布至案例广场'
            )
          } catch (publishErr: unknown) {
            if (shouldAudit) {
              message.success('已提交审核，通过后将展示在案例广场')
            } else {
              throw publishErr
            }
          }
          router.push('/works')
          return true
        }

        const blocked = auditSubmitBlockedReason(episode)
        if (blocked) {
          message.warning(blocked)
          return false
        }
        await userEpisodeSubmitAudit({ id: episodeId })
        message.success(
          hasPendingReauditVideo(episode) ? '新片已重新提交审核' : '剧集已提交审核'
        )
      } else {
        creationStore.setCurrentMediaContext({
          projectStatus: projectDetail.status ?? null,
          projectIsPublic: projectDetail.isPublic ?? null,
          episodeStatus: projectDetail.status ?? null,
          episodeEditorId: projectDetail.episodeEditorId ?? null,
          finalVideoUrl: projectDetail.finalVideoUrl ?? null,
          pendingVideoUrl: projectDetail.pendingVideoUrl ?? null,
          exportStatus: projectDetail.exportStatus ?? null
        })

        if (projectDetail.status === 3) {
          message.warning('作品审核中，请耐心等待')
          return false
        }

        const shouldAudit = needsSubmitAuditBeforePublish(projectDetail)
        if (opts?.alsoPublish) {
          const publishBody = resolvePublishBody()
          if (!publishBody) return false
          if (shouldAudit) {
            await userProjectSubmitAudit({ id: projectId })
          }
          try {
            await userProjectPublish(publishBody)
            message.success(
              shouldAudit
                ? hasPendingReauditVideo(projectDetail)
                  ? '已重新提交审核并发布，请等待审核通过后展示在案例广场'
                  : '已提交审核并发布，请等待审核通过后展示在案例广场'
                : '作品已发布至案例广场'
            )
          } catch (publishErr: unknown) {
            if (shouldAudit) {
              message.success('已提交审核，通过后将展示在案例广场')
            } else {
              throw publishErr
            }
          }
          router.push('/works')
          return true
        }

        const blocked = auditSubmitBlockedReason(projectDetail)
        if (blocked) {
          message.warning(blocked)
          return false
        }
        if (!canSubmitAudit(projectDetail)) {
          message.warning('当前状态无法提交审核')
          return false
        }
        await userProjectSubmitAudit({ id: projectId })
        message.success(
          hasPendingReauditVideo(projectDetail) ? '新片已重新提交审核' : '项目已提交审核'
        )
      }
      router.push('/works')
      return true
    } catch (e: unknown) {
      if (isProjectPublicLockError(e)) {
        message.error(projectPublicLockUserHint())
        return false
      }
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || (opts?.alsoPublish ? '发布失败' : '提交审核失败'))
      return false
    }
  }

  const saveDraftSubmitting = ref(false)

  const saveDraft = async () => {
    if (saveDraftSubmitting.value) return
    if (routePathToCreationStep(route.path) !== 'story-script') return
    saveDraftSubmitting.value = true
    try {
      const ok = await saveStoryScriptToServer()
      if (ok) message.success('草稿已保存')
    } finally {
      saveDraftSubmitting.value = false
    }
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
    storyboardListSyncReady,
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
    saveDraftSubmitting,
    addCharacter
  }
}
