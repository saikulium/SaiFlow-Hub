'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationBarProps {
  readonly page: number
  readonly totalPages: number
  readonly total: number
  readonly isLoading: boolean
  readonly onPrevPage: () => void
  readonly onNextPage: () => void
}

export function PaginationBar({
  page,
  totalPages,
  total,
  isLoading,
  onPrevPage,
  onNextPage,
}: PaginationBarProps) {
  if (isLoading || total <= 0) return null

  return (
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
          onClick={onPrevPage}
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
          onClick={onNextPage}
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
  )
}
