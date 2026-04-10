import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import {
  createRequestSchema,
  requestQuerySchema,
} from '@/lib/validations/request'
import { Prisma } from '@prisma/client'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = requestQuerySchema.safeParse(params)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { page, pageSize, status, priority, vendor_id, search, sort, order } =
      parsed.data

    const where: Prisma.PurchaseRequestWhereInput = {}

    if (status) {
      const statuses = status.split(',')
      where.status = { in: statuses as Prisma.EnumRequestStatusFilter['in'] }
    }
    if (priority) {
      where.priority = {
        in: priority.split(',') as Prisma.EnumPriorityFilter['in'],
      }
    }
    if (vendor_id) {
      where.vendor_id = vendor_id
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const requests = await prisma.purchaseRequest.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        requester: { select: { id: true, name: true } },
        _count: { select: { items: true, comments: true } },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    const total = await prisma.purchaseRequest.count({ where })

    const data = requests.map((r) => ({
      ...r,
      estimated_amount: r.estimated_amount ? Number(r.estimated_amount) : null,
      actual_amount: r.actual_amount ? Number(r.actual_amount) : null,
    }))

    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/requests error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await req.json()
    const parsed = createRequestSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { items, ...data } = parsed.data

    // Genera codice atomico (previene duplicati sotto concorrenza)
    const code = await generateNextCodeAtomic()

    const requesterId = authResult.id

    const request = await prisma.purchaseRequest.create({
      data: {
        code,
        title: data.title,
        description: data.description,
        priority: data.priority,
        vendor_id: data.vendor_id || null,
        commessa_id: data.commessa_id || null,
        estimated_amount: data.estimated_amount
          ? new Prisma.Decimal(data.estimated_amount)
          : null,
        needed_by: data.needed_by ? new Date(data.needed_by) : null,
        category: data.category,
        department: data.department,
        cost_center: data.cost_center,
        budget_code: data.budget_code,
        cig: data.cig || null,
        cup: data.cup || null,
        is_mepa: data.is_mepa ?? false,
        mepa_oda_number: data.mepa_oda_number || null,
        tags: data.tags,
        requester_id: requesterId,
        items: {
          create: items.map((item) => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price
              ? new Prisma.Decimal(item.unit_price)
              : null,
            total_price: item.total_price
              ? new Prisma.Decimal(item.total_price)
              : null,
            sku: item.sku,
          })),
        },
        timeline: {
          create: {
            type: 'created',
            title: 'Richiesta creata',
            description: 'La richiesta è stata creata',
            actor: authResult.name,
          },
        },
      },
      include: {
        vendor: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        commessa: { select: { id: true, code: true, title: true } },
        items: true,
      },
    })

    return successResponse(request)
  } catch (error) {
    console.error('POST /api/requests error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nella creazione', 500)
  }
}
