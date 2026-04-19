import { prisma } from '@/lib/db'
import { successResponse } from '@/lib/api-response'
import {
  createBudgetSchema,
  budgetQuerySchema,
  computeBudgetCapacity,
} from '@/modules/core/budgets'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  {
    module: '/api/budgets',
    auth: ['ADMIN', 'MANAGER'],
    querySchema: budgetQuerySchema,
    errorMessage: 'Errore nel recupero budget',
  },
  async ({ query }) => {
    const { page, pageSize, cost_center, department, is_active, period_type } =
      query

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
  },
)

export const POST = withApiHandler(
  {
    module: '/api/budgets',
    auth: ['ADMIN'],
    bodySchema: createBudgetSchema,
    errorMessage: 'Errore nella creazione budget',
  },
  async ({ body, user }) => {
    const budget = await prisma.budget.create({
      data: {
        cost_center: body.cost_center,
        department: body.department ?? null,
        period_type: body.period_type,
        period_start: new Date(body.period_start),
        period_end: new Date(body.period_end),
        allocated_amount: body.allocated_amount,
        alert_threshold_percent: body.alert_threshold_percent,
        enforcement_mode: body.enforcement_mode,
        notes: body.notes ?? null,
        created_by: user.id,
      },
    })

    return successResponse({ id: budget.id, costCenter: budget.cost_center })
  },
)
