import type { Exchange, Phrase, PhraseGroup } from '@/lib/database.types'

// Everything derived from the Exchange rule (CONTEXT.md: Exchange, Unpaired, Standalone Phrase),
// computed from one pass over a Phrase list. Pure — no Supabase, no React.
export interface ExchangeIndex {
  // Exchange-aware order: each Question with its linked Answers, every other Phrase standalone,
  // all in input order (ADR 0002).
  groups: PhraseGroup[]
  // Complete Exchanges only (a Question with >=1 linked Answer), in Question input order.
  exchanges: Exchange[]
  // Unpaired: a Question with no linked Answers, or an Answer not linked to a Question.
  // Statements are never unpaired.
  isUnpaired: (phraseId: string) => boolean
  unpairedCount: number
  // Answers linked to a Question; 0 for an unpaired Question or an unknown id.
  answerCount: (questionId: string) => number
  // Complete Exchanges per seed_id; a Seed with none is absent.
  exchangeCountBySeed: ReadonlyMap<string, number>
}

// Only an Answer can be linked, and only to a Question present in the same input. The database
// guarantees every Link runs from an Answer to a Question (ADR 0003); the presence check remains
// because a partial or filtered Phrase list can hold an Answer whose Question isn't in it.
function buildAnswersByQuestionId(phrases: Phrase[]): Map<string, Phrase[]> {
  const answersByQuestionId = new Map<string, Phrase[]>()
  for (const p of phrases) {
    if (p.phrase_type === 'question') answersByQuestionId.set(p.id, [])
  }
  for (const p of phrases) {
    if (p.phrase_type !== 'answer' || p.question_id === null) continue
    answersByQuestionId.get(p.question_id)?.push(p)
  }
  return answersByQuestionId
}

function isLinkedAnswer(phrase: Phrase, answersByQuestionId: Map<string, Phrase[]>): boolean {
  return (
    phrase.phrase_type === 'answer' &&
    phrase.question_id !== null &&
    answersByQuestionId.has(phrase.question_id)
  )
}

// A linked Answer is skipped at its own position and emitted inside its Question's group instead —
// so an Answer created before its Question moves to sit after it.
function buildGroups(phrases: Phrase[], answersByQuestionId: Map<string, Phrase[]>): PhraseGroup[] {
  const groups: PhraseGroup[] = []
  for (const phrase of phrases) {
    if (isLinkedAnswer(phrase, answersByQuestionId)) continue
    const answers = phrase.phrase_type === 'question' ? answersByQuestionId.get(phrase.id) ?? [] : []
    groups.push(
      answers.length > 0
        ? { kind: 'exchange', question: phrase, answers }
        : { kind: 'standalone', phrase }
    )
  }
  return groups
}

function buildUnpairedIds(phrases: Phrase[], answersByQuestionId: Map<string, Phrase[]>): Set<string> {
  const unpairedIds = new Set<string>()
  for (const p of phrases) {
    const unpaired =
      p.phrase_type === 'question'
        ? answersByQuestionId.get(p.id)?.length === 0
        : p.phrase_type === 'answer' && !isLinkedAnswer(p, answersByQuestionId)
    if (unpaired) unpairedIds.add(p.id)
  }
  return unpairedIds
}

function countBySeed(exchanges: Exchange[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { question } of exchanges) {
    counts.set(question.seed_id, (counts.get(question.seed_id) ?? 0) + 1)
  }
  return counts
}

export function buildExchangeIndex(phrases: Phrase[]): ExchangeIndex {
  const answersByQuestionId = buildAnswersByQuestionId(phrases)
  const groups = buildGroups(phrases, answersByQuestionId)
  const unpairedIds = buildUnpairedIds(phrases, answersByQuestionId)
  const exchanges = groups.flatMap((g) =>
    g.kind === 'exchange' ? [{ question: g.question, answers: g.answers }] : []
  )
  return {
    groups,
    exchanges,
    isUnpaired: (phraseId) => unpairedIds.has(phraseId),
    unpairedCount: unpairedIds.size,
    answerCount: (questionId) => answersByQuestionId.get(questionId)?.length ?? 0,
    exchangeCountBySeed: countBySeed(exchanges),
  }
}

function groupRowCount(group: PhraseGroup): number {
  return group.kind === 'exchange' ? 1 + group.answers.length : 1
}

// Walks groups accumulating toward `pageSize` rows, closing the current page once the next group
// would push it over — unless the current page is still empty, in which case that group (however
// large) takes the page alone rather than splitting it. A page's row count can therefore land
// slightly above or below `pageSize`, but a group is never split across two pages.
function splitIntoPages(groups: PhraseGroup[], pageSize: number): PhraseGroup[][] {
  const pages: PhraseGroup[][] = []
  let currentPage: PhraseGroup[] = []
  let currentRowCount = 0

  for (const group of groups) {
    const rows = groupRowCount(group)
    if (currentPage.length > 0 && currentRowCount + rows > pageSize) {
      pages.push(currentPage)
      currentPage = []
      currentRowCount = 0
    }
    currentPage.push(group)
    currentRowCount += rows
  }
  if (currentPage.length > 0) pages.push(currentPage)
  return pages
}

export function paginateGroups(
  groups: PhraseGroup[],
  page: number,
  pageSize: number
): { pageGroups: PhraseGroup[]; totalPages: number } {
  const pages = splitIntoPages(groups, pageSize)
  return { pageGroups: pages[page - 1] ?? [], totalPages: Math.max(1, pages.length) }
}
