import { describe, expect, it } from 'vitest'
import type { MergedAssetVO } from '~/types/business-api'
import { mapMergedAssetsToStyleCards } from '~/utils/mapMergedStyleAssets'

function mergedStyle(overrides: Partial<MergedAssetVO>): MergedAssetVO {
  return {
    id: 1,
    assetType: 'style',
    assetName: '测试风格',
    promptText: 'test style prompt',
    imageUrl: 'https://example.com/style.png',
    sourceFlag: 'official',
    ...overrides
  }
}

describe('mapMergedAssetsToStyleCards', () => {
  it('preserves official source and asset id for stable project selection', () => {
    const [card] = mapMergedAssetsToStyleCards([
      mergedStyle({ id: 365, sourceFlag: 'OFFICIAL' })
    ])

    expect(card).toMatchObject({
      id: 'OFFICIAL-365',
      assetId: 365,
      sourceFlag: 'official'
    })
  })

  it('normalizes legacy user source to a canonical custom identity', () => {
    const [card] = mapMergedAssetsToStyleCards([
      mergedStyle({ id: 29, sourceFlag: 'USER' })
    ])

    expect(card).toMatchObject({
      id: 'CUSTOM-29',
      assetId: 29,
      sourceFlag: 'custom'
    })
  })

  it('keeps official and custom records with the same numeric id distinct', () => {
    const cards = mapMergedAssetsToStyleCards([
      mergedStyle({ id: 18, sourceFlag: 'official' }),
      mergedStyle({ id: 18, sourceFlag: 'custom' })
    ])

    expect(cards.map((card) => card.id)).toEqual(['OFFICIAL-18', 'CUSTOM-18'])
    expect(cards.map((card) => card.sourceFlag)).toEqual(['official', 'custom'])
  })
})
