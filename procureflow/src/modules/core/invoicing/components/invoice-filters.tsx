'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import {
  INVOICE_MATCH_STATUS_CONFIG,
  RECONCILIATION_STATUS_CONFIG,
} from '../constants/sdi'
import { cn } from '@/lib/utils'

export interface InvoiceFilters {
  search?: string
  match_status?: string
  reconciliation_status?: string
}

interface InvoiceFiltersProps {
  filters: InvoiceFilters
  onFiltersChange: (filters: InvoiceFilters) => void
}

export function InvoiceFiltersBar({
  filters,
  onFiltersChange,
}: InvoiceFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSearchValue(filters.search ?? '')
  }, [filters.search])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value || undefined })
      }, 300)
    },
    [filters, onFiltersChange],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const toggleMatchStatus = useCallback(
    (statusKey: string) => {
      const current = filters.match_status
        ? filters.match_status.split(',')
        : []
      const updated = current.includes(statusKey)
        ? current.filter((s) => s !== statusKey)
        : [...current, statusKey]
      onFiltersChange({
        ...filters,
        match_status: updated.length > 0 ? updated.join(',') : undefined,
      })
    },
    [filters, onFiltersChange],
  )

  const toggleReconciliationStatus = useCallback(
    (statusKey: string) => {
      const current = filters.reconciliation_status
        ? filters.reconciliation_status.split(',')
        : []
      const updated = current.includes(statusKey)
        ? current.filter((s) => s !== statusKey)
        : [...current, statusKey]
      onFiltersChange({
        ...filters,
        reconciliation_status:
          updated.length > 0 ? updated.join(',') : undefined,
      })
    },
    [filters, onFiltersChange],
  )

  const activeMatchStatuses = filters.match_status
    ? filters.match_status.split(',')
    : []
  const activeReconciliationStatuses = filters.reconciliation_status
    ? filters.reconciliation_status.split(',')
    : []
  const hasActiveFilters =
    !!filters.search ||
    activeMatchStatuses.length > 0 ||
    activeReconciliationStatuses.length > 0

  const handleClearFilters = useCallback(() => {
    setSearchValue('')
    onFiltersChange({})
  }, [onFiltersChange])

  return (
    <div className="bg-pf-bg-secondary/60 space-y-4 rounded-card border border-pf-border p-4 backdrop-blur-xl">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-secondary" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Cerca per numero fattura, fornitore o P.IVA..."
          className="bg-pf-bg-primary/50 placeholder:text-pf-text-secondary/60 w-full rounded-button border border-pf-border py-2 pl-10 pr-4 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
        />
        {searchValue && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-pf-text-secondary hover:text-pf-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Match status filter chips */}
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
          Stato Matching
        </span>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {Object.entries(INVOICE_MATCH_STATUS_CONFIG).map(
              ([key, config]) => {
                const isActive = activeMatchStatuses.includes(key)
                return (
                  <motion.button
                    key={key}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => toggleMatchStatus(key)}
                    className={cn(
                      'inline-flex items-center rounded-button px-3 py-1.5 text-xs font-medium transition-all',
                      isActive
                        ? cn(config.bgColor, config.color)
                        : 'hover:border-pf-text-secondary/40 border border-pf-border text-pf-text-secondary hover:text-pf-text-primary',
                    )}
                  >
                    {config.label}
                  </motion.button>
                )
              },
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Reconciliation status filter chips */}
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
          Stato Riconciliazione
        </span>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {Object.entries(RECONCILIATION_STATUS_CONFIG).map(
              ([key, config]) => {
                const isActive = activeReconciliationStatuses.includes(key)
                return (
                  <motion.button
                    key={key}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => toggleReconciliationStatus(key)}
                    className={cn(
                      'inline-flex items-center rounded-button px-3 py-1.5 text-xs font-medium transition-all',
                      isActive
                        ? cn(config.bgColor, config.color)
                        : 'hover:border-pf-text-secondary/40 border border-pf-border text-pf-text-secondary hover:text-pf-text-primary',
                    )}
                  >
                    {config.label}
                  </motion.button>
                )
              },
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Clear filters */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              <X className="h-3 w-3" />
              Pulisci filtri
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
