export function StatCardSkeleton() {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="skeleton-shimmer h-4 w-32 rounded" />
          <div className="skeleton-shimmer h-9 w-24 rounded" />
        </div>
        <div className="skeleton-shimmer h-10 w-10 rounded-card" />
      </div>
      <div className="mt-3">
        <div className="skeleton-shimmer h-3 w-28 rounded" />
      </div>
    </div>
  )
}

export function StatsRowSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}
