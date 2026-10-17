import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRevealSession } from './useRevealSession'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { logger } from '@/lib/logger'
import { toast } from 'sonner'

const items = ['a', 'b', 'c']
const loadItems = vi.fn<(cfg: { n: number }) => Promise<string[]>>()

function setup() {
  return renderHook(() =>
    useRevealSession<string, { n: number }>({
      loadItems,
      failureLog: 'Failed to start test session',
      failureToast: 'Could not load items. Try again.',
    })
  )
}

async function started() {
  const hook = setup()
  await act(async () => { await hook.result.current.startSession({ n: 1 }) })
  return hook
}

describe('useRevealSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadItems.mockResolvedValue(items)
  })

  it('starts inactive with no items', () => {
    const { result } = setup()
    expect(result.current.sessionActive).toBe(false)
    expect(result.current.items).toEqual([])
    expect(result.current.currentItem).toBeNull()
  })

  it('startSession passes the config to the loader and activates the session', async () => {
    const { result } = await started()
    expect(loadItems).toHaveBeenCalledWith({ n: 1 })
    expect(result.current.sessionActive).toBe(true)
    expect(result.current.items).toEqual(items)
    expect(result.current.currentItem).toBe('a')
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.isRevealed).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('startSession logs and toasts on loader failure, leaving the session inactive', async () => {
    loadItems.mockRejectedValue(new Error('boom'))
    const { result } = await started()
    expect(logger.error).toHaveBeenCalledWith('Failed to start test session', expect.any(Error))
    expect(toast.error).toHaveBeenCalledWith('Could not load items. Try again.')
    expect(result.current.sessionActive).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('reveal marks the current item revealed and sets justRevealed', async () => {
    const { result } = await started()
    act(() => result.current.reveal())
    expect(result.current.isRevealed).toBe(true)
    expect(result.current.justRevealed).toBe(true)
  })

  it('next advances, clears justRevealed, and keeps earlier reveals', async () => {
    const { result } = await started()
    act(() => result.current.reveal())
    act(() => result.current.next())
    expect(result.current.currentIndex).toBe(1)
    expect(result.current.isRevealed).toBe(false)
    expect(result.current.justRevealed).toBe(false)
    act(() => result.current.previous())
    expect(result.current.isRevealed).toBe(true)
  })

  it('next stops at the last item and previous stops at the first', async () => {
    const { result } = await started()
    act(() => result.current.previous())
    expect(result.current.currentIndex).toBe(0)
    act(() => { result.current.next(); result.current.next(); result.current.next() })
    expect(result.current.currentIndex).toBe(2)
  })

  it('stopSession resets all session state', async () => {
    const { result } = await started()
    act(() => { result.current.reveal(); result.current.next() })
    act(() => result.current.stopSession())
    expect(result.current.sessionActive).toBe(false)
    expect(result.current.items).toEqual([])
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.isRevealed).toBe(false)
    expect(result.current.justRevealed).toBe(false)
  })

  it('a new session starts with nothing revealed', async () => {
    const { result } = await started()
    act(() => result.current.reveal())
    await act(async () => { await result.current.startSession({ n: 2 }) })
    expect(result.current.isRevealed).toBe(false)
    expect(result.current.currentIndex).toBe(0)
  })
})
