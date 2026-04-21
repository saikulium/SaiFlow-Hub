import { prisma } from '@/lib/db'
import { successResponse, notFoundResponse } from '@/lib/api-response'
import { withApiHandler } from '@/lib/api-handler'
import {
  createCommentSchema,
  commentQuerySchema,
  createComment,
} from '@/modules/core/requests'

export const GET = withApiHandler(
  {
    auth: true,
    querySchema: commentQuerySchema,
    errorMessage: 'Errore nel recupero commenti',
  },
  async ({ params, query }) => {
    const { page, pageSize } = query

    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!request) return notFoundResponse('Richiesta non trovata')

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { request_id: params.id },
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
        orderBy: { created_at: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.comment.count({ where: { request_id: params.id } }),
    ])

    return successResponse(comments, { total, page, pageSize })
  },
)

export const POST = withApiHandler(
  {
    auth: true,
    bodySchema: createCommentSchema,
    errorMessage: 'Errore nella creazione del commento',
  },
  async ({ params, body, user }) => {
    const requestId = params.id ?? ''

    const request = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    })

    if (!request) return notFoundResponse('Richiesta non trovata')

    const comment = await createComment({
      requestId,
      authorId: user.id,
      content: body.content,
      isInternal: body.is_internal ?? true,
    })

    return successResponse(comment)
  },
)
