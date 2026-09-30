import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSeedsWithExchangeCounts } from './qaService'

vi.mock('@/features/seeds/seedsService', () => ({
  fetchSeeds: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { fetchSeeds } from '@/features/seeds/seedsService'

const mockSeeds = [
  { id: 's1', name: 'Seed 1', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 3 },
  { id: 's2', name: 'Seed 2', tag: null, source_url: null, created_at: '2024-01-02', phraseCount: 0 },
]

describe('fetchSeedsWithExchangeCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSeeds).mockResolvedValue(mockSeeds)
  })

  it('attaches an exchangeCount of 0 to every seed', async () => {
    const result = await fetchSeedsWithExchangeCounts()
    expect(result).toEqual([
      { ...mockSeeds[0], exchangeCount: 0 },
      { ...mockSeeds[1], exchangeCount: 0 },
    ])
  })
})
