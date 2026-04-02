import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-response'
import { emailIngestionSchema } from '@/lib/validations/email-ingestion'
import { processEmailIngestion } from '@/server/services/email-ingestion.service'

// ---------------------------------------------------------------------------
// HMAC Signature Verification
// ---------------------------------------------------------------------------

function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  if (signature.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/email-ingestion
//
// Riceve email parsate e arricchite dall'AI tramite n8n.
// Supporta 3 azioni:
//   - new_request: crea una nuova PurchaseRequest con items, importi, ecc.
//   - update_existing: aggiorna una richiesta esistente (stato, tracking, ecc.)
//   - info_only: logga informazione nella timeline di una richiesta
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // --- Autenticazione: HMAC signature OPPURE Bearer token ---
    const signature = req.headers.get('x-webhook-signature') ?? ''
    const authHeader = req.headers.get('authorization') ?? ''
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : ''

    const isHmacValid = signature !== '' && verifySignature(rawBody, signature)
    const isBearerValid =
      bearerToken !== '' && bearerToken === process.env.WEBHOOK_SECRET

    if (!isHmacValid && !isBearerValid) {
      return errorResponse('UNAUTHORIZED', 'Firma webhook non valida', 401)
    }

    // --- Parsing JSON ---
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

    // --- Validazione con Zod ---
    const parsed = emailIngestionSchema.safeParse(body)

    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }))
      return errorResponse(
        'VALIDATION_ERROR',
        'Payload non valido',
        400,
        issues,
      )
    }

    // --- Debug: log campi AI ricevuti ---
    console.log(
      `[email-ingestion] Payload ricevuto: action=${parsed.data.action}` +
        ` vendor_code=${parsed.data.ai_vendor_code ?? 'NULL'}` +
        ` vendor_name=${parsed.data.ai_vendor_name ?? 'NULL'}` +
        ` needed_by=${parsed.data.ai_needed_by ?? 'NULL'}` +
        ` title=${parsed.data.ai_title ?? 'NULL'}` +
        ` items=${parsed.data.ai_items.length}` +
        ` estimated=${parsed.data.ai_estimated_amount ?? 'NULL'}` +
        ` confidence=${parsed.data.ai_confidence ?? 'NULL'}`,
    )

    // --- Processing ---
    const result = await processEmailIngestion(parsed.data)

    if (result.action === 'create_commessa') {
      console.log(
        `[email-ingestion] Risultato: action=${result.action} commessa=${result.commessa_code} suggested_prs=${result.suggested_prs_created} confidence=${result.ai_confidence}`,
      )
    } else {
      console.log(
        `[email-ingestion] Risultato: action=${result.action} request=${result.request_code} items=${result.items_created} status_updated=${result.status_updated} confidence=${result.ai_confidence}`,
      )
    }

    return successResponse(result)
  } catch (error) {
    console.error('POST /api/webhooks/email-ingestion error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
