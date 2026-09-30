import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { phraseSchema } from '@/lib/schemas/phrases'
import type { PhraseFormData } from '@/features/phrases/phrasesService'
import {
  createPhrase,
  updatePhrase,
  unlinkAnswersFromQuestion,
  describeLinkedAnswerCount,
} from '@/features/phrases/phrasesService'
import { useConfirmDialog } from '@/context/ConfirmDialogContext'
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
  linkedAnswerCount?: number
  onSaved: (phrase: Phrase) => void
}

// Drives the chained answer-authoring flow: after saving a new Question, offer to add its
// Answers in the same modal session without reopening it each time.
type Step =
  | { kind: 'form' }
  | { kind: 'prompt-answer'; question: Phrase }
  | { kind: 'author-answer'; question: Phrase }
  | { kind: 'prompt-another'; question: Phrase }

const BLANK_ANSWER_VALUES: PhraseFormData = {
  mandarin: '',
  pinyin: '',
  english: '',
  phrase_type: 'answer',
}

export function PhraseForm({
  open,
  onClose,
  seedId,
  phrase,
  linkedAnswerCount = 0,
  onSaved,
}: PhraseFormProps) {
  const isEdit = Boolean(phrase)
  const { openConfirmDialog } = useConfirmDialog()
  const [step, setStep] = useState<Step>({ kind: 'form' })
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
      setStep({ kind: 'form' })
      reset({
        mandarin: phrase?.mandarin ?? '',
        pinyin: phrase?.pinyin ?? '',
        english: phrase?.english ?? '',
        phrase_type: phrase?.phrase_type ?? 'statement',
      })
    }
  }, [open, phrase, reset])

  async function onSubmit(values: PhraseFormData) {
    if (isEdit) {
      const previousType = phrase!.phrase_type
      const retypingAway = values.phrase_type !== previousType
      // A destructive side-effect on a row other than the one being edited always gets a
      // confirm dialog; a side-effect confined to this row (clearing its own question_id)
      // does not — see PRD/13_Phrase_Types_And_QA.md "Editing an Existing Phrase's Type".
      const unlinkingChildren = previousType === 'question' && retypingAway && linkedAnswerCount > 0
      const clearingOwnLink = previousType === 'answer' && retypingAway

      if (unlinkingChildren) {
        const confirmed = await openConfirmDialog({
          title: 'Change phrase type',
          description: `This question has ${describeLinkedAnswerCount(linkedAnswerCount)}. Changing its type will unlink them; they'll become unpaired and drop out of Q&A. Continue?`,
          confirmLabel: 'Continue',
          cancelLabel: 'Cancel',
          variant: 'danger',
        })
        if (!confirmed) return
      }

      let saved: Phrase
      try {
        saved = clearingOwnLink
          ? await updatePhrase(phrase!.id, values, { clearQuestionId: true })
          : await updatePhrase(phrase!.id, values)
      } catch {
        toast.error('Could not update phrase. Try again.')
        return
      }

      if (unlinkingChildren) {
        try {
          await unlinkAnswersFromQuestion(phrase!.id)
        } catch {
          // The retype itself already succeeded — only the follow-up unlink failed. Report
          // that distinctly rather than the generic "could not update" (which would be
          // wrong) and still close, since re-submitting won't retry the unlink.
          toast.error('Phrase type changed, but linked answers could not be unlinked. Try again.')
          onSaved(saved)
          onClose()
          return
        }
      }

      toast.success('Phrase updated')
      onSaved(saved)
      onClose()
      return
    }

    const authoringAnswer = step.kind === 'author-answer'
    try {
      const saved = authoringAnswer
        ? await createPhrase(seedId, values, step.question.id)
        : await createPhrase(seedId, values)
      toast.success(authoringAnswer ? 'Answer added' : 'Phrase added')
      onSaved(saved)
      if (authoringAnswer) {
        setStep({ kind: 'prompt-another', question: step.question })
      } else if (saved.phrase_type === 'question') {
        setStep({ kind: 'prompt-answer', question: saved })
      } else {
        onClose()
      }
    } catch {
      toast.error('Could not add phrase. Try again.')
    }
  }

  function startAuthoringAnswer(question: Phrase) {
    reset(BLANK_ANSWER_VALUES)
    setStep({ kind: 'author-answer', question })
  }

  const isAuthoringAnswer = step.kind === 'author-answer'
  // Title switches to the parent Question on Yes and stays switched for the rest of the
  // chained session (including the "Add another answer?" prompt) until Skip/Done closes it.
  const title =
    step.kind === 'author-answer' || step.kind === 'prompt-another'
      ? `Add an answer to ${step.question.mandarin}`
      : isEdit
        ? 'Edit phrase'
        : 'Add phrase'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {isAuthoringAnswer
              ? 'Add an answer linked to this question.'
              : isEdit
                ? 'Edit the Mandarin, Pinyin, and English for this phrase.'
                : 'Add a new phrase with Mandarin, Pinyin, and English.'}
          </DialogDescription>
        </DialogHeader>

        {step.kind === 'prompt-answer' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">Add an answer to this question now?</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Skip
              </Button>
              <Button type="button" onClick={() => startAuthoringAnswer(step.question)}>
                Yes
              </Button>
            </div>
          </div>
        )}

        {step.kind === 'prompt-another' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">Add another answer?</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Done
              </Button>
              <Button type="button" onClick={() => startAuthoringAnswer(step.question)}>
                Add another
              </Button>
            </div>
          </div>
        )}

        {(step.kind === 'form' || step.kind === 'author-answer') && (
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

            {!isAuthoringAnswer && (
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
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Saving…'
                  : isAuthoringAnswer
                    ? 'Add answer'
                    : isEdit
                      ? 'Save changes'
                      : 'Add phrase'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
