import { describe, it, expect } from 'vitest'
import {
  RECONCILIATION_THRESHOLDS,
  MATCHING_THRESHOLDS,
} from '@/lib/constants/sdi'
import { evaluateDiscrepancy } from '@/lib/constants/reconciliation-thresholds'

describe('RECONCILIATION_THRESHOLDS defaults', () => {
  it('AUTO_APPROVE_PERCENT is 2', () => {
    expect(RECONCILIATION_THRESHOLDS.AUTO_APPROVE_PERCENT).toBe(2)
  })

  it('WARNING_PERCENT is 5', () => {
    expect(RECONCILIATION_THRESHOLDS.WARNING_PERCENT).toBe(5)
  })
})

describe('MATCHING_THRESHOLDS defaults', () => {
  it('AUTO_MATCH_MIN_CONFIDENCE is 0.8', () => {
    expect(MATCHING_THRESHOLDS.AUTO_MATCH_MIN_CONFIDENCE).toBe(0.8)
  })

  it('AMOUNT_TOLERANCE_PERCENT is 10', () => {
    expect(MATCHING_THRESHOLDS.AMOUNT_TOLERANCE_PERCENT).toBe(10)
  })

  it('SEARCH_WINDOW_DAYS is 90', () => {
    expect(MATCHING_THRESHOLDS.SEARCH_WINDOW_DAYS).toBe(90)
  })
})

describe('evaluateDiscrepancy consistency with RECONCILIATION_THRESHOLDS', () => {
  it('returns PASS at exactly AUTO_APPROVE_PERCENT', () => {
    const threshold = RECONCILIATION_THRESHOLDS.AUTO_APPROVE_PERCENT
    expect(evaluateDiscrepancy(threshold)).toBe('PASS')
  })

  it('returns WARNING just above AUTO_APPROVE_PERCENT', () => {
    const threshold = RECONCILIATION_THRESHOLDS.AUTO_APPROVE_PERCENT
    expect(evaluateDiscrepancy(threshold + 0.01)).toBe('WARNING')
  })

  it('returns WARNING at exactly WARNING_PERCENT', () => {
    const threshold = RECONCILIATION_THRESHOLDS.WARNING_PERCENT
    expect(evaluateDiscrepancy(threshold)).toBe('WARNING')
  })

  it('returns FAIL just above WARNING_PERCENT', () => {
    const threshold = RECONCILIATION_THRESHOLDS.WARNING_PERCENT
    expect(evaluateDiscrepancy(threshold + 0.01)).toBe('FAIL')
  })

  it('boundaries are consistent: AUTO_APPROVE < WARNING', () => {
    expect(RECONCILIATION_THRESHOLDS.AUTO_APPROVE_PERCENT).toBeLessThan(
      RECONCILIATION_THRESHOLDS.WARNING_PERCENT,
    )
  })
})
