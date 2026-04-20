'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useReconcileInvoice } from '../hooks/use-invoice'
import { cn } from '@/lib/utils'

interface ReconciliationDialogProps {
  invoiceId: string
  action: 'approve' | 'dispute' | 'reject'
  isOpen: boolean
  onClose: () => void
}

const ACTION_CONFIG = {
  approve: {
    title: 'Approva riconciliazione',
    description:
      'Confermi di voler approvare la riconciliazione di questa fattura? I dati verranno considerati verificati e corretti.',
    buttonLabel: 'Approva',
    buttonClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  dispute: {
    title: 'Contesta fattura',
    description:
      'Indica i motivi della contestazione. La fattura verrà segnalata per una revisione con il fornitore.',
    buttonLabel: 'Contesta',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  reject: {
    title: 'Rifiuta fattura',
    description:
      'Confermi di voler rifiutare questa fattura? Questa azione segnalerà la fattura come non valida.',
    buttonLabel: 'Rifiuta',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
} as const

export function ReconciliationDialog({
  invoiceId,
  action,
  isOpen,
  onClose,
}: ReconciliationDialogProps) {
  const [notes, setNotes] = useState('')
  const reconcileMutation = useReconcileInvoice(invoiceId)
  const config = ACTION_CONFIG[action]

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  function handleSubmit() {
    reconcileMutation.mutate(
      { action, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          setNotes('')
          onClose()
        },
      },
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClose()
        }}
        role="button"
        tabIndex={-1}
        aria-label="Chiudi dialogo"
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-card border border-pf-border bg-pf-bg-secondary p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            {config.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-button text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-pf-text-secondary">
          {config.description}
        </p>

        {/* Notes */}
        <div className="mb-6">
          <label
            htmlFor="reconciliation-notes"
            className="mb-1.5 block text-xs font-medium text-pf-text-secondary"
          >
            Note (opzionale)
          </label>
          <textarea
            id="reconciliation-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Aggiungi eventuali note..."
            rows={3}
            className="w-full resize-none rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-button border border-pf-border bg-pf-bg-tertiary px-4 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={reconcileMutation.isPending}
            onClick={handleSubmit}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-button px-4 text-sm font-medium transition-colors disabled:opacity-50',
              config.buttonClass,
            )}
          >
            {reconcileMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {config.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
