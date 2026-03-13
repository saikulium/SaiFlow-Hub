import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const searchParams = req.nextUrl.searchParams
    const material_id = searchParams.get('material_id') ?? undefined
    const warehouse_id = searchParams.get('warehouse_id') ?? undefined
    const status = searchParams.get('status') ?? undefined

    const where: Record<string, unknown> = {}
    if (material_id) where.material_id = material_id
    if (warehouse_id) where.warehouse_id = warehouse_id
    if (status) where.status = status

    const lots = await prisma.stockLot.findMany({
      where,
      include: {
        material: { select: { code: true, name: true, unit_primary: true } },
        warehouse: { select: { name: true } },
        zone: { select: { name: true } },
        purchase_request: { select: { code: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    const data = lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lot_number,
      materialCode: lot.material.code,
      materialName: lot.material.name,
      unitPrimary: lot.material.unit_primary,
      warehouseName: lot.warehouse.name,
      zoneName: lot.zone?.name ?? null,
      initialQuantity: Number(lot.initial_quantity),
      currentQuantity: Number(lot.current_quantity),
      currentQuantitySecondary: lot.current_quantity_secondary
        ? Number(lot.current_quantity_secondary)
        : null,
      unitCost: Number(lot.unit_cost),
      expiryDate: lot.expiry_date?.toISOString() ?? null,
      status: lot.status,
      prCode: lot.purchase_request?.code ?? null,
      createdAt: lot.created_at.toISOString(),
    }))

    return successResponse(data)
  } catch (error) {
    console.error('GET /api/inventory/lots error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero lotti', 500)
  }
}
