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
import { useCreationStore } from '~/stores/creation'
import { creationStepStatus } from '~/utils/businessApi'

definePageMeta({
  layout: false
})

const route = useRoute()
const creationStore = useCreationStore()
const routeProjectIdRaw = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
const routeProjectId = Number.isFinite(routeProjectIdRaw) && routeProjectIdRaw > 0 ? routeProjectIdRaw : null
const routeEpisodeIdRaw = route.query.episodeId
const routeEpisodeIdNumber = Number(routeEpisodeIdRaw)
const routeEpisodeId =
  routeEpisodeIdRaw !== undefined &&
  routeEpisodeIdRaw !== '' &&
  Number.isFinite(routeEpisodeIdNumber) &&
  routeEpisodeIdNumber >= 0
    ? routeEpisodeIdNumber
    : undefined

if (routeProjectId) {
  creationStore.setCurrentProjectContext({
    projectId: routeProjectId,
    ...(routeEpisodeId !== undefined ? { episodeId: routeEpisodeId } : {})
  })
  const stepInitAdvance =
    route.query.stepInitAdvance === '1' || String(route.query.stepInitAdvance ?? '') === 'true'
  // 首页弹窗新建电影后：服务端 currentStep 可能仍为 1，若按状态重定向会回到全局设定；此处直接落到故事剧本，由壳层 fetchCreationStepStatus 配合 stepInitAdvance 同步服务端
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
      const status = await creationStepStatus({
        projectId: routeProjectId,
        ...(routeEpisodeId !== undefined ? { episodeId: routeEpisodeId } : {})
      })
      const stepNumber = Number(status?.currentStep)
      const stepIndex = Number.isFinite(stepNumber)
        ? Math.min(Math.max(Math.floor(stepNumber) - 1, 0), CREATE_FLOW_STEP_ORDER.length - 1)
        : 0
      creationStore.setCurrentStepIndex(stepIndex)
      await navigateTo({
        path: creationStepToRoutePath(CREATE_FLOW_STEP_ORDER[stepIndex]!),
        query: { ...route.query },
        replace: true
      })
    } catch {
      // 接口失败时保守回到步骤二（故事剧本），避免沿用本地缓存导致串号
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
