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
import type { InvoiceAgingBucket } from '@/types'

interface InvoiceAgingChartProps {
  data: InvoiceAgingBucket[]
}

const AGING_COLORS = ['#F59E0B', '#F97316', '#EA580C', '#DC2626']

export function InvoiceAgingChart({ data }: InvoiceAgingChartProps) {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h3 className="mb-4 font-display text-base font-semibold text-pf-text-primary">
        Aging Fatture
      </h3>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-pf-text-muted">
          Nessun dato disponibile
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="bucket"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                width={70}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null
                  return (
                    <div className="rounded-badge border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-xs shadow-lg">
                      <p className="font-medium text-pf-text-primary">
                        {label}
                      </p>
                      <p className="text-pf-text-secondary">
                        {payload[0].value} fatture
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
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={AGING_COLORS[i % AGING_COLORS.length]}
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
