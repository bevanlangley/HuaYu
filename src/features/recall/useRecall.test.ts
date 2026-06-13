import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRecall } from './useRecall'

vi.mock('@/features/seeds/seedsService', () => ({
  fetchSeeds: vi.fn(),
}))
vi.mock('@/features/phrases/phrasesService', () => ({
  fetchPhrasesBySeed: vi.fn(),
  fetchAllPhrasesUnpaginated: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'

const mockSeeds = [{ id: 's1', name: 'Seed 1', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 2 }]
const mockPhrases = [
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', created_at: '2024-01-02' },
]

describe('useRecall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSeeds).mockResolvedValue(mockSeeds)
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue(mockPhrases)
    vi.mocked(fetchAllPhrasesUnpaginated).mockResolvedValue(mockPhrases)
  })

  it('loads seeds on mount', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    expect(result.current.seeds).toEqual(mockSeeds)
  })

  it('startSession activates session and loads phrases', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', random: false })
    })

    expect(result.current.sessionActive).toBe(true)
    expect(result.current.phrases).toEqual(mockPhrases)
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.isRevealed).toBe(false)
  })

  it('reveal sets isRevealed and justRevealed', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })

    act(() => result.current.reveal())

    expect(result.current.isRevealed).toBe(true)
    expect(result.current.justRevealed).toBe(true)
  })

  it('next advances index and clears justRevealed', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.reveal())
    act(() => result.current.next())

    expect(result.current.currentIndex).toBe(1)
    expect(result.current.justRevealed).toBe(false)
    expect(result.current.isRevealed).toBe(false)
  })

  it('navigating back to a revealed phrase shows it as revealed', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.reveal())   // reveal phrase 0
    act(() => result.current.next())     // go to phrase 1
    act(() => result.current.previous()) // back to phrase 0

    expect(result.current.currentIndex).toBe(0)
    expect(result.current.isRevealed).toBe(true)
    expect(result.current.justRevealed).toBe(false)
  })

  it('previous does not go below 0', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.previous())

    expect(result.current.currentIndex).toBe(0)
  })

  it('next does not go past last phrase', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.next())
    act(() => result.current.next())

    expect(result.current.currentIndex).toBe(1) // clamped at last index
  })

  it('stopSession resets everything', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    await act(async () => { await result.current.startSession({ seedId: 's1', random: false }) })
    act(() => result.current.reveal())
    act(() => result.current.stopSession())

    expect(result.current.sessionActive).toBe(false)
    expect(result.current.phrases).toEqual([])
    expect(result.current.currentIndex).toBe(0)
  })

  it('startSession fetches all phrases when seedId is null', async () => {
    const { result } = renderHook(() => useRecall())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: null, random: false })
    })

    expect(fetchAllPhrasesUnpaginated).toHaveBeenCalled()
    expect(result.current.sessionActive).toBe(true)
  })
})
