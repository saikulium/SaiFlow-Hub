// ---------------------------------------------------------------------------
// NotificationPreference service — lazy create + read/update
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db'
import type { NotificationPreference } from '@prisma/client'

/**
 * Ritorna le preferenze dell'utente, creandole con i default se mancanti.
 * Idempotent: sicuro da chiamare su qualsiasi utente.
 */
export async function getUserPreferences(
  userId: string,
): Promise<NotificationPreference> {
  const existing = await prisma.notificationPreference.findUnique({
    where: { user_id: userId },
  })
  if (existing) return existing

  return prisma.notificationPreference.create({
    data: { user_id: userId },
  })
}

export interface UpdatePreferencesInput {
  readonly email_overrides?: Record<string, boolean>
  readonly inapp_overrides?: Record<string, boolean>
  readonly digest_enabled?: boolean
  readonly digest_frequency?:
    | 'IMMEDIATE'
    | 'EVERY_15_MIN'
    | 'HOURLY'
    | 'DAILY'
  readonly digest_quiet_hours_start?: number | null
  readonly digest_quiet_hours_end?: number | null
}

/**
 * Aggiorna le preferenze per l'utente. Lazy-crea il record se manca.
 */
export async function updateUserPreferences(
  userId: string,
  patch: UpdatePreferencesInput,
): Promise<NotificationPreference> {
  await getUserPreferences(userId) // ensure row exists

  return prisma.notificationPreference.update({
    where: { user_id: userId },
    data: {
      ...(patch.email_overrides !== undefined && {
        email_overrides: patch.email_overrides,
      }),
      ...(patch.inapp_overrides !== undefined && {
        inapp_overrides: patch.inapp_overrides,
      }),
      ...(patch.digest_enabled !== undefined && {
        digest_enabled: patch.digest_enabled,
      }),
      ...(patch.digest_frequency !== undefined && {
        digest_frequency: patch.digest_frequency,
      }),
      ...(patch.digest_quiet_hours_start !== undefined && {
        digest_quiet_hours_start: patch.digest_quiet_hours_start,
      }),
      ...(patch.digest_quiet_hours_end !== undefined && {
        digest_quiet_hours_end: patch.digest_quiet_hours_end,
      }),
    },
  })
}
