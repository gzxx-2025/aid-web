import { useUserStore } from '~/stores/user'

const AUTH_REQUIRED_PREFIXES = ['/works', '/assets', '/create']

function isAuthRequiredPath(path: string): boolean {
  return AUTH_REQUIRED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export default defineNuxtRouteMiddleware((to) => {
  if (!isAuthRequiredPath(to.path)) return
  // 刷新首屏时服务端拿不到 localStorage，避免 SSR 误判导致强制跳登录
  if (import.meta.server) return

  const userStore = useUserStore()
  if (!userStore.token) {
    userStore.hydrateFromStorage()
  }
  const storeToken = userStore.token
  const localToken = import.meta.client ? localStorage.getItem('token') || '' : ''
  const token = storeToken || localToken

  if (!token) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
