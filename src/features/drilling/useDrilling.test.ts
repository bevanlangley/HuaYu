import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDrilling } from './useDrilling'

vi.mock('@/features/seeds/seedsService', () => ({
  fetchSeeds: vi.fn(),
}))
vi.mock('@/features/phrases/phrasesService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/phrases/phrasesService')>()
  return {
    ...actual,
    fetchPhrasesBySeed: vi.fn(),
    fetchAllPhrasesUnpaginated: vi.fn(),
  }
})
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
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', phrase_type: 'statement' as const, question_id: null, created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', phrase_type: 'statement' as const, question_id: null, created_at: '2024-01-02' },
]
const mockCancel = vi.fn()

const mockQuestion = {
  id: 'q1', seed_id: 's1', mandarin: '你好嗎？', pinyin: 'nǐ hǎo ma?', english: 'How are you?',
  phrase_type: 'question' as const, question_id: null, created_at: '2024-01-01',
}
const mockFiller = {
  id: 'f1', seed_id: 's1', mandarin: '再見', pinyin: 'zài jiàn', english: 'Goodbye',
  phrase_type: 'statement' as const, question_id: null, created_at: '2024-01-02',
}
const mockAnswer1 = {
  id: 'a1', seed_id: 's1', mandarin: '我很好', pinyin: 'wǒ hěn hǎo', english: "I'm well",
  phrase_type: 'answer' as const, question_id: 'q1', created_at: '2024-01-03',
}
const mockAnswer2 = {
  id: 'a2', seed_id: 's1', mandarin: '還不錯', pinyin: 'hái búcuò', english: 'Not bad',
  phrase_type: 'answer' as const, question_id: 'q1', created_at: '2024-01-04',
}
const mockQuestion2 = {
  id: 'q2', seed_id: 's1', mandarin: '你叫什麼名字？', pinyin: 'nǐ jiào shénme míngzì?', english: "What's your name?",
  phrase_type: 'question' as const, question_id: null, created_at: '2024-01-05',
}
const mockAnswer3 = {
  id: 'a3', seed_id: 's1', mandarin: '我叫小明', pinyin: 'wǒ jiào xiǎomíng', english: 'My name is Xiaoming',
  phrase_type: 'answer' as const, question_id: 'q2', created_at: '2024-01-06',
}

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

  it('restarts from index 0 when loop is on and last phrase ends', async () => {
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({
        seedId: null,
        drillType: 'listen',
        random: false,
        gapSeconds: 1,
        loop: true,
      })
    })

    // Both phrases are in session, index starts at 0
    expect(result.current.currentIndex).toBe(0)

    // Finish phrase 0
    const onEnd0 = vi.mocked(speakMandarin).mock.calls[0][1] as () => void
    act(() => { onEnd0() })
    act(() => { vi.advanceTimersByTime(1000) })

    // Now at phrase 1
    await waitFor(() => expect(result.current.currentIndex).toBe(1))

    // Finish phrase 1 (last phrase)
    const onEnd1 = vi.mocked(speakMandarin).mock.calls[1][1] as () => void
    act(() => { onEnd1() })
    act(() => { vi.advanceTimersByTime(1000) })

    // Loop: should be back at index 0 and speaking again
    await waitFor(() => expect(result.current.currentIndex).toBe(0))
    expect(vi.mocked(speakMandarin).mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('plays a Question immediately followed by all its linked Answers, ahead of a phrase that fell between them', async () => {
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([mockQuestion, mockFiller, mockAnswer1, mockAnswer2])
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })

    expect(result.current.phrases.map((p) => p.id)).toEqual(['q1', 'a1', 'a2', 'f1'])
  })

  it('preserves Question-then-Answers pairing in "all seeds" sequential Drilling', async () => {
    vi.mocked(fetchAllPhrasesUnpaginated).mockResolvedValue([mockQuestion, mockFiller, mockAnswer1, mockAnswer2])
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: null, drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })

    expect(fetchAllPhrasesUnpaginated).toHaveBeenCalled()
    expect(result.current.phrases.map((p) => p.id)).toEqual(['q1', 'a1', 'a2', 'f1'])
  })

  it('steps Next one phrase at a time through a grouped Exchange', async () => {
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([mockQuestion, mockFiller, mockAnswer1, mockAnswer2])
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })

    expect(result.current.currentPhrase?.id).toBe('q1')
    act(() => result.current.next())
    expect(result.current.currentPhrase?.id).toBe('a1')
    act(() => result.current.next())
    expect(result.current.currentPhrase?.id).toBe('a2')
    act(() => result.current.next())
    expect(result.current.currentPhrase?.id).toBe('f1')
  })

  it('steps Previous one phrase at a time back through a grouped Exchange', async () => {
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([mockQuestion, mockFiller, mockAnswer1, mockAnswer2])
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'shadow', random: false, gapSeconds: 3, loop: false })
    })
    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.next())
    expect(result.current.currentPhrase?.id).toBe('f1')

    act(() => result.current.previous())
    expect(result.current.currentPhrase?.id).toBe('a2')
    act(() => result.current.previous())
    expect(result.current.currentPhrase?.id).toBe('a1')
    act(() => result.current.previous())
    expect(result.current.currentPhrase?.id).toBe('q1')
  })

  it('replays the same grouped order (Question, then Answers, then the filler) after looping back to the start', async () => {
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([mockQuestion, mockFiller, mockAnswer1, mockAnswer2])
    const { result } = renderHook(() => useDrilling())
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))

    await act(async () => {
      await result.current.startSession({ seedId: 's1', drillType: 'listen', random: false, gapSeconds: 1, loop: true })
    })
    const groupedOrder = result.current.phrases.map((p) => p.id)

    // Walk through all four phrases via their onEnd callback, to trigger the loop restart.
    for (let i = 0; i < groupedOrder.length; i++) {
      const onEnd = vi.mocked(speakMandarin).mock.lastCall![1] as () => void
      act(() => onEnd())
      act(() => vi.advanceTimersByTime(1000))
    }

    await waitFor(() => expect(result.current.currentIndex).toBe(0))
    // The looped pass reuses the same grouped array rather than re-deriving or re-scattering it.
    expect(result.current.phrases.map((p) => p.id)).toEqual(groupedOrder)
    expect(result.current.currentPhrase?.id).toBe('q1')
  })

  // Two Exchanges (q1->[a1,a2], q2->[a3]) plus a standalone filler — three groups give shuffle
  // something real to reorder, so adjacency holding across iterations isn't trivial by
  // construction the way it would be with only one movable group.
  const multiExchangePhrases = [mockQuestion, mockFiller, mockAnswer1, mockQuestion2, mockAnswer2, mockAnswer3]

  it.each([
    ['single-Seed', 's1', () => vi.mocked(fetchPhrasesBySeed).mockResolvedValue(multiExchangePhrases)],
    ['all seeds', null, () => vi.mocked(fetchAllPhrasesUnpaginated).mockResolvedValue(multiExchangePhrases)],
  ] as const)(
    'never separates a Question from its Answers under shuffle, across many randomized iterations (%s)',
    async (_label, seedId, setUpFetch) => {
      setUpFetch()
      const { result } = renderHook(() => useDrilling())
      await waitFor(() => expect(result.current.seedsLoading).toBe(false))

      for (let i = 0; i < 30; i++) {
        await act(async () => {
          await result.current.startSession({ seedId, drillType: 'shadow', random: true, gapSeconds: 3, loop: false })
        })
        const ids = result.current.phrases.map((p) => p.id)
        const q1Index = ids.indexOf('q1')
        expect(ids.slice(q1Index, q1Index + 3)).toEqual(['q1', 'a1', 'a2'])
        const q2Index = ids.indexOf('q2')
        expect(ids.slice(q2Index, q2Index + 2)).toEqual(['q2', 'a3'])
      }
    }
  )

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
