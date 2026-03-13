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
  materialQuerySchema,
  createMaterialSchema,
} from '@/lib/validations/inventory'
import { getNextMaterialCode } from '@/server/services/inventory-db.service'
import { computeStockLevel } from '@/server/services/inventory.service'
import type { MaterialListItem } from '@/types'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER', 'REQUESTER')
    if (authResult instanceof NextResponse) return authResult

    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = materialQuerySchema.safeParse(params)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const { page, pageSize, search, category, is_active, low_stock } =
      parsed.data

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (category) {
      where.category = { contains: category, mode: 'insensitive' }
    }
    if (is_active !== undefined) {
      where.is_active = is_active
    }

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        include: {
          preferred_vendor: { select: { name: true } },
          lots: {
            where: { status: { in: ['AVAILABLE', 'RESERVED'] } },
            select: { current_quantity: true },
          },
          reservations: {
            where: { status: 'ACTIVE' },
            select: { reserved_quantity: true },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.material.count({ where }),
    ])

    let data: MaterialListItem[] = materials.map((m) => {
      const physical = m.lots.reduce(
        (sum, lot) => sum + Number(lot.current_quantity),
        0,
      )
      const reserved = m.reservations.reduce(
        (sum, r) => sum + Number(r.reserved_quantity),
        0,
      )
      const minLevel = m.min_stock_level ? Number(m.min_stock_level) : null
      const stock = computeStockLevel(physical, reserved, minLevel)

      return {
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        unitPrimary: m.unit_primary,
        unitSecondary: m.unit_secondary,
        unitCost: Number(m.unit_cost),
        stockPhysical: stock.physical,
        stockAvailable: stock.available,
        stockReserved: stock.reserved,
        minStockLevel: minLevel,
        stockStatus: stock.status,
        isActive: m.is_active,
        preferredVendor: m.preferred_vendor?.name ?? null,
      }
    })

    // Filter low stock on application level (needs computed stock)
    if (low_stock) {
      data = data.filter(
        (m) => m.stockStatus === 'LOW' || m.stockStatus === 'OUT',
      )
    }

    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/inventory/materials error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero materiali', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createMaterialSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    // Extract prefix from category (first 3 chars uppercase) or default 'GEN'
    const prefix = parsed.data.category
      ? parsed.data.category.slice(0, 3).toUpperCase()
      : 'GEN'

    const code = await getNextMaterialCode(prefix)

    const material = await prisma.material.create({
      data: {
        code,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        category: parsed.data.category ?? null,
        subcategory: parsed.data.subcategory ?? null,
        unit_primary: parsed.data.unit_primary,
        unit_secondary: parsed.data.unit_secondary ?? null,
        conversion_factor: parsed.data.conversion_factor ?? null,
        min_stock_level: parsed.data.min_stock_level ?? null,
        max_stock_level: parsed.data.max_stock_level ?? null,
        barcode: parsed.data.barcode ?? null,
        qr_code: parsed.data.qr_code ?? null,
        preferred_vendor_id: parsed.data.preferred_vendor_id ?? null,
        tags: parsed.data.tags ?? [],
        notes: parsed.data.notes ?? null,
      },
    })

    return successResponse({ id: material.id, code: material.code })
  } catch (error) {
    console.error('POST /api/inventory/materials error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nella creazione materiale',
      500,
    )
  }
}
