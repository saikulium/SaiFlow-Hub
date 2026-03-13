import { describe, it, expect } from 'vitest'
import {
  VALID_TRANSITIONS,
  canTransition,
  assertTransition,
  TransitionError,
} from '@/lib/state-machine'

// Define status values as string constants to avoid Prisma runtime dependency
const STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'ORDERED',
  'SHIPPED',
  'DELIVERED',
  'INVOICED',
  'RECONCILED',
  'CLOSED',
  'CANCELLED',
  'ON_HOLD',
] as const

type RequestStatus = (typeof STATUSES)[number]

// Helper to cast string to RequestStatus for test calls
const s = (v: string) => v as RequestStatus

describe('canTransition', () => {
  describe('valid transitions through full lifecycle', () => {
    const lifecycle: [string, string][] = [
      ['DRAFT', 'SUBMITTED'],
      ['SUBMITTED', 'PENDING_APPROVAL'],
      ['PENDING_APPROVAL', 'APPROVED'],
      ['APPROVED', 'ORDERED'],
      ['ORDERED', 'SHIPPED'],
      ['SHIPPED', 'DELIVERED'],
      ['DELIVERED', 'INVOICED'],
      ['INVOICED', 'RECONCILED'],
      ['RECONCILED', 'CLOSED'],
    ]

    it.each(lifecycle)(
      '%s -> %s is a valid transition',
      (from, to) => {
        expect(canTransition(s(from), s(to))).toBe(true)
      },
    )
  })

  describe('all valid transitions from each status', () => {
    const allValid: [string, string[]][] = [
      ['DRAFT', ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED']],
      ['SUBMITTED', ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED']],
      ['PENDING_APPROVAL', ['APPROVED', 'REJECTED', 'ON_HOLD']],
      ['APPROVED', ['ORDERED', 'CANCELLED']],
      ['REJECTED', ['DRAFT']],
      ['ORDERED', ['SHIPPED', 'CANCELLED', 'ON_HOLD']],
      ['SHIPPED', ['DELIVERED', 'ON_HOLD']],
      ['DELIVERED', ['INVOICED', 'CLOSED']],
      ['INVOICED', ['RECONCILED', 'CLOSED', 'ON_HOLD']],
      ['RECONCILED', ['CLOSED']],
      ['CLOSED', []],
      ['CANCELLED', ['DRAFT']],
      ['ON_HOLD', ['PENDING_APPROVAL', 'ORDERED', 'SHIPPED', 'INVOICED']],
    ]

    it.each(allValid)(
      'from %s: all declared targets return true',
      (from, targets) => {
        for (const to of targets) {
          expect(canTransition(s(from), s(to))).toBe(true)
        }
      },
    )
  })

  it('CANCELLED -> DRAFT is valid (reset)', () => {
    expect(canTransition(s('CANCELLED'), s('DRAFT'))).toBe(true)
  })

  it('REJECTED -> DRAFT is valid', () => {
    expect(canTransition(s('REJECTED'), s('DRAFT'))).toBe(true)
  })

  describe('ON_HOLD can return to expected states', () => {
    const onHoldTargets = ['PENDING_APPROVAL', 'ORDERED', 'SHIPPED', 'INVOICED']

    it.each(onHoldTargets)(
      'ON_HOLD -> %s is valid',
      (to) => {
        expect(canTransition(s('ON_HOLD'), s(to))).toBe(true)
      },
    )
  })

  it('CLOSED has no valid transitions (terminal state)', () => {
    for (const status of STATUSES) {
      expect(canTransition(s('CLOSED'), s(status))).toBe(false)
    }
  })

  describe('invalid transitions return false', () => {
    const invalid: [string, string][] = [
      ['DRAFT', 'DELIVERED'],
      ['DRAFT', 'SHIPPED'],
      ['APPROVED', 'DRAFT'],
      ['CLOSED', 'DRAFT'],
      ['CLOSED', 'SUBMITTED'],
      ['DELIVERED', 'DRAFT'],
      ['SHIPPED', 'APPROVED'],
      ['RECONCILED', 'DRAFT'],
      ['ORDERED', 'APPROVED'],
    ]

    it.each(invalid)(
      '%s -> %s is invalid',
      (from, to) => {
        expect(canTransition(s(from), s(to))).toBe(false)
      },
    )
  })
})

describe('assertTransition', () => {
  it('does not throw for valid transitions', () => {
    expect(() => assertTransition(s('DRAFT'), s('SUBMITTED'))).not.toThrow()
    expect(() => assertTransition(s('APPROVED'), s('ORDERED'))).not.toThrow()
    expect(() => assertTransition(s('RECONCILED'), s('CLOSED'))).not.toThrow()
  })

  it('throws TransitionError for invalid transitions', () => {
    expect(() => assertTransition(s('DRAFT'), s('DELIVERED'))).toThrow(
      TransitionError,
    )
    expect(() => assertTransition(s('CLOSED'), s('DRAFT'))).toThrow(
      TransitionError,
    )
  })

  it('TransitionError has correct from/to properties', () => {
    try {
      assertTransition(s('DRAFT'), s('DELIVERED'))
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(TransitionError)
      const te = err as TransitionError
      expect(te.from).toBe('DRAFT')
      expect(te.to).toBe('DELIVERED')
    }
  })

  it('error message includes allowed states', () => {
    try {
      assertTransition(s('DRAFT'), s('DELIVERED'))
      expect.fail('Should have thrown')
    } catch (err) {
      const te = err as TransitionError
      expect(te.message).toContain('SUBMITTED')
      expect(te.message).toContain('PENDING_APPROVAL')
      expect(te.message).toContain('APPROVED')
      expect(te.message).toContain('CANCELLED')
    }
  })

  it('error message for terminal state mentions "nessuno"', () => {
    try {
      assertTransition(s('CLOSED'), s('DRAFT'))
      expect.fail('Should have thrown')
    } catch (err) {
      const te = err as TransitionError
      expect(te.message).toContain('nessuno (stato terminale)')
    }
  })
})

describe('VALID_TRANSITIONS', () => {
  it('contains all 13 RequestStatus values as keys', () => {
    const keys = Object.keys(VALID_TRANSITIONS)
    expect(keys).toHaveLength(13)

    for (const status of STATUSES) {
      expect(keys).toContain(status)
    }
  })

  it('every transition target is also a valid status key', () => {
    const keys = new Set(Object.keys(VALID_TRANSITIONS))
    for (const [_from, targets] of Object.entries(VALID_TRANSITIONS)) {
      for (const target of targets) {
        expect(keys.has(target)).toBe(true)
      }
    }
  })
})
