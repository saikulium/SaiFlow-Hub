'use client'

import { useCallback, useState } from 'react'
import { Mail, Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface EmailImportDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

interface ImportResult {
  readonly intent: string
  readonly confidence: number
  readonly summary: string
  readonly vendor: string | null
  readonly matched_request: string | null
  readonly action_taken: boolean
  readonly needs_review?: boolean
  readonly actions?: readonly string[]
  readonly result?: {
    readonly action: string
    readonly request_code: string
  }
}

const INTENT_LABELS: Record<string, string> = {
  CONFERMA_ORDINE: 'Conferma ordine',
  RITARDO_CONSEGNA: 'Ritardo consegna',
  VARIAZIONE_PREZZO: 'Variazione prezzo',
  RICHIESTA_INFO: 'Richiesta informazioni',
  FATTURA_ALLEGATA: 'Fattura allegata',
  ORDINE_CLIENTE: 'Ordine cliente',
  UPDATE_EXISTING: 'Aggiornamento richiesta',
  NOTIFICATION: 'Notifica inviata',
  INFO_ONLY: 'Solo informativa',
  ALTRO: 'Altro',
}

const ACTION_LABELS: Record<string, string> = {
  search_requests: 'Cercato nelle richieste',
  get_request_detail: 'Verificato dettaglio richiesta',
  search_vendors: 'Cercato fornitori',
  create_notification: 'Notifica inviata',
  create_timeline_event: 'Timeline aggiornata',
  create_commessa: 'Commessa creata',
  search_commesse: 'Cercato nelle commesse',
}

export function EmailImportDialog({
  open,
  onOpenChange,
}: EmailImportDialogProps) {
  const [emailFrom, setEmailFrom] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onOpenChange(false)
      setResult(null)
      setEmailFrom('')
      setEmailSubject('')
      setEmailBody('')
    }
  }, [isSubmitting, onOpenChange])

  const handleSubmit = useCallback(async () => {
    if (!emailFrom.trim() || !emailSubject.trim() || !emailBody.trim()) {
      toast.error('Compila tutti i campi')
      return
    }

    setIsSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/email-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_from: emailFrom.trim(),
          email_subject: emailSubject.trim(),
          email_body: emailBody.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error?.message ?? "Errore durante l'importazione")
        return
      }

      setResult(data.data)

      if (data.data.action_taken) {
        const actionCount = data.data.actions?.length ?? 0
        toast.success('Email processata con successo', {
          description: `${actionCount} ${actionCount === 1 ? 'azione eseguita' : 'azioni eseguite'}`,
        })
      } else if (data.data.needs_review) {
        toast.info('Email da verificare', {
          description:
            data.data.summary?.slice(0, 100) ?? 'Rivedi i risultati.',
        })
      } else {
        toast.info('Email analizzata', {
          description: 'Nessuna azione necessaria.',
        })
      }
    } catch {
      toast.error('Errore di rete')
    } finally {
      setIsSubmitting(false)
    }
  }, [emailFrom, emailSubject, emailBody])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose()
    },
    [handleClose],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pf-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-pf-accent/10 flex h-9 w-9 items-center justify-center rounded-full">
              <Mail className="h-4.5 w-4.5 text-pf-accent" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-pf-text-primary">
                Importa da Email
              </h3>
              <p className="text-xs text-pf-text-muted">
                Incolla i dati dell&apos;email per classificarla con AI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-button p-1.5 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {!result ? (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-pf-text-secondary">
                  Mittente
                </label>
                <input
                  type="text"
                  value={emailFrom}
                  onChange={(e) => setEmailFrom(e.target.value)}
                  placeholder="fornitore@esempio.it"
                  disabled={isSubmitting}
                  className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-pf-text-secondary">
                  Oggetto
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Conferma ordine PR-2025-00042"
                  disabled={isSubmitting}
                  className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-pf-text-secondary">
                  Corpo Email
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Incolla il testo dell'email qui..."
                  rows={6}
                  disabled={isSubmitting}
                  className="w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {/* Result */}
              <div className="bg-pf-bg-primary/40 flex items-start gap-3 rounded-card border border-pf-border p-4">
                {result.action_taken ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-pf-text-primary">
                    {result.action_taken
                      ? 'Email processata con successo'
                      : result.needs_review
                        ? 'Da verificare manualmente'
                        : 'Nessuna azione necessaria'}
                  </p>
                  <p className="mt-1 text-xs text-pf-text-secondary">
                    {result.summary}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-pf-bg-primary/40 rounded-button border border-pf-border px-3 py-2">
                  <p className="text-xs text-pf-text-muted">Intent</p>
                  <p className="text-sm font-medium text-pf-text-primary">
                    {INTENT_LABELS[result.intent] ?? result.intent}
                  </p>
                </div>
                <div className="bg-pf-bg-primary/40 rounded-button border border-pf-border px-3 py-2">
                  <p className="text-xs text-pf-text-muted">Confidence</p>
                  <p className="text-sm font-medium text-pf-text-primary">
                    {Math.round(result.confidence * 100)}%
                  </p>
                </div>
                {result.vendor && (
                  <div className="bg-pf-bg-primary/40 rounded-button border border-pf-border px-3 py-2">
                    <p className="text-xs text-pf-text-muted">Fornitore</p>
                    <p className="text-sm font-medium text-pf-text-primary">
                      {result.vendor}
                    </p>
                  </div>
                )}
                {result.matched_request && (
                  <div className="bg-pf-bg-primary/40 rounded-button border border-pf-border px-3 py-2">
                    <p className="text-xs text-pf-text-muted">Richiesta</p>
                    <p className="text-sm font-medium text-pf-accent">
                      {result.matched_request}
                    </p>
                  </div>
                )}
              </div>

              {/* Agent actions taken */}
              {result.actions && result.actions.length > 0 && (
                <div className="bg-pf-bg-primary/40 rounded-button border border-pf-border px-3 py-2">
                  <p className="mb-1 text-xs text-pf-text-muted">
                    Azioni eseguite
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(result.actions)).map((action) => (
                      <span
                        key={action}
                        className="bg-pf-accent/10 rounded-full px-2 py-0.5 text-xs text-pf-accent"
                      >
                        {ACTION_LABELS[action] ?? action}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-pf-border px-6 py-4">
          {!result ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:border-pf-border-hover hover:text-pf-text-primary"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  !emailFrom.trim() ||
                  !emailSubject.trim() ||
                  !emailBody.trim()
                }
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisi AI...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Importa
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
            >
              Chiudi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
