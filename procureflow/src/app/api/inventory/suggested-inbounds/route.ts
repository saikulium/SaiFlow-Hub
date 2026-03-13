import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { getSuggestedInbounds } from '@/server/services/inventory-db.service'

export async function GET(_req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const suggestions = await getSuggestedInbounds()

    return successResponse(suggestions)
  } catch (error) {
    console.error('GET /api/inventory/suggested-inbounds error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nel recupero suggerimenti carico',
      500,
    )
  }
}
