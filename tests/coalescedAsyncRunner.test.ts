import { describe, expect, it, vi } from 'vitest'
import { createCoalescedAsyncRunner } from '../utils/coalescedAsyncRunner'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('coalesced async runner', () => {
  it('runs once at a time and merges requests received during a run', async () => {
    const runs = [deferred(), deferred()]
    let callCount = 0
    const runner = createCoalescedAsyncRunner(() => runs[callCount++]!.promise)

    const first = runner.request()
    await vi.waitFor(() => expect(callCount).toBe(1))

    expect(runner.request()).toBe(first)
    expect(runner.request()).toBe(first)
    runs[0]!.resolve()
    await vi.waitFor(() => expect(callCount).toBe(2))

    runs[1]!.resolve()
    await first
    expect(callCount).toBe(2)
    expect(runner.isRunning()).toBe(false)
  })

  it('does not start another run after disposal', async () => {
    const active = deferred()
    let callCount = 0
    const runner = createCoalescedAsyncRunner(async () => {
      callCount += 1
      await active.promise
    })

    const pending = runner.request()
    await vi.waitFor(() => expect(callCount).toBe(1))
    runner.request()
    runner.dispose()
    active.resolve()
    await pending
    expect(callCount).toBe(1)
  })
})
