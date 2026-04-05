import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-response'
import {
  classifyEmailIntent,
  mapClassificationToPayload,
  EmailClassificationError,
} from '@/server/services/email-ai-classifier.service'
import type { RawEmailData } from '@/server/services/email-ai-classifier.service'
import { processEmailIngestion } from '@/server/services/email-ingestion.service'

// ---------------------------------------------------------------------------
// POST /api/email-import
//
// Importazione manuale email — autenticato via sessione (ADMIN/MANAGER).
// L'utente incolla mittente, oggetto e corpo dell'email. L'AI classifica
// l'intent e, se la confidence è alta, crea/aggiorna la richiesta.
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

    const emailData: RawEmailData = {
      email_from: parsed.data.email_from,
      email_subject: parsed.data.email_subject,
      email_body: parsed.data.email_body,
      email_date: new Date().toISOString(),
    }

    // AI Classification
    let classification
    try {
      classification = await classifyEmailIntent(emailData)
    } catch (err) {
      if (err instanceof EmailClassificationError) {
        if (err.code === 'AI_NOT_CONFIGURED') {
          return errorResponse(
            'AI_NOT_CONFIGURED',
            'Chiave API Anthropic non configurata. Aggiungi ANTHROPIC_API_KEY nelle variabili d\'ambiente.',
            503,
          )
        }
        return errorResponse(err.code, err.message, 500)
      }
      return errorResponse('AI_ERROR', 'Errore nella classificazione AI', 500)
    }

    // Process based on confidence
    const CONFIDENCE_THRESHOLD = 0.6 // Lower threshold for manual import
    let actionTaken = false
    let result = undefined

    if (classification.confidence >= CONFIDENCE_THRESHOLD) {
      const payload = mapClassificationToPayload(emailData, classification)
      result = await processEmailIngestion(payload)
      actionTaken = true
    }

    return successResponse({
      intent: classification.intent,
      confidence: classification.confidence,
      summary: classification.extracted_data.summary,
      vendor: classification.extracted_data.vendor_name,
      matched_request: classification.extracted_data.matched_request_code,
      action_taken: actionTaken,
      result,
    })
  } catch (error) {
    console.error('POST /api/email-import error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
