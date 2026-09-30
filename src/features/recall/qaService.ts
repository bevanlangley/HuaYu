import { logger } from '@/lib/logger'
import { fetchSeeds } from '@/features/seeds/seedsService'
import type { SeedWithCount } from '@/lib/database.types'

export type SeedWithExchangeCount = SeedWithCount & { exchangeCount: number }

// Stub pending T3.1's real Exchange query, which needs Stage 1's phrase_type schema.
// Every seed reports 0 until then.
export async function fetchSeedsWithExchangeCounts(): Promise<SeedWithExchangeCount[]> {
  logger.info('Fetching seeds with exchange counts')
  const seeds = await fetchSeeds()
  return seeds.map((seed) => ({ ...seed, exchangeCount: 0 }))
}
