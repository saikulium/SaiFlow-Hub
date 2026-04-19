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
import {
  updateInventoryLineSchema,
  getNextMovementCode,
} from '@/modules/core/inventory'

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

    const inventory = await prisma.stockInventory.findUnique({
      where: { id },
      include: {
        warehouse: { select: { name: true } },
        lines: {
          include: {
            material: {
              select: { code: true, name: true, unit_primary: true },
            },
            lot: { select: { lot_number: true } },
            zone: { select: { name: true } },
          },
          orderBy: { material: { code: 'asc' } },
        },
      },
    })

    if (!inventory) return notFoundResponse('Inventario non trovato')

    return successResponse({
      id: inventory.id,
      code: inventory.code,
      warehouseName: inventory.warehouse.name,
      warehouseId: inventory.warehouse_id,
      status: inventory.status,
      notes: inventory.notes,
      createdBy: inventory.created_by,
      completedBy: inventory.completed_by,
      startedAt: inventory.started_at?.toISOString() ?? null,
      completedAt: inventory.completed_at?.toISOString() ?? null,
      createdAt: inventory.created_at.toISOString(),
      lines: inventory.lines.map((line) => ({
        id: line.id,
        materialCode: line.material.code,
        materialName: line.material.name,
        unitPrimary: line.material.unit_primary,
        lotNumber: line.lot?.lot_number ?? null,
        zoneName: line.zone?.name ?? null,
        expectedQuantity: Number(line.expected_quantity),
        countedQuantity: line.counted_quantity
          ? Number(line.counted_quantity)
          : null,
        variance: line.variance ? Number(line.variance) : null,
      })),
    })
  } catch (error) {
    console.error('GET /api/inventory/inventories/[id] error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nel recupero inventario',
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
    const body = await req.json()

    // Determine operation: update lines or close inventory
    if (body.close === true) {
      return await closeInventory(id)
    }

    if (body.lines) {
      return await updateLines(id, body)
    }

    return errorResponse(
      'VALIDATION_ERROR',
      'Specificare "lines" per aggiornare le righe o "close: true" per chiudere l\'inventario',
      400,
    )
  } catch (error) {
    console.error('PATCH /api/inventory/inventories/[id] error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore aggiornamento inventario',
      500,
    )
  }
}

async function updateLines(inventoryId: string, body: unknown) {
  const authResult = await requireRole('ADMIN', 'MANAGER')
  if (authResult instanceof NextResponse) return authResult

  const parsed = updateInventoryLineSchema.safeParse(body)
  if (!parsed.success) return validationErrorResponse(parsed.error)

  const inventory = await prisma.stockInventory.findUnique({
    where: { id: inventoryId },
  })
  if (!inventory) return notFoundResponse('Inventario non trovato')

  if (inventory.status !== 'IN_PROGRESS') {
    return errorResponse(
      'INVALID_STATE',
      'Solo gli inventari in corso possono essere aggiornati',
      400,
    )
  }

  // Update each line with counted quantity and compute variance
  for (const lineUpdate of parsed.data.lines) {
    const line = await prisma.stockInventoryLine.findUnique({
      where: { id: lineUpdate.id },
      select: { expected_quantity: true, inventory_id: true },
    })

    if (!line || line.inventory_id !== inventoryId) {
      continue
    }

    const variance =
      lineUpdate.counted_quantity - Number(line.expected_quantity)

    await prisma.stockInventoryLine.update({
      where: { id: lineUpdate.id },
      data: {
        counted_quantity: lineUpdate.counted_quantity,
        variance,
      },
    })
  }

  return successResponse({ id: inventoryId, updated: parsed.data.lines.length })
}

async function closeInventory(inventoryId: string) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const inventory = await prisma.stockInventory.findUnique({
    where: { id: inventoryId },
    include: {
      lines: {
        where: {
          variance: { not: null },
        },
        select: {
          id: true,
          material_id: true,
          lot_id: true,
          zone_id: true,
          variance: true,
        },
      },
    },
  })

  if (!inventory) return notFoundResponse('Inventario non trovato')

  if (inventory.status !== 'IN_PROGRESS') {
    return errorResponse(
      'INVALID_STATE',
      'Solo gli inventari in corso possono essere chiusi',
      400,
    )
  }

  await prisma.$transaction(async (tx) => {
    // Create adjustment movements for lines with non-zero variance
    for (const line of inventory.lines) {
      const variance = Number(line.variance)
      if (variance === 0) continue

      const movementCode = await getNextMovementCode()
      const movementType = variance > 0 ? 'ADJUSTMENT' : 'ADJUSTMENT'
      const reason = variance > 0 ? 'RETTIFICA_POSITIVA' : 'RETTIFICA_NEGATIVA'

      await tx.stockMovement.create({
        data: {
          code: movementCode,
          material_id: line.material_id,
          lot_id: line.lot_id ?? null,
          warehouse_id: inventory.warehouse_id,
          zone_id: line.zone_id ?? null,
          movement_type: movementType,
          reason,
          quantity: variance,
          actor: authResult.name,
          inventory_line_id: line.id,
          notes: `Rettifica inventario ${inventory.code}`,
        },
      })

      // Update lot quantity if lot specified
      if (line.lot_id) {
        await tx.stockLot.update({
          where: { id: line.lot_id },
          data: {
            current_quantity: {
              increment: variance,
            },
          },
        })
      }
    }

    // Close the inventory
    await tx.stockInventory.update({
      where: { id: inventoryId },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
        completed_by: authResult.name,
      },
    })
  })

  return successResponse({ id: inventoryId, status: 'COMPLETED' })
}
