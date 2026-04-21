import { describe, it, expect } from 'vitest'
import {
  mapAiResponseToClassification,
  mapClassificationToPayload,
  type RawEmailData,
  type ClassificationResult,
} from '@/modules/core/email-intelligence'

// ---------------------------------------------------------------------------
// Test per mapAiResponseToClassification
// ---------------------------------------------------------------------------

describe('mapAiResponseToClassification', () => {
  const CLIENT_DEFAULTS = {
    client_name: null,
    client_code: null,
    client_order_items: null,
    client_deadline: null,
    client_value: null,
  } as const

  it('mappa una risposta AI completa', () => {
    const raw = {
      intent: 'CONFERMA_ORDINE' as const,
      confidence: 0.95,
      matched_request_code: 'PR-2025-00042',
      vendor_name: 'Acme Srl',
      external_ref: 'PO-12345',
      new_amount: null,
      new_delivery_date: null,
      tracking_number: 'TRK-789',
      summary: 'Conferma ricezione ordine PR-2025-00042 da Acme Srl',
      ...CLIENT_DEFAULTS,
    }

    const result = mapAiResponseToClassification(raw)

    expect(result.intent).toBe('CONFERMA_ORDINE')
    expect(result.confidence).toBe(0.95)
    expect(result.extracted_data.matched_request_code).toBe('PR-2025-00042')
    expect(result.extracted_data.vendor_name).toBe('Acme Srl')
    expect(result.extracted_data.external_ref).toBe('PO-12345')
    expect(result.extracted_data.tracking_number).toBe('TRK-789')
    expect(result.extracted_data.summary).toBe(
      'Conferma ricezione ordine PR-2025-00042 da Acme Srl',
    )
  })

  it('mappa RITARDO_CONSEGNA con nuova data', () => {
    const raw = {
      intent: 'RITARDO_CONSEGNA' as const,
      confidence: 0.88,
      matched_request_code: 'PR-2025-00010',
      vendor_name: 'Tech Solutions',
      external_ref: null,
      new_amount: null,
      new_delivery_date: '2025-04-15',
      tracking_number: null,
      summary: 'Ritardo di 5 giorni nella consegna',
      ...CLIENT_DEFAULTS,
    }

    const result = mapAiResponseToClassification(raw)

    expect(result.intent).toBe('RITARDO_CONSEGNA')
    expect(result.extracted_data.new_delivery_date).toBe('2025-04-15')
    expect(result.extracted_data.new_amount).toBeUndefined()
  })

  it('mappa VARIAZIONE_PREZZO con nuovo importo', () => {
    const raw = {
      intent: 'VARIAZIONE_PREZZO' as const,
      confidence: 0.82,
      matched_request_code: 'PR-2025-00020',
      vendor_name: null,
      external_ref: null,
      new_amount: 1500.0,
      new_delivery_date: null,
      tracking_number: null,
      summary: 'Variazione prezzo da 1200 a 1500 EUR',
      ...CLIENT_DEFAULTS,
    }

    const result = mapAiResponseToClassification(raw)

    expect(result.intent).toBe('VARIAZIONE_PREZZO')
    expect(result.extracted_data.new_amount).toBe(1500.0)
    expect(result.extracted_data.vendor_name).toBeUndefined()
  })

  it('fallback a ALTRO per intent sconosciuto', () => {
    const raw = {
      intent: 'INTENT_INVENTATO' as never,
      confidence: 0.3,
      matched_request_code: null,
      vendor_name: null,
      external_ref: null,
      new_amount: null,
      new_delivery_date: null,
      tracking_number: null,
      summary: 'Email non classificabile',
      ...CLIENT_DEFAULTS,
    }

    const result = mapAiResponseToClassification(raw)
    expect(result.intent).toBe('ALTRO')
  })

  it('fallback a ALTRO per intent null', () => {
    const raw = {
      intent: null as never,
      confidence: null,
      matched_request_code: null,
      vendor_name: null,
      external_ref: null,
      new_amount: null,
      new_delivery_date: null,
      tracking_number: null,
      summary: null,
      ...CLIENT_DEFAULTS,
    }

    const result = mapAiResponseToClassification(raw)

    expect(result.intent).toBe('ALTRO')
    expect(result.confidence).toBe(0.5)
    expect(result.extracted_data.summary).toBe('Nessun riepilogo disponibile')
  })

  it('clamp confidence tra 0 e 1', () => {
    const overOne = {
      intent: 'CONFERMA_ORDINE' as const,
      confidence: 1.5,
      matched_request_code: null,
      vendor_name: null,
      external_ref: null,
      new_amount: null,
      new_delivery_date: null,
      tracking_number: null,
      summary: 'test',
      ...CLIENT_DEFAULTS,
    }

    expect(mapAiResponseToClassification(overOne).confidence).toBe(1)

    const negative = { ...overOne, confidence: -0.5 }
    expect(mapAiResponseToClassification(negative).confidence).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test per mapClassificationToPayload
// ---------------------------------------------------------------------------

describe('mapClassificationToPayload', () => {
  const RAW_EMAIL: RawEmailData = {
    email_from: 'fornitore@acme.it',
    email_to: 'procurement@mycompany.it',
    email_subject: 'Conferma ordine PR-2025-00042',
    email_body: "Vi confermiamo la ricezione dell'ordine PO-12345.",
    email_date: '2025-03-10',
    email_message_id: '<msg-123@acme.it>',
  }

  it('mappa CONFERMA_ORDINE → action update_existing con status ORDERED', () => {
    const classification: ClassificationResult = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.92,
      extracted_data: {
        matched_request_code: 'PR-2025-00042',
        vendor_name: 'Acme Srl',
        external_ref: 'PO-12345',
        summary: 'Conferma ordine PO-12345',
      },
    }

    const payload = mapClassificationToPayload(RAW_EMAIL, classification)

    expect(payload.action).toBe('update_existing')
    expect(payload.ai_status_update).toBe('ORDERED')
    expect(payload.ai_matched_request_code).toBe('PR-2025-00042')
    expect(payload.ai_vendor_name).toBe('Acme Srl')
    expect(payload.ai_external_ref).toBe('PO-12345')
    expect(payload.ai_confidence).toBe(0.92)
    expect(payload.ai_summary).toBe('Conferma ordine PO-12345')
    expect(payload.email_from).toBe('fornitore@acme.it')
    expect(payload.email_subject).toBe('Conferma ordine PR-2025-00042')
  })

  it('mappa RITARDO_CONSEGNA → update_existing con expected_delivery', () => {
    const classification: ClassificationResult = {
      intent: 'RITARDO_CONSEGNA',
      confidence: 0.85,
      extracted_data: {
        matched_request_code: 'PR-2025-00010',
        new_delivery_date: '2025-04-15',
        summary: 'Ritardo consegna di 5 giorni',
      },
    }

    const payload = mapClassificationToPayload(RAW_EMAIL, classification)

    expect(payload.action).toBe('update_existing')
    expect(payload.ai_expected_delivery).toBe('2025-04-15')
    expect(payload.ai_status_update).toBeUndefined()
  })

  it('mappa VARIAZIONE_PREZZO → update_existing con actual_amount', () => {
    const classification: ClassificationResult = {
      intent: 'VARIAZIONE_PREZZO',
      confidence: 0.8,
      extracted_data: {
        matched_request_code: 'PR-2025-00020',
        new_amount: 1500.0,
        summary: 'Prezzo aggiornato a 1500 EUR',
      },
    }

    const payload = mapClassificationToPayload(RAW_EMAIL, classification)

    expect(payload.action).toBe('update_existing')
    expect(payload.ai_actual_amount).toBe(1500.0)
    expect(payload.ai_status_update).toBeUndefined()
  })

  it('mappa RICHIESTA_INFO → action info_only', () => {
    const classification: ClassificationResult = {
      intent: 'RICHIESTA_INFO',
      confidence: 0.9,
      extracted_data: {
        matched_request_code: 'PR-2025-00042',
        summary: 'Richiesta chiarimenti su quantità ordine',
      },
    }

    const payload = mapClassificationToPayload(RAW_EMAIL, classification)

    expect(payload.action).toBe('info_only')
    expect(payload.ai_status_update).toBeUndefined()
  })

  it('mappa FATTURA_ALLEGATA → action info_only', () => {
    const classification: ClassificationResult = {
      intent: 'FATTURA_ALLEGATA',
      confidence: 0.95,
      extracted_data: {
        vendor_name: 'Acme Srl',
        summary: 'Fattura FT-2025/0042 allegata',
      },
    }

    const payload = mapClassificationToPayload(RAW_EMAIL, classification)

    expect(payload.action).toBe('info_only')
    expect(payload.ai_tags).toContain('ai-intent:FATTURA_ALLEGATA')
  })

  it('mappa ALTRO → action info_only', () => {
    const classification: ClassificationResult = {
      intent: 'ALTRO',
      confidence: 0.6,
      extracted_data: {
        summary: 'Email promozionale del fornitore',
      },
    }

    const payload = mapClassificationToPayload(RAW_EMAIL, classification)

    expect(payload.action).toBe('info_only')
    expect(payload.ai_tags).toContain('ai-intent:ALTRO')
  })

  it('preserva i dati email grezzi nel payload', () => {
    const classification: ClassificationResult = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.9,
      extracted_data: { summary: 'test' },
    }

    const payload = mapClassificationToPayload(RAW_EMAIL, classification)

    expect(payload.email_from).toBe(RAW_EMAIL.email_from)
    expect(payload.email_to).toBe(RAW_EMAIL.email_to)
    expect(payload.email_subject).toBe(RAW_EMAIL.email_subject)
    expect(payload.email_body).toBe(RAW_EMAIL.email_body)
    expect(payload.email_date).toBe(RAW_EMAIL.email_date)
    expect(payload.email_message_id).toBe(RAW_EMAIL.email_message_id)
  })

  it('imposta valori default per campi non estratti', () => {
    const classification: ClassificationResult = {
      intent: 'ALTRO',
      confidence: 0.5,
      extracted_data: { summary: 'test' },
    }

    const payload = mapClassificationToPayload(RAW_EMAIL, classification)

    expect(payload.ai_currency).toBe('EUR')
    expect(payload.ai_items).toEqual([])
    expect(payload.attachments).toEqual([])
    expect(payload.ai_vendor_code).toBeUndefined()
    expect(payload.ai_title).toBeUndefined()
    expect(payload.ai_priority).toBeUndefined()
  })
})
