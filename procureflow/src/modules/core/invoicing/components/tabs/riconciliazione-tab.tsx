'use client'

import { useState } from 'react'
import { CheckCheck, AlertTriangle, XCircle } from 'lucide-react'
import type { InvoiceDetail } from '../../hooks/use-invoice'
import { InvoiceStatusBadge } from '../invoice-status-badge'
import { ReconciliationDialog } from '../reconciliation-dialog'
import { formatCurrency, cn } from '@/lib/utils'

interface RiconciliazioneTabProps {
  invoice: InvoiceDetail
}

function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
        {label}
      </dt>
      <dd className="text-right text-sm text-pf-text-primary">{children}</dd>
    </div>
  )
}

export function RiconciliazioneTab({ invoice }: RiconciliazioneTabProps) {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    action: 'approve' | 'dispute' | 'reject'
  }>({ isOpen: false, action: 'approve' })

  const canAct =
    invoice.reconciliation_status === 'PENDING' ||
    invoice.reconciliation_status === 'MATCHED'

  const discrepancyColor =
    invoice.amount_discrepancy !== null
      ? invoice.amount_discrepancy > 0
        ? 'text-red-400'
        : invoice.amount_discrepancy < 0
          ? 'text-green-400'
          : 'text-pf-text-primary'
      : 'text-pf-text-primary'

  return (
    <>
      <div className="space-y-4">
        {/* Info Card */}
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Stato Riconciliazione
          </h3>
          <dl className="divide-y divide-pf-border">
            <InfoRow label="Stato">
              <InvoiceStatusBadge
                type="reconciliation"
                status={invoice.reconciliation_status}
              />
            </InfoRow>
            <InfoRow label="Discrepanza Importo">
              <span className={cn('font-mono', discrepancyColor)}>
                {invoice.amount_discrepancy !== null
                  ? formatCurrency(invoice.amount_discrepancy)
                  : '—'}
              </span>
            </InfoRow>
            <InfoRow label="Tipo Discrepanza">
              {invoice.discrepancy_type ?? '—'}
            </InfoRow>
            <InfoRow label="Discrepanza Risolta">
              {invoice.discrepancy_resolved ? 'Sì' : 'No'}
            </InfoRow>
            <InfoRow label="Note Riconciliazione">
              {invoice.reconciliation_notes ?? '—'}
            </InfoRow>
          </dl>
        </div>

        {/* Action Buttons */}
        {canAct && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setDialogState({ isOpen: true, action: 'approve' })
              }
              className="inline-flex items-center gap-2 rounded-button bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <CheckCheck className="h-4 w-4" />
              Approva
            </button>
            <button
              type="button"
              onClick={() =>
                setDialogState({ isOpen: true, action: 'dispute' })
              }
              className="inline-flex items-center gap-2 rounded-button bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            >
              <AlertTriangle className="h-4 w-4" />
              Contesta
            </button>
            <button
              type="button"
              onClick={() => setDialogState({ isOpen: true, action: 'reject' })}
              className="inline-flex items-center gap-2 rounded-button border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              <XCircle className="h-4 w-4" />
              Rifiuta
            </button>
          </div>
        )}
      </div>

      <ReconciliationDialog
        invoiceId={invoice.id}
        action={dialogState.action}
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  )
}
