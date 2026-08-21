'use client'

/**
 * 剧本 / 分镜列表拉取与剧本保存（原 useCreateFlowRouteAndSteps 的数据侧拆分）。
 */

import { message } from 'antd'
import { applyStoryboardScriptPanelsFromApi } from '~/composables/useCreateFlowStoryboardSync'
import {
hydrateStoryboardVideoLiveGenFromScopes,
waitForCreationStoreHydrated
} from '~/composables/useCreationStoreHydration'
import { useCreationStore } from '~/stores/creation'
import type { StoryboardPanel,StoryboardVideoPanel } from '~/types'
import type { UserProjectType } from '~/types/business-api'
import { userScriptDetailByProject,userScriptSave,userStoryboardList } from '~/utils/businessApi'
import { shouldSkipFlowProjectScopedApis } from '~/utils/createFlowProjectContext'
import { isSeriesEpisodeListPath,routePathToCreationStep } from '~/utils/createFlowRoutes'
import {
htmlPlainTextLength,
resolveStoryScriptEditorHtmlAfterApiLoad,
storyScriptOriginalTextForApi
} from '~/utils/htmlPlain'
import { applyStoryboardImageImmediatePanelLoadingRestore } from '~/utils/storyboardImageBatchShared'
import { mapStoryboardListRowToPanel } from '~/utils/storyboardPanelMap'
import {
applyStoryboardVideoImmediatePanelLoadingRestore,
applyStoryboardVideoPanelUiFromStore
} from '~/utils/storyboardVideoBatchShared'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'
import { setBox,type RouteStepsCtx } from './types'

export function isStoryScriptContentFilled(content: unknown): boolean {
  return typeof content === 'string' && htmlPlainTextLength(content) > 0
}

export async function loadStoryScriptFromApi(ctx: RouteStepsCtx): Promise<void> {
  const route = ctx.getRoute()
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

  if (typeof window !== 'undefined') {
    await waitForCreationStoreHydrated(useCreationStore.getState(), route)
  }
  const saveCtx = await resolveStoryScriptSaveContext(useCreationStore.getState(), ctx.getRoute())
  if (!saveCtx) return

  const fetchKey = `${saveCtx.projectId}-${saveCtx.episodeId}`
  if (ctx.storyScriptDetailFetchedKey.value === fetchKey) return
  if (ctx.storyScriptDetailInFlightKey.value === fetchKey) return

  setBox(ctx, ctx.storyScriptDetailInFlightKey, fetchKey)
  setBox(ctx, ctx.storyScriptLoadGeneration, ctx.storyScriptLoadGeneration.value + 1)
  const gen = ctx.storyScriptLoadGeneration.value

  // 请求成功且上下文仍一致后再替换正文，避免路由切换或接口失败把现有剧本清空。
  const previousEditorHtml = (
    useCreationStore.getState().formData.storyScript.content || ''
  ).trim()

  setBox(ctx, ctx.storyScriptDetailLoading, true)
  try {
    const data = await userScriptDetailByProject(saveCtx)
    if (gen !== ctx.storyScriptLoadGeneration.value) return

    const ctxAfter = await resolveStoryScriptSaveContext(
      useCreationStore.getState(),
      ctx.getRoute()
    )
    if (
      !ctxAfter ||
      ctxAfter.projectId !== saveCtx.projectId ||
      ctxAfter.episodeId !== saveCtx.episodeId
    ) {
      return
    }

    setBox(ctx, ctx.storyScriptDetailFetchedKey, fetchKey)
    const store = useCreationStore.getState()
    if (data) {
      const raw = (data.originalText || '').trim()
      store.updateFormData({
        storyScript: {
          content: resolveStoryScriptEditorHtmlAfterApiLoad(raw, previousEditorHtml)
        }
      })
      if (data.comicVersion != null) {
        store.setScriptComicVersion(Number(data.comicVersion))
      }
    } else {
      store.updateFormData({
        storyScript: { content: '' }
      })
      store.setScriptComicVersion(0)
    }
    useCreationStore
      .getState()
      .setScriptServerHtmlBaseline(
        storyScriptOriginalTextForApi(
          useCreationStore.getState().formData.storyScript.content || ''
        )
      )
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载剧本失败')
  } finally {
    setBox(ctx, ctx.storyScriptDetailLoading, false)
    if (ctx.storyScriptDetailInFlightKey.value === fetchKey) {
      setBox(ctx, ctx.storyScriptDetailInFlightKey, null)
    }
  }
}

/** 第四/五/六步：从工作台拉取分镜列表（/api/user/storyboard/list），写入 store 并触发分镜视频/配音联动 */
export async function loadStoryboardListFromApi(ctx: RouteStepsCtx): Promise<void> {
  const route = ctx.getRoute()
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

  setBox(ctx, ctx.storyboardListSyncReady, false)
  setBox(ctx, ctx.storyboardListLoading, true)

  if (typeof window !== 'undefined') {
    await waitForCreationStoreHydrated(useCreationStore.getState(), route)
  }
  const saveCtx = await resolveStoryScriptSaveContext(useCreationStore.getState(), ctx.getRoute())
  if (!saveCtx) {
    setBox(ctx, ctx.storyboardListLoading, false)
    setBox(ctx, ctx.storyboardListSyncReady, true)
    return
  }

  const fetchKey = `${saveCtx.projectId}-${saveCtx.episodeId}`
  const shouldForceRefresh =
    stepKey === 'storyboard-video' || stepKey === 'dubbing' || stepKey === 'preview'
  /** in-flight 去重按作品/剧集维度：同一份列表并发中时，不因步骤名不同而重复请求 */
  const requestKey = fetchKey
  if (ctx.storyboardListInFlightKey.value === requestKey) return
  if (!shouldForceRefresh && ctx.storyboardListFetchedKey.value === fetchKey) {
    setBox(ctx, ctx.storyboardListLoading, false)
    setBox(ctx, ctx.storyboardListSyncReady, true)
    return
  }

  setBox(ctx, ctx.storyboardListLoadGeneration, ctx.storyboardListLoadGeneration.value + 1)
  const gen = ctx.storyboardListLoadGeneration.value

  setBox(ctx, ctx.storyboardListInFlightKey, requestKey)
  try {
    const list = await userStoryboardList({
      projectId: saveCtx.projectId,
      episodeId: saveCtx.episodeId
    })
    if (gen !== ctx.storyboardListLoadGeneration.value) return

    const ctxAfter = await resolveStoryScriptSaveContext(
      useCreationStore.getState(),
      ctx.getRoute()
    )
    if (
      !ctxAfter ||
      ctxAfter.projectId !== saveCtx.projectId ||
      ctxAfter.episodeId !== saveCtx.episodeId
    ) {
      return
    }

    const sorted = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const panels = sorted.map((row, index) => mapStoryboardListRowToPanel(row, index))

    applyStoryboardScriptPanelsFromApi(panels)
    const storeNow = useCreationStore.getState()
    const scriptPanels = storeNow.formData.storyboardScript.panels as StoryboardPanel[]
    applyStoryboardImageImmediatePanelLoadingRestore(storeNow, ctx.getRoute(), scriptPanels)
    hydrateStoryboardVideoLiveGenFromScopes(useCreationStore.getState(), ctx.getRoute())
    const videoPanels = useCreationStore.getState().formData.storyboardVideo.panels as
      StoryboardVideoPanel[]
    applyStoryboardVideoImmediatePanelLoadingRestore(
      useCreationStore.getState(),
      ctx.getRoute(),
      scriptPanels,
      videoPanels
    )
    const nextVideoPanels = applyStoryboardVideoPanelUiFromStore(
      useCreationStore.getState(),
      scriptPanels,
      videoPanels
    )
    useCreationStore.setState((s) => ({
      formData: {
        ...s.formData,
        storyboardVideo: { ...s.formData.storyboardVideo, panels: nextVideoPanels }
      }
    }))
    setBox(ctx, ctx.storyboardListFetchedKey, fetchKey)
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载分镜列表失败')
  } finally {
    if (ctx.storyboardListInFlightKey.value === requestKey) {
      setBox(ctx, ctx.storyboardListInFlightKey, null)
    }
    setBox(ctx, ctx.storyboardListLoading, false)
    setBox(ctx, ctx.storyboardListSyncReady, true)
  }
}

/** 剧本创作步骤：调用 /api/user/script/save 落库（版本+1） */
export async function saveStoryScriptToServer(ctx: RouteStepsCtx): Promise<boolean> {
  const saveCtx = await resolveStoryScriptSaveContext(useCreationStore.getState(), ctx.getRoute())
  if (!saveCtx) {
    message.warning('缺少项目信息，请从「我的作品」打开作品后再编辑剧本')
    return false
  }
  const originalText = storyScriptOriginalTextForApi(
    useCreationStore.getState().formData.storyScript.content || ''
  )
  try {
    const row = await userScriptSave({ ...saveCtx, originalText })
    const syncedMarkdown = (row.originalText ?? originalText).trim()
    const store = useCreationStore.getState()
    store.setScriptServerHtmlBaseline(syncedMarkdown)
    if (row.comicVersion != null) {
      store.setScriptComicVersion(Number(row.comicVersion))
    }
    return true
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '保存剧本失败')
    return false
  }
}

/** 点击「下一步」前按当前步骤调用对应持久化接口（可扩展多步） */
export async function persistCurrentStepBeforeNext(ctx: RouteStepsCtx): Promise<boolean> {
  const stepKey = routePathToCreationStep(ctx.getRoute().path)
  if (stepKey === 'story-script') {
    return saveStoryScriptToServer(ctx)
  }
  return true
}

/** 原 storyScriptFetchKeyFromDeps：从 watch 依赖数组还原剧本拉取 key（切换检测用） */
export function storyScriptFetchKeyFromDeps(deps: readonly unknown[]): string | null {
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
    routeEpRaw !== undefined &&
    routeEpRaw !== '' &&
    Number.isFinite(Number(routeEpRaw)) &&
    Number(routeEpRaw) >= 0
      ? Number(routeEpRaw)
      : null
  const projectType = deps[3] as UserProjectType | null
  const storeMatchesProject = Number.isFinite(storePid) && storePid > 0 && storePid === projectId
  let episodeId: number
  if (projectType === 'movie') {
    // 与 detailByProject / resolveStoryScriptSaveContext 一致：电影固定 0
    episodeId = 0
  } else if (projectType === 'series') {
    const e =
      routeEp != null && routeEp > 0
        ? routeEp
        : storeMatchesProject && storeEp != null && Number(storeEp) > 0
          ? Number(storeEp)
          : null
    if (e == null) return null
    episodeId = e
  } else {
    // 类型未就绪：切作品窗口期勿用上一作品 episodeId 拼 key，避免误触发带错集 ID 的拉取
    if (!storeMatchesProject) return null
    const e = routeEp != null ? routeEp : storeEp != null && Number(storeEp) >= 0 ? Number(storeEp) : null
    if (e == null) return null
    episodeId = e
  }
  return `${projectId}-${episodeId}`
}

export function shouldLoadStoryScriptForRoute(path: string): boolean {
  const stepKey = routePathToCreationStep(path)
  return (
    stepKey === 'story-script' || stepKey === 'scene-character' || isSeriesEpisodeListPath(path)
  )
}

export function shouldLoadStoryboardListForRoute(path: string): boolean {
  const stepKey = routePathToCreationStep(path)
  return (
    stepKey === 'storyboard-script' ||
    stepKey === 'storyboard-video' ||
    stepKey === 'dubbing' ||
    stepKey === 'preview'
  )
}
