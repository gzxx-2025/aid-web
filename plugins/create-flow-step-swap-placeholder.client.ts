/**
 * 创作流程步骤使用 page transition 的 out-in 时：
 * 1) 旧页离场后、新页异步 chunk 未到会有空白 → 拉高共享占位
 * 2) 过渡未结束又触发第二次导航会打坏 Transition vnode → 单飞队列串行化 path 导航
 *
 * 门闩在 app.vue 的 create-step-route onAfterEnter 释放（完整 out-in 结束后），
 * 本插件负责 beforeEach 排队与失败兜底。
 */
import {
  beginCreateFlowNavTransition,
  endCreateFlowNavTransition,
  flushCreateFlowNavGate,
  isCreateFlowNavPath
} from '~/utils/createFlowNavSerialize'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const active = useState('create-flow-step-swap-placeholder', () => false)
  let failSafeTimer: ReturnType<typeof setTimeout> | null = null

  function clearFailSafeTimer() {
    if (!failSafeTimer) return
    clearTimeout(failSafeTimer)
    failSafeTimer = null
  }

  function armFailSafeTimer() {
    clearFailSafeTimer()
    failSafeTimer = setTimeout(() => {
      active.value = false
      failSafeTimer = null
    }, 2000)
  }

  function clearPlaceholder() {
    clearFailSafeTimer()
    nextTick(() => {
      active.value = false
    })
  }

  router.beforeEach(async (to, from) => {
    const bothCreate = isCreateFlowNavPath(to.path) && isCreateFlowNavPath(from.path)
    if (!bothCreate || to.fullPath === from.fullPath) return true

    // 仅 path 变化会触发 out-in；query 同步不占门闩、不拉占位
    if (to.path === from.path) return true

    await beginCreateFlowNavTransition()
    active.value = true
    armFailSafeTimer()
    return true
  })

  router.afterEach((to, from) => {
    // 离开创作壳时 transition 对象会被卸掉，onAfterEnter 可能不触发 → 强制清空门闩
    if (isCreateFlowNavPath(from.path) && !isCreateFlowNavPath(to.path)) {
      flushCreateFlowNavGate()
      active.value = false
      clearFailSafeTimer()
    }
  })

  router.onError(() => {
    clearFailSafeTimer()
    active.value = false
    endCreateFlowNavTransition()
  })

  // 无 transition / 钩子丢失时的兜底：不在 page:finish 主动 end（太早），
  // 门闩自身有超时；此处只清占位。
  nuxtApp.hook('page:finish', () => {
    if (isCreateFlowNavPath(router.currentRoute.value.path)) clearPlaceholder()
    else active.value = false
  })

  nuxtApp.hook('page:loading:end', () => {
    if (isCreateFlowNavPath(router.currentRoute.value.path)) clearPlaceholder()
  })
})
