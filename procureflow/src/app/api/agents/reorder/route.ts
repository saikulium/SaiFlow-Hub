import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { runReorderAgent } from '@/server/agents/smart-reorder.agent'

// ---------------------------------------------------------------------------
// POST /api/agents/reorder — Trigger smart reorder agent
//
// Requires ADMIN or MANAGER role.
// Scans active material alerts, evaluates forecasts & budgets,
// and creates DRAFT purchase requests for materials needing reorder.
// ---------------------------------------------------------------------------

export async function POST() {
  const authResult = await requireRole('ADMIN', 'MANAGER')
  if (authResult instanceof NextResponse) return authResult

  try {
    const result = await runReorderAgent(authResult.id)

    return successResponse(result)
  } catch (err) {
    console.error('[api/agents/reorder] Error:', err)
    return errorResponse(
      'REORDER_AGENT_ERROR',
      "Errore nell'esecuzione dell'agente di riordino",
      500,
    )
  }
}
