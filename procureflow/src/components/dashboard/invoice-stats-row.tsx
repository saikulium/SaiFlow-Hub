import {
  Receipt,
  AlertCircle,
  CheckCheck,
  AlertTriangle,
  CalendarClock,
  CreditCard,
} from 'lucide-react'
import { StatCard } from './stat-card'
import type { InvoiceStats } from '@/types'

interface InvoiceStatsRowProps {
  stats: InvoiceStats
}

export function InvoiceStatsRow({ stats }: InvoiceStatsRowProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Fatture Totali"
          value={stats.totalInvoices}
          icon={Receipt}
          iconColor="text-violet-400"
          index={0}
        />
        <StatCard
          title="Non Associate"
          value={stats.unmatchedInvoices}
          icon={AlertCircle}
          iconColor="text-amber-400"
          index={1}
          alert={stats.unmatchedInvoices > 0}
        />
        <StatCard
          title="Da Riconciliare"
          value={stats.pendingReconciliation}
          icon={CheckCheck}
          iconColor="text-blue-400"
          index={2}
        />
        <StatCard
          title="Importo Fatturato"
          value={stats.totalInvoicedAmount}
          format="currency"
          icon={Receipt}
          iconColor="text-emerald-400"
          index={3}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Discrepanze Aperte"
          value={stats.discrepanzeAperte}
          icon={AlertTriangle}
          iconColor="text-red-400"
          index={4}
          alert={stats.discrepanzeAperte > 0}
        />
        <StatCard
          title="Fatturato Mese"
          value={stats.totaleFatturatoMese}
          format="currency"
          icon={CalendarClock}
          iconColor="text-indigo-400"
          index={5}
        />
        <StatCard
          title="Totale da Pagare"
          value={stats.totaleDaPagare}
          format="currency"
          icon={CreditCard}
          iconColor="text-teal-400"
          index={6}
        />
      </div>
    </div>
  )
}
