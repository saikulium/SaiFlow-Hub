'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Lock } from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import {
  useInventory,
  useUpdateInventoryLines,
  useCloseInventory,
} from '../hooks/use-inventory-check'
import { INVENTORY_STATUS_CONFIG } from '../constants/inventory'
import { cn } from '@/lib/utils'

const quantityFormatter = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 3,
})

function InventoryStatusBadge({ status }: { readonly status: string }) {
  const config = INVENTORY_STATUS_CONFIG[status]
  if (!config) {
    return <span className="text-xs text-pf-text-secondary">{status}</span>
  }
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge px-2.5 py-1 text-xs font-medium',
        config.bgColor,
        config.color,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}

export function InventoryDetailContent() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: inventory, isLoading } = useInventory(params.id ?? null)
  const updateLinesMutation = useUpdateInventoryLines()
  const closeMutation = useCloseInventory()

  // Local state for editable counted quantities, keyed by line ID
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [confirmClose, setConfirmClose] = useState(false)

  const isEditable =
    inventory?.status === 'IN_PROGRESS' || inventory?.status === 'DRAFT'

  // Initialize counts from inventory data when loaded
  const lines = inventory?.lines ?? []

  const getCountedValue = useCallback(
    (lineId: string, serverValue: number | null): string => {
      if (counts[lineId] !== undefined) return counts[lineId]
      return serverValue !== null ? String(serverValue) : ''
    },
    [counts],
  )

  const handleCountChange = useCallback((lineId: string, value: string) => {
    setCounts((prev) => ({ ...prev, [lineId]: value }))
  }, [])

  const handleSave = useCallback(() => {
    if (!inventory) return
    const updatedLines = Object.entries(counts)
      .filter(([, val]) => val !== '')
      .map(([id, val]) => ({
        id,
        counted_quantity: Number(val),
      }))

    if (updatedLines.length === 0) return

    updateLinesMutation.mutate({
      id: inventory.id,
      lines: updatedLines,
    })
  }, [inventory, counts, updateLinesMutation])

  const handleClose = useCallback(() => {
    if (!inventory) return
    closeMutation.mutate(inventory.id, {
      onSuccess: () => setConfirmClose(false),
    })
  }, [inventory, closeMutation])

  const varianceSummary = useMemo(() => {
    let totalVariances = 0
    for (const line of lines) {
      const counted =
        counts[line.id] !== undefined
          ? Number(counts[line.id])
          : line.countedQuantity
      if (counted !== null && counted !== undefined) {
        const variance = counted - line.expectedQuantity
        if (variance !== 0) totalVariances++
      }
    }
    return totalVariances
  }, [lines, counts])

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <div className="skeleton-shimmer h-8 w-60 rounded" />
          <div className="skeleton-shimmer h-4 w-40 rounded" />
          <div className="skeleton-shimmer h-96 rounded-card" />
        </div>
      </PageTransition>
    )
  }

  if (!inventory) {
    return (
      <PageTransition>
        <div className="py-16 text-center">
          <p className="text-sm text-pf-text-secondary">
            Inventario non trovato
          </p>
          <button
            onClick={() => router.push('/inventory/inventories')}
            className="mt-4 text-sm text-pf-accent hover:underline"
          >
            Torna alla lista
          </button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              onClick={() => router.push('/inventory/inventories')}
              className="mb-2 inline-flex items-center gap-1 text-sm text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Inventari
            </button>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-pf-text-primary">
                {inventory.code}
              </h1>
              <InventoryStatusBadge status={inventory.status} />
            </div>
            <p className="mt-1 text-sm text-pf-text-secondary">
              {inventory.warehouseName}
              {inventory.notes && (
                <span className="ml-2 text-pf-text-muted">
                  &mdash; {inventory.notes}
                </span>
              )}
            </p>
          </div>

          {isEditable && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={
                  updateLinesMutation.isPending ||
                  Object.keys(counts).length === 0
                }
                className={cn(
                  'inline-flex items-center gap-2 rounded-button border border-pf-border px-4 py-2 text-sm font-medium transition-colors',
                  Object.keys(counts).length === 0
                    ? 'text-pf-text-secondary/40 cursor-not-allowed'
                    : 'text-pf-text-secondary hover:text-pf-text-primary',
                )}
              >
                <Save className="h-4 w-4" />
                {updateLinesMutation.isPending
                  ? 'Salvataggio...'
                  : 'Salva Conteggi'}
              </button>
              <button
                onClick={() => setConfirmClose(true)}
                disabled={closeMutation.isPending}
                className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover"
              >
                <Lock className="h-4 w-4" />
                Chiudi Inventario
              </button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="flex items-center gap-6 text-sm">
          <span className="text-pf-text-secondary">
            Righe:{' '}
            <span className="font-medium text-pf-text-primary">
              {lines.length}
            </span>
          </span>
          <span className="text-pf-text-secondary">
            Varianze:{' '}
            <span
              className={cn(
                'font-medium',
                varianceSummary > 0 ? 'text-amber-400' : 'text-pf-text-primary',
              )}
            >
              {varianceSummary}
            </span>
          </span>
        </div>

        {/* Lines table */}
        <div className="bg-pf-bg-secondary/60 overflow-x-auto rounded-card border border-pf-border backdrop-blur-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pf-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Materiale
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary sm:table-cell">
                  Lotto
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                  Zona
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Attesa
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Contata
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Varianza
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-pf-text-muted"
                  >
                    Nessuna riga disponibile
                  </td>
                </tr>
              )}
              {lines.map((line) => {
                const countedStr = getCountedValue(
                  line.id,
                  line.countedQuantity,
                )
                const counted = countedStr !== '' ? Number(countedStr) : null
                const variance =
                  counted !== null ? counted - line.expectedQuantity : null

                return (
                  <tr
                    key={line.id}
                    className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-pf-text-primary">
                        {line.materialName}
                      </span>
                      <span className="ml-1.5 font-mono text-xs text-pf-text-muted">
                        {line.materialCode}
                      </span>
                      <span className="ml-1 text-xs text-pf-text-secondary">
                        ({line.unit})
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary sm:table-cell">
                      -
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                      -
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                      {quantityFormatter.format(line.expectedQuantity)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditable ? (
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={countedStr}
                          onChange={(e) =>
                            handleCountChange(line.id, e.target.value)
                          }
                          className="bg-pf-bg-primary/50 w-24 rounded-button border border-pf-border px-2 py-1 text-right text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
                          placeholder="-"
                        />
                      ) : (
                        <span className="text-sm text-pf-text-primary">
                          {counted !== null
                            ? quantityFormatter.format(counted)
                            : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {variance !== null ? (
                        <span
                          className={cn(
                            'text-sm font-medium',
                            variance > 0
                              ? 'text-green-400'
                              : variance < 0
                                ? 'text-red-400'
                                : 'text-pf-text-secondary',
                          )}
                        >
                          {variance > 0 ? '+' : ''}
                          {quantityFormatter.format(variance)}
                        </span>
                      ) : (
                        <span className="text-sm text-pf-text-muted">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Close confirmation dialog */}
        {confirmClose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmClose(false)}
            />
            <div className="relative mx-4 w-full max-w-sm rounded-card border border-pf-border bg-pf-bg-secondary p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-pf-text-primary">
                Chiudere inventario?
              </h3>
              <p className="mt-2 text-sm text-pf-text-secondary">
                Una volta chiuso, non sara possibile modificare i conteggi. Le
                varianze verranno registrate come movimenti di rettifica.
              </p>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirmClose(false)}
                  className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
                >
                  Annulla
                </button>
                <button
                  onClick={handleClose}
                  disabled={closeMutation.isPending}
                  className={cn(
                    'rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover',
                    closeMutation.isPending && 'cursor-not-allowed opacity-60',
                  )}
                >
                  {closeMutation.isPending
                    ? 'Chiusura...'
                    : 'Conferma Chiusura'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
