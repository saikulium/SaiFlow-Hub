'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpDown, ArrowUp, ArrowDown, FileX2, Trash2 } from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import {
  useDeleteRecord,
  useBulkDelete,
  useIsAdmin,
} from '@/hooks/use-delete-record'
import { formatCurrency, formatRelativeTime, cn } from '@/lib/utils'
import type { RequestListItem } from '../hooks/use-requests'

interface SortState {
  sort: string
  order: 'asc' | 'desc'
}

interface RequestsTableProps {
  data: RequestListItem[]
  isLoading: boolean
  sort: string
  order: 'asc' | 'desc'
  onSortChange: (sort: string, order: 'asc' | 'desc') => void
}

interface ColumnDef {
  key: string
  label: string
  sortable: boolean
  className?: string
}

const COLUMNS: readonly ColumnDef[] = [
  { key: 'code', label: 'Codice', sortable: true, className: 'w-[120px]' },
  { key: 'title', label: 'Titolo', sortable: true },
  { key: 'status', label: 'Stato', sortable: true, className: 'w-[150px]' },
  {
    key: 'priority',
    label: 'Priorita',
    sortable: true,
    className: 'w-[110px]',
  },
  {
    key: 'vendor',
    label: 'Fornitore',
    sortable: false,
    className: 'w-[160px]',
  },
  {
    key: 'estimated_amount',
    label: 'Importo',
    sortable: true,
    className: 'w-[130px] text-right',
  },
  {
    key: 'created_at',
    label: 'Data Creazione',
    sortable: true,
    className: 'w-[140px]',
  },
] as const

function SortIcon({
  column,
  currentSort,
}: {
  column: string
  currentSort: SortState
}) {
  if (currentSort.sort !== column) {
    return <ArrowUpDown className="h-3 w-3 opacity-40" />
  }
  return currentSort.order === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-pf-accent" />
  ) : (
    <ArrowDown className="h-3 w-3 text-pf-accent" />
  )
}

function SkeletonRow() {
  return (
    <tr className="border-pf-border/50 border-b">
      <td className="px-4 py-3">
        <div className="bg-pf-bg-elevated h-4 w-4 animate-pulse rounded" />
      </td>
      {COLUMNS.map((col) => (
        <td key={col.key} className="px-4 py-3">
          <div className="bg-pf-bg-elevated h-4 w-20 animate-pulse rounded" />
        </td>
      ))}
    </tr>
  )
}

function DeleteButton({ onDelete }: { readonly onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onDelete()
      }}
      className="rounded-button p-1 text-pf-text-muted transition-all hover:bg-red-500/10 hover:text-red-400"
      title="Elimina"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

export function RequestsTable({
  data,
  isLoading,
  sort,
  order,
  onSortChange,
}: RequestsTableProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<RequestListItem | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const isAdmin = useIsAdmin()
  const deleteMutation = useDeleteRecord('requests')
  const bulkMutation = useBulkDelete('requests')

  const allIds = useMemo(() => data.map((r) => r.id), [data])
  const allSelected = data.length > 0 && selectedIds.size === data.length

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }, [allSelected, allIds])

  const handleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSort = useCallback(
    (column: string) => {
      if (sort === column) {
        onSortChange(column, order === 'asc' ? 'desc' : 'asc')
      } else {
        onSortChange(column, 'desc')
      }
    },
    [sort, order, onSortChange],
  )

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id, {
        onSuccess: () => setDeleteTarget(null),
      })
    }
  }, [deleteTarget, deleteMutation])

  const handleConfirmBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds)
    bulkMutation.mutate(ids, {
      onSuccess: () => {
        setBulkDeleteOpen(false)
        setSelectedIds(new Set())
      },
    })
  }, [selectedIds, bulkMutation])

  const currentSort: SortState = { sort, order }

  if (!isLoading && data.length === 0) {
    return (
      <div className="bg-pf-bg-secondary/60 flex min-h-[300px] flex-col items-center justify-center rounded-card border border-pf-border p-8 text-center backdrop-blur-xl">
        <FileX2 className="text-pf-text-secondary/40 mb-3 h-12 w-12" />
        <p className="font-display text-lg font-semibold text-pf-text-primary">
          Nessuna richiesta trovata
        </p>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Prova a modificare i filtri o crea una nuova richiesta.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-pf-bg-secondary/60 overflow-hidden rounded-card border border-pf-border backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-pf-bg-primary/40 border-b border-pf-border">
                <th className="w-[40px] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-pf-border bg-pf-bg-primary accent-pf-accent"
                  />
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary',
                      col.className,
                      col.sortable &&
                        'cursor-pointer select-none hover:text-pf-text-primary',
                    )}
                    onClick={
                      col.sortable ? () => handleSort(col.key) : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.label}
                      {col.sortable && (
                        <SortIcon column={col.key} currentSort={currentSort} />
                      )}
                    </span>
                  </th>
                ))}
                {isAdmin && <th className="w-[48px] px-2 py-3" />}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
                : data.map((request, index) => (
                    <motion.tr
                      key={request.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="border-pf-border/50 hover:bg-pf-bg-elevated/50 group border-b transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(request.id)}
                          onChange={() => handleSelectRow(request.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-pf-border bg-pf-bg-primary accent-pf-accent"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/requests/${request.id}`}
                          className="font-mono text-xs font-medium text-pf-accent hover:underline"
                        >
                          {request.code}
                        </Link>
                      </td>
                      <td className="max-w-[250px] truncate px-4 py-3">
                        <Link
                          href={`/requests/${request.id}`}
                          className="font-body text-sm text-pf-text-primary group-hover:text-pf-accent"
                        >
                          {request.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={request.priority} />
                      </td>
                      <td className="px-4 py-3 text-sm text-pf-text-secondary">
                        {request.vendor?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-pf-text-primary">
                        {request.estimated_amount !== null
                          ? formatCurrency(request.estimated_amount)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-pf-text-secondary">
                        {formatRelativeTime(request.created_at)}
                      </td>
                      {isAdmin && (
                        <td className="px-2 py-3">
                          <DeleteButton
                            onDelete={() => setDeleteTarget(request)}
                          />
                        </td>
                      )}
                    </motion.tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {isAdmin && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-card border border-pf-border bg-pf-bg-secondary px-5 py-3 shadow-2xl"
          >
            <span className="text-sm text-pf-text-secondary">
              <span className="font-medium text-pf-text-primary">
                {selectedIds.size}
              </span>{' '}
              selezionat{selectedIds.size === 1 ? 'a' : 'e'}
            </span>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="inline-flex items-center gap-2 rounded-button bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Elimina
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-pf-text-muted transition-colors hover:text-pf-text-secondary"
            >
              Annulla
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single delete dialog */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
        title="Elimina richiesta"
        description="Questa azione e irreversibile. La richiesta e tutti i dati associati verranno eliminati permanentemente."
        itemName={
          deleteTarget
            ? `${deleteTarget.code} — ${deleteTarget.title}`
            : undefined
        }
      />

      {/* Bulk delete dialog */}
      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleConfirmBulkDelete}
        isDeleting={bulkMutation.isPending}
        title="Elimina richieste selezionate"
        description="Questa azione e irreversibile. Le richieste selezionate verranno eliminate permanentemente. Solo le richieste in stato Bozza o Annullate verranno eliminate."
        count={selectedIds.size}
      />
    </>
  )
}
