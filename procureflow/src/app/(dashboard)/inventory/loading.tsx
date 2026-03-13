export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="skeleton-shimmer h-8 w-48 rounded-button" />
        <div className="skeleton-shimmer h-10 w-36 rounded-button" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer h-9 w-28 rounded-button" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="skeleton-shimmer h-12 w-full rounded-button" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-shimmer h-14 w-full rounded-button" />
        ))}
      </div>
    </div>
  )
}
