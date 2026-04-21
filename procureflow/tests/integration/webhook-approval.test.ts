import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  approval: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  purchaseRequest: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
  notification: {
    create: vi.fn(),
  },
  timelineEvent: {
    create: vi.fn(),
  },
}

const mockCheckWebhookProcessed = vi.fn()
const mockRecordWebhookProcessed = vi.fn()

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/webhook-auth', () => ({
  verifyWebhookAuth: vi.fn(
    (
      _body: string,
      _sig: string | null,
      auth: string | null,
      secret: string | undefined,
    ) => auth === `Bearer ${secret}`,
  ),
}))
vi.mock('@/server/services/webhook-idempotency.service', () => ({
  checkWebhookProcessed: mockCheckWebhookProcessed,
  recordWebhookProcessed: mockRecordWebhookProcessed,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-secret-123'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/webhooks/approval-response',
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WEBHOOK_SECRET}`,
        'x-webhook-id': `approval-${Date.now()}`,
        'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
      },
    },
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/approval-response', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('WEBHOOK_SECRET', WEBHOOK_SECRET)
    mockCheckWebhookProcessed.mockResolvedValue({ processed: false })
    mockRecordWebhookProcessed.mockResolvedValue(undefined)
  })

  it('rejects unauthorized requests', async () => {
    const { POST } = await import('@/app/api/webhooks/approval-response/route')
    const req = new NextRequest(
      'http://localhost:3000/api/webhooks/approval-response',
      {
        method: 'POST',
        body: JSON.stringify({ approval_id: 'a-1', action: 'APPROVED' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong',
          'x-webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        },
      },
    )
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('rejects missing approval_id', async () => {
    const { POST } = await import('@/app/api/webhooks/approval-response/route')
    const res = await POST(makeRequest({ action: 'APPROVED' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
  })

  it('rejects invalid action', async () => {
    const { POST } = await import('@/app/api/webhooks/approval-response/route')
    const res = await POST(makeRequest({ approval_id: 'a-1', action: 'MAYBE' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
  })

  it('returns 404 for non-existent approval', async () => {
    mockPrisma.approval.findUnique.mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhooks/approval-response/route')
    const res = await POST(
      makeRequest({ approval_id: 'nonexistent', action: 'APPROVED' }),
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
  })

  it('processes valid approval and updates request status', async () => {
    const mockApproval = {
      id: 'a-1',
      request_id: 'req-1',
      approver_id: 'user-2',
      status: 'PENDING',
      request: {
        id: 'req-1',
        code: 'PR-2026-00001',
        requester_id: 'user-1',
        approvals: [{ id: 'a-1', status: 'PENDING' }],
      },
      approver: { name: 'Luigi Verdi' },
    }

    mockPrisma.approval.findUnique.mockResolvedValue(mockApproval)
    mockPrisma.approval.update.mockResolvedValue({
      ...mockApproval,
      status: 'APPROVED',
    })
    // All approvals for the request — needed to compute aggregate status
    mockPrisma.approval.findMany.mockResolvedValue([{ status: 'APPROVED' }])
    mockPrisma.purchaseRequest.update.mockResolvedValue({})
    mockPrisma.timelineEvent.create.mockResolvedValue({})
    mockPrisma.notification.create.mockResolvedValue({})

    const { POST } = await import('@/app/api/webhooks/approval-response/route')
    const res = await POST(
      makeRequest({ approval_id: 'a-1', action: 'APPROVED', notes: 'OK' }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.approval.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a-1' },
        data: expect.objectContaining({
          status: 'APPROVED',
        }),
      }),
    )
  })
})
