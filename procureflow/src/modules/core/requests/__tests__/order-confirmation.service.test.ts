// ---------------------------------------------------------------------------
// Unit tests for createOrderConfirmation + rejectConfirmation.
// Mocks Prisma + audit-log at module level. Copre:
//  - snapshot valori originali e calcolo price_delta_pct / delivery_delay_days
//  - resolve RequestItem via request_item_id esplicito e via match_by_sku
//  - validazione input (request mancante, nessuna riga)
//  - reject transition + fallimento su stato terminale
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

// --- Prisma mock --------------------------------------------------------------

const requestFindUnique = vi.fn()
const confirmationCreate = vi.fn()
const confirmationFindUnique = vi.fn()
const confirmationUpdate = vi.fn()
const lineCreate = vi.fn()
const lineUpdateMany = vi.fn()
const timelineCreate = vi.fn()

// Esegue la callback passando un oggetto tx che riflette le operazioni
// necessarie al test. Nel path "createOrderConfirmation" la tx riceve
// orderConfirmation.create + orderConfirmationLine.create.
const transaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) =>
  cb({
    orderConfirmation: {
      create: (...a: unknown[]) => confirmationCreate(...a),
      update: (...a: unknown[]) => confirmationUpdate(...a),
    },
    orderConfirmationLine: {
      create: (...a: unknown[]) => lineCreate(...a),
      updateMany: (...a: unknown[]) => lineUpdateMany(...a),
    },
    timelineEvent: {
      create: (...a: unknown[]) => timelineCreate(...a),
    },
  }),
)

vi.mock('@/lib/db', () => ({
  prisma: {
    purchaseRequest: {
      findUnique: (...a: unknown[]) => requestFindUnique(...a),
    },
    orderConfirmation: {
      findUnique: (...a: unknown[]) => confirmationFindUnique(...a),
    },
    $transaction: (cb: (tx: unknown) => Promise<unknown>) => transaction(cb),
  },
}))

vi.mock('@/modules/core/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocks
import {
  createOrderConfirmation,
  rejectConfirmation,
  InvalidConfirmationLineError,
  InvalidConfirmationStateError,
  OrderConfirmationNotFoundError,
} from '../server/order-confirmation.service'

// --- Helpers ------------------------------------------------------------------

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item_1',
    request_id: 'req_1',
    name: 'Carta A4',
    description: null,
    quantity: 10,
    unit: 'risme',
    unit_price: new Prisma.Decimal('5.00'),
    total_price: new Prisma.Decimal('50.00'),
    sku: 'CART-A4',
    article_id: null,
    unresolved_code: null,
    vat_rate: new Prisma.Decimal('22.00'),
    vat_nature: null,
    is_split_payment: false,
    is_reverse_charge: false,
    expected_delivery: new Date('2026-05-01'),
    confirmed_delivery: null,
    actual_delivery: null,
    ...overrides,
  }
}

function mockCreateConfirmationSuccess(id = 'conf_1') {
  confirmationCreate.mockResolvedValue({
    id,
    request_id: 'req_1',
    email_log_id: null,
    source: 'MANUAL',
    status: 'PARSED',
    subject: null,
    vendor_reference: null,
    received_at: null,
    parsed_at: new Date(),
    acknowledged_at: null,
    applied_at: null,
    applied_by: null,
    rejected_at: null,
    rejected_by: null,
    rejection_reason: null,
    notes: null,
    metadata: null,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: line.create echoes back the input data con id progressivo
  let counter = 0
  lineCreate.mockImplementation(
    async (call: { data: Record<string, unknown> }) => ({
      id: `line_${++counter}`,
      created_at: new Date(),
      ...call.data,
    }),
  )
})

// --- Tests --------------------------------------------------------------------

describe('createOrderConfirmation', () => {
  it('rifiuta se la richiesta non esiste', async () => {
    requestFindUnique.mockResolvedValue(null)

    await expect(
      createOrderConfirmation({
        request_id: 'missing',
        source: 'MANUAL',
        lines: [{ confirmed_unit_price: 10 }],
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationLineError)

    expect(confirmationCreate).not.toHaveBeenCalled()
  })

  it('rifiuta se non ci sono righe', async () => {
    await expect(
      createOrderConfirmation({
        request_id: 'req_1',
        source: 'MANUAL',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationLineError)

    expect(requestFindUnique).not.toHaveBeenCalled()
  })

  it('calcola price_delta_pct e delivery_delay_days per una riga linkata via request_item_id', async () => {
    const item = makeItem({
      unit_price: new Prisma.Decimal('10.00'),
      expected_delivery: new Date('2026-05-01'),
    })
    requestFindUnique.mockResolvedValue({
      id: 'req_1',
      expected_delivery: null,
      items: [item],
    })
    mockCreateConfirmationSuccess()

    const result = await createOrderConfirmation({
      request_id: 'req_1',
      source: 'EMAIL',
      lines: [
        {
          request_item_id: 'item_1',
          confirmed_unit_price: 12.5, // +25%
          confirmed_delivery: new Date('2026-05-08'), // +7 giorni
        },
      ],
    })

    expect(result.lines).toHaveLength(1)
    expect(lineCreate).toHaveBeenCalledTimes(1)
    const lineCall = lineCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(lineCall.data.request_item_id).toBe('item_1')
    expect(
      (lineCall.data.original_unit_price as Prisma.Decimal).toNumber(),
    ).toBe(10)
    // 25% delta
    expect(
      (lineCall.data.price_delta_pct as Prisma.Decimal).toNumber(),
    ).toBeCloseTo(0.25, 4)
    expect(lineCall.data.delivery_delay_days).toBe(7)
  })

  it('esegue match_by_sku se request_item_id non è fornito', async () => {
    const itemA = makeItem({ id: 'item_a', sku: 'CART-A4' })
    const itemB = makeItem({
      id: 'item_b',
      name: 'Altro',
      sku: 'OTHER',
      unit_price: new Prisma.Decimal('99.00'),
    })
    requestFindUnique.mockResolvedValue({
      id: 'req_1',
      expected_delivery: null,
      items: [itemA, itemB],
    })
    mockCreateConfirmationSuccess()

    await createOrderConfirmation({
      request_id: 'req_1',
      source: 'WEBHOOK',
      lines: [{ match_by_sku: 'CART-A4', confirmed_unit_price: 5.5 }],
    })

    const lineCall = lineCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(lineCall.data.request_item_id).toBe('item_a')
  })

  it('accetta righe orphane (nessun match): request_item_id = null e snapshot minimi', async () => {
    requestFindUnique.mockResolvedValue({
      id: 'req_1',
      expected_delivery: null,
      items: [],
    })
    mockCreateConfirmationSuccess()

    await createOrderConfirmation({
      request_id: 'req_1',
      source: 'MANUAL',
      lines: [
        {
          match_by_name: 'Inesistente',
          confirmed_unit_price: 100,
          confirmed_quantity: 5,
        },
      ],
    })

    const lineCall = lineCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(lineCall.data.request_item_id).toBeNull()
    expect(lineCall.data.original_unit_price).toBeNull()
    expect(lineCall.data.price_delta_pct).toBeNull()
    expect(lineCall.data.confirmed_quantity).toBe(5)
  })

  it("usa PurchaseRequest.expected_delivery come fallback per l'item senza data propria", async () => {
    const item = makeItem({ expected_delivery: null })
    requestFindUnique.mockResolvedValue({
      id: 'req_1',
      expected_delivery: new Date('2026-05-01'),
      items: [item],
    })
    mockCreateConfirmationSuccess()

    await createOrderConfirmation({
      request_id: 'req_1',
      source: 'MANUAL',
      lines: [
        {
          request_item_id: 'item_1',
          confirmed_delivery: new Date('2026-05-15'), // +14 giorni
        },
      ],
    })

    const lineCall = lineCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(lineCall.data.original_expected_delivery).toEqual(
      new Date('2026-05-01'),
    )
    expect(lineCall.data.delivery_delay_days).toBe(14)
  })
})

describe('rejectConfirmation', () => {
  it('marca confirmation REJECTED e tutte le righe flaggate', async () => {
    confirmationFindUnique.mockResolvedValue({
      id: 'conf_1',
      request_id: 'req_1',
      status: 'PARSED',
      vendor_reference: 'Ord.1',
      subject: null,
      lines: [
        { id: 'line_1', request_item_id: 'item_1' },
        { id: 'line_2', request_item_id: null },
      ],
      request: { code: 'PR-1' },
    })
    confirmationUpdate.mockResolvedValue({
      id: 'conf_1',
      status: 'REJECTED',
      lines: [],
    })

    await rejectConfirmation({
      confirmationId: 'conf_1',
      userId: 'user_1',
      reason: 'Prezzi fuori soglia',
    })

    expect(lineUpdateMany).toHaveBeenCalledWith({
      where: { confirmation_id: 'conf_1' },
      data: expect.objectContaining({ rejected: true }),
    })
    expect(confirmationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conf_1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejected_by: 'user_1',
          rejection_reason: 'Prezzi fuori soglia',
        }),
      }),
    )
    expect(timelineCreate).toHaveBeenCalled()
  })

  it('rifiuta se la confirmation non esiste', async () => {
    confirmationFindUnique.mockResolvedValue(null)

    await expect(
      rejectConfirmation({
        confirmationId: 'missing',
        userId: 'user_1',
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(OrderConfirmationNotFoundError)
  })

  it('rifiuta se già in stato terminale (APPLIED)', async () => {
    confirmationFindUnique.mockResolvedValue({
      id: 'conf_1',
      status: 'APPLIED',
      lines: [],
      request: { code: 'PR-1' },
    })

    await expect(
      rejectConfirmation({
        confirmationId: 'conf_1',
        userId: 'user_1',
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(InvalidConfirmationStateError)
  })
})
