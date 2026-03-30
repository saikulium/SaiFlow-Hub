'use client'

import { useState } from 'react'
import { BarChart3, Brain, Loader2, TrendingDown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForecast, useAiForecast } from '@/hooks/use-forecast'
import type { AiForecast } from '@/types/ai'

interface ForecastPanelProps {
  readonly materialId: string
}

export function ForecastPanel({ materialId }: ForecastPanelProps) {
  const { forecast, isLoading } = useForecast(materialId)
  const aiForecastMutation = useAiForecast()
  const [aiResult, setAiResult] = useState<AiForecast | null>(null)

  function handleAiAnalysis() {
    aiForecastMutation.mutate(materialId, {
      onSuccess: (data) => setAiResult(data),
    })
  }

  if (isLoading) {
    return (
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
        <div className="flex items-center gap-2 text-sm text-pf-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento previsioni...
        </div>
      </div>
    )
  }

  if (!forecast) return null

  const monthLabels = ['Mese 1', 'Mese 2', 'Mese 3']
  const maxProjected = Math.max(...forecast.projected, 1)

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-pf-accent" />
          <h3 className="text-sm font-semibold text-pf-text-primary">
            Previsione Consumi
          </h3>
        </div>
        <button
          onClick={handleAiAnalysis}
          disabled={aiForecastMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-pf-accent/10 px-3 py-1.5 text-xs font-medium text-pf-accent transition-colors hover:bg-pf-accent/20 disabled:opacity-50"
        >
          {aiForecastMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Brain className="h-3 w-3" />
          )}
          Analisi AI
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-pf-bg-primary p-3 text-center">
          <p className="text-lg font-bold text-pf-text-primary">
            {Math.round(forecast.currentStock)}
          </p>
          <p className="text-[11px] text-pf-text-muted">Stock attuale</p>
        </div>
        <div className="rounded-lg bg-pf-bg-primary p-3 text-center">
          <p
            className={cn(
              'text-lg font-bold',
              forecast.daysRemaining <= 30
                ? 'text-red-400'
                : forecast.daysRemaining <= 60
                  ? 'text-yellow-400'
                  : 'text-pf-text-primary',
            )}
          >
            {Math.round(forecast.daysRemaining)}
          </p>
          <p className="text-[11px] text-pf-text-muted">Giorni rimanenti</p>
        </div>
        <div className="rounded-lg bg-pf-bg-primary p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {forecast.reorderNeeded ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-green-400" />
            )}
            <p
              className={cn(
                'text-sm font-bold',
                forecast.reorderNeeded ? 'text-red-400' : 'text-green-400',
              )}
            >
              {forecast.reorderNeeded ? 'Sì' : 'No'}
            </p>
          </div>
          <p className="text-[11px] text-pf-text-muted">Riordino</p>
        </div>
      </div>

      {/* Simple bar chart */}
      <div>
        <p className="mb-2 text-xs font-medium text-pf-text-secondary">
          Proiezione prossimi 3 mesi
        </p>
        <div className="flex items-end gap-2">
          {forecast.projected.map((value, i) => (
            <div key={monthLabels[i]} className="flex-1 text-center">
              <div className="mx-auto mb-1 w-full max-w-[40px]">
                <div
                  className="rounded-t bg-pf-accent/60 transition-all"
                  style={{
                    height: `${Math.max((value / maxProjected) * 60, 4)}px`,
                  }}
                />
              </div>
              <p className="text-[10px] text-pf-text-muted">
                {monthLabels[i]}
              </p>
              <p className="text-xs font-medium text-pf-text-secondary">
                {Math.round(value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Forecast Result */}
      {aiResult && (
        <div className="rounded-lg border border-pf-accent/20 bg-pf-accent/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-pf-accent" />
            <span className="text-xs font-semibold text-pf-accent">
              Analisi AI — Confidenza {Math.round(aiResult.confidence * 100)}%
            </span>
          </div>
          <p className="text-xs leading-relaxed text-pf-text-secondary">
            {aiResult.reasoning}
          </p>
          {aiResult.risks.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-pf-text-muted">
                Rischi:
              </p>
              <ul className="ml-3 list-disc text-[11px] text-pf-text-secondary">
                {aiResult.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
