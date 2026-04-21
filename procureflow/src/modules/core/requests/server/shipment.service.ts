// ---------------------------------------------------------------------------
// Shipment service — gestisce le spedizioni di un RequestItem.
//
// Un RequestItem può essere spedito in N tranche (RequestItemShipment).
// Il `RequestItem.delivery_status` è un campo derivato, ricalcolato ad ogni
// create/update shipment tramite `recomputeRequestItemDeliveryStatus`.
//
// Regole di calcolo dello stato derivato (in ordine di priorità):
//  1. Tutte le shipment in stato DELIVERED E somma shipped_quantity
//     ≥ RequestItem.quantity → stato `DELIVERED`
//  2. Almeno una shipment DELIVERED ma la somma < quantity → `PARTIAL`
//  3. Almeno una shipment SHIPPED e nessuna DELIVERED → `SHIPPED`
//  4. Nessuna shipment o tutte PENDING/CANCELLED → mantieni lo stato
//     propagato dall'ultima OrderConfirmationLine applicata (default
//     `CONFIRMED`).
//
// Vincolo di quantità:
//  - sum(shipped_quantity) ≤ RequestItem.quantity × (1 + tolleranza).
//  - Tolleranza di default 5% (configurabile via param). Applica anche agli
//    update che aumentano la quantità.
// ---------------------------------------------------------------------------

import { Prisma } from '@prisma/client'
import type {
  LineDeliveryStatus,
  RequestItem,
  RequestItemShipment,
  ShipmentSource,
  ShipmentStatus,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import { writeAuditLog } from '@/modules/core/audit-log'

// --- Errori pubblici ---------------------------------------------------------

export class RequestItemNotFoundError extends Error {
  readonly code = 'REQUEST_ITEM_NOT_FOUND'
  constructor(id: string) {
    super(`RequestItem ${id} non trovato`)
    this.name = 'RequestItemNotFoundError'
  }
}

export class ShipmentNotFoundError extends Error {
  readonly code = 'SHIPMENT_NOT_FOUND'
  constructor(id: string) {
    super(`RequestItemShipment ${id} non trovato`)
    this.name = 'ShipmentNotFoundError'
  }
}

export class ShipmentQuantityExceededError extends Error {
  readonly code = 'SHIPMENT_QUANTITY_EXCEEDED'
  constructor(
    readonly attempted: Prisma.Decimal,
    readonly cap: Prisma.Decimal,
  ) {
    super(
      `Somma shipped_quantity ${attempted.toString()} supera il cap ${cap.toString()} (quantity × tolleranza)`,
    )
    this.name = 'ShipmentQuantityExceededError'
  }
}

// --- Config ------------------------------------------------------------------

/** Tolleranza di default sulla somma delle shipped_quantity (5%). */
export const DEFAULT_SHIPMENT_QUANTITY_TOLERANCE = 0.05

// --- Tipi interni ------------------------------------------------------------

interface PrismaTx {
  requestItem: {
    findUnique: typeof prisma.requestItem.findUnique
    update: typeof prisma.requestItem.update
  }
  requestItemShipment: {
    create: typeof prisma.requestItemShipment.create
    findUnique: typeof prisma.requestItemShipment.findUnique
    update: typeof prisma.requestItemShipment.update
    findMany: typeof prisma.requestItemShipment.findMany
    aggregate: typeof prisma.requestItemShipment.aggregate
  }
  orderConfirmationLine: {
    findFirst: typeof prisma.orderConfirmationLine.findFirst
  }
  timelineEvent: {
    create: typeof prisma.timelineEvent.create
  }
}

// --- Helpers ------------------------------------------------------------------

function toDecimal(v: Prisma.Decimal | number | string): Prisma.Decimal {
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v)
}

/**
 * Stati di shipment che contano per la somma "già spedita". `CANCELLED`
 * e `LOST` sono esclusi: non consumano quantità contro il cap.
 */
const ACTIVE_SHIPMENT_STATUSES = new Set<ShipmentStatus>([
  'PENDING',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
])

/**
 * Ricalcola `RequestItem.delivery_status` in base all'aggregato delle
 * shipment e, in assenza di shipment significative, allo stato dell'ultima
 * OrderConfirmationLine applicata.
 *
 * Deve essere invocato dentro una transazione (riceve `tx`).
 */
export async function recomputeRequestItemDeliveryStatus(
  tx: PrismaTx,
  requestItemId: string,
): Promise<LineDeliveryStatus> {
  const item = await tx.requestItem.findUnique({
    where: { id: requestItemId },
  })
  if (!item) throw new RequestItemNotFoundError(requestItemId)

  const shipments = await tx.requestItemShipment.findMany({
    where: { request_item_id: requestItemId },
    select: { status: true, shipped_quantity: true },
  })

  const quantityDecimal = new Prisma.Decimal(item.quantity)

  const deliveredSum = shipments
    .filter((s) => s.status === 'DELIVERED')
    .reduce<Prisma.Decimal>(
      (acc, s) => acc.plus(s.shipped_quantity),
      new Prisma.Decimal(0),
    )

  const anyDelivered = deliveredSum.greaterThan(0)
  const anyShipped = shipments.some((s) => s.status === 'SHIPPED')

  let nextStatus: LineDeliveryStatus

  if (anyDelivered && deliveredSum.greaterThanOrEqualTo(quantityDecimal)) {
    nextStatus = 'DELIVERED'
  } else if (anyDelivered) {
    nextStatus = 'PARTIAL'
  } else if (anyShipped) {
    nextStatus = 'SHIPPED'
  } else {
    // Nessuna shipment DELIVERED o SHIPPED: prendi lo stato dall'ultima
    // OrderConfirmationLine applicata per questo item, se esiste.
    const lastAppliedLine = await tx.orderConfirmationLine.findFirst({
      where: {
        request_item_id: requestItemId,
        applied: true,
      },
      orderBy: { applied_at: 'desc' },
      select: { delivery_status: true },
    })
    nextStatus = lastAppliedLine?.delivery_status ?? 'CONFIRMED'
  }

  if (nextStatus !== item.delivery_status) {
    await tx.requestItem.update({
      where: { id: requestItemId },
      data: { delivery_status: nextStatus },
    })
  }

  return nextStatus
}

/**
 * Verifica che la somma delle shipped_quantity non superi il cap
 * (quantity × (1 + tolerance)). Lancia `ShipmentQuantityExceededError` altrimenti.
 */
async function assertShipmentQuantityWithinCap(
  tx: PrismaTx,
  requestItem: RequestItem,
  additionalQuantity: Prisma.Decimal,
  tolerance: number,
  excludeShipmentId?: string,
): Promise<void> {
  const aggregate = await tx.requestItemShipment.aggregate({
    where: {
      request_item_id: requestItem.id,
      status: { in: Array.from(ACTIVE_SHIPMENT_STATUSES) },
      ...(excludeShipmentId ? { NOT: { id: excludeShipmentId } } : {}),
    },
    _sum: { shipped_quantity: true },
  })

  const currentSum =
    aggregate._sum.shipped_quantity ?? new Prisma.Decimal(0)
  const attempted = currentSum.plus(additionalQuantity)
  const cap = new Prisma.Decimal(requestItem.quantity).mul(1 + tolerance)

  if (attempted.greaterThan(cap)) {
    throw new ShipmentQuantityExceededError(attempted, cap)
  }
}

// --- Public API --------------------------------------------------------------

export interface CreateShipmentInput {
  request_item_id: string
  shipped_quantity: number | string | Prisma.Decimal
  expected_ship_date?: Date | null
  actual_ship_date?: Date | null
  expected_delivery_date?: Date | null
  actual_delivery_date?: Date | null
  tracking_number?: string | null
  carrier?: string | null
  tracking_url?: string | null
  status?: ShipmentStatus
  source?: ShipmentSource
  source_email_log_id?: string | null
  notes?: string | null
  /** Tolleranza % sulla somma shipped_quantity (default 0.05). */
  quantityTolerance?: number
  userId: string
}

export async function createShipment(
  input: CreateShipmentInput,
): Promise<RequestItemShipment> {
  const shippedQuantity = toDecimal(input.shipped_quantity)
  if (shippedQuantity.lessThanOrEqualTo(0)) {
    throw new ShipmentQuantityExceededError(
      shippedQuantity,
      new Prisma.Decimal(0),
    )
  }

  const tolerance =
    input.quantityTolerance ?? DEFAULT_SHIPMENT_QUANTITY_TOLERANCE

  const now = new Date()

  const result = await prisma.$transaction(async (txClient) => {
    const tx = txClient as unknown as PrismaTx

    const item = await tx.requestItem.findUnique({
      where: { id: input.request_item_id },
    })
    if (!item) throw new RequestItemNotFoundError(input.request_item_id)

    await assertShipmentQuantityWithinCap(
      tx,
      item,
      shippedQuantity,
      tolerance,
    )

    const created = await tx.requestItemShipment.create({
      data: {
        request_item_id: input.request_item_id,
        shipped_quantity: shippedQuantity,
        expected_ship_date: input.expected_ship_date ?? null,
        actual_ship_date: input.actual_ship_date ?? null,
        expected_delivery_date: input.expected_delivery_date ?? null,
        actual_delivery_date: input.actual_delivery_date ?? null,
        tracking_number: input.tracking_number ?? null,
        carrier: input.carrier ?? null,
        tracking_url: input.tracking_url ?? null,
        status: input.status ?? 'PENDING',
        source: input.source ?? 'MANUAL',
        source_email_log_id: input.source_email_log_id ?? null,
        notes: input.notes ?? null,
      },
    })

    await recomputeRequestItemDeliveryStatus(tx, input.request_item_id)

    await tx.timelineEvent.create({
      data: {
        request_id: item.request_id,
        type: 'shipment_created',
        title: 'Spedizione creata',
        description: input.tracking_number
          ? `Tracking ${input.tracking_number}${input.carrier ? ` (${input.carrier})` : ''}`
          : null,
        metadata: {
          shipment_id: created.id,
          request_item_id: input.request_item_id,
          shipped_quantity: shippedQuantity.toString(),
          status: created.status,
          source: created.source,
          created_at: now.toISOString(),
        },
        actor: input.userId,
      },
    })

    return created
  })

  try {
    await writeAuditLog({
      actorId: input.userId,
      actorType: 'USER',
      action: 'CREATE',
      entityType: 'RequestItemShipment',
      entityId: result.id,
      entityLabel: input.tracking_number ?? null,
      metadata: {
        request_item_id: input.request_item_id,
        shipped_quantity: shippedQuantity.toString(),
        status: result.status,
      },
    })
  } catch (err) {
    console.warn(
      '[shipment] Audit log failed (swallowed):',
      err instanceof Error ? err.message : String(err),
    )
  }

  return result
}

export interface UpdateShipmentStatusInput {
  shipmentId: string
  status: ShipmentStatus
  actual_ship_date?: Date | null
  actual_delivery_date?: Date | null
  notes?: string | null
  userId: string
}

export async function updateShipmentStatus(
  input: UpdateShipmentStatusInput,
): Promise<RequestItemShipment> {
  const result = await prisma.$transaction(async (txClient) => {
    const tx = txClient as unknown as PrismaTx

    const existing = await tx.requestItemShipment.findUnique({
      where: { id: input.shipmentId },
    })
    if (!existing) throw new ShipmentNotFoundError(input.shipmentId)

    const updated = await tx.requestItemShipment.update({
      where: { id: input.shipmentId },
      data: {
        status: input.status,
        actual_ship_date:
          input.actual_ship_date !== undefined
            ? input.actual_ship_date
            : existing.actual_ship_date,
        actual_delivery_date:
          input.actual_delivery_date !== undefined
            ? input.actual_delivery_date
            : existing.actual_delivery_date,
        notes: input.notes ?? existing.notes,
      },
    })

    await recomputeRequestItemDeliveryStatus(tx, existing.request_item_id)

    const item = await tx.requestItem.findUnique({
      where: { id: existing.request_item_id },
      select: { request_id: true },
    })

    if (item) {
      await tx.timelineEvent.create({
        data: {
          request_id: item.request_id,
          type: 'shipment_status_changed',
          title: `Spedizione: ${existing.status} → ${input.status}`,
          description: updated.tracking_number
            ? `Tracking ${updated.tracking_number}`
            : null,
          metadata: {
            shipment_id: existing.id,
            request_item_id: existing.request_item_id,
            old_status: existing.status,
            new_status: input.status,
          },
          actor: input.userId,
        },
      })
    }

    return { updated, oldStatus: existing.status }
  })

  try {
    await writeAuditLog({
      actorId: input.userId,
      actorType: 'USER',
      action: 'UPDATE',
      entityType: 'RequestItemShipment',
      entityId: input.shipmentId,
      entityLabel: result.updated.tracking_number ?? null,
      changes: {
        status: { old: result.oldStatus, new: input.status },
      },
    })
  } catch (err) {
    console.warn(
      '[shipment] Audit log failed (swallowed):',
      err instanceof Error ? err.message : String(err),
    )
  }

  return result.updated
}

export async function listShipmentsForRequestItem(
  requestItemId: string,
): Promise<RequestItemShipment[]> {
  return prisma.requestItemShipment.findMany({
    where: { request_item_id: requestItemId },
    orderBy: { created_at: 'asc' },
  })
}

export async function listShipmentsForPurchaseRequest(
  requestId: string,
): Promise<RequestItemShipment[]> {
  return prisma.requestItemShipment.findMany({
    where: { request_item: { request_id: requestId } },
    orderBy: { created_at: 'asc' },
  })
}

export async function getTotalShippedQuantity(
  requestItemId: string,
): Promise<Prisma.Decimal> {
  const agg = await prisma.requestItemShipment.aggregate({
    where: {
      request_item_id: requestItemId,
      status: { in: ['SHIPPED', 'DELIVERED'] },
    },
    _sum: { shipped_quantity: true },
  })
  return agg._sum.shipped_quantity ?? new Prisma.Decimal(0)
}

export async function getTotalDeliveredQuantity(
  requestItemId: string,
): Promise<Prisma.Decimal> {
  const agg = await prisma.requestItemShipment.aggregate({
    where: {
      request_item_id: requestItemId,
      status: 'DELIVERED',
    },
    _sum: { shipped_quantity: true },
  })
  return agg._sum.shipped_quantity ?? new Prisma.Decimal(0)
}
