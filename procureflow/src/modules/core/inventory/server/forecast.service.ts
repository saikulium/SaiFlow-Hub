// ---------------------------------------------------------------------------
// Inventory Forecast Service — WMA-based forecasting + reorder alerts
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db'
import { callClaude, extractJsonFromAiResponse } from '@/lib/ai/claude-client'
import { FORECAST_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import {
  WMA_WEIGHTS,
  WMA_MONTHS,
  FORECAST_MONTHS_AHEAD,
} from '../constants/forecast'
import type { BasicForecast, AiForecast, CheckReorderResult } from '@/types/ai'

// ---------------------------------------------------------------------------
// Pure function: Weighted Moving Average
// ---------------------------------------------------------------------------

export function computeWMA(monthlyConsumption: readonly number[]): number {
  const totalWeight = WMA_WEIGHTS.reduce((sum, w) => sum + w, 0)
  if (totalWeight === 0) return 0

  // Pad to WMA_MONTHS length with zeros
  const padded: number[] = Array.from({ length: WMA_MONTHS }, (_, i) =>
    i < monthlyConsumption.length ? monthlyConsumption[i]! : 0,
  )

  let weightedSum = 0
  for (let i = 0; i < padded.length; i++) {
    weightedSum += padded[i]! * WMA_WEIGHTS[i]!
  }

  return weightedSum / totalWeight
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(decimal: { toNumber(): number } | null): number {
  return decimal ? decimal.toNumber() : 0
}

async function getCurrentStock(materialId: string): Promise<number> {
  const result = await prisma.stockLot.aggregate({
    where: { material_id: materialId, status: 'AVAILABLE' },
    _sum: { current_quantity: true },
  })
  return toNumber(result._sum.current_quantity)
}

async function getMonthlyOutbound(materialId: string): Promise<number[]> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - WMA_MONTHS)

  const rows = await prisma.$queryRaw<
    ReadonlyArray<{ month: string; total: number }>
  >`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') AS month,
      ABS(SUM(quantity))::float AS total
    FROM "stock_movements"
    WHERE material_id = ${materialId}
      AND movement_type = 'OUTBOUND'
      AND created_at >= ${sixMonthsAgo}
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month DESC
  `

  return rows.map((r) => Number(r.total))
}

// ---------------------------------------------------------------------------
// Basic Forecast
// ---------------------------------------------------------------------------

export async function getBasicForecast(
  materialId: string,
): Promise<BasicForecast> {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true, name: true, min_stock_level: true },
  })

  if (!material) {
    throw new Error('Material not found')
  }

  const [currentStock, monthlyValues] = await Promise.all([
    getCurrentStock(materialId),
    getMonthlyOutbound(materialId),
  ])
  const monthlyRate = computeWMA(monthlyValues)

  const projected = Array.from(
    { length: FORECAST_MONTHS_AHEAD },
    () => Math.round(monthlyRate * 100) / 100,
  )

  const daysRemaining =
    monthlyRate > 0 ? Math.round((currentStock / monthlyRate) * 30) : Infinity

  const minStock = toNumber(material.min_stock_level)
  const reorderNeeded = currentStock <= minStock || daysRemaining <= 30

  return Object.freeze({
    materialId: material.id,
    materialName: material.name,
    currentStock,
    projected,
    daysRemaining,
    reorderNeeded,
  })
}

// ---------------------------------------------------------------------------
// AI-Enhanced Forecast
// ---------------------------------------------------------------------------

interface AiResponsePayload {
  readonly projected: readonly number[]
  readonly confidence: number
  readonly reasoning: string
  readonly risks: readonly string[]
}

function parseAiResponse(text: string): AiResponsePayload | null {
  try {
    const cleaned = extractJsonFromAiResponse(text)
    const parsed = JSON.parse(cleaned) as AiResponsePayload
    if (
      Array.isArray(parsed.projected) &&
      typeof parsed.confidence === 'number' &&
      typeof parsed.reasoning === 'string' &&
      Array.isArray(parsed.risks)
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export async function getAiForecast(materialId: string): Promise<AiForecast> {
  const basic = await getBasicForecast(materialId)

  try {
    const prompt = [
      `Materiale: ${basic.materialName}`,
      `Stock attuale: ${basic.currentStock}`,
      `Consumo WMA mensile: ${basic.projected[0]}`,
      `Giorni rimanenti: ${basic.daysRemaining}`,
      `Proiezione base (3 mesi): ${basic.projected.join(', ')}`,
    ].join('\n')

    const response = await callClaude({
      system: FORECAST_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 512,
    })

    const textBlock = response.content.find(
      (block: { type: string }) => block.type === 'text',
    )
    const aiText =
      textBlock && 'text' in textBlock
        ? (textBlock as { type: 'text'; text: string }).text
        : ''

    const aiData = parseAiResponse(aiText)

    if (aiData) {
      return Object.freeze({
        ...basic,
        aiProjected: aiData.projected,
        confidence: aiData.confidence,
        reasoning: aiData.reasoning,
        risks: aiData.risks,
      })
    }

    // AI returned invalid JSON — fall back
    return Object.freeze({
      ...basic,
      aiProjected: basic.projected,
      confidence: 0,
      reasoning: 'AI non disponibile: risposta non valida',
      risks: [],
    })
  } catch (error) {
    console.error('[forecast] AI forecast failed:', error)
    return Object.freeze({
      ...basic,
      aiProjected: basic.projected,
      confidence: 0,
      reasoning: 'AI non disponibile: errore nella chiamata',
      risks: [],
    })
  }
}

// ---------------------------------------------------------------------------
// Reorder Alerts
// ---------------------------------------------------------------------------

function determineAlertType(
  currentStock: number,
  minStock: number,
): 'OUT_OF_STOCK' | 'LOW_STOCK' | 'REORDER_SUGGESTED' {
  if (currentStock <= 0) return 'OUT_OF_STOCK'
  if (currentStock <= minStock * 0.5) return 'LOW_STOCK'
  return 'REORDER_SUGGESTED'
}

export async function checkReorderAlerts(): Promise<CheckReorderResult> {
  const materials = await prisma.material.findMany({
    where: {
      is_active: true,
      min_stock_level: { not: null },
    },
    select: {
      id: true,
      name: true,
      code: true,
      min_stock_level: true,
      preferred_vendor_id: true,
    },
  })

  let alertsCreated = 0
  let alertsResolved = 0

  for (const material of materials) {
    const currentStock = await getCurrentStock(material.id)
    const minStock = toNumber(material.min_stock_level)

    if (currentStock <= minStock) {
      // Check if an active alert already exists
      const existingAlert = await prisma.materialAlert.findFirst({
        where: { material_id: material.id, dismissed: false },
      })

      if (!existingAlert) {
        const alertType = determineAlertType(currentStock, minStock)
        const suggestedQty = Math.ceil(minStock - currentStock + minStock * 0.5)

        await prisma.materialAlert.create({
          data: {
            material_id: material.id,
            type: alertType,
            suggested_qty: suggestedQty,
            suggested_vendor_id: material.preferred_vendor_id,
            days_remaining:
              currentStock > 0 ? Math.round((currentStock / minStock) * 30) : 0,
          },
        })
        alertsCreated++
      }
    } else {
      // Stock recovered — resolve any active alerts
      const resolved = await prisma.materialAlert.updateMany({
        where: { material_id: material.id, dismissed: false },
        data: { dismissed: true },
      })
      alertsResolved += resolved.count
    }
  }

  return Object.freeze({
    alerts_created: alertsCreated,
    alerts_resolved: alertsResolved,
  })
}

// ---------------------------------------------------------------------------
// Alert Management
// ---------------------------------------------------------------------------

export async function getActiveAlerts() {
  return prisma.materialAlert.findMany({
    where: { dismissed: false },
    include: {
      material: { select: { name: true, code: true } },
      suggested_vendor: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
  })
}

export async function dismissAlert(id: string): Promise<void> {
  await prisma.materialAlert.updateMany({
    where: { id },
    data: { dismissed: true },
  })
}

export async function resolveAlert(
  id: string,
  requestId: string,
): Promise<void> {
  await prisma.materialAlert.updateMany({
    where: { id },
    data: { resolved_by: requestId, dismissed: true },
  })
}
