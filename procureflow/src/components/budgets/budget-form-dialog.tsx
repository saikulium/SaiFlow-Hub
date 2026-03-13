'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Plus } from 'lucide-react'
import { createBudgetSchema, type CreateBudgetInput } from '@/lib/validations/budget'
import { useCreateBudget } from '@/hooks/use-budgets'
import { BUDGET_PERIOD_LABELS, BUDGET_ENFORCEMENT_LABELS } from '@/lib/constants/budget'

export function BudgetFormDialog() {
  const [open, setOpen] = useState(false)
  const createBudget = useCreateBudget()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: {
      alert_threshold_percent: 80,
      enforcement_mode: 'SOFT',
    },
  })

  const onSubmit = async (data: CreateBudgetInput) => {
    await createBudget.mutateAsync(data)
    setOpen(false)
    reset()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
      >
        <Plus className="h-4 w-4" />
        Nuovo Budget
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-lg rounded-card border border-pf-border bg-pf-bg-secondary p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Nuovo Budget
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-pf-text-secondary hover:bg-pf-bg-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
                Centro di Costo *
              </label>
              <input
                {...register('cost_center')}
                placeholder="es. CC-IT"
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
              {errors.cost_center && (
                <p className="mt-1 text-xs text-red-400">{errors.cost_center.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
                Dipartimento
              </label>
              <input
                {...register('department')}
                placeholder="es. IT"
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
                Tipo Periodo *
              </label>
              <select
                {...register('period_type')}
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              >
                {Object.entries(BUDGET_PERIOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
                Data Inizio *
              </label>
              <input
                type="date"
                {...register('period_start')}
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              />
              {errors.period_start && (
                <p className="mt-1 text-xs text-red-400">{errors.period_start.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
                Data Fine *
              </label>
              <input
                type="date"
                {...register('period_end')}
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              />
              {errors.period_end && (
                <p className="mt-1 text-xs text-red-400">{errors.period_end.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
                Plafond (EUR) *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('allocated_amount', { valueAsNumber: true })}
                placeholder="50000"
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
              />
              {errors.allocated_amount && (
                <p className="mt-1 text-xs text-red-400">{errors.allocated_amount.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
                Soglia Allerta %
              </label>
              <input
                type="number"
                {...register('alert_threshold_percent', { valueAsNumber: true })}
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
                Enforcement
              </label>
              <select
                {...register('enforcement_mode')}
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none"
              >
                {Object.entries(BUDGET_ENFORCEMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
              Note
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-pf-border px-4 py-2 text-sm text-pf-text-secondary hover:bg-pf-bg-hover"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
            >
              {isSubmitting ? 'Creazione...' : 'Crea Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
