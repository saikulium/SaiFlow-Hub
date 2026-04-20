import { describe, it, expect } from 'vitest'
import { mapAiResponseToInvoice } from '@/modules/core/invoicing'

// ---------------------------------------------------------------------------
// Test per il mapping AI response → ParsedInvoice
//
// Non testiamo la chiamata Claude (richiede API key reale).
// Testiamo il mapping JSON → ParsedInvoice che è la parte critica.
// ---------------------------------------------------------------------------

describe('mapAiResponseToInvoice', () => {
  const COMPLETE_AI_RESPONSE = {
    invoice_number: 'FT-2025/0042',
    invoice_date: '2025-03-10',
    document_type: 'TD01',
    total_amount: 1220.0,
    total_taxable: 1000.0,
    total_tax: 220.0,
    currency: 'EUR',
    supplier: {
      name: 'Acme Srl',
      vat_id: '01234567890',
      tax_code: 'RSSMRA80A01H501U',
      vat_country: 'IT',
    },
    customer: {
      vat_id: '09876543210',
      tax_code: null,
    },
    causale: 'Fornitura materiale ufficio ref PR-2025-00012',
    pr_code_extracted: 'PR-2025-00012',
    line_items: [
      {
        line_number: 1,
        description: 'Carta A4 80g - 5 risme',
        quantity: 5,
        unit_of_measure: 'pz',
        unit_price: 120.0,
        total_price: 600.0,
        vat_rate: 22,
      },
      {
        line_number: 2,
        description: 'Toner HP LaserJet',
        quantity: 2,
        unit_of_measure: 'pz',
        unit_price: 200.0,
        total_price: 400.0,
        vat_rate: 22,
      },
    ],
    payment: {
      method: 'MP05',
      due_date: '2025-04-10',
      iban: 'IT60X0542811101000000123456',
      terms: '30gg DFFM',
    },
    ai_confidence: 0.92,
  }

  it('mappa una risposta AI completa a ParsedInvoice', () => {
    const result = mapAiResponseToInvoice(COMPLETE_AI_RESPONSE, 'fattura.pdf')

    expect(result.invoice_number).toBe('FT-2025/0042')
    expect(result.invoice_date).toEqual(new Date('2025-03-10'))
    expect(result.document_type).toBe('TD01')
    expect(result.document_type_label).toBe('Fattura')
    expect(result.total_amount).toBe(1220.0)
    expect(result.total_taxable).toBe(1000.0)
    expect(result.total_tax).toBe(220.0)
  })

  it('mappa i dati fornitore', () => {
    const result = mapAiResponseToInvoice(COMPLETE_AI_RESPONSE, 'fattura.pdf')

    expect(result.supplier.name).toBe('Acme Srl')
    expect(result.supplier.vat_id).toBe('01234567890')
    expect(result.supplier.tax_code).toBe('RSSMRA80A01H501U')
    expect(result.supplier.vat_country).toBe('IT')
  })

  it('mappa i dati cliente', () => {
    const result = mapAiResponseToInvoice(COMPLETE_AI_RESPONSE, 'fattura.pdf')

    expect(result.customer.vat_id).toBe('09876543210')
    expect(result.customer.tax_code).toBeUndefined()
  })

  it('mappa le righe fattura', () => {
    const result = mapAiResponseToInvoice(COMPLETE_AI_RESPONSE, 'fattura.pdf')

    expect(result.line_items).toHaveLength(2)
    expect(result.line_items[0]!.description).toBe('Carta A4 80g - 5 risme')
    expect(result.line_items[0]!.quantity).toBe(5)
    expect(result.line_items[0]!.unit_price).toBe(120.0)
    expect(result.line_items[0]!.total_price).toBe(600.0)
    expect(result.line_items[0]!.vat_rate).toBe(22)
    expect(result.line_items[1]!.description).toBe('Toner HP LaserJet')
  })

  it('mappa i dati di pagamento', () => {
    const result = mapAiResponseToInvoice(COMPLETE_AI_RESPONSE, 'fattura.pdf')

    expect(result.payment).toBeDefined()
    expect(result.payment!.method).toBe('MP05')
    expect(result.payment!.method_label).toBe('Bonifico')
    expect(result.payment!.due_date).toEqual(new Date('2025-04-10'))
    expect(result.payment!.iban).toBe('IT60X0542811101000000123456')
    expect(result.payment!.terms).toBe('30gg DFFM')
  })

  it('estrae il codice PR', () => {
    const result = mapAiResponseToInvoice(COMPLETE_AI_RESPONSE, 'fattura.pdf')
    expect(result.pr_code_extracted).toBe('PR-2025-00012')
  })

  it('gestisce risposta con campi mancanti (graceful defaults)', () => {
    const minimal = {
      invoice_number: null,
      invoice_date: null,
      document_type: null,
      total_amount: null,
      total_taxable: null,
      total_tax: null,
      currency: null,
      supplier: null,
      customer: null,
      causale: null,
      pr_code_extracted: null,
      line_items: null,
      payment: null,
      ai_confidence: null,
    }

    const result = mapAiResponseToInvoice(minimal, 'scan.jpg')

    expect(result.invoice_number).toBe('')
    expect(result.invoice_date).toBeInstanceOf(Date)
    expect(result.document_type).toBe('TD01')
    expect(result.supplier.name).toBe('scan.jpg')
    expect(result.supplier.vat_id).toBe('')
    expect(result.supplier.vat_country).toBe('IT')
    expect(result.customer.vat_id).toBe('')
    expect(result.line_items).toHaveLength(0)
    expect(result.total_amount).toBe(0)
    expect(result.payment).toBeUndefined()
    expect(result.format).toBe('FPR12')
  })

  it('calcola total_amount da taxable + tax quando mancante', () => {
    const withoutTotal = {
      ...COMPLETE_AI_RESPONSE,
      total_amount: null,
    }

    const result = mapAiResponseToInvoice(withoutTotal, 'fattura.pdf')
    expect(result.total_amount).toBe(1220.0) // 1000 + 220
  })

  it('calcola total_taxable dalla somma delle righe quando mancante', () => {
    const withoutTaxable = {
      ...COMPLETE_AI_RESPONSE,
      total_taxable: null,
    }

    const result = mapAiResponseToInvoice(withoutTaxable, 'fattura.pdf')
    expect(result.total_taxable).toBe(1000.0) // 600 + 400
  })

  it('usa filename come nome fornitore quando supplier.name è null', () => {
    const withoutSupplierName = {
      ...COMPLETE_AI_RESPONSE,
      supplier: { ...COMPLETE_AI_RESPONSE.supplier, name: null },
    }

    const result = mapAiResponseToInvoice(
      withoutSupplierName,
      'fattura-acme.pdf',
    )
    expect(result.supplier.name).toBe('fattura-acme.pdf')
  })

  it('assegna line_number sequenziale quando mancante', () => {
    const withoutLineNumbers = {
      ...COMPLETE_AI_RESPONSE,
      line_items: [
        { ...COMPLETE_AI_RESPONSE.line_items[0]!, line_number: null },
        { ...COMPLETE_AI_RESPONSE.line_items[1]!, line_number: null },
      ],
    }

    const result = mapAiResponseToInvoice(withoutLineNumbers, 'fattura.pdf')
    expect(result.line_items[0]!.line_number).toBe(1)
    expect(result.line_items[1]!.line_number).toBe(2)
  })

  it('mappa nota di credito (TD04)', () => {
    const creditNote = {
      ...COMPLETE_AI_RESPONSE,
      document_type: 'TD04',
    }

    const result = mapAiResponseToInvoice(creditNote, 'nota-credito.pdf')
    expect(result.document_type).toBe('TD04')
    expect(result.document_type_label).toBe('Nota di credito')
  })

  it('gestisce metodo pagamento sconosciuto', () => {
    const unknownPayment = {
      ...COMPLETE_AI_RESPONSE,
      payment: { ...COMPLETE_AI_RESPONSE.payment, method: 'BONIFICO' },
    }

    const result = mapAiResponseToInvoice(unknownPayment, 'fattura.pdf')
    expect(result.payment!.method).toBe('BONIFICO')
    expect(result.payment!.method_label).toBe('BONIFICO')
  })

  it('imposta order_references come array vuoto', () => {
    const result = mapAiResponseToInvoice(COMPLETE_AI_RESPONSE, 'fattura.pdf')
    expect(result.order_references).toEqual([])
  })

  it('genera tax_summary dal primo item', () => {
    const result = mapAiResponseToInvoice(COMPLETE_AI_RESPONSE, 'fattura.pdf')
    expect(result.tax_summary).toHaveLength(1)
    expect(result.tax_summary[0]!.vat_rate).toBe(22)
    expect(result.tax_summary[0]!.taxable_amount).toBe(1000.0)
    expect(result.tax_summary[0]!.tax_amount).toBe(220.0)
  })
})
