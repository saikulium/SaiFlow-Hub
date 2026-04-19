import { NextResponse } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { getCommessaDashboardStats } from '@/modules/core/commesse'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/commesse')
  if (blocked) return blocked

  try {
    const stats = await getCommessaDashboardStats()

    return successResponse(stats)
  } catch (error) {
    console.error('GET /api/commesse/stats error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nel recupero statistiche commesse',
      500,
    )
  }
}
