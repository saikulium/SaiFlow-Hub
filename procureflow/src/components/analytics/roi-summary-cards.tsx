'use client'

import { motion } from 'framer-motion'
import { Clock, Banknote, TrendingDown, Target, Mail, FileText } from 'lucide-react'
import { CountUpNumber } from '@/components/dashboard/count-up-number'
import type { RoiSummary, RoiMetrics } from '@/types'

interface RoiSummaryCardsProps {
  readonly summary: RoiSummary
  readonly automation?: RoiMetrics['automation']
}

const BASE_CARDS = [
  {
    key: 'hours',
    title: 'Ore Risparmiate',
    icon: Clock,
    iconColor: 'text-pf-accent',
    subtitle: 'vs procurement manuale',
    getValue: (s: RoiSummary) => s.totalTimeSavedHours,
    format: 'number' as const,
    suffix: 'h',
  },
  {
    key: 'hoursValue',
    title: 'Valore Tempo',
    icon: Banknote,
    iconColor: 'text-pf-success',
    subtitle: 'a \u20AC35/h costo medio',
    getValue: (s: RoiSummary) => s.hoursSavedValue,
    format: 'currency' as const,
    suffix: '',
  },
  {
    key: 'money',
    title: 'Risparmio Economico',
    icon: TrendingDown,
    iconColor: 'text-emerald-400',
    subtitle: 'negoziazione + discrepanze',
    getValue: (s: RoiSummary) => s.moneySaved,
    format: 'currency' as const,
    suffix: '',
  },
  {
    key: 'annual',
    title: 'Proiezione Annuale',
    icon: Target,
    iconColor: 'text-amber-400',
    subtitle: 'risparmio stimato/anno',
    getValue: (s: RoiSummary) => s.projectedAnnualSavings,
    format: 'currency' as const,
    suffix: '',
  },
] as const

export function RoiSummaryCards({ summary, automation }: RoiSummaryCardsProps) {
  // Build automation cards only if data is available
  const automationCards = automation
    ? [
        {
          key: 'emails',
          title: 'Email Processate',
          icon: Mail,
          iconColor: 'text-blue-400',
          subtitle: 'richieste create da email',
          value: automation.emailsIngested,
          format: 'number' as const,
          suffix: '',
        },
        {
          key: 'invoices',
          title: 'Fatture Elaborate',
          icon: FileText,
          iconColor: 'text-cyan-400',
          subtitle: 'SDI + OCR automatico',
          value: automation.invoicesProcessed,
          format: 'number' as const,
          suffix: '',
        },
      ]
    : []

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {BASE_CARDS.map((card, index) => {
        const Icon = card.icon
        const value = card.getValue(summary)

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="gradient-border group relative overflow-hidden rounded-card border border-pf-border bg-pf-bg-secondary p-5 transition-all duration-200 hover:border-pf-border-hover"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-sm font-medium text-pf-text-secondary">
                  {card.title}
                </p>
                <p className="font-display text-3xl font-bold text-pf-text-primary">
                  <CountUpNumber value={value} format={card.format} />
                  {card.suffix}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-card bg-pf-accent-subtle">
                <Icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="mt-3 text-xs text-pf-text-muted">{card.subtitle}</p>
          </motion.div>
        )
      })}
      {automationCards.map((card, index) => {
        const Icon = card.icon

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (BASE_CARDS.length + index) * 0.1, duration: 0.4, ease: 'easeOut' }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="gradient-border group relative overflow-hidden rounded-card border border-pf-border bg-pf-bg-secondary p-5 transition-all duration-200 hover:border-pf-border-hover"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-sm font-medium text-pf-text-secondary">
                  {card.title}
                </p>
                <p className="font-display text-3xl font-bold text-pf-text-primary">
                  <CountUpNumber value={card.value} format={card.format} />
                  {card.suffix}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-card bg-pf-accent-subtle">
                <Icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="mt-3 text-xs text-pf-text-muted">{card.subtitle}</p>
          </motion.div>
        )
      })}
    </div>
  )
}

/** Compact version for dashboard tab — only base 4 cards */
export function RoiSummaryMini({ summary }: { readonly summary: RoiSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BASE_CARDS.map((card) => {
        const Icon = card.icon
        const value = card.getValue(summary)

        return (
          <div
            key={card.key}
            className="flex items-center gap-3 rounded-card border border-pf-border bg-pf-bg-secondary px-4 py-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pf-accent-subtle">
              <Icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-pf-text-muted">{card.title}</p>
              <p className="font-display text-sm font-bold text-pf-text-primary">
                {card.format === 'currency'
                  ? `\u20AC${value.toLocaleString('it-IT')}`
                  : `${value}${card.suffix}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
