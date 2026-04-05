import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { APPROVAL_STATUS_CONFIG } from '@/lib/constants'
import { ApprovalActions } from '@/components/requests/approval-actions'
import type { RequestApproval } from '@/hooks/use-request'
import { EmptyState } from './empty-state'

export function ApprovazioniTab({
  approvals,
}: {
  readonly approvals: readonly RequestApproval[]
}) {
  if (approvals.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nessuna approvazione"
        description="Non sono ancora presenti approvazioni per questa richiesta."
      />
    )
  }

  return (
    <div className="space-y-3">
      {approvals.map((approval) => {
        const statusConfig = APPROVAL_STATUS_CONFIG[approval.status] ?? {
          label: approval.status,
          color: 'text-zinc-400',
          bgColor: 'bg-zinc-400/10',
        }
        const isPending = approval.status === 'PENDING'

        return (
          <div
            key={approval.id}
            className="rounded-card border border-pf-border bg-pf-bg-secondary p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-pf-text-primary">
                  {approval.approver.name}
                </p>
                <p className="text-xs text-pf-text-secondary">
                  {approval.approver.role}
                </p>
                {approval.comment && (
                  <p className="mt-2 text-sm text-pf-text-secondary">
                    {approval.comment}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    'inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium',
                    statusConfig.bgColor,
                    statusConfig.color,
                  )}
                >
                  {statusConfig.label}
                </span>
                {approval.decided_at && (
                  <span className="text-xs text-pf-text-secondary">
                    {formatDate(approval.decided_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Show approval actions for PENDING approvals */}
            {isPending && (
              <div className="mt-4 border-t border-pf-border pt-4">
                <ApprovalActions
                  approvalId={approval.id}
                  approverName={approval.approver.name}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
