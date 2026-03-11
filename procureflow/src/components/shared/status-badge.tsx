import { REQUEST_STATUS_CONFIG, type RequestStatusKey } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: RequestStatusKey
  pulse?: boolean
}

export function StatusBadge({ status, pulse }: StatusBadgeProps) {
  const config = REQUEST_STATUS_CONFIG[status]
  const Icon = config.icon
  const shouldPulse = pulse ?? status === 'PENDING_APPROVAL'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        shouldPulse && 'animate-pulse-subtle',
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}
