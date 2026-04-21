// ---------------------------------------------------------------------------
// Unit tests for rejectLines — granular per-line reject + delivery_status
// propagation to RequestItem.
//
// Copre:
//  - reject di una singola riga su N → RequestItem.delivery_status propagato
//    a UNAVAILABLE o CANCELLED
//  - selezione solo delle righe in rejectedLineIds (nessuna scrittura sulle
//    altre)
//  - transizione di stato della confirmation:
//      - alcune righe restano pendenti → PARTIALLY_APPLIED
//      - tutte le righe sono terminali (una già applied + nuove rejected) →
//        APPLIED
//  - errori: id non appartenenti, righe già terminali, confirmation in stato
//    finale (APPLIED puro / REJECTED)
//  - riga senza request_item_id: rejected ma niente update su item
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- Prisma mock -------------------------------------------------------------

const confirmationFindUnique = vi.fn()
const confirmationUpdate = vi.fn()
const lineUpdate = vi.fn()
const itemFindUnique = vi.fn()
const itemUpdate = vi.fn()
const timelineCreate = vi.fn()

const transactionImpl = vi.fn((cb: (tx: unknown) => Promise<unknown>) =>
  cb({
    orderConfirmation: {
      update: (...a: unknown[]) => confirmationUpdate(...a),
    },
    orderConfirmationLine: {
      update: (...a: unknown[]) => lineUpdate(...a),
    },
    requestItem: {
      findUnique: (...a: unknown[]) => itemFindUnique(...a),
      update: (...a: unknown[]) => itemUpdate(...a),
    },
    timelineEvent: {
      create: (...a: unknown[]) => timelineCreate(...a),
    },
  }),
)

vi.mock('@/lib/db', () => ({
  prisma: {
    orderConfirmation: {
      findUnique: (...a: unknown[]) => confirmationFindUnique(...a),
    },
    $transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      transactionImpl(cb),
  },
}))

const writeAuditLogMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/modules/core/audit-log', () => ({
  writeAuditLog: (...a: unknown[]) => writeAuditLogMock(...a),
}))

// Import after mocks
import {
  rejectLines,
  InvalidConfirmationStateError,
  InvalidConfirmationLineError,
  OrderConfirmationNotFoundError,
} from '../server/order-confirmation.service'

// --- Helpers ----------------------------------------------------------------

function makeConfirmation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conf_1',
    request_id: 'req_1',
    status: 'PARSED',
    vendor_reference: 'Ord.1',
    subject: null,
    notes: null,
    applied_at: null,
    applied_by: null,
    lines: [
      {
        id: 'line_1',
        request_item_id: 'item_1',
        applied: false,
        rejected: false,
      },
      {
        id: 'line_2',
        request_item_id: 'item_2',
        applied: false,
        rejected: false,
      },
      {
        id: 'line_3',
        request_item_id: null,
        applied: false,
        rejected: false,
      },
    ],
    request: { code: 'PR-2026-00001' },
    ...overrides,
  }
}

function makeItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    request_id: 'req_1',
    quantity: 10,
    delivery_status: 'CONFIRMED',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  confirmationUpdate.mockResolvedValue({
    id: 'conf_1',
    status: 'PARTIALLY_APPLIED',
    lines: [],
  })
})

// --- Tests ------------------------------------------------------------------

describe('rejectLines', () => {
  it('rifiuta una riga linkata e propaga UNAVAILABLE al RequestItem', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))

    await rejectLines({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      rejectedLineIds: ['line_1'],
      reason: 'Fornitore non disponibile',
      newRequestItemStatus: 'UNAVAILABLE',
    })

    expect(lineUpdate).toHaveBeenCalledTimes(1)
    const lineCall = lineUpdate.mock.calls[0]?.[0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(lineCall.where.id).toBe('line_1')
    expect(lineCall.data.rejected).toBe(true)
    expect(lineCall.data.rejected_by).toBe('user_admin')
    expect(lineCall.data.rejected_reason).toBe('Fornitore non disponibile')

    expect(itemUpdate).toHaveBeenCalledTimes(1)
    const itemCall = itemUpdate.mock.calls[0]?.[0] as {
      where: { id: string }
      data: { delivery_status: string }
    }
    expect(itemCall.where.id).toBe('item_1')
    expect(itemCall.data.delivery_status).toBe('UNAVAILABLE')
  })

  it('rifiuta solo le righe in rejectedLineIds (nessuna scrittura su altre)', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))

    await rejectLines({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      rejectedLineIds: ['line_1'],
      reason: 'x',
      newRequestItemStatus: 'CANCELLED',
    })

    expect(lineUpdate).toHaveBeenCalledTimes(1)
    expect(itemUpdate).toHaveBeenCalledTimes(1)
  })

  it('riga senza request_item_id: rejected ma niente update item', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())

    await rejectLines({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      rejectedLineIds: ['line_3'], // orphan
      reason: 'x',
      newRequestItemStatus: 'CANCELLED',
    })

    expect(lineUpdate).toHaveBeenCalledTimes(1)
    expect(itemFindUnique).not.toHaveBeenCalled()
    expect(itemUpdate).not.toHaveBeenCalled()
  })

  it('transizione a PARTIALLY_APPLIED quando restano righe pendenti', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))

    await rejectLines({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      rejectedLineIds: ['line_1'], // 1 rifiutata, 2 ancora pending
      reason: 'x',
      newRequestItemStatus: 'UNAVAILABLE',
    })

    const updateCall = confirmationUpdate.mock.calls[0]?.[0] as {
      data: { status: string }
    }
    expect(updateCall.data.status).toBe('PARTIALLY_APPLIED')
  })

  it('transizione a APPLIED quando ogni riga diventa terminale (una già applied + altre rejected)', async () => {
    const conf = makeConfirmation({
      status: 'PARTIALLY_APPLIED',
      applied_at: new Date('2026-04-21T10:00:00Z'),
      applied_by: 'user_admin',
      lines: [
        {
          id: 'line_1',
          request_item_id: 'item_1',
          applied: true, // già applicata
          rejected: false,
        },
        {
          id: 'line_2',
          request_item_id: 'item_2',
          applied: false,
          rejected: false,
        },
        {
          id: 'line_3',
          request_item_id: 'item_3',
          applied: false,
          rejected: false,
        },
      ],
    })
    confirmationFindUnique.mockResolvedValue(conf)
    itemFindUnique
      .mockResolvedValueOnce(makeItem('item_2'))
      .mockResolvedValueOnce(makeItem('item_3'))

    await rejectLines({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      rejectedLineIds: ['line_2', 'line_3'],
      reason: 'Fornitore non disponibile',
      newRequestItemStatus: 'UNAVAILABLE',
    })

    const updateCall = confirmationUpdate.mock.calls[0]?.[0] as {
      data: { status: string }
    }
    expect(updateCall.data.status).toBe('APPLIED')
  })

  it('errore se una riga è già in stato terminale', async () => {
    const conf = makeConfirmation({
      lines: [
        {
          id: 'line_1',
          request_item_id: 'item_1',
          applied: true, // già terminale
          rejected: false,
        },
      ],
    })
    confirmationFindUnique.mockResolvedValue(conf)

    await expect(
      rejectLines({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        rejectedLineIds: ['line_1'],
        reason: 'x',
        newRequestItemStatus: 'UNAVAILABLE',
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationLineError)

    expect(lineUpdate).not.toHaveBeenCalled()
    expect(itemUpdate).not.toHaveBeenCalled()
  })

  it('errore se rejectedLineIds contiene id estranei alla confirmation', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())

    await expect(
      rejectLines({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        rejectedLineIds: ['line_1', 'line_inesistente'],
        reason: 'x',
        newRequestItemStatus: 'CANCELLED',
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationLineError)
  })

  it('errore se confirmation in stato finale (APPLIED)', async () => {
    confirmationFindUnique.mockResolvedValue(
      makeConfirmation({ status: 'APPLIED' }),
    )

    await expect(
      rejectLines({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        rejectedLineIds: ['line_1'],
        reason: 'x',
        newRequestItemStatus: 'UNAVAILABLE',
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationStateError)
  })

  it('errore se confirmation in stato finale (REJECTED)', async () => {
    confirmationFindUnique.mockResolvedValue(
      makeConfirmation({ status: 'REJECTED' }),
    )

    await expect(
      rejectLines({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        rejectedLineIds: ['line_1'],
        reason: 'x',
        newRequestItemStatus: 'UNAVAILABLE',
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationStateError)
  })

  it('errore se confirmation non esiste', async () => {
    confirmationFindUnique.mockResolvedValue(null)

    await expect(
      rejectLines({
        confirmationId: 'missing',
        userId: 'user_admin',
        rejectedLineIds: ['line_1'],
        reason: 'x',
        newRequestItemStatus: 'CANCELLED',
      }),
    ).rejects.toBeInstanceOf(OrderConfirmationNotFoundError)
  })

  it("permette reject lines su PARTIALLY_APPLIED (pathway recupero righe pendenti)", async () => {
    confirmationFindUnique.mockResolvedValue(
      makeConfirmation({ status: 'PARTIALLY_APPLIED' }),
    )
    itemFindUnique.mockResolvedValue(makeItem('item_1'))

    await expect(
      rejectLines({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        rejectedLineIds: ['line_1'],
        reason: 'x',
        newRequestItemStatus: 'UNAVAILABLE',
      }),
    ).resolves.toBeDefined()
  })

  it('scrive audit log con entityType=OrderConfirmation e metadata del reject', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))

    await rejectLines({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      rejectedLineIds: ['line_1'],
      reason: 'Fornitore non può fornire',
      newRequestItemStatus: 'UNAVAILABLE',
    })

    expect(writeAuditLogMock).toHaveBeenCalledTimes(1)
    const auditCall = writeAuditLogMock.mock.calls[0]?.[0] as {
      entityType: string
      action: string
      metadata: Record<string, unknown>
    }
    expect(auditCall.entityType).toBe('OrderConfirmation')
    expect(auditCall.action).toBe('UPDATE')
    expect(auditCall.metadata.new_request_item_status).toBe('UNAVAILABLE')
    expect(auditCall.metadata.rejected_line_count).toBe(1)
  })
})
