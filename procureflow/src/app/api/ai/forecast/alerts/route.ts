import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getActiveAlerts } from '@/server/services/forecast.service'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

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
}
