// ---------------------------------------------------------------------------
// /api/requests/[id]/shipments
//   GET  — lista tutte le spedizioni della PR (aggregate per item)
//   POST — crea una nuova spedizione per uno dei RequestItem della PR
//          (MANAGER/ADMIN). Body include `request_item_id`.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { withApiHandler } from '@/lib/api-handler'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import {
  createShipment,
  createShipmentSchema,
  listShipmentsForPurchaseRequest,
  RequestItemNotFoundError,
  ShipmentQuantityExceededError,
} from '@/modules/core/requests'

const createBodySchema = createShipmentSchema.extend({
  request_item_id: z.string().min(1, 'request_item_id obbligatorio'),
})

export const GET = withApiHandler(
  {
    auth: true,
    errorMessage: 'Errore nel recupero delle spedizioni',
  },
  async ({ params }) => {
    const requestId = params.id
    if (!requestId) return notFoundResponse('Richiesta non trovata')

    const request = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    })
    if (!request) return notFoundResponse('Richiesta non trovata')

    const shipments = await listShipmentsForPurchaseRequest(requestId)
    return successResponse(shipments)
  },
)

export const POST = withApiHandler(
  {
    auth: ['ADMIN', 'MANAGER'],
    bodySchema: createBodySchema,
    errorMessage: 'Errore nella creazione della spedizione',
  },
  async ({ params, body, user }) => {
    const requestId = params.id
    if (!requestId) return notFoundResponse('Richiesta non trovata')

    // Verifica che il RequestItem appartenga alla PR indicata nell'URL
    const item = await prisma.requestItem.findUnique({
      where: { id: body.request_item_id },
      select: { id: true, request_id: true },
    })
    if (!item) return notFoundResponse('Articolo non trovato')
    if (item.request_id !== requestId) {
      return errorResponse(
        'ITEM_NOT_IN_REQUEST',
        "L'articolo non appartiene a questa richiesta",
        400,
      )
    }

    try {
      const shipment = await createShipment({
        request_item_id: body.request_item_id,
        shipped_quantity: body.shipped_quantity,
        expected_ship_date: body.expected_ship_date ?? null,
        actual_ship_date: body.actual_ship_date ?? null,
        expected_delivery_date: body.expected_delivery_date ?? null,
        actual_delivery_date: body.actual_delivery_date ?? null,
        tracking_number: body.tracking_number ?? null,
        carrier: body.carrier ?? null,
        tracking_url: body.tracking_url ?? null,
        status: body.status,
        source: body.source,
        source_email_log_id: body.source_email_log_id ?? null,
        notes: body.notes ?? null,
        userId: user.id,
      })
      return successResponse(shipment)
    } catch (err) {
      if (err instanceof RequestItemNotFoundError) {
        return notFoundResponse('Articolo non trovato')
      }
      if (err instanceof ShipmentQuantityExceededError) {
        return errorResponse(err.code, err.message, 400)
      }
      throw err
    }
  },
)
