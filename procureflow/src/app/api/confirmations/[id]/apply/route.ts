// ---------------------------------------------------------------------------
// /api/confirmations/[id]/apply
//   POST — applica la conferma alle righe accettate (MANAGER/ADMIN)
// ---------------------------------------------------------------------------

import { withApiHandler } from '@/lib/api-handler'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import {
  applyConfirmation,
  applyConfirmationSchema,
  OrderConfirmationNotFoundError,
  InvalidConfirmationStateError,
  InvalidConfirmationLineError,
} from '@/modules/core/requests'
import { createNotification } from '@/modules/core/notifications'
import { prisma } from '@/lib/db'

export const POST = withApiHandler(
  {
    auth: ['ADMIN', 'MANAGER'],
    bodySchema: applyConfirmationSchema,
    errorMessage: 'Errore nell\'applicazione della conferma d\'ordine',
  },
  async ({ params, body, user }) => {
    const id = params.id
    if (!id) return notFoundResponse('Conferma non trovata')

    try {
      const updated = await applyConfirmation({
        confirmationId: id,
        userId: user.id,
        acceptedLineIds: body.accepted_line_ids,
        notes: body.notes ?? null,
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
            title: `Conferma d'ordine applicata: ${request.code}`,
            body: `${body.accepted_line_ids.length} righe applicate sulla richiesta ${request.code}.`,
            type: 'status_changed',
            link: `/requests/${updated.request_id}`,
          })
        }
      } catch (err) {
        console.warn(
          '[api/confirmations/apply] Notification failed (swallowed):',
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
