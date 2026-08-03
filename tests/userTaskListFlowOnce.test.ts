import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserTaskRow } from '../types/business-api'
import {
  fetchFlowUserTaskListOnce,
  getCachedFlowUserTaskList,
  invalidateFlowUserTaskListCache
} from '../utils/userTaskListFlowOnce'

const { userTaskListRecentPage, invalidateUserTaskListCache } = vi.hoisted(() => ({
  userTaskListRecentPage: vi.fn(),
  invalidateUserTaskListCache: vi.fn()
}))

vi.mock('~/utils/businessApi', () => ({
  invalidateUserTaskListCache,
  userTaskListRecentPage
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('flow user task list request ownership', () => {
  beforeEach(() => {
    invalidateFlowUserTaskListCache()
    userTaskListRecentPage.mockReset()
    invalidateUserTaskListCache.mockReset()
  })

  it('lets a forced refresh supersede an older ordinary request', async () => {
    const ordinary = deferred<UserTaskRow[]>()
    const forced = deferred<UserTaskRow[]>()
    userTaskListRecentPage
      .mockReturnValueOnce(ordinary.promise)
      .mockReturnValueOnce(forced.promise)

    const ordinaryRequest = fetchFlowUserTaskListOnce(42)
    const forcedRequest = fetchFlowUserTaskListOnce(42, { force: true })
    const duplicateForcedRequest = fetchFlowUserTaskListOnce(42, { force: true })

    expect(userTaskListRecentPage).toHaveBeenCalledTimes(2)
    expect(duplicateForcedRequest).toBe(forcedRequest)

    ordinary.resolve([{ id: 1, status: 'PROCESSING' } as UserTaskRow])
    await ordinaryRequest
    expect(getCachedFlowUserTaskList(42)).toBeNull()

    forced.resolve([{ id: 1, status: 'SUCCESS' } as UserTaskRow])
    await forcedRequest
    expect(getCachedFlowUserTaskList(42)).toEqual([{ id: 1, status: 'SUCCESS' }])
  })
})
