'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Search,
  Plus,
  Briefcase,
  ArrowUpDown,
  CalendarClock,
  Sparkles,
  ClipboardList,
} from 'lucide-react'
import { useCommesse } from '@/hooks/use-commesse'
import { useClients } from '@/hooks/use-clients'
import { CommessaCreateDialog } from './commessa-create-dialog'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG } from '@/lib/constants'
import type { CommessaListItem } from '@/types'

const COMMESSA_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  DRAFT: {
    label: 'Bozza',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  },
  PLANNING: {
    label: 'Pianificazione',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  ACTIVE: {
    label: 'Attiva',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  ON_HOLD: {
    label: 'Sospesa',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  COMPLETED: {
    label: 'Completata',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
  },
  CANCELLED: {
    label: 'Annullata',
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-500/10',
  },
}

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Tutte' },
  ...Object.entries(COMMESSA_STATUS_CONFIG).map(([key, config]) => ({
    key,
    label: config.label,
  })),
]

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Data creazione' },
  { value: 'deadline', label: 'Scadenza' },
] as const

const COMMESSA_CSV_COLUMNS = [
  { header: 'Codice', accessor: (c: CommessaListItem) => c.code },
  { header: 'Titolo', accessor: (c: CommessaListItem) => c.title },
  { header: 'Cliente', accessor: (c: CommessaListItem) => c.clientName },
  { header: 'Stato', accessor: (c: CommessaListItem) => c.status },
  {
    header: 'Valore Cliente',
    accessor: (c: CommessaListItem) => c.clientValue,
  },
  { header: 'Costi', accessor: (c: CommessaListItem) => c.totalCosts },
  { header: 'Margine %', accessor: (c: CommessaListItem) => c.marginPercent },
  { header: 'Scadenza', accessor: (c: CommessaListItem) => c.deadline },
  { header: 'PR', accessor: (c: CommessaListItem) => c.requestsCount },
] as const

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
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const config = COMMESSA_STATUS_CONFIG[status] ?? {
    label: status,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
      )}
    >
      {config.label}
    </span>
  )
}

function MarginCell({
  margin,
  marginPercent,
}: {
  margin: number | null
  marginPercent: number | null
}) {
  if (margin == null || marginPercent == null) {
    return <span className="text-pf-text-muted">—</span>
  }
  const isPositive = margin >= 0
  return (
    <span
      className={cn(
        'font-medium',
        isPositive ? 'text-green-400' : 'text-red-400',
      )}
    >
      {formatCurrency(margin)}
      <span className="ml-1 text-xs">({marginPercent.toFixed(1)}%)</span>
    </span>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="h-14 animate-pulse rounded-card bg-pf-bg-secondary"
        />
      ))}
    </div>
  )
}

export function CommessePageContent() {
  const [searchInput, setSearchInput] = useState('')
  const [activeStatus, setActiveStatus] = useState('ALL')
  const [clientFilter, setClientFilter] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'deadline'>('created_at')
  const [createOpen, setCreateOpen] = useState(false)

  const debouncedSearch = useDebounce(searchInput, 300)

  const { data: clients } = useClients()

  const queryParams = useMemo(() => {
    const params: {
      search?: string
      status?: string
      client_id?: string
      sort?: 'created_at' | 'deadline'
    } = { sort: sortBy }

    if (debouncedSearch) {
      params.search = debouncedSearch
    }
    if (activeStatus !== 'ALL') {
      params.status = activeStatus
    }
    if (clientFilter) {
      params.client_id = clientFilter
    }
    return params
  }, [debouncedSearch, activeStatus, clientFilter, sortBy])

  const { data: commesse, isLoading, error } = useCommesse(queryParams)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Commesse
            {commesse && (
              <span className="ml-2 text-base font-normal text-pf-text-muted">
                ({commesse.length})
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Gestisci le commesse cliente e il loro margine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            data={commesse ?? []}
            columns={COMMESSA_CSV_COLUMNS}
            filename="commesse"
          />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuova Commessa
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-muted" />
          <input
            type="text"
            placeholder="Cerca commesse per codice, titolo o cliente..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-button border border-pf-border bg-pf-bg-secondary py-2.5 pl-10 pr-4 text-sm text-pf-text-primary transition-colors placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          {/* Client filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-button border border-pf-border bg-pf-bg-secondary px-3 py-1.5 text-xs text-pf-text-secondary focus:border-pf-accent focus:outline-none"
          >
            <option value="">Tutti i clienti</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-pf-text-muted" />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortBy(opt.value)}
                className={cn(
                  'rounded-badge px-2 py-0.5 text-xs transition-colors',
                  sortBy === opt.value
                    ? 'bg-pf-accent/20 text-pf-accent'
                    : 'text-pf-text-muted hover:text-pf-text-secondary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-card border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Errore nel caricamento delle commesse. Riprova più tardi.
        </div>
      )}

      {/* Loading */}
      {isLoading && <TableSkeleton />}

      {/* Table */}
      {!isLoading && commesse && commesse.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden rounded-card border border-pf-border"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border bg-pf-bg-tertiary text-left">
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary">
                    Codice
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary">
                    Titolo
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary">
                    Cliente
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary">
                    Stato
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 text-right font-medium text-pf-text-secondary md:table-cell">
                    Valore
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 text-right font-medium text-pf-text-secondary md:table-cell">
                    Costi
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 text-right font-medium text-pf-text-secondary lg:table-cell">
                    Margine
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary lg:table-cell">
                    Scadenza
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-pf-text-secondary">
                    PR
                  </th>
                </tr>
              </thead>
              <tbody>
                {commesse.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className="border-b border-pf-border transition-colors last:border-b-0 hover:bg-pf-bg-hover"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/commesse/${c.code}`}
                        className="font-mono text-xs text-pf-accent hover:text-pf-accent-hover"
                      >
                        {c.code}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium text-pf-text-primary">
                      <Link
                        href={`/commesse/${c.code}`}
                        className="hover:text-pf-accent"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-pf-text-secondary">
                      {c.clientName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right text-pf-text-secondary md:table-cell">
                      {formatCurrency(c.clientValue)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right text-pf-text-secondary md:table-cell">
                      {formatCurrency(c.totalCosts)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right lg:table-cell">
                      <MarginCell
                        margin={c.margin}
                        marginPercent={c.marginPercent}
                      />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 lg:table-cell">
                      {c.deadline ? (
                        <span className="flex items-center gap-1.5 text-pf-text-secondary">
                          <CalendarClock className="h-3.5 w-3.5 text-pf-text-muted" />
                          {formatDate(c.deadline)}
                        </span>
                      ) : (
                        <span className="text-pf-text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 text-pf-text-secondary">
                        <ClipboardList className="h-3.5 w-3.5 text-pf-text-muted" />
                        {c.requestsCount}
                        {c.suggestionsCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-400">
                            <Sparkles className="h-3 w-3" />
                            {c.suggestionsCount}
                          </span>
                        )}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!isLoading && commesse && commesse.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex min-h-[40vh] flex-col items-center justify-center rounded-card border border-pf-border bg-pf-bg-secondary p-8"
        >
          <div className="bg-pf-accent/10 flex h-14 w-14 items-center justify-center rounded-card">
            <Briefcase className="h-7 w-7 text-pf-accent" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-pf-text-primary">
            Nessuna commessa trovata
          </h3>
          <p className="mt-1 text-center text-sm text-pf-text-secondary">
            {debouncedSearch || activeStatus !== 'ALL' || clientFilter
              ? 'Prova a modificare i filtri di ricerca'
              : 'Crea la tua prima commessa per iniziare'}
          </p>
        </motion.div>
      )}

      {/* Create dialog */}
      <CommessaCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
