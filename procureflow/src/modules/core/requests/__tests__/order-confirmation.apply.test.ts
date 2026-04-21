// ---------------------------------------------------------------------------
// Integration-style tests for applyConfirmation (mocked Prisma).
// Copre:
//  - happy path: aggiornamento prezzo + total_price + confirmed_delivery
//  - sottoinsieme di righe: solo quelle in acceptedLineIds vengono applicate
//  - riga senza request_item_id: nessun update su RequestItem, solo flag applied
//  - idempotency: seconda apply su confirmation APPLIED → errore esplicito
//  - rollback: errore dentro la transazione propaga fuori
//  - audit log chiamato con entityType OrderConfirmation
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

// --- Prisma mock --------------------------------------------------------------

const confirmationFindUnique = vi.fn()
const confirmationUpdate = vi.fn()
const lineUpdate = vi.fn()
const itemFindUnique = vi.fn()
const itemUpdate = vi.fn()
const timelineCreate = vi.fn()

// Il mock di $transaction può essere riconfigurato per iniettare failure.
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
  applyConfirmation,
  InvalidConfirmationStateError,
  InvalidConfirmationLineError,
} from '../server/order-confirmation.service'

// --- Helpers ------------------------------------------------------------------

function makeConfirmation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conf_1',
    request_id: 'req_1',
    status: 'PARSED',
    vendor_reference: 'Ord.14177',
    subject: null,
    notes: null,
    applied_at: null,
    applied_by: null,
    lines: [
      {
        id: 'line_1',
        confirmation_id: 'conf_1',
        request_item_id: 'item_1',
        confirmed_unit_price: new Prisma.Decimal('12.00'),
        confirmed_quantity: null,
        confirmed_delivery: new Date('2026-05-15'),
        original_unit_price: new Prisma.Decimal('10.00'),
        applied: false,
        rejected: false,
        delivery_status: 'CONFIRMED',
      },
      {
        id: 'line_2',
        confirmation_id: 'conf_1',
        request_item_id: 'item_2',
        confirmed_unit_price: new Prisma.Decimal('20.00'),
        confirmed_quantity: 5,
        confirmed_delivery: null,
        original_unit_price: new Prisma.Decimal('18.00'),
        applied: false,
        rejected: false,
        delivery_status: 'CONFIRMED',
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
    name: `Item ${id}`,
    quantity: 10,
    unit: 'pz',
    unit_price: new Prisma.Decimal('10.00'),
    total_price: new Prisma.Decimal('100.00'),
    confirmed_delivery: null,
    expected_delivery: null,
    actual_delivery: null,
    sku: null,
    description: null,
    article_id: null,
    unresolved_code: null,
    vat_rate: new Prisma.Decimal('22.00'),
    vat_nature: null,
    is_split_payment: false,
    is_reverse_charge: false,
    delivery_status: 'CONFIRMED',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset default transaction behavior
  transactionImpl.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
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
  confirmationUpdate.mockResolvedValue({
    id: 'conf_1',
    status: 'APPLIED',
    lines: [],
  })
})

// --- Tests --------------------------------------------------------------------

describe('applyConfirmation', () => {
  it('applica una riga: aggiorna unit_price + total_price + confirmed_delivery', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_1'],
    })

    expect(itemUpdate).toHaveBeenCalledTimes(1)
    const updateCall = itemUpdate.mock.calls[0]?.[0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(updateCall.where.id).toBe('item_1')
    expect((updateCall.data.unit_price as Prisma.Decimal).toNumber()).toBe(12)
    // quantity=10 * unit=12 = 120
    expect((updateCall.data.total_price as Prisma.Decimal).toNumber()).toBe(120)
    expect(updateCall.data.confirmed_delivery).toEqual(new Date('2026-05-15'))
  })

  it('applica solo le righe presenti in acceptedLineIds (sottoinsieme)', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_1'], // solo una su due
    })

    // Solo un update item (quello di line_1)
    expect(itemUpdate).toHaveBeenCalledTimes(1)
    // Solo un update line (quella applicata)
    expect(lineUpdate).toHaveBeenCalledTimes(1)
  })

  it('riga senza request_item_id: non aggiorna item ma marca applied', async () => {
    const conf = makeConfirmation({
      lines: [
        {
          id: 'orphan_1',
          confirmation_id: 'conf_1',
          request_item_id: null,
          confirmed_unit_price: new Prisma.Decimal('50.00'),
          confirmed_quantity: null,
          confirmed_delivery: null,
        },
      ],
    })
    confirmationFindUnique.mockResolvedValue(conf)
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['orphan_1'],
    })

    expect(itemFindUnique).not.toHaveBeenCalled()
    expect(itemUpdate).not.toHaveBeenCalled()
    expect(lineUpdate).toHaveBeenCalledTimes(1)
  })

  it('confirmation in stato terminale: rifiuta con InvalidConfirmationStateError (idempotency)', async () => {
    confirmationFindUnique.mockResolvedValue(
      makeConfirmation({ status: 'APPLIED' }),
    )

    await expect(
      applyConfirmation({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        acceptedLineIds: ['line_1'],
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationStateError)

    // Nessuna scrittura su item o line
    expect(itemUpdate).not.toHaveBeenCalled()
    expect(lineUpdate).not.toHaveBeenCalled()
  })

  it('acceptedLineIds con id non appartenenti alla confirmation → errore', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())

    await expect(
      applyConfirmation({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        acceptedLineIds: ['line_1', 'line_inesistente'],
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationLineError)
  })

  it('errore dentro la transazione propaga fuori (rollback su itemUpdate failure)', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))
    itemUpdate.mockRejectedValue(new Error('DB write failed'))

    await expect(
      applyConfirmation({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        acceptedLineIds: ['line_1'],
      }),
    ).rejects.toThrow('DB write failed')
  })

  it('scrive audit log con entityType=OrderConfirmation e action=UPDATE', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_1'],
    })

    expect(writeAuditLogMock).toHaveBeenCalledTimes(1)
    const auditCall = writeAuditLogMock.mock.calls[0]?.[0] as {
      entityType: string
      action: string
      actorId: string
    }
    expect(auditCall.entityType).toBe('OrderConfirmation')
    expect(auditCall.action).toBe('UPDATE')
    expect(auditCall.actorId).toBe('user_admin')
  })

  it('audit log failure non propaga (fail-soft)', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})
    confirmationUpdate.mockResolvedValueOnce({
      id: 'conf_1',
      status: 'PARTIALLY_APPLIED',
      lines: [],
    })
    writeAuditLogMock.mockRejectedValueOnce(new Error('audit db down'))

    const result = await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_1'],
    })

    expect(result.status).toBe('PARTIALLY_APPLIED')
  })

  it('transizione a PARTIALLY_APPLIED se resta almeno una riga pendente', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique.mockResolvedValue(makeItem('item_1'))
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_1'], // 1 su 2
    })

    const updateCall = confirmationUpdate.mock.calls[0]?.[0] as {
      data: { status: string; applied_at: Date | null }
    }
    expect(updateCall.data.status).toBe('PARTIALLY_APPLIED')
    // applied_at non è stampato quando la confirmation non è completa
    expect(updateCall.data.applied_at).toBeNull()
  })

  it('transizione a APPLIED quando tutte le righe diventano terminali', async () => {
    confirmationFindUnique.mockResolvedValue(makeConfirmation())
    itemFindUnique
      .mockResolvedValueOnce(makeItem('item_1'))
      .mockResolvedValueOnce(makeItem('item_2'))
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_1', 'line_2'], // tutte
    })

    const updateCall = confirmationUpdate.mock.calls[0]?.[0] as {
      data: {
        status: string
        applied_at: Date | null
        applied_by: string | null
      }
    }
    expect(updateCall.data.status).toBe('APPLIED')
    expect(updateCall.data.applied_at).toBeInstanceOf(Date)
    expect(updateCall.data.applied_by).toBe('user_admin')
  })

  it('permette apply partendo da PARTIALLY_APPLIED (righe residue)', async () => {
    const conf = makeConfirmation({
      status: 'PARTIALLY_APPLIED',
      lines: [
        {
          id: 'line_1',
          confirmation_id: 'conf_1',
          request_item_id: 'item_1',
          confirmed_unit_price: new Prisma.Decimal('12.00'),
          applied: true, // già applicata
          rejected: false,
          delivery_status: 'CONFIRMED',
        },
        {
          id: 'line_2',
          confirmation_id: 'conf_1',
          request_item_id: 'item_2',
          confirmed_unit_price: new Prisma.Decimal('20.00'),
          confirmed_quantity: 5,
          applied: false,
          rejected: false,
          delivery_status: 'CONFIRMED',
        },
      ],
    })
    confirmationFindUnique.mockResolvedValue(conf)
    itemFindUnique.mockResolvedValue(makeItem('item_2'))
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_2'], // completa la confirmation
    })

    const updateCall = confirmationUpdate.mock.calls[0]?.[0] as {
      data: { status: string }
    }
    expect(updateCall.data.status).toBe('APPLIED')
  })

  it('propaga line.delivery_status (es. PARTIAL) al RequestItem', async () => {
    const conf = makeConfirmation({
      lines: [
        {
          id: 'line_1',
          confirmation_id: 'conf_1',
          request_item_id: 'item_1',
          confirmed_unit_price: new Prisma.Decimal('12.00'),
          applied: false,
          rejected: false,
          delivery_status: 'PARTIAL',
        },
      ],
    })
    confirmationFindUnique.mockResolvedValue(conf)
    itemFindUnique.mockResolvedValue(makeItem('item_1'))
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_1'],
    })

    const updateCall = itemUpdate.mock.calls[0]?.[0] as {
      data: { delivery_status: string }
    }
    expect(updateCall.data.delivery_status).toBe('PARTIAL')
  })

  it('delivery_status CONFIRMED sulla linea non sovrascrive quello corrente del item', async () => {
    const conf = makeConfirmation({
      lines: [
        {
          id: 'line_1',
          confirmation_id: 'conf_1',
          request_item_id: 'item_1',
          confirmed_unit_price: new Prisma.Decimal('12.00'),
          applied: false,
          rejected: false,
          delivery_status: 'CONFIRMED',
        },
      ],
    })
    confirmationFindUnique.mockResolvedValue(conf)
    itemFindUnique.mockResolvedValue(
      makeItem('item_1', { delivery_status: 'BACKORDERED' }),
    )
    itemUpdate.mockResolvedValue({})
    lineUpdate.mockResolvedValue({})

    await applyConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_admin',
      acceptedLineIds: ['line_1'],
    })

    const updateCall = itemUpdate.mock.calls[0]?.[0] as {
      data: { delivery_status: string }
    }
    // Mantiene lo stato precedente (BACKORDERED) invece di forzare CONFIRMED
    expect(updateCall.data.delivery_status).toBe('BACKORDERED')
  })

  it('errore se la riga è già applicata (idempotency per riga)', async () => {
    const conf = makeConfirmation({
      lines: [
        {
          id: 'line_1',
          confirmation_id: 'conf_1',
          request_item_id: 'item_1',
          confirmed_unit_price: new Prisma.Decimal('12.00'),
          applied: true, // già terminale
          rejected: false,
          delivery_status: 'CONFIRMED',
        },
      ],
    })
    confirmationFindUnique.mockResolvedValue(conf)

    await expect(
      applyConfirmation({
        confirmationId: 'conf_1',
        userId: 'user_admin',
        acceptedLineIds: ['line_1'],
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationLineError)

    expect(itemUpdate).not.toHaveBeenCalled()
  })
})
