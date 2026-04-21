import { prisma } from '@/lib/db'
import type { DiscrepancyType, ReconciliationStatus } from '@prisma/client'
import { evaluateDiscrepancy } from '../constants/reconciliation-thresholds'
import { canTransition } from '@/lib/state-machine'
import type { RequestStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// Three-way matching: Ordinato vs Ricevuto vs Fatturato
//
// Confronta tre fonti:
//   1. Ordered  → PurchaseRequest.estimated_amount + RequestItems
//   2. Received → PurchaseRequest.actual_amount (o estimated se non compilato)
//   3. Invoiced → Invoice.total_amount + InvoiceLineItems
// ---------------------------------------------------------------------------

export interface Discrepancy {
  readonly type: DiscrepancyType
  readonly field: string
  readonly ordered: number | string
  readonly invoiced: number | string
  readonly severity: 'low' | 'medium' | 'high'
}

export interface ThreeWayMatchResult {
  readonly status: 'PASS' | 'WARNING' | 'FAIL'
  readonly ordered_amount: number
  readonly received_amount: number
  readonly invoiced_amount: number
  readonly amount_discrepancy: number
  readonly discrepancy_percentage: number
  readonly discrepancy_type: DiscrepancyType
  readonly discrepancies: readonly Discrepancy[]
  readonly auto_approve: boolean
}

/**
 * Esegue il three-way match tra una fattura e un ordine.
 * Aggiorna lo stato della fattura e dell'ordine se il match è pulito.
 */
export async function performThreeWayMatch(
  invoiceId: string,
  requestId: string,
): Promise<ThreeWayMatchResult> {
  const [invoice, request] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { line_items: true },
    }),
    prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: { items: true },
    }),
  ])

  if (!invoice || !request) {
    throw new Error('Fattura o ordine non trovato')
  }

  const orderedAmount = Number(request.estimated_amount ?? 0)
  const receivedAmount = Number(
    request.actual_amount ?? request.estimated_amount ?? 0,
  )
  const invoicedAmount = Number(invoice.total_amount)

  // Discrepanza importo totale
  const amountDiff = invoicedAmount - orderedAmount
  const discrepancyPercent =
    orderedAmount > 0 ? (Math.abs(amountDiff) / orderedAmount) * 100 : 0

  const evaluation = evaluateDiscrepancy(discrepancyPercent)

  const discrepancies: Discrepancy[] = []
  let discrepancyType: DiscrepancyType = 'NONE'

  // Confronto importo totale
  if (Math.abs(amountDiff) > 0.01) {
    discrepancyType = 'AMOUNT_MISMATCH'
    discrepancies.push({
      type: 'AMOUNT_MISMATCH',
      field: 'total_amount',
      ordered: orderedAmount,
      invoiced: invoicedAmount,
      severity:
        evaluation === 'FAIL'
          ? 'high'
          : evaluation === 'WARNING'
            ? 'medium'
            : 'low',
    })
  }

  // Confronto numero righe
  if (
    request.items.length > 0 &&
    invoice.line_items.length > 0 &&
    request.items.length !== invoice.line_items.length
  ) {
    discrepancies.push({
      type: 'ITEM_MISMATCH',
      field: 'line_count',
      ordered: request.items.length,
      invoiced: invoice.line_items.length,
      severity: 'medium',
    })
    if (discrepancyType === 'NONE') {
      discrepancyType = 'ITEM_MISMATCH'
    }
  }

  // Confronto per riga (se SKU presenti)
  for (const invoiceLine of invoice.line_items) {
    const matchedItem = request.items.find(
      (item) =>
        (item.sku && item.sku === invoiceLine.matched_item_id) ||
        item.name
          .toLowerCase()
          .includes(invoiceLine.description.toLowerCase().slice(0, 20)),
    )

    if (matchedItem) {
      const orderedQty = matchedItem.quantity
      const invoicedQty = Number(invoiceLine.quantity)
      if (orderedQty !== invoicedQty) {
        discrepancies.push({
          type: 'QUANTITY_MISMATCH',
          field: `line_${invoiceLine.line_number}_quantity`,
          ordered: orderedQty,
          invoiced: invoicedQty,
          severity: 'medium',
        })
        if (discrepancyType === 'NONE') discrepancyType = 'QUANTITY_MISMATCH'
      }

      const orderedPrice = Number(matchedItem.unit_price ?? 0)
      const invoicedPrice = Number(invoiceLine.unit_price)
      if (orderedPrice > 0 && Math.abs(orderedPrice - invoicedPrice) > 0.01) {
        discrepancies.push({
          type: 'PRICE_MISMATCH',
          field: `line_${invoiceLine.line_number}_unit_price`,
          ordered: orderedPrice,
          invoiced: invoicedPrice,
          severity: 'medium',
        })
        if (discrepancyType === 'NONE') discrepancyType = 'PRICE_MISMATCH'
      }
    }
  }

  const autoApprove = evaluation === 'PASS'

  // Aggiorna stato fattura
  const reconciliationStatus: ReconciliationStatus = autoApprove
    ? 'APPROVED'
    : evaluation === 'WARNING'
      ? 'MATCHED'
      : 'MATCHED'

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      reconciliation_status: reconciliationStatus,
      amount_discrepancy: amountDiff,
      discrepancy_type: discrepancyType,
      discrepancy_resolved: autoApprove && discrepancyType === 'NONE',
    },
  })

  // Se auto-approvato e transizione valida → RECONCILED
  if (autoApprove) {
    const currentStatus = request.status as RequestStatus
    if (canTransition(currentStatus, 'RECONCILED')) {
      await prisma.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: 'RECONCILED',
          invoiced_amount: invoice.total_amount,
        },
      })

      await prisma.timelineEvent.create({
        data: {
          request_id: requestId,
          invoice_id: invoiceId,
          type: 'reconciliation',
          title: 'Riconciliazione automatica',
          description: `Three-way match superato (discrepanza: ${discrepancyPercent.toFixed(1)}%). Fattura ${invoice.invoice_number} riconciliata automaticamente.`,
          actor: 'sistema',
          metadata: {
            ordered: orderedAmount,
            received: receivedAmount,
            invoiced: invoicedAmount,
            discrepancy_percent: discrepancyPercent,
          },
        },
      })
    }
  }

  return {
    status: evaluation,
    ordered_amount: orderedAmount,
    received_amount: receivedAmount,
    invoiced_amount: invoicedAmount,
    amount_discrepancy: amountDiff,
    discrepancy_percentage: discrepancyPercent,
    discrepancy_type: discrepancyType,
    discrepancies,
    auto_approve: autoApprove,
  }
}
