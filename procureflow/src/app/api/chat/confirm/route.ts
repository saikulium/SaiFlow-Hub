import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getPendingAction, removePendingAction } from '@/lib/ai/pending-actions'
import { executeWriteTool } from '@/server/agents/procurement-assistant.agent'

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const body = await req.json()
  const { actionId, cancelled } = body as {
    actionId: string
    cancelled?: boolean
  }

  if (!actionId) {
    return errorResponse('VALIDATION_ERROR', 'actionId richiesto', 400)
  }

  const action = getPendingAction(actionId, authResult.id)
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
      authResult.id,
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
