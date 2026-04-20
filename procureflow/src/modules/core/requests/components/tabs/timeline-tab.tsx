'use client'

import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { TimelineEvent } from '../../hooks/use-request'
import { EmptyState } from './empty-state'

export function TimelineTab({
  events,
}: {
  readonly events: readonly TimelineEvent[]
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Nessun evento"
        description="La timeline verrà aggiornata man mano che la richiesta avanza."
      />
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
            <div className="h-2.5 w-2.5 rounded-full bg-pf-accent ring-4 ring-pf-bg-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-pf-text-primary">
              {event.title}
            </p>
            {event.description && (
              <p className="mt-0.5 text-xs text-pf-text-secondary">
                {event.description}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2 text-xs text-pf-text-secondary">
              {event.actor && <span>{event.actor.name}</span>}
              {event.actor && <span>&middot;</span>}
              <span>{formatRelativeTime(event.created_at)}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
