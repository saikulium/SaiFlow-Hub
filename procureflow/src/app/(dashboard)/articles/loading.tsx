export default function Loading() {
  return (
    <div className="space-y-6 p-2">
      <div className="skeleton-shimmer h-8 w-48 rounded-button" />
      <div className="skeleton-shimmer h-10 w-full rounded-button" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="skeleton-shimmer h-14 rounded-card" />
        ))}
      </div>
    </div>
  )
}
