import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useQa } from './useQa'

vi.mock('./qaService', () => ({
  fetchSeedsWithExchangeCounts: vi.fn(),
}))
vi.mock('@/features/phrases/phrasesService', () => ({
  fetchExchangesBySeed: vi.fn(),
  fetchAllExchanges: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/utils', () => ({
  shuffleArray: vi.fn((arr: unknown[]) => [...arr].reverse()),
}))

import { fetchSeedsWithExchangeCounts } from './qaService'
import { fetchExchangesBySeed, fetchAllExchanges } from '@/features/phrases/phrasesService'
import { shuffleArray } from '@/lib/utils'

const mockSeeds = [
  { id: 's1', name: 'Seed 1', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 3, exchangeCount: 2 },
]

function makePhrase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    seed_id: 's1',
    mandarin: '你好',
    pinyin: 'nǐ hǎo',
    english: 'Hello',
    phrase_type: 'question' as const,
    question_id: null,
    created_at: '2024-01-01',
    ...overrides,
  }
}

const mockExchanges = [
  {
    question: makePhrase({ id: 'q1' }),
    answers: [makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1' })],
  },
  {
    question: makePhrase({ id: 'q2', created_at: '2024-01-02' }),
    answers: [makePhrase({ id: 'a2', phrase_type: 'answer', question_id: 'q2' })],
  },
]

describe('useQa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSeedsWithExchangeCounts).mockResolvedValue(mockSeeds)
    vi.mocked(fetchExchangesBySeed).mockResolvedValue(mockExchanges)
    vi.mocked(fetchAllExchanges).mockResolvedValue(mockExchanges)
    vi.mocked(shuffleArray).mockImplementation((arr: unknown[]) => [...arr].reverse())
  })

  it('loads seeds on mount', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    expect(result.current.seeds).toEqual(mockSeeds)
  })

  it('startSession activates session and loads exchanges', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', random: false })
    })

    expect(fetchExchangesBySeed).toHaveBeenCalledWith('s1')
    expect(result.current.sessionActive).toBe(true)
    expect(result.current.exchanges).toEqual(mockExchanges)
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentExchange).toEqual(mockExchanges[0])
    expect(result.current.isRevealed).toBe(false)
  })

  it('reveal sets isRevealed and justRevealed', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })

    act(() => result.current.reveal())

    expect(result.current.isRevealed).toBe(true)
    expect(result.current.justRevealed).toBe(true)
  })

  it('next advances index and clears justRevealed', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.reveal())
    act(() => result.current.next())

    expect(result.current.currentIndex).toBe(1)
    expect(result.current.currentExchange).toEqual(mockExchanges[1])
    expect(result.current.justRevealed).toBe(false)
    expect(result.current.isRevealed).toBe(false)
  })

  it('navigating back to a revealed exchange shows it as revealed', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.reveal())   // reveal exchange 0
    act(() => result.current.next())     // go to exchange 1
    act(() => result.current.previous()) // back to exchange 0

    expect(result.current.currentIndex).toBe(0)
    expect(result.current.isRevealed).toBe(true)
    expect(result.current.justRevealed).toBe(false)
  })

  it('previous does not go below 0', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.previous())

    expect(result.current.currentIndex).toBe(0)
  })

  it('next does not go past the last exchange', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.next())
    act(() => result.current.next())

    expect(result.current.currentIndex).toBe(1) // clamped at last index
  })

  it('stopSession resets everything', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.reveal())
    act(() => result.current.stopSession())

    expect(result.current.sessionActive).toBe(false)
    expect(result.current.exchanges).toEqual([])
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentExchange).toBeNull()
  })

  it('exposes the linked-answer count on the current exchange for the UI to decide autoplay', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })

    expect(result.current.currentExchange?.answers).toHaveLength(1)
  })

  it('startSession with seedId null pools exchanges across all seeds instead of fetching by seed', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: null, random: false })
    })

    expect(fetchAllExchanges).toHaveBeenCalled()
    expect(fetchExchangesBySeed).not.toHaveBeenCalled()
    expect(result.current.exchanges).toEqual(mockExchanges)
  })

  it('startSession with random true shuffles the Exchange order via shuffleArray', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', random: true })
    })

    expect(shuffleArray).toHaveBeenCalledWith(mockExchanges)
    // the mocked shuffleArray reverses order; answers within each exchange stay untouched
    expect(result.current.exchanges).toEqual([...mockExchanges].reverse())
    expect(result.current.exchanges[0].answers).toEqual(mockExchanges[1].answers)
  })

  it('startSession with random false does not shuffle', async () => {
    const { result } = renderHook(() => useQa())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', random: false })
    })

    expect(shuffleArray).not.toHaveBeenCalled()
    expect(result.current.exchanges).toEqual(mockExchanges)
  })
})
