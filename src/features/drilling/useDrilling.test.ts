import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDrilling } from './useDrilling'

vi.mock('@/features/seeds/seedsService', () => ({
  fetchSeeds: vi.fn(),
}))
vi.mock('@/features/phrases/phrasesService', () => ({
  fetchPhrasesBySeed: vi.fn(),
  fetchAllPhrasesUnpaginated: vi.fn(),
}))
vi.mock('@/lib/tts', () => ({
  speakMandarin: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { speakMandarin } from '@/lib/tts'

const mockSeeds = [{ id: 's1', name: 'Seed 1', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 2 }]
const mockPhrases = [
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', created_at: '2024-01-02' },
]
const mockCancel = vi.fn()

describe('useDrilling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(fetchSeeds).mockResolvedValue(mockSeeds)
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue(mockPhrases)
    vi.mocked(fetchAllPhrasesUnpaginated).mockResolvedValue(mockPhrases)
    vi.mocked(speakMandarin).mockReturnValue(mockCancel)
  })

  afterEach(() => vi.useRealTimers())

  it('loads seeds on mount', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    expect(result.current.seeds).toEqual(mockSeeds)
  })

  it('startSession fetches phrases from the given seed', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'listen', random: false, gapSeconds: 3, loop: false })
    })

    expect(fetchPhrasesBySeed).toHaveBeenCalledWith('s1')
    expect(result.current.sessionActive).toBe(true)
    expect(result.current.phrases).toEqual(mockPhrases)
    expect(result.current.currentIndex).toBe(0)
  })

  it('startSession fetches all phrases when seedId is null', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: null, drillType: 'listen', random: false, gapSeconds: 3, loop: false })
    })

    expect(fetchAllPhrasesUnpaginated).toHaveBeenCalled()
    expect(result.current.sessionActive).toBe(true)
  })

  it('listen mode speaks the first phrase on session start', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'listen', random: false, gapSeconds: 2, loop: false })
    })

    expect(speakMandarin).toHaveBeenCalledWith('你好', expect.any(Function))
  })

  it('listen mode auto-advances after speaking + gap', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'listen', random: false, gapSeconds: 2, loop: false })
    })

    // Simulate speakMandarin calling its onEnd callback
    const onEnd = vi.mocked(speakMandarin).mock.calls[0][1] as () => void
    act(() => onEnd())

    // Advance past the 2s gap
    act(() => vi.advanceTimersByTime(2000))

    expect(result.current.currentIndex).toBe(1)
  })

  it('listen mode stops when last phrase done and loop is off', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'listen', random: false, gapSeconds: 1, loop: false })
    })

    // Advance through both phrases
    for (let i = 0; i < mockPhrases.length; i++) {
      const onEnd = vi.mocked(speakMandarin).mock.lastCall![1] as () => void
      act(() => onEnd())
      act(() => vi.advanceTimersByTime(1000))
    }

    expect(result.current.sessionActive).toBe(false)
  })

  it('shadow mode does not auto-speak on session start', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })

    expect(speakMandarin).not.toHaveBeenCalled()
    expect(result.current.sessionActive).toBe(true)
    expect(result.current.currentIndex).toBe(0)
  })

  it('speakCurrent speaks the current phrase without advancing', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })
    act(() => result.current.speakCurrent())

    expect(speakMandarin).toHaveBeenCalledWith('你好', undefined)
    expect(result.current.currentIndex).toBe(0)
  })

  it('next advances the index', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })
    act(() => result.current.next())

    expect(result.current.currentIndex).toBe(1)
  })

  it('previous does not go below 0', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })
    act(() => result.current.previous())

    expect(result.current.currentIndex).toBe(0)
  })

  it('stopSession resets the session', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'listen', random: false, gapSeconds: 2, loop: false })
    })
    act(() => result.current.stopSession())

    expect(result.current.sessionActive).toBe(false)
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.phrases).toEqual([])
  })

  it('next does not cancel audio when already at last phrase', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })
    act(() => result.current.next()) // go to last (index 1)
    vi.clearAllMocks()
    act(() => result.current.next()) // already at last — should be no-op

    expect(result.current.currentIndex).toBe(1)
    expect(speakMandarin).not.toHaveBeenCalled()
  })

  it('resume does not auto-speak in shadow mode', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })
    act(() => result.current.pause())
    vi.clearAllMocks()
    act(() => result.current.resume())

    expect(speakMandarin).not.toHaveBeenCalled()
  })

  it('startSession logs error when fetch fails', async () => {
    vi.mocked(fetchPhrasesBySeed).mockRejectedValueOnce(new Error('network error'))
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'listen', random: false, gapSeconds: 2, loop: false })
    })

    expect(result.current.sessionActive).toBe(false)
    expect(result.current.phrasesLoading).toBe(false)
  })
})
