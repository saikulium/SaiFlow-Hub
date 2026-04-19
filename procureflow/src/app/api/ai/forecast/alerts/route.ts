import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getActiveAlerts } from '@/modules/core/inventory'

export async function GET() {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const raw = await getActiveAlerts()
    const alerts = raw.map((a) => ({
      id: a.id,
      materialId: a.material_id,
      materialName: a.material.name,
      materialCode: a.material.code,
      type: a.type,
      suggestedQty: a.suggested_qty,
      suggestedVendorId: a.suggested_vendor_id,
      suggestedVendorName: a.suggested_vendor?.name ?? null,
      daysRemaining: a.days_remaining,
      dismissed: a.dismissed,
      createdAt: a.created_at.toISOString(),
    }))
    return successResponse(alerts)
  } catch (error) {
    console.error('GET /api/ai/forecast/alerts error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
