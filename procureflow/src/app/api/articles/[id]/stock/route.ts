import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { getStockLevels } from '@/server/services/inventory-db.service'
import {
  recordInboundMovement,
  recordOutboundMovement,
} from '@/server/services/inventory-db.service'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// GET /api/articles/[id]/stock — Stock levels for an article's linked material
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked

  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        unit_of_measure: true,
        materials: {
          where: { is_active: true },
          select: { id: true, code: true, name: true },
          take: 1,
        },
      },
    })

    if (!article) return notFoundResponse('Articolo non trovato')

    const material = article.materials[0]
    if (!material) {
      return successResponse({
        hasInventory: false as const,
        materialId: null,
        materialCode: null,
        physical: 0,
        reserved: 0,
        available: 0,
        status: 'NONE' as const,
        unit: article.unit_of_measure,
        byWarehouse: [],
        lastMovement: null,
      })
    }

    const [stockLevels, lastMovement] = await Promise.all([
      getStockLevels(material.id),
      prisma.stockMovement.findFirst({
        where: { material_id: material.id },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          code: true,
          movement_type: true,
          reason: true,
          quantity: true,
          notes: true,
          actor: true,
          created_at: true,
        },
      }),
    ])

    return successResponse({
      hasInventory: true as const,
      materialId: material.id,
      materialCode: material.code,
      physical: stockLevels.physical,
      reserved: stockLevels.reserved,
      available: stockLevels.available,
      status: stockLevels.status,
      unit: article.unit_of_measure,
      byWarehouse: stockLevels.byWarehouse,
      lastMovement: lastMovement
        ? {
            id: lastMovement.id,
            code: lastMovement.code,
            type: lastMovement.movement_type,
            reason: lastMovement.reason,
            quantity: Number(lastMovement.quantity),
            notes: lastMovement.notes,
            actor: lastMovement.actor,
            date: lastMovement.created_at.toISOString(),
          }
        : null,
    })
  } catch (error) {
    console.error('GET /api/articles/[id]/stock error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

// ---------------------------------------------------------------------------
// POST /api/articles/[id]/stock — Quick stock movement (Carico/Scarico)
// ---------------------------------------------------------------------------

const stockMovementSchema = z.object({
  type: z.enum(['INBOUND', 'OUTBOUND']),
  quantity: z.number().positive('La quantità deve essere positiva'),
  unit_cost: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked

  try {
    const body = await req.json()
    const parsed = stockMovementSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { type, quantity, unit_cost, notes } = parsed.data

    // Find the article's linked material
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        unit_of_measure: true,
        materials: {
          where: { is_active: true },
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!article) return notFoundResponse('Articolo non trovato')

    let materialId = article.materials[0]?.id

    // Auto-create material if none exists (activate inventory on the fly)
    if (!materialId) {
      const mat = await prisma.$transaction(async (tx) => {
        const matCode = await generateNextCodeAtomic('MAT', 'materials', tx)
        return tx.material.create({
          data: {
            code: matCode,
            name: article.name,
            unit_primary: article.unit_of_measure,
            article_id: article.id,
          },
        })
      })
      materialId = mat.id
    }

    // Auto-select the first active warehouse (PMI simplification)
    const warehouse = await prisma.warehouse.findFirst({
      where: { is_active: true },
      orderBy: { name: 'asc' },
      select: { id: true },
    })

    if (!warehouse) {
      return errorResponse(
        'NO_WAREHOUSE',
        'Nessun magazzino attivo trovato. Crea un magazzino prima di registrare movimenti.',
        400,
      )
    }

    if (type === 'INBOUND') {
      const result = await recordInboundMovement({
        material_id: materialId,
        warehouse_id: warehouse.id,
        quantity,
        unit_cost: unit_cost ?? 0,
        reason: 'ACQUISTO',
        notes: notes ?? undefined,
      })

      return successResponse({
        movement: result.movement,
        lot: result.lot,
      })
    }

    // OUTBOUND: auto-select the first available lot with sufficient quantity
    const availableLot = await prisma.stockLot.findFirst({
      where: {
        material_id: materialId,
        status: 'AVAILABLE',
        current_quantity: { gte: quantity },
      },
      orderBy: { created_at: 'asc' }, // FIFO
      select: { id: true, warehouse_id: true },
    })

    if (!availableLot) {
      return errorResponse(
        'INSUFFICIENT_STOCK',
        `Quantità insufficiente a magazzino. Richieste ${quantity} unità.`,
        400,
      )
    }

    const result = await recordOutboundMovement({
      material_id: materialId,
      lot_id: availableLot.id,
      warehouse_id: availableLot.warehouse_id,
      quantity,
      reason: 'VENDITA',
      notes: notes ?? undefined,
    })

    return successResponse({ movement: result.movement })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Errore nel movimento'
    console.error('POST /api/articles/[id]/stock error:', error)
    return errorResponse('INTERNAL_ERROR', message, 500)
  }
}
