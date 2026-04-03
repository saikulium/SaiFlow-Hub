import { z } from 'zod'

export const suggestRequestSchema = z.object({
  title: z.string().min(3, 'Titolo troppo corto per suggerimenti').max(200),
})

export type SuggestRequestInput = z.infer<typeof suggestRequestSchema>
