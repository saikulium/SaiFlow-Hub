import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mocks
const notificationCreate = vi.fn()
const userFindUnique = vi.fn()
const preferenceFindUnique = vi.fn()
const preferenceCreate = vi.fn()
const auditLogCreate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    notification: {
      create: (...a: unknown[]) => notificationCreate(...a),
      createMany: vi.fn(),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUnique(...a),
    },
    notificationPreference: {
      findUnique: (...a: unknown[]) => preferenceFindUnique(...a),
      create: (...a: unknown[]) => preferenceCreate(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => auditLogCreate(...a),
    },
  },
}))

import { NoopTransport } from '../server/email-transport'
import {
  __setTransportForTest,
  __resetTransport,
} from '../server/email-transport'
import {
  createNotification,
  NOTIFICATION_TYPES,
} from '../server/notification.service'

function makePrefs(
  overrides: Record<string, unknown> = {},
  quietHours: { start: number | null; end: number | null } = {
    start: null,
    end: null,
  },
) {
  return {
    id: 'p1',
    user_id: 'user_1',
    email_overrides: {},
    inapp_overrides: {},
    digest_enabled: true,
    digest_frequency: 'HOURLY',
    digest_quiet_hours_start: quietHours.start,
    digest_quiet_hours_end: quietHours.end,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

describe('createNotification — email integration', () => {
  let transport: NoopTransport

  beforeEach(() => {
    vi.clearAllMocks()
    // Pin system clock at 10:00 — within default quiet-hours window in the
    // tests that set start=0 end=23, so assertions are hour-independent.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 3, 20, 10, 0, 0))
    transport = new NoopTransport()
    __setTransportForTest(transport)

    notificationCreate.mockImplementation(async ({ data }) => ({
      id: 'n_1',
      user_id: data.user_id,
      title: data.title,
      body: data.body,
      type: data.type,
      link: data.link,
      read: false,
      created_at: new Date(),
    }))

    userFindUnique.mockResolvedValue({
      id: 'user_1',
      email: 'mario@example.com',
      name: 'Mario',
    })

    // Default: no quiet hours so email sempre inviata se canale attivo
    preferenceFindUnique.mockResolvedValue(makePrefs())
  })

  afterEach(() => {
    __resetTransport()
    vi.useRealTimers()
  })

  it('invia email per APPROVAL_DECIDED (default channels include email)', async () => {
    await createNotification({
      userId: 'user_1',
      title: 'Richiesta approvata',
      body: 'PR-2026-00001 approvata',
      type: NOTIFICATION_TYPES.APPROVAL_DECIDED,
      metadata: {
        requestCode: 'PR-2026-00001',
        requestTitle: 'Carta A4',
        approverName: 'Giulia',
        approved: true,
      },
    })

    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0]?.to).toBe('mario@example.com')
    expect(transport.sent[0]?.subject).toBe('Richiesta approvata')
  })

  it('skip email in quiet hours per tipo non urgente', async () => {
    // Configura quiet hours che includono l'ora corrente: start=0, end=24 → sempre quiet
    preferenceFindUnique.mockResolvedValue(makePrefs({}, { start: 0, end: 23 }))

    await createNotification({
      userId: 'user_1',
      title: 'Richiesta approvata',
      body: 'PR-2026-00001 approvata',
      type: NOTIFICATION_TYPES.APPROVAL_DECIDED,
    })

    expect(transport.sent).toHaveLength(0)
  })

  it('invia email per tipo urgente anche in quiet hours', async () => {
    preferenceFindUnique.mockResolvedValue(makePrefs({}, { start: 0, end: 23 }))

    await createNotification({
      userId: 'user_1',
      title: 'Fattura con discrepanze',
      body: 'INV-001 non corrisponde',
      type: NOTIFICATION_TYPES.INVOICE_DISCREPANCY,
    })

    expect(transport.sent).toHaveLength(1)
  })

  it('override email:false disattiva invio', async () => {
    preferenceFindUnique.mockResolvedValue(
      makePrefs({ email_overrides: { APPROVAL_DECIDED: false } }),
    )

    await createNotification({
      userId: 'user_1',
      title: 'Richiesta approvata',
      body: 'bla',
      type: NOTIFICATION_TYPES.APPROVAL_DECIDED,
    })

    expect(transport.sent).toHaveLength(0)
  })

  it('channels esplicito bypassa override', async () => {
    preferenceFindUnique.mockResolvedValue(
      makePrefs({ email_overrides: { APPROVAL_DECIDED: false } }),
    )

    await createNotification({
      userId: 'user_1',
      title: 'Richiesta approvata',
      body: 'bla',
      type: NOTIFICATION_TYPES.APPROVAL_DECIDED,
      channels: ['inapp', 'email'],
    })

    expect(transport.sent).toHaveLength(1)
  })

  it('errore transport non blocca creazione in-app', async () => {
    transport.send = vi.fn().mockRejectedValue(new Error('Resend down'))

    const result = await createNotification({
      userId: 'user_1',
      title: 'Test',
      body: 'test body',
      type: NOTIFICATION_TYPES.APPROVAL_REQUESTED,
    })

    expect(result.id).toBe('n_1')
    expect(notificationCreate).toHaveBeenCalledOnce()
  })

  it('utente senza email non invia ma crea in-app', async () => {
    userFindUnique.mockResolvedValue({
      id: 'user_1',
      email: null,
      name: 'Mario',
    })

    const result = await createNotification({
      userId: 'user_1',
      title: 'Test',
      body: 'test',
      type: NOTIFICATION_TYPES.APPROVAL_REQUESTED,
    })

    expect(result.id).toBe('n_1')
    expect(transport.sent).toHaveLength(0)
  })

  it('COMMENT_ADDED non invia email (default solo inapp)', async () => {
    await createNotification({
      userId: 'user_1',
      title: 'Nuovo commento',
      body: 'Luca ha commentato',
      type: NOTIFICATION_TYPES.COMMENT_ADDED,
    })

    expect(transport.sent).toHaveLength(0)
    expect(notificationCreate).toHaveBeenCalledOnce()
  })
})
