import { describe, it, expect } from 'vitest'
import { loginSchema } from './auth'

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'me@example.com', password: 'secret' })
    expect(result.success).toBe(true)
  })

  it('trims email whitespace', () => {
    const result = loginSchema.safeParse({ email: '  me@example.com  ', password: 'secret' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('me@example.com')
  })

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'secret' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'me@example.com', password: '' })
    expect(result.success).toBe(false)
  })
})
