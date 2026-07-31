import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import type { ExtractAgents, ExtractModalScope } from '~/components/steps/ExtractAgentModal.vue'
import { useCreationStore } from '~/stores/creation'
import { htmlPlainTextLength } from '~/utils/htmlPlain'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import {
  userAssetExtractEstimate,
  userAssetExtractParallel,
  userAssetRpsList
} from '~/utils/businessApi'
import { fetchFlowUserTaskListOnce, filterUserTaskRowsForEpisode } from '~/utils/userTaskListFlowOnce'
import { requestCancelUserTaskById } from '~/utils/userTaskCancelFlow'
import { inferExtractAssetTabFromSse } from '~/utils/inferExtractAssetTabFromSse'
import { resolveStepIndexTotalFromSse } from '~/utils/taskSseProgressText'
import { buildParallelExtractSubmitPayload } from '~/utils/projectGenConfig'
import type { ExtractModelCodes } from '~/utils/extractAgentBiz'
import type { AssetExtractType, UserTaskStatus } from '~/types/business-api'
import {
  isCreateFlowEmbeddedLibraryPanel,
  isSeriesEpisodeListPath,
  routePathToCreationStep
} from '~/utils/createFlowRoutes'
import { useTaskStream } from '~/composables/useTaskStream'
import { formatPartialFailedMessage } from '~/utils/taskPartialFailed'
import { shouldAnnounceExtractSuccess } from '~/utils/extractTaskSuccessAnnounce'
import { scriptExtractBaselineStore } from '~/utils/scriptExtractBaseline'

/**
 * 自动弹出提取弹窗的上下文：
 * - current-route：已落在第三步路由（刷新/直达），仅当剧本有内容且场景/角色/道具在本地与后端均为空时弹
 * - step-click-scene-character：点击流程条进入第三步，同上
 * - after-advance-to-scene-character：从剧本创作「下一步」推进到素材准备，条件同上（与另两类一致）
 */
export type ExtractModalAutoOpenContext =
  | 'current-route'
  | 'step-click-scene-character'
  | 'after-advance-to-scene-character'

function isStoryScriptContentFilled(content: unknown): boolean {
  return typeof content === 'string' && htmlPlainTextLength(content) > 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseTaskId(raw: unknown): number | null {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}


function scopeToExtractTypes(scope: ExtractModalScope): AssetExtractType[] {
  if (scope === 'scene') return ['scene']
  if (scope === 'character') return ['character']
  if (scope === 'prop') return ['prop']
  /** 与常见流水线一致：先场景再角色再道具，便于 Tab 与 SSE 对齐 */
  return ['scene', 'character', 'prop']
}

/** 仅通过任务 SSE 等待结束，不调用 /api/user/task/detail */
function shouldUseStep3CurrentTabRefresh(route: ReturnType<typeof useRoute>): boolean {
  return (
    routePathToCreationStep(route.path) === 'scene-character' &&
    !isCreateFlowEmbeddedLibraryPanel(route.query)
  )
}

function extractResultRefreshTypes(
  scope: ExtractModalScope,
  types: AssetExtractType[],
  route: ReturnType<typeof useRoute>
): AssetExtractType[] {
  if (shouldUseStep3CurrentTabRefresh(route)) return []
  if (scope === 'scene' || scope === 'character' || scope === 'prop') return [scope]
  return types.length ? [types[0]!] : []
}

/**
 * 提取完成后只按目标 Tab 拉一次 rps/list：
 * - 更新该 Tab 的名称列表
 * - 同时收集该 Tab 尚无形态的资产，供第三步小卡片展示
 */
async function syncExtractedAssetsFromServer(
  creationStore: ReturnType<typeof useCreationStore>,
  ctx: { projectId: number; episodeId: number },
  extractTypes: AssetExtractType[]
) {
  const out: Array<{ assetId: number; assetType: 'scene' | 'character' | 'prop'; title: string }> = []
  /** 三类资产列表相互独立，并行拉取缩短提取完成后的回显耗时 */
  const listByType = await Promise.all(
    extractTypes.map(async (type) => {
      const { rows } = await userAssetRpsList({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        assetType: type
      })
      return { type, rows }
    })
  )
  for (const { type, rows } of listByType) {
    if (type === 'scene') {
      creationStore.updateSceneCharacterData({
        scenes: rows.map((r, i) => (r.assetName || '').trim() || `场景${i + 1}`)
      })
    } else if (type === 'character') {
      creationStore.updateSceneCharacterData({
        characters: rows.map((r, i) => (r.assetName || '').trim() || `角色${i + 1}`)
      })
    } else {
      creationStore.updateSceneCharacterData({
        props: rows.map((r, i) => (r.assetName || '').trim() || `道具${i + 1}`)
      })
    }

    for (const row of rows ?? []) {
      const hasAnyForm =
        Array.isArray(row.forms) && row.forms.some((f) => Number.isFinite(Number(f?.id)) && Number(f?.id) > 0)
      if (hasAnyForm) continue
      const id = Number(row.id)
      if (!Number.isFinite(id) || id <= 0) continue
      const title = String(row.assetName || '').trim() || '未命名'
      out.push({ assetId: id, assetType: type, title })
    }
  }
  return out
}

/**
 * 场景/角色/道具智能提取：
 * 1) 预估（estimate）
 * 2) 提交异步任务（parallel）
 * 3) 跟任务 SSE 直至完成（不再调用 /api/user/task/detail 轮询）
 * 4) 完成后回刷 rps/list，同步第三步名称列表
 * 5) 对尚无形态的入库资产写入 store「待生成形态」列表，由用户在第三步小卡片上逐条触发 /extract/form/generate（不再在提取成功后自动串行调用）
 */
export function useCreateFlowExtractAgents() {
  const MIN_EXTRACTING_VISIBLE_MS = 5000
  const route = useRoute()
  const creationStore = useCreationStore()
  const { extractingStage } = storeToRefs(creationStore)
  const extractModalScope = ref<ExtractModalScope>('all')
  /** 用户在本作品/剧集上下文、仍停留在第三步时手动关闭自动弹窗后，不再重复弹出；离开第三步或切换作品/剧集后清除 */
  const autoExtractModalSuppressedKey = ref<string | null>(null)
  /** 丢弃过期的 openExtractAgentModalIfNeeded 异步结果（切面板/作品时递增） */
  let openExtractModalGeneration = 0
  /** 用户点击「停止生成」：跳过后续 chunk / 第二次剧集拆分任务 */
  const extractStopRequested = ref(false)
  const extractActiveTaskId = ref<number | null>(null)
  const extractStreamCloser = ref<null | (() => void)>(null)
  /** 当前 composable 打开的 asset_extract SSE 所属 scope（断开时必须释放 follow 登记，否则第三步无法重连） */
  let extractStreamScopeKey: string | null = null
  /** 作品/剧集切换时自增，用于丢弃旧 SSE 回调与 finally，避免与 SceneCharacterProp 恢复跟进打架 */
  let extractFollowSession = 0
  let extractRouteWatchBootstrapped = false

  function releaseExtractStreamFollow() {
    if (extractStreamScopeKey) {
      creationStore.setAssetExtractFollowTask(extractStreamScopeKey, null)
      extractStreamScopeKey = null
    }
    creationStore.setAssetExtractShellLiveTaskId(null)
  }

  function getExtractFlowContextKey(): string {
    return getExtractAutoOpenContextKey()
  }

  function isBenignExtractStreamAbortError(e: unknown): boolean {
    const err = e as { name?: string; message?: string }
    if (err?.name === 'AbortError') return true
    const msg = String((e as Error)?.message ?? e ?? '').toLowerCase()
    if (!msg) return false
    return (
      msg.includes('abort') ||
      msg.includes('cancel') ||
      msg.includes('signal is aborted') ||
      msg.includes('ended unexpectedly') ||
      msg.includes('networkerror') ||
      msg.includes('failed to fetch') ||
      msg.includes('load failed') ||
      msg.includes('body stream')
    )
  }

  function stopExtractStreamForContextChange() {
    extractFollowSession++
    releaseExtractStreamFollow()
    try {
      extractStreamCloser.value?.()
    } catch {
      /* ignore */
    }
    extractStreamCloser.value = null
    extractActiveTaskId.value = null
  }

  let extractResumeGeneration = 0

  /** 切作品/从内嵌库回到流程：提取 loading 仍在但 SSE 已断时，通知第三步重连 */
  async function tryResumeAssetExtractTrack() {
    if (!import.meta.client) return
    if (isCreateFlowEmbeddedLibraryPanel(route.query)) return
    const onSceneCharacter = routePathToCreationStep(route.path) === 'scene-character'
    const onSeriesEpisodeList = isSeriesEpisodeListPath(route.path)
    if (!onSceneCharacter && !onSeriesEpisodeList) return
    if (extractStreamCloser.value) return

    const gen = ++extractResumeGeneration
    const scopeKey = creationStore.step3GenVisualScopeKey()
    if (creationStore.getAssetExtractShellLiveTaskId()) {
      creationStore.setAssetExtractShellLiveTaskId(null)
      creationStore.setAssetExtractFollowTask(scopeKey, null)
    }
    if (!creationStore.isExtractingAssets) return

    const taskId = await resolveLatestOngoingAssetExtractTaskId()
    if (gen !== extractResumeGeneration) return
    if (!taskId) {
      creationStore.finishAssetExtractUiForCurrentScope()
      return
    }
    await nextTick()
    if (gen !== extractResumeGeneration) return
    window.dispatchEvent(
      new CustomEvent('create-flow-track-task', {
        detail: { taskId, taskType: 'asset_extract' }
      })
    )
  }

  watch(
    () => getExtractFlowContextKey(),
    (next, prev) => {
      if (!extractRouteWatchBootstrapped) {
        extractRouteWatchBootstrapped = true
        return
      }
      if (prev && next !== prev) {
        stopExtractStreamForContextChange()
        autoExtractModalSuppressedKey.value = null
        void nextTick().then(() => tryResumeAssetExtractTrack())
      }
    }
  )

  const hasStoryScript = (): boolean => {
    return isStoryScriptContentFilled(creationStore.formData.storyScript.content)
  }

  /** 已有进行中的资产提取任务时不再自动弹出智能体弹窗（刷新后由列表页恢复 SSE 即可） */
  const hasOngoingAssetExtractTask = async (): Promise<boolean> => {
    try {
      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (!ctx) return false
      /** 必须 force：步骤切走再切回时会话缓存可能仍是提取开始前的列表，误判「无进行中任务」导致弹窗误弹 */
      /** 剧集隔离：其它集的提取任务不影响本集弹窗判定 */
      const list = filterUserTaskRowsForEpisode(
        await fetchFlowUserTaskListOnce(ctx.projectId, { force: true }),
        ctx.episodeId
      )
      const st = (s: unknown) => String(s ?? '').trim().toUpperCase()
      return list.some((t) => {
        if (t?.taskType !== 'asset_extract') return false
        const u = st(t.status)
        return u === 'PENDING' || u === 'PROCESSING' || u === 'RUNNING' || u === 'QUEUED' || u === 'WAITING'
      })
    } catch {
      return false
    }
  }

  const isSceneCharacterPropEmpty = (): boolean => {
    const sc = creationStore.formData.sceneCharacter
    const hasName = (arr: string[]) => arr.some((s) => typeof s === 'string' && s.trim().length > 0)
    return !hasName(sc.scenes) && !hasName(sc.characters) && !hasName(sc.props)
  }

  /** 路由 + 作品/剧集上下文：await 期间若用户切换作品，用于丢弃过期的自动弹窗逻辑 */
  function getExtractAutoOpenContextKey(): string {
    const q = route.query
    return [
      route.path,
      String(creationStore.currentProjectId ?? ''),
      String(creationStore.currentEpisodeId ?? ''),
      String(q.projectId ?? ''),
      String(q.id ?? ''),
      String(q.workId ?? ''),
      String(q.episodeId ?? '')
    ].join('|')
  }

  /** 是否应自动弹出提取弹窗：本地与服务端的场景、角色、道具必须全部为空。 */
  async function areAllStep3AssetRpsListsEmptyForAutoExtract(): Promise<boolean> {
    if (!isSceneCharacterPropEmpty()) return false

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return false

    try {
      const results = await Promise.all(
        (['scene', 'character', 'prop'] as AssetExtractType[]).map((assetType) =>
          userAssetRpsList({
            projectId: ctx.projectId,
            episodeId: ctx.episodeId,
            assetType
          })
        )
      )
      return results.every(({ rows }) => (rows?.length ?? 0) === 0)
    } catch {
      return false
    }
  }

  /** stepInitAdvance 期间可能先落到素材准备再被回退到剧本，此时禁止自动弹窗避免闪现 */
  function hasPendingStepInitAdvance(): boolean {
    return (
      route.query.stepInitAdvance === '1' ||
      String(route.query.stepInitAdvance ?? '') === 'true'
    )
  }

  function shouldAllowAutoExtractModalOpen(ctxKey: string): boolean {
    if (isCreateFlowEmbeddedLibraryPanel(route.query)) return false
    if (hasPendingStepInitAdvance()) return false
    if (autoExtractModalSuppressedKey.value === ctxKey) return false
    /** 提取 UI 仍挂着（切步骤断 SSE 未 finish）或壳层仍在跟提取任务时，禁止再自动弹提取弹窗 */
    if (creationStore.isExtractingAssets) return false
    if (creationStore.getAssetExtractShellLiveTaskId()) return false
    // 最终必须以素材准备路由为准（防止异步完成时已回退到剧本制作）
    if (routePathToCreationStep(route.path) !== 'scene-character') return false
    return true
  }

  const openExtractAgentModalIfNeeded = (context: ExtractModalAutoOpenContext = 'current-route') => {
    const gen = ++openExtractModalGeneration
    void (async () => {
      const ctxKeyAtStart = getExtractAutoOpenContextKey()
      if (!shouldAllowAutoExtractModalOpen(ctxKeyAtStart)) return
      if (
        context === 'current-route' ||
        context === 'step-click-scene-character' ||
        context === 'after-advance-to-scene-character'
      ) {
        if (!creationStore.step3AssetListSyncReady) return
        if (await hasOngoingAssetExtractTask()) {
          creationStore.showExtractAgentModal = false
          return
        }
      }
      if (gen !== openExtractModalGeneration) return
      if (getExtractAutoOpenContextKey() !== ctxKeyAtStart) return
      if (!shouldAllowAutoExtractModalOpen(ctxKeyAtStart)) return

      if (!hasStoryScript()) return

      const serverEmpty = await areAllStep3AssetRpsListsEmptyForAutoExtract()
      if (gen !== openExtractModalGeneration) return
      if (getExtractAutoOpenContextKey() !== ctxKeyAtStart) return
      if (!shouldAllowAutoExtractModalOpen(ctxKeyAtStart)) return
      if (!serverEmpty) return

      // 服务端三列表均为空：以接口为准，清掉 Pinia 持久化遗留的本地名称，避免误拦弹窗
      if (!isSceneCharacterPropEmpty()) {
        creationStore.updateSceneCharacterData({ scenes: [], characters: [], props: [] })
      }
      if (gen !== openExtractModalGeneration) return
      if (getExtractAutoOpenContextKey() !== ctxKeyAtStart) return
      if (!shouldAllowAutoExtractModalOpen(ctxKeyAtStart)) return

      extractModalScope.value = 'all'
      creationStore.setExtractModalActionMode('start')
      creationStore.showExtractAgentModal = true
    })()
  }

  watch(
    () => creationStore.showExtractAgentModal,
    (open, prev) => {
      if (prev === true && open === false && !creationStore.isExtractingAssets) {
        autoExtractModalSuppressedKey.value = getExtractAutoOpenContextKey()
      }
    }
  )

  watch(
    () => ({
      path: route.path,
      panel: String(route.query.panel ?? ''),
      ctx: `${String(route.query.projectId ?? '')}:${String(route.query.id ?? '')}:${String(route.query.workId ?? '')}:${String(route.query.episodeId ?? '')}`
    }),
    ({ path, panel }) => {
      const onSceneCharacter = routePathToCreationStep(path) === 'scene-character'
      const onEmbeddedLib = panel === 'works' || panel === 'assets'
      if (!onSceneCharacter || onEmbeddedLib) {
        openExtractModalGeneration++
        creationStore.showExtractAgentModal = false
        autoExtractModalSuppressedKey.value = null
      }
    },
    { flush: 'post', immediate: true }
  )

  /** 从内嵌作品库回到流程：若提取 loading 仍在但 SSE 已断，通知第三步重连 */
  watch(
    () => String(route.query.panel ?? ''),
    async (panel, prev) => {
      const wasEmbeddedLib = prev === 'works' || prev === 'assets'
      const nowFlow = panel !== 'works' && panel !== 'assets'
      if (!wasEmbeddedLib || !nowFlow) return
      await tryResumeAssetExtractTrack()
    },
    { flush: 'post' }
  )

  function handleOpenExtractModalFromScp(scope: Exclude<ExtractModalScope, 'all'>) {
    if (!hasStoryScript()) {
      message.warning('请先添加剧本故事')
      return
    }
    extractModalScope.value = scope
    creationStore.setExtractModalActionMode('start')
    creationStore.showExtractAgentModal = true
  }

  const extractingStageLabel = computed(() => {
    if (extractingStage.value === 'scene') return '场景'
    if (extractingStage.value === 'character') return '角色'
    return '道具'
  })

  const updateExtractAgents = (v: ExtractAgents) => {
    creationStore.updateExtractAgents(v)
  }

  const updateExtractModelCodes = (v: ExtractModelCodes) => {
    creationStore.updateExtractModelCodes(v)
  }

  const finishExtracting = () => {
    creationStore.finishAssetExtractUiForCurrentScope()
  }

  const startExtractAssets = (payload: {
    agents: ExtractAgents
    modelCodes: ExtractModelCodes
    manualModelPickByKind?: Partial<Record<AssetExtractType, boolean>>
    scope: ExtractModalScope
    overwrite?: boolean
  }) => {
    void (async () => {
      const { agents, modelCodes, scope } = payload
      const overwrite = payload.overwrite === true
      const manualModelPickByKind = payload.manualModelPickByKind ?? {}
      const flowCtxAtStart = getExtractFlowContextKey()
      const sessionAtStart = extractFollowSession
      creationStore.updateExtractAgents(agents)
      creationStore.updateExtractModelCodes(modelCodes)
      creationStore.setExtractingAssets(true)
      extractStopRequested.value = false
      extractActiveTaskId.value = null
      extractStreamCloser.value = null
      creationStore.syncExtractUiToCurrentScope()
      const extractingVisibleStartedAt = Date.now()
      let shouldKeepExtractingVisible = false

      const ctx = await resolveStoryScriptSaveContext(creationStore, route)
      if (!ctx) {
        message.warning('缺少项目或剧集信息，请从「我的作品」进入创作流程后再试')
        finishExtracting()
        return
      }
      if (!hasStoryScript()) {
        message.warning('剧本内容为空，无法提取')
        finishExtracting()
        return
      }

      const extractTypes = scopeToExtractTypes(scope)
      creationStore.setExtractingStage(extractTypes[0] || 'scene')
      creationStore.setExtractingStages({
        scene: extractTypes.includes('scene'),
        character: extractTypes.includes('character'),
        prop: extractTypes.includes('prop')
      })
      creationStore.setExtractingTaskProgress({
        percent: 0,
        stepTitle: '提交提取任务',
        message: '',
        stepIndex: null,
        stepTotal: null
      })

      try {
        const estimate = await userAssetExtractEstimate({
          projectId: ctx.projectId,
          episodeId: ctx.episodeId,
          extractTypes
        })
        if ((estimate?.existingCharacterCount ?? 0) > 0 && extractTypes.includes('character')) {
          message.warning('检测到已有角色，提取完成后将按后端规则更新角色列表')
        }

        if (extractStopRequested.value) {
          return
        }

        /** @returns 仅 SSE 真正 SUCCEEDED 时为 true；切页中断/停止/部分失败为 false */
        const runExtractOnce = async (types: AssetExtractType[]): Promise<boolean> => {
          if (types.length === 0) return true
          if (extractStopRequested.value) return false
          if (
            sessionAtStart !== extractFollowSession ||
            getExtractFlowContextKey() !== flowCtxAtStart
          ) {
            return false
          }
          creationStore.setExtractingStage(types[0] || 'scene')
          creationStore.setExtractingStages({
            scene: types.includes('scene'),
            character: types.includes('character'),
            prop: types.includes('prop')
          })
          creationStore.setExtractingTaskProgress({
            percent: 0,
            stepTitle: '提交提取任务',
            message: '',
            stepIndex: null,
            stepTotal: null
          })

          if (extractStopRequested.value) return false

          const manualModelOverrides: Partial<Record<AssetExtractType, string>> = {}
          for (const t of types) {
            if (manualModelPickByKind[t]) {
              const code = String(modelCodes[t] || '').trim()
              if (code) manualModelOverrides[t] = code
            }
          }

          const parallelPayload = await buildParallelExtractSubmitPayload(
            ctx.projectId,
            types,
            manualModelOverrides
          )
          const task = await userAssetExtractParallel({
            projectId: ctx.projectId,
            episodeId: ctx.episodeId,
            extractTypes: types,
            agentCodes: parallelPayload.agentCodes,
            ...(parallelPayload.modelCodes ? { modelCodes: parallelPayload.modelCodes } : {}),
            ...(overwrite ? { overwrite: true } : {})
          })
          const taskId = parseTaskId((task as { taskId?: number }).taskId ?? task.id)
          if (!taskId) throw new Error('提取任务提交失败：未返回任务ID')
          if (extractStopRequested.value) {
            try {
              await requestCancelUserTaskById(taskId)
            } catch {
              /* ignore */
            }
            return false
          }
          shouldKeepExtractingVisible = true
          extractActiveTaskId.value = taskId
          extractStreamScopeKey = creationStore.step3GenVisualScopeKey()
          creationStore.setAssetExtractFollowTask(extractStreamScopeKey, taskId)
          creationStore.setAssetExtractShellLiveTaskId(taskId)
          if (import.meta.client) {
            window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
          }

          // 优先 SSE：实时进度；完成以 SSE 为准，不再请求 task/detail 轮询兜底
          let statusRes: { status: UserTaskStatus; errorMessage?: string | null } | null = null
          let streamConnected = false
          try {
            const stream = useTaskStream(taskId)
            extractStreamCloser.value = () => {
              try {
                stream.close()
              } catch {
                /* ignore */
              }
            }
            const stopWatch = watch(
              () => stream.lastProgress.value,
              (p) => {
                if (sessionAtStart !== extractFollowSession) return
                if (getExtractFlowContextKey() !== flowCtxAtStart) return
                if (!p) return
                creationStore.setExtractingAssets(true)
                const msgText = String(p.message || '').trim()
                const titleText = String(p.stepTitle || '').trim()
                const { stepIndex, stepTotal } = resolveStepIndexTotalFromSse(p)
                creationStore.setExtractingTaskProgress({
                  percent: typeof p.progress === 'number' ? p.progress : creationStore.extractingTaskProgress.percent,
                  stepTitle: titleText || msgText || creationStore.extractingTaskProgress.stepTitle,
                  message: msgText || titleText,
                  stepIndex,
                  stepTotal
                })
                creationStore.syncExtractUiToCurrentScope()
                const tab = inferExtractAssetTabFromSse({
                  stage: p.stage,
                  stepTitle: p.stepTitle,
                  message: p.message
                })
                if (tab) creationStore.setExtractingStage(tab)
              },
              { immediate: true }
            )
            try {
              const res = await stream.done
              if (res.type === 'error') {
                statusRes = { status: 'FAILED', errorMessage: res.errorMessage || '任务失败' }
              } else if (res.type === 'cancelled') {
                statusRes = { status: 'CANCELLED', errorMessage: res.message || '任务已取消' }
              } else if (res.type === 'partial_failed') {
                statusRes = {
                  status: 'PARTIAL_FAILED',
                  errorMessage: formatPartialFailedMessage(res.data, '部分提取失败，可在任务中心续生')
                }
              } else {
                statusRes = { status: 'SUCCEEDED', errorMessage: null }
              }
            } finally {
              streamConnected = stream.connected.value
              stopWatch()
              extractStreamCloser.value = null
              extractActiveTaskId.value = null
              releaseExtractStreamFollow()
              try {
                stream.close()
              } catch {
                /* ignore */
              }
            }
          } catch (e: unknown) {
            extractStreamCloser.value = null
            extractActiveTaskId.value = null
            releaseExtractStreamFollow()
            if (
              sessionAtStart !== extractFollowSession ||
              getExtractFlowContextKey() !== flowCtxAtStart
            ) {
              return false
            }
            // 切页/主动 close 会 abort：不能当成功；交由外层会话门槛抑制误报 toast
            if (isBenignExtractStreamAbortError(e)) return false
            if (!streamConnected) throw e
            statusRes = {
              status: 'FAILED',
              errorMessage: String((e as { message?: string })?.message || '任务连接异常')
            }
          }

          if (extractStopRequested.value) {
            return false
          }
          if (
            sessionAtStart !== extractFollowSession ||
            getExtractFlowContextKey() !== flowCtxAtStart
          ) {
            return false
          }

          if (!statusRes) {
            throw new Error('AI 提取失败，请稍后重试')
          }

          if (import.meta.client) {
            window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
          }

          creationStore.setExtractingTaskProgress({
            percent: 100,
            stepTitle: '同步结果',
            message: ''
          })
          const refreshTypes = extractResultRefreshTypes(scope, types, route)
          if (refreshTypes.length > 0) {
            const pending = await syncExtractedAssetsFromServer(creationStore, ctx, refreshTypes)
            creationStore.mergePendingExtractFormAssets(pending)
          }

          if (statusRes.status === 'PARTIAL_FAILED') {
            message.warning(statusRes.errorMessage || '部分提取失败，可在任务中心续生')
            return false
          }

          if (statusRes.status !== 'SUCCEEDED') {
            throw new Error(statusRes.errorMessage || 'AI 提取失败，请稍后重试')
          }
          return true
        }

        // 剧集模式互斥：character 不能和 scene/prop 同时提交（按文档拆成两次任务）
        const isSeries = String(estimate?.projectType || '').toLowerCase() === 'series'
        const hasCharacter = extractTypes.includes('character')
        const hasSceneOrProp = extractTypes.includes('scene') || extractTypes.includes('prop')
        let extractOk = false
        if (isSeries && hasCharacter && hasSceneOrProp) {
          message.info('剧集模式：角色与场景/道具需分两次提取，已为您自动拆分执行')
          const charOk = await runExtractOnce(['character'])
          if (extractStopRequested.value) {
            message.info('已取消提取')
            extractStopRequested.value = false
            return
          }
          const rest: AssetExtractType[] = []
          if (extractTypes.includes('scene')) rest.push('scene')
          if (extractTypes.includes('prop')) rest.push('prop')
          const restOk = await runExtractOnce(rest)
          extractOk = charOk && restOk
        } else {
          extractOk = await runExtractOnce(extractTypes)
        }

        if (extractStopRequested.value) {
          message.info('已取消提取')
          extractStopRequested.value = false
        } else if (
          shouldAnnounceExtractSuccess({
            extractOk,
            stopRequested: extractStopRequested.value,
            sessionAtStart,
            sessionNow: extractFollowSession,
            flowCtxAtStart,
            flowCtxNow: getExtractFlowContextKey()
          })
        ) {
          if (scope === 'all') message.success('场景、角色、道具提取已完成')
          else if (scope === 'scene') message.success('场景提取已完成')
          else if (scope === 'character') message.success('角色提取已完成')
          else message.success('道具提取已完成')
          scriptExtractBaselineStore.recordExtractSuccessBaseline({
            projectId: ctx.projectId,
            episodeId: ctx.episodeId,
            comicVersion: Number(creationStore.scriptComicVersion) || 0,
            scriptHtml: creationStore.formData.storyScript.content || ''
          })
          creationStore.setExtractModalActionMode('start')
          creationStore.setScriptChangeLightBannerVisible(false)
        }
      } catch (e: unknown) {
        if (
          sessionAtStart !== extractFollowSession ||
          getExtractFlowContextKey() !== flowCtxAtStart
        ) {
          return
        }
        if (extractStopRequested.value) {
          message.info('已取消提取')
          extractStopRequested.value = false
        } else if (!isBenignExtractStreamAbortError(e)) {
          const err = e as { msg?: string; message?: string }
          message.error(err?.msg || err?.message || 'AI 提取失败，请稍后重试')
        }
      } finally {
        if (
          sessionAtStart === extractFollowSession &&
          getExtractFlowContextKey() === flowCtxAtStart
        ) {
          if (shouldKeepExtractingVisible) {
            const elapsed = Date.now() - extractingVisibleStartedAt
            const remain = MIN_EXTRACTING_VISIBLE_MS - elapsed
            if (remain > 0) {
              await sleep(remain)
            }
          }
          finishExtracting()
        }
      }
    })()
  }

  /**
   * 本地尚未写入 taskId 时（仍在 estimate/提交 parallel 前）用户会点「停止」：
   * 用任务列表兜底查找当前项目下进行中的 asset_extract，再调 /api/user/asset/extract/cancel
   */
  async function resolveLatestOngoingAssetExtractTaskId(): Promise<number | null> {
    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return null
    try {
      /** 剧集隔离：兜底取消只找本集进行中的提取任务，防止误取消其它集任务 */
      const all = filterUserTaskRowsForEpisode(
        await fetchFlowUserTaskListOnce(ctx.projectId),
        ctx.episodeId
      )
      const st = (s: unknown) => String(s ?? '').trim().toUpperCase()
      const rows = all.filter((t) => {
        if (t?.taskType !== 'asset_extract') return false
        const u = st(t.status)
        return u === 'PENDING' || u === 'PROCESSING' || u === 'RUNNING' || u === 'QUEUED' || u === 'WAITING'
      })
      rows.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      return parseTaskId(rows[0]?.id)
    } catch {
      return null
    }
  }

  const stopExtractAssets = async () => {
    extractStopRequested.value = true
    const close = extractStreamCloser.value

    let cancelTaskId = extractActiveTaskId.value
    if (!cancelTaskId) {
      cancelTaskId = await resolveLatestOngoingAssetExtractTaskId()
      if (!cancelTaskId) {
        await sleep(400)
        cancelTaskId = await resolveLatestOngoingAssetExtractTaskId()
      }
    }

    if (cancelTaskId) {
      try {
        await requestCancelUserTaskById(cancelTaskId)
        message.success('已请求停止提取任务')
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.warning(err?.msg || err?.message || '停止请求失败，已断开本页进度')
      }
    } else {
      message.info('任务尚未提交或已结束，已关闭本页提取状态')
    }

    close?.()
    extractStreamCloser.value = null
    extractActiveTaskId.value = null
    finishExtracting()
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('create-flow-global-tasks-updated'))
    }
  }

  return {
    extractModalScope,
    extractingStageLabel,
    updateExtractAgents,
    updateExtractModelCodes,
    startExtractAssets,
    stopExtractAssets,
    openExtractAgentModalIfNeeded,
    handleOpenExtractModalFromScp
  }
}
