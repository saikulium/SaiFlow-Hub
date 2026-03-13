'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpDown, ArrowUp, ArrowDown, FileX2 } from 'lucide-react'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { formatCurrency, formatDate, formatRelativeTime, cn } from '@/lib/utils'
import type { InvoiceListItem } from '@/hooks/use-invoices'

interface SortState {
  sort: string
  order: 'asc' | 'desc'
}

interface InvoicesTableProps {
  data: InvoiceListItem[]
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
  { key: 'invoice_number', label: 'N. Fattura', sortable: true, className: 'w-[140px]' },
  { key: 'invoice_date', label: 'Data', sortable: true, className: 'w-[110px]' },
  { key: 'supplier_name', label: 'Fornitore', sortable: false, className: 'w-[180px]' },
  { key: 'total_amount', label: 'Importo', sortable: true, className: 'w-[130px] text-right' },
  { key: 'match_status', label: 'Matching', sortable: true, className: 'w-[160px]' },
  { key: 'reconciliation_status', label: 'Riconciliazione', sortable: true, className: 'w-[160px]' },
  { key: 'purchase_request', label: 'Ordine', sortable: false, className: 'w-[120px]' },
  { key: 'received_at', label: 'Ricevuta', sortable: true, className: 'w-[130px]' },
] as const

function SortIcon({ column, currentSort }: { column: string; currentSort: SortState }) {
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
    <tr className="border-b border-pf-border/50">
      <td className="px-4 py-3">
        <div className="h-4 w-4 rounded bg-pf-bg-elevated animate-pulse" />
      </td>
      {COLUMNS.map((col) => (
        <td key={col.key} className="px-4 py-3">
          <div className="h-4 w-20 rounded bg-pf-bg-elevated animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

export function InvoicesTable({
  data,
  isLoading,
  sort,
  order,
  onSortChange,
}: InvoicesTableProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())

  const allIds = useMemo(() => data.map((inv) => inv.id), [data])
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

  const currentSort: SortState = { sort, order }

  if (!isLoading && data.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-card border border-pf-border bg-pf-bg-secondary/60 p-8 text-center backdrop-blur-xl">
        <FileX2 className="mb-3 h-12 w-12 text-pf-text-secondary/40" />
        <p className="font-display text-lg font-semibold text-pf-text-primary">
          Nessuna fattura trovata
        </p>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Prova a modificare i filtri o carica una nuova fattura.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-card border border-pf-border bg-pf-bg-secondary/60 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pf-border bg-pf-bg-primary/40">
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
                    col.sortable && 'cursor-pointer select-none hover:text-pf-text-primary',
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && <SortIcon column={col.key} currentSort={currentSort} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)
              : data.map((invoice, index) => (
                  <motion.tr
                    key={invoice.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="group border-b border-pf-border/50 transition-colors hover:bg-pf-bg-elevated/50"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(invoice.id)}
                        onChange={() => handleSelectRow(invoice.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-pf-border bg-pf-bg-primary accent-pf-accent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-mono text-xs font-medium text-pf-accent hover:underline"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-pf-text-secondary">
                      {formatDate(invoice.invoice_date)}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-sm text-pf-text-secondary">
                      {invoice.supplier_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-pf-text-primary">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge type="match" status={invoice.match_status} />
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge
                        type="reconciliation"
                        status={invoice.reconciliation_status}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {invoice.purchase_request ? (
                        <Link
                          href={`/requests/${invoice.purchase_request.id}`}
                          className="font-mono text-xs font-medium text-pf-accent hover:underline"
                        >
                          {invoice.purchase_request.code}
                        </Link>
                      ) : (
                        <span className="text-sm text-pf-text-secondary">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-pf-text-secondary">
                      {formatRelativeTime(invoice.received_at)}
                    </td>
                  </motion.tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
