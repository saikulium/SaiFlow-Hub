import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { analyzeTender } from '@/server/agents/tender-analysis.agent'

// ---------------------------------------------------------------------------
// POST /api/agents/tender-analysis — Trigger tender analysis agent
//
// Requires authenticated user.
// Analyzes a tender using Opus with adaptive thinking and returns a
// structured go/no-go recommendation.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  tender_id: z.string().min(1, 'tender_id is required'),
})

export async function POST(request: Request) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Corpo della richiesta non valido',
        },
      },
      { status: 400 },
    )
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Dati non validi',
        },
      },
      { status: 400 },
    )
  }

  try {
    const result = await analyzeTender(parsed.data.tender_id)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isNotFound = message.includes('non trovata')

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isNotFound ? 'TENDER_NOT_FOUND' : 'TENDER_ANALYSIS_ERROR',
          message: isNotFound
            ? message
            : `Errore nell'analisi della gara: ${message}`,
        },
      },
      { status: isNotFound ? 404 : 500 },
    )
  }
}
