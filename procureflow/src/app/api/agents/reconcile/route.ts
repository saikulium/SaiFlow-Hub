import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
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
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Corpo della richiesta non valido',
        },
      },
      { status: 400 },
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Dati non validi',
        },
      },
      { status: 400 },
    )
  }

  try {
    const result = await reconcileInvoice(parsed.data.invoice_id, authResult.id)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error('[api/agents/reconcile] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RECONCILIATION_AGENT_ERROR',
          message: "Errore nell'esecuzione dell'agente di riconciliazione",
        },
      },
      { status: 500 },
    )
  }
}
