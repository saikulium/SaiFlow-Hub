import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import {
  createCommentSchema,
  commentQuerySchema,
} from '@/lib/validations/comment'
import { getCurrentUserId } from '@/lib/auth'
import { createComment } from '@/server/services/comment.service'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const queryParams = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = commentQuerySchema.safeParse(queryParams)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { page, pageSize } = parsed.data

    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!request) return notFoundResponse('Richiesta non trovata')

    const comments = await prisma.comment.findMany({
      where: { request_id: params.id },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
      orderBy: { created_at: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    const total = await prisma.comment.count({
      where: { request_id: params.id },
    })

    return successResponse(comments, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/requests/[id]/comments error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const parsed = createCommentSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!request) return notFoundResponse('Richiesta non trovata')

    const authorId = await getCurrentUserId()

    const comment = await createComment({
      requestId: params.id,
      authorId,
      content: parsed.data.content,
      isInternal: parsed.data.is_internal,
    })

    return successResponse(comment)
  } catch (error) {
    console.error('POST /api/requests/[id]/comments error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nella creazione del commento',
      500,
    )
  }
}
