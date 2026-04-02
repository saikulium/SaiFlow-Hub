'use client'

import { useEffect } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Loader2, AlertCircle } from 'lucide-react'
import {
  updateClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
} from '@/lib/validations/client'
import { useCreateClient, useUpdateClient } from '@/hooks/use-clients'
import { cn } from '@/lib/utils'
import type { ClientListItem } from '@/types'

interface ClientDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly client?: ClientListItem | null
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Attivo' },
  { value: 'INACTIVE', label: 'Inattivo' },
  { value: 'PENDING_REVIEW', label: 'In Revisione' },
] as const

function buildDefaults(client?: ClientListItem | null): UpdateClientInput {
  if (!client) {
    return {
      name: '',
      code: '',
      tax_id: '',
      email: '',
      phone: '',
      contact_person: '',
      address: '',
      notes: '',
    }
  }
  return {
    name: client.name,
    code: client.code,
    tax_id: client.tax_id ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    contact_person: client.contact_person ?? '',
    address: '',
    notes: '',
    status: client.status as UpdateClientInput['status'],
  }
}

export function ClientDialog({
  open,
  onOpenChange,
  client,
}: ClientDialogProps) {
  const isEdit = Boolean(client)
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient(client?.id ?? '')

  const mutation = isEdit ? updateMutation : createMutation

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateClientInput>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: buildDefaults(client),
  })

  useEffect(() => {
    if (open) {
      reset(buildDefaults(client))
    }
  }, [open, client, reset])

  const onSubmit = async (data: UpdateClientInput) => {
    if (isEdit) {
      await updateMutation.mutateAsync(data)
    } else {
      await createMutation.mutateAsync(data as CreateClientInput)
    }
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
          <div>
            <h2 className="font-display text-lg font-semibold text-pf-text-primary">
              {isEdit ? 'Modifica Cliente' : 'Nuovo Cliente'}
            </h2>
            {isEdit && client && (
              <p className="text-sm text-pf-text-secondary">{client.code}</p>
            )}
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
                placeholder="Ragione sociale"
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
                Codice
              </label>
              <input
                {...register('code')}
                placeholder="Auto-generato"
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

          {/* Tax ID */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Partita IVA
            </label>
            <input
              {...register('tax_id')}
              placeholder="IT01234567890"
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
            />
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
                placeholder="email@azienda.it"
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
                placeholder="+39 ..."
                className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Contact person */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Persona di contatto
            </label>
            <input
              {...register('contact_person')}
              placeholder="Nome e cognome"
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
            />
          </div>

          {/* Address */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-pf-text-primary">
              Indirizzo
            </label>
            <input
              {...register('address')}
              placeholder="Via, città, CAP"
              className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
            />
          </div>

          {/* Status (edit only) */}
          {isEdit && (
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
          )}

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
          {mutation.error && (
            <p className="text-sm text-red-400">
              {mutation.error instanceof Error
                ? mutation.error.message
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
              disabled={isSubmitting || (isEdit && !isDirty)}
              className={cn(
                'inline-flex items-center gap-2 rounded-button px-4 py-2 text-sm font-medium text-white transition-colors',
                isSubmitting || (isEdit && !isDirty)
                  ? 'bg-pf-accent/50 cursor-not-allowed'
                  : 'bg-pf-accent hover:bg-pf-accent-hover',
              )}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Salva modifiche' : 'Crea cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
