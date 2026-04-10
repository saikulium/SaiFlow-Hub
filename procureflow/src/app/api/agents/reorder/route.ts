import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
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

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error('[api/agents/reorder] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REORDER_AGENT_ERROR',
          message: "Errore nell'esecuzione dell'agente di riordino",
        },
      },
      { status: 500 },
    )
  }
}
