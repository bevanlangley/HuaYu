import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildPhraseSearchFilter,
  fetchAllPhrasesUnpaginated,
  fetchQuestionsBySeed,
  attachAnswerToQuestion,
  isPhraseUnpaired,
  countUnpaired,
} from './phrasesService'
import type { Phrase } from '@/lib/database.types'

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
