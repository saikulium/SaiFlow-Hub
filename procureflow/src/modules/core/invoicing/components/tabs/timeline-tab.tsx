'use client'

import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import type { InvoiceDetail } from '../../hooks/use-invoice'
import { formatRelativeTime } from '@/lib/utils'

interface TimelineTabProps {
  events: InvoiceDetail['timeline_events']
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  status_change: 'bg-pf-accent',
  match: 'bg-green-500',
  unmatch: 'bg-red-500',
  reconciliation: 'bg-amber-500',
  import: 'bg-blue-500',
}

function getDotColor(type: string): string {
  return EVENT_TYPE_COLORS[type] ?? 'bg-pf-accent'
}

export function TimelineTab({ events }: TimelineTabProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pf-bg-tertiary">
          <Clock className="h-6 w-6 text-pf-text-secondary" />
        </div>
        <p className="text-sm font-medium text-pf-text-primary">
          Nessun evento registrato
        </p>
        <p className="mt-1 text-xs text-pf-text-secondary">
          La timeline verrà aggiornata man mano che la fattura avanza.
        </p>
      </div>
    )
  }

  return (
    <div className="relative space-y-0 pl-6">
      {/* Vertical line */}
      <div className="absolute bottom-2 left-[11px] top-2 w-px bg-pf-border" />

      {events.map((event, index) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="relative flex gap-4 pb-6 last:pb-0"
        >
          {/* Dot */}
          <div className="absolute -left-6 top-1 flex h-[22px] w-[22px] items-center justify-center">
            <div
              className={`h-2.5 w-2.5 rounded-full ring-4 ring-pf-bg-primary ${getDotColor(event.type)}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-pf-text-primary">
                  {event.title}
                </p>
                {event.description && (
                  <p className="mt-0.5 text-xs text-pf-text-secondary">
                    {event.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-pf-text-secondary">
                {event.actor && <span>{event.actor}</span>}
                {event.actor && <span>&middot;</span>}
                <span>{formatRelativeTime(event.created_at)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
