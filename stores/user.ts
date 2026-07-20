import { defineStore } from 'pinia'
import type { User } from '~/types'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    token: ''
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    userName: (state) => state.user?.username || '未登录',
    userRole: (state) => state.user?.role || 'user'
  },

  actions: {
    hydrateFromStorage() {
      if (!import.meta.client) return
      const token = localStorage.getItem('token') || ''
      const rawUser = localStorage.getItem('user-info')
      let user: User | null = null
      if (rawUser) {
        try {
          user = JSON.parse(rawUser) as User
        } catch {
          user = null
        }
      }
      this.token = token
      this.user = user
    },

    setUser(user: User) {
      this.user = user
      if (import.meta.client) {
        localStorage.setItem('user-info', JSON.stringify(user))
      }
    },

    setToken(token: string) {
      this.token = token
      if (import.meta.client) {
        localStorage.setItem('token', token)
      }
    },

    login(user: User, token: string) {
      this.setUser(user)
      this.setToken(token)
    },

    logout() {
      this.user = null
      this.token = ''
      if (import.meta.client) {
        localStorage.removeItem('token')
        localStorage.removeItem('user-info')
      }
    }
  }
})
