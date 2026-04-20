'use client'

import { useState } from 'react'
import { Send, Loader2, Eye, EyeOff } from 'lucide-react'
import { useCreateComment } from '../hooks/use-comments'
import { cn } from '@/lib/utils'

interface CommentFormProps {
  requestId: string
}

export function CommentForm({ requestId }: CommentFormProps) {
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(true)
  const { mutateAsync, isPending } = useCreateComment(requestId)

  async function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed) return

    try {
      await mutateAsync({ content: trimmed, is_internal: isInternal })
      setContent('')
    } catch {
      // Error handled by mutation
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-3 rounded-card border border-pf-border bg-pf-bg-secondary p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scrivi un commento... (⌘+Invio per inviare)"
        rows={3}
        disabled={isPending}
        className="w-full resize-none rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:outline-none focus:ring-2 focus:ring-pf-accent disabled:opacity-50"
      />

      <div className="flex items-center justify-between">
        {/* Visibility toggle */}
        <button
          type="button"
          onClick={() => setIsInternal(!isInternal)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-badge px-2.5 py-1 text-xs font-medium transition-colors',
            isInternal
              ? 'bg-blue-500/10 text-blue-400'
              : 'bg-amber-500/10 text-amber-400',
          )}
        >
          {isInternal ? (
            <>
              <EyeOff className="h-3 w-3" />
              Interno
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Visibile al Fornitore
            </>
          )}
        </button>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim() || isPending}
          className="inline-flex items-center gap-1.5 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Invia
        </button>
      </div>
    </div>
  )
}
