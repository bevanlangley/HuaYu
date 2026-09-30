import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Phrase, Exchange } from '@/lib/database.types'
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

export async function updatePhrase(
  id: string,
  values: PhraseFormData,
  opts: { clearQuestionId?: boolean } = {}
): Promise<Phrase> {
  logger.info('Updating phrase', { id })
  const payload = opts.clearQuestionId ? { ...values, question_id: null } : values
  const { data, error } = await supabase
    .from('phrases')
    .update(payload)
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

// Orphans every Answer linked to this Question (their own rows are otherwise untouched).
// Used when a Question is retyped away from `question` while it still has linked Answers —
// unlike a delete, there's no FK cascade to rely on since the Question row itself survives.
export async function unlinkAnswersFromQuestion(questionId: string): Promise<void> {
  logger.info('Unlinking answers from question', { questionId })
  const { error } = await supabase
    .from('phrases')
    .update({ question_id: null })
    .eq('question_id', questionId)

  if (error) {
    logger.error('Failed to unlink answers from question', error)
    throw error
  }
  logger.info('Answers unlinked from question', { questionId })
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

// An Exchange is a Question with >=1 linked Answer. Statements and unpaired Questions/Answers
// never form one — a Question with zero Answers is filtered out, and an Answer's question_id
// only ever surfaces it as part of its Question's `answers`, never on its own.
function toExchanges(phrases: Phrase[]): Exchange[] {
  return phrases
    .filter((p) => p.phrase_type === 'question')
    .map((question) => ({
      question,
      answers: phrases.filter((p) => p.question_id === question.id),
    }))
    .filter((exchange) => exchange.answers.length > 0)
}

export async function fetchExchangesBySeed(seedId: string): Promise<Exchange[]> {
  logger.info('Fetching exchanges for seed', { seedId })
  const phrases = await fetchPhrasesBySeed(seedId)
  const exchanges = toExchanges(phrases)
  logger.info('Exchanges fetched', { seedId, count: exchanges.length })
  return exchanges
}

// Pools Exchanges across every Seed. Safe to match question_id by id alone (no seed_id
// scoping needed) because the composite FK guarantees an Answer's question_id can only ever
// point at a Question within its own Seed.
export async function fetchAllExchanges(): Promise<Exchange[]> {
  logger.info('Fetching exchanges across all seeds')
  const phrases = await fetchAllPhrasesUnpaginated()
  const exchanges = toExchanges(phrases)
  logger.info('Exchanges fetched', { count: exchanges.length })
  return exchanges
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

// A Question is unpaired when nothing points at it; an Answer is unpaired when it has no
// question_id. Statements never participate in pairing.
export function isPhraseUnpaired(phrase: Phrase, allPhrases: Phrase[]): boolean {
  if (phrase.phrase_type === 'question') {
    return !allPhrases.some(p => p.question_id === phrase.id)
  }
  if (phrase.phrase_type === 'answer') {
    return phrase.question_id === null
  }
  return false
}

export function countUnpaired(phrases: Phrase[]): number {
  return phrases.filter(p => isPhraseUnpaired(p, phrases)).length
}

export function countLinkedAnswers(questionId: string, allPhrases: Phrase[]): number {
  return allPhrases.filter(p => p.question_id === questionId).length
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
