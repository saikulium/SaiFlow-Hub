'use client'

import { useState } from 'react'
import {
  Plus,
  Warehouse as WarehouseIcon,
  MapPin,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { useWarehouses, useCreateWarehouse } from '../hooks/use-stock'
import { cn } from '@/lib/utils'

function SkeletonCard() {
  return (
    <div className="bg-pf-bg-secondary/60 rounded-card border border-pf-border p-5">
      <div className="skeleton-shimmer mb-3 h-5 w-40 rounded" />
      <div className="skeleton-shimmer mb-2 h-4 w-60 rounded" />
      <div className="skeleton-shimmer h-4 w-24 rounded" />
    </div>
  )
}

interface WarehouseFormState {
  code: string
  name: string
  address: string
}

const INITIAL_FORM: WarehouseFormState = {
  code: '',
  name: '',
  address: '',
}

function WarehouseFormDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = useState<WarehouseFormState>(INITIAL_FORM)
  const createMutation = useCreateWarehouse()

  const inputClassName =
    'w-full rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/60 focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent'
  const labelClassName = 'block text-xs font-medium text-pf-text-secondary mb-1'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code || !form.name) return
    createMutation.mutate(
      { code: form.code, name: form.name, address: form.address || undefined },
      {
        onSuccess: () => {
          setForm(INITIAL_FORM)
          onOpenChange(false)
        },
      },
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative mx-4 w-full max-w-md rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        <div className="border-b border-pf-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Nuovo Magazzino
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div>
            <label className={labelClassName}>Codice *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={inputClassName}
              placeholder="MAG-XXX"
            />
          </div>
          <div>
            <label className={labelClassName}>Nome *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClassName}
              placeholder="Nome magazzino"
            />
          </div>
          <div>
            <label className={labelClassName}>Indirizzo</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputClassName}
              placeholder="Via, Citta"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !form.code || !form.name}
              className={cn(
                'rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover',
                (createMutation.isPending || !form.code || !form.name) &&
                  'cursor-not-allowed opacity-60',
              )}
            >
              {createMutation.isPending ? 'Creazione...' : 'Crea Magazzino'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function WarehousesPageContent() {
  const [formOpen, setFormOpen] = useState(false)
  const { data: warehouses, isLoading } = useWarehouses()

  const items = warehouses ?? []

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-pf-text-primary">
              Magazzini
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              {isLoading
                ? 'Caricamento...'
                : `${items.length} magazzini configurati`}
            </p>
          </div>

          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuovo Magazzino
          </button>
        </div>

        {/* Cards */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="bg-pf-bg-secondary/60 rounded-card border border-pf-border px-4 py-16 text-center backdrop-blur-xl">
            <WarehouseIcon className="mx-auto mb-3 h-10 w-10 text-pf-text-muted" />
            <p className="text-sm font-medium text-pf-text-secondary">
              Nessun magazzino configurato
            </p>
            <p className="mt-1 text-xs text-pf-text-muted">
              Crea il primo magazzino per iniziare.
            </p>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((wh) => (
              <div
                key={wh.id}
                className="bg-pf-bg-secondary/60 rounded-card border border-pf-border p-5 backdrop-blur-xl transition-colors hover:bg-pf-bg-hover"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs text-pf-text-secondary">
                      {wh.code}
                    </span>
                    <h3 className="mt-1 text-sm font-semibold text-pf-text-primary">
                      {wh.name}
                    </h3>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-xs font-medium',
                      wh.isActive
                        ? 'bg-green-400/10 text-green-400'
                        : 'bg-zinc-400/10 text-zinc-400',
                    )}
                  >
                    {wh.isActive ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {wh.isActive ? 'Attivo' : 'Inattivo'}
                  </span>
                </div>

                {wh.address && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-pf-text-secondary">
                    <MapPin className="h-3.5 w-3.5" />
                    {wh.address}
                  </div>
                )}

                <div className="mt-3 border-t border-pf-border pt-3">
                  <p className="text-xs text-pf-text-secondary">
                    {wh.zonesCount} {wh.zonesCount === 1 ? 'zona' : 'zone'}
                  </p>
                  {wh.zones.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {wh.zones.map((z) => (
                        <span
                          key={z.id}
                          className="rounded-badge bg-pf-accent-subtle px-2 py-0.5 text-xs text-pf-accent"
                        >
                          {z.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <WarehouseFormDialog open={formOpen} onOpenChange={setFormOpen} />
      </div>
    </PageTransition>
  )
}
