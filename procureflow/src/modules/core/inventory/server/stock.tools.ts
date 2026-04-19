import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Stock Tools — stock availability & pending orders (READ)
// ---------------------------------------------------------------------------

export const getStockForArticleTool = betaZodTool({
  name: 'get_stock_for_article',
  description:
    'Stock disponibile per un articolo: somma lotti AVAILABLE + ordini in arrivo (PR ORDERED/SHIPPED/APPROVED con article_id corrispondente).',
  inputSchema: z
    .object({
      article_id: z.string().optional().describe('ID articolo'),
      material_id: z.string().optional().describe('ID materiale (alternativo)'),
    })
    .refine((d) => d.article_id || d.material_id, 'article_id o material_id richiesto'),
  run: async (input) => {
    let materialId: string | null = input.material_id ?? null
    let articleId: string | null = input.article_id ?? null

    // Resolve material from article_id
    if (articleId && !materialId) {
      const material = await prisma.material.findFirst({
        where: { article_id: articleId },
        select: { id: true },
      })
      if (material) {
        materialId = material.id
      }
    }

    // Resolve article from material_id
    if (materialId && !articleId) {
      const material = await prisma.material.findUnique({
        where: { id: materialId },
        select: { article_id: true },
      })
      if (material?.article_id) {
        articleId = material.article_id
      }
    }

    if (!materialId && !articleId) {
      return JSON.stringify({ error: 'Articolo o materiale non trovato' })
    }

    // Sum available stock from lots
    let availableQuantity = 0
    if (materialId) {
      const agg = await prisma.stockLot.aggregate({
        where: { material_id: materialId, status: 'AVAILABLE' },
        _sum: { current_quantity: true },
      })
      availableQuantity = Number(agg._sum.current_quantity ?? 0)
    }

    // Find pending orders via RequestItem.article_id
    let pendingOrders: Array<{ quantity: number; request_code: string; request_status: string }> = []
    let pendingQuantity = 0

    if (articleId) {
      const items = await prisma.requestItem.findMany({
        where: {
          article_id: articleId,
          request: { status: { in: ['APPROVED', 'ORDERED', 'SHIPPED'] } },
        },
        select: {
          quantity: true,
          request: { select: { code: true, status: true } },
        },
      })

      pendingOrders = items.map((item) => ({
        quantity: item.quantity,
        request_code: item.request.code,
        request_status: item.request.status,
      }))

      pendingQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    }

    return JSON.stringify({
      article_id: articleId,
      material_id: materialId,
      available_quantity: availableQuantity,
      pending_quantity: pendingQuantity,
      pending_orders: pendingOrders,
    })
  },
})

export const getPendingOrdersForMaterialTool = betaZodTool({
  name: 'get_pending_orders_for_material',
  description:
    'Ordini in arrivo per un materiale. Utile per evitare riordini doppi.',
  inputSchema: z.object({
    material_id: z.string().describe('ID del materiale'),
  }),
  run: async (input) => {
    const material = await prisma.material.findUnique({
      where: { id: input.material_id },
      select: { id: true, name: true, article_id: true },
    })

    if (!material) {
      return JSON.stringify({ error: 'Materiale non trovato' })
    }

    type PendingOrder = {
      quantity: number
      item_name: string
      request_code: string
      request_status: string
      vendor_name: string | null
      expected_delivery: string | null
    }

    let pendingOrders: PendingOrder[] = []

    if (material.article_id) {
      // Primary: find by article_id link
      const items = await prisma.requestItem.findMany({
        where: {
          article_id: material.article_id,
          request: { status: { in: ['APPROVED', 'ORDERED', 'SHIPPED'] } },
        },
        include: {
          request: {
            select: {
              code: true,
              status: true,
              vendor: { select: { name: true } },
              expected_delivery: true,
            },
          },
        },
      })

      pendingOrders = items.map((item) => ({
        quantity: item.quantity,
        item_name: item.name,
        request_code: item.request.code,
        request_status: item.request.status,
        vendor_name: item.request.vendor?.name ?? null,
        expected_delivery: item.request.expected_delivery?.toISOString() ?? null,
      }))
    } else {
      // Fallback: fuzzy search by material name
      const items = await prisma.requestItem.findMany({
        where: {
          name: { contains: material.name, mode: 'insensitive' },
          request: { status: { in: ['APPROVED', 'ORDERED', 'SHIPPED'] } },
        },
        include: {
          request: {
            select: {
              code: true,
              status: true,
              vendor: { select: { name: true } },
              expected_delivery: true,
            },
          },
        },
        take: 20,
      })

      pendingOrders = items.map((item) => ({
        quantity: item.quantity,
        item_name: item.name,
        request_code: item.request.code,
        request_status: item.request.status,
        vendor_name: item.request.vendor?.name ?? null,
        expected_delivery: item.request.expected_delivery?.toISOString() ?? null,
      }))
    }

    return JSON.stringify({
      material_id: material.id,
      material_name: material.name,
      pending_orders: pendingOrders,
    })
  },
})

// ---------------------------------------------------------------------------
// Exported collection
// ---------------------------------------------------------------------------

export const STOCK_TOOLS: readonly ZodTool[] = [
  getStockForArticleTool,
  getPendingOrdersForMaterialTool,
] as readonly ZodTool[]
