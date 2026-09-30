import { logger } from '@/lib/logger'
import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import type { SeedWithCount } from '@/lib/database.types'

export type SeedWithExchangeCount = SeedWithCount & { exchangeCount: number }

export async function fetchSeedsWithExchangeCounts(): Promise<SeedWithExchangeCount[]> {
  logger.info('Fetching seeds with exchange counts')
  const [seeds, phrases] = await Promise.all([fetchSeeds(), fetchAllPhrasesUnpaginated()])

  const answeredQuestionIds = new Set(
    phrases.filter((p) => p.question_id !== null).map((p) => p.question_id as string)
  )
  const exchangeCountsBySeed = new Map<string, number>()
  for (const p of phrases) {
    if (p.phrase_type === 'question' && answeredQuestionIds.has(p.id)) {
      exchangeCountsBySeed.set(p.seed_id, (exchangeCountsBySeed.get(p.seed_id) ?? 0) + 1)
    }
  }

  return seeds.map((seed) => ({ ...seed, exchangeCount: exchangeCountsBySeed.get(seed.id) ?? 0 }))
}
