'use client'

import { useState } from 'react'
import { Shield, CheckCircle, UserCheck, Users } from 'lucide-react'
import type { ApprovalRules } from '@/types/onboarding'

interface AdminApprovalsStepProps {
  readonly initialRules: ApprovalRules | null
  readonly onSave: (rules: ApprovalRules) => void
}

export function AdminApprovalsStep({ initialRules, onSave }: AdminApprovalsStepProps) {
  const [rules, setRules] = useState<ApprovalRules>(
    initialRules ?? { autoApproveThreshold: 500, managerThreshold: 5000 }
  )

  function updateField(field: keyof ApprovalRules, value: string) {
    const num = Number(value) || 0
    const next = { ...rules, [field]: num }
    setRules(next)
    onSave(next)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Shield className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Regole di Approvazione
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Configura le soglie per l&apos;approvazione automatica
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-pf-text-secondary">
            Soglia auto-approvazione (EUR)
          </label>
          <p className="mb-2 text-xs text-pf-text-muted">
            Richieste sotto questo importo vengono approvate automaticamente
          </p>
          <input
            type="number"
            value={rules.autoApproveThreshold}
            onChange={(e) => updateField('autoApproveThreshold', e.target.value)}
            min={0}
            step={100}
            className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-pf-text-secondary">
            Soglia approvazione manager (EUR)
          </label>
          <p className="mb-2 text-xs text-pf-text-muted">
            Richieste sopra questo importo richiedono approvazione del manager
          </p>
          <input
            type="number"
            value={rules.managerThreshold}
            onChange={(e) => updateField('managerThreshold', e.target.value)}
            min={0}
            step={500}
            className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
          />
        </div>
      </div>

      {/* Visual preview */}
      <div className="rounded-xl border border-pf-border bg-pf-bg-tertiary p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-pf-text-muted">
          Anteprima catena approvativa
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm text-pf-text-primary">
                Sotto {rules.autoApproveThreshold.toLocaleString('it-IT')}€
              </p>
              <p className="text-xs text-pf-text-muted">Approvazione automatica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-sm text-pf-text-primary">
                {rules.autoApproveThreshold.toLocaleString('it-IT')}€ — {rules.managerThreshold.toLocaleString('it-IT')}€
              </p>
              <p className="text-xs text-pf-text-muted">Richiede approvazione manager</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-sm text-pf-text-primary">
                Oltre {rules.managerThreshold.toLocaleString('it-IT')}€
              </p>
              <p className="text-xs text-pf-text-muted">Richiede approvazione direzione</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
