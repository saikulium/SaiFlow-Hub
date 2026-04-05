interface SkeletonRowProps {
  readonly columns: number
}

export function SkeletonRow({ columns }: SkeletonRowProps) {
  return (
    <tr className="border-b border-pf-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton-shimmer h-4 w-full rounded" />
        </td>
      ))}
    </tr>
  )
}

interface SkeletonRowsProps {
  readonly count?: number
  readonly columns: number
}

export function SkeletonRows({ count = 5, columns }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </>
  )
}
