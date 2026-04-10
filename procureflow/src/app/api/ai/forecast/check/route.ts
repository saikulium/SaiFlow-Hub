import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import { checkReorderAlerts } from '@/server/services/forecast.service'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const rawBody = await req.text()
    const isAuthed = verifyWebhookAuth(
      rawBody,
      req.headers.get('x-webhook-signature'),
      req.headers.get('authorization'),
      process.env.WEBHOOK_SECRET,
    )

    if (!isAuthed) {
      return errorResponse('UNAUTHORIZED', 'Firma webhook non valida', 401)
    }

    const result = await checkReorderAlerts()
    return successResponse(result)
  } catch (error) {
    console.error('POST /api/ai/forecast/check error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
