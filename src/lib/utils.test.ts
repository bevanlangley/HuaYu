import { describe, it, expect, vi, afterEach } from 'vitest'
import { cn, shuffleArray } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('filters falsy values', () => {
    expect(cn('foo', false && 'bar', null, undefined, 'baz')).toBe('foo baz')
  })

  it('handles conditional objects', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })
})

describe('shuffleArray', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns a new array containing every original element, order unspecified', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleArray(input)
    expect(result).not.toBe(input)
    expect(result.slice().sort()).toEqual(input.slice().sort())
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3]
    shuffleArray(input)
    expect(input).toEqual([1, 2, 3])
  })

  it('produces a deterministic permutation for a given random sequence', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(shuffleArray([1, 2, 3, 4])).toEqual([2, 3, 4, 1])
  })
})
