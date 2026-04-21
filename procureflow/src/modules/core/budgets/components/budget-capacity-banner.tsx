'use client'

import { useBudgetCheck } from '../hooks/use-budget-check'
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface BudgetCapacityBannerProps {
  costCenter: string | undefined
  amount: number | undefined
}

export function BudgetCapacityBanner({
  costCenter,
  amount,
}: BudgetCapacityBannerProps) {
  const { data, isLoading } = useBudgetCheck(costCenter, amount)

  if (!costCenter || !amount || amount <= 0) return null
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-xs text-pf-text-secondary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Verifica capienza budget...
      </div>
    )
  }
  if (!data || data.mode === 'NO_BUDGET') return null

  const worstCase = data.worstCase
  if (!worstCase) return null

  const isOver = worstCase.isOverBudget
  const isWarn = worstCase.isWarning && !isOver

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
        isOver && 'border-red-500/30 bg-red-500/10 text-red-400',
        isWarn && 'border-amber-500/30 bg-amber-500/10 text-amber-400',
        !isOver &&
          !isWarn &&
          'border-green-500/30 bg-green-500/10 text-green-400',
      )}
    >
      {isOver && <XCircle className="h-3.5 w-3.5 flex-shrink-0" />}
      {isWarn && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />}
      {!isOver && !isWarn && (
        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
      )}
      <span>
        {isOver &&
          `Sforamento: superato di ${formatCurrency(Math.abs(worstCase.available))}${worstCase.enforcementMode === 'HARD' ? ' — invio bloccato' : ''}`}
        {isWarn &&
          `Budget al ${worstCase.usagePercent}% — residuo: ${formatCurrency(worstCase.available)}`}
        {!isOver &&
          !isWarn &&
          `Budget disponibile: ${formatCurrency(worstCase.available)}`}
      </span>
    </div>
  )
}
