import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { updateClientSchema } from '@/lib/validations/client'
import { requireAuth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/clients')
  if (blocked) return blocked

  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        commesse: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            client_value: true,
            deadline: true,
          },
        },
        _count: {
          select: {
            commesse: {
              where: {
                status: { in: ['DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD'] },
              },
            },
          },
        },
      },
    })

    if (!client) return notFoundResponse('Cliente non trovato')

    const data = {
      id: client.id,
      code: client.code,
      name: client.name,
      tax_id: client.tax_id,
      email: client.email,
      phone: client.phone,
      contact_person: client.contact_person,
      address: client.address,
      notes: client.notes,
      status: client.status,
      created_at: client.created_at.toISOString(),
      activeCommesseCount: client._count.commesse,
      commesse: client.commesse.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        status: c.status,
        clientValue: c.client_value ? Number(c.client_value) : null,
        deadline: c.deadline?.toISOString() ?? null,
      })),
    }

    return successResponse(data)
  } catch (error) {
    console.error('GET /api/clients/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/clients')
  if (blocked) return blocked

  try {
    const body = await req.json()
    const parsed = updateClientSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.client.findUnique({
      where: { id: params.id },
    })

    if (!existing) return notFoundResponse('Cliente non trovato')

    const { email, ...rest } = parsed.data

    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(email !== undefined && { email: email || null }),
      },
    })

    return successResponse(client)
  } catch (error) {
    console.error('PATCH /api/clients/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento cliente', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/clients')
  if (blocked) return blocked

  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            commesse: {
              where: {
                status: { in: ['DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD'] },
              },
            },
          },
        },
      },
    })

    if (!client) return notFoundResponse('Cliente non trovato')

    if (client._count.commesse > 0) {
      return errorResponse(
        'HAS_ACTIVE_COMMESSE',
        'Impossibile disattivare: il cliente ha commesse attive',
        400,
      )
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: { status: 'INACTIVE' },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('DELETE /api/clients/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore disattivazione cliente', 500)
  }
}
