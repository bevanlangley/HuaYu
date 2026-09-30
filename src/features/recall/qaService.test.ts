import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSeedsWithExchangeCounts } from './qaService'

vi.mock('@/features/seeds/seedsService', () => ({
  fetchSeeds: vi.fn(),
}))
vi.mock('@/features/phrases/phrasesService', () => ({
  fetchAllPhrasesUnpaginated: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'

const mockSeeds = [
  { id: 's1', name: 'Seed with an exchange', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 3 },
  { id: 's2', name: 'Seed with only unpaired phrases', tag: null, source_url: null, created_at: '2024-01-02', phraseCount: 2 },
  { id: 's3', name: 'Empty seed', tag: null, source_url: null, created_at: '2024-01-03', phraseCount: 0 },
]

const mockPhrases = [
  { id: 'q1', seed_id: 's1', mandarin: 'q1', pinyin: 'q1', english: 'q1', phrase_type: 'question' as const, question_id: null, created_at: '2024-01-01' },
  { id: 'a1', seed_id: 's1', mandarin: 'a1', pinyin: 'a1', english: 'a1', phrase_type: 'answer' as const, question_id: 'q1', created_at: '2024-01-02' },
  { id: 'q1b', seed_id: 's1', mandarin: 'q1b', pinyin: 'q1b', english: 'q1b', phrase_type: 'question' as const, question_id: null, created_at: '2024-01-02b' },
  { id: 'a1b', seed_id: 's1', mandarin: 'a1b', pinyin: 'a1b', english: 'a1b', phrase_type: 'answer' as const, question_id: 'q1b', created_at: '2024-01-02c' },
  { id: 'a1c', seed_id: 's1', mandarin: 'a1c', pinyin: 'a1c', english: 'a1c', phrase_type: 'answer' as const, question_id: 'q1b', created_at: '2024-01-02d' },
  { id: 'q2', seed_id: 's2', mandarin: 'q2', pinyin: 'q2', english: 'q2', phrase_type: 'question' as const, question_id: null, created_at: '2024-01-03' }, // unpaired
  { id: 's1p', seed_id: 's2', mandarin: 's1p', pinyin: 's1p', english: 's1p', phrase_type: 'statement' as const, question_id: null, created_at: '2024-01-04' },
]

describe('fetchSeedsWithExchangeCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSeeds).mockResolvedValue(mockSeeds)
    vi.mocked(fetchAllPhrasesUnpaginated).mockResolvedValue(mockPhrases)
  })

  it('counts only questions with at least one linked answer, per seed', async () => {
    const result = await fetchSeedsWithExchangeCounts()
    expect(result).toEqual([
      { ...mockSeeds[0], exchangeCount: 2 },
      { ...mockSeeds[1], exchangeCount: 0 },
      { ...mockSeeds[2], exchangeCount: 0 },
    ])
  })

  it('counts a multi-answer question once, not once per answer', async () => {
    const result = await fetchSeedsWithExchangeCounts()
    const seed1 = result.find((s) => s.id === 's1')
    // q1 (1 answer) + q1b (2 answers) = 2 exchanges, not 3
    expect(seed1?.exchangeCount).toBe(2)
  })
})
