// ---------------------------------------------------------------------------
// Order Confirmation validations — Zod schemas for public API + service input.
// ---------------------------------------------------------------------------

import { z } from 'zod'

const dateLike = z
  .union([z.string().datetime(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))

/** Nuova riga di una conferma d'ordine. */
export const orderConfirmationLineSchema = z.object({
  // Link al RequestItem (preferito). In alternativa si può tentare un match
  // per SKU / nome sul request_id associato.
  request_item_id: z.string().optional(),
  match_by_sku: z.string().optional(),
  match_by_name: z.string().optional(),

  // Valori confermati dal fornitore (tutti opzionali: se assenti significa
  // "nessuna variazione su quel campo rispetto all'originale").
  confirmed_name: z.string().min(1).optional(),
  confirmed_quantity: z.number().int().min(0).optional(),
  confirmed_unit: z.string().optional(),
  confirmed_unit_price: z.number().min(0).optional(),
  confirmed_delivery: dateLike.optional(),
  confirmed_sku: z.string().optional(),

  notes: z.string().max(2000).optional(),
})

export const orderConfirmationSourceSchema = z.enum([
  'EMAIL',
  'WEBHOOK',
  'MANUAL',
  'IMPORT',
])

export const createOrderConfirmationSchema = z.object({
  request_id: z.string().min(1, 'request_id obbligatorio'),
  source: orderConfirmationSourceSchema.default('MANUAL'),
  email_log_id: z.string().optional(),
  vendor_reference: z.string().max(200).optional(),
  subject: z.string().max(500).optional(),
  received_at: dateLike.optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lines: z.array(orderConfirmationLineSchema).min(1, 'Almeno una riga'),
})

export const applyConfirmationSchema = z.object({
  accepted_line_ids: z
    .array(z.string().min(1))
    .min(1, 'Almeno una riga da accettare'),
  notes: z.string().max(2000).optional(),
})

export const rejectConfirmationSchema = z.object({
  reason: z.string().min(1, 'Motivazione obbligatoria').max(2000),
})

/** Reject granulare per riga: propaga UNAVAILABLE o CANCELLED al RequestItem. */
export const rejectLinesSchema = z.object({
  rejected_line_ids: z
    .array(z.string().min(1))
    .min(1, 'Almeno una riga da rifiutare'),
  reason: z.string().min(1, 'Motivazione obbligatoria').max(2000),
  new_request_item_status: z.enum(['UNAVAILABLE', 'CANCELLED']),
})

export type CreateOrderConfirmationInput = z.infer<
  typeof createOrderConfirmationSchema
>
export type OrderConfirmationLineInput = z.infer<
  typeof orderConfirmationLineSchema
>
export type ApplyConfirmationInput = z.infer<typeof applyConfirmationSchema>
export type RejectConfirmationInput = z.infer<typeof rejectConfirmationSchema>
export type RejectLinesInput = z.infer<typeof rejectLinesSchema>
