interface EmptyStateProps {
  readonly icon: React.ElementType
  readonly title: string
  readonly description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-pf-bg-elevated mb-3 flex h-12 w-12 items-center justify-center rounded-full">
        <Icon className="h-6 w-6 text-pf-text-secondary" />
      </div>
      <p className="text-sm font-medium text-pf-text-primary">{title}</p>
      <p className="mt-1 text-xs text-pf-text-secondary">{description}</p>
    </div>
  )
}
