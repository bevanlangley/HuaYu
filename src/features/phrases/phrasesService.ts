import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Phrase } from '@/lib/database.types'
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

export async function createPhrase(
  seedId: string,
  values: PhraseFormData,
  questionId?: string
): Promise<Phrase> {
  logger.info('Creating phrase', { seedId })
  const { data, error } = await supabase
    .from('phrases')
    .insert({ seed_id: seedId, ...values, ...(questionId !== undefined && { question_id: questionId }) })
    .select()
    .single()

  if (error) {
    logger.error('Failed to create phrase', error)
    throw error
  }
  logger.info('Phrase created', { id: data.id })
  return data
}

// Retyping a Phrase needs no client-side follow-up: the database unlinks Answers when a Question
// stops being one and clears an Answer's own Link when it stops being an Answer (ADR 0003).
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

export async function fetchQuestionsBySeed(seedId: string): Promise<Phrase[]> {
  logger.info('Fetching questions for seed', { seedId })
  const { data, error } = await supabase
    .from('phrases')
    .select('*')
    .eq('seed_id', seedId)
    .eq('phrase_type', 'question')
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('Failed to fetch questions', error)
    throw error
  }
  logger.info('Questions fetched', { count: data?.length })
  return data ?? []
}

export async function attachAnswerToQuestion(
  answerId: string,
  questionId: string | null
): Promise<Phrase> {
  logger.info('Attaching answer to question', { answerId, questionId })
  const { data, error } = await supabase
    .from('phrases')
    .update({ question_id: questionId })
    .eq('id', answerId)
    .select()
    .single()

  if (error) {
    logger.error('Failed to attach answer to question', error)
    throw error
  }
  logger.info('Answer attached to question', { answerId, questionId })
  return data
}

// Shared wording for the delete/retype confirm dialogs that name a linked-answer count.
export function describeLinkedAnswerCount(count: number): string {
  return `${count} linked answer${count === 1 ? '' : 's'}`
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
