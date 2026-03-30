import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import {
  integrationTypeSchema,
  upsertIntegrationSchema,
} from '@/lib/validations/admin'

interface RouteParams {
  params: Promise<{ type: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { type } = await params

  const typeParsed = integrationTypeSchema.safeParse(type)
  if (!typeParsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Tipo integrazione non valido: ${type}. Valori ammessi: imap, sdi, vendor_api`,
        },
      },
      { status: 400 },
    )
  }

  const body = await request.json()
  const parsed = upsertIntegrationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        },
      },
      { status: 400 },
    )
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

  return NextResponse.json({
    success: true,
    data: Object.freeze({
      id: integration.id,
      type: integration.type,
      label: integration.label,
      enabled: integration.enabled,
      status: integration.status,
      created_at: integration.created_at,
      updated_at: integration.updated_at,
    }),
  })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { type } = await params

  const typeParsed = integrationTypeSchema.safeParse(type)
  if (!typeParsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Tipo integrazione non valido: ${type}`,
        },
      },
      { status: 400 },
    )
  }

  const existing = await prisma.integrationConfig.findUnique({
    where: { type: typeParsed.data },
  })

  if (!existing) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Integrazione "${type}" non trovata`,
        },
      },
      { status: 404 },
    )
  }

  await prisma.integrationConfig.delete({
    where: { type: typeParsed.data },
  })

  return NextResponse.json({ success: true, data: null })
}
