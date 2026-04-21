import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { getInventoryDashboardStats } from '@/modules/core/inventory'

export async function GET(_req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const stats = await getInventoryDashboardStats()

    return successResponse(stats)
  } catch (error) {
    console.error('GET /api/inventory/stats error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nel recupero statistiche inventario',
      500,
    )
  }
}
