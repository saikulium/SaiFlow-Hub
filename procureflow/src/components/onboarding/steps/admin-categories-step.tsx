'use client'

import { useState } from 'react'
import { Tags, Plus, X } from 'lucide-react'

const DEFAULT_CATEGORIES = [
  'IT & Tecnologia',
  'Ufficio & Cancelleria',
  'Marketing & Comunicazione',
  'Produzione & Materiali',
  'Servizi Professionali',
  'Altro',
]

interface AdminCategoriesStepProps {
  readonly initialCategories: string[]
  readonly onSave: (categories: string[]) => void
}

export function AdminCategoriesStep({ initialCategories, onSave }: AdminCategoriesStepProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialCategories.length > 0 ? initialCategories : DEFAULT_CATEGORIES)
  )
  const [custom, setCustom] = useState('')

  function toggle(cat: string) {
    const next = new Set(selected)
    if (next.has(cat)) {
      next.delete(cat)
    } else {
      next.add(cat)
    }
    setSelected(next)
    onSave(Array.from(next))
  }

  function addCustom() {
    if (!custom.trim() || selected.has(custom.trim())) return
    const next = new Set(selected)
    next.add(custom.trim())
    setSelected(next)
    onSave(Array.from(next))
    setCustom('')
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Tags className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Categorie Merceologiche
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Seleziona le categorie che usi per classificare gli acquisti
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEFAULT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              selected.has(cat)
                ? 'border-pf-accent bg-pf-accent-subtle text-pf-accent'
                : 'border-pf-border text-pf-text-muted hover:border-pf-border-hover'
            }`}
          >
            {cat}
          </button>
        ))}
        {Array.from(selected)
          .filter((c) => !DEFAULT_CATEGORIES.includes(c))
          .map((cat) => (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className="flex items-center gap-1 rounded-full border border-pf-accent bg-pf-accent-subtle px-4 py-2 text-sm text-pf-accent"
            >
              {cat}
              <X className="h-3 w-3" />
            </button>
          ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="Aggiungi categoria personalizzata"
          className="flex-1 rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
        />
        <button
          onClick={addCustom}
          disabled={!custom.trim()}
          className="rounded-lg border border-pf-border p-2 text-pf-text-secondary transition-colors hover:border-pf-accent hover:text-pf-accent disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
