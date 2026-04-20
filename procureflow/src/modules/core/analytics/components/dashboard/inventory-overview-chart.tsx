'use client'

import {
  Package,
  DollarSign,
  AlertTriangle,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type { InventoryDashboardStats } from '@/types'

interface InventoryOverviewChartProps {
  readonly stats: InventoryDashboardStats
}

const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const quantityFormatter = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 1,
})

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  readonly label: string
  readonly value: string
  readonly icon: typeof Package
  readonly trend?: { current: number; previous: number } | null
}) {
  const hasTrend = trend && trend.previous > 0
  const trendDirection = hasTrend
    ? trend.current > trend.previous
      ? 'up'
      : trend.current < trend.previous
        ? 'down'
        : 'flat'
    : null

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-4">
      <div className="flex items-center gap-2 text-pf-text-secondary">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-pf-text-primary">{value}</p>
        {trendDirection === 'up' && (
          <span className="inline-flex items-center gap-0.5 text-xs text-red-400">
            <TrendingUp className="h-3 w-3" />
          </span>
        )}
        {trendDirection === 'down' && (
          <span className="inline-flex items-center gap-0.5 text-xs text-green-400">
            <TrendingDown className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  )
}

function HorizontalBar({
  label,
  value,
  maxValue,
  color,
}: {
  readonly label: string
  readonly value: number
  readonly maxValue: number
  readonly color: string
}) {
  const widthPercent = maxValue > 0 ? (value / maxValue) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-right text-xs text-pf-text-secondary">
        {label}
      </span>
      <div className="flex-1">
        <div className="h-5 overflow-hidden rounded bg-pf-bg-tertiary">
          <div
            className={`h-full rounded transition-all duration-500 ${color}`}
            style={{ width: `${Math.max(widthPercent, 2)}%` }}
          />
        </div>
      </div>
      <span className="w-20 text-right text-xs font-medium text-pf-text-primary">
        {eurFormatter.format(value)}
      </span>
    </div>
  )
}

function MovementTrendBar({
  period,
  inbound,
  outbound,
  maxCount,
}: {
  readonly period: string
  readonly inbound: number
  readonly outbound: number
  readonly maxCount: number
}) {
  const inPercent = maxCount > 0 ? (inbound / maxCount) * 100 : 0
  const outPercent = maxCount > 0 ? (outbound / maxCount) * 100 : 0

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-24 w-full items-end justify-center gap-1">
        <div
          className="w-5 rounded-t bg-green-400 transition-all duration-500"
          style={{ height: `${Math.max(inPercent, 4)}%` }}
          title={`Carichi: ${inbound}`}
        />
        <div
          className="w-5 rounded-t bg-red-400 transition-all duration-500"
          style={{ height: `${Math.max(outPercent, 4)}%` }}
          title={`Scarichi: ${outbound}`}
        />
      </div>
      <span className="text-xs text-pf-text-secondary">{period}</span>
    </div>
  )
}

const CATEGORY_COLORS = [
  'bg-indigo-400',
  'bg-violet-400',
  'bg-pink-400',
  'bg-amber-400',
  'bg-green-400',
  'bg-blue-400',
  'bg-teal-400',
  'bg-orange-400',
]

export function InventoryOverviewChart({ stats }: InventoryOverviewChartProps) {
  const maxCategoryValue = Math.max(1, ...stats.valueByCategory.map((c) => c.value))
  const maxMovement = Math.max(
    1,
    ...stats.movementTrend.map((m) => Math.max(m.inbound, m.outbound)),
  )

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Articoli Attivi"
          value={String(stats.totalMaterials)}
          icon={Package}
        />
        <StatCard
          label="Valore Magazzino"
          value={eurFormatter.format(stats.totalWarehouseValue)}
          icon={DollarSign}
        />
        <StatCard
          label="Scorte Basse"
          value={String(stats.lowStockCount)}
          icon={AlertTriangle}
          trend={{
            current: stats.lowStockCount,
            previous: stats.lowStockCountPrevious,
          }}
        />
        <StatCard
          label="Movimenti 7gg"
          value={String(stats.recentMovements)}
          icon={ArrowLeftRight}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Value by Category */}
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-4">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Valore per Categoria
          </h3>
          {stats.valueByCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-pf-text-muted">
              Nessun dato disponibile
            </p>
          ) : (
            <div className="space-y-2">
              {stats.valueByCategory.slice(0, 8).map((cat, i) => (
                <HorizontalBar
                  key={cat.category}
                  label={cat.category}
                  value={cat.value}
                  maxValue={maxCategoryValue}
                  color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]!}
                />
              ))}
            </div>
          )}
        </div>

        {/* Movement Trend */}
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-4">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Trend Movimenti
          </h3>
          {stats.movementTrend.length === 0 ? (
            <p className="py-8 text-center text-sm text-pf-text-muted">
              Nessun dato disponibile
            </p>
          ) : (
            <div>
              <div className="flex items-end justify-around gap-2">
                {stats.movementTrend.map((m) => (
                  <MovementTrendBar
                    key={m.period}
                    period={m.period}
                    inbound={m.inbound}
                    outbound={m.outbound}
                    maxCount={maxMovement}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 text-xs text-pf-text-secondary">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-400" />
                  Carichi
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
                  Scarichi
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alerts */}
      {stats.lowStockAlerts.length > 0 && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-4">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Allarmi Scorte Basse
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pf-border">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                    Codice
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                    Nome
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                    Giacenza
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                    Livello Min.
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                    Deficit
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStockAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="border-b border-pf-border last:border-0"
                  >
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-pf-text-secondary">
                        {alert.code}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-pf-text-primary">
                      {alert.name}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-pf-text-primary">
                      {quantityFormatter.format(alert.currentStock)} {alert.unit}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-pf-text-secondary">
                      {quantityFormatter.format(alert.minLevel)} {alert.unit}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-red-400">
                      -{quantityFormatter.format(alert.deficit)} {alert.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
