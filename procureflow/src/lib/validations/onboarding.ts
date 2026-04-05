import { z } from 'zod'

export const completeOnboardingSchema = z.object({
  completed: z.boolean(),
  completedSteps: z.array(z.string()).optional(),
  dismissedUntil: z.string().datetime().optional(),
})

export const teamInviteSchema = z.object({
  invites: z
    .array(
      z.object({
        name: z.string().min(2, 'Nome richiesto'),
        email: z.string().email('Email non valida'),
        role: z.enum(['REQUESTER', 'MANAGER', 'VIEWER']),
      }),
    )
    .min(1, 'Almeno un invito richiesto'),
})

export const companySetupSchema = z.object({
  companyName: z.string().min(2, 'Nome azienda richiesto').optional(),
  categories: z.array(z.string()).optional(),
  approvalRules: z
    .object({
      autoApproveThreshold: z.number().min(0),
      managerThreshold: z.number().min(0),
    })
    .optional(),
})

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>
export type TeamInviteInput = z.infer<typeof teamInviteSchema>
export type CompanySetupInput = z.infer<typeof companySetupSchema>
