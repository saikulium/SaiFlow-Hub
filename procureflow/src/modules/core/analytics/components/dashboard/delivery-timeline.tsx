'use client'

import { motion } from 'framer-motion'
import { Package, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { DeliveryItem } from '@/types'

interface DeliveryTimelineProps {
  deliveries: DeliveryItem[]
}

const statusConfig = {
  on_time: {
    color: 'bg-pf-success',
    textColor: 'text-pf-success',
    icon: CheckCircle2,
    label: 'In orario',
  },
  at_risk: {
    color: 'bg-pf-warning',
    textColor: 'text-pf-warning',
    icon: Clock,
    label: 'Questa settimana',
  },
  overdue: {
    color: 'bg-pf-danger',
    textColor: 'text-pf-danger',
    icon: AlertTriangle,
    label: 'In ritardo',
  },
}

export function DeliveryTimeline({ deliveries }: DeliveryTimelineProps) {
  if (deliveries.length === 0) {
    return (
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
        <h2 className="mb-4 font-display text-lg font-semibold text-pf-text-primary">
          Prossime Consegne
        </h2>
        <div className="flex items-center justify-center py-8 text-pf-text-muted">
          <Package className="mr-2 h-5 w-5" />
          Nessuna consegna in programma
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h2 className="mb-4 font-display text-lg font-semibold text-pf-text-primary">
        Prossime Consegne
      </h2>

      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[15px] top-6 bottom-6 w-px bg-pf-border" />

        <div className="space-y-4">
          {deliveries.map((delivery, i) => {
            const config = statusConfig[delivery.status]
            const StatusIcon = config.icon

            return (
              <motion.div
                key={delivery.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                className="relative flex items-start gap-4 pl-1"
              >
                {/* Dot */}
                <div
                  className={cn(
                    'relative z-10 mt-1.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full',
                    delivery.status === 'overdue'
                      ? 'bg-red-500/10'
                      : delivery.status === 'at_risk'
                        ? 'bg-amber-500/10'
                        : 'bg-green-500/10',
                  )}
                >
                  <div
                    className={cn('h-2.5 w-2.5 rounded-full', config.color)}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-pf-text-muted">
                      {delivery.code}
                    </span>
                    <span className={cn('flex items-center gap-1 text-xs', config.textColor)}>
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-pf-text-primary">
                    {delivery.title}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-pf-text-muted">
                    <span>{delivery.vendorName}</span>
                    <span>·</span>
                    <span>{formatDate(delivery.expectedDelivery)}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
