import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Header } from '@/components/layout/Header'
import { logger } from '@/lib/logger'
import { fetchSeedsWithExchangeCounts, type SeedWithExchangeCount } from './qaService'

export function QaPage() {
  const [seeds, setSeeds] = useState<SeedWithExchangeCount[]>([])
  const [seedsLoading, setSeedsLoading] = useState(true)
  const [seedId, setSeedId] = useState<string | null>(null)
  const [random, setRandom] = useState(true)
  const [displayText, setDisplayText] = useState(true)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    fetchSeedsWithExchangeCounts()
      .then(setSeeds)
      .catch((err) => {
        logger.error('Failed to load seeds for Q&A', err)
        toast.error('Could not load seeds. Try again.')
      })
      .finally(() => setSeedsLoading(false))
  }, [])

  function handleStart() {
    setStarted(true)
  }

  if (started) {
    return (
      <>
        <Header title="Q&A" />
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
          <h1 className="hidden md:block text-lg font-medium text-grey-800 dark:text-grey-100">Q&A</h1>
          <p className="text-sm text-grey-500">Coming soon.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Q&A" />
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <h1 className="hidden md:block text-lg font-medium text-grey-800 dark:text-grey-100">Q&A</h1>

        <div className="flex flex-col gap-4 p-4 bg-grey-100 dark:bg-grey-800 rounded-lg">
          {/* Source */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-none">Source</span>
            {seedsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                value={seedId ?? 'all'}
                onChange={(e) => setSeedId(e.target.value === 'all' ? null : e.target.value)}
                className="rounded-md border border-grey-300 dark:border-grey-600 bg-white dark:bg-grey-900 px-3 py-2 text-sm w-full"
              >
                <option value="all">All seeds</option>
                {seeds.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.exchangeCount === 0}>
                    {s.name} ({s.exchangeCount})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Order */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-none">Order</span>
            <div className="flex gap-2">
              <Button variant={!random ? 'default' : 'ghost'} onClick={() => setRandom(false)}>
                In order
              </Button>
              <Button variant={random ? 'default' : 'ghost'} onClick={() => setRandom(true)}>
                Random
              </Button>
            </div>
          </div>

          {/* Display text */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-none">Display text</span>
            <div className="flex gap-2">
              <Button variant={displayText ? 'default' : 'ghost'} onClick={() => setDisplayText(true)}>
                On
              </Button>
              <Button variant={!displayText ? 'default' : 'ghost'} onClick={() => setDisplayText(false)}>
                Off
              </Button>
            </div>
          </div>

          <Button onClick={handleStart} disabled={seedsLoading} className="self-start">
            Start
          </Button>
        </div>
      </div>
    </>
  )
}
