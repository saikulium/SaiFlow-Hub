import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { createWarehouseSchema } from '@/modules/core/inventory'
import type { WarehouseListItem } from '@/types'

export async function GET(_req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const warehouses = await prisma.warehouse.findMany({
      include: {
        zones: {
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    const data: WarehouseListItem[] = warehouses.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      isActive: w.is_active,
      zonesCount: w.zones.length,
      zones: w.zones.map((z) => ({ id: z.id, code: z.code, name: z.name })),
    }))

    return successResponse(data)
  } catch (error) {
    console.error('GET /api/inventory/warehouses error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero magazzini', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createWarehouseSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        address: parsed.data.address ?? null,
        zones: parsed.data.zones
          ? {
              create: parsed.data.zones.map((z) => ({
                code: z.code,
                name: z.name,
              })),
            }
          : undefined,
      },
      include: { zones: { select: { id: true, code: true, name: true } } },
    })

    return successResponse({
      id: warehouse.id,
      code: warehouse.code,
      zones: warehouse.zones,
    })
  } catch (error) {
    console.error('POST /api/inventory/warehouses error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nella creazione magazzino',
      500,
    )
  }
}
