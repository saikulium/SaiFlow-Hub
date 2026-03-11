'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import {
  REQUEST_STATUS_CONFIG,
  PRIORITY_CONFIG,
  type RequestStatusKey,
  type PriorityKey,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

export interface RequestFilters {
  search?: string
  status?: string
  priority?: string
}

interface RequestFiltersProps {
  filters: RequestFilters
  onFiltersChange: (filters: RequestFilters) => void
}

export function RequestFiltersBar({ filters, onFiltersChange }: RequestFiltersProps) {
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

  const toggleStatus = useCallback(
    (statusKey: RequestStatusKey) => {
      const current = filters.status ? filters.status.split(',') : []
      const updated = current.includes(statusKey)
        ? current.filter((s) => s !== statusKey)
        : [...current, statusKey]
      onFiltersChange({
        ...filters,
        status: updated.length > 0 ? updated.join(',') : undefined,
      })
    },
    [filters, onFiltersChange],
  )

  const togglePriority = useCallback(
    (priorityKey: PriorityKey) => {
      const current = filters.priority ? filters.priority.split(',') : []
      const updated = current.includes(priorityKey)
        ? current.filter((p) => p !== priorityKey)
        : [...current, priorityKey]
      onFiltersChange({
        ...filters,
        priority: updated.length > 0 ? updated.join(',') : undefined,
      })
    },
    [filters, onFiltersChange],
  )

  const activeStatuses = filters.status ? filters.status.split(',') : []
  const activePriorities = filters.priority ? filters.priority.split(',') : []
  const hasActiveFilters =
    !!filters.search || activeStatuses.length > 0 || activePriorities.length > 0

  const handleClearFilters = useCallback(() => {
    setSearchValue('')
    onFiltersChange({})
  }, [onFiltersChange])

  return (
    <div className="space-y-4 rounded-card border border-pf-border bg-pf-bg-secondary/60 p-4 backdrop-blur-xl">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-secondary" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Cerca per codice, titolo o fornitore..."
          className="w-full rounded-button border border-pf-border bg-pf-bg-primary/50 py-2 pl-10 pr-4 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/60 focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
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

      {/* Status filter chips */}
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
          Stato
        </span>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {(Object.entries(REQUEST_STATUS_CONFIG) as [RequestStatusKey, typeof REQUEST_STATUS_CONFIG[RequestStatusKey]][]).map(
              ([key, config]) => {
                const isActive = activeStatuses.includes(key)
                return (
                  <motion.button
                    key={key}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => toggleStatus(key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs font-medium transition-all',
                      isActive
                        ? cn(config.bgColor, config.color)
                        : 'border border-pf-border text-pf-text-secondary hover:border-pf-text-secondary/40 hover:text-pf-text-primary',
                    )}
                  >
                    <config.icon className="h-3 w-3" />
                    {config.label}
                  </motion.button>
                )
              },
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Priority filter chips */}
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
          Priorita
        </span>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {(Object.entries(PRIORITY_CONFIG) as [PriorityKey, typeof PRIORITY_CONFIG[PriorityKey]][]).map(
              ([key, config]) => {
                const isActive = activePriorities.includes(key)
                return (
                  <motion.button
                    key={key}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => togglePriority(key)}
                    className={cn(
                      'inline-flex items-center rounded-button px-3 py-1.5 text-xs font-medium transition-all',
                      isActive
                        ? cn(config.bgColor, config.color)
                        : 'border border-pf-border text-pf-text-secondary hover:border-pf-text-secondary/40 hover:text-pf-text-primary',
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
