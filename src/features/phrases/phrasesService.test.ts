import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildPhraseSearchFilter,
  fetchAllPhrasesUnpaginated,
  fetchQuestionsBySeed,
  fetchExchangesBySeed,
  fetchAllExchanges,
  attachAnswerToQuestion,
  isPhraseUnpaired,
  countUnpaired,
  countLinkedAnswers,
  createPhrase,
  updatePhrase,
  unlinkAnswersFromQuestion,
  groupPhrasesByExchange,
  paginateGroups,
} from './phrasesService'
import type { Phrase, PhraseGroup } from '@/lib/database.types'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { supabase } from '@/lib/supabase'

const mockPhrases = [
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', phrase_type: 'statement' as const, created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', phrase_type: 'statement' as const, created_at: '2024-01-02' },
]

describe('buildPhraseSearchFilter', () => {
  it('builds an or-filter across mandarin, english, and pinyin with quoted values', () => {
    expect(buildPhraseSearchFilter('hello')).toBe(
      'mandarin.ilike."%hello%",english.ilike."%hello%",pinyin.ilike."%hello%"'
    )
  })

  it('keeps commas inside the quoted value instead of splitting the filter', () => {
    expect(buildPhraseSearchFilter('你好, 再見')).toBe(
      'mandarin.ilike."%你好, 再見%",english.ilike."%你好, 再見%",pinyin.ilike."%你好, 再見%"'
    )
  })

  it('keeps parentheses inside the quoted value', () => {
    expect(buildPhraseSearchFilter('ni(hao)')).toBe(
      'mandarin.ilike."%ni(hao)%",english.ilike."%ni(hao)%",pinyin.ilike."%ni(hao)%"'
    )
  })

  it('escapes double quotes in the search term', () => {
    expect(buildPhraseSearchFilter('say "hi"')).toBe(
      'mandarin.ilike."%say \\"hi\\"%",english.ilike."%say \\"hi\\"%",pinyin.ilike."%say \\"hi\\"%"'
    )
  })

  it('escapes backslashes in the search term', () => {
    expect(buildPhraseSearchFilter('a\\b')).toBe(
      'mandarin.ilike."%a\\\\b%",english.ilike."%a\\\\b%",pinyin.ilike."%a\\\\b%"'
    )
  })
})

describe('fetchAllPhrasesUnpaginated', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all phrases ordered by created_at asc', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: mockPhrases, error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    const result = await fetchAllPhrasesUnpaginated()

    expect(supabase.from).toHaveBeenCalledWith('phrases')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toEqual(mockPhrases)
  })

  it('throws when supabase errors', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    await expect(fetchAllPhrasesUnpaginated()).rejects.toMatchObject({ message: 'DB error' })
  })
})

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

describe('createPhrase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts without question_id when none is passed', async () => {
    const created = makePhrase({ id: 'new' })
    const mockSingle = vi.fn().mockResolvedValue({ data: created, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    await createPhrase('s1', { mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', phrase_type: 'statement' })

    expect(mockInsert).toHaveBeenCalledWith({
      seed_id: 's1',
      mandarin: '你好',
      pinyin: 'nǐ hǎo',
      english: 'Hello',
      phrase_type: 'statement',
    })
  })

  it('inserts with question_id when passed, for chained answer authoring', async () => {
    const created = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1' })
    const mockSingle = vi.fn().mockResolvedValue({ data: created, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    await createPhrase(
      's1',
      { mandarin: '我很好', pinyin: 'wǒ hěn hǎo', english: "I'm well", phrase_type: 'answer' },
      'q1'
    )

    expect(mockInsert).toHaveBeenCalledWith({
      seed_id: 's1',
      mandarin: '我很好',
      pinyin: 'wǒ hěn hǎo',
      english: "I'm well",
      phrase_type: 'answer',
      question_id: 'q1',
    })
  })

  it('throws when supabase errors', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any)

    await expect(
      createPhrase('s1', { mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', phrase_type: 'statement' })
    ).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('fetchQuestionsBySeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches only question-typed phrases for the seed, ordered by created_at asc', async () => {
    const questions = [makePhrase({ id: 'q1', phrase_type: 'question' })]
    const mockOrder = vi.fn().mockResolvedValue({ data: questions, error: null })
    const mockEqType = vi.fn().mockReturnValue({ order: mockOrder })
    const mockEqSeed = vi.fn().mockReturnValue({ eq: mockEqType })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSeed })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    const result = await fetchQuestionsBySeed('s1')

    expect(supabase.from).toHaveBeenCalledWith('phrases')
    expect(mockEqSeed).toHaveBeenCalledWith('seed_id', 's1')
    expect(mockEqType).toHaveBeenCalledWith('phrase_type', 'question')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toEqual(questions)
  })

  it('throws when supabase errors', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockEqType = vi.fn().mockReturnValue({ order: mockOrder })
    const mockEqSeed = vi.fn().mockReturnValue({ eq: mockEqType })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSeed })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    await expect(fetchQuestionsBySeed('s1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('fetchExchangesBySeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns only questions with at least one linked answer, answers ordered created_at asc', async () => {
    const q1 = makePhrase({ id: 'q1', phrase_type: 'question', created_at: '2024-01-01' }) // unpaired, excluded
    const q2 = makePhrase({ id: 'q2', phrase_type: 'question', created_at: '2024-01-02' })
    const a1 = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q2', created_at: '2024-01-03' })
    const a2 = makePhrase({ id: 'a2', phrase_type: 'answer', question_id: 'q2', created_at: '2024-01-04' })
    const a3 = makePhrase({ id: 'a3', phrase_type: 'answer', question_id: null, created_at: '2024-01-05' }) // unpaired
    const s1 = makePhrase({ id: 's1', phrase_type: 'statement', created_at: '2024-01-06' })
    const phrases = [q1, q2, a1, a2, a3, s1]

    const mockOrder = vi.fn().mockResolvedValue({ data: phrases, error: null })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    const result = await fetchExchangesBySeed('s1')

    expect(supabase.from).toHaveBeenCalledWith('phrases')
    expect(mockEq).toHaveBeenCalledWith('seed_id', 's1')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toEqual([{ question: q2, answers: [a1, a2] }])
  })

  it('returns an empty array when the seed has no complete exchanges', async () => {
    const phrases = [
      makePhrase({ id: 'q1', phrase_type: 'question' }),
      makePhrase({ id: 's1', phrase_type: 'statement' }),
    ]
    const mockOrder = vi.fn().mockResolvedValue({ data: phrases, error: null })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    expect(await fetchExchangesBySeed('s1')).toEqual([])
  })

  it('throws when supabase errors', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    await expect(fetchExchangesBySeed('s1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('fetchAllExchanges', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pools exchanges across every seed, answers ordered created_at asc', async () => {
    const q1 = makePhrase({ id: 'q1', seed_id: 's1', phrase_type: 'question', created_at: '2024-01-01' }) // unpaired, excluded
    const q2 = makePhrase({ id: 'q2', seed_id: 's1', phrase_type: 'question', created_at: '2024-01-02' })
    const a1 = makePhrase({ id: 'a1', seed_id: 's1', phrase_type: 'answer', question_id: 'q2', created_at: '2024-01-03' })
    const q3 = makePhrase({ id: 'q3', seed_id: 's2', phrase_type: 'question', created_at: '2024-01-04' })
    const a2 = makePhrase({ id: 'a2', seed_id: 's2', phrase_type: 'answer', question_id: 'q3', created_at: '2024-01-05' })
    const a3 = makePhrase({ id: 'a3', seed_id: 's2', phrase_type: 'answer', question_id: 'q3', created_at: '2024-01-06' })
    const s1statement = makePhrase({ id: 's1p', seed_id: 's2', phrase_type: 'statement', created_at: '2024-01-07' })
    const phrases = [q1, q2, a1, q3, a2, a3, s1statement]

    const mockOrder = vi.fn().mockResolvedValue({ data: phrases, error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    const result = await fetchAllExchanges()

    expect(supabase.from).toHaveBeenCalledWith('phrases')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toEqual([
      { question: q2, answers: [a1] },
      { question: q3, answers: [a2, a3] },
    ])
  })

  it('returns an empty array when there are no complete exchanges anywhere', async () => {
    const phrases = [
      makePhrase({ id: 'q1', phrase_type: 'question' }),
      makePhrase({ id: 's1', phrase_type: 'statement' }),
    ]
    const mockOrder = vi.fn().mockResolvedValue({ data: phrases, error: null })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    expect(await fetchAllExchanges()).toEqual([])
  })

  it('throws when supabase errors', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    await expect(fetchAllExchanges()).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('attachAnswerToQuestion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets question_id on the answer when linking', async () => {
    const updated = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1' })
    const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    const result = await attachAnswerToQuestion('a1', 'q1')

    expect(supabase.from).toHaveBeenCalledWith('phrases')
    expect(mockUpdate).toHaveBeenCalledWith({ question_id: 'q1' })
    expect(mockEq).toHaveBeenCalledWith('id', 'a1')
    expect(result).toEqual(updated)
  })

  it('clears question_id when passed null', async () => {
    const updated = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: null })
    const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await attachAnswerToQuestion('a1', null)

    expect(mockUpdate).toHaveBeenCalledWith({ question_id: null })
  })

  it('throws when supabase errors (e.g. cross-seed link rejected by the FK)', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'FK violation' } })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await expect(attachAnswerToQuestion('a1', 'q-other-seed')).rejects.toMatchObject({ message: 'FK violation' })
  })
})

describe('updatePhrase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates without touching question_id by default', async () => {
    const updated = makePhrase({ id: 'p1', phrase_type: 'statement' })
    const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    const values = { mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', phrase_type: 'statement' as const }
    await updatePhrase('p1', values)

    expect(mockUpdate).toHaveBeenCalledWith(values)
    expect(mockEq).toHaveBeenCalledWith('id', 'p1')
  })

  it('clears question_id when clearQuestionId is passed, for an Answer retyped away', async () => {
    const updated = makePhrase({ id: 'a1', phrase_type: 'statement', question_id: null })
    const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    const values = { mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', phrase_type: 'statement' as const }
    await updatePhrase('a1', values, { clearQuestionId: true })

    expect(mockUpdate).toHaveBeenCalledWith({ ...values, question_id: null })
  })

  it('throws when supabase errors', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await expect(
      updatePhrase('p1', { mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', phrase_type: 'statement' })
    ).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('unlinkAnswersFromQuestion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nulls question_id on every phrase pointing at the question', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await unlinkAnswersFromQuestion('q1')

    expect(supabase.from).toHaveBeenCalledWith('phrases')
    expect(mockUpdate).toHaveBeenCalledWith({ question_id: null })
    expect(mockEq).toHaveBeenCalledWith('question_id', 'q1')
  })

  it('throws when supabase errors', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'DB error' } })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any)

    await expect(unlinkAnswersFromQuestion('q1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('countLinkedAnswers', () => {
  it('counts answers whose question_id points at the given question', () => {
    const phrases = [
      makePhrase({ id: 'q1', phrase_type: 'question' }),
      makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1' }),
      makePhrase({ id: 'a2', phrase_type: 'answer', question_id: 'q1' }),
      makePhrase({ id: 'a3', phrase_type: 'answer', question_id: 'q-other' }),
    ]
    expect(countLinkedAnswers('q1', phrases)).toBe(2)
  })

  it('returns 0 when nothing points at the question', () => {
    const phrases = [makePhrase({ id: 'q1', phrase_type: 'question' })]
    expect(countLinkedAnswers('q1', phrases)).toBe(0)
  })
})

describe('isPhraseUnpaired', () => {
  it('is true for a question with no answers pointing at it', () => {
    const question = makePhrase({ id: 'q1', phrase_type: 'question' })
    expect(isPhraseUnpaired(question, [question])).toBe(true)
  })

  it('is false for a question with at least one linked answer', () => {
    const question = makePhrase({ id: 'q1', phrase_type: 'question' })
    const answer = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1' })
    expect(isPhraseUnpaired(question, [question, answer])).toBe(false)
  })

  it('is true for an answer with no question_id', () => {
    const answer = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: null })
    expect(isPhraseUnpaired(answer, [answer])).toBe(true)
  })

  it('is false for an answer with a question_id set', () => {
    const answer = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1' })
    expect(isPhraseUnpaired(answer, [answer])).toBe(false)
  })

  it('is always false for a statement', () => {
    const statement = makePhrase({ id: 's1', phrase_type: 'statement' })
    expect(isPhraseUnpaired(statement, [statement])).toBe(false)
  })
})

describe('countUnpaired', () => {
  it('counts unpaired questions and answers, ignoring statements', () => {
    const phrases = [
      makePhrase({ id: 'q1', phrase_type: 'question' }), // unpaired
      makePhrase({ id: 'q2', phrase_type: 'question' }),
      makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q2' }), // paired
      makePhrase({ id: 'a2', phrase_type: 'answer', question_id: null }), // unpaired
      makePhrase({ id: 's1', phrase_type: 'statement' }),
    ]
    expect(countUnpaired(phrases)).toBe(2)
  })

  it('returns 0 when every question and answer is paired', () => {
    const phrases = [
      makePhrase({ id: 'q1', phrase_type: 'question' }),
      makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1' }),
    ]
    expect(countUnpaired(phrases)).toBe(0)
  })

  it('returns 0 for an empty list', () => {
    expect(countUnpaired([])).toBe(0)
  })
})

describe('groupPhrasesByExchange', () => {
  it('emits every phrase as a single group when none are linked', () => {
    const s1 = makePhrase({ id: 's1', phrase_type: 'statement', created_at: '2024-01-01' })
    const s2 = makePhrase({ id: 's2', phrase_type: 'statement', created_at: '2024-01-02' })

    expect(groupPhrasesByExchange([s1, s2])).toEqual([
      { kind: 'single', phrase: s1 },
      { kind: 'single', phrase: s2 },
    ])
  })

  it('groups a Question with its one linked Answer', () => {
    const q1 = makePhrase({ id: 'q1', phrase_type: 'question', created_at: '2024-01-01' })
    const a1 = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1', created_at: '2024-01-02' })

    expect(groupPhrasesByExchange([q1, a1])).toEqual([
      { kind: 'exchange', question: q1, answers: [a1] },
    ])
  })

  it('groups a Question with all three of its linked Answers, in their own created_at order', () => {
    const q1 = makePhrase({ id: 'q1', phrase_type: 'question', created_at: '2024-01-01' })
    const a1 = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1', created_at: '2024-01-02' })
    const a2 = makePhrase({ id: 'a2', phrase_type: 'answer', question_id: 'q1', created_at: '2024-01-03' })
    const a3 = makePhrase({ id: 'a3', phrase_type: 'answer', question_id: 'q1', created_at: '2024-01-04' })

    expect(groupPhrasesByExchange([q1, a1, a2, a3])).toEqual([
      { kind: 'exchange', question: q1, answers: [a1, a2, a3] },
    ])
  })

  it('moves an Answer created before its Question to sit after it once linked', () => {
    const a1 = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1', created_at: '2024-01-01' })
    const q1 = makePhrase({ id: 'q1', phrase_type: 'question', created_at: '2024-01-02' })

    expect(groupPhrasesByExchange([a1, q1])).toEqual([
      { kind: 'exchange', question: q1, answers: [a1] },
    ])
  })

  it('emits an unpaired Question (zero Answers) as a single, not an empty exchange', () => {
    const q1 = makePhrase({ id: 'q1', phrase_type: 'question', created_at: '2024-01-01' })

    expect(groupPhrasesByExchange([q1])).toEqual([{ kind: 'single', phrase: q1 }])
  })

  it('emits an unpaired Answer (no question_id) as a single', () => {
    const a1 = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: null, created_at: '2024-01-01' })

    expect(groupPhrasesByExchange([a1])).toEqual([{ kind: 'single', phrase: a1 }])
  })

  it('interleaves Exchanges and standalone phrases in their original order', () => {
    const s1 = makePhrase({ id: 's1', phrase_type: 'statement', created_at: '2024-01-01' })
    const q1 = makePhrase({ id: 'q1', phrase_type: 'question', created_at: '2024-01-02' })
    const qUnpaired = makePhrase({ id: 'q2', phrase_type: 'question', created_at: '2024-01-03' })
    const a1 = makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1', created_at: '2024-01-04' })
    const aUnpaired = makePhrase({ id: 'a2', phrase_type: 'answer', question_id: null, created_at: '2024-01-05' })
    const s2 = makePhrase({ id: 's2', phrase_type: 'statement', created_at: '2024-01-06' })
    const phrases = [s1, q1, qUnpaired, a1, aUnpaired, s2]

    expect(groupPhrasesByExchange(phrases)).toEqual([
      { kind: 'single', phrase: s1 },
      { kind: 'exchange', question: q1, answers: [a1] },
      { kind: 'single', phrase: qUnpaired },
      { kind: 'single', phrase: aUnpaired },
      { kind: 'single', phrase: s2 },
    ])
  })
})

describe('paginateGroups', () => {
  it('returns one page when the total row count is under the page size', () => {
    const groups: PhraseGroup[] = [
      makePhrase({ id: 'p1' }),
      makePhrase({ id: 'p2' }),
      makePhrase({ id: 'p3' }),
    ].map((phrase) => ({ kind: 'single' as const, phrase }))

    const result = paginateGroups(groups, 1, 10)

    expect(result).toEqual({ pageGroups: groups, totalPages: 1 })
  })

  it('moves an Exchange whole to the next page rather than splitting it at the boundary', () => {
    const singles = [
      makePhrase({ id: 'p1' }),
      makePhrase({ id: 'p2' }),
      makePhrase({ id: 'p3' }),
      makePhrase({ id: 'p4' }),
    ].map((phrase) => ({ kind: 'single' as const, phrase }))
    const question = makePhrase({ id: 'q1', phrase_type: 'question' })
    const exchange = {
      kind: 'exchange' as const,
      question,
      answers: [makePhrase({ id: 'a1', phrase_type: 'answer', question_id: 'q1' }), makePhrase({ id: 'a2', phrase_type: 'answer', question_id: 'q1' })],
    }
    const groups = [...singles, exchange] // 4 single rows + 1 exchange (1 + 2 answers = 3 rows) = 7 rows total

    expect(paginateGroups(groups, 1, 5)).toEqual({ pageGroups: singles, totalPages: 2 })
    expect(paginateGroups(groups, 2, 5)).toEqual({ pageGroups: [exchange], totalPages: 2 })
  })

  it('keeps an Exchange larger than a full page alone on its own page', () => {
    const question = makePhrase({ id: 'q1', phrase_type: 'question' })
    const bigExchange = {
      kind: 'exchange' as const,
      question,
      answers: Array.from({ length: 6 }, (_, i) =>
        makePhrase({ id: `a${i}`, phrase_type: 'answer', question_id: 'q1' })
      ),
    } // 1 + 6 answers = 7 rows, bigger than the page size of 5
    const trailingSingle = { kind: 'single' as const, phrase: makePhrase({ id: 'p1' }) }
    const groups = [bigExchange, trailingSingle]

    expect(paginateGroups(groups, 1, 5)).toEqual({ pageGroups: [bigExchange], totalPages: 2 })
    expect(paginateGroups(groups, 2, 5)).toEqual({ pageGroups: [trailingSingle], totalPages: 2 })
  })
})
