'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminConfig, useUpdateAdminConfig } from '@/hooks/use-admin-config'

function SkeletonBlock() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-48 animate-pulse rounded bg-pf-border" />
      <div className="h-10 w-full animate-pulse rounded-button bg-pf-border" />
      <div className="h-10 w-full animate-pulse rounded-button bg-pf-border" />
    </div>
  )
}

export function ApprovalsTab() {
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateAdminConfig()

  const [autoApproveMax, setAutoApproveMax] = useState(0)
  const [managerApproveMax, setManagerApproveMax] = useState(0)

  useEffect(() => {
    if (config?.approval_rules) {
      setAutoApproveMax(config.approval_rules.autoApproveMax)
      setManagerApproveMax(config.approval_rules.managerApproveMax)
    }
  }, [config])

  const handleSave = () => {
    if (autoApproveMax < 0 || managerApproveMax < 0) {
      toast.error('I valori devono essere positivi')
      return
    }
    if (autoApproveMax >= managerApproveMax) {
      toast.error(
        'La soglia auto-approvazione deve essere inferiore a quella manager',
      )
      return
    }

    updateConfig.mutate(
      {
        approval_rules: {
          autoApproveMax,
          managerApproveMax,
        },
      },
      {
        onSuccess: () => toast.success('Regole di approvazione salvate'),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <SkeletonBlock />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Soglie di Approvazione
        </h2>
        <p className="mb-6 text-xs text-pf-text-secondary">
          Definisci le soglie di importo per l&apos;approvazione automatica e per
          l&apos;approvazione manager. Importi superiori alla soglia manager
          richiedono approvazione del direttore/CFO.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="autoApproveMax"
              className="mb-1.5 block text-sm text-pf-text-secondary"
            >
              Soglia Auto-approvazione (EUR)
            </label>
            <p className="mb-1 text-xs text-pf-text-muted">
              Richieste sotto questo importo vengono approvate automaticamente.
            </p>
            <input
              id="autoApproveMax"
              type="number"
              min="0"
              step="100"
              value={autoApproveMax}
              onChange={(e) => setAutoApproveMax(Number(e.target.value))}
              className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
            />
          </div>

          <div>
            <label
              htmlFor="managerApproveMax"
              className="mb-1.5 block text-sm text-pf-text-secondary"
            >
              Soglia Approvazione Manager (EUR)
            </label>
            <p className="mb-1 text-xs text-pf-text-muted">
              Richieste tra la soglia auto e questa richiedono approvazione del
              manager. Oltre questa soglia serve direttore/CFO.
            </p>
            <input
              id="managerApproveMax"
              type="number"
              min="0"
              step="100"
              value={managerApproveMax}
              onChange={(e) => setManagerApproveMax(Number(e.target.value))}
              className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
            />
          </div>
        </div>

        {/* Visual summary */}
        <div className="mt-6 rounded-button border border-pf-border bg-pf-bg-primary p-4">
          <p className="mb-2 text-xs font-medium text-pf-text-secondary">
            Riepilogo Regole
          </p>
          <ul className="space-y-1 text-xs text-pf-text-secondary">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
              0 - {autoApproveMax.toLocaleString('it-IT')} EUR → Auto-approvazione
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              {autoApproveMax.toLocaleString('it-IT')} -{' '}
              {managerApproveMax.toLocaleString('it-IT')} EUR → Manager
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
              &gt; {managerApproveMax.toLocaleString('it-IT')} EUR →
              Direttore/CFO
            </li>
          </ul>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateConfig.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salva Regole
        </button>
      </div>
    </div>
  )
}
