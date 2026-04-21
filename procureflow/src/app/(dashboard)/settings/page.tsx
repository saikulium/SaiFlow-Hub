'use client'

import { useSession } from 'next-auth/react'
import { RotateCcw } from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { useCompleteOnboarding } from '@/hooks/use-onboarding'

export default function SettingsPage() {
  const { data: session } = useSession()
  const completeOnboarding = useCompleteOnboarding()
  const isAdmin = session?.user?.role === 'ADMIN'

  async function handleRelaunchWizard() {
    await completeOnboarding.mutateAsync({ completed: false })
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Impostazioni
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Configura il tuo account e le preferenze
          </p>
        </div>

        {isAdmin && (
          <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
            <h2 className="font-display text-lg font-semibold text-pf-text-primary">
              Onboarding
            </h2>
            <p className="mt-1 text-sm text-pf-text-secondary">
              Rilancia il wizard di configurazione iniziale
            </p>
            <button
              onClick={handleRelaunchWizard}
              disabled={completeOnboarding.isPending}
              className="mt-4 flex items-center gap-2 rounded-lg border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {completeOnboarding.isPending
                ? 'Riavvio...'
                : 'Rilancia wizard'}
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
