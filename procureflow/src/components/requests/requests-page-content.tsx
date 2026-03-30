'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import {
  LayoutList,
  Kanban,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import {
  RequestFiltersBar,
  type RequestFilters,
} from '@/components/requests/request-filters'
import { RequestsTable } from '@/components/requests/requests-table'
import { RequestsKanban } from '@/components/requests/requests-kanban'
import { useRequests, type RequestsParams } from '@/hooks/use-requests'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { cn } from '@/lib/utils'

const REQUEST_CSV_COLUMNS = [
  {
    header: 'Codice',
    accessor: (r: Record<string, unknown>) => r.code as string,
  },
  {
    header: 'Titolo',
    accessor: (r: Record<string, unknown>) => r.title as string,
  },
  {
    header: 'Stato',
    accessor: (r: Record<string, unknown>) => r.status as string,
  },
  {
    header: 'Priorita',
    accessor: (r: Record<string, unknown>) => r.priority as string,
  },
  {
    header: 'Importo',
    accessor: (r: Record<string, unknown>) => r.estimated_amount as number,
  },
  {
    header: 'Valuta',
    accessor: (r: Record<string, unknown>) => r.currency as string,
  },
] as const

type ViewMode = 'table' | 'kanban'

const DEFAULT_PAGE_SIZE = 20

export function RequestsPageContent() {
  const [view, setView] = useState<ViewMode>('table')
  const [filters, setFilters] = useState<RequestFilters>({})
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('created_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const params: RequestsParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: filters.search,
    status: filters.status,
    priority: filters.priority,
    sort,
    order,
  }

  const { data: response, isLoading } = useRequests(params)

  const requests = response?.data ?? []
  const meta = response?.meta
  const total = meta?.total ?? 0
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1

  const handleFiltersChange = useCallback((newFilters: RequestFilters) => {
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

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-pf-text-primary">
              Richieste di Acquisto
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              {isLoading ? 'Caricamento...' : `${total} richieste totali`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="bg-pf-bg-primary/60 flex rounded-button border border-pf-border p-0.5">
              <button
                onClick={() => setView('table')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all',
                  view === 'table'
                    ? 'bg-pf-accent text-white shadow-sm'
                    : 'text-pf-text-secondary hover:text-pf-text-primary',
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Tabella
              </button>
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all',
                  view === 'kanban'
                    ? 'bg-pf-accent text-white shadow-sm'
                    : 'text-pf-text-secondary hover:text-pf-text-primary',
                )}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </button>
            </div>

            {/* Export CSV */}
            <ExportCsvButton
              data={requests}
              columns={REQUEST_CSV_COLUMNS}
              filename="richieste"
            />

            {/* New request button */}
            <Link
              href="/requests/new"
              className="hover:bg-pf-accent/90 inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nuova Richiesta
            </Link>
          </div>
        </div>

        {/* Filters */}
        <RequestFiltersBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Content */}
        {view === 'table' ? (
          <RequestsTable
            data={requests}
            isLoading={isLoading}
            sort={sort}
            order={order}
            onSortChange={handleSortChange}
          />
        ) : (
          <RequestsKanban data={requests} isLoading={isLoading} />
        )}

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
