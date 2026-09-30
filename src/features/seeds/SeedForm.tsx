import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { seedSchema } from '@/lib/schemas/seeds'
import type { SeedFormData } from '@/features/seeds/seedsService'
import { createSeed, updateSeed } from '@/features/seeds/seedsService'
import type { Seed } from '@/lib/database.types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SeedFormProps {
  open: boolean
  onClose: () => void
  seed?: Seed | null
  onSaved: (seed: Seed) => void
}

export function SeedForm({ open, onClose, seed, onSaved }: SeedFormProps) {
  const isEdit = Boolean(seed)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SeedFormData>({
    resolver: zodResolver(seedSchema),
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) {
      reset({
        name: seed?.name ?? '',
        source_url: seed?.source_url ?? '',
        tag: seed?.tag ?? '',
      })
    }
  }, [open, seed, reset])

  async function onSubmit(values: SeedFormData) {
    try {
      const saved = isEdit
        ? await updateSeed(seed!.id, values)
        : await createSeed(values)
      toast.success(isEdit ? 'Seed updated' : 'Seed created')
      onSaved(saved)
      onClose()
    } catch {
      toast.error(isEdit ? 'Could not update seed. Try again.' : 'Could not create seed. Try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit seed' : 'New seed'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? 'Edit the details for this seed.' : 'Add a new learning source seed.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seed-name">Name *</Label>
            <Input
              id="seed-name"
              placeholder="e.g. HSK Level 1 Video"
              aria-describedby={errors.name ? 'seed-name-error' : undefined}
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
            {errors.name && (
              <p id="seed-name-error" className="text-xs text-error-text dark:text-error-text-dark-alt">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seed-url">Source URL</Label>
            <Input
              id="seed-url"
              type="url"
              placeholder="https://..."
              aria-describedby={errors.source_url ? 'seed-url-error' : undefined}
              aria-invalid={Boolean(errors.source_url)}
              {...register('source_url')}
            />
            {errors.source_url && (
              <p id="seed-url-error" className="text-xs text-error-text dark:text-error-text-dark-alt">
                {errors.source_url.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seed-tag">Tag</Label>
            <Input
              id="seed-tag"
              placeholder="e.g. HSK1, podcast, youtube"
              aria-describedby={errors.tag ? 'seed-tag-error' : undefined}
              aria-invalid={Boolean(errors.tag)}
              {...register('tag')}
            />
            {errors.tag && (
              <p id="seed-tag-error" className="text-xs text-error-text dark:text-error-text-dark-alt">
                {errors.tag.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create seed'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
