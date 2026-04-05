import { prisma } from '@/lib/db'
import { DEFAULT_ROI_BENCHMARKS } from '@/lib/constants/roi'
import type {
  RoiPeriod,
  RoiMetrics,
  RoiSummary,
  TrendPoint,
  TimeSavingsMetrics,
  CostSavingsMetrics,
  OperationalEfficiencyMetrics,
  AutomationMetrics,
} from '@/types'

const MONTH_NAMES = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
]

const COMPLETED_STATUSES = [
  'DELIVERED', 'INVOICED', 'RECONCILED', 'CLOSED',
] as const

const RECONCILED_STATUSES = ['MATCHED', 'APPROVED', 'PAID'] as const

const MS_PER_DAY = 86_400_000
const MS_PER_HOUR = 3_600_000

// --- Pure functions (unit-testable) ---

export function computePeriodRange(period: RoiPeriod): {
  start: Date
  end: Date
  months: number
} {
  const end = new Date()
  let start: Date
  let months: number

  switch (period) {
    case '30d':
      start = new Date(end.getTime() - 30 * MS_PER_DAY)
      months = 1
      break
    case '90d':
      start = new Date(end.getTime() - 90 * MS_PER_DAY)
      months = 3
      break
    case '6m':
      start = new Date(end.getFullYear(), end.getMonth() - 6, 1)
      months = 6
      break
    case '12m':
      start = new Date(end.getFullYear(), end.getMonth() - 12, 1)
      months = 12
      break
    case 'all':
      start = new Date(2020, 0, 1)
      months = Math.max(
        1,
        (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()) + 1,
      )
      break
  }

  return { start, end, months }
}

export function computeNegotiationSavings(
  totalEstimated: number,
  totalActual: number,
): number {
  const diff = totalEstimated - totalActual
  return diff > 0 ? diff : 0
}

export function computeRoiSummary(params: {
  readonly negotiationSavings: number
  readonly discrepanciesCaught: number
  readonly requestCount: number
  readonly periodDays: number
  readonly automationTimeSavedHours: number
}): RoiSummary {
  const {
    negotiationSavings,
    discrepanciesCaught,
    requestCount,
    periodDays,
    automationTimeSavedHours,
  } = params
  const b = DEFAULT_ROI_BENCHMARKS

  const hoursSavedPerRequest = b.manualHoursPerRequest - b.platformHoursPerRequest
  const estimatedHoursSaved = requestCount * hoursSavedPerRequest
  const totalTimeSavedHours = estimatedHoursSaved + automationTimeSavedHours
  const hoursSavedValue = totalTimeSavedHours * b.hourlyLaborCost
  const moneySaved = negotiationSavings + discrepanciesCaught
  const annualFactor = periodDays > 0 ? 365 / periodDays : 0
  const projectedAnnualSavings = (moneySaved + hoursSavedValue) * annualFactor
  const projectedAnnualHoursSaved = totalTimeSavedHours * annualFactor

  return {
    estimatedHoursSaved: Math.round(estimatedHoursSaved * 10) / 10,
    hoursSavedValue: Math.round(hoursSavedValue),
    moneySaved: Math.round(moneySaved),
    projectedAnnualSavings: Math.round(projectedAnnualSavings),
    projectedAnnualHoursSaved: Math.round(projectedAnnualHoursSaved),
    totalTimeSavedHours: Math.round(totalTimeSavedHours * 10) / 10,
    automationTimeSavedHours: Math.round(automationTimeSavedHours * 10) / 10,
  }
}

function computeMonthlyRanges(start: Date, end: Date) {
  const ranges: Array<{ start: Date; end: Date; label: string }> = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)

  while (cursor <= end) {
    const monthStart = new Date(cursor)
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    ranges.push({
      start: monthStart,
      end: monthEnd > end ? end : monthEnd,
      label: MONTH_NAMES[cursor.getMonth()]!,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return ranges
}

function safeAvg(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 10) / 10
}

function safePercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function computeChangePercent(trend: readonly TrendPoint[], halfIdx: number): number {
  if (trend.length < 2) return 0
  const firstHalf = trend.slice(0, halfIdx)
  const secondHalf = trend.slice(halfIdx)
  const avgFirst = safeAvg(firstHalf.map((t) => t.value))
  const avgSecond = safeAvg(secondHalf.map((t) => t.value))
  if (avgFirst === 0) return 0
  return Math.round(((avgSecond - avgFirst) / avgFirst) * 100)
}

// --- Main data-fetching function ---

export async function getRoiMetrics(period: RoiPeriod): Promise<RoiMetrics> {
  const { start, end, months } = computePeriodRange(period)
  const b = DEFAULT_ROI_BENCHMARKS
  const periodDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / MS_PER_DAY),
  )

  // Batch all queries in a single transaction
  const [
    deliveredPRs,
    approvedApprovals,
    estimatedSum,
    actualSum,
    discrepancySum,
    discrepancyCount,
    compliancePRs,
    totalRequests,
    totalInvoices,
    autoMatchedCount,
    totalMatchedInvoices,
    // New: automation queries
    emailIngestedCount,
    sdiInvoiceCount,
    invoiceProcessingTimes,
    reconciledCount,
    reconciledAutoCount,
    allApprovedApprovals,
    activeBudgetCount,
  ] = await prisma.$transaction([
    // 1. Delivered PRs with dates for cycle time + on-time calculation
    prisma.purchaseRequest.findMany({
      where: {
        status: { in: [...COMPLETED_STATUSES] },
        delivered_at: { not: null },
        created_at: { gte: start, lte: end },
      },
      select: {
        created_at: true,
        delivered_at: true,
        expected_delivery: true,
      },
      take: 1000,
      orderBy: { created_at: 'desc' },
    }),
    // 2. Approved approvals for approval time
    prisma.approval.findMany({
      where: {
        status: 'APPROVED',
        decision_at: { not: null },
        created_at: { gte: start, lte: end },
      },
      select: { created_at: true, decision_at: true },
      take: 1000,
      orderBy: { created_at: 'desc' },
    }),
    // 3. Estimated amount sum for completed PRs
    prisma.purchaseRequest.aggregate({
      _sum: { estimated_amount: true },
      where: {
        status: { in: [...COMPLETED_STATUSES] },
        estimated_amount: { not: null },
        actual_amount: { not: null },
        created_at: { gte: start, lte: end },
      },
    }),
    // 4. Actual amount sum for completed PRs
    prisma.purchaseRequest.aggregate({
      _sum: { actual_amount: true },
      where: {
        status: { in: [...COMPLETED_STATUSES] },
        estimated_amount: { not: null },
        actual_amount: { not: null },
        created_at: { gte: start, lte: end },
      },
    }),
    // 5. Sum of resolved discrepancies
    prisma.invoice.aggregate({
      _sum: { amount_discrepancy: true },
      where: {
        discrepancy_resolved: true,
        discrepancy_type: { not: 'NONE' },
        received_at: { gte: start, lte: end },
      },
    }),
    // 6. Count of resolved discrepancies
    prisma.invoice.count({
      where: {
        discrepancy_resolved: true,
        discrepancy_type: { not: 'NONE' },
        received_at: { gte: start, lte: end },
      },
    }),
    // 7. Budget compliance: fetch both amounts, compare in JS
    prisma.purchaseRequest.findMany({
      where: {
        status: { in: [...COMPLETED_STATUSES] },
        actual_amount: { not: null },
        estimated_amount: { not: null },
        created_at: { gte: start, lte: end },
      },
      select: { estimated_amount: true, actual_amount: true },
    }),
    // 8. Total requests in period
    prisma.purchaseRequest.count({
      where: { created_at: { gte: start, lte: end } },
    }),
    // 9. Total invoices in period
    prisma.invoice.count({
      where: { received_at: { gte: start, lte: end } },
    }),
    // 10. Auto-matched invoices
    prisma.invoice.count({
      where: {
        match_status: 'AUTO_MATCHED',
        received_at: { gte: start, lte: end },
      },
    }),
    // 11. Total matched invoices (any matched status)
    prisma.invoice.count({
      where: {
        match_status: { in: ['AUTO_MATCHED', 'SUGGESTED', 'MANUALLY_MATCHED'] },
        received_at: { gte: start, lte: end },
      },
    }),
    // 12. Email ingestion count (PRs created from email)
    prisma.purchaseRequest.count({
      where: {
        email_message_id: { not: null },
        created_at: { gte: start, lte: end },
      },
    }),
    // 13. SDI invoices (electronic)
    prisma.invoice.count({
      where: {
        sdi_id: { not: null },
        received_at: { gte: start, lte: end },
      },
    }),
    // 14. Invoice processing times (received_at → matched_at)
    prisma.invoice.findMany({
      where: {
        matched_at: { not: null },
        received_at: { gte: start, lte: end },
      },
      select: { received_at: true, matched_at: true },
      take: 1000,
      orderBy: { received_at: 'desc' },
    }),
    // 15. Reconciled invoices (MATCHED/APPROVED/PAID)
    prisma.invoice.count({
      where: {
        reconciliation_status: { in: [...RECONCILED_STATUSES] },
        received_at: { gte: start, lte: end },
      },
    }),
    // 16. Auto-reconciled (no human reconciler)
    prisma.invoice.count({
      where: {
        reconciliation_status: { in: [...RECONCILED_STATUSES] },
        reconciled_by: null,
        received_at: { gte: start, lte: end },
      },
    }),
    // 17. All approved approvals (for auto-approval detection via timing)
    prisma.approval.findMany({
      where: {
        status: 'APPROVED',
        decision_at: { not: null },
        created_at: { gte: start, lte: end },
      },
      select: { created_at: true, decision_at: true },
      take: 2000,
      orderBy: { created_at: 'desc' },
    }),
    // 18. Active budgets
    prisma.budget.count({
      where: {
        is_active: true,
        period_end: { gte: start },
      },
    }),
  ])

  // --- Existing calculations ---

  const cycleDays = deliveredPRs
    .filter((pr) => pr.delivered_at)
    .map((pr) => (pr.delivered_at!.getTime() - pr.created_at.getTime()) / MS_PER_DAY)

  const approvalHours = approvedApprovals
    .filter((a) => a.decision_at)
    .map((a) => (a.decision_at!.getTime() - a.created_at.getTime()) / MS_PER_HOUR)

  const deliveredWithExpected = deliveredPRs.filter(
    (pr) => pr.delivered_at && pr.expected_delivery,
  )
  const onTimeCount = deliveredWithExpected.filter(
    (pr) => pr.delivered_at! <= pr.expected_delivery!,
  ).length
  const totalDelivered = deliveredWithExpected.length

  const compliantCount = compliancePRs.filter(
    (pr) => Number(pr.actual_amount) <= Number(pr.estimated_amount),
  ).length
  const totalWithActual = compliancePRs.length

  const totalEstimated = Number(estimatedSum._sum.estimated_amount ?? 0)
  const totalActual = Number(actualSum._sum.actual_amount ?? 0)
  const negotiationSavings = computeNegotiationSavings(totalEstimated, totalActual)
  const discrepanciesCaught = Math.abs(
    Number(discrepancySum._sum.amount_discrepancy ?? 0),
  )

  // --- Automation calculations ---

  // Email time saved: each email = manualMinutesPerEmail saved
  const emailTimeSavedHours = (emailIngestedCount * b.manualMinutesPerEmail) / 60

  // Invoice time saved: each invoice = (manual - platform) minutes saved
  const invoiceSavedMinutes = b.manualMinutesPerInvoice - b.platformMinutesPerInvoice
  const invoiceTimeSavedHours = (totalInvoices * invoiceSavedMinutes) / 60

  // Invoice processing time (received_at → matched_at)
  const invoiceProcessingHours = invoiceProcessingTimes
    .filter((inv) => inv.matched_at)
    .map((inv) => (inv.matched_at!.getTime() - inv.received_at.getTime()) / MS_PER_HOUR)
  const avgInvoiceProcessingHours = safeAvg(invoiceProcessingHours)

  // Reconciliation time saved
  const reconSavedMinutes = b.manualMinutesPerReconciliation - b.platformMinutesPerReconciliation
  const reconciliationTimeSavedHours = (reconciledCount * reconSavedMinutes) / 60

  // Auto-approval detection: decision_at - created_at < threshold
  const thresholdMs = b.autoApprovalThresholdSeconds * 1000
  const autoApprovedCount = allApprovedApprovals.filter(
    (a) => a.decision_at!.getTime() - a.created_at.getTime() < thresholdMs,
  ).length
  const totalApproved = allApprovedApprovals.length
  const autoApprovalTimeSavedHours = (autoApprovedCount * b.manualMinutesPerApproval) / 60

  const automationTimeSavedHours =
    emailTimeSavedHours +
    invoiceTimeSavedHours +
    reconciliationTimeSavedHours +
    autoApprovalTimeSavedHours

  // --- Trend computation ---
  const monthRanges = computeMonthlyRanges(start, end)

  const trendResults = await prisma.$transaction([
    // Savings per month
    ...monthRanges.map((r) =>
      prisma.purchaseRequest.aggregate({
        _sum: { estimated_amount: true, actual_amount: true },
        where: {
          status: { in: [...COMPLETED_STATUSES] },
          estimated_amount: { not: null },
          actual_amount: { not: null },
          created_at: { gte: r.start, lte: r.end },
        },
      }),
    ),
    // Request volume per month
    ...monthRanges.map((r) =>
      prisma.purchaseRequest.count({
        where: { created_at: { gte: r.start, lte: r.end } },
      }),
    ),
    // Email ingestion per month
    ...monthRanges.map((r) =>
      prisma.purchaseRequest.count({
        where: {
          email_message_id: { not: null },
          created_at: { gte: r.start, lte: r.end },
        },
      }),
    ),
    // Invoices per month
    ...monthRanges.map((r) =>
      prisma.invoice.count({
        where: { received_at: { gte: r.start, lte: r.end } },
      }),
    ),
  ])

  const n = monthRanges.length
  const savingsAggregates = trendResults.slice(0, n) as Array<{
    _sum: { estimated_amount: unknown; actual_amount: unknown }
  }>
  const volumeCounts = trendResults.slice(n, 2 * n) as number[]
  const emailCounts = trendResults.slice(2 * n, 3 * n) as number[]
  const invoiceCounts = trendResults.slice(3 * n, 4 * n) as number[]

  // Cycle time trend: group deliveredPRs by month
  const cycleTimeTrend: TrendPoint[] = monthRanges.map((r) => {
    const monthPRs = deliveredPRs.filter(
      (pr) => pr.created_at >= r.start && pr.created_at <= r.end && pr.delivered_at,
    )
    const days = monthPRs.map(
      (pr) => (pr.delivered_at!.getTime() - pr.created_at.getTime()) / MS_PER_DAY,
    )
    return { period: r.label, value: safeAvg(days) }
  })

  // Approval time trend: group approvals by month
  const approvalTimeTrend: TrendPoint[] = monthRanges.map((r) => {
    const monthApprovals = approvedApprovals.filter(
      (a) => a.created_at >= r.start && a.created_at <= r.end && a.decision_at,
    )
    const hours = monthApprovals.map(
      (a) => (a.decision_at!.getTime() - a.created_at.getTime()) / MS_PER_HOUR,
    )
    return { period: r.label, value: safeAvg(hours) }
  })

  const costSavingsTrend: TrendPoint[] = monthRanges.map((r, i) => {
    const agg = savingsAggregates[i]!
    const est = Number(agg._sum.estimated_amount ?? 0)
    const act = Number(agg._sum.actual_amount ?? 0)
    return { period: r.label, value: computeNegotiationSavings(est, act) }
  })

  const requestsTrend: TrendPoint[] = monthRanges.map((r, i) => ({
    period: r.label,
    value: volumeCounts[i]!,
  }))

  const emailsTrend: TrendPoint[] = monthRanges.map((r, i) => ({
    period: r.label,
    value: emailCounts[i]!,
  }))

  const invoicesTrend: TrendPoint[] = monthRanges.map((r, i) => ({
    period: r.label,
    value: invoiceCounts[i]!,
  }))

  // Change percentages: compare first half vs second half of trend
  const halfIdx = Math.floor(cycleTimeTrend.length / 2)
  const cycleTimeChangePercent = computeChangePercent(cycleTimeTrend, halfIdx)
  const approvalTimeChangePercent = computeChangePercent(approvalTimeTrend, halfIdx)

  const timeSavings: TimeSavingsMetrics = {
    avgCycleTimeDays: safeAvg(cycleDays),
    avgApprovalTimeHours: safeAvg(approvalHours),
    cycleTimeTrend,
    approvalTimeTrend,
    cycleTimeChangePercent,
    approvalTimeChangePercent,
  }

  const costSavings: CostSavingsMetrics = {
    totalEstimated,
    totalActual,
    negotiationSavings,
    discrepanciesCaught,
    discrepanciesCaughtCount: discrepancyCount,
    budgetComplianceRate: safePercent(compliantCount, totalWithActual),
    costSavingsTrend,
  }

  const efficiency: OperationalEfficiencyMetrics = {
    requestsPerMonth: months > 0 ? Math.round((totalRequests / months) * 10) / 10 : 0,
    requestsTrend,
    autoMatchRate: safePercent(autoMatchedCount, totalMatchedInvoices),
    onTimeDeliveryRate: safePercent(onTimeCount, totalDelivered),
    totalRequests,
    totalDelivered,
    totalInvoices,
    autoMatchedInvoices: autoMatchedCount,
  }

  const automation: AutomationMetrics = {
    emailsIngested: emailIngestedCount,
    emailTimeSavedHours: Math.round(emailTimeSavedHours * 10) / 10,
    emailsTrend,
    invoicesProcessed: totalInvoices,
    invoicesSdi: sdiInvoiceCount,
    invoicesOcr: totalInvoices - sdiInvoiceCount,
    avgInvoiceProcessingHours,
    invoiceTimeSavedHours: Math.round(invoiceTimeSavedHours * 10) / 10,
    invoicesTrend,
    reconciled: reconciledCount,
    reconciledAuto: reconciledAutoCount,
    autoReconciliationRate: safePercent(reconciledAutoCount, reconciledCount),
    reconciliationTimeSavedHours: Math.round(reconciliationTimeSavedHours * 10) / 10,
    autoApprovedCount,
    autoApprovalRate: safePercent(autoApprovedCount, totalApproved),
    autoApprovalTimeSavedHours: Math.round(autoApprovalTimeSavedHours * 10) / 10,
    activeBudgets: activeBudgetCount,
  }

  const summary = computeRoiSummary({
    negotiationSavings,
    discrepanciesCaught,
    requestCount: totalRequests,
    periodDays,
    automationTimeSavedHours,
  })

  return {
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    timeSavings,
    costSavings,
    efficiency,
    automation,
    summary,
  }
}

/** Lightweight version for dashboard tab — only summary numbers, no trends */
export async function getRoiSummaryOnly(): Promise<RoiSummary> {
  const { start, end } = computePeriodRange('90d')
  const periodDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)

  const [estimatedSum, actualSum, discrepancyResult, totalRequests] =
    await prisma.$transaction([
      prisma.purchaseRequest.aggregate({
        _sum: { estimated_amount: true },
        where: {
          status: { in: [...COMPLETED_STATUSES] },
          estimated_amount: { not: null },
          actual_amount: { not: null },
          created_at: { gte: start, lte: end },
        },
      }),
      prisma.purchaseRequest.aggregate({
        _sum: { actual_amount: true },
        where: {
          status: { in: [...COMPLETED_STATUSES] },
          estimated_amount: { not: null },
          actual_amount: { not: null },
          created_at: { gte: start, lte: end },
        },
      }),
      prisma.invoice.aggregate({
        _sum: { amount_discrepancy: true },
        where: {
          discrepancy_resolved: true,
          discrepancy_type: { not: 'NONE' },
          received_at: { gte: start, lte: end },
        },
      }),
      prisma.purchaseRequest.count({
        where: { created_at: { gte: start, lte: end } },
      }),
    ])

  const totalEstimated = Number(estimatedSum._sum.estimated_amount ?? 0)
  const totalActual = Number(actualSum._sum.actual_amount ?? 0)

  return computeRoiSummary({
    negotiationSavings: computeNegotiationSavings(totalEstimated, totalActual),
    discrepanciesCaught: Math.abs(
      Number(discrepancyResult._sum.amount_discrepancy ?? 0),
    ),
    requestCount: totalRequests,
    periodDays,
    automationTimeSavedHours: 0,
  })
}
