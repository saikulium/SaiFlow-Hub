// ---------------------------------------------------------------------------
// Soglie per la riconciliazione three-way match
// ---------------------------------------------------------------------------

import { RECONCILIATION_THRESHOLDS } from './sdi'

/**
 * Valuta il risultato del three-way match in base alle soglie configurate.
 *
 * @param discrepancyPercent - Percentuale di discrepanza |fatturato - ordinato| / ordinato * 100
 * @returns 'PASS' | 'WARNING' | 'FAIL'
 */
export function evaluateDiscrepancy(
  discrepancyPercent: number,
): 'PASS' | 'WARNING' | 'FAIL' {
  const absPercent = Math.abs(discrepancyPercent)

  if (absPercent <= RECONCILIATION_THRESHOLDS.AUTO_APPROVE_PERCENT) {
    return 'PASS'
  }
  if (absPercent <= RECONCILIATION_THRESHOLDS.WARNING_PERCENT) {
    return 'WARNING'
  }
  return 'FAIL'
}
