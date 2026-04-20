'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { StatusDistribution } from '@/types'

interface StatusDistributionChartProps {
  data: StatusDistribution[]
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#71717A',
  SUBMITTED: '#3B82F6',
  PENDING_APPROVAL: '#F59E0B',
  APPROVED: '#22C55E',
  REJECTED: '#EF4444',
  ORDERED: '#6366F1',
  SHIPPED: '#06B6D4',
  DELIVERED: '#10B981',
  CANCELLED: '#52525B',
  ON_HOLD: '#F97316',
}

export function StatusDistributionChart({
  data,
}: StatusDistributionChartProps) {
  const sortedData = [...data].sort((a, b) => b.count - a.count)

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h3 className="mb-4 font-display text-base font-semibold text-pf-text-primary">
        Distribuzione Status
      </h3>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-pf-text-muted">
          Nessun dato disponibile
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} layout="vertical">
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                width={100}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const item = payload[0].payload as StatusDistribution
                  return (
                    <div className="rounded-badge border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-xs shadow-lg">
                      <p className="font-medium text-pf-text-primary">
                        {item.label}
                      </p>
                      <p className="text-pf-text-secondary">
                        {item.count} richieste
                      </p>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
              >
                {sortedData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] ?? '#6366F1'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
