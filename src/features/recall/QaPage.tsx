import { useEffect, useRef, useState } from 'react'
import { Volume2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/Skeleton'
import { AudioPlayButton } from '@/components/ui/AudioPlayButton'
import { Header } from '@/components/layout/Header'
import { speakMandarin } from '@/lib/tts'
import { useTts } from '@/context/TtsContext'
import { useQa } from './useQa'

export function QaPage() {
  const [seedId, setSeedId] = useState<string | null>(null)
  const [random, setRandom] = useState(true)
  const [displayText, setDisplayText] = useState(true)

  const {
    seeds, seedsLoading,
    sessionActive, exchanges, exchangesLoading,
    currentIndex, currentExchange, isRevealed, justRevealed,
    startSession, stopSession, reveal, next, previous,
  } = useQa()

  const { setCurrentlyPlaying } = useTts()
  const cancelAudioRef = useRef<(() => void) | null>(null)

  // On Start / Next / Previous: the current Question's Mandarin auto-plays immediately.
  useEffect(() => {
    if (!sessionActive || !currentExchange) return
    cancelAudioRef.current?.()
    setCurrentlyPlaying(currentExchange.question.id)
    cancelAudioRef.current = speakMandarin(currentExchange.question.mandarin, () => {
      setCurrentlyPlaying(null)
    })
  }, [sessionActive, currentExchange, setCurrentlyPlaying])

  // On Reveal: exactly one linked Answer auto-plays; more than one does not.
  useEffect(() => {
    if (!justRevealed || !currentExchange || currentExchange.answers.length !== 1) return
    const [answer] = currentExchange.answers
    cancelAudioRef.current?.()
    setCurrentlyPlaying(answer.id)
    cancelAudioRef.current = speakMandarin(answer.mandarin, () => {
      setCurrentlyPlaying(null)
    })
  }, [justRevealed, currentExchange, setCurrentlyPlaying])

  // Cancel audio on unmount
  useEffect(() => {
    return () => {
      cancelAudioRef.current?.()
      cancelAudioRef.current = null
      setCurrentlyPlaying(null)
    }
  }, [setCurrentlyPlaying])

  function handleReplayQuestion() {
    if (!currentExchange) return
    cancelAudioRef.current?.()
    setCurrentlyPlaying(currentExchange.question.id)
    cancelAudioRef.current = speakMandarin(currentExchange.question.mandarin, () => {
      setCurrentlyPlaying(null)
    })
  }

  function handleStart() {
    startSession({ seedId, random })
  }

  return (
    <>
      <Header title="Q&A" />
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <h1 className="hidden md:block text-lg font-medium text-grey-800 dark:text-grey-100">Q&A</h1>

        {!sessionActive && (
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
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium leading-none">Display text</span>
              <button
                id="displayText"
                role="switch"
                aria-checked={displayText}
                onClick={() => setDisplayText((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${displayText ? 'bg-primary-500' : 'bg-grey-300 dark:bg-grey-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${displayText ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <Button onClick={handleStart} disabled={seedsLoading || exchangesLoading} className="self-start">
              {exchangesLoading ? 'Loading…' : 'Start'}
            </Button>
          </div>
        )}

        {sessionActive && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-sm text-grey-500 self-start">
              {currentIndex + 1} / {exchanges.length}
            </p>

            <div className="w-full p-4 bg-grey-100 dark:bg-grey-800 rounded-lg flex flex-col gap-4 min-h-[192px] justify-center">
              {currentExchange ? (
                <>
                  <div className="flex flex-col items-center gap-2 text-center">
                    {(isRevealed || displayText) && (
                      <>
                        <p lang="zh-TW" className="text-2xl font-medium">{currentExchange.question.mandarin}</p>
                        <p className="text-sm text-grey-500 dark:text-grey-400">{currentExchange.question.pinyin}</p>
                      </>
                    )}
                    {isRevealed && (
                      <p className="text-sm text-grey-500 dark:text-grey-400">{currentExchange.question.english}</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReplayQuestion}
                      className="flex items-center gap-2"
                    >
                      <Volume2 size={16} strokeWidth={1.5} />
                      Replay
                    </Button>
                  </div>

                  {isRevealed ? (
                    <div className="flex flex-col gap-3">
                      {currentExchange.answers.map((answer) => (
                        <div
                          key={answer.id}
                          className="flex items-center justify-between gap-3 border-t border-grey-200 dark:border-grey-700 pt-3"
                        >
                          <div className="flex-1 text-center">
                            <p lang="zh-TW" className="text-lg font-medium">{answer.mandarin}</p>
                            <p className="text-sm text-grey-500 dark:text-grey-400">{answer.pinyin}</p>
                            <p className="text-sm text-grey-500 dark:text-grey-400">{answer.english}</p>
                          </div>
                          {currentExchange.answers.length > 1 && (
                            <AudioPlayButton text={answer.mandarin} id={answer.id} />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Button onClick={reveal} className="self-center mt-2">
                      Reveal
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-grey-400 text-sm text-center">No exchanges found for this seed.</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={previous} disabled={currentIndex === 0}>
                <ChevronLeft size={20} strokeWidth={1.5} />
                Previous
              </Button>
              <Button variant="ghost" onClick={next} disabled={currentIndex >= exchanges.length - 1}>
                Next
                <ChevronRight size={20} strokeWidth={1.5} />
              </Button>
              <Button variant="ghost" onClick={stopSession}>
                Stop
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
