import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

// The Seed picker's options on the practice screens (Drilling, Recall, Q&A), loaded once on mount.
// `fetchSeeds` must be a stable reference (a module-level service function).
export function useSeedList<T>(fetchSeeds: () => Promise<T[]>) {
  const [seeds, setSeeds] = useState<T[]>([])
  const [seedsLoading, setSeedsLoading] = useState(true)

  useEffect(() => {
    fetchSeeds()
      .then(setSeeds)
      .catch((err) => {
        logger.error('Failed to load seeds', err)
        toast.error('Could not load seeds. Try again.')
      })
      .finally(() => setSeedsLoading(false))
  }, [fetchSeeds])

  return { seeds, seedsLoading }
}
