'use client'

import { useEffect } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, AlertCircle } from 'lucide-react'
import {
  updateVendorSchema,
  type UpdateVendorInput,
} from '../validations/vendor'
import { useUpdateVendor, type VendorDetail } from '../hooks/use-vendors'
import { cn } from '@/lib/utils'

interface VendorEditDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly vendor: VendorDetail
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Attivo' },
  { value: 'INACTIVE', label: 'Inattivo' },
  { value: 'BLACKLISTED', label: 'Bloccato' },
  { value: 'PENDING_REVIEW', label: 'In Revisione' },
] as const

const PORTAL_TYPE_OPTIONS = [
  { value: '', label: 'Nessuno' },
  { value: 'WEBSITE', label: 'Sito Web' },
  { value: 'EMAIL_ONLY', label: 'Solo Email' },
  { value: 'API', label: 'API' },
  { value: 'MARKETPLACE', label: 'Marketplace' },
  { value: 'PHONE', label: 'Telefono' },
] as const

function buildDefaults(v: VendorDetail): UpdateVendorInput {
  return {
    name: v.name,
    code: v.code,
    email: v.email ?? '',
    phone: v.phone ?? '',
    website: v.website ?? '',
    portal_url: v.portal_url ?? '',
    portal_type:
      (v.portal_type as UpdateVendorInput['portal_type']) ?? undefined,
    category: v.category,
    payment_terms: v.payment_terms ?? '',
    rating: v.rating ?? undefined,
    notes: v.notes ?? '',
    status: (v.status as UpdateVendorInput['status']) ?? undefined,
  }
}

export function VendorEditDialog({
  open,
  onOpenChange,
  vendor,
}: VendorEditDialogProps) {
  const updateVendor = useUpdateVendor(vendor.id)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateVendorInput>({
    resolver: zodResolver(updateVendorSchema),
    defaultValues: buildDefaults(vendor),
  })

  useEffect(() => {
    if (open) {
      reset(buildDefaults(vendor))
    }
  }, [open, vendor, reset])

  const onSubmit: SubmitHandler<UpdateVendorInput> = async (data) => {
    await updateVendor.mutateAsync(data)
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
              Modifica Fornitore
            </h2>
            <p className="text-sm text-pf-text-secondary">{vendor.code}</p>
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
          {/* Name + Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Nome *
              </label>
              <input
                {...register('name')}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
              {errors.name && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Codice *
              </label>
              <input
                {...register('code')}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
              {errors.code && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {errors.code.message}
                </p>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Stato
            </label>
            <select
              {...register('status')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
              {errors.email && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Telefono
              </label>
              <input
                {...register('phone')}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Website + Portal URL */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Sito Web
              </label>
              <input
                {...register('website')}
                placeholder="https://..."
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
              {errors.website && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {errors.website.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Tipo Portale
              </label>
              <select
                {...register('portal_type')}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              >
                {PORTAL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment terms + Rating */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Termini di pagamento
              </label>
              <input
                {...register('payment_terms')}
                placeholder="es: 30gg DFFM"
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Rating (0-5)
              </label>
              <input
                {...register('rating', { valueAsNumber: true })}
                type="number"
                min={0}
                max={5}
                step={0.5}
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Note
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
            />
          </div>

          {/* Error */}
          {updateVendor.error && (
            <p className="text-sm text-red-400">
              {updateVendor.error instanceof Error
                ? updateVendor.error.message
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
