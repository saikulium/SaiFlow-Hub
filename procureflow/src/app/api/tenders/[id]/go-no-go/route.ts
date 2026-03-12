import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { goNoGoSchema } from '@/lib/validations/tenders'
import { computeGoNoGoScore } from '@/server/services/tenders.service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/tenders')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = goNoGoSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const tender = await prisma.tender.findUnique({ where: { id } })
    if (!tender) return notFoundResponse('Gara non trovata')

    if (tender.status !== 'EVALUATING') {
      return errorResponse(
        'INVALID_STATUS',
        'La decisione Go/No-Go richiede lo stato EVALUATING',
        400,
      )
    }

    const { totalScore, recommendation } = computeGoNoGoScore(parsed.data.scores)

    await prisma.$transaction([
      prisma.tender.update({
        where: { id },
        data: {
          go_no_go: parsed.data.decision as never,
          go_no_go_score: totalScore,
          go_no_go_notes: parsed.data.notes ?? null,
          go_no_go_decided_by: authResult.name,
          go_no_go_decided_at: new Date(),
          status: parsed.data.decision as never,
        },
      }),
      prisma.tenderTimeline.create({
        data: {
          tender_id: id,
          type: 'go_no_go',
          title: `Decisione Go/No-Go: ${parsed.data.decision}`,
          metadata: {
            scores: parsed.data.scores,
            totalScore,
            recommendation,
          },
          actor: authResult.name,
        },
      }),
    ])

    return successResponse({
      id,
      decision: parsed.data.decision,
      totalScore,
      recommendation,
    })
  } catch (error) {
    console.error('POST /api/tenders/[id]/go-no-go error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nella registrazione Go/No-Go',
      500,
    )
  }
}
