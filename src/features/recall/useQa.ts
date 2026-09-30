import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchExchangesBySeed, fetchAllExchanges } from '@/features/phrases/phrasesService'
import { fetchSeedsWithExchangeCounts, type SeedWithExchangeCount } from './qaService'
import { logger } from '@/lib/logger'
import { shuffleArray } from '@/lib/utils'
import { toast } from 'sonner'
import type { Exchange } from '@/lib/database.types'

export interface QaConfig {
  seedId: string | null
  random: boolean
}

export function useQa() {
  const [seeds, setSeeds] = useState<SeedWithExchangeCount[]>([])
  const [seedsLoading, setSeedsLoading] = useState(true)

  const [sessionActive, setSessionActive] = useState(false)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [exchangesLoading, setExchangesLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())
  const [justRevealed, setJustRevealed] = useState(false)

  const exchangesRef = useRef<Exchange[]>([])

  useEffect(() => {
    fetchSeedsWithExchangeCounts()
      .then(setSeeds)
      .catch((err) => {
        logger.error('Failed to load seeds for Q&A', err)
        toast.error('Could not load seeds. Try again.')
      })
      .finally(() => setSeedsLoading(false))
  }, [])

  const startSession = useCallback(async (cfg: QaConfig) => {
    setExchangesLoading(true)
    try {
      const raw = cfg.seedId ? await fetchExchangesBySeed(cfg.seedId) : await fetchAllExchanges()
      const ordered = cfg.random ? shuffleArray(raw) : raw
      exchangesRef.current = ordered
      setExchanges(ordered)
      setCurrentIndex(0)
      setRevealedIndices(new Set())
      setJustRevealed(false)
      setSessionActive(true)
    } catch (err) {
      logger.error('Failed to start Q&A session', err)
      toast.error('Could not load exchanges. Try again.')
    } finally {
      setExchangesLoading(false)
    }
  }, [])

  const stopSession = useCallback(() => {
    setSessionActive(false)
    exchangesRef.current = []
    setExchanges([])
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
    setCurrentIndex((i) => Math.min(i + 1, exchangesRef.current.length - 1))
    setJustRevealed(false)
  }, [])

  const previous = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
    setJustRevealed(false)
  }, [])

  const currentExchange = exchanges[currentIndex] ?? null
  const isRevealed = revealedIndices.has(currentIndex)

  return {
    seeds,
    seedsLoading,
    sessionActive,
    exchanges,
    exchangesLoading,
    currentIndex,
    currentExchange,
    isRevealed,
    justRevealed,
    startSession,
    stopSession,
    reveal,
    next,
    previous,
  }
}
