'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileSearch } from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { SkeletonRows } from '@/components/shared/skeleton-row'
import { TableEmptyState } from '@/components/shared/table-empty-state'
import { DeleteRowButton } from '@/components/shared/delete-row-button'
import { TenderFiltersBar, type TenderFilters } from './tender-filters'
import { TenderStatusBadge } from './tender-status-badge'
import { TenderFormDialog } from './tender-form-dialog'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { useDeleteRecord, useIsAdmin } from '@/hooks/use-delete-record'
import { useTenders } from '../hooks/use-tenders'
import { TENDER_TYPE_LABELS } from '../constants'
import { formatCurrency, formatDate } from '@/lib/utils'

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

export function TendersPageContent() {
  const router = useRouter()
  const [filters, setFilters] = useState<TenderFilters>({})
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    code: string
    title: string
  } | null>(null)

  const isAdmin = useIsAdmin()
  const deleteMutation = useDeleteRecord('tenders')

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
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[120px]" />
              <col />
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="hidden w-[140px] md:table-column" />
              <col className="hidden w-[120px] lg:table-column" />
              <col className="hidden w-[100px] md:table-column" />
              <col className="w-[90px]" />
              <col className="hidden w-[110px] lg:table-column" />
              {isAdmin && <col className="w-[48px]" />}
            </colgroup>
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
                {isAdmin && <th className="px-2 py-3" />}
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonRows columns={9} />}

              {!isLoading && tenders.length === 0 && (
                <TableEmptyState
                  icon={FileSearch}
                  colSpan={9}
                  title="Nessuna gara trovata"
                  description="Prova a modificare i filtri o crea una nuova gara."
                />
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
                    <td className="overflow-hidden px-4 py-3">
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
                    <td className="hidden overflow-hidden px-4 py-3 md:table-cell">
                      <span className="block truncate text-sm text-pf-text-secondary">
                        {tender.contractingAuthority ?? '-'}
                      </span>
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
                    {isAdmin && (
                      <td className="px-2 py-3">
                        <DeleteRowButton
                          onDelete={() => {
                            setDeleteTarget({
                              id: tender.id,
                              code: tender.code,
                              title: tender.title,
                            })
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          isLoading={isLoading}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />

        {/* Form dialog */}
        <TenderFormDialog open={formOpen} onOpenChange={setFormOpen} />

        {/* Delete confirm dialog */}
        <DeleteConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onConfirm={() => {
            if (deleteTarget) {
              deleteMutation.mutate(deleteTarget.id, {
                onSuccess: () => setDeleteTarget(null),
              })
            }
          }}
          isDeleting={deleteMutation.isPending}
          title="Elimina gara"
          description="Questa azione e irreversibile. Solo le gare in stato DISCOVERED possono essere eliminate."
          itemName={
            deleteTarget
              ? `${deleteTarget.code} — ${deleteTarget.title}`
              : undefined
          }
        />
      </div>
    </PageTransition>
  )
}
