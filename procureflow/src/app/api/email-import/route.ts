import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { processEmail } from '@/server/agents/email-intelligence.agent'
import type { RawEmailData } from '@/server/services/email-ai-classifier.service'

// ---------------------------------------------------------------------------
// POST /api/email-import
//
// Importazione manuale email — autenticato via sessione (ADMIN/MANAGER).
// L'utente incolla mittente, oggetto e corpo dell'email.
// L'Email Intelligence Agent classifica, cerca nel DB, e agisce.
// ---------------------------------------------------------------------------

const manualEmailSchema = z.object({
  email_from: z.string().min(1, 'Mittente obbligatorio'),
  email_subject: z.string().min(1, 'Oggetto obbligatorio'),
  email_body: z.string().min(10, 'Corpo email troppo corto'),
})

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = manualEmailSchema.safeParse(body)

    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }))
      return errorResponse('VALIDATION_ERROR', 'Dati non validi', 400, issues)
    }

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse(
        'AI_NOT_CONFIGURED',
        "Chiave API Anthropic non configurata. Aggiungi ANTHROPIC_API_KEY nelle variabili d'ambiente.",
        503,
      )
    }

    const emailData: RawEmailData = {
      email_from: parsed.data.email_from,
      email_subject: parsed.data.email_subject,
      email_body: parsed.data.email_body,
      email_date: new Date().toISOString(),
    }

    // Use the Email Intelligence Agent (multi-step: classify → search → act)
    const agentResult = await processEmail(emailData)

    // Map agent result to the format the frontend expects
    return successResponse({
      intent: agentResult.intent,
      confidence: agentResult.needs_review ? 0.6 : 0.9,
      summary: agentResult.summary,
      vendor: null,
      matched_request: null,
      action_taken: agentResult.actions_taken.length > 0,
      needs_review: agentResult.needs_review,
      actions: agentResult.actions_taken,
    })
  } catch (error) {
    console.error('POST /api/email-import error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
