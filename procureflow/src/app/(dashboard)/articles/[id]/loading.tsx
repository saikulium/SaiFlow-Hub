export default function Loading() {
  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center gap-3">
        <div className="skeleton-shimmer h-8 w-8 rounded-button" />
        <div className="skeleton-shimmer h-8 w-64 rounded-button" />
      </div>
      <div className="skeleton-shimmer h-10 w-full rounded-button" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-shimmer h-14 rounded-card" />
        ))}
      </div>
    </div>
  )
}
