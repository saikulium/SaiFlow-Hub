import {
  STOCK_STATUS_CONFIG,
  type StockStatusKey,
} from '../constants/inventory'
import { cn } from '@/lib/utils'

interface StockLevelBadgeProps {
  status: StockStatusKey
}

export function StockLevelBadge({ status }: StockLevelBadgeProps) {
  const config = STOCK_STATUS_CONFIG[status]
  if (!config)
    return <span className="text-xs text-pf-text-muted">{status}</span>
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        config.pulse && 'animate-pulse-subtle',
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}
