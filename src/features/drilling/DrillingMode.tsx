import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/Skeleton'
import { Header } from '@/components/layout/Header'
import { DrillingControls } from './DrillingControls'
import { useDrilling } from './useDrilling'
import type { DrillType } from './useDrilling'

export function DrillingMode() {
  const location = useLocation()
  const preselectedSeedId: string | null = (location.state as { seedId?: string } | null)?.seedId ?? null

  const [drillType, setDrillType] = useState<DrillType>('listen')
  const [seedId, setSeedId] = useState<string | null>(preselectedSeedId)
  const [random, setRandom] = useState(false)
  const [gapSeconds, setGapSeconds] = useState(3)
  const [loop, setLoop] = useState(false)
  const [showText, setShowText] = useState(true)

  const {
    seeds, seedsLoading,
    sessionActive, config, phrases, phrasesLoading,
    currentIndex, currentPhrase, playbackState,
    startSession, stopSession, pause, resume, next, previous, speakCurrent,
  } = useDrilling()

  // Fix 4: Reset showText to true when session ends
  useEffect(() => {
    if (!sessionActive) setShowText(true)
  }, [sessionActive])

  function handleStart() {
    startSession({ seedId, drillType, random, gapSeconds, loop })
  }

  const displayText = config?.drillType === 'listen' ? showText : true

  return (
    <div className="flex flex-col">
      {/* Fix 1: Mobile header */}
      <Header title="Drill" />

      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        {/* Fix 3: h1 typography matches other pages; Fix 1: hidden on mobile */}
        <h1 className="hidden md:block text-lg font-medium text-grey-800 dark:text-grey-100">Drill</h1>

        {!sessionActive && (
          // Fix 2: gap-5 → gap-4, p-6 → p-4
          <div className="flex flex-col gap-4 p-4 bg-grey-100 dark:bg-grey-800 rounded-lg">
            {/* Mode */}
            <div className="flex flex-col gap-2">
              <Label>Mode</Label>
              <div className="flex gap-2">
                {(['listen', 'shadow'] as DrillType[]).map((m) => (
                  <Button
                    key={m}
                    variant={drillType === m ? 'default' : 'ghost'}
                    onClick={() => setDrillType(m)}
                    className="capitalize"
                  >
                    {m === 'listen' ? 'Listen' : 'Shadow'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="flex flex-col gap-2">
              <Label>Source</Label>
              {seedsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <select
                  value={seedId ?? 'all'}
                  onChange={(e) => setSeedId(e.target.value === 'all' ? null : e.target.value)}
                  className="w-full rounded-md border border-grey-300 dark:border-grey-600 bg-white dark:bg-grey-900 px-3 py-2 text-sm"
                >
                  <option value="all">All phrases</option>
                  {seeds.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phraseCount})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Order */}
            <div className="flex flex-col gap-2">
              <Label>Order</Label>
              <div className="flex gap-2">
                <Button variant={!random ? 'default' : 'ghost'} onClick={() => setRandom(false)}>
                  In order
                </Button>
                <Button variant={random ? 'default' : 'ghost'} onClick={() => setRandom(true)}>
                  Random
                </Button>
              </div>
            </div>

            {/* Listen-only options */}
            {drillType === 'listen' && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="gap">Gap between phrases (seconds)</Label>
                  <input
                    id="gap"
                    type="number"
                    min={1}
                    max={30}
                    value={gapSeconds}
                    onChange={(e) => setGapSeconds(Math.min(30, Math.max(1, Number(e.target.value))))}
                    className="w-24 rounded-md border border-grey-300 dark:border-grey-600 bg-white dark:bg-grey-900 px-3 py-2 text-sm"
                  />
                </div>

                {/* Fix 6: Label → span for button targets */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium leading-none">Loop</span>
                  <button
                    id="loop"
                    role="switch"
                    aria-checked={loop}
                    onClick={() => setLoop((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${loop ? 'bg-primary-500' : 'bg-grey-300 dark:bg-grey-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${loop ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium leading-none">Show text</span>
                  <button
                    id="showText"
                    role="switch"
                    aria-checked={showText}
                    onClick={() => setShowText((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${showText ? 'bg-primary-500' : 'bg-grey-300 dark:bg-grey-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showText ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </>
            )}

            <Button onClick={handleStart} disabled={phrasesLoading} className="self-start">
              {phrasesLoading ? 'Loading…' : 'Start'}
            </Button>
          </div>
        )}

        {sessionActive && (
          <div className="flex flex-col items-center gap-6">
            {/* Show text toggle (listen only) */}
            {config?.drillType === 'listen' && (
              // Fix 2: gap-1.5 → gap-2
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowText((v) => !v)}
                className="self-end flex items-center gap-2"
                aria-label={showText ? 'Hide text' : 'Show text'}
              >
                {showText ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                {showText ? 'Hide text' : 'Show text'}
              </Button>
            )}

            {/* Phrase card — Fix 5: min-h-48 → min-h-[192px] */}
            <div className="w-full min-h-[192px] flex items-center justify-center p-8 bg-grey-100 dark:bg-grey-800 rounded-lg">
              {displayText && currentPhrase ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p lang="zh-TW" className="text-4xl font-medium">{currentPhrase.mandarin}</p>
                  <p className="text-xl text-grey-600 dark:text-grey-400">{currentPhrase.pinyin}</p>
                  <p className="text-lg text-grey-500">{currentPhrase.english}</p>
                </div>
              ) : (
                <p className="text-grey-400 text-sm">Audio only</p>
              )}
            </div>

            {/* Empty state */}
            {phrases.length === 0 && !phrasesLoading && (
              <p className="text-grey-500 text-sm">No phrases found for this source.</p>
            )}

            <DrillingControls
              drillType={config?.drillType ?? 'listen'}
              playbackState={playbackState}
              currentIndex={currentIndex}
              totalPhrases={phrases.length}
              onPlay={speakCurrent}
              onPause={pause}
              onResume={resume}
              onStop={stopSession}
              onNext={next}
              onPrevious={previous}
            />
          </div>
        )}
      </div>
    </div>
  )
}
