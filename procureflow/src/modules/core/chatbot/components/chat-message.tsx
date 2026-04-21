'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getToolLabel } from '../hooks/use-chat'
import type { ChatMessage } from '../hooks/use-chat'

// ---------------------------------------------------------------------------
// Singolo messaggio chat con markdown base e tool indicator
// ---------------------------------------------------------------------------

interface ChatMessageProps {
  readonly message: ChatMessage
}

/**
 * Parse basic markdown into React nodes (safe — no dangerouslySetInnerHTML).
 * Supports: **bold**, *italic*, `code`, bullet lists, newlines.
 */
function renderMarkdownSafe(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (i > 0) nodes.push(<br key={`br-${i}`} />)

    const isBullet = /^- (.+)$/.exec(line)
    const content = isBullet ? isBullet[1]! : line

    const inlineNodes = parseInlineMarkdown(content, `line-${i}`)

    if (isBullet) {
      nodes.push(
        <li key={`li-${i}`} className="ml-4 list-disc">
          {inlineNodes}
        </li>,
      )
    } else {
      nodes.push(
        <React.Fragment key={`frag-${i}`}>{inlineNodes}</React.Fragment>,
      )
    }
  }

  return nodes
}

/** Parse inline markdown: **bold**, *italic*, `code` */
function parseInlineMarkdown(
  text: string,
  keyPrefix: string,
): React.ReactNode[] {
  const tokens: React.ReactNode[] = []
  // Match **bold**, *italic*, or `code`
  const regex = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(?<!\*)\*([^*]+)\*(?!\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let idx = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      // Bold
      tokens.push(<strong key={`${keyPrefix}-b-${idx}`}>{match[2]}</strong>)
    } else if (match[4]) {
      // Code
      tokens.push(
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="rounded bg-pf-bg-hover px-1 py-0.5 font-mono text-xs"
        >
          {match[4]}
        </code>,
      )
    } else if (match[5]) {
      // Italic
      tokens.push(<em key={`${keyPrefix}-i-${idx}`}>{match[5]}</em>)
    }

    lastIndex = match.index + match[0].length
    idx++
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex))
  }

  return tokens
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const activeTools = (message.toolCalls ?? []).filter(
    (tc) => tc.status === 'running',
  )

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
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
        {message.content && (
          <div className="chat-message-content">
            {renderMarkdownSafe(message.content)}
          </div>
        )}

        {/* Streaming indicator — shown while waiting for next chunk */}
        {message.isStreaming && activeTools.length === 0 && (
          <div
            className={cn('flex items-center gap-1', message.content && 'mt-2')}
          >
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pf-text-muted [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pf-text-muted [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pf-text-muted [animation-delay:300ms]" />
          </div>
        )}
      </div>
    </div>
  )
}
