import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { attachToQuestionSchema, type AttachToQuestionFormValues } from '@/lib/schemas/phrases'
import { fetchQuestionsBySeed, attachAnswerToQuestion } from '@/features/phrases/phrasesService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Phrase } from '@/lib/database.types'

interface AttachToQuestionDialogProps {
  open: boolean
  phrase: Phrase
  onClose: () => void
  onAttached: (phrase: Phrase) => void
}

export function AttachToQuestionDialog({ open, phrase, onClose, onAttached }: AttachToQuestionDialogProps) {
  const [questions, setQuestions] = useState<Phrase[]>([])
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<AttachToQuestionFormValues>({
    resolver: zodResolver(attachToQuestionSchema),
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchQuestionsBySeed(phrase.seed_id)
      .then(setQuestions)
      .catch(() => toast.error('Could not load questions. Try again.'))
      .finally(() => setLoading(false))
  }, [open, phrase.seed_id])

  // Re-applied once `questions` renders its <option>s, so the select's initial value
  // (set via an uncontrolled ref) can actually match an existing option.
  useEffect(() => {
    if (!open) return
    reset({ question_id: phrase.question_id ?? '' })
  }, [open, phrase.question_id, questions, reset])

  async function onSubmit(values: AttachToQuestionFormValues) {
    try {
      const questionId = values.question_id || null
      const updated = await attachAnswerToQuestion(phrase.id, questionId)
      toast.success(questionId ? 'Answer attached to question' : 'Answer unlinked')
      onAttached(updated)
      onClose()
    } catch {
      toast.error('Could not update the link. Try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Attach to question</DialogTitle>
          <DialogDescription>Choose which Question this answer belongs to.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="attach-question-select">Question</Label>
            <select
              id="attach-question-select"
              className="w-full rounded-md border border-grey-300 bg-white px-3 py-2 text-sm dark:border-grey-600 dark:bg-grey-900"
              disabled={loading}
              {...register('question_id')}
            >
              <option value="">None</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.mandarin}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || loading}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
