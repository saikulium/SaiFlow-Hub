// ---------------------------------------------------------------------------
// /api/confirmations/[id]/reject-lines
//   POST — rifiuta in modo granulare un sottoinsieme di righe della conferma
//   (MANAGER/ADMIN). Le righe non incluse in `rejected_line_ids` restano
//   pendenti: la conferma passa a `PARTIALLY_APPLIED` se alcune righe sono
//   ancora aperte, a `APPLIED` se tutte le righe sono in stato terminale.
// ---------------------------------------------------------------------------

import { withApiHandler } from '@/lib/api-handler'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import {
  rejectLines,
  rejectLinesSchema,
  OrderConfirmationNotFoundError,
  InvalidConfirmationStateError,
  InvalidConfirmationLineError,
} from '@/modules/core/requests'
import { createNotification } from '@/modules/core/notifications'
import { prisma } from '@/lib/db'

export const POST = withApiHandler(
  {
    auth: ['ADMIN', 'MANAGER'],
    bodySchema: rejectLinesSchema,
    errorMessage: 'Errore nel rifiuto delle righe della conferma',
  },
  async ({ params, body, user }) => {
    const id = params.id
    if (!id) return notFoundResponse('Conferma non trovata')

    try {
      const updated = await rejectLines({
        confirmationId: id,
        userId: user.id,
        rejectedLineIds: body.rejected_line_ids,
        reason: body.reason,
        newRequestItemStatus: body.new_request_item_status,
      })

      // Notifica il richiedente (fail-soft)
      try {
        const request = await prisma.purchaseRequest.findUnique({
          where: { id: updated.request_id },
          select: { code: true, requester_id: true },
        })
        if (request) {
          await createNotification({
            userId: request.requester_id,
            title: `Righe rifiutate sulla conferma: ${request.code}`,
            body: `${body.rejected_line_ids.length} righe rifiutate (${body.new_request_item_status.toLowerCase()}). Motivo: ${body.reason}`,
            type: 'status_changed',
            link: `/requests/${updated.request_id}`,
          })
        }
      } catch (err) {
        console.warn(
          '[api/confirmations/reject-lines] Notification failed (swallowed):',
          err instanceof Error ? err.message : String(err),
        )
      }

      return successResponse(updated)
    } catch (err) {
      if (err instanceof OrderConfirmationNotFoundError) {
        return notFoundResponse('Conferma non trovata')
      }
      if (err instanceof InvalidConfirmationStateError) {
        return errorResponse(err.code, err.message, 409)
      }
      if (err instanceof InvalidConfirmationLineError) {
        return errorResponse(err.code, err.message, 400)
      }
      throw err
    }
  },
)
