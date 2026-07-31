/**
 * Nuxt 刷新时 Pinia persist 的 afterRestore 可能晚于步骤页 setup。
 * app:mounted 再兜底一次 finalizeClientHydration，避免 isHydrated 长期为 false。
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const store = useCreationStore()
    if (!store.isHydrated) {
      store.finalizeClientHydration()
    }
  })
})
