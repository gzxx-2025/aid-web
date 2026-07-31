import { defineStore } from 'pinia'
import type { User } from '~/types'
import type { UserBalanceFromApi } from '~/types/business-api'
import { userBalance, userProfile } from '~/utils/businessApi'
import { mapUserInfoFromApiToUser } from '~/utils/userProfile'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    token: '',
    profileLoading: false
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
      this.profileLoading = false
      clearAuthLoginChannel()
      if (import.meta.client) {
        localStorage.removeItem('token')
        localStorage.removeItem('user-info')
      }
    },

    /** 拉取最新个人信息（余额等实时字段以接口为准） */
    async fetchProfile() {
      if (!this.token) return null
      this.profileLoading = true
      try {
        const info = await userProfile()
        const mapped = mapUserInfoFromApiToUser(info, {
          fallbackEmail: this.user?.email,
          role: this.user?.role
        })
        this.setUser(mapped)
        return mapped
      } catch {
        return null
      } finally {
        this.profileLoading = false
      }
    },

    /**
     * 快捷刷新账户积分（POST /api/user/balance）。
     * 仅 patch 余额相关字段，避免任务终态后整页拉 profile。
     */
    async fetchBalance(): Promise<UserBalanceFromApi | null> {
      if (!this.token) return null
      try {
        const data = await userBalance()
        if (this.user) {
          this.setUser({
            ...this.user,
            balance: data.balance,
            frozenBalance: data.frozenBalance,
            totalRecharge: data.totalRecharge,
            totalConsumption: data.totalConsumption
          })
        }
        return data
      } catch {
        return null
      }
    }
  }
})
