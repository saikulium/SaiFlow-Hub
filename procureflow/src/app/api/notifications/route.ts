import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import {
  notificationQuerySchema,
  markReadSchema,
} from '@/lib/validations/notification'
import { getCurrentUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const queryParams = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = notificationQuerySchema.safeParse(queryParams)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { page, pageSize, read } = parsed.data
    const userId = await getCurrentUserId()

    const where: { user_id: string; read?: boolean } = { user_id: userId }

    if (read !== undefined) {
      where.read = read
    }

    const notifications = await prisma.notification.findMany({
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
    })
    const total = await prisma.notification.count({ where })
    const unreadCount = await prisma.notification.count({
      where: { user_id: userId, read: false },
    })

    return successResponse(notifications, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/notifications error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = markReadSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const userId = await getCurrentUserId()

    const result = await prisma.notification.updateMany({
      where: {
        id: { in: parsed.data.ids },
        user_id: userId,
      },
      data: { read: true },
    })

    return successResponse({ updated: result.count })
  } catch (error) {
    console.error('PATCH /api/notifications error:', error)
    return errorResponse('INTERNAL_ERROR', "Errore nell'aggiornamento", 500)
  }
}
