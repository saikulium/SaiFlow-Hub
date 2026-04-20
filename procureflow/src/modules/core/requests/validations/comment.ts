import { z } from 'zod'

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Il commento non può essere vuoto').max(5000),
  is_internal: z.boolean().default(true),
})

export const commentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type CommentQuery = z.infer<typeof commentQuerySchema>
