import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { phraseSchema } from '@/lib/schemas/phrases'
import type { PhraseFormData } from '@/features/phrases/phrasesService'
import { createPhrase, updatePhrase } from '@/features/phrases/phrasesService'
import type { Phrase } from '@/lib/database.types'
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

interface PhraseFormProps {
  open: boolean
  onClose: () => void
  seedId: string
  phrase?: Phrase | null
  onSaved: (phrase: Phrase) => void
}

export function PhraseForm({ open, onClose, seedId, phrase, onSaved }: PhraseFormProps) {
  const isEdit = Boolean(phrase)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PhraseFormData>({
    resolver: zodResolver(phraseSchema),
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) {
      reset({
        mandarin: phrase?.mandarin ?? '',
        pinyin: phrase?.pinyin ?? '',
        english: phrase?.english ?? '',
        phrase_type: phrase?.phrase_type ?? 'statement',
      })
    }
  }, [open, phrase, reset])

  async function onSubmit(values: PhraseFormData) {
    try {
      const saved = isEdit
        ? await updatePhrase(phrase!.id, values)
        : await createPhrase(seedId, values)
      toast.success(isEdit ? 'Phrase updated' : 'Phrase added')
      onSaved(saved)
      onClose()
    } catch {
      toast.error(isEdit ? 'Could not update phrase. Try again.' : 'Could not add phrase. Try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit phrase' : 'Add phrase'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? 'Edit the Mandarin, Pinyin, and English for this phrase.' : 'Add a new phrase with Mandarin, Pinyin, and English.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-mandarin">Mandarin *</Label>
            <Input
              id="phrase-mandarin"
              placeholder="e.g. 你好"
              lang="zh-TW"
              aria-describedby={errors.mandarin ? 'phrase-mandarin-error' : undefined}
              aria-invalid={Boolean(errors.mandarin)}
              {...register('mandarin')}
            />
            {errors.mandarin && (
              <p id="phrase-mandarin-error" className="text-xs text-error-text dark:text-error-text-dark-alt">
                {errors.mandarin.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-pinyin">Pinyin *</Label>
            <Input
              id="phrase-pinyin"
              placeholder="e.g. nǐ hǎo"
              aria-describedby={errors.pinyin ? 'phrase-pinyin-error' : undefined}
              aria-invalid={Boolean(errors.pinyin)}
              {...register('pinyin')}
            />
            {errors.pinyin && (
              <p id="phrase-pinyin-error" className="text-xs text-error-text dark:text-error-text-dark-alt">
                {errors.pinyin.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-english">English *</Label>
            <Input
              id="phrase-english"
              placeholder="e.g. Hello"
              aria-describedby={errors.english ? 'phrase-english-error' : undefined}
              aria-invalid={Boolean(errors.english)}
              {...register('english')}
            />
            {errors.english && (
              <p id="phrase-english-error" className="text-xs text-error-text dark:text-error-text-dark-alt">
                {errors.english.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-type">Phrase Type *</Label>
            <select
              id="phrase-type"
              aria-describedby={errors.phrase_type ? 'phrase-type-error' : undefined}
              aria-invalid={Boolean(errors.phrase_type)}
              className="rounded-md border border-grey-300 dark:border-grey-600 bg-white dark:bg-grey-900 px-3 py-2 text-sm w-full"
              {...register('phrase_type')}
            >
              <option value="question">Question</option>
              <option value="answer">Answer</option>
              <option value="statement">Statement</option>
            </select>
            {errors.phrase_type && (
              <p id="phrase-type-error" className="text-xs text-error-text dark:text-error-text-dark-alt">
                {errors.phrase_type.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add phrase'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
