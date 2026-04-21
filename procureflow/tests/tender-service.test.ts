import { describe, it, expect } from 'vitest'
import {
  validateStatusTransition,
  computeGoNoGoScore,
  generateTenderCode,
  isTerminalStatus,
  isPipelineStatus,
} from '@/modules/core/tenders'
import type { GoNoGoScoreInput } from '@/types'

// ---------------------------------------------------------------------------
// validateStatusTransition
// ---------------------------------------------------------------------------
describe('validateStatusTransition', () => {
  describe('valid transitions through main lifecycle', () => {
    const lifecycle: [string, string][] = [
      ['DISCOVERED', 'EVALUATING'],
      ['EVALUATING', 'GO'],
      ['GO', 'PREPARING'],
      ['PREPARING', 'SUBMITTED'],
      ['SUBMITTED', 'UNDER_EVALUATION'],
      ['UNDER_EVALUATION', 'WON'],
      ['WON', 'AWARDED'],
    ]

    it.each(lifecycle)('%s -> %s is valid', (from, to) => {
      const result = validateStatusTransition(from, to)
      expect(result).toEqual({ valid: true })
    })
  })

  describe('alternative valid paths', () => {
    it('EVALUATING -> NO_GO is valid', () => {
      expect(validateStatusTransition('EVALUATING', 'NO_GO')).toEqual({
        valid: true,
      })
    })

    it('UNDER_EVALUATION -> LOST is valid', () => {
      expect(validateStatusTransition('UNDER_EVALUATION', 'LOST')).toEqual({
        valid: true,
      })
    })
  })

  describe('cancellation and withdrawal from active states', () => {
    const cancellable = [
      'DISCOVERED',
      'EVALUATING',
      'GO',
      'PREPARING',
      'SUBMITTED',
      'UNDER_EVALUATION',
      'WON',
    ]

    it.each(cancellable)('%s -> CANCELLED is valid', (from) => {
      expect(validateStatusTransition(from, 'CANCELLED')).toEqual({
        valid: true,
      })
    })

    const withdrawable = [
      'DISCOVERED',
      'EVALUATING',
      'GO',
      'PREPARING',
      'SUBMITTED',
    ]

    it.each(withdrawable)('%s -> WITHDRAWN is valid', (from) => {
      expect(validateStatusTransition(from, 'WITHDRAWN')).toEqual({
        valid: true,
      })
    })
  })

  describe('terminal states have no valid transitions', () => {
    const terminals = ['NO_GO', 'LOST', 'AWARDED', 'CANCELLED', 'WITHDRAWN']

    it.each(terminals)('%s has no outgoing transitions', (status) => {
      const result = validateStatusTransition(status, 'DISCOVERED')
      expect(result.valid).toBe(false)
      expect(result.reason).toBeDefined()
    })
  })

  describe('invalid transitions return reason with allowed targets', () => {
    it('DISCOVERED -> SUBMITTED is invalid and reason lists allowed targets', () => {
      const result = validateStatusTransition('DISCOVERED', 'SUBMITTED')
      expect(result.valid).toBe(false)
      expect(result.reason).toBeDefined()
      expect(result.reason).toContain('EVALUATING')
      expect(result.reason).toContain('CANCELLED')
      expect(result.reason).toContain('WITHDRAWN')
    })

    it('GO -> WON is invalid and reason lists PREPARING', () => {
      const result = validateStatusTransition('GO', 'WON')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('PREPARING')
    })

    it('terminal state reason mentions no transitions available', () => {
      const result = validateStatusTransition('LOST', 'DISCOVERED')
      expect(result.valid).toBe(false)
      expect(result.reason).toBeDefined()
      // Should mention it's a terminal state or has no valid transitions
      expect(result.reason!.length).toBeGreaterThan(0)
    })
  })
})

// ---------------------------------------------------------------------------
// computeGoNoGoScore
// ---------------------------------------------------------------------------
describe('computeGoNoGoScore', () => {
  const zeros: GoNoGoScoreInput = {
    margin: 0,
    technical: 0,
    experience: 0,
    risk: 0,
    workload: 0,
    strategic: 0,
  }

  const maxScores: GoNoGoScoreInput = {
    margin: 25,
    technical: 25,
    experience: 15,
    risk: 15,
    workload: 10,
    strategic: 10,
  }

  it('all zeros → score 0, recommendation NO_GO', () => {
    const result = computeGoNoGoScore(zeros)
    expect(result.totalScore).toBe(0)
    expect(result.recommendation).toBe('NO_GO')
  })

  it('all max → score 100, recommendation GO', () => {
    const result = computeGoNoGoScore(maxScores)
    expect(result.totalScore).toBe(100)
    expect(result.recommendation).toBe('GO')
  })

  it('score 40 → NO_GO', () => {
    const scores: GoNoGoScoreInput = {
      margin: 20,
      technical: 10,
      experience: 5,
      risk: 5,
      workload: 0,
      strategic: 0,
    }
    const result = computeGoNoGoScore(scores)
    expect(result.totalScore).toBe(40)
    expect(result.recommendation).toBe('NO_GO')
  })

  it('score 41 → VALUTARE', () => {
    const scores: GoNoGoScoreInput = {
      margin: 20,
      technical: 10,
      experience: 5,
      risk: 5,
      workload: 1,
      strategic: 0,
    }
    const result = computeGoNoGoScore(scores)
    expect(result.totalScore).toBe(41)
    expect(result.recommendation).toBe('VALUTARE')
  })

  it('score 60 → VALUTARE', () => {
    const scores: GoNoGoScoreInput = {
      margin: 25,
      technical: 20,
      experience: 10,
      risk: 5,
      workload: 0,
      strategic: 0,
    }
    const result = computeGoNoGoScore(scores)
    expect(result.totalScore).toBe(60)
    expect(result.recommendation).toBe('VALUTARE')
  })

  it('score 61 → GO', () => {
    const scores: GoNoGoScoreInput = {
      margin: 25,
      technical: 20,
      experience: 10,
      risk: 5,
      workload: 1,
      strategic: 0,
    }
    const result = computeGoNoGoScore(scores)
    expect(result.totalScore).toBe(61)
    expect(result.recommendation).toBe('GO')
  })
})

// ---------------------------------------------------------------------------
// generateTenderCode
// ---------------------------------------------------------------------------
describe('generateTenderCode', () => {
  it('standard case: year 2026, seq 1 → "GARA-2026-00001"', () => {
    expect(generateTenderCode(2026, 1)).toBe('GARA-2026-00001')
  })

  it('pads sequence to 5 digits: seq 999 → "GARA-2026-00999"', () => {
    expect(generateTenderCode(2026, 999)).toBe('GARA-2026-00999')
  })

  it('max 5 digits: seq 99999 → "GARA-2026-99999"', () => {
    expect(generateTenderCode(2026, 99999)).toBe('GARA-2026-99999')
  })

  it('different year: 2025, seq 42 → "GARA-2025-00042"', () => {
    expect(generateTenderCode(2025, 42)).toBe('GARA-2025-00042')
  })
})

// ---------------------------------------------------------------------------
// isTerminalStatus
// ---------------------------------------------------------------------------
describe('isTerminalStatus', () => {
  const terminals = ['NO_GO', 'LOST', 'AWARDED', 'CANCELLED', 'WITHDRAWN']

  it.each(terminals)('%s is terminal', (status) => {
    expect(isTerminalStatus(status)).toBe(true)
  })

  const nonTerminals = [
    'DISCOVERED',
    'EVALUATING',
    'GO',
    'PREPARING',
    'SUBMITTED',
    'UNDER_EVALUATION',
    'WON',
  ]

  it.each(nonTerminals)('%s is NOT terminal', (status) => {
    expect(isTerminalStatus(status)).toBe(false)
  })

  it('unknown status is NOT terminal', () => {
    expect(isTerminalStatus('UNKNOWN')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isPipelineStatus
// ---------------------------------------------------------------------------
describe('isPipelineStatus', () => {
  const pipeline = ['GO', 'PREPARING', 'SUBMITTED', 'UNDER_EVALUATION']

  it.each(pipeline)('%s is a pipeline status', (status) => {
    expect(isPipelineStatus(status)).toBe(true)
  })

  const nonPipeline = [
    'DISCOVERED',
    'EVALUATING',
    'NO_GO',
    'WON',
    'LOST',
    'AWARDED',
    'CANCELLED',
    'WITHDRAWN',
  ]

  it.each(nonPipeline)('%s is NOT a pipeline status', (status) => {
    expect(isPipelineStatus(status)).toBe(false)
  })

  it('unknown status is NOT pipeline', () => {
    expect(isPipelineStatus('UNKNOWN')).toBe(false)
  })
})
