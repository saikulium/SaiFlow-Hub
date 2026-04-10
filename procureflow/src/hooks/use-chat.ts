'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ActionPreview } from '@/types/ai'

// ---------------------------------------------------------------------------
// Hook per l'AI Agent — gestisce messaggi + streaming SSE + azioni
// ---------------------------------------------------------------------------

export interface ChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly isStreaming?: boolean
  readonly toolCalls?: ReadonlyArray<{
    readonly name: string
    readonly status: 'running' | 'done'
  }>
}

export interface PendingActionState {
  readonly actionId: string
  readonly tool: string
  readonly params: Record<string, unknown>
  readonly preview: ActionPreview
}

interface UseChatReturn {
  readonly messages: readonly ChatMessage[]
  readonly isStreaming: boolean
  readonly error: string | null
  readonly pendingAction: PendingActionState | null
  readonly sendMessage: (content: string) => void
  readonly clearMessages: () => void
  readonly confirmAction: (actionId: string) => void
  readonly cancelAction: (actionId: string) => void
}

let messageCounter = 0
function nextId(): string {
  messageCounter += 1
  return `msg-${messageCounter}-${Date.now()}`
}

// Nomi tool leggibili per l'utente
const TOOL_LABELS: Record<string, string> = {
  search_requests: 'Cerco nelle richieste...',
  get_request_detail: 'Carico dettaglio richiesta...',
  search_vendors: 'Cerco fornitori...',
  get_budget_overview: 'Controllo budget...',
  get_invoice_stats: 'Carico statistiche fatture...',
  search_invoices: 'Cerco fatture...',
  get_inventory_stats: 'Carico dati magazzino...',
  get_tender_stats: 'Carico dati gare...',
  create_request: "Creo richiesta d'acquisto...",
  update_request: 'Aggiorno richiesta...',
  submit_for_approval: 'Invio per approvazione...',
  approve_request: 'Approvo richiesta...',
  create_vendor: 'Creo fornitore...',
  bulk_update: 'Aggiornamento massivo...',
}

export function getToolLabel(name: string): string {
  return TOOL_LABELS[name] ?? `Eseguo ${name}...`
}

// Safety timeout: if streaming takes longer than 90s, force reset
const STREAMING_TIMEOUT_MS = 90_000

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(
    null,
  )
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Use a ref for messages so streamResponse always sees the latest
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Safety: force-reset isStreaming if stuck
  useEffect(() => {
    if (isStreaming) {
      timeoutRef.current = setTimeout(() => {
        setIsStreaming(false)
        setMessages((prev) =>
          prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
        )
      }, STREAMING_TIMEOUT_MS)
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isStreaming])

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return
      // Force reset if somehow stuck
      if (isStreaming && abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
        setIsStreaming(false)
      }
      if (isStreaming) {
        setIsStreaming(false)
      }

      const userMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: content.trim(),
      }

      const assistantId = nextId()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        toolCalls: [],
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)
      setError(null)

      // Use ref to get current messages (avoids stale closure)
      const apiMessages = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const controller = new AbortController()
      abortRef.current = controller

      streamResponse(apiMessages, assistantId, controller.signal)
    },
    [isStreaming],
  )

  function streamResponse(
    apiMessages: Array<{ role: string; content: string }>,
    assistantId: string,
    signal: AbortSignal,
  ) {
    doStream(apiMessages, assistantId, signal).catch((err) => {
      if ((err as Error).name !== 'AbortError') {
        setError(`Errore: ${String(err)}`)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Errore: ${String(err)}`, isStreaming: false }
              : m,
          ),
        )
      }
      setIsStreaming(false)
    })
  }

  async function doStream(
    apiMessages: Array<{ role: string; content: string }>,
    assistantId: string,
    signal: AbortSignal,
  ) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: apiMessages }),
        signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        const msg = data?.error?.message ?? `Errore ${res.status}`
        setError(msg)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: msg, isStreaming: false }
              : m,
          ),
        )
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)

          let event: Record<string, unknown>
          try {
            event = JSON.parse(jsonStr)
          } catch {
            continue
          }

          const eventType = event.type as string

          if (eventType === 'text') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: m.content + ((event.content as string) ?? ''),
                    }
                  : m,
              ),
            )
          } else if (eventType === 'tool_start') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      toolCalls: [
                        ...(m.toolCalls ?? []),
                        {
                          name: event.name as string,
                          status: 'running' as const,
                        },
                      ],
                    }
                  : m,
              ),
            )
          } else if (eventType === 'tool_end') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      toolCalls: (m.toolCalls ?? []).map((tc) =>
                        tc.name === (event.name as string)
                          ? { ...tc, status: 'done' as const }
                          : tc,
                      ),
                    }
                  : m,
              ),
            )
          } else if (eventType === 'action_request') {
            setPendingAction({
              actionId: event.actionId as string,
              tool: event.tool as string,
              params: event.params as Record<string, unknown>,
              preview: event.preview as ActionPreview,
            })
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, isStreaming: false, toolCalls: [] }
                  : m,
              ),
            )
          } else if (eventType === 'error') {
            const msg = (event.message as string) ?? 'Errore sconosciuto'
            setError(msg)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: m.content || msg,
                      isStreaming: false,
                    }
                  : m,
              ),
            )
          } else if (eventType === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, isStreaming: false, toolCalls: [] }
                  : m,
              ),
            )
          }
        }
      }
    } finally {
      setIsStreaming(false)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m,
        ),
      )
    }
  }

  const confirmAction = useCallback(async (actionId: string) => {
    try {
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actionId }),
      })
      const data = await res.json()

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: 'Azione eseguita con successo.',
          },
        ])
      } else {
        setError(data.error?.message ?? 'Errore nella conferma')
      }
    } catch {
      setError("Errore di connessione durante la conferma dell'azione")
    } finally {
      setPendingAction(null)
    }
  }, [])

  const cancelAction = useCallback(async (actionId: string) => {
    try {
      await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actionId, cancelled: true }),
      })
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: 'Azione annullata.',
        },
      ])
    } catch {
      // Silent — action was cancelled anyway
    } finally {
      setPendingAction(null)
    }
  }, [])

  const clearMessages = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setMessages([])
    setIsStreaming(false)
    setError(null)
    setPendingAction(null)
  }, [])

  return {
    messages,
    isStreaming,
    error,
    pendingAction,
    sendMessage,
    clearMessages,
    confirmAction,
    cancelAction,
  }
}
