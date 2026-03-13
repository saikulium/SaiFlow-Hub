'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { OrderedVsInvoiced } from '@/types'

interface OrderedVsInvoicedChartProps {
  data: OrderedVsInvoiced[]
}

export function OrderedVsInvoicedChart({ data }: OrderedVsInvoicedChartProps) {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h3 className="mb-4 font-display text-base font-semibold text-pf-text-primary">
        Fatturato vs Ordinato
      </h3>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-pf-text-muted">
          Nessun dato disponibile
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey="period"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                width={60}
                tickFormatter={(value: number) =>
                  new Intl.NumberFormat('it-IT', {
                    notation: 'compact',
                    style: 'currency',
                    currency: 'EUR',
                  }).format(value)
                }
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-badge border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-xs shadow-lg">
                      <p className="mb-1 font-medium text-pf-text-primary">
                        {label}
                      </p>
                      {payload.map((entry) => (
                        <p
                          key={entry.dataKey as string}
                          className="text-pf-text-secondary"
                        >
                          <span style={{ color: entry.color }}>
                            {entry.name}:
                          </span>{' '}
                          {formatCurrency(entry.value as number)}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#A1A1AA' }}
              />
              <Bar
                dataKey="ordered"
                name="Ordinato"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              />
              <Bar
                dataKey="invoiced"
                name="Fatturato"
                fill="#8B5CF6"
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
