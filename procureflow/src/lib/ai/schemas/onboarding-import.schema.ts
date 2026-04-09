import { z } from 'zod'

export const VendorMappingSchema = z.object({
  name: z.string(),
  code: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  vat_id: z.string().nullable(),
  category: z.array(z.string()),
  payment_terms: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
})

export const VendorBatchSchema = z.array(VendorMappingSchema)

export type VendorMapping = z.infer<typeof VendorMappingSchema>
