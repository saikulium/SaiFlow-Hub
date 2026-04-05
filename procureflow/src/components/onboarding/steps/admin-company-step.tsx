'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'

interface AdminCompanyStepProps {
  readonly initialName: string
  readonly onSave: (companyName: string) => void
}

export function AdminCompanyStep({ initialName, onSave }: AdminCompanyStepProps) {
  const [name, setName] = useState(initialName)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Building2 className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Info Azienda
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Come si chiama la tua azienda?
        </p>
      </div>

      <div>
        <label htmlFor="company-name" className="block text-sm font-medium text-pf-text-secondary">
          Nome azienda
        </label>
        <input
          id="company-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            onSave(e.target.value)
          }}
          placeholder="Es: Acme S.r.l."
          className="mt-1 w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
        />
      </div>
    </div>
  )
}
