import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
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

  const phrasesRef = useRef<Phrase[]>([])

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
      phrasesRef.current = ordered
      setPhrases(ordered)
      setCurrentIndex(0)
      setRevealedIndices(new Set())
      setJustRevealed(false)
      setSessionActive(true)
    } catch (err) {
      logger.error('Failed to start recall session', err)
      toast.error('Could not load phrases. Try again.')
    } finally {
      setPhrasesLoading(false)
    }
  }, [])

  const stopSession = useCallback(() => {
    setSessionActive(false)
    phrasesRef.current = []
    setPhrases([])
    setCurrentIndex(0)
    setRevealedIndices(new Set())
    setJustRevealed(false)
  }, [])

  const reveal = useCallback(() => {
    setRevealedIndices((prev) => {
      const next = new Set(prev)
      next.add(currentIndex)
      return next
    })
    setJustRevealed(true)
  }, [currentIndex])

  const next = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, phrasesRef.current.length - 1))
    setJustRevealed(false)
  }, [])

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
