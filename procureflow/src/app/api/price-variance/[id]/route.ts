import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { z } from 'zod'
import { createNotification } from '@/modules/core/requests'

const decideSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED', 'NEGOTIATING']),
  notes: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const currentUser = await getCurrentUser()
    const body = await req.json()
    const parsed = decideSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const review = await prisma.priceVarianceReview.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        request_id: true,
        max_delta_percent: true,
        total_delta: true,
        request: { select: { code: true, requester_id: true } },
      },
    })

    if (!review) {
      return notFoundResponse('Price variance review non trovata')
    }

    if (review.status !== 'PENDING') {
      return errorResponse(
        'INVALID_STATE',
        `Review non in stato PENDING (stato attuale: ${review.status})`,
        400,
      )
    }

    const { status, notes } = parsed.data

    const [updated] = await prisma.$transaction([
      prisma.priceVarianceReview.update({
        where: { id: params.id },
        data: {
          status,
          decided_by: currentUser.id,
          decided_at: new Date(),
          decision_notes: notes ?? null,
        },
        include: {
          request: { select: { id: true, code: true, title: true } },
        },
      }),
      prisma.timelineEvent.create({
        data: {
          request_id: review.request_id,
          type: 'price_variance_decision',
          title: `Variazione prezzo: ${status}`,
          description:
            notes ??
            `Delta ${Number(review.total_delta) >= 0 ? '+' : ''}${Number(review.total_delta).toFixed(2)} EUR (${review.max_delta_percent.toFixed(1)}%)`,
          metadata: {
            review_id: review.id,
            decision: status,
            max_delta_percent: review.max_delta_percent,
            total_delta: Number(review.total_delta),
          },
          actor: currentUser.name,
        },
      }),
    ])

    // Notify the requester
    await createNotification({
      userId: review.request.requester_id,
      title: `Variazione prezzo ${status === 'ACCEPTED' ? 'accettata' : status === 'REJECTED' ? 'rifiutata' : 'in negoziazione'}`,
      body: `La variazione prezzo sulla richiesta ${review.request.code} è stata ${status === 'ACCEPTED' ? 'accettata' : status === 'REJECTED' ? 'rifiutata' : 'messa in negoziazione'}.`,
      type: 'status_changed',
      link: `/requests/${review.request_id}`,
    })

    return successResponse({
      ...updated,
      total_old_amount: Number(updated.total_old_amount),
      total_new_amount: Number(updated.total_new_amount),
      total_delta: Number(updated.total_delta),
    })
  } catch (error) {
    console.error('PATCH /api/price-variance/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
