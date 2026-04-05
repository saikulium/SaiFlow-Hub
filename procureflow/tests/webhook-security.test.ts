import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  processedWebhook: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  verifyTimestamp,
  verifyHmacSignature,
  verifyWebhookAuth,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} from '@/lib/webhook-auth'

import {
  checkWebhookProcessed,
  recordWebhookProcessed,
  cleanupOldWebhooks,
} from '@/server/services/webhook-idempotency.service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-webhook-secret-2025'

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000)
}

function signPayload(payload: string, secret: string, timestamp?: string): string {
  const signedPayload = timestamp ? `${timestamp}.${payload}` : payload
  return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
}

// ===========================================================================
// TIMESTAMP VALIDATION
// ===========================================================================

describe('verifyTimestamp', () => {
  it('rifiuta header mancante', () => {
    const result = verifyTimestamp(null)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('MISSING_TIMESTAMP')
  })

  it('rifiuta header non numerico', () => {
    const result = verifyTimestamp('not-a-number')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('INVALID_TIMESTAMP')
  })

  it('rifiuta timestamp troppo vecchio (>5 min)', () => {
    const old = nowEpoch() - WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS - 60
    const result = verifyTimestamp(String(old))
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('TIMESTAMP_EXPIRED')
  })

  it('rifiuta timestamp nel futuro (>5 min)', () => {
    const future = nowEpoch() + WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS + 60
    const result = verifyTimestamp(String(future))
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('TIMESTAMP_EXPIRED')
  })

  it('accetta timestamp valido (entro 5 min)', () => {
    const result = verifyTimestamp(String(nowEpoch()))
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('accetta timestamp ai limiti della tolleranza', () => {
    const almostExpired = nowEpoch() - WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS + 10
    const result = verifyTimestamp(String(almostExpired))
    expect(result.valid).toBe(true)
  })
})

// ===========================================================================
// HMAC SIGNATURE WITH TIMESTAMP
// ===========================================================================

describe('verifyHmacSignature', () => {
  const payload = '{"event":"test"}'

  it('verifica firma senza timestamp (backward-compatible)', () => {
    const sig = signPayload(payload, TEST_SECRET)
    expect(verifyHmacSignature(payload, sig, TEST_SECRET)).toBe(true)
  })

  it('verifica firma con timestamp', () => {
    const ts = String(nowEpoch())
    const sig = signPayload(payload, TEST_SECRET, ts)
    expect(verifyHmacSignature(payload, sig, TEST_SECRET, ts)).toBe(true)
  })

  it('rifiuta firma con timestamp errato', () => {
    const ts = String(nowEpoch())
    const sig = signPayload(payload, TEST_SECRET, ts)
    // Usa un timestamp diverso per la verifica
    const wrongTs = String(nowEpoch() - 100)
    expect(verifyHmacSignature(payload, sig, TEST_SECRET, wrongTs)).toBe(false)
  })

  it('rifiuta firma con secret errato', () => {
    const sig = signPayload(payload, 'wrong-secret')
    expect(verifyHmacSignature(payload, sig, TEST_SECRET)).toBe(false)
  })

  it('rifiuta firma vuota', () => {
    expect(verifyHmacSignature(payload, '', TEST_SECRET)).toBe(false)
  })

  it('rifiuta secret vuoto', () => {
    const sig = signPayload(payload, TEST_SECRET)
    expect(verifyHmacSignature(payload, sig, '')).toBe(false)
  })
})

// ===========================================================================
// verifyWebhookAuth (integrazione)
// ===========================================================================

describe('verifyWebhookAuth', () => {
  const payload = '{"data":"hello"}'

  it('accetta HMAC valido con timestamp valido', () => {
    const ts = String(nowEpoch())
    const sig = signPayload(payload, TEST_SECRET, ts)
    expect(verifyWebhookAuth(payload, sig, null, TEST_SECRET, ts)).toBe(true)
  })

  it('rifiuta HMAC valido con timestamp scaduto', () => {
    const ts = String(nowEpoch() - 600)
    const sig = signPayload(payload, TEST_SECRET, ts)
    expect(verifyWebhookAuth(payload, sig, null, TEST_SECRET, ts)).toBe(false)
  })

  it('accetta HMAC senza timestamp (backward-compatible)', () => {
    const sig = signPayload(payload, TEST_SECRET)
    expect(verifyWebhookAuth(payload, sig, null, TEST_SECRET, null)).toBe(true)
  })

  it('accetta Bearer token anche senza timestamp', () => {
    expect(
      verifyWebhookAuth(payload, null, `Bearer ${TEST_SECRET}`, TEST_SECRET, null),
    ).toBe(true)
  })

  it('rifiuta Bearer token con timestamp scaduto', () => {
    const ts = String(nowEpoch() - 600)
    expect(
      verifyWebhookAuth(payload, null, `Bearer ${TEST_SECRET}`, TEST_SECRET, ts),
    ).toBe(false)
  })

  it('rifiuta se secret è undefined', () => {
    const sig = signPayload(payload, TEST_SECRET)
    expect(verifyWebhookAuth(payload, sig, null, undefined, null)).toBe(false)
  })
})

// ===========================================================================
// IDEMPOTENCY SERVICE
// ===========================================================================

describe('checkWebhookProcessed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ritorna processed=false se webhook non trovato', async () => {
    mockPrisma.processedWebhook.findUnique.mockResolvedValue(null)
    const result = await checkWebhookProcessed('wh-123')
    expect(result.processed).toBe(false)
    expect(result.response).toBeUndefined()
  })

  it('ritorna processed=true con response se webhook trovato', async () => {
    const savedResponse = { success: true, data: { id: 'inv-1' } }
    mockPrisma.processedWebhook.findUnique.mockResolvedValue({
      response: savedResponse,
    })
    const result = await checkWebhookProcessed('wh-123')
    expect(result.processed).toBe(true)
    expect(result.response).toEqual(savedResponse)
  })

  it('gestisce response null', async () => {
    mockPrisma.processedWebhook.findUnique.mockResolvedValue({
      response: null,
    })
    const result = await checkWebhookProcessed('wh-123')
    expect(result.processed).toBe(true)
    expect(result.response).toBeUndefined()
  })
})

describe('recordWebhookProcessed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa upsert per registrare il webhook', async () => {
    mockPrisma.processedWebhook.upsert.mockResolvedValue({})
    await recordWebhookProcessed('wh-456', 'sdi-invoice', 200, { success: true })

    expect(mockPrisma.processedWebhook.upsert).toHaveBeenCalledWith({
      where: { webhook_id: 'wh-456' },
      create: {
        webhook_id: 'wh-456',
        endpoint: 'sdi-invoice',
        status_code: 200,
        response: { success: true },
      },
      update: {},
    })
  })
})

describe('cleanupOldWebhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('elimina webhook più vecchi di N giorni', async () => {
    mockPrisma.processedWebhook.deleteMany.mockResolvedValue({ count: 42 })

    const count = await cleanupOldWebhooks(30)

    expect(count).toBe(42)
    expect(mockPrisma.processedWebhook.deleteMany).toHaveBeenCalledWith({
      where: {
        created_at: {
          lt: expect.any(Date),
        },
      },
    })
  })

  it('usa 30 giorni come default', async () => {
    mockPrisma.processedWebhook.deleteMany.mockResolvedValue({ count: 0 })

    const beforeCall = new Date()
    beforeCall.setDate(beforeCall.getDate() - 30)

    await cleanupOldWebhooks()

    const callArg = mockPrisma.processedWebhook.deleteMany.mock.calls[0]![0] as {
      where: { created_at: { lt: Date } }
    }
    const cutoff = callArg.where.created_at.lt

    // Il cutoff dovrebbe essere circa 30 giorni fa (tolleranza 1 secondo)
    expect(Math.abs(cutoff.getTime() - beforeCall.getTime())).toBeLessThan(1000)
  })
})
