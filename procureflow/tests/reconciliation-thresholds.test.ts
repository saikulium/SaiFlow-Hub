import { describe, it, expect } from 'vitest'
import { evaluateDiscrepancy } from '@/modules/core/invoicing'

describe('evaluateDiscrepancy', () => {
  describe('PASS results (at or below 2% threshold)', () => {
    it('returns PASS for 0% discrepancy', () => {
      expect(evaluateDiscrepancy(0)).toBe('PASS')
    })

    it('returns PASS for 1% discrepancy (below threshold)', () => {
      expect(evaluateDiscrepancy(1)).toBe('PASS')
    })

    it('returns PASS for 2% discrepancy (at boundary)', () => {
      expect(evaluateDiscrepancy(2)).toBe('PASS')
    })

    it('returns PASS for 1.99% discrepancy', () => {
      expect(evaluateDiscrepancy(1.99)).toBe('PASS')
    })
  })

  describe('WARNING results (above 2%, at or below 5%)', () => {
    it('returns WARNING for 3% discrepancy', () => {
      expect(evaluateDiscrepancy(3)).toBe('WARNING')
    })

    it('returns WARNING for 2.01% discrepancy (just above PASS)', () => {
      expect(evaluateDiscrepancy(2.01)).toBe('WARNING')
    })

    it('returns WARNING for 5% discrepancy (at warning boundary)', () => {
      expect(evaluateDiscrepancy(5)).toBe('WARNING')
    })

    it('returns WARNING for 4.5% discrepancy', () => {
      expect(evaluateDiscrepancy(4.5)).toBe('WARNING')
    })
  })

  describe('FAIL results (above 5%)', () => {
    it('returns FAIL for 6% discrepancy', () => {
      expect(evaluateDiscrepancy(6)).toBe('FAIL')
    })

    it('returns FAIL for 5.01% discrepancy (just above WARNING)', () => {
      expect(evaluateDiscrepancy(5.01)).toBe('FAIL')
    })

    it('returns FAIL for 15% discrepancy', () => {
      expect(evaluateDiscrepancy(15)).toBe('FAIL')
    })

    it('returns FAIL for 100% discrepancy', () => {
      expect(evaluateDiscrepancy(100)).toBe('FAIL')
    })
  })

  describe('negative values (uses absolute value internally)', () => {
    it('returns PASS for -1% discrepancy', () => {
      expect(evaluateDiscrepancy(-1)).toBe('PASS')
    })

    it('returns PASS for -2% discrepancy', () => {
      expect(evaluateDiscrepancy(-2)).toBe('PASS')
    })

    it('returns WARNING for -3% discrepancy', () => {
      expect(evaluateDiscrepancy(-3)).toBe('WARNING')
    })

    it('returns FAIL for -6% discrepancy', () => {
      expect(evaluateDiscrepancy(-6)).toBe('FAIL')
    })

    it('returns FAIL for -15% discrepancy', () => {
      expect(evaluateDiscrepancy(-15)).toBe('FAIL')
    })
  })
})
