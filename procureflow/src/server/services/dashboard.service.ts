export { getTenderDashboardStats } from '@/modules/core/tenders'
export { getInventoryDashboardStats } from '@/modules/core/inventory'
import { prisma } from '@/lib/db'
import { REQUEST_STATUS_CONFIG, type RequestStatusKey } from '@/lib/constants'
import { INVOICE_MATCH_STATUS_CONFIG } from '@/modules/core/invoicing'
import { getBudgetDashboardStats as computeBudgetDashboardStats } from '@/modules/core/budgets'

const MONTH_NAMES = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
]

import type {
  DashboardStats,
  RecentRequest,
  DeliveryItem,
  SpendByVendor,
  RequestTrend,
  StatusDistribution,
  MonthlySpendTrend,
  InvoiceStats,
  InvoiceMatchDistribution,
  InvoiceAgingBucket,
  OrderedVsInvoiced,
} from '@/types'

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  const closedStatuses = [
    'DELIVERED',
    'INVOICED',
    'RECONCILED',
    'CLOSED',
    'CANCELLED',
    'REJECTED',
  ] as const

  // $transaction batches all queries in a single DB round-trip on one connection
  const [
    activeRequests,
    pendingApprovals,
    monthlySpendResult,
    overdueDeliveries,
    prevActiveRequests,
    prevPendingApprovals,
    prevMonthlySpendResult,
    prevOverdueDeliveries,
    activeBudgets,
  ] = await prisma.$transaction([
    prisma.purchaseRequest.count({
      where: { status: { notIn: [...closedStatuses] } },
    }),
    prisma.purchaseRequest.count({
      where: { status: 'PENDING_APPROVAL' },
    }),
    prisma.purchaseRequest.aggregate({
      _sum: { estimated_amount: true },
      where: {
        status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
        ordered_at: { gte: startOfMonth },
      },
    }),
    prisma.purchaseRequest.count({
      where: {
        status: { in: ['ORDERED', 'SHIPPED'] },
        expected_delivery: { lt: now },
      },
    }),
    prisma.purchaseRequest.count({
      where: {
        status: { notIn: [...closedStatuses] },
        created_at: { lt: startOfMonth },
      },
    }),
    prisma.purchaseRequest.count({
      where: {
        status: 'PENDING_APPROVAL',
        created_at: { lt: startOfMonth },
      },
    }),
    prisma.purchaseRequest.aggregate({
      _sum: { estimated_amount: true },
      where: {
        status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
        ordered_at: { gte: startOfLastMonth, lt: endOfLastMonth },
      },
    }),
    prisma.purchaseRequest.count({
      where: {
        status: { in: ['ORDERED', 'SHIPPED'] },
        expected_delivery: { lt: startOfMonth },
      },
    }),
    prisma.budget.findMany({
      where: {
        is_active: true,
        period_start: { lte: now },
        period_end: { gte: now },
      },
      select: { allocated_amount: true },
    }),
  ])

  const monthlyBudget =
    activeBudgets.length === 0
      ? 50000
      : activeBudgets.reduce((sum, b) => sum + Number(b.allocated_amount), 0)

  return {
    activeRequests,
    pendingApprovals,
    monthlySpend: Number(monthlySpendResult._sum.estimated_amount ?? 0),
    monthlyBudget,
    overdueDeliveries,
    previousActiveRequests: prevActiveRequests,
    previousPendingApprovals: prevPendingApprovals,
    previousMonthlySpend: Number(
      prevMonthlySpendResult._sum.estimated_amount ?? 0,
    ),
    previousOverdueDeliveries: prevOverdueDeliveries,
  }
}

export async function getRecentRequests(limit = 10): Promise<RecentRequest[]> {
  const requests = await prisma.purchaseRequest.findMany({
    take: limit,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      priority: true,
      estimated_amount: true,
      created_at: true,
      vendor: { select: { name: true } },
    },
  })

  return requests.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status as RequestStatusKey,
    priority: r.priority as RecentRequest['priority'],
    vendorName: r.vendor?.name ?? null,
    estimatedAmount: r.estimated_amount ? Number(r.estimated_amount) : null,
    createdAt: r.created_at.toISOString(),
  }))
}

export async function getUpcomingDeliveries(
  limit = 5,
): Promise<DeliveryItem[]> {
  const now = new Date()

  const requests = await prisma.purchaseRequest.findMany({
    where: {
      status: { in: ['ORDERED', 'SHIPPED'] },
      expected_delivery: { not: null },
    },
    orderBy: { expected_delivery: 'asc' },
    take: limit,
    select: {
      id: true,
      code: true,
      title: true,
      expected_delivery: true,
      vendor: { select: { name: true } },
    },
  })

  return requests.map((r) => {
    const expected = r.expected_delivery!
    const daysUntil = Math.ceil(
      (expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    let status: DeliveryItem['status'] = 'on_time'
    if (daysUntil < 0) status = 'overdue'
    else if (daysUntil <= 3) status = 'at_risk'

    return {
      id: r.id,
      code: r.code,
      title: r.title,
      vendorName: r.vendor?.name ?? 'N/A',
      expectedDelivery: expected.toISOString(),
      status,
    }
  })
}

export async function getSpendByVendor(): Promise<SpendByVendor[]> {
  const result = await prisma.purchaseRequest.groupBy({
    by: ['vendor_id'],
    _sum: { estimated_amount: true },
    where: {
      status: {
        in: [
          'ORDERED',
          'SHIPPED',
          'DELIVERED',
          'INVOICED',
          'RECONCILED',
          'CLOSED',
        ],
      },
      vendor_id: { not: null },
    },
    orderBy: { _sum: { estimated_amount: 'desc' } },
    take: 5,
  })

  const vendorIds = result.map((r) => r.vendor_id).filter(Boolean) as string[]
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  })

  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]))

  return result.map((r) => ({
    vendor: vendorMap.get(r.vendor_id!) ?? 'Sconosciuto',
    amount: Number(r._sum.estimated_amount ?? 0),
  }))
}

export async function getRequestsTrend(): Promise<RequestTrend[]> {
  const now = new Date()

  const ranges = Array.from({ length: 6 }, (_, idx) => {
    const i = 5 - idx
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    return { start, end }
  })

  const counts = await prisma.$transaction(
    ranges.map((r) =>
      prisma.purchaseRequest.count({
        where: { created_at: { gte: r.start, lte: r.end } },
      }),
    ),
  )

  return ranges.map((r, idx) => ({
    period: MONTH_NAMES[r.start.getMonth()]!,
    count: counts[idx]!,
  }))
}

export async function getStatusDistribution(): Promise<StatusDistribution[]> {
  const result = await prisma.purchaseRequest.groupBy({
    by: ['status'],
    _count: { _all: true },
  })

  return result.map((r) => {
    const key = r.status as RequestStatusKey
    const config = REQUEST_STATUS_CONFIG[key]
    return {
      status: key,
      label: config?.label ?? key,
      count: r._count._all,
      color: config?.color ?? 'text-zinc-400',
    }
  })
}

export async function getMonthlySpendTrend(): Promise<MonthlySpendTrend[]> {
  const now = new Date()

  const ranges = Array.from({ length: 6 }, (_, idx) => {
    const i = 5 - idx
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    return { start, end }
  })

  const results = await prisma.$transaction(
    ranges.map((r) =>
      prisma.purchaseRequest.aggregate({
        _sum: { estimated_amount: true },
        where: {
          status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
          ordered_at: { gte: r.start, lte: r.end },
        },
      }),
    ),
  )

  return ranges.map((r, idx) => ({
    period: MONTH_NAMES[r.start.getMonth()]!,
    amount: Number(results[idx]!._sum.estimated_amount ?? 0),
  }))
}

export async function getTotalSpend(): Promise<number> {
  const result = await prisma.purchaseRequest.aggregate({
    _sum: { estimated_amount: true },
    where: {
      status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
    },
  })

  return Number(result._sum.estimated_amount ?? 0)
}

export async function getInvoiceStats(): Promise<InvoiceStats> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalInvoices,
    unmatchedInvoices,
    pendingReconciliation,
    disputedInvoices,
    totalInvoicedResult,
    totalApprovedResult,
    discrepanzeAperte,
    totaleFatturatoMeseResult,
    totaleDaPagareResult,
  ] = await prisma.$transaction([
    prisma.invoice.count(),
    prisma.invoice.count({ where: { match_status: 'UNMATCHED' } }),
    prisma.invoice.count({
      where: { reconciliation_status: { in: ['PENDING', 'MATCHED'] } },
    }),
    prisma.invoice.count({ where: { reconciliation_status: 'DISPUTED' } }),
    prisma.invoice.aggregate({ _sum: { total_amount: true } }),
    prisma.invoice.aggregate({
      _sum: { total_amount: true },
      where: { reconciliation_status: 'APPROVED' },
    }),
    prisma.invoice.count({
      where: {
        discrepancy_resolved: false,
        discrepancy_type: { not: 'NONE' },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { total_amount: true },
      where: { invoice_date: { gte: startOfMonth } },
    }),
    prisma.invoice.aggregate({
      _sum: { total_amount: true },
      where: { reconciliation_status: 'APPROVED' },
    }),
  ])

  return {
    totalInvoices,
    unmatchedInvoices,
    pendingReconciliation,
    disputedInvoices,
    totalInvoicedAmount: Number(totalInvoicedResult._sum.total_amount ?? 0),
    totalApprovedAmount: Number(totalApprovedResult._sum.total_amount ?? 0),
    discrepanzeAperte,
    totaleFatturatoMese: Number(
      totaleFatturatoMeseResult._sum.total_amount ?? 0,
    ),
    totaleDaPagare: Number(totaleDaPagareResult._sum.total_amount ?? 0),
  }
}

export async function getInvoiceMatchDistribution(): Promise<
  InvoiceMatchDistribution[]
> {
  const result = await prisma.invoice.groupBy({
    by: ['match_status'],
    _count: { _all: true },
  })

  return result.map((r) => {
    const config = INVOICE_MATCH_STATUS_CONFIG[r.match_status]
    return {
      status: r.match_status,
      label: config?.label ?? r.match_status,
      count: r._count._all,
      color: config?.color ?? 'text-zinc-400',
    }
  })
}

export async function getInvoiceAgingBuckets(): Promise<InvoiceAgingBucket[]> {
  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * 86_400_000)
  const d60 = new Date(now.getTime() - 60 * 86_400_000)
  const d90 = new Date(now.getTime() - 90 * 86_400_000)

  const [bucket0_30, bucket30_60, bucket60_90, bucket90plus] =
    await prisma.$transaction([
      prisma.invoice.count({ where: { received_at: { gte: d30 } } }),
      prisma.invoice.count({ where: { received_at: { gte: d60, lt: d30 } } }),
      prisma.invoice.count({ where: { received_at: { gte: d90, lt: d60 } } }),
      prisma.invoice.count({ where: { received_at: { lt: d90 } } }),
    ])

  return [
    { bucket: '0-30 gg', count: bucket0_30 },
    { bucket: '30-60 gg', count: bucket30_60 },
    { bucket: '60-90 gg', count: bucket60_90 },
    { bucket: '> 90 gg', count: bucket90plus },
  ]
}

export async function getOrderedVsInvoiced(): Promise<OrderedVsInvoiced[]> {
  const now = new Date()

  const ranges = Array.from({ length: 6 }, (_, idx) => {
    const i = 5 - idx
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    return { start, end }
  })

  // Batch all 12 queries (6 ordered + 6 invoiced) in a single transaction
  const allResults = await prisma.$transaction([
    ...ranges.map((r) =>
      prisma.purchaseRequest.aggregate({
        _sum: { estimated_amount: true },
        where: { ordered_at: { gte: r.start, lte: r.end } },
      }),
    ),
    ...ranges.map((r) =>
      prisma.invoice.aggregate({
        _sum: { total_amount: true },
        where: { invoice_date: { gte: r.start, lte: r.end } },
      }),
    ),
  ])

  return ranges.map((r, idx) => ({
    period: MONTH_NAMES[r.start.getMonth()]!,
    ordered: Number(
      (allResults[idx] as { _sum: { estimated_amount: unknown } })._sum
        .estimated_amount ?? 0,
    ),
    invoiced: Number(
      (allResults[idx + 6] as { _sum: { total_amount: unknown } })._sum
        .total_amount ?? 0,
    ),
  }))
}

export async function getBudgetDashboardStats() {
  return computeBudgetDashboardStats()
}
