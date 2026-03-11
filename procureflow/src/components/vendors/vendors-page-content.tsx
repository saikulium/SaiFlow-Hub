'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Building2 } from 'lucide-react'
import { useVendors } from '@/hooks/use-vendors'
import { VendorCard } from '@/components/vendors/vendor-card'
import { VENDOR_STATUS_CONFIG } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Tutti' },
  ...Object.entries(VENDOR_STATUS_CONFIG).map(([key, config]) => ({
    key,
    label: config.label,
  })),
]

function VendorCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="rounded-card border border-pf-border bg-pf-bg-secondary p-5"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-5 w-36 animate-pulse rounded bg-pf-border" />
          <div className="h-3 w-20 animate-pulse rounded bg-pf-border" />
        </div>
        <div className="h-5 w-16 animate-pulse rounded-badge bg-pf-border" />
      </div>
      <div className="mt-3 flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-3.5 w-3.5 animate-pulse rounded bg-pf-border" />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-4 w-48 animate-pulse rounded bg-pf-border" />
        <div className="h-4 w-32 animate-pulse rounded bg-pf-border" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          <div className="h-5 w-16 animate-pulse rounded-badge bg-pf-border" />
        </div>
        <div className="h-4 w-8 animate-pulse rounded bg-pf-border" />
      </div>
    </motion.div>
  )
}

export function VendorsPageContent() {
  const [searchInput, setSearchInput] = useState('')
  const [activeStatus, setActiveStatus] = useState('ALL')

  const debouncedSearch = useDebounce(searchInput, 300)

  const queryParams = useMemo(() => {
    const params: { search?: string; status?: string } = {}
    if (debouncedSearch) {
      params.search = debouncedSearch
    }
    if (activeStatus !== 'ALL') {
      params.status = activeStatus
    }
    return params
  }, [debouncedSearch, activeStatus])

  const { data: vendors, isLoading, error } = useVendors(queryParams)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Fornitori
            {vendors && (
              <span className="ml-2 text-base font-normal text-pf-text-muted">
                ({vendors.length})
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Gestisci i tuoi fornitori e le loro informazioni
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
        >
          <Plus className="h-4 w-4" />
          Nuovo Fornitore
        </button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-muted" />
          <input
            type="text"
            placeholder="Cerca fornitori per nome, codice o email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-button border border-pf-border bg-pf-bg-secondary py-2.5 pl-10 pr-4 text-sm text-pf-text-primary placeholder:text-pf-text-muted transition-colors focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveStatus(filter.key)}
              className={cn(
                'rounded-badge px-3 py-1 text-xs font-medium transition-colors',
                activeStatus === filter.key
                  ? 'bg-pf-accent text-white'
                  : 'border border-pf-border bg-pf-bg-secondary text-pf-text-secondary hover:border-pf-border-hover hover:text-pf-text-primary',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-card border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Errore nel caricamento dei fornitori. Riprova piu tardi.
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <VendorCardSkeleton key={i} index={i} />
          ))}
        </div>
      )}

      {/* Vendor grid */}
      {!isLoading && vendors && vendors.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.05,
              },
            },
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {vendors.map((vendor, i) => (
            <VendorCard key={vendor.id} vendor={vendor} index={i} />
          ))}
        </motion.div>
      )}

      {/* Empty state */}
      {!isLoading && vendors && vendors.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex min-h-[40vh] flex-col items-center justify-center rounded-card border border-pf-border bg-pf-bg-secondary p-8"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-card bg-pf-accent/10">
            <Building2 className="h-7 w-7 text-pf-accent" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-pf-text-primary">
            Nessun fornitore trovato
          </h3>
          <p className="mt-1 text-center text-sm text-pf-text-secondary">
            {debouncedSearch || activeStatus !== 'ALL'
              ? 'Prova a modificare i filtri di ricerca'
              : 'Aggiungi il tuo primo fornitore per iniziare'}
          </p>
        </motion.div>
      )}
    </div>
  )
}
