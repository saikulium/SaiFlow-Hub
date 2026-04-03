'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, ChevronRight, FileSearch } from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import {
  TenderFiltersBar,
  type TenderFilters,
} from '@/components/tenders/tender-filters'
import { TenderStatusBadge } from '@/components/tenders/tender-status-badge'
import { TenderFormDialog } from '@/components/tenders/tender-form-dialog'
import { useTenders } from '@/hooks/use-tenders'
import { TENDER_TYPE_LABELS } from '@/lib/constants/tenders'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

const DEFAULT_PAGE_SIZE = 20

function GoNoGoBadge({
  decision,
  score,
}: {
  decision: string
  score: number | null
}) {
  if (decision === 'PENDING') {
    return (
      <span className="inline-flex items-center rounded-badge bg-zinc-400/10 px-2 py-0.5 text-xs font-medium text-zinc-400">
        In attesa
      </span>
    )
  }
  if (decision === 'GO') {
    return (
      <span className="inline-flex items-center gap-1 rounded-badge bg-green-400/10 px-2 py-0.5 text-xs font-medium text-green-400">
        GO {score != null && `(${score})`}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-badge bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-400">
      NO GO {score != null && `(${score})`}
    </span>
  )
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

export function TendersPageContent() {
  const router = useRouter()
  const [filters, setFilters] = useState<TenderFilters>({})
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const { data: response, isLoading } = useTenders({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: filters.search,
    status: filters.status,
    tender_type: filters.tender_type,
  })

  const tenders = response?.data ?? []
  const meta = response?.meta
  const total = meta?.total ?? 0
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1

  const handleFiltersChange = useCallback((newFilters: TenderFilters) => {
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
      router.push(`/tenders/${id}`)
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
              Gare d&apos;Appalto
            </h1>
            <p className="mt-1 text-sm text-pf-text-secondary">
              {isLoading ? 'Caricamento...' : `${total} gare totali`}
            </p>
          </div>

          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuova Gara
          </button>
        </div>

        {/* Filters */}
        <TenderFiltersBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Table */}
        <div className="bg-pf-bg-secondary/60 overflow-x-auto rounded-card border border-pf-border backdrop-blur-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pf-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Codice
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Titolo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Stato
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Tipo
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                  Ente
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
                  Importo Base
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                  Scadenza
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                  Go/No-Go
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
                  Responsabile
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}

              {!isLoading && tenders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <FileSearch className="mx-auto mb-3 h-10 w-10 text-pf-text-muted" />
                    <p className="text-sm font-medium text-pf-text-secondary">
                      Nessuna gara trovata
                    </p>
                    <p className="mt-1 text-xs text-pf-text-muted">
                      Prova a modificare i filtri o crea una nuova gara.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                tenders.map((tender) => (
                  <tr
                    key={tender.id}
                    onClick={() => handleRowClick(tender.id)}
                    className="cursor-pointer border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-pf-text-secondary">
                        {tender.code}
                      </span>
                    </td>
                    <td className="max-w-[200px] overflow-hidden px-4 py-3">
                      <span className="block truncate text-sm font-medium text-pf-text-primary">
                        {tender.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <TenderStatusBadge status={tender.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-pf-text-secondary">
                        {TENDER_TYPE_LABELS[tender.tenderType] ??
                          tender.tenderType}
                      </span>
                    </td>
                    <td className="hidden max-w-[160px] truncate px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                      {tender.contractingAuthority ?? '-'}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm text-pf-text-primary lg:table-cell">
                      {tender.baseAmount != null
                        ? formatCurrency(tender.baseAmount)
                        : '-'}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                      {tender.submissionDeadline
                        ? formatDate(tender.submissionDeadline)
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <GoNoGoBadge
                        decision={tender.goNoGo}
                        score={tender.goNoGoScore}
                      />
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-pf-text-secondary lg:table-cell">
                      {tender.assignedTo ?? '-'}
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
        <TenderFormDialog open={formOpen} onOpenChange={setFormOpen} />
      </div>
    </PageTransition>
  )
}
