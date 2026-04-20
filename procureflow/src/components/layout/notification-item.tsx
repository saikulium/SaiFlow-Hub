'use client'

import { memo } from 'react'
import {
  Bell,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Truck,
  AlertTriangle,
} from 'lucide-react'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { NotificationItem as NotificationType } from '@/modules/core/requests'

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  approval_required: Bell,
  approval_decided: CheckCircle2,
  new_comment: MessageSquare,
  status_changed: Bell,
  request_approved: CheckCircle2,
  request_rejected: XCircle,
  delivery_overdue: AlertTriangle,
  shipment_update: Truck,
  delivery_confirmed: Truck,
  weekly_report: Bell,
  vendor_added: Bell,
}

interface NotificationItemProps {
  notification: NotificationType
  onClick: () => void
}

export const NotificationItemRow = memo(function NotificationItemRow({
  notification,
  onClick,
}: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-pf-bg-hover',
        !notification.read && 'bg-pf-accent/5',
      )}
    >
      {/* Unread dot */}
      <div className="flex h-5 w-5 shrink-0 items-center justify-center pt-0.5">
        {!notification.read ? (
          <div className="h-2 w-2 rounded-full bg-pf-accent" />
        ) : (
          <Icon className="h-4 w-4 text-pf-text-muted" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            notification.read
              ? 'text-pf-text-secondary'
              : 'font-medium text-pf-text-primary',
          )}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-pf-text-muted">
          {notification.body}
        </p>
        <p className="mt-1 text-xs text-pf-text-muted">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
    </button>
  )
})
