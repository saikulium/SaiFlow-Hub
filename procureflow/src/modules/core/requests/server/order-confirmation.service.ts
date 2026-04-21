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
  LineDeliveryStatus,
  OrderConfirmation,
  OrderConfirmationLine,
  OrderConfirmationSource,
  OrderConfirmationStatus,
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

/**
 * Stati in cui una confirmation può ancora ricevere operazioni di apply/reject
 * (sulle righe non ancora terminate). `PARTIALLY_APPLIED` è incluso perché
 * rappresenta una confirmation con un sottoinsieme di righe già applicato o
 * rifiutato — restano altre righe su cui operare.
 */
const OPEN_STATES = new Set<OrderConfirmationStatus>([
  'RECEIVED',
  'PARSED',
  'ACKNOWLEDGED',
  'PARTIALLY_APPLIED',
])

/**
 * Stati iniziali in cui una confirmation non ha ancora ricevuto alcuna
 * operazione terminale sulle righe. Usato da `rejectConfirmation` per evitare
 * di sovrascrivere una apply parziale con un reject globale.
 */
const INITIAL_STATES = new Set<OrderConfirmationStatus>([
  'RECEIVED',
  'PARSED',
  'ACKNOWLEDGED',
])

type ConfirmationLineTerminalState = Pick<
  OrderConfirmationLine,
  'id' | 'applied' | 'rejected'
>

/**
 * True quando ogni riga della confirmation ha raggiunto uno stato terminale
 * (applied oppure rejected). Usato da `applyConfirmation` e `rejectLines` per
 * decidere fra lo stato finale `APPLIED` e quello intermedio
 * `PARTIALLY_APPLIED`.
 */
export function isConfirmationComplete(
  lines: ReadonlyArray<ConfirmationLineTerminalState>,
): boolean {
  if (lines.length === 0) return false
  return lines.every((l) => l.applied || l.rejected)
}

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
      "Una conferma d'ordine deve avere almeno una riga",
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
  if (!OPEN_STATES.has(existing.status)) {
    throw new InvalidConfirmationStateError(existing.status, 'apply')
  }

  const acceptedIdsSet = new Set(params.acceptedLineIds)
  const matchedLines = existing.lines.filter((l) => acceptedIdsSet.has(l.id))

  if (matchedLines.length !== acceptedIdsSet.size) {
    throw new InvalidConfirmationLineError(
      'Una o più accepted_line_ids non appartengono a questa confirmation',
    )
  }

  // Rifiuta se una riga è già terminale (applied o rejected): rende l'apply
  // idempotente e previene sovrascritture accidentali.
  const alreadyTerminal = matchedLines.filter((l) => l.applied || l.rejected)
  if (alreadyTerminal.length > 0) {
    throw new InvalidConfirmationLineError(
      `Righe già in stato terminale: ${alreadyTerminal.map((l) => l.id).join(', ')}`,
    )
  }

  if (matchedLines.length === 0) {
    throw new InvalidConfirmationLineError(
      'Nessuna riga valida tra accepted_line_ids',
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
        delivery_status: LineDeliveryStatus
      }
      after: {
        unit_price: Prisma.Decimal | null
        confirmed_delivery: Date | null
        quantity: number
        total_price: Prisma.Decimal | null
        delivery_status: LineDeliveryStatus
      }
    }> = []

    for (const line of matchedLines) {
      if (!line.request_item_id) {
        // Riga senza link all'item: marchiala applied ma non c'è nulla da
        // aggiornare lato prezzi / stato riga
        await tx.orderConfirmationLine.update({
          where: { id: line.id },
          data: { applied: true, applied_at: now, applied_by: params.userId },
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

      // Propaga il delivery_status della linea di conferma sul RequestItem
      // quando diverso dal default (CONFIRMED) — così la UI mostra PARTIAL,
      // BACKORDERED, ecc. sulla riga dopo l'apply.
      const nextDeliveryStatus: LineDeliveryStatus =
        line.delivery_status !== 'CONFIRMED'
          ? line.delivery_status
          : currentItem.delivery_status

      await tx.requestItem.update({
        where: { id: currentItem.id },
        data: {
          unit_price: nextUnitPrice,
          quantity: nextQuantity,
          total_price: nextTotalPrice,
          confirmed_delivery: nextConfirmedDelivery,
          delivery_status: nextDeliveryStatus,
        },
      })

      await tx.orderConfirmationLine.update({
        where: { id: line.id },
        data: { applied: true, applied_at: now, applied_by: params.userId },
      })

      itemChanges.push({
        itemId: currentItem.id,
        before: {
          unit_price: currentItem.unit_price,
          confirmed_delivery: currentItem.confirmed_delivery,
          quantity: currentItem.quantity,
          total_price: currentItem.total_price,
          delivery_status: currentItem.delivery_status,
        },
        after: {
          unit_price:
            nextUnitPrice != null ? new Prisma.Decimal(nextUnitPrice) : null,
          confirmed_delivery: nextConfirmedDelivery,
          quantity: nextQuantity,
          total_price: nextTotalPrice,
          delivery_status: nextDeliveryStatus,
        },
      })
    }

    // Calcola lo stato finale: APPLIED se ogni riga è ora terminale,
    // altrimenti PARTIALLY_APPLIED. Le righe appena applicate sono per
    // costruzione terminali; le altre mantengono il loro stato originale.
    const projectedLines: ConfirmationLineTerminalState[] = existing.lines.map(
      (l) =>
        acceptedIdsSet.has(l.id)
          ? { id: l.id, applied: true, rejected: l.rejected }
          : l,
    )
    const complete = isConfirmationComplete(projectedLines)
    const nextStatus: OrderConfirmationStatus = complete
      ? 'APPLIED'
      : 'PARTIALLY_APPLIED'

    const updated = await tx.orderConfirmation.update({
      where: { id: params.confirmationId },
      data: {
        status: nextStatus,
        applied_at: complete ? now : existing.applied_at,
        applied_by: complete ? params.userId : existing.applied_by,
        notes: params.notes ?? existing.notes,
      },
      include: { lines: true },
    })

    await tx.timelineEvent.create({
      data: {
        request_id: existing.request_id,
        type: complete
          ? 'order_confirmation_applied'
          : 'order_confirmation_partially_applied',
        title: complete
          ? "Conferma d'ordine applicata"
          : "Conferma d'ordine applicata parzialmente",
        description: `${matchedLines.length} righe applicate su ${existing.lines.length}`,
        metadata: {
          confirmation_id: existing.id,
          accepted_line_ids: params.acceptedLineIds,
          final_status: nextStatus,
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
            delivery_status: {
              old: c.before.delivery_status,
              new: c.after.delivery_status,
            },
          })),
        },
        actor: params.userId,
      },
    })

    return { updated, nextStatus }
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
        status: { old: existing.status, new: result.nextStatus },
      },
      metadata: {
        request_id: existing.request_id,
        request_code: existing.request.code,
        accepted_line_count: matchedLines.length,
        total_line_count: existing.lines.length,
      },
    })
  } catch (err) {
    console.warn(
      '[order-confirmation] Audit log failed (swallowed):',
      err instanceof Error ? err.message : String(err),
    )
  }

  return result.updated
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
  // Reject globale ammesso solo da stati iniziali: su PARTIALLY_APPLIED
  // usare rejectLines per rifiutare le righe pendenti senza toccare quelle
  // già applicate.
  if (!INITIAL_STATES.has(existing.status)) {
    throw new InvalidConfirmationStateError(existing.status, 'reject')
  }

  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    await tx.orderConfirmationLine.updateMany({
      where: { confirmation_id: params.confirmationId },
      data: {
        rejected: true,
        rejected_at: now,
        rejected_by: params.userId,
        rejected_reason: params.reason,
      },
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
        title: "Conferma d'ordine rifiutata",
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
 * Rifiuta granularmente solo le righe specificate.
 *
 * Comportamento:
 *  - Ogni riga in `rejectedLineIds` viene marcata rejected=true con
 *    reason e userId. Errore se la riga non appartiene alla confirmation
 *    o è già terminale (applied/rejected).
 *  - Se la riga ha `request_item_id`, il campo `RequestItem.delivery_status`
 *    viene propagato a `newRequestItemStatus` (UNAVAILABLE o CANCELLED).
 *  - Dopo gli update, lo stato della confirmation diventa:
 *      - `APPLIED` se tutte le righe sono ora terminali
 *      - `PARTIALLY_APPLIED` altrimenti
 *    Da PARTIALLY_APPLIED lo stato può tornare APPLIED con ulteriori apply
 *    o reject-lines.
 *  - TimelineEvent + AuditLog (fail-soft).
 */
export interface RejectLinesParams {
  confirmationId: string
  userId: string
  rejectedLineIds: readonly string[]
  reason: string
  /**
   * Stato da propagare al `RequestItem.delivery_status` delle righe rifiutate.
   * `UNAVAILABLE` = il fornitore non può fornire. `CANCELLED` = annullata
   * dall'utente o dal fornitore.
   */
  newRequestItemStatus: Extract<LineDeliveryStatus, 'UNAVAILABLE' | 'CANCELLED'>
}

export async function rejectLines(
  params: RejectLinesParams,
): Promise<OrderConfirmationWithLines> {
  const existing = await prisma.orderConfirmation.findUnique({
    where: { id: params.confirmationId },
    include: { lines: true, request: { select: { code: true } } },
  })

  if (!existing) {
    throw new OrderConfirmationNotFoundError(params.confirmationId)
  }
  if (!OPEN_STATES.has(existing.status)) {
    throw new InvalidConfirmationStateError(existing.status, 'reject lines')
  }

  const rejectedIdsSet = new Set(params.rejectedLineIds)
  const matchedLines = existing.lines.filter((l) => rejectedIdsSet.has(l.id))

  if (matchedLines.length !== rejectedIdsSet.size) {
    throw new InvalidConfirmationLineError(
      'Una o più rejected_line_ids non appartengono a questa confirmation',
    )
  }
  if (matchedLines.length === 0) {
    throw new InvalidConfirmationLineError(
      'Nessuna riga valida tra rejected_line_ids',
    )
  }

  const alreadyTerminal = matchedLines.filter((l) => l.applied || l.rejected)
  if (alreadyTerminal.length > 0) {
    throw new InvalidConfirmationLineError(
      `Righe già in stato terminale: ${alreadyTerminal.map((l) => l.id).join(', ')}`,
    )
  }

  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const itemChanges: Array<{
      itemId: string
      before: LineDeliveryStatus
      after: LineDeliveryStatus
    }> = []

    for (const line of matchedLines) {
      await tx.orderConfirmationLine.update({
        where: { id: line.id },
        data: {
          rejected: true,
          rejected_at: now,
          rejected_by: params.userId,
          rejected_reason: params.reason,
        },
      })

      if (!line.request_item_id) continue

      const currentItem = await tx.requestItem.findUnique({
        where: { id: line.request_item_id },
      })
      if (!currentItem) {
        // RequestItem rimosso dopo la creazione della confirmation: niente da
        // propagare ma la riga risulta rifiutata correttamente.
        continue
      }

      await tx.requestItem.update({
        where: { id: currentItem.id },
        data: { delivery_status: params.newRequestItemStatus },
      })

      itemChanges.push({
        itemId: currentItem.id,
        before: currentItem.delivery_status,
        after: params.newRequestItemStatus,
      })
    }

    // Proietta lo stato finale: le righe appena rifiutate sono terminali
    const projectedLines: ConfirmationLineTerminalState[] = existing.lines.map(
      (l) =>
        rejectedIdsSet.has(l.id)
          ? { id: l.id, applied: l.applied, rejected: true }
          : l,
    )
    const complete = isConfirmationComplete(projectedLines)
    const nextStatus: OrderConfirmationStatus = complete
      ? 'APPLIED'
      : 'PARTIALLY_APPLIED'

    const updated = await tx.orderConfirmation.update({
      where: { id: params.confirmationId },
      data: {
        status: nextStatus,
        applied_at: complete
          ? (existing.applied_at ?? now)
          : existing.applied_at,
        applied_by: complete
          ? (existing.applied_by ?? params.userId)
          : existing.applied_by,
      },
      include: { lines: true },
    })

    await tx.timelineEvent.create({
      data: {
        request_id: existing.request_id,
        type: 'order_confirmation_lines_rejected',
        title: `${matchedLines.length} righe conferma rifiutate`,
        description: params.reason,
        metadata: {
          confirmation_id: existing.id,
          rejected_line_ids: params.rejectedLineIds,
          new_request_item_status: params.newRequestItemStatus,
          final_status: nextStatus,
          item_status_changes: itemChanges,
        },
        actor: params.userId,
      },
    })

    return { updated, nextStatus }
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
        status: { old: existing.status, new: result.nextStatus },
      },
      metadata: {
        request_id: existing.request_id,
        request_code: existing.request.code,
        rejected_line_count: matchedLines.length,
        total_line_count: existing.lines.length,
        reason: params.reason,
        new_request_item_status: params.newRequestItemStatus,
      },
    })
  } catch (err) {
    console.warn(
      '[order-confirmation] Audit log failed (swallowed):',
      err instanceof Error ? err.message : String(err),
    )
  }

  return result.updated
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
