// ---------------------------------------------------------------------------
// Unit tests for shipment.service — createShipment, updateShipmentStatus,
// recomputeRequestItemDeliveryStatus + aggregate helpers.
//
// Copre:
//  - createShipment crea shipment + ricalcola delivery_status
//  - createShipment valida il cap sulla somma shipped_quantity (tolleranza 5%)
//  - updateShipmentStatus aggiorna stato e ricalcola
//  - recomputeRequestItemDeliveryStatus per tutti gli scenari:
//    nessuna shipment, solo PENDING, qualche SHIPPED, qualche DELIVERED
//    parziale, DELIVERED che copre tutta la quantity, fallback da
//    OrderConfirmationLine applicata.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

// --- Prisma mock -------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const itemFindUnique = vi.fn()
  const itemUpdate = vi.fn()
  const shipmentCreate = vi.fn()
  const shipmentFindUnique = vi.fn()
  const shipmentUpdate = vi.fn()
  const shipmentFindMany = vi.fn()
  const shipmentAggregate = vi.fn()
  const lineFindFirst = vi.fn()
  const timelineCreate = vi.fn()
  const writeAuditLogMock = vi.fn().mockResolvedValue(undefined)

  const txHandlers = {
    requestItem: {
      findUnique: (...a: unknown[]) => itemFindUnique(...a),
      update: (...a: unknown[]) => itemUpdate(...a),
    },
    requestItemShipment: {
      create: (...a: unknown[]) => shipmentCreate(...a),
      findUnique: (...a: unknown[]) => shipmentFindUnique(...a),
      update: (...a: unknown[]) => shipmentUpdate(...a),
      findMany: (...a: unknown[]) => shipmentFindMany(...a),
      aggregate: (...a: unknown[]) => shipmentAggregate(...a),
    },
    orderConfirmationLine: {
      findFirst: (...a: unknown[]) => lineFindFirst(...a),
    },
    timelineEvent: {
      create: (...a: unknown[]) => timelineCreate(...a),
    },
  }

  const transactionImpl = vi.fn((cb: (tx: unknown) => Promise<unknown>) =>
    cb(txHandlers),
  )

  return {
    itemFindUnique,
    itemUpdate,
    shipmentCreate,
    shipmentFindUnique,
    shipmentUpdate,
    shipmentFindMany,
    shipmentAggregate,
    lineFindFirst,
    timelineCreate,
    writeAuditLogMock,
    txHandlers,
    transactionImpl,
  }
})

const {
  itemFindUnique,
  itemUpdate,
  shipmentCreate,
  shipmentFindUnique,
  shipmentUpdate,
  shipmentFindMany,
  shipmentAggregate,
  lineFindFirst,
  timelineCreate,
  writeAuditLogMock,
  txHandlers,
} = mocks

vi.mock('@/lib/db', () => ({
  prisma: {
    ...mocks.txHandlers,
    $transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      mocks.transactionImpl(cb),
  },
}))

vi.mock('@/modules/core/audit-log', () => ({
  writeAuditLog: (...a: unknown[]) => mocks.writeAuditLogMock(...a),
}))

// Import after mocks
import {
  createShipment,
  updateShipmentStatus,
  recomputeRequestItemDeliveryStatus,
  ShipmentQuantityExceededError,
  RequestItemNotFoundError,
  ShipmentNotFoundError,
} from '../server/shipment.service'

// --- Helpers ----------------------------------------------------------------

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item_1',
    request_id: 'req_1',
    quantity: 10,
    delivery_status: 'CONFIRMED',
    ...overrides,
  }
}

function makeShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ship_1',
    request_item_id: 'item_1',
    shipped_quantity: new Prisma.Decimal('5'),
    status: 'PENDING',
    source: 'MANUAL',
    tracking_number: null,
    carrier: null,
    tracking_url: null,
    actual_ship_date: null,
    actual_delivery_date: null,
    expected_ship_date: null,
    expected_delivery_date: null,
    notes: null,
    source_email_log_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default aggregate → 0 (nessuna shipment pre-esistente)
  shipmentAggregate.mockResolvedValue({
    _sum: { shipped_quantity: new Prisma.Decimal(0) },
  })
  shipmentFindMany.mockResolvedValue([])
})

// --- Tests: recomputeRequestItemDeliveryStatus ------------------------------

describe('recomputeRequestItemDeliveryStatus', () => {
  it('nessuna shipment, nessuna line applicata → CONFIRMED', async () => {
    itemFindUnique.mockResolvedValue(makeItem())
    shipmentFindMany.mockResolvedValue([])
    lineFindFirst.mockResolvedValue(null)

    const result = await recomputeRequestItemDeliveryStatus(
      txHandlers as never,
      'item_1',
    )

    expect(result).toBe('CONFIRMED')
    // nessun update se lo stato non cambia
    expect(itemUpdate).not.toHaveBeenCalled()
  })

  it('fallback da OrderConfirmationLine.delivery_status quando nessuna shipment significativa', async () => {
    itemFindUnique.mockResolvedValue(makeItem({ delivery_status: 'CONFIRMED' }))
    shipmentFindMany.mockResolvedValue([
      { status: 'PENDING', shipped_quantity: new Prisma.Decimal('5') },
    ])
    lineFindFirst.mockResolvedValue({ delivery_status: 'BACKORDERED' })

    const result = await recomputeRequestItemDeliveryStatus(
      txHandlers as never,
      'item_1',
    )

    expect(result).toBe('BACKORDERED')
    expect(itemUpdate).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: { delivery_status: 'BACKORDERED' },
    })
  })

  it('almeno una shipment SHIPPED e nessuna DELIVERED → SHIPPED', async () => {
    itemFindUnique.mockResolvedValue(makeItem())
    shipmentFindMany.mockResolvedValue([
      { status: 'SHIPPED', shipped_quantity: new Prisma.Decimal('3') },
      { status: 'PENDING', shipped_quantity: new Prisma.Decimal('2') },
    ])

    const result = await recomputeRequestItemDeliveryStatus(
      txHandlers as never,
      'item_1',
    )

    expect(result).toBe('SHIPPED')
    expect(itemUpdate).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: { delivery_status: 'SHIPPED' },
    })
  })

  it('shipment DELIVERED parziale (3 su 10) → PARTIAL', async () => {
    itemFindUnique.mockResolvedValue(makeItem({ quantity: 10 }))
    shipmentFindMany.mockResolvedValue([
      { status: 'DELIVERED', shipped_quantity: new Prisma.Decimal('3') },
      { status: 'SHIPPED', shipped_quantity: new Prisma.Decimal('5') },
    ])

    const result = await recomputeRequestItemDeliveryStatus(
      txHandlers as never,
      'item_1',
    )

    expect(result).toBe('PARTIAL')
  })

  it('shipment DELIVERED coprono tutta la quantity → DELIVERED', async () => {
    itemFindUnique.mockResolvedValue(makeItem({ quantity: 10 }))
    shipmentFindMany.mockResolvedValue([
      { status: 'DELIVERED', shipped_quantity: new Prisma.Decimal('4') },
      { status: 'DELIVERED', shipped_quantity: new Prisma.Decimal('6') },
    ])

    const result = await recomputeRequestItemDeliveryStatus(
      txHandlers as never,
      'item_1',
    )

    expect(result).toBe('DELIVERED')
  })

  it('errore se RequestItem non esiste', async () => {
    itemFindUnique.mockResolvedValue(null)

    await expect(
      recomputeRequestItemDeliveryStatus(txHandlers as never, 'missing'),
    ).rejects.toBeInstanceOf(RequestItemNotFoundError)
  })
})

// --- Tests: createShipment ---------------------------------------------------

describe('createShipment', () => {
  it('crea shipment + invoca recompute + scrive timeline', async () => {
    itemFindUnique.mockResolvedValue(makeItem())
    shipmentCreate.mockImplementation(
      async (call: { data: Record<string, unknown> }) =>
        makeShipment({ ...call.data, id: 'ship_new' }),
    )
    shipmentFindMany.mockResolvedValue([])

    const result = await createShipment({
      request_item_id: 'item_1',
      shipped_quantity: 5,
      tracking_number: 'TRK123',
      carrier: 'DHL',
      status: 'SHIPPED',
      userId: 'user_admin',
    })

    expect(result.id).toBe('ship_new')
    expect(shipmentCreate).toHaveBeenCalledTimes(1)
    expect(timelineCreate).toHaveBeenCalledTimes(1)
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1)
    const auditCall = writeAuditLogMock.mock.calls[0]?.[0] as {
      entityType: string
      action: string
    }
    expect(auditCall.entityType).toBe('RequestItemShipment')
    expect(auditCall.action).toBe('CREATE')
  })

  it('errore se somma shipped_quantity supera il cap (quantity × 1.05)', async () => {
    itemFindUnique.mockResolvedValue(makeItem({ quantity: 10 }))
    shipmentAggregate.mockResolvedValue({
      _sum: { shipped_quantity: new Prisma.Decimal('9') },
    })

    await expect(
      createShipment({
        request_item_id: 'item_1',
        shipped_quantity: 3, // 9 + 3 = 12 > 10.5 (cap)
        userId: 'user_admin',
      }),
    ).rejects.toBeInstanceOf(ShipmentQuantityExceededError)

    expect(shipmentCreate).not.toHaveBeenCalled()
  })

  it('accetta shipment entro il cap con tolleranza', async () => {
    itemFindUnique.mockResolvedValue(makeItem({ quantity: 10 }))
    shipmentAggregate.mockResolvedValue({
      _sum: { shipped_quantity: new Prisma.Decimal('8') },
    })
    shipmentCreate.mockImplementation(
      async (call: { data: Record<string, unknown> }) =>
        makeShipment({ ...call.data, id: 'ship_new' }),
    )

    await createShipment({
      request_item_id: 'item_1',
      shipped_quantity: 2, // 8 + 2 = 10, entro il cap (10.5)
      userId: 'user_admin',
    })

    expect(shipmentCreate).toHaveBeenCalledTimes(1)
  })

  it('errore se RequestItem non esiste', async () => {
    itemFindUnique.mockResolvedValue(null)

    await expect(
      createShipment({
        request_item_id: 'missing',
        shipped_quantity: 5,
        userId: 'user_admin',
      }),
    ).rejects.toBeInstanceOf(RequestItemNotFoundError)
  })

  it('errore se shipped_quantity <= 0', async () => {
    await expect(
      createShipment({
        request_item_id: 'item_1',
        shipped_quantity: 0,
        userId: 'user_admin',
      }),
    ).rejects.toBeInstanceOf(ShipmentQuantityExceededError)
  })
})

// --- Tests: updateShipmentStatus --------------------------------------------

describe('updateShipmentStatus', () => {
  it('aggiorna stato + invoca recompute + scrive audit', async () => {
    shipmentFindUnique.mockResolvedValue(makeShipment({ status: 'SHIPPED' }))
    shipmentUpdate.mockResolvedValue(makeShipment({ status: 'DELIVERED' }))
    itemFindUnique.mockResolvedValue(makeItem())
    shipmentFindMany.mockResolvedValue([
      { status: 'DELIVERED', shipped_quantity: new Prisma.Decimal('10') },
    ])

    const result = await updateShipmentStatus({
      shipmentId: 'ship_1',
      status: 'DELIVERED',
      actual_delivery_date: new Date('2026-05-10'),
      userId: 'user_admin',
    })

    expect(result.status).toBe('DELIVERED')
    expect(timelineCreate).toHaveBeenCalledTimes(1)
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1)
  })

  it('errore se shipment non esiste', async () => {
    shipmentFindUnique.mockResolvedValue(null)

    await expect(
      updateShipmentStatus({
        shipmentId: 'missing',
        status: 'DELIVERED',
        userId: 'user_admin',
      }),
    ).rejects.toBeInstanceOf(ShipmentNotFoundError)
  })
})
