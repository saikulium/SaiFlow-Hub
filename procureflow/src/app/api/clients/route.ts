import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { createClientSchema } from '@/lib/validations/client'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/clients')
  if (blocked) return blocked

  try {
    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const cursor = searchParams.get('cursor') || undefined
    const limit = Math.min(Number(searchParams.get('limit')) || 25, 100)

    const where: Prisma.ClientWhereInput = {
      ...(status && {
        status: {
          equals: status as 'ACTIVE' | 'INACTIVE' | 'PENDING_REVIEW',
        },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          { tax_id: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const clients = await prisma.client.findMany({
      where,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { name: 'asc' },
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

    const hasMore = clients.length > limit
    const items = hasMore ? clients.slice(0, limit) : clients
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    const data = items.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      tax_id: c.tax_id,
      email: c.email,
      phone: c.phone,
      contact_person: c.contact_person,
      status: c.status,
      activeCommesseCount: c._count.commesse,
    }))

    return successResponse({ items: data, nextCursor })
  } catch (error) {
    console.error('GET /api/clients error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/clients')
  if (blocked) return blocked

  try {
    const body = await req.json()
    const parsed = createClientSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { code: providedCode, email, ...rest } = parsed.data

    const client = await prisma.$transaction(async (tx) => {
      const code = providedCode ?? await generateNextCodeAtomic('CLI', 'clients', tx, true)

      const existing = await tx.client.findUnique({ where: { code } })
      if (existing) {
        throw new DuplicateCodeError(code)
      }

      return tx.client.create({
        data: {
          ...rest,
          code,
          email: email || null,
        },
      })
    })

    return successResponse(client)
  } catch (error) {
    if (error instanceof DuplicateCodeError) {
      return errorResponse('DUPLICATE_CODE', `Codice cliente "${error.code}" già esistente`, 409)
    }
    console.error('POST /api/clients error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore creazione cliente', 500)
  }
}

class DuplicateCodeError extends Error {
  readonly code: string
  constructor(code: string) {
    super(`Duplicate client code: ${code}`)
    this.name = 'DuplicateCodeError'
    this.code = code
  }
}
