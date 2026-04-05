'use client'

import { ClipboardList, Clock, Wallet, AlertTriangle } from 'lucide-react'
import { StatCard } from './stat-card'
import type { DashboardStats } from '@/types'

export function StatsRow({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Richieste Attive"
        value={stats.activeRequests}
        previousValue={stats.previousActiveRequests}
        icon={ClipboardList}
        index={0}
      />
      <StatCard
        title="In Attesa di Approvazione"
        value={stats.pendingApprovals}
        previousValue={stats.previousPendingApprovals}
        icon={Clock}
        iconColor="text-pf-warning"
        index={1}
        alert={stats.pendingApprovals > 0}
      />
      <StatCard
        title="Budget Speso Mese"
        value={stats.monthlySpend}
        previousValue={stats.previousMonthlySpend}
        format="currency"
        icon={Wallet}
        index={2}
      />
      <StatCard
        title="Consegne in Ritardo"
        value={stats.overdueDeliveries}
        previousValue={stats.previousOverdueDeliveries}
        icon={AlertTriangle}
        iconColor="text-pf-danger"
        index={3}
        alert={stats.overdueDeliveries > 0}
      />
    </div>
  )
}
