import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
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

    return successResponse(result)
  } catch (err) {
    console.error('[api/agents/compliance] Error:', err)
    return errorResponse(
      'COMPLIANCE_AGENT_ERROR',
      "Errore nell'esecuzione dell'agente di compliance",
      500,
    )
  }
}
