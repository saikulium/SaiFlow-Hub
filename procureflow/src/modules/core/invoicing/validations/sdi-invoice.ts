import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema Zod per il payload del webhook SDI (ricezione fatture passive)
// ---------------------------------------------------------------------------

const sdiLineItemSchema = z.object({
  line_number: z.number().int().positive(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_of_measure: z.string().optional(),
  unit_price: z.number(),
  total_price: z.number(),
  vat_rate: z.number().min(0).max(100),
  vat_nature: z.string().optional(),
  sku: z.string().optional(),
  order_ref: z.string().optional(),
  cig: z.string().optional(),
  cup: z.string().optional(),
})

const sdiOrderReferenceSchema = z.object({
  id_documento: z.string().optional(),
  data: z.string().optional(),
  num_item: z.string().optional(),
  codice_commessa: z.string().optional(),
  codice_cig: z.string().optional(),
  codice_cup: z.string().optional(),
})

export const sdiInvoiceWebhookSchema = z.object({
  // Metadati SDI
  sdi_id: z.string().optional(),
  sdi_filename: z.string().optional(),
  sdi_status: z.string().optional(),

  // Fattura XML — base64 encoded o plain text
  invoice_xml: z.string().optional(),

  // Evento
  event_type: z.enum([
    'invoice_received',
    'invoice_accepted',
    'invoice_rejected',
    'notification',
  ]),

  // Dati pre-estratti dal provider (alternativa al parsing XML in-app)
  sender_vat_id: z.string().optional(),
  sender_name: z.string().optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  document_type: z.string().optional(),
  total_taxable: z.number().optional(),
  total_tax: z.number().optional(),
  total_amount: z.number().optional(),
  currency: z.string().default('EUR'),
  causale: z.string().optional(),

  // Riferimenti ordine
  order_references: z.array(sdiOrderReferenceSchema).default([]),

  // Righe fattura pre-estratte
  line_items: z.array(sdiLineItemSchema).default([]),

  // Pagamento
  payment_method: z.string().optional(),
  payment_due_date: z.string().optional(),
  payment_iban: z.string().optional(),

  // Timestamp
  timestamp: z.string().optional(),
})

export type SdiInvoiceWebhookPayload = z.infer<typeof sdiInvoiceWebhookSchema>
