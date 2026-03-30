import { z } from 'zod'
import { auth } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'
import { streamAgentResponse } from '@/server/services/agent.service'
import type { UserRole } from '@/lib/ai/tool-registry'

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
  // Module guard
  const blocked = await requireModule('/api/chat')
  if (blocked) return blocked

  // Auth
  const session = await auth()
  if (!session?.user) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Sessione non valida' } },
      { status: 401 },
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { success: false, error: { code: 'INVALID_PAYLOAD', message: 'JSON non valido' } },
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

  const userId = session.user.id
  const role = (session.user.role ?? 'VIEWER') as UserRole

  // Streaming SSE response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamAgentResponse(
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
