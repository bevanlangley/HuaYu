import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deletePhrase } from '@/features/phrases/phrasesService'
import { AudioPlayButton } from '@/components/ui/AudioPlayButton'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useConfirmDialog } from '@/context/ConfirmDialogContext'
import type { Phrase, PhraseType } from '@/lib/database.types'

interface PhraseCardProps {
  phrase: Phrase
  onEdit: (phrase: Phrase) => void
  onDeleted: (id: string) => void
}

const PHRASE_TYPE_BADGE: Record<PhraseType, { label: string; variant: BadgeProps['variant'] }> = {
  question: { label: 'Question', variant: 'info' },
  answer: { label: 'Answer', variant: 'qa-answer' },
  statement: { label: 'Statement', variant: 'count' },
}

export function PhraseCard({ phrase, onEdit, onDeleted }: PhraseCardProps) {
  const { openConfirmDialog } = useConfirmDialog()
  const typeBadge = PHRASE_TYPE_BADGE[phrase.phrase_type]

  async function handleDelete() {
    const confirmed = await openConfirmDialog({
      title: 'Delete phrase',
      description: `Delete "${phrase.mandarin}" (${phrase.english})? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await deletePhrase(phrase.id)
      toast.success('Phrase deleted')
      onDeleted(phrase.id)
    } catch {
      toast.error('Could not delete phrase. Try again.')
    }
  }

  return (
    <div className="group rounded-lg border border-grey-200 bg-white p-4 dark:border-grey-700 dark:bg-grey-800">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Badge variant={typeBadge.variant} className="mb-1">
            {typeBadge.label}
          </Badge>
          <p lang="zh-TW" className="text-base font-medium text-grey-800 dark:text-grey-100">
            {phrase.mandarin}
          </p>
          <p className="mt-0.5 text-sm text-grey-500 dark:text-grey-400">{phrase.pinyin}</p>
          <p className="mt-0.5 text-sm text-grey-500 dark:text-grey-400">{phrase.english}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <AudioPlayButton text={phrase.mandarin} id={phrase.id} />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Phrase options"
              className="flex h-8 w-8 items-center justify-center rounded-md text-grey-400 opacity-0 transition-opacity hover:bg-grey-100 hover:text-grey-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 group-hover:opacity-100 dark:hover:bg-grey-700 dark:hover:text-grey-300"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(phrase)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-error-text focus:text-error-text dark:text-error-text-dark-alt dark:focus:text-error-text-dark-alt"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
