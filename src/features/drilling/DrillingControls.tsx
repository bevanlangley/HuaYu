import { Pause, Play, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DrillType, PlaybackState } from './useDrilling'

interface DrillingControlsProps {
  drillType: DrillType
  playbackState: PlaybackState
  currentIndex: number
  totalPhrases: number
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onNext: () => void
  onPrevious: () => void
}

export function DrillingControls({
  drillType,
  playbackState,
  currentIndex,
  totalPhrases,
  onPlay,
  onPause,
  onResume,
  onStop,
  onNext,
  onPrevious,
}: DrillingControlsProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-grey-500">
        {currentIndex + 1} / {totalPhrases}
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={currentIndex === 0}
          aria-label="Previous phrase"
        >
          <SkipBack size={20} strokeWidth={1.5} />
        </Button>

        {drillType === 'listen' ? (
          playbackState === 'playing' ? (
            <Button size="icon" onClick={onPause} aria-label="Pause">
              <Pause size={20} strokeWidth={1.5} />
            </Button>
          ) : (
            <Button size="icon" onClick={onResume} aria-label="Resume">
              <Play size={20} strokeWidth={1.5} />
            </Button>
          )
        ) : (
          <Button size="icon" onClick={onPlay} aria-label="Play phrase">
            <Volume2 size={20} strokeWidth={1.5} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={currentIndex >= totalPhrases - 1}
          aria-label="Next phrase"
        >
          <SkipForward size={20} strokeWidth={1.5} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          aria-label="Stop session"
        >
          <Square size={20} strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  )
}
