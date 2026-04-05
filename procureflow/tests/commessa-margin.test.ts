import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { computeMargin } from '../src/server/services/commessa.service'

describe('computeMargin', () => {
  it('returns null when clientValue is null', () => {
    const result = computeMargin(null, new Prisma.Decimal(5000), new Prisma.Decimal(3000))
    expect(result.margin).toBeNull()
    expect(result.marginPercent).toBeNull()
  })

  it('calculates positive margin (10000 - 7000 = 3000, 30%)', () => {
    const result = computeMargin(
      new Prisma.Decimal(10000),
      new Prisma.Decimal(7000),
      new Prisma.Decimal(5000),
    )
    expect(result.margin).toBe(3000)
    expect(result.marginPercent).toBe(30)
  })

  it('calculates negative margin (5000 - 6000 = -1000, -20%)', () => {
    const result = computeMargin(
      new Prisma.Decimal(5000),
      new Prisma.Decimal(6000),
      null,
    )
    expect(result.margin).toBe(-1000)
    expect(result.marginPercent).toBe(-20)
  })

  it('falls back to estimated when actual is null', () => {
    const result = computeMargin(
      new Prisma.Decimal(10000),
      null,
      new Prisma.Decimal(8000),
    )
    expect(result.margin).toBe(2000)
    expect(result.marginPercent).toBe(20)
  })

  it('returns full value as margin when both costs are null', () => {
    const result = computeMargin(
      new Prisma.Decimal(10000),
      null,
      null,
    )
    expect(result.margin).toBe(10000)
    expect(result.marginPercent).toBe(100)
  })
})
