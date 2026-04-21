import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import {
  emailIngestionSchema,
  processEmailIngestion,
  enrichWithAgent,
} from '@/modules/core/email-intelligence'
import {
  checkWebhookProcessed,
  recordWebhookProcessed,
} from '@/server/services/webhook-idempotency.service'

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

    // --- Autenticazione + Timestamp ---
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

    // --- Idempotency Key ---
    const webhookId = req.headers.get('x-webhook-id')
    if (webhookId) {
      const existing = await checkWebhookProcessed(webhookId)
      if (existing.processed && existing.response) {
        console.log(
          `[email-ingestion] Idempotency hit: webhook_id=${webhookId}`,
        )
        // Replay the exact stored response for idempotency
        return NextResponse.json(existing.response)
      }
    } else {
      console.warn(
        '[email-ingestion] Webhook ricevuto senza x-webhook-id — idempotency disattivata',
      )
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

    // --- Agent enrichment (fail-soft): downloads PDF attachments and lets
    //     the AI agent extract structured order confirmations from them.
    //     Only skipped when the commessa path ran or when no PDFs are present. ---
    let agentEnrichment: Awaited<ReturnType<typeof enrichWithAgent>> | null =
      null
    if (
      result.action !== 'create_commessa' &&
      parsed.data.attachments.length > 0 &&
      process.env.ANTHROPIC_API_KEY
    ) {
      try {
        agentEnrichment = await enrichWithAgent(parsed.data)
        if (agentEnrichment.attempted) {
          console.log(
            `[email-ingestion] Agent enrichment: invoked=${agentEnrichment.agent_invoked}` +
              ` downloaded=${agentEnrichment.attachments_downloaded}` +
              ` skipped=${agentEnrichment.attachments_skipped}`,
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[email-ingestion] Agent enrichment threw: ${msg}`)
      }
    }

    const enrichedResult = { ...result, agent_enrichment: agentEnrichment }
    const responseData = {
      success: true,
      data: enrichedResult,
    }

    // Registra idempotency
    if (webhookId) {
      await recordWebhookProcessed(
        webhookId,
        'email-ingestion',
        200,
        responseData,
      )
    }

    return successResponse(enrichedResult)
  } catch (error) {
    console.error('POST /api/webhooks/email-ingestion error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
