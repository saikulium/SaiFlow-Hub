'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import type { RecentRequest } from '@/types'

interface RecentRequestsListProps {
  requests: RecentRequest[]
}

export function RecentRequestsList({ requests }: RecentRequestsListProps) {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary">
      <div className="flex items-center justify-between border-b border-pf-border px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-pf-text-primary">
          Richieste Recenti
        </h2>
        <Link
          href="/requests"
          className="flex items-center gap-1 text-sm text-pf-accent transition-colors hover:text-pf-accent-hover"
        >
          Vedi tutte
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="divide-y divide-pf-border">
        {requests.map((request, i) => (
          <motion.div
            key={request.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Link
              href={`/requests/${request.code}`}
              className="group relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-pf-bg-hover"
            >
              {/* Gradient sweep on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-pf-accent-subtle to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="relative flex flex-1 items-center gap-4">
                <span className="min-w-[120px] font-mono text-xs text-pf-text-muted">
                  {request.code}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-pf-text-primary">
                  {request.title}
                </span>
                <StatusBadge status={request.status} />
                <span className="hidden min-w-[80px] text-right text-sm text-pf-text-secondary sm:block">
                  {request.vendorName ?? '—'}
                </span>
                <span className="hidden min-w-[100px] text-right font-mono text-sm font-medium text-pf-text-primary md:block">
                  {request.estimatedAmount
                    ? formatCurrency(request.estimatedAmount)
                    : '—'}
                </span>
                <span className="hidden min-w-[80px] text-right text-xs text-pf-text-muted lg:block">
                  {formatRelativeTime(request.createdAt)}
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
