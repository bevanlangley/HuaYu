# Drill & Recall Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Drill page into Listen + Shadow modes and add a new Active Recall page, removing the Global Phrases nav item.

**Architecture:** `useDrilling` is fully reworked — it takes no constructor args; a `startSession(config)` call loads phrases and begins the session. `useRecall` is a new hook with the same session pattern. Both hooks own phrase-loading and index management; display logic lives in the page component. Navigation is updated last, after both pages are built.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, Supabase JS v2, Web Speech API (`speakMandarin` from `@/lib/tts`), react-router-dom v6, Tailwind CSS + shadcn/ui.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/features/phrases/phrasesService.ts` | Add `fetchAllPhrasesUnpaginated()` |
| Create | `src/features/phrases/phrasesService.test.ts` | Test new service function |
| Modify | `src/features/drilling/useDrilling.ts` | Full rework: listen/shadow modes, startSession |
| Create | `src/features/drilling/useDrilling.test.ts` | Hook unit tests |
| Modify | `src/features/drilling/DrillingControls.tsx` | Update props for drillType-aware controls |
| Modify | `src/features/drilling/DrillingMode.tsx` | Config panel + session panel UI |
| Create | `src/features/drilling/DrillingMode.test.tsx` | Component tests |
| Create | `src/features/recall/useRecall.ts` | Recall session state machine |
| Create | `src/features/recall/useRecall.test.ts` | Hook unit tests |
| Create | `src/features/recall/RecallPage.tsx` | Active recall page |
| Create | `src/features/recall/RecallPage.test.tsx` | Component tests |
| Modify | `src/App.tsx` | Remove `/phrases` route, add `/recall` route |
| Modify | `src/components/layout/Sidebar.tsx` | Replace Phrases link with Recall |
| Modify | `src/components/layout/BottomNav.tsx` | Replace Phrases link with Recall |

---

## Task 1: Add fetchAllPhrasesUnpaginated to phrasesService

**Files:**
- Modify: `src/features/phrases/phrasesService.ts`
- Create: `src/features/phrases/phrasesService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/phrases/phrasesService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAllPhrasesUnpaginated } from './phrasesService'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { supabase } from '@/lib/supabase'

const mockPhrases = [
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', created_at: '2024-01-02' },
]

describe('fetchAllPhrasesUnpaginated', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all phrases ordered by created_at asc', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: mockPhrases, error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    const result = await fetchAllPhrasesUnpaginated()

    expect(supabase.from).toHaveBeenCalledWith('phrases')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toEqual(mockPhrases)
  })

  it('returns empty array on error', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    const result = await fetchAllPhrasesUnpaginated()

    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/features/phrases/phrasesService.test.ts
```

Expected: FAIL — `fetchAllPhrasesUnpaginated` is not exported.

- [ ] **Step 3: Add the function to phrasesService.ts**

Open `src/features/phrases/phrasesService.ts` and add at the end:

```typescript
export async function fetchAllPhrasesUnpaginated(): Promise<Phrase[]> {
  logger.info('Fetching all phrases unpaginated')
  const { data, error } = await supabase
    .from('phrases')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) {
    logger.error('Failed to fetch all phrases unpaginated', error)
    return []
  }
  logger.info('All phrases fetched', { count: data?.length })
  return data ?? []
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run src/features/phrases/phrasesService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/phrases/phrasesService.ts src/features/phrases/phrasesService.test.ts
git commit -m "feat: add fetchAllPhrasesUnpaginated to phrasesService"
```

---

## Task 2: Rework useDrilling hook

**Files:**
- Modify: `src/features/drilling/useDrilling.ts`
- Create: `src/features/drilling/useDrilling.test.ts`

The hook takes no constructor args. `startSession(config)` loads phrases (from one seed or all), shuffles if `random`, then begins the session. In listen mode it auto-advances through phrases with a configurable gap, respecting loop. In shadow mode there is no auto-advance — the user manually speaks and navigates.

- [ ] **Step 1: Write the failing tests**

Create `src/features/drilling/useDrilling.test.ts`:

```typescript
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
    vi.useFakeTimers()
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/features/drilling/useDrilling.test.ts
```

Expected: FAIL — hook API doesn't match yet.

- [ ] **Step 3: Rewrite useDrilling.ts**

Replace the entire contents of `src/features/drilling/useDrilling.ts` with:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { speakMandarin } from '@/lib/tts'
import { useTts } from '@/context/TtsContext'
import { logger } from '@/lib/logger'
import type { Phrase, SeedWithCount } from '@/lib/database.types'

export type DrillType = 'listen' | 'shadow'
export type PlaybackState = 'playing' | 'paused'

export interface DrillConfig {
  seedId: string | null
  drillType: DrillType
  random: boolean
  gapSeconds: number
  loop: boolean
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function useDrilling() {
  const { setCurrentlyPlaying } = useTts()

  const [seeds, setSeeds] = useState<SeedWithCount[]>([])
  const [seedsLoading, setSeedsLoading] = useState(true)

  const [sessionActive, setSessionActive] = useState(false)
  const [config, setConfig] = useState<DrillConfig | null>(null)
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [phrasesLoading, setPhrasesLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playbackState, setPlaybackState] = useState<PlaybackState>('playing')

  const cancelAudioRef = useRef<(() => void) | null>(null)
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const configRef = useRef<DrillConfig | null>(null)
  const phrasesRef = useRef<Phrase[]>([])
  const indexRef = useRef(0)
  const playbackStateRef = useRef<PlaybackState>('playing')

  useEffect(() => {
    fetchSeeds()
      .then(setSeeds)
      .catch((err) => logger.error('Failed to load seeds for drill', err))
      .finally(() => setSeedsLoading(false))
  }, [])

  const stopSession = useCallback(() => {
    cancelAudioRef.current?.()
    cancelAudioRef.current = null
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    gapTimerRef.current = null
    setCurrentlyPlaying(null)
    setSessionActive(false)
    setConfig(null)
    configRef.current = null
    setPhrases([])
    phrasesRef.current = []
    setCurrentIndex(0)
    indexRef.current = 0
    setPlaybackState('playing')
    playbackStateRef.current = 'playing'
  }, [setCurrentlyPlaying])

  const speakAtIndex = useCallback((idx: number) => {
    const phrase = phrasesRef.current[idx]
    if (!phrase) return
    cancelAudioRef.current?.()
    cancelAudioRef.current = null
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    gapTimerRef.current = null

    setCurrentlyPlaying(phrase.id)
    const cancel = speakMandarin(phrase.mandarin, () => {
      setCurrentlyPlaying(null)
      if (configRef.current?.drillType !== 'listen') return
      const gap = (configRef.current?.gapSeconds ?? 3) * 1000
      gapTimerRef.current = setTimeout(() => {
        if (playbackStateRef.current !== 'playing') return
        const next = indexRef.current + 1
        if (next >= phrasesRef.current.length) {
          if (configRef.current?.loop) {
            indexRef.current = 0
            setCurrentIndex(0)
            speakAtIndex(0)
          } else {
            stopSession()
          }
        } else {
          indexRef.current = next
          setCurrentIndex(next)
          speakAtIndex(next)
        }
      }, gap)
    })
    cancelAudioRef.current = cancel
  }, [setCurrentlyPlaying, stopSession])

  const startSession = useCallback(async (cfg: DrillConfig) => {
    setPhrasesLoading(true)
    try {
      const raw = cfg.seedId
        ? await fetchPhrasesBySeed(cfg.seedId)
        : await fetchAllPhrasesUnpaginated()
      const ordered = cfg.random ? shuffleArray(raw) : raw
      phrasesRef.current = ordered
      configRef.current = cfg
      indexRef.current = 0
      playbackStateRef.current = 'playing'
      setPhrases(ordered)
      setCurrentIndex(0)
      setPlaybackState('playing')
      setConfig(cfg)
      setSessionActive(true)
      if (cfg.drillType === 'listen') {
        speakAtIndex(0)
      }
    } finally {
      setPhrasesLoading(false)
    }
  }, [speakAtIndex])

  const pause = useCallback(() => {
    cancelAudioRef.current?.()
    cancelAudioRef.current = null
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    gapTimerRef.current = null
    setCurrentlyPlaying(null)
    playbackStateRef.current = 'paused'
    setPlaybackState('paused')
  }, [setCurrentlyPlaying])

  const resume = useCallback(() => {
    playbackStateRef.current = 'playing'
    setPlaybackState('playing')
    speakAtIndex(indexRef.current)
  }, [speakAtIndex])

  const next = useCallback(() => {
    cancelAudioRef.current?.()
    cancelAudioRef.current = null
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    gapTimerRef.current = null
    setCurrentlyPlaying(null)
    const nextIdx = Math.min(indexRef.current + 1, phrasesRef.current.length - 1)
    indexRef.current = nextIdx
    setCurrentIndex(nextIdx)
    if (configRef.current?.drillType === 'listen' && playbackStateRef.current === 'playing') {
      speakAtIndex(nextIdx)
    }
  }, [setCurrentlyPlaying, speakAtIndex])

  const previous = useCallback(() => {
    cancelAudioRef.current?.()
    cancelAudioRef.current = null
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current)
    gapTimerRef.current = null
    setCurrentlyPlaying(null)
    const prevIdx = Math.max(indexRef.current - 1, 0)
    indexRef.current = prevIdx
    setCurrentIndex(prevIdx)
    if (configRef.current?.drillType === 'listen' && playbackStateRef.current === 'playing') {
      speakAtIndex(prevIdx)
    }
  }, [setCurrentlyPlaying, speakAtIndex])

  const speakCurrent = useCallback(() => {
    const phrase = phrasesRef.current[indexRef.current]
    if (!phrase) return
    cancelAudioRef.current?.()
    cancelAudioRef.current = null
    setCurrentlyPlaying(phrase.id)
    const cancel = speakMandarin(phrase.mandarin, undefined)
    cancelAudioRef.current = cancel
  }, [setCurrentlyPlaying])

  const currentPhrase = phrases[currentIndex] ?? null

  return {
    seeds,
    seedsLoading,
    sessionActive,
    config,
    phrases,
    phrasesLoading,
    currentIndex,
    currentPhrase,
    playbackState,
    startSession,
    stopSession,
    pause,
    resume,
    next,
    previous,
    speakCurrent,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/features/drilling/useDrilling.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/drilling/useDrilling.ts src/features/drilling/useDrilling.test.ts
git commit -m "feat: rework useDrilling hook for listen/shadow modes"
```

---

## Task 3: Update DrillingControls component

**Files:**
- Modify: `src/features/drilling/DrillingControls.tsx`

Update props to accept `drillType` and render the correct control set for each mode. No test needed — behaviour is covered by DrillingMode tests in Task 4.

- [ ] **Step 1: Replace DrillingControls.tsx**

```tsx
import { Pause, Play, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DrillType, PlaybackState } from './useDrilling'

interface DrillingControlsProps {
  drillType: DrillType
  playbackState: PlaybackState
  currentIndex: number
  totalPhrases: number
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onNext: () => void
  onPrevious: () => void
}

export function DrillingControls({
  drillType,
  playbackState,
  currentIndex,
  totalPhrases,
  onPlay,
  onPause,
  onResume,
  onStop,
  onNext,
  onPrevious,
}: DrillingControlsProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-grey-500">
        {currentIndex + 1} / {totalPhrases}
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevious}
          disabled={currentIndex === 0}
          aria-label="Previous phrase"
        >
          <SkipBack size={20} strokeWidth={1.5} />
        </Button>

        {drillType === 'listen' ? (
          playbackState === 'playing' ? (
            <Button size="icon" onClick={onPause} aria-label="Pause">
              <Pause size={20} strokeWidth={1.5} />
            </Button>
          ) : (
            <Button size="icon" onClick={onResume} aria-label="Resume">
              <Play size={20} strokeWidth={1.5} />
            </Button>
          )
        ) : (
          <Button size="icon" onClick={onPlay} aria-label="Play phrase">
            <Volume2 size={20} strokeWidth={1.5} />
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          disabled={currentIndex >= totalPhrases - 1}
          aria-label="Next phrase"
        >
          <SkipForward size={20} strokeWidth={1.5} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={onStop}
          aria-label="Stop session"
        >
          <Square size={20} strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/drilling/DrillingControls.tsx
git commit -m "feat: update DrillingControls for listen/shadow mode split"
```

---

## Task 4: Rework DrillingMode page

**Files:**
- Modify: `src/features/drilling/DrillingMode.tsx`
- Create: `src/features/drilling/DrillingMode.test.tsx`

The page has two phases: **config** (session not started) and **session** (active playback). Config options appear above; when Start is pressed they collapse and the phrase display takes over.

- [ ] **Step 1: Write failing tests**

Create `src/features/drilling/DrillingMode.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DrillingMode } from './DrillingMode'

vi.mock('./useDrilling', () => ({
  useDrilling: vi.fn(),
}))
vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: vi.fn() }),
}))

import { useDrilling } from './useDrilling'

const mockSeeds = [{ id: 's1', name: 'Seed 1', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 2 }]
const mockPhrases = [
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', created_at: '2024-01-02' },
]
const mockStartSession = vi.fn()
const mockStopSession = vi.fn()
const mockPause = vi.fn()
const mockResume = vi.fn()
const mockNext = vi.fn()
const mockPrevious = vi.fn()
const mockSpeakCurrent = vi.fn()

function mockHook(overrides = {}) {
  vi.mocked(useDrilling).mockReturnValue({
    seeds: mockSeeds,
    seedsLoading: false,
    sessionActive: false,
    config: null,
    phrases: [],
    phrasesLoading: false,
    currentIndex: 0,
    currentPhrase: null,
    playbackState: 'playing' as const,
    startSession: mockStartSession,
    stopSession: mockStopSession,
    pause: mockPause,
    resume: mockResume,
    next: mockNext,
    previous: mockPrevious,
    speakCurrent: mockSpeakCurrent,
    ...overrides,
  })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <DrillingMode />
    </MemoryRouter>
  )

describe('DrillingMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHook()
  })

  it('renders config panel when session is not active', () => {
    renderPage()
    expect(screen.getByText('Listen')).toBeInTheDocument()
    expect(screen.getByText('Shadow')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('calls startSession with config when Start is clicked', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(mockStartSession).toHaveBeenCalledWith(
      expect.objectContaining({ drillType: 'listen' })
    ))
  })

  it('shows phrase card when session is active', () => {
    mockHook({
      sessionActive: true,
      config: { drillType: 'listen', seedId: 's1', random: false, gapSeconds: 3, loop: false },
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
    })
    renderPage()
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('hides phrase text when showText is toggled off in listen mode', async () => {
    mockHook({
      sessionActive: true,
      config: { drillType: 'listen', seedId: 's1', random: false, gapSeconds: 3, loop: false },
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /hide text/i }))
    expect(screen.queryByText('你好')).not.toBeInTheDocument()
  })

  it('always shows phrase text in shadow mode', () => {
    mockHook({
      sessionActive: true,
      config: { drillType: 'shadow', seedId: 's1', random: false, gapSeconds: 3, loop: false },
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
    })
    renderPage()
    expect(screen.getByText('你好')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/features/drilling/DrillingMode.test.tsx
```

Expected: FAIL — component doesn't match the new API yet.

- [ ] **Step 3: Rewrite DrillingMode.tsx**

Replace the entire file with:

```tsx
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DrillingControls } from './DrillingControls'
import { useDrilling } from './useDrilling'
import type { DrillType } from './useDrilling'

export function DrillingMode() {
  const location = useLocation()
  const preselectedSeedId: string | null = (location.state as { seedId?: string } | null)?.seedId ?? null

  const [drillType, setDrillType] = useState<DrillType>('listen')
  const [seedId, setSeedId] = useState<string | null>(preselectedSeedId)
  const [random, setRandom] = useState(false)
  const [gapSeconds, setGapSeconds] = useState(3)
  const [loop, setLoop] = useState(false)
  const [showText, setShowText] = useState(true)

  const {
    seeds, seedsLoading,
    sessionActive, config, phrases, phrasesLoading,
    currentIndex, currentPhrase, playbackState,
    startSession, stopSession, pause, resume, next, previous, speakCurrent,
  } = useDrilling()

  function handleStart() {
    startSession({ seedId, drillType, random, gapSeconds, loop })
  }

  const displayText = config?.drillType === 'listen' ? showText : true

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Drill</h1>

      {!sessionActive && (
        <div className="flex flex-col gap-5 p-6 bg-grey-100 dark:bg-grey-800 rounded-lg">
          {/* Mode */}
          <div className="flex flex-col gap-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              {(['listen', 'shadow'] as DrillType[]).map((m) => (
                <Button
                  key={m}
                  variant={drillType === m ? 'default' : 'outline'}
                  onClick={() => setDrillType(m)}
                  className="capitalize"
                >
                  {m === 'listen' ? 'Listen' : 'Shadow'}
                </Button>
              ))}
            </div>
          </div>

          {/* Source */}
          <div className="flex flex-col gap-2">
            <Label>Source</Label>
            {seedsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={seedId ?? 'all'} onValueChange={(v) => setSeedId(v === 'all' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All phrases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All phrases</SelectItem>
                  {seeds.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.phraseCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Order */}
          <div className="flex flex-col gap-2">
            <Label>Order</Label>
            <div className="flex gap-2">
              <Button variant={!random ? 'default' : 'outline'} onClick={() => setRandom(false)}>
                In order
              </Button>
              <Button variant={random ? 'default' : 'outline'} onClick={() => setRandom(true)}>
                Random
              </Button>
            </div>
          </div>

          {/* Listen-only options */}
          {drillType === 'listen' && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gap">Gap between phrases (seconds)</Label>
                <input
                  id="gap"
                  type="number"
                  min={1}
                  max={30}
                  value={gapSeconds}
                  onChange={(e) => setGapSeconds(Math.min(30, Math.max(1, Number(e.target.value))))}
                  className="w-24 rounded-md border border-grey-300 dark:border-grey-600 bg-white dark:bg-grey-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="loop">Loop</Label>
                <button
                  id="loop"
                  role="switch"
                  aria-checked={loop}
                  onClick={() => setLoop((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${loop ? 'bg-primary-500' : 'bg-grey-300 dark:bg-grey-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${loop ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="showText">Show text</Label>
                <button
                  id="showText"
                  role="switch"
                  aria-checked={showText}
                  onClick={() => setShowText((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${showText ? 'bg-primary-500' : 'bg-grey-300 dark:bg-grey-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showText ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </>
          )}

          <Button onClick={handleStart} disabled={phrasesLoading} className="self-start">
            {phrasesLoading ? 'Loading…' : 'Start'}
          </Button>
        </div>
      )}

      {sessionActive && (
        <div className="flex flex-col items-center gap-6">
          {/* Show text toggle (listen only) */}
          {config?.drillType === 'listen' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowText((v) => !v)}
              className="self-end flex items-center gap-1.5"
              aria-label={showText ? 'Hide text' : 'Show text'}
            >
              {showText ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              {showText ? 'Hide text' : 'Show text'}
            </Button>
          )}

          {/* Phrase card */}
          <div className="w-full min-h-48 flex items-center justify-center p-8 bg-grey-100 dark:bg-grey-800 rounded-lg">
            {displayText && currentPhrase ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p lang="zh-TW" className="text-4xl font-medium">{currentPhrase.mandarin}</p>
                <p className="text-xl text-grey-600 dark:text-grey-400">{currentPhrase.pinyin}</p>
                <p className="text-lg text-grey-500">{currentPhrase.english}</p>
              </div>
            ) : (
              <p className="text-grey-400 text-sm">Audio only</p>
            )}
          </div>

          {/* Empty state */}
          {phrases.length === 0 && !phrasesLoading && (
            <p className="text-grey-500 text-sm">No phrases found for this source.</p>
          )}

          <DrillingControls
            drillType={config?.drillType ?? 'listen'}
            playbackState={playbackState}
            currentIndex={currentIndex}
            totalPhrases={phrases.length}
            onPlay={speakCurrent}
            onPause={pause}
            onResume={resume}
            onStop={stopSession}
            onNext={next}
            onPrevious={previous}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```
npx vitest run src/features/drilling/DrillingMode.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```
npx vitest run
```

Expected: all existing tests still pass.

- [ ] **Step 6: Type check**

```
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/drilling/DrillingMode.tsx src/features/drilling/DrillingMode.test.tsx
git commit -m "feat: rework DrillingMode page with listen/shadow config + session UI"
```

---

## Task 5: Create useRecall hook

**Files:**
- Create: `src/features/recall/useRecall.ts`
- Create: `src/features/recall/useRecall.test.ts`

The hook manages a recall session: tracks which phrases have been revealed, exposes a `justRevealed` flag for the component to auto-play audio on reveal, and resets that flag on navigation.

- [ ] **Step 1: Write failing tests**

Create `src/features/recall/useRecall.test.ts`:

```typescript
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/features/recall/useRecall.test.ts
```

Expected: FAIL — file does not exist yet.

- [ ] **Step 3: Create useRecall.ts**

Create `src/features/recall/useRecall.ts`:

```typescript
import { useState, useCallback, useEffect } from 'react'
import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { logger } from '@/lib/logger'
import type { Phrase, SeedWithCount } from '@/lib/database.types'

export interface RecallConfig {
  seedId: string | null
  random: boolean
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function useRecall() {
  const [seeds, setSeeds] = useState<SeedWithCount[]>([])
  const [seedsLoading, setSeedsLoading] = useState(true)

  const [sessionActive, setSessionActive] = useState(false)
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [phrasesLoading, setPhrasesLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())
  const [justRevealed, setJustRevealed] = useState(false)

  useEffect(() => {
    fetchSeeds()
      .then(setSeeds)
      .catch((err) => logger.error('Failed to load seeds for recall', err))
      .finally(() => setSeedsLoading(false))
  }, [])

  const startSession = useCallback(async (cfg: RecallConfig) => {
    setPhrasesLoading(true)
    try {
      const raw = cfg.seedId
        ? await fetchPhrasesBySeed(cfg.seedId)
        : await fetchAllPhrasesUnpaginated()
      const ordered = cfg.random ? shuffleArray(raw) : raw
      setPhrases(ordered)
      setCurrentIndex(0)
      setRevealedIndices(new Set())
      setJustRevealed(false)
      setSessionActive(true)
    } finally {
      setPhrasesLoading(false)
    }
  }, [])

  const stopSession = useCallback(() => {
    setSessionActive(false)
    setPhrases([])
    setCurrentIndex(0)
    setRevealedIndices(new Set())
    setJustRevealed(false)
  }, [])

  const reveal = useCallback(() => {
    setRevealedIndices((prev) => new Set([...prev, currentIndex]))
    setJustRevealed(true)
  }, [currentIndex])

  const next = useCallback(() => {
    setCurrentIndex((i) => {
      const next = Math.min(i + 1, phrases.length - 1)
      return next
    })
    setJustRevealed(false)
  }, [phrases.length])

  const previous = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
    setJustRevealed(false)
  }, [])

  const currentPhrase = phrases[currentIndex] ?? null
  const isRevealed = revealedIndices.has(currentIndex)

  return {
    seeds,
    seedsLoading,
    sessionActive,
    phrases,
    phrasesLoading,
    currentIndex,
    currentPhrase,
    isRevealed,
    justRevealed,
    startSession,
    stopSession,
    reveal,
    next,
    previous,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/features/recall/useRecall.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/recall/useRecall.ts src/features/recall/useRecall.test.ts
git commit -m "feat: add useRecall hook for active recall session"
```

---

## Task 6: Create RecallPage component

**Files:**
- Create: `src/features/recall/RecallPage.tsx`
- Create: `src/features/recall/RecallPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/features/recall/RecallPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RecallPage } from './RecallPage'

vi.mock('./useRecall', () => ({
  useRecall: vi.fn(),
}))
vi.mock('@/lib/tts', () => ({
  speakMandarin: vi.fn().mockReturnValue(vi.fn()),
}))

import { useRecall } from './useRecall'

const mockPhrases = [
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', created_at: '2024-01-02' },
]
const mockSeeds = [{ id: 's1', name: 'Seed 1', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 2 }]
const mockStartSession = vi.fn()
const mockStopSession = vi.fn()
const mockReveal = vi.fn()
const mockNext = vi.fn()
const mockPrevious = vi.fn()

function mockHook(overrides = {}) {
  vi.mocked(useRecall).mockReturnValue({
    seeds: mockSeeds,
    seedsLoading: false,
    sessionActive: false,
    phrases: [],
    phrasesLoading: false,
    currentIndex: 0,
    currentPhrase: null,
    isRevealed: false,
    justRevealed: false,
    startSession: mockStartSession,
    stopSession: mockStopSession,
    reveal: mockReveal,
    next: mockNext,
    previous: mockPrevious,
    ...overrides,
  })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <RecallPage />
    </MemoryRouter>
  )

describe('RecallPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHook()
  })

  it('renders config panel when session is not active', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('calls startSession when Start is clicked', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(mockStartSession).toHaveBeenCalled())
  })

  it('shows English sentence before reveal', () => {
    mockHook({
      sessionActive: true,
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
      isRevealed: false,
      justRevealed: false,
    })
    renderPage()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByText('你好')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
  })

  it('shows Mandarin and Pinyin after reveal', () => {
    mockHook({
      sessionActive: true,
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
      isRevealed: true,
      justRevealed: false,
    })
    renderPage()
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument()
  })

  it('calls reveal when Reveal button is clicked', () => {
    mockHook({
      sessionActive: true,
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
      isRevealed: false,
      justRevealed: false,
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }))
    expect(mockReveal).toHaveBeenCalled()
  })

  it('shows progress indicator during session', () => {
    mockHook({
      sessionActive: true,
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
      isRevealed: false,
      justRevealed: false,
    })
    renderPage()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/features/recall/RecallPage.test.tsx
```

Expected: FAIL — file does not exist.

- [ ] **Step 3: Create RecallPage.tsx**

Create `src/features/recall/RecallPage.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useState } from 'react'
import { Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { speakMandarin } from '@/lib/tts'
import { useRecall } from './useRecall'

export function RecallPage() {
  const [seedId, setSeedId] = useState<string | null>(null)
  const [random, setRandom] = useState(true)

  const {
    seeds, seedsLoading,
    sessionActive, phrases, phrasesLoading,
    currentIndex, currentPhrase, isRevealed, justRevealed,
    startSession, stopSession, reveal, next, previous,
  } = useRecall()

  const cancelAudioRef = useRef<(() => void) | null>(null)

  // Auto-play audio on reveal (only on the initial reveal action, not on navigation)
  useEffect(() => {
    if (!justRevealed || !currentPhrase) return
    cancelAudioRef.current?.()
    cancelAudioRef.current = speakMandarin(currentPhrase.mandarin)
    return () => {
      cancelAudioRef.current?.()
      cancelAudioRef.current = null
    }
  }, [justRevealed, currentPhrase])

  function handleReplayAudio() {
    if (!currentPhrase) return
    cancelAudioRef.current?.()
    cancelAudioRef.current = speakMandarin(currentPhrase.mandarin)
  }

  function handleStart() {
    startSession({ seedId, random })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-medium">Recall</h1>

      {!sessionActive && (
        <div className="flex flex-col gap-5 p-6 bg-grey-100 dark:bg-grey-800 rounded-lg">
          {/* Source */}
          <div className="flex flex-col gap-2">
            <Label>Source</Label>
            {seedsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={seedId ?? 'all'} onValueChange={(v) => setSeedId(v === 'all' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All phrases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All phrases</SelectItem>
                  {seeds.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.phraseCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Order */}
          <div className="flex flex-col gap-2">
            <Label>Order</Label>
            <div className="flex gap-2">
              <Button variant={!random ? 'default' : 'outline'} onClick={() => setRandom(false)}>
                In order
              </Button>
              <Button variant={random ? 'default' : 'outline'} onClick={() => setRandom(true)}>
                Random
              </Button>
            </div>
          </div>

          <Button onClick={handleStart} disabled={phrasesLoading} className="self-start">
            {phrasesLoading ? 'Loading…' : 'Start'}
          </Button>
        </div>
      )}

      {sessionActive && (
        <div className="flex flex-col items-center gap-6">
          {/* Progress */}
          <p className="text-sm text-grey-500 self-start">
            {currentIndex + 1} / {phrases.length}
          </p>

          {/* Phrase card */}
          <div className="w-full p-8 bg-grey-100 dark:bg-grey-800 rounded-lg flex flex-col items-center gap-4 text-center min-h-56 justify-center">
            {currentPhrase ? (
              <>
                {/* English always visible */}
                <p className="text-xl text-grey-600 dark:text-grey-300">{currentPhrase.english}</p>

                {isRevealed ? (
                  <div className="flex flex-col items-center gap-3 mt-4">
                    <p lang="zh-TW" className="text-4xl font-medium">{currentPhrase.mandarin}</p>
                    <p className="text-xl text-grey-600 dark:text-grey-400">{currentPhrase.pinyin}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReplayAudio}
                      className="flex items-center gap-1.5 mt-2"
                    >
                      <Volume2 size={16} strokeWidth={1.5} />
                      Play again
                    </Button>
                  </div>
                ) : (
                  <Button onClick={reveal} className="mt-4">
                    Reveal
                  </Button>
                )}
              </>
            ) : (
              <p className="text-grey-400 text-sm">No phrases found for this source.</p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={previous}
              disabled={currentIndex === 0}
            >
              ← Previous
            </Button>
            <Button
              variant="outline"
              onClick={next}
              disabled={currentIndex >= phrases.length - 1}
            >
              Next →
            </Button>
            <Button variant="outline" onClick={stopSession}>
              Stop
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/features/recall/RecallPage.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run full test suite and type check**

```
npx vitest run
```
```
npx tsc -b --noEmit
```

Expected: all pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/recall/RecallPage.tsx src/features/recall/RecallPage.test.tsx
git commit -m "feat: add RecallPage for active recall sessions"
```

---

## Task 7: Update navigation — remove Phrases, add Recall

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/BottomNav.tsx`

Do this task last — the RecallPage must exist before its route is registered.

- [ ] **Step 1: Update App.tsx**

In `src/App.tsx`:

1. Add a lazy import for RecallPage alongside the existing imports:
```typescript
const RecallPage = lazy(() => import('@/features/recall/RecallPage').then(m => ({ default: m.RecallPage })))
```

2. Remove the `/phrases` route block entirely.

3. Add the `/recall` route in the same location as `/phrases` was:
```tsx
<Route path="/recall" element={<RecallPage />} />
```

- [ ] **Step 2: Update Sidebar.tsx**

Find the nav item for Phrases (uses the `Library` icon and links to `/phrases`) and replace it with:

```tsx
<NavLink to="/recall" ...>
  <BrainCircuit size={20} strokeWidth={1.5} />
  <span>Recall</span>
</NavLink>
```

Add `BrainCircuit` to the lucide-react import. Remove `Library` from the import if it is no longer used elsewhere in the file.

- [ ] **Step 3: Update BottomNav.tsx**

Apply the same replacement as Sidebar: swap the Phrases nav item (Library icon, `/phrases`) for a Recall item (BrainCircuit icon, `/recall`). Update imports accordingly.

- [ ] **Step 4: Type check**

```
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx src/components/layout/BottomNav.tsx
git commit -m "feat: update nav — replace Phrases with Recall, wire recall route"
```

---

## Final verification

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to **Drill**: verify config panel renders, Start button works, Listen mode auto-advances, Shadow mode requires manual Play press
- [ ] Verify **Show text** toggle hides/shows phrase text in Listen mode
- [ ] Navigate to **Recall**: verify English-only prompt, Reveal shows Chinese + plays audio, Previous/Next navigation works, previously revealed phrases show as revealed
- [ ] Verify **Seeds** nav item still works and phrase management within seeds is unaffected
- [ ] Verify the **Phrases** nav item is gone
- [ ] Production build: `npm run build` — no errors
- [ ] Push to main and verify Vercel build succeeds
