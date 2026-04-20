import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { withApiHandler } from '@/lib/api-handler'
import { canTransition } from '@/lib/state-machine'
import {
  createNotification,
  NOTIFICATION_TYPES,
} from '@/modules/core/notifications'
import type { RequestStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/reconcile — Riconciliazione manuale
//
// Body: { action: 'approve' | 'dispute' | 'reject', notes?: string }
// Solo MANAGER e ADMIN possono riconciliare fatture.
// ---------------------------------------------------------------------------

const reconcileSchema = z.object({
  action: z.enum(['approve', 'dispute', 'reject'] as const, {
    message: 'Azione deve essere: approve, dispute, reject',
  }),
  notes: z.string().optional(),
})

export const POST = withApiHandler(
  {
    auth: ['ADMIN', 'MANAGER'],
    bodySchema: reconcileSchema,
    errorMessage: 'Errore nella riconciliazione fattura',
  },
  async ({ params, body, user }) => {
    const { action, notes } = body

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
          reconciled_by: user.id,
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
            ? `Approvata da ${user.name}. Note: ${notes}`
            : `Approvata da ${user.name}`,
          actor: user.name,
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
            ? `Contestata da ${user.name}. Motivo: ${notes}`
            : `Contestata da ${user.name}`,
          actor: user.name,
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
            ? `Rifiutata da ${user.name}. Motivo: ${notes}`
            : `Rifiutata da ${user.name}`,
          actor: user.name,
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
  },
)
