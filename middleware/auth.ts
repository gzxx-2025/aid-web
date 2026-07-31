import { useUserStore } from '~/stores/user'

export default defineNuxtRouteMiddleware((to: any) => {
  const userStore = useUserStore()

  if (!userStore.isLoggedIn) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
