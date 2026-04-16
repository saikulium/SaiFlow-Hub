import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import { getBasicForecast } from '@/server/services/forecast.service'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
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
        ? Math.round(
            (prices.reduce((s, p) => s + p, 0) / prices.length) * 100,
          ) / 100
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
// WRITE-direct tools (agent-only, not chat-intercepted)
// ---------------------------------------------------------------------------

export const createMaterialTool = betaZodTool({
  name: 'create_material',
  description:
    'Crea un nuovo materiale con codice MAT-YYYY-NNNNN auto-generato. Opzionalmente collega a un articolo.',
  inputSchema: z.object({
    name: z.string().describe('Nome del materiale'),
    category: z.string().optional().describe('Categoria merceologica'),
    unit_primary: z
      .string()
      .default('pz')
      .describe('Unita misura primaria (pz, kg, m, etc.)'),
    article_id: z.string().optional().describe('ID articolo da collegare'),
    min_stock_level: z.number().optional().describe('Livello minimo di stock'),
    max_stock_level: z.number().optional().describe('Livello massimo di stock'),
    preferred_vendor_id: z
      .string()
      .optional()
      .describe('ID fornitore preferito'),
    notes: z.string().optional().describe('Note aggiuntive'),
  }),
  run: async (input) => {
    try {
      const code = await generateNextCodeAtomic('MAT', 'materials')
      const material = await prisma.material.create({
        data: {
          code,
          name: input.name,
          category: input.category,
          unit_primary: input.unit_primary,
          article_id: input.article_id,
          min_stock_level: input.min_stock_level,
          max_stock_level: input.max_stock_level,
          preferred_vendor_id: input.preferred_vendor_id,
          notes: input.notes,
        },
      })
      return JSON.stringify({
        success: true,
        id: material.id,
        code: material.code,
        name: material.name,
      })
    } catch (err) {
      return JSON.stringify({
        error: `Errore creazione materiale: ${String(err)}`,
      })
    }
  },
})

export const updateMaterialStockLevelsTool = betaZodTool({
  name: 'update_material_stock_levels',
  description:
    'Aggiorna le soglie di stock di un materiale (min, max). Influenza gli alert di riordino.',
  inputSchema: z
    .object({
      material_id: z.string().describe('ID del materiale'),
      min_stock_level: z.number().optional().describe('Nuovo livello minimo'),
      max_stock_level: z.number().optional().describe('Nuovo livello massimo'),
    })
    .refine(
      (d) => d.min_stock_level !== undefined || d.max_stock_level !== undefined,
      'Almeno un livello richiesto',
    ),
  run: async (input) => {
    try {
      const data: Record<string, unknown> = {}
      if (input.min_stock_level !== undefined)
        data.min_stock_level = input.min_stock_level
      if (input.max_stock_level !== undefined)
        data.max_stock_level = input.max_stock_level

      await prisma.material.update({
        where: { id: input.material_id },
        data,
      })

      return JSON.stringify({
        success: true,
        material_id: input.material_id,
        min_stock_level: input.min_stock_level ?? null,
        max_stock_level: input.max_stock_level ?? null,
      })
    } catch (err) {
      return JSON.stringify({
        error: `Errore aggiornamento soglie: ${String(err)}`,
      })
    }
  },
})

export const setPreferredVendorTool = betaZodTool({
  name: 'set_preferred_vendor',
  description: 'Imposta il fornitore preferito per un materiale.',
  inputSchema: z.object({
    material_id: z.string().describe('ID del materiale'),
    vendor_id: z.string().describe('ID del fornitore'),
  }),
  run: async (input) => {
    try {
      // Verify vendor exists
      const vendor = await prisma.vendor.findUnique({
        where: { id: input.vendor_id },
        select: { id: true, name: true },
      })
      if (!vendor) {
        return JSON.stringify({ error: 'Fornitore non trovato' })
      }

      await prisma.material.update({
        where: { id: input.material_id },
        data: { preferred_vendor_id: input.vendor_id },
      })

      return JSON.stringify({
        success: true,
        material_id: input.material_id,
        vendor_id: input.vendor_id,
      })
    } catch (err) {
      return JSON.stringify({
        error: `Errore impostazione fornitore: ${String(err)}`,
      })
    }
  },
})

// ---------------------------------------------------------------------------
// Exported collection
// ---------------------------------------------------------------------------

export const INVENTORY_TOOLS: readonly ZodTool[] = [
  getActiveAlertsTool,
  getMaterialForecastTool,
  getMaterialPriceHistoryTool,
  createMaterialTool,
  updateMaterialStockLevelsTool,
  setPreferredVendorTool,
] as readonly ZodTool[]
