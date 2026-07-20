import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { Modal } from 'ant-design-vue'
import {
  applyEncryptedPayloadToAxiosConfig,
  maybeDecryptApiPayload,
  prepareEncryptedRequest,
  shouldEncryptApiPath,
  takeAxiosRequestAesKey
} from '~/utils/apiCrypto'

/** 开发环境请求前缀（与 nuxt.config 里 /url 代理一致，按需改） */
const API_BASE_DEVELOPMENT = '/url'

/**
 * 浏览器端与 axios `baseURL` 一致的 API 根路径（用于 EventSource 等无法走 axios 拦截器的请求）。
 * - 开发：`/url` + `/api/...` → Nitro 代理到后端
 * - 生产客户端：与 {@link resolveApiBaseURL} 一致（同源 + `aid` 前缀）
 */
export function resolveClientApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) {
    return `${API_BASE_DEVELOPMENT.replace(/\/$/, '')}${p}`
  }
  if (import.meta.client) {
    const base = `${window.location.protocol}//${window.location.host}${import.meta.env.BASE_URL || '/'}aid`
    return `${base.replace(/\/$/, '')}${p}`
  }
  return `${API_BASE_DEVELOPMENT.replace(/\/$/, '')}${p}`
}

/**
 * 生产环境请求前缀（同源代理仍用 /url；若直连 API 则改为 https://xxx）
 * SSR/预渲染阶段不能访问 window，统一回退到相对路径。
 */
function resolveApiBaseURL(): string {
  if (import.meta.env.DEV) return API_BASE_DEVELOPMENT
  if (import.meta.client) {
    return `${window.location.protocol}//${window.location.host}${import.meta.env.BASE_URL}aid`
  }
  return API_BASE_DEVELOPMENT
}

const resolvedApiBaseURL = resolveApiBaseURL()
function isLoginRequiredApi(url?: string): boolean {
  const u = String(url || '')
  if (!u) return false
  // 仅 /api/user/** 视为必须登录接口（兼容带 /url 前缀的请求地址）
  return /(^|\/)(api\/user\/)/.test(u)
}

export function redirectToLogin(): void {
  if (!import.meta.client) return
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('user-info')
  } catch {
    /* ignore */
  }
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const isInLoginPage = window.location.pathname.startsWith('/login')
  if (isInLoginPage) return
  const next = `/login?redirect=${encodeURIComponent(current)}`
  window.location.href = next
}

let loginExpiredModalOpen = false

function showLoginExpiredModal(): void {
  if (!import.meta.client) return
  if (loginExpiredModalOpen) return
  loginExpiredModalOpen = true
  Modal.confirm({
    title: '登录已过期',
    content: '当前登录状态已失效，请重新登录后继续操作。',
    okText: '确定',
    cancelText: '取消',
    centered: true,
    onOk: () => {
      redirectToLogin()
    },
    onCancel: () => {
      loginExpiredModalOpen = false
    },
    afterClose: () => {
      loginExpiredModalOpen = false
    }
  })
}

/**
 * 与 axios 请求拦截器一致：供 `fetch` / SSE 等无法走 axios 的场景携带鉴权与其它通用头。
 * - `Authorization: Bearer <token>`（localStorage `token`）
 * - `X-Requested-With: XMLHttpRequest`
 */
export function buildUserApiAuthHeaders(): Record<string, string> {
  if (!import.meta.client) {
    return { 'X-Requested-With': 'XMLHttpRequest' }
  }
  const token = localStorage.getItem('token') || ''
  const h: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest'
  }
  if (token) {
    h.Authorization = `Bearer ${token}`
  }
  return h
}

/** 供业务代码在 SSE / 非 axios 场景按需唤起充值弹窗 */
export function isInsufficientBalanceMessage(msg: string): boolean {
  return /余额不足|算力不足|额度不足|请先充值/.test(String(msg ?? ''))
}

export function openRechargeModalFromInsufficientBalance(message: string) {
  if (!isInsufficientBalanceMessage(message)) return
  emitRechargeEvent()
}

/**
 * v2.38.0+ 结构化错误协议：根据 SSE error 事件的 errorData 判断是否弹充值弹窗。
 * 优先使用 needRecharge + rechargeOwner 字段，兼容旧文案匹配。
 */
export function handleSseErrorRecharge(errorData?: { needRecharge?: boolean; rechargeOwner?: string; userMessage?: string; errorMessage?: string } | null, fallbackMessage?: string) {
  if (errorData?.needRecharge && errorData?.rechargeOwner === 'USER') {
    emitRechargeEvent()
    return
  }
  // 兼容旧协议：按文案匹配
  const msg = errorData?.userMessage || errorData?.errorMessage || fallbackMessage || ''
  if (isInsufficientBalanceMessage(msg)) {
    emitRechargeEvent()
  }
}

function shouldOpenRecharge(data: any): boolean {
  return isInsufficientBalanceMessage(String(data?.msg ?? data?.message ?? ''))
}

function emitRechargeEvent() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('open-recharge-modal'))
}

const api: AxiosInstance = axios.create({
  baseURL: resolvedApiBaseURL,
  timeout: 60000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  async (config) => {
    // 添加认证信息
    const token = import.meta.client ? localStorage.getItem('token') : ''
    const loginRequired = isLoginRequiredApi(config.url)
    if (!token && loginRequired) {
      redirectToLogin()
      return Promise.reject(new axios.CanceledError('AUTH_REDIRECT'))
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // multipart 需由浏览器自动带 boundary，不能沿用默认 application/json
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      const h = config.headers as Record<string, unknown>
      delete h['Content-Type']
    }

    // 处理请求参数
    if (config.method === 'get' && config.params) {
      // 可以在这里对 GET 请求参数进行处理
    }

    // 添加其他通用请求头
    config.headers['X-Requested-With'] = 'XMLHttpRequest'

    // 信封加密（由 /auth/public-config 的 crypto.enabled 控制）
    if (
      import.meta.client &&
      shouldEncryptApiPath(config.url) &&
      !(typeof FormData !== 'undefined' && config.data instanceof FormData)
    ) {
      const method = (config.method || 'get').toLowerCase()
      const isGet = method === 'get' || method === 'head'
      const enc = await prepareEncryptedRequest({
        body: isGet ? undefined : config.data ?? {},
        skipBody: isGet
      })
      applyEncryptedPayloadToAxiosConfig(config, enc, { skipBody: isGet })
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  async (response: AxiosResponse) => {
    const aesKey = takeAxiosRequestAesKey(response.config as InternalAxiosRequestConfig)
    const data = await maybeDecryptApiPayload<Record<string, unknown>>(response.data, aesKey)
    response.data = data

    // 可以根据后端返回的状态码进行统一处理
    if (data && typeof data === 'object' && data.code !== undefined) {
      // 后端部分接口成功为 200，部分为 0（如充值订单列表）
      const ok = data.code === 200 || data.code === 0
      if (!ok) {
        if (shouldOpenRecharge(data)) {
          emitRechargeEvent()
        }
        // 处理业务错误（与后端文档字段 msg 一致）
        console.error('API 错误:', (data as { msg?: string }).msg ?? (data as { message?: string }).message)
        return Promise.reject(data)
      }
    }

    // 与历史行为一致：拦截器向上返回业务 JSON，而非 AxiosResponse 包装
    return data as unknown as AxiosResponse
  },
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }
    // 统一处理错误
    if (error.response) {
      // 服务器返回错误
      const { status, data } = error.response

      switch (status) {
        case 401:
          // 未授权，跳转到登录页
          console.error('未授权，请重新登录')
          showLoginExpiredModal()
          break
        case 403:
          console.error('拒绝访问')
          break
        case 404:
          console.error('请求地址不存在')
          break
        case 500:
          console.error('服务器内部错误')
          break
        default:
          if (shouldOpenRecharge(data)) {
            emitRechargeEvent()
          }
          console.error('请求失败:', data?.msg ?? data?.message ?? '未知错误')
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('网络错误，请检查网络连接')
    } else {
      // 请求配置出错
      console.error('请求配置错误:', error.message)
    }

    return Promise.reject(error)
  }
)

// 封装 HTTP 请求方法
export const request = {
  // GET 请求
  get<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> {
    return api.get(url, {
      params,
      ...config
    })
  },

  // POST 请求
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return api.post(url, data, config)
  },

  // PUT 请求
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return api.put(url, data, config)
  },

  // DELETE 请求
  delete<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> {
    return api.delete(url, {
      params,
      ...config
    })
  },

  // PATCH 请求
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return api.patch(url, data, config)
  }
}

export default api
