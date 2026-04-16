'use client'

import { useState } from 'react'
import { AlertTriangle, Check, X, MessageSquare, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { PriceVarianceReview } from '@/hooks/use-request'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PriceVarianceBannerProps {
  readonly reviews: readonly PriceVarianceReview[]
  readonly requestId: string
}

// ---------------------------------------------------------------------------
// Decision handler
// ---------------------------------------------------------------------------

type Decision = 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING'

async function decidePriceVariance(
  reviewId: string,
  status: Decision,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/price-variance/${reviewId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    return {
      success: false,
      error: body?.error?.message ?? 'Errore nella decisione',
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// Single Review Card
// ---------------------------------------------------------------------------

interface ReviewCardProps {
  readonly review: PriceVarianceReview
  readonly requestId: string
  readonly onDecided: () => void
}

function ReviewCard({ review, requestId, onDecided }: ReviewCardProps) {
  const [loading, setLoading] = useState<Decision | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items = Array.isArray(review.items)
    ? (review.items as PriceVarianceReview['items'])
    : []

  async function handleDecision(decision: Decision) {
    setLoading(decision)
    setError(null)

    const result = await decidePriceVariance(review.id, decision)

    if (result.success) {
      onDecided()
    } else {
      setError(result.error ?? 'Errore sconosciuto')
    }

    setLoading(null)
  }

  return (
    <div className="rounded-card border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">
          Variazione prezzo in attesa di decisione
        </span>
        <span className="ml-auto text-xs text-pf-text-secondary">
          Max delta: {review.max_delta_percent.toFixed(1)}%
        </span>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pf-border text-left text-xs text-pf-text-secondary">
              <th className="pb-2 pr-4">Articolo</th>
              <th className="pb-2 pr-4 text-right">Prezzo originale</th>
              <th className="pb-2 pr-4 text-right">Prezzo nuovo</th>
              <th className="pb-2 pr-4 text-right">Delta %</th>
              <th className="pb-2 text-right">Delta EUR</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const deltaEur = item.new_price - item.old_price
              const isIncrease = deltaEur > 0
              return (
                <tr
                  key={`${review.id}-${idx}`}
                  className="border-b border-pf-border/50"
                >
                  <td className="py-2 pr-4 text-pf-text-primary">
                    {item.item_name}
                  </td>
                  <td className="py-2 pr-4 text-right text-pf-text-secondary">
                    {item.old_price.toFixed(2)} EUR
                  </td>
                  <td className="py-2 pr-4 text-right text-pf-text-primary">
                    {item.new_price.toFixed(2)} EUR
                  </td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${
                      isIncrease ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {isIncrease ? '+' : ''}
                    {item.delta_pct.toFixed(1)}%
                  </td>
                  <td
                    className={`py-2 text-right font-medium ${
                      isIncrease ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {isIncrease ? '+' : ''}
                    {deltaEur.toFixed(2)} EUR
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="text-xs font-medium text-pf-text-secondary">
              <td className="pt-2">Totale</td>
              <td className="pt-2 text-right">
                {Number(review.total_old_amount).toFixed(2)} EUR
              </td>
              <td className="pt-2 text-right">
                {Number(review.total_new_amount).toFixed(2)} EUR
              </td>
              <td />
              <td
                className={`pt-2 text-right font-medium ${
                  Number(review.total_delta) > 0
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}
              >
                {Number(review.total_delta) > 0 ? '+' : ''}
                {Number(review.total_delta).toFixed(2)} EUR
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => handleDecision('ACCEPTED')}
          className="inline-flex h-8 items-center gap-1.5 rounded-button bg-green-600 px-3 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
        >
          {loading === 'ACCEPTED' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Accetta
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => handleDecision('REJECTED')}
          className="inline-flex h-8 items-center gap-1.5 rounded-button bg-red-600 px-3 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
        >
          {loading === 'REJECTED' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          Rifiuta
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => handleDecision('NEGOTIATING')}
          className="inline-flex h-8 items-center gap-1.5 rounded-button border border-pf-border bg-pf-bg-elevated px-3 text-xs font-medium text-pf-text-primary transition-colors hover:bg-pf-bg-secondary disabled:opacity-50"
        >
          {loading === 'NEGOTIATING' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          Negozia
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PriceVarianceBanner({
  reviews,
  requestId,
}: PriceVarianceBannerProps) {
  const queryClient = useQueryClient()

  if (!reviews || reviews.length === 0) {
    return null
  }

  function handleDecided() {
    queryClient.invalidateQueries({ queryKey: ['request', requestId] })
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          requestId={requestId}
          onDecided={handleDecided}
        />
      ))}
    </div>
  )
}
