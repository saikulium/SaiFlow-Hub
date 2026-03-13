'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, PiggyBank, Receipt, Clock, Wallet, TrendingUp } from 'lucide-react'
import { useBudget } from '@/hooks/use-budgets'
import { PageTransition } from '@/components/shared/page-transition'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { BUDGET_PERIOD_LABELS, BUDGET_ENFORCEMENT_LABELS } from '@/lib/constants/budget'

interface BudgetDetailContentProps {
  id: string
}

export function BudgetDetailContent({ id }: BudgetDetailContentProps) {
  const router = useRouter()
  const { data: budget, isLoading, error } = useBudget(id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton-shimmer h-8 w-64 rounded" />
        <div className="skeleton-shimmer h-48 rounded-card" />
        <div className="skeleton-shimmer h-96 rounded-card" />
      </div>
    )
  }

  if (error || !budget) {
    return (
      <div className="py-12 text-center text-pf-text-secondary">
        Budget non trovato
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/budgets')}
            className="rounded-lg p-2 text-pf-text-secondary hover:bg-pf-bg-hover"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-pf-text-primary">
              {budget.costCenter}
            </h1>
            <p className="text-sm text-pf-text-secondary">
              {budget.department && `${budget.department} · `}
              {BUDGET_PERIOD_LABELS[budget.periodType]} ·{' '}
              {new Date(budget.periodStart).toLocaleDateString('it-IT')} →{' '}
              {new Date(budget.periodEnd).toLocaleDateString('it-IT')}
            </p>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-pf-text-primary">Utilizzo Budget</span>
            <span className={cn(
              'text-sm font-bold',
              budget.isOverBudget ? 'text-red-400' : budget.isWarning ? 'text-amber-400' : 'text-green-400',
            )}>
              {budget.usagePercent}%
            </span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-pf-bg-hover">
            <div className="flex h-full">
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${Math.min(100, (budget.spent / budget.allocated) * 100)}%` }}
              />
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${Math.min(100 - (budget.spent / budget.allocated) * 100, (budget.committed / budget.allocated) * 100)}%` }}
              />
            </div>
          </div>
          <div className="mt-2 flex justify-between text-xs text-pf-text-muted">
            <span>Speso: {formatCurrency(budget.spent)}</span>
            <span>Impegnato: {formatCurrency(budget.committed)}</span>
            <span>Plafond: {formatCurrency(budget.allocated)}</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Plafond', value: budget.allocated, icon: PiggyBank, color: 'text-pf-accent' },
            { title: 'Speso', value: budget.spent, icon: Receipt, color: 'text-green-400' },
            { title: 'Impegnato', value: budget.committed, icon: Clock, color: 'text-amber-400' },
            { title: 'Residuo', value: budget.available, icon: Wallet, color: budget.available < 0 ? 'text-red-400' : 'text-pf-accent' },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-card border border-pf-border bg-pf-bg-secondary p-4"
            >
              <div className="flex items-center gap-2">
                <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                <span className="text-xs text-pf-text-secondary">{kpi.title}</span>
              </div>
              <p className={cn(
                'mt-2 font-display text-xl font-bold',
                kpi.title === 'Residuo' && kpi.value < 0 ? 'text-red-400' : 'text-pf-text-primary',
              )}>
                {formatCurrency(kpi.value)}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Forecast */}
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-pf-accent" />
            <h3 className="text-sm font-medium text-pf-text-primary">Previsione</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-pf-text-muted">Burn rate giornaliero</p>
              <p className="mt-1 font-mono text-sm text-pf-text-primary">
                {formatCurrency(budget.forecast.dailyBurnRate)}/giorno
              </p>
            </div>
            <div>
              <p className="text-xs text-pf-text-muted">Spesa prevista a fine periodo</p>
              <p className={cn(
                'mt-1 font-mono text-sm',
                budget.forecast.residualAtPeriodEnd < 0 ? 'text-red-400' : 'text-pf-text-primary',
              )}>
                {formatCurrency(budget.forecast.projectedSpendAtPeriodEnd)}
              </p>
            </div>
            <div>
              <p className="text-xs text-pf-text-muted">
                {budget.forecast.residualAtPeriodEnd < 0 ? 'Sforamento previsto' : 'Residuo previsto'}
              </p>
              <p className={cn(
                'mt-1 font-mono text-sm',
                budget.forecast.residualAtPeriodEnd < 0 ? 'text-red-400' : 'text-green-400',
              )}>
                {formatCurrency(Math.abs(budget.forecast.residualAtPeriodEnd))}
                {budget.forecast.exhaustionDate && (
                  <span className="ml-2 text-xs text-pf-text-muted">
                    (esaurimento: {new Date(budget.forecast.exhaustionDate).toLocaleDateString('it-IT')})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Config */}
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
          <h3 className="mb-3 text-sm font-medium text-pf-text-primary">Configurazione</h3>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-pf-text-muted">Enforcement</p>
              <p className="mt-1 text-pf-text-primary">
                {BUDGET_ENFORCEMENT_LABELS[budget.enforcementMode]}
              </p>
            </div>
            <div>
              <p className="text-xs text-pf-text-muted">Soglia allerta</p>
              <p className="mt-1 text-pf-text-primary">{budget.alertThreshold}%</p>
            </div>
            <div>
              <p className="text-xs text-pf-text-muted">Stato</p>
              <p className="mt-1 text-pf-text-primary">
                {budget.isActive ? 'Attivo' : 'Disattivato'}
              </p>
            </div>
          </div>
          {budget.notes && (
            <div className="mt-3 border-t border-pf-border pt-3">
              <p className="text-xs text-pf-text-muted">Note</p>
              <p className="mt-1 text-sm text-pf-text-secondary">{budget.notes}</p>
            </div>
          )}
        </div>

        {/* Request tables */}
        {budget.spentRequests.length > 0 && (
          <RequestTable
            title="Richieste Fatturate (Speso)"
            requests={budget.spentRequests}
            colorClass="text-green-400"
          />
        )}
        {budget.committedRequests.length > 0 && (
          <RequestTable
            title="Richieste in Pipeline (Impegnato)"
            requests={budget.committedRequests}
            colorClass="text-amber-400"
          />
        )}
      </div>
    </PageTransition>
  )
}

function RequestTable({
  title,
  requests,
  colorClass,
}: {
  title: string
  requests: { id: string; code: string; title: string; amount: number; status: string }[]
  colorClass: string
}) {
  const router = useRouter()

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h3 className="mb-3 text-sm font-medium text-pf-text-primary">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pf-border text-left text-xs font-medium uppercase tracking-wider text-pf-text-muted">
              <th className="px-3 py-2">Codice</th>
              <th className="px-3 py-2">Titolo</th>
              <th className="px-3 py-2">Stato</th>
              <th className="px-3 py-2 text-right">Importo</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/requests/${r.id}`)}
                className="cursor-pointer border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
              >
                <td className="px-3 py-2 font-mono text-xs text-pf-accent">{r.code}</td>
                <td className="px-3 py-2 text-pf-text-primary">{r.title}</td>
                <td className="px-3 py-2 text-xs text-pf-text-secondary">{r.status}</td>
                <td className={cn('px-3 py-2 text-right font-mono', colorClass)}>
                  {formatCurrency(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
