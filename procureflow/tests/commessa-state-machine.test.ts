import { describe, it, expect } from 'vitest'
import {
  canCommessaTransition,
  assertCommessaTransition,
  CommessaTransitionError,
} from '@/modules/core/commesse'
import type { CommessaStatus } from '@prisma/client'

const s = (v: string) => v as CommessaStatus

describe('canCommessaTransition', () => {
  it.each([
    ['DRAFT', 'PLANNING'],
    ['DRAFT', 'CANCELLED'],
    ['PLANNING', 'ACTIVE'],
    ['PLANNING', 'ON_HOLD'],
    ['ACTIVE', 'COMPLETED'],
    ['ACTIVE', 'ON_HOLD'],
    ['ON_HOLD', 'PLANNING'],
    ['ON_HOLD', 'ACTIVE'],
  ])('%s -> %s is valid', (from, to) => {
    expect(canCommessaTransition(s(from), s(to))).toBe(true)
  })

  it.each([
    ['DRAFT', 'COMPLETED'],
    ['DRAFT', 'ACTIVE'],
    ['COMPLETED', 'DRAFT'],
    ['CANCELLED', 'ACTIVE'],
    ['ACTIVE', 'DRAFT'],
  ])('%s -> %s is invalid', (from, to) => {
    expect(canCommessaTransition(s(from), s(to))).toBe(false)
  })

  it('assertCommessaTransition throws for invalid transition', () => {
    expect(() => assertCommessaTransition(s('DRAFT'), s('COMPLETED'))).toThrow(
      CommessaTransitionError,
    )
  })
})
