import { useEffect, useRef, useState } from 'react'
import { Volume2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Header } from '@/components/layout/Header'
import { speakMandarin } from '@/lib/tts'
import { useTts } from '@/context/TtsContext'
import { useRecall } from './useRecall'

export function RecallPage() {
  const [seedId, setSeedId] = useState<string | null>(null)
  const [random, setRandom] = useState(true)

  const {
    seeds, seedsLoading,
    sessionActive, phrases, phrasesLoading,
    currentIndex, currentPhrase, isRevealed, justRevealed,
    startSession, stopSession, reveal, next, previous,
  } = useRecall()

  const { setCurrentlyPlaying } = useTts()
  const cancelAudioRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!justRevealed || !currentPhrase) return
    cancelAudioRef.current?.()
    setCurrentlyPlaying(currentPhrase.id)
    cancelAudioRef.current = speakMandarin(currentPhrase.mandarin, () => {
      setCurrentlyPlaying(null)
    })
  }, [justRevealed, currentPhrase, setCurrentlyPlaying])

  // Cancel audio on unmount
  useEffect(() => {
    return () => {
      cancelAudioRef.current?.()
      cancelAudioRef.current = null
      setCurrentlyPlaying(null)
    }
  }, [setCurrentlyPlaying])

  function handleReplayAudio() {
    if (!currentPhrase) return
    cancelAudioRef.current?.()
    setCurrentlyPlaying(currentPhrase.id)
    cancelAudioRef.current = speakMandarin(currentPhrase.mandarin, () => {
      setCurrentlyPlaying(null)
    })
  }

  function handleStart() {
    startSession({ seedId, random })
  }

  return (
    <>
      <Header title="Recall" />
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <h1 className="hidden md:block text-lg font-medium text-grey-800 dark:text-grey-100">Recall</h1>

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

            <Button onClick={handleStart} disabled={phrasesLoading} className="self-start">
              {phrasesLoading ? 'Loading…' : 'Start'}
            </Button>
          </div>
        )}

        {sessionActive && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-sm text-grey-500 self-start">
              {currentIndex + 1} / {phrases.length}
            </p>

            <div className="w-full p-4 bg-grey-100 dark:bg-grey-800 rounded-lg flex flex-col items-center gap-4 text-center min-h-[192px] justify-center">
              {currentPhrase ? (
                <>
                  <p className="text-xl text-grey-600 dark:text-grey-300">{currentPhrase.english}</p>

                  {isRevealed ? (
                    <div className="flex flex-col items-center gap-3 mt-4">
                      <p lang="zh-TW" className="text-3xl font-medium">{currentPhrase.mandarin}</p>
                      <p className="text-lg text-grey-600 dark:text-grey-400">{currentPhrase.pinyin}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReplayAudio}
                        className="flex items-center gap-2 mt-2"
                      >
                        <Volume2 size={16} strokeWidth={1.5} />
                        Play again
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={reveal} className="mt-4">
                      Reveal
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-grey-400 text-sm">No phrases found for this source.</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={previous} disabled={currentIndex === 0}>
                <ChevronLeft size={20} strokeWidth={1.5} />
                Previous
              </Button>
              <Button variant="ghost" onClick={next} disabled={currentIndex >= phrases.length - 1}>
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
