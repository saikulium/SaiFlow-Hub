import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { canTransition } from '@/lib/state-machine'
import type { RequestStatus } from '@prisma/client'
import { requireModule } from '@/lib/modules/require-module'
import { requireAuth } from '@/lib/auth'

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/unmatch — Scollega fattura da ordine
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const blocked = await requireModule('/api/invoices')
    if (blocked) return blocked

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        invoice_number: true,
        purchase_request_id: true,
        supplier_name: true,
      },
    })

    if (!invoice) return notFoundResponse('Fattura non trovata')

    if (!invoice.purchase_request_id) {
      return errorResponse(
        'NOT_MATCHED',
        'Fattura non è associata a nessun ordine',
        400,
      )
    }

    const requestId = invoice.purchase_request_id

    // Rollback stato ordine: INVOICED → DELIVERED (se possibile)
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      select: { id: true, code: true, status: true },
    })

    if (request) {
      const currentStatus = request.status as RequestStatus
      if (
        currentStatus === 'INVOICED' &&
        canTransition(
          'INVOICED' as RequestStatus,
          'DELIVERED' as RequestStatus,
        ) === false
      ) {
        // INVOICED non torna a DELIVERED nella state machine attuale, skip
        console.warn(
          `[unmatch] Impossibile rollback ${currentStatus} → DELIVERED per ${request.code}`,
        )
      }

      // Reset invoiced_amount
      await prisma.purchaseRequest.update({
        where: { id: requestId },
        data: { invoiced_amount: null },
      })
    }

    // Reset fattura
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        purchase_request_id: null,
        match_status: 'UNMATCHED',
        match_confidence: null,
        match_candidates: Prisma.DbNull,
        matched_at: null,
        matched_by: null,
        reconciliation_status: 'PENDING',
        reconciled_at: null,
        reconciled_by: null,
        amount_discrepancy: null,
        discrepancy_type: null,
        discrepancy_resolved: false,
      },
    })

    // Timeline
    await prisma.timelineEvent.create({
      data: {
        request_id: requestId,
        invoice_id: invoice.id,
        type: 'invoice_unmatched',
        title: `Fattura ${invoice.invoice_number} scollegata`,
        description: `Associazione con fattura da ${invoice.supplier_name} rimossa manualmente`,
        actor: 'operatore',
      },
    })

    return successResponse({ unmatched: true, invoice_id: invoice.id })
  } catch (error) {
    console.error('POST /api/invoices/[id]/unmatch error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
