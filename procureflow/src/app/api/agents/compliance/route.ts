import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { runComplianceCheck } from '@/server/agents/compliance-monitor.agent'

// ---------------------------------------------------------------------------
// POST /api/agents/compliance — Trigger compliance monitor agent
//
// Requires ADMIN role.
// Scans for overdue orders, budget overruns, unreconciled invoices,
// and stale approvals. Creates notifications for responsible users.
// ---------------------------------------------------------------------------

export async function POST() {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  try {
    const result = await runComplianceCheck(authResult.id)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error('[api/agents/compliance] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'COMPLIANCE_AGENT_ERROR',
          message: "Errore nell'esecuzione dell'agente di compliance",
        },
      },
      { status: 500 },
    )
  }
}
