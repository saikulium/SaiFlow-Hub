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
import { updateMaterialSchema } from '@/lib/validations/inventory'
import { getStockLevels } from '@/server/services/inventory-db.service'
import type { MaterialDetail, LotSummary, ReservationSummary } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN', 'MANAGER', 'REQUESTER')
    if (authResult instanceof NextResponse) return authResult

    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        preferred_vendor: { select: { name: true } },
        lots: {
          where: { status: { in: ['AVAILABLE', 'RESERVED'] } },
          include: {
            warehouse: { select: { name: true } },
            zone: { select: { name: true } },
            purchase_request: { select: { code: true } },
          },
          orderBy: { created_at: 'desc' },
        },
        reservations: {
          where: { status: 'ACTIVE' },
          include: {
            tender: { select: { code: true } },
            purchase_request: { select: { code: true } },
          },
          orderBy: { reserved_at: 'desc' },
        },
      },
    })

    if (!material) return notFoundResponse('Materiale non trovato')

    const stockLevels = await getStockLevels(id)

    const activeLots: LotSummary[] = material.lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lot_number,
      warehouseName: lot.warehouse.name,
      zoneName: lot.zone?.name ?? null,
      currentQuantity: Number(lot.current_quantity),
      currentQuantitySecondary: lot.current_quantity_secondary
        ? Number(lot.current_quantity_secondary)
        : null,
      unitCost: Number(lot.unit_cost),
      expiryDate: lot.expiry_date?.toISOString() ?? null,
      status: lot.status,
      prCode: lot.purchase_request?.code ?? null,
    }))

    const activeReservations: ReservationSummary[] = material.reservations.map(
      (r) => ({
        id: r.id,
        reservedQuantity: Number(r.reserved_quantity),
        tenderCode: r.tender?.code ?? null,
        prCode: r.purchase_request?.code ?? null,
        status: r.status,
        reservedAt: r.reserved_at.toISOString(),
        expiresAt: r.expires_at?.toISOString() ?? null,
      }),
    )

    const detail: MaterialDetail = {
      id: material.id,
      code: material.code,
      name: material.name,
      description: material.description,
      category: material.category,
      subcategory: material.subcategory,
      unitPrimary: material.unit_primary,
      unitSecondary: material.unit_secondary,
      unitCost: Number(material.unit_cost),
      conversionFactor: material.conversion_factor
        ? Number(material.conversion_factor)
        : null,
      minStockLevel: material.min_stock_level
        ? Number(material.min_stock_level)
        : null,
      maxStockLevel: material.max_stock_level
        ? Number(material.max_stock_level)
        : null,
      barcode: material.barcode,
      qrCode: material.qr_code,
      tags: material.tags,
      notes: material.notes,
      isActive: material.is_active,
      preferredVendor: material.preferred_vendor?.name ?? null,
      stockPhysical: stockLevels.physical,
      stockAvailable: stockLevels.available,
      stockReserved: stockLevels.reserved,
      stockStatus: stockLevels.status,
      createdAt: material.created_at.toISOString(),
      stockByWarehouse: stockLevels.byWarehouse,
      activeLots,
      activeReservations,
    }

    return successResponse(detail)
  } catch (error) {
    console.error('GET /api/inventory/materials/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero materiale', 500)
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
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = updateMaterialSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const existing = await prisma.material.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Materiale non trovato')

    const material = await prisma.material.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.category !== undefined && {
          category: parsed.data.category,
        }),
        ...(parsed.data.subcategory !== undefined && {
          subcategory: parsed.data.subcategory,
        }),
        ...(parsed.data.unit_primary !== undefined && {
          unit_primary: parsed.data.unit_primary,
        }),
        ...(parsed.data.unit_secondary !== undefined && {
          unit_secondary: parsed.data.unit_secondary,
        }),
        ...(parsed.data.conversion_factor !== undefined && {
          conversion_factor: parsed.data.conversion_factor,
        }),
        ...(parsed.data.min_stock_level !== undefined && {
          min_stock_level: parsed.data.min_stock_level,
        }),
        ...(parsed.data.max_stock_level !== undefined && {
          max_stock_level: parsed.data.max_stock_level,
        }),
        ...(parsed.data.barcode !== undefined && {
          barcode: parsed.data.barcode,
        }),
        ...(parsed.data.qr_code !== undefined && {
          qr_code: parsed.data.qr_code,
        }),
        ...(parsed.data.preferred_vendor_id !== undefined && {
          preferred_vendor_id: parsed.data.preferred_vendor_id,
        }),
        ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.is_active !== undefined && {
          is_active: parsed.data.is_active,
        }),
      },
    })

    return successResponse({ id: material.id })
  } catch (error) {
    console.error('PATCH /api/inventory/materials/[id] error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore aggiornamento materiale',
      500,
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            lots: { where: { status: { in: ['AVAILABLE', 'RESERVED'] } } },
          },
        },
      },
    })

    if (!material) return notFoundResponse('Materiale non trovato')

    if (material._count.lots > 0) {
      return errorResponse(
        'HAS_STOCK',
        'Impossibile eliminare: il materiale ha lotti attivi in magazzino',
        400,
      )
    }

    await prisma.material.delete({ where: { id } })

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('DELETE /api/inventory/materials/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione materiale', 500)
  }
}
