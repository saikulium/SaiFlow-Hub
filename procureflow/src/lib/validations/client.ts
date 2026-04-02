import { z } from 'zod'

export const createClientSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1, 'Nome obbligatorio').max(200),
  tax_id: z.string().max(20).optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  contact_person: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})

export const updateClientSchema = createClientSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_REVIEW']).optional(),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
