'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import { CountUpNumber } from './count-up-number'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: number
  previousValue?: number
  format?: 'number' | 'currency'
  icon: LucideIcon
  iconColor?: string
  index: number
  alert?: boolean
}

export function StatCard({
  title,
  value,
  previousValue,
  format = 'number',
  icon: Icon,
  iconColor = 'text-pf-accent',
  index,
  alert,
}: StatCardProps) {
  const change =
    previousValue && previousValue > 0
      ? Math.round(((value - previousValue) / previousValue) * 100)
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="gradient-border group relative overflow-hidden rounded-card border border-pf-border bg-pf-bg-secondary p-5 transition-all duration-200 hover:border-pf-border-hover"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-pf-text-secondary">{title}</p>
          <p className="font-display text-3xl font-bold text-pf-text-primary">
            <CountUpNumber value={value} format={format} />
          </p>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-card',
            alert
              ? 'bg-red-500/10 text-pf-danger'
              : 'bg-pf-accent-subtle',
            !alert && iconColor,
          )}
        >
          <Icon className={cn('h-5 w-5', alert && 'animate-pulse-subtle')} />
        </div>
      </div>

      {change !== null && (
        <div className="mt-3 flex items-center gap-1.5">
          {change >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-pf-success" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-pf-danger" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              change >= 0 ? 'text-pf-success' : 'text-pf-danger',
            )}
          >
            {change > 0 ? '+' : ''}
            {change}%
          </span>
          <span className="text-xs text-pf-text-muted">vs mese prec.</span>
        </div>
      )}
    </motion.div>
  )
}
