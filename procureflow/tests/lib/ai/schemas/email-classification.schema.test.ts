import { describe, it, expect } from 'vitest'
import { EmailClassificationSchema } from '@/lib/ai/schemas/email-classification.schema'

describe('EmailClassificationSchema', () => {
  it('validates a correct classification', () => {
    const valid = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.92,
      matched_request_code: 'PR-2026-00042',
      vendor_name: 'Amphenol Italia',
      external_ref: 'PO-12345',
      new_amount: null,
      new_delivery_date: null,
      tracking_number: null,
      summary: "Il fornitore conferma la ricezione dell'ordine.",
      client_name: null,
      client_code: null,
      client_order_items: null,
      client_deadline: null,
      client_value: null,
    }
    const result = EmailClassificationSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects invalid intent', () => {
    const invalid = {
      intent: 'INVALID_INTENT',
      confidence: 0.5,
      summary: 'test',
      matched_request_code: null,
      vendor_name: null,
      external_ref: null,
      new_amount: null,
      new_delivery_date: null,
      tracking_number: null,
      client_name: null,
      client_code: null,
      client_order_items: null,
      client_deadline: null,
      client_value: null,
    }
    const result = EmailClassificationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects confidence > 1', () => {
    const invalid = {
      intent: 'ALTRO',
      confidence: 1.5,
      summary: 'test',
      matched_request_code: null,
      vendor_name: null,
      external_ref: null,
      new_amount: null,
      new_delivery_date: null,
      tracking_number: null,
      client_name: null,
      client_code: null,
      client_order_items: null,
      client_deadline: null,
      client_value: null,
    }
    const result = EmailClassificationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})
