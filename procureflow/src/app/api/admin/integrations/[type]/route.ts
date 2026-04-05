import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import {
  integrationTypeSchema,
  upsertIntegrationSchema,
} from '@/lib/validations/admin'

interface RouteParams {
  params: Promise<{ type: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const { type } = await params

    const typeParsed = integrationTypeSchema.safeParse(type)
    if (!typeParsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Tipo integrazione non valido: ${type}. Valori ammessi: imap, sdi, vendor_api`,
        400,
      )
    }

    const body = await request.json()
    const parsed = upsertIntegrationSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const encryptedConfig = encrypt(JSON.stringify(parsed.data.config))

    const integration = await prisma.integrationConfig.upsert({
      where: { type: typeParsed.data },
      update: {
        label: parsed.data.label,
        enabled: parsed.data.enabled,
        config: encryptedConfig,
      },
      create: {
        type: typeParsed.data,
        label: parsed.data.label,
        enabled: parsed.data.enabled,
        config: encryptedConfig,
      },
    })

    return successResponse(Object.freeze({
      id: integration.id,
      type: integration.type,
      label: integration.label,
      enabled: integration.enabled,
      status: integration.status,
      created_at: integration.created_at,
      updated_at: integration.updated_at,
    }))
  } catch (error) {
    console.error('PUT /api/admin/integrations/[type] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore salvataggio integrazione', 500)
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const { type } = await params

    const typeParsed = integrationTypeSchema.safeParse(type)
    if (!typeParsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        `Tipo integrazione non valido: ${type}`,
        400,
      )
    }

    const existing = await prisma.integrationConfig.findUnique({
      where: { type: typeParsed.data },
    })

    if (!existing) {
      return errorResponse('NOT_FOUND', `Integrazione "${type}" non trovata`, 404)
    }

    await prisma.integrationConfig.delete({
      where: { type: typeParsed.data },
    })

    return successResponse(null)
  } catch (error) {
    console.error('DELETE /api/admin/integrations/[type] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione integrazione', 500)
  }
}
