'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useDecideApproval } from '@/hooks/use-approvals'
import { cn } from '@/lib/utils'

interface ApprovalActionsProps {
  approvalId: string
  approverName: string
  onSuccess?: () => void
}

export function ApprovalActions({
  approvalId,
  approverName,
  onSuccess,
}: ApprovalActionsProps) {
  const [showForm, setShowForm] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [notes, setNotes] = useState('')
  const { mutateAsync, isPending } = useDecideApproval()

  async function handleDecide(action: 'APPROVED' | 'REJECTED') {
    try {
      await mutateAsync({
        approvalId,
        action,
        notes: notes.trim() || undefined,
      })
      setShowForm(null)
      setNotes('')
      onSuccess?.()
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm(showForm === 'APPROVED' ? null : 'APPROVED')}
          disabled={isPending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-button px-4 py-2 text-sm font-medium transition-colors',
            showForm === 'APPROVED'
              ? 'bg-green-500 text-white'
              : 'border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20',
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          Approva
        </button>
        <button
          type="button"
          onClick={() => setShowForm(showForm === 'REJECTED' ? null : 'REJECTED')}
          disabled={isPending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-button px-4 py-2 text-sm font-medium transition-colors',
            showForm === 'REJECTED'
              ? 'bg-red-500 text-white'
              : 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
          )}
        >
          <XCircle className="h-4 w-4" />
          Rifiuta
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-card border border-pf-border bg-pf-bg-primary p-4 space-y-3">
              <p className="text-xs text-pf-text-secondary">
                {showForm === 'APPROVED'
                  ? `Stai approvando come ${approverName}`
                  : `Stai rifiutando come ${approverName}`}
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note (opzionale)..."
                rows={2}
                className="w-full resize-none rounded-button border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:outline-none focus:ring-2 focus:ring-pf-accent"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(null)
                    setNotes('')
                  }}
                  disabled={isPending}
                  className="rounded-button px-3 py-1.5 text-sm text-pf-text-secondary hover:text-pf-text-primary"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => handleDecide(showForm)}
                  disabled={isPending}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-button px-4 py-1.5 text-sm font-medium text-white',
                    showForm === 'APPROVED'
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600',
                    isPending && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Conferma
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
