export default function Loading() {
  return (
    <div className="space-y-6 p-2">
      <div className="skeleton-shimmer h-8 w-48 rounded-button" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-shimmer h-32 rounded-card" />
        ))}
      </div>
    </div>
  )
}

