import { describe, it, expect } from 'vitest'
import type { NotificationPreference } from '@prisma/client'
import {
  resolveChannels,
  isInQuietHours,
  isUrgent,
  getDefaultChannels,
} from '../server/channel-resolver'

function makePrefs(
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

describe('channel-resolver', () => {
  describe('resolveChannels', () => {
    it('APPROVAL_DECIDED default → inapp + email', () => {
      expect(resolveChannels('APPROVAL_DECIDED', makePrefs())).toEqual([
        'inapp',
        'email',
      ])
    })

    it('COMMENT_ADDED default → solo inapp', () => {
      expect(resolveChannels('COMMENT_ADDED', makePrefs())).toEqual(['inapp'])
    })

    it('override email:false disattiva email su APPROVAL_DECIDED', () => {
      const prefs = makePrefs({
        email_overrides: { APPROVAL_DECIDED: false },
      })
      expect(resolveChannels('APPROVAL_DECIDED', prefs)).toEqual(['inapp'])
    })

    it('override inapp:false + email:true su COMMENT_ADDED → solo email', () => {
      const prefs = makePrefs({
        inapp_overrides: { COMMENT_ADDED: false },
        email_overrides: { COMMENT_ADDED: true },
      })
      expect(resolveChannels('COMMENT_ADDED', prefs)).toEqual(['email'])
    })

    it('override non impostato → usa default del tipo', () => {
      const prefs = makePrefs({ email_overrides: { OTHER_TYPE: false } })
      expect(resolveChannels('APPROVAL_DECIDED', prefs)).toEqual([
        'inapp',
        'email',
      ])
    })

    it('entrambi disabilitati → array vuoto', () => {
      const prefs = makePrefs({
        inapp_overrides: { APPROVAL_DECIDED: false },
        email_overrides: { APPROVAL_DECIDED: false },
      })
      expect(resolveChannels('APPROVAL_DECIDED', prefs)).toEqual([])
    })
  })

  describe('isInQuietHours', () => {
    it('quiet 20-8: 2am → true', () => {
      const d = new Date()
      d.setHours(2, 0, 0, 0)
      expect(isInQuietHours(makePrefs(), d)).toBe(true)
    })

    it('quiet 20-8: 10am → false', () => {
      const d = new Date()
      d.setHours(10, 0, 0, 0)
      expect(isInQuietHours(makePrefs(), d)).toBe(false)
    })

    it('quiet 20-8: 20:00 esatte → true (inclusivo)', () => {
      const d = new Date()
      d.setHours(20, 0, 0, 0)
      expect(isInQuietHours(makePrefs(), d)).toBe(true)
    })

    it('quiet 20-8: 8:00 esatte → false (esclusivo)', () => {
      const d = new Date()
      d.setHours(8, 0, 0, 0)
      expect(isInQuietHours(makePrefs(), d)).toBe(false)
    })

    it('senza wrap-around: start=9 end=17, 12:00 → true', () => {
      const prefs = makePrefs({
        digest_quiet_hours_start: 9,
        digest_quiet_hours_end: 17,
      })
      const d = new Date()
      d.setHours(12, 0, 0, 0)
      expect(isInQuietHours(prefs, d)).toBe(true)
    })

    it('null start/end → sempre false', () => {
      const prefs = makePrefs({
        digest_quiet_hours_start: null,
        digest_quiet_hours_end: null,
      })
      expect(isInQuietHours(prefs, new Date())).toBe(false)
    })
  })

  describe('isUrgent', () => {
    it('APPROVAL_REQUESTED è urgente', () => {
      expect(isUrgent('APPROVAL_REQUESTED')).toBe(true)
    })
    it('INVOICE_DISCREPANCY è urgente', () => {
      expect(isUrgent('INVOICE_DISCREPANCY')).toBe(true)
    })
    it('COMMENT_ADDED non è urgente', () => {
      expect(isUrgent('COMMENT_ADDED')).toBe(false)
    })
  })

  describe('getDefaultChannels', () => {
    it('ritorna una copia (no mutation del default)', () => {
      const a = getDefaultChannels('APPROVAL_DECIDED')
      a.push('inapp')
      const b = getDefaultChannels('APPROVAL_DECIDED')
      expect(b).toEqual(['inapp', 'email'])
    })
  })
})
