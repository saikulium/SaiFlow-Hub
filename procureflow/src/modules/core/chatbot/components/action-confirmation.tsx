'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { ActionPreview } from '@/types/ai'

interface ActionConfirmationDialogProps {
  readonly actionId: string
  readonly tool: string
  readonly preview: ActionPreview
  readonly onConfirm: (actionId: string) => void
  readonly onCancel: (actionId: string) => void
}

export function ActionConfirmationDialog({
  actionId,
  preview,
  onConfirm,
  onCancel,
}: ActionConfirmationDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  function handleConfirm() {
    setIsLoading(true)
    onConfirm(actionId)
  }

  function handleCancel() {
    onCancel(actionId)
  }

  return (
    <div className="rounded-xl border border-pf-border bg-pf-bg-tertiary p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-yellow-500">
        <AlertTriangle className="h-4 w-4" />
        Conferma azione
      </div>

      <p className="mb-1 text-sm font-medium text-pf-text-primary">
        {preview.label}
      </p>
      <p className="mb-3 text-xs text-pf-text-secondary">
        L&apos;agente vuole eseguire questa azione:
      </p>

      <div className="mb-4 rounded-lg bg-pf-bg-primary p-3 text-xs leading-relaxed">
        {preview.fields.map((field) => (
          <div key={field.key} className="flex gap-2">
            <span className="text-pf-text-muted">{field.key}:</span>
            <span className="text-pf-text-primary">{field.value}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="rounded-md border border-pf-border px-3 py-1.5 text-xs text-pf-text-secondary transition-colors hover:bg-pf-bg-hover disabled:opacity-50"
        >
          Annulla
        </button>
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-md bg-pf-accent px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          Conferma
        </button>
      </div>
    </div>
  )
}
