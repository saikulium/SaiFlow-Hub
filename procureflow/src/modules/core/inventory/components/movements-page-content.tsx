'use client'

import { useCallback, useMemo, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { MovementFormDialog } from './movement-form-dialog'
import { useMovements } from '../hooks/use-stock'
import { useWarehouses } from '../hooks/use-stock'
import {
  MOVEMENT_TYPE_CONFIG,
  MOVEMENT_REASON_LABELS,
} from '../constants/inventory'
import { cn, formatDate } from '@/lib/utils'

const DEFAULT_PAGE_SIZE = 20

const quantityFormatter = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 3,
  signDisplay: 'always',
})

interface MovementFilters {
  movement_type?: string
  material_search?: string
  warehouse_id?: string
  date_from?: string
  date_to?: string
}

function SkeletonRow() {
  return (
    <tr className="border-b border-pf-border">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton-shimmer h-4 w-full rounded" />
        </td>
      ))}
    </tr>
  )
}

function MovementTypeBadge({ type }: { readonly type: string }) {
  const config = MOVEMENT_TYPE_CONFIG[type]
  if (!config) {
    return <span className="text-xs text-pf-text-secondary">{type}</span>
  }
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

export function MovementsPageContent() {
  const [filters, setFilters] = useState<MovementFilters>({})
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const { data: warehouses } = useWarehouses()

  const { data: response, isLoading } = useMovements({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    movement_type: filters.movement_type,
    warehouse_id: filters.warehouse_id,
    date_from: filters.date_from,
    date_to: filters.date_to,
  })

  const movements = response?.data ?? []
  const meta = response?.meta
  const total = meta?.total ?? 0
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1

  const handleFilterChange = useCallback(
    <K extends keyof MovementFilters>(key: K, value: MovementFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value || undefined }))
      setPage(1)
    },
    [],
  )

  const handlePrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1))
  }, [totalPages])

  const movementTypeOptions = useMemo(
    () =>
      Object.entries(MOVEMENT_TYPE_CONFIG).map(([key, cfg]) => ({
        value: key,
        label: cfg.label,
      })),
    [],
  )

  const inputClassName =
    'rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/60 focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent'

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-pf-text-primary">
              Movimenti di Magazzino
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              {isLoading ? 'Caricamento...' : `${total} movimenti totali`}
            </p>
          </div>

          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuovo Movimento
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-pf-bg-secondary/60 flex flex-wrap items-center gap-3 rounded-card border border-pf-border px-4 py-3 backdrop-blur-xl">
          <select
            value={filters.movement_type ?? ''}
            onChange={(e) =>
              handleFilterChange('movement_type', e.target.value)
            }
            className={cn(inputClassName, 'min-w-[160px]')}
          >
            <option value="">Tutti i tipi</option>
            {movementTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filters.warehouse_id ?? ''}
            onChange={(e) => handleFilterChange('warehouse_id', e.target.value)}
            className={cn(inputClassName, 'min-w-[180px]')}
          >
            <option value="">Tutti i magazzini</option>
            {(warehouses ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.date_from ?? ''}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
            className={inputClassName}
            placeholder="Da"
          />
          <input
            type="date"
            value={filters.date_to ?? ''}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
            className={inputClassName}
            placeholder="A"
          />
        </div>

        {/* Table */}
        <div className="bg-pf-bg-secondary/60 overflow-x-auto rounded-card border border-pf-border backdrop-blur-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pf-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Codice
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Data
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Materiale
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                  Lotto
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary sm:table-cell">
                  Magazzino
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Quantita
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
                  Causale
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
                  Operatore
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}

              {!isLoading && movements.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-pf-text-muted" />
                    <p className="text-sm font-medium text-pf-text-secondary">
                      Nessun movimento trovato
                    </p>
                    <p className="mt-1 text-xs text-pf-text-muted">
                      Registra il primo movimento per iniziare.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                movements.map((mov) => (
                  <tr
                    key={mov.id}
                    className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-pf-text-secondary">
                        {mov.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-pf-text-secondary">
                      {formatDate(mov.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <MovementTypeBadge type={mov.movementType} />
                    </td>
                    <td className="max-w-[180px] px-4 py-3">
                      <span className="truncate text-sm font-medium text-pf-text-primary">
                        {mov.materialName}
                      </span>
                      <span className="ml-1.5 font-mono text-xs text-pf-text-muted">
                        {mov.materialCode}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                      {mov.lotNumber ?? '-'}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary sm:table-cell">
                      {mov.warehouseName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          mov.quantity > 0
                            ? 'text-green-400'
                            : mov.quantity < 0
                              ? 'text-red-400'
                              : 'text-pf-text-primary',
                        )}
                      >
                        {quantityFormatter.format(mov.quantity)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary lg:table-cell">
                      {MOVEMENT_REASON_LABELS[mov.reason] ?? mov.reason}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary lg:table-cell">
                      {mov.actor ?? '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="bg-pf-bg-secondary/60 flex items-center justify-between rounded-card border border-pf-border px-4 py-3 backdrop-blur-xl">
            <p className="text-sm text-pf-text-secondary">
              Pagina{' '}
              <span className="font-medium text-pf-text-primary">{page}</span>{' '}
              di{' '}
              <span className="font-medium text-pf-text-primary">
                {totalPages}
              </span>{' '}
              &middot;{' '}
              <span className="font-medium text-pf-text-primary">{total}</span>{' '}
              risultati
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={page <= 1}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-button border border-pf-border px-3 py-1.5 text-sm font-medium transition-colors',
                  page <= 1
                    ? 'text-pf-text-secondary/40 cursor-not-allowed'
                    : 'hover:border-pf-text-secondary/40 text-pf-text-secondary hover:text-pf-text-primary',
                )}
              >
                <ChevronLeft className="h-4 w-4" />
                Precedente
              </button>
              <button
                onClick={handleNextPage}
                disabled={page >= totalPages}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-button border border-pf-border px-3 py-1.5 text-sm font-medium transition-colors',
                  page >= totalPages
                    ? 'text-pf-text-secondary/40 cursor-not-allowed'
                    : 'hover:border-pf-text-secondary/40 text-pf-text-secondary hover:text-pf-text-primary',
                )}
              >
                Successiva
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <MovementFormDialog open={formOpen} onOpenChange={setFormOpen} />
      </div>
    </PageTransition>
  )
}
