import { logger } from '@/lib/logger'
import { fetchSeeds } from '@/features/seeds/seedsService'
import { fetchAllPhrasesUnpaginated } from '@/features/phrases/phrasesService'
import { buildExchangeIndex } from '@/features/phrases/exchanges'
import type { SeedWithCount } from '@/lib/database.types'

export type SeedWithExchangeCount = SeedWithCount & { exchangeCount: number }

export async function fetchSeedsWithExchangeCounts(): Promise<SeedWithExchangeCount[]> {
  logger.info('Fetching seeds with exchange counts')
  const [seeds, phrases] = await Promise.all([fetchSeeds(), fetchAllPhrasesUnpaginated()])
  const { exchangeCountBySeed } = buildExchangeIndex(phrases)

  return seeds.map((seed) => ({ ...seed, exchangeCount: exchangeCountBySeed.get(seed.id) ?? 0 }))
}
