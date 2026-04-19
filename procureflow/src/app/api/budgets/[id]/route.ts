import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import {
  updateBudgetSchema,
  computeBudgetCapacity,
  computeForecast,
  COMMITTED_STATUSES,
  SPENT_STATUSES,
} from '@/modules/core/budgets'
import { requireModule } from '@/lib/modules/require-module'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/budgets')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const budget = await prisma.budget.findUnique({ where: { id } })
    if (!budget) return notFoundResponse('Budget non trovato')

    const capacity = await computeBudgetCapacity(budget.id)
    const forecast = await computeForecast(budget.id)

    const [spentRequests, committedRequests] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where: {
          cost_center: budget.cost_center,
          status: { in: [...SPENT_STATUSES] },
          created_at: { gte: budget.period_start, lte: budget.period_end },
        },
        select: {
          id: true,
          code: true,
          title: true,
          invoiced_amount: true,
          estimated_amount: true,
          status: true,
          cost_center: true,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      prisma.purchaseRequest.findMany({
        where: {
          cost_center: budget.cost_center,
          status: { in: [...COMMITTED_STATUSES] },
          created_at: { gte: budget.period_start, lte: budget.period_end },
        },
        select: {
          id: true,
          code: true,
          title: true,
          estimated_amount: true,
          status: true,
          cost_center: true,
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
    ])

    return successResponse({
      ...capacity,
      notes: budget.notes,
      createdBy: budget.created_by,
      createdAt: budget.created_at.toISOString(),
      isActive: budget.is_active,
      forecast,
      spentRequests: spentRequests.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        amount: Number(r.invoiced_amount ?? r.estimated_amount ?? 0),
        status: r.status,
        costCenter: r.cost_center ?? '',
      })),
      committedRequests: committedRequests.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        amount: Number(r.estimated_amount ?? 0),
        status: r.status,
        costCenter: r.cost_center ?? '',
      })),
    })
  } catch (error) {
    console.error('GET /api/budgets/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero budget', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/budgets')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = updateBudgetSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const existing = await prisma.budget.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Budget non trovato')

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        ...(parsed.data.allocated_amount !== undefined && {
          allocated_amount: parsed.data.allocated_amount,
        }),
        ...(parsed.data.alert_threshold_percent !== undefined && {
          alert_threshold_percent: parsed.data.alert_threshold_percent,
        }),
        ...(parsed.data.enforcement_mode !== undefined && {
          enforcement_mode: parsed.data.enforcement_mode,
        }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.is_active !== undefined && {
          is_active: parsed.data.is_active,
        }),
      },
    })

    if (
      parsed.data.allocated_amount &&
      parsed.data.allocated_amount !== Number(existing.allocated_amount)
    ) {
      console.info(
        `[budget] Plafond aggiornato per ${budget.cost_center}: ${existing.allocated_amount} → ${parsed.data.allocated_amount} (by ${authResult.name})`,
      )
    }

    return successResponse({ id: budget.id })
  } catch (error) {
    console.error('PATCH /api/budgets/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento budget', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/budgets')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const existing = await prisma.budget.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Budget non trovato')

    await prisma.budget.update({
      where: { id },
      data: { is_active: false },
    })

    return successResponse({ id, deactivated: true })
  } catch (error) {
    console.error('DELETE /api/budgets/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore disattivazione budget', 500)
  }
}
