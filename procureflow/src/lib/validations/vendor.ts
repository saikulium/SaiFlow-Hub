import { z } from 'zod'

export const createVendorSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(200),
  code: z.string().min(1, 'Codice obbligatorio').max(20),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('URL non valido').optional().or(z.literal('')),
  portal_url: z.string().url().optional().or(z.literal('')),
  portal_type: z
    .enum(['WEBSITE', 'EMAIL_ONLY', 'API', 'MARKETPLACE', 'PHONE'])
    .optional(),
  category: z.array(z.string()).default([]),
  payment_terms: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
})

export const updateVendorSchema = createVendorSchema.partial().extend({
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PENDING_REVIEW'])
    .optional(),
})

export type CreateVendorInput = z.infer<typeof createVendorSchema>
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>
