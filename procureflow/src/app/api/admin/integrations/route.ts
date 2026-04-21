import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { successResponse, errorResponse } from '@/lib/api-response'

const SENSITIVE_KEYS = ['password', 'api_key', 'certificate_password'] as const

function maskSensitiveFields(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (
      (SENSITIVE_KEYS as readonly string[]).includes(key) &&
      typeof value === 'string' &&
      value.length > 0
    ) {
      masked[key] = '****'
    } else {
      masked[key] = value
    }
  }
  return Object.freeze(masked)
}

export async function GET() {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const integrations = await prisma.integrationConfig.findMany({
      orderBy: { created_at: 'asc' },
    })

    const result = integrations.map((integration) => {
      let decryptedConfig: Record<string, unknown> = {}
      try {
        decryptedConfig = JSON.parse(decrypt(integration.config)) as Record<
          string,
          unknown
        >
      } catch {
        decryptedConfig = {}
      }

      return Object.freeze({
        id: integration.id,
        type: integration.type,
        label: integration.label,
        enabled: integration.enabled,
        config: maskSensitiveFields(decryptedConfig),
        status: integration.status,
        last_sync_at: integration.last_sync_at,
        last_error: integration.last_error,
        created_at: integration.created_at,
        updated_at: integration.updated_at,
      })
    })

    return successResponse(result)
  } catch (error) {
    console.error('GET /api/admin/integrations error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore caricamento integrazioni', 500)
  }
}
