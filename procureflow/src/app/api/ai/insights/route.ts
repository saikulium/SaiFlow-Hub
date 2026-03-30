import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import { generateInsights, getActiveInsights } from '@/server/services/insight.service'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const insights = await getActiveInsights()
  return successResponse(insights)
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const isAuthed = verifyWebhookAuth(
      rawBody,
      req.headers.get('x-webhook-signature'),
      req.headers.get('authorization'),
      process.env.WEBHOOK_SECRET,
      req.headers.get('x-webhook-timestamp'),
    )

    if (!isAuthed) {
      return errorResponse('UNAUTHORIZED', 'Firma webhook non valida', 401)
    }

    const result = await generateInsights()
    return successResponse(result)
  } catch (error) {
    console.error('POST /api/ai/insights error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
