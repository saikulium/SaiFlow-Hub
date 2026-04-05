'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Edit,
  MoreHorizontal,
  FileText,
  Clock,
  CheckCircle2,
  Paperclip,
  MessageSquare,
  Loader2,
  Send,
} from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { RequestEditDialog } from '@/components/requests/request-edit-dialog'
import { StatusStepper } from '@/components/requests/status-stepper'
import { cn } from '@/lib/utils'
import { useRequest, useSubmitRequest } from '@/hooks/use-request'
import { DettagliTab } from './tabs/dettagli-tab'
import { TimelineTab } from './tabs/timeline-tab'
import { ApprovazioniTab } from './tabs/approvazioni-tab'
import { AllegatiTab } from './tabs/allegati-tab'
import { CommentiTab } from './tabs/commenti-tab'

// --- Types ---

type TabKey = 'dettagli' | 'timeline' | 'approvazioni' | 'allegati' | 'commenti'

interface TabDef {
  readonly key: TabKey
  readonly label: string
  readonly icon: React.ElementType
}

const TABS: readonly TabDef[] = [
  { key: 'dettagli', label: 'Dettagli', icon: FileText },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'approvazioni', label: 'Approvazioni', icon: CheckCircle2 },
  { key: 'allegati', label: 'Allegati', icon: Paperclip },
  { key: 'commenti', label: 'Commenti', icon: MessageSquare },
] as const

// --- Skeleton ---

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-pf-bg-elevated h-5 w-20 rounded" />
        <div className="bg-pf-bg-elevated h-8 w-64 rounded" />
      </div>
      <div className="bg-pf-bg-elevated h-12 rounded" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-pf-bg-elevated h-9 w-28 rounded" />
        ))}
      </div>
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="bg-pf-bg-elevated h-4 w-24 rounded" />
              <div className="bg-pf-bg-elevated h-5 w-32 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

interface RequestDetailContentProps {
  requestId: string
}

function SubmitButton({ requestId }: { requestId: string }) {
  const submitMutation = useSubmitRequest(requestId)
  const [showConfirm, setShowConfirm] = useState(false)

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-pf-text-secondary">Confermi?</span>
        <button
          type="button"
          disabled={submitMutation.isPending}
          onClick={() => {
            submitMutation.mutate(undefined, {
              onSuccess: () => setShowConfirm(false),
              onError: () => setShowConfirm(false),
            })
          }}
          className="inline-flex h-10 items-center gap-2 rounded-button bg-pf-accent px-4 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitMutation.isPending ? 'Invio...' : 'Conferma'}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          className="bg-pf-bg-elevated inline-flex h-10 items-center rounded-button border border-pf-border px-3 text-sm text-pf-text-secondary transition-colors hover:bg-pf-bg-secondary"
        >
          Annulla
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="inline-flex h-10 items-center gap-2 rounded-button bg-pf-accent px-4 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
    >
      <Send className="h-4 w-4" />
      Invia per Approvazione
    </button>
  )
}

export function RequestDetailContent({ requestId }: RequestDetailContentProps) {
  const { data, isLoading, error } = useRequest(requestId)
  const [activeTab, setActiveTab] = useState<TabKey>('dettagli')
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <DetailSkeleton />
      </div>
    )
  }

  if (error || !data?.success || !data.data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-red-400">
            {error instanceof Error
              ? error.message
              : 'Errore nel caricamento della richiesta'}
          </p>
          <Link
            href="/requests"
            className="mt-4 text-sm text-pf-accent hover:underline"
          >
            Torna alle Richieste
          </Link>
        </div>
      </div>
    )
  }

  const request = data.data

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-pf-text-secondary">
            {request.code}
          </p>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            {request.title}
          </h1>
          <div className="flex items-center gap-2 pt-1">
            <StatusBadge status={request.status} />
            <PriorityBadge priority={request.priority} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {request.status === 'DRAFT' && (
            <SubmitButton requestId={request.id} />
          )}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="bg-pf-bg-elevated inline-flex h-10 items-center gap-2 rounded-button border border-pf-border px-4 text-sm font-medium text-pf-text-primary transition-colors hover:bg-pf-bg-secondary"
          >
            <Edit className="h-4 w-4" />
            Modifica
          </button>
          <button
            type="button"
            className="bg-pf-bg-elevated flex h-10 w-10 items-center justify-center rounded-button border border-pf-border text-pf-text-secondary transition-colors hover:bg-pf-bg-secondary hover:text-pf-text-primary"
            aria-label="Altre azioni"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status Stepper */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary px-6 py-4">
        <StatusStepper currentStatus={request.status} />
      </div>

      {/* Tabs */}
      <div className="border-b border-pf-border">
        <nav className="-mb-px flex gap-6" aria-label="Sezioni">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
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

      {/* Tab Content */}
      <div>
        {activeTab === 'dettagli' && <DettagliTab request={request} />}
        {activeTab === 'timeline' && <TimelineTab events={request.timeline} />}
        {activeTab === 'approvazioni' && (
          <ApprovazioniTab approvals={request.approvals} />
        )}
        {activeTab === 'allegati' && <AllegatiTab requestId={requestId} />}
        {activeTab === 'commenti' && <CommentiTab requestId={requestId} />}
      </div>

      {/* Edit Dialog */}
      <RequestEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        request={request}
      />
    </div>
  )
}

// --- Back Link ---

function BackLink() {
  return (
    <Link
      href="/requests"
      className="inline-flex items-center gap-1.5 text-sm text-pf-text-secondary transition-colors hover:text-pf-text-primary"
    >
      <ArrowLeft className="h-4 w-4" />
      Torna alle Richieste
    </Link>
  )
}
