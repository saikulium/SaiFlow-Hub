import { z } from 'zod'

export const auditQuerySchema = z.object({
  actorId: z.string().optional(),
  actorType: z.enum(['USER', 'SYSTEM', 'AGENT']).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
  correlationId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export type AuditQuery = z.infer<typeof auditQuerySchema>
