import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { createBudgetSchema, budgetQuerySchema } from '@/lib/validations/budget'
import { computeBudgetCapacity } from '@/server/services/budget.service'
import { requireModule } from '@/lib/modules/require-module'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/budgets')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = budgetQuerySchema.safeParse(params)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const { page, pageSize, cost_center, department, is_active, period_type } =
      parsed.data

    const where: Record<string, unknown> = {}
    if (cost_center)
      where.cost_center = { contains: cost_center, mode: 'insensitive' }
    if (department)
      where.department = { contains: department, mode: 'insensitive' }
    if (is_active !== undefined) where.is_active = is_active
    if (period_type) where.period_type = period_type

    const [budgets, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        orderBy: [{ cost_center: 'asc' }, { period_start: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.budget.count({ where }),
    ])

    const enriched = await Promise.all(
      budgets.map(async (b) => {
        const capacity = await computeBudgetCapacity(b.id)
        return {
          id: b.id,
          costCenter: b.cost_center,
          department: b.department,
          periodType: b.period_type,
          periodStart: b.period_start.toISOString(),
          periodEnd: b.period_end.toISOString(),
          allocated: Number(b.allocated_amount),
          spent: capacity.spent,
          committed: capacity.committed,
          available: capacity.available,
          usagePercent: capacity.usagePercent,
          isOverBudget: capacity.isOverBudget,
          isWarning: capacity.isWarning,
          alertThreshold: b.alert_threshold_percent,
          enforcementMode: b.enforcement_mode,
          isActive: b.is_active,
        }
      }),
    )

    return successResponse(enriched, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/budgets error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero budget', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/budgets')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createBudgetSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error)
    }

    const budget = await prisma.budget.create({
      data: {
        cost_center: parsed.data.cost_center,
        department: parsed.data.department ?? null,
        period_type: parsed.data.period_type,
        period_start: new Date(parsed.data.period_start),
        period_end: new Date(parsed.data.period_end),
        allocated_amount: parsed.data.allocated_amount,
        alert_threshold_percent: parsed.data.alert_threshold_percent,
        enforcement_mode: parsed.data.enforcement_mode,
        notes: parsed.data.notes ?? null,
        created_by: authResult.id,
      },
    })

    return successResponse({ id: budget.id, costCenter: budget.cost_center })
  } catch (error) {
    console.error('POST /api/budgets error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nella creazione budget', 500)
  }
}
