import { cn } from '@/lib/utils'
import {
  INVOICE_MATCH_STATUS_CONFIG,
  RECONCILIATION_STATUS_CONFIG,
} from '@/lib/constants/sdi'

interface InvoiceStatusBadgeProps {
  type: 'match' | 'reconciliation'
  status: string
}

export function InvoiceStatusBadge({ type, status }: InvoiceStatusBadgeProps) {
  const config =
    type === 'match'
      ? INVOICE_MATCH_STATUS_CONFIG[status]
      : RECONCILIATION_STATUS_CONFIG[status]

  if (!config)
    return <span className="text-xs text-pf-text-muted">{status}</span>

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
      )}
    >
      {config.label}
    </span>
  )
}
