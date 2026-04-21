'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { TENDER_STATUS_CONFIG, TENDER_TYPE_LABELS } from '../constants'
import { cn } from '@/lib/utils'

export interface TenderFilters {
  search?: string
  status?: string
  tender_type?: string
}

interface TenderFiltersBarProps {
  filters: TenderFilters
  onFiltersChange: (filters: TenderFilters) => void
}

export function TenderFiltersBar({
  filters,
  onFiltersChange,
}: TenderFiltersBarProps) {
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

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({
        ...filters,
        status: e.target.value || undefined,
      })
    },
    [filters, onFiltersChange],
  )

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({
        ...filters,
        tender_type: e.target.value || undefined,
      })
    },
    [filters, onFiltersChange],
  )

  const hasActiveFilters =
    !!filters.search || !!filters.status || !!filters.tender_type

  const handleClearFilters = useCallback(() => {
    setSearchValue('')
    onFiltersChange({})
  }, [onFiltersChange])

  return (
    <div className="bg-pf-bg-secondary/60 space-y-4 rounded-card border border-pf-border p-4 backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-secondary" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cerca per titolo, codice o CIG..."
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

        {/* Status dropdown */}
        <select
          value={filters.status ?? ''}
          onChange={handleStatusChange}
          className="bg-pf-bg-primary/50 rounded-button border border-pf-border px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(TENDER_STATUS_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        {/* Type dropdown */}
        <select
          value={filters.tender_type ?? ''}
          onChange={handleTypeChange}
          className="bg-pf-bg-primary/50 rounded-button border border-pf-border px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
        >
          <option value="">Tutti i tipi</option>
          {Object.entries(TENDER_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1.5 rounded-button px-3 py-2 text-xs font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
          >
            <X className="h-3 w-3" />
            Pulisci
          </button>
        )}
      </div>
    </div>
  )
}
