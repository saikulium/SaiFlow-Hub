import { z } from 'zod'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
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

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
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
    return Response.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Massimo ${RATE_LIMIT_MAX} messaggi al minuto`,
        },
      },
      { status: 429 },
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'JSON non valido' },
      },
      { status: 400 },
    )
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Payload non valido',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      },
      { status: 400 },
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
