// ---------------------------------------------------------------------------
// /api/confirmations/[id]/reject
//   POST — rifiuta la conferma (MANAGER/ADMIN)
// ---------------------------------------------------------------------------

import { withApiHandler } from '@/lib/api-handler'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import {
  rejectConfirmation,
  rejectConfirmationSchema,
  OrderConfirmationNotFoundError,
  InvalidConfirmationStateError,
} from '@/modules/core/requests'
import { createNotification } from '@/modules/core/notifications'
import { prisma } from '@/lib/db'

export const POST = withApiHandler(
  {
    auth: ['ADMIN', 'MANAGER'],
    bodySchema: rejectConfirmationSchema,
    errorMessage: 'Errore nel rifiuto della conferma d\'ordine',
  },
  async ({ params, body, user }) => {
    const id = params.id
    if (!id) return notFoundResponse('Conferma non trovata')

    try {
      const updated = await rejectConfirmation({
        confirmationId: id,
        userId: user.id,
        reason: body.reason,
      })

      try {
        const request = await prisma.purchaseRequest.findUnique({
          where: { id: updated.request_id },
          select: { code: true, requester_id: true },
        })
        if (request) {
          await createNotification({
            userId: request.requester_id,
            title: `Conferma d'ordine rifiutata: ${request.code}`,
            body: `Motivo: ${body.reason}`,
            type: 'status_changed',
            link: `/requests/${updated.request_id}`,
          })
        }
      } catch (err) {
        console.warn(
          '[api/confirmations/reject] Notification failed (swallowed):',
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
      throw err
    }
  },
)
