import { z } from 'zod'

export const EMAIL_INTENTS = [
  'CONFERMA_ORDINE',
  'RITARDO_CONSEGNA',
  'VARIAZIONE_PREZZO',
  'RICHIESTA_INFO',
  'FATTURA_ALLEGATA',
  'ORDINE_CLIENTE',
  'ALTRO',
] as const

export type EmailIntent = (typeof EMAIL_INTENTS)[number]

const ClientOrderItemSchema = z.object({
  description: z.string(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
})

export const EmailClassificationSchema = z.object({
  intent: z.enum(EMAIL_INTENTS),
  confidence: z.number().min(0).max(1),
  matched_request_code: z.string().nullable(),
  vendor_name: z.string().nullable(),
  external_ref: z.string().nullable(),
  new_amount: z.number().nullable(),
  new_delivery_date: z.string().nullable(),
  tracking_number: z.string().nullable(),
  summary: z.string(),
  client_name: z.string().nullable(),
  client_code: z.string().nullable(),
  client_order_items: z.array(ClientOrderItemSchema).nullable(),
  client_deadline: z.string().nullable(),
  client_value: z.number().nullable(),
})

export type EmailClassification = z.infer<typeof EmailClassificationSchema>
