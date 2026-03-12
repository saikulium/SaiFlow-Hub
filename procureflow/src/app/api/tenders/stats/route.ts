import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { getTenderDashboardStats } from '@/server/services/tenders.service'

export async function GET() {
  const blocked = await requireModule('/api/tenders')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const stats = await getTenderDashboardStats()

    return successResponse(stats)
  } catch (error) {
    console.error('GET /api/tenders/stats error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nel recupero statistiche gare',
      500,
    )
  }
}
