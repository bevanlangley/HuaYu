import { describe, it, expect } from 'vitest'
import { buildPhraseSearchFilter } from './phrasesService'

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
