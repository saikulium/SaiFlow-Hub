'use client'

import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-pf-danger" />
        </div>
        <h2 className="font-display text-xl font-bold text-pf-text-primary">
          Si è verificato un errore
        </h2>
        <p className="mt-2 max-w-md text-sm text-pf-text-secondary">
          {error.message || 'Impossibile caricare la dashboard. Riprova tra qualche istante.'}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
        >
          Riprova
        </button>
      </div>
    </div>
  )
}
