'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { RequestTrend } from '@/types'

interface RequestsTrendChartProps {
  data: RequestTrend[]
}

export function RequestsTrendChart({ data }: RequestsTrendChartProps) {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h3 className="mb-4 font-display text-base font-semibold text-pf-text-primary">
        Trend Richieste
      </h3>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-pf-text-muted">
          Nessun dato disponibile
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                width={30}
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
                        {payload[0].value} richieste
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#6366F1"
                strokeWidth={2}
                fill="url(#trendGradient)"
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
