import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Seed, SeedWithCount } from '@/lib/database.types'
import type { z } from 'zod'
import type { seedSchema } from '@/lib/schemas/seeds'

export type SeedFormData = z.infer<typeof seedSchema>

export function toSeedWithCount(row: Seed & { phrases: { count: number }[] }): SeedWithCount {
  const { phrases, ...seed } = row
  return { ...seed, phraseCount: phrases[0]?.count ?? 0 }
}

export async function fetchSeeds(): Promise<SeedWithCount[]> {
  logger.info('Fetching seeds')

  const { data, error } = await supabase
    .from('seeds')
    .select('*, phrases(count)')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Failed to fetch seeds', error)
    throw error
  }

  const seeds = (data ?? []).map(toSeedWithCount)
  logger.info('Seeds fetched', { count: seeds.length })
  return seeds
}

export async function fetchSeedById(id: string): Promise<Seed | null> {
  logger.info('Fetching seed', { id })
  const { data, error } = await supabase.from('seeds').select('*').eq('id', id).maybeSingle()

  if (error) {
    logger.error('Failed to fetch seed', error)
    throw error
  }
  logger.info('Seed fetched', { id, found: data !== null })
  return data
}

export async function createSeed(values: SeedFormData): Promise<Seed> {
  logger.info('Creating seed', { name: values.name })
  const { data, error } = await supabase
    .from('seeds')
    .insert({
      name: values.name,
      source_url: values.source_url || null,
      tag: values.tag || null,
    })
    .select()
    .single()

  if (error) {
    logger.error('Failed to create seed', error)
    throw error
  }
  logger.info('Seed created', { id: data.id })
  return data
}

export async function updateSeed(id: string, values: SeedFormData): Promise<Seed> {
  logger.info('Updating seed', { id })
  const { data, error } = await supabase
    .from('seeds')
    .update({
      name: values.name,
      source_url: values.source_url || null,
      tag: values.tag || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    logger.error('Failed to update seed', error)
    throw error
  }
  logger.info('Seed updated', { id })
  return data
}

export async function deleteSeed(id: string): Promise<void> {
  logger.info('Deleting seed', { id })
  const { error } = await supabase.from('seeds').delete().eq('id', id)

  if (error) {
    logger.error('Failed to delete seed', error)
    throw error
  }
  logger.info('Seed deleted', { id })
}

export function getUniqueTags(seeds: Seed[]): string[] {
  const tags = seeds.map(s => s.tag).filter((t): t is string => Boolean(t))
  return [...new Set(tags)].sort()
}
