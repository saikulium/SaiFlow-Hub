'use client'

import { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import { useCreateReservation } from '../hooks/use-stock'
import { cn } from '@/lib/utils'

interface ReservationDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

interface FormState {
  material_id: string
  lot_id: string
  reserved_quantity: string
  tender_id: string
  purchase_request_id: string
  expires_at: string
  notes: string
}

const INITIAL_FORM: FormState = {
  material_id: '',
  lot_id: '',
  reserved_quantity: '',
  tender_id: '',
  purchase_request_id: '',
  expires_at: '',
  notes: '',
}

export function ReservationDialog({
  open,
  onOpenChange,
}: ReservationDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({})
  const createMutation = useCreateReservation()

  const inputClassName =
    'w-full rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/60 focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent'
  const labelClassName = 'block text-xs font-medium text-pf-text-secondary mb-1'

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => {
        if (!prev[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [],
  )

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {}
    if (!form.material_id) newErrors.material_id = 'Materiale obbligatorio'
    if (!form.reserved_quantity || Number(form.reserved_quantity) <= 0)
      newErrors.reserved_quantity = 'Quantita deve essere positiva'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      const payload: Record<string, unknown> = {
        material_id: form.material_id,
        reserved_quantity: Number(form.reserved_quantity),
      }
      if (form.lot_id) payload.lot_id = form.lot_id
      if (form.tender_id) payload.tender_id = form.tender_id
      if (form.purchase_request_id)
        payload.purchase_request_id = form.purchase_request_id
      if (form.expires_at) payload.expires_at = form.expires_at
      if (form.notes) payload.notes = form.notes

      createMutation.mutate(payload, {
        onSuccess: () => {
          setForm(INITIAL_FORM)
          onOpenChange(false)
        },
      })
    },
    [form, validate, createMutation, onOpenChange],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pf-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Riserva Materiale
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-button p-1 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <label className={labelClassName}>ID Materiale *</label>
              <input
                type="text"
                value={form.material_id}
                onChange={(e) => updateField('material_id', e.target.value)}
                className={cn(
                  inputClassName,
                  errors.material_id && 'border-red-500',
                )}
                placeholder="ID del materiale"
              />
              {errors.material_id && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.material_id}
                </p>
              )}
            </div>

            <div>
              <label className={labelClassName}>ID Lotto (opzionale)</label>
              <input
                type="text"
                value={form.lot_id}
                onChange={(e) => updateField('lot_id', e.target.value)}
                className={inputClassName}
                placeholder="ID del lotto specifico"
              />
            </div>

            <div>
              <label className={labelClassName}>Quantita da riservare *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.reserved_quantity}
                onChange={(e) =>
                  updateField('reserved_quantity', e.target.value)
                }
                className={cn(
                  inputClassName,
                  errors.reserved_quantity && 'border-red-500',
                )}
                placeholder="0"
              />
              {errors.reserved_quantity && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.reserved_quantity}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClassName}>ID Gara (opzionale)</label>
                <input
                  type="text"
                  value={form.tender_id}
                  onChange={(e) => updateField('tender_id', e.target.value)}
                  className={inputClassName}
                  placeholder="ID gara"
                />
              </div>
              <div>
                <label className={labelClassName}>
                  ID Richiesta (opzionale)
                </label>
                <input
                  type="text"
                  value={form.purchase_request_id}
                  onChange={(e) =>
                    updateField('purchase_request_id', e.target.value)
                  }
                  className={inputClassName}
                  placeholder="ID richiesta"
                />
              </div>
            </div>

            <div>
              <label className={labelClassName}>Scadenza (opzionale)</label>
              <input
                type="date"
                value={form.expires_at}
                onChange={(e) => updateField('expires_at', e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className={labelClassName}>Note</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                className={inputClassName}
                placeholder="Note..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-pf-border px-6 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className={cn(
                'rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover',
                createMutation.isPending && 'cursor-not-allowed opacity-60',
              )}
            >
              {createMutation.isPending ? 'Creazione...' : 'Crea Riserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
