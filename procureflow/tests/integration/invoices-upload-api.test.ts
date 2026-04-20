import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  email: 'mario@test.it',
  name: 'Mario Rossi',
  role: 'ADMIN',
}

const mockPrisma = {
  invoice: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  vendor: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  purchaseRequest: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  timelineEvent: {
    create: vi.fn(),
  },
}

const mockParseFatturaPA = vi.fn()
const mockMatchInvoiceToOrder = vi.fn()
const mockPerformThreeWayMatch = vi.fn()

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(() => Promise.resolve(mockUser)),
}))
vi.mock('@/lib/modules/require-module', () => ({
  requireModule: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('@/server/services/fatturapa-parser.service', () => ({
  parseFatturaPA: mockParseFatturaPA,
  FatturaParseError: class extends Error {
    constructor(msg: string) {
      super(msg)
    }
  },
}))
vi.mock('@/modules/core/invoicing/server/invoice-ai-parser.service', () => ({
  parseInvoiceWithAI: vi.fn(),
  AiParseError: class extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.code = code
    }
  },
}))
vi.mock('@/modules/core/invoicing/server/invoice-matching.service', () => ({
  matchInvoiceToOrder: mockMatchInvoiceToOrder,
}))
vi.mock('@/modules/core/invoicing/server/three-way-matching.service', () => ({
  performThreeWayMatch: mockPerformThreeWayMatch,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sampleXml = `<?xml version="1.0"?>
<FatturaElettronica>
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdCodice>IT12345678901</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Fornitore SRL</Denominazione></Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
  </FatturaElettronicaHeader>
</FatturaElettronica>`

function makeFormData(filename: string, content: string, mimeType: string) {
  const formData = new FormData()
  const blob = new Blob([content], { type: mimeType })
  formData.append('file', new File([blob], filename, { type: mimeType }))
  return formData
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/invoices/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects request without file', async () => {
    const { POST } = await import('@/app/api/invoices/upload/route')
    const req = new Request('http://localhost:3000/api/invoices/upload', {
      method: 'POST',
      body: new FormData(),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('MISSING_FILE')
  })

  it('rejects unsupported file format', async () => {
    const { POST } = await import('@/app/api/invoices/upload/route')
    const formData = makeFormData('doc.txt', 'hello', 'text/plain')
    const req = new Request('http://localhost:3000/api/invoices/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('UNSUPPORTED_FORMAT')
  })

  it('processes XML fattura with deterministic parser', async () => {
    mockParseFatturaPA.mockReturnValue({
      invoice_number: 'FT-001',
      invoice_date: new Date('2026-01-15'),
      document_type: 'TD01',
      total_taxable: 1000,
      total_tax: 220,
      total_amount: 1220,
      supplier: { name: 'Fornitore SRL', vat_id: 'IT12345678901' },
      customer: { vat_id: 'IT98765432109' },
      line_items: [
        {
          line_number: 1,
          description: 'Servizio consulenza',
          quantity: 1,
          unit_price: 1000,
          total_price: 1000,
          vat_rate: 22,
        },
      ],
      order_references: [],
      payment: null,
      causale: null,
      pr_code_extracted: null,
    })

    // No duplicate
    mockPrisma.invoice.findFirst.mockResolvedValue(null)
    // Vendor exists
    mockPrisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' })
    // Create invoice
    mockPrisma.invoice.create.mockResolvedValue({
      id: 'inv-1',
      invoice_number: 'FT-001',
    })
    // Matching: no match
    mockMatchInvoiceToOrder.mockResolvedValue({
      status: 'UNMATCHED',
      confidence: 0,
    })
    // Timeline
    mockPrisma.timelineEvent.create.mockResolvedValue({})

    const { POST } = await import('@/app/api/invoices/upload/route')
    const formData = makeFormData('fattura.xml', sampleXml, 'text/xml')
    const req = new Request('http://localhost:3000/api/invoices/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.invoice_number).toBe('FT-001')
    expect(body.data.match_status).toBe('UNMATCHED')
    expect(mockParseFatturaPA).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate invoice (same number + VAT ID)', async () => {
    mockParseFatturaPA.mockReturnValue({
      invoice_number: 'FT-DUP',
      invoice_date: new Date(),
      document_type: 'TD01',
      total_taxable: 100,
      total_tax: 22,
      total_amount: 122,
      supplier: { name: 'Test', vat_id: 'IT11111111111' },
      customer: { vat_id: 'IT22222222222' },
      line_items: [],
      order_references: [],
      payment: null,
      causale: null,
      pr_code_extracted: null,
    })

    // Duplicate found
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: 'existing',
      invoice_number: 'FT-DUP',
    })

    const { POST } = await import('@/app/api/invoices/upload/route')
    const formData = makeFormData('dup.xml', sampleXml, 'text/xml')
    const req = new Request('http://localhost:3000/api/invoices/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('DUPLICATE')
  })

  it('auto-creates vendor when not found by VAT ID', async () => {
    mockParseFatturaPA.mockReturnValue({
      invoice_number: 'FT-NEW',
      invoice_date: new Date(),
      document_type: 'TD01',
      total_taxable: 500,
      total_tax: 110,
      total_amount: 610,
      supplier: { name: 'Nuovo Fornitore', vat_id: 'IT99999999999' },
      customer: { vat_id: 'IT88888888888' },
      line_items: [],
      order_references: [],
      payment: null,
      causale: null,
      pr_code_extracted: null,
    })

    mockPrisma.invoice.findFirst.mockResolvedValue(null)
    // Vendor NOT found
    mockPrisma.vendor.findFirst.mockResolvedValue(null)
    // Auto-create vendor
    mockPrisma.vendor.create.mockResolvedValue({ id: 'vendor-new' })
    mockPrisma.invoice.create.mockResolvedValue({
      id: 'inv-2',
      invoice_number: 'FT-NEW',
    })
    mockMatchInvoiceToOrder.mockResolvedValue({
      status: 'UNMATCHED',
      confidence: 0,
    })
    mockPrisma.timelineEvent.create.mockResolvedValue({})

    const { POST } = await import('@/app/api/invoices/upload/route')
    const formData = makeFormData('new-vendor.xml', sampleXml, 'text/xml')
    const req = new Request('http://localhost:3000/api/invoices/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vat_id: 'IT99999999999',
          status: 'PENDING_REVIEW',
        }),
      }),
    )
  })
})
