'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Edit,
  MoreHorizontal,
  FileText,
  Clock,
  CheckCircle2,
  Paperclip,
  MessageSquare,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Send,
} from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { RequestEditDialog } from '@/components/requests/request-edit-dialog'
import { StatusStepper } from '@/components/requests/status-stepper'
import { ApprovalActions } from '@/components/requests/approval-actions'
import { CommentForm } from '@/components/requests/comment-form'
import { AttachmentUpload } from '@/components/requests/attachment-upload'
import { AttachmentPreview } from '@/components/requests/attachment-preview'
import { APPROVAL_STATUS_CONFIG } from '@/lib/constants'
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  getInitials,
  cn,
} from '@/lib/utils'
import {
  useRequest,
  useSubmitRequest,
  type RequestDetail,
  type TimelineEvent,
  type RequestApproval,
} from '@/hooks/use-request'
import { useComments } from '@/hooks/use-comments'
import { useAttachments, type Attachment } from '@/hooks/use-attachments'

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

// --- Info Field ---

function InfoField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-pf-text-secondary">{label}</dt>
      <dd className="text-sm text-pf-text-primary">
        {value || <span className="text-pf-text-secondary">—</span>}
      </dd>
    </div>
  )
}

// --- Dettagli Tab ---

function DettagliTab({ request }: { request: RequestDetail }) {
  return (
    <div className="space-y-6">
      {/* Info Grid */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Informazioni Generali
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField
            label="Fornitore"
            value={request.vendor ? request.vendor.name : null}
          />
          <InfoField label="Richiedente" value={request.requester.name} />
          <InfoField
            label="Importo Stimato"
            value={
              request.estimated_amount !== null
                ? formatCurrency(request.estimated_amount)
                : null
            }
          />
          <InfoField
            label="Importo Effettivo"
            value={
              request.actual_amount !== null
                ? formatCurrency(request.actual_amount)
                : null
            }
          />
          <InfoField
            label="Data Necessità"
            value={request.needed_by ? formatDate(request.needed_by) : null}
          />
          <InfoField label="Categoria" value={request.category} />
          <InfoField label="Dipartimento" value={request.department} />
          <InfoField label="Centro Costo" value={request.cost_center} />
          <InfoField label="Codice Budget" value={request.budget_code} />
          <InfoField label="Riferimento Esterno" value={request.external_ref} />
          <InfoField label="Tracking" value={request.tracking_number} />
        </dl>
      </div>

      {/* Compliance */}
      {(request.cig || request.cup || request.is_mepa) && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Compliance
          </h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField
              label="CIG"
              value={
                request.cig ? (
                  <span className="font-mono">{request.cig}</span>
                ) : null
              }
            />
            <InfoField
              label="CUP"
              value={
                request.cup ? (
                  <span className="font-mono">{request.cup}</span>
                ) : null
              }
            />
            <InfoField label="MEPA" value={request.is_mepa ? 'Si' : 'No'} />
            {request.is_mepa && (
              <InfoField
                label="Numero ODA MEPA"
                value={request.mepa_oda_number}
              />
            )}
          </dl>
        </div>
      )}

      {/* Description */}
      {request.description && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-2 text-sm font-semibold text-pf-text-primary">
            Descrizione
          </h3>
          <p className="whitespace-pre-wrap text-sm text-pf-text-secondary">
            {request.description}
          </p>
        </div>
      )}

      {/* Items Table */}
      {request.items.length > 0 && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Articoli ({request.items.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border text-left text-xs text-pf-text-secondary">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">Descrizione</th>
                  <th className="pb-2 pr-4 text-right font-medium">Quantità</th>
                  <th className="pb-2 pr-4 font-medium">Unità</th>
                  <th className="pb-2 pr-4 text-right font-medium">
                    Prezzo Unit.
                  </th>
                  <th className="pb-2 text-right font-medium">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pf-border">
                {request.items.map((item) => (
                  <tr key={item.id} className="text-pf-text-primary">
                    <td className="py-2.5 pr-4 font-medium">{item.name}</td>
                    <td className="py-2.5 pr-4 text-pf-text-secondary">
                      {item.description || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right">{item.quantity}</td>
                    <td className="py-2.5 pr-4 text-pf-text-secondary">
                      {item.unit || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {item.unit_price !== null
                        ? formatCurrency(item.unit_price)
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      {item.total_price !== null
                        ? formatCurrency(item.total_price)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tags */}
      {request.tags.length > 0 && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-3 text-sm font-semibold text-pf-text-primary">
            Tag
          </h3>
          <div className="flex flex-wrap gap-2">
            {request.tags.map((tag) => (
              <span
                key={tag}
                className="bg-pf-accent/10 rounded-badge px-2.5 py-0.5 text-xs font-medium text-pf-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Timeline Tab ---

function TimelineTab({ events }: { events: readonly TimelineEvent[] }) {
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

// --- Approvazioni Tab (with live ApprovalActions) ---

function ApprovazioniTab({
  approvals,
}: {
  approvals: readonly RequestApproval[]
}) {
  if (approvals.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nessuna approvazione"
        description="Non sono ancora presenti approvazioni per questa richiesta."
      />
    )
  }

  return (
    <div className="space-y-3">
      {approvals.map((approval) => {
        const statusConfig = APPROVAL_STATUS_CONFIG[approval.status] ?? {
          label: approval.status,
          color: 'text-zinc-400',
          bgColor: 'bg-zinc-400/10',
        }
        const isPending = approval.status === 'PENDING'

        return (
          <div
            key={approval.id}
            className="rounded-card border border-pf-border bg-pf-bg-secondary p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-pf-text-primary">
                  {approval.approver.name}
                </p>
                <p className="text-xs text-pf-text-secondary">
                  {approval.approver.role}
                </p>
                {approval.comment && (
                  <p className="mt-2 text-sm text-pf-text-secondary">
                    {approval.comment}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    'inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium',
                    statusConfig.bgColor,
                    statusConfig.color,
                  )}
                >
                  {statusConfig.label}
                </span>
                {approval.decided_at && (
                  <span className="text-xs text-pf-text-secondary">
                    {formatDate(approval.decided_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Show approval actions for PENDING approvals */}
            {isPending && (
              <div className="mt-4 border-t border-pf-border pt-4">
                <ApprovalActions
                  approvalId={approval.id}
                  approverName={approval.approver.name}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- Allegati Tab (with live upload + preview) ---

function AllegatiTab({ requestId }: { requestId: string }) {
  const { data: attachments, isLoading } = useAttachments(requestId)
  const [preview, setPreview] = useState<Attachment | null>(null)

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <AttachmentUpload requestId={requestId} />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-pf-text-muted" />
        </div>
      )}

      {/* List */}
      {attachments && attachments.length === 0 && (
        <EmptyState
          icon={Paperclip}
          title="Nessun allegato"
          description="Carica un file per aggiungerlo alla richiesta."
        />
      )}

      {attachments && attachments.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-start gap-3 rounded-card border border-pf-border bg-pf-bg-secondary p-4"
            >
              <div className="bg-pf-accent/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-button">
                <FileText className="h-5 w-5 text-pf-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setPreview(attachment)}
                  className="truncate text-sm font-medium text-pf-text-primary transition-colors hover:text-pf-accent"
                >
                  {attachment.filename}
                </button>
                <p className="text-xs text-pf-text-secondary">
                  {attachment.file_size !== null
                    ? formatFileSize(attachment.file_size)
                    : '—'}
                </p>
                <p className="text-xs text-pf-text-secondary">
                  {formatDate(attachment.created_at)}
                </p>
              </div>
              <a
                href={attachment.file_url}
                download={attachment.filename}
                className="hover:bg-pf-bg-elevated shrink-0 rounded-button p-1.5 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
                aria-label={`Scarica ${attachment.filename}`}
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <AttachmentPreview
          isOpen={true}
          onClose={() => setPreview(null)}
          fileUrl={preview.file_url}
          filename={preview.filename}
          mimeType={preview.mime_type}
        />
      )}
    </div>
  )
}

// --- Commenti Tab (with live hooks) ---

function CommentiTab({ requestId }: { requestId: string }) {
  const { data: comments, isLoading } = useComments(requestId)

  return (
    <div className="space-y-4">
      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-pf-text-muted" />
        </div>
      )}

      {/* Empty state */}
      {comments && comments.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title="Nessun commento"
          description="Aggiungi un commento per avviare la conversazione."
        />
      )}

      {/* Comment list */}
      {comments && comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 rounded-card border border-pf-border bg-pf-bg-secondary p-4"
            >
              <div className="bg-pf-accent/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-pf-accent">
                {getInitials(comment.author.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-pf-text-primary">
                    {comment.author.name}
                  </span>
                  {comment.is_internal ? (
                    <span className="inline-flex items-center gap-1 rounded-badge bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                      <EyeOff className="h-2.5 w-2.5" />
                      Interno
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-badge bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                      <Eye className="h-2.5 w-2.5" />
                      Fornitore
                    </span>
                  )}
                  <span className="text-xs text-pf-text-secondary">
                    {formatRelativeTime(comment.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-pf-text-secondary">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment form */}
      <CommentForm requestId={requestId} />
    </div>
  )
}

// --- Empty State ---

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-pf-bg-elevated mb-3 flex h-12 w-12 items-center justify-center rounded-full">
        <Icon className="h-6 w-6 text-pf-text-secondary" />
      </div>
      <p className="text-sm font-medium text-pf-text-primary">{title}</p>
      <p className="mt-1 text-xs text-pf-text-secondary">{description}</p>
    </div>
  )
}

// --- Helpers ---

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
