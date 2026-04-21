// ---------------------------------------------------------------------------
// RequestItemShipment validations — Zod schemas for public API + service input.
// ---------------------------------------------------------------------------

import { z } from 'zod'

const dateLike = z
  .union([z.string().datetime(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))

export const shipmentStatusSchema = z.enum([
  'PENDING',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
  'LOST',
  'CANCELLED',
])

export const shipmentSourceSchema = z.enum([
  'MANUAL',
  'EMAIL',
  'DDT_PARSING',
  'API',
])

const decimalString = z
  .union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,4})?$/)])
  .transform((v) => (typeof v === 'number' ? v.toString() : v))

export const createShipmentSchema = z.object({
  shipped_quantity: decimalString,
  expected_ship_date: dateLike.optional(),
  actual_ship_date: dateLike.optional(),
  expected_delivery_date: dateLike.optional(),
  actual_delivery_date: dateLike.optional(),
  tracking_number: z.string().max(200).optional(),
  carrier: z.string().max(100).optional(),
  tracking_url: z.string().url().max(500).optional(),
  status: shipmentStatusSchema.optional(),
  source: shipmentSourceSchema.optional(),
  source_email_log_id: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const updateShipmentStatusSchema = z.object({
  status: shipmentStatusSchema,
  actual_ship_date: dateLike.nullable().optional(),
  actual_delivery_date: dateLike.nullable().optional(),
  notes: z.string().max(2000).optional(),
})

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>
export type UpdateShipmentStatusInput = z.infer<
  typeof updateShipmentStatusSchema
>
