import { PRIORITY_CONFIG, type PriorityKey } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface PriorityBadgeProps {
  priority: PriorityKey
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        priority === 'URGENT' && 'animate-pulse-subtle',
      )}
    >
      {config.label}
    </span>
  )
}
