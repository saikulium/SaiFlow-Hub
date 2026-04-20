// ---------------------------------------------------------------------------
// /api/confirmations/[id]
//   GET — dettaglio di una conferma d'ordine con linee
// ---------------------------------------------------------------------------

import { withApiHandler } from '@/lib/api-handler'
import { successResponse, notFoundResponse } from '@/lib/api-response'
import { getOrderConfirmation } from '@/modules/core/requests'

export const GET = withApiHandler(
  {
    auth: true,
    errorMessage: 'Errore nel recupero della conferma d\'ordine',
  },
  async ({ params }) => {
    const id = params.id
    if (!id) return notFoundResponse('Conferma non trovata')

    const confirmation = await getOrderConfirmation(id)
    if (!confirmation) return notFoundResponse('Conferma non trovata')

    return successResponse(confirmation)
  },
)
