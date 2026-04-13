import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response'
import { withApiHandler } from '@/lib/api-handler'
import { prisma } from '@/lib/db'

export const PATCH = withApiHandler(
  { auth: true, errorMessage: "Errore nell'aggiornamento notifica" },
  async ({ params, user }) => {
    const existing = await prisma.notification.findUnique({
      where: { id: params.id },
      select: { id: true, user_id: true },
    })

    if (!existing) return notFoundResponse('Notifica non trovata')

    if (existing.user_id !== user.id) {
      return errorResponse('FORBIDDEN', 'Non autorizzato', 403)
    }

    const notification = await prisma.notification.update({
      where: { id: params.id },
      data: { read: true },
    })

    return successResponse(notification)
  },
)
