import { fetchSeeds } from '@/features/seeds/seedsService'
import { useSeedList } from '@/features/seeds/useSeedList'
import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { shuffleArray } from '@/lib/utils'
import { useRevealSession } from './useRevealSession'
import type { Phrase } from '@/lib/database.types'

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
  const { seeds, seedsLoading } = useSeedList(fetchSeeds)

  const session = useRevealSession<Phrase, RecallConfig>({
    loadItems: loadPhrases,
    failureLog: 'Failed to start recall session',
    failureToast: 'Could not load phrases. Try again.',
  })

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
