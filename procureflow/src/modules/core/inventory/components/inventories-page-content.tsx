'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  X,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import {
  useInventories,
  useCreateInventory,
} from '../hooks/use-inventory-check'
import { useWarehouses } from '../hooks/use-stock'
import { INVENTORY_STATUS_CONFIG } from '../constants/inventory'
import { cn, formatDate } from '@/lib/utils'

const DEFAULT_PAGE_SIZE = 20

function InventoryStatusBadge({ status }: { readonly status: string }) {
  const config = INVENTORY_STATUS_CONFIG[status]
  if (!config) {
    return <span className="text-xs text-pf-text-secondary">{status}</span>
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

interface NewInventoryFormState {
  warehouse_id: string
  notes: string
}

const INITIAL_NEW_FORM: NewInventoryFormState = {
  warehouse_id: '',
  notes: '',
}

function NewInventoryDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = useState<NewInventoryFormState>(INITIAL_NEW_FORM)
  const createMutation = useCreateInventory()
  const { data: warehouses } = useWarehouses()

  const inputClassName =
    'w-full rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/60 focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent'
  const labelClassName = 'block text-xs font-medium text-pf-text-secondary mb-1'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.warehouse_id) return
    createMutation.mutate(
      {
        warehouse_id: form.warehouse_id,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          setForm(INITIAL_NEW_FORM)
          onOpenChange(false)
        },
      },
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative mx-4 w-full max-w-md rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        <div className="flex items-center justify-between border-b border-pf-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Nuovo Inventario
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-button p-1 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div>
            <label className={labelClassName}>Magazzino *</label>
            <select
              value={form.warehouse_id}
              onChange={(e) =>
                setForm({ ...form, warehouse_id: e.target.value })
              }
              className={inputClassName}
            >
              <option value="">Seleziona magazzino...</option>
              {(warehouses ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Note</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClassName}
              placeholder="Note opzionali..."
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !form.warehouse_id}
              className={cn(
                'rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover',
                (createMutation.isPending || !form.warehouse_id) &&
                  'cursor-not-allowed opacity-60',
              )}
            >
              {createMutation.isPending ? 'Creazione...' : 'Crea Inventario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function InventoriesPageContent() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const { data: response, isLoading } = useInventories({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const inventories = response?.data ?? []
  const meta = response?.meta
  const total = meta?.total ?? 0
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1

  const handlePrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1))
  }, [totalPages])

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/inventory/inventories/${id}`)
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
              Inventari Periodici
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              {isLoading ? 'Caricamento...' : `${total} inventari totali`}
            </p>
          </div>

          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuovo Inventario
          </button>
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
                  Magazzino
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Stato
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary sm:table-cell">
                  Righe
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                  Varianze
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
                  Creato da
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                  Data Inizio
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
                  Data Fine
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}

              {!isLoading && inventories.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-pf-text-muted" />
                    <p className="text-sm font-medium text-pf-text-secondary">
                      Nessun inventario trovato
                    </p>
                    <p className="mt-1 text-xs text-pf-text-muted">
                      Crea il primo inventario per iniziare il conteggio.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                inventories.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => handleRowClick(inv.id)}
                    className="cursor-pointer border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-pf-text-secondary">
                        {inv.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-pf-text-primary">
                      {inv.warehouseName}
                    </td>
                    <td className="px-4 py-3">
                      <InventoryStatusBadge status={inv.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm text-pf-text-primary sm:table-cell">
                      {inv.linesCount}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm md:table-cell">
                      <span
                        className={cn(
                          inv.varianceCount > 0
                            ? 'text-amber-400'
                            : 'text-pf-text-secondary',
                        )}
                      >
                        {inv.varianceCount}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary lg:table-cell">
                      {inv.createdBy}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                      {inv.startedAt ? formatDate(inv.startedAt) : '-'}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary lg:table-cell">
                      {inv.completedAt ? formatDate(inv.completedAt) : '-'}
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

        <NewInventoryDialog open={formOpen} onOpenChange={setFormOpen} />
      </div>
    </PageTransition>
  )
}
