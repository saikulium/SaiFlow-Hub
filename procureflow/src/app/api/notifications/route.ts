import { prisma } from '@/lib/db'
import { successResponse } from '@/lib/api-response'
import { withApiHandler } from '@/lib/api-handler'
import {
  notificationQuerySchema,
  markReadSchema,
} from '@/modules/core/requests'

export const GET = withApiHandler(
  {
    auth: true,
    querySchema: notificationQuerySchema,
    errorMessage: 'Errore nel recupero notifiche',
  },
  async ({ query, user }) => {
    const { page, pageSize, read } = query

    const where: { user_id: string; read?: boolean } = { user_id: user.id }
    if (read !== undefined) {
      where.read = read
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          link: true,
          read: true,
          created_at: true,
        },
      }),
      prisma.notification.count({ where }),
    ])

    return successResponse(notifications, { total, page, pageSize })
  },
)

export const PATCH = withApiHandler(
  {
    auth: true,
    bodySchema: markReadSchema,
    errorMessage: "Errore nell'aggiornamento notifiche",
  },
  async ({ body, user }) => {
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: body.ids },
        user_id: user.id,
      },
      data: { read: true },
    })

    return successResponse({ updated: result.count })
  },
)
