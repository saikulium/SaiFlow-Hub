'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, Loader2, Unlink } from 'lucide-react'
import type { InvoiceDetail } from '@/hooks/use-invoice'
import { useUnmatchInvoice } from '@/hooks/use-invoice'
import { StatusBadge } from '@/components/shared/status-badge'
import type { RequestStatusKey } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { MatchDialog } from '../match-dialog'

interface OrdineTabProps {
  invoice: InvoiceDetail
}

export function OrdineTab({ invoice }: OrdineTabProps) {
  const [showMatchDialog, setShowMatchDialog] = useState(false)
  const unmatchMutation = useUnmatchInvoice(invoice.id)

  const pr = invoice.purchase_request

  if (!pr) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pf-bg-tertiary">
            <ShoppingCart className="h-6 w-6 text-pf-text-secondary" />
          </div>
          <p className="text-sm font-medium text-pf-text-primary">
            Fattura non associata a nessun ordine
          </p>
          <p className="mt-1 text-xs text-pf-text-secondary">
            Associa questa fattura a una richiesta di acquisto esistente.
          </p>
          <button
            type="button"
            onClick={() => setShowMatchDialog(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
          >
            Associa ordine
          </button>
        </div>

        {showMatchDialog && (
          <MatchDialog
            invoiceId={invoice.id}
            isOpen={showMatchDialog}
            onClose={() => setShowMatchDialog(false)}
          />
        )}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* PR Info Card */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Richiesta di Acquisto
              </p>
              <Link
                href={`/requests/${pr.id}`}
                className="mt-1 inline-block font-mono text-sm font-medium text-pf-accent transition-colors hover:text-pf-accent-hover"
              >
                {pr.code}
              </Link>
            </div>
            <p className="text-sm font-medium text-pf-text-primary">
              {pr.title}
            </p>
            <div className="flex items-center gap-3">
              <StatusBadge status={pr.status as RequestStatusKey} />
              <span className="text-xs text-pf-text-secondary">
                Richiedente: {pr.requester.name}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={unmatchMutation.isPending}
            onClick={() => unmatchMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-button border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            {unmatchMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlink className="h-3.5 w-3.5" />
            )}
            Scollega fattura
          </button>
        </div>

        {/* Amounts */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-pf-border pt-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Importo Stimato
            </p>
            <p className="mt-1 font-mono text-sm text-pf-text-primary">
              {pr.estimated_amount !== null
                ? formatCurrency(pr.estimated_amount)
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Importo Effettivo
            </p>
            <p className="mt-1 font-mono text-sm text-pf-text-primary">
              {pr.actual_amount !== null
                ? formatCurrency(pr.actual_amount)
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* PR Items Table */}
      {pr.items.length > 0 && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Articoli Ordine ({pr.items.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border text-left text-xs text-pf-text-secondary">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 text-right font-medium">Quantità</th>
                  <th className="pb-2 pr-4 text-right font-medium">
                    Prezzo Unit.
                  </th>
                  <th className="pb-2 text-right font-medium">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pf-border">
                {pr.items.map((item) => (
                  <tr key={item.id} className="text-pf-text-primary">
                    <td className="py-2.5 pr-4 font-medium">{item.name}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono">
                      {item.unit_price !== null
                        ? formatCurrency(item.unit_price)
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono font-medium">
                      {item.total_price !== null
                        ? formatCurrency(item.total_price)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
