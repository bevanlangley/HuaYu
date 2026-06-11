import { z } from 'zod'

export const seedSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  source_url: z.union([z.string().trim().url('Must be a valid URL'), z.literal('')]).optional(),
  tag: z.string().trim().optional().or(z.literal('')),
})

export type SeedFormValues = z.infer<typeof seedSchema>
