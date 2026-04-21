import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Budget Tools — list_budgets (READ)
// ---------------------------------------------------------------------------

export const listBudgetsTool = betaZodTool({
  name: 'list_budgets',
  description:
    'Lista budget con snapshot piu recente. Filtra per centro di costo, dipartimento, stato attivo.',
  inputSchema: z.object({
    cost_center: z.string().optional().describe('Filtra per centro di costo'),
    department: z.string().optional().describe('Filtra per dipartimento'),
    is_active: z.boolean().optional().describe('Filtra per stato attivo'),
    pageSize: z.number().int().min(1).max(50).optional().describe('Max risultati (default 20)'),
  }),
  run: async (input) => {
    const pageSize = input.pageSize ?? 20

    const where: Record<string, unknown> = {}
    if (input.cost_center !== undefined) where.cost_center = input.cost_center
    if (input.department !== undefined) where.department = input.department
    if (input.is_active !== undefined) where.is_active = input.is_active

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        snapshots: {
          take: 1,
          orderBy: { computed_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
      take: pageSize,
    })

    const enriched = budgets.map((budget) => {
      const allocated = Number(budget.allocated_amount)
      const snapshot = budget.snapshots[0]
      const spent = snapshot ? Number(snapshot.spent) : 0
      const committed = snapshot ? Number(snapshot.committed) : 0
      const available = snapshot ? Number(snapshot.available) : allocated
      const usagePercent = allocated > 0
        ? Math.round(((spent + committed) / allocated) * 10000) / 100
        : 0
      const isOverBudget = spent + committed > allocated
      const isWarning = usagePercent >= budget.alert_threshold_percent

      return {
        id: budget.id,
        cost_center: budget.cost_center,
        department: budget.department,
        period_type: budget.period_type,
        period_start: budget.period_start.toISOString(),
        period_end: budget.period_end.toISOString(),
        allocated_amount: allocated,
        alert_threshold_percent: budget.alert_threshold_percent,
        enforcement_mode: budget.enforcement_mode,
        is_active: budget.is_active,
        spent,
        committed,
        available,
        usagePercent,
        isOverBudget,
        isWarning,
        snapshot_at: snapshot?.computed_at?.toISOString() ?? null,
      }
    })

    return JSON.stringify({ total: enriched.length, budgets: enriched })
  },
})

// ---------------------------------------------------------------------------
// Exported collection
// ---------------------------------------------------------------------------

export const BUDGET_TOOLS: readonly ZodTool[] = [
  listBudgetsTool,
] as readonly ZodTool[]
