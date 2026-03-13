import { prisma } from '@/lib/db'

/** Tipi di notifica supportati dal sistema */
export const NOTIFICATION_TYPES = {
  APPROVAL_REQUESTED: 'approval_required',
  APPROVAL_DECIDED: 'approval_decided',
  COMMENT_ADDED: 'new_comment',
  STATUS_CHANGED: 'status_changed',
  EMAIL_INGESTION: 'email_ingestion',
  EMAIL_UPDATE: 'email_update',
  INVOICE_RECEIVED: 'invoice_received',
  INVOICE_MATCHED: 'invoice_matched',
  INVOICE_MATCH_FAILED: 'invoice_match_failed',
  INVOICE_DISCREPANCY: 'invoice_discrepancy',
  INVOICE_RECONCILED: 'invoice_reconciled',
  BUDGET_WARNING: 'budget_warning',
  BUDGET_EXCEEDED: 'budget_exceeded',
  BUDGET_FORECAST_ALERT: 'budget_forecast_alert',
} as const

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

interface CreateNotificationInput {
  readonly userId: string
  readonly title: string
  readonly body: string
  readonly type: NotificationType
  readonly link?: string
}

interface BulkNotificationItem {
  readonly userId: string
  readonly title: string
  readonly body: string
  readonly type: NotificationType
  readonly link?: string
}

/**
 * Crea una singola notifica per un utente.
 * Restituisce il record creato.
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      user_id: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      link: input.link ?? null,
    },
  })

  return notification
}

/**
 * Crea notifiche in blocco per pi utenti.
 * Restituisce il conteggio dei record creati.
 */
export async function createBulkNotifications(
  items: readonly BulkNotificationItem[],
) {
  if (items.length === 0) {
    return { count: 0 }
  }

  const data = items.map((item) => ({
    user_id: item.userId,
    title: item.title,
    body: item.body,
    type: item.type,
    link: item.link ?? null,
  }))

  const result = await prisma.notification.createMany({ data })

  return result
}
