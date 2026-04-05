import { PiggyBank, Receipt, Clock, Wallet, AlertTriangle } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { BudgetBarsChart } from '@/components/dashboard/budget-bars-chart'
import { BudgetTrendChart } from '@/components/dashboard/budget-trend-chart'
import type { BudgetDashboardStats } from '@/types'

interface BudgetOverviewProps {
  stats: BudgetDashboardStats
}

export function BudgetOverview({ stats }: BudgetOverviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Controllo Budget
          </h2>
          <p className="text-xs text-pf-text-secondary">
            {stats.centricostoSforati > 0 && (
              <span className="text-red-400">
                {stats.centricostoSforati} centro/i di costo sforati
              </span>
            )}
            {stats.centricostoSforati > 0 &&
              stats.centricostoInWarning > 0 &&
              ' · '}
            {stats.centricostoInWarning > 0 && (
              <span className="text-amber-400">
                {stats.centricostoInWarning} in zona allerta
              </span>
            )}
            {stats.centricostoSforati === 0 &&
              stats.centricostoInWarning === 0 && (
                <span>Tutti i centri di costo nei limiti</span>
              )}
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Plafond Totale"
          value={stats.totalAllocated}
          format="currency"
          icon={PiggyBank}
          iconColor="text-pf-accent"
          index={0}
        />
        <StatCard
          title="Speso"
          value={stats.totalSpent}
          format="currency"
          icon={Receipt}
          iconColor="text-green-400"
          index={1}
        />
        <StatCard
          title="Impegnato"
          value={stats.totalCommitted}
          format="currency"
          icon={Clock}
          iconColor="text-amber-400"
          index={2}
        />
        <StatCard
          title="Residuo"
          value={stats.totalAvailable}
          format="currency"
          icon={stats.totalAvailable < 0 ? AlertTriangle : Wallet}
          iconColor={
            stats.totalAvailable < 0 ? 'text-red-400' : 'text-pf-accent'
          }
          index={3}
          alert={stats.totalAvailable < 0}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <BudgetBarsChart budgets={stats.budgets} />
        <BudgetTrendChart budgets={stats.budgets} />
      </div>
    </div>
  )
}
