import { describe, expect, it } from 'vitest'
import {
  discoverOngoingStoryboardGenerationTasks,
  discoverOngoingStoryboardModalImageTasks,
  parseStoryboardGenerationSnapshot,
  resolveStoryboardGenerationTaskOwner
} from '~/utils/storyboardGenerationTaskDiscovery'
import type { UserTaskDetailData, UserTaskRow } from '~/types/business-api'

function row(id: number, taskType: string): UserTaskRow {
  return { id, taskType, status: 'PROCESSING' }
}

function detail(
  taskId: number,
  taskType: string,
  inputSnapshot: Record<string, unknown>
): UserTaskDetailData {
  return {
    taskId,
    taskType,
    status: 'PROCESSING',
    inputSnapshot: JSON.stringify(inputSnapshot)
  }
}

describe('storyboard generation task discovery', () => {
  it('recovers one video batch and every concurrent modal task independently', async () => {
    const rows = [
      row(104, 'storyboard_video_generate'),
      row(103, 'storyboard_video_generate'),
      row(102, 'storyboard_video_generate'),
      row(101, 'storyboard_video_generate')
    ]
    const details = new Map([
      [
        104,
        detail(104, 'storyboard_video_generate', {
          storyboardIds: [11],
          direction: 'grid',
          overwriteExistingFinal: false
        })
      ],
      [
        103,
        detail(103, 'storyboard_video_generate', {
          storyboardIds: [10],
          direction: 'edge',
          overwriteExistingFinal: false
        })
      ],
      [
        102,
        detail(102, 'storyboard_video_generate', {
          storyboardIds: [9],
          direction: 'multi',
          overwriteExistingFinal: false
        })
      ],
      [
        101,
        detail(101, 'storyboard_video_generate', {
          storyboardIds: [7, 8],
          direction: 'image',
          overwriteExistingFinal: true
        })
      ]
    ])

    const discovered = await discoverOngoingStoryboardGenerationTasks({
      rows,
      media: 'video',
      loadDetail: async (taskId) => details.get(taskId) ?? null
    })

    expect(discovered.filter((task) => task.owner === 'batch')).toMatchObject([
      { taskId: 101, storyboardIds: [7, 8], videoTaskKind: 'i2v' }
    ])
    expect(discovered.filter((task) => task.owner === 'modal')).toMatchObject([
      { taskId: 104, storyboardIds: [11], videoTaskKind: 'grid' },
      { taskId: 103, storyboardIds: [10], videoTaskKind: 'edge' },
      { taskId: 102, storyboardIds: [9], videoTaskKind: 'multi' }
    ])
  })

  it('keeps a singleton overwrite task owned by the batch flow', async () => {
    const discovered = await discoverOngoingStoryboardGenerationTasks({
      rows: [row(201, 'storyboard_image_generate')],
      media: 'image',
      loadDetail: async () =>
        detail(201, 'storyboard_image_generate', {
          storyboardIds: [31],
          overwriteExistingFinal: true
        })
    })

    expect(discovered).toMatchObject([
      { taskId: 201, owner: 'batch', storyboardIds: [31], media: 'image' }
    ])
  })

  it('uses persisted ownership for legacy snapshots without the overwrite flag', () => {
    const snapshot = parseStoryboardGenerationSnapshot(
      JSON.stringify({ storyboardIds: [41], direction: 'image' })
    )
    expect(snapshot).not.toBeNull()
    expect(
      resolveStoryboardGenerationTaskOwner({
        taskId: 301,
        snapshot: snapshot!,
        knownModalTaskIds: new Set([301])
      })
    ).toBe('modal')
    expect(
      resolveStoryboardGenerationTaskOwner({ taskId: 302, snapshot: snapshot! })
    ).toBe('batch')
  })

  it('ignores terminal details even when the cached list still says processing', async () => {
    const terminal = detail(401, 'storyboard_video_generate', {
      storyboardIds: [51],
      overwriteExistingFinal: false
    })
    terminal.status = 'SUCCEEDED'
    const discovered = await discoverOngoingStoryboardGenerationTasks({
      rows: [row(401, 'storyboard_video_generate')],
      media: 'video',
      loadDetail: async () => terminal
    })
    expect(discovered).toEqual([])
  })

  it('recovers every modal-only storyboard image operation from its task snapshot', async () => {
    const taskTypes = new Map([
      [501, 'storyboard_edit_image'],
      [502, 'storyboard_image_upscale'],
      [503, 'storyboard_multi_view_image'],
      [504, 'storyboard_multi_grid_image']
    ])
    const rows = [...taskTypes].map(([id, taskType]) => row(id, taskType))
    const discovered = await discoverOngoingStoryboardModalImageTasks({
      rows,
      loadDetail: async (taskId) =>
        detail(taskId, taskTypes.get(taskId)!, {
          storyboardId: taskId + 1000,
          genRecordId: taskId === 502 ? 88 : undefined,
          imageUrl: taskId >= 503 ? `https://cdn.test/${taskId}.png` : undefined,
          referenceImages: taskId === 501 ? ['https://cdn.test/dialogue.png'] : undefined
        })
    })

    expect(discovered).toMatchObject([
      { taskId: 504, storyboardId: 1504, kind: 'ninegrid' },
      { taskId: 503, storyboardId: 1503, kind: 'multiangle' },
      { taskId: 502, storyboardId: 1502, kind: 'upscale', sourceRecordId: 88 },
      {
        taskId: 501,
        storyboardId: 1501,
        kind: 'dialogue',
        referenceImageUrl: 'https://cdn.test/dialogue.png'
      }
    ])
  })
})
