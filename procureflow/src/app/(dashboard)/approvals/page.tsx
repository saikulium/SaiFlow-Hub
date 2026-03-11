'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Inbox,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { ApprovalActions } from '@/components/requests/approval-actions'
import { useMyApprovals, type ApprovalItem } from '@/hooks/use-approvals'
import { APPROVAL_STATUS_CONFIG } from '@/lib/constants'
import type { PriorityKey } from '@/lib/constants'
import { formatCurrency, formatRelativeTime, cn } from '@/lib/utils'

type FilterKey = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED'

interface FilterTab {
  key: FilterKey
  label: string
  icon: React.ElementType
}

const FILTER_TABS: readonly FilterTab[] = [
  { key: 'all', label: 'Tutte', icon: Inbox },
  { key: 'PENDING', label: 'In Attesa', icon: Clock },
  { key: 'APPROVED', label: 'Approvate', icon: CheckCircle2 },
  { key: 'REJECTED', label: 'Rifiutate', icon: XCircle },
] as const

function ApprovalCard({ approval }: { approval: ApprovalItem }) {
  const statusConfig = APPROVAL_STATUS_CONFIG[approval.status] ?? {
    label: approval.status,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  }
  const isPending = approval.status === 'PENDING'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-card border border-pf-border bg-pf-bg-secondary p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/requests/${approval.request.id}`}
              className="truncate text-sm font-semibold text-pf-text-primary hover:text-pf-accent transition-colors"
            >
              {approval.request.title}
            </Link>
            <span className="shrink-0 text-xs text-pf-text-muted">
              {approval.request.code}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-pf-text-secondary">
            <span>
              Richiedente: <strong>{approval.request.requester.name}</strong>
            </span>
            {approval.request.estimated_amount !== null && (
              <span>
                Importo:{' '}
                <strong>
                  {formatCurrency(approval.request.estimated_amount)}
                </strong>
              </span>
            )}
            <PriorityBadge
              priority={approval.request.priority as PriorityKey}
            />
          </div>

          <p className="mt-1 text-xs text-pf-text-muted">
            Ricevuta {formatRelativeTime(approval.created_at)}
          </p>
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-badge px-2.5 py-0.5 text-xs font-medium',
            statusConfig.bgColor,
            statusConfig.color,
          )}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Notes if decided */}
      {approval.notes && (
        <p className="mt-3 rounded-button bg-pf-bg-primary px-3 py-2 text-xs text-pf-text-secondary">
          {approval.notes}
        </p>
      )}

      {/* Actions for pending approvals */}
      {isPending && (
        <div className="mt-4 border-t border-pf-border pt-4">
          <ApprovalActions
            approvalId={approval.id}
            approverName={approval.approver.name}
          />
        </div>
      )}
    </motion.div>
  )
}

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<FilterKey>('all')

  const queryStatus = filter === 'all' ? undefined : filter
  const { data: approvals, isLoading, error } = useMyApprovals(queryStatus)

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Approvazioni
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Gestisci le richieste di acquisto in attesa di approvazione.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="border-b border-pf-border">
          <nav className="-mb-px flex gap-6" aria-label="Filtri approvazioni">
            {FILTER_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = filter === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-pf-accent text-pf-accent'
                      : 'border-transparent text-pf-text-secondary hover:text-pf-text-primary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-pf-accent" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-red-400">
              {error instanceof Error
                ? error.message
                : 'Errore nel caricamento delle approvazioni'}
            </p>
          </div>
        )}

        {approvals && approvals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pf-bg-elevated">
              <Inbox className="h-6 w-6 text-pf-text-secondary" />
            </div>
            <p className="text-sm font-medium text-pf-text-primary">
              Nessuna approvazione
            </p>
            <p className="mt-1 text-xs text-pf-text-secondary">
              {filter === 'PENDING'
                ? 'Non ci sono richieste in attesa di approvazione.'
                : 'Non sono presenti approvazioni per questo filtro.'}
            </p>
          </div>
        )}

        {approvals && approvals.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {approvals.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
