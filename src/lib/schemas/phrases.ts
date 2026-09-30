import { z } from 'zod'

export const phraseSchema = z.object({
  mandarin: z.string().trim().min(1, 'Mandarin is required'),
  pinyin: z.string().trim().min(1, 'Pinyin is required'),
  english: z.string().trim().min(1, 'English translation is required'),
  phrase_type: z.enum(['question', 'answer', 'statement']),
})

export type PhraseFormValues = z.infer<typeof phraseSchema>

export const attachToQuestionSchema = z.object({
  question_id: z.string(),
})

export type AttachToQuestionFormValues = z.infer<typeof attachToQuestionSchema>
