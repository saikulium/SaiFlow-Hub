// ---------------------------------------------------------------------------
// Channel resolver — decide quali canali usare per una data notifica.
//
// Input:
//  - NotificationTypeKey (chiave enum semantica del tipo notifica)
//  - NotificationPreference (preferenze salvate per l'utente)
//
// Output: lista canali ('inapp' | 'email') da usare per questa notifica.
//
// Logica:
//  1. Se l'utente ha un override esplicito → rispetta override.
//  2. Altrimenti → usa default per quel tipo (mappa DEFAULT_CHANNELS).
//  3. Tipi urgenti (URGENT_TYPES) bypassano quiet hours e digest.
// ---------------------------------------------------------------------------

import type { NotificationPreference } from '@prisma/client'
import type {
  NotificationChannel,
  NotificationTypeKey,
} from './notification.types'

/**
 * Default per tipo: quali canali sono abilitati senza override utente.
 * - 'inapp' sempre attivo per default (centro notifiche).
 * - 'email' attivo solo per tipi ad alta priorità o azionabili.
 */
const DEFAULT_CHANNELS: Record<NotificationTypeKey, NotificationChannel[]> = {
  APPROVAL_REQUESTED: ['inapp', 'email'],
  APPROVAL_DECIDED: ['inapp', 'email'],
  COMMENT_ADDED: ['inapp'],
  STATUS_CHANGED: ['inapp'],
  EMAIL_INGESTION: ['inapp', 'email'],
  EMAIL_UPDATE: ['inapp'],
  INVOICE_RECEIVED: ['inapp'],
  INVOICE_MATCHED: ['inapp'],
  INVOICE_MATCH_FAILED: ['inapp', 'email'],
  INVOICE_DISCREPANCY: ['inapp', 'email'],
  INVOICE_RECONCILED: ['inapp'],
  BUDGET_WARNING: ['inapp', 'email'],
  BUDGET_EXCEEDED: ['inapp', 'email'],
  BUDGET_FORECAST_ALERT: ['inapp'],
  COMMESSA_CREATED: ['inapp', 'email'],
}

/**
 * Tipi urgenti — bypassano digest e quiet hours.
 */
export const URGENT_TYPES: ReadonlySet<NotificationTypeKey> =
  new Set<NotificationTypeKey>([
    'APPROVAL_REQUESTED',
    'INVOICE_DISCREPANCY',
    'INVOICE_MATCH_FAILED',
    'BUDGET_EXCEEDED',
  ])

export function isUrgent(type: NotificationTypeKey | string): boolean {
  return URGENT_TYPES.has(type as NotificationTypeKey)
}

/**
 * Ritorna la lista canali attivi per (tipo, preferenze utente).
 * Mai mutazione: ritorna sempre un nuovo array.
 */
export function resolveChannels(
  type: NotificationTypeKey,
  prefs: NotificationPreference,
): NotificationChannel[] {
  const defaults =
    DEFAULT_CHANNELS[type] ?? (['inapp'] as NotificationChannel[])
  const emailOverrides =
    (prefs.email_overrides as Record<string, boolean> | null) ?? {}
  const inappOverrides =
    (prefs.inapp_overrides as Record<string, boolean> | null) ?? {}

  const inappEnabled = inappOverrides[type] ?? defaults.includes('inapp')
  const emailEnabled = emailOverrides[type] ?? defaults.includes('email')

  const channels: NotificationChannel[] = []
  if (inappEnabled) channels.push('inapp')
  if (emailEnabled) channels.push('email')
  return channels
}

/**
 * True se l'ora attuale ricade nella finestra quiet hours configurata.
 * Gestisce wrap-around (start=20, end=8 → quiet 20:00-23:59 + 00:00-07:59).
 */
export function isInQuietHours(
  prefs: NotificationPreference,
  now: Date = new Date(),
): boolean {
  const start = prefs.digest_quiet_hours_start
  const end = prefs.digest_quiet_hours_end
  if (start == null || end == null) return false

  const hour = now.getHours()
  return start > end ? hour >= start || hour < end : hour >= start && hour < end
}

export function getDefaultChannels(
  type: NotificationTypeKey,
): NotificationChannel[] {
  return [...(DEFAULT_CHANNELS[type] ?? ['inapp'])]
}
