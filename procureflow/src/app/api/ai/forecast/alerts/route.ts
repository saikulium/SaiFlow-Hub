import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getActiveAlerts } from '@/server/services/forecast.service'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const alerts = await getActiveAlerts()
  return successResponse(alerts)
}
