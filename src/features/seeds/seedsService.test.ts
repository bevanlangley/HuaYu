import { describe, it, expect } from 'vitest'
import { getUniqueTags, toSeedWithCount } from './seedsService'
import type { Seed } from '@/lib/database.types'

function makeSeed(overrides: Partial<Seed> = {}): Seed {
  return {
    id: 'test-id',
    name: 'Test Seed',
    source_url: null,
    tag: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('toSeedWithCount', () => {
  it('maps the embedded count aggregate to phraseCount', () => {
    const seed = makeSeed()
    const row = { ...seed, phrases: [{ count: 7 }] }
    expect(toSeedWithCount(row)).toEqual({ ...seed, phraseCount: 7 })
  })

  it('defaults phraseCount to 0 when the aggregate is empty', () => {
    const seed = makeSeed()
    const row = { ...seed, phrases: [] }
    expect(toSeedWithCount(row)).toEqual({ ...seed, phraseCount: 0 })
  })

  it('strips the embedded phrases key from the result', () => {
    const row = { ...makeSeed(), phrases: [{ count: 3 }] }
    expect(toSeedWithCount(row)).not.toHaveProperty('phrases')
  })
})

describe('getUniqueTags', () => {
  it('returns empty array when no seeds have tags', () => {
    const seeds = [makeSeed({ tag: null }), makeSeed({ tag: null })]
    expect(getUniqueTags(seeds)).toEqual([])
  })

  it('returns unique tags sorted alphabetically', () => {
    const seeds = [
      makeSeed({ tag: 'youtube' }),
      makeSeed({ tag: 'hsk' }),
      makeSeed({ tag: 'youtube' }),
      makeSeed({ tag: 'podcast' }),
    ]
    expect(getUniqueTags(seeds)).toEqual(['hsk', 'podcast', 'youtube'])
  })

  it('filters out null tags', () => {
    const seeds = [
      makeSeed({ tag: 'hsk' }),
      makeSeed({ tag: null }),
    ]
    expect(getUniqueTags(seeds)).toEqual(['hsk'])
  })
})
