'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Sparkles,
  Clock,
  TrendingUp,
  TrendingDown,
  Banknote,
  Receipt,
  Loader2,
  Plus,
} from 'lucide-react'
import {
  useCommessaDetail,
  useAcceptSuggestion,
  useRejectSuggestion,
  useUpdateCommessa,
} from '@/hooks/use-commesse'
import { SuggestionCard } from '@/components/commesse/suggestion-card'
import { cn } from '@/lib/utils'
import { REQUEST_STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants'
import type {
  CommessaDetail as CommessaDetailType,
  CommessaRequestItem,
  CommessaTimelineItem,
} from '@/types'
import { toast } from 'sonner'

interface CommessaDetailProps {
  readonly code: string
}

const COMMESSA_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  DRAFT: { label: 'Bozza', color: 'text-zinc-400', bgColor: 'bg-zinc-400/10' },
  PLANNING: {
    label: 'Pianificazione',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  ACTIVE: {
    label: 'Attiva',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  ON_HOLD: {
    label: 'Sospesa',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  COMPLETED: {
    label: 'Completata',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  CANCELLED: {
    label: 'Annullata',
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-500/10',
  },
}

type TabId = 'requests' | 'timeline' | 'details'

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'requests', label: 'Richieste' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'details', label: 'Dettagli' },
]

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: typeof Banknote
  accent?: 'green' | 'red' | 'default'
}) {
  const colorMap = {
    green: 'text-green-400',
    red: 'text-red-400',
    default: 'text-pf-text-primary',
  }
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <div className="flex items-center gap-2 text-sm text-pf-text-secondary">
        <Icon className="h-4 w-4 text-pf-text-muted" />
        {label}
      </div>
      <p
        className={cn(
          'mt-2 font-display text-2xl font-bold',
          colorMap[accent ?? 'default'],
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function CommessaDetail({ code }: CommessaDetailProps) {
  const { data: commessa, isLoading, error } = useCommessaDetail(code)
  const [activeTab, setActiveTab] = useState<TabId>('requests')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton-shimmer h-10 w-64 rounded-button" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-24 rounded-card" />
          ))}
        </div>
        <div className="skeleton-shimmer h-64 rounded-card" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        {error instanceof Error
          ? error.message
          : 'Errore nel caricamento della commessa'}
      </div>
    )
  }

  if (!commessa) {
    return (
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-8 text-center">
        <p className="text-pf-text-secondary">Commessa non trovata</p>
      </div>
    )
  }

  const statusConfig = COMMESSA_STATUS_CONFIG[commessa.status] ?? {
    label: commessa.status,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  }

  const marginAccent: 'green' | 'red' | 'default' =
    commessa.margin == null ? 'default' : commessa.margin >= 0 ? 'green' : 'red'

  const marginDisplay =
    commessa.margin != null && commessa.marginPercent != null
      ? `${formatCurrency(commessa.margin)} (${commessa.marginPercent.toFixed(1)}%)`
      : '—'

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/commesse"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-pf-text-secondary hover:text-pf-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alle commesse
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-pf-text-primary">
                {commessa.title}
              </h1>
              <span
                className={cn(
                  'rounded-badge px-2.5 py-0.5 text-xs font-medium',
                  statusConfig.bgColor,
                  statusConfig.color,
                )}
              >
                {statusConfig.label}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-pf-text-secondary">
              <span className="font-mono text-xs text-pf-text-muted">
                {commessa.code}
              </span>
              <span>{commessa.clientName}</span>
              {commessa.deadline && (
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDate(commessa.deadline)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Valore Cliente"
          value={formatCurrency(commessa.clientValue)}
          icon={Banknote}
        />
        <StatCard
          label="Costi"
          value={formatCurrency(commessa.totalCosts)}
          icon={Receipt}
        />
        <StatCard
          label="Margine"
          value={marginDisplay}
          icon={marginAccent === 'red' ? TrendingDown : TrendingUp}
          accent={marginAccent}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-pf-border bg-pf-bg-secondary p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-all duration-150',
              activeTab === tab.id
                ? 'bg-pf-accent text-white shadow-sm'
                : 'text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in-up">
        {activeTab === 'requests' && (
          <RequestsTab commessa={commessa} code={code} />
        )}
        {activeTab === 'timeline' && (
          <TimelineTab timeline={commessa.timeline} />
        )}
        {activeTab === 'details' && (
          <DetailsTab commessa={commessa} code={code} />
        )}
      </div>
    </div>
  )
}

// --- Requests Tab ---

function RequestsTab({
  commessa,
  code,
}: {
  readonly commessa: CommessaDetailType
  readonly code: string
}) {
  const acceptMutation = useAcceptSuggestion(code)
  const rejectMutation = useRejectSuggestion(code)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleAccept = async (id: string) => {
    setProcessingId(id)
    try {
      await acceptMutation.mutateAsync(id)
      toast.success('Suggerimento accettato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id: string) => {
    setProcessingId(id)
    try {
      await rejectMutation.mutateAsync(id)
      toast.success('Suggerimento rifiutato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* AI Suggestions */}
      {commessa.suggestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-pf-text-secondary">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Suggerimenti AI ({commessa.suggestions.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {commessa.suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={handleAccept}
                onReject={handleReject}
                isAccepting={processingId === s.id && acceptMutation.isPending}
                isRejecting={processingId === s.id && rejectMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Requests */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium text-pf-text-secondary">
            <ClipboardList className="h-4 w-4" />
            Richieste di acquisto ({commessa.requests.length})
          </h3>
          <Link
            href={`/requests/new?commessa_id=${commessa.id}`}
            className="bg-pf-accent/10 hover:bg-pf-accent/20 inline-flex h-8 items-center gap-1.5 rounded-button px-3 text-xs font-medium text-pf-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuova Richiesta
          </Link>
        </div>
        {commessa.requests.length === 0 ? (
          <p className="rounded-card border border-pf-border bg-pf-bg-secondary p-6 text-center text-sm text-pf-text-muted">
            Nessuna richiesta di acquisto collegata
          </p>
        ) : (
          <div className="overflow-hidden rounded-card border border-pf-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border bg-pf-bg-tertiary text-left">
                  <th className="px-4 py-2.5 font-medium text-pf-text-secondary">
                    Codice
                  </th>
                  <th className="px-4 py-2.5 font-medium text-pf-text-secondary">
                    Titolo
                  </th>
                  <th className="px-4 py-2.5 font-medium text-pf-text-secondary">
                    Stato
                  </th>
                  <th className="hidden px-4 py-2.5 font-medium text-pf-text-secondary md:table-cell">
                    Fornitore
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-pf-text-secondary">
                    Importo
                  </th>
                </tr>
              </thead>
              <tbody>
                {commessa.requests.map((req) => {
                  const reqStatus =
                    REQUEST_STATUS_CONFIG[
                      req.status as keyof typeof REQUEST_STATUS_CONFIG
                    ]
                  return (
                    <tr
                      key={req.id}
                      className="border-b border-pf-border last:border-b-0 hover:bg-pf-bg-hover"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-pf-accent">
                        <Link
                          href={`/requests/${req.id}`}
                          className="hover:text-pf-accent-hover"
                        >
                          {req.code}
                        </Link>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-pf-text-primary">
                        {req.title}
                      </td>
                      <td className="px-4 py-2.5">
                        {reqStatus ? (
                          <span
                            className={cn(
                              'rounded-badge px-2 py-0.5 text-xs font-medium',
                              reqStatus.bgColor,
                              reqStatus.color,
                            )}
                          >
                            {reqStatus.label}
                          </span>
                        ) : (
                          <span className="text-xs text-pf-text-muted">
                            {req.status}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-2.5 text-pf-text-secondary md:table-cell">
                        {req.vendorName || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-pf-text-secondary">
                        {formatCurrency(
                          req.actualAmount ?? req.estimatedAmount,
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Timeline Tab ---

function TimelineTab({
  timeline,
}: {
  readonly timeline: readonly CommessaTimelineItem[]
}) {
  if (timeline.length === 0) {
    return (
      <p className="rounded-card border border-pf-border bg-pf-bg-secondary p-6 text-center text-sm text-pf-text-muted">
        Nessun evento nella timeline
      </p>
    )
  }

  return (
    <div className="relative space-y-0 pl-6">
      {/* Vertical line */}
      <div className="absolute bottom-2 left-[11px] top-2 w-px bg-pf-border" />

      {timeline.map((event, i) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="relative pb-6 last:pb-0"
        >
          {/* Dot */}
          <div className="absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-pf-accent bg-pf-bg-primary" />

          <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-4">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-pf-text-primary">
                {event.title}
              </h4>
              <span className="shrink-0 text-xs text-pf-text-muted">
                {formatDateTime(event.createdAt)}
              </span>
            </div>
            {event.description && (
              <p className="mt-1 text-sm text-pf-text-secondary">
                {event.description}
              </p>
            )}
            {event.actor && (
              <p className="mt-2 text-xs text-pf-text-muted">
                di {event.actor}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// --- Details Tab ---

function DetailsTab({
  commessa,
  code,
}: {
  readonly commessa: CommessaDetailType
  readonly code: string
}) {
  const updateMutation = useUpdateCommessa(code)

  const fields = [
    { label: 'Codice', value: commessa.code },
    { label: 'Cliente', value: commessa.clientName },
    { label: 'Descrizione', value: commessa.description || '—' },
    { label: 'Categoria', value: commessa.category || '—' },
    { label: 'Dipartimento', value: commessa.department || '—' },
    { label: 'Assegnato a', value: commessa.assignedTo || '—' },
    { label: 'Valuta', value: commessa.currency },
    { label: 'Scadenza', value: formatDate(commessa.deadline) },
    { label: 'Ricevuta il', value: formatDate(commessa.receivedAt) },
    { label: 'Completata il', value: formatDate(commessa.completedAt) },
    { label: 'Creata il', value: formatDate(commessa.createdAt) },
  ]

  if (commessa.tags.length > 0) {
    fields.push({ label: 'Tag', value: commessa.tags.join(', ') })
  }

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary">
      <div className="divide-y divide-pf-border">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center px-6 py-3">
            <span className="w-40 shrink-0 text-sm font-medium text-pf-text-secondary">
              {field.label}
            </span>
            <span className="text-sm text-pf-text-primary">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
