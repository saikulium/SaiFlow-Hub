export const ADMIN_STEPS = ['company', 'vendor', 'team', 'categories', 'approvals'] as const
export type AdminStepId = (typeof ADMIN_STEPS)[number]

export const REQUIRED_ADMIN_STEPS: readonly AdminStepId[] = ['company', 'vendor', 'team']
export const OPTIONAL_ADMIN_STEPS: readonly AdminStepId[] = ['categories', 'approvals']

export interface OnboardingData {
  readonly completedSteps: readonly string[]
  readonly dismissedUntil?: string // ISO 8601
  readonly companyName?: string
}

export interface ApprovalRules {
  readonly autoApproveThreshold: number
  readonly managerThreshold: number
}

export interface OnboardingState {
  readonly isComplete: boolean
  readonly data: OnboardingData | null
  readonly role: string
}

export interface TeamInvite {
  readonly name: string
  readonly email: string
  readonly role: 'REQUESTER' | 'MANAGER' | 'VIEWER'
}

export interface TeamInviteResult {
  readonly email: string
  readonly password: string
  readonly success: boolean
  readonly error?: string
}
