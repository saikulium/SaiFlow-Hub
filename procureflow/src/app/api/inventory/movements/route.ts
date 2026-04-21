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
  movementQuerySchema,
  createMovementSchema,
  validateMovement,
  recordInboundMovement,
  recordOutboundMovement,
  getNextMovementCode,
} from '@/modules/core/inventory'
import type { MovementListItem } from '@/types'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER', 'REQUESTER')
    if (authResult instanceof NextResponse) return authResult

    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = movementQuerySchema.safeParse(params)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const {
      page,
      pageSize,
      material_id,
      warehouse_id,
      movement_type,
      date_from,
      date_to,
    } = parsed.data

    const where: Record<string, unknown> = {}
    if (material_id) where.material_id = material_id
    if (warehouse_id) where.warehouse_id = warehouse_id
    if (movement_type) where.movement_type = movement_type

    if (date_from || date_to) {
      const dateFilter: Record<string, Date> = {}
      if (date_from) dateFilter.gte = new Date(date_from)
      if (date_to) dateFilter.lte = new Date(date_to)
      where.created_at = dateFilter
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          material: { select: { code: true, name: true } },
          lot: { select: { lot_number: true } },
          warehouse: { select: { name: true } },
          zone: { select: { name: true } },
          purchase_request: { select: { code: true } },
          tender: { select: { code: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ])

    const data: MovementListItem[] = movements.map((m) => ({
      id: m.id,
      code: m.code,
      materialCode: m.material.code,
      materialName: m.material.name,
      lotNumber: m.lot?.lot_number ?? null,
      warehouseName: m.warehouse.name,
      zoneName: m.zone?.name ?? null,
      movementType: m.movement_type,
      reason: m.reason,
      quantity: Number(m.quantity),
      quantitySecondary: m.quantity_secondary
        ? Number(m.quantity_secondary)
        : null,
      unitCost: m.unit_cost ? Number(m.unit_cost) : null,
      referenceCode: m.reference_code,
      prCode: m.purchase_request?.code ?? null,
      tenderCode: m.tender?.code ?? null,
      actor: m.actor,
      createdAt: m.created_at.toISOString(),
    }))

    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/inventory/movements error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero movimenti', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/inventory')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createMovementSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const validation = validateMovement({
      movement_type: parsed.data.movement_type,
      reason: parsed.data.reason,
      lot_id: parsed.data.lot_id,
      to_warehouse_id: parsed.data.to_warehouse_id,
    })

    if (!validation.valid) {
      return errorResponse(
        'VALIDATION_ERROR',
        validation.reason ?? 'Dati non validi',
        400,
      )
    }

    const { movement_type } = parsed.data

    if (movement_type === 'INBOUND') {
      if (!parsed.data.unit_cost && parsed.data.unit_cost !== 0) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Il costo unitario è obbligatorio per un carico',
          400,
        )
      }

      const result = await recordInboundMovement({
        material_id: parsed.data.material_id,
        warehouse_id: parsed.data.warehouse_id,
        zone_id: parsed.data.zone_id,
        quantity: parsed.data.quantity,
        quantity_secondary: parsed.data.quantity_secondary,
        unit_cost: parsed.data.unit_cost,
        reason: parsed.data.reason,
        purchase_request_id: parsed.data.purchase_request_id,
        reference_code: parsed.data.reference_code,
        notes: parsed.data.notes,
        actor: authResult.name,
      })

      return successResponse({
        movementId: result.movement.id,
        movementCode: result.movement.code,
        lotId: result.lot.id,
        lotNumber: result.lot.lot_number,
      })
    }

    if (movement_type === 'OUTBOUND') {
      if (!parsed.data.lot_id) {
        return errorResponse(
          'VALIDATION_ERROR',
          'Per uno scarico è necessario specificare il lotto',
          400,
        )
      }

      const result = await recordOutboundMovement({
        material_id: parsed.data.material_id,
        lot_id: parsed.data.lot_id,
        warehouse_id: parsed.data.warehouse_id,
        zone_id: parsed.data.zone_id,
        quantity: parsed.data.quantity,
        quantity_secondary: parsed.data.quantity_secondary,
        reason: parsed.data.reason,
        tender_id: parsed.data.tender_id,
        purchase_request_id: parsed.data.purchase_request_id,
        reference_code: parsed.data.reference_code,
        notes: parsed.data.notes,
        actor: authResult.name,
      })

      return successResponse({
        movementId: result.movement.id,
        movementCode: result.movement.code,
      })
    }

    // TRANSFER, ADJUSTMENT, RETURN — create movement directly
    const movementCode = await getNextMovementCode()

    const movement = await prisma.stockMovement.create({
      data: {
        code: movementCode,
        material_id: parsed.data.material_id,
        lot_id: parsed.data.lot_id ?? null,
        warehouse_id: parsed.data.warehouse_id,
        zone_id: parsed.data.zone_id ?? null,
        movement_type: parsed.data.movement_type,
        reason: parsed.data.reason,
        quantity: parsed.data.quantity,
        quantity_secondary: parsed.data.quantity_secondary ?? null,
        unit_cost: parsed.data.unit_cost ?? null,
        to_warehouse_id: parsed.data.to_warehouse_id ?? null,
        to_zone_id: parsed.data.to_zone_id ?? null,
        purchase_request_id: parsed.data.purchase_request_id ?? null,
        tender_id: parsed.data.tender_id ?? null,
        reference_code: parsed.data.reference_code ?? null,
        notes: parsed.data.notes ?? null,
        actor: authResult.name,
      },
    })

    return successResponse({
      movementId: movement.id,
      movementCode: movement.code,
    })
  } catch (error) {
    console.error('POST /api/inventory/movements error:', error)

    const message = error instanceof Error ? error.message : ''

    if (message.includes('Quantità insufficiente')) {
      return errorResponse('INSUFFICIENT_STOCK', message, 400)
    }
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nella registrazione movimento',
      500,
    )
  }
}
