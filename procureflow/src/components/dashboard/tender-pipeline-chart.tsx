'use client'

import { Gavel, TrendingUp, Clock, Trophy } from 'lucide-react'
import { TENDER_STATUS_CONFIG } from '@/lib/constants/tenders'
import { TenderStatusBadge } from '@/components/tenders/tender-status-badge'
import type { TenderDashboardStats } from '@/types'

interface TenderPipelineChartProps {
  readonly stats: TenderDashboardStats
}

const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  readonly label: string
  readonly value: string
  readonly icon: typeof Gavel
}) {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-4">
      <div className="flex items-center gap-2 text-pf-text-secondary">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-pf-text-primary">{value}</p>
    </div>
  )
}

function PipelineBar({
  label,
  count,
  maxCount,
  color,
}: {
  readonly label: string
  readonly count: number
  readonly maxCount: number
  readonly color: string
}) {
  const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-right text-xs text-pf-text-secondary">
        {label}
      </span>
      <div className="flex-1">
        <div className="h-6 overflow-hidden rounded bg-pf-bg-tertiary">
          <div
            className={`h-full rounded transition-all duration-500 ${color}`}
            style={{ width: `${Math.max(widthPercent, 2)}%` }}
          />
        </div>
      </div>
      <span className="w-8 text-right text-sm font-medium text-pf-text-primary">
        {count}
      </span>
    </div>
  )
}

/** Map tender status to a Tailwind bg color for the bar */
function statusToBgColor(status: string): string {
  const colorMap: Record<string, string> = {
    DISCOVERED: 'bg-zinc-400',
    EVALUATING: 'bg-amber-400',
    GO: 'bg-green-400',
    NO_GO: 'bg-red-400',
    PREPARING: 'bg-blue-400',
    SUBMITTED: 'bg-indigo-400',
    UNDER_EVALUATION: 'bg-purple-400',
    WON: 'bg-emerald-400',
    LOST: 'bg-red-400',
    AWARDED: 'bg-teal-400',
    CANCELLED: 'bg-zinc-400',
    WITHDRAWN: 'bg-orange-400',
  }
  return colorMap[status] ?? 'bg-zinc-400'
}

export function TenderPipelineChart({ stats }: TenderPipelineChartProps) {
  const maxCount = Math.max(1, ...stats.byStatus.map((s) => s.count))

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gare Attive"
          value={String(stats.activeTenders)}
          icon={Gavel}
        />
        <StatCard
          label="Pipeline Totale"
          value={eurFormatter.format(stats.pipelineValue)}
          icon={TrendingUp}
        />
        <StatCard
          label="Scadenze Imminenti"
          value={String(stats.upcomingDeadlines)}
          icon={Clock}
        />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(0)}%`}
          icon={Trophy}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline by Status */}
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-4">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Pipeline per Stato
          </h3>
          {stats.byStatus.length === 0 ? (
            <p className="py-8 text-center text-sm text-pf-text-muted">
              Nessuna gara presente
            </p>
          ) : (
            <div className="space-y-2">
              {stats.byStatus.map((item) => {
                const config = TENDER_STATUS_CONFIG[item.status]
                return (
                  <PipelineBar
                    key={item.status}
                    label={config?.label ?? item.status}
                    count={item.count}
                    maxCount={maxCount}
                    color={statusToBgColor(item.status)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-4">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Prossime Scadenze
          </h3>
          {stats.nearDeadlines.length === 0 ? (
            <p className="py-8 text-center text-sm text-pf-text-muted">
              Nessuna scadenza imminente
            </p>
          ) : (
            <div className="divide-y divide-pf-border">
              {stats.nearDeadlines.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-pf-text-muted">
                        {item.code}
                      </span>
                      <TenderStatusBadge status={item.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium text-pf-text-primary">
                      {item.title}
                    </p>
                    {item.authority && (
                      <p className="truncate text-xs text-pf-text-secondary">
                        {item.authority}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`text-sm font-semibold ${
                        item.daysRemaining <= 3
                          ? 'text-red-400'
                          : item.daysRemaining <= 7
                            ? 'text-amber-400'
                            : 'text-pf-text-primary'
                      }`}
                    >
                      {item.daysRemaining <= 0
                        ? 'Scaduta'
                        : item.daysRemaining === 1
                          ? '1 giorno'
                          : `${item.daysRemaining} giorni`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
