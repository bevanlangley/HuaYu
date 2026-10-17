import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSeedList } from './useSeedList'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { logger } from '@/lib/logger'
import { toast } from 'sonner'

const fetchSeeds = vi.fn<() => Promise<string[]>>()

describe('useSeedList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is loading with no seeds before the fetch settles', () => {
    fetchSeeds.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSeedList(fetchSeeds))
    expect(result.current).toEqual({ seeds: [], seedsLoading: true })
  })

  it('exposes the fetched seeds once loaded', async () => {
    fetchSeeds.mockResolvedValue(['s1', 's2'])
    const { result } = renderHook(() => useSeedList(fetchSeeds))
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    expect(result.current.seeds).toEqual(['s1', 's2'])
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('logs, toasts and stops loading with no seeds when the fetch fails', async () => {
    const err = new Error('boom')
    fetchSeeds.mockRejectedValue(err)
    const { result } = renderHook(() => useSeedList(fetchSeeds))
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    expect(result.current.seeds).toEqual([])
    expect(logger.error).toHaveBeenCalledWith('Failed to load seeds', err)
    expect(toast.error).toHaveBeenCalledWith('Could not load seeds. Try again.')
  })

  it('fetches only once across re-renders', async () => {
    fetchSeeds.mockResolvedValue([])
    const { result, rerender } = renderHook(() => useSeedList(fetchSeeds))
    await waitFor(() => expect(result.current.seedsLoading).toBe(false))
    rerender()
    expect(fetchSeeds).toHaveBeenCalledTimes(1)
  })
})
