export { getTenderDashboardStats } from '@/server/services/tenders.service'
export { getInventoryDashboardStats } from '@/server/services/inventory-db.service'
import { prisma } from '@/lib/db'
import { REQUEST_STATUS_CONFIG, type RequestStatusKey } from '@/lib/constants'
import { INVOICE_MATCH_STATUS_CONFIG } from '@/lib/constants/sdi'
import { getBudgetDashboardStats as computeBudgetDashboardStats } from '@/server/services/budget.service'
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

  // Sequential queries to avoid exhausting Supabase free tier connection pool
  const activeRequests = await prisma.purchaseRequest.count({
    where: {
      status: {
        notIn: [
          'DELIVERED',
          'INVOICED',
          'RECONCILED',
          'CLOSED',
          'CANCELLED',
          'REJECTED',
        ],
      },
    },
  })
  const pendingApprovals = await prisma.purchaseRequest.count({
    where: { status: 'PENDING_APPROVAL' },
  })
  const monthlySpendResult = await prisma.purchaseRequest.aggregate({
    _sum: { estimated_amount: true },
    where: {
      status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
      ordered_at: { gte: startOfMonth },
    },
  })
  const overdueDeliveries = await prisma.purchaseRequest.count({
    where: {
      status: { in: ['ORDERED', 'SHIPPED'] },
      expected_delivery: { lt: now },
    },
  })
  const prevActiveRequests = await prisma.purchaseRequest.count({
    where: {
      status: {
        notIn: [
          'DELIVERED',
          'INVOICED',
          'RECONCILED',
          'CLOSED',
          'CANCELLED',
          'REJECTED',
        ],
      },
      created_at: { lt: startOfMonth },
    },
  })
  const prevPendingApprovals = await prisma.purchaseRequest.count({
    where: {
      status: 'PENDING_APPROVAL',
      created_at: { lt: startOfMonth },
    },
  })
  const prevMonthlySpendResult = await prisma.purchaseRequest.aggregate({
    _sum: { estimated_amount: true },
    where: {
      status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
      ordered_at: { gte: startOfLastMonth, lt: endOfLastMonth },
    },
  })
  const prevOverdueDeliveries = await prisma.purchaseRequest.count({
    where: {
      status: { in: ['ORDERED', 'SHIPPED'] },
      expected_delivery: { lt: startOfMonth },
    },
  })

  return {
    activeRequests,
    pendingApprovals,
    monthlySpend: Number(monthlySpendResult._sum.estimated_amount ?? 0),
    monthlyBudget: await (async () => {
      try {
        const now = new Date()
        const activeBudgets = await prisma.budget.findMany({
          where: {
            is_active: true,
            period_start: { lte: now },
            period_end: { gte: now },
          },
          select: { allocated_amount: true },
        })
        if (activeBudgets.length === 0) return 50000
        return activeBudgets.reduce(
          (sum, b) => sum + Number(b.allocated_amount),
          0,
        )
      } catch {
        return 50000
      }
    })(),
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
  const months: RequestTrend[] = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

    const count = await prisma.purchaseRequest.count({
      where: {
        created_at: { gte: start, lte: end },
      },
    })

    const monthNames = [
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
    months.push({
      period: monthNames[start.getMonth()]!,
      count,
    })
  }

  return months
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
  const months: MonthlySpendTrend[] = []

  const monthNames = [
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

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

    const result = await prisma.purchaseRequest.aggregate({
      _sum: { estimated_amount: true },
      where: {
        status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
        ordered_at: { gte: start, lte: end },
      },
    })

    months.push({
      period: monthNames[start.getMonth()]!,
      amount: Number(result._sum.estimated_amount ?? 0),
    })
  }

  return months
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
  ] = await Promise.all([
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
      where: {
        invoice_date: { gte: startOfMonth },
      },
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
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const bucket0_30 = await prisma.invoice.count({
    where: { received_at: { gte: d30 } },
  })
  const bucket30_60 = await prisma.invoice.count({
    where: { received_at: { gte: d60, lt: d30 } },
  })
  const bucket60_90 = await prisma.invoice.count({
    where: { received_at: { gte: d90, lt: d60 } },
  })
  const bucket90plus = await prisma.invoice.count({
    where: { received_at: { lt: d90 } },
  })

  return [
    { bucket: '0-30 gg', count: bucket0_30 },
    { bucket: '30-60 gg', count: bucket30_60 },
    { bucket: '60-90 gg', count: bucket60_90 },
    { bucket: '> 90 gg', count: bucket90plus },
  ]
}

export async function getOrderedVsInvoiced(): Promise<OrderedVsInvoiced[]> {
  const now = new Date()
  const months: OrderedVsInvoiced[] = []

  const monthNames = [
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

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

    const orderedResult = await prisma.purchaseRequest.aggregate({
      _sum: { estimated_amount: true },
      where: {
        ordered_at: { gte: start, lte: end },
      },
    })

    const invoicedResult = await prisma.invoice.aggregate({
      _sum: { total_amount: true },
      where: {
        invoice_date: { gte: start, lte: end },
      },
    })

    months.push({
      period: monthNames[start.getMonth()]!,
      ordered: Number(orderedResult._sum.estimated_amount ?? 0),
      invoiced: Number(invoicedResult._sum.total_amount ?? 0),
    })
  }

  return months
}

export async function getBudgetDashboardStats() {
  return computeBudgetDashboardStats()
}
