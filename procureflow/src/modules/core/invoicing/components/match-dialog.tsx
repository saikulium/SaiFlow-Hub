'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Search, Loader2, Link as LinkIcon } from 'lucide-react'
import { useRequests } from '@/hooks/use-requests'
import { useMatchInvoice } from '../hooks/use-invoice'
import { useDebounce } from '@/hooks/use-debounce'
import { formatCurrency } from '@/lib/utils'

interface MatchDialogProps {
  invoiceId: string
  isOpen: boolean
  onClose: () => void
}

export function MatchDialog({ invoiceId, isOpen, onClose }: MatchDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)

  const { data: requestsData, isLoading } = useRequests({
    search: debouncedSearch,
    pageSize: 10,
  })

  const matchMutation = useMatchInvoice(invoiceId)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  function handleMatch(requestId: string) {
    matchMutation.mutate(requestId, {
      onSuccess: () => onClose(),
    })
  }

  if (!isOpen) return null

  const requests = requestsData?.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClose()
        }}
        role="button"
        tabIndex={-1}
        aria-label="Chiudi dialogo"
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-card border border-pf-border bg-pf-bg-secondary p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Associa Ordine
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-button text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cerca per codice o titolo..."
            className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary pl-10 pr-4 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-pf-text-muted" />
            </div>
          )}

          {!isLoading && requests.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-pf-text-secondary">
                {debouncedSearch
                  ? 'Nessuna richiesta trovata'
                  : 'Inizia a digitare per cercare'}
              </p>
            </div>
          )}

          {!isLoading && requests.length > 0 && (
            <div className="space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-3 rounded-button border border-pf-border p-3 transition-colors hover:bg-pf-bg-hover"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-pf-accent">
                        {request.code}
                      </span>
                      {request.vendor && (
                        <span className="text-xs text-pf-text-muted">
                          {request.vendor.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-pf-text-primary">
                      {request.title}
                    </p>
                    {request.estimated_amount !== null && (
                      <p className="mt-0.5 font-mono text-xs text-pf-text-secondary">
                        {formatCurrency(request.estimated_amount)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={matchMutation.isPending}
                    onClick={() => handleMatch(request.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-button bg-pf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
                  >
                    {matchMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LinkIcon className="h-3.5 w-3.5" />
                    )}
                    Associa
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
