/**
 * 创作流程步骤使用 page transition的 out-in 时，旧页离场后、新页异步 chunk 未到会有空白。
 * 在 page:transition:finish → page:finish 之间拉高共享占位，避免主区域像卡死。
 */
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const active = useState('create-flow-step-swap-placeholder', () => false)
  let failSafeTimer: ReturnType<typeof setTimeout> | null = null

  function isCreatePath(path: string) {
    return path === '/create' || path.startsWith('/create/')
  }

  function clearFailSafeTimer() {
    if (!failSafeTimer) return
    clearTimeout(failSafeTimer)
    failSafeTimer = null
  }

  function armFailSafeTimer() {
    clearFailSafeTimer()
    // 极端情况兜底：如果页面 chunk 加载失败或钩子未触发，最多 12s 自动释放遮罩，避免永远卡住
    failSafeTimer = setTimeout(() => {
      active.value = false
      failSafeTimer = null
    }, 2000)
  }

  nuxtApp.hook('page:transition:finish', () => {
    if (!isCreatePath(router.currentRoute.value.path)) return
    active.value = true
    armFailSafeTimer()
  })

  function clear() {
    clearFailSafeTimer()
    nextTick(() => {
      active.value = false
    })
  }

  // 只要开始在 /create 壳层内切步骤（路由变化），就立即显示遮罩（确保 out-in 的空档一定被覆盖）
  router.beforeEach((to, from) => {
    if (!isCreatePath(to.path) || !isCreatePath(from.path)) return true
    if (to.fullPath === from.fullPath) return true
    active.value = true
    armFailSafeTimer()
    return true
  })

  // 路由错误（chunk 加载失败等）要清理遮罩
  router.onError(() => {
    clearFailSafeTimer()
    active.value = false
  })

  nuxtApp.hook('page:finish', () => {
    if (isCreatePath(router.currentRoute.value.path)) clear()
    else active.value = false
  })

  nuxtApp.hook('page:loading:end', () => {
    if (isCreatePath(router.currentRoute.value.path)) clear()
  })
})
