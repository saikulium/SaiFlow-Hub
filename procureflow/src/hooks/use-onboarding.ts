'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { OnboardingState, TeamInviteResult } from '@/types/onboarding'
import type {
  CompleteOnboardingInput,
  TeamInviteInput,
  CompanySetupInput,
} from '@/lib/validations/onboarding'

const ONBOARDING_KEY = ['onboarding'] as const
const COMPANY_KEY = ['onboarding', 'company'] as const

export function useOnboardingState() {
  return useQuery({
    queryKey: ONBOARDING_KEY,
    queryFn: async (): Promise<OnboardingState> => {
      const res = await fetch('/api/onboarding')
      if (!res.ok) throw new Error('Errore caricamento onboarding')
      const json = await res.json()
      return json.data
    },
  })
}

export function useCompanySetup() {
  return useQuery({
    queryKey: COMPANY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/onboarding/company')
      if (!res.ok) throw new Error('Errore caricamento setup azienda')
      const json = await res.json()
      return json.data as {
        companyName: string
        categories: string[]
        approvalRules: {
          autoApproveThreshold: number
          managerThreshold: number
        } | null
        vendorCount: number
      }
    },
  })
}

export function useCompleteOnboarding() {
  const qc = useQueryClient()
  const { update } = useSession()

  return useMutation({
    mutationFn: async (input: CompleteOnboardingInput) => {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Errore aggiornamento onboarding')
      return res.json()
    },
    onSuccess: async () => {
      await update() // refresh JWT with new onboardingCompleted value
      qc.invalidateQueries({ queryKey: ONBOARDING_KEY })
    },
  })
}

export function useInviteTeam() {
  return useMutation({
    mutationFn: async (input: TeamInviteInput): Promise<TeamInviteResult[]> => {
      const res = await fetch('/api/onboarding/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Errore invito team')
      const json = await res.json()
      return json.data
    },
  })
}

export function useUpdateCompanySetup() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CompanySetupInput) => {
      const res = await fetch('/api/onboarding/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Errore aggiornamento setup')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPANY_KEY })
    },
  })
}
