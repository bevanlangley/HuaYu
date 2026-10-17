import { useState, useEffect } from 'react'
import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { buildExchangeIndex } from '@/features/phrases/exchanges'
import { fetchSeedsWithExchangeCounts, type SeedWithExchangeCount } from './qaService'
import { logger } from '@/lib/logger'
import { shuffleArray } from '@/lib/utils'
import { useRevealSession } from './useRevealSession'
import { toast } from 'sonner'
import type { Exchange } from '@/lib/database.types'

export interface QaConfig {
  seedId: string | null
  random: boolean
}

async function loadExchanges(cfg: QaConfig): Promise<Exchange[]> {
  const phrases = cfg.seedId
    ? await fetchPhrasesBySeed(cfg.seedId)
    : await fetchAllPhrasesUnpaginated()
  const { exchanges } = buildExchangeIndex(phrases)
  return cfg.random ? shuffleArray(exchanges) : exchanges
}

export function useQa() {
  const [seeds, setSeeds] = useState<SeedWithExchangeCount[]>([])
  const [seedsLoading, setSeedsLoading] = useState(true)

  const session = useRevealSession<Exchange, QaConfig>({
    loadItems: loadExchanges,
    failureLabel: 'start Q&A session',
    failureToast: 'Could not load exchanges. Try again.',
  })

  useEffect(() => {
    fetchSeedsWithExchangeCounts()
      .then(setSeeds)
      .catch((err) => {
        logger.error('Failed to load seeds for Q&A', err)
        toast.error('Could not load seeds. Try again.')
      })
      .finally(() => setSeedsLoading(false))
  }, [])

  return {
    seeds,
    seedsLoading,
    sessionActive: session.sessionActive,
    exchanges: session.items,
    exchangesLoading: session.loading,
    currentIndex: session.currentIndex,
    currentExchange: session.currentItem,
    isRevealed: session.isRevealed,
    justRevealed: session.justRevealed,
    startSession: session.startSession,
    stopSession: session.stopSession,
    reveal: session.reveal,
    next: session.next,
    previous: session.previous,
  }
}
