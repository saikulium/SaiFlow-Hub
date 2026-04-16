'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'
import {
  updateRequestSchema,
  type UpdateRequestInput,
} from '@/lib/validations/request'
import {
  useUpdateRequest,
  useVendors,
  type RequestDetail,
} from '@/hooks/use-request'
import { useCommesse } from '@/hooks/use-commesse'
import { PRIORITY_CONFIG, type PriorityKey } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface RequestEditDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly request: RequestDetail
}

const PRIORITY_OPTIONS: readonly { value: PriorityKey; label: string }[] = [
  { value: 'LOW', label: PRIORITY_CONFIG.LOW.label },
  { value: 'MEDIUM', label: PRIORITY_CONFIG.MEDIUM.label },
  { value: 'HIGH', label: PRIORITY_CONFIG.HIGH.label },
  { value: 'URGENT', label: PRIORITY_CONFIG.URGENT.label },
]

const CATEGORY_OPTIONS = [
  'Hardware',
  'Software',
  'Servizi',
  'Materiali',
  'Attrezzature',
  'Altro',
] as const

function buildDefaults(r: RequestDetail): UpdateRequestInput {
  return {
    title: r.title,
    description: r.description ?? undefined,
    priority: r.priority,
    vendor_id: r.vendor?.id ?? undefined,
    estimated_amount: r.estimated_amount ?? undefined,
    needed_by: r.needed_by?.split('T')[0] ?? undefined,
    category: r.category ?? undefined,
    department: r.department ?? undefined,
    cost_center: r.cost_center ?? undefined,
    budget_code: r.budget_code ?? undefined,
    cig: r.cig ?? undefined,
    cup: r.cup ?? undefined,
    is_mepa: r.is_mepa,
    mepa_oda_number: r.mepa_oda_number ?? undefined,
    commessa_id: r.commessa?.id ?? undefined,
    tags: r.tags,
    items: r.items.map((item) => ({
      name: item.name,
      description: item.description ?? undefined,
      quantity: item.quantity,
      unit: item.unit ?? undefined,
      unit_price: item.unit_price ?? undefined,
      total_price: item.total_price ?? undefined,
      sku: item.sku ?? undefined,
    })),
    actual_amount: r.actual_amount ?? undefined,
    tracking_number: r.tracking_number ?? undefined,
    external_ref: r.external_ref ?? undefined,
    external_url: r.external_url ?? undefined,
  }
}

export function RequestEditDialog({
  open,
  onOpenChange,
  request,
}: RequestEditDialogProps) {
  const updateRequest = useUpdateRequest(request.id)
  const { data: vendorsResponse } = useVendors()
  const vendors = vendorsResponse?.data ?? []
  const { data: commesse } = useCommesse({ status: 'DRAFT,PLANNING,ACTIVE' })

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateRequestInput>({
    resolver: zodResolver(updateRequestSchema),
    defaultValues: buildDefaults(request),
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  useEffect(() => {
    if (open) {
      reset(buildDefaults(request))
    }
  }, [open, request, reset])

  const onSubmit: SubmitHandler<UpdateRequestInput> = async (data) => {
    await updateRequest.mutateAsync(data)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[5vh]">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative w-full max-w-2xl rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pf-border px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-pf-text-primary">
              Modifica Richiesta
            </h2>
            <p className="text-sm text-pf-text-secondary">{request.code}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-button p-2 text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Titolo *
            </label>
            <input
              {...register('title')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
            />
            {errors.title && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Descrizione
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
            />
          </div>

          {/* Priority + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Priorità
              </label>
              <select
                {...register('priority')}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Categoria
              </label>
              <select
                {...register('category')}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              >
                <option value="">Seleziona...</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vendor + Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Fornitore
              </label>
              <select
                {...register('vendor_id')}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              >
                <option value="">Nessuno</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Importo stimato (€)
              </label>
              <input
                {...register('estimated_amount', { valueAsNumber: true })}
                type="number"
                step="0.01"
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Commessa */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Commessa
            </label>
            <select
              {...register('commessa_id')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
            >
              <option value="">Nessuna commessa</option>
              {(commesse ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Needed by + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Data necessità
              </label>
              <input
                {...register('needed_by')}
                type="date"
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Reparto
              </label>
              <input
                {...register('department')}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-pf-text-primary">
                Articoli
              </label>
              <button
                type="button"
                onClick={() => append({ name: '', quantity: 1 })}
                className="inline-flex items-center gap-1 text-xs text-pf-accent hover:text-pf-accent-hover"
              >
                <Plus className="h-3 w-3" />
                Aggiungi
              </button>
            </div>
            {fields.length > 0 && (
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="flex items-start gap-2 rounded-button border border-pf-border bg-pf-bg-primary p-3"
                  >
                    <div className="flex-1 space-y-2">
                      <input
                        {...register(`items.${idx}.name`)}
                        placeholder="Nome articolo"
                        className="w-full rounded-button border border-pf-border bg-pf-bg-secondary px-2 py-1.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <input
                          {...register(`items.${idx}.quantity`, {
                            valueAsNumber: true,
                          })}
                          type="number"
                          min={1}
                          placeholder="Qtà"
                          className="w-20 rounded-button border border-pf-border bg-pf-bg-secondary px-2 py-1.5 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
                        />
                        <input
                          {...register(`items.${idx}.unit`)}
                          placeholder="UM"
                          className="w-16 rounded-button border border-pf-border bg-pf-bg-secondary px-2 py-1.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
                        />
                        <input
                          {...register(`items.${idx}.unit_price`, {
                            valueAsNumber: true,
                          })}
                          type="number"
                          step="0.01"
                          placeholder="Prezzo unit."
                          className="w-28 rounded-button border border-pf-border bg-pf-bg-secondary px-2 py-1.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="mt-1 rounded-button p-1.5 text-pf-text-muted hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {updateRequest.error && (
            <p className="text-sm text-red-400">
              {updateRequest.error instanceof Error
                ? updateRequest.error.message
                : 'Errore nel salvataggio'}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-pf-border pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className={cn(
                'inline-flex items-center gap-2 rounded-button px-4 py-2 text-sm font-medium text-white transition-colors',
                isSubmitting || !isDirty
                  ? 'bg-pf-accent/50 cursor-not-allowed'
                  : 'bg-pf-accent hover:bg-pf-accent-hover',
              )}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Salva modifiche
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
