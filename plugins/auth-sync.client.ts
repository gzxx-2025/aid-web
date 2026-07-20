/**
 * Pinia 持久化恢复后，同步 token 到 localStorage，供 `utils/api.ts` 请求拦截器读取。
 */
export default defineNuxtPlugin(() => {
  const userStore = useUserStore()
  // 页面刷新后，从本地恢复登录态与用户信息
  userStore.hydrateFromStorage()
  if (userStore.token) {
    localStorage.setItem('token', userStore.token)
  }
})
