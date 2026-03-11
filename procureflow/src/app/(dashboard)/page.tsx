export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { PageTransition } from '@/components/shared/page-transition'
import { StatsRow } from '@/components/dashboard/stats-row'
import { StatsRowSkeleton } from '@/components/dashboard/stat-card-skeleton'
import { RecentRequestsList } from '@/components/dashboard/recent-requests-list'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { DeliveryTimeline } from '@/components/dashboard/delivery-timeline'
import { SpendByVendorChart } from '@/components/dashboard/spend-by-vendor-chart'
import { RequestsTrendChart } from '@/components/dashboard/requests-trend-chart'
import { StatusDistributionChart } from '@/components/dashboard/status-distribution-chart'
import { MonthlySpendTrendChart } from '@/components/dashboard/monthly-spend-trend-chart'
import {
  getDashboardStats,
  getRecentRequests,
  getUpcomingDeliveries,
  getSpendByVendor,
  getRequestsTrend,
  getStatusDistribution,
  getMonthlySpendTrend,
} from '@/server/services/dashboard.service'

async function DashboardContent() {
  // Sequential queries to avoid exhausting connection pool on Supabase free tier
  const stats = await getDashboardStats()
  const recentRequests = await getRecentRequests(10)
  const deliveries = await getUpcomingDeliveries(5)
  const spendByVendor = await getSpendByVendor()
  const trend = await getRequestsTrend()
  const statusDist = await getStatusDistribution()
  const monthlySpend = await getMonthlySpendTrend()

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

        {/* Stats Row */}
        <StatsRow stats={stats} />

        {/* Main content: Recent Requests + Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <RecentRequestsList requests={recentRequests} />
          <div className="space-y-6">
            <QuickActions />
            <DeliveryTimeline deliveries={deliveries} />
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 md:grid-cols-2">
          <MonthlySpendTrendChart data={monthlySpend} />
          <StatusDistributionChart data={statusDist} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 md:grid-cols-2">
          <SpendByVendorChart data={spendByVendor} />
          <RequestsTrendChart data={trend} />
        </div>
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
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="skeleton-shimmer h-96 rounded-card" />
        <div className="space-y-6">
          <div className="skeleton-shimmer h-48 rounded-card" />
          <div className="skeleton-shimmer h-64 rounded-card" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="skeleton-shimmer h-80 rounded-card" />
        <div className="skeleton-shimmer h-80 rounded-card" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="skeleton-shimmer h-80 rounded-card" />
        <div className="skeleton-shimmer h-80 rounded-card" />
      </div>
    </div>
  )
}
