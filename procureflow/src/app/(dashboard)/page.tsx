export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { PageTransition } from '@/components/shared/page-transition'
import { StatsRow } from '@/components/dashboard/stats-row'
import { StatsRowSkeleton } from '@/components/dashboard/stat-card-skeleton'
import { DashboardTabs } from '@/components/dashboard/dashboard-tabs'
import {
  getDashboardStats,
  getRecentRequests,
  getUpcomingDeliveries,
  getSpendByVendor,
  getRequestsTrend,
  getStatusDistribution,
  getMonthlySpendTrend,
  getInvoiceStats,
  getInvoiceMatchDistribution,
  getInvoiceAgingBuckets,
  getOrderedVsInvoiced,
  getBudgetDashboardStats,
  getTenderDashboardStats,
  getInventoryDashboardStats,
} from '@/server/services/dashboard.service'
import { getRoiSummaryOnly } from '@/server/services/roi-metrics.service'
import { getEnabledModules } from '@/server/services/module.service'

const DEFAULT_INVOICE_STATS = {
  totalInvoices: 0,
  unmatchedInvoices: 0,
  pendingReconciliation: 0,
  disputedInvoices: 0,
  totalInvoicedAmount: 0,
  totalApprovedAmount: 0,
  discrepanzeAperte: 0,
  totaleFatturatoMese: 0,
  totaleDaPagare: 0,
}

const DEFAULT_TENDER_STATS = {
  activeTenders: 0,
  pipelineValue: 0,
  upcomingDeadlines: 0,
  winRate: 0,
  winRatePrevious: 0,
  byStatus: [],
  recentResults: [],
  nearDeadlines: [],
}

const DEFAULT_INVENTORY_STATS = {
  totalMaterials: 0,
  totalWarehouseValue: 0,
  lowStockCount: 0,
  lowStockCountPrevious: 0,
  recentMovements: 0,
  valueByCategory: [] as never[],
  movementTrend: [] as never[],
  lowStockAlerts: [] as never[],
}

const DEFAULT_BUDGET_STATS = {
  totalAllocated: 0,
  totalSpent: 0,
  totalCommitted: 0,
  totalAvailable: 0,
  centricostoInWarning: 0,
  centricostoSforati: 0,
  budgets: [] as never[],
}

async function DashboardContent() {
  const modules = await getEnabledModules()
  const hasInvoicing = modules.includes('invoicing')
  const hasBudgets = modules.includes('budgets')
  const hasAnalytics = modules.includes('analytics')
  const hasTenders = modules.includes('tenders')
  const hasInventory = modules.includes('inventory')

  // Fetch all dashboard data in parallel — each function uses $transaction internally
  const [
    stats,
    recentRequests,
    deliveries,
    statusDist,
    monthlySpend,
    spendByVendor,
    trend,
    invoiceStats,
    matchDist,
    invoiceAging,
    orderedVsInvoiced,
    budgetStats,
    tenderStats,
    inventoryStats,
    roiSummary,
  ] = await Promise.all([
    getDashboardStats(),
    getRecentRequests(10),
    getUpcomingDeliveries(5),
    getStatusDistribution(),
    getMonthlySpendTrend(),
    hasAnalytics ? getSpendByVendor() : Promise.resolve([]),
    hasAnalytics ? getRequestsTrend() : Promise.resolve([]),
    hasInvoicing ? getInvoiceStats() : Promise.resolve(DEFAULT_INVOICE_STATS),
    hasInvoicing ? getInvoiceMatchDistribution() : Promise.resolve([]),
    hasInvoicing ? getInvoiceAgingBuckets() : Promise.resolve([]),
    hasInvoicing ? getOrderedVsInvoiced() : Promise.resolve([]),
    hasBudgets
      ? getBudgetDashboardStats().catch(() => DEFAULT_BUDGET_STATS)
      : Promise.resolve(DEFAULT_BUDGET_STATS),
    hasTenders
      ? getTenderDashboardStats().catch(() => DEFAULT_TENDER_STATS)
      : Promise.resolve(DEFAULT_TENDER_STATS),
    hasInventory
      ? getInventoryDashboardStats().catch(() => DEFAULT_INVENTORY_STATS)
      : Promise.resolve(DEFAULT_INVENTORY_STATS),
    hasAnalytics
      ? getRoiSummaryOnly().catch(() => null)
      : Promise.resolve(null),
  ])

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page title */}
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Panoramica del procurement aziendale
          </p>
        </div>

        {/* Stats Row — always visible */}
        <StatsRow stats={stats} />

        {/* Tabbed Content */}
        <DashboardTabs
          recentRequests={recentRequests}
          deliveries={deliveries}
          monthlySpend={monthlySpend}
          statusDist={statusDist}
          invoiceStats={invoiceStats}
          matchDist={matchDist}
          invoiceAging={invoiceAging}
          orderedVsInvoiced={orderedVsInvoiced}
          budgetStats={budgetStats}
          tenderStats={tenderStats}
          inventoryStats={inventoryStats}
          spendByVendor={spendByVendor}
          trend={trend}
          roiSummary={roiSummary}
        />
      </div>
    </PageTransition>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton-shimmer h-8 w-40 rounded" />
        <div className="skeleton-shimmer mt-2 h-4 w-64 rounded" />
      </div>
      <StatsRowSkeleton />
      {/* Tab bar skeleton */}
      <div className="flex gap-1 rounded-lg border border-pf-border bg-pf-bg-secondary p-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-shimmer h-9 w-28 rounded-md" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="skeleton-shimmer h-96 rounded-card" />
        <div className="space-y-6">
          <div className="skeleton-shimmer h-48 rounded-card" />
          <div className="skeleton-shimmer h-64 rounded-card" />
        </div>
      </div>
    </div>
  )
}
