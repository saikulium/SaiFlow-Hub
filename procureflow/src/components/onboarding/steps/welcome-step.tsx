'use client'

import { Sparkles } from 'lucide-react'

interface WelcomeStepProps {
  readonly userName: string
  readonly userRole: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Amministratore',
  MANAGER: 'Manager',
  REQUESTER: 'Richiedente',
  VIEWER: 'Osservatore',
}

export function WelcomeStep({ userName, userRole }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-pf-accent-subtle">
        <Sparkles className="h-10 w-10 text-pf-accent" />
      </div>
      <h2 className="mt-6 font-display text-2xl font-bold text-pf-text-primary">
        Benvenuto in ProcureFlow
      </h2>
      <p className="mt-2 text-lg text-pf-text-secondary">
        Ciao <span className="font-semibold text-pf-text-primary">{userName}</span>
      </p>
      <p className="mt-1 text-sm text-pf-text-muted">
        Il tuo ruolo: {ROLE_LABELS[userRole] ?? userRole}
      </p>
      <p className="mt-6 max-w-md text-pf-text-secondary">
        Il tuo hub centralizzato per il procurement. Gestisci richieste di acquisto,
        monitora consegne e collabora con il team — tutto in un unico posto.
      </p>
    </div>
  )
}
