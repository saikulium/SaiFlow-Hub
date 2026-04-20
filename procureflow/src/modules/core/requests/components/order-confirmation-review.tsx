'use client'

// ---------------------------------------------------------------------------
// OrderConfirmationReview — UI di revisione delle conferme d'ordine.
//
// Per ogni conferma ATTIVA (RECEIVED/PARSED/ACKNOWLEDGED) mostra una tabella
// di righe con checkbox, delta prezzo, ritardo consegna. L'utente seleziona
// le righe da accettare e conferma via "Applica selezionate" oppure rifiuta
// l'intera conferma fornendo una motivazione.
//
// Conferme terminali (APPLIED/REJECTED) sono mostrate in sola lettura.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
  Ban,
  Loader2,
  Truck,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useOrderConfirmations,
  useApplyOrderConfirmation,
  useRejectOrderConfirmation,
  type OrderConfirmation,
  type OrderConfirmationLine,
  type OrderConfirmationStatus,
} from '../hooks/use-order-confirmations'

// --- Props -------------------------------------------------------------------

interface OrderConfirmationReviewProps {
  readonly requestId: string
}

const ACTIVE_STATES: ReadonlySet<OrderConfirmationStatus> =
  new Set<OrderConfirmationStatus>(['RECEIVED', 'PARSED', 'ACKNOWLEDGED'])

// --- Helpers -----------------------------------------------------------------

function toNumber(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function formatCurrency(v: string | number | null | undefined): string {
  const n = toNumber(v)
  return n == null ? '—' : `${n.toFixed(2)} EUR`
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function statusLabel(status: OrderConfirmationStatus): string {
  switch (status) {
    case 'RECEIVED':
      return 'Ricevuta'
    case 'PARSED':
      return 'Analizzata'
    case 'ACKNOWLEDGED':
      return 'Presa in carico'
    case 'APPLIED':
      return 'Applicata'
    case 'REJECTED':
      return 'Rifiutata'
  }
}

function StatusBadge({ status }: { readonly status: OrderConfirmationStatus }) {
  const styles: Record<OrderConfirmationStatus, string> = {
    RECEIVED: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    PARSED: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    ACKNOWLEDGED: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
    APPLIED: 'border-green-500/30 bg-green-500/10 text-green-300',
    REJECTED: 'border-red-500/30 bg-red-500/10 text-red-300',
  }
  const icons: Record<OrderConfirmationStatus, React.ElementType> = {
    RECEIVED: Clock,
    PARSED: FileCheck,
    ACKNOWLEDGED: FileCheck,
    APPLIED: CheckCircle2,
    REJECTED: Ban,
  }
  const Icon = icons[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge border px-2 py-0.5 text-xs font-medium',
        styles[status],
      )}
    >
      <Icon className="h-3 w-3" />
      {statusLabel(status)}
    </span>
  )
}

// --- Line row ----------------------------------------------------------------

interface LineRowProps {
  readonly line: OrderConfirmationLine
  readonly selectable: boolean
  readonly selected: boolean
  readonly onToggle: (id: string) => void
}

function LineRow({ line, selectable, selected, onToggle }: LineRowProps) {
  const origPrice = toNumber(line.original_unit_price)
  const confPrice = toNumber(line.confirmed_unit_price)
  const deltaPct = toNumber(line.price_delta_pct)
  const delayDays = line.delivery_delay_days
  const name =
    line.confirmed_name ?? line.original_name ?? line.confirmed_sku ?? '—'

  const priceIncrease = deltaPct != null && deltaPct > 0
  const priceDecrease = deltaPct != null && deltaPct < 0
  const deliveryLate = delayDays != null && delayDays > 0
  const deliveryEarly = delayDays != null && delayDays < 0

  const orphan = line.request_item_id == null
  const disabled = !selectable || line.applied || line.rejected

  return (
    <tr
      className={cn(
        'border-pf-border/50 border-b transition-colors',
        selected && 'bg-pf-accent-subtle',
        disabled && 'opacity-60',
      )}
    >
      {selectable && (
        <td className="py-2 pr-2">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={() => onToggle(line.id)}
            className="h-4 w-4 rounded border-pf-border bg-transparent accent-pf-accent"
            aria-label={`Seleziona ${name}`}
          />
        </td>
      )}
      <td className="py-2 pr-3">
        <div className="flex flex-col">
          <span className="text-sm text-pf-text-primary">{name}</span>
          {orphan && (
            <span className="text-xs text-amber-400">
              Non collegata a un articolo
            </span>
          )}
          {line.applied && (
            <span className="text-xs text-green-400">Applicata</span>
          )}
          {line.rejected && (
            <span className="text-xs text-red-400">Rifiutata</span>
          )}
        </div>
      </td>

      {/* Prezzo */}
      <td className="py-2 pr-3 text-right text-sm text-pf-text-secondary">
        {formatCurrency(origPrice)}
      </td>
      <td className="py-2 pr-3 text-right text-sm text-pf-text-primary">
        {formatCurrency(confPrice)}
      </td>
      <td
        className={cn(
          'py-2 pr-3 text-right text-sm font-medium',
          priceIncrease && 'text-red-400',
          priceDecrease && 'text-green-400',
          !priceIncrease && !priceDecrease && 'text-pf-text-secondary',
        )}
      >
        {deltaPct == null ? (
          '—'
        ) : (
          <span className="inline-flex items-center justify-end gap-1">
            {priceIncrease && <TrendingUp className="h-3 w-3" />}
            {priceDecrease && <TrendingDown className="h-3 w-3" />}
            {deltaPct > 0 ? '+' : ''}
            {(deltaPct * 100).toFixed(1)}%
          </span>
        )}
      </td>

      {/* Consegna */}
      <td className="py-2 pr-3 text-right text-sm text-pf-text-secondary">
        {formatDate(line.original_expected_delivery)}
      </td>
      <td className="py-2 pr-3 text-right text-sm text-pf-text-primary">
        {formatDate(line.confirmed_delivery)}
      </td>
      <td
        className={cn(
          'py-2 text-right text-sm font-medium',
          deliveryLate && 'text-red-400',
          deliveryEarly && 'text-green-400',
          !deliveryLate && !deliveryEarly && 'text-pf-text-secondary',
        )}
      >
        {delayDays == null ? (
          '—'
        ) : (
          <span className="inline-flex items-center justify-end gap-1">
            {deliveryLate && <Truck className="h-3 w-3" />}
            {delayDays > 0 ? '+' : ''}
            {delayDays}g
          </span>
        )}
      </td>
    </tr>
  )
}

// --- Confirmation card -------------------------------------------------------

interface ConfirmationCardProps {
  readonly confirmation: OrderConfirmation
  readonly requestId: string
}

function ConfirmationCard({ confirmation, requestId }: ConfirmationCardProps) {
  const isActive = ACTIVE_STATES.has(confirmation.status)

  const selectableLineIds = useMemo(
    () =>
      confirmation.lines
        .filter((l) => !l.applied && !l.rejected)
        .map((l) => l.id),
    [confirmation.lines],
  )

  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(isActive ? selectableLineIds : []),
  )
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const applyMutation = useApplyOrderConfirmation(requestId)
  const rejectMutation = useRejectOrderConfirmation(requestId)
  const busy = applyMutation.isPending || rejectMutation.isPending

  function toggleLine(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === selectableLineIds.length
        ? new Set()
        : new Set(selectableLineIds),
    )
  }

  async function handleApply() {
    setError(null)
    if (selected.size === 0) {
      setError('Seleziona almeno una riga da applicare')
      return
    }
    try {
      await applyMutation.mutateAsync({
        confirmationId: confirmation.id,
        acceptedLineIds: Array.from(selected),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  async function handleReject() {
    setError(null)
    const reason = rejectReason.trim()
    if (reason.length === 0) {
      setError('Motivazione obbligatoria')
      return
    }
    try {
      await rejectMutation.mutateAsync({
        confirmationId: confirmation.id,
        reason,
      })
      setRejectMode(false)
      setRejectReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  const header = confirmation.vendor_reference ?? confirmation.subject ?? '—'
  const allSelected =
    selectableLineIds.length > 0 && selected.size === selectableLineIds.length

  return (
    <div className="space-y-4 rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-pf-accent" />
            <h3 className="text-sm font-semibold text-pf-text-primary">
              Conferma d&apos;ordine · {header}
            </h3>
            <StatusBadge status={confirmation.status} />
          </div>
          <p className="text-xs text-pf-text-secondary">
            Ricevuta il {formatDate(confirmation.received_at)} · Origine{' '}
            <span className="font-medium text-pf-text-primary">
              {confirmation.source}
            </span>{' '}
            · {confirmation.lines.length} righe
          </p>
          {confirmation.status === 'REJECTED' &&
            confirmation.rejection_reason && (
              <p className="text-xs text-red-400">
                Motivo rifiuto: {confirmation.rejection_reason}
              </p>
            )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pf-border text-left text-xs uppercase tracking-wider text-pf-text-secondary">
              {isActive && (
                <th className="pb-2 pr-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={busy || selectableLineIds.length === 0}
                    className="h-4 w-4 rounded border-pf-border bg-transparent accent-pf-accent"
                    aria-label="Seleziona tutte le righe"
                  />
                </th>
              )}
              <th className="pb-2 pr-3">Articolo</th>
              <th className="pb-2 pr-3 text-right">Prezzo orig.</th>
              <th className="pb-2 pr-3 text-right">Prezzo conf.</th>
              <th className="pb-2 pr-3 text-right">Δ %</th>
              <th className="pb-2 pr-3 text-right">Consegna orig.</th>
              <th className="pb-2 pr-3 text-right">Consegna conf.</th>
              <th className="pb-2 text-right">Δ giorni</th>
            </tr>
          </thead>
          <tbody>
            {confirmation.lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                selectable={isActive}
                selected={selected.has(line.id)}
                onToggle={toggleLine}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Actions */}
      {isActive && !rejectMode && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleApply}
            disabled={busy || selected.size === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-button bg-green-600 px-3 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Applica selezionate ({selected.size})
          </button>
          <button
            type="button"
            onClick={() => setRejectMode(true)}
            disabled={busy}
            className="bg-pf-bg-elevated inline-flex h-9 items-center gap-1.5 rounded-button border border-pf-border px-3 text-sm font-medium text-pf-text-primary transition-colors hover:bg-pf-bg-tertiary disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Rifiuta conferma
          </button>
        </div>
      )}

      {isActive && rejectMode && (
        <div className="space-y-2 rounded-card border border-red-500/30 bg-red-500/5 p-3">
          <label
            htmlFor={`reject-${confirmation.id}`}
            className="text-xs font-medium text-pf-text-secondary"
          >
            Motivazione del rifiuto
          </label>
          <textarea
            id={`reject-${confirmation.id}`}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full resize-none rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
            placeholder="Es: prezzi fuori soglia, consegna troppo tardiva..."
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={busy || rejectReason.trim().length === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-button bg-red-600 px-3 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Conferma rifiuto
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectMode(false)
                setRejectReason('')
                setError(null)
              }}
              disabled={busy}
              className="inline-flex h-8 items-center rounded-button border border-pf-border px-3 text-xs font-medium text-pf-text-secondary hover:bg-pf-bg-tertiary disabled:opacity-50"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main component ----------------------------------------------------------

export function OrderConfirmationReview({
  requestId,
}: OrderConfirmationReviewProps) {
  const { data, isLoading, error } = useOrderConfirmations(requestId)

  if (isLoading) {
    return (
      <div className="h-24 animate-pulse rounded-card border border-pf-border bg-pf-bg-secondary" />
    )
  }

  if (error) {
    return (
      <div className="rounded-card border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-400">
        Impossibile caricare le conferme d&apos;ordine
      </div>
    )
  }

  if (!data || data.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {data.map((confirmation) => (
        <ConfirmationCard
          key={confirmation.id}
          confirmation={confirmation}
          requestId={requestId}
        />
      ))}
    </div>
  )
}
