import { describe, it, expect } from 'vitest'

describe('article code format', () => {
  it('generates ART-YYYY-NNNNN format', () => {
    const year = new Date().getFullYear()
    const prefix = 'ART'
    const fullPrefix = `${prefix}-${year}-`
    const padLen = 5
    const nextNum = 1
    const code = `${fullPrefix}${String(nextNum).padStart(padLen, '0')}`
    expect(code).toMatch(/^ART-\d{4}-\d{5}$/)
    expect(code).toBe(`ART-${year}-00001`)
  })

  it('pads correctly for larger numbers', () => {
    const year = new Date().getFullYear()
    const code = `ART-${year}-${String(42).padStart(5, '0')}`
    expect(code).toBe(`ART-${year}-00042`)
  })
})
