'use client'

import Link from 'next/link'
import {
  TrendingUp,
  AlertTriangle,
  PiggyBank,
  Timer,
  ShieldAlert,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInsights } from '@/hooks/use-insights'
import type { InsightCard } from '@/types/ai'

const SEVERITY_STYLES = {
  CRITICAL: 'border-l-red-500',
  HIGH: 'border-l-orange-500',
  MEDIUM: 'border-l-blue-500',
  LOW: 'border-l-zinc-500',
} as const

const TYPE_ICONS = {
  SPEND_ANOMALY: TrendingUp,
  VENDOR_RISK: ShieldAlert,
  SAVINGS: PiggyBank,
  BOTTLENECK: Timer,
  BUDGET_ALERT: AlertTriangle,
} as const

function InsightCardItem({
  insight,
  onDismiss,
}: {
  readonly insight: InsightCard
  readonly onDismiss: (id: string) => void
}) {
  const Icon = TYPE_ICONS[insight.type]
  const severityStyle = SEVERITY_STYLES[insight.severity]

  return (
    <div
      className={cn(
        'relative rounded-lg border border-pf-border bg-pf-bg-secondary p-4 pl-5',
        'border-l-[3px] transition-all duration-150 hover:bg-pf-bg-hover',
        severityStyle,
      )}
    >
      <button
        onClick={() => onDismiss(insight.id)}
        className="absolute right-2 top-2 rounded-md p-1 text-pf-text-muted transition-colors hover:bg-pf-bg-hover hover:text-pf-text-secondary"
        aria-label="Nascondi insight"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 flex-shrink-0 text-pf-text-secondary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-tight text-pf-text-primary">
            {insight.title}
          </p>
          <p className="text-xs leading-relaxed text-pf-text-secondary">
            {insight.description}
          </p>
          {insight.actionLabel && insight.actionUrl && (
            <Link
              href={insight.actionUrl}
              className="inline-block text-xs font-medium text-pf-accent hover:text-pf-accent-hover"
            >
              {insight.actionLabel} &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function InsightSkeleton() {
  return (
    <div className="rounded-lg border border-pf-border bg-pf-bg-secondary p-4">
      <div className="flex items-start gap-3">
        <div className="h-4 w-4 animate-pulse rounded bg-pf-bg-hover" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-pf-bg-hover" />
          <div className="h-3 w-full animate-pulse rounded bg-pf-bg-hover" />
        </div>
      </div>
    </div>
  )
}

export function InsightCards() {
  const { insights, isLoading, dismiss } = useInsights()

  // Don't show anything (no flash) if loading or empty
  if (isLoading || insights.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-pf-text-secondary">Insight AI</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight) => (
          <InsightCardItem
            key={insight.id}
            insight={insight}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </div>
  )
}
