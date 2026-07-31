/**
 * 弹窗顶部 Tab SSE 互斥纯规则。
 * 组件负责真正 suspend/restore；本模块只回答「该断谁 / 能否建连 / restore 走哪条路」。
 */

export type ModalTabFollowRef = {
  tabKey: string
  taskId: number
}

export type ModalTabTerminalKind = 'terminal' | 'ongoing' | 'unknown'

export type ModalTabRestoreAction = 'settle' | 'reconnect' | 'retry-detail'

function normTabKey(key: unknown): string {
  return String(key ?? '').trim()
}

function normTaskId(taskId: unknown): number | null {
  const n = Number(taskId)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

/** 当前可见 Tab 之外、仍占浏览器 SSE 的 taskId（应 suspend） */
export function listModalTabFollowsToSuspend(input: {
  currentTabKey: string
  activeFollows: ModalTabFollowRef[]
}): number[] {
  const current = normTabKey(input.currentTabKey)
  const out: number[] = []
  const seen = new Set<number>()
  for (const f of input.activeFollows || []) {
    const tid = normTaskId(f?.taskId)
    if (tid == null || seen.has(tid)) continue
    const key = normTabKey(f?.tabKey)
    if (current && key === current) continue
    seen.add(tid)
    out.push(tid)
  }
  return out
}

/** 仅当 target 就是当前可见 Tab 时允许建连 */
export function shouldAllowModalTabSseConnect(input: {
  currentTabKey: string
  targetTabKey: string
}): boolean {
  const current = normTabKey(input.currentTabKey)
  const target = normTabKey(input.targetTabKey)
  if (!current || !target) return false
  return current === target
}

/**
 * 切回 Tab / 打开弹窗 restore 时的动作：
 * - terminal：结算清 loading，禁止建空 SSE
 * - ongoing：重连
 * - unknown：有限次再查 detail，禁止长期假 loading
 */
export function decideModalTabRestoreAction(input: {
  terminalKind: ModalTabTerminalKind
}): ModalTabRestoreAction {
  if (input.terminalKind === 'terminal') return 'settle'
  if (input.terminalKind === 'ongoing') return 'reconnect'
  return 'retry-detail'
}
