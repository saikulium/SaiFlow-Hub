import { z } from 'zod'

export const createCommessaSchema = z.object({
  title: z.string().min(1, 'Titolo obbligatorio').max(200),
  description: z.string().max(5000).optional(),
  client_id: z.string().min(1, 'Cliente obbligatorio'),
  client_value: z.number().min(0).optional(),
  currency: z.string().default('EUR'),
  deadline: z.string().datetime().optional(),
  category: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  tags: z.array(z.string()).default([]),
  assigned_to: z.string().optional(),
})

export const updateCommessaSchema = createCommessaSchema.partial().extend({
  status: z
    .enum(['DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .optional(),
})

export type CreateCommessaInput = z.infer<typeof createCommessaSchema>
export type UpdateCommessaInput = z.infer<typeof updateCommessaSchema>
