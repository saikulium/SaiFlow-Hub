import { z } from 'zod'

export const requestItemSchema = z.object({
  name: z.string().min(1, 'Nome articolo obbligatorio'),
  description: z.string().optional(),
  quantity: z.number().int().min(1, 'Quantità minima 1'),
  unit: z.string().optional(),
  unit_price: z.number().min(0).optional(),
  total_price: z.number().min(0).optional(),
  sku: z.string().optional(),
})

export const createRequestSchema = z.object({
  title: z.string().min(1, 'Titolo obbligatorio').max(200),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  vendor_id: z.string().optional(),
  estimated_amount: z.number().min(0).optional(),
  needed_by: z.string().optional(),
  category: z.string().optional(),
  department: z.string().optional(),
  cost_center: z.string().optional(),
  budget_code: z.string().optional(),
  cig: z
    .string()
    .regex(/^[A-Za-z0-9]{10}$/, 'CIG deve essere di 10 caratteri alfanumerici')
    .transform((v) => v.toUpperCase())
    .optional()
    .or(z.literal('')),
  cup: z
    .string()
    .regex(/^[A-Za-z0-9]{15}$/, 'CUP deve essere di 15 caratteri alfanumerici')
    .transform((v) => v.toUpperCase())
    .optional()
    .or(z.literal('')),
  is_mepa: z.boolean().default(false),
  mepa_oda_number: z.string().optional(),
  commessa_id: z.string().optional(),
  tags: z.array(z.string()).default([]),
  items: z.array(requestItemSchema).default([]),
})

export const updateRequestSchema = createRequestSchema.partial().extend({
  status: z
    .enum([
      'DRAFT',
      'SUBMITTED',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'ORDERED',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'ON_HOLD',
      'INVOICED',
      'RECONCILED',
      'CLOSED',
    ])
    .optional(),
  actual_amount: z.number().min(0).optional(),
  tracking_number: z.string().optional(),
  external_ref: z.string().optional(),
  external_url: z.string().url().optional().or(z.literal('')),
  is_mepa: z.boolean().optional(),
  mepa_oda_number: z.string().optional(),
})

export const requestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  priority: z.string().optional(),
  vendor_id: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>
export type RequestQuery = z.infer<typeof requestQuerySchema>
