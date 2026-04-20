'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Briefcase,
  Banknote,
  TrendingUp,
  CalendarClock,
  Loader2,
} from 'lucide-react'
import { useCommessaStats } from '@/hooks/use-commesse'
import { cn } from '@/lib/utils'

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
  })
}

const COMMESSA_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  DRAFT: { label: 'Bozza', color: 'text-zinc-400', bgColor: 'bg-zinc-400/10' },
  PLANNING: { label: 'Pianificazione', color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  ACTIVE: { label: 'Attiva', color: 'text-green-400', bgColor: 'bg-green-400/10' },
  ON_HOLD: { label: 'Sospesa', color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  COMPLETED: { label: 'Completata', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  CANCELLED: { label: 'Annullata', color: 'text-zinc-500', bgColor: 'bg-zinc-500/10' },
}

interface StatCardProps {
  readonly label: string
  readonly value: string
  readonly icon: typeof Briefcase
  readonly delay: number
}

function StatCard({ label, value, icon: Icon, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-card border border-pf-border bg-pf-bg-secondary p-5"
    >
      <div className="flex items-center gap-2 text-sm text-pf-text-secondary">
        <Icon className="h-4 w-4 text-pf-text-muted" />
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-pf-text-primary">
        {value}
      </p>
    </motion.div>
  )
}

export function CommesseTab() {
  const { data: stats, isLoading, error } = useCommessaStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-pf-text-muted" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-card border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        Errore nel caricamento delle statistiche commesse.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Commesse attive"
          value={String(stats.activeCount)}
          icon={Briefcase}
          delay={0}
        />
        <StatCard
          label="Valore in corso"
          value={formatCurrency(stats.totalValueInProgress)}
          icon={Banknote}
          delay={0.05}
        />
        <StatCard
          label="Margine medio"
          value={`${stats.avgMarginPercent.toFixed(1)}%`}
          icon={TrendingUp}
          delay={0.1}
        />
        <StatCard
          label="In scadenza"
          value={String(stats.dueSoonCount)}
          icon={CalendarClock}
          delay={0.15}
        />
      </div>

      {/* Top 5 Commesse Table */}
      {stats.topCommesse.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="overflow-hidden rounded-card border border-pf-border"
        >
          <div className="border-b border-pf-border bg-pf-bg-tertiary px-4 py-3">
            <h3 className="text-sm font-medium text-pf-text-secondary">
              Top Commesse
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border bg-pf-bg-secondary text-left">
                  <th className="px-4 py-2.5 font-medium text-pf-text-muted">Codice</th>
                  <th className="px-4 py-2.5 font-medium text-pf-text-muted">Titolo</th>
                  <th className="px-4 py-2.5 font-medium text-pf-text-muted">Cliente</th>
                  <th className="px-4 py-2.5 text-right font-medium text-pf-text-muted">Margine</th>
                  <th className="px-4 py-2.5 font-medium text-pf-text-muted">Scadenza</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCommesse.map((c, i) => {
                  const statusCfg = COMMESSA_STATUS_CONFIG[c.status]
                  return (
                    <tr
                      key={c.code}
                      className="border-b border-pf-border last:border-b-0 hover:bg-pf-bg-hover"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/commesse/${c.code}`}
                          className="font-mono text-xs text-pf-accent hover:text-pf-accent-hover"
                        >
                          {c.code}
                        </Link>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-pf-text-primary">
                        {c.title}
                      </td>
                      <td className="px-4 py-2.5 text-pf-text-secondary">
                        {c.clientName}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {c.marginPercent != null ? (
                          <span
                            className={cn(
                              'font-medium',
                              c.marginPercent >= 0
                                ? 'text-green-400'
                                : 'text-red-400',
                            )}
                          >
                            {c.marginPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-pf-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-pf-text-secondary">
                        {formatDate(c.deadline)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Link to full list */}
      <div className="flex justify-end">
        <Link
          href="/commesse"
          className="text-sm font-medium text-pf-accent hover:text-pf-accent-hover"
        >
          Vedi tutte le commesse &rarr;
        </Link>
      </div>
    </div>
  )
}
