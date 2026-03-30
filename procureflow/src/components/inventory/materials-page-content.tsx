'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertTriangle,
  X,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import {
  InventoryFiltersBar,
  type InventoryFilters,
} from '@/components/inventory/inventory-filters'
import { StockLevelBadge } from '@/components/inventory/stock-level-badge'
import { MaterialFormDialog } from '@/components/inventory/material-form-dialog'
import { useMaterials } from '@/hooks/use-materials'
import { useMaterialAlerts } from '@/hooks/use-forecast'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { cn, formatCurrency } from '@/lib/utils'
import type { StockStatusKey } from '@/lib/constants/inventory'

const MATERIAL_CSV_COLUMNS = [
  { header: 'Codice', accessor: (m: { code: string }) => m.code },
  { header: 'Nome', accessor: (m: { name: string }) => m.name },
  {
    header: 'Categoria',
    accessor: (m: { category?: string | null }) => m.category,
  },
  { header: 'Unita', accessor: (m: { unitPrimary: string }) => m.unitPrimary },
] as const

const DEFAULT_PAGE_SIZE = 20

const quantityFormatter = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 3,
})

function SkeletonRow() {
  return (
    <tr className="border-b border-pf-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton-shimmer h-4 w-full rounded" />
        </td>
      ))}
    </tr>
  )
}

export function MaterialsPageContent() {
  const router = useRouter()
  const [filters, setFilters] = useState<InventoryFilters>({})
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const { alerts, dismiss: dismissAlert } = useMaterialAlerts()

  const { data: response, isLoading } = useMaterials({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: filters.search,
    category: filters.category,
    low_stock:
      filters.stock_status === 'LOW'
        ? true
        : filters.stock_status === 'OUT'
          ? true
          : undefined,
  })

  const materials = response?.data ?? []
  const meta = response?.meta
  const total = meta?.total ?? 0
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1

  const handleFiltersChange = useCallback((newFilters: InventoryFilters) => {
    setFilters(newFilters)
    setPage(1)
  }, [])

  const handlePrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1))
  }, [totalPages])

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/inventory/${id}`)
    },
    [router],
  )

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-pf-text-primary">
              Magazzino Materiali
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              {isLoading ? 'Caricamento...' : `${total} materiali totali`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ExportCsvButton
              data={materials}
              columns={MATERIAL_CSV_COLUMNS}
              filename="materiali"
            />
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover"
            >
              <Plus className="h-4 w-4" />
              Nuovo Materiale
            </button>
          </div>
        </div>

        {/* Filters */}
        <InventoryFiltersBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Reorder Alert Banners */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-3 rounded-card border border-yellow-500/20 bg-yellow-500/5 px-4 py-3"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
                <div className="flex-1 text-sm">
                  <span className="font-medium text-pf-text-primary">
                    {alert.materialName}
                  </span>
                  <span className="text-pf-text-secondary">
                    {' '}
                    —{' '}
                    {alert.type === 'OUT_OF_STOCK'
                      ? 'esaurito'
                      : `${alert.daysRemaining ?? '?'} giorni rimanenti`}
                    {alert.suggestedQty != null && (
                      <> · Quantità suggerita: {alert.suggestedQty}</>
                    )}
                  </span>
                </div>
                <a
                  href={`/requests/new?material=${alert.materialId}${alert.suggestedVendorId ? `&vendor=${alert.suggestedVendorId}` : ''}${alert.suggestedQty != null ? `&qty=${alert.suggestedQty}` : ''}`}
                  className="shrink-0 rounded-button bg-pf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-pf-accent-hover"
                >
                  Crea richiesta &rarr;
                </a>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="shrink-0 rounded-button p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
                  title="Ignora"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-pf-bg-secondary/60 overflow-x-auto rounded-card border border-pf-border backdrop-blur-xl">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[120px]" />
              <col />
              <col className="hidden w-[120px] md:table-column" />
              <col className="hidden w-[50px] sm:table-column" />
              <col className="w-[110px]" />
              <col className="hidden w-[100px] lg:table-column" />
              <col className="hidden w-[100px] lg:table-column" />
              <col className="w-[110px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-pf-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Codice
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Nome
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                  Categoria
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary sm:table-cell">
                  UM
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Giacenza Fisica
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
                  Disponibile
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
                  Costo Unit.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Scorta
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}

              {!isLoading && materials.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Package className="mx-auto mb-3 h-10 w-10 text-pf-text-muted" />
                    <p className="text-sm font-medium text-pf-text-secondary">
                      Nessun materiale trovato
                    </p>
                    <p className="mt-1 text-xs text-pf-text-muted">
                      Crea il primo materiale per iniziare.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                materials.map((mat) => (
                  <tr
                    key={mat.id}
                    onClick={() => handleRowClick(mat.id)}
                    className="cursor-pointer border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-pf-text-secondary">
                        {mat.code}
                      </span>
                    </td>
                    <td className="overflow-hidden px-4 py-3">
                      <span className="block truncate text-sm font-medium text-pf-text-primary">
                        {mat.name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                      {mat.category ?? '-'}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary sm:table-cell">
                      {mat.unitPrimary}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                      {quantityFormatter.format(mat.stockPhysical)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm text-pf-text-primary lg:table-cell">
                      {quantityFormatter.format(mat.stockAvailable)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm text-pf-text-primary lg:table-cell">
                      {formatCurrency(mat.unitCost)}
                    </td>
                    <td className="px-4 py-3">
                      <StockLevelBadge
                        status={mat.stockStatus as StockStatusKey}
                      />
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

        {/* Form dialog */}
        <MaterialFormDialog open={formOpen} onOpenChange={setFormOpen} />
      </div>
    </PageTransition>
  )
}
