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
import { updateWarehouseSchema } from '@/lib/validations/inventory'

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

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        zones: {
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        },
      },
    })

    if (!warehouse) return notFoundResponse('Magazzino non trovato')

    return successResponse({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address,
      isActive: warehouse.is_active,
      zonesCount: warehouse.zones.length,
      zones: warehouse.zones.map((z) => ({
        id: z.id,
        code: z.code,
        name: z.name,
      })),
      createdAt: warehouse.created_at.toISOString(),
    })
  } catch (error) {
    console.error('GET /api/inventory/warehouses/[id] error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nel recupero magazzino',
      500,
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = updateWarehouseSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const existing = await prisma.warehouse.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Magazzino non trovato')

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.address !== undefined && {
          address: parsed.data.address,
        }),
        ...(parsed.data.is_active !== undefined && {
          is_active: parsed.data.is_active,
        }),
      },
    })

    // Manage zones: upsert existing + create new
    if (parsed.data.zones) {
      for (const zone of parsed.data.zones) {
        if (zone.id) {
          await prisma.warehouseZone.update({
            where: { id: zone.id },
            data: { code: zone.code, name: zone.name },
          })
        } else {
          await prisma.warehouseZone.create({
            data: {
              warehouse_id: id,
              code: zone.code,
              name: zone.name,
            },
          })
        }
      }
    }

    return successResponse({ id: warehouse.id })
  } catch (error) {
    console.error('PATCH /api/inventory/warehouses/[id] error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore aggiornamento magazzino',
      500,
    )
  }
}
