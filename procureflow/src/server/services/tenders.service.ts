import {
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  PIPELINE_STATUSES,
} from '@/lib/constants/tenders'
import type { GoNoGoScoreInput } from '@/types'

/**
 * Validates whether a status transition is allowed in the tender state machine.
 * Pure function — no side effects.
 */
export function validateStatusTransition(
  from: string,
  to: string,
): { valid: boolean; reason?: string } {
  const allowed = VALID_TRANSITIONS[from]

  if (!allowed) {
    return {
      valid: false,
      reason: `Stato "${from}" non riconosciuto nella macchina a stati delle gare.`,
    }
  }

  if (allowed.includes(to)) {
    return { valid: true }
  }

  const reason =
    allowed.length === 0
      ? `Dallo stato "${from}" non è possibile effettuare alcuna transizione (stato terminale).`
      : `Transizione da "${from}" a "${to}" non consentita. Transizioni valide: ${allowed.join(', ')}.`

  return { valid: false, reason }
}

/**
 * Computes a Go/No-Go aggregate score and recommendation.
 *
 * Thresholds:
 *   0–40  → NO_GO
 *   41–60 → VALUTARE
 *   61–100 → GO
 */
export function computeGoNoGoScore(
  scores: GoNoGoScoreInput,
): { totalScore: number; recommendation: 'GO' | 'VALUTARE' | 'NO_GO' } {
  const totalScore =
    scores.margin +
    scores.technical +
    scores.experience +
    scores.risk +
    scores.workload +
    scores.strategic

  const recommendation: 'GO' | 'VALUTARE' | 'NO_GO' =
    totalScore >= 61
      ? 'GO'
      : totalScore >= 41
        ? 'VALUTARE'
        : 'NO_GO'

  return { totalScore, recommendation }
}

/**
 * Generates a tender code in the format GARA-YYYY-NNNNN.
 */
export function generateTenderCode(year: number, sequenceNumber: number): string {
  const paddedSeq = String(sequenceNumber).padStart(5, '0')
  return `GARA-${year}-${paddedSeq}`
}

/**
 * Returns true if the given status is terminal (no outgoing transitions).
 */
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

/**
 * Returns true if the given status is part of the active pipeline.
 */
export function isPipelineStatus(status: string): boolean {
  return (PIPELINE_STATUSES as readonly string[]).includes(status)
}
