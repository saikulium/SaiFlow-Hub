'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, X, ChevronDown, Check } from 'lucide-react'
import type { RequestSuggestion } from '@/server/services/suggest.service'
import { cn, formatCurrency } from '@/lib/utils'
import { PRIORITY_CONFIG, type PriorityKey } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SuggestionPanelProps {
  readonly suggestion: RequestSuggestion | null
  readonly isLoading: boolean
  readonly onAcceptField: (field: string, value: unknown) => void
  readonly onAcceptAll: () => void
  readonly onDismiss: () => void
}

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

interface FieldDef {
  readonly key: string
  readonly label: string
  readonly format: (suggestion: RequestSuggestion) => string | undefined
  readonly getValue: (suggestion: RequestSuggestion) => unknown
}

const FIELD_DEFS: readonly FieldDef[] = [
  {
    key: 'vendor_id',
    label: 'Fornitore',
    format: (s) => s.vendor_name,
    getValue: (s) => s.vendor_id,
  },
  {
    key: 'category',
    label: 'Categoria',
    format: (s) => s.category,
    getValue: (s) => s.category,
  },
  {
    key: 'priority',
    label: 'Priorità',
    format: (s) =>
      s.priority
        ? (PRIORITY_CONFIG[s.priority as PriorityKey]?.label ?? s.priority)
        : undefined,
    getValue: (s) => s.priority,
  },
  {
    key: 'department',
    label: 'Dipartimento',
    format: (s) => s.department,
    getValue: (s) => s.department,
  },
  {
    key: 'cost_center',
    label: 'Centro Costo',
    format: (s) => s.cost_center,
    getValue: (s) => s.cost_center,
  },
  {
    key: 'estimated_amount',
    label: 'Importo Stimato',
    format: (s) =>
      s.estimated_amount != null
        ? formatCurrency(s.estimated_amount)
        : undefined,
    getValue: (s) => s.estimated_amount,
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonPanel() {
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <div className="skeleton-shimmer h-4 w-4 rounded" />
        <div className="skeleton-shimmer h-4 w-32 rounded" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="skeleton-shimmer h-4 w-24 rounded" />
          <div className="skeleton-shimmer h-4 w-32 rounded" />
        </div>
      ))}
    </div>
  )
}

function FieldRow({
  label,
  displayValue,
  onAccept,
  accepted,
}: {
  readonly label: string
  readonly displayValue: string
  readonly onAccept: () => void
  readonly accepted: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <span className="text-xs text-pf-text-secondary">{label}</span>
        <p className="truncate text-sm font-medium text-pf-text-primary">
          {displayValue}
        </p>
      </div>
      <button
        type="button"
        onClick={onAccept}
        disabled={accepted}
        className={cn(
          'shrink-0 rounded-button px-2.5 py-1 text-xs font-medium transition-colors',
          accepted
            ? 'bg-green-400/10 text-green-400'
            : 'bg-pf-accent/10 hover:bg-pf-accent/20 text-pf-accent',
        )}
      >
        {accepted ? (
          <span className="inline-flex items-center gap-1">
            <Check className="h-3 w-3" />
            Applicato
          </span>
        ) : (
          'Applica'
        )}
      </button>
    </div>
  )
}

function ItemsSummary({
  items,
  onAccept,
  accepted,
}: {
  readonly items: RequestSuggestion['items']
  readonly onAccept: () => void
  readonly accepted: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  if (!items || items.length === 0) return null

  return (
    <div className="border-pf-accent/10 border-t pt-2">
      <div className="flex items-center justify-between py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs text-pf-text-secondary hover:text-pf-text-primary"
        >
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform',
              expanded && 'rotate-180',
            )}
          />
          <span>
            {items.length} articol{items.length === 1 ? 'o' : 'i'} suggeriт
            {items.length === 1 ? 'o' : 'i'}
          </span>
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={accepted}
          className={cn(
            'shrink-0 rounded-button px-2.5 py-1 text-xs font-medium transition-colors',
            accepted
              ? 'bg-green-400/10 text-green-400'
              : 'bg-pf-accent/10 hover:bg-pf-accent/20 text-pf-accent',
          )}
        >
          {accepted ? (
            <span className="inline-flex items-center gap-1">
              <Check className="h-3 w-3" />
              Applicati
            </span>
          ) : (
            'Applica articoli'
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-1 space-y-1">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-pf-bg-primary/50 rounded-button px-3 py-1.5 text-xs"
            >
              <span className="font-medium text-pf-text-primary">
                {item.name}
              </span>
              <span className="ml-2 text-pf-text-secondary">
                x{item.quantity}
                {item.unit ? ` ${item.unit}` : ''}
                {item.unit_price != null
                  ? ` @ ${formatCurrency(item.unit_price)}`
                  : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SuggestionPanel({
  suggestion,
  isLoading,
  onAcceptField,
  onAcceptAll,
  onDismiss,
}: SuggestionPanelProps) {
  const [acceptedFields, setAcceptedFields] = useState<Set<string>>(new Set())

  if (!isLoading && !suggestion) return null

  const handleAcceptField = (field: string, value: unknown) => {
    onAcceptField(field, value)
    setAcceptedFields((prev) => {
      const next = new Set(Array.from(prev))
      next.add(field)
      return next
    })
  }

  const handleAcceptAll = () => {
    onAcceptAll()
    if (suggestion) {
      const allFields = new Set<string>()
      for (const def of FIELD_DEFS) {
        if (def.getValue(suggestion) != null) {
          allFields.add(def.key)
        }
      }
      if (suggestion.items && suggestion.items.length > 0) {
        allFields.add('items')
      }
      setAcceptedFields(allFields)
    }
  }

  // Count available fields
  const availableFields = suggestion
    ? FIELD_DEFS.filter((def) => def.format(suggestion) != null)
    : []
  const hasItems = suggestion?.items != null && suggestion.items.length > 0
  const allAccepted =
    suggestion != null &&
    availableFields.every((f) => acceptedFields.has(f.key)) &&
    (!hasItems || acceptedFields.has('items'))

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border-pf-accent/30 bg-pf-accent/5 rounded-card border"
    >
      {isLoading ? (
        <SkeletonPanel />
      ) : suggestion ? (
        <div className="p-4">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pf-accent" />
              <span className="text-sm font-medium text-pf-text-primary">
                Suggerimenti
              </span>
              <span
                className={cn(
                  'rounded-badge px-2 py-0.5 text-[10px] font-medium',
                  suggestion.source === 'db'
                    ? 'bg-green-400/10 text-green-400'
                    : 'bg-pf-accent/10 text-pf-accent',
                )}
              >
                {suggestion.source === 'db' ? 'Storico' : 'AI'}
              </span>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-button p-1 text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Matched PR reference */}
          {suggestion.matched_pr_code && (
            <p className="mb-2 text-[11px] text-pf-text-muted">
              Basato su {suggestion.matched_pr_code}
            </p>
          )}

          {/* Field rows */}
          <div className="space-y-0.5">
            {availableFields.map((def) => (
              <FieldRow
                key={def.key}
                label={def.label}
                displayValue={def.format(suggestion)!}
                onAccept={() =>
                  handleAcceptField(def.key, def.getValue(suggestion))
                }
                accepted={acceptedFields.has(def.key)}
              />
            ))}
          </div>

          {/* Items summary */}
          {hasItems && (
            <ItemsSummary
              items={suggestion.items}
              onAccept={() => handleAcceptField('items', suggestion.items)}
              accepted={acceptedFields.has('items')}
            />
          )}

          {/* Accept all button */}
          {availableFields.length > 1 && !allAccepted && (
            <div className="border-pf-accent/10 mt-3 border-t pt-3">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="bg-pf-accent/10 hover:bg-pf-accent/20 w-full rounded-button px-3 py-2 text-xs font-medium text-pf-accent transition-colors"
              >
                Accetta tutti i suggerimenti
              </button>
            </div>
          )}
        </div>
      ) : null}
    </motion.div>
  )
}
