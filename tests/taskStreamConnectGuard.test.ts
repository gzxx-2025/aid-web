import { beforeEach, describe, expect, it } from 'vitest'
import {
  claimTaskStreamConnectSlot,
  resetTaskStreamConnectGuardForTests
} from '../utils/taskStreamConnectGuard'

describe('task stream connect guard', () => {
  beforeEach(() => resetTaskStreamConnectGuardForTests())

  it('rejects invalid task ids', () => {
    expect(claimTaskStreamConnectSlot(0)).toBe(false)
    expect(claimTaskStreamConnectSlot(Number.NaN)).toBe(false)
  })

  it('cuts off a connection storm but allows reconnect after the window', () => {
    for (let index = 0; index < 6; index += 1) {
      expect(claimTaskStreamConnectSlot(42, { now: 1000 })).toBe(true)
    }
    expect(claimTaskStreamConnectSlot(42, { now: 1000 })).toBe(false)
    expect(claimTaskStreamConnectSlot(42, { now: 4000 })).toBe(true)
  })

  it('isolates limits by task id', () => {
    for (let index = 0; index < 6; index += 1) {
      claimTaskStreamConnectSlot(42, { now: 1000 })
    }
    expect(claimTaskStreamConnectSlot(42, { now: 1000 })).toBe(false)
    expect(claimTaskStreamConnectSlot(43, { now: 1000 })).toBe(true)
  })
})
