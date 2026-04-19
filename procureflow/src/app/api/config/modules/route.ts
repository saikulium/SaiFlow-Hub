import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getEnabledModules, getRuntimeConfig } from '@/config/runtime'

/**
 * Ritorna la configurazione di moduli (pack-level) per l'istanza corrente,
 * letta da `ENABLED_MODULES` / `CUSTOMER_CODE`.
 *
 * Serve al client per capire quali moduli sono disponibili a livello di
 * *pack commerciale* (il gate DB-based resta gestito da `/api/deploy-config`).
 */
export async function GET() {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const config = getRuntimeConfig()
    return successResponse({
      customerCode: config.customerCode,
      primaryPack: config.primaryPack,
      enabledModules: getEnabledModules(),
    })
  } catch (error) {
    console.error('[config/modules] GET error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore nel recupero configurazione moduli',
      500,
    )
  }
}
