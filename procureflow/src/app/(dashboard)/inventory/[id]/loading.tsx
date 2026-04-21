export default function Loading() {
  return (
    <div className="space-y-6 p-2">
      <div className="skeleton-shimmer h-8 w-64 rounded-button" />
      <div className="skeleton-shimmer h-4 w-40 rounded" />
      <div className="space-y-4">
        <div className="skeleton-shimmer h-48 rounded-card" />
        <div className="skeleton-shimmer h-32 rounded-card" />
      </div>
    </div>
  )
}

