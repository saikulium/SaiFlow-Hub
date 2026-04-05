'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react'
import { MfaSetupDialog } from '@/components/auth/mfa-setup-dialog'
import { MfaDisableDialog } from '@/components/auth/mfa-disable-dialog'

export default function SecuritySettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const [setupOpen, setSetupOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  const user = session?.user
  const mfaEnabled = !(user?.mfaSetupRequired ?? true)

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  function handleMfaComplete() {
    // Hard reload to force a fresh session/JWT from server
    // updateSession() in NextAuth v5 beta may not trigger jwt callback properly
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-pf-text-primary">
          Sicurezza
        </h1>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Gestisci le impostazioni di sicurezza del tuo account
        </p>
      </div>

      {/* MFA Section */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {mfaEnabled ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 text-green-400" />
            ) : (
              <ShieldOff className="mt-0.5 h-5 w-5 text-pf-text-muted" />
            )}
            <div>
              <h3 className="font-medium text-pf-text-primary">
                Autenticazione a due fattori (MFA)
              </h3>
              <p className="mt-1 text-sm text-pf-text-secondary">
                {mfaEnabled
                  ? 'La verifica in due fattori e attiva sul tuo account.'
                  : 'Aggiungi un livello di sicurezza extra al tuo account.'}
              </p>
              {mfaEnabled && (
                <span className="mt-2 inline-block rounded-badge bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                  Attiva
                </span>
              )}
            </div>
          </div>

          {mfaEnabled ? (
            <button
              onClick={() => setDisableOpen(true)}
              className="rounded-button border border-red-500/30 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
            >
              Disattiva
            </button>
          ) : (
            <button
              onClick={() => setSetupOpen(true)}
              className="rounded-button bg-pf-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
            >
              Attiva MFA
            </button>
          )}
        </div>

        {isAdminOrManager && !mfaEnabled && (
          <div className="mt-4 flex items-start gap-2 rounded-badge bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-400">
              Come {user?.role === 'ADMIN' ? 'amministratore' : 'manager'}, la
              MFA e obbligatoria per il tuo account. Attivala per continuare a
              utilizzare tutte le funzionalita.
            </p>
          </div>
        )}
      </div>

      <MfaSetupDialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onComplete={handleMfaComplete}
      />
      <MfaDisableDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onComplete={handleMfaComplete}
      />
    </div>
  )
}
