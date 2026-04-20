// ---------------------------------------------------------------------------
// Tipi pubblici del modulo notifications
// ---------------------------------------------------------------------------
//
// `NOTIFICATION_TYPES` è riesportato da notification.service.ts per
// retro-compatibilità (i chiamanti legacy importano da lì). Il canonical
// è qui, sotto il nome NotificationTypeKey.

export const NOTIFICATION_TYPE_KEYS = [
  'APPROVAL_REQUESTED',
  'APPROVAL_DECIDED',
  'COMMENT_ADDED',
  'STATUS_CHANGED',
  'EMAIL_INGESTION',
  'EMAIL_UPDATE',
  'INVOICE_RECEIVED',
  'INVOICE_MATCHED',
  'INVOICE_MATCH_FAILED',
  'INVOICE_DISCREPANCY',
  'INVOICE_RECONCILED',
  'BUDGET_WARNING',
  'BUDGET_EXCEEDED',
  'BUDGET_FORECAST_ALERT',
  'COMMESSA_CREATED',
] as const

export type NotificationTypeKey = (typeof NOTIFICATION_TYPE_KEYS)[number]

export type NotificationChannel = 'inapp' | 'email'

export interface CreateNotificationInput {
  readonly userId: string
  readonly title: string
  readonly body: string
  /** Stringa o enum key — accettiamo entrambi per retro-compatibilità. */
  readonly type: string
  readonly link?: string
  /** Override esplicito dei canali. Se assente, deriva da preferenze utente. */
  readonly channels?: readonly NotificationChannel[]
  /** Metadata aggiuntivi passati al template (es. dati request/commessa). */
  readonly metadata?: Record<string, unknown>
}
