import type { UserModelListItem, UserModelListByFuncGroupVO } from '~/types/business-api'

export function uniqueTrimmedCodes(codes: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of codes) {
    const code = String(raw || '').trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push(code)
  }
  return out
}

export function modelsFromListByFuncGroups(
  groups: readonly UserModelListByFuncGroupVO[],
  funcCode: string
): UserModelListItem[] {
  const normalized = String(funcCode || '').trim()
  if (!normalized) return []
  const hit = groups.find((g) => String(g.funcCode || '').trim() === normalized)
  return Array.isArray(hit?.models) ? hit.models : []
}

/** 按优先级取第一个非空模型池 */
export function pickFirstNonEmptyModelPool(
  groups: readonly UserModelListByFuncGroupVO[],
  funcCodesInPriority: readonly string[]
): UserModelListItem[] {
  for (const code of funcCodesInPriority) {
    const list = modelsFromListByFuncGroups(groups, code)
    if (list.length > 0) return list
  }
  return []
}
