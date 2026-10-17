import { useState, useEffect } from 'react'
import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { logger } from '@/lib/logger'
import { shuffleArray } from '@/lib/utils'
import { useRevealSession } from './useRevealSession'
import type { Phrase, SeedWithCount } from '@/lib/database.types'

export interface RecallConfig {
  seedId: string | null
  random: boolean
}

async function loadPhrases(cfg: RecallConfig): Promise<Phrase[]> {
  const raw = cfg.seedId
    ? await fetchPhrasesBySeed(cfg.seedId)
    : await fetchAllPhrasesUnpaginated()
  return cfg.random ? shuffleArray(raw) : raw
}

export function useRecall() {
  const [seeds, setSeeds] = useState<SeedWithCount[]>([])
  const [seedsLoading, setSeedsLoading] = useState(true)

  const session = useRevealSession<Phrase, RecallConfig>({
    loadItems: loadPhrases,
    failureLabel: 'start recall session',
    failureToast: 'Could not load phrases. Try again.',
  })

  useEffect(() => {
    fetchSeeds()
      .then(setSeeds)
      .catch((err) => logger.error('Failed to load seeds for recall', err))
      .finally(() => setSeedsLoading(false))
  }, [])

  return {
    seeds,
    seedsLoading,
    sessionActive: session.sessionActive,
    phrases: session.items,
    phrasesLoading: session.loading,
    currentIndex: session.currentIndex,
    currentPhrase: session.currentItem,
    isRevealed: session.isRevealed,
    justRevealed: session.justRevealed,
    startSession: session.startSession,
    stopSession: session.stopSession,
    reveal: session.reveal,
    next: session.next,
    previous: session.previous,
  }
}
