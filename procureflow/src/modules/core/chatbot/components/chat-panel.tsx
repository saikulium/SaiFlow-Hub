'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { X, Send, Trash2, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChat } from '../hooks/use-chat'
import { ChatMessageBubble } from './chat-message'
import { ActionConfirmationDialog } from './action-confirmation'

// ---------------------------------------------------------------------------
// Pannello chat slide-out a destra
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

const QUICK_SUGGESTIONS = [
  'Quante PR sono in attesa?',
  'Budget IT disponibile?',
  'Fatture non matchate',
  'Ultimi ordini',
] as const

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const {
    messages,
    isStreaming,
    sendMessage,
    clearMessages,
    pendingAction,
    confirmAction,
    cancelAction,
  } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages or when action dialog appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingAction])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return
    sendMessage(input)
    setInput('')
  }, [input, isStreaming, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      if (isStreaming) return
      sendMessage(suggestion)
    },
    [isStreaming, sendMessage],
  )

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-pf-border bg-pf-bg-primary shadow-2xl transition-transform duration-300 ease-in-out sm:w-[400px]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-pf-border px-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-pf-accent" />
            <h2 className="text-sm font-semibold text-pf-text-primary">
              Assistente AI
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                title="Cancella conversazione"
                className="flex h-8 w-8 items-center justify-center rounded-button text-pf-text-muted transition-colors hover:bg-pf-bg-hover hover:text-pf-text-secondary"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-button text-pf-text-muted transition-colors hover:bg-pf-bg-hover hover:text-pf-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Bot className="h-12 w-12 text-pf-text-muted" />
              <div>
                <p className="text-sm font-medium text-pf-text-secondary">
                  Chiedimi qualcosa
                </p>
                <p className="mt-1 text-xs text-pf-text-muted">
                  Posso cercare richieste, fornitori, budget, fatture e altro.
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestion(suggestion)}
                    className="rounded-full border border-pf-border bg-pf-bg-secondary px-3 py-1.5 text-xs text-pf-text-secondary transition-colors hover:border-pf-accent hover:text-pf-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {pendingAction && (
                <ActionConfirmationDialog
                  actionId={pendingAction.actionId}
                  tool={pendingAction.tool}
                  preview={pendingAction.preview}
                  onConfirm={confirmAction}
                  onCancel={cancelAction}
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-pf-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi una domanda..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-lg border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent disabled:opacity-50"
              style={{ maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pf-accent text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
