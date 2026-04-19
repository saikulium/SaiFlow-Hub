import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { assertModuleEnabled } from '@/lib/module-guard'
import {
  createTenderSchema,
  tenderQuerySchema,
} from '@/lib/validations/tenders'
import { getNextTenderCode } from '@/server/services/tenders.service'
import type { TenderListItem } from '@/types'

export async function GET(req: NextRequest) {
  const packGate = assertModuleEnabled('tenders')
  if (packGate) return packGate
  const blocked = await requireModule('/api/tenders')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER', 'REQUESTER')
    if (authResult instanceof NextResponse) return authResult

    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = tenderQuerySchema.safeParse(params)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const {
      page,
      pageSize,
      search,
      status,
      tender_type,
      assigned_to,
      contracting_authority_id,
      deadline_from,
      deadline_to,
    } = parsed.data

    // Build where clause
    const where: Record<string, unknown> = {}

    if (status) {
      const statuses = status.split(',').map((s) => s.trim())
      where.status = { in: statuses }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { cig: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (tender_type) {
      where.tender_type = tender_type
    }

    if (assigned_to) {
      where.assigned_to_id = assigned_to
    }

    if (contracting_authority_id) {
      where.contracting_authority_id = contracting_authority_id
    }

    if (deadline_from || deadline_to) {
      const deadlineFilter: Record<string, Date> = {}
      if (deadline_from) deadlineFilter.gte = new Date(deadline_from)
      if (deadline_to) deadlineFilter.lte = new Date(deadline_to)
      where.submission_deadline = deadlineFilter
    }

    const [tenders, total] = await Promise.all([
      prisma.tender.findMany({
        where,
        include: {
          contracting_authority: { select: { name: true } },
          assigned_to: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tender.count({ where }),
    ])

    const data: TenderListItem[] = tenders.map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      status: t.status,
      tenderType: t.tender_type,
      contractingAuthority: t.contracting_authority?.name ?? null,
      cig: t.cig,
      baseAmount: t.base_amount ? Number(t.base_amount) : null,
      ourOfferAmount: t.our_offer_amount ? Number(t.our_offer_amount) : null,
      submissionDeadline: t.submission_deadline?.toISOString() ?? null,
      goNoGo: t.go_no_go,
      goNoGoScore: t.go_no_go_score,
      assignedTo: t.assigned_to?.name ?? null,
      category: t.category,
      createdAt: t.created_at.toISOString(),
    }))

    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/tenders error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero gare', 500)
  }
}

export async function POST(req: NextRequest) {
  const packGate = assertModuleEnabled('tenders')
  if (packGate) return packGate
  const blocked = await requireModule('/api/tenders')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createTenderSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const code = await getNextTenderCode()

    const tender = await prisma.tender.create({
      data: {
        code,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        tender_type: parsed.data.tender_type as never,
        contracting_authority_id: parsed.data.contracting_authority_id ?? null,
        cig: parsed.data.cig ?? null,
        cup: parsed.data.cup ?? null,
        gara_number: parsed.data.gara_number ?? null,
        lotto_number: parsed.data.lotto_number ?? null,
        platform_url: parsed.data.platform_url || null,
        anac_id: parsed.data.anac_id ?? null,
        base_amount: parsed.data.base_amount ?? null,
        publication_date: parsed.data.publication_date
          ? new Date(parsed.data.publication_date)
          : null,
        question_deadline: parsed.data.question_deadline
          ? new Date(parsed.data.question_deadline)
          : null,
        submission_deadline: parsed.data.submission_deadline
          ? new Date(parsed.data.submission_deadline)
          : null,
        opening_date: parsed.data.opening_date
          ? new Date(parsed.data.opening_date)
          : null,
        award_criteria: parsed.data.award_criteria ?? null,
        technical_weight: parsed.data.technical_weight ?? null,
        economic_weight: parsed.data.economic_weight ?? null,
        category: parsed.data.category ?? null,
        department: parsed.data.department ?? null,
        cost_center: parsed.data.cost_center ?? null,
        tags: parsed.data.tags ?? [],
        assigned_to_id: parsed.data.assigned_to_id ?? null,
        notes: parsed.data.notes ?? null,
        created_by_id: authResult.id,
        timeline: {
          create: {
            type: 'created',
            title: 'Gara creata',
            actor: authResult.name,
          },
        },
      },
    })

    return successResponse({ id: tender.id, code: tender.code })
  } catch (error) {
    console.error('POST /api/tenders error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nella creazione gara', 500)
  }
}
