'use client'

import { MessageSquare, Eye, EyeOff, Loader2 } from 'lucide-react'
import { formatRelativeTime, getInitials } from '@/lib/utils'
import { CommentForm } from '@/components/requests/comment-form'
import { useComments } from '@/hooks/use-comments'
import { EmptyState } from './empty-state'

export function CommentiTab({ requestId }: { readonly requestId: string }) {
  const { data: comments, isLoading } = useComments(requestId)

  return (
    <div className="space-y-4">
      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-pf-text-muted" />
        </div>
      )}

      {/* Empty state */}
      {comments && comments.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title="Nessun commento"
          description="Aggiungi un commento per avviare la conversazione."
        />
      )}

      {/* Comment list */}
      {comments && comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 rounded-card border border-pf-border bg-pf-bg-secondary p-4"
            >
              <div className="bg-pf-accent/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-pf-accent">
                {getInitials(comment.author.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-pf-text-primary">
                    {comment.author.name}
                  </span>
                  {comment.is_internal ? (
                    <span className="inline-flex items-center gap-1 rounded-badge bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                      <EyeOff className="h-2.5 w-2.5" />
                      Interno
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-badge bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                      <Eye className="h-2.5 w-2.5" />
                      Fornitore
                    </span>
                  )}
                  <span className="text-xs text-pf-text-secondary">
                    {formatRelativeTime(comment.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-pf-text-secondary">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment form */}
      <CommentForm requestId={requestId} />
    </div>
  )
}
