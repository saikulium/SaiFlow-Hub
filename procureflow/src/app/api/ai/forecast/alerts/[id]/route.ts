import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import {
  dismissAlert,
  resolveAlert,
} from '@/server/services/forecast.service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const { id } = await params
  const body = await req.json()

  if (body.resolved_by) {
    await resolveAlert(id, body.resolved_by as string)
    return successResponse({ resolved: true })
  }

  await dismissAlert(id)
  return successResponse({ dismissed: true })
}
