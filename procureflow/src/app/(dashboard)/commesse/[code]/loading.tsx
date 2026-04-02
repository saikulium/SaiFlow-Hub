export default function Loading() {
  return (
    <div className="space-y-6 p-2">
      <div className="skeleton-shimmer h-10 w-64 rounded-button" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer h-24 rounded-card" />
        ))}
      </div>
      <div className="skeleton-shimmer h-64 rounded-card" />
    </div>
  )
}
