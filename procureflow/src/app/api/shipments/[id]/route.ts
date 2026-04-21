// ---------------------------------------------------------------------------
// /api/shipments/[id]
//   PATCH — aggiorna lo stato di una spedizione (MANAGER/ADMIN).
//           Ricalcola `RequestItem.delivery_status` in transazione.
// ---------------------------------------------------------------------------

import { withApiHandler } from '@/lib/api-handler'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import {
  updateShipmentStatus,
  updateShipmentStatusSchema,
  ShipmentNotFoundError,
} from '@/modules/core/requests'

export const PATCH = withApiHandler(
  {
    auth: ['ADMIN', 'MANAGER'],
    bodySchema: updateShipmentStatusSchema,
    errorMessage: "Errore nell'aggiornamento della spedizione",
  },
  async ({ params, body, user }) => {
    const id = params.id
    if (!id) return notFoundResponse('Spedizione non trovata')

    try {
      const updated = await updateShipmentStatus({
        shipmentId: id,
        status: body.status,
        actual_ship_date: body.actual_ship_date ?? null,
        actual_delivery_date: body.actual_delivery_date ?? null,
        notes: body.notes ?? null,
        userId: user.id,
      })
      return successResponse(updated)
    } catch (err) {
      if (err instanceof ShipmentNotFoundError) {
        return notFoundResponse('Spedizione non trovata')
      }
      throw err
    }
  },
)
