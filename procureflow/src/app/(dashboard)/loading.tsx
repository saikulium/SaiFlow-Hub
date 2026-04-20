import { StatsRowSkeleton } from '@/modules/core/analytics'

export default function DashboardLoading() {
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="skeleton-shimmer h-80 rounded-card" />
        <div className="skeleton-shimmer h-80 rounded-card" />
        <div className="skeleton-shimmer h-80 rounded-card" />
      </div>
    </div>
  )
}
