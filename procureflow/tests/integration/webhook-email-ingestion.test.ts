import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProcessEmailIngestion = vi.fn()
const mockCheckWebhookProcessed = vi.fn()
const mockRecordWebhookProcessed = vi.fn()

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/webhook-auth', () => ({
  verifyWebhookAuth: vi.fn(
    (
      _body: string,
      _sig: string | null,
      auth: string | null,
      secret: string | undefined,
      _ts: string | null,
    ) => {
      // Accept Bearer token matching the secret
      return auth === `Bearer ${secret}`
    },
  ),
}))
vi.mock(
  '@/modules/core/email-intelligence/server/email-ingestion.service',
  () => ({
    processEmailIngestion: mockProcessEmailIngestion,
  }),
)
vi.mock('@/server/services/webhook-idempotency.service', () => ({
  checkWebhookProcessed: mockCheckWebhookProcessed,
  recordWebhookProcessed: mockRecordWebhookProcessed,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-secret-123'

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new NextRequest('http://localhost:3000/api/webhooks/email-ingestion', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WEBHOOK_SECRET}`,
      'x-webhook-id': `test-${Date.now()}`,
      'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
      ...headers,
    },
  })
}

const validPayload = {
  email_from: 'fornitore@example.com',
  email_subject: 'Conferma ordine materiale',
  email_body: 'Confermiamo il vostro ordine per 10 risme carta A4.',
  action: 'new_request' as const,
  ai_title: 'Carta A4',
  ai_items: [{ name: 'Carta A4', quantity: 10, unit: 'risma' }],
  ai_tags: ['cancelleria'],
  ai_currency: 'EUR',
  attachments: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/email-ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('WEBHOOK_SECRET', WEBHOOK_SECRET)
    mockCheckWebhookProcessed.mockResolvedValue({ processed: false })
    mockRecordWebhookProcessed.mockResolvedValue(undefined)
  })

  it('processes valid email ingestion payload', async () => {
    mockProcessEmailIngestion.mockResolvedValue({
      action: 'new_request',
      request_code: 'PR-2026-00001',
      items_created: 1,
      status_updated: false,
      ai_confidence: 0.92,
    })

    const { POST } = await import('@/app/api/webhooks/email-ingestion/route')
    const res = await POST(makeRequest(validPayload))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.request_code).toBe('PR-2026-00001')
    expect(mockProcessEmailIngestion).toHaveBeenCalledTimes(1)
  })

  it('rejects unauthorized requests', async () => {
    const { POST } = await import('@/app/api/webhooks/email-ingestion/route')
    const req = new NextRequest(
      'http://localhost:3000/api/webhooks/email-ingestion',
      {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-secret',
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
      },
    )
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(mockProcessEmailIngestion).not.toHaveBeenCalled()
  })

  it('returns cached response for duplicate webhook ID', async () => {
    const cachedResponse = { success: true, data: { action: 'new_request' } }
    mockCheckWebhookProcessed.mockResolvedValue({
      processed: true,
      response: cachedResponse,
    })

    const { POST } = await import('@/app/api/webhooks/email-ingestion/route')
    const res = await POST(makeRequest(validPayload))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(cachedResponse)
    expect(mockProcessEmailIngestion).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON body', async () => {
    const { POST } = await import('@/app/api/webhooks/email-ingestion/route')
    const req = new NextRequest(
      'http://localhost:3000/api/webhooks/email-ingestion',
      {
        method: 'POST',
        body: 'not json at all',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WEBHOOK_SECRET}`,
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
      },
    )
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_PAYLOAD')
  })

  it('rejects payload missing required fields', async () => {
    const { POST } = await import('@/app/api/webhooks/email-ingestion/route')
    const res = await POST(
      makeRequest({ email_from: 'a@b.com' }), // missing action, email_subject, etc.
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('records webhook for idempotency after processing', async () => {
    mockProcessEmailIngestion.mockResolvedValue({
      action: 'new_request',
      request_code: 'PR-2026-00002',
      items_created: 0,
      status_updated: false,
      ai_confidence: 0.8,
    })

    const { POST } = await import('@/app/api/webhooks/email-ingestion/route')
    await POST(makeRequest(validPayload))

    expect(mockRecordWebhookProcessed).toHaveBeenCalledWith(
      expect.any(String),
      'email-ingestion',
      200,
      expect.objectContaining({ success: true }),
    )
  })
})
