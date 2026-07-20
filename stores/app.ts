import { defineStore } from 'pinia'
import type { AppState } from '~/types'

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    theme: 'dark',
    sidebarCollapsed: false
  }),

  getters: {
    isDarkMode: (state) => state.theme === 'dark'
  },

  actions: {
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    }
  },

  persist: {
    key: 'app-store',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    pick: ['theme', 'sidebarCollapsed']
  }
})
