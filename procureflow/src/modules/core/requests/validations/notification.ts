import { z } from 'zod'

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  read: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
})

export const markReadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

export type NotificationQuery = z.infer<typeof notificationQuerySchema>
export type MarkReadInput = z.infer<typeof markReadSchema>
