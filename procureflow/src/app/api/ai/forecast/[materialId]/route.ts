import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import {
  getBasicForecast,
  getAiForecast,
  AI_FORECAST_RATE_LIMIT,
} from '@/modules/core/inventory'

// Simple in-memory rate limiter for AI forecasts
const rateLimits = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const windowMs = AI_FORECAST_RATE_LIMIT.windowHours * 60 * 60 * 1000
  const entry = rateLimits.get(userId)

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimits.set(userId, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= AI_FORECAST_RATE_LIMIT.maxPerUser) {
    return false
  }

  rateLimits.set(userId, { ...entry, count: entry.count + 1 })
  return true
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const { materialId } = await params
    const forecast = await getBasicForecast(materialId)
    return successResponse(forecast)
  } catch (error) {
    console.error('GET /api/ai/forecast/[materialId] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    if (!checkRateLimit(authResult.id)) {
      return errorResponse(
        'RATE_LIMITED',
        `Max ${AI_FORECAST_RATE_LIMIT.maxPerUser} previsioni AI per ora`,
        429,
      )
    }

    const { materialId } = await params
    const forecast = await getAiForecast(materialId)
    return successResponse(forecast)
  } catch (error) {
    console.error('POST /api/ai/forecast/[materialId] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
