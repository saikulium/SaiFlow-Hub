'use client'

import { useQuery } from '@tanstack/react-query'
import type { BudgetCheckResult } from '@/types'

/**
 * Live budget capacity check for the request form.
 * Fires only when both costCenter and amount are provided.
 */
export function useBudgetCheck(
  costCenter: string | undefined,
  amount: number | undefined,
) {
  return useQuery<BudgetCheckResult>({
    queryKey: ['budget-check', costCenter, amount],
    queryFn: async () => {
      const res = await fetch('/api/budgets/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost_center: costCenter, amount }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    enabled: !!costCenter && !!amount && amount > 0,
    staleTime: 10_000,
  })
}
