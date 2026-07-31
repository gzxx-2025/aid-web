<script setup lang="ts">
/**
 * 仅负责将 /create 重定向到具体步骤路由。
 * 原创作页大块逻辑在 layouts/create 使用的 CreateFlowShell，并已拆到 composables（见该组件文件头注释）。
 */
import {
  CREATE_FLOW_STEP_ORDER,
  creationStepToRoutePath,
  CREATE_SERIES_SCRIPT_UPLOAD_PATH
} from '~/utils/createFlowRoutes'
import { resolveFlowEpisodeIdFromRoute } from '~/utils/createFlowProjectContext'
import { useCreationStore } from '~/stores/creation'
import { fetchCreationStepStatusOnce } from '~/utils/creationStepStatusOnce'

definePageMeta({
  layout: false
})

const route = useRoute()
const creationStore = useCreationStore()
const routeProjectIdRaw = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
const routeProjectId = Number.isFinite(routeProjectIdRaw) && routeProjectIdRaw > 0 ? routeProjectIdRaw : null
const routeEpisodeId = resolveFlowEpisodeIdFromRoute(route, creationStore.currentProjectType)
const routeEpisodeIdForApi = routeEpisodeId === null ? undefined : routeEpisodeId

if (routeProjectId) {
  creationStore.setCurrentProjectContext({
    projectId: routeProjectId,
    ...(routeEpisodeId !== null ? { episodeId: routeEpisodeId } : {})
  })
  const stepInitAdvance =
    route.query.stepInitAdvance === '1' || String(route.query.stepInitAdvance ?? '') === 'true'
  // 首页弹窗新建电影后：服务端 currentStep 可能仍为 1，若按状态重定向会回到项目配置；此处直接落到剧本创作，由壳层 fetchCreationStepStatus 配合 stepInitAdvance 同步服务端
  if (stepInitAdvance) {
    const storyScriptIndex = CREATE_FLOW_STEP_ORDER.indexOf('story-script')
    const idx = storyScriptIndex >= 0 ? storyScriptIndex : 1
    creationStore.setCurrentStepIndex(idx)
    await navigateTo({
      path: creationStepToRoutePath(CREATE_FLOW_STEP_ORDER[idx]!),
      query: { ...route.query },
      replace: true
    })
  } else {
    try {
      const status = await fetchCreationStepStatusOnce({
        projectId: routeProjectId,
        ...(routeEpisodeIdForApi !== undefined ? { episodeId: routeEpisodeIdForApi } : {})
      })
      const stepNumber = Number(status?.currentStep)
      let stepIndex = Number.isFinite(stepNumber)
        ? Math.min(Math.max(Math.floor(stepNumber) - 1, 0), CREATE_FLOW_STEP_ORDER.length - 1)
        : 0
      // 剧集不进入「项目配置」步骤页
      if (
        creationStore.currentProjectType === 'series' &&
        CREATE_FLOW_STEP_ORDER[stepIndex] === 'global-setting'
      ) {
        stepIndex = CREATE_FLOW_STEP_ORDER.indexOf('story-script')
      }
      creationStore.setCurrentStepIndex(stepIndex)
      await navigateTo({
        path: creationStepToRoutePath(CREATE_FLOW_STEP_ORDER[stepIndex]!),
        query: { ...route.query },
        replace: true
      })
    } catch {
      // 接口失败时保守回到剧本创作，避免沿用本地缓存导致串号
      const fallbackIndex = 1
      creationStore.setCurrentStepIndex(fallbackIndex)
      await navigateTo({
        path: creationStepToRoutePath(CREATE_FLOW_STEP_ORDER[fallbackIndex]!),
        query: { ...route.query },
        replace: true
      })
    }
  }
} else if (
  creationStore.currentProjectType === 'series' &&
  !creationStore.seriesFlowEnteredStoryScript
) {
  await navigateTo({
    path: CREATE_SERIES_SCRIPT_UPLOAD_PATH,
    query: { ...route.query },
    replace: true
  })
} else {
  const idx = Math.min(Math.max(creationStore.currentStepIndex, 0), CREATE_FLOW_STEP_ORDER.length - 1)
  const path = creationStepToRoutePath(CREATE_FLOW_STEP_ORDER[idx]!)

  await navigateTo({
    path,
    query: { ...route.query },
    replace: true
  })
}
</script>

<template>
  <div class="create-route-redirect" aria-hidden="true" />
</template>

<style scoped>
.create-route-redirect {
  min-height: 40vh;
}
</style>
