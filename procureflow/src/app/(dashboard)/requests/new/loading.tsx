export default function Loading() {
  return (
    <div className="space-y-6 p-2">
      <div className="skeleton-shimmer h-8 w-48 rounded-button" />
      <div className="skeleton-shimmer h-64 rounded-card" />
    </div>
  )
}

