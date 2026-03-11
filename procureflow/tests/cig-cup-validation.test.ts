import { describe, it, expect } from 'vitest'
import {
  validateCig,
  validateCup,
  validateItalianVatChecksum,
  cigSchema,
  cupSchema,
  italianVatIdSchema,
} from '@/lib/validations/cig-cup'

describe('CIG validation', () => {
  it('accetta CIG valido di 10 caratteri alfanumerici', () => {
    expect(validateCig('ABC1234567')).toBe(true)
    expect(validateCig('ZZZ9876543')).toBe(true)
    expect(validateCig('0000000000')).toBe(true)
  })

  it('rifiuta CIG troppo corto', () => {
    expect(validateCig('ABC123456')).toBe(false)
  })

  it('rifiuta CIG troppo lungo', () => {
    expect(validateCig('ABC12345678')).toBe(false)
  })

  it('rifiuta CIG con caratteri speciali', () => {
    expect(validateCig('ABC-123456')).toBe(false)
    expect(validateCig('ABC 123456')).toBe(false)
  })

  it('cigSchema trasforma in uppercase', () => {
    const result = cigSchema.parse('abc1234567')
    expect(result).toBe('ABC1234567')
  })

  it('cigSchema rifiuta valori invalidi', () => {
    expect(() => cigSchema.parse('short')).toThrow()
  })
})

describe('CUP validation', () => {
  it('accetta CUP valido di 15 caratteri alfanumerici', () => {
    expect(validateCup('ABC123456789012')).toBe(true)
    expect(validateCup('J11B20000000001')).toBe(true)
  })

  it('rifiuta CUP troppo corto', () => {
    expect(validateCup('ABC12345678901')).toBe(false)
  })

  it('rifiuta CUP troppo lungo', () => {
    expect(validateCup('ABC1234567890123')).toBe(false)
  })

  it('cupSchema trasforma in uppercase', () => {
    const result = cupSchema.parse('abc123456789012')
    expect(result).toBe('ABC123456789012')
  })
})

describe('Italian VAT ID validation', () => {
  it('accetta P.IVA valida con checksum corretto', () => {
    // P.IVA di esempio: 01234567897 (checksum = 7)
    expect(validateItalianVatChecksum('01234567897')).toBe(true)
  })

  it('rifiuta P.IVA con checksum errato', () => {
    expect(validateItalianVatChecksum('01234567890')).toBe(false)
  })

  it('rifiuta P.IVA con lunghezza errata', () => {
    expect(validateItalianVatChecksum('0123456789')).toBe(false)
    expect(validateItalianVatChecksum('012345678901')).toBe(false)
  })

  it('rifiuta P.IVA con caratteri non numerici', () => {
    expect(validateItalianVatChecksum('0123456789A')).toBe(false)
  })

  it('italianVatIdSchema valida e restituisce stringa', () => {
    const result = italianVatIdSchema.parse('01234567897')
    expect(result).toBe('01234567897')
  })

  it('italianVatIdSchema rifiuta checksum errato', () => {
    expect(() => italianVatIdSchema.parse('01234567890')).toThrow()
  })
})
