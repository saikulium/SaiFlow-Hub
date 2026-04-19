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
  createInventorySchema,
  getNextInventoryCode,
} from '@/modules/core/inventory'
import type { InventoryListItem } from '@/types'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const page = Number(req.nextUrl.searchParams.get('page') ?? '1')
    const pageSize = Number(req.nextUrl.searchParams.get('pageSize') ?? '20')

    const [inventories, total] = await Promise.all([
      prisma.stockInventory.findMany({
        include: {
          warehouse: { select: { name: true } },
          lines: { select: { id: true, variance: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockInventory.count(),
    ])

    const data: InventoryListItem[] = inventories.map((inv) => ({
      id: inv.id,
      code: inv.code,
      warehouseName: inv.warehouse.name,
      status: inv.status,
      linesCount: inv.lines.length,
      varianceCount: inv.lines.filter(
        (l) => l.variance !== null && Number(l.variance) !== 0,
      ).length,
      createdBy: inv.created_by,
      startedAt: inv.started_at?.toISOString() ?? null,
      completedAt: inv.completed_at?.toISOString() ?? null,
      createdAt: inv.created_at.toISOString(),
    }))

    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/inventory/inventories error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero inventari', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createInventorySchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const code = await getNextInventoryCode()

    // Get all lots in the warehouse to generate lines
    const lots = await prisma.stockLot.findMany({
      where: {
        warehouse_id: parsed.data.warehouse_id,
        status: { in: ['AVAILABLE', 'RESERVED'] },
      },
      select: {
        id: true,
        material_id: true,
        zone_id: true,
        current_quantity: true,
      },
    })

    const inventory = await prisma.stockInventory.create({
      data: {
        code,
        warehouse_id: parsed.data.warehouse_id,
        notes: parsed.data.notes ?? null,
        status: 'IN_PROGRESS',
        started_at: new Date(),
        created_by: authResult.name,
        lines: {
          create: lots.map((lot) => ({
            material_id: lot.material_id,
            lot_id: lot.id,
            zone_id: lot.zone_id,
            expected_quantity: lot.current_quantity,
          })),
        },
      },
      include: {
        lines: { select: { id: true } },
      },
    })

    return successResponse({
      id: inventory.id,
      code: inventory.code,
      linesCount: inventory.lines.length,
    })
  } catch (error) {
    console.error('POST /api/inventory/inventories error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nella creazione inventario',
      500,
    )
  }
}
