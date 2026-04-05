'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { WizardShell } from './wizard-shell'
import { WelcomeStep } from './steps/welcome-step'
import { HowItWorksStep } from './steps/how-it-works-step'
import { GetStartedStep } from './steps/get-started-step'
import { AdminCompanyStep } from './steps/admin-company-step'
import { AdminVendorStep } from './steps/admin-vendor-step'
import { AdminTeamStep } from './steps/admin-team-step'
import { AdminCategoriesStep } from './steps/admin-categories-step'
import { AdminApprovalsStep } from './steps/admin-approvals-step'
import {
  useCompleteOnboarding,
  useCompanySetup,
  useUpdateCompanySetup,
} from '@/hooks/use-onboarding'
import type { ApprovalRules } from '@/types/onboarding'
import type { CompanySetupInput } from '@/lib/validations/onboarding'
import { REQUIRED_ADMIN_STEPS } from '@/types/onboarding'

interface OnboardingWizardProps {
  /** If provided, start admin wizard at this step index (for banner "Completa ora") */
  readonly startAtStep?: number
}

export function OnboardingWizard({ startAtStep }: OnboardingWizardProps) {
  const { data: session } = useSession()
  const completeOnboarding = useCompleteOnboarding()
  const companySetup = useCompanySetup()
  const updateCompany = useUpdateCompanySetup()

  const isAdmin = session?.user?.role === 'ADMIN'
  const showWizard = session?.user?.onboardingCompleted === false

  const [step, setStep] = useState(startAtStep ?? 0)
  const [vendorAdded, setVendorAdded] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [approvalRules, setApprovalRules] = useState<ApprovalRules | null>(
    null,
  )

  const totalSteps = isAdmin ? 5 : 3

  const handleComplete = useCallback(
    async (completedSteps?: string[]) => {
      // Save company setup if admin
      if (isAdmin) {
        const payload: CompanySetupInput = {
          ...(companyName ? { companyName } : {}),
          ...(categories.length > 0 ? { categories } : {}),
          ...(approvalRules ? { approvalRules } : {}),
        }
        if (companyName || categories.length > 0 || approvalRules) {
          await updateCompany.mutateAsync(payload)
        }
      }

      await completeOnboarding.mutateAsync({
        completed: true,
        completedSteps,
      })
    },
    [
      isAdmin,
      companyName,
      categories,
      approvalRules,
      updateCompany,
      completeOnboarding,
    ],
  )

  const handleNext = useCallback(async () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1)
      return
    }

    // Last step — complete
    if (isAdmin) {
      const steps: string[] = [...REQUIRED_ADMIN_STEPS]
      if (categories.length > 0) steps.push('categories')
      if (approvalRules) steps.push('approvals')
      await handleComplete(steps)
    } else {
      await handleComplete()
    }
  }, [step, totalSteps, isAdmin, categories, approvalRules, handleComplete])

  const handleSkip = useCallback(async () => {
    if (isAdmin && step >= 3) {
      // Skipping from optional steps — save mandatory as complete
      await handleComplete([...REQUIRED_ADMIN_STEPS])
    } else {
      await handleComplete()
    }
  }, [isAdmin, step, handleComplete])

  const handleBack = useCallback(() => {
    if (step > 0) setStep((s) => s - 1)
  }, [step])

  if (!showWizard || !session?.user) return null

  function getNextLabel(): string {
    if (!isAdmin) return step === totalSteps - 1 ? 'Inizia ad esplorare' : 'Avanti'
    if (step === 2) return 'Completa setup'
    if (step >= 3) return step === 4 ? 'Salva e completa' : 'Avanti'
    return 'Avanti'
  }

  function canProceed(): boolean {
    if (!isAdmin) return true
    if (step === 1)
      return vendorAdded || (companySetup.data?.vendorCount ?? 0) > 0
    return true
  }

  return (
    <WizardShell
      currentStep={step}
      totalSteps={totalSteps}
      onNext={canProceed() ? handleNext : () => {}}
      onBack={handleBack}
      onSkip={handleSkip}
      nextLabel={getNextLabel()}
      showBack={step > 0}
      showSkip
      optionalFrom={isAdmin ? 3 : undefined}
    >
      {/* User wizard steps */}
      {!isAdmin && step === 0 && (
        <WelcomeStep
          userName={session.user.name ?? ''}
          userRole={session.user.role ?? 'VIEWER'}
        />
      )}
      {!isAdmin && step === 1 && <HowItWorksStep />}
      {!isAdmin && step === 2 && <GetStartedStep />}

      {/* Admin wizard steps */}
      {isAdmin && step === 0 && (
        <AdminCompanyStep
          initialName={companySetup.data?.companyName ?? 'ProcureFlow'}
          onSave={setCompanyName}
        />
      )}
      {isAdmin && step === 1 && (
        <AdminVendorStep
          existingVendorCount={companySetup.data?.vendorCount ?? 0}
          onVendorCreated={() => setVendorAdded(true)}
        />
      )}
      {isAdmin && step === 2 && <AdminTeamStep />}
      {isAdmin && step === 3 && (
        <AdminCategoriesStep
          initialCategories={companySetup.data?.categories ?? []}
          onSave={setCategories}
        />
      )}
      {isAdmin && step === 4 && (
        <AdminApprovalsStep
          initialRules={companySetup.data?.approvalRules ?? null}
          onSave={setApprovalRules}
        />
      )}
    </WizardShell>
  )
}
