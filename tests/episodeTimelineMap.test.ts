import { describe, expect, it } from 'vitest'
import {
  mapServerTimelineToUi,
  mapTimelineToExportGroups,
  mapUiTimelineToServer
} from '../utils/episodeTimelineMap'
import type { TimelineData } from '../types/business-api'

describe('episode timeline subtitle mapping', () => {
  it('keeps untimed subtitles for videos with embedded audio and no standalone voice track', () => {
    const timeline = {
      version: 1,
      resolution: 'FHD',
      totalDurationSeconds: 15,
      segments: [
        {
          storyboardId: 4558,
          sortOrder: 1,
          video: {
            genRecordId: 830,
            url: 'https://cdn.example.com/storyboard.mp4',
            durationSeconds: 15,
            volume: 100,
            muted: false
          },
          voice: {
            audioRecordId: null,
            url: null,
            durationSeconds: 0,
            volume: 100,
            muted: false
          },
          subtitle: {
            text: '科普医师：血管变硬变脆，是脑梗心梗最根本的源头。',
            fontSize: 40,
            fontColor: '#FFFFFF',
            fontFamily: null,
            position: 'bottom',
            show: true
          }
        }
      ],
      bgm: {
        url: null,
        name: null,
        volume: 30,
        loop: true,
        fade: true
      }
    } as TimelineData

    const ui = mapServerTimelineToUi(timeline)

    expect(ui.voiceItems).toHaveLength(0)
    expect(ui.subtitleItems).toHaveLength(1)
    expect(ui.subtitleItems[0]).toMatchObject({
      text: '科普医师：血管变硬变脆，是脑梗心梗最根本的源头。',
      start: 0,
      duration: 15,
      videoClipId: 'sb-4558'
    })

    const saved = mapUiTimelineToServer(ui, { previous: timeline })
    expect(saved.segments[0]?.subtitle?.text).toBe(
      '科普医师：血管变硬变脆，是脑梗心梗最根本的源头。'
    )
    expect(mapTimelineToExportGroups(saved).groups[0]?.subtitle).toBe(
      '科普医师：血管变硬变脆，是脑梗心梗最根本的源头。'
    )
  })
})
