import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import { initiateApprovalWorkflow } from '@/server/services/approval.service'

// ---------------------------------------------------------------------------
// POST /api/requests/[id]/submit
//
// Sottomette una richiesta in DRAFT per approvazione.
// Regole:
//   - MANAGER/ADMIN → auto-approvazione (hanno l'autorità)
//   - REQUESTER/VIEWER → serve approvazione MANAGER
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        estimated_amount: true,
        requester_id: true,
        requester: { select: { role: true } },
      },
    })

    if (!request) {
      return notFoundResponse('Richiesta non trovata')
    }

    if (request.status !== 'DRAFT') {
      return errorResponse(
        'INVALID_STATE',
        `Solo le richieste in Bozza possono essere inviate. Stato attuale: ${request.status}`,
        400,
      )
    }

    const amount = request.estimated_amount
      ? Number(request.estimated_amount)
      : 0

    const approval = await initiateApprovalWorkflow(
      request.id,
      amount,
      request.requester.role,
    )

    // Recupera lo stato aggiornato
    const updated = await prisma.purchaseRequest.findUnique({
      where: { id: request.id },
      select: { status: true },
    })

    return successResponse({
      request_id: request.id,
      request_code: request.code,
      new_status: updated?.status ?? 'PENDING_APPROVAL',
      auto_approved: updated?.status === 'APPROVED',
      approval_id: approval.id,
    })
  } catch (error) {
    console.error('POST /api/requests/[id]/submit error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nella sottomissione', 500)
  }
}
