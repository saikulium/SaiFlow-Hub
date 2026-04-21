import { TENDER_STATUS_CONFIG } from '../constants'
import { cn } from '@/lib/utils'

interface TenderStatusBadgeProps {
  status: string
  pulse?: boolean
}

export function TenderStatusBadge({ status, pulse }: TenderStatusBadgeProps) {
  const config = TENDER_STATUS_CONFIG[status]
  if (!config)
    return <span className="text-xs text-pf-text-muted">{status}</span>
  const Icon = config.icon
  const shouldPulse =
    pulse ?? (status === 'EVALUATING' || status === 'UNDER_EVALUATION')

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
