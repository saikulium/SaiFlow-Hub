import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { dismissAlert, resolveAlert } from '@/server/services/forecast.service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  const body = await req.json()

  if (body.resolved_by) {
    await resolveAlert(id, body.resolved_by as string)
    return successResponse({ resolved: true })
  }

  await dismissAlert(id)
  return successResponse({ dismissed: true })
}
