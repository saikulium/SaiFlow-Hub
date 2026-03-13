export default function BudgetsLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton-shimmer h-8 w-48 rounded" />
      <div className="skeleton-shimmer mt-2 h-4 w-72 rounded" />
      <div className="skeleton-shimmer h-96 rounded-card" />
    </div>
  )
}
