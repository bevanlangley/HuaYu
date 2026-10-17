import { describe, it, expect } from 'vitest'
import { linkConsequence } from '@/features/phrases/linkConsequence'
import type { PhraseType } from '@/lib/database.types'

describe('linkConsequence', () => {
  const cases: Array<{
    name: string
    type: PhraseType
    change: Parameters<typeof linkConsequence>[1]
    answerCount: number
    unpairsAnswers: number
  }> = [
    { name: 'deleting a Question with 2 Answers unlinks 2', type: 'question', change: { kind: 'delete' }, answerCount: 2, unpairsAnswers: 2 },
    { name: 'deleting an unpaired Question unlinks none', type: 'question', change: { kind: 'delete' }, answerCount: 0, unpairsAnswers: 0 },
    { name: 'deleting an Answer unlinks none', type: 'answer', change: { kind: 'delete' }, answerCount: 0, unpairsAnswers: 0 },
    { name: 'deleting a Statement unlinks none', type: 'statement', change: { kind: 'delete' }, answerCount: 0, unpairsAnswers: 0 },
    { name: 'retyping a Question with 3 Answers to Statement unlinks 3', type: 'question', change: { kind: 'retype', to: 'statement' }, answerCount: 3, unpairsAnswers: 3 },
    { name: 'retyping a Question with Answers to Answer unlinks them', type: 'question', change: { kind: 'retype', to: 'answer' }, answerCount: 1, unpairsAnswers: 1 },
    { name: 'retyping an unpaired Question unlinks none', type: 'question', change: { kind: 'retype', to: 'statement' }, answerCount: 0, unpairsAnswers: 0 },
    { name: 'keeping a Question a Question unlinks none', type: 'question', change: { kind: 'retype', to: 'question' }, answerCount: 2, unpairsAnswers: 0 },
    { name: 'retyping an Answer affects only its own row', type: 'answer', change: { kind: 'retype', to: 'statement' }, answerCount: 0, unpairsAnswers: 0 },
    { name: 'retyping a Statement unlinks none', type: 'statement', change: { kind: 'retype', to: 'question' }, answerCount: 0, unpairsAnswers: 0 },
  ]

  it.each(cases)('$name', ({ type, change, answerCount, unpairsAnswers }) => {
    expect(linkConsequence({ phrase_type: type }, change, answerCount)).toEqual({ unpairsAnswers })
  })
})
