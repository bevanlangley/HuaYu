import { Link } from 'react-router-dom'
import { MoreVertical, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { SeedWithCount } from '@/lib/database.types'
import { deleteSeed } from '@/features/seeds/seedsService'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useConfirmDialog } from '@/context/ConfirmDialogContext'

interface SeedCardProps {
  seed: SeedWithCount
  onEdit: (seed: SeedWithCount) => void
  onDeleted: (id: string) => void
}

export function SeedCard({ seed, onEdit, onDeleted }: SeedCardProps) {
  const { openConfirmDialog } = useConfirmDialog()

  async function handleDelete() {
    const confirmed = await openConfirmDialog({
      title: 'Delete seed',
      description: `Delete "${seed.name}"? All ${seed.phraseCount} phrase${seed.phraseCount !== 1 ? 's' : ''} in this seed will also be deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await deleteSeed(seed.id)
      toast.success('Seed deleted')
      onDeleted(seed.id)
    } catch {
      toast.error('Could not delete seed. Try again.')
    }
  }

  return (
    <div className="group relative rounded-lg border border-grey-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-grey-700 dark:bg-grey-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/seeds/${seed.id}`}
            className="block line-clamp-2 text-sm font-medium text-grey-800 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 dark:text-grey-100 dark:hover:text-primary-400"
          >
            {seed.name}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="count">{seed.phraseCount} phrase{seed.phraseCount !== 1 ? 's' : ''}</Badge>
            {seed.tag && <Badge variant="tag">{seed.tag}</Badge>}
          </div>
          {seed.source_url && (
            <a
              href={seed.source_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open source for ${seed.name}`}
              className="mt-2 inline-flex items-center gap-1 text-xs text-grey-500 hover:text-primary-500 dark:text-grey-400 dark:hover:text-primary-400"
            >
              <ExternalLink className="h-3 w-3" />
              Source
            </a>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Seed options"
            className="flex h-7 w-7 items-center justify-center rounded-md text-grey-400 opacity-0 transition-opacity hover:bg-grey-100 hover:text-grey-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 group-hover:opacity-100 dark:hover:bg-grey-700 dark:hover:text-grey-300"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(seed)}>
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
  )
}
