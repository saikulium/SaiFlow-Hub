// ---------------------------------------------------------------------------
// /api/requests/[id]/confirmations
//   GET  — lista conferme d'ordine della PR
//   POST — crea una nuova conferma d'ordine (MANAGER/ADMIN)
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
  createOrderConfirmation,
  listOrderConfirmations,
  orderConfirmationLineSchema,
  orderConfirmationSourceSchema,
  InvalidConfirmationLineError,
} from '@/modules/core/requests'

// Omette `request_id` dal body: viene preso dall'URL param `[id]`.
const createBodySchema = z.object({
  source: orderConfirmationSourceSchema.default('MANUAL'),
  email_log_id: z.string().optional(),
  vendor_reference: z.string().max(200).optional(),
  subject: z.string().max(500).optional(),
  received_at: z.union([z.string().datetime(), z.date()]).optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lines: z.array(orderConfirmationLineSchema).min(1, 'Almeno una riga'),
})

export const GET = withApiHandler(
  {
    auth: true,
    errorMessage: "Errore nel recupero delle conferme d'ordine",
  },
  async ({ params }) => {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!request) return notFoundResponse('Richiesta non trovata')

    const confirmations = await listOrderConfirmations(params.id!)
    return successResponse(confirmations)
  },
)

export const POST = withApiHandler(
  {
    auth: ['ADMIN', 'MANAGER'],
    bodySchema: createBodySchema,
    errorMessage: "Errore nella creazione della conferma d'ordine",
  },
  async ({ params, body }) => {
    const requestId = params.id
    if (!requestId) return notFoundResponse('Richiesta non trovata')

    const request = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    })
    if (!request) return notFoundResponse('Richiesta non trovata')

    try {
      const confirmation = await createOrderConfirmation({
        request_id: requestId,
        source: body.source,
        email_log_id: body.email_log_id,
        vendor_reference: body.vendor_reference,
        subject: body.subject,
        received_at:
          body.received_at instanceof Date
            ? body.received_at
            : body.received_at
              ? new Date(body.received_at)
              : undefined,
        notes: body.notes,
        metadata: body.metadata,
        lines: body.lines,
      })
      return successResponse(confirmation)
    } catch (err) {
      if (err instanceof InvalidConfirmationLineError) {
        return errorResponse(err.code, err.message, 400)
      }
      throw err
    }
  },
)
