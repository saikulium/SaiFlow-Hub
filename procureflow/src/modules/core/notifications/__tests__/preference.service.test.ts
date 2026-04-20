import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { NotificationPreference } from '@prisma/client'

const findUnique = vi.fn()
const create = vi.fn()
const update = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    notificationPreference: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}))

import {
  getUserPreferences,
  updateUserPreferences,
} from '../server/preference.service'

function makeRow(
  overrides: Partial<NotificationPreference> = {},
): NotificationPreference {
  return {
    id: 'pref_1',
    user_id: 'user_1',
    email_overrides: {},
    inapp_overrides: {},
    digest_enabled: true,
    digest_frequency: 'HOURLY',
    digest_quiet_hours_start: 20,
    digest_quiet_hours_end: 8,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

describe('preference.service', () => {
  beforeEach(() => {
    findUnique.mockReset()
    create.mockReset()
    update.mockReset()
  })

  describe('getUserPreferences', () => {
    it('ritorna riga esistente senza creare', async () => {
      const existing = makeRow()
      findUnique.mockResolvedValueOnce(existing)

      const result = await getUserPreferences('user_1')

      expect(result).toBe(existing)
      expect(create).not.toHaveBeenCalled()
    })

    it('crea riga con default quando non esiste', async () => {
      findUnique.mockResolvedValueOnce(null)
      const fresh = makeRow()
      create.mockResolvedValueOnce(fresh)

      const result = await getUserPreferences('user_1')

      expect(create).toHaveBeenCalledWith({ data: { user_id: 'user_1' } })
      expect(result).toBe(fresh)
    })
  })

  describe('updateUserPreferences', () => {
    it('assicura esistenza e poi aggiorna i campi passati', async () => {
      findUnique.mockResolvedValueOnce(makeRow())
      const updated = makeRow({ digest_enabled: false })
      update.mockResolvedValueOnce(updated)

      const result = await updateUserPreferences('user_1', {
        digest_enabled: false,
        email_overrides: { COMMENT_ADDED: true },
      })

      expect(update).toHaveBeenCalledWith({
        where: { user_id: 'user_1' },
        data: {
          digest_enabled: false,
          email_overrides: { COMMENT_ADDED: true },
        },
      })
      expect(result).toBe(updated)
    })

    it('ignora i campi undefined nel patch', async () => {
      findUnique.mockResolvedValueOnce(makeRow())
      update.mockResolvedValueOnce(makeRow())

      await updateUserPreferences('user_1', {
        digest_frequency: 'DAILY',
      })

      const call = update.mock.calls[0]?.[0] as {
        data: Record<string, unknown>
      }
      expect(call.data).toEqual({ digest_frequency: 'DAILY' })
      expect(call.data).not.toHaveProperty('email_overrides')
      expect(call.data).not.toHaveProperty('digest_enabled')
    })

    it('lazy-crea se manca prima di aggiornare', async () => {
      findUnique.mockResolvedValueOnce(null)
      create.mockResolvedValueOnce(makeRow())
      update.mockResolvedValueOnce(makeRow({ digest_enabled: false }))

      await updateUserPreferences('user_1', { digest_enabled: false })

      expect(create).toHaveBeenCalledOnce()
      expect(update).toHaveBeenCalledOnce()
    })
  })
})
