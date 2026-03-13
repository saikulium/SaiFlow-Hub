'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PiggyBank, Search } from 'lucide-react'
import { useBudgets } from '@/hooks/use-budgets'
import { BudgetFormDialog } from '@/components/budgets/budget-form-dialog'
import { PageTransition } from '@/components/shared/page-transition'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { BUDGET_PERIOD_LABELS } from '@/lib/constants/budget'

export function BudgetsPageContent() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { data, isLoading } = useBudgets({ page, pageSize: 20, cost_center: search || undefined })

  const budgets = data?.data ?? []
  const total = data?.meta?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-pf-text-primary">
              Budget
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              Gestisci i plafond di spesa per centro di costo
            </p>
          </div>
          <BudgetFormDialog />
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cerca centro di costo..."
            className="w-full rounded-lg border border-pf-border bg-pf-bg-secondary py-2 pl-9 pr-3 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-card border border-pf-border bg-pf-bg-secondary">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pf-border text-left text-xs font-medium uppercase tracking-wider text-pf-text-muted">
                <th className="px-4 py-3">Centro di Costo</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3 text-right">Plafond</th>
                <th className="px-4 py-3 text-right">Speso</th>
                <th className="px-4 py-3 text-right">Impegnato</th>
                <th className="px-4 py-3 text-right">Residuo</th>
                <th className="px-4 py-3">Utilizzo</th>
                <th className="px-4 py-3">Enforcement</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-pf-border">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton-shimmer h-4 w-20 rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && budgets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-pf-text-secondary">
                    <PiggyBank className="mx-auto mb-3 h-10 w-10 text-pf-text-muted" />
                    <p>Nessun budget configurato</p>
                    <p className="mt-1 text-xs text-pf-text-muted">
                      Crea il primo budget per iniziare il controllo di spesa
                    </p>
                  </td>
                </tr>
              )}
              {budgets.map((b, i) => (
                <motion.tr
                  key={b.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => router.push(`/budgets/${b.id}`)}
                  className="cursor-pointer border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                >
                  <td className="px-4 py-3 font-medium text-pf-text-primary">
                    {b.costCenter}
                    {b.department && (
                      <span className="ml-2 text-xs text-pf-text-muted">{b.department}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-pf-text-secondary">
                    {BUDGET_PERIOD_LABELS[b.periodType] ?? b.periodType}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-pf-text-primary">
                    {formatCurrency(b.allocated)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-400">
                    {formatCurrency(b.spent)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-amber-400">
                    {formatCurrency(b.committed)}
                  </td>
                  <td className={cn(
                    'px-4 py-3 text-right font-mono',
                    b.available < 0 ? 'text-red-400' : 'text-pf-text-primary',
                  )}>
                    {formatCurrency(b.available)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-pf-bg-hover">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            b.isOverBudget ? 'bg-red-500' : b.isWarning ? 'bg-amber-500' : 'bg-green-500',
                          )}
                          style={{ width: `${Math.min(100, b.usagePercent)}%` }}
                        />
                      </div>
                      <span className="text-xs text-pf-text-muted">{b.usagePercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-medium',
                      b.enforcementMode === 'HARD'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-amber-500/10 text-amber-400',
                    )}>
                      {b.enforcementMode === 'HARD' ? 'Blocco' : 'Avviso'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-pf-text-muted">
              {total} budget totali
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-pf-border px-3 py-1 text-sm text-pf-text-secondary hover:bg-pf-bg-hover disabled:opacity-50"
              >
                Precedente
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-pf-border px-3 py-1 text-sm text-pf-text-secondary hover:bg-pf-bg-hover disabled:opacity-50"
              >
                Successivo
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
