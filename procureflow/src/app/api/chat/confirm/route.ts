import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getPendingAction, removePendingAction } from '@/lib/ai/pending-actions'
import { executeWriteTool } from '@/server/services/agent.service'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const body = await req.json()
  const { actionId, cancelled } = body as {
    actionId: string
    cancelled?: boolean
  }

  if (!actionId) {
    return errorResponse('VALIDATION_ERROR', 'actionId richiesto', 400)
  }

  const action = getPendingAction(actionId, session.user.id)
  if (!action) {
    return errorResponse('NOT_FOUND', 'Azione non trovata o scaduta', 404)
  }

  removePendingAction(actionId)

  if (cancelled) {
    return successResponse({ status: 'cancelled' })
  }

  try {
    const result = await executeWriteTool(
      action.tool,
      action.params,
      session.user.id,
    )
    return successResponse({ status: 'confirmed', result })
  } catch (error) {
    console.error('POST /api/chat/confirm error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      "Errore nell'esecuzione dell'azione",
      500,
    )
  }
}
