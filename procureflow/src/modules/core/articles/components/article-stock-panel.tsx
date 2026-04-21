'use client'

import { useState, useCallback } from 'react'
import {
  Package,
  Plus,
  Minus,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  X,
  Warehouse,
} from 'lucide-react'
import { useArticleStock, useStockMovement } from '../hooks/use-articles'
import { cn } from '@/lib/utils'

interface ArticleStockPanelProps {
  readonly articleId: string
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  OK: {
    label: 'In stock',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  LOW: {
    label: 'Scorta bassa',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  OUT_OF_STOCK: {
    label: 'Esaurito',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
  NONE: {
    label: 'Non gestito',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  },
}

export function ArticleStockPanel({ articleId }: ArticleStockPanelProps) {
  const { data: stock, isLoading } = useArticleStock(articleId)
  const [dialogType, setDialogType] = useState<'INBOUND' | 'OUTBOUND' | null>(
    null,
  )

  if (isLoading) {
    return (
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-pf-text-muted" />
          <div className="skeleton-shimmer h-5 w-32 rounded" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-16 rounded-card" />
          ))}
        </div>
      </div>
    )
  }

  if (!stock) return null

  const fallback = {
    label: 'Non gestito',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  }
  const statusConfig = STATUS_CONFIG[stock.status] ?? fallback

  // Non-inventory article — show activation prompt
  if (!stock.hasInventory) {
    return (
      <div className="bg-pf-bg-secondary/50 rounded-card border border-dashed border-pf-border p-6">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Package className="h-8 w-8 text-pf-text-muted" />
          <div>
            <p className="text-sm font-medium text-pf-text-secondary">
              Magazzino non attivo
            </p>
            <p className="mt-1 text-xs text-pf-text-muted">
              Registra un carico per attivare la gestione magazzino su questo
              articolo.
            </p>
          </div>
          <button
            onClick={() => setDialogType('INBOUND')}
            className="mt-2 inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Primo Carico
          </button>
        </div>

        {dialogType === 'INBOUND' && (
          <StockMovementDialog
            articleId={articleId}
            type="INBOUND"
            unit={stock.unit}
            onClose={() => setDialogType(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stock summary card */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-pf-accent" />
            <h3 className="text-sm font-medium text-pf-text-primary">
              Magazzino
            </h3>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                statusConfig.bgColor,
                statusConfig.color,
              )}
            >
              {statusConfig.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDialogType('INBOUND')}
              className="inline-flex items-center gap-1.5 rounded-button border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              Carico
            </button>
            <button
              onClick={() => setDialogType('OUTBOUND')}
              disabled={stock.available <= 0}
              className="inline-flex items-center gap-1.5 rounded-button border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
              Scarico
            </button>
          </div>
        </div>

        {/* Quantities */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StockCard
            label="Disponibile"
            value={stock.available}
            unit={stock.unit}
            highlight
          />
          <StockCard label="Fisica" value={stock.physical} unit={stock.unit} />
          <StockCard
            label="Riservata"
            value={stock.reserved}
            unit={stock.unit}
          />
        </div>

        {/* Warehouse breakdown */}
        {stock.byWarehouse.length > 0 && (
          <div className="mt-4 space-y-2">
            {stock.byWarehouse.map((wh) => (
              <div
                key={wh.warehouseId}
                className="flex items-center justify-between rounded-lg bg-pf-bg-tertiary px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Warehouse className="h-3.5 w-3.5 text-pf-text-muted" />
                  <span className="text-xs text-pf-text-secondary">
                    {wh.warehouseName}
                  </span>
                </div>
                <span className="font-mono text-xs text-pf-text-primary">
                  {wh.physical} {stock.unit}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Last movement */}
        {stock.lastMovement && (
          <div className="mt-4 border-t border-pf-border pt-3">
            <p className="text-xs text-pf-text-muted">Ultimo movimento</p>
            <div className="mt-1 flex items-center gap-2">
              {stock.lastMovement.type === 'INBOUND' ? (
                <ArrowDownCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <ArrowUpCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm text-pf-text-secondary">
                {stock.lastMovement.type === 'INBOUND' ? '+' : ''}
                {stock.lastMovement.quantity} {stock.unit}
              </span>
              <span className="text-xs text-pf-text-muted">
                {new Date(stock.lastMovement.date).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              {stock.lastMovement.notes && (
                <span className="truncate text-xs text-pf-text-muted">
                  — {stock.lastMovement.notes}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Movement dialog */}
      {dialogType && (
        <StockMovementDialog
          articleId={articleId}
          type={dialogType}
          unit={stock.unit}
          maxQuantity={dialogType === 'OUTBOUND' ? stock.available : undefined}
          onClose={() => setDialogType(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stock card
// ---------------------------------------------------------------------------

function StockCard({
  label,
  value,
  unit,
  highlight,
}: {
  readonly label: string
  readonly value: number
  readonly unit: string
  readonly highlight?: boolean
}) {
  return (
    <div className="rounded-lg bg-pf-bg-tertiary px-4 py-3">
      <p className="text-xs text-pf-text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-xl font-bold',
          highlight ? 'text-pf-text-primary' : 'text-pf-text-secondary',
        )}
      >
        {value}{' '}
        <span className="text-xs font-normal text-pf-text-muted">{unit}</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick stock movement dialog
// ---------------------------------------------------------------------------

function StockMovementDialog({
  articleId,
  type,
  unit,
  maxQuantity,
  onClose,
}: {
  readonly articleId: string
  readonly type: 'INBOUND' | 'OUTBOUND'
  readonly unit: string
  readonly maxQuantity?: number
  readonly onClose: () => void
}) {
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [notes, setNotes] = useState('')
  const mutation = useStockMovement(articleId)

  const isInbound = type === 'INBOUND'
  const parsedQty = parseFloat(quantity)
  const isValid =
    !isNaN(parsedQty) &&
    parsedQty > 0 &&
    (maxQuantity === undefined || parsedQty <= maxQuantity)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValid) return

      try {
        await mutation.mutateAsync({
          type,
          quantity: parsedQty,
          unit_cost: isInbound ? parseFloat(unitCost) || 0 : undefined,
          notes: notes.trim() || undefined,
        })
        onClose()
      } catch {
        // Error handled by mutation state
      }
    },
    [isValid, mutation, type, parsedQty, isInbound, unitCost, notes, onClose],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-pf-border bg-pf-bg-secondary p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isInbound ? (
              <ArrowDownCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <ArrowUpCircle className="h-5 w-5 text-red-400" />
            )}
            <h2 className="font-display text-lg font-bold text-pf-text-primary">
              {isInbound ? 'Carico' : 'Scarico'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-button p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quantity */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Quantità ({unit}) *
            </label>
            <input
              type="number"
              required
              min={0.01}
              max={maxQuantity}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={
                maxQuantity !== undefined ? `Max ${maxQuantity}` : 'Quantità'
              }
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              autoFocus
            />
          </div>

          {/* Unit cost (inbound only) */}
          {isInbound && (
            <div>
              <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
                Costo unitario (EUR)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Note
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nota opzionale"
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* Error */}
          {mutation.isError && (
            <p className="text-sm text-red-400">
              {mutation.error?.message ?? 'Errore durante il movimento'}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!isValid || mutation.isPending}
              className={cn(
                'inline-flex items-center gap-2 rounded-button px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50',
                isInbound
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-red-600 hover:bg-red-500',
              )}
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isInbound ? 'Registra Carico' : 'Registra Scarico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
