import type { Phrase, PhraseType } from '@/lib/database.types'

export type LinkChange = { kind: 'delete' } | { kind: 'retype'; to: PhraseType }

// What a delete or retype does to *other* Phrases' Links (CONTEXT.md: Unlink). The database
// enforces the effect (ADR 0003); callers ask this to decide whether to confirm and refetch.
// Changes confined to the edited row — an Answer's own Link — return 0.
export function linkConsequence(
  phrase: Pick<Phrase, 'phrase_type'>,
  change: LinkChange,
  answerCount: number
): { unpairsAnswers: number } {
  const stopsBeingQuestion =
    phrase.phrase_type === 'question' && (change.kind === 'delete' || change.to !== 'question')
  return { unpairsAnswers: stopsBeingQuestion ? answerCount : 0 }
}
