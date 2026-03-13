import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const lot = await prisma.stockLot.findUnique({
      where: { id },
      include: {
        material: { select: { code: true, name: true, unit_primary: true } },
        warehouse: { select: { name: true } },
        zone: { select: { name: true } },
        purchase_request: { select: { code: true } },
        movements: {
          include: {
            warehouse: { select: { name: true } },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    })

    if (!lot) return notFoundResponse('Lotto non trovato')

    return successResponse({
      id: lot.id,
      lotNumber: lot.lot_number,
      materialCode: lot.material.code,
      materialName: lot.material.name,
      unitPrimary: lot.material.unit_primary,
      warehouseName: lot.warehouse.name,
      zoneName: lot.zone?.name ?? null,
      initialQuantity: Number(lot.initial_quantity),
      currentQuantity: Number(lot.current_quantity),
      initialQuantitySecondary: lot.initial_quantity_secondary
        ? Number(lot.initial_quantity_secondary)
        : null,
      currentQuantitySecondary: lot.current_quantity_secondary
        ? Number(lot.current_quantity_secondary)
        : null,
      unitCost: Number(lot.unit_cost),
      expiryDate: lot.expiry_date?.toISOString() ?? null,
      status: lot.status,
      prCode: lot.purchase_request?.code ?? null,
      notes: lot.notes,
      createdAt: lot.created_at.toISOString(),
      movements: lot.movements.map((m) => ({
        id: m.id,
        code: m.code,
        movementType: m.movement_type,
        reason: m.reason,
        quantity: Number(m.quantity),
        unitCost: m.unit_cost ? Number(m.unit_cost) : null,
        warehouseName: m.warehouse.name,
        actor: m.actor,
        createdAt: m.created_at.toISOString(),
      })),
    })
  } catch (error) {
    console.error('GET /api/inventory/lots/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero lotto', 500)
  }
}
