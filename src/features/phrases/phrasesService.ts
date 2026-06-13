import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Phrase, PhraseWithSeed } from '@/lib/database.types'
import type { z } from 'zod'
import type { phraseSchema } from '@/lib/schemas/phrases'

export type PhraseFormData = z.infer<typeof phraseSchema>

// PostgREST treats , ( ) as filter syntax; double-quoting the value keeps the
// user's search term literal. Quotes/backslashes inside must be backslash-escaped.
export function buildPhraseSearchFilter(term: string): string {
  const escaped = term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const value = `"%${escaped}%"`
  return ['mandarin', 'english', 'pinyin'].map(col => `${col}.ilike.${value}`).join(',')
}

export async function fetchPhrasesBySeed(seedId: string): Promise<Phrase[]> {
  logger.info('Fetching phrases for seed', { seedId })
  const { data, error } = await supabase
    .from('phrases')
    .select('*')
    .eq('seed_id', seedId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('Failed to fetch phrases', error)
    throw error
  }
  logger.info('Phrases fetched', { count: data?.length })
  return data ?? []
}

export async function fetchAllPhrases(opts: {
  search?: string
  page?: number
  pageSize?: number
}): Promise<{ phrases: PhraseWithSeed[]; total: number }> {
  const { search = '', page = 1, pageSize = 25 } = opts
  logger.info('Fetching all phrases', { search, page })

  let query = supabase
    .from('phrases')
    .select('*, seeds!phrases_seed_id_fkey(id, name, tag)', { count: 'exact' })
    .order('created_at', { ascending: true })

  if (search.trim()) {
    query = query.or(buildPhraseSearchFilter(search.trim()))
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    logger.error('Failed to fetch all phrases', error)
    throw error
  }
  logger.info('All phrases fetched', { count })
  return { phrases: (data ?? []) as PhraseWithSeed[], total: count ?? 0 }
}

export async function createPhrase(seedId: string, values: PhraseFormData): Promise<Phrase> {
  logger.info('Creating phrase', { seedId })
  const { data, error } = await supabase
    .from('phrases')
    .insert({ seed_id: seedId, ...values })
    .select()
    .single()

  if (error) {
    logger.error('Failed to create phrase', error)
    throw error
  }
  logger.info('Phrase created', { id: data.id })
  return data
}

export async function updatePhrase(id: string, values: PhraseFormData): Promise<Phrase> {
  logger.info('Updating phrase', { id })
  const { data, error } = await supabase
    .from('phrases')
    .update(values)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    logger.error('Failed to update phrase', error)
    throw error
  }
  logger.info('Phrase updated', { id })
  return data
}

export async function deletePhrase(id: string): Promise<void> {
  logger.info('Deleting phrase', { id })
  const { error } = await supabase.from('phrases').delete().eq('id', id)

  if (error) {
    logger.error('Failed to delete phrase', error)
    throw error
  }
  logger.info('Phrase deleted', { id })
}

export async function fetchAllPhrasesUnpaginated(): Promise<Phrase[]> {
  logger.info('Fetching all phrases unpaginated')
  const { data, error } = await supabase
    .from('phrases')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) {
    logger.error('Failed to fetch all phrases unpaginated', error)
    throw error
  }
  logger.info('All phrases fetched', { count: data?.length })
  return data ?? []
}
