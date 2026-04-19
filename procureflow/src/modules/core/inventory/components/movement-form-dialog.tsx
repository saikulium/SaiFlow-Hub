'use client'

import { useCallback, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useCreateMovement } from '../hooks/use-stock'
import { useWarehouses } from '../hooks/use-stock'
import {
  MOVEMENT_TYPE_CONFIG,
  MOVEMENT_REASON_LABELS,
} from '../constants/inventory'
import { cn } from '@/lib/utils'

interface MovementFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormState {
  movement_type: string
  reason: string
  material_id: string
  quantity: string
  quantity_secondary: string
  unit_cost: string
  lot_id: string
  warehouse_id: string
  zone_id: string
  to_warehouse_id: string
  to_zone_id: string
  reference_code: string
  notes: string
}

const INITIAL_FORM: FormState = {
  movement_type: 'INBOUND',
  reason: '',
  material_id: '',
  quantity: '',
  quantity_secondary: '',
  unit_cost: '',
  lot_id: '',
  warehouse_id: '',
  zone_id: '',
  to_warehouse_id: '',
  to_zone_id: '',
  reference_code: '',
  notes: '',
}

const REASONS_BY_TYPE: Record<string, string[]> = {
  INBOUND: [
    'ACQUISTO',
    'RESO_CLIENTE',
    'PRODUZIONE',
    'TRASFERIMENTO_IN',
    'RETTIFICA_POSITIVA',
  ],
  OUTBOUND: [
    'VENDITA',
    'RESO_FORNITORE',
    'TRASFERIMENTO_OUT',
    'RETTIFICA_NEGATIVA',
    'SCARTO',
  ],
  TRANSFER: ['TRASFERIMENTO_IN', 'TRASFERIMENTO_OUT'],
  ADJUSTMENT: [
    'RETTIFICA_POSITIVA',
    'RETTIFICA_NEGATIVA',
    'INVENTARIO',
    'CORREZIONE_MANUALE',
  ],
  RETURN: ['RESO_CLIENTE', 'RESO_FORNITORE'],
}

function parsePayload(form: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    movement_type: form.movement_type,
    reason: form.reason,
    material_id: form.material_id,
    quantity: Number(form.quantity),
    warehouse_id: form.warehouse_id,
  }
  if (form.quantity_secondary)
    payload.quantity_secondary = Number(form.quantity_secondary)
  if (form.unit_cost) payload.unit_cost = Number(form.unit_cost)
  if (form.lot_id) payload.lot_id = form.lot_id
  if (form.zone_id) payload.zone_id = form.zone_id
  if (form.to_warehouse_id) payload.to_warehouse_id = form.to_warehouse_id
  if (form.to_zone_id) payload.to_zone_id = form.to_zone_id
  if (form.reference_code) payload.reference_code = form.reference_code
  if (form.notes) payload.notes = form.notes
  return payload
}

export function MovementFormDialog({
  open,
  onOpenChange,
}: MovementFormDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({})

  const createMutation = useCreateMovement()
  const { data: warehouses } = useWarehouses()

  const availableReasons = useMemo(
    () => REASONS_BY_TYPE[form.movement_type] ?? [],
    [form.movement_type],
  )

  const selectedWarehouse = useMemo(
    () => warehouses?.find((w) => w.id === form.warehouse_id),
    [warehouses, form.warehouse_id],
  )

  const toWarehouse = useMemo(
    () => warehouses?.find((w) => w.id === form.to_warehouse_id),
    [warehouses, form.to_warehouse_id],
  )

  const isTransfer = form.movement_type === 'TRANSFER'
  const isInbound = form.movement_type === 'INBOUND'
  const isOutbound = form.movement_type === 'OUTBOUND'

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value }
        // Reset reason when type changes
        if (key === 'movement_type') {
          next.reason = ''
        }
        // Reset zone when warehouse changes
        if (key === 'warehouse_id') {
          next.zone_id = ''
        }
        if (key === 'to_warehouse_id') {
          next.to_zone_id = ''
        }
        return next
      })
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
    if (!form.movement_type) newErrors.movement_type = 'Tipo obbligatorio'
    if (!form.reason) newErrors.reason = 'Causale obbligatoria'
    if (!form.material_id) newErrors.material_id = 'Materiale obbligatorio'
    if (!form.quantity || Number(form.quantity) <= 0)
      newErrors.quantity = 'Quantita deve essere positiva'
    if (!form.warehouse_id) newErrors.warehouse_id = 'Magazzino obbligatorio'
    if (isOutbound && !form.lot_id)
      newErrors.lot_id = 'Lotto obbligatorio per scarico'
    if (isTransfer && !form.to_warehouse_id)
      newErrors.to_warehouse_id = 'Magazzino destinazione obbligatorio'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form, isOutbound, isTransfer])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      const payload = parsePayload(form)
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

  const inputClassName =
    'w-full rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/60 focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent'
  const labelClassName = 'block text-xs font-medium text-pf-text-secondary mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pf-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Registra Movimento
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-button p-1 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
            {/* Type & Reason */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClassName}>Tipo Movimento *</label>
                <select
                  value={form.movement_type}
                  onChange={(e) => updateField('movement_type', e.target.value)}
                  className={cn(
                    inputClassName,
                    errors.movement_type && 'border-red-500',
                  )}
                >
                  {Object.entries(MOVEMENT_TYPE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
                {errors.movement_type && (
                  <p className="mt-1 text-xs text-red-400">
                    {errors.movement_type}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClassName}>Causale *</label>
                <select
                  value={form.reason}
                  onChange={(e) => updateField('reason', e.target.value)}
                  className={cn(
                    inputClassName,
                    errors.reason && 'border-red-500',
                  )}
                >
                  <option value="">Seleziona causale...</option>
                  {availableReasons.map((r) => (
                    <option key={r} value={r}>
                      {MOVEMENT_REASON_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
                {errors.reason && (
                  <p className="mt-1 text-xs text-red-400">{errors.reason}</p>
                )}
              </div>
            </div>

            {/* Material */}
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

            {/* Quantity */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClassName}>Quantita *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => updateField('quantity', e.target.value)}
                  className={cn(
                    inputClassName,
                    errors.quantity && 'border-red-500',
                  )}
                  placeholder="0"
                />
                {errors.quantity && (
                  <p className="mt-1 text-xs text-red-400">{errors.quantity}</p>
                )}
              </div>
              <div>
                <label className={labelClassName}>Quantita UM Secondaria</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.quantity_secondary}
                  onChange={(e) =>
                    updateField('quantity_secondary', e.target.value)
                  }
                  className={inputClassName}
                  placeholder="0"
                />
              </div>
              {isInbound && (
                <div>
                  <label className={labelClassName}>Costo Unitario (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unit_cost}
                    onChange={(e) => updateField('unit_cost', e.target.value)}
                    className={inputClassName}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            {/* Lot (required for OUTBOUND) */}
            {isOutbound && (
              <div>
                <label className={labelClassName}>ID Lotto *</label>
                <input
                  type="text"
                  value={form.lot_id}
                  onChange={(e) => updateField('lot_id', e.target.value)}
                  className={cn(
                    inputClassName,
                    errors.lot_id && 'border-red-500',
                  )}
                  placeholder="ID del lotto"
                />
                {errors.lot_id && (
                  <p className="mt-1 text-xs text-red-400">{errors.lot_id}</p>
                )}
              </div>
            )}

            {/* Warehouse & Zone */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClassName}>Magazzino *</label>
                <select
                  value={form.warehouse_id}
                  onChange={(e) => updateField('warehouse_id', e.target.value)}
                  className={cn(
                    inputClassName,
                    errors.warehouse_id && 'border-red-500',
                  )}
                >
                  <option value="">Seleziona magazzino...</option>
                  {(warehouses ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
                {errors.warehouse_id && (
                  <p className="mt-1 text-xs text-red-400">
                    {errors.warehouse_id}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClassName}>Zona</label>
                <select
                  value={form.zone_id}
                  onChange={(e) => updateField('zone_id', e.target.value)}
                  className={inputClassName}
                  disabled={!selectedWarehouse}
                >
                  <option value="">Seleziona zona...</option>
                  {(selectedWarehouse?.zones ?? []).map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transfer destination */}
            {isTransfer && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>
                    Magazzino Destinazione *
                  </label>
                  <select
                    value={form.to_warehouse_id}
                    onChange={(e) =>
                      updateField('to_warehouse_id', e.target.value)
                    }
                    className={cn(
                      inputClassName,
                      errors.to_warehouse_id && 'border-red-500',
                    )}
                  >
                    <option value="">Seleziona magazzino...</option>
                    {(warehouses ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                  {errors.to_warehouse_id && (
                    <p className="mt-1 text-xs text-red-400">
                      {errors.to_warehouse_id}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClassName}>Zona Destinazione</label>
                  <select
                    value={form.to_zone_id}
                    onChange={(e) => updateField('to_zone_id', e.target.value)}
                    className={inputClassName}
                    disabled={!toWarehouse}
                  >
                    <option value="">Seleziona zona...</option>
                    {(toWarehouse?.zones ?? []).map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Reference & Notes */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClassName}>Codice Riferimento</label>
                <input
                  type="text"
                  value={form.reference_code}
                  onChange={(e) =>
                    updateField('reference_code', e.target.value)
                  }
                  className={inputClassName}
                  placeholder="DDT, fattura, ordine..."
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
              {createMutation.isPending
                ? 'Registrazione...'
                : 'Registra Movimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
