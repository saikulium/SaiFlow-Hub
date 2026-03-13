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
import { updateReservationSchema } from '@/lib/validations/inventory'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = updateReservationSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const existing = await prisma.stockReservation.findUnique({
      where: { id },
    })
    if (!existing) return notFoundResponse('Prenotazione non trovata')

    if (existing.status !== 'ACTIVE') {
      return errorResponse(
        'INVALID_STATE',
        'Solo le prenotazioni attive possono essere aggiornate',
        400,
      )
    }

    const reservation = await prisma.stockReservation.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === 'FULFILLED'
          ? { fulfilled_at: new Date() }
          : {}),
      },
    })

    return successResponse({ id: reservation.id, status: reservation.status })
  } catch (error) {
    console.error('PATCH /api/inventory/reservations/[id] error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore aggiornamento prenotazione',
      500,
    )
  }
}
