import type { RequestStatus } from '@prisma/client'

/** Soglie e default per il modulo budget */
export const BUDGET_DEFAULTS = {
  ALERT_THRESHOLD_PERCENT: 80,
  ENFORCEMENT_MODE: 'SOFT' as const,
} as const

/** Labels italiane per i tipi di periodo */
export const BUDGET_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: 'Mensile',
  QUARTERLY: 'Trimestrale',
  ANNUAL: 'Annuale',
} as const

/** Labels italiane per le modalità di enforcement */
export const BUDGET_ENFORCEMENT_LABELS: Record<string, string> = {
  SOFT: 'Avviso (soft block)',
  HARD: 'Blocco (hard block)',
} as const

/**
 * Stati che contano come "impegnato" (committed) — spesa in pipeline.
 * Include da SUBMITTED (quando viene sottomessa) fino a DELIVERED (prima della fattura).
 */
export const COMMITTED_STATUSES: readonly RequestStatus[] = [
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ORDERED',
  'SHIPPED',
  'DELIVERED',
] as const

/**
 * Stati che contano come "speso" — fatturato e riconciliato.
 * L'importo di riferimento è invoiced_amount (IVA inclusa).
 */
export const SPENT_STATUSES: readonly RequestStatus[] = [
  'INVOICED',
  'RECONCILED',
  'CLOSED',
] as const

/** Colori per le barre budget nel dashboard */
export const BUDGET_BAR_COLORS = {
  spent: '#22C55E',
  committed: '#F59E0B',
  available: '#52525B',
  exceeded: '#EF4444',
} as const
