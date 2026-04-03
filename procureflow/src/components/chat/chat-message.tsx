'use client'

interface ChatMessageBubbleProps {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export function ChatMessageBubble({ role, content }: ChatMessageBubbleProps) {
  return (
    <div
      className={`rounded-card p-3 text-sm ${
        role === 'user'
          ? 'ml-auto max-w-[80%] bg-pf-accent/10 text-pf-text-primary'
          : 'mr-auto max-w-[80%] bg-pf-bg-tertiary text-pf-text-primary'
      }`}
    >
      {content}
    </div>
  )
}
