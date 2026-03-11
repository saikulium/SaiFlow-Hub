'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  REQUEST_STATUS_CONFIG,
  type RequestStatusKey,
} from '@/lib/constants'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { formatCurrency, cn } from '@/lib/utils'
import type { RequestListItem } from '@/hooks/use-requests'

const KANBAN_STATUSES: readonly RequestStatusKey[] = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ORDERED',
  'DELIVERED',
] as const

const STATUS_BORDER_COLORS: Record<RequestStatusKey, string> = {
  DRAFT: 'border-t-zinc-400',
  SUBMITTED: 'border-t-blue-400',
  PENDING_APPROVAL: 'border-t-amber-400',
  APPROVED: 'border-t-green-400',
  REJECTED: 'border-t-red-400',
  ORDERED: 'border-t-indigo-400',
  SHIPPED: 'border-t-cyan-400',
  DELIVERED: 'border-t-emerald-400',
  CANCELLED: 'border-t-zinc-500',
  ON_HOLD: 'border-t-orange-400',
}

interface RequestsKanbanProps {
  data: RequestListItem[]
  isLoading: boolean
}

interface KanbanCardProps {
  request: RequestListItem
  index: number
}

function KanbanCard({ request, index }: KanbanCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      layout
    >
      <Link
        href={`/requests/${request.id}`}
        className="block rounded-card border border-pf-border bg-pf-bg-primary/60 p-3 transition-colors hover:border-pf-accent/40 hover:bg-pf-bg-elevated/50"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium text-pf-accent">
            {request.code}
          </span>
          <PriorityBadge priority={request.priority} />
        </div>
        <p className="mb-2 line-clamp-2 text-sm font-medium text-pf-text-primary">
          {request.title}
        </p>
        <div className="flex items-center justify-between text-xs text-pf-text-secondary">
          <span className="truncate">{request.vendor?.name ?? '—'}</span>
          {request.estimated_amount !== null && (
            <span className="ml-2 shrink-0 font-mono">
              {formatCurrency(request.estimated_amount)}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

function KanbanColumnSkeleton() {
  return (
    <div className="flex min-w-[260px] flex-col gap-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-card border border-pf-border bg-pf-bg-elevated/40"
        />
      ))}
    </div>
  )
}

export function RequestsKanban({ data, isLoading }: RequestsKanbanProps) {
  const columnData = useMemo(() => {
    const grouped = new Map<RequestStatusKey, RequestListItem[]>()
    for (const status of KANBAN_STATUSES) {
      grouped.set(status, [])
    }
    for (const request of data) {
      const column = grouped.get(request.status)
      if (column) {
        column.push(request)
      }
    }
    return grouped
  }, [data])

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STATUSES.map((status) => (
          <div key={status} className="min-w-[280px] flex-1">
            <div className="mb-3 h-8 w-32 animate-pulse rounded bg-pf-bg-elevated/40" />
            <KanbanColumnSkeleton />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_STATUSES.map((status) => {
        const config = REQUEST_STATUS_CONFIG[status]
        const items = columnData.get(status) ?? []

        return (
          <div key={status} className="min-w-[280px] flex-1">
            {/* Column header */}
            <div
              className={cn(
                'mb-3 rounded-card border border-pf-border border-t-2 bg-pf-bg-secondary/60 px-3 py-2 backdrop-blur-xl',
                STATUS_BORDER_COLORS[status],
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <config.icon className={cn('h-4 w-4', config.color)} />
                  <span className="text-sm font-medium text-pf-text-primary">
                    {config.label}
                  </span>
                </div>
                <span
                  className={cn(
                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                    config.bgColor,
                    config.color,
                  )}
                >
                  {items.length}
                </span>
              </div>
            </div>

            {/* Column cards */}
            <div className="flex max-h-[calc(100vh-340px)] flex-col gap-2 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <div className="rounded-card border border-dashed border-pf-border/60 p-4 text-center text-xs text-pf-text-secondary/60">
                  Nessuna richiesta
                </div>
              ) : (
                items.map((request, index) => (
                  <KanbanCard key={request.id} request={request} index={index} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
