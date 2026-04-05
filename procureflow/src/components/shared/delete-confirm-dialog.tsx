'use client'

import { useCallback } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

interface DeleteConfirmDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: () => void
  readonly isDeleting: boolean
  readonly title: string
  readonly description: string
  readonly itemName?: string
  readonly count?: number
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
  title,
  description,
  itemName,
  count,
}: DeleteConfirmDialogProps) {
  const handleClose = useCallback(() => {
    if (!isDeleting) {
      onOpenChange(false)
    }
  }, [isDeleting, onOpenChange])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose()
      }
    },
    [handleClose],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-card border border-pf-border bg-pf-bg-secondary p-6 shadow-xl">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isDeleting}
          className="absolute right-4 top-4 rounded-button p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>

        {/* Title */}
        <h3 className="mt-4 text-center font-display text-lg font-semibold text-pf-text-primary">
          {title}
        </h3>

        {/* Description */}
        <p className="mt-2 text-center text-sm text-pf-text-secondary">
          {description}
        </p>

        {/* Item name highlight */}
        {itemName && (
          <div className="mt-3 rounded-button border border-pf-border bg-pf-bg-primary/40 px-3 py-2 text-center">
            <span className="text-sm font-medium text-pf-text-primary">
              {itemName}
            </span>
          </div>
        )}

        {/* Count badge */}
        {count != null && count > 1 && (
          <div className="mt-3 text-center">
            <span className="inline-flex items-center rounded-badge bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
              {count} elementi selezionati
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:border-pf-border-hover hover:text-pf-text-primary"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-button bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Eliminazione...
              </>
            ) : (
              'Elimina'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
