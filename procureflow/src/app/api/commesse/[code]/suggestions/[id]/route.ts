import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { requireAuth } from '@/lib/auth'

const modifySuggestionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  estimated_amount: z.number().min(0).optional(),
  vendor_id: z.string().min(1).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string; id: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/commesse')
  if (blocked) return blocked

  try {
    const body = await req.json()
    const parsed = modifySuggestionSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const commessa = await prisma.commessa.findUnique({
      where: { code: params.code },
      select: { id: true },
    })

    if (!commessa) return notFoundResponse('Commessa non trovata')

    const suggestion = await prisma.purchaseRequest.findFirst({
      where: {
        id: params.id,
        commessa_id: commessa.id,
        is_ai_suggested: true,
      },
    })

    if (!suggestion) {
      return notFoundResponse('Suggerimento non trovato o già elaborato')
    }

    const { estimated_amount, ...rest } = parsed.data

    const updated = await prisma.purchaseRequest.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(estimated_amount !== undefined && {
          estimated_amount: new Prisma.Decimal(estimated_amount),
        }),
      },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('PATCH /api/commesse/[code]/suggestions/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore modifica suggerimento', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string; id: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/commesse')
  if (blocked) return blocked

  try {
    const commessa = await prisma.commessa.findUnique({
      where: { code: params.code },
      select: { id: true },
    })

    if (!commessa) return notFoundResponse('Commessa non trovata')

    // Optimistic concurrency: only delete if still a suggestion
    const result = await prisma.purchaseRequest.deleteMany({
      where: {
        id: params.id,
        commessa_id: commessa.id,
        is_ai_suggested: true,
      },
    })

    if (result.count === 0) {
      return notFoundResponse('Suggerimento non trovato o già elaborato')
    }

    await prisma.commessaTimeline.create({
      data: {
        commessa_id: commessa.id,
        type: 'suggestion_rejected',
        title: 'Suggerimento AI rifiutato',
        metadata: { request_id: params.id },
      },
    })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/commesse/[code]/suggestions/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore rifiuto suggerimento', 500)
  }
}
