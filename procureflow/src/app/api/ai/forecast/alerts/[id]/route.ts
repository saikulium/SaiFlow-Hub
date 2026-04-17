import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { dismissAlert, resolveAlert } from '@/server/services/forecast.service'

const patchAlertSchema = z.object({
  resolved_by: z.string().min(1).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const body = await req.json()

    const parsed = patchAlertSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    if (parsed.data.resolved_by) {
      await resolveAlert(id, parsed.data.resolved_by)
      return successResponse({ resolved: true })
    }

    await dismissAlert(id)
    return successResponse({ dismissed: true })
  } catch (error) {
    console.error('PATCH /api/ai/forecast/alerts/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
