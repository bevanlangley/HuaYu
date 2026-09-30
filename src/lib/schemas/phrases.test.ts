import { describe, it, expect } from 'vitest'
import { phraseSchema, attachToQuestionSchema } from './phrases'

describe('phraseSchema', () => {
  it('accepts a valid phrase', () => {
    const result = phraseSchema.safeParse({
      mandarin: '你好',
      pinyin: 'nǐ hǎo',
      english: 'Hello',
      phrase_type: 'statement',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing mandarin', () => {
    const result = phraseSchema.safeParse({
      mandarin: '',
      pinyin: 'nǐ hǎo',
      english: 'Hello',
      phrase_type: 'statement',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing pinyin', () => {
    const result = phraseSchema.safeParse({
      mandarin: '你好',
      pinyin: '',
      english: 'Hello',
      phrase_type: 'statement',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing english', () => {
    const result = phraseSchema.safeParse({
      mandarin: '你好',
      pinyin: 'nǐ hǎo',
      english: '',
      phrase_type: 'statement',
    })
    expect(result.success).toBe(false)
  })

  it('trims all fields', () => {
    const result = phraseSchema.safeParse({
      mandarin: '  你好  ',
      pinyin: '  nǐ hǎo  ',
      english: '  Hello  ',
      phrase_type: 'statement',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mandarin).toBe('你好')
      expect(result.data.pinyin).toBe('nǐ hǎo')
      expect(result.data.english).toBe('Hello')
    }
  })

  it('accepts each phrase type value', () => {
    for (const phrase_type of ['question', 'answer', 'statement'] as const) {
      const result = phraseSchema.safeParse({
        mandarin: '你好',
        pinyin: 'nǐ hǎo',
        english: 'Hello',
        phrase_type,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects a missing phrase_type', () => {
    const result = phraseSchema.safeParse({
      mandarin: '你好',
      pinyin: 'nǐ hǎo',
      english: 'Hello',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid phrase_type', () => {
    const result = phraseSchema.safeParse({
      mandarin: '你好',
      pinyin: 'nǐ hǎo',
      english: 'Hello',
      phrase_type: 'greeting',
    })
    expect(result.success).toBe(false)
  })
})

describe('attachToQuestionSchema', () => {
  it('accepts a question id', () => {
    const result = attachToQuestionSchema.safeParse({ question_id: 'q1' })
    expect(result.success).toBe(true)
  })

  it('accepts an empty string (None)', () => {
    const result = attachToQuestionSchema.safeParse({ question_id: '' })
    expect(result.success).toBe(true)
  })
})
