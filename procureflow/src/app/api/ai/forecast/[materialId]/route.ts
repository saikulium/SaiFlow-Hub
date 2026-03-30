import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import {
  getBasicForecast,
  getAiForecast,
} from '@/server/services/forecast.service'
import { AI_FORECAST_RATE_LIMIT } from '@/lib/constants/forecast'

// Simple in-memory rate limiter for AI forecasts
const rateLimits = new Map<
  string,
  { count: number; windowStart: number }
>()

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
  const session = await auth()
  if (!session?.user) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const { materialId } = await params
  const forecast = await getBasicForecast(materialId)
  return successResponse(forecast)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  if (!checkRateLimit(session.user.id)) {
    return errorResponse(
      'RATE_LIMITED',
      `Max ${AI_FORECAST_RATE_LIMIT.maxPerUser} previsioni AI per ora`,
      429,
    )
  }

  const { materialId } = await params
  const forecast = await getAiForecast(materialId)
  return successResponse(forecast)
}
