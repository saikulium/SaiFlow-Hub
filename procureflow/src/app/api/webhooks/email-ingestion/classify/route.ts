import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse } from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import {
  checkWebhookProcessed,
  recordWebhookProcessed,
} from '@/server/services/webhook-idempotency.service'
import {
  classifyEmailIntent,
  mapClassificationToPayload,
  EmailClassificationError,
} from '@/server/services/email-ai-classifier.service'
import type { RawEmailData } from '@/server/services/email-ai-classifier.service'
import { processEmailIngestion } from '@/server/services/email-ingestion.service'
import { prisma } from '@/lib/db'
import { createNotification, NOTIFICATION_TYPES } from '@/server/services/notification.service'

// ---------------------------------------------------------------------------
// POST /api/webhooks/email-ingestion/classify
//
// Riceve email **grezze** (senza pre-classificazione AI) e usa Claude
// per classificare l'intent e decidere l'azione da eseguire.
//
// Flusso:
//   1. Auth (HMAC/Bearer) + timestamp + idempotency
//   2. Classifica con AI → intent + confidence
//   3. Se confidence >= 0.8 → azione automatica via processEmailIngestion()
//   4. Se confidence < 0.8 → notifica ADMIN/MANAGER, nessuna azione
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD = 0.8

const rawEmailSchema = z.object({
  email_from: z.string().min(1, 'Mittente obbligatorio'),
  email_to: z.string().optional(),
  email_subject: z.string().min(1, 'Oggetto obbligatorio'),
  email_body: z.string().min(1, 'Corpo email obbligatorio'),
  email_date: z.string().optional(),
  email_message_id: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        url: z.string().url(),
        mime_type: z.string().optional(),
      }),
    )
    .default([]),
})

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // --- Auth + Timestamp ---
    const isAuthed = verifyWebhookAuth(
      rawBody,
      req.headers.get('x-webhook-signature'),
      req.headers.get('authorization'),
      process.env.WEBHOOK_SECRET,
      req.headers.get('x-webhook-timestamp'),
    )

    if (!isAuthed) {
      return errorResponse('UNAUTHORIZED', 'Firma webhook non valida', 401)
    }

    // --- Idempotency ---
    const webhookId = req.headers.get('x-webhook-id')
    if (webhookId) {
      const existing = await checkWebhookProcessed(webhookId)
      if (existing.processed && existing.response) {
        console.log(`[email-classify] Idempotency hit: webhook_id=${webhookId}`)
        return Response.json(existing.response, { status: 200 })
      }
    } else {
      console.warn(
        '[email-classify] Webhook ricevuto senza x-webhook-id — idempotency disattivata',
      )
    }

    // --- Parse + Validate ---
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return errorResponse(
        'INVALID_PAYLOAD',
        'Il corpo della richiesta non è un JSON valido',
        400,
      )
    }

    const parsed = rawEmailSchema.safeParse(body)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }))
      return errorResponse('VALIDATION_ERROR', 'Payload non valido', 400, issues)
    }

    const emailData: RawEmailData = parsed.data

    // --- AI Classification ---
    let classification
    try {
      classification = await classifyEmailIntent(emailData)
    } catch (err) {
      if (err instanceof EmailClassificationError) {
        const statusCode =
          err.code === 'AI_NOT_CONFIGURED'
            ? 503
            : err.code === 'AI_TIMEOUT'
              ? 504
              : err.code === 'AI_INVALID_JSON'
                ? 422
                : 500
        return errorResponse(err.code, err.message, statusCode)
      }
      return errorResponse(
        'AI_ERROR',
        'Errore nella classificazione AI',
        500,
      )
    }

    console.log(
      `[email-classify] Risultato AI: intent=${classification.intent}` +
        ` confidence=${classification.confidence}` +
        ` pr_code=${classification.extracted_data.matched_request_code ?? 'NULL'}` +
        ` vendor=${classification.extracted_data.vendor_name ?? 'NULL'}`,
    )

    // --- Decide: azione automatica o notifica ---
    let actionTaken = false
    let ingestionResult = undefined
    let notificationSent = false

    if (classification.confidence >= CONFIDENCE_THRESHOLD) {
      // Alta confidence → azione automatica
      const payload = mapClassificationToPayload(emailData, classification)
      ingestionResult = await processEmailIngestion(payload)
      actionTaken = true

      console.log(
        `[email-classify] Azione automatica: action=${ingestionResult.action}` +
          ` request=${ingestionResult.request_code}`,
      )

      // Notifica conferma dell'azione eseguita
      await notifyActionTaken(
        classification.intent,
        classification.extracted_data.summary,
        ingestionResult.request_code,
      )
      notificationSent = true
    } else {
      // Bassa confidence → solo notifica per review umana
      await notifyLowConfidence(
        classification.intent,
        classification.confidence,
        classification.extracted_data.summary,
        classification.extracted_data.matched_request_code,
        emailData.email_from,
      )
      notificationSent = true

      console.log(
        `[email-classify] Bassa confidence (${classification.confidence}) — solo notifica`,
      )
    }

    const responseData = {
      success: true,
      data: {
        intent: classification.intent,
        confidence: classification.confidence,
        action_taken: actionTaken,
        result: ingestionResult,
        notification_sent: notificationSent,
      },
    }

    // Registra idempotency
    if (webhookId) {
      await recordWebhookProcessed(
        webhookId,
        'email-classify',
        200,
        responseData,
      )
    }

    return Response.json(responseData, { status: 200 })
  } catch (error) {
    console.error('POST /api/webhooks/email-ingestion/classify error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}

// ---------------------------------------------------------------------------
// Notifiche
// ---------------------------------------------------------------------------

async function notifyActionTaken(
  intent: string,
  summary: string,
  requestCode: string,
): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  })

  await Promise.all(
    recipients.map((r) =>
      createNotification({
        userId: r.id,
        title: `AI ha eseguito azione: ${intent}`,
        body: `${summary}\n\nRichiesta: ${requestCode}. Azione eseguita automaticamente (confidence alta). Verifica.`,
        type: NOTIFICATION_TYPES.EMAIL_INGESTION,
        link: `/requests/${requestCode}`,
      }),
    ),
  )
}

async function notifyLowConfidence(
  intent: string,
  confidence: number,
  summary: string,
  requestCode: string | undefined,
  emailFrom: string,
): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  })

  const pct = Math.round(confidence * 100)
  const link = requestCode ? `/requests/${requestCode}` : '/requests'

  await Promise.all(
    recipients.map((r) =>
      createNotification({
        userId: r.id,
        title: `Email da classificare: ${intent} (${pct}%)`,
        body: `Email da ${emailFrom}. Intent suggerito: ${intent} (confidence ${pct}%). ${summary}\n\nNessuna azione automatica — richiede conferma manuale.`,
        type: NOTIFICATION_TYPES.EMAIL_INGESTION,
        link,
      }),
    ),
  )
}
