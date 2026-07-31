const STORAGE_KEY = 'home:invite-promo-dismissed:v1'

function storageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}

/** 本次登录是否已关闭邀请有礼推广卡片 */
export function isInvitePromoDismissed(userId: string): boolean {
  if (!userId) return false
  const ss = getSessionStorage()
  if (!ss) return false
  try {
    return ss.getItem(storageKey(userId)) === '1'
  } catch {
    return false
  }
}

/** 标记本次登录已关闭（点 × 或「立即邀请」） */
export function dismissInvitePromo(userId: string): void {
  if (!userId) return
  const ss = getSessionStorage()
  if (!ss) return
  try {
    ss.setItem(storageKey(userId), '1')
  } catch {
    /* ignore quota / private mode */
  }
}

/** 退出登录时清除关闭标记，下次登录可再弹 */
export function clearInvitePromoDismiss(userId?: string | null): void {
  const ss = getSessionStorage()
  if (!ss) return
  try {
    if (userId) {
      ss.removeItem(storageKey(userId))
      return
    }
    const prefix = `${STORAGE_KEY}:`
    for (let i = ss.length - 1; i >= 0; i -= 1) {
      const key = ss.key(i)
      if (key?.startsWith(prefix)) ss.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}
