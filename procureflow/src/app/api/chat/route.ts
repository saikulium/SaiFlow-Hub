import { z } from 'zod'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { errorResponse } from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { streamAssistantResponse } from '@/server/agents/procurement-assistant.agent'
import type { UserRole } from '@/server/agents/procurement-assistant.agent'

// ---------------------------------------------------------------------------
// Rate limiting: max 10 messaggi per utente per minuto (in-memory)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10

const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const existing = rateLimitMap.get(userId) ?? []
  const recent = existing.filter((ts: number) => ts > windowStart)

  if (recent.length >= RATE_LIMIT_MAX) {
    return false
  }

  rateLimitMap.set(userId, [...recent, now])
  return true
}

// Cleanup periodico per evitare memory leak
setInterval(() => {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const entries = Array.from(rateLimitMap.entries())
  for (const [userId, timestamps] of entries) {
    const recent = timestamps.filter((ts: number) => ts > windowStart)
    if (recent.length === 0) {
      rateLimitMap.delete(userId)
    } else {
      rateLimitMap.set(userId, recent)
    }
  }
}, RATE_LIMIT_WINDOW_MS)

// ---------------------------------------------------------------------------
// POST /api/chat — AI Agent con streaming SSE
//
// Richiede sessione NextAuth valida.
// Modulo 'chatbot' deve essere attivo.
// ---------------------------------------------------------------------------

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(50)
    .transform((msgs) =>
      // Filter out empty assistant placeholder messages before processing
      msgs.filter((m) => m.content.trim().length > 0),
    ),
})

export async function POST(req: Request) {
  // Auth
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  // Module guard
  const blocked = await requireModule('/api/chat')
  if (blocked) return blocked

  // Rate limiting
  if (!checkRateLimit(authResult.id)) {
    return errorResponse(
      'RATE_LIMITED',
      `Massimo ${RATE_LIMIT_MAX} messaggi al minuto`,
      429,
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('INVALID_PAYLOAD', 'JSON non valido', 400)
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', 'Payload non valido', 400)
  }

  // After transform, ensure we still have messages with at least one user message
  if (
    parsed.data.messages.length === 0 ||
    parsed.data.messages[0]?.role !== 'user'
  ) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Almeno un messaggio utente richiesto',
      400,
    )
  }

  const userId = authResult.id
  const role = (authResult.role ?? 'VIEWER') as UserRole

  // Streaming SSE response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamAssistantResponse(
          userId,
          role,
          parsed.data.messages,
        )) {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }
      } catch (err) {
        const errorEvent = {
          type: 'error',
          message: `Errore interno: ${String(err)}`,
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
