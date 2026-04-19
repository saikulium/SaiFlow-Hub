'use client'

import { useState } from 'react'
import {
  Sparkles,
  Check,
  X,
  Pencil,
  Loader2,
  ShoppingCart,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG } from '@/lib/constants'
import type { CommessaRequestItem } from '@/types'

interface SuggestionCardProps {
  readonly suggestion: CommessaRequestItem
  readonly onAccept: (id: string) => void
  readonly onReject: (id: string) => void
  readonly isAccepting: boolean
  readonly isRejecting: boolean
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: SuggestionCardProps) {
  const priorityConfig = PRIORITY_CONFIG[suggestion.priority as keyof typeof PRIORITY_CONFIG]
  const isBusy = isAccepting || isRejecting

  return (
    <div className="rounded-card border border-amber-500/20 bg-amber-500/5 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-pf-text-primary">
              {suggestion.title}
            </h4>
            <p className="font-mono text-xs text-pf-text-muted">
              {suggestion.code}
            </p>
          </div>
        </div>
        {priorityConfig && (
          <span
            className={cn(
              'rounded-badge px-2 py-0.5 text-xs font-medium',
              priorityConfig.bgColor,
              priorityConfig.color,
            )}
          >
            {priorityConfig.label}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-pf-text-secondary">
        {suggestion.estimatedAmount != null && (
          <span className="flex items-center gap-1">
            <ShoppingCart className="h-3 w-3 text-pf-text-muted" />
            {formatCurrency(suggestion.estimatedAmount)}
          </span>
        )}
        {suggestion.vendorName && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3 text-pf-text-muted" />
            {suggestion.vendorName}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAccept(suggestion.id)}
          disabled={isBusy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs font-medium transition-colors',
            isBusy
              ? 'cursor-not-allowed bg-green-500/20 text-green-400/50'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
          )}
        >
          {isAccepting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Accetta
        </button>
        <button
          type="button"
          onClick={() => onReject(suggestion.id)}
          disabled={isBusy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs font-medium transition-colors',
            isBusy
              ? 'cursor-not-allowed bg-red-500/20 text-red-400/50'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
          )}
        >
          {isRejecting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
          Rifiuta
        </button>
      </div>
    </div>
  )
}
