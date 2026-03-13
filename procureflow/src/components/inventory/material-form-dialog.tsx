'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import {
  createMaterialSchema,
  type CreateMaterialInput,
} from '@/lib/validations/inventory'
import { useCreateMaterial, useUpdateMaterial } from '@/hooks/use-materials'
import { cn } from '@/lib/utils'
import type { MaterialDetail } from '@/types'

interface MaterialFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: MaterialDetail | null
}

const UNIT_OPTIONS = [
  { value: 'm', label: 'm (metri)' },
  { value: 'kg', label: 'kg (chilogrammi)' },
  { value: 'pz', label: 'pz (pezzi)' },
  { value: 'bobina', label: 'bobina' },
  { value: 'rotolo', label: 'rotolo' },
]

const CATEGORY_OPTIONS = [
  'Cavi',
  'Cablaggi',
  'Connettori',
  'Accessori',
  'Materie Prime',
]

function buildDefaults(data?: MaterialDetail | null): CreateMaterialInput {
  return {
    name: data?.name ?? '',
    description: data?.description ?? undefined,
    category: data?.category ?? undefined,
    subcategory: data?.subcategory ?? undefined,
    unit_primary: data?.unitPrimary ?? 'pz',
    unit_secondary: data?.unitSecondary ?? undefined,
    conversion_factor: data?.conversionFactor ?? undefined,
    min_stock_level: data?.minStockLevel ?? undefined,
    max_stock_level: data?.maxStockLevel ?? undefined,
    barcode: data?.barcode ?? undefined,
    preferred_vendor_id: undefined,
    tags: data?.tags ?? undefined,
    notes: data?.notes ?? undefined,
  }
}

export function MaterialFormDialog({
  open,
  onOpenChange,
  initialData,
}: MaterialFormDialogProps) {
  const createMutation = useCreateMaterial()
  const updateMutation = useUpdateMaterial()
  const isEdit = !!initialData

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMaterialInput>({
    resolver: zodResolver(createMaterialSchema),
    defaultValues: buildDefaults(initialData),
  })

  const unitSecondary = watch('unit_secondary')

  const onSubmit = async (data: CreateMaterialInput) => {
    if (isEdit && initialData) {
      await updateMutation.mutateAsync({ id: initialData.id, ...data })
    } else {
      await createMutation.mutateAsync(data)
    }
    onOpenChange(false)
    reset()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
            {isEdit ? 'Modifica Materiale' : 'Nuovo Materiale'}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-button p-1 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
            {/* Informazioni Generali */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">
                Informazioni Generali
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClassName}>Nome *</label>
                  <input
                    {...register('name')}
                    className={cn(inputClassName, errors.name && 'border-red-500')}
                    placeholder="Nome del materiale"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClassName}>Descrizione</label>
                  <textarea
                    {...register('description')}
                    rows={2}
                    className={inputClassName}
                    placeholder="Descrizione del materiale..."
                  />
                </div>
                <div>
                  <label className={labelClassName}>Categoria</label>
                  <select {...register('category')} className={inputClassName}>
                    <option value="">Seleziona...</option>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClassName}>Sottocategoria</label>
                  <input
                    {...register('subcategory')}
                    className={inputClassName}
                    placeholder="Sottocategoria"
                  />
                </div>
              </div>
            </section>

            {/* Unita di Misura */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">
                Unita di Misura
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClassName}>UM Primaria *</label>
                  <select
                    {...register('unit_primary')}
                    className={cn(
                      inputClassName,
                      errors.unit_primary && 'border-red-500',
                    )}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  {errors.unit_primary && (
                    <p className="mt-1 text-xs text-red-400">
                      {errors.unit_primary.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClassName}>UM Secondaria</label>
                  <select {...register('unit_secondary')} className={inputClassName}>
                    <option value="">Nessuna</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                {unitSecondary && (
                  <div>
                    <label className={labelClassName}>Fattore Conversione</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      {...register('conversion_factor', { valueAsNumber: true })}
                      className={inputClassName}
                      placeholder="es. 1000"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Scorte */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">Scorte</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>Scorta Minima</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('min_stock_level', { valueAsNumber: true })}
                    className={inputClassName}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelClassName}>Scorta Massima</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('max_stock_level', { valueAsNumber: true })}
                    className={inputClassName}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelClassName}>Codice a Barre</label>
                  <input
                    {...register('barcode')}
                    className={inputClassName}
                    placeholder="EAN / UPC"
                  />
                </div>
              </div>
            </section>

            {/* Fornitore */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">
                Fornitore
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClassName}>
                    Fornitore Preferito (opzionale)
                  </label>
                  <input
                    {...register('preferred_vendor_id')}
                    className={inputClassName}
                    placeholder="ID fornitore"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClassName}>Note</label>
                  <textarea
                    {...register('notes')}
                    rows={2}
                    className={inputClassName}
                    placeholder="Note aggiuntive..."
                  />
                </div>
              </div>
            </section>
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
              disabled={isPending || isSubmitting}
              className={cn(
                'rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover',
                (isPending || isSubmitting) && 'cursor-not-allowed opacity-60',
              )}
            >
              {isPending || isSubmitting
                ? 'Salvataggio...'
                : isEdit
                  ? 'Aggiorna'
                  : 'Crea Materiale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
