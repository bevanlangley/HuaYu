import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildPhraseSearchFilter, fetchAllPhrasesUnpaginated } from './phrasesService'

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
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', created_at: '2024-01-02' },
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

  it('returns empty array on error', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any)

    const result = await fetchAllPhrasesUnpaginated()

    expect(result).toEqual([])
  })
})
