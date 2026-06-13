import { useState, useRef, useCallback, useEffect } from 'react'
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
