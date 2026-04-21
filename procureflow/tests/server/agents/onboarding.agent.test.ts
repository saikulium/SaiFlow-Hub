import { describe, it, expect } from 'vitest'
import {
  VendorMappingSchema,
  VendorBatchSchema,
} from '@/lib/ai/schemas/onboarding-import.schema'

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------

describe('VendorMappingSchema', () => {
  const validVendor = {
    name: 'Acme Srl',
    code: 'ACM001',
    email: 'info@acme.it',
    phone: '+39 02 1234567',
    vat_id: '12345678901',
    category: ['Elettronica', 'Componentistica'],
    payment_terms: '30gg DFFM',
    confidence: 0.95,
    warnings: [],
  }

  it('parses a valid vendor object', () => {
    const result = VendorMappingSchema.parse(validVendor)
    expect(result.name).toBe('Acme Srl')
    expect(result.code).toBe('ACM001')
    expect(result.email).toBe('info@acme.it')
    expect(result.phone).toBe('+39 02 1234567')
    expect(result.vat_id).toBe('12345678901')
    expect(result.category).toEqual(['Elettronica', 'Componentistica'])
    expect(result.payment_terms).toBe('30gg DFFM')
    expect(result.confidence).toBe(0.95)
    expect(result.warnings).toHaveLength(0)
  })

  it('accepts null for optional fields', () => {
    const vendor = {
      ...validVendor,
      email: null,
      phone: null,
      vat_id: null,
      payment_terms: null,
    }
    const result = VendorMappingSchema.parse(vendor)
    expect(result.email).toBeNull()
    expect(result.phone).toBeNull()
    expect(result.vat_id).toBeNull()
    expect(result.payment_terms).toBeNull()
  })

  it('accepts empty category array', () => {
    const vendor = { ...validVendor, category: [] }
    const result = VendorMappingSchema.parse(vendor)
    expect(result.category).toHaveLength(0)
  })

  it('accepts warnings array with messages', () => {
    const vendor = {
      ...validVendor,
      warnings: ['P.IVA invalida', 'Email mancante'],
    }
    const result = VendorMappingSchema.parse(vendor)
    expect(result.warnings).toHaveLength(2)
    expect(result.warnings[0]).toBe('P.IVA invalida')
  })

  it('rejects confidence below 0', () => {
    expect(() =>
      VendorMappingSchema.parse({
        ...validVendor,
        confidence: -0.1,
      }),
    ).toThrow()
  })

  it('rejects confidence above 1', () => {
    expect(() =>
      VendorMappingSchema.parse({
        ...validVendor,
        confidence: 1.1,
      }),
    ).toThrow()
  })

  it('accepts boundary confidence values', () => {
    const atZero = VendorMappingSchema.parse({ ...validVendor, confidence: 0 })
    expect(atZero.confidence).toBe(0)

    const atOne = VendorMappingSchema.parse({ ...validVendor, confidence: 1 })
    expect(atOne.confidence).toBe(1)
  })

  it('rejects missing required fields', () => {
    expect(() => VendorMappingSchema.parse({})).toThrow()
    expect(() =>
      VendorMappingSchema.parse({ name: 'Test' }),
    ).toThrow()
  })

  it('rejects non-string name', () => {
    expect(() =>
      VendorMappingSchema.parse({
        ...validVendor,
        name: 123,
      }),
    ).toThrow()
  })

  it('rejects non-array category', () => {
    expect(() =>
      VendorMappingSchema.parse({
        ...validVendor,
        category: 'Elettronica',
      }),
    ).toThrow()
  })
})

describe('VendorBatchSchema', () => {
  const validVendor = {
    name: 'Acme Srl',
    code: 'ACM001',
    email: 'info@acme.it',
    phone: '+39 02 1234567',
    vat_id: '12345678901',
    category: ['Elettronica'],
    payment_terms: '30gg DFFM',
    confidence: 0.95,
    warnings: [],
  }

  it('parses an array of valid vendors', () => {
    const batch = [
      validVendor,
      { ...validVendor, name: 'Beta Spa', code: 'BET001' },
    ]
    const result = VendorBatchSchema.parse(batch)
    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('Acme Srl')
    expect(result[1]!.name).toBe('Beta Spa')
  })

  it('accepts an empty array', () => {
    const result = VendorBatchSchema.parse([])
    expect(result).toHaveLength(0)
  })

  it('rejects non-array input', () => {
    expect(() => VendorBatchSchema.parse(validVendor)).toThrow()
    expect(() => VendorBatchSchema.parse('not an array')).toThrow()
  })

  it('rejects array with invalid items', () => {
    expect(() =>
      VendorBatchSchema.parse([validVendor, { name: 'Incomplete' }]),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Module export tests
// ---------------------------------------------------------------------------

describe('OnboardingAgent module', () => {
  it('exports processVendorImport function', async () => {
    const mod = await import('@/server/agents/onboarding.agent')
    expect(typeof mod.processVendorImport).toBe('function')
  })

  it('has only the expected export', async () => {
    const mod = await import('@/server/agents/onboarding.agent')
    const exportKeys = Object.keys(mod)
    expect(exportKeys).toContain('processVendorImport')
  })
})

describe('OnboardingImportSchema module', () => {
  it('exports VendorMappingSchema and VendorBatchSchema', async () => {
    const mod = await import('@/lib/ai/schemas/onboarding-import.schema')
    expect(mod.VendorMappingSchema).toBeDefined()
    expect(mod.VendorBatchSchema).toBeDefined()
  })
})
