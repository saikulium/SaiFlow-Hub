'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InventoryFilters {
  search?: string
  category?: string
  stock_status?: string
}

interface InventoryFiltersBarProps {
  filters: InventoryFilters
  onFiltersChange: (filters: InventoryFilters) => void
}

const CATEGORY_OPTIONS = [
  { value: 'Cavi', label: 'Cavi' },
  { value: 'Cablaggi', label: 'Cablaggi' },
  { value: 'Connettori', label: 'Connettori' },
  { value: 'Accessori', label: 'Accessori' },
  { value: 'Materie Prime', label: 'Materie Prime' },
]

const STOCK_STATUS_OPTIONS = [
  { value: 'LOW', label: 'Scorta Bassa' },
  { value: 'OUT', label: 'Esaurito' },
]

export function InventoryFiltersBar({
  filters,
  onFiltersChange,
}: InventoryFiltersBarProps) {
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

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({
        ...filters,
        category: e.target.value || undefined,
      })
    },
    [filters, onFiltersChange],
  )

  const handleStockStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({
        ...filters,
        stock_status: e.target.value || undefined,
      })
    },
    [filters, onFiltersChange],
  )

  const hasActiveFilters =
    !!filters.search || !!filters.category || !!filters.stock_status

  const handleClearFilters = useCallback(() => {
    setSearchValue('')
    onFiltersChange({})
  }, [onFiltersChange])

  return (
    <div className="space-y-4 rounded-card border border-pf-border bg-pf-bg-secondary/60 p-4 backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-secondary" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cerca per nome o codice..."
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

        {/* Category dropdown */}
        <select
          value={filters.category ?? ''}
          onChange={handleCategoryChange}
          className="rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
        >
          <option value="">Tutte le categorie</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Stock status dropdown */}
        <select
          value={filters.stock_status ?? ''}
          onChange={handleStockStatusChange}
          className="rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
        >
          <option value="">Tutti</option>
          {STOCK_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
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
