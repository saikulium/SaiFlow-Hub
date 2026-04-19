import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import {
  processEmail,
  type EmailAttachmentFile,
  type RawEmailData,
} from '@/modules/core/email-intelligence'

// ---------------------------------------------------------------------------
// POST /api/email-import
//
// Importazione manuale email — autenticato via sessione (ADMIN/MANAGER).
// Supporta sia JSON (solo testo) che multipart/form-data (testo + PDF).
// L'Email Intelligence Agent classifica, cerca nel DB, e agisce.
//
// Per inviare allegati PDF, usa multipart/form-data con i campi:
//   - email_from, email_subject, email_body (text fields)
//   - attachments (File[], solo application/pdf, max 10MB each)
// ---------------------------------------------------------------------------

const manualEmailSchema = z.object({
  email_from: z.string().min(1, 'Mittente obbligatorio'),
  email_subject: z.string().min(1, 'Oggetto obbligatorio'),
  email_body: z.string().min(10, 'Corpo email troppo corto'),
})

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_ATTACHMENTS = 5
const ALLOWED_MIME_TYPES = new Set(['application/pdf'])

interface ParsedEmailInput {
  readonly email_from: string
  readonly email_subject: string
  readonly email_body: string
  readonly attachments: readonly EmailAttachmentFile[]
}

async function parseRequest(
  req: NextRequest,
): Promise<ParsedEmailInput | { error: string; details?: unknown }> {
  const contentType = req.headers.get('content-type') ?? ''

  // JSON path (existing behavior)
  if (contentType.includes('application/json')) {
    const body = await req.json()
    const parsed = manualEmailSchema.safeParse(body)
    if (!parsed.success) {
      return {
        error: 'Dati non validi',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      }
    }
    return { ...parsed.data, attachments: [] }
  }

  // Multipart path (new: text + PDF attachments)
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const textData = {
      email_from: String(form.get('email_from') ?? ''),
      email_subject: String(form.get('email_subject') ?? ''),
      email_body: String(form.get('email_body') ?? ''),
    }
    const parsed = manualEmailSchema.safeParse(textData)
    if (!parsed.success) {
      return {
        error: 'Dati non validi',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      }
    }

    // Collect file attachments
    const files = form
      .getAll('attachments')
      .filter((f): f is File => f instanceof File)
    if (files.length > MAX_ATTACHMENTS) {
      return { error: `Massimo ${MAX_ATTACHMENTS} allegati consentiti` }
    }

    const attachments: EmailAttachmentFile[] = []
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return {
          error: `Tipo file non supportato: ${file.name} (${file.type}). Solo PDF.`,
        }
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        return {
          error: `File troppo grande: ${file.name} (max 10MB)`,
        }
      }
      const arrayBuffer = await file.arrayBuffer()
      attachments.push({
        filename: file.name,
        content: Buffer.from(arrayBuffer),
        mimeType: file.type,
      })
    }

    return { ...parsed.data, attachments }
  }

  return {
    error: 'Content-Type non supportato. Usa JSON o multipart/form-data.',
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const input = await parseRequest(req)
    if ('error' in input) {
      return errorResponse('VALIDATION_ERROR', input.error, 400, input.details)
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
      email_from: input.email_from,
      email_subject: input.email_subject,
      email_body: input.email_body,
      email_date: new Date().toISOString(),
    }

    // Use the Email Intelligence Agent with optional PDF attachments
    const agentResult = await processEmail(
      emailData,
      authResult.id,
      input.attachments,
    )

    // Map agent result to the format the frontend expects
    return successResponse({
      intent: agentResult.intent,
      confidence: agentResult.confidence,
      summary: agentResult.summary,
      vendor: null,
      matched_request: null,
      action_taken: agentResult.actions_taken.length > 0,
      requires_human_decision: agentResult.requires_human_decision,
      decision_reason: agentResult.decision_reason,
      // Legacy field for backwards compat with older UI
      needs_review: agentResult.requires_human_decision,
      actions: agentResult.actions_taken,
      attachments_processed: input.attachments.length,
    })
  } catch (error) {
    console.error('POST /api/email-import error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
