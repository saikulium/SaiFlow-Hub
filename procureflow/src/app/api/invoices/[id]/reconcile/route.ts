import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { canTransition } from '@/lib/state-machine'
import { getCurrentUser } from '@/lib/auth'
import {
  createNotification,
  NOTIFICATION_TYPES,
} from '@/server/services/notification.service'
import type { RequestStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/reconcile — Riconciliazione manuale
//
// Body: { action: 'approve' | 'dispute' | 'reject', notes?: string }
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const { action, notes } = body as {
      action: 'approve' | 'dispute' | 'reject'
      notes?: string
    }

    if (!['approve', 'dispute', 'reject'].includes(action)) {
      return errorResponse(
        'INVALID_ACTION',
        'Azione deve essere: approve, dispute, reject',
        400,
      )
    }

    const currentUser = await getCurrentUser()

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        invoice_number: true,
        supplier_name: true,
        total_amount: true,
        purchase_request_id: true,
        purchase_request: {
          select: { id: true, code: true, status: true, requester_id: true },
        },
      },
    })

    if (!invoice) return notFoundResponse('Fattura non trovata')

    if (action === 'approve') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          reconciliation_status: 'APPROVED',
          reconciliation_notes: notes ?? null,
          reconciled_at: new Date(),
          reconciled_by: currentUser.id,
          discrepancy_resolved: true,
        },
      })

      // Transizione ordine → RECONCILED
      if (invoice.purchase_request) {
        const prStatus = invoice.purchase_request.status as RequestStatus
        if (canTransition(prStatus, 'RECONCILED')) {
          await prisma.purchaseRequest.update({
            where: { id: invoice.purchase_request.id },
            data: { status: 'RECONCILED' },
          })
        }

        await createNotification({
          userId: invoice.purchase_request.requester_id,
          title: `Fattura riconciliata: ${invoice.purchase_request.code}`,
          body: `Fattura ${invoice.invoice_number} da ${invoice.supplier_name} approvata per pagamento.`,
          type: NOTIFICATION_TYPES.INVOICE_RECONCILED,
          link: `/invoices/${invoice.id}`,
        })
      }

      await prisma.timelineEvent.create({
        data: {
          request_id: invoice.purchase_request_id,
          invoice_id: invoice.id,
          type: 'reconciliation_approved',
          title: 'Riconciliazione approvata',
          description: notes
            ? `Approvata da ${currentUser.name}. Note: ${notes}`
            : `Approvata da ${currentUser.name}`,
          actor: currentUser.name,
        },
      })
    } else if (action === 'dispute') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          reconciliation_status: 'DISPUTED',
          reconciliation_notes: notes ?? null,
        },
      })

      await prisma.timelineEvent.create({
        data: {
          request_id: invoice.purchase_request_id,
          invoice_id: invoice.id,
          type: 'reconciliation_disputed',
          title: 'Fattura contestata',
          description: notes
            ? `Contestata da ${currentUser.name}. Motivo: ${notes}`
            : `Contestata da ${currentUser.name}`,
          actor: currentUser.name,
        },
      })

      if (invoice.purchase_request) {
        await createNotification({
          userId: invoice.purchase_request.requester_id,
          title: `Fattura contestata: ${invoice.purchase_request.code}`,
          body: `Fattura ${invoice.invoice_number} contestata. ${notes ?? ''}`,
          type: NOTIFICATION_TYPES.INVOICE_DISCREPANCY,
          link: `/invoices/${invoice.id}`,
        })
      }
    } else {
      // reject
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          reconciliation_status: 'REJECTED',
          reconciliation_notes: notes ?? null,
        },
      })

      await prisma.timelineEvent.create({
        data: {
          request_id: invoice.purchase_request_id,
          invoice_id: invoice.id,
          type: 'reconciliation_rejected',
          title: 'Fattura rifiutata',
          description: notes
            ? `Rifiutata da ${currentUser.name}. Motivo: ${notes}`
            : `Rifiutata da ${currentUser.name}`,
          actor: currentUser.name,
        },
      })
    }

    return successResponse({
      invoice_id: invoice.id,
      action,
      reconciliation_status:
        action === 'approve'
          ? 'APPROVED'
          : action === 'dispute'
            ? 'DISPUTED'
            : 'REJECTED',
    })
  } catch (error) {
    console.error('POST /api/invoices/[id]/reconcile error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
