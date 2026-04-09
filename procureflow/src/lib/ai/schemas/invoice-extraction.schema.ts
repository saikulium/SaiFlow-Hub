import { z } from 'zod'

const LineItemSchema = z.object({
  line_number: z.number(),
  description: z.string(),
  quantity: z.number(),
  unit_of_measure: z.string().nullable(),
  unit_price: z.number(),
  total_price: z.number(),
  vat_rate: z.number(),
})

const SupplierSchema = z.object({
  name: z.string(),
  vat_id: z.string(),
  tax_code: z.string().nullable(),
  vat_country: z.string().default('IT'),
})

const CustomerSchema = z.object({
  vat_id: z.string(),
  tax_code: z.string().nullable(),
})

const PaymentSchema = z.object({
  method: z.string().nullable(),
  due_date: z.string().nullable(),
  iban: z.string().nullable(),
  terms: z.string().nullable(),
})

export const InvoiceExtractionSchema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string(),
  document_type: z.string().default('TD01'),
  total_amount: z.number(),
  total_taxable: z.number(),
  total_tax: z.number(),
  currency: z.string().default('EUR'),
  supplier: SupplierSchema,
  customer: CustomerSchema,
  causale: z.string().nullable(),
  pr_code_extracted: z.string().nullable(),
  line_items: z.array(LineItemSchema),
  payment: PaymentSchema.nullable(),
  ai_confidence: z.number().min(0).max(1),
})

export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>
