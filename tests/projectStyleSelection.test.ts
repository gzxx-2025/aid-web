import { describe, expect, it } from 'vitest'
import { isSameProjectStyleSelection } from '~/utils/projectStyleSelection'
import { resolveProjectStyleReference } from '~/utils/buildProjectVideoStyleFields'
import {
  dedupeStyleLibraryCards,
  resolveSelectedStyle,
  type StyleLibraryCard
} from '~/composables/usePromptDictionary'

const base = {
  name: '田园风格',
  thumbnail: '',
  assetName: '田园风格',
  promptText: 'pastoral 3D style'
}

describe('project style selection', () => {
  it('parses official and custom composite ids', () => {
    expect(resolveProjectStyleReference({ id: 'OFFICIAL-18' })).toEqual({
      styleSource: 'official',
      styleAssetId: 18
    })
    expect(resolveProjectStyleReference({ id: 'CUSTOM-18' })).toEqual({
      styleSource: 'custom',
      styleAssetId: 18
    })
    expect(resolveProjectStyleReference({ id: 'USER-18' })).toEqual({
      styleSource: 'custom',
      styleAssetId: 18
    })
  })

  it('does not treat same-name official and custom records as the same style', () => {
    expect(
      isSameProjectStyleSelection(
        { ...base, id: 'OFFICIAL-18' },
        { ...base, id: 'CUSTOM-18' }
      )
    ).toBe(false)
  })

  it('does not treat different stable ids as equal even when public text matches', () => {
    expect(
      isSameProjectStyleSelection(
        { ...base, id: 'OFFICIAL-18' },
        { ...base, id: 'OFFICIAL-19' }
      )
    ).toBe(false)
  })

  it('uses name and public prompt only for a legacy project selection', () => {
    expect(
      isSameProjectStyleSelection(
        { ...base, id: 'project-501-style' },
        { ...base, id: 'OFFICIAL-18' }
      )
    ).toBe(true)
    expect(
      isSameProjectStyleSelection(
        { ...base, id: 'project-501-style' },
        { ...base, id: 'OFFICIAL-18', promptText: 'another prompt' }
      )
    ).toBe(false)
  })

  it('keeps same-name official and custom cards as separate choices', () => {
    const cards: StyleLibraryCard[] = [
      { ...base, id: 'OFFICIAL-18', assetId: 18, sourceFlag: 'official', featured: true },
      { ...base, id: 'CUSTOM-18', assetId: 18, sourceFlag: 'custom', featured: false }
    ]

    expect(dedupeStyleLibraryCards(cards).map((item) => item.id)).toEqual([
      'OFFICIAL-18',
      'CUSTOM-18'
    ])
  })

  it('does not guess a source when a legacy project matches multiple cards', () => {
    const legacy = { ...base, id: 'project-501-style' }
    const cards: StyleLibraryCard[] = [
      { ...base, id: 'OFFICIAL-18', assetId: 18, sourceFlag: 'official', featured: true },
      { ...base, id: 'CUSTOM-18', assetId: 18, sourceFlag: 'custom', featured: false }
    ]

    expect(resolveSelectedStyle(legacy, cards)).toEqual(legacy)
  })

  it('maps a legacy USER id to the matching CUSTOM card', () => {
    const legacy = { ...base, id: 'USER-18' }
    const cards: StyleLibraryCard[] = [
      { ...base, id: 'OFFICIAL-18', assetId: 18, sourceFlag: 'official', featured: true },
      { ...base, id: 'CUSTOM-18', assetId: 18, sourceFlag: 'custom', featured: false }
    ]

    expect(resolveSelectedStyle(legacy, cards)?.id).toBe('CUSTOM-18')
  })

  it('keeps a stable selection while its target page has not loaded yet', () => {
    const current = {
      ...base,
      id: 'CUSTOM-18',
      assetId: 18,
      sourceFlag: 'custom' as const
    }
    const firstPage: StyleLibraryCard[] = [
      { ...base, id: 'OFFICIAL-18', assetId: 18, sourceFlag: 'official', featured: true }
    ]

    expect(resolveSelectedStyle(current, firstPage)).toEqual(current)
  })

  it('hydrates a project snapshot with the real thumbnail when its second page arrives', () => {
    const current = {
      ...base,
      id: 'project-258-style',
      name: '第二页风格',
      assetName: '第二页风格',
      promptText: 'second page prompt',
      thumbnail: ''
    }
    const firstPage: StyleLibraryCard[] = [
      { ...base, id: 'OFFICIAL-1', assetId: 1, sourceFlag: 'official', featured: true }
    ]
    const secondPageStyle: StyleLibraryCard = {
      ...base,
      id: 'OFFICIAL-73',
      name: '第二页风格',
      assetId: 73,
      sourceFlag: 'official',
      assetName: '第二页风格',
      promptText: 'second page prompt',
      thumbnail: 'https://example.com/second-page.png',
      featured: false
    }

    expect(resolveSelectedStyle(current, firstPage)).toEqual(current)
    expect(resolveSelectedStyle(current, [...firstPage, secondPageStyle])).toMatchObject({
      id: secondPageStyle.id,
      assetId: secondPageStyle.assetId,
      sourceFlag: secondPageStyle.sourceFlag,
      thumbnail: secondPageStyle.thumbnail
    })
  })
})
