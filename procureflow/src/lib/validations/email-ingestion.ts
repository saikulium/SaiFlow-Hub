import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema per il payload AI-enriched inviato da n8n dopo il parsing email
// ---------------------------------------------------------------------------

// Helper: OpenAI restituisce null per i campi vuoti, Zod .optional() accetta
// solo undefined. Usiamo .nullable().optional() + transform per normalizzare.
const nullableString = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v ?? undefined)

const nullableNumber = z
  .number()
  .nullable()
  .optional()
  .transform((v) => v ?? undefined)

/** Singolo item estratto dall'AI dal corpo dell'email */
const emailItemSchema = z.object({
  name: z.string().min(1, 'Nome articolo obbligatorio'),
  description: nullableString,
  quantity: z.number().int().positive().default(1),
  unit: nullableString,
  unit_price: nullableNumber,
  total_price: nullableNumber,
  sku: nullableString,
})

/** Allegato dall'email originale */
const emailAttachmentSchema = z.object({
  filename: z.string().min(1),
  url: z.string().url(),
  mime_type: nullableString,
  file_size: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
})

/**
 * Tipo di azione: l'AI in n8n decide se l'email riguarda:
 * - "new_request": nuova richiesta d'acquisto
 * - "update_existing": aggiornamento a una richiesta esistente
 * - "info_only": informazione generica, solo timeline event
 */
const actionTypeSchema = z.enum(['new_request', 'update_existing', 'info_only'])

const prioritySchema = z
  .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  .nullable()
  .optional()
  .transform((v) => v ?? undefined)

const statusUpdateSchema = z
  .enum([
    'DRAFT',
    'SUBMITTED',
    'ORDERED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'ON_HOLD',
  ])
  .nullable()
  .optional()
  .transform((v) => v ?? undefined)

/**
 * Payload completo inviato da n8n dopo il parsing AI dell'email.
 *
 * Campi "email_*" contengono i dati grezzi dell'email.
 * Campi "ai_*" contengono le informazioni estratte dall'AI.
 */
export const emailIngestionSchema = z.object({
  // --- Dati email grezzi ---
  email_from: z.string().min(1, 'Mittente obbligatorio'),
  email_to: nullableString,
  email_subject: z.string().min(1, 'Oggetto obbligatorio'),
  email_body: z.string().min(1, 'Corpo email obbligatorio'),
  email_date: nullableString,
  email_message_id: nullableString,

  // --- Analisi AI ---
  action: actionTypeSchema,

  // Matching con richiesta esistente (per update_existing)
  ai_matched_request_code: nullableString,
  ai_matched_external_ref: nullableString,

  // Matching fornitore
  ai_vendor_code: nullableString,
  ai_vendor_name: nullableString,

  // Dettagli richiesta (per new_request o arricchimento)
  ai_title: nullableString,
  ai_description: nullableString,
  ai_priority: prioritySchema,
  ai_category: nullableString,
  ai_department: nullableString,
  ai_needed_by: nullableString,

  // Importi
  ai_estimated_amount: nullableNumber,
  ai_actual_amount: nullableNumber,
  ai_currency: z.string().default('EUR'),

  // Tracking e stato
  ai_status_update: statusUpdateSchema,
  ai_tracking_number: nullableString,
  ai_external_ref: nullableString,
  ai_external_url: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => v ?? undefined),
  ai_expected_delivery: nullableString,

  // Items estratti
  ai_items: z.array(emailItemSchema).default([]),

  // Riepilogo AI dell'email (per timeline)
  ai_summary: nullableString,
  ai_confidence: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),

  // Tags suggeriti
  ai_tags: z.array(z.string()).default([]),

  // Allegati originali
  attachments: z.array(emailAttachmentSchema).default([]),
})

export type EmailIngestionPayload = z.infer<typeof emailIngestionSchema>
export type EmailItem = z.infer<typeof emailItemSchema>
export type ActionType = z.infer<typeof actionTypeSchema>
