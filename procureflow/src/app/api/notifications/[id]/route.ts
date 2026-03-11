import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { getCurrentUserId } from '@/lib/auth'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getCurrentUserId()

    const existing = await prisma.notification.findUnique({
      where: { id: params.id },
      select: { id: true, user_id: true },
    })

    if (!existing) return notFoundResponse('Notifica non trovata')

    if (existing.user_id !== userId) {
      return errorResponse('FORBIDDEN', 'Non autorizzato', 403)
    }

    const notification = await prisma.notification.update({
      where: { id: params.id },
      data: { read: true },
    })

    return successResponse(notification)
  } catch (error) {
    console.error('PATCH /api/notifications/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', "Errore nell'aggiornamento", 500)
  }
}
