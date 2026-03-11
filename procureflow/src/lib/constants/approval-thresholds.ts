import type { RequestStatus, UserRole } from '@prisma/client'

/** Soglie importo per routing approvazioni */
export const APPROVAL_THRESHOLDS = {
  /** Sotto questa soglia: auto-approvazione */
  AUTO_APPROVE_MAX: 500,
  /** Sotto questa soglia: richiede approvazione MANAGER */
  MANAGER_APPROVE_MAX: 5000,
  /** Sopra MANAGER_APPROVE_MAX: richiede approvazione ADMIN (direzione) */
} as const

/** Ruoli richiesti per fascia di importo */
export const APPROVAL_REQUIRED_ROLES = {
  auto: [],
  manager: ['MANAGER'] as const,
  director: ['ADMIN'] as const,
} as const

/**
 * Ruoli che possono auto-approvare le proprie richieste.
 * MANAGER e ADMIN hanno l'autorità per non richiedere approvazione esterna.
 */
export const AUTO_APPROVE_ROLES: readonly UserRole[] = [
  'MANAGER',
  'ADMIN',
] as const

/** Step del ciclo di vita di una richiesta (ordine canonico) */
export const REQUEST_LIFECYCLE_STEPS: readonly RequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ORDERED',
  'SHIPPED',
  'DELIVERED',
] as const

/** Step labels in italiano */
export const LIFECYCLE_STEP_LABELS: Record<string, string> = {
  DRAFT: 'Bozza',
  SUBMITTED: 'Inviata',
  PENDING_APPROVAL: 'In Approvazione',
  APPROVED: 'Approvata',
  ORDERED: 'Ordinata',
  SHIPPED: 'Spedita',
  DELIVERED: 'Consegnata',
  REJECTED: 'Rifiutata',
  CANCELLED: 'Annullata',
  ON_HOLD: 'In Attesa',
} as const

/** Determina la fascia di approvazione in base all'importo */
export function getApprovalTier(
  amount: number,
): 'auto' | 'manager' | 'director' {
  if (amount < APPROVAL_THRESHOLDS.AUTO_APPROVE_MAX) return 'auto'
  if (amount < APPROVAL_THRESHOLDS.MANAGER_APPROVE_MAX) return 'manager'
  return 'director'
}

/**
 * Determina se il ruolo dell'utente permette auto-approvazione.
 * MANAGER e ADMIN possono approvare direttamente le proprie richieste.
 */
export function canAutoApproveByRole(role: UserRole): boolean {
  return (AUTO_APPROVE_ROLES as readonly string[]).includes(role)
}
