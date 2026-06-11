import { describe, it, expect } from 'vitest'
import { seedSchema } from './seeds'

describe('seedSchema', () => {
  it('accepts a valid seed with all fields', () => {
    const result = seedSchema.safeParse({
      name: 'HSK Level 1',
      source_url: 'https://example.com',
      tag: 'hsk',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a seed with only the required name', () => {
    const result = seedSchema.safeParse({ name: 'My Seed', source_url: '', tag: '' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = seedSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a whitespace-only name', () => {
    const result = seedSchema.safeParse({ name: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid URL', () => {
    const result = seedSchema.safeParse({ name: 'Test', source_url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('trims source_url whitespace before URL validation', () => {
    const result = seedSchema.safeParse({ name: 'Test', source_url: ' https://example.com ', tag: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.source_url).toBe('https://example.com')
  })

  it('trims name whitespace', () => {
    const result = seedSchema.safeParse({ name: '  HSK  ', source_url: '', tag: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('HSK')
  })
})
