import { useState, useRef, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'

interface RevealSessionOptions<T, C> {
  loadItems: (cfg: C) => Promise<T[]>
  failureLabel: string
  failureToast: string
}

// Step-through-and-reveal session shared by Recall (Phrases) and Q&A (Exchanges).
export function useRevealSession<T, C>({ loadItems, failureLabel, failureToast }: RevealSessionOptions<T, C>) {
  const [sessionActive, setSessionActive] = useState(false)
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())
  const [justRevealed, setJustRevealed] = useState(false)

  const itemsRef = useRef<T[]>([])

  const resetProgress = useCallback(() => {
    setCurrentIndex(0)
    setRevealedIndices(new Set())
    setJustRevealed(false)
  }, [])

  const startSession = useCallback(async (cfg: C) => {
    setLoading(true)
    try {
      const loaded = await loadItems(cfg)
      itemsRef.current = loaded
      setItems(loaded)
      resetProgress()
      setSessionActive(true)
    } catch (err) {
      logger.error(`Failed to ${failureLabel}`, err)
      toast.error(failureToast)
    } finally {
      setLoading(false)
    }
  }, [loadItems, failureLabel, failureToast, resetProgress])

  const stopSession = useCallback(() => {
    setSessionActive(false)
    itemsRef.current = []
    setItems([])
    resetProgress()
  }, [resetProgress])

  const reveal = useCallback(() => {
    setRevealedIndices((prev) => new Set(prev).add(currentIndex))
    setJustRevealed(true)
  }, [currentIndex])

  const next = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, itemsRef.current.length - 1))
    setJustRevealed(false)
  }, [])

  const previous = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
    setJustRevealed(false)
  }, [])

  return {
    sessionActive,
    items,
    loading,
    currentIndex,
    currentItem: items[currentIndex] ?? null,
    isRevealed: revealedIndices.has(currentIndex),
    justRevealed,
    startSession,
    stopSession,
    reveal,
    next,
    previous,
  }
}
