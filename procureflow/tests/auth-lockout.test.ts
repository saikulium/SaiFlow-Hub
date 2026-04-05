import { describe, it, expect } from 'vitest'
import { checkAccountLocked } from '../src/server/services/auth.service'
import { passwordSchema } from '../src/lib/validations/auth'

// ---------------------------------------------------------------------------
// checkAccountLocked (pure function)
// ---------------------------------------------------------------------------

describe('checkAccountLocked', () => {
  it('returns not locked when locked_until is null', () => {
    const result = checkAccountLocked({ locked_until: null })
    expect(result.isLocked).toBe(false)
    expect(result.remainingMinutes).toBe(0)
  })

  it('returns not locked when locked_until is in the past', () => {
    const pastDate = new Date(Date.now() - 60_000) // 1 minute ago
    const result = checkAccountLocked({ locked_until: pastDate })
    expect(result.isLocked).toBe(false)
    expect(result.remainingMinutes).toBe(0)
  })

  it('returns locked with correct remaining minutes when locked_until is in the future', () => {
    const futureDate = new Date(Date.now() + 10 * 60_000) // 10 minutes from now
    const result = checkAccountLocked({ locked_until: futureDate })
    expect(result.isLocked).toBe(true)
    expect(result.remainingMinutes).toBe(10)
  })

  it('returns locked with 1 minute remaining when just barely locked', () => {
    const futureDate = new Date(Date.now() + 30_000) // 30 seconds from now
    const result = checkAccountLocked({ locked_until: futureDate })
    expect(result.isLocked).toBe(true)
    expect(result.remainingMinutes).toBe(1) // ceil(0.5) = 1
  })

  it('returns not locked when locked_until equals now', () => {
    const now = new Date()
    const result = checkAccountLocked({ locked_until: now })
    expect(result.isLocked).toBe(false)
    expect(result.remainingMinutes).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// passwordSchema
// ---------------------------------------------------------------------------

describe('passwordSchema', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Pa1')
    expect(result.success).toBe(false)
  })

  it('rejects passwords without uppercase letters', () => {
    const result = passwordSchema.safeParse('password1')
    expect(result.success).toBe(false)
  })

  it('rejects passwords without lowercase letters', () => {
    const result = passwordSchema.safeParse('PASSWORD1')
    expect(result.success).toBe(false)
  })

  it('rejects passwords without numbers', () => {
    const result = passwordSchema.safeParse('Password')
    expect(result.success).toBe(false)
  })

  it('accepts valid passwords', () => {
    expect(passwordSchema.safeParse('Password1').success).toBe(true)
    expect(passwordSchema.safeParse('MyP@ss123').success).toBe(true)
    expect(passwordSchema.safeParse('Str0ngPwd').success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = passwordSchema.safeParse('')
    expect(result.success).toBe(false)
  })
})
