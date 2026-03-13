import { describe, it, expect } from 'vitest'
import {
  computeAvailable,
  computeUsagePercent,
  isOverBudget,
  isWarning,
  computeBurnRate,
  projectSpend,
  computeExhaustionDate,
  resolveMostRestrictive,
  buildCheckResult,
} from '@/server/services/budget.service'
import type { BudgetCapacity } from '@/types'

describe('Budget capacity computation', () => {
  describe('computeAvailable', () => {
    it('returns allocated - spent - committed', () => {
      expect(computeAvailable(10000, 3000, 2000)).toBe(5000)
    })

    it('returns negative when over budget', () => {
      expect(computeAvailable(10000, 8000, 5000)).toBe(-3000)
    })

    it('handles zero allocated', () => {
      expect(computeAvailable(0, 0, 0)).toBe(0)
    })

    it('handles all spent', () => {
      expect(computeAvailable(10000, 10000, 0)).toBe(0)
    })
  })

  describe('computeUsagePercent', () => {
    it('returns percentage of allocated used', () => {
      expect(computeUsagePercent(10000, 3000, 2000)).toBe(50)
    })

    it('returns 0 when allocated is 0', () => {
      expect(computeUsagePercent(0, 0, 0)).toBe(0)
    })

    it('returns >100 when over budget', () => {
      expect(computeUsagePercent(10000, 8000, 5000)).toBe(130)
    })

    it('rounds to nearest integer', () => {
      expect(computeUsagePercent(3000, 1000, 0)).toBe(33)
    })
  })

  describe('isOverBudget', () => {
    it('returns true when available < 0', () => {
      expect(isOverBudget(-100)).toBe(true)
    })

    it('returns false when available >= 0', () => {
      expect(isOverBudget(0)).toBe(false)
      expect(isOverBudget(100)).toBe(false)
    })
  })

  describe('isWarning', () => {
    it('returns true when usage exceeds threshold', () => {
      expect(isWarning(85, 80)).toBe(true)
    })

    it('returns false when usage below threshold', () => {
      expect(isWarning(75, 80)).toBe(false)
    })

    it('returns true at exact threshold', () => {
      expect(isWarning(80, 80)).toBe(true)
    })
  })

  describe('resolveMostRestrictive', () => {
    it('returns the budget with least available', () => {
      const budgets: BudgetCapacity[] = [
        {
          budgetId: 'a', costCenter: 'CC-IT', department: null,
          periodType: 'MONTHLY', periodStart: '', periodEnd: '',
          allocated: 10000, spent: 3000, committed: 2000,
          available: 5000, usagePercent: 50,
          alertThreshold: 80, enforcementMode: 'SOFT',
          isOverBudget: false, isWarning: false,
        },
        {
          budgetId: 'b', costCenter: 'CC-IT', department: null,
          periodType: 'QUARTERLY', periodStart: '', periodEnd: '',
          allocated: 20000, spent: 15000, committed: 4000,
          available: 1000, usagePercent: 95,
          alertThreshold: 80, enforcementMode: 'HARD',
          isOverBudget: false, isWarning: true,
        },
      ]
      const result = resolveMostRestrictive(budgets)
      expect(result?.budgetId).toBe('b')
    })

    it('returns null for empty array', () => {
      expect(resolveMostRestrictive([])).toBeNull()
    })
  })

  describe('buildCheckResult', () => {
    it('allows when no budgets exist', () => {
      const result = buildCheckResult([], 1000)
      expect(result.allowed).toBe(true)
      expect(result.mode).toBe('NO_BUDGET')
    })

    it('allows SOFT mode even when over budget', () => {
      const budgets: BudgetCapacity[] = [{
        budgetId: 'a', costCenter: 'CC-IT', department: null,
        periodType: 'MONTHLY', periodStart: '', periodEnd: '',
        allocated: 10000, spent: 8000, committed: 3000,
        available: -1000, usagePercent: 110,
        alertThreshold: 80, enforcementMode: 'SOFT',
        isOverBudget: true, isWarning: true,
      }]
      const result = buildCheckResult(budgets, 1000)
      expect(result.allowed).toBe(true)
      expect(result.mode).toBe('SOFT')
    })

    it('blocks HARD mode when over budget', () => {
      const budgets: BudgetCapacity[] = [{
        budgetId: 'a', costCenter: 'CC-IT', department: null,
        periodType: 'MONTHLY', periodStart: '', periodEnd: '',
        allocated: 10000, spent: 8000, committed: 3000,
        available: -1000, usagePercent: 110,
        alertThreshold: 80, enforcementMode: 'HARD',
        isOverBudget: true, isWarning: true,
      }]
      const result = buildCheckResult(budgets, 1000)
      expect(result.allowed).toBe(false)
      expect(result.mode).toBe('HARD')
    })

    it('allows within budget with no warning', () => {
      const budgets: BudgetCapacity[] = [{
        budgetId: 'a', costCenter: 'CC-IT', department: null,
        periodType: 'MONTHLY', periodStart: '', periodEnd: '',
        allocated: 10000, spent: 3000, committed: 2000,
        available: 5000, usagePercent: 50,
        alertThreshold: 80, enforcementMode: 'SOFT',
        isOverBudget: false, isWarning: false,
      }]
      const result = buildCheckResult(budgets, 1000)
      expect(result.allowed).toBe(true)
      expect(result.message).toContain('disponibile')
    })
  })
})

describe('Budget forecast computation', () => {
  describe('computeBurnRate', () => {
    it('returns daily burn rate', () => {
      expect(computeBurnRate(3000, 30)).toBe(100)
    })

    it('returns 0 when no days elapsed', () => {
      expect(computeBurnRate(0, 0)).toBe(0)
    })
  })

  describe('projectSpend', () => {
    it('projects total spend at end of period', () => {
      expect(projectSpend(100, 60, 3000)).toBe(9000)
    })
  })

  describe('computeExhaustionDate', () => {
    it('returns date when budget will be exhausted', () => {
      const start = new Date('2026-01-01')
      const result = computeExhaustionDate(10000, 5000, 200, start, 10)
      expect(result).not.toBeNull()
      expect(result).toBeInstanceOf(Date)
    })

    it('returns null when burn rate is 0', () => {
      const start = new Date('2026-01-01')
      expect(computeExhaustionDate(10000, 0, 0, start, 0)).toBeNull()
    })

    it('returns today when already exhausted', () => {
      const start = new Date('2026-01-01')
      const result = computeExhaustionDate(10000, 15000, 200, start, 10)
      expect(result).not.toBeNull()
    })

    it('returns null when budget wont exhaust within 365 days', () => {
      const start = new Date('2026-01-01')
      expect(computeExhaustionDate(1000000, 100, 1, start, 10)).toBeNull()
    })
  })
})
