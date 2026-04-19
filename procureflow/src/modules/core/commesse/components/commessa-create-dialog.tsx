'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, AlertCircle } from 'lucide-react'
import {
  createCommessaSchema,
  type CreateCommessaInput,
} from '../validations/commesse'
import { useCreateCommessa } from '@/hooks/use-commesse'
import { useClients } from '@/modules/core/clients'
import { cn } from '@/lib/utils'
import type { z } from 'zod'

interface CommessaCreateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Bassa' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
] as const

/** Use zod input type so defaulted fields (currency, priority, tags) are optional in the form */
type FormInput = z.input<typeof createCommessaSchema>

const DEFAULTS: FormInput = {
  title: '',
  description: '',
  client_id: '',
  client_value: undefined,
  currency: 'EUR',
  deadline: undefined,
  category: '',
  department: '',
  priority: 'MEDIUM',
  tags: [],
  assigned_to: '',
}

export function CommessaCreateDialog({
  open,
  onOpenChange,
}: CommessaCreateDialogProps) {
  const createMutation = useCreateCommessa()
  const { data: clients } = useClients({ status: 'ACTIVE' })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(createCommessaSchema),
    defaultValues: DEFAULTS,
  })

  useEffect(() => {
    if (open) {
      reset(DEFAULTS)
    }
  }, [open, reset])

  const onSubmit = async (data: FormInput) => {
    // Clean optional fields before sending
    const payload: CreateCommessaInput = {
      ...data,
      title: data.title,
      client_id: data.client_id,
      currency: data.currency ?? 'EUR',
      priority: data.priority ?? 'MEDIUM',
      tags: data.tags ?? [],
      client_value: data.client_value || undefined,
      deadline: data.deadline || undefined,
      category: data.category || undefined,
      department: data.department || undefined,
      assigned_to: data.assigned_to || undefined,
    }
    await createMutation.mutateAsync(payload)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[5vh]">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative w-full max-w-lg rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pf-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Nuova Commessa
          </h2>
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
              placeholder="Titolo della commessa"
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
              placeholder="Descrizione della commessa..."
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
            />
          </div>

          {/* Client */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Cliente *
            </label>
            <select
              {...register('client_id')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
            >
              <option value="">Seleziona un cliente</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            {errors.client_id && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                {errors.client_id.message}
              </p>
            )}
          </div>

          {/* Value + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Valore Cliente (EUR)
              </label>
              <input
                {...register('client_value', { valueAsNumber: true })}
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
            </div>
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
          </div>

          {/* Deadline */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Scadenza
            </label>
            <input
              {...register('deadline')}
              type="datetime-local"
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
            />
          </div>

          {/* Category + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Categoria
              </label>
              <input
                {...register('category')}
                placeholder="es: Manutenzione"
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
                Dipartimento
              </label>
              <input
                {...register('department')}
                placeholder="es: Produzione"
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Error */}
          {createMutation.error && (
            <p className="text-sm text-red-400">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Errore nella creazione'}
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
              disabled={isSubmitting}
              className={cn(
                'inline-flex items-center gap-2 rounded-button px-4 py-2 text-sm font-medium text-white transition-colors',
                isSubmitting
                  ? 'bg-pf-accent/50 cursor-not-allowed'
                  : 'bg-pf-accent hover:bg-pf-accent-hover',
              )}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Crea commessa
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
