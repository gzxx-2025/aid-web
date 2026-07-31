import { createPersistedState } from 'pinia-plugin-persistedstate'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.$pinia.use(
    createPersistedState({
      storage: {
        getItem: (key) => {
          if (import.meta.client) {
            return localStorage.getItem(key)
          }
          return null
        },
        setItem: (key, value) => {
          if (import.meta.client) {
            localStorage.setItem(key, value)
          }
        }
      },
      serializer: {
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => JSON.parse(value)
      }
    })
  )
})
