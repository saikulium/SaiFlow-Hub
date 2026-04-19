import { prisma } from '@/lib/db'
import { COMMITTED_STATUSES, SPENT_STATUSES } from '../constants'
import {
  createBulkNotifications,
  NOTIFICATION_TYPES,
} from '@/server/services/notification.service'
import type {
  BudgetCapacity,
  BudgetCheckResult,
  BudgetForecast,
  BudgetDashboardStats,
  BudgetDashboardItem,
} from '@/types'

// ---------------------------------------------------------------------------
// Pure functions (unit-testable, no side effects)
// ---------------------------------------------------------------------------

/** Returns available budget: allocated - spent - committed */
export function computeAvailable(
  allocated: number,
  spent: number,
  committed: number,
): number {
  return allocated - spent - committed
}

/** Returns usage percentage (spent + committed) / allocated, rounded to int */
export function computeUsagePercent(
  allocated: number,
  spent: number,
  committed: number,
): number {
  if (allocated === 0) return 0
  return Math.round(((spent + committed) / allocated) * 100)
}

/** Returns true when available is negative */
export function isOverBudget(available: number): boolean {
  return available < 0
}

/** Returns true when usage percent >= threshold */
export function isWarning(usagePercent: number, threshold: number): boolean {
  return usagePercent >= threshold
}

/** Returns daily burn rate from total spent over elapsed days */
export function computeBurnRate(
  totalSpent: number,
  daysElapsed: number,
): number {
  if (daysElapsed <= 0) return 0
  return totalSpent / daysElapsed
}

/** Projects total spend at period end: currentSpent + burnRate * daysRemaining */
export function projectSpend(
  burnRate: number,
  daysRemaining: number,
  currentSpent: number,
): number {
  return currentSpent + burnRate * daysRemaining
}

/**
 * Computes the date when the budget will be exhausted.
 * Returns null if burnRate is 0 or exhaustion is > 365 days away.
 * Returns a past/today date if already exhausted.
 */
export function computeExhaustionDate(
  allocated: number,
  currentSpent: number,
  burnRate: number,
  periodStart: Date,
  daysElapsed: number,
): Date | null {
  if (burnRate <= 0) return null

  const remaining = allocated - currentSpent
  if (remaining <= 0) {
    // Already exhausted — return today
    return new Date()
  }

  const daysUntilExhaustion = remaining / burnRate
  if (daysUntilExhaustion > 365) return null

  const exhaustionDate = new Date(periodStart)
  exhaustionDate.setDate(
    exhaustionDate.getDate() + daysElapsed + daysUntilExhaustion,
  )
  return exhaustionDate
}

/** Returns the budget with the least available amount (most restrictive) */
export function resolveMostRestrictive(
  budgets: readonly BudgetCapacity[],
): BudgetCapacity | null {
  if (budgets.length === 0) return null

  return budgets.reduce<BudgetCapacity>(
    (worst, current) => (current.available < worst.available ? current : worst),
    budgets[0]!,
  )
}

/** Builds a check result from a list of budget capacities and a requested amount */
export function buildCheckResult(
  budgets: readonly BudgetCapacity[],
  amount: number,
): BudgetCheckResult {
  if (budgets.length === 0) {
    return {
      allowed: true,
      mode: 'NO_BUDGET',
      budgets: [],
      worstCase: null,
      message: 'Nessun budget configurato — spesa consentita.',
    }
  }

  const mutableBudgets = [...budgets]
  const worstCase = resolveMostRestrictive(mutableBudgets)!

  const hasHardBlock =
    worstCase.enforcementMode === 'HARD' && worstCase.isOverBudget

  if (hasHardBlock) {
    return {
      allowed: false,
      mode: 'HARD',
      budgets: mutableBudgets,
      worstCase,
      message: `Budget ${worstCase.costCenter} sforato — blocco attivo. Disponibile: ${formatCurrency(worstCase.available)}.`,
    }
  }

  if (worstCase.isOverBudget) {
    return {
      allowed: true,
      mode: 'SOFT',
      budgets: mutableBudgets,
      worstCase,
      message: `Attenzione: budget ${worstCase.costCenter} sforato (soft block). Disponibile: ${formatCurrency(worstCase.available)}.`,
    }
  }

  if (worstCase.isWarning) {
    return {
      allowed: true,
      mode: worstCase.enforcementMode,
      budgets: mutableBudgets,
      worstCase,
      message: `Budget ${worstCase.costCenter} in soglia di attenzione (${worstCase.usagePercent}%). Disponibile: ${formatCurrency(worstCase.available)}.`,
    }
  }

  return {
    allowed: true,
    mode: worstCase.enforcementMode,
    budgets: mutableBudgets,
    worstCase,
    message: `Budget disponibile: ${formatCurrency(worstCase.available)} su ${worstCase.costCenter}.`,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function diffDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / msPerDay))
}

// ---------------------------------------------------------------------------
// Prisma-dependent functions
// ---------------------------------------------------------------------------

/** Compute live capacity for a single budget record */
export async function computeBudgetCapacity(
  budgetId: string,
): Promise<BudgetCapacity> {
  const budget = await prisma.budget.findUniqueOrThrow({
    where: { id: budgetId },
  })

  const allocated = Number(budget.allocated_amount)
  const periodStart = budget.period_start
  const periodEnd = budget.period_end

  const [spentAgg, committedAgg] = await Promise.all([
    prisma.purchaseRequest.aggregate({
      _sum: { invoiced_amount: true },
      where: {
        cost_center: budget.cost_center,
        status: { in: [...SPENT_STATUSES] },
        created_at: { gte: periodStart, lte: periodEnd },
      },
    }),
    prisma.purchaseRequest.aggregate({
      _sum: { estimated_amount: true },
      where: {
        cost_center: budget.cost_center,
        status: { in: [...COMMITTED_STATUSES] },
        created_at: { gte: periodStart, lte: periodEnd },
      },
    }),
  ])

  const spent = Number(spentAgg._sum.invoiced_amount ?? 0)
  const committed = Number(committedAgg._sum.estimated_amount ?? 0)
  const available = computeAvailable(allocated, spent, committed)
  const usagePercent = computeUsagePercent(allocated, spent, committed)

  return {
    budgetId: budget.id,
    costCenter: budget.cost_center,
    department: budget.department,
    periodType: budget.period_type,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    allocated,
    spent,
    committed,
    available,
    usagePercent,
    alertThreshold: budget.alert_threshold_percent,
    enforcementMode: budget.enforcement_mode,
    isOverBudget: isOverBudget(available),
    isWarning: isWarning(usagePercent, budget.alert_threshold_percent),
  }
}

/** Check budget capacity for a cost center against a requested amount */
export async function checkBudgetCapacity(
  costCenter: string,
  amount: number,
): Promise<BudgetCheckResult> {
  const now = new Date()

  const activeBudgets = await prisma.budget.findMany({
    where: {
      cost_center: costCenter,
      is_active: true,
      period_start: { lte: now },
      period_end: { gte: now },
    },
    select: { id: true },
  })

  const capacities = await Promise.all(
    activeBudgets.map((b) => computeBudgetCapacity(b.id)),
  )

  return buildCheckResult(capacities, amount)
}

/** Compute forecast for a single budget */
export async function computeForecast(
  budgetId: string,
): Promise<BudgetForecast> {
  const capacity = await computeBudgetCapacity(budgetId)
  const now = new Date()
  const periodStart = new Date(capacity.periodStart)
  const periodEnd = new Date(capacity.periodEnd)

  const daysElapsed = diffDays(periodStart, now)
  const daysRemaining = diffDays(now, periodEnd)
  const totalSpent = capacity.spent + capacity.committed
  const dailyBurnRate = computeBurnRate(totalSpent, daysElapsed)
  const projectedSpendAtPeriodEnd = projectSpend(
    dailyBurnRate,
    daysRemaining,
    totalSpent,
  )
  const residualAtPeriodEnd = capacity.allocated - projectedSpendAtPeriodEnd

  const exhaustionDate = computeExhaustionDate(
    capacity.allocated,
    totalSpent,
    dailyBurnRate,
    periodStart,
    daysElapsed,
  )

  const daysUntilExhaustion = exhaustionDate
    ? Math.max(0, diffDays(now, exhaustionDate))
    : null

  return {
    budgetId: capacity.budgetId,
    costCenter: capacity.costCenter,
    dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
    projectedSpendAtPeriodEnd:
      Math.round(projectedSpendAtPeriodEnd * 100) / 100,
    exhaustionDate: exhaustionDate?.toISOString() ?? null,
    residualAtPeriodEnd: Math.round(residualAtPeriodEnd * 100) / 100,
    daysRemaining,
    daysUntilExhaustion,
  }
}

/** Aggregate dashboard stats across all active budgets */
export async function getBudgetDashboardStats(): Promise<BudgetDashboardStats> {
  const now = new Date()

  const activeBudgets = await prisma.budget.findMany({
    where: {
      is_active: true,
      period_start: { lte: now },
      period_end: { gte: now },
    },
    select: { id: true },
  })

  const items: BudgetDashboardItem[] = await Promise.all(
    activeBudgets.map(async (b) => {
      const capacity = await computeBudgetCapacity(b.id)
      const forecast = await computeForecast(b.id)
      return {
        budgetId: capacity.budgetId,
        costCenter: capacity.costCenter,
        department: capacity.department,
        allocated: capacity.allocated,
        spent: capacity.spent,
        committed: capacity.committed,
        available: capacity.available,
        usagePercent: capacity.usagePercent,
        isOverBudget: capacity.isOverBudget,
        isWarning: capacity.isWarning,
        forecast,
      }
    }),
  )

  const totalAllocated = items.reduce((sum, i) => sum + i.allocated, 0)
  const totalSpent = items.reduce((sum, i) => sum + i.spent, 0)
  const totalCommitted = items.reduce((sum, i) => sum + i.committed, 0)
  const totalAvailable = items.reduce((sum, i) => sum + i.available, 0)
  const centricostoInWarning = items.filter(
    (i) => i.isWarning && !i.isOverBudget,
  ).length
  const centricostoSforati = items.filter((i) => i.isOverBudget).length

  return {
    totalAllocated,
    totalSpent,
    totalCommitted,
    totalAvailable,
    centricostoInWarning,
    centricostoSforati,
    budgets: items,
  }
}

/** Send budget alert notifications to admins and managers */
export async function sendBudgetAlerts(
  capacity: BudgetCapacity,
): Promise<void> {
  if (!capacity.isWarning && !capacity.isOverBudget) return

  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  })

  if (recipients.length === 0) return

  const isOver = capacity.isOverBudget
  const title = isOver
    ? `Budget sforato: ${capacity.costCenter}`
    : `Budget in soglia: ${capacity.costCenter}`
  const body = isOver
    ? `Il centro di costo ${capacity.costCenter} ha superato il budget allocato (${capacity.usagePercent}% utilizzato).`
    : `Il centro di costo ${capacity.costCenter} ha raggiunto il ${capacity.usagePercent}% del budget allocato.`

  const notifications = recipients.map((r) => ({
    userId: r.id,
    title,
    body,
    type: isOver
      ? NOTIFICATION_TYPES.BUDGET_EXCEEDED
      : NOTIFICATION_TYPES.BUDGET_WARNING,
    link: `/budgets/${capacity.budgetId}`,
  }))

  await createBulkNotifications(notifications)
}

/** Refresh the snapshot for a single budget */
export async function refreshBudgetSnapshot(budgetId: string): Promise<void> {
  const capacity = await computeBudgetCapacity(budgetId)

  await prisma.budgetSnapshot.create({
    data: {
      budget_id: budgetId,
      spent: capacity.spent,
      committed: capacity.committed,
      available: capacity.available,
    },
  })

  await sendBudgetAlerts(capacity)
}

/** Refresh snapshots for all active budgets matching a cost center */
export async function refreshSnapshotsForCostCenter(
  costCenter: string,
): Promise<void> {
  const now = new Date()

  const budgets = await prisma.budget.findMany({
    where: {
      cost_center: costCenter,
      is_active: true,
      period_start: { lte: now },
      period_end: { gte: now },
    },
    select: { id: true },
  })

  await Promise.all(budgets.map((b) => refreshBudgetSnapshot(b.id)))
}
