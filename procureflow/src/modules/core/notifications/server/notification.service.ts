import { prisma } from '@/lib/db'
import type { Notification } from '@prisma/client'
import {
  NOTIFICATION_TYPE_KEYS,
  type NotificationTypeKey,
  type NotificationChannel,
} from './notification.types'
import { getUserPreferences } from './preference.service'
import { resolveChannels, isInQuietHours, isUrgent } from './channel-resolver'
import { getEmailTransport } from './email-transport'
import { EMAIL_CONFIG } from './email-config'
import { renderTemplate } from './template-renderer'
import { writeAuditLog } from '@/modules/core/audit-log'

/** Tipi di notifica supportati dal sistema. Il valore è persistito su DB. */
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
  COMMESSA_CREATED: 'commessa_created',
} as const

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

/** Reverse map: valore DB → chiave enum (es. 'approval_decided' → 'APPROVAL_DECIDED'). */
const VALUE_TO_KEY: Record<string, NotificationTypeKey> = Object.fromEntries(
  Object.entries(NOTIFICATION_TYPES).map(([key, value]) => [
    value,
    key as NotificationTypeKey,
  ]),
)

function resolveTypeKey(type: string): NotificationTypeKey | null {
  if (NOTIFICATION_TYPE_KEYS.includes(type as NotificationTypeKey)) {
    return type as NotificationTypeKey
  }
  return VALUE_TO_KEY[type] ?? null
}

interface CreateNotificationInput {
  readonly userId: string
  readonly title: string
  readonly body: string
  readonly type: NotificationType | NotificationTypeKey | string
  readonly link?: string
  /** Override esplicito dei canali. Se assente → deriva da preferenze utente. */
  readonly channels?: readonly NotificationChannel[]
  /** Metadata aggiuntivi che verranno passati al template se disponibile. */
  readonly metadata?: Record<string, unknown>
}

interface BulkNotificationItem {
  readonly userId: string
  readonly title: string
  readonly body: string
  readonly type: NotificationType | NotificationTypeKey | string
  readonly link?: string
}

/**
 * Crea una notifica per un utente e invia i canali abilitati.
 *
 * Flusso:
 *  1. Crea record Notification (in-app sempre, se abilitato).
 *  2. Risolve i canali da preferenze utente (o override esplicito).
 *  3. Se 'email' è abilitato:
 *     - tipo urgente → send immediato
 *     - quiet hours → NON invia (lasciato al digest di Step 5)
 *     - altrimenti → send immediato (lo Step 5 aggiungerà digest queue)
 *  4. Fail-soft: errori email non bloccano l'in-app.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const notification = await prisma.notification.create({
    data: {
      user_id: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      link: input.link ?? null,
    },
  })

  // Risolve canali effettivi
  const prefs = await getUserPreferences(input.userId)
  const typeKey = resolveTypeKey(input.type)
  const channels = input.channels
    ? [...input.channels]
    : typeKey
      ? resolveChannels(typeKey, prefs)
      : (['inapp'] as NotificationChannel[])

  if (channels.includes('email') && typeKey) {
    const urgent = isUrgent(typeKey)
    const inQuiet = isInQuietHours(prefs)

    // Urgente → sempre invio. Non urgente in quiet hours → skip (digest si occuperà in Step 5).
    if (urgent || !inQuiet) {
      // Fail-soft: qualsiasi errore viene loggato ma non blocca il caller
      try {
        await sendEmailNotification(input, notification, typeKey)
      } catch (err) {
        console.error(
          `[notification.service] Email send failed for user=${input.userId} type=${typeKey}:`,
          err,
        )
      }
    }
  }

  return notification
}

/**
 * Invia l'email per una notifica appena creata.
 * Usa il template dedicato se disponibile, altrimenti fallback generico.
 */
async function sendEmailNotification(
  input: CreateNotificationInput,
  notification: Notification,
  typeKey: NotificationTypeKey,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true },
  })

  if (!user?.email) {
    console.warn(
      `[notification.service] Skipping email: user ${input.userId} has no email`,
    )
    return
  }

  // Costruisce props template: default = { title, body } + recipientName + metadata
  const baseProps = {
    title: input.title,
    body: input.body,
    recipientName: user.name ?? 'utente',
    ...(input.metadata ?? {}),
  }

  const { html, text } = await renderTemplate(typeKey, baseProps)

  const transport = getEmailTransport()
  const result = await transport.send({
    to: user.email,
    from: EMAIL_CONFIG.from,
    replyTo: EMAIL_CONFIG.replyTo,
    subject: input.title,
    html,
    text,
    tags: {
      type: typeKey,
      notification_id: notification.id,
    },
  })

  if (!result.success) {
    console.error(
      `[notification.service] Transport failed: ${result.error ?? 'unknown'}`,
    )
    return
  }

  // Audit log fail-soft
  try {
    await writeAuditLog({
      action: 'CREATE',
      entityType: 'EmailSend',
      entityId: result.id || notification.id,
      entityLabel: input.title,
      actorType: 'SYSTEM',
      actorLabel: 'notifications.service',
      metadata: {
        to: user.email,
        type: typeKey,
        notification_id: notification.id,
        transport_id: result.id,
      },
    })
  } catch (err) {
    console.warn('[notification.service] Audit log failed (swallowed):', err)
  }
}

/**
 * Crea notifiche in blocco per più utenti.
 * Nota: versione bulk NON invia email (usata per broadcast rapidi).
 * Per inviare email in bulk, iterare chiamando createNotification().
 */
export async function createBulkNotifications(
  items: readonly BulkNotificationItem[],
): Promise<{ count: number }> {
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
