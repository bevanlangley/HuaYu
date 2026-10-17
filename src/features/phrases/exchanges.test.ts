import { describe, it, expect } from 'vitest'
import { buildExchangeIndex, groupPhrases, paginateGroups } from './exchanges'
import type { Phrase, PhraseGroup } from '@/lib/database.types'

function makePhrase(overrides: Partial<Phrase> = {}): Phrase {
  return {
    id: 'p1',
    seed_id: 's1',
    mandarin: '你好',
    pinyin: 'nǐ hǎo',
    english: 'Hello',
    phrase_type: 'statement',
    question_id: null,
    created_at: '2024-01-01',
    ...overrides,
  }
}

const question = (id: string, overrides: Partial<Phrase> = {}) =>
  makePhrase({ id, phrase_type: 'question', ...overrides })
const answer = (id: string, questionId: string | null, overrides: Partial<Phrase> = {}) =>
  makePhrase({ id, phrase_type: 'answer', question_id: questionId, ...overrides })
const statement = (id: string, overrides: Partial<Phrase> = {}) =>
  makePhrase({ id, phrase_type: 'statement', ...overrides })

describe('buildExchangeIndex — groups', () => {
  it('emits every phrase as a standalone group when none are linked', () => {
    const s1 = statement('s1')
    const s2 = statement('s2')

    expect(buildExchangeIndex([s1, s2]).groups).toEqual([
      { kind: 'standalone', phrase: s1 },
      { kind: 'standalone', phrase: s2 },
    ])
  })

  it('groups a Question with all of its linked Answers, in their own input order', () => {
    const q1 = question('q1')
    const a1 = answer('a1', 'q1')
    const a2 = answer('a2', 'q1')
    const a3 = answer('a3', 'q1')

    expect(buildExchangeIndex([q1, a1, a2, a3]).groups).toEqual([
      { kind: 'exchange', question: q1, answers: [a1, a2, a3] },
    ])
  })

  it('moves an Answer created before its Question to sit after it once linked', () => {
    const a1 = answer('a1', 'q1')
    const q1 = question('q1')

    expect(buildExchangeIndex([a1, q1]).groups).toEqual([
      { kind: 'exchange', question: q1, answers: [a1] },
    ])
  })

  it('emits an unpaired Question (zero Answers) as standalone, not an empty exchange', () => {
    const q1 = question('q1')

    expect(buildExchangeIndex([q1]).groups).toEqual([{ kind: 'standalone', phrase: q1 }])
  })

  it('emits an unpaired Answer (no question_id) as standalone', () => {
    const a1 = answer('a1', null)

    expect(buildExchangeIndex([a1]).groups).toEqual([{ kind: 'standalone', phrase: a1 }])
  })

  it('interleaves Exchanges and standalone phrases in their original order', () => {
    const s1 = statement('s1')
    const q1 = question('q1')
    const qUnpaired = question('q2')
    const a1 = answer('a1', 'q1')
    const aUnpaired = answer('a2', null)
    const s2 = statement('s2')

    expect(buildExchangeIndex([s1, q1, qUnpaired, a1, aUnpaired, s2]).groups).toEqual([
      { kind: 'standalone', phrase: s1 },
      { kind: 'exchange', question: q1, answers: [a1] },
      { kind: 'standalone', phrase: qUnpaired },
      { kind: 'standalone', phrase: aUnpaired },
      { kind: 'standalone', phrase: s2 },
    ])
  })

  it('shows a Statement holding a stale question_id exactly once, standalone, outside the Exchange', () => {
    const q1 = question('q1')
    const a1 = answer('a1', 'q1')
    const stale = statement('s1', { question_id: 'q1' })

    expect(buildExchangeIndex([q1, a1, stale]).groups).toEqual([
      { kind: 'exchange', question: q1, answers: [a1] },
      { kind: 'standalone', phrase: stale },
    ])
  })

  it.each([
    ['a Statement', [statement('target')]],
    ['an Answer', [answer('target', null)]],
    ['a missing row', []],
  ])('keeps an Answer whose question_id points at %s visible as standalone', (_, others) => {
    const dangling = answer('a1', 'target')

    expect(buildExchangeIndex([...others, dangling]).groups).toContainEqual({
      kind: 'standalone',
      phrase: dangling,
    })
  })
})

describe('buildExchangeIndex — exchanges', () => {
  it('returns only Questions with at least one linked Answer, Answers in input order', () => {
    const q1 = question('q1')
    const a1 = answer('a1', 'q1')
    const qUnpaired = question('q2')
    const q3 = question('q3')
    const a3a = answer('a3a', 'q3')
    const a3b = answer('a3b', 'q3')
    const s1 = statement('s1')

    expect(buildExchangeIndex([q1, a1, qUnpaired, q3, a3a, s1, a3b]).exchanges).toEqual([
      { question: q1, answers: [a1] },
      { question: q3, answers: [a3a, a3b] },
    ])
  })

  it('excludes a non-Answer holding a question_id from the Exchange', () => {
    const q1 = question('q1')
    const stale = statement('s1', { question_id: 'q1' })

    expect(buildExchangeIndex([q1, stale]).exchanges).toEqual([])
  })

  it('returns an empty list when there are no complete Exchanges', () => {
    expect(buildExchangeIndex([question('q1'), answer('a1', null)]).exchanges).toEqual([])
  })
})

describe('buildExchangeIndex — unpaired', () => {
  it.each([
    ['a Question with no linked Answers', [question('x')], true],
    ['a Question with a linked Answer', [question('x'), answer('a1', 'x')], false],
    ['a Question only a Statement points at', [question('x'), statement('s1', { question_id: 'x' })], true],
    ['an Answer with no question_id', [answer('x', null)], true],
    ['an Answer linked to a Question', [question('q1'), answer('x', 'q1')], false],
    ['an Answer pointing at a Statement', [statement('s1'), answer('x', 's1')], true],
    ['an Answer pointing at a missing row', [answer('x', 'gone')], true],
    ['a Statement', [statement('x')], false],
    ['a Statement holding a stale question_id', [question('q1'), statement('x', { question_id: 'q1' })], false],
  ])('isUnpaired is correct for %s', (_, phrases, expected) => {
    expect(buildExchangeIndex(phrases).isUnpaired('x')).toBe(expected)
  })

  it('counts unpaired Questions and Answers, ignoring Statements', () => {
    const phrases = [
      question('q1'), // unpaired
      question('q2'),
      answer('a1', 'q2'),
      answer('a2', null), // unpaired
      answer('a3', 's1'), // unpaired — points at a Statement
      statement('s1'),
    ]
    expect(buildExchangeIndex(phrases).unpairedCount).toBe(3)
  })

  it('counts 0 for an empty list', () => {
    expect(buildExchangeIndex([]).unpairedCount).toBe(0)
  })
})

describe('buildExchangeIndex — answerCount', () => {
  it('counts only Answers linked to the Question', () => {
    const phrases = [
      question('q1'),
      answer('a1', 'q1'),
      answer('a2', 'q1'),
      answer('a3', 'q-other'),
      statement('s1', { question_id: 'q1' }),
    ]
    expect(buildExchangeIndex(phrases).answerCount('q1')).toBe(2)
  })

  it.each([
    ['an unpaired Question', [question('q1')]],
    ['an id not in the list', []],
  ])('is 0 for %s', (_, phrases) => {
    expect(buildExchangeIndex(phrases).answerCount('q1')).toBe(0)
  })
})

describe('buildExchangeIndex — exchangeCountBySeed', () => {
  it('counts complete Exchanges per Seed, a multi-Answer Question once', () => {
    const phrases = [
      question('q1', { seed_id: 's1' }),
      answer('a1', 'q1', { seed_id: 's1' }),
      question('q1b', { seed_id: 's1' }),
      answer('a1b', 'q1b', { seed_id: 's1' }),
      answer('a1c', 'q1b', { seed_id: 's1' }),
      question('q2', { seed_id: 's2' }), // unpaired
      statement('st', { seed_id: 's2' }),
      question('q3', { seed_id: 's3' }),
      answer('a3', 'q3', { seed_id: 's3' }),
    ]
    const { exchangeCountBySeed } = buildExchangeIndex(phrases)

    expect(exchangeCountBySeed.get('s1')).toBe(2)
    expect(exchangeCountBySeed.get('s2')).toBeUndefined()
    expect(exchangeCountBySeed.get('s3')).toBe(1)
  })
})

describe('groupPhrases', () => {
  it('returns the Question followed by its Answers for an Exchange', () => {
    const q = question('q1')
    const answers = [answer('a1', 'q1'), answer('a2', 'q1')]

    expect(groupPhrases({ kind: 'exchange', question: q, answers })).toEqual([q, ...answers])
  })

  it('returns the lone Phrase for a standalone group', () => {
    const st = statement('p1')

    expect(groupPhrases({ kind: 'standalone', phrase: st })).toEqual([st])
  })
})

describe('paginateGroups', () => {
  const standalones = (...ids: string[]): PhraseGroup[] =>
    ids.map((id) => ({ kind: 'standalone' as const, phrase: statement(id) }))
  const exchangeWith = (answerCount: number): PhraseGroup => ({
    kind: 'exchange',
    question: question('q1'),
    answers: Array.from({ length: answerCount }, (_, i) => answer(`a${i}`, 'q1')),
  })

  it('returns one page when the total row count is under the page size', () => {
    const groups = standalones('p1', 'p2', 'p3')

    expect(paginateGroups(groups, 1, 10)).toEqual({ pageGroups: groups, totalPages: 1 })
  })

  it('moves an Exchange whole to the next page rather than splitting it at the boundary', () => {
    const leading = standalones('p1', 'p2', 'p3', 'p4')
    const exchange = exchangeWith(2) // 4 standalone rows + 3 exchange rows = 7 rows
    const groups = [...leading, exchange]

    expect(paginateGroups(groups, 1, 5)).toEqual({ pageGroups: leading, totalPages: 2 })
    expect(paginateGroups(groups, 2, 5)).toEqual({ pageGroups: [exchange], totalPages: 2 })
  })

  it('keeps an Exchange larger than a full page alone on its own page', () => {
    const bigExchange = exchangeWith(6) // 7 rows, bigger than the page size of 5
    const trailing = standalones('p1')
    const groups = [bigExchange, ...trailing]

    expect(paginateGroups(groups, 1, 5)).toEqual({ pageGroups: [bigExchange], totalPages: 2 })
    expect(paginateGroups(groups, 2, 5)).toEqual({ pageGroups: trailing, totalPages: 2 })
  })

  it('reports one empty page for an empty list', () => {
    expect(paginateGroups([], 1, 5)).toEqual({ pageGroups: [], totalPages: 1 })
  })
})
