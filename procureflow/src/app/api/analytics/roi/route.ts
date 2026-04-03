import { requireModule } from '@/lib/modules/require-module'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getRoiMetrics } from '@/server/services/roi-metrics.service'
import type { RoiPeriod } from '@/types'

const VALID_PERIODS = new Set<string>(['30d', '90d', '6m', '12m', 'all'])

export async function GET(request: Request) {
  const blocked = await requireModule('/api/analytics')
  if (blocked) return blocked

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') ?? '90d'

    if (!VALID_PERIODS.has(period)) {
      return errorResponse('VALIDATION_ERROR', 'Periodo non valido', 400)
    }

    const metrics = await getRoiMetrics(period as RoiPeriod)
    return successResponse(metrics)
  } catch (error) {
    console.error('GET /api/analytics/roi error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel calcolo metriche ROI', 500)
  }
}
