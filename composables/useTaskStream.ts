import { ref } from 'vue'
import { buildUserApiAuthHeaders, redirectToLogin, resolveClientApiUrl } from '~/utils/api'

export interface TaskProgressEventData {
  stage?: string
  progress?: number
  message?: string
  stepId?: string
  stepTitle?: string
  stepIndex?: number
  stepTotal?: number
}

/** v2.38.0+ 结构化错误协议 */
export interface TaskErrorEventData {
  taskStatus?: string
  errorCode?: string
  errorType?: string
  errorSource?: string
  userMessage?: string
  rawMessage?: string
  needRecharge?: boolean
  rechargeOwner?: string
  retryable?: boolean
  billingStatus?: string
  refundStatus?: string
  /** 向后兼容旧字段 */
  errorMessage?: string
}

import type { TaskPartialFailedData } from '~/utils/taskPartialFailed'
import { parseTaskPartialFailedData } from '~/utils/taskPartialFailed'

export type TaskStreamResult =
  | { type: 'complete'; data: unknown }
  | { type: 'partial_failed'; data: TaskPartialFailedData | null }
  | { type: 'error'; errorMessage: string; errorData?: TaskErrorEventData }
  | { type: 'cancelled'; message: string }

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function normalizePercent(p: unknown): number | null {
  const n = Number(p)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, n))
}

/** 解析一个 SSE 事件块（以空行分隔），得到 event 名与合并后的 data 文本 */
function parseSseEventBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n')
  let eventName = ''
  const dataLines: string[] = []
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (!line) continue
    // SSE 注释帧（心跳等），跳过
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      // 规范：data: 后可跟一个可选空格
      dataLines.push(line.slice(5).replace(/^\s/, ''))
    }
  }
  const data = dataLines.join('\n')
  if (!eventName && !data) return null
  return { event: eventName || 'message', data }
}

function resolveErrorFromPayload(dataRaw: string): { errorMessage: string; errorData?: TaskErrorEventData } {
  const rawData = String(dataRaw || '').trim()
  if (!rawData) return { errorMessage: 'Task SSE error' }
  const parsed = safeParseJson(rawData)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>
    const errorData: TaskErrorEventData = {
      taskStatus: typeof o.taskStatus === 'string' ? o.taskStatus : undefined,
      errorCode: typeof o.errorCode === 'string' ? o.errorCode : undefined,
      errorType: typeof o.errorType === 'string' ? o.errorType : undefined,
      errorSource: typeof o.errorSource === 'string' ? o.errorSource : undefined,
      userMessage: typeof o.userMessage === 'string' ? o.userMessage : undefined,
      rawMessage: typeof o.rawMessage === 'string' ? o.rawMessage : undefined,
      needRecharge: typeof o.needRecharge === 'boolean' ? o.needRecharge : undefined,
      rechargeOwner: typeof o.rechargeOwner === 'string' ? o.rechargeOwner : undefined,
      retryable: typeof o.retryable === 'boolean' ? o.retryable : undefined,
      billingStatus: typeof o.billingStatus === 'string' ? o.billingStatus : undefined,
      refundStatus: typeof o.refundStatus === 'string' ? o.refundStatus : undefined,
      errorMessage: typeof o.errorMessage === 'string' ? o.errorMessage : undefined
    }
    // 优先使用 userMessage，兼容旧 errorMessage
    const msg = errorData.userMessage || errorData.errorMessage || (typeof o.message === 'string' ? o.message : '') || 'Task SSE error'
    return { errorMessage: msg, errorData }
  }
  if (typeof parsed === 'string' && parsed) return { errorMessage: parsed }
  return { errorMessage: 'Task SSE error' }
}

function resolveCancelledMessage(dataRaw: string): string {
  const rawData = String(dataRaw || '').trim()
  if (!rawData) return '任务已取消'
  const parsed = safeParseJson(rawData)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>
    if (typeof o.message === 'string' && o.message) return o.message
  }
  if (typeof parsed === 'string' && parsed) return parsed
  return '任务已取消'
}

/**
 * 连接任务 SSE（`text/event-stream`，与后端 `SseEmitter` 一致）。
 *
 * 原生 `EventSource` **无法**设置 `Authorization`，因此使用 `fetch` + `ReadableStream`
 * 解析事件流，请求头与 axios 一致（{@link buildUserApiAuthHeaders}）。
 *
 * 事件：`queued` | `progress` | `complete` | `partial_failed` | `error` | `cancelled` | `warning`
 * 未命名 `data` 时 event 视为 `message`，按 progress 兼容处理。
 */
export function useTaskStream(taskId: number) {
  const connected = ref(false)
  const closed = ref(false)
  const lastProgress = ref<TaskProgressEventData | null>(null)

  let abortController: AbortController | null = null
  let settled = false

  const close = () => {
    if (closed.value) return
    closed.value = true
    try {
      abortController?.abort()
    } catch {
      // ignore
    } finally {
      abortController = null
    }
  }

  const done = new Promise<TaskStreamResult>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Task SSE only available on client'))
      return
    }

    const settleOnce = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
      close()
    }

    const handleProgress = (raw: string) => {
      const parsed = safeParseJson(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>
        const stepIndex = obj.stepIndex != null ? Number(obj.stepIndex) : undefined
        const stepTotal = obj.stepTotal != null ? Number(obj.stepTotal) : undefined
        const progressFromServer = normalizePercent(obj.progress)
        const progressFromStep =
          stepIndex != null && stepTotal != null && Number.isFinite(stepIndex) && Number.isFinite(stepTotal) && stepTotal > 0
            ? normalizePercent((stepIndex / stepTotal) * 100)
            : null

        const msg = typeof obj.message === 'string' ? obj.message : undefined
        const title = typeof obj.stepTitle === 'string' ? obj.stepTitle : undefined
        lastProgress.value = {
          stage: typeof obj.stage === 'string' ? obj.stage : undefined,
          progress: progressFromServer ?? progressFromStep ?? undefined,
          message: msg,
          stepId: typeof obj.stepId === 'string' ? obj.stepId : undefined,
          stepTitle: title || msg,
          stepIndex: stepIndex != null && Number.isFinite(stepIndex) ? stepIndex : undefined,
          stepTotal: stepTotal != null && Number.isFinite(stepTotal) ? stepTotal : undefined
        }
      } else if (typeof parsed === 'string') {
        const text = String(parsed || '').trim()
        lastProgress.value = text ? { message: text, stepTitle: text } : { message: String(parsed) }
      }
    }

    const dispatchEvent = (eventName: string, dataRaw: string) => {
      const name = eventName || 'message'

      // queued / progress / message — 非终态，更新进度（queued 与 progress 字段一致）
      if (name === 'queued' || name === 'progress' || name === 'message') {
        if (dataRaw) handleProgress(dataRaw)
        return
      }

      // warning — 非终态，仅更新进度文案（不关闭连接）
      if (name === 'warning') {
        if (dataRaw) {
          const parsed = safeParseJson(dataRaw)
          const msg = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
            ? String((parsed as Record<string, unknown>).message || '')
            : String(parsed || '')
          if (msg) {
            lastProgress.value = { ...(lastProgress.value || {}), message: msg, stepTitle: msg }
          }
        }
        return
      }

      // complete — 终态：任务成功
      if (name === 'complete') {
        settleOnce(() => resolve({ type: 'complete', data: safeParseJson(dataRaw) }))
        return
      }

      // partial_failed — 终态：部分成功部分失败（可续生）
      if (name === 'partial_failed') {
        settleOnce(() =>
          resolve({
            type: 'partial_failed',
            data: parseTaskPartialFailedData(safeParseJson(dataRaw))
          })
        )
        return
      }

      // error — 终态：任务失败（v2.38.0+ 结构化错误）
      if (name === 'error') {
        const { errorMessage, errorData } = resolveErrorFromPayload(dataRaw)
        settleOnce(() => resolve({ type: 'error', errorMessage, errorData }))
        return
      }

      // cancelled — 终态：任务取消
      if (name === 'cancelled') {
        const msg = resolveCancelledMessage(dataRaw)
        settleOnce(() => resolve({ type: 'cancelled', message: msg }))
        return
      }
    }

    void (async () => {
      const auth = buildUserApiAuthHeaders()
      if (!auth.Authorization) {
        redirectToLogin()
        settleOnce(() => reject(new Error('AUTH_REDIRECT')))
        return
      }

      const url = resolveClientApiUrl(`/api/user/task/stream/${taskId}`)
      abortController = new AbortController()

      let res: Response
      try {
        res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...auth
          },
          signal: abortController.signal,
          cache: 'no-store'
        })
      } catch (e: unknown) {
        if (closed.value || (e instanceof DOMException && e.name === 'AbortError')) return
        settleOnce(() => reject(e instanceof Error ? e : new Error('Task SSE fetch failed')))
        return
      }

      if (res.status === 401) {
        redirectToLogin()
        settleOnce(() => reject(new Error('Unauthorized')))
        return
      }

      if (!res.ok) {
        settleOnce(() => reject(new Error(`SSE HTTP ${res.status}`)))
        return
      }

      connected.value = true

      const reader = res.body?.getReader()
      if (!reader) {
        settleOnce(() => reject(new Error('SSE: no response body')))
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (!settled) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) {
            buffer += decoder.decode(value, { stream: true })
          }
          buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

          // 按空行切分完整 SSE 事件块
          let sep: number
          while ((sep = buffer.indexOf('\n\n')) >= 0) {
            const rawBlock = buffer.slice(0, sep)
            buffer = buffer.slice(sep + 2)
            const parsed = parseSseEventBlock(rawBlock)
            if (parsed) dispatchEvent(parsed.event, parsed.data)
            if (settled) return
          }
        }

        if (!settled) {
          const tail = buffer.trim()
          if (tail) {
            const parsed = parseSseEventBlock(tail)
            if (parsed) dispatchEvent(parsed.event, parsed.data)
          }
        }

        // 主动 close（切作品/中断跟进）时 reader 可能以 done 结束而非抛 AbortError
        if (!settled && !closed.value) {
          settleOnce(() => reject(new Error('Task SSE ended unexpectedly')))
        }
      } catch (e: unknown) {
        if (closed.value || (e instanceof DOMException && e.name === 'AbortError')) return
        settleOnce(() => reject(e instanceof Error ? e : new Error('Task SSE read failed')))
      }
    })()
  })

  return {
    connected,
    closed,
    lastProgress,
    close,
    done
  }
}

/**
 * 与 task/detail 轮询并行 race 时使用：SSE 异常断连（如服务端 30 分钟超时）不 reject，
 * 避免 Promise.race 抢在轮询兜底前把 "Task SSE ended unexpectedly" 抛给用户。
 */
export function taskStreamDoneForRace(stream: ReturnType<typeof useTaskStream>): Promise<TaskStreamResult> {
  return stream.done.catch(() => new Promise<never>(() => {}))
}
