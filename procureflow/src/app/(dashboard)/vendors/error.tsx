'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-8 text-center">
        <h2 className="font-display text-xl font-bold text-pf-text-primary">
          Si è verificato un errore
        </h2>
        <p className="mt-2 text-sm text-pf-text-secondary">
          {error.message || 'Qualcosa è andato storto. Riprova.'}
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
