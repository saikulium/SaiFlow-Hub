interface TableEmptyStateProps {
  readonly icon: React.ElementType
  readonly colSpan: number
  readonly title: string
  readonly description: string
}

export function TableEmptyState({
  icon: Icon,
  colSpan,
  title,
  description,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16 text-center">
        <Icon className="mx-auto mb-3 h-10 w-10 text-pf-text-muted" />
        <p className="text-sm font-medium text-pf-text-secondary">{title}</p>
        <p className="mt-1 text-xs text-pf-text-muted">{description}</p>
      </td>
    </tr>
  )
}
