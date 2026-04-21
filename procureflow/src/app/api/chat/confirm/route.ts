import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import {
  getPendingAction,
  removePendingAction,
  executeWriteTool,
} from '@/modules/core/chatbot'

const confirmSchema = z.object({
  actionId: z.string().min(1, 'actionId richiesto'),
  cancelled: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { actionId, cancelled } = parsed.data

    const action = getPendingAction(actionId, authResult.id)
    if (!action) {
      return errorResponse('NOT_FOUND', 'Azione non trovata o scaduta', 404)
    }

    removePendingAction(actionId)

    if (cancelled) {
      return successResponse({ status: 'cancelled' })
    }

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
