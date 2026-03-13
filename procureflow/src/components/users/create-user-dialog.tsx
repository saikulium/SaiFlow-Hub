'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { createUserSchema, type CreateUserInput } from '@/lib/validations/auth'
import { useCreateUser } from '@/hooks/use-users'

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'REQUESTER', label: 'Richiedente' },
  { value: 'VIEWER', label: 'Visualizzatore' },
] as const

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const createUser = useCreateUser()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'REQUESTER',
      department: '',
    },
  })

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  const onSubmit = async (data: CreateUserInput) => {
    await createUser.mutateAsync(data)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onOpenChange(false)
        }}
        role="button"
        tabIndex={-1}
        aria-label="Chiudi dialogo"
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-card border border-pf-border bg-pf-bg-secondary p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Nuovo Utente
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-button p-1.5 text-pf-text-muted transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          {/* Nome */}
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-pf-text-secondary"
            >
              Nome
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted transition-colors focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="Mario Rossi"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-pf-text-secondary"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted transition-colors focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="mario@esempio.it"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-pf-text-secondary"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted transition-colors focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="Minimo 8 caratteri"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          {/* Ruolo */}
          <div>
            <label
              htmlFor="role"
              className="mb-1.5 block text-sm font-medium text-pf-text-secondary"
            >
              Ruolo
            </label>
            <select
              id="role"
              {...register('role')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary transition-colors focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.role && (
              <p className="mt-1 text-xs text-red-400">{errors.role.message}</p>
            )}
          </div>

          {/* Dipartimento */}
          <div>
            <label
              htmlFor="department"
              className="mb-1.5 block text-sm font-medium text-pf-text-secondary"
            >
              Dipartimento
              <span className="ml-1 text-pf-text-muted">(opzionale)</span>
            </label>
            <input
              id="department"
              type="text"
              {...register('department')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted transition-colors focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="es. Acquisti, IT, Marketing"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creazione...' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
