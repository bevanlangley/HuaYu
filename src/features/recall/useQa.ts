import { fetchPhrasesBySeed, fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { buildExchangeIndex } from '@/features/phrases/exchanges'
import { useSeedList } from '@/features/seeds/useSeedList'
import { fetchSeedsWithExchangeCounts } from './qaService'
import { shuffleArray } from '@/lib/utils'
import { useRevealSession } from './useRevealSession'
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
  const { seeds, seedsLoading } = useSeedList(fetchSeedsWithExchangeCounts)

  const session = useRevealSession<Exchange, QaConfig>({
    loadItems: loadExchanges,
    failureLog: 'Failed to start Q&A session',
    failureToast: 'Could not load exchanges. Try again.',
  })

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
