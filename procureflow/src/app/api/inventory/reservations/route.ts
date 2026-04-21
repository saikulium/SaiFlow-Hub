import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import {
  createReservationSchema,
  getStockLevels,
} from '@/modules/core/inventory'

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createReservationSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    // Verify available quantity
    const stockLevels = await getStockLevels(parsed.data.material_id)
    if (stockLevels.available < parsed.data.reserved_quantity) {
      return errorResponse(
        'INSUFFICIENT_STOCK',
        `Quantità disponibile insufficiente: disponibile ${stockLevels.available}, richiesta ${parsed.data.reserved_quantity}`,
        400,
      )
    }

    const reservation = await prisma.stockReservation.create({
      data: {
        material_id: parsed.data.material_id,
        lot_id: parsed.data.lot_id ?? null,
        reserved_quantity: parsed.data.reserved_quantity,
        reserved_quantity_secondary:
          parsed.data.reserved_quantity_secondary ?? null,
        tender_id: parsed.data.tender_id ?? null,
        purchase_request_id: parsed.data.purchase_request_id ?? null,
        expires_at: parsed.data.expires_at
          ? new Date(parsed.data.expires_at)
          : null,
        notes: parsed.data.notes ?? null,
        reserved_by: authResult.name,
      },
    })

    return successResponse({ id: reservation.id })
  } catch (error) {
    console.error('POST /api/inventory/reservations error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nella creazione prenotazione',
      500,
    )
  }
}
