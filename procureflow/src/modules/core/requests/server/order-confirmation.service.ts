// ---------------------------------------------------------------------------
// Order Confirmation service — crea/applica/rifiuta conferme d'ordine.
//
// Responsabilità:
//  - createOrderConfirmation: crea confirmation + linee con snapshot dei
//    valori originali e calcolo dei campi derivati (delta % prezzo,
//    giorni di ritardo consegna).
//  - applyConfirmation: in singola transazione aggiorna RequestItem con i
//    valori confermati per le righe accettate, marca la confirmation APPLIED
//    e scrive TimelineEvent + AuditLog.
//  - rejectConfirmation: chiude la confirmation con status REJECTED.
//
// Invarianti:
//  - apply/reject sono idempotenti: chiamate successive su una confirmation
//    terminale (APPLIED o REJECTED) rilanciano InvalidConfirmationStateError.
//  - L'update prezzi avviene esclusivamente dentro prisma.$transaction:
//    qualsiasi errore su una riga fa rollback dell'intera operazione.
// ---------------------------------------------------------------------------

import { Prisma } from '@prisma/client'
import type {
  OrderConfirmation,
  OrderConfirmationLine,
  OrderConfirmationSource,
  RequestItem,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import { writeAuditLog } from '@/modules/core/audit-log'
import type {
  CreateOrderConfirmationInput,
  OrderConfirmationLineInput,
} from '../validations/order-confirmation'

// --- Errori pubblici ----------------------------------------------------------

export class OrderConfirmationNotFoundError extends Error {
  readonly code = 'ORDER_CONFIRMATION_NOT_FOUND'
  constructor(id: string) {
    super(`Order confirmation ${id} not found`)
    this.name = 'OrderConfirmationNotFoundError'
  }
}

export class InvalidConfirmationStateError extends Error {
  readonly code = 'INVALID_CONFIRMATION_STATE'
  constructor(currentStatus: string, attempted: string) {
    super(
      `Cannot ${attempted} confirmation in state ${currentStatus} (must be RECEIVED, PARSED or ACKNOWLEDGED)`,
    )
    this.name = 'InvalidConfirmationStateError'
  }
}

export class InvalidConfirmationLineError extends Error {
  readonly code = 'INVALID_CONFIRMATION_LINE'
  constructor(message: string) {
    super(message)
    this.name = 'InvalidConfirmationLineError'
  }
}

// --- Tipi risultato -----------------------------------------------------------

export type OrderConfirmationWithLines = OrderConfirmation & {
  lines: OrderConfirmationLine[]
}

// --- Helpers ------------------------------------------------------------------

const ACTIVE_STATES = new Set(['RECEIVED', 'PARSED', 'ACKNOWLEDGED'])

function computePriceDeltaPct(
  original: Prisma.Decimal | null | undefined,
  confirmed: number | null | undefined,
): Prisma.Decimal | null {
  if (original == null || confirmed == null) return null
  const origNum = Number(original)
  if (origNum === 0) return null
  const delta = (confirmed - origNum) / origNum
  // Precision @db.Decimal(7, 4): round to 4 decimals
  return new Prisma.Decimal(delta.toFixed(4))
}

function computeDeliveryDelayDays(
  original: Date | null | undefined,
  confirmed: Date | null | undefined,
): number | null {
  if (original == null || confirmed == null) return null
  const diffMs = confirmed.getTime() - original.getTime()
  return Math.round(diffMs / 86_400_000)
}

function toDecimalOrNull(
  value: number | null | undefined,
): Prisma.Decimal | null {
  return value == null ? null : new Prisma.Decimal(value)
}

function resolveRequestItem(
  line: OrderConfirmationLineInput,
  items: readonly RequestItem[],
): RequestItem | null {
  if (line.request_item_id) {
    return items.find((i) => i.id === line.request_item_id) ?? null
  }
  if (line.match_by_sku) {
    const match = items.find(
      (i) => i.sku != null && i.sku === line.match_by_sku,
    )
    if (match) return match
  }
  if (line.match_by_name) {
    const needle = line.match_by_name.toLowerCase().trim()
    return items.find((i) => i.name.toLowerCase().trim() === needle) ?? null
  }
  return null
}

// --- Public API ---------------------------------------------------------------

/**
 * Crea una nuova OrderConfirmation con le relative righe, calcola i campi
 * derivati (delta prezzo %, ritardo consegna in giorni) a partire dallo
 * snapshot degli articoli originali.
 *
 * Lo stato iniziale è PARSED: chi crea la confirmation ha già estratto i
 * dati dall'email/webhook. Il caller può poi applicarla (applyConfirmation)
 * o rifiutarla (rejectConfirmation).
 */
export async function createOrderConfirmation(
  input: CreateOrderConfirmationInput,
): Promise<OrderConfirmationWithLines> {
  if (input.lines.length === 0) {
    throw new InvalidConfirmationLineError(
      'Una conferma d\'ordine deve avere almeno una riga',
    )
  }

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: input.request_id },
    select: { id: true, expected_delivery: true, items: true },
  })

  if (!request) {
    throw new InvalidConfirmationLineError(
      `PurchaseRequest ${input.request_id} non trovata`,
    )
  }

  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const confirmation = await tx.orderConfirmation.create({
      data: {
        request_id: input.request_id,
        email_log_id: input.email_log_id ?? null,
        source: (input.source ?? 'MANUAL') as OrderConfirmationSource,
        status: 'PARSED',
        subject: input.subject ?? null,
        vendor_reference: input.vendor_reference ?? null,
        received_at: input.received_at ?? null,
        parsed_at: now,
        notes: input.notes ?? null,
        metadata:
          input.metadata != null
            ? (input.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    })

    const lineCreations = input.lines.map((line) => {
      const originalItem = resolveRequestItem(line, request.items)

      const originalUnitPrice = originalItem?.unit_price ?? null
      const originalExpectedDelivery =
        originalItem?.expected_delivery ?? request.expected_delivery ?? null

      const priceDeltaPct = computePriceDeltaPct(
        originalUnitPrice,
        line.confirmed_unit_price ?? null,
      )
      const deliveryDelayDays = computeDeliveryDelayDays(
        originalExpectedDelivery,
        line.confirmed_delivery ?? null,
      )

      return tx.orderConfirmationLine.create({
        data: {
          confirmation_id: confirmation.id,
          request_item_id: originalItem?.id ?? null,
          original_name: originalItem?.name ?? null,
          original_quantity: originalItem?.quantity ?? null,
          original_unit: originalItem?.unit ?? null,
          original_unit_price: originalUnitPrice,
          original_expected_delivery: originalExpectedDelivery,
          confirmed_name: line.confirmed_name ?? null,
          confirmed_quantity: line.confirmed_quantity ?? null,
          confirmed_unit: line.confirmed_unit ?? null,
          confirmed_unit_price: toDecimalOrNull(line.confirmed_unit_price),
          confirmed_delivery: line.confirmed_delivery ?? null,
          confirmed_sku: line.confirmed_sku ?? null,
          price_delta_pct: priceDeltaPct,
          delivery_delay_days: deliveryDelayDays,
          notes: line.notes ?? null,
        },
      })
    })

    const lines = await Promise.all(lineCreations)

    return { ...confirmation, lines }
  })
}

/**
 * Applica la confirmation: per ciascuna `accepted_line_ids` che ha un
 * request_item collegato, aggiorna `unit_price`, `total_price`,
 * `confirmed_delivery` (quando il valore confermato è presente).
 *
 * Tutto avviene in una singola transazione: se una riga fallisce, il
 * rollback tiene i RequestItem intatti.
 *
 * Dopo la commit: TimelineEvent + writeAuditLog (fail-soft su audit).
 */
export interface ApplyConfirmationParams {
  confirmationId: string
  userId: string
  acceptedLineIds: readonly string[]
  notes?: string | null
}

export async function applyConfirmation(
  params: ApplyConfirmationParams,
): Promise<OrderConfirmationWithLines> {
  const existing = await prisma.orderConfirmation.findUnique({
    where: { id: params.confirmationId },
    include: { lines: true, request: { select: { code: true } } },
  })

  if (!existing) {
    throw new OrderConfirmationNotFoundError(params.confirmationId)
  }
  if (!ACTIVE_STATES.has(existing.status)) {
    throw new InvalidConfirmationStateError(existing.status, 'apply')
  }

  const acceptedIdsSet = new Set(params.acceptedLineIds)
  const acceptedLines = existing.lines.filter((l) => acceptedIdsSet.has(l.id))

  if (acceptedLines.length === 0) {
    throw new InvalidConfirmationLineError(
      'Nessuna riga valida tra accepted_line_ids',
    )
  }
  if (acceptedLines.length !== acceptedIdsSet.size) {
    throw new InvalidConfirmationLineError(
      'Una o più accepted_line_ids non appartengono a questa confirmation',
    )
  }

  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    // Update RequestItem per ogni riga accettata con link all'item
    const itemChanges: Array<{
      itemId: string
      before: {
        unit_price: Prisma.Decimal | null
        confirmed_delivery: Date | null
        quantity: number
        total_price: Prisma.Decimal | null
      }
      after: {
        unit_price: Prisma.Decimal | null
        confirmed_delivery: Date | null
        quantity: number
        total_price: Prisma.Decimal | null
      }
    }> = []

    for (const line of acceptedLines) {
      if (!line.request_item_id) {
        // Riga senza link all'item: marchiala applied ma non c'è nulla da
        // aggiornare lato prezzi
        await tx.orderConfirmationLine.update({
          where: { id: line.id },
          data: { applied: true, applied_at: now },
        })
        continue
      }

      const currentItem = await tx.requestItem.findUnique({
        where: { id: line.request_item_id },
      })
      if (!currentItem) {
        throw new InvalidConfirmationLineError(
          `RequestItem ${line.request_item_id} non esiste più`,
        )
      }

      const nextUnitPrice =
        line.confirmed_unit_price ?? currentItem.unit_price ?? null
      const nextQuantity = line.confirmed_quantity ?? currentItem.quantity
      const nextConfirmedDelivery =
        line.confirmed_delivery ?? currentItem.confirmed_delivery ?? null

      const nextTotalPrice =
        nextUnitPrice != null
          ? new Prisma.Decimal(
              new Prisma.Decimal(nextUnitPrice).mul(nextQuantity).toFixed(2),
            )
          : currentItem.total_price

      await tx.requestItem.update({
        where: { id: currentItem.id },
        data: {
          unit_price: nextUnitPrice,
          quantity: nextQuantity,
          total_price: nextTotalPrice,
          confirmed_delivery: nextConfirmedDelivery,
        },
      })

      await tx.orderConfirmationLine.update({
        where: { id: line.id },
        data: { applied: true, applied_at: now },
      })

      itemChanges.push({
        itemId: currentItem.id,
        before: {
          unit_price: currentItem.unit_price,
          confirmed_delivery: currentItem.confirmed_delivery,
          quantity: currentItem.quantity,
          total_price: currentItem.total_price,
        },
        after: {
          unit_price:
            nextUnitPrice != null ? new Prisma.Decimal(nextUnitPrice) : null,
          confirmed_delivery: nextConfirmedDelivery,
          quantity: nextQuantity,
          total_price: nextTotalPrice,
        },
      })
    }

    const updated = await tx.orderConfirmation.update({
      where: { id: params.confirmationId },
      data: {
        status: 'APPLIED',
        applied_at: now,
        applied_by: params.userId,
        notes: params.notes ?? existing.notes,
      },
      include: { lines: true },
    })

    await tx.timelineEvent.create({
      data: {
        request_id: existing.request_id,
        type: 'order_confirmation_applied',
        title: 'Conferma d\'ordine applicata',
        description: `${acceptedLines.length} righe applicate su ${existing.lines.length}`,
        metadata: {
          confirmation_id: existing.id,
          accepted_line_ids: params.acceptedLineIds,
          changes: itemChanges.map((c) => ({
            item_id: c.itemId,
            unit_price: {
              old: c.before.unit_price?.toString() ?? null,
              new: c.after.unit_price?.toString() ?? null,
            },
            quantity: {
              old: c.before.quantity,
              new: c.after.quantity,
            },
            total_price: {
              old: c.before.total_price?.toString() ?? null,
              new: c.after.total_price?.toString() ?? null,
            },
            confirmed_delivery: {
              old: c.before.confirmed_delivery?.toISOString() ?? null,
              new: c.after.confirmed_delivery?.toISOString() ?? null,
            },
          })),
        },
        actor: params.userId,
      },
    })

    return updated
  })

  // Audit log fuori transazione, fail-soft
  try {
    await writeAuditLog({
      actorId: params.userId,
      actorType: 'USER',
      action: 'UPDATE',
      entityType: 'OrderConfirmation',
      entityId: params.confirmationId,
      entityLabel: existing.vendor_reference ?? existing.subject ?? null,
      changes: {
        status: { old: existing.status, new: 'APPLIED' },
      },
      metadata: {
        request_id: existing.request_id,
        request_code: existing.request.code,
        accepted_line_count: acceptedLines.length,
        total_line_count: existing.lines.length,
      },
    })
  } catch (err) {
    console.warn(
      '[order-confirmation] Audit log failed (swallowed):',
      err instanceof Error ? err.message : String(err),
    )
  }

  return result
}

/**
 * Rifiuta la confirmation: status -> REJECTED, tutte le righe flaggate,
 * TimelineEvent + AuditLog.
 */
export interface RejectConfirmationParams {
  confirmationId: string
  userId: string
  reason: string
}

export async function rejectConfirmation(
  params: RejectConfirmationParams,
): Promise<OrderConfirmationWithLines> {
  const existing = await prisma.orderConfirmation.findUnique({
    where: { id: params.confirmationId },
    include: { lines: true, request: { select: { code: true } } },
  })

  if (!existing) {
    throw new OrderConfirmationNotFoundError(params.confirmationId)
  }
  if (!ACTIVE_STATES.has(existing.status)) {
    throw new InvalidConfirmationStateError(existing.status, 'reject')
  }

  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    await tx.orderConfirmationLine.updateMany({
      where: { confirmation_id: params.confirmationId },
      data: { rejected: true, rejected_at: now },
    })

    const updated = await tx.orderConfirmation.update({
      where: { id: params.confirmationId },
      data: {
        status: 'REJECTED',
        rejected_at: now,
        rejected_by: params.userId,
        rejection_reason: params.reason,
      },
      include: { lines: true },
    })

    await tx.timelineEvent.create({
      data: {
        request_id: existing.request_id,
        type: 'order_confirmation_rejected',
        title: 'Conferma d\'ordine rifiutata',
        description: params.reason,
        metadata: {
          confirmation_id: existing.id,
          rejected_by: params.userId,
        },
        actor: params.userId,
      },
    })

    return updated
  })

  try {
    await writeAuditLog({
      actorId: params.userId,
      actorType: 'USER',
      action: 'UPDATE',
      entityType: 'OrderConfirmation',
      entityId: params.confirmationId,
      entityLabel: existing.vendor_reference ?? existing.subject ?? null,
      changes: {
        status: { old: existing.status, new: 'REJECTED' },
      },
      metadata: {
        request_id: existing.request_id,
        request_code: existing.request.code,
        reason: params.reason,
      },
    })
  } catch (err) {
    console.warn(
      '[order-confirmation] Audit log failed (swallowed):',
      err instanceof Error ? err.message : String(err),
    )
  }

  return result
}

/**
 * Legge una confirmation con le righe. Usata dalle API routes.
 */
export async function getOrderConfirmation(
  id: string,
): Promise<OrderConfirmationWithLines | null> {
  return prisma.orderConfirmation.findUnique({
    where: { id },
    include: { lines: { orderBy: { created_at: 'asc' } } },
  })
}

/**
 * Lista conferme per una PR.
 */
export async function listOrderConfirmations(
  requestId: string,
): Promise<OrderConfirmationWithLines[]> {
  return prisma.orderConfirmation.findMany({
    where: { request_id: requestId },
    orderBy: { created_at: 'desc' },
    include: { lines: { orderBy: { created_at: 'asc' } } },
  })
}
