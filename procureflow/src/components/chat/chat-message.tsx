'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getToolLabel } from '@/hooks/use-chat'
import type { ChatMessage } from '@/hooks/use-chat'

// ---------------------------------------------------------------------------
// Singolo messaggio chat con markdown base e tool indicator
// ---------------------------------------------------------------------------

interface ChatMessageProps {
  readonly message: ChatMessage
}

/** Markdown base: bold, italic, code inline, liste puntate */
function renderMarkdown(text: string): string {
  return text
    // Code inline
    .replace(/`([^`]+)`/g, '<code class="rounded bg-pf-bg-hover px-1 py-0.5 text-xs font-mono">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // Liste puntate (linee che iniziano con "- ")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Newlines
    .replace(/\n/g, '<br />')
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const activeTools = (message.toolCalls ?? []).filter(
    (tc) => tc.status === 'running',
  )

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-2xl rounded-br-md bg-pf-accent text-white'
            : 'rounded-2xl rounded-bl-md bg-pf-bg-tertiary text-pf-text-primary',
        )}
      >
        {/* Tool indicators */}
        {activeTools.length > 0 && (
          <div className="mb-2 flex flex-col gap-1">
            {activeTools.map((tc) => (
              <div
                key={tc.name}
                className="flex items-center gap-1.5 text-xs text-pf-text-secondary"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{getToolLabel(tc.name)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content ? (
          <div
            className="chat-message-content"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(message.content),
            }}
          />
        ) : message.isStreaming ? (
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pf-text-muted [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pf-text-muted [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pf-text-muted [animation-delay:300ms]" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
