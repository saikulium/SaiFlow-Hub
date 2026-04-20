import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUserFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: mockUserFindMany },
  },
}))

vi.mock('@/lib/webhook-auth', () => ({
  verifyWebhookAuth: vi.fn(
    (
      _body: string,
      _sig: string | null,
      auth: string | null,
      secret: string | undefined,
      _ts: string | null,
    ) => auth === `Bearer ${secret}`,
  ),
}))

const mockClassifyEmailIntent = vi.fn()
const mockMapClassificationToPayload = vi.fn()
vi.mock(
  '@/modules/core/email-intelligence/server/email-ai-classifier.service',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/modules/core/email-intelligence/server/email-ai-classifier.service')
    >('@/modules/core/email-intelligence/server/email-ai-classifier.service')
    return {
      ...actual,
      classifyEmailIntent: mockClassifyEmailIntent,
      mapClassificationToPayload: mockMapClassificationToPayload,
    }
  },
)

const mockProcessEmailIngestion = vi.fn()
vi.mock(
  '@/modules/core/email-intelligence/server/email-ingestion.service',
  () => ({
    processEmailIngestion: mockProcessEmailIngestion,
  }),
)

const mockCheckWebhookProcessed = vi.fn()
const mockRecordWebhookProcessed = vi.fn()
vi.mock('@/server/services/webhook-idempotency.service', () => ({
  checkWebhookProcessed: mockCheckWebhookProcessed,
  recordWebhookProcessed: mockRecordWebhookProcessed,
}))

const mockCreateNotification = vi.fn()
vi.mock('@/modules/core/requests/server/notification.service', () => ({
  createNotification: mockCreateNotification,
  NOTIFICATION_TYPES: {
    EMAIL_INGESTION: 'EMAIL_INGESTION',
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-classify-secret'

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new NextRequest(
    'http://localhost:3000/api/webhooks/email-ingestion/classify',
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WEBHOOK_SECRET}`,
        'x-webhook-id': `classify-${Date.now()}`,
        'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        ...headers,
      },
    },
  )
}

const rawEmail = {
  email_from: 'fornitore@acme.it',
  email_subject: 'Conferma ordine n. 42',
  email_body: 'Confermiamo la ricezione del vostro ordine n. 42.',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/email-ingestion/classify', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('WEBHOOK_SECRET', WEBHOOK_SECRET)

    mockCheckWebhookProcessed.mockResolvedValue({ processed: false })
    mockRecordWebhookProcessed.mockResolvedValue(undefined)
    mockUserFindMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'manager-1' }])
    mockCreateNotification.mockResolvedValue(undefined)

    const module =
      await import('@/app/api/webhooks/email-ingestion/classify/route')
    POST = module.POST
  })

  // =========================================================================
  // Auth
  // =========================================================================

  it('risponde 401 quando il token di autenticazione è assente', async () => {
    const req = makeRequest(rawEmail, { Authorization: 'Bearer wrong-token' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('risponde 401 quando authorization header mancante', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/webhooks/email-ingestion/classify',
      {
        method: 'POST',
        body: JSON.stringify(rawEmail),
        headers: { 'Content-Type': 'application/json' },
      },
    )
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  // =========================================================================
  // Idempotency
  // =========================================================================

  it('ritorna la risposta cached e non chiama il classifier su idempotency hit', async () => {
    const cached = {
      success: true,
      data: { intent: 'CONFERMA_ORDINE', confidence: 0.95 },
    }
    mockCheckWebhookProcessed.mockResolvedValue({
      processed: true,
      response: cached,
    })

    const req = makeRequest(rawEmail)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(cached)
    expect(mockClassifyEmailIntent).not.toHaveBeenCalled()
    expect(mockProcessEmailIngestion).not.toHaveBeenCalled()
  })

  // =========================================================================
  // Validation
  // =========================================================================

  it('risponde 400 VALIDATION_ERROR quando campi obbligatori mancano', async () => {
    const req = makeRequest({ email_from: 'foo@bar.com' }) // manca subject e body
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('risponde 400 INVALID_PAYLOAD quando il body non è JSON valido', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/webhooks/email-ingestion/classify',
      {
        method: 'POST',
        body: 'non-json-string',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WEBHOOK_SECRET}`,
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
      },
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_PAYLOAD')
  })

  // =========================================================================
  // AI Classification errors
  // =========================================================================

  it('risponde 503 quando AI non è configurata', async () => {
    const { EmailClassificationError } =
      await import('@/modules/core/email-intelligence/server/email-ai-classifier.service')
    mockClassifyEmailIntent.mockRejectedValue(
      new EmailClassificationError(
        'AI_NOT_CONFIGURED',
        'Chiave API non configurata',
      ),
    )

    const req = makeRequest(rawEmail)
    const res = await POST(req)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('AI_NOT_CONFIGURED')
  })

  it('risponde 504 quando la classificazione AI va in timeout', async () => {
    const { EmailClassificationError } =
      await import('@/modules/core/email-intelligence/server/email-ai-classifier.service')
    mockClassifyEmailIntent.mockRejectedValue(
      new EmailClassificationError(
        'AI_TIMEOUT',
        'Timeout durante la classificazione',
      ),
    )

    const req = makeRequest(rawEmail)
    const res = await POST(req)

    expect(res.status).toBe(504)
  })

  it('risponde 500 per errori AI generici non classificati', async () => {
    mockClassifyEmailIntent.mockRejectedValue(new Error('Unexpected AI error'))

    const req = makeRequest(rawEmail)
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('AI_ERROR')
  })

  // =========================================================================
  // Alta confidence → azione automatica
  // =========================================================================

  it('chiama processEmailIngestion con update_existing per CONFERMA_ORDINE (confidence >= 0.8)', async () => {
    const classification = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.95,
      extracted_data: {
        matched_request_code: 'PR-2026-00042',
        vendor_name: 'Acme Srl',
        summary: 'Conferma ordine ricevuta',
      },
    }
    const mappedPayload = {
      action: 'update_existing',
      email_from: rawEmail.email_from,
      email_subject: rawEmail.email_subject,
      email_body: rawEmail.email_body,
      ai_matched_request_code: 'PR-2026-00042',
      ai_status_update: 'ORDERED',
      ai_items: [],
      ai_tags: [],
      ai_currency: 'EUR',
      attachments: [],
    }
    mockClassifyEmailIntent.mockResolvedValue(classification)
    mockMapClassificationToPayload.mockReturnValue(mappedPayload)
    mockProcessEmailIngestion.mockResolvedValue({
      action: 'update_existing',
      request_code: 'PR-2026-00042',
      items_created: 0,
      status_updated: true,
      deduplicated: false,
    })

    const req = makeRequest(rawEmail)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.action_taken).toBe(true)
    expect(body.data.intent).toBe('CONFERMA_ORDINE')
    expect(body.data.confidence).toBe(0.95)
    expect(mockProcessEmailIngestion).toHaveBeenCalledWith(mappedPayload)
    expect(mockMapClassificationToPayload).toHaveBeenCalledWith(
      expect.objectContaining({ email_from: rawEmail.email_from }),
      classification,
    )
  })

  it('chiama processEmailIngestion con create_commessa per ORDINE_CLIENTE (confidence >= 0.8)', async () => {
    const classification = {
      intent: 'ORDINE_CLIENTE',
      confidence: 0.92,
      extracted_data: {
        client_name: 'BigCorp Srl',
        client_code: 'BIGCORP-001',
        summary: 'Ordine cliente Q2 ricevuto',
        client_order_items: [
          { description: 'Sedie ergonomiche', quantity: 50 },
        ],
      },
    }
    const mappedPayload = {
      action: 'create_commessa',
      email_from: 'client@bigcorp.it',
      email_subject: 'Ordine Q2',
      email_body: 'Vi inviamo il nostro ordine trimestrale.',
      ai_client_name: 'BigCorp Srl',
      ai_client_code: 'BIGCORP-001',
      ai_client_order_items: [
        { description: 'Sedie ergonomiche', quantity: 50 },
      ],
      ai_items: [],
      ai_tags: ['ai-created'],
      ai_currency: 'EUR',
      attachments: [],
    }
    mockClassifyEmailIntent.mockResolvedValue(classification)
    mockMapClassificationToPayload.mockReturnValue(mappedPayload)
    mockProcessEmailIngestion.mockResolvedValue({
      action: 'create_commessa',
      commessa_code: 'COM-2026-00001',
      suggested_prs_created: 1,
      deduplicated: false,
    })

    const req = makeRequest({
      ...rawEmail,
      email_from: 'client@bigcorp.it',
      email_subject: 'Ordine Q2',
      email_body: 'Vi inviamo il nostro ordine trimestrale.',
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.action_taken).toBe(true)
    expect(mockProcessEmailIngestion).toHaveBeenCalledWith(mappedPayload)
  })

  it('registra idempotency dopo azione automatica completata', async () => {
    const classification = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.9,
      extracted_data: { matched_request_code: 'PR-2026-00001', summary: 'OK' },
    }
    mockClassifyEmailIntent.mockResolvedValue(classification)
    mockMapClassificationToPayload.mockReturnValue({
      action: 'update_existing',
      email_from: rawEmail.email_from,
      email_subject: rawEmail.email_subject,
      email_body: rawEmail.email_body,
      ai_items: [],
      ai_tags: [],
      ai_currency: 'EUR',
      attachments: [],
    })
    mockProcessEmailIngestion.mockResolvedValue({
      action: 'update_existing',
      request_code: 'PR-2026-00001',
      items_created: 0,
      status_updated: true,
      deduplicated: false,
    })

    const req = makeRequest(rawEmail)
    await POST(req)

    expect(mockRecordWebhookProcessed).toHaveBeenCalledWith(
      expect.any(String),
      'email-classify',
      200,
      expect.objectContaining({ success: true }),
    )
  })

  it('invia notifiche agli admin/manager dopo azione automatica', async () => {
    const classification = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.88,
      extracted_data: {
        matched_request_code: 'PR-2026-00001',
        summary: 'Conferma ricevuta',
      },
    }
    mockClassifyEmailIntent.mockResolvedValue(classification)
    mockMapClassificationToPayload.mockReturnValue({
      action: 'update_existing',
      email_from: rawEmail.email_from,
      email_subject: rawEmail.email_subject,
      email_body: rawEmail.email_body,
      ai_items: [],
      ai_tags: [],
      ai_currency: 'EUR',
      attachments: [],
    })
    mockProcessEmailIngestion.mockResolvedValue({
      action: 'update_existing',
      request_code: 'PR-2026-00001',
      items_created: 0,
      status_updated: true,
      deduplicated: false,
    })
    mockUserFindMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'mgr-1' }])

    const req = makeRequest(rawEmail)
    await POST(req)

    // Una notifica per ogni admin/manager trovato
    expect(mockCreateNotification).toHaveBeenCalledTimes(2)
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        type: 'EMAIL_INGESTION',
      }),
    )
  })

  // =========================================================================
  // Bassa confidence → solo notifica
  // =========================================================================

  it('NON chiama processEmailIngestion e invia notifica quando confidence < 0.8', async () => {
    const classification = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.62,
      extracted_data: {
        matched_request_code: undefined,
        summary: 'Possibile conferma ordine, ma incerto',
      },
    }
    mockClassifyEmailIntent.mockResolvedValue(classification)
    mockUserFindMany.mockResolvedValue([{ id: 'admin-1' }])

    const req = makeRequest(rawEmail)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.action_taken).toBe(false)
    expect(body.data.notification_sent).toBe(true)
    expect(mockProcessEmailIngestion).not.toHaveBeenCalled()
    expect(mockMapClassificationToPayload).not.toHaveBeenCalled()
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        type: 'EMAIL_INGESTION',
        body: expect.stringContaining('62%'),
      }),
    )
  })

  it('tratta confidence esattamente a 0.8 come alta confidence (azione automatica)', async () => {
    const classification = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.8,
      extracted_data: {
        matched_request_code: 'PR-2026-00001',
        summary: 'Al limite',
      },
    }
    mockClassifyEmailIntent.mockResolvedValue(classification)
    mockMapClassificationToPayload.mockReturnValue({
      action: 'update_existing',
      email_from: rawEmail.email_from,
      email_subject: rawEmail.email_subject,
      email_body: rawEmail.email_body,
      ai_items: [],
      ai_tags: [],
      ai_currency: 'EUR',
      attachments: [],
    })
    mockProcessEmailIngestion.mockResolvedValue({
      action: 'update_existing',
      request_code: 'PR-2026-00001',
      items_created: 0,
      status_updated: true,
      deduplicated: false,
    })

    const req = makeRequest(rawEmail)
    const res = await POST(req)

    const body = await res.json()
    expect(body.data.action_taken).toBe(true)
    expect(mockProcessEmailIngestion).toHaveBeenCalledTimes(1)
  })
})
