import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { performThreeWayMatch } from '@/server/services/three-way-matching.service'
import { canTransition } from '@/lib/state-machine'
import type { RequestStatus } from '@prisma/client'
import { requireModule } from '@/lib/modules/require-module'

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/match — Associazione manuale fattura ↔ ordine
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/invoices')
  if (blocked) return blocked
  try {
    const body = await req.json()
    const { purchase_request_id } = body as { purchase_request_id: string }

    if (!purchase_request_id) {
      return errorResponse(
        'MISSING_FIELD',
        'purchase_request_id è obbligatorio',
        400,
      )
    }

    const [invoice, request] = await Promise.all([
      prisma.invoice.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          invoice_number: true,
          total_amount: true,
          supplier_name: true,
        },
      }),
      prisma.purchaseRequest.findUnique({
        where: { id: purchase_request_id },
        select: { id: true, code: true, status: true },
      }),
    ])

    if (!invoice) return notFoundResponse('Fattura non trovata')
    if (!request) return notFoundResponse('Ordine non trovato')

    // Collega fattura → ordine
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        purchase_request_id: request.id,
        match_status: 'MANUALLY_MATCHED',
        match_confidence: 1.0,
        matched_at: new Date(),
        matched_by: 'operatore',
        reconciliation_status: 'MATCHED',
      },
    })

    // Aggiorna stato ordine → INVOICED (soft)
    const currentStatus = request.status as RequestStatus
    if (canTransition(currentStatus, 'INVOICED')) {
      await prisma.purchaseRequest.update({
        where: { id: request.id },
        data: {
          status: 'INVOICED',
          invoiced_amount: invoice.total_amount,
        },
      })
    } else {
      await prisma.purchaseRequest.update({
        where: { id: request.id },
        data: {
          invoiced_amount: invoice.total_amount,
        },
      })
    }

    // Timeline su entrambi
    await prisma.timelineEvent.createMany({
      data: [
        {
          request_id: request.id,
          invoice_id: invoice.id,
          type: 'invoice_matched',
          title: `Fattura ${invoice.invoice_number} associata manualmente`,
          description: `Operatore ha associato la fattura da ${invoice.supplier_name} (€${Number(invoice.total_amount).toFixed(2)})`,
          actor: 'operatore',
        },
        {
          invoice_id: invoice.id,
          type: 'invoice_matched',
          title: `Associata a ordine ${request.code}`,
          description: 'Match manuale confermato',
          actor: 'operatore',
        },
      ],
    })

    // Three-way matching
    const reconciliation = await performThreeWayMatch(invoice.id, request.id)

    return successResponse({
      invoice_id: invoice.id,
      request_id: request.id,
      request_code: request.code,
      match_status: 'MANUALLY_MATCHED',
      reconciliation: {
        status: reconciliation.status,
        auto_approved: reconciliation.auto_approve,
        discrepancy_percent: reconciliation.discrepancy_percentage,
        discrepancies: reconciliation.discrepancies,
      },
    })
  } catch (error) {
    console.error('POST /api/invoices/[id]/match error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
