'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Area,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { BudgetDashboardItem } from '@/types'

interface BudgetTrendChartProps {
  budgets: BudgetDashboardItem[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-pf-border bg-pf-bg-secondary px-3 py-2 shadow-lg">
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs text-pf-text-secondary">
          <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function BudgetTrendChart({ budgets }: BudgetTrendChartProps) {
  const [selected, setSelected] = useState(0)

  const budget = budgets[selected]
  if (!budget) return null

  const data = useMemo(() => {
    const periodStart = new Date(budget.forecast.costCenter ? budget.forecast.budgetId : Date.now())
    // Simple projection: current spend distributed linearly
    const daysTotal = budget.forecast.daysRemaining + (budget.forecast.dailyBurnRate > 0
      ? Math.round(budget.spent / budget.forecast.dailyBurnRate)
      : 30)
    const daysElapsed = daysTotal - budget.forecast.daysRemaining
    const points = []

    for (let d = 0; d <= daysTotal; d += Math.max(1, Math.floor(daysTotal / 15))) {
      const isProjection = d > daysElapsed
      const cumulativeSpend = d <= daysElapsed
        ? (budget.spent + budget.committed) * (d / Math.max(1, daysElapsed))
        : budget.spent + budget.committed + budget.forecast.dailyBurnRate * (d - daysElapsed)

      points.push({
        day: `G${d}`,
        'Spesa cumulativa': Math.round(isProjection ? 0 : cumulativeSpend),
        Previsione: Math.round(isProjection ? cumulativeSpend : 0),
      })
    }
    return points
  }, [budget])

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-pf-text-primary">
          Trend Spesa vs Budget
        </h3>
        {budgets.length > 1 && (
          <select
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="rounded-md border border-pf-border bg-pf-bg-tertiary px-2 py-1 text-xs text-pf-text-primary"
          >
            {budgets.map((b, i) => (
              <option key={b.budgetId} value={i}>
                {b.costCenter}
              </option>
            ))}
          </select>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#A1A1AA', fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#A1A1AA', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={budget.allocated}
            stroke="#EF4444"
            strokeDasharray="5 5"
            label={{
              value: `Plafond: ${formatCurrency(budget.allocated)}`,
              fill: '#EF4444',
              fontSize: 11,
              position: 'right',
            }}
          />
          <Area
            type="monotone"
            dataKey="Spesa cumulativa"
            stroke="#22C55E"
            fill="rgba(34,197,94,0.15)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Previsione"
            stroke="#F59E0B"
            fill="rgba(245,158,11,0.1)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </ComposedChart>
      </ResponsiveContainer>
      {/* Forecast message */}
      <div className="mt-3 text-xs text-pf-text-secondary">
        {budget.forecast.residualAtPeriodEnd < 0 ? (
          <span className="text-red-400">
            Sforamento previsto a fine periodo: {formatCurrency(Math.abs(budget.forecast.residualAtPeriodEnd))}
            {budget.forecast.exhaustionDate && (
              <> — esaurimento entro il {new Date(budget.forecast.exhaustionDate).toLocaleDateString('it-IT')}</>
            )}
          </span>
        ) : (
          <span className="text-green-400">
            Residuo previsto a fine periodo: {formatCurrency(budget.forecast.residualAtPeriodEnd)}
          </span>
        )}
      </div>
    </div>
  )
}
