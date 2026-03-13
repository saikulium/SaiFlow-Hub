export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="skeleton-shimmer h-8 w-48 rounded-button" />
        <div className="skeleton-shimmer h-10 w-36 rounded-button" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-shimmer h-40 rounded-card" />
        ))}
      </div>
    </div>
  )
}
