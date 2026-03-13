import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import { initiateApprovalWorkflow } from '@/server/services/approval.service'
import {
  checkBudgetCapacity,
  sendBudgetAlerts,
  refreshSnapshotsForCostCenter,
} from '@/server/services/budget.service'

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
        cost_center: true,
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

    // Budget capacity check (opt-in: solo se il centro di costo è definito)
    let budgetWarning: string | null = null

    if (request.cost_center) {
      const budgetCheck = await checkBudgetCapacity(request.cost_center, amount)

      if (!budgetCheck.allowed && budgetCheck.mode === 'HARD') {
        return errorResponse('BUDGET_EXCEEDED', budgetCheck.message, 422)
      }

      if (
        budgetCheck.worstCase?.isWarning ||
        budgetCheck.worstCase?.isOverBudget
      ) {
        budgetWarning = budgetCheck.message

        await prisma.timelineEvent.create({
          data: {
            request_id: request.id,
            type: 'budget_warning',
            title: 'Avviso budget',
            description: budgetCheck.message,
            actor: 'Sistema',
            metadata: {
              budgetId: budgetCheck.worstCase.budgetId,
              usagePercent: budgetCheck.worstCase.usagePercent,
              available: budgetCheck.worstCase.available,
            },
          },
        })

        await sendBudgetAlerts(budgetCheck.worstCase)
      }
    }

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

    // Aggiorna snapshot budget (non-bloccante)
    if (request.cost_center) {
      refreshSnapshotsForCostCenter(request.cost_center).catch((err) =>
        console.error('[budget] Errore refresh snapshot:', err),
      )
    }

    return successResponse({
      request_id: request.id,
      request_code: request.code,
      new_status: updated?.status ?? 'PENDING_APPROVAL',
      auto_approved: updated?.status === 'APPROVED',
      approval_id: approval.id,
      budget_warning: budgetWarning,
    })
  } catch (error) {
    console.error('POST /api/requests/[id]/submit error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nella sottomissione', 500)
  }
}
