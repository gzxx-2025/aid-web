/**
 * 跨步骤跳转后自动打开对应编辑弹窗的待处理意图。
 * 独立小模块：删除本文件并去掉各步骤的 request/consume 接线即可整段卸载该能力。
 */
import { shallowRef, type ShallowRef } from 'vue'

export type CreateFlowStepModalKind =
  | 'storyboard-image'
  | 'storyboard-video'
  | 'storyboard-dubbing'

export type CreateFlowStepModalIntent = {
  kind: CreateFlowStepModalKind
  panelIndex: number
  token: number
}

/** 供步骤页 watch；业务侧优先用 request / consume / peek。 */
export const createFlowStepModalIntent: ShallowRef<CreateFlowStepModalIntent | null> =
  shallowRef(null)

let tokenSeq = 0

export function requestCreateFlowStepModal(
  kind: CreateFlowStepModalKind,
  panelIndex: number
): CreateFlowStepModalIntent {
  tokenSeq += 1
  const next: CreateFlowStepModalIntent = {
    kind,
    panelIndex,
    token: tokenSeq
  }
  createFlowStepModalIntent.value = next
  return next
}

export function peekCreateFlowStepModalIntent(): CreateFlowStepModalIntent | null {
  return createFlowStepModalIntent.value
}

/** 仅当 kind 匹配时消费并清空；返回 panelIndex，否则返回 null（不消费）。 */
export function consumeCreateFlowStepModalIntent(
  kind: CreateFlowStepModalKind
): number | null {
  const pending = createFlowStepModalIntent.value
  if (!pending || pending.kind !== kind) return null
  createFlowStepModalIntent.value = null
  return pending.panelIndex
}

export function clearCreateFlowStepModalIntent(): void {
  createFlowStepModalIntent.value = null
}

/** 单测重置；业务代码勿调用。 */
export function resetCreateFlowStepModalIntentForTest(): void {
  createFlowStepModalIntent.value = null
  tokenSeq = 0
}
