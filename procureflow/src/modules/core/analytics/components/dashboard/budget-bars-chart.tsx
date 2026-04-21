'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { BUDGET_BAR_COLORS } from '@/modules/core/budgets'
import { formatCurrency } from '@/lib/utils'
import type { BudgetDashboardItem } from '@/types'

interface BudgetBarsChartProps {
  budgets: BudgetDashboardItem[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null
  return (
    <div className="rounded-lg border border-pf-border bg-pf-bg-secondary px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-pf-text-primary">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs text-pf-text-secondary">
          <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function BudgetBarsChart({ budgets }: BudgetBarsChartProps) {
  const data = budgets.map((b) => ({
    name: b.costCenter,
    Speso: b.spent,
    Impegnato: b.committed,
    Disponibile: Math.max(0, b.available),
    Sforamento: b.available < 0 ? Math.abs(b.available) : 0,
  }))

  if (data.length === 0) return null

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h3 className="mb-4 text-sm font-medium text-pf-text-primary">
        Budget per Centro di Costo
      </h3>
      <ResponsiveContainer
        width="100%"
        height={Math.max(200, data.length * 60)}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 20, right: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
          />
          <XAxis
            type="number"
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#A1A1AA', fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fill: '#A1A1AA', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#A1A1AA' }} />
          <Bar
            dataKey="Speso"
            stackId="a"
            fill={BUDGET_BAR_COLORS.spent}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="Impegnato"
            stackId="a"
            fill={BUDGET_BAR_COLORS.committed}
          />
          <Bar
            dataKey="Disponibile"
            stackId="a"
            fill={BUDGET_BAR_COLORS.available}
          />
          <Bar
            dataKey="Sforamento"
            stackId="a"
            fill={BUDGET_BAR_COLORS.exceeded}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
