import { describe, it, expect } from 'vitest'
import { updatePreferencesSchema } from '../validations/preference'

describe('updatePreferencesSchema', () => {
  it('accetta un singolo campo valido', () => {
    const result = updatePreferencesSchema.safeParse({
      digest_enabled: false,
    })
    expect(result.success).toBe(true)
  })

  it('accetta override email per tipo noto', () => {
    const result = updatePreferencesSchema.safeParse({
      email_overrides: { APPROVAL_DECIDED: false },
    })
    expect(result.success).toBe(true)
  })

  it('rifiuta override per tipo sconosciuto', () => {
    const result = updatePreferencesSchema.safeParse({
      email_overrides: { NON_ESISTE: true },
    })
    expect(result.success).toBe(false)
  })

  it('rifiuta payload vuoto', () => {
    const result = updatePreferencesSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rifiuta ore quiet fuori range', () => {
    const result = updatePreferencesSchema.safeParse({
      digest_quiet_hours_start: 24,
    })
    expect(result.success).toBe(false)
  })

  it('accetta null per disattivare quiet hours', () => {
    const result = updatePreferencesSchema.safeParse({
      digest_quiet_hours_start: null,
      digest_quiet_hours_end: null,
    })
    expect(result.success).toBe(true)
  })

  it('rifiuta campi extra (strict)', () => {
    const result = updatePreferencesSchema.safeParse({
      digest_enabled: true,
      unknown_field: 'x',
    })
    expect(result.success).toBe(false)
  })

  it('accetta digest_frequency valido', () => {
    const result = updatePreferencesSchema.safeParse({
      digest_frequency: 'DAILY',
    })
    expect(result.success).toBe(true)
  })

  it('rifiuta digest_frequency non valido', () => {
    const result = updatePreferencesSchema.safeParse({
      digest_frequency: 'YEARLY',
    })
    expect(result.success).toBe(false)
  })
})
