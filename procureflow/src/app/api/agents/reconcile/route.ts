import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { reconcileInvoice } from '@/server/agents/invoice-reconciliation.agent'

// ---------------------------------------------------------------------------
// POST /api/agents/reconcile — Trigger invoice reconciliation agent
//
// Requires authenticated user.
// Reconciles a single invoice against its purchase order using AI,
// comparing line items, amounts, and price history.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  invoice_id: z.string().min(1, 'invoice_id is required'),
})

export async function POST(request: Request) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(
      'INVALID_JSON',
      'Corpo della richiesta non valido',
      400,
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.flatten())
  }

  try {
    const result = await reconcileInvoice(parsed.data.invoice_id, authResult.id)

    return successResponse(result)
  } catch (err) {
    console.error('[api/agents/reconcile] Error:', err)
    return errorResponse(
      'RECONCILIATION_AGENT_ERROR',
      "Errore nell'esecuzione dell'agente di riconciliazione",
      500,
    )
  }
}
