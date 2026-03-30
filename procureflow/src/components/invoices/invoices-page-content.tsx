'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import {
  InvoiceFiltersBar,
  type InvoiceFilters,
} from '@/components/invoices/invoice-filters'
import { InvoicesTable } from '@/components/invoices/invoices-table'
import {
  useInvoices,
  type InvoicesParams,
  type InvoiceListItem,
} from '@/hooks/use-invoices'
import { useUploadInvoice } from '@/hooks/use-invoice'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { cn } from '@/lib/utils'

const INVOICE_CSV_COLUMNS = [
  { header: 'Numero', accessor: (i: InvoiceListItem) => i.invoice_number },
  { header: 'Fornitore', accessor: (i: InvoiceListItem) => i.supplier_name },
  { header: 'Importo', accessor: (i: InvoiceListItem) => i.total_amount },
  { header: 'Valuta', accessor: (i: InvoiceListItem) => i.currency },
  {
    header: 'Stato',
    accessor: (i: InvoiceListItem) => i.reconciliation_status,
  },
]

const DEFAULT_PAGE_SIZE = 20

export function InvoicesPageContent() {
  const [filters, setFilters] = useState<InvoiceFilters>({})
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('received_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useUploadInvoice()

  const params: InvoicesParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: filters.search,
    match_status: filters.match_status,
    reconciliation_status: filters.reconciliation_status,
    sort,
    order,
  }

  const { data: response, isLoading } = useInvoices(params)

  const invoices = response?.data ?? []
  const meta = response?.meta
  const total = meta?.total ?? 0
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1

  const handleFiltersChange = useCallback((newFilters: InvoiceFilters) => {
    setFilters(newFilters)
    setPage(1)
  }, [])

  const handleSortChange = useCallback(
    (newSort: string, newOrder: 'asc' | 'desc') => {
      setSort(newSort)
      setOrder(newOrder)
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

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        uploadMutation.mutate(file)
      }
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [uploadMutation],
  )

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-pf-text-primary">
              Fatture
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              {isLoading ? 'Caricamento...' : `${total} fatture totali`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ExportCsvButton
              data={invoices}
              columns={INVOICE_CSV_COLUMNS}
              filename="fatture"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.p7m,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={handleUploadClick}
              disabled={uploadMutation.isPending}
              className={cn(
                'hover:bg-pf-accent/90 inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors',
                uploadMutation.isPending && 'cursor-not-allowed opacity-60',
              )}
            >
              <Upload className="h-4 w-4" />
              {uploadMutation.isPending ? 'Caricamento...' : 'Carica Fattura'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <InvoiceFiltersBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Table */}
        <InvoicesTable
          data={invoices}
          isLoading={isLoading}
          sort={sort}
          order={order}
          onSortChange={handleSortChange}
        />

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
      </div>
    </PageTransition>
  )
}
