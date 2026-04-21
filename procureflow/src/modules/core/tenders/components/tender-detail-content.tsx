'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  Edit2,
  Scale,
  FileText,
  Clock,
  Info,
  Download,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { TenderStatusBadge } from './tender-status-badge'
import { TenderFormDialog } from './tender-form-dialog'
import { GoNoGoDialog } from './go-no-go-dialog'
import { useTender, useUpdateTenderStatus } from '../hooks/use-tender'
import {
  TENDER_STATUS_CONFIG,
  TENDER_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  VALID_TRANSITIONS,
} from '../constants'
import { cn, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils'
import type {
  TenderDetail,
  TenderDocumentItem,
  TenderTimelineItem,
} from '@/types'

interface TenderDetailContentProps {
  id: string
}

type TabKey = 'details' | 'documents' | 'timeline'

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
        {label}
      </dt>
      <dd className="text-sm text-pf-text-primary">
        {value != null && value !== '' ? String(value) : '-'}
      </dd>
    </div>
  )
}

function DocumentRow({ doc }: { doc: TenderDocumentItem }) {
  const typeLabel = DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType
  const sizeLabel =
    doc.fileSize != null
      ? doc.fileSize > 1_000_000
        ? `${(doc.fileSize / 1_000_000).toFixed(1)} MB`
        : `${Math.round(doc.fileSize / 1_000)} KB`
      : null

  return (
    <div className="flex items-center justify-between rounded-button border border-pf-border bg-pf-bg-tertiary px-4 py-3">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-pf-text-secondary" />
        <div>
          <p className="text-sm font-medium text-pf-text-primary">
            {doc.filename}
          </p>
          <div className="flex items-center gap-2 text-xs text-pf-text-secondary">
            <span className="rounded-badge bg-pf-bg-hover px-1.5 py-0.5 font-medium">
              {typeLabel}
            </span>
            {sizeLabel && <span>{sizeLabel}</span>}
            <span>v{doc.version}</span>
            <span>{formatDate(doc.createdAt)}</span>
          </div>
        </div>
      </div>
      <a
        href={doc.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-button p-2 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  )
}

function TimelineRow({ event }: { event: TenderTimelineItem }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pf-bg-tertiary">
          <Clock className="h-4 w-4 text-pf-text-secondary" />
        </div>
        <div className="mt-1 flex-1 border-l border-pf-border" />
      </div>
      <div className="pb-6">
        <p className="text-sm font-medium text-pf-text-primary">
          {event.title}
        </p>
        {event.description && (
          <p className="mt-0.5 text-xs text-pf-text-secondary">
            {event.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-pf-text-muted">
          {event.actor && <span>{event.actor}</span>}
          <span>{formatRelativeTime(event.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

function DetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="skeleton-shimmer h-8 w-32 rounded" />
        <div className="skeleton-shimmer h-6 w-20 rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton-shimmer h-3 w-20 rounded" />
            <div className="skeleton-shimmer h-5 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailsTab({ tender }: { tender: TenderDetail }) {
  return (
    <div className="space-y-6">
      {/* Main info */}
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <DetailField
          label="Tipo Procedura"
          value={TENDER_TYPE_LABELS[tender.tenderType] ?? tender.tenderType}
        />
        <DetailField
          label="Ente Appaltante"
          value={tender.contractingAuthority}
        />
        <DetailField label="CIG" value={tender.cig} />
        <DetailField label="CUP" value={tender.cup} />
        <DetailField label="Numero Gara" value={tender.garaNumber} />
        <DetailField label="ID ANAC" value={tender.anacId} />
        {tender.platformUrl && (
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              URL Piattaforma
            </dt>
            <dd>
              <a
                href={tender.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-pf-accent hover:underline"
              >
                {tender.platformUrl}
              </a>
            </dd>
          </div>
        )}
      </div>

      {/* Dates */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-pf-text-primary">
          Scadenze
        </h3>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <DetailField
            label="Pubblicazione"
            value={
              tender.publicationDate ? formatDate(tender.publicationDate) : null
            }
          />
          <DetailField
            label="Scadenza Quesiti"
            value={
              tender.questionDeadline
                ? formatDate(tender.questionDeadline)
                : null
            }
          />
          <DetailField
            label="Scadenza Presentazione"
            value={
              tender.submissionDeadline
                ? formatDate(tender.submissionDeadline)
                : null
            }
          />
          <DetailField
            label="Apertura Buste"
            value={tender.openingDate ? formatDate(tender.openingDate) : null}
          />
          <DetailField
            label="Data Aggiudicazione"
            value={tender.awardDate ? formatDate(tender.awardDate) : null}
          />
          <DetailField
            label="Inizio Contratto"
            value={
              tender.contractStartDate
                ? formatDate(tender.contractStartDate)
                : null
            }
          />
          <DetailField
            label="Fine Contratto"
            value={
              tender.contractEndDate ? formatDate(tender.contractEndDate) : null
            }
          />
        </div>
      </div>

      {/* Amounts & Scores */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-pf-text-primary">
          Importi e Punteggi
        </h3>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <DetailField
            label="Importo Base"
            value={
              tender.baseAmount != null
                ? formatCurrency(tender.baseAmount)
                : null
            }
          />
          <DetailField
            label="Offerta Nostra"
            value={
              tender.ourOfferAmount != null
                ? formatCurrency(tender.ourOfferAmount)
                : null
            }
          />
          <DetailField
            label="Importo Aggiudicato"
            value={
              tender.awardedAmount != null
                ? formatCurrency(tender.awardedAmount)
                : null
            }
          />
          <DetailField
            label="Criterio Aggiudicazione"
            value={tender.awardCriteria}
          />
          <DetailField
            label="Peso Tecnico"
            value={
              tender.technicalWeight != null
                ? `${tender.technicalWeight}%`
                : null
            }
          />
          <DetailField
            label="Peso Economico"
            value={
              tender.economicWeight != null ? `${tender.economicWeight}%` : null
            }
          />
          <DetailField
            label="Punteggio Tecnico"
            value={tender.ourTechnicalScore}
          />
          <DetailField
            label="Punteggio Economico"
            value={tender.ourEconomicScore}
          />
          <DetailField label="Punteggio Totale" value={tender.ourTotalScore} />
          <DetailField label="Partecipanti" value={tender.participantsCount} />
          <DetailField label="Vincitore" value={tender.winnerName} />
          <DetailField
            label="Importo Vincitore"
            value={
              tender.winnerAmount != null
                ? formatCurrency(tender.winnerAmount)
                : null
            }
          />
        </div>
      </div>

      {/* Go/No-Go details */}
      {tender.goNoGoScore != null && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-pf-text-primary">
            Decisione Go/No-Go
          </h3>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <DetailField
              label="Punteggio"
              value={`${tender.goNoGoScore}/100`}
            />
            <DetailField label="Deciso da" value={tender.goNoGoDecidedBy} />
            <DetailField
              label="Data Decisione"
              value={
                tender.goNoGoDecidedAt
                  ? formatDate(tender.goNoGoDecidedAt)
                  : null
              }
            />
            {tender.goNoGoNotes && (
              <div className="sm:col-span-2">
                <DetailField label="Note" value={tender.goNoGoNotes} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Classification */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-pf-text-primary">
          Classificazione
        </h3>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <DetailField label="Categoria" value={tender.category} />
          <DetailField label="Dipartimento" value={tender.department} />
          <DetailField label="Centro di Costo" value={tender.costCenter} />
          <DetailField label="Creato da" value={tender.createdBy} />
          <DetailField
            label="Data Creazione"
            value={formatDate(tender.createdAt)}
          />
          {tender.tags.length > 0 && (
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Tag
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {tender.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-badge bg-pf-bg-tertiary px-2 py-0.5 text-xs text-pf-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {tender.notes && (
            <div className="sm:col-span-2">
              <DetailField label="Note" value={tender.notes} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TenderDetailContent({ id }: TenderDetailContentProps) {
  const router = useRouter()
  const { data: tender, isLoading } = useTender(id)
  const statusMutation = useUpdateTenderStatus()

  const [activeTab, setActiveTab] = useState<TabKey>('details')
  const [editOpen, setEditOpen] = useState(false)
  const [goNoGoOpen, setGoNoGoOpen] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)

  const validTransitions = useMemo(() => {
    if (!tender) return []
    return VALID_TRANSITIONS[tender.status] ?? []
  }, [tender])

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      if (!tender) return
      statusMutation.mutate(
        { id: tender.id, status: newStatus },
        { onSuccess: () => setStatusMenuOpen(false) },
      )
    },
    [tender, statusMutation],
  )

  const showGoNoGo = tender?.status === 'EVALUATING'

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Info }> = [
    { key: 'details', label: 'Dettagli', icon: Info },
    { key: 'documents', label: 'Documenti', icon: FileText },
    { key: 'timeline', label: 'Timeline', icon: Clock },
  ]

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/tenders')}
              className="rounded-button p-1.5 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {isLoading ? (
              <div className="skeleton-shimmer h-8 w-64 rounded" />
            ) : tender ? (
              <div className="flex items-center gap-3">
                <h1 className="font-display text-xl font-bold text-pf-text-primary sm:text-2xl">
                  <span className="font-mono text-pf-text-secondary">
                    {tender.code}
                  </span>{' '}
                  {tender.title}
                </h1>
                <TenderStatusBadge status={tender.status} />
              </div>
            ) : (
              <h1 className="text-xl font-bold text-pf-text-primary">
                Gara non trovata
              </h1>
            )}
          </div>

          {tender && (
            <div className="flex items-center gap-2">
              {/* Status change dropdown */}
              {validTransitions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setStatusMenuOpen((prev) => !prev)}
                    disabled={statusMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-button border border-pf-border px-3 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
                  >
                    Cambia Stato
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>

                  {statusMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setStatusMenuOpen(false)}
                      />
                      <div className="absolute right-0 z-50 mt-1 min-w-[180px] rounded-card border border-pf-border bg-pf-bg-secondary py-1 shadow-xl">
                        {validTransitions.map((status) => {
                          const config = TENDER_STATUS_CONFIG[status]
                          return (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(status)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-pf-text-primary transition-colors hover:bg-pf-bg-hover"
                            >
                              {config && (
                                <config.icon
                                  className={cn('h-4 w-4', config.color)}
                                />
                              )}
                              {config?.label ?? status}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Go/No-Go button */}
              {showGoNoGo && (
                <button
                  onClick={() => setGoNoGoOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-button border border-amber-500/50 px-3 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
                >
                  <Scale className="h-4 w-4" />
                  Go/No-Go
                </button>
              )}

              {/* Edit button */}
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-button border border-pf-border px-3 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
              >
                <Edit2 className="h-4 w-4" />
                Modifica
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        {tender && (
          <div className="flex gap-1 border-b border-pf-border">
            {tabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.key
              const count =
                tab.key === 'documents'
                  ? tender.documents.length
                  : tab.key === 'timeline'
                    ? tender.timeline.length
                    : null

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-pf-accent text-pf-text-primary'
                      : 'border-transparent text-pf-text-secondary hover:text-pf-text-primary',
                  )}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                  {count != null && count > 0 && (
                    <span className="rounded-badge bg-pf-bg-tertiary px-1.5 py-0.5 text-xs">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Tab content */}
        <div className="bg-pf-bg-secondary/60 rounded-card border border-pf-border p-6 backdrop-blur-xl">
          {isLoading && <DetailsSkeleton />}

          {!isLoading && !tender && (
            <p className="py-8 text-center text-sm text-pf-text-secondary">
              Gara non trovata o errore nel caricamento.
            </p>
          )}

          {!isLoading && tender && activeTab === 'details' && (
            <DetailsTab tender={tender} />
          )}

          {!isLoading && tender && activeTab === 'documents' && (
            <div className="space-y-3">
              {tender.documents.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-pf-text-muted" />
                  <p className="text-sm text-pf-text-secondary">
                    Nessun documento caricato
                  </p>
                </div>
              ) : (
                tender.documents.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))
              )}
            </div>
          )}

          {!isLoading && tender && activeTab === 'timeline' && (
            <div>
              {tender.timeline.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="mx-auto mb-2 h-8 w-8 text-pf-text-muted" />
                  <p className="text-sm text-pf-text-secondary">
                    Nessun evento nella timeline
                  </p>
                </div>
              ) : (
                tender.timeline.map((event) => (
                  <TimelineRow key={event.id} event={event} />
                ))
              )}
            </div>
          )}
        </div>

        {/* Dialogs */}
        {tender && (
          <>
            <TenderFormDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              initialData={tender}
            />
            <GoNoGoDialog
              open={goNoGoOpen}
              onOpenChange={setGoNoGoOpen}
              tenderId={tender.id}
            />
          </>
        )}
      </div>
    </PageTransition>
  )
}
