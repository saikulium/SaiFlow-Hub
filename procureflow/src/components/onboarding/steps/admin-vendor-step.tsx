'use client'

import { useState } from 'react'
import { Store, Plus, Check } from 'lucide-react'
import { useCreateVendor } from '@/modules/core/vendors'

interface AdminVendorStepProps {
  readonly existingVendorCount: number
  readonly onVendorCreated: () => void
}

interface VendorForm {
  name: string
  email: string
  category: string
}

const EMPTY_FORM: VendorForm = { name: '', email: '', category: '' }

export function AdminVendorStep({
  existingVendorCount,
  onVendorCreated,
}: AdminVendorStepProps) {
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM)
  const [created, setCreated] = useState<string[]>([])
  const createVendor = useCreateVendor()

  const hasVendors = existingVendorCount > 0 || created.length > 0

  async function handleAdd() {
    if (!form.name.trim()) return
    try {
      const code = `VND-${Date.now().toString(36).toUpperCase()}`
      await createVendor.mutateAsync({
        name: form.name,
        code,
        email: form.email || undefined,
        category: form.category ? [form.category] : [],
      })
      setCreated((prev) => [...prev, form.name])
      setForm(EMPTY_FORM)
      onVendorCreated()
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Store className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Primo Fornitore
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          {existingVendorCount > 0
            ? `Hai già ${existingVendorCount} fornitori. Vuoi aggiungerne altri?`
            : 'Aggiungi almeno un fornitore per iniziare'}
        </p>
      </div>

      {created.length > 0 && (
        <div className="space-y-2">
          {created.map((name) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded-lg bg-pf-bg-tertiary px-3 py-2 text-sm"
            >
              <Check className="h-4 w-4 text-pf-success" />
              <span className="text-pf-text-primary">{name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nome fornitore *"
          className="focus:ring-pf-accent/40 w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2"
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email (opzionale)"
          className="focus:ring-pf-accent/40 w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2"
        />
        <input
          type="text"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Categoria (es: IT, Ufficio)"
          className="focus:ring-pf-accent/40 w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2"
        />
        <button
          onClick={handleAdd}
          disabled={!form.name.trim() || createVendor.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-pf-border py-2.5 text-sm font-medium text-pf-text-secondary transition-colors hover:border-pf-accent hover:text-pf-accent disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {createVendor.isPending ? 'Creazione...' : 'Aggiungi fornitore'}
        </button>
        {createVendor.isError && (
          <p className="text-xs text-pf-danger">
            Errore nella creazione del fornitore
          </p>
        )}
      </div>

      {!hasVendors && (
        <p className="text-center text-xs text-pf-text-muted">
          Serve almeno un fornitore per continuare
        </p>
      )}
    </div>
  )
}
