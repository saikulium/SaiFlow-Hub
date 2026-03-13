export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="skeleton-shimmer h-8 w-40 rounded-button" />
        <div className="skeleton-shimmer h-10 w-32 rounded-button" />
      </div>
      <div className="space-y-2">
        <div className="skeleton-shimmer h-12 w-full rounded-button" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-shimmer h-14 w-full rounded-button" />
        ))}
      </div>
    </div>
  )
}
