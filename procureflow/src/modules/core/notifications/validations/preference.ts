import { z } from 'zod'
import { NOTIFICATION_TYPE_KEYS } from '../server/notification.types'

const DIGEST_FREQUENCIES = [
  'IMMEDIATE',
  'EVERY_15_MIN',
  'HOURLY',
  'DAILY',
] as const

const overridesRecord = z
  .record(z.string(), z.boolean())
  .refine(
    (obj) =>
      Object.keys(obj).every((k) =>
        (NOTIFICATION_TYPE_KEYS as readonly string[]).includes(k),
      ),
    { message: 'Chiave override non valida' },
  )

const hourValue = z.number().int().min(0).max(23).nullable()

export const updatePreferencesSchema = z
  .object({
    email_overrides: overridesRecord.optional(),
    inapp_overrides: overridesRecord.optional(),
    digest_enabled: z.boolean().optional(),
    digest_frequency: z.enum(DIGEST_FREQUENCIES).optional(),
    digest_quiet_hours_start: hourValue.optional(),
    digest_quiet_hours_end: hourValue.optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Almeno un campo deve essere fornito',
  })

export type UpdatePreferencesPayload = z.infer<typeof updatePreferencesSchema>
