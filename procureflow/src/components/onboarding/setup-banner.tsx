'use client'

import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Info, X } from 'lucide-react'
import {
  useOnboardingState,
  useCompleteOnboarding,
} from '@/hooks/use-onboarding'
import { OPTIONAL_ADMIN_STEPS } from '@/types/onboarding'
import type { OnboardingData } from '@/types/onboarding'

interface SetupBannerProps {
  readonly onCompleteSetup?: () => void
}

const STEP_LABELS: Record<string, string> = {
  categories: 'Categorie',
  approvals: 'Regole approvazione',
}

export function SetupBanner({ onCompleteSetup }: SetupBannerProps) {
  const { data: session } = useSession()
  const { data: state } = useOnboardingState()
  const completeOnboarding = useCompleteOnboarding()
  const [dismissed, setDismissed] = useState(false)

  const isAdmin = session?.user?.role === 'ADMIN'
  const onboardingData = state?.data as OnboardingData | null

  const completedSteps = useMemo(
    () => onboardingData?.completedSteps ?? [],
    [onboardingData?.completedSteps],
  )

  const missingOptional = useMemo(
    () => OPTIONAL_ADMIN_STEPS.filter((s) => !completedSteps.includes(s)),
    [completedSteps],
  )

  const isDismissedToday = useMemo(() => {
    if (!onboardingData?.dismissedUntil) return false
    return new Date(onboardingData.dismissedUntil) > new Date()
  }, [onboardingData?.dismissedUntil])

  if (
    !isAdmin ||
    !state?.isComplete ||
    missingOptional.length === 0 ||
    dismissed ||
    isDismissedToday
  ) {
    return null
  }

  const missingLabels = missingOptional
    .map((s) => STEP_LABELS[s] ?? s)
    .join(' e ')

  async function handleDismiss() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    await completeOnboarding.mutateAsync({
      completed: true,
      completedSteps: [...completedSteps],
      dismissedUntil: tomorrow.toISOString(),
    })
    setDismissed(true)
  }

  return (
    <div className="border-pf-accent/30 mx-4 mb-4 flex items-center gap-3 rounded-xl border bg-pf-accent-subtle px-4 py-3">
      <Info className="h-5 w-5 shrink-0 text-pf-accent" />
      <p className="flex-1 text-sm text-pf-text-secondary">
        Completa la configurazione —{' '}
        <span className="font-medium text-pf-text-primary">
          {missingLabels}
        </span>{' '}
        non ancora configurate
      </p>
      <button
        onClick={onCompleteSetup}
        className="shrink-0 rounded-lg bg-pf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-pf-accent-hover"
      >
        Completa ora
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
