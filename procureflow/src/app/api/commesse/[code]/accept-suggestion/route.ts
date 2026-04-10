import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { requireAuth } from '@/lib/auth'

const acceptSchema = z.object({
  suggestion_id: z.string().min(1, 'ID suggerimento obbligatorio'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/commesse')
  if (blocked) return blocked

  try {
    const body = await req.json()
    const parsed = acceptSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { suggestion_id } = parsed.data

    const commessa = await prisma.commessa.findUnique({
      where: { code: params.code },
      select: { id: true },
    })

    if (!commessa) return notFoundResponse('Commessa non trovata')

    // Optimistic concurrency: only update if still a suggestion
    const result = await prisma.purchaseRequest.updateMany({
      where: {
        id: suggestion_id,
        commessa_id: commessa.id,
        is_ai_suggested: true,
      },
      data: {
        is_ai_suggested: false,
        status: 'SUBMITTED',
      },
    })

    if (result.count === 0) {
      return errorResponse(
        'ALREADY_PROCESSED',
        'Il suggerimento è già stato elaborato',
        409,
      )
    }

    await prisma.commessaTimeline.create({
      data: {
        commessa_id: commessa.id,
        type: 'suggestion_accepted',
        title: 'Suggerimento AI accettato',
        metadata: { request_id: suggestion_id },
      },
    })

    return successResponse({ accepted: true, request_id: suggestion_id })
  } catch (error) {
    console.error('POST /api/commesse/[code]/accept-suggestion error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore accettazione suggerimento',
      500,
    )
  }
}
