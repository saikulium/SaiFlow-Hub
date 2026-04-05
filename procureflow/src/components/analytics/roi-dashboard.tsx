'use client'

import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { useRoiMetrics } from '@/hooks/use-roi-metrics'
import { ROI_PERIOD_OPTIONS } from '@/lib/constants/roi'
import dynamic from 'next/dynamic'
import { RoiSummaryCards } from './roi-summary-cards'
import { RoiExportButton } from './roi-export-button'

// Lazy-load chart components (Recharts)
const RoiTimeSavingsChart = dynamic(
  () =>
    import('./roi-charts').then((m) => ({ default: m.RoiTimeSavingsChart })),
  { ssr: false },
)
const RoiCostSavingsChart = dynamic(
  () =>
    import('./roi-charts').then((m) => ({ default: m.RoiCostSavingsChart })),
  { ssr: false },
)
const RoiEfficiencyChart = dynamic(
  () => import('./roi-charts').then((m) => ({ default: m.RoiEfficiencyChart })),
  { ssr: false },
)
const RoiAutomationChart = dynamic(
  () => import('./roi-charts').then((m) => ({ default: m.RoiAutomationChart })),
  { ssr: false },
)
import type { RoiPeriod } from '@/types'

export function RoiDashboard() {
  const [period, setPeriod] = useState<RoiPeriod>('90d')
  const { data, isLoading, isError } = useRoiMetrics(period)
  const metrics = data?.data ?? null

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-pf-text-primary">
              ROI & Impatto
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              Metriche di risparmio automatiche basate sui dati reali
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as RoiPeriod)}
              className="focus:ring-pf-accent/40 rounded-lg border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm text-pf-text-primary transition-colors hover:border-pf-border-hover focus:outline-none focus:ring-2"
            >
              {ROI_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {metrics && <RoiExportButton metrics={metrics} />}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && <RoiSkeleton />}

        {/* Error state */}
        {isError && (
          <div className="border-pf-danger/30 bg-pf-danger/5 rounded-card border p-6 text-center">
            <p className="text-sm text-pf-danger">
              Errore nel caricamento delle metriche ROI
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading &&
          !isError &&
          metrics &&
          metrics.efficiency.totalRequests === 0 && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
                <BarChart3 className="h-8 w-8 text-pf-accent" />
              </div>
              <div className="text-center">
                <h2 className="font-display text-lg font-semibold text-pf-text-primary">
                  Nessun dato nel periodo
                </h2>
                <p className="mt-1 max-w-md text-sm text-pf-text-secondary">
                  Inizia a creare richieste di acquisto per vedere le metriche
                  ROI. I dati vengono calcolati automaticamente dallo storico.
                </p>
              </div>
            </div>
          )}

        {/* Data loaded */}
        {!isLoading &&
          !isError &&
          metrics &&
          metrics.efficiency.totalRequests > 0 && (
            <>
              <RoiSummaryCards
                summary={metrics.summary}
                automation={metrics.automation}
              />
              <div className="grid gap-6 lg:grid-cols-2">
                <RoiTimeSavingsChart data={metrics.timeSavings} />
                <RoiCostSavingsChart data={metrics.costSavings} />
                <RoiEfficiencyChart data={metrics.efficiency} />
                <RoiAutomationChart data={metrics.automation} />
              </div>
            </>
          )}
      </div>
    </PageTransition>
  )
}

function RoiSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton-shimmer h-32 rounded-card" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-shimmer h-80 rounded-card" />
        ))}
      </div>
    </div>
  )
}
