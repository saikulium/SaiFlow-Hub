'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { CHART_COLORS } from '@/lib/constants'
import type { SpendByVendor } from '@/types'

interface SpendByVendorChartProps {
  data: SpendByVendor[]
}

export function SpendByVendorChart({ data }: SpendByVendorChartProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0)

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <h3 className="mb-4 font-display text-base font-semibold text-pf-text-primary">
        Spesa per Fornitore
      </h3>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-pf-text-muted">
          Nessun dato disponibile
        </div>
      ) : (
        <>
          <div className="relative h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="amount"
                  nameKey="vendor"
                  animationBegin={0}
                  animationDuration={1000}
                >
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null
                    const item = payload[0]
                    return (
                      <div className="rounded-badge border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium text-pf-text-primary">
                          {item.name}
                        </p>
                        <p className="text-pf-text-secondary">
                          {formatCurrency(item.value as number)}
                        </p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-pf-text-muted">Totale</span>
              <span className="font-display text-lg font-bold text-pf-text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {data.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-pf-text-secondary">{item.vendor}</span>
                </div>
                <span className="font-mono text-pf-text-primary">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
