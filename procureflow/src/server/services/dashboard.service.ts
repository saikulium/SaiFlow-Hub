import { prisma } from '@/lib/db'
import { REQUEST_STATUS_CONFIG, type RequestStatusKey } from '@/lib/constants'
import type {
  DashboardStats,
  RecentRequest,
  DeliveryItem,
  SpendByVendor,
  RequestTrend,
  StatusDistribution,
  MonthlySpendTrend,
} from '@/types'

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  // Sequential queries to avoid exhausting Supabase free tier connection pool
  const activeRequests = await prisma.purchaseRequest.count({
    where: { status: { notIn: ['DELIVERED', 'CANCELLED', 'REJECTED'] } },
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
      status: { notIn: ['DELIVERED', 'CANCELLED', 'REJECTED'] },
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
    monthlyBudget: 50000, // Demo budget
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
      status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
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
