import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import { getBasicForecast } from '@/server/services/forecast.service'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Inventory Tools — used by the smart reorder agent
// ---------------------------------------------------------------------------

export const getActiveAlertsTool = betaZodTool({
  name: 'get_active_alerts',
  description:
    'Lista materiali con alert attivi (low stock, out of stock, riordino suggerito). Ritorna alert non dismissati con dettagli materiale e fornitore suggerito.',
  inputSchema: z.object({}),
  run: async () => {
    const alerts = await prisma.materialAlert.findMany({
      where: { dismissed: false },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            code: true,
            min_stock_level: true,
            preferred_vendor_id: true,
          },
        },
        suggested_vendor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    const serialized = alerts.map((alert) => ({
      id: alert.id,
      material_id: alert.material_id,
      type: alert.type,
      suggested_qty: alert.suggested_qty,
      days_remaining: alert.days_remaining,
      material_name: alert.material.name,
      material_code: alert.material.code,
      min_stock_level: alert.material.min_stock_level
        ? Number(alert.material.min_stock_level)
        : null,
      preferred_vendor_id: alert.material.preferred_vendor_id,
      suggested_vendor_id: alert.suggested_vendor_id,
      suggested_vendor_name: alert.suggested_vendor?.name ?? null,
    }))

    return JSON.stringify({
      total: serialized.length,
      alerts: serialized,
    })
  },
})

export const getMaterialForecastTool = betaZodTool({
  name: 'get_material_forecast',
  description:
    'Ottieni previsione di consumo per un materiale specifico (WMA). Include stock attuale, proiezione 3 mesi, giorni rimanenti e se il riordino e necessario.',
  inputSchema: z.object({
    material_id: z.string().describe('ID del materiale'),
  }),
  run: async (input) => {
    try {
      const forecast = await getBasicForecast(input.material_id)
      return JSON.stringify(forecast)
    } catch (err) {
      return JSON.stringify({
        error: `Errore nel calcolo previsione: ${String(err)}`,
      })
    }
  },
})

export const getMaterialPriceHistoryTool = betaZodTool({
  name: 'get_material_price_history',
  description:
    'Ottieni lo storico prezzi di acquisto per un materiale. Cerca nelle richieste consegnate gli articoli con nome simile.',
  inputSchema: z.object({
    material_id: z.string().describe('ID del materiale'),
  }),
  run: async (input) => {
    const material = await prisma.material.findUnique({
      where: { id: input.material_id },
      select: { id: true, name: true, code: true },
    })

    if (!material) {
      return JSON.stringify({ error: 'Materiale non trovato' })
    }

    // Search for RequestItems with similar name from delivered orders
    const items = await prisma.requestItem.findMany({
      where: {
        name: { contains: material.name, mode: 'insensitive' },
        request: { status: 'DELIVERED' },
        unit_price: { not: null },
      },
      select: {
        name: true,
        quantity: true,
        unit: true,
        unit_price: true,
        total_price: true,
        request: {
          select: {
            code: true,
            delivered_at: true,
            vendor: { select: { name: true } },
          },
        },
      },
      orderBy: { request: { delivered_at: 'desc' } },
      take: 20,
    })

    const history = items.map((item) => ({
      request_code: item.request.code,
      vendor_name: item.request.vendor?.name ?? null,
      delivered_at: item.request.delivered_at?.toISOString() ?? null,
      item_name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price ? Number(item.unit_price) : null,
      total_price: item.total_price ? Number(item.total_price) : null,
    }))

    const prices = history
      .map((h) => h.unit_price)
      .filter((p): p is number => p !== null)

    const avgPrice =
      prices.length > 0
        ? Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100
        : null

    const lastPrice = prices.length > 0 ? prices[0] : null

    return JSON.stringify({
      material_id: material.id,
      material_name: material.name,
      material_code: material.code,
      total_records: history.length,
      avg_price: avgPrice,
      last_price: lastPrice,
      history,
    })
  },
})

// ---------------------------------------------------------------------------
// Exported collection
// ---------------------------------------------------------------------------

export const INVENTORY_TOOLS: readonly ZodTool[] = [
  getActiveAlertsTool,
  getMaterialForecastTool,
  getMaterialPriceHistoryTool,
] as readonly ZodTool[]
