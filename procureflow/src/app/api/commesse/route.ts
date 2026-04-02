import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { createCommessaSchema } from '@/lib/validations/commesse'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import { computeMargin } from '@/server/services/commessa.service'
import { Prisma, type CommessaStatus } from '@prisma/client'
import type { CommessaListItem } from '@/types'

type SortField = 'created_at' | 'deadline'
const VALID_SORT_FIELDS: readonly string[] = ['created_at', 'deadline']

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/commesse')
  if (blocked) return blocked

  try {
    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const clientId = searchParams.get('client_id') || undefined
    const cursor = searchParams.get('cursor') || undefined
    const limit = Math.min(Number(searchParams.get('limit')) || 25, 100)
    const sortBy = searchParams.get('sort') || 'created_at'
    const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

    const sortField: SortField = VALID_SORT_FIELDS.includes(sortBy)
      ? (sortBy as SortField)
      : 'created_at'

    const where: Prisma.CommessaWhereInput = {
      ...(status && {
        status: {
          equals: status as CommessaStatus,
        },
      }),
      ...(clientId && { client_id: clientId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
          {
            client: {
              name: { contains: search, mode: 'insensitive' as const },
            },
          },
        ],
      }),
    }

    const commesse = await prisma.commessa.findMany({
      where,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { [sortField]: sortDir },
      include: {
        client: { select: { name: true, code: true } },
        requests: {
          select: {
            estimated_amount: true,
            actual_amount: true,
            is_ai_suggested: true,
          },
        },
      },
    })

    const hasMore = commesse.length > limit
    const items = hasMore ? commesse.slice(0, limit) : commesse
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    const data: CommessaListItem[] = items.map((c) => {
      const confirmed = c.requests.filter((r) => !r.is_ai_suggested)
      const suggestions = c.requests.filter((r) => r.is_ai_suggested)

      const totalActual = confirmed.reduce(
        (sum, r) => sum + (r.actual_amount ? Number(r.actual_amount) : 0),
        0,
      )
      const totalEstimated = confirmed.reduce(
        (sum, r) => sum + (r.estimated_amount ? Number(r.estimated_amount) : 0),
        0,
      )

      const { margin, marginPercent } = computeMargin(
        c.client_value,
        totalActual > 0 ? new Prisma.Decimal(totalActual) : null,
        totalEstimated > 0 ? new Prisma.Decimal(totalEstimated) : null,
      )

      return {
        id: c.id,
        code: c.code,
        title: c.title,
        status: c.status,
        clientName: c.client.name,
        clientCode: c.client.code,
        clientValue: c.client_value ? Number(c.client_value) : null,
        totalCosts: totalActual > 0 ? totalActual : totalEstimated,
        margin,
        marginPercent,
        deadline: c.deadline?.toISOString() ?? null,
        priority: c.priority,
        requestsCount: confirmed.length,
        suggestionsCount: suggestions.length,
        createdAt: c.created_at.toISOString(),
      }
    })

    return successResponse({ items: data, nextCursor })
  } catch (error) {
    console.error('GET /api/commesse error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/commesse')
  if (blocked) return blocked

  try {
    const body = await req.json()
    const parsed = createCommessaSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { client_id, client_value, deadline, ...rest } = parsed.data

    const commessa = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: client_id },
        select: { id: true, status: true },
      })

      if (!client) {
        throw new ClientNotFoundError()
      }

      if (client.status !== 'ACTIVE') {
        throw new ClientInactiveError()
      }

      const code = await generateNextCodeAtomic('COM', 'commesse', tx)

      const created = await tx.commessa.create({
        data: {
          ...rest,
          code,
          client_id,
          client_value: client_value != null ? new Prisma.Decimal(client_value) : null,
          deadline: deadline ? new Date(deadline) : null,
        },
      })

      await tx.commessaTimeline.create({
        data: {
          commessa_id: created.id,
          type: 'created',
          title: 'Commessa creata',
          metadata: { code },
        },
      })

      return created
    })

    return successResponse(commessa)
  } catch (error) {
    if (error instanceof ClientNotFoundError) {
      return errorResponse('CLIENT_NOT_FOUND', 'Cliente non trovato', 404)
    }
    if (error instanceof ClientInactiveError) {
      return errorResponse('CLIENT_INACTIVE', 'Il cliente non è attivo', 400)
    }
    console.error('POST /api/commesse error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore creazione commessa', 500)
  }
}

class ClientNotFoundError extends Error {
  constructor() {
    super('Client not found')
    this.name = 'ClientNotFoundError'
  }
}

class ClientInactiveError extends Error {
  constructor() {
    super('Client is inactive')
    this.name = 'ClientInactiveError'
  }
}
