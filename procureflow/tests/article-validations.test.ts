import { describe, it, expect } from 'vitest'
import {
  createArticleSchema,
  articleQuerySchema,
  createAliasSchema,
  createPriceSchema,
} from '../src/lib/validations/article'

describe('createArticleSchema', () => {
  it('accepts valid article data', () => {
    const result = createArticleSchema.safeParse({
      name: 'Connettore MIL 38999',
      unit_of_measure: 'pz',
      category: 'Connettori',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createArticleSchema.safeParse({
      name: '',
      unit_of_measure: 'pz',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 200 chars', () => {
    const result = createArticleSchema.safeParse({
      name: 'a'.repeat(201),
      unit_of_measure: 'pz',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unit_of_measure over 10 chars', () => {
    const result = createArticleSchema.safeParse({
      name: 'Test',
      unit_of_measure: 'a'.repeat(11),
    })
    expect(result.success).toBe(false)
  })
})

describe('createAliasSchema', () => {
  it('accepts valid alias data and transforms to uppercase', () => {
    const result = createAliasSchema.safeParse({
      alias_type: 'VENDOR',
      alias_code: 'abc-123',
      entity_id: 'cuid123',
    })
    expect(result.success).toBe(true)
    expect(result.data!.alias_code).toBe('ABC-123')
  })

  it('rejects invalid alias_type', () => {
    const result = createAliasSchema.safeParse({
      alias_type: 'INVALID',
      alias_code: 'ABC',
    })
    expect(result.success).toBe(false)
  })
})

describe('createPriceSchema', () => {
  it('accepts valid price data', () => {
    const result = createPriceSchema.safeParse({
      vendor_id: 'cuid123',
      unit_price: 12.5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative price', () => {
    const result = createPriceSchema.safeParse({
      vendor_id: 'cuid123',
      unit_price: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects min_quantity below 1', () => {
    const result = createPriceSchema.safeParse({
      vendor_id: 'cuid123',
      unit_price: 10,
      min_quantity: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('articleQuerySchema', () => {
  it('provides defaults', () => {
    const result = articleQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data!.page).toBe(1)
    expect(result.data!.pageSize).toBe(20)
    expect(result.data!.sort).toBe('created_at')
    expect(result.data!.order).toBe('desc')
  })
})
