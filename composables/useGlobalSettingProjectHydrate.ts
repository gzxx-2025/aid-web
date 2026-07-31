import { ref } from 'vue'
import { message } from 'ant-design-vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useCreationStore } from '~/stores/creation'
import { waitForCreationStoreHydrated } from '~/composables/useCreationStoreHydration'
import {
  clearStaleCreateFlowProjectContext,
  isProjectMissingApiError,
  shouldSkipFlowProjectScopedApis
} from '~/utils/createFlowProjectContext'
import {
  hydrateCreationStoreFromProjectDetail,
  resolveRouteProjectId
} from '~/utils/hydrateCreationStoreFromProjectDetail'

/**
 * 项目配置页 / 流程壳层：从 /api/user/project/detail 回显左侧基本信息与风格
 */
export function useGlobalSettingProjectHydrate() {
  const router = useRouter()
  const creationStore = useCreationStore()
  const hydrating = ref(false)
  let hydrateGen = 0

  async function hydrateFromProjectApi(
    route: RouteLocationNormalizedLoaded,
    options?: { force?: boolean }
  ): Promise<boolean> {
    if (shouldSkipFlowProjectScopedApis(route)) return false

    const projectId = resolveRouteProjectId(route.query as Record<string, unknown>)
    if (!projectId) return false

    const gen = ++hydrateGen
    hydrating.value = true
    try {
      await waitForCreationStoreHydrated(creationStore, route)
      if (gen !== hydrateGen) return false
      /** 快速切换作品时旧 detail 可能后返回：世代失效则在写 store 前丢弃 */
      const detail = await hydrateCreationStoreFromProjectDetail(creationStore, projectId, {
        ...options,
        shouldApply: () => gen === hydrateGen
      })
      return detail != null
    } catch (e: unknown) {
      if (isProjectMissingApiError(e)) {
        await clearStaleCreateFlowProjectContext({ router, route, store: creationStore })
        return false
      }
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '加载项目信息失败，请稍后重试')
      return false
    } finally {
      if (gen === hydrateGen) {
        hydrating.value = false
      }
    }
  }

  return {
    hydrating,
    hydrateFromProjectApi
  }
}
